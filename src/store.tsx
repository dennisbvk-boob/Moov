import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  supabase,
  syncEnabled,
  currentSession,
  signOut as authSignOut,
  makeJoinCode,
  normalizeEmail,
  type Session,
} from './lib/supabase';
import { fmtShort, todayISO } from './lib/dates';
import { nextDate } from './lib/repeat';
import { nameFor } from './lib/derive';
import { clearBlobs, deleteBlob, getBlob, putBlob } from './lib/blobs';
import { MAX_BYTES, shrinkImage, storagePath } from './lib/images';
import type { ActivityEntry, Attachment, Household, Party, PartyKind, Repeat, Task, Who } from './types';
import type { CatKey } from './theme';

const STORAGE_KEY = 'moov:v1';

/** Tables a change to which means the other phone needs to look again. */
const SYNCED_TABLES = [
  'tasks',
  'parties',
  'job_picks',
  'job_reservations',
  'activity',
  'attachments',
] as const;

export type SyncStatus = 'local' | 'connecting' | 'synced' | 'offline';

interface Persisted {
  household: Household | null;
  slot: 'a' | 'b';
  tasks: Task[];
  parties: Party[];
  picks: Record<string, boolean>;
  reserved: Record<string, string>;
  activity: ActivityEntry[];
  attachments: Attachment[];
  dirtyTasks: string[];
  dirtyParties: string[];
  dirtyPicks: string[];
  /**
   * Activity rows written on this device that the server hasn't taken yet.
   * They cannot be fire-and-forget: `activity.task_id` is a foreign key to
   * `tasks`, so an entry about a brand-new task has to wait until that task
   * itself has been pushed, and an entry written offline has to survive until
   * there is a connection — otherwise the other phone never hears about it.
   */
  dirtyActivity: string[];
  deletedTasks: string[];
  deletedParties: string[];
  /** Attachment ids whose bytes are still only in this device's IndexedDB. */
  pendingUploads: string[];
  /**
   * When this device last opened the notification list. Anything addressed to
   * you after this counts as unread. Deliberately per-device, like a phone's
   * own notification tray — reading it here doesn't clear it on your tablet.
   */
  readActivityAt: string;
  /**
   * Whether the countdown to the moving day is hidden. Deliberately per
   * device and never synced: once the move is behind you the card is just
   * noise, and which phone stops showing it is nobody else's business.
   */
  hideCountdown: boolean;
}

const EMPTY: Persisted = {
  household: null,
  slot: 'a',
  tasks: [],
  parties: [],
  picks: {},
  reserved: {},
  activity: [],
  attachments: [],
  dirtyTasks: [],
  dirtyParties: [],
  dirtyPicks: [],
  dirtyActivity: [],
  deletedTasks: [],
  deletedParties: [],
  pendingUploads: [],
  readActivityAt: new Date(0).toISOString(),
  hideCountdown: false,
};

/**
 * Fill in fields a row may predate. Tasks stored before `repeat` and `help`
 * existed — on this device, or in a database that hasn't run the migration —
 * come back without them, and `undefined` where the type promises `null` ends
 * up in an upsert as "leave this column alone" rather than "it is empty".
 */
function normalizeTask(row: Task): Task {
  return {
    ...row,
    amount: row.amount === null || row.amount === undefined ? null : Number(row.amount),
    repeat: row.repeat ?? null,
    help: row.help ?? null,
  };
}

/**
 * The feed as both sides know it: what the server has, plus anything this
 * device still owes it, newest first and capped like the query that feeds it.
 */
function mergeActivity(server: ActivityEntry[], prev: Persisted): ActivityEntry[] {
  const pending = new Set(prev.dirtyActivity);
  const seen = new Set(server.map((e) => e.id));
  const mine = prev.activity.filter((e) => pending.has(e.id) && !seen.has(e.id));
  if (!server.length && !mine.length) return prev.activity;
  return [...server, ...mine]
    .sort((x, y) => (x.created_at < y.created_at ? 1 : -1))
    .slice(0, 20);
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    const state = { ...EMPTY, ...parsed };
    return {
      ...state,
      tasks: state.tasks.map(normalizeTask),
      household: state.household
        ? { ...state.household, calendar_token: state.household.calendar_token ?? null }
        : null,
    };
  } catch {
    return EMPTY;
  }
}

function save(s: Persisted) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* private mode / quota — the app still works for this session */
  }
}

export interface NewTaskInput {
  title: string;
  cat: CatKey;
  who: Who;
  party_id?: string | null;
  date: string;
  time?: string | null;
  note?: string | null;
  amount?: number | null;
  vendor?: string | null;
  repeat?: Repeat | null;
}

interface Store extends Persisted {
  status: SyncStatus;
  ready: boolean;
  /** false while we are still reading the stored session off the device */
  authChecked: boolean;
  /** The email-verified account on this device, when syncing is on. */
  session: Session | null;
  /** Display name of the person using *this* device. */
  meName: string;
  partnerName: string;
  createHousehold(input: {
    address: string;
    moveDate: string;
    yourName: string;
    partnerName: string;
    /** Optional: lock joining to this one address on top of the join code. */
    partnerEmail?: string;
    /** Pre-generated household id — needed when tasks were built (e.g. by the AI wizard) before the household exists. */
    id?: string;
    /** Tasks from the AI wizard. Without them the plan starts completely empty — nothing is ever pre-filled. */
    aiTasks?: Task[];
  }): Promise<void>;
  /** Delete every task and party in the current plan. The plan itself (address, date, names) stays. */
  clearAllData(): void;
  joinHousehold(code: string, yourName: string): Promise<void>;
  signOut(): Promise<void>;
  toggleTask(id: string): void;
  patchTask(id: string, patch: Partial<Task>): void;
  addTask(input: NewTaskInput): void;
  deleteTask(id: string): void;
  /** Returns a human message when files were refused, else null. */
  addAttachments(taskId: string, files: File[]): Promise<string | null>;
  deleteAttachment(id: string): void;
  attachmentUrl(id: string): Promise<string | null>;
  /** Create a third party and return its id, so a picker can select it at once. */
  addParty(input: { name: string; kind: PartyKind; phone?: string; email?: string; note?: string }): string | null;
  patchParty(id: string, patch: Partial<Omit<Party, 'id' | 'household_id' | 'created_at'>>): void;
  deleteParty(id: string): void;
  togglePick(key: string): void;
  reserveJob(jobId: string): void;
  updateHousehold(
    patch: Partial<
      Pick<
        Household,
        'address' | 'move_date' | 'name_a' | 'name_b' | 'invited_email' | 'calendar_token'
      >
    >,
  ): void;
  /**
   * Mint a fresh join code and store it. The old code stops working at once,
   * which is the way back if a code ended up somewhere it shouldn't have.
   * Resolves to the new code.
   */
  regenerateJoinCode(): Promise<string>;
  leave(): void;
  /** Permanently delete the current household and everyone/everything in it. Stays logged in. */
  deleteHousehold(): Promise<void>;
  /** Change who owns a task, telling them about it if it isn't you. */
  reassignTask(id: string, who: Who): void;
  /** Entries addressed to you that you haven't opened yet, newest first. */
  notifications: ActivityEntry[];
  /** Mark everything currently addressed to you as seen. */
  markNotificationsRead(): void;
  /** Hide or restore the countdown card on Vandaag, on this device only. */
  setHideCountdown(v: boolean): void;
}

const Ctx = createContext<Store | null>(null);

export function useStore(): Store {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore buiten StoreProvider');
  return v;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [s, setS] = useState<Persisted>(() => load());
  const [status, setStatus] = useState<SyncStatus>(syncEnabled ? 'connecting' : 'local');
  const [ready, setReady] = useState(!syncEnabled);
  const [session, setSession] = useState<Session | null>(null);
  // false until we know whether a stored session exists — prevents flashing the
  // login screen at someone who is already logged in
  const [authChecked, setAuthChecked] = useState(!syncEnabled);
  const stateRef = useRef(s);
  stateRef.current = s;

  // Track the logged-in account. Supabase keeps the refresh token on the device,
  // so this survives closing the app — you log in once per phone, not per visit.
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    void currentSession().then((sess) => {
      if (!alive) return;
      setSession(sess);
      setAuthChecked(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, sb) => {
      const u = sb?.user;
      setSession(u?.email ? { userId: u.id, email: u.email.toLowerCase() } : null);
      setAuthChecked(true);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  // Persist every change so a reload (or a crash mid-move) loses nothing.
  useEffect(() => {
    save(s);
  }, [s]);

  const update = useCallback((fn: (prev: Persisted) => Persisted) => {
    setS((prev) => fn(prev));
  }, []);

  // ── pushing local changes up ──────────────────────────────
  const pushing = useRef(false);
  // A push that arrives mid-push used to be dropped on the floor and left to
  // the 20-second heartbeat. Taps come faster than that.
  const pushAgain = useRef(false);
  const flush = useCallback(async () => {
    if (!supabase) return;
    if (pushing.current) {
      pushAgain.current = true;
      return;
    }
    const cur = stateRef.current;
    if (!cur.household) return;
    if (
      !cur.dirtyTasks.length &&
      !cur.dirtyParties.length &&
      !cur.dirtyPicks.length &&
      !cur.dirtyActivity.length &&
      !cur.deletedTasks.length &&
      !cur.deletedParties.length &&
      !cur.pendingUploads.length
    )
      return;

    pushing.current = true;
    // Pushing is not instant, and the person holding the phone keeps tapping
    // while it runs. Clearing a dirty flag by id would throw away an edit made
    // during the round trip — the row would be marked clean with its newer
    // version never sent, and the next pull would quietly overwrite it with
    // what the server still has. So we remember the exact objects we sent and
    // only mark those clean if they are still the current ones.
    const sentTasks = new Map<string, Task>();
    const sentParties = new Map<string, Party>();
    const sentPicks = new Map<string, boolean>();
    const sentActivity: string[] = [];
    const sentDeletes: string[] = [];
    const sentPartyDeletes: string[] = [];
    let failed = false;

    try {
      // parties first: tasks reference them by foreign key
      const partyRows = cur.parties.filter((x) => cur.dirtyParties.includes(x.id));
      if (partyRows.length) {
        const { error } = await supabase.from('parties').upsert(partyRows);
        if (error) failed = true;
        else for (const r of partyRows) sentParties.set(r.id, r);
      }

      if (cur.deletedTasks.length) {
        const { error } = await supabase.from('tasks').delete().in('id', cur.deletedTasks);
        if (error) failed = true;
        else sentDeletes.push(...cur.deletedTasks);
      }

      const rows = cur.tasks.filter((t) => cur.dirtyTasks.includes(t.id));
      if (rows.length) {
        const { error } = await supabase.from('tasks').upsert(rows);
        if (error) failed = true;
        else for (const r of rows) sentTasks.set(r.id, r);
      }

      // Activity after the tasks, never before: an entry about a task that was
      // just created carries that task's id, and the foreign key only holds
      // once the task row itself is up.
      const actRows = cur.activity.filter((e) => cur.dirtyActivity.includes(e.id));
      if (actRows.length) {
        const live = new Set(cur.tasks.map((t) => t.id));
        // An entry about a task that has since been deleted can never satisfy
        // the foreign key. Stop owing it rather than retrying it forever and
        // holding every later entry behind it.
        sentActivity.push(...actRows.filter((e) => e.task_id && !live.has(e.task_id)).map((e) => e.id));
        const ready = actRows.filter(
          (e) =>
            !e.task_id ||
            (live.has(e.task_id) &&
              (sentTasks.has(e.task_id) || !cur.dirtyTasks.includes(e.task_id))),
        );
        if (ready.length) {
          const { error } = await supabase.from('activity').upsert(
            ready.map((e) => ({
              id: e.id,
              household_id: e.household_id,
              actor: e.actor,
              text: e.text,
              created_at: e.created_at,
              for_slot: e.for_slot,
              task_id: e.task_id,
            })),
          );
          if (error) failed = true;
          else sentActivity.push(...ready.map((e) => e.id));
        }
      }

      if (cur.dirtyPicks.length) {
        const picks = cur.dirtyPicks.map((key) => ({
          household_id: cur.household!.id,
          key,
          picked: !!cur.picks[key],
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('job_picks').upsert(picks);
        if (error) failed = true;
        else for (const row of picks) sentPicks.set(row.key, row.picked);
      }

      // parties last on the way out: the task rows referencing them go first
      if (cur.deletedParties.length) {
        const { error } = await supabase.from('parties').delete().in('id', cur.deletedParties);
        if (error) failed = true;
        else sentPartyDeletes.push(...cur.deletedParties);
      }

      // Attachments: push the bytes to Storage, then stamp the row with its path.
      const uploaded: string[] = [];
      for (const attId of cur.pendingUploads) {
        const att = cur.attachments.find((a) => a.id === attId);
        if (!att) {
          uploaded.push(attId); // row is gone; stop trying
          continue;
        }
        const blob = await getBlob(attId);
        if (!blob) {
          uploaded.push(attId);
          continue;
        }
        const path =
          att.path ??
          storagePath(att.household_id, att.task_id, att.id, att.name, att.mime ?? '');
        const up = await supabase.storage
          .from('bijlagen')
          .upload(path, blob, { contentType: att.mime ?? undefined, upsert: true });
        if (up.error) {
          failed = true;
          break; // no signal or no permission — try again next tick
        }
        const row = await supabase.from('attachments').upsert({ ...att, path });
        if (row.error) {
          failed = true;
          break;
        }
        uploaded.push(attId);
        update((p) => ({
          ...p,
          attachments: p.attachments.map((a) => (a.id === attId ? { ...a, path } : a)),
        }));
      }

      update((p) => ({
        ...p,
        dirtyTasks: p.dirtyTasks.filter((id) => p.tasks.find((t) => t.id === id) !== sentTasks.get(id)),
        dirtyParties: p.dirtyParties.filter(
          (id) => p.parties.find((x) => x.id === id) !== sentParties.get(id),
        ),
        dirtyPicks: p.dirtyPicks.filter(
          (k) => !sentPicks.has(k) || !!p.picks[k] !== sentPicks.get(k),
        ),
        dirtyActivity: p.dirtyActivity.filter((id) => !sentActivity.includes(id)),
        deletedTasks: p.deletedTasks.filter((id) => !sentDeletes.includes(id)),
        deletedParties: p.deletedParties.filter((id) => !sentPartyDeletes.includes(id)),
        pendingUploads: p.pendingUploads.filter((id) => !uploaded.includes(id)),
      }));
      // A rejected write is not a synced plan. Saying "synced" through a failing
      // push is how a task can sit on one phone for days without either of you
      // having any reason to suspect it never left.
      setStatus(failed ? 'offline' : 'synced');
    } catch {
      setStatus('offline');
    } finally {
      pushing.current = false;
      if (pushAgain.current) {
        pushAgain.current = false;
        // after the state update above has been applied, so the retry sees it
        window.setTimeout(() => void flushRef.current(), 120);
      }
    }
  }, [update]);

  // flush() needs to be able to call itself again; a ref keeps that from
  // making the callback depend on itself.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  // ── pulling the server's view down ────────────────────────
  const pull = useCallback(async (householdId: string) => {
    if (!supabase) return;
    try {
      const [h, t, p, r, a, att, par] = await Promise.all([
        supabase.from('households').select('*').eq('id', householdId).maybeSingle(),
        supabase.from('tasks').select('*').eq('household_id', householdId),
        supabase.from('job_picks').select('*').eq('household_id', householdId),
        supabase.from('job_reservations').select('*').eq('household_id', householdId),
        supabase
          .from('activity')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('attachments')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: true }),
        supabase
          .from('parties')
          .select('*')
          .eq('household_id', householdId)
          .order('created_at', { ascending: true }),
      ]);
      if (h.error || t.error) {
        setStatus('offline');
        return;
      }

      update((prev) => {
        const dirty = new Set(prev.dirtyTasks);
        const deleted = new Set(prev.deletedTasks);
        const byId = new Map(prev.tasks.map((x) => [x.id, x]));
        const merged: Task[] = [];

        for (const row of (t.data ?? []) as Task[]) {
          if (deleted.has(row.id)) continue; // we deleted it while offline
          const local = byId.get(row.id);
          // a locally-changed row wins until it has been pushed
          merged.push(dirty.has(row.id) && local ? local : normalizeTask(row));
          byId.delete(row.id);
        }
        // rows we created offline that the server hasn't seen yet
        for (const [id, local] of byId) if (dirty.has(id)) merged.push(local);

        const picks: Record<string, boolean> = {};
        for (const row of (p.data ?? []) as { key: string; picked: boolean }[]) {
          picks[row.key] = row.picked;
        }
        for (const k of prev.dirtyPicks) picks[k] = !!prev.picks[k];

        const reserved: Record<string, string> = { ...prev.reserved };
        for (const row of (r.data ?? []) as { job_id: string; reserved_by: string | null }[]) {
          reserved[row.job_id] = row.reserved_by ?? '';
        }

        // Server list, plus anything of ours still waiting to upload.
        const queued = new Set(prev.pendingUploads);
        const serverAtt = (att.data ?? []) as Attachment[];
        const seen = new Set(serverAtt.map((x) => x.id));
        const attachments = [
          ...serverAtt,
          ...prev.attachments.filter((x) => queued.has(x.id) && !seen.has(x.id)),
        ];

        // same last-write-wins rule as tasks: unpushed local edits survive a pull
        const dirtyP = new Set(prev.dirtyParties);
        const deletedP = new Set(prev.deletedParties);
        const localP = new Map(prev.parties.map((x) => [x.id, x]));
        const mergedParties: Party[] = [];
        for (const row of (par.data ?? []) as Party[]) {
          if (deletedP.has(row.id)) continue;
          const local = localP.get(row.id);
          mergedParties.push(dirtyP.has(row.id) && local ? local : row);
          localP.delete(row.id);
        }
        for (const [id, local] of localP) if (dirtyP.has(id)) mergedParties.push(local);

        return {
          ...prev,
          household: h.data
            ? { ...(h.data as Household), calendar_token: (h.data as Household).calendar_token ?? null }
            : prev.household,
          tasks: merged,
          parties: mergedParties,
          picks,
          reserved,
          attachments,
          // Server feed, plus our own entries that haven't been accepted yet.
          // Taking the server list wholesale used to erase them, so an entry
          // whose write had failed vanished from the phone that wrote it too —
          // no notification for your partner, and no trace for you either.
          activity: mergeActivity((a.data ?? []) as ActivityEntry[], prev),
        };
      });
      setStatus('synced');
    } catch {
      setStatus('offline');
    }
  }, [update]);

  /**
   * A plan started before the database was configured lives only on this device.
   * Once credentials appear, push it up once so the partner can actually join it.
   */
  const adopt = useCallback(async (sess: Session) => {
    if (!supabase) return;
    const cur = stateRef.current;
    const h = cur.household;
    if (!h) return;
    const { data, error } = await supabase
      .from('households')
      .select('id')
      .eq('id', h.id)
      .maybeSingle();
    if (error || data) return; // already there, or we simply can't reach it

    const ins = await supabase.from('households').insert(h);
    if (ins.error) return;
    await supabase.from('members').insert({
      household_id: h.id,
      user_id: sess.userId,
      slot: cur.slot,
      display_name: nameFor(cur.slot, h),
      email: sess.email,
    });
    const par = cur.parties.length
      ? await supabase.from('parties').upsert(cur.parties)
      : { error: null };
    const tsk = cur.tasks.length
      ? await supabase.from('tasks').upsert(cur.tasks)
      : { error: null };
    const picks = Object.entries(cur.picks).map(([key, picked]) => ({
      household_id: h.id,
      key,
      picked,
    }));
    const pck = picks.length ? await supabase.from('job_picks').upsert(picks) : { error: null };
    // Only what actually landed counts as sent. What didn't stays queued for
    // flush() rather than being declared clean and forgotten.
    update((p) => ({
      ...p,
      dirtyTasks: tsk.error ? [...new Set([...p.dirtyTasks, ...cur.tasks.map((t) => t.id)])] : [],
      dirtyParties: par.error
        ? [...new Set([...p.dirtyParties, ...cur.parties.map((x) => x.id)])]
        : [],
      dirtyPicks: pck.error ? [...new Set([...p.dirtyPicks, ...picks.map((x) => x.key)])] : [],
    }));
  }, [update]);

  // ── boot: session, first pull, realtime, reconnect handling ──
  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    let cancelled = false;

    // Nothing to sync until someone has logged in with their email.
    if (!session) {
      setReady(true);
      setStatus('local');
      return;
    }

    (async () => {
      const hid = stateRef.current.household?.id;
      if (hid) {
        await adopt(session);
        if (cancelled) return;
        await pull(hid);
        await flush();
        if (cancelled) return;

        // One binding per table. A `filter` is only meaningful alongside the
        // `table` it belongs to — asking for a whole schema and filtering it by
        // a column is not something the server can honour, and the whole
        // channel errors out, which is a live plan that silently stops being
        // live until someone reopens the app.
        channel = SYNCED_TABLES.reduce(
          (ch, table) =>
            ch.on(
              'postgres_changes',
              { event: '*', schema: 'public', table, filter: `household_id=eq.${hid}` },
              () => void pull(hid),
            ),
          supabase!.channel(`household:${hid}`),
        ).subscribe((st) => {
          if (st === 'SUBSCRIBED') {
            setStatus('synced');
            // Anything that changed while we were not listening never fired an
            // event at us, so take a fresh look rather than trusting the gap.
            void pull(hid);
          }
          if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') setStatus('offline');
        });
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase!.removeChannel(channel);
    };
    // re-run when the household or the logged-in account changes
  }, [s.household?.id, session, pull, flush, adopt]);

  // Retry unsent changes when the tab wakes up or the network returns — and
  // look at what the other phone did while this one was asleep. A pushed-only
  // heartbeat left the live channel as the sole way anything ever came *down*;
  // one dropped socket, and a phone could sit on a stale plan indefinitely
  // while cheerfully reporting itself synced.
  useEffect(() => {
    if (!syncEnabled) return;
    const kick = () => {
      if (document.visibilityState === 'hidden') return;
      const hid = stateRef.current.household?.id;
      void flush();
      if (hid) void pull(hid);
    };
    const timer = window.setInterval(kick, 20000);
    window.addEventListener('online', kick);
    window.addEventListener('focus', kick);
    document.addEventListener('visibilitychange', kick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', kick);
      window.removeEventListener('focus', kick);
      document.removeEventListener('visibilitychange', kick);
    };
  }, [flush, pull]);

  // Fire a push shortly after any local mutation.
  const nudge = useCallback(() => {
    if (!syncEnabled) return;
    window.setTimeout(() => void flush(), 120);
  }, [flush]);

  // ── actions ───────────────────────────────────────────────

  const logActivity = useCallback(
    (text: string, target?: { forSlot: 'a' | 'b' | null; taskId?: string | null }) => {
      const cur = stateRef.current;
      if (!cur.household) return;
      const actor = nameFor(cur.slot, cur.household);
      const entry: ActivityEntry = {
        id: crypto.randomUUID(),
        household_id: cur.household.id,
        actor,
        text,
        created_at: new Date().toISOString(),
        for_slot: target?.forSlot ?? null,
        task_id: target?.taskId ?? null,
      };
      update((p) => {
        const activity = [entry, ...p.activity].slice(0, 20);
        const kept = new Set(activity.map((e) => e.id));
        return {
          ...p,
          activity,
          // an entry pushed out of the window can no longer be sent, so stop
          // counting it as owed
          dirtyActivity: [...p.dirtyActivity, entry.id].filter((id) => kept.has(id)),
        };
      });
      // Sent by flush(), after the task it may point at. Firing it from here
      // raced the task's own upsert and lost: activity.task_id is a foreign key,
      // so the row about a task you had just created was rejected outright.
      nudge();
    },
    [update, nudge],
  );

  /**
   * Who a task lands on, other than the person doing the assigning. A task you
   * give yourself is not news; one for your partner — or for the two of you
   * together — is. Returns null when there is nobody to tell.
   */
  const notifySlotFor = useCallback((who: Who): 'a' | 'b' | null => {
    const mine = stateRef.current.slot;
    const other: 'a' | 'b' = mine === 'a' ? 'b' : 'a';
    if (who === 'samen') return other;
    return who === mine ? null : who;
  }, []);

  /**
   * Activity text is written in the third person — the same row is read in the
   * feed by the person who wrote it and in the inbox by the person it is for,
   * and "jouw lijst" is wrong for one of them whichever way round you put it.
   */
  const describeAssignment = useCallback((verb: 'add' | 'give', title: string, who: Who): string => {
    const h = stateRef.current.household;
    if (who === 'samen') return `zette “${title}” op jullie gezamenlijke lijst`;
    const name = nameFor(who, h);
    return verb === 'add'
      ? `zette “${title}” op de lijst van ${name}`
      : `gaf “${title}” aan ${name}`;
  }, []);

  const touchTask = useCallback(
    (id: string, patch: Partial<Task>) => {
      update((p) => ({
        ...p,
        tasks: p.tasks.map((t) =>
          t.id === id ? { ...t, ...patch, updated_at: new Date().toISOString() } : t,
        ),
        dirtyTasks: p.dirtyTasks.includes(id) ? p.dirtyTasks : [...p.dirtyTasks, id],
      }));
      nudge();
    },
    [update, nudge],
  );

  const createHousehold = useCallback<Store['createHousehold']>(
    async ({ address, moveDate, yourName, partnerName, partnerEmail, id: presetId, aiTasks }) => {
      const id = presetId ?? crypto.randomUUID();
      const household: Household = {
        id,
        address,
        move_date: moveDate,
        join_code: makeJoinCode(),
        name_a: yourName,
        name_b: partnerName,
        invited_email: partnerEmail?.trim() ? normalizeEmail(partnerEmail) : null,
        calendar_token: null,
      };
      // A plan is never pre-filled: it starts empty, or with exactly what the
      // AI wizard produced from the answers the user gave.
      const parties: Party[] = [];
      const tasks: Task[] = aiTasks ?? [];

      // Whether the opening rows actually landed. The plan used to be marked
      // fully synced the moment it was created, errors unread — so a rejected
      // insert left the wizard's tasks clean, un-queued and invisible to the
      // other phone for good, with nothing on screen to say so.
      let pushed = false;
      if (supabase && session) {
        const { error } = await supabase.from('households').insert(household);
        if (error) throw new Error(error.message);
        const mem = await supabase.from('members').insert({
          household_id: id,
          user_id: session.userId,
          slot: 'a',
          display_name: yourName,
          email: session.email,
        });
        const par = parties.length
          ? await supabase.from('parties').insert(parties)
          : { error: null };
        const tsk = tasks.length ? await supabase.from('tasks').insert(tasks) : { error: null };
        pushed = !mem.error && !par.error && !tsk.error;
        if (!pushed) setStatus('offline');
      }

      update((p) => ({
        ...p,
        household,
        slot: 'a',
        tasks,
        parties,
        picks: {},
        reserved: {},
        activity: [],
        dirtyActivity: [],
        dirtyTasks: pushed ? [] : tasks.map((t) => t.id),
        dirtyParties: pushed ? [] : parties.map((p) => p.id),
        dirtyPicks: [],
        deletedTasks: [],
        deletedParties: [],
      }));
      // anything the creation call couldn't place is now queued; try again
      if (!pushed) nudge();
    },
    [update, session, nudge],
  );

  const joinHousehold = useCallback<Store['joinHousehold']>(
    async (code, yourName) => {
      if (!supabase) {
        throw new Error(
          'Meedoen met een code werkt alleen als de database is ingesteld. Zie README.',
        );
      }
      if (!session) throw new Error('Log eerst in met je e-mailadres.');

      const { data, error } = await supabase.rpc('join_household', {
        code: code.trim().toUpperCase(),
        display_name: yourName,
      });
      if (error) {
        if (error.message.includes('CODE_NOT_FOUND')) throw new Error('Die code kennen we niet.');
        if (error.message.includes('EMAIL_NOT_INVITED'))
          throw new Error(
            `Dit plan is vastgezet op één e-mailadres, en dat is niet ${session.email}. Vraag of ze het adres aanpassen of weghalen.`,
          );
        if (error.message.includes('HOUSEHOLD_FULL'))
          throw new Error('Dit plan heeft al twee mensen.');
        throw new Error(error.message);
      }
      const household = data as Household;
      const { data: me } = await supabase
        .from('members')
        .select('slot')
        .eq('household_id', household.id)
        .eq('user_id', session.userId)
        .maybeSingle();

      update((p) => ({
        ...EMPTY,
        household,
        slot: (me?.slot as 'a' | 'b') ?? 'b',
        activity: p.activity,
      }));
      await pull(household.id);
    },
    [update, pull, session],
  );

  const toggleTask = useCallback<Store['toggleTask']>(
    (id) => {
      const cur = stateRef.current;
      const t = cur.tasks.find((x) => x.id === id);
      if (!t) return;
      const me = nameFor(cur.slot, cur.household);
      // A recurring task is never finished, only handled for now: ticking it
      // off moves it to its next date. Closing it would leave the list a
      // graveyard of identical done rows, one per week, forever.
      if (!t.done && t.repeat) {
        const next = nextDate(t.date, t.repeat, todayISO());
        touchTask(id, { date: next, done: false, done_by: null });
        logActivity(`vinkte “${t.title}” af · staat weer op ${fmtShort(next)}`);
        return;
      }
      touchTask(id, { done: !t.done, done_by: !t.done ? me : null });
      if (!t.done) logActivity(`vinkte “${t.title}” af`);
    },
    [touchTask, logActivity],
  );

  const addTask = useCallback<Store['addTask']>(
    (input) => {
      const cur = stateRef.current;
      if (!cur.household) return;
      const task: Task = {
        id: crypto.randomUUID(),
        household_id: cur.household.id,
        title: input.title,
        cat: input.cat,
        who: input.who,
        party_id: input.party_id ?? null,
        date: input.date,
        time: input.time?.trim() || null,
        note: input.note?.trim() || null,
        amount: input.amount ?? null,
        vendor: input.vendor?.trim() || null,
        job_id: null,
        repeat: input.repeat ?? null,
        help: null,
        done: false,
        done_by: null,
        updated_at: new Date().toISOString(),
      };
      update((p) => ({ ...p, tasks: [...p.tasks, task], dirtyTasks: [...p.dirtyTasks, task.id] }));
      const forSlot = notifySlotFor(task.who);
      logActivity(
        forSlot ? describeAssignment('add', task.title, task.who) : `zette “${task.title}” op de lijst`,
        { forSlot, taskId: task.id },
      );
      nudge();
    },
    [update, nudge, logActivity, notifySlotFor, describeAssignment],
  );

  /**
   * Handing an existing task to the other person is the same news as creating
   * one for them, so it notifies the same way. Every other edit stays quiet.
   */
  const reassignTask = useCallback(
    (id: string, who: Who) => {
      const cur = stateRef.current;
      const t = cur.tasks.find((x) => x.id === id);
      if (!t || t.who === who) return;
      touchTask(id, { who });
      const forSlot = notifySlotFor(who);
      if (forSlot) {
        logActivity(describeAssignment('give', t.title, who), { forSlot, taskId: id });
      }
    },
    [touchTask, logActivity, notifySlotFor, describeAssignment],
  );

  /**
   * Take files off a picker, shrink photos, stash the bytes locally and queue
   * the upload. Returns a message when something was refused, so the sheet can
   * say so instead of silently dropping a file.
   */
  const addAttachments = useCallback<Store['addAttachments']>(
    async (taskId, files) => {
      const cur = stateRef.current;
      if (!cur.household) return null;
      const rejected: string[] = [];
      const added: Attachment[] = [];

      for (const file of files) {
        let blob: Blob = file;
        try {
          blob = await shrinkImage(file);
        } catch {
          /* keep the original if shrinking fails */
        }
        if (blob.size > MAX_BYTES) {
          rejected.push(file.name);
          continue;
        }
        const id = crypto.randomUUID();
        try {
          await putBlob(id, blob);
        } catch {
          rejected.push(file.name);
          continue;
        }
        added.push({
          id,
          household_id: cur.household.id,
          task_id: taskId,
          name: file.name || 'bijlage',
          mime: blob.type || file.type || null,
          size: blob.size,
          path: null,
          uploaded_by: nameFor(cur.slot, cur.household),
          created_at: new Date().toISOString(),
        });
      }

      if (added.length) {
        update((p) => ({
          ...p,
          attachments: [...p.attachments, ...added],
          pendingUploads: [...p.pendingUploads, ...added.map((a) => a.id)],
        }));
        const task = cur.tasks.find((t) => t.id === taskId);
        if (task) {
          logActivity(
            added.length === 1
              ? `voegde een bijlage toe aan “${task.title}”`
              : `voegde ${added.length} bijlagen toe aan “${task.title}”`,
          );
        }
        nudge();
      }

      if (!rejected.length) return null;
      return rejected.length === 1
        ? `“${rejected[0]}” is te groot (max 12 MB).`
        : `${rejected.length} bestanden waren te groot (max 12 MB).`;
    },
    [update, nudge, logActivity],
  );

  const deleteAttachment = useCallback<Store['deleteAttachment']>(
    (id) => {
      const att = stateRef.current.attachments.find((a) => a.id === id);
      update((p) => ({
        ...p,
        attachments: p.attachments.filter((a) => a.id !== id),
        pendingUploads: p.pendingUploads.filter((x) => x !== id),
      }));
      void deleteBlob(id);
      if (supabase && att) {
        if (att.path) void supabase.storage.from('bijlagen').remove([att.path]);
        void supabase.from('attachments').delete().eq('id', id);
      }
    },
    [update],
  );

  /** A URL the browser can render: the local copy if we have it, else a signed link. */
  const attachmentUrl = useCallback<Store['attachmentUrl']>(async (id) => {
    const local = await getBlob(id);
    if (local) return URL.createObjectURL(local);
    const att = stateRef.current.attachments.find((a) => a.id === id);
    if (!att?.path || !supabase) return null;
    const { data } = await supabase.storage.from('bijlagen').createSignedUrl(att.path, 3600);
    return data?.signedUrl ?? null;
  }, []);

  const deleteTask = useCallback<Store['deleteTask']>(
    (id) => {
      const doomed = stateRef.current.attachments.filter((a) => a.task_id === id);
      update((p) => ({
        ...p,
        tasks: p.tasks.filter((t) => t.id !== id),
        attachments: p.attachments.filter((a) => a.task_id !== id),
        dirtyTasks: p.dirtyTasks.filter((x) => x !== id),
        pendingUploads: p.pendingUploads.filter((x) => !doomed.some((a) => a.id === x)),
        deletedTasks: [...p.deletedTasks, id],
      }));
      // the attachments rows cascade with the task; the stored bytes do not
      for (const a of doomed) void deleteBlob(a.id);
      const paths = doomed.map((a) => a.path).filter((p): p is string => !!p);
      if (supabase && paths.length) void supabase.storage.from('bijlagen').remove(paths);
      nudge();
    },
    [update, nudge],
  );

  /** Wipe every task, party and attachment — used to clear the seeded example plan. */
  const clearAllData = useCallback<Store['clearAllData']>(() => {
    const cur = stateRef.current;
    for (const a of cur.attachments) void deleteBlob(a.id);
    const paths = cur.attachments.map((a) => a.path).filter((p): p is string => !!p);
    if (supabase && paths.length) void supabase.storage.from('bijlagen').remove(paths);

    update((p) => ({
      ...p,
      tasks: [],
      parties: [],
      attachments: [],
      picks: {},
      reserved: {},
      dirtyTasks: [],
      dirtyParties: [],
      dirtyPicks: [],
      pendingUploads: [],
      deletedTasks: [...new Set([...p.deletedTasks, ...p.tasks.map((t) => t.id)])],
      deletedParties: [...new Set([...p.deletedParties, ...p.parties.map((x) => x.id)])],
    }));
    logActivity('wiste het voorbeeldplan leeg');
    nudge();
  }, [update, nudge, logActivity]);

  const addParty = useCallback<Store['addParty']>(
    (input) => {
      const cur = stateRef.current;
      if (!cur.household) return null;
      const party: Party = {
        id: crypto.randomUUID(),
        household_id: cur.household.id,
        name: input.name.trim(),
        kind: input.kind,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        note: input.note?.trim() || null,
        created_at: new Date().toISOString(),
      };
      update((p) => ({
        ...p,
        parties: [...p.parties, party],
        dirtyParties: [...p.dirtyParties, party.id],
      }));
      nudge();
      return party.id;
    },
    [update, nudge],
  );

  const patchParty = useCallback<Store['patchParty']>(
    (id, patch) => {
      update((p) => ({
        ...p,
        parties: p.parties.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        dirtyParties: p.dirtyParties.includes(id) ? p.dirtyParties : [...p.dirtyParties, id],
      }));
      nudge();
    },
    [update, nudge],
  );

  /** Removing a party leaves its tasks in place — they just lose their executor. */
  const deleteParty = useCallback<Store['deleteParty']>(
    (id) => {
      const orphaned = stateRef.current.tasks.filter((t) => t.party_id === id).map((t) => t.id);
      update((p) => ({
        ...p,
        parties: p.parties.filter((x) => x.id !== id),
        tasks: p.tasks.map((t) => (t.party_id === id ? { ...t, party_id: null } : t)),
        dirtyParties: p.dirtyParties.filter((x) => x !== id),
        dirtyTasks: [...new Set([...p.dirtyTasks, ...orphaned])],
        deletedParties: [...p.deletedParties, id],
      }));
      nudge();
    },
    [update, nudge],
  );

  const togglePick = useCallback<Store['togglePick']>(
    (key) => {
      update((p) => ({
        ...p,
        picks: { ...p.picks, [key]: !p.picks[key] },
        dirtyPicks: p.dirtyPicks.includes(key) ? p.dirtyPicks : [...p.dirtyPicks, key],
      }));
      nudge();
    },
    [update, nudge],
  );

  const reserveJob = useCallback<Store['reserveJob']>(
    (jobId) => {
      const cur = stateRef.current;
      if (!cur.household) return;
      const me = nameFor(cur.slot, cur.household);
      update((p) => ({ ...p, reserved: { ...p.reserved, [jobId]: me } }));
      if (supabase) {
        void supabase
          .from('job_reservations')
          .upsert({ household_id: cur.household.id, job_id: jobId, reserved_by: me });
      }
    },
    [update],
  );

  const regenerateJoinCode = useCallback<Store['regenerateJoinCode']>(async () => {
    const cur = stateRef.current;
    if (!cur.household) throw new Error('Geen plan om een code voor te maken.');
    const join_code = makeJoinCode();
    if (supabase) {
      const { error } = await supabase
        .from('households')
        .update({ join_code })
        .eq('id', cur.household.id);
      if (error) throw new Error(error.message);
    }
    update((p) => (p.household ? { ...p, household: { ...p.household, join_code } } : p));
    return join_code;
  }, [update]);

  const markNotificationsRead = useCallback(() => {
    update((p) => ({ ...p, readActivityAt: new Date().toISOString() }));
  }, [update]);

  const setHideCountdown = useCallback<Store['setHideCountdown']>(
    (v) => {
      update((p) => ({ ...p, hideCountdown: v }));
    },
    [update],
  );

  const updateHousehold = useCallback<Store['updateHousehold']>(
    (patch) => {
      const cur = stateRef.current;
      if (!cur.household) return;
      const next = { ...cur.household, ...patch };
      update((p) => ({ ...p, household: next }));
      if (supabase) void supabase.from('households').update(patch).eq('id', next.id);
    },
    [update],
  );

  /** Log out but keep the plan cached — logging back in picks it straight up. */
  const signOut = useCallback(async () => {
    await authSignOut();
    setSession(null);
    setStatus(syncEnabled ? 'local' : 'local');
  }, []);

  /** Detach this device from the plan entirely: local cache gone, session gone. */
  const leave = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    void clearBlobs();
    void authSignOut();
    setSession(null);
    setS(EMPTY);
    setStatus(syncEnabled ? 'connecting' : 'local');
  }, []);

  /**
   * Permanently delete this household — cascades to members, tasks, parties,
   * picks, reservations, activity and attachment rows server-side. Stays
   * logged in so a new plan (e.g. via the AI wizard) can start right away.
   */
  const deleteHousehold = useCallback(async () => {
    const cur = stateRef.current;
    if (!cur.household) return;
    if (supabase && session) {
      const { error } = await supabase.from('households').delete().eq('id', cur.household.id);
      if (error) throw new Error(error.message);
    }
    localStorage.removeItem(STORAGE_KEY);
    void clearBlobs();
    setS(EMPTY);
    setStatus(syncEnabled ? 'connecting' : 'local');
  }, [session]);

  const value = useMemo<Store>(() => {
    const meName = nameFor(s.slot, s.household);
    const partnerName = nameFor(s.slot === 'a' ? 'b' : 'a', s.household);
    // Addressed to me, and newer than the last time I opened the list. The
    // activity feed itself is capped at 20 rows, so this is bounded with it.
    const notifications = s.activity
      .filter((e) => e.for_slot === s.slot && e.created_at > s.readActivityAt)
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    return {
      ...s,
      status,
      ready,
      authChecked,
      session,
      meName,
      partnerName,
      createHousehold,
      clearAllData,
      joinHousehold,
      signOut,
      toggleTask,
      patchTask: touchTask,
      addTask,
      deleteTask,
      addAttachments,
      deleteAttachment,
      attachmentUrl,
      addParty,
      patchParty,
      deleteParty,
      togglePick,
      reserveJob,
      updateHousehold,
      regenerateJoinCode,
      reassignTask,
      notifications,
      markNotificationsRead,
      setHideCountdown,
      leave,
      deleteHousehold,
    };
  }, [
    s,
    status,
    ready,
    authChecked,
    session,
    createHousehold,
    clearAllData,
    joinHousehold,
    signOut,
    toggleTask,
    touchTask,
    addTask,
    deleteTask,
    addAttachments,
    deleteAttachment,
    attachmentUrl,
    addParty,
    patchParty,
    deleteParty,
    togglePick,
    reserveJob,
    updateHousehold,
    regenerateJoinCode,
    reassignTask,
    markNotificationsRead,
    setHideCountdown,
    leave,
    deleteHousehold,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** Convenience: today, recomputed when the app is re-opened. */
export function useToday(): string {
  const [t, setT] = useState(todayISO);
  useEffect(() => {
    const check = () => setT(todayISO());
    const id = window.setInterval(check, 60000);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return t;
}
