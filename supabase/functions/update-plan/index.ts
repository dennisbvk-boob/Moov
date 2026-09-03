// Supabase Edge Function: takes the current plan (tasks) plus a free-text
// request from the user, and asks the Gemini API for a set of edits — new
// tasks, patches to existing ones, and tasks to tick off. The API key lives
// only here (as an Edge Function secret) — it never reaches the browser
// bundle.
//
// Deploy: paste this file into Supabase Dashboard → Edge Functions →
// Create a function named "update-plan", then add the GEMINI_API_KEY
// secret under that same Edge Functions section (shared with generate-plan).
// Also turn off "Enforce JWT Verification" for this function — the code
// below already requires and validates a signed-in user itself, and the
// gateway-level check blocks the CORS preflight otherwise.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CATS = ['afspraak', 'klus', 'admin', 'inpakken', 'betaling'] as const;
const WHO = ['a', 'b', 'samen'] as const;

interface ExistingTask {
  id: string;
  title: string;
  cat: (typeof CATS)[number];
  who: (typeof WHO)[number];
  date: string; // YYYY-MM-DD
  done: boolean;
}

interface UpdatePlanInput {
  address: string;
  moveDate: string; // YYYY-MM-DD
  instruction: string;
  tasks: ExistingTask[];
}

interface AiTaskAdd {
  title: string;
  cat: (typeof CATS)[number];
  who: (typeof WHO)[number];
  offsetDays: number; // days from move day, negative = before
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
}

interface AiTaskUpdate {
  id: string;
  title?: string;
  cat?: (typeof CATS)[number];
  who?: (typeof WHO)[number];
  date?: string; // YYYY-MM-DD
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
}

interface AiPlanEdits {
  adds: AiTaskAdd[];
  updates: AiTaskUpdate[];
  completes: string[];
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Require a logged-in Supabase user — this function costs real money per call.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('NOT_SIGNED_IN');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error('NOT_SIGNED_IN');

    const input = (await req.json()) as UpdatePlanInput;
    if (!input.address || !input.moveDate) throw new Error('MISSING_FIELDS');
    if (!input.instruction?.trim()) throw new Error('MISSING_INSTRUCTION');
    const tasks = Array.isArray(input.tasks) ? input.tasks : [];

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('NOT_CONFIGURED');

    const prompt = buildPrompt(input, tasks);

    const res = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      },
    );
    if (!res.ok) throw new Error(`AI_REQUEST_FAILED: ${res.status}`);
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    if (!text) throw new Error('AI_BAD_RESPONSE');
    const parsed = JSON.parse(text) as Partial<AiPlanEdits>;

    // The model can only touch ids it was actually given — drop anything else.
    const knownIds = new Set(tasks.map((t) => t.id));
    const adds = (parsed.adds ?? []).filter(isValidAdd).slice(0, 30);
    const updates = (parsed.updates ?? [])
      .filter(isValidUpdate)
      .filter((u) => knownIds.has(u.id))
      .slice(0, tasks.length);
    const completes = (parsed.completes ?? [])
      .filter((id): id is string => typeof id === 'string' && knownIds.has(id))
      .slice(0, tasks.length);

    const edits: AiPlanEdits = { adds, updates, completes };
    return new Response(JSON.stringify(edits), {
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'UNKNOWN';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'content-type': 'application/json' },
    });
  }
});

function isValidAdd(t: unknown): t is AiTaskAdd {
  if (typeof t !== 'object' || t === null) return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.title === 'string' &&
    x.title.trim().length > 0 &&
    CATS.includes(x.cat as (typeof CATS)[number]) &&
    WHO.includes(x.who as (typeof WHO)[number]) &&
    typeof x.offsetDays === 'number' &&
    Number.isFinite(x.offsetDays)
  );
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidUpdate(t: unknown): t is AiTaskUpdate {
  if (typeof t !== 'object' || t === null) return false;
  const x = t as Record<string, unknown>;
  if (typeof x.id !== 'string' || !x.id) return false;
  if (x.cat !== undefined && !CATS.includes(x.cat as (typeof CATS)[number])) return false;
  if (x.who !== undefined && !WHO.includes(x.who as (typeof WHO)[number])) return false;
  if (x.date !== undefined && (typeof x.date !== 'string' || !DATE_RE.test(x.date))) return false;
  return true;
}

function buildPrompt(input: UpdatePlanInput, tasks: ExistingTask[]): string {
  const taskLines = tasks
    .map((t) => `- id=${t.id} | ${t.date} | ${t.cat} | ${t.who} | ${t.done ? 'AFGEROND' : 'open'} | ${t.title}`)
    .join('\n');

  return `Je onderhoudt een bestaande Nederlandse verhuisplanning voor Moov.nl. Geef ALLEEN geldig JSON
terug, geen uitleg, in dit formaat:

{
  "adds": [{"title": string, "cat": "afspraak"|"klus"|"admin"|"inpakken"|"betaling", "who": "a"|"b"|"samen", "offsetDays": number, "time"?: "HH:MM", "note"?: string, "amount"?: number, "vendor"?: string}],
  "updates": [{"id": string, "title"?: string, "cat"?: "afspraak"|"klus"|"admin"|"inpakken"|"betaling", "who"?: "a"|"b"|"samen", "date"?: "YYYY-MM-DD", "time"?: "HH:MM", "note"?: string, "amount"?: number, "vendor"?: string}],
  "completes": [string]
}

"adds" zijn nieuwe taken. offsetDays is het aantal dagen vóór (negatief) of na (0 of positief) de
verhuisdag (dag 0). "updates" wijzigt bestaande taken — gebruik ALLEEN een "id" die hieronder in de
takenlijst staat, en neem alleen de velden op die echt moeten veranderen. "completes" bevat de "id"s
van taken die je op basis van het verzoek als afgerond moet markeren — ook hier alleen ids uit de
lijst hieronder. Verzin geen ids. Verzin geen namen, telefoonnummers of bedrijfsnamen van derden —
gebruik "vendor" alleen voor een generieke rol, nooit een verzonnen bedrijfsnaam. Als het verzoek
niets toe te voegen, te wijzigen of af te vinken geeft, geef dan lege arrays terug.

Adres: ${input.address}
Verhuisdatum: ${input.moveDate}

Huidige taken (id | datum | categorie | wie | status | titel):
${taskLines || '(nog geen taken)'}

Verzoek van de gebruiker:
${input.instruction.trim()}`;
}
