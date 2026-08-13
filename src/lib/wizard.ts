import { supabase } from './supabase';
import { addDays } from './dates';
import type { CatKey } from '../theme';
import type { Task, Who } from '../types';

export interface WizardAnswers {
  address: string;
  moveDate: string;
  homeType: string;
  rooms: string;
  renovation: boolean;
  packing: 'zelf' | 'verhuisbedrijf';
  diy: 'zelf' | 'uitbesteden';
  kidsOrPets: boolean;
  notes: string;
}

interface AiTaskRow {
  title: string;
  cat: CatKey;
  who: Who;
  offsetDays: number;
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
}

/**
 * Calls the "generate-plan" Edge Function to turn a few answers about the
 * move into a tailored task list. Requires the function to be deployed and
 * a GEMINI_API_KEY secret set on the Supabase project — see README.
 */
export async function generateAiPlan(
  householdId: string,
  answers: WizardAnswers,
): Promise<Task[]> {
  if (!supabase) throw new Error('Geen database ingesteld.');
  const { data, error } = await supabase.functions.invoke<{ tasks?: AiTaskRow[]; error?: string }>(
    'generate-plan',
    { body: answers },
  );
  if (error) throw new Error('De AI-wizard is niet bereikbaar. Is de Edge Function gedeployed?');
  if (data?.error) throw new Error(translateWizardError(data.error));
  const rows = data?.tasks ?? [];
  if (!rows.length) throw new Error('De AI gaf geen taken terug. Probeer het nog eens.');

  const now = new Date().toISOString();
  return rows.map((r) => ({
    id: crypto.randomUUID(),
    household_id: householdId,
    title: r.title,
    cat: r.cat,
    who: r.who,
    party_id: null,
    date: addDays(answers.moveDate, r.offsetDays),
    time: r.time ?? null,
    note: r.note ?? null,
    amount: r.amount ?? null,
    vendor: r.vendor ?? null,
    job_id: null,
    done: false,
    done_by: null,
    updated_at: now,
  }));
}

function translateWizardError(code: string): string {
  if (code === 'NOT_SIGNED_IN') return 'Log eerst in om de AI-wizard te gebruiken.';
  if (code === 'NOT_CONFIGURED')
    return 'De AI-wizard is nog niet ingesteld (ontbrekende API-sleutel op de server).';
  return 'Het maken van een plan lukte niet. Probeer het nog eens.';
}
