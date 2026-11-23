/**
 * Totoro IELTS Master — Free STT Proxy (Cloudflare Pages Function)
 * Endpoint: POST /api/transcribe (multipart/form-data: `file`, `mode`: "word" | "speaking")
 *
 * Layer 1: Groq Whisper
 *   - mode="word"     -> `whisper-large-v3-turbo` (~0.3s, NO target word in prompt to avoid hallucination)
 *   - mode="speaking" -> `whisper-large-v3` with word/segment timestamps + verbatim hesitation prompt
 *   - Supports automatic multi-key rotation on HTTP 429/503 (`GROQ_API_KEY` + `GROQ_API_KEYS`)
 * Layer 2: Automatic fallback to Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`,
 *          10,000 free neurons/day) via binding `AI`.
 */

const ALLOWED_STATIC = [
  'https://totoro-ieltsmaster.pages.dev',
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const VERBATIM_PROMPT =
  'Um, well, I I think, uh, the the main reason is... I mean, it is, like, really useful, you know. So, er, I went, I went there last year.';

const WORD_CONTEXT_PROMPT =
  'Clear English vocabulary word pronunciation spoken aloud.';

const MAX_AUDIO_BYTES = 12 * 1024 * 1024; // 12 MB safety cap

function isOriginAllowed(origin, requestUrl, env) {
  if (!origin) return true;
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
    'Access-Control-Allow-Origin': allowed && origin ? origin : requestUrl.origin,
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

export async function onRequestOptions({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, url, env);
  return new Response(null, { status: 204, headers: corsHeaders(origin, url, allowed) });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, url, env);

  if (origin && !allowed) {
    return jsonResponse({ ok: false, error: 'Origin not allowed' }, 403, origin, url, allowed);
  }

  try {
    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return jsonResponse({ ok: false, error: 'Missing audio file' }, 400, origin, url, allowed);
    }
    if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
      return jsonResponse(
        { ok: false, error: 'Audio file is empty or exceeds 12 MB limit' },
        400,
        origin,
        url,
        allowed
      );
    }

    const t0 = Date.now();
    const mode = String(form.get('mode') || 'word').toLowerCase();
    const enginePref = String(form.get('engine') || 'auto').toLowerCase();
    const isSpeaking = mode === 'speaking';
    // Use full `whisper-large-v3` by default for BOTH single words & speaking:
    // far more accurate on quiet voices, short isolated words, and non-native accents than turbo!
    const model = enginePref === 'turbo' ? 'whisper-large-v3-turbo' : 'whisper-large-v3';
    // Never inject target answer or artificial word prompt for `word` mode (prevents syllable hyphenation & hallucinations)
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

    // Optional explicit Cloudflare Workers AI test mode
    if (enginePref === 'cf' && env.AI) {
      const cfResult = await callCloudflareAI(audioBuffer, env);
      cfResult.latencyMs = Date.now() - t0;
      return jsonResponse(cfResult, 200, origin, url, allowed);
    }

    // Layer 1: Groq Whisper with automatic multi-key rotation on 429/503
    const keys = getGroqKeys(env);
    let lastErr = null;
    for (const key of keys) {
      try {
        const result = await callGroq(audioBlob, filename, model, isSpeaking, prompt, key);
        result.latencyMs = Date.now() - t0;
        return jsonResponse(result, 200, origin, url, allowed);
      } catch (err) {
        lastErr = err;
        if (err.status !== 429 && err.status !== 503) break;
      }
    }

    // Layer 2: Automatic fallback to Cloudflare Workers AI (10,000 free neurons/day)
    if (env.AI) {
      try {
        const cfResult = await callCloudflareAI(audioBuffer, env);
        cfResult.latencyMs = Date.now() - t0;
        return jsonResponse(cfResult, 200, origin, url, allowed);
      } catch (cfErr) {
        lastErr = cfErr;
      }
    }

    return jsonResponse(
      { ok: false, error: lastErr?.message || 'STT provider unavailable' },
      502,
      origin,
      url,
      allowed
    );
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err?.message || 'Internal error' },
      500,
      origin,
      url,
      allowed
    );
  }
}
