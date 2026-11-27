/* ==========================================================================
   TOTORO IELTS MASTER — DICTATION STUDIO ENGINE (js/dictation_studio.js)
   --------------------------------------------------------------------------
   - Lazy-Load YouTube IFrame API (Facade Pattern: loads API ONLY on Play)
   - Graceful offline / blocked fallback to UK/US AudioEngine / SpeechSynthesis
   - 2 Modes:
       1. Keyword Cloze (>= 80% accuracy unlocks next sentence, letter hints)
       2. Full-Sentence Dictation (Word-level LCS diff + Vietnamese trap detector:
          missing -s/-es/-ed endings, articles a/an/the, prepositions, UK<->US)
   - Segment A-B Auto-Stop, Speed 0.75x..1.25x, Hide/Show Video Focus Mode,
     Keyboard Shortcuts (Tab / Ctrl+Space replay, Ctrl+Left -2s, Ctrl+Enter check)
   - Quick YouTube + .SRT/.VTT Importer (saves custom lessons locally + JSON copy)
   ========================================================================== */
(function () {
  'use strict';

  const PROG_KEY_BASE = 'totoro_dictation_prog_v1_';
  const CUSTOM_KEY_BASE = 'totoro_dictation_custom_v1_';
  const PASS_RATIO = 0.80;

  const UK_US_EQUIV = {
    colour: 'color', colours: 'colors', favour: 'favor', favours: 'favors',
    honour: 'honor', labour: 'labor', neighbour: 'neighbor', neighbours: 'neighbors',
    centre: 'center', centres: 'centers', metre: 'meter', metres: 'meters',
    theatre: 'theater', fibre: 'fiber', litre: 'liter',
    organise: 'organize', organised: 'organized', organising: 'organizing',
    analyse: 'analyze', analysed: 'analyzed', analysing: 'analyzing',
    realise: 'realize', realised: 'realized', recognise: 'recognize', recognised: 'recognized',
    programme: 'program', programmes: 'programs', dialogue: 'dialog',
    travelling: 'traveling', travelled: 'traveled', cancelled: 'canceled',
    defence: 'defense', licence: 'license', practise: 'practice',
    grey: 'gray', catalogue: 'catalog', jewellery: 'jewelry'
  };

  const CONTRACTIONS = {
    "don't": 'do not', "doesn't": 'does not', "didn't": 'did not',
    "can't": 'cannot', "won't": 'will not', "wouldn't": 'would not',
    "couldn't": 'could not', "shouldn't": 'should not', "isn't": 'is not',
    "aren't": 'are not', "wasn't": 'was not', "weren't": 'were not',
    "haven't": 'have not', "hasn't": 'has not', "hadn't": 'had not',
    "it's": 'it is', "that's": 'that is', "there's": 'there is',
    "i'm": 'i am', "you're": 'you are', "we're": 'we are', "they're": 'they are',
    "i've": 'i have', "we've": 'we have', "they've": 'they have',
    "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will'
  };

  const ARTICLES = new Set(['a', 'an', 'the']);
  const PREPOSITIONS = new Set([
    'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'into',
    'onto', 'over', 'under', 'about', 'through', 'during', 'before', 'after', 'along', 'beyond'
  ]);
  const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
    'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
    'do', 'does', 'did', 'will', 'would', 'can', 'could', 'should', 'that', 'this', 'these',
    'those', 'it', 'its', 'they', 'their', 'them', 'we', 'our', 'you', 'your', 'i', 'my',
    'as', 'so', 'if', 'when', 'while', 'than', 'then', 'very', 'just', 'up', 'out', 'all'
  ]);

  let ytApiPromise = null;
  let ytPlayer = null;
  let ytWatchTimer = null;
  let ytLoadedVideoId = '';
  let activeAudioEl = null;
  let kbdBound = false;

  const state = {
    view: 'hub',          // 'hub' | 'studio'
    filterLevel: 'all',   // 'all' | '5.5' | '6.5+' | '7.5+'
    filterSource: 'all',  // 'all' | 'youtube' | 'tts' | 'custom'
    query: '',
    lessonId: null,
    segIdx: 0,
    mode: 'cloze',        // 'cloze' | 'full'
    speed: 1.0,
    hideVideo: false,
    ytActivated: false,
    ytError: false,
    isPlaying: false,
    clozeValues: {},      // { blankIdx: string }
    clozeHints: {},       // { blankIdx: revealLen }
    fullInput: '',
    lastCheck: null,      // { passed, pct, details, diagnostics }
    importOpen: false
  };

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function getUid() {
    const uid = B()?.getScopedUid?.() || B()?.getCurrentUser?.()?.id || 'guest';
    return String(uid || 'guest').trim().toLowerCase();
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else B()?.showToast?.(msg);
  }
  function getRoot() { return document.getElementById('lp-dictation-root'); }

  /* ================= STORAGE ================= */
  function loadProgress() {
    try {
      const raw = localStorage.getItem(PROG_KEY_BASE + getUid());
      if (raw) return JSON.parse(raw) || {};
    } catch (_) {}
    return {};
  }
  function saveProgress(map) {
    try { localStorage.setItem(PROG_KEY_BASE + getUid(), JSON.stringify(map)); } catch (_) {}
  }
  function loadCustomLessons() {
    try {
      const raw = localStorage.getItem(CUSTOM_KEY_BASE + getUid());
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      }
    } catch (_) {}
    return [];
  }
  function saveCustomLessons(arr) {
    try { localStorage.setItem(CUSTOM_KEY_BASE + getUid(), JSON.stringify(arr.slice(0, 40))); } catch (_) {}
  }
  function getAllLessons() {
    const base = window.DICTATION_STUDIO_DATA?.LESSONS || [];
    const custom = loadCustomLessons();
    return [...custom, ...base];
  }
  function getLessonById(id) {
    return getAllLessons().find((l) => l.id === id) || null;
  }
  function getTodayDoneCount() {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const ts = todayStart.getTime();
    const prog = loadProgress();
    return Object.values(prog).filter((p) => p && p.completedAt && p.completedAt >= ts).length;
  }

  /* ================= NORMALIZATION & DIFF ================= */
  function canonWord(w) {
    const clean = String(w || '')
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/^[^a-z0-9']+|[^a-z0-9']+$/g, '');
    if (!clean) return '';
    return UK_US_EQUIV[clean] || clean;
  }

  function tokenizeForDiff(text) {
    let norm = String(text || '')
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[-–—]/g, ' ');
    Object.keys(CONTRACTIONS).forEach((k) => {
      const re = new RegExp(`\\b${k.replace("'", "\\'")}\\b`, 'g');
      norm = norm.replace(re, CONTRACTIONS[k]);
    });
    return norm
      .replace(/[^a-z0-9'\s]/g, ' ')
      .split(/\s+/)
      .map((w) => canonWord(w))
      .filter(Boolean);
  }

  function isEndingDiff(expected, got) {
    if (!expected || !got || expected === got) return false;
    const pairs = [
      [expected, got + 's'], [expected, got + 'es'], [expected, got + 'ed'], [expected, got + 'd'],
      [got, expected + 's'], [got, expected + 'es'], [got, expected + 'ed'], [got, expected + 'd'],
      [expected, got.replace(/y$/, 'ies')], [expected, got.replace(/y$/, 'ied')]
    ];
    return pairs.some(([a, b]) => a === b);
  }

  function computeFullDiff(refText, userText) {
    const ref = tokenizeForDiff(refText);
    const usr = tokenizeForDiff(userText);
    const n = ref.length;
    const m = usr.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        if (ref[i] === usr[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
        else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }

    const tokens = [];
    let i = 0, j = 0, matched = 0;
    const traps = { endings: [], articles: [], prepositions: [] };

    while (i < n || j < m) {
      if (i < n && j < m && ref[i] === usr[j]) {
        tokens.push({ status: 'ok', text: ref[i] });
        matched++;
        i++;
        j++;
      } else if (i < n && j < m && dp[i + 1][j] === dp[i][j + 1]) {
        // Substitution
        const exp = ref[i], got = usr[j];
        if (isEndingDiff(exp, got)) traps.endings.push(`${got} → ${exp}`);
        else if (ARTICLES.has(exp)) traps.articles.push(`${got} → ${exp}`);
        else if (PREPOSITIONS.has(exp)) traps.prepositions.push(`${got} → ${exp}`);
        tokens.push({ status: 'sub', expected: exp, got });
        i++;
        j++;
      } else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) {
        const exp = ref[i];
        if (ARTICLES.has(exp)) traps.articles.push(`thiếu "${exp}"`);
        else if (PREPOSITIONS.has(exp)) traps.prepositions.push(`thiếu "${exp}"`);
        tokens.push({ status: 'miss', expected: exp });
        i++;
      } else {
        tokens.push({ status: 'extra', got: usr[j] });
        j++;
      }
    }

    const pct = n > 0 ? Math.round((matched / n) * 100) : 0;
    const diagnostics = [];
    if (traps.endings.length) {
      diagnostics.push({
        kind: 'ending',
        label: 'Âm đuôi (-s / -es / -ed)',
        detail: `Cần chú ý nghe rõ đuôi từ: ${traps.endings.slice(0, 4).join(', ')}`
      });
    }
    if (traps.articles.length) {
      diagnostics.push({
        kind: 'article',
        label: 'Mạo từ (a / an / the)',
        detail: `Lỗi mạo từ thường gặp: ${traps.articles.slice(0, 4).join(', ')}`
      });
    }
    if (traps.prepositions.length) {
      diagnostics.push({
        kind: 'prep',
        label: 'Giới từ nối âm',
        detail: `Kiểm tra giới từ bị nuốt âm: ${traps.prepositions.slice(0, 4).join(', ')}`
      });
    }
    return {
      pct,
      passed: pct >= Math.round(PASS_RATIO * 100),
      matched,
      total: n,
      tokens,
      diagnostics
    };
  }

  function buildClozeParts(seg) {
    const rawText = String(seg?.text || '');
    const explicit = new Set((seg?.keywords || []).map((k) => canonWord(k)).filter(Boolean));
    const words = rawText.split(/(\s+)/);
    const blanks = [];
    const parts = [];

    // Fallback auto-pick keywords if none provided
    if (explicit.size === 0) {
      const candidates = rawText
        .replace(/[^a-zA-Z0-9'\s]/g, ' ')
        .split(/\s+/)
        .map((w) => canonWord(w))
        .filter((w) => w.length >= 5 && !STOP_WORDS.has(w));
      candidates.slice(0, 4).forEach((w) => explicit.add(w));
    }

    const used = new Set();
    words.forEach((chunk) => {
      if (!chunk || /^\s+$/.test(chunk)) {
        parts.push({ type: 'text', text: chunk });
        return;
      }
      const m = chunk.match(/^([^a-zA-Z0-9']*)([a-zA-Z0-9'-]+)([^a-zA-Z0-9']*)$/);
      if (m) {
        const [, pre, core, post] = m;
        const cw = canonWord(core);
        if (cw && explicit.has(cw) && !used.has(cw)) {
          used.add(cw);
          const idx = blanks.length;
          blanks.push({ idx, answer: core, canon: cw });
          if (pre) parts.push({ type: 'text', text: pre });
          parts.push({ type: 'blank', idx, answer: core, canon: cw });
          if (post) parts.push({ type: 'text', text: post });
          return;
        }
      }
      parts.push({ type: 'text', text: chunk });
    });

    return { parts, blanks };
  }

  /* ================= LAZY-LOAD YOUTUBE & AUDIO ENGINE ================= */
  function loadYouTubeApiOnce() {
    if (window.YT && typeof window.YT.Player === 'function') {
      return Promise.resolve(window.YT);
    }
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve, reject) => {
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prevCb === 'function') {
          try { prevCb(); } catch (_) {}
        }
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => reject(new Error('Không thể tải YouTube API'));
      document.head.appendChild(tag);
      setTimeout(() => {
        if (!window.YT || typeof window.YT.Player !== 'function') {
          reject(new Error('YouTube API timeout'));
        }
      }, 9000);
    });
    return ytApiPromise;
  }

  function clearSegmentWatch() {
    if (ytWatchTimer) {
      clearInterval(ytWatchTimer);
      ytWatchTimer = null;
    }
  }

  function pausePlayback() {
    clearSegmentWatch();
    state.isPlaying = false;
    try { window.speechSynthesis?.cancel?.(); } catch (_) {}
    if (activeAudioEl) {
      try { activeAudioEl.pause(); } catch (_) {}
    }
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
      try { ytPlayer.pauseVideo(); } catch (_) {}
    }
    updatePlayBtnUI();
  }

  function destroyYouTubePlayer() {
    clearSegmentWatch();
    if (ytPlayer && typeof ytPlayer.destroy === 'function') {
      try { ytPlayer.destroy(); } catch (_) {}
    }
    ytPlayer = null;
    ytLoadedVideoId = '';
    state.ytActivated = false;
    state.ytError = false;
  }

  function updatePlayBtnUI() {
    const btn = document.getElementById('dict-btn-play');
    if (!btn) return;
    btn.classList.toggle('is-playing', state.isPlaying);
    const lbl = btn.querySelector('.dict-play-lbl');
    if (lbl) lbl.textContent = state.isPlaying ? 'Đang phát...' : 'Nghe đoạn này';
  }

  function speakSegmentFallback(seg, lesson) {
    pausePlayback();
    const txt = String(seg?.text || '').trim();
    if (!txt) return;
    if (typeof window.speechSynthesis === 'undefined') {
      toast('Trình duyệt không hỗ trợ đọc âm thanh dự phòng.');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = lesson?.accent === 'US' ? 'en-US' : 'en-GB';
      u.rate = Math.max(0.65, Math.min(1.4, Number(state.speed) || 1.0));
      state.isPlaying = true;
      updatePlayBtnUI();
      u.onend = () => { state.isPlaying = false; updatePlayBtnUI(); };
      u.onerror = () => { state.isPlaying = false; updatePlayBtnUI(); };
      window.speechSynthesis.speak(u);
    } catch (_) {
      state.isPlaying = false;
      updatePlayBtnUI();
    }
  }

  async function playCurrentSegment(rewindSec = 0) {
    const lesson = getLessonById(state.lessonId);
    if (!lesson) return;
    const seg = lesson.segments?.[state.segIdx];
    if (!seg) return;

    // 1. TTS / offline lesson OR YouTube blocked fallback
    if (lesson.sourceType === 'tts' || (lesson.sourceType === 'youtube' && state.ytError)) {
      speakSegmentFallback(seg, lesson);
      return;
    }

    // 2. Local Audio file
    if (lesson.sourceType === 'audio' && lesson.audioUrl) {
      pausePlayback();
      if (!activeAudioEl || activeAudioEl.dataset.src !== lesson.audioUrl) {
        activeAudioEl = new Audio(lesson.audioUrl);
        activeAudioEl.dataset.src = lesson.audioUrl;
      }
      const startAt = Math.max(0, (Number(seg.start) || 0) - rewindSec);
      const endAt = Number(seg.end) || (startAt + 8);
      activeAudioEl.playbackRate = state.speed;
      activeAudioEl.currentTime = startAt;
      state.isPlaying = true;
      updatePlayBtnUI();
      activeAudioEl.play().catch(() => speakSegmentFallback(seg, lesson));
      clearSegmentWatch();
      ytWatchTimer = setInterval(() => {
        if (!activeAudioEl || activeAudioEl.paused) {
          clearSegmentWatch();
          state.isPlaying = false;
          updatePlayBtnUI();
          return;
        }
        if (activeAudioEl.currentTime >= endAt) {
          activeAudioEl.pause();
          clearSegmentWatch();
          state.isPlaying = false;
          updatePlayBtnUI();
        }
      }, 100);
      return;
    }

    // 3. Lazy-Load YouTube Player
    if (lesson.sourceType === 'youtube' && lesson.videoId) {
      const mount = document.getElementById('dict-yt-mount');
      if (!mount) return;
      const playSegmentOnYT = () => {
        if (!ytPlayer || typeof ytPlayer.seekTo !== 'function') return;
        const startAt = Math.max(0, (Number(seg.start) || 0) - rewindSec);
        const endAt = Number(seg.end) || (startAt + 8);
        try {
          ytPlayer.setPlaybackRate(state.speed);
          ytPlayer.seekTo(startAt, true);
          ytPlayer.playVideo();
          state.isPlaying = true;
          updatePlayBtnUI();
          clearSegmentWatch();
          ytWatchTimer = setInterval(() => {
            if (!ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
              clearSegmentWatch();
              return;
            }
            const cur = ytPlayer.getCurrentTime();
            if (cur >= endAt) {
              ytPlayer.pauseVideo();
              clearSegmentWatch();
              state.isPlaying = false;
              updatePlayBtnUI();
            }
          }, 120);
        } catch (_) {
          speakSegmentFallback(seg, lesson);
        }
      };

      if (ytPlayer && ytLoadedVideoId === lesson.videoId) {
        playSegmentOnYT();
        return;
      }

      // First click: replace facade thumbnail with YouTube iframe host & load API lazily
      state.ytActivated = true;
      mount.innerHTML = `<div id="dict-yt-iframe-host" style="width:100%;height:100%;"></div>`;
      try {
        const YT = await loadYouTubeApiOnce();
        ytLoadedVideoId = lesson.videoId;
        ytPlayer = new YT.Player('dict-yt-iframe-host', {
          videoId: lesson.videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            cc_load_policy: 0,
            start: Math.floor(Number(seg.start) || 0)
          },
          events: {
            onReady: () => playSegmentOnYT(),
            onError: () => {
              state.ytError = true;
              toast('Video YouTube tạm không phát được — tự chuyển sang giọng đọc dự phòng!');
              render();
              speakSegmentFallback(seg, lesson);
            }
          }
        });
      } catch (_) {
        state.ytError = true;
        toast('Không nạp được YouTube (mạng chặn/offline) — chuyển sang giọng đọc dự phòng!');
        render();
        speakSegmentFallback(seg, lesson);
      }
    }
  }

  /* ================= LESSON ACTIONS ================= */
  function openLesson(lessonId) {
    const lesson = getLessonById(lessonId);
    if (!lesson) return;
    destroyYouTubePlayer();
    pausePlayback();
    state.view = 'studio';
    state.lessonId = lesson.id;
    const prog = loadProgress()[lesson.id] || { passedIdxs: [] };
    const nextIdx = lesson.segments.findIndex((_, i) => !(prog.passedIdxs || []).includes(i));
    state.segIdx = nextIdx >= 0 ? nextIdx : 0;
    state.clozeValues = {};
    state.clozeHints = {};
    state.fullInput = '';
    state.lastCheck = null;
    render();
  }

  function backToHub() {
    destroyYouTubePlayer();
    pausePlayback();
    state.view = 'hub';
    state.lessonId = null;
    render();
  }

  function selectSegment(idx) {
    const lesson = getLessonById(state.lessonId);
    if (!lesson || !lesson.segments?.[idx]) return;
    pausePlayback();
    state.segIdx = idx;
    state.clozeValues = {};
    state.clozeHints = {};
    state.fullInput = '';
    state.lastCheck = null;
    render();
  }

  function setMode(mode) {
    state.mode = mode === 'full' ? 'full' : 'cloze';
    state.lastCheck = null;
    render();
  }

  function setSpeed(spd) {
    state.speed = Number(spd) || 1.0;
    if (ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
      try { ytPlayer.setPlaybackRate(state.speed); } catch (_) {}
    }
    if (activeAudioEl) activeAudioEl.playbackRate = state.speed;
    document.querySelectorAll('.dict-spd-btn').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.spd) === state.speed);
    });
  }

  function toggleHideVideo() {
    state.hideVideo = !state.hideVideo;
    const wrap = document.getElementById('dict-media-stage');
    if (wrap) wrap.classList.toggle('is-video-hidden', state.hideVideo);
    const btn = document.getElementById('dict-btn-hide-vid');
    if (btn) btn.textContent = state.hideVideo ? 'Hiện Video' : 'Ẩn Video (Chỉ nghe)';
  }

  function onClozeInput(blankIdx, val) {
    state.clozeValues[blankIdx] = val;
  }

  function onFullInput(val) {
    state.fullInput = val;
  }

  function giveHint() {
    const lesson = getLessonById(state.lessonId);
    const seg = lesson?.segments?.[state.segIdx];
    if (!seg) return;
    if (state.mode === 'cloze') {
      const { blanks } = buildClozeParts(seg);
      const target = blanks.find((b) => canonWord(state.clozeValues[b.idx]) !== b.canon) || blanks[0];
      if (!target) return;
      const curRev = Math.min(target.answer.length, (state.clozeHints[target.idx] || 0) + 2);
      state.clozeHints[target.idx] = curRev;
      state.clozeValues[target.idx] = target.answer.slice(0, curRev);
      render();
      const inp = document.getElementById(`dict-blank-${target.idx}`);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    } else {
      const refWords = String(seg.text || '').split(/\s+/);
      const typedCount = String(state.fullInput || '').trim() ? String(state.fullInput).trim().split(/\s+/).length : 0;
      const nextW = refWords[Math.min(refWords.length - 1, typedCount)];
      if (nextW) {
        state.fullInput = (state.fullInput ? state.fullInput.trim() + ' ' : '') + nextW;
        render();
        const ta = document.getElementById('dict-full-textarea');
        if (ta) ta.focus();
      }
    }
  }

  function markSegmentPassed(lesson, segIdx) {
    const map = loadProgress();
    const prev = map[lesson.id] || { passedIdxs: [], completedAt: 0 };
    const set = new Set(prev.passedIdxs || []);
    set.add(segIdx);
    const passedIdxs = Array.from(set).sort((a, b) => a - b);
    const allDone = passedIdxs.length >= (lesson.segments?.length || 1);
    const newlyCompleted = allDone && !prev.completedAt;
    map[lesson.id] = {
      passedIdxs,
      updatedAt: Date.now(),
      completedAt: allDone ? (prev.completedAt || Date.now()) : 0
    };
    saveProgress(map);
    if (newlyCompleted) {
      window.TotoroUI?.recordDailyActivity?.({ dictation: 1 });
      toast(`Hoàn thành trọn bài Dictation "${lesson.title}"!`);
    }
  }

  function checkCurrent() {
    const lesson = getLessonById(state.lessonId);
    const seg = lesson?.segments?.[state.segIdx];
    if (!lesson || !seg) return;

    if (state.mode === 'cloze') {
      const { blanks } = buildClozeParts(seg);
      let okCount = 0;
      const blankResults = {};
      blanks.forEach((b) => {
        const val = canonWord(state.clozeValues[b.idx]);
        const ok = val === b.canon;
        if (ok) okCount++;
        blankResults[b.idx] = { ok, expected: b.answer, got: state.clozeValues[b.idx] || '' };
      });
      const pct = blanks.length > 0 ? Math.round((okCount / blanks.length) * 100) : 100;
      const passed = pct >= Math.round(PASS_RATIO * 100);
      state.lastCheck = { mode: 'cloze', pct, passed, okCount, total: blanks.length, blankResults };
      if (passed) markSegmentPassed(lesson, state.segIdx);
    } else {
      const diff = computeFullDiff(seg.text, state.fullInput);
      state.lastCheck = { mode: 'full', ...diff };
      if (diff.passed) markSegmentPassed(lesson, state.segIdx);
    }
    render();
  }

  function nextSegment() {
    const lesson = getLessonById(state.lessonId);
    if (!lesson) return;
    if (state.segIdx + 1 < lesson.segments.length) {
      selectSegment(state.segIdx + 1);
    } else {
      toast('Bạn đã đi hết tất cả câu trong bài này!');
    }
  }

  function saveWordToNotebook(word) {
    const clean = String(word || '').replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '');
    if (!clean) return;
    if (window.MyVocabStore && typeof window.MyVocabStore.addWord === 'function') {
      window.MyVocabStore.addWord({ word: clean, source: 'Dictation Studio' });
      toast(`Đã lưu "${clean}" vào Sổ từ vựng!`);
    } else {
      toast(`Đã ghi chú từ "${clean}" (nhấn để ôn sau).`);
    }
  }

  /* ================= SRT / VTT + YOUTUBE QUICK IMPORTER ================= */
  function extractYouTubeId(input) {
    const s = String(input || '').trim();
    if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;
    const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
    return m ? m[1] : '';
  }

  function parseTimestampSec(ts) {
    const clean = String(ts || '').trim().replace(',', '.');
    const parts = clean.split(':').map(Number);
    if (parts.length === 3) return +(parts[0] * 3600 + parts[1] * 60 + parts[2]).toFixed(2);
    if (parts.length === 2) return +(parts[0] * 60 + parts[1]).toFixed(2);
    return Number(clean) || 0;
  }

  function parseSrtOrPlain(raw) {
    const text = String(raw || '').replace(/\r\n/g, '\n').trim();
    if (!text) return [];
    // Try SRT / VTT timestamp blocks first
    const blocks = text.split(/\n{2,}/);
    const segs = [];
    blocks.forEach((blk) => {
      const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean);
      const timeIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeIdx >= 0) {
        const [sStr, eStr] = lines[timeIdx].split('-->');
        const body = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
        if (body) {
          segs.push({
            idx: segs.length + 1,
            start: parseTimestampSec(sStr),
            end: parseTimestampSec(eStr),
            text: body,
            vi: '',
            keywords: []
          });
        }
      }
    });
    if (segs.length) return segs;

    // Fallback: 1 line = 1 sentence (6s interval)
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => ({
      idx: i + 1,
      start: i * 6,
      end: (i + 1) * 6,
      text: line,
      vi: '',
      keywords: []
    }));
  }

  function toggleImporter(open) {
    state.importOpen = typeof open === 'boolean' ? open : !state.importOpen;
    render();
  }

  function saveImportedLesson(ev) {
    if (ev && ev.preventDefault) ev.preventDefault();
    const title = (document.getElementById('dict-imp-title')?.value || '').trim();
    const ytRaw = (document.getElementById('dict-imp-yt')?.value || '').trim();
    const level = document.getElementById('dict-imp-level')?.value || '6.5+';
    const topic = (document.getElementById('dict-imp-topic')?.value || '').trim() || 'Tự thêm';
    const rawSub = (document.getElementById('dict-imp-srt')?.value || '').trim();
    const segments = parseSrtOrPlain(rawSub);

    if (!title || segments.length === 0) {
      toast('Hãy nhập tiêu đề bài và ít nhất 1 câu transcript (hoặc phụ đề .srt/.vtt).');
      return;
    }
    const videoId = extractYouTubeId(ytRaw);
    const lesson = {
      id: `dict-custom-${Date.now()}`,
      title,
      topic,
      level,
      accent: 'US',
      duration: `${segments.length} câu`,
      sourceType: videoId ? 'youtube' : 'tts',
      videoId: videoId || '',
      isCustom: true,
      desc: videoId
        ? `Bài YouTube tự nhập (${segments.length} câu).`
        : `Bài tự nhập không kèm YouTube (${segments.length} câu, đọc bằng giọng chuẩn).`,
      segments
    };
    const list = loadCustomLessons();
    list.unshift(lesson);
    saveCustomLessons(list);
    state.importOpen = false;
    toast(`Đã tạo bài Dictation "${title}" (${segments.length} câu)!`);
    openLesson(lesson.id);
  }

  function copyImportedJson() {
    const title = (document.getElementById('dict-imp-title')?.value || 'Untitled Lesson').trim();
    const ytRaw = (document.getElementById('dict-imp-yt')?.value || '').trim();
    const level = document.getElementById('dict-imp-level')?.value || '6.5+';
    const topic = (document.getElementById('dict-imp-topic')?.value || 'Custom').trim();
    const segments = parseSrtOrPlain(document.getElementById('dict-imp-srt')?.value || '');
    const videoId = extractYouTubeId(ytRaw);
    const obj = {
      id: `dict-yt-${Date.now()}`,
      title, topic, level, accent: 'US', duration: `${segments.length} câu`,
      sourceType: videoId ? 'youtube' : 'tts',
      videoId,
      desc: '',
      segments
    };
    navigator.clipboard?.writeText(JSON.stringify(obj, null, 2))
      .then(() => toast('Đã chép JSON chuẩn để dán vào data/dictation_data.js!'))
      .catch(() => toast('Không chép được tự động — hãy lưu trực tiếp bài vào trình duyệt.'));
  }

  function deleteCustomLesson(id, ev) {
    if (ev) ev.stopPropagation();
    const next = loadCustomLessons().filter((l) => l.id !== id);
    saveCustomLessons(next);
    toast('Đã xóa bài tự thêm.');
    render();
  }

  /* ================= KEYBOARD SHORTCUTS ================= */
  function bindShortcutsOnce() {
    if (kbdBound) return;
    kbdBound = true;
    document.addEventListener('keydown', (e) => {
      const root = getRoot();
      if (!root || root.style.display === 'none' || state.view !== 'studio' || state.importOpen) return;
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
        // Tab inside Dictation Studio replays current audio cleanly
        if (document.activeElement && root.contains(document.activeElement)) {
          e.preventDefault();
          playCurrentSegment(0);
        }
      } else if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        playCurrentSegment(0);
      } else if (e.ctrlKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        playCurrentSegment(2);
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (state.lastCheck?.passed) nextSegment();
        else checkCurrent();
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        giveHint();
      }
    });
  }

  /* ================= RENDER HUB ================= */
  function renderHubHtml() {
    const all = getAllLessons();
    const prog = loadProgress();
    const q = state.query.trim().toLowerCase();
    const filtered = all.filter((l) => {
      if (state.filterLevel !== 'all' && l.level !== state.filterLevel) return false;
      if (state.filterSource === 'youtube' && l.sourceType !== 'youtube') return false;
      if (state.filterSource === 'tts' && l.sourceType === 'youtube') return false;
      if (state.filterSource === 'custom' && !l.isCustom) return false;
      if (q && !(l.title + ' ' + l.topic + ' ' + (l.desc || '')).toLowerCase().includes(q)) return false;
      return true;
    });

    const totalDoneLessons = all.filter((l) => (prog[l.id]?.passedIdxs?.length || 0) >= (l.segments?.length || 1)).length;

    const cardsHtml = filtered.length
      ? filtered.map((l) => {
          const passed = prog[l.id]?.passedIdxs?.length || 0;
          const total = l.segments?.length || 1;
          const pct = Math.round((passed / total) * 100);
          const isYT = l.sourceType === 'youtube' && l.videoId;
          const thumbHtml = isYT
            ? `<div class="dict-card-thumb is-yt">
                 <img src="https://i.ytimg.com/vi/${esc(l.videoId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
                 <span class="dict-thumb-badge">YouTube · Lazy</span>
                 <span class="dict-thumb-play" aria-hidden="true">▶</span>
               </div>`
            : `<div class="dict-card-thumb is-audio">
                 <div class="dict-audio-art">
                   <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                   <span>IELTS Audio · ${esc(l.accent || 'UK')}</span>
                 </div>
                 <span class="dict-thumb-badge">${l.isCustom ? 'Tự thêm' : 'Offline Ready'}</span>
               </div>`;
          return `
            <article class="dict-card" onclick="window.DictationStudio.openLesson('${esc(l.id)}')">
              ${thumbHtml}
              <div class="dict-card-body">
                <div class="dict-card-meta">
                  <span class="dict-pill is-lvl">Band ${esc(l.level || '6.5+')}</span>
                  <span class="dict-pill">${esc(l.topic || 'General')}</span>
                  <span class="dict-pill tabular">${total} câu</span>
                  ${l.isCustom ? `<button type="button" class="dict-del-btn" title="Xóa bài tự thêm" onclick="window.DictationStudio.deleteCustomLesson('${esc(l.id)}', event)">✕</button>` : ''}
                </div>
                <h3 class="dict-card-title">${esc(l.title)}</h3>
                <p class="dict-card-desc">${esc(l.desc || '')}</p>
                <div class="dict-card-foot">
                  <div class="dict-prog-wrap">
                    <div class="dict-prog-bar"><span style="width:${pct}%"></span></div>
                    <span class="dict-prog-txt tabular">${passed}/${total} câu</span>
                  </div>
                  <span class="dict-open-cta">${passed > 0 ? 'Học tiếp →' : 'Bắt đầu →'}</span>
                </div>
              </div>
            </article>
          `;
        }).join('')
      : `<div class="dict-empty">Không tìm thấy bài phù hợp. Thử đổi bộ lọc hoặc bấm <strong>+ Nhập bài YouTube / SRT</strong> để thêm bài mới.</div>`;

    const importModalHtml = state.importOpen ? `
      <div class="dict-modal-backdrop" onclick="window.DictationStudio.toggleImporter(false)">
        <div class="dict-modal" onclick="event.stopPropagation()">
          <div class="dict-modal-head">
            <div>
              <h3>Nhập nhanh bài Dictation (YouTube + SRT / VTT)</h3>
              <p>Dán link YouTube + phụ đề .srt/.vtt (hoặc mỗi dòng 1 câu) để tạo bài luyện chép chính tả ngay lập tức.</p>
            </div>
            <button type="button" class="dict-icon-btn" onclick="window.DictationStudio.toggleImporter(false)" aria-label="Đóng">✕</button>
          </div>
          <form class="dict-imp-form" onsubmit="window.DictationStudio.saveImportedLesson(event)">
            <div class="dict-imp-grid">
              <label><span>Tiêu đề bài *</span><input id="dict-imp-title" type="text" required placeholder="VD: TED-Ed · How Coffee Affects the Brain"></label>
              <label><span>Link YouTube hoặc Video ID (tùy chọn)</span><input id="dict-imp-yt" type="text" placeholder="https://youtube.com/watch?v=... (để trống = đọc giọng UK/US)"></label>
              <label><span>Chủ đề</span><input id="dict-imp-topic" type="text" placeholder="VD: Science, Environment, Part 4..."></label>
              <label><span>Trình độ</span>
                <select id="dict-imp-level">
                  <option value="5.5">Band 5.5</option>
                  <option value="6.5+" selected>Band 6.5+</option>
                  <option value="7.5+">Band 7.5+</option>
                </select>
              </label>
            </div>
            <label class="dict-imp-ta-wrap">
              <span>Phụ đề (.srt / .vtt có mốc thời gian) hoặc dán mỗi dòng 1 câu *</span>
              <textarea id="dict-imp-srt" rows="7" required placeholder="1&#10;00:00:10,000 --> 00:00:16,500&#10;Researchers found that deep sleep strengthens memory.&#10;&#10;2&#10;00:00:16,500 --> 00:00:22,000&#10;Consistent study habits improve long-term recall."></textarea>
            </label>
            <div class="dict-imp-acts">
              <button type="button" class="tot-demo-btn" onclick="window.DictationStudio.copyImportedJson()">Chép JSON (cho dictation_data.js)</button>
              <button type="submit" class="btn btn-primary tot-demo-btn">Lưu &amp; Luyện ngay →</button>
            </div>
          </form>
        </div>
      </div>
    ` : '';

    return `
      <div class="dict-shell">
        <div class="dict-hub-head ink-brackets">
          <div class="dict-hub-head-l">
            <span class="dict-eyebrow">DICTATION STUDIO · 2 CHẾ ĐỘ &amp; LAZY YOUTUBE</span>
            <h2 class="dict-hub-title">Nghe chép chính tả chuẩn âm đuôi &amp; nối âm</h2>
            <p class="dict-hub-sub">Video YouTube chỉ tải khi bạn bấm phát · Hỗ trợ Điền từ khóa (≥80%) và Chép nguyên câu bắt lỗi <code>-s/-es/-ed</code>, mạo từ, giới từ.</p>
          </div>
          <div class="dict-hub-head-r">
            <div class="dict-stat-pill tabular"><strong>${totalDoneLessons}/${all.length}</strong> bài xong</div>
            <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.DictationStudio.toggleImporter(true)">+ Nhập bài YouTube / SRT</button>
          </div>
        </div>

        <div class="dict-filter-bar">
          <div class="dict-filter-chips">
            ${['all', '5.5', '6.5+', '7.5+'].map((lv) => `
              <button type="button" class="dict-chip ${state.filterLevel === lv ? 'active' : ''}" onclick="window.DictationStudio.setFilterLevel('${lv}')">${lv === 'all' ? 'Mọi Band' : 'Band ' + lv}</button>
            `).join('')}
          </div>
          <div class="dict-filter-chips">
            ${[
              ['all', 'Tất cả nguồn'],
              ['youtube', 'Video YouTube'],
              ['tts', 'IELTS Audio'],
              ['custom', 'Bài tự thêm']
            ].map(([k, lbl]) => `
              <button type="button" class="dict-chip ${state.filterSource === k ? 'active' : ''}" onclick="window.DictationStudio.setFilterSource('${k}')">${lbl}</button>
            `).join('')}
          </div>
          <input type="search" class="dict-search" value="${esc(state.query)}" placeholder="Tìm tiêu đề, chủ đề..." oninput="window.DictationStudio.setQuery(this.value)">
        </div>

        <div class="dict-grid">${cardsHtml}</div>
        ${importModalHtml}
      </div>
    `;
  }

  /* ================= RENDER STUDIO ================= */
  function renderStudioHtml() {
    const lesson = getLessonById(state.lessonId);
    if (!lesson) return renderHubHtml();
    const segs = lesson.segments || [];
    const seg = segs[state.segIdx] || segs[0];
    const prog = loadProgress()[lesson.id] || { passedIdxs: [] };
    const passedSet = new Set(prog.passedIdxs || []);
    const isYT = lesson.sourceType === 'youtube' && lesson.videoId && !state.ytError;

    const mediaStageHtml = isYT
      ? `<div class="dict-media-stage ${state.hideVideo ? 'is-video-hidden' : ''}" id="dict-media-stage">
           <div class="dict-yt-mount" id="dict-yt-mount">
             ${state.ytActivated
               ? `<div id="dict-yt-iframe-host" style="width:100%;height:100%;"></div>`
               : `<button type="button" class="dict-yt-facade" onclick="window.DictationStudio.playCurrentSegment(0)">
                    <img src="https://i.ytimg.com/vi/${esc(lesson.videoId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
                    <span class="dict-yt-play-circle" aria-hidden="true">▶</span>
                    <span class="dict-yt-facade-lbl">Bấm để tải &amp; phát đoạn ${state.segIdx + 1} (${Number(seg.start).toFixed(1)}s – ${Number(seg.end).toFixed(1)}s)</span>
                  </button>`
             }
           </div>
           <div class="dict-video-veil" aria-hidden="true">
             <span>🎧 Chế độ chỉ nghe âm thanh (đã ẩn hình &amp; phụ đề)</span>
           </div>
         </div>`
      : `<div class="dict-media-stage is-audio-mode" id="dict-media-stage">
           <div class="dict-audio-stage-box">
             <div class="dict-wave-bars ${state.isPlaying ? 'is-anim' : ''}" aria-hidden="true">
               <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
             </div>
             <div class="dict-audio-stage-title">${esc(lesson.title)}</div>
             <div class="dict-audio-stage-sub">Câu ${state.segIdx + 1}/${segs.length} · Giọng ${esc(lesson.accent || 'UK')} · Tốc độ ${state.speed}x</div>
           </div>
         </div>`;

    const segNavHtml = segs.map((_, i) => {
      const cls = [
        'dict-seg-dot',
        i === state.segIdx ? 'is-cur' : '',
        passedSet.has(i) ? 'is-done' : ''
      ].join(' ');
      return `<button type="button" class="${cls}" onclick="window.DictationStudio.selectSegment(${i})">${passedSet.has(i) ? '✓' : (i + 1)}</button>`;
    }).join('');

    let exerciseHtml = '';
    if (state.mode === 'cloze') {
      const { parts, blanks } = buildClozeParts(seg);
      const sentHtml = parts.map((p) => {
        if (p.type === 'text') return esc(p.text);
        const val = state.clozeValues[p.idx] || '';
        const res = state.lastCheck?.mode === 'cloze' ? state.lastCheck.blankResults?.[p.idx] : null;
        const stCls = res ? (res.ok ? 'is-ok' : 'is-bad') : '';
        const widthCh = Math.max(7, Math.min(20, p.answer.length + 2));
        return `<span class="dict-blank-wrap">
          <input type="text" id="dict-blank-${p.idx}" class="dict-blank-inp ${stCls}" style="width:${widthCh}ch"
            value="${esc(val)}" placeholder="${'•'.repeat(Math.min(8, p.answer.length))}"
            autocomplete="off" spellcheck="false"
            oninput="window.DictationStudio.onClozeInput(${p.idx}, this.value)">
          ${res && !res.ok ? `<span class="dict-blank-fix">${esc(res.expected)}</span>` : ''}
        </span>`;
      }).join('');
      exerciseHtml = `
        <div class="dict-mode-hint">Điền <strong>${blanks.length} từ khóa</strong> còn thiếu — đạt <strong>≥ 80%</strong> để qua câu. Bấm <code>Alt + H</code> để gợi ý 2 ký tự.</div>
        <div class="dict-sent-box">${sentHtml}</div>
      `;
    } else {
      exerciseHtml = `
        <div class="dict-mode-hint">Nghe và gõ lại <strong>nguyên câu</strong>. Hệ thống tự chuẩn hóa UK↔US, viết tắt, và soi riêng lỗi <em>âm đuôi -s/-ed, mạo từ, giới từ</em>.</div>
        <textarea id="dict-full-textarea" class="dict-full-ta" rows="4" spellcheck="false"
          placeholder="Gõ chính xác câu bạn vừa nghe... (Tab: nghe lại · Ctrl+Enter: chấm điểm)"
          oninput="window.DictationStudio.onFullInput(this.value)">${esc(state.fullInput)}</textarea>
      `;
    }

    let feedbackHtml = '';
    if (state.lastCheck) {
      const c = state.lastCheck;
      const diffStrip = c.mode === 'full' && Array.isArray(c.tokens)
        ? `<div class="dict-diff-strip">${c.tokens.map((t) => {
            if (t.status === 'ok') return `<span class="dict-tok is-ok">${esc(t.text)}</span>`;
            if (t.status === 'miss') return `<span class="dict-tok is-miss" title="Từ bị thiếu">+ ${esc(t.expected)}</span>`;
            if (t.status === 'sub') return `<span class="dict-tok is-sub"><del>${esc(t.got)}</del> → <strong>${esc(t.expected)}</strong></span>`;
            return `<span class="dict-tok is-extra" title="Từ dư"><del>${esc(t.got)}</del></span>`;
          }).join(' ')}</div>`
        : '';

      const diagHtml = (c.diagnostics || []).length
        ? `<div class="dict-diag-list">${c.diagnostics.map((d) => `
            <div class="dict-diag-item">
              <span class="dict-diag-tag">${esc(d.label)}</span>
              <span>${esc(d.detail)}</span>
            </div>
          `).join('')}</div>`
        : '';

      const saveWords = (seg.keywords && seg.keywords.length ? seg.keywords : String(seg.text || '').split(/\s+/).filter((w) => w.length >= 6).slice(0, 4));
      const wordPills = saveWords.map((w) => {
        const clean = w.replace(/[^a-zA-Z-]/g, '');
        return clean ? `<button type="button" class="dict-save-word" onclick="window.DictationStudio.saveWordToNotebook('${esc(clean)}')">+ ${esc(clean)}</button>` : '';
      }).join('');

      feedbackHtml = `
        <div class="dict-feedback ${c.passed ? 'is-pass' : 'is-retry'}">
          <div class="dict-fb-head">
            <strong class="dict-fb-score tabular">${c.passed ? '✓ Đạt chuẩn' : '✕ Chưa đạt 80%'} · ${c.pct}%</strong>
            ${c.passed && state.segIdx + 1 < segs.length
              ? `<button type="button" class="btn btn-primary tot-demo-btn" style="height:32px;padding:0 12px;font-size:12.5px;" onclick="window.DictationStudio.nextSegment()">Câu tiếp theo →</button>`
              : ''}
          </div>
          ${diffStrip}
          ${diagHtml}
          <div class="dict-ref-reveal">
            <div class="dict-ref-en">${esc(seg.text)}</div>
            ${seg.vi ? `<div class="dict-ref-vi">${esc(seg.vi)}</div>` : ''}
            ${wordPills ? `<div class="dict-save-row"><span>Lưu từ vào sổ:</span> ${wordPills}</div>` : ''}
          </div>
        </div>
      `;
    }

    return `
      <div class="dict-shell dict-studio-wrap">
        <div class="dict-studio-topbar">
          <button type="button" class="tot-demo-btn" style="height:34px;padding:0 12px;" onclick="window.DictationStudio.backToHub()">← Danh sách bài</button>
          <div class="dict-studio-title-wrap">
            <h2 class="dict-studio-title">${esc(lesson.title)}</h2>
            <span class="dict-pill is-lvl">Band ${esc(lesson.level)}</span>
            <span class="dict-pill">${esc(lesson.topic)}</span>
          </div>
          <div class="dict-mode-seg" role="tablist" aria-label="Chế độ chép chính tả">
            <button type="button" class="dict-mode-btn ${state.mode === 'cloze' ? 'active' : ''}" onclick="window.DictationStudio.setMode('cloze')">1. Điền từ khóa</button>
            <button type="button" class="dict-mode-btn ${state.mode === 'full' ? 'active' : ''}" onclick="window.DictationStudio.setMode('full')">2. Chép nguyên câu</button>
          </div>
        </div>

        <div class="dict-studio-grid">
          <div class="dict-left-col">
            ${mediaStageHtml}
            <div class="dict-controls-card">
              <div class="dict-ctrl-row">
                <button type="button" id="dict-btn-play" class="btn btn-primary dict-play-btn ${state.isPlaying ? 'is-playing' : ''}" onclick="window.DictationStudio.playCurrentSegment(0)">
                  <span>▶</span> <span class="dict-play-lbl">${state.isPlaying ? 'Đang phát...' : 'Nghe đoạn này'}</span>
                </button>
                <button type="button" class="dict-ctrl-btn" onclick="window.DictationStudio.playCurrentSegment(2)" title="Ctrl + ←">↺ −2s</button>
                <button type="button" class="dict-ctrl-btn" onclick="window.DictationStudio.pausePlayback()">❚❚ Dừng</button>
                ${isYT ? `<button type="button" id="dict-btn-hide-vid" class="dict-ctrl-btn" onclick="window.DictationStudio.toggleHideVideo()">${state.hideVideo ? 'Hiện Video' : 'Ẩn Video (Chỉ nghe)'}</button>` : ''}
              </div>
              <div class="dict-ctrl-row dict-spd-row">
                <span class="dict-spd-lbl">Tốc độ:</span>
                ${[0.75, 0.9, 1.0, 1.15, 1.25].map((sp) => `
                  <button type="button" class="dict-spd-btn ${state.speed === sp ? 'active' : ''}" data-spd="${sp}" onclick="window.DictationStudio.setSpeed(${sp})">${sp}x</button>
                `).join('')}
              </div>
              <div class="dict-kbd-bar">
                <span><kbd>Tab</kbd> Nghe lại</span>
                <span><kbd>Ctrl</kbd>+<kbd>←</kbd> Lùi 2s</span>
                <span><kbd>Alt</kbd>+<kbd>H</kbd> Gợi ý</span>
                <span><kbd>Ctrl</kbd>+<kbd>Enter</kbd> Chấm</span>
              </div>
            </div>

            <div class="dict-seg-nav-card">
              <div class="dict-seg-nav-head">
                <span>Tiến độ các câu</span>
                <strong class="tabular">${passedSet.size} / ${segs.length} câu đạt</strong>
              </div>
              <div class="dict-seg-dots">${segNavHtml}</div>
            </div>
          </div>

          <div class="dict-right-col">
            <div class="dict-work-card ink-brackets">
              <div class="dict-work-head">
                <span class="dict-eyebrow">CÂU ${state.segIdx + 1} / ${segs.length} · ${state.mode === 'cloze' ? 'CHẾ ĐỘ ĐIỀN TỪ KHÓA' : 'CHẾ ĐỘ CHÉP NGUYÊN CÂU'}</span>
                <span class="dict-time-tag tabular">${Number(seg.start || 0).toFixed(1)}s – ${Number(seg.end || 0).toFixed(1)}s</span>
              </div>
              ${exerciseHtml}
              <div class="dict-work-acts">
                <button type="button" class="tot-demo-btn" onclick="window.DictationStudio.giveHint()">💡 Gợi ý (Alt+H)</button>
                <div style="display:flex;gap:8px;margin-left:auto;">
                  ${state.segIdx > 0 ? `<button type="button" class="tot-demo-btn" onclick="window.DictationStudio.selectSegment(${state.segIdx - 1})">← Trước</button>` : ''}
                  <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.DictationStudio.checkCurrent()">Kiểm tra đáp án</button>
                </div>
              </div>
              ${feedbackHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render() {
    const root = getRoot();
    if (!root) return;
    bindShortcutsOnce();
    if (state.view === 'studio' && state.lessonId) {
      // Preserve active YouTube iframe if already activated on the same lesson
      const existingMount = document.getElementById('dict-yt-mount');
      const preserveYT = state.ytActivated && ytPlayer && ytLoadedVideoId && existingMount;
      let savedIframeNode = null;
      if (preserveYT) {
        savedIframeNode = existingMount.firstElementChild;
      }
      root.innerHTML = renderStudioHtml();
      if (preserveYT && savedIframeNode) {
        const newMount = document.getElementById('dict-yt-mount');
        if (newMount) {
          newMount.innerHTML = '';
          newMount.appendChild(savedIframeNode);
        }
      }
    } else {
      root.innerHTML = renderHubHtml();
    }
  }

  window.DictationStudio = {
    render,
    openLesson,
    backToHub,
    selectSegment,
    setMode,
    setSpeed,
    toggleHideVideo,
    playCurrentSegment,
    pausePlayback,
    onClozeInput,
    onFullInput,
    giveHint,
    checkCurrent,
    nextSegment,
    saveWordToNotebook,
    toggleImporter,
    saveImportedLesson,
    copyImportedJson,
    deleteCustomLesson,
    setFilterLevel: (lv) => { state.filterLevel = lv; render(); },
    setFilterSource: (src) => { state.filterSource = src; render(); },
    setQuery: (q) => { state.query = String(q || ''); render(); },
    getTodayDoneCount
  };
})();
