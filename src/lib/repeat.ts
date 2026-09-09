import { addDays, d, toISO } from './dates';
import type { Repeat, RepeatUnit } from '../types';

export const REPEAT_UNITS: RepeatUnit[] = ['dag', 'week', 'maand', 'jaar'];

/**
 * One step forward, honouring the length of the month you land in. Naively
 * adding a month to 31 januari gives 31 februari, which JavaScript silently
 * rolls into maart — so the day is put back only after the month has moved,
 * clamped to whatever that month actually has.
 */
export function stepOnce(iso: string, r: Repeat): string {
  const n = Math.max(1, Math.round(r.interval));
  if (r.unit === 'dag') return addDays(iso, n);
  if (r.unit === 'week') return addDays(iso, n * 7);

  const x = d(iso);
  const day = x.getDate();
  x.setDate(1);
  if (r.unit === 'maand') x.setMonth(x.getMonth() + n);
  else x.setFullYear(x.getFullYear() + n);
  const lastOfMonth = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
  x.setDate(Math.min(day, lastOfMonth));
  return toISO(x);
}

/**
 * Where a recurring task lands after you tick it off. Stepping once isn't
 * enough: tick off a weekly task you forgot for a month and one step leaves it
 * still in the past, where it would show up as overdue the moment you closed
 * it. Keep stepping until it is genuinely ahead of you.
 */
export function nextDate(iso: string, r: Repeat, today: string): string {
  let next = stepOnce(iso, r);
  // Bounded: a daily task left for two years is ~730 steps, and nothing
  // legitimate needs more than that.
  for (let i = 0; i < 1000 && next <= today; i++) next = stepOnce(next, r);
  return next;
}

const PLURAL: Record<RepeatUnit, string> = {
  dag: 'dagen',
  week: 'weken',
  maand: 'maanden',
  jaar: 'jaar',
};

/** "elke week" / "elke 2 maanden" / "elk jaar" — null for a one-off. */
export function repeatLabel(r: Repeat | null): string | null {
  if (!r) return null;
  const n = Math.max(1, Math.round(r.interval));
  if (n === 1) return r.unit === 'jaar' ? 'elk jaar' : `elke ${r.unit}`;
  return `elke ${n} ${PLURAL[r.unit]}`;
}
