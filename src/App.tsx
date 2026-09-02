import { useEffect, useRef, useState } from 'react';
import { C, MONO, SANS } from './theme';
import { useStore } from './store';
import { usePlan } from './lib/plan';
import { person } from './lib/derive';
import { syncEnabled } from './lib/supabase';
import { Avatar } from './components/ui';
import { TabBar } from './components/TabBar';
import { TaskSheet } from './components/TaskSheet';
import { JobSheet } from './components/JobSheet';
import { AddTaskSheet } from './components/AddTaskSheet';
import { SettingsSheet } from './components/SettingsSheet';
import { AiAssistantSheet } from './components/AiAssistantSheet';
import { NotificationsSheet } from './components/NotificationsSheet';
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
  const [assistant, setAssistant] = useState(false);
  const [inbox, setInbox] = useState(false);
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

  const initA = person('a', h).initial;
  const initB = person('b', h).initial;

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
          <Bell count={store.notifications.length} onClick={() => setInbox(true)} />
          {store.session && (
            <button
              onClick={() => setAssistant(true)}
              aria-label="AI-assistent"
              style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: C.greenSoft,
                color: C.green,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                font: `700 11px ${SANS}`,
                letterSpacing: '.02em',
                lineHeight: 1,
              }}
            >
              AI
            </button>
          )}
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
      <AiAssistantSheet open={assistant} onClose={() => setAssistant(false)} />
      <NotificationsSheet open={inbox} onClose={() => setInbox(false)} onOpenTask={setOpenTask} />
    </>
  );
}

/**
 * The in-app inbox. Always present rather than only when unread, so "did they
 * send me anything?" has one answer in one place instead of a badge that
 * vanishes and takes the history with it.
 */
function Bell({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={count ? `${count} nieuwe meldingen` : 'Meldingen'}
      style={{
        position: 'relative',
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: count ? C.claySoft : C.sand,
        color: count ? C.clay : C.muted,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        font: `500 15px ${SANS}`,
        lineHeight: 1,
      }}
    >
      <svg aria-hidden width="15" height="15" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1.6a3.9 3.9 0 0 0-3.9 3.9c0 3-1.1 4-1.5 4.4a.5.5 0 0 0 .35.85h10.1a.5.5 0 0 0 .35-.85c-.4-.4-1.5-1.4-1.5-4.4A3.9 3.9 0 0 0 8 1.6Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path d="M6.4 13a1.7 1.7 0 0 0 3.2 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      {count > 0 && (
        <span
          style={{
            position: 'absolute',
            top: -2,
            right: -2,
            minWidth: 16,
            height: 16,
            padding: '0 4px',
            borderRadius: 99,
            background: C.clay,
            color: '#fff',
            font: `700 10px ${SANS}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${C.card}`,
            boxSizing: 'content-box',
          }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
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
