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
    seed.ts              the 32-task starter plan + the 5 DIY jobs
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

---

## 2. Set up the database (~5 minutes)

You need a free Supabase project. I can't create the account for you — these steps are yours.

1. Go to [supabase.com](https://supabase.com), create a project (free tier, region Frankfurt
   or Amsterdam).
2. **SQL Editor → New query** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   That creates the tables, locks them down with row-level security, and enables realtime.
   Re-running it later is safe.
3. **Authentication → Sign In / Providers → Email → enabled** (it is by default).
   If you previously turned on *Anonymous sign-ins*, turn it back **off** — the app no longer
   uses it.
4. **Authentication → Emails → Templates.** Login codes are six digits, so the mail has to
   actually contain one. In **both** the *Magic Link* and the *Confirm signup* templates, add:

   ```html
   <p>Je code voor Moov.nl: <strong>{{ .Token }}</strong></p>
   ```

   Without this you'll get a clickable link instead of a code and the app can't verify it.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.
6. In `moov/`, copy `.env.example` to `.env.local` and paste both values in.
7. Restart `npm run dev`.

A green dot appears next to `MOOV.NL` in the header when it's syncing.

> **Email sending:** Supabase's built-in mailer is rate-limited to a handful of messages per
> hour and is meant for testing. That's usually fine here — you log in once per phone and the
> session persists — but if codes stop arriving, that's why. For something dependable, hook up
> a custom SMTP under **Project Settings → Authentication → SMTP Settings** (Resend, Postmark
> and Brevo all have free tiers).

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

That builds with `VITE_BASE=/moov/` and serves it at http://localhost:4173/moov/.

---

## 4. Get it onto both phones

1. Open the deployed URL in **Safari** on your iPhone.
2. Log in: type your email, read the six-digit code from your inbox, type it in. Once per phone —
   the session is stored on the device.
3. Share button → **Add to Home Screen**.
4. It now behaves like an app: own icon, full screen, no address bar, works offline.

To bring your partner in, you need **two** things to line up:

- When you create the plan, enter **their** email address ("E-mailadres van je partner"). You can
  change it later under Settings.
- Send them the 6-character code: **Settings** (tap the two avatars, top right) → **Uitnodiging
  delen**.

They open the same URL, log in with *that exact address*, tap *"Ik heb een code van mijn
partner"*, and enter the code. Anything either of you ticks shows up on the other phone within a
second.

---

## Two things worth explaining

### Owner vs executor

Every task has **two** independent assignments, because they answer different questions:

- **Wie doet dit** (`tasks.who`) — you, your partner, or samen. Who is on the hook for it.
- **Uitvoerder** (`tasks.party_id`) — an optional third party who actually carries out the work:
  the builder, the electrician, the kitchen showroom, the tool rental depot.

You can own "Extra groepen laten trekken" while Van Dijk Elektro does it. Invoices carry the same
link, so **Geld → Partijen** rolls every task and euro up per party: what they're doing, what's
been paid, what's still open. The starter plan ships with nine parties already wired to the
relevant tasks and invoices.

Deleting a party leaves its tasks alone — they just lose their executor.

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
- **The plan slides.** The 32 starter tasks are stored as offsets from moving day, so changing
  the moving date in Settings moves the whole plan with it. The nine starter parties come with
  it, already linked.
- **Jobs are reference data.** The 5 DIY jobs and their tool lists live in `seed.ts`, identical
  for everyone; only your ticks and reservations are per-household.

### Security

**Login** is passwordless: you prove you control an inbox by reading a six-digit code out of it.
There is no password to leak, reuse, or forget. Supabase expires the code after 10 minutes and
rate-limits requests.

**Joining a plan needs two independent things**, checked server-side in `join_household()`:

1. a session for the exact email address the plan owner invited, and
2. the 6-character plan code.

Knowing the code without the inbox gets you nothing; having the inbox without the code gets you
nothing. That's the "2FA" part — it's on the operation that actually matters, rather than on a
login that guards nothing on its own.

**Everything else** is row-level security: you can only read or write a household you're a member
of, membership can only ever be granted to the calling user, and two members per plan is enforced
by a unique index. Creating a plan requires an email-verified token, so a stray anonymous session
can't do it.

Worth knowing: this trusts your email provider. Anyone who can read your inbox can log in — same
as any "reset password by email" flow. If you want a second factor on the *login* itself, Supabase
supports TOTP (authenticator app) and it would slot in beside this; say the word.

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

- Push notifications ("aannemer komt over een uur") — needs the native shell or web-push keys.
- More than two people per plan (the database enforces two on purpose).
