import { useMemo, useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Avatar, Check, Eyebrow, Sheet, Tag, inputStyle } from './ui';
import { ClipBadge } from './ClipBadge';
import { useStore } from '../store';
import type { Plan } from '../lib/plan';
import type { DecoratedTask } from '../lib/derive';

const LIMIT = 40;

/**
 * Everything you own, in one field. It searches `plan.all` rather than the
 * list currently on screen: the whole point is finding the thing you can't
 * remember filing — which tab it went in is exactly what you've forgotten.
 */
export function SearchSheet({ open, plan, onClose, onOpenTask }: {
  open: boolean;
  plan: Plan;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const store = useStore();
  const [q, setQ] = useState('');

  const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);

  const hits = useMemo(() => {
    if (!terms.length) return [];
    // Every word has to land somewhere, so "verwarming aansluiten" narrows
    // instead of returning every task with "verwarming" in it.
    const match = (t: DecoratedTask) => {
      const hay = [
        t.title,
        t.note ?? '',
        t.vendor ?? '',
        t.partyName ?? '',
        t.cat_label,
        t.who_.label,
        t.help?.summary ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return terms.every((w) => hay.includes(w));
    };
    return plan.all.filter(match);
  }, [plan.all, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const openHits = hits.filter((t) => !t.done);
  const doneHits = hits.filter((t) => t.done);

  const close = () => {
    setQ('');
    onClose();
  };

  const pick = (id: string) => {
    setQ('');
    onClose();
    onOpenTask(id);
  };

  if (!open) return null;

  return (
    <Sheet open onClose={close} maxHeight="92%">
      <div style={{ flex: 'none', paddingBottom: 14 }}>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek in al je taken"
          // A search field is not a form: submitting it should close the
          // keyboard, not reload the page.
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          style={{ ...inputStyle, font: `400 16px ${SANS}` }}
        />
      </div>

      <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {!terms.length && (
          <div style={{ font: `400 13.5px/1.5 ${SANS}`, color: C.muted, padding: '4px 2px 20px' }}>
            Zoekt door titels, notities, partijen en bedragen — open én afgevinkt, op elk
            tabblad. {plan.all.length} {plan.all.length === 1 ? 'taak' : 'taken'} in dit plan.
          </div>
        )}

        {!!terms.length && !hits.length && (
          <div style={{ font: `400 13.5px/1.5 ${SANS}`, color: C.muted, padding: '4px 2px 20px' }}>
            Niets gevonden voor “{q.trim()}”.
          </div>
        )}

        {!!openHits.length && (
          <Group
            label={`OPEN · ${openHits.length}`}
            items={openHits.slice(0, LIMIT)}
            plan={plan}
            onPick={pick}
            onToggle={store.toggleTask}
          />
        )}

        {!!doneHits.length && (
          <Group
            label={`AF · ${doneHits.length}`}
            items={doneHits.slice(0, LIMIT)}
            plan={plan}
            onPick={pick}
            onToggle={store.toggleTask}
          />
        )}

        {hits.length > LIMIT && (
          <div style={{ font: `400 12px ${SANS}`, color: C.faint, padding: '0 2px 8px' }}>
            Alleen de eerste {LIMIT} per groep. Typ een woord erbij om te verfijnen.
          </div>
        )}
      </div>
    </Sheet>
  );
}

function Group({ label, items, plan, onPick, onToggle }: {
  label: string;
  items: DecoratedTask[];
  plan: Plan;
  onPick: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>{label}</Eyebrow>
      <div style={{ background: C.card, borderRadius: 16, overflow: 'hidden', boxShadow: SHADOW.card }}>
        {items.map((t, i) => (
          <div
            key={t.id}
            onClick={() => onPick(t.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 14px',
              borderTop: i === 0 ? 'none' : `1px solid ${C.hairline}`,
              cursor: 'pointer',
            }}
          >
            <Check
              on={t.done}
              color={t.color}
              size={23}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(t.id);
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  font: `600 14.5px/1.25 ${SANS}`,
                  letterSpacing: '-.015em',
                  color: t.titleColor,
                  textDecoration: t.deco,
                }}
              >
                {t.title}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                  font: `400 11.5px ${SANS}`,
                  color: t.late ? C.clay : C.faint,
                  minWidth: 0,
                }}
              >
                <Tag label={t.cat_label} color={t.color} soft={t.soft} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.late ? 'Te laat · ' : ''}
                  {t.listMeta}
                  {t.partyName ? ` · ${t.partyName}` : ''}
                </span>
                <ClipBadge count={plan.fileCounts[t.id] ?? 0} />
              </div>
            </div>
            {t.amount ? (
              <span style={{ font: `500 12px ${MONO}`, color: C.muted, flex: 'none' }}>
                {t.amountLabel}
              </span>
            ) : (
              <Avatar initial={t.who_.initial} bg={t.who_.bg} size={22} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
