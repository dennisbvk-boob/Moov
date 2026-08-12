import { useEffect, useRef, useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Field, inputStyle } from '../components/ui';
import { looksLikeEmail, sendLoginCode, verifyLoginCode } from '../lib/supabase';

/**
 * Passwordless login: we mail a six-digit code and swap it for a session.
 * The session sticks to the device, so this is a once-per-phone screen.
 */
export function AuthGate({ onSkip, hasLocalPlan }: {
  onSkip: () => void;
  hasLocalPlan: boolean;
}) {
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!cooldown) return;
    const id = window.setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (step === 'code') codeRef.current?.focus();
  }, [step]);

  const send = async () => {
    if (!looksLikeEmail(email)) {
      setError('Dat lijkt geen geldig e-mailadres.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendLoginCode(email);
      setStep('code');
      setCooldown(45);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Versturen lukte niet.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyLoginCode(email, code);
      // the store's auth listener picks the session up and swaps this screen out
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Inloggen lukte niet.');
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding:
          'calc(env(safe-area-inset-top) + 46px) 22px calc(env(safe-area-inset-bottom) + 28px)',
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
          {step === 'email' ? 'Even inloggen' : 'Check je mail'}
        </div>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
          {step === 'email'
            ? 'Geen wachtwoord nodig. We mailen je een code van zes cijfers om te bevestigen dat jij het bent.'
            : `We hebben een code gestuurd naar ${email}. Hij is tien minuten geldig.`}
        </div>
      </div>

      {step === 'email' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="E-MAILADRES">
            <input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !busy && void send()}
              placeholder="jij@voorbeeld.nl"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              style={inputStyle}
            />
          </Field>
          {error && <Err text={error} />}
          <Button
            onClick={() => void send()}
            disabled={busy || !email.trim()}
            tone={email.trim() ? 'primary' : 'muted'}
          >
            {busy ? 'Versturen…' : 'Stuur me een code'}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="CODE UIT DE MAIL">
            <input
              ref={codeRef}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && !busy && void verify()}
              placeholder="000000"
              inputMode="numeric"
              autoComplete="one-time-code"
              style={{
                ...inputStyle,
                font: `600 26px ${MONO}`,
                letterSpacing: '.3em',
                textAlign: 'center',
              }}
            />
          </Field>
          {error && <Err text={error} />}
          <Button
            onClick={() => void verify()}
            disabled={busy || code.length !== 6}
            tone={code.length === 6 ? 'primary' : 'muted'}
          >
            {busy ? 'Controleren…' : 'Inloggen'}
          </Button>
          <Button
            tone="quiet"
            disabled={busy || cooldown > 0}
            onClick={() => void send()}
          >
            {cooldown > 0 ? `Nieuwe code over ${cooldown}s` : 'Stuur een nieuwe code'}
          </Button>
          <Button
            tone="quiet"
            onClick={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            Ander e-mailadres
          </Button>
        </div>
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
        Je e-mailadres bepaalt bij welk plan je hoort. Om mee te doen met het plan van je partner
        moet je inloggen met precies het adres dat zij of hij heeft uitgenodigd — de plancode
        alleen is niet genoeg.
      </div>

      <button
        onClick={onSkip}
        style={{ font: `500 12.5px ${SANS}`, color: C.ghost, textAlign: 'center' }}
      >
        {hasLocalPlan ? 'Nu even niet — alleen op dit toestel werken' : 'Zonder account verder (alleen dit toestel)'}
      </button>
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
