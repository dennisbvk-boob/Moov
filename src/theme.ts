// Design tokens lifted 1:1 from the Claude Design prototype (Verhuisplan.dc.html).

export const C = {
  bg: '#F5F2EC',
  card: '#FFFDFA',
  ink: '#1A1714',
  muted: '#7A7268',
  faint: '#8C8478',
  ghost: '#B0A99E',
  hairline: 'rgba(26,23,20,.07)',
  line: '#EAE5DB',
  stone: '#EFEAE1',
  sand: '#F3ECE3',
  border: '#CFC7B9',
  green: '#2F6B4F',
  greenSoft: '#E4EFE8',
  brown: '#8C5A3C',
  clay: '#B4552B',
  claySoft: '#F7E8E0',
} as const;

export const SHADOW = {
  card: '0 1px 2px rgba(26,23,20,.05)',
  raised: '0 1px 2px rgba(26,23,20,.05),0 10px 30px rgba(26,23,20,.05)',
  seg: '0 1px 3px rgba(26,23,20,.12)',
} as const;

export const MONO = 'ui-monospace,Menlo,monospace';
export const SANS = '-apple-system,BlinkMacSystemFont,Helvetica,sans-serif';

export type CatKey = 'afspraak' | 'klus' | 'admin' | 'inpakken' | 'betaling';

export const CATS: Record<CatKey, { label: string; color: string; soft: string }> = {
  afspraak: { label: 'AFSPRAAK', color: '#35577A', soft: '#E6EBF1' },
  klus: { label: 'KLUS', color: '#2F6B4F', soft: '#E4EFE8' },
  admin: { label: 'REGELEN', color: '#6E5A8C', soft: '#EDE8F2' },
  inpakken: { label: 'INPAKKEN', color: '#8C6A3C', soft: '#F2EBE1' },
  betaling: { label: 'BETALING', color: '#B4552B', soft: '#F7E8E0' },
};

export const LEVELS: Record<string, { color: string; soft: string }> = {
  Makkelijk: { color: '#2F6B4F', soft: '#E4EFE8' },
  Gemiddeld: { color: '#8C6A3C', soft: '#F2EBE1' },
  Pittig: { color: '#B4552B', soft: '#F7E8E0' },
};

export const MODES: Record<string, { color: string; soft: string }> = {
  HUUR: { color: '#2F6B4F', soft: '#E4EFE8' },
  KOOP: { color: '#8C6A3C', soft: '#F2EBE1' },
  'IN HUIS': { color: '#7A7268', soft: '#EFEAE1' },
};
