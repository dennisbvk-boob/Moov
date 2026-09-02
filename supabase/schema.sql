-- Moov.nl — database schema
-- Paste this whole file into Supabase → SQL Editor → Run.
-- Safe to re-run: everything is created with "if not exists" / "or replace".

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table if not exists households (
  id         uuid primary key default gen_random_uuid(),
  address    text not null,
  move_date  date not null,
  join_code  text not null unique,
  name_a     text not null,
  name_b     text not null default 'Partner',
  created_at timestamptz not null default now()
);

-- Optional extra lock: when set, only this address may join, on top of the
-- join code. Left null (the default) the join code alone is enough, which is
-- how people normally share a plan — read the six characters out loud and the
-- other person is in.
alter table households add column if not exists invited_email text;

create table if not exists members (
  household_id uuid not null references households(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  slot         text not null check (slot in ('a', 'b')),
  display_name text not null,
  created_at   timestamptz not null default now(),
  primary key (household_id, user_id)
);
create unique index if not exists members_slot_unique on members (household_id, slot);
alter table members add column if not exists email text;

-- Third parties: the builder, the electrician, the kitchen showroom, the tool
-- depot. A task is owned by one of you two (`tasks.who`) but may be carried out
-- by one of these (`tasks.party_id`), and invoices roll up per party.
create table if not exists parties (
  id           uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  kind         text not null default 'overig'
               check (kind in ('aannemer','installateur','leverancier','verhuur','verhuizer','dienst','overig')),
  phone        text,
  email        text,
  note         text,
  created_at   timestamptz not null default now()
);
create index if not exists parties_household_idx on parties (household_id);

create table if not exists tasks (
  id           uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  title        text not null,
  cat          text not null check (cat in ('afspraak', 'klus', 'admin', 'inpakken', 'betaling')),
  who          text not null check (who in ('a', 'b', 'samen')),
  date         date not null,
  time         text,
  note         text,
  amount       numeric,
  vendor       text,
  job_id       text,
  done         boolean not null default false,
  done_by      text,
  updated_at   timestamptz not null default now()
);
create index if not exists tasks_household_idx on tasks (household_id, date);

-- who actually carries the task out, when that is not one of you two
alter table tasks add column if not exists party_id uuid references parties(id) on delete set null;
create index if not exists tasks_party_idx on tasks (party_id);

-- One row per material you ticked on a DIY job. key = '<jobId>-<materialIndex>'.
create table if not exists job_picks (
  household_id uuid not null references households(id) on delete cascade,
  key          text not null,
  picked       boolean not null default true,
  updated_at   timestamptz not null default now(),
  primary key (household_id, key)
);

create table if not exists job_reservations (
  household_id uuid not null references households(id) on delete cascade,
  job_id       text not null,
  reserved_by  text,
  created_at   timestamptz not null default now(),
  primary key (household_id, job_id)
);

-- Files hanging off a task: a photo of the meter cupboard, a quote, an invoice.
-- The bytes live in Storage; this table is the index. `path` stays null while a
-- file is still queued on someone's phone and hasn't been uploaded yet.
create table if not exists attachments (
  id           uuid primary key,
  household_id uuid not null references households(id) on delete cascade,
  task_id      uuid not null references tasks(id) on delete cascade,
  name         text not null,
  mime         text,
  size         integer,
  path         text,
  uploaded_by  text,
  created_at   timestamptz not null default now()
);
create index if not exists attachments_task_idx on attachments (household_id, task_id);

create table if not exists activity (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  actor        text not null,
  text         text not null,
  created_at   timestamptz not null default now()
);
create index if not exists activity_household_idx on activity (household_id, created_at desc);

-- ─────────────────────────────────────────────────────────────
-- Row level security
-- ─────────────────────────────────────────────────────────────

-- security definer so the policy itself can read `members` without recursing
create or replace function is_member(h uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from members m
    where m.household_id = h and m.user_id = auth.uid()
  );
$$;

alter table households        enable row level security;
alter table members           enable row level security;
alter table tasks             enable row level security;
alter table job_picks         enable row level security;
alter table job_reservations  enable row level security;
alter table activity          enable row level security;
alter table attachments       enable row level security;
alter table parties           enable row level security;

drop policy if exists households_read   on households;
drop policy if exists households_insert on households;
drop policy if exists households_update on households;
drop policy if exists households_delete on households;
create policy households_read   on households for select using (is_member(id));
-- only an email-verified account may create a plan; a token without an email
-- claim (e.g. a leftover anonymous session) cannot
create policy households_insert on households for insert to authenticated
  with check (coalesce(auth.jwt() ->> 'email', '') <> '');
create policy households_update on households for update using (is_member(id)) with check (is_member(id));
-- any member can delete the whole plan to start over; cascades wipe members,
-- tasks, parties, picks, reservations, activity and attachments with it
create policy households_delete on households for delete using (is_member(id));

-- definer, like is_member(), so the policy can read `members` without recursing
create or replace function household_is_empty(h uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select not exists (select 1 from members m where m.household_id = h);
$$;

drop policy if exists members_read   on members;
drop policy if exists members_insert on members;
create policy members_read   on members for select using (is_member(household_id));
-- Adding yourself is only allowed to the *first* member of a household — i.e. the
-- person who just created it. Checking `user_id = auth.uid()` alone was not enough:
-- it constrained who you add but not which plan you add them to, so anyone who
-- learned a household's uuid could insert themselves into a free slot and become a
-- member, skipping join_household() and its invited-email check entirely. Every
-- later member goes through join_household(), where the code and the invited
-- address are both required.
create policy members_insert on members for insert to authenticated
  with check (user_id = auth.uid() and household_is_empty(household_id));

drop policy if exists tasks_all on tasks;
create policy tasks_all on tasks for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists job_picks_all on job_picks;
create policy job_picks_all on job_picks for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists job_res_all on job_reservations;
create policy job_res_all on job_reservations for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists activity_all on activity;
create policy activity_all on activity for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists attachments_all on attachments;
create policy attachments_all on attachments for all using (is_member(household_id)) with check (is_member(household_id));

drop policy if exists parties_all on parties;
create policy parties_all on parties for all using (is_member(household_id)) with check (is_member(household_id));

-- ─────────────────────────────────────────────────────────────
-- Storage for attachments
-- ─────────────────────────────────────────────────────────────
-- Private bucket. Files are keyed <household_id>/<task_id>/<uuid>.<ext>, so the
-- first path segment tells us which household a file belongs to and the same
-- is_member() check guards the bytes as guards the rows. Reads go through
-- short-lived signed URLs — nothing here is served publicly.

insert into storage.buckets (id, name, public, file_size_limit)
values ('bijlagen', 'bijlagen', false, 20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;

drop policy if exists bijlagen_read   on storage.objects;
drop policy if exists bijlagen_write  on storage.objects;
drop policy if exists bijlagen_delete on storage.objects;

-- the regex guard keeps a malformed key from blowing up the uuid cast
create policy bijlagen_read on storage.objects for select to authenticated
  using (
    bucket_id = 'bijlagen'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and is_member(((storage.foldername(name))[1])::uuid)
  );

create policy bijlagen_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bijlagen'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and is_member(((storage.foldername(name))[1])::uuid)
  );

create policy bijlagen_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'bijlagen'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and is_member(((storage.foldername(name))[1])::uuid)
  );

-- ─────────────────────────────────────────────────────────────
-- Joining a plan — with the join code
-- ─────────────────────────────────────────────────────────────
-- Runs as definer so a not-yet-member can look the household up by its code.
-- It can only ever add the *calling* user, into a free slot, and only via the
-- join code — a 6-character secret out of 29^6 (~594 million) that the plan
-- owner shares deliberately and can regenerate at any time from Instellingen.
-- The household uuid on its own still gets you nothing: this function is the
-- only way in, since members_insert only lets you seed an empty household.
--
-- If the owner filled in `invited_email`, that address is required as well.

create or replace function join_household(code text, display_name text)
returns households
language plpgsql
security definer
set search_path = public
as $$
declare
  h households;
  free_slot text;
  caller_email text;
begin
  if auth.uid() is null then
    raise exception 'NOT_SIGNED_IN';
  end if;

  caller_email := lower(trim(coalesce(auth.jwt() ->> 'email', '')));
  if caller_email = '' then
    raise exception 'NO_EMAIL';
  end if;

  select * into h from households where join_code = upper(trim(code));
  if not found then
    raise exception 'CODE_NOT_FOUND';
  end if;

  -- already a member? just hand back the household
  if exists (select 1 from members where household_id = h.id and user_id = auth.uid()) then
    return h;
  end if;

  -- only enforced when the owner opted into locking the plan to one address
  if coalesce(trim(h.invited_email), '') <> '' and lower(trim(h.invited_email)) <> caller_email then
    raise exception 'EMAIL_NOT_INVITED';
  end if;

  select s into free_slot
  from (values ('b'), ('a')) as t(s)
  where not exists (select 1 from members m where m.household_id = h.id and m.slot = t.s)
  limit 1;

  if free_slot is null then
    raise exception 'HOUSEHOLD_FULL';
  end if;

  insert into members (household_id, user_id, slot, display_name, email)
  values (h.id, auth.uid(), free_slot, display_name, caller_email);

  if free_slot = 'b' then
    update households set name_b = display_name where id = h.id returning * into h;
  else
    update households set name_a = display_name where id = h.id returning * into h;
  end if;

  return h;
end;
$$;

revoke all on function join_household(text, text) from public;
grant execute on function join_household(text, text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Realtime — so both phones update live
-- ─────────────────────────────────────────────────────────────

do $$
begin
  execute 'alter publication supabase_realtime add table tasks';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table job_picks';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table job_reservations';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table activity';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table attachments';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table parties';
exception when duplicate_object then null;
end $$;

do $$
begin
  execute 'alter publication supabase_realtime add table households';
exception when duplicate_object then null;
end $$;
