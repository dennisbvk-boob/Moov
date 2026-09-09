import type { CatKey } from './theme';

/** Who a task belongs to. 'a' = the person who created the plan, 'b' = the partner. */
export type Who = 'a' | 'b' | 'samen';

/** Loose grouping for a third party, used for the little coloured label. */
export type PartyKind =
  | 'aannemer'
  | 'installateur'
  | 'leverancier'
  | 'verhuur'
  | 'verhuizer'
  | 'dienst'
  | 'overig';

/**
 * A third party: the builder, the electrician, the kitchen showroom, the tool
 * rental depot. Separate from `who` — you can own a task while someone else
 * actually carries it out.
 */
export interface Party {
  id: string;
  household_id: string;
  name: string;
  kind: PartyKind;
  phone: string | null;
  email: string | null;
  note: string | null;
  created_at: string;
}

/** How often a task comes back after you tick it off. */
export type RepeatUnit = 'dag' | 'week' | 'maand' | 'jaar';

export interface Repeat {
  unit: RepeatUnit;
  /** Every n units — 1 for "elke week", 2 for "elke 2 weken". */
  interval: number;
}

/** One thing you need in hand before the job starts. */
export interface HelpMaterial {
  name: string;
  mode: 'HUUR' | 'KOOP' | 'IN HUIS';
  /** Why this one is on the list, in a few words. */
  why: string | null;
}

/**
 * What was looked up about how to carry a task out. Stored on the task itself
 * rather than fetched each time: it survives offline, both phones see the same
 * answer, and a lookup that costs money happens once instead of on every open.
 */
export interface TaskHelp {
  summary: string;
  /** The actual procedure, in the order you do it. */
  steps: string[];
  materials: HelpMaterial[];
  /** Mistakes worth knowing about before you start. */
  warnings: string[];
  minutes: number | null;
  /** Where it came from, so instructions about your own house are checkable. */
  sources: { title: string; url: string }[];
  created_at: string;
}

export interface Task {
  id: string;
  household_id: string;
  title: string;
  cat: CatKey;
  who: Who;
  /** Who actually does the work, when that's not one of you two. */
  party_id: string | null;
  /** ISO date, YYYY-MM-DD */
  date: string;
  /** HH:MM, optional */
  time: string | null;
  note: string | null;
  /** euros, only meaningful for cat === 'betaling' */
  amount: number | null;
  vendor: string | null;
  /** links a task to a DIY job from the catalogue */
  job_id: string | null;
  /** Null for a one-off. Set, and ticking it off moves it to the next date. */
  repeat: Repeat | null;
  /** Looked-up instructions for this task, once someone has asked for them. */
  help: TaskHelp | null;
  done: boolean;
  done_by: string | null;
  updated_at: string;
}

export interface Household {
  id: string;
  address: string;
  move_date: string;
  join_code: string;
  name_a: string;
  name_b: string;
  /**
   * Optional extra lock. Null (the default) means the join code alone lets the
   * second person in; set to an address and only that account may join.
   */
  invited_email: string | null;
  /**
   * Secret in the calendar feed URL. Null until someone turns the feed on;
   * regenerating it makes every previously shared URL stop working.
   */
  calendar_token: string | null;
}

export interface Material {
  name: string;
  mode: 'HUUR' | 'KOOP' | 'IN HUIS';
  price: string;
  src: string;
}

export interface Job {
  id: string;
  title: string;
  where: string;
  level: 'Makkelijk' | 'Gemiddeld' | 'Pittig';
  hours: string;
  depot: string;
  depotLine: string;
  note: string;
  mats: Material[];
}

export interface Attachment {
  id: string;
  household_id: string;
  task_id: string;
  name: string;
  mime: string | null;
  size: number | null;
  /**
   * Location in Supabase Storage, or null while the file still only exists in
   * this device's IndexedDB queue (offline, or no database configured).
   */
  path: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export interface ActivityEntry {
  id: string;
  household_id: string;
  text: string;
  actor: string;
  created_at: string;
  /**
   * The person this entry is addressed to, when it is addressed to anyone.
   * Null is a plain feed entry. Both members read every row either way — this
   * is what turns one of them into a notification for one of you.
   */
  for_slot: 'a' | 'b' | null;
  /** The task the entry is about, so a notification can open it. */
  task_id: string | null;
}

export type Tab = 'home' | 'timeline' | 'list' | 'jobs' | 'money';
