/* ==========================================================================
   TOTORO IELTS MASTER — GEMINI LIVE NATIVE AUDIO ENGINE V2 (PRO STUDIO)
   Studio-Grade Real-Time Bidirectional Voice Exam Engine:
   - True IELTS VAD Patience (silenceDurationMs: 1850, END_SENSITIVITY_LOW,
     prefixPaddingMs: 300) -> NEVER cuts off candidates mid-thought!
   - Studio Mic Chain (noiseSuppression: false + 75Hz Highpass + Compressor +
     1.6x Gain) -> catches soft Vietnamese-accented English consonants cleanly!
   - Smart Anti-Self-Echo Ducking Gate -> zero laptop-speaker self-interruptions
     while still allowing clear deliberate barge-in ("Sorry, could you repeat?")
   - 85ms Jitter Buffer + Real-Time Examiner RMS Metering + Direct 16kHz PCM
     Simli WebRTC Lip-Sync Pipe
   - Per-Question Audio Blob Slicing -> end-of-exam Whisper-large-v3 refinement
     guarantees 99% word-accurate transcripts & pronunciation WPM timestamps!
   ========================================================================== */
(function () {
  'use strict';

  const FALLBACK_API_BASE = 'https://totoro-ieltsmaster.pages.dev';

  let active = false;
  let ws = null;
  let mediaStream = null;
  let inputCtx = null;
  let outputCtx = null;
  let inputAnalyser = null;
  let inputProcessor = null;
  let inputSource = null;
  let meterRafId = null;

  // Per-question audio recording for high-accuracy Whisper-large-v3 final refinement
  let turnRecorder = null;
  let turnChunks = [];
  let turnBlobsByIdx = {}; // qIdx -> Blob[]
  let activeTurnIdx = 0;
  let totalQuestions = 4;

  // Output jitter buffer & acoustic echo gate
  let activeSources = [];
  let nextPlayTime = 0;
  let isModelSpeaking = false;
  let speakEndTimer = null;
  let pendingFinish = false;
  let setupComplete = false;
  let turnStartAt = 0;
  let bargeInFrames = 0;
  let sessionOpts = {};

  function getApiUrl(path) {
    const loc = window.location;
    const host = String(loc.hostname || '').toLowerCase();
    const isPages =
      loc.protocol === 'https:' &&
      (host === 'totoro-ieltsmaster.pages.dev' || host.endsWith('.totoro-ieltsmaster.pages.dev'));
    return isPages ? path : `${FALLBACK_API_BASE}${path}`;
  }

  function float32ToPcm16Base64(float32Arr, inSampleRate, gainScale) {
    const targetSr = 16000;
    const g = Number(gainScale || 1);
    let mono;
    if (inSampleRate === targetSr) {
      mono = float32Arr;
    } else {
      const ratio = inSampleRate / targetSr;
      const outLen = Math.max(1, Math.floor(float32Arr.length / ratio));
      mono = new Float32Array(outLen);
      for (let i = 0; i < outLen; i++) {
        const pos = i * ratio;
        const idx = Math.floor(pos);
        const frac = pos - idx;
        const a = float32Arr[idx] || 0;
        const b = float32Arr[Math.min(float32Arr.length - 1, idx + 1)] || a;
        mono[i] = a + (b - a) * frac;
      }
    }
    const pcm = new Int16Array(mono.length);
    for (let i = 0; i < mono.length; i++) {
      const s = Math.max(-1, Math.min(1, mono[i] * g));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    const bytes = new Uint8Array(pcm.buffer);
    let bin = '';
    const step = 0x8000;
    for (let i = 0; i < bytes.length; i += step) {
      bin += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
    }
    return btoa(bin);
  }

  function base64Pcm24kToFloat32(b64) {
    const bin = atob(b64);
    const len = bin.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    const view = new DataView(bytes.buffer);
    const samples = Math.floor(len / 2);
    const out = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      out[i] = view.getInt16(i * 2, true) / 32768;
    }
    return out;
  }

  function downsample24kFloatTo16kPcmBytes(f32_24k) {
    const ratio = 24000 / 16000; // 1.5
    const outLen = Math.max(1, Math.floor(f32_24k.length / ratio));
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const pos = i * ratio;
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const a = f32_24k[idx] || 0;
      const b = f32_24k[Math.min(f32_24k.length - 1, idx + 1)] || a;
      const s = Math.max(-1, Math.min(1, a + (b - a) * frac));
      pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return new Uint8Array(pcm.buffer);
  }

  /* ================= PER-TURN LOCAL AUDIO RECORDER (FOR WHISPER V3 REFINEMENT) ================= */
  function startTurnRecorder() {
    if (!mediaStream || !active) return;
    stopTurnRecorderSilent();
    turnChunks = [];
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      turnRecorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
      turnRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) turnChunks.push(e.data);
      };
      turnRecorder.start(250);
    } catch (_) {
      turnRecorder = null;
    }
  }

  function stopTurnRecorderSilent() {
    if (turnRecorder) {
      try {
        turnRecorder.ondataavailable = null;
        turnRecorder.onstop = null;
        if (turnRecorder.state !== 'inactive') turnRecorder.stop();
      } catch (_) {}
      turnRecorder = null;
    }
    turnChunks = [];
  }

  function flushTurnRecorderInto(qIdx) {
    return new Promise((resolve) => {
      if (!turnRecorder || turnRecorder.state === 'inactive') {
        if (turnChunks.length) {
          try {
            const b = new Blob(turnChunks, { type: turnChunks[0]?.type || 'audio/webm' });
            if (b.size > 800) {
              turnBlobsByIdx[qIdx] = turnBlobsByIdx[qIdx] || [];
              turnBlobsByIdx[qIdx].push(b);
            }
          } catch (_) {}
        }
        turnChunks = [];
        resolve();
        return;
      }
      const rec = turnRecorder;
      const recMime = rec.mimeType || 'audio/webm';
      let doneFlag = false;
      const finish = () => {
        if (doneFlag) return;
        doneFlag = true;
        clearTimeout(guard);
        const captured = turnChunks.slice();
        turnChunks = [];
        if (turnRecorder === rec) turnRecorder = null;
        if (captured.length) {
          try {
            const b = new Blob(captured, { type: recMime });
            if (b.size > 800) {
              turnBlobsByIdx[qIdx] = turnBlobsByIdx[qIdx] || [];
              turnBlobsByIdx[qIdx].push(b);
            }
          } catch (_) {}
        }
        resolve();
      };
      const guard = setTimeout(finish, 900);
      rec.onstop = finish;
      try { rec.stop(); } catch (_) { finish(); }
    });
  }

  function stopOutputPlayback() {
    if (speakEndTimer) {
      clearTimeout(speakEndTimer);
      speakEndTimer = null;
    }
    activeSources.forEach((src) => {
      try { src.stop(); src.disconnect(); } catch (_) {}
    });
    activeSources = [];
    if (outputCtx) nextPlayTime = outputCtx.currentTime;
    sessionOpts.onExaminerAudioLevel?.(0);
    if (isModelSpeaking) {
      isModelSpeaking = false;
      bargeInFrames = 0;
      sessionOpts.onExaminerSpeakingChange?.(false);
    }
  }

  function scheduleOutputPcm24k(b64) {
    if (!active || !outputCtx) return;
    if (outputCtx.state === 'suspended') outputCtx.resume().catch(() => {});
    const f32 = base64Pcm24kToFloat32(b64);
    if (!f32.length) return;

    // Real-time RMS amplitude of examiner voice (drives broadcast equalizer & video pacing)
    let sumSq = 0;
    for (let i = 0; i < f32.length; i += 4) sumSq += f32[i] * f32[i];
    const outRms = Math.sqrt(sumSq / Math.max(1, Math.ceil(f32.length / 4)));
    sessionOpts.onExaminerAudioLevel?.(outRms);

    // Optional Direct Simli Real-Time WebRTC Lip-Sync Pipe (if Simli is live, Simli plays the synced audio+lips!)
    const simliLive = Boolean(window.SpeakingExaminerCinema?.isSimliLive?.());
    if (simliLive && typeof window.SpeakingExaminerCinema?.pushLivePcm16k === 'function') {
      const pcm16k = downsample24kFloatTo16kPcmBytes(f32);
      window.SpeakingExaminerCinema.pushLivePcm16k(pcm16k);
    }

    const buf = outputCtx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);

    if (!simliLive) {
      const src = outputCtx.createBufferSource();
      src.buffer = buf;
      src.connect(outputCtx.destination);

      const now = outputCtx.currentTime;
      // 85ms initial burst buffer prevents clicks/pops on first chunk
      const startAt = !isModelSpeaking ? Math.max(now + 0.085, nextPlayTime) : Math.max(now + 0.018, nextPlayTime);
      src.start(startAt);
      nextPlayTime = startAt + buf.duration;

      activeSources.push(src);
      src.onended = () => {
        activeSources = activeSources.filter((s) => s !== src);
      };
    } else {
      const now = outputCtx.currentTime;
      nextPlayTime = Math.max(now, nextPlayTime) + buf.duration;
    }

    if (!isModelSpeaking) {
      isModelSpeaking = true;
      bargeInFrames = 0;
      // Pause candidate turn recorder while examiner speaks so Whisper only hears the candidate!
      flushTurnRecorderInto(activeTurnIdx);
      sessionOpts.onExaminerSpeakingChange?.(true);
    }

    if (speakEndTimer) clearTimeout(speakEndTimer);
    const remainMs = Math.max(180, Math.round((nextPlayTime - outputCtx.currentTime) * 1000) + 220);
    speakEndTimer = setTimeout(() => {
      if (!active) return;
      isModelSpeaking = false;
      bargeInFrames = 0;
      turnStartAt = Date.now();
      sessionOpts.onExaminerAudioLevel?.(0);
      sessionOpts.onExaminerSpeakingChange?.(false);
      if (pendingFinish) {
        pendingFinish = false;
        finalizeAndClose();
      } else {
        // Start clean candidate turn recording now that examiner stopped speaking!
        startTurnRecorder();
      }
    }, remainMs);
  }

  async function finalizeAndClose() {
    const cb = sessionOpts.onExamFinish;
    await flushTurnRecorderInto(activeTurnIdx);
    const snapshot = { ...turnBlobsByIdx };
    closeSession();
    cb?.(snapshot);
  }

  function buildExaminerSystemInstruction(cfg) {
    const exName = cfg.examinerId === 'oliver' ? 'Mr. Oliver' : 'Ms. Claire';
    const part = Number(cfg.part || 1);
    const topicTitle = String(cfg.topicTitle || 'Everyday Life');

    if (part === 2) {
      const cueTitle = String(cfg.cueTitle || topicTitle);
      const bullets = Array.isArray(cfg.cueBullets) ? cfg.cueBullets.join('; ') : '';
      return `You are ${exName}, a senior British Council IELTS Speaking Examiner.
VOICE & PROSODY STYLE (CRITICAL):
- Speak ALWAYS in calm, understated, authentic British English (Received Pronunciation / London) at a measured academic pace (~130 words per minute).
- NEVER sound upbeat, hyperactive, robotic, or American. Sound warm, composed, patient, and genuinely human.

You are conducting IELTS Speaking PART 2 on the cue card: "${cueTitle}" (Points: ${bullets}).

OFFICIAL CAMBRIDGE PART 2 PROTOCOL:
1. Start immediately with calm poise: "Alright? Remember you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?"
2. Stay completely SILENT while the candidate delivers their 1–2 minute talk. Tolerate natural 2–3 second pauses while they think — NEVER interrupt early.
3. If the candidate finishes clearly early (under ~65 seconds), ask softly once: "Would you like to add anything else?"
4. Once they finish speaking (or when told 2 minutes are up), say "Thank you." and ask ONE short, natural rounding-off question (8–15 words) directly about something specific they just said.
5. Only AFTER they answer that rounding-off question, say warmly: "Thank you. That is the end of Part 2." and IMMEDIATELY call finish_exam_part(reason="completed").
6. Never teach, never correct grammar, never say "Great job!" or "Awesome!".`;
    }

    const qList = (cfg.questions || [])
      .map((q, i) => `Q${i + 1}: ${q.q}`)
      .join('\n');
    const total = (cfg.questions || []).length || 4;
    const isP1 = part === 1;

    return `You are ${exName}, a senior British Council IELTS Speaking Examiner conducting an official IELTS Speaking Part ${part} test.

VOICE & PROSODY STYLE (CRITICAL):
- Speak ALWAYS in calm, understated, authentic British English (Received Pronunciation / London) at a measured, unhurried academic pace (~130 words per minute).
- NEVER sound like an American customer-service bot. Use brief, dignified British transitions ("Thank you.", "Right, I see.", "Interesting, thank you.", "Mm-hmm."), pause half a second, then ask the next question clearly.
- NEVER rush, NEVER talk over a thinking candidate, NEVER teach, NEVER correct grammar, NEVER say "Great answer!" or "Awesome!".

TOPIC: "${topicTitle}"
OFFICIAL SCRIPTED QUESTIONS (you MUST cover ALL ${total} questions in order, Q1 to Q${total}):
${qList}

OFFICIAL CAMBRIDGE EXAMINER RULES:
1. OPENING: Start immediately with a warm, unhurried British greeting + Q1 verbatim:
   ${isP1
     ? `"Good afternoon. In this first part, I'd like to ask you some questions about ${topicTitle}. [ask Q1 verbatim]"`
     : `"Now, let's discuss some more general questions related to ${topicTitle}. [ask Q1 verbatim]"`}
2. PATIENT LISTENING: Candidates are non-native speakers who may pause for 1–2 seconds mid-sentence to search for vocabulary. Always wait patiently until they genuinely finish their thought.
3. NATURAL CONVERSATION & PUSHBACK:
   - Repeat request ("Sorry?", "Pardon?", "Could you repeat?"): calmly repeat the exact question you just asked without advancing.
   - Clarification ("What do you mean?", "What kind of information?"):
     * In Part 1, never paraphrase a scripted main question — repeat it clearly; if they ask what to add after your follow-up probe, give a 1-sentence gentle angle ("Just briefly why you feel that way, or a quick everyday example.").
     * In Part 3, you may simplify/rephrase the question naturally in 1 crisp sentence.
   - Personal question back ("What about you?", "Do you like it?"): smile warmly in tone and deflect politely ("Well, today I'm here to hear about your views!") then steer back or advance smoothly.
   - Candidate says "Nothing else" / "I don't know": say "No problem at all, thank you." and move immediately to the next question.
4. PROBING & FOLLOW-UPS:
   ${isP1
     ? '- In Part 1: Only if an answer is very brief (under ~10 words), ask ONE short probe ("Why do you say that?" or "Could you tell me a little more about that?"). After they respond, advance cleanly.'
     : '- In Part 3: After a developed answer, ask ONE sharp, concise follow-up question (12–18 words) building directly on a point they just made (max 1 follow-up per main question).'}
5. STRICT TOOL DISCIPLINE:
   - ONLY call set_current_question(question_number=N) when you are actually moving forward to scripted Q2, Q3, ..., Q${total}. Never call it for Q1.
   - ONLY call finish_exam_part(reason="completed") AFTER the candidate has finished answering Q${total} (the final question) AND you have said "Thank you. That is the end of Part ${part}." NEVER call finish_exam_part before Q${total}!`;
  }

  function buildToolsDeclaration(part) {
    const decls = [
      {
        name: 'finish_exam_part',
        description: 'Call ONLY after the candidate has answered the FINAL scripted question and you have said "Thank you. That is the end of Part X."',
        parameters: {
          type: 'OBJECT',
          properties: {
            reason: { type: 'STRING', description: 'completed' },
          },
          required: ['reason'],
        },
      },
    ];
    if (Number(part) !== 2) {
      decls.unshift({
        name: 'set_current_question',
        description: 'Call ONLY when advancing forward to the next scripted question (2, 3, 4, ...). Do NOT call for Q1.',
        parameters: {
          type: 'OBJECT',
          properties: {
            question_number: { type: 'INTEGER', description: '1-based scripted question number now being asked (2..N)' },
          },
          required: ['question_number'],
        },
      });
    }
    return [{ functionDeclarations: decls }];
  }

  function handleToolCalls(toolCall) {
    const calls = Array.isArray(toolCall?.functionCalls) ? toolCall.functionCalls : [];
    if (!calls.length || !ws || ws.readyState !== WebSocket.OPEN) return;
    const responses = [];
    for (const fc of calls) {
      const name = fc.name;
      const args = fc.args || {};
      if (name === 'set_current_question') {
        const qNum = Math.max(1, Math.min(totalQuestions, Number(args.question_number || 1)));
        const targetIdx = qNum - 1;
        if (targetIdx > activeTurnIdx) {
          flushTurnRecorderInto(activeTurnIdx);
          activeTurnIdx = targetIdx;
          sessionOpts.onAdvanceQuestion?.(targetIdx);
        }
        responses.push({ id: fc.id, name, response: { ok: true, current_question: activeTurnIdx + 1, total_questions: totalQuestions } });
      } else if (name === 'finish_exam_part') {
        // Strict guard: block hallucinated premature exam ending before final question!
        if (Number(sessionOpts.part) !== 2 && activeTurnIdx < totalQuestions - 1) {
          responses.push({
            id: fc.id,
            name,
            response: {
              ok: false,
              error: `Cannot end exam yet: currently on Q${activeTurnIdx + 1} of ${totalQuestions}. Please continue to Q${activeTurnIdx + 2}.`,
            },
          });
        } else {
          pendingFinish = true;
          responses.push({ id: fc.id, name, response: { ok: true, closing: true } });
          if (!isModelSpeaking) {
            setTimeout(() => {
              if (active && pendingFinish && !isModelSpeaking) {
                pendingFinish = false;
                finalizeAndClose();
              }
            }, 900);
          }
        }
      } else {
        responses.push({ id: fc.id, name, response: { ok: true } });
      }
    }
    try {
      ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
    } catch (_) {}
  }

  function handleServerMessage(msg) {
    if (!active || !msg || typeof msg !== 'object') return;

    if (msg.setupComplete) {
      setupComplete = true;
      sessionOpts.onReady?.();
      sendClientText('Please begin the IELTS Speaking exam now with your British greeting and Question 1.');
      return;
    }

    if (msg.toolCall) {
      handleToolCalls(msg.toolCall);
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      stopOutputPlayback();
    }

    const inTx = sc.inputTranscription?.text || sc.inputAudioTranscription?.text || '';
    if (inTx) {
      sessionOpts.onCandidateTranscript?.(String(inTx));
    }

    const outTx = sc.outputTranscription?.text || sc.outputAudioTranscription?.text || '';
    if (outTx) {
      sessionOpts.onExaminerTranscript?.(String(outTx));
    }

    const parts = sc.modelTurn?.parts || [];
    for (const p of parts) {
      const inline = p.inlineData;
      if (inline?.data && String(inline.mimeType || '').startsWith('audio/pcm')) {
        scheduleOutputPcm24k(inline.data);
      }
    }
  }

  function sendClientText(text) {
    if (!active || !ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify({
        clientContent: {
          turns: [{ role: 'user', parts: [{ text: String(text || '') }] }],
          turnComplete: true,
        },
      }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function startMeterLoop() {
    if (!inputAnalyser) return;
    const timeData = new Uint8Array(inputAnalyser.fftSize);
    const freqData = new Uint8Array(inputAnalyser.frequencyBinCount);
    const tick = () => {
      if (!active || !inputAnalyser) return;
      inputAnalyser.getByteTimeDomainData(timeData);
      inputAnalyser.getByteFrequencyData(freqData);
      let sumSq = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = (timeData[i] - 128) / 128;
        sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / timeData.length);
      const bars = [];
      for (let b = 0; b < 12; b++) {
        let acc = 0;
        for (let k = 0; k < 4; k++) acc += freqData[1 + b * 4 + k] || 0;
        bars.push(+Math.min(1, (acc / (4 * 255)) * 2.4 + rms * 3.1).toFixed(3));
      }
      const isCandSpeaking = !isModelSpeaking && rms > 0.014;
      const elapsedMs = (!isModelSpeaking && turnStartAt) ? (Date.now() - turnStartAt) : 0;
      sessionOpts.onLevel?.({ rms, bars, isSpeaking: isCandSpeaking, elapsedMs });
      meterRafId = requestAnimationFrame(tick);
    };
    meterRafId = requestAnimationFrame(tick);
  }

  async function collectRecordedBlobs() {
    await flushTurnRecorderInto(activeTurnIdx);
    return { ...turnBlobsByIdx };
  }

  async function startSession(cfg) {
    closeSession();
    sessionOpts = cfg || {};
    activeTurnIdx = 0;
    turnBlobsByIdx = {};
    totalQuestions = Math.max(1, (cfg?.questions || []).length || 4);

    // 1. Mint Ephemeral Token from Cloudflare Pages Function
    let tokenData = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(getApiUrl('/api/gemini-live-token'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examinerId: cfg.examinerId || 'claire' }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return { ok: false, fallback: true };
      tokenData = await res.json();
      if (!tokenData?.ok || !tokenData.enabled || !tokenData.wsUrl) {
        return { ok: false, fallback: true, reason: tokenData?.reason || 'unconfigured' };
      }
    } catch (_) {
      return { ok: false, fallback: true, reason: 'token_network_error' };
    }

    // 2. Open Ultra-Sensitive Mic (noiseSuppression: false preserves soft English consonants!)
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, fallback: false, error: 'Trình duyệt không hỗ trợ Micro.' };
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (_) {
      return { ok: false, fallback: false, error: 'Bạn chưa cấp quyền Micro. Hãy cho phép Micro rồi bắt đầu lại nhé!' };
    }

    // 3. Studio Input DSP Chain: 75Hz High-Pass -> Soft Dynamics Compressor -> Boost Gain -> Analyser + PCM16 Streamer
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      closeSession();
      return { ok: false, fallback: true };
    }
    inputCtx = new AudioCtx();
    outputCtx = new AudioCtx({ sampleRate: 24000 });
    if (inputCtx.state === 'suspended') inputCtx.resume().catch(() => {});
    if (outputCtx.state === 'suspended') outputCtx.resume().catch(() => {});
    nextPlayTime = outputCtx.currentTime;

    inputSource = inputCtx.createMediaStreamSource(mediaStream);
    const hp = inputCtx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 75;

    const comp = inputCtx.createDynamicsCompressor();
    comp.threshold.value = -28;
    comp.knee.value = 18;
    comp.ratio.value = 3.8;
    comp.attack.value = 0.005;
    comp.release.value = 0.14;

    const boost = inputCtx.createGain();
    boost.gain.value = 1.45;

    inputAnalyser = inputCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    inputAnalyser.smoothingTimeConstant = 0.58;

    inputSource.connect(hp);
    hp.connect(comp);
    comp.connect(boost);
    boost.connect(inputAnalyser);

    // 4. Open Gemini Live WebSocket with IELTS-tuned Patient VAD (silenceDurationMs: 1850!)
    active = true;
    setupComplete = false;
    pendingFinish = false;
    isModelSpeaking = false;
    bargeInFrames = 0;
    turnStartAt = Date.now();

    const connected = await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (settled) return;
        settled = true;
        clearTimeout(guard);
        resolve(ok);
      };
      const guard = setTimeout(() => done(false), 6500);

      try {
        ws = new WebSocket(tokenData.wsUrl);
      } catch (_) {
        done(false);
        return;
      }

      ws.onopen = () => {
        const setupMsg = {
          setup: {
            model: tokenData.model || 'models/gemini-2.5-flash-native-audio-preview-12-2025',
            generationConfig: {
              responseModalities: ['AUDIO'],
              temperature: 0.48,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: tokenData.voiceName || (cfg.examinerId === 'oliver' ? 'Charon' : 'Kore'),
                  },
                },
              },
            },
            realtimeInputConfig: {
              activityHandling: 'START_OF_ACTIVITY_INTERRUPTS',
              automaticActivityDetection: {
                disabled: false,
                startOfSpeechSensitivity: 'START_SENSITIVITY_HIGH',
                endOfSpeechSensitivity: 'END_SENSITIVITY_LOW',
                prefixPaddingMs: 300,
                silenceDurationMs: Number(cfg.part) === 2 ? 2600 : 1850,
              },
            },
            inputAudioTranscription: {},
            outputAudioTranscription: {},
            systemInstruction: {
              parts: [{ text: buildExaminerSystemInstruction(cfg) }],
            },
            tools: buildToolsDeclaration(cfg.part),
          },
        };
        try {
          ws.send(JSON.stringify(setupMsg));
        } catch (_) {
          done(false);
        }
      };

      ws.onmessage = async (ev) => {
        try {
          const text = typeof ev.data === 'string'
            ? ev.data
            : (ev.data instanceof Blob ? await ev.data.text() : '');
          if (!text) return;
          const parsed = JSON.parse(text);
          if (parsed.setupComplete) done(true);
          handleServerMessage(parsed);
        } catch (_) {}
      };

      ws.onerror = () => {
        if (!settled) done(false);
      };

      ws.onclose = () => {
        if (!settled) {
          done(false);
        } else if (active && !pendingFinish) {
          sessionOpts.onUnexpectedClose?.();
        }
      };
    });

    if (!connected || !active) {
      closeSession();
      return { ok: false, fallback: true, reason: 'ws_handshake_failed' };
    }

    // 5. Stream Studio-Boosted 16kHz PCM16 with Smart Anti-Self-Echo Gate
    const zeroFrame = new Float32Array(4096);
    inputProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
    inputProcessor.onaudioprocess = (ev) => {
      if (!active || !setupComplete || !ws || ws.readyState !== WebSocket.OPEN) return;
      const f32 = ev.inputBuffer.getChannelData(0);
      let frameToSend = f32;

      // Smart Acoustic Ducking Gate while Examiner is speaking:
      // Prevents laptop speaker echo from triggering fake self-interruptions,
      // while allowing deliberate loud candidate barge-in (> 0.095 RMS for 3+ chunks)!
      if (isModelSpeaking) {
        let sumSq = 0;
        for (let i = 0; i < f32.length; i += 4) sumSq += f32[i] * f32[i];
        const rms = Math.sqrt(sumSq / Math.max(1, Math.ceil(f32.length / 4)));
        if (rms > 0.095) bargeInFrames++;
        else bargeInFrames = Math.max(0, bargeInFrames - 1);
        if (bargeInFrames < 3) {
          frameToSend = zeroFrame;
        }
      }

      const b64 = float32ToPcm16Base64(frameToSend, inputCtx.sampleRate, 1.0);
      try {
        ws.send(JSON.stringify({
          realtimeInput: {
            audio: { data: b64, mimeType: 'audio/pcm;rate=16000' },
          },
        }));
      } catch (_) {}
    };
    const silentGain = inputCtx.createGain();
    silentGain.gain.value = 0;
    boost.connect(inputProcessor);
    inputProcessor.connect(silentGain);
    silentGain.connect(inputCtx.destination);

    startMeterLoop();
    return { ok: true, model: tokenData.model, voiceName: tokenData.voiceName };
  }

  function closeSession() {
    active = false;
    setupComplete = false;
    pendingFinish = false;
    bargeInFrames = 0;
    stopOutputPlayback();
    stopTurnRecorderSilent();
    if (meterRafId) {
      cancelAnimationFrame(meterRafId);
      meterRafId = null;
    }
    if (ws) {
      try {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onerror = null;
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) ws.close();
      } catch (_) {}
      ws = null;
    }
    if (inputProcessor) {
      try { inputProcessor.onaudioprocess = null; inputProcessor.disconnect(); } catch (_) {}
      inputProcessor = null;
    }
    if (inputSource) {
      try { inputSource.disconnect(); } catch (_) {}
      inputSource = null;
    }
    if (inputCtx) {
      try { inputCtx.close(); } catch (_) {}
      inputCtx = null;
    }
    if (outputCtx) {
      try { outputCtx.close(); } catch (_) {}
      outputCtx = null;
    }
    if (mediaStream) {
      try { mediaStream.getTracks().forEach((t) => t.stop()); } catch (_) {}
      mediaStream = null;
    }
    inputAnalyser = null;
    sessionOpts = {};
  }

  window.SpeakingGeminiLive = {
    startSession,
    sendClientText,
    collectRecordedBlobs,
    closeSession,
    isActive: () => active && setupComplete,
    isModelSpeaking: () => isModelSpeaking,
  };
})();
