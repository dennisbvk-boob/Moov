import { supabase } from './supabase';
import { functionErrorCode, functionNotDeployed, translateSharedError } from './fnError';
import { CATS } from '../theme';
import type { Task, TaskHelp } from '../types';

/**
 * Calls the "task-help" Edge Function to look up how to carry one task out.
 * Requires the function to be deployed and a GEMINI_API_KEY secret on the
 * Supabase project — see README step 3.
 */
export async function lookUpHelp(task: Task): Promise<TaskHelp> {
  if (!supabase) throw new Error('Geen database ingesteld.');

  const { data, error } = await supabase.functions.invoke<{ help?: TaskHelp; error?: string }>(
    'task-help',
    {
      body: {
        title: task.title,
        note: task.note ?? undefined,
        cat: CATS[task.cat]?.label.toLowerCase(),
      },
    },
  );

  if (error) {
    if (functionNotDeployed(error))
      throw new Error('De Edge Function "task-help" staat nog niet op Supabase. Zie README stap 3.');
    const code = await functionErrorCode(error);
    throw new Error(
      code
        ? translateHelpError(code)
        : 'Het opzoeken lukte niet. Controleer je internetverbinding.',
    );
  }
  if (data?.error) throw new Error(translateHelpError(data.error));
  if (!data?.help) throw new Error('Er kwam geen bruikbaar antwoord terug. Probeer het nog eens.');

  return data.help;
}

function translateHelpError(code: string): string {
  return (
    translateSharedError(code, 'hulp') ??
    (code === 'MISSING_TASK'
      ? 'Deze taak heeft nog geen titel om op te zoeken.'
      : 'Het opzoeken lukte niet. Probeer het nog eens.')
  );
}
