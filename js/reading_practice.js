/* =========================================================
   MODULE: IELTS Reading Practice PRO — Cambridge 1–20 Shelf & Inspera CD-IELTS Engine
   - Portal 3-column native Totoro grid: Cambridge 1–20 | Volume 1–6 | Actual Tests | News
   - 2-level Library inside Cambridge/Volume/Actual:
       Book/Vol/Year Selector -> Test 1..4 -> Passage 1 -> Passage 2 -> Passage 3 -> FULL TEST
   - Full-Screen 1:1 Inspera CD-IELTS Exam Workspace (customized with Totoro Washi contrast):
       * 56px Header + Options (≡) Overlay (Contrast x4, Text size x3, Submit)
       * Full-width Part Sub-Banner
       * Resizable 50/50 Split Pane + right-hand Notes Drawer (#e6e7e6)
       * Right-click / Selection compact Note + Highlight caret popover
       * Flat exam paper questions: vertical radio rows (#b8d8f0 full-row highlight),
         inline rectangular Gap-Fill (#888 border + centered bold question number),
         Drag-and-Drop (+ tap-to-assign) Matching Headings with dashed blue drop zones
       * Floating 40x40px <- / -> arrows + 48px Inspera Bottom Bar (green top status dashes,
         blue active box, collapsed Part 2/3 summary tabs, far-right checkmark Submit)
   - Post-Exam Review PRO: Band, Accuracy by Type, Paraphrase Mapping, Locate Evidence,
     Interleaved Bilingual Translation, and Click-to-Dictionary -> 1-click Save to My Vocab
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY_BASE = 'ielts_reading_practice_v1_';
  const LOCKOUT_KEY_BASE = 'ielts_rp_anticheat_lock_v1_';
  const PALETTE_STORAGE_KEY = 'ielts_rp_hl_palette_v1';
  const BILINGUAL_STORAGE_KEY_BASE = 'ielts_rp_bilingual_v1_';
  const ONLINE_DICT_CACHE_KEY = 'ielts_rp_online_dict_v1';
  const ANTI_CHEAT_LOCKOUT_MINS = 30;

  const HL_COLOR_IDS = ['yellow', 'green', 'pink', 'blue', 'purple', 'coral'];
  const HL_ROLE_NAMES = ['Ý chính', 'Dẫn chứng', 'Từ khóa', 'Số liệu', 'Từ vựng', 'Lưu ý'];

  // 6 Soothing Print-Ready Pastel Highlight Palettes (Matching Reference Image 5)
  const PASTEL_PALETTES = [
    {
      id: 'macaron',
      name: 'Cầu vồng Macaron',
      sub: 'Macaron Pastel',
      colors: ['#D6ECFC', '#D6F3DF', '#FFF0B3', '#FCE0EC', '#E9DFFA', '#FDE1CF'],
      lines:  ['#60A5FA', '#4ADE80', '#EAB308', '#F472B6', '#A78BFA', '#FB923C']
    },
    {
      id: 'sage',
      name: 'Thảo mộc & Xô thơm',
      sub: 'Botanical Sage',
      colors: ['#D8F0DC', '#CFF0E8', '#EAF5C4', '#E3ECD4', '#F8F1C4', '#E0EDE2'],
      lines:  ['#4E9460', '#2CA58D', '#8FB339', '#6B8E56', '#C9A227', '#5C8D6B']
    },
    {
      id: 'ocean',
      name: 'Biển xanh & Lam ngọc',
      sub: 'Ocean & Sky',
      colors: ['#DCF0FA', '#D1F3EE', '#C7EEF6', '#DBE4FA', '#C9E7FC', '#D6EFE7'],
      lines:  ['#38BDF8', '#2DD4BF', '#22D3EE', '#60A5FA', '#0EA5E9', '#34D399']
    },
    {
      id: 'sunset',
      name: 'Hoàng hôn & Đất nung',
      sub: 'Warm Sunset',
      colors: ['#FDE5CF', '#FDE0B5', '#FAD8D0', '#FADCE8', '#FFF0BE', '#F4DFD5'],
      lines:  ['#F97316', '#F59E0B', '#F87171', '#EC4899', '#EAB308', '#D97757']
    },
    {
      id: 'lavender',
      name: 'Oải hương & Thạch anh',
      sub: 'Lavender & Mauve',
      colors: ['#ECE0FA', '#F4E0F8', '#DFE6FA', '#E3D6FA', '#FCE0EE', '#E9E5F8'],
      lines:  ['#A855F7', '#C084FC', '#818CF8', '#9333EA', '#EC4899', '#8B5CF6']
    },
    {
      id: 'classic',
      name: 'Học thuật Cổ điển',
      sub: 'Academic Classic',
      colors: ['#FFF2AC', '#DCE8FB', '#D8F2DE', '#FDE7B6', '#FBDFE6', '#FDE1CC'],
      lines:  ['#CA8A04', '#3B82F6', '#16A34A', '#D97706', '#DB2777', '#EA580C']
    }
  ];

  function getActivePaletteId() {
    try {
      const saved = localStorage.getItem(PALETTE_STORAGE_KEY);
      if (saved && PASTEL_PALETTES.some((p) => p.id === saved)) return saved;
    } catch (_) {}
    return 'macaron';
  }

  function getActivePalette() {
    const pid = state?.highlightPalette || getActivePaletteId();
    return PASTEL_PALETTES.find((p) => p.id === pid) || PASTEL_PALETTES[0];
  }

  function getActivePastelPens() {
    const pal = getActivePalette();
    return HL_COLOR_IDS.map((id, idx) => ({
      id,
      name: `Màu ${idx + 1} (${pal.name})`,
      role: HL_ROLE_NAMES[idx] || 'Highlight',
      swatch: pal.colors[idx] || pal.colors[0],
      line: pal.lines[idx] || pal.lines[0]
    }));
  }

  function buildPaletteCssVarsStyle(pal) {
    const p = pal || getActivePalette();
    return HL_COLOR_IDS.map((id, idx) => `--hl-${id}:${p.colors[idx]};--hl-${id}-line:${p.lines[idx]};`).join('');
  }

  function loadBilingualDrafts(passageId) {
    if (!passageId) return {};
    try {
      const raw = localStorage.getItem(BILINGUAL_STORAGE_KEY_BASE + getUid());
      const all = raw ? JSON.parse(raw) : {};
      return (all && typeof all[passageId] === 'object' && all[passageId]) ? all[passageId] : {};
    } catch (_) { return {}; }
  }

  function saveBilingualDraft(passageId, paraIdx, text) {
    if (!passageId) return;
    try {
      const key = BILINGUAL_STORAGE_KEY_BASE + getUid();
      const raw = localStorage.getItem(key);
      const all = raw ? JSON.parse(raw) : {};
      if (!all[passageId] || typeof all[passageId] !== 'object') all[passageId] = {};
      if (String(text || '').trim()) all[passageId][String(paraIdx)] = String(text);
      else delete all[passageId][String(paraIdx)];
      localStorage.setItem(key, JSON.stringify(all));
    } catch (_) {}
  }

  function clearBilingualDrafts(passageId) {
    if (!passageId) return;
    try {
      const key = BILINGUAL_STORAGE_KEY_BASE + getUid();
      const raw = localStorage.getItem(key);
      const all = raw ? JSON.parse(raw) : {};
      delete all[passageId];
      localStorage.setItem(key, JSON.stringify(all));
    } catch (_) {}
  }

  const PASTEL_PENS = HL_COLOR_IDS.map((id, idx) => ({
    id,
    name: `Màu ${idx + 1}`,
    role: HL_ROLE_NAMES[idx] || 'Highlight',
    swatch: PASTEL_PALETTES[0].colors[idx]
  }));

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function DATA() {
    return window.READING_PRACTICE_DATA || {
      SOURCES: [], CAMBRIDGE_BOOKS: [], VOLUME_BOOKS: [], ACTUAL_YEARS: [], PASSAGES: {}, FULL_TESTS: []
    };
  }

  function getUid() {
    const uid = B()?.getScopedUid?.() || B()?.getCurrentUser?.()?.id || 'guest';
    return String(uid || 'guest').trim().toLowerCase();
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (s) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function estimateBand(correct, total) {
    if (!total || total <= 0) return 0;
    const scaled40 = Math.round((correct / total) * 40);
    if (scaled40 >= 39) return 9.0;
    if (scaled40 >= 37) return 8.5;
    if (scaled40 >= 35) return 8.0;
    if (scaled40 >= 33) return 7.5;
    if (scaled40 >= 30) return 7.0;
    if (scaled40 >= 27) return 6.5;
    if (scaled40 >= 23) return 6.0;
    if (scaled40 >= 19) return 5.5;
    if (scaled40 >= 15) return 5.0;
    if (scaled40 >= 13) return 4.5;
    if (scaled40 >= 10) return 4.0;
    if (scaled40 >= 7) return 3.5;
    return 3.0;
  }

  function formatDuration(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  function formatMinsRemaining(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    if (s < 60) return `${s} seconds remaining`;
    const mins = Math.ceil(s / 60);
    return `${mins} minute${mins === 1 ? '' : 's'} remaining`;
  }

  function qTypeLabel(type) {
    if (type === 'tfng') return 'T / F / NG';
    if (type === 'ynng') return 'Y / N / NG';
    if (type === 'mcq') return 'Multiple Choice';
    if (type === 'gap') return 'Gap Fill';
    if (type === 'matching_headings') return 'Matching Headings';
    if (type === 'select') return 'Matching';
    return 'Reading';
  }

  /* =========================================================
     1. LOCAL STORE: ReadingPracticeStore
     ========================================================= */
  const ReadingPracticeStore = {
    _key() { return `${STORAGE_KEY_BASE}${getUid()}`; },

    load() {
      try {
        const raw = localStorage.getItem(this._key());
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && typeof parsed === 'object') {
          return {
            history: Array.isArray(parsed.history) ? parsed.history : [],
            inProgress: parsed.inProgress && typeof parsed.inProgress === 'object' ? parsed.inProgress : null
          };
        }
      } catch (_) {}
      return { history: [], inProgress: null };
    },

    save(stateObj) {
      try { localStorage.setItem(this._key(), JSON.stringify(stateObj)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('reading-practice-updated')); } catch (_) {}
    },

    recordAttempt(entry) {
      const st = this.load();
      st.history.unshift(entry);
      if (st.history.length > 80) st.history = st.history.slice(0, 80);
      if (st.inProgress && st.inProgress.itemId === entry.itemId) st.inProgress = null;
      if (st.drafts && entry.itemId && st.drafts[entry.itemId]) delete st.drafts[entry.itemId];
      this.save(st);
    },

    saveInProgress(snapshot) {
      if (!snapshot || !snapshot.itemId) return;
      const st = this.load();
      if (!st.drafts || typeof st.drafts !== 'object') st.drafts = {};
      st.drafts[snapshot.itemId] = snapshot;
      st.inProgress = snapshot;
      this.save(st);
    },

    getDraftForItem(itemId) {
      if (!itemId) return null;
      const st = this.load();
      if (st.drafts && st.drafts[itemId]) return st.drafts[itemId];
      if (st.inProgress && st.inProgress.itemId === itemId) return st.inProgress;
      return null;
    },

    clearDraftForItem(itemId) {
      if (!itemId) return;
      const st = this.load();
      let changed = false;
      if (st.drafts && st.drafts[itemId]) { delete st.drafts[itemId]; changed = true; }
      if (st.inProgress && st.inProgress.itemId === itemId) { st.inProgress = null; changed = true; }
      if (changed) this.save(st);
    },

    clearInProgress() {
      const st = this.load();
      if (st.inProgress != null) {
        st.inProgress = null;
        this.save(st);
      }
    },

    getInProgress() {
      const st = this.load();
      return st.inProgress || null;
    },
    getHistory() { return this.load().history; },

    _lockKey() { return `${LOCKOUT_KEY_BASE}${getUid()}`; },

    getLockoutInfo() {
      if (isTeacherBypass()) {
        try { localStorage.removeItem(this._lockKey()); } catch (_) {}
        return null;
      }
      try {
        const raw = localStorage.getItem(this._lockKey());
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        const until = Number(parsed?.until) || 0;
        const uid = getUid();
        const origin = Number(parsed?.createdAt || (until - ANTI_CHEAT_LOCKOUT_MINS * 60 * 1000));
        // Respect Teacher Unlock All & Per-Task Unlock (rp_prac_lock) from Cloud Sync!
        const unlockAll = Number(localStorage.getItem(`ielts_teacher_unlocked_at_${uid}`) || 0);
        const perMap = JSON.parse(localStorage.getItem(`ielts_teacher_task_unlocks_v1_${uid}`) || '{}') || {};
        const perUnlock = Number(perMap.rp_prac_lock || 0);
        if ((unlockAll > 0 && origin <= unlockAll) || (perUnlock > 0 && origin <= perUnlock)) {
          localStorage.removeItem(this._lockKey());
          return null;
        }
        const remainingMs = until - Date.now();
        if (remainingMs > 0) {
          return { ...parsed, until, remainingMs };
        }
        localStorage.removeItem(this._lockKey());
      } catch (_) {}
      return null;
    },

    setLockout(minutes, meta = {}) {
      if (isTeacherBypass()) {
        try { localStorage.removeItem(this._lockKey()); } catch (_) {}
        return null;
      }
      const mins = Math.max(1, Number(minutes) || ANTI_CHEAT_LOCKOUT_MINS);
      const payload = {
        until: Date.now() + mins * 60 * 1000,
        minutes: mins,
        reason: meta.reason || 'Chuyển tab khi đang làm bài',
        score: typeof meta.score === 'number' ? meta.score : null,
        total: typeof meta.total === 'number' ? meta.total : null,
        band: typeof meta.band === 'number' ? meta.band : null,
        title: meta.title || '',
        createdAt: Date.now()
      };
      try { localStorage.setItem(this._lockKey(), JSON.stringify(payload)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('reading-practice-updated')); } catch (_) {}
      try {
        if (window.__VOCAB_BRIDGE__?.syncPushCurrentUser) {
          window.__VOCAB_BRIDGE__.syncPushCurrentUser(false, { force: true });
        } else {
          window.__VOCAB_BRIDGE__?.saveAndSync?.({ force: true });
        }
      } catch (_) {}
      return payload;
    },

    clearLockout() {
      try { localStorage.removeItem(this._lockKey()); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('reading-practice-updated')); } catch (_) {}
    },

    getBestAttempt(itemId) {
      const list = this.load().history.filter((h) => h.itemId === itemId);
      if (!list.length) return null;
      return list.reduce((best, cur) => (cur.band > best.band || (cur.band === best.band && cur.score > best.score) ? cur : best), list[0]);
    },

    getSummaryStats() {
      const hist = this.load().history;
      const uniqueIds = new Set(hist.map((h) => h.itemId));
      const avgBand = hist.length
        ? Math.round((hist.reduce((s, h) => s + (Number(h.band) || 0), 0) / hist.length) * 2) / 2
        : 0;
      const totalMins = Math.round(hist.reduce((s, h) => s + (Number(h.elapsedSec) || 0), 0) / 60);
      return {
        attemptsCount: hist.length,
        completedUnique: uniqueIds.size,
        avgBand,
        totalMins,
        recent: hist.slice(0, 5),
        inProgress: this.load().inProgress
      };
    }
  };

  /* =========================================================
     2. DICTIONARY LOOKUP (Post-Exam Review & News -> My Vocab)
     ========================================================= */
  let _appWordMap = null;
  function getReadingDeckLabelForItem(it, bucket) {
    if (bucket === 'file1') return 'Paraphrase 1.500';
    if (bucket === 'signal') return 'Signal Words';
    const tier = String(it?.tier || it?.level || '').toLowerCase();
    if (tier === 'foundation') return 'Nền tảng';
    if (tier === 'academic') return 'Học thuật';
    if (tier === 'advanced') return 'Chuyên sâu';
    const r = Number(it?.rank || 0);
    if (r > 0 && r <= 1000) return 'Nền tảng';
    if (r > 1000 && r <= 2200) return 'Học thuật';
    return 'Chuyên sâu';
  }

  function getAppWordMap() {
    if (_appWordMap) return _appWordMap;
    const map = new Map();
    const d = (typeof APP_DATA !== 'undefined' ? APP_DATA : window.APP_DATA) || {};
    const buckets = [
      ['file1', d.file1_paraphrase_1500 || []],
      ['file2', d.file2_families_3500 || []],
      ['signal', d.signal_words || []]
    ];
    buckets.forEach(([bucket, arr]) => {
      arr.forEach((it) => {
        if (!it || !it.lemma) return;
        const deckLabel = getReadingDeckLabelForItem(it, bucket);
        const rec = { item: it, deckLabel, bucket };
        const mainKey = String(it.lemma).trim().toLowerCase();
        if (mainKey && !map.has(mainKey)) map.set(mainKey, rec);

        // Index word forms so plurals/inflections/derivatives match the Reading list too
        const forms = [];
        if (typeof it.word_forms === 'string' && it.word_forms) {
          it.word_forms.split(/[,;/]+/).forEach((f) => forms.push(f));
        }
        if (Array.isArray(it.clean_forms)) {
          it.clean_forms.forEach((f) => forms.push(f));
        }
        forms.forEach((f) => {
          const fk = String(f || '').trim().toLowerCase();
          if (fk && fk.length >= 2 && !map.has(fk)) map.set(fk, rec);
        });
      });
    });
    if (map.size > 0) _appWordMap = map;
    return map;
  }

  function stemCandidates(word) {
    const w = word.toLowerCase();
    const cands = [w];
    if (w.endsWith('ies') && w.length > 4) cands.push(w.slice(0, -3) + 'y');
    if (w.endsWith('es') && w.length > 3) cands.push(w.slice(0, -2));
    if (w.endsWith('s') && w.length > 3) cands.push(w.slice(0, -1));
    if (w.endsWith('ing') && w.length > 5) { cands.push(w.slice(0, -3)); cands.push(w.slice(0, -3) + 'e'); }
    if (w.endsWith('ed') && w.length > 4) { cands.push(w.slice(0, -2)); cands.push(w.slice(0, -1)); }
    if (w.endsWith('ly') && w.length > 4) cands.push(w.slice(0, -2));
    return cands;
  }

  /* ---------- ONLINE DICTIONARY FALLBACK + LOCAL CACHE (for words outside 4.489 Reading list, e.g. "ocean-going") ---------- */
  const _onlineDictMem = new Map();
  let _dictLookupSeq = 0;

  const EN_POS_TO_VI = {
    noun: 'Danh từ',
    verb: 'Động từ',
    adjective: 'Tính từ',
    adverb: 'Trạng từ',
    preposition: 'Giới từ',
    conjunction: 'Liên từ',
    pronoun: 'Đại từ',
    interjection: 'Thán từ',
    phrase: 'Cụm từ'
  };

  function getOnlineDictCache() {
    try {
      const raw = localStorage.getItem(ONLINE_DICT_CACHE_KEY);
      const parsed = raw ? JSON.parse(raw) : {};
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch (_) { return {}; }
  }

  function setOnlineDictCache(key, data) {
    if (!key || !data) return;
    _onlineDictMem.set(key, data);
    try {
      const all = getOnlineDictCache();
      all[key] = { ...data, _ts: Date.now() };
      const keys = Object.keys(all);
      if (keys.length > 350) {
        keys.sort((a, b) => (all[a]?._ts || 0) - (all[b]?._ts || 0));
        keys.slice(0, keys.length - 300).forEach((k) => delete all[k]);
      }
      localStorage.setItem(ONLINE_DICT_CACHE_KEY, JSON.stringify(all));
    } catch (_) {}
  }

  function getCachedOnlineEntry(lowerKey) {
    if (_onlineDictMem.has(lowerKey)) return _onlineDictMem.get(lowerKey);
    const all = getOnlineDictCache();
    if (all[lowerKey]) {
      _onlineDictMem.set(lowerKey, all[lowerKey]);
      return all[lowerKey];
    }
    return null;
  }

  async function fetchOnlineWordDefinition(rawWord) {
    const clean = String(rawWord || '').trim().replace(/\s+/g, ' ');
    const key = clean.toLowerCase();
    if (!key) return null;
    const cached = getCachedOnlineEntry(key);
    if (cached && cached.vi) return cached;

    const result = { vi: '', ipa: '', pos: '', enDef: '', synonyms: [] };
    const isSingleLike = /^[a-z]+(?:-[a-z]+)?$/i.test(clean);

    // 1) Parallel free CORS endpoints: Google Translate (EN->VI) + Free Dictionary API (IPA/POS/EN def/synonyms)
    const tasks = [];

    // Google Translate public GTX endpoint (fast, handles compounds like "ocean-going" & phrases!)
    tasks.push((async () => {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4500);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=vi&dt=t&dt=bd&q=${encodeURIComponent(clean)}`;
        const resp = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (!resp.ok) return;
        const json = await resp.json();
        const mainTrans = Array.isArray(json?.[0])
          ? json[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('').trim()
          : '';
        const extraTerms = [];
        if (Array.isArray(json?.[1])) {
          json[1].forEach((grp) => {
            if (!result.pos && typeof grp?.[0] === 'string') {
              const p = EN_POS_TO_VI[grp[0].toLowerCase()];
              if (p) result.pos = p;
            }
            if (Array.isArray(grp?.[1])) {
              grp[1].slice(0, 3).forEach((t) => {
                const s = String(t || '').trim();
                if (s && s.toLowerCase() !== mainTrans.toLowerCase() && !extraTerms.includes(s)) {
                  extraTerms.push(s);
                }
              });
            }
          });
        }
        const combined = [mainTrans, ...extraTerms.slice(0, 2)].filter(Boolean).join(', ').normalize('NFC');
        if (combined && combined.toLowerCase() !== key) {
          result.vi = combined.charAt(0).toUpperCase() + combined.slice(1);
        }
      } catch (_) {}
    })());

    // Free Dictionary API for IPA + English definition + Synonyms
    if (isSingleLike) {
      tasks.push((async () => {
        try {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 4500);
          const resp = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(key)}`, { signal: ctrl.signal });
          clearTimeout(tid);
          if (!resp.ok) return;
          const arr = await resp.json();
          const first = Array.isArray(arr) ? arr[0] : null;
          if (!first) return;
          const phon = first.phonetic || (Array.isArray(first.phonetics) ? (first.phonetics.find((p) => p?.text)?.text || '') : '');
          if (phon) result.ipa = phon;
          const m0 = Array.isArray(first.meanings) ? first.meanings[0] : null;
          if (m0) {
            if (!result.pos && m0.partOfSpeech) {
              result.pos = EN_POS_TO_VI[String(m0.partOfSpeech).toLowerCase()] || m0.partOfSpeech;
            }
            const def0 = Array.isArray(m0.definitions) ? m0.definitions[0]?.definition : '';
            if (def0) result.enDef = String(def0).trim();
            const syns = [];
            (first.meanings || []).forEach((m) => {
              (m.synonyms || []).forEach((s) => { if (s && !syns.includes(s) && s.toLowerCase() !== key) syns.push(s); });
              (m.definitions || []).forEach((d) => {
                (d.synonyms || []).forEach((s) => { if (s && !syns.includes(s) && s.toLowerCase() !== key) syns.push(s); });
              });
            });
            if (syns.length) result.synonyms = syns.slice(0, 4);
          }
        } catch (_) {}
      })());
    }

    await Promise.all(tasks);

    // Fallback to MyMemory EN->VI if Google Translate didn't return a translation
    if (!result.vi) {
      try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4500);
        const resp = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=en|vi`, { signal: ctrl.signal });
        clearTimeout(tid);
        if (resp.ok) {
          const j = await resp.json();
          const tr = String(j?.responseData?.translatedText || '').trim();
          if (tr && tr.toLowerCase() !== key && !/^MYMEMORY WARNING/i.test(tr)) {
            result.vi = tr.charAt(0).toUpperCase() + tr.slice(1);
          }
        }
      } catch (_) {}
    }

    if (result.vi || result.ipa || result.enDef) {
      setOnlineDictCache(key, result);
      return result;
    }
    return null;
  }

  function lookupWordEntry(rawWord, passage) {
    const clean = String(rawWord || '').trim().replace(/^[^a-zA-Z]+|[^a-zA-Z-]+$/g, '');
    const lower = clean.toLowerCase();
    const gloss = passage?.glossary || {};
    const appMap = getAppWordMap();
    const ipaDict = (typeof IPA_DICT !== 'undefined' ? IPA_DICT : window.IPA_DICT) || {};
    const cands = stemCandidates(lower);

    let appRec = null;
    for (const cand of cands) {
      if (appMap.has(cand)) { appRec = appMap.get(cand); break; }
    }
    const assessments = B()?.getAssessmentsMap?.() || {};
    const readingWordId = appRec?.item?.id || '';
    const readingAssess = readingWordId ? assessments[readingWordId] : 0;
    const readingMeta = appRec ? {
      inReadingList: true,
      readingListLabel: appRec.deckLabel,
      readingWordId,
      readingLemma: appRec.item.lemma || clean,
      readingStatus: readingAssess === 3 ? 'mastered' : (readingAssess > 0 ? 'learning' : 'listed')
    } : {
      inReadingList: false,
      readingListLabel: '',
      readingWordId: '',
      readingLemma: '',
      readingStatus: ''
    };

    for (const cand of cands) {
      if (gloss[cand]) {
        const g = gloss[cand];
        return {
          word: clean, lemma: cand, ipa: g.ipa || ipaDict[cand] || '', pos: g.pos || 'Từ vựng',
          vi: g.vi || '', enDef: '', synonyms: Array.isArray(g.syn) ? g.syn : [], found: true,
          ...readingMeta
        };
      }
    }
    if (appRec) {
      const cat = appRec.item;
      const syns = Array.isArray(cat.clean_synonyms) && cat.clean_synonyms.length
        ? cat.clean_synonyms.slice(0, 4)
        : (Array.isArray(cat.synonyms) ? cat.synonyms.slice(0, 4) : []);
      return {
        word: clean,
        lemma: cat.lemma || clean,
        ipa: cat.ipa || ipaDict[String(cat.lemma || lower).toLowerCase()] || '',
        pos: cat.clean_pos || cat.pos || 'Từ vựng',
        vi: cat.clean_meaning || cat.definition || '',
        enDef: '',
        synonyms: syns,
        found: true,
        ...readingMeta
      };
    }

    // Check local online-dict cache (0ms repeat lookup!)
    const cached = getCachedOnlineEntry(lower);
    if (cached) {
      return {
        word: clean,
        lemma: clean,
        ipa: cached.ipa || ipaDict[lower] || '',
        pos: cached.pos || (clean.includes(' ') ? 'Cụm từ' : 'Từ vựng'),
        vi: cached.vi || '',
        enDef: cached.enDef || '',
        synonyms: Array.isArray(cached.synonyms) ? cached.synonyms : [],
        found: !!cached.vi,
        ...readingMeta
      };
    }

    return {
      word: clean,
      lemma: clean,
      ipa: ipaDict[lower] || '',
      pos: clean.includes(' ') ? 'Cụm từ' : (clean.includes('-') ? 'Từ ghép' : 'Từ vựng'),
      vi: '',
      enDef: '',
      synonyms: [],
      found: false,
      needsOnline: true,
      ...readingMeta
    };
  }

  /* =========================================================
     3. READING PRACTICE APP CONTROLLER
     ========================================================= */
  const state = {
    view: 'portal',         // 'portal' | 'source' | 'exam'
    source: 'cambridge',    // 'cambridge' | 'volume' | 'actual' | 'news'
    camGroup: 'recent',     // 'recent' (Cam 10-20) | 'classic' (Cam 1-9)
    actualTab: 'p1',        // 'p1' | 'p2' | 'p3' | 'full'
    actualQType: '',        // '' | 'tfng' | 'ynng' | 'gap' | 'select' | 'mcq'
    actualFilterOpen: false,
    actualPage: 1,
    selectedBookId: 'cam_20',
    selectedTestNum: 1,     // 1..4
    partFilter: 'all',      // 'all' | 'p1' | 'p2' | 'p3' | 'full'
    newsTopic: 'all',
    searchQuery: '',
    loadingBank: null,

    session: null,
    timerId: null,
    dictTarget: null,
    splitRatio: 50,
    mobilePane: 'passage',
    selectedHeadingKey: null, // for tap-to-assign Matching Headings on touch/click
    pendingSelection: null    // cached selection ranges so native selection clears before Edge Mini Menu pops
  };

  let _acGuard = null;
  let _acTabSession = null;
  let _acDomBound = false;
  let _acCountdownId = null;
  let _applyingLiveRemote = false;
  let _lastLiveFocusTs = 0;
  let _liveFocusToastTimer = null;

  function isTeacherBypass() {
    try {
      const bridge = B();
      if (bridge?.isTeacherUser?.() || bridge?.isTeacherMode?.() || bridge?.isTeacherPreviewing?.()) return true;
      const u = bridge?.getCurrentUser?.();
      const role = String(u?.role || '').trim().toLowerCase();
      if (role === 'teacher' || role === 'admin') return true;
      const uid = getUid();
      if (uid === 'giaovien' || uid === 'teacher' || uid === 'admin') return true;
    } catch (_) {}
    return false;
  }

  function isReadingAntiCheatActive() {
    const s = state.session;
    if (state.view !== 'exam' || !s || s.mode !== 'exam' || s.isNews || s.liveRoomId) return false;
    if (isTeacherBypass()) return false;
    return true;
  }

  function formatClockHHMM(ts) {
    try {
      const dt = new Date(ts);
      return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
    } catch (_) {
      return '--:--';
    }
  }

  function formatLockCountdown(ms) {
    const totalSec = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function stopAcLockCountdown() {
    if (_acCountdownId) {
      clearInterval(_acCountdownId);
      _acCountdownId = null;
    }
  }

  function startAcLockCountdown() {
    stopAcLockCountdown();
    const tick = () => {
      const info = ReadingPracticeStore.getLockoutInfo();
      const modalCd = document.getElementById('rp-ac-modal-countdown');
      const bannerCd = document.getElementById('rp-lock-banner-countdown');
      if (!info) {
        stopAcLockCountdown();
        if (modalCd) modalCd.textContent = '00:00';
        const banner = document.getElementById('rp-lock-hub-banner');
        if (banner) banner.remove();
        return;
      }
      const txt = formatLockCountdown(info.remainingMs);
      if (modalCd) modalCd.textContent = txt;
      if (bannerCd) bannerCd.textContent = txt;
    };
    tick();
    _acCountdownId = setInterval(tick, 1000);
  }

  function ensureAntiCheatModalEl() {
    let el = document.getElementById('rp-ac-modal');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'rp-ac-modal';
    el.className = 'rp-ac-modal-overlay';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'rp-ac-modal-title');
    el.addEventListener('click', (ev) => {
      if (ev.target === el) closeAntiCheatModal();
    });
    document.body.appendChild(el);
    return el;
  }

  function closeAntiCheatModal() {
    const el = document.getElementById('rp-ac-modal');
    if (el) {
      el.classList.remove('open');
    }
  }

  function showAntiCheatModal(opts = {}) {
    if (typeof document === 'undefined') return;
    const el = ensureAntiCheatModalEl();
    const isLock = opts.level === 'lock';
    const badgeText = opts.badge || (isLock ? 'VI PHẠM 2/2 · KHÓA 30 PHÚT' : 'CẢNH CÁO 1/2');
    const titleText = opts.title || (isLock ? 'Bài làm đã kết thúc & Tạm khóa 30 phút' : 'Cảnh cáo chống gian lận');
    const ctaText = opts.ctaLabel || (isLock ? 'Đã hiểu' : 'Tôi đã hiểu · Quay lại làm bài');
    const reasonText = opts.reason || 'Chuyển tab khi đang làm bài';

    const iconSvg = isLock
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1.3" fill="currentColor" stroke="none"/></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3L21 19H3L12 3Z"/><path d="M12 9.5V13.5"/><circle cx="12" cy="16.5" r="0.9" fill="currentColor" stroke="none"/></svg>`;

    let metricsHtml = '';
    if (isLock) {
      const unlockClock = opts.until ? formatClockHHMM(opts.until) : '--:--';
      const cdInit = opts.remainingMs ? formatLockCountdown(opts.remainingMs) : '30:00';
      const hasScore = typeof opts.score === 'number' && typeof opts.total === 'number' && opts.total > 0;
      metricsHtml = `
        <div class="rp-ac-stats ${hasScore ? '' : 'is-single'}">
          ${hasScore ? `
            <div class="rp-ac-stat">
              <span class="rp-ac-stat-label">Kết quả</span>
              <strong class="rp-ac-stat-val tabular" style="font-size:19px;">${opts.score} <span class="rp-exit-metric-total">/ ${opts.total} câu</span></strong>
            </div>
          ` : ''}
          <div class="rp-ac-stat is-lock-time">
            <span class="rp-ac-stat-label">Mở khóa lúc ${esc(unlockClock)}</span>
            <strong class="rp-ac-stat-val tabular" id="rp-ac-modal-countdown">${esc(cdInit)}</strong>
          </div>
        </div>
      `;
    }

    const bodyHtml = isLock
      ? `
        <p class="rp-ac-desc">
          Hệ thống ghi nhận vi phạm <strong>2/2 (${esc(reasonText)})</strong>.
          ${opts.isReblocked
            ? 'Tính năng luyện đề Reading hiện đang bị tạm khóa và sẽ tự mở lại khi hết thời gian chờ.'
            : 'Toàn bộ đáp án bạn đã điền được <strong>giữ nguyên để chấm điểm</strong> (không bị xóa), lượt làm đã kết thúc và khóa luyện đề trong <strong>30 phút</strong>.'}
        </p>
      `
      : `
        <p class="rp-ac-desc">
          Hệ thống phát hiện bạn vừa rời khỏi màn hình làm bài (<strong>${esc(reasonText)}</strong>).
        </p>
        <div class="rp-ac-callout">
          Đáp án hiện tại của bạn vẫn được giữ nguyên. Nếu vi phạm thêm <strong>1 lần nữa (2/2)</strong>, bài làm sẽ <strong>kết thúc, chấm điểm ngay</strong> và khóa luyện đề trong <strong>30 phút</strong>.
        </div>
      `;

    el.innerHTML = `
      <div class="rp-ac-modal-card ${isLock ? 'is-lock' : 'is-warn'}" onclick="event.stopPropagation()">
        <div class="rp-ac-modal-top">
          <div class="rp-ac-emblem ${isLock ? 'is-lock' : 'is-warn'}">${iconSvg}</div>
          <div class="rp-ac-head-copy">
            <span class="rp-ac-pill ${isLock ? 'is-lock' : 'is-warn'}">${esc(badgeText)}</span>
            <h3 class="rp-ac-title" id="rp-ac-modal-title">${esc(titleText)}</h3>
          </div>
        </div>
        <div class="rp-ac-modal-body">
          ${metricsHtml}
          ${bodyHtml}
        </div>
        <div class="rp-ac-modal-foot">
          <button type="button" class="btn ${isLock ? 'btn-subtle' : 'btn-primary'} rp-ac-cta" id="rp-ac-modal-ok" onclick="ReadingPracticeApp.closeAntiCheatModal()">${esc(ctaText)}</button>
        </div>
      </div>
    `;
    el.classList.add('open');
    if (isLock) startAcLockCountdown();
    setTimeout(() => {
      document.getElementById('rp-ac-modal-ok')?.focus?.();
    }, 30);
  }

  function handleReadingAntiCheatStrike(strikeNum, reason) {
    const s = state.session;
    if (!s || !isReadingAntiCheatActive()) return;
    const cleanReason = reason || 'Chuyển tab khi đang làm bài';
    s.antiCheatStrikes = strikeNum;
    if (strikeNum === 1) {
      s.antiCheatNotice = `Cảnh cáo chống gian lận (1/2 — ${cleanReason}): Vi phạm thêm 1 lần nữa phòng làm bài sẽ tạm khóa 30 phút (tiến trình bài làm vẫn được giữ nguyên).`;
      persistDraft();
      renderExamWorkspace();
      showAntiCheatModal({
        level: 'warn',
        badge: 'CẢNH CÁO 1/2',
        title: 'Không chuyển tab khi đang làm bài',
        reason: cleanReason,
        ctaLabel: 'Tôi đã hiểu · Quay lại làm bài'
      });
    } else {
      // Strike 2: PRESERVE 100% of student answers/highlights/notes/timer so they can resume after unlock/cooldown!
      const itemTitle = s.title;
      const itemId = s.itemId;
      s.antiCheatStrikes = 0;
      s.antiCheatNotice = '';
      persistDraft();

      stopTimer();
      stopReadingAntiCheat();

      const lockInfo = ReadingPracticeStore.setLockout(ANTI_CHEAT_LOCKOUT_MINS, {
        reason: cleanReason,
        title: itemTitle,
        itemId
      });

      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();

      showAntiCheatModal({
        level: 'lock',
        badge: 'VI PHẠM 2/2 · TẠM KHÓA 30 PHÚT',
        title: 'Đã lưu tiến trình & Tạm khóa 30 phút',
        reason: `${cleanReason} — Toàn bộ đáp án và ghi chú của bạn đã được lưu nguyên vẹn. Sau khi hết 30 phút hoặc được Giáo viên mở khóa, hãy vào lại đề này để làm tiếp!`,
        until: lockInfo.until,
        remainingMs: ANTI_CHEAT_LOCKOUT_MINS * 60 * 1000,
        ctaLabel: 'Đã hiểu'
      });
    }
  }

  function isReadingPracticeExamOpen() {
    const s = state.session;
    return state.view === 'exam' && !!s && s.mode === 'exam' && !s.isNews && !s.liveRoomId;
  }

  function bindGlobalReadingAntiCheatDom() {
    if (_acDomBound || typeof document === 'undefined') return;
    _acDomBound = true;

    // CD-IELTS Practice & Exam mode ALLOWS Copy/Cut/Paste (like official Inspera CD-IELTS)
    // while DISABLING browser Find (Ctrl+F / Cmd+F / F3 / Ctrl+G) during active Reading sessions!
    document.addEventListener('keydown', (e) => {
      if (!isReadingPracticeExamOpen()) return;
      const k = (e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;

      // Always block Ctrl+F / Cmd+F / F3 / Ctrl+G in active Reading Practice & Exam (authentic CD-IELTS)
      if ((ctrl && (k === 'f' || k === 'g')) || e.key === 'F3') {
        e.preventDefault();
        e.stopPropagation();
        toast('Chế độ Reading Practice khóa Ctrl+F chuẩn thi CD-IELTS — hãy dùng Skimming & Scanning nhé!');
        return;
      }

      if (!isReadingAntiCheatActive()) return;
      if (e.key === 'F12' || (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (ctrl && ['u', 'p'].includes(k))) {
        e.preventDefault();
        toast('Chống gian lận: Phím tắt này bị khóa trong lúc làm bài.');
      }
    }, true);
  }

  function startReadingAntiCheat() {
    bindGlobalReadingAntiCheatDom();
    stopReadingAntiCheat();
    if (!isReadingAntiCheatActive()) return;
    if (typeof window.CoreAntiCheatGuard === 'function') {
      if (!_acGuard) {
        _acGuard = new window.CoreAntiCheatGuard({
          isBypassed: () => !isReadingAntiCheatActive(),
          showToast: (m) => toast(m)
        });
      }
      if (window.CoreAntiCheatGuard.resetSoftBlurBudget) {
        window.CoreAntiCheatGuard.resetSoftBlurBudget();
      }
      _acTabSession = _acGuard.createTabLeaveSession({
        maxStrikes: 2,
        onStrike1: (n, reason) => handleReadingAntiCheatStrike(n, reason),
        onStrike2: (n, reason) => handleReadingAntiCheatStrike(n, reason)
      });
      _acTabSession.start();
    }
  }

  function stopReadingAntiCheat() {
    if (_acTabSession) {
      try { _acTabSession.stop(); } catch (_) {}
      _acTabSession = null;
    }
  }

  const BANK_VERSION = '20261126a';
  const SOL_VERSION = '20261125a';
  const _loadedBanks = {};
  const _bankPromises = {};
  const _loadedSolutions = {};
  const _solutionPromises = {};

  function ensureSourceSolutionsLoaded(src) {
    if (!['cambridge', 'volume', 'actual'].includes(src)) return Promise.resolve();
    if (_loadedSolutions[src]) return Promise.resolve();
    if (window.__READING_SOLUTIONS__ && window.__READING_SOLUTIONS__[src]) {
      _loadedSolutions[src] = true;
      return Promise.resolve();
    }
    if (_solutionPromises[src]) return _solutionPromises[src];

    const base = (typeof window.__APP_BASE_PATH__ === 'string' && window.__APP_BASE_PATH__) ? `${window.__APP_BASE_PATH__}/` : '';
    const scriptSrc = `${base}data/solutions_${src}.js?v=${SOL_VERSION}`;
    _solutionPromises[src] = new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = scriptSrc;
      sc.async = true;
      sc.onload = () => {
        _loadedSolutions[src] = true;
        resolve();
      };
      sc.onerror = () => {
        resolve();
      };
      document.head.appendChild(sc);
    });
    return _solutionPromises[src];
  }

  function getQuestionSolution(passage, qNum) {
    if (!passage || !passage.id) return null;
    const src = passage.source || '';
    const bankSol = window.__READING_SOLUTIONS__?.[src];
    if (!bankSol) return null;
    const pSol = bankSol[passage.id];
    if (!pSol) return null;
    return pSol[String(qNum)] || null;
  }

  /* ---------- SMART 4-TIER EVIDENCE LOCATOR (100% Locate Coverage) ---------- */
  const LOC_STOP_WORDS = new Set([
    'the','a','an','is','are','was','were','be','been','being','have','has','had',
    'do','does','did','will','would','could','should','may','might','must','can',
    'to','of','in','on','at','for','with','by','from','as','into','through','about',
    'between','after','before','under','over','above','below','and','or','but','nor',
    'so','yet','if','then','than','that','this','these','those','it','its','they',
    'them','their','he','him','his','she','her','we','us','our','you','your','not',
    'no','only','more','most','some','any','all','each','every','one','two','such',
    'very','also','when','where','which','who','whom','whose','what','why','how',
    'there','here','many','much','other','another','first','second','third','used',
    'make','made','often','people','person','article','passage','writer','author',
    'text','following','information','paragraph','section','statement','true','false',
    'given','yes','choose','correct','letter','box','answer','sheet','words','number'
  ]);
  const _autoLocCache = new Map();

  function splitParagraphSentencesWithOffsets(text) {
    const raw = String(text || '');
    if (!raw.trim()) return [];
    const sents = [];
    let start = 0;
    const abbrevRe = /\b(?:Dr|Mr|Mrs|Ms|Prof|St|Sr|Jr|vs|etc|eg|ie|e\.g|i\.e|Fig|No|Vol|p|pp|U\.S|U\.K|St)\.$/i;
    const len = raw.length;
    for (let i = 0; i < len; i++) {
      const ch = raw[i];
      if (ch === '.' || ch === '!' || ch === '?') {
        const next = raw[i + 1] || '';
        const next2 = raw[i + 2] || '';
        // Skip decimals like 3.5 or abbreviations like Dr. / U.S.
        if (ch === '.' && /\d/.test(raw[i - 1] || '') && /\d/.test(next)) continue;
        if (ch === '.' && abbrevRe.test(raw.slice(Math.max(0, i - 10), i + 1))) continue;
        const isEnd = i === len - 1 || (/\s/.test(next) && (!next2 || /[A-Z0-9“"‘'(]/.test(next2)));
        if (isEnd) {
          let s = start;
          let e = i + 1;
          // Include trailing closing quote if immediately following punctuation
          if (raw[e] === '"' || raw[e] === '”' || raw[e] === "'" || raw[e] === '’') e++;
          while (s < e && /\s/.test(raw[s])) s++;
          while (e > s && /\s/.test(raw[e - 1])) e--;
          if (e - s >= 6) {
            const sub = raw.slice(s, e);
            sents.push({ start: s, end: e, text: sub, lower: sub.toLowerCase() });
          }
          start = e;
        }
      }
    }
    if (start < len) {
      let s = start;
      let e = len;
      while (s < e && /\s/.test(raw[s])) s++;
      while (e > s && /\s/.test(raw[e - 1])) e--;
      if (e - s >= 6) {
        const sub = raw.slice(s, e);
        sents.push({ start: s, end: e, text: sub, lower: sub.toLowerCase() });
      }
    }
    if (!sents.length && raw.trim().length) {
      sents.push({ start: 0, end: raw.length, text: raw, lower: raw.toLowerCase() });
    }
    return sents;
  }

  function extractLocatorTokens(str) {
    const raw = String(str || '').replace(/_{2,}|\[\s*\.\.\.\s*\]/g, ' ');
    const matches = raw.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) || [];
    const out = [];
    for (const m of matches) {
      const low = m.toLowerCase();
      const isNum = /^\d+$/.test(m);
      if (!isNum && (low.length < 3 || LOC_STOP_WORDS.has(low))) continue;
      const isCap = !isNum && /^[A-Z][a-z]{2,}/.test(m);
      out.push({ raw: m, low, stem: low.length >= 5 ? low.slice(0, low.length - 2) : low, isNum, isCap });
    }
    return out;
  }

  function findQuoteInPassage(passage, quote) {
    const cleanQ = String(quote || '').replace(/^[“"'\s]+|[”"'\s]+$/g, '').trim();
    if (!cleanQ || cleanQ.length < 8) return null;
    const paras = passage?.paragraphs || [];
    const segments = cleanQ.split(/\s*(?:\.{3,}|…)\s*/).map((s) => s.trim()).filter((s) => s.length >= 12);
    const probes = segments.length ? [cleanQ, ...segments.sort((a, b) => b.length - a.length)] : [cleanQ];

    for (const probe of probes) {
      const normProbe = probe.toLowerCase().replace(/\s+/g, ' ');
      for (let pIdx = 0; pIdx < paras.length; pIdx++) {
        const raw = String(paras[pIdx]?.en || '');
        const idx = raw.toLowerCase().indexOf(normProbe);
        if (idx >= 0) {
          return [pIdx, idx, Math.min(raw.length, idx + normProbe.length)];
        }
      }
    }
    // Fallback: best overlapping sentence with quote tokens
    const qToks = extractLocatorTokens(cleanQ);
    if (!qToks.length) return null;
    let best = null;
    for (let pIdx = 0; pIdx < paras.length; pIdx++) {
      const sents = splitParagraphSentencesWithOffsets(paras[pIdx]?.en || '');
      for (const sent of sents) {
        let hits = 0;
        for (const t of qToks) {
          if (sent.lower.includes(t.low)) hits += 2;
          else if (t.stem.length >= 4 && sent.lower.includes(t.stem)) hits += 1;
        }
        const score = hits / Math.max(1, qToks.length);
        if (score >= 0.45 && (!best || score > best.score)) {
          best = { pIdx, start: sent.start, end: sent.end, score };
        }
      }
    }
    return best ? [best.pIdx, best.start, best.end] : null;
  }

  function findQuestionGroupFor(passage, qNum) {
    for (const g of (passage?.groups || [])) {
      if ((g.questions || []).some((x) => Number(x.num) === Number(qNum))) return g;
    }
    return null;
  }

  function resolveQuestionEvidenceLoc(passage, q, sol) {
    if (!passage || !q) return null;
    const paras = passage.paragraphs || [];
    if (!paras.length) return null;

    // Tier 2: Verified pre-authored solution coordinates
    if (Array.isArray(sol?.loc) && sol.loc.length === 3) {
      const p = Number(sol.loc[0]);
      const st = Number(sol.loc[1]);
      const en = Number(sol.loc[2]);
      const raw = String(paras[p]?.en || '');
      if (raw && st >= 0 && en > st && en <= raw.length) {
        return { loc: [p, st, en], source: 'verified' };
      }
    }

    // Tier 3: Match solution quote inside passage paragraphs
    if (sol?.quote) {
      const qLoc = findQuoteInPassage(passage, sol.quote);
      if (qLoc) return { loc: qLoc, source: 'quote' };
    }

    // Tier 4: Deterministic smart auto-locator (memoized per passage + question)
    const cacheKey = `${passage.id}__q${q.num}`;
    if (_autoLocCache.has(cacheKey)) return _autoLocCache.get(cacheKey);

    const group = findQuestionGroupFor(passage, q.num);
    const allQs = getAllQuestionsInPassage(passage);
    const qIdxInPassage = Math.max(0, allQs.findIndex((x) => Number(x.num) === Number(q.num)));
    const qRelPos = allQs.length > 1 ? qIdxInPassage / (allQs.length - 1) : 0.5;

    // Helper: detect paragraph letter label from para.label OR leading "A " / "D. " inside para.en
    const getParaLetter = (para) => {
      const explicit = String(para?.label || '').trim().toUpperCase();
      if (/^[A-L]$/.test(explicit)) return explicit;
      const m = String(para?.en || '').trim().match(/^([A-L])(?:[\s.:)\-–]+)(?=[A-Z“"‘'(])/);
      return m ? m[1] : '';
    };

    // Build sentence index across all paragraphs
    const allSents = [];
    const docFreq = new Map();
    paras.forEach((para, pIdx) => {
      const pLbl = getParaLetter(para);
      const sents = splitParagraphSentencesWithOffsets(para?.en || '');
      sents.forEach((st, sIdx) => {
        const uniq = new Set((st.lower.match(/[a-z0-9]{3,}/g) || []));
        uniq.forEach((w) => docFreq.set(w, (docFreq.get(w) || 0) + 1));
        allSents.push({
          pIdx,
          sIdx,
          paraLabel: pLbl,
          start: st.start,
          end: st.end,
          text: st.text,
          lower: st.lower
        });
      });
    });
    if (!allSents.length) return null;

    // Detect if answer/question directly targets a labeled paragraph (Matching Headings / Paragraph Info Matching)
    let targetParaIdx = -1;
    if (q.sectionLabel) {
      const lbl = String(q.sectionLabel).trim().toUpperCase();
      targetParaIdx = paras.findIndex((p) => getParaLetter(p) === lbl);
    } else if (q.type === 'select') {
      const ansLetter = String(Array.isArray(q.answer) ? q.answer[0] : q.answer || '').trim().toUpperCase();
      const paraLabels = new Set(paras.map((p) => getParaLetter(p)).filter(Boolean));
      const groupHay = `${group?.title || ''} ${group?.instruction || ''}`;
      const isParaMatch = paraLabels.size >= 3 && paraLabels.has(ansLetter) &&
        (/\b(paragraph|section|part)\b/i.test(groupHay) || !/\b(person|people|researcher|scientist|writer|expert|list of)\b/i.test(groupHay));
      if (isParaMatch) {
        targetParaIdx = paras.findIndex((p) => getParaLetter(p) === ansLetter);
      }
    }

    const candidateSents = targetParaIdx >= 0
      ? allSents.filter((x) => x.pIdx === targetParaIdx)
      : allSents;
    const pool = candidateSents.length ? candidateSents : allSents;

    // Gather answer terms & extra semantic cues
    const answerList = Array.isArray(q.answer) ? q.answer : (q.answer != null ? [q.answer] : []);
    const cleanAnswers = answerList.map((a) => String(a || '').replace(/[()]/g, '').trim()).filter(Boolean);
    let extraText = '';
    if (q.type === 'mcq' && Array.isArray(q.options)) {
      const key = String(cleanAnswers[0] || '').toUpperCase();
      const opt = q.options.find((o) => String(o?.key || '').toUpperCase() === key);
      if (opt?.text) extraText += ' ' + opt.text;
    } else if (group?.type === 'matching_headings' && Array.isArray(group.headings)) {
      const key = String(cleanAnswers[0] || '').toLowerCase();
      const hd = group.headings.find((h) => String(h?.key || '').toLowerCase() === key);
      if (hd?.text) extraText += ' ' + hd.text;
    } else if (q.type === 'select' && targetParaIdx < 0 && group?.instruction) {
      const key = String(cleanAnswers[0] || '').toUpperCase();
      const lineRe = new RegExp(`(?:^|\\n)\\s*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s.:\\-–]+([^\\n]+)`, 'i');
      const m = String(group.instruction).match(lineRe);
      if (m && m[1]) extraText += ' ' + m[1];
    }

    const promptToks = extractLocatorTokens(q.prompt || '');
    const extraToks = extractLocatorTokens(extraText);
    const totalSentCount = allSents.length;
    const isOrderedType = ['gap', 'tfng', 'ynng', 'mcq'].includes(q.type);
    const isGapType = q.type === 'gap';

    let best = null;
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i];
      let score = 0;

      // Exact gap answer match is the strongest signal in IELTS Reading
      if (isGapType) {
        for (const ans of cleanAnswers) {
          const lowAns = ans.toLowerCase();
          if (lowAns.length < 2) continue;
          const escAns = lowAns.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const wordRe = new RegExp(`\\b${escAns}\\b`, 'i');
          if (wordRe.test(s.text)) {
            score += 18;
            break;
          }
          if (s.lower.includes(lowAns)) {
            score += 11;
            break;
          }
          const ansWords = lowAns.split(/\s+/).filter((w) => w.length >= 3);
          if (ansWords.length > 1 && ansWords.every((w) => s.lower.includes(w))) {
            score += 13;
            break;
          }
        }
      }

      // Prompt tokens weighted by inverse document frequency
      for (const t of promptToks) {
        const df = docFreq.get(t.low) || 1;
        const idf = Math.max(0.5, Math.log((totalSentCount + 1) / (df + 0.5)));
        if (t.isNum) {
          if (s.lower.includes(t.low)) score += 5.5 * idf;
        } else if (s.lower.includes(t.low)) {
          score += (t.isCap ? 3.8 : 2.5) * idf;
        } else if (t.stem.length >= 4 && s.lower.includes(t.stem)) {
          score += 1.4 * idf;
        }
      }

      // Extra semantic tokens (MCQ correct option / Matching heading / Person name)
      for (const t of extraToks) {
        const df = docFreq.get(t.low) || 1;
        const idf = Math.max(0.5, Math.log((totalSentCount + 1) / (df + 0.5)));
        if (s.lower.includes(t.low)) {
          score += (t.isCap ? 4.2 : 2.8) * idf;
        } else if (t.stem.length >= 4 && s.lower.includes(t.stem)) {
          score += 1.3 * idf;
        }
      }

      // Gentle order prior for sequential IELTS Reading question types
      if (isOrderedType && targetParaIdx < 0) {
        const globalIdx = allSents.indexOf(s);
        const sentRelPos = totalSentCount > 1 ? globalIdx / (totalSentCount - 1) : 0.5;
        score += 1.1 * (1 - Math.abs(qRelPos - sentRelPos));
      } else if (targetParaIdx >= 0 && s.sIdx === 0) {
        // Topic sentence tie-breaker inside a matched paragraph
        score += 0.35;
      }

      if (!best || score > best.score) {
        best = { pIdx: s.pIdx, start: s.start, end: s.end, score };
      }
    }

    const result = best ? { loc: [best.pIdx, best.start, best.end], source: 'auto' } : null;
    if (result) _autoLocCache.set(cacheKey, result);
    return result;
  }

  function mergeBankPayload(src, payload) {
    if (!payload) return;
    const d = DATA();
    if (!d.PASSAGES) d.PASSAGES = {};
    if (!d.FULL_TESTS) d.FULL_TESTS = [];
    if (payload.PASSAGES) {
      Object.keys(payload.PASSAGES).forEach((pid) => {
        if (!d.PASSAGES[pid]) d.PASSAGES[pid] = payload.PASSAGES[pid];
      });
    }
    if (Array.isArray(payload.FULL_TESTS)) {
      const existing = new Set(d.FULL_TESTS.map((f) => f.id));
      payload.FULL_TESTS.forEach((ft) => {
        if (ft && ft.id && !existing.has(ft.id)) {
          d.FULL_TESTS.push(ft);
          existing.add(ft.id);
        }
      });
    }
    _loadedBanks[src] = true;
  }

  function ensureSourceBankLoaded(src) {
    if (!['cambridge', 'volume', 'actual'].includes(src)) return Promise.resolve();
    if (_loadedBanks[src]) return Promise.resolve();
    if (window.__READING_BANKS__ && window.__READING_BANKS__[src]) {
      mergeBankPayload(src, window.__READING_BANKS__[src]);
      return Promise.resolve();
    }
    if (_bankPromises[src]) return _bankPromises[src];

    state.loadingBank = src;
    const base = (typeof window.__APP_BASE_PATH__ === 'string' && window.__APP_BASE_PATH__) ? `${window.__APP_BASE_PATH__}/` : '';
    const scriptSrc = `${base}data/bank_${src}.js?v=${BANK_VERSION}`;
    _bankPromises[src] = new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = scriptSrc;
      sc.async = true;
      sc.onload = () => {
        if (window.__READING_BANKS__ && window.__READING_BANKS__[src]) {
          mergeBankPayload(src, window.__READING_BANKS__[src]);
        }
        if (state.loadingBank === src) state.loadingBank = null;
        resolve();
      };
      sc.onerror = () => {
        if (state.loadingBank === src) state.loadingBank = null;
        resolve();
      };
      document.head.appendChild(sc);
    });
    return _bankPromises[src];
  }

  function getRoot() { return document.getElementById('rp-app-root'); }

  function isAnswerCorrect(q, userVal) {
    const raw = String(userVal ?? '').trim();
    if (!raw) return false;
    if (Array.isArray(q.answer)) {
      const low = raw.toLowerCase().replace(/\s+/g, ' ');
      return q.answer.some((a) => String(a).trim().toLowerCase() === low);
    }
    return raw.toLowerCase() === String(q.answer).trim().toLowerCase();
  }

  function getAllQuestionsInPassage(p) {
    const out = [];
    (p?.groups || []).forEach((g) => (g.questions || []).forEach((q) => out.push(q)));
    return out;
  }

  function getPassageTypes(p) {
    const set = new Set();
    getAllQuestionsInPassage(p).forEach((q) => set.add(qTypeLabel(q.type)));
    return Array.from(set);
  }

  function getSessionPassages() {
    if (!state.session) return [];
    const map = DATA().PASSAGES || {};
    return state.session.passageIds.map((pid) => map[pid]).filter(Boolean);
  }

  function getAllSessionQuestions() {
    const all = [];
    getSessionPassages().forEach((p, pIdx) => {
      getAllQuestionsInPassage(p).forEach((q) => {
        all.push({ ...q, _pIdx: pIdx, _passageId: p.id, _qid: `${p.id}__q${q.num}` });
      });
    });
    return all;
  }

  function getBooksForSource(src) {
    const d = DATA();
    if (src === 'cambridge') return d.CAMBRIDGE_BOOKS || [];
    if (src === 'volume') return d.VOLUME_BOOKS || [];
    if (src === 'actual') return d.ACTUAL_YEARS || [];
    return [];
  }

  function countReadyTestsInBook(bookId) {
    const d = DATA();
    const ps = Object.values(d.PASSAGES || {}).filter((p) => p.bookId === bookId);
    const tNums = new Set(ps.map((p) => p.testNum || 1));
    return tNums.size;
  }

  function getBookTestStatusMap(bookId) {
    const d = DATA();
    const ps = Object.values(d.PASSAGES || {}).filter((p) => p.bookId === bookId);
    const fts = (d.FULL_TESTS || []).filter((t) => t.bookId === bookId);
    const map = {};
    for (let t = 1; t <= 4; t++) {
      const testPs = ps.filter((p) => (p.testNum || 1) === t);
      const testFt = fts.find((f) => (f.testNum || 1) === t);
      const hasData = testPs.length > 0 || !!testFt;
      const done = hasData && (
        (testFt && !!ReadingPracticeStore.getBestAttempt(testFt.id)) ||
        (testPs.length > 0 && testPs.every((p) => !!ReadingPracticeStore.getBestAttempt(p.id)))
      );
      map[t] = { hasData, done };
    }
    return map;
  }

  /* ---------- ARTISAN TOTORO / GHIBLI BOOK PROFILES (Unique color, binding, motif & review per book!) ---------- */
  const BOOK_MOTIFS = {
    totoro: '<svg viewBox="0 0 40 40" fill="none"><path d="M12 16L9.5 7.5L15.5 12.5C18.2 11.7 21.8 11.7 24.5 12.5L30.5 7.5L28 16C31.5 19 33.5 23.5 33 29C32.5 34.5 27.5 37.5 20 37.5C12.5 37.5 7.5 34.5 7 29C6.5 23.5 8.5 19 12 16Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="15.5" cy="21" r="1.5" fill="currentColor"/><circle cx="24.5" cy="21" r="1.5" fill="currentColor"/><path d="M14 29.5L16.5 27.5L19 29.5M21 29.5L23.5 27.5L26 29.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    umbrella: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 5V9M6 21C9 12 14 9 20 9C26 9 31 12 34 21C30.5 19 27 19 24 20.5C21.5 19 18.5 19 16 20.5C13 19 9.5 19 6 21Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 20V33C20 35 22 36 23.5 34.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    acorn: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 6V11M10 18C10 13 14.5 10.5 20 10.5C25.5 10.5 30 13 30 18H10Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M12.5 18C12.5 27 15.8 32.5 20 34.5C24.2 32.5 27.5 27 27.5 18" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M15 12L17 17M20 11V17M25 12L23 17" stroke="currentColor" stroke-width="1.2" opacity="0.65"/></svg>',
    soot: '<svg viewBox="0 0 40 40" fill="none"><circle cx="20" cy="21" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M20 7V11M20 31V35M6 21H10M30 21H34M10 11L13 14M27 28L30 31M30 11L27 14M13 28L10 31" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17" cy="20" r="1.6" fill="currentColor"/><circle cx="23" cy="20" r="1.6" fill="currentColor"/></svg>',
    moon: '<svg viewBox="0 0 40 40" fill="none"><path d="M26 28.5C19.5 28.5 14.5 23.5 14.5 17C14.5 13 16.5 9.5 19.5 7.5C13 8.5 8.5 14 8.5 20.5C8.5 27.5 14.2 33 21.2 33C25.5 33 29.2 31 31.5 27.8C29.8 28.3 28 28.5 26 28.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M28 9L29 12L32 13L29 14L28 17L27 14L24 13L27 12L28 9Z" fill="currentColor"/></svg>',
    leaf: '<svg viewBox="0 0 40 40" fill="none"><path d="M9 32C11 20 18 11 32 8C29 21 21 29 9 32Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M9 32L24 16M16 24L22 23M19 20L18 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    lantern: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 5V9M15 9H25M15 31H25M20 31V35" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><rect x="12" y="9" width="16" height="22" rx="7" stroke="currentColor" stroke-width="1.8"/><path d="M12 16H28M12 24H28" stroke="currentColor" stroke-width="1.3" opacity="0.7"/></svg>',
    ginkgo: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 35V24M20 24C12 23 7 17 8 10C13 9 17 11 20 15C23 11 27 9 32 10C33 17 28 23 20 24Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M20 24L14 14M20 24L26 14" stroke="currentColor" stroke-width="1.2" opacity="0.65"/></svg>',
    crane: '<svg viewBox="0 0 40 40" fill="none"><path d="M7 22L20 18L33 12L24 23L29 31L18 25L9 29L15 22L7 22Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    fern: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 35V8M20 14L13 10M20 14L27 10M20 20L11 16M20 20L29 16M20 26L12 22M20 26L28 22" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tree: '<svg viewBox="0 0 40 40" fill="none"><path d="M20 35V23M14 35H26" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M11 23C8 22 7 18 9 15C9 11 13 8 17 9C19 6 24 6 26 9C30 9 32 12 31 16C33 18 32 22 29 23H11Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    wave: '<svg viewBox="0 0 40 40" fill="none"><path d="M6 25C10 20 14 20 18 25C22 30 26 30 34 23M6 17C11 12 16 12 21 17C25 21 29 21 34 16" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  const CAM_BOOK_PROFILES = {
    20: { cover: '#2B5B44', spine: '#1C3F2E', ribbon: '#EBC066', bind: 'frame', motif: 'totoro', h: 124, stars: 4, diff: 'Band 7.0–8.5', review: 'Chuẩn đề 2025 mới nhất — nổi bật chủ đề sinh thái, tâm lý nhận thức & bẫy Paraphrase tinh vi ở P3.' },
    19: { cover: '#244C6D', spine: '#17334B', ribbon: '#ECC26C', bind: 'obi', motif: 'umbrella', h: 118, stars: 4, diff: 'Band 7.0–8.5', review: 'Rất sát xu hướng thi máy 2024 — mạnh về Matching Features dài và câu hỏi YNNG ẩn ý sâu.' },
    18: { cover: '#944A32', spine: '#6B3320', ribbon: '#F2CC7B', bind: 'arch', motif: 'acorn', h: 122, stars: 4, diff: 'Band 6.5–8.0', review: 'Cân bằng học thuật & đời sống — nhiều bài kiến trúc, tâm lý và Summary Completion nâng cao.' },
    17: { cover: '#5A4471', spine: '#3E2D50', ribbon: '#E7BF75', bind: 'ribs', motif: 'moon', h: 115, stars: 3, diff: 'Band 6.5–7.5', review: 'Bộ kinh điển luyện tốc độ — câu hỏi TFNG trực diện, cực hợp bứt phá từ Band 6.5 lên 7.5.' },
    16: { cover: '#25605E', spine: '#184241', ribbon: '#EDC573', bind: 'stripe', motif: 'soot', h: 121, stars: 4, diff: 'Band 7.0–8.0', review: 'Giàu từ vựng học thuật C1 — nổi bật bài lịch sử công nghệ & Matching Headings nhiều bẫy tiêu đề.' },
    15: { cover: '#946529', spine: '#6B471A', ribbon: '#F5DA92', bind: 'obi', motif: 'ginkgo', h: 117, stars: 3, diff: 'Band 6.0–7.5', review: 'Độ khó vừa phải, mạch lập luận sáng rõ — lý tưởng để làm quen chiến thuật skim & scan.' },
    14: { cover: '#3A434D', spine: '#252B32', ribbon: '#E2C37E', bind: 'frame', motif: 'lantern', h: 123, stars: 4, diff: 'Band 6.5–8.0', review: 'Nổi tiếng với Passage 3 trừu tượng về ngôn ngữ & tâm lý — thử thách kỹ năng suy luận sắc bén.' },
    13: { cover: '#843A44', spine: '#5D262E', ribbon: '#F1C87F', bind: 'arch', motif: 'crane', h: 116, stars: 4, diff: 'Band 6.5–8.0', review: 'Tần suất cao dạng Matching Information & Multiple Choice — rèn khả năng lọc nhiễu cực tốt.' },
    12: { cover: '#4B6739', spine: '#344926', ribbon: '#ECCB7C', bind: 'ribs', motif: 'fern', h: 120, stars: 3, diff: 'Band 6.0–7.5', review: 'Chủ đề khoa học tự nhiên & khảo cổ dễ tiếp cận — phù hợp xây nền tảng đọc hiểu ổn định.' },
    11: { cover: '#734A33', spine: '#503221', ribbon: '#ECC67B', bind: 'stripe', motif: 'tree', h: 118, stars: 4, diff: 'Band 6.5–8.0', review: 'Điển hình cho cấu trúc đề Cambridge hiện đại — nhiều câu Gap-Fill biến thể từ loại khó.' },
    10: { cover: '#2C4673', spine: '#1D3052', ribbon: '#E8BE71', bind: 'frame', motif: 'wave', h: 122, stars: 3, diff: 'Band 6.0–7.5', review: 'Cột mốc khởi đầu chuỗi đề trọng tâm — câu hỏi đa dạng, rất hợp luyện trọn Full Test 60 phút.' },
    9:  { cover: '#3D6B59', spine: '#294B3E', ribbon: '#E8C06E', bind: 'obi', motif: 'leaf', h: 117, stars: 3, diff: 'Band 6.0–7.0', review: 'Văn phong cổ điển mạch lạc — phù hợp luyện độ chính xác tuyệt đối ở Passage 1 & 2.' },
    8:  { cover: '#6E4C5E', spine: '#4D3341', ribbon: '#EBC67A', bind: 'arch', motif: 'moon', h: 121, stars: 4, diff: 'Band 6.5–8.0', review: 'Chứa nhiều bài khoa học kinh điển (như Chronobiology) — từ vựng học thuật giàu tính hệ thống.' },
    7:  { cover: '#8A5638', spine: '#633C26', ribbon: '#F0CA7B', bind: 'ribs', motif: 'acorn', h: 115, stars: 3, diff: 'Band 6.0–7.0', review: 'Bố cục rõ ràng, ít bẫy lắt léo — thích hợp cho giai đoạn mới chuyển sang làm đề thật.' },
    6:  { cover: '#2B5B66', spine: '#1C3F47', ribbon: '#E6BE72', bind: 'stripe', motif: 'wave', h: 119, stars: 3, diff: 'Band 6.0–7.5', review: 'Nổi bật dạng Diagram Labelling & Flow-chart — luyện kỹ năng bám sát chi tiết kỹ thuật.' },
    5:  { cover: '#57503C', spine: '#3D3829', ribbon: '#E8C67D', bind: 'frame', motif: 'tree', h: 116, stars: 3, diff: 'Band 6.0–7.5', review: 'Nhiều bài lịch sử & giáo dục kinh điển — rất tốt để mở rộng vốn từ vựng Paraphrase gốc.' },
    4:  { cover: '#475A78', spine: '#303E55', ribbon: '#E5BF73', bind: 'obi', motif: 'crane', h: 120, stars: 3, diff: 'Band 5.5–7.0', review: 'Độ dài đoạn văn vừa tầm, câu hỏi bám sát mạch bài — thích hợp luyện phản xạ đọc nhanh.' },
    3:  { cover: '#7C4540', spine: '#572E2A', ribbon: '#EFC67D', bind: 'arch', motif: 'lantern', h: 115, stars: 3, diff: 'Band 5.5–7.0', review: 'Phong cách đề nền tảng cổ điển — giúp củng cố kỹ năng phân biệt False và Not Given.' },
    2:  { cover: '#3A634C', spine: '#264433', ribbon: '#E8C171', bind: 'ribs', motif: 'fern', h: 118, stars: 3, diff: 'Band 5.5–6.5', review: 'Ngữ liệu ngắn gọn, câu trúc trực diện — phù hợp làm nóng trước khi bước lên Cam 10–20.' },
    1:  { cover: '#5A4A63', spine: '#3E3245', ribbon: '#E4BC72', bind: 'stripe', motif: 'totoro', h: 116, stars: 2, diff: 'Band 5.5–6.5', review: 'Cuốn đầu tiên của bộ Cambridge — từ vựng cơ bản, lý tưởng cho người mới làm quen IELTS Reading.' }
  };

  const SERIES_BOOK_THEMES = [
    { cover: '#2B5B44', spine: '#1C3F2E', ribbon: '#EBC066', bind: 'frame', motif: 'totoro', h: 122 },
    { cover: '#244C6D', spine: '#17334B', ribbon: '#ECC26C', bind: 'obi', motif: 'umbrella', h: 117 },
    { cover: '#944A32', spine: '#6B3320', ribbon: '#F2CC7B', bind: 'arch', motif: 'acorn', h: 121 },
    { cover: '#5A4471', spine: '#3E2D50', ribbon: '#E7BF75', bind: 'ribs', motif: 'moon', h: 116 },
    { cover: '#25605E', spine: '#184241', ribbon: '#EDC573', bind: 'stripe', motif: 'soot', h: 123 },
    { cover: '#946529', spine: '#6B471A', ribbon: '#F5DA92', bind: 'obi', motif: 'ginkgo', h: 118 },
    { cover: '#3A434D', spine: '#252B32', ribbon: '#E2C37E', bind: 'frame', motif: 'lantern', h: 120 },
    { cover: '#843A44', spine: '#5D262E', ribbon: '#F1C87F', bind: 'arch', motif: 'crane', h: 115 },
    { cover: '#4B6739', spine: '#344926', ribbon: '#ECCB7C', bind: 'ribs', motif: 'fern', h: 122 },
    { cover: '#734A33', spine: '#503221', ribbon: '#ECC67B', bind: 'stripe', motif: 'tree', h: 117 }
  ];

  function getBookVisualMeta(bk) {
    if (!bk) {
      const p = CAM_BOOK_PROFILES[20];
      return { era: 'cam-20', brand: 'CAMBRIDGE', numText: '20', kind: 'book', featured: true, ...p };
    }
    if (bk.source === 'cambridge') {
      const n = Number(bk.num) || 1;
      const p = CAM_BOOK_PROFILES[n] || CAM_BOOK_PROFILES[20];
      return {
        era: `cam-${n}`,
        brand: 'CAMBRIDGE',
        numText: String(n),
        kind: 'book',
        featured: n >= 10,
        ...p
      };
    }
    if (bk.source === 'volume') {
      const v = Number(bk.num) || 1;
      const th = SERIES_BOOK_THEMES[(v - 1) % SERIES_BOOK_THEMES.length];
      return {
        era: `vol-${v}`,
        brand: 'REAL VOL',
        numText: String(v).padStart(2, '0'),
        kind: 'volume',
        featured: v <= 5,
        ...th,
        stars: v >= 6 ? 5 : 4,
        diff: v >= 6 ? 'Band 7.5–9.0' : 'Band 7.0–8.5',
        review: `Đề thực chiến tuyển chọn Vol ${v} — mật độ Paraphrase dày & nhiều câu bẫy học thuật chuẩn phòng thi thật.`
      };
    }
    const sNum = Number(bk.num) || 1;
    const th = SERIES_BOOK_THEMES[(sNum + 2) % SERIES_BOOK_THEMES.length];
    return {
      era: `act-${sNum}`,
      brand: 'ACTUAL',
      numText: String(sNum).padStart(2, '0'),
      kind: 'dossier',
      featured: sNum <= 5,
      ...th,
      stars: 4,
      diff: 'Band 7.0–8.5',
      review: `Tổng hợp đề thi thật gần đây (Bộ ${sNum}) — bám sát xu hướng ra đề mới, rất hợp bấm giờ thi thử 60 phút.`
    };
  }

  function renderDifficultyStars(count) {
    const n = Math.max(1, Math.min(5, Number(count) || 4));
    return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
  }

  function renderBookendSvg() {
    return `
      <div class="rp-shelf-bookend" aria-hidden="true">
        <svg viewBox="0 0 48 64" fill="none">
          <path d="M8 58H42V61H8V58Z" fill="currentColor" opacity="0.28"/>
          <path d="M17 24L13 13L21 19C24 18 28 18 31 19L39 13L35 24C39 27.5 41 33 40.5 40C40 48 34.5 54 26 54C17.5 54 12 48 11.5 40C11 33 13 27.5 17 24Z" fill="currentColor" opacity="0.18" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M26 15.5C28.5 12 33 11.8 35.5 14C33 16.5 29 17 26 15.5Z" fill="currentColor" opacity="0.35"/>
          <circle cx="21.5" cy="30" r="1.7" fill="currentColor" opacity="0.7"/>
          <circle cx="30.5" cy="30" r="1.7" fill="currentColor" opacity="0.7"/>
          <path d="M20 42L22.5 39.8L25 42M26 41L28 39L30 41M31 42L33.5 39.8L36 42" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"/>
        </svg>
      </div>
    `;
  }

  function buildResumeBannerHtml() {
    ReadingPracticeStore.clearInProgress();
    if (isTeacherBypass()) {
      ReadingPracticeStore.clearLockout();
      return '';
    }
    const lock = ReadingPracticeStore.getLockoutInfo();
    if (!lock) return '';
    setTimeout(() => startAcLockCountdown(), 0);
    const unlockAt = formatClockHHMM(lock.until);
    return `
      <div class="rp-lock-hub-banner" id="rp-lock-hub-banner" role="alert">
        <div class="rp-lock-hub-left">
          <span class="rp-lock-hub-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          </span>
          <div>
            <div class="rp-lock-hub-title">Đang tạm khóa luyện đề 30 phút do vi phạm chống gian lận (2/2)</div>
            <div class="rp-lock-hub-sub">Tự động mở khóa lúc <strong>${esc(unlockAt)}</strong> · Còn <strong class="tabular" id="rp-lock-banner-countdown">${esc(formatLockCountdown(lock.remainingMs))}</strong></div>
          </div>
        </div>
        <button type="button" class="btn-subtle" style="padding:6px 12px;font-size:12.5px;flex-shrink:0;" onclick="window.__VOCAB_BRIDGE__?.syncPullClassData?.()?.then?.(() => { window.ReadingPracticeApp?.render?.(); if (!window.ReadingPracticeApp?.isLocked?.()) window.__VOCAB_BRIDGE__?.showToast?.('Đã mở khóa luyện đề Reading!'); else window.__VOCAB_BRIDGE__?.showToast?.('Chưa thấy lệnh mở khóa từ giáo viên!'); })">Kiểm tra mở khóa</button>
      </div>
    `;
  }

  /* =========================================================
     4. PORTAL 3-COLUMN GRID (Native Totoro .tot-exam-card)
     ========================================================= */
  function renderPortal() {
    const root = getRoot();
    if (!root) return;
    document.body.classList.remove('rp-exam-fullscreen');
    const d = DATA();
    const sources = d.SOURCES || [];
    const allPassages = Object.values(d.PASSAGES || {});
    const hist = ReadingPracticeStore.getHistory();

    const stampById = {
      cambridge: `<svg class="ghibli-stamp" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.11;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M18 22L14 8L24 16C29 14.5 35 14.5 40 16L50 8L46 22C52 26 55 33 55 41C55 52 45.5 58 32 58C18.5 58 9 52 9 41C9 33 12 26 18 22Z" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/><circle cx="23.5" cy="29" r="2.2" fill="currentColor"/><circle cx="40.5" cy="29" r="2.2" fill="currentColor"/><path d="M21 43L24.5 39.5L28 43M29 41.5L32 38.5L35 41.5M36 43L39.5 39.5L43 43" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      volume: `<svg class="ghibli-stamp warm" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.12;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 6V12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 26C14 14 22 11 32 11C42 11 50 14 54 26C48 23.5 43 23.5 38 25.5C34 23.5 30 23.5 26 25.5C21 23.5 16 23.5 10 26Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="currentColor" fill-opacity=".08"/><path d="M32 24V48C32 52 36 53 38 49.5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`,
      actual: `<svg class="ghibli-stamp" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.11;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2.1" stroke-dasharray="4 3"/><circle cx="32" cy="32" r="17" stroke="currentColor" stroke-width="1.8"/><path d="M32 20v12l8 5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      news: `<svg class="ghibli-stamp info" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.12;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M12 48C17 31 28 20 48 13C43 30 32 41 12 48Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="currentColor" fill-opacity=".08"/><path d="M12 48L36 24M24 36L32 34" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    };

    const portalCoverById = {
      cambridge: 'assets/images/reading_covers/portal_cambridge.webp?v=20261125e',
      volume: 'assets/images/reading_covers/portal_volume.webp?v=20261125c',
      actual: 'assets/images/reading_covers/portal_actual.webp?v=20261125c',
      news: 'assets/images/reading_covers/portal_news.webp?v=20261125c'
    };

    const conciseDescById = {
      cambridge: '194 bài đọc · 71 Full Tests · Chuẩn Cambridge & đáp án gốc.',
      volume: '114 bài đọc · 38 Full Tests · Chia rõ Test 1–4 & Passage 1–3.',
      actual: '270 bài thi thật gần đây · Lọc nhanh theo Passage & dạng câu hỏi.',
      news: 'The Economist, Nature, BBC Future · Song ngữ & lưu từ 1 chạm.'
    };

    const cardsHtml = sources.map((s) => {
      const summary = d.BANK_SUMMARY || {};
      const doneInSource = new Set(hist.filter((h) => h.source === s.id).map((h) => h.itemId)).size;
      let rightBadge = '';
      if (s.id === 'cambridge') rightBadge = `${summary.cambridge?.booksReady || 20}/20 cuốn`;
      else if (s.id === 'volume') rightBadge = `10 tập · Real Reading`;
      else if (s.id === 'actual') rightBadge = `Passage 1–3 · Full Test`;
      else rightBadge = `Song ngữ · Tra từ`;

      const footMeta = doneInSource > 0
        ? `<span class="rp-portal-stat is-done tabular">Đã làm ${doneInSource} bài</span>`
        : `<span class="rp-portal-stat">${s.id === 'news' ? 'Đọc & lưu từ' : 'Luyện tập · Thi thật'}</span>`;

      const actionsHtml = `
        <button type="button" class="btn btn-primary tot-demo-btn rp-portal-cta" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('${esc(s.id)}', '${s.id === 'actual' ? 'p1' : 'all'}')">${s.id === 'news' ? 'Đọc báo →' : 'Mở kho đề →'}</button>
      `;

      const coverUrl = portalCoverById[s.id] || portalCoverById.cambridge;

      return `
        <div class="tot-exam-card rp-portal-card has-cover" data-rp-portal="${esc(s.id)}"
          onclick="ReadingPracticeApp.openSource('${esc(s.id)}', '${s.id === 'actual' ? 'p1' : 'all'}')" role="button" tabindex="0">
          <div class="rp-portal-cover">
            <img class="rp-portal-cover-img" src="${esc(coverUrl)}" alt="" loading="lazy" decoding="async">
            <div class="rp-portal-cover-scrim" aria-hidden="true"></div>
            <div class="rp-portal-cover-badges">
              <span class="rp-cover-pill is-source">${esc(s.label)}</span>
              <span class="rp-cover-pill is-meta">${esc(rightBadge)}</span>
            </div>
          </div>
          <div class="rp-portal-body">
            <div>
              <div class="rp-portal-title">${esc(s.bookTitle || s.label)}</div>
              <div class="rp-portal-desc">${esc(conciseDescById[s.id] || s.desc)}</div>
            </div>
            <div class="rp-portal-foot">
              ${footMeta}
              ${actionsHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    root.innerHTML = `
      <div class="tot-section-shell rp-portal-shell">
        <div class="tot-shell-head rp-portal-head">
          <div style="display:flex;align-items:center;gap:11px;">
            <span class="tot-icon-tile info" aria-hidden="true" style="width:36px;height:36px;">
              <svg viewBox="2 2 24 24" fill="none">
                <path d="M8.5 11.2L7 5.6L11.2 9C12.5 8.5 14 8.5 15.3 9L19.5 5.6L18 11.2C20.2 12.8 21.2 15.2 21 18.2C20.7 21.5 17.8 23.2 13.2 23.2C8.6 23.2 5.7 21.5 5.4 18.2C5.2 15.2 6.2 12.8 8.5 11.2Z" fill="#6B92B8" stroke="#3F5C78" stroke-width="1.1"/>
                <ellipse cx="13.2" cy="18.8" rx="5.2" ry="3.4" fill="#FBF6E8"/>
                <circle cx="10.6" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="10.8" cy="13.5" r="0.75" fill="#181A1F"/>
                <circle cx="15.8" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="15.6" cy="13.5" r="0.75" fill="#181A1F"/>
              </svg>
            </span>
            <div>
              <h2 class="tot-shell-title">Kho đề Reading</h2>
              <p class="tot-shell-sub">Chọn bộ đề luyện tập hoặc thi bấm giờ chuẩn phòng thi máy.</p>
            </div>
          </div>
        </div>

        ${buildResumeBannerHtml()}

        <div class="tot-practice-grid" id="rp-portal-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  /* =========================================================
     5. SOURCE LIBRARY (20-Book Cam Shelf / Vol 1-6 / Actual Years / News)
     ========================================================= */
  function renderHub() {
    const root = getRoot();
    if (!root) return;
    document.body.classList.remove('rp-exam-fullscreen');
    const d = DATA();
    const sources = d.SOURCES || [];
    const curSourceObj = sources.find((s) => s.id === state.source) || sources[0];
    const isNews = state.source === 'news';
    const isActual = state.source === 'actual';
    const q = state.searchQuery.trim().toLowerCase();
    const matchesSearch = (obj) => {
      if (!q) return true;
      const hay = `${obj.title || ''} ${obj.subtitle || ''} ${obj.topic || ''} ${obj.series || ''}`.toLowerCase();
      return hay.includes(q);
    };

    let shelfHtml = '';
    let subBarHtml = '';
    let contentHtml = '';

    if (isActual) {
      const actualTab = ['p1', 'p2', 'p3', 'full'].includes(state.actualTab) ? state.actualTab : 'p1';
      const isFullTab = actualTab === 'full';
      const qtypeFilters = [
        { key: 'tfng', label: 'T / F / NG' },
        { key: 'ynng', label: 'Y / N / NG' },
        { key: 'gap', label: 'Gap Fill' },
        { key: 'select', label: 'Matching' },
        { key: 'mcq', label: 'Multiple Choice' }
      ];

      const activeFilterObj = qtypeFilters.find((qf) => qf.key === state.actualQType) || null;
      const filterOpen = !isFullTab && !!state.actualFilterOpen;

      shelfHtml = `
        <div class="rp-actual-toolbar">
          <div class="rp-actual-top-row">
            <div class="rp-actual-tabs" role="tablist" aria-label="Chọn phần đề thi thật">
              <button type="button" role="tab" class="rp-actual-tab ${actualTab === 'p1' ? 'active' : ''}" aria-selected="${actualTab === 'p1' ? 'true' : 'false'}" onclick="ReadingPracticeApp.setActualTab('p1')">Passage 1</button>
              <button type="button" role="tab" class="rp-actual-tab ${actualTab === 'p2' ? 'active' : ''}" aria-selected="${actualTab === 'p2' ? 'true' : 'false'}" onclick="ReadingPracticeApp.setActualTab('p2')">Passage 2</button>
              <button type="button" role="tab" class="rp-actual-tab ${actualTab === 'p3' ? 'active' : ''}" aria-selected="${actualTab === 'p3' ? 'true' : 'false'}" onclick="ReadingPracticeApp.setActualTab('p3')">Passage 3</button>
              <button type="button" role="tab" class="rp-actual-tab ${actualTab === 'full' ? 'active' : ''}" aria-selected="${actualTab === 'full' ? 'true' : 'false'}" onclick="ReadingPracticeApp.setActualTab('full')">Full Test</button>
            </div>
            <div class="rp-actual-search-wrap">
              <div class="rp-actual-search-combo ${activeFilterObj ? 'has-filter' : ''}">
                <span class="rp-actual-search-ico" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
                </span>
                <input type="search" class="rp-actual-search-input" id="rp-hub-search"
                  value="${esc(state.searchQuery)}"
                  placeholder="Tìm tên bài đọc..."
                  oninput="ReadingPracticeApp.onSearch(this.value)" autocomplete="off">
                ${(!isFullTab && activeFilterObj) ? `
                  <button type="button" class="rp-actual-active-chip" onclick="ReadingPracticeApp.toggleActualQType('${esc(activeFilterObj.key)}')" title="Bỏ lọc dạng câu hỏi">
                    <span>${esc(activeFilterObj.label)}</span>
                    <span aria-hidden="true">✕</span>
                  </button>
                ` : ''}
                ${!isFullTab ? `
                  <span class="rp-actual-combo-sep" aria-hidden="true"></span>
                  <button type="button" class="rp-actual-filter-btn ${activeFilterObj || filterOpen ? 'is-active' : ''}"
                    id="rp-actual-filter-btn"
                    aria-expanded="${filterOpen ? 'true' : 'false'}"
                    aria-haspopup="true"
                    title="Lọc theo dạng câu hỏi"
                    aria-label="Lọc theo dạng câu hỏi"
                    onclick="event.stopPropagation(); ReadingPracticeApp.toggleActualFilterMenu()">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
                    ${activeFilterObj ? '<span class="rp-filter-dot" aria-hidden="true"></span>' : ''}
                  </button>
                ` : ''}
              </div>
              ${filterOpen ? `
                <div class="rp-actual-filter-pop" id="rp-actual-filter-pop" role="menu" onclick="event.stopPropagation()">
                  <div class="rp-filter-pop-head">
                    <span>Lọc dạng câu hỏi</span>
                    ${activeFilterObj ? `<button type="button" class="rp-filter-clear-btn" onclick="ReadingPracticeApp.toggleActualQType('${esc(activeFilterObj.key)}')">Bỏ lọc</button>` : ''}
                  </div>
                  <div class="rp-filter-pop-list">
                    ${qtypeFilters.map((qf) => `
                      <button type="button" role="menuitemradio"
                        class="rp-filter-pop-item ${state.actualQType === qf.key ? 'active' : ''}"
                        aria-checked="${state.actualQType === qf.key ? 'true' : 'false'}"
                        onclick="ReadingPracticeApp.toggleActualQType('${qf.key}')">
                        <span>${esc(qf.label)}</span>
                        ${state.actualQType === qf.key ? '<span class="rp-filter-check" aria-hidden="true">✓</span>' : ''}
                      </button>
                    `).join('')}
                  </div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      if (state.loadingBank === 'actual') {
        contentHtml = `
          <div class="rp-unloaded-box rp-bank-loading" role="status" aria-live="polite">
            <div class="rp-unloaded-title">Đang mở ngân hàng bài đọc…</div>
            <p class="rp-unloaded-desc">Hệ thống đang nạp danh sách bài đọc, câu hỏi và đáp án chuẩn.</p>
          </div>
        `;
      } else {
        const PAGE_SIZE = 12;
        const passageHasType = (p, typeKey) => {
          if (!typeKey) return true;
          return (p.groups || []).some((g) =>
            g.type === typeKey || (g.questions || []).some((qq) => qq.type === typeKey)
          );
        };

        let allItems = [];
        if (isFullTab) {
          allItems = (d.FULL_TESTS || [])
            .filter((t) => t.source === 'actual')
            .map((t, idx) => ({ ...t, _actualFullIdx: idx + 1 }))
            .filter((t) => matchesSearch(t));
        } else {
          const pNum = actualTab === 'p2' ? 2 : (actualTab === 'p3' ? 3 : 1);
          allItems = Object.values(d.PASSAGES || {})
            .filter((p) => p.source === 'actual' && Number(p.passageNum) === pNum)
            .filter((p) => passageHasType(p, state.actualQType) && matchesSearch(p));
        }

        const totalPages = Math.max(1, Math.ceil(allItems.length / PAGE_SIZE));
        const curPage = Math.max(1, Math.min(totalPages, Number(state.actualPage) || 1));
        state.actualPage = curPage;
        const pageItems = allItems.slice((curPage - 1) * PAGE_SIZE, curPage * PAGE_SIZE);

        const pagerHtml = totalPages > 1 ? `
          <nav class="rp-actual-pager" aria-label="Chuyển trang bài đọc">
            <button type="button" class="rp-pager-btn" ${curPage <= 1 ? 'disabled' : ''} onclick="ReadingPracticeApp.setActualPage(${curPage - 1})">← Trang trước</button>
            <span class="rp-pager-info tabular">Trang ${curPage} / ${totalPages}</span>
            <button type="button" class="rp-pager-btn" ${curPage >= totalPages ? 'disabled' : ''} onclick="ReadingPracticeApp.setActualPage(${curPage + 1})">Trang sau →</button>
          </nav>
        ` : '';

        contentHtml = `
          <div class="rp-section-block" data-rp-section="${esc(actualTab)}">
            ${pageItems.length
              ? `<div class="rp-cards-grid">${pageItems.map((it) => renderHubCard(it, isFullTab)).join('')}</div>${pagerHtml}`
              : '<div class="rp-empty-inline">Không tìm thấy bài đọc khớp với bộ lọc hiện tại.</div>'}
          </div>
        `;
      }
    } else if (!isNews) {
      const books = getBooksForSource(state.source);

      const visibleBooks = state.source === 'cambridge'
        ? (state.camGroup === 'classic'
            ? books.filter((b) => Number(b.num) <= 9)
            : books.filter((b) => Number(b.num) >= 10))
        : (state.source === 'actual' && state.actualGroup === 'recent' && books.length > 10)
          ? books.filter((b) => b.group === 'recent')
          : books;

      if (!visibleBooks.some((b) => b.id === state.selectedBookId) && visibleBooks.length) {
        const firstReady = visibleBooks.find((b) => countReadyTestsInBook(b.id) > 0) || visibleBooks[0];
        state.selectedBookId = firstReady.id;
        state.selectedTestNum = 1;
      }

      const readyBooksCount = books.filter((b) => countReadyTestsInBook(b.id) > 0).length;

      const groupToggleHtml = state.source === 'cambridge' ? `
        <div class="rp-book-group-toggle" role="group" aria-label="Cambridge IELTS range">
          <button type="button" class="rp-mini-tab ${state.camGroup !== 'classic' ? 'active' : ''}"
            aria-pressed="${state.camGroup !== 'classic' ? 'true' : 'false'}"
            onclick="ReadingPracticeApp.setCamGroup('recent')"><span class="rp-star-mark" aria-hidden="true">★</span> Cam 10 – 20</button>
          <button type="button" class="rp-mini-tab ${state.camGroup === 'classic' ? 'active' : ''}"
            aria-pressed="${state.camGroup === 'classic' ? 'true' : 'false'}"
            onclick="ReadingPracticeApp.setCamGroup('classic')">Cam 1 – 9</button>
        </div>
      ` : (state.source === 'actual' && books.length > 10 ? `
        <div class="rp-book-group-toggle" role="group" aria-label="Recent Actual Tests range">
          <button type="button" class="rp-mini-tab ${state.actualGroup === 'recent' ? 'active' : ''}"
            aria-pressed="${state.actualGroup === 'recent' ? 'true' : 'false'}"
            onclick="ReadingPracticeApp.setActualGroup('recent')"><span class="rp-star-mark" aria-hidden="true">★</span> Set 1 – 10</button>
          <button type="button" class="rp-mini-tab ${state.actualGroup === 'all' ? 'active' : ''}"
            aria-pressed="${state.actualGroup === 'all' ? 'true' : 'false'}"
            onclick="ReadingPracticeApp.setActualGroup('all')">All Sets</button>
        </div>
      ` : '');

      const renderBookCard = (bk) => {
        const readyTests = countReadyTestsInBook(bk.id);
        const testStatus = getBookTestStatusMap(bk.id);
        const active = state.selectedBookId === bk.id;
        const meta = getBookVisualMeta(bk);
        const pipsHtml = [1, 2, 3, 4].map((t) => {
          const st = testStatus[t] || {};
          return `<span class="rp-bk-pip ${st.done ? 'is-done' : (st.hasData ? 'is-ready' : '')}" aria-hidden="true"></span>`;
        }).join('');
        const statusDesc = readyTests > 0 ? `${readyTests}/${bk.testsCount} tests ready` : 'Coming soon';
        const motifSvg = BOOK_MOTIFS[meta.motif] || BOOK_MOTIFS.totoro;
        const styleVars = `--bk-cover:${meta.cover};--bk-spine:${meta.spine};--bk-ribbon:${meta.ribbon};--bk-h:${meta.h || 118}px;`;
        return `
          <button type="button"
            class="rp-book-pill rp-bk-item is-${meta.kind} is-bind-${esc(meta.bind || 'frame')} ${active ? 'active' : ''} ${readyTests > 0 ? 'has-data' : 'is-empty'}"
            style="${styleVars}"
            data-rp-book="${esc(bk.id)}"
            data-era="${esc(meta.era)}"
            data-bind="${esc(meta.bind || 'frame')}"
            aria-pressed="${active ? 'true' : 'false'}"
            aria-label="${esc(bk.title)} — ${esc(statusDesc)}"
            onkeydown="ReadingPracticeApp.onShelfKeydown(event, '${esc(bk.id)}')"
            onclick="ReadingPracticeApp.selectBook('${esc(bk.id)}')">
            <span class="rp-bk-spine" aria-hidden="true"></span>
            ${(readyTests > 0 || active) ? `<span class="rp-bk-ribbon" aria-hidden="true">${meta.featured ? '<span class="rp-bk-star">★</span>' : ''}</span>` : ''}
            <span class="rp-bk-motif" aria-hidden="true">${motifSvg}</span>
            <span class="rp-bk-face">
              <span class="rp-bk-brand">${esc(meta.brand)}</span>
              <span class="rp-bk-num">${esc(meta.numText)}</span>
              <span class="rp-bk-foot">
                <span class="rp-bk-pips">${pipsHtml}</span>
                ${readyTests > 0 ? `<span class="rp-bk-count">${readyTests}/${bk.testsCount}</span>` : '<span class="rp-bk-count is-muted">—</span>'}
              </span>
            </span>
          </button>
        `;
      };

      // Organize books onto balanced wooden oak shelf tiers
      const shelfTiers = [];
      if (state.source === 'actual' && visibleBooks.length > 10) {
        for (let i = 0; i < visibleBooks.length; i += 10) {
          const chunk = visibleBooks.slice(i, i + 10);
          shelfTiers.push({
            label: `Kệ ${Math.floor(i / 10) + 1} · Bộ ${chunk[0].num} – ${chunk[chunk.length - 1].num}`,
            items: chunk,
            cols: 10,
            compact: false
          });
        }
      } else {
        const tierLabel = state.source === 'cambridge'
          ? (state.camGroup === 'classic' ? 'Cambridge IELTS 9 – 1' : 'Cambridge IELTS 20 – 10')
          : (state.source === 'volume' ? 'Real Reading Test Vol 1 – 10' : 'Recent Actual Tests Set 1 – 10');
        shelfTiers.push({
          label: tierLabel,
          items: visibleBooks,
          cols: Math.min(11, Math.max(9, visibleBooks.length)),
          compact: visibleBooks.length <= 6
        });
      }

      const tiersHtml = shelfTiers.map((tier, idx) => `
        <div class="rp-shelf-tier ${tier.compact ? 'is-compact-tier' : ''}" data-tier="${idx}">
          ${shelfTiers.length > 1 ? `<div class="rp-tier-tag">${esc(tier.label)}</div>` : ''}
          <div class="rp-shelf-row ${tier.compact ? 'is-compact-row' : ''}" style="--shelf-cols:${tier.cols};" role="group" aria-label="${esc(tier.label)}">
            ${tier.items.map(renderBookCard).join('')}
            ${tier.compact ? renderBookendSvg() : ''}
          </div>
          <div class="rp-shelf-plank" aria-hidden="true"></div>
        </div>
      `).join('');

      const curBook = books.find((b) => b.id === state.selectedBookId) || books[0];
      const curMeta = getBookVisualMeta(curBook);
      const curReadyCount = countReadyTestsInBook(curBook?.id);
      const curTestStatus = getBookTestStatusMap(curBook?.id);
      const bookPassages = Object.values(d.PASSAGES || {}).filter((p) => p.bookId === curBook?.id);
      const bookFullTests = (d.FULL_TESTS || []).filter((t) => t.bookId === curBook?.id);

      // 4 Test tabs inside the selected Book (concise labels — no repeated "Sẵn sàng" clutter)
      const testTabsHtml = [1, 2, 3, 4].map((tNum) => {
        const st = curTestStatus[tNum] || {};
        const hasP = st.hasData;
        const isAct = state.selectedTestNum === tNum;
        const stateTag = st.done ? '<small>✓ Xong</small>' : (!hasP ? '<small>Trống</small>' : '');
        return `
          <button type="button"
            class="rp-test-tab ${isAct ? 'active' : ''} ${hasP ? 'has-data' : 'is-empty'} ${st.done ? 'is-done' : ''}"
            data-rp-test="${tNum}"
            aria-pressed="${isAct ? 'true' : 'false'}"
            onclick="ReadingPracticeApp.selectTestNum(${tNum})">
            <span class="rp-test-dot" aria-hidden="true"></span>
            <span class="rp-test-name">Test ${tNum}</span>
            ${stateTag}
          </button>
        `;
      }).join('');

      const shelfHeading = state.source === 'cambridge'
        ? 'Cambridge IELTS Library'
        : (state.source === 'volume' ? 'Real Reading Test Library' : 'Recent Actual Tests Archive');
      const unitNoun = state.source === 'volume' ? 'volumes' : (state.source === 'actual' ? 'sets' : 'books');
      const curMotifSvg = BOOK_MOTIFS[curMeta.motif] || BOOK_MOTIFS.totoro;
      const curStyleVars = `--bk-cover:${curMeta.cover};--bk-spine:${curMeta.spine};--bk-ribbon:${curMeta.ribbon};`;

      shelfHtml = `
        <section class="rp-shelf-box rp-bookcase" aria-label="${esc(shelfHeading)}">
          <div class="rp-shelf-top">
            <div class="rp-shelf-title-wrap">
              <span class="rp-shelf-label">${esc(shelfHeading)}</span>
              <span class="rp-shelf-stat">${readyBooksCount}/${books.length} ${unitNoun} ready</span>
            </div>
            <div class="rp-shelf-controls">
              ${groupToggleHtml}
              <div class="rp-shelf-scroll-btns" aria-label="Scroll bookshelf">
                <button type="button" class="rp-shelf-nav-btn" aria-label="Scroll left" onclick="ReadingPracticeApp.scrollShelf(-1)">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M10 3.5L5.5 8L10 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
                <button type="button" class="rp-shelf-nav-btn" aria-label="Scroll right" onclick="ReadingPracticeApp.scrollShelf(1)">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 3.5L10.5 8L6 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            </div>
          </div>

          <div class="rp-book-rail rp-bookcase-tiers" id="rp-book-rail">
            ${tiersHtml}
          </div>

          <div class="rp-book-detail-head rp-book-desk">
            <div class="rp-desk-book">
              <div class="rp-desk-cover is-${esc(curMeta.kind)} is-bind-${esc(curMeta.bind || 'frame')} ${curReadyCount > 0 ? 'has-data' : 'is-empty'}" style="${curStyleVars}" data-era="${esc(curMeta.era)}" aria-hidden="true">
                <span class="rp-desk-cover-spine"></span>
                <span class="rp-desk-motif">${curMotifSvg}</span>
                <span class="rp-desk-cover-brand">${esc(curMeta.brand.slice(0, 3))}</span>
                <span class="rp-desk-cover-num">${esc(curMeta.numText)}</span>
              </div>
              <div class="rp-desk-meta">
                <div class="rp-desk-title-row">
                  <strong class="rp-cur-book-title">${esc(curBook?.title || '')}</strong>
                  <span class="rp-diff-pill" title="Độ khó tham khảo">${renderDifficultyStars(curMeta.stars)} · ${esc(curMeta.diff || 'Band 6.5–8.0')}</span>
                  <span class="rp-desk-badge ${curReadyCount > 0 ? 'is-ready' : 'is-empty'}">
                    ${curReadyCount > 0 ? `${curReadyCount}/${curBook?.testsCount || 4} Tests` : 'Chưa nạp đề'}
                  </span>
                </div>
                <span class="rp-cur-book-sub">${esc(curMeta.review || '')}</span>
              </div>
            </div>
            <div class="rp-test-tabs" id="rp-test-tabs" role="group" aria-label="Chọn bộ Test trong sách">${testTabsHtml}</div>
          </div>
        </section>
      `;

      const testPassages = bookPassages.filter((p) => (p.testNum || 1) === state.selectedTestNum);
      const testFulls = bookFullTests.filter((t) => (t.testNum || 1) === state.selectedTestNum);

      if (state.loadingBank === state.source) {
        contentHtml = `
          <div class="rp-unloaded-box rp-bank-loading" role="status" aria-live="polite">
            <div class="rp-unloaded-title">Đang mở kệ đề từ kho dữ liệu…</div>
            <p class="rp-unloaded-desc">Hệ thống đang nạp toàn bộ đề thi, câu hỏi và bảng đáp án chuẩn cho kho này.</p>
          </div>
        `;
      } else if (!testPassages.length && !testFulls.length) {
        contentHtml = `
          <div class="rp-unloaded-box" role="status">
            <div class="rp-unloaded-icon" aria-hidden="true">
              <svg viewBox="0 0 28 28" fill="none">
                <path d="M6 5.5C6 4.67 6.67 4 7.5 4H20.5C21.33 4 22 4.67 22 5.5V22.5C22 23.33 21.33 24 20.5 24H7.5C6.67 24 6 23.33 6 22.5V5.5Z" stroke="currentColor" stroke-width="1.6"/>
                <path d="M10 4V24" stroke="currentColor" stroke-width="1.5"/>
                <path d="M13.5 10.5H18.5M13.5 14H17.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </div>
            <div class="rp-unloaded-title">${esc(curBook?.title || '')} · Test ${state.selectedTestNum} chưa nạp đề</div>
            <p class="rp-unloaded-desc">Khung danh mục đã sẵn sàng đủ 4 phần (<strong>Passage 1 → Passage 2 → Passage 3 → FULL TEST</strong>). Thêm bài vào <code>data/reading_practice_data.js</code> với <code>bookId: '${esc(curBook?.id || '')}', testNum: ${state.selectedTestNum}</code> để mở khóa ngay.</p>
            <button type="button" class="btn btn-primary rp-btn-sm" onclick="ReadingPracticeApp.jumpToFirstReady('${esc(state.source)}')">Mở bộ đề đang sẵn sàng →</button>
          </div>
        `;
      } else {
        // Distilled 2x2 Test Quad: Passage 1, 2, 3 + Full Test all visible cleanly without 4 duplicate section headers
        const orderedPassages = [1, 2, 3]
          .flatMap((n) => testPassages.filter((p) => Number(p.passageNum) === n));
        const quadCards = [
          ...orderedPassages.map((it) => renderHubCard(it, false)),
          ...testFulls.map((it) => renderHubCard(it, true))
        ];
        contentHtml = `
          <div class="rp-section-block rp-test-quad-block" data-rp-section="test-${state.selectedTestNum}">
            <div class="rp-cards-grid is-test-quad">
              ${quadCards.join('')}
            </div>
          </div>
        `;
      }
    } else {
      const allNews = Object.values(d.PASSAGES || {}).filter((p) => p.source === 'news');
      const topics = ['all', ...Array.from(new Set(allNews.map((p) => p.topic).filter(Boolean)))];
      subBarHtml = `
        <div class="rp-part-tabs" role="tablist" aria-label="Lọc chủ đề News">
          ${topics.map((tp) => `
            <button type="button" class="rp-part-pill ${state.newsTopic === tp ? 'active' : ''}"
              onclick="ReadingPracticeApp.setNewsTopic('${esc(tp)}')">${tp === 'all' ? 'Tất cả chủ đề' : esc(tp)}</button>
          `).join('')}
        </div>
      `;
      const filteredNews = allNews.filter((p) => (state.newsTopic === 'all' || p.topic === state.newsTopic) && matchesSearch(p));
      contentHtml = `
        <div class="rp-section-block" data-rp-section="news">
          <div class="rp-section-head">
            <h3 class="rp-section-title">The Economist · Nature · BBC Future</h3>
            <span class="rp-section-badge">Song ngữ 1 chạm · Click tra từ &amp; lưu vào Từ của tôi</span>
          </div>
          <div class="rp-cards-grid">
            ${filteredNews.length
              ? filteredNews.map((it) => renderHubCard(it, false, true)).join('')
              : '<div class="rp-empty-inline">Chưa có bài báo khớp với bộ lọc hiện tại.</div>'}
          </div>
        </div>
      `;
    }

    const sourceSwitchPills = [
      { id: 'cambridge', lbl: 'Cambridge' },
      { id: 'volume', lbl: 'Volume' },
      { id: 'actual', lbl: 'Actual' },
      { id: 'news', lbl: 'News' }
    ].map((sp) => `
      <button type="button" class="rp-src-pill ${state.source === sp.id ? 'active' : ''}"
        aria-pressed="${state.source === sp.id ? 'true' : 'false'}"
        onclick="ReadingPracticeApp.openSource('${sp.id}', '${sp.id === 'actual' ? 'p1' : 'all'}')">${sp.lbl}</button>
    `).join('');

    root.innerHTML = `
      <div class="rp-hub-shell tot-section-shell">
        <div class="rp-hub-head rp-hub-head-clean">
          <div class="rp-hub-head-left">
            <button type="button" class="btn-subtle rp-btn-sm" id="rp-btn-back-portal" onclick="ReadingPracticeApp.openPortal()">← Kho đề</button>
            <h2 class="tot-shell-title" style="margin:0;">${esc(curSourceObj?.bookTitle || curSourceObj?.label || 'Practice')}</h2>
          </div>
          <div class="rp-src-switcher" role="group" aria-label="Chuyển nhanh kho đề">${sourceSwitchPills}</div>
        </div>

        ${buildResumeBannerHtml()}
        ${shelfHtml}

        ${state.source === 'news' ? `
          <div class="rp-filter-toolbar">
            ${subBarHtml}
            <input type="search" class="rp-search-input" id="rp-hub-search"
              value="${esc(state.searchQuery)}"
              placeholder="Tìm theo tên bài, chủ đề..."
              oninput="ReadingPracticeApp.onSearch(this.value)" autocomplete="off">
          </div>
        ` : ''}

        <div class="rp-sections-stack">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  const COVER_THEMES_ORDER = [
    'fulltest', 'ocean', 'wildlife', 'ancient', 'architecture', 'music_art',
    'botany', 'mind', 'space', 'tech', 'medicine', 'society', 'agriculture'
  ];

  const COVER_TOPIC_RULES = [
    ['music_art', /\b(music|musical|violin|stradivarius|art|arts|artist|paint|painting|sculpt|sculpture|film|cinema|photo|photograph|literature|novel|poem|dance|song|concert|theatre|theater|fashion|craft|pottery|colour|color|dye|dyes|composer|orchestra|earworm|museum)\b/i],
    ['ancient', /\b(ancient|roman|palace|egypt|egyptian|greek|archaeolog\w*|civilis\w*|civiliz\w*|empire|medieval|temple|pyramid|dynasty|heritage|maori|aborigin\w*|viking|prehistor\w*|burial|treasure|monument|ruins|bronze|antiquit\w*|century)\b/i],
    ['agriculture', /\b(food|seed|seeds|crop|crops|farm|farming|agricult\w*|coffee|tea|chocolate|spice|wheat|rice|sugar|honey|olive|wine|bread|cocoa|harvest|soil|orchard|famine|grain|dairy)\b/i],
    ['wildlife', /\b(bird|birds|parrot|parrots|kakapo|kākāpō|dingo|bee|bees|insect|insects|animal|animals|species|wolf|wolves|bear|monkey|ant|ants|spider|mammal|fauna|zoo|dinosaur|habitat|wildlife|predator|dog|dogs|cat|cats|horse|elephant|butterfly|turtle|frog|penguin|penguins|whale|whales|dolphin)\b/i],
    ['ocean', /\b(ocean|oceans|sea|seas|pacific|atlantic|island|islands|voyag\w*|ship|ships|coral|river|rivers|marine|boat|boats|sail|sailing|coastal|arctic|antarct\w*|flood|canal|harbour|harbor|algae|aqua|navigation|maritime)\b/i],
    ['botany', /\b(plant|plants|tree|trees|forest|forests|flower|flowers|garden|wood|timber|botan\w*|jungle|rainforest|fruit|leaf|leaves|autumn|megafire|ecosystem|elm|elms|bamboo)\b/i],
    ['architecture', /\b(architect\w*|building|buildings|city|cities|urban|bridge|tower|street|road|tunnel|underground|subway|rail|train|transport|skyscrap\w*|village|library|stadium|greenhouse|housing)\b/i],
    ['space', /\b(space|planet|planets|star|stars|moon|mars|universe|galaxy|astron\w*|extraterrestrial|extra-terrestrial|cosmos|geolog\w*|volcan\w*|earthquake|climate|weather|atmosphere|solar|comet|asteroid|observatory)\b/i],
    ['medicine', /\b(health|medic\w*|disease|diseases|virus|bacteria|doctor|hospital|drug|drugs|gene|genes|genetic|dna|cell|cells|heart|blood|ageing|aging|longev\w*|diet|nutrition|sport|sports|exercis\w*|fluorid\w*|cure|therap\w*|vaccin\w*|pain|oxytocin|stress|sleep)\b/i],
    ['tech', /\b(robot|robots|ai|computer|digital|internet|machine|engine|invent\w*|tech\w*|electr\w*|energy|power|battery|laser|quantum|micro|nano|phone|screen|algorithm|data|cyber|factory|automat\w*|plane|flight|aviation|vehicle|telegraph|decibel|noisy|noise)\b/i],
    ['mind', /\b(brain|mind|psycholog\w*|dream|yawn|yawning|memory|emotion|fear|happy|happiness|cognit\w*|mental|child|children|adolescen\w*|parent|behaviour|behavior|language|linguistic|speech|learning|education|school|teach|teaching|decision|trust|touch|stranger|strangers|handshake|lie|lying|creativ\w*|intellig\w*|persuas\w*)\b/i],
    ['society', /\b(econom\w*|work|job|employee|employees|motivat\w*|company|business|market|money|trade|shop|consumer|media|news|social|communit\w*|law|crime|govern\w*|politic\w*|peace|bank|tax|office|team|leader|career|touris\w*|travel|masses|history)\b/i]
  ];

  function hashStringIdx(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return Math.abs(h);
  }

  function getReadingCardCover(item, isFull) {
    // Full Tests ALWAYS use our dedicated custom CD-IELTS Full Test cover (never random passage photos!)
    if (isFull) {
      const ftSrc = 'assets/images/reading_covers/cover_fulltest.webp?v=20261125c';
      return { primary: ftSrc, fallback: ftSrc };
    }

    let matched = null;
    const titleText = String(item.title || '');
    for (const [key, re] of COVER_TOPIC_RULES) {
      if (re.test(titleText)) { matched = key; break; }
    }
    if (!matched) {
      const subText = `${item.subtitle || ''} ${item.topic || ''}`;
      for (const [key, re] of COVER_TOPIC_RULES) {
        if (re.test(subText)) { matched = key; break; }
      }
    }
    if (!matched) {
      const fallbackPool = COVER_THEMES_ORDER.slice(1);
      matched = fallbackPool[hashStringIdx(item.id || item.title) % fallbackPool.length];
    }
    const fallback = `assets/images/reading_covers/${matched}.webp`;

    const photoMap = window.READING_PHOTO_MAP || {};
    const realPhoto = photoMap[item.id] || null;

    return {
      primary: realPhoto || fallback,
      fallback
    };
  }

  function renderHubCard(item, isFull, isNews = false) {
    const best = ReadingPracticeStore.getBestAttempt(item.id);
    const totalQ = isFull
      ? item.passageIds.reduce((sum, pid) => sum + getAllQuestionsInPassage(DATA().PASSAGES[pid] || {}).length, 0)
      : getAllQuestionsInPassage(item).length;

    const pillLabel = isNews
      ? (item.newsSource || item.topic || 'News')
      : (isFull ? 'FULL TEST' : `Passage ${item.passageNum}`);

    const isMastered = !!(best && (best.mastered || (best.total > 0 && best.score === best.total)));
    const scoreBadge = best
      ? `<span class="rp-cover-pill is-done">${isMastered ? '✓ 100% · ' : ''}${best.score}/${best.total} câu</span>`
      : `<span class="rp-cover-pill is-band">${esc(item.targetBand || 'IELTS')}</span>`;

    const qTypes = isFull ? ['Passage 1–3', 'Full 60 phút'] : getPassageTypes(item);
    const cover = getReadingCardCover(item, isFull);

    const startExamCall = isFull
      ? `ReadingPracticeApp.startFullTest('${esc(item.id)}', { studyMode: 'exam' })`
      : `ReadingPracticeApp.startPassage('${esc(item.id)}', { studyMode: 'exam' })`;

    const startPracticeCall = isFull
      ? `ReadingPracticeApp.startFullTest('${esc(item.id)}', { studyMode: 'practice' })`
      : `ReadingPracticeApp.startPassage('${esc(item.id)}', { studyMode: 'practice' })`;

    const reviewCall = isFull
      ? `ReadingPracticeApp.startFullTest('${esc(item.id)}', { openInReview: true })`
      : `ReadingPracticeApp.startPassage('${esc(item.id)}', { openInReview: true })`;

    const isTeacher = Boolean(B()?.isTeacherUser?.());
    const teacherAssignBtn = (isTeacher && !isNews)
      ? `<button type="button" class="rp-btn-assign rp-btn-sm" onclick="event.stopPropagation(); window.TeacherStudio?.openPracticeAssignModal?.({ skill: 'reading', itemId: '${esc(item.id)}', isFull: ${isFull ? 'true' : 'false'}, title: '${esc(item.title || item.id).replace(/'/g, "\\'")}', subtitle: '${esc(item.series || pillLabel).replace(/'/g, "\\'")}' })" title="Tạo link giao bài Zalo cho học sinh">🔗 Giao</button>`
      : '';

    const footHtml = isNews
      ? `
        <button type="button" class="btn-subtle rp-btn-sm" onclick="${reviewCall}">Đọc song ngữ</button>
        <button type="button" class="btn btn-primary rp-btn-sm" onclick="${startPracticeCall}">Đọc &amp; Làm bài →</button>
      `
      : `
        <div class="rp-card-mode-btns">
          ${teacherAssignBtn}
          ${(isMastered || isTeacher) ? `<button type="button" class="btn-subtle rp-btn-sm rp-btn-rev" onclick="${reviewCall}" title="${isTeacher ? 'Quyền Giáo viên — Xem ngay đáp án, lời giải &amp; Locate không cần làm bài' : 'Đã hoàn thành 100% — Xem lại đáp án &amp; lời giải'}">${isTeacher && !isMastered ? 'Xem đáp án' : 'Xem giải'}</button>` : ''}
          <button type="button" class="rp-btn-practice rp-btn-sm" data-rp-start-mode="practice" onclick="${startPracticeCall}" title="Luyện tập Totoro Washi: 5 màu highlight pastel, tùy chỉnh nền &amp; cỡ chữ, chống gian lận &amp; mở khóa Solution khi đúng 100%">
            <span class="rp-mode-dot-swatch" aria-hidden="true"></span>
            <span>Luyện tập</span>
          </button>
          <button type="button" class="btn btn-primary rp-btn-sm rp-btn-exam" data-rp-start-mode="exam" onclick="${startExamCall}" title="Thi thật chuẩn phòng thi máy CD-IELTS Inspera">
            ${isFull ? 'Thi Full Test →' : 'Thi thật →'}
          </button>
        </div>
      `;

    const isActualItem = item.source === 'actual';
    const displaySeries = isActualItem
      ? (isFull ? 'Recent Actual' : '')
      : (item.series || item.topic || '');
    const displayTitle = (isActualItem && isFull && item._actualFullIdx)
      ? `Full Test #${item._actualFullIdx}`
      : item.title;

    return `
      <article class="rp-card has-cover ${isFull ? 'rp-card-full' : ''}" data-rp-item="${esc(item.id)}">
        <div class="rp-card-cover">
          <img class="rp-card-cover-img" src="${esc(cover.primary)}" data-fb="${esc(cover.fallback)}" referrerpolicy="no-referrer"
            onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb');}" alt="" loading="lazy" decoding="async">
          <div class="rp-card-cover-scrim" aria-hidden="true"></div>
          <div class="rp-card-cover-top">
            <span class="rp-cover-pill ${isFull ? 'is-full' : isNews ? 'is-news' : 'is-pass'}">${esc(pillLabel)}</span>
            ${scoreBadge}
          </div>
          <div class="rp-card-cover-meta tabular">
            <span>${totalQ} câu hỏi</span>
            <span>·</span>
            <span>${item.suggestedMins || 20} phút</span>
          </div>
        </div>
        <div class="rp-card-body">
          ${displaySeries ? `<div class="rp-card-series">${esc(displaySeries)}</div>` : ''}
          <h4 class="rp-card-title">${esc(displayTitle)}</h4>
          <p class="rp-card-sub">${esc(item.subtitle || '')}</p>
          <div class="rp-card-tags">
            ${qTypes.map((qt) => `<span class="rp-qtype-tag">${esc(qt)}</span>`).join('')}
          </div>
          <div class="rp-card-foot">
            ${footHtml}
          </div>
        </div>
      </article>
    `;
  }

  /* =========================================================
     6. DUAL-MODE ENGINE: INSPERA CD-IELTS EXAM + PRACTICE PRO STUDIO
     ========================================================= */
  function startSession(config) {
    const isNews = config.source === 'news';
    if (isTeacherBypass()) {
      ReadingPracticeStore.clearLockout();
    } else if (!config.openInReview && !isNews) {
      const lock = ReadingPracticeStore.getLockoutInfo();
      if (lock) {
        showAntiCheatModal({
          level: 'lock',
          badge: 'ĐANG KHÓA 30 PHÚT · VI PHẠM 2/2',
          title: 'Tạm khóa luyện đề Reading',
          reason: lock.reason || 'Chuyển tab khi đang làm bài',
          score: lock.score,
          total: lock.total,
          band: lock.band,
          until: lock.until,
          remainingMs: lock.remainingMs,
          isReblocked: true,
          ctaLabel: 'Đã hiểu'
        });
        return;
      }
    }
    stopTimer();
    const totalSec = (config.suggestedMins || 20) * 60;
    const studyMode = config.studyMode === 'practice' || (isNews && config.studyMode !== 'exam')
      ? 'practice'
      : 'exam';
    const isPractice = studyMode === 'practice';
    const rawPracContrast = config.practiceContrast || (isPractice && config.contrast ? config.contrast : 'totoro');
    const practiceContrast = ['totoro', 'cd', 'sepia'].includes(rawPracContrast) ? rawPracContrast : 'totoro';
    const defaultContrast = isPractice ? practiceContrast : 'cd';

    const savedDraft = !config.openInReview
      ? ReadingPracticeStore.getDraftForItem(config.itemId)
      : null;
    const hasSavedDraft = Boolean(
      savedDraft &&
      (Object.keys(savedDraft.answers || {}).length > 0 ||
        Object.keys(savedDraft.highlights || {}).length > 0 ||
        (Array.isArray(savedDraft.notes) && savedDraft.notes.length > 0) ||
        Number(savedDraft.elapsedSec || 0) > 0)
    );

    state.session = {
      itemId: config.itemId,
      title: config.title,
      source: config.source,
      isFull: !!config.isFull,
      isNews,
      studyMode,                          // 'exam' | 'practice'
      activePenColor: config.activePenColor || 'yellow',
      brushAuto: false,
      showTimer: config.showTimer !== false,
      attemptCount: Number(hasSavedDraft ? savedDraft.attemptCount : config.attemptCount) || 0,
      firstAttemptResult: (hasSavedDraft ? savedDraft.firstAttemptResult : config.firstAttemptResult) || null,
      lockedCorrect: hasSavedDraft && savedDraft.lockedCorrect ? { ...savedDraft.lockedCorrect } : (config.lockedCorrect ? { ...config.lockedCorrect } : {}),
      wrongSet: hasSavedDraft && savedDraft.wrongSet ? { ...savedDraft.wrongSet } : (config.wrongSet ? { ...config.wrongSet } : {}),
      antiCheatStrikes: 0,
      antiCheatNotice: '',
      highlights: hasSavedDraft && savedDraft.highlights
        ? JSON.parse(JSON.stringify(savedDraft.highlights))
        : (config.highlights ? JSON.parse(JSON.stringify(config.highlights)) : {}),
      deckDefaultName: config.deckDefaultName || config.title,
      passageIds: config.passageIds,
      activePassageIdx: hasSavedDraft ? Math.min(config.passageIds.length - 1, Math.max(0, Number(savedDraft.activePassageIdx) || 0)) : 0,
      mode: config.openInReview ? 'review' : 'exam',
      // Exam mode ALWAYS locks to official bright CD-IELTS ('cd'); Practice mode allows custom theme/contrast
      contrast: defaultContrast,          // 'cd' | 'totoro' | 'dark' | 'yellow'
      practiceContrast,
      textSize: config.textSize || 'regular',
      optionsOpen: false,
      showBilingual: !!config.openInReview && isNews,
      totalSec,
      remainingSec: hasSavedDraft && Number.isFinite(Number(savedDraft.remainingSec)) ? Number(savedDraft.remainingSec) : (config.remainingSec ?? totalSec),
      elapsedSec: hasSavedDraft && Number.isFinite(Number(savedDraft.elapsedSec)) ? Number(savedDraft.elapsedSec) : (config.elapsedSec ?? 0),
      paused: false,
      answers: hasSavedDraft && savedDraft.answers ? { ...savedDraft.answers } : (config.answers ? { ...config.answers } : {}),
      flagged: hasSavedDraft && savedDraft.flagged ? { ...savedDraft.flagged } : (config.flagged ? { ...config.flagged } : {}),
      struck: hasSavedDraft && savedDraft.struck ? { ...savedDraft.struck } : (config.struck ? { ...config.struck } : {}),
      notes: hasSavedDraft && Array.isArray(savedDraft.notes) ? savedDraft.notes.slice() : (Array.isArray(config.notes) ? config.notes.slice() : []),
      notesOpen: false,
      activeQid: null,
      activeEvidenceId: null,
      reviewResult: null
    };
    if (hasSavedDraft) {
      setTimeout(() => window.__VOCAB_BRIDGE__?.showToast?.('Đã khôi phục tiến trình bài làm trước đó — tiếp tục làm bài nhé!'), 120);
    }
    state.view = 'exam';
    state.mobilePane = 'passage';
    state.dictTarget = null;
    state.selectedHeadingKey = null;
    state.pendingSelection = null;
    document.body.classList.add('rp-exam-fullscreen');

    if (state.session.mode === 'exam') {
      startTimer();
      startReadingAntiCheat();
    } else if (config.openInReview) {
      stopReadingAntiCheat();
      state.session.reviewResult = computeReviewResult();
    }
    renderExamWorkspace();
    persistDraft();
  }

  function startTimer() {
    stopTimer();
    state.timerId = setInterval(() => {
      if (!state.session || state.session.mode !== 'exam' || state.session.paused) return;
      state.session.elapsedSec += 1;
      if (state.session.remainingSec > 0) state.session.remainingSec -= 1;
      const el = document.getElementById('rp-timer-display');
      if (el) el.textContent = formatMinsRemaining(state.session.remainingSec);
      const exactEl = document.getElementById('rp-timer-exact');
      if (exactEl) exactEl.textContent = formatDuration(state.session.remainingSec);
      if (state.session.elapsedSec % 10 === 0) persistDraft();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  function persistDraft() {
    const s = state.session;
    if (!s || s.mode !== 'exam' || s.liveRoomId || !s.itemId) return;
    ReadingPracticeStore.saveInProgress({
      itemId: s.itemId,
      title: s.title,
      source: s.source,
      isFull: !!s.isFull,
      studyMode: s.studyMode || 'exam',
      activePassageIdx: Number(s.activePassageIdx || 0),
      remainingSec: Number(s.remainingSec || 0),
      elapsedSec: Number(s.elapsedSec || 0),
      attemptCount: Number(s.attemptCount || 0),
      firstAttemptResult: s.firstAttemptResult || null,
      lockedCorrect: s.lockedCorrect ? { ...s.lockedCorrect } : {},
      wrongSet: s.wrongSet ? { ...s.wrongSet } : {},
      answers: s.answers ? { ...s.answers } : {},
      flagged: s.flagged ? { ...s.flagged } : {},
      struck: s.struck ? { ...s.struck } : {},
      highlights: s.highlights ? JSON.parse(JSON.stringify(s.highlights)) : {},
      notes: Array.isArray(s.notes) ? s.notes.slice() : [],
      updatedAt: Date.now()
    });
  }

  /* ---------- PERSISTENT TEXT-OFFSET PASTEL HIGHLIGHT ENGINE ---------- */
  function getPassageHighlights(passageId) {
    if (!state.session || !passageId) return [];
    if (!state.session.highlights) state.session.highlights = {};
    if (!Array.isArray(state.session.highlights[passageId])) {
      state.session.highlights[passageId] = [];
    }
    return state.session.highlights[passageId];
  }

  function mergeOrAddHighlight(passageId, paraIdx, start, end, color) {
    if (end <= start) return;
    const list = getPassageHighlights(passageId);
    const next = [];
    for (const h of list) {
      if (h.paraIdx !== paraIdx || h.end <= start || h.start >= end) {
        next.push(h);
      } else {
        // Trim non-overlapping tails cleanly
        if (h.start < start) next.push({ ...h, id: h.id + '_l', end: start });
        if (h.end > end) next.push({ ...h, id: h.id + '_r', start: end });
      }
    }
    const isLive = !!state.session?.liveRoomId;
    const liveUser = isLive ? getCurrentLiveUser() : null;
    next.push({
      id: 'hl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      paraIdx,
      start,
      end,
      color: color || 'yellow',
      ...(liveUser ? { by: liveUser.name, byRole: liveUser.role, byId: liveUser.uid } : {})
    });
    next.sort((a, b) => {
      const ka = String(a.paraIdx);
      const kb = String(b.paraIdx);
      if (ka !== kb) {
        const qa = ka.startsWith('q') ? 1 : 0;
        const qb = kb.startsWith('q') ? 1 : 0;
        if (qa !== qb) return qa - qb;
        return Number(ka.replace(/^q/, '')) - Number(kb.replace(/^q/, ''));
      }
      return a.start - b.start;
    });
    state.session.highlights[passageId] = next;
  }

  function removeHighlightRange(passageId, paraIdx, start, end) {
    const list = getPassageHighlights(passageId);
    const next = [];
    for (const h of list) {
      if (h.paraIdx !== paraIdx || h.end <= start || h.start >= end) {
        next.push(h);
      } else {
        if (h.start < start) next.push({ ...h, id: h.id + '_l', end: start });
        if (h.end > end) next.push({ ...h, id: h.id + '_r', start: end });
      }
    }
    state.session.highlights[passageId] = next;
  }

  function isQuestionTextNodeHighlightable(node) {
    if (!node || node.nodeType !== 3 || !node.nodeValue || !node.nodeValue.length) return false;
    const el = node.parentElement;
    if (!el) return false;
    if (el.closest('input, select, option, textarea, button, svg, style, script, .ins-note-qnum, .ins-q-num, .rp-q-num, .ins-q-badge, .rp-q-badge, .rp-rev-badge, .rp-rev-inline, .rp-exp-panel, .rp-exp-box, .ins-mh-hint')) {
      return false;
    }
    return true;
  }

  function collectHighlightTextNodes(root, isQuestionPane) {
    const textNodes = [];
    if (!root) return textNodes;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    let cursor = 0;
    let node;
    while ((node = walker.nextNode())) {
      if (isQuestionPane && !isQuestionTextNodeHighlightable(node)) continue;
      const len = node.nodeValue ? node.nodeValue.length : 0;
      if (len > 0) {
        textNodes.push({ node, start: cursor, end: cursor + len });
        cursor += len;
      }
    }
    return textNodes;
  }

  function getHighlightRootForKey(paraIdx) {
    const key = String(paraIdx);
    if (key.startsWith('q')) {
      const qPane = document.getElementById('rp-questions-pane');
      if (!qPane) return null;
      const idx = Number(key.slice(1));
      const groups = qPane.querySelectorAll('.ins-q-group');
      const grp = groups[idx] || null;
      return grp ? { root: grp, isQuestionPane: true } : null;
    }
    const pPane = document.getElementById('rp-passage-content');
    if (!pPane) return null;
    const blk = pPane.querySelector(`.ins-para-block[data-para-idx="${paraIdx}"]`);
    const textRoot = blk?.querySelector('.rp-para-text');
    return textRoot ? { root: textRoot, isQuestionPane: false } : null;
  }

  function getSelectionParaOffsets(range) {
    if (!range) return [];
    const pPane = document.getElementById('rp-passage-content');
    if (pPane && pPane.contains(range.commonAncestorContainer)) {
      const blocks = Array.from(pPane.querySelectorAll('.ins-para-block'));
      const slices = [];
      for (const blk of blocks) {
        const textRoot = blk.querySelector('.rp-para-text');
        if (!textRoot || !range.intersectsNode(textRoot)) continue;
        const paraIdx = Number(blk.dataset.paraIdx);
        const totalLen = (textRoot.textContent || '').length;
        if (!totalLen) continue;

        let startOff = 0;
        let endOff = totalLen;
        if (textRoot.contains(range.startContainer)) {
          const pre = document.createRange();
          pre.selectNodeContents(textRoot);
          pre.setEnd(range.startContainer, range.startOffset);
          startOff = pre.toString().length;
        }
        if (textRoot.contains(range.endContainer)) {
          const preEnd = document.createRange();
          preEnd.selectNodeContents(textRoot);
          preEnd.setEnd(range.endContainer, range.endOffset);
          endOff = preEnd.toString().length;
        }
        startOff = Math.max(0, Math.min(totalLen, startOff));
        endOff = Math.max(0, Math.min(totalLen, endOff));
        if (endOff > startOff) slices.push({ paraIdx, start: startOff, end: endOff });
      }
      return slices;
    }

    // Question Pane highlighting (supports all question types while skipping inputs/selects/badges)
    const qPane = document.getElementById('rp-questions-pane');
    if (qPane && qPane.contains(range.commonAncestorContainer)) {
      const groups = Array.from(qPane.querySelectorAll('.ins-q-group'));
      const slices = [];
      groups.forEach((grp, gIdx) => {
        if (!range.intersectsNode(grp)) return;
        const textNodes = collectHighlightTextNodes(grp, true);
        let minStart = Infinity;
        let maxEnd = -1;
        for (const tn of textNodes) {
          if (!range.intersectsNode(tn.node)) continue;
          let sLocal = 0;
          let eLocal = tn.node.nodeValue.length;
          if (tn.node === range.startContainer) sLocal = Math.max(0, Math.min(eLocal, range.startOffset));
          if (tn.node === range.endContainer) eLocal = Math.max(0, Math.min(eLocal, range.endOffset));
          if (eLocal > sLocal) {
            minStart = Math.min(minStart, tn.start + sLocal);
            maxEnd = Math.max(maxEnd, tn.start + eLocal);
          }
        }
        if (maxEnd > minStart && Number.isFinite(minStart)) {
          slices.push({ paraIdx: `q${gIdx}`, start: minStart, end: maxEnd });
        }
      });
      return slices;
    }

    return [];
  }

  function applyStoredHighlightsToPassage(passageId) {
    // Unwrap existing marks in BOTH Passage and Questions panes so function is idempotent
    ['rp-passage-content', 'rp-questions-pane'].forEach((paneId) => {
      const el = document.getElementById(paneId);
      if (!el) return;
      el.querySelectorAll('mark.rp-hl-mark').forEach((m) => {
        const parent = m.parentNode;
        if (!parent) return;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
        parent.normalize();
      });
    });

    const rawList = getPassageHighlights(passageId);
    const hlFilter = state.session?.liveRoomId ? (state.session.liveHlFilter || 'all') : 'all';
    const list = hlFilter === 'none'
      ? []
      : (hlFilter === 'teacher' ? rawList.filter((h) => h.byRole === 'teacher') : rawList);
    if (!list.length) return;

    const byPara = new Map();
    for (const h of list) {
      if (!byPara.has(h.paraIdx)) byPara.set(h.paraIdx, []);
      byPara.get(h.paraIdx).push(h);
    }

    byPara.forEach((hlItems, paraIdx) => {
      const target = getHighlightRootForKey(paraIdx);
      if (!target) return;
      const textNodes = collectHighlightTextNodes(target.root, target.isQuestionPane);

      // Wrap intersecting text nodes from back to front so offsets stay exact
      for (let i = textNodes.length - 1; i >= 0; i--) {
        const tn = textNodes[i];
        const hits = hlItems.filter((h) => h.end > tn.start && h.start < tn.end);
        if (!hits.length) continue;

        const str = tn.node.nodeValue;
        const frag = document.createDocumentFragment();
        let pos = 0;
        const sortedHits = hits.slice().sort((a, b) => a.start - b.start);
        for (const h of sortedHits) {
          const sLocal = Math.max(0, h.start - tn.start);
          const eLocal = Math.min(str.length, h.end - tn.start);
          if (sLocal > pos) frag.appendChild(document.createTextNode(str.slice(pos, sLocal)));
          if (eLocal > sLocal) {
            const mark = document.createElement('mark');
            const isStart = (tn.start + sLocal) <= h.start;
            const isEnd = (tn.start + eLocal) >= h.end;
            const capCls = isStart && isEnd ? ' hl-cap-both' : (isStart ? ' hl-cap-start' : (isEnd ? ' hl-cap-end' : ''));
            const teacherCls = h.byRole === 'teacher' ? ' is-teacher-hl' : '';
            mark.className = `rp-hl-mark hl-${h.color || 'yellow'}${capCls}${teacherCls}`;
            mark.dataset.hlId = h.id;
            if (h.by) {
              mark.dataset.hlBy = h.by;
              mark.title = `${h.byRole === 'teacher' ? 'GV' : 'HS'} · ${h.by}`;
            }
            mark.textContent = str.slice(sLocal, eLocal);
            frag.appendChild(mark);
            pos = eLocal;
          }
        }
        if (pos < str.length) frag.appendChild(document.createTextNode(str.slice(pos)));
        tn.node.parentNode?.replaceChild(frag, tn.node);
      }
    });
  }

  function clearSelectionPreview() {
    ['rp-passage-content', 'rp-questions-pane'].forEach((paneId) => {
      const pane = document.getElementById(paneId);
      if (!pane) return;
      pane.querySelectorAll('mark.rp-hl-preview').forEach((m) => {
        const parent = m.parentNode;
        if (!parent) return;
        while (m.firstChild) parent.insertBefore(m.firstChild, m);
        parent.removeChild(m);
        parent.normalize();
      });
    });
  }

  function renderSelectionPreview(slices) {
    clearSelectionPreview();
    if (!Array.isArray(slices) || !slices.length) return;
    for (const sl of slices) {
      const target = getHighlightRootForKey(sl.paraIdx);
      if (!target) continue;
      const textNodes = collectHighlightTextNodes(target.root, target.isQuestionPane);
      for (let i = textNodes.length - 1; i >= 0; i--) {
        const tn = textNodes[i];
        if (sl.end <= tn.start || sl.start >= tn.end) continue;
        const str = tn.node.nodeValue;
        const sLocal = Math.max(0, sl.start - tn.start);
        const eLocal = Math.min(str.length, sl.end - tn.start);
        const frag = document.createDocumentFragment();
        if (sLocal > 0) frag.appendChild(document.createTextNode(str.slice(0, sLocal)));
        if (eLocal > sLocal) {
          const mark = document.createElement('mark');
          mark.className = 'rp-hl-preview';
          mark.textContent = str.slice(sLocal, eLocal);
          frag.appendChild(mark);
        }
        if (eLocal < str.length) frag.appendChild(document.createTextNode(str.slice(eLocal)));
        tn.node.parentNode?.replaceChild(frag, tn.node);
      }
    }
  }

  function updatePracticeHighlightBadge(passageId) {
    const cnt = getPassageHighlights(passageId).length;
    const badge = document.getElementById('prac-hl-count');
    if (badge) badge.textContent = String(cnt);
    const clearBtn = document.getElementById('prac-hl-clear-all');
    if (clearBtn) {
      clearBtn.disabled = cnt === 0;
      clearBtn.classList.toggle('is-empty', cnt === 0);
    }
  }

  function getCurrentLiveUser() {
    const u = B()?.getCurrentUser?.();
    const isT = isTeacherBypass();
    return {
      uid: getUid(),
      name: String(u?.name || (isT ? 'Giáo viên' : 'Học viên')),
      role: isT ? 'teacher' : 'student'
    };
  }

  function showLiveFocusToast(msg) {
    let el = document.getElementById('rp-live-focus-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'rp-live-focus-toast';
      el.className = 'rp-live-focus-toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('open');
    if (_liveFocusToastTimer) clearTimeout(_liveFocusToastTimer);
    _liveFocusToastTimer = setTimeout(() => {
      el.classList.remove('open');
    }, 4200);
  }

  function renderLiveRoomBarInnerHtml() {
    const live = window.LiveReadingRoom?.getActive?.();
    const s = state.session;
    if (!live || !s?.liveRoomId) return '';
    const members = window.LiveReadingRoom.getOnlineMembers();
    const meta = live.state?.meta || {};
    const isHost = !!live.isHost;
    const isCollab = meta.permission !== 'watch';
    const hlFilter = s.liveHlFilter || 'all';
    const statusLabel = live.status === 'connected'
      ? 'Realtime < 0.3s'
      : (live.status === 'connecting' ? 'Đang kết nối...' : 'Cục bộ (2 tab)');
    const statusCls = live.status === 'connected' ? 'is-online' : (live.status === 'error' ? 'is-err' : 'is-local');

    const avatarsHtml = members.slice(0, 6).map((m) => {
      const initials = String(m.name || 'U').trim().split(/\s+/).slice(-2).map((w) => w[0] || '').join('').toUpperCase().slice(0, 2);
      const isT = m.role === 'teacher';
      return `<span class="rp-live-av ${isT ? 'is-teacher' : ''}" style="--av-bg:${esc(m.color || '#4A7C59')};" title="${esc(m.name)}${isT ? ' (Giáo viên)' : ''}${m.isMe ? ' · Bạn' : ''}">${isT ? 'GV' : esc(initials)}</span>`;
    }).join('') + (members.length > 6 ? `<span class="rp-live-av is-more">+${members.length - 6}</span>` : '');

    return `
      <div class="rp-live-bar-l">
        <span class="rp-live-badge ${statusCls}" title="${esc(statusLabel)}">
          <span class="rp-live-dot" aria-hidden="true"></span>
          <span>LIVE</span>
        </span>
        <span class="rp-live-code tabular" title="Mã phòng làm chung">#${esc(live.roomId)}</span>
        <div class="rp-live-avatars" title="Đang trong phòng (${members.length})">${avatarsHtml}</div>
        <span class="rp-live-count tabular">${members.length} người</span>
      </div>
      <div class="rp-live-bar-r">
        ${isHost ? `
          <button type="button" class="rp-live-chip ${isCollab ? 'is-on' : ''}" id="rp-live-perm-btn"
            onclick="ReadingPracticeApp.setLivePermission('${isCollab ? 'watch' : 'collab'}')"
            title="Chuyển quyền phòng giống Google Docs: Cùng tô &amp; làm chung hoặc Chỉ xem Thầy chữa">
            ${isCollab ? '✏️ Cùng làm chung' : '👁 Chỉ xem Thầy chữa'}
          </button>
          <button type="button" class="rp-live-chip ${meta.revealAnswers ? 'is-on' : ''}" id="rp-live-reveal-btn"
            onclick="ReadingPracticeApp.toggleLiveRevealAnswers()"
            title="Bật/tắt chế độ Hiện đáp án &amp; Locate cho cả lớp cùng lúc">
            ${meta.revealAnswers ? '✓ Đang hiện đáp án lớp' : 'Hiện đáp án lớp'}
          </button>
        ` : `
          <span class="rp-live-chip is-static">${isCollab ? '✏️ Cùng làm chung' : '👁 Chỉ xem Thầy chữa'}</span>
        `}
        ${window.LiveReadingRoom.canLocalUserEdit() ? `
          <button type="button" class="rp-live-chip" id="rp-live-pull-btn"
            onclick="ReadingPracticeApp.broadcastLiveFocus()"
            title="Kéo màn hình cả lớp tới đúng câu hỏi / đoạn văn bạn đang chọn">
            📍 Kéo lớp tới đây
          </button>
        ` : ''}
        <button type="button" class="rp-live-chip ${hlFilter !== 'all' ? 'is-on' : ''}" id="rp-live-hlfilter-btn"
          onclick="ReadingPracticeApp.cycleLiveHighlightFilter()"
          title="Lọc hiển thị highlight trong phòng">
          ${hlFilter === 'teacher' ? '🎨 Chỉ màu Thầy' : (hlFilter === 'none' ? '🎨 Đang ẩn màu' : '🎨 Tất cả màu')}
        </button>
        <button type="button" class="rp-live-chip is-accent" id="rp-live-copy-btn"
          onclick="ReadingPracticeApp.openLiveShareModal()"
          title="Lấy link chia sẻ phòng làm chung &amp; cấu hình Realtime">
          🔗 Chia sẻ link
        </button>
        <button type="button" class="rp-live-chip is-exit" id="rp-live-leave-btn"
          onclick="ReadingPracticeApp.leaveLiveRoom()"
          title="Rời khỏi phòng làm chung">
          Rời phòng
        </button>
      </div>
    `;
  }

  function refreshLiveRoomBarInPlace() {
    const bar = document.getElementById('rp-live-bar');
    if (!bar) return;
    bar.innerHTML = renderLiveRoomBarInnerHtml();
  }

  function applyLiveAnswersToDom(passageId) {
    const s = state.session;
    if (!s) return;
    const activeEl = document.activeElement;
    const allQ = getAllSessionQuestions();
    allQ.forEach((q) => {
      const val = String(s.answers[q._qid] ?? '');
      const card = document.getElementById(`rp-qcard-${q._qid}`);
      if (!card) return;
      const inp = card.querySelector('input.ins-gap-input');
      if (inp && inp !== activeEl && inp.value !== val) {
        inp.value = val;
      }
      const sel = card.querySelector('select.ins-inline-select');
      if (sel && sel !== activeEl && sel.value !== val) {
        sel.value = val;
        sel.classList.toggle('is-filled', !!val);
      }
      card.querySelectorAll('.ins-sel-chip, .ins-tf-btn, .ins-mcq-opt').forEach((btn) => {
        const bVal = btn.getAttribute('data-val') || btn.textContent.trim();
        if (btn.classList.contains('ins-sel-chip') || btn.classList.contains('ins-tf-btn')) {
          btn.classList.toggle('is-selected', val.toUpperCase() === bVal.toUpperCase());
        }
      });
    });
    // Update bottom navigator boxes
    const pQs = allQ.filter((q) => q._pIdx === s.activePassageIdx);
    const boxes = document.querySelectorAll('.ins-qbox');
    pQs.forEach((q, i) => {
      if (boxes[i]) boxes[i].classList.toggle('is-attempted', String(s.answers[q._qid] || '').trim().length > 0);
    });
    const doneCnt = allQ.filter((q) => String(s.answers[q._qid] || '').trim()).length;
    const fill = document.querySelector('.prac-prog-fill');
    if (fill && allQ.length) fill.style.width = `${Math.round((doneCnt / allQ.length) * 100)}%`;
    const progStrong = document.querySelector('.prac-prog-pill strong');
    if (progStrong) progStrong.textContent = String(doneCnt);
  }

  function applyLiveRoomRemoteUpdate(roomData, changedPath) {
    const s = state.session;
    if (!s || !s.liveRoomId || !roomData) return;
    const live = window.LiveReadingRoom?.getActive?.();
    if (!live) return;

    _applyingLiveRemote = true;
    try {
      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      const meta = roomData.meta || {};

      // 1. Sync Reveal Answers mode from Host
      const wantReview = !!meta.revealAnswers;
      const isCurReview = s.mode === 'review';
      let needsFullRerender = false;
      if (wantReview && !isCurReview) {
        s.mode = 'review';
        s.reviewResult = computeReviewResult();
        needsFullRerender = true;
      } else if (!wantReview && isCurReview && !live.isHost) {
        s.mode = 'exam';
        needsFullRerender = true;
      }

      // 2. Sync Highlights (in-place, zero scroll jump!)
      if (roomData.highlights && typeof roomData.highlights === 'object') {
        s.highlights = JSON.parse(JSON.stringify(roomData.highlights));
        if (curPassage && !needsFullRerender) {
          applyStoredHighlightsToPassage(curPassage.id);
          updatePracticeHighlightBadge(curPassage.id);
        }
      }

      // 3. Sync Notes
      if (Array.isArray(roomData.notes)) {
        const prevLen = (s.notes || []).length;
        s.notes = roomData.notes.slice();
        const badge = document.querySelector('#rp-btn-notes .ins-notes-badge');
        if (s.notes.length > 0) {
          if (badge) badge.textContent = String(s.notes.length);
          else {
            const btn = document.getElementById('rp-btn-notes');
            if (btn) btn.insertAdjacentHTML('beforeend', `<span class="ins-notes-badge">${s.notes.length}</span>`);
          }
        } else if (badge) {
          badge.remove();
        }
        if (s.notesOpen && prevLen !== s.notes.length) {
          needsFullRerender = true;
        } else if (s.notesOpen && String(changedPath || '').includes('notes')) {
          needsFullRerender = true;
        }
      }

      // 4. Sync Shared Answers (when syncAnswers !== false)
      if (meta.syncAnswers !== false && roomData.answers && typeof roomData.answers === 'object') {
        let answerChanged = false;
        Object.entries(roomData.answers).forEach(([qid, rec]) => {
          const nextVal = rec && typeof rec === 'object' ? String(rec.val ?? '') : String(rec ?? '');
          if (String(s.answers[qid] ?? '') !== nextVal) {
            s.answers[qid] = nextVal;
            answerChanged = true;
          }
        });
        if (answerChanged && !needsFullRerender) {
          applyLiveAnswersToDom(curPassage?.id);
        }
      }

      // 5. Sync Live Focus / Locate Pointer
      const foc = roomData.focus;
      if (foc && Number(foc.ts || 0) > _lastLiveFocusTs && foc.byClientId !== window.LiveReadingRoom.getClientId()) {
        _lastLiveFocusTs = Number(foc.ts || 0);
        if (foc.kind === 'loc' && foc.passageId) {
          const pIdx = (s.passageIds || []).indexOf(foc.passageId);
          if (pIdx >= 0) s.activePassageIdx = pIdx;
          s.activeEvidenceId = null;
          s.activeEvidenceLoc = { passageId: foc.passageId, p: Number(foc.p) || 0, s: Number(foc.s) || 0, e: Number(foc.e) || 0, qnum: Number(foc.qnum) || 0 };
          needsFullRerender = true;
          setTimeout(() => {
            const sp = document.querySelector('.rp-ev-span[data-ev-loc="active"]');
            if (sp) {
              sp.scrollIntoView({ behavior: 'smooth', block: 'center' });
              sp.classList.add('rp-live-pulse');
            }
          }, 80);
          showLiveFocusToast(`📍 ${foc.by || 'Giáo viên'} đang chỉ dẫn chứng Câu ${foc.qnum || ''}`);
        } else if (foc.kind === 'ev' && foc.evId) {
          s.activeEvidenceLoc = null;
          s.activeEvidenceId = foc.evId;
          needsFullRerender = true;
          setTimeout(() => {
            document.querySelector(`.rp-ev-span[data-ev-id="${foc.evId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 80);
          showLiveFocusToast(`📍 ${foc.by || 'Giáo viên'} đang chỉ dẫn chứng`);
        } else if (foc.kind === 'q' && foc.qid) {
          if (typeof foc.pIdx === 'number' && foc.pIdx !== s.activePassageIdx) {
            s.activePassageIdx = foc.pIdx;
            needsFullRerender = true;
          }
          s.activeQid = foc.qid;
          setTimeout(() => {
            const el = document.getElementById(`rp-qcard-${foc.qid}`) || document.querySelector(`[data-mh-qid="${foc.qid}"]`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.remove('rp-live-pulse');
              void el.offsetWidth;
              el.classList.add('rp-live-pulse');
            }
          }, needsFullRerender ? 80 : 10);
          showLiveFocusToast(`📍 ${foc.by || 'Giáo viên'}: ${foc.label || 'Đang giảng câu này'}`);
        } else if (foc.kind === 'para' && foc.paraIdx !== undefined) {
          setTimeout(() => {
            const blk = document.querySelector(`#rp-passage-content .ins-para-block[data-para-idx="${foc.paraIdx}"]`);
            if (blk) {
              blk.scrollIntoView({ behavior: 'smooth', block: 'center' });
              blk.classList.remove('rp-live-pulse');
              void blk.offsetWidth;
              blk.classList.add('rp-live-pulse');
            }
          }, 20);
          showLiveFocusToast(`📍 ${foc.by || 'Giáo viên'} đang chỉ đoạn ${Number(foc.paraIdx) + 1}`);
        }
      }

      if (needsFullRerender) {
        renderExamWorkspace();
      } else {
        refreshLiveRoomBarInPlace();
      }
    } finally {
      _applyingLiveRemote = false;
    }
  }

  function connectCurrentSessionToLiveRoom(roomId, isHost, dbUrl) {
    const s = state.session;
    if (!s || !window.LiveReadingRoom) return null;
    s.liveRoomId = roomId;
    s.liveHlFilter = s.liveHlFilter || 'all';
    stopReadingAntiCheat();
    const room = window.LiveReadingRoom.joinRoom({
      roomId,
      passageId: s.itemId,
      isFull: !!s.isFull,
      isHost: !!isHost,
      dbUrl: dbUrl || '',
      user: getCurrentLiveUser(),
      initialHighlights: s.highlights || {},
      initialNotes: s.notes || [],
      initialAnswers: s.answers || {},
      onUpdate: (roomData, changedPath) => applyLiveRoomRemoteUpdate(roomData, changedPath),
      onStatus: () => refreshLiveRoomBarInPlace()
    });
    renderExamWorkspace();
    return room;
  }

  function computeReviewResult() {
    const allQ = getAllSessionQuestions();
    let score = 0;
    const byType = {};
    allQ.forEach((q) => {
      const ok = isAnswerCorrect(q, state.session.answers[q._qid]);
      if (ok) score += 1;
      const t = q.type || 'other';
      if (!byType[t]) byType[t] = { label: qTypeLabel(t), correct: 0, total: 0 };
      byType[t].total += 1;
      if (ok) byType[t].correct += 1;
    });
    const total = allQ.length;
    return { score, total, band: estimateBand(score, total), elapsedSec: state.session.elapsedSec, byType: Object.values(byType) };
  }

  /* ---------- PASSAGE PARAGRAPH RENDERER (Matching Headings Drop Zones + Clickable Dict Words) ---------- */
  function getMatchingHeadingForPara(passage, paraLabel) {
    for (const g of (passage.groups || [])) {
      if (g.type === 'matching_headings') {
        const q = (g.questions || []).find((x) => String(x.sectionLabel).toUpperCase() === String(paraLabel).toUpperCase());
        if (q) return { group: g, q };
      }
    }
    return null;
  }

  function renderPassageParagraphHtml(para, paraIdx, passage, enableDictClick, isReview) {
    const s = state.session;
    const isPractice = s?.studyMode === 'practice';
    const savedSet = (window.MyVocabStore && typeof window.MyVocabStore.getSavedWordSet === 'function')
      ? window.MyVocabStore.getSavedWordSet()
      : new Set();

    const tokenWrap = (plainText) => {
      if (!enableDictClick) return esc(plainText);
      return plainText.split(/([A-Za-z][A-Za-z'-]*)/g).map((seg) => {
        if (/^[A-Za-z][A-Za-z'-]*$/.test(seg) && seg.length >= 3) {
          const low = seg.toLowerCase();
          const isSaved = savedSet.has(low);
          const inGloss = !!(passage.glossary && passage.glossary[low]);
          const cls = `rp-word${isSaved ? ' rp-saved-word' : ''}${inGloss ? ' rp-gloss-word' : ''}`;
          return `<span class="${cls}" data-word="${esc(seg)}">${esc(seg)}</span>`;
        }
        return esc(seg);
      }).join('');
    };

    const raw = String(para.en || '');
    const activeLoc = s?.activeEvidenceLoc;
    let enHtml = '';
    if (activeLoc && activeLoc.passageId === passage.id && activeLoc.p === paraIdx && !raw.includes('<ev ')) {
      const st = Math.max(0, Math.min(raw.length, Number(activeLoc.s) || 0));
      const en = Math.max(st, Math.min(raw.length, Number(activeLoc.e) || st));
      if (en > st) {
        enHtml = `${tokenWrap(raw.slice(0, st))}<span class="rp-ev-span rp-evidence-active" data-ev-loc="active">${tokenWrap(raw.slice(st, en))}</span>${tokenWrap(raw.slice(en))}`;
      } else {
        enHtml = tokenWrap(raw);
      }
    } else {
      const parts = raw.split(/(<ev id="[^"]+">[\s\S]*?<\/ev>)/g);
      enHtml = parts.map((chunk) => {
        const m = chunk.match(/^<ev id="([^"]+)">([\s\S]*?)<\/ev>$/);
        if (m) {
          const activeCls = s?.activeEvidenceId === m[1] ? ' rp-evidence-active' : '';
          return `<span class="rp-ev-span${activeCls}" data-ev-id="${esc(m[1])}">${tokenWrap(m[2])}</span>`;
        }
        return tokenWrap(chunk);
      }).join('');
    }

    // Inspera Dashed Blue Drop Zone above paragraph for Matching Headings (like step_41_shot_2!)
    let dropZoneHtml = '';
    const mh = getMatchingHeadingForPara(passage, para.label);
    if (mh) {
      const qid = `${passage.id}__q${mh.q.num}`;
      const pickedKey = String(s.answers[qid] || '');
      const pickedObj = (mh.group.headings || []).find((h) => h.key === pickedKey);
      const isLockedOk = !isReview && !!s.lockedCorrect?.[qid];
      const isWrongRetry = !isReview && !!s.wrongSet?.[qid];
      const isOk = isReview ? isAnswerCorrect(mh.q, pickedKey) : isLockedOk;
      const cls = `ins-dropzone${pickedObj ? ' is-filled' : ''}${state.selectedHeadingKey && !isReview && !isLockedOk ? ' is-awaiting' : ''}${(isReview || isLockedOk) ? (isOk ? ' is-ok' : ' is-bad') : (isWrongRetry ? ' is-bad' : '')}`;
      dropZoneHtml = `
        <div class="${cls}" data-mh-qid="${esc(qid)}"
          ondragover="${isReview || isLockedOk ? '' : 'event.preventDefault(); this.classList.add(\'is-over\');'}"
          ondragleave="this.classList.remove('is-over');"
          ondrop="${isReview || isLockedOk ? '' : `ReadingPracticeApp.onDropHeading(event, '${esc(qid)}')`}"
          onclick="${isReview || isLockedOk ? '' : `ReadingPracticeApp.onClickDropZone('${esc(qid)}')`}">
          ${pickedObj
            ? `<span class="ins-dz-num">${mh.q.num}</span><span class="ins-dz-text">${esc(pickedObj.text)}</span>${!isReview && !isLockedOk ? `<button type="button" class="ins-dz-clear" onclick="event.stopPropagation(); ReadingPracticeApp.clearHeading('${esc(qid)}')" title="Gỡ tiêu đề">✕</button>` : ''}`
            : `<span class="ins-dz-placeholder">${mh.q.num}</span>`}
        </div>
      `;
    }

    const viBlock = (s?.showBilingual && para.vi)
      ? `<div class="rp-para-vi">${esc(para.vi)}</div>`
      : '';

    return `
      <div class="ins-para-block" data-para-idx="${paraIdx}" data-para-label="${esc(para.label || '')}">
        ${dropZoneHtml}
        <p class="ins-para-en">
          ${para.label ? `<strong class="ins-para-lbl">${esc(para.label)}</strong> ` : ''}
          <span class="rp-para-text">${enHtml}</span>
        </p>
        ${viBlock}
      </div>
    `;
  }

  /* ---------- RENDER FULL-SCREEN WORKSPACE (EXAM 1:1 OR PRACTICE PRO STUDIO) ---------- */
  function renderExamWorkspace() {
    const root = getRoot();
    if (!root || !state.session) return;
    const s = state.session;
    const passages = getSessionPassages();
    const curPassage = passages[s.activePassageIdx] || passages[0];
    if (!curPassage) return;

    // Preserve pane scroll positions across re-renders
    const prevPassageScroll = document.getElementById('rp-passage-pane')?.scrollTop ?? 0;
    const prevQuestScroll = document.getElementById('rp-questions-pane')?.scrollTop ?? 0;
    const prevPassageId = document.getElementById('rp-workspace')?.dataset?.passageId || '';
    const samePassage = prevPassageId === curPassage.id;

    const isReview = s.mode === 'review';
    const solSrc = curPassage.source || s.source;
    if (isReview && !s.isNews && !_loadedSolutions[solSrc]) {
      ensureSourceSolutionsLoaded(solSrc).then(() => {
        if (state.session === s && state.session.mode === 'review') renderExamWorkspace();
      });
    }
    const isPractice = s.studyMode === 'practice';
    // STRICT RULE: Dictionary is LOCKED during active Practice & Exam — ONLY unlocked after 100% completion (Review) or News!
    const enableDict = isReview || s.isNews;
    const allQ = getAllSessionQuestions();
    if (!s.activeQid && allQ.length) {
      const firstInP = allQ.find((q) => q._pIdx === s.activePassageIdx) || allQ[0];
      s.activeQid = firstInP?._qid || null;
    }

    const curQs = allQ.filter((q) => q._pIdx === s.activePassageIdx);
    const qMin = curQs.length ? curQs[0].num : 1;
    const qMax = curQs.length ? curQs[curQs.length - 1].num : curQs.length;
    const curGlobalIdx = allQ.findIndex((q) => q._qid === s.activeQid);

    const totalAnswered = allQ.filter((x) => String(s.answers[x._qid] || '').trim()).length;
    const progressPct = allQ.length ? Math.round((totalAnswered / allQ.length) * 100) : 0;

    const lockedCount = Object.keys(s.lockedCorrect || {}).length;
    const wrongQids = allQ.filter((q) => !!s.wrongSet?.[q._qid]).map((q) => q._qid);
    const wrongCount = wrongQids.length;
    const isRetryPhase = !isReview && s.attemptCount > 0 && wrongCount > 0;
    const curHlCount = getPassageHighlights(curPassage.id).length;

    const effectiveContrast = isPractice ? (s.contrast || 'totoro') : 'cd';
    const contrastCls = `ins-contrast-${effectiveContrast}`;
    const sizeCls = `ins-size-${s.textSize || 'regular'}`;
    const modeCls = isPractice ? 'ins-mode-practice' : 'ins-mode-exam';
    const timerUrgency = !isPractice && s.remainingSec <= 300 ? ' is-critical' : (!isPractice && s.remainingSec <= 600 ? ' is-warn' : '');

    // Polished Review Metrics Ribbon (Ảnh 2 + Ảnh 3: clean 3 KPI pills, NO "Solution & Từ điển đã mở khóa", NO duplicate "Về kho đề")
    const firstTry = s.firstAttemptResult || s.reviewResult;
    const isMasteredNow = !!(s.reviewResult && s.reviewResult.total > 0 && s.reviewResult.score === s.reviewResult.total);
    const reviewStripHtml = isReview && s.reviewResult ? `
      <div class="ins-review-strip is-refined">
        <div class="rp-rev-kpi-group">
          <div class="rp-rev-kpi-pill is-band">
            <span class="rp-rk-lbl">Band lần đầu</span>
            <strong class="rp-rk-val tabular">${(firstTry?.band ?? s.reviewResult.band).toFixed(1)}</strong>
          </div>
          <div class="rp-rev-kpi-pill">
            <span class="rp-rk-lbl">Điểm lần đầu</span>
            <strong class="rp-rk-val tabular">${firstTry?.score ?? s.reviewResult.score} / ${s.reviewResult.total}</strong>
          </div>
          <div class="rp-rev-kpi-pill ${isMasteredNow ? 'is-done' : ''}">
            <span class="rp-rk-lbl">${isMasteredNow ? 'Hoàn thành 100%' : 'Tổng thời gian'}</span>
            <strong class="rp-rk-val tabular">${Math.max(1, s.attemptCount || 1)} lần nộp · ${formatDuration(s.reviewResult.elapsedSec)}</strong>
          </div>
        </div>
        <div class="rp-rev-hint-txt">Bấm vào từ để tra &amp; lưu · Bấm Locate xem dẫn chứng</div>
      </div>
    ` : '';

    // Retry Mastery Gate Banner (shown after submitting with wrong answers — NO answer key revealed!)
    const retryBannerHtml = isRetryPhase ? `
      <div class="rp-retry-banner" id="rp-retry-banner" role="status">
        <div class="rp-retry-copy">
          <span class="rp-retry-pill tabular">Lần nộp #${s.attemptCount}</span>
          <span>Đã đúng <strong>${lockedCount}/${allQ.length}</strong> câu · Còn <strong>${wrongCount} câu sai</strong> — sửa các câu báo đỏ rồi bấm <strong>Nộp lại</strong>.</span>
        </div>
        <div class="rp-retry-actions">
          <button type="button" class="rp-retry-result-btn" onclick="ReadingPracticeApp.openResultModal()">Xem bảng kết quả</button>
          <button type="button" class="rp-retry-jump-btn" onclick="ReadingPracticeApp.jumpToNextWrong()">Câu sai tiếp theo →</button>
        </div>
      </div>
    ` : '';

    // Anti-Cheat Warning Banner (visible when strike occurred)
    const antiCheatBannerHtml = (!isReview && s.antiCheatNotice) ? `
      <div class="rp-ac-banner" id="rp-ac-banner" role="alert">
        <span>⚠ ${esc(s.antiCheatNotice)}</span>
        <button type="button" class="rp-ac-dismiss" onclick="ReadingPracticeApp.dismissAntiCheatNotice()" aria-label="Đóng thông báo">✕</button>
      </div>
    ` : '';

    // Part Sub-Banner (ONLY in 1:1 Exam mode or News; Practice uses serene 1-bar layout!)
    const partLabel = s.isNews ? (curPassage.newsSource || 'Academic News') : `Part ${curPassage.passageNum || (s.activePassageIdx + 1)}`;
    const partSubText = s.isNews
      ? `Bấm vào bất kỳ từ nào để tra nghĩa & lưu vào "Từ của tôi" · ${curQs.length} câu kiểm tra nhanh.`
      : `Read the text and answer questions ${qMin}–${qMax}.`;

    const groupsHtml = (curPassage.groups || []).map((g) => renderQuestionGroup(g, curPassage, isReview)).join('');

    // Subtle clean meta header inside the left Washi sheet in Practice mode (no decorative eyebrow box or squiggle!)
    const practicePassageEyebrowHtml = isPractice ? `
      <div class="prac-sheet-meta-bar">
        <span class="prac-meta-subtle">${esc(partLabel)} · Questions ${qMin}–${qMax}</span>
        <button type="button"
          class="prac-eyebrow-clear ${curHlCount === 0 ? 'is-empty' : ''}"
          id="prac-hl-clear-all"
          ${curHlCount === 0 ? 'disabled' : ''}
          onclick="ReadingPracticeApp.clearAllPassageHighlights()"
          title="Xóa toàn bộ highlight pastel trong bài đọc này">
          Xóa <span id="prac-hl-count">${curHlCount}</span> màu
        </button>
      </div>
    ` : '';

    // Bottom Navigator Bar
    const bottomPartsHtml = passages.map((p, pIdx) => {
      const pQs = allQ.filter((q) => q._pIdx === pIdx);
      const pDone = pQs.filter((q) => String(s.answers[q._qid] || '').trim()).length;
      const isActPart = pIdx === s.activePassageIdx;
      const pTitle = s.isNews ? 'Questions' : `Part ${p.passageNum || (pIdx + 1)}`;
      if (!isActPart) {
        return `
          <button type="button" class="ins-part-collapsed" onclick="ReadingPracticeApp.switchExamPassage(${pIdx})">
            <strong>${esc(pTitle)}</strong>
            <span class="tabular">${pDone} of ${pQs.length}</span>
          </button>
        `;
      }
      const qBoxesHtml = pQs.map((q) => {
        const val = String(s.answers[q._qid] || '').trim();
        const isFlg = !!s.flagged[q._qid];
        const isCur = s.activeQid === q._qid;
        const isLockedOk = !isReview && !!s.lockedCorrect?.[q._qid];
        const isWrongRetry = !isReview && !!s.wrongSet?.[q._qid];
        let cls = 'ins-qbox';
        if (isCur) cls += ' is-current';
        if (isReview) {
          cls += isAnswerCorrect(q, val) ? ' is-correct' : ' is-wrong';
        } else if (isLockedOk) {
          cls += ' is-correct';
        } else if (isWrongRetry) {
          cls += s.wrongSet[q._qid] === 'edited' ? ' is-attempted is-retry-edited' : ' is-wrong';
        } else {
          if (val) cls += ' is-attempted';
          if (isFlg) cls += ' is-review';
        }
        return `
          <button type="button" class="${cls}" onclick="ReadingPracticeApp.jumpToQuestion(${pIdx}, '${esc(q._qid)}')" title="Question ${q.num}">
            <span class="ins-qbox-dash"></span>
            <span class="ins-qbox-num">${q.num}</span>
          </button>
        `;
      }).join('');
      return `
        <div class="ins-part-expanded">
          <strong class="ins-part-lbl">${esc(pTitle)}</strong>
          <div class="ins-qboxes-row">${qBoxesHtml}</div>
        </div>
      `;
    }).join('');

    const notesCount = (s.notes || []).length;
    const notesDrawerHtml = `
      <aside class="ins-notes-sidebar ${s.notesOpen ? 'open' : ''}" id="rp-notes-drawer" aria-label="Notes">
        <div class="ins-notes-header">
          <span>Notes${notesCount ? ` (${notesCount})` : ''}</span>
          <button type="button" class="ins-notes-close" onclick="ReadingPracticeApp.toggleNotesDrawer(false)" aria-label="Close notes">✕</button>
        </div>
        <div class="ins-notes-body">
          ${notesCount ? `
            <div class="ins-notes-list">
              ${s.notes.map((n) => `
                <div class="ins-note-card">
                  ${n.quote ? `<div class="ins-note-quote">“${esc(n.quote)}”</div>` : ''}
                  <div class="ins-note-text">${esc(n.text)}</div>
                  <button type="button" class="ins-note-del" onclick="ReadingPracticeApp.deleteNote('${esc(n.id)}')">Delete</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="ins-notes-empty">
              <strong>Your private notes will show here</strong>
              <p>Select text to highlight or create a note.</p>
            </div>
          `}
          <form class="ins-notes-form" onsubmit="ReadingPracticeApp.addManualNote(event)">
            <textarea id="rp-note-input" rows="2" placeholder="Add a private note..."></textarea>
            <button type="submit" class="ins-note-save-btn">+ Save note</button>
          </form>
        </div>
      </aside>
    `;

    // Anchored Totoro "Giao diện" Popover for Practice (now with 6 Pastel Highlight Palettes from Reference Image 5!)
    const activePalette = getActivePalette();
    const activePens = getActivePastelPens();
    const paletteGridHtml = PASTEL_PALETTES.map((pal) => {
      const isCurPal = pal.id === activePalette.id;
      return `
        <button type="button" class="prac-pal-card ${isCurPal ? 'is-active' : ''}"
          data-hl-palette="${pal.id}"
          aria-pressed="${isCurPal ? 'true' : 'false'}"
          onclick="ReadingPracticeApp.setHighlightPalette('${pal.id}')">
          <div class="prac-pal-top">
            <span class="prac-pal-name">${esc(pal.name)}</span>
            ${isCurPal ? '<span class="prac-pal-chk" aria-hidden="true">✓</span>' : ''}
          </div>
          <div class="prac-pal-dots" aria-hidden="true">
            ${pal.colors.map((c) => `<span class="prac-pal-dot" style="background:${c};"></span>`).join('')}
          </div>
          <div class="prac-pal-sub">${esc(pal.sub)}</div>
        </button>
      `;
    }).join('');

    const practiceAppearancePopHtml = isPractice ? `
      <div class="prac-pop-wrap" onclick="event.stopPropagation()">
        <button type="button" class="prac-hdr-btn ${s.optionsOpen ? 'active' : ''}" id="ins-btn-options"
          onclick="ReadingPracticeApp.toggleOptionsOverlay()" title="Tùy chỉnh nền giấy, cỡ chữ &amp; 6 bộ màu Highlight Pastel" aria-label="Giao diện">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Giao diện</span>
        </button>
        <div class="prac-popover prac-popover-wide ${s.optionsOpen ? 'open' : ''}" id="ins-options-overlay" role="dialog" aria-label="Tùy chỉnh hiển thị">
          <div id="prac-opt-contrast-card">
            <div class="prac-pop-lbl">Nền giấy đọc bài</div>
            <div class="prac-pop-seg" style="margin-bottom:10px;">
              <button type="button" class="prac-seg-btn ${s.contrast === 'totoro' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('totoro')">Washi ấm</button>
              <button type="button" class="prac-seg-btn ${s.contrast === 'cd' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('cd')">Trắng sáng</button>
              <button type="button" class="prac-seg-btn ${s.contrast === 'sepia' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('sepia')">Xanh sương</button>
            </div>
          </div>
          <div class="prac-pop-lbl">Cỡ chữ bài đọc</div>
          <div class="prac-pop-seg" style="margin-bottom:12px;">
            <button type="button" class="prac-seg-btn ${s.textSize === 'regular' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('regular')">Vừa</button>
            <button type="button" class="prac-seg-btn ${s.textSize === 'large' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('large')">Lớn</button>
            <button type="button" class="prac-seg-btn ${s.textSize === 'xlarge' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('xlarge')">Rất lớn</button>
          </div>
          <div class="prac-pop-lbl-row">
            <span class="prac-pop-lbl" style="margin:0;">Bảng màu Highlight Pastel</span>
            <span class="prac-pop-subtag">6 bộ dịu mắt</span>
          </div>
          <div class="prac-pal-grid" id="rp-palette-grid">
            ${paletteGridHtml}
          </div>
          ${curHlCount > 0 ? `
            <div class="prac-pop-sep"></div>
            <button type="button" class="prac-pop-danger-btn" onclick="ReadingPracticeApp.clearAllPassageHighlights(); ReadingPracticeApp.toggleOptionsOverlay(false);">
              Xóa toàn bộ ${curHlCount} highlight
            </button>
          ` : ''}
        </div>
      </div>
    ` : '';

    const optionsOverlayHtml = !isPractice ? `
      <div class="ins-options-overlay ${s.optionsOpen ? 'open' : ''}" id="ins-options-overlay">
        <div class="ins-options-head">
          <h2>Options</h2>
          <button type="button" class="ins-options-x" onclick="ReadingPracticeApp.toggleOptionsOverlay(false)" aria-label="Close options">✕</button>
        </div>
        <div class="ins-options-body">
          ${!isReview ? `
            <button type="button" class="ins-opt-submit-btn" onclick="ReadingPracticeApp.toggleOptionsOverlay(false); ReadingPracticeApp.openPreSubmitModal();">
              <span>Go to submission page (Nộp bài)</span>
              <span>›</span>
            </button>
          ` : ''}

          <div class="ins-opt-card">
            <div class="ins-opt-sec-title">Text size (Cỡ chữ phòng thi)</div>
            <div class="ins-opt-choices">
              <button type="button" class="ins-opt-row ${s.textSize === 'regular' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('regular')">
                <span>Regular</span><span>${s.textSize === 'regular' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.textSize === 'large' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('large')">
                <span>Large</span><span>${s.textSize === 'large' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.textSize === 'xlarge' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('xlarge')">
                <span>Extra large</span><span>${s.textSize === 'xlarge' ? '✓' : ''}</span>
              </button>
            </div>
          </div>

          <button type="button" class="ins-opt-exit-btn" onclick="ReadingPracticeApp.exitToHub()">← Kết thúc &amp; Chấm điểm (Thoát ra kho đề)</button>
        </div>
      </div>
    ` : '';

    // Header Left + Right
    const brandBlockHtml = isPractice
      ? `
        <button type="button" class="prac-back-btn" onclick="ReadingPracticeApp.exitToHub()" title="${isReview || s.isNews ? 'Quay về kho đề' : 'Kết thúc bài & chấm điểm ngay (không lưu làm dở)'}" aria-label="Quay về kho đề">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          <span>Kho đề</span>
        </button>
        <span class="prac-totoro-ico" aria-hidden="true">
          <svg viewBox="0 0 36 36" fill="none">
            <path d="M12.5 13L10 6.5C9.7 5.7 10.6 5.2 11.2 5.7L15.4 9.2" fill="#637067" stroke="#2F3B34" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M23.5 13L26 6.5C26.3 5.7 25.4 5.2 24.8 5.7L20.6 9.2" fill="#637067" stroke="#2F3B34" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M18 8.6C18 6.4 19.9 5.3 21.8 5.8C21.3 7.8 19.7 9 18 8.6Z" fill="#4E724D" stroke="#2F4D31" stroke-width="1" stroke-linejoin="round"/>
            <path d="M9.5 23.5C9.5 15.2 13 10.2 18 10.2C23 10.2 26.5 15.2 26.5 23.5C26.5 28.4 23 30.8 18 30.8C13 30.8 9.5 28.4 9.5 23.5Z" fill="#6B756D" stroke="#2F3B34" stroke-width="1.4"/>
            <ellipse cx="18" cy="24.5" rx="6.4" ry="4.6" fill="#EFE6D8"/>
            <path d="M14.4 23.6L15.6 22.3L16.8 23.6M17.2 23.2L18.2 22L19.2 23.2M19.6 23.6L20.8 22.3L22 23.6" stroke="#5D645E" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
            <circle cx="14.6" cy="16.2" r="1.65" fill="#FFFDF8"/><circle cx="14.8" cy="16.2" r="0.85" fill="#232B26"/>
            <circle cx="21.4" cy="16.2" r="1.65" fill="#FFFDF8"/><circle cx="21.2" cy="16.2" r="0.85" fill="#232B26"/>
            <ellipse cx="18" cy="17.1" rx="1.25" ry="0.65" fill="#232B26"/>
          </svg>
        </span>
      `
      : `<span class="ins-brand-mark">IELTS</span>`;

    const timerBlockHtml = !isReview
      ? (isPractice
        ? `
          <div class="prac-timer-pill">
            <span class="prac-live-dot ${s.paused ? 'is-paused' : ''}" aria-hidden="true"></span>
            ${s.showTimer ? `
              <button type="button" class="ins-hdr-timer" onclick="ReadingPracticeApp.togglePauseTimer()" title="Bấm để tạm dừng / tiếp tục đồng hồ">
                <span class="tabular" id="rp-timer-exact">${formatDuration(s.remainingSec)}</span>
                <span class="sr-only" id="rp-timer-display">${formatMinsRemaining(s.remainingSec)}</span>
                ${s.paused ? '<span class="ins-paused-tag">PAUSED</span>' : ''}
              </button>
            ` : `<span class="prac-timer-hidden-lbl">Tự do</span>`}
            <button type="button" class="prac-timer-eye" onclick="ReadingPracticeApp.toggleTimerVisibility()" title="${s.showTimer ? 'Ẩn đồng hồ' : 'Hiện đồng hồ'}" aria-label="${s.showTimer ? 'Ẩn đồng hồ' : 'Hiện đồng hồ'}">
              ${s.showTimer
                ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
                : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'}
            </button>
          </div>
        `
        : `
          <button type="button" class="ins-hdr-timer${timerUrgency}" onclick="ReadingPracticeApp.togglePauseTimer()" title="Bấm để tạm dừng / tiếp tục đồng hồ">
            <span id="rp-timer-display">${formatMinsRemaining(s.remainingSec)}</span>
            <span class="ins-timer-exact tabular" id="rp-timer-exact">(${formatDuration(s.remainingSec)})</span>
            ${s.paused ? '<span class="ins-paused-tag">PAUSED</span>' : ''}
          </button>
        `)
      : '';

    const practiceProgPillHtml = (isPractice && !isReview) ? `
      <div class="prac-prog-pill tabular" title="Tiến độ trả lời bài hiện tại">
        <span><strong>${totalAnswered}</strong>/${allQ.length} câu</span>
        <span class="prac-prog-track" aria-hidden="true"><span class="prac-prog-fill" style="width:${progressPct}%;"></span></span>
      </div>
    ` : '';

    // Anti-Cheat Shield Status Pill (active in solo Practice & Exam; hidden in collaborative Live Room)
    const antiCheatPillHtml = (!isReview && !s.isNews && !s.liveRoomId) ? `
      <span class="rp-ac-shield ${s.antiCheatStrikes > 0 ? 'is-warn' : ''}" id="rp-ac-shield"
        title="Chống gian lận đang bật: khóa Ctrl+F, khóa từ điển &amp; cảnh báo chuyển tab (tối đa 2 lần) · Cho phép Copy/Paste chuẩn CD-IELTS">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>${s.antiCheatStrikes > 0 ? `Cảnh báo ${s.antiCheatStrikes}/2` : 'Anti-Cheat'}</span>
      </span>
    ` : '';

    // Calm distraction-free Practice sheets (no decorative corner brackets, squiggle rules, or watermarks over reading text)
    const practiceStampSvg = '';
    const practiceTitleRuleSvg = '';

    // Selection Popover: Practice shows 6 silky pastel dots from active palette + Ghi chú + Xóa (Tra & Lưu STRICTLY unlocked only in Review/Solutions or News!)
    const selPopoverHtml = isPractice ? `
      <div class="ins-sel-popover is-practice hidden" id="rp-hl-toolbar" role="toolbar" aria-label="Highlight màu pastel" onmousedown="event.stopPropagation()">
        <div class="prac-pop-swatches">
          ${activePens.map((pen) => `
            <button type="button"
              class="prac-pop-dot ${s.activePenColor === pen.id ? 'is-active' : ''}"
              style="--swatch:${pen.swatch};--swatch-line:${pen.line};"
              data-pop-color="${pen.id}"
              title="${esc(pen.name)} — ${esc(pen.role)}"
              aria-label="Highlight ${esc(pen.name)}"
              onclick="ReadingPracticeApp.applyHighlight('${pen.id}')"></button>
          `).join('')}
        </div>
        <div class="prac-pop-divider" aria-hidden="true"></div>
        <button type="button" class="ins-sel-act prac-pop-act" onclick="ReadingPracticeApp.addNoteFromSelection()" title="Tạo ghi chú">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Ghi chú</span>
        </button>
        ${enableDict ? '<button type="button" class="ins-sel-dict prac-pop-dict" onclick="ReadingPracticeApp.lookupSelectedPhrase()" title="Tra nghĩa và lưu vào Từ của tôi">Tra &amp; Lưu</button>' : ''}
        <button type="button" class="ins-sel-clear prac-pop-clear" onclick="ReadingPracticeApp.clearSelectionHighlight()" title="Xóa màu đoạn chọn">Xóa</button>
      </div>
    ` : `
      <div class="ins-sel-popover hidden" id="rp-hl-toolbar" onmousedown="event.stopPropagation()">
        <button type="button" class="ins-sel-act" onclick="ReadingPracticeApp.addNoteFromSelection()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Note</span>
        </button>
        <button type="button" class="ins-sel-act" onclick="ReadingPracticeApp.applyHighlight('yellow')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
          <span>Highlight</span>
        </button>
        <button type="button" class="ins-sel-clear" onclick="ReadingPracticeApp.clearSelectionHighlight()" title="Xóa highlight">Clear</button>
        ${enableDict ? '<button type="button" class="ins-sel-dict" onclick="ReadingPracticeApp.lookupSelectedPhrase()">Tra &amp; Lưu</button>' : ''}
      </div>
    `;

    // Review Header Actions (unified directly into Row 1 so there is ZERO duplicate "Về kho đề" or bloated double action bar!)
    const reviewHeaderActionsHtml = isReview ? `
      <div class="rp-hdr-rev-acts">
        <button type="button" class="prac-hdr-btn is-compact" onclick="ReadingPracticeApp.openResultModal()">Bảng kết quả</button>
        <button type="button" class="prac-hdr-btn is-compact ${s.showBilingual ? 'is-on' : ''}" id="rp-btn-bilingual" onclick="ReadingPracticeApp.toggleBilingual()">
          ${s.showBilingual ? '✓ Dịch song ngữ' : 'Dịch song ngữ'}
        </button>
        <button type="button" class="prac-hdr-btn is-compact" onclick="ReadingPracticeApp.retryCurrent()">Làm lại</button>
      </div>
    ` : '';

    // Bilingual Translation Input Studio on the right pane when user enables "Dịch song ngữ"
    const rightPaneContentHtml = (s.showBilingual && enableDict)
      ? renderBilingualEditorHtml(curPassage)
      : groupsHtml;

    const palCssVars = buildPaletteCssVarsStyle(activePalette);

    root.innerHTML = `
      <div class="rp-workspace ins-shell ${modeCls} ${contrastCls} ${sizeCls} ${isReview ? 'is-review-mode' : ''}" id="rp-workspace"
        data-study-mode="${esc(s.studyMode)}" data-passage-id="${esc(curPassage.id)}" data-hl-palette="${esc(activePalette.id)}"
        style="${palCssVars}"
        onclick="${isPractice && s.optionsOpen ? 'ReadingPracticeApp.toggleOptionsOverlay(false)' : ''}">
        <div class="ins-main-col">
          <!-- Workspace Header -->
          <header class="ins-header">
            <div class="ins-hdr-left">
              ${brandBlockHtml}
              <div class="ins-hdr-meta">
                <div class="ins-hdr-title">${esc(s.title)}</div>
                ${!isPractice ? timerBlockHtml : ''}
              </div>
            </div>

            <div class="ins-hdr-right">
              ${antiCheatPillHtml}
              ${isPractice ? timerBlockHtml : ''}
              ${practiceProgPillHtml}
              ${(isTeacherBypass() && !isReview && !s.isNews) ? `
                <button type="button" class="ins-hdr-pill" id="rp-btn-teacher-solutions"
                  onclick="ReadingPracticeApp.openReviewFromResult()"
                  title="Quyền Giáo viên: Xem ngay toàn bộ đáp án, lời giải, dịch song ngữ &amp; Locate mà không cần làm hết">
                  Xem đáp án
                </button>
              ` : ''}
              ${((isTeacherBypass() || s.liveRoomId) && !s.isNews) ? `
                <button type="button" class="ins-hdr-pill rp-hdr-live-btn ${s.liveRoomId ? 'is-live-on' : ''}" id="rp-btn-live-share"
                  onclick="ReadingPracticeApp.openLiveShareModal()"
                  title="${s.liveRoomId ? 'Phòng làm chung đang bật — Bấm để sao chép link &amp; chỉnh quyền' : 'Tạo link phòng làm chung (Live Highlight, Ghi chú &amp; Locate theo thời gian thực như Google Docs)'}">
                  <span class="rp-hdr-live-dot" aria-hidden="true"></span>
                  <span>${s.liveRoomId ? 'Đang Live' : 'Làm chung'}</span>
                </button>
              ` : ''}
              ${reviewHeaderActionsHtml}
              ${s.isNews && !isReview ? `
                <button type="button" class="ins-hdr-pill ${s.showBilingual ? 'active' : ''}" id="rp-btn-bilingual" onclick="ReadingPracticeApp.toggleBilingual()">
                  ${s.showBilingual ? '✓ Dịch song ngữ' : 'Dịch song ngữ'}
                </button>
              ` : ''}
              ${!isPractice ? `
                <button type="button" class="ins-hdr-ico" title="Kết nối cục bộ (Offline safe)" aria-label="Status">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/></svg>
                </button>
              ` : ''}
              <button type="button" class="ins-hdr-ico ${isPractice ? 'prac-hdr-ico' : ''} ${s.notesOpen ? 'active' : ''}" id="rp-btn-notes"
                onclick="ReadingPracticeApp.toggleNotesDrawer()" title="Ghi chú (Notes)" aria-label="Notes">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                ${notesCount ? `<span class="ins-notes-badge">${notesCount}</span>` : ''}
              </button>
              ${isPractice ? practiceAppearancePopHtml : `
                <button type="button" class="ins-hdr-ico ${s.optionsOpen ? 'active' : ''}" id="ins-btn-options"
                  onclick="ReadingPracticeApp.toggleOptionsOverlay()" title="Options (Text size · Submit)" aria-label="Options">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <button type="button" class="ins-hdr-exit" onclick="ReadingPracticeApp.exitToHub()" title="Quay về kho đề">Thoát</button>
              `}
            </div>
          </header>

          ${s.liveRoomId ? `<div class="rp-live-bar" id="rp-live-bar">${renderLiveRoomBarInnerHtml()}</div>` : ''}
          ${antiCheatBannerHtml}
          ${retryBannerHtml}
          ${reviewStripHtml}

          ${!isPractice ? `
            <!-- Full-width Official Inspera Part Sub-Banner (Exam mode only) -->
            <div class="ins-part-banner">
              <div class="ins-part-banner-main">
                <strong>${esc(partLabel)}</strong>
                <span>${esc(partSubText)}</span>
              </div>
            </div>
          ` : ''}

          <!-- Mobile Pane Toggle -->
          <div class="rp-mobile-pane-bar">
            <button type="button" class="rp-mob-tab ${state.mobilePane === 'passage' ? 'active' : ''}"
              onclick="ReadingPracticeApp.setMobilePane('passage')">Bài đọc</button>
            <button type="button" class="rp-mob-tab ${state.mobilePane === 'questions' ? 'active' : ''}"
              onclick="ReadingPracticeApp.setMobilePane('questions')">Câu hỏi (${totalAnswered}/${allQ.length})</button>
          </div>

          <!-- 50/50 Split Workspace -->
          <div class="ins-split-body" id="rp-split-body">
            <div class="${isPractice ? 'prac-sheet-shell ' : 'ins-pane-wrap '}${state.mobilePane === 'passage' ? 'mob-active' : ''}"
              id="rp-passage-shell" style="flex: 0 0 ${state.splitRatio}%;">
              <section class="ins-pane ins-pane-left ${state.mobilePane === 'passage' ? 'mob-active' : ''}"
                id="rp-passage-pane"
                onmousedown="ReadingPracticeApp.onPassageMouseDown(event)"
                onmouseup="ReadingPracticeApp.handlePassageSelection(event)"
                oncontextmenu="ReadingPracticeApp.handlePassageContextMenu(event)"
                onclick="ReadingPracticeApp.handlePassageWordClick(event)">
                <div class="ins-passage-inner">
                  ${practicePassageEyebrowHtml}
                  <h1 class="ins-passage-title">${esc(curPassage.title)}</h1>
                  ${practiceTitleRuleSvg}
                  ${(curPassage.subtitle && !(curPassage.paragraphs?.[0]?.en || '').startsWith(curPassage.subtitle.replace(/…$/, '').slice(0, 40))) ? `<p class="ins-passage-sub">${esc(curPassage.subtitle)}</p>` : ''}
                  <div class="rp-passage-content" id="rp-passage-content">
                    ${(curPassage.paragraphs || []).map((para, pIdx) => renderPassageParagraphHtml(para, pIdx, curPassage, enableDict, isReview)).join('')}
                  </div>
                </div>
              </section>
              ${practiceStampSvg}
            </div>

            <div class="ins-resizer" id="rp-resizer" title="Kéo để chia lại tỷ lệ bài đọc / câu hỏi"
              onmousedown="ReadingPracticeApp.startResize(event)">
              <span class="ins-resizer-box" aria-hidden="true">${isPractice ? '' : '↔'}</span>
            </div>

            <div class="${isPractice ? 'prac-sheet-shell prac-sheet-right ' : 'ins-pane-wrap ins-pane-wrap-right '}${state.mobilePane === 'questions' ? 'mob-active' : ''}">
              <section class="ins-pane ins-pane-right ${state.mobilePane === 'questions' ? 'mob-active' : ''} ${enableDict ? 'is-dict-unlocked' : ''} ${s.showBilingual && enableDict ? 'is-bilingual-mode' : ''}" id="rp-questions-pane"
                onmousedown="ReadingPracticeApp.onPassageMouseDown(event)"
                onmouseup="ReadingPracticeApp.handlePassageSelection(event)"
                oncontextmenu="ReadingPracticeApp.handlePassageContextMenu(event)"
                onclick="ReadingPracticeApp.handleQuestionsClick(event)">
                <div class="ins-questions-inner">
                  ${rightPaneContentHtml}
                </div>
              </section>
            </div>

            ${!isPractice ? `
              <!-- Official Floating 40x40px Prev / Next Square Arrows (Exam mode only) -->
              <div class="ins-float-arrows">
                <button type="button" class="ins-arrow-btn ${curGlobalIdx <= 0 ? 'is-disabled' : ''}"
                  onclick="ReadingPracticeApp.stepQuestion(-1)" title="Previous question" ${curGlobalIdx <= 0 ? 'disabled' : ''}>←</button>
                <button type="button" class="ins-arrow-btn is-next ${curGlobalIdx >= allQ.length - 1 ? 'is-disabled' : ''}"
                  onclick="ReadingPracticeApp.stepQuestion(1)" title="Next question" ${curGlobalIdx >= allQ.length - 1 ? 'disabled' : ''}>→</button>
              </div>
            ` : ''}
          </div>

          <!-- Fixed Bottom Navigator Bar (Ảnh 4: sleek pills + Prev/Next nav instead of duplicate back button!) -->
          <footer class="ins-footer ${isReview ? 'is-review-footer' : ''}">
            <div class="ins-footer-parts">${bottomPartsHtml}</div>
            ${!isReview ? (isPractice ? `
              <button type="button" class="ins-submit-check-btn prac-submit-pill" id="rp-btn-open-submit"
                onclick="ReadingPracticeApp.openPreSubmitModal()" title="${isRetryPhase ? 'Nộp lại' : 'Nộp bài kiểm tra kết quả'}" aria-label="${isRetryPhase ? 'Nộp lại' : 'Nộp bài'}">
                <span>${isRetryPhase ? 'Nộp lại' : 'Nộp bài →'}</span>
              </button>
            ` : `
              <button type="button" class="ins-submit-check-btn" id="rp-btn-open-submit"
                onclick="ReadingPracticeApp.openPreSubmitModal()" title="${isRetryPhase ? 'Nộp lại' : 'Review &amp; Submit your answers'}" aria-label="Review and Submit">✓</button>
            `) : `
              <div class="rp-rev-foot-nav">
                <button type="button" class="rp-foot-step-btn" onclick="ReadingPracticeApp.stepQuestion(-1)" ${curGlobalIdx <= 0 ? 'disabled' : ''} title="Câu trước" aria-label="Câu trước">‹</button>
                <button type="button" class="rp-foot-step-btn" onclick="ReadingPracticeApp.stepQuestion(1)" ${curGlobalIdx >= allQ.length - 1 ? 'disabled' : ''} title="Câu tiếp theo" aria-label="Câu tiếp theo">›</button>
              </div>
            `}
          </footer>
        </div>

        ${notesDrawerHtml}
        ${optionsOverlayHtml}

        <!-- Selection / Right-Click Highlight Popover -->
        ${selPopoverHtml}

        <!-- Click-to-Dictionary Popover (Practice, Review & News mode) -->
        <div class="rp-dict-popover hidden" id="rp-dict-popover" onclick="event.stopPropagation()"></div>

        <!-- Pre-Submit Review Check Modal -->
        <div class="modal-overlay" id="rp-presubmit-modal" onclick="ReadingPracticeApp.closePreSubmitModal(event)">
          <div class="modal-card rp-presubmit-card" onclick="event.stopPropagation()">
            <div class="modal-header rp-presubmit-header">
              <div class="modal-title" id="rp-presubmit-title">${isPractice ? 'Tổng kết trước khi nộp bài' : 'Xác nhận nộp bài'}</div>
              <button type="button" class="btn-icon-glass rp-modal-close-btn" onclick="ReadingPracticeApp.closePreSubmitModal()" aria-label="Đóng">✕</button>
            </div>
            <div class="modal-body" id="rp-presubmit-body"></div>
          </div>
        </div>
      </div>
    `;

    // Re-apply persistent pastel highlights & restore pane scroll positions
    applyStoredHighlightsToPassage(curPassage.id);
    if (samePassage) {
      const pEl = document.getElementById('rp-passage-pane');
      const qEl = document.getElementById('rp-questions-pane');
      if (pEl) pEl.scrollTop = prevPassageScroll;
      if (qEl) qEl.scrollTop = prevQuestScroll;
    }
  }

  /* ---------- INTERACTIVE BILINGUAL TRANSLATION STUDIO (Right Pane) ---------- */
  function renderBilingualEditorHtml(passage) {
    const paras = passage?.paragraphs || [];
    const drafts = loadBilingualDrafts(passage?.id);
    const totalParas = paras.length;
    let doneParas = 0;
    let totalWords = 0;
    const cardsHtml = paras.map((para, pIdx) => {
      const val = String(drafts[String(pIdx)] || '');
      const wc = val.trim() ? val.trim().split(/\s+/).length : 0;
      if (wc > 0) doneParas += 1;
      totalWords += wc;
      const cleanEn = String(para.en || '').replace(/<\/?ev[^>]*>/g, '').replace(/\s+/g, ' ').trim();
      const preview = cleanEn.length > 105 ? cleanEn.slice(0, 105) + '…' : cleanEn;
      const lbl = para.label ? `Đoạn ${esc(para.label)}` : `Đoạn ${pIdx + 1}`;
      const sampleVi = para.vi ? `
        <details class="rp-bi-sample">
          <summary>Xem bản dịch gợi ý</summary>
          <p>${esc(para.vi)}</p>
        </details>
      ` : '';
      return `
        <div class="rp-bi-card ${wc > 0 ? 'is-filled' : ''}" data-bi-para="${pIdx}">
          <div class="rp-bi-card-head">
            <span class="rp-bi-para-tag">${lbl}</span>
            <span class="rp-bi-wc tabular" id="rp-bi-wc-${pIdx}">${wc > 0 ? `${wc} từ` : 'Chưa dịch'}</span>
          </div>
          <div class="rp-bi-en-preview">“${esc(preview)}”</div>
          <textarea class="rp-bi-textarea" id="rp-bi-ta-${pIdx}" rows="3"
            placeholder="Nhập bản dịch tiếng Việt cho ${lbl.toLowerCase()}..."
            onfocus="ReadingPracticeApp.focusBilingualParagraph(${pIdx})"
            oninput="ReadingPracticeApp.onBilingualInput('${esc(passage.id)}', ${pIdx}, this)">${esc(val)}</textarea>
          ${sampleVi}
        </div>
      `;
    }).join('');

    return `
      <div class="rp-bi-studio" id="rp-bilingual-studio">
        <div class="rp-bi-head">
          <div>
            <h3 class="rp-bi-title">Dịch song ngữ từng đoạn</h3>
            <div class="rp-bi-sub tabular" id="rp-bi-summary">Đã dịch <strong>${doneParas}/${totalParas}</strong> đoạn · ${totalWords} từ (tự lưu trên máy)</div>
          </div>
          <div class="rp-bi-head-acts">
            ${doneParas > 0 ? `<button type="button" class="btn-subtle rp-btn-sm" onclick="ReadingPracticeApp.clearPassageBilingual('${esc(passage.id)}')">Xóa nháp</button>` : ''}
            <button type="button" class="btn btn-primary rp-btn-sm" onclick="ReadingPracticeApp.toggleBilingual()">← Câu hỏi &amp; Locate</button>
          </div>
        </div>
        <div class="rp-bi-list">${cardsHtml}</div>
      </div>
    `;
  }

  /* ---------- FLAT INSPERA / PRACTICE PRO QUESTION GROUP & ITEM RENDERER ---------- */
  const RP_ROMAN_ORDER = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15 };

  function normInstWs(s) {
    return String(s || '').replace(/\s+/g, ' ').trim();
  }

  function dedupeScrapedInstructionLines(rawLines) {
    const lines = rawLines.map(normInstWs).filter(Boolean);
    const out = [];
    let i = 0;
    while (i < lines.length) {
      const cur = lines[i];
      const curCompact = cur.replace(/\s+/g, '').toLowerCase();

      // Case 1: HTML <tr> row followed immediately by echoed <td> lines
      let matchedLen = 0;
      let acc = '';
      for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {
        acc += lines[j].replace(/\s+/g, '').toLowerCase();
        if (acc === curCompact) {
          matchedLen = j - i;
          break;
        }
        if (!curCompact.startsWith(acc)) break;
      }
      if (matchedLen >= 2) {
        if (/^(?:list of|types of|collection types)\b/i.test(cur) && lines[i + 1].length < cur.length && cur.toLowerCase().startsWith(lines[i + 1].toLowerCase())) {
          for (let k = i + 1; k <= i + matchedLen; k++) out.push(lines[k]);
        } else {
          out.push(cur);
        }
        i += matchedLen + 1;
        continue;
      }

      // Case 2: Exact duplicate, suffix echo ("AT Artefact Types" -> "Artefact Types"), or truncated end echo
      if (i + 1 < lines.length) {
        const next = lines[i + 1];
        const nextCompact = next.replace(/\s+/g, '').toLowerCase();
        if (nextCompact === curCompact) {
          out.push(cur);
          i += 2;
          continue;
        }
        const keyValMatch = /^([A-Z]{1,3}|[ivx]{1,4})\.?\s+(.+)$/i.exec(cur);
        if (keyValMatch && normInstWs(keyValMatch[2]).toLowerCase() === next.toLowerCase()) {
          out.push(cur);
          i += 2;
          continue;
        }
        if (i + 1 === lines.length - 1 && nextCompact.length >= 1 && curCompact.startsWith(nextCompact) && cur.toLowerCase().startsWith(next.toLowerCase())) {
          const afterNext = cur.slice(next.length);
          if (!afterNext || /^[\s.,;:]/.test(afterNext)) {
            out.push(cur);
            i += 2;
            continue;
          }
        }
        let tailAcc = '';
        let isTailPrefix = true;
        for (let j = i + 1; j < lines.length; j++) {
          tailAcc += lines[j].replace(/\s+/g, '').toLowerCase();
          if (!curCompact.startsWith(tailAcc)) {
            isTailPrefix = false;
            break;
          }
        }
        if (isTailPrefix && lines.length - 1 - i >= 2 && tailAcc.length > 0 && tailAcc.length < curCompact.length) {
          out.push(cur);
          i = lines.length;
          continue;
        }
      }

      out.push(cur);
      i++;
    }
    return out;
  }

  function splitInlineLetterRow(line) {
    let work = line.replace(/(^|\s)([A-P])\s+\.(?=\s+\S)/g, '$1$2.');
    if (/^A\s+\S+.*\bB\s+\S+.*\bc\s+\S+/.test(work)) {
      work = work.replace(/\bc(\s+\S)/, 'C$1');
    }
    if (/\bH\s+\S+.*\b1\s+[a-z]/i.test(work) && !/\bI\s+/.test(work)) {
      work = work.replace(/(\bH\s+.+?)\s+1(\s+[a-z])/i, '$1 I$2');
    }

    const startM = /^([A-P])(\.\s*|\s+)(.+)$/.exec(work);
    if (!startM) return null;
    const firstKey = startM[1];
    const hasDot = startM[2].startsWith('.');
    const firstCode = firstKey.charCodeAt(0);
    // Match dotted keys ONLY when the row uses dotted keys (prevents middle initials like "Joseph E. Grimes" from splitting!)
    const re = hasDot ? /\s+([B-P])\.\s*(?=\S)/g : /\s+([B-P])\s+(?=\S)/g;
    const splits = [{ key: firstKey, code: firstCode, keyStart: 0, valStart: startM[0].length - startM[3].length }];
    let m;
    while ((m = re.exec(work)) !== null) {
      const k = m[1];
      const code = k.charCodeAt(0);
      const prev = splits[splits.length - 1];
      const diff = code - prev.code;
      if (diff >= 1 && diff <= 4) {
        if (!hasDot && k === 'I' && prev.key !== 'H' && !(splits.length >= 2 && prev.code - splits[splits.length - 2].code === diff)) {
          continue;
        }
        const prevVal = work.slice(prev.valStart, m.index).trim();
        if (!prevVal) continue;
        splits.push({ key: k, code, keyStart: m.index, valStart: m.index + m[0].length });
      }
    }
    if (splits.length < 2) return null;

    const steps = [];
    for (let s = 1; s < splits.length; s++) steps.push(splits[s].code - splits[s - 1].code);
    const allStep1 = steps.every((d) => d === 1);
    const allSameStep = steps.every((d) => d === steps[0] && d >= 1 && d <= 4);
    const allColumnTableStep = hasDot && steps.every((d) => d >= 2 && d <= 4);
    const chosen = (allStep1 || allSameStep || allColumnTableStep)
      ? splits
      : splits.reduce((acc, sp) => {
          if (!acc.length || sp.code === acc[acc.length - 1].code + 1) acc.push(sp);
          return acc;
        }, []);

    if (chosen.length < 2) return null;
    return chosen.map((sp, idx) => ({
      key: sp.key,
      text: work.slice(sp.valStart, idx + 1 < chosen.length ? chosen[idx + 1].keyStart : work.length).trim()
    }));
  }

  function healSequentialLetterKeys(rawItems) {
    const items = rawItems.map((it) => ({ key: it.key, text: it.text }));
    // Pass 1: Heal OCR lowercase 'c' (usually C after B, or E between D and F)
    for (let i = 0; i < items.length; i++) {
      if (items[i].key === 'c') {
        const prevCode = i > 0 && /^[A-P]$/.test(items[i - 1].key) ? items[i - 1].key.charCodeAt(0) : 0;
        const nextCode = i + 1 < items.length && /^[A-P]$/.test(items[i + 1].key) ? items[i + 1].key.charCodeAt(0) : 0;
        if (prevCode && nextCode && nextCode - prevCode === 2) {
          items[i].key = String.fromCharCode(prevCode + 1);
        } else if (prevCode === 66) {
          items[i].key = 'C';
        } else if (prevCode === 68) {
          items[i].key = 'E';
        } else {
          items[i].key = 'C';
        }
      }
    }
    // Pass 2: Heal duplicated/misread uppercase keys sandwiched cleanly between prev and next (e.g., F -> C -> H => G)
    const seenKeys = new Set();
    for (let i = 0; i < items.length; i++) {
      const k = items[i].key;
      const code = k.charCodeAt(0);
      const prevCode = i > 0 ? items[i - 1].key.charCodeAt(0) : 0;
      const nextCode = i + 1 < items.length ? items[i + 1].key.charCodeAt(0) : 0;
      if (seenKeys.has(k) && prevCode && nextCode && nextCode - prevCode === 2 && code !== prevCode + 1) {
        const healed = String.fromCharCode(prevCode + 1);
        if (!seenKeys.has(healed)) {
          items[i].key = healed;
        }
      }
      seenKeys.add(items[i].key);
    }
    return items;
  }

  function parseGroupInstructionAndBox(rawInst, group) {
    if (!rawInst) return { proseBefore: [], boxTitle: '', items: [], chipWords: [], proseAfter: [], mode: '' };
    const lines = dedupeScrapedInstructionLines(String(rawInst).split('\n'));
    const qOpts = (group?.questions || []).map((q) => q.options).find((o) => Array.isArray(o) && o.length) || [];
    const qOptSet = new Set(qOpts.map((o) => String(o).trim().toUpperCase()));
    const isCodeOpts = qOpts.length >= 3 && qOpts.every((o) => /^[A-Z]{2,3}$/.test(String(o).trim()));
    const isWordOpts = qOpts.length >= 4 && qOpts.every((o) => /^[a-zA-Z\-]{3,}$/.test(String(o).trim()));

    const parsed = lines.map((line) => {
      const multi = splitInlineLetterRow(line);
      const romM = /^(xv|xiv|xiii|xii|xi|x|ix|viii|vii|vi|v|iv|iii|ii|i)(?:\.\s*|\s+)(.+)$/i.exec(line.replace(/^¡(?=[ivx])/i, 'i'));
      const singleRoman = (romM && RP_ROMAN_ORDER[romM[1].toLowerCase()] && !/^Paragraph\b/i.test(line))
        ? [{ key: romM[1].toLowerCase(), text: romM[2].trim() }]
        : null;
      let singleCode = null;
      if (isCodeOpts) {
        const codeM = /^([A-Z]{2,3})(?:\.\s*|\s+)(.+)$/.exec(line);
        if (codeM && qOptSet.has(codeM[1])) {
          singleCode = [{ key: codeM[1], text: codeM[2].trim() }];
        }
      }
      const singleM = /^([A-P])(?:\.\s*|\s+)(.+)$/.exec(line);
      const singleLetter = singleM ? [{ key: singleM[1], text: singleM[2].trim() }] : null;
      const ocrCM = /^c(?:\.\s*|\s+)(.+)$/.exec(line);
      const singleOcrC = ocrCM ? [{ key: 'c', text: ocrCM[1].trim() }] : null;
      return { multiLetter: multi, singleLetter, singleOcrC, singleRoman, singleCode, raw: line };
    });

    let bestSpan = null;
    for (const mode of ['letter', 'roman', 'code']) {
      let start = -1;
      let end = -1;
      let items = [];
      for (let i = 0; i < parsed.length; i++) {
        const p = parsed[i];
        let rowItems = mode === 'letter'
          ? (p.multiLetter || p.singleLetter)
          : (mode === 'roman' ? p.singleRoman : p.singleCode);
        if (mode === 'letter' && !rowItems && start !== -1 && p.singleOcrC) {
          rowItems = p.singleOcrC;
        }
        if (rowItems && rowItems.length) {
          if (start === -1) start = i;
          end = i;
          items.push(...rowItems);
        } else if (start !== -1) {
          if (items.length >= 2) break;
          start = -1;
          end = -1;
          items = [];
        }
      }
      if (items.length >= 2) {
        const finalItems = mode === 'letter' ? healSequentialLetterKeys(items) : items;
        let valid = false;
        if (mode === 'letter') {
          const hasA = finalItems.some((x) => x.key === 'A');
          const hasB = finalItems.some((x) => x.key === 'B');
          valid = hasA && hasB && (finalItems.length >= 3 || finalItems[0].key === 'A');
        } else if (mode === 'roman') {
          valid = finalItems.some((x) => x.key === 'i') && finalItems.some((x) => x.key === 'ii') && finalItems.length >= 3;
        } else if (mode === 'code') {
          valid = finalItems.length >= 2;
        }
        if (valid && (!bestSpan || finalItems.length > bestSpan.items.length)) {
          bestSpan = { mode, start, end, items: finalItems };
        }
      }
    }

    if (!bestSpan && isWordOpts) {
      const lwIdx = lines.findIndex((l) => /^list of words$/i.test(l));
      if (lwIdx >= 0) {
        const chipWords = [];
        const seenLower = new Set();
        const pushWord = (raw) => {
          const w = String(raw || '').trim();
          if (!w) return;
          const low = w.toLowerCase();
          if (!seenLower.has(low)) {
            seenLower.add(low);
            chipWords.push(w);
          }
        };
        for (let k = lwIdx + 1; k < lines.length; k++) {
          for (const w of lines[k].split(/\s+/)) pushWord(w);
        }
        for (const opt of qOpts) pushWord(opt);
        if (chipWords.length >= 3) {
          return {
            proseBefore: lines.slice(0, lwIdx),
            boxTitle: lines[lwIdx],
            items: [],
            chipWords,
            proseAfter: [],
            mode: 'chips'
          };
        }
      }
    }

    if (!bestSpan) {
      return { proseBefore: lines, boxTitle: '', items: [], chipWords: [], proseAfter: [], mode: '' };
    }

    const seen = new Map();
    bestSpan.items.forEach((it) => {
      const prev = seen.get(it.key);
      if (!prev || it.text.length > prev.text.length) seen.set(it.key, it);
    });
    const cleanItems = [...seen.values()];
    if (bestSpan.mode === 'letter') {
      cleanItems.sort((a, b) => a.key.charCodeAt(0) - b.key.charCodeAt(0));
    } else if (bestSpan.mode === 'roman') {
      cleanItems.sort((a, b) => (RP_ROMAN_ORDER[a.key] || 99) - (RP_ROMAN_ORDER[b.key] || 99));
    }

    const proseBefore = lines.slice(0, bestSpan.start);
    let boxTitle = '';
    if (proseBefore.length > 0) {
      const lastBefore = proseBefore[proseBefore.length - 1];
      const isLikelyTitle = /^(?:list of|types of|collection types|categories|summary|findings|researchers|people|theories|statements|headings|options)/i.test(lastBefore)
        || (lastBefore.length <= 58 && !/[.?!]$/.test(lastBefore) && !/\b(?:write|choose|match|complete|answer sheet|boxes|more than once|questions?\s+\d)\b/i.test(lastBefore));
      if (isLikelyTitle) {
        boxTitle = proseBefore.pop();
      }
    }

    return {
      proseBefore,
      boxTitle,
      items: cleanItems,
      chipWords: [],
      proseAfter: lines.slice(bestSpan.end + 1),
      mode: bestSpan.mode
    };
  }

  function formatGroupInstructionHtml(inst) {
    if (!inst) return '';
    return esc(String(inst).trim())
      .replace(/\b(NO MORE THAN (?:ONE|TWO|THREE|FOUR) WORDS?(?: AND\/OR A NUMBER)?|ONE WORD AND\/OR A NUMBER|ONE WORD ONLY|TWO WORDS ONLY|THREE WORDS ONLY|ONE NUMBER ONLY|TRUE|FALSE|NOT GIVEN|YES|NO)\b/g, '<strong>$1</strong>')
      .replace(/\n+/g, '<br>');
  }

  const RP_WORD_LIMIT_RE = /\b(ONE WORD|TWO WORDS|THREE WORDS|FOUR WORDS|NO MORE THAN|A NUMBER|NUMBER ONLY|WORD ONLY|WORDS ONLY|FROM THE PASSAGE|FROM THE TEXT|LIST OF WORDS|CORRECT LETTER)\b/i;

  function inferGapWordLimitPhrase(gapQs) {
    let maxWords = 1;
    let hasNum = false;
    for (const q of gapQs) {
      const rawArr = Array.isArray(q.answer) ? q.answer : [q.answer];
      const variants = [];
      for (const item of rawArr) {
        const s = String(item || '').trim();
        if (!s) continue;
        const hasEitherOrder = /\b(IN EITHER ORDER|EITHER ORDER|ANY ORDER)\b/i.test(s);
        const stripped = s
          .replace(/\b(IN EITHER ORDER|BOTH REQUIRED FOR ONE MARK|BOTH REQUIRED|ANY ORDER|EITHER ORDER)\b/gi, '')
          .replace(/\([^)]*\)/g, '')
          .trim();
        const parts = hasEitherOrder
          ? stripped.split(/\s*(?:\/|,|;|\band\b|\bor\b)\s*/i)
          : stripped.split(/\s*(?:\/|\bor\b)\s*/i);
        for (const p of parts) {
          const clean = p.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();
          if (clean) variants.push(clean);
        }
      }
      if (!variants.length) continue;
      let minVarWords = Infinity;
      for (const v of variants) {
        const wc = v.split(/\s+/).filter(Boolean).length;
        if (wc > 0 && wc < minVarWords) minVarWords = wc;
        if (/\d/.test(v)) hasNum = true;
      }
      if (minVarWords < Infinity && minVarWords > maxWords) {
        maxWords = minVarWords;
      }
    }
    if (maxWords <= 1) return hasNum ? 'ONE WORD AND/OR A NUMBER' : 'ONE WORD ONLY';
    if (maxWords === 2) return hasNum ? 'NO MORE THAN TWO WORDS AND/OR A NUMBER' : 'NO MORE THAN TWO WORDS';
    return hasNum ? 'NO MORE THAN THREE WORDS AND/OR A NUMBER' : 'NO MORE THAN THREE WORDS';
  }

  function resolveEffectiveGroupInstruction(rawInst, group) {
    const trimmed = String(rawInst || '').trim();
    const qs = group?.questions || [];
    const gapQs = qs.filter((q) => q.type === 'gap');

    if (gapQs.length > 0 && !RP_WORD_LIMIT_RE.test(trimmed)) {
      const limitPhrase = inferGapWordLimitPhrase(gapQs);
      const limitLine = `Choose ${limitPhrase} from the passage for each answer.`;
      if (trimmed) return `${trimmed}\n${limitLine}`;

      const questionMarkCount = gapQs.filter((q) => /\?\s*$/.test(String(q.prompt || '').trim())).length;
      const bulletCount = gapQs.filter((q) => /^\s*[•●○▪▸◦\-–—]\s*/.test(String(q.prompt || ''))).length;
      const lead = questionMarkCount >= Math.ceil(gapQs.length * 0.5)
        ? 'Answer the questions below.'
        : (bulletCount >= Math.max(2, Math.ceil(gapQs.length * 0.5))
          ? 'Complete the notes below.'
          : 'Complete the sentences below.');
      return `${lead}\n${limitLine}`;
    }

    if (!trimmed && qs.length > 0) {
      const allTfng = qs.every((q) => q.type === 'tfng');
      if (allTfng) {
        return 'Do the following statements agree with the information given in the Reading Passage?\nWrite TRUE, FALSE or NOT GIVEN for each question.';
      }
      const allYnng = qs.every((q) => q.type === 'ynng');
      if (allYnng) {
        return 'Do the following statements agree with the views of the writer in the Reading Passage?\nWrite YES, NO or NOT GIVEN for each question.';
      }
      const allMcq = qs.every((q) => q.type === 'mcq');
      if (allMcq) {
        const optKeys = (qs[0]?.options || []).map((o) => String(o?.key || o || '').trim()).filter(Boolean);
        const letterList = optKeys.length >= 2
          ? `${optKeys.slice(0, -1).join(', ')} or ${optKeys[optKeys.length - 1]}`
          : 'A, B, C or D';
        return `Choose the correct letter, ${letterList}.`;
      }
    }

    return trimmed;
  }

  function renderGroupInstructionBlock(inst, group) {
    const effectiveInst = resolveEffectiveGroupInstruction(inst, group);
    if (!effectiveInst) return '';
    const parsed = parseGroupInstructionAndBox(effectiveInst, group);
    const hasBox = parsed.items.length > 0 || parsed.chipWords.length > 0;
    if (!hasBox) {
      const cleanText = parsed.proseBefore.join('\n');
      return cleanText ? `<p class="ins-group-inst">${formatGroupInstructionHtml(cleanText)}</p>` : '';
    }

    const beforeHtml = parsed.proseBefore.length
      ? `<p class="ins-group-inst">${formatGroupInstructionHtml(parsed.proseBefore.join('\n'))}</p>`
      : '';

    let boxHtml = '';
    if (parsed.items.length > 0) {
      const maxLen = parsed.items.reduce((m, it) => Math.max(m, it.text.length), 0);
      const colCls = (parsed.mode === 'roman' || maxLen > 38)
        ? 'cols-1'
        : ((maxLen > 20 || parsed.items.length <= 6) ? 'cols-2' : 'cols-3');
      boxHtml = `
        <div class="rp-wordbank-box ${colCls} ${parsed.mode === 'roman' ? 'is-roman' : ''}">
          ${parsed.boxTitle ? `<div class="rp-wb-head">${esc(parsed.boxTitle)}</div>` : ''}
          <div class="rp-wb-grid">
            ${parsed.items.map((it) => `
              <div class="rp-wb-item">
                <span class="rp-wb-key">${esc(it.key)}</span>
                <span class="rp-wb-val">${esc(it.text)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (parsed.chipWords.length > 0) {
      boxHtml = `
        <div class="rp-wordbank-box is-chips">
          ${parsed.boxTitle ? `<div class="rp-wb-head">${esc(parsed.boxTitle)}</div>` : ''}
          <div class="rp-wb-chips">
            ${parsed.chipWords.map((w) => `<span class="rp-wb-chip">${esc(w)}</span>`).join('')}
          </div>
        </div>
      `;
    }

    const afterHtml = parsed.proseAfter.length
      ? `<p class="ins-group-inst ins-group-inst-after">${formatGroupInstructionHtml(parsed.proseAfter.join('\n'))}</p>`
      : '';

    return `${beforeHtml}${boxHtml}${afterHtml}`;
  }

  function getGapGroupFrameKind(group) {
    const qs = group?.questions || [];
    if (!qs.length || !qs.every((q) => q.type === 'gap')) return null;
    const hay = `${group.title || ''} ${group.instruction || ''}`;
    if (/\b(complete the notes?|note completion)\b/i.test(hay)) return 'note';
    if (/\b(complete the summary|summary completion)\b/i.test(hay)) return 'summary';
    const bulletCount = qs.filter((q) => /^\s*[•●○▪▸◦\-–—]\s*/.test(String(q.prompt || ''))).length;
    if (bulletCount >= Math.max(2, Math.ceil(qs.length * 0.5))) return 'note';
    return null;
  }

  function canonicalMultiBlankSig(prompt) {
    return String(prompt || '')
      .replace(/^\s*(?:[•●○▪▸◦·\-–—]\s*)+/, '')
      .replace(/(?:\b\d{1,2}\s*)?\[\s*\.\.\.\s*\]/g, '@@RPBLANK@@')
      .replace(/(?:…|\.{3,})\s*\.?\s*_{3,}/g, '@@RPBLANK@@')
      .replace(/_{3,}/g, '@@RPBLANK@@')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function clusterMultiBlankQuestions(qs) {
    const out = [];
    let i = 0;
    while (i < qs.length) {
      const q = qs[i];
      const raw = String(q?.prompt || '');
      if ((q.type === 'gap' || q.type === 'select') && /\[\s*\.\.\.\s*\]/.test(raw)) {
        const sig = canonicalMultiBlankSig(raw);
        const cluster = [q];
        let j = i + 1;
        while (j < qs.length && qs[j].type === q.type && canonicalMultiBlankSig(qs[j].prompt) === sig) {
          cluster.push(qs[j]);
          j++;
        }
        const blankCount = (sig.match(/@@RPBLANK@@/g) || []).length;
        if (cluster.length >= 2 && blankCount === cluster.length) {
          out.push({ kind: 'multi', type: q.type, template: sig, questions: cluster, rawFirst: raw });
          i = j;
          continue;
        }
      }
      out.push({ kind: 'single', q });
      i++;
    }
    return out;
  }

  function buildGapInlineBlankHtml(q, passage, isReview, includeAnchorId = false) {
    const s = state.session;
    const qid = `${passage.id}__q${q.num}`;
    const userVal = String(s.answers[qid] ?? '');
    const isCur = s.activeQid === qid;
    const isLockedOk = !isReview && !!s.lockedCorrect?.[qid];
    const wrongState = !isReview ? s.wrongSet?.[qid] : null;
    const isWrongRetry = !!wrongState;
    const isReadOnly = isReview || isLockedOk;
    const ok = isReview ? isAnswerCorrect(q, userVal) : isLockedOk;

    const badgeStateCls = isReview
      ? (ok ? 'is-ok' : 'is-bad')
      : (isLockedOk ? 'is-ok' : (isWrongRetry ? (wrongState === 'edited' ? 'is-edited' : 'is-bad') : (isCur ? 'is-current' : '')));
    const gapCls = isReview ? (ok ? 'is-ok' : 'is-bad') : (isLockedOk ? 'is-ok' : (isWrongRetry && wrongState !== 'edited' ? 'is-bad' : ''));
    const anchorAttr = includeAnchorId ? ` id="rp-qcard-${esc(qid)}"` : '';
    return `<span class="ins-note-blank-wrap"${anchorAttr}><span class="ins-note-qnum ${badgeStateCls}">${q.num}</span><input type="text" class="ins-gap-input ins-note-input ${gapCls}" value="${esc(userVal)}" ${isReadOnly ? 'readonly' : ''} aria-label="Question ${q.num}" onfocus="ReadingPracticeApp.focusQuestion('${esc(qid)}')" oninput="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value, true)" autocomplete="off"></span>`;
  }

  function buildSelectInlineBlankHtml(q, passage, isReview) {
    const s = state.session;
    const qid = `${passage.id}__q${q.num}`;
    const userVal = String(s.answers[qid] ?? '');
    const isCur = s.activeQid === qid;
    const isLockedOk = !isReview && !!s.lockedCorrect?.[qid];
    const wrongState = !isReview ? s.wrongSet?.[qid] : null;
    const isWrongRetry = !!wrongState;
    const isReadOnly = isReview || isLockedOk;
    const ok = isReview ? isAnswerCorrect(q, userVal) : isLockedOk;
    const opts = Array.isArray(q.options) && q.options.length ? q.options : ['A', 'B', 'C', 'D', 'E'];

    const badgeStateCls = isReview
      ? (ok ? 'is-ok' : 'is-bad')
      : (isLockedOk ? 'is-ok' : (isWrongRetry ? (wrongState === 'edited' ? 'is-edited' : 'is-bad') : (isCur ? 'is-current' : '')));
    const selCls = isReview ? (ok ? 'is-ok' : 'is-bad') : (isLockedOk ? 'is-ok' : (isWrongRetry && wrongState !== 'edited' ? 'is-bad' : (userVal ? 'is-filled' : '')));

    const optsHtml = `<option value="">—</option>` + opts.map((opt) => {
      const val = String(opt).trim();
      const sel = userVal.toUpperCase() === val.toUpperCase() ? 'selected' : '';
      return `<option value="${esc(val)}" ${sel}>${esc(val)}</option>`;
    }).join('');

    return `<span class="ins-note-blank-wrap ins-select-blank-wrap" id="rp-qcard-${esc(qid)}"><span class="ins-note-qnum ${badgeStateCls}">${q.num}</span><select class="ins-inline-select ${selCls}" ${isReadOnly ? 'disabled' : ''} aria-label="Question ${q.num}" onfocus="ReadingPracticeApp.focusQuestion('${esc(qid)}')" onchange="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value)">${optsHtml}</select></span>`;
  }

  function renderNoteCompletionGroup(group, passage, isReview, frameKind) {
    const s = state.session;
    const isPractice = s?.studyMode === 'practice';
    const qs = group.questions || [];
    const frameTitle = group.noteTitle || passage?.title || '';
    const entries = clusterMultiBlankQuestions(qs);

    const rowsHtml = entries.map((entry) => {
      if (entry.kind === 'multi') {
        const cluster = entry.questions;
        const isSubBullet = /^\s*[○◦\-–—]\s*/.test(entry.rawFirst);
        let bIdx = 0;
        const stem = esc(entry.template).replace(/@@RPBLANK@@/g, () => {
          const cq = cluster[bIdx++];
          return cq ? buildGapInlineBlankHtml(cq, passage, isReview, true) : '';
        });

        const subheadingHtml = cluster[0]?.subheading ? `<div class="ins-note-subheading">${esc(cluster[0].subheading)}</div>` : '';
        const anyCur = !isReview && cluster.some((cq) => s.activeQid === `${passage.id}__q${cq.num}`);
        const firstQid = `${passage.id}__q${cluster[0].num}`;
        const anyFlagged = cluster.some((cq) => !!s.flagged[`${passage.id}__q${cq.num}`]);
        const allReadOnly = isReview || cluster.every((cq) => !!s.lockedCorrect?.[`${passage.id}__q${cq.num}`]);

        const bookmarkBtn = !allReadOnly ? `
          <button type="button" class="ins-bookmark-btn ${anyFlagged ? 'active' : ''}"
            onclick="event.stopPropagation(); ReadingPracticeApp.toggleFlag('${esc(firstQid)}')" title="Đánh dấu xem lại (Bookmark)">
            <svg viewBox="0 0 24 24" fill="${anyFlagged ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
          </button>
        ` : '';

        const multiReviewsHtml = isReview ? `
          <div class="ins-multi-reviews">
            ${cluster.map((cq) => {
              const cqid = `${passage.id}__q${cq.num}`;
              const cOk = isAnswerCorrect(cq, String(s.answers[cqid] ?? ''));
              const cDisp = Array.isArray(cq.answer) ? cq.answer[0] : cq.answer;
              return renderReviewBlock(cq, cOk, cDisp, passage, true);
            }).join('')}
          </div>
        ` : '';

        return `
          ${subheadingHtml}
          <div class="ins-q-item ins-note-row ins-q-multi ${isSubBullet ? 'is-sub-bullet' : ''} ${frameKind === 'summary' ? 'is-summary-row' : ''} ${anyCur ? 'is-current' : ''}">
            <div class="ins-note-line-wrap">
              ${frameKind === 'note' ? `<span class="ins-note-bullet" aria-hidden="true">${isSubBullet ? '◦' : '•'}</span>` : ''}
              <div class="ins-note-line">${stem}</div>
              ${bookmarkBtn ? `<div class="prac-q-inline-acts ins-note-acts">${bookmarkBtn}</div>` : ''}
            </div>
            ${multiReviewsHtml}
          </div>
        `;
      }

      const q = entry.q;
      const qid = `${passage.id}__q${q.num}`;
      const userVal = String(s.answers[qid] ?? '');
      const flagged = !!s.flagged[qid];
      const isCur = s.activeQid === qid;
      const isLockedOk = !isReview && !!s.lockedCorrect?.[qid];
      const wrongState = !isReview ? s.wrongSet?.[qid] : null;
      const isWrongRetry = !!wrongState;
      const isReadOnly = isReview || isLockedOk;
      const ok = isReview ? isAnswerCorrect(q, userVal) : isLockedOk;

      const inlineBlankHtml = buildGapInlineBlankHtml(q, passage, isReview, false);

      const rawPrompt = String(q.prompt || '');
      const isSubBullet = /^\s*[○◦\-–—]\s*/.test(rawPrompt);
      const cleanPrompt = rawPrompt
        .replace(/^\s*(?:[•●○▪▸◦·\-–—]\s*)+/, '')
        .replace(/(?:…|\.{3,})\s*\.?\s*_{3,}/g, '_____');

      const stem = /_{3,}/.test(cleanPrompt)
        ? esc(cleanPrompt).replace(/_{3,}/, inlineBlankHtml)
        : `${esc(cleanPrompt)} ${inlineBlankHtml}`;

      const bookmarkBtn = !isReadOnly ? `
        <button type="button" class="ins-bookmark-btn ${flagged ? 'active' : ''}"
          onclick="event.stopPropagation(); ReadingPracticeApp.toggleFlag('${esc(qid)}')" title="Đánh dấu xem lại (Bookmark)">
          <svg viewBox="0 0 24 24" fill="${flagged ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
        </button>
      ` : '';

      const retryStatusPill = isLockedOk
        ? `<span class="rp-q-status is-ok" title="Câu này bạn đã làm đúng">✓ Đúng</span>`
        : (isWrongRetry
          ? `<span class="rp-q-status ${wrongState === 'edited' ? 'is-edited' : 'is-bad'}">${wrongState === 'edited' ? '↻ Đã sửa' : '✕ Làm lại'}</span>`
          : '');

      const cardStateCls = `${isCur && !isReview ? 'is-current' : ''}${isLockedOk ? ' is-checked-ok is-locked-ok' : (isWrongRetry ? (wrongState === 'edited' ? ' is-retry-edited' : ' is-checked-bad') : '')}`;
      const correctDisplay = Array.isArray(q.answer) ? q.answer[0] : q.answer;
      const subheadingHtml = q.subheading ? `<div class="ins-note-subheading">${esc(q.subheading)}</div>` : '';

      return `
        ${subheadingHtml}
        <div class="ins-q-item ins-note-row ${isSubBullet ? 'is-sub-bullet' : ''} ${frameKind === 'summary' ? 'is-summary-row' : ''} ${cardStateCls}"
          id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
          <div class="ins-note-line-wrap">
            ${frameKind === 'note' ? `<span class="ins-note-bullet" aria-hidden="true">${isSubBullet ? '◦' : '•'}</span>` : ''}
            <div class="ins-note-line">${stem}</div>
            ${(retryStatusPill || bookmarkBtn) ? `<div class="prac-q-inline-acts ins-note-acts">${retryStatusPill}${bookmarkBtn}</div>` : ''}
          </div>
          ${isReview ? renderReviewBlock(q, ok, correctDisplay, passage) : ''}
        </div>
      `;
    }).join('');

    return `
      <div class="ins-q-group ins-q-group-note">
        <div class="ins-group-head">
          ${isPractice ? `
            <span class="prac-group-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
          ` : ''}
          <h3 class="ins-group-title">${esc(group.title)}</h3>
        </div>
        ${renderGroupInstructionBlock(group.instruction, group)}
        <div class="ins-note-frame ${frameKind === 'summary' ? 'is-summary-frame' : ''}">
          ${frameTitle ? `<div class="ins-note-heading">${esc(frameTitle)}</div>` : ''}
          <div class="ins-note-list">
            ${rowsHtml}
          </div>
        </div>
      </div>
    `;
  }

  function renderQuestionGroup(group, passage, isReview) {
    const s = state.session;
    const isPractice = s?.studyMode === 'practice';
    if (group.type === 'matching_headings') {
      const usedKeys = new Set();
      (group.questions || []).forEach((q) => {
        const v = String(s.answers[`${passage.id}__q${q.num}`] || '');
        if (v) usedKeys.add(v);
      });

      const headingsHtml = (group.headings || []).map((h) => {
        const isUsed = usedKeys.has(h.key);
        const isPicked = state.selectedHeadingKey === h.key;
        return `
          <div class="ins-heading-pill ${isUsed ? 'is-used' : ''} ${isPicked ? 'is-picked' : ''}"
            draggable="${!isReview}"
            data-heading-key="${esc(h.key)}"
            ondragstart="ReadingPracticeApp.onDragStartHeading(event, '${esc(h.key)}')"
            onclick="ReadingPracticeApp.onSelectHeadingPill('${esc(h.key)}')">
            <strong>${esc(h.text)}</strong>
          </div>
        `;
      }).join('');

      const reviewRowsHtml = isReview ? (group.questions || []).map((q) => {
        const qid = `${passage.id}__q${q.num}`;
        const ok = isAnswerCorrect(q, s.answers[qid]);
        const keyObj = (group.headings || []).find((h) => h.key === q.answer);
        return renderReviewBlock(q, ok, keyObj ? `${keyObj.key}. ${keyObj.text}` : q.answer, passage);
      }).join('') : '';

      return `
        <div class="ins-q-group">
          <h3 class="ins-group-title">${esc(group.title)}</h3>
          ${renderGroupInstructionBlock(group.instruction, group)}
          <div class="ins-headings-sub">List of Headings</div>
          <div class="ins-headings-stack">${headingsHtml}</div>
          ${!isReview ? '<div class="ins-mh-hint">Kéo thả tiêu đề sang ô viền xanh bên trái, hoặc bấm chọn 1 tiêu đề rồi bấm vào ô số câu bên trái.</div>' : ''}
          ${reviewRowsHtml}
        </div>
      `;
    }

    const frameKind = getGapGroupFrameKind(group);
    if (frameKind) {
      return renderNoteCompletionGroup(group, passage, isReview, frameKind);
    }

    const entries = clusterMultiBlankQuestions(group.questions || []);
    return `
      <div class="ins-q-group">
        <div class="ins-group-head">
          ${isPractice ? `
            <span class="prac-group-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
            </span>
          ` : ''}
          <h3 class="ins-group-title">${esc(group.title)}</h3>
        </div>
        ${renderGroupInstructionBlock(group.instruction, group)}
        <div class="ins-q-items">
          ${entries.map((entry) => entry.kind === 'multi'
            ? renderMultiBlankFlatItem(entry, passage, isReview)
            : renderFlatQuestionItem(entry.q, passage, isReview)).join('')}
        </div>
      </div>
    `;
  }

  function renderMultiBlankFlatItem(entry, passage, isReview) {
    const s = state.session;
    const cluster = entry.questions;
    let bIdx = 0;
    const stem = esc(entry.template).replace(/@@RPBLANK@@/g, () => {
      const cq = cluster[bIdx++];
      if (!cq) return '';
      return entry.type === 'select'
        ? buildSelectInlineBlankHtml(cq, passage, isReview)
        : buildGapInlineBlankHtml(cq, passage, isReview, true);
    });

    const anyCur = !isReview && cluster.some((cq) => s.activeQid === `${passage.id}__q${cq.num}`);
    const firstQid = `${passage.id}__q${cluster[0].num}`;
    const anyFlagged = cluster.some((cq) => !!s.flagged[`${passage.id}__q${cq.num}`]);
    const allReadOnly = isReview || cluster.every((cq) => !!s.lockedCorrect?.[`${passage.id}__q${cq.num}`]);

    const bookmarkBtn = !allReadOnly ? `
      <button type="button" class="ins-bookmark-btn ${anyFlagged ? 'active' : ''}"
        onclick="event.stopPropagation(); ReadingPracticeApp.toggleFlag('${esc(firstQid)}')" title="Đánh dấu xem lại (Bookmark)">
        <svg viewBox="0 0 24 24" fill="${anyFlagged ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
    ` : '';

    const multiReviewsHtml = isReview ? `
      <div class="ins-multi-reviews">
        ${cluster.map((cq) => {
          const cqid = `${passage.id}__q${cq.num}`;
          const cOk = isAnswerCorrect(cq, String(s.answers[cqid] ?? ''));
          const cDisp = Array.isArray(cq.answer) ? cq.answer.join(' / ') : cq.answer;
          return renderReviewBlock(cq, cOk, cDisp, passage, true);
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="ins-q-item ins-q-gap ins-q-multi ${entry.type === 'select' ? 'ins-q-multi-select' : ''} ${anyCur ? 'is-current' : ''}">
        <div class="ins-gap-bullet">
          <span class="ins-bullet-dot">•</span>
          <div class="ins-gap-line">${stem}</div>
          ${bookmarkBtn ? `<div class="prac-q-inline-acts">${bookmarkBtn}</div>` : ''}
        </div>
        ${multiReviewsHtml}
      </div>
    `;
  }

  function renderReviewBlock(q, ok, correctDisplay, passage, showQNum = false) {
    const s = state.session;
    const sol = getQuestionSolution(passage, q.num);
    const paraList = (Array.isArray(q.paraphrase) && q.paraphrase.length) ? q.paraphrase : (sol?.para || []);
    const expText = q.explanation || sol?.exp || '';
    const resolvedLoc = q.evidenceId ? null : resolveQuestionEvidenceLoc(passage, q, sol);
    const loc = resolvedLoc?.loc || null;
    const isAutoLoc = resolvedLoc?.source === 'auto';
    const quoteText = (!loc && sol?.quote) ? sol.quote : '';
    const srcLabel = sol?.src || '';
    const hasDetails = !!(paraList.length || expText || quoteText);
    const expKey = `${passage?.id || 'p'}__q${q.num}`;
    const isExpOpen = !!(s?.openExplanations && s.openExplanations[expKey]);
    const isLocActive = !!(
      (q.evidenceId && s?.activeEvidenceId === q.evidenceId) ||
      (loc && s?.activeEvidenceLoc && s.activeEvidenceLoc.passageId === passage?.id && s.activeEvidenceLoc.qnum === q.num)
    );

    const paraRows = paraList.map((pr) => `
      <div class="rp-para-map-row">
        <span class="rp-pm-q">${esc(pr.q)}</span>
        <span class="rp-pm-arrow">↔</span>
        <span class="rp-pm-p">${esc(pr.p)}</span>
      </div>
    `).join('');

    const pinSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const chevSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;

    const locateTitle = isAutoLoc
      ? 'Định vị câu dẫn chứng liên quan trong bài đọc'
      : 'Định vị dẫn chứng chính xác trong bài đọc';
    const locateBtnHtml = q.evidenceId
      ? `<button type="button" class="rp-rev-pill is-locate ${isLocActive ? 'is-active' : ''}" title="${locateTitle}" onclick="event.stopPropagation(); ReadingPracticeApp.locateEvidence('${esc(q.evidenceId)}')">${pinSvg}<span>Locate</span></button>`
      : (loc && passage?.id
        ? `<button type="button" class="rp-rev-pill is-locate ${isLocActive ? 'is-active' : ''}" title="${locateTitle}" onclick="event.stopPropagation(); ReadingPracticeApp.locateWebEvidence('${esc(passage.id)}', ${loc[0]}, ${loc[1]}, ${loc[2]}, ${q.num})">${pinSvg}<span>Locate</span></button>`
        : '');

    const explainBtnHtml = hasDetails
      ? `<button type="button" class="rp-rev-pill is-explain ${isExpOpen ? 'is-open' : ''}" aria-expanded="${isExpOpen ? 'true' : 'false'}" onclick="event.stopPropagation(); ReadingPracticeApp.toggleQuestionExplanation('${esc(expKey)}')"><span>Giải thích</span>${chevSvg}</button>`
      : '';

    return `
      <div class="rp-rev-inline ${ok ? 'is-ok' : 'is-bad'}">
        <div class="rp-rev-bar">
          <span class="rp-rev-key ${ok ? 'is-ok' : 'is-bad'}">${showQNum ? `<span class="rp-rev-qtag">Câu ${q.num}</span>` : ''}${ok ? `✓ Đúng · <strong>${esc(correctDisplay)}</strong>` : `Đáp án: <strong>${esc(correctDisplay)}</strong>`}</span>
          <div class="rp-rev-btns">
            ${locateBtnHtml}
            ${explainBtnHtml}
          </div>
        </div>
        ${(hasDetails && isExpOpen) ? `
          <div class="rp-rev-drawer">
            ${paraRows ? `
              <div class="rp-para-map">
                <div class="rp-pm-title">Paraphrase Mapping</div>
                ${paraRows}
              </div>
            ` : ''}
            ${quoteText ? `<div class="rp-rev-quote">“${esc(quoteText)}”</div>` : ''}
            ${expText ? `<div class="rp-rev-exp">${esc(expText)}</div>` : ''}
            ${srcLabel ? `<div class="rp-rev-src-foot">Nguồn: ${esc(srcLabel)}</div>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderFlatQuestionItem(q, passage, isReview) {
    const s = state.session;
    const qid = `${passage.id}__q${q.num}`;
    const userVal = String(s.answers[qid] ?? '');
    const flagged = !!s.flagged[qid];
    const isCur = s.activeQid === qid;
    const isLockedOk = !isReview && !!s.lockedCorrect?.[qid];
    const wrongState = !isReview ? s.wrongSet?.[qid] : null;
    const isWrongRetry = !!wrongState;
    const isReadOnly = isReview || isLockedOk;
    const ok = isReview ? isAnswerCorrect(q, userVal) : isLockedOk;

    const bookmarkBtn = !isReadOnly ? `
      <button type="button" class="ins-bookmark-btn ${flagged ? 'active' : ''}"
        onclick="event.stopPropagation(); ReadingPracticeApp.toggleFlag('${esc(qid)}')" title="Đánh dấu xem lại (Bookmark)">
        <svg viewBox="0 0 24 24" fill="${flagged ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
    ` : '';

    // Status pill during Retry Gate (NO answer key revealed!)
    const retryStatusPill = isLockedOk
      ? `<span class="rp-q-status is-ok" title="Câu này bạn đã làm đúng">✓ Đúng</span>`
      : (isWrongRetry
        ? `<span class="rp-q-status ${wrongState === 'edited' ? 'is-edited' : 'is-bad'}">${wrongState === 'edited' ? '↻ Đã sửa' : '✕ Chưa đúng · Làm lại'}</span>`
        : '');

    const cardStateCls = `${isCur && !isReview ? 'is-current' : ''}${isLockedOk ? ' is-checked-ok is-locked-ok' : (isWrongRetry ? (wrongState === 'edited' ? ' is-retry-edited' : ' is-checked-bad') : '')}`;

    if (q.type === 'gap') {
      const gapCls = isReview ? (ok ? 'is-ok' : 'is-bad') : (isLockedOk ? 'is-ok' : (isWrongRetry && wrongState !== 'edited' ? 'is-bad' : ''));
      const inlineBox = `<span class="ins-note-blank-wrap"><span class="ins-note-qnum ${gapCls || (isCur ? 'is-current' : '')}">${q.num}</span><input type="text" class="ins-gap-input ins-note-input ${gapCls}" value="${esc(userVal)}" ${isReadOnly ? 'readonly' : ''} aria-label="Question ${q.num}" onfocus="ReadingPracticeApp.focusQuestion('${esc(qid)}')" oninput="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value, true)" autocomplete="off"></span>`;
      const cleanPrompt = String(q.prompt || '')
        .replace(/^\s*(?:[•●○▪▸◦·\-–—]\s*)+/, '')
        .replace(/(?:…|\.{3,})\s*\.?\s*_{3,}/g, '_____');
      const stem = /_{3,}/.test(cleanPrompt) ? esc(cleanPrompt).replace(/_{3,}/, inlineBox) : `${esc(cleanPrompt)} ${inlineBox}`;
      const correctDisplay = Array.isArray(q.answer) ? q.answer[0] : q.answer;
      return `
        <div class="ins-q-item ins-q-gap ${cardStateCls}" id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
          <div class="ins-gap-bullet">
            <span class="ins-bullet-dot">•</span>
            <div class="ins-gap-line">${stem}</div>
            <div class="prac-q-inline-acts">${retryStatusPill}${bookmarkBtn}</div>
          </div>
          ${isReview ? renderReviewBlock(q, ok, correctDisplay, passage) : ''}
        </div>
      `;
    }

    let optionsHtml = '';
    if (q.type === 'tfng' || q.type === 'ynng') {
      const opts = q.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
      optionsHtml = `
        <div class="ins-radio-list" role="radiogroup" aria-label="Question ${q.num}">
          ${opts.map((opt) => {
            const active = userVal.toUpperCase() === opt;
            let cls = `ins-radio-row${active ? ' is-selected' : ''}`;
            if (isReview && opt === String(q.answer).toUpperCase()) cls += ' is-key';
            if (isLockedOk && active) cls += ' is-key';
            if ((isReview || (isWrongRetry && wrongState !== 'edited')) && active && !ok) cls += ' is-wrong-pick';
            return `
              <label class="${cls}">
                <input type="radio" name="${esc(qid)}" value="${opt}" ${active ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}
                  onchange="ReadingPracticeApp.setAnswer('${esc(qid)}', '${opt}')">
                <span>${opt}</span>
              </label>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'mcq') {
      optionsHtml = `
        <div class="ins-radio-list" role="radiogroup" aria-label="Question ${q.num}">
          ${(q.options || []).map((opt) => {
            const active = userVal.toUpperCase() === opt.key;
            const strikeKey = `${qid}__${opt.key}`;
            const isStruck = !!s.struck[strikeKey];
            let cls = `ins-radio-row${active ? ' is-selected' : ''}${isStruck ? ' is-struck' : ''}`;
            if (isReview && opt.key === String(q.answer).toUpperCase()) cls += ' is-key';
            if (isLockedOk && active) cls += ' is-key';
            if ((isReview || (isWrongRetry && wrongState !== 'edited')) && active && !ok) cls += ' is-wrong-pick';
            return `
              <div class="${cls}">
                <label class="ins-radio-lbl">
                  <input type="radio" name="${esc(qid)}" value="${esc(opt.key)}" ${active ? 'checked' : ''} ${isReadOnly ? 'disabled' : ''}
                    onchange="ReadingPracticeApp.setAnswer('${esc(qid)}', '${esc(opt.key)}')">
                  <strong>${esc(opt.key)}</strong>
                  <span class="ins-mcq-txt">${esc(opt.text)}</span>
                </label>
                ${!isReadOnly ? `
                  <button type="button" class="ins-strike-btn ${isStruck ? 'active' : ''}"
                    onclick="ReadingPracticeApp.toggleStrike('${esc(strikeKey)}', event)" title="Loại trừ phương án này">S̶</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'select') {
      const opts = Array.isArray(q.options) && q.options.length ? q.options : ['A', 'B', 'C', 'D', 'E'];
      const ansArr = Array.isArray(q.answer) ? q.answer.map((a) => String(a).toUpperCase()) : [String(q.answer || '').toUpperCase()];
      const isLargeWordBank = opts.length > 12 && opts.some((o) => String(o).trim().length > 3);
      if (isLargeWordBank) {
        let selCls = 'ins-inline-select';
        if (userVal) selCls += ' is-filled';
        if (isReview || isLockedOk) {
          selCls += ok ? ' is-ok' : ' is-bad';
        } else if (isWrongRetry && wrongState !== 'edited') {
          selCls += ' is-bad';
        }
        optionsHtml = `
          <div class="ins-select-dd-wrap" style="margin-top:6px;">
            <select class="${selCls}" aria-label="Question ${q.num}" ${isReadOnly ? 'disabled' : ''}
              style="min-width:190px;max-width:100%;"
              onchange="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value)">
              <option value="">-- Chọn từ (${opts.length} lựa chọn) --</option>
              ${opts.map((opt) => {
                const val = String(opt).trim();
                const selected = userVal.toUpperCase() === val.toUpperCase();
                return `<option value="${esc(val)}" ${selected ? 'selected' : ''}>${esc(val)}</option>`;
              }).join('')}
            </select>
          </div>
        `;
      } else {
        optionsHtml = `
          <div class="ins-select-chips" role="radiogroup" aria-label="Question ${q.num}">
            ${opts.map((opt) => {
              const val = String(opt).trim();
              const active = userVal.toUpperCase() === val.toUpperCase();
              let cls = `ins-sel-chip${active ? ' is-selected' : ''}`;
              if (isReview && ansArr.includes(val.toUpperCase())) cls += ' is-key';
              if (isLockedOk && active) cls += ' is-key';
              if ((isReview || (isWrongRetry && wrongState !== 'edited')) && active && !ok) cls += ' is-wrong-pick';
              return `
                <button type="button" class="${cls}" ${isReadOnly ? 'disabled' : ''}
                  aria-pressed="${active ? 'true' : 'false'}"
                  onclick="ReadingPracticeApp.setAnswer('${esc(qid)}', '${esc(val)}')">${esc(val)}</button>
              `;
            }).join('')}
          </div>
        `;
      }
    }

    const correctDisplay = Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer;
    return `
      <div class="ins-q-item ${cardStateCls}" id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
        <div class="ins-q-stem-row">
          <span class="ins-q-num ${isCur && !isReview ? 'is-active' : ''}">${q.num}</span>
          <div class="ins-q-stem">${esc(q.prompt)}</div>
          <div class="prac-q-inline-acts">${retryStatusPill}${bookmarkBtn}</div>
        </div>
        ${optionsHtml}
        ${isReview ? renderReviewBlock(q, ok, correctDisplay, passage) : ''}
      </div>
    `;
  }

  /* ---------- CLICK-TO-DICTIONARY POPOVER (Review & News -> My Vocab) ---------- */
  function extractSentenceForNode(node, fallbackWord = '') {
    const el = node?.nodeType === 1 ? node : node?.parentElement;
    const container = el?.closest?.('.rp-para-text, .ins-q-stem, .ins-note-line, .ins-gap-line, .ins-mcq-txt, .ins-group-inst, .rp-wb-val, .ins-heading-pill, .ins-note-heading, .ins-note-subheading, .ins-q-item');
    if (!container) return '';
    let full = '';
    if (container.classList.contains('rp-para-text')) {
      full = (container.textContent || '').replace(/\s+/g, ' ').trim();
    } else {
      const clone = container.cloneNode(true);
      clone.querySelectorAll('input, select, option, textarea, button, svg, .rp-rev-inline, .ins-note-qnum, .ins-q-num, .prac-q-inline-acts').forEach((n) => n.remove());
      full = (clone.textContent || '').replace(/\s+/g, ' ').trim();
    }
    const word = (fallbackWord || el?.dataset?.word || el?.textContent || '').trim();
    if (!full || !word) return full.slice(0, 220);
    const sentences = full.split(/(?<=[.!?])\s+/);
    const found = sentences.find((sent) => sent.toLowerCase().includes(word.toLowerCase()));
    return (found || full).trim().slice(0, 260);
  }

  function getWordAtClientPoint(clientX, clientY, rootEl) {
    let textNode = null;
    let offset = 0;
    if (typeof document.caretRangeFromPoint === 'function') {
      const r = document.caretRangeFromPoint(clientX, clientY);
      if (r && r.startContainer?.nodeType === 3) {
        textNode = r.startContainer;
        offset = r.startOffset;
      }
    } else if (typeof document.caretPositionFromPoint === 'function') {
      const pos = document.caretPositionFromPoint(clientX, clientY);
      if (pos && pos.offsetNode?.nodeType === 3) {
        textNode = pos.offsetNode;
        offset = pos.offset;
      }
    }
    if (!textNode || (rootEl && !rootEl.contains(textNode))) return null;
    const text = textNode.nodeValue || '';
    if (!text.length) return null;
    let idx = Math.min(Math.max(0, offset), text.length - 1);
    const isWordCh = (c) => /[A-Za-z'-]/.test(c || '');
    if (!isWordCh(text[idx]) && idx > 0 && isWordCh(text[idx - 1])) idx -= 1;
    if (!isWordCh(text[idx])) return null;
    let start = idx;
    let end = idx + 1;
    while (start > 0 && isWordCh(text[start - 1])) start--;
    while (end < text.length && isWordCh(text[end])) end++;
    const rawWord = text.slice(start, end).replace(/^['-]+|['-]+$/g, '');
    if (rawWord.length < 2 || !/[A-Za-z]/.test(rawWord)) return null;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, end);
    const rect = range.getBoundingClientRect();
    // Guard against clicking far away in empty whitespace on the same line
    if (!rect || rect.width <= 0 || clientX < rect.left - 8 || clientX > rect.right + 8 || clientY < rect.top - 8 || clientY > rect.bottom + 8) {
      return null;
    }
    return { word: rawWord, rect, node: textNode };
  }

  function trimContextCleanly(sentence, targetWord, maxLen = 175) {
    const raw = String(sentence || '').replace(/\s+/g, ' ').trim();
    if (!raw) return '';
    if (raw.length <= maxLen) return raw;
    const low = raw.toLowerCase();
    const wLow = String(targetWord || '').trim().toLowerCase();
    const pos = wLow ? low.indexOf(wLow) : -1;
    let start = 0;
    let end = maxLen;
    if (pos >= 0 && pos + wLow.length > maxLen - 20) {
      start = Math.max(0, pos - Math.floor(maxLen * 0.42));
      end = Math.min(raw.length, start + maxLen);
    }
    // Snap start/end cleanly to word boundaries so we NEVER slice mid-word like "unt"!
    if (start > 0) {
      const sp = raw.indexOf(' ', start);
      if (sp > start && sp < start + 18) start = sp + 1;
    }
    if (end < raw.length) {
      const sp = raw.lastIndexOf(' ', end);
      if (sp > start + 40) end = sp;
    }
    const prefix = start > 0 ? '…' : '';
    const suffix = end < raw.length ? '…' : '';
    return `${prefix}${raw.slice(start, end).trim()}${suffix}`;
  }

  function highlightWordInContextHtml(sentence, targetWord) {
    const trimmed = trimContextCleanly(sentence, targetWord, 175);
    if (!trimmed) return '';
    const w = String(targetWord || '').trim();
    if (!w || w.length < 2) return esc(trimmed);
    const escRe = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(${escRe})`, 'i');
    const parts = trimmed.split(re);
    if (parts.length < 3) return esc(trimmed);
    return parts.map((p, idx) => (idx % 2 === 1 ? `<mark class="rp-dict-ctx-hit">${esc(p)}</mark>` : esc(p))).join('');
  }

  function positionDictPopover(pop, anchorRect) {
    if (!pop) return;
    const popRect = pop.getBoundingClientRect();
    const pw = Math.max(330, Math.round(popRect.width || 368));
    const ph = Math.max(220, Math.round(popRect.height || 320));
    const left = Math.max(14, Math.min(window.innerWidth - pw - 14, (anchorRect?.left || 100) - 24));
    const belowTop = (anchorRect?.bottom || 180) + 10;
    const aboveTop = (anchorRect?.top || 180) - ph - 10;
    const top = (belowTop + ph <= window.innerHeight - 14)
      ? Math.max(62, belowTop)
      : (aboveTop >= 62 ? aboveTop : Math.max(62, window.innerHeight - ph - 14));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function renderDictPopoverBody(pop, target, isLoadingOnline = false) {
    if (!pop || !target) return;
    const { entry, context, deckName, sourcePane, editMode } = target;
    const decks = window.MyVocabStore ? window.MyVocabStore.getDecks() : [];
    const deckOptions = [deckName, ...decks.map((d) => d.name).filter((n) => n !== deckName)];
    const savedSet = window.MyVocabStore ? window.MyVocabStore.getSavedWordSet() : new Set();
    const alreadySaved = savedSet.has(entry.word.toLowerCase()) || savedSet.has(entry.lemma.toLowerCase());
    const ctxLabel = sourcePane === 'questions' ? 'Ngữ cảnh câu hỏi' : 'Ngữ cảnh bài đọc';

    const bookChkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m9 10 2 2 4-4"/></svg>`;
    const starChkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/><path d="m9 10 2 2 4-4"/></svg>`;
    const spkSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    const editSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>`;

    const statusChips = [];
    if (entry.inReadingList) {
      const statusSuffix = entry.readingStatus === 'mastered'
        ? ' · Đã thuộc'
        : (entry.readingStatus === 'learning' ? ' · Đang ôn' : '');
      const statusCls = entry.readingStatus === 'mastered' ? 'is-mastered' : 'is-reading-list';
      statusChips.push(`<span class="rp-dict-status-chip ${statusCls}" title="Từ '${esc(entry.readingLemma)}' đã có sẵn trong bộ Reading (${esc(entry.readingListLabel)})">${bookChkSvg}<span>Reading · ${esc(entry.readingListLabel)}${statusSuffix}</span></span>`);
    }
    if (alreadySaved) {
      statusChips.push(`<span class="rp-dict-status-chip is-myvocab" title="Đã lưu trong Từ của tôi">${starChkSvg}<span>MY LIST</span></span>`);
    }
    const statusBarHtml = statusChips.length ? `<div class="rp-dict-status-row">${statusChips.join('')}</div>` : '';

    const meaningBlockHtml = editMode
      ? `
        <div class="rp-dict-meaning-edit">
          <textarea class="rp-dict-ta" id="rp-dict-meaning-input" rows="2" placeholder="Nhập nghĩa tiếng Việt ngắn gọn..."
            oninput="ReadingPracticeApp.onDictMeaningEdit(this.value)">${esc(entry.vi)}</textarea>
        </div>
      `
      : (isLoadingOnline && !entry.vi
        ? `<div class="rp-dict-loading"><span class="rp-dict-shimmer"></span><span>Đang tra nghĩa tự động…</span></div>`
        : `
          <div class="rp-dict-meaning-view">
            <div class="rp-dict-meaning-text ${entry.vi ? '' : 'is-empty'}">
              ${entry.vi ? esc(entry.vi) : 'Chưa có nghĩa — bấm Sửa để tự ghi chú'}
            </div>
            <button type="button" class="rp-dict-edit-btn" onclick="ReadingPracticeApp.toggleDictMeaningEdit()" title="Chỉnh sửa nghĩa trước khi lưu">
              ${editSvg}<span>Sửa</span>
            </button>
          </div>
          ${entry.enDef ? `<div class="rp-dict-endef">${esc(entry.enDef)}</div>` : ''}
        `);

    const synsHtml = entry.synonyms.length ? `
      <div class="rp-dict-syns-v2">
        <span class="rp-dict-syns-lbl">≈</span>
        <div class="rp-dict-syns-chips">
          ${entry.synonyms.map((sy) => `<button type="button" class="rp-syn-chip is-btn" onclick="ReadingPracticeApp.lookupSynonymWord('${esc(sy).replace(/'/g, "\\'")}')">${esc(sy)}</button>`).join('')}
        </div>
      </div>
    ` : '';

    const ctxHtml = context ? `
      <div class="rp-dict-ctx-v2">
        <span class="rp-dict-ctx-tag">${ctxLabel}</span>
        <div class="rp-dict-ctx-quote">“${highlightWordInContextHtml(context, entry.word)}”</div>
      </div>
    ` : '';

    pop.innerHTML = `
      <div class="rp-dict-v2">
        <div class="rp-dict-head-v2">
          <div class="rp-dict-title-col">
            <div class="rp-dict-word-row">
              <span class="rp-dict-word-v2">${esc(entry.word)}</span>
              ${entry.pos ? `<span class="rp-dict-pos-v2">${esc(entry.pos)}</span>` : ''}
            </div>
            <div class="rp-dict-phon-row">
              ${entry.ipa ? `<span class="rp-dict-ipa-v2">${esc(entry.ipa)}</span>` : ''}
              <button type="button" class="rp-dict-spk-v2" onclick="ReadingPracticeApp.speakDictWord('en-US')" title="Phát âm Mỹ (US)">${spkSvg}<span>US</span></button>
              <button type="button" class="rp-dict-spk-v2" onclick="ReadingPracticeApp.speakDictWord('en-GB')" title="Phát âm Anh (UK)">${spkSvg}<span>UK</span></button>
            </div>
          </div>
          <button type="button" class="rp-dict-close-v2" onclick="ReadingPracticeApp.closeDictPopover()" aria-label="Đóng">✕</button>
        </div>

        ${statusBarHtml}

        <div class="rp-dict-meaning-box">
          ${meaningBlockHtml}
        </div>

        ${synsHtml}
        ${ctxHtml}

        <div class="rp-dict-foot-v2">
          <select class="rp-dict-deck-sel-v2" id="rp-dict-deck-select" aria-label="Chọn bộ từ lưu">
            ${deckOptions.map((dn) => `<option value="${esc(dn)}">${esc(dn)}</option>`).join('')}
          </select>
          <button type="button" class="btn btn-primary rp-btn-sm rp-dict-save-v2" id="rp-btn-save-myvocab" onclick="ReadingPracticeApp.saveDictWordToMyVocab()">
            ${alreadySaved ? '✓ Lưu thêm' : '+ Lưu vào Từ của tôi'}
          </button>
        </div>
      </div>
    `;
  }

  function showDictPopover(rawWord, contextSentence, anchorRect, sourcePane = 'passage') {
    const pop = document.getElementById('rp-dict-popover');
    if (!pop || !state.session) return;
    const passages = getSessionPassages();
    const curPassage = passages[state.session.activePassageIdx] || passages[0];
    const entry = lookupWordEntry(rawWord, curPassage);
    if (!entry.word) return;

    const defaultDeckName = state.session.deckDefaultName || 'Từ của tôi';
    const seq = ++_dictLookupSeq;
    const target = {
      seq,
      entry,
      context: contextSentence || '',
      deckName: defaultDeckName,
      sourcePane,
      anchorRect,
      editMode: false,
      userEdited: false
    };
    state.dictTarget = target;

    const shouldFetchOnline = !entry.vi || (!entry.ipa && !entry.inReadingList);
    renderDictPopoverBody(pop, target, shouldFetchOnline && !entry.vi);
    pop.classList.remove('hidden');
    positionDictPopover(pop, anchorRect);

    if (shouldFetchOnline) {
      fetchOnlineWordDefinition(entry.word).then((online) => {
        if (!state.dictTarget || state.dictTarget.seq !== seq) return;
        if (online) {
          if (online.vi && !state.dictTarget.userEdited && !state.dictTarget.entry.vi) {
            state.dictTarget.entry.vi = online.vi;
          }
          if (online.ipa && !state.dictTarget.entry.ipa) {
            state.dictTarget.entry.ipa = online.ipa;
          }
          if (online.pos && (!state.dictTarget.entry.pos || ['Từ vựng', 'Từ ghép', 'word'].includes(state.dictTarget.entry.pos))) {
            state.dictTarget.entry.pos = online.pos;
          }
          if (online.enDef && !state.dictTarget.entry.enDef) {
            state.dictTarget.entry.enDef = online.enDef;
          }
          if (online.synonyms?.length && !state.dictTarget.entry.synonyms.length) {
            state.dictTarget.entry.synonyms = online.synonyms;
          }
        }
        renderDictPopoverBody(pop, state.dictTarget, false);
        positionDictPopover(pop, anchorRect);
      });
    }
  }

  /* =========================================================
     7. PUBLIC CONTROLLER API
     ========================================================= */
  const ReadingPracticeApp = {
    init() {
      renderPortal();
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDictPopover();
          this.hideHighlightToolbar();
          this.closePreSubmitModal();
          if (state.session?.optionsOpen) this.toggleOptionsOverlay(false);
        }
      });
    },

    render() {
      if (state.view === 'exam' && state.session) renderExamWorkspace();
      else if (state.view === 'source') renderHub();
      else renderPortal();
    },

    openPortal() {
      state.view = 'portal';
      renderPortal();
    },

    openSource(src, part) {
      const targetSrc = src || 'cambridge';
      state.source = targetSrc;
      state.view = 'source';
      state.partFilter = part || 'all';
      state.newsTopic = 'all';
      state.searchQuery = '';
      if (targetSrc === 'actual') {
        state.actualTab = ['p1', 'p2', 'p3', 'full'].includes(part) ? part : 'p1';
        state.actualQType = '';
        state.actualPage = 1;
      }
      const pickDefaultBook = () => {
        if (state.source === 'actual' || state.source === 'news') return;
        const books = getBooksForSource(state.source);
        if (books.length) {
          const ready = books.find((b) => countReadyTestsInBook(b.id) > 0) || books[0];
          state.selectedBookId = ready.id;
          state.selectedTestNum = 1;
        }
      };
      pickDefaultBook();
      const loadPromise = ensureSourceBankLoaded(targetSrc);
      renderHub();
      loadPromise.then(() => {
        if (state.view === 'source' && state.source === targetSrc) {
          if (targetSrc !== 'actual' && countReadyTestsInBook(state.selectedBookId) === 0) pickDefaultBook();
          renderHub();
        }
      });
    },

    setSource(src) {
      this.openSource(src, 'all');
    },

    setCamGroup(grp) {
      state.camGroup = grp === 'classic' ? 'classic' : 'recent';
      renderHub();
    },

    closeAntiCheatModal() {
      closeAntiCheatModal();
    },

    setActualTab(tab) {
      state.actualTab = ['p1', 'p2', 'p3', 'full'].includes(tab) ? tab : 'p1';
      state.actualPage = 1;
      state.actualFilterOpen = false;
      if (state.actualTab === 'full') state.actualQType = '';
      renderHub();
    },

    toggleActualFilterMenu(forceVal) {
      state.actualFilterOpen = typeof forceVal === 'boolean' ? forceVal : !state.actualFilterOpen;
      renderHub();
      if (state.actualFilterOpen && !window.__rpActualPopBound) {
        window.__rpActualPopBound = true;
        document.addEventListener('click', (e) => {
          if (!state.actualFilterOpen) return;
          if (e.target && e.target.closest && e.target.closest('.rp-actual-search-wrap')) return;
          state.actualFilterOpen = false;
          if (state.view === 'source' && state.source === 'actual') renderHub();
        });
      }
    },

    toggleActualQType(qtype) {
      state.actualQType = state.actualQType === qtype ? '' : String(qtype || '');
      state.actualFilterOpen = false;
      state.actualPage = 1;
      renderHub();
    },

    setActualPage(page) {
      state.actualPage = Math.max(1, Number(page) || 1);
      renderHub();
      document.querySelector('.rp-actual-toolbar')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    },

    selectBook(bookId) {
      state.selectedBookId = bookId;
      state.selectedTestNum = 1;
      renderHub();
      const btn = document.querySelector(`.rp-book-pill[data-rp-book="${bookId}"]`);
      if (btn && typeof btn.scrollIntoView === 'function') {
        btn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    },

    onShelfKeydown(ev, bookId) {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(ev.key)) return;
      const pills = Array.from(document.querySelectorAll('#rp-book-rail .rp-book-pill'));
      if (!pills.length) return;
      const idx = pills.findIndex((el) => el.dataset.rpBook === bookId);
      if (idx < 0) return;
      ev.preventDefault();
      let nextIdx = idx;
      if (ev.key === 'ArrowRight') nextIdx = Math.min(pills.length - 1, idx + 1);
      else if (ev.key === 'ArrowLeft') nextIdx = Math.max(0, idx - 1);
      else if (ev.key === 'Home') nextIdx = 0;
      else if (ev.key === 'End') nextIdx = pills.length - 1;
      const target = pills[nextIdx];
      if (target) {
        target.focus();
        target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
    },

    scrollShelf(dir) {
      const rows = document.querySelectorAll('#rp-book-rail .rp-shelf-row');
      rows.forEach((row) => {
        if (row.scrollWidth > row.clientWidth + 4) {
          row.scrollBy({ left: (dir || 1) * 280, behavior: 'smooth' });
        }
      });
    },

    selectTestNum(num) {
      state.selectedTestNum = Number(num) || 1;
      renderHub();
    },

    jumpToFirstReady(src) {
      const books = getBooksForSource(src || state.source);
      const ready = books.find((b) => countReadyTestsInBook(b.id) > 0) || books[0];
      if (ready) {
        state.selectedBookId = ready.id;
        state.selectedTestNum = 1;
        state.partFilter = 'all';
        renderHub();
      }
    },

    setPartFilter(part) {
      state.partFilter = part;
      renderHub();
    },

    setNewsTopic(tp) {
      state.newsTopic = tp;
      renderHub();
    },

    onSearch(val) {
      state.searchQuery = String(val || '');
      state.actualPage = 1;
      renderHub();
      const inp = document.getElementById('rp-hub-search');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    },

    startPassage(passageId, opts = {}) {
      const p = (DATA().PASSAGES || {})[passageId];
      if (!p) return;
      startSession({
        itemId: p.id, title: p.title, source: p.source, isFull: false,
        studyMode: opts.studyMode || (p.source === 'news' ? 'practice' : 'exam'),
        suggestedMins: p.suggestedMins || 20, deckDefaultName: p.deckDefaultName || p.title,
        passageIds: [p.id], openInReview: !!opts.openInReview,
        answers: opts.answers || undefined,
        elapsedSec: opts.elapsedSec
      });
    },

    startFullTest(fullId, opts = {}) {
      const ft = (DATA().FULL_TESTS || []).find((x) => x.id === fullId);
      if (!ft) return;
      startSession({
        itemId: ft.id, title: ft.title, source: ft.source, isFull: true,
        studyMode: opts.studyMode || 'exam',
        suggestedMins: ft.suggestedMins || 60, deckDefaultName: ft.deckDefaultName || ft.title,
        passageIds: ft.passageIds.slice(), openInReview: !!opts.openInReview,
        answers: opts.answers || undefined,
        elapsedSec: opts.elapsedSec
      });
    },

    async openHistoryReview(attemptIdx) {
      const hist = ReadingPracticeStore.getHistory();
      const h = hist[Number(attemptIdx) || 0];
      if (!h || !h.itemId) return;
      const src = h.source || (/^vol/i.test(h.itemId) ? 'volume' : (/^act/i.test(h.itemId) ? 'actual' : (/^news/i.test(h.itemId) ? 'news' : 'cambridge')));
      window.TotoroUI?.enterSkillMode?.('Reading', 'practice');
      await ensureSourceBankLoaded(src);
      const opts = {
        openInReview: true,
        studyMode: h.studyMode || 'practice',
        answers: h.answers || {},
        elapsedSec: Number(h.elapsedSec || 0)
      };
      if (h.isFull) this.startFullTest(h.itemId, opts);
      else this.startPassage(h.itemId, opts);
    },

    resumeDraft() {
      ReadingPracticeStore.clearInProgress();
    },

    discardResume() {
      ReadingPracticeStore.clearInProgress();
      this.render();
    },

    exitToHub(forceImmediate = false) {
      const s = state.session;
      if (s?.liveRoomId) {
        forceImmediate = true;
        window.LiveReadingRoom?.leaveRoom?.(true);
      }
      // Strict Finish-to-Leave Policy: leaving an active test ALWAYS requires ending & grading immediately (NO draft!)
      if (!forceImmediate && s && s.mode === 'exam' && !s.isNews) {
        if (s.optionsOpen) {
          s.optionsOpen = false;
          renderExamWorkspace();
        }
        this.openExitConfirmModal();
        return;
      }
      stopTimer();
      stopReadingAntiCheat();
      if (s && s.mode === 'exam' && !s.isNews) persistDraft();
      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();
    },

    saveAndExitToHub() {
      if (state.session && state.session.mode === 'exam') {
        persistDraft();
      }
      const modal = document.getElementById('rp-presubmit-modal');
      if (modal) modal.classList.remove('open');
      stopTimer();
      stopReadingAntiCheat();
      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();
      window.__VOCAB_BRIDGE__?.showToast?.('Đã lưu nguyên tiến trình bài làm — bạn vào lại đề này để làm tiếp nhé!');
    },

    openExitConfirmModal() {
      if (!state.session) return;
      const modal = document.getElementById('rp-presubmit-modal');
      const body = document.getElementById('rp-presubmit-body');
      if (!modal || !body) return;
      modal.querySelector('.rp-presubmit-card')?.classList.remove('is-result-view');
      const allQ = getAllSessionQuestions();
      const answered = allQ.filter((q) => !!String(state.session.answers[q._qid] || '').trim()).length;
      const unanswered = allQ.length - answered;
      const titleEl = document.getElementById('rp-presubmit-title');
      if (titleEl) titleEl.textContent = 'Kết thúc bài đang làm?';

      body.innerHTML = `
        <div class="rp-exit-summary">
          <div class="rp-exit-metrics">
            <div class="rp-exit-metric">
              <span class="rp-exit-metric-label">Đã làm</span>
              <strong class="rp-exit-metric-val tabular">${answered} <span class="rp-exit-metric-total">/ ${allQ.length}</span></strong>
            </div>
            <div class="rp-exit-metric ${unanswered > 0 ? 'is-pending' : 'is-done'}">
              <span class="rp-exit-metric-label">Chưa làm</span>
              <strong class="rp-exit-metric-val tabular">${unanswered}</strong>
            </div>
          </div>
          <p class="rp-exit-note">
            Bạn có thể <strong>Lưu tiến trình &amp; Thoát</strong> để làm tiếp sau (không mất đáp án), hoặc <strong>Nộp &amp; Chấm điểm ngay</strong>.
          </p>
        </div>
        <div class="rp-ps-foot rp-exit-foot">
          <button type="button" class="btn btn-subtle" onclick="ReadingPracticeApp.saveAndExitToHub()">Lưu &amp; Thoát</button>
          <button type="button" class="rp-btn-exit-confirm" id="rp-btn-confirm-exit-grade" onclick="ReadingPracticeApp.confirmFinishAndExit()">Nộp &amp; Chấm điểm</button>
          <button type="button" class="btn btn-primary rp-btn-stay" onclick="ReadingPracticeApp.closePreSubmitModal()">Ở lại làm tiếp</button>
        </div>
      `;
      modal.classList.add('open');
    },

    confirmFinishAndExit() {
      if (!state.session) return;
      const s = state.session;
      const allQ = getAllSessionQuestions();
      const res = computeReviewResult();
      const isMastered = res.total > 0 && res.score === res.total;

      stopTimer();
      stopReadingAntiCheat();
      ReadingPracticeStore.clearDraftForItem(s.itemId);

      ReadingPracticeStore.recordAttempt({
        itemId: s.itemId,
        title: s.title,
        source: s.source,
        isFull: s.isFull,
        score: res.score,
        total: res.total,
        band: res.band,
        elapsedSec: res.elapsedSec,
        mastered: isMastered,
        completedAt: Date.now()
      });

      const reportRows = allQ.map((q) => {
        const val = String(s.answers[q._qid] ?? '').trim();
        return {
          num: q.num,
          pIdx: q._pIdx,
          qid: q._qid,
          answer: val,
          ok: isAnswerCorrect(q, val)
        };
      });

      s.attemptCount = Math.max(1, (Number(s.attemptCount) || 0) + 1);
      s.lastSubmitReport = {
        attempt: s.attemptCount,
        score: res.score,
        total: res.total,
        band: res.band,
        elapsedSec: res.elapsedSec,
        isMastered,
        endedEarly: !isMastered,
        rows: reportRows
      };

      if (isMastered) {
        s.mode = 'review';
        s.endedEarly = false;
        s.wrongSet = {};
        allQ.forEach((q) => { s.lockedCorrect[q._qid] = true; });
        s.reviewResult = res;
        renderExamWorkspace();
      } else {
        s.endedEarly = true;
      }
      this.openResultModal();
    },

    finishExitToHub() {
      stopTimer();
      stopReadingAntiCheat();
      window.LiveReadingRoom?.leaveRoom?.(true);
      const modal = document.getElementById('rp-presubmit-modal');
      if (modal) modal.classList.remove('open');
      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();
    },

    openReviewFromResult() {
      if (!state.session) return;
      const s = state.session;
      if (!isTeacherBypass() && !s.lastSubmitReport?.isMastered && s.mode !== 'review') return;
      stopTimer();
      stopReadingAntiCheat();
      s.endedEarly = false;
      s.mode = 'review';
      s.reviewResult = s.reviewResult || computeReviewResult();
      const modal = document.getElementById('rp-presubmit-modal');
      if (modal) modal.classList.remove('open');
      renderExamWorkspace();
    },

    switchExamPassage(idx) {
      if (!state.session) return;
      state.session.activePassageIdx = idx;
      state.session.activeEvidenceId = null;
      const firstQ = getAllSessionQuestions().find((q) => q._pIdx === idx);
      if (firstQ) state.session.activeQid = firstQ._qid;
      this.closeDictPopover();
      renderExamWorkspace();
    },

    toggleOptionsOverlay(forceVal) {
      if (!state.session) return;
      state.session.optionsOpen = typeof forceVal === 'boolean' ? forceVal : !state.session.optionsOpen;
      renderExamWorkspace();
    },

    setStudyMode(mode) {
      if (!state.session) return;
      const target = mode === 'practice' ? 'practice' : 'exam';
      if (state.session.studyMode === target) return;
      if (state.session.studyMode === 'practice') {
        state.session.practiceContrast = state.session.contrast || 'totoro';
      }
      state.session.studyMode = target;
      if (target === 'exam') {
        // Exam mode ALWAYS locks to official bright CD-IELTS white screen
        state.session.contrast = 'cd';
        state.session.showTimer = true;
        this.closeDictPopover();
      } else {
        state.session.contrast = state.session.practiceContrast || 'totoro';
      }
      persistDraft();
      renderExamWorkspace();
      toast(target === 'practice'
        ? 'Đã chuyển sang Luyện tập (highlight pastel · tra từ · tùy chỉnh nền)'
        : 'Đã chuyển sang Thi thật (mặc định nền sáng chuẩn phòng thi)');
    },

    setPenColor(color) {
      if (!state.session) return;
      const valid = PASTEL_PENS.some((p) => p.id === color);
      state.session.activePenColor = valid ? color : 'yellow';
      persistDraft();
      // Update swatch bar active class surgically without losing scroll or selection
      document.querySelectorAll('#prac-pen-bar .prac-pen-chip').forEach((btn) => {
        const isAct = btn.dataset.penColor === state.session.activePenColor;
        btn.classList.toggle('active', isAct);
        btn.setAttribute('aria-pressed', isAct ? 'true' : 'false');
      });
      document.querySelectorAll('#rp-hl-toolbar .prac-pop-dot').forEach((dot) => {
        dot.classList.toggle('is-active', dot.dataset.popColor === state.session.activePenColor);
      });
    },

    toggleBrushAuto() {
      if (!state.session) return;
      state.session.brushAuto = !state.session.brushAuto;
      persistDraft();
      const btn = document.getElementById('prac-btn-brush-auto');
      if (btn) {
        btn.classList.toggle('is-on', state.session.brushAuto);
        btn.setAttribute('aria-pressed', state.session.brushAuto ? 'true' : 'false');
      }
      toast(state.session.brushAuto
        ? 'Bật Tô nhanh: Bôi đen văn bản để tô màu pastel ngay lập tức!'
        : 'Đã tắt Tô nhanh: Bôi đen để mở bảng chọn 5 màu & tra từ.');
    },

    toggleTimerVisibility() {
      if (!state.session) return;
      state.session.showTimer = !state.session.showTimer;
      persistDraft();
      renderExamWorkspace();
    },

    checkSingleQuestion(qid) {
      if (!state.session || state.session.mode !== 'exam' || state.session.studyMode !== 'practice') return;
      if (!state.session.checkedMap) state.session.checkedMap = {};
      if (state.session.checkedMap[qid]) {
        delete state.session.checkedMap[qid];
      } else {
        state.session.checkedMap[qid] = true;
      }
      state.session.activeQid = qid;
      persistDraft();
      renderExamWorkspace();
    },

    checkAnsweredQuestions() {
      if (!state.session || state.session.mode !== 'exam' || state.session.studyMode !== 'practice') return;
      if (!state.session.checkedMap) state.session.checkedMap = {};
      const curQs = getAllSessionQuestions().filter((q) => q._pIdx === state.session.activePassageIdx);
      let checkedCnt = 0;
      let okCnt = 0;
      curQs.forEach((q) => {
        const val = String(state.session.answers[q._qid] || '').trim();
        if (val) {
          state.session.checkedMap[q._qid] = true;
          checkedCnt += 1;
          if (isAnswerCorrect(q, val)) okCnt += 1;
        }
      });
      if (!checkedCnt) {
        toast('Bạn hãy điền ít nhất 1 câu trả lời trước khi kiểm tra nhé.');
        return;
      }
      persistDraft();
      renderExamWorkspace();
      toast(`Đã kiểm tra ${checkedCnt} câu đã làm: đúng ${okCnt}/${checkedCnt}!`);
    },

    clearCheckedQuestions() {
      if (!state.session) return;
      const curQs = getAllSessionQuestions().filter((q) => q._pIdx === state.session.activePassageIdx);
      if (state.session.checkedMap) {
        curQs.forEach((q) => delete state.session.checkedMap[q._qid]);
      }
      persistDraft();
      renderExamWorkspace();
    },

    setContrast(mode) {
      if (!state.session) return;
      if (state.session.studyMode !== 'practice') {
        state.session.contrast = 'cd';
        return;
      }
      // Bright paper presets only (no dark/black background)
      const next = ['totoro', 'cd', 'sepia'].includes(mode) ? mode : 'totoro';
      state.session.contrast = next;
      state.session.practiceContrast = next;
      persistDraft();
      renderExamWorkspace();
    },

    setTextSize(sz) {
      if (!state.session) return;
      state.session.textSize = ['regular', 'large', 'xlarge'].includes(sz) ? sz : 'regular';
      persistDraft();
      renderExamWorkspace();
    },

    togglePauseTimer() {
      if (!state.session || state.session.mode !== 'exam') return;
      state.session.paused = !state.session.paused;
      renderExamWorkspace();
    },

    setMobilePane(pane) {
      state.mobilePane = pane === 'questions' ? 'questions' : 'passage';
      renderExamWorkspace();
    },

    focusQuestion(qid) {
      if (!state.session || state.session.activeQid === qid) return;
      state.session.activeQid = qid;
      document.querySelectorAll('.ins-q-item.is-current').forEach((el) => el.classList.remove('is-current'));
      document.querySelectorAll('.ins-q-num.is-active').forEach((el) => el.classList.remove('is-active'));
      document.querySelectorAll('.ins-note-qnum.is-current').forEach((n) => n.classList.remove('is-current'));
      const card = document.getElementById(`rp-qcard-${qid}`);
      if (card) {
        card.classList.add('is-current');
        card.querySelector('.ins-q-num')?.classList.add('is-active');
        card.querySelector('.ins-note-qnum')?.classList.add('is-current');
        card.closest('.ins-q-item')?.classList.add('is-current');
      }
      const pQs = getAllSessionQuestions().filter((q) => q._pIdx === state.session.activePassageIdx);
      const idx = pQs.findIndex((q) => q._qid === qid);
      document.querySelectorAll('.ins-qbox').forEach((b, i) => b.classList.toggle('is-current', i === idx));
    },

    stepQuestion(delta) {
      if (!state.session) return;
      const allQ = getAllSessionQuestions();
      if (!allQ.length) return;
      const curIdx = Math.max(0, allQ.findIndex((q) => q._qid === state.session.activeQid));
      const nextIdx = Math.max(0, Math.min(allQ.length - 1, curIdx + (delta || 0)));
      const target = allQ[nextIdx];
      if (target) this.jumpToQuestion(target._pIdx, target._qid);
    },

    jumpToQuestion(pIdx, qid) {
      if (!state.session) return;
      state.session.activeQid = qid;
      state.mobilePane = 'questions';
      state.session.activePassageIdx = pIdx;
      renderExamWorkspace();
      const el = document.getElementById(`rp-qcard-${qid}`) || document.querySelector(`[data-mh-qid="${qid}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    setAnswer(qid, value, skipFullRerender = false) {
      if (!state.session || state.session.mode !== 'exam') return;
      if (state.session.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        renderExamWorkspace();
        return;
      }
      // Do not allow changing already-locked correct answers during Retry phase
      if (state.session.lockedCorrect && state.session.lockedCorrect[qid]) return;
      state.session.answers[qid] = value;
      state.session.activeQid = qid;
      const wasWrong = !!(state.session.wrongSet && state.session.wrongSet[qid]);
      if (wasWrong) state.session.wrongSet[qid] = 'edited';
      persistDraft();
      if (!_applyingLiveRemote && state.session.liveRoomId && window.LiveReadingRoom?.isActive()) {
        window.LiveReadingRoom.pushAnswer(qid, value);
      }
      if (skipFullRerender) {
        const pQs = getAllSessionQuestions().filter((q) => q._pIdx === state.session.activePassageIdx);
        const idx = pQs.findIndex((q) => q._qid === qid);
        const boxes = document.querySelectorAll('.ins-qbox');
        if (boxes[idx]) {
          boxes[idx].classList.toggle('is-attempted', String(value || '').trim().length > 0);
          if (wasWrong) {
            boxes[idx].classList.remove('is-wrong');
            boxes[idx].classList.add('is-retry-edited');
          }
        }
        const allQ = getAllSessionQuestions();
        const doneCnt = allQ.filter((q) => String(state.session.answers[q._qid] || '').trim()).length;
        const fill = document.querySelector('.prac-prog-fill');
        if (fill && allQ.length) fill.style.width = `${Math.round((doneCnt / allQ.length) * 100)}%`;
        const progStrong = document.querySelector('.prac-prog-pill strong');
        if (progStrong) progStrong.textContent = String(doneCnt);
        return;
      }
      renderExamWorkspace();
    },

    toggleFlag(qid) {
      if (!state.session || state.session.mode !== 'exam') return;
      state.session.flagged[qid] = !state.session.flagged[qid];
      state.session.activeQid = qid;
      persistDraft();
      renderExamWorkspace();
    },

    toggleStrike(strikeKey, ev) {
      if (ev) ev.stopPropagation();
      if (!state.session || state.session.mode !== 'exam') return;
      state.session.struck[strikeKey] = !state.session.struck[strikeKey];
      renderExamWorkspace();
    },

    /* ---------- MATCHING HEADINGS DRAG & DROP + TAP ---------- */
    onDragStartHeading(ev, key) {
      ev.dataTransfer.setData('text/plain', key);
      state.selectedHeadingKey = key;
    },

    onDropHeading(ev, qid) {
      ev.preventDefault();
      ev.currentTarget.classList.remove('is-over');
      const key = ev.dataTransfer.getData('text/plain') || state.selectedHeadingKey;
      if (key) {
        state.selectedHeadingKey = null;
        this.setAnswer(qid, key);
      }
    },

    onSelectHeadingPill(key) {
      if (!state.session || state.session.mode !== 'exam') return;
      state.selectedHeadingKey = state.selectedHeadingKey === key ? null : key;
      renderExamWorkspace();
    },

    onClickDropZone(qid) {
      if (!state.session || state.session.mode !== 'exam') return;
      if (state.selectedHeadingKey) {
        const k = state.selectedHeadingKey;
        state.selectedHeadingKey = null;
        this.setAnswer(qid, k);
      }
    },

    clearHeading(qid) {
      if (!state.session || state.session.mode !== 'exam') return;
      delete state.session.answers[qid];
      persistDraft();
      renderExamWorkspace();
    },

    /* ---------- NOTES DRAWER ---------- */
    toggleNotesDrawer(forceVal) {
      if (!state.session) return;
      state.session.notesOpen = typeof forceVal === 'boolean' ? forceVal : !state.session.notesOpen;
      renderExamWorkspace();
    },

    addNoteFromSelection() {
      if (!state.session) return;
      if (state.session.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        this.hideHighlightToolbar();
        return;
      }
      const pending = state.pendingSelection;
      const sel = window.getSelection();
      const quote = ((pending && pending.text) || (sel ? sel.toString() : '')).trim().slice(0, 180);
      if (quote) {
        const pen = state.session.studyMode === 'practice' ? (state.session.activePenColor || 'yellow') : 'yellow';
        this.applyHighlight(pen);
      }
      this.hideHighlightToolbar();
      state.session.notesOpen = true;
      if (quote) {
        const lu = state.session.liveRoomId ? getCurrentLiveUser() : null;
        state.session.notes.unshift({
          id: 'n_' + Date.now().toString(36),
          quote,
          text: 'Ghi chú đoạn highlight',
          ...(lu ? { by: lu.name, byRole: lu.role } : {})
        });
        if (!_applyingLiveRemote && state.session.liveRoomId && window.LiveReadingRoom?.isActive()) {
          window.LiveReadingRoom.pushNotes(state.session.notes);
        }
      }
      persistDraft();
      renderExamWorkspace();
      document.getElementById('rp-note-input')?.focus();
    },

    addManualNote(ev) {
      if (ev) ev.preventDefault();
      if (!state.session) return;
      if (state.session.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        return;
      }
      const ta = document.getElementById('rp-note-input');
      const text = (ta?.value || '').trim();
      if (!text) return;
      const lu = state.session.liveRoomId ? getCurrentLiveUser() : null;
      state.session.notes.unshift({
        id: 'n_' + Date.now().toString(36),
        quote: '',
        text,
        ...(lu ? { by: lu.name, byRole: lu.role } : {})
      });
      if (!_applyingLiveRemote && state.session.liveRoomId && window.LiveReadingRoom?.isActive()) {
        window.LiveReadingRoom.pushNotes(state.session.notes);
      }
      persistDraft();
      renderExamWorkspace();
    },

    deleteNote(noteId) {
      if (!state.session) return;
      if (state.session.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        return;
      }
      state.session.notes = (state.session.notes || []).filter((n) => n.id !== noteId);
      if (!_applyingLiveRemote && state.session.liveRoomId && window.LiveReadingRoom?.isActive()) {
        window.LiveReadingRoom.pushNotes(state.session.notes);
      }
      persistDraft();
      renderExamWorkspace();
    },

    /* ---------- PRE-SUBMIT & REVIEW ---------- */
    openPreSubmitModal() {
      if (!state.session) return;
      const allQ = getAllSessionQuestions();
      const answered = allQ.filter((q) => String(state.session.answers[q._qid] || '').trim()).length;
      const unanswered = allQ.length - answered;
      const flaggedCnt = allQ.filter((q) => state.session.flagged[q._qid]).length;
      const modal = document.getElementById('rp-presubmit-modal');
      const body = document.getElementById('rp-presubmit-body');
      if (!modal || !body) return;
      modal.querySelector('.rp-presubmit-card')?.classList.remove('is-result-view');
      const titleEl = document.getElementById('rp-presubmit-title');
      if (titleEl) titleEl.textContent = 'Xác nhận nộp bài';

      body.innerHTML = `
        <div class="rp-ps-stats">
          <div class="rp-ps-box"><span>Đã làm</span><strong class="tabular">${answered} / ${allQ.length}</strong></div>
          <div class="rp-ps-box ${unanswered > 0 ? 'warn' : ''}"><span>Chưa làm</span><strong class="tabular">${unanswered}</strong></div>
          <div class="rp-ps-box"><span>Đánh dấu</span><strong class="tabular">${flaggedCnt}</strong></div>
        </div>
        <div class="rp-ps-grid">
          ${allQ.map((q) => {
            const has = !!String(state.session.answers[q._qid] || '').trim();
            const flg = !!state.session.flagged[q._qid];
            return `<button type="button" class="rp-ps-cell ${has ? 'is-ans' : 'is-empty'} ${flg ? 'is-flg' : ''}"
              onclick="ReadingPracticeApp.closePreSubmitModal(); ReadingPracticeApp.jumpToQuestion(${q._pIdx}, '${esc(q._qid)}')">${q.num}</button>`;
          }).join('')}
        </div>
        <div class="rp-ps-foot">
          <button type="button" class="btn-subtle" onclick="ReadingPracticeApp.closePreSubmitModal()">Quay lại bài</button>
          <button type="button" class="btn btn-primary" id="rp-btn-confirm-submit" onclick="ReadingPracticeApp.confirmSubmit()">Nộp bài &amp; Chấm điểm →</button>
        </div>
      `;
      modal.classList.add('open');
    },

    closePreSubmitModal(ev) {
      const modal = document.getElementById('rp-presubmit-modal');
      if (!modal) return;
      if (!ev || ev.target === modal) {
        modal.classList.remove('open');
        if (state.session?.endedEarly) {
          this.finishExitToHub();
        }
      }
    },

    confirmSubmit() {
      if (!state.session) return;
      const s = state.session;
      this.closePreSubmitModal();
      const allQ = getAllSessionQuestions();
      const res = computeReviewResult();
      s.attemptCount = (Number(s.attemptCount) || 0) + 1;

      if (!s.firstAttemptResult) {
        s.firstAttemptResult = {
          score: res.score,
          total: res.total,
          band: res.band,
          elapsedSec: res.elapsedSec
        };
      }

      // Build full graded answer sheet report for immediate post-submit Result Preview!
      const reportRows = allQ.map((q) => {
        const val = String(s.answers[q._qid] ?? '').trim();
        return {
          num: q.num,
          pIdx: q._pIdx,
          qid: q._qid,
          answer: val,
          ok: isAnswerCorrect(q, val)
        };
      });

      // News articles do not gate on 100%; IELTS Practice & Exam BOTH enforce 100% Mastery Gate!
      const mustAchieve100 = !s.isNews && res.score < res.total;
      s.lastSubmitReport = {
        attempt: s.attemptCount,
        score: res.score,
        total: res.total,
        band: res.band,
        elapsedSec: res.elapsedSec,
        isMastered: !mustAchieve100,
        rows: reportRows
      };

      if (mustAchieve100) {
        const nextLocked = { ...(s.lockedCorrect || {}) };
        const nextWrong = {};
        let firstWrong = null;
        allQ.forEach((q) => {
          const ok = isAnswerCorrect(q, s.answers[q._qid]);
          if (ok) {
            nextLocked[q._qid] = true;
          } else {
            nextWrong[q._qid] = true;
            if (!firstWrong) firstWrong = q;
          }
        });
        s.lockedCorrect = nextLocked;
        s.wrongSet = nextWrong;

        // Record first-attempt score in history with submitted answers so student can review their attempt
        if (s.attemptCount === 1) {
          ReadingPracticeStore.recordAttempt({
            itemId: s.itemId, title: s.title, source: s.source,
            isFull: s.isFull, studyMode: s.studyMode || 'practice',
            score: res.score, total: res.total,
            band: res.band, elapsedSec: res.elapsedSec,
            answers: { ...(s.answers || {}) },
            mastered: false, submittedAt: Date.now(), completedAt: Date.now()
          });
        }

        if (firstWrong) {
          s.activePassageIdx = firstWrong._pIdx;
          s.activeQid = firstWrong._qid;
        }
        persistDraft();
        renderExamWorkspace();
        this.openResultModal();
        return;
      }

      // 100% MASTERED -> Unlock Full Solution, Paraphrase Mapping & Click-to-Dictionary!
      stopTimer();
      stopReadingAntiCheat();
      s.mode = 'review';
      s.wrongSet = {};
      allQ.forEach((q) => { s.lockedCorrect[q._qid] = true; });
      s.reviewResult = res;

      const first = s.firstAttemptResult || res;
      ReadingPracticeStore.recordAttempt({
        itemId: s.itemId, title: s.title, source: s.source,
        isFull: s.isFull, studyMode: s.studyMode || 'practice',
        score: first.score, total: res.total,
        band: first.band, elapsedSec: res.elapsedSec,
        answers: { ...(s.answers || {}) },
        mastered: true, attempts: s.attemptCount, submittedAt: Date.now(), completedAt: Date.now()
      });

      renderExamWorkspace();
      this.openResultModal();
    },

    openResultModal() {
      if (!state.session) return;
      const s = state.session;
      const allQ = getAllSessionQuestions();
      const report = s.lastSubmitReport || (() => {
        const res = s.reviewResult || computeReviewResult();
        return {
          attempt: Math.max(1, s.attemptCount || 1),
          score: res.score,
          total: res.total,
          band: res.band,
          elapsedSec: res.elapsedSec,
          isMastered: res.total > 0 && res.score === res.total,
          rows: allQ.map((q) => {
            const val = String(s.answers[q._qid] ?? '').trim();
            return { num: q.num, pIdx: q._pIdx, qid: q._qid, answer: val, ok: isAnswerCorrect(q, val) };
          })
        };
      })();

      const modal = document.getElementById('rp-presubmit-modal');
      const body = document.getElementById('rp-presubmit-body');
      if (!modal || !body) return;
      modal.querySelector('.rp-presubmit-card')?.classList.add('is-result-view');

      const titleEl = document.getElementById('rp-presubmit-title');
      const pct = report.total > 0 ? Math.round((report.score / report.total) * 100) : 0;
      const wrongCnt = Math.max(0, report.total - report.score);
      const isEndedEarly = !!report.endedEarly && !report.isMastered;
      const isTeacher = isTeacherBypass();
      const canPreviewSolutions = !!report.isMastered || isTeacher;
      if (titleEl) {
        const metaTxt = isEndedEarly
          ? `Đã kết thúc · ${formatDuration(report.elapsedSec)}`
          : `Lần nộp #${report.attempt} · ${formatDuration(report.elapsedSec)}`;
        titleEl.innerHTML = `${report.isMastered ? 'Hoàn thành 100%' : 'Kết quả chấm điểm'}<span class="rp-res-head-meta tabular">${metaTxt}</span>`;
      }

      const rowsHtml = (report.rows || []).map((r) => {
        const displayAns = r.answer ? esc(r.answer) : 'Chưa làm';
        const rowClick = (isEndedEarly || (isTeacher && !report.isMastered))
          ? (canPreviewSolutions ? `ReadingPracticeApp.openReviewFromResult(); ReadingPracticeApp.jumpToQuestion(${r.pIdx}, '${esc(r.qid)}')` : '')
          : `ReadingPracticeApp.jumpFromResult(${r.pIdx}, '${esc(r.qid)}')`;
        return `
          <button type="button" class="rp-res-row ${r.ok ? 'is-ok' : 'is-bad'}"
            ${rowClick ? `onclick="${rowClick}"` : 'disabled style="cursor:default;"'}
            title="${r.ok ? `Câu ${r.num}: Đúng` : `Câu ${r.num}: Sai`}">
            <span class="rp-res-qnum tabular">${r.num}</span>
            <span class="rp-res-ans ${r.answer ? '' : 'is-blank'}">${displayAns}</span>
            <span class="rp-res-mark ${r.ok ? 'is-ok' : 'is-bad'}" aria-label="${r.ok ? 'Đúng' : 'Sai'}">${r.ok ? '✓' : '✕'}</span>
          </button>
        `;
      }).join('');

      const rowCount = (report.rows || []).length;
      const gridColsCls = rowCount > 20 ? 'is-cols-5' : (rowCount >= 9 ? 'is-cols-4' : 'is-cols-3');

      const noteHtml = report.isMastered
        ? `<div class="rp-res-note">Xuất sắc! Bạn đã hoàn thành đúng <strong>100%</strong>. Bấm <strong>Xem giải &amp; Locate</strong> để xem đáp án chi tiết, dịch song ngữ và tra từ.</div>`
        : (isTeacher
          ? `<div class="rp-res-note">Tài khoản Giáo viên có toàn quyền bấm <strong>Xem giải &amp; Locate</strong> ngay để kiểm tra đáp án, lời giải và dẫn chứng mà không cần làm hết.</div>`
          : (isEndedEarly
            ? `<div class="rp-res-note">Lượt làm đã kết thúc và lưu kết quả. Bạn cần hoàn thành đúng <strong>100%</strong> để mở khóa <strong>Xem giải &amp; Locate</strong>.</div>`
            : `<div class="rp-res-note">Các câu đúng (<strong>✓</strong>) đã được giữ lại. Bấm trực tiếp vào câu sai (<strong>✕</strong>) hoặc nút <strong>Làm lại câu sai</strong> để sửa rồi bấm <strong>Nộp lại</strong> (đúng 100% để mở Xem giải &amp; Locate).</div>`));

      const footHtml = report.isMastered
        ? `
          <div class="rp-res-foot">
            <button type="button" class="btn-subtle" onclick="ReadingPracticeApp.finishExitToHub()">← Về kho đề</button>
            <button type="button" class="btn btn-primary" id="rp-res-primary-btn" onclick="ReadingPracticeApp.closePreSubmitModal()">Xem giải &amp; Locate →</button>
          </div>
        `
        : (isEndedEarly
          ? `
            <div class="rp-res-foot">
              <button type="button" class="btn-subtle" onclick="ReadingPracticeApp.retryCurrent()">Làm lại bài</button>
              ${isTeacher ? `<button type="button" class="btn btn-primary" id="rp-res-teacher-rev-btn" onclick="ReadingPracticeApp.openReviewFromResult()">Xem giải &amp; Locate →</button>` : ''}
              <button type="button" class="${isTeacher ? 'btn-subtle' : 'btn btn-primary'}" id="rp-res-primary-btn" onclick="ReadingPracticeApp.finishExitToHub()">← Về kho đề</button>
            </div>
          `
          : `
            <div class="rp-res-foot">
              <button type="button" class="btn-subtle" onclick="ReadingPracticeApp.closePreSubmitModal()">Đóng</button>
              ${isTeacher ? `<button type="button" class="btn-subtle" id="rp-res-teacher-rev-btn" onclick="ReadingPracticeApp.openReviewFromResult()">Xem giải &amp; Locate</button>` : ''}
              <button type="button" class="btn btn-primary" id="rp-res-primary-btn" onclick="ReadingPracticeApp.focusFirstWrongFromResult()">Làm lại câu sai →</button>
            </div>
          `);

      body.innerHTML = `
        <div class="rp-res-kpis">
          <div class="rp-res-kpi is-score">
            <span class="rp-res-kpi-lbl">Số câu đúng</span>
            <strong class="rp-res-kpi-val tabular">${report.score} / ${report.total}</strong>
            <span class="rp-res-kpi-sub tabular">${pct}% chính xác · ${wrongCnt} câu sai</span>
          </div>
          <div class="rp-res-kpi is-band">
            <span class="rp-res-kpi-lbl">Điểm quy đổi</span>
            <strong class="rp-res-kpi-val tabular">${Number(report.band || 0).toFixed(1)}</strong>
            <span class="rp-res-kpi-sub">Band IELTS Reading</span>
          </div>
          <div class="rp-res-kpi">
            <span class="rp-res-kpi-lbl">Trạng thái</span>
            <strong class="rp-res-kpi-val tabular" style="font-size:18px;padding-top:4px;color:${report.isMastered ? '#15803d' : '#b91c1c'};">${report.isMastered ? '✓ Đạt 100%' : `Còn ${wrongCnt} câu`}</strong>
            <span class="rp-res-kpi-sub">${report.isMastered ? 'Đã mở Solution' : 'Đúng 100% mới mở giải'}</span>
          </div>
        </div>

        <div class="rp-res-sheet">
          <div class="rp-res-sheet-head">
            <span class="rp-res-sheet-title">Table Answer</span>
            <span class="rp-res-legend">
              <span class="rp-res-leg-ok">✓ Đúng (${report.score})</span>
              <span class="rp-res-leg-bad">✕ Sai (${wrongCnt})</span>
            </span>
          </div>
          <div class="rp-res-grid ${gridColsCls}" id="rp-res-answer-grid">
            ${rowsHtml}
          </div>
        </div>

        ${noteHtml}
        ${footHtml}
      `;
      modal.classList.add('open');
    },

    jumpFromResult(pIdx, qid) {
      this.closePreSubmitModal();
      this.jumpToQuestion(pIdx, qid);
    },

    focusFirstWrongFromResult() {
      this.closePreSubmitModal();
      if (!state.session) return;
      const allQ = getAllSessionQuestions();
      const firstWrong = allQ.find((q) => !!state.session.wrongSet?.[q._qid]);
      if (firstWrong) {
        this.jumpToQuestion(firstWrong._pIdx, firstWrong._qid);
      }
    },

    jumpToNextWrong() {
      if (!state.session) return;
      const allQ = getAllSessionQuestions();
      const wrongList = allQ.filter((q) => !!state.session.wrongSet?.[q._qid]);
      if (!wrongList.length) return;
      const curIdx = wrongList.findIndex((q) => q._qid === state.session.activeQid);
      const target = wrongList[(curIdx + 1) % wrongList.length];
      if (target) this.jumpToQuestion(target._pIdx, target._qid);
    },

    dismissAntiCheatNotice() {
      if (!state.session) return;
      state.session.antiCheatNotice = '';
      renderExamWorkspace();
    },

    retryCurrent() {
      if (!state.session) return;
      const opts = { studyMode: state.session.studyMode || 'exam' };
      if (state.session.isFull) this.startFullTest(state.session.itemId, opts);
      else this.startPassage(state.session.itemId, opts);
    },

    toggleBilingual() {
      if (!state.session) return;
      state.session.showBilingual = !state.session.showBilingual;
      if (state.session.showBilingual) state.mobilePane = 'questions';
      renderExamWorkspace();
    },

    setHighlightPalette(paletteId) {
      const pal = PASTEL_PALETTES.find((p) => p.id === paletteId);
      if (!pal) return;
      state.highlightPalette = pal.id;
      try { localStorage.setItem(PALETTE_STORAGE_KEY, pal.id); } catch (_) {}
      renderExamWorkspace();
      toast(`Đã đổi bảng màu Highlight: ${pal.name}`);
    },

    focusBilingualParagraph(paraIdx) {
      document.querySelectorAll('#rp-passage-pane .ins-para-block.is-bi-focus').forEach((el) => el.classList.remove('is-bi-focus'));
      const target = document.querySelector(`#rp-passage-pane .ins-para-block[data-para-idx="${paraIdx}"]`);
      if (target) {
        target.classList.add('is-bi-focus');
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    },

    onBilingualInput(passageId, paraIdx, taEl) {
      const val = String(taEl?.value || '');
      saveBilingualDraft(passageId, paraIdx, val);
      const wc = val.trim() ? val.trim().split(/\s+/).length : 0;
      const wcEl = document.getElementById(`rp-bi-wc-${paraIdx}`);
      if (wcEl) wcEl.textContent = wc > 0 ? `${wc} từ` : 'Chưa dịch';
      taEl?.closest('.rp-bi-card')?.classList.toggle('is-filled', wc > 0);
      // Update summary counter cleanly without re-rendering textarea focus
      const allTas = Array.from(document.querySelectorAll('#rp-bilingual-studio .rp-bi-textarea'));
      let done = 0;
      let words = 0;
      allTas.forEach((t) => {
        const w = t.value.trim() ? t.value.trim().split(/\s+/).length : 0;
        if (w > 0) done += 1;
        words += w;
      });
      const sumEl = document.getElementById('rp-bi-summary');
      if (sumEl) sumEl.innerHTML = `Đã dịch <strong>${done}/${allTas.length}</strong> đoạn · ${words} từ (tự lưu trên máy)`;
    },

    clearPassageBilingual(passageId) {
      clearBilingualDrafts(passageId);
      renderExamWorkspace();
      toast('Đã xóa toàn bộ bản dịch nháp của bài đọc này.');
    },

    locateEvidence(evId) {
      if (!state.session) return;
      state.session.activeEvidenceLoc = null;
      state.session.activeEvidenceId = evId;
      state.mobilePane = 'passage';
      renderExamWorkspace();
      setTimeout(() => {
        document.querySelector(`.rp-ev-span[data-ev-id="${evId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 40);
      if (!_applyingLiveRemote && state.session.liveRoomId && window.LiveReadingRoom?.isActive() && window.LiveReadingRoom.canLocalUserEdit()) {
        window.LiveReadingRoom.pushFocus({ kind: 'ev', evId });
      }
    },

    locateWebEvidence(passageId, paraIdx, start, end, qnum) {
      if (!state.session) return;
      const pIdx = (state.session.passageIds || []).indexOf(passageId);
      if (pIdx >= 0) state.session.activePassageIdx = pIdx;
      state.session.activeEvidenceId = null;
      state.session.activeEvidenceLoc = { passageId, p: Number(paraIdx) || 0, s: Number(start) || 0, e: Number(end) || 0, qnum: Number(qnum) || 0 };
      state.mobilePane = 'passage';
      renderExamWorkspace();
      setTimeout(() => {
        document.querySelector('.rp-ev-span[data-ev-loc="active"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 45);
      if (!_applyingLiveRemote && state.session.liveRoomId && window.LiveReadingRoom?.isActive() && window.LiveReadingRoom.canLocalUserEdit()) {
        window.LiveReadingRoom.pushFocus({ kind: 'loc', passageId, p: Number(paraIdx) || 0, s: Number(start) || 0, e: Number(end) || 0, qnum: Number(qnum) || 0 });
      }
    },

    toggleQuestionExplanation(expKey) {
      if (!state.session) return;
      if (!state.session.openExplanations) state.session.openExplanations = {};
      state.session.openExplanations[expKey] = !state.session.openExplanations[expKey];
      renderExamWorkspace();
    },

    /* ---------- SELECTION & PASTEL HIGHLIGHT POPOVER (Suppresses Edge Mini Menu!) ---------- */
    _positionSelectionPopover(rect) {
      const bar = document.getElementById('rp-hl-toolbar');
      if (!bar || !rect) return;
      const isPrac = state.session?.studyMode === 'practice';
      const estW = isPrac ? 360 : 280;
      const left = Math.max(12, Math.min(window.innerWidth - estW - 12, rect.left + rect.width / 2 - estW / 2));
      const preferTop = rect.top - 52;
      const top = preferTop >= 62 ? preferTop : Math.max(62, rect.bottom + 8);
      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
      bar.classList.remove('hidden');
    },

    onQuestionsClickGuard(ev) {
      if (state.suppressQuestionClickUntil && Date.now() < state.suppressQuestionClickUntil) {
        if (ev.target && ev.target.closest && ev.target.closest('label, .ins-radio-row, .ins-check-row')) {
          ev.preventDefault();
          ev.stopPropagation();
        }
        return true;
      }
      return false;
    },

    handleQuestionsClick(ev) {
      if (this.onQuestionsClickGuard(ev)) return;
      const s = state.session;
      // STRICT RULE: Click-to-Dictionary on questions ONLY unlocked in Review (after 100% mastery) or News!
      if (!s || !(s.mode === 'review' || s.isNews)) return;
      if (state.pendingSelection) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

      // Ignore clicks on interactive controls & review action buttons
      if (ev.target?.closest?.('input, select, option, textarea, button, a, svg, .rp-rev-bar, .rp-rev-pill, .ins-bookmark-btn, .ins-strike-btn, .ins-sel-chip, .ins-note-qnum, .ins-q-num')) {
        return;
      }
      const qPane = document.getElementById('rp-questions-pane');
      const hit = getWordAtClientPoint(ev.clientX, ev.clientY, qPane);
      if (!hit) {
        this.closeDictPopover();
        return;
      }
      const ctx = extractSentenceForNode(hit.node, hit.word);
      showDictPopover(hit.word, ctx, hit.rect, 'questions');
    },

    onPassageMouseDown(ev) {
      if (ev.target && ev.target.closest && ev.target.closest('#rp-hl-toolbar')) return;
      state.pendingSelection = null;
      clearSelectionPreview();
      this.hideHighlightToolbar();
    },

    handlePassageSelection(ev) {
      const s = state.session;
      const sel = window.getSelection();
      const bar = document.getElementById('rp-hl-toolbar');
      if (!s || !bar) return;
      // Never hijack text selection inside editable inputs/selects
      if (ev?.target && ev.target.closest && ev.target.closest('input, textarea, select')) {
        return;
      }
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        if (!state.pendingSelection) bar.classList.add('hidden');
        return;
      }
      const range = sel.getRangeAt(0);
      const pPane = document.getElementById('rp-passage-content');
      const qPane = document.getElementById('rp-questions-pane');
      const inPassage = Boolean(pPane && pPane.contains(range.commonAncestorContainer));
      const inQuestions = Boolean(qPane && qPane.contains(range.commonAncestorContainer));
      if (!inPassage && !inQuestions) {
        state.pendingSelection = null;
        clearSelectionPreview();
        bar.classList.add('hidden');
        return;
      }

      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      if (!curPassage) return;

      const text = sel.toString().trim();
      const rect = range.getBoundingClientRect();
      const slices = getSelectionParaOffsets(range);
      const parentEl = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      const context = extractSentenceForNode(parentEl, text);

      if (!slices.length) {
        bar.classList.add('hidden');
        return;
      }

      if (inQuestions) {
        state.suppressQuestionClickUntil = Date.now() + 280;
      }

      // Cache selection & IMMEDIATELY collapse native browser selection so Microsoft Edge's Mini Menu NEVER pops up!
      state.pendingSelection = { passageId: curPassage.id, slices, text, rect, context, pane: inQuestions ? 'questions' : 'passage' };
      try { sel.removeAllRanges(); } catch (_) {}
      renderSelectionPreview(slices);
      this._positionSelectionPopover(rect);
    },

    handlePassageContextMenu(ev) {
      // Block browser right-click menu ("Search with Bing / Translate / Copilot") during active sessions!
      if (isReadingAntiCheatActive()) {
        ev.preventDefault();
        if (state.pendingSelection?.rect) {
          this._positionSelectionPopover(state.pendingSelection.rect);
        }
        return;
      }
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        ev.preventDefault();
        this.handlePassageSelection();
      }
    },

    hideHighlightToolbar() {
      document.getElementById('rp-hl-toolbar')?.classList.add('hidden');
      state.pendingSelection = null;
      clearSelectionPreview();
    },

    applyHighlight(color) {
      const s = state.session;
      if (!s) return;
      if (s.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        this.hideHighlightToolbar();
        return;
      }
      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      if (!curPassage) return;

      let slices = (state.pendingSelection && state.pendingSelection.passageId === curPassage.id)
        ? state.pendingSelection.slices
        : [];
      if (!slices.length) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) slices = getSelectionParaOffsets(sel.getRangeAt(0));
      }
      if (!slices.length) {
        toast('Hãy bôi đen trực tiếp trên đoạn văn hoặc câu hỏi để highlight.');
        this.hideHighlightToolbar();
        return;
      }

      const penColor = color || (s.studyMode === 'practice' ? s.activePenColor : 'yellow') || 'yellow';
      if (s.studyMode === 'practice' && PASTEL_PENS.some((p) => p.id === penColor)) {
        s.activePenColor = penColor;
        document.querySelectorAll('#rp-hl-toolbar .prac-pop-dot').forEach((dot) => {
          dot.classList.toggle('is-active', dot.dataset.popColor === penColor);
        });
      }

      clearSelectionPreview();
      slices.forEach((sl) => mergeOrAddHighlight(curPassage.id, sl.paraIdx, sl.start, sl.end, penColor));
      applyStoredHighlightsToPassage(curPassage.id);
      updatePracticeHighlightBadge(curPassage.id);
      persistDraft();
      if (!_applyingLiveRemote && s.liveRoomId && window.LiveReadingRoom?.isActive()) {
        window.LiveReadingRoom.pushHighlights(curPassage.id, getPassageHighlights(curPassage.id));
      }
      window.getSelection()?.removeAllRanges();
      this.hideHighlightToolbar();
    },

    clearSelectionHighlight() {
      const s = state.session;
      if (!s) return;
      if (s.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        this.hideHighlightToolbar();
        return;
      }
      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      if (!curPassage) return;
      let slices = (state.pendingSelection && state.pendingSelection.passageId === curPassage.id)
        ? state.pendingSelection.slices
        : [];
      if (!slices.length) {
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) slices = getSelectionParaOffsets(sel.getRangeAt(0));
      }
      clearSelectionPreview();
      if (slices.length) {
        slices.forEach((sl) => removeHighlightRange(curPassage.id, sl.paraIdx, sl.start, sl.end));
      } else {
        s.highlights[curPassage.id] = [];
      }
      applyStoredHighlightsToPassage(curPassage.id);
      updatePracticeHighlightBadge(curPassage.id);
      persistDraft();
      if (!_applyingLiveRemote && s.liveRoomId && window.LiveReadingRoom?.isActive()) {
        window.LiveReadingRoom.pushHighlights(curPassage.id, getPassageHighlights(curPassage.id));
      }
      window.getSelection()?.removeAllRanges();
      this.hideHighlightToolbar();
    },

    clearAllPassageHighlights() {
      const s = state.session;
      if (!s) return;
      if (s.liveRoomId && window.LiveReadingRoom?.isActive() && !window.LiveReadingRoom.canLocalUserEdit()) {
        toast('Phòng đang ở chế độ Chỉ xem Thầy chữa.');
        return;
      }
      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      if (!curPassage) return;
      if (s.highlights) s.highlights[curPassage.id] = [];
      clearSelectionPreview();
      applyStoredHighlightsToPassage(curPassage.id);
      updatePracticeHighlightBadge(curPassage.id);
      persistDraft();
      if (!_applyingLiveRemote && s.liveRoomId && window.LiveReadingRoom?.isActive()) {
        window.LiveReadingRoom.pushHighlights(curPassage.id, []);
      }
      this.hideHighlightToolbar();
      toast('Đã xóa toàn bộ highlight trong bài đọc hiện tại.');
    },

    lookupSelectedPhrase() {
      const s = state.session;
      // STRICT RULE: Dictionary strictly locked until 100% completion (Review) or News!
      if (!s || !(s.mode === 'review' || s.isNews)) {
        toast('Từ điển bị khóa trong lúc làm bài — hoàn thành 100% để mở khóa!');
        this.hideHighlightToolbar();
        return;
      }
      const pending = state.pendingSelection;
      const sel = window.getSelection();
      const text = ((pending && pending.text) || (sel ? sel.toString() : '')).trim();
      if (!text) return;
      const rect = pending?.rect || (sel && !sel.isCollapsed ? sel.getRangeAt(0).getBoundingClientRect() : null);
      const ctx = pending?.context || '';
      const pane = pending?.pane || 'passage';
      this.hideHighlightToolbar();
      showDictPopover(text, ctx, rect, pane);
    },

    handlePassageWordClick(ev) {
      const s = state.session;
      // STRICT RULE: Click-to-Dictionary ONLY unlocked in Review (after 100% mastery) or News!
      if (!s || !(s.mode === 'review' || s.isNews)) return;
      if (state.pendingSelection) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;
      const wordEl = ev.target.closest('.rp-word');
      if (!wordEl) { this.closeDictPopover(); return; }
      showDictPopover(wordEl.dataset.word || wordEl.textContent.trim(), extractSentenceForNode(wordEl), wordEl.getBoundingClientRect());
    },

    closeDictPopover() {
      document.getElementById('rp-dict-popover')?.classList.add('hidden');
      state.dictTarget = null;
    },

    toggleDictMeaningEdit() {
      if (!state.dictTarget) return;
      state.dictTarget.editMode = !state.dictTarget.editMode;
      const pop = document.getElementById('rp-dict-popover');
      renderDictPopoverBody(pop, state.dictTarget, false);
      positionDictPopover(pop, state.dictTarget.anchorRect);
      if (state.dictTarget.editMode) {
        const inp = document.getElementById('rp-dict-meaning-input');
        if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
      }
    },

    onDictMeaningEdit(val) {
      if (!state.dictTarget) return;
      state.dictTarget.userEdited = true;
      state.dictTarget.entry.vi = String(val || '');
    },

    lookupSynonymWord(synWord) {
      if (!state.dictTarget || !synWord) return;
      showDictPopover(synWord, state.dictTarget.context || '', state.dictTarget.anchorRect, state.dictTarget.sourcePane || 'passage');
    },

    speakDictWord(accent) {
      if (!state.dictTarget?.entry?.word) return;
      if (B()?.speakText) B().speakText(state.dictTarget.entry.word, accent || 'en-US');
      else if (window.AudioEngine?.speak) window.AudioEngine.speak(state.dictTarget.entry.word, { accent: accent || 'en-US' });
    },

    saveDictWordToMyVocab() {
      if (!state.dictTarget || !window.MyVocabStore) return;
      const inpVal = document.getElementById('rp-dict-meaning-input')?.value;
      const meaning = (inpVal !== undefined ? inpVal : state.dictTarget.entry.vi || '').trim() || '(Tự ghi chú nghĩa sau)';
      const deckName = document.getElementById('rp-dict-deck-select')?.value || state.dictTarget.deckName || 'Từ của tôi';
      const entry = state.dictTarget.entry;
      const res = window.MyVocabStore.addWordToNamedDeck(deckName, {
        lemma: entry.word, pos: entry.pos || 'Từ vựng', ipa: entry.ipa || '',
        clean_meaning: meaning, reading_context: trimContextCleanly(state.dictTarget.context || '', entry.word, 220),
        synonyms: entry.synonyms || [], source: state.session?.title || 'Reading Practice'
      });
      this.closeDictPopover();
      renderExamWorkspace();
      toast(res?.ok ? `Đã lưu "${entry.word}" vào "${deckName}" (Từ của tôi)!` : `"${entry.word}" đã có trong "${deckName}".`);
    },

    ensureSourceBankLoaded(src) {
      return ensureSourceBankLoaded(src);
    },

    isLocked() {
      return Boolean(ReadingPracticeStore.getLockoutInfo());
    },

    async openAssignedItem(itemId, isFull, mode = 'practice') {
      const cleanId = String(itemId || '').trim();
      if (!cleanId) return;
      const src = /^vol/i.test(cleanId) ? 'volume' : (/^act/i.test(cleanId) ? 'actual' : 'cambridge');
      window.TotoroUI?.enterSkillMode?.('Reading', 'practice');
      await ensureSourceBankLoaded(src);
      const useMode = mode === 'exam' ? 'exam' : 'practice';
      if (isFull) {
        if ((DATA().FULL_TESTS || []).some((x) => x.id === cleanId)) {
          this.startFullTest(cleanId, { studyMode: useMode });
        } else {
          toast('Không tìm thấy đề Full Test này trong kho dữ liệu.');
        }
      } else {
        if ((DATA().PASSAGES || {})[cleanId]) {
          this.startPassage(cleanId, { studyMode: useMode });
        } else {
          toast('Không tìm thấy Passage này trong kho dữ liệu.');
        }
      }
    },

    /* ---------- LIVE COLLABORATIVE ROOM (GOOGLE DOCS STYLE) ---------- */
    async openLiveRoom(roomId, passageId, isFull = false, dbUrl = '') {
      const cleanId = String(passageId || '').trim();
      if (!cleanId || !window.LiveReadingRoom) return;
      const src = /^vol/i.test(cleanId) ? 'volume' : (/^act/i.test(cleanId) ? 'actual' : 'cambridge');
      window.TotoroUI?.enterSkillMode?.('Reading', 'practice');
      await ensureSourceBankLoaded(src);
      if (isFull) {
        if ((DATA().FULL_TESTS || []).some((x) => x.id === cleanId)) {
          this.startFullTest(cleanId, { studyMode: 'practice' });
        } else {
          toast('Không tìm thấy đề Full Test cho phòng làm chung.');
          return;
        }
      } else {
        if ((DATA().PASSAGES || {})[cleanId]) {
          this.startPassage(cleanId, { studyMode: 'practice' });
        } else {
          toast('Không tìm thấy bài đọc cho phòng làm chung.');
          return;
        }
      }
      connectCurrentSessionToLiveRoom(roomId, isTeacherBypass(), dbUrl);
      toast(`Đã tham gia phòng làm chung #${roomId}!`);
    },

    openLiveShareModal() {
      const s = state.session;
      if (!s || !window.LiveReadingRoom) return;
      if (!s.liveRoomId) {
        const rid = window.LiveReadingRoom.generateRoomId();
        connectCurrentSessionToLiveRoom(rid, true, '');
      }
      const live = window.LiveReadingRoom.getActive();
      if (!live) return;

      let ov = document.getElementById('rp-live-modal');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'rp-live-modal';
        ov.className = 'rp-live-modal-ov';
        ov.onclick = (e) => { if (e.target === ov) ReadingPracticeApp.closeLiveShareModal(); };
        document.body.appendChild(ov);
      }
      const shareUrl = window.LiveReadingRoom.buildShareUrl();
      const meta = live.state?.meta || {};
      const isHost = !!live.isHost;
      const dbUrl = live.dbUrl || window.LiveReadingRoom.getConfiguredDbUrl();
      const members = window.LiveReadingRoom.getOnlineMembers();

      ov.innerHTML = `
        <div class="rp-live-modal-card" role="dialog" aria-modal="true" aria-label="Chia sẻ phòng làm chung Live">
          <div class="rp-live-modal-head">
            <div>
              <h3 class="rp-live-modal-title">Phòng làm chung (Live · Google Docs)</h3>
              <p class="rp-live-modal-sub">${esc(s.title)} · Mã phòng <strong>#${esc(live.roomId)}</strong> · ${members.length} người đang mở</p>
            </div>
            <button type="button" class="rp-live-modal-x" onclick="ReadingPracticeApp.closeLiveShareModal()" aria-label="Đóng">✕</button>
          </div>

          <div class="rp-live-modal-body">
            <div class="rp-live-sec">
              <label class="rp-live-lbl">Đường link chia sẻ cho học sinh (Zalo / Meet / Zoom)</label>
              <div class="rp-live-link-row">
                <input type="text" class="rp-live-link-inp" id="rp-live-share-url" readonly value="${esc(shareUrl)}" onclick="this.select()">
                <button type="button" class="btn btn-primary rp-live-copy-cta" onclick="ReadingPracticeApp.copyLiveShareLink()">📋 Sao chép link</button>
              </div>
              <div class="rp-live-hint">Ai bấm vào link này sẽ vào thẳng bài đọc này &amp; đồng bộ Highlight màu pastel, Ghi chú, Locate và Đáp án cùng nhau theo thời gian thực.</div>
            </div>

            ${isHost ? `
              <div class="rp-live-sec">
                <label class="rp-live-lbl">Quyền của học sinh trong phòng</label>
                <div class="rp-live-perm-grid">
                  <button type="button" class="rp-live-perm-card ${meta.permission !== 'watch' ? 'is-active' : ''}" onclick="ReadingPracticeApp.setLivePermission('collab')">
                    <strong>✏️ Cùng làm chung (Editor)</strong>
                    <span>Cả lớp cùng tô highlight, thêm ghi chú &amp; chọn đáp án giống Google Docs.</span>
                  </button>
                  <button type="button" class="rp-live-perm-card ${meta.permission === 'watch' ? 'is-active' : ''}" onclick="ReadingPracticeApp.setLivePermission('watch')">
                    <strong>👁 Chỉ xem Thầy chữa (Viewer)</strong>
                    <span>Chỉ Thầy tô màu, ghi chú &amp; điều khiển vị trí; học sinh theo dõi trực tiếp.</span>
                  </button>
                </div>
                <div class="rp-live-toggles">
                  <label class="rp-live-chk">
                    <input type="checkbox" ${meta.syncAnswers !== false ? 'checked' : ''} onchange="ReadingPracticeApp.toggleLiveSyncAnswers(this.checked)">
                    <span>Đồng bộ đáp án khi cả lớp làm chung</span>
                  </label>
                  <label class="rp-live-chk">
                    <input type="checkbox" ${meta.revealAnswers ? 'checked' : ''} onchange="ReadingPracticeApp.toggleLiveRevealAnswers(this.checked)">
                    <span>Hiện đáp án, giải thích &amp; Locate cho cả lớp ngay bây giờ</span>
                  </label>
                </div>
              </div>
            ` : ''}

            <div class="rp-live-sec rp-live-db-box ${dbUrl ? 'is-ready' : ''}">
              <div class="rp-live-db-head">
                <span class="rp-live-db-status">
                  ${dbUrl ? '🟢 Đã kết nối Firebase Realtime DB (< 0.3s đa thiết bị)' : '🟡 Chưa gắn Firebase Realtime DB (hiện chỉ đồng bộ giữa các tab cùng máy)'}
                </span>
              </div>
              ${isHost ? `
                <div class="rp-live-link-row" style="margin-top:8px;">
                  <input type="text" class="rp-live-link-inp" id="rp-live-db-input"
                    placeholder="https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app"
                    value="${esc(dbUrl)}">
                  <button type="button" class="btn-subtle rp-live-copy-cta" id="rp-live-db-save-btn" onclick="ReadingPracticeApp.saveAndTestLiveDbUrl()">Lưu &amp; Kiểm tra</button>
                </div>
                <div class="rp-live-db-msg" id="rp-live-db-msg">
                  ${dbUrl ? 'Link chia sẻ đã tự đính kèm địa chỉ Realtime — học sinh chỉ cần bấm link là chạy ngay, không cần cài gì thêm.' : 'Tạo miễn phí trong 1 phút: vào console.firebase.google.com → Build → Realtime Database → Create Database (Test mode) → copy URL dán vào đây.'}
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;
      ov.classList.add('open');
    },

    closeLiveShareModal() {
      document.getElementById('rp-live-modal')?.classList.remove('open');
    },

    copyLiveShareLink() {
      const inp = document.getElementById('rp-live-share-url');
      const url = inp ? inp.value : window.LiveReadingRoom?.buildShareUrl?.();
      if (!url) return;
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(url).then(() => toast('Đã sao chép link phòng làm chung — gửi ngay cho học sinh nhé!')).catch(() => {
          inp?.select();
          document.execCommand('copy');
          toast('Đã sao chép link phòng làm chung!');
        });
      } else {
        inp?.select();
        document.execCommand('copy');
        toast('Đã sao chép link phòng làm chung!');
      }
    },

    setLivePermission(perm) {
      if (!window.LiveReadingRoom?.isActive()) return;
      window.LiveReadingRoom.patchMeta({ permission: perm === 'watch' ? 'watch' : 'collab' });
      refreshLiveRoomBarInPlace();
      if (document.getElementById('rp-live-modal')?.classList.contains('open')) {
        this.openLiveShareModal();
      }
      toast(perm === 'watch' ? 'Đã chuyển sang: Chỉ xem Thầy chữa (Viewer).' : 'Đã chuyển sang: Cùng làm chung (Editor).');
    },

    toggleLiveSyncAnswers(forceVal) {
      const live = window.LiveReadingRoom?.getActive?.();
      if (!live) return;
      const next = typeof forceVal === 'boolean' ? forceVal : !(live.state?.meta?.syncAnswers !== false);
      window.LiveReadingRoom.patchMeta({ syncAnswers: next });
      refreshLiveRoomBarInPlace();
    },

    toggleLiveRevealAnswers(forceVal) {
      const live = window.LiveReadingRoom?.getActive?.();
      const s = state.session;
      if (!live || !s) return;
      const next = typeof forceVal === 'boolean' ? forceVal : !live.state?.meta?.revealAnswers;
      window.LiveReadingRoom.patchMeta({ revealAnswers: next });
      if (next && s.mode !== 'review') {
        s.mode = 'review';
        s.reviewResult = computeReviewResult();
        renderExamWorkspace();
      } else if (!next && s.mode === 'review') {
        s.mode = 'exam';
        renderExamWorkspace();
      } else {
        refreshLiveRoomBarInPlace();
      }
      if (document.getElementById('rp-live-modal')?.classList.contains('open')) {
        this.openLiveShareModal();
      }
      toast(next ? 'Đã bật Hiện đáp án & Locate cho cả lớp!' : 'Đã ẩn đáp án — cả lớp quay lại chế độ làm chung.');
    },

    broadcastLiveFocus() {
      const s = state.session;
      if (!s?.liveRoomId || !window.LiveReadingRoom?.isActive()) return;
      if (s.activeEvidenceLoc) {
        const loc = s.activeEvidenceLoc;
        window.LiveReadingRoom.pushFocus({ kind: 'loc', passageId: loc.passageId, p: loc.p, s: loc.s, e: loc.e, qnum: loc.qnum });
        toast(`Đã kéo cả lớp tới dẫn chứng Câu ${loc.qnum || ''}!`);
        return;
      }
      if (s.activeQid) {
        const q = getAllSessionQuestions().find((x) => x._qid === s.activeQid);
        window.LiveReadingRoom.pushFocus({
          kind: 'q',
          pIdx: q ? q._pIdx : s.activePassageIdx,
          qid: s.activeQid,
          label: q ? `Đang giảng Câu ${q.num}` : 'Đang giảng câu này'
        });
        toast(q ? `Đã kéo cả lớp tới Câu ${q.num}!` : 'Đã kéo cả lớp tới vị trí hiện tại!');
        return;
      }
      window.LiveReadingRoom.pushFocus({ kind: 'para', paraIdx: 0 });
      toast('Đã kéo cả lớp tới đầu bài đọc!');
    },

    cycleLiveHighlightFilter() {
      const s = state.session;
      if (!s?.liveRoomId) return;
      const order = ['all', 'teacher', 'none'];
      const idx = order.indexOf(s.liveHlFilter || 'all');
      s.liveHlFilter = order[(idx + 1) % order.length];
      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      if (curPassage) applyStoredHighlightsToPassage(curPassage.id);
      refreshLiveRoomBarInPlace();
    },

    async saveAndTestLiveDbUrl() {
      const inp = document.getElementById('rp-live-db-input');
      const msgEl = document.getElementById('rp-live-db-msg');
      const btn = document.getElementById('rp-live-db-save-btn');
      if (!inp || !window.LiveReadingRoom) return;
      if (btn) btn.disabled = true;
      if (msgEl) msgEl.textContent = 'Đang kiểm tra kết nối tới Firebase...';
      const res = await window.LiveReadingRoom.testFirebaseUrl(inp.value);
      if (btn) btn.disabled = false;
      if (res.ok) {
        window.LiveReadingRoom.reconnectWithDbUrl(res.url);
        if (msgEl) msgEl.innerHTML = `<strong style="color:#2E6F40;">✓ ${esc(res.msg)}</strong>`;
        const urlInp = document.getElementById('rp-live-share-url');
        if (urlInp) urlInp.value = window.LiveReadingRoom.buildShareUrl();
        refreshLiveRoomBarInPlace();
        toast(res.msg);
      } else if (msgEl) {
        msgEl.innerHTML = `<strong style="color:#b91c1c;">✕ ${esc(res.msg)}</strong>`;
      }
    },

    leaveLiveRoom() {
      const s = state.session;
      window.LiveReadingRoom?.leaveRoom?.(true);
      this.closeLiveShareModal();
      if (s) {
        s.liveRoomId = null;
        s.liveHlFilter = 'all';
        renderExamWorkspace();
      }
      toast('Đã rời phòng làm chung.');
    },

    startResize(ev) {
      ev.preventDefault();
      const body = document.getElementById('rp-split-body');
      const left = document.getElementById('rp-passage-shell') || document.getElementById('rp-passage-pane');
      if (!body || !left) return;
      const rect = body.getBoundingClientRect();
      const onMove = (e) => {
        const pct = Math.max(28, Math.min(72, ((e.clientX - rect.left) / rect.width) * 100));
        state.splitRatio = Math.round(pct * 10) / 10;
        left.style.flex = `0 0 ${state.splitRatio}%`;
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    }
  };

  window.ReadingPracticeStore = ReadingPracticeStore;
  window.ReadingPracticeApp = ReadingPracticeApp;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => ReadingPracticeApp.init());
  else ReadingPracticeApp.init();
})();
