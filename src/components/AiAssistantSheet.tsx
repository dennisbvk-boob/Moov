import { useState } from 'react';
import { C, CATS, SANS } from '../theme';
import { Button, Field, Sheet, inputStyle } from './ui';
import { useStore } from '../store';
import { fmtShort } from '../lib/dates';
import { runAiUpdate, type PlanEdits } from '../lib/assistant';

type Phase = 'ask' | 'busy' | 'review';

export function AiAssistantSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const h = store.household;
  const [instruction, setInstruction] = useState('');
  const [phase, setPhase] = useState<Phase>('ask');
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<PlanEdits | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());

  if (!open || !h) return null;

  const reset = () => {
    setInstruction('');
    setPhase('ask');
    setError(null);
    setEdits(null);
    setIncluded(new Set());
  };

  const close = () => {
    reset();
    onClose();
  };

  const ask = async () => {
    if (!instruction.trim()) return;
    setError(null);
    setPhase('busy');
    try {
      const result = await runAiUpdate(h, store.tasks, instruction.trim());
      const keys = new Set<string>();
      for (const a of result.adds) keys.add(`add:${a.id}`);
      for (const u of result.updates) keys.add(`update:${u.id}`);
      for (const id of result.completeIds) keys.add(`complete:${id}`);
      setEdits(result);
      setIncluded(keys);
      setPhase('review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.');
      setPhase('ask');
    }
  };

  const toggle = (key: string) => {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = () => {
    if (!edits) return;
    for (const a of edits.adds) {
      if (!included.has(`add:${a.id}`)) continue;
      store.addTask({
        title: a.title,
        cat: a.cat,
        who: a.who,
        date: a.date,
        time: a.time,
        note: a.note,
        amount: a.amount,
        vendor: a.vendor,
      });
    }
    for (const u of edits.updates) {
      if (!included.has(`update:${u.id}`)) continue;
      const { who, ...rest } = u.patch;
      if (Object.keys(rest).length) store.patchTask(u.id, rest);
      // handing a task over is news for the other person, however it was asked for
      if (who) store.reassignTask(u.id, who);
    }
    for (const id of edits.completeIds) {
      if (!included.has(`complete:${id}`)) continue;
      store.patchTask(id, { done: true, done_by: store.meName });
    }
    close();
  };

  const total = edits ? edits.adds.length + edits.updates.length + edits.completeIds.length : 0;
  const checkedCount = included.size;

  return (
    <Sheet open onClose={close} maxHeight="92%">
      <div style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 12 }}>
        <div style={{ font: `700 22px/1.2 ${SANS}`, letterSpacing: '-.025em' }}>AI-assistent</div>

        {(phase === 'ask' || phase === 'busy') && (
          <>
            <div style={{ font: `400 12.5px/1.5 ${SANS}`, color: C.muted }}>
              Beschrijf wat je wilt: taken toevoegen, iets aanpassen, of taken laten afvinken.
            </div>
            <Field label="JOUW VERZOEK">
              <textarea
                autoFocus
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                rows={4}
                placeholder="Bijv. 'voeg een taak toe om de zorgverzekering over te schrijven' of 'vink alle afspraken van deze week af'"
                style={{ ...inputStyle, resize: 'none' }}
                disabled={phase === 'busy'}
              />
            </Field>
            {error && <div style={{ font: `400 12.5px/1.4 ${SANS}`, color: C.clay }}>{error}</div>}
          </>
        )}

        {phase === 'review' && edits && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {total === 0 && (
              <div style={{ font: `400 12.5px/1.5 ${SANS}`, color: C.muted }}>
                De AI stelt geen wijzigingen voor. Probeer je verzoek anders te formuleren.
              </div>
            )}
            {edits.adds.length > 0 && (
              <EditGroup title="NIEUWE TAKEN">
                {edits.adds.map((a) => (
                  <EditRow
                    key={a.id}
                    checked={included.has(`add:${a.id}`)}
                    onToggle={() => toggle(`add:${a.id}`)}
                    cat={a.cat}
                    title={a.title}
                    detail={fmtShort(a.date)}
                  />
                ))}
              </EditGroup>
            )}
            {edits.updates.length > 0 && (
              <EditGroup title="AANPASSINGEN">
                {edits.updates.map((u) => (
                  <EditRow
                    key={u.id}
                    checked={included.has(`update:${u.id}`)}
                    onToggle={() => toggle(`update:${u.id}`)}
                    cat={u.before.cat}
                    title={u.patch.title ?? u.before.title}
                    detail={describePatch(u.patch)}
                  />
                ))}
              </EditGroup>
            )}
            {edits.completeIds.length > 0 && (
              <EditGroup title="AFVINKEN">
                {edits.completeIds.map((id) => {
                  const t = store.tasks.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <EditRow
                      key={id}
                      checked={included.has(`complete:${id}`)}
                      onToggle={() => toggle(`complete:${id}`)}
                      cat={t.cat}
                      title={t.title}
                      detail="wordt afgevinkt"
                    />
                  );
                })}
              </EditGroup>
            )}
          </div>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        {phase !== 'review' && (
          <>
            <Button
              onClick={ask}
              tone={instruction.trim() ? 'primary' : 'muted'}
              disabled={!instruction.trim() || phase === 'busy'}
            >
              {phase === 'busy' ? 'AI denkt na…' : 'Vraag AI'}
            </Button>
            <Button tone="quiet" onClick={close}>
              Annuleren
            </Button>
          </>
        )}
        {phase === 'review' && (
          <>
            <Button onClick={apply} tone={checkedCount ? 'primary' : 'muted'} disabled={!checkedCount}>
              Toepassen{checkedCount ? ` (${checkedCount})` : ''}
            </Button>
            <Button tone="quiet" onClick={reset}>
              Opnieuw
            </Button>
            <Button tone="quiet" onClick={close}>
              Sluiten
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function describePatch(patch: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof patch.date === 'string') parts.push(fmtShort(patch.date));
  if (typeof patch.who === 'string') parts.push(patch.who === 'samen' ? 'samen' : patch.who);
  if (typeof patch.note === 'string') parts.push('notitie bijgewerkt');
  if (typeof patch.amount === 'number') parts.push(`€ ${patch.amount}`);
  return parts.length ? parts.join(' · ') : 'bijgewerkt';
}

function EditGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          font: `600 10.5px ${SANS}`,
          letterSpacing: '.1em',
          color: C.faint,
        }}
      >
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>{children}</div>
    </div>
  );
}

function EditRow({
  checked,
  onToggle,
  cat,
  title,
  detail,
}: {
  checked: boolean;
  onToggle: () => void;
  cat: keyof typeof CATS;
  title: string;
  detail: string;
}) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 12,
        background: checked ? C.card : 'transparent',
        border: `1px solid ${checked ? 'rgba(26,23,20,.10)' : 'rgba(26,23,20,.06)'}`,
        opacity: checked ? 1 : 0.5,
        textAlign: 'left',
      }}
    >
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ flex: 'none' }} />
      <span
        style={{
          flex: 'none',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: CATS[cat].color,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            font: `600 13.5px ${SANS}`,
            color: C.ink,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </div>
        <div style={{ font: `400 11.5px ${SANS}`, color: C.muted }}>{detail}</div>
      </div>
    </button>
  );
}
