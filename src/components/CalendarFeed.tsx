import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Eyebrow } from './ui';
import { useStore } from '../store';
import { functionsBase, syncEnabled } from '../lib/supabase';
import { makeFeedToken } from '../lib/calendar';

/**
 * Subscribing beats exporting: the calendar re-fetches on its own, so a task
 * you move here moves there too, instead of leaving a stale copy behind in
 * someone's week view.
 */
export function CalendarFeed() {
  const store = useStore();
  const h = store.household!;
  const [copied, setCopied] = useState(false);

  if (!syncEnabled || !functionsBase) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Eyebrow>AGENDA</Eyebrow>
        <div style={{ font: `400 12px/1.5 ${SANS}`, color: C.muted }}>
          Een agenda-abonnement heeft een database nodig — de agenda van je telefoon haalt het
          plan bij de server op, niet bij dit toestel. Losse taken in je agenda zetten kan wel,
          via de knop in de taak zelf.
        </div>
      </div>
    );
  }

  const token = h.calendar_token;
  const https = token ? `${functionsBase}/calendar-feed?token=${token}` : null;
  // webcal:// is the same URL with a scheme phones recognise: tapping it opens
  // the calendar app on "wil je hierop abonneren?" instead of downloading a file.
  const webcal = https ? https.replace(/^https?:/, 'webcal:') : null;

  const copy = async () => {
    if (!https) return;
    try {
      await navigator.clipboard.writeText(https);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* no clipboard permission — the URL is on screen to copy by hand */
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>AGENDA</Eyebrow>

      {!token ? (
        <div
          style={{
            background: C.card,
            borderRadius: 16,
            padding: 16,
            boxShadow: SHADOW.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ font: `400 12.5px/1.55 ${SANS}`, color: C.muted }}>
            Zet je hele plan in Google Agenda of de Agenda-app van je telefoon. Nieuwe en
            verplaatste taken komen vanzelf mee.
          </div>
          <Button onClick={() => store.updateHousehold({ calendar_token: makeFeedToken() })}>
            Agenda-koppeling aanzetten
          </Button>
        </div>
      ) : (
        <div
          style={{
            background: C.card,
            borderRadius: 16,
            padding: 16,
            boxShadow: SHADOW.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div
            style={{
              font: `400 10.5px/1.5 ${MONO}`,
              color: C.muted,
              background: C.sand,
              borderRadius: 10,
              padding: '10px 12px',
              wordBreak: 'break-all',
              userSelect: 'all',
            }}
          >
            {https}
          </div>
          <Button onClick={() => void copy()}>{copied ? 'Gekopieerd ✓' : 'Link kopiëren'}</Button>
          <a
            href={webcal ?? '#'}
            style={{
              font: `500 12.5px ${SANS}`,
              color: C.green,
              textAlign: 'center',
              textDecoration: 'none',
            }}
          >
            Abonneren op dit toestel
          </a>
          <div style={{ font: `400 11.5px/1.5 ${SANS}`, color: C.muted }}>
            <strong>Google Agenda</strong> (op een computer): Andere agenda's → + → Via URL →
            plak de link. <strong>iPhone</strong>: Agenda → Agenda's → Agenda toevoegen →
            Abonnementsagenda.
            <br />
            Google ververst zo'n agenda maar een paar keer per dag; de Agenda-app van Apple doet
            het vaker. Wie de link heeft, kan het plan lezen.
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                if (
                  confirm(
                    'Een nieuwe agenda-link maken? De oude stopt meteen met werken — je moet dan op elk toestel opnieuw abonneren.',
                  )
                ) {
                  store.updateHousehold({ calendar_token: makeFeedToken() });
                }
              }}
              style={{ flex: 1, font: `500 12px ${SANS}`, color: C.ghost }}
            >
              Nieuwe link maken
            </button>
            <button
              onClick={() => {
                if (confirm('Agenda-koppeling uitzetten? De link stopt meteen met werken.')) {
                  store.updateHousehold({ calendar_token: null });
                }
              }}
              style={{ flex: 1, font: `500 12px ${SANS}`, color: C.clay }}
            >
              Uitzetten
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
