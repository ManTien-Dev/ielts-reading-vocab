/**
 * Totoro IELTS Master — STT Health Check (Cloudflare Pages Function)
 * Endpoint: GET /api/health
 */

const ALLOWED_STATIC = [
  'https://totoro-ieltsmaster.pages.dev',
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function countGroqKeys(env) {
  const multi = String(env.GROQ_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const single = String(env.GROQ_API_KEY || '').trim();
  if (single && !multi.includes(single)) multi.unshift(single);
  return multi.length;
}

export async function onRequestOptions({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, url, env);
  return new Response(null, { status: 204, headers: corsHeaders(origin, url, allowed) });
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, url, env);

  return new Response(
    JSON.stringify({
      ok: true,
      service: 'totoro-ieltsmaster-stt',
      groqKeysConfigured: countGroqKeys(env),
      cloudflareAiBound: Boolean(env.AI),
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        ...corsHeaders(origin, url, allowed),
      },
    }
  );
}
