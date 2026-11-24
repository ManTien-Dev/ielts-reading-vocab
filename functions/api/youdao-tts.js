/**
 * Totoro IELTS Master — Same-Origin Edge-Cached Youdao Voice Proxy
 * Endpoint: GET /api/youdao-tts?audio=<word>&type=<1|2>
 * Enables Web Audio API RMS loudness normalization so every Youdao word plays
 * at the exact same comfortable studio volume with zero cross-origin taint.
 */

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const rawAudio = (url.searchParams.get('audio') || '').trim();
  const typeParam = url.searchParams.get('type') === '1' ? '1' : '2';

  if (!rawAudio || rawAudio.length > 80) {
    return new Response('Bad Request', { status: 400 });
  }

  const upstreamUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(rawAudio)}&type=${typeParam}`;
  try {
    const upstream = await fetch(upstreamUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'audio/mpeg, audio/*;q=0.9, */*;q=0.5',
      },
      cf: {
        cacheEverything: true,
        cacheTtl: 60 * 60 * 24 * 30,
      },
    });

    if (!upstream.ok) {
      return new Response('Upstream error', { status: 502 });
    }

    const buf = await upstream.arrayBuffer();
    if (!buf || buf.byteLength < 256) {
      return new Response('Empty audio', { status: 502 });
    }

    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'audio/mpeg',
        'Cache-Control': 'public, max-age=2592000, immutable',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (_) {
    return new Response('Proxy fetch failed', { status: 502 });
  }
}
