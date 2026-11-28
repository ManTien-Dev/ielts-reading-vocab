/* =========================================================
   TOTORO IELTS MASTER — ULTRA-SENSITIVE SPEECH & STT ENGINE V2
   ---------------------------------------------------------
   Fixes & Upgrades for Quiet Voices + Non-Native Accents:
   1. Disables Chrome's aggressive `noiseSuppression` (which eats
      soft onset/offset consonants on 0.5s words like "user").
   2. Uses native `OfflineAudioContext` anti-aliased sinc resampling
      to 16 kHz Mono (preserves /s, z, sh, th/ clarity cleanly).
   3. Gentle non-destructive normalization to -2 dBFS (+ up to +30 dB
      boost for quiet voices) with 350ms silence framing — NEVER slices
      off weak initial/final consonants!
   4. Uses full `whisper-large-v3` by default (far more accurate than
      turbo on short words & non-native accents), with optional A/B
      switches (`v3` | `turbo` | `cf`) and Raw WebM vs Boosted WAV.
   5. Exposes `audioUrl` so user can replay the exact audio sent to AI,
      plus `compareSentence()` for testing long sentences & paragraphs.
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
    'clear english vocabulary word pronunciation spoken aloud',
    'clear english vocabulary word pronunciation',
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
     STUDIO DSP PIPELINE (Anti-Aliased Resample + Gentle Boost)
     --------------------------------------------------------- */
  async function resampleBufferTo16kMono(audioBuf) {
    const targetRate = 16000;
    const duration = audioBuf.duration || (audioBuf.length / (audioBuf.sampleRate || 48000));
    const targetLen = Math.max(1, Math.ceil(duration * targetRate));
    const OfflineCtx = window.OfflineAudioContext || window.webkitOfflineAudioContext;

    if (OfflineCtx && audioBuf.sampleRate !== targetRate) {
      try {
        const offline = new OfflineCtx(1, targetLen, targetRate);
        const src = offline.createBufferSource();
        src.buffer = audioBuf;
        // Subtle 75Hz high-pass biquad removes DC offset & desk/AC rumble without touching voice
        const hp = offline.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 75;
        src.connect(hp);
        hp.connect(offline.destination);
        src.start(0);
        const rendered = await offline.startRendering();
        return rendered.getChannelData(0);
      } catch (_) {}
    }

    // Fallback mono mix + linear interpolation
    const chCount = audioBuf.numberOfChannels || 1;
    const len = audioBuf.length;
    const mono = new Float32Array(len);
    for (let c = 0; c < chCount; c++) {
      const data = audioBuf.getChannelData(c);
      for (let i = 0; i < len; i++) mono[i] += data[i] / chCount;
    }
    if (audioBuf.sampleRate === targetRate) return mono;
    const ratio = audioBuf.sampleRate / targetRate;
    const out = new Float32Array(targetLen);
    for (let i = 0; i < targetLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = mono[Math.min(len - 1, idx)] || 0;
      const b = mono[Math.min(len - 1, idx + 1)] || a;
      out[i] = a + (b - a) * frac;
    }
    return out;
  }

  function frameAndNormalizeSpeech(samples16k, isSingleWord) {
    const sr = 16000;
    if (!samples16k || samples16k.length < sr * 0.08) {
      return { silent: true, samples: samples16k, peakRaw: 0, gainApplied: 1 };
    }

    // Compute overall peak and 20ms frame RMS
    const frameSize = Math.floor(sr * 0.02);
    const numFrames = Math.floor(samples16k.length / frameSize);
    let peakRaw = 0;
    const frameRms = new Float32Array(numFrames);

    for (let f = 0; f < numFrames; f++) {
      let sumSq = 0;
      const base = f * frameSize;
      for (let i = 0; i < frameSize; i++) {
        const v = samples16k[base + i];
        const av = Math.abs(v);
        if (av > peakRaw) peakRaw = av;
        sumSq += v * v;
      }
      frameRms[f] = Math.sqrt(sumSq / frameSize);
    }

    // Truly dead mic check (super sensitive floor so quiet voices pass easily)
    if (peakRaw < 0.0018) {
      return { silent: true, samples: samples16k, peakRaw, gainApplied: 1 };
    }

    // Super gentle trim: ONLY strip dead silence > 400ms from ends; NEVER slice soft consonants!
    const sorted = Array.from(frameRms).sort((a, b) => a - b);
    const noiseFloor = sorted[Math.floor(sorted.length * 0.15)] || 0.0005;
    const gentleThresh = Math.max(0.0025, Math.min(peakRaw * 0.08, noiseFloor * 2.0));

    let firstActive = 0;
    let lastActive = numFrames - 1;
    let foundAny = false;
    for (let f = 0; f < numFrames; f++) {
      if (frameRms[f] >= gentleThresh) {
        if (!foundAny) { firstActive = f; foundAny = true; }
        lastActive = f;
      }
    }

    if (!foundAny) {
      return { silent: true, samples: samples16k, peakRaw, gainApplied: 1 };
    }

    // Keep generous 360ms lead & 460ms tail around detected sound
    const leadFrames = 18; // 360ms
    const tailFrames = 23; // 460ms
    const startSample = Math.max(0, (firstActive - leadFrames) * frameSize);
    const endSample = Math.min(samples16k.length, (lastActive + 1 + tailFrames) * frameSize);
    const core = samples16k.subarray(startSample, endSample);

    // Measure peak inside core and normalize to -2 dBFS (0.794)
    let corePeak = 0;
    for (let i = 0; i < core.length; i++) {
      const av = Math.abs(core[i]);
      if (av > corePeak) corePeak = av;
    }
    if (corePeak < 0.0018) {
      return { silent: true, samples: core, peakRaw: corePeak, gainApplied: 1 };
    }

    const targetPeak = 0.794; // -2 dBFS
    const maxGain = 32; // up to +30 dB for whisper-quiet voices
    const gain = Math.min(maxGain, targetPeak / corePeak);

    // Add 320ms clean silence framing before & after short single-word audio
    // (Whisper's encoder needs clean onset/offset framing for short <2s clips!)
    const padSamples = isSingleWord ? Math.floor(sr * 0.32) : Math.floor(sr * 0.15);
    const out = new Float32Array(padSamples + core.length + padSamples);

    for (let i = 0; i < core.length; i++) {
      const boosted = core[i] * gain;
      // Smooth soft-knee limiter above 0.88 prevents clipping pops
      out[padSamples + i] = Math.abs(boosted) > 0.88 ? Math.tanh(boosted) : boosted;
    }

    // Apply tiny 15ms fade-in/out on the core boundaries to prevent digital click
    const fadeLen = Math.min(Math.floor(sr * 0.015), Math.floor(core.length / 4));
    for (let i = 0; i < fadeLen; i++) {
      const k = i / fadeLen;
      out[padSamples + i] *= k;
      out[padSamples + core.length - 1 - i] *= k;
    }

    return {
      silent: false,
      samples: out,
      peakRaw: corePeak,
      gainApplied: +gain.toFixed(2),
      durationSec: +(out.length / sr).toFixed(2),
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
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sr, true);
    view.setUint32(28, sr * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
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

  async function processBlobToNormalizedWav(rawBlob, isSingleWord) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return { blob: rawBlob, filename: 'speech.webm', silent: false, gainApplied: 1, boosted: false };
    }
    const ctx = new AudioCtx();
    try {
      const arrayBuf = await rawBlob.arrayBuffer();
      const audioBuf = await ctx.decodeAudioData(arrayBuf.slice(0));
      const samples16k = await resampleBufferTo16kMono(audioBuf);
      const dsp = frameAndNormalizeSpeech(samples16k, isSingleWord);
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
        boosted: dsp.gainApplied >= 2.0,
        durationSec: dsp.durationSec,
      };
    } catch (_) {
      const mime = rawBlob.type || 'audio/webm';
      const ext = /mp4|m4a|aac/i.test(mime) ? 'm4a' : /ogg/i.test(mime) ? 'ogg' : 'webm';
      return { blob: rawBlob, filename: `speech.${ext}`, silent: false, gainApplied: 1, boosted: false };
    } finally {
      try { await ctx.close(); } catch (_) {}
    }
  }

  /* ---------------------------------------------------------
     SMART PHONETIC & ACCENT-FRIENDLY WORD + SENTENCE MATCHER
     --------------------------------------------------------- */
  function normalizeEnglishText(raw) {
    let s = String(raw || '')
      .toLowerCase()
      .replace(/[’'`]/g, "'")
      .replace(/[-‐‑–—]/g, ' ')
      .replace(/[^a-z0-9'\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

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

  const THRESHOLD_STORAGE_KEY = 'totoro_stt_threshold_v1';

  function getDefaultThreshold() {
    try {
      const saved = parseFloat(localStorage.getItem(THRESHOLD_STORAGE_KEY) || '');
      if (Number.isFinite(saved) && saved >= 0.45 && saved <= 0.9) return saved;
    } catch (_) {}
    return 0.55; // Friendly default (~55%): passes natural VN accent & single-word quirks, blocks random words
  }

  function setDefaultThreshold(val) {
    const num = Math.max(0.45, Math.min(0.9, Number(val) || 0.55));
    try { localStorage.setItem(THRESHOLD_STORAGE_KEY, String(num)); } catch (_) {}
    return num;
  }

  const SOFT_ACOUSTIC_PAIRS = new Set([
    'fp', 'pf', 'fh', 'hf', 'ph', 'hp', 'fv', 'vf', 'bv', 'vb', 'bp', 'pb',
    'dt', 'td', 'gk', 'kg', 'sz', 'zs', 'mn', 'nm', 'lr', 'rl', 'ln', 'nl', 'rn', 'nr',
    'cs', 'sc', 'gj', 'jg', 'vw', 'wv',
  ]);

  function toAcousticSeq(word) {
    let w = normalizeEnglishText(word).replace(/[^a-z]/g, '');
    if (!w) return '';
    const isShort = w.length <= 3;
    w = w
      .replace(/^you/, 'Yu')
      .replace(/^use/, 'Yus')
      .replace(/^usu/, 'Yusu')
      .replace(/^uni/, 'Yuni')
      .replace(/^uti/, 'Yuti')
      .replace(/^eu/, 'Yu')
      .replace(/^y/, 'Y')
      .replace(/^kn/, 'n')
      .replace(/^wr/, 'r')
      .replace(/^ps/, 's')
      .replace(/^wh/, 'w')
      .replace(/sch/g, 'sk')
      .replace(/tion|sion|cion/g, 'sn')
      .replace(/tious|cious/g, 'ss')
      .replace(/ture$/g, 'sr')
      .replace(/sure$/g, 'sr')
      .replace(/ph/g, 'f')
      .replace(/gh(?=[aeiou]|$)/g, '')
      .replace(/ght/g, 't')
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
      .replace(/Y/g, 'y')
      .replace(/(er|or|ar|ir|ur)$/g, 'a')
      .replace(/ual$/g, 'al')
      .replace(/e$/g, '')
      .replace(/([a-z])\1+/g, '$1');
    // For words >= 4 chars, collapse unstressed English schwa/vowels into neutral 'A'
    // so "pan-na-na-man" / "Her-na-na-man" matches "phenomenon" like a human listener!
    if (!isShort) {
      w = w.replace(/[aeiou]+/g, 'A');
    }
    return w;
  }

  function acousticSubCost(a, b) {
    if (a === b) return 0;
    if (SOFT_ACOUSTIC_PAIRS.has(a + b)) return 0.35;
    return 1.0;
  }

  function weightedDamerau(a, b) {
    if (a === b) return 0;
    const m = a.length;
    const n = b.length;
    if (!m) return n;
    if (!n) return m;
    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        const cost = acousticSubCost(a[i - 1], b[j - 1]);
        let v = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
        if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
          v = Math.min(v, dp[i - 2][j - 2] + 0.5);
        }
        dp[i][j] = v;
      }
    }
    return dp[m][n];
  }

  function toPhoneticCode(word) {
    return toAcousticSeq(word);
  }

  function consonantCore(phon) {
    return String(phon || '').replace(/[aeiouA]/g, '');
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
    if (tok.length <= 3) return tok;
    if (tok.endsWith('ies') && tok.length > 4) return tok.slice(0, -3) + 'y';
    if (tok.endsWith('es') && tok.length > 4) return tok.slice(0, -2);
    if (tok.endsWith('s') && !tok.endsWith('ss') && tok.length > 3) return tok.slice(0, -1);
    if (tok.endsWith('ed') && tok.length > 4) return tok.slice(0, -2);
    if (tok.endsWith('er') && tok.length > 4) return tok.slice(0, -1);
    return tok;
  }

  function scoreSingleWordDetailed(spokenTok, targetTok) {
    if (!spokenTok || !targetTok) return { score: 0, charSim: 0, phonSim: 0 };
    if (spokenTok === targetTok) return { score: 1.0, charSim: 1.0, phonSim: 1.0 };

    const charSim = similarity(spokenTok, targetTok);
    const pSpoken = toAcousticSeq(spokenTok);
    const pTarget = toAcousticSeq(targetTok);
    const seqMax = Math.max(pSpoken.length, pTarget.length) || 1;
    const seqSim = Math.max(0, 1 - weightedDamerau(pSpoken, pTarget) / seqMax);

    const cSpoken = consonantCore(pSpoken);
    const cTarget = consonantCore(pTarget);
    const cMax = Math.max(cSpoken.length, cTarget.length) || 1;
    const consSim = (cSpoken && cTarget) ? Math.max(0, 1 - weightedDamerau(cSpoken, cTarget) / cMax) : 0;

    // Acoustic phonetic blend: 55% full syllable/vowel-neutralized sequence + 45% consonant skeleton
    const phonSim = (cSpoken && cTarget) ? (seqSim * 0.55 + consSim * 0.45) : seqSim;

    // Anti-gibberish guard: require real acoustic consonant overlap OR decent spelling match
    const hasPhoneticAnchor = consSim >= 0.35 || charSim >= 0.5;
    if (!hasPhoneticAnchor) {
      return { score: Math.min(0.28, Math.max(charSim * 0.6, phonSim * 0.5)), charSim, phonSim };
    }

    // Short 2-3 letter minimal pairs (e.g. "cat" vs "cut"): keep vowel distinction strict
    if (targetTok.length <= 3) {
      const shortScore = charSim * 0.7 + phonSim * 0.3;
      return { score: shortScore, charSim, phonSim };
    }

    const morphBonus = stripInflection(spokenTok) === stripInflection(targetTok) ? 0.92 : 0;

    let prefixBonus = 0;
    const minL = Math.min(spokenTok.length, targetTok.length);
    const maxL = Math.max(spokenTok.length, targetTok.length);
    if (minL >= 3 && (targetTok.startsWith(spokenTok) || spokenTok.startsWith(targetTok))) {
      prefixBonus = Math.min(0.92, (minL / maxL) + 0.12);
    }

    const lenRatio = minL / maxL;
    const rawBest = Math.max(charSim, phonSim, morphBonus, prefixBonus);
    const finalScore = lenRatio < 0.4 ? rawBest * 0.72 : rawBest;
    return { score: Math.min(1, finalScore), charSim, phonSim };
  }

  function scoreSingleWord(spokenTok, targetTok) {
    return scoreSingleWordDetailed(spokenTok, targetTok).score;
  }

  function matchSpokenTarget(spokenRaw, targetLemma, opts = {}) {
    const heardClean = String(spokenRaw || '').trim();
    const spokenNorm = normalizeEnglishText(heardClean);
    const threshold = Number.isFinite(Number(opts.threshold))
      ? Math.max(0.45, Math.min(0.9, Number(opts.threshold)))
      : getDefaultThreshold();

    if (!spokenNorm || WHISPER_HALLUCINATIONS.has(spokenNorm)) {
      const targetNormCheck = normalizeEnglishText(targetLemma);
      if (!spokenNorm || !targetNormCheck.split('/').some((v) => v.trim() === spokenNorm)) {
        return {
          matched: false,
          score: 0,
          charSim: 0,
          phonSim: 0,
          threshold,
          heard: heardClean,
          isNoise: true,
          reason: 'Chưa nghe rõ từ tiếng Anh — hãy nói to, rõ hơn gần mic rồi thử lại.',
        };
      }
    }

    const rawVariants = String(targetLemma || '')
      .split('/')
      .map((v) => v.replace(/\([^)]*\)/g, '').trim())
      .filter(Boolean);
    const variants = rawVariants.length ? rawVariants : [String(targetLemma || '').trim()];

    const spokenTokens = spokenNorm.split(' ').filter(Boolean);
    const contentSpokenTokens = spokenTokens.filter((t) => !['a', 'an', 'the', 'to', 'uh', 'um'].includes(t));

    // Build candidate spoken strings (single tokens + adjacent 2/3-word joins like "you sir" -> "yousir")
    const mergedCandidates = new Set();
    if (spokenTokens.length) mergedCandidates.add(spokenTokens.join(''));
    if (contentSpokenTokens.length) mergedCandidates.add(contentSpokenTokens.join(''));
    for (let i = 0; i < spokenTokens.length; i++) {
      mergedCandidates.add(spokenTokens[i]);
      if (i + 1 < spokenTokens.length) mergedCandidates.add(spokenTokens[i] + spokenTokens[i + 1]);
      if (i + 2 < spokenTokens.length) mergedCandidates.add(spokenTokens[i] + spokenTokens[i + 1] + spokenTokens[i + 2]);
    }

    let bestScore = 0;
    let bestCharSim = 0;
    let bestPhonSim = 0;
    let bestVariant = variants[0] || '';

    for (const variant of variants) {
      const targetNorm = normalizeEnglishText(variant);
      if (!targetNorm) continue;
      const targetTokens = targetNorm.split(' ').filter(Boolean);

      let score = 0;
      let charSim = 0;
      let phonSim = 0;

      if (spokenNorm === targetNorm) {
        score = 1.0; charSim = 1.0; phonSim = 1.0;
      } else if (targetTokens.length === 1) {
        const tgt = targetTokens[0];
        for (const cand of mergedCandidates) {
          const det = scoreSingleWordDetailed(cand, tgt);
          if (det.score > score) {
            score = det.score;
            charSim = det.charSim;
            phonSim = det.phonSim;
          }
        }
      } else {
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
        const fullPhon = similarity(toPhoneticCode(spokenNorm), toPhoneticCode(targetNorm));
        const lengthPenalty = spokenTokens.length > targetTokens.length + 4 ? 0.85 : 1;
        score = Math.max(tokenAvg, fullSim, fullPhon) * lengthPenalty;
        charSim = fullSim;
        phonSim = fullPhon;
      }

      if (score > bestScore) {
        bestScore = score;
        bestCharSim = charSim;
        bestPhonSim = phonSim;
        bestVariant = variant;
      }
    }

    const matched = bestScore >= threshold;

    return {
      matched,
      score: +bestScore.toFixed(3),
      charSim: +bestCharSim.toFixed(3),
      phonSim: +bestPhonSim.toFixed(3),
      threshold,
      heard: heardClean,
      bestVariant,
      isNoise: false,
      reason: matched
        ? `Khớp âm đọc ${Math.round(bestScore * 100)}% (ngưỡng ${Math.round(threshold * 100)}%)!`
        : `AI nghe thành "${heardClean}" (độ khớp ${Math.round(bestScore * 100)}% < ${Math.round(threshold * 100)}%) — hãy nghe lại mẫu rồi nói rõ hơn nhé.`,
    };
  }

  const DEFAULT_WORD_THRESHOLD = 0.55;
  const DEFAULT_SENTENCE_THRESHOLD = 0.75;

  function getSentenceThreshold() {
    return DEFAULT_SENTENCE_THRESHOLD;
  }

  function compareSentence(spokenRaw, referenceText, opts = {}) {
    const refWordsRaw = String(referenceText || '').trim().split(/\s+/).filter(Boolean);
    const spokenTokens = normalizeEnglishText(spokenRaw).split(' ').filter(Boolean);
    const usedSpoken = new Set();
    const passPct = Math.round((Number.isFinite(Number(opts.threshold)) ? Number(opts.threshold) : DEFAULT_SENTENCE_THRESHOLD) * 100);

    const items = refWordsRaw.map((rawWord) => {
      const normRef = normalizeEnglishText(rawWord);
      if (!normRef) return { word: rawWord, hit: true, score: 1 };
      let bestIdx = -1;
      let bestScore = 0;
      for (let i = 0; i < spokenTokens.length; i++) {
        if (usedSpoken.has(i)) continue;
        const sc = scoreSingleWord(spokenTokens[i], normRef);
        if (sc > bestScore) {
          bestScore = sc;
          bestIdx = i;
        }
      }
      const hit = bestScore >= 0.72;
      if (hit && bestIdx >= 0) usedSpoken.add(bestIdx);
      return { word: rawWord, hit, score: +bestScore.toFixed(2) };
    });

    const total = items.length;
    const hits = items.filter((x) => x.hit).length;
    const accuracyPct = total > 0 ? Math.round((hits / total) * 100) : 0;
    return {
      items,
      hits,
      total,
      accuracyPct,
      thresholdPct: passPct,
      passed: accuracyPct >= passPct,
    };
  }

  /* ---------------------------------------------------------
     NETWORK UPLOAD TO /api/transcribe
     --------------------------------------------------------- */
  async function transcribeBlob(blob, filename, mode = 'word', engine = 'auto') {
    const fd = new FormData();
    fd.append('file', blob, filename || 'speech.wav');
    fd.append('mode', mode);
    if (engine && engine !== 'auto') fd.append('engine', engine);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const t0 = Date.now();
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
      data.clientLatencyMs = Date.now() - t0;
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
     RECORDING SESSION CONTROLLER
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

  async function startRecording(opts = {}) {
    if (!isSupported()) {
      opts.onError?.('Trình duyệt hiện tại không hỗ trợ thu âm micro.');
      return false;
    }
    if (activeSession) abort();

    const mode = opts.mode || 'word';
    const engine = opts.engine || 'auto';
    const skipDsp = Boolean(opts.skipDsp);
    const maxDurationMs = opts.maxDurationMs || (mode === 'word' ? 6500 : 120000);
    const autoStopOnSilence = opts.autoStopOnSilence !== undefined ? Boolean(opts.autoStopOnSilence) : mode === 'word';

    let stream;
    permissionRequestActive = true;
    try {
      // Turn OFF aggressive WebRTC noiseSuppression so quiet single-word starts/ends ("user") aren't swallowed!
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
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

          const bars = [];
          const binsPerBar = 4;
          for (let b = 0; b < 12; b++) {
            let acc = 0;
            for (let k = 0; k < binsPerBar; k++) {
              acc += freqData[1 + b * binsPerBar + k] || 0;
            }
            const norm = Math.min(1, (acc / (binsPerBar * 255)) * 2.2 + rms * 2.6);
            bars.push(+norm.toFixed(3));
          }

          const now = Date.now();
          if (rms > 0.011) {
            if (!sess.speechDetectedAt) sess.speechDetectedAt = now;
            sess.lastVoiceAt = now;
          }

          opts.onLevel?.({ rms, bars, speechDetected: Boolean(sess.speechDetectedAt) });

          // Generous auto-stop: wait >= 550ms after speech onset & 1400ms of trailing silence
          if (
            autoStopOnSilence &&
            sess.speechDetectedAt &&
            now - sess.speechDetectedAt >= 550 &&
            now - sess.lastVoiceAt >= 1400
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
      const recDurationSec = +((Date.now() - sess.startedAt) / 1000).toFixed(2);
      cleanupSession(sess);
      if (wasAborted) return;

      if (!chunks.length) {
        opts.onResult?.({ ok: true, silent: true, text: '', engine: '' });
        return;
      }

      const rawBlob = new Blob(chunks, { type: recMime });
      opts.onProcessing?.({ stage: 'dsp' });

      try {
        let uploadBlob = rawBlob;
        let filename = /mp4|m4a|aac/i.test(recMime) ? 'speech.m4a' : /ogg/i.test(recMime) ? 'speech.ogg' : 'speech.webm';
        let boosted = false;
        let gainApplied = 1;
        let durationSec = recDurationSec;

        if (!skipDsp) {
          const processed = await processBlobToNormalizedWav(rawBlob, mode === 'word');
          if (sess.aborted) return;
          if (processed.silent) {
            opts.onResult?.({
              ok: true,
              silent: true,
              text: '',
              engine: '',
              gainApplied: 1,
              audioUrl: URL.createObjectURL(rawBlob),
            });
            return;
          }
          uploadBlob = processed.blob;
          filename = processed.filename;
          boosted = processed.boosted;
          gainApplied = processed.gainApplied;
          durationSec = processed.durationSec || recDurationSec;
        }

        const audioUrl = URL.createObjectURL(uploadBlob);
        opts.onProcessing?.({ stage: 'upload', boosted, gainApplied, durationSec });

        const stt = await transcribeBlob(uploadBlob, filename, mode, engine);
        if (sess.aborted) return;
        opts.onResult?.({
          ok: true,
          silent: false,
          text: stt.text || '',
          words: stt.words || [],
          segments: stt.segments || [],
          engine: stt.engine || '',
          latencyMs: stt.clientLatencyMs || stt.latencyMs || 0,
          boosted,
          gainApplied,
          durationSec,
          audioUrl,
          rawMode: skipDsp,
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

  async function transcribeRawBlob(rawBlob, opts) {
    const mode = opts?.mode || 'speaking';
    const engine = opts?.engine || 'auto';
    const skipDsp = Boolean(opts?.skipDsp);
    const recDurationSec = Number(opts?.durationSec || 0);
    const recMime = rawBlob?.type || 'audio/webm';
    let uploadBlob = rawBlob;
    let filename = /mp4|m4a|aac/i.test(recMime) ? 'speech.m4a' : /ogg/i.test(recMime) ? 'speech.ogg' : 'speech.webm';
    let boosted = false;
    let gainApplied = 1;
    let durationSec = recDurationSec;

    if (!skipDsp) {
      const processed = await processBlobToNormalizedWav(rawBlob, mode === 'word');
      if (processed.silent) {
        return {
          ok: true,
          silent: true,
          text: '',
          engine: '',
          durationSec,
          audioUrl: URL.createObjectURL(rawBlob),
        };
      }
      uploadBlob = processed.blob;
      filename = processed.filename;
      boosted = processed.boosted;
      gainApplied = processed.gainApplied;
      durationSec = processed.durationSec || recDurationSec;
    }

    const audioUrl = URL.createObjectURL(uploadBlob);
    const stt = await transcribeBlob(uploadBlob, filename, mode, engine);
    return {
      ok: true,
      silent: false,
      text: stt.text || '',
      words: stt.words || [],
      segments: stt.segments || [],
      engine: stt.engine || '',
      latencyMs: stt.clientLatencyMs || stt.latencyMs || 0,
      boosted,
      gainApplied,
      durationSec,
      audioUrl,
    };
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
    transcribeRawBlob,
    matchSpokenTarget,
    compareSentence,
    getDefaultThreshold,
    setDefaultThreshold,
    getSentenceThreshold,
    DEFAULT_WORD_THRESHOLD,
    DEFAULT_SENTENCE_THRESHOLD,
    checkHealth,
    getApiUrl,
  };
})();
