import { useMemo } from 'react';
import { useStore, useToday } from '../store';
import { JOBS } from '../seed';
import { byWhen, decorate, type DecoratedTask } from './derive';
import { addDays, daysBetween, fmtRange, priceNum } from './dates';
import type { Party } from '../types';

export interface Phase {
  label: string;
  range: string;
  items: DecoratedTask[];
}

/** Everything one third party is on the hook for, and what it costs. */
export interface PartyRollup {
  party: Party;
  tasks: DecoratedTask[];
  invoices: DecoratedTask[];
  openTasks: number;
  paid: number;
  open: number;
  total: number;
  next: DecoratedTask | null;
}

/** Everything the screens need, derived once from the raw task list. */
export function usePlan() {
  const store = useStore();
  const today = useToday();
  const h = store.household;

  return useMemo(() => {
    // how many files hang off each task, for the little clip badge on cards
    const fileCounts: Record<string, number> = {};
    for (const a of store.attachments) {
      fileCounts[a.task_id] = (fileCounts[a.task_id] ?? 0) + 1;
    }

    const partyNames = new Map(store.parties.map((p) => [p.id, p.name]));
    const all = store.tasks
      .map((t) => {
        const d = decorate(t, today, h);
        d.partyName = t.party_id ? (partyNames.get(t.party_id) ?? null) : null;
        return d;
      })
      .sort(byWhen);
    const tasks = all.filter((t) => t.cat !== 'betaling');
    const invoices = all.filter((t) => t.cat === 'betaling');
    const done = tasks.filter((t) => t.done).length;
    const openInvoices = invoices.filter((t) => !t.done);
    const paid = invoices.filter((t) => t.done).reduce((s, t) => s + (t.amount ?? 0), 0);
    const openSum = openInvoices.reduce((s, t) => s + (t.amount ?? 0), 0);

    const move = h?.move_date ?? today;
    const daysLeft = daysBetween(today, move);

    // Phase boundaries hang off the moving date, so they move with the plan.
    const bounds = [
      { label: 'Voorbereiden', end: addDays(move, -12) },
      { label: 'Verbouwing', end: addDays(move, -3) },
      { label: 'Verhuisweek', end: addDays(move, 2) },
      { label: 'Landen', end: '9999-12-31' },
    ];
    const phases: Phase[] = bounds.map((p, i) => {
      const from = i === 0 ? null : bounds[i - 1].end;
      const items = all.filter((t) => t.date <= p.end && (from === null || t.date > from));
      const range =
        i === 3
          ? 'NA DE VERHUIZING'
          : i === 0
            ? items.length
              ? fmtRange(items[0].date, p.end).toUpperCase()
              : 'TOT ' + fmtRange(p.end, p.end).toUpperCase()
            : fmtRange(addDays(bounds[i - 1].end, 1), p.end).toUpperCase();
      return { label: p.label, range, items };
    });

    // Job material picks + costs
    let rent = 0;
    let buy = 0;
    let pickedCount = 0;
    for (const j of JOBS) {
      j.mats.forEach((m, k) => {
        if (store.picks[`${j.id}-${k}`]) {
          pickedCount++;
          if (m.mode === 'HUUR') rent += priceNum(m.price);
          else if (m.mode === 'KOOP') buy += priceNum(m.price);
        }
      });
    }

    const jobs = JOBS.map((j) => {
      const rs = j.mats.filter((m) => m.mode === 'HUUR').reduce((s, m) => s + priceNum(m.price), 0);
      const bs = j.mats.filter((m) => m.mode === 'KOOP').reduce((s, m) => s + priceNum(m.price), 0);
      const chosen = j.mats.filter((_, k) => store.picks[`${j.id}-${k}`]).length;
      return { job: j, rentSum: rs, buySum: bs, chosen, reserved: !!store.reserved[j.id] };
    });

    // Roll every task and invoice up per party — the "wat kost deze partij"
    // overview, and the reason party_id lives on the task rather than the invoice.
    const byParty = new Map<string, DecoratedTask[]>();
    for (const t of all) {
      if (!t.party_id) continue;
      const list = byParty.get(t.party_id);
      if (list) list.push(t);
      else byParty.set(t.party_id, [t]);
    }
    const partyRollups: PartyRollup[] = store.parties
      .map((party) => {
        const own = byParty.get(party.id) ?? [];
        const inv = own.filter((t) => t.cat === 'betaling');
        const paidSum = inv.filter((t) => t.done).reduce((s2, t) => s2 + (t.amount ?? 0), 0);
        const openSum2 = inv.filter((t) => !t.done).reduce((s2, t) => s2 + (t.amount ?? 0), 0);
        return {
          party,
          tasks: own,
          invoices: inv,
          openTasks: own.filter((t) => !t.done && t.cat !== 'betaling').length,
          paid: paidSum,
          open: openSum2,
          total: paidSum + openSum2,
          next: own.find((t) => !t.done && t.date >= today) ?? null,
        };
      })
      .sort((a, b) => b.total - a.total || a.party.name.localeCompare(b.party.name, 'nl'));

    const partyById = new Map(store.parties.map((p) => [p.id, p]));
    const unassignedSpend = invoices
      .filter((t) => !t.party_id)
      .reduce((s2, t) => s2 + (t.amount ?? 0), 0);

    return {
      today,
      fileCounts,
      partyRollups,
      partyById,
      unassignedSpend,
      all,
      tasks,
      invoices,
      openInvoices,
      done,
      total: tasks.length,
      progressPct: tasks.length ? Math.round((done / tasks.length) * 100) : 0,
      paid,
      openSum,
      totalBudget: paid + openSum,
      paidPct: paid + openSum ? Math.round((paid / (paid + openSum)) * 100) : 0,
      todayItems: all.filter((t) => t.date === today),
      overdue: all.filter((t) => !t.done && t.date < today),
      daysLeft,
      phases,
      jobs,
      rent,
      buy,
      pickedCount,
    };
  }, [store.tasks, store.parties, store.picks, store.reserved, store.attachments, today, h]);
}

export type Plan = ReturnType<typeof usePlan>;
