/* ==========================================================================
   TOTORO IELTS MASTER — GEMINI LIVE NATIVE AUDIO ENGINE (3D PRO REAL-TIME)
   Direct Browser Bidirectional WebSocket to Gemini Live API via Ephemeral Token:
   - ~300ms speech-to-speech latency with native British IELTS Examiner persona
   - Real-time barge-in (candidate can interrupt / ask "Could you repeat?" anytime)
   - Synchronizes directly with 8 seamless Veo 3.1 videos (speak / idle / nod / notes)
   - Streams 16kHz PCM16 mic input -> plays gapless 24kHz PCM16 examiner output
   - Captures real-time inputAudioTranscription + local MediaRecorder audio
     so end-of-exam 4-criteria IELTS Band grading works 100% accurately
   - Tool-driven exam flow: set_current_question(n) & finish_exam_part()
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
  let localRecorder = null;
  let localChunks = [];
  let meterRafId = null;

  let activeSources = [];
  let nextPlayTime = 0;
  let isModelSpeaking = false;
  let speakEndTimer = null;
  let pendingFinish = false;
  let setupComplete = false;
  let turnStartAt = 0;
  let sessionOpts = {};

  function getApiUrl(path) {
    const loc = window.location;
    const host = String(loc.hostname || '').toLowerCase();
    const isPages =
      loc.protocol === 'https:' &&
      (host === 'totoro-ieltsmaster.pages.dev' || host.endsWith('.totoro-ieltsmaster.pages.dev'));
    return isPages ? path : `${FALLBACK_API_BASE}${path}`;
  }

  function float32ToPcm16Base64(float32Arr, inSampleRate) {
    const targetSr = 16000;
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
      const s = Math.max(-1, Math.min(1, mono[i]));
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
    if (isModelSpeaking) {
      isModelSpeaking = false;
      sessionOpts.onExaminerSpeakingChange?.(false);
    }
  }

  function scheduleOutputPcm24k(b64) {
    if (!active || !outputCtx) return;
    if (outputCtx.state === 'suspended') outputCtx.resume().catch(() => {});
    const f32 = base64Pcm24kToFloat32(b64);
    if (!f32.length) return;

    const buf = outputCtx.createBuffer(1, f32.length, 24000);
    buf.getChannelData(0).set(f32);

    const src = outputCtx.createBufferSource();
    src.buffer = buf;
    src.connect(outputCtx.destination);

    const now = outputCtx.currentTime;
    const startAt = Math.max(now + 0.015, nextPlayTime);
    src.start(startAt);
    nextPlayTime = startAt + buf.duration;

    activeSources.push(src);
    src.onended = () => {
      activeSources = activeSources.filter((s) => s !== src);
    };

    if (!isModelSpeaking) {
      isModelSpeaking = true;
      sessionOpts.onExaminerSpeakingChange?.(true);
    }

    if (speakEndTimer) clearTimeout(speakEndTimer);
    const remainMs = Math.max(120, Math.round((nextPlayTime - outputCtx.currentTime) * 1000) + 180);
    speakEndTimer = setTimeout(() => {
      if (!active) return;
      isModelSpeaking = false;
      turnStartAt = Date.now();
      sessionOpts.onExaminerSpeakingChange?.(false);
      if (pendingFinish) {
        pendingFinish = false;
        const cb = sessionOpts.onExamFinish;
        const blobPromise = stopAndBuildAudioUrl();
        blobPromise.then((audioUrl) => {
          closeSession();
          cb?.(audioUrl);
        });
      }
    }, remainMs);
  }

  function buildExaminerSystemInstruction(cfg) {
    const exName = cfg.examinerId === 'oliver' ? 'Mr. Oliver' : 'Ms. Claire';
    const part = Number(cfg.part || 1);
    const topicTitle = String(cfg.topicTitle || 'Everyday Life');

    if (part === 2) {
      const cueTitle = String(cfg.cueTitle || topicTitle);
      const bullets = Array.isArray(cfg.cueBullets) ? cfg.cueBullets.join('; ') : '';
      return `You are ${exName}, a certified British Council IELTS Speaking Examiner speaking in a warm, calm, natural British English (London / Received Pronunciation) accent.
You are conducting IELTS Speaking PART 2 (Individual Long Turn) on the cue card: "${cueTitle}" (Points: ${bullets}).

STRICT OFFICIAL CAMBRIDGE / BRITISH COUNCIL PART 2 RULES:
1. The candidate has JUST finished their 1-minute preparation. Start immediately by saying calmly: "Alright? Remember you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?"
2. While the candidate is delivering their 1-2 minute talk, stay SILENT and listen attentively — do NOT interrupt them during short 2-3 second thinking pauses.
3. If the candidate stops clearly early (under ~65 seconds), ask softly: "Would you like to add anything else?" once.
4. When the candidate finishes their talk (or when you receive a system notice that 2 minutes are up), briefly thank them ("Thank you.") and ask ONE short, natural, spontaneous rounding-off question (8-16 words) directly tied to what they just described.
5. After the candidate answers that 1 rounding-off question, say warmly: "Thank you. That is the end of Part 2." and IMMEDIATELY call the tool finish_exam_part(reason="completed").
6. Never teach, never correct grammar, never praise excessively ("Great job!"), never break character.`;
    }

    const qList = (cfg.questions || [])
      .map((q, i) => `Q${i + 1}: ${q.q}`)
      .join('\n');
    const total = (cfg.questions || []).length || 4;
    const isP1 = part === 1;

    return `You are ${exName}, a certified British Council IELTS Speaking Examiner conducting a live, official IELTS Speaking Part ${part} test.
Speak ALWAYS in a calm, warm, authentic British English (Received Pronunciation / London) accent with natural pacing and human warmth.

TOPIC: "${topicTitle}"
OFFICIAL SCRIPTED QUESTIONS (ask these in order from Q1 to Q${total}):
${qList}

STRICT OFFICIAL CAMBRIDGE / BRITISH COUNCIL RULES:
1. OPENING: Start immediately with a brief natural British greeting and Q1:
   ${isP1
     ? `"Good afternoon. In this first part, I'd like to ask you some questions about ${topicTitle}. [ask Q1 verbatim]"`
     : `"Now, let's discuss some more general questions related to ${topicTitle}. [ask Q1 verbatim]"`}
2. NEVER teach, correct grammar, give hints/answers, or praise excessively ("Great job!", "Awesome!"). Use brief natural British acknowledgements ("Thank you.", "Right, I see.", "Interesting, thank you.", "Mm-hmm.").
3. NATURAL CONVERSATION & PUSHBACK HANDLING:
   - If the candidate asks you to repeat ("Sorry?", "Pardon?", "Could you repeat that?"), politely repeat the exact question you just asked without advancing.
   - If the candidate asks for clarification ("What do you mean?", "What kind of information?"):
     * In Part 1, never paraphrase the main scripted question — repeat it clearly; however, if they ask what kind of detail to add after your follow-up probe, warmly guide the angle in 1 short sentence without giving answers (e.g. "Just briefly why you feel that way, or a quick example.").
     * In Part 3, you MAY rephrase or simplify the question naturally in 1 sentence.
   - If the candidate asks YOU a personal question ("What about you?", "Do you like it?"), politely deflect in character ("Well, today I'm here to hear about your views!") and steer back to them or move on smoothly.
   - If the candidate says they have nothing else to add ("I don't know", "That's all"), kindly say "No problem at all, thank you." and move straight to the next question.
4. PROBING & FOLLOW-UPS:
   ${isP1
     ? '- In Part 1: If an answer is very short (under ~10 words), ask ONE brief natural probe ("Why?" or "Why do you say that?" or "Could you tell me a bit more about that?"). After they answer the probe, move on cleanly.'
     : '- In Part 3: After a thoughtful answer, ask ONE concise adaptive follow-up question (12-20 words) directly probing or contrasting a specific point the candidate just raised (at most 1 follow-up per main question so pacing stays brisk).'}
5. TRACKING PROGRESS (CRITICAL TOOL CALLS):
   - Every time you move on to the next scripted question (Q2, Q3, ..., Q${total}), ALWAYS call tool set_current_question(question_number=<2..${total}>) right as you ask it!
   - After the candidate finishes answering Q${total} (and its brief follow-up if any), say warmly: "Thank you. That is the end of Part ${part}." and IMMEDIATELY call tool finish_exam_part(reason="completed").`;
  }

  function buildToolsDeclaration(part) {
    const decls = [
      {
        name: 'finish_exam_part',
        description: 'Call this immediately after saying "Thank you. That is the end of Part X." to finish the exam session and start IELTS Band grading.',
        parameters: {
          type: 'OBJECT',
          properties: {
            reason: { type: 'STRING', description: 'Short completion reason, e.g. completed' },
          },
          required: ['reason'],
        },
      },
    ];
    if (Number(part) !== 2) {
      decls.unshift({
        name: 'set_current_question',
        description: 'Call this right when advancing to the next scripted question number (2, 3, 4, ...).',
        parameters: {
          type: 'OBJECT',
          properties: {
            question_number: { type: 'INTEGER', description: '1-based index of the scripted question now being asked (e.g. 2, 3, 4)' },
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
        const qNum = Math.max(1, Number(args.question_number || 1));
        sessionOpts.onAdvanceQuestion?.(qNum - 1);
        responses.push({ id: fc.id, name, response: { ok: true, current_question: qNum } });
      } else if (name === 'finish_exam_part') {
        pendingFinish = true;
        responses.push({ id: fc.id, name, response: { ok: true, closing: true } });
        // If audio already stopped before tool call arrived, finish shortly
        if (!isModelSpeaking) {
          setTimeout(() => {
            if (active && pendingFinish && !isModelSpeaking) {
              pendingFinish = false;
              const cb = sessionOpts.onExamFinish;
              stopAndBuildAudioUrl().then((audioUrl) => {
                closeSession();
                cb?.(audioUrl);
              });
            }
          }, 900);
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
      // Prompt examiner to deliver opening greeting & Q1 immediately
      sendClientText('Please begin the IELTS Speaking exam now with your greeting and first question.');
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

    // Real-time candidate speech transcription (for 4-criteria Band grading!)
    const inTx = sc.inputTranscription?.text || sc.inputAudioTranscription?.text || '';
    if (inTx) {
      sessionOpts.onCandidateTranscript?.(String(inTx));
    }

    // Real-time examiner speech transcription
    const outTx = sc.outputTranscription?.text || sc.outputAudioTranscription?.text || '';
    if (outTx) {
      sessionOpts.onExaminerTranscript?.(String(outTx));
    }

    // Incoming native audio chunks (24kHz PCM16)
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
        bars.push(+Math.min(1, (acc / (4 * 255)) * 2.2 + rms * 2.7).toFixed(3));
      }
      const isCandSpeaking = !isModelSpeaking && rms > 0.016;
      const elapsedMs = (!isModelSpeaking && turnStartAt) ? (Date.now() - turnStartAt) : 0;
      sessionOpts.onLevel?.({ rms, bars, isSpeaking: isCandSpeaking, elapsedMs });
      meterRafId = requestAnimationFrame(tick);
    };
    meterRafId = requestAnimationFrame(tick);
  }

  function stopAndBuildAudioUrl() {
    return new Promise((resolve) => {
      if (!localRecorder || localRecorder.state === 'inactive') {
        if (localChunks.length) {
          try {
            const b = new Blob(localChunks, { type: localChunks[0]?.type || 'audio/webm' });
            resolve(URL.createObjectURL(b));
            return;
          } catch (_) {}
        }
        resolve('');
        return;
      }
      const guard = setTimeout(() => resolve(''), 1200);
      localRecorder.onstop = () => {
        clearTimeout(guard);
        try {
          const b = new Blob(localChunks, { type: localRecorder?.mimeType || 'audio/webm' });
          resolve(b.size > 500 ? URL.createObjectURL(b) : '');
        } catch (_) {
          resolve('');
        }
      };
      try { localRecorder.stop(); } catch (_) { clearTimeout(guard); resolve(''); }
    });
  }

  async function startSession(cfg) {
    closeSession();
    sessionOpts = cfg || {};

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

    // 2. Open Mic with WebRTC Echo Cancellation (enables true barge-in!)
    if (!navigator.mediaDevices?.getUserMedia) {
      return { ok: false, fallback: false, error: 'Trình duyệt không hỗ trợ Micro.' };
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
    } catch (err) {
      return { ok: false, fallback: false, error: 'Bạn chưa cấp quyền Micro. Hãy cho phép Micro rồi bắt đầu lại nhé!' };
    }

    // 3. Setup AudioContexts (Input 16k stream + Output 24k playback + local replay recorder)
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
    inputAnalyser = inputCtx.createAnalyser();
    inputAnalyser.fftSize = 256;
    inputAnalyser.smoothingTimeConstant = 0.62;
    inputSource.connect(inputAnalyser);

    // Local MediaRecorder for end-of-exam replay audio
    localChunks = [];
    try {
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
      localRecorder = mime ? new MediaRecorder(mediaStream, { mimeType: mime }) : new MediaRecorder(mediaStream);
      localRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) localChunks.push(e.data); };
      localRecorder.start(400);
    } catch (_) {
      localRecorder = null;
    }

    // 4. Open Gemini Live WebSocket & wait for setupComplete (max 6s timeout -> clean fallback)
    active = true;
    setupComplete = false;
    pendingFinish = false;
    isModelSpeaking = false;
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
              temperature: 0.55,
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: tokenData.voiceName || (cfg.examinerId === 'oliver' ? 'Charon' : 'Aoede'),
                  },
                },
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

    // 5. Start streaming 16kHz PCM16 mic chunks to Gemini Live (~128ms per chunk)
    inputProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
    inputProcessor.onaudioprocess = (ev) => {
      if (!active || !setupComplete || !ws || ws.readyState !== WebSocket.OPEN) return;
      const f32 = ev.inputBuffer.getChannelData(0);
      const b64 = float32ToPcm16Base64(f32, inputCtx.sampleRate);
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
    inputSource.connect(inputProcessor);
    inputProcessor.connect(silentGain);
    silentGain.connect(inputCtx.destination);

    startMeterLoop();
    return { ok: true, model: tokenData.model, voiceName: tokenData.voiceName };
  }

  function closeSession() {
    active = false;
    setupComplete = false;
    pendingFinish = false;
    stopOutputPlayback();
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
    if (localRecorder) {
      try {
        localRecorder.ondataavailable = null;
        localRecorder.onstop = null;
        if (localRecorder.state !== 'inactive') localRecorder.stop();
      } catch (_) {}
      localRecorder = null;
    }
    localChunks = [];
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
    stopAndBuildAudioUrl,
    closeSession,
    isActive: () => active && setupComplete,
    isModelSpeaking: () => isModelSpeaking,
  };
})();
