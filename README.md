# Moov.nl

The Verhuisplan design prototype, rebuilt as a real app you and your partner can both use:
a shared moving plan with tasks, a timeline, DIY jobs with tool rental/purchase lists, and
invoices — live-synced between two phones.

It is a **PWA**, not a native iOS app. You add it to the iPhone home screen and it opens
full-screen with its own icon, no Safari chrome. See [Why not native](#why-not-a-native-ios-app).

---

## What's here

```
moov/
  src/
    App.tsx              shell: header, tabs, sheet routing
    store.tsx            state, local persistence, Supabase sync engine
    jobs.ts              the 5 DIY jobs and their tool lists (reference data)
    theme.ts             design tokens, lifted from the prototype
    screens/             AuthGate · Onboarding · Today · Timeline · List · Jobs · Money
    components/          sheets (task, job, party, settings), attachments, tab bar
    lib/                 dates, derived display props, plan maths, supabase client
  supabase/schema.sql    tables, row-level security, join-by-code function
  public/                icons, manifest, service worker
```

---

## 1. Run it locally

```bash
cd moov && npm install && npm run dev
```

Open http://localhost:5173. It works immediately — the plan is stored on that one device.
Everything below is about making two devices share one plan.

A new plan is always **empty**. Nothing is ever pre-filled: every task, invoice and party is
either typed in by hand or produced by the AI wizard from your own answers.

---

## 2. Set up the database (~5 minutes)

You need a free Supabase project. I can't create the account for you — these steps are yours.

1. Go to [supabase.com](https://supabase.com), create a project (free tier, region Frankfurt
   or Amsterdam).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   That creates the tables, locks them down with row-level security, and enables realtime.
   Re-running it later is safe.
3. **Authentication → Sign In / Providers → Email → enabled** (it is by default). Leave
   *Anonymous sign-ins* **off** — the app doesn't use them.
4. **Turn self-signup off:** *Authentication → Sign In / Providers → Email → Allow new users to
   sign up* → **off**. Only accounts you create by hand can then get in.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
6. In `moov/`, copy `.env.example` to `.env.local` and paste both values in.
7. Restart `npm run dev`.

A green dot appears next to `MOOV.NL` in the header when it's syncing.

### Giving someone access

There is no sign-up screen — you hand out accounts:

**Authentication → Users → Add user → Create new user.** Fill in their email address and a
password, tick **Auto Confirm User**, and pass those two on. That's it: they open the app, log
in, and either start their own plan or join yours with a code. Every account only ever sees the
plans it is a member of; row-level security in the database enforces that, not the UI.

Password resets go the same way — **Users → ⋯ → Reset password** — or just set a new one.

> **Attachments:** the schema also creates the private `bijlagen` storage bucket and its access
> rules. Nothing to click in the dashboard — running the SQL is enough.

> If you already created a plan before doing this, it gets pushed up automatically the first
> time you log in — you don't lose anything.

---

## Vercel or Supabase?

Both — they don't overlap. **Vercel hosts the app** (the HTML, JS and icons that land on your
phone). **Supabase is the backend** the app talks to: Postgres, login, file storage, and the
realtime push that makes a tick on one phone appear on the other. Vercel serves static files; it
has no database of its own in this setup.

You *could* replace Supabase with Vercel's marketplace Postgres (Neon) plus Vercel Blob, but then
login, row-level security, signed file URLs and live sync all become code you write and maintain.
That's the bulk of what this app leans on, so it isn't a saving. The current split is the cheap
path: Vercel free tier + Supabase free tier, €0 for two people.

## 3. Deploy it

### GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`. Once the repo
exists on GitHub:

1. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions → New repository secret**, twice:
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
3. Push to `main`. The Actions tab shows the deploy; the URL lands in Settings → Pages.

The workflow reads the site's base path from `actions/configure-pages`, so it works whether the
site is at `<user>.github.io/<repo>/` or on a custom domain — no config to edit either way.

Two things to know:

- **Pages from a private repo needs GitHub Pro.** On a free account the repo has to be public
  for Pages to serve it.
- **The anon key ends up in the published JavaScript.** That is how Supabase is designed to
  work: the anon key identifies the project, and row-level security is what actually protects
  the data — which is why the schema locks every table to household membership. Never put the
  *service_role* key in this repo; it bypasses RLS entirely.

### Vercel

Still the smoother option (real SPA rewrites, env vars in the UI, easier custom domain):

```bash
npm i -g vercel && cd moov && vercel
```

Add the same two environment variables in the Vercel project settings, then redeploy.
`vercel.json` already sets the right headers. Netlify and Cloudflare Pages work the same way —
build command `npm run build`, output `dist`.

If you own the domain **moov.nl**, point it at whichever deployment you keep.

### Checking the Pages build locally

Pages serves from a subpath, which is exactly where PWA paths tend to break. To see the real
thing before pushing:

```bash
npm run preview:pages
```

That builds with `VITE_BASE=/Moov/` and serves it at http://localhost:4173/Moov/.

---

## 4. Get it onto both phones

1. Open the deployed URL in **Safari** on your iPhone.
2. Log in with the email address and password you were given. Once per phone — the session is
   stored on the device.
3. Share button → **Add to Home Screen**.
4. It now behaves like an app: own icon, full screen, no address bar, works offline.

To bring your partner in, send them the plan's **6-character code**: **Settings** (tap the two
avatars, top right) → **Uitnodiging delen**. They open the same URL, log in with their own
account, tap *"Ik heb een code van mijn partner"*, and enter the code. Anything either of you
ticks shows up on the other phone within a second.

The code is the key, so treat it like one. Two knobs in Settings if you need them:

- **Nieuwe code maken** mints a fresh code and kills the old one on the spot. Whoever already
  joined stays in.
- **Vastzetten op één e-mailadres** is optional belt-and-braces: fill it in and the code only
  works for that one account. Leave it empty and the code alone is enough.

---

## Two things worth explaining

### Owner vs executor

Every task has **two** independent assignments, because they answer different questions:

- **Wie doet dit** (`tasks.who`) — you, your partner, or samen. Who is on the hook for it.
- **Uitvoerder** (`tasks.party_id`) — an optional third party who actually carries out the work:
  the builder, the electrician, the kitchen showroom, the tool rental depot.

You can own "Extra groepen laten trekken" while the electrician does it. Invoices carry the same
link, so **Geld → Partijen** rolls every task and euro up per party: what they're doing, what's
been paid, what's still open. Parties are created as you go, from the task sheet.

Deleting a party leaves its tasks alone — they just lose their executor.

### Notifications stay inside the app

Put a task on your partner's plate — creating it for them, handing an existing one over, or
marking it *samen* — and a badge appears on the bell in their header. Tapping it opens the task.
A task you give **yourself** notifies nobody.

There is no email and no push: a notification is an `activity` row carrying a `for_slot`, synced
over the same realtime channel as everything else, so it lands on the other phone within a second
of them having the app open. Nothing leaves the app, and nothing reaches them when it's closed —
that would need web-push keys or the native shell (see [Not built yet](#not-built-yet)).

"Read" is tracked per device, like a phone's own notification tray: clearing the badge on your
phone doesn't clear it on your tablet.

### Attachments

Photos and PDFs hang off a task (**Bijlagen** in the task sheet): a shot of the meter cupboard,
a quote, an invoice. Photos are downscaled to 2000px before upload — a 4 MB iPhone shot becomes
about 400 kB with no visible loss on a phone.

Files land in the device's IndexedDB **first** and upload when there is signal, so photographing
an empty house with no reception works fine; an amber dot on the thumbnail means "still queued".
The bytes live in a private Supabase Storage bucket guarded by the same membership check as the
rest of your data, and are read through short-lived signed URLs — nothing is publicly served.

## How it behaves

- **Offline-first.** Every change is written to the device first and pushed when there's signal.
  Empty house, no wifi, lift, basement — it keeps working, and catches up later.
- **Last write wins.** Two people editing the same task at the same second is the only case
  where one edit is dropped. For a couple planning a move, that's the right trade.
- **Nothing is invented for you.** A plan starts empty. Tasks arrive one of two ways: you type
  them in, or the AI wizard writes them from the answers you gave it about your move. There is
  no example plan and no placeholder content in the database.
- **The AI wizard is opt-in and server-side.** It runs in the `generate-plan` Edge Function so
  the API key never reaches the browser, and it is told not to invent company names or phone
  numbers.
- **Jobs are reference data.** The 5 DIY jobs and their tool lists live in `jobs.ts`, identical
  for everyone; only your ticks and reservations are per-household.
- **One party, both purposes.** The contractor you book for a job is the contractor you pay.
  Payments pick from the same list as everything else, so every invoice rolls up under a real
  party in **Geld → Partijen** instead of a name typed twice.

### Security

**Login** is email + password against Supabase Auth. There is no self-signup: accounts exist only
because you created them in the dashboard, so the login screen is a closed door rather than a
front desk.

**Joining a plan** goes through `join_household()`, a `security definer` function that is the only
way into a household you aren't already in. It will only ever add the *calling* user, only into a
free slot, and only on the right join code — six characters from a 29-symbol alphabet that leaves
out vowels and lookalikes, so roughly 594 million combinations, over a rate-limited API. Knowing a
household's uuid gets you nothing: direct inserts into `members` are only allowed into a household
with no members yet, which is the moment a plan is created.

If you want the code narrowed to one person, fill in **Vastzetten op één e-mailadres** in Settings
and the function additionally demands that the caller's verified address matches. And if a code
does leak, **Nieuwe code maken** invalidates it immediately.

**Everything else** is row-level security: you can only read or write a household you're a member
of, membership can only ever be granted to the calling user, and two members per plan is enforced
by a unique index. Creating a plan requires a token with an email claim, so a stray anonymous
session can't do it.

Never put the *service_role* key anywhere in this repo or in a deployment env var that the client
build can see — it bypasses RLS entirely.

---

## Why not a native iOS app

The project already had an Xcode wrapper (`xcode/` in the Claude Design project) that put the
prototype in a WKWebView. It runs, but it can't be shared: without a paid Apple Developer
account (€99/year) an app you sideload onto your partner's iPhone expires after 7 days, and
TestFlight needs that same account plus a review round for every build.

A PWA gets you an icon on both home screens today, updates when you deploy, and costs nothing.
If you later want push notifications and App Store presence, this same React code drops into
Capacitor with the native shell around it — nothing here has to be thrown away.

## Not built yet

- Push notifications that reach a **closed** app ("aannemer komt over een uur") — needs web-push
  keys or the native shell. In-app notifications for task assignments do work; see above.
- More than two people per plan (the database enforces two on purpose — `tasks.who` is
  `a` / `b` / `samen`, so a third person has nowhere to sit).
