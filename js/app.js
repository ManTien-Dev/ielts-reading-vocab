/**
 * IELTS READING VOCAB MASTER — CLASSIC BOTANICAL VOCAB STUDIO + READING 95.5% ENGINE
 * Datasets: File 1 (1,500 Paraphrase Q&A clustered) + File 2 (3,500 Word Families 95.5% coverage) + 40 Signal Words
 */
(() => {
  'use strict';

  const APP_DATA = window.APP_DATA || {};
  const IPA_DICT = window.IPA_DICT || {};
  const AUTH_SESSION_KEY = 'ielts_reading_auth_session_v1';
  const THEME_STORAGE_KEY = 'ielts_reading_theme_v1';
  const STORAGE_KEY_BASE = 'ielts_reading_vocab_v2';
  const TIMER_KEY_BASE = 'ielts_reading_timer_';
  const DAILY_WORDS_BASE = 'ielts_reading_daily_words_';
  const STREAK_KEY_BASE = 'ielts_reading_streak_days';

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
  let showFrontContext = false;
  let assessments = {}; // { id: 1|2|3 }
  let scopePositions = {}; // { scopeKey: wordId }
  let isAdvancing = false;
  let advanceTimeout = null;
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

  function getScopeDef(key) {
    return SCOPES.find(s => s.key === key) || SCOPES[0];
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
    toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  function saveState() {
    if (!currentUser) return;
    try {
      const cur = currentScopeList[currentCardIndex];
      if (cur && !onlyUnmastered) {
        scopePositions[currentScopeKey] = cur.id;
      }
      const theme = document.documentElement.getAttribute('data-theme') || 'dark';
      localStorage.setItem(THEME_STORAGE_KEY, theme);
      localStorage.setItem(getUserStorageKey(), JSON.stringify({
        currentScopeKey,
        assessments,
        scopePositions,
        onlyUnmastered,
        showFrontContext,
        theme,
      }));
    } catch (e) {
      console.warn('Save failed:', e);
    }
  }

  function loadThemePreference() {
    try {
      const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        document.documentElement.setAttribute('data-theme', savedTheme);
      }
    } catch (_) {}
  }

  function loadState() {
    loadThemePreference();
    if (!currentUser) return;
    try {
      const raw = localStorage.getItem(getUserStorageKey());
      if (!raw) return;
      const st = JSON.parse(raw);
      if (st.currentScopeKey && SCOPES.some(s => s.key === st.currentScopeKey)) {
        currentScopeKey = st.currentScopeKey;
      }
      if (st.assessments && typeof st.assessments === 'object') assessments = st.assessments;
      if (st.scopePositions && typeof st.scopePositions === 'object') scopePositions = st.scopePositions;
      if (typeof st.onlyUnmastered === 'boolean') onlyUnmastered = st.onlyUnmastered;
      if (typeof st.showFrontContext === 'boolean') showFrontContext = st.showFrontContext;
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
  function updateVocabMasteryUI() {
    const scopeList = fullScopeList || [];
    const total = scopeList.length || 1;

    let countMastered = 0;
    let countSlow = 0;
    let countUnlearned = 0;

    scopeList.forEach(item => {
      const val = assessments[item.id];
      if (val === 3) countMastered++;
      else if (val === 2) countSlow++;
      else countUnlearned++;
    });

    const pctMastered = Math.round((countMastered / total) * 100);
    const pctSlow = Math.round((countSlow / total) * 100);
    const pctUnlearned = Math.max(0, 100 - pctMastered - pctSlow);

    const barMastered = document.getElementById('bar-mastered');
    const barSlow = document.getElementById('bar-slow');
    const barUnlearned = document.getElementById('bar-unlearned');
    if (barMastered) barMastered.style.width = pctMastered + '%';
    if (barSlow) barSlow.style.width = pctSlow + '%';
    if (barUnlearned) barUnlearned.style.width = pctUnlearned + '%';

    const elMastered = document.getElementById('stat-count-mastered');
    const elSlow = document.getElementById('stat-count-slow');
    const elUnlearned = document.getElementById('stat-count-unlearned');
    if (elMastered) elMastered.textContent = countMastered;
    if (elSlow) elSlow.textContent = countSlow;
    if (elUnlearned) elUnlearned.textContent = countUnlearned;

    const elPctMastered = document.getElementById('stat-pct-mastered');
    const elPctSlow = document.getElementById('stat-pct-slow');
    const elPctUnlearned = document.getElementById('stat-pct-unlearned');
    if (elPctMastered) elPctMastered.textContent = `(${pctMastered}%)`;
    if (elPctSlow) elPctSlow.textContent = `(${pctSlow}%)`;
    if (elPctUnlearned) elPctUnlearned.textContent = `(${pctUnlearned}%)`;

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

  function updateTimerDisplay() {
    const digitsEl = document.getElementById('timer-digits');
    const statusEl = document.getElementById('timer-status-text');
    const todayTotalEl = document.getElementById('timer-today-total');
    if (!digitsEl) return;

    if (timerMode === 'countup') {
      digitsEl.textContent = formatTime(timerElapsedSeconds);
      if (statusEl) statusEl.textContent = timerRunning ? 'Đang tính giờ học tập...' : 'Tạm dừng';
    } else {
      const remaining = Math.max(0, timerTargetSeconds - timerElapsedSeconds);
      digitsEl.textContent = formatTime(remaining);
      if (statusEl) statusEl.textContent = timerRunning ? 'Đang đếm ngược mục tiêu...' : 'Tạm dừng';
    }

    const timerBox = digitsEl.closest('.timer-display-box');
    timerBox?.classList.toggle('motion-running', timerRunning);
    timerBox?.classList.toggle('motion-urgent', timerRunning && timerMode === 'countdown' && timerTargetSeconds - timerElapsedSeconds <= 60);

    if (todayTotalEl) {
      const mins = Math.floor(todayStudySeconds / 60);
      todayTotalEl.textContent = mins + ' phút';
    }
  }

  function saveStudyTimerState() {
    if (!currentUser) return;
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
    if (!currentUser) {
      todayStudySeconds = 0;
      return;
    }
    try {
      const todayKey = localStudyDayKey();
      todayStudySeconds = parseInt(localStorage.getItem(getUserTimerKey(todayKey)) || '0', 10) || 0;
    } catch (e) {}
  }

  function startTimer() {
    if (!currentUser) return;
    if (timerInterval) clearInterval(timerInterval);
    timerRunning = true;
    const playText = document.getElementById('timer-play-text');
    if (playText) playText.textContent = 'Tạm dừng';

    timerInterval = setInterval(() => {
      if (!currentUser) {
        pauseTimer();
        return;
      }
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
    if (timerRunning) pauseTimer();
    else startTimer();
  }

  function resetTimer() {
    pauseTimer();
    timerElapsedSeconds = 0;
    updateTimerDisplay();
  }

  function setTimerMode(mode) {
    timerMode = mode;
    timerElapsedSeconds = 0;
    document.getElementById('timer-mode-up')?.classList.toggle('active', mode === 'countup');
    document.getElementById('timer-mode-down')?.classList.toggle('active', mode === 'countdown');
    const presetsEl = document.getElementById('timer-presets');
    if (presetsEl) presetsEl.style.display = mode === 'countdown' ? 'flex' : 'none';
    startTimer();
  }

  function setCountdownMinutes(mins) {
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
      subEl.textContent = 'Đang chạy lưu cục bộ trên máy (chưa gắn link Google Sheet đồng bộ online)';
    } else if (lastCloudSyncTime) {
      subEl.textContent = `Đồng bộ tự động Google Sheet · Cập nhật lúc ${lastCloudSyncTime}`;
    } else {
      subEl.textContent = 'Đang kết nối đồng bộ Google Sheet...';
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

    return {
      timerByDay,
      wordsByDay,
      streakDays,
      assessments: compactAssess,
      scopePositions: (currentUser && getScopedUid(currentUser.id) === scoped) ? scopePositions : {},
      currentScopeKey,
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
      if (assessAdded) {
        saveState();
        changed = true;
      }
    }

    if (changed && currentUser && getScopedUid(currentUser.id) === scoped) {
      updateTimerDisplay();
      updateVocabMasteryUI();
      updateStudyStreakUI();
      renderCurrentCard();
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
        if (uid) nextCache[uid] = st;
      });
      cloudClassCache = nextCache;

      if (currentUser) {
        const mine = cloudClassCache[getScopedUid(currentUser.id)];
        if (mine) mergeCloudEntryIntoLocal(currentUser.id, mine);
      }

      const now = new Date();
      lastCloudSyncTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      updateCloudSyncBadge();
      updateLeaderboardUI();
      if (document.getElementById('modal-class-report')?.classList.contains('open')) {
        renderClassReportTable();
      }
    } catch (err) {
      console.warn('Cloud pull skipped:', err);
    }
  }

  function syncPushCurrentUser(useKeepalive = false) {
    const url = getSyncUrl();
    if (!url || !currentUser) return;
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
    if (!getSyncUrl() || !currentUser) return;
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
    const topThree = ranked.slice(0, 3);
    const activeUid = getScopedUid(currentUser?.id);

    listEl.innerHTML = topThree.map(p => {
      const isMe = currentUser && getScopedUid(p.id) === activeUid;
      return `
        <div class="board-item${isMe ? ' is-me' : ''}">
          <span class="board-rank" style="font-size:12px;font-weight:800;min-width:22px;">#${p.rank}</span>
          <div class="board-info">
            <span class="board-name">${escapeHtml(p.name)}</span>
            <span class="board-meta">· ${p.periodMins}p</span>
          </div>
          <span class="board-score">${p.mastered} từ</span>
        </div>
      `;
    }).join('');

    if (userCardEl && currentUser) {
      const myEntry = ranked.find(r => getScopedUid(r.id) === activeUid);
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
        const mins = getUserPeriodMinutes(currentUser.id);
        const mastered = getUserMasteredCount(currentUser.id);
        userCardEl.innerHTML = `
          <span class="board-rank user-rank">GV</span>
          <div class="board-info" style="display:flex;align-items:baseline;gap:4px;" title="${escapeHtml(currentUser.name)} · Hôm nay: ${mins.todayMins}p">
            <span class="board-name user-name">${escapeHtml(currentUser.name)}</span>
            <span class="board-meta" style="white-space:nowrap;flex-shrink:0;">· ${mins.todayMins}p</span>
          </div>
          <span class="board-score user-score">${mastered} từ</span>
        `;
      }
    }
  }

  function recordDailyWordActivity() {
    if (!currentUser) return;
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
        items.push({ day, isToday: day === now.getDate(), ...st });
      }
      const maxScore = Math.max(10, ...items.map(x => x.score));
      const activeDays = items.filter(x => x.active).length;
      const totalMins = Math.floor(items.reduce((a, b) => a + b.secs, 0) / 60);

      chartEl.innerHTML = `
        <div class="streak-bars-row is-month">${items.map(it => {
          const pct = it.active ? Math.max(18, Math.round((it.score / maxScore) * 100)) : 0;
          const tip = `Ngày ${it.day}/${mo + 1}: ${it.mins} phút${it.words ? ` · ${it.words} từ` : ''}`;
          return `
            <div class="streak-bar-col" title="${escapeHtml(tip)}">
              <div class="streak-bar-track">
                <div class="streak-bar-fill ${it.active ? 'active' : ''} ${it.isToday ? 'today' : ''}" style="height:${pct}%;"></div>
              </div>
            </div>
          `;
        }).join('')}</div>
        <div class="streak-axis-row"><span>1</span><span>10</span><span>20</span><span>${daysInMonth}</span></div>
      `;

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
        months.push({ label: String(m + 1), idx: m, isToday: m === curMo, active: mActive > 0, activeDays: mActive, mins: Math.floor(mSecs / 60), secs: mSecs, words: mWords, score: mScore });
      }
      const maxScore = Math.max(12, ...months.map(x => x.score));
      const activeYearDays = months.reduce((a, b) => a + b.activeDays, 0);
      const totalYearMins = Math.floor(months.reduce((a, b) => a + b.secs, 0) / 60);

      chartEl.innerHTML = `<div class="streak-bars-row">${months.map(it => {
        const pct = it.active ? Math.max(18, Math.round((it.score / maxScore) * 100)) : 0;
        const tip = `Tháng ${it.label}/${yr}: ${it.activeDays} ngày · ${it.mins} phút${it.words ? ` · ${it.words} từ` : ''}`;
        return `
          <div class="streak-bar-col" title="${escapeHtml(tip)}">
            <div class="streak-bar-track">
              <div class="streak-bar-fill ${it.active ? 'active' : ''} ${it.isToday ? 'today' : ''}" style="height:${pct}%;"></div>
            </div>
            <span class="streak-bar-label ${it.isToday ? 'is-today' : ''}">${it.label}</span>
          </div>
        `;
      }).join('')}</div>`;

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
    sel.innerHTML = SCOPES.map(it =>
      `<option value="${it.key}">${escapeHtml(it.name)}</option>`
    ).join('');
    sel.value = currentScopeKey;
  }

  function applyFilterAndBuildDeck(preserveWordId = null) {
    const def = getScopeDef(currentScopeKey);
    fullScopeList = [...def.getList()];

    if (onlyUnmastered) {
      currentScopeList = fullScopeList.filter(x => assessments[x.id] !== 3);
    } else {
      currentScopeList = [...fullScopeList];
    }

    const filterBtn = document.getElementById('btn-filter-unmastered');
    if (filterBtn) filterBtn.classList.toggle('is-active', onlyUnmastered);

    const targetId = preserveWordId || scopePositions[currentScopeKey];
    if (targetId && currentScopeList.length > 0) {
      const foundIdx = currentScopeList.findIndex(x => x.id === targetId);
      currentCardIndex = foundIdx !== -1 ? foundIdx : 0;
    } else {
      currentCardIndex = 0;
    }

    updateVocabMasteryUI();
    renderCurrentCard();
  }

  function loadScope(scopeKey) {
    cancelPendingAdvance();
    currentScopeKey = getScopeDef(scopeKey).key;
    const sel = document.getElementById('study-scope-select');
    if (sel) sel.value = currentScopeKey;
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
    return Boolean(item.qa_example || item.tip_note || item.strategy);
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
    const safe = escapeHtml(sentence);
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

  function renderCurrentCard(direction = 0) {
    cancelPendingAdvance();
    const scene = document.getElementById('fc-scene');
    const card = document.getElementById('fc-card');
    const finishedBox = document.getElementById('fc-finished-box');
    const progressText = document.getElementById('study-progress-text');
    const progressBar = document.getElementById('card-progress-fill');

    if (currentScopeList.length === 0 || currentCardIndex >= currentScopeList.length) {
      if (scene) scene.style.display = 'none';
      if (finishedBox) finishedBox.style.display = 'flex';
      if (progressText) progressText.textContent = `${currentScopeList.length} / ${currentScopeList.length}`;
      if (progressBar) progressBar.style.width = '100%';
      const btnPrev = document.getElementById('btn-prev-card');
      if (btnPrev) btnPrev.disabled = (currentCardIndex <= 0);
      return;
    }

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
    document.getElementById('fc-front-word').textContent = item.lemma;
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

    document.getElementById('btn-prev-card').disabled = (currentCardIndex === 0);
    saveState();

    if (direction) window.IELTSMotion?.enterCard(direction);
  }

  function expandPlainVietnamese(text) {
    return String(text || '')
      .replace(/(?<!\()\bMatching Features\b(?!\))/gi, 'dạng nối tên người (Matching Features)')
      .replace(/\bT\/F\/NG\b/g, 'True / False / Not Given')
      .replace(/\bQ&A\b/g, 'câu hỏi & đáp án')
      .replace(/(?<!\()\bSummary\b(?!\))/gi, 'tóm tắt (Summary)')
      .replace(/\bAWL\b/g, 'từ vựng học thuật');
  }

  function formatAnswerNoteHtml(note) {
    const m = String(note || '').trim().match(/^(TRUE|FALSE|NOT GIVEN|YES|NO)\s*·\s*(.+)$/i);
    if (m) {
      return `<span class="tip-answer-badge">${escapeHtml(m[1].toUpperCase())}</span>${highlightInlineTerms(m[2])}`;
    }
    return highlightInlineTerms(note);
  }

  function openReadingTipModal(event) {
    if (event) event.stopPropagation();
    const item = currentScopeList[currentCardIndex];
    if (!item) return;

    document.getElementById('tip-modal-word').textContent = item.lemma;
    document.getElementById('tip-modal-ipa').textContent = getIPA(item);

    const qa = item.qa_example || null;
    const coreMeaning = getCleanMeaning(item);
    const posLabel = getCleanPos(item);
    const synChips = getCleanSynonyms(item);
    const antChips = getCleanAntonyms(item);
    const formChips = getCleanForms(item);

    // CỘT 1: CÂU HỎI & BÀI ĐỌC TRONG ĐỀ THẬT (Không lặp lại box chip của mặt sau)
    const leftParts = [];
    leftParts.push('<div class="tip-col-heading">1. Câu hỏi &amp; Bài đọc trong đề thật</div>');

    if (qa && qa.question && qa.passage) {
      leftParts.push(`<div class="tip-exam-title-bar">ĐỀ: ${escapeHtml(qa.exam_title || 'IELTS Reading')}</div>`);
      leftParts.push(`
        <div class="tip-qa-block">
          <div class="tip-qa-label">1. Câu hỏi trong đề</div>
          <div class="tip-qa-en">${formatSentenceHighlight(qa.question, qa.q_term || item.lemma)}</div>
          ${qa.q_vi ? `<div class="tip-qa-vi">Tạm dịch: ${escapeHtml(qa.q_vi)}</div>` : ''}
        </div>
      `);
      leftParts.push(`
        <div class="tip-qa-block passage">
          <div class="tip-qa-label">2. Câu khớp trong bài đọc</div>
          <div class="tip-qa-en">${formatSentenceHighlight(qa.passage, qa.p_term || item.lemma)}</div>
          ${qa.p_vi ? `<div class="tip-qa-vi">Tạm dịch: ${escapeHtml(qa.p_vi)}</div>` : ''}
        </div>
      `);
    } else {
      const cit = (item.exam_citations || []).find(c => c && c.sentence);
      const fallbackText = cit?.sentence || item.example || '';
      if (fallbackText) {
        leftParts.push(`
          <div class="tip-exam-title-bar">ĐỀ: ${escapeHtml(cit?.title || 'Trích đoạn IELTS Reading')}</div>
          <div class="tip-qa-block passage">
            <div class="tip-qa-label">Câu xuất hiện trong bài đọc</div>
            <div class="tip-qa-en">${formatSentenceHighlight(fallbackText, item.lemma)}</div>
          </div>
        `);
      } else {
        leftParts.push(`
          <div class="tip-qa-block">
            <div class="tip-qa-en" style="color:var(--text-muted); font-size:13.5px;">Chưa có trích đoạn câu hỏi cho từ này trong kho đề.</div>
          </div>
        `);
      }
    }

    // CỘT 2: CÁCH ĐỔI TỪ (KEYWORD TABLE) & BẪY RIÊNG CỦA TỪ NÀY
    const rightParts = [];
    rightParts.push('<div class="tip-col-heading">2. Cách đổi từ &amp; Bẫy riêng</div>');
    rightParts.push(`<div class="tip-core-line">${escapeHtml(coreMeaning)}</div>`);
    rightParts.push(`<div class="tip-sub-meta">${escapeHtml(posLabel)}</div>`);

    const qMain = (qa && qa.q_term) ? qa.q_term : item.lemma;
    const altPool = item.strategy ? splitCsvItems(item.word_forms) : (synChips.length > 0 ? synChips : formChips);
    const pPrimary = (qa && qa.p_term) ? qa.p_term : (altPool[0] || '');
    const pAlts = altPool.filter(w =>
      w.toLowerCase() !== pPrimary.toLowerCase() && w.toLowerCase() !== qMain.toLowerCase()
    ).slice(0, 3);

    if (pPrimary) {
      rightParts.push(`
        <div class="tip-kw-box">
          <div class="tip-qa-label" style="margin-bottom:0;">1. Bảng khớp từ (Keyword Table)</div>
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
      noteBullets.push(formatAnswerNoteHtml(qa.answer_note));
    }

    const rawTip = String(item.tip_note || item.strategy || '').trim();
    if (rawTip) {
      splitSentencesBalanced(rawTip).forEach(sent => {
        const cleaned = sent
          .replace(/^(?:MẸO ĐOÁN NGHĨA|Bẫy đa nghĩa|Bẫy Paraphrase|Bẫy Summary|Bẫy T\/F\/NG(?: cực hay gặp| kinh điển)?|Bẫy Q&A|Lưu ý):\s*/i, '')
          .trim();
        if (!cleaned) return;
        const formatted = highlightInlineTerms(expandPlainVietnamese(cleaned));
        if (!noteBullets.includes(formatted)) noteBullets.push(formatted);
      });
    }

    if (noteBullets.length === 0 && antChips.length > 0) {
      noteBullets.push(
        `Chú ý hướng trái nghĩa: bài đọc dùng ${antChips.slice(0, 3).map(w => `<code>${escapeHtml(w)}</code>`).join(', ')} dễ dẫn tới đáp án <code>FALSE</code> hoặc phủ định.`
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

    document.getElementById('tip-modal-body').innerHTML = `
      <div class="tip-two-cols">
        <div class="tip-col-left">${leftParts.join('')}</div>
        <div class="tip-col-right">${rightParts.join('')}</div>
      </div>
    `;
    document.getElementById('modal-reading-tip')?.classList.add('open');
  }

  function closeReadingTipModal(event) {
    if (event && event.target !== document.getElementById('modal-reading-tip')) return;
    document.getElementById('modal-reading-tip')?.classList.remove('open');
  }

  function flipCurrentCard(event) {
    if (event && event.currentTarget?.id === 'fc-scene' && event.target.closest('button')) return;
    if (currentScopeList.length === 0 || currentCardIndex >= currentScopeList.length) return;
    isCardFlipped = !isCardFlipped;
    document.getElementById('fc-card')?.classList.toggle('flipped', isCardFlipped);
    document.getElementById('btn-flip-action').textContent = isCardFlipped ? 'Mặt trước' : 'Xem nghĩa';
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

    assessments[item.id] = level;
    renderStatusTag('fc-front-status', level);
    renderStatusTag('fc-back-status', level);
    saveState();

    recordDailyWordActivity();
    saveStudyTimerState();
    updateStudyStreakUI();
    updateVocabMasteryUI();
    updateLeaderboardUI();
    scheduleCloudPush();

    isAdvancing = true;
    if (window.IELTSMotion?.enabled) {
      document.getElementById('fc-scene')?.classList.add('assess-out-' + level);
    }
    advanceTimeout = setTimeout(() => {
      if (!isAdvancing) return;
      isAdvancing = false;
      advanceTimeout = null;
      if (onlyUnmastered && level === 3) {
        currentScopeList.splice(currentCardIndex, 1);
        updateVocabMasteryUI();
        renderCurrentCard(1);
      } else {
        nextCard();
      }
    }, window.IELTSMotion?.enabled ? 240 : 0);
  }

  function toggleUnmasteredFilter() {
    onlyUnmastered = !onlyUnmastered;
    applyFilterAndBuildDeck();
    saveState();
    showToast(onlyUnmastered ? `Đang lọc ${currentScopeList.length} từ chưa thuộc` : 'Hiện tất cả từ trong bộ');
  }

  function activateUnmasteredOnly() {
    onlyUnmastered = true;
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

  function speakCurrentWord(accent = 'en-US', event) {
    if (event) event.stopPropagation();
    const item = currentScopeList[currentCardIndex];
    if (!item || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(item.lemma);
    utt.lang = accent;
    utt.rate = 0.92;
    window.speechSynthesis.speak(utt);
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
    wlStatus = status;
    ['all', 'unremembered', 'slow', 'mastered', 'signals'].forEach(s => {
      document.getElementById('wl-filter-' + s)?.classList.toggle('active', s === status);
    });
    filterWordList();
  }

  function onWordListSearch(q) {
    wlQuery = (q || '').toLowerCase().trim();
    filterWordList();
  }

  function filterWordList() {
    let list = wlStatus === 'signals' ? (APP_DATA.signal_words || []) : currentScopeList;
    if (wlStatus === 'unremembered') list = list.filter(x => assessments[x.id] === 1);
    else if (wlStatus === 'slow') list = list.filter(x => assessments[x.id] === 2);
    else if (wlStatus === 'mastered') list = list.filter(x => assessments[x.id] === 3);

    if (wlQuery) {
      list = list.filter(x =>
        (x.lemma || '').toLowerCase().includes(wlQuery) ||
        (x.clean_meaning || x.definition || '').toLowerCase().includes(wlQuery) ||
        (x.synonyms || '').toLowerCase().includes(wlQuery) ||
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
      if (lvl === 1) badge = '<span class="fc-status-tag fc-status-unremembered" style="font-size:0.7rem;padding:1px 6px;">Chưa nhớ</span>';
      else if (lvl === 2) badge = '<span class="fc-status-tag fc-status-slow" style="font-size:0.7rem;padding:1px 6px;">Nhớ chậm</span>';
      else if (lvl === 3) badge = '<span class="fc-status-tag fc-status-mastered" style="font-size:0.7rem;padding:1px 6px;">Đã thuộc</span>';

      const core = getCleanMeaning(item);
      const shortSyn = getCleanSynonyms(item).slice(0, 3).join(', ');
      const lineMeaning = shortSyn ? `${core} (${shortSyn})` : core;
      const action = wlStatus === 'signals'
        ? `studySignalAndJump('${escapeHtml(item.id)}')`
        : `jumpToWord('${escapeHtml(item.id)}')`;

      return `
        <div class="word-list-item" onclick="${action}">
          <div>
            <span class="word-list-word">${escapeHtml(item.lemma)}</span>
            <span class="word-list-meaning">${escapeHtml(lineMeaning)}</span>
          </div>
          <div>${badge}</div>
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

  function renderClassReportTable() {
    const tbody = document.getElementById('class-report-tbody');
    if (!tbody) return;
    const ranked = getClassRankedEntries('week');
    const activeUid = getScopedUid(currentUser?.id);
    tbody.innerHTML = ranked.map(item => {
      const isMe = currentUser && getScopedUid(item.id) === activeUid;
      return `
        <tr class="${isMe ? 'is-me' : ''}">
          <td>#${item.rank}</td>
          <td><strong>${escapeHtml(item.name)}</strong> <span style="font-size:11.5px; color:var(--text-muted);">(${escapeHtml(item.id)})</span></td>
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

  function toggleTheme() {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch (_) {}
    saveState();
    showToast(`Đã chuyển giao diện ${next === 'dark' ? 'Tối' : 'Sáng'}`);
  }

  function toggleFrontContext(checked) {
    showFrontContext = !!checked;
    saveState();
    renderCurrentCard();
  }

  function resetAllProgress() {
    if (!currentUser) return;
    if (!confirm(`Bạn có chắc muốn xóa toàn bộ đánh giá Chưa nhớ / Nhớ chậm / Đã thuộc của ID "${currentUser.id}"?`)) return;
    assessments = {};
    scopePositions = {};
    onlyUnmastered = false;
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
    showFrontContext = false;
    assessments = {};
    scopePositions = {};
    displayedStreak = null;
  }

  function enterAppForUser(account) {
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
    populateScopeSelect();
    applyFilterAndBuildDeck();
    loadStudyTimerState();
    startTimer();
    updateLeaderboardUI();
    updateStudyStreakUI();
    updateCloudSyncBadge();
    syncPullClassData();
    if (cloudPullTimer) clearInterval(cloudPullTimer);
    cloudPullTimer = setInterval(() => {
      if (currentUser) syncPullClassData();
    }, 30000);
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
    enterAppForUser(matched);
    showToast(`Chào ${matched.name}! Chúc bạn học tốt.`);
  }

  function logoutCurrentAccount() {
    if (cloudPullTimer) {
      clearInterval(cloudPullTimer);
      cloudPullTimer = null;
    }
    clearTimeout(cloudPushDebounce);
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
    try {
      const raw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
      if (raw) savedId = JSON.parse(raw)?.id;
    } catch (_) {}

    const matched = savedId ? findPresetAccountById(savedId) : null;
    if (matched) {
      enterAppForUser(matched);
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
    const el = document.activeElement;
    if (el && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;

    if (document.querySelector('.modal-overlay.open')) {
      if (e.key === 'Escape') {
        closeReadingTipModal();
        closeWordListModal();
        closeSignalWordsModal();
        closeClassReportModal();
        closeMenuModal();
      }
      return;
    }

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
    } else if (['1', '2', '3'].includes(e.key) && isCardFlipped) {
      assessCurrentWord(parseInt(e.key, 10));
    }
  });

  // Expose handlers to HTML onclick
  Object.assign(window, {
    onScopeChange, flipCurrentCard, nextCard, prevCard, assessCurrentWord,
    toggleUnmasteredFilter, activateUnmasteredOnly, restartScopeStudy,
    shuffleCurrentScope, speakCurrentWord, openWordListModal, closeWordListModal,
    filterWordListByStatus, onWordListSearch, loadMoreWordsInList, jumpToWord,
    studySignalAndJump, openSignalWordsModal, closeSignalWordsModal, filterSignalWordsByCategory,
    filterSignalWordsList, studySignalWordsAsDeck, openReadingTipModal, closeReadingTipModal,
    openClassReportModal, closeClassReportModal, copyMyStudyReport, copyFullClassReport,
    openMenuModal, closeMenuModal, toggleTheme, toggleFrontContext, resetAllProgress,
    toggleTimer, resetTimer, setTimerMode, setCountdownMinutes, toggleTimerSound,
    switchLeaderboardTab, switchStreakChartTab,
    handleLoginSubmit, togglePasswordVisibility, logoutCurrentAccount,
  });

  // Init cleanly on load
  restoreAuthSession();
})();
