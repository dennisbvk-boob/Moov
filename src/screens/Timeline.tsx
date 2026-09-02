import { C, MONO, SANS } from '../theme';
import { Avatar, Tag } from '../components/ui';
import type { Plan } from '../lib/plan';

export function Timeline({ plan, onOpenTask }: { plan: Plan; onOpenTask: (id: string) => void }) {
  const phases = plan.phases.filter((p) => p.items.length);

  return (
    <div style={{ padding: '18px 20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {phases.map((p) => (
        <div key={p.label} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <div style={{ font: `700 16px ${SANS}`, letterSpacing: '-.02em' }}>{p.label}</div>
            <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.1em', color: C.faint }}>
              {p.range}
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              borderLeft: '1.5px solid rgba(26,23,20,.1)',
              marginLeft: 5,
            }}
          >
            {p.items.map((t) => (
              <div
                key={t.id}
                onClick={() => onOpenTask(t.id)}
                style={{
                  position: 'relative',
                  padding: '9px 0 9px 20px',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -6,
                    top: 15,
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    background: t.dotBg,
                    border: `2px solid ${t.color}`,
                  }}
                />
                <div
                  style={{
                    width: 44,
                    flex: 'none',
                    font: `500 11px ${MONO}`,
                    color: t.date === plan.today ? C.green : C.faint,
                    paddingTop: 2,
                    letterSpacing: '-.02em',
                  }}
                >
                  {t.dayLabel}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    style={{
                      font: `600 14.5px/1.3 ${SANS}`,
                      letterSpacing: '-.015em',
                      color: t.titleColor,
                      textDecoration: t.deco,
                    }}
                  >
                    {t.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Tag label={t.cat_label} color={t.color} soft={t.soft} />
                    <span style={{ font: `400 11.5px ${SANS}`, color: C.faint }}>
                      {t.amount ? t.amountLabel + ' · ' : ''}
                      {t.metaLine}
                      {t.partyName ? ` · ${t.partyName}` : ''}
                    </span>
                  </div>
                </div>
                <Avatar initial={t.who_.initial} bg={t.who_.bg} size={22} />
              </div>
            ))}
          </div>
        </div>
      ))}

      {!phases.length && (
        <div style={{ font: `400 13.5px/1.45 ${SANS}`, color: C.muted, padding: '2px' }}>
          Nog geen taken. Voeg er een toe met de + rechtsboven, dan verschijnt de tijdlijn hier.
        </div>
      )}
    </div>
  );
}
