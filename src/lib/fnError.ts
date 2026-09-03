/**
 * Turn a failed `supabase.functions.invoke()` into a message that names the
 * real cause.
 *
 * The catch: invoke() treats *any* non-2xx as a transport failure. It hands
 * back `error` and leaves `data` null, so an Edge Function that deliberately
 * answers `400 {"error":"NOT_CONFIGURED"}` — which is exactly what ours do —
 * never reaches the code reading `data.error`. Every cause therefore surfaced
 * as the same "is the function deployed?", which sent people looking at a
 * function that was deployed and working.
 *
 * The body is still there, on `error.context` (the raw Response). Read it.
 */
export async function functionErrorCode(error: unknown): Promise<string | null> {
  const ctx = (error as { context?: unknown })?.context;
  if (!(ctx instanceof Response)) return null;
  try {
    const body = (await ctx.clone().json()) as { error?: unknown };
    return typeof body.error === 'string' ? body.error : null;
  } catch {
    return null; // not JSON — a gateway error page, or an empty body
  }
}

/** True when the function itself is missing, rather than failing. */
export function functionNotDeployed(error: unknown): boolean {
  const ctx = (error as { context?: unknown })?.context;
  return ctx instanceof Response && ctx.status === 404;
}

/** Codes both AI functions can return, in the words a user can act on. */
export function translateSharedError(code: string, what: 'wizard' | 'assistent'): string | null {
  if (code === 'NOT_SIGNED_IN') return `Log eerst in om de AI-${what} te gebruiken.`;
  if (code === 'NOT_CONFIGURED')
    return `De AI-${what} heeft nog geen API-sleutel op de server. Zet GEMINI_API_KEY onder Supabase → Edge Functions → Secrets (zie README stap 3).`;
  if (code.startsWith('AI_REQUEST_FAILED'))
    return `De AI-dienst gaf een foutmelding terug (${code.replace('AI_REQUEST_FAILED: ', 'HTTP ')}). Controleer of de API-sleutel geldig is en of het dagelijkse gratis limiet niet op is.`;
  if (code === 'AI_BAD_RESPONSE')
    return 'De AI gaf een leeg antwoord terug. Probeer het nog eens.';
  return null;
}
