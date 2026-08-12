import { useState } from 'react';
import { C, CATS, MONO, SANS, SHADOW } from '../theme';
import { Avatar, Check, Segmented } from '../components/ui';
import { ClipBadge } from '../components/ClipBadge';
import { useStore } from '../store';
import type { Plan } from '../lib/plan';
import type { Who } from '../types';

type Filter = 'alles' | Who;

export function ListScreen({ plan, onOpenTask }: { plan: Plan; onOpenTask: (id: string) => void }) {
  const store = useStore();
  const h = store.household!;
  const [filter, setFilter] = useState<Filter>('alles');
  const [showDone, setShowDone] = useState(true);

  let items = plan.tasks;
  if (filter !== 'alles') items = items.filter((t) => t.who === filter);
  if (!showDone) items = items.filter((t) => !t.done);

  const order = ['afspraak', 'klus', 'admin', 'inpakken'] as const;
  const groups = order
    .map((c) => ({
      key: c,
      label: CATS[c].label,
      color: CATS[c].color,
      items: items.filter((t) => t.cat === c),
    }))
    .filter((g) => g.items.length);

  return (
    <div style={{ padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Segmented<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'alles', label: 'Alles' },
          { value: 'a', label: h.name_a },
          { value: 'b', label: h.name_b },
          { value: 'samen', label: 'Samen' },
        ]}
      />

      <button
        onClick={() => setShowDone((v) => !v)}
        style={{ font: `500 12px ${SANS}`, color: C.muted, alignSelf: 'flex-start', paddingLeft: 2 }}
      >
        {showDone ? 'Verberg afgevinkte taken' : 'Toon ook afgevinkte taken'}
      </button>

      {groups.map((g) => (
        <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.14em', color: g.color }}>
              {g.label}
            </div>
            <div style={{ font: `400 11px ${MONO}`, color: '#B5AEA2' }}>
              {g.items.filter((t) => t.done).length}/{g.items.length}
            </div>
          </div>
          <div
            style={{
              background: C.card,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: SHADOW.card,
            }}
          >
            {g.items.map((t, i) => (
              <div
                key={t.id}
                onClick={() => onOpenTask(t.id)}
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
                    store.toggleTask(t.id);
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.late ? 'Te laat · ' : ''}
                      {t.listMeta}
                      {t.partyName ? ` · ${t.partyName}` : ''}
                    </span>
                    <ClipBadge count={plan.fileCounts[t.id] ?? 0} />
                  </div>
                </div>
                <Avatar initial={t.who_.initial} bg={t.who_.bg} size={22} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {!groups.length && (
        <div style={{ font: `400 13.5px/1.45 ${SANS}`, color: C.muted, padding: '20px 2px' }}>
          Niets te zien met deze filter.
        </div>
      )}
    </div>
  );
}
