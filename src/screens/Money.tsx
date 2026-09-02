import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Check, Eyebrow, Segmented } from '../components/ui';
import { KindTag, PartyDot } from '../components/PartyBits';
import { PartySheet } from '../components/PartySheet';
import { money } from '../lib/dates';
import { useStore } from '../store';
import type { Plan } from '../lib/plan';

type View = 'facturen' | 'partijen';

export function Money({ plan, onOpenTask }: { plan: Plan; onOpenTask: (id: string) => void }) {
  const [view, setView] = useState<View>('facturen');
  const [openParty, setOpenParty] = useState<string | null>(null);
  const roll = openParty ? plan.partyRollups.find((r) => r.party.id === openParty) : null;

  return (
    <div style={{ padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div
        style={{
          background: C.card,
          borderRadius: 20,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: SHADOW.raised,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <Eyebrow>TOTAAL BEGROOT</Eyebrow>
          <div style={{ font: `700 34px/1 ${SANS}`, letterSpacing: '-.035em' }}>
            {money(plan.totalBudget)}
          </div>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 99, overflow: 'hidden', background: C.line }}>
          <div style={{ background: C.green, width: `${plan.paidPct}%`, transition: 'width .4s ease' }} />
        </div>
        <div style={{ display: 'flex', gap: 22 }}>
          <Legend dot={C.green} label="Betaald" value={money(plan.paid)} />
          <Legend dot="#D8D0C2" label="Nog te betalen" value={money(plan.openSum)} />
        </div>
      </div>

      <Segmented<View>
        value={view}
        onChange={setView}
        options={[
          { value: 'facturen', label: 'Facturen' },
          { value: 'partijen', label: 'Partijen' },
        ]}
      />

      {view === 'partijen' ? (
        <PartiesList plan={plan} onOpen={setOpenParty} />
      ) : (
        <InvoiceList plan={plan} onOpenTask={onOpenTask} />
      )}

      {roll && (
        <PartySheet
          roll={roll}
          onClose={() => setOpenParty(null)}
          onOpenTask={(id) => {
            setOpenParty(null);
            onOpenTask(id);
          }}
        />
      )}
    </div>
  );
}

function InvoiceList({ plan, onOpenTask }: { plan: Plan; onOpenTask: (id: string) => void }) {
  const store = useStore();
  return (
    <>
      <Eyebrow style={{ paddingLeft: 2 }}>FACTUREN</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {plan.invoices.map((t) => (
          <div
            key={t.id}
            onClick={() => onOpenTask(t.id)}
            style={{
              background: C.card,
              border: `1px solid ${t.cardBorder}`,
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: SHADOW.card,
            }}
          >
            <Check
              on={t.done}
              color={t.color}
              onClick={(e) => {
                e.stopPropagation();
                store.toggleTask(t.id);
              }}
            />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div
                style={{
                  font: `600 15px/1.2 ${SANS}`,
                  letterSpacing: '-.015em',
                  color: t.titleColor,
                }}
              >
                {t.vendorLabel}
              </div>
              <div style={{ font: `400 11.5px ${SANS}`, color: t.dueColor }}>{t.dueLine}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <div
                style={{
                  font: `700 16px ${SANS}`,
                  letterSpacing: '-.025em',
                  color: t.titleColor,
                }}
              >
                {t.amountLabel}
              </div>
              <div style={{ font: `500 9.5px ${MONO}`, letterSpacing: '.08em', color: t.statusColor }}>
                {t.statusLabel}
              </div>
            </div>
          </div>
        ))}
        {!plan.invoices.length && (
          <div style={{ font: `400 13.5px/1.45 ${SANS}`, color: C.muted, padding: '8px 2px' }}>
            Nog geen facturen. Voeg er een toe met de + rechtsboven en kies “Betaling”.
          </div>
        )}
      </div>
    </>
  );
}

function PartiesList({ plan, onOpen }: { plan: Plan; onOpen: (id: string) => void }) {
  const withSpend = plan.partyRollups.filter((r) => r.total > 0 || r.tasks.length);
  const idle = plan.partyRollups.filter((r) => !r.total && !r.tasks.length);

  return (
    <>
      <Eyebrow style={{ paddingLeft: 2 }}>WIE DOET WAT, EN WAT KOST HET</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
        {withSpend.map((r) => (
          <div
            key={r.party.id}
            onClick={() => onOpen(r.party.id)}
            style={{
              background: C.card,
              borderRadius: 16,
              padding: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              cursor: 'pointer',
              boxShadow: SHADOW.card,
            }}
          >
            <PartyDot kind={r.party.kind} name={r.party.name} size={38} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div
                style={{
                  font: `600 15px/1.2 ${SANS}`,
                  letterSpacing: '-.015em',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {r.party.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                <KindTag kind={r.party.kind} />
                <span style={{ font: `400 11.5px ${SANS}`, color: C.faint }}>
                  {r.tasks.length} {r.tasks.length === 1 ? 'item' : 'items'}
                  {r.openTasks ? ` · ${r.openTasks} open` : ''}
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <div style={{ font: `700 15px ${SANS}`, letterSpacing: '-.025em' }}>
                {r.total ? money(r.total) : '—'}
              </div>
              <div
                style={{
                  font: `500 9.5px ${MONO}`,
                  letterSpacing: '.08em',
                  color: r.open ? C.clay : r.total ? C.green : '#B5AEA2',
                }}
              >
                {r.open ? `${money(r.open)} OPEN` : r.total ? 'BETAALD' : 'GEEN KOSTEN'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {plan.unassignedSpend > 0 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: C.sand,
            borderRadius: 14,
            font: `400 12.5px/1.4 ${SANS}`,
            color: '#6B4A32',
          }}
        >
          {money(plan.unassignedSpend)} aan facturen hangt nog aan geen enkele partij. Open zo'n
          factuur en kies bij "Aan wie" wie het geld krijgt.
        </div>
      )}

      {idle.length > 0 && (
        <>
          <Eyebrow style={{ paddingLeft: 2 }}>NOG NIETS GEKOPPELD</Eyebrow>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {idle.map((r) => (
              <button
                key={r.party.id}
                onClick={() => onOpen(r.party.id)}
                style={{
                  font: `500 12px ${SANS}`,
                  padding: '8px 11px',
                  borderRadius: 10,
                  background: C.card,
                  color: C.muted,
                  boxShadow: SHADOW.card,
                }}
              >
                {r.party.name}
              </button>
            ))}
          </div>
        </>
      )}

      {!plan.partyRollups.length && (
        <div style={{ font: `400 13.5px/1.45 ${SANS}`, color: C.muted, padding: '8px 2px' }}>
          Nog geen partijen. Open een taak of factuur en kies wie hem uitvoert of betaald krijgt.
        </div>
      )}
    </>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
        <span style={{ font: `400 11.5px ${SANS}`, color: C.muted }}>{label}</span>
      </div>
      <div style={{ font: `700 17px ${SANS}`, letterSpacing: '-.025em' }}>{value}</div>
    </div>
  );
}
