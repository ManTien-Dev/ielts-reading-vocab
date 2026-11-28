/**
 * Totoro IELTS Master — Real-Time IELTS Speaking Examiner Brain API
 * Endpoint: POST /api/examiner-turn
 *
 * Strictly simulates Official Cambridge / British Council / IDP Speaking Examiner rules:
 *   - Repeat requests (Part 1 & Part 3): repeats verbatim without advancing or counting as answer
 *   - Clarification/rephrase requests: Part 1 repeats verbatim (no paraphrase); Part 3 simplifies/paraphrases
 *   - Short Part 1 answers (<11 words): prompts with "Why?" / "Why do you say that?"
 *   - Part 3 adaptive follow-up: probes deeper directly on what the candidate just argued
 *   - Off-topic answers: politely redirects once
 *   - Part 2 early stop (<75s): "Would you like to add anything else?"
 *   - Part 2 rounding-off: 1 concise spontaneous follow-up question tied to candidate's talk
 *
 * Multi-layer low-latency cascade (<450ms typical):
 *   1. Groq (`llama-3.3-70b-versatile`) with multi-key rotation
 *   2. Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` -> `llama-3.1-8b-instruct-fast`)
 *   3. Optional `GEMINI_API_KEY` (`gemini-2.5-flash`)
 */

const ALLOWED_STATIC = [
  'https://totoro-ieltsmaster.pages.dev',
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function isOriginAllowed(origin, requestUrl, env) {
  if (!origin || origin === 'null') return true;
  if (origin === requestUrl.origin) return true;
  if (/^https:\/\/[a-z0-9-]+\.totoro-ieltsmaster\.pages\.dev$/i.test(origin)) return true;
  const extra = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...ALLOWED_STATIC, ...extra].some(
    (prefix) => origin === prefix || origin.startsWith(prefix + ':')
  );
}

function corsHeaders(origin, requestUrl, allowed) {
  return {
    'Access-Control-Allow-Origin': !allowed ? requestUrl.origin : (origin === 'null' ? '*' : (origin || '*')),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body, status, origin, requestUrl, allowed) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, requestUrl, allowed),
    },
  });
}

function getGroqKeys(env) {
  const multi = String(env.GROQ_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const single = String(env.GROQ_API_KEY || '').trim();
  if (single && !multi.includes(single)) multi.unshift(single);
  return multi;
}

const EXAMINER_SYSTEM_PROMPT = `You are a certified British Council IELTS Speaking Examiner conducting a live, official IELTS Speaking test.

STRICT OFFICIAL CAMBRIDGE / BRITISH COUNCIL EXAMINER RULES:
1. NEVER teach, correct grammar, praise excessively ("Great job!", "Awesome!"), or break character. Keep acknowledgements brief, calm, warm, and British ("Thank you.", "Right, I see.", "Interesting, thank you.", "Mm-hmm, thank you.").
2. REPEAT REQUESTS (candidate says "pardon", "sorry", "could you repeat", "say that again", "didn't catch", "didn't hear"):
   - Return action="repeat", countAsAnswer=false, shouldAdvance=false.
   - examinerSpeech: "Sure, of course. <verbatim currentQuestion>".
3. CLARIFICATION / EXPLAIN REQUESTS (candidate says "what do you mean", "could you explain", "rephrase", "don't understand"):
   - If part == 1: Official IELTS rules FORBID paraphrasing in Part 1. Return action="repeat", countAsAnswer=false, shouldAdvance=false, examinerSpeech="Of course, let me repeat the question. <verbatim currentQuestion>".
   - If part == 3: Official IELTS rules ALLOW paraphrasing. Return action="rephrase", countAsAnswer=false, shouldAdvance=false, examinerSpeech="Sure — in other words, <simpler clearer 1-sentence version of currentQuestion>".
4. PART 1 SHORT ANSWER (part == 1, candidate answered the question but wordCount < 11 and probeCount == 0):
   - Return action="probe_short", countAsAnswer=true, shouldAdvance=false.
   - Ask a classic brief IELTS Part 1 probe ("Why?" or "Why do you say that?" or "Could you tell me a bit more about that?"). Set followUpQuestion to that probe.
5. PART 3 DEEP ADAPTIVE FOLLOW-UP (part == 3, candidate gave a substantive answer, probeCount == 0, and nextQuestion exists or it's the final question):
   - Return action="followup_deep", countAsAnswer=true, shouldAdvance=false.
   - Ask ONE concise, natural IELTS Part 3 follow-up/counter-question (12-22 words) directly referencing a specific point the candidate just made (e.g., asking for a contrast, real-world impact, or opposite perspective). Set followUpQuestion to that question.
6. OFF-TOPIC ANSWER (candidate completely misunderstood and talked about something unrelated, probeCount == 0, part == 1 or 3):
   - Return action="redirect_offtopic", countAsAnswer=true, shouldAdvance=false.
   - Politely bring them back: "I see, thank you. Coming back to the question, <currentQuestion>".
7. PART 2 EARLY STOP (part == 2, isPart2RoundingOff == false, durationSec < 75, probeCount == 0):
   - Return action="prompt_more", countAsAnswer=true, shouldAdvance=false, examinerSpeech="Would you like to add anything else?".
8. PART 2 ROUNDING-OFF (part == 2, isPart2RoundingOff == true):
   - Return action="rounding_off", countAsAnswer=true, shouldAdvance=false.
   - Acknowledge briefly ("Thank you.") and ask ONE short, personal, spontaneous rounding-off question (8-16 words) directly about the specific person/event/thing the candidate just described. Set followUpQuestion to that question.
9. NORMAL ADVANCE (candidate answered sufficiently, OR probeCount >= 1, OR repeatCount >= 2):
   - If nextQuestion is provided: return action="next_question", countAsAnswer=true, shouldAdvance=true, examinerSpeech="<brief British acknowledgement> <verbatim nextQuestion>".
   - If nextQuestion is null/empty: return action="end_part", countAsAnswer=true, shouldAdvance=true, examinerSpeech="Thank you. That is the end of Part <part>.".

OUTPUT FORMAT:
Return ONLY valid JSON (no markdown fences):
{
  "action": "repeat" | "rephrase" | "probe_short" | "followup_deep" | "redirect_offtopic" | "prompt_more" | "rounding_off" | "next_question" | "end_part",
  "examinerSpeech": "<exact natural British English text the examiner speaks aloud — concise, 1-2 sentences max>",
  "shouldAdvance": true | false,
  "countAsAnswer": true | false,
  "followUpQuestion": "<empty string or the follow-up question asked>"
}`;

function parseJsonSafe(raw) {
  let s = String(raw || '').trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) s = fenced[1].trim();
  const a = s.indexOf('{');
  const b = s.lastIndexOf('}');
  if (a >= 0 && b > a) s = s.slice(a, b + 1);
  return JSON.parse(s);
}

async function callGroq(userMsg, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.3,
      max_tokens: 280,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EXAMINER_SYSTEM_PROMPT },
        { role: 'user', content: userMsg },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq HTTP ${res.status}`);
  const data = await res.json();
  return { parsed: parseJsonSafe(data?.choices?.[0]?.message?.content || ''), engine: 'groq:llama-3.3-70b' };
}

async function callCloudflare(userMsg, env) {
  if (!env.AI || typeof env.AI.run !== 'function') throw new Error('No Workers AI');
  const models = [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.1-8b-instruct-fast',
  ];
  for (const model of models) {
    try {
      const out = await env.AI.run(model, {
        messages: [
          { role: 'system', content: EXAMINER_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.3,
        max_tokens: 280,
      });
      const content = typeof out?.response === 'string'
        ? out.response
        : (out?.choices?.[0]?.message?.content || JSON.stringify(out?.response || ''));
      return { parsed: parseJsonSafe(content), engine: `cf:${model.split('/').pop()}` };
    } catch (_) {}
  }
  throw new Error('Workers AI failed');
}

async function callGemini(userMsg, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: EXAMINER_SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: userMsg }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini HTTP ${res.status}`);
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { parsed: parseJsonSafe(content), engine: 'gemini-2.5-flash' };
}

export async function onRequestOptions(context) {
  const reqUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, reqUrl, context.env);
  return new Response(null, { status: 204, headers: corsHeaders(origin, reqUrl, allowed) });
}

export async function onRequestPost(context) {
  const reqUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, reqUrl, context.env);
  if (!allowed) {
    return jsonResponse({ ok: false, error: 'Origin not allowed' }, 403, origin, reqUrl, false);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (_) {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400, origin, reqUrl, true);
  }

  const part = Number(body?.part || 1);
  const currentQuestion = String(body?.currentQuestion || '').trim();
  const nextQuestion = body?.nextQuestion ? String(body.nextQuestion).trim() : null;
  const candidateText = String(body?.candidateText || '').trim();
  const durationSec = Number(body?.durationSec || 0);
  const wordCount = Number(body?.wordCount || (candidateText ? candidateText.split(/\s+/).length : 0));
  const repeatCount = Number(body?.repeatCount || 0);
  const probeCount = Number(body?.probeCount || 0);
  const isPart2RoundingOff = Boolean(body?.isPart2RoundingOff);

  const userMsg = JSON.stringify({
    part,
    topicTitle: String(body?.topicTitle || ''),
    currentQuestion,
    nextQuestion,
    candidateText: candidateText.slice(0, 1800),
    durationSec,
    wordCount,
    repeatCount,
    probeCount,
    isPart2RoundingOff,
    recentHistory: Array.isArray(body?.history) ? body.history.slice(-3) : [],
  });

  const groqKeys = getGroqKeys(context.env);
  let result = null;

  for (const key of groqKeys) {
    try {
      result = await callGroq(userMsg, key);
      break;
    } catch (_) {}
  }
  if (!result) {
    try {
      result = await callCloudflare(userMsg, context.env);
    } catch (_) {}
  }
  if (!result && context.env.GEMINI_API_KEY) {
    try {
      result = await callGemini(userMsg, context.env.GEMINI_API_KEY);
    } catch (_) {}
  }

  if (!result || !result.parsed?.examinerSpeech) {
    return jsonResponse({ ok: false, error: 'Examiner AI unavailable' }, 503, origin, reqUrl, true);
  }

  const p = result.parsed;
  return jsonResponse(
    {
      ok: true,
      engine: result.engine,
      action: String(p.action || 'next_question'),
      examinerSpeech: String(p.examinerSpeech || '').trim(),
      shouldAdvance: Boolean(p.shouldAdvance),
      countAsAnswer: p.countAsAnswer !== false,
      followUpQuestion: String(p.followUpQuestion || '').trim(),
    },
    200,
    origin,
    reqUrl,
    true
  );
}
