import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Eyebrow, Field, Sheet, inputStyle } from './ui';
import { useStore } from '../store';
import { syncEnabled } from '../lib/supabase';

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const store = useStore();
  const h = store.household;
  const [copied, setCopied] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  if (!open || !h) return null;

  const deleteHousehold = async () => {
    if (
      !confirm(
        `Dit hele plan definitief verwijderen? Alle taken, partijen en bijlagen van ${h.name_a} en ${h.name_b} gaan mee. Dit kun je niet terugdraaien.`,
      )
    )
      return;
    setDeleteError(null);
    setDeleting(true);
    try {
      await store.deleteHousehold();
      onClose();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Verwijderen lukte niet.');
    } finally {
      setDeleting(false);
    }
  };

  const rotateCode = async () => {
    if (
      !confirm(
        'Een nieuwe code maken? De huidige code werkt daarna niet meer — wie al meedoet blijft gewoon meedoen.',
      )
    )
      return;
    setRotating(true);
    try {
      await store.regenerateJoinCode();
    } catch {
      /* offline of geen rechten — de oude code blijft dan gewoon staan */
    } finally {
      setRotating(false);
    }
  };

  const share = async () => {
    // BASE_URL, not just the origin: on GitHub Pages the app lives at
    // <user>.github.io/Moov/ and a link to the bare origin lands nowhere.
    const appUrl = location.origin + import.meta.env.BASE_URL;
    const text = `Doe mee met ons verhuisplan op Moov.nl. Open ${appUrl} en vul code ${h.join_code} in.`;
    try {
      if (navigator.share) await navigator.share({ title: 'Moov.nl', text });
      else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* user cancelled the share sheet */
    }
  };

  const statusLine = !syncEnabled
    ? 'Alleen op dit toestel — geen database ingesteld'
    : store.status === 'synced'
      ? 'Gesynchroniseerd'
      : store.status === 'offline'
        ? `Offline — ${store.dirtyTasks.length + store.dirtyPicks.length} wijziging(en) wachten`
        : 'Verbinden…';

  return (
    <Sheet open onClose={onClose} maxHeight="90%">
      <div
        style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 12 }}
      >
        <div style={{ font: `700 22px/1.2 ${SANS}`, letterSpacing: '-.025em' }}>Instellingen</div>

        {syncEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Eyebrow>DEEL MET JE PARTNER</Eyebrow>
            <div
              style={{
                background: C.card,
                borderRadius: 16,
                padding: 18,
                boxShadow: SHADOW.card,
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignItems: 'center',
              }}
            >
              <div style={{ font: `700 30px ${MONO}`, letterSpacing: '.22em', paddingLeft: '.22em' }}>
                {h.join_code}
              </div>
              <div style={{ font: `400 12px/1.5 ${SANS}`, color: C.muted, textAlign: 'center' }}>
                {h.invited_email
                  ? `Deze code plus inloggen als ${h.invited_email} geeft toegang tot dit plan.`
                  : 'Wie inlogt en deze code invult, doet mee met dit plan. Deel hem dus alleen met de mensen die erbij horen.'}
              </div>
              <Button onClick={share}>{copied ? 'Gekopieerd ✓' : 'Uitnodiging delen'}</Button>
              <button
                onClick={() => void rotateCode()}
                disabled={rotating}
                style={{ font: `500 12px ${SANS}`, color: C.ghost }}
              >
                {rotating ? 'Bezig…' : 'Nieuwe code maken'}
              </button>
            </div>
            <Field label="VASTZETTEN OP ÉÉN E-MAILADRES (OPTIONEEL)">
              <input
                type="email"
                defaultValue={h.invited_email ?? ''}
                onBlur={(e) => {
                  const v = e.target.value.trim().toLowerCase();
                  if (v !== (h.invited_email ?? '')) {
                    store.updateHousehold({ invited_email: v || null });
                  }
                }}
                placeholder="naam@voorbeeld.nl"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                inputMode="email"
                style={inputStyle}
              />
            </Field>
            <div style={{ font: `400 11.5px/1.45 ${SANS}`, color: C.muted }}>
              {h.invited_email
                ? 'Alleen dit adres kan meedoen, ook met de juiste code. Leeghalen om iedereen met de code toe te laten.'
                : 'Leeg: de code alleen is genoeg. Vul een adres in als je wilt dat alleen dat account kan meedoen.'}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="ADRES">
            <input
              defaultValue={h.address}
              onBlur={(e) => store.updateHousehold({ address: e.target.value.trim() || h.address })}
              style={inputStyle}
            />
          </Field>
          <Field label="VERHUISDAG">
            <input
              type="date"
              defaultValue={h.move_date}
              onBlur={(e) => e.target.value && store.updateHousehold({ move_date: e.target.value })}
              style={inputStyle}
            />
          </Field>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <Field label="NAAM 1">
                <input
                  defaultValue={h.name_a}
                  onBlur={(e) => store.updateHousehold({ name_a: e.target.value.trim() || h.name_a })}
                  style={inputStyle}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field label="NAAM 2">
                <input
                  defaultValue={h.name_b}
                  onBlur={(e) => store.updateHousehold({ name_b: e.target.value.trim() || h.name_b })}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Eyebrow>STATUS</Eyebrow>
          <div style={{ font: `400 12.5px ${SANS}`, color: C.muted }}>{statusLine}</div>
          <div style={{ font: `400 12.5px ${SANS}`, color: C.muted }}>
            Je gebruikt dit plan als <strong>{store.meName}</strong>
            {store.session ? (
              <>
                , ingelogd als <strong>{store.session.email}</strong>
              </>
            ) : null}
            .
          </div>
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        <Button tone="quiet" onClick={onClose}>
          Klaar
        </Button>
        {store.session && (
          <Button
            tone="quiet"
            onClick={() => {
              void store.signOut();
              onClose();
            }}
          >
            Uitloggen op dit toestel
          </Button>
        )}
        <Button
          tone="quiet"
          onClick={() => {
            if (
              confirm(
                `Alle taken en partijen wissen (${store.tasks.length} taken, ${store.parties.length} partijen)? Adres en verhuisdag blijven staan. Dit kun je niet terugdraaien.`,
              )
            ) {
              store.clearAllData();
            }
          }}
        >
          <span style={{ color: C.clay }}>Alle taken en partijen wissen</span>
        </Button>
        <Button
          tone="quiet"
          onClick={() => {
            if (
              confirm(
                'Dit plan van dit toestel loskoppelen? Met de code kun je er later weer bij.',
              )
            ) {
              store.leave();
              onClose();
            }
          }}
        >
          <span style={{ color: C.clay }}>Loskoppelen van dit toestel</span>
        </Button>
        {store.session && (
          <Button tone="quiet" onClick={deleteHousehold} disabled={deleting}>
            <span style={{ color: C.clay }}>
              {deleting ? 'Bezig met verwijderen…' : 'Plan definitief verwijderen'}
            </span>
          </Button>
        )}
        {deleteError && (
          <div style={{ font: `400 11.5px/1.4 ${SANS}`, color: C.clay, textAlign: 'center' }}>
            {deleteError}
          </div>
        )}
      </div>
    </Sheet>
  );
}
