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
import { todayISO } from './lib/dates';
import { clearBlobs, deleteBlob, getBlob, putBlob } from './lib/blobs';
import { MAX_BYTES, shrinkImage, storagePath } from './lib/images';
import type { ActivityEntry, Attachment, Household, Party, PartyKind, Task, Who } from './types';
import type { CatKey } from './theme';

const STORAGE_KEY = 'moov:v1';

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
  deletedTasks: [],
  deletedParties: [],
  pendingUploads: [],
  readActivityAt: new Date(0).toISOString(),
};

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<Persisted>) };
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
    patch: Partial<Pick<Household, 'address' | 'move_date' | 'name_a' | 'name_b' | 'invited_email'>>,
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
  const flush = useCallback(async () => {
    if (!supabase || pushing.current) return;
    const cur = stateRef.current;
    if (!cur.household) return;
    if (
      !cur.dirtyTasks.length &&
      !cur.dirtyParties.length &&
      !cur.dirtyPicks.length &&
      !cur.deletedTasks.length &&
      !cur.deletedParties.length &&
      !cur.pendingUploads.length
    )
      return;

    pushing.current = true;
    try {
      const sentTasks: string[] = [];
      const sentParties: string[] = [];
      const sentPicks: string[] = [];
      const sentDeletes: string[] = [];
      const sentPartyDeletes: string[] = [];

      // parties first: tasks reference them by foreign key
      const partyRows = cur.parties.filter((x) => cur.dirtyParties.includes(x.id));
      if (partyRows.length) {
        const { error } = await supabase.from('parties').upsert(partyRows);
        if (!error) sentParties.push(...partyRows.map((r) => r.id));
      }

      if (cur.deletedTasks.length) {
        const { error } = await supabase.from('tasks').delete().in('id', cur.deletedTasks);
        if (!error) sentDeletes.push(...cur.deletedTasks);
      }

      const rows = cur.tasks.filter((t) => cur.dirtyTasks.includes(t.id));
      if (rows.length) {
        const { error } = await supabase.from('tasks').upsert(rows);
        if (!error) sentTasks.push(...rows.map((r) => r.id));
      }

      if (cur.dirtyPicks.length) {
        const picks = cur.dirtyPicks.map((key) => ({
          household_id: cur.household!.id,
          key,
          picked: !!cur.picks[key],
          updated_at: new Date().toISOString(),
        }));
        const { error } = await supabase.from('job_picks').upsert(picks);
        if (!error) sentPicks.push(...cur.dirtyPicks);
      }

      // parties last on the way out: the task rows referencing them go first
      if (cur.deletedParties.length) {
        const { error } = await supabase.from('parties').delete().in('id', cur.deletedParties);
        if (!error) sentPartyDeletes.push(...cur.deletedParties);
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
        if (up.error) break; // no signal or no permission — try again next tick
        const row = await supabase.from('attachments').upsert({ ...att, path });
        if (row.error) break;
        uploaded.push(attId);
        update((p) => ({
          ...p,
          attachments: p.attachments.map((a) => (a.id === attId ? { ...a, path } : a)),
        }));
      }

      const ok =
        sentTasks.length ||
        sentParties.length ||
        sentPicks.length ||
        sentDeletes.length ||
        sentPartyDeletes.length ||
        uploaded.length;
      if (ok) {
        update((p) => ({
          ...p,
          dirtyTasks: p.dirtyTasks.filter((id) => !sentTasks.includes(id)),
          dirtyParties: p.dirtyParties.filter((id) => !sentParties.includes(id)),
          dirtyPicks: p.dirtyPicks.filter((k) => !sentPicks.includes(k)),
          deletedTasks: p.deletedTasks.filter((id) => !sentDeletes.includes(id)),
          deletedParties: p.deletedParties.filter((id) => !sentPartyDeletes.includes(id)),
          pendingUploads: p.pendingUploads.filter((id) => !uploaded.includes(id)),
        }));
      }
      setStatus('synced');
    } catch {
      setStatus('offline');
    } finally {
      pushing.current = false;
    }
  }, [update]);

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
          merged.push(dirty.has(row.id) && local ? local : { ...row, amount: row.amount === null ? null : Number(row.amount) });
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
          household: (h.data as Household) ?? prev.household,
          tasks: merged,
          parties: mergedParties,
          picks,
          reserved,
          attachments,
          activity: ((a.data ?? []) as ActivityEntry[]).length
            ? (a.data as ActivityEntry[])
            : prev.activity,
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
      display_name: cur.slot === 'a' ? h.name_a : h.name_b,
      email: sess.email,
    });
    if (cur.parties.length) await supabase.from('parties').upsert(cur.parties);
    if (cur.tasks.length) await supabase.from('tasks').upsert(cur.tasks);
    const picks = Object.entries(cur.picks).map(([key, picked]) => ({
      household_id: h.id,
      key,
      picked,
    }));
    if (picks.length) await supabase.from('job_picks').upsert(picks);
    update((p) => ({ ...p, dirtyTasks: [], dirtyParties: [], dirtyPicks: [] }));
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

        channel = supabase!
          .channel(`household:${hid}`)
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', filter: `household_id=eq.${hid}` },
            () => void pull(hid),
          )
          .subscribe((st) => {
            if (st === 'SUBSCRIBED') setStatus('synced');
            if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') setStatus('offline');
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

  // Retry unsent changes when the tab wakes up or the network returns.
  useEffect(() => {
    if (!syncEnabled) return;
    const kick = () => void flush();
    const timer = window.setInterval(kick, 20000);
    window.addEventListener('online', kick);
    document.addEventListener('visibilitychange', kick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('online', kick);
      document.removeEventListener('visibilitychange', kick);
    };
  }, [flush]);

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
      const actor = cur.slot === 'a' ? cur.household.name_a : cur.household.name_b;
      const entry: ActivityEntry = {
        id: crypto.randomUUID(),
        household_id: cur.household.id,
        actor,
        text,
        created_at: new Date().toISOString(),
        for_slot: target?.forSlot ?? null,
        task_id: target?.taskId ?? null,
      };
      update((p) => ({ ...p, activity: [entry, ...p.activity].slice(0, 20) }));
      if (supabase) {
        void supabase.from('activity').insert({
          id: entry.id,
          household_id: entry.household_id,
          actor,
          text,
          for_slot: entry.for_slot,
          task_id: entry.task_id,
        });
      }
    },
    [update],
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
    const name = (who === 'a' ? h?.name_a : h?.name_b) || 'de ander';
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
      };
      // A plan is never pre-filled: it starts empty, or with exactly what the
      // AI wizard produced from the answers the user gave.
      const parties: Party[] = [];
      const tasks: Task[] = aiTasks ?? [];

      if (supabase && session) {
        const { error } = await supabase.from('households').insert(household);
        if (error) throw new Error(error.message);
        await supabase.from('members').insert({
          household_id: id,
          user_id: session.userId,
          slot: 'a',
          display_name: yourName,
          email: session.email,
        });
        await supabase.from('parties').insert(parties);
        await supabase.from('tasks').insert(tasks);
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
        dirtyTasks: supabase && session ? [] : tasks.map((t) => t.id),
        dirtyParties: supabase && session ? [] : parties.map((p) => p.id),
        dirtyPicks: [],
        deletedTasks: [],
        deletedParties: [],
      }));
    },
    [update, session],
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
      const me = cur.household
        ? cur.slot === 'a'
          ? cur.household.name_a
          : cur.household.name_b
        : 'Jij';
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
          uploaded_by: cur.slot === 'a' ? cur.household.name_a : cur.household.name_b,
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
      const me = cur.slot === 'a' ? cur.household.name_a : cur.household.name_b;
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
    const meName = s.household ? (s.slot === 'a' ? s.household.name_a : s.household.name_b) : 'Jij';
    const partnerName = s.household
      ? s.slot === 'a'
        ? s.household.name_b
        : s.household.name_a
      : 'Partner';
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
