/**
 * IELTS Master — Free STT Proxy (Cloudflare Worker)
 * -------------------------------------------------
 * Layer 1: Groq Whisper (`whisper-large-v3-turbo` for fast Listening/Flashcard word checks,
 *          `whisper-large-v3` with word timestamps for Speaking Part 1–3) + multi-key 429 rotation.
 * Layer 2: Automatic fallback to Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`,
 *          10,000 free neurons/day) when Groq hits rate limits.
 *
 * Deployment (Zero CLI — directly in Cloudflare Dashboard):
 * 1. Workers & Pages -> Create -> Create Worker -> Paste this file -> Deploy.
 * 2. Settings -> Variables and Secrets:
 *    - Add Secret `GROQ_API_KEY` (or comma-separated `GROQ_API_KEYS` for extra free quota).
 *    - (Optional) Add Variable `ALLOWED_ORIGINS` = `https://mantien-dev.github.io`
 * 3. Settings -> Bindings -> Add -> Workers AI -> Variable name: `AI` (enables free daily fallback).
 */

const DEFAULT_ORIGINS = [
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const VERBATIM_PROMPT =
  'Um, well, I I think, uh, the the main reason is... I mean, it is, like, really useful, you know. So, er, I went, I went there last year.';

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // 12 MB safety cap

function isOriginAllowed(origin, env) {
  if (!origin) return false;
  const extra = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowList = [...DEFAULT_ORIGINS, ...extra];
  return allowList.some((prefix) => origin === prefix || origin.startsWith(prefix + ':'));
}

function corsHeaders(origin, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed ? origin : DEFAULT_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body, status, origin, allowed) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(origin, allowed),
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

async function callGroq(audioBlob, filename, model, useVerbose, prompt, apiKey) {
  const fd = new FormData();
  fd.append('file', audioBlob, filename);
  fd.append('model', model);
  fd.append('language', 'en');
  fd.append('temperature', '0');
  if (prompt) fd.append('prompt', prompt);
  if (useVerbose) {
    fd.append('response_format', 'verbose_json');
    fd.append('timestamp_granularities[]', 'word');
    fd.append('timestamp_granularities[]', 'segment');
  } else {
    fd.append('response_format', 'json');
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: fd,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    const err = new Error(`Groq HTTP ${res.status}: ${errText.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const words = (Array.isArray(data.words) ? data.words : [])
    .map((w) => ({
      w: String(w.word || '').trim(),
      s: Number(w.start),
      e: Number(w.end),
    }))
    .filter((w) => w.w && Number.isFinite(w.s) && Number.isFinite(w.e));

  const segments = (Array.isArray(data.segments) ? data.segments : []).map((s) => ({
    start: +Number(s.start || 0).toFixed(2),
    end: +Number(s.end || 0).toFixed(2),
    text: String(s.text || '').trim(),
    avgLogprob: +Number(s.avg_logprob || 0).toFixed(3),
    noSpeechProb: +Number(s.no_speech_prob || 0).toFixed(3),
  }));

  return {
    ok: true,
    engine: `groq:${model}`,
    text: String(data.text || '').trim(),
    words,
    segments,
  };
}

async function callCloudflareAI(audioBuffer, env) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error('Workers AI binding (AI) is not configured');
  }
  const bytes = new Uint8Array(audioBuffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const audioB64 = btoa(binary);

  const out = await env.AI.run('@cf/openai/whisper-large-v3-turbo', {
    audio: audioB64,
    task: 'transcribe',
    language: 'en',
  });

  const text = String(out?.text || '').trim();
  const words = (Array.isArray(out?.words) ? out.words : [])
    .map((w) => ({
      w: String(w.word || '').trim(),
      s: Number(w.start),
      e: Number(w.end),
    }))
    .filter((w) => w.w && Number.isFinite(w.s) && Number.isFinite(w.e));

  return {
    ok: true,
    engine: 'cloudflare:whisper-large-v3-turbo',
    text,
    words,
    segments: [],
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = isOriginAllowed(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, allowed) });
    }

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return jsonResponse(
        {
          ok: true,
          service: 'ielts-master-stt-proxy',
          groqKeysConfigured: getGroqKeys(env).length,
          cloudflareAiBound: Boolean(env.AI),
        },
        200,
        origin,
        allowed
      );
    }

    if (request.method !== 'POST' || url.pathname !== '/transcribe') {
      return jsonResponse({ ok: false, error: 'Use POST /transcribe' }, 404, origin, allowed);
    }

    if (origin && !allowed) {
      return jsonResponse({ ok: false, error: 'Origin not allowed' }, 403, origin, allowed);
    }

    try {
      const form = await request.formData();
      const file = form.get('file');
      if (!file || typeof file.arrayBuffer !== 'function') {
        return jsonResponse({ ok: false, error: 'Missing audio file' }, 400, origin, allowed);
      }
      if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
        return jsonResponse(
          { ok: false, error: 'Audio file is empty or exceeds 12 MB limit' },
          400,
          origin,
          allowed
        );
      }

      const mode = String(form.get('mode') || 'word').toLowerCase();
      const isSpeaking = mode === 'speaking';
      const model = isSpeaking ? 'whisper-large-v3' : 'whisper-large-v3-turbo';
      // Never inject target answer into prompt for `word` mode (prevents Whisper hallucination)
      const prompt = isSpeaking ? VERBATIM_PROMPT : '';

      const audioBuffer = await file.arrayBuffer();
      const mime = file.type || 'audio/webm';
      const ext = /mp4|m4a|aac/i.test(mime)
        ? 'm4a'
        : /ogg/i.test(mime)
          ? 'ogg'
          : /wav/i.test(mime)
            ? 'wav'
            : /mpeg|mp3/i.test(mime)
              ? 'mp3'
              : 'webm';
      const filename = `speech.${ext}`;
      const audioBlob = new Blob([audioBuffer], { type: mime });

      // Layer 1: Groq Whisper with automatic multi-key rotation on 429
      const keys = getGroqKeys(env);
      let lastErr = null;
      for (const key of keys) {
        try {
          const result = await callGroq(audioBlob, filename, model, isSpeaking, prompt, key);
          return jsonResponse(result, 200, origin, allowed);
        } catch (err) {
          lastErr = err;
          if (err.status !== 429 && err.status !== 503) break;
        }
      }

      // Layer 2: Automatic fallback to Cloudflare Workers AI (10,000 free neurons/day)
      if (env.AI) {
        try {
          const cfResult = await callCloudflareAI(audioBuffer, env);
          return jsonResponse(cfResult, 200, origin, allowed);
        } catch (cfErr) {
          lastErr = cfErr;
        }
      }

      return jsonResponse(
        { ok: false, error: lastErr?.message || 'STT provider unavailable' },
        502,
        origin,
        allowed
      );
    } catch (err) {
      return jsonResponse({ ok: false, error: err?.message || 'Internal error' }, 500, origin, allowed);
    }
  },
};
