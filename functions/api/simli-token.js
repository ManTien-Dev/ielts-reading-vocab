/**
 * Totoro IELTS Master — Optional Simli Real-Time WebRTC Session Token Proxy
 * Endpoint: POST /api/simli-token
 *
 * Keeps SIMLI_API_KEY strictly on the server. When SIMLI_API_KEY + face IDs are
 * configured in Cloudflare Pages Environment Variables:
 *   - SIMLI_API_KEY
 *   - SIMLI_CLAIRE_FACE_ID
 *   - SIMLI_OLIVER_FACE_ID
 * this endpoint mints a short-lived WebRTC session token with strict billing
 * guardrails (maxSessionLength: 420s, maxIdleTime: 90s).
 *
 * When unconfigured, cleanly returns { ok: false, enabled: false } (HTTP 200)
 * so the frontend stays 100% error-free on Layer 1 (Cloudflare R2 Cinema Loops).
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

function jsonResp(body, status, origin, reqUrl, allowed) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, reqUrl, allowed),
    },
  });
}

export async function onRequestOptions(context) {
  const reqUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  return new Response(null, { status: 204, headers: corsHeaders(origin, reqUrl, isOriginAllowed(origin, reqUrl, context.env)) });
}

export async function onRequestPost(context) {
  const reqUrl = new URL(context.request.url);
  const origin = context.request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, reqUrl, context.env);
  if (!allowed) {
    return jsonResp({ ok: false, enabled: false, error: 'Origin not allowed' }, 403, origin, reqUrl, false);
  }

  const apiKey = String(context.env.SIMLI_API_KEY || '').trim();
  if (!apiKey) {
    return jsonResp({ ok: false, enabled: false, reason: 'simli_not_configured' }, 200, origin, reqUrl, true);
  }

  let body = {};
  try {
    body = await context.request.json();
  } catch (_) {}

  const examinerId = String(body?.examinerId || 'claire').toLowerCase() === 'oliver' ? 'oliver' : 'claire';
  const faceId = examinerId === 'oliver'
    ? String(context.env.SIMLI_OLIVER_FACE_ID || '').trim()
    : String(context.env.SIMLI_CLAIRE_FACE_ID || '').trim();

  if (!faceId) {
    return jsonResp({ ok: false, enabled: false, reason: 'face_id_missing' }, 200, origin, reqUrl, true);
  }

  try {
    const tokenRes = await fetch('https://api.simli.ai/compose/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-simli-api-key': apiKey,
      },
      body: JSON.stringify({
        faceId,
        handleSilence: true,
        maxSessionLength: 420,
        maxIdleTime: 90,
      }),
    });

    if (!tokenRes.ok) {
      const errTxt = await tokenRes.text().catch(() => '');
      return jsonResp(
        { ok: false, enabled: true, error: `Simli HTTP ${tokenRes.status}: ${errTxt.slice(0, 140)}` },
        200,
        origin,
        reqUrl,
        true
      );
    }

    const tokenData = await tokenRes.json();
    const sessionToken = tokenData?.session_token || tokenData?.token || '';
    if (!sessionToken) {
      return jsonResp({ ok: false, enabled: true, error: 'Empty Simli session token' }, 200, origin, reqUrl, true);
    }

    // Optional ICE servers lookup
    let iceServers = null;
    try {
      const iceRes = await fetch('https://api.simli.ai/compose/ice', {
        headers: { 'x-simli-api-key': apiKey },
      });
      if (iceRes.ok) iceServers = await iceRes.json();
    } catch (_) {}

    return jsonResp(
      { ok: true, enabled: true, examinerId, session_token: sessionToken, iceServers },
      200,
      origin,
      reqUrl,
      true
    );
  } catch (err) {
    return jsonResp(
      { ok: false, enabled: true, error: String(err?.message || 'Simli network error') },
      200,
      origin,
      reqUrl,
      true
    );
  }
}
