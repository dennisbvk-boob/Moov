// Supabase Edge Function: turns a few answers about a move into a tailored
// task list, using the Gemini API. The API key lives only here (as an Edge
// Function secret) — it never reaches the browser bundle.
//
// Deploy: paste this file into Supabase Dashboard → Edge Functions →
// Create a function named "generate-plan", then add the GEMINI_API_KEY
// secret under that same Edge Functions section. See README for details.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const CATS = ['afspraak', 'klus', 'admin', 'inpakken', 'betaling'] as const;
const WHO = ['a', 'b', 'samen'] as const;

interface WizardInput {
  address: string;
  moveDate: string; // YYYY-MM-DD
  homeType: string;
  rooms: string;
  renovation: boolean;
  packing: 'zelf' | 'verhuisbedrijf';
  diy: 'zelf' | 'uitbesteden';
  kidsOrPets: boolean;
  notes: string;
}

interface AiTask {
  title: string;
  cat: (typeof CATS)[number];
  who: (typeof WHO)[number];
  offsetDays: number; // days from move day, negative = before
  time?: string;
  note?: string;
  amount?: number;
  vendor?: string;
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

    const input = (await req.json()) as WizardInput;
    if (!input.address || !input.moveDate) throw new Error('MISSING_FIELDS');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('NOT_CONFIGURED');

    const prompt = buildPrompt(input);

    const text = await askGemini(apiKey, prompt);
    const parsed = JSON.parse(text) as { tasks: AiTask[] };

    const tasks = (parsed.tasks ?? []).filter(isValidTask).slice(0, 60);

    return new Response(JSON.stringify({ tasks }), {
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

function isValidTask(t: unknown): t is AiTask {
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

/**
 * Ask Gemini, retrying the failures that are worth retrying.
 *
 * 503 means the model is momentarily overloaded — routine on the free tier and
 * usually gone a second later — so a single attempt fails for no good reason.
 * Google's guidance is exponential backoff with jitter on 429 and 5xx, and no
 * retry at all on 400/403, which would fail identically forever.
 *
 * Deliberately duplicated in both functions rather than shared: each file has
 * to stand alone to be pasted into the dashboard editor.
 */
const MODEL = 'gemini-3.8-flash';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

async function askGemini(apiKey: string, prompt: string): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json' },
  });

  let status = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) {
      // 1s, 2s, 4s, plus jitter so two phones don't retry in lockstep
      const wait = 2 ** (attempt - 1) * 1000 + Math.random() * 400;
      await new Promise((r) => setTimeout(r, wait));
    }
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      },
    );
    if (res.ok) {
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      if (!text) throw new Error('AI_BAD_RESPONSE');
      return text;
    }
    status = res.status;
    if (!RETRYABLE.has(status)) break;
  }
  throw new Error(`AI_REQUEST_FAILED: ${status}`);
}

function buildPrompt(input: WizardInput): string {
  return `Je stelt een Nederlandse verhuisplanning samen voor Moov.nl. Geef ALLEEN geldig JSON terug, geen uitleg, in dit formaat:

{"tasks": [{"title": string, "cat": "afspraak"|"klus"|"admin"|"inpakken"|"betaling", "who": "a"|"b"|"samen", "offsetDays": number, "time"?: "HH:MM", "note"?: string, "amount"?: number, "vendor"?: string}]}

offsetDays is het aantal dagen vóór (negatief) of na (0 of positief) de verhuisdag zelf (dag 0).
Verzin geen namen, telefoonnummers of bedrijfsnamen van derden — gebruik "vendor" alleen voor een
generieke rol ("aannemer", "verhuisbedrijf"), nooit een verzonnen bedrijfsnaam.
Genereer 20-40 realistische taken, verspreid over de weken vóór en de dag van de verhuizing zelf,
afgestemd op onderstaande situatie. Schrijf titels en notities beknopt en in het Nederlands.

Adres: ${input.address}
Verhuisdatum: ${input.moveDate}
Type woning: ${input.homeType}
Aantal kamers: ${input.rooms}
Verbouwing nodig: ${input.renovation ? 'ja' : 'nee'}
Inpakken/verhuizen: ${input.packing === 'zelf' ? 'doen ze zelf' : 'via een verhuisbedrijf'}
Klussen (schilderen, vloeren e.d.): ${input.diy === 'zelf' ? 'doen ze zelf' : 'besteden ze uit'}
Kinderen of huisdieren in huis: ${input.kidsOrPets ? 'ja' : 'nee'}
Extra opmerkingen: ${input.notes || '(geen)'}`;
}
