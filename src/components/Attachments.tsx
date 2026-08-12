import { useEffect, useRef, useState } from 'react';
import { C, MONO, SANS, SHADOW } from '../theme';
import { Eyebrow } from './ui';
import { useStore } from '../store';
import { isImage, prettySize } from '../lib/images';
import type { Attachment } from '../types';

export function Attachments({ taskId }: { taskId: string }) {
  const store = useStore();
  const items = store.attachments
    .filter((a) => a.task_id === taskId)
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1));

  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewing, setViewing] = useState<Attachment | null>(null);

  const pick = async (list: FileList | null) => {
    if (!list?.length) return;
    setBusy(true);
    setError(null);
    const msg = await store.addAttachments(taskId, Array.from(list));
    setError(msg);
    setBusy(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <Eyebrow>BIJLAGEN</Eyebrow>
        {items.length > 0 && (
          <span style={{ font: `400 11px ${MONO}`, color: '#B5AEA2' }}>{items.length}</span>
        )}
      </div>

      {items.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((a) => (
            <Thumb
              key={a.id}
              att={a}
              pending={store.pendingUploads.includes(a.id)}
              onOpen={() => setViewing(a)}
            />
          ))}
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        onChange={(e) => void pick(e.target.files)}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          background: C.card,
          borderRadius: 14,
          padding: 13,
          boxShadow: SHADOW.card,
          width: '100%',
          opacity: busy ? 0.6 : 1,
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: C.greenSoft,
            color: C.green,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            font: `500 18px ${SANS}`,
            lineHeight: 1,
            paddingBottom: 2,
            flex: 'none',
          }}
        >
          +
        </span>
        <span style={{ font: `600 13.5px ${SANS}`, color: C.ink }}>
          {busy ? 'Bezig…' : 'Foto of document toevoegen'}
        </span>
      </button>

      {error && (
        <div style={{ font: `400 11.5px/1.45 ${SANS}`, color: C.clay }}>{error}</div>
      )}

      {viewing && <Viewer att={viewing} onClose={() => setViewing(null)} />}
    </div>
  );
}

function Thumb({ att, pending, onOpen }: {
  att: Attachment;
  pending: boolean;
  onOpen: () => void;
}) {
  const store = useStore();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    if (isImage(att.mime)) {
      void store.attachmentUrl(att.id).then((u) => {
        if (!alive) {
          if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
          return;
        }
        made = u;
        setUrl(u);
      });
    }
    return () => {
      alive = false;
      if (made?.startsWith('blob:')) URL.revokeObjectURL(made);
    };
  }, [att.id, att.mime, store]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={onOpen}
        style={{
          width: 74,
          height: 74,
          borderRadius: 12,
          overflow: 'hidden',
          background: url ? '#E8E4DC' : C.stone,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: SHADOW.card,
        }}
      >
        {url ? (
          <img
            src={url}
            alt={att.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <span style={{ font: `500 9px ${MONO}`, letterSpacing: '.08em', color: C.muted }}>
            {isImage(att.mime) ? 'FOTO' : 'PDF'}
          </span>
        )}
      </button>
      {pending && (
        <span
          title="Wacht op verbinding"
          style={{
            position: 'absolute',
            top: 5,
            right: 5,
            width: 9,
            height: 9,
            borderRadius: '50%',
            background: '#C9A227',
            border: '1.5px solid #fff',
          }}
        />
      )}
      <button
        onClick={() => {
          if (confirm(`“${att.name}” verwijderen?`)) store.deleteAttachment(att.id);
        }}
        aria-label={`${att.name} verwijderen`}
        style={{
          position: 'absolute',
          bottom: -3,
          right: -3,
          width: 21,
          height: 21,
          borderRadius: '50%',
          background: C.card,
          color: C.muted,
          boxShadow: '0 1px 4px rgba(26,23,20,.22)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          font: `500 13px ${SANS}`,
          lineHeight: 1,
          paddingBottom: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

function Viewer({ att, onClose }: { att: Attachment; onClose: () => void }) {
  const store = useStore();
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    let made: string | null = null;
    void store.attachmentUrl(att.id).then((u) => {
      if (!alive) {
        if (u?.startsWith('blob:')) URL.revokeObjectURL(u);
        return;
      }
      made = u;
      setUrl(u);
      if (!u) setFailed(true);
    });
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      alive = false;
      if (made?.startsWith('blob:')) URL.revokeObjectURL(made);
      window.removeEventListener('keydown', onKey);
    };
  }, [att.id, store, onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(26,23,20,.92)',
        display: 'flex',
        flexDirection: 'column',
        animation: 'fadeIn .18s ease',
      }}
    >
      <div
        style={{
          flex: 'none',
          padding: 'calc(env(safe-area-inset-top) + 14px) 18px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              font: `600 14px ${SANS}`,
              color: '#fff',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {att.name}
          </div>
          <div style={{ font: `400 11.5px ${SANS}`, color: 'rgba(255,255,255,.55)' }}>
            {[prettySize(att.size), att.uploaded_by].filter(Boolean).join(' · ')}
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Sluiten"
          style={{ font: `400 26px ${SANS}`, color: 'rgba(255,255,255,.7)', lineHeight: 1 }}
        >
          ×
        </button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 14px calc(env(safe-area-inset-bottom) + 22px)',
        }}
      >
        {failed ? (
          <div
            style={{
              font: `400 13.5px/1.5 ${SANS}`,
              color: 'rgba(255,255,255,.7)',
              textAlign: 'center',
            }}
          >
            Deze bijlage staat nog niet op dit toestel en er is geen verbinding.
          </div>
        ) : !url ? (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '2.5px solid rgba(255,255,255,.25)',
              borderTopColor: '#fff',
              animation: 'spin .8s linear infinite',
            }}
          />
        ) : isImage(att.mime) ? (
          <img
            src={url}
            alt={att.name}
            style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 10 }}
          />
        ) : (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            style={{
              background: '#fff',
              color: C.ink,
              padding: '14px 20px',
              borderRadius: 14,
              font: `600 14px ${SANS}`,
              textDecoration: 'none',
            }}
          >
            Openen in een nieuw tabblad
          </a>
        )}
      </div>
    </div>
  );
}
