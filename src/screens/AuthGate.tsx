import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Field, inputStyle } from '../components/ui';
import { login } from '../lib/supabase';

/**
 * Login with an account created by hand in Supabase (Authentication → Users).
 * There is no self-signup here — only accounts you added can get in.
 */
export function AuthGate({ onSkip, hasLocalPlan }: {
  onSkip: () => void;
  hasLocalPlan: boolean;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
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
          Even inloggen
        </div>
        <div style={{ font: `400 14px/1.5 ${SANS}`, color: C.muted }}>
          Log in met het e-mailadres en wachtwoord dat je hebt gekregen.
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label="E-MAILADRES">
          <input
            type="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && void submit()}
            placeholder="jij@voorbeeld.nl"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            autoComplete="email"
            style={inputStyle}
          />
        </Field>
        <Field label="WACHTWOORD">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !busy && void submit()}
            autoComplete="current-password"
            style={inputStyle}
          />
        </Field>
        {error && <Err text={error} />}
        <Button
          onClick={() => void submit()}
          disabled={busy || !email.trim() || !password}
          tone={email.trim() && password ? 'primary' : 'muted'}
        >
          {busy ? 'Inloggen…' : 'Inloggen'}
        </Button>
      </div>

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
        Log in met je eigen account — je ziet alleen de plannen waar je bij hoort. Meedoen met
        het plan van iemand anders? Vraag om de plancode van zes tekens en vul die in na het
        inloggen.
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
