import { C, MODES, MONO, SANS, SHADOW } from '../theme';
import { Button, Check, Eyebrow, Sheet } from './ui';
import { money, priceNum } from '../lib/dates';
import { JOBS } from '../jobs';
import { useStore } from '../store';

export function JobSheet({ jobId, onClose }: { jobId: string | null; onClose: () => void }) {
  const store = useStore();
  const job = jobId ? JOBS.find((j) => j.id === jobId) : null;
  if (!job) return null;

  const picked = job.mats.filter((_, k) => store.picks[`${job.id}-${k}`]);
  const sum = picked.reduce((s, m) => s + priceNum(m.price), 0);
  const reserved = !!store.reserved[job.id];

  return (
    <Sheet open onClose={onClose} maxHeight="88%">
      <div
        style={{
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          paddingBottom: 14,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ font: `500 11px ${MONO}`, letterSpacing: '.08em', color: C.faint }}>
            ZELF DOEN
          </div>
          <div style={{ font: `700 24px/1.15 ${SANS}`, letterSpacing: '-.03em' }}>{job.title}</div>
          <div style={{ font: `400 13.5px/1.5 ${SANS}`, color: '#5C534A' }}>{job.note}</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>NODIG</Eyebrow>
          <div
            style={{
              background: C.card,
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: SHADOW.card,
            }}
          >
            {job.mats.map((m, k) => {
              const key = `${job.id}-${k}`;
              const on = !!store.picks[key];
              const md = MODES[m.mode];
              return (
                <div
                  key={key}
                  onClick={() => store.togglePick(key)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '13px 14px',
                    borderTop: k === 0 ? 'none' : `1px solid ${C.hairline}`,
                    cursor: 'pointer',
                  }}
                >
                  <Check on={on} color={C.green} size={22} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <div style={{ font: `600 14.5px/1.25 ${SANS}`, letterSpacing: '-.015em' }}>
                      {m.name}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span
                        style={{
                          font: `500 9.5px ${MONO}`,
                          letterSpacing: '.08em',
                          padding: '2px 6px',
                          borderRadius: 6,
                          background: md.soft,
                          color: md.color,
                        }}
                      >
                        {m.mode}
                      </span>
                      <span
                        style={{
                          font: `400 11.5px ${SANS}`,
                          color: C.faint,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {m.src}
                      </span>
                    </div>
                  </div>
                  <div
                    style={{
                      font: `600 13.5px ${SANS}`,
                      letterSpacing: '-.01em',
                      color: '#5C534A',
                      flex: 'none',
                    }}
                  >
                    {m.price}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            background: C.card,
            borderRadius: 16,
            padding: 14,
            boxShadow: SHADOW.card,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: C.stone,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 15,
            }}
          >
            📍
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ font: `600 13.5px ${SANS}`, letterSpacing: '-.01em' }}>{job.depot}</div>
            <div style={{ font: `400 11.5px/1.4 ${SANS}`, color: C.muted }}>{job.depotLine}</div>
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          paddingTop: 12,
          borderTop: `1px solid rgba(26,23,20,.08)`,
        }}
      >
        <Button
          tone={reserved ? 'done' : picked.length ? 'primary' : 'muted'}
          disabled={!picked.length || reserved}
          onClick={() => store.reserveJob(job.id)}
        >
          {reserved
            ? `Aangevraagd bij ${job.depot}`
            : picked.length
              ? `Reserveer ${picked.length} items · ${money(sum)}`
              : 'Kies eerst wat je nodig hebt'}
        </Button>
        <Button tone="quiet" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Sheet>
  );
}
