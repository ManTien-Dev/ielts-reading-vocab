/**
 * IELTS READING VOCAB MASTER — CLASSIC BOTANICAL VOCAB STUDIO + READING 95.5% ENGINE
 * Datasets: File 1 (1,500 Paraphrase Q&A clustered) + File 2 (3,500 Word Families 95.5% coverage) + 40 Signal Words
 */
(() => {
  'use strict';

  const APP_DATA = window.APP_DATA || {};
  const IPA_DICT = window.IPA_DICT || {};
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

  const SCOPES = [
    {
      key: 'paraphrase',
      name: 'Từ Vựng Paraphrase',
      getList: () => APP_DATA.file1_paraphrase_1500 || [],
    },
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
      key: 'advanced',
      name: 'Từ Vựng Chuyên Sâu',
      getList: () => (APP_DATA.file2_families_3500 || []).slice(2500, 3500),
    },
    {
      key: 'signal_words',
      name: 'Từ Nối Chỉ Hướng Nghĩa',
      getList: () => APP_DATA.signal_words || [],
    },
  ];

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
  let masterCooldowns = {}; // { wordId: expireTimestampMs }
  let cooldownTimer = null;
  let recallTargetItem = null;
  let recallSubmitted = false;
  let recallStage = 1;
  let recallAttemptsLeft = 2;
  let recallSynOptions = [];
  let recallSynSelected = new Set();
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

  function getAllScopes() {
    return [...SCOPES, ...dynamicTaskScopes];
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

  function getScopeDef(key) {
    const found = getAllScopes().find(s => s.key === key);
    if (found) return found;
    if (key && key.startsWith('task_') && window.TasksModule?.getTaskById) {
      const t = window.TasksModule.getTaskById(key);
      if (t) {
        return {
          key: t.id,
          name: `${t.label}: ${t.theme}`,
          isTask: true,
          getList: () => resolveTaskItems(t),
        };
      }
    }
    return SCOPES[0];
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

  function saveState() {
    if (!currentUser) return;
    try {
      const cur = currentScopeList[currentCardIndex];
      if (cur && !onlyUnmastered && !onlyDueReview) {
        scopePositions[currentScopeKey] = cur.id;
      }
      const theme = document.documentElement.getAttribute('data-theme') || 'light';
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(getUserStorageKey(), JSON.stringify({
        currentScopeKey,
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
      if (st.currentScopeKey && getAllScopes().some(s => s.key === st.currentScopeKey)) {
        currentScopeKey = st.currentScopeKey;
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

  function bumpStudyIdleActivity() {
    lastStudyActivityAt = Date.now();
    studyIdleWarnShown = false;
  }

  function handleStudyIdleTimeoutLogout() {
    if (!currentUser || isTeacherUser()) return;
    if (window.TasksModule?.getActiveTask?.() || window.TasksModule?.getExamState?.().active) return;
    stopStudyIdleMonitor();
    logoutCurrentAccount();
    showToast('Đã tự động đăng xuất do không hoạt động quá 10 phút!');
  }

  function evaluateStudyIdleTimeout() {
    if (!currentUser || isTeacherUser()) return false;
    if (window.TasksModule?.getActiveTask?.() || window.TasksModule?.getExamState?.().active) {
      lastStudyActivityAt = Date.now();
      return false;
    }
    const idleMs = Date.now() - lastStudyActivityAt;
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
    studyIdleCheckTimer = setInterval(evaluateStudyIdleTimeout, 2000);
  }

  function stopStudyIdleMonitor() {
    if (studyIdleCheckTimer) {
      clearInterval(studyIdleCheckTimer);
      studyIdleCheckTimer = null;
    }
    studyIdleWarnShown = false;
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
      const v = srcAssess[k];
      if (v === 1 || v === 2 || v === 3) compactAssess[k] = v;
    });

    let taskProgress = {};
    let taskLocks = {};
    try {
      taskProgress = JSON.parse(localStorage.getItem(`${TASK_PROGRESS_KEY_BASE}${scoped}`) || '{}') || {};
      taskLocks = JSON.parse(localStorage.getItem(`${TASK_LOCKS_KEY_BASE}${scoped}`) || '{}') || {};
    } catch (_) {}

    return {
      resetEpoch: 2026111807,
      timerByDay,
      wordsByDay,
      streakDays,
      assessments: compactAssess,
      srsData: (currentUser && getScopedUid(currentUser.id) === scoped) ? srsData : {},
      scopePositions: (currentUser && getScopedUid(currentUser.id) === scoped) ? scopePositions : {},
      currentScopeKey,
      taskProgress,
      taskLocks,
      teacherUnlockedAt: Number(localStorage.getItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`) || 0),
    };
  }

  function computeConsecutiveStreakForUser(uid) {
    const now = new Date();
    const todayKey = localStudyDayKey(now);
    let history = [];
    try {
      history = JSON.parse(localStorage.getItem(getUserStreakKey(uid)) || '[]');
      if (!Array.isArray(history)) history = [];
    } catch (_) {}
    const completed = new Set(history);
    if (getUserSecondsForDay(uid, todayKey) > 0) completed.add(todayKey);
    let streak = 0;
    const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (!completed.has(localStudyDayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (completed.has(localStudyDayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
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
      Object.entries(sd.assessments).forEach(([wid, lvl]) => {
        if (!assessments[wid] && (lvl === 1 || lvl === 2 || lvl === 3)) {
          assessments[wid] = lvl;
          assessAdded = true;
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
        saveState();
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

    try {
      const tlKey = `${TASK_LOCKS_KEY_BASE}${scoped}`;
      const localTl = JSON.parse(localStorage.getItem(tlKey) || '{}') || {};
      let tlChanged = false;
      const nowMs = Date.now();
      let unlockedActiveLock = false;

      // Xóa mọi khóa đã bị giáo viên mở khóa sau thời điểm phát sinh khóa
      Object.entries(localTl).forEach(([tid, untilMs]) => {
        const u = Number(untilMs || 0);
        if (effectiveUnlockAt > 0 && (u - LOCK_WINDOW_MS) <= effectiveUnlockAt) {
          if (u > nowMs) unlockedActiveLock = true;
          delete localTl[tid];
          tlChanged = true;
        }
      });

      if (sd.taskLocks && typeof sd.taskLocks === 'object') {
        Object.entries(sd.taskLocks).forEach(([tid, untilMs]) => {
          const cloudUntil = Number(untilMs || 0);
          if (effectiveUnlockAt > 0 && (cloudUntil - LOCK_WINDOW_MS) <= effectiveUnlockAt) return;
          const localUntil = Number(localTl[tid] || 0);
          if (cloudUntil > localUntil) {
            localTl[tid] = cloudUntil;
            tlChanged = true;
          }
        });
      }

      if (tlChanged) {
        localStorage.setItem(tlKey, JSON.stringify(localTl));
        changed = true;
        if (unlockedActiveLock && currentUser && getScopedUid(currentUser.id) === scoped) {
          showToast('Giáo viên vừa mở khóa Task cho bạn!');
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
    if (!url) return;
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}t=${Date.now()}`, { method: 'GET', cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.ok || !Array.isArray(data.students)) return;

      const nextCache = {};
      data.students.forEach(st => {
        const uid = getScopedUid(st.id);
        if (!uid) return;
        // Bỏ qua dữ liệu cloud cũ trước mốc reset 2026-11-18 của thanhngoc để hiển thị sạch sẽ 0 từ / 0 phút / 0 ngày
        if (uid === 'thanhngoc' && Number(st.syncData?.resetEpoch || 0) < 2026111807) {
          nextCache[uid] = {
            ...st,
            todayMins: 0,
            weekMins: 0,
            monthMins: 0,
            mastered: 0,
            streak: 0,
            syncData: { resetEpoch: 2026111807, timerByDay: {}, wordsByDay: {}, streakDays: [], assessments: {}, srsData: {}, scopePositions: {}, taskProgress: {}, taskLocks: {} },
          };
          return;
        }
        nextCache[uid] = st;
      });
      cloudClassCache = nextCache;

      if (currentUser) {
        const mine = cloudClassCache[getScopedUid(currentUser.id)];
        if (mine) {
          if (getScopedUid(currentUser.id) === 'thanhngoc' && !localStorage.getItem('ielts_thanhngoc_cloud_reset_pushed_2026111807')) {
            localStorage.setItem('ielts_thanhngoc_cloud_reset_pushed_2026111807', '1');
            syncPushCurrentUser(false);
          } else {
            mergeCloudEntryIntoLocal(currentUser.id, mine);
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
    }
  }

  function unlockStudentCloudLocks(studentId, unlockedAtTs = Date.now()) {
    const scoped = getScopedUid(studentId);
    if (!scoped) return;
    try {
      localStorage.setItem(`${TEACHER_UNLOCK_KEY_BASE}${scoped}`, String(unlockedAtTs));
      localStorage.setItem(`${TASK_LOCKS_KEY_BASE}${scoped}`, '{}');
    } catch (_) {}

    const prev = cloudClassCache[scoped] || {};
    const prevSync = (prev.syncData && typeof prev.syncData === 'object') ? prev.syncData : buildUserSyncData(scoped);
    const nextSync = {
      ...prevSync,
      taskLocks: {},
      teacherUnlockedAt: unlockedAtTs,
    };
    const acct = getAccountsList().find((a) => getScopedUid(a.id) === scoped);
    const mins = getUserPeriodMinutes(scoped);
    const nextEntry = {
      ...prev,
      id: acct?.id || prev.id || studentId,
      name: acct?.name || prev.name || studentId,
      todayMins: prev.todayMins ?? mins.todayMins,
      weekMins: prev.weekMins ?? mins.weekMins,
      monthMins: prev.monthMins ?? mins.monthMins,
      mastered: prev.mastered ?? getUserMasteredCount(scoped),
      streak: prev.streak ?? computeConsecutiveStreakForUser(scoped),
      syncData: nextSync,
    };
    cloudClassCache[scoped] = nextEntry;

    const url = getSyncUrl();
    if (url) {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(nextEntry),
      }).catch(() => {});
    }
  }

  function syncPushCurrentUser(useKeepalive = false) {
    const url = getSyncUrl();
    if (!url || !currentUser || isTeacherUser()) return;
    try {
      const mins = getUserPeriodMinutes(currentUser.id);
      const mastered = getUserMasteredCount(currentUser.id);
      const streak = computeConsecutiveStreakForUser(currentUser.id);
      const payload = {
        id: currentUser.id,
        name: currentUser.name,
        todayMins: mins.todayMins,
        weekMins: mins.weekMins,
        monthMins: mins.monthMins,
        mastered,
        streak,
        syncData: buildUserSyncData(currentUser.id),
      };

      cloudClassCache[getScopedUid(currentUser.id)] = {
        ...cloudClassCache[getScopedUid(currentUser.id)],
        ...payload,
      };

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        keepalive: !!useKeepalive,
      }).then(r => r.ok ? r.json() : null).then(res => {
        if (res && res.ok) {
          const now = new Date();
          lastCloudSyncTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
          updateCloudSyncBadge();
        }
      }).catch(() => {});
    } catch (_) {}
  }

  function scheduleCloudPush() {
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

  function getUserMasteredCount(uid) {
    const scoped = getScopedUid(uid);
    const cloudMastered = Number(cloudClassCache[scoped]?.mastered || 0);
    if (currentUser && scoped === getScopedUid(currentUser.id)) {
      return Object.values(assessments).filter(v => v === 3).length;
    }
    let localMastered = 0;
    try {
      const raw = localStorage.getItem(getUserStorageKey(uid));
      if (raw) {
        const st = JSON.parse(raw);
        localMastered = st?.assessments ? Object.values(st.assessments).filter(v => v === 3).length : 0;
      }
    } catch (_) {}
    return Math.max(localMastered, cloudMastered);
  }

  function getClassRankedEntries(period = currentLeaderboardTab) {
    const accounts = getAccountsList();
    const studentAccounts = accounts.filter(acc => acc.role !== 'teacher');
    const entries = studentAccounts.map((acc, idx) => {
      const mins = getUserPeriodMinutes(acc.id);
      const mastered = getUserMasteredCount(acc.id);
      const periodMins = period === 'month' ? mins.monthMins : mins.weekMins;
      return {
        id: acc.id,
        name: acc.name,
        order: idx,
        todayMins: mins.todayMins,
        weekMins: mins.weekMins,
        monthMins: mins.monthMins,
        periodMins,
        mastered,
      };
    });

    entries.sort((a, b) => {
      if (b.periodMins !== a.periodMins) return b.periodMins - a.periodMins;
      if (b.mastered !== a.mastered) return b.mastered - a.mastered;
      if (b.todayMins !== a.todayMins) return b.todayMins - a.todayMins;
      return a.order - b.order;
    });

    return entries.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
  }

  function switchLeaderboardTab(tab) {
    currentLeaderboardTab = tab;
    document.getElementById('board-tab-week')?.classList.toggle('active', tab === 'week');
    document.getElementById('board-tab-month')?.classList.toggle('active', tab === 'month');
    updateLeaderboardUI();
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

    listEl.innerHTML = visibleTop.map((p, idx) => {
      const isMe = currentUser && getScopedUid(p.id) === activeUid;
      const toneClass = `tone-${idx % 4}`;
      return `
        <div class="board-item${isMe ? ' is-me' : ''}${p.rank === 1 ? ' is-top1' : ''}">
          <span class="board-rank" style="font-size:11.5px;font-weight:800;min-width:19px;">#${p.rank}</span>
          <span class="board-avatar ${toneClass}" aria-hidden="true">${escapeHtml(getMonogram(p.name))}</span>
          <div class="board-info">
            <span class="board-name">${escapeHtml(p.name)}</span>
            <span class="board-meta">· ${p.periodMins}p</span>
          </div>
          <span class="board-score">${p.mastered} từ</span>
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
            <span class="board-rank user-rank">#${myEntry.rank}</span>
            <div class="board-info" style="display:flex;align-items:baseline;gap:4px;" title="${escapeHtml(currentUser.name)} · Hôm nay: ${myEntry.todayMins}p">
              <span class="board-name user-name">${escapeHtml(currentUser.name)}</span>
              <span class="board-meta" style="white-space:nowrap;flex-shrink:0;">· ${myEntry.periodMins}p</span>
            </div>
            <span class="board-score user-score">${myEntry.mastered} từ</span>
          `;
        } else {
          userCardEl.style.display = 'none';
          userCardEl.innerHTML = '';
        }
      }
    }
  }

  function recordDailyWordActivity() {
    if (!currentUser || isTeacherUser()) return;
    try {
      const todayKey = localStudyDayKey();
      const key = getUserDailyWordsKey(todayKey);
      const cur = parseInt(localStorage.getItem(key) || '0', 10) || 0;
      localStorage.setItem(key, String(cur + 1));
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
    const isTaskActive = Boolean(
      (currentScopeKey && currentScopeKey.startsWith('task_')) ||
      (window.TasksModule?.getActiveTask?.()) ||
      (dynamicTaskScopes.length > 0 && currentScopeKey && currentScopeKey.startsWith('task_'))
    );
    if (isTaskActive) {
      // Khi đang trong chế độ Task: BỎ HẾT các bộ từ mặc định (Paraphrase, Nền tảng, Học thuật, Chuyên sâu, Từ nối)
      // CHỈ hiển thị duy nhất các Task được giao hoặc Task hiện tại!
      let taskOptions = dynamicTaskScopes;
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
      return;
    }
    let html = SCOPES.map(it =>
      `<option value="${it.key}">${escapeHtml(it.name)}</option>`
    ).join('');
    if (dynamicTaskScopes.length > 0) {
      html += `<optgroup label="Bộ từ Task được giao">${dynamicTaskScopes.map(it =>
        `<option value="${escapeHtml(it.key)}">${escapeHtml(it.name)}</option>`
      ).join('')}</optgroup>`;
    }
    sel.innerHTML = html;
    sel.value = getAllScopes().some(s => s.key === currentScopeKey) ? currentScopeKey : SCOPES[0].key;
  }

  function applyFilterAndBuildDeck(preserveWordId = null, options = {}) {
    const def = getScopeDef(currentScopeKey);
    fullScopeList = [...def.getList()];
    const sigBtn = document.getElementById('btn-top-signalwords');
    if (sigBtn) sigBtn.style.display = currentScopeKey === 'signals' ? 'inline-flex' : 'none';

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
    cancelPendingAdvance();
    currentScopeKey = getScopeDef(scopeKey).key;
    populateScopeSelect();
    const sel = document.getElementById('study-scope-select');
    if (sel) sel.value = currentScopeKey;
    window.TasksModule?.onScopeChanged?.(currentScopeKey);
    applyFilterAndBuildDeck();
    saveState();
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
    if (/DANH TỪ/i.test(p)) return 'Danh từ';
    if (/ĐỘNG TỪ/i.test(p)) return 'Động từ';
    if (/TÍNH TỪ/i.test(p)) return 'Tính từ';
    if (/TRẠNG TỪ/i.test(p)) return 'Trạng từ';
    if (/HỌ TỪ #(\d+)/i.test(p)) return p.replace(/HỌ TỪ #(\d+)/i, 'Họ từ #$1');
    if (/SIGNAL WORD/i.test(p)) return 'Từ nối';
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

  function getCleanSynonyms(item) {
    if (Array.isArray(item?.clean_synonyms)) return item.clean_synonyms;
    return splitCsvItems(cleanSynonyms(item?.synonyms));
  }

  function getCleanAntonyms(item) {
    if (Array.isArray(item?.clean_antonyms)) return item.clean_antonyms;
    return splitCsvItems(cleanAntonyms(item?.antonyms));
  }

  function getCleanForms(item) {
    if (Array.isArray(item?.clean_forms)) return item.clean_forms;
    return getNonTrivialForms(item?.word_forms, item?.lemma);
  }

  function hasReadingTip(item) {
    if (!item) return false;
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

  function renderCurrentCard(direction = 0, options = {}) {
    cancelPendingAdvance();
    const scene = document.getElementById('fc-scene');
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
      if (finExamBtn) finExamBtn.style.display = currentScopeKey.startsWith('task_') ? 'inline-flex' : 'none';
      window.TasksModule?.updateTaskStudyBar?.();
      return;
    }
    const finExamBtn = document.getElementById('btn-finished-task-exam');
    if (finExamBtn) finExamBtn.style.display = 'none';
    window.TasksModule?.updateTaskStudyBar?.();

    scene.style.display = 'block';
    finishedBox.style.display = 'none';

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

    // Mặt trước (Tối giản: chỉ POS + Từ + IPA + UK/US)
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
    if (tipBtn) tipBtn.style.display = hasReadingTip(item) ? 'inline-flex' : 'none';

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
            <div class="fc-pair-label">Đồng nghĩa</div>
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
            <div class="fc-pair-label">Gia đình từ</div>
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
    if (backDisplaySent) {
      backSent.innerHTML = formatSentenceHighlight(backDisplaySent, backHighlightTerm);
      backSent.style.display = 'block';
    } else {
      backSent.style.display = 'none';
      backSent.innerHTML = '';
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
      speakCurrentWord(preferredAccent);
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
    leftParts.push('<div class="tip-col-heading tip-exam-title-bar">EXAMPLE</div>');

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

  function renderReadingTipModalContent(item) {
    const pillEl = document.getElementById('tip-modal-pill');
    if (pillEl) pillEl.textContent = 'READING TIP';

    const { leftParts, rightParts } = buildReadingTipParts(item);
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

  function getMasterCooldownRemainingSec(wordId) {
    const until = masterCooldowns[wordId] || 0;
    const diff = until - Date.now();
    if (diff <= 0) {
      if (masterCooldowns[wordId]) delete masterCooldowns[wordId];
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

  function stopRecallInputTimer() {
    if (recallDeadlineTimer) {
      clearInterval(recallDeadlineTimer);
      recallDeadlineTimer = null;
    }
    recallDeadlineAt = 0;
  }

  function updateRecallCountdownBadge() {
    const badge = document.getElementById('recall-timer-badge');
    if (!badge || !recallTargetItem || recallSubmitted) return;
    const rem = Math.max(0, Math.ceil((recallDeadlineAt - Date.now()) / 1000));
    badge.textContent = `${rem}s`;
    badge.classList.toggle('is-urgent', rem <= 5);
    if (rem <= 0) {
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
      const sameCat = shuffleArray(allSig.filter((x) => x.id !== item.id && x.category === item.category));
      sameCat.slice(0, 4).forEach((x) => addOption(x.lemma, true));

      const catText = String(item.category || '').toLowerCase();
      const isContrastSide = catText.includes('tương phản') || catText.includes('nhượng bộ');
      const oppPool = shuffleArray(allSig.filter((x) => {
        if (x.id === item.id || x.category === item.category) return false;
        const c = String(x.category || '').toLowerCase();
        return isContrastSide ? (c.includes('bổ sung') || c.includes('nguyên nhân') || c.includes('kết luận')) : (c.includes('tương phản') || c.includes('nhượng bộ'));
      }));
      const otherPool = shuffleArray(allSig.filter((x) => x.id !== item.id && x.category !== item.category));
      for (const cand of [...oppPool, ...otherPool]) {
        if (options.length >= 8) break;
        addOption(cand.lemma, false);
      }
      return shuffleArray(options);
    }

    const cleanSyns = shuffleArray(
      (Array.isArray(item?.clean_synonyms) ? item.clean_synonyms : [])
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
      (Array.isArray(item?.clean_antonyms) ? item.clean_antonyms : [])
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

  function renderRecallSynGrid(revealAnswers = false) {
    const grid = document.getElementById('recall-syn-grid');
    if (!grid) return;
    grid.innerHTML = '';
    recallSynOptions.forEach((opt, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recall-syn-opt';
      const isSelected = recallSynSelected.has(idx);
      if (revealAnswers) {
        btn.disabled = true;
        if (opt.isCorrect && isSelected) {
          btn.classList.add('is-right');
          btn.textContent = `✓ ${opt.text}`;
        } else if (opt.isCorrect && !isSelected) {
          btn.classList.add('is-missed');
          btn.textContent = `Thiếu: ${opt.text}`;
        } else if (!opt.isCorrect && isSelected) {
          btn.classList.add('is-wrong');
          btn.textContent = `✗ ${opt.text}`;
        } else {
          btn.textContent = opt.text;
        }
      } else {
        btn.textContent = opt.text;
        if (isSelected) btn.classList.add('is-selected');
        btn.onclick = () => toggleRecallSynOption(idx);
      }
      grid.appendChild(btn);
    });
  }

  function toggleRecallSynOption(idx) {
    if (recallStage !== 2 || recallSubmitted) return;
    if (recallSynSelected.has(idx)) recallSynSelected.delete(idx);
    else recallSynSelected.add(idx);
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
        p1.textContent = 'Đã hết lượt thử cho thẻ này.';
      } else {
        p1.textContent = rule.strict
          ? 'Gõ chính xác từ tiếng Anh vừa học (Ôn tập · chỉ được nhập 1 lần).'
          : `Gõ chính xác từ tiếng Anh vừa học (còn ${recallAttemptsLeft} lần thử).`;
      }
    }
    if (p2) {
      const targetTotal = recallSynOptions.filter((o) => o.isCorrect).length;
      const selBadge = targetTotal > 0
        ? ` <span class="recall-select-counter">Đã chọn ${recallSynSelected.size}/${targetTotal}</span>`
        : '';
      if (recallAttemptsLeft <= 0) {
        p2.innerHTML = 'Đã hết lượt thử cho bước chọn đồng nghĩa.';
      } else {
        const baseText = rule.strict
          ? 'Chỉ click đúng các từ đồng nghĩa (Ôn tập · chỉ 1 lần xác nhận):'
          : `Chỉ click đúng các từ đồng nghĩa (còn ${recallAttemptsLeft} lần thử):`;
        p2.innerHTML = escapeHtml(baseText) + selBadge;
      }
    }
  }

  function enterRecallStage2(item) {
    stopRecallInputTimer();
    recallStage = 2;
    recallSubmitted = false;
    recallAttemptsLeft = getRecallRule(item).maxAttempts;
    recallSynOptions = buildRecallSynonymOptions(item);
    recallSynSelected = new Set();

    const limitSec = getRecallTimeLimitSec(item, 2);
    recallDeadlineAt = Date.now() + limitSec * 1000;

    const stageBadge = document.getElementById('recall-stage-badge');
    const timerBadge = document.getElementById('recall-timer-badge');
    const hintBox = document.getElementById('recall-hint-box');
    const targetWordEl = document.getElementById('recall-stage2-word');
    const stage1Body = document.getElementById('recall-stage1-body');
    const stage2Body = document.getElementById('recall-stage2-body');
    const inp = document.getElementById('recall-word-input');
    const fb = document.getElementById('recall-feedback');

    inp?.blur();
    if (stageBadge) stageBadge.textContent = 'Test 2';
    if (timerBadge) {
      timerBadge.textContent = `${limitSec}s`;
      timerBadge.classList.remove('is-urgent');
    }
    if (hintBox) hintBox.style.display = 'block';
    if (targetWordEl) targetWordEl.textContent = item.lemma || '';
    if (stage1Body) stage1Body.style.display = 'none';
    if (stage2Body) stage2Body.style.display = 'block';
    if (fb) {
      fb.style.display = 'none';
      fb.className = 'recall-feedback';
      fb.innerHTML = '';
    }

    updateRecallPromptAttempts(item);
    renderRecallSynGrid(false);
    recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
  }

  function failRecallCheck(item, reasonPrefix = 'Chưa chính xác!') {
    stopRecallInputTimer();
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

    if (badge && reasonPrefix.includes('Hết')) {
      badge.textContent = '0s';
      badge.classList.add('is-urgent');
    }
    if (inp) inp.disabled = true;
    if (recallStage === 2) {
      renderRecallSynGrid(true);
    }
    syncExamLock(false);
    if (btnCancel) btnCancel.style.display = 'none';
    if (btnSubmit) btnSubmit.style.display = 'none';

    masterCooldowns[item.id] = Date.now() + rule.cooldownMs;
    ensureCooldownTicker();
    commitAssessment(item, 1);
    updateAssess3CooldownUI();

    if (fb) {
      fb.style.display = 'block';
      fb.className = 'recall-feedback err';
      if (recallStage === 2) {
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

  function openRecallModal(item) {
    if (!syncExamLock(true, 'Kiểm tra nhớ từ')) return;
    stopRecallInputTimer();
    const rule = getRecallRule(item);
    recallTargetItem = item;
    recallSubmitted = false;
    recallStage = 1;
    recallAttemptsLeft = rule.maxAttempts;
    recallLeaveWarnings = 0;
    lastRecallLeaveAt = 0;
    recallSynOptions = [];
    recallSynSelected = new Set();

    const limitSec = getRecallTimeLimitSec(item, 1);
    recallDeadlineAt = Date.now() + limitSec * 1000;

    const stageBadge = document.getElementById('recall-stage-badge');
    const timerBadge = document.getElementById('recall-timer-badge');
    const hintBox = document.getElementById('recall-hint-box');
    const stage1Body = document.getElementById('recall-stage1-body');
    const stage2Body = document.getElementById('recall-stage2-body');
    const inp = document.getElementById('recall-word-input');
    const fb = document.getElementById('recall-feedback');
    const btnCancel = document.getElementById('btn-recall-cancel');
    const btnSubmit = document.getElementById('btn-recall-submit');
    const btnReturn = document.getElementById('btn-recall-return');

    if (stageBadge) stageBadge.textContent = 'Test 1';
    if (timerBadge) {
      timerBadge.textContent = `${limitSec}s`;
      timerBadge.classList.remove('is-urgent');
    }
    if (hintBox) hintBox.style.display = 'none';
    if (stage1Body) stage1Body.style.display = 'block';
    if (stage2Body) stage2Body.style.display = 'none';
    if (inp) {
      inp.value = '';
      inp.disabled = false;
    }
    if (fb) {
      fb.style.display = 'none';
      fb.className = 'recall-feedback';
      fb.innerHTML = '';
    }
    if (btnCancel) btnCancel.style.display = 'inline-flex';
    if (btnSubmit) btnSubmit.style.display = 'inline-flex';
    if (btnReturn) btnReturn.style.display = 'none';

    updateRecallPromptAttempts(item);
    document.getElementById('fc-scene')?.style.setProperty('visibility', 'hidden');
    document.querySelector('#modal-recall-check .recall-check-card')?.style.removeProperty('visibility');
    document.getElementById('modal-recall-check')?.classList.add('open');
    recallDeadlineTimer = setInterval(updateRecallCountdownBadge, 250);
    setTimeout(() => inp?.focus(), 40);
  }

  function closeRecallModal(event) {
    if (event && event.target !== document.getElementById('modal-recall-check')) return;
    stopRecallInputTimer();
    document.getElementById('modal-recall-check')?.classList.remove('open');
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
    assessments[item.id] = level;
    srsData[item.id] = computeNextAnkiState(item.id, level, Date.now());
    renderStatusTag('fc-front-status', level);
    renderStatusTag('fc-back-status', level);
    saveState();

    recordDailyWordActivity();
    saveStudyTimerState();
    updateStudyStreakUI();
    updateVocabMasteryUI();
    updateLeaderboardUI();
    window.TasksModule?.onStudyAssessmentChanged?.(currentScopeKey, assessments, item, level);
    scheduleCloudPush();
  }

  function submitRecallCheck(event) {
    if (event) event.preventDefault();
    if (!recallTargetItem || recallSubmitted) return;

    const item = recallTargetItem;
    const fb = document.getElementById('recall-feedback');

    if (recallStage === 1) {
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
        enterRecallStage2(item);
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

    // Stage 2: synonym selection verification
    if (recallSynSelected.size === 0) {
      if (fb) {
        fb.style.display = 'block';
        fb.className = 'recall-feedback err';
        fb.textContent = 'Vui lòng click chọn ít nhất 1 từ đồng nghĩa trước khi xác nhận.';
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
      stopRecallInputTimer();
      recallSubmitted = true;
      delete masterCooldowns[item.id];
      updateAssess3CooldownUI();
      commitAssessment(item, 3);
      closeRecallModal();
      showToast(`Chính xác! Đã thuộc "${item.lemma}".`);
      advanceDeckAfterAssess3();
      return;
    }

    recallAttemptsLeft = Math.max(0, recallAttemptsLeft - 1);
    if (recallAttemptsLeft > 0) {
      updateRecallPromptAttempts(item);
      if (fb) {
        fb.style.display = 'block';
        fb.className = 'recall-feedback err';
        fb.textContent = `Chưa chính xác! Hãy chọn lại các từ đồng nghĩa (còn ${recallAttemptsLeft} lần thử).`;
      }
      return;
    }

    failRecallCheck(item, 'Chưa chính xác!');
  }

  function flipCurrentCard(event) {
    if (event && event.currentTarget?.id === 'fc-scene' && event.target.closest('button')) return;
    if (currentScopeList.length === 0 || currentCardIndex >= currentScopeList.length) return;
    isCardFlipped = !isCardFlipped;
    document.getElementById('fc-card')?.classList.toggle('flipped', isCardFlipped);
    document.getElementById('btn-flip-action').textContent = isCardFlipped ? 'Mặt trước' : 'Xem nghĩa';
    if (pendingInitialSpeak && autoSpeak) {
      pendingInitialSpeak = false;
      speakCurrentWord(preferredAccent);
    }
  }

  function nextCard() {
    cancelPendingAdvance();
    if (currentScopeList.length === 0) return;
    if (currentCardIndex < currentScopeList.length) currentCardIndex++;
    renderCurrentCard(1);
  }

  function prevCard() {
    cancelPendingAdvance();
    if (currentCardIndex > 0) {
      currentCardIndex--;
      renderCurrentCard(-1);
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
      speakCurrentWord(preferredAccent);
      showToast('Đã bật tự động đọc từ vựng');
    } else {
      stopSpeechPlayback();
      showToast('Đã tắt tự động đọc từ vựng');
    }
  }

  function speakCurrentWord(accent = preferredAccent, event) {
    if (event && typeof event.stopPropagation === 'function') {
      event.stopPropagation();
    }
    const targetAccent = (accent === 'en-GB' || accent === 'en-US') ? accent : preferredAccent;
    const item = currentScopeList[currentCardIndex];
    if (!item || !('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return;

    stopSpeechPlayback();
    speakTimeout = setTimeout(() => {
      speakTimeout = null;
      const latestItem = currentScopeList[currentCardIndex];
      if (!latestItem || !currentUser) return;
      try {
        window.speechSynthesis.resume?.();
        const utt = new SpeechSynthesisUtterance(latestItem.lemma);
        utt.lang = targetAccent;
        utt.rate = 0.92;
        window.speechSynthesis.speak(utt);
      } catch (_) {}
    }, 35);
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
    if (teacherPreviewStudy) {
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
    if (tPreviewBtn) tPreviewBtn.style.display = teacher ? 'inline-flex' : 'none';
    if (tPreviewTxt) tPreviewTxt.textContent = teacherPreviewStudy ? 'Quay lại Quản lý' : 'Xem trang học';
    const tRefreshBtn = document.getElementById('btn-teacher-refresh');
    if (tRefreshBtn) tRefreshBtn.style.display = (teacher && !teacherPreviewStudy) ? 'inline-flex' : 'none';
    const sTasksBtn = document.getElementById('btn-open-student-tasks');
    if (sTasksBtn && teacher) sTasksBtn.style.display = 'none';
    const chipTxt = document.getElementById('header-mode-chip-text');
    if (chipTxt) chipTxt.textContent = (teacher && !teacherPreviewStudy) ? 'Quản lý lớp' : 'Reading 95,5%';
    // Toggle Teacher Dashboard vs Student Study Workspace cleanly
    const teacherScreen = document.getElementById('screen-teacher');
    const studyScreen = document.getElementById('screen-study');
    const taskScreen = document.getElementById('screen-task');
    if (teacher && !teacherPreviewStudy) {
      if (studyScreen) {
        studyScreen.classList.remove('active');
        studyScreen.style.display = 'none';
      }
      if (taskScreen) {
        taskScreen.classList.remove('active', 'open');
      }
      if (teacherScreen) {
        teacherScreen.style.display = 'flex';
        teacherScreen.classList.add('active');
      }
    } else {
      if (teacherScreen) {
        teacherScreen.classList.remove('active');
        teacherScreen.style.display = 'none';
      }
      if (studyScreen) {
        studyScreen.style.display = 'block';
        studyScreen.classList.add('active');
      }
    }
  }

  function renderClassReportTable() {
    updateClassReportHeaderAndActions();
    const tbody = document.getElementById('class-report-tbody');
    if (!tbody) return;
    const ranked = getClassRankedEntries('week');
    const activeUid = getScopedUid(currentUser?.id);
    tbody.innerHTML = ranked.map(item => {
      const isMe = currentUser && !isTeacherUser() && getScopedUid(item.id) === activeUid;
      return `
        <tr class="${isMe ? 'is-me' : ''}">
          <td>#${item.rank}</td>
          <td><strong>${escapeHtml(item.name)}</strong></td>
          <td>${item.todayMins} phút</td>
          <td>${item.weekMins} phút</td>
          <td>${item.monthMins} phút</td>
          <td>${item.mastered} từ</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" style="text-align:center;">Chưa có tài khoản học viên.</td></tr>';
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
    const mins = getUserPeriodMinutes(currentUser.id);
    const mastered = getUserMasteredCount(currentUser.id);
    const todayStr = localStudyDayKey();
    const msg = `[Báo cáo học Vocab - ${todayStr}]\nHọc viên: ${currentUser.name} (${currentUser.id})\n- Hôm nay: ${mins.todayMins} phút\n- Tuần này: ${mins.weekMins} phút\n- Tháng này: ${mins.monthMins} phút\n- Đã thuộc: ${mastered} từ`;
    copyTextWithFeedback(msg, 'Đã sao chép báo cáo cá nhân!');
  }

  function copyFullClassReport() {
    const ranked = getClassRankedEntries('week');
    const todayStr = localStudyDayKey();
    const lines = ranked.map(r => `#${r.rank} | ${r.name} (${r.id}) | Hôm nay: ${r.todayMins}p | Tuần: ${r.weekMins}p | Tháng: ${r.monthMins}p | Thuộc: ${r.mastered} từ`);
    const msg = `[Bảng Xếp Hạng Giờ Học Lớp - ${todayStr}]\n` + lines.join('\n');
    copyTextWithFeedback(msg, 'Đã sao chép bảng giờ học cả lớp!');
  }

  // Settings Menu Modal
  function openMenuModal() {
    updateAutoSpeakUI();
    syncThemeUIControls();
    updateClassReportHeaderAndActions();
    const chk = document.getElementById('chk-show-front-context');
    if (chk) chk.checked = showFrontContext;
    const accEl = document.getElementById('menu-account-summary');
    if (accEl && currentUser) {
      const roleText = currentUser.role === 'teacher' ? 'Giáo viên' : 'Học viên';
      accEl.textContent = `${roleText}: ${currentUser.name} (ID: ${currentUser.id})`;
    }
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
    localStorage.removeItem(getUserStorageKey());
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
    displayedStreak = null;
  }

  function enterAppForUser(account, options = {}) {
    resetInMemoryStudyState();
    currentUser = account;

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
    updateAutoSpeakUI();
    updateClassReportHeaderAndActions();
    if (isTeacherUser()) {
      pauseTimer();
      document.getElementById('anki-due-reminder')?.classList.remove('visible');
      updateCloudSyncBadge();
      syncPullClassData();
    } else {
      populateScopeSelect();
      const autoSpeakOnEnter = !!options.autoSpeakOnEnter;
      pendingInitialSpeak = !autoSpeakOnEnter && autoSpeak;
      applyFilterAndBuildDeck(null, { speak: autoSpeakOnEnter });
      loadStudyTimerState();
      startTimer();
      startStudyIdleMonitor();
      updateLeaderboardUI();
      updateStudyStreakUI();
      updateCloudSyncBadge();
      syncPullClassData();
    }
    if (cloudPullTimer) clearInterval(cloudPullTimer);
    cloudPullTimer = setInterval(() => {
      if (currentUser) syncPullClassData();
    }, 30000);
    window.TasksModule?.onUserEntered?.(account);
  }

  function handleLoginSubmit(event) {
    if (event) event.preventDefault();
    const idInput = document.getElementById('login-id-input')?.value || '';
    const passInput = document.getElementById('login-pass-input')?.value || '';
    const remember = !!document.getElementById('login-remember-chk')?.checked;

    if (!idInput.trim() || !passInput) {
      showLoginError('Vui lòng nhập đầy đủ Mã học viên (ID) và Mật khẩu.');
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
      pauseTimer();
      saveState();
      syncPushCurrentUser(true);
    }
    resetInMemoryStudyState();
    currentUser = null;

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
      closeRecallModal();
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
      speakCurrentWord(preferredAccent);
    } else if (['1', '2', '3'].includes(e.key) && isCardFlipped) {
      assessCurrentWord(parseInt(e.key, 10));
    }
  });

  // Expose handlers to HTML onclick
  Object.assign(window, {
    onScopeChange, flipCurrentCard, nextCard, prevCard, assessCurrentWord,
    toggleUnmasteredFilter, activateUnmasteredOnly, restartScopeStudy,
    toggleDueReviewFilter, activateDueReviewOnly, dismissAnkiReminder,
    shuffleCurrentScope, speakCurrentWord, toggleAutoSpeak, setAutoSpeakAccent, openWordListModal, closeWordListModal,
    filterWordListByStatus, onWordListSearch, loadMoreWordsInList, jumpToWord,
    studySignalAndJump, openSignalWordsModal, closeSignalWordsModal, filterSignalWordsByCategory,
    filterSignalWordsList, studySignalWordsAsDeck, openReadingTipModal, closeReadingTipModal,
    submitRecallCheck, closeRecallModal,
    openClassReportModal, closeClassReportModal, copyMyStudyReport, copyFullClassReport,
    openMenuModal, closeMenuModal, toggleTheme, setThemeMode, toggleMobileWidgets, toggleFrontContext, resetAllProgress,
    toggleTimer, resetTimer, setTimerMode, setCountdownMinutes, toggleTimerSound,
    switchLeaderboardTab, switchStreakChartTab,
    handleLoginSubmit, togglePasswordVisibility, logoutCurrentAccount,
  });

  function openCheatWarningModal(msg, onDismiss) {
    const modal = document.getElementById('modal-cheat-warn');
    const msgEl = document.getElementById('cheat-warn-msg');
    const btn = document.getElementById('btn-cheat-warn-close');
    if (!modal || !btn) return;
    if (msgEl && msg) msgEl.textContent = msg;
    modal.classList.add('open');
    btn.onclick = () => {
      modal.classList.remove('open');
      if (typeof onDismiss === 'function') onDismiss();
    };
    setTimeout(() => btn.focus(), 40);
  }

  function closeCheatWarningModal() {
    document.getElementById('modal-cheat-warn')?.classList.remove('open');
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

  function bindNoPasteGuards(el, toastMsg) {
    if (!el || el.dataset.noPasteBound === '1') return;
    el.dataset.noPasteBound = '1';
    const msg = toastMsg || 'Không được dán (paste) khi kiểm tra — hãy tự nhập trực tiếp!';
    ['paste', 'drop', 'copy', 'cut', 'contextmenu'].forEach((evt) => {
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
      const modal = document.getElementById('modal-recall-check');
      if (!modal?.classList.contains('open') || !recallTargetItem || recallSubmitted) return;
      if (document.getElementById('modal-cheat-warn')?.classList.contains('open')) return;
      const now = Date.now();
      if (now - lastRecallLeaveAt < 800) return;
      lastRecallLeaveAt = now;
      recallLeaveWarnings += 1;
      if (recallLeaveWarnings === 1) {
        const pausedAt = Date.now();
        const card = document.querySelector('#modal-recall-check .recall-check-card');
        const inp = document.getElementById('recall-word-input');
        if (inp) inp.value = '';
        if (card) card.style.setProperty('visibility', 'hidden');
        const fb = document.getElementById('recall-feedback');
        if (fb) {
          fb.style.display = 'block';
          fb.className = 'recall-feedback err';
          fb.innerHTML = '<strong>Cảnh báo (lần 1/2):</strong> Đã phát hiện rời tab kiểm tra. Đây là <strong>lần thử cuối</strong> — rời thêm lần nữa sẽ tính sai!';
        }
        openCheatWarningModal(
          reason || 'Phát hiện bạn vừa chuyển tab hoặc rời khỏi cửa sổ khi đang Kiểm tra nhớ từ! Nội dung bài đã bị ẩn.',
          () => {
            if (recallDeadlineAt > 0) recallDeadlineAt += (Date.now() - pausedAt);
            if (card) card.style.removeProperty('visibility');
            if (recallStage === 1) inp?.focus();
          }
        );
        return;
      }
      closeCheatWarningModal();
      document.querySelector('#modal-recall-check .recall-check-card')?.style.removeProperty('visibility');
      failRecallCheck(recallTargetItem, `${reason} (Lần 2)`);
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
      handleLeaveAttempt('Phát hiện rời khỏi cửa sổ kiểm tra!');
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
      el.classList.add('exam-no-copy');
      ['copy', 'cut', 'contextmenu'].forEach((evt) => {
        el.addEventListener(evt, (e) => e.preventDefault());
      });
    });

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

  function markMasteredBatch(wordIds) {
    if (!currentUser || !Array.isArray(wordIds) || wordIds.length === 0) return 0;
    const now = Date.now();
    let addedCount = 0;
    wordIds.forEach((wid) => {
      if (!wid) return;
      if (assessments[wid] !== 3) addedCount++;
      assessments[wid] = 3;
      srsData[wid] = computeNextAnkiState(wid, 3, now);
    });
    saveState();
    recordDailyWordActivity();
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

  function speakTextWithAccent(text, accent) {
    if (!text) return;
    const clean = String(text).replace(/\s*\/\s*/g, ' or ').trim();
    try {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(clean);
      u.lang = accent || preferredAccent || 'en-US';
      u.rate = 0.94;
      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  window.__VOCAB_BRIDGE__ = {
    getCurrentUser: () => currentUser,
    isTeacherUser,
    getScopedUid,
    getSyncUrl,
    getPreferredAccent: () => preferredAccent,
    speakText: speakTextWithAccent,
    markMasteredBatch,
    setDynamicTaskScopes,
    activateTaskScope,
    loadMainScope: (scopeKey) => loadScope(scopeKey || SCOPES[0].key),
    getAssessmentsMap: () => assessments,
    getCurrentScopeKey: () => currentScopeKey,
    saveAndSync: () => {
      saveState();
      syncPushCurrentUser(false);
    },
    showToast,
    escapeHtml,
    formatSentenceHighlight,
    openCheatWarningModal,
    closeCheatWarningModal,
    syncExamLock,
    recheckMultiTabLock,
    bindNoPasteGuards,
    getCloudClassCache: () => cloudClassCache,
    getStudentAccounts: () => getAccountsList().filter((a) => a.role !== 'teacher'),
    getClassRankedEntries,
    computeConsecutiveStreakForUser,
    getLastCloudSyncTime: () => lastCloudSyncTime,
    syncPullClassData,
    unlockStudentCloudLocks,
    TASK_PROGRESS_KEY_BASE,
    TASK_LOCKS_KEY_BASE,
    TEACHER_UNLOCK_KEY_BASE,
    evaluateStudyIdleTimeout,
    _setLastStudyActivityAtForTest: (ts) => { lastStudyActivityAt = Number(ts) || Date.now(); },
  };

  function applyOneTimeStudentResetEpoch() {
    const EPOCH_KEY = 'ielts_reset_thanhngoc_clean_20261118_v5';
    const TARGET_UID = 'thanhngoc';
    try {
      if (localStorage.getItem(EPOCH_KEY)) return;
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.toLowerCase().includes(TARGET_UID) || k.startsWith('ielts_trans_draft_')) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => {
        try { localStorage.removeItem(k); } catch (_) {}
      });
      localStorage.setItem(EPOCH_KEY, String(Date.now()));
    } catch (_) {}
  }

  function mountPandaWidgetFrames() {
    // Styled directly via CSS pastel botanical card themes & circular mascot lockups
  }

  // Init cleanly on load
  applyOneTimeStudentResetEpoch();
  mountPandaWidgetFrames();
  restoreAuthSession();
})();
