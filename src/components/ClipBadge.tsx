import { C, SANS } from '../theme';

/** "📎 2" — shows on a task card when files are attached. */
export function ClipBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        font: `500 11px ${SANS}`,
        color: C.faint,
        flex: 'none',
      }}
    >
      <svg width="10" height="12" viewBox="0 0 10 12" aria-hidden="true">
        <path
          d="M8 3.2v5A3 3 0 0 1 2 8.2v-5a1.9 1.9 0 0 1 3.8 0v4.9a.9.9 0 0 1-1.8 0V3.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
      {count}
    </span>
  );
}
