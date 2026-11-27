/* ==========================================================================
   TOTORO IELTS MASTER — DICTATION STUDIO v2 (js/dictation_studio.js)
   4-Mode AIO-Inspired Studio in Native Totoro Washi Aesthetic:
   1. Dictation (Word-slot underline typing + Per-word masked Sample + Proper Nouns
      + Cloze & Full-sentence modes + Vietnamese -s/-ed/article/prep trap detector)
   2. Shadowing (Script hide toggle + TotoroSpeechSTT mic scoring + replay)
   3. Quiz (Comprehension A/B/C/D + Jump-to-timestamp "Xem đoạn")
   4. Subtitles (Synced bilingual transcript + IPA + Word-click Dictionary Popup)
   ========================================================================== */
(function () {
  'use strict';

  const PROG_KEY_BASE = 'totoro_dictation_prog_v1_';
  const CUSTOM_KEY_BASE = 'totoro_dictation_custom_v1_';
  const PASS_RATIO = 0.80;
  const SHADOW_PASS_RATIO = 0.70;
  const SPEEDS = [0.75, 0.9, 1.0, 1.15, 1.25];

  const UK_US_EQUIV = {
    colour: 'color', colours: 'colors', favour: 'favor', favours: 'favors',
    favourite: 'favorite', favourites: 'favorites', savoury: 'savory',
    honour: 'honor', labour: 'labor', neighbour: 'neighbor', neighbours: 'neighbors',
    centre: 'center', centres: 'centers', metre: 'meter', metres: 'meters',
    theatre: 'theater', fibre: 'fiber', litre: 'liter',
    organise: 'organize', organised: 'organized', organising: 'organizing',
    analyse: 'analyze', analysed: 'analyzed', analysing: 'analyzing',
    realise: 'realize', realised: 'realized', recognise: 'recognize', recognised: 'recognized',
    programme: 'program', programmes: 'programs', dialogue: 'dialog',
    travelling: 'traveling', travelled: 'traveled', cancelled: 'canceled',
    defence: 'defense', licence: 'license', practise: 'practice', practising: 'practicing',
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
    "i'll": 'i will', "you'll": 'you will', "we'll": 'we will', "they'll": 'they will',
    "what's": 'what is'
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
  let loopReplayTimer = null;
  let autoNextTimer = null;
  let kbdBound = false;
  let dictIndexCache = null;

  const state = {
    view: 'hub',           // 'hub' | 'studio'
    filterLevel: 'all',    // 'all' | '5.5' | '6.5+' | '7.5+'
    filterSource: 'all',   // 'all' | 'youtube' | 'tts' | 'custom'
    query: '',
    lessonId: null,
    segIdx: 0,
    studioMode: 'dictation', // 'dictation' | 'shadowing' | 'quiz' | 'subtitles'
    dictSubMode: 'slots',    // 'slots' | 'cloze' | 'full'
    speed: 1.0,
    fontScale: 100,          // 90 | 100 | 112 | 125
    loopSegment: false,
    autoNext: true,
    showVi: true,
    showIpa: false,
    hideVideo: false,
    ytActivated: false,
    ytError: false,
    isPlaying: false,
    // Dictation input state
    slotValues: {},          // { wordIdx: string }
    sampleRevealAll: false,
    sampleRevealed: {},      // { wordIdx: true }
    clozeValues: {},         // { blankIdx: string }
    clozeHints: {},          // { blankIdx: revealLen }
    fullInput: '',
    lastCheck: null,
    // Shadowing state
    shadowHideText: false,
    shadowRecording: false,
    shadowProcessing: false,
    shadowAudioUrl: '',
    shadowResult: null,      // { text, pct, passed, tokens }
    // Quiz state
    quizAnswers: {},         // { qIdx: optIdx }
    quizSubmitted: false,
    // Word Dictionary Popup
    dictPopup: null,         // { word, base, note, ipa, pos, meaning, synonyms }
    // Importer
    importOpen: false
  };

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function STT() { return window.TotoroSpeechSTT || null; }
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
  function fmtMmSs(secs) {
    const s = Math.max(0, Math.floor(Number(secs) || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

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

  /* ================= WORD DICTIONARY & IPA ENGINE ================= */
  function buildDictIndex() {
    if (dictIndexCache) return dictIndexCache;
    const map = Object.create(null);
    const addEntry = (rawWord, pos, meaning, ipa, synonyms) => {
      const w = String(rawWord || '').trim().toLowerCase();
      if (!w || w.length < 2) return;
      if (!map[w] || (!map[w].meaning && meaning)) {
        map[w] = {
          word: w,
          pos: String(pos || '').trim(),
          meaning: String(meaning || '').trim(),
          ipa: String(ipa || '').trim(),
          synonyms: Array.isArray(synonyms) ? synonyms.slice(0, 4) : []
        };
      }
    };
    const appData = window.APP_DATA || {};
    Object.values(appData).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        addEntry(
          it.lemma || it.word,
          it.clean_pos || it.pos,
          it.clean_meaning || it.definition || it.meaning,
          it.ipa,
          it.clean_synonyms || it.synonyms
        );
      });
    });
    const lv = window.APP_LISTENING_VOCAB || {};
    Object.values(lv).forEach((arr) => {
      if (!Array.isArray(arr)) return;
      arr.forEach((it) => {
        if (!it || typeof it !== 'object') return;
        addEntry(it.lemma || it.word, it.clean_pos || it.pos, it.clean_meaning || it.meaning || it.definition, it.ipa, it.clean_synonyms);
      });
    });
    dictIndexCache = map;
    return map;
  }

  function getWordIpa(word) {
    const clean = String(word || '').toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '');
    if (!clean) return '';
    const dict = window.IPA_DICT || {};
    if (dict[clean]) return dict[clean];
    const uk = UK_US_EQUIV[clean];
    if (uk && dict[uk]) return dict[uk];
    return '';
  }

  function lookupWordInfo(rawWord) {
    const display = String(rawWord || '').replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '');
    const low = display.toLowerCase();
    const idx = buildDictIndex();
    const direct = idx[low] || (UK_US_EQUIV[low] ? idx[UK_US_EQUIV[low]] : null);
    let baseEntry = direct;
    let note = '';

    if (!baseEntry) {
      const candidates = [];
      if (low.endsWith('ies') && low.length > 4) candidates.push([low.slice(0, -3) + 'y', 'số nhiều / ngôi 3 số ít']);
      if (low.endsWith('ied') && low.length > 4) candidates.push([low.slice(0, -3) + 'y', 'quá khứ / V3']);
      if (low.endsWith('ing') && low.length > 5) {
        candidates.push([low.slice(0, -3), 'dạng V-ing']);
        candidates.push([low.slice(0, -3) + 'e', 'dạng V-ing']);
      }
      if (low.endsWith('ed') && low.length > 4) {
        candidates.push([low.slice(0, -2), 'quá khứ / V3']);
        candidates.push([low.slice(0, -1), 'quá khứ / V3']);
      }
      if (low.endsWith('es') && low.length > 4) candidates.push([low.slice(0, -2), 'số nhiều / V-es']);
      if (low.endsWith('s') && low.length > 3) candidates.push([low.slice(0, -1), 'số nhiều / V-s']);
      for (const [cand, tag] of candidates) {
        if (idx[cand]) {
          baseEntry = idx[cand];
          note = `"${display}" là dạng ${tag} của từ gốc "${cand}"`;
          break;
        }
      }
    }

    const ipa = getWordIpa(low) || baseEntry?.ipa || (baseEntry ? getWordIpa(baseEntry.word) : '');
    return {
      word: display,
      base: baseEntry?.word || low,
      note,
      ipa: ipa ? (ipa.startsWith('/') ? ipa : `/${ipa}/`) : '',
      pos: baseEntry?.pos || '',
      meaning: baseEntry?.meaning || 'Bấm nút loa để nghe phát âm chuẩn UK/US hoặc lưu vào Sổ từ vựng để ôn Flashcard.',
      synonyms: baseEntry?.synonyms || []
    };
  }

  function speakWord(word, accent) {
    const clean = String(word || '').replace(/^[^a-zA-Z0-9'-]+|[^a-zA-Z0-9'-]+$/g, '');
    if (!clean) return;
    if (window.AppCore?.audio?.speak) {
      window.AppCore.audio.speak(clean, { accent: accent || 'en-GB', engine: 'youdao', rate: 0.94 });
      return;
    }
    if (typeof window.speechSynthesis !== 'undefined') {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(clean);
        u.lang = accent || 'en-GB';
        u.rate = 0.92;
        window.speechSynthesis.speak(u);
      } catch (_) {}
    }
  }

  function openWordDict(word, ev) {
    if (ev && ev.stopPropagation) ev.stopPropagation();
    const info = lookupWordInfo(word);
    if (!info.word) return;
    state.dictPopup = info;
    speakWord(info.word, 'en-GB');
    renderDictPopupOnly();
  }

  function closeWordDict() {
    state.dictPopup = null;
    renderDictPopupOnly();
  }

  function renderDictPopupHtml() {
    const d = state.dictPopup;
    if (!d) return '';
    return `
      <div class="dict-pop-backdrop" onclick="window.DictationStudio.closeWordDict()">
        <div class="dict-pop-card" role="dialog" aria-modal="true" aria-label="Tra nghĩa từ ${esc(d.word)}" onclick="event.stopPropagation()">
          <div class="dict-pop-head">
            <div class="dict-pop-word-wrap">
              <strong class="dict-pop-word">${esc(d.word)}</strong>
              ${d.ipa ? `<span class="dict-pop-ipa">${esc(d.ipa)}</span>` : ''}
            </div>
            <div class="dict-pop-acts">
              <button type="button" class="dict-pop-btn" onclick="window.DictationStudio.speakWord('${esc(d.word).replace(/'/g, "\\'")}', 'en-GB')" title="Nghe giọng Anh - Anh">UK</button>
              <button type="button" class="dict-pop-btn" onclick="window.DictationStudio.speakWord('${esc(d.word).replace(/'/g, "\\'")}', 'en-US')" title="Nghe giọng Anh - Mỹ">US</button>
              <button type="button" class="dict-pop-btn is-star" onclick="window.DictationStudio.saveWordToNotebook('${esc(d.word).replace(/'/g, "\\'")}')" title="Lưu vào Sổ từ vựng">★ Lưu</button>
              <button type="button" class="dict-pop-close" onclick="window.DictationStudio.closeWordDict()" aria-label="Đóng">✕</button>
            </div>
          </div>
          ${d.note ? `<div class="dict-pop-note">${esc(d.note)}</div>` : ''}
          <div class="dict-pop-body">
            ${d.pos ? `<span class="dict-pill is-lvl">${esc(d.pos)}</span>` : ''}
            <div class="dict-pop-meaning">${esc(d.meaning)}</div>
            ${d.synonyms?.length ? `<div class="dict-pop-syns"><span>Đồng nghĩa:</span> ${d.synonyms.map((s) => `<span class="dict-pill">${esc(s)}</span>`).join('')}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function renderDictPopupOnly() {
    let host = document.getElementById('dict-word-popup-host');
    if (!host) {
      render();
      return;
    }
    host.innerHTML = renderDictPopupHtml();
  }

  /* ================= NORMALIZATION, WORD SLOTS & DIFF ================= */
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

  function buildWordSlots(seg) {
    const raw = String(seg?.text || '').trim();
    if (!raw) return [];
    const tokens = raw.split(/\s+/).filter(Boolean);
    return tokens.map((tok, idx) => {
      const m = tok.match(/^([^a-zA-Z0-9']*)([a-zA-Z0-9'-]+)([^a-zA-Z0-9']*)$/);
      const pre = m ? m[1] : '';
      const core = m ? m[2] : tok;
      const post = m ? m[3] : '';
      return { idx, raw: tok, pre, core, post, canon: canonWord(core) };
    });
  }

  function extractProperNouns(seg) {
    const out = [];
    const seen = new Set();
    const push = (v, isAuto = false) => {
      const s = String(v || '').trim();
      if (!s) return;
      const k = s.toLowerCase();
      if (seen.has(k)) return;
      if (isAuto && out.some((existing) => existing.toLowerCase().includes(k))) return;
      seen.add(k);
      out.push(s);
    };
    (seg?.properNouns || []).forEach((v) => push(v, false));
    // Auto-detect mid-sentence capitalized proper nouns / acronyms (skip index 0)
    const words = String(seg?.text || '').split(/\s+/);
    let buf = [];
    for (let i = 1; i < words.length; i++) {
      const clean = words[i].replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '');
      const prevEndsSent = /[.!?]$/.test(words[i - 1] || '');
      if (!prevEndsSent && clean && clean !== 'I' && (/^[A-Z][a-zA-Z0-9-]+$/.test(clean) || /^[A-Z]{2,}$/.test(clean))) {
        buf.push(clean);
      } else {
        if (buf.length) { push(buf.join(' '), true); buf = []; }
      }
    }
    if (buf.length) push(buf.join(' '), true);
    return out;
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

  function computeFullDiff(refText, userText, passThreshold = PASS_RATIO) {
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
      diagnostics.push({ kind: 'ending', label: 'Âm đuôi (-s / -es / -ed)', detail: `Chú ý nghe rõ đuôi từ: ${traps.endings.slice(0, 4).join(', ')}` });
    }
    if (traps.articles.length) {
      diagnostics.push({ kind: 'article', label: 'Mạo từ (a / an / the)', detail: `Lỗi mạo từ: ${traps.articles.slice(0, 4).join(', ')}` });
    }
    if (traps.prepositions.length) {
      diagnostics.push({ kind: 'prep', label: 'Giới từ nối âm', detail: `Kiểm tra giới từ: ${traps.prepositions.slice(0, 4).join(', ')}` });
    }
    return {
      pct,
      passed: pct >= Math.round(passThreshold * 100),
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

  function buildClickableTokensHtml(text, showIpa) {
    const parts = String(text || '').split(/(\s+)/);
    return parts.map((chunk) => {
      if (!chunk || /^\s+$/.test(chunk)) return chunk;
      const m = chunk.match(/^([^a-zA-Z0-9']*)([a-zA-Z0-9'-]+)([^a-zA-Z0-9']*)$/);
      if (!m) return esc(chunk);
      const [, pre, core, post] = m;
      const ipa = showIpa ? getWordIpa(core) : '';
      return `${esc(pre)}<button type="button" class="dict-click-word" onclick="window.DictationStudio.openWordDict('${esc(core).replace(/'/g, "\\'")}', event)">${esc(core)}${ipa ? `<span class="dict-word-ipa">${esc(ipa)}</span>` : ''}</button>${esc(post)}`;
    }).join('');
  }

  function buildMaskedBarsHtml(text) {
    const words = String(text || '').split(/\s+/).filter(Boolean);
    return `<div class="dict-mask-bars" aria-label="Phụ đề đang ẩn">${words.map((w) => {
      const ch = Math.max(2, Math.min(11, w.replace(/[^a-zA-Z0-9]/g, '').length || 3));
      return `<span class="dict-mask-bar" style="width:${ch * 7 + 8}px;"></span>`;
    }).join('')}</div>`;
  }

  function getLessonQuiz(lesson) {
    if (Array.isArray(lesson?.quiz) && lesson.quiz.length) return lesson.quiz;
    // Auto-generate comprehension keyword questions for custom imported videos
    const segs = lesson?.segments || [];
    const poolWords = [];
    segs.forEach((s) => {
      String(s.text || '').replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/).forEach((w) => {
        if (w.length >= 6 && !STOP_WORDS.has(w.toLowerCase()) && !poolWords.includes(w)) poolWords.push(w);
      });
    });
    const out = [];
    segs.slice(0, 4).forEach((s, idx) => {
      const target = (s.keywords && s.keywords[0])
        || String(s.text || '').replace(/[^a-zA-Z\s]/g, ' ').split(/\s+/).find((w) => w.length >= 6 && !STOP_WORDS.has(w.toLowerCase()));
      if (!target) return;
      const distractors = poolWords.filter((w) => w.toLowerCase() !== target.toLowerCase()).slice(0, 3);
      while (distractors.length < 3) distractors.push(['concept', 'evidence', 'method', 'process'][distractors.length]);
      const opts = [target, ...distractors].sort((a, b) => a.localeCompare(b));
      const masked = String(s.text || '').replace(new RegExp(`\\b${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), '_____');
      out.push({
        q: `Chọn từ chính xác nghe được ở Câu ${idx + 1}: "${masked}"`,
        options: opts,
        answer: opts.indexOf(target),
        segIdx: idx,
        explain: `Câu gốc: "${s.text}"`
      });
    });
    return out;
  }

  /* ================= LAZY-LOAD YOUTUBE & AUDIO ENGINE ================= */
  function loadYouTubeApiOnce() {
    if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise((resolve, reject) => {
      const prevCb = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prevCb === 'function') { try { prevCb(); } catch (_) {} }
        resolve(window.YT);
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      tag.async = true;
      tag.onerror = () => reject(new Error('Không thể tải YouTube API'));
      document.head.appendChild(tag);
      setTimeout(() => {
        if (!window.YT || typeof window.YT.Player !== 'function') reject(new Error('YouTube API timeout'));
      }, 9000);
    });
    return ytApiPromise;
  }

  function clearSegmentWatch() {
    if (ytWatchTimer) { clearInterval(ytWatchTimer); ytWatchTimer = null; }
    if (loopReplayTimer) { clearTimeout(loopReplayTimer); loopReplayTimer = null; }
  }

  function clearAutoNext() {
    if (autoNextTimer) { clearTimeout(autoNextTimer); autoNextTimer = null; }
  }

  function pausePlayback() {
    clearSegmentWatch();
    state.isPlaying = false;
    try { window.speechSynthesis?.cancel?.(); } catch (_) {}
    if (activeAudioEl) { try { activeAudioEl.pause(); } catch (_) {} }
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
      try { ytPlayer.pauseVideo(); } catch (_) {}
    }
    updatePlayBtnUI();
  }

  function destroyYouTubePlayer() {
    clearSegmentWatch();
    clearAutoNext();
    if (ytPlayer && typeof ytPlayer.destroy === 'function') {
      try { ytPlayer.destroy(); } catch (_) {}
    }
    ytPlayer = null;
    ytLoadedVideoId = '';
    state.ytActivated = false;
    state.ytError = false;
  }

  const ICON_PLAY = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4l15 8-15 8V4z"/></svg>';
  const ICON_PAUSE = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
  const ICON_PREV = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 5v14"/><path d="M18 6l-8 6 8 6V6z"/></svg>';
  const ICON_NEXT = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 5v14"/><path d="M6 6l8 6-8 6V6z"/></svg>';
  const ICON_REPLAY = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
  const ICON_LOOP = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 2l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 22l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';

  function updatePlayBtnUI() {
    const btn = document.getElementById('dict-btn-play');
    if (btn) {
      btn.classList.toggle('is-playing', state.isPlaying);
      btn.innerHTML = state.isPlaying ? ICON_PAUSE : ICON_PLAY;
      btn.title = state.isPlaying ? 'Tạm dừng' : 'Phát câu này';
    }
    document.querySelectorAll('.dict-wave-bars').forEach((w) => w.classList.toggle('is-anim', state.isPlaying));
  }

  function scheduleLoopIfNeeded() {
    if (!state.loopSegment || state.view !== 'studio') return;
    clearTimeout(loopReplayTimer);
    loopReplayTimer = setTimeout(() => {
      if (state.loopSegment && state.view === 'studio' && !state.shadowRecording) {
        playCurrentSegment(0);
      }
    }, 650);
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
      u.onend = () => { state.isPlaying = false; updatePlayBtnUI(); scheduleLoopIfNeeded(); };
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

    if (lesson.sourceType === 'tts' || (lesson.sourceType === 'youtube' && state.ytError)) {
      speakSegmentFallback(seg, lesson);
      return;
    }

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
          scheduleLoopIfNeeded();
        }
      }, 100);
      return;
    }

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
              scheduleLoopIfNeeded();
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

      state.ytActivated = true;
      mount.innerHTML = `<div id="dict-yt-iframe-host" style="width:100%;height:100%;"></div>`;
      try {
        const YT = await loadYouTubeApiOnce();
        ytLoadedVideoId = lesson.videoId;
        ytPlayer = new YT.Player('dict-yt-iframe-host', {
          videoId: lesson.videoId,
          playerVars: {
            rel: 0, modestbranding: 1, playsinline: 1, cc_load_policy: 0,
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

  function togglePlayPause() {
    if (state.isPlaying) pausePlayback();
    else playCurrentSegment(0);
  }

  /* ================= LESSON & SEGMENT ACTIONS ================= */
  function resetSegmentInputs() {
    clearAutoNext();
    state.slotValues = {};
    state.sampleRevealAll = false;
    state.sampleRevealed = {};
    state.clozeValues = {};
    state.clozeHints = {};
    state.fullInput = '';
    state.lastCheck = null;
    state.shadowRecording = false;
    state.shadowProcessing = false;
    state.shadowAudioUrl = '';
    state.shadowResult = null;
  }

  function openLesson(lessonId, initialMode) {
    const lesson = getLessonById(lessonId);
    if (!lesson) return;
    destroyYouTubePlayer();
    pausePlayback();
    STT()?.abort?.();
    state.view = 'studio';
    state.lessonId = lesson.id;
    window.TotoroUI?.recordLastSession?.({
      skill: 'Listening',
      view: 'practice',
      label: `Dictation · ${lesson.title}`,
      action: `window.TotoroUI?.openDictationStudio('${lesson.id}')`
    });
    if (initialMode && ['dictation', 'shadowing', 'quiz', 'subtitles'].includes(initialMode)) {
      state.studioMode = initialMode;
    } else {
      state.studioMode = 'dictation';
    }
    const prog = loadProgress()[lesson.id] || { passedIdxs: [] };
    const nextIdx = lesson.segments.findIndex((_, i) => !(prog.passedIdxs || []).includes(i));
    state.segIdx = nextIdx >= 0 ? nextIdx : 0;
    state.quizAnswers = {};
    state.quizSubmitted = false;
    state.dictPopup = null;
    resetSegmentInputs();
    render();
  }

  function backToHub() {
    destroyYouTubePlayer();
    pausePlayback();
    STT()?.abort?.();
    state.view = 'hub';
    state.lessonId = null;
    state.dictPopup = null;
    render();
  }

  function selectSegment(idx, autoPlay = false) {
    const lesson = getLessonById(state.lessonId);
    if (!lesson || !lesson.segments?.[idx]) return;
    pausePlayback();
    STT()?.abort?.();
    state.segIdx = idx;
    resetSegmentInputs();
    render();
    if (autoPlay) playCurrentSegment(0);
    else if (state.studioMode === 'dictation' && state.dictSubMode === 'slots') {
      setTimeout(() => document.getElementById('dict-slot-0')?.focus(), 40);
    }
  }

  function prevSegment() {
    if (state.segIdx > 0) selectSegment(state.segIdx - 1);
  }

  function nextSegment(autoPlay = false) {
    const lesson = getLessonById(state.lessonId);
    if (!lesson) return;
    if (state.segIdx + 1 < lesson.segments.length) {
      selectSegment(state.segIdx + 1, autoPlay);
    } else {
      toast('Bạn đã đi hết tất cả câu trong bài này!');
    }
  }

  function setStudioMode(mode) {
    if (!['dictation', 'shadowing', 'quiz', 'subtitles'].includes(mode)) return;
    STT()?.abort?.();
    clearAutoNext();
    state.studioMode = mode;
    state.lastCheck = null;
    state.shadowRecording = false;
    state.shadowProcessing = false;
    render();
  }

  function setMode(sub) {
    state.dictSubMode = ['slots', 'cloze', 'full'].includes(sub) ? sub : 'slots';
    state.lastCheck = null;
    render();
  }

  function cycleSpeed() {
    const i = SPEEDS.indexOf(state.speed);
    const next = SPEEDS[(i + 1) % SPEEDS.length];
    setSpeed(next);
  }

  function setSpeed(spd) {
    state.speed = Number(spd) || 1.0;
    if (ytPlayer && typeof ytPlayer.setPlaybackRate === 'function') {
      try { ytPlayer.setPlaybackRate(state.speed); } catch (_) {}
    }
    if (activeAudioEl) activeAudioEl.playbackRate = state.speed;
    const btn = document.getElementById('dict-btn-spd');
    if (btn) btn.textContent = `${state.speed}x`;
  }

  function stepFontScale(delta) {
    const steps = [90, 100, 112, 125];
    const idx = Math.max(0, steps.indexOf(state.fontScale));
    state.fontScale = steps[Math.max(0, Math.min(steps.length - 1, idx + delta))];
    const root = getRoot();
    const wrap = root?.querySelector('.dict-studio-wrap');
    if (wrap) wrap.style.setProperty('--dict-scale', `${state.fontScale / 100}`);
    const lbl = document.getElementById('dict-font-lbl');
    if (lbl) lbl.textContent = `${state.fontScale}%`;
  }

  function toggleLoop() {
    state.loopSegment = !state.loopSegment;
    const btn = document.getElementById('dict-btn-loop');
    if (btn) btn.classList.toggle('is-on', state.loopSegment);
    toast(state.loopSegment ? 'Đã bật lặp lại liên tục câu này.' : 'Đã tắt lặp câu.');
  }

  function toggleAutoNext() {
    state.autoNext = !state.autoNext;
    render();
  }

  function toggleShowVi() {
    state.showVi = !state.showVi;
    render();
  }

  function toggleShowIpa() {
    state.showIpa = !state.showIpa;
    render();
  }

  function toggleHideVideo() {
    state.hideVideo = !state.hideVideo;
    const wrap = document.getElementById('dict-media-stage');
    if (wrap) wrap.classList.toggle('is-video-hidden', state.hideVideo);
    const btn = document.getElementById('dict-btn-hide-vid');
    if (btn) btn.classList.toggle('is-on', state.hideVideo);
  }

  /* ================= DICTATION WORD SLOTS & SAMPLE REVEAL ================= */
  function onSlotInput(wordIdx, val) {
    state.slotValues[wordIdx] = val;
    if (state.lastCheck) state.lastCheck = null;
  }

  function onSlotKeyDown(wordIdx, totalSlots, ev) {
    if (ev.key === ' ') {
      ev.preventDefault();
      if (wordIdx + 1 < totalSlots) {
        document.getElementById(`dict-slot-${wordIdx + 1}`)?.focus();
      } else {
        checkCurrent();
      }
    } else if (ev.key === 'Backspace' && !ev.target.value && wordIdx > 0) {
      ev.preventDefault();
      const prev = document.getElementById(`dict-slot-${wordIdx - 1}`);
      if (prev) { prev.focus(); prev.setSelectionRange(prev.value.length, prev.value.length); }
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      if (state.lastCheck?.passed) nextSegment();
      else checkCurrent();
    } else if (ev.key === 'ArrowLeft' && ev.target.selectionStart === 0 && wordIdx > 0) {
      ev.preventDefault();
      document.getElementById(`dict-slot-${wordIdx - 1}`)?.focus();
    } else if (ev.key === 'ArrowRight' && ev.target.selectionStart === ev.target.value.length && wordIdx + 1 < totalSlots) {
      ev.preventDefault();
      document.getElementById(`dict-slot-${wordIdx + 1}`)?.focus();
    }
  }

  function clearSlots() {
    state.slotValues = {};
    state.clozeValues = {};
    state.fullInput = '';
    state.lastCheck = null;
    render();
    setTimeout(() => document.getElementById('dict-slot-0')?.focus(), 30);
  }

  function toggleSampleAll() {
    state.sampleRevealAll = !state.sampleRevealAll;
    render();
  }

  function toggleSampleWord(wordIdx) {
    state.sampleRevealed[wordIdx] = !state.sampleRevealed[wordIdx];
    render();
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
    if (state.dictSubMode === 'slots') {
      const slots = buildWordSlots(seg);
      const target = slots.find((s) => canonWord(state.slotValues[s.idx]) !== s.canon) || slots[0];
      if (!target) return;
      state.slotValues[target.idx] = target.core;
      state.sampleRevealed[target.idx] = true;
      render();
      const nextEl = document.getElementById(`dict-slot-${Math.min(slots.length - 1, target.idx + 1)}`);
      if (nextEl) nextEl.focus();
    } else if (state.dictSubMode === 'cloze') {
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
        document.getElementById('dict-full-textarea')?.focus();
      }
    }
  }

  function markSegmentPassed(lesson, segIdx, kind = 'dictation') {
    const map = loadProgress();
    const prev = map[lesson.id] || { passedIdxs: [], shadowPassedIdxs: [], completedAt: 0 };
    if (kind === 'shadowing') {
      const sSet = new Set(prev.shadowPassedIdxs || []);
      sSet.add(segIdx);
      prev.shadowPassedIdxs = Array.from(sSet).sort((a, b) => a - b);
    } else {
      const set = new Set(prev.passedIdxs || []);
      set.add(segIdx);
      prev.passedIdxs = Array.from(set).sort((a, b) => a - b);
      const allDone = prev.passedIdxs.length >= (lesson.segments?.length || 1);
      const newlyCompleted = allDone && !prev.completedAt;
      if (allDone) prev.completedAt = prev.completedAt || Date.now();
      if (newlyCompleted) {
        window.TotoroUI?.recordDailyActivity?.({ dictation: 1 });
        toast(`Hoàn thành trọn bài Dictation "${lesson.title}"!`);
      }
    }
    prev.updatedAt = Date.now();
    map[lesson.id] = prev;
    saveProgress(map);
  }

  function checkCurrent() {
    const lesson = getLessonById(state.lessonId);
    const seg = lesson?.segments?.[state.segIdx];
    if (!lesson || !seg) return;

    let passed = false;
    if (state.dictSubMode === 'slots') {
      const slots = buildWordSlots(seg);
      let okCount = 0;
      const slotResults = {};
      const joinedUser = slots.map((s) => String(state.slotValues[s.idx] || '').trim()).join(' ');
      slots.forEach((s) => {
        const val = canonWord(state.slotValues[s.idx]);
        const ok = val === s.canon;
        if (ok) okCount++;
        slotResults[s.idx] = { ok, expected: s.core, got: state.slotValues[s.idx] || '' };
      });
      const pct = slots.length > 0 ? Math.round((okCount / slots.length) * 100) : 100;
      passed = pct >= Math.round(PASS_RATIO * 100);
      const diff = computeFullDiff(seg.text, joinedUser);
      state.lastCheck = { mode: 'slots', pct, passed, okCount, total: slots.length, slotResults, diagnostics: diff.diagnostics };
      if (passed) markSegmentPassed(lesson, state.segIdx, 'dictation');
    } else if (state.dictSubMode === 'cloze') {
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
      passed = pct >= Math.round(PASS_RATIO * 100);
      state.lastCheck = { mode: 'cloze', pct, passed, okCount, total: blanks.length, blankResults };
      if (passed) markSegmentPassed(lesson, state.segIdx, 'dictation');
    } else {
      const diff = computeFullDiff(seg.text, state.fullInput);
      passed = diff.passed;
      state.lastCheck = { mode: 'full', ...diff };
      if (passed) markSegmentPassed(lesson, state.segIdx, 'dictation');
    }

    render();
    if (passed && state.autoNext && state.segIdx + 1 < lesson.segments.length) {
      clearAutoNext();
      autoNextTimer = setTimeout(() => {
        if (state.view === 'studio' && state.studioMode === 'dictation' && state.lastCheck?.passed) {
          nextSegment(false);
        }
      }, 2200);
    }
  }

  /* ================= SHADOWING MIC ENGINE ================= */
  function toggleShadowHide() {
    state.shadowHideText = !state.shadowHideText;
    render();
  }

  function toggleShadowMic() {
    const lesson = getLessonById(state.lessonId);
    const seg = lesson?.segments?.[state.segIdx];
    if (!lesson || !seg) return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      toast('Trình duyệt hiện tại chưa hỗ trợ Micro — hãy mở bằng Chrome/Edge để chấm Shadowing AI!');
      return;
    }
    if (state.shadowRecording) {
      stt.stop();
      state.shadowRecording = false;
      state.shadowProcessing = true;
      render();
      return;
    }
    pausePlayback();
    stt.abort();
    state.shadowRecording = true;
    state.shadowProcessing = false;
    state.shadowResult = null;
    render();

    stt.startRecording({
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 30000,
      onResult: (res) => {
        state.shadowRecording = false;
        state.shadowProcessing = false;
        state.shadowAudioUrl = res.audioUrl || '';
        if (res.silent || !res.text) {
          toast('Chưa thu được giọng rõ — hãy nói to hơn một chút nhé!');
          render();
          return;
        }
        const diff = computeFullDiff(seg.text, res.text, SHADOW_PASS_RATIO);
        state.shadowResult = { text: res.text, ...diff };
        if (diff.passed) {
          markSegmentPassed(lesson, state.segIdx, 'shadowing');
          toast(`Nói đuổi đạt ${diff.pct}% — Rất tự nhiên!`);
        }
        render();
      },
      onError: (msg) => {
        state.shadowRecording = false;
        state.shadowProcessing = false;
        toast(String(msg || 'Không thể dùng Micro.'));
        render();
      }
    });
  }

  function replayShadowAudio() {
    if (!state.shadowAudioUrl) {
      toast('Hãy ghi âm giọng của bạn trước khi nghe lại.');
      return;
    }
    try {
      const a = new Audio(state.shadowAudioUrl);
      a.play().catch(() => {});
    } catch (_) {}
  }

  /* ================= QUIZ ENGINE ================= */
  function selectQuizOption(qIdx, optIdx) {
    if (state.quizSubmitted) return;
    state.quizAnswers[qIdx] = optIdx;
    render();
  }

  function submitQuiz() {
    const lesson = getLessonById(state.lessonId);
    const quiz = getLessonQuiz(lesson);
    if (!quiz.length) return;
    state.quizSubmitted = true;
    let ok = 0;
    quiz.forEach((item, i) => { if (state.quizAnswers[i] === item.answer) ok++; });
    const pct = Math.round((ok / quiz.length) * 100);
    const map = loadProgress();
    const prev = map[lesson.id] || { passedIdxs: [], shadowPassedIdxs: [] };
    prev.quizBestPct = Math.max(prev.quizBestPct || 0, pct);
    prev.updatedAt = Date.now();
    map[lesson.id] = prev;
    saveProgress(map);
    toast(`Kết quả Quiz: ${ok}/${quiz.length} câu đúng (${pct}%)!`);
    render();
  }

  function resetQuiz() {
    state.quizAnswers = {};
    state.quizSubmitted = false;
    render();
  }

  function jumpToQuizSegment(segIdx) {
    selectSegment(segIdx, true);
  }

  function saveWordToNotebook(word) {
    const clean = String(word || '').replace(/^[^a-zA-Z-]+|[^a-zA-Z-]+$/g, '');
    if (!clean) return;
    const info = lookupWordInfo(clean);
    if (window.MyVocabStore && typeof window.MyVocabStore.addWord === 'function') {
      const deckFn = typeof window.MyVocabStore.addWordToNamedDeck === 'function';
      const payload = {
        lemma: clean,
        ipa: info.ipa || '',
        pos: info.pos || '',
        meaning: info.meaning && !info.meaning.startsWith('Bấm nút loa') ? info.meaning : '',
        synonyms: info.synonyms || [],
        source: 'Dictation Studio'
      };
      if (deckFn) window.MyVocabStore.addWordToNamedDeck('Dictation Studio', payload);
      else window.MyVocabStore.addWord(payload);
      toast(`Đã lưu "${clean}" vào Sổ từ vựng!`);
    } else {
      toast(`Đã ghi chú từ "${clean}".`);
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
    const blocks = text.split(/\n{2,}/);
    const segs = [];
    blocks.forEach((blk) => {
      const lines = blk.split('\n').map((l) => l.trim()).filter(Boolean);
      const timeIdx = lines.findIndex((l) => l.includes('-->'));
      if (timeIdx >= 0) {
        const [sStr, eStr] = lines[timeIdx].split('-->');
        const body = lines.slice(timeIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
        if (body) {
          segs.push({ idx: segs.length + 1, start: parseTimestampSec(sStr), end: parseTimestampSec(eStr), text: body, vi: '', keywords: [] });
        }
      }
    });
    if (segs.length) return segs;
    return text.split('\n').map((l) => l.trim()).filter(Boolean).map((line, i) => ({
      idx: i + 1, start: i * 6, end: (i + 1) * 6, text: line, vi: '', keywords: []
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
      titleVi: `Video tự nhập · ${segments.length} câu`,
      channel: videoId ? 'YouTube của tôi' : 'IELTS Audio tự thêm',
      topic,
      level,
      cefr: level === '5.5' ? 'B1' : (level === '7.5+' ? 'C1' : 'B2'),
      accent: 'US',
      duration: `${segments.length} câu`,
      sourceType: videoId ? 'youtube' : 'tts',
      videoId: videoId || '',
      isCustom: true,
      desc: videoId ? `Bài YouTube tự nhập (${segments.length} câu) — luyện đủ 4 chế độ.` : `Bài tự nhập offline (${segments.length} câu).`,
      segments
    };
    const list = loadCustomLessons();
    list.unshift(lesson);
    saveCustomLessons(list);
    state.importOpen = false;
    toast(`Đã tạo bài "${title}" (${segments.length} câu) — hỗ trợ đủ 4 chế độ!`);
    openLesson(lesson.id, 'dictation');
  }

  function copyImportedJson() {
    const title = (document.getElementById('dict-imp-title')?.value || 'Untitled Lesson').trim();
    const ytRaw = (document.getElementById('dict-imp-yt')?.value || '').trim();
    const level = document.getElementById('dict-imp-level')?.value || '6.5+';
    const topic = (document.getElementById('dict-imp-topic')?.value || 'Custom').trim();
    const segments = parseSrtOrPlain(document.getElementById('dict-imp-srt')?.value || '');
    const videoId = extractYouTubeId(ytRaw);
    const obj = { id: `dict-yt-${Date.now()}`, title, titleVi: '', channel: 'YouTube', topic, level, accent: 'US', duration: `${segments.length} câu`, sourceType: videoId ? 'youtube' : 'tts', videoId, desc: '', segments };
    navigator.clipboard?.writeText(JSON.stringify(obj, null, 2))
      .then(() => toast('Đã chép JSON chuẩn để dán vào data/dictation_data.js!'))
      .catch(() => toast('Không chép được tự động — hãy lưu trực tiếp bài vào trình duyệt.'));
  }

  function deleteCustomLesson(id, ev) {
    if (ev) ev.stopPropagation();
    saveCustomLessons(loadCustomLessons().filter((l) => l.id !== id));
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
      if (e.key === 'Escape' && state.dictPopup) {
        e.preventDefault();
        closeWordDict();
        return;
      }
      if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
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
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        nextSegment();
      } else if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        prevSegment();
      } else if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        if (state.studioMode === 'dictation') {
          if (state.lastCheck?.passed) nextSegment();
          else checkCurrent();
        } else if (state.studioMode === 'shadowing') {
          toggleShadowMic();
        }
      } else if (e.altKey && (e.key === 'h' || e.key === 'H')) {
        e.preventDefault();
        if (state.studioMode === 'dictation') giveHint();
      }
    });
  }

  /* ================= RENDER HUB (AIO-INSPIRED HERO + CATALOG) ================= */
  function renderHubHtml() {
    const all = getAllLessons();
    const prog = loadProgress();
    const q = state.query.trim().toLowerCase();
    const filtered = all.filter((l) => {
      if (state.filterLevel !== 'all' && l.level !== state.filterLevel) return false;
      if (state.filterSource === 'youtube' && l.sourceType !== 'youtube') return false;
      if (state.filterSource === 'tts' && l.sourceType === 'youtube') return false;
      if (state.filterSource === 'custom' && !l.isCustom) return false;
      if (q && !(l.title + ' ' + (l.titleVi || '') + ' ' + (l.channel || '') + ' ' + l.topic + ' ' + (l.desc || '')).toLowerCase().includes(q)) return false;
      return true;
    });

    const totalDoneLessons = all.filter((l) => (prog[l.id]?.passedIdxs?.length || 0) >= (l.segments?.length || 1)).length;
    const customCount = loadCustomLessons().length;

    // Pick Hero recommended video (first incomplete lesson)
    const hero = all.find((l) => (prog[l.id]?.passedIdxs?.length || 0) < (l.segments?.length || 1)) || all[0];
    const heroPassed = hero ? (prog[hero.id]?.passedIdxs?.length || 0) : 0;
    const heroTotal = hero?.segments?.length || 1;
    const heroPct = Math.round((heroPassed / heroTotal) * 100);
    const heroIsYT = hero?.sourceType === 'youtube' && hero?.videoId;

    const heroHtml = hero ? `
      <section class="dict-hero-card ink-brackets">
        <div class="dict-hero-left">
          <div class="dict-hero-thumb ${heroIsYT ? 'is-yt' : 'is-audio'}" onclick="window.DictationStudio.openLesson('${esc(hero.id)}', 'dictation')">
            ${heroIsYT
              ? `<img src="https://i.ytimg.com/vi/${esc(hero.videoId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">`
              : `<div class="dict-audio-art"><svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg><span>IELTS Audio · ${esc(hero.accent || 'UK')}</span></div>`}
            <span class="dict-thumb-badge">${esc(hero.cefr || ('Band ' + hero.level))}</span>
            <span class="dict-dur-badge tabular">${esc(hero.duration || `${heroTotal} câu`)}</span>
            <span class="dict-thumb-play is-lg" aria-hidden="true">▶</span>
          </div>
        </div>
        <div class="dict-hero-right">
          <span class="dict-eyebrow">GỢI Ý BẮT ĐẦU · 4 CHẾ ĐỘ LUYỆN VIDEO</span>
          <h2 class="dict-hero-title">${esc(hero.title)}</h2>
          ${hero.titleVi ? `<div class="dict-hero-vi">${esc(hero.titleVi)}</div>` : ''}
          <div class="dict-hero-meta">${esc(hero.channel || 'Totoro IELTS')} · ${heroTotal} câu · Band ${esc(hero.level || '6.5+')}</div>
          <div class="dict-hero-prog">
            <div class="dict-prog-bar"><span style="width:${heroPct}%"></span></div>
            <span class="dict-prog-txt tabular">${heroPct}%</span>
          </div>
          <div class="dict-hero-modes">
            <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.DictationStudio.openLesson('${esc(hero.id)}', 'dictation')">▶ Dictation</button>
            <button type="button" class="btn-subtle dict-hero-mode-btn" onclick="window.DictationStudio.openLesson('${esc(hero.id)}', 'shadowing')">Shadowing</button>
            <button type="button" class="btn-subtle dict-hero-mode-btn" onclick="window.DictationStudio.openLesson('${esc(hero.id)}', 'quiz')">Quiz</button>
            <button type="button" class="btn-subtle dict-hero-mode-btn" onclick="window.DictationStudio.openLesson('${esc(hero.id)}', 'subtitles')">Phụ đề</button>
          </div>
        </div>
      </section>
    ` : '';

    const cardsHtml = filtered.length
      ? filtered.map((l) => {
          const lp = prog[l.id] || {};
          const passed = lp.passedIdxs?.length || 0;
          const total = l.segments?.length || 1;
          const pct = Math.round((passed / total) * 100);
          const isYT = l.sourceType === 'youtube' && l.videoId;
          const thumbHtml = isYT
            ? `<div class="dict-card-thumb is-yt">
                 <img src="https://i.ytimg.com/vi/${esc(l.videoId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
                 <span class="dict-thumb-badge">${esc(l.cefr || ('Band ' + l.level))}</span>
                 <span class="dict-dur-badge tabular">${esc(l.duration || `${total} câu`)}</span>
                 <span class="dict-thumb-play" aria-hidden="true">▶</span>
               </div>`
            : `<div class="dict-card-thumb is-audio">
                 <div class="dict-audio-art">
                   <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                   <span>IELTS Audio · ${esc(l.accent || 'UK')}</span>
                 </div>
                 <span class="dict-thumb-badge">${l.isCustom ? 'Của tôi' : 'Offline Ready'}</span>
                 <span class="dict-dur-badge tabular">${esc(l.duration || `${total} câu`)}</span>
               </div>`;
          return `
            <article class="dict-card" onclick="window.DictationStudio.openLesson('${esc(l.id)}', 'dictation')">
              ${thumbHtml}
              <div class="dict-card-body">
                <div class="dict-card-meta">
                  <span class="dict-pill is-lvl">Band ${esc(l.level || '6.5+')}</span>
                  <span class="dict-pill">${esc(l.topic || 'General')}</span>
                  <span class="dict-pill tabular">${total} câu</span>
                  ${lp.quizBestPct ? `<span class="dict-pill is-ok tabular">Quiz ${lp.quizBestPct}%</span>` : ''}
                  ${l.isCustom ? `<button type="button" class="dict-del-btn" title="Xóa bài tự thêm" onclick="window.DictationStudio.deleteCustomLesson('${esc(l.id)}', event)">✕</button>` : ''}
                </div>
                <h3 class="dict-card-title">${esc(l.title)}</h3>
                ${l.titleVi ? `<div class="dict-card-vi">${esc(l.titleVi)}</div>` : ''}
                <div class="dict-card-chan">${esc(l.channel || (isYT ? 'YouTube' : 'Totoro IELTS Audio'))}</div>
                <div class="dict-card-foot">
                  <div class="dict-prog-wrap">
                    <div class="dict-prog-bar"><span style="width:${pct}%"></span></div>
                    <span class="dict-prog-txt tabular">${passed}/${total}</span>
                  </div>
                  <span class="dict-open-cta">${passed > 0 ? 'Học tiếp →' : 'Luyện ngay →'}</span>
                </div>
              </div>
            </article>
          `;
        }).join('')
      : `<div class="dict-empty">Không tìm thấy video phù hợp. Thử đổi bộ lọc hoặc bấm <strong>+ Dán link YouTube / SRT</strong> để thêm bài mới.</div>`;

    const importModalHtml = state.importOpen ? `
      <div class="dict-modal-backdrop" onclick="window.DictationStudio.toggleImporter(false)">
        <div class="dict-modal" role="dialog" aria-modal="true" aria-label="Nhập bài YouTube và SRT" onclick="event.stopPropagation()">
          <div class="dict-modal-head">
            <div>
              <h3>Dán link YouTube + Phụ đề (.SRT / .VTT)</h3>
              <p>Tự động tạo trọn bộ 4 chế độ <strong>Dictation · Shadowing · Quiz · Subtitles</strong> ngay trên máy bạn.</p>
            </div>
            <button type="button" class="dict-icon-btn" onclick="window.DictationStudio.toggleImporter(false)" aria-label="Đóng">✕</button>
          </div>
          <div class="dict-imp-steps">
            <span><strong>1.</strong> Dán link YouTube (hoặc bỏ trống để dùng giọng đọc)</span>
            <span><strong>2.</strong> Dán phụ đề .srt/.vtt hoặc mỗi dòng 1 câu</span>
            <span><strong>3.</strong> Luyện đủ 4 chế độ &amp; tra từ 1 chạm</span>
          </div>
          <form class="dict-imp-form" onsubmit="window.DictationStudio.saveImportedLesson(event)">
            <div class="dict-imp-grid">
              <label><span>Tiêu đề video *</span><input id="dict-imp-title" type="text" required placeholder="VD: BBC 6 Minute English · Coffee & Sleep"></label>
              <label><span>Link YouTube hoặc Video ID (tùy chọn)</span><input id="dict-imp-yt" type="text" placeholder="https://youtube.com/watch?v=..."></label>
              <label><span>Chủ đề</span><input id="dict-imp-topic" type="text" placeholder="VD: Science, Everyday, Part 4..."></label>
              <label><span>Trình độ</span>
                <select id="dict-imp-level">
                  <option value="5.5">Band 5.5 (B1)</option>
                  <option value="6.5+" selected>Band 6.5+ (B2)</option>
                  <option value="7.5+">Band 7.5+ (C1)</option>
                </select>
              </label>
            </div>
            <label class="dict-imp-ta-wrap">
              <span>Phụ đề (.srt / .vtt có mốc thời gian) hoặc dán mỗi dòng 1 câu *</span>
              <textarea id="dict-imp-srt" rows="7" required placeholder="1&#10;00:00:08,000 --> 00:00:13,000&#10;Hello, this is 6 Minute English from BBC Learning English."></textarea>
            </label>
            <div class="dict-imp-acts">
              <button type="button" class="tot-demo-btn" onclick="window.DictationStudio.copyImportedJson()">Chép JSON</button>
              <button type="submit" class="btn btn-primary tot-demo-btn">Tạo &amp; Luyện 4 chế độ →</button>
            </div>
          </form>
        </div>
      </div>
    ` : '';

    return `
      <div class="dict-shell">
        <div class="dict-hub-top-bar">
          <button type="button" class="btn-subtle dict-back-portal-btn" onclick="window.TotoroUI?.setListeningPracticeSub?.('exams')">← Kho đề Listening</button>
          <div class="dict-hub-top-acts">
            <div class="dict-stat-pill tabular"><strong>${totalDoneLessons}/${all.length}</strong> bài xong</div>
            <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.DictationStudio.toggleImporter(true)">+ Dán link YouTube / SRT</button>
          </div>
        </div>

        ${heroHtml}

        <div class="dict-filter-bar">
          <div class="dict-filter-chips">
            ${['all', '5.5', '6.5+', '7.5+'].map((lv) => `
              <button type="button" class="dict-chip ${state.filterLevel === lv ? 'active' : ''}" onclick="window.DictationStudio.setFilterLevel('${lv}')">${lv === 'all' ? 'Mọi Band' : 'Band ' + lv}</button>
            `).join('')}
          </div>
          <div class="dict-filter-chips">
            ${[
              ['all', `Tất cả (${all.length})`],
              ['youtube', 'YouTube'],
              ['tts', 'IELTS Audio'],
              ['custom', `Của tôi (${customCount})`]
            ].map(([k, lbl]) => `
              <button type="button" class="dict-chip ${state.filterSource === k ? 'active' : ''}" onclick="window.DictationStudio.setFilterSource('${k}')">${lbl}</button>
            `).join('')}
          </div>
          <input type="search" class="dict-search" aria-label="Tìm video hoặc chủ đề" value="${esc(state.query)}" placeholder="Tìm video, kênh, chủ đề..." oninput="window.DictationStudio.setQuery(this.value)">
        </div>

        <div class="dict-grid dict-grid-3">${cardsHtml}</div>
        ${importModalHtml}
      </div>
    `;
  }

  /* ================= RENDER 4-MODE STUDIO ================= */
  function renderStudioHtml() {
    const lesson = getLessonById(state.lessonId);
    if (!lesson) return renderHubHtml();
    const segs = lesson.segments || [];
    const seg = segs[state.segIdx] || segs[0];
    const prog = loadProgress()[lesson.id] || { passedIdxs: [], shadowPassedIdxs: [] };
    const dictPassedSet = new Set(prog.passedIdxs || []);
    const shadowPassedSet = new Set(prog.shadowPassedIdxs || []);
    const activeDoneSet = state.studioMode === 'shadowing' ? shadowPassedSet : dictPassedSet;
    const activePct = Math.round((activeDoneSet.size / Math.max(1, segs.length)) * 100);
    const isYT = lesson.sourceType === 'youtube' && lesson.videoId && !state.ytError;

    // 1. Media Stage
    const mediaStageHtml = isYT
      ? `<div class="dict-media-stage ${state.hideVideo ? 'is-video-hidden' : ''}" id="dict-media-stage">
           <div class="dict-yt-mount" id="dict-yt-mount">
             ${state.ytActivated
               ? `<div id="dict-yt-iframe-host" style="width:100%;height:100%;"></div>`
               : `<button type="button" class="dict-yt-facade" onclick="window.DictationStudio.playCurrentSegment(0)">
                    <img src="https://i.ytimg.com/vi/${esc(lesson.videoId)}/hqdefault.jpg" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">
                    <span class="dict-yt-play-circle" aria-hidden="true">▶</span>
                    <span class="dict-yt-facade-lbl">Bấm phát câu ${state.segIdx + 1} (${fmtMmSs(seg.start)} – ${fmtMmSs(seg.end)})</span>
                  </button>`
             }
           </div>
           <div class="dict-video-veil" aria-hidden="true">
             <span>🎧 Đang ẩn Video — Tập trung nghe âm thanh</span>
           </div>
         </div>`
      : `<div class="dict-media-stage is-audio-mode" id="dict-media-stage">
           <div class="dict-audio-stage-box">
             <div class="dict-wave-bars ${state.isPlaying ? 'is-anim' : ''}" aria-hidden="true">
               <span></span><span></span><span></span><span></span><span></span><span></span><span></span>
             </div>
             <div class="dict-audio-stage-title">${esc(lesson.title)}</div>
             <div class="dict-audio-stage-sub">Câu ${state.segIdx + 1}/${segs.length} · Giọng ${esc(lesson.accent || 'UK')} · ${state.speed}x</div>
           </div>
         </div>`;

    // 2. AIO 6-Control Transport Bar
    const transportBarHtml = `
      <div class="dict-transport-bar">
        <div class="dict-trans-meta tabular">
          <span>${fmtMmSs(seg.start)} – ${fmtMmSs(seg.end)}</span>
          <span class="dict-trans-sep">·</span>
          <span>Câu ${state.segIdx + 1}/${segs.length}</span>
          ${state.studioMode === 'dictation' ? '<span class="dict-trans-sep">·</span><span>Phụ đề đang ẩn</span>' : ''}
        </div>
        <div class="dict-trans-controls">
          <button type="button" class="dict-tbtn" ${state.segIdx === 0 ? 'disabled' : ''} onclick="window.DictationStudio.prevSegment()" title="Câu trước (Alt+←)" aria-label="Câu trước">${ICON_PREV}</button>
          <button type="button" class="dict-tbtn" onclick="window.DictationStudio.playCurrentSegment(0)" title="Nghe lại câu này (Tab / Ctrl+Space)" aria-label="Nghe lại câu này">${ICON_REPLAY}</button>
          <button type="button" id="dict-btn-play" class="dict-tbtn is-play ${state.isPlaying ? 'is-playing' : ''}" onclick="window.DictationStudio.togglePlayPause()" title="Phát / Tạm dừng" aria-label="Phát hoặc tạm dừng">${state.isPlaying ? ICON_PAUSE : ICON_PLAY}</button>
          <button type="button" id="dict-btn-loop" class="dict-tbtn ${state.loopSegment ? 'is-on' : ''}" onclick="window.DictationStudio.toggleLoop()" title="Lặp lại câu này liên tục" aria-label="Lặp lại câu này">${ICON_LOOP}</button>
          <button type="button" class="dict-tbtn" ${state.segIdx >= segs.length - 1 ? 'disabled' : ''} onclick="window.DictationStudio.nextSegment()" title="Câu tiếp theo (Alt+→)" aria-label="Câu tiếp theo">${ICON_NEXT}</button>
          <button type="button" id="dict-btn-spd" class="dict-tbtn is-txt tabular" onclick="window.DictationStudio.cycleSpeed()" title="Đổi tốc độ phát">${state.speed}x</button>
          ${isYT ? `<button type="button" id="dict-btn-hide-vid" class="dict-tbtn is-txt ${state.hideVideo ? 'is-on' : ''}" onclick="window.DictationStudio.toggleHideVideo()" title="Ẩn / Hiện hình ảnh video">${state.hideVideo ? 'Hiện hình' : 'Ẩn hình'}</button>` : ''}
        </div>
      </div>
    `;

    // 3. Active Mode Card (Left Column below video)
    let modeCardHtml = '';
    if (state.studioMode === 'dictation') {
      const slots = buildWordSlots(seg);
      const properNouns = extractProperNouns(seg);
      let inputAreaHtml = '';

      if (state.dictSubMode === 'slots') {
        const slotsHtml = slots.map((s) => {
          const val = state.slotValues[s.idx] || '';
          const res = state.lastCheck?.mode === 'slots' ? state.lastCheck.slotResults?.[s.idx] : null;
          const stCls = res ? (res.ok ? 'is-ok' : 'is-bad') : '';
          const wCh = Math.max(3.2, Math.min(16, s.core.length + 1.2));
          return `<span class="dict-slot-wrap">${esc(s.pre)}<input type="text" id="dict-slot-${s.idx}" class="dict-slot-inp ${stCls}" style="width:${wCh}ch" value="${esc(val)}" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" aria-label="Từ ${s.idx + 1}" oninput="window.DictationStudio.onSlotInput(${s.idx}, this.value)" onkeydown="window.DictationStudio.onSlotKeyDown(${s.idx}, ${slots.length}, event)">${esc(s.post)}</span>`;
        }).join(' ');
        inputAreaHtml = `
          <div class="dict-slots-stage">${slotsHtml}</div>
          <div class="dict-kbd-inline"><span><kbd>Space</kbd> từ tiếp</span><span><kbd>Enter</kbd> chấm điểm</span><span><kbd>Tab</kbd> nghe lại</span><span><kbd>Alt</kbd>+<kbd>H</kbd> gợi ý</span></div>
        `;
      } else if (state.dictSubMode === 'cloze') {
        const { parts, blanks } = buildClozeParts(seg);
        const sentHtml = parts.map((p) => {
          if (p.type === 'text') return esc(p.text);
          const val = state.clozeValues[p.idx] || '';
          const res = state.lastCheck?.mode === 'cloze' ? state.lastCheck.blankResults?.[p.idx] : null;
          const stCls = res ? (res.ok ? 'is-ok' : 'is-bad') : '';
          const widthCh = Math.max(7, Math.min(20, p.answer.length + 2));
          return `<span class="dict-blank-wrap"><input type="text" id="dict-blank-${p.idx}" class="dict-blank-inp ${stCls}" style="width:${widthCh}ch" value="${esc(val)}" placeholder="${'•'.repeat(Math.min(8, p.answer.length))}" autocomplete="off" spellcheck="false" oninput="window.DictationStudio.onClozeInput(${p.idx}, this.value)">${res && !res.ok ? `<span class="dict-blank-fix">${esc(res.expected)}</span>` : ''}</span>`;
        }).join('');
        inputAreaHtml = `<div class="dict-mode-hint">Điền <strong>${blanks.length} từ khóa</strong> còn thiếu — đạt ≥80% để qua câu.</div><div class="dict-sent-box">${sentHtml}</div>`;
      } else {
        inputAreaHtml = `<textarea id="dict-full-textarea" class="dict-full-ta" rows="3" spellcheck="false" placeholder="Gõ chính xác nguyên câu bạn vừa nghe... (Tab: nghe lại · Ctrl+Enter: chấm)" oninput="window.DictationStudio.onFullInput(this.value)">${esc(state.fullInput)}</textarea>`;
      }

      // Per-word Masked Sample Card (AIO "Câu mẫu")
      const samplePillsHtml = slots.map((s) => {
        const revealed = state.sampleRevealAll || Boolean(state.sampleRevealed[s.idx]) || Boolean(state.lastCheck?.passed);
        if (revealed) {
          return `<button type="button" class="dict-sample-word is-open" onclick="window.DictationStudio.openWordDict('${esc(s.core).replace(/'/g, "\\'")}', event)" title="Bấm để tra nghĩa">${esc(s.raw)}</button>`;
        }
        const px = Math.max(22, Math.min(88, s.core.length * 8 + 10));
        return `<button type="button" class="dict-sample-pill" style="width:${px}px;" onclick="window.DictationStudio.toggleSampleWord(${s.idx})" title="Bấm để hé lộ từ này" aria-label="Hé lộ từ ${s.idx + 1}"></button>`;
      }).join(' ');

      let feedbackHtml = '';
      if (state.lastCheck) {
        const c = state.lastCheck;
        const diagHtml = (c.diagnostics || []).length
          ? `<div class="dict-diag-list">${c.diagnostics.map((d) => `<div class="dict-diag-item"><span class="dict-diag-tag">${esc(d.label)}</span><span>${esc(d.detail)}</span></div>`).join('')}</div>`
          : '';
        feedbackHtml = `
          <div class="dict-feedback ${c.passed ? 'is-pass' : 'is-retry'}">
            <div class="dict-fb-head">
              <strong class="dict-fb-score tabular">${c.passed ? '✓ Đạt chuẩn' : '✕ Chưa đạt 80%'} · ${c.pct}%</strong>
              ${c.passed && state.segIdx + 1 < segs.length
                ? `<button type="button" class="btn btn-primary tot-demo-btn" style="height:30px;padding:0 12px;font-size:12px;" onclick="window.DictationStudio.nextSegment()">Câu tiếp →</button>`
                : ''}
            </div>
            ${diagHtml}
          </div>
        `;
      }

      modeCardHtml = `
        <div class="dict-work-card ink-brackets">
          <div class="dict-work-head">
            <div class="dict-submode-pills">
              <button type="button" class="dict-sub-pill ${state.dictSubMode === 'slots' ? 'active' : ''}" onclick="window.DictationStudio.setMode('slots')">Ô từ (AIO)</button>
              <button type="button" class="dict-sub-pill ${state.dictSubMode === 'cloze' ? 'active' : ''}" onclick="window.DictationStudio.setMode('cloze')">Từ khóa</button>
              <button type="button" class="dict-sub-pill ${state.dictSubMode === 'full' ? 'active' : ''}" onclick="window.DictationStudio.setMode('full')">Nguyên câu</button>
            </div>
            <label class="dict-switch-lbl" title="Tự động chuyển sang câu tiếp theo sau khi chép đúng">
              <input type="checkbox" ${state.autoNext ? 'checked' : ''} onchange="window.DictationStudio.toggleAutoNext()">
              <span>Tự sang câu</span>
            </label>
          </div>

          ${inputAreaHtml}

          <div class="dict-work-acts">
            <button type="button" class="btn-subtle dict-mini-act" onclick="window.DictationStudio.clearSlots()">Xoá chữ</button>
            <button type="button" class="btn-subtle dict-mini-act" onclick="window.DictationStudio.giveHint()">💡 Gợi ý từ</button>
            <button type="button" class="btn btn-primary tot-demo-btn" style="margin-left:auto;height:34px;padding:0 14px;" onclick="window.DictationStudio.checkCurrent()">Kiểm tra (Enter)</button>
          </div>

          ${feedbackHtml}

          <div class="dict-sample-box">
            <div class="dict-sample-head">
              <span class="dict-sample-lbl">Câu mẫu <small>(chạm ô xám để hé lộ từng từ)</small></span>
              <button type="button" class="dict-eye-btn ${state.sampleRevealAll ? 'is-on' : ''}" onclick="window.DictationStudio.toggleSampleAll()" title="${state.sampleRevealAll ? 'Ẩn câu mẫu' : 'Hiện cả câu mẫu'}">
                ${state.sampleRevealAll ? '🙈 Ẩn mẫu' : '👁 Hiện mẫu'}
              </button>
            </div>
            <div class="dict-sample-row">${samplePillsHtml}</div>
            ${state.showVi && seg.vi ? `<div class="dict-sample-vi">${esc(seg.vi)}</div>` : ''}
          </div>

          ${properNouns.length ? `
            <div class="dict-proper-row">
              <span class="dict-proper-lbl">ⓘ Danh từ riêng:</span>
              ${properNouns.map((pn) => `<span class="dict-proper-chip">${esc(pn)}</span>`).join('')}
            </div>
          ` : ''}
        </div>
      `;
    } else if (state.studioMode === 'shadowing') {
      const sr = state.shadowResult;
      modeCardHtml = `
        <div class="dict-work-card ink-brackets">
          <div class="dict-work-head">
            <span class="dict-eyebrow">SHADOWING · NÓI ĐUỔI CÂU ${state.segIdx + 1} / ${segs.length}</span>
            <button type="button" class="dict-eye-btn ${state.shadowHideText ? 'is-on' : ''}" onclick="window.DictationStudio.toggleShadowHide()">
              ${state.shadowHideText ? '👁 Hiện câu mẫu' : '🙈 Che câu mẫu'}
            </button>
          </div>

          <div class="dict-shadow-script ${state.shadowHideText ? 'is-blurred' : ''}">
            <div class="dict-shadow-en">${buildClickableTokensHtml(seg.text, state.showIpa)}</div>
            ${state.showVi && seg.vi ? `<div class="dict-shadow-vi">${esc(seg.vi)}</div>` : ''}
          </div>

          <div class="dict-shadow-mic-box">
            <button type="button" class="dict-mic-circle ${state.shadowRecording ? 'is-rec' : ''}" ${state.shadowProcessing ? 'disabled' : ''} onclick="window.DictationStudio.toggleShadowMic()" aria-label="Ghi âm nói đuổi">
              ${state.shadowRecording ? '■' : '🎙'}
            </button>
            <div class="dict-shadow-mic-info">
              <div class="dict-shadow-mic-title">${state.shadowProcessing ? 'Đang chấm giọng nói AI...' : (state.shadowRecording ? 'Đang ghi âm · Bấm để dừng & chấm' : 'Bấm bắt đầu ghi âm (Ctrl+Enter)')}</div>
              <div class="dict-shadow-mic-sub">Nói nối theo nhịp và ngữ điệu câu gốc · Đạt ≥70% để hoàn thành câu</div>
            </div>
          </div>

          <div class="dict-shadow-btns">
            <button type="button" class="btn-subtle dict-shadow-act" onclick="window.DictationStudio.playCurrentSegment(0)">🔊 Nghe mẫu</button>
            <button type="button" class="btn-subtle dict-shadow-act" ${state.shadowAudioUrl ? '' : 'disabled'} onclick="window.DictationStudio.replayShadowAudio()">▶ Nghe lại giọng mình</button>
          </div>

          ${sr ? `
            <div class="dict-feedback ${sr.passed ? 'is-pass' : 'is-retry'}" style="margin-top:12px;">
              <div class="dict-fb-head">
                <strong class="dict-fb-score tabular">${sr.passed ? '✓ Đạt chuẩn nói đuổi' : 'Thử nói rõ hơn'} · ${sr.pct}%</strong>
                ${sr.passed && state.segIdx + 1 < segs.length ? `<button type="button" class="btn btn-primary tot-demo-btn" style="height:30px;padding:0 12px;font-size:12px;" onclick="window.DictationStudio.nextSegment(true)">Câu tiếp →</button>` : ''}
              </div>
              <div class="dict-diff-strip">${(sr.tokens || []).map((t) => {
                if (t.status === 'ok') return `<span class="dict-tok is-ok">${esc(t.text)}</span>`;
                if (t.status === 'miss') return `<span class="dict-tok is-miss">${esc(t.expected)}</span>`;
                if (t.status === 'sub') return `<span class="dict-tok is-sub"><del>${esc(t.got)}</del> → <strong>${esc(t.expected)}</strong></span>`;
                return `<span class="dict-tok is-extra">${esc(t.got)}</span>`;
              }).join(' ')}</div>
            </div>
          ` : ''}
        </div>
      `;
    } else if (state.studioMode === 'quiz') {
      const quiz = getLessonQuiz(lesson);
      const answeredCnt = Object.keys(state.quizAnswers).length;
      let scoreOk = 0;
      if (state.quizSubmitted) quiz.forEach((it, idx) => { if (state.quizAnswers[idx] === it.answer) scoreOk++; });

      modeCardHtml = `
        <div class="dict-work-card ink-brackets">
          <div class="dict-work-head">
            <span class="dict-eyebrow">TRẮC NGHIỆM HIỂU BÀI · ${answeredCnt}/${quiz.length} CÂU</span>
            ${state.quizSubmitted
              ? `<span class="dict-pill is-ok tabular">Đúng ${scoreOk}/${quiz.length} (${Math.round((scoreOk / Math.max(1, quiz.length)) * 100)}%)</span>`
              : `<span class="dict-pill tabular">Bấm "Xem đoạn" để nghe lại</span>`}
          </div>

          <div class="dict-quiz-list">
            ${quiz.map((item, qIdx) => {
              const picked = state.quizAnswers[qIdx];
              const targetSeg = segs[item.segIdx] || segs[0];
              return `
                <div class="dict-quiz-item">
                  <div class="dict-quiz-qhead">
                    <div class="dict-quiz-qtxt"><strong>Câu ${qIdx + 1}.</strong> ${esc(item.q)}</div>
                    <button type="button" class="dict-quiz-jump" onclick="window.DictationStudio.jumpToQuizSegment(${item.segIdx || 0})">▶ Xem đoạn (${fmtMmSs(targetSeg?.start || 0)})</button>
                  </div>
                  <div class="dict-quiz-opts">
                    ${item.options.map((opt, oIdx) => {
                      const isSel = picked === oIdx;
                      let cls = `dict-quiz-opt ${isSel ? 'is-sel' : ''}`;
                      if (state.quizSubmitted) {
                        if (oIdx === item.answer) cls += ' is-ok';
                        else if (isSel && oIdx !== item.answer) cls += ' is-bad';
                      }
                      return `<button type="button" class="${cls}" onclick="window.DictationStudio.selectQuizOption(${qIdx}, ${oIdx})"><span class="dict-quiz-ltr">${String.fromCharCode(65 + oIdx)}</span><span>${esc(opt)}</span></button>`;
                    }).join('')}
                  </div>
                  ${state.quizSubmitted && item.explain ? `<div class="dict-quiz-exp">${esc(item.explain)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>

          <div class="dict-work-acts" style="margin-top:14px;">
            ${state.quizSubmitted
              ? `<button type="button" class="btn btn-primary tot-demo-btn" style="margin-left:auto;" onclick="window.DictationStudio.resetQuiz()">Làm lại Quiz</button>`
              : `<button type="button" class="btn btn-primary tot-demo-btn" style="margin-left:auto;" onclick="window.DictationStudio.submitQuiz()">Nộp bài (${answeredCnt}/${quiz.length})</button>`}
          </div>
        </div>
      `;
    } else {
      // Mode 4: Subtitles (Pure bilingual reading + word lookup)
      modeCardHtml = `
        <div class="dict-work-card dict-sub-chill-card ink-brackets">
          <div class="dict-work-head">
            <span class="dict-eyebrow">CHẾ ĐỘ PHỤ ĐỀ SONG NGỮ · XEM &amp; TRA TỪ</span>
            <span class="dict-pill">Chạm từ bất kỳ để tra nghĩa</span>
          </div>
          <div class="dict-chill-active">
            <div class="dict-shadow-en">${buildClickableTokensHtml(seg.text, state.showIpa)}</div>
            ${state.showVi && seg.vi ? `<div class="dict-shadow-vi">${esc(seg.vi)}</div>` : ''}
          </div>
        </div>
      `;
    }

    // 4. Right Column: Synced Interactive Transcript Panel ("Phụ đề")
    const transcriptRowsHtml = segs.map((s, i) => {
      const isCur = i === state.segIdx;
      const isDone = activeDoneSet.has(i);
      const shouldMask = state.studioMode === 'dictation' && !isDone;
      const durSec = Math.max(1, Math.round((Number(s.end) || 0) - (Number(s.start) || 0)));
      const wCount = String(s.text || '').trim().split(/\s+/).filter(Boolean).length;
      return `
        <div class="dict-tr-row ${isCur ? 'is-cur' : ''} ${isDone ? 'is-done' : ''}" onclick="window.DictationStudio.selectSegment(${i}, ${state.studioMode === 'subtitles' ? 'true' : 'false'})">
          <div class="dict-tr-top">
            <button type="button" class="dict-tr-ts tabular" onclick="event.stopPropagation(); window.DictationStudio.selectSegment(${i}, true)" title="Phát từ ${fmtMmSs(s.start)}">▶ ${fmtMmSs(s.start)}</button>
            ${isCur ? `<span class="dict-tr-cur-meta">${state.studioMode === 'dictation' ? 'Câu đang chép' : 'Đang học'} · ${wCount} từ, ${durSec}s</span>` : ''}
            ${isDone ? `<span class="dict-tr-check" title="Đã hoàn thành">✓</span>` : `<span class="dict-tr-idx tabular">#${i + 1}</span>`}
          </div>
          <div class="dict-tr-en">${shouldMask ? buildMaskedBarsHtml(s.text) : buildClickableTokensHtml(s.text, state.showIpa)}</div>
          ${state.showVi && s.vi ? `<div class="dict-tr-vi">${esc(s.vi)}</div>` : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="dict-shell dict-studio-wrap" style="--dict-scale:${state.fontScale / 100};">
        <div class="dict-studio-topbar">
          <button type="button" class="btn-subtle dict-back-list-btn" onclick="window.DictationStudio.backToHub()">← Danh sách</button>
          <div class="dict-studio-title-wrap">
            <h2 class="dict-studio-title">${esc(lesson.title)}</h2>
            <span class="dict-pill is-lvl">${esc(lesson.cefr || ('Band ' + lesson.level))}</span>
          </div>
          <div class="dict-mode-seg" role="tablist" aria-label="4 chế độ luyện video">
            ${[
              ['dictation', 'Dictation'],
              ['shadowing', 'Shadowing'],
              ['quiz', 'Quiz'],
              ['subtitles', 'Subtitles']
            ].map(([mKey, mLbl]) => `
              <button type="button" role="tab" aria-selected="${state.studioMode === mKey ? 'true' : 'false'}" class="dict-mode-btn ${state.studioMode === mKey ? 'active' : ''}" onclick="window.DictationStudio.setStudioMode('${mKey}')">${mLbl}</button>
            `).join('')}
          </div>
          <div class="dict-font-ctrl" title="Cỡ chữ luyện tập">
            <button type="button" class="dict-font-btn" onclick="window.DictationStudio.stepFontScale(-1)" aria-label="Giảm cỡ chữ">−A</button>
            <span id="dict-font-lbl" class="tabular">${state.fontScale}%</span>
            <button type="button" class="dict-font-btn" onclick="window.DictationStudio.stepFontScale(1)" aria-label="Tăng cỡ chữ">+A</button>
          </div>
        </div>

        <div class="dict-studio-grid-v2">
          <div class="dict-left-col">
            ${mediaStageHtml}
            ${transportBarHtml}
            ${modeCardHtml}
          </div>

          <aside class="dict-right-col dict-transcript-panel" aria-label="Danh sách phụ đề song ngữ">
            <div class="dict-tr-head">
              <div class="dict-tr-head-l">
                <strong class="dict-tr-title">Phụ đề</strong>
                <span class="dict-pill is-lvl tabular">${activeDoneSet.size}/${segs.length} · ${activePct}%</span>
              </div>
              <div class="dict-tr-toggles">
                <label class="dict-switch-lbl"><input type="checkbox" ${state.showVi ? 'checked' : ''} onchange="window.DictationStudio.toggleShowVi()"><span>Bản dịch</span></label>
                <label class="dict-switch-lbl"><input type="checkbox" ${state.showIpa ? 'checked' : ''} onchange="window.DictationStudio.toggleShowIpa()"><span>IPA</span></label>
              </div>
            </div>
            <div class="dict-tr-prog-bar"><span style="width:${activePct}%"></span></div>
            <div class="dict-tr-list">${transcriptRowsHtml}</div>
          </aside>
        </div>

        <div id="dict-word-popup-host">${renderDictPopupHtml()}</div>
      </div>
    `;
  }

  function render() {
    const root = getRoot();
    if (!root) return;
    bindShortcutsOnce();
    if (state.view === 'studio' && state.lessonId) {
      const existingMount = document.getElementById('dict-yt-mount');
      const preserveYT = state.ytActivated && ytPlayer && ytLoadedVideoId && existingMount;
      let savedIframeNode = null;
      if (preserveYT) savedIframeNode = existingMount.firstElementChild;
      root.innerHTML = renderStudioHtml();
      if (preserveYT && savedIframeNode) {
        const newMount = document.getElementById('dict-yt-mount');
        if (newMount) { newMount.innerHTML = ''; newMount.appendChild(savedIframeNode); }
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
    prevSegment,
    nextSegment,
    setStudioMode,
    setMode,
    setSpeed,
    cycleSpeed,
    stepFontScale,
    toggleLoop,
    toggleAutoNext,
    toggleShowVi,
    toggleShowIpa,
    toggleHideVideo,
    playCurrentSegment,
    togglePlayPause,
    pausePlayback,
    onSlotInput,
    onSlotKeyDown,
    clearSlots,
    toggleSampleAll,
    toggleSampleWord,
    onClozeInput,
    onFullInput,
    giveHint,
    checkCurrent,
    toggleShadowHide,
    toggleShadowMic,
    replayShadowAudio,
    selectQuizOption,
    submitQuiz,
    resetQuiz,
    jumpToQuizSegment,
    openWordDict,
    closeWordDict,
    speakWord,
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
