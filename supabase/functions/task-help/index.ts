// Supabase Edge Function: looks up how to actually carry out one task —
// the steps in order, what you need in hand, and what goes wrong — using
// Gemini with Google Search switched on, so the answer is grounded in pages
// that exist and comes back with links you can check.
//
// Deploy: paste this file into Supabase Dashboard → Edge Functions →
// Create a function named "task-help". It uses the same GEMINI_API_KEY secret
// as the other two functions. See README step 3.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const MODES = ['HUUR', 'KOOP', 'IN HUIS'] as const;

interface HelpInput {
  title: string;
  note?: string;
  cat?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Same gate as the other two: this costs real money per call.
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('NOT_SIGNED_IN');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) throw new Error('NOT_SIGNED_IN');

    const input = (await req.json()) as HelpInput;
    if (!input.title?.trim()) throw new Error('MISSING_TASK');

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('NOT_CONFIGURED');

    const prompt = buildPrompt(input);

    // Try with Google Search first. If this model or API version won't take
    // the tool it answers 400 rather than ignoring it, so fall back to a
    // plain answer instead of showing the user an error.
    let answer: { text: string; sources: { title: string; url: string }[] };
    try {
      answer = await askGemini(apiKey, prompt, true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (!msg.startsWith('AI_REQUEST_FAILED: 400')) throw e;
      answer = await askGemini(apiKey, prompt, false);
    }

    const help = shape(answer.text, answer.sources);
    if (!help) throw new Error('AI_BAD_RESPONSE');

    return new Response(JSON.stringify({ help }), {
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

const MODEL = 'gemini-3.8-flash';
const RETRYABLE = new Set([429, 500, 502, 503, 504]);

/**
 * Ask Gemini, retrying the failures worth retrying (Google's guidance:
 * exponential backoff on 429 and 5xx, never on 400/403). Deliberately
 * duplicated across the three functions — each has to stand alone to be
 * pasted into the dashboard editor.
 *
 * With `search` on there is no forcing a JSON mime type, because that setting
 * and the tool can't both apply. The prompt asks for JSON and `shape()` is
 * written to survive the model wrapping it in a code fence anyway.
 */
async function askGemini(
  apiKey: string,
  prompt: string,
  search: boolean,
): Promise<{ text: string; sources: { title: string; url: string }[] }> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    ...(search
      ? { tools: [{ google_search: {} }] }
      : { generationConfig: { responseMimeType: 'application/json' } }),
  });

  let status = 0;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) {
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
      const cand = data.candidates?.[0];
      const text = (cand?.content?.parts ?? [])
        .map((p: { text?: string }) => p.text ?? '')
        .join('');
      if (!text) throw new Error('AI_BAD_RESPONSE');

      // Where the grounded claims came from, when search was used.
      const chunks = cand?.groundingMetadata?.groundingChunks ?? [];
      const seen = new Set<string>();
      const sources: { title: string; url: string }[] = [];
      for (const c of chunks) {
        const url = c?.web?.uri;
        if (typeof url !== 'string' || seen.has(url)) continue;
        seen.add(url);
        sources.push({ title: String(c.web.title ?? url).slice(0, 120), url });
        if (sources.length >= 6) break;
      }
      return { text, sources };
    }
    status = res.status;
    if (!RETRYABLE.has(status)) break;
  }
  throw new Error(`AI_REQUEST_FAILED: ${status}`);
}

/** Pull the JSON object out of whatever the model wrapped it in. */
function parseLoose(text: string): Record<string, unknown> | null {
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const str = (v: unknown, max: number): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function strList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems);
}

/** Everything the app will render, with nothing unbounded in it. */
function shape(text: string, sources: { title: string; url: string }[]) {
  const raw = parseLoose(text);
  if (!raw) return null;

  const materials = Array.isArray(raw.materials)
    ? raw.materials
        .map((m: unknown) => {
          const x = (m ?? {}) as Record<string, unknown>;
          const name = str(x.name, 80);
          if (!name) return null;
          const mode = MODES.includes(x.mode as (typeof MODES)[number])
            ? (x.mode as string)
            : 'KOOP';
          return { name, mode, why: str(x.why, 120) || null };
        })
        .filter(Boolean)
        .slice(0, 12)
    : [];

  const steps = strList(raw.steps, 14, 400);
  const summary = str(raw.summary, 400);
  if (!steps.length && !summary) return null;

  const minutesRaw = Number(raw.minutes);
  return {
    summary,
    steps,
    materials,
    warnings: strList(raw.warnings, 6, 300),
    minutes: Number.isFinite(minutesRaw) && minutesRaw > 0 ? Math.round(minutesRaw) : null,
    sources,
    created_at: new Date().toISOString(),
  };
}

function buildPrompt(input: HelpInput): string {
  return `Je legt een Nederlandse klusser uit hoe hij één taak uitvoert. Zoek op wat er nodig is
en geef ALLEEN geldig JSON terug, geen uitleg eromheen, in dit formaat:

{"summary": string, "steps": [string], "materials": [{"name": string, "mode": "HUUR"|"KOOP"|"IN HUIS", "why": string}], "warnings": [string], "minutes": number}

- "summary": één of twee zinnen over wat deze taak inhoudt.
- "steps": de handelingen in de volgorde waarin je ze doet. Wees concreet en noem de volgorde
  expliciet als die uitmaakt (bijvoorbeeld: begin beneden, werk naar boven). Maximaal 12 stappen.
- "materials": gereedschap en materiaal dat je in huis moet hebben vóór je begint. "mode" is
  HUUR voor gereedschap dat je normaal huurt, KOOP voor spullen die je koopt, IN HUIS voor wat
  de meeste mensen al hebben. Verzin geen merken, winkels of prijzen.
- "warnings": wat er misgaat als je het verkeerd doet. Gaat de taak over gas, elektra, water of
  een cv-installatie, zeg dan expliciet wanneer je een erkend vakman moet inschakelen.
- "minutes": een realistische schatting in minuten voor één persoon.

Schrijf in het Nederlands, in de je-vorm, kort en praktisch. Verzin geen bedrijfsnamen,
telefoonnummers of prijzen. Weet je iets niet zeker, laat het weg in plaats van het te gokken.

De taak: ${input.title}
${input.note ? `Notitie erbij: ${input.note}` : ''}
${input.cat ? `Soort taak: ${input.cat}` : ''}`;
}
