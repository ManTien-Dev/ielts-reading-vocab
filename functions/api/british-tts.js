/**
 * Totoro IELTS Master — British English Neural Examiner TTS Proxy
 * Endpoint: GET /api/british-tts?text=...&voice=claire|oliver
 *
 * Uses Cloudflare Workers AI (`@cf/deepgram/aura-1`) native British Neural voices:
 *   - claire -> speaker "athena" (Calm, smooth British female examiner)
 *   - oliver -> speaker "helios" (Confident, warm British male examiner)
 *
 * Edge-cached for 30 days; cleanly falls back to Youdao UK if Workers AI binding
 * is unavailable or rate-limited.
 */

const ALLOWED_STATIC = [
  'https://totoro-ieltsmaster.pages.dev',
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function isOriginAllowed(origin, reqUrl, env) {
  if (!origin) return true;
  if (origin === reqUrl.origin) return true;
  if (/^https:\/\/[a-z0-9-]+\.totoro-ieltsmaster\.pages\.dev$/i.test(origin)) return true;
  const extra = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  return [...ALLOWED_STATIC, ...extra].some((p) => origin === p || origin.startsWith(p + ':'));
}

function corsHeaders(origin, reqUrl, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : reqUrl.origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

export async function onRequestOptions(context) {
  const reqUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin, reqUrl, isOriginAllowed(origin, reqUrl, context.env)) });
}

export async function onRequestGet(context) {
  const reqUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, reqUrl, context.env);
  if (!allowed) {
    return new Response('Forbidden', { status: 403, headers: corsHeaders(origin, reqUrl, false) });
  }

  const text = String(reqUrl.searchParams.get('text') || '').replace(/\s+/g, ' ').trim();
  const voice = String(reqUrl.searchParams.get('voice') || 'claire').toLowerCase() === 'oliver' ? 'oliver' : 'claire';
  if (!text || text.length > 480) {
    return new Response('Invalid text parameter', { status: 400, headers: corsHeaders(origin, reqUrl, true) });
  }

  const speaker = voice === 'oliver' ? 'helios' : 'athena';

  // Layer 1: Cloudflare Workers AI — Deepgram Aura-1 British Neural Voices (Athena / Helios)
  if (context.env.AI && typeof context.env.AI.run === 'function') {
    try {
      const audioRes = await context.env.AI.run('@cf/deepgram/aura-1', {
        text,
        speaker,
        encoding: 'mp3',
      });
      if (audioRes) {
        const body = audioRes instanceof Response ? audioRes.body : audioRes;
        return new Response(body, {
          status: 200,
          headers: {
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=2592000',
            'X-TTS-Engine': `cf-aura-${speaker}`,
            ...corsHeaders(origin, reqUrl, true),
          },
        });
      }
    } catch (_) {}
  }

  // Layer 2: Reliable Youdao UK fallback (type=1)
  try {
    const upstream = await fetch(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=1`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (upstream.ok) {
      return new Response(upstream.body, {
        status: 200,
        headers: {
          'Content-Type': upstream.headers.get('content-type') || 'audio/mpeg',
          'Cache-Control': 'public, max-age=604800',
          'X-TTS-Engine': 'youdao-uk-fallback',
          ...corsHeaders(origin, reqUrl, true),
        },
      });
    }
  } catch (_) {}

  return new Response('TTS unavailable', { status: 503, headers: corsHeaders(origin, reqUrl, true) });
}
