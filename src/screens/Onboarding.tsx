import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Field, inputStyle } from '../components/ui';
import { useStore, useToday } from '../store';
import { looksLikeEmail, syncEnabled } from '../lib/supabase';
import { addDays } from '../lib/dates';
import { generateAiPlan, type WizardAnswers } from '../lib/wizard';

type PlanType = 'empty' | 'ai';

export function Onboarding() {
  const store = useStore();
  const today = useToday();
  const [mode, setMode] = useState<'start' | 'new' | 'join'>('start');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [address, setAddress] = useState('');
  const [moveDate, setMoveDate] = useState(addDays(today, 60));
  const [yourName, setYourName] = useState('');
  const [partnerName, setPartnerName] = useState('');
  const [partnerEmail, setPartnerEmail] = useState('');
  const [planType, setPlanType] = useState<PlanType>('empty');
  const [code, setCode] = useState('');

  const [homeType, setHomeType] = useState('tussenwoning');
  const [rooms, setRooms] = useState('4');
  const [renovation, setRenovation] = useState(false);
  const [packing, setPacking] = useState<'zelf' | 'verhuisbedrijf'>('zelf');
  const [diy, setDiy] = useState<'zelf' | 'uitbesteden'>('zelf');
  const [kidsOrPets, setKidsOrPets] = useState(false);
  const [notes, setNotes] = useState('');

  const signedIn = !!store.session;
  // Blank is fine — the join code alone lets your partner in. Filling it in is
  // an extra lock, so it only has to be a real address when it isn't empty.
  const partnerEmailOk = !partnerEmail.trim() || looksLikeEmail(partnerEmail);
  const newPlanReady =
    !!address.trim() && !!yourName.trim() && !!partnerName.trim() && partnerEmailOk;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Er ging iets mis.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: 'calc(env(safe-area-inset-top) + 46px) 22px calc(env(safe-area-inset-bottom) + 28px)',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.14em', color: C.faint }}>
          MOOV.NL
        </div>
        <div style={{ font: `700 30px/1.12 ${SANS}`, letterSpacing: '-.03em' }}>
          Eén plan,
          <br />
          twee telefoons.
        </div>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
          Alle taken, klussen en facturen van de verhuizing op één plek — en jullie zien allebei
          meteen wat de ander heeft afgevinkt.
        </div>
      </div>

      {mode === 'start' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Button onClick={() => setMode('new')}>Nieuw plan beginnen</Button>
          <Button tone="quiet" onClick={() => setMode('join')}>
            Ik heb een code van mijn partner
          </Button>
        </div>
      )}

      {mode === 'new' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="NIEUWE ADRES">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Straatnaam en huisnummer"
              style={inputStyle}
            />
          </Field>
          <Field label="VERHUISDAG">
            <input
              type="date"
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="NAAM 1">
                <input
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  placeholder="Naam 1"
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="NAAM 2">
                <input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Naam 2"
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          {signedIn && (
            <Field label="E-MAILADRES VAN NAAM 2 (OPTIONEEL)">
              <input
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="naam@voorbeeld.nl"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                style={inputStyle}
              />
            </Field>
          )}

          <div
            style={{
              background: C.card,
              borderRadius: 14,
              padding: 14,
              boxShadow: SHADOW.card,
              font: `400 12.5px/1.5 ${SANS}`,
              color: C.muted,
            }}
          >
            {signedIn
              ? 'Iedereen met de plancode die je erna te zien krijgt kan meedoen. Vul je hierboven een e-mailadres in, dan kan alleen dat adres meedoen. Later nog te wijzigen. '
              : ''}
            {planType === 'empty' &&
              'Je begint met een leeg plan — geen voorbeeldtaken, alleen wat jullie zelf toevoegen.'}
            {planType === 'ai' &&
              'Beantwoord een paar vragen hieronder en de AI stelt een plan op maat samen.'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Radio label="Begin leeg — zelf taken toevoegen" checked={planType === 'empty'} onClick={() => setPlanType('empty')} />
            <Radio
              label="Laat de AI het plan invullen"
              checked={planType === 'ai'}
              onClick={() => setPlanType('ai')}
              disabled={!signedIn || !syncEnabled}
            />
            {!signedIn && (
              <div style={{ font: `400 11.5px/1.4 ${SANS}`, color: C.ghost, paddingLeft: 26 }}>
                Log in om de AI-wizard te gebruiken.
              </div>
            )}
          </div>

          {planType === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="TYPE WONING">
                <select
                  value={homeType}
                  onChange={(e) => setHomeType(e.target.value)}
                  style={inputStyle}
                >
                  <option value="appartement">Appartement</option>
                  <option value="tussenwoning">Tussenwoning</option>
                  <option value="hoekwoning">Hoekwoning</option>
                  <option value="vrijstaand">Vrijstaand huis</option>
                </select>
              </Field>
              <Field label="AANTAL KAMERS">
                <input value={rooms} onChange={(e) => setRooms(e.target.value)} style={inputStyle} />
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={renovation} onChange={(e) => setRenovation(e.target.checked)} />
                <span style={{ font: `400 13px ${SANS}`, color: C.muted }}>Er is verbouwing nodig</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={kidsOrPets} onChange={(e) => setKidsOrPets(e.target.checked)} />
                <span style={{ font: `400 13px ${SANS}`, color: C.muted }}>Kinderen of huisdieren</span>
              </label>
              <Field label="INPAKKEN EN VERHUIZEN">
                <select
                  value={packing}
                  onChange={(e) => setPacking(e.target.value as typeof packing)}
                  style={inputStyle}
                >
                  <option value="zelf">Doen we zelf</option>
                  <option value="verhuisbedrijf">Via een verhuisbedrijf</option>
                </select>
              </Field>
              <Field label="KLUSSEN (SCHILDEREN, VLOEREN)">
                <select value={diy} onChange={(e) => setDiy(e.target.value as typeof diy)} style={inputStyle}>
                  <option value="zelf">Doen we zelf</option>
                  <option value="uitbesteden">Besteden we uit</option>
                </select>
              </Field>
              <Field label="EXTRA OPMERKINGEN (OPTIONEEL)">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
                />
              </Field>
            </div>
          )}

          {error && <Err text={error} />}

          <Button
            disabled={busy || !newPlanReady}
            tone={newPlanReady ? 'primary' : 'muted'}
            onClick={() =>
              run(async () => {
                if (planType === 'ai') {
                  const id = crypto.randomUUID();
                  const answers: WizardAnswers = {
                    address: address.trim(),
                    moveDate,
                    homeType,
                    rooms,
                    renovation,
                    packing,
                    diy,
                    kidsOrPets,
                    notes: notes.trim(),
                  };
                  const aiTasks = await generateAiPlan(id, answers);
                  await store.createHousehold({
                    address: address.trim(),
                    moveDate,
                    yourName: yourName.trim(),
                    partnerName: partnerName.trim(),
                    partnerEmail: partnerEmail.trim(),
                    id,
                    aiTasks,
                  });
                } else {
                  await store.createHousehold({
                    address: address.trim(),
                    moveDate,
                    yourName: yourName.trim(),
                    partnerName: partnerName.trim(),
                    partnerEmail: partnerEmail.trim(),
                  });
                }
              })
            }
          >
            {busy ? (planType === 'ai' ? 'AI stelt je plan samen…' : 'Bezig…') : 'Plan aanmaken'}
          </Button>
          <Button tone="quiet" onClick={() => setMode('start')}>
            Terug
          </Button>
        </div>
      )}

      {mode === 'join' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!syncEnabled && (
            <Err text="Meedoen met een code werkt pas als de database is ingesteld. Zie de README (stap 2)." />
          )}
          {signedIn && (
            <div
              style={{
                background: C.card,
                borderRadius: 14,
                padding: 14,
                boxShadow: SHADOW.card,
                font: `400 12.5px/1.5 ${SANS}`,
                color: C.muted,
              }}
            >
              Je bent ingelogd als <strong style={{ color: C.ink }}>{store.session!.email}</strong>.
              De code hieronder is genoeg — tenzij het plan aan één specifiek adres is
              vastgezet, dan moet dat dit adres zijn.
            </div>
          )}
          <Field label="CODE">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BXK4TM"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              style={{
                ...inputStyle,
                font: `600 22px ${MONO}`,
                letterSpacing: '.22em',
                textAlign: 'center',
              }}
            />
          </Field>
          <Field label="JOUW NAAM">
            <input
              value={yourName}
              onChange={(e) => setYourName(e.target.value)}
              placeholder="Je eigen naam"
              style={inputStyle}
            />
          </Field>

          {error && <Err text={error} />}

          <Button
            disabled={busy || !signedIn || code.trim().length < 4 || !yourName.trim()}
            tone={signedIn && code.trim().length >= 4 && yourName.trim() ? 'primary' : 'muted'}
            onClick={() => run(() => store.joinHousehold(code, yourName.trim()))}
          >
            {busy ? 'Bezig…' : 'Meedoen'}
          </Button>
          <Button tone="quiet" onClick={() => setMode('start')}>
            Terug
          </Button>
        </div>
      )}

      {!syncEnabled && mode !== 'join' && (
        <div style={{ font: `400 11.5px/1.5 ${SANS}`, color: C.ghost }}>
          Nog geen database ingesteld: het plan blijft op dit toestel staan. Zie de README om
          synchroniseren tussen twee telefoons aan te zetten.
        </div>
      )}
    </div>
  );
}

function Radio({ label, checked, onClick, disabled }: {
  label: string;
  checked: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      <input type="radio" checked={checked} disabled={disabled} onChange={onClick} />
      <span style={{ font: `400 13px ${SANS}`, color: C.muted }}>{label}</span>
    </label>
  );
}

function Err({ text }: { text: string }) {
  return (
    <div
      style={{
        background: C.claySoft,
        color: '#8C3A18',
        borderRadius: 12,
        padding: '11px 13px',
        font: `400 12.5px/1.45 ${SANS}`,
      }}
    >
      {text}
    </div>
  );
}
