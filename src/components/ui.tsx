import type { CSSProperties, ReactNode } from 'react';
import { useEffect } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';

/** Small monospaced all-caps section label. */
export function Eyebrow({ children, color = C.faint, style }: {
  children: ReactNode;
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.14em', color, ...style }}>
      {children}
    </div>
  );
}

export function Card({ children, style, onClick }: {
  children: ReactNode;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: C.card,
        borderRadius: 18,
        padding: 16,
        boxShadow: SHADOW.card,
        cursor: onClick ? 'pointer' : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Avatar({ initial, bg, size = 24, ring }: {
  initial: string;
  bg: string;
  size?: number;
  ring?: string;
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `600 ${Math.round(size * 0.42)}px ${SANS}`,
        flex: 'none',
        border: ring ? `2px solid ${ring}` : undefined,
      }}
    >
      {initial}
    </div>
  );
}

export function Check({ on, color, size = 24, onClick }: {
  on: boolean;
  color: string;
  size?: number;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? 'checkbox' : undefined}
      aria-checked={on}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        flex: 'none',
        border: `1.5px solid ${on ? color : C.border}`,
        background: on ? color : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontSize: size * 0.54,
        lineHeight: 1,
        cursor: onClick ? 'pointer' : undefined,
      }}
    >
      {on ? '✓' : ''}
    </div>
  );
}

export function Tag({ label, color, soft }: { label: string; color: string; soft: string }) {
  return (
    <span
      style={{
        font: `500 10px ${MONO}`,
        letterSpacing: '.06em',
        padding: '2px 6px',
        borderRadius: 6,
        background: soft,
        color,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 5, padding: 4, background: C.line, borderRadius: 12 }}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '9px 4px',
              borderRadius: 9,
              font: `600 12.5px ${SANS}`,
              background: on ? C.card : 'transparent',
              color: on ? C.ink : C.muted,
              boxShadow: on ? SHADOW.seg : 'none',
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Button({ children, onClick, tone = 'primary', disabled }: {
  children: ReactNode;
  onClick?: () => void;
  tone?: 'primary' | 'muted' | 'quiet' | 'done';
  disabled?: boolean;
}) {
  const tones = {
    primary: { background: C.green, color: '#fff' },
    muted: { background: C.line, color: C.ghost },
    quiet: { background: 'transparent', color: C.muted },
    done: { background: '#F2E9E0', color: C.brown },
  } as const;
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: tone === 'quiet' ? 13 : 15,
        borderRadius: 14,
        textAlign: 'center',
        font: `${tone === 'quiet' ? 500 : 600} ${tone === 'quiet' ? 14 : 15}px ${SANS}`,
        cursor: disabled ? 'default' : 'pointer',
        ...tones[tone],
      }}
    >
      {children}
    </button>
  );
}

/** Bottom sheet with the prototype's slide-up + scrim. */
export function Sheet({ open, onClose, children, maxHeight = '86%' }: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(26,23,20,.38)',
          animation: 'fadeIn .18s ease',
        }}
      />
      <div
        style={{
          position: 'relative',
          background: C.bg,
          borderRadius: '26px 26px 0 0',
          padding: '12px 20px calc(34px + env(safe-area-inset-bottom))',
          animation: 'sheetUp .26s cubic-bezier(.22,1,.36,1)',
          maxHeight,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: 38,
            height: 4,
            borderRadius: 99,
            background: '#D8D0C2',
            margin: '0 auto 16px',
            flex: 'none',
          }}
        />
        {children}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <Eyebrow>{label}</Eyebrow>
      {children}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  background: C.card,
  border: `1px solid ${C.hairline}`,
  borderRadius: 12,
  padding: '13px 14px',
  font: `400 15px ${SANS}`,
  color: C.ink,
  width: '100%',
  outline: 'none',
  WebkitAppearance: 'none',
};
