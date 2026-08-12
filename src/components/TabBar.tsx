import { C, SANS } from '../theme';
import type { Tab } from '../types';

const ICONS: Record<Tab, JSX.Element> = {
  home: <div style={{ width: 19, height: 19, borderRadius: 6, border: '2px solid currentColor' }} />,
  timeline: (
    <div
      style={{
        width: 19,
        height: 19,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '2px 0',
      }}
    >
      <span style={{ height: 2, background: 'currentColor', borderRadius: 2, width: '100%' }} />
      <span style={{ height: 2, background: 'currentColor', borderRadius: 2, width: '65%' }} />
      <span style={{ height: 2, background: 'currentColor', borderRadius: 2, width: '85%' }} />
    </div>
  ),
  list: (
    <div
      style={{
        width: 19,
        height: 19,
        borderRadius: 6,
        border: '2px solid currentColor',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      ✓
    </div>
  ),
  jobs: (
    <div style={{ width: 19, height: 19, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span
        style={{
          width: 14,
          height: 14,
          border: '2px solid currentColor',
          borderRadius: 4,
          transform: 'rotate(45deg)',
          display: 'block',
        }}
      />
    </div>
  ),
  money: (
    <div
      style={{
        width: 19,
        height: 19,
        borderRadius: '50%',
        border: '2px solid currentColor',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      €
    </div>
  ),
};

const LABELS: Record<Tab, string> = {
  home: 'Vandaag',
  timeline: 'Tijdlijn',
  list: 'Lijst',
  jobs: 'Klussen',
  money: 'Geld',
};

export function TabBar({ tab, onTab }: { tab: Tab; onTab: (t: Tab) => void }) {
  const tabs: Tab[] = ['home', 'timeline', 'list', 'jobs', 'money'];
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
        background: 'rgba(255,253,250,.94)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(26,23,20,.08)',
      }}
    >
      {tabs.map((t) => (
        <button
          key={t}
          onClick={() => onTab(t)}
          aria-current={tab === t}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 5,
            padding: '6px 0',
            color: tab === t ? C.green : C.ghost,
          }}
        >
          {ICONS[t]}
          <div style={{ font: `500 9.5px ${SANS}` }}>{LABELS[t]}</div>
        </button>
      ))}
    </div>
  );
}
