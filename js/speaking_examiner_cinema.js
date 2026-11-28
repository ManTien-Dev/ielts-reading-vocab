/* ==========================================================================
   TOTORO IELTS MASTER — DUAL-VIDEO CINEMA EXAMINER ENGINE (PRAKTIKA / DUOLINGO STYLE)
   - Zero-cost client-side Cinema Engine: plays seamless looping MP4/WebM clips
     (assets/videos/examiner_{claire,oliver}_{idle,speak,nod,notes}.mp4) with
     dual-<video> zero-flicker crossfade when present.
   - Automatic high-res Studio Portrait fallback (examiner_*_speak/listen.webp)
     with real-time Web Audio TTS reactivity & mic-reactive nodding until MP4s
     are added — dropping MP4s into assets/videos/ upgrades automatically!
   - Sentence-chunked British English (UK) speech playback with exact onDone()
     callback for hands-free VAD turn-taking.
   - Optional local Candidate PiP Webcam (100% browser-local, opt-in toggle).
   ========================================================================== */
(function () {
  'use strict';

  const FALLBACK_API_BASE = 'https://totoro-ieltsmaster.pages.dev';

  const EXAMINERS = {
    claire: {
      id: 'claire',
      name: 'Ms. Claire',
      role: 'British IELTS Examiner',
      speakImg: 'assets/images/examiner_claire_speak.webp',
      listenImg: 'assets/images/examiner_claire_listen.webp',
      videos: {
        idle: 'assets/videos/examiner_claire_idle.mp4',
        speak: 'assets/videos/examiner_claire_speak.mp4',
        nod: 'assets/videos/examiner_claire_nod.mp4',
        notes: 'assets/videos/examiner_claire_notes.mp4',
      },
    },
    oliver: {
      id: 'oliver',
      name: 'Mr. Oliver',
      role: 'British IELTS Examiner',
      speakImg: 'assets/images/examiner_oliver_speak.webp',
      listenImg: 'assets/images/examiner_oliver_listen.webp',
      videos: {
        idle: 'assets/videos/examiner_oliver_idle.mp4',
        speak: 'assets/videos/examiner_oliver_speak.mp4',
        nod: 'assets/videos/examiner_oliver_nod.mp4',
        notes: 'assets/videos/examiner_oliver_notes.mp4',
      },
    },
  };

  let currentExId = 'claire';
  let currentMode = 'idle'; // 'idle' | 'speaking' | 'listening' | 'prep' | 'processing' | 'nod'
  let speakSeq = 0;
  let activeAudioEl = null;
  let activeWebSource = null;
  let sharedAudioCtx = null;
  let ttsCache = new Map();
  let videoAvailability = {}; // { claire: boolean, oliver: boolean }
  let webcamStream = null;
  let webcamActive = false;
  let nodTimer = null;
  let lastNodAt = 0;
  let micSmooth = 0;
  let boundParallaxEl = null;
  let boundMoveFn = null;
  let boundLeaveFn = null;

  function getApiUrl(path) {
    const loc = window.location;
    const host = String(loc.hostname || '').toLowerCase();
    const isPagesOrigin =
      loc.protocol === 'https:' &&
      (host === 'totoro-ieltsmaster.pages.dev' || host.endsWith('.totoro-ieltsmaster.pages.dev'));
    if (isPagesOrigin) return path;
    return `${FALLBACK_API_BASE}${path}`;
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

  // Flip to true after placing examiner_{claire,oliver}_{idle,speak,nod,notes}.mp4 into assets/videos/
  const CINEMA_VIDEO_ENABLED = { claire: false, oliver: false };

  function isPagesOrigin() {
    const loc = window.location;
    const host = String(loc.hostname || '').toLowerCase();
    return (
      loc.protocol === 'https:' &&
      (host === 'totoro-ieltsmaster.pages.dev' || host.endsWith('.totoro-ieltsmaster.pages.dev'))
    );
  }

  function probeVideoSupport(exId) {
    return Promise.resolve(Boolean(CINEMA_VIDEO_ENABLED[exId] && window.location.protocol !== 'file:'));
  }

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
      cam.style.setProperty('--px', `${(-tx * 6).toFixed(2)}px`);
      cam.style.setProperty('--py', `${(-ty * 4).toFixed(2)}px`);
      cam.style.setProperty('--ry', `${(tx * 0.9).toFixed(2)}deg`);
      cam.style.setProperty('--rx', `${(-ty * 0.65).toFixed(2)}deg`);
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

    const hasVideos = await probeVideoSupport(currentExId);
    const vWrap = document.getElementById('sp-cinema-video-wrap');
    if (hasVideos && vWrap) {
      const cfg = EXAMINERS[currentExId];
      stage.classList.add('has-cinema-video');
      vWrap.innerHTML = `
        <video class="sp-cinema-vid is-layer-idle" src="${cfg.videos.idle}" autoplay loop muted playsinline preload="auto"></video>
        <video class="sp-cinema-vid is-layer-speak" src="${cfg.videos.speak}" autoplay loop muted playsinline preload="auto"></video>
        <video class="sp-cinema-vid is-layer-nod" src="${cfg.videos.nod}" autoplay loop muted playsinline preload="auto"></video>
        <video class="sp-cinema-vid is-layer-notes" src="${cfg.videos.notes}" autoplay loop muted playsinline preload="auto"></video>
      `;
      vWrap.querySelectorAll('video').forEach((v) => v.play?.().catch(() => {}));
    }

    setMode(currentMode);
    return true;
  }

  function setMode(mode) {
    currentMode = mode || 'idle';
    const stage = document.getElementById('sp-pro-stage');
    if (!stage) return;
    stage.classList.toggle('is-speaking', currentMode === 'speaking');
    stage.classList.toggle('is-listening', currentMode === 'listening');
    stage.classList.toggle('is-prep', currentMode === 'prep');
    stage.classList.toggle('is-processing', currentMode === 'processing');
    stage.classList.toggle('is-nodding', currentMode === 'nod');
  }

  function triggerBriefNod() {
    const stage = document.getElementById('sp-pro-stage');
    if (!stage || currentMode !== 'listening') return;
    stage.classList.add('is-nodding');
    if (nodTimer) clearTimeout(nodTimer);
    nodTimer = setTimeout(() => {
      document.getElementById('sp-pro-stage')?.classList.remove('is-nodding');
    }, 1150);
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
    if (currentMode === 'listening' && micSmooth > 0.2 && now - lastNodAt > 3600) {
      lastNodAt = now;
      triggerBriefNod();
    }
  }

  /* Split long British Examiner utterances into natural <=180-char clauses for clean Youdao UK TTS */
  function splitClauses(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return [];
    if (clean.length <= 170) return [clean];
    const parts = clean.match(/[^.?!]+[.?!]*/g) || [clean];
    const out = [];
    let buf = '';
    for (const p of parts) {
      const t = p.trim();
      if (!t) continue;
      if ((buf + ' ' + t).trim().length <= 175) {
        buf = (buf + ' ' + t).trim();
      } else {
        if (buf) out.push(buf);
        buf = t;
      }
    }
    if (buf) out.push(buf);
    return out;
  }

  function stopAudioPlayback() {
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

  async function playSingleClauseUK(clause, rate, mySeq) {
    if (mySeq !== speakSeq) return;
    const clean = String(clause || '').trim();
    if (!clean) return;
    const playRate = Number(rate) || 0.96;

    // 1. Try Cloudflare /api/youdao-tts decoded AudioBuffer ONLY on same-origin Cloudflare Pages (zero CORS errors on localhost/file://!)
    const ctx = ensureAudioCtx();
    const cacheKey = `uk:${clean.toLowerCase()}`;
    if (ctx && isPagesOrigin()) {
      try {
        let buf = ttsCache.get(cacheKey);
        if (!buf) {
          const res = await fetch(getApiUrl(`/api/youdao-tts?audio=${encodeURIComponent(clean)}&type=1`));
          if (res.ok) {
            const arr = await res.arrayBuffer();
            buf = await ctx.decodeAudioData(arr.slice(0));
            if (ttsCache.size > 100) ttsCache.delete(ttsCache.keys().next().value);
            ttsCache.set(cacheKey, buf);
          }
        }
        if (buf && mySeq === speakSeq) {
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
      } catch (_) {}
    }

    if (mySeq !== speakSeq) return;

    // 2. Direct Youdao UK <audio> element (works on localhost & file://!)
    const playedDirect = await new Promise((resolve) => {
      try {
        const a = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=1`);
        a.playbackRate = playRate;
        activeAudioEl = a;
        let settled = false;
        const done = (ok) => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          if (activeAudioEl === a) activeAudioEl = null;
          resolve(ok);
        };
        const estMs = Math.max(2200, Math.min(12000, clean.split(/\s+/).length * 480 + 1800));
        const guard = setTimeout(() => done(true), estMs);
        a.onended = () => done(true);
        a.onerror = () => done(false);
        const p = a.play();
        if (p && typeof p.catch === 'function') p.catch(() => done(false));
      } catch (_) {
        resolve(false);
      }
    });
    if (playedDirect || mySeq !== speakSeq) return;

    // 3. Browser SpeechSynthesis UK fallback
    await new Promise((resolve) => {
      try {
        if (!('speechSynthesis' in window)) {
          setTimeout(resolve, Math.max(1400, clean.split(/\s+/).length * 360));
          return;
        }
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = 'en-GB';
        u.rate = playRate;
        const voices = window.speechSynthesis.getVoices() || [];
        const gb = voices.find((v) => /en[-_]gb/i.test(v.lang)) || voices.find((v) => /en/i.test(v.lang));
        if (gb) u.voice = gb;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(guard);
          resolve();
        };
        const guard = setTimeout(done, Math.max(2000, clean.split(/\s+/).length * 520 + 1500));
        u.onend = done;
        u.onerror = done;
        window.speechSynthesis.speak(u);
      } catch (_) {
        setTimeout(resolve, 1600);
      }
    });
  }

  async function speak(text, opts) {
    const clean = String(text || '').trim();
    const mySeq = ++speakSeq;
    stopAudioPlayback();
    if (!clean) {
      opts?.onDone?.();
      return;
    }

    setMode('speaking');
    const clauses = splitClauses(clean);
    const rate = opts?.rate || 0.96;

    for (let i = 0; i < clauses.length; i++) {
      if (mySeq !== speakSeq) return;
      await playSingleClauseUK(clauses[i], rate, mySeq);
      if (mySeq !== speakSeq) return;
      if (i < clauses.length - 1) {
        await new Promise((r) => setTimeout(r, 180));
      }
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

  /* Optional local Candidate Webcam PiP (100% browser-local, never uploaded) */
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
    stopCandidateCam();
    if (nodTimer) {
      clearTimeout(nodTimer);
      nodTimer = null;
    }
    if (boundParallaxEl && boundMoveFn) boundParallaxEl.removeEventListener('mousemove', boundMoveFn);
    if (boundParallaxEl && boundLeaveFn) boundParallaxEl.removeEventListener('mouseleave', boundLeaveFn);
    boundParallaxEl = null;
  }

  window.SpeakingExaminerCinema = {
    EXAMINERS,
    mount,
    setMode,
    speak,
    stopSpeaking,
    feedMicLevel,
    triggerBriefNod,
    toggleCandidateCam,
    attachCandidateCam,
    stopCandidateCam,
    isWebcamActive: () => webcamActive,
    destroy,
  };
})();
