const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
const MONTHS_LONG = [
  'januari', 'februari', 'maart', 'april', 'mei', 'juni',
  'juli', 'augustus', 'september', 'oktober', 'november', 'december',
];
const DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'];

/** Parse an ISO date (YYYY-MM-DD) as local midnight, avoiding UTC drift. */
export function d(iso: string): Date {
  return new Date(iso + 'T00:00:00');
}

/** Today as YYYY-MM-DD in the device's own timezone. */
export function todayISO(): string {
  const n = new Date();
  return toISO(n);
}

export function toISO(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Whole days from `a` to `b`; negative when b is in the past. */
export function daysBetween(a: string, b: string): number {
  return Math.round((d(b).getTime() - d(a).getTime()) / 864e5);
}

export function addDays(iso: string, n: number): string {
  const x = d(iso);
  x.setDate(x.getDate() + n);
  return toISO(x);
}

/** "za 12 sep" */
export function fmtShort(iso: string): string {
  const x = d(iso);
  return `${DAYS[x.getDay()]} ${x.getDate()} ${MONTHS[x.getMonth()]}`;
}

/** "zaterdag 12 september" */
export function fmtLong(iso: string): string {
  const x = d(iso);
  return `${DAYS_LONG[x.getDay()]} ${x.getDate()} ${MONTHS_LONG[x.getMonth()]}`;
}

/** "12" / "SEP" for the little calendar chip */
export function fmtChip(iso: string): { day: string; month: string } {
  const x = d(iso);
  return { day: String(x.getDate()), month: MONTHS[x.getMonth()].toUpperCase() };
}

/** "12 – 14 SEP" or "28 AUG – 3 SEP" */
export function fmtRange(fromISO: string, toISOStr: string): string {
  const a = d(fromISO);
  const b = d(toISOStr);
  const am = MONTHS[a.getMonth()].toUpperCase();
  const bm = MONTHS[b.getMonth()].toUpperCase();
  return am === bm
    ? `${a.getDate()} – ${b.getDate()} ${bm}`
    : `${a.getDate()} ${am} – ${b.getDate()} ${bm}`;
}

export function money(n: number): string {
  return '€ ' + Math.round(n).toLocaleString('nl-NL');
}

/** Pull the leading number out of a price string like "€ 18/dag". */
export function priceNum(s: string): number {
  const m = String(s).match(/([\d.,]+)/);
  return m ? parseFloat(m[1].replace(',', '.')) : 0;
}

/** "2 uur geleden" / "gisteren" — for the activity line. */
export function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'zojuist';
  if (mins < 60) return `${mins} min geleden`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} uur geleden`;
  const days = Math.round(hrs / 24);
  return days === 1 ? 'gisteren' : `${days} dagen geleden`;
}
