import { useState } from 'react';
import { C, MODES, MONO, SANS, SHADOW } from '../theme';
import { Eyebrow } from './ui';
import { useStore, useToday } from '../store';
import { addDays } from '../lib/dates';
import { lookUpHelp } from '../lib/taskHelp';
import type { DecoratedTask } from '../lib/derive';

/**
 * "Hoe pak ik dit aan?" — the looked-up procedure for one task. The answer is
 * written back onto the task rather than held here, so it survives closing the
 * sheet, reaches the other phone, and is paid for once instead of per open.
 */
export function TaskHelpPanel({ task }: { task: DecoratedTask }) {
  const store = useStore();
  const today = useToday();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedMaterials, setAddedMaterials] = useState(false);

  const help = task.help;

  // Without a login there is nobody to bill the lookup to, so the button would
  // only ever produce an error. An answer someone else already looked up still
  // shows — it lives on the task by then.
  if (!help && !store.session) return null;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await lookUpHelp(task);
      store.patchTask(task.id, { help: result });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Het opzoeken lukte niet.');
    } finally {
      setBusy(false);
    }
  };

  const addMaterials = () => {
    if (!help?.materials.length) return;
    const lines = help.materials.map(
      (m) => `- ${m.name} (${m.mode.toLowerCase()})${m.why ? ` — ${m.why}` : ''}`,
    );
    store.addTask({
      title: `Materiaal voor: ${task.title}`,
      cat: 'klus',
      who: task.who,
      party_id: task.party_id,
      // The day before the job, because a shopping list you tick off on the
      // morning you need the things is one you're already too late for — but
      // never in the past, which would be born overdue.
      date: maxDate(addDays(task.date, -1), today),
      note: lines.join('\n'),
    });
    setAddedMaterials(true);
  };

  if (!help) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Eyebrow>UITVOEREN</Eyebrow>
        <button
          onClick={() => void run()}
          disabled={busy}
          style={{
            background: C.card,
            borderRadius: 14,
            padding: 14,
            boxShadow: SHADOW.card,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textAlign: 'left',
            width: '100%',
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: C.greenSoft,
              color: C.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            {busy ? (
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  border: `2px solid ${C.line}`,
                  borderTopColor: C.green,
                  animation: 'spin .8s linear infinite',
                  display: 'block',
                }}
              />
            ) : (
              <svg aria-hidden width="15" height="15" viewBox="0 0 16 16" fill="none">
                <circle cx="7" cy="7" r="4.6" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.4 10.4 14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ font: `600 14px ${SANS}`, letterSpacing: '-.01em' }}>
              {busy ? 'Bezig met opzoeken…' : 'Hoe pak ik dit aan?'}
            </div>
            <div style={{ font: `400 11.5px/1.4 ${SANS}`, color: C.muted }}>
              {busy
                ? 'Even geduld, dit duurt een paar tellen.'
                : 'Zoekt de stappen, het materiaal en de valkuilen op, met bronnen erbij.'}
            </div>
          </div>
        </button>
        {error && (
          <div style={{ font: `400 11.5px/1.45 ${SANS}`, color: C.clay }}>{error}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Eyebrow>UITVOEREN</Eyebrow>
        {help.minutes && (
          <span style={{ font: `400 11px ${MONO}`, color: C.faint }}>± {formatMinutes(help.minutes)}</span>
        )}
      </div>

      <div
        style={{
          background: C.card,
          borderRadius: 16,
          padding: 16,
          boxShadow: SHADOW.card,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {help.summary && (
          <div style={{ font: `400 13.5px/1.5 ${SANS}`, color: '#5C534A' }}>{help.summary}</div>
        )}

        {!!help.steps.length && (
          <ol style={{ display: 'flex', flexDirection: 'column', gap: 10, margin: 0, padding: 0, listStyle: 'none' }}>
            {help.steps.map((s, i) => (
              <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: C.greenSoft,
                    color: C.green,
                    font: `700 10px ${MONO}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: 'none',
                    marginTop: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ font: `400 13.5px/1.5 ${SANS}`, color: C.ink }}>{s}</span>
              </li>
            ))}
          </ol>
        )}

        {!!help.materials.length && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Eyebrow>NODIG</Eyebrow>
            {help.materials.map((m, i) => {
              const tone = MODES[m.mode] ?? MODES['KOOP'];
              return (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                  <span
                    style={{
                      font: `500 9.5px ${MONO}`,
                      letterSpacing: '.06em',
                      padding: '2px 6px',
                      borderRadius: 6,
                      background: tone.soft,
                      color: tone.color,
                      flex: 'none',
                    }}
                  >
                    {m.mode}
                  </span>
                  <span style={{ font: `400 13px/1.45 ${SANS}` }}>
                    {m.name}
                    {m.why && <span style={{ color: C.muted }}> — {m.why}</span>}
                  </span>
                </div>
              );
            })}
            <button
              onClick={addMaterials}
              disabled={addedMaterials}
              style={{
                alignSelf: 'flex-start',
                font: `600 12px ${SANS}`,
                color: addedMaterials ? C.ghost : C.green,
                paddingTop: 2,
              }}
            >
              {addedMaterials ? 'Op de lijst gezet ✓' : 'Zet dit als taak op de lijst'}
            </button>
          </div>
        )}

        {!!help.warnings.length && (
          <div
            style={{
              background: C.claySoft,
              borderRadius: 12,
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <Eyebrow color={C.clay}>LET OP</Eyebrow>
            {help.warnings.map((w, i) => (
              <div key={i} style={{ font: `400 12.5px/1.5 ${SANS}`, color: '#7C3F20' }}>
                {w}
              </div>
            ))}
          </div>
        )}

        {!!help.sources.length && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Eyebrow>BRONNEN</Eyebrow>
            {help.sources.map((s, i) => (
              <a
                key={i}
                href={s.url}
                target="_blank"
                rel="noreferrer noopener"
                style={{
                  font: `400 12px/1.4 ${SANS}`,
                  color: C.green,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.title}
              </a>
            ))}
          </div>
        )}
      </div>

      {store.session && (
        <button
          onClick={() => void run()}
          disabled={busy}
          style={{ alignSelf: 'flex-start', font: `500 12px ${SANS}`, color: C.ghost }}
        >
          {busy ? 'Bezig met opzoeken…' : 'Opnieuw opzoeken'}
        </button>
      )}
      {error && <div style={{ font: `400 11.5px/1.45 ${SANS}`, color: C.clay }}>{error}</div>}
    </div>
  );
}

const maxDate = (a: string, b: string) => (a > b ? a : b);

function formatMinutes(m: number): string {
  if (m < 90) return `${m} min`;
  const hours = m / 60;
  return `${Number.isInteger(hours) ? hours : hours.toFixed(1).replace('.', ',')} uur`;
}
