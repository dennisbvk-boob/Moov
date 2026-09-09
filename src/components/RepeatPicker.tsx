import { C, SANS } from '../theme';
import { Eyebrow, inputStyle } from './ui';
import { REPEAT_UNITS } from '../lib/repeat';
import type { Repeat, RepeatUnit } from '../types';

const PLURAL: Record<RepeatUnit, string> = {
  dag: 'dagen',
  week: 'weken',
  maand: 'maanden',
  jaar: 'jaar',
};

/**
 * How often a task comes back. "Nooit" is a chip like any other rather than a
 * toggle, so turning a recurring task back into a one-off is the same gesture
 * as setting it up in the first place.
 */
export function RepeatPicker({ value, onChange }: {
  value: Repeat | null;
  onChange: (r: Repeat | null) => void;
}) {
  const options: { key: string; label: string; unit: RepeatUnit | null }[] = [
    { key: 'nooit', label: 'Nooit', unit: null },
    ...REPEAT_UNITS.map((u) => ({
      key: u,
      label: u[0].toUpperCase() + u.slice(1),
      unit: u as RepeatUnit,
    })),
  ];

  return (
    // A plain div rather than Field: Field renders a <label>, and inside one a
    // tap on a chip also lands on the number input.
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Eyebrow>HERHALEN</Eyebrow>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map((o) => {
          const on = o.unit === (value?.unit ?? null);
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.unit ? { unit: o.unit, interval: value?.interval ?? 1 } : null)}
              style={{
                font: `600 11.5px ${SANS}`,
                letterSpacing: '.02em',
                padding: '8px 12px',
                borderRadius: 10,
                background: on ? C.greenSoft : 'transparent',
                color: on ? C.green : C.faint,
                border: `1px solid ${on ? C.green + '55' : 'rgba(26,23,20,.10)'}`,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, paddingTop: 2 }}>
          <span style={{ font: `400 14px ${SANS}`, color: C.muted }}>elke</span>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={99}
            value={value.interval}
            onChange={(e) => {
              // Keep the field usable while it is briefly empty mid-typing;
              // what lands on the task is clamped to something sane.
              const n = Math.min(99, Math.max(1, Math.round(Number(e.target.value) || 1)));
              onChange({ ...value, interval: n });
            }}
            style={{ ...inputStyle, width: 72, textAlign: 'center', padding: '10px 8px' }}
          />
          <span style={{ font: `400 14px ${SANS}`, color: C.muted }}>
            {value.interval === 1 ? value.unit : PLURAL[value.unit]}
          </span>
        </div>
      )}
    </div>
  );
}
