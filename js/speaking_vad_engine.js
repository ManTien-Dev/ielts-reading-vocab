/* ==========================================================================
   TOTORO IELTS MASTER — HANDS-FREE CONTINUOUS MIC & SMART VAD ENGINE
   One-time Mic permission per exam session -> Continuous voice turn-taking:
   - Adaptive room noise-floor calibration (quiet rooms + noisy classrooms)
   - Echo-gated automatically while Examiner is speaking (never records TTS!)
   - Smart hesitation tolerance (1.5-2.0s pauses do NOT cut off candidate!)
   - Automatic turn end on natural trailing silence + official time-limit cutoff
   - No-speech silence nudge (6.5s) for real British Council pacing
   - Manual safety valve finishTurnNow() (Spacebar / subtle button)
   ========================================================================== */
(function () {
  'use strict';

  let stream = null;
  let audioCtx = null;
  let analyser = null;
  let recorder = null;
  let chunks = [];
  let rafId = null;

  let sessionActive = false;
  let gateState = 'paused'; // 'paused' | 'listening' | 'speaking' | 'processing'
  let noiseFloorRms = 0.009;
  let calibSamples = [];
  let listenStartedAt = 0;
  let speechOnsetAt = 0;
  let lastVoiceAt = 0;
  let voicedFrames = 0;
  let turnSeq = 0;
  let opts = {};
  let shadowRec = null;
  let shadowFinalText = '';
  let shadowInterimText = '';

  function startShadowRecognition() {
    stopShadowRecognition();
    shadowFinalText = '';
    shadowInterimText = '';
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const r = new SR();
      r.lang = 'en-GB';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (ev) => {
        let fin = '';
        let intr = '';
        for (let i = 0; i < ev.results.length; i++) {
          const t = String(ev.results[i]?.[0]?.transcript || '').trim();
          if (!t) continue;
          if (ev.results[i].isFinal) fin += (fin ? ' ' : '') + t;
          else intr += (intr ? ' ' : '') + t;
        }
        shadowFinalText = fin;
        shadowInterimText = intr;
      };
      r.onerror = () => {};
      r.start();
      shadowRec = r;
    } catch (_) {
      shadowRec = null;
    }
  }

  function stopShadowRecognition() {
    const out = [shadowFinalText, shadowInterimText].filter(Boolean).join(' ').trim();
    if (shadowRec) {
      try {
        shadowRec.onresult = null;
        shadowRec.onerror = null;
        shadowRec.stop();
      } catch (_) {}
      shadowRec = null;
    }
    return out;
  }

  function pickMime() {
    if (typeof window.MediaRecorder === 'undefined') return '';
    const list = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4;codecs=mp4a.40.2', 'audio/mp4', 'audio/ogg;codecs=opus'];
    for (const m of list) {
      try { if (MediaRecorder.isTypeSupported(m)) return m; } catch (_) {}
    }
    return '';
  }

  async function openSession(callbacks) {
    closeSession();
    opts = callbacks || {};

    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === 'undefined') {
      opts.onError?.('Trình duyệt không hỗ trợ Micro liên tục. Hãy dùng Chrome/Edge mới nhất hoặc chuyển sang chế độ Chuẩn.');
      return false;
    }

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
      const name = String(err?.name || '');
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        opts.onError?.('Bạn chưa cấp quyền Micro. Hãy bấm biểu tượng ổ khóa trên thanh địa chỉ → Cho phép Micro rồi vào phòng thi lại nhé!');
      } else {
        opts.onError?.('Không mở được Micro: ' + (err?.message || 'lỗi thiết bị'));
      }
      return false;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) {
      try {
        audioCtx = new Ctx();
        if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
        const src = audioCtx.createMediaStreamSource(stream);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.62;
        src.connect(analyser);
      } catch (_) {}
    }

    sessionActive = true;
    gateState = 'paused';
    calibSamples = [];
    noiseFloorRms = 0.009;
    startMeterLoop();
    return true;
  }

  function startRecorderSlice() {
    stopRecorderDiscard();
    if (!stream || !sessionActive) return;
    chunks = [];
    const mime = pickMime();
    try {
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
    } catch (_) {
      recorder = new MediaRecorder(stream);
    }
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) chunks.push(ev.data);
    };
    try {
      recorder.start(120);
    } catch (_) {}
  }

  function stopRecorderDiscard() {
    if (recorder) {
      try {
        recorder.ondataavailable = null;
        recorder.onstop = null;
        if (recorder.state !== 'inactive') recorder.stop();
      } catch (_) {}
      recorder = null;
    }
    chunks = [];
  }

  function pauseForExaminer() {
    if (!sessionActive) return;
    gateState = 'paused';
    speechOnsetAt = 0;
    lastVoiceAt = 0;
    voicedFrames = 0;
    stopShadowRecognition();
    stopRecorderDiscard();
    opts.onStateChange?.('paused');
  }

  function armListening(turnCfg) {
    if (!sessionActive) return;
    opts.turnCfg = {
      silenceMs: Number(turnCfg?.silenceMs || 2600),
      minSpeechMs: Number(turnCfg?.minSpeechMs || 700),
      maxTurnMs: Number(turnCfg?.maxTurnMs || 42000),
      noSpeechMs: Number(turnCfg?.noSpeechMs || 7200),
      allowEarlyPrompt: Boolean(turnCfg?.allowEarlyPrompt),
    };
    gateState = 'listening';
    listenStartedAt = Date.now();
    speechOnsetAt = 0;
    lastVoiceAt = 0;
    voicedFrames = 0;
    startRecorderSlice();
    startShadowRecognition();
    opts.onStateChange?.('listening');
  }

  function commitCurrentTurn(reason) {
    if (!sessionActive || (gateState !== 'listening' && gateState !== 'speaking')) return;
    const mySeq = ++turnSeq;
    const hadSpeech = Boolean(speechOnsetAt);
    const spokenSec = hadSpeech ? Math.max(1, Math.round((Date.now() - speechOnsetAt) / 1000)) : 0;
    const activeRec = recorder;
    const shadowFallbackText = stopShadowRecognition();

    gateState = 'processing';
    opts.onStateChange?.('processing');

    if (!activeRec || activeRec.state === 'inactive') {
      stopRecorderDiscard();
      if (reason === 'no_speech') {
        opts.onNoSpeech?.();
      } else {
        opts.onTurnResult?.({ silent: !shadowFallbackText, text: shadowFallbackText, durationSec: spokenSec, reason });
      }
      return;
    }

    const recMime = activeRec.mimeType || pickMime() || 'audio/webm';
    let stopHandled = false;
    const handleStopped = async () => {
      if (stopHandled) return;
      stopHandled = true;
      clearTimeout(stopGuard);
      const captured = chunks.slice();
      chunks = [];
      recorder = null;
      if (!sessionActive || mySeq !== turnSeq) return;

      if (!hadSpeech && reason === 'no_speech' && !shadowFallbackText) {
        opts.onNoSpeech?.();
        return;
      }
      if (!captured.length) {
        opts.onTurnResult?.({ silent: !shadowFallbackText, text: shadowFallbackText, durationSec: spokenSec, reason });
        return;
      }

      const rawBlob = new Blob(captured, { type: recMime });
      const localAudioUrl = (() => { try { return URL.createObjectURL(rawBlob); } catch (_) { return ''; } })();
      try {
        const stt = window.TotoroSpeechSTT;
        if (!stt?.transcribeRawBlob) {
          throw new Error('Không tìm thấy bộ nhận diện giọng nói.');
        }
        const res = await stt.transcribeRawBlob(rawBlob, { mode: 'speaking', durationSec: spokenSec });
        if (!sessionActive || mySeq !== turnSeq) return;
        const finalText = String(res.text || '').trim() || shadowFallbackText;
        opts.onTurnResult?.({
          silent: Boolean(!finalText),
          text: finalText,
          durationSec: Math.max(spokenSec, Math.round(res.durationSec || 0)),
          audioUrl: res.audioUrl || localAudioUrl,
          words: res.words || [],
          segments: res.segments || [],
          reason,
        });
      } catch (err) {
        if (!sessionActive || mySeq !== turnSeq) return;
        // Graceful fallback so exam room NEVER freezes on "Đang xử lý câu trả lời..."!
        if (shadowFallbackText) {
          opts.onTurnResult?.({
            silent: false,
            text: shadowFallbackText,
            durationSec: Math.max(1, spokenSec),
            audioUrl: localAudioUrl,
            words: [],
            segments: [],
            reason,
          });
          return;
        }
        opts.onError?.(err?.message || 'Lỗi kết nối STT — đang tự động mở lại Micro...');
        opts.onTurnResult?.({ silent: true, text: '', durationSec: spokenSec, audioUrl: localAudioUrl, reason: 'stt_error' });
      }
    };

    const stopGuard = setTimeout(handleStopped, 2200);
    activeRec.onstop = handleStopped;

    try {
      activeRec.stop();
    } catch (_) {
      handleStopped();
    }
  }

  function finishTurnNow() {
    if (gateState === 'listening' || gateState === 'speaking') {
      commitCurrentTurn('manual');
    }
  }

  function startMeterLoop() {
    if (!analyser) return;
    const timeData = new Uint8Array(analyser.fftSize);
    const freqData = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      if (!sessionActive || !analyser) return;
      analyser.getByteTimeDomainData(timeData);
      analyser.getByteFrequencyData(freqData);

      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);

      // Calibrate ambient noise floor while paused (or first 30 frames)
      if (gateState === 'paused' && calibSamples.length < 40 && rms < 0.05) {
        calibSamples.push(rms);
        const sorted = calibSamples.slice().sort((a, b) => a - b);
        const med = sorted[Math.floor(sorted.length * 0.5)] || 0.008;
        noiseFloorRms = Math.max(0.006, Math.min(0.028, med));
      }

      const bars = [];
      for (let b = 0; b < 12; b++) {
        let acc = 0;
        for (let k = 0; k < 4; k++) acc += freqData[1 + b * 4 + k] || 0;
        bars.push(+Math.min(1, (acc / (4 * 255)) * 2.2 + rms * 2.7).toFixed(3));
      }

      const speechThresh = Math.max(0.014, noiseFloorRms * 2.35);
      const isVoiced = rms > speechThresh;
      const now = Date.now();

      if (gateState === 'listening' || gateState === 'speaking') {
        const cfg = opts.turnCfg || {};
        opts.onLevel?.({ rms, bars, isSpeaking: gateState === 'speaking', elapsedMs: speechOnsetAt ? (now - speechOnsetAt) : 0 });

        if (isVoiced) {
          voicedFrames++;
          lastVoiceAt = now;
          if (!speechOnsetAt && voicedFrames >= 4) {
            speechOnsetAt = now;
            gateState = 'speaking';
            opts.onStateChange?.('speaking');
          }
        } else {
          if (!speechOnsetAt) voicedFrames = Math.max(0, voicedFrames - 1);
        }

        // 1. Official Time Cutoff (e.g., 40s Part 1, 75s Part 3, 120s Part 2)
        if (speechOnsetAt && now - speechOnsetAt >= (cfg.maxTurnMs || 42000)) {
          commitCurrentTurn('time_limit');
        }
        // 2. Natural End-of-Turn Silence Detection (tolerates brief <2s thinking pauses!)
        else if (
          speechOnsetAt &&
          now - speechOnsetAt >= (cfg.minSpeechMs || 700) &&
          now - lastVoiceAt >= (cfg.silenceMs || 2600)
        ) {
          commitCurrentTurn('silence_end');
        }
        // 3. Candidate hasn't started speaking after Examiner finished asking
        else if (!speechOnsetAt && cfg.noSpeechMs > 0 && now - listenStartedAt >= cfg.noSpeechMs) {
          commitCurrentTurn('no_speech');
        }
      } else {
        opts.onLevel?.({ rms: 0, bars: bars.map(() => 0.08), isSpeaking: false, elapsedMs: 0 });
      }

      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  function closeSession() {
    sessionActive = false;
    gateState = 'paused';
    turnSeq++;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    stopShadowRecognition();
    stopRecorderDiscard();
    if (audioCtx) {
      try { audioCtx.close(); } catch (_) {}
      audioCtx = null;
    }
    analyser = null;
    if (stream) {
      try { stream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      stream = null;
    }
    opts = {};
  }

  window.SpeakingVADEngine = {
    openSession,
    pauseForExaminer,
    armListening,
    finishTurnNow,
    closeSession,
    isActive: () => sessionActive,
    getState: () => gateState,
  };
})();
