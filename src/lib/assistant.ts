import { supabase } from './supabase';
import { functionErrorCode, functionNotDeployed, translateSharedError } from './fnError';
import { addDays } from './dates';
import type { CatKey } from '../theme';
import type { Household, Task, Who } from '../types';

export interface PlanEditAdd {
  id: string;
  title: string;
  cat: CatKey;
  who: Who;
  date: string;
  time: string | null;
  note: string | null;
  amount: number | null;
  vendor: string | null;
}

export interface PlanEditUpdate {
  id: string;
  before: Task;
  patch: Partial<Pick<Task, 'title' | 'cat' | 'who' | 'date' | 'time' | 'note' | 'amount' | 'vendor'>>;
}

export interface PlanEdits {
  adds: PlanEditAdd[];
  updates: PlanEditUpdate[];
  completeIds: string[];
}

interface RawAdd {
  title: string;
  cat: CatKey;
  who: Who;
  offsetDays: number;
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
}

interface RawUpdate {
  id: string;
  title?: string;
  cat?: CatKey;
  who?: Who;
  date?: string;
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
}

/**
 * Calls the "update-plan" Edge Function to turn a free-text request into a
 * set of edits (new tasks, patches to existing ones, tasks to tick off) for
 * an already-existing plan. Requires the function to be deployed and a
 * GEMINI_API_KEY secret set on the Supabase project — see README.
 */
export async function runAiUpdate(
  household: Household,
  tasks: Task[],
  instruction: string,
): Promise<PlanEdits> {
  if (!supabase) throw new Error('Geen database ingesteld.');
  const { data, error } = await supabase.functions.invoke<{
    adds?: RawAdd[];
    updates?: RawUpdate[];
    completes?: string[];
    error?: string;
  }>('update-plan', {
    body: {
      address: household.address,
      moveDate: household.move_date,
      instruction,
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        cat: t.cat,
        who: t.who,
        date: t.date,
        done: t.done,
      })),
    },
  });
  if (error) {
    if (functionNotDeployed(error))
      throw new Error(
        'De Edge Function "update-plan" staat nog niet op Supabase. Zie README stap 3.',
      );
    const code = await functionErrorCode(error);
    throw new Error(code ? translateAssistantError(code) : 'De AI-assistent is niet bereikbaar. Controleer je internetverbinding.');
  }
  if (data?.error) throw new Error(translateAssistantError(data.error));

  const byId = new Map(tasks.map((t) => [t.id, t]));

  const adds: PlanEditAdd[] = (data?.adds ?? []).map((r) => ({
    id: crypto.randomUUID(),
    title: r.title,
    cat: r.cat,
    who: r.who,
    date: addDays(household.move_date, r.offsetDays),
    time: r.time ?? null,
    note: r.note ?? null,
    amount: r.amount ?? null,
    vendor: r.vendor ?? null,
  }));

  const updates: PlanEditUpdate[] = [];
  for (const r of data?.updates ?? []) {
    const before = byId.get(r.id);
    if (!before) continue; // the function already filters unknown ids, but stay defensive
    const { id, ...rest } = r;
    const patch = Object.fromEntries(
      Object.entries(rest).filter(([, v]) => v !== undefined),
    ) as PlanEditUpdate['patch'];
    if (!Object.keys(patch).length) continue;
    updates.push({ id, before, patch });
  }

  const completeIds = (data?.completes ?? []).filter((id) => {
    const t = byId.get(id);
    return t && !t.done;
  });

  return { adds, updates, completeIds };
}

function translateAssistantError(code: string): string {
  return (
    translateSharedError(code, 'assistent') ??
    (code === 'MISSING_INSTRUCTION'
      ? 'Typ eerst wat je wilt aanpassen.'
      : 'Het bijwerken van je plan lukte niet. Probeer het nog eens.')
  );
}
