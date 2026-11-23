/* =========================================================
   TOTORO IELTS MASTER — ULTRA-SENSITIVE SPEECH & STT ENGINE
   ---------------------------------------------------------
   Features:
   - Mic recording with live 12-bar waveform & RMS metering
   - Smart Auto-Stop VAD (stops ~1.25s after user finishes speaking)
   - Browser DSP: 80Hz high-pass filter -> VAD silence trim ->
     Peak Normalization to -3 dBFS (up to +29 dB boost for quiet voices)
     -> clean 16 kHz Mono PCM WAV encoding
   - Calls /api/transcribe (Groq Whisper + Cloudflare Workers AI fallback)
   - Anti-hallucination + Vietnamese-accent-friendly phonetic matching
   ========================================================= */
(function () {
  const FALLBACK_API_BASE = 'https://totoro-ieltsmaster.pages.dev';

  const WHISPER_HALLUCINATIONS = new Set([
    'thank you',
    'thank you very much',
    'thanks for watching',
    'thanks for listening',
    'you',
    'bye',
    'bye bye',
    'goodbye',
    'mbc',
    'amara',
    'subtitles',
    'subtitle',
    'subscribe',
    'music',
    'applause',
    'silence',
    'okay',
    'ok',
    'hmm',
    'uh',
    'um',
  ]);

  let activeSession = null;
  let permissionRequestActive = false;
  let permissionGraceUntil = 0;

  function getApiUrl(path) {
    const loc = window.location;
    const host = String(loc.hostname || '').toLowerCase();
    const isPagesOrigin =
      loc.protocol === 'https:' &&
      (host === 'totoro-ieltsmaster.pages.dev' || host.endsWith('.totoro-ieltsmaster.pages.dev'));
    if (isPagesOrigin) return path;
    return `${FALLBACK_API_BASE}${path}`;
  }

  function isRequestingPermission() {
    return permissionRequestActive || Date.now() < permissionGraceUntil;
  }

  function isSupported() {
    return Boolean(
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window.MediaRecorder !== 'undefined'
    );
  }

  function pickBestMimeType() {
    if (typeof window.MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
      return '';
    }
    const candidates = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4;codecs=mp4a.40.2',
      'audio/mp4',
      'audio/ogg;codecs=opus',
    ];
    for (const mime of candidates) {
      try {
        if (MediaRecorder.isTypeSupported(mime)) return mime;
      } catch (_) {}
    }
    return '';
  }

  /* ---------------------------------------------------------
     DSP PIPELINE: Resample 16kHz -> High-Pass -> VAD Trim ->
     Peak Normalize (-3 dBFS) -> Soft-Clip -> 16-bit Mono WAV
     --------------------------------------------------------- */
  function downsampleTo16k(monoFloat32, srcRate) {
    const dstRate = 16000;
    if (!srcRate || srcRate === dstRate) return monoFloat32;
    const ratio = srcRate / dstRate;
    const outLen = Math.max(1, Math.round(monoFloat32.length / ratio));
    const out = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio);
      const end = Math.min(monoFloat32.length, Math.max(start + 1, Math.floor((i + 1) * ratio)));
      let sum = 0;
      for (let j = start; j < end; j++) sum += monoFloat32[j];
      out[i] = sum / (end - start);
    }
    return out;
  }

  function applyHighPass80Hz(samples, sampleRate) {
    // 1st-order RC high-pass filter (~80Hz) removes DC offset & fan/AC rumble
    const rc = 1 / (2 * Math.PI * 80);
    const dt = 1 / sampleRate;
    const alpha = rc / (rc + dt);
    const out = new Float32Array(samples.length);
    let prevX = 0;
    let prevY = 0;
    for (let i = 0; i < samples.length; i++) {
      const x = samples[i];
      const y = alpha * (prevY + x - prevX);
      out[i] = y;
      prevX = x;
      prevY = y;
    }
    return out;
  }

  function trimAndNormalizeSpeech(samples16k) {
    const sr = 16000;
    const filtered = applyHighPass80Hz(samples16k, sr);
    const frameSize = Math.floor(sr * 0.02); // 20ms frames
    const numFrames = Math.floor(filtered.length / frameSize);
    if (numFrames < 3) {
      return { silent: true, samples: filtered, peakRaw: 0, gainApplied: 1 };
    }

    const frameRms = new Float32Array(numFrames);
    let peakRaw = 0;
    for (let f = 0; f < numFrames; f++) {
      let sumSq = 0;
      const base = f * frameSize;
      for (let i = 0; i < frameSize; i++) {
        const v = filtered[base + i];
        const av = Math.abs(v);
        if (av > peakRaw) peakRaw = av;
        sumSq += v * v;
      }
      frameRms[f] = Math.sqrt(sumSq / frameSize);
    }

    if (peakRaw < 0.0035) {
      return { silent: true, samples: filtered, peakRaw, gainApplied: 1 };
    }

    // Estimate ambient noise floor from lowest 20% energy frames
    const sortedRms = Array.from(frameRms).sort((a, b) => a - b);
    const noiseFloor = sortedRms[Math.floor(sortedRms.length * 0.2)] || 0.001;
    const threshold = Math.max(0.006, Math.min(peakRaw * 0.22, noiseFloor * 2.6));

    let firstActive = -1;
    let lastActive = -1;
    let activeFrames = 0;
    for (let f = 0; f < numFrames; f++) {
      if (frameRms[f] >= threshold) {
        if (firstActive === -1) firstActive = f;
        lastActive = f;
        activeFrames++;
      }
    }

    // Require at least ~80ms of actual voiced activity
    if (firstActive === -1 || activeFrames < 4) {
      return { silent: true, samples: filtered, peakRaw, gainApplied: 1 };
    }

    const padLeadFrames = 8; // 160ms before speech
    const padTailFrames = 10; // 200ms after speech
    const startSample = Math.max(0, (firstActive - padLeadFrames) * frameSize);
    const endSample = Math.min(filtered.length, (lastActive + 1 + padTailFrames) * frameSize);
    const trimmed = filtered.subarray(startSample, endSample);

    // Compute peak inside trimmed region and normalize to -3 dBFS (0.708)
    let trimPeak = 0;
    for (let i = 0; i < trimmed.length; i++) {
      const av = Math.abs(trimmed[i]);
      if (av > trimPeak) trimPeak = av;
    }
    if (trimPeak < 0.0035) {
      return { silent: true, samples: trimmed, peakRaw: trimPeak, gainApplied: 1 };
    }

    const targetPeak = 0.708; // -3 dBFS
    const maxGain = 28; // up to ~+29 dB boost for very quiet voices
    const gain = Math.min(maxGain, targetPeak / trimPeak);

    const normalized = new Float32Array(trimmed.length);
    for (let i = 0; i < trimmed.length; i++) {
      const boosted = trimmed[i] * gain;
      // Gentle soft-clipping above 0.88 prevents harsh distortion
      normalized[i] = Math.abs(boosted) > 0.88 ? Math.tanh(boosted) : boosted;
    }

    return {
      silent: false,
      samples: normalized,
      peakRaw: trimPeak,
      gainApplied: +gain.toFixed(2),
      durationSec: +(normalized.length / sr).toFixed(2),
    };
  }

  function encodeWav16k(samples) {
    const sr = 16000;
    const byteLen = samples.length * 2;
    const buffer = new ArrayBuffer(44 + byteLen);
    const view = new DataView(buffer);

    const writeStr = (offset, str) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + byteLen, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM header size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sr, true); // 16000 Hz
    view.setUint32(28, sr * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // 16-bit
    writeStr(36, 'data');
    view.setUint32(40, byteLen, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const clamped = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }

  async function processBlobToNormalizedWav(rawBlob) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return { blob: rawBlob, filename: 'speech.webm', silent: false, gainApplied: 1, boosted: false };
    }
    const ctx = new AudioCtx();
    try {
      const arrayBuf = await rawBlob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
      // Mix down to mono
      const len = audioBuf.length;
      const mono = new Float32Array(len);
      const chCount = audioBuf.numberOfChannels || 1;
      for (let c = 0; c < chCount; c++) {
        const chData = audioBuf.getChannelData(c);
        for (let i = 0; i < len; i++) mono[i] += chData[i] / chCount;
      }
      const samples16k = downsampleTo16k(mono, audioBuf.sampleRate);
      const dsp = trimAndNormalizeSpeech(samples16k);
      if (dsp.silent) {
        return { silent: true, peakRaw: dsp.peakRaw, gainApplied: 1, boosted: false };
      }
      const wavBlob = encodeWav16k(dsp.samples);
      return {
        blob: wavBlob,
        filename: 'speech.wav',
        silent: false,
        peakRaw: dsp.peakRaw,
        gainApplied: dsp.gainApplied,
        boosted: dsp.gainApplied >= 2.2,
        durationSec: dsp.durationSec,
      };
    } catch (_) {
      // Fallback: send raw recording directly if browser cannot decode its own MediaRecorder container
      const mime = rawBlob.type || 'audio/webm';
      const ext = /mp4|m4a|aac/i.test(mime) ? 'm4a' : /ogg/i.test(mime) ? 'ogg' : 'webm';
      return { blob: rawBlob, filename: `speech.${ext}`, silent: false, gainApplied: 1, boosted: false };
    } finally {
      try { await ctx.close(); } catch (_) {}
    }
  }

  /* ---------------------------------------------------------
     SMART PHONETIC & ACCENT-FRIENDLY WORD MATCHING
     --------------------------------------------------------- */
  function normalizeEnglishText(raw) {
    let s = String(raw || '')
      .toLowerCase()
      .replace(/[’'`]/g, "'")
      .replace(/[-‐‑–—]/g, ' ')
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Unify common UK/US spelling differences
    const tokens = s.split(' ').filter(Boolean).map((tok) =>
      tok
        .replace(/our$/g, 'or')
        .replace(/ours$/g, 'ors')
        .replace(/ised$/g, 'ized')
        .replace(/ising$/g, 'izing')
        .replace(/ise$/g, 'ize')
        .replace(/isation$/g, 'ization')
        .replace(/metre$/g, 'meter')
        .replace(/centre$/g, 'center')
        .replace(/theatre$/g, 'theater')
        .replace(/defence$/g, 'defense')
        .replace(/offence$/g, 'offense')
        .replace(/licence$/g, 'license')
        .replace(/practise$/g, 'practice')
        .replace(/travelling$/g, 'traveling')
        .replace(/travelled$/g, 'traveled')
        .replace(/cancelling$/g, 'canceling')
        .replace(/cancelled$/g, 'canceled')
        .replace(/programme$/g, 'program')
        .replace(/catalogue$/g, 'catalog')
        .replace(/dialogue$/g, 'dialog')
        .replace(/grey$/g, 'gray')
    );
    return tokens.join(' ');
  }

  function phoneticSkeleton(word) {
    let w = normalizeEnglishText(word).replace(/[^a-z]/g, '');
    if (!w) return '';
    // Normalize common English phonetic equivalents & gentle Vietnamese-accent shifts
    w = w
      .replace(/^kn/, 'n')
      .replace(/^wr/, 'r')
      .replace(/^ps/, 's')
      .replace(/^wh/, 'w')
      .replace(/ph/g, 'f')
      .replace(/gh(?=[aeiou]|$)/g, '')
      .replace(/ght/g, 't')
      .replace(/tion|sion|cion/g, 'shn')
      .replace(/tious|cious/g, 'shs')
      .replace(/qu/g, 'kw')
      .replace(/ck/g, 'k')
      .replace(/c(?=[eiy])/g, 's')
      .replace(/c/g, 'k')
      .replace(/x/g, 'ks')
      .replace(/z/g, 's')
      .replace(/th/g, 't')
      .replace(/sh|ch/g, 's')
      .replace(/dg|j/g, 'g')
      .replace(/w/g, 'v')
      .replace(/y/g, 'i')
      .replace(/([a-z])\1+/g, '$1');
    // Collapse unstressed internal vowels gently while keeping initial sound intact
    if (w.length > 3) {
      const head = w[0];
      const tail = w.slice(1).replace(/[aeiou]+/g, 'a');
      w = head + tail;
    }
    return w;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = new Array(n + 1);
    for (let j = 0; j <= n; j++) dp[j] = j;
    for (let i = 1; i <= m; i++) {
      let prev = dp[0];
      dp[0] = i;
      for (let j = 1; j <= n; j++) {
        const tmp = dp[j];
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
        prev = tmp;
      }
    }
    return dp[n];
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    return Math.max(0, 1 - levenshtein(a, b) / maxLen);
  }

  function stripInflection(tok) {
    if (tok.length <= 4) return tok;
    if (tok.endsWith('ies') && tok.length > 4) return tok.slice(0, -3) + 'y';
    if (tok.endsWith('es') && tok.length > 4) return tok.slice(0, -2);
    if (tok.endsWith('s') && !tok.endsWith('ss') && tok.length > 4) return tok.slice(0, -1);
    if (tok.endsWith('ed') && tok.length > 5) return tok.slice(0, -2);
    return tok;
  }

  function scoreSingleWord(spokenTok, targetTok) {
    if (!spokenTok || !targetTok) return 0;
    if (spokenTok === targetTok) return 1.0;

    // Gentle morphological tolerance for trailing -s/-ed when accent drops/adds final consonant
    if (stripInflection(spokenTok) === stripInflection(targetTok)) return 0.94;

    const charSim = similarity(spokenTok, targetTok);
    const pSpoken = phoneticSkeleton(spokenTok);
    const pTarget = phoneticSkeleton(targetTok);
    const phonSim = similarity(pSpoken, pTarget);

    // Short words (<= 4 chars) need tighter accuracy so "cat" never matches "cut"
    if (targetTok.length <= 4) {
      if (pSpoken && pSpoken === pTarget && charSim >= 0.6) return 0.88;
      return charSim >= 0.85 ? charSim : Math.min(charSim, 0.55);
    }

    // Medium/long academic words: reward strong phonetic skeleton match
    if (pSpoken && pSpoken === pTarget) return Math.max(0.9, charSim);
    return Math.max(charSim, phonSim * 0.94);
  }

  function matchSpokenTarget(spokenRaw, targetLemma) {
    const heardClean = String(spokenRaw || '').trim();
    const spokenNorm = normalizeEnglishText(heardClean);

    if (!spokenNorm || WHISPER_HALLUCINATIONS.has(spokenNorm)) {
      const targetNormCheck = normalizeEnglishText(targetLemma);
      // Only allow words like "okay" / "music" / "silence" if that IS actually the target word!
      if (!spokenNorm || !targetNormCheck.split('/').some((v) => v.trim() === spokenNorm)) {
        return {
          matched: false,
          score: 0,
          heard: heardClean,
          isNoise: true,
          reason: 'Chưa nghe rõ từ tiếng Anh — hãy nói to, rõ hơn gần mic rồi thử lại.',
        };
      }
    }

    // Support slash variants like "colour / color" or "rise / increase"
    const rawVariants = String(targetLemma || '')
      .split('/')
      .map((v) => v.replace(/\([^)]*\)/g, '').trim())
      .filter(Boolean);
    const variants = rawVariants.length ? rawVariants : [String(targetLemma || '').trim()];

    const spokenTokens = spokenNorm.split(' ').filter(Boolean);
    // Also strip filler words if student says "a ...", "the ...", "to ..."
    const contentSpokenTokens = spokenTokens.filter((t) => !['a', 'an', 'the', 'to', 'uh', 'um'].includes(t));

    let bestScore = 0;
    let bestVariant = variants[0] || '';

    for (const variant of variants) {
      const targetNorm = normalizeEnglishText(variant);
      if (!targetNorm) continue;
      const targetTokens = targetNorm.split(' ').filter(Boolean);

      let score = 0;
      if (spokenNorm === targetNorm) {
        score = 1.0;
      } else if (targetTokens.length === 1) {
        const tgt = targetTokens[0];
        // Check whole spoken joined (handles Whisper splitting compound words like "with draw" -> "withdraw")
        const joinedSpoken = spokenTokens.join('');
        score = Math.max(score, scoreSingleWord(joinedSpoken, tgt));
        // Check each spoken token (in case user said "the word ubiquitous")
        if (spokenTokens.length <= 4) {
          for (const tok of spokenTokens) {
            score = Math.max(score, scoreSingleWord(tok, tgt));
          }
        }
        if (contentSpokenTokens.length === 1) {
          score = Math.max(score, scoreSingleWord(contentSpokenTokens[0], tgt));
        }
      } else {
        // Multi-word phrase / collocation: match each target token against best spoken token
        let matchedSum = 0;
        for (const tTok of targetTokens) {
          let bestTok = 0;
          for (const sTok of spokenTokens) {
            bestTok = Math.max(bestTok, scoreSingleWord(sTok, tTok));
          }
          matchedSum += bestTok;
        }
        const tokenAvg = matchedSum / targetTokens.length;
        const fullSim = similarity(spokenNorm, targetNorm);
        // Penalize extra unrelated chatter if user read a whole paragraph
        const lengthPenalty = spokenTokens.length > targetTokens.length + 3 ? 0.85 : 1;
        score = Math.max(tokenAvg, fullSim) * lengthPenalty;
      }

      if (score > bestScore) {
        bestScore = score;
        bestVariant = variant;
      }
    }

    const bestTargetClean = normalizeEnglishText(bestVariant);
    const threshold = bestTargetClean.length <= 4 ? 0.84 : bestTargetClean.length <= 7 ? 0.77 : 0.74;
    const matched = bestScore >= threshold;

    return {
      matched,
      score: +bestScore.toFixed(3),
      heard: heardClean,
      bestVariant,
      isNoise: false,
      reason: matched
        ? 'Phát âm rõ ràng và chính xác!'
        : `AI nghe thành "${heardClean}" — hãy nghe lại mẫu rồi nói rõ trọng âm & âm cuối nhé.`,
    };
  }

  /* ---------------------------------------------------------
     NETWORK UPLOAD TO /api/transcribe
     --------------------------------------------------------- */
  async function transcribeBlob(blob, filename, mode = 'word') {
    const fd = new FormData();
    fd.append('file', blob, filename || 'speech.wav');
    fd.append('mode', mode);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 22000);
    try {
      const res = await fetch(getApiUrl('/api/transcribe'), {
        method: 'POST',
        body: fd,
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `Lỗi máy chủ STT (HTTP ${res.status})`);
      }
      return data;
    } catch (err) {
      if (err?.name === 'AbortError') {
        throw new Error('Kết nối AI quá thời gian chờ — kiểm tra mạng rồi thử lại nhé.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /* ---------------------------------------------------------
     RECORDING SESSION CONTROLLER (START / STOP / ABORT)
     --------------------------------------------------------- */
  function cleanupSession(sess) {
    if (!sess) return;
    if (sess.rafId) cancelAnimationFrame(sess.rafId);
    if (sess.maxTimer) clearTimeout(sess.maxTimer);
    try {
      if (sess.recorder && sess.recorder.state !== 'inactive') {
        sess.recorder.stop();
      }
    } catch (_) {}
    try {
      if (sess.stream) {
        sess.stream.getTracks().forEach((t) => t.stop());
      }
    } catch (_) {}
    try {
      if (sess.audioCtx && sess.audioCtx.state !== 'closed') {
        sess.audioCtx.close();
      }
    } catch (_) {}
    if (activeSession === sess) activeSession = null;
  }

  function abort() {
    if (!activeSession) return;
    const sess = activeSession;
    sess.aborted = true;
    cleanupSession(sess);
  }

  function stop() {
    if (!activeSession) return false;
    const sess = activeSession;
    if (sess.stopping) return false;
    sess.stopping = true;
    if (sess.rafId) cancelAnimationFrame(sess.rafId);
    if (sess.maxTimer) clearTimeout(sess.maxTimer);
    try {
      if (sess.recorder && sess.recorder.state === 'recording') {
        sess.recorder.stop();
        return true;
      }
    } catch (_) {}
    cleanupSession(sess);
    return false;
  }

  function isRecording() {
    return Boolean(activeSession && !activeSession.stopping && !activeSession.aborted);
  }

  /**
   * Start a recording + DSP + STT session.
   * Options:
   *  - mode: 'word' | 'speaking'
   *  - maxDurationMs: default 5500 for 'word', 120000 for 'speaking'
   *  - autoStopOnSilence: default true for 'word'
   *  - onStart()
   *  - onLevel({ rms, bars, speechDetected })
   *  - onProcessing({ boosted, gainApplied, durationSec })
   *  - onResult({ ok, text, words, segments, engine, boosted, gainApplied, durationSec, silent })
   *  - onError(message)
   */
  async function startRecording(opts = {}) {
    if (!isSupported()) {
      opts.onError?.('Trình duyệt hiện tại không hỗ trợ thu âm micro.');
      return false;
    }
    if (activeSession) abort();

    const mode = opts.mode || 'word';
    const maxDurationMs = opts.maxDurationMs || (mode === 'word' ? 5800 : 120000);
    const autoStopOnSilence = opts.autoStopOnSilence !== undefined ? Boolean(opts.autoStopOnSilence) : mode === 'word';

    let stream;
    permissionRequestActive = true;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      permissionRequestActive = false;
      permissionGraceUntil = Date.now() + 700;
      const name = String(err?.name || '');
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        opts.onError?.('Bạn chưa cấp quyền Micro cho trình duyệt. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ → Cho phép Micro nhé!');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        opts.onError?.('Không tìm thấy Micro trên thiết bị của bạn.');
      } else {
        opts.onError?.('Không thể mở Micro: ' + (err?.message || 'lỗi không xác định'));
      }
      return false;
    }
    permissionRequestActive = false;
    permissionGraceUntil = Date.now() + 700;

    const sess = {
      stream,
      audioCtx: null,
      analyser: null,
      recorder: null,
      chunks: [],
      rafId: null,
      maxTimer: null,
      stopping: false,
      aborted: false,
      startedAt: Date.now(),
      speechDetectedAt: 0,
      lastVoiceAt: 0,
    };
    activeSession = sess;

    // Live audio level meter + VAD auto-stop
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      try {
        sess.audioCtx = new AudioCtx();
        const src = sess.audioCtx.createMediaStreamSource(stream);
        sess.analyser = sess.audioCtx.createAnalyser();
        sess.analyser.fftSize = 256;
        sess.analyser.smoothingTimeConstant = 0.65;
        src.connect(sess.analyser);

        const timeData = new Uint8Array(sess.analyser.fftSize);
        const freqData = new Uint8Array(sess.analyser.frequencyBinCount);

        const tickMeter = () => {
          if (sess.aborted || sess.stopping) return;
          sess.analyser.getByteTimeDomainData(timeData);
          sess.analyser.getByteFrequencyData(freqData);

          let sumSq = 0;
          for (let i = 0; i < timeData.length; i++) {
            const v = (timeData[i] - 128) / 128;
            sumSq += v * v;
          }
          const rms = Math.sqrt(sumSq / timeData.length);

          // Build 12 responsive bars from lower-mid voice frequencies
          const bars = [];
          const binsPerBar = 4;
          for (let b = 0; b < 12; b++) {
            let acc = 0;
            for (let k = 0; k < binsPerBar; k++) {
              acc += freqData[1 + b * binsPerBar + k] || 0;
            }
            // Boost quiet voices visually so user sees clear feedback even when speaking softly
            const norm = Math.min(1, (acc / (binsPerBar * 255)) * 2.1 + rms * 2.4);
            bars.push(+norm.toFixed(3));
          }

          const now = Date.now();
          if (rms > 0.014) {
            if (!sess.speechDetectedAt) sess.speechDetectedAt = now;
            sess.lastVoiceAt = now;
          }

          opts.onLevel?.({ rms, bars, speechDetected: Boolean(sess.speechDetectedAt) });

          // Auto-stop ~1.15s after speech finishes in single-word mode
          if (
            autoStopOnSilence &&
            sess.speechDetectedAt &&
            now - sess.speechDetectedAt >= 320 &&
            now - sess.lastVoiceAt >= 1150
          ) {
            stop();
            return;
          }

          sess.rafId = requestAnimationFrame(tickMeter);
        };
        sess.rafId = requestAnimationFrame(tickMeter);
      } catch (_) {}
    }

    const mimeType = pickBestMimeType();
    try {
      sess.recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    } catch (_) {
      sess.recorder = new MediaRecorder(stream);
    }

    sess.recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) sess.chunks.push(ev.data);
    };

    sess.recorder.onstop = async () => {
      const wasAborted = sess.aborted;
      const chunks = sess.chunks.slice();
      const recMime = sess.recorder?.mimeType || mimeType || 'audio/webm';
      cleanupSession(sess);
      if (wasAborted) return;

      if (!chunks.length) {
        opts.onResult?.({ ok: true, silent: true, text: '', engine: '' });
        return;
      }

      const rawBlob = new Blob(chunks, { type: recMime });
      opts.onProcessing?.({ stage: 'dsp' });

      try {
        const processed = await processBlobToNormalizedWav(rawBlob);
        if (sess.aborted) return;
        if (processed.silent) {
          opts.onResult?.({ ok: true, silent: true, text: '', engine: '', gainApplied: 1 });
          return;
        }
        opts.onProcessing?.({
          stage: 'upload',
          boosted: processed.boosted,
          gainApplied: processed.gainApplied,
          durationSec: processed.durationSec,
        });
        const stt = await transcribeBlob(processed.blob, processed.filename, mode);
        if (sess.aborted) return;
        opts.onResult?.({
          ok: true,
          silent: false,
          text: stt.text || '',
          words: stt.words || [],
          segments: stt.segments || [],
          engine: stt.engine || '',
          boosted: processed.boosted,
          gainApplied: processed.gainApplied,
          durationSec: processed.durationSec,
        });
      } catch (err) {
        if (sess.aborted) return;
        opts.onError?.(err?.message || 'Lỗi khi nhận diện giọng nói.');
      }
    };

    sess.recorder.start(100);
    opts.onStart?.();

    sess.maxTimer = setTimeout(() => {
      if (activeSession === sess && !sess.stopping) stop();
    }, maxDurationMs);

    return true;
  }

  async function checkHealth() {
    const res = await fetch(getApiUrl('/api/health'));
    return res.json();
  }

  window.TotoroSpeechSTT = {
    isSupported,
    isRecording,
    isRequestingPermission,
    startRecording,
    stop,
    abort,
    matchSpokenTarget,
    checkHealth,
    getApiUrl,
  };
})();
