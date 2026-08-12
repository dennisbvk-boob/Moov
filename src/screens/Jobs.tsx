import { C, LEVELS, MONO, SANS, SHADOW } from '../theme';
import { Eyebrow } from '../components/ui';
import { money } from '../lib/dates';
import type { Plan } from '../lib/plan';

export function Jobs({ plan, onOpenJob }: { plan: Plan; onOpenJob: (id: string) => void }) {
  return (
    <div style={{ padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          background: C.card,
          borderRadius: 20,
          padding: 18,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          boxShadow: SHADOW.raised,
        }}
      >
        <div style={{ font: `700 20px/1.25 ${SANS}`, letterSpacing: '-.025em' }}>
          Wat doe je zelf?
        </div>
        <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.muted }}>
          Vink een klus aan en de app zoekt het gereedschap en materiaal erbij — huren waar het kan,
          kopen waar het moet.
        </div>
        <div style={{ display: 'flex', gap: 22, paddingTop: 2 }}>
          <Stat label="HUUR" value={money(plan.rent) + ' p/d'} />
          <Stat label="AANSCHAF" value={money(plan.buy)} />
          <Stat label="OP DE LIJST" value={String(plan.pickedCount)} color={C.green} />
        </div>
      </div>

      {plan.jobs.map(({ job, rentSum, buySum, chosen, reserved }) => {
        const lv = LEVELS[job.level];
        return (
          <div
            key={job.id}
            onClick={() => onOpenJob(job.id)}
            style={{
              background: C.card,
              borderRadius: 18,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              cursor: 'pointer',
              boxShadow: SHADOW.card,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ font: `600 16px/1.2 ${SANS}`, letterSpacing: '-.02em' }}>
                  {job.title}
                </div>
                <div style={{ font: `400 12px ${SANS}`, color: C.muted }}>
                  {job.where} · {job.hours}
                </div>
              </div>
              <div
                style={{
                  font: `500 10px ${MONO}`,
                  letterSpacing: '.06em',
                  padding: '4px 8px',
                  borderRadius: 7,
                  background: lv.soft,
                  color: lv.color,
                  flex: 'none',
                }}
              >
                {job.level.toUpperCase()}
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {job.mats.slice(0, 3).map((m) => (
                <span
                  key={m.name}
                  style={{
                    font: `500 11.5px ${SANS}`,
                    padding: '5px 9px',
                    borderRadius: 8,
                    background: C.stone,
                    color: '#5C534A',
                  }}
                >
                  {m.name}
                </span>
              ))}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: `1px solid ${C.hairline}`,
                paddingTop: 11,
              }}
            >
              <div style={{ font: `400 12px ${SANS}`, color: C.muted }}>
                {money(rentSum)} huur · {money(buySum)} aanschaf
              </div>
              <div style={{ font: `600 12.5px ${SANS}`, color: C.green }}>
                {reserved ? 'Aangevraagd ✓' : chosen ? `${chosen} op de lijst ›` : 'Materiaal ›'}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Eyebrow style={{ letterSpacing: '.12em' }}>{label}</Eyebrow>
      <div style={{ font: `700 19px ${SANS}`, letterSpacing: '-.02em', color }}>{value}</div>
    </div>
  );
}
