import { useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Button, Check, Eyebrow, Field, Sheet, Tag, inputStyle } from './ui';
import { KINDS, PartyDot } from './PartyBits';
import { money } from '../lib/dates';
import { useStore } from '../store';
import type { PartyRollup } from '../lib/plan';
import type { PartyKind } from '../types';

export function PartySheet({ roll, onClose, onOpenTask }: {
  roll: PartyRollup;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const store = useStore();
  const { party } = roll;
  const [editing, setEditing] = useState(false);
  const nonInvoice = roll.tasks.filter((t) => t.cat !== 'betaling');

  return (
    <Sheet open onClose={onClose} maxHeight="90%">
      <div
        style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 12 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 13 }}>
          <PartyDot kind={party.kind} name={party.name} size={46} />
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ font: `700 21px/1.15 ${SANS}`, letterSpacing: '-.025em' }}>
              {party.name}
            </div>
            <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.1em', color: KINDS[party.kind].color }}>
              {KINDS[party.kind].label.toUpperCase()}
            </div>
          </div>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
            <Field label="NAAM">
              <input
                defaultValue={party.name}
                onBlur={(e) =>
                  store.patchParty(party.id, { name: e.target.value.trim() || party.name })
                }
                style={inputStyle}
              />
            </Field>
            <Field label="SOORT">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(Object.keys(KINDS) as PartyKind[]).map((k) => {
                  const on = k === party.kind;
                  return (
                    <button
                      key={k}
                      onClick={() => store.patchParty(party.id, { kind: k })}
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
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1 }}>
                <Field label="TELEFOON">
                  <input
                    defaultValue={party.phone ?? ''}
                    inputMode="tel"
                    onBlur={(e) => store.patchParty(party.id, { phone: e.target.value.trim() || null })}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div style={{ flex: 1 }}>
                <Field label="E-MAIL">
                  <input
                    defaultValue={party.email ?? ''}
                    inputMode="email"
                    autoCapitalize="off"
                    onBlur={(e) => store.patchParty(party.id, { email: e.target.value.trim() || null })}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
            <Field label="NOTITIE">
              <textarea
                defaultValue={party.note ?? ''}
                rows={3}
                onBlur={(e) => store.patchParty(party.id, { note: e.target.value.trim() || null })}
                style={{ ...inputStyle, resize: 'none' }}
              />
            </Field>
          </div>
        ) : (
          <>
            {party.note && (
              <div style={{ font: `400 13.5px/1.5 ${SANS}`, color: '#5C534A' }}>{party.note}</div>
            )}
            {(party.phone || party.email) && (
              <div style={{ display: 'flex', gap: 8 }}>
                {party.phone && (
                  <a
                    href={`tel:${party.phone.replace(/\s/g, '')}`}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: C.card,
                      borderRadius: 12,
                      padding: '12px 10px',
                      boxShadow: SHADOW.card,
                      font: `600 13px ${SANS}`,
                      color: C.green,
                      textDecoration: 'none',
                    }}
                  >
                    Bellen
                  </a>
                )}
                {party.email && (
                  <a
                    href={`mailto:${party.email}`}
                    style={{
                      flex: 1,
                      textAlign: 'center',
                      background: C.card,
                      borderRadius: 12,
                      padding: '12px 10px',
                      boxShadow: SHADOW.card,
                      font: `600 13px ${SANS}`,
                      color: C.green,
                      textDecoration: 'none',
                    }}
                  >
                    Mailen
                  </a>
                )}
              </div>
            )}
          </>
        )}

        {/* money */}
        <div
          style={{
            background: C.card,
            borderRadius: 18,
            padding: 18,
            boxShadow: SHADOW.card,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Eyebrow>TOTAAL BIJ DEZE PARTIJ</Eyebrow>
            <div style={{ font: `700 28px/1 ${SANS}`, letterSpacing: '-.035em' }}>
              {money(roll.total)}
            </div>
          </div>
          {roll.total > 0 && (
            <div style={{ display: 'flex', height: 7, borderRadius: 99, overflow: 'hidden', background: C.line }}>
              <div style={{ background: C.green, width: `${Math.round((roll.paid / roll.total) * 100)}%` }} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 20 }}>
            <Stat label="Betaald" value={money(roll.paid)} dot={C.green} />
            <Stat label="Nog te betalen" value={money(roll.open)} dot="#D8D0C2" />
          </div>
        </div>

        {roll.invoices.length > 0 && (
          <Group title="FACTUREN">
            {roll.invoices.map((t) => (
              <Line key={t.id} onClick={() => onOpenTask(t.id)}>
                <Check
                  on={t.done}
                  color={t.color}
                  size={22}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.toggleTask(t.id);
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ font: `600 14px ${SANS}`, color: t.titleColor }}>{t.title}</div>
                  <div style={{ font: `400 11.5px ${SANS}`, color: t.dueColor }}>{t.dueLine}</div>
                </div>
                <div style={{ font: `700 14.5px ${SANS}`, letterSpacing: '-.02em', color: t.titleColor }}>
                  {t.amountLabel}
                </div>
              </Line>
            ))}
          </Group>
        )}

        {nonInvoice.length > 0 && (
          <Group title="TAKEN">
            {nonInvoice.map((t) => (
              <Line key={t.id} onClick={() => onOpenTask(t.id)}>
                <Check
                  on={t.done}
                  color={t.color}
                  size={22}
                  onClick={(e) => {
                    e.stopPropagation();
                    store.toggleTask(t.id);
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div
                    style={{
                      font: `600 14px/1.25 ${SANS}`,
                      color: t.titleColor,
                      textDecoration: t.deco,
                    }}
                  >
                    {t.title}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Tag label={t.cat_label} color={t.color} soft={t.soft} />
                    <span style={{ font: `400 11px ${SANS}`, color: t.late ? C.clay : C.faint }}>
                      {t.late ? 'Te laat · ' : ''}
                      {t.listMeta}
                    </span>
                  </div>
                </div>
              </Line>
            ))}
          </Group>
        )}

        {!roll.tasks.length && (
          <div style={{ font: `400 13px/1.45 ${SANS}`, color: C.muted }}>
            Nog niets aan deze partij gekoppeld. Kies ze als uitvoerder bij een taak of factuur.
          </div>
        )}
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        <Button tone="quiet" onClick={() => setEditing((v) => !v)}>
          {editing ? 'Klaar met bewerken' : 'Gegevens bewerken'}
        </Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button tone="quiet" onClick={onClose}>
            Sluiten
          </Button>
          <Button
            tone="quiet"
            onClick={() => {
              if (
                confirm(
                  `“${party.name}” verwijderen? De ${roll.tasks.length} gekoppelde taken blijven staan, maar raken hun uitvoerder kwijt.`,
                )
              ) {
                store.deleteParty(party.id);
                onClose();
              }
            }}
          >
            <span style={{ color: C.clay }}>Verwijderen</span>
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Stat({ label, value, dot }: { label: string; value: string; dot: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: dot }} />
        <span style={{ font: `400 11.5px ${SANS}`, color: C.muted }}>{label}</span>
      </div>
      <div style={{ font: `700 16px ${SANS}`, letterSpacing: '-.025em' }}>{value}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Eyebrow>{title}</Eyebrow>
      <div
        style={{ background: C.card, borderRadius: 16, overflow: 'hidden', boxShadow: SHADOW.card }}
      >
        {children}
      </div>
    </div>
  );
}

function Line({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '12px 14px',
        cursor: 'pointer',
        borderTop: `1px solid ${C.hairline}`,
      }}
    >
      {children}
    </div>
  );
}
