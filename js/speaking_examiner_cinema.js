/* ==========================================================================
   TOTORO IELTS MASTER — HYBRID CINEMA V2 & REAL-TIME EXAMINER ENGINE
   3-Tier Progressive Architecture:
     Tier 2 (Optional Real-Time): Simli Cloud WebRTC (enabled automatically when
       SIMLI_API_KEY + face IDs are configured in Cloudflare Pages env vars;
       resamples British Neural TTS -> 16kHz PCM16 for live lip-sync on EVERY
       fixed & dynamic AI follow-up question!)
     Tier 1A (0 VND/mo): Exact Pre-Rendered Lip-Sync MP4 Bank (Cloudflare R2 or
       assets/videos/clips/ via manifest.json + zero-latency next-clip preload)
     Tier 1B (0 VND/mo): Multi-Track Seamless Cinema Loops (idle / speak /
       one-shot nod / notes) + DSLR Photorealistic Portrait fallback
   Voice Identity Match:
     - Ms. Claire -> British Neural Female (/api/british-tts?voice=claire -> athena)
     - Mr. Oliver -> British Neural Male   (/api/british-tts?voice=oliver -> helios)
   ========================================================================== */
(function () {
  'use strict';

  const FALLBACK_API_BASE = 'https://totoro-ieltsmaster.pages.dev';
  const SIMLI_ESM_CDN = 'https://cdn.jsdelivr.net/npm/simli-client/+esm';

  const EXAMINERS = {
    claire: {
      id: 'claire',
      name: 'Ms. Claire',
      gender: 'female',
      role: 'British IELTS Examiner',
      speakImg: 'assets/images/examiner_claire_speak.webp',
      listenImg: 'assets/images/examiner_claire_listen.webp',
    },
    oliver: {
      id: 'oliver',
      name: 'Mr. Oliver',
      gender: 'male',
      role: 'British IELTS Examiner',
      speakImg: 'assets/images/examiner_oliver_speak.webp',
      listenImg: 'assets/images/examiner_oliver_listen.webp',
    },
  };

  let currentExId = 'claire';
  let currentMode = 'idle'; // 'idle' | 'speaking' | 'listening' | 'prep' | 'processing' | 'nod'
  let manifestData = null;
  let manifestPromise = null;
  let speakSeq = 0;
  let activeAudioEl = null;
  let activeWebSource = null;
  let activeClipEl = null;
  let preloadedClips = new Map(); // clipKey -> HTMLVideoElement
  let sharedAudioCtx = null;
  let ttsCache = new Map();

  // Optional Simli Real-Time WebRTC state
  let simliClient = null;
  let simliReady = false;
  let simliExId = null;
  let simliConnectPromise = null;

  // Candidate local webcam PiP & parallax
  let webcamStream = null;
  let webcamActive = false;
  let nodTimer = null;
  let speakRewindTimer = null;
  let lastNodAt = 0;
  let listenEnteredAt = 0;
  let micSmooth = 0;
  let boundParallaxEl = null;
  let boundMoveFn = null;
  let boundLeaveFn = null;

  function isPagesOrigin() {
    const loc = window.location;
    const host = String(loc.hostname || '').toLowerCase();
    return (
      loc.protocol === 'https:' &&
      (host === 'totoro-ieltsmaster.pages.dev' || host.endsWith('.totoro-ieltsmaster.pages.dev'))
    );
  }

  function getApiUrl(path) {
    if (isPagesOrigin()) return path;
    return `${FALLBACK_API_BASE}${path}`;
  }

  function resolveAssetUrl(relOrAbs, baseUrl) {
    const s = String(relOrAbs || '').trim();
    if (!s) return '';
    if (/^https?:\/\//i.test(s) || s.startsWith('data:') || s.startsWith('blob:')) return s;
    const base = String(baseUrl || './assets/videos/').replace(/\/+$/, '');
    return `${base}/${s.replace(/^\/+/, '')}`;
  }

  function ensureAudioCtx() {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      if (!sharedAudioCtx) sharedAudioCtx = new Ctx();
      if (sharedAudioCtx.state === 'suspended') sharedAudioCtx.resume().catch(() => {});
      return sharedAudioCtx;
    } catch (_) {
      return null;
    }
  }

  const DEFAULT_LOCAL_MANIFEST = {
    version: 2,
    baseUrl: './assets/videos/',
    simliAutoConnect: false,
    examiners: {
      claire: {
        baseLoops: {
          idle: 'claire/idle.mp4',
          speak: 'claire/speak.mp4',
          nod: 'claire/nod.mp4',
          notes: 'claire/notes.mp4',
        },
        clips: {},
      },
      oliver: {
        baseLoops: {
          idle: 'oliver/idle.mp4',
          speak: 'oliver/speak.mp4',
          nod: 'oliver/nod.mp4',
          notes: 'oliver/notes.mp4',
        },
        clips: {},
      },
    },
  };

  async function loadManifest() {
    if (manifestData) return manifestData;
    if (window.location.protocol === 'file:') {
      manifestData = DEFAULT_LOCAL_MANIFEST;
      return manifestData;
    }
    if (!manifestPromise) {
      const base = typeof window.__APP_BASE_PATH__ === 'string' ? window.__APP_BASE_PATH__ : '';
      manifestPromise = fetch(`${base}/assets/videos/manifest.json?v=20261128l`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          manifestData = j && typeof j === 'object' ? j : DEFAULT_LOCAL_MANIFEST;
          return manifestData;
        })
        .catch(() => {
          manifestData = DEFAULT_LOCAL_MANIFEST;
          return manifestData;
        });
    }
    return manifestPromise;
  }

  function getExaminerManifest(exId) {
    return manifestData?.examiners?.[exId] || { baseLoops: {}, clips: {} };
  }

  function getExactClipUrl(exId, clipId) {
    if (!clipId || !manifestData) return '';
    const exM = getExaminerManifest(exId);
    const rel = exM.clips?.[clipId];
    return rel ? resolveAssetUrl(rel, manifestData.baseUrl) : '';
  }

  function preloadClip(exId, clipId) {
    const url = getExactClipUrl(exId || currentExId, clipId);
    if (!url) return;
    const key = `${exId || currentExId}:${clipId}`;
    if (preloadedClips.has(key)) return;
    try {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.playsInline = true;
      v.src = url;
      v.load();
      if (preloadedClips.size > 12) {
        const firstKey = preloadedClips.keys().next().value;
        if (firstKey) preloadedClips.delete(firstKey);
      }
      preloadedClips.set(key, v);
    } catch (_) {}
  }

  /* ================= OPTIONAL SIMLI REAL-TIME WEBRTC LAYER ================= */
  async function connectSimliIfConfigured(exId) {
    if (!isPagesOrigin()) return false;
    const m = await loadManifest();
    if (m?.simliAutoConnect === false) return false;
    if (simliReady && simliClient && simliExId === exId) return true;
    if (simliConnectPromise) return simliConnectPromise;

    simliConnectPromise = (async () => {
      try {
        const res = await fetch('/api/simli-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ examinerId: exId }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data?.ok || !data.enabled || !data.session_token) return false;

        const vidEl = document.getElementById('sp-simli-video');
        const audEl = document.getElementById('sp-simli-audio');
        if (!vidEl || !audEl) return false;

        const mod = await import(SIMLI_ESM_CDN);
        const SimliClient = mod.SimliClient || mod.default;
        if (!SimliClient) return false;

        disconnectSimli();
        const client = new SimliClient(data.session_token, vidEl, audEl, data.iceServers || null);
        simliClient = client;
        simliExId = exId;

        await new Promise((resolve, reject) => {
          const guard = setTimeout(() => reject(new Error('Simli WebRTC timeout')), 8000);
          client.on?.('start', () => {
            clearTimeout(guard);
            simliReady = true;
            document.getElementById('sp-pro-stage')?.classList.add('has-simli-live');
            resolve();
          });
          client.on?.('failed', () => {
            clearTimeout(guard);
            reject(new Error('Simli connection failed'));
          });
          client.on?.('disconnected', () => {
            simliReady = false;
            document.getElementById('sp-pro-stage')?.classList.remove('has-simli-live');
          });
          if (typeof client.start === 'function') client.start();
        });
        return true;
      } catch (_) {
        disconnectSimli();
        return false;
      } finally {
        simliConnectPromise = null;
      }
    })();

    return simliConnectPromise;
  }

  function disconnectSimli() {
    simliReady = false;
    simliExId = null;
    if (simliClient) {
      try { simliClient.close?.(); } catch (_) {}
      simliClient = null;
    }
    document.getElementById('sp-pro-stage')?.classList.remove('has-simli-live');
  }

  async function resampleAudioBufferToPcm16k(audioBuf) {
    const targetSr = 16000;
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    let samples;
    if (OfflineCtx && audioBuf.sampleRate !== targetSr) {
      const len = Math.max(1, Math.ceil(audioBuf.duration * targetSr));
      const off = new OfflineCtx(1, len, targetSr);
      const src = off.createBufferSource();
      src.buffer = audioBuf;
      src.connect(off.destination);
      src.start(0);
      const rendered = await off.startRendering();
      samples = rendered.getChannelData(0);
    } else {
      samples = audioBuf.getChannelData(0);
    }
    const pcm = new Int16Array(samples.length);
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return new Uint8Array(pcm.buffer);
  }

  /* ================= PARALLAX & MULTI-TRACK VIDEO MOUNT ================= */
  function bindStageParallax(stageEl) {
    if (boundParallaxEl && boundMoveFn) boundParallaxEl.removeEventListener('mousemove', boundMoveFn);
    if (boundParallaxEl && boundLeaveFn) boundParallaxEl.removeEventListener('mouseleave', boundLeaveFn);
    boundParallaxEl = null;
    if (!stageEl) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const cam = document.getElementById('sp-cinema-camera');
    if (!cam) return;
    let rafId = 0;
    let tx = 0;
    let ty = 0;
    const apply = () => {
      rafId = 0;
      cam.style.setProperty('--px', `${(-tx * 5).toFixed(2)}px`);
      cam.style.setProperty('--py', `${(-ty * 3.5).toFixed(2)}px`);
      cam.style.setProperty('--ry', `${(tx * 0.8).toFixed(2)}deg`);
      cam.style.setProperty('--rx', `${(-ty * 0.55).toFixed(2)}deg`);
    };
    boundMoveFn = (e) => {
      const r = stageEl.getBoundingClientRect();
      if (!r.width || !r.height) return;
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };
    boundLeaveFn = () => {
      tx = 0;
      ty = 0;
      if (!rafId) rafId = requestAnimationFrame(apply);
    };
    stageEl.addEventListener('mousemove', boundMoveFn, { passive: true });
    stageEl.addEventListener('mouseleave', boundLeaveFn, { passive: true });
    boundParallaxEl = stageEl;
  }

  async function mount(examinerId, initialMode) {
    currentExId = EXAMINERS[examinerId] ? examinerId : 'claire';
    currentMode = initialMode || 'idle';
    const stage = document.getElementById('sp-pro-stage');
    if (!stage) return false;

    bindStageParallax(stage);
    attachCandidateCam();

    const m = await loadManifest();
    const exM = getExaminerManifest(currentExId);
    const loops = exM.baseLoops || {};
    const vWrap = document.getElementById('sp-cinema-video-wrap');

    if (vWrap) {
      const idleUrl = resolveAssetUrl(loops.idle, m.baseUrl);
      const speakUrl = resolveAssetUrl(loops.speak, m.baseUrl);
      const nodUrl = resolveAssetUrl(loops.nod, m.baseUrl);
      const notesUrl = resolveAssetUrl(loops.notes, m.baseUrl);

      let inner = '';
      if (idleUrl) {
        inner += `<video class="sp-cinema-vid is-layer-idle" id="sp-cinema-idle-vid" src="${idleUrl}" autoplay loop muted playsinline preload="auto"></video>`;
        if (speakUrl) inner += `<video class="sp-cinema-vid is-layer-speak" id="sp-cinema-speak-vid" src="${speakUrl}" loop muted playsinline preload="auto"></video>`;
        if (nodUrl) inner += `<video class="sp-cinema-vid is-layer-nod" id="sp-cinema-nod-vid" src="${nodUrl}" muted playsinline preload="auto"></video>`;
        if (notesUrl) inner += `<video class="sp-cinema-vid is-layer-notes" id="sp-cinema-notes-vid" src="${notesUrl}" loop muted playsinline preload="auto"></video>`;
      }
      // Exact pre-rendered Lip-Sync Clip layer + Optional Simli WebRTC layer
      inner += `<video class="sp-cinema-clip-vid" id="sp-cinema-clip-vid" playsinline preload="auto"></video>`;
      inner += `<video class="sp-cinema-webrtc-vid" id="sp-simli-video" autoplay playsinline></video><audio id="sp-simli-audio" autoplay></audio>`;
      vWrap.innerHTML = inner;

      const idleVid = document.getElementById('sp-cinema-idle-vid');
      const markCinemaReady = () => {
        document.getElementById('sp-pro-stage')?.classList.add('has-cinema-video');
      };
      if (idleVid) {
        if (idleVid.readyState >= 2) markCinemaReady();
        else {
          idleVid.addEventListener('loadeddata', markCinemaReady, { once: true });
          idleVid.addEventListener('playing', markCinemaReady, { once: true });
        }
      }

      vWrap.querySelectorAll('.sp-cinema-vid').forEach((v) => {
        if (v.classList.contains('is-layer-idle')) v.playbackRate = 0.85;
        else if (v.classList.contains('is-layer-speak')) v.playbackRate = 0.90;
        else if (v.classList.contains('is-layer-nod')) v.playbackRate = 0.92;
        else if (v.classList.contains('is-layer-notes')) v.playbackRate = 0.88;
        if (!v.classList.contains('is-layer-nod') && !v.classList.contains('is-layer-speak')) {
          v.play?.().catch(() => {});
        }
      });

      // One-shot nod video cleanly fades back to idle when ended
      const nodVid = document.getElementById('sp-cinema-nod-vid');
      if (nodVid) {
        nodVid.onended = () => {
          document.getElementById('sp-pro-stage')?.classList.remove('is-nodding');
          setTimeout(() => {
            try { nodVid.pause(); nodVid.currentTime = 0; } catch (_) {}
          }, 700);
        };
      }
    }

    setMode(currentMode);
    return true;
  }

  function setMode(mode) {
    const prevMode = currentMode;
    currentMode = mode || 'idle';
    const stage = document.getElementById('sp-pro-stage');
    if (!stage) return;
    stage.classList.toggle('is-speaking', currentMode === 'speaking');
    stage.classList.toggle('is-listening', currentMode === 'listening');
    stage.classList.toggle('is-prep', currentMode === 'prep');
    stage.classList.toggle('is-processing', currentMode === 'processing');
    stage.classList.toggle('is-nodding', currentMode === 'nod');

    const sv = document.getElementById('sp-cinema-speak-vid');
    if (currentMode === 'speaking') {
      if (speakRewindTimer) { clearTimeout(speakRewindTimer); speakRewindTimer = null; }
      if (sv) {
        sv.playbackRate = 0.90;
        sv.play?.().catch(() => {});
      }
    } else if (prevMode === 'speaking' && sv) {
      // Wait until 650ms opacity fade-out completes BEFORE rewinding to frame 0 (zero seek stutter!)
      if (speakRewindTimer) clearTimeout(speakRewindTimer);
      speakRewindTimer = setTimeout(() => {
        if (currentMode !== 'speaking') {
          try { sv.pause(); sv.currentTime = 0; } catch (_) {}
        }
      }, 720);
    }

    if (currentMode === 'listening' && prevMode !== 'listening') {
      // Never nod immediately when student starts speaking — wait calmly >= 8s first!
      listenEnteredAt = Date.now();
      lastNodAt = Date.now();
    }

    if (currentMode === 'prep' && prevMode !== 'prep') {
      const nv = document.getElementById('sp-cinema-notes-vid');
      if (nv) {
        nv.playbackRate = 0.88;
        nv.play?.().catch(() => {});
      }
    }
  }

  function triggerBriefNod() {
    const stage = document.getElementById('sp-pro-stage');
    if (!stage || currentMode !== 'listening') return;
    const nodVid = document.getElementById('sp-cinema-nod-vid');
    if (nodVid && stage.classList.contains('has-cinema-video')) {
      try {
        nodVid.playbackRate = 0.92;
        if (nodVid.paused) {
          nodVid.play?.().then(() => {
            if (currentMode === 'listening') stage.classList.add('is-nodding');
          }).catch(() => {});
        } else {
          stage.classList.add('is-nodding');
        }
        return;
      } catch (_) {}
    }
    stage.classList.add('is-nodding');
    if (nodTimer) clearTimeout(nodTimer);
    nodTimer = setTimeout(() => {
      document.getElementById('sp-pro-stage')?.classList.remove('is-nodding');
    }, 1100);
  }

  function feedMicLevel(bars) {
    if (!Array.isArray(bars) || !bars.length) return;
    const avg = bars.reduce((a, b) => a + Number(b || 0), 0) / bars.length;
    micSmooth = micSmooth * 0.72 + avg * 0.28;

    const pip = document.getElementById('sp-pro-pip');
    if (pip) {
      pip.style.setProperty('--mic-lvl', Math.min(1, micSmooth * 1.9).toFixed(3));
      pip.classList.toggle('is-voice-active', micSmooth > 0.14);
    }

    const now = Date.now();
    // Only trigger ONE natural encouraging nod after student has spoken calmly >= 8s, max once per 16s
    if (
      currentMode === 'listening' &&
      micSmooth > 0.18 &&
      now - listenEnteredAt > 8000 &&
      now - lastNodAt > 16000
    ) {
      lastNodAt = now;
      triggerBriefNod();
    }
  }

  /* ================= SPEECH PLAYBACK (EXACT CLIP -> SIMLI -> BRITISH NEURAL TTS) ================= */
  function splitClauses(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= 210) return [clean];
    const parts = clean.match(/[^.?!]+[.?!]*/g) || [clean];
    const out = [];
    let buf = '';
    for (const p of parts) {
      const t = p.trim();
      if (!t) continue;
      if ((buf + ' ' + t).trim().length <= 215) buf = (buf + ' ' + t).trim();
      else {
        if (buf) out.push(buf);
        buf = t;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function stopAudioPlayback() {
    if (activeClipEl) {
      try {
        activeClipEl.onended = null;
        activeClipEl.onerror = null;
        activeClipEl.pause();
        activeClipEl.classList.remove('is-playing');
      } catch (_) {}
      activeClipEl = null;
    }
    if (activeWebSource) {
      try {
        activeWebSource.onended = null;
        activeWebSource.stop();
        activeWebSource.disconnect();
      } catch (_) {}
      activeWebSource = null;
    }
    if (activeAudioEl) {
      try {
        activeAudioEl.onended = null;
        activeAudioEl.onerror = null;
        activeAudioEl.pause();
        activeAudioEl.src = '';
      } catch (_) {}
      activeAudioEl = null;
    }
    try { window.speechSynthesis?.cancel?.(); } catch (_) {}
    try { window.AppCore?.audio?.stop?.(); } catch (_) {}
  }

  async function playExactLipSyncClip(clipUrl, rate, mySeq) {
    const clipVid = document.getElementById('sp-cinema-clip-vid');
    if (!clipVid || !clipUrl || mySeq !== speakSeq) return false;
    return new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        clipVid.onended = null;
        clipVid.onerror = null;
        clipVid.classList.remove('is-playing');
        if (activeClipEl === clipVid) activeClipEl = null;
        resolve(ok);
      };
      const guard = setTimeout(() => done(true), 22000);
      activeClipEl = clipVid;
      clipVid.src = clipUrl;
      clipVid.muted = false;
      clipVid.playbackRate = Number(rate) || 1.0;
      clipVid.onended = () => done(true);
      clipVid.onerror = () => done(false);
      clipVid.onplaying = () => {
        if (mySeq === speakSeq) clipVid.classList.add('is-playing');
      };
      const p = clipVid.play();
      if (p && typeof p.catch === 'function') p.catch(() => done(false));
    });
  }

  async function fetchBritishNeuralBuffer(clause, voiceId) {
    const ctx = ensureAudioCtx();
    if (!ctx || !isPagesOrigin()) return null;
    const key = `${voiceId}:${clause.toLowerCase()}`;
    if (ttsCache.has(key)) return ttsCache.get(key);
    try {
      const res = await fetch(getApiUrl(`/api/british-tts?text=${encodeURIComponent(clause)}&voice=${encodeURIComponent(voiceId)}`));
      if (!res.ok) return null;
      const arr = await res.arrayBuffer();
      const buf = await ctx.decodeAudioData(arr.slice(0));
      if (ttsCache.size > 120) ttsCache.delete(ttsCache.keys().next().value);
      ttsCache.set(key, buf);
      return buf;
    } catch (_) {
      return null;
    }
  }

  function pickGenderedBrowserUKVoice(voiceId) {
    try {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      const gb = voices.filter((v) => /en[-_]gb/i.test(v.lang));
      const isMale = voiceId === 'oliver';
      const maleRe = /\b(ryan|george|daniel|thomas|arthur|oliver|male|guy|david|mark)\b/i;
      const femaleRe = /\b(sonia|libby|hazel|martha|serena|kate|female|samantha|victoria)\b/i;
      const preferred = gb.find((v) => (isMale ? maleRe : femaleRe).test(v.name));
      if (preferred) return preferred;
      const anyEn = voices.filter((v) => /^en/i.test(v.lang));
      return anyEn.find((v) => (isMale ? maleRe : femaleRe).test(v.name)) || gb[0] || anyEn[0] || null;
    } catch (_) {
      return null;
    }
  }

  async function playSingleClauseUK(clause, voiceId, rate, mySeq) {
    if (mySeq !== speakSeq) return;
    const clean = String(clause || '').trim();
    if (!clean) return;
    const playRate = Number(rate) || 0.96;

    // 1. Cloudflare Workers AI British Neural TTS (/api/british-tts -> Athena Female / Helios Male)
    const buf = await fetchBritishNeuralBuffer(clean, voiceId);
    if (mySeq !== speakSeq) return;

    if (buf) {
      // If Simli Real-Time WebRTC is active, stream 16kHz PCM16 directly to Simli (live lip-sync!)
      if (simliReady && simliClient && typeof simliClient.sendAudioData === 'function') {
        try {
          const pcm = await resampleAudioBufferToPcm16k(buf);
          if (mySeq !== speakSeq) return;
          simliClient.sendAudioData(pcm);
          await new Promise((r) => setTimeout(r, Math.max(900, Math.round(buf.duration * 1000) + 250)));
          return;
        } catch (_) {}
      }

      const ctx = ensureAudioCtx();
      if (ctx) {
        await new Promise((resolve) => {
          if (ctx.state === 'suspended') ctx.resume().catch(() => {});
          const src = ctx.createBufferSource();
          src.buffer = buf;
          src.playbackRate.value = playRate;
          src.connect(ctx.destination);
          activeWebSource = src;
          const guard = setTimeout(resolve, Math.max(1500, Math.round((buf.duration / playRate) * 1000) + 700));
          src.onended = () => {
            clearTimeout(guard);
            if (activeWebSource === src) activeWebSource = null;
            resolve();
          };
          src.start(0);
        });
        return;
      }
    }

    if (mySeq !== speakSeq) return;

    // 2. Local / file:// Gendered Browser UK Voice (distinguishes Female Ms. Claire vs Male Mr. Oliver!)
    const ukVoice = pickGenderedBrowserUKVoice(voiceId);
    if (ukVoice && 'speechSynthesis' in window) {
      const spoke = await new Promise((resolve) => {
        try {
          const u = new SpeechSynthesisUtterance(clean);
          u.voice = ukVoice;
          u.lang = ukVoice.lang || 'en-GB';
          u.rate = playRate;
          u.pitch = voiceId === 'oliver' ? 0.94 : 1.03;
          let settled = false;
          const done = (ok) => {
            if (settled) return;
            settled = true;
            clearTimeout(guard);
            resolve(ok);
          };
          const guard = setTimeout(() => done(true), Math.max(2200, clean.split(/\s+/).length * 520 + 1600));
          u.onend = () => done(true);
          u.onerror = () => done(false);
          window.speechSynthesis.speak(u);
        } catch (_) {
          resolve(false);
        }
      });
      if (spoke || mySeq !== speakSeq) return;
    }

    // 3. Direct Youdao UK <audio> universal fallback
    await new Promise((resolve) => {
      try {
        const a = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=1`);
        a.playbackRate = playRate;
        activeAudioEl = a;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          if (activeAudioEl === a) activeAudioEl = null;
          resolve();
        };
        const guard = setTimeout(done, Math.max(2200, Math.min(12000, clean.split(/\s+/).length * 480 + 1800)));
        a.onended = done;
        a.onerror = done;
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(done);
      } catch (_) {
        setTimeout(resolve, 1400);
      }
    });
  }

  async function speak(text, opts) {
    const clean = String(text || '').trim();
    const voiceId = opts?.examinerId || currentExId || 'claire';
    const clipId = opts?.clipId || '';
    const rate = opts?.rate || 0.96;
    const mySeq = ++speakSeq;
    stopAudioPlayback();

    if (!clean && !clipId) {
      opts?.onDone?.();
      return;
    }

    setMode('speaking');

    // Tier 1A: Exact Pre-Rendered Lip-Sync Clip (if not streaming Simli and clip exists in manifest!)
    if (!simliReady && clipId) {
      await loadManifest();
      const clipUrl = getExactClipUrl(voiceId, clipId);
      if (clipUrl && mySeq === speakSeq) {
        const played = await playExactLipSyncClip(clipUrl, rate, mySeq);
        if (played) {
          if (mySeq === speakSeq) {
            if (currentMode === 'speaking') setMode('idle');
            opts?.onDone?.();
          }
          return;
        }
      }
    }

    // Tier 2 (Simli live) or Tier 1B (Base Speaking Loop + British Neural Female/Male Voice)
    const clauses = splitClauses(clean);
    for (let i = 0; i < clauses.length; i++) {
      if (mySeq !== speakSeq) return;
      await playSingleClauseUK(clauses[i], voiceId, rate, mySeq);
      if (mySeq !== speakSeq) return;
      if (i < clauses.length - 1) await new Promise((r) => setTimeout(r, 170));
    }

    if (mySeq !== speakSeq) return;
    if (currentMode === 'speaking') setMode('idle');
    opts?.onDone?.();
  }

  function stopSpeaking() {
    speakSeq++;
    stopAudioPlayback();
    if (currentMode === 'speaking') setMode('idle');
  }

  /* ================= OPTIONAL LOCAL CANDIDATE WEBCAM PIP ================= */
  async function toggleCandidateCam(forceState) {
    const wantOn = typeof forceState === 'boolean' ? forceState : !webcamActive;
    if (!wantOn) {
      stopCandidateCam();
      return false;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      window.__VOCAB_BRIDGE__?.showToast?.('Trình duyệt chưa hỗ trợ Webcam.');
      return false;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
        audio: false,
      });
      webcamStream = s;
      webcamActive = true;
      attachCandidateCam();
      return true;
    } catch (_) {
      window.__VOCAB_BRIDGE__?.showToast?.('Chưa cấp quyền Camera hoặc thiết bị không có Webcam.');
      webcamActive = false;
      return false;
    }
  }

  function attachCandidateCam() {
    const pip = document.getElementById('sp-pro-pip');
    const vid = document.getElementById('sp-pro-pip-video');
    const btn = document.getElementById('sp-pro-cam-btn');
    if (pip) pip.classList.toggle('is-cam-on', Boolean(webcamActive && webcamStream));
    if (btn) {
      btn.textContent = webcamActive ? 'Tắt Cam' : 'Bật Cam';
      btn.classList.toggle('is-active', webcamActive);
    }
    if (vid && webcamActive && webcamStream) {
      if (vid.srcObject !== webcamStream) vid.srcObject = webcamStream;
      vid.play?.().catch(() => {});
    }
  }

  function stopCandidateCam() {
    if (webcamStream) {
      try { webcamStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      webcamStream = null;
    }
    webcamActive = false;
    const pip = document.getElementById('sp-pro-pip');
    const vid = document.getElementById('sp-pro-pip-video');
    const btn = document.getElementById('sp-pro-cam-btn');
    if (vid) vid.srcObject = null;
    if (pip) pip.classList.remove('is-cam-on');
    if (btn) {
      btn.textContent = 'Bật Cam';
      btn.classList.remove('is-active');
    }
  }

  function destroy() {
    speakSeq++;
    stopAudioPlayback();
    disconnectSimli();
    stopCandidateCam();
    if (nodTimer) {
      clearTimeout(nodTimer);
      nodTimer = null;
    }
    if (speakRewindTimer) {
      clearTimeout(speakRewindTimer);
      speakRewindTimer = null;
    }
    if (boundParallaxEl && boundMoveFn) boundParallaxEl.removeEventListener('mousemove', boundMoveFn);
    if (boundParallaxEl && boundLeaveFn) boundParallaxEl.removeEventListener('mouseleave', boundLeaveFn);
    boundParallaxEl = null;
  }

  window.SpeakingExaminerCinema = {
    EXAMINERS,
    loadManifest,
    mount,
    connectSimliIfConfigured,
    disconnectSimli,
    preloadClip,
    setMode,
    speak,
    stopSpeaking,
    feedMicLevel,
    triggerBriefNod,
    toggleCandidateCam,
    attachCandidateCam,
    stopCandidateCam,
    isWebcamActive: () => webcamActive,
    isSimliLive: () => simliReady,
    destroy,
  };
})();
