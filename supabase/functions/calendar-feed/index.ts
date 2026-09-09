// Supabase Edge Function: serves one household's plan as a calendar feed, so
// Google Calendar or Apple Calendar can subscribe to it and show your tasks
// next to the rest of your week.
//
// Deploy: paste this file into Supabase Dashboard → Edge Functions → Create a
// function named "calendar-feed". Two things differ from the other functions:
//
//   1. TURN OFF "Verify JWT" for this one. Google's and Apple's servers fetch
//      the URL without a login, so a function that demands a token header
//      returns 401 to them and the calendar stays empty. The ?token= in the
//      URL is what stands in for the login instead.
//   2. It needs the SUPABASE_SERVICE_ROLE_KEY secret, because there is no
//      logged-in user whose row-level security could let it read the plan.
//      That key never leaves the server. Never put it in the app's own env.
//
// See README step 6.

import { createClient } from 'jsr:@supabase/supabase-js@2';

interface Repeat {
  unit: 'dag' | 'week' | 'maand' | 'jaar';
  interval: number;
}

interface TaskRow {
  id: string;
  title: string;
  date: string;
  time: string | null;
  note: string | null;
  amount: number | null;
  done: boolean;
  repeat: Repeat | null;
  party_id: string | null;
}

const FREQ: Record<Repeat['unit'], string> = {
  dag: 'DAILY',
  week: 'WEEKLY',
  maand: 'MONTHLY',
  jaar: 'YEARLY',
};

// Deliberately duplicated from src/lib/calendar.ts rather than shared: this
// file has to stand alone to be pasted into the dashboard editor.
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function fold(line: string): string {
  if (line.length <= 73) return line;
  const out: string[] = [];
  let rest = line;
  while (rest.length > 73) {
    out.push(rest.slice(0, 73));
    rest = ' ' + rest.slice(73);
  }
  out.push(rest);
  return out.join('\r\n');
}

const stamp = (iso: string) => iso.replace(/-/g, '');
const clock = (hhmm: string) => hhmm.replace(':', '') + '00';
const pad = (n: number) => String(n).padStart(2, '0');

function addOneDay(iso: string): string {
  const x = new Date(iso + 'T00:00:00Z');
  x.setUTCDate(x.getUTCDate() + 1);
  return `${x.getUTCFullYear()}${pad(x.getUTCMonth() + 1)}${pad(x.getUTCDate())}`;
}

/**
 * Times are written "floating" — no timezone, no Z — so every client reads
 * them in its own zone. For one household in one country that is right, and it
 * avoids shipping a VTIMEZONE block from a server that runs in UTC.
 */
function vevent(t: TaskRow, address: string, partyName: string | null, now: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${t.id}@moov.nl`, `DTSTAMP:${now}`];

  if (t.time) {
    const [h, m] = t.time.split(':').map(Number);
    const total = h * 60 + m + 60;
    const rolls = total >= 24 * 60;
    const eh = Math.floor((total % (24 * 60)) / 60);
    const em = total % 60;
    lines.push(`DTSTART:${stamp(t.date)}T${clock(t.time)}`);
    lines.push(`DTEND:${rolls ? addOneDay(t.date) : stamp(t.date)}T${pad(eh)}${pad(em)}00`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${stamp(t.date)}`);
    lines.push(`DTEND;VALUE=DATE:${addOneDay(t.date)}`);
  }

  if (t.repeat && FREQ[t.repeat.unit]) {
    const n = Math.max(1, Math.round(t.repeat.interval || 1));
    lines.push(`RRULE:FREQ=${FREQ[t.repeat.unit]}${n > 1 ? `;INTERVAL=${n}` : ''}`);
  }

  lines.push(`SUMMARY:${esc((t.done ? '✓ ' : '') + t.title)}`);

  const body = [
    t.note ?? '',
    partyName ? `Uitvoerder: ${partyName}` : '',
    t.amount ? `Bedrag: € ${Math.round(Number(t.amount))}` : '',
    'Uit je plan op Moov.nl',
  ]
    .filter(Boolean)
    .join('\n');
  lines.push(`DESCRIPTION:${esc(body)}`);
  if (address) lines.push(`LOCATION:${esc(address)}`);
  if (t.done) lines.push('TRANSP:TRANSPARENT');

  if (!t.done) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(t.title)}`,
      // An hour before an appointment; at 09:00 for an all-day task. Google
      // ignores alarms on subscribed calendars, Apple honours them.
      t.time ? 'TRIGGER:-PT1H' : 'TRIGGER;RELATED=START:PT9H',
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' },
    });
  }

  const token = new URL(req.url).searchParams.get('token')?.trim();
  // Deliberately vague, and the same for a missing and a wrong token: this
  // endpoint is open to the internet, so it should not confirm which tokens
  // are real.
  const refuse = () => new Response('Geen geldige agenda-link.', { status: 404 });
  if (!token || token.length < 20) return refuse();

  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!service) return new Response('Server niet ingesteld.', { status: 500 });

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, service);

  const { data: household, error } = await supabase
    .from('households')
    .select('id, address, name_a, name_b')
    .eq('calendar_token', token)
    .maybeSingle();
  if (error || !household) return refuse();

  const [{ data: tasks }, { data: parties }] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, date, time, note, amount, done, repeat, party_id')
      .eq('household_id', household.id)
      .order('date', { ascending: true }),
    supabase.from('parties').select('id, name').eq('household_id', household.id),
  ]);

  const names = new Map((parties ?? []).map((p: { id: string; name: string }) => [p.id, p.name]));
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moov.nl//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc('Moov · ' + household.address)}`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H',
    'X-PUBLISHED-TTL:PT2H',
  ];
  for (const t of (tasks ?? []) as TaskRow[]) {
    lines.push(...vevent(t, household.address, t.party_id ? names.get(t.party_id) ?? null : null, now));
  }
  lines.push('END:VCALENDAR');

  const body = lines.map(fold).join('\r\n') + '\r\n';

  return new Response(req.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="moov.ics"',
      // Subscribed calendars re-fetch on their own schedule; a short cache
      // keeps a refresh loop from becoming a bill.
      'cache-control': 'public, max-age=900',
      'Access-Control-Allow-Origin': '*',
    },
  });
});
