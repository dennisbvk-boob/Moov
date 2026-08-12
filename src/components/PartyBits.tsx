import { C, MONO, SANS } from '../theme';
import type { PartyKind } from '../types';

/** One colour per kind of party, drawn from the same warm palette as categories. */
export const KINDS: Record<PartyKind, { label: string; color: string; soft: string }> = {
  aannemer: { label: 'Aannemer', color: '#B4552B', soft: '#F7E8E0' },
  installateur: { label: 'Installateur', color: '#35577A', soft: '#E6EBF1' },
  leverancier: { label: 'Leverancier', color: '#8C6A3C', soft: '#F2EBE1' },
  verhuur: { label: 'Verhuur', color: '#2F6B4F', soft: '#E4EFE8' },
  verhuizer: { label: 'Verhuizer', color: '#6E5A8C', soft: '#EDE8F2' },
  dienst: { label: 'Dienst', color: '#4A6B6B', soft: '#E3EDED' },
  overig: { label: 'Overig', color: '#7A7268', soft: '#EFEAE1' },
};

/** Rounded square with the party's initials; a dashed outline means "zelf doen". */
export function PartyDot({ kind, name, size = 34 }: {
  kind: PartyKind | null;
  name?: string;
  size?: number;
}) {
  if (!kind) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 10,
          border: `1.5px dashed ${C.border}`,
          flex: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.ghost,
          font: `600 ${Math.round(size * 0.4)}px ${SANS}`,
        }}
      >
        ·
      </div>
    );
  }
  const k = KINDS[kind];
  const initials = (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        background: k.soft,
        color: k.color,
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `700 ${Math.round(size * 0.36)}px ${SANS}`,
        letterSpacing: '-.02em',
      }}
    >
      {initials || '·'}
    </div>
  );
}

export function KindTag({ kind }: { kind: PartyKind }) {
  const k = KINDS[kind];
  return (
    <span
      style={{
        font: `500 10px ${MONO}`,
        letterSpacing: '.06em',
        padding: '2px 6px',
        borderRadius: 6,
        background: k.soft,
        color: k.color,
        whiteSpace: 'nowrap',
        textTransform: 'uppercase',
      }}
    >
      {k.label}
    </span>
  );
}
