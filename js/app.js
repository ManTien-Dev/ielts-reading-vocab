/**
 * IELTS READING VOCAB MASTER — CLASSIC BOTANICAL VOCAB STUDIO + READING 95.5% ENGINE
 * Datasets: File 1 (1,500 Paraphrase Q&A clustered) + File 2 (3,500 Word Families 95.5% coverage) + 40 Signal Words
 */
(() => {
  'use strict';

  // Live Proxy over window.APP_DATA so AccessPolicy dynamic load & memory purge take effect immediately
  const APP_DATA = new Proxy({}, {
    get: (_t, prop) => (window.APP_DATA || {})[prop],
    has: (_t, prop) => prop in (window.APP_DATA || {}),
    ownKeys: () => Reflect.ownKeys(window.APP_DATA || {}),
    getOwnPropertyDescriptor: (_t, prop) => Object.getOwnPropertyDescriptor(window.APP_DATA || {}, prop),
  });
  const IPA_DICT = new Proxy({}, {
    get: (_t, prop) => (window.IPA_DICT || {})[prop],
    has: (_t, prop) => prop in (window.IPA_DICT || {}),
  });
  const AUTH_SESSION_KEY = 'ielts_reading_auth_session_v1';
  const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const THEME_STORAGE_KEY = 'ielts_reading_theme_v1';
  const STORAGE_KEY_BASE = 'ielts_reading_vocab_v2';
  const TIMER_KEY_BASE = 'ielts_reading_timer_';
  const DAILY_WORDS_BASE = 'ielts_reading_daily_words_';
  const STREAK_KEY_BASE = 'ielts_reading_streak_days';
  const TASK_PROGRESS_KEY_BASE = 'ielts_reading_task_progress_';
  const TASK_LOCKS_KEY_BASE = 'ielts_reading_task_locks_';
  const TEACHER_UNLOCK_KEY_BASE = 'ielts_teacher_unlocked_at_';
  const TEACHER_TASK_UNLOCKS_KEY_BASE = 'ielts_teacher_task_unlocks_v1_';
  const LIST_CERTS_KEY_BASE = 'ielts_list_certs_v1_';
  const MASTER_COOLDOWN_KEY_BASE = 'ielts_master_cooldowns_';
  const RECALL_ACTIVE_KEY_BASE = 'ielts_recall_active_';
  const REVIEW_OLD_SCOPE_KEY = '__old_vocab_review__';
  const CLASS_RESET_EPOCH = 2026111901;
  const CLASS_LOCAL_RESET_KEY = 'ielts_reset_all_clean_20261119_v1';

  const SCOPES = [
    {
      key: 'foundation',
      name: 'Từ Vựng Nền Tảng',
      getList: () => (APP_DATA.file2_families_3500 || []).slice(0, 1500),
    },
    {
      key: 'academic',
      name: 'Từ Vựng Học Thuật',
      getList: () => (APP_DATA.file2_families_3500 || []).slice(1500, 2500),
    },
    {
      key: 'paraphrase',
      name: 'Từ Vựng Paraphrase',
      getList: () => APP_DATA.file1_paraphrase_1500 || [],
    },
    {
      key: 'advanced',
      name: 'Từ Vựng Chuyên Sâu',
      getList: () => (APP_DATA.file2_families_3500 || []).slice(2500),
    },
    {
      key: 'signal_words',
      name: 'Từ Nối Chỉ Hướng Nghĩa',
      getList: () => APP_DATA.signal_words || [],
    },
  ];

  const LISTENING_SCOPES = [
    {
      key: 'l_foundation',
      name: 'Từ Vựng Nền Tảng',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.foundation || [],
    },
    {
      key: 'l_all_parts',
      name: 'Từ Vựng Cốt Lõi',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.all_parts || [],
    },
    {
      key: 'l_part1',
      name: 'Giao Tiếp & Dịch Vụ',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.part1 || [],
    },
    {
      key: 'l_part2',
      name: 'Bản Đồ & Địa Điểm',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.part2 || [],
    },
    {
      key: 'l_part3',
      name: 'Thảo Luận & Dự Án',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.part3 || [],
    },
    {
      key: 'l_part4',
      name: 'Bài Giảng Học Thuật',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.part4 || [],
    },
    {
      key: 'l_cues_40',
      name: 'Từ Tín Hiệu & Bẫy Đổi Ý',
      isListening: true,
      getList: () => window.APP_LISTENING_VOCAB?.cues_40 || [],
    },
  ];

  let activeListeningTaskScope = null;
  let lastReadingScopeKey = 'paraphrase';
  let lastListeningScopeKey = 'l_part1';

  function isListeningScopeKey(key) {
    return Boolean(key && /^(l_|ltask_)/i.test(String(key)));
  }

  function getListeningVocabMap() {
    const v = window.APP_LISTENING_VOCAB || {};
    const map = {};
    [...(v.target_all || []), ...(v.foundation || []), ...(v.cues_40 || [])].forEach((w) => {
      if (w && w.id) map[w.id] = w;
    });
    return map;
  }

  function isTaskScopeKey(key) {
    return Boolean(key && /^(task|fnd|acd|adv)_/i.test(String(key)));
  }

  function isReadingQuickScopeKey(_key) {
    // Always run Stage 1 typing test ("gõ chữ") when clicking "Đã thuộc" across all scopes
    return false;
  }

  // Study State
  let currentUser = null;
  let currentScopeKey = 'paraphrase';
  let fullScopeList = [];
  let currentScopeList = [];
  let currentCardIndex = 0;
  let isCardFlipped = false;
  let onlyUnmastered = false;
  let onlyDueReview = false;
  let showFrontContext = false;
  let autoSpeak = true;
  let preferredAccent = 'en-US';
  let pendingInitialSpeak = false;
  let assessments = {}; // { id: 1|2|3 }
  let srsData = {}; // { id: { dueAt, intervalDays, ease, reps, lastAt } }
  let ankiReminderDismissed = false;
  let isAdvancing = false;
  let scopePositions = {}; // { scopeKey: wordId }
  let customReviewState = null; // { words, returnToTaskId, title }
  let masterCooldowns = {}; // { wordId: expireTimestampMs }
  let cooldownTimer = null;
  let recallTargetItem = null;
  let recallSubmitted = false;
  let recallStage = 1;
  let recallMode = 'standard'; // 'standard' | 'quick_vi' | 'listening_shadow'
  let recallStage2Type = 'synonym'; // 'synonym' | 'wordfamily' | 'meaning_vi' | 'wordbox'
  let recallStage2Queue = [];
  let recallWbSentence = '';
  let recallWbTitle = '';
  let recallAttemptsLeft = 2;
  let recallSynOptions = [];
  let recallSynSelected = new Set();
  let recallTimerPausedAt = 0;
  let listeningRecallBusy = false;
  let listeningAutoPlayTimer = null;
  let recallDeadlineTimer = null;
  let recallDeadlineAt = 0;
  let recallLeaveWarnings = 0;
  let lastRecallLeaveAt = 0;
  let advanceTimeout = null;
  let speakTimeout = null;
  let toastTimer = null;

  // Deck Widgets State (Restored from Classic Vocab Studio)
  let timerInterval = null;
  let timerRunning = false;
  let timerMode = 'countup'; // 'countup' | 'countdown'
  let timerTargetSeconds = 25 * 60;
  let timerElapsedSeconds = 0;
  let todayStudySeconds = 0;
  let isTimerSoundEnabled = true;
  let currentLeaderboardTab = 'week';
  let currentStreakChartTab = 'week'; // 'week' | 'month' | 'year'
  let displayedStreak = null;

  function getAccountsList() {
    return Array.isArray(window.APP_ACCOUNTS) ? window.APP_ACCOUNTS : [];
  }

  function getClassesList() {
    return Array.isArray(window.APP_CLASSES) ? window.APP_CLASSES : [];
  }

  function getActiveClassId() {
    return String(currentUser?.classId || '').trim();
  }

  function getActiveClassInfo() {
    const cid = getActiveClassId();
    if (!cid) return null;
    return getClassesList().find((c) => c.id === cid) || { id: cid, name: cid };
  }

  function getLiveDeadlinesStorageKey(classId = getActiveClassId()) {
    const cid = String(classId || '').trim();
    if (!cid || cid === 'lop_thay_man') return 'ielts_teacher_live_deadlines_v1';
    return `ielts_teacher_live_deadlines_v1__${cid}`;
  }

  function getScopedStudentAccounts() {
    const students = getAccountsList().filter((a) => a.role !== 'teacher');
    const cid = getActiveClassId();
    if (!cid) return students;
    return students.filter((a) => !a.classId || a.classId === cid);
  }

  function getScopedUid(uid) {
    const raw = (uid || currentUser?.id || 'guest').toString().trim().toLowerCase();
    return raw || 'guest';
  }

  function getUserStorageKey(uid) {
    return `${STORAGE_KEY_BASE}_${getScopedUid(uid)}`;
  }

  function getUserTimerKey(dateKey, uid) {
    return `${TIMER_KEY_BASE}${getScopedUid(uid)}_${dateKey}`;
  }

  function getUserDailyWordsKey(dateKey, uid) {
    return `${DAILY_WORDS_BASE}${getScopedUid(uid)}_${dateKey}`;
  }

  function getUserStreakKey(uid) {
    return `${STREAK_KEY_BASE}_${getScopedUid(uid)}`;
  }

  // Word list modal state
  let wlStatus = 'all';
  let wlQuery = '';
  let wlFiltered = [];
  let wlCount = 80;

  // Signal modal state
  let swCategory = 'all';
  let swQuery = '';

  let dynamicTaskScopes = [];
  let wordLookupCache = null;

  function getWordLookup() {
    if (wordLookupCache) return wordLookupCache;
    const map = {};
    [
      ...(APP_DATA.file1_paraphrase_1500 || []),
      ...(APP_DATA.file2_families_3500 || []),
      ...(APP_DATA.signal_words || []),
    ].forEach((item) => {
      if (item && item.id) map[item.id] = item;
    });
    wordLookupCache = map;
    return map;
  }

  function resolveTaskItems(taskObj) {
    if (!taskObj || !Array.isArray(taskObj.words)) return [];
    const lookup = getWordLookup();
    return taskObj.words.map((w) => {
      const base = lookup[w.id];
      if (base) {
        return w.wordFamily ? { ...base, wordFamily: w.wordFamily } : base;
      }
      return {
        id: w.id,
        lemma: w.lemma,
        ipa: w.ipa,
        pos: w.pos,
        meaning: w.meaning,
        synonyms: w.synonyms || [],
        antonyms: w.antonyms || [],
        example: w.example || '',
        wordFamily: w.wordFamily || [],
      };
    });
  }

  const DEMO_SCOPE = {
    key: 'demo_starter',
    name: 'Demo Từ Vựng IELTS (10 từ mẫu)',
    isDemo: true,
    getList: () => window.DEMO_VOCAB_DATA?.WORDS || [],
  };

  function isProprietaryVocabAllowed() {
    return window.AccessPolicy ? window.AccessPolicy.can('vocab.proprietary') : true;
  }

  function getAllScopes() {
    if (!isProprietaryVocabAllowed()) {
      return [DEMO_SCOPE];
    }
    return [
      ...SCOPES,
      ...LISTENING_SCOPES,
      ...(activeListeningTaskScope ? [activeListeningTaskScope] : []),
      ...dynamicTaskScopes,
    ];
  }

  function setDynamicTaskScopes(tasksList) {
    const arr = Array.isArray(tasksList) ? tasksList : [];
    dynamicTaskScopes = arr.map((t) => ({
      key: t.id,
      name: `${t.label}: ${t.theme}`,
      isTask: true,
      getList: () => resolveTaskItems(t),
    }));
    populateScopeSelect();
  }

  function activateTaskScope(taskId) {
    onlyDueReview = false;
    loadScope(taskId);
  }

  function findRawTaskObj(taskId) {
    if (!isTaskScopeKey(taskId)) return null;
    const fromMod = window.TasksModule?.getTaskById?.(taskId);
    if (fromMod) return fromMod;
    const list = (window.APP_TASKS_DATA && Array.isArray(window.APP_TASKS_DATA.tasks)) ? window.APP_TASKS_DATA.tasks : [];
    return list.find((t) => t.id === taskId) || null;
  }

  function isTaskLockedLocally(taskId, uid = currentUser?.id) {
    if (!isTaskScopeKey(taskId) || isTeacherUser()) return false;
    try {
      const scoped = getScopedUid(uid);
      const tl = JSON.parse(localStorage.getItem(`${TASK_LOCKS_KEY_BASE}${scoped}`) || '{}') || {};
      const until = Number(tl[taskId] || 0);
      if (until <= Date.now()) return false;
      const unlockAt = Number(localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`) || 0);
      const perUnlocks = JSON.parse(localStorage.getItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`) || '{}') || {};
      const perAt = Number(perUnlocks[taskId] || 0);
      const LOCK_WINDOW_MS = 30 * 60 * 1000;
      if ((unlockAt > 0 && (until - LOCK_WINDOW_MS) <= unlockAt) || (perAt > 0 && (until - LOCK_WINDOW_MS) <= perAt)) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function isMyVocabScopeKey(key) {
    return Boolean(window.MyVocabStore?.isMyVocabScope?.(key));
  }

  function isMyVocabWordId(wid) {
    return String(wid || '').startsWith('mv_w_');
  }

  function getScopeDef(key) {
    if (key === REVIEW_OLD_SCOPE_KEY && customReviewState) {
      return {
        key: REVIEW_OLD_SCOPE_KEY,
        name: customReviewState.title || 'Ôn tập từ vựng cũ',
        getList: () => customReviewState.words || [],
      };
    }
    if (isMyVocabScopeKey(key) && window.MyVocabStore) {
      const deckId = window.MyVocabStore.getDeckIdFromScope(key);
      const deck = window.MyVocabStore.getDeck(deckId);
      if (deck) {
        return {
          key: window.MyVocabStore.getScopeKey(deck.id),
          name: `MY LIST · ${deck.name}`,
          isMyVocab: true,
          myVocabDeckId: deck.id,
          getList: () => window.MyVocabStore.getFlashcardItems(deck.id),
        };
      }
    }
    const found = getAllScopes().find(s => s.key === key);
    if (found) return found;
    if (isTaskScopeKey(key)) {
      const t = findRawTaskObj(key);
      if (t) {
        return {
          key: t.id,
          name: `${t.label}: ${t.theme}`,
          isTask: true,
          getList: () => resolveTaskItems(t),
        };
      }
    }
    if (isListeningSkillActive() && window.APP_LISTENING_VOCAB) {
      return LISTENING_SCOPES[0];
    }
    return SCOPES.find(s => s.key === 'paraphrase') || SCOPES[0];
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, s => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function showToast(msg) {
    const el = document.getElementById('app-toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function startOldVocabReview(rawWords, targetTaskId, taskLabel = '') {
    const resolved = resolveTaskItems({ words: Array.isArray(rawWords) ? rawWords : [] });
    if (!resolved.length) return false;
    onlyDueReview = false;
    onlyUnmastered = false;
    customReviewState = {
      words: resolved,
      returnToTaskId: targetTaskId || '',
      title: taskLabel ? `Ôn từ cũ → ${taskLabel}` : 'Ôn tập từ vựng cũ',
    };
    loadScope(REVIEW_OLD_SCOPE_KEY);
    showToast(`Cần ôn tập & bấm Đã thuộc đủ ${resolved.length} từ cũ trước khi vào ${taskLabel || 'Task'}!`);
    return true;
  }

  function saveState() {
    if (!currentUser) return;
    try {
      const cur = currentScopeList[currentCardIndex];
      if (cur && !onlyUnmastered && !onlyDueReview && currentScopeKey !== REVIEW_OLD_SCOPE_KEY) {
        scopePositions[currentScopeKey] = cur.id;
      }
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(getUserStorageKey(), JSON.stringify({
        currentScopeKey: currentScopeKey === REVIEW_OLD_SCOPE_KEY ? SCOPES[0].key : currentScopeKey,
        assessments,
        srsData,
        scopePositions,
        onlyUnmastered,
        showFrontContext,
        autoSpeak,
        preferredAccent,
        theme,
      }));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function syncThemeUIControls() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const isDark = theme === 'dark';
    const authLbl = document.getElementById('auth-theme-label');
    if (authLbl) authLbl.textContent = isDark ? 'Giao diện: Tối' : 'Giao diện: Sáng';
    document.getElementById('btn-theme-light')?.classList.toggle('active', !isDark);
    document.getElementById('btn-theme-dark')?.classList.toggle('active', isDark);
  }

  function loadThemePreference() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', savedTheme);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch (_) {}
    syncThemeUIControls();
  }

  function loadState() {
    loadThemePreference();
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem(getUserStorageKey());
      if (!raw) return;
      const st = JSON.parse(raw);
      if (st.currentScopeKey) {
        const isKnownStaticOrDyn = getAllScopes().some(s => s.key === st.currentScopeKey);
        const isValidTask = Boolean(findRawTaskObj(st.currentScopeKey)) && !isTaskLockedLocally(st.currentScopeKey);
        if (isKnownStaticOrDyn || isValidTask) {
          currentScopeKey = st.currentScopeKey;
        }
      }
      if (st.assessments && typeof st.assessments === 'object') assessments = st.assessments;
      if (st.srsData && typeof st.srsData === 'object') srsData = st.srsData;
      if (st.scopePositions && typeof st.scopePositions === 'object') scopePositions = st.scopePositions;
      if (typeof st.onlyUnmastered === 'boolean') onlyUnmastered = st.onlyUnmastered;
      if (typeof st.showFrontContext === 'boolean') showFrontContext = st.showFrontContext;
      if (typeof st.autoSpeak === 'boolean') autoSpeak = st.autoSpeak;
      if (st.preferredAccent === 'en-GB' || st.preferredAccent === 'en-US') preferredAccent = st.preferredAccent;
      if (st.theme === 'dark' || st.theme === 'light') {
        document.documentElement.setAttribute('data-theme', st.theme);
      }
    } catch (e) {
      console.warn('Load failed:', e);
    }
    loadMasterCooldowns();
    syncAllLemmaPeersFromAssessments();
  }

  let _lemmaPeersCache = null;
  let _idToLemmaCache = null;

  function ensureLemmaPeerIndex() {
    if (_lemmaPeersCache && _idToLemmaCache && _idToLemmaCache.size > 0) return;
    _lemmaPeersCache = new Map();
    _idToLemmaCache = new Map();
    const lists = [APP_DATA?.file1_paraphrase_1500 || [], APP_DATA?.file2_families_3500 || []];
    lists.forEach((arr) => {
      arr.forEach((it) => {
        if (!it || !it.id || !it.lemma) return;
        const key = String(it.lemma).trim().toLowerCase();
        if (!key) return;
        _idToLemmaCache.set(it.id, key);
        if (!_lemmaPeersCache.has(key)) _lemmaPeersCache.set(key, []);
        const bucket = _lemmaPeersCache.get(key);
        if (!bucket.includes(it.id)) bucket.push(it.id);
      });
    });
  }

  function syncLemmaPeersMastery(wordId, level, now = Date.now()) {
    if (level !== 3 || !wordId) return;
    ensureLemmaPeerIndex();
    const lem = _idToLemmaCache?.get(wordId);
    if (!lem) return;
    const peers = _lemmaPeersCache?.get(lem) || [];
    peers.forEach((pid) => {
      if (pid === wordId) return;
      assessments[pid] = 3;
      if (!srsData[pid]) srsData[pid] = computeNextAnkiState(pid, 3, now);
    });
  }

  function syncAllLemmaPeersFromAssessments() {
    ensureLemmaPeerIndex();
    const now = Date.now();
    Object.keys(assessments).forEach((wid) => {
      if (assessments[wid] === 3) {
        syncLemmaPeersMastery(wid, 3, now);
      }
    });
  }

  function countUniqueMasteredWords(assessMap) {
    if (!assessMap || typeof assessMap !== 'object') return 0;
    ensureLemmaPeerIndex();
    const uniq = new Set();
    Object.entries(assessMap).forEach(([wid, lvl]) => {
      if (lvl === 3 && !isMyVocabWordId(wid)) {
        const lem = _idToLemmaCache?.get(wid);
        uniq.add(lem || wid);
      }
    });
    return uniq.size;
  }

  /* =========================================================
     MASTERY CURVE, TIMER, STREAK CHART & LEADERBOARD WIDGETS
     ========================================================= */
  const DAY_MS = 24 * 60 * 60 * 1000;

  function computeNextAnkiState(wordId, level, now = Date.now()) {
    const prev = srsData[wordId] || null;
    const prevEase = prev?.ease || 2.5;
    const prevReps = prev?.reps || 0;
    const prevIvl = prev?.intervalDays || 0;

    if (level === 1) {
      return {
        dueAt: now,
        intervalDays: 0,
        ease: Math.max(1.3, Number((prevEase - 0.2).toFixed(2))),
        reps: 0,
        lastAt: now,
      };
    }
    if (level === 2) {
      const ivl = prevIvl >= 1 ? Math.max(1, Math.round(prevIvl * 1.25)) : 1;
      return {
        dueAt: now + ivl * DAY_MS,
        intervalDays: ivl,
        ease: Math.max(1.3, Number((prevEase - 0.05).toFixed(2))),
        reps: prevReps + 1,
        lastAt: now,
      };
    }
    const nextEase = Math.min(2.8, Number((prevEase + 0.1).toFixed(2)));
    let ivl = 4;
    if (prevReps === 1) ivl = 7;
    else if (prevReps >= 2) ivl = Math.min(90, Math.max(7, Math.round((prevIvl || 4) * nextEase)));
    return {
      dueAt: now + ivl * DAY_MS,
      intervalDays: ivl,
      ease: nextEase,
      reps: prevReps + 1,
      lastAt: now,
    };
  }

  function formatAnkiIntervalLabel(wordId, level) {
    const st = computeNextAnkiState(wordId, level, Date.now());
    if (st.intervalDays <= 0) return 'Ôn ngay';
    return `${st.intervalDays} ngày`;
  }

  function isWordDueNow(item, now = Date.now()) {
    if (!item) return false;
    const st = srsData[item.id];
    if (st && typeof st.dueAt === 'number') return st.dueAt <= now;
    return assessments[item.id] === 1;
  }

  function countDueWordsInList(list, now = Date.now()) {
    return (list || []).reduce((cnt, item) => cnt + (isWordDueNow(item, now) ? 1 : 0), 0);
  }

  function updateAnkiReminderUI(dueCount) {
    const box = document.getElementById('anki-due-reminder');
    const desc = document.getElementById('anki-rem-desc');
    if (!box) return;
    if (currentUser && !isTeacherUser() && dueCount > 0 && !onlyDueReview && !ankiReminderDismissed) {
      const def = getScopeDef(currentScopeKey);
      if (desc) {
        desc.innerHTML = `Bạn có <strong>${dueCount} từ</strong> trong <em>${escapeHtml(def.name)}</em> đến hạn ôn tập hôm nay.`;
      }
      box.classList.add('visible');
    } else {
      box.classList.remove('visible');
    }
  }

  function dismissAnkiReminder() {
    ankiReminderDismissed = true;
    document.getElementById('anki-due-reminder')?.classList.remove('visible');
  }

  function updateVocabMasteryUI() {
    const scopeList = fullScopeList || [];
    const total = scopeList.length || 1;
    const now = Date.now();

    let countMastered = 0;
    let countSlow = 0;
    let countUnlearned = 0;
    let countDue = 0;

    scopeList.forEach(item => {
      const val = assessments[item.id];
      if (val === 3) countMastered++;
      else if (val === 2) countSlow++;
      else countUnlearned++;
      if (isWordDueNow(item, now)) countDue++;
    });

    const rawMastered = (countMastered / total) * 100;
    const rawSlow = (countSlow / total) * 100;
    const pctMastered = Math.round(rawMastered);
    const pctSlow = Math.round(rawSlow);
    const pctUnlearned = Math.max(0, 100 - pctMastered - pctSlow);

    const fmtPct = (cnt, raw, rounded) => (cnt > 0 && raw < 1 ? raw.toFixed(1) : String(rounded));
    const barWMastered = countMastered > 0 ? Math.max(0.5, rawMastered) : 0;
    const barWSlow = countSlow > 0 ? Math.max(0.5, rawSlow) : 0;
    const barWUnlearned = Math.max(0, 100 - barWMastered - barWSlow);

    const barMastered = document.getElementById('bar-mastered');
    const barSlow = document.getElementById('bar-slow');
    const barUnlearned = document.getElementById('bar-unlearned');
    if (barMastered) barMastered.style.width = barWMastered.toFixed(2) + '%';
    if (barSlow) barSlow.style.width = barWSlow.toFixed(2) + '%';
    if (barUnlearned) barUnlearned.style.width = barWUnlearned.toFixed(2) + '%';

    const elMastered = document.getElementById('stat-count-mastered');
    const elSlow = document.getElementById('stat-count-slow');
    const elUnlearned = document.getElementById('stat-count-unlearned');
    const elDue = document.getElementById('stat-count-due');
    const elTopDue = document.getElementById('top-due-count');
    const btnFilterDue = document.getElementById('btn-filter-due');
    const btnQuickDue = document.getElementById('btn-due-quick');
    if (elMastered) elMastered.textContent = countMastered;
    if (elSlow) elSlow.textContent = countSlow;
    if (elUnlearned) elUnlearned.textContent = countUnlearned;
    if (elDue) elDue.textContent = countDue;
    if (elTopDue) elTopDue.textContent = countDue;
    if (btnFilterDue) btnFilterDue.classList.toggle('has-due', countDue > 0);
    if (btnQuickDue) btnQuickDue.style.display = countDue > 0 ? 'inline-flex' : 'none';

    const mobMastered = document.getElementById('mob-stat-mastered');
    const mobDue = document.getElementById('mob-stat-due');
    const mobDueBtn = document.getElementById('mob-stat-due-btn');
    if (mobMastered) mobMastered.textContent = `${countMastered}/${total}`;
    if (mobDue) mobDue.textContent = countDue;
    if (mobDueBtn) mobDueBtn.style.display = countDue > 0 ? 'inline-flex' : 'none';

    updateAnkiReminderUI(countDue);

    const elPctMastered = document.getElementById('stat-pct-mastered');
    const elPctSlow = document.getElementById('stat-pct-slow');
    const elPctUnlearned = document.getElementById('stat-pct-unlearned');
    if (elPctMastered) elPctMastered.textContent = `(${fmtPct(countMastered, rawMastered, pctMastered)}%)`;
    if (elPctSlow) elPctSlow.textContent = `(${fmtPct(countSlow, rawSlow, pctSlow)}%)`;
    if (elPctUnlearned) elPctUnlearned.textContent = `(${fmtPct(countUnlearned, (countUnlearned / total) * 100, pctUnlearned)}%)`;

    const elTotal = document.getElementById('stat-count-total');
    if (elTotal) elTotal.textContent = scopeList.length;
    const elTodayWords = document.getElementById('stat-today-words');
    if (elTodayWords) {
      let todayCnt = 0;
      try {
        todayCnt = parseInt(localStorage.getItem(getUserDailyWordsKey(localStudyDayKey())) || '0', 10) || 0;
      } catch (_) {}
      elTodayWords.textContent = `${todayCnt} từ`;
    }

    const scopeNameEl = document.getElementById('widget-scope-name');
    if (scopeNameEl) {
      const def = getScopeDef(currentScopeKey);
      scopeNameEl.textContent = def ? def.name : 'Bộ từ vựng';
    }
  }

  function localStudyDayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function playZenBellChime() {
    if (!isTimerSoundEnabled) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      [528, 792, 1056].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18 / (idx + 1), now + idx * 0.08 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.8);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 2.0);
      });
    } catch (e) {
      console.warn('Audio chime failed:', e);
    }
  }

  function toggleTimerSound() {
    isTimerSoundEnabled = !isTimerSoundEnabled;
    const icon = document.getElementById('timer-sound-icon');
    if (icon) icon.textContent = isTimerSoundEnabled ? 'Âm: Bật' : 'Âm: Tắt';
    showToast(isTimerSoundEnabled ? 'Đã bật chuông báo' : 'Đã tắt chuông báo');
  }

  function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return [
      h > 0 ? String(h).padStart(2, '0') : null,
      String(m).padStart(2, '0'),
      String(s).padStart(2, '0')
    ].filter(Boolean).join(':');
  }

  function isTeacherUser() {
    return currentUser?.role === 'teacher';
  }

  function updateTimerDisplay() {
    const digitsEl = document.getElementById('timer-digits');
    const statusEl = document.getElementById('timer-status-text');
    const todayTotalEl = document.getElementById('timer-today-total');
    if (!digitsEl) return;

    if (isTeacherUser()) {
      digitsEl.textContent = '00:00';
      if (statusEl) statusEl.textContent = 'Không tính giờ';
      const timerBox = digitsEl.closest('.timer-display-box');
      timerBox?.classList.remove('motion-running', 'motion-urgent');
      if (todayTotalEl) todayTotalEl.textContent = '--';
      const playText = document.getElementById('timer-play-text');
      if (playText) playText.textContent = 'Không tính giờ';
      return;
    }

    if (timerMode === 'countup') {
      digitsEl.textContent = formatTime(timerElapsedSeconds);
      if (statusEl) statusEl.textContent = timerRunning ? 'Đang tính giờ' : 'Tạm dừng';
    } else {
      const remaining = Math.max(0, timerTargetSeconds - timerElapsedSeconds);
      digitsEl.textContent = formatTime(remaining);
      if (statusEl) statusEl.textContent = timerRunning ? 'Đang đếm ngược' : 'Tạm dừng';
    }
    const mobTimerEl = document.getElementById('mob-stat-timer');
    if (mobTimerEl) mobTimerEl.textContent = digitsEl.textContent;

    const timerBox = digitsEl.closest('.timer-display-box');
    timerBox?.classList.toggle('motion-running', timerRunning);
    timerBox?.classList.toggle('motion-urgent', timerRunning && timerMode === 'countdown' && timerTargetSeconds - timerElapsedSeconds <= 60);

    if (todayTotalEl) {
      const mins = Math.floor(todayStudySeconds / 60);
      todayTotalEl.textContent = mins + ' phút';
    }
  }

  function saveStudyTimerState() {
    if (!currentUser || isTeacherUser()) return;
    try {
      const todayKey = localStudyDayKey();
      localStorage.setItem(getUserTimerKey(todayKey), String(todayStudySeconds));
      const streakKey = getUserStreakKey();
      let streakHistory = JSON.parse(localStorage.getItem(streakKey) || '[]');
      if (!Array.isArray(streakHistory)) streakHistory = [];
      if (!streakHistory.includes(todayKey)) {
        streakHistory.push(todayKey);
        localStorage.setItem(streakKey, JSON.stringify(streakHistory));
        updateStudyStreakUI();
      }
    } catch (e) {}
  }

  function loadStudyTimerState() {
    if (!currentUser || isTeacherUser()) {
      todayStudySeconds = 0;
      timerElapsedSeconds = 0;
      return;
    }
    try {
      const todayKey = localStudyDayKey();
      todayStudySeconds = parseInt(localStorage.getItem(getUserTimerKey(todayKey)) || '0', 10) || 0;
    } catch (e) {}
  }

  const STUDY_IDLE_LOGOUT_MS = 10 * 60 * 1000;
  const STUDY_IDLE_WARN_MS = 9 * 60 * 1000;
  let lastStudyActivityAt = Date.now();
  let studyIdleCheckTimer = null;
  let studyIdleWarnShown = false;
  let studyIdleEventsBound = false;

  function syncStudyIdleClockUI(overrideIdleMs, limitMs, isTaskMode) {
    const root = document.getElementById('study-idle-clock');
    const valEl = document.getElementById('study-idle-clock-val');
    const limitEl = document.getElementById('study-idle-clock-limit');
    const barEl = document.getElementById('study-idle-clock-bar');
    if (!root || !valEl) return;
    if (!currentUser || isTeacherUser()) {
      root.classList.remove('is-warn', 'is-danger', 'is-task-mode');
      root.classList.toggle('is-teacher-exempt', Boolean(currentUser && isTeacherUser()));
      valEl.textContent = isTeacherUser() ? 'Miễn' : '00:00';
      if (limitEl) limitEl.textContent = isTeacherUser() ? 'GV' : '/ 10:00';
      if (barEl) barEl.style.width = '0%';
      return;
    }
    root.classList.remove('is-teacher-exempt');
    const maxMs = limitMs || STUDY_IDLE_LOGOUT_MS;
    const rawIdle = overrideIdleMs !== undefined && overrideIdleMs !== null
      ? overrideIdleMs
      : (Date.now() - lastStudyActivityAt);
    const idleMs = Math.max(0, Math.min(maxMs, rawIdle));
    const totalSec = Math.floor(idleMs / 1000);
    const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const ss = String(totalSec % 60).padStart(2, '0');
    const maxMin = String(Math.floor(maxMs / 60000)).padStart(2, '0');
    valEl.textContent = `${mm}:${ss}`;
    if (limitEl) limitEl.textContent = `/ ${maxMin}:00`;
    if (barEl) barEl.style.width = `${Math.min(100, (idleMs / maxMs) * 100).toFixed(1)}%`;
    root.classList.toggle('is-warn', idleMs >= 7 * 60 * 1000 && idleMs < 9 * 60 * 1000);
    root.classList.toggle('is-danger', idleMs >= 9 * 60 * 1000);
    root.classList.toggle('is-task-mode', Boolean(isTaskMode));
  }

  function bumpStudyIdleActivity() {
    lastStudyActivityAt = Date.now();
    studyIdleWarnShown = false;
    if (!window.TasksModule?.getActiveTask?.()) syncStudyIdleClockUI(0);
  }

  function handleStudyIdleTimeoutLogout() {
    if (!currentUser || isTeacherUser()) return;
    if (window.TasksModule?.getActiveTask?.() || window.TasksModule?.getExamState?.().active) return;
    stopStudyIdleMonitor();
    logoutCurrentAccount();
    showToast('Đã tự động đăng xuất do không hoạt động quá 10 phút!');
  }

  function evaluateStudyIdleTimeout() {
    if (!currentUser || isTeacherUser()) {
      syncStudyIdleClockUI();
      return false;
    }
    if (window.TasksModule?.getActiveTask?.() || window.TasksModule?.getExamState?.().active) {
      lastStudyActivityAt = Date.now();
      return false;
    }
    const idleMs = Date.now() - lastStudyActivityAt;
    syncStudyIdleClockUI(idleMs, STUDY_IDLE_LOGOUT_MS, false);
    if (idleMs >= STUDY_IDLE_LOGOUT_MS) {
      handleStudyIdleTimeoutLogout();
      return true;
    }
    if (!studyIdleWarnShown && idleMs >= STUDY_IDLE_WARN_MS) {
      studyIdleWarnShown = true;
      showToast('Bạn chưa thao tác 9 phút — hệ thống sẽ tự đăng xuất sau 1 phút nữa nếu không hoạt động!');
    }
    return false;
  }

  function startStudyIdleMonitor() {
    stopStudyIdleMonitor();
    syncStudyIdleClockUI(0);
    if (!currentUser || isTeacherUser()) return;
    lastStudyActivityAt = Date.now();
    studyIdleWarnShown = false;
    if (!studyIdleEventsBound) {
      studyIdleEventsBound = true;
      ['pointerdown', 'keydown', 'touchstart', 'scroll', 'input', 'change'].forEach((evt) => {
        document.addEventListener(evt, bumpStudyIdleActivity, { passive: true });
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && currentUser && !isTeacherUser()) {
          evaluateStudyIdleTimeout();
        }
      });
    }
    evaluateStudyIdleTimeout();
    studyIdleCheckTimer = setInterval(evaluateStudyIdleTimeout, 1000);
  }

  function stopStudyIdleMonitor() {
    if (studyIdleCheckTimer) {
      clearInterval(studyIdleCheckTimer);
      studyIdleCheckTimer = null;
    }
    studyIdleWarnShown = false;
    syncStudyIdleClockUI(0);
  }

  function startTimer() {
    if (!currentUser || isTeacherUser()) {
      timerRunning = false;
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      updateTimerDisplay();
      return;
    }
    if (timerInterval) clearInterval(timerInterval);
    timerRunning = true;
    const playText = document.getElementById('timer-play-text');
    if (playText) playText.textContent = 'Tạm dừng';

    timerInterval = setInterval(() => {
      if (!currentUser) {
        pauseTimer();
        return;
      }
      if (evaluateStudyIdleTimeout()) return;
      timerElapsedSeconds++;
      todayStudySeconds++;

      if (todayStudySeconds % 10 === 0) {
        saveStudyTimerState();
        updateLeaderboardUI();
      }
      if (todayStudySeconds % 30 === 0) {
        syncPushCurrentUser();
      }

      if (timerMode === 'countdown' && timerElapsedSeconds >= timerTargetSeconds) {
        pauseTimer();
        playZenBellChime();
        showToast('Chúc mừng! Bạn đã hoàn thành mục tiêu tập trung!');
      }

      updateTimerDisplay();
    }, 1000);

    updateTimerDisplay();
  }

  function pauseTimer() {
    timerRunning = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    const playText = document.getElementById('timer-play-text');
    if (playText) playText.textContent = 'Tiếp tục';
    updateTimerDisplay();
    saveStudyTimerState();
    syncPushCurrentUser();
  }

  function toggleTimer() {
    if (isTeacherUser()) return;
    if (timerRunning) pauseTimer();
    else startTimer();
  }

  function resetTimer() {
    if (isTeacherUser()) return;
    pauseTimer();
    timerElapsedSeconds = 0;
    updateTimerDisplay();
  }

  function setTimerMode(mode) {
    if (isTeacherUser()) return;
    timerMode = mode;
    timerElapsedSeconds = 0;
    document.getElementById('timer-mode-up')?.classList.toggle('active', mode === 'countup');
    document.getElementById('timer-mode-down')?.classList.toggle('active', mode === 'countdown');
    const presetsEl = document.getElementById('timer-presets');
    if (presetsEl) presetsEl.style.display = mode === 'countdown' ? 'flex' : 'none';
    startTimer();
  }

  function setCountdownMinutes(mins) {
    if (isTeacherUser()) return;
    timerTargetSeconds = mins * 60;
    timerElapsedSeconds = 0;
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.textContent.includes(mins + 'p'));
    });
    startTimer();
  }

  // Cloud Auto-Sync Engine (Google Sheets Web App)
  let cloudClassCache = {};
  let cloudPullTimer = null;
  let cloudPushDebounce = null;
  let lastCloudSyncTime = '';
  let cloudGasVersion = 0;
  let initialCloudPullSettled = false;
  let initialCloudPullUid = '';

  function getSyncUrl() {
    return String(window.APP_SYNC_URL || '').trim();
  }

  function updateCloudSyncBadge() {
    const subEl = document.getElementById('class-report-subtitle');
    if (!subEl) return;
    if (!getSyncUrl()) {
      subEl.textContent = 'Đang lưu cục bộ trên thiết bị';
    } else if (lastCloudSyncTime) {
      subEl.textContent = `Cập nhật lúc ${lastCloudSyncTime}`;
    } else {
      subEl.textContent = 'Đang đồng bộ dữ liệu...';
    }
  }

  function collectPrefixMap(prefix) {
    const out = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(prefix)) {
          const dayKey = k.slice(prefix.length);
          const val = parseInt(localStorage.getItem(k) || '0', 10) || 0;
          if (val > 0) out[dayKey] = val;
        }
      }
    } catch (_) {}
    return out;
  }

  function buildUserSyncData(uid = currentUser?.id) {
    const scoped = getScopedUid(uid);
    const timerByDay = collectPrefixMap(`${TIMER_KEY_BASE}${scoped}_`);
    const todayKey = localStudyDayKey();
    if (currentUser && getScopedUid(currentUser.id) === scoped && todayStudySeconds > 0) {
      timerByDay[todayKey] = Math.max(timerByDay[todayKey] || 0, todayStudySeconds);
    }
    const wordsByDay = collectPrefixMap(`${DAILY_WORDS_BASE}${scoped}_`);
    let streakDays = [];
    try {
      const parsed = JSON.parse(localStorage.getItem(getUserStreakKey(scoped)) || '[]');
      if (Array.isArray(parsed)) streakDays = parsed;
    } catch (_) {}

    const compactAssess = {};
    const srcAssess = (currentUser && getScopedUid(currentUser.id) === scoped) ? assessments : (() => {
      try { return JSON.parse(localStorage.getItem(getUserStorageKey(scoped)) || '{}')?.assessments || {}; } catch (_) { return {}; }
    })();
    Object.keys(srcAssess).forEach(k => {
      if (isMyVocabWordId(k)) return;
      const v = srcAssess[k];
      if (v === 1 || v === 2 || v === 3) compactAssess[k] = v;
    });

    const isSelfScoped = Boolean(currentUser && getScopedUid(currentUser.id) === scoped);
    const cloudSrsData = {};
    if (isSelfScoped && srsData && typeof srsData === 'object') {
      Object.keys(srsData).forEach((k) => {
        if (!isMyVocabWordId(k)) cloudSrsData[k] = srsData[k];
      });
    }
    const cloudScopePositions = {};
    if (isSelfScoped && scopePositions && typeof scopePositions === 'object') {
      Object.keys(scopePositions).forEach((k) => {
        if (!isMyVocabScopeKey(k)) cloudScopePositions[k] = scopePositions[k];
      });
    }
    const cloudScopeKey = isMyVocabScopeKey(currentScopeKey) ? 'paraphrase' : currentScopeKey;

    let taskProgress = {};
    let taskLocks = {};
    let teacherTaskUnlocks = {};
    let listeningTaskProgress = {};
    let writingTaskProgress = {};
    let speakingTaskProgress = {};
    let writingPracticeHistory = [];
    let readingPracticeHistory = [];
    let listeningPracticeHistory = [];
    let speakingPracticeHistory = [];
    try {
      taskProgress = JSON.parse(localStorage.getItem(`${TASK_PROGRESS_KEY_BASE}${scoped}`) || '{}') || {};
      taskLocks = JSON.parse(localStorage.getItem(`${TASK_LOCKS_KEY_BASE}${scoped}`) || '{}') || {};
      teacherTaskUnlocks = JSON.parse(localStorage.getItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`) || '{}') || {};
      listeningTaskProgress = JSON.parse(localStorage.getItem(`totoro_listening_task_progress_v1_${scoped}`) || '{}') || {};
      writingTaskProgress = JSON.parse(localStorage.getItem(`totoro_writing_task_prog_v1_${scoped}`) || '{}') || {};
      const spDone = JSON.parse(localStorage.getItem(`totoro_speaking_task_done_v1_${scoped}`) || '{}') || {};
      const spLegacy = JSON.parse(localStorage.getItem(`totoro_speaking_task_prog_v1_${scoped}`) || '{}') || {};
      speakingTaskProgress = { ...spLegacy, ...spDone };

      const wHistRaw = JSON.parse(localStorage.getItem(`totoro_writing_prac_hist_v1_${scoped}`) || '[]');
      if (Array.isArray(wHistRaw)) {
        writingPracticeHistory = wHistRaw.slice(0, 15).map((h) => ({
          promptId: h.promptId,
          isTask1: Boolean(h.isTask1),
          isFull: Boolean(h.isFull),
          type: h.type || '',
          prompt: String(h.prompt || '').slice(0, 260),
          part1Title: h.part1Title || '',
          part2Prompt: h.part2Prompt ? String(h.part2Prompt).slice(0, 220) : '',
          mode: h.mode || 'practice',
          wordCount: Number(h.wordCount || 0),
          wc1: h.wc1, wc2: h.wc2, b1: h.b1, b2: h.b2,
          band: Number(h.band || 0),
          criteria: h.criteria || null,
          essay: h.essay ? String(h.essay).slice(0, 4500) : '',
          essay1: h.essay1 ? String(h.essay1).slice(0, 3000) : '',
          essay2: h.essay2 ? String(h.essay2).slice(0, 4000) : '',
          completedAt: Number(h.completedAt || 0),
        }));
      }
      const rStoreRaw = JSON.parse(localStorage.getItem(`ielts_reading_practice_store_v1_${scoped}`) || '{}');
      if (Array.isArray(rStoreRaw?.history)) {
        readingPracticeHistory = rStoreRaw.history.slice(0, 25).map((h) => ({
          itemId: h.itemId, title: h.title, source: h.source, isFull: !!h.isFull,
          score: h.score, total: h.total, band: h.band, elapsedSec: h.elapsedSec,
          mastered: !!h.mastered, completedAt: h.completedAt
        }));
      }
      const lStoreRaw = JSON.parse(localStorage.getItem(`ielts_listening_practice_v1_${scoped}`) || '{}');
      if (Array.isArray(lStoreRaw?.history)) {
        listeningPracticeHistory = lStoreRaw.history.slice(0, 25).map((h) => ({
          itemId: h.itemId, title: h.title, source: h.source, isFull: !!h.isFull,
          score: h.score, total: h.total, band: h.band, elapsedSec: h.elapsedSec,
          submittedAt: h.submittedAt || h.completedAt
        }));
      }
      const sHistRaw = JSON.parse(localStorage.getItem(`totoro_speaking_prac_hist_v1_${scoped}`) || '[]');
      if (Array.isArray(sHistRaw)) {
        speakingPracticeHistory = sHistRaw.slice(0, 25).map((h) => ({
          cueId: h.cueId, cueTitle: h.cueTitle, part: h.part, band: h.band,
          durationSec: h.durationSec, wpm: h.wpm, at: h.at || h.completedAt
        }));
      }

      // Merge active Reading Practice / Listening / Writing / Speaking locks into unified taskLocks for 4-skill teacher monitoring
      const nowMs = Date.now();
      const rpPracLock = JSON.parse(localStorage.getItem(`ielts_rp_anticheat_lock_v1_${scoped}`) || 'null');
      if (rpPracLock && Number(rpPracLock.until || 0) > nowMs) {
        taskLocks.rp_prac_lock = Number(rpPracLock.until);
      }
      const lLocks = JSON.parse(localStorage.getItem(`totoro_listening_task_locks_v1_${scoped}`) || '{}') || {};
      Object.entries(lLocks).forEach(([k, u]) => { if (Number(u || 0) > nowMs) taskLocks[k] = Number(u); });
      const sLocks = JSON.parse(localStorage.getItem(`totoro_speaking_task_locks_v1_${scoped}`) || '{}') || {};
      Object.entries(sLocks).forEach(([k, u]) => { if (Number(u || 0) > nowMs) taskLocks[k] = Number(u); });
      const wTaskLock = JSON.parse(localStorage.getItem(`totoro_writing_task_lock_v1_${scoped}`) || 'null');
      if (wTaskLock && Number(wTaskLock.until || 0) > nowMs) {
        taskLocks[wTaskLock.modId || 'w_task_lock'] = Number(wTaskLock.until);
      }
      const wPracLock = JSON.parse(localStorage.getItem(`totoro_writing_prac_lock_v1_${scoped}`) || 'null');
      if (wPracLock && Number(wPracLock.until || 0) > nowMs) {
        taskLocks.w_prac_lock = Number(wPracLock.until);
      }
    } catch (_) {}

    const recogExtra = (isSelfScoped && window.RecognitionTestModule?.exportCloudRecognitionData)
      ? window.RecognitionTestModule.exportCloudRecognitionData()
      : {};

    return {
      resetEpoch: CLASS_RESET_EPOCH,
      skillNamespaceVersion: 2,
      activeSkillId: window.AppCore?.skills?.getActiveId?.() || 'reading',
      timerByDay,
      wordsByDay,
      streakDays,
      assessments: compactAssess,
      srsData: cloudSrsData,
      scopePositions: cloudScopePositions,
      currentScopeKey: cloudScopeKey,
      taskProgress,
      listeningTaskProgress,
      writingTaskProgress,
      speakingTaskProgress,
      writingPracticeHistory,
      readingPracticeHistory,
      listeningPracticeHistory,
      speakingPracticeHistory,
      taskLocks,
      teacherUnlockedAt: Number(localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`) || 0),
      teacherTaskUnlocks,
      ...recogExtra,
    };
  }

  function computeConsecutiveStreakForUser(uid) {
    const scoped = getScopedUid(uid);
    const now = new Date();
    const todayKey = localStudyDayKey(now);
    const completed = new Set();
    try {
      const history = JSON.parse(localStorage.getItem(getUserStreakKey(scoped)) || '[]');
      if (Array.isArray(history)) history.forEach((d) => { if (d) completed.add(String(d)); });
    } catch (_) {}
    const cloudEntry = cloudClassCache[scoped];
    const cloudStreakDays = cloudEntry?.syncData?.streakDays;
    if (Array.isArray(cloudStreakDays)) {
      cloudStreakDays.forEach((d) => { if (d) completed.add(String(d)); });
    }
    const cloudTimerByDay = cloudEntry?.syncData?.timerByDay;
    if (cloudTimerByDay && typeof cloudTimerByDay === 'object') {
      Object.entries(cloudTimerByDay).forEach(([dayKey, secs]) => {
        if ((parseInt(secs || '0', 10) || 0) > 0) completed.add(String(dayKey));
      });
    }
    if (getUserSecondsForDay(scoped, todayKey) > 0) completed.add(todayKey);
    let streak = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!completed.has(localStudyDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (completed.has(localStudyDayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    if (streak === 0 && cloudEntry && !cloudEntry.syncData?.streakDays && !cloudEntry.syncData?.timerByDay) {
      streak = Number(cloudEntry.streak || 0);
    }
    return streak;
  }

  function mergeCloudEntryIntoLocal(uid, cloudEntry) {
    if (!cloudEntry || !cloudEntry.syncData) return;
    const scoped = getScopedUid(uid);
    const sd = cloudEntry.syncData;
    const todayKey = localStudyDayKey();
    let changed = false;

    if (sd.timerByDay && typeof sd.timerByDay === 'object') {
      Object.entries(sd.timerByDay).forEach(([dayKey, secs]) => {
        const cloudSecs = parseInt(secs || '0', 10) || 0;
        const key = getUserTimerKey(dayKey, scoped);
        const localSecs = parseInt(localStorage.getItem(key) || '0', 10) || 0;
        if (cloudSecs > localSecs) {
          localStorage.setItem(key, String(cloudSecs));
          if (currentUser && getScopedUid(currentUser.id) === scoped && dayKey === todayKey) {
            todayStudySeconds = Math.max(todayStudySeconds, cloudSecs);
          }
          changed = true;
        }
      });
    }

    if (sd.wordsByDay && typeof sd.wordsByDay === 'object') {
      Object.entries(sd.wordsByDay).forEach(([dayKey, cnt]) => {
        const cloudCnt = parseInt(cnt || '0', 10) || 0;
        const key = getUserDailyWordsKey(dayKey, scoped);
        const localCnt = parseInt(localStorage.getItem(key) || '0', 10) || 0;
        if (cloudCnt > localCnt) {
          localStorage.setItem(key, String(cloudCnt));
          changed = true;
        }
      });
    }

    if (Array.isArray(sd.streakDays) && sd.streakDays.length > 0) {
      let localStreak = [];
      try {
        localStreak = JSON.parse(localStorage.getItem(getUserStreakKey(scoped)) || '[]');
        if (!Array.isArray(localStreak)) localStreak = [];
      } catch (_) {}
      const mergedSet = new Set([...localStreak, ...sd.streakDays]);
      if (mergedSet.size > localStreak.length) {
        localStorage.setItem(getUserStreakKey(scoped), JSON.stringify([...mergedSet].sort()));
        changed = true;
      }
    }

    if (currentUser && getScopedUid(currentUser.id) === scoped && sd.assessments && typeof sd.assessments === 'object') {
      let assessAdded = false;
      const cloudSrsMap = (sd.srsData && typeof sd.srsData === 'object') ? sd.srsData : {};
      Object.entries(sd.assessments).forEach(([wid, lvl]) => {
        if (lvl !== 1 && lvl !== 2 && lvl !== 3) return;
        const curLvl = assessments[wid];
        if (!curLvl) {
          assessments[wid] = lvl;
          assessAdded = true;
        } else if (curLvl !== lvl) {
          const cloudLast = Number(cloudSrsMap[wid]?.lastAt || 0);
          const localLast = Number(srsData[wid]?.lastAt || 0);
          if ((cloudLast > localLast) || (cloudLast === localLast && lvl > curLvl)) {
            assessments[wid] = lvl;
            assessAdded = true;
          }
        }
      });
      if (sd.srsData && typeof sd.srsData === 'object') {
        Object.entries(sd.srsData).forEach(([wid, cloudSrs]) => {
          const localSrs = srsData[wid];
          if (cloudSrs && (!localSrs || (cloudSrs.lastAt || 0) > (localSrs.lastAt || 0))) {
            srsData[wid] = cloudSrs;
            assessAdded = true;
          }
        });
      }
      if (assessAdded) {
        syncAllLemmaPeersFromAssessments();
        saveState();
        changed = true;
      }
      if (window.RecognitionTestModule?.importCloudRecognitionData?.(sd)) {
        changed = true;
      }
    }

    if (sd.taskProgress && typeof sd.taskProgress === 'object') {
      try {
        const tpKey = `${TASK_PROGRESS_KEY_BASE}${scoped}`;
        const localTp = JSON.parse(localStorage.getItem(tpKey) || '{}') || {};
        let tpChanged = false;
        Object.entries(sd.taskProgress).forEach(([tid, rec]) => {
          const prev = localTp[tid];
          if (rec && (!prev || (rec.updatedAt || 0) > (prev.updatedAt || 0) || (rec.status === 'completed' && prev.status !== 'completed'))) {
            localTp[tid] = rec;
            tpChanged = true;
          }
        });
        if (tpChanged) {
          localStorage.setItem(tpKey, JSON.stringify(localTp));
          changed = true;
        }
      } catch (_) {}
    }

    // Merge 4-skill Task Progress (Listening, Writing, Speaking)
    [
      ['listeningTaskProgress', `totoro_listening_task_progress_v1_${scoped}`],
      ['writingTaskProgress', `totoro_writing_task_prog_v1_${scoped}`],
      ['speakingTaskProgress', `totoro_speaking_task_prog_v1_${scoped}`],
    ].forEach(([field, lsKey]) => {
      if (sd[field] && typeof sd[field] === 'object') {
        try {
          const cur = JSON.parse(localStorage.getItem(lsKey) || '{}') || {};
          let dirty = false;
          Object.entries(sd[field]).forEach(([tid, rec]) => {
            const prev = cur[tid];
            const recDone = Boolean(rec?.completed || rec?.passed || rec?.status === 'completed');
            const prevDone = Boolean(prev?.completed || prev?.passed || prev?.status === 'completed');
            if (rec && (!prev || Number(rec.updatedAt || 0) > Number(prev.updatedAt || 0) || (recDone && !prevDone))) {
              cur[tid] = rec;
              dirty = true;
            }
          });
          if (dirty) {
            localStorage.setItem(lsKey, JSON.stringify(cur));
            changed = true;
          }
        } catch (_) {}
      }
    });

    // Merge Writing Practice History from Cloud (keeps full submitted essays synced across devices)
    if (Array.isArray(sd.writingPracticeHistory) && sd.writingPracticeHistory.length) {
      try {
        const wKey = `totoro_writing_prac_hist_v1_${scoped}`;
        const localW = JSON.parse(localStorage.getItem(wKey) || '[]');
        const arr = Array.isArray(localW) ? localW.slice() : [];
        const sigSet = new Set(arr.map((x) => `${x?.promptId || ''}::${Number(x?.completedAt || 0)}`));
        let wDirty = false;
        sd.writingPracticeHistory.forEach((rec) => {
          if (!rec || !rec.promptId) return;
          const sig = `${rec.promptId}::${Number(rec.completedAt || 0)}`;
          if (!sigSet.has(sig)) {
            arr.push(rec);
            sigSet.add(sig);
            wDirty = true;
          }
        });
        if (wDirty) {
          arr.sort((a, b) => Number(b?.completedAt || 0) - Number(a?.completedAt || 0));
          localStorage.setItem(wKey, JSON.stringify(arr.slice(0, 60)));
          changed = true;
        }
      } catch (_) {}
    }

    const LOCK_WINDOW_MS = 30 * 60 * 1000;
    const cloudUnlockedAt = Number(sd.teacherUnlockedAt || 0);
    let localUnlockedAt = 0;
    try {
      localUnlockedAt = Number(localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`) || 0);
    } catch (_) {}
    const effectiveUnlockAt = Math.max(cloudUnlockedAt, localUnlockedAt);
    if (cloudUnlockedAt > localUnlockedAt) {
      try {
        localStorage.setItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`, String(cloudUnlockedAt));
      } catch (_) {}
    }

    // Merge per-task teacher unlock timestamps (supports unlocking 1 of 4 tasks independently!)
    let mergedPerUnlocks = {};
    try {
      const localPer = JSON.parse(localStorage.getItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`) || '{}') || {};
      const cloudPer = (sd.teacherTaskUnlocks && typeof sd.teacherTaskUnlocks === 'object') ? sd.teacherTaskUnlocks : {};
      mergedPerUnlocks = { ...localPer };
      let perDirty = false;
      Object.entries(cloudPer).forEach(([tid, ts]) => {
        const nts = Number(ts || 0);
        if (nts > Number(mergedPerUnlocks[tid] || 0)) {
          mergedPerUnlocks[tid] = nts;
          perDirty = true;
        }
      });
      if (perDirty) {
        localStorage.setItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`, JSON.stringify(mergedPerUnlocks));
      }
    } catch (_) {}

    const isKeyUnlocked = (tid, untilMs) => {
      const origin = Number(untilMs || 0) - LOCK_WINDOW_MS;
      if (effectiveUnlockAt > 0 && origin <= effectiveUnlockAt) return true;
      const perAt = Number(mergedPerUnlocks[tid] || 0);
      return perAt > 0 && origin <= perAt;
    };

    try {
      const tlKey = `${TASK_LOCKS_KEY_BASE}${scoped}`;
      const localTl = JSON.parse(localStorage.getItem(tlKey) || '{}') || {};
      let tlChanged = false;
      const nowMs = Date.now();
      let unlockedActiveLock = false;

      // Xóa mọi khóa Reading đã bị giáo viên mở khóa (tổng hoặc riêng bài)
      Object.entries(localTl).forEach(([tid, untilMs]) => {
        const u = Number(untilMs || 0);
        if (isKeyUnlocked(tid, u)) {
          if (u > nowMs) unlockedActiveLock = true;
          delete localTl[tid];
          tlChanged = true;
        }
      });

      // Xóa khóa Reading Practice & Writing cục bộ nếu giáo viên vừa mở khóa (toàn bộ hoặc riêng mục)
      [
        [`ielts_rp_anticheat_lock_v1_${scoped}`, 'rp_prac_lock'],
        [`totoro_writing_task_lock_v1_${scoped}`, 'w_task_lock'],
        [`totoro_writing_prac_lock_v1_${scoped}`, 'w_prac_lock'],
      ].forEach(([wKey, fallbackTid]) => {
        try {
          const info = JSON.parse(localStorage.getItem(wKey) || 'null');
          if (info && Number(info.until || 0) > 0) {
            const matchKey = info.modId || fallbackTid;
            if (isKeyUnlocked(matchKey, info.until) || isKeyUnlocked(fallbackTid, info.until)) {
              if (Number(info.until) > nowMs) unlockedActiveLock = true;
              localStorage.removeItem(wKey);
              tlChanged = true;
              if (fallbackTid === 'rp_prac_lock') {
                try { window.dispatchEvent(new CustomEvent('reading-practice-updated')); } catch (_) {}
                window.ReadingPracticeApp?.render?.();
              } else if (fallbackTid === 'w_task_lock' || fallbackTid === 'w_prac_lock') {
                window.WritingStudio?.closeAcModal?.();
              }
            }
          }
        } catch (_) {}
      });

      if (sd.taskLocks && typeof sd.taskLocks === 'object') {
        Object.entries(sd.taskLocks).forEach(([tid, untilMs]) => {
          const cloudUntil = Number(untilMs || 0);
          if (isKeyUnlocked(tid, cloudUntil)) return;
          if (/^(task|fnd|acd|adv)_\d+$/i.test(tid)) {
            const localUntil = Number(localTl[tid] || 0);
            if (cloudUntil > localUntil) {
              localTl[tid] = cloudUntil;
              tlChanged = true;
            }
          }
        });
      }

      if (tlChanged) {
        localStorage.setItem(tlKey, JSON.stringify(localTl));
        changed = true;
        if (unlockedActiveLock && currentUser && getScopedUid(currentUser.id) === scoped) {
          showToast('Giáo viên vừa mở khóa bài tập cho bạn!');
        }
      }
    } catch (_) {}

    if (changed && currentUser && getScopedUid(currentUser.id) === scoped) {
      updateTimerDisplay();
      updateVocabMasteryUI();
      updateStudyStreakUI();
      window.TasksModule?.onCloudMerged?.();
      const curItem = currentScopeList[currentCardIndex];
      if (curItem) {
        const curLvl = assessments[curItem.id];
        renderStatusTag('fc-front-status', curLvl);
        renderStatusTag('fc-back-status', curLvl);
      }
    }
  }

  async function syncPullClassData() {
    const url = getSyncUrl();
    updateCloudSyncBadge();
    if (!url) {
      initialCloudPullSettled = true;
      initialCloudPullUid = currentUser ? getScopedUid(currentUser.id) : '';
      return;
    }
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}t=${Date.now()}`, { method: 'GET', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.ok || !Array.isArray(data.students)) return;
      cloudGasVersion = Number(data.gasVersion || 1);

      let activeCloudNeedsReset = false;
      const activeScopedUid = currentUser ? getScopedUid(currentUser.id) : '';
      const nextCache = {};
      data.students.forEach(st => {
        const uid = getScopedUid(st.id);
        if (!uid) return;
        // Bỏ qua dữ liệu cloud cũ trước mốc reset toàn lớp để toàn bộ học viên & giáo viên bắt đầu sạch từ 0
        // nhưng vẫn bảo toàn teacherUnlockedAt nếu giáo viên vừa bấm mở khóa
        if (Number(st.syncData?.resetEpoch || 0) < CLASS_RESET_EPOCH) {
          if (activeScopedUid && uid === activeScopedUid) activeCloudNeedsReset = true;
          const preservedUnlockAt = Number(st.syncData?.teacherUnlockedAt || 0);
          nextCache[uid] = {
            ...st,
            todayMins: 0,
            weekMins: 0,
            monthMins: 0,
            mastered: 0,
            streak: 0,
            syncData: {
              resetEpoch: CLASS_RESET_EPOCH,
              teacherUnlockedAt: preservedUnlockAt,
              timerByDay: {},
              wordsByDay: {},
              streakDays: [],
              assessments: {},
              srsData: {},
              scopePositions: {},
              taskProgress: {},
              taskLocks: {},
            },
          };
          return;
        }
        nextCache[uid] = st;
      });
      cloudClassCache = nextCache;

      // Sync teacher live task deadlines (extend / end early / reopen) STRICTLY per classId
      try {
        const activeCid = getActiveClassId();
        const LIVE_DL_KEY = getLiveDeadlinesStorageKey(activeCid);
        let liveMap = {};
        try { liveMap = JSON.parse(localStorage.getItem(LIVE_DL_KEY) || '{}') || {}; } catch (_) {}
        let liveChanged = false;
        const mergeDlSource = (src) => {
          if (!src || typeof src !== 'object') return;
          Object.entries(src).forEach(([tid, rec]) => {
            if (!rec || typeof rec !== 'object') return;
            const prev = liveMap[tid];
            if (!prev || Number(rec.issuedAt || 0) > Number(prev.issuedAt || 0)) {
              liveMap[tid] = { deadlineAt: Number(rec.deadlineAt || 0), issuedAt: Number(rec.issuedAt || 0) };
              liveChanged = true;
            }
          });
        };
        const accById = {};
        getAccountsList().forEach((a) => { accById[getScopedUid(a.id)] = a; });
        data.students.forEach((st) => {
          if (!st?.syncData?.teacherTaskDeadlines) return;
          const stUid = getScopedUid(st.id);
          const srcCid = String(st?.syncData?.classId || accById[stUid]?.classId || (stUid === 'giaovien' ? 'lop_thay_man' : '')).trim();
          if (activeCid && srcCid && srcCid !== activeCid) return;
          mergeDlSource(st.syncData.teacherTaskDeadlines);
        });
        if (liveChanged) {
          localStorage.setItem(LIVE_DL_KEY, JSON.stringify(liveMap));
        }
        window.TeacherStudio?.updateStudentHomeworkBadge?.();
      } catch (_) {}

      if (currentUser) {
        const activeUid = getScopedUid(currentUser.id);
        const mine = cloudClassCache[activeUid];
        if (activeCloudNeedsReset && !isTeacherUser()) {
          if (mine) mergeCloudEntryIntoLocal(currentUser.id, mine);
          initialCloudPullSettled = true;
          initialCloudPullUid = activeUid;
          syncPushCurrentUser(false, { force: true, retries: 1 });
        } else if (mine) {
          mergeCloudEntryIntoLocal(currentUser.id, mine);
          initialCloudPullSettled = true;
          initialCloudPullUid = activeUid;
          if (!isTeacherUser() && hasPendingCloudPush(activeUid)) {
            syncPushCurrentUser(false, { force: true, retries: 1 });
          }
        } else {
          initialCloudPullSettled = true;
          initialCloudPullUid = activeUid;
          if (!isTeacherUser()) {
            window.TasksModule?.onCloudMerged?.();
            if (hasPendingCloudPush(activeUid)) {
              syncPushCurrentUser(false, { force: true, retries: 1 });
            }
          }
        }
      }

      const now = new Date();
      lastCloudSyncTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      updateCloudSyncBadge();
      updateLeaderboardUI();
      if (isTeacherUser()) {
        window.TasksModule?.renderTeacherDashboard?.();
      }
      if (document.getElementById('modal-class-report')?.classList.contains('open')) {
        renderClassReportTable();
      }
    } catch (err) {
      console.warn('Cloud pull skipped:', err);
      // Do NOT set initialCloudPullSettled = true on failure; prevents a blank browser from pushing empty state over cloud history!
    }
  }

  function broadcastTeacherTaskDeadlines(deadlinesMap) {
    if (!isTeacherUser() || !deadlinesMap || typeof deadlinesMap !== 'object') return Promise.resolve(false);
    const uid = currentUser?.id || 'giaovien';
    const scoped = getScopedUid(uid);
    const payload = {
      id: uid,
      name: currentUser?.name || 'Giao Vien',
      todayMins: 0,
      weekMins: 0,
      monthMins: 0,
      mastered: 0,
      streak: 0,
      syncData: {
        resetEpoch: CLASS_RESET_EPOCH,
        classId: getActiveClassId(),
        teacherTaskDeadlines: deadlinesMap,
      },
    };
    cloudClassCache[scoped] = { ...cloudClassCache[scoped], ...payload };
    const url = getSyncUrl();
    if (!url) return Promise.resolve(true);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).then((r) => Boolean(r && r.ok)).catch(() => false);
  }

  function unlockStudentCloudLocks(studentId, unlockedAtTs = Date.now(), targetTaskId = null) {
    const scoped = getScopedUid(studentId);
    if (!scoped) return;
    const isSingle = Boolean(targetTaskId && String(targetTaskId).trim());
    const cleanTarget = isSingle ? String(targetTaskId).trim() : '';
    const prev = cloudClassCache[scoped];
    const LOCK_WINDOW_MS = 30 * 60 * 1000;
    const prevLocks = (prev?.syncData?.taskLocks && typeof prev.syncData.taskLocks === 'object') ? { ...prev.syncData.taskLocks } : {};
    const prevPerUnlocks = (prev?.syncData?.teacherTaskUnlocks && typeof prev.syncData.teacherTaskUnlocks === 'object') ? { ...prev.syncData.teacherTaskUnlocks } : {};

    let maxLockOrigin = 0;
    if (isSingle) {
      const u = Number(prevLocks[cleanTarget] || 0);
      if (u > 0) maxLockOrigin = u - LOCK_WINDOW_MS;
    } else {
      Object.values(prevLocks).forEach((until) => {
        const origin = Number(until || 0) - LOCK_WINDOW_MS;
        if (origin > maxLockOrigin) maxLockOrigin = origin;
      });
    }
    const effectiveUnlockAt = Math.max(
      Number(unlockedAtTs || Date.now()),
      isSingle ? Number(prevPerUnlocks[cleanTarget] || 0) : Number(prev?.syncData?.teacherUnlockedAt || 0),
      maxLockOrigin > 0 ? (maxLockOrigin + 1) : 0
    );

    const nextLocks = isSingle ? { ...prevLocks } : {};
    if (isSingle) delete nextLocks[cleanTarget];
    const nextPerUnlocks = { ...prevPerUnlocks };
    if (isSingle) nextPerUnlocks[cleanTarget] = effectiveUnlockAt;
    const nextUnlockAll = isSingle ? Number(prev?.syncData?.teacherUnlockedAt || 0) : effectiveUnlockAt;

    let prevLocalUnlock = null;
    let prevLocalPerUnlocks = null;
    let prevLocalLocks = null;
    try {
      prevLocalUnlock = localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`);
      prevLocalPerUnlocks = localStorage.getItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`);
      prevLocalLocks = localStorage.getItem(`${TASK_LOCKS_KEY_BASE}${scoped}`);

      if (isSingle) {
        const lPer = JSON.parse(prevLocalPerUnlocks || '{}') || {};
        lPer[cleanTarget] = effectiveUnlockAt;
        localStorage.setItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`, JSON.stringify(lPer));

        const lLocks = JSON.parse(prevLocalLocks || '{}') || {};
        delete lLocks[cleanTarget];
        localStorage.setItem(`${TASK_LOCKS_KEY_BASE}${scoped}`, JSON.stringify(lLocks));

        // Clear matching local Listening/Writing/Speaking lock if offline on same browser
        [`totoro_listening_task_locks_v1_${scoped}`, `totoro_speaking_task_locks_v1_${scoped}`].forEach((k) => {
          const m = JSON.parse(localStorage.getItem(k) || '{}') || {};
          if (cleanTarget in m) { delete m[cleanTarget]; localStorage.setItem(k, JSON.stringify(m)); }
        });
        const wTask = JSON.parse(localStorage.getItem(`totoro_writing_task_lock_v1_${scoped}`) || 'null');
        if (wTask && (cleanTarget === 'w_task_lock' || wTask.modId === cleanTarget)) {
          localStorage.removeItem(`totoro_writing_task_lock_v1_${scoped}`);
        }
        if (cleanTarget === 'w_prac_lock') {
          localStorage.removeItem(`totoro_writing_prac_lock_v1_${scoped}`);
        }
        if (cleanTarget === 'rp_prac_lock') {
          localStorage.removeItem(`ielts_rp_anticheat_lock_v1_${scoped}`);
        }
      } else {
        localStorage.setItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`, String(effectiveUnlockAt));
        localStorage.setItem(`${TASK_LOCKS_KEY_BASE}${scoped}`, '{}');
        localStorage.removeItem(`ielts_rp_anticheat_lock_v1_${scoped}`);
        localStorage.removeItem(`totoro_listening_task_locks_v1_${scoped}`);
        localStorage.removeItem(`totoro_speaking_task_locks_v1_${scoped}`);
        localStorage.removeItem(`totoro_writing_task_lock_v1_${scoped}`);
        localStorage.removeItem(`totoro_writing_prac_lock_v1_${scoped}`);
      }
    } catch (_) {}

    if (prev && typeof prev === 'object') {
      const prevSync = (prev.syncData && typeof prev.syncData === 'object') ? prev.syncData : {};
      cloudClassCache[scoped] = {
        ...prev,
        syncData: {
          ...prevSync,
          taskLocks: nextLocks,
          teacherUnlockedAt: nextUnlockAll,
          teacherTaskUnlocks: nextPerUnlocks,
        },
      };
    }

    const acct = getAccountsList().find((a) => getScopedUid(a.id) === scoped);
    const url = getSyncUrl();
    if (!url) return Promise.resolve(true);

    const revertFailedUnlock = (msg) => {
      try {
        if (prevLocalUnlock === null) localStorage.removeItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`);
        else localStorage.setItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`, prevLocalUnlock);
        if (prevLocalPerUnlocks === null) localStorage.removeItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`);
        else localStorage.setItem(`${TEACHER_TASK_UNLOCKS_KEY_BASE}${scoped}`, prevLocalPerUnlocks);
        if (prevLocalLocks === null) localStorage.removeItem(`${TASK_LOCKS_KEY_BASE}${scoped}`);
        else localStorage.setItem(`${TASK_LOCKS_KEY_BASE}${scoped}`, prevLocalLocks);
      } catch (_) {}
      if (prev && typeof prev === 'object') {
        cloudClassCache[scoped] = prev;
      } else {
        delete cloudClassCache[scoped];
      }
      if (isTeacherUser()) {
        window.TasksModule?.renderTeacherDashboard?.();
      }
      showToast(msg || 'Không gửi được lệnh mở khóa lên Google Sheet! Hãy kiểm tra kết nối hoặc triển khai lại Apps Script.');
    };

    const parseJsonSafe = async (resp) => {
      if (!resp || !resp.ok) return null;
      try {
        const txt = await resp.text();
        return JSON.parse(txt);
      } catch (_) {
        return null;
      }
    };

    const buildCompatPayload = () => ({
      id: acct?.id || prev?.id || studentId,
      name: acct?.name || prev?.name || studentId,
      todayMins: Number(prev?.todayMins || 0),
      weekMins: Number(prev?.weekMins || 0),
      monthMins: Number(prev?.monthMins || 0),
      mastered: Number(prev?.mastered || 0),
      streak: Number(prev?.streak || 0),
      syncData: {
        ...(prev?.syncData || {}),
        taskLocks: nextLocks,
        teacherUnlockedAt: nextUnlockAll,
        teacherTaskUnlocks: nextPerUnlocks,
      },
    });

    const finalizeUnlockSuccess = (serverUnlock) => {
      try {
        if (!isSingle) {
          const curLocal = Number(localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`) || 0);
          if (serverUnlock > curLocal) {
            localStorage.setItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`, String(serverUnlock));
          }
        }
      } catch (_) {}
      if (cloudClassCache[scoped]?.syncData) {
        cloudClassCache[scoped].syncData.taskLocks = nextLocks;
        cloudClassCache[scoped].syncData.teacherTaskUnlocks = nextPerUnlocks;
        if (!isSingle) {
          cloudClassCache[scoped].syncData.teacherUnlockedAt = Math.max(
            Number(cloudClassCache[scoped].syncData.teacherUnlockedAt || 0),
            serverUnlock
          );
        }
      } else {
        syncPullClassData();
      }
      if (isTeacherUser()) {
        window.TasksModule?.renderTeacherDashboard?.();
      }
      return true;
    };

    // Single-task unlock uses direct sync payload when GAS < 3 (preserves other active locks safely!),
    // or unlock_student with taskId when GAS supports it.
    if ((isSingle || cloudGasVersion === 1) && prev && prev.syncData && typeof prev.syncData === 'object') {
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(buildCompatPayload()),
      }).then(parseJsonSafe).then((fbRes) => {
        if (!fbRes || !fbRes.ok) {
          revertFailedUnlock('Lỗi kết nối Google Sheet khi mở khóa — vui lòng bấm Mở khóa lại.');
          return false;
        }
        return finalizeUnlockSuccess(effectiveUnlockAt);
      }).catch(() => {
        revertFailedUnlock('Lỗi kết nối Google Sheet khi mở khóa — vui lòng thử lại.');
        return false;
      });
    }

    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'unlock_student',
        id: acct?.id || prev?.id || studentId,
        name: acct?.name || prev?.name || studentId,
        unlockedAtTs: effectiveUnlockAt,
        taskId: cleanTarget,
      }),
    }).then(parseJsonSafe).then(async (res) => {
      const serverConfirmedUnlock = Boolean(res && res.ok && res.action === 'unlock_student' && Number(res.teacherUnlockedAt || 0) > 0);
      if (!serverConfirmedUnlock) {
        if (prev && prev.syncData && typeof prev.syncData === 'object') {
          const fbRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(buildCompatPayload()),
          }).then(parseJsonSafe).catch(() => null);
          if (!fbRes || !fbRes.ok) {
            revertFailedUnlock('Lỗi gửi lệnh mở khóa lên Google Sheet — vui lòng thử lại.');
            return false;
          }
          cloudGasVersion = 1;
        } else {
          revertFailedUnlock('Không gửi được lệnh mở khóa lên Google Sheet — vui lòng thử lại.');
          return false;
        }
      } else {
        cloudGasVersion = 2;
      }

      return finalizeUnlockSuccess(Number(res?.teacherUnlockedAt || effectiveUnlockAt));
    }).catch(() => {
      revertFailedUnlock('Lỗi kết nối tới Google Sheet — vui lòng thử lại.');
      return false;
    });
  }

  const PENDING_CLOUD_PUSH_KEY = 'ielts_pending_cloud_push_v1';

  function markPendingCloudPush(scopedUid, isPending) {
    if (!scopedUid) return;
    try {
      const map = JSON.parse(localStorage.getItem(PENDING_CLOUD_PUSH_KEY) || '{}') || {};
      if (isPending) map[scopedUid] = Date.now();
      else delete map[scopedUid];
      localStorage.setItem(PENDING_CLOUD_PUSH_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function hasPendingCloudPush(scopedUid) {
    if (!scopedUid) return false;
    try {
      const map = JSON.parse(localStorage.getItem(PENDING_CLOUD_PUSH_KEY) || '{}') || {};
      return Boolean(map[scopedUid]);
    } catch (_) {
      return false;
    }
  }

  function getStudentAssessmentsMap(studentId) {
    const scoped = getScopedUid(studentId);
    if (!scoped) return {};
    const merged = {};
    const remote = cloudClassCache[scoped]?.syncData?.assessments;
    if (remote && typeof remote === 'object') {
      Object.entries(remote).forEach(([wid, v]) => {
        if (v === 1 || v === 2 || v === 3) merged[wid] = v;
      });
    }
    try {
      const localObj = JSON.parse(localStorage.getItem(getUserStorageKey(scoped)) || '{}') || {};
      const localAssess = localObj.assessments;
      if (localAssess && typeof localAssess === 'object') {
        Object.entries(localAssess).forEach(([wid, v]) => {
          if (v === 3 || (v === 2 && merged[wid] !== 3) || (v === 1 && !merged[wid])) {
            merged[wid] = v;
          }
        });
      }
    } catch (_) {}
    return merged;
  }

  function syncPushCurrentUser(useKeepalive = false, opts = {}) {
    const url = getSyncUrl();
    const force = Boolean(opts && opts.force);
    const maxRetries = Math.max(0, Number(opts && opts.retries || 0));
    if (!url || !currentUser || isTeacherUser()) return Promise.resolve(false);
    const pushedUid = getScopedUid(currentUser.id);
    const pullMatchesUser = initialCloudPullSettled && (!initialCloudPullUid || initialCloudPullUid === pushedUid);
    if (!pullMatchesUser && !force) {
      markPendingCloudPush(pushedUid, true);
      return Promise.resolve(false);
    }
    try {
      // Safety merge: ensure any known cloud progress in cache is merged into local before building outgoing payload
      if (cloudClassCache[pushedUid]?.syncData) {
        mergeCloudEntryIntoLocal(currentUser.id, cloudClassCache[pushedUid]);
      }
      const mins = getUserPeriodMinutes(currentUser.id);
      const mastered = getUserMasteredCount(currentUser.id);
      const streak = computeConsecutiveStreakForUser(currentUser.id);
      const outSyncData = buildUserSyncData(currentUser.id);

      // Anti-clobber guard: never let an empty outgoing payload overwrite non-empty cloud cache
      const cachedCloudAssessCnt = Object.keys(cloudClassCache[pushedUid]?.syncData?.assessments || {}).length;
      const outAssessCnt = Object.keys(outSyncData.assessments || {}).length;
      if (!force && cachedCloudAssessCnt > 0 && outAssessCnt === 0) {
        markPendingCloudPush(pushedUid, true);
        return Promise.resolve(false);
      }

      const payload = {
        id: currentUser.id,
        name: currentUser.name,
        todayMins: mins.todayMins,
        weekMins: mins.weekMins,
        monthMins: mins.monthMins,
        mastered,
        streak,
        syncData: outSyncData,
      };

      cloudClassCache[pushedUid] = {
        ...cloudClassCache[pushedUid],
        ...payload,
      };

      const bodyStr = JSON.stringify(payload);
      // Browser fetch keepalive rejects payloads > 64KB; fall back to standard fetch when large
      const safeKeepalive = Boolean(useKeepalive && bodyStr.length < 60000);

      const attemptPush = (attempt) => fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: bodyStr,
        keepalive: safeKeepalive,
      }).then(r => r.ok ? r.json() : null).then(res => {
        if (!res || !res.ok) {
          throw new Error('Cloud push rejected');
        }
        markPendingCloudPush(pushedUid, false);
        if (!currentUser || getScopedUid(currentUser.id) !== pushedUid) return true;
        const now = new Date();
        lastCloudSyncTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
        updateCloudSyncBadge();
        const serverUnlock = Number(res.teacherUnlockedAt || 0);
        const localUnlock = Number(localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${pushedUid}`) || 0);
        const serverLocks = (res.taskLocks && typeof res.taskLocks === 'object') ? res.taskLocks : {};
        const serverPerUnlocks = (res.teacherTaskUnlocks && typeof res.teacherTaskUnlocks === 'object')
          ? { ...res.teacherTaskUnlocks }
          : {};
        // CRITICAL: If student pushed an active lock (e.g. w_st01_m02 / rp_prac_lock) and server returned taskLocks WITHOUT it,
        // Teacher ALREADY unlocked that specific task! Synthesize per-task unlock so student unlocks immediately without F5.
        const nowCheck = Date.now();
        let hasNewServerUnlock = serverUnlock > localUnlock || Object.keys(serverPerUnlocks).length > 0;
        Object.entries(outSyncData.taskLocks || {}).forEach(([tid, untilMs]) => {
          if (Number(untilMs || 0) > nowCheck && !serverLocks[tid]) {
            serverPerUnlocks[tid] = Math.max(Number(serverPerUnlocks[tid] || 0), nowCheck + 60000);
            hasNewServerUnlock = true;
          }
        });
        if (hasNewServerUnlock) {
          if (cloudClassCache[pushedUid]?.syncData) {
            if (serverUnlock > 0) cloudClassCache[pushedUid].syncData.teacherUnlockedAt = Math.max(Number(cloudClassCache[pushedUid].syncData.teacherUnlockedAt || 0), serverUnlock);
            cloudClassCache[pushedUid].syncData.teacherTaskUnlocks = {
              ...(cloudClassCache[pushedUid].syncData.teacherTaskUnlocks || {}),
              ...serverPerUnlocks,
            };
            cloudClassCache[pushedUid].syncData.taskLocks = serverLocks;
          }
          mergeCloudEntryIntoLocal(currentUser.id, {
            syncData: {
              teacherUnlockedAt: serverUnlock,
              teacherTaskUnlocks: serverPerUnlocks,
              taskLocks: serverLocks,
            },
          });
        }
        return true;
      }).catch(() => {
        markPendingCloudPush(pushedUid, true);
        if (attempt < maxRetries && currentUser && getScopedUid(currentUser.id) === pushedUid) {
          const delay = attempt === 0 ? 1500 : 4000;
          return new Promise((resolve) => {
            setTimeout(() => resolve(attemptPush(attempt + 1)), delay);
          });
        }
        return false;
      });

      return attemptPush(0);
    } catch (_) {
      return Promise.resolve(false);
    }
  }

  function scheduleCloudPush() {
    if (currentUser && !isTeacherUser()) updateLeaderboardUI();
    if (!getSyncUrl() || !currentUser || isTeacherUser()) return;
    clearTimeout(cloudPushDebounce);
    cloudPushDebounce = setTimeout(() => syncPushCurrentUser(false), 1800);
  }

  function getUserSecondsForDay(uid, dateKey) {
    let secs = 0;
    try {
      secs = parseInt(localStorage.getItem(getUserTimerKey(dateKey, uid)) || '0', 10) || 0;
    } catch (_) {}
    const scoped = getScopedUid(uid);
    const cloudSecs = parseInt(cloudClassCache[scoped]?.syncData?.timerByDay?.[dateKey] || '0', 10) || 0;
    secs = Math.max(secs, cloudSecs);
    if (currentUser && scoped === getScopedUid(currentUser.id) && dateKey === localStudyDayKey()) {
      secs = Math.max(secs, todayStudySeconds);
    }
    return secs;
  }

  function getUserPeriodMinutes(uid) {
    const now = new Date();
    const todayKey = localStudyDayKey(now);
    const todaySecs = getUserSecondsForDay(uid, todayKey);

    const todayIdx = (now.getDay() + 6) % 7;
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIdx);
    let weekSecs = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
      weekSecs += getUserSecondsForDay(uid, localStudyDayKey(d));
    }

    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    let monthSecs = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      monthSecs += getUserSecondsForDay(uid, localStudyDayKey(d));
    }

    const scoped = getScopedUid(uid);
    const cloudEntry = cloudClassCache[scoped];
    const localToday = Math.floor(todaySecs / 60);
    const localWeek = Math.floor(weekSecs / 60);
    const localMonth = Math.floor(monthSecs / 60);

    if (cloudEntry && !cloudEntry.syncData?.timerByDay) {
      return {
        todayMins: Math.max(localToday, Number(cloudEntry.todayMins || 0)),
        weekMins: Math.max(localWeek, Number(cloudEntry.weekMins || 0)),
        monthMins: Math.max(localMonth, Number(cloudEntry.monthMins || 0)),
      };
    }

    return {
      todayMins: localToday,
      weekMins: localWeek,
      monthMins: localMonth,
    };
  }

  function getUserWordsForDay(uid, dateKey) {
    let words = 0;
    try {
      words = parseInt(localStorage.getItem(getUserDailyWordsKey(dateKey, uid)) || '0', 10) || 0;
    } catch (_) {}
    const scoped = getScopedUid(uid);
    const cloudWords = parseInt(cloudClassCache[scoped]?.syncData?.wordsByDay?.[dateKey] || '0', 10) || 0;
    return Math.max(words, cloudWords);
  }

  function getUserPeriodWords(uid) {
    const now = new Date();
    const todayKey = localStudyDayKey(now);
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();
    const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

    const todayDaily = getUserWordsForDay(uid, todayKey);
    let monthDaily = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(curYear, curMonth, day);
      monthDaily += getUserWordsForDay(uid, localStudyDayKey(d));
    }

    const scoped = getScopedUid(uid);
    const mergedAssess = {};
    const mergedSrs = {};
    if (currentUser && scoped === getScopedUid(currentUser.id)) {
      Object.assign(mergedAssess, assessments || {});
      Object.assign(mergedSrs, srsData || {});
    } else {
      try {
        const raw = localStorage.getItem(getUserStorageKey(uid));
        if (raw) {
          const st = JSON.parse(raw);
          if (st?.assessments && typeof st.assessments === 'object') Object.assign(mergedAssess, st.assessments);
          if (st?.srsData && typeof st.srsData === 'object') Object.assign(mergedSrs, st.srsData);
        }
      } catch (_) {}
    }
    const cloudSd = cloudClassCache[scoped]?.syncData;
    if (cloudSd?.assessments && typeof cloudSd.assessments === 'object') {
      Object.entries(cloudSd.assessments).forEach(([wid, lvl]) => {
        mergedAssess[wid] = Math.max(Number(mergedAssess[wid] || 0), Number(lvl || 0));
      });
    }
    if (cloudSd?.srsData && typeof cloudSd.srsData === 'object') {
      Object.entries(cloudSd.srsData).forEach(([wid, rec]) => {
        if (!rec || typeof rec !== 'object') return;
        const prev = mergedSrs[wid];
        if (!prev || Number(rec.lastAt || 0) > Number(prev.lastAt || 0)) {
          mergedSrs[wid] = rec;
        }
      });
    }

    ensureLemmaPeerIndex();
    const todayUniq = new Set();
    const monthUniq = new Set();
    Object.entries(mergedAssess).forEach(([wid, lvl]) => {
      if (lvl !== 3) return;
      const lastAt = Number(mergedSrs[wid]?.lastAt || 0);
      if (!lastAt) return;
      const dt = new Date(lastAt);
      const lem = _idToLemmaCache?.get(wid) || wid;
      if (localStudyDayKey(dt) === todayKey) {
        todayUniq.add(lem);
      }
      if (dt.getFullYear() === curYear && dt.getMonth() === curMonth) {
        monthUniq.add(lem);
      }
    });

    return {
      todayWords: Math.max(todayDaily, todayUniq.size),
      monthWords: Math.max(monthDaily, monthUniq.size),
    };
  }

  function getUserMasteredCount(uid) {
    const scoped = getScopedUid(uid);
    const cloudEntry = cloudClassCache[scoped];
    const cloudAssess = cloudEntry?.syncData?.assessments;
    const cloudAssessCount = (cloudAssess && typeof cloudAssess === 'object')
      ? countUniqueMasteredWords(cloudAssess)
      : 0;
    const cloudMastered = Math.max(cloudAssessCount, Number(cloudEntry?.mastered || 0));
    if (currentUser && scoped === getScopedUid(currentUser.id)) {
      return Math.max(countUniqueMasteredWords(assessments), cloudMastered);
    }
    let localMastered = 0;
    try {
      const raw = localStorage.getItem(getUserStorageKey(uid));
      if (raw) {
        const st = JSON.parse(raw);
        localMastered = st?.assessments ? countUniqueMasteredWords(st.assessments) : 0;
      }
    } catch (_) {}
    return Math.max(localMastered, cloudMastered);
  }

  function getUserTaskProgressMap(uid) {
    const scoped = getScopedUid(uid);
    const merged = {};
    try {
      const localTp = JSON.parse(localStorage.getItem(`${TASK_PROGRESS_KEY_BASE}${scoped}`) || '{}') || {};
      Object.entries(localTp).forEach(([tid, rec]) => {
        if (rec && typeof rec === 'object') merged[tid] = rec;
      });
    } catch (_) {}
    const cloudTp = cloudClassCache[scoped]?.syncData?.taskProgress;
    if (cloudTp && typeof cloudTp === 'object') {
      Object.entries(cloudTp).forEach(([tid, rec]) => {
        if (!rec || typeof rec !== 'object') return;
        const prev = merged[tid];
        if (!prev || (rec.status === 'completed' && prev.status !== 'completed') || Number(rec.updatedAt || 0) > Number(prev.updatedAt || 0)) {
          merged[tid] = rec;
        }
      });
    }
    return merged;
  }

  function getUserListCertsMap(uid) {
    const scoped = getScopedUid(uid);
    const merged = {};
    try {
      const localC = JSON.parse(localStorage.getItem(`${LIST_CERTS_KEY_BASE}${scoped}`) || '{}') || {};
      Object.entries(localC).forEach(([k, v]) => {
        if (v && typeof v === 'object') merged[k] = v;
      });
    } catch (_) {}
    const cloudC = cloudClassCache[scoped]?.syncData?.listMasteryCerts;
    if (cloudC && typeof cloudC === 'object') {
      Object.entries(cloudC).forEach(([k, v]) => {
        if (v?.passed && (!merged[k]?.passed || Number(v.completedAt || 0) > Number(merged[k].completedAt || 0))) {
          merged[k] = v;
        }
      });
    }
    return merged;
  }

  function computeTaskRecordScore10(tid, rec) {
    if (!rec || typeof rec !== 'object') return { score10: 0, isRecognition: false, recognitionPct: 0 };
    const isRecog = rec.taskKind === 'recognition'
      || /^(fnd|acd|adv)_/i.test(String(tid || ''))
      || (rec.recognitionScore != null && rec.translationScore == null);
    if (isRecog) {
      const pct = Math.max(0, Math.min(100, Number(rec.recognitionScore ?? 0)));
      return {
        score10: Math.round((pct / 10) * 10) / 10,
        isRecognition: true,
        recognitionPct: pct,
      };
    }
    const t1Ratio = Math.max(0, Math.min(1, Number(rec.test1AccuracyPct ?? 100) / 100));
    const t2Tot = Math.max(1, Number(rec.test2Total || 56));
    const t2Ratio = Math.max(0, Math.min(1, Number(rec.test2Score ?? 0) / t2Tot));
    const t3Ratio = Math.max(0, Math.min(1, Number(rec.translationScore || 0) / 10));
    return {
      score10: Math.round((((t1Ratio + t2Ratio + t3Ratio) / 3) * 10) * 10) / 10,
      isRecognition: false,
      recognitionPct: 0,
    };
  }

  function computeStudentRankScore({ mastered, periodMins, streak, taskProgress, listCerts }, period = 'week') {
    const vocabPoints = Math.max(0, Number(mastered || 0)) * 10;
    let tasksCompleted = 0;
    let taskPoints = 0;
    Object.entries(taskProgress || {}).forEach(([tid, rec]) => {
      if (rec?.status !== 'completed') return;
      tasksCompleted += 1;
      const info = computeTaskRecordScore10(tid, rec);
      if (info.isRecognition) {
        const bonus = info.recognitionPct >= 98 ? 20 : (info.recognitionPct >= 96 ? 10 : 0);
        taskPoints += 100 + bonus;
      } else {
        taskPoints += 150 + Math.round(info.score10 * 5);
      }
    });

    let certsPassed = 0;
    Object.values(listCerts || {}).forEach((c) => {
      if (c?.passed) certsPassed += 1;
    });
    const certPoints = certsPassed * 300;
    const hasLearningOutput = (Math.max(0, Number(mastered || 0)) > 0) || tasksCompleted > 0 || certsPassed > 0;
    const streakPoints = hasLearningOutput ? Math.min(150, Math.max(0, Number(streak || 0)) * 15) : 0;

    // Chặn trần điểm thời gian theo hiệu suất thực tế để chống treo tab 0 từ vẫn lên hạng
    const periodCap = period === 'month' ? 360 : 120;
    const outputCap = Math.max(0, Number(mastered || 0)) * 2 + tasksCompleted * 40 + certsPassed * 120;
    const timePoints = Math.min(Math.max(0, Number(periodMins || 0)), periodCap, outputCap);

    const score = vocabPoints + taskPoints + certPoints + streakPoints + timePoints;
    return {
      score,
      tasksCompleted,
      certsPassed,
      scoreBreakdown: { vocabPoints, taskPoints, certPoints, streakPoints, timePoints },
    };
  }

  function getClassRankedEntries(period = currentLeaderboardTab) {
    const accounts = getAccountsList();
    const studentAccounts = accounts.filter(acc => acc.role !== 'teacher');
    const entries = studentAccounts.map((acc, idx) => {
      const mins = getUserPeriodMinutes(acc.id);
      const periodWords = getUserPeriodWords(acc.id);
      const mastered = getUserMasteredCount(acc.id);
      const streak = computeConsecutiveStreakForUser(acc.id);
      const taskProgress = getUserTaskProgressMap(acc.id);
      const listCerts = getUserListCertsMap(acc.id);
      const periodMins = period === 'month' ? mins.monthMins : mins.weekMins;
      const scored = computeStudentRankScore({ mastered, periodMins, streak, taskProgress, listCerts }, period);
      return {
        id: acc.id,
        name: acc.name,
        order: idx,
        todayMins: mins.todayMins,
        weekMins: mins.weekMins,
        monthMins: mins.monthMins,
        todayWords: periodWords.todayWords,
        monthWords: periodWords.monthWords,
        periodMins,
        mastered,
        streak,
        tasksCompleted: scored.tasksCompleted,
        certsPassed: scored.certsPassed,
        score: scored.score,
        scoreBreakdown: scored.scoreBreakdown,
      };
    });

    entries.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.mastered !== a.mastered) return b.mastered - a.mastered;
      if (b.tasksCompleted !== a.tasksCompleted) return b.tasksCompleted - a.tasksCompleted;
      if (b.periodMins !== a.periodMins) return b.periodMins - a.periodMins;
      return a.order - b.order;
    });

    let lastScore = null;
    let lastRank = 0;
    return entries.map((entry, idx) => {
      const rank = (idx > 0 && entry.score === lastScore) ? lastRank : (idx + 1);
      lastScore = entry.score;
      lastRank = rank;
      return {
        ...entry,
        rank,
        rankLabel: entry.score > 0 ? `#${rank}` : '–',
      };
    });
  }

  function switchLeaderboardTab(tab) {
    currentLeaderboardTab = tab;
    document.getElementById('board-tab-week')?.classList.toggle('active', tab === 'week');
    document.getElementById('board-tab-month')?.classList.toggle('active', tab === 'month');
    updateLeaderboardUI();
    if (document.getElementById('modal-class-report')?.classList.contains('open')) {
      renderClassReportTable();
    }
  }

  function updateLeaderboardUI() {
    const listEl = document.getElementById('board-list');
    const userCardEl = document.getElementById('board-user-card');
    if (!listEl) return;

    const ranked = getClassRankedEntries(currentLeaderboardTab);
    const activeUid = getScopedUid(currentUser?.id);
    const myIdx = currentUser ? ranked.findIndex(r => getScopedUid(r.id) === activeUid) : -1;
    const inTop4 = myIdx >= 0 && myIdx < 4;
    const visibleTop = (inTop4 || isTeacherUser()) ? ranked.slice(0, 4) : ranked.slice(0, 3);

    const getMonogram = (name) => {
      const parts = String(name || 'HV').trim().split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return (parts[0] || 'HV').slice(0, 2).toUpperCase();
    };

    const CHESTNUT_UNIT_HTML = '<span class="tot-chestnut-unit" aria-label="hạt dẻ điểm" title="Hạt dẻ điểm"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.4C13 4.6 19.8 8.2 21 13.8C21.8 17.6 18.6 21 12 21C5.4 21 2.2 17.6 3 13.8C4.2 8.2 11 4.6 12 2.4Z" fill="#8B3A14" stroke="#531F07" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 17.5C7 15.8 17 15.8 19 17.5C17.6 19.9 15 20.8 12 20.8C9 20.8 6.4 19.9 5 17.5Z" fill="#E8CCA0"/><path d="M7.2 12.2C7.8 9.6 9.8 7.8 11.4 6.6" stroke="#DF8B56" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><path d="M12 4.8V15.4M8.5 8.5C7.9 11 7.8 13.2 8.2 15.6M15.5 8.5C16.1 11 16.2 13.2 15.8 15.6" stroke="#5E2409" stroke-width="0.9" stroke-linecap="round" opacity=".45"/></svg></span>';
    const formatPts = (n) => `${Number(n || 0).toLocaleString('vi-VN')}${CHESTNUT_UNIT_HTML}`;
    const formatTip = (p) => `${p.name} · ${p.score.toLocaleString('vi-VN')} điểm (${p.mastered} từ gốc · ${p.tasksCompleted} Task · ${p.periodMins}p · ${p.streak} ngày streak)`;

    listEl.innerHTML = visibleTop.map((p, idx) => {
      const isMe = currentUser && getScopedUid(p.id) === activeUid;
      const toneClass = `tone-${idx % 4}`;
      const isTop1 = p.rank === 1 && p.score > 0;
      return `
        <div class="board-item${isMe ? ' is-me' : ''}${isTop1 ? ' is-top1' : ''}" title="${escapeHtml(formatTip(p))}">
          <span class="board-rank" style="font-size:11.5px;font-weight:800;min-width:19px;">${p.rankLabel}</span>
          <span class="board-avatar ${toneClass}" aria-hidden="true">${escapeHtml(getMonogram(p.name))}</span>
          <div class="board-info">
            <span class="board-name">${escapeHtml(p.name)}</span>
            <span class="board-meta">· ${p.mastered} từ</span>
          </div>
          <span class="board-score">${formatPts(p.score)}</span>
        </div>
      `;
    }).join('');

    if (userCardEl) {
      if (inTop4 || !currentUser || isTeacherUser()) {
        userCardEl.style.display = 'none';
        userCardEl.innerHTML = '';
      } else {
        userCardEl.style.display = 'flex';
        const myEntry = ranked[myIdx];
        if (myEntry) {
          userCardEl.innerHTML = `
            <span class="board-rank user-rank">${myEntry.rankLabel}</span>
            <div class="board-info" style="display:flex;align-items:baseline;gap:4px;" title="${escapeHtml(formatTip(myEntry))}">
              <span class="board-name user-name">${escapeHtml(currentUser.name)}</span>
              <span class="board-meta" style="white-space:nowrap;flex-shrink:0;">· ${myEntry.mastered} từ</span>
            </div>
            <span class="board-score user-score">${formatPts(myEntry.score)}</span>
          `;
        } else {
          userCardEl.style.display = 'none';
          userCardEl.innerHTML = '';
        }
      }
    }
  }

  function recordDailyWordActivity(delta = 1) {
    if (!currentUser || isTeacherUser()) return;
    const inc = Math.max(1, parseInt(delta, 10) || 1);
    try {
      const todayKey = localStudyDayKey();
      const key = getUserDailyWordsKey(todayKey);
      const cur = parseInt(localStorage.getItem(key) || '0', 10) || 0;
      localStorage.setItem(key, String(cur + inc));
    } catch (_) {}
  }

  function getDayStats(dateKey, completedSet) {
    let secs = 0;
    let words = 0;
    try {
      secs = parseInt(localStorage.getItem(getUserTimerKey(dateKey)) || '0', 10) || 0;
      words = parseInt(localStorage.getItem(getUserDailyWordsKey(dateKey)) || '0', 10) || 0;
    } catch (_) {}
    if (dateKey === localStudyDayKey()) secs = Math.max(secs, todayStudySeconds);
    const active = completedSet.has(dateKey) || secs > 0 || words > 0;
    const mins = Math.floor(secs / 60);
    const score = (secs / 60) * 2 + words + (active ? 2 : 0);
    return { dateKey, secs, mins, words, active, score };
  }

  function formatMinutesCompact(totalMins) {
    if (totalMins >= 60) {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return m > 0 ? `${h} giờ ${m} phút` : `${h} giờ`;
    }
    return `${totalMins} phút`;
  }

  function switchStreakChartTab(tab) {
    currentStreakChartTab = tab;
    ['week', 'month', 'year'].forEach(t => {
      document.getElementById('streak-tab-' + t)?.classList.toggle('active', t === tab);
    });
    updateStudyStreakUI();
  }

  function buildStreakLineChartHtml(items, maxScore, chartId, axisHtml) {
    const W = 240;
    const H = 64;
    const padX = 7;
    const padTop = 9;
    const padBot = 9;
    const usableW = W - padX * 2;
    const usableH = H - padTop - padBot;
    const baseY = H - padBot;
    const midY = (padTop + baseY) / 2;
    const n = Math.max(1, items.length);

    const coords = items.map((it, idx) => {
      const x = n === 1 ? W / 2 : padX + (idx / (n - 1)) * usableW;
      const ratio = it.active ? Math.max(0.16, Math.min(1, it.score / maxScore)) : 0;
      const y = baseY - ratio * usableH;
      return { x, y, it };
    });

    // Compute overshoot-free monotone cubic Bezier tangents (Fritsch-Carlson on uniform x)
    const tangents = coords.map((_, i) => {
      if (i === 0 || i === coords.length - 1) return 0;
      const sPrev = coords[i].y - coords[i - 1].y;
      const sNext = coords[i + 1].y - coords[i].y;
      if (sPrev * sNext <= 0) return 0;
      return (2 * sPrev * sNext) / (sPrev + sNext);
    });

    let lineD = '';
    if (coords.length > 0) {
      lineD = `M ${coords[0].x.toFixed(2)},${coords[0].y.toFixed(2)}`;
      for (let i = 0; i < coords.length - 1; i++) {
        const p0 = coords[i];
        const p1 = coords[i + 1];
        const dx = p1.x - p0.x;
        const cp1x = p0.x + dx / 3;
        const cp1y = p0.y + tangents[i] / 3;
        const cp2x = p1.x - dx / 3;
        const cp2y = p1.y - tangents[i + 1] / 3;
        lineD += ` C ${cp1x.toFixed(2)},${cp1y.toFixed(2)} ${cp2x.toFixed(2)},${cp2y.toFixed(2)} ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`;
      }
    }
    const areaD = coords.length > 0
      ? `${lineD} L ${coords[coords.length - 1].x.toFixed(2)},${baseY} L ${coords[0].x.toFixed(2)},${baseY} Z`
      : '';

    const gradId = `streakAreaGrad_${chartId}`;
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gradColor = isDark ? '#82b892' : '#466b37';

    const dotsHtml = coords.map(c => {
      const leftPct = ((c.x / W) * 100).toFixed(2);
      const topPct = ((c.y / H) * 100).toFixed(2);
      const cls = `streak-dot-pt${c.it.active ? ' active' : ''}${c.it.isToday ? ' today' : ''}`;
      return `<span class="${cls}" style="left:${leftPct}%;top:${topPct}%;" title="${escapeHtml(c.it.tip)}"></span>`;
    }).join('');

    const peakMins = Math.max(0, ...items.map(x => Number(x.mins || 0)));
    const peakWords = Math.max(0, ...items.map(x => Number(x.words || 0)));
    const maxLabel = peakMins > 0 ? `${peakMins}p` : (peakWords > 0 ? `${peakWords}t` : '');

    return `
      <div class="streak-line-wrap">
        <div class="streak-line-stage">
          ${maxLabel ? `<span class="streak-max-label">Đỉnh: ${escapeHtml(maxLabel)}</span>` : ''}
          <svg class="streak-line-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">
            <defs>
              <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${gradColor}" stop-opacity="0.32" />
                <stop offset="100%" stop-color="${gradColor}" stop-opacity="0.02" />
              </linearGradient>
            </defs>
            <line x1="${padX}" y1="${midY}" x2="${W - padX}" y2="${midY}" class="streak-line-grid" />
            <line x1="${padX}" y1="${baseY}" x2="${W - padX}" y2="${baseY}" class="streak-line-base" />
            ${areaD ? `<path d="${areaD}" fill="url(#${gradId})" />` : ''}
            ${lineD ? `<path d="${lineD}" class="streak-line-path" />` : ''}
          </svg>
          ${dotsHtml}
        </div>
        ${axisHtml}
      </div>
    `;
  }

  function updateStudyStreakUI() {
    const streakBadgeNum = document.getElementById('streak-days-num');
    const chartEl = document.getElementById('streak-chart-area');
    const summaryLabelEl = document.getElementById('streak-summary-label');
    const summaryEl = document.getElementById('streak-week-summary');

    const now = new Date();
    const todayKey = localStudyDayKey(now);
    const todayIdx = (now.getDay() + 6) % 7;

    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(getUserStreakKey()) || '[]');
      if (!Array.isArray(history)) history = [];
    } catch (_) {
      history = [];
    }
    const completed = new Set(history);
    if (todayStudySeconds > 0) completed.add(todayKey);

    // Consecutive streak calculation
    let streak = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!completed.has(localStudyDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (completed.has(localStudyDayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    if (streakBadgeNum) streakBadgeNum.textContent = String(streak);
    const mobStreak = document.getElementById('mob-stat-streak');
    if (mobStreak) mobStreak.textContent = `${streak} ngày`;

    if (displayedStreak !== null && streak > displayedStreak && window.IELTSMotion?.enabled) {
      const badge = document.getElementById('streak-count-badge');
      badge?.classList.remove('motion-pop');
      void badge?.offsetWidth;
      badge?.classList.add('motion-pop');
    }
    displayedStreak = streak;

    if (!chartEl) return;

    if (currentStreakChartTab === 'week') {
      const streakDays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
      const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - todayIdx);
      const items = streakDays.map((label, idx) => {
        const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + idx);
        const st = getDayStats(localStudyDayKey(d), completed);
        return { label, isToday: idx === todayIdx, date: d, ...st };
      });
      const maxScore = Math.max(10, ...items.map(x => x.score));
      const activeDays = items.filter(x => x.active).length;
      const totalMins = Math.floor(items.reduce((a, b) => a + b.secs, 0) / 60);

      chartEl.innerHTML = `<div class="streak-bars-row">${items.map(it => {
        const pct = it.active ? Math.max(18, Math.round((it.score / maxScore) * 100)) : 0;
        const tip = `${it.label} (${it.date.getDate()}/${it.date.getMonth() + 1}): ${it.mins} phút${it.words ? ` · ${it.words} từ` : ''}`;
        return `
          <div class="streak-bar-col" title="${escapeHtml(tip)}">
            <div class="streak-bar-track">
              <div class="streak-bar-fill ${it.active ? 'active' : ''} ${it.isToday ? 'today' : ''}" style="height:${pct}%;"></div>
            </div>
            <span class="streak-bar-label ${it.isToday ? 'is-today' : ''}">${it.label}</span>
          </div>
        `;
      }).join('')}</div>`;

      if (summaryLabelEl) summaryLabelEl.textContent = 'Tuần này:';
      if (summaryEl) summaryEl.textContent = `${activeDays} / 7 ngày · ${formatMinutesCompact(totalMins)}`;
    } else if (currentStreakChartTab === 'month') {
      const yr = now.getFullYear();
      const mo = now.getMonth();
      const daysInMonth = new Date(yr, mo + 1, 0).getDate();
      const items = [];
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(yr, mo, day);
        const st = getDayStats(localStudyDayKey(d), completed);
        const tip = `Ngày ${day}/${mo + 1}: ${st.mins} phút${st.words ? ` · ${st.words} từ` : ''}`;
        items.push({ day, isToday: day === now.getDate(), tip, ...st });
      }
      const maxScore = Math.max(10, ...items.map(x => x.score));
      const activeDays = items.filter(x => x.active).length;
      const totalMins = Math.floor(items.reduce((a, b) => a + b.secs, 0) / 60);

      const monthAxis = `<div class="streak-axis-row"><span>1</span><span>10</span><span>20</span><span>${daysInMonth}</span></div>`;
      chartEl.innerHTML = buildStreakLineChartHtml(items, maxScore, 'month', monthAxis);

      if (summaryLabelEl) summaryLabelEl.textContent = `Tháng ${mo + 1}:`;
      if (summaryEl) summaryEl.textContent = `${activeDays} ngày · ${formatMinutesCompact(totalMins)}`;
    } else {
      const yr = now.getFullYear();
      const curMo = now.getMonth();
      const months = [];
      for (let m = 0; m < 12; m++) {
        const dim = new Date(yr, m + 1, 0).getDate();
        let mSecs = 0;
        let mWords = 0;
        let mActive = 0;
        for (let day = 1; day <= dim; day++) {
          const st = getDayStats(localStudyDayKey(new Date(yr, m, day)), completed);
          if (st.active) mActive++;
          mSecs += st.secs;
          mWords += st.words;
        }
        const mScore = (mSecs / 60) * 2 + mWords + mActive * 3;
        const tip = `Tháng ${m + 1}/${yr}: ${mActive} ngày · ${Math.floor(mSecs / 60)} phút${mWords ? ` · ${mWords} từ` : ''}`;
        months.push({ label: String(m + 1), idx: m, isToday: m === curMo, active: mActive > 0, activeDays: mActive, mins: Math.floor(mSecs / 60), secs: mSecs, words: mWords, score: mScore, tip });
      }
      const maxScore = Math.max(12, ...months.map(x => x.score));
      const activeYearDays = months.reduce((a, b) => a + b.activeDays, 0);
      const totalYearMins = Math.floor(months.reduce((a, b) => a + b.secs, 0) / 60);

      const yearAxis = `<div class="streak-axis-row is-year">${months.map(m => `<span class="${m.isToday ? 'is-today' : ''}">${m.label}</span>`).join('')}</div>`;
      chartEl.innerHTML = buildStreakLineChartHtml(months, maxScore, 'year', yearAxis);

      if (summaryLabelEl) summaryLabelEl.textContent = `Năm ${yr}:`;
      if (summaryEl) summaryEl.textContent = `${activeYearDays} ngày · ${formatMinutesCompact(totalYearMins)}`;
    }
  }

  /* =========================================================
     SCOPE & FLASHCARD CORE
     ========================================================= */
  function populateScopeSelect() {
    const sel = document.getElementById('study-scope-select');
    if (!sel) return;
    // Partner/Restricted class: remove ALL proprietary vocab lists -> keep ONLY MY LIST + 1 Demo starter list
    if (!isProprietaryVocabAllowed()) {
      let rHtml = '';
      const mvDecks = (window.MyVocabStore && typeof window.MyVocabStore.getDecks === 'function')
        ? (window.MyVocabStore.getDecks() || [])
        : [];
      if (mvDecks.length > 0) {
        rHtml += `<optgroup label="MY LIST (Tự thêm từ Reading / Listening)">${mvDecks.map((d) => {
          const sk = window.MyVocabStore.getScopeKey(d.id);
          const cnt = Array.isArray(d.words) ? d.words.length : 0;
          return `<option value="${escapeHtml(sk)}">${escapeHtml(d.name)} (${cnt} từ)</option>`;
        }).join('')}</optgroup>`;
      }
      rHtml += `<optgroup label="Bộ Demo Trải Nghiệm"><option value="${DEMO_SCOPE.key}">${escapeHtml(DEMO_SCOPE.name)}</option></optgroup>`;
      sel.innerHTML = rHtml;
      if (Array.from(sel.options).some((o) => o.value === currentScopeKey)) {
        sel.value = currentScopeKey;
      } else {
        const firstNonEmpty = mvDecks.find((d) => Array.isArray(d.words) && d.words.length > 0);
        currentScopeKey = firstNonEmpty ? window.MyVocabStore.getScopeKey(firstNonEmpty.id) : DEMO_SCOPE.key;
        sel.value = currentScopeKey;
      }
      window.TotoroUI?.syncScopeDropdown?.();
      return;
    }
    if (isListeningSkillActive() && window.APP_LISTENING_VOCAB) {
      let lHtml = LISTENING_SCOPES.map(it =>
        `<option value="${escapeHtml(it.key)}">${escapeHtml(it.name)}</option>`
      ).join('');
      if (activeListeningTaskScope) {
        lHtml = `<option value="${escapeHtml(activeListeningTaskScope.key)}">${escapeHtml(activeListeningTaskScope.name)}</option>` + lHtml;
      }
      if (window.MyVocabStore && !isTeacherUser()) {
        const mvDecks = window.MyVocabStore.getDecks() || [];
        if (mvDecks.length > 0) {
          lHtml += `<optgroup label="MY LIST">${mvDecks.map((d) => {
            const sk = window.MyVocabStore.getScopeKey(d.id);
            return `<option value="${escapeHtml(sk)}">${escapeHtml(d.name)}</option>`;
          }).join('')}</optgroup>`;
        }
      }
      sel.innerHTML = lHtml;
      if (Array.from(sel.options).some((o) => o.value === currentScopeKey)) {
        sel.value = currentScopeKey;
      } else {
        sel.value = LISTENING_SCOPES[0].key;
      }
      window.TotoroUI?.syncScopeDropdown?.();
      return;
    }
    const isTaskActive = Boolean(
      isTaskScopeKey(currentScopeKey) ||
      (window.TasksModule?.getActiveTask?.()) ||
      (dynamicTaskScopes.length > 0 && isTaskScopeKey(currentScopeKey))
    );
    if (isTaskActive) {
      // Khi đang trong chế độ Task: BỎ HẾT các bộ từ mặc định (Nền tảng, Học thuật, Paraphrase, Chuyên sâu, Từ nối)
      // CHỈ hiển thị duy nhất các Task được giao hoặc Task hiện tại!
      let taskOptions = dynamicTaskScopes;
      if (taskOptions.length === 0 && isTaskScopeKey(currentScopeKey)) {
        const activeDef = getScopeDef(currentScopeKey);
        if (activeDef && activeDef.isTask) taskOptions = [activeDef];
      }
      if (taskOptions.length === 0 && window.TasksModule?.getAllTasks) {
        taskOptions = window.TasksModule.getAllTasks().map(t => ({
          key: t.id,
          name: `${t.label}: ${t.theme}`,
          isTask: true,
          getList: () => resolveTaskItems(t),
        }));
      }
      sel.innerHTML = taskOptions.map(it =>
        `<option value="${escapeHtml(it.key)}">${escapeHtml(it.name)}</option>`
      ).join('');
      sel.value = taskOptions.some(s => s.key === currentScopeKey) ? currentScopeKey : (taskOptions[0]?.key || currentScopeKey);
      window.TotoroUI?.syncScopeDropdown?.();
      return;
    }
    let html = SCOPES.map(it =>
      `<option value="${it.key}">${escapeHtml(it.name)}</option>`
    ).join('');
    if (window.MyVocabStore && !isTeacherUser()) {
      const mvDecks = window.MyVocabStore.getDecks() || [];
      if (mvDecks.length > 0) {
        html += `<optgroup label="MY LIST">${mvDecks.map((d) => {
          const sk = window.MyVocabStore.getScopeKey(d.id);
          return `<option value="${escapeHtml(sk)}">${escapeHtml(d.name)}</option>`;
        }).join('')}</optgroup>`;
      }
    }
    if (dynamicTaskScopes.length > 0) {
      html += `<optgroup label="Bộ từ Task được giao">${dynamicTaskScopes.map(it =>
        `<option value="${escapeHtml(it.key)}">${escapeHtml(it.name)}</option>`
      ).join('')}</optgroup>`;
    }
    if (customReviewState && currentScopeKey === REVIEW_OLD_SCOPE_KEY) {
      html = `<option value="${REVIEW_OLD_SCOPE_KEY}">${escapeHtml(customReviewState.title || 'Ôn tập từ vựng cũ')}</option>` + html;
    }
    sel.innerHTML = html;
    if (customReviewState && currentScopeKey === REVIEW_OLD_SCOPE_KEY) {
      sel.value = REVIEW_OLD_SCOPE_KEY;
    } else if (isMyVocabScopeKey(currentScopeKey) && Array.from(sel.options).some((o) => o.value === currentScopeKey)) {
      sel.value = currentScopeKey;
    } else {
      sel.value = getAllScopes().some(s => s.key === currentScopeKey) ? currentScopeKey : SCOPES[0].key;
    }
    window.TotoroUI?.syncScopeDropdown?.();
  }

  function applyFilterAndBuildDeck(preserveWordId = null, options = {}) {
    const def = getScopeDef(currentScopeKey);
    fullScopeList = [...def.getList()];
    const sigBtn = document.getElementById('btn-top-signalwords');
    if (sigBtn) sigBtn.style.display = currentScopeKey === 'signal_words' ? 'inline-flex' : 'none';

    if (onlyDueReview) {
      const now = Date.now();
      currentScopeList = fullScopeList
        .filter(x => isWordDueNow(x, now))
        .sort((a, b) => (srsData[a.id]?.dueAt || 0) - (srsData[b.id]?.dueAt || 0));
    } else if (onlyUnmastered) {
      currentScopeList = fullScopeList.filter(x => assessments[x.id] !== 3);
    } else {
      currentScopeList = [...fullScopeList];
    }

    const filterBtn = document.getElementById('btn-filter-unmastered');
    if (filterBtn) filterBtn.classList.toggle('is-active', onlyUnmastered);
    const dueBtn = document.getElementById('btn-filter-due');
    if (dueBtn) dueBtn.classList.toggle('is-active', onlyDueReview);

    const targetId = preserveWordId || scopePositions[currentScopeKey];
    if (targetId && currentScopeList.length > 0 && !onlyDueReview) {
      const foundIdx = currentScopeList.findIndex(x => x.id === targetId);
      currentCardIndex = foundIdx !== -1 ? foundIdx : 0;
    } else {
      currentCardIndex = 0;
    }

    updateVocabMasteryUI();
    renderCurrentCard(0, options);
  }

  function loadScope(scopeKey) {
    const nextDef = getScopeDef(scopeKey);
    if (window.TasksModule?.getExamState?.()?.active && nextDef.key !== currentScopeKey) {
      const sel = document.getElementById('study-scope-select');
      if (sel) sel.value = currentScopeKey;
      showToast('Đang làm bài Test — không thể đổi bộ từ lúc này!');
      return false;
    }
    if (isTaskScopeKey(nextDef.key) && window.TasksModule?.canActivateTaskScope && !window.TasksModule.canActivateTaskScope(nextDef.key)) {
      populateScopeSelect();
      const sel = document.getElementById('study-scope-select');
      if (sel) sel.value = currentScopeKey;
      return false;
    }
    cancelPendingAdvance();
    currentScopeKey = nextDef.key;
    if (isListeningScopeKey(currentScopeKey)) {
      if (!/^ltask_/i.test(currentScopeKey)) lastListeningScopeKey = currentScopeKey;
    } else if (!isTaskScopeKey(currentScopeKey) && !isMyVocabScopeKey(currentScopeKey) && currentScopeKey !== REVIEW_OLD_SCOPE_KEY) {
      lastReadingScopeKey = currentScopeKey;
    }
    populateScopeSelect();
    const sel = document.getElementById('study-scope-select');
    if (sel) sel.value = currentScopeKey;
    window.TotoroUI?.syncScopeDropdown?.();
    window.TasksModule?.onScopeChanged?.(currentScopeKey);
    window.RecognitionTestModule?.updateScopeListTestButton?.();
    applyFilterAndBuildDeck();
    saveState();
    return true;
  }

  function onScopeChange() {
    const sel = document.getElementById('study-scope-select');
    if (sel) loadScope(sel.value);
  }

  function getIPA(item) {
    if (!item) return '/.../';
    if (item.ipa) return item.ipa;
    const w = (item.lemma || '').toLowerCase().trim();
    return IPA_DICT[w] || '/.../';
  }

  function splitCoreMeaning(rawDef) {
    const txt = String(rawDef || '').trim();
    if (!txt) return { core: '(Chưa có nghĩa)', note: '' };
    let depth = 0;
    for (let i = 0; i < txt.length - 1; i++) {
      const ch = txt[i];
      if (ch === '(') depth++;
      else if (ch === ')' && depth > 0) depth--;
      else if ((ch === '.' || ch === '!') && depth === 0 && txt[i + 1] === ' ') {
        const head = txt.slice(0, i).trim();
        const rest = txt.slice(i + 2).trim();
        return { core: head, note: rest };
      }
    }
    return { core: txt, note: '' };
  }

  function formatShortPos(posRaw) {
    const p = String(posRaw || '').trim();
    if (!p) return 'Từ vựng';
    const low = p.toLowerCase();
    if (low === 'n' || low === 'noun' || /DANH TỪ/i.test(p)) return 'Danh từ';
    if (low === 'v' || low === 'verb' || /ĐỘNG TỪ/i.test(p)) return 'Động từ';
    if (low === 'a' || low === 'adj' || low === 'adjective' || /TÍNH TỪ/i.test(p)) return 'Tính từ';
    if (low === 'r' || low === 'adv' || low === 'adverb' || /TRẠNG TỪ/i.test(p)) return 'Trạng từ';
    if (low === 'cue' || /SIGNAL WORD/i.test(p)) return 'Tín hiệu';
    if (/HỌ TỪ #(\d+)/i.test(p)) return p.replace(/HỌ TỪ #(\d+)/i, 'Họ từ #$1');
    return p.replace(/\s*\([^)]*\)/g, '');
  }

  function formatShortFreq(item) {
    if (!item) return '';
    if (item.doc_freq && item.cum_cov_all) {
      return `${item.doc_freq} đề · Phủ ${item.cum_cov_all}%`;
    }
    if (item.passage_coverage) {
      return `Phủ ${item.passage_coverage}% bài đọc`;
    }
    const m = String(item.stats_text || '').match(/(\d+\s*đề)\s*\|\s*Q:\s*(\d+)/i);
    if (m) return `${m[1]} · Hỏi ${m[2]} lần`;
    return '';
  }

  function splitCsvItems(raw) {
    return String(raw || '')
      .split(/[,;]+/)
      .map(s => s.trim())
      .filter(Boolean);
  }

  function getNonTrivialForms(wordForms, lemma) {
    const base = String(lemma || '').toLowerCase().trim();
    const trivial = new Set([base, base + 's', base + 'es', base + 'ed', base + 'ing']);
    const list = splitCsvItems(wordForms).filter(w => !trivial.has(w.toLowerCase()));
    return list.slice(0, 4);
  }

  function cleanSynonyms(rawSyn) {
    let s = String(rawSyn || '').trim();
    if (!s) return '';
    const tildeMatch = s.match(/\(\s*~\s*([^)]+)\)/);
    if (tildeMatch) s = tildeMatch[1].trim();
    const dashIdx = s.indexOf(' — ');
    if (dashIdx !== -1) s = s.slice(0, dashIdx).trim();
    return s;
  }

  function cleanAntonyms(rawAnt) {
    let s = String(rawAnt || '').trim();
    if (!s || s.startsWith('Không có')) return '';
    s = s.replace(/\s*\([^)]{12,}\)\s*$/g, '').trim();
    return s;
  }

  function getCleanPos(item) {
    return item?.clean_pos || formatShortPos(item?.pos);
  }

  function getCleanMeaning(item) {
    return item?.clean_meaning || splitCoreMeaning(item?.definition).core;
  }

  function getEnrichedSynonyms(item) {
    // Strictly test ONLY synonyms that actually exist on this card's own data (never ambush with hidden cross-skill data)
    return getCleanSynonyms(item);
  }

  function getEnrichedAntonyms(item) {
    // Strictly test ONLY antonyms that actually exist on this card's own data
    return getCleanAntonyms(item);
  }

  function getCleanSynonyms(item) {
    if (Array.isArray(item?.clean_synonyms)) return item.clean_synonyms;
    return splitCsvItems(cleanSynonyms(item?.synonyms));
  }

  function getCleanAntonyms(item) {
    if (Array.isArray(item?.clean_antonyms)) return item.clean_antonyms;
    return splitCsvItems(cleanAntonyms(item?.antonyms));
  }

  function getCleanForms(item) {
    const raw = Array.isArray(item?.clean_forms)
      ? item.clean_forms
      : getNonTrivialForms(item?.word_forms, item?.lemma);
    const lemmaParts = new Set(
      String(item?.lemma || '')
        .split('/')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    );
    const seen = new Set();
    const out = [];
    for (const f of (raw || [])) {
      const clean = String(f || '').trim();
      const low = clean.toLowerCase();
      if (!clean || lemmaParts.has(low) || seen.has(low)) continue;
      seen.add(low);
      out.push(clean);
    }
    return out;
  }

  function hasListeningTip(item) {
    if (!item || !isListeningSkillActive()) return false;
    return Boolean(item.homophone_trap || item.spelling_trap || item.strategy);
  }

  function hasReadingTip(item) {
    if (!item) return false;
    if (isListeningSkillActive()) return hasListeningTip(item);
    const qa = item.qa_example;
    if (qa && qa.question && qa.passage && qa.q_term && qa.p_term) {
      return qa.q_term.toLowerCase() !== qa.p_term.toLowerCase();
    }
    return Boolean(item.strategy && qa && qa.question && qa.passage);
  }

  function splitSentencesBalanced(text) {
    const txt = String(text || '').trim();
    if (!txt) return [];
    const out = [];
    let start = 0;
    let depth = 0;
    for (let i = 0; i < txt.length - 1; i++) {
      const ch = txt[i];
      if (ch === '(') depth++;
      else if (ch === ')' && depth > 0) depth--;
      else if ((ch === '.' || ch === '!' || ch === ';') && depth === 0 && txt[i + 1] === ' ') {
        const piece = txt.slice(start, i + (ch === '!' ? 1 : 0)).trim();
        if (piece) out.push(piece);
        start = i + 2;
      }
    }
    const tail = txt.slice(start).trim().replace(/\.$/, '');
    if (tail) out.push(tail);
    return out;
  }

  function highlightInlineTerms(text) {
    const safe = escapeHtml(text);
    return safe.replace(/&#39;([^&#]+)&#39;/g, '<code>$1</code>');
  }

  function formatSentenceHighlight(sentence, word) {
    const cleaned = String(sentence || '')
      .replace(/\s+([.,!?;:])/g, '$1')
      .replace(/([”"'])\s+([.,!?;:])/g, '$1$2');
    const safe = escapeHtml(cleaned);
    const term = String(word || '').trim();
    if (!term) return safe;
    const suffix = /\s/.test(term) ? '' : '[a-z]*';
    const re = new RegExp(`(\\b${escapeRegExp(term)}${suffix}\\b)`, 'ig');
    return safe.replace(re, '<span class="fc-target-mark">$1</span>');
  }

  function renderStatusTag(elemId, lvl) {
    const el = document.getElementById(elemId);
    if (!el) return;
    el.className = 'fc-status-tag';
    if (lvl === 1) {
      el.classList.add('fc-status-unremembered');
      el.textContent = '• Chưa nhớ';
    } else if (lvl === 2) {
      el.classList.add('fc-status-slow');
      el.textContent = '• Nhớ chậm';
    } else if (lvl === 3) {
      el.classList.add('fc-status-mastered');
      el.textContent = '✓ Đã thuộc';
    } else {
      el.textContent = '';
    }
  }

  function cancelPendingAdvance() {
    if (advanceTimeout) {
      clearTimeout(advanceTimeout);
      advanceTimeout = null;
    }
    isAdvancing = false;
    document.getElementById('fc-scene')?.classList.remove('assess-out-1', 'assess-out-2', 'assess-out-3');
  }

  function toggleListeningFrontReveal(event) {
    if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
    const frontFace = document.querySelector('#fc-card .fc-face-front');
    if (!frontFace) return;
    const revealed = frontFace.classList.toggle('is-listening-revealed');
    const txtEl = document.getElementById('fc-l-reveal-txt');
    if (txtEl) txtEl.textContent = revealed ? 'Ẩn chữ' : 'Hé chữ';
  }

  function renderCurrentCard(direction = 0, options = {}) {
    cancelPendingAdvance();
    if (cardStepOutTimer) {
      clearTimeout(cardStepOutTimer);
      cardStepOutTimer = null;
      pendingCardStep = 0;
    }
    if (cardStepInTimer) {
      clearTimeout(cardStepInTimer);
      cardStepInTimer = null;
    }
    document.getElementById('fc-motion-wrap')?.classList.remove('out-next', 'in-next', 'out-prev', 'in-prev');
    const scene = document.getElementById('fc-scene');
    scene?.classList.remove('shifting');
    const card = document.getElementById('fc-card');
    const finishedBox = document.getElementById('fc-finished-box');
    const progressText = document.getElementById('study-progress-text');
    const progressBar = document.getElementById('card-progress-fill');

    if (currentScopeList.length === 0 || currentCardIndex >= currentScopeList.length) {
      stopSpeechPlayback();
      if (scene) scene.style.display = 'none';
      if (finishedBox) finishedBox.style.display = 'flex';
      if (progressText) progressText.textContent = `${currentScopeList.length} / ${currentScopeList.length}`;
      if (progressBar) progressBar.style.width = '100%';
      const btnPrev = document.getElementById('btn-prev-card');
      if (btnPrev) btnPrev.disabled = (currentCardIndex <= 0);
      const finExamBtn = document.getElementById('btn-finished-task-exam');
      if (finExamBtn) finExamBtn.style.display = (isTaskScopeKey(currentScopeKey) || /^ltask_/i.test(currentScopeKey)) ? 'inline-flex' : 'none';
      const finMvBtn = document.getElementById('btn-finished-myvocab-add');
      const isEmptyMyVocab = isMyVocabScopeKey(currentScopeKey) && fullScopeList.length === 0;
      if (finMvBtn) finMvBtn.style.display = isEmptyMyVocab ? 'inline-flex' : 'none';
      const finTitle = finishedBox?.querySelector('.fc-finished-title');
      const finDesc = finishedBox?.querySelector('.fc-finished-desc');
      if (finTitle && finDesc) {
        if (isEmptyMyVocab) {
          finTitle.textContent = 'MY LIST đang trống';
          finDesc.textContent = 'Thêm từng từ hoặc Import danh sách từ vựng cá nhân để luyện Flashcard.';
        } else {
          finTitle.textContent = 'Bạn đã hoàn thành lượt thẻ này!';
          finDesc.textContent = 'Tất cả các thẻ trong danh sách đã được bạn xem qua. Bạn có thể ôn lại từ đầu hoặc lọc riêng các từ chưa thuộc.';
        }
      }
      window.TasksModule?.updateTaskStudyBar?.();
      return;
    }
    const finExamBtn = document.getElementById('btn-finished-task-exam');
    if (finExamBtn) finExamBtn.style.display = 'none';
    const finMvBtn = document.getElementById('btn-finished-myvocab-add');
    if (finMvBtn) finMvBtn.style.display = 'none';
    window.TasksModule?.updateTaskStudyBar?.();

    scene.style.display = 'block';
    finishedBox.style.display = 'none';
    const backScrollEl = document.querySelector('#fc-card .fc-back-scrollable');
    if (backScrollEl) backScrollEl.scrollTop = 0;

    const item = currentScopeList[currentCardIndex];
    const total = currentScopeList.length;
    progressText.textContent = `${currentCardIndex + 1} / ${total}`;
    if (progressBar) {
      progressBar.style.width = `${Math.round(((currentCardIndex + 1) / total) * 100)}%`;
    }

    isCardFlipped = false;
    card.classList.remove('flipped');
    document.getElementById('btn-flip-action').textContent = 'Xem nghĩa';

    const ipaText = getIPA(item);
    const posLabel = getCleanPos(item);

    // Mặt trước (Tối giản: chỉ POS + Từ + IPA + UK/US; riêng Listening ẩn chữ mặc định + hiện audio stage & cảnh báo bẫy)
    const frontFaceEl = document.querySelector('#fc-card .fc-face-front');
    if (frontFaceEl) frontFaceEl.classList.remove('is-listening-revealed');
    document.getElementById('fc-scene')?.classList.remove('is-3d-flipping');
    const lSlotsEl = document.getElementById('fc-l-letter-slots');
    if (lSlotsEl) {
      const rawLemma = String(item.lemma || '').trim().split(/\s*\/\s*/)[0].trim();
      const letterCount = rawLemma.replace(/[^a-zA-Z0-9]/g, '').length;
      lSlotsEl.classList.toggle('is-compact', letterCount >= 11);
      lSlotsEl.classList.toggle('is-ultra-compact', letterCount >= 16);
      const words = rawLemma.split(/\s+/).filter(Boolean);
      lSlotsEl.innerHTML = words.map((w) => {
        const chars = Array.from(w).map((ch) => {
          if (/[a-zA-Z0-9]/.test(ch)) return '<span class="fc-l-slot"></span>';
          if (ch === '-' || ch === "'") return `<span class="fc-l-slot-punct">${escapeHtml(ch)}</span>`;
          return '';
        }).join('');
        return `<span class="fc-l-slot-word">${chars}</span>`;
      }).join('');
    }
    const lStageEl = document.getElementById('fc-listening-front-stage');
    if (lStageEl) lStageEl.classList.remove('is-speaking');

    document.getElementById('fc-front-pos').textContent = posLabel;
    const frontWordEl = document.getElementById('fc-front-word');
    if (frontWordEl) {
      frontWordEl.textContent = item.lemma;
      frontWordEl.classList.toggle('is-long-word', String(item.lemma || '').length >= 13);
    }
    document.getElementById('fc-front-ipa').textContent = ipaText;

    const sentence = (item.exam_citations && item.exam_citations[0]?.sentence) || item.example || '';
    const frontSent = document.getElementById('fc-front-sentence');
    if (frontSent) {
      if (showFrontContext && sentence) {
        frontSent.innerHTML = formatSentenceHighlight(sentence, item.lemma);
        frontSent.style.display = 'block';
      } else {
        frontSent.style.display = 'none';
        frontSent.innerHTML = '';
      }
    }

    // Mặt sau (Nghĩa gọn + 2 cột chip + 1 câu ví dụ + Nút READING TIP)
    const coreMeaning = getCleanMeaning(item);
    const synChips = getCleanSynonyms(item);
    const antChips = getCleanAntonyms(item);
    const formChips = getCleanForms(item);

    document.getElementById('fc-back-pos').textContent = posLabel;
    document.getElementById('fc-back-word').textContent = item.lemma;
    document.getElementById('fc-back-ipa').textContent = ipaText;
    document.getElementById('fc-back-meaning').textContent = coreMeaning;

    const tipBtn = document.getElementById('btn-reading-tip');
    if (tipBtn) {
      tipBtn.textContent = isListeningSkillActive() ? 'LISTENING TIP' : 'READING TIP';
      tipBtn.style.display = hasReadingTip(item) ? 'inline-flex' : 'none';
    }

    const pairsGrid = document.getElementById('fc-back-pairs');
    const pairCards = [];
    if (item.strategy) {
      if (item.direction) {
        pairCards.push(`
          <div class="fc-pair-card">
            <div class="fc-pair-label">Hướng nghĩa</div>
            <div class="fc-chip-wrap"><span class="fc-chip">${escapeHtml(item.direction)}</span></div>
          </div>
        `);
      }
      const equList = splitCsvItems(item.word_forms);
      if (equList.length > 0) {
        pairCards.push(`
          <div class="fc-pair-card">
            <div class="fc-pair-label">Từ nối tương đương</div>
            <div class="fc-chip-wrap">${equList.map(w => `<span class="fc-chip">${escapeHtml(w)}</span>`).join('')}</div>
          </div>
        `);
      }
    } else {
      if (synChips.length > 0) {
        pairCards.push(`
          <div class="fc-pair-card">
            <div class="fc-pair-label">Synonyms</div>
            <div class="fc-chip-wrap">${synChips.map(w => `<span class="fc-chip">${escapeHtml(w)}</span>`).join('')}</div>
          </div>
        `);
      }
      if (antChips.length > 0) {
        pairCards.push(`
          <div class="fc-pair-card trap">
            <div class="fc-pair-label">Trái nghĩa</div>
            <div class="fc-chip-wrap">${antChips.map(w => `<span class="fc-chip">${escapeHtml(w)}</span>`).join('')}</div>
          </div>
        `);
      } else if (formChips.length > 0) {
        pairCards.push(`
          <div class="fc-pair-card">
            <div class="fc-pair-label">Word Family</div>
            <div class="fc-chip-wrap">${formChips.map(w => `<span class="fc-chip">${escapeHtml(w)}</span>`).join('')}</div>
          </div>
        `);
      }
    }
    pairsGrid.className = pairCards.length === 1 ? 'fc-pairs-grid single-col' : 'fc-pairs-grid';
    pairsGrid.innerHTML = pairCards.join('');

    const backSent = document.getElementById('fc-back-sentence');
    const backDisplaySent = sentence || item.qa_example?.question || '';
    const backHighlightTerm = sentence ? item.lemma : (item.qa_example?.q_term || item.lemma);
    if (backSent) {
      if (backDisplaySent) {
        backSent.innerHTML = formatSentenceHighlight(backDisplaySent, backHighlightTerm);
        backSent.style.display = 'block';
      } else {
        backSent.style.display = 'none';
        backSent.innerHTML = '';
      }
    }

    const lvl = assessments[item.id];
    renderStatusTag('fc-front-status', lvl);
    renderStatusTag('fc-back-status', lvl);

    const ivl1 = document.getElementById('ivl-tag-1');
    const ivl2 = document.getElementById('ivl-tag-2');
    const ivl3 = document.getElementById('ivl-tag-3');
    if (ivl1) ivl1.textContent = formatAnkiIntervalLabel(item.id, 1);
    if (ivl2) ivl2.textContent = formatAnkiIntervalLabel(item.id, 2);
    if (ivl3) ivl3.textContent = formatAnkiIntervalLabel(item.id, 3);

    document.getElementById('btn-prev-card').disabled = (currentCardIndex === 0);
    updateAssess3CooldownUI();
    updateAutoSpeakUI();
    saveState();

    if (direction) window.IELTSMotion?.enterCard(direction);

    const { speak = true } = options;
    if (speak && autoSpeak && !isCardFlipped) {
      pendingInitialSpeak = false;
      speakCurrentWord('en-US', null, 'auto');
    }
  }

  function expandPlainVietnamese(text) {
    return String(text || '')
      .replace(/(?<!\()\bMatching Features\b(?!\))/gi, 'dạng nối tên người (Matching Features)')
      .replace(/\bT\/F\/NG\b/g, 'True / False / Not Given')
      .replace(/\bQ&A\b/g, 'câu hỏi & đáp án')
      .replace(/(?<!\()\bSummary\b(?!\))/gi, 'tóm tắt (Summary)')
      .replace(/\bAWL\b/g, 'từ vựng học thuật');
  }

  function capitalizeViSentence(str) {
    const s = String(str || '').trim();
    if (!s) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function enrichTrapOutcomeVi(str) {
    const s = String(str || '').trim();
    if (!s) return '';
    if (/(chọn\s+(?:TRUE|FALSE|NOT GIVEN)|FALSE|NOT GIVEN)/i.test(s) && /chọn|đáp án/i.test(s)) {
      return s;
    }
    if (/(phóng đại|khẳng định chắc chắn|tuyệt đối|extreme claim)/i.test(s)) {
      return s.replace(/\.$/, '') + ' → Nếu bài đọc nói mức độ nhẹ hơn, chọn FALSE; nếu không nhắc tới mức độ, chọn NOT GIVEN.';
    }
    if (/(bỏ qua tiền tố|đối lập|ngược nghĩa|trái ngược|không phải)/i.test(s)) {
      return s.replace(/\.$/, '') + ' → Nếu hai vế trái ngược nhau, chọn FALSE.';
    }
    return s;
  }

  function cleanExtractedExampleText(raw) {
    let s = String(raw || '').trim();
    s = s.replace(/^(?:ví dụ|như|gồm|cụ thể)\s*:?\s*/i, '').trim();
    // Chuyển danh sách tiếng Anh không dấu nháy hoặc có dấu nháy về dạng sạch, không đóng ngoặc
    return s.replace(/\s+hay\s+/gi, ', ').replace(/\s+hoặc\s+/gi, ', ');
  }

  function formatTipBulletItem(rawSentence) {
    const expanded = expandPlainVietnamese(rawSentence)
      .replace(/^(?:MẸO ĐOÁN NGHĨA|Bẫy đa nghĩa|Bẫy Paraphrase|Bẫy Summary|Bẫy T\/F\/NG(?: cực hay gặp| kinh điển)?|Bẫy True \/ False \/ Not Given(?: cực hay gặp| kinh điển)?|Bẫy Q&A|Lưu ý):\s*/i, '')
      .trim();
    if (!expanded) return '';

    const exampleLines = [];
    const mainClean = expanded.replace(/\(([^()]{3,})\)/g, (full, inner) => {
      const trimmed = inner.trim();
      const isExample = /^(?:ví dụ|như|gồm|cụ thể)\b/i.test(trimmed) || /'[^']+'/.test(trimmed) || /^[A-Za-z0-9\s,'-]+$/.test(trimmed);
      if (isExample) {
        const cleanedEx = cleanExtractedExampleText(trimmed);
        if (cleanedEx) exampleLines.push(cleanedEx);
        return '';
      }
      return full;
    }).replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();

    if (!mainClean) return '';
    const enriched = enrichTrapOutcomeVi(capitalizeViSentence(mainClean));
    const exHtml = exampleLines.map(ex => `<div class="tip-sub-example">Ví dụ: ${highlightInlineTerms(ex)}</div>`).join('');
    return `<div>${highlightInlineTerms(enriched)}</div>${exHtml}`;
  }

  function formatAnswerNoteBullets(note, hasKeywordTable) {
    let txt = String(note || '').trim();
    if (!txt) return [];
    if (hasKeywordTable) {
      txt = txt.replace(/^Cặp đổi từ:\s*[^.!?]+[.!?]\s*/i, '').trim();
    }
    if (!txt) return [];
    const m = txt.match(/^(TRUE|FALSE|NOT GIVEN|YES|NO)\s*·\s*(.+)$/i);
    if (m) {
      return [`<span class="tip-answer-badge">${escapeHtml(m[1].toUpperCase())}</span>${highlightInlineTerms(capitalizeViSentence(m[2]))}`];
    }
    return splitSentencesBalanced(txt).map(s => formatTipBulletItem(s)).filter(Boolean);
  }

  function shuffleArrayCopy(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildReadingTipParts(item) {
    const qa = item.qa_example || null;
    const synChips = getCleanSynonyms(item);
    const antChips = getCleanAntonyms(item);
    const formChips = getCleanForms(item);

    // CỘT 1: EXAMPLE
    const leftParts = [];
    let examSourceBadge = '';
    if (qa && qa.question && qa.passage) {
      const qaSrc = qa.qa_source || (qa.exam_title && qa.exam_title !== '617 đề IELTS Academic Reading' ? 'real_exam' : 'ielts_model');
      if (qaSrc === 'real_exam' && qa.exam_title) {
        examSourceBadge = ` <span style="font-weight:600; color:var(--accent); text-transform:none; letter-spacing:0;">· Đề thật: ${escapeHtml(qa.exam_title)}</span>`;
      } else if (qaSrc === 'real_passage') {
        examSourceBadge = ` <span style="font-weight:500; color:var(--text-muted); text-transform:none; letter-spacing:0;">· Trích bài đọc thật (617 đề)</span>`;
      } else {
        examSourceBadge = ` <span style="font-weight:500; color:var(--text-muted); text-transform:none; letter-spacing:0;">· Mô phỏng IELTS Reading</span>`;
      }
    }
    leftParts.push(`<div class="tip-col-heading tip-exam-title-bar">EXAMPLE${examSourceBadge}</div>`);

    if (qa && qa.question && qa.passage) {
      leftParts.push(`
        <div class="tip-qa-block">
          <div class="tip-qa-label">1. Câu hỏi</div>
          <div class="tip-qa-en">${formatSentenceHighlight(qa.question, qa.q_term || item.lemma)}</div>
          ${qa.q_vi ? `<div class="tip-qa-vi">Tạm dịch: ${escapeHtml(qa.q_vi)}</div>` : ''}
        </div>
      `);
      const passageHtml = formatSentenceHighlight(qa.passage, qa.p_term || item.lemma);
      leftParts.push(`
        <div class="tip-qa-block passage">
          <div class="tip-qa-label">2. Đoạn trích bài đọc</div>
          <div class="tip-qa-en">${passageHtml}</div>
          ${qa.p_vi ? `<div class="tip-qa-vi">Tạm dịch: ${escapeHtml(qa.p_vi)}</div>` : ''}
        </div>
      `);
    } else {
      const cit = (item.exam_citations || []).find(c => c && c.sentence);
      const fallbackText = cit?.sentence || item.example || '';
      if (fallbackText) {
        leftParts.push(`
          <div class="tip-qa-block passage">
            <div class="tip-qa-label">Đoạn trích bài đọc</div>
            <div class="tip-qa-en">${formatSentenceHighlight(fallbackText, item.lemma)}</div>
          </div>
        `);
      }
    }

    // CỘT 2: GIẢI THÍCH & CÁCH ĐỔI TỪ (Không lặp lại nghĩa tiếng Việt)
    const rightParts = [];
    rightParts.push('<div class="tip-col-heading">GIẢI THÍCH &amp; CÁCH ĐỔI TỪ</div>');

    const qMain = (qa && qa.q_term) ? qa.q_term : item.lemma;
    const altPool = item.strategy ? splitCsvItems(item.word_forms) : (synChips.length > 0 ? synChips : formChips);
    const pPrimary = (qa && qa.p_term) ? qa.p_term : (altPool[0] || '');
    const pAlts = altPool.filter(w =>
      w.toLowerCase() !== pPrimary.toLowerCase() && w.toLowerCase() !== qMain.toLowerCase()
    ).slice(0, 3);

    const hasKeywordTable = Boolean(pPrimary);
    if (hasKeywordTable) {
      rightParts.push(`
        <div class="tip-kw-box">
          <div class="tip-qa-label" style="margin-bottom:0;">1. Keyword Table</div>
          <div class="tip-kw-grid">
            <div class="tip-kw-col">
              <div class="tip-kw-col-head">Câu hỏi dùng</div>
              <div class="tip-kw-main">${escapeHtml(qMain)}</div>
            </div>
            <div class="tip-kw-arrow">⇄</div>
            <div class="tip-kw-col">
              <div class="tip-kw-col-head">Bài đọc đổi thành</div>
              <div class="tip-kw-main">${escapeHtml(pPrimary)}</div>
              ${pAlts.length > 0 ? `<div class="tip-kw-alts">${pAlts.map(w => `<span class="fc-chip">${escapeHtml(w)}</span>`).join('')}</div>` : ''}
            </div>
          </div>
        </div>
      `);
    }

    const noteBullets = [];
    if (qa?.answer_note) {
      formatAnswerNoteBullets(qa.answer_note, hasKeywordTable).forEach(b => {
        if (b && !noteBullets.includes(b)) noteBullets.push(b);
      });
    }

    const rawTip = String(item.tip_note || item.strategy || '').trim();
    if (rawTip) {
      splitSentencesBalanced(rawTip).forEach(sent => {
        const formatted = formatTipBulletItem(sent);
        if (formatted && !noteBullets.includes(formatted)) noteBullets.push(formatted);
      });
    }

    if (noteBullets.length === 0 && antChips.length > 0) {
      noteBullets.push(
        `Chú ý hướng trái nghĩa: bài đọc dùng ${antChips.slice(0, 3).map(w => `<code>${escapeHtml(w)}</code>`).join(', ')} → Nếu trái nghĩa với câu hỏi, chọn FALSE.`
      );
    }

    if (noteBullets.length > 0) {
      const hasTrapTone = Boolean(qa?.answer_note) || /(bẫy|true \/ false|false|not given|trái nghĩa|không phải|nhầm|phóng đại)/i.test(rawTip);
      rightParts.push(`
        <div class="tip-section ${hasTrapTone ? 'trap' : ''}">
          <div class="tip-section-title">2. Điểm lưu ý &amp; Bẫy riêng của từ này</div>
          <ul class="tip-bullets">${noteBullets.map(b => `<li>${b}</li>`).join('')}</ul>
        </div>
      `);
    }

    return { leftParts, rightParts };
  }

  function highlightWordTrapParts(word, trapStr) {
    const raw = String(word || '').trim();
    if (!raw) return '';
    const t = String(trapStr || '');
    const patterns = [];

    // 1. Exact double letters (e.g. cc, mm, ss, ll, rr, pp, tt, nn, ff, gg, dd, oo, ee)
    if (/chữ đôi/i.test(t)) {
      const m = raw.match(/([a-z])\1/gi);
      if (m) m.forEach((p) => patterns.push(p));
    }
    // 2. Tricky vowel clusters (au, ei, ie, eu, ou, ue, ai, oa, ea, ui, eo, ia)
    if (/nguyên âm/i.test(t)) {
      const m = raw.match(/(au|ei|ie|eu|ue|eo|ui|ou|oa|ai|ea|ia)/i);
      if (m) patterns.push(m[0]);
    }
    // 3. Silent / tricky consonant clusters
    if (/âm câm|ghép/i.test(t)) {
      const m = raw.match(/(igh|eigh|ough|tch|sch|ght|kn|wr|gn|mn|mb|bt|pt|ps|rh|sc|ph|ch|wh|sl|stle|dn)/i);
      if (m) patterns.push(m[0]);
    }
    // 4. Confusable endings
    if (/đuôi/i.test(t)) {
      const m = raw.match(/(tion|sion|cian|ance|ence|able|ible|ary|ery|ory|eous|ious|ous|ise|ize|ment|ness|ship|ture|sure|or|er|ar)$/i);
      if (m) patterns.push(m[0]);
    }

    const uniq = Array.from(new Set(patterns.filter(Boolean))).sort((a, b) => b.length - a.length);
    if (!uniq.length) return `<span>${escapeHtml(raw)}</span>`;
    const re = new RegExp(`(${uniq.map((u) => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const marked = escapeHtml(raw).replace(re, '<mark class="ltip-hl">$1</mark>');
    return { html: marked, clusters: uniq };
  }

  function buildListeningTipParts(item) {
    const lemma = String(item.lemma || '').trim();
    const ipa = getIPA(item);
    const meaning = getCleanMeaning(item);
    const trapStr = String(item.spelling_trap || '').trim();
    const homoStr = String(item.homophone_trap || '').trim();

    const leftParts = [];
    leftParts.push('<div class="tip-col-heading">NHẬN DIỆN ÂM &amp; CHÍNH TẢ</div>');

    const anat = highlightWordTrapParts(lemma, trapStr);
    const wordHtml = typeof anat === 'object' ? anat.html : anat;
    const clusters = typeof anat === 'object' ? anat.clusters : [];

    leftParts.push(`
      <div class="ltip-word-anatomy">
        <div class="ltip-word-big">${wordHtml}</div>
        <div class="ltip-word-meta">
          <span class="fc-ipa-badge">${escapeHtml(ipa)}</span>
          <button type="button" class="btn-voice-speak" onclick="speakCurrentWord(null, event)">🔊 Nghe lại</button>
        </div>
        ${meaning ? `<div class="ltip-word-vi">${escapeHtml(meaning)}</div>` : ''}
      </div>
    `);

    const cit = (item.exam_citations || []).find((c) => c && c.sentence);
    const sent = cit?.sentence || item.example || '';
    if (sent) {
      leftParts.push(`
        <div class="tip-qa-block passage">
          <div class="tip-qa-label">Câu mẫu trong bài nghe IELTS</div>
          <div class="tip-qa-en">${formatSentenceHighlight(sent, lemma)}</div>
        </div>
      `);
    }

    const rightParts = [];
    rightParts.push('<div class="tip-col-heading">MẸO NGHE &amp; TRÁNH MẤT ĐIỂM</div>');

    if (homoStr) {
      rightParts.push(`
        <div class="tip-kw-box">
          <div class="tip-qa-label" style="margin-bottom:0;">Cặp từ đồng âm rất dễ viết nhầm</div>
          <div class="tip-kw-grid">
            <div class="tip-kw-col">
              <div class="tip-kw-col-head">Từ đang học</div>
              <div class="tip-kw-main">${escapeHtml(lemma)}</div>
            </div>
            <div class="tip-kw-arrow">⇄</div>
            <div class="tip-kw-col">
              <div class="tip-kw-col-head">Dễ nghe nhầm thành</div>
              <div class="tip-kw-main">${escapeHtml(homoStr)}</div>
            </div>
          </div>
        </div>
      `);
    }

    const bullets = [];
    if (homoStr) {
      bullets.push(
        `Hai từ <code>${escapeHtml(lemma)}</code> và <code>${escapeHtml(homoStr)}</code> phát âm giống hệt (hoặc gần giống) nhau. Khi điền bài nghe, luôn nhìn <strong>từ loại</strong> và <strong>ngữ cảnh câu</strong> xung quanh chỗ trống để chốt đúng chữ.`
      );
    }

    if (trapStr) {
      if (/chữ đôi/i.test(trapStr)) {
        const dbl = (lemma.match(/([a-z])\1/gi) || []).map((x) => `<code>${escapeHtml(x)}</code>`).join(', ');
        bullets.push(
          `<strong>Bẫy chữ đôi ${dbl || ''}:</strong> Thí sinh rất hay gõ thiếu còn 1 chữ cái. Trong IELTS Listening sai dù chỉ 1 chữ là 0 điểm cả câu — hãy nhớ chỗ tô đậm trong <code>${escapeHtml(lemma)}</code>.`
        );
      }
      if (/nguyên âm/i.test(trapStr)) {
        const vw = (lemma.match(/(au|ei|ie|eu|ue|eo|ui|ou|oa|ai|ea|ia)/i) || [])[0];
        bullets.push(
          vw
            ? `<strong>Bẫy cụm nguyên âm <code>${escapeHtml(vw)}</code>:</strong> Khi đọc nhanh tốc độ phòng thi, cụm <code>${escapeHtml(vw)}</code> hay bị lướt nhẹ nên rất dễ viết ngược thứ tự hoặc viết thiếu chữ.`
            : `<strong>Bẫy nguyên âm:</strong> Các nguyên âm giữa hay bị đọc lướt nhẹ — kiểm tra kỹ thứ tự từng nguyên âm trong <code>${escapeHtml(lemma)}</code> trước khi nộp bài.`
        );
      }
      if (/âm câm|ghép/i.test(trapStr)) {
        const cl = (lemma.match(/(igh|eigh|ough|tch|sch|ght|kn|wr|gn|mn|mb|bt|pt|ps|rh|sc|ph|ch|wh|sl|stle|dn)/i) || [])[0];
        bullets.push(
          cl
            ? `<strong>Bẫy âm câm / cụm ghép <code>${escapeHtml(cl)}</code>:</strong> Tai nghe gần như không nghe thấy đủ mặt chữ của cụm <code>${escapeHtml(cl)}</code>, bắt buộc phải nhớ mặt chữ chuẩn để không viết theo phiên âm.`
            : `<strong>Bẫy âm câm:</strong> Cách đọc khác cách viết — đừng đánh vần theo tai mà cần thuộc chắc mặt chữ <code>${escapeHtml(lemma)}</code>.`
        );
      }
      if (/đuôi/i.test(trapStr)) {
        const suf = (lemma.match(/(tion|sion|cian|ance|ence|able|ible|ary|ery|ory|eous|ious|ous|ise|ize|ment|ness|ship|ture|sure|or|er|ar)$/i) || [])[0];
        bullets.push(
          suf
            ? `<strong>Bẫy đuôi <code>-${escapeHtml(suf)}</code>:</strong> Rất dễ nhầm sang các đuôi đọc gần giống (như <code>-ance/-ence</code>, <code>-able/-ible</code>, <code>-er/-or</code>). Nhớ kỹ từ này kết thúc bằng <code>-${escapeHtml(suf)}</code>.`
            : `<strong>Bẫy đuôi từ:</strong> Chú ý viết chuẩn phần đuôi của <code>${escapeHtml(lemma)}</code> khi chép đáp án.`
        );
      }
      if (/số nhiều/i.test(trapStr)) {
        bullets.push(
          `<strong>Bẫy số ít / số nhiều (<code>-s/-es</code>):</strong> Âm <code>/s/</code> cuối câu trong băng hay bị nuốt hoặc nối âm. Trước khi băng chạy, nhìn nhanh xem trước chỗ trống có <code>a / an</code> hay không để chốt số ít hay thêm <code>-s</code>.`
        );
      }
      if (/ngày\/tháng|viết hoa/i.test(trapStr)) {
        bullets.push(
          `<strong>Bẫy Thứ / Tháng:</strong> Các từ chỉ ngày tháng rất hay xuất hiện ở Part 1 (điền form) và dễ bị sai chính tả âm câm (như <code>Wednesday</code>, <code>February</code>). Nên viết hoa chữ cái đầu.`
        );
      }
    }

    if (item.strategy) {
      bullets.push(escapeHtml(item.strategy));
    }

    if (bullets.length > 0) {
      rightParts.push(`
        <div class="tip-section trap">
          <div class="tip-section-title">Điểm cần chú ý khi đi thi Listening</div>
          <ul class="tip-bullets">${bullets.map((b) => `<li>${b}</li>`).join('')}</ul>
        </div>
      `);
    }

    return { leftParts, rightParts };
  }

  function renderReadingTipModalContent(item) {
    const isL = isListeningSkillActive();
    const pillEl = document.getElementById('tip-modal-pill');
    if (pillEl) pillEl.textContent = isL ? 'LISTENING TIP' : 'READING TIP';

    const { leftParts, rightParts } = isL ? buildListeningTipParts(item) : buildReadingTipParts(item);
    const bodyEl = document.getElementById('tip-modal-body');
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="tip-two-cols">
          <div class="tip-col-left">${leftParts.join('')}</div>
          <div class="tip-col-right">${rightParts.join('')}</div>
        </div>
      `;
    }
  }

  function openReadingTipModal(event) {
    if (event) event.stopPropagation();
    const item = currentScopeList[currentCardIndex];
    if (!item || !hasReadingTip(item)) return;
    renderReadingTipModalContent(item);
    document.getElementById('modal-reading-tip')?.classList.add('open');
  }

  function advanceDeckAfterAssess3() {
    if (currentScopeKey === REVIEW_OLD_SCOPE_KEY && customReviewState) {
      const now = Date.now();
      const remaining = (customReviewState.words || []).filter((w) => assessments[w.id] !== 3 || isWordDueNow(w, now));
      if (remaining.length === 0) {
        const targetTid = customReviewState.returnToTaskId;
        customReviewState = null;
        loadScope(SCOPES[0].key);
        showToast('✓ Đã ôn thuộc hết từ vựng cũ! Task mới đã sẵn sàng.');
        if (targetTid) {
          window.TasksModule?.openTaskBriefModal?.(targetTid);
        }
        return;
      }
      currentScopeList = remaining;
      currentCardIndex = Math.min(currentCardIndex, remaining.length - 1);
      updateVocabMasteryUI();
      renderCurrentCard(1);
      return;
    }
    if (onlyDueReview || onlyUnmastered) {
      currentScopeList.splice(currentCardIndex, 1);
      updateVocabMasteryUI();
      if (onlyDueReview && currentScopeList.length === 0) {
        onlyDueReview = false;
        showToast('Tuyệt vời! Bạn đã ôn hết từ cần ôn hôm nay!');
        applyFilterAndBuildDeck();
        return;
      }
      renderCurrentCard(1);
    } else {
      nextCard();
    }
  }

  function closeReadingTipModal(event) {
    if (event && event.target !== document.getElementById('modal-reading-tip')) return;
    document.getElementById('modal-reading-tip')?.classList.remove('open');
  }

  function saveMasterCooldowns() {
    if (!currentUser || isTeacherUser()) return;
    try {
      const now = Date.now();
      const active = {};
      Object.entries(masterCooldowns).forEach(([k, v]) => {
        const ts = Number(v || 0);
        if (ts > now) active[k] = ts;
      });
      const key = `${MASTER_COOLDOWN_KEY_BASE}${getScopedUid()}`;
      if (Object.keys(active).length > 0) localStorage.setItem(key, JSON.stringify(active));
      else localStorage.removeItem(key);
    } catch (_) {}
  }

  function loadMasterCooldowns() {
    masterCooldowns = {};
    if (!currentUser || isTeacherUser()) return;
    try {
      const key = `${MASTER_COOLDOWN_KEY_BASE}${getScopedUid()}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) || {};
      const now = Date.now();
      let any = false;
      Object.entries(parsed).forEach(([k, v]) => {
        const ts = Number(v || 0);
        if (ts > now) {
          masterCooldowns[k] = ts;
          any = true;
        }
      });
      if (any) ensureCooldownTicker();
      else localStorage.removeItem(key);
    } catch (_) {}
  }

  function setRecallActiveSession(item, stage = 1) {
    if (!currentUser || isExamAntiCheatBypassed() || !item?.id) return;
    try {
      localStorage.setItem(`${RECALL_ACTIVE_KEY_BASE}${getScopedUid()}`, JSON.stringify({
        itemId: item.id,
        lemma: item.lemma || '',
        stage,
        startedAt: Date.now(),
        deadlineAt: recallDeadlineAt || (Date.now() + 30000),
      }));
    } catch (_) {}
  }

  function clearRecallActiveSession() {
    if (!currentUser) return;
    try {
      localStorage.removeItem(`${RECALL_ACTIVE_KEY_BASE}${getScopedUid()}`);
    } catch (_) {}
  }

  function checkInterruptedRecallOnLoad() {
    if (!currentUser || isExamAntiCheatBypassed()) return '';
    const key = `${RECALL_ACTIVE_KEY_BASE}${getScopedUid()}`;
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return '';
      localStorage.removeItem(key);
      const rec = JSON.parse(raw);
      if (!rec || !rec.itemId) return '';
      const penaltySec = 60;
      masterCooldowns[rec.itemId] = Math.max(masterCooldowns[rec.itemId] || 0, Date.now() + penaltySec * 1000);
      assessments[rec.itemId] = 1;
      saveMasterCooldowns();
      saveState();
      ensureCooldownTicker();
      const label = rec.lemma ? ` "${rec.lemma}"` : '';
      return `Phát hiện tải lại trang khi đang Kiểm tra nhớ từ${label} — hạ về Chưa thuộc và khóa nút Đã thuộc ${penaltySec}s!`;
    } catch (_) {
      try { localStorage.removeItem(key); } catch (_) {}
      return '';
    }
  }

  function getMasterCooldownRemainingSec(wordId) {
    const until = masterCooldowns[wordId] || 0;
    const diff = until - Date.now();
    if (diff <= 0) {
      if (masterCooldowns[wordId]) {
        delete masterCooldowns[wordId];
        saveMasterCooldowns();
      }
      return 0;
    }
    return Math.ceil(diff / 1000);
  }

  function ensureCooldownTicker() {
    if (cooldownTimer) return;
    cooldownTimer = setInterval(() => {
      const now = Date.now();
      let anyActive = false;
      Object.keys(masterCooldowns).forEach(k => {
        if (masterCooldowns[k] > now) anyActive = true;
        else delete masterCooldowns[k];
      });
      updateAssess3CooldownUI();
      if (!anyActive) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        saveMasterCooldowns();
      }
    }, 500);
  }

  function updateAssess3CooldownUI() {
    const btn3 = document.getElementById('btn-assess-3');
    const labelEl = document.getElementById('assess-3-label');
    if (!btn3 || !labelEl) return;
    const item = currentScopeList[currentCardIndex];
    if (!item) return;
    const rem = getMasterCooldownRemainingSec(item.id);
    if (rem > 0) {
      btn3.disabled = true;
      labelEl.textContent = `Đã thuộc (${rem}s)`;
    } else {
      btn3.disabled = false;
      labelEl.innerHTML = `Đã thuộc <small class="anki-ivl-tag" id="ivl-tag-3">${escapeHtml(formatAnkiIntervalLabel(item.id, 3))}</small>`;
    }
  }

  function getRecallTimeLimitSec(item, stage = 1) {
    if (stage === 2) return 40;
    return (currentScopeKey === 'signal_words' || Boolean(item?.strategy)) ? 40 : 30;
  }

  const RECALL_QUICK_VI_MS = 6000;

  function stopRecallInputTimer() {
    if (recallDeadlineTimer) {
      clearInterval(recallDeadlineTimer);
      recallDeadlineTimer = null;
    }
    recallDeadlineAt = 0;
  }

  function resetRecallSpeedBarUI(showBar = false) {
    const wrap = document.getElementById('recall-speed-bar-wrap');
    const fill = document.getElementById('recall-speed-bar-fill');
    const badge = document.getElementById('recall-timer-badge');
    if (wrap) wrap.style.display = showBar ? 'block' : 'none';
    if (fill) {
      fill.style.width = '100%';
      fill.classList.remove('is-warn', 'is-danger');
    }
    if (badge) badge.classList.remove('is-speed-pulse');
  }

  function pauseRecallCountdown(pause) {
    if (pause) {
      if (!recallTimerPausedAt && recallDeadlineAt > 0) {
        recallTimerPausedAt = Date.now();
      }
    } else if (recallTimerPausedAt) {
      const pausedMs = Math.max(0, Date.now() - recallTimerPausedAt);
      if (recallDeadlineAt > 0) recallDeadlineAt += pausedMs;
      recallTimerPausedAt = 0;
    }
  }

  function updateRecallCountdownBadge() {
    const badge = document.getElementById('recall-timer-badge');
    if (!badge || !recallTargetItem || recallSubmitted) return;
    if (recallTimerPausedAt) return;
    const remMs = Math.max(0, recallDeadlineAt - Date.now());
    const rem = Math.max(0, Math.ceil(remMs / 1000));
    badge.textContent = `${rem}s`;
    const isQuickVi = recallMode === 'quick_vi';
    badge.classList.toggle('is-urgent', isQuickVi ? rem <= 3 : rem <= 5);
    badge.classList.toggle('is-speed-pulse', isQuickVi && rem > 0 && rem <= 3);

    if (isQuickVi) {
      const fill = document.getElementById('recall-speed-bar-fill');
      if (fill) {
        const pct = Math.max(0, Math.min(100, (remMs / RECALL_QUICK_VI_MS) * 100));
        fill.style.width = `${pct.toFixed(1)}%`;
        fill.classList.toggle('is-warn', pct <= 55 && pct > 35);
        fill.classList.toggle('is-danger', pct <= 35);
      }
    }
    if (remMs <= 0) {
      failRecallCheck(recallTargetItem, 'Hết thời gian!');
    }
  }

  function shuffleArray(arr) {
    const copy = arr.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function buildRecallSynonymOptions(item) {
    const isSignal = currentScopeKey === 'signal_words' || Boolean(item?.strategy);
    const lemmaNorm = String(item?.lemma || '').trim().toLowerCase();
    const used = new Set([lemmaNorm]);
    const options = [];

    const stemOf = (w) => String(w || '').trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
    const forbiddenStems = new Set();
    if (!isSignal) {
      const ls = stemOf(lemmaNorm);
      if (ls.length >= 4) forbiddenStems.add(ls);
    }

    const addOption = (rawText, isCorrect) => {
      const text = String(rawText || '').trim();
      const norm = text.toLowerCase();
      if (!text || used.has(norm)) return false;
      used.add(norm);
      options.push({ text, isCorrect });
      return true;
    };

    if (isSignal) {
      const allSig = Array.isArray(APP_DATA?.signal_words) ? APP_DATA.signal_words : [];
      const eqTerms = splitCsvItems(item.word_forms);
      const eqNorms = new Set(eqTerms.map((w) => String(w || '').trim().toLowerCase()).filter(Boolean));
      eqTerms.slice(0, 4).forEach((w) => addOption(w, true));
      eqNorms.forEach((n) => used.add(n));
      const collidesWithEq = (cand) => String(cand?.lemma || '').split('/').some((part) => eqNorms.has(part.trim().toLowerCase()));

      const catText = String(item.category || '').toLowerCase();
      const isContrastSide = catText.includes('tương phản') || catText.includes('nhượng bộ');
      const oppPool = shuffleArray(allSig.filter((x) => {
        if (x.id === item.id || x.category === item.category || collidesWithEq(x)) return false;
        const c = String(x.category || '').toLowerCase();
        return isContrastSide ? (c.includes('bổ sung') || c.includes('nguyên nhân') || c.includes('kết luận')) : (c.includes('tương phản') || c.includes('nhượng bộ'));
      }));
      const otherPool = shuffleArray(allSig.filter((x) => x.id !== item.id && x.category !== item.category && !collidesWithEq(x)));
      for (const cand of [...oppPool, ...otherPool]) {
        if (options.length >= 8) break;
        addOption(cand.lemma, false);
      }
      return shuffleArray(options);
    }

    const cleanSyns = shuffleArray(
      getEnrichedSynonyms(item)
        .map((s) => String(s || '').trim())
        .filter((s) => s && s.toLowerCase() !== lemmaNorm)
    );
    const chosenSyns = cleanSyns.slice(0, 4);
    chosenSyns.forEach((s) => {
      addOption(s, true);
      const st = stemOf(s);
      if (st.length >= 4) forbiddenStems.add(st);
    });
    cleanSyns.forEach((s) => {
      const n = s.toLowerCase();
      used.add(n); // prevent extra excluded synonyms from slipping in as distractors
    });

    const cleanAnts = shuffleArray(
      getEnrichedAntonyms(item)
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    );
    for (const a of cleanAnts) {
      if (options.length >= 7) break; // reserve at least 1 slot for distractors if possible
      addOption(a, false);
    }

    const pool = (currentScopeList && currentScopeList.length >= 30)
      ? currentScopeList
      : [...(APP_DATA?.file1_paraphrase_1500 || []), ...(APP_DATA?.file2_families_3500 || [])];
    const targetPos = getCleanPos(item);
    const samePos = [];
    const diffPos = [];
    const synSet = new Set([lemmaNorm, ...chosenSyns.map((s) => s.toLowerCase())]);

    // Deterministic-free fast random scan across pool
    const step = Math.max(1, Math.floor(pool.length / 120));
    const offset = Math.floor(Math.random() * pool.length);
    for (let k = 0; k < pool.length && options.length < 8; k++) {
      const idx = (offset + k * step + Math.floor(k / 40)) % pool.length;
      const cand = pool[idx];
      if (!cand || cand.id === item.id) continue;
      const cLem = String(cand.lemma || '').trim();
      const cNorm = cLem.toLowerCase();
      if (!cLem || used.has(cNorm) || forbiddenStems.has(stemOf(cNorm))) continue;
      const candSyns = Array.isArray(cand.clean_synonyms) ? cand.clean_synonyms : [];
      if (candSyns.some((cs) => synSet.has(String(cs || '').trim().toLowerCase()))) continue;
      if (getCleanPos(cand) === targetPos) samePos.push(cLem);
      else diffPos.push(cLem);
      if (samePos.length >= 10) break;
    }

    for (const dLem of [...samePos, ...diffPos]) {
      if (options.length >= 8) break;
      addOption(dLem, false);
    }

    // Fallback linear pass if step sampling didn't fill all 8
    for (let i = 0; i < pool.length && options.length < 8; i++) {
      const cand = pool[i];
      if (!cand || cand.id === item.id) continue;
      addOption(cand.lemma, false);
    }

    return shuffleArray(options);
  }

  function buildRecallAntonymOptions(item) {
    const lemmaNorm = String(item?.lemma || '').trim().toLowerCase();
    const used = new Set([lemmaNorm]);
    const options = [];
    const stemOf = (w) => String(w || '').trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 5);
    const forbiddenStems = new Set();
    const ls = stemOf(lemmaNorm);
    if (ls.length >= 4) forbiddenStems.add(ls);

    const addOption = (rawText, isCorrect) => {
      const text = String(rawText || '').trim();
      const norm = text.toLowerCase();
      if (!text || used.has(norm)) return false;
      used.add(norm);
      options.push({ text, isCorrect });
      return true;
    };

    const cleanAnts = shuffleArray(
      getEnrichedAntonyms(item)
        .map((s) => String(s || '').trim())
        .filter((s) => s && s.toLowerCase() !== lemmaNorm)
    );
    const chosenAnts = cleanAnts.slice(0, 4);
    chosenAnts.forEach((a) => {
      addOption(a, true);
      const st = stemOf(a);
      if (st.length >= 4) forbiddenStems.add(st);
    });
    cleanAnts.forEach((a) => used.add(a.toLowerCase()));

    // Synonyms make great realistic distractors in Antonym check!
    const cleanSyns = shuffleArray(
      getEnrichedSynonyms(item)
        .map((s) => String(s || '').trim())
        .filter(Boolean)
    );
    for (const s of cleanSyns) {
      if (options.length >= 6) break;
      addOption(s, false);
    }

    const pool = (currentScopeList && currentScopeList.length >= 30)
      ? currentScopeList
      : [...(APP_DATA?.file1_paraphrase_1500 || []), ...(APP_DATA?.file2_families_3500 || [])];
    const targetPos = getCleanPos(item);
    const samePos = [];
    const diffPos = [];
    const step = Math.max(1, Math.floor(pool.length / 120));
    const offset = Math.floor(Math.random() * pool.length);
    for (let k = 0; k < pool.length && options.length < 8; k++) {
      const idx = (offset + k * step + Math.floor(k / 40)) % pool.length;
      const cand = pool[idx];
      if (!cand || cand.id === item.id) continue;
      const cLem = String(cand.lemma || '').trim();
      const cNorm = cLem.toLowerCase();
      if (!cLem || used.has(cNorm) || forbiddenStems.has(stemOf(cNorm))) continue;
      if (getCleanPos(cand) === targetPos) samePos.push(cLem);
      else diffPos.push(cLem);
      if (samePos.length >= 10) break;
    }
    for (const w of [...samePos, ...diffPos]) {
      if (options.length >= 8) break;
      addOption(w, false);
    }
    return shuffleArray(options);
  }

  function buildRecallWordFamilyOptions(item) {
    const lemmaNorm = String(item?.lemma || '').trim().toLowerCase();
    const stemOf = (word) => {
      const clean = String(word || '').toLowerCase().replace(/[^a-z]/g, '');
      return clean.length >= 4 ? clean.slice(0, 4) : clean;
    };
    const options = [];
    const used = new Set([lemmaNorm]);
    const forbiddenStems = new Set([stemOf(lemmaNorm)]);

    const addOption = (txt, isCorrect) => {
      const clean = String(txt || '').trim();
      const norm = clean.toLowerCase();
      if (!clean || used.has(norm)) return false;
      used.add(norm);
      options.push({ text: clean, isCorrect });
      return true;
    };

    const rawForms = shuffleArray(
      (Array.isArray(item?.clean_forms) ? item.clean_forms : [])
        .map((s) => String(s || '').trim())
        .filter((s) => s && s.toLowerCase() !== lemmaNorm)
    );
    const chosenForms = rawForms.slice(0, 4);
    chosenForms.forEach((f) => {
      addOption(f, true);
      const st = stemOf(f);
      if (st.length >= 4) forbiddenStems.add(st);
    });
    rawForms.forEach((f) => used.add(f.toLowerCase()));

    const pool = (currentScopeList && currentScopeList.length >= 30)
      ? currentScopeList
      : [...(APP_DATA?.file2_families_3500 || []), ...(APP_DATA?.file1_paraphrase_1500 || [])];
    const step = Math.max(1, Math.floor(pool.length / 120));
    const offset = Math.floor(Math.random() * Math.max(1, pool.length));
    for (let k = 0; k < pool.length && options.length < 8; k++) {
      const idx = (offset + k * step + Math.floor(k / 40)) % pool.length;
      const cand = pool[idx];
      if (!cand || cand.id === item.id) continue;
      const cLem = String(cand.lemma || '').trim();
      const cNorm = cLem.toLowerCase();
      if (!cLem || used.has(cNorm) || forbiddenStems.has(stemOf(cNorm))) continue;
      addOption(cLem, false);
    }
    return shuffleArray(options);
  }

  function buildRecallWordBoxExercise(item) {
    const lem = String(item?.lemma || '').trim();
    const lemLow = lem.toLowerCase();
    // 1. Try to reuse exact verified Task Word Box item if available in APP_TASKS_DATA
    let sentenceBlank = '';
    let examTitle = '';
    let correctSurface = lem;
    let trapForms = [];

    const allTasks = window.APP_TASKS_DATA?.tasks || [];
    for (const tk of allTasks) {
      for (const bd of (tk.test2WordBoxBoards || [])) {
        const hit = (bd.items || []).find((bi) => String(bi.lemma || '').toLowerCase() === lemLow || bi.wordId === item.id);
        if (hit && hit.sentenceBlank && hit.answer) {
          sentenceBlank = hit.sentenceBlank;
          examTitle = hit.examTitle || 'IELTS Reading';
          correctSurface = hit.answer;
          trapForms = (bd.wordBox || [])
            .filter((o) => String(o.text || '').toLowerCase() !== String(hit.answer).toLowerCase())
            .map((o) => o.text);
          break;
        }
      }
      if (sentenceBlank) break;
    }

    // 2. Fallback: blank out target lemma / inflection directly from verbatim exam_citations
    if (!sentenceBlank) {
      const cits = Array.isArray(item?.exam_citations) ? item.exam_citations : [];
      const inflects = [lemLow, lemLow + 's', lemLow + 'es', lemLow + 'ed', lemLow + 'd', lemLow + 'ing'];
      if (lemLow.endsWith('e') && lemLow.length >= 3) inflects.push(lemLow.slice(0, -1) + 'ing');
      if (lemLow.endsWith('y') && lemLow.length >= 3) inflects.push(lemLow.slice(0, -1) + 'ies', lemLow.slice(0, -1) + 'ied');
      const sortedForms = Array.from(new Set(inflects)).sort((a, b) => b.length - a.length);

      for (const c of cits) {
        const sent = String(c?.sentence || '').trim();
        if (sent.length < 25) continue;
        for (const fm of sortedForms) {
          const rx = new RegExp(`\\b${fm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
          const m = sent.match(rx);
          if (m) {
            sentenceBlank = sent.replace(rx, '______');
            examTitle = String(c?.title || 'IELTS Academic Reading');
            correctSurface = m[0].toLowerCase();
            break;
          }
        }
        if (sentenceBlank) break;
      }
    }

    if (!sentenceBlank) return null;

    // Build 6 clean Word Box options (1 correct + word-family traps + distractors from scope)
    const opts = [];
    const seen = new Set([correctSurface.toLowerCase()]);
    opts.push({ text: correctSurface, isCorrect: true });

    const pushDistractor = (txt) => {
      const t = String(txt || '').trim();
      if (!t || opts.length >= 6) return;
      const tl = t.toLowerCase();
      if (seen.has(tl)) return;
      seen.add(tl);
      opts.push({ text: t, isCorrect: false });
    };

    // Priority 1: traps from clean_forms (word family traps!) + task wordBox traps
    (Array.isArray(item?.clean_forms) ? item.clean_forms : []).forEach((f) => {
      if (String(f || '').trim().toLowerCase() !== lemLow) pushDistractor(f);
    });
    shuffleArray(trapForms).forEach(pushDistractor);

    // Priority 2: distractors from currentScopeList / file1
    const pool = (currentScopeList && currentScopeList.length >= 12) ? currentScopeList : (APP_DATA?.file1_paraphrase_1500 || []);
    const targetPos = getCleanPos(item);
    const samePos = [];
    const otherPos = [];
    const offset = Math.floor(Math.random() * Math.max(1, pool.length));
    for (let k = 0; k < Math.min(pool.length, 80); k++) {
      const cand = pool[(offset + k * 3) % pool.length];
      if (!cand || cand.id === item.id) continue;
      if (getCleanPos(cand) === targetPos) samePos.push(cand.lemma);
      else otherPos.push(cand.lemma);
    }
    [...samePos, ...otherPos].forEach(pushDistractor);

    return {
      sentenceBlank,
      examTitle,
      options: shuffleArray(opts),
    };
  }

  function renderRecallSynGrid(revealAnswers = false) {
    const grid = document.getElementById('recall-syn-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const isListChoice = recallMode === 'quick_vi' || recallMode === 'paraphrase_think';
    grid.classList.toggle('is-quick-vi', isListChoice);
    recallSynOptions.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recall-syn-opt';
      if (isListChoice) btn.classList.add('is-vi-choice');
      const isSelected = recallSynSelected.has(idx);
      if (revealAnswers) {
        btn.disabled = true;
        if (opt.isCorrect && isSelected) {
          btn.classList.add('is-right');
          btn.textContent = `✓ ${opt.text}`;
        } else if (opt.isCorrect && !isSelected) {
          btn.classList.add('is-missed');
          btn.textContent = isListChoice ? `✓ ${opt.text}` : `Thiếu: ${opt.text}`;
        } else if (!opt.isCorrect && (isSelected || opt.triedWrong)) {
          btn.classList.add('is-wrong');
          btn.textContent = `${opt.isAntonymTrap ? '✗ Bẫy trái nghĩa: ' : '✗ '}${opt.text}`;
        } else {
          btn.textContent = opt.text;
        }
      } else if (opt.triedWrong) {
        btn.disabled = true;
        btn.classList.add('is-wrong');
        btn.textContent = `${opt.isAntonymTrap ? '✗ Bẫy trái nghĩa: ' : '✗ '}${opt.text}`;
      } else {
        btn.textContent = opt.text;
        if (isSelected) btn.classList.add('is-selected');
        btn.onclick = () => toggleRecallSynOption(idx);
      }
      grid.appendChild(btn);
    });
  }

  function finalizeRecallMastery(item) {
    stopRecallInputTimer();
    resetRecallSpeedBarUI(false);
    clearRecallActiveSession();
    recallSubmitted = true;
    delete masterCooldowns[item.id];
    saveMasterCooldowns();
    updateAssess3CooldownUI();
    commitAssessment(item, 3);
    closeRecallModal(null, true);
    showToast(`Chính xác! Đã thuộc "${item.lemma}".`);
    advanceDeckAfterAssess3();
  }

  function advanceRecallStage2Queue(item) {
    if (Array.isArray(recallStage2Queue) && recallStage2Queue.length > 0) {
      const nextStep = recallStage2Queue.shift();
      enterRecallStage2Step(item, nextStep);
      return;
    }
    finalizeRecallMastery(item);
  }

  function toggleRecallSynOption(idx) {
    if (recallSubmitted) return;
    // Active-Thinking Spoken Paraphrase check (Listening Test 2: retry until correct, catch Antonym Traps!)
    if (recallMode === 'paraphrase_think') {
      const opt = recallSynOptions[idx];
      if (!opt || opt.triedWrong || !recallTargetItem) return;
      const fb = document.getElementById('recall-feedback');
      if (opt.isCorrect) {
        stopRecallInputTimer();
        recallSubmitted = true;
        recallSynSelected = new Set([idx]);
        renderRecallSynGrid(true);
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback ok';
          fb.textContent = `✓ Chuẩn Paraphrase IELTS! "${recallTargetItem.lemma}" ≈ "${opt.text}"`;
        }
        const doneItem = recallTargetItem;
        setTimeout(() => advanceRecallStage2Queue(doneItem), 420);
      } else {
        opt.triedWrong = true;
        renderRecallSynGrid(false);
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback err';
          fb.innerHTML = opt.isAntonymTrap
            ? `Cẩn thận <strong>bẫy trái nghĩa</strong>! <em>"${escapeHtml(opt.text)}"</em> mang nghĩa NGƯỢC lại với <strong>${escapeHtml(recallTargetItem.lemma)}</strong> — suy nghĩ lại và chọn đáp án đúng nhé.`
            : `Chưa khớp nghĩa với <strong>${escapeHtml(recallTargetItem.lemma)}</strong> — tự suy luận lại và chọn lại đến khi đúng nhé!`;
        }
      }
      return;
    }

    // Fast 1-Tap Vietnamese Meaning check
    if (recallMode === 'quick_vi') {
      const opt = recallSynOptions[idx];
      if (!opt || !recallTargetItem) return;
      recallSynSelected = new Set([idx]);
      if (opt.isCorrect) {
        stopRecallInputTimer();
        recallSubmitted = true;
        renderRecallSynGrid(true);
        const doneItem = recallTargetItem;
        if (Array.isArray(recallStage2Queue) && recallStage2Queue.length > 0) {
          setTimeout(() => advanceRecallStage2Queue(doneItem), 160);
          return;
        }
        clearRecallActiveSession();
        delete masterCooldowns[doneItem.id];
        saveMasterCooldowns();
        updateAssess3CooldownUI();
        commitAssessment(doneItem, 3);
        setTimeout(() => {
          closeRecallModal(null, true);
          showToast(`Chính xác! Đã thuộc "${doneItem.lemma}".`);
          advanceDeckAfterAssess3();
        }, 180);
      } else {
        failRecallCheck(recallTargetItem, 'Chưa chính xác!');
      }
      return;
    }

    if (recallStage !== 2) return;
    // Single-select in Word Box replacement mode; multi-select in real-exam synonym mode
    if (recallStage2Type === 'wordbox') {
      recallSynSelected = new Set([idx]);
    } else {
      if (recallSynSelected.has(idx)) recallSynSelected.delete(idx);
      else recallSynSelected.add(idx);
    }
    const fb = document.getElementById('recall-feedback');
    if (fb && fb.style.display !== 'none') {
      fb.style.display = 'none';
      fb.textContent = '';
    }
    if (recallTargetItem) updateRecallPromptAttempts(recallTargetItem);
    renderRecallSynGrid(false);
  }

  function isRecallStrictReview(item) {
    if (onlyDueReview) return true;
    const st = item ? srsData[item.id] : null;
    return Boolean(st && (st.reps || 0) >= 1 && isWordDueNow(item));
  }

  function getRecallRule(item) {
    const strict = isRecallStrictReview(item);
    return {
      strict,
      maxAttempts: strict ? 1 : 2,
      cooldownSec: strict ? 60 : 35,
      cooldownMs: strict ? 60000 : 35000,
    };
  }

  function updateRecallPromptAttempts(item) {
    const rule = getRecallRule(item);
    const p1 = document.getElementById('recall-stage1-prompt');
    const p2 = document.getElementById('recall-stage2-prompt');
    if (p1) {
      if (recallAttemptsLeft <= 0) {
        p1.textContent = 'Đã hết lượt thử.';
      } else {
        p1.textContent = rule.strict
          ? 'Gõ chính xác từ tiếng Anh vừa học · còn 1 lần.'
          : `Gõ chính xác từ tiếng Anh vừa học · còn ${recallAttemptsLeft} lần.`;
      }
    }
    if (p2) {
      if (recallMode === 'paraphrase_think') {
        p2.innerHTML = 'Chọn cách diễn đạt tương đương — cẩn thận bẫy trái nghĩa:';
        return;
      }
      if (recallMode === 'quick_vi') {
        p2.innerHTML = 'Chọn nghĩa tiếng Việt đúng:';
        return;
      }
      if (recallStage2Type === 'wordbox') {
        p2.innerHTML = recallAttemptsLeft <= 0
          ? 'Đã hết lượt thử.'
          : `Chọn từ điền vào chỗ trống · còn ${recallAttemptsLeft} lần:`;
        return;
      }
      const targetTotal = recallSynOptions.filter((o) => o.isCorrect).length;
      const selBadge = targetTotal > 0
        ? ` <span class="recall-select-counter">Đã chọn ${recallSynSelected.size}/${targetTotal}</span>`
        : '';
      if (recallStage2Type === 'wordfamily') {
        if (recallAttemptsLeft <= 0) {
          p2.innerHTML = 'Đã hết lượt thử.';
        } else {
          const baseText = rule.strict
            ? 'Chọn Word Family · còn 1 lần:'
            : `Chọn Word Family · còn ${recallAttemptsLeft} lần:`;
          p2.innerHTML = escapeHtml(baseText) + selBadge;
        }
        return;
      }
      if (recallStage2Type === 'antonym') {
        if (recallAttemptsLeft <= 0) {
          p2.innerHTML = 'Đã hết lượt thử.';
        } else {
          const baseText = rule.strict
            ? 'Chọn từ trái nghĩa · còn 1 lần:'
            : `Chọn từ trái nghĩa · còn ${recallAttemptsLeft} lần:`;
          p2.innerHTML = escapeHtml(baseText) + selBadge;
        }
        return;
      }
      if (recallAttemptsLeft <= 0) {
        p2.innerHTML = 'Đã hết lượt thử.';
      } else {
        const baseText = rule.strict
          ? 'Chọn Synonyms · còn 1 lần:'
          : `Chọn Synonyms · còn ${recallAttemptsLeft} lần:`;
        p2.innerHTML = escapeHtml(baseText) + selBadge;
      }
    }
  }

  function enterRecallStage2Step(item, stepType) {
    if (stepType === 'type_word') {
      stopRecallInputTimer();
      resetRecallSpeedBarUI(false);
      recallStage = 2;
      recallSubmitted = false;
      recallMode = 'standard';
      recallStage2Type = 'type_word';
      recallAttemptsLeft = getRecallRule(item).maxAttempts;
      recallSynOptions = [];
      recallSynSelected = new Set();

      const limitSec = getRecallTimeLimitSec(item, 1);
      recallDeadlineAt = Date.now() + limitSec * 1000;

      const stageBadge = document.getElementById('recall-stage-badge');
      const timerBadge = document.getElementById('recall-timer-badge');
      const hintBox = document.getElementById('recall-hint-box');
      const stage1Body = document.getElementById('recall-stage1-body');
      const listenBodyEl = document.getElementById('recall-listening-body');
      const stage2Body = document.getElementById('recall-stage2-body');
      const inp = document.getElementById('recall-word-input');
      const btnSubmit = document.getElementById('btn-recall-submit');
      const fb = document.getElementById('recall-feedback');

      if (stageBadge) stageBadge.textContent = 'Test 2 · Ghi lại từ';
      if (timerBadge) {
        timerBadge.textContent = `${limitSec}s`;
        timerBadge.classList.remove('is-urgent', 'is-speed-pulse');
      }
      if (hintBox) hintBox.style.display = 'none';
      if (listenBodyEl) listenBodyEl.style.display = 'none';
      if (stage2Body) stage2Body.style.display = 'none';
      if (stage1Body) stage1Body.style.display = 'block';
      if (inp) {
        inp.value = '';
        inp.disabled = false;
        setTimeout(() => inp.focus(), 40);
      }
      if (btnSubmit) btnSubmit.style.display = 'inline-flex';
      if (fb) {
        fb.style.display = 'none';
        fb.className = 'recall-feedback';
        fb.innerHTML = '';
      }
      updateRecallPromptAttempts(item);
      setRecallActiveSession(item, 2);
      recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
      return;
    }

    if (stepType === 'paraphrase_think') {
      const pq = window.APP_LISTENING_PARAPHRASES?.buildParaphraseQuestion?.(item.lemma);
      if (!pq || !Array.isArray(pq.options) || pq.options.length < 2) {
        advanceRecallStage2Queue(item);
        return;
      }
      stopRecallInputTimer();
      resetRecallSpeedBarUI(false);
      recallStage = 2;
      recallSubmitted = false;
      recallMode = 'paraphrase_think';
      recallStage2Type = 'paraphrase_think';
      recallAttemptsLeft = 99;
      recallSynOptions = pq.options.map((o) => ({
        text: o.text,
        isCorrect: Boolean(o.isCorrect),
        isAntonymTrap: Boolean(o.isAntonymTrap),
        triedWrong: false,
      }));
      recallSynSelected = new Set();

      const limitSec = 45;
      recallDeadlineAt = Date.now() + limitSec * 1000;

      const stageBadge = document.getElementById('recall-stage-badge');
      const timerBadge = document.getElementById('recall-timer-badge');
      const hintBox = document.getElementById('recall-hint-box');
      const targetSubEl = document.querySelector('#recall-stage2-target .recall-stage-sub');
      const targetWordEl = document.getElementById('recall-stage2-word');
      const stage1Body = document.getElementById('recall-stage1-body');
      const listenBodyEl = document.getElementById('recall-listening-body');
      const stage2Body = document.getElementById('recall-stage2-body');
      const btnSubmit = document.getElementById('btn-recall-submit');
      const fb = document.getElementById('recall-feedback');

      document.getElementById('recall-word-input')?.blur();
      if (stageBadge) stageBadge.textContent = 'Test 2 · Paraphrase';
      if (timerBadge) {
        timerBadge.textContent = `${limitSec}s`;
        timerBadge.classList.remove('is-urgent', 'is-speed-pulse');
      }
      if (hintBox) hintBox.style.display = 'block';
      if (targetSubEl) targetSubEl.textContent = 'Trong băng nghe IELTS, người nói sẽ diễn đạt từ này bằng cách nào?';
      if (targetWordEl) {
        targetWordEl.className = 'recall-stage-word';
        targetWordEl.textContent = item.lemma || '';
      }
      if (stage1Body) stage1Body.style.display = 'none';
      if (listenBodyEl) listenBodyEl.style.display = 'none';
      if (stage2Body) stage2Body.style.display = 'block';
      if (btnSubmit) btnSubmit.style.display = 'none';
      if (fb) {
        fb.style.display = 'none';
        fb.className = 'recall-feedback';
        fb.innerHTML = '';
      }
      updateRecallPromptAttempts(item);
      renderRecallSynGrid(false);
      setRecallActiveSession(item, 2);
      recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
      return;
    }

    if (stepType === 'meaning_vi') {
      const choices = window.RecognitionTestModule?.buildMeaningDistractors?.(item, currentScopeList, 3) || [];
      if (choices.length < 2) {
        advanceRecallStage2Queue(item);
        return;
      }
      stopRecallInputTimer();
      recallStage = 2;
      recallSubmitted = false;
      recallMode = 'quick_vi';
      recallStage2Type = 'meaning_vi';
      recallAttemptsLeft = 1;
      recallSynOptions = shuffleArray(choices.map((c) => ({ text: c.meaning, isCorrect: c.isCorrect })));
      recallSynSelected = new Set();
      recallDeadlineAt = Date.now() + RECALL_QUICK_VI_MS;
      const stageBadge = document.getElementById('recall-stage-badge');
      const timerBadge = document.getElementById('recall-timer-badge');
      const hintBox = document.getElementById('recall-hint-box');
      const targetSubEl = document.querySelector('#recall-stage2-target .recall-stage-sub');
      const targetWordEl = document.getElementById('recall-stage2-word');
      const stage1Body = document.getElementById('recall-stage1-body');
      const stage2Body = document.getElementById('recall-stage2-body');
      const btnSubmit = document.getElementById('btn-recall-submit');
      const fb = document.getElementById('recall-feedback');
      document.getElementById('recall-word-input')?.blur();
      resetRecallSpeedBarUI(true);
      if (stageBadge) stageBadge.textContent = 'Test 2 · Nghĩa Việt';
      if (timerBadge) {
        timerBadge.textContent = `${Math.round(RECALL_QUICK_VI_MS / 1000)}s`;
        timerBadge.classList.remove('is-urgent', 'is-speed-pulse');
      }
      if (hintBox) hintBox.style.display = 'block';
      if (targetSubEl) targetSubEl.textContent = `${getCleanPos(item)} · Chọn nhanh nghĩa đúng của`;
      if (targetWordEl) {
        targetWordEl.className = 'recall-stage-word';
        targetWordEl.textContent = item.lemma || '';
      }
      if (stage1Body) stage1Body.style.display = 'none';
      const listenBodyEl = document.getElementById('recall-listening-body');
      if (listenBodyEl) listenBodyEl.style.display = 'none';
      if (stage2Body) stage2Body.style.display = 'block';
      if (btnSubmit) btnSubmit.style.display = 'none';
      if (fb) {
        fb.style.display = 'none';
        fb.className = 'recall-feedback';
        fb.innerHTML = '';
      }
      updateRecallPromptAttempts(item);
      renderRecallSynGrid(false);
      setRecallActiveSession(item, 2);
      recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 60);
      return;
    }

    stopRecallInputTimer();
    resetRecallSpeedBarUI(false);
    recallStage = 2;
    recallSubmitted = false;
    recallMode = 'standard';
    recallAttemptsLeft = getRecallRule(item).maxAttempts;
    recallStage2Type = stepType;
    recallWbSentence = '';
    recallWbTitle = '';
    recallSynOptions = stepType === 'wordfamily'
      ? buildRecallWordFamilyOptions(item)
      : (stepType === 'antonym' ? buildRecallAntonymOptions(item) : buildRecallSynonymOptions(item));
    recallSynSelected = new Set();

    const limitSec = getRecallTimeLimitSec(item, 2);
    recallDeadlineAt = Date.now() + limitSec * 1000;

    const stageBadge = document.getElementById('recall-stage-badge');
    const timerBadge = document.getElementById('recall-timer-badge');
    const hintBox = document.getElementById('recall-hint-box');
    const targetSubEl = document.querySelector('#recall-stage2-target .recall-stage-sub');
    const targetWordEl = document.getElementById('recall-stage2-word');
    const stage1Body = document.getElementById('recall-stage1-body');
    const stage2Body = document.getElementById('recall-stage2-body');
    const btnSubmit = document.getElementById('btn-recall-submit');
    const fb = document.getElementById('recall-feedback');

    document.getElementById('recall-word-input')?.blur();
    if (stageBadge) {
      stageBadge.textContent = stepType === 'wordfamily'
        ? 'Test 2 · Word Family'
        : (stepType === 'antonym' ? 'Test 2 · Trái nghĩa' : 'Test 2 · Đồng nghĩa');
    }
    if (timerBadge) {
      timerBadge.textContent = `${limitSec}s`;
      timerBadge.classList.remove('is-urgent');
    }
    if (hintBox) hintBox.style.display = 'block';
    if (targetSubEl) {
      targetSubEl.textContent = stepType === 'wordfamily'
        ? 'Click các từ cùng gia đình từ (Word Family) của'
        : (stepType === 'antonym'
          ? 'Click các từ trái nghĩa (Antonyms) của'
          : (stepType === 'signal_equiv' ? 'Click các từ nối tương đương của' : 'Click các từ đồng nghĩa (Synonyms) của'));
    }
    if (targetWordEl) {
      targetWordEl.className = 'recall-stage-word';
      targetWordEl.textContent = item.lemma || '';
    }
    if (stage1Body) stage1Body.style.display = 'none';
    const listenBodyEl2 = document.getElementById('recall-listening-body');
    if (listenBodyEl2) listenBodyEl2.style.display = 'none';
    if (stage2Body) stage2Body.style.display = 'block';
    if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    if (fb) {
      fb.style.display = 'none';
      fb.className = 'recall-feedback';
      fb.innerHTML = '';
    }
    updateRecallPromptAttempts(item);
    renderRecallSynGrid(false);
    setRecallActiveSession(item, 2);
    recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
  }

  function enterRecallStage2(item, wbExercise = null) {
    stopRecallInputTimer();
    recallStage = 2;
    recallSubmitted = false;
    recallAttemptsLeft = getRecallRule(item).maxAttempts;
    recallStage2Type = wbExercise ? 'wordbox' : 'synonym';
    recallWbSentence = wbExercise ? wbExercise.sentenceBlank : '';
    recallWbTitle = wbExercise ? wbExercise.examTitle : '';
    recallSynOptions = wbExercise ? wbExercise.options : buildRecallSynonymOptions(item);
    recallSynSelected = new Set();

    const limitSec = getRecallTimeLimitSec(item, 2);
    recallDeadlineAt = Date.now() + limitSec * 1000;

    const stageBadge = document.getElementById('recall-stage-badge');
    const timerBadge = document.getElementById('recall-timer-badge');
    const hintBox = document.getElementById('recall-hint-box');
    const targetSubEl = document.querySelector('#recall-stage2-target .recall-stage-sub');
    const targetWordEl = document.getElementById('recall-stage2-word');
    const stage1Body = document.getElementById('recall-stage1-body');
    const stage2Body = document.getElementById('recall-stage2-body');
    const inp = document.getElementById('recall-word-input');
    const fb = document.getElementById('recall-feedback');

    inp?.blur();
    if (stageBadge) stageBadge.textContent = wbExercise ? 'Test 2 · Word Box' : 'Test 2';
    if (timerBadge) {
      timerBadge.textContent = `${limitSec}s`;
      timerBadge.classList.remove('is-urgent');
    }
    if (hintBox) hintBox.style.display = 'block';
    if (wbExercise) {
      if (targetSubEl) targetSubEl.textContent = `Điền từ vào câu trích đề thật (${wbExercise.examTitle})`;
      if (targetWordEl) {
        targetWordEl.className = 'recall-wb-sentence';
        targetWordEl.innerHTML = escapeHtml(wbExercise.sentenceBlank).replace(/______/g, '<span class="wb-inline-blank">______</span>');
      }
    } else {
      if (targetSubEl) targetSubEl.textContent = 'Click các từ đồng nghĩa của';
      if (targetWordEl) {
        targetWordEl.className = 'recall-stage-word';
        targetWordEl.textContent = item.lemma || '';
      }
    }
    if (stage1Body) stage1Body.style.display = 'none';
    const listenBodyEl2 = document.getElementById('recall-listening-body');
    if (listenBodyEl2) listenBodyEl2.style.display = 'none';
    if (stage2Body) stage2Body.style.display = 'block';
    if (fb) {
      fb.style.display = 'none';
      fb.className = 'recall-feedback';
      fb.innerHTML = '';
    }

    updateRecallPromptAttempts(item);
    renderRecallSynGrid(false);
    setRecallActiveSession(item, 2);
    recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
  }

  function failRecallCheck(item, reasonPrefix = 'Chưa chính xác!') {
    stopRecallInputTimer();
    window.TotoroSpeechSTT?.abort?.();
    if (listeningAutoPlayTimer) { clearTimeout(listeningAutoPlayTimer); listeningAutoPlayTimer = null; }
    recallTimerPausedAt = 0;
    listeningRecallBusy = false;
    if (recallMode === 'listening_shadow') setListeningMicUI('disabled', 'Đã hết lượt thử cho thẻ này.');
    resetRecallSpeedBarUI(false);
    clearRecallActiveSession();
    recallSubmitted = true;
    recallAttemptsLeft = 0;
    updateRecallPromptAttempts(item);
    const rule = getRecallRule(item);
    const inp = document.getElementById('recall-word-input');
    const fb = document.getElementById('recall-feedback');
    const btnCancel = document.getElementById('btn-recall-cancel');
    const btnSubmit = document.getElementById('btn-recall-submit');
    const btnReturn = document.getElementById('btn-recall-return');
    const badge = document.getElementById('recall-timer-badge');

    if (badge) {
      badge.classList.remove('is-speed-pulse');
      if (reasonPrefix.includes('Hết')) {
        badge.textContent = '0s';
        badge.classList.add('is-urgent');
        const fill = document.getElementById('recall-speed-bar-fill');
        if (fill) {
          fill.style.width = '0%';
          fill.classList.add('is-danger');
        }
      }
    }
    if (inp) inp.disabled = true;
    if ((recallStage === 2 && recallStage2Type !== 'type_word') || recallMode === 'quick_vi') {
      renderRecallSynGrid(true);
    }
    syncExamLock(false);
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnSubmit) btnSubmit.style.display = 'none';

    masterCooldowns[item.id] = Date.now() + rule.cooldownMs;
    saveMasterCooldowns();
    ensureCooldownTicker();
    commitAssessment(item, 1);
    updateAssess3CooldownUI();

    if (fb) {
      fb.style.display = 'block';
      fb.className = 'recall-feedback err';
      if (recallMode === 'quick_vi') {
        const rightMean = item.clean_meaning || item.meaning || item.definition || '';
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Nghĩa đúng của <strong>${escapeHtml(item.lemma)}</strong> là: <strong>${escapeHtml(rightMean)}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      } else if (recallStage === 2 && recallStage2Type === 'type_word') {
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Chính tả đúng là: <strong>${escapeHtml(item.lemma)}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      } else if (recallStage === 2 && recallStage2Type === 'wordbox') {
        const rightWords = recallSynOptions.filter((o) => o.isCorrect).map((o) => o.text);
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Đáp án Word Box đúng là: <strong>${escapeHtml(rightWords.join(', '))}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      } else if (recallStage === 2 && recallStage2Type === 'wordfamily') {
        const rightWords = recallSynOptions.filter((o) => o.isCorrect).map((o) => o.text);
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Các gia đình từ đúng là: <strong>${escapeHtml(rightWords.join(', '))}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      } else if (recallStage === 2 && recallStage2Type === 'antonym') {
        const rightWords = recallSynOptions.filter((o) => o.isCorrect).map((o) => o.text);
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Các từ trái nghĩa đúng là: <strong>${escapeHtml(rightWords.join(', '))}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      } else if (recallStage === 2) {
        const rightWords = recallSynOptions.filter((o) => o.isCorrect).map((o) => o.text);
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Các từ đồng nghĩa đúng là: <strong>${escapeHtml(rightWords.join(', '))}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      } else {
        fb.innerHTML = `${escapeHtml(reasonPrefix)} Đáp án đúng là: <strong>${escapeHtml(item.lemma)}</strong>.<br>Hãy xem lại thẻ và thử bấm Đã thuộc lại sau ${rule.cooldownSec} giây.`;
      }
    }
    if (btnReturn) {
      btnReturn.style.display = 'inline-flex';
      setTimeout(() => btnReturn.focus(), 30);
    }
  }

  function isListeningSkillActive() {
    const sk = window.TotoroUI?.getActiveSkill?.() || document.documentElement.getAttribute('data-skill') || 'reading';
    return String(sk).toLowerCase() === 'listening';
  }

  function resetListeningWaveformUI() {
    const wf = document.getElementById('rl-waveform');
    if (!wf) return;
    wf.classList.remove('is-recording', 'is-processing');
    wf.querySelectorAll('span').forEach((bar) => {
      bar.style.transform = 'scaleY(0.18)';
    });
  }

  function updateListeningWaveformUI(bars) {
    const wf = document.getElementById('rl-waveform');
    if (!wf || !Array.isArray(bars)) return;
    const spans = wf.querySelectorAll('span');
    spans.forEach((bar, idx) => {
      const v = Math.max(0.16, Math.min(1, Number(bars[idx] || 0.16)));
      bar.style.transform = `scaleY(${v.toFixed(2)})`;
    });
  }

  function setListeningMicUI(state, subText) {
    const btn = document.getElementById('btn-rl-mic');
    const lbl = document.getElementById('rl-mic-label');
    const sub = document.getElementById('rl-mic-sub');
    const wf = document.getElementById('rl-waveform');
    if (btn) {
      btn.classList.remove('is-recording', 'is-processing', 'is-passed');
      btn.disabled = state === 'processing' || state === 'passed' || state === 'disabled';
      if (state === 'recording') btn.classList.add('is-recording');
      else if (state === 'processing') btn.classList.add('is-processing');
      else if (state === 'passed') btn.classList.add('is-passed');
    }
    if (wf) {
      wf.classList.toggle('is-recording', state === 'recording');
      wf.classList.toggle('is-processing', state === 'processing');
      if (state !== 'recording') resetListeningWaveformUI();
    }
    if (lbl) {
      if (state === 'recording') lbl.textContent = 'Đang nghe… Bấm để chấm';
      else if (state === 'processing') lbl.textContent = 'AI đang khuếch đại & chấm…';
      else if (state === 'passed') lbl.textContent = '✓ Phát âm chuẩn!';
      else if (state === 'disabled') lbl.textContent = 'Đã hết lượt thử';
      else lbl.textContent = 'Bấm để nói lại từ';
    }
    if (sub && subText !== undefined) {
      sub.innerHTML = subText;
    }
  }

  function playListeningRecallAudio(accent = 'en-GB', rate = 0.92) {
    const item = recallTargetItem;
    if (!item || !item.lemma) return;
    if (window.TotoroSpeechSTT?.isRecording?.()) {
      window.TotoroSpeechSTT.abort();
      listeningRecallBusy = false;
      pauseRecallCountdown(false);
      setListeningMicUI('idle');
    }
    speakCleanTextReliable(item.lemma, accent, rate, { engine: 'auto', respectCustom: false });
  }

  function advanceFromListeningStage1Pass(item) {
    const expected = String(item.lemma || '').trim().replace(/\s+/g, ' ').toLowerCase();
    const isSignal = currentScopeKey === 'signal_words' || Boolean(item?.strategy);
    const hasSynTargets = isSignal
      ? splitCsvItems(item?.word_forms).length > 0
      : getEnrichedSynonyms(item).some((s) => {
          const sl = String(s || '').trim().toLowerCase();
          return sl && sl !== expected;
        });
    const hasAntTargets = !isSignal && getEnrichedAntonyms(item).some((a) => {
      const al = String(a || '').trim().toLowerCase();
      return al && al !== expected;
    });
    const hasParaphraseBank = !isSignal && Boolean(window.APP_LISTENING_PARAPHRASES?.hasEntry?.(item.lemma));
    const hasMeaningChoices = !isSignal && Boolean(window.RecognitionTestModule?.buildMeaningDistractors) &&
      (window.RecognitionTestModule.buildMeaningDistractors(item, currentScopeList, 3)?.length >= 2);

    recallStage2Queue = ['type_word'];
    if (isSignal) {
      if (hasSynTargets) recallStage2Queue.push('signal_equiv');
    } else {
      if (hasParaphraseBank) recallStage2Queue.push('paraphrase_think');
      if (hasSynTargets) recallStage2Queue.push('synonym');
      if (hasAntTargets) recallStage2Queue.push('antonym');
      if (hasMeaningChoices) recallStage2Queue.push('meaning_vi');
    }
    advanceRecallStage2Queue(item);
  }

  async function toggleListeningRecallMic() {
    if (!recallTargetItem || recallSubmitted || recallMode !== 'listening_shadow' || recallStage !== 1) return;
    const stt = window.TotoroSpeechSTT;
    if (!stt || !stt.isSupported()) {
      const fb = document.getElementById('recall-feedback');
      if (fb) {
        fb.style.display = 'block';
        fb.className = 'recall-feedback err';
        fb.textContent = 'Trình duyệt này không hỗ trợ thu âm Micro. Hãy chuyển sang Chrome/Edge/Safari hoặc quay về chế độ Reading.';
      }
      return;
    }

    if (stt.isRecording()) {
      stt.stop();
      return;
    }
    if (listeningRecallBusy) return;

    const item = recallTargetItem;
    const fb = document.getElementById('recall-feedback');
    const heardBox = document.getElementById('rl-heard-box');
    if (fb) { fb.style.display = 'none'; fb.textContent = ''; }
    if (heardBox) { heardBox.style.display = 'none'; heardBox.className = 'rl-heard-box'; heardBox.innerHTML = ''; }

    stopSpeechPlayback();
    listeningRecallBusy = true;

    const started = await stt.startRecording({
      mode: 'word',
      maxDurationMs: 5800,
      autoStopOnSilence: true,
      onStart: () => {
        setListeningMicUI(
          'recording',
          'Hãy nói rõ từ vừa nghe (tự dừng khi nói xong · còn <strong>' + recallAttemptsLeft + '</strong> lần thử)'
        );
      },
      onLevel: ({ bars, speechDetected }) => {
        updateListeningWaveformUI(bars);
        if (speechDetected) {
          const sub = document.getElementById('rl-mic-sub');
          if (sub && !sub.dataset.voiceHit) {
            sub.dataset.voiceHit = '1';
            sub.textContent = 'Đã bắt được giọng nói… đang ghi âm!';
          }
        }
      },
      onProcessing: ({ stage, boosted, gainApplied }) => {
        pauseRecallCountdown(true);
        const subEl = document.getElementById('rl-mic-sub');
        if (subEl) delete subEl.dataset.voiceHit;
        const boostNote = (stage === 'upload' && boosted)
          ? `Đã tự khuếch đại giọng nhỏ (${gainApplied}×) · đang nhận diện AI…`
          : 'Đang gửi âm thanh chuẩn hóa tới AI Whisper…';
        setListeningMicUI('processing', boostNote);
      },
      onResult: (res) => {
        listeningRecallBusy = false;
        pauseRecallCountdown(false);
        const subEl = document.getElementById('rl-mic-sub');
        if (subEl) delete subEl.dataset.voiceHit;

        if (!recallTargetItem || recallTargetItem.id !== item.id || recallSubmitted) return;

        if (res.silent) {
          setListeningMicUI('idle', 'Chưa nghe thấy tiếng từ mic — hãy bấm nút và nói gần micro hơn nhé (không mất lượt thử).');
          if (fb) {
            fb.style.display = 'block';
            fb.className = 'recall-feedback err';
            fb.textContent = 'Chưa phát hiện âm thanh giọng nói. Kiểm tra mic chưa bị tắt tiếng rồi thử nói lại!';
          }
          return;
        }

        const check = stt.matchSpokenTarget(res.text || '', item.lemma || '');
        const engineTag = String(res.engine || '').includes('cloudflare') ? 'CF AI' : 'Groq Whisper';
        const boostBadge = res.boosted ? ` · +Gain ${res.gainApplied}×` : '';

        if (check.isNoise) {
          setListeningMicUI('idle', `Không mất lượt thử · bấm nút hoặc <strong>Space</strong> để nói rõ lại (còn <strong>${recallAttemptsLeft}</strong> lần).`);
          if (heardBox) {
            heardBox.style.display = 'block';
            heardBox.className = 'rl-heard-box is-warn';
            heardBox.innerHTML = `<span class="rl-heard-lbl">Chưa bắt được từ rõ ràng</span><span class="rl-heard-meta">${escapeHtml(engineTag)}${escapeHtml(boostBadge)}</span>`;
          }
          return;
        }

        if (check.matched) {
          stopRecallInputTimer();
          setListeningMicUI('passed', '✓ Chuẩn phát âm! Đang chuyển sang Test 2…');
          if (heardBox) {
            heardBox.style.display = 'block';
            heardBox.className = 'rl-heard-box is-pass';
            heardBox.innerHTML = `<span class="rl-heard-lbl">✓ Bạn đã nói: <strong>"${escapeHtml(check.heard)}"</strong></span><span class="rl-heard-meta">${escapeHtml(engineTag)}${escapeHtml(boostBadge)}</span>`;
          }
          setTimeout(() => {
            if (!recallTargetItem || recallTargetItem.id !== item.id || recallSubmitted) return;
            advanceFromListeningStage1Pass(item);
          }, 420);
          return;
        }

        recallAttemptsLeft = Math.max(0, recallAttemptsLeft - 1);
        if (heardBox) {
          heardBox.style.display = 'block';
          heardBox.className = 'rl-heard-box is-fail';
          heardBox.innerHTML = `<span class="rl-heard-lbl">AI nghe thành: <strong>"${escapeHtml(check.heard)}"</strong></span><span class="rl-heard-meta">${escapeHtml(engineTag)}${escapeHtml(boostBadge)}</span>`;
        }

        if (recallAttemptsLeft > 0) {
          setListeningMicUI('idle', `Còn <strong>${recallAttemptsLeft}</strong> lần thử · bấm nút hoặc nhấn <strong>Space</strong> nói rõ lại (không phát lại audio)!`);
          if (fb) {
            fb.style.display = 'block';
            fb.className = 'recall-feedback err';
            fb.textContent = `Chưa khớp từ mẫu! Hãy nhớ lại trọng âm & âm cuối rồi nói lại (còn ${recallAttemptsLeft} lần thử).`;
          }
          return;
        }

        setListeningMicUI('disabled', 'Đã hết lượt thử cho thẻ này.');
        failRecallCheck(item, 'Phát âm chưa khớp!');
      },
      onError: (msg) => {
        listeningRecallBusy = false;
        pauseRecallCountdown(false);
        const subEl = document.getElementById('rl-mic-sub');
        if (subEl) delete subEl.dataset.voiceHit;
        setListeningMicUI('idle', `Không mất lượt thử · còn <strong>${recallAttemptsLeft}</strong> lần thử.`);
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback err';
          fb.textContent = msg || 'Lỗi micro hoặc kết nối STT. Hãy thử lại!';
        }
      },
    });

    if (!started) {
      listeningRecallBusy = false;
      pauseRecallCountdown(false);
    }
  }

  let quickMicTesting = false;
  async function runQuickListeningMicTest() {
    const stt = window.TotoroSpeechSTT;
    const btn = document.getElementById('btn-listening-quick-mic-test');
    const lbl = document.getElementById('lsb-mic-test-label');
    if (!stt || !stt.isSupported()) {
      showToast('Trình duyệt không hỗ trợ thu âm Micro.');
      return;
    }
    if (stt.isRecording()) {
      stt.stop();
      return;
    }
    if (quickMicTesting) return;
    quickMicTesting = true;
    const curItem = currentScopeList[currentCardIndex];
    const sampleWord = curItem?.lemma || 'hello';
    if (btn) btn.classList.add('is-recording');
    if (lbl) lbl.textContent = `Đang nghe… nói "${sampleWord}"`;

    const started = await stt.startRecording({
      mode: 'word',
      maxDurationMs: 5000,
      autoStopOnSilence: true,
      onProcessing: () => {
        if (btn) btn.classList.remove('is-recording');
        if (lbl) lbl.textContent = 'Đang chấm AI…';
      },
      onResult: (res) => {
        quickMicTesting = false;
        if (btn) btn.classList.remove('is-recording');
        if (lbl) lbl.textContent = 'Test Mic AI';
        if (res.silent) {
          showToast('🎙️ Mic chưa thu được tiếng — hãy nói gần hơn hoặc kiểm tra mic hệ thống nhé!');
          return;
        }
        const match = curItem ? stt.matchSpokenTarget(res.text || '', curItem.lemma || '') : null;
        const gainNote = res.boosted ? ` (tự kích âm ${res.gainApplied}×)` : '';
        if (match && match.matched) {
          showToast(`✅ Mic rất chuẩn! AI nghe: "${res.text}"${gainNote}`);
        } else {
          showToast(`🎙️ AI nghe được: "${res.text || '(trống)'}"${gainNote}`);
        }
      },
      onError: (msg) => {
        quickMicTesting = false;
        if (btn) btn.classList.remove('is-recording');
        if (lbl) lbl.textContent = 'Test Mic AI';
        showToast(msg || 'Không thể test mic lúc này.');
      },
    });
    if (!started) {
      quickMicTesting = false;
      if (btn) btn.classList.remove('is-recording');
      if (lbl) lbl.textContent = 'Test Mic AI';
    }
  }

  function openRecallModal(item) {
    if (!isExamAntiCheatBypassed() && !syncExamLock(true, 'Kiểm tra nhớ từ')) return;
    syncAntiCopyClasses();
    stopRecallInputTimer();
    window.TotoroSpeechSTT?.abort?.();
    if (listeningAutoPlayTimer) { clearTimeout(listeningAutoPlayTimer); listeningAutoPlayTimer = null; }
    recallTimerPausedAt = 0;
    listeningRecallBusy = false;

    const rule = getRecallRule(item);
    recallTargetItem = item;
    recallSubmitted = false;
    recallStage = 1;
    recallStage2Type = 'synonym';
    recallStage2Queue = [];
    recallWbSentence = '';
    recallWbTitle = '';
    const useListeningShadow = isListeningSkillActive() && Boolean(window.TotoroSpeechSTT?.isSupported?.());
    const useQuickVi = !useListeningShadow && isReadingQuickScopeKey(currentScopeKey) && Boolean(window.RecognitionTestModule?.buildMeaningDistractors);
    recallMode = useListeningShadow ? 'listening_shadow' : (useQuickVi ? 'quick_vi' : 'standard');
    recallAttemptsLeft = useListeningShadow ? (rule.strict ? 2 : 3) : (useQuickVi ? 1 : rule.maxAttempts);
    recallLeaveWarnings = 0;
    lastRecallLeaveAt = 0;
    recallSynOptions = [];
    recallSynSelected = new Set();

    const limitSec = useListeningShadow ? 45 : (useQuickVi ? 5 : getRecallTimeLimitSec(item, 1));
    recallDeadlineAt = Date.now() + limitSec * 1000;

    const stageBadge = document.getElementById('recall-stage-badge');
    const timerBadge = document.getElementById('recall-timer-badge');
    const hintBox = document.getElementById('recall-hint-box');
    const targetSubEl = document.querySelector('#recall-stage2-target .recall-stage-sub');
    const targetWordEl = document.getElementById('recall-stage2-word');
    const stage1Body = document.getElementById('recall-stage1-body');
    const listenBody = document.getElementById('recall-listening-body');
    const stage2Body = document.getElementById('recall-stage2-body');
    const inp = document.getElementById('recall-word-input');
    const fb = document.getElementById('recall-feedback');
    const btnCancel = document.getElementById('btn-recall-cancel');
    const btnSubmit = document.getElementById('btn-recall-submit');
    const btnReturn = document.getElementById('btn-recall-return');

    if (useListeningShadow) {
      resetRecallSpeedBarUI(false);
      if (stageBadge) stageBadge.textContent = '1-Shot Nghe & Nói';
      if (timerBadge) {
        timerBadge.textContent = `${limitSec}s`;
        timerBadge.classList.remove('is-urgent', 'is-speed-pulse');
      }
      if (hintBox) hintBox.style.display = 'none';
      if (stage1Body) stage1Body.style.display = 'none';
      if (stage2Body) stage2Body.style.display = 'none';
      if (listenBody) listenBody.style.display = 'block';
      if (btnSubmit) btnSubmit.style.display = 'none';

      const cueBox = document.getElementById('rl-cue-box');
      const posEl = document.getElementById('rl-cue-pos');
      const meanEl = document.getElementById('rl-cue-meaning');
      const heardBox = document.getElementById('rl-heard-box');
      if (cueBox) cueBox.style.display = 'none';
      if (posEl) posEl.textContent = '';
      if (meanEl) meanEl.textContent = '';
      if (heardBox) {
        heardBox.style.display = 'none';
        heardBox.className = 'rl-heard-box';
        heardBox.innerHTML = '';
      }
      setListeningMicUI(
        'idle',
        `Nhấn <strong>Space</strong> hoặc bấm Mic để nói (còn <strong>${recallAttemptsLeft}</strong> lần)`
      );
      listeningAutoPlayTimer = setTimeout(() => {
        if (recallTargetItem && recallTargetItem.id === item.id && recallMode === 'listening_shadow' && !recallSubmitted) {
          const recallAccents = ['en-GB', 'en-AU', 'en-US', 'en-NZ'];
          const pickedAccent = recallAccents[(currentCardIndex || 0) % recallAccents.length];
          playListeningRecallAudio(pickedAccent, 0.92);
        }
      }, 220);
    } else if (useQuickVi) {
      const choices = window.RecognitionTestModule.buildMeaningDistractors(item, currentScopeList, 3);
      recallSynOptions = choices.map((c) => ({ text: c.meaning, isCorrect: c.isCorrect }));
      if (stageBadge) stageBadge.textContent = 'Phản xạ 5s';
      if (timerBadge) {
        timerBadge.textContent = `${limitSec}s`;
        timerBadge.classList.remove('is-urgent');
      }
      if (hintBox) hintBox.style.display = 'block';
      const ipaTxt = getIPA(item);
      const posTxt = getCleanPos(item);
      if (targetSubEl) targetSubEl.textContent = `${ipaTxt !== '/.../' ? ipaTxt + ' · ' : ''}${posTxt}`;
      if (targetWordEl) {
        targetWordEl.className = 'recall-stage-word';
        targetWordEl.textContent = item.lemma || '';
      }
      if (stage1Body) stage1Body.style.display = 'none';
      if (listenBody) listenBody.style.display = 'none';
      if (stage2Body) stage2Body.style.display = 'block';
      if (btnSubmit) btnSubmit.style.display = 'none';
      renderRecallSynGrid(false);
    } else {
      resetRecallSpeedBarUI(false);
      if (stageBadge) stageBadge.textContent = 'Test 1';
      if (timerBadge) {
        timerBadge.textContent = `${limitSec}s`;
        timerBadge.classList.remove('is-urgent', 'is-speed-pulse');
      }
      if (hintBox) hintBox.style.display = 'none';
      if (stage1Body) stage1Body.style.display = 'block';
      if (listenBody) listenBody.style.display = 'none';
      if (stage2Body) stage2Body.style.display = 'none';
      if (inp) {
        inp.value = '';
        inp.disabled = false;
      }
      if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    }
    if (fb) {
      fb.style.display = 'none';
      fb.className = 'recall-feedback';
      fb.innerHTML = '';
    }
    if (btnCancel) {
      btnCancel.style.display = 'inline-flex';
      const abortPenaltySec = rule.strict ? 90 : 60;
      btnCancel.textContent = isExamAntiCheatBypassed() ? 'Hủy' : `Bỏ bài (-${abortPenaltySec}s)`;
    }
    const btnCloseX = document.getElementById('btn-recall-close');
    if (btnCloseX) {
      const abortPenaltySec = rule.strict ? 90 : 60;
      btnCloseX.title = isExamAntiCheatBypassed()
        ? 'Đóng'
        : `Thoát giữa chừng sẽ bị hạ về Chưa thuộc và khóa nút Đã thuộc ${abortPenaltySec}s`;
    }
    if (btnReturn) btnReturn.style.display = 'none';

    updateRecallPromptAttempts(item);
    setRecallActiveSession(item, 1);
    document.getElementById('fc-scene')?.style.setProperty('visibility', 'hidden');
    document.querySelector('#modal-recall-check .recall-check-card')?.style.removeProperty('visibility');
    document.getElementById('modal-recall-check')?.classList.add('open');
    recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
    if (!useQuickVi && !useListeningShadow) setTimeout(() => inp?.focus(), 40);
  }

  function abortRecallCheck() {
    const item = recallTargetItem;
    if (!item || recallSubmitted) return;
    const rule = getRecallRule(item);
    const penaltySec = rule.strict ? 90 : 60;
    stopRecallInputTimer();
    resetRecallSpeedBarUI(false);
    clearRecallActiveSession();
    recallSubmitted = true;
    recallAttemptsLeft = 0;
    masterCooldowns[item.id] = Date.now() + penaltySec * 1000;
    saveMasterCooldowns();
    ensureCooldownTicker();
    commitAssessment(item, 1);
    updateAssess3CooldownUI();
    closeRecallModal(null, true);
    showToast(`Bỏ kiểm tra nhớ từ "${item.lemma}" giữa chừng — hạ về Chưa thuộc và khóa nút Đã thuộc ${penaltySec}s!`);
  }

  function closeRecallModal(event, forceSilent = false) {
    if (event) {
      if (event.target !== document.getElementById('modal-recall-check')) return;
      if (!forceSilent && recallTargetItem && !recallSubmitted && currentUser && !isExamAntiCheatBypassed()) {
        showToast('Đang Kiểm tra nhớ từ — hãy hoàn thành hoặc bấm Bỏ bài (phạt chờ 60s).');
        return;
      }
    }
    if (!forceSilent && !event && recallTargetItem && !recallSubmitted && currentUser && !isExamAntiCheatBypassed()) {
      abortRecallCheck();
      return;
    }
    stopRecallInputTimer();
    window.TotoroSpeechSTT?.abort?.();
    if (listeningAutoPlayTimer) { clearTimeout(listeningAutoPlayTimer); listeningAutoPlayTimer = null; }
    recallTimerPausedAt = 0;
    listeningRecallBusy = false;
    resetRecallSpeedBarUI(false);
    clearRecallActiveSession();
    document.getElementById('modal-recall-check')?.classList.remove('open');
    const listenBodyClose = document.getElementById('recall-listening-body');
    if (listenBodyClose) listenBodyClose.style.display = 'none';
    document.querySelector('#modal-recall-check .recall-check-card')?.style.removeProperty('visibility');
    document.getElementById('fc-scene')?.style.removeProperty('visibility');
    recallTargetItem = null;
    recallSubmitted = false;
    recallStage = 1;
    recallAttemptsLeft = 2;
    recallLeaveWarnings = 0;
    lastRecallLeaveAt = 0;
    recallSynOptions = [];
    recallSynSelected = new Set();
    syncExamLock(false);
  }

  function commitAssessment(item, level) {
    const now = Date.now();
    assessments[item.id] = level;
    srsData[item.id] = computeNextAnkiState(item.id, level, now);
    if (level === 3) syncLemmaPeersMastery(item.id, 3, now);
    renderStatusTag('fc-front-status', level);
    renderStatusTag('fc-back-status', level);
    saveState();

    recordDailyWordActivity();
    saveStudyTimerState();
    updateStudyStreakUI();
    updateVocabMasteryUI();
    updateLeaderboardUI();
    window.TasksModule?.onStudyAssessmentChanged?.(currentScopeKey, assessments, item, level);
    document.dispatchEvent(new CustomEvent('vocab:assessed', { detail: { id: item.id, level } }));
    scheduleCloudPush();
  }

  function submitRecallCheck(event) {
    if (event) event.preventDefault();
    if (!recallTargetItem || recallSubmitted) return;

    const item = recallTargetItem;
    const fb = document.getElementById('recall-feedback');

    if (recallStage === 1 || (recallStage === 2 && recallStage2Type === 'type_word')) {
      const inp = document.getElementById('recall-word-input');
      const typed = String(inp?.value || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const expected = String(item.lemma || '').trim().replace(/\s+/g, ' ').toLowerCase();
      const acceptedVariants = expected.includes('/')
        ? [expected, ...expected.split('/').map((s) => s.trim()).filter(Boolean)]
        : [expected];

      if (!typed) {
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback err';
          fb.textContent = 'Vui lòng gõ lại từ tiếng Anh trước khi xác nhận.';
        }
        inp?.focus();
        return;
      }

      if (acceptedVariants.includes(typed)) {
        if (recallStage === 2 && recallStage2Type === 'type_word') {
          advanceRecallStage2Queue(item);
          return;
        }
        const isSignal = currentScopeKey === 'signal_words' || Boolean(item?.strategy);
        const hasSynTargets = isSignal
          ? splitCsvItems(item?.word_forms).length > 0
          : getCleanSynonyms(item).some((s) => {
              const sl = String(s || '').trim().toLowerCase();
              return sl && sl !== expected;
            });
        const hasFormTargets = !isSignal && (Array.isArray(item?.clean_forms) ? item.clean_forms : []).some((f) => {
          const fl = String(f || '').trim().toLowerCase();
          return fl && fl !== expected;
        });
        const hasMeaningChoices = !isSignal && Boolean(window.RecognitionTestModule?.buildMeaningDistractors) &&
          (window.RecognitionTestModule.buildMeaningDistractors(item, currentScopeList, 3)?.length >= 2);

        recallStage2Queue = [];
        if (isSignal) {
          if (hasSynTargets) recallStage2Queue.push('signal_equiv');
        } else {
          if (hasSynTargets) recallStage2Queue.push('synonym');
          if (hasFormTargets) recallStage2Queue.push('wordfamily');
          if (hasMeaningChoices) recallStage2Queue.push('meaning_vi');
        }
        advanceRecallStage2Queue(item);
        return;
      }

      recallAttemptsLeft = Math.max(0, recallAttemptsLeft - 1);
      if (recallAttemptsLeft > 0) {
        updateRecallPromptAttempts(item);
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback err';
          fb.textContent = `Chưa chính xác! Bạn còn ${recallAttemptsLeft} lần thử lại.`;
        }
        inp?.select();
        inp?.focus();
        return;
      }

      failRecallCheck(item, 'Chưa chính xác!');
      return;
    }

    // Stage 2: synonym selection OR Word Box verification
    if (recallSynSelected.size === 0) {
      if (fb) {
        fb.style.display = 'block';
        fb.className = 'recall-feedback err';
        fb.textContent = recallStage2Type === 'wordbox'
          ? 'Vui lòng click chọn 1 từ trong Word Box để điền vào câu trước khi xác nhận.'
          : (recallStage2Type === 'wordfamily'
            ? 'Vui lòng click chọn ít nhất 1 từ cùng gia đình từ (Word Family) trước khi xác nhận.'
            : (recallStage2Type === 'antonym'
              ? 'Vui lòng click chọn ít nhất 1 từ trái nghĩa trước khi xác nhận.'
              : 'Vui lòng click chọn ít nhất 1 từ đồng nghĩa trước khi xác nhận.'));
      }
      return;
    }

    const correctIndices = recallSynOptions
      .map((opt, idx) => (opt.isCorrect ? idx : -1))
      .filter((idx) => idx !== -1);
    const isExactMatch =
      recallSynSelected.size === correctIndices.length &&
      correctIndices.every((idx) => recallSynSelected.has(idx));

    if (isExactMatch) {
      if (Array.isArray(recallStage2Queue) && recallStage2Queue.length > 0) {
        advanceRecallStage2Queue(item);
        return;
      }
      finalizeRecallMastery(item);
      return;
    }

    recallAttemptsLeft = Math.max(0, recallAttemptsLeft - 1);
    if (recallAttemptsLeft > 0) {
      updateRecallPromptAttempts(item);
      if (fb) {
        fb.style.display = 'block';
        fb.className = 'recall-feedback err';
        fb.textContent = recallStage2Type === 'wordfamily'
          ? `Chưa chính xác! Hãy chọn lại các từ cùng gia đình từ (còn ${recallAttemptsLeft} lần thử).`
          : `Chưa chính xác! Hãy chọn lại các từ đồng nghĩa (còn ${recallAttemptsLeft} lần thử).`;
      }
      return;
    }

    failRecallCheck(item, 'Chưa chính xác!');
  }

  let suppressSwipeClickUntil = 0;
  let lastBackScrollAt = 0;

  function bindBackScrollFlipGuard() {
    const scrollEl = document.querySelector('#fc-card .fc-back-scrollable');
    if (!scrollEl || scrollEl.dataset.scrollGuardBound === '1') return;
    scrollEl.dataset.scrollGuardBound = '1';
    scrollEl.addEventListener('scroll', () => {
      lastBackScrollAt = Date.now();
    }, { passive: true });
    scrollEl.addEventListener('pointerdown', (e) => {
      const rect = scrollEl.getBoundingClientRect();
      if (scrollEl.scrollHeight > scrollEl.clientHeight + 2 && e.clientX >= rect.left + scrollEl.clientWidth - 2) {
        suppressSwipeClickUntil = Date.now() + 600;
      }
    });
  }

  let flipSettleTimer = null;
  function flipCurrentCard(event) {
    bindBackScrollFlipGuard();
    if (event && event.currentTarget?.id === 'fc-scene' && Date.now() < suppressSwipeClickUntil) return;
    if (event && event.currentTarget?.id === 'fc-scene' && (Date.now() - lastBackScrollAt) < 280) return;
    if (event && event.currentTarget?.id === 'fc-scene' && event.target.closest('button')) return;
    if (event && event.currentTarget?.id === 'fc-scene') {
      const scrollEl = event.target?.closest?.('.fc-back-scrollable');
      if (scrollEl && scrollEl.scrollHeight > scrollEl.clientHeight + 2) {
        const rect = scrollEl.getBoundingClientRect();
        if (event.clientX >= rect.left + scrollEl.clientWidth - 2) return;
      }
    }
    if (currentScopeList.length === 0 || currentCardIndex >= currentScopeList.length) return;
    isCardFlipped = !isCardFlipped;
    if (isCardFlipped) {
      const backScrollEl = document.querySelector('#fc-card .fc-back-scrollable');
      if (backScrollEl) backScrollEl.scrollTop = 0;
    }
    const sceneEl = document.getElementById('fc-scene');
    const cardEl = document.getElementById('fc-card');
    if (sceneEl && cardEl) {
      if (flipSettleTimer) clearTimeout(flipSettleTimer);
      sceneEl.classList.add('is-3d-flipping');
      void cardEl.offsetWidth;
      cardEl.classList.toggle('flipped', isCardFlipped);
      flipSettleTimer = setTimeout(() => {
        sceneEl.classList.remove('is-3d-flipping');
        flipSettleTimer = null;
      }, 620);
    } else if (cardEl) {
      cardEl.classList.toggle('flipped', isCardFlipped);
    }
    document.getElementById('btn-flip-action').textContent = isCardFlipped ? 'Mặt trước' : 'Xem nghĩa';
    if (isCardFlipped && autoSpeak) {
      pendingInitialSpeak = false;
      speakCurrentWord('en-GB', null, 'auto');
    } else if (pendingInitialSpeak && autoSpeak) {
      pendingInitialSpeak = false;
      speakCurrentWord('en-US', null, 'auto');
    }
  }

  let cardStepOutTimer = null;
  let cardStepInTimer = null;
  let pendingCardStep = 0;

  function flushPendingCardStep() {
    if (!cardStepOutTimer) return false;
    clearTimeout(cardStepOutTimer);
    cardStepOutTimer = null;
    const step = pendingCardStep;
    pendingCardStep = 0;
    if (step > 0 && currentCardIndex < currentScopeList.length) {
      currentCardIndex++;
    } else if (step < 0 && currentCardIndex > 0) {
      currentCardIndex--;
    }
    return true;
  }

  function stepCardChoreographed(dir) {
    const mode = document.documentElement.dataset.motion || 'pro';
    const scene = document.getElementById('fc-scene');
    const motionWrap = document.getElementById('fc-motion-wrap');
    const card = document.getElementById('fc-card');

    const wasMidStep = flushPendingCardStep();
    if (cardStepInTimer) { clearTimeout(cardStepInTimer); cardStepInTimer = null; }

    // Mode 4 ("Trượt nảy" / original): exact original index.html instant swap + spring enterCard()
    if (mode === 'original' || !window.IELTSMotion?.enabled || !motionWrap || !scene || !card || scene.style.display === 'none') {
      if (dir > 0) {
        if (currentCardIndex < currentScopeList.length) currentCardIndex++;
        else return;
      } else if (currentCardIndex > 0) {
        currentCardIndex--;
      } else {
        return;
      }
      renderCurrentCard(dir);
      return;
    }

    if (dir < 0 && currentCardIndex <= 0) {
      motionWrap.classList.remove('out-next', 'in-next', 'out-prev', 'in-prev');
      scene.classList.remove('shifting');
      if (wasMidStep) renderCurrentCard(0);
      return;
    }
    if (dir > 0 && currentCardIndex >= currentScopeList.length) {
      motionWrap.classList.remove('out-next', 'in-next', 'out-prev', 'in-prev');
      scene.classList.remove('shifting');
      renderCurrentCard(0);
      return;
    }

    // Reset motion classes cleanly before starting the new phase
    motionWrap.classList.remove('out-next', 'in-next', 'out-prev', 'in-prev');
    void motionWrap.offsetWidth;

    // Exact 1-to-1 demo_v3.html two-phase choreography (out -> silent reset & swap -> in)
    const outCls = dir > 0 ? 'out-next' : 'out-prev';
    const inCls = dir > 0 ? 'in-next' : 'in-prev';
    const isCalmPro = (document.documentElement.dataset.mode || 'calm') === 'calm' && mode === 'pro';
    const outMs = isCalmPro ? 285 : (mode === 'morph' ? 125 : 150);
    const inMs = isCalmPro ? 270 : (mode === 'morph' ? 185 : 210);

    pendingCardStep = dir;
    // Speak synchronously inside the user gesture so Mobile Safari / strict Chrome allow TTS playback
    const previewNextIdx = dir > 0 ? currentCardIndex + 1 : currentCardIndex - 1;
    const previewNextItem = (previewNextIdx >= 0 && previewNextIdx < currentScopeList.length)
      ? currentScopeList[previewNextIdx]
      : null;
    if (autoSpeak && previewNextItem && currentUser) {
      pendingInitialSpeak = false;
      speakCleanTextReliable(previewNextItem.lemma, 'en-US', 0.92, { engine: 'auto' });
    }
    scene.classList.add('shifting');
    motionWrap.classList.add(outCls);

    cardStepOutTimer = setTimeout(() => {
      cardStepOutTimer = null;
      const step = pendingCardStep;
      pendingCardStep = 0;
      if (step > 0) {
        if (currentCardIndex < currentScopeList.length) currentCardIndex++;
      } else if (step < 0 && currentCardIndex > 0) {
        currentCardIndex--;
      }

      // Reset flipped state with transition suppressed so card NEVER visibly un-flips mid-swap
      card.style.setProperty('transition', 'none', 'important');
      renderCurrentCard(0, { speak: false });
      void card.offsetWidth;
      card.style.removeProperty('transition');

      motionWrap.classList.remove(outCls);
      motionWrap.classList.add(inCls);
      cardStepInTimer = setTimeout(() => {
        cardStepInTimer = null;
        motionWrap.classList.remove(inCls);
        scene.classList.remove('shifting');
      }, inMs);
    }, outMs);
  }

  function nextCard() {
    cancelPendingAdvance();
    if (currentScopeList.length === 0) return;
    stepCardChoreographed(1);
  }

  function prevCard() {
    cancelPendingAdvance();
    if (currentCardIndex > 0 || (cardStepOutTimer && pendingCardStep > 0)) {
      stepCardChoreographed(-1);
    }
  }

  function assessCurrentWord(level, event) {
    if (event) event.stopPropagation();
    if (isAdvancing) return;
    const item = currentScopeList[currentCardIndex];
    if (!item) return;

    if (level === 3) {
      const rem = getMasterCooldownRemainingSec(item.id);
      if (rem > 0) {
        showToast(`Hãy xem lại thẻ và thử lại sau ${rem} giây.`);
        return;
      }
      openRecallModal(item);
      return;
    }

    commitAssessment(item, level);

    isAdvancing = true;
    if (window.IELTSMotion?.enabled) {
      document.getElementById('fc-scene')?.classList.add('assess-out-' + level);
    }
    advanceTimeout = setTimeout(() => {
      if (!isAdvancing) return;
      isAdvancing = false;
      advanceTimeout = null;
      if ((onlyUnmastered && level === 3) || (onlyDueReview && level >= 2)) {
        currentScopeList.splice(currentCardIndex, 1);
        updateVocabMasteryUI();
        if (onlyDueReview && currentScopeList.length === 0) {
          onlyDueReview = false;
          showToast('Tuyệt vời! Bạn đã ôn hết từ cần ôn hôm nay!');
          applyFilterAndBuildDeck();
          return;
        }
        renderCurrentCard(1);
      } else {
        nextCard();
      }
    }, window.IELTSMotion?.enabled ? 240 : 0);
  }

  function toggleDueReviewFilter() {
    onlyDueReview = !onlyDueReview;
    if (onlyDueReview) {
      onlyUnmastered = false;
      ankiReminderDismissed = true;
    }
    applyFilterAndBuildDeck();
    saveState();
    if (onlyDueReview) {
      if (currentScopeList.length === 0) {
        onlyDueReview = false;
        applyFilterAndBuildDeck();
        showToast('Hiện chưa có từ nào đến hạn cần ôn lại!');
      } else {
        showToast(`Đang ôn ${currentScopeList.length} từ đến hạn`);
      }
    } else {
      showToast('Đã trở về danh sách học đầy đủ');
    }
  }

  function activateDueReviewOnly() {
    onlyDueReview = true;
    onlyUnmastered = false;
    ankiReminderDismissed = true;
    applyFilterAndBuildDeck();
    if (currentScopeList.length === 0) {
      onlyDueReview = false;
      applyFilterAndBuildDeck();
      showToast('Hiện chưa có từ nào đến hạn cần ôn lại!');
    } else {
      showToast(`Đang ôn ${currentScopeList.length} từ đến hạn`);
    }
  }

  function toggleUnmasteredFilter() {
    onlyUnmastered = !onlyUnmastered;
    if (onlyUnmastered) onlyDueReview = false;
    applyFilterAndBuildDeck();
    saveState();
    showToast(onlyUnmastered ? `Đang lọc ${currentScopeList.length} từ chưa thuộc` : 'Hiện tất cả từ trong bộ');
  }

  function activateUnmasteredOnly() {
    onlyUnmastered = true;
    onlyDueReview = false;
    applyFilterAndBuildDeck();
    if (currentScopeList.length === 0) {
      showToast('Bạn đã thuộc 100% bộ từ này!');
      onlyUnmastered = false;
      applyFilterAndBuildDeck();
    } else {
      showToast(`Đang ôn ${currentScopeList.length} từ chưa thuộc`);
    }
  }

  function restartScopeStudy() {
    cancelPendingAdvance();
    currentCardIndex = 0;
    renderCurrentCard();
  }

  function shuffleCurrentScope() {
    cancelPendingAdvance();
    for (let i = currentScopeList.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [currentScopeList[i], currentScopeList[j]] = [currentScopeList[j], currentScopeList[i]];
    }
    currentCardIndex = 0;
    renderCurrentCard();
    showToast('Đã trộn ngẫu nhiên thứ tự thẻ');
  }

  function stopSpeechPlayback() {
    if (speakTimeout) {
      clearTimeout(speakTimeout);
      speakTimeout = null;
    }
    if (window.AppCore?.audio) {
      window.AppCore.audio.stop();
      return;
    }
    try {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    } catch (_) {}
  }

  function updateAutoSpeakUI() {
    const chk = document.getElementById('chk-auto-speak');
    if (chk) chk.checked = autoSpeak;
    const btnUs = document.getElementById('btn-auto-accent-us');
    const btnUk = document.getElementById('btn-auto-accent-uk');
    if (btnUs) btnUs.classList.toggle('active', preferredAccent !== 'en-GB');
    if (btnUk) btnUk.classList.toggle('active', preferredAccent === 'en-GB');
  }

  function setAutoSpeakAccent(accent) {
    preferredAccent = (accent === 'en-GB') ? 'en-GB' : 'en-US';
    updateAutoSpeakUI();
    saveState();
    speakCurrentWord(preferredAccent);
    showToast(`Đã chọn giọng tự đọc: ${preferredAccent === 'en-GB' ? 'UK' : 'US'}`);
  }

  function populateVoiceSelectUI() {
    const sel = document.getElementById('settings-voice-select');
    const audio = window.AppCore?.audio;
    if (!sel || !audio) return;
    const enVoices = audio.getEnglishVoices?.() || [];
    const saved = audio.getPreferredVoiceName?.() || '';
    const opts = ['<option value="">Tự động (Nữ ấm áp)</option>'];
    enVoices.forEach((v) => {
      const label = `${v.name} (${v.lang})`;
      opts.push(`<option value="${escapeHtml(v.name)}"${v.name === saved ? ' selected' : ''}>${escapeHtml(label)}</option>`);
    });
    sel.innerHTML = opts.join('');
    sel.value = saved;
  }

  function onPreferredVoiceChange(voiceName) {
    window.AppCore?.audio?.setPreferredVoiceName?.(voiceName || '');
    previewSelectedVoice();
    showToast(voiceName ? `Đã chọn giọng: ${voiceName}` : 'Đã đặt về Tự động (Nữ ấm áp)');
  }

  function previewSelectedVoice() {
    const sample = currentScopeList?.[currentCardIndex]?.lemma || 'researcher';
    window.AppCore?.audio?.speak?.(sample, { accent: preferredAccent || 'en-US', rate: 0.92, respectCustom: true });
  }
  window.addEventListener('app:voices-updated', populateVoiceSelectUI);

  function toggleAutoSpeak(arg) {
    if (arg && typeof arg.stopPropagation === 'function') {
      arg.stopPropagation();
      autoSpeak = !autoSpeak;
    } else if (typeof arg === 'boolean') {
      autoSpeak = arg;
    } else {
      autoSpeak = !autoSpeak;
    }
    pendingInitialSpeak = false;
    updateAutoSpeakUI();
    saveState();
    if (autoSpeak) {
      speakCurrentWord();
      showToast('Đã bật tự đọc (Mặt trước US · Mặt sau UK)');
    } else {
      stopSpeechPlayback();
      showToast('Đã tắt tự động đọc từ vựng');
    }
  }

  function speakCleanTextReliable(text, targetAccent, rate = 0.92, opts = {}) {
    if (window.AppCore?.audio) {
      window.AppCore.audio.speak(text, {
        accent: targetAccent,
        rate,
        engine: opts?.engine || 'auto',
        respectCustom: opts?.respectCustom !== false,
      });
      return;
    }
    const clean = String(text || '').replace(/\s*\/\s*/g, ' or ').trim();
    if (!clean || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;
    try {
      window.speechSynthesis.cancel();
      const utt = new SpeechSynthesisUtterance(clean);
      utt.lang = targetAccent;
      utt.rate = rate;
      window.speechSynthesis.speak(utt);
    } catch (_) {}
  }

  window.addEventListener('app:audio-start', () => {
    document.getElementById('fc-listening-front-stage')?.classList.add('is-speaking');
  });
  window.addEventListener('app:audio-end', () => {
    document.getElementById('fc-listening-front-stage')?.classList.remove('is-speaking');
  });

  function speakCurrentWord(accent, event, engineOverride) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const defaultSideAccent = isCardFlipped ? 'en-GB' : 'en-US';
    const targetAccent = (accent === 'en-GB' || accent === 'en-US') ? accent : defaultSideAccent;
    const item = currentScopeList[currentCardIndex];
    if (!item || !currentUser) return;

    if (speakTimeout) {
      clearTimeout(speakTimeout);
      speakTimeout = null;
    }
    // Unified studio-first engine across PC, iPad, iPhone & Android so UK/US & front/back sound identical
    const chosenEngine = engineOverride || 'auto';
    const triggerBtn = event?.currentTarget?.closest?.('.btn-voice-speak') || event?.target?.closest?.('.btn-voice-speak');
    if (triggerBtn) {
      triggerBtn.classList.add('is-speaking');
      clearTimeout(triggerBtn._speakPulseTimer);
      triggerBtn._speakPulseTimer = setTimeout(() => triggerBtn.classList.remove('is-speaking'), 550);
    }
    speakCleanTextReliable(item.lemma, targetAccent, 0.92, {
      engine: chosenEngine,
      respectCustom: !event,
    });
  }

  /* =========================================================
     MODALS: WORD LIST, SIGNAL WORDS, TACTICS, SETTINGS
     ========================================================= */
  function openWordListModal() {
    document.getElementById('modal-word-list')?.classList.add('open');
    filterWordList();
  }

  function closeWordListModal(event) {
    if (event && event.target !== document.getElementById('modal-word-list')) return;
    document.getElementById('modal-word-list')?.classList.remove('open');
  }

  function filterWordListByStatus(status) {
    wlStatus = ['all', 'unremembered', 'slow', 'mastered'].includes(status) ? status : 'all';
    ['all', 'unremembered', 'slow', 'mastered'].forEach(s => {
      document.getElementById('wl-filter-' + s)?.classList.toggle('active', s === wlStatus);
    });
    filterWordList();
  }

  function onWordListSearch(q) {
    wlQuery = (q || '').toLowerCase().trim();
    filterWordList();
  }

  function filterWordList() {
    let list = [...currentScopeList];
    if (wlStatus === 'unremembered') list = list.filter(x => assessments[x.id] === 1);
    else if (wlStatus === 'slow') list = list.filter(x => assessments[x.id] === 2);
    else if (wlStatus === 'mastered') list = list.filter(x => assessments[x.id] === 3);

    if (wlQuery) {
      list = list.filter(x =>
        (x.lemma || '').toLowerCase().includes(wlQuery) ||
        (x.clean_meaning || x.definition || '').toLowerCase().includes(wlQuery) ||
        (x.word_forms || '').toLowerCase().includes(wlQuery)
      );
    }

    wlFiltered = list;
    wlCount = Math.min(80, wlFiltered.length);
    const totalEl = document.getElementById('wl-total-count');
    if (totalEl) totalEl.textContent = wlFiltered.length;
    renderWordList();
  }

  function renderWordList() {
    const container = document.getElementById('word-list-container');
    const btnMore = document.getElementById('btn-load-more-words');
    if (!container) return;

    if (wlFiltered.length === 0) {
      container.innerHTML = '<div class="empty-state">Không tìm thấy từ nào phù hợp.</div>';
      if (btnMore) btnMore.style.display = 'none';
      return;
    }

    container.innerHTML = wlFiltered.slice(0, wlCount).map(item => {
      const lvl = assessments[item.id];
      let badge = '';
      if (lvl === 1) badge = '<span class="fc-status-tag fc-status-unremembered" style="font-size:0.75rem;padding:2px 8px;">Chưa nhớ</span>';
      else if (lvl === 2) badge = '<span class="fc-status-tag fc-status-slow" style="font-size:0.75rem;padding:2px 8px;">Nhớ chậm</span>';
      else if (lvl === 3) badge = '<span class="fc-status-tag fc-status-mastered" style="font-size:0.75rem;padding:2px 8px;">Đã thuộc</span>';

      const lineMeaning = getCleanMeaning(item);
      const action = `jumpToWord('${escapeHtml(item.id)}')`;

      return `
        <div class="word-list-item" onclick="${action}">
          <span class="word-list-word">${escapeHtml(item.lemma)}</span>
          <span class="word-list-meaning">${escapeHtml(lineMeaning)}</span>
          <div class="wl-status-cell">${badge}</div>
        </div>
      `;
    }).join('');

    if (btnMore) btnMore.style.display = wlCount < wlFiltered.length ? 'inline-flex' : 'none';
  }

  function studySignalAndJump(wordId) {
    closeWordListModal();
    if (currentScopeKey !== 'signal_words') loadScope('signal_words');
    const idx = currentScopeList.findIndex(x => x.id === wordId);
    if (idx !== -1) {
      currentCardIndex = idx;
      renderCurrentCard();
    }
  }

  function loadMoreWordsInList() {
    wlCount = Math.min(wlCount + 80, wlFiltered.length);
    renderWordList();
  }

  function jumpToWord(wordId) {
    const idx = currentScopeList.findIndex(x => x.id === wordId);
    if (idx !== -1) {
      currentCardIndex = idx;
      renderCurrentCard();
      closeWordListModal();
    }
  }

  // Signal Words Modal
  function openSignalWordsModal() {
    document.getElementById('modal-signal-words')?.classList.add('open');
    renderSignalWordsModal();
  }

  function closeSignalWordsModal(event) {
    if (event && event.target !== document.getElementById('modal-signal-words')) return;
    document.getElementById('modal-signal-words')?.classList.remove('open');
  }

  function filterSignalWordsByCategory(cat) {
    swCategory = cat;
    renderSignalWordsModal();
  }

  function filterSignalWordsList(q) {
    swQuery = (q || '').toLowerCase().trim();
    renderSignalWordsModal();
  }

  function renderSignalWordsModal() {
    const words = APP_DATA.signal_words || [];
    const bar = document.getElementById('signal-categories-bar');
    const box = document.getElementById('signal-words-list-container');
    if (!bar || !box) return;

    const cats = ['all', ...new Set(words.map(w => w.category).filter(Boolean))];
    bar.innerHTML = cats.map(c => {
      const label = c === 'all' ? `Tất cả (${words.length})` : c.replace(/\s*\([^)]*\)/, '');
      return `<button class="btn-subtle ${swCategory === c ? 'active' : ''}" onclick="filterSignalWordsByCategory('${escapeHtml(c)}')">${escapeHtml(label)}</button>`;
    }).join('');

    const filtered = words.filter(w => {
      if (swCategory !== 'all' && w.category !== swCategory) return false;
      if (!swQuery) return true;
      return `${w.lemma} ${w.definition} ${w.direction || ''} ${w.strategy || ''}`.toLowerCase().includes(swQuery);
    });

    box.innerHTML = filtered.map(w => `
      <div class="tactic-card" style="margin-bottom:8px;">
        <div style="display:flex; justify-content:space-between; gap:8px; flex-wrap:wrap;">
          <strong>${escapeHtml(w.lemma)}</strong>
          <span style="font-size:12px; color:var(--accent); font-weight:700;">${escapeHtml(w.direction || w.category || '')}</span>
        </div>
        <p style="margin-top:4px;">${escapeHtml(w.definition)}</p>
        ${w.strategy ? `<p style="margin-top:4px; color:var(--text-muted); font-size:12.5px;">Mẹo: ${escapeHtml(w.strategy)}</p>` : ''}
      </div>
    `).join('') || '<div class="empty-state">Không tìm thấy từ nối phù hợp.</div>';
  }

  function studySignalWordsAsDeck() {
    closeSignalWordsModal();
    loadScope('signal_words');
    showToast('Đang học Từ Nối & Chỉ Dẫn Hướng Nghĩa');
  }

  // Class Study Hours Report Modal
  function copyTextWithFeedback(text, successMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showToast(successMsg),
        () => fallbackCopyText(text, successMsg)
      );
      return;
    }
    fallbackCopyText(text, successMsg);
  }

  function fallbackCopyText(text, successMsg) {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast(successMsg);
    } catch (_) {
      showToast('Không thể tự sao chép, vui lòng thử lại.');
    }
  }

  let teacherPreviewStudy = false;

  function toggleTeacherStudyPreview(forceVal) {
    if (!isTeacherUser()) return;
    teacherPreviewStudy = typeof forceVal === 'boolean' ? forceVal : !teacherPreviewStudy;
    updateClassReportHeaderAndActions();
    syncAntiCopyClasses();
    if (teacherPreviewStudy) {
      populateScopeSelect();
      applyFilterAndBuildDeck(null, { speak: false });
      window.TasksModule?.updateTaskStudyBar?.();
      showToast('Đang xem trước màn hình học của học viên.');
    }
  }
  window.toggleTeacherStudyPreview = toggleTeacherStudyPreview;

  function updateClassReportHeaderAndActions() {
    const teacher = isTeacherUser();
    if (!teacher) teacherPreviewStudy = false;
    const titleEl = document.getElementById('class-report-modal-title');
    if (titleEl) titleEl.textContent = teacher ? 'Bảng Theo Dõi Giờ Học Lớp' : 'Bảng Xếp Hạng';
    const menuBtn = document.getElementById('btn-menu-class-report');
    if (menuBtn) menuBtn.style.display = teacher ? 'none' : 'inline-flex';
    const actionsEl = document.getElementById('class-report-actions');
    if (actionsEl) actionsEl.style.display = teacher ? 'flex' : 'none';
    const tPreviewBtn = document.getElementById('btn-teacher-preview');
    const tPreviewTxt = document.getElementById('btn-teacher-preview-text');
    document.body.classList.toggle('is-teacher-preview', Boolean(teacher && teacherPreviewStudy));
    if (tPreviewBtn) {
      tPreviewBtn.style.display = teacher ? 'inline-flex' : 'none';
      tPreviewBtn.classList.toggle('is-preview-icon', Boolean(teacher && teacherPreviewStudy));
      tPreviewBtn.title = teacherPreviewStudy ? 'Quay lại bảng Quản lý lớp học' : 'Xem trang học';
      tPreviewBtn.setAttribute('aria-label', teacherPreviewStudy ? 'Quay lại Quản lý' : 'Xem trang học');
      const ico = tPreviewBtn.querySelector('.hdr-btn-icon');
      if (ico) {
        ico.innerHTML = teacherPreviewStudy
          ? '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'
          : '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>';
      }
    }
    if (tPreviewTxt) tPreviewTxt.textContent = teacherPreviewStudy ? 'Quay lại Quản lý' : 'Xem trang học';
    const tRefreshBtn = document.getElementById('btn-teacher-refresh');
    if (tRefreshBtn) tRefreshBtn.style.display = (teacher && !teacherPreviewStudy) ? 'inline-flex' : 'none';
    const sTasksBtn = document.getElementById('btn-open-student-tasks');
    if (sTasksBtn) {
      sTasksBtn.style.display = (teacher && !teacherPreviewStudy) ? 'none' : 'inline-flex';
      window.TeacherStudio?.updateStudentHomeworkBadge?.();
    }
    const chipTxt = document.getElementById('header-mode-chip-text');
    if (chipTxt) chipTxt.textContent = (teacher && !teacherPreviewStudy) ? 'Quản lý lớp' : 'Reading 95,5%';
    // Toggle Teacher Dashboard vs Student Study Workspace cleanly
    const teacherScreen = document.getElementById('screen-teacher');
    const studyScreen = document.getElementById('screen-study');
    const taskScreen = document.getElementById('screen-task');
    const totHome = document.getElementById('screen-home');
    const totTasksHub = document.getElementById('screen-tasks-hub');
    const totPractice = document.getElementById('screen-practice');
    if (teacher && !teacherPreviewStudy) {
      document.body.classList.add('is-teacher-mode');
      if (studyScreen) {
        studyScreen.classList.remove('active');
        studyScreen.style.display = 'none';
      }
      if (totHome) totHome.classList.remove('active');
      if (totTasksHub) totTasksHub.classList.remove('active');
      if (totPractice) totPractice.classList.remove('active');
      if (taskScreen) {
        taskScreen.classList.remove('active', 'open');
      }
      const taskBar = document.getElementById('task-study-bar');
      if (taskBar) taskBar.style.display = 'none';
      if (teacherScreen) {
        teacherScreen.style.display = 'flex';
        teacherScreen.classList.add('active');
      }
    } else {
      document.body.classList.remove('is-teacher-mode');
      if (teacherScreen) {
        teacherScreen.classList.remove('active');
        teacherScreen.style.display = 'none';
      }
      if (window.TotoroUI?.switchView && window.TotoroUI?.getActiveView) {
        const curV = window.TotoroUI.getActiveView() || 'home';
        if (studyScreen) {
          studyScreen.classList.toggle('active', curV === 'flashcard');
          studyScreen.style.display = curV === 'flashcard' ? '' : 'none';
        }
        if (totHome) totHome.classList.toggle('active', curV === 'home');
        if (totTasksHub) totTasksHub.classList.toggle('active', curV === 'task');
        if (totPractice) totPractice.classList.toggle('active', curV === 'practice');
      } else if (studyScreen) {
        studyScreen.style.display = 'block';
        studyScreen.classList.add('active');
      }
    }
  }

  function renderClassReportTable() {
    updateClassReportHeaderAndActions();
    const tbody = document.getElementById('class-report-tbody');
    if (!tbody) return;
    const period = currentLeaderboardTab === 'month' ? 'month' : 'week';
    const ranked = getClassRankedEntries(period);
    const activeUid = getScopedUid(currentUser?.id);
    const chestnutUnitHtml = '<span class="tot-chestnut-unit" aria-label="hạt dẻ điểm" title="Hạt dẻ điểm"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.4C13 4.6 19.8 8.2 21 13.8C21.8 17.6 18.6 21 12 21C5.4 21 2.2 17.6 3 13.8C4.2 8.2 11 4.6 12 2.4Z" fill="#8B3A14" stroke="#531F07" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 17.5C7 15.8 17 15.8 19 17.5C17.6 19.9 15 20.8 12 20.8C9 20.8 6.4 19.9 5 17.5Z" fill="#E8CCA0"/><path d="M7.2 12.2C7.8 9.6 9.8 7.8 11.4 6.6" stroke="#DF8B56" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><path d="M12 4.8V15.4M8.5 8.5C7.9 11 7.8 13.2 8.2 15.6M15.5 8.5C16.1 11 16.2 13.2 15.8 15.6" stroke="#5E2409" stroke-width="0.9" stroke-linecap="round" opacity=".45"/></svg></span>';
    tbody.innerHTML = ranked.map(item => {
      const isMe = currentUser && !isTeacherUser() && getScopedUid(item.id) === activeUid;
      const bd = item.scoreBreakdown || {};
      const tip = `Từ gốc: +${bd.vocabPoints || 0} | Task: +${bd.taskPoints || 0} | Test tổng: +${bd.certPoints || 0} | Streak: +${bd.streakPoints || 0} | Thời gian: +${bd.timePoints || 0}`;
      return `
        <tr class="${isMe ? 'is-me' : ''}" title="${escapeHtml(tip)}">
          <td>${item.rankLabel}</td>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td><strong class="tot-score-with-unit">${item.score.toLocaleString('vi-VN')}${chestnutUnitHtml}</strong></td>
          <td>${item.mastered} từ</td>
          <td>${item.tasksCompleted}</td>
          <td>${item.weekMins} phút</td>
          <td>${item.monthMins} phút</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="7" style="text-align:center;">Chưa có tài khoản học viên.</td></tr>';
  }

  function openClassReportModal() {
    updateCloudSyncBadge();
    renderClassReportTable();
    document.getElementById('modal-class-report')?.classList.add('open');
    syncPullClassData();
  }

  function closeClassReportModal(event) {
    if (event && event.target !== document.getElementById('modal-class-report')) return;
    document.getElementById('modal-class-report')?.classList.remove('open');
  }

  function copyMyStudyReport() {
    if (!currentUser) return;
    const ranked = getClassRankedEntries(currentLeaderboardTab);
    const mine = ranked.find(r => getScopedUid(r.id) === getScopedUid(currentUser.id));
    const mins = getUserPeriodMinutes(currentUser.id);
    const mastered = getUserMasteredCount(currentUser.id);
    const todayStr = localStudyDayKey();
    const msg = `[Báo cáo học Vocab - ${todayStr}]\nHọc viên: ${currentUser.name} (${currentUser.id})\n- Xếp hạng: ${mine ? mine.rankLabel : '–'} (${mine ? mine.score.toLocaleString('vi-VN') : 0} điểm)\n- Hôm nay: ${mins.todayMins} phút\n- Tuần này: ${mins.weekMins} phút\n- Tháng này: ${mins.monthMins} phút\n- Đã thuộc: ${mastered} từ\n- Task hoàn thành: ${mine ? mine.tasksCompleted : 0}`;
    copyTextWithFeedback(msg, 'Đã sao chép báo cáo cá nhân!');
  }

  function copyFullClassReport() {
    const ranked = getClassRankedEntries('week');
    const todayStr = localStudyDayKey();
    const lines = ranked.map(r => `${r.rankLabel} | ${r.name} (${r.id}) | Điểm: ${r.score.toLocaleString('vi-VN')}đ | Thuộc: ${r.mastered} từ | Task: ${r.tasksCompleted} | Tuần: ${r.weekMins}p | Tháng: ${r.monthMins}p`);
    const msg = `[Bảng Xếp Hạng Lớp - ${todayStr}]\n` + lines.join('\n');
    copyTextWithFeedback(msg, 'Đã sao chép bảng xếp hạng cả lớp!');
  }

  // Settings Menu Modal
  function toggleFocusMode() {
    const isOn = document.body.classList.toggle('study-focus-mode');
    const btn = document.getElementById('btn-top-focus-mode');
    if (btn) {
      btn.classList.toggle('is-active', isOn);
      btn.innerHTML = isOn ? '<span>Hiện cột bên</span>' : '<span>Tập trung</span>';
    }
    try { localStorage.setItem('ielts_focus_mode_v1', isOn ? '1' : '0'); } catch (_) {}
  }
  window.toggleFocusMode = toggleFocusMode;

  function openMenuModal() {
    updateAutoSpeakUI();
    populateVoiceSelectUI();
    syncThemeUIControls();
    updateClassReportHeaderAndActions();
    const chk = document.getElementById('chk-show-front-context');
    if (chk) chk.checked = showFrontContext;
    const accEl = document.getElementById('menu-account-summary');
    if (accEl && currentUser) {
      accEl.textContent = `${currentUser.name} · ${currentUser.id}`;
    }
    window.AppCore?.renderSkillModesMenu?.();
    document.getElementById('modal-menu')?.classList.add('open');
  }

  function closeMenuModal(event) {
    if (event && event.target !== document.getElementById('modal-menu')) return;
    document.getElementById('modal-menu')?.classList.remove('open');
  }

  function setThemeMode(mode) {
    const next = mode === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
    syncThemeUIControls();
    saveState();
    showToast(`Đã chuyển giao diện ${next === 'dark' ? 'Tối' : 'Sáng'}`);
  }

  function toggleTheme() {
    const cur = document.documentElement.getAttribute('data-theme') || 'light';
    setThemeMode(cur === 'dark' ? 'light' : 'dark');
  }

  function toggleMobileWidgets(targetWidgetId) {
    const isTablet = window.innerWidth >= 768 && window.innerWidth < 1200;
    if (!isTablet) {
      const opening = !document.body.classList.contains('mobile-widgets-open');
      document.body.classList.toggle('mobile-widgets-open', opening || Boolean(targetWidgetId));
      const lbl = document.getElementById('mob-widgets-toggle-label');
      if (lbl) {
        lbl.textContent = document.body.classList.contains('mobile-widgets-open') ? 'Thu gọn tiện ích ▴' : 'Hiện tiện ích ▾';
      }
    }
    if (targetWidgetId) {
      setTimeout(() => {
        document.getElementById(targetWidgetId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 60);
    }
  }

  function toggleFrontContext(checked) {
    showFrontContext = !!checked;
    saveState();
    renderCurrentCard(0, { speak: false });
  }

  function resetAllProgress() {
    if (!currentUser) return;
    if (!confirm(`Bạn có chắc muốn xóa toàn bộ đánh giá Chưa nhớ / Nhớ chậm / Đã thuộc của ID "${currentUser.id}"?`)) return;
    assessments = {};
    srsData = {};
    scopePositions = {};
    onlyUnmastered = false;
    onlyDueReview = false;
    ankiReminderDismissed = false;
    masterCooldowns = {};
    localStorage.removeItem(getUserStorageKey());
    try {
      localStorage.removeItem(`${MASTER_COOLDOWN_KEY_BASE}${getScopedUid()}`);
      localStorage.removeItem(`${RECALL_ACTIVE_KEY_BASE}${getScopedUid()}`);
    } catch (_) {}
    closeMenuModal();
    applyFilterAndBuildDeck();
    updateLeaderboardUI();
    syncPushCurrentUser();
    showToast('Đã đặt lại toàn bộ tiến độ');
  }

  // Authentication Gate (ID & Mật khẩu set sẵn)
  function findPresetAccount(idInput, passInput) {
    const cleanId = String(idInput || '').trim().toLowerCase();
    const rawPass = String(passInput || '');
    if (!cleanId || !rawPass) return null;
    return getAccountsList().find(
      acc => String(acc.id || '').trim().toLowerCase() === cleanId && String(acc.password || '') === rawPass
    ) || null;
  }

  function findPresetAccountById(idInput) {
    const cleanId = String(idInput || '').trim().toLowerCase();
    if (!cleanId) return null;
    return getAccountsList().find(
      acc => String(acc.id || '').trim().toLowerCase() === cleanId
    ) || null;
  }

  function togglePasswordVisibility() {
    const passEl = document.getElementById('login-pass-input');
    const btn = document.getElementById('btn-toggle-pass');
    if (!passEl || !btn) return;
    const isHidden = passEl.type === 'password';
    passEl.type = isHidden ? 'text' : 'password';
    btn.textContent = isHidden ? 'Ẩn' : 'Hiện';
  }

  function showLoginError(msg) {
    const errEl = document.getElementById('login-error-msg');
    if (!errEl) return;
    if (!msg) {
      errEl.textContent = '';
      errEl.classList.remove('visible');
    } else {
      errEl.textContent = msg;
      errEl.classList.add('visible');
    }
  }

  function persistAuthSession(account, remember) {
    const payload = JSON.stringify({ id: account.id, loginAt: Date.now() });
    try {
      if (remember) {
        localStorage.setItem(AUTH_SESSION_KEY, payload);
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      } else {
        sessionStorage.setItem(AUTH_SESSION_KEY, payload);
        localStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch (_) {}
  }

  function resetInMemoryStudyState() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    timerRunning = false;
    timerElapsedSeconds = 0;
    todayStudySeconds = 0;
    currentScopeKey = 'paraphrase';
    currentCardIndex = 0;
    isCardFlipped = false;
    onlyUnmastered = false;
    onlyDueReview = false;
    showFrontContext = false;
    assessments = {};
    srsData = {};
    ankiReminderDismissed = false;
    autoSpeak = true;
    preferredAccent = 'en-US';
    pendingInitialSpeak = false;
    stopSpeechPlayback();
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
    stopRecallInputTimer();
    masterCooldowns = {};
    recallTargetItem = null;
    recallSubmitted = false;
    recallStage = 1;
    recallAttemptsLeft = 2;
    recallLeaveWarnings = 0;
    lastRecallLeaveAt = 0;
    recallSynOptions = [];
    recallSynSelected = new Set();
    scopePositions = {};
    customReviewState = null;
    dynamicTaskScopes = [];
    displayedStreak = null;
  }

  async function enterAppForUser(account, options = {}) {
    resetInMemoryStudyState();
    wordLookupCache = null;
    currentUser = account;
    initialCloudPullUid = '';
    initialCloudPullSettled = !getSyncUrl();

    // Enforce RBAC & Tenant Curriculum Isolation BEFORE rendering any UI or reading curriculum globals
    if (window.AccessPolicy?.enforceForUser) {
      await window.AccessPolicy.enforceForUser(account);
      wordLookupCache = null;
      _lemmaPeersCache = null;
      _idToLemmaCache = null;
    }

    const gateEl = document.getElementById('auth-gate');
    const shellEl = document.getElementById('app-shell');
    if (gateEl) gateEl.style.display = 'none';
    if (shellEl) shellEl.style.display = 'block';

    const idEl = document.getElementById('header-user-id');
    if (idEl) {
      idEl.textContent = account.id;
      idEl.title = `${account.name} (${account.id})`;
    }

    loadState();
    const interruptedRecallMsg = !isTeacherUser() ? checkInterruptedRecallOnLoad() : '';
    updateAutoSpeakUI();
    updateClassReportHeaderAndActions();
    syncAntiCopyClasses();
    if (isTeacherUser()) {
      pauseTimer();
      document.getElementById('anki-due-reminder')?.classList.remove('visible');
      updateCloudSyncBadge();
      syncPullClassData();
      window.TasksModule?.onUserEntered?.(account);
    } else {
      if (window.TasksModule?.onUserEntered) {
        window.TasksModule.onUserEntered(account);
      } else {
        populateScopeSelect();
      }
      window.TotoroUI?.onUserEntered?.(account);
      if (isListeningSkillActive() && window.APP_LISTENING_VOCAB && !isListeningScopeKey(currentScopeKey) && !isMyVocabScopeKey(currentScopeKey)) {
        currentScopeKey = lastListeningScopeKey || 'l_part1';
        populateScopeSelect();
      } else if (!isListeningSkillActive() && isListeningScopeKey(currentScopeKey)) {
        currentScopeKey = lastReadingScopeKey || 'paraphrase';
        populateScopeSelect();
      }
      const onFlashcardView = !window.TotoroUI?.getActiveView || window.TotoroUI.getActiveView() === 'flashcard';
      const autoSpeakOnEnter = !!options.autoSpeakOnEnter && onFlashcardView;
      pendingInitialSpeak = !autoSpeakOnEnter && autoSpeak;
      applyFilterAndBuildDeck(null, { speak: autoSpeakOnEnter });
      window.RecognitionTestModule?.updateScopeListTestButton?.();
      loadStudyTimerState();
      startTimer();
      startStudyIdleMonitor();
      updateLeaderboardUI();
      updateStudyStreakUI();
      updateCloudSyncBadge();
      syncPullClassData();
      if (interruptedRecallMsg) {
        setTimeout(() => showToast(interruptedRecallMsg), 200);
      }
    }
    if (cloudPullTimer) clearInterval(cloudPullTimer);
    cloudPullTimer = setInterval(() => {
      if (currentUser) syncPullClassData();
    }, 30000);
    evaluateMultiTabGuard(true);
  }

  function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById('login-id-input')?.value || '';
    const passInput = document.getElementById('login-pass-input')?.value || '';
    const remember = !!document.getElementById('login-remember-chk')?.checked;

    if (!idInput.trim() || !passInput) {
      showLoginError('Vui lòng nhập đầy đủ ID và Mật khẩu.');
      return;
    }

    const matched = findPresetAccount(idInput, passInput);
    if (!matched) {
      showLoginError('Sai Mã học viên (ID) hoặc Mật khẩu. Vui lòng kiểm tra lại.');
      return;
    }

    showLoginError('');
    persistAuthSession(matched, remember);
    if (remember && window.PasswordCredential && navigator.credentials?.store) {
      try {
        navigator.credentials.store(new window.PasswordCredential({
          id: matched.id,
          password: passInput,
          name: matched.name,
        })).catch(() => {});
      } catch (_) {}
    }
    enterAppForUser(matched, { autoSpeakOnEnter: true });
    showToast(matched.role === 'teacher'
      ? 'Chào Giáo viên! Bảng quản lý lớp đã sẵn sàng.'
      : `Chào ${matched.name}! Chúc bạn học tốt.`);
  }

  function logoutCurrentAccount() {
    teacherPreviewStudy = false;
    stopStudyIdleMonitor();
    if (cloudPullTimer) {
      clearInterval(cloudPullTimer);
      cloudPullTimer = null;
    }
    clearTimeout(cloudPushDebounce);
    window.TasksModule?.onUserLogout?.();
    if (currentUser) {
      clearRecallActiveSession();
      pauseTimer();
      saveState();
      syncPushCurrentUser(true);
    }
    initialCloudPullSettled = false;
    initialCloudPullUid = '';
    resetInMemoryStudyState();
    wordLookupCache = null;
    _lemmaPeersCache = null;
    _idToLemmaCache = null;
    currentUser = null;
    window.AccessPolicy?.purgeProprietaryMemory?.();
    closeRecallModal(null, true);
    closeCheatWarningModal();
    hideMultiTabBlockOverlay();
    syncAntiCopyClasses();

    try {
      localStorage.removeItem(AUTH_SESSION_KEY);
      sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch (_) {}

    closeReadingTipModal();
    closeWordListModal();
    closeSignalWordsModal();
    closeClassReportModal();
    closeMenuModal();
    document.getElementById('anki-due-reminder')?.classList.remove('visible');

    const gateEl = document.getElementById('auth-gate');
    const shellEl = document.getElementById('app-shell');
    try { sessionStorage.removeItem('ielts_totoro_active_view_v1'); } catch (_) {}
    try {
      if (window.location.protocol !== 'file:' && window.history?.replaceState) {
        const base = typeof window.__APP_BASE_PATH__ === 'string' ? window.__APP_BASE_PATH__ : '';
        window.history.replaceState(null, '', `${base}/${window.location.search || ''}${window.location.hash || ''}`);
      }
    } catch (_) {}
    if (shellEl) shellEl.style.display = 'none';
    if (gateEl) gateEl.style.display = 'flex';

    const passInput = document.getElementById('login-pass-input');
    if (passInput) {
      passInput.value = '';
      passInput.type = 'password';
    }
    const toggleBtn = document.getElementById('btn-toggle-pass');
    if (toggleBtn) toggleBtn.textContent = 'Hiện';
    showLoginError('');
    document.getElementById('login-id-input')?.focus();
    showToast('Đã đăng xuất tài khoản');
  }

  function restoreAuthSession() {
    loadThemePreference();
    let savedId = null;
    let isLocalPersistent = false;
    try {
      const sesRaw = sessionStorage.getItem(AUTH_SESSION_KEY);
      const locRaw = localStorage.getItem(AUTH_SESSION_KEY);
      const raw = sesRaw || locRaw;
      isLocalPersistent = !sesRaw && Boolean(locRaw);
      if (raw) {
        const parsed = JSON.parse(raw);
        const loginAt = Number(parsed?.loginAt || 0);
        if (parsed?.id && (!isLocalPersistent || !loginAt || (Date.now() - loginAt <= AUTH_SESSION_MAX_AGE_MS))) {
          savedId = parsed.id;
        } else if (isLocalPersistent) {
          localStorage.removeItem(AUTH_SESSION_KEY);
        }
      }
    } catch (_) {}

    const matched = savedId ? findPresetAccountById(savedId) : null;
    if (matched) {
      if (isLocalPersistent) persistAuthSession(matched, true);
      enterAppForUser(matched, { autoSpeakOnEnter: false });
    } else {
      const gateEl = document.getElementById('auth-gate');
      const shellEl = document.getElementById('app-shell');
      if (shellEl) shellEl.style.display = 'none';
      if (gateEl) gateEl.style.display = 'flex';
    }
  }

  window.addEventListener('beforeunload', () => {
    if (currentUser) {
      saveStudyTimerState();
      saveState();
      syncPushCurrentUser(true);
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (!currentUser) return;
    if (document.getElementById('modal-cheat-warn')?.classList.contains('open')) return;
    if (document.getElementById('modal-multitab-block')?.classList.contains('open')) return;
    if (e.key === 'Escape' && document.querySelector('.modal-overlay.open')) {
      if (document.getElementById('modal-task-exit-warn')?.classList.contains('open')) {
        window.TasksModule?.dismissTaskExitWarn?.();
        return;
      }
      if (document.getElementById('modal-recall-check')?.classList.contains('open')) {
        if (recallTargetItem && !recallSubmitted && !isExamAntiCheatBypassed()) {
          showToast('Đang Kiểm tra nhớ từ — không thể bấm Esc để thoát.');
          return;
        }
        closeRecallModal(null, true);
        return;
      }
      if (document.getElementById('screen-task')?.classList.contains('open') && !isTeacherUser()) {
        return;
      }
      closeReadingTipModal();
      closeWordListModal();
      closeSignalWordsModal();
      closeClassReportModal();
      closeMenuModal();
      window.TasksModule?.closeStudentTasksModal?.();
      window.TasksModule?.closeTaskBriefModal?.();
      window.TasksModule?.closeTaskSummaryModal?.();
      return;
    }
    if (isTeacherUser()) return;
    if (document.getElementById('screen-task')?.style.display !== 'none' && document.getElementById('screen-task')?.classList.contains('active')) {
      return;
    }
    const el = document.activeElement;
    if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
    if (document.getElementById('modal-recall-check')?.classList.contains('open') && recallMode === 'listening_shadow' && recallStage === 1 && !recallSubmitted) {
      if (e.code === 'Space') {
        e.preventDefault();
        toggleListeningRecallMic();
        return;
      }
      // Locked rule: NO replay shortcut (R) during One-Shot Listening Recall!
      if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        return;
      }
    }
    if (document.querySelector('.modal-overlay.open')) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (el && el.tagName === 'BUTTON') el.blur();
      flipCurrentCard();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      nextCard();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prevCard();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      speakCurrentWord(isCardFlipped ? 'en-GB' : 'en-US');
    } else if (['1', '2', '3'].includes(e.key) && isCardFlipped) {
      assessCurrentWord(parseInt(e.key, 10));
    }
  });

  // Expose handlers to HTML onclick
  Object.assign(window, {
    onScopeChange, flipCurrentCard, nextCard, prevCard, assessCurrentWord,
    toggleUnmasteredFilter, activateUnmasteredOnly, restartScopeStudy,
    toggleDueReviewFilter, activateDueReviewOnly, dismissAnkiReminder,
    shuffleCurrentScope, speakCurrentWord, toggleAutoSpeak, setAutoSpeakAccent,
    onPreferredVoiceChange, previewSelectedVoice, populateVoiceSelectUI,
    openWordListModal, closeWordListModal,
    filterWordListByStatus, onWordListSearch, loadMoreWordsInList, jumpToWord,
    studySignalAndJump, openSignalWordsModal, closeSignalWordsModal, filterSignalWordsByCategory,
    filterSignalWordsList, studySignalWordsAsDeck, openReadingTipModal, closeReadingTipModal,
    submitRecallCheck, closeRecallModal,
    openClassReportModal, closeClassReportModal, copyMyStudyReport, copyFullClassReport,
    openMenuModal, closeMenuModal, toggleTheme, setThemeMode, toggleMobileWidgets, toggleFrontContext, resetAllProgress,
    toggleTimer, resetTimer, setTimerMode, setCountdownMinutes, toggleTimerSound,
    switchLeaderboardTab, switchStreakChartTab,
    handleLoginSubmit, togglePasswordVisibility, logoutCurrentAccount,
    playListeningRecallAudio, toggleListeningRecallMic, runQuickListeningMicTest,
    toggleListeningFrontReveal,
  });

  // Sync Flashcard scope automatically when switching Reading <-> Listening
  document.addEventListener('totoro:skill-changed', (ev) => {
    const nextSkill = String(ev?.detail?.skill || '').toLowerCase();
    if (nextSkill === 'writing') {
      try { window.speechSynthesis?.cancel?.(); } catch (_) {}
      return;
    }
    if (!window.APP_LISTENING_VOCAB) return;
    if (nextSkill === 'listening') {
      if (!isListeningScopeKey(currentScopeKey) && !isMyVocabScopeKey(currentScopeKey)) {
        if (!isTaskScopeKey(currentScopeKey) && currentScopeKey !== REVIEW_OLD_SCOPE_KEY) {
          lastReadingScopeKey = currentScopeKey;
        }
        currentScopeKey = lastListeningScopeKey || 'l_part1';
      }
    } else if (nextSkill === 'reading') {
      if (isListeningScopeKey(currentScopeKey)) {
        if (!/^ltask_/i.test(currentScopeKey)) lastListeningScopeKey = currentScopeKey;
        currentScopeKey = lastReadingScopeKey || 'paraphrase';
      }
    }
    populateScopeSelect();
    const sel = document.getElementById('study-scope-select');
    if (sel) sel.value = currentScopeKey;
    window.TotoroUI?.syncScopeDropdown?.();
    window.TasksModule?.updateTaskStudyBar?.();
    const isFlashcardOpen = window.TotoroUI?.getActiveView?.() === 'flashcard';
    applyFilterAndBuildDeck(null, { speak: isFlashcardOpen });
  });

  function openCheatWarningModal(msg, onDismiss, warnNum = 1, maxStrikes = 3) {
    const modal = document.getElementById('modal-cheat-warn');
    const pillEl = document.getElementById('cheat-warn-pill');
    const msgEl = document.getElementById('cheat-warn-msg');
    const detailEl = document.getElementById('cheat-warn-detail');
    const btn = document.getElementById('btn-cheat-warn-close');
    if (!modal || !btn) return;
    const rem = Math.max(1, maxStrikes - warnNum);
    if (pillEl) pillEl.textContent = `CẢNH BÁO VI PHẠM · LẦN ${warnNum} / ${maxStrikes}`;
    if (msgEl && msg) msgEl.textContent = msg;
    if (detailEl) {
      detailEl.innerHTML = `<strong>Lưu ý:</strong> Không bấm ra ngoài hay chuyển tab khi đang làm bài. Nếu vi phạm đủ <strong>${maxStrikes} lần</strong>, bài sẽ bị <strong>KHÓA 30 PHÚT</strong> — <strong>mất sạch kết quả đang làm</strong> và khi mở lại bạn phải <strong>làm lại từ đầu</strong>! (Còn ${rem} lần nhắc)`;
    }
    btn.textContent = `Đã hiểu · Tiếp tục làm bài`;
    modal.classList.add('open');
    btn.onclick = () => {
      modal.classList.remove('open');
      if (typeof onDismiss === 'function') onDismiss();
    };
    setTimeout(() => btn.focus(), 40);
  }

  function closeCheatWarningModal() {
    document.getElementById('modal-cheat-warn')?.classList.remove('open');
    const btn = document.getElementById('btn-cheat-warn-close');
    if (btn) btn.onclick = null;
  }

  // =========================================================
  // ANTI-PASTE, ANTI-COPY & MULTI-TAB EXAM LOCK GUARD
  // =========================================================
  const EXAM_LOCK_KEY = 'ielts_reading_active_exam_lock_v1';
  const EXAM_INTRUSION_KEY = 'ielts_reading_exam_intrusion_v1';
  const TAB_UID_SESSION_KEY = 'ielts_reading_tab_uid_v1';
  const EXAM_LOCK_TTL_MS = 6500;

  let myTabUid = '';
  let tabGuardChannel = null;
  let examHeartbeatTimer = null;
  let isMultiTabBlocked = false;
  let lastIntrusionSentAt = 0;
  let lastIntrusionHandledAt = 0;
  let recallLeaveHandlerRef = null;

  function getMyTabUid() {
    if (myTabUid) return myTabUid;
    try {
      const existing = sessionStorage.getItem(TAB_UID_SESSION_KEY);
      if (existing) {
        myTabUid = existing;
        return myTabUid;
      }
      myTabUid = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      sessionStorage.setItem(TAB_UID_SESSION_KEY, myTabUid);
    } catch (_) {
      myTabUid = `tab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }
    return myTabUid;
  }

  function isRecallExamActive() {
    return Boolean(document.getElementById('modal-recall-check')?.classList.contains('open') && recallTargetItem && !recallSubmitted);
  }

  function getLocalExamState() {
    if (isExamAntiCheatBypassed()) return { active: false, label: '' };
    if (isRecallExamActive()) return { active: true, label: 'Kiểm tra nhớ từ' };
    try {
      const taskState = window.TasksModule?.getExamState?.();
      if (taskState?.active) return { active: true, label: taskState.label || 'Test Task' };
    } catch (_) {}
    return { active: false, label: '' };
  }

  function readActiveExamLock() {
    try {
      const raw = localStorage.getItem(EXAM_LOCK_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.tabId) return null;
      if (Date.now() - Number(parsed.updatedAt || 0) > EXAM_LOCK_TTL_MS) return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function notifyExamHolderIntrusion(lock) {
    if (!lock || lock.tabId === getMyTabUid()) return;
    const now = Date.now();
    if (now - lastIntrusionSentAt < 1800) return;
    lastIntrusionSentAt = now;
    const payload = { at: now, fromTabId: getMyTabUid(), targetTabId: lock.tabId };
    try {
      localStorage.setItem(EXAM_INTRUSION_KEY, JSON.stringify(payload));
    } catch (_) {}
    try {
      tabGuardChannel?.postMessage({ type: 'TAB_INTRUSION', ...payload });
    } catch (_) {}
  }

  function showMultiTabBlockOverlay(lock) {
    isMultiTabBlocked = true;
    document.body.classList.add('is-multitab-blocked');
    const msgEl = document.getElementById('multitab-block-msg');
    if (msgEl) {
      const label = lock?.label ? ` (${lock.label})` : '';
      msgEl.textContent = `Phát hiện bạn đang làm bài kiểm tra${label} ở một tab/cửa sổ khác. Tab này đã bị khóa và che nội dung để tránh lộ đáp án!`;
    }
    document.getElementById('modal-multitab-block')?.classList.add('open');
  }

  function hideMultiTabBlockOverlay() {
    if (!isMultiTabBlocked && !document.body.classList.contains('is-multitab-blocked')) return;
    isMultiTabBlocked = false;
    document.body.classList.remove('is-multitab-blocked');
    document.getElementById('modal-multitab-block')?.classList.remove('open');
  }

  function syncExamLock(isActive, label) {
    const uid = getMyTabUid();
    const existing = readActiveExamLock();
    if (!isActive) {
      if (getLocalExamState().active) return true;
      if (!existing || existing.tabId === uid) {
        try { localStorage.removeItem(EXAM_LOCK_KEY); } catch (_) {}
        try { tabGuardChannel?.postMessage({ type: 'EXAM_RELEASED', tabId: uid }); } catch (_) {}
      }
      return true;
    }
    if (existing && existing.tabId !== uid) {
      showMultiTabBlockOverlay(existing);
      notifyExamHolderIntrusion(existing);
      return false;
    }
    const payload = {
      tabId: uid,
      userId: currentUser?.id || '',
      label: label || 'Kiểm tra',
      updatedAt: Date.now(),
    };
    try { localStorage.setItem(EXAM_LOCK_KEY, JSON.stringify(payload)); } catch (_) {}
    try { tabGuardChannel?.postMessage({ type: 'EXAM_HEARTBEAT', ...payload }); } catch (_) {}
    hideMultiTabBlockOverlay();
    return true;
  }

  function handleIncomingIntrusion(targetTabId) {
    if (targetTabId && targetTabId !== getMyTabUid()) return;
    const now = Date.now();
    if (now - lastIntrusionHandledAt < 900) return;
    lastIntrusionHandledAt = now;
    const reason = 'Phát hiện bạn vừa mở hoặc chuyển sang một tab/cửa sổ khác của ứng dụng khi đang kiểm tra!';
    if (isRecallExamActive() && typeof recallLeaveHandlerRef === 'function') {
      recallLeaveHandlerRef(reason);
      return;
    }
    try {
      if (window.TasksModule?.getExamState?.().active) {
        window.TasksModule?.handleExternalTabIntrusion?.(reason);
      }
    } catch (_) {}
  }

  function evaluateMultiTabGuard(isBootCheck = false) {
    if (!currentUser || isExamAntiCheatBypassed()) {
      hideMultiTabBlockOverlay();
      return;
    }
    const uid = getMyTabUid();
    const remoteLock = readActiveExamLock();
    if (remoteLock && remoteLock.tabId !== uid) {
      showMultiTabBlockOverlay(remoteLock);
      if (isBootCheck) {
        notifyExamHolderIntrusion(remoteLock);
      }
      return;
    }
    hideMultiTabBlockOverlay();
    const localState = getLocalExamState();
    if (localState.active) {
      syncExamLock(true, localState.label);
    }
  }

  function recheckMultiTabLock() {
    const remoteLock = readActiveExamLock();
    if (remoteLock && remoteLock.tabId !== getMyTabUid()) {
      showMultiTabBlockOverlay(remoteLock);
      notifyExamHolderIntrusion(remoteLock);
      showToast('Tab làm bài kia vẫn đang hoạt động — hãy đóng tab phụ này!');
      return;
    }
    hideMultiTabBlockOverlay();
    showToast('Phiên kiểm tra ở tab kia đã kết thúc. Đã mở khóa!');
  }

  function isExamAntiCheatBypassed() {
    return Boolean(
      currentUser?.role === 'teacher' ||
      window.TasksModule?.isPreviewMode?.() ||
      window.TasksModule?.getExamState?.()?.isPreview ||
      window.TasksModule?.getExamState?.()?.isTeacher ||
      new URLSearchParams(window.location.search || '').has('adminTest') ||
      new URLSearchParams(window.location.search || '').has('preview') ||
      localStorage.getItem('ielts_bypass_anti_cheat') === '1'
    );
  }

  function syncAntiCopyClasses() {
    const enforce = Boolean(currentUser && !isExamAntiCheatBypassed());
    ['fc-scene', 'modal-recall-check'].forEach((elId) => {
      document.getElementById(elId)?.classList.toggle('exam-no-copy', enforce);
    });
  }

  function bindNoPasteGuards(el, toastMsg) {
    if (!el || el.dataset.noPasteBound === '1') return;
    el.dataset.noPasteBound = '1';
    const msg = toastMsg || 'Không được dán (paste) khi kiểm tra — hãy tự nhập trực tiếp!';
    ['paste', 'drop', 'contextmenu'].forEach((evt) => {
      el.addEventListener(evt, (e) => {
        if (isExamAntiCheatBypassed()) return;
        e.preventDefault();
        if (evt === 'paste' || evt === 'drop') showToast(msg);
      });
    });
    el.addEventListener('beforeinput', (e) => {
      if (isExamAntiCheatBypassed()) return;
      if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') {
        e.preventDefault();
        showToast(msg);
      }
    });
  }

  // Anti-cheat guards during flashcard study & Recall Check (1st leave blocks screen behind warning modal, 2nd leave fails)
  (function initRecallAntiCheat() {
    const handleLeaveAttempt = (reason) => {
      if (isExamAntiCheatBypassed()) return;
      if (window.TotoroSpeechSTT?.isRequestingPermission?.()) return;
      const modal = document.getElementById('modal-recall-check');
      if (!modal?.classList.contains('open') || !recallTargetItem || recallSubmitted) return;
      if (document.getElementById('modal-cheat-warn')?.classList.contains('open')) return;
      const now = Date.now();
      if (now - lastRecallLeaveAt < 800) return;
      lastRecallLeaveAt = now;
      recallLeaveWarnings += 1;
      if (recallLeaveWarnings < 3) {
        const pausedAt = Date.now();
        const card = document.querySelector('#modal-recall-check .recall-check-card');
        const inp = document.getElementById('recall-word-input');
        if (card) card.style.setProperty('visibility', 'hidden');
        const fb = document.getElementById('recall-feedback');
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback err';
          fb.innerHTML = `<strong>Cảnh báo (lần ${recallLeaveWarnings}/3):</strong> Không bấm ra ngoài khi kiểm tra! Lần thứ 3 sẽ tính sai và khóa nút Đã thuộc.`;
        }
        openCheatWarningModal(
          reason || 'Không bấm ra ngoài hay chuyển tab khi đang kiểm tra nhớ từ!',
          () => {
            if (recallDeadlineAt > 0) recallDeadlineAt += (Date.now() - pausedAt);
            if (card) card.style.removeProperty('visibility');
            if (recallStage === 1) inp?.focus();
          },
          recallLeaveWarnings,
          3
        );
        return;
      }
      closeCheatWarningModal();
      document.querySelector('#modal-recall-check .recall-check-card')?.style.removeProperty('visibility');
      failRecallCheck(recallTargetItem, `${reason} (Lần 3)`);
    };
    recallLeaveHandlerRef = handleLeaveAttempt;

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleLeaveAttempt('Phát hiện chuyển tab hoặc rời màn hình kiểm tra!');
      } else {
        evaluateMultiTabGuard(false);
        const lock = readActiveExamLock();
        if (isMultiTabBlocked && lock) notifyExamHolderIntrusion(lock);
      }
    });

    window.addEventListener('blur', () => {
      const fire = () => handleLeaveAttempt('Phát hiện rời khỏi cửa sổ kiểm tra!');
      if (window.CoreAntiCheatGuard?.handleSafeWindowBlur) {
        window.CoreAntiCheatGuard.handleSafeWindowBlur(fire);
      } else {
        fire();
      }
    });

    window.addEventListener('focus', () => {
      evaluateMultiTabGuard(false);
      const lock = readActiveExamLock();
      if (isMultiTabBlocked && lock) notifyExamHolderIntrusion(lock);
    });

    const recallInp = document.getElementById('recall-word-input');
    bindNoPasteGuards(recallInp, 'Không được dán (paste) khi kiểm tra — hãy tự gõ từ!');

    ['fc-scene', 'modal-recall-check'].forEach((elId) => {
      const el = document.getElementById(elId);
      if (!el) return;
      ['copy', 'cut', 'contextmenu'].forEach((evt) => {
        el.addEventListener(evt, (e) => {
          if (isExamAntiCheatBypassed()) return;
          e.preventDefault();
        });
      });
    });
    syncAntiCopyClasses();

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        tabGuardChannel = new BroadcastChannel('ielts_reading_tab_guard_v1');
        tabGuardChannel.onmessage = (ev) => {
          const msg = ev?.data;
          if (!msg) return;
          if (msg.type === 'TAB_INTRUSION' && msg.fromTabId !== getMyTabUid()) {
            handleIncomingIntrusion(msg.targetTabId);
          } else {
            evaluateMultiTabGuard(false);
          }
        };
      } catch (_) {}
    }

    window.addEventListener('storage', (e) => {
      if (e.key === EXAM_LOCK_KEY) {
        evaluateMultiTabGuard(false);
      } else if (e.key === EXAM_INTRUSION_KEY && e.newValue) {
        try {
          const d = JSON.parse(e.newValue);
          if (d?.fromTabId !== getMyTabUid()) handleIncomingIntrusion(d?.targetTabId);
        } catch (_) {}
      }
    });

    const releaseOnLeave = () => {
      const lock = readActiveExamLock();
      if (lock && lock.tabId === getMyTabUid()) {
        try { localStorage.removeItem(EXAM_LOCK_KEY); } catch (_) {}
        try { tabGuardChannel?.postMessage({ type: 'EXAM_RELEASED', tabId: getMyTabUid() }); } catch (_) {}
      }
    };
    window.addEventListener('beforeunload', releaseOnLeave);
    window.addEventListener('pagehide', releaseOnLeave);

    evaluateMultiTabGuard(true);
    examHeartbeatTimer = setInterval(() => evaluateMultiTabGuard(false), 1200);
  })();

  function resetWordAssessments(wordIds) {
    if (!currentUser || !Array.isArray(wordIds) || wordIds.length === 0) return 0;
    let cleared = 0;
    wordIds.forEach((wid) => {
      if (!wid) return;
      if (assessments[wid] !== undefined) cleared++;
      delete assessments[wid];
      delete srsData[wid];
    });
    currentCardIndex = 0;
    scopePositions[currentScopeKey] = 0;
    isCardFlipped = false;
    applyFilterAndBuildDeck();
    saveState();
    updateVocabMasteryUI();
    updateLeaderboardUI();
    scheduleCloudPush();
    return cleared;
  }

  function markMasteredBatch(wordIds) {
    if (!currentUser || !Array.isArray(wordIds) || wordIds.length === 0) return 0;
    const now = Date.now();
    let addedCount = 0;
    wordIds.forEach((wid) => {
      if (!wid) return;
      if (assessments[wid] !== 3) addedCount++;
      assessments[wid] = 3;
      srsData[wid] = computeNextAnkiState(wid, 3, now);
      syncLemmaPeersMastery(wid, 3, now);
    });
    saveState();
    recordDailyWordActivity(Math.max(1, addedCount));
    updateVocabMasteryUI();
    updateLeaderboardUI();
    const cur = currentScopeList[currentCardIndex];
    if (cur) {
      renderStatusTag('fc-front-status', assessments[cur.id]);
      renderStatusTag('fc-back-status', assessments[cur.id]);
    }
    scheduleCloudPush();
    return addedCount;
  }

  function speakTextWithAccent(text, accent, opts = {}) {
    if (!text) return;
    const targetAccent = (accent === 'en-GB' || accent === 'en-US') ? accent : (preferredAccent || 'en-US');
    speakCleanTextReliable(text, targetAccent, 0.92, opts);
  }

  function setWordWeakLevel(wordId, level = 1) {
    if (!currentUser || !wordId) return;
    const now = Date.now();
    assessments[wordId] = level;
    srsData[wordId] = computeNextAnkiState(wordId, level, now);
    saveState();
    updateVocabMasteryUI();
    updateLeaderboardUI();
    const cur = currentScopeList[currentCardIndex];
    if (cur && cur.id === wordId) {
      renderStatusTag('fc-front-status', assessments[cur.id]);
      renderStatusTag('fc-back-status', assessments[cur.id]);
    }
    scheduleCloudPush();
  }

  window.__VOCAB_BRIDGE__ = {
    getCurrentUser: () => currentUser,
    isTeacherUser,
    isExamAntiCheatBypassed,
    getScopedUid,
    getSyncUrl,
    getPreferredAccent: () => preferredAccent,
    speakText: speakTextWithAccent,
    speakCurrentWord: (accent) => speakCurrentWord(accent || preferredAccent),
    isAutoSpeakOn: () => autoSpeak,
    markMasteredBatch,
    setWordWeakLevel,
    resetWordAssessments,
    setDynamicTaskScopes,
    activateTaskScope,
    loadMainScope: (scopeKey) => loadScope(scopeKey || 'paraphrase'),
    refreshScopeSelect: () => {
      populateScopeSelect();
      if (isMyVocabScopeKey(currentScopeKey)) {
        applyFilterAndBuildDeck(null, { speak: false });
      }
    },
    openMyVocabDeck: (deckId) => {
      if (!window.MyVocabStore) return;
      const sk = window.MyVocabStore.getScopeKey(deckId);
      onlyUnmastered = false;
      onlyDueReview = false;
      window.TotoroUI?.switchView?.('flashcard');
      loadScope(sk);
    },
    getAssessmentsMap: () => assessments,
    getAssessments: () => assessments,
    openListeningTaskScope: (task) => {
      if (!task || !Array.isArray(task.wordIds)) return;
      const vMap = getListeningVocabMap();
      const list = task.wordIds.map((id) => vMap[id]).filter(Boolean);
      activeListeningTaskScope = {
        key: `ltask_${task.id}`,
        name: `${task.label}`,
        isListening: true,
        isListeningTask: true,
        getList: () => list,
      };
      onlyUnmastered = false;
      onlyDueReview = false;
      loadScope(activeListeningTaskScope.key);
    },
    clearListeningTaskScope: () => {
      activeListeningTaskScope = null;
      loadScope(lastListeningScopeKey || 'l_part1');
    },
    getSrsMap: () => srsData,
    isWordDueNow,
    startOldVocabReview,
    getCurrentScopeKey: () => currentScopeKey,
    jumpToNextUnlearned: () => {
      if (!currentScopeList || currentScopeList.length === 0) return false;
      const len = currentScopeList.length;
      for (let off = 1; off <= len; off++) {
        const idx = (currentCardIndex + off) % len;
        if (assessments[currentScopeList[idx].id] !== 3) {
          cancelPendingAdvance();
          currentCardIndex = idx;
          renderCurrentCard(1);
          return true;
        }
      }
      showToast('Tất cả từ trong danh sách hiện tại đã thuộc!');
      return false;
    },
    jumpToCardQuery: (rawQuery) => {
      const q = String(rawQuery || '').trim().toLowerCase();
      if (!q || !currentScopeList || currentScopeList.length === 0) return false;
      const numMatch = q.match(/^#?(\d+)$/);
      if (numMatch) {
        const n = Math.max(1, Math.min(currentScopeList.length, parseInt(numMatch[1], 10)));
        cancelPendingAdvance();
        currentCardIndex = n - 1;
        renderCurrentCard(1);
        const it = currentScopeList[currentCardIndex];
        showToast(`Thẻ #${n}: ${it?.lemma || it?.word || ''}`);
        return true;
      }
      const getWord = (x) => String(x?.lemma || x?.word || '').toLowerCase();
      const getVi = (x) => String(x?.vi || '').toLowerCase();
      let idx = currentScopeList.findIndex((x) => getWord(x) === q);
      if (idx < 0) idx = currentScopeList.findIndex((x) => getWord(x).startsWith(q));
      if (idx < 0) idx = currentScopeList.findIndex((x) => getWord(x).includes(q) || getVi(x).includes(q));
      if (idx >= 0) {
        cancelPendingAdvance();
        currentCardIndex = idx;
        renderCurrentCard(1);
        const it = currentScopeList[currentCardIndex];
        showToast(`Thẻ #${idx + 1}: ${it?.lemma || it?.word || ''}`);
        return true;
      }
      showToast(`Không tìm thấy "${rawQuery.trim()}" trong danh sách đang học`);
      return false;
    },
    speakSlowCurrentWord: (event) => {
      if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
      const item = currentScopeList[currentCardIndex];
      if (!item || !currentUser) return;
      if (speakTimeout) { clearTimeout(speakTimeout); speakTimeout = null; }
      speakCleanTextReliable(item.lemma, isCardFlipped ? 'en-GB' : 'en-US', 0.62);
      showToast(`Đọc chậm (0.62×): ${item.lemma}`);
    },
    getStudyControlsState: () => ({
      onlyUnmastered,
      onlyDueReview,
      autoSpeak,
      preferredAccent,
      showFrontContext,
      currentScopeKey,
      fullCount: fullScopeList.length,
      unmasteredCount: fullScopeList.filter((it) => assessments[it.id] !== 3).length,
      dueCount: fullScopeList.filter((it) => isWordDueNow(it)).length,
    }),
    scheduleCloudPush,
    syncPushCurrentUser,
    saveAndSync: (opts = {}) => {
      saveState();
      return syncPushCurrentUser(false, opts);
    },
    getStudentAssessmentsMap,
    showToast,
    escapeHtml,
    formatSentenceHighlight,
    openCheatWarningModal,
    showCheatWarningModal: openCheatWarningModal,
    closeCheatWarningModal,
    syncExamLock,
    broadcastTeacherTaskDeadlines,
    recheckMultiTabLock,
    bindNoPasteGuards,
    getCloudClassCache: () => cloudClassCache,
    getStudentAccounts: getScopedStudentAccounts,
    getAllStudentAccounts: () => getAccountsList().filter((a) => a.role !== 'teacher'),
    getActiveClassId,
    getActiveClassInfo,
    getLiveDeadlinesStorageKey,
    getClassRankedEntries,
    computeConsecutiveStreakForUser,
    getLastCloudSyncTime: () => lastCloudSyncTime,
    getCloudGasVersion: () => cloudGasVersion,
    syncPullClassData,
    unlockStudentCloudLocks,
    TASK_PROGRESS_KEY_BASE,
    TASK_LOCKS_KEY_BASE,
    TEACHER_UNLOCK_KEY_BASE,
    evaluateStudyIdleTimeout,
    syncStudyIdleClockUI,
    _setLastStudyActivityAtForTest: (ts) => { lastStudyActivityAt = Number(ts) || Date.now(); syncStudyIdleClockUI(); },
  };

  function applyOneTimeClassResetEpoch() {
    const EPOCH_KEY = CLASS_LOCAL_RESET_KEY;
    try {
      if (localStorage.getItem(EPOCH_KEY)) return;
      const wipePrefixes = [
        STORAGE_KEY_BASE,
        TIMER_KEY_BASE,
        DAILY_WORDS_BASE,
        STREAK_KEY_BASE,
        TASK_PROGRESS_KEY_BASE,
        TASK_LOCKS_KEY_BASE,
        TEACHER_UNLOCK_KEY_BASE,
        MASTER_COOLDOWN_KEY_BASE,
        RECALL_ACTIVE_KEY_BASE,
        'ielts_active_task_exam_',
        'ielts_task_deadlines_',
        'ielts_teacher_sent_tasks_',
        'ielts_trans_draft_',
        'ielts_task_draft_',
        'ielts_anki_reminder_dismissed',
        'ielts_thanhngoc_cloud_reset_pushed_',
        'ielts_reset_thanhngoc_clean_',
      ];
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (wipePrefixes.some((p) => k.startsWith(p))) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      localStorage.setItem(EPOCH_KEY, String(Date.now()));
    } catch (_) {}
  }

  let lastResumePullAt = 0;

  function maybePullCloudOnResume() {
    if (document.hidden || !currentUser || isTeacherUser() || !getSyncUrl()) return;
    const nowMs = Date.now();
    if (nowMs - lastResumePullAt < 3000) return;
    let hasLock = false;
    try {
      const scoped = getScopedUid(currentUser.id);
      const tl = JSON.parse(localStorage.getItem(`${TASK_LOCKS_KEY_BASE}${scoped}`) || '{}') || {};
      hasLock = Object.values(tl).some((u) => Number(u || 0) > nowMs);
    } catch (_) {}
    const lockModalOpen =
      document.getElementById('modal-task-brief')?.classList.contains('open') ||
      document.getElementById('modal-student-tasks')?.classList.contains('open');
    if (hasLock || lockModalOpen) {
      lastResumePullAt = nowMs;
      syncPullClassData();
    }
  }

  function bindMobileFlashcardSwipe() {
    const scene = document.getElementById('fc-scene');
    if (!scene || scene.dataset.swipeBound === '1') return;
    scene.dataset.swipeBound = '1';
    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let tracking = false;

    scene.addEventListener('touchstart', (e) => {
      if (!e.touches || e.touches.length !== 1) {
        tracking = false;
        return;
      }
      if (e.target && e.target.closest('button, input, textarea, select')) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startAt = Date.now();
      tracking = true;
    }, { passive: true });

    scene.addEventListener('touchend', (e) => {
      if (!tracking || !e.changedTouches || e.changedTouches.length === 0) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      const dt = Date.now() - startAt;
      if (dt < 650 && Math.abs(dx) >= 52 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        suppressSwipeClickUntil = Date.now() + 360;
        if (dx < 0) nextCard();
        else prevCard();
      }
    }, { passive: true });
  }

  function mountPandaWidgetFrames() {
    // Styled directly via CSS pastel botanical card themes & circular mascot lockups
  }

  window.addEventListener('focus', maybePullCloudOnResume);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) maybePullCloudOnResume();
  });

  // Init cleanly on load
  applyOneTimeClassResetEpoch();
  mountPandaWidgetFrames();
  bindMobileFlashcardSwipe();
  restoreAuthSession();
})();
