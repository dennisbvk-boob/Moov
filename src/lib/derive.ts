import { C, CATS } from '../theme';
import type { Household, Task, Who } from '../types';
import { daysBetween, fmtShort, money } from './dates';

export interface Person {
  label: string;
  initial: string;
  bg: string;
}

export function person(who: Who, h: Household | null): Person {
  const a = h?.name_a || 'Jij';
  const b = h?.name_b || 'Partner';
  if (who === 'a') return { label: a, initial: a[0]?.toUpperCase() ?? '?', bg: C.green };
  if (who === 'b') return { label: b, initial: b[0]?.toUpperCase() ?? '?', bg: C.brown };
  return { label: 'Samen', initial: '2', bg: C.muted };
}

export interface DecoratedTask extends Task {
  /** Name of the third party carrying this out, filled in by usePlan. */
  partyName: string | null;
  cat_label: string;
  color: string;
  soft: string;
  who_: Person;
  late: boolean;
  titleColor: string;
  deco: 'line-through' | 'none';
  dotBg: string;
  dayLabel: string;
  dateLabel: string;
  metaLine: string;
  listMeta: string;
  amountLabel: string;
  vendorLabel: string;
  dueColor: string;
  dueLine: string;
  statusLabel: string;
  statusColor: string;
  cardBorder: string;
}

export function decorate(t: Task, today: string, h: Household | null): DecoratedTask {
  const c = CATS[t.cat];
  const w = person(t.who, h);
  const late = !t.done && daysBetween(today, t.date) < 0;
  const until = daysBetween(today, t.date);

  return {
    ...t,
    partyName: null,
    cat_label: c.label,
    color: c.color,
    soft: c.soft,
    who_: w,
    late,
    titleColor: t.done ? C.ghost : C.ink,
    deco: t.done ? 'line-through' : 'none',
    dotBg: t.done ? c.color : C.bg,
    // glue weekday to day number so the timeline gutter breaks as "wo 12 / aug"
    dayLabel: fmtShort(t.date).replace(' ', '\u00a0'),
    dateLabel: fmtShort(t.date),
    metaLine: (t.time ? t.time + ' · ' : '') + w.label,
    listMeta: fmtShort(t.date) + (t.time ? ' · ' + t.time : '') + ' · ' + w.label,
    amountLabel: t.amount ? money(t.amount) : '',
    vendorLabel: t.vendor || t.title,
    dueColor: late ? C.clay : C.faint,
    dueLine: t.done
      ? 'Betaald op ' + fmtShort(t.date)
      : late
        ? 'Te laat · verviel ' + fmtShort(t.date)
        : until === 0
          ? 'Vervalt vandaag'
          : `Vervalt ${fmtShort(t.date)} · over ${until} ${until === 1 ? 'dag' : 'dagen'}`,
    statusLabel: t.done ? 'BETAALD' : late ? 'TE LAAT' : 'OPEN',
    statusColor: t.done ? C.green : late ? C.clay : '#B5AEA2',
    cardBorder: late ? 'rgba(180,85,43,.32)' : 'rgba(26,23,20,.06)',
  };
}

/** Sort by date, then time, then title — stable across both phones. */
export function byWhen(a: Task, b: Task): number {
  const ka = a.date + (a.time ?? '99:99') + a.title;
  const kb = b.date + (b.time ?? '99:99') + b.title;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}
