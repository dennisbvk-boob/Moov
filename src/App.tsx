import { useEffect, useRef, useState } from 'react';
import { C, MONO, SANS } from './theme';
import { useStore } from './store';
import { usePlan } from './lib/plan';
import { syncEnabled } from './lib/supabase';
import { Avatar } from './components/ui';
import { TabBar } from './components/TabBar';
import { TaskSheet } from './components/TaskSheet';
import { JobSheet } from './components/JobSheet';
import { AddTaskSheet } from './components/AddTaskSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { AuthGate } from './screens/AuthGate';
import { Onboarding } from './screens/Onboarding';
import { Today } from './screens/Today';
import { Timeline } from './screens/Timeline';
import { ListScreen } from './screens/ListScreen';
import { Jobs } from './screens/Jobs';
import { Money } from './screens/Money';
import type { Tab } from './types';

export default function App() {
  const store = useStore();
  const [skippedAuth, setSkippedAuth] = useState(false);

  if (!store.authChecked || !store.ready) return <Splash />;
  if (syncEnabled && !store.session && !skippedAuth) {
    return (
      <Shell>
        <AuthGate onSkip={() => setSkippedAuth(true)} hasLocalPlan={!!store.household} />
      </Shell>
    );
  }
  if (!store.household) return <Shell><Onboarding /></Shell>;
  return <Shell><Plan /></Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        height: '100dvh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        background: C.bg,
        color: C.ink,
        overflow: 'hidden',
        maxWidth: 560,
        margin: '0 auto',
      }}
    >
      {children}
    </div>
  );
}

function Splash() {
  return (
    <Shell>
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 26,
            height: 26,
            borderRadius: '50%',
            border: `2.5px solid ${C.line}`,
            borderTopColor: C.green,
            animation: 'spin .8s linear infinite',
          }}
        />
        <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.14em', color: C.faint }}>
          MOOV.NL
        </div>
      </div>
    </Shell>
  );
}

function Plan() {
  const store = useStore();
  const plan = usePlan();
  const h = store.household!;
  const [tab, setTab] = useState<Tab>('home');
  const [openTask, setOpenTask] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [settings, setSettings] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // Jump back to the top when switching tabs — otherwise you land mid-list.
  useEffect(() => {
    scroller.current?.scrollTo({ top: 0 });
  }, [tab]);

  const task = openTask ? (plan.all.find((t) => t.id === openTask) ?? null) : null;
  const goJob = (id: string) => {
    setOpenTask(null);
    setTab('jobs');
    setOpenJob(id);
  };

  const initA = h.name_a[0]?.toUpperCase() ?? '?';
  const initB = h.name_b[0]?.toUpperCase() ?? '?';

  return (
    <>
      {/* header */}
      <div
        style={{
          padding: 'calc(env(safe-area-inset-top) + 14px) 20px 12px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
          background: C.card,
          borderBottom: `1px solid ${C.hairline}`,
          flex: 'none',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.14em', color: C.faint }}>
              MOOV.NL
            </div>
            <SyncDot status={store.status} />
          </div>
          <div
            style={{
              font: `700 18px/1.1 ${SANS}`,
              letterSpacing: '-.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {h.address}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 'none' }}>
          <button
            onClick={() => setAdding(true)}
            aria-label="Taak toevoegen"
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: C.greenSoft,
              color: C.green,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              font: `500 21px ${SANS}`,
              lineHeight: 1,
              paddingBottom: 2,
            }}
          >
            +
          </button>
          <button
            onClick={() => setSettings(true)}
            aria-label="Instellingen"
            style={{ display: 'flex', alignItems: 'center' }}
          >
            <Avatar initial={initA} bg={C.green} size={30} ring={C.card} />
            <div style={{ marginLeft: -9 }}>
              <Avatar initial={initB} bg={C.brown} size={30} ring={C.card} />
            </div>
          </button>
        </div>
      </div>

      {/* content */}
      <div
        ref={scroller}
        style={{ flex: 1, overflow: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}
      >
        {tab === 'home' && <Today plan={plan} onOpenTask={setOpenTask} onTab={setTab} />}
        {tab === 'timeline' && <Timeline plan={plan} onOpenTask={setOpenTask} />}
        {tab === 'list' && <ListScreen plan={plan} onOpenTask={setOpenTask} />}
        {tab === 'jobs' && <Jobs plan={plan} onOpenJob={setOpenJob} />}
        {tab === 'money' && <Money plan={plan} onOpenTask={setOpenTask} />}
      </div>

      <TabBar tab={tab} onTab={setTab} />

      <TaskSheet task={task} onClose={() => setOpenTask(null)} onOpenJob={goJob} />
      <JobSheet jobId={openJob} onClose={() => setOpenJob(null)} />
      <AddTaskSheet open={adding} onClose={() => setAdding(false)} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} />
    </>
  );
}

function SyncDot({ status }: { status: ReturnType<typeof useStore>['status'] }) {
  if (!syncEnabled) return null;
  const color =
    status === 'synced' ? C.green : status === 'offline' ? '#C9A227' : C.border;
  const title =
    status === 'synced' ? 'Gesynchroniseerd' : status === 'offline' ? 'Offline' : 'Verbinden…';
  return (
    <span
      title={title}
      aria-label={title}
      style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'block' }}
    />
  );
}
