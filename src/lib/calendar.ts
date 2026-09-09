import type { Repeat, Task } from '../types';

/**
 * Times are written "floating": no timezone, no Z. RFC 5545 says a floating
 * time is read in whatever zone the viewer is in, which for a household that
 * lives in one place is exactly right — and it saves shipping a VTIMEZONE
 * block, or converting to UTC in two places that would eventually disagree.
 */

const FREQ: Record<Repeat['unit'], string> = {
  dag: 'DAILY',
  week: 'WEEKLY',
  maand: 'MONTHLY',
  jaar: 'YEARLY',
};

/** Escape the four characters that mean something to a calendar parser. */
function esc(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Fold at 75 octets, as the spec demands — some parsers really do care. */
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

function addOneDay(iso: string): string {
  const x = new Date(iso + 'T00:00:00');
  x.setDate(x.getDate() + 1);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}${p(x.getMonth() + 1)}${p(x.getDate())}`;
}

export interface CalendarTask {
  id: string;
  title: string;
  date: string;
  time: string | null;
  note: string | null;
  amount: number | null;
  done: boolean;
  repeat: Repeat | null;
  /** Name of the third party carrying it out, when there is one. */
  partyName?: string | null;
}

/** One VEVENT. A task with a time is an hour long; without one it's all-day. */
export function vevent(t: CalendarTask, address: string, now: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${t.id}@moov.nl`, `DTSTAMP:${now}`];

  if (t.time) {
    lines.push(`DTSTART:${stamp(t.date)}T${clock(t.time)}`);
    // An hour is a guess, but an event with no length shows up as a sliver you
    // can't read on a week view.
    const [h, m] = t.time.split(':').map(Number);
    const end = new Date(2000, 0, 1, h, m + 60);
    const p = (n: number) => String(n).padStart(2, '0');
    const sameDay = end.getDate() === 1;
    lines.push(
      `DTEND:${sameDay ? stamp(t.date) : addOneDay(t.date)}T${p(end.getHours())}${p(end.getMinutes())}00`,
    );
  } else {
    lines.push(`DTSTART;VALUE=DATE:${stamp(t.date)}`);
    // DTEND is exclusive for all-day events: the day after is what makes it
    // one day long rather than zero.
    lines.push(`DTEND;VALUE=DATE:${addOneDay(t.date)}`);
  }

  if (t.repeat && FREQ[t.repeat.unit]) {
    const n = Math.max(1, Math.round(t.repeat.interval));
    lines.push(`RRULE:FREQ=${FREQ[t.repeat.unit]}${n > 1 ? `;INTERVAL=${n}` : ''}`);
  }

  lines.push(`SUMMARY:${esc((t.done ? '✓ ' : '') + t.title)}`);

  const body = [
    t.note ?? '',
    t.partyName ? `Uitvoerder: ${t.partyName}` : '',
    t.amount ? `Bedrag: € ${Math.round(t.amount)}` : '',
    'Uit je plan op Moov.nl',
  ]
    .filter(Boolean)
    .join('\n');
  lines.push(`DESCRIPTION:${esc(body)}`);
  if (address) lines.push(`LOCATION:${esc(address)}`);
  if (t.done) lines.push('STATUS:CONFIRMED', 'TRANSP:TRANSPARENT');

  // A reminder is the whole point of putting it in a calendar: an hour before
  // an appointment, or at 09:00 on the morning of an all-day task.
  if (!t.done) {
    lines.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(t.title)}`,
      t.time ? 'TRIGGER:-PT1H' : 'TRIGGER;RELATED=START:PT9H',
      'END:VALARM',
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

/** A whole calendar document. */
export function buildIcs(tasks: CalendarTask[], address: string, name: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Moov.nl//NL',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(name)}`,
    'X-WR-TIMEZONE:Europe/Amsterdam',
    // Tell subscribing clients not to hammer the function; Google ignores it,
    // Apple honours it.
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H',
    'X-PUBLISHED-TTL:PT2H',
  ];
  for (const t of tasks) lines.push(...vevent(t, address, now));
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * A Google Calendar "new event" URL with everything pre-filled. Nothing is
 * created until the user presses save in their own calendar, which is why this
 * needs no permission from them and no OAuth from us.
 */
export function googleCalUrl(t: CalendarTask, address: string): string {
  const dates = t.time
    ? (() => {
        const [h, m] = t.time!.split(':').map(Number);
        const end = new Date(2000, 0, 1, h, m + 60);
        const p = (n: number) => String(n).padStart(2, '0');
        // An evening appointment ends on the next day; without this it would
        // end an hour before it starts.
        const endDay = end.getDate() === 1 ? stamp(t.date) : addOneDay(t.date);
        return `${stamp(t.date)}T${clock(t.time!)}/${endDay}T${p(end.getHours())}${p(end.getMinutes())}00`;
      })()
    : `${stamp(t.date)}/${addOneDay(t.date)}`;

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: t.title,
    dates,
    details: [t.note ?? '', t.partyName ? `Uitvoerder: ${t.partyName}` : '', 'Uit je plan op Moov.nl']
      .filter(Boolean)
      .join('\n'),
    location: address,
    // Without this Google reads a floating time in the account's own zone,
    // which is usually right and occasionally very wrong.
    ctz: 'Europe/Amsterdam',
  });
  if (t.repeat && FREQ[t.repeat.unit]) {
    const n = Math.max(1, Math.round(t.repeat.interval));
    params.set('recur', `RRULE:FREQ=${FREQ[t.repeat.unit]}${n > 1 ? `;INTERVAL=${n}` : ''}`);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Hand the browser a .ics file — the route into Apple Calendar and Outlook. */
export function downloadIcs(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on the next tick: Safari needs the URL to survive the click.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Turn a task into the shape the calendar helpers want. */
export function toCalendarTask(t: Task, partyName: string | null): CalendarTask {
  return {
    id: t.id,
    title: t.title,
    date: t.date,
    time: t.time,
    note: t.note,
    amount: t.amount,
    done: t.done,
    repeat: t.repeat,
    partyName,
  };
}

/** 32 characters of randomness: the only thing guarding the feed URL. */
export function makeFeedToken(): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}
