import { C, SANS, SHADOW } from '../theme';
import { Eyebrow } from './ui';
import { buildIcs, downloadIcs, googleCalUrl, toCalendarTask } from '../lib/calendar';
import type { DecoratedTask } from '../lib/derive';

/**
 * One task into whichever calendar the person is actually using. Neither route
 * needs an account or a permission dialog: Google gets a pre-filled "new
 * event" page they still have to save, and everyone else gets a file their
 * own calendar knows how to open.
 */
export function AddToCalendar({ task, address }: { task: DecoratedTask; address: string }) {
  const ct = toCalendarTask(task, task.partyName);

  const download = () => {
    const slug =
      task.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'taak';
    downloadIcs(`${slug}.ics`, buildIcs([ct], address, task.title));
  };

  const style = {
    flex: 1,
    textAlign: 'center' as const,
    padding: '11px 8px',
    borderRadius: 11,
    background: C.sand,
    color: C.ink,
    font: `600 13px ${SANS}`,
    textDecoration: 'none',
    display: 'block',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>IN JE AGENDA</Eyebrow>
      <div
        style={{
          background: C.card,
          borderRadius: 14,
          padding: 12,
          boxShadow: SHADOW.card,
          display: 'flex',
          gap: 10,
        }}
      >
        <a href={googleCalUrl(ct, address)} target="_blank" rel="noreferrer" style={style}>
          Google Agenda
        </a>
        <button onClick={download} style={style}>
          Agenda-bestand
        </button>
      </div>
      {task.repeat && (
        <div style={{ font: `400 11.5px/1.45 ${SANS}`, color: C.muted }}>
          De herhaling gaat mee: in je agenda komt hij ook {task.repeatText} terug.
        </div>
      )}
    </div>
  );
}
