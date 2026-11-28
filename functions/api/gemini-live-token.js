/**
 * Totoro IELTS Master — Gemini Live API Ephemeral Token Minting Endpoint
 * Endpoint: POST /api/gemini-live-token
 *
 * Mints a short-lived, single-use ephemeral token (`auth_tokens/...`) server-side
 * using `GEMINI_API_KEY` (or comma-separated `GEMINI_API_KEYS` rotation) so the
 * browser can establish a direct low-latency (~300ms) Native Audio WebSocket to
 * Gemini Live without ever exposing the master API key!
 *
 * Behavior when unconfigured:
 *   Returns HTTP 200 `{ ok: false, enabled: false }` so 3D Pro seamlessly falls
 *   back to the 0 VND/month Groq Whisper + Llama 3.3 70B + British Neural TTS stack.
 *
 * Environment Variables (Cloudflare Pages -> Settings -> Environment Variables):
 *   - GEMINI_API_KEY      (or GEMINI_API_KEYS for multi-key rotation)
 *   - GEMINI_LIVE_MODEL   (optional override; default: models/gemini-2.5-flash-native-audio-preview-12-2025)
 */

const ALLOWED_STATIC = [
  'https://totoro-ieltsmaster.pages.dev',
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

const DEFAULT_LIVE_MODELS = [
  'models/gemini-2.5-flash-native-audio-preview-12-2025',
  'models/gemini-2.5-flash-native-audio-preview-09-2025',
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
    'Access-Control-Allow-Headers': 'Content-Type',
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

function getGeminiKeys(env) {
  const multi = String(env.GEMINI_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const single = String(env.GEMINI_API_KEY || '').trim();
  if (single && !multi.includes(single)) multi.unshift(single);
  return multi;
}

async function mintEphemeralToken(apiKey) {
  const now = Date.now();
  const payload = {
    uses: 1,
    expireTime: new Date(now + 18 * 60 * 1000).toISOString(),
    newSessionExpireTime: new Date(now + 2 * 60 * 1000).toISOString(),
  };

  const endpoints = [
    {
      url: 'https://generativelanguage.googleapis.com/v1alpha/auth_tokens',
      wsBase: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained',
    },
    {
      url: 'https://generativelanguage.googleapis.com/v1beta/auth_tokens',
      wsBase: 'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained',
    },
  ];

  let lastErr = 'Token mint failed';
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      const tokenName = String(data?.name || '').trim();
      if (tokenName) {
        return { token: tokenName, wsUrl: `${ep.wsBase}?access_token=${encodeURIComponent(tokenName)}` };
      }
    } catch (err) {
      lastErr = err?.message || 'Fetch error';
    }
  }
  throw new Error(lastErr);
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
    return jsonResponse({ ok: false, enabled: false, error: 'Origin not allowed' }, 403, origin, reqUrl, false);
  }

  const keys = getGeminiKeys(context.env);
  if (!keys.length) {
    return jsonResponse(
      { ok: false, enabled: false, reason: 'GEMINI_API_KEY not configured' },
      200,
      origin,
      reqUrl,
      true
    );
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch (_) {}

  const examinerId = String(body?.examinerId || 'claire').toLowerCase() === 'oliver' ? 'oliver' : 'claire';
  const envModel = String(context.env.GEMINI_LIVE_MODEL || '').trim();
  const models = envModel
    ? [envModel.startsWith('models/') ? envModel : `models/${envModel}`, ...DEFAULT_LIVE_MODELS]
    : DEFAULT_LIVE_MODELS.slice();

  let lastErr = '';
  for (const key of keys) {
    try {
      const minted = await mintEphemeralToken(key);
      return jsonResponse(
        {
          ok: true,
          enabled: true,
          token: minted.token,
          wsUrl: minted.wsUrl,
          model: models[0],
          fallbackModels: models.slice(1),
          voiceName: examinerId === 'oliver' ? 'Charon' : 'Kore',
          examinerId,
        },
        200,
        origin,
        reqUrl,
        true
      );
    } catch (err) {
      lastErr = err?.message || 'Mint failed';
    }
  }

  return jsonResponse(
    { ok: false, enabled: false, reason: lastErr || 'Could not mint Gemini Live token' },
    200,
    origin,
    reqUrl,
    true
  );
}
