import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Field, inputStyle } from '../components/ui';
import { useStore, useToday } from '../store';
import { looksLikeEmail, syncEnabled } from '../lib/supabase';
import { addDays } from '../lib/dates';

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
  const [code, setCode] = useState('');

  const signedIn = !!store.session;
  const partnerEmailOk = !signedIn || looksLikeEmail(partnerEmail);
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
              placeholder="Kastanjelaan 14"
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
              <Field label="JOUW NAAM">
                <input
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                  placeholder="Dennis"
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="JE PARTNER">
                <input
                  value={partnerName}
                  onChange={(e) => setPartnerName(e.target.value)}
                  placeholder="Nadine"
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          {signedIn && (
            <Field label="E-MAILADRES VAN JE PARTNER">
              <input
                type="email"
                value={partnerEmail}
                onChange={(e) => setPartnerEmail(e.target.value)}
                placeholder="nadine@voorbeeld.nl"
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
              ? 'Alleen dit adres kan straks meedoen — mét de plancode die je erna te zien krijgt. Je kunt het later nog wijzigen. '
              : ''}
            Je begint met een compleet voorbeeldplan van 32 taken rond die verhuisdag — schuif,
            verwijder en vul aan tot het jullie plan is.
          </div>

          {error && <Err text={error} />}

          <Button
            disabled={busy || !newPlanReady}
            tone={newPlanReady ? 'primary' : 'muted'}
            onClick={() =>
              run(() =>
                store.createHousehold({
                  address: address.trim(),
                  moveDate,
                  yourName: yourName.trim(),
                  partnerName: partnerName.trim(),
                  partnerEmail: partnerEmail.trim(),
                }),
              )
            }
          >
            {busy ? 'Bezig…' : 'Plan aanmaken'}
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
              Het plan moet met precies dit adres gedeeld zijn.
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
              placeholder="Nadine"
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
