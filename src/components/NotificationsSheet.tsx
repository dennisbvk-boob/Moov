import { C, MONO, SANS, SHADOW } from '../theme';
import { Avatar, Button, Sheet } from './ui';
import { useStore } from '../store';
import { ago } from '../lib/dates';

/**
 * What your partner has put on your plate since you last looked. Everything
 * here comes off the activity rows already synced between the two phones — no
 * mail, no push, nothing that leaves the app.
 */
export function NotificationsSheet({ open, onClose, onOpenTask }: {
  open: boolean;
  onClose: () => void;
  onOpenTask: (id: string) => void;
}) {
  const store = useStore();
  if (!open) return null;
  const items = store.notifications;

  return (
    <Sheet open onClose={onClose} maxHeight="80%">
      <div
        style={{ overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 12 }}
      >
        <div style={{ font: `700 22px/1.2 ${SANS}`, letterSpacing: '-.025em' }}>Voor jou</div>

        {!items.length && (
          <div style={{ font: `400 13.5px/1.5 ${SANS}`, color: C.muted }}>
            Niets nieuws. Zodra {store.partnerName} een taak aan jou geeft, staat die hier.
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {items.map((n) => {
            const task = n.task_id ? store.tasks.find((t) => t.id === n.task_id) : null;
            return (
              <button
                key={n.id}
                disabled={!task}
                onClick={() => {
                  if (!task) return;
                  store.markNotificationsRead();
                  onOpenTask(task.id);
                  onClose();
                }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 11,
                  background: C.card,
                  borderRadius: 16,
                  padding: 14,
                  width: '100%',
                  textAlign: 'left',
                  boxShadow: SHADOW.card,
                  cursor: task ? 'pointer' : 'default',
                }}
              >
                <Avatar initial={n.actor[0]?.toUpperCase() ?? '?'} bg={C.brown} size={28} />
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ font: `400 13.5px/1.4 ${SANS}`, color: C.ink }}>
                    <strong style={{ font: `600 13.5px ${SANS}` }}>{n.actor}</strong> {n.text}
                  </div>
                  <div style={{ font: `500 10px ${MONO}`, letterSpacing: '.08em', color: C.faint }}>
                    {ago(n.created_at).toUpperCase()}
                    {task ? '' : ' · TAAK IS WEG'}
                  </div>
                </div>
                {task && <div style={{ font: `400 18px ${SANS}`, color: '#C4BCAF' }}>›</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 'none', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
        {items.length > 0 && (
          <Button
            onClick={() => {
              store.markNotificationsRead();
              onClose();
            }}
          >
            Gelezen
          </Button>
        )}
        <Button tone="quiet" onClick={onClose}>
          Sluiten
        </Button>
      </div>
    </Sheet>
  );
}
