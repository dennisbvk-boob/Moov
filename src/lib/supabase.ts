import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/**
 * The Supabase client, or null when no credentials are configured.
 * Without credentials the app still runs fully — it just keeps everything
 * on this one device instead of syncing between two phones.
 */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true },
        realtime: { params: { eventsPerSecond: 5 } },
      })
    : null;

export const syncEnabled = supabase !== null;

export interface Session {
  userId: string;
  email: string;
}

/** The session stored on this device, if the user has logged in before. */
export async function currentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  const u = data.session?.user;
  if (!u?.email) return null;
  return { userId: u.id, email: u.email.toLowerCase() };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export function looksLikeEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/**
 * Step 1 of logging in: mail a six-digit code to the address.
 * Requires the Magic Link email template to contain {{ .Token }} — see README.
 */
export async function sendLoginCode(email: string): Promise<void> {
  if (!supabase) throw new Error('Geen database ingesteld.');
  const { error } = await supabase.auth.signInWithOtp({
    email: normalizeEmail(email),
    options: { shouldCreateUser: true },
  });
  if (error) throw new Error(translateAuthError(error.message));
}

/** Step 2: exchange that code for a session on this device. */
export async function verifyLoginCode(email: string, token: string): Promise<Session> {
  if (!supabase) throw new Error('Geen database ingesteld.');
  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizeEmail(email),
    token: token.trim(),
    type: 'email',
  });
  if (error) throw new Error(translateAuthError(error.message));
  const u = data.user;
  if (!u?.email) throw new Error('Inloggen lukte niet. Probeer het opnieuw.');
  return { userId: u.id, email: u.email.toLowerCase() };
}

export async function signOut(): Promise<void> {
  if (supabase) await supabase.auth.signOut();
}

/** Supabase speaks English and rate-limit-ese; the app speaks Dutch. */
function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('failed to fetch') || m.includes('networkerror') || m.includes('load failed'))
    return 'Geen verbinding met de server. Controleer je internet en probeer opnieuw.';
  if (m.includes('rate limit') || m.includes('too many') || m.includes('after'))
    return 'Te veel pogingen. Wacht een minuut en probeer het opnieuw.';
  if (m.includes('expired')) return 'Die code is verlopen. Vraag een nieuwe aan.';
  if (m.includes('invalid') || m.includes('token'))
    return 'Die code klopt niet. Kijk nog eens in je mail.';
  if (m.includes('signups not allowed') || m.includes('not authorized'))
    return 'Dit e-mailadres mag nog niet inloggen. Controleer de Supabase-instellingen.';
  return message;
}

/** Six characters, no vowels and no 0/O/1/I — easy to read out loud. */
export function makeJoinCode(): string {
  const alphabet = 'BCDFGHJKLMNPQRSTVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
