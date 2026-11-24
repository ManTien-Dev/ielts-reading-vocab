/* =========================================================
   UNIFIED SPEED-RECOGNITION ENGINE (Đòn bẩy 3: Reading EN -> VI)
   Dùng chung cho:
   1. Recall Check 1 chạm (5 giây) ở Nền Tảng / Học Thuật / Chuyên Sâu
   2. Test Kết thúc Task (50 từ) của 3 bộ Reading (fnd_*, acd_*, adv_*)
   3. Test Tổng kết Toàn Bộ List (100% từ, chia chặng 50 từ + Checkpoint)
   ========================================================= */
(function () {
  const CHECKPOINT_KEY_BASE = 'ielts_recog_checkpoint_v1_';
  const CERT_KEY_BASE = 'ielts_list_certs_v1_';
  const SOUND_PREF_KEY = 'ielts_recog_sound_v1';
  const WORD_TIME_LIMIT_MS = 5000;
  const OLD_REVIEW_TIME_LIMIT_MS = 4000;
  const ROUND_SIZE = 50;
  const PASS_THRESHOLD_PCT = 94;

  function loadSoundEnabled() {
    try {
      const v = localStorage.getItem(SOUND_PREF_KEY);
      if (v === '0' || v === 'false') return false;
      return true;
    } catch (_) {
      return true;
    }
  }
  function saveSoundEnabled(val) {
    try {
      localStorage.setItem(SOUND_PREF_KEY, val ? '1' : '0');
    } catch (_) {}
  }

  let soundEnabled = loadSoundEnabled();
  let sfxCtx = null;

  function ensureSfxContext() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      if (!sfxCtx || sfxCtx.state === 'closed') {
        sfxCtx = new AC();
      }
      if (sfxCtx.state === 'suspended') {
        sfxCtx.resume?.().catch?.(() => {});
      }
      return sfxCtx;
    } catch (_) {
      return null;
    }
  }

  function playSfx(kind) {
    if (!soundEnabled) return;
    try {
      const ctx = ensureSfxContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const tone = (freq, startOffset, duration, peakGain, type = 'sine', endFreq = null) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, now + startOffset);
        if (endFreq && endFreq !== freq) {
          osc.frequency.exponentialRampToValueAtTime(endFreq, now + startOffset + duration);
        }
        gain.gain.setValueAtTime(0.0001, now + startOffset);
        gain.gain.linearRampToValueAtTime(peakGain, now + startOffset + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + startOffset + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + startOffset);
        osc.stop(now + startOffset + duration + 0.02);
      };

      if (kind === 'correct') {
        tone(587.33, 0, 0.095, 0.13, 'triangle');     // D5
        tone(880.0, 0.065, 0.13, 0.15, 'sine');       // A5
      } else if (kind === 'wrong') {
        tone(240, 0, 0.11, 0.12, 'triangle', 195);
        tone(185, 0.09, 0.14, 0.11, 'sine', 155);
      } else if (kind === 'tick') {
        tone(960, 0, 0.045, 0.055, 'sine');
      } else if (kind === 'complete') {
        tone(523.25, 0, 0.22, 0.13, 'sine');          // C5
        tone(659.25, 0.09, 0.24, 0.13, 'sine');       // E5
        tone(783.99, 0.18, 0.36, 0.15, 'sine');       // G5
      }
    } catch (_) {}
  }

  function stopAudio() {
    try { window.AppCore?.audio?.stop?.(); } catch (_) {}
  }

  function speakWordAudio(lemma, accentOverride, engine = 'youdao') {
    if (!lemma) return;
    ensureSfxContext();
    try {
      const accent = accentOverride || B()?.getPreferredAccent?.() || 'en-US';
      const opts = { engine, respectCustom: !accentOverride };
      if (B()?.speakText) {
        B().speakText(lemma, accent, opts);
      } else if (window.AppCore?.audio?.speak) {
        window.AppCore.audio.speak(lemma, { accent, rate: 0.92, ...opts });
      }
    } catch (_) {}
  }

  function speakCurrentWord(accentOverride, engineOverride) {
    const lemma = session?.currentItem?.lemma;
    if (!lemma) return;
    const chosenEngine = engineOverride || 'auto';
    speakWordAudio(lemma, accentOverride, chosenEngine);
  }

  function syncSoundToggleButton() {
    const btn = document.getElementById('btn-recog-sound-toggle');
    if (!btn) return;
    btn.classList.toggle('is-on', soundEnabled);
    btn.classList.toggle('is-off', !soundEnabled);
    btn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    btn.textContent = soundEnabled ? '🔊 Âm: Bật' : '🔇 Âm: Tắt';
  }

  function toggleSound() {
    soundEnabled = !soundEnabled;
    saveSoundEnabled(soundEnabled);
    syncSoundToggleButton();
    if (soundEnabled) {
      ensureSfxContext();
      if (session && (session.phase === 'quiz' || session.phase === 'error_loop') && !session.locked && session.currentItem?.lemma) {
        speakWordAudio(session.currentItem.lemma);
      }
    } else {
      stopAudio();
    }
    B()?.showToast?.(soundEnabled ? 'Đã bật âm thanh Speed Quiz' : 'Đã tắt âm thanh Speed Quiz');
  }

  function getWordTimeLimitMs() {
    return session?.mode === 'old_review' ? OLD_REVIEW_TIME_LIMIT_MS : WORD_TIME_LIMIT_MS;
  }

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function esc(s) {
    return B()?.escapeHtml ? B().escapeHtml(s) : String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function getUid() {
    const raw = B()?.getCurrentUser?.()?.id || 'guest';
    return B()?.getScopedUid ? B().getScopedUid(raw) : String(raw).toLowerCase();
  }
  function isTeacher() {
    return B()?.getCurrentUser?.()?.role === 'teacher';
  }

  // ---- Clean stem-overlap & meaning normalization for smart distractors ----
  function normMeaning(str) {
    return String(str || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
  }
  function primaryPosTag(pos) {
    return String(pos || '').split('·')[0].trim().toLowerCase();
  }
  function shareMorphRoot(a, b) {
    const la = String(a || '').toLowerCase().replace(/[^a-z]/g, '');
    const lb = String(b || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!la || !lb) return false;
    if (la === lb) return true;
    const minL = Math.min(la.length, lb.length);
    if (minL >= 4 && (la.startsWith(lb.slice(0, 4)) || lb.startsWith(la.slice(0, 4)))) {
      let pref = 0;
      while (pref < minL && la[pref] === lb[pref]) pref++;
      if (pref >= 5 || (pref >= 4 && minL <= 6)) return true;
    }
    return false;
  }
  function shuffleArr(arr) {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  function getGlobalVocabPool() {
    const d = window.APP_DATA || {};
    return [...(d.file2_families_3500 || []), ...(d.file1_paraphrase_1500 || [])];
  }

  function buildMeaningDistractors(targetItem, primaryPool, count = 3) {
    const targetLem = String(targetItem?.lemma || '').trim().toLowerCase();
    const targetMeaning = String(targetItem?.clean_meaning || targetItem?.meaning || targetItem?.definition || '').trim();
    const targetNorm = normMeaning(targetMeaning);
    const targetPos = primaryPosTag(targetItem?.clean_pos || targetItem?.pos);
    const targetSyns = new Set((targetItem?.clean_synonyms || targetItem?.synonyms || []).map((x) => String(x || '').toLowerCase().trim()));
    const targetWords = new Set(targetNorm.split(' ').filter((w) => w.length >= 3));

    const usedNorms = new Set([targetNorm]);
    const picked = [];

    const tryPool = (pool, requireSamePos) => {
      if (picked.length >= count || !Array.isArray(pool) || !pool.length) return;
      // Sample randomly instead of sorting full 5,500 pool every question for O(1) speed
      const len = pool.length;
      const maxProbes = Math.min(len * 2, 180);
      const visited = new Set();
      for (let p = 0; p < maxProbes && picked.length < count; p++) {
        const idx = Math.floor(Math.random() * len);
        if (visited.has(idx)) continue;
        visited.add(idx);
        const cand = pool[idx];
        if (!cand || cand.id === targetItem.id) continue;
        const cLem = String(cand.lemma || '').trim().toLowerCase();
        if (!cLem || cLem === targetLem || targetSyns.has(cLem) || shareMorphRoot(targetLem, cLem)) continue;
        const cMean = String(cand.clean_meaning || cand.meaning || cand.definition || '').trim();
        const cNorm = normMeaning(cMean);
        if (!cNorm || cNorm.length < 2 || usedNorms.has(cNorm)) continue;
        if (requireSamePos && targetPos && primaryPosTag(cand.clean_pos || cand.pos) !== targetPos) continue;
        // Avoid overlapping multi-word Vietnamese definitions
        const cWords = cNorm.split(' ').filter((w) => w.length >= 3);
        const overlap = cWords.filter((w) => targetWords.has(w)).length;
        if (cWords.length >= 2 && overlap / Math.min(cWords.length, Math.max(1, targetWords.size)) >= 0.6) continue;

        usedNorms.add(cNorm);
        picked.push({ id: cand.id, meaning: cMean, isCorrect: false });
      }
    };

    tryPool(primaryPool, true);
    tryPool(getGlobalVocabPool(), true);
    tryPool(primaryPool, false);
    tryPool(getGlobalVocabPool(), false);

    return shuffleArr([
      { id: targetItem.id, meaning: targetMeaning, isCorrect: true },
      ...picked.slice(0, count),
    ]);
  }

  // ---- Storage helpers for List Checkpoints & Mastery Certificates ----
  function loadCheckpoints() {
    try {
      const raw = localStorage.getItem(CHECKPOINT_KEY_BASE + getUid());
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
  }
  function saveCheckpoints(map) {
    try {
      localStorage.setItem(CHECKPOINT_KEY_BASE + getUid(), JSON.stringify(map || {}));
    } catch (_) {}
  }
  function loadListCerts() {
    try {
      const raw = localStorage.getItem(CERT_KEY_BASE + getUid());
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
  }
  function saveListCerts(map) {
    try {
      localStorage.setItem(CERT_KEY_BASE + getUid(), JSON.stringify(map || {}));
    } catch (_) {}
  }

  function getScopeInfo(scopeKey) {
    const d = window.APP_DATA || {};
    const f2 = d.file2_families_3500 || [];
    const f1 = d.file1_paraphrase_1500 || [];
    const map = {
      foundation: { key: 'foundation', name: 'Từ Vựng Nền Tảng', list: f2.slice(0, 1500), isTask: false },
      academic: { key: 'academic', name: 'Từ Vựng Học Thuật', list: f2.slice(1500, 2500), isTask: false },
      paraphrase: { key: 'paraphrase', name: 'Từ Vựng Paraphrase', list: f1, isTask: false },
      advanced: { key: 'advanced', name: 'Từ Vựng Chuyên Sâu', list: f2.slice(2500), isTask: false },
    };
    if (map[scopeKey]) return map[scopeKey];
    const taskObj = window.TasksModule?.getTaskById?.(scopeKey);
    if (taskObj && Array.isArray(taskObj.words) && taskObj.words.length) {
      return {
        key: taskObj.id,
        name: taskObj.label || taskObj.id,
        list: taskObj.words,
        isTask: true,
        taskObj,
      };
    }
    const ltInfo = window.ListeningTasksModule?.getTaskScopeInfo?.(scopeKey);
    if (ltInfo && Array.isArray(ltInfo.list) && ltInfo.list.length) {
      return ltInfo;
    }
    return null;
  }

  // ---- Active Exam Session State ----
  let session = null;
  let tickRaf = null;
  let autoNextTimer = null;
  let wordDeadlineAt = 0;
  let wordPausedRemainingMs = 0;
  let keydownBound = false;
  let visBound = false;
  let leaveWarnings = 0;
  let lastLeaveAt = 0;

  function stopTimers() {
    if (tickRaf) { cancelAnimationFrame(tickRaf); tickRaf = null; }
    if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
  }

  function updateScopeListTestButton() {
    const btn = document.getElementById('btn-top-list-final-test');
    if (!btn) return;
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    const info = getScopeInfo(scopeKey);
    if (!info) {
      btn.style.display = 'none';
      return;
    }
    btn.style.display = '';
    if (info.isTask) {
      const amap = B()?.getAssessmentsMap?.() || {};
      const total = info.list.length;
      const masteredCnt = info.list.reduce((s, w) => s + (amap[w.id] === 3 ? 1 : 0), 0);
      const remaining = Math.max(0, total - masteredCnt);
      if (remaining === 0) {
        btn.innerHTML = `<span>Vào Speed Quiz</span>`;
        btn.classList.remove('active');
      } else if (masteredCnt > 0) {
        btn.innerHTML = `<span>Vào Speed Quiz</span>`;
        btn.classList.add('active');
      } else {
        btn.innerHTML = `<span>Vào Speed Quiz</span>`;
        btn.classList.remove('active');
      }
      return;
    }
    const certs = loadListCerts();
    const cps = loadCheckpoints();
    const cert = certs[scopeKey];
    const cp = cps[scopeKey];
    if (cp && Array.isArray(cp.orderIds) && cp.cursor > 0 && cp.cursor < cp.orderIds.length) {
      btn.innerHTML = `<span>Speed Quiz (${cp.cursor}/${cp.orderIds.length})</span>`;
      btn.classList.add('active');
    } else if (cert?.passed) {
      btn.innerHTML = `<span>✓ Đạt (${cert.pct}%)</span>`;
      btn.classList.remove('active');
    } else {
      btn.innerHTML = `<span>Vào Speed Quiz</span>`;
      btn.classList.remove('active');
    }
  }

  function openModalShell() {
    const ov = document.getElementById('modal-recognition-test');
    if (ov) ov.classList.add('open');
    bindGlobalHandlers();
  }

  function closeModalShell() {
    stopTimers();
    stopAudio();
    const ov = document.getElementById('modal-recognition-test');
    if (ov) ov.classList.remove('open');
    session = null;
    updateScopeListTestButton();
  }

  function bindGlobalHandlers() {
    if (!keydownBound) {
      keydownBound = true;
      document.addEventListener('keydown', (e) => {
        if (!session || (session.phase !== 'quiz' && session.phase !== 'error_loop') || session.locked || session.paused) return;
        const ov = document.getElementById('modal-recognition-test');
        if (!ov || !ov.classList.contains('open')) return;
        if (e.key >= '1' && e.key <= '4') {
          e.preventDefault();
          chooseOption(Number(e.key) - 1);
        } else if (e.code === 'Space' || e.key === '0') {
          e.preventDefault();
          markDontKnow();
        } else if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          speakCurrentWord();
        }
      });
    }
    if (!visBound) {
      visBound = true;
      document.addEventListener('visibilitychange', () => {
        if (!session || session.phase !== 'quiz' || session.paused || isTeacher()) return;
        if (document.hidden) handleTabLeaveViolation('Bạn vừa chuyển tab khi đang làm bài Test phản xạ');
      });
      window.addEventListener('blur', () => {
        if (!session || session.phase !== 'quiz' || session.paused || isTeacher()) return;
        if (document.hidden) return;
        const fire = () => {
          if (!session || session.phase !== 'quiz' || session.paused || isTeacher() || document.hidden) return;
          handleTabLeaveViolation('Bạn vừa rời cửa sổ bài Test phản xạ');
        };
        if (window.CoreAntiCheatGuard?.handleSafeWindowBlur) {
          window.CoreAntiCheatGuard.handleSafeWindowBlur(fire);
        } else {
          fire();
        }
      });
    }
  }

  function handleTabLeaveViolation(reason) {
    const now = Date.now();
    if (now - lastLeaveAt < 1200) return;
    lastLeaveAt = now;
    leaveWarnings += 1;
    pauseWordClock();

    if (leaveWarnings < 3 && B()?.showCheatWarningModal) {
      B().showCheatWarningModal(
        `${reason}! Không bấm ra ngoài hay rời tab khi đang kiểm tra.`,
        () => {
          if (session && session.phase === 'quiz') resumeWordClock();
        },
        leaveWarnings,
        3
      );
      return;
    }
    // 3rd strike: void current round (for list_final) or fail current task exam cleanly
    B()?.closeCheatWarningModal?.();
    if (session.mode === 'task_final') {
      const tid = session.taskId;
      closeModalShell();
      window.TasksModule?.triggerExternalAntiCheatLock?.(tid, `${reason} (Lần 3)`);
    } else if (session.mode === 'old_review' || session.mode === 'task_study_quiz') {
      session.cursor = 0;
      session.correctCount = 0;
      session.wrongIds = [];
      closeModalShell();
      B()?.showToast?.('Đã dừng lượt Speed Quiz do rời màn hình kiểm tra (các từ trả lời đúng vẫn đã lưu Đã thuộc)!');
    } else {
      // Void current 50-word round back to start of this round (keeps prior completed rounds intact)
      const roundStart = Math.floor(session.cursor / ROUND_SIZE) * ROUND_SIZE;
      session.cursor = roundStart;
      session.roundCorrect = 0;
      session.roundWrongIds = [];
      persistListCheckpoint();
      B()?.showToast?.('Vi phạm rời tab lần 2 — đã hủy kết quả chặng 50 từ hiện tại, mời làm lại chặng này!');
      renderRoundIntro();
    }
  }

  function pauseWordClock() {
    if (!session || session.paused) return;
    session.paused = true;
    stopAudio();
    wordPausedRemainingMs = Math.max(400, wordDeadlineAt - Date.now());
    if (tickRaf) { cancelAnimationFrame(tickRaf); tickRaf = null; }
  }

  function resumeWordClock() {
    if (!session || !session.paused) return;
    session.paused = false;
    wordDeadlineAt = Date.now() + (wordPausedRemainingMs || getWordTimeLimitMs());
    startCountdownRaf();
  }

  function persistListCheckpoint() {
    if (!session || session.mode !== 'list_final') return;
    const cps = loadCheckpoints();
    cps[session.scopeKey] = {
      scopeKey: session.scopeKey,
      orderIds: session.orderIds,
      cursor: session.cursor,
      correctCount: session.correctCount,
      wrongIds: Array.from(new Set(session.wrongIds)),
      startedAt: session.startedAt,
      updatedAt: Date.now(),
    };
    saveCheckpoints(cps);
    B()?.scheduleCloudPush?.();
  }

  function clearListCheckpoint(scopeKey) {
    const cps = loadCheckpoints();
    delete cps[scopeKey];
    saveCheckpoints(cps);
    B()?.scheduleCloudPush?.();
  }

  // ---- Entry 1: Task Final Exam for Reading Tasks (fnd_*, acd_*, adv_*) ----
  function startTaskFinalExam(taskObj, onCompleteCallback) {
    if (!taskObj || !Array.isArray(taskObj.words) || !taskObj.words.length) return;
    stopTimers();
    leaveWarnings = 0;
    const itemById = new Map();
    const orderIds = shuffleArr(taskObj.words).map((w) => {
      itemById.set(w.id, w);
      return w.id;
    });

    session = {
      mode: 'task_final',
      taskId: taskObj.id,
      taskLabel: taskObj.label,
      scopeKey: taskObj.scopeKey || 'foundation',
      title: `${taskObj.label} · Test Kết thúc`,
      pool: taskObj.words,
      itemById,
      orderIds,
      cursor: 0,
      phase: 'intro', // intro | quiz | error_loop | result
      correctCount: 0,
      wrongIds: [],
      errorQueue: [],
      errorAttempts: 0,
      currentItem: null,
      currentOptions: [],
      locked: false,
      paused: false,
      startedAt: Date.now(),
      onCompleteCallback,
    };
    openModalShell();
    renderIntroScreen();
  }

  // ---- Entry 2: Full-List Cumulative Exam OR Active Task Study Speed Quiz ----
  function startListFinalExam(scopeKey) {
    const info = getScopeInfo(scopeKey || B()?.getCurrentScopeKey?.());
    if (!info || !info.list.length) {
      B()?.showToast?.('Bộ từ này không áp dụng bài Speed Quiz.');
      return;
    }
    stopTimers();
    leaveWarnings = 0;

    if (info.isTask) {
      const amap = B()?.getAssessmentsMap?.() || {};
      const unmastered = info.list.filter((w) => w && amap[w.id] !== 3);
      const targetWords = unmastered.length > 0 ? unmastered : info.list;
      const itemById = new Map(info.list.map((w) => [w.id, w]));
      const orderIds = shuffleArr(targetWords).map((w) => w.id);
      session = {
        mode: 'task_study_quiz',
        taskId: info.key,
        taskLabel: info.name,
        scopeKey: info.key,
        scopeName: info.name,
        isListeningTask: Boolean(info.isListeningTask),
        title: `Speed Quiz · ${info.name}`,
        pool: info.list,
        itemById,
        orderIds,
        cursor: 0,
        resumed: false,
        phase: 'intro',
        correctCount: 0,
        wrongIds: [],
        roundCorrect: 0,
        roundWrongIds: [],
        errorQueue: [],
        errorAttempts: 0,
        currentItem: null,
        currentOptions: [],
        locked: false,
        paused: false,
        startedAt: Date.now(),
        onCompleteCallback: null,
      };
      openModalShell();
      renderIntroScreen();
      return;
    }

    const itemById = new Map(info.list.map((w) => [w.id, w]));
    const cps = loadCheckpoints();
    const saved = cps[info.key];
    let orderIds = null;
    let cursor = 0;
    let correctCount = 0;
    let wrongIds = [];
    let startedAt = Date.now();
    let resumed = false;

    if (saved && Array.isArray(saved.orderIds) && saved.orderIds.length === info.list.length && saved.cursor > 0 && saved.cursor < saved.orderIds.length) {
      if (saved.orderIds.every((id) => itemById.has(id))) {
        cursor = saved.cursor;
        orderIds = saved.orderIds.slice(0, cursor).concat(shuffleArr(saved.orderIds.slice(cursor)));
        correctCount = Number(saved.correctCount || 0);
        wrongIds = Array.isArray(saved.wrongIds) ? saved.wrongIds.filter((id) => itemById.has(id)) : [];
        startedAt = Number(saved.startedAt || Date.now());
        resumed = true;
      }
    }
    if (!orderIds) {
      orderIds = shuffleArr(info.list).map((w) => w.id);
    }

    session = {
      mode: 'list_final',
      scopeKey: info.key,
      scopeName: info.name,
      title: `Speed Quiz · ${info.name}`,
      pool: info.list,
      itemById,
      orderIds,
      cursor,
      resumed,
      phase: 'intro',
      correctCount,
      wrongIds,
      roundCorrect: 0,
      roundWrongIds: [],
      errorQueue: [],
      errorAttempts: 0,
      currentItem: null,
      currentOptions: [],
      locked: false,
      paused: false,
      startedAt,
      onCompleteCallback: null,
    };
    openModalShell();
    renderIntroScreen();
  }

  // ---- Entry 3: Pre-Task Old-Vocab Speed Quiz Review ----
  function startOldReviewQuiz(rawWords, taskId, taskLabel = '', onCompleteCallback = null) {
    const poolById = new Map(getGlobalVocabPool().map((w) => [w.id, w]));
    const resolved = (Array.isArray(rawWords) ? rawWords : [])
      .map((w) => (w && w.id && poolById.get(w.id)) || w)
      .filter((w) => w && w.id);
    if (!resolved.length) return false;
    stopTimers();
    leaveWarnings = 0;
    const itemById = new Map(resolved.map((w) => [w.id, w]));
    const orderIds = shuffleArr(resolved).map((w) => w.id);

    session = {
      mode: 'old_review',
      taskId: taskId || '',
      taskLabel: taskLabel || taskId || 'Task',
      scopeKey: 'old_review',
      title: `Speed Quiz · Ôn ${resolved.length} từ cũ`,
      pool: resolved,
      itemById,
      orderIds,
      cursor: 0,
      phase: 'intro',
      correctCount: 0,
      wrongIds: [],
      errorQueue: [],
      errorAttempts: 0,
      currentItem: null,
      currentOptions: [],
      locked: false,
      paused: false,
      startedAt: Date.now(),
      onCompleteCallback,
    };
    openModalShell();
    renderIntroScreen();
    return true;
  }

  function renderIntroScreen() {
    if (!session) return;
    session.phase = 'intro';
    const body = document.getElementById('recog-modal-body');
    const badge = document.getElementById('recog-modal-badge');
    const titleEl = document.getElementById('recog-modal-title');
    if (badge) {
      badge.textContent = session.mode === 'task_final'
        ? 'TEST KẾT THÚC TASK'
        : (session.mode === 'old_review'
          ? 'SPEED QUIZ · ÔN TẬP TỪ CŨ'
          : (session.mode === 'task_study_quiz' ? 'SPEED QUIZ · HỌC TỪ TASK' : 'SPEED QUIZ · 100% BỘ TỪ'));
    }
    if (titleEl) titleEl.textContent = session.title;
    if (!body) return;

    const total = session.orderIds.length;
    const totalRounds = Math.ceil(total / ROUND_SIZE);
    const curRound = Math.floor(session.cursor / ROUND_SIZE) + 1;
    const isList = session.mode === 'list_final';
    const isOldReview = session.mode === 'old_review';
    const isTaskStudy = session.mode === 'task_study_quiz';
    const limitSec = Math.round(getWordTimeLimitMs() / 1000);
    const poolTotal = Array.isArray(session.pool) && session.pool.length ? session.pool.length : total;
    const isListenMode = Boolean(session.isListeningTask || /^ltask_/i.test(String(session.scopeKey || '')));

    body.innerHTML = `
      <div class="recog-intro-card">
        <div class="recog-intro-title">${isList ? `Kiểm chứng 100% mặt chữ &amp; nghĩa (${total.toLocaleString('vi-VN')} từ)` : (isTaskStudy ? `Speed Quiz ${total} từ của ${esc(session.taskLabel)} — Đúng hết mở Test ngay!` : (isOldReview ? `Ôn nhanh ${total} từ cũ qua Speed Quiz để mở ${esc(session.taskLabel)}` : `Kiểm tra phản xạ đọc hiểu (${total} từ)`))}</div>
        <div class="recog-rules-list">
          <div><strong>1. Tốc độ ${isListenMode ? 'Listening' : 'Reading'} thực chiến:</strong> Mỗi từ có <strong>${limitSec} giây</strong> để ${isListenMode ? 'nghe/nhìn từ' : 'nhìn mặt chữ'} và chọn đúng nghĩa tiếng Việt (phím <code>1–4</code> hoặc <code>Space</code> nếu <em>Chưa biết</em>).</div>
          <div><strong>2. Đảm bảo thuộc nằm lòng:</strong> ${(isOldReview || isTaskStudy) ? 'Hoàn tất lượt kiểm tra và vượt qua <strong>Vòng Sửa Lỗi 100%</strong> cho các từ sai/chậm.' : `Vòng 1 cần đạt <strong>&ge; ${PASS_THRESHOLD_PCT}%</strong>, sau đó vượt qua <strong>Vòng Sửa Lỗi 100%</strong> cho các từ sai/chậm.`}</div>
          ${isList
            ? `<div><strong>3. Tự động phân loại Đã thuộc / Chưa thuộc:</strong> Trả lời đúng &le; ${limitSec} giây tự động đưa vào <strong>Đã thuộc</strong>; trả lời sai, hết giờ hoặc bấm <em>Chưa biết</em> tự động đưa vào <strong>Chưa thuộc</strong> (và <strong>Cần ôn</strong>) để lọc học lại ngay.</div>
               <div><strong>4. Chia ${totalRounds} chặng &times; ${ROUND_SIZE} từ (Tự động lưu):</strong> Có thể bấm <strong>Tạm lưu &amp; Nghỉ</strong> bất cứ lúc nào, lần sau thi tiếp đúng vị trí đang dở.</div>`
            : (isTaskStudy
              ? `<div><strong>3. Tự động cập nhật Đã thuộc &amp; mở Test Task:</strong> Trả lời đúng &le; ${limitSec} giây tự động đánh dấu <strong>Đã thuộc</strong> ngay lập tức. Hoàn thành đúng sạch 100% (${poolTotal}/${poolTotal} từ) là <strong>vào làm Test Task được luôn</strong>!</div>`
              : (isOldReview
                ? `<div><strong>3. Tự động mở khóa Task:</strong> Ngay khi sửa sạch lỗi (100% từ vượt ngưỡng &le; ${limitSec} giây), các từ cũ được cập nhật <strong>Đã thuộc</strong> và bạn vào làm <strong>${esc(session.taskLabel)}</strong> ngay lập tức.</div>`
                : `<div><strong>3. Kỷ luật phòng thi:</strong> Không chuyển tab / rời cửa sổ khi đang làm bài (rời quá 3 lần sẽ bị khóa bài).</div>`))}
        </div>
        ${session.resumed ? `
          <div class="recog-resume-banner">
            Đã khôi phục tiến độ trước đó: <strong>${session.cursor} / ${total} từ</strong> (Chặng ${curRound} / ${totalRounds} · Đúng ${session.correctCount} từ).
          </div>` : ''}
        <div class="recog-intro-actions">
          <button type="button" class="btn-subtle" onclick="RecognitionTestModule.closeModal()">Để sau</button>
          ${session.resumed ? `<button type="button" class="btn-subtle" onclick="RecognitionTestModule.restartListExam()">Làm mới từ đầu</button>` : ''}
          <button type="button" class="btn btn-primary" id="btn-recog-start" onclick="RecognitionTestModule.beginActiveRound()">
            ${session.resumed ? `Tiếp tục từ câu ${session.cursor + 1} →` : (isList ? `Bắt đầu Chặng 1 / ${totalRounds} →` : 'Bắt đầu làm bài →')}
          </button>
        </div>
      </div>
    `;
  }

  function restartListExam() {
    if (!session || session.mode !== 'list_final') return;
    clearListCheckpoint(session.scopeKey);
    startListFinalExam(session.scopeKey);
  }

  function renderRoundIntro() {
    if (!session) return;
    stopAudio();
    playSfx('complete');
    session.phase = 'intro';
    const body = document.getElementById('recog-modal-body');
    if (!body) return;
    const total = session.orderIds.length;
    const totalRounds = Math.ceil(total / ROUND_SIZE);
    const doneRounds = Math.floor(session.cursor / ROUND_SIZE);
    const nextRound = doneRounds + 1;
    const pctSoFar = session.cursor > 0 ? Math.round((session.correctCount / session.cursor) * 100) : 100;

    body.innerHTML = `
      <div class="recog-intro-card" style="text-align:center;">
        <div class="recog-intro-title" style="color:var(--success);">✓ Đã xong Chặng ${doneRounds} / ${totalRounds}!</div>
        <p style="font-size:15.5px; color:var(--text-muted); margin:10px 0 18px;">
          Tiến độ tích lũy: <strong>${session.cursor} / ${total} từ</strong> · Chính xác hiện tại: <strong>${pctSoFar}%</strong> (${session.wrongIds.length} từ cần sửa lỗi cuối bài).
          <br>Tiến độ đã được <strong>tự động lưu</strong>! Bạn có thể nghỉ hoặc chạy tiếp ngay chặng ${nextRound}.
        </p>
        <div class="recog-intro-actions" style="justify-content:center;">
          <button type="button" class="btn-subtle" onclick="RecognitionTestModule.pauseAndSaveExit()">Tạm lưu &amp; Nghỉ</button>
          <button type="button" class="btn btn-primary" id="btn-recog-next-round" onclick="RecognitionTestModule.beginActiveRound()">
            Chạy tiếp Chặng ${nextRound} / ${totalRounds} →
          </button>
        </div>
      </div>
    `;
  }

  function beginActiveRound() {
    if (!session) return;
    if (Array.isArray(session.orderIds) && session.orderIds.length > 1) {
      const donePrefix = session.orderIds.slice(0, session.cursor);
      const remShuffled = shuffleArr(session.orderIds.slice(session.cursor));
      session.orderIds = donePrefix.concat(remShuffled);
    }
    session.phase = 'quiz';
    session.paused = false;
    session.locked = false;
    session.roundCorrect = 0;
    session.roundWrongIds = [];
    loadCurrentQuestion();
  }

  function beginErrorClearanceLoop() {
    if (!session) return;
    const uniqWrong = Array.from(new Set(session.wrongIds));
    if (!uniqWrong.length) {
      finishExamSuccess();
      return;
    }
    session.phase = 'error_loop';
    session.errorQueue = shuffleArr(uniqWrong);
    session.paused = false;
    session.locked = false;
    loadCurrentQuestion();
  }

  function loadCurrentQuestion() {
    stopTimers();
    if (!session) return;

    let itemId = null;
    if (session.phase === 'quiz') {
      if (session.cursor >= session.orderIds.length) {
        evaluateMainRoundComplete();
        return;
      }
      itemId = session.orderIds[session.cursor];
    } else if (session.phase === 'error_loop') {
      if (!session.errorQueue.length) {
        finishExamSuccess();
        return;
      }
      itemId = session.errorQueue[0];
    } else {
      return;
    }

    const item = session.itemById.get(itemId);
    if (!item) return;
    session.currentItem = item;
    session.currentOptions = shuffleArr(buildMeaningDistractors(item, session.pool, 3));
    session.locked = false;
    session._tickFlags = { t1500: false, t750: false };

    renderQuestionCard();
    if (soundEnabled) {
      speakWordAudio(item.lemma);
    }
    wordDeadlineAt = Date.now() + getWordTimeLimitMs();
    startCountdownRaf();
  }

  function renderQuestionCard() {
    const body = document.getElementById('recog-modal-body');
    if (!body || !session || !session.currentItem) return;
    const item = session.currentItem;
    const isErrLoop = session.phase === 'error_loop';
    const total = session.orderIds.length;
    const curPos = isErrLoop ? session.errorQueue.length : (session.cursor + 1);
    const pct = isErrLoop
      ? Math.max(5, Math.round(((Math.max(1, session.wrongIds.length) - session.errorQueue.length) / Math.max(1, session.wrongIds.length)) * 100))
      : Math.round((session.cursor / Math.max(1, total)) * 100);
    const totalRounds = Math.ceil(total / ROUND_SIZE);
    const curRound = Math.min(totalRounds, Math.floor(session.cursor / ROUND_SIZE) + 1);
    const ipaText = item.ipa || window.IPA_DICT?.[String(item.lemma || '').toLowerCase()] || '';
    const posText = item.clean_pos || item.pos || '';

    const optsHtml = session.currentOptions.map((opt, i) => `
      <button type="button" class="recog-opt-btn" id="recog-opt-${i}" onclick="RecognitionTestModule.chooseOption(${i})">
        <span class="recog-opt-key">${i + 1}</span>
        <span class="recog-opt-text">${esc(opt.meaning)}</span>
      </button>
    `).join('');

    body.innerHTML = `
      <div class="recog-quiz-wrap">
        <div class="recog-top-meta">
          <div class="recog-meta-left">
            ${isErrLoop
              ? `<span class="recog-pill is-err">VÒNG SỬA LỖI 100% · Còn ${curPos} từ</span>`
              : `<span class="recog-pill">${session.mode === 'list_final' ? `Chặng ${curRound}/${totalRounds} · ` : ''}Câu ${curPos} / ${total}</span>`}
          </div>
          <div class="recog-meta-right">
            <button type="button" class="btn-subtle recog-sound-btn ${soundEnabled ? 'is-on' : 'is-off'}" id="btn-recog-sound-toggle" title="Bật / Tắt phát âm tự động và hiệu ứng âm thanh (phím R để nghe lại)" aria-pressed="${soundEnabled ? 'true' : 'false'}" onclick="RecognitionTestModule.toggleSound()">
              ${soundEnabled ? '🔊 Âm: Bật' : '🔇 Âm: Tắt'}
            </button>
            <span class="recog-timer-text" id="recog-timer-text">${(getWordTimeLimitMs() / 1000).toFixed(1)}s</span>
            ${session.mode === 'list_final' && !isErrLoop
              ? `<button type="button" class="btn-subtle" style="padding:4px 10px; font-size:12px;" onclick="RecognitionTestModule.pauseAndSaveExit()">Tạm lưu</button>`
              : ''}
          </div>
        </div>

        <div class="recog-progress-bar" aria-hidden="true">
          <div class="recog-progress-fill" style="width:${pct}%;"></div>
        </div>

        <div class="recog-countdown-track" aria-hidden="true">
          <div class="recog-countdown-fill" id="recog-countdown-fill" style="width:100%;"></div>
        </div>

        <div class="recog-word-stage">
          <div class="recog-word-row">
            <span class="recog-word-main" id="recog-word-main">${esc(item.lemma)}</span>
            <button type="button" class="btn-voice-speak" title="Nghe phát âm Anh - Anh (UK)" onclick="RecognitionTestModule.speakCurrentWord('en-GB')"><span>UK</span></button>
            <button type="button" class="btn-voice-speak" title="Nghe phát âm Anh - Mỹ (US)" onclick="RecognitionTestModule.speakCurrentWord('en-US')"><span>US</span></button>
          </div>
          <div class="recog-word-sub">
            ${ipaText ? `<span class="recog-ipa">${esc(ipaText)}</span>` : ''}
            ${posText ? `<span class="recog-pos-chip">${esc(posText)}</span>` : ''}
          </div>
        </div>

        <div class="recog-options-grid" id="recog-options-grid">
          ${optsHtml}
        </div>

        <div class="recog-footer-row">
          <button type="button" class="recog-dontknow-btn" id="btn-recog-dontknow" onclick="RecognitionTestModule.markDontKnow()">
            Chưa biết / Bỏ qua nhanh <kbd>Space</kbd>
          </button>
          <div class="recog-feedback-line" id="recog-feedback-line"></div>
        </div>
      </div>
    `;
  }

  function startCountdownRaf() {
    if (tickRaf) cancelAnimationFrame(tickRaf);
    const limitMs = getWordTimeLimitMs();
    const limitSec = Math.round(limitMs / 1000);
    const step = () => {
      if (!session || session.locked || session.paused) return;
      const rem = Math.max(0, wordDeadlineAt - Date.now());
      const pct = Math.max(0, Math.min(100, (rem / limitMs) * 100));
      const bar = document.getElementById('recog-countdown-fill');
      const txt = document.getElementById('recog-timer-text');
      if (bar) {
        bar.style.width = pct.toFixed(1) + '%';
        bar.classList.toggle('is-urgent', rem <= 1500);
      }
      if (txt) {
        txt.textContent = (rem / 1000).toFixed(1) + 's';
        txt.classList.toggle('is-urgent', rem <= 1500);
      }
      if (soundEnabled && session._tickFlags) {
        if (rem <= 1500 && rem > 750 && !session._tickFlags.t1500) {
          session._tickFlags.t1500 = true;
          playSfx('tick');
        } else if (rem <= 750 && rem > 0 && !session._tickFlags.t750) {
          session._tickFlags.t750 = true;
          playSfx('tick');
        }
      }
      if (rem <= 0) {
        handleAnswerOutcome(false, -1, `Hết ${limitSec} giây!`);
        return;
      }
      tickRaf = requestAnimationFrame(step);
    };
    tickRaf = requestAnimationFrame(step);
  }

  function chooseOption(optIdx) {
    if (!session || session.locked || session.paused) return;
    const opt = session.currentOptions[optIdx];
    if (!opt) return;
    handleAnswerOutcome(Boolean(opt.isCorrect), optIdx, opt.isCorrect ? '' : 'Chưa đúng');
  }

  function markDontKnow() {
    if (!session || session.locked || session.paused) return;
    handleAnswerOutcome(false, -1, 'Đã ghi nhận Chưa biết');
  }

  function handleAnswerOutcome(isCorrect, chosenIdx, noteText) {
    if (!session || session.locked) return;
    session.locked = true;
    stopTimers();
    stopAudio();
    playSfx(isCorrect ? 'correct' : 'wrong');

    const item = session.currentItem;
    const correctIdx = session.currentOptions.findIndex((o) => o.isCorrect);
    const chosenBtn = chosenIdx >= 0 ? document.getElementById(`recog-opt-${chosenIdx}`) : null;
    const correctBtn = correctIdx >= 0 ? document.getElementById(`recog-opt-${correctIdx}`) : null;
    const fb = document.getElementById('recog-feedback-line');

    if (isCorrect) {
      if (chosenBtn) chosenBtn.classList.add('is-correct');
      if (fb) { fb.textContent = '✓ Chính xác!'; fb.className = 'recog-feedback-line is-ok'; }
    } else {
      if (chosenBtn) chosenBtn.classList.add('is-wrong');
      if (correctBtn) correctBtn.classList.add('is-correct');
      if (fb) {
        fb.textContent = `${noteText || 'Sai'} — Đáp án: ${item.clean_meaning || item.meaning || ''}`;
        fb.className = 'recog-feedback-line is-err';
      }
    }

    if (session.phase === 'quiz') {
      if (isCorrect) {
        session.correctCount += 1;
        session.roundCorrect = (session.roundCorrect || 0) + 1;
        if (session.mode === 'list_final' || session.mode === 'task_study_quiz') {
          B()?.markMasteredBatch?.([item.id]);
          if (session.mode === 'task_study_quiz') window.TasksModule?.updateTaskStudyBar?.();
        }
      } else {
        session.wrongIds.push(item.id);
        session.roundWrongIds = session.roundWrongIds || [];
        session.roundWrongIds.push(item.id);
        if (session.mode === 'list_final' || session.mode === 'task_study_quiz') {
          B()?.setWordWeakLevel?.(item.id, 1);
          if (session.mode === 'task_study_quiz') window.TasksModule?.updateTaskStudyBar?.();
        }
      }
      session.cursor += 1;
      if (session.mode === 'list_final') persistListCheckpoint();

      const delay = isCorrect ? 220 : 820;
      autoNextTimer = setTimeout(() => {
        if (!session) return;
        if (session.mode === 'list_final' && session.cursor < session.orderIds.length && session.cursor % ROUND_SIZE === 0) {
          renderRoundIntro();
        } else {
          loadCurrentQuestion();
        }
      }, delay);
    } else if (session.phase === 'error_loop') {
      session.errorAttempts += 1;
      const curId = session.errorQueue.shift();
      if (!isCorrect && curId) {
        // Push back to end of error queue until 100% mastered within 5s
        session.errorQueue.push(curId);
      } else if (isCorrect && curId && (session.mode === 'list_final' || session.mode === 'task_study_quiz')) {
        B()?.markMasteredBatch?.([curId]);
        if (session.mode === 'task_study_quiz') window.TasksModule?.updateTaskStudyBar?.();
      }
      const delay = isCorrect ? 220 : 900;
      autoNextTimer = setTimeout(() => {
        if (!session) return;
        loadCurrentQuestion();
      }, delay);
    }
  }

  function evaluateMainRoundComplete() {
    if (!session) return;
    const total = session.orderIds.length;
    const pct = Math.round((session.correctCount / Math.max(1, total)) * 100);
    const uniqWrong = Array.from(new Set(session.wrongIds));

    if (session.mode !== 'old_review' && session.mode !== 'task_study_quiz' && pct < PASS_THRESHOLD_PCT) {
      renderFailScreen(pct, uniqWrong);
      return;
    }
    if (uniqWrong.length > 0) {
      renderErrorLoopPrompt(pct, uniqWrong);
      return;
    }
    finishExamSuccess();
  }

  function renderErrorLoopPrompt(pct, wrongIds) {
    const body = document.getElementById('recog-modal-body');
    if (!body || !session) return;
    const rows = wrongIds.map((id) => {
      const it = session.itemById.get(id);
      if (!it) return '';
      return `<div class="recog-miss-row"><strong>${esc(it.lemma)}</strong><span>${esc(it.clean_meaning || it.meaning || '')}</span></div>`;
    }).join('');

    body.innerHTML = `
      <div class="recog-intro-card">
        <div class="recog-intro-title" style="color:var(--accent);">Vòng 1 đạt ${pct}% — Còn ${wrongIds.length} từ cần chốt 100%!</div>
        <p style="font-size:15px; color:var(--text-muted); margin:6px 0 12px;">
          Xem nhanh ${wrongIds.length} từ bạn vừa nhầm/chậm rồi bấm <strong>Vào Vòng Sửa Lỗi</strong>. Trả lời đúng sạch 100% trong &le; ${Math.round(getWordTimeLimitMs() / 1000)} giây là chính thức hoàn thành!
        </p>
        <div class="recog-miss-list">${rows}</div>
        <div class="recog-intro-actions" style="margin-top:16px;">
          <button type="button" class="btn btn-primary" id="btn-recog-start-errloop" onclick="RecognitionTestModule.beginErrorClearanceLoop()">
            Vào Vòng Sửa Lỗi (${wrongIds.length} từ) →
          </button>
        </div>
      </div>
    `;
  }

  function renderFailScreen(pct, wrongIds) {
    if (!session) return;
    session.phase = 'result';
    const body = document.getElementById('recog-modal-body');
    if (!body) return;
    if (session.mode === 'list_final') clearListCheckpoint(session.scopeKey);

    const rows = wrongIds.slice(0, 40).map((id) => {
      const it = session.itemById.get(id);
      if (!it) return '';
      return `<div class="recog-miss-row"><strong>${esc(it.lemma)}</strong><span>${esc(it.clean_meaning || it.meaning || '')}</span></div>`;
    }).join('');
    const moreNote = wrongIds.length > 40 ? `<div style="font-size:13px; color:var(--text-muted); padding:6px 0;">... và ${wrongIds.length - 40} từ khác (đã đánh dấu Chưa nhớ để bạn lọc ôn lại).</div>` : '';

    // Mark wrong words as level 1 (Chưa nhớ) so student sees them immediately under "Chưa thuộc"
    wrongIds.forEach((id) => {
      const it = session.itemById.get(id);
      if (it && B()?.setWordWeakLevel) B().setWordWeakLevel(id, 1);
    });

    body.innerHTML = `
      <div class="recog-intro-card">
        <div class="recog-intro-title" style="color:var(--danger);">Chưa đạt chuẩn (${pct}% &lt; ${PASS_THRESHOLD_PCT}%)</div>
        <p style="font-size:15px; color:var(--text-muted); margin:6px 0 12px;">
          Bạn đúng <strong>${session.correctCount}/${session.orderIds.length} từ</strong> và còn <strong>${wrongIds.length} từ</strong> sai hoặc phản xạ chậm hơn ${Math.round(getWordTimeLimitMs() / 1000)} giây. Hãy ôn lại các từ dưới đây rồi thi lại nhé!
        </p>
        <div class="recog-miss-list">${rows}${moreNote}</div>
        <div class="recog-intro-actions" style="margin-top:16px;">
          <button type="button" class="btn-subtle" onclick="RecognitionTestModule.closeModal()">Quay lại ôn từ</button>
          <button type="button" class="btn btn-primary" onclick="RecognitionTestModule.retryCurrentExam()">Thi lại ngay</button>
        </div>
      </div>
    `;
  }

  function retryCurrentExam() {
    if (!session) return;
    if (session.mode === 'task_final') {
      const t = window.TasksModule?.getTaskById?.(session.taskId);
      const cb = session.onCompleteCallback;
      if (t) startTaskFinalExam(t, cb);
    } else {
      clearListCheckpoint(session.scopeKey);
      startListFinalExam(session.scopeKey);
    }
  }

  function finishExamSuccess() {
    if (!session) return;
    stopTimers();
    stopAudio();
    playSfx('complete');
    session.phase = 'result';
    session.passed = true;
    const total = session.orderIds.length;
    const pct = Math.round((session.correctCount / Math.max(1, total)) * 100);
    const elapsedSec = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));

    // Mark all words mastered (synced via lemma!)
    B()?.markMasteredBatch?.(session.orderIds);
    if (session.mode === 'task_study_quiz') {
      window.TasksModule?.updateTaskStudyBar?.();
    }

    if (session.mode === 'task_final' || session.mode === 'old_review') {
      if (typeof session.onCompleteCallback === 'function') {
        session.onCompleteCallback({
          taskId: session.taskId,
          round1Pct: pct,
          correctCount: session.correctCount,
          totalWords: total,
          wrongCount: Math.max(0, total - session.correctCount),
          elapsedSec,
        });
      }
    } else if (session.mode === 'list_final') {
      clearListCheckpoint(session.scopeKey);
      const certs = loadListCerts();
      certs[session.scopeKey] = {
        passed: true,
        pct,
        totalWords: total,
        elapsedSec,
        completedAt: Date.now(),
      };
      saveListCerts(certs);
      B()?.scheduleCloudPush?.();
    }

    const body = document.getElementById('recog-modal-body');
    if (!body) return;
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;
    const durStr = mins > 0 ? `${mins} phút ${secs} giây` : `${secs} giây`;

    body.innerHTML = `
      <div class="recog-intro-card" style="text-align:center;">
        <img src="assets/images/totoro_sitting_branch.png" alt="" class="celebrate-panda-img celebrate-totoro-img" style="width:94px; height:86px; margin-bottom:10px;">
        <div class="recog-intro-title" style="color:var(--success);">
          ${session.mode === 'task_final'
            ? `✓ Hoàn thành xuất sắc ${esc(session.taskLabel)}!`
            : (session.mode === 'task_study_quiz'
              ? `✓ Đã thuộc sạch từ vựng ${esc(session.taskLabel)} — Sẵn sàng làm Test!`
              : (session.mode === 'old_review'
                ? `✓ Đã hoàn tất Speed Quiz ôn ${total} từ cũ!`
                : `✓ Chinh phục 100% ${esc(session.scopeName)}!`))}
        </div>
        <p style="font-size:15.5px; color:var(--text-muted); margin:10px 0 18px; line-height:1.6;">
          Phản xạ Vòng 1: <strong>${session.correctCount}/${total} từ (${pct}%)</strong> · Sửa lỗi 100%: <strong>Đạt</strong> · Thời gian: <strong>${durStr}</strong>.
          <br>Toàn bộ <strong>${total.toLocaleString('vi-VN')} từ</strong> đã được xác nhận <strong>Đã thuộc</strong>${session.mode === 'task_study_quiz' ? ' — bạn có thể bấm vào làm bài Test Task ngay bây giờ!' : ' và đồng bộ sang các bộ từ liên quan!'}
        </p>
        <div class="recog-intro-actions" style="justify-content:center;">
          ${session.mode === 'task_study_quiz'
            ? `<button type="button" class="btn-subtle" onclick="RecognitionTestModule.closeModal()">Quay lại Flashcard</button>
               <button type="button" class="btn btn-primary" id="btn-recog-start-task-test" onclick="RecognitionTestModule.closeAndStartTaskTest()">Làm Test Task ngay →</button>`
            : `<button type="button" class="btn btn-primary" id="btn-recog-done" onclick="RecognitionTestModule.closeModal()">${session.mode === 'old_review' ? `Hoàn tất &amp; Mở ${esc(session.taskLabel)} →` : 'Hoàn tất &amp; Quay lại'}</button>`}
        </div>
      </div>
    `;
    updateScopeListTestButton();
  }

  function pauseAndSaveExit() {
    if (session && session.mode === 'list_final') {
      persistListCheckpoint();
      B()?.showToast?.(`Đã lưu tiến độ tại câu ${session.cursor}/${session.orderIds.length}. Lần sau vào làm tiếp nhé!`);
    }
    closeModalShell();
  }

  function closeAndStartTaskTest() {
    closeModalShell();
    window.TasksModule?.updateTaskStudyBar?.();
    window.TasksModule?.onClickStartTaskExam?.();
  }

  function closeModal(event) {
    if (event && event.target !== document.getElementById('modal-recognition-test')) return;
    const completedTaskFinal = Boolean(session && session.mode === 'task_final' && session.phase === 'result' && session.passed);
    const completedOldReviewTaskId = (session && session.mode === 'old_review' && session.phase === 'result' && session.passed)
      ? session.taskId
      : '';
    if (session && session.mode === 'list_final' && session.phase === 'quiz' && session.cursor > 0) {
      persistListCheckpoint();
    }
    closeModalShell();
    if (completedTaskFinal) {
      window.TasksModule?.exitTaskWorkspace?.(false);
    } else if (completedOldReviewTaskId) {
      window.TasksModule?.openTaskBriefModal?.(completedOldReviewTaskId);
    }
  }

  // Cloud Sync serialization hooks
  function exportCloudRecognitionData() {
    return {
      listFinalCheckpoints: loadCheckpoints(),
      listMasteryCerts: loadListCerts(),
    };
  }
  function importCloudRecognitionData(sd) {
    if (!sd || typeof sd !== 'object') return false;
    let changed = false;
    if (sd.listFinalCheckpoints && typeof sd.listFinalCheckpoints === 'object') {
      const local = loadCheckpoints();
      Object.entries(sd.listFinalCheckpoints).forEach(([k, v]) => {
        if (v && (!local[k] || Number(v.updatedAt || 0) > Number(local[k].updatedAt || 0))) {
          local[k] = v;
          changed = true;
        }
      });
      if (changed) saveCheckpoints(local);
    }
    if (sd.listMasteryCerts && typeof sd.listMasteryCerts === 'object') {
      const localC = loadListCerts();
      let cChanged = false;
      Object.entries(sd.listMasteryCerts).forEach(([k, v]) => {
        if (v?.passed && (!localC[k]?.passed || Number(v.completedAt || 0) > Number(localC[k].completedAt || 0))) {
          localC[k] = v;
          cChanged = true;
        }
      });
      if (cChanged) {
        saveListCerts(localC);
        changed = true;
      }
    }
    if (changed) updateScopeListTestButton();
    return changed;
  }

  window.RecognitionTestModule = {
    buildMeaningDistractors,
    startTaskFinalExam,
    startListFinalExam,
    startOldReviewQuiz,
    beginActiveRound,
    beginErrorClearanceLoop,
    chooseOption,
    markDontKnow,
    toggleSound,
    speakCurrentWord,
    isSoundEnabled: () => soundEnabled,
    pauseAndSaveExit,
    restartListExam,
    retryCurrentExam,
    closeModal,
    closeAndStartTaskTest,
    updateScopeListTestButton,
    exportCloudRecognitionData,
    importCloudRecognitionData,
    isActive: () => Boolean(session),
    getListCerts: loadListCerts,
    getCheckpoints: loadCheckpoints,
  };
})();
