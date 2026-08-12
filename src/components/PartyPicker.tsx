import { useMemo, useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Eyebrow, Field, Sheet, inputStyle } from './ui';
import { useStore } from '../store';
import { KINDS, PartyDot } from './PartyBits';
import type { PartyKind } from '../types';

/** The row you tap on a task to choose who carries it out. */
export function PartyRow({ partyId, onPick }: {
  partyId: string | null;
  onPick: (id: string | null) => void;
}) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const party = store.parties.find((p) => p.id === partyId) ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>UITVOERDER</Eyebrow>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 11,
          background: C.card,
          borderRadius: 14,
          padding: 13,
          boxShadow: SHADOW.card,
          width: '100%',
        }}
      >
        <PartyDot kind={party?.kind ?? null} name={party?.name} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              font: `600 14px ${SANS}`,
              letterSpacing: '-.01em',
              color: party ? C.ink : C.muted,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {party ? party.name : 'Zelf doen'}
          </div>
          <div style={{ font: `400 11.5px ${SANS}`, color: C.faint }}>
            {party ? KINDS[party.kind].label : 'Geen derde partij aan deze taak gekoppeld'}
          </div>
        </div>
        <div style={{ font: `400 18px ${SANS}`, color: '#C4BCAF' }}>›</div>
      </button>

      {open && (
        <PartyPickerSheet
          current={partyId}
          onClose={() => setOpen(false)}
          onPick={(id) => {
            onPick(id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

function PartyPickerSheet({ current, onPick, onClose }: {
  current: string | null;
  onPick: (id: string | null) => void;
  onClose: () => void;
}) {
  const store = useStore();
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<PartyKind>('aannemer');

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return store.parties
      .filter((p) => !needle || p.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name, 'nl'));
  }, [store.parties, q]);

  const create = () => {
    const id = store.addParty({ name, kind });
    if (id) onPick(id);
  };

  return (
    <Sheet open onClose={onClose} maxHeight="88%">
      <div
        style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}
      >
        <div style={{ font: `700 21px/1.2 ${SANS}`, letterSpacing: '-.025em' }}>
          Wie voert dit uit?
        </div>

        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="NAAM">
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bijv. Stukadoor Yilmaz"
                style={inputStyle}
              />
            </Field>
            <Field label="SOORT">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(KINDS) as PartyKind[]).map((k) => {
                  const on = k === kind;
                  return (
                    <button
                      key={k}
                      onClick={() => setKind(k)}
                      style={{
                        font: `600 11.5px ${SANS}`,
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: on ? KINDS[k].soft : 'transparent',
                        color: on ? KINDS[k].color : C.faint,
                        border: `1px solid ${on ? KINDS[k].color + '55' : 'rgba(26,23,20,.10)'}`,
                      }}
                    >
                      {KINDS[k].label}
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        ) : (
          <>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoeken…"
              style={inputStyle}
            />
            <div
              style={{
                background: C.card,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: SHADOW.card,
              }}
            >
              <Row
                label="Zelf doen"
                sub="Geen derde partij"
                dot={<PartyDot kind={null} />}
                selected={current === null}
                onClick={() => onPick(null)}
                first
              />
              {list.map((p) => (
                <Row
                  key={p.id}
                  label={p.name}
                  sub={KINDS[p.kind].label}
                  dot={<PartyDot kind={p.kind} name={p.name} />}
                  selected={current === p.id}
                  onClick={() => onPick(p.id)}
                />
              ))}
            </div>
            {!list.length && q.trim() && (
              <div style={{ font: `400 12.5px ${SANS}`, color: C.muted }}>
                Geen partij gevonden met die naam.
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        {adding ? (
          <>
            <Button onClick={create} disabled={!name.trim()} tone={name.trim() ? 'primary' : 'muted'}>
              Toevoegen en kiezen
            </Button>
            <Button tone="quiet" onClick={() => setAdding(false)}>
              Terug
            </Button>
          </>
        ) : (
          <>
            <Button
              tone="quiet"
              onClick={() => {
                setName(q.trim());
                setAdding(true);
              }}
            >
              + Nieuwe partij
            </Button>
            <Button tone="quiet" onClick={onClose}>
              Sluiten
            </Button>
          </>
        )}
      </div>
    </Sheet>
  );
}

function Row({ label, sub, dot, selected, onClick, first }: {
  label: string;
  sub: string;
  dot: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  first?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 14px',
        width: '100%',
        borderTop: first ? 'none' : `1px solid ${C.hairline}`,
        background: selected ? C.greenSoft : 'transparent',
      }}
    >
      {dot}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          style={{
            font: `600 14px ${SANS}`,
            letterSpacing: '-.01em',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div style={{ font: `400 11px ${MONO}`, letterSpacing: '.06em', color: C.faint }}>{sub}</div>
      </div>
      {selected && <span style={{ color: C.green, font: `600 15px ${SANS}` }}>✓</span>}
    </button>
  );
}
