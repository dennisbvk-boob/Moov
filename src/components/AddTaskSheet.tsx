import { useState } from 'react';
import { CATS, SANS } from '../theme';
import { Button, Field, Segmented, Sheet, inputStyle } from './ui';
import { useStore, useToday } from '../store';
import { PartyRow } from './PartyPicker';
import type { CatKey } from '../theme';
import type { Who } from '../types';

export function AddTaskSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const today = useToday();
  const h = store.household!;

  const [title, setTitle] = useState('');
  const [cat, setCat] = useState<CatKey>('admin');
  const [who, setWho] = useState<Who>(store.slot);
  const [partyId, setPartyId] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState('');
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');

  if (!open) return null;

  const reset = () => {
    setTitle('');
    setCat('admin');
    setWho(store.slot);
    setPartyId(null);
    setDate(today);
    setTime('');
    setNote('');
    setAmount('');
    setVendor('');
  };

  const submit = () => {
    if (!title.trim()) return;
    const parsed = amount.trim() ? Number(amount.replace(',', '.')) : null;
    store.addTask({
      title: title.trim(),
      cat,
      who,
      party_id: partyId,
      date,
      time: time || null,
      note: note || null,
      amount: cat === 'betaling' && Number.isFinite(parsed as number) ? parsed : null,
      vendor: cat === 'betaling' ? vendor : null,
    });
    reset();
    onClose();
  };

  const cats = Object.keys(CATS) as CatKey[];

  return (
    <Sheet open onClose={onClose} maxHeight="92%">
      <div
        style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 12 }}
      >
        <div style={{ font: `700 22px/1.2 ${SANS}`, letterSpacing: '-.025em' }}>Nieuwe taak</div>

        <Field label="WAT MOET ER GEBEUREN">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Bijv. Meterstanden doorgeven"
            style={inputStyle}
          />
        </Field>

        <Field label="SOORT">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {cats.map((k) => {
              const on = k === cat;
              return (
                <button
                  key={k}
                  onClick={() => setCat(k)}
                  style={{
                    font: `600 11.5px ${SANS}`,
                    letterSpacing: '.02em',
                    padding: '8px 12px',
                    borderRadius: 10,
                    background: on ? CATS[k].soft : 'transparent',
                    color: on ? CATS[k].color : '#8C8478',
                    border: `1px solid ${on ? CATS[k].color + '55' : 'rgba(26,23,20,.10)'}`,
                  }}
                >
                  {CATS[k].label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="WIE DOET DIT">
          <Segmented<Who>
            value={who}
            onChange={setWho}
            options={[
              { value: 'a', label: h.name_a },
              { value: 'b', label: h.name_b },
              { value: 'samen', label: 'Samen' },
            ]}
          />
        </Field>

        <PartyRow partyId={partyId} onPick={setPartyId} />

        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="DATUM">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>
          <div style={{ width: 118 }}>
            <Field label="TIJD">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
            </Field>
          </div>
        </div>

        {cat === 'betaling' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="AAN WIE">
                <input
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  placeholder="Bijv. Bouwbedrijf Bakker"
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ width: 118 }}>
              <Field label="BEDRAG (€)">
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        )}

        <Field label="NOTITIE">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Alles wat je later wilt terugvinden"
            style={{ ...inputStyle, resize: 'none' }}
          />
        </Field>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        <Button onClick={submit} tone={title.trim() ? 'primary' : 'muted'} disabled={!title.trim()}>
          Toevoegen
        </Button>
        <Button tone="quiet" onClick={onClose}>
          Annuleren
        </Button>
      </div>
    </Sheet>
  );
}
