import { useEffect, useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Eyebrow, Field, Segmented, Sheet, inputStyle } from './ui';
import { useStore } from '../store';
import { Attachments } from './Attachments';
import { PartyRow } from './PartyPicker';
import { JOBS } from '../jobs';
import type { DecoratedTask } from '../lib/derive';
import type { Who } from '../types';

export function TaskSheet({ task, onClose, onOpenJob }: {
  task: DecoratedTask | null;
  onClose: () => void;
  onOpenJob: (id: string) => void;
}) {
  const store = useStore();
  const h = store.household!;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: '', date: '', time: '', note: '', amount: '' });

  useEffect(() => {
    if (task) {
      setEditing(false);
      setDraft({
        title: task.title,
        date: task.date,
        time: task.time ?? '',
        note: task.note ?? '',
        amount: task.amount != null ? String(task.amount) : '',
      });
    }
  }, [task?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!task) return null;
  const job = task.job_id ? JOBS.find((j) => j.id === task.job_id) : null;

  const saveEdit = () => {
    const amount = draft.amount.trim() ? Number(draft.amount.replace(',', '.')) : null;
    store.patchTask(task.id, {
      title: draft.title.trim() || task.title,
      date: draft.date || task.date,
      time: draft.time.trim() || null,
      note: draft.note.trim() || null,
      amount: Number.isFinite(amount as number) ? amount : task.amount,
    });
    setEditing(false);
  };

  return (
    <Sheet open onClose={onClose} maxHeight="88%">
      <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span
              style={{
                font: `500 10px ${MONO}`,
                letterSpacing: '.08em',
                padding: '3px 7px',
                borderRadius: 6,
                background: task.soft,
                color: task.color,
              }}
            >
              {task.cat_label}
            </span>
            <span style={{ font: `500 11px ${MONO}`, color: C.faint, letterSpacing: '.04em' }}>
              {task.dateLabel}
              {task.time ? ' · ' + task.time : ''}
              {task.amount ? ' · ' + task.amountLabel : ''}
            </span>
          </div>

          {editing ? (
            <input
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              style={{ ...inputStyle, font: `700 19px ${SANS}` }}
            />
          ) : (
            <div style={{ font: `700 23px/1.2 ${SANS}`, letterSpacing: '-.025em' }}>{task.title}</div>
          )}

          {editing ? (
            <textarea
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
              rows={3}
              placeholder="Notitie"
              style={{ ...inputStyle, resize: 'none' }}
            />
          ) : (
            task.note && (
              <div style={{ font: `400 14px/1.5 ${SANS}`, color: '#5C534A' }}>{task.note}</div>
            )
          )}
        </div>

        {editing && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="DATUM">
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => setDraft({ ...draft, date: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={{ width: 118 }}>
                <Field label="TIJD">
                  <input
                    type="time"
                    value={draft.time}
                    onChange={(e) => setDraft({ ...draft, time: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
            {task.cat === 'betaling' && (
              <Field label="BEDRAG (€)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={draft.amount}
                  onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            )}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Eyebrow>WIE DOET DIT</Eyebrow>
          <Segmented<Who>
            value={task.who}
            onChange={(w) => store.patchTask(task.id, { who: w })}
            options={[
              { value: 'a', label: h.name_a },
              { value: 'b', label: h.name_b },
              { value: 'samen', label: 'Samen' },
            ]}
          />
        </div>

        <PartyRow
          partyId={task.party_id}
          onPick={(id) => store.patchTask(task.id, { party_id: id })}
          payment={task.cat === 'betaling'}
        />

        <Attachments taskId={task.id} />

        {job && (
          <div
            onClick={() => onOpenJob(job.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: C.card,
              borderRadius: 14,
              padding: 14,
              cursor: 'pointer',
              boxShadow: SHADOW.card,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: C.greenSoft,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: `2px solid ${C.green}`,
                  borderRadius: 3,
                  transform: 'rotate(45deg)',
                  display: 'block',
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: `600 14px ${SANS}`, letterSpacing: '-.01em' }}>
                Materiaal voor deze klus
              </div>
              <div style={{ font: `400 11.5px ${SANS}`, color: C.muted }}>
                {job.mats.length} items · huren bij {job.depot}
              </div>
            </div>
            <div style={{ font: `400 18px ${SANS}`, color: '#C4BCAF' }}>›</div>
          </div>
        )}

        {task.done && task.done_by && (
          <div style={{ font: `400 12px ${SANS}`, color: C.faint }}>
            Afgevinkt door {task.done_by}.
          </div>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        {editing ? (
          <>
            <Button onClick={saveEdit}>Opslaan</Button>
            <Button tone="quiet" onClick={() => setEditing(false)}>
              Annuleren
            </Button>
          </>
        ) : (
          <>
            <Button
              tone={task.done ? 'muted' : 'primary'}
              onClick={() => store.toggleTask(task.id)}
            >
              {task.done
                ? task.cat === 'betaling'
                  ? 'Toch nog niet betaald'
                  : 'Toch nog niet af'
                : task.cat === 'betaling'
                  ? 'Markeer als betaald'
                  : 'Markeer als af'}
            </Button>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button tone="quiet" onClick={() => setEditing(true)}>
                Bewerken
              </Button>
              <Button
                tone="quiet"
                onClick={() => {
                  if (confirm(`“${task.title}” verwijderen?`)) {
                    store.deleteTask(task.id);
                    onClose();
                  }
                }}
              >
                <span style={{ color: C.clay }}>Verwijderen</span>
              </Button>
            </div>
            <Button tone="quiet" onClick={onClose}>
              Sluiten
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}
