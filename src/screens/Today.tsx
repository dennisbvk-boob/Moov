import { C, MONO, SANS, SHADOW } from '../theme';
import { Avatar, Card, Check, Eyebrow, Tag } from '../components/ui';
import { ClipBadge } from '../components/ClipBadge';
import { ago, fmtChip, fmtLong, money } from '../lib/dates';
import { useStore } from '../store';
import type { Plan } from '../lib/plan';
import type { DecoratedTask } from '../lib/derive';

export function Today({ plan, onOpenTask, onTab }: {
  plan: Plan;
  onOpenTask: (id: string) => void;
  onTab: (t: 'jobs' | 'money') => void;
}) {
  const store = useStore();
  const h = store.household!;
  const chip = fmtChip(h.move_date);
  const last = store.activity[0];

  const countdown =
    plan.daysLeft > 1
      ? `nog ${plan.daysLeft} dagen`
      : plan.daysLeft === 1
        ? 'morgen'
        : plan.daysLeft === 0
          ? 'vandaag'
          : `${Math.abs(plan.daysLeft)} dagen geleden`;

  return (
    <div style={{ padding: '16px 18px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* countdown + progress */}
      <div
        style={{
          background: C.card,
          borderRadius: 22,
          padding: 22,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: SHADOW.raised,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
            <Eyebrow>VERHUISDAG</Eyebrow>
            <div
              style={{
                font: `700 40px/1 ${SANS}`,
                letterSpacing: '-.035em',
              }}
            >
              {countdown}
            </div>
            <div style={{ font: `400 13px/1.35 ${SANS}`, color: C.muted }}>{fmtLong(h.move_date)}</div>
          </div>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: 14,
              background: C.greenSoft,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              flex: 'none',
            }}
          >
            <div style={{ font: `700 16px/1 ${SANS}`, color: C.green }}>{chip.day}</div>
            <div style={{ font: `500 8px ${MONO}`, letterSpacing: '.1em', color: C.green, marginTop: 2 }}>
              {chip.month}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ height: 6, borderRadius: 99, background: C.line, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                borderRadius: 99,
                background: C.green,
                width: `${plan.progressPct}%`,
                transition: 'width .4s ease',
              }}
            />
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              font: `400 12px ${SANS}`,
              color: C.muted,
            }}
          >
            <span>
              {plan.done} van {plan.total} taken af
            </span>
            <span>{plan.progressPct}%</span>
          </div>
        </div>
      </div>

      {plan.overdue.length > 0 && (
        <Section title="TE LAAT" color={C.clay}>
          {plan.overdue.map((t) => (
            <TaskCard
              key={t.id}
              t={t}
              files={plan.fileCounts[t.id] ?? 0}
              onOpen={onOpenTask}
              onToggle={store.toggleTask}
            />
          ))}
        </Section>
      )}

      <Section title="VANDAAG">
        {plan.todayItems.length ? (
          plan.todayItems.map((t) => (
            <TaskCard
              key={t.id}
              t={t}
              files={plan.fileCounts[t.id] ?? 0}
              onOpen={onOpenTask}
              onToggle={store.toggleTask}
            />
          ))
        ) : (
          <Card style={{ font: `400 13.5px/1.45 ${SANS}`, color: C.muted }}>
            Niets voor vandaag. Mooi moment om vooruit te kijken op de tijdlijn.
          </Card>
        )}
      </Section>

      {/* jobs teaser */}
      <Card onClick={() => onTab('jobs')} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: C.greenSoft,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <div
            style={{ width: 16, height: 16, border: `2.5px solid ${C.green}`, borderRadius: 4, transform: 'rotate(45deg)' }}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ font: `600 15px ${SANS}`, letterSpacing: '-.015em' }}>
            Zelf klussen? Regel je materiaal
          </div>
          <div style={{ font: `400 12px ${SANS}`, color: C.muted }}>
            {plan.jobs.length} klussen · {plan.pickedCount} items op de lijst
          </div>
        </div>
        <div style={{ font: `400 20px ${SANS}`, color: '#C4BCAF' }}>›</div>
      </Card>

      {/* open invoices */}
      <Card style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <Eyebrow>OPENSTAAND</Eyebrow>
          <button
            onClick={() => onTab('money')}
            style={{ font: `600 12px ${SANS}`, color: C.green }}
          >
            Alles zien
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <div style={{ font: `700 30px/1 ${SANS}`, letterSpacing: '-.035em' }}>
            {money(plan.openSum)}
          </div>
          <div style={{ font: `400 12px ${SANS}`, color: C.muted, paddingBottom: 3 }}>
            in {plan.openInvoices.length} {plan.openInvoices.length === 1 ? 'factuur' : 'facturen'}
          </div>
        </div>
        {plan.openInvoices.length > 0 && <div style={{ height: 1, background: C.hairline }} />}
        {plan.openInvoices.slice(0, 2).map((t) => (
          <button
            key={t.id}
            onClick={() => onOpenTask(t.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}
          >
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ font: `600 14px ${SANS}`, letterSpacing: '-.01em' }}>{t.vendorLabel}</div>
              <div style={{ font: `400 11px ${SANS}`, color: t.dueColor }}>{t.dueLine}</div>
            </div>
            <div style={{ font: `600 15px ${SANS}`, letterSpacing: '-.02em' }}>{t.amountLabel}</div>
          </button>
        ))}
      </Card>

      {last && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            background: C.sand,
            borderRadius: 14,
          }}
        >
          <Avatar initial={last.actor[0]?.toUpperCase() ?? '?'} bg={C.brown} size={22} />
          <div style={{ font: `400 12.5px/1.35 ${SANS}`, color: '#6B4A32' }}>
            {last.actor} {last.text} · {ago(last.created_at)}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, color, children }: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
      <Eyebrow color={color} style={{ paddingLeft: 2 }}>
        {title}
      </Eyebrow>
      {children}
    </div>
  );
}

export function TaskCard({ t, files, onOpen, onToggle }: {
  t: DecoratedTask;
  files: number;
  onOpen: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  return (
    <div
      onClick={() => onOpen(t.id)}
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
      <Check
        on={t.done}
        color={t.color}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(t.id);
        }}
      />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div
          style={{
            font: `600 15px/1.25 ${SANS}`,
            letterSpacing: '-.015em',
            color: t.titleColor,
            textDecoration: t.deco,
          }}
        >
          {t.title}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            font: `400 12px ${SANS}`,
            color: C.faint,
          }}
        >
          <Tag label={t.cat_label} color={t.color} soft={t.soft} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {t.metaLine}
            {t.partyName ? ` · ${t.partyName}` : ''}
          </span>
          <ClipBadge count={files} />
        </div>
      </div>
      <Avatar initial={t.who_.initial} bg={t.who_.bg} />
    </div>
  );
}
