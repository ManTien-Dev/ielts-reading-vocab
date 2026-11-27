/* =========================================================
   MODULE: IELTS Listening Practice PRO
   - 3x3 Studio Portal (3 Exam Banks + 3 Core Drills + 3 Reflex Labs)
   - Compact Wooden Totoro-Shaped Bookshelf inside Cambridge 1-20 & Volume 1-10
     (every book is sculpted as a unique Totoro hardcover book standing
     directly on the shelf, keeping Shelf + Book Desk + Test 1-4 visible together)
   - Reading-parity Recent Actual Tests view (Part 1-4 / FULL TEST + Search & Q-Type filter)
   - 100% Zero Clutter & Clean Import Hooks (window.__LISTENING_BANKS__)
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY_BASE = 'ielts_listening_practice_v1_';
  const BANK_VERSION = '20261125m';

  const _loadedBanks = {};
  const _bankPromises = {};
  let _examTimerId = null;

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function DATA() {
    return window.LISTENING_PRACTICE_DATA || {
      PORTAL_CARDS: [], CAMBRIDGE_BOOKS: [], VOLUME_BOOKS: [], BANK_SUMMARY: {}, PARTS: {}, FULL_TESTS: []
    };
  }
  function getRoot() { return document.getElementById('lp-app-root'); }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (s) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function getUid() {
    const uid = B()?.getScopedUid?.() || B()?.getCurrentUser?.()?.id || 'guest';
    return String(uid || 'guest').trim().toLowerCase();
  }

  function estimateListeningBand(correct, total) {
    if (!total || total <= 0) return 0;
    const s = Math.round((correct / total) * 40);
    if (s >= 39) return 9.0;
    if (s >= 37) return 8.5;
    if (s >= 35) return 8.0;
    if (s >= 32) return 7.5;
    if (s >= 30) return 7.0;
    if (s >= 26) return 6.5;
    if (s >= 23) return 6.0;
    if (s >= 18) return 5.5;
    if (s >= 16) return 5.0;
    if (s >= 13) return 4.5;
    if (s >= 10) return 4.0;
    if (s >= 6) return 3.5;
    return 3.0;
  }

  function formatMMSS(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  }

  /* ---------------------------------------------------------
     STATE & PROGRESS STORE
     --------------------------------------------------------- */
  const state = {
    view: 'portal',           // 'portal' | 'source' | 'exam' | 'review'
    source: 'cambridge',      // 'cambridge' | 'volume' | 'actual'
    camGroup: 'recent',       // 'recent' (Cam 10-20) | 'classic' (Cam 1-9)
    actualTab: 'p1',          // 'p1' | 'p2' | 'p3' | 'p4' | 'full'
    actualQType: '',          // '' | 'gap' | 'map' | 'mcq' | 'matching'
    actualFilterOpen: false,
    actualSearch: '',
    selectedBookId: 'lcam_20',
    selectedTestNum: 1,       // 1..4
    loadingBank: null,
    session: null,            // Active exam session
    lastReview: null          // Last submitted grading result
  };

  const ListeningPracticeStore = {
    _key() { return `${STORAGE_KEY_BASE}${getUid()}`; },
    load() {
      try {
        const raw = localStorage.getItem(this._key());
        const p = raw ? JSON.parse(raw) : null;
        if (p && typeof p === 'object') return { history: Array.isArray(p.history) ? p.history : [] };
      } catch (_) {}
      return { history: [] };
    },
    save(obj) {
      try { localStorage.setItem(this._key(), JSON.stringify(obj)); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent('listening-practice-updated')); } catch (_) {}
    },
    recordAttempt(entry) {
      const store = this.load();
      store.history.unshift({
        itemId: entry.itemId,
        isFull: !!entry.isFull,
        mode: entry.mode || 'practice',
        score: Number(entry.score || 0),
        total: Number(entry.total || 10),
        band: Number(entry.band || 0),
        elapsedSec: Number(entry.elapsedSec || 0),
        ts: Date.now()
      });
      if (store.history.length > 250) store.history.length = 250;
      this.save(store);
    },
    getItemProgress(itemObj) {
      if (!itemObj) return null;
      if (itemObj.taskId && window.ListeningTasksModule?.getProgressMap) {
        const prog = window.ListeningTasksModule.getProgressMap() || {};
        const r = prog[itemObj.taskId];
        if (r && (r.t3Total || r.completed)) {
          return {
            done: true,
            score: Number(r.t3Score || 0),
            total: Number(r.t3Total || itemObj.questionsCount || 10)
          };
        }
      }
      const hist = this.load().history.filter((h) => h.itemId === itemObj.id);
      if (hist.length) {
        const best = hist.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a), hist[0]);
        return { done: true, score: best.score || 0, total: best.total || itemObj.questionsCount || 10, band: best.band || 0 };
      }
      return null;
    },
    getPartProgress(partObj) {
      return this.getItemProgress(partObj);
    }
  };

  /* ---------------------------------------------------------
     LAZY BANK LOADER (1:1 Compatible with Reading's bank_*.js)
     --------------------------------------------------------- */
  function mergeBankPayload(src, payload) {
    if (!payload) return;
    const d = DATA();
    if (!d.PARTS) d.PARTS = {};
    if (!d.FULL_TESTS) d.FULL_TESTS = [];
    if (payload.PARTS) {
      Object.keys(payload.PARTS).forEach((pid) => {
        if (!d.PARTS[pid]) d.PARTS[pid] = payload.PARTS[pid];
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
    if (window.__LISTENING_BANKS__ && window.__LISTENING_BANKS__[src]) {
      mergeBankPayload(src, window.__LISTENING_BANKS__[src]);
      return Promise.resolve();
    }
    if (_bankPromises[src]) return _bankPromises[src];

    const bankUrls = window.__LISTENING_BANK_URLS__ || {
      cambridge: 'data/bank_listening_cambridge.js',
      volume: 'data/bank_listening_volume.js',
      actual: 'data/bank_listening_actual.js'
    };
    const rawUrl = bankUrls[src];
    if (!rawUrl) {
      _loadedBanks[src] = true;
      return Promise.resolve();
    }

    state.loadingBank = src;
    const base = (typeof window.__APP_BASE_PATH__ === 'string' && window.__APP_BASE_PATH__) ? `${window.__APP_BASE_PATH__}/` : '';
    const scriptSrc = `${base}${rawUrl}?v=${BANK_VERSION}`;
    _bankPromises[src] = new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = scriptSrc;
      sc.async = true;
      sc.onload = () => {
        if (window.__LISTENING_BANKS__ && window.__LISTENING_BANKS__[src]) {
          mergeBankPayload(src, window.__LISTENING_BANKS__[src]);
        }
        if (state.loadingBank === src) state.loadingBank = null;
        resolve();
      };
      sc.onerror = () => {
        _loadedBanks[src] = true;
        if (state.loadingBank === src) state.loadingBank = null;
        resolve();
      };
      document.head.appendChild(sc);
    });
    return _bankPromises[src];
  }

  /* ---------------------------------------------------------
     DATA HELPERS
     --------------------------------------------------------- */
  function getBooksForSource(src) {
    const d = DATA();
    if (src === 'cambridge') return d.CAMBRIDGE_BOOKS || [];
    if (src === 'volume') return d.VOLUME_BOOKS || [];
    return [];
  }

  function getPartsInBook(bookId) {
    return Object.values(DATA().PARTS || {}).filter((p) => p.bookId === bookId);
  }

  function getFullTestsInBook(bookId) {
    return (DATA().FULL_TESTS || []).filter((ft) => ft.bookId === bookId);
  }

  function getBookTestStatusMap(bookId) {
    const parts = getPartsInBook(bookId);
    const fulls = getFullTestsInBook(bookId);
    const map = {};
    for (let t = 1; t <= 4; t++) {
      const tParts = parts.filter((p) => (p.testNum || 1) === t);
      const tFull = fulls.find((f) => (f.testNum || 1) === t);
      const hasData = tParts.length > 0 || !!tFull;
      const done = hasData && tParts.length > 0 && tParts.every((p) => !!ListeningPracticeStore.getPartProgress(p));
      map[t] = { hasData, done, count: tParts.length };
    }
    return map;
  }

  function countReadyTestsInBook(bookId) {
    const map = getBookTestStatusMap(bookId);
    return [1, 2, 3, 4].filter((t) => map[t]?.hasData).length;
  }

  function renderDifficultyStars(count) {
    const n = Math.max(1, Math.min(5, Number(count) || 4));
    return `${'★'.repeat(n)}${'☆'.repeat(5 - n)}`;
  }

  function getSeriesShortLabel(book) {
    if (!book) return 'CAMBRIDGE';
    if (book.source === 'volume') return 'REAL VOL';
    return 'CAMBRIDGE';
  }

  function getBookNumText(book) {
    const n = Number(book?.num) || 1;
    return book?.source === 'volume' ? String(n).padStart(2, '0') : String(n);
  }

  /* =========================================================
     BESPOKE SVG ARTIST: TOTORO-SHAPED HARDCOVER BOOKS
     ========================================================= */
  function renderEyesSvg(mood) {
    if (mood === 'happy') {
      return `
        <path d="M62 75C64.5 69.5 72.5 69.5 75 75" stroke="#1E2421" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <path d="M105 75C107.5 69.5 115.5 69.5 118 75" stroke="#1E2421" stroke-width="2.6" stroke-linecap="round" fill="none"/>
      `;
    }
    if (mood === 'calm') {
      return `
        <circle cx="68.5" cy="73" r="7.4" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="111.5" cy="73" r="7.4" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="69.5" cy="73.5" r="3.4" fill="#1E2421"/>
        <circle cx="110.5" cy="73.5" r="3.4" fill="#1E2421"/>
        <circle cx="71" cy="71.6" r="1.2" fill="#FFFFFF"/>
        <circle cx="112" cy="71.6" r="1.2" fill="#FFFFFF"/>
        <path d="M61 69.5C64 67.8 73 67.8 76 69.5" stroke="#1E2421" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/>
        <path d="M104 69.5C107 67.8 116 67.8 119 69.5" stroke="#1E2421" stroke-width="1.4" stroke-linecap="round" opacity="0.65"/>
      `;
    }
    if (mood === 'curious') {
      return `
        <circle cx="68.5" cy="73" r="7.8" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="111.5" cy="73" r="7.8" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="70.8" cy="72" r="3.6" fill="#1E2421"/>
        <circle cx="113.8" cy="72" r="3.6" fill="#1E2421"/>
        <circle cx="72.2" cy="70.2" r="1.35" fill="#FFFFFF"/>
        <circle cx="115.2" cy="70.2" r="1.35" fill="#FFFFFF"/>
      `;
    }
    if (mood === 'starry') {
      return `
        <circle cx="68.5" cy="73" r="7.8" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="111.5" cy="73" r="7.8" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="69" cy="73" r="4" fill="#1E2421"/>
        <circle cx="111" cy="73" r="4" fill="#1E2421"/>
        <circle cx="70.6" cy="71" r="1.5" fill="#FFFFFF"/>
        <circle cx="112.6" cy="71" r="1.5" fill="#FFFFFF"/>
        <circle cx="67.2" cy="74.8" r="0.8" fill="#FFFFFF"/>
        <circle cx="109.2" cy="74.8" r="0.8" fill="#FFFFFF"/>
      `;
    }
    if (mood === 'gentle') {
      return `
        <ellipse cx="68.5" cy="73.5" rx="7.2" ry="6.2" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <ellipse cx="111.5" cy="73.5" rx="7.2" ry="6.2" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.3"/>
        <circle cx="69.2" cy="73.5" r="3.2" fill="#1E2421"/>
        <circle cx="110.8" cy="73.5" r="3.2" fill="#1E2421"/>
        <circle cx="70.4" cy="72" r="1.15" fill="#FFFFFF"/>
        <circle cx="112" cy="72" r="1.15" fill="#FFFFFF"/>
      `;
    }
    return `
      <circle cx="68.5" cy="73" r="7.8" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.35"/>
      <circle cx="111.5" cy="73" r="7.8" fill="#FFFDF8" stroke="#1E2421" stroke-width="1.35"/>
      <circle cx="69.2" cy="73" r="3.7" fill="#1E2421"/>
      <circle cx="110.8" cy="73" r="3.7" fill="#1E2421"/>
      <circle cx="70.8" cy="71.2" r="1.4" fill="#FFFFFF"/>
      <circle cx="112.4" cy="71.2" r="1.4" fill="#FFFFFF"/>
    `;
  }

  function renderPersonaAccessory(persona, pal) {
    const acc = pal.accent || '#E8BE65';
    switch (persona) {
      case 'headphones':
        return `
          <path d="M40 76C42 40 62 28 90 28C118 28 138 40 140 76" fill="none" stroke="#24302A" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M44 74C46 43 64 31.5 90 31.5C116 31.5 134 43 136 74" fill="none" stroke="${acc}" stroke-width="2" stroke-linecap="round"/>
          <rect x="27" y="65" width="14" height="26" rx="7" fill="#24302A" stroke="${acc}" stroke-width="1.8"/>
          <rect x="139" y="65" width="14" height="26" rx="7" fill="#24302A" stroke="${acc}" stroke-width="1.8"/>
          <path d="M18 72C15 76 15 80 18 84M13 68C9 75 9 81 13 88" stroke="${acc}" stroke-width="2" stroke-linecap="round" fill="none"/>
          <path d="M162 72C165 76 165 80 162 84M167 68C171 75 171 81 167 88" stroke="${acc}" stroke-width="2" stroke-linecap="round" fill="none"/>
        `;
      case 'umbrella':
        return `
          <g transform="translate(0,-3)">
            <path d="M92 10V17" stroke="#182C3D" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M36 39C46 18 67 13 92 13C117 13 138 18 148 39C135 34.5 123 35 113 38.5C101 34.5 84 34.5 72 38.5C61 35 49 34.5 36 39Z" fill="#1D4463" stroke="${acc}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M92 13C84 22 79 29 74 37M92 13C100 22 105 29 110 37" stroke="#A8D0EC" stroke-width="1.2" opacity="0.55" fill="none"/>
            <path d="M156 26C156 29 154 31 154 31C154 31 152 29 152 26C152 24.5 154 22 154 22C154 22 156 24.5 156 26Z" fill="#7FB8DF"/>
            <path d="M25 32C25 34.5 23.4 36 23.4 36C23.4 36 21.8 34.5 21.8 32C21.8 30.8 23.4 28.8 23.4 28.8C23.4 28.8 25 30.8 25 32Z" fill="#7FB8DF"/>
          </g>
        `;
      case 'acorn':
        return `
          <path d="M74 44C75 33 82 28 90 28C98 28 105 33 106 44Z" fill="#6F3E23" stroke="${acc}" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M90 28V22" stroke="#592E17" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M80 34L84 43M90 31V43M100 34L96 43" stroke="${acc}" stroke-width="1.1" opacity="0.65"/>
          <g transform="translate(148, 92) rotate(12)">
            <path d="M8 0V4" stroke="#592E17" stroke-width="2" stroke-linecap="round"/>
            <path d="M0 8C0 4 4 3 8 3C12 3 16 4 16 8H0Z" fill="#6F3E23" stroke="${acc}" stroke-width="1.2"/>
            <path d="M2 8C2 15 5 19 8 20.5C11 19 14 15 14 8Z" fill="#C98A4B" stroke="#592E17" stroke-width="1.2"/>
          </g>
        `;
      case 'moon':
        return `
          <path d="M150 28C144 28 139.5 23.5 139.5 17.5C139.5 14.2 141 11.2 143.5 9.5C137.5 10.5 133.5 15.5 133.5 21.5C133.5 28 138.8 33 145.2 33C149.2 33 152.8 31 154.8 27.8C153.3 28 151.7 28 150 28Z" fill="${acc}" stroke="#FFF7DC" stroke-width="1"/>
          <path d="M27 25L29 30L34 32L29 34L27 39L25 34L20 32L25 30Z" fill="${acc}"/>
          <path d="M90 22L91.5 25.5L95 27L91.5 28.5L90 32L88.5 28.5L85 27L88.5 25.5Z" fill="${acc}"/>
        `;
      case 'soot':
        return `
          <g transform="translate(15, 76)">
            <circle cx="14" cy="14" r="10.5" fill="#1E2326"/>
            <path d="M14 0V5M14 23V28M0 14H5M23 14H28M4 4L8 8M20 20L24 24M24 4L20 8M8 20L4 24" stroke="#1E2326" stroke-width="2.1" stroke-linecap="round"/>
            <circle cx="10.5" cy="13" r="3" fill="#FFF"/><circle cx="17.5" cy="13" r="3" fill="#FFF"/>
            <circle cx="11.2" cy="13" r="1.4" fill="#111"/><circle cx="18.2" cy="13" r="1.4" fill="#111"/>
          </g>
          <g transform="translate(141, 44) scale(0.82)">
            <circle cx="14" cy="14" r="10.5" fill="#1E2326"/>
            <path d="M14 0V5M14 23V28M0 14H5M23 14H28M4 4L8 8M20 20L24 24M24 4L20 8M8 20L4 24" stroke="#1E2326" stroke-width="2.1" stroke-linecap="round"/>
            <circle cx="10.5" cy="13" r="3" fill="#FFF"/><circle cx="17.5" cy="13" r="3" fill="#FFF"/>
            <circle cx="11.2" cy="13" r="1.4" fill="#111"/><circle cx="18.2" cy="13" r="1.4" fill="#111"/>
          </g>
        `;
      case 'ginkgo':
        return `
          <path d="M90 44V32" stroke="#6E4E1B" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M90 34C76 32 69 24 72 15C79 14 85 17 90 23C95 17 101 14 108 15C111 24 104 32 90 34Z" fill="${acc}" stroke="#6E4E1B" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M90 34L81 20M90 34L99 20" stroke="#6E4E1B" stroke-width="1.1" opacity="0.55"/>
        `;
      case 'lantern':
        return `
          <path d="M132 38C144 36 154 40 158 48" stroke="#5E4632" stroke-width="2.3" stroke-linecap="round" fill="none"/>
          <path d="M156 48V55" stroke="#5E4632" stroke-width="1.6"/>
          <ellipse cx="156" cy="70" rx="13" ry="15" fill="${acc}" opacity="0.22"/>
          <rect x="147" y="57" width="18" height="25" rx="8.5" fill="#F8D27A" stroke="#7A4C1E" stroke-width="1.6"/>
          <path d="M148 65H164M148 74H164" stroke="#B2742B" stroke-width="1.2" opacity="0.7"/>
          <rect x="151" y="54" width="10" height="3.5" rx="1.5" fill="#3B2E26"/>
          <rect x="151" y="81.5" width="10" height="3.5" rx="1.5" fill="#3B2E26"/>
          <path d="M156 85V93" stroke="#C65D45" stroke-width="2" stroke-linecap="round"/>
        `;
      case 'compass':
        return `
          <g transform="translate(141, 56)">
            <circle cx="15" cy="15" r="14" fill="#FAF2DF" stroke="${acc}" stroke-width="2.4"/>
            <circle cx="15" cy="15" r="10.5" fill="none" stroke="#6E4E34" stroke-width="1" stroke-dasharray="2 2"/>
            <path d="M15 5L18.2 15L15 25L11.8 15Z" fill="#B6424B"/>
            <path d="M15 15L18.2 15L15 25L11.8 15Z" fill="#3E4B59"/>
            <circle cx="15" cy="15" r="2.2" fill="${acc}"/>
          </g>
        `;
      case 'fern':
        return `
          <path d="M90 45C89 33 93 20 102 15C108 12 113 17 110 22C108 25 104 24 104 20" stroke="#78A85A" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <path d="M90 38L80 32M91 32L82 25M94 25L86 19M91 35L101 31M94 28L103 26" stroke="#78A85A" stroke-width="2" stroke-linecap="round"/>
          <circle cx="105" cy="21" r="2.5" fill="${acc}"/>
        `;
      case 'cassette':
        return `
          <g transform="translate(136, 56) rotate(8)">
            <rect x="0" y="0" width="34" height="22" rx="4" fill="#2F2622" stroke="${acc}" stroke-width="1.6"/>
            <rect x="4" y="4" width="26" height="10" rx="2" fill="#FAF2DF"/>
            <circle cx="11" cy="9" r="3" fill="#2F2622"/><circle cx="23" cy="9" r="3" fill="#2F2622"/>
            <circle cx="11" cy="9" r="1.1" fill="${acc}"/><circle cx="23" cy="9" r="1.1" fill="${acc}"/>
            <path d="M8 18H26" stroke="${acc}" stroke-width="1.5" stroke-linecap="round"/>
          </g>
        `;
      case 'wave':
        return `
          <path d="M16 58C22 50 30 50 35 56M145 56C151 49 160 49 166 56" stroke="#85B8E0" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M148 66C153 61 160 61 165 66" stroke="${acc}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
        `;
      case 'lotus':
        return `
          <path d="M90 45V30" stroke="#2D573E" stroke-width="2.8" stroke-linecap="round"/>
          <path d="M54 34C64 21 80 18 90 22C100 18 116 21 126 34C115 38 102 39 90 36C78 39 65 38 54 34Z" fill="#5D9A6B" stroke="#274E37" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M90 22V36M90 28L71 31M90 28L109 31" stroke="#A6D9AE" stroke-width="1.3" stroke-linecap="round"/>
        `;
      case 'telescope':
        return `
          <g transform="translate(137, 46) rotate(-28)">
            <rect x="0" y="6" width="24" height="7" rx="2" fill="${acc}" stroke="#4E3824" stroke-width="1.4"/>
            <rect x="20" y="4.5" width="11" height="10" rx="2" fill="#D49E48" stroke="#4E3824" stroke-width="1.4"/>
          </g>
          <path d="M22 30L30 22L40 27" stroke="${acc}" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/>
          <circle cx="22" cy="30" r="2.2" fill="${acc}"/><circle cx="30" cy="22" r="2.6" fill="${acc}"/><circle cx="40" cy="27" r="2" fill="${acc}"/>
        `;
      case 'ocarina':
        return `
          <g transform="translate(142, 48)">
            <path d="M6 22V6L20 2V18" stroke="${acc}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
            <ellipse cx="4" cy="22" rx="4" ry="3" fill="${acc}"/>
            <ellipse cx="18" cy="18" rx="4" ry="3" fill="${acc}"/>
          </g>
          <path d="M24 44V33L33 30V41" stroke="${acc}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
          <circle cx="22.5" cy="44" r="2.6" fill="${acc}"/><circle cx="31.5" cy="41" r="2.6" fill="${acc}"/>
        `;
      case 'gear':
        return `
          <g transform="translate(143, 52)">
            <circle cx="14" cy="14" r="8.5" fill="none" stroke="${acc}" stroke-width="3.2"/>
            <circle cx="14" cy="14" r="3.2" fill="${acc}"/>
            <path d="M14 2V6M14 22V26M2 14H6M22 14H26M5.5 5.5L8.3 8.3M19.7 19.7L22.5 22.5M22.5 5.5L19.7 8.3M8.3 19.7L5.5 22.5" stroke="${acc}" stroke-width="2.6" stroke-linecap="round"/>
          </g>
        `;
      case 'oak':
        return `
          <path d="M90 45V25" stroke="#4D6E38" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M90 30C78 28 73 21 76 15C83 15 88 20 90 27Z" fill="#77A654" stroke="#395729" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M90 28C102 26 107 19 104 13C97 13 92 18 90 25Z" fill="#8EBC68" stroke="#395729" stroke-width="1.4" stroke-linejoin="round"/>
        `;
      case 'crane':
        return `
          <g transform="translate(135, 36)">
            <path d="M2 18L16 14L31 6L21 20L27 29L14 22L5 26L11 18Z" fill="#FAF4E6" stroke="${acc}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M16 14L21 20" stroke="#8A7D66" stroke-width="1.1"/>
          </g>
        `;
      case 'mic':
        return `
          <g transform="translate(144, 48)">
            <rect x="6" y="4" width="12" height="20" rx="6" fill="#2A3138" stroke="${acc}" stroke-width="1.7"/>
            <path d="M8 10H16M8 14H16M8 18H16" stroke="${acc}" stroke-width="1.2" opacity="0.8"/>
            <path d="M3 16C3 22 7 27 12 27C17 27 21 22 21 16" fill="none" stroke="${acc}" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M12 27V34M7 34H17" stroke="${acc}" stroke-width="2" stroke-linecap="round"/>
          </g>
        `;
      case 'clover':
        return `
          <g transform="translate(134, 34)">
            <circle cx="10" cy="8" r="5" fill="#63A36C" stroke="#2D5A36" stroke-width="1.2"/>
            <circle cx="18" cy="8" r="5" fill="#77B87F" stroke="#2D5A36" stroke-width="1.2"/>
            <circle cx="10" cy="16" r="5" fill="#77B87F" stroke="#2D5A36" stroke-width="1.2"/>
            <circle cx="18" cy="16" r="5" fill="#63A36C" stroke="#2D5A36" stroke-width="1.2"/>
            <path d="M14 14C14 22 10 27 6 30" stroke="#2D5A36" stroke-width="2" stroke-linecap="round" fill="none"/>
          </g>
        `;
      case 'chibi':
      default:
        return `
          <g transform="translate(138, 128)">
            <path d="M11 16L8 5L15 12C17.5 11.2 21 11.2 23.5 12L30 5L27 16C31 20 33 26 32.5 34C32 42 26.5 46 19 46C11.5 46 6 42 5.5 34C5 26 7 20 11 16Z" fill="#FFFDF8" stroke="#6E6576" stroke-width="1.6" stroke-linejoin="round"/>
            <circle cx="14.5" cy="23" r="2" fill="#23222A"/><circle cx="23.5" cy="23" r="2" fill="#23222A"/>
            <ellipse cx="19" cy="26.5" rx="2" ry="1.2" fill="#6E6576"/>
          </g>
        `;
    }
  }

  const BOOK_ART_VERSION = '20261125e';

  function getBookImgUrl(bookId) {
    if (!bookId) return '';
    const base = (typeof window.__APP_BASE_PATH__ === 'string' && window.__APP_BASE_PATH__)
      ? `${window.__APP_BASE_PATH__}/`
      : '';
    return `${base}assets/images/listening_books/${encodeURIComponent(bookId)}.webp?v=${BOOK_ART_VERSION}`;
  }

  function renderTotoroBookArt(book, opts = {}) {
    const imgId = opts.imgId || book?.id || 'lcam_20';
    const url = getBookImgUrl(imgId);
    const alt = esc(opts.alt || book?.title || 'Totoro Book');
    return `<img class="lp-totoro-book-img" src="${esc(url)}" alt="${alt}" loading="lazy" decoding="async" draggable="false">`;
  }

  function renderTotoroBookSvg(book, opts = {}) {
    return renderTotoroBookArt(book, opts);
  }

  /* =========================================================
     PORTAL 3x2 FULL-BLEED EDITORIAL SERIES COVERS ("BÌA CỦA BỘ")
     Mirrors Reading's collector cover format using our painted Totoro books!
     ========================================================= */
  function renderPortalArt(card, rightBadge) {
    const cfgs = {
      cambridge: {
        bg: 'linear-gradient(135deg, #163626 0%, #214B36 52%, #132C1F 100%)',
        eyebrow: 'CAMBRIDGE PRESS',
        t1: 'Cambridge',
        t2: 'IELTS 1–20',
        sub: 'Listening Archive · 20 Books',
        books: ['lcam_17', 'lcam_18', 'lcam_19', 'lcam_20'],
        shelf: true
      },
      volume: {
        bg: 'linear-gradient(135deg, #13293F 0%, #1E4060 52%, #0F2235 100%)',
        eyebrow: 'COLLECTOR SERIES',
        t1: 'Volume',
        t2: '01 – 10',
        sub: 'Real Listening Test Box Set',
        books: ['lvol_2', 'lvol_5', 'lvol_7', 'lvol_1'],
        shelf: true
      },
      actual: {
        bg: 'linear-gradient(135deg, #3A1D19 0%, #572D25 52%, #2B1512 100%)',
        eyebrow: 'REAL EXAM BANK',
        t1: 'Recent',
        t2: 'Actual Tests',
        sub: 'Parts 1–4 · FULL TEST 30m',
        books: ['lcam_14', 'lcam_3', 'lactual_p14'],
        shelf: true
      },
      map: {
        bg: 'linear-gradient(135deg, #133638 0%, #1F5355 52%, #0E292B 100%)',
        eyebrow: 'PART 2 STUDIO',
        t1: 'Map & Plan',
        t2: 'Labelling',
        sub: 'Park · Town · Floor Plan',
        books: ['lvol_2', 'lcam_13'],
        shelf: true
      },
      note: {
        bg: 'linear-gradient(135deg, #3B2B15 0%, #59411F 52%, #2D200E 100%)',
        eyebrow: 'CAMBRIDGE FORM',
        t1: 'Note',
        t2: 'Completion',
        sub: 'Parts 1–4 · Authentic Notes',
        books: ['lcam_11', 'lcam_15'],
        shelf: true
      },
      tasks: {
        bg: 'linear-gradient(135deg, #21361C 0%, #34522B 52%, #182914 100%)',
        eyebrow: 'YOUTUBE · 4 CHẾ ĐỘ',
        t1: 'Dictation',
        t2: 'Studio',
        sub: 'Dictation · Shadowing · Quiz · Subtitles',
        books: ['lcam_1', 'lcam_16', 'lcam_12'],
        shelf: true
      }
    };
    const cfg = cfgs[card.scene] || cfgs.cambridge;
    const booksHtml = cfg.books.map((bid, idx) => {
      const isHero = idx === cfg.books.length - 1;
      return `<img class="lp-cover-book ${isHero ? 'is-hero' : 'is-back'}" style="--bi:${idx};--bn:${cfg.books.length};" src="${esc(getBookImgUrl(bid))}" alt="" loading="lazy" decoding="async" draggable="false">`;
    }).join('');

    return `
      <div class="lp-series-cover" style="background:${cfg.bg};">
        <div class="lp-series-frame" aria-hidden="true"></div>
        <div class="lp-series-badges">
          <span class="lp-cover-pill is-source">${esc(card.label)}</span>
          <span class="lp-cover-pill is-meta tabular">${esc(rightBadge)}</span>
        </div>
        <div class="lp-series-inner">
          <div class="lp-series-copy">
            <span class="lp-series-eyebrow">${esc(cfg.eyebrow)}</span>
            <div class="lp-series-h1">${esc(cfg.t1)}</div>
            <div class="lp-series-h2">${esc(cfg.t2)}</div>
            <div class="lp-series-sub">${esc(cfg.sub)}</div>
          </div>
          <div class="lp-series-stage">
            <div class="lp-series-books">${booksHtml}</div>
            ${cfg.shelf ? '<div class="lp-series-plank" aria-hidden="true"></div>' : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* =========================================================
     VIEW 1: 3x3 LISTENING PRACTICE PORTAL (9 CARDS)
     ========================================================= */
  function renderPortal() {
    const root = getRoot();
    if (!root) return;
    const d = DATA();
    const cards = d.PORTAL_CARDS || [];
    const tasks = window.APP_LISTENING_TASKS?.tasks || [];
    const mapTasks = tasks.filter((t) => t.isMapTask);
    const noteTasks = tasks.filter((t) => t.hasFullTests && !t.isMapTask);
    const firstMapId = mapTasks[0]?.id || 'lmap_01';
    const firstNoteId = noteTasks[0]?.id || 'lp1_01';

    const renderCard = (c) => {
      let badge = c.badge;
      let cardOnClick = '';
      let statText = '';
      let secondaryHtml = '';
      let primaryLabel = 'Mở kho đề →';
      let primaryAct = '';

      if (c.kind === 'source') {
        const sum = d.BANK_SUMMARY?.[c.id];
        if (c.id === 'cambridge') {
          const bks = getBooksForSource(c.id);
          const ready = bks.filter((b) => countReadyTestsInBook(b.id) > 0).length;
          badge = ready > 0 ? `${ready}/${bks.length} cuốn` : (sum ? `${sum.books} cuốn · ${sum.fullTests} Tests` : `${bks.length} cuốn`);
          statText = 'Part 1–4 · Full Test';
        } else if (c.id === 'volume') {
          const bks = getBooksForSource(c.id);
          const ready = bks.filter((b) => countReadyTestsInBook(b.id) > 0).length;
          badge = ready > 0 ? `${ready}/${bks.length} tập` : (sum ? `${sum.books} tập · ${sum.fullTests} Tests` : '10 tập · Real Listening');
          statText = 'Bẫy Paraphrase · Full Test';
        } else if (c.id === 'actual') {
          const actCount = Object.values(d.PARTS || {}).filter((p) => p.source === 'actual').length;
          badge = actCount > 0 ? `${actCount} bài nghe` : (sum ? `${sum.parts} bài nghe · ${sum.fullTests} Full` : 'Part 1–4 · FULL TEST');
          statText = '';
          secondaryHtml = `<button type="button" class="rp-portal-link" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('actual', 'full')">Full Test</button>`;
        }
        cardOnClick = `ListeningPracticeApp.openSource('${esc(c.id)}')`;
        primaryAct = c.id === 'actual'
          ? `ListeningPracticeApp.openSource('actual', 'p1')`
          : `ListeningPracticeApp.openSource('${esc(c.id)}')`;
      } else if (c.kind === 'map_drill') {
        badge = `★ ${mapTasks.length || 3} Maps`;
        cardOnClick = `ListeningTasksModule.openPracticePicker('map')`;
        secondaryHtml = `<button type="button" class="rp-portal-link" onclick="event.stopPropagation(); ListeningTasksModule.openExam('${esc(firstMapId)}', 3, { fromPractice: true })">Làm nhanh Map 01</button>`;
        primaryLabel = 'Chọn bài Map →';
        primaryAct = `ListeningTasksModule.openPracticePicker('map')`;
      } else if (c.kind === 'note_drill') {
        badge = `★ ${noteTasks.length || 8} Tests`;
        cardOnClick = `ListeningTasksModule.openPracticePicker('note')`;
        secondaryHtml = `<button type="button" class="rp-portal-link" onclick="event.stopPropagation(); ListeningTasksModule.openExam('${esc(firstNoteId)}', 3, { fromPractice: true })">Làm Part 1</button>`;
        primaryLabel = 'Chọn bài nghe →';
        primaryAct = `ListeningTasksModule.openPracticePicker('note')`;
      } else if (c.kind === 'dictation_studio') {
        badge = 'YouTube · 4 Chế độ';
        cardOnClick = `window.TotoroUI?.openDictationStudio?.()`;
        secondaryHtml = `<button type="button" class="rp-portal-link" onclick="event.stopPropagation(); window.TotoroUI?.openDictationStudio?.(); setTimeout(() => window.DictationStudio?.toggleImporter?.(true), 60)">+ Nhập YouTube / SRT</button>`;
        primaryLabel = 'Mở Studio →';
        primaryAct = `window.TotoroUI?.openDictationStudio?.()`;
      } else {
        badge = `${tasks.length || 139} Tasks`;
        cardOnClick = `window.TotoroUI?.switchView?.('task', { fromUser: true })`;
        secondaryHtml = `<button type="button" class="rp-portal-link" onclick="event.stopPropagation(); window.TotoroUI?.enterSkillMode?.('Listening', 'flashcard')">Flashcard</button>`;
        primaryLabel = 'Mở Tasks →';
        primaryAct = `window.TotoroUI?.switchView?.('task', { fromUser: true })`;
      }

      return `
        <article class="tot-exam-card lp-p3-card" data-lp-portal="${esc(c.id)}" onclick="${cardOnClick}" role="button" tabindex="0">
          ${renderPortalArt(c, badge)}
          <div class="lp-p3-body">
            <h3 class="lp-p3-title">${esc(c.bookTitle)}</h3>
            <p class="lp-p3-desc">${esc(c.desc)}</p>
            <div class="lp-p3-foot is-clean">
              ${secondaryHtml || `<span class="rp-portal-stat">${esc(statText)}</span>`}
              <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ${primaryAct}">${esc(primaryLabel)}</button>
            </div>
          </div>
        </article>
      `;
    };

    root.innerHTML = `
      <div class="tot-section-shell lp-portal-shell">
        <div class="tot-shell-head lp-shell-head">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            </span>
            <div>
              <h2 class="tot-shell-title">Kho đề Listening</h2>
              <p class="tot-shell-sub">Chọn bộ đề thi chuẩn phòng thi hoặc luyện bổ trợ Map Labelling, Note Completion &amp; Dictation Studio.</p>
            </div>
          </div>
        </div>

        <div class="lp-portal-3x3" id="lp-portal-grid">
          ${cards.map(renderCard).join('')}
        </div>
      </div>
    `;
  }

  function renderSourceSwitcherHtml(activeSrc) {
    const tabs = [
      { id: 'cambridge', label: 'Cambridge' },
      { id: 'volume', label: 'Volume' },
      { id: 'actual', label: 'Actual' }
    ];
    return `
      <div class="rp-src-switcher" role="tablist" aria-label="Chuyển nhanh kho đề Listening">
        ${tabs.map((t) => `
          <button type="button" role="tab" aria-selected="${activeSrc === t.id ? 'true' : 'false'}"
            class="rp-src-pill ${activeSrc === t.id ? 'active' : ''}"
            onclick="ListeningPracticeApp.openSource('${t.id}'${t.id === 'actual' ? ", 'p1'" : ''})">${t.label}</button>
        `).join('')}
      </div>
    `;
  }

  /* =========================================================
     VIEW 2 & 3: EXAM BANKS (WOODEN TOTORO BOOKSHELF / ACTUAL TABS)
     ========================================================= */
  const LP_COVER_TOPIC_RULES = [
    ['music_art', /\b(music|art|artist|paint|film|cinema|photo|theatre|theater|concert|pottery|museum|gallery|festival|dance|song|violin|piano)\b/i],
    ['ancient', /\b(ancient|roman|egypt|archaeolog|medieval|temple|heritage|history|historical|castle|palace|ruins|century|museum|archive)\b/i],
    ['agriculture', /\b(food|restaurant|cafe|coffee|tea|farm|farming|market|organic|cook|bakery|kitchen|garden|crop|honey|diet|nutrition)\b/i],
    ['wildlife', /\b(bird|animal|wildlife|zoo|park|whale|dolphin|bee|insect|fish|species|nature|reserve|habitat|dog|horse|sheep|penguin)\b/i],
    ['ocean', /\b(ocean|sea|river|coastal|island|boat|sail|sailing|ship|harbour|harbor|beach|lake|water|marine|diving|ferry|canal)\b/i],
    ['botany', /\b(plant|tree|forest|flower|botan|wood|garden|greenhouse|soil|leaf|environment|ecology|climate|conservation)\b/i],
    ['architecture', /\b(building|city|urban|street|road|bridge|library|hotel|house|housing|apartment|campus|station|airport|transport|bike|cycling|train)\b/i],
    ['space', /\b(space|planet|star|astron|observatory|weather|climate|geolog|volcan|solar|energy|wind|earthquake)\b/i],
    ['medicine', /\b(health|medic|hospital|clinic|sport|fitness|gym|swimming|sleep|stress|doctor|therapy|exercise|mental|wellbeing)\b/i],
    ['tech', /\b(tech|robot|computer|digital|internet|phone|engine|machine|factory|science|lab|experiment|data|online|software|media)\b/i],
    ['mind', /\b(school|university|college|student|course|study|class|lecture|seminar|research|language|education|teacher|training|library|career)\b/i],
    ['society', /\b(job|work|company|business|office|volunteer|community|club|tour|tourism|travel|holiday|excursion|event|charity|shop|bank)\b/i]
  ];

  function getListeningCardCover(item, isFull) {
    if (isFull) {
      const ft = 'assets/images/listening_covers/cover_listening_fulltest.webp?v=20261125h';
      return { primary: ft, fallback: ft };
    }
    let matched = 'society';
    const hay = `${item?.title || ''} ${item?.subtitle || ''}`;
    for (const [key, re] of LP_COVER_TOPIC_RULES) {
      if (re.test(hay)) { matched = key; break; }
    }
    const fallback = `assets/images/reading_covers/${matched}.webp`;
    const photoMap = window.LISTENING_PHOTO_MAP || {};
    const realPhoto = item?.id ? photoMap[item.id] : null;
    return { primary: realPhoto || fallback, fallback };
  }

  function renderPartCard(item, isFull) {
    const prog = ListeningPracticeStore.getItemProgress(item);
    const partLabel = isFull ? 'FULL TEST' : `PART ${item.partNum || 1}`;
    const types = Array.isArray(item.qTypes) ? item.qTypes : (isFull ? ['Part 1–4', 'Full 30 phút'] : ['Note Completion']);
    const qCount = Number(item.questionsCount) || (isFull ? 40 : 10);
    const mins = Number(item.durationMin) || (isFull ? 30 : 7);
    const rightPill = prog
      ? `<span class="lp-thumb-pill is-score tabular">${prog.score}/${prog.total} câu</span>`
      : `<span class="lp-thumb-pill tabular">${esc(item.targetBand || (isFull ? '6.5 – 8.5' : (item.partNum >= 3 ? '7.0 – 8.5' : '6.0 – 7.0')))}</span>`;
    const cover = getListeningCardCover(item, isFull);

    return `
      <article class="lp-row-card ${isFull ? 'is-full' : ''}">
        <div class="lp-row-thumb has-photo ${isFull ? 'is-full-cover' : ''}">
          <img class="lp-thumb-photo" src="${esc(cover.primary)}" data-fb="${esc(cover.fallback)}"
            onerror="if(this.dataset.fb){this.src=this.dataset.fb;this.removeAttribute('data-fb');}"
            alt="" loading="lazy" decoding="async" draggable="false">
          <div class="lp-thumb-scrim" aria-hidden="true"></div>
          <div class="lp-thumb-top">
            ${isFull ? '<span></span>' : `<span class="lp-thumb-tag">${esc(partLabel)}</span>`}
            ${rightPill}
          </div>
          <div class="lp-thumb-foot tabular">${qCount} câu hỏi · ${mins} phút</div>
        </div>
        <div class="lp-row-main-col">
          <div class="lp-row-body">
            <h4 class="lp-row-title">${esc(item.title)}</h4>
            <p class="lp-row-sub">${esc(item.subtitle || '')}</p>
            <div class="lp-part-meta">
              ${types.map((t) => `<span class="lp-qtype-chip">${esc(t)}</span>`).join('')}
            </div>
          </div>
          <div class="lp-row-actions">
            ${B()?.isTeacherUser?.() ? `<button type="button" class="rp-btn-assign lp-row-btn" style="flex:0 0 auto;padding:0 10px;" onclick="event.stopPropagation(); window.TeacherStudio?.openPracticeAssignModal?.({ skill: 'listening', itemId: '${esc(item.id)}', isFull: ${isFull ? 'true' : 'false'}, title: '${esc(item.title || item.id).replace(/'/g, "\\'")}', subtitle: '${esc(partLabel).replace(/'/g, "\\'")}' })" title="Tạo link giao bài Zalo cho học sinh">🔗 Giao</button><button type="button" class="btn-subtle lp-row-btn" style="flex:0 0 auto;padding:0 10px;" onclick="event.stopPropagation(); ListeningPracticeApp.openTeacherReview('${esc(item.id)}', ${isFull ? 'true' : 'false'})" title="Quyền Giáo viên: Xem ngay đáp án &amp; Transcript không cần làm bài">Xem đáp án</button>` : ''}
            <button type="button" class="btn-subtle lp-row-btn" onclick="ListeningPracticeApp.startItem('${esc(item.id)}', ${isFull ? 'true' : 'false'}, 'practice')">Luyện tập</button>
            <button type="button" class="btn btn-primary lp-row-btn" onclick="ListeningPracticeApp.startItem('${esc(item.id)}', ${isFull ? 'true' : 'false'}, 'exam')">${isFull ? 'Thi Full Test →' : 'Thi thật →'}</button>
          </div>
        </div>
      </article>
    `;
  }

  function renderRecentActualView(root, curSourceObj) {
    const d = DATA();
    const tab = ['p1', 'p2', 'p3', 'p4', 'full'].includes(state.actualTab) ? state.actualTab : 'p1';
    const isFull = tab === 'full';
    const qFilters = [
      { key: 'gap', label: 'Note / Form' },
      { key: 'map', label: 'Map Labelling' },
      { key: 'mcq', label: 'Multiple Choice' },
      { key: 'matching', label: 'Matching' }
    ];
    const activeF = qFilters.find((f) => f.key === state.actualQType) || null;
    const q = state.actualSearch.trim().toLowerCase();

    let items = [];
    if (isFull) {
      items = (d.FULL_TESTS || []).filter((t) => t.source === 'actual');
    } else {
      const pNum = Number(tab.slice(1)) || 1;
      items = Object.values(d.PARTS || {}).filter((p) => p.source === 'actual' && Number(p.partNum) === pNum);
      if (state.actualQType) {
        items = items.filter((p) => (p.qTypeKeys || []).includes(state.actualQType));
      }
    }
    if (q) {
      items = items.filter((it) => `${it.title || ''} ${it.subtitle || ''}`.toLowerCase().includes(q));
    }

    const filterOpen = !isFull && state.actualFilterOpen;

    root.innerHTML = `
      <div class="tot-section-shell lp-hub-shell">
        <div class="rp-hub-head-clean">
          <div class="rp-hub-head-left">
            <button type="button" class="btn-subtle lp-btn-back" id="lp-btn-back-portal" onclick="ListeningPracticeApp.openPortal()">← Kho đề</button>
            <h2 class="tot-shell-title" style="margin:0;">${esc(curSourceObj?.bookTitle || 'Recent Actual Tests')}</h2>
          </div>
          ${renderSourceSwitcherHtml('actual')}
        </div>

        <div class="lp-actual-bar">
          <div class="lp-actual-tabs" role="tablist">
            <button type="button" role="tab" class="lp-actual-tab ${tab === 'p1' ? 'active' : ''}" onclick="ListeningPracticeApp.setActualTab('p1')">Part 1</button>
            <button type="button" role="tab" class="lp-actual-tab ${tab === 'p2' ? 'active' : ''}" onclick="ListeningPracticeApp.setActualTab('p2')">Part 2</button>
            <button type="button" role="tab" class="lp-actual-tab ${tab === 'p3' ? 'active' : ''}" onclick="ListeningPracticeApp.setActualTab('p3')">Part 3</button>
            <button type="button" role="tab" class="lp-actual-tab ${tab === 'p4' ? 'active' : ''}" onclick="ListeningPracticeApp.setActualTab('p4')">Part 4</button>
            <button type="button" role="tab" class="lp-actual-tab ${tab === 'full' ? 'active' : ''}" onclick="ListeningPracticeApp.setActualTab('full')">FULL TEST</button>
          </div>
          <div class="lp-actual-search-wrap">
            <div class="lp-actual-search-combo">
              <span class="lp-search-ico" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              </span>
              <input type="search" class="lp-search-input" value="${esc(state.actualSearch)}" placeholder="Tìm tên bài nghe..." oninput="ListeningPracticeApp.onActualSearch(this.value)" autocomplete="off">
              ${(!isFull && activeF) ? `
                <button type="button" class="lp-active-filter-chip" onclick="ListeningPracticeApp.toggleActualQType('${esc(activeF.key)}')">${esc(activeF.label)} ✕</button>
              ` : ''}
              ${!isFull ? `
                <button type="button" class="lp-filter-btn ${activeF || filterOpen ? 'is-active' : ''}" aria-label="Lọc dạng câu hỏi" onclick="event.stopPropagation(); ListeningPracticeApp.toggleActualFilter()">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="10" y1="18" x2="14" y2="18"/></svg>
                </button>
              ` : ''}
            </div>
            ${filterOpen ? `
              <div class="lp-filter-pop" onclick="event.stopPropagation()">
                ${qFilters.map((f) => `
                  <button type="button" class="lp-filter-item ${state.actualQType === f.key ? 'active' : ''}" onclick="ListeningPracticeApp.toggleActualQType('${f.key}')">
                    <span>${esc(f.label)}</span>
                    ${state.actualQType === f.key ? '<span>✓</span>' : ''}
                  </button>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        ${items.length ? `
          <div class="lp-parts-grid is-three">${items.map((it) => renderPartCard(it, isFull)).join('')}</div>
        ` : `
          <div class="lp-empty-slot" role="status">
            <div class="lp-empty-copy">
              <div class="lp-empty-title">Recent Actual Tests · ${isFull ? 'FULL TEST' : `Part ${tab.slice(1)}`}</div>
              <p class="lp-empty-desc">Ngân hàng đề thi thật đang chờ nạp dữ liệu. Bạn có thể luyện ngay Map Labelling và Note Completion trong mục bài bổ trợ.</p>
              <div class="lp-empty-actions">
                <button type="button" class="btn btn-primary lp-btn-sm" onclick="ListeningTasksModule.openPracticePicker('map')">Luyện Map Labelling →</button>
                <button type="button" class="btn-subtle lp-btn-sm" onclick="ListeningTasksModule.openPracticePicker('note')">Luyện Note Completion</button>
              </div>
            </div>
          </div>
        `}
      </div>
    `;
  }

  function renderHub() {
    const root = getRoot();
    if (!root) return;
    const d = DATA();
    const curSourceObj = (d.PORTAL_CARDS || []).find((c) => c.id === state.source);

    if (state.source === 'actual') {
      renderRecentActualView(root, curSourceObj);
      return;
    }

    const books = getBooksForSource(state.source);
    const visibleBooks = state.source === 'cambridge'
      ? (state.camGroup === 'classic'
          ? books.filter((b) => b.num <= 9)
          : books.filter((b) => b.num >= 10))
      : books;

    if (!visibleBooks.some((b) => b.id === state.selectedBookId) && visibleBooks.length) {
      const firstReady = visibleBooks.find((b) => countReadyTestsInBook(b.id) > 0) || visibleBooks[0];
      state.selectedBookId = firstReady.id;
      state.selectedTestNum = 1;
    }

    const readyBooksCount = books.filter((b) => countReadyTestsInBook(b.id) > 0).length;
    const curBook = books.find((b) => b.id === state.selectedBookId) || visibleBooks[0] || books[0];
    const curTestStatus = getBookTestStatusMap(curBook?.id);
    const curReadyCount = countReadyTestsInBook(curBook?.id);
    const bookParts = getPartsInBook(curBook?.id);
    const bookFulls = getFullTestsInBook(curBook?.id);

    const groupTabsHtml = state.source === 'cambridge' ? `
      <div class="lp-range-tabs" role="tablist" aria-label="Cambridge IELTS range">
        <button type="button" role="tab" class="lp-range-tab ${state.camGroup !== 'classic' ? 'active' : ''}"
          onclick="ListeningPracticeApp.setCamGroup('recent')">★ Cam 10 – 20</button>
        <button type="button" role="tab" class="lp-range-tab ${state.camGroup === 'classic' ? 'active' : ''}"
          onclick="ListeningPracticeApp.setCamGroup('classic')">Cam 1 – 9</button>
      </div>
    ` : '';

    // Compact Totoro-Shaped Books standing directly on the warm oak shelf (NO giant white card wrapper!)
    const shelfBooksHtml = visibleBooks.map((bk) => {
      const readyTests = countReadyTestsInBook(bk.id);
      const tStatus = getBookTestStatusMap(bk.id);
      const active = state.selectedBookId === bk.id;
      const pipsHtml = [1, 2, 3, 4].map((t) => {
        const st = tStatus[t] || {};
        return `<span class="lp-pip ${st.done ? 'is-done' : (st.hasData ? 'is-ready' : '')}"></span>`;
      }).join('');

      return `
        <button type="button"
          class="lp-shelf-totoro ${active ? 'is-active' : ''} ${readyTests > 0 ? 'has-data' : 'is-empty'}"
          style="--lp-fur:${bk.palette.fur};--lp-accent:${bk.palette.accent};"
          data-lp-book="${esc(bk.id)}"
          aria-pressed="${active ? 'true' : 'false'}"
          title="${esc(bk.title)} · ${esc(bk.tag)}"
          onclick="ListeningPracticeApp.selectBook('${esc(bk.id)}')">
          <span class="lp-shelf-totoro-fig">${renderTotoroBookSvg(bk, { suffix: 'shelf', readyCount: readyTests })}</span>
          <span class="lp-shelf-totoro-foot">
            <span class="lp-pips">${pipsHtml}</span>
            <span class="lp-shelf-totoro-cnt tabular">${readyTests > 0 ? `${readyTests}/4` : '—'}</span>
          </span>
        </button>
      `;
    }).join('');

    const testTabsHtml = [1, 2, 3, 4].map((tNum) => {
      const st = curTestStatus[tNum] || {};
      const isAct = state.selectedTestNum === tNum;
      const statusBadge = st.done ? '<small>✓</small>' : (!st.hasData ? '<small>Trống</small>' : '');
      return `
        <button type="button"
          class="lp-test-pill ${isAct ? 'active' : ''} ${st.hasData ? 'has-data' : 'is-empty'} ${st.done ? 'is-done' : ''}"
          data-lp-test="${tNum}"
          onclick="ListeningPracticeApp.selectTestNum(${tNum})">
          <span class="lp-test-dot" aria-hidden="true"></span>
          <span class="lp-test-name">Test ${tNum}</span>
          ${statusBadge}
        </button>
      `;
    }).join('');

    const testParts = bookParts
      .filter((p) => (p.testNum || 1) === state.selectedTestNum)
      .sort((a, b) => (a.partNum || 1) - (b.partNum || 1));
    const testFulls = bookFulls.filter((f) => (f.testNum || 1) === state.selectedTestNum);

    let examListHtml = '';
    if (state.loadingBank === state.source) {
      examListHtml = `<div class="lp-empty-slot" role="status"><div class="lp-empty-title">Đang mở kệ đề Listening…</div></div>`;
    } else if (!testParts.length && !testFulls.length) {
      examListHtml = `
        <div class="lp-empty-slot" role="status">
          <div class="lp-empty-mini-totoro">${renderTotoroBookSvg(curBook, { suffix: 'empty', readyCount: 0 })}</div>
          <div class="lp-empty-copy">
            <div class="lp-empty-title">${esc(curBook?.title || '')} · Test ${state.selectedTestNum}</div>
            <p class="lp-empty-desc">Bộ đề này sẵn sàng nạp dữ liệu Part 1 → Part 4 và FULL TEST. Trong lúc chờ nạp đề, bạn có thể làm ngay các bài Map Labelling &amp; Note Completion.</p>
            <div class="lp-empty-actions">
              <button type="button" class="btn btn-primary lp-btn-sm" onclick="ListeningTasksModule.openPracticePicker('map')">Map Labelling →</button>
              <button type="button" class="btn-subtle lp-btn-sm" onclick="ListeningTasksModule.openPracticePicker('note')">Note Completion</button>
            </div>
          </div>
        </div>
      `;
    } else {
      examListHtml = `
        <div class="lp-test-quad">
          ${testParts.map((p) => renderPartCard(p, false)).join('')}
          ${testFulls.map((ft) => renderPartCard(ft, true)).join('')}
        </div>
      `;
    }

    const shelfHeading = state.source === 'cambridge' ? 'Cambridge IELTS Library' : 'Real Listening Library';
    const unitNoun = state.source === 'volume' ? 'volumes' : 'books';

    root.innerHTML = `
      <div class="tot-section-shell lp-hub-shell">
        <div class="rp-hub-head-clean">
          <div class="rp-hub-head-left">
            <button type="button" class="btn-subtle lp-btn-back" id="lp-btn-back-portal" onclick="ListeningPracticeApp.openPortal()">← Kho đề</button>
            <h2 class="tot-shell-title" style="margin:0;">${esc(curSourceObj?.bookTitle || 'Kho đề Listening')}</h2>
          </div>
          ${renderSourceSwitcherHtml(state.source)}
        </div>

        <section class="lp-bookcase" aria-label="${esc(shelfHeading)}">
          <div class="lp-bookcase-top">
            <div class="lp-bookcase-title-wrap">
              <span class="lp-bookcase-label">${esc(shelfHeading)}</span>
              <span class="lp-shelf-stat tabular">${readyBooksCount}/${books.length} ${unitNoun} ready</span>
            </div>
            ${groupTabsHtml}
          </div>

          <div class="lp-oak-tier">
            <div class="lp-oak-row" id="lp-totoro-shelf" style="--lp-cols:${visibleBooks.length};" role="group" aria-label="${esc(shelfHeading)}">
              ${shelfBooksHtml}
            </div>
            <div class="lp-oak-plank" aria-hidden="true"></div>
          </div>

          <div class="lp-book-desk" id="lp-book-desk">
            <div class="lp-desk-left">
              <div class="lp-desk-totoro-emblem" style="--lp-fur:${curBook?.palette?.fur || '#2F6049'};">
                ${renderTotoroBookSvg(curBook, { suffix: 'desk', readyCount: curReadyCount })}
              </div>
              <div class="lp-desk-meta">
                <div class="lp-desk-title-row">
                  <h3 class="lp-desk-title">${esc(curBook?.title || '')}</h3>
                  <span class="lp-diff-pill">${renderDifficultyStars(curBook?.stars)} · ${esc(curBook?.diff || 'Band 6.5–8.0')}</span>
                  <span class="lp-desk-badge ${curReadyCount > 0 ? 'is-ready' : 'is-empty'} tabular">
                    ${curReadyCount > 0 ? `${curReadyCount}/${curBook?.testsCount || 4} Tests` : 'Chờ nạp đề'}
                  </span>
                </div>
                <p class="lp-desk-review">${esc(curBook?.review || '')}</p>
              </div>
            </div>
            <div class="lp-test-tabs" id="lp-test-tabs" role="group">
              ${testTabsHtml}
            </div>
          </div>
        </section>

        <div class="lp-exams-stack" id="lp-exams-stack">
          ${examListHtml}
        </div>
      </div>
    `;
  }

  /* =========================================================
     ACTIONS & PUBLIC API
     ========================================================= */
  function openPortal() {
    state.view = 'portal';
    state.actualFilterOpen = false;
    render();
  }

  function openSource(src, initialTab) {
    state.source = src || 'cambridge';
    state.view = 'source';
    state.actualFilterOpen = false;
    if (state.source === 'cambridge') {
      state.camGroup = 'recent';
      state.selectedBookId = 'lcam_20';
    } else if (state.source === 'volume') {
      state.selectedBookId = 'lvol_1';
    } else if (state.source === 'actual' && initialTab) {
      state.actualTab = initialTab;
    }
    state.selectedTestNum = 1;
    render();
    ensureSourceBankLoaded(state.source).then(() => {
      if (state.view === 'source' && state.source === src) render();
    });
  }

  function setCamGroup(group) {
    state.camGroup = group === 'classic' ? 'classic' : 'recent';
    render();
  }

  function selectBook(bookId) {
    state.selectedBookId = bookId;
    const status = getBookTestStatusMap(bookId);
    const firstReady = [1, 2, 3, 4].find((t) => status[t]?.hasData);
    state.selectedTestNum = firstReady || 1;
    render();
  }

  function selectTestNum(tNum) {
    state.selectedTestNum = Math.max(1, Math.min(4, Number(tNum) || 1));
    render();
  }

  function setActualTab(tab) {
    state.actualTab = ['p1', 'p2', 'p3', 'p4', 'full'].includes(tab) ? tab : 'p1';
    state.actualFilterOpen = false;
    render();
  }

  function onActualSearch(val) {
    state.actualSearch = String(val || '');
    render();
    const inp = document.querySelector('#lp-app-root .lp-search-input');
    if (inp) {
      inp.focus();
      try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (_) {}
    }
  }

  function toggleActualFilter() {
    state.actualFilterOpen = !state.actualFilterOpen;
    render();
  }

  function toggleActualQType(key) {
    state.actualQType = state.actualQType === key ? '' : key;
    state.actualFilterOpen = false;
    render();
  }

  function launchListeningSpeedQuiz() {
    const cur = B()?.getCurrentScopeKey?.();
    const scopeKey = cur && /^l_/.test(String(cur)) ? cur : 'l_part1';
    if (window.RecognitionTestModule?.startListFinalExam) {
      window.RecognitionTestModule.startListFinalExam(scopeKey);
    } else {
      toast('Speed Quiz đang khởi tạo.');
    }
  }

  function openSignalDeck(startQuiz) {
    if (startQuiz && window.RecognitionTestModule?.startListFinalExam) {
      window.RecognitionTestModule.startListFinalExam('l_cues_40');
      return;
    }
    window.TotoroUI?.enterSkillMode?.('Listening', 'flashcard');
    B()?.loadMainScope?.('l_cues_40');
  }

  /* =========================================================
     VIEW 4 & 5: 1:1 OFFICIAL INSPERA CD-IELTS LISTENING WORKSPACE & REVIEW
     (Identical authentic exam paper format for BOTH Luyện tập & Thi thật!)
     ========================================================= */
  function stopExamTimer() {
    if (_examTimerId) {
      clearInterval(_examTimerId);
      _examTimerId = null;
    }
  }

  let reviewKaraokeRaf = null;
  let reviewTimeline = null;
  let reviewActiveTurnIdx = -1;

  function stopReviewKaraoke() {
    if (reviewKaraokeRaf) {
      cancelAnimationFrame(reviewKaraokeRaf);
      reviewKaraokeRaf = null;
    }
  }

  function stopActiveAudio() {
    stopReviewKaraoke();
    const a = document.getElementById('lp-ex-audio');
    if (a) {
      try { a.pause(); a.removeAttribute('src'); a.load(); } catch (_) {}
    }
  }

  function formatMinsRemaining(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    if (s < 60) return `${s} seconds remaining`;
    const mins = Math.ceil(s / 60);
    return `${mins} minute${mins === 1 ? '' : 's'} remaining`;
  }

  function normText(s) {
    return String(s ?? '')
      .toLowerCase()
      .replace(/[’‘`]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/\ba\.m\.?\b/g, 'am')
      .replace(/\bp\.m\.?\b/g, 'pm')
      .replace(/(\d):(\d{2})/g, '$1.$2')
      .replace(/[£$€]/g, '')
      .replace(/[,;!?]+$/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function expandOptionalParens(raw) {
    const str = String(raw || '').trim();
    const matches = [];
    const re = /\(([^()]{1,36})\)/g;
    let m;
    while ((m = re.exec(str)) !== null && matches.length < 4) {
      matches.push({ start: m.index, end: m.index + m[0].length, inner: m[1] });
    }
    if (!matches.length) return [str];
    const results = new Set();
    const combos = 1 << matches.length;
    for (let mask = 0; mask < combos; mask++) {
      let out = '';
      let pos = 0;
      for (let i = 0; i < matches.length; i++) {
        out += str.slice(pos, matches[i].start);
        if (mask & (1 << i)) out += matches[i].inner;
        pos = matches[i].end;
      }
      out += str.slice(pos);
      results.add(out.replace(/\s+/g, ' ').trim());
    }
    return Array.from(results);
  }

  function buildAcceptedVariants(officialStr) {
    const alts = String(officialStr || '').split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean);
    const out = new Set();
    alts.forEach((alt) => {
      expandOptionalParens(alt).forEach((v) => {
        const n = normText(v);
        if (n) {
          out.add(n);
          out.add(n.replace(/-/g, ' ').replace(/\s+/g, ' ').trim());
          out.add(n.replace(/\s+/g, ''));
        }
      });
    });
    return out;
  }

  function isSingleAnswerMatch(userVal, officialStr) {
    const u = normText(userVal);
    if (!u) return false;
    const accepted = buildAcceptedVariants(officialStr);
    if (accepted.has(u)) return true;
    const uNoHyphen = u.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
    if (accepted.has(uNoHyphen)) return true;
    const uCompact = u.replace(/\s+/g, '');
    if (accepted.has(uCompact)) return true;
    return false;
  }

  function getSessionParts() {
    if (!state.session) return [];
    const map = DATA().PARTS || {};
    return state.session.partIds.map((pid) => map[pid]).filter(Boolean);
  }

  function getActivePart() {
    const parts = getSessionParts();
    return parts[state.session?.activePartIdx || 0] || parts[0] || null;
  }

  function getAllSessionQNums() {
    const out = [];
    getSessionParts().forEach((pt, pIdx) => {
      (pt.answers || []).forEach((a) => out.push({ num: a.num, pIdx, partId: pt.id }));
    });
    return out;
  }

  function getPartAnsweredCount(part) {
    if (!part || !state.session) return 0;
    const ans = state.session.answers || {};
    return (part.answers || []).filter((a) => String(ans[a.num] ?? '').trim().length > 0).length;
  }

  function startExamTimer() {
    stopExamTimer();
    _examTimerId = setInterval(() => {
      if (!state.session || state.view !== 'exam' || state.session.paused) return;
      state.session.remainingSec = Math.max(0, (state.session.remainingSec || 0) - 1);
      const dispEl = document.getElementById('lp-timer-display');
      const exactEl = document.getElementById('lp-timer-exact');
      const btnEl = document.getElementById('lp-hdr-timer');
      if (dispEl) dispEl.textContent = formatMinsRemaining(state.session.remainingSec);
      if (exactEl) {
        exactEl.textContent = state.session.mode === 'practice'
          ? formatMMSS(state.session.remainingSec)
          : `· ${formatMMSS(state.session.remainingSec)}`;
      }
      if (btnEl) {
        btnEl.classList.toggle('is-warn', state.session.remainingSec <= 300 && state.session.remainingSec > 60);
        btnEl.classList.toggle('is-critical', state.session.remainingSec <= 60);
      }
      if (state.session.remainingSec <= 0 && state.session.mode === 'exam') {
        stopExamTimer();
        toast('Hết thời gian làm bài. Hệ thống tự động nộp bài.');
        submitExam(true);
      }
    }, 1000);
  }

  function syncPaperFromState() {
    const paper = document.getElementById('lp-ex-paper');
    if (!paper || !state.session) return;
    const answers = state.session.answers || {};

    paper.querySelectorAll('input.lp-ex-gap, select.lp-ex-select').forEach((el) => {
      const q = el.getAttribute('data-q');
      if (q && answers[q] !== undefined) el.value = answers[q];
    });

    paper.querySelectorAll('input.lp-ex-radio').forEach((el) => {
      const q = el.getAttribute('data-q');
      const checked = q && String(answers[q] || '').toUpperCase() === String(el.value || '').toUpperCase();
      el.checked = !!checked;
      el.closest('label, .lp-ex-opt, .lp-ex-opt-row')?.classList.toggle('is-selected', !!checked);
    });

    paper.querySelectorAll('input.lp-ex-check').forEach((el) => {
      const csv = el.getAttribute('data-multi') || '';
      if (!csv) return;
      const nums = csv.split(',').map((x) => x.trim()).filter(Boolean);
      const chosen = new Set(nums.map((n) => String(answers[n] || '').toUpperCase()).filter(Boolean));
      const checked = chosen.has(String(el.value || '').toUpperCase());
      el.checked = checked;
      el.closest('label, .lp-ex-opt, .lp-ex-opt-row')?.classList.toggle('is-selected', checked);
    });

    // Sync CD-IELTS Drag-and-Drop Matching zones & used option chips
    paper.querySelectorAll('.lp-dd-split').forEach((split) => {
      const optMap = {};
      split.querySelectorAll('.lp-dd-opt[data-dd-letter]').forEach((opt) => {
        const lt = String(opt.getAttribute('data-dd-letter') || '').trim().toUpperCase();
        optMap[lt] = opt.getAttribute('data-dd-text') || '';
      });
      const usedLetters = new Set();
      split.querySelectorAll('.lp-dd-zone[data-q]').forEach((zone) => {
        const q = zone.getAttribute('data-q');
        const val = String(answers[q] ?? '').trim().toUpperCase();
        if (val) {
          usedLetters.add(val);
          const txt = optMap[val] || '';
          zone.classList.add('is-filled');
          zone.setAttribute('draggable', 'true');
          zone.innerHTML = `
            <span class="lp-dd-val-key">${esc(val)}</span>
            <span class="lp-dd-val-txt">${esc(txt)}</span>
            <button type="button" class="lp-dd-clear" data-dd-clear="${esc(q)}" title="Bỏ chọn câu ${esc(q)}" aria-label="Xóa đáp án câu ${esc(q)}">×</button>
          `;
        } else {
          zone.classList.remove('is-filled');
          zone.removeAttribute('draggable');
          zone.innerHTML = `<span class="lp-dd-qnum">${esc(q)}</span><span class="lp-dd-ph">Drop answer here</span>`;
        }
      });
      split.querySelectorAll('.lp-dd-opt[data-dd-letter]').forEach((opt) => {
        const lt = String(opt.getAttribute('data-dd-letter') || '').trim().toUpperCase();
        opt.classList.toggle('is-used', usedLetters.has(lt));
      });
    });

    refreshBottomNavStates();
  }

  const LP_PASTEL_PENS = [
    { id: 'yellow', name: 'Vàng nắng',     role: 'Ý chính',    swatch: '#FDE047' },
    { id: 'green',  name: 'Xanh bạc hà',   role: 'Dẫn chứng',  swatch: '#86EFAC' },
    { id: 'pink',   name: 'Hồng đào',      role: 'Từ bẫy',     swatch: '#F9A8D4' },
    { id: 'blue',   name: 'Xanh bầu trời', role: 'Số liệu',    swatch: '#7DD3FC' },
    { id: 'purple', name: 'Tím oải hương', role: 'Từ vựng',    swatch: '#D8B4FE' }
  ];

  function refreshPracticeProgressPill() {
    if (!state.session || state.session.mode !== 'practice') return;
    const parts = getSessionParts();
    const totalQ = parts.reduce((acc, p) => acc + (p.answers || []).length, 0);
    const doneQ = parts.reduce((acc, p) => acc + getPartAnsweredCount(p), 0);
    const pct = totalQ ? Math.round((doneQ / totalQ) * 100) : 0;
    const numEl = document.getElementById('lp-prac-prog-num');
    const fillEl = document.getElementById('lp-prac-prog-fill');
    if (numEl) numEl.textContent = String(doneQ);
    if (fillEl) fillEl.style.width = `${pct}%`;
  }

  function refreshBottomNavStates() {
    if (!state.session) return;
    const ans = state.session.answers || {};
    const activeNum = Number(state.session.activeQNum || 0);
    document.querySelectorAll('#lp-ins-footer .ins-qbox').forEach((btn) => {
      const q = Number(btn.getAttribute('data-q'));
      btn.classList.toggle('is-attempted', String(ans[q] ?? '').trim().length > 0);
      btn.classList.toggle('is-current', q === activeNum);
    });
    const parts = getSessionParts();
    parts.forEach((pt, idx) => {
      const el = document.querySelector(`#lp-ins-pcol-${idx} .lp-ins-pcnt`);
      if (el) el.textContent = `${getPartAnsweredCount(pt)} of ${(pt.answers || []).length}`;
    });
    refreshPracticeProgressPill();
  }

  let _pendingSelRange = null;
  let _pendingSelText = '';

  function hideSelectionPopover() {
    const pop = document.getElementById('lp-hl-toolbar');
    if (pop) pop.classList.add('hidden');
  }

  function showSelectionPopover(paper) {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      hideSelectionPopover();
      return;
    }
    const text = String(sel.toString() || '').trim();
    if (!text || text.length < 2) {
      hideSelectionPopover();
      return;
    }
    const range = sel.getRangeAt(0);
    if (!paper.contains(range.commonAncestorContainer)) {
      hideSelectionPopover();
      return;
    }
    _pendingSelRange = range.cloneRange();
    _pendingSelText = text;
    const rect = range.getBoundingClientRect();
    const pop = document.getElementById('lp-hl-toolbar');
    if (!pop) return;
    pop.classList.remove('hidden');
    const top = Math.max(58, rect.top - 46);
    const left = Math.max(12, Math.min(window.innerWidth - 280, rect.left + rect.width / 2 - 120));
    pop.style.top = `${top}px`;
    pop.style.left = `${left}px`;
  }

  function updatePracticeHlCount() {
    const cnt = document.querySelectorAll('#lp-ex-paper mark.lp-ins-hl').length;
    const btn = document.getElementById('lp-prac-hl-clear');
    const span = document.getElementById('lp-prac-hl-cnt');
    if (span) span.textContent = String(cnt);
    if (btn) {
      btn.classList.toggle('is-empty', cnt === 0);
      btn.disabled = cnt === 0;
    }
  }

  function applyExamHighlight(colorId) {
    if (!_pendingSelRange) return;
    const c = colorId || (state.session?.activePenColor || 'yellow');
    if (state.session) state.session.activePenColor = c;
    const cls = `lp-ins-hl hl-${c}`;
    try {
      const mark = document.createElement('mark');
      mark.className = cls;
      _pendingSelRange.surroundContents(mark);
    } catch (_) {
      try {
        const frag = _pendingSelRange.extractContents();
        const mark = document.createElement('mark');
        mark.className = cls;
        mark.appendChild(frag);
        _pendingSelRange.insertNode(mark);
      } catch (__) {}
    }
    try { window.getSelection()?.removeAllRanges(); } catch (_) {}
    _pendingSelRange = null;
    hideSelectionPopover();
    updatePracticeHlCount();
  }

  function clearExamHighlight() {
    const paper = document.getElementById('lp-ex-paper');
    if (!paper) return;
    if (_pendingSelRange) {
      paper.querySelectorAll('mark.lp-ins-hl').forEach((m) => {
        if (_pendingSelRange.intersectsNode(m)) {
          const parent = m.parentNode;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
        }
      });
    }
    try { window.getSelection()?.removeAllRanges(); } catch (_) {}
    _pendingSelRange = null;
    hideSelectionPopover();
    updatePracticeHlCount();
  }

  function clearAllPaperHighlights() {
    const paper = document.getElementById('lp-ex-paper');
    if (!paper) return;
    paper.querySelectorAll('mark.lp-ins-hl').forEach((m) => {
      const parent = m.parentNode;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
    });
    updatePracticeHlCount();
  }

  function addNoteFromSelection() {
    if (!state.session) return;
    const quote = _pendingSelText.slice(0, 140);
    state.session.notesOpen = true;
    state.session.pendingQuote = quote;
    hideSelectionPopover();
    renderExamView();
    setTimeout(() => {
      document.getElementById('lp-note-input')?.focus();
    }, 60);
  }

  /* ---------- REAL CD-IELTS PAPER LAYOUT ENHANCER (IDENTICAL IN PRACTICE & EXAM!) ---------- */
  function enhanceListeningPaperLayout(paper) {
    if (!paper) return;

    // 1. Remove redundant raw "SECTION 1..4" / "PART 1..4" headers (already displayed in official Part Banner)
    Array.from(paper.children).forEach((el) => {
      if (/^H[1-4]$/.test(el.tagName)) {
        const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
        if (/^(?:SECTION|PART)\s*[1-4]\b\.?$/i.test(txt)) el.remove();
      }
    });

    // 2. Normalize nested Engnovate radio/checkbox rows into single full-row clickable CD-IELTS <label class="lp-cam-choice">
    paper.querySelectorAll('div.lp-ex-opt').forEach((row) => {
      const inp = row.querySelector('input.lp-ex-radio, input.lp-ex-check');
      if (!inp) return;
      const letterLbl = row.querySelector('label');
      const letterTxt = (letterLbl?.textContent || inp.value || '').trim();
      const spans = Array.from(row.children).filter((ch) => ch.tagName === 'SPAN');
      const textHtml = spans.length ? spans.map((sp) => sp.innerHTML).join(' ') : row.textContent.replace(letterTxt, '').trim();

      const cleanLabel = document.createElement('label');
      cleanLabel.className = 'lp-cam-choice';
      cleanLabel.appendChild(inp);
      if (letterTxt) {
        const lSpan = document.createElement('span');
        lSpan.className = 'lp-cam-letter';
        lSpan.textContent = letterTxt;
        cleanLabel.appendChild(lSpan);
      }
      const tSpan = document.createElement('span');
      tSpan.className = 'lp-cam-otext';
      tSpan.innerHTML = textHtml;
      cleanLabel.appendChild(tSpan);
      row.replaceWith(cleanLabel);
    });

    // Also normalize ITO <p class="lp-ex-opt-row"><label class="lp-ex-opt">...</label></p>
    paper.querySelectorAll('label.lp-ex-opt').forEach((lbl) => {
      const inp = lbl.querySelector('input.lp-ex-radio, input.lp-ex-check');
      if (!inp) return;
      lbl.classList.add('lp-cam-choice');
    });

    // 2b. Upgrade scraped "Drop answer here" Matching blocks into authentic CD-IELTS Drag-and-Drop + Click-to-Assign!
    const processedDdContainers = new Set();
    paper.querySelectorAll('span.lp-ex-opt').forEach((sp) => {
      if (!/Drop answer here/i.test(sp.textContent || '')) return;
      const inlineRow = sp.closest('.lp-ex-q-inline');
      const promptList = inlineRow?.parentElement;
      const outerBox = promptList?.parentElement;
      if (!outerBox || processedDdContainers.has(outerBox)) return;

      // Locate sibling option bank box containing "A.", "B.", ...
      const optBankSrc = Array.from(outerBox.children).find((ch) => ch !== promptList && /Drag (?:an option|and drop)/i.test(ch.textContent || ''));
      const promptRows = Array.from(promptList.querySelectorAll('.lp-ex-q-inline')).filter((r) => /Drop answer here/i.test(r.textContent || ''));
      if (!promptRows.length) return;
      processedDdContainers.add(outerBox);

      // Parse options (A..J)
      const options = [];
      if (optBankSrc) {
        optBankSrc.querySelectorAll('div').forEach((d) => {
          const kids = Array.from(d.children).filter((c) => c.tagName === 'SPAN');
          if (kids.length >= 2) {
            const ltM = (kids[0].textContent || '').trim().match(/^([A-J])\.?$/i);
            const txt = kids.slice(1).map((k) => (k.textContent || '').trim()).join(' ').trim();
            if (ltM && txt && !options.some((o) => o.letter === ltM[1].toUpperCase())) {
              options.push({ letter: ltM[1].toUpperCase(), text: txt });
            }
          }
        });
      }

      const split = document.createElement('div');
      split.className = 'lp-dd-split';

      const leftCol = document.createElement('div');
      leftCol.className = 'lp-dd-prompts';

      promptRows.forEach((row) => {
        const dropSpan = Array.from(row.querySelectorAll('span.lp-ex-opt')).find((s) => /Drop answer here/i.test(s.textContent || ''));
        const qNumTxt = (dropSpan?.querySelector('strong')?.textContent || '').trim();
        const qNum = Number(qNumTxt);
        if (!qNum) return;

        // Extract prompt label text (everything before the drop zone, stripped of leading bullet "•")
        const clone = row.cloneNode(true);
        clone.querySelectorAll('span.lp-ex-opt').forEach((s) => {
          if (/Drop answer here/i.test(s.textContent || '')) s.remove();
        });
        const labelText = (clone.textContent || '').replace(/^\s*[•·\-]\s*/, '').replace(/\s+/g, ' ').trim();

        const ddRow = document.createElement('div');
        ddRow.className = 'lp-dd-row';
        ddRow.innerHTML = `
          <div class="lp-dd-label"><span class="lp-dd-bullet" aria-hidden="true">•</span><span>${esc(labelText)}</span></div>
          <div class="lp-dd-zone" data-q="${qNum}" data-dd-q="${qNum}" tabindex="0" role="button" aria-label="Question ${qNum} drop zone">
            <span class="lp-dd-qnum">${qNum}</span>
            <span class="lp-dd-ph">Drop answer here</span>
          </div>
        `;
        leftCol.appendChild(ddRow);
      });

      const rightCol = document.createElement('div');
      rightCol.className = 'lp-dd-bank';
      rightCol.innerHTML = `
        <div class="lp-dd-bank-hint">Kéo đáp án vào ô trống, hoặc bấm chọn phương án rồi bấm ô câu hỏi.</div>
        <div class="lp-dd-opts">
          ${options.map((o) => `
            <div class="lp-dd-opt" draggable="true" data-dd-letter="${esc(o.letter)}" data-dd-text="${esc(o.text)}" tabindex="0" role="button">
              <span class="lp-dd-opt-key">${esc(o.letter)}</span>
              <span class="lp-dd-opt-txt">${esc(o.text)}</span>
            </div>
          `).join('')}
        </div>
      `;

      split.appendChild(leftCol);
      if (options.length) split.appendChild(rightCol);
      outerBox.replaceWith(split);
    });

    // 3. Split flat children into semantic Question Groups at every "Questions X-Y" heading
    const isGroupStart = (el) => {
      if (!el || el.nodeType !== 1) return false;
      if (el.classList.contains('prac-sheet-eyebrow') || el.classList.contains('lp-ex-answer-strip')) return false;
      if (el.querySelector && el.querySelector('input, select, table, img')) return false;
      if (!/^(H2|H3|H4|H5|P|DIV)$/.test(el.tagName)) return false;
      const txt = (el.textContent || '').replace(/\s+/g, ' ').trim();
      return /^Questions?\s+\d+/i.test(txt) && txt.length < 44;
    };

    const rawNodes = Array.from(paper.children).filter((el) => !el.classList.contains('prac-sheet-eyebrow'));
    const groups = [];
    let curGroup = null;
    rawNodes.forEach((el) => {
      if (isGroupStart(el)) {
        curGroup = [el];
        groups.push(curGroup);
      } else {
        if (!curGroup) {
          curGroup = [];
          groups.push(curGroup);
        }
        curGroup.push(el);
      }
    });

    if (groups.length) {
      const grid = document.createElement('div');
      const hasDiagram = !!paper.querySelector('img.lp-ex-diagram');
      // Official CD-IELTS (Inspera) Listening ALWAYS presents question groups in a SINGLE vertical column!
      // Only Map/Diagram Labelling and Matching Drag-and-Drop split left/right internally.
      const useTwoCol = false;
      grid.className = `lp-cam-grid is-singlecol${hasDiagram ? ' has-diagram' : ''}`;

      groups.forEach((nodes) => {
        if (!nodes.length) return;
        const sec = document.createElement('section');
        sec.className = 'lp-cam-group';

        // Separate heading + instruction lines from the actual form/notes/questions body
        const headNodes = [];
        const bodyNodes = [];
        let passedInst = false;
        nodes.forEach((n, idx) => {
          const txt = (n.textContent || '').replace(/\s+/g, ' ').trim();
          const hasCtrl = !!(n.querySelector && n.querySelector('input, select, table, img'));
          const isInst = !hasCtrl && (
            idx === 0 && /^Questions?\s+\d+/i.test(txt) ||
            /^(?:Complete|Write|Choose|Label|Match|Answer|Select|Which|What|In boxes|NB\b|NO MORE THAN|ONE WORD|TWO WORDS)/i.test(txt)
          );
          if (!passedInst && isInst) {
            if (idx === 0 && /^Questions?\s+\d+/i.test(txt)) n.classList.add('lp-cam-qrange');
            else n.classList.add('lp-cam-inst');
            headNodes.push(n);
          } else {
            passedInst = true;
            bodyNodes.push(n);
          }
        });

        headNodes.forEach((n) => sec.appendChild(n));

        // Detect Note / Form Completion block (has gap inputs, no table, no radio MCQ) -> wrap in authentic Cambridge bordered Note Box!
        const tempCheck = document.createElement('div');
        bodyNodes.forEach((n) => tempCheck.appendChild(n));
        const hasGaps = !!tempCheck.querySelector('input.lp-ex-gap');
        const hasTables = !!tempCheck.querySelector('table');
        const hasMcq = !!tempCheck.querySelector('input.lp-ex-radio, input.lp-ex-check');
        const hasImg = !!tempCheck.querySelector('img.lp-ex-diagram');

        if (hasGaps && !hasTables && !hasMcq && !hasImg && tempCheck.children.length >= 2) {
          tempCheck.className = 'lp-cam-note-box';
          // Promote first bold heading inside Note Box as official centered Cambridge form title
          const firstChild = tempCheck.firstElementChild;
          if (firstChild && /^(H3|H4|H5|P)$/.test(firstChild.tagName) && !firstChild.querySelector('input') && (firstChild.textContent || '').trim().length < 64) {
            firstChild.classList.add('lp-cam-note-title');
          }
          // Style label: [input] lines cleanly
          Array.from(tempCheck.children).forEach((ch) => {
            if (ch.tagName === 'P' && ch.querySelector('input.lp-ex-gap')) {
              ch.classList.add('lp-cam-note-row');
            }
          });
        } else {
          tempCheck.className = 'lp-cam-group-body';
        }

        // If this group has a Map/Diagram + questions AND we're in single-col mode, lay Map left & Questions right!
        if (hasImg && !useTwoCol && tempCheck.querySelectorAll('input, select').length >= 3) {
          const imgEl = tempCheck.querySelector('img.lp-ex-diagram');
          const imgParent = imgEl?.parentElement;
          if (imgEl) {
            const split = document.createElement('div');
            split.className = 'lp-cam-map-split';
            const leftPane = document.createElement('div');
            leftPane.className = 'lp-cam-map-pane';
            leftPane.appendChild(imgEl);
            const hint = document.createElement('div');
            hint.className = 'lp-cam-map-hint';
            hint.textContent = 'Bấm vào hình để phóng to';
            leftPane.appendChild(hint);
            if (imgParent && imgParent !== tempCheck && !imgParent.textContent.trim() && !imgParent.querySelector('input, select')) {
              imgParent.remove();
            }
            const rightPane = document.createElement('div');
            rightPane.className = 'lp-cam-map-qs';
            while (tempCheck.firstChild) rightPane.appendChild(tempCheck.firstChild);
            split.appendChild(leftPane);
            split.appendChild(rightPane);
            sec.appendChild(split);
          } else {
            sec.appendChild(tempCheck);
          }
        } else {
          sec.appendChild(tempCheck);
        }

        grid.appendChild(sec);
      });

      paper.appendChild(grid);
    }
  }

  function bindPaperInputs() {
    const paper = document.getElementById('lp-ex-paper');
    if (!paper || !state.session) return;

    enhanceListeningPaperLayout(paper);

    paper.addEventListener('focusin', (ev) => {
      const el = ev.target?.closest?.('[data-q], [data-multi]');
      if (!el) return;
      const q = el.getAttribute('data-q') || (el.getAttribute('data-multi') || '').split(',')[0];
      if (q) {
        state.session.activeQNum = Number(q);
        refreshBottomNavStates();
      }
    });

    paper.addEventListener('input', (ev) => {
      const el = ev.target;
      if (!el || !el.matches('input.lp-ex-gap')) return;
      const q = el.getAttribute('data-q');
      if (!q) return;
      state.session.answers[q] = el.value;
      state.session.activeQNum = Number(q);
      refreshBottomNavStates();
    });

    paper.addEventListener('change', (ev) => {
      const el = ev.target;
      if (!el) return;
      if (el.matches('select.lp-ex-select')) {
        const q = el.getAttribute('data-q');
        if (q) {
          state.session.answers[q] = el.value;
          state.session.activeQNum = Number(q);
        }
        refreshBottomNavStates();
      } else if (el.matches('input.lp-ex-radio')) {
        const q = el.getAttribute('data-q');
        if (q) {
          state.session.answers[q] = el.value;
          state.session.activeQNum = Number(q);
          paper.querySelectorAll(`input.lp-ex-radio[data-q="${q}"]`).forEach((r) => {
            r.closest('label, .lp-ex-opt, .lp-ex-opt-row')?.classList.toggle('is-selected', r.checked);
          });
        }
        refreshBottomNavStates();
      } else if (el.matches('input.lp-ex-check')) {
        const csv = el.getAttribute('data-multi') || '';
        const limit = Number(el.getAttribute('data-limit') || 2);
        const nums = csv.split(',').map((x) => x.trim()).filter(Boolean);
        const groupBoxes = Array.from(paper.querySelectorAll(`input.lp-ex-check[data-multi="${csv}"]`));
        const checkedBoxes = groupBoxes.filter((b) => b.checked);
        if (checkedBoxes.length > limit) {
          el.checked = false;
          toast(`Chỉ chọn tối đa ${limit} đáp án cho nhóm câu ${nums[0]}–${nums[nums.length - 1]}.`);
          return;
        }
        groupBoxes.forEach((b) => {
          b.closest('label, .lp-ex-opt, .lp-ex-opt-row')?.classList.toggle('is-selected', b.checked);
        });
        const vals = checkedBoxes.map((b) => b.value);
        nums.forEach((n, idx) => {
          state.session.answers[n] = vals[idx] || '';
        });
        if (nums[0]) state.session.activeQNum = Number(nums[0]);
        refreshBottomNavStates();
      }
    });

    paper.addEventListener('mouseup', () => {
      setTimeout(() => showSelectionPopover(paper), 10);
    });

    // Click to zoom Map / Diagram images cleanly
    paper.addEventListener('click', (ev) => {
      const img = ev.target?.closest?.('img.lp-ex-diagram');
      if (!img) return;
      openDiagramLightbox(img.src, img.alt || 'Listening Diagram');
    });

    // Authentic CD-IELTS Drag-and-Drop + 2-Click Assignment for Matching blocks (.lp-dd-split)
    let armedDdLetter = '';
    let armedDdSplit = null;
    let armedDdZoneQ = '';

    const clearDdArmed = () => {
      armedDdLetter = '';
      armedDdSplit = null;
      armedDdZoneQ = '';
      paper.querySelectorAll('.lp-dd-opt.is-armed, .lp-dd-zone.is-armed').forEach((el) => el.classList.remove('is-armed'));
    };

    const assignDdAnswer = (qNum, letter) => {
      if (!state.session || !qNum) return;
      state.session.answers[String(qNum)] = String(letter || '').trim().toUpperCase();
      state.session.activeQNum = Number(qNum);
      clearDdArmed();
      syncPaperFromState();
    };

    paper.addEventListener('dragstart', (ev) => {
      const opt = ev.target?.closest?.('.lp-dd-opt[data-dd-letter]');
      if (opt) {
        const lt = opt.getAttribute('data-dd-letter') || '';
        ev.dataTransfer?.setData('text/plain', lt);
        ev.dataTransfer.effectAllowed = 'copyMove';
        opt.classList.add('is-dragging');
        return;
      }
      const zone = ev.target?.closest?.('.lp-dd-zone.is-filled[data-q]');
      if (zone) {
        const q = zone.getAttribute('data-q');
        const lt = String(state.session?.answers?.[q] || '').trim().toUpperCase();
        if (lt) {
          ev.dataTransfer?.setData('text/plain', lt);
          ev.dataTransfer?.setData('application/x-lp-from-q', q);
          ev.dataTransfer.effectAllowed = 'move';
        }
      }
    });

    paper.addEventListener('dragend', () => {
      paper.querySelectorAll('.lp-dd-opt.is-dragging, .lp-dd-zone.is-dragover').forEach((el) => {
        el.classList.remove('is-dragging', 'is-dragover');
      });
    });

    paper.addEventListener('dragover', (ev) => {
      const zone = ev.target?.closest?.('.lp-dd-zone[data-q]');
      if (!zone) return;
      ev.preventDefault();
      zone.classList.add('is-dragover');
    });

    paper.addEventListener('dragleave', (ev) => {
      const zone = ev.target?.closest?.('.lp-dd-zone[data-q]');
      if (zone) zone.classList.remove('is-dragover');
    });

    paper.addEventListener('drop', (ev) => {
      const zone = ev.target?.closest?.('.lp-dd-zone[data-q]');
      if (!zone) return;
      ev.preventDefault();
      zone.classList.remove('is-dragover');
      const lt = String(ev.dataTransfer?.getData('text/plain') || '').trim().toUpperCase();
      const fromQ = ev.dataTransfer?.getData('application/x-lp-from-q') || '';
      const targetQ = zone.getAttribute('data-q');
      if (!lt || !targetQ) return;
      if (fromQ && fromQ !== targetQ && state.session) {
        const prevTargetVal = state.session.answers[targetQ] || '';
        state.session.answers[fromQ] = prevTargetVal;
      }
      assignDdAnswer(targetQ, lt);
    });

    paper.addEventListener('click', (ev) => {
      const clearBtn = ev.target?.closest?.('.lp-dd-clear[data-dd-clear]');
      if (clearBtn) {
        ev.stopPropagation();
        assignDdAnswer(clearBtn.getAttribute('data-dd-clear'), '');
        return;
      }

      const opt = ev.target?.closest?.('.lp-dd-opt[data-dd-letter]');
      if (opt) {
        const split = opt.closest('.lp-dd-split');
        const lt = opt.getAttribute('data-dd-letter') || '';
        if (armedDdZoneQ && armedDdSplit === split) {
          assignDdAnswer(armedDdZoneQ, lt);
          return;
        }
        const wasArmed = opt.classList.contains('is-armed');
        clearDdArmed();
        if (!wasArmed) {
          armedDdLetter = lt;
          armedDdSplit = split;
          opt.classList.add('is-armed');
        }
        return;
      }

      const zone = ev.target?.closest?.('.lp-dd-zone[data-q]');
      if (zone) {
        const split = zone.closest('.lp-dd-split');
        const q = zone.getAttribute('data-q');
        if (state.session && q) {
          state.session.activeQNum = Number(q);
          refreshBottomNavStates();
        }
        if (armedDdLetter && armedDdSplit === split) {
          assignDdAnswer(q, armedDdLetter);
          return;
        }
        const wasArmed = zone.classList.contains('is-armed');
        clearDdArmed();
        if (!wasArmed) {
          armedDdZoneQ = q;
          armedDdSplit = split;
          zone.classList.add('is-armed');
        }
      }
    });

    syncPaperFromState();
  }

  function openDiagramLightbox(src, alt) {
    const existing = document.getElementById('lp-diagram-lightbox');
    if (existing) existing.remove();
    const ov = document.createElement('div');
    ov.id = 'lp-diagram-lightbox';
    ov.className = 'lp-lightbox';
    ov.innerHTML = `
      <div class="lp-lightbox-card" onclick="event.stopPropagation()">
        <button type="button" class="lp-lightbox-close" aria-label="Đóng" onclick="document.getElementById('lp-diagram-lightbox')?.remove()">✕</button>
        <img src="${esc(src)}" alt="${esc(alt)}">
      </div>
    `;
    ov.addEventListener('click', () => ov.remove());
    document.body.appendChild(ov);
  }

  function bindAudioPlayer(isReview) {
    const audio = document.getElementById('lp-ex-audio');
    const playBtn = document.getElementById('lp-audio-play');
    const seek = document.getElementById('lp-audio-seek');
    const vol = document.getElementById('lp-audio-vol');
    const curEl = document.getElementById('lp-audio-cur');
    const durEl = document.getElementById('lp-audio-dur');
    const statusEl = document.getElementById('lp-audio-status');
    if (!audio || !playBtn) return;

    const isExamLocked = !isReview && state.session?.mode === 'exam';

    const updatePlayIcon = () => {
      playBtn.classList.toggle('is-playing', !audio.paused);
      playBtn.setAttribute('aria-label', audio.paused ? 'Phát audio' : 'Tạm dừng audio');
      playBtn.innerHTML = audio.paused
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>';
    };

    playBtn.addEventListener('click', () => {
      if (isExamLocked && !audio.paused) {
        toast('Chế độ Thi thật phát băng liên tục 1 lượt.');
        return;
      }
      if (audio.paused) {
        const p = audio.play();
        if (p && p.catch) p.catch(() => { if (statusEl) statusEl.textContent = 'Không phát được audio — nhấn thử lại.'; });
      } else {
        audio.pause();
      }
    });

    audio.addEventListener('play', () => {
      updatePlayIcon();
      if (statusEl) statusEl.textContent = '';
      if (isReview) startReviewKaraokeLoop(audio);
    });
    audio.addEventListener('pause', () => {
      updatePlayIcon();
      if (isReview) {
        stopReviewKaraoke();
        syncReviewKaraokeAtTime(audio.currentTime || 0, false);
      }
    });
    audio.addEventListener('loadedmetadata', () => {
      if (durEl) durEl.textContent = formatMMSS(audio.duration);
      if (seek) seek.max = String(Math.floor(audio.duration || 100));
      if (isReview) rebuildReviewTimelineForDuration(audio.duration || 0);
    });
    audio.addEventListener('timeupdate', () => {
      if (curEl) curEl.textContent = formatMMSS(audio.currentTime);
      if (seek && audio.duration) {
        seek.max = String(Math.floor(audio.duration));
        seek.value = String(Math.floor(audio.currentTime));
      }
      if (isReview && audio.paused) {
        syncReviewKaraokeAtTime(audio.currentTime || 0, false);
      }
    });
    audio.addEventListener('seeked', () => {
      if (isReview) syncReviewKaraokeAtTime(audio.currentTime || 0, true);
    });
    audio.addEventListener('error', () => {
      updatePlayIcon();
      if (statusEl) statusEl.textContent = 'Lỗi tải audio từ máy chủ.';
    });
    audio.addEventListener('ended', () => {
      updatePlayIcon();
      if (isReview) {
        stopReviewKaraoke();
        clearReviewKaraokeHighlight();
      }
      if (!isReview && state.session?.isFull && state.session.activePartIdx < state.session.partIds.length - 1) {
        toast(`Đã phát xong Part ${state.session.activePartIdx + 1}. Chuyển sang Part ${state.session.activePartIdx + 2}…`);
        setTimeout(() => {
          if (state.view === 'exam' && state.session) {
            switchExamPart(state.session.activePartIdx + 1, true);
          }
        }, 1200);
      }
    });

    if (seek && !isExamLocked) {
      seek.addEventListener('input', () => {
        audio.currentTime = Number(seek.value) || 0;
        if (isReview) syncReviewKaraokeAtTime(audio.currentTime, true);
      });
    }

    if (vol) {
      vol.addEventListener('input', () => {
        audio.volume = Math.max(0, Math.min(1, Number(vol.value)));
      });
    }

    const skipBack = document.getElementById('lp-audio-back');
    const skipFwd = document.getElementById('lp-audio-fwd');
    if (skipBack && !isExamLocked) {
      skipBack.addEventListener('click', () => { audio.currentTime = Math.max(0, (audio.currentTime || 0) - 5); });
    }
    if (skipFwd && !isExamLocked) {
      skipFwd.addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, (audio.currentTime || 0) + 5); });
    }

    const rateSel = document.getElementById('lp-audio-rate');
    if (rateSel && !isExamLocked) {
      rateSel.addEventListener('change', () => {
        audio.playbackRate = Number(rateSel.value) || 1;
      });
    }

    updatePlayIcon();
  }

  function renderAudioBarHtml(part, isReview) {
    const isExamLocked = !isReview && state.session?.mode === 'exam';
    return `
      <div class="lp-ins-audio ${isExamLocked ? 'is-locked' : ''}">
        <audio id="lp-ex-audio" preload="metadata" src="${esc(part?.audioUrl || '')}"></audio>
        <button type="button" class="lp-ins-play" id="lp-audio-play" aria-label="Phát audio">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.14v14l11-7-11-7z"/></svg>
        </button>
        ${!isExamLocked ? `
          <button type="button" class="lp-ins-step" id="lp-audio-back" title="Lùi 5 giây">−5s</button>
          <button type="button" class="lp-ins-step" id="lp-audio-fwd" title="Tua 5 giây">+5s</button>
        ` : `<span class="lp-audio-lock-pill">Thi thật · Phát 1 lượt</span>`}
        <div class="lp-ins-track">
          <span class="lp-ins-time tabular" id="lp-audio-cur">00:00</span>
          <input type="range" class="lp-ins-seek" id="lp-audio-seek" min="0" max="100" value="0" ${isExamLocked ? 'disabled' : ''} aria-label="Tiến độ băng nghe">
          <span class="lp-ins-time tabular" id="lp-audio-dur">--:--</span>
        </div>
        <div class="lp-ins-vol-wrap" title="Âm lượng">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
          <input type="range" class="lp-ins-vol" id="lp-audio-vol" min="0" max="1" step="0.05" value="1" aria-label="Âm lượng">
        </div>
        ${!isExamLocked ? `
          <select class="lp-ins-rate" id="lp-audio-rate" aria-label="Tốc độ phát">
            <option value="0.85">0.85×</option>
            <option value="1" selected>1.0×</option>
            <option value="1.15">1.15×</option>
            <option value="1.25">1.25×</option>
          </select>
        ` : ''}
        <span class="lp-audio-status" id="lp-audio-status" role="status"></span>
      </div>
    `;
  }

  function renderExamView() {
    const root = getRoot();
    const s = state.session;
    const part = getActivePart();
    if (!root || !s || !part) {
      document.body.classList.remove('lp-exam-fullscreen');
      openSource(state.source);
      return;
    }

    document.body.classList.add('lp-exam-fullscreen');
    const parts = getSessionParts();
    const allQs = getAllSessionQNums();
    const curPartQs = part.answers || [];
    const qMin = curPartQs[0]?.num || ((part.partNum - 1) * 10 + 1);
    const qMax = curPartQs[curPartQs.length - 1]?.num || (part.partNum * 10);
    const ans = s.answers || {};
    const isPractice = s.mode === 'practice';
    const modeCls = isPractice ? 'ins-mode-practice' : 'ins-mode-exam';
    const contrastKey = isPractice ? (s.contrast || 'totoro') : (s.contrast || 'cd');
    const contrastCls = `ins-contrast-${contrastKey}`;
    const sizeCls = `ins-size-${s.textSize || 'regular'}`;
    const timerUrgency = s.remainingSec <= 60 ? ' is-critical' : (s.remainingSec <= 300 ? ' is-warn' : '');
    const curGlobalIdx = Math.max(0, allQs.findIndex((x) => x.num === Number(s.activeQNum || qMin)));
    const notesCount = (s.notes || []).length;
    const totalAnswered = parts.reduce((acc, pt) => acc + getPartAnsweredCount(pt), 0);
    const progressPct = allQs.length ? Math.round((totalAnswered / allQs.length) * 100) : 0;

    // 48px Official Inspera Bottom Parts (Expanded active Part + Collapsed other Parts)
    const bottomPartsHtml = parts.map((pt, pIdx) => {
      const pQs = pt.answers || [];
      const pDone = getPartAnsweredCount(pt);
      const isAct = pIdx === s.activePartIdx;
      const pTitle = `Part ${pt.partNum || (pIdx + 1)}`;
      if (!isAct) {
        return `
          <button type="button" class="ins-part-collapsed" id="lp-ins-pcol-${pIdx}" onclick="ListeningPracticeApp.switchExamPart(${pIdx})">
            <strong>${esc(pTitle)}</strong>
            <span class="lp-ins-pcnt tabular">${pDone} of ${pQs.length}</span>
          </button>
        `;
      }
      const qBoxesHtml = pQs.map((a) => {
        const isDone = String(ans[a.num] ?? '').trim().length > 0;
        const isCur = Number(s.activeQNum || qMin) === a.num;
        return `
          <button type="button" class="ins-qbox ${isDone ? 'is-attempted' : ''} ${isCur ? 'is-current' : ''}"
            data-q="${a.num}" onclick="ListeningPracticeApp.focusQuestion(${a.num})" title="Question ${a.num}">
            <span class="ins-qbox-dash"></span>
            <span class="ins-qbox-num">${a.num}</span>
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

    const notesDrawerHtml = `
      <aside class="ins-notes-sidebar ${s.notesOpen ? 'open' : ''}" id="lp-notes-drawer" aria-label="Notes">
        <div class="ins-notes-header">
          <span>Notes${notesCount ? ` (${notesCount})` : ''}</span>
          <button type="button" class="ins-notes-close" onclick="ListeningPracticeApp.toggleNotesDrawer(false)" aria-label="Close notes">✕</button>
        </div>
        <div class="ins-notes-body">
          ${notesCount ? `
            <div class="ins-notes-list">
              ${s.notes.map((n) => `
                <div class="ins-note-card">
                  ${n.quote ? `<div class="ins-note-quote">“${esc(n.quote)}”</div>` : ''}
                  <div class="ins-note-text">${esc(n.text)}</div>
                  <button type="button" class="ins-note-del" onclick="ListeningPracticeApp.deleteNote('${esc(n.id)}')">Delete</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="ins-notes-empty">
              <strong>Your private notes will show here</strong>
              <p>Select text in the questions to highlight or add a note.</p>
            </div>
          `}
          <form class="ins-notes-form" onsubmit="ListeningPracticeApp.addManualNote(event)">
            ${s.pendingQuote ? `<div class="ins-note-quote" style="margin-bottom:6px;">“${esc(s.pendingQuote)}”</div>` : ''}
            <textarea id="lp-note-input" rows="2" placeholder="Add a private note..."></textarea>
            <button type="submit" class="ins-note-save-btn">+ Save note</button>
          </form>
        </div>
      </aside>
    `;

    // Anchored Totoro "Giao diện" Popover for Practice; Official Inspera Options Overlay for Exam
    const practiceAppearancePopHtml = isPractice ? `
      <div class="prac-pop-wrap" onclick="event.stopPropagation()">
        <button type="button" class="prac-hdr-btn ${s.optionsOpen ? 'active' : ''}" id="lp-btn-options"
          onclick="ListeningPracticeApp.toggleOptionsOverlay()" title="Tùy chỉnh nền giấy &amp; cỡ chữ" aria-label="Giao diện">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Giao diện</span>
        </button>
        <div class="prac-popover ${s.optionsOpen ? 'open' : ''}" id="lp-options-overlay" role="dialog" aria-label="Tùy chỉnh hiển thị">
          <div>
            <div class="prac-pop-lbl">Nền giấy làm bài</div>
            <div class="prac-pop-seg" style="margin-bottom:12px;">
              <button type="button" class="prac-seg-btn ${contrastKey === 'totoro' ? 'active' : ''}" onclick="ListeningPracticeApp.setContrast('totoro')">Washi ấm</button>
              <button type="button" class="prac-seg-btn ${contrastKey === 'cd' ? 'active' : ''}" onclick="ListeningPracticeApp.setContrast('cd')">Trắng sáng</button>
              <button type="button" class="prac-seg-btn ${contrastKey === 'sepia' ? 'active' : ''}" onclick="ListeningPracticeApp.setContrast('sepia')">Xanh sương</button>
            </div>
          </div>
          <div class="prac-pop-lbl">Cỡ chữ đề thi</div>
          <div class="prac-pop-seg">
            <button type="button" class="prac-seg-btn ${(s.textSize || 'regular') === 'regular' ? 'active' : ''}" onclick="ListeningPracticeApp.setTextSize('regular')">Vừa</button>
            <button type="button" class="prac-seg-btn ${s.textSize === 'large' ? 'active' : ''}" onclick="ListeningPracticeApp.setTextSize('large')">Lớn</button>
            <button type="button" class="prac-seg-btn ${s.textSize === 'xlarge' ? 'active' : ''}" onclick="ListeningPracticeApp.setTextSize('xlarge')">Rất lớn</button>
          </div>
        </div>
      </div>
    ` : '';

    const optionsOverlayHtml = !isPractice ? `
      <div class="ins-options-overlay ${s.optionsOpen ? 'open' : ''}" id="lp-options-overlay">
        <div class="ins-options-head">
          <h2>Options</h2>
          <button type="button" class="ins-options-x" onclick="ListeningPracticeApp.toggleOptionsOverlay(false)" aria-label="Close options">✕</button>
        </div>
        <div class="ins-options-body">
          <button type="button" class="ins-opt-submit-btn" onclick="ListeningPracticeApp.toggleOptionsOverlay(false); ListeningPracticeApp.submitExam();">
            <span>Go to submission page</span>
            <span>›</span>
          </button>

          <div class="ins-opt-card">
            <div class="ins-opt-sec-title">Contrast</div>
            <div class="ins-opt-choices">
              <button type="button" class="ins-opt-row ${contrastKey === 'cd' ? 'active' : ''}" onclick="ListeningPracticeApp.setContrast('cd')">
                <span>Black on white</span><span>${contrastKey === 'cd' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${contrastKey === 'dark' ? 'active' : ''}" onclick="ListeningPracticeApp.setContrast('dark')">
                <span>White on black</span><span>${contrastKey === 'dark' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${contrastKey === 'yellow' ? 'active' : ''}" onclick="ListeningPracticeApp.setContrast('yellow')">
                <span>Yellow on black</span><span>${contrastKey === 'yellow' ? '✓' : ''}</span>
              </button>
            </div>
          </div>

          <div class="ins-opt-card">
            <div class="ins-opt-sec-title">Text size</div>
            <div class="ins-opt-choices">
              <button type="button" class="ins-opt-row ${(s.textSize || 'regular') === 'regular' ? 'active' : ''}" onclick="ListeningPracticeApp.setTextSize('regular')">
                <span>Regular</span><span>${(s.textSize || 'regular') === 'regular' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.textSize === 'large' ? 'active' : ''}" onclick="ListeningPracticeApp.setTextSize('large')">
                <span>Large</span><span>${s.textSize === 'large' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.textSize === 'xlarge' ? 'active' : ''}" onclick="ListeningPracticeApp.setTextSize('xlarge')">
                <span>Extra large</span><span>${s.textSize === 'xlarge' ? '✓' : ''}</span>
              </button>
            </div>
          </div>

          <button type="button" class="ins-opt-exit-btn" onclick="ListeningPracticeApp.exitExam()">← Thoát ra kho đề</button>
        </div>
      </div>
    ` : '';

    const brandBlockHtml = isPractice
      ? `
        <button type="button" class="prac-back-btn" onclick="ListeningPracticeApp.exitExam()" title="Quay về kho đề" aria-label="Quay về kho đề">
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

    const timerBlockHtml = isPractice
      ? `
        <div class="prac-timer-pill">
          <span class="prac-live-dot ${s.paused ? 'is-paused' : ''}" aria-hidden="true"></span>
          ${s.showTimer !== false ? `
            <button type="button" class="ins-hdr-timer" id="lp-hdr-timer" onclick="ListeningPracticeApp.togglePauseTimer()" title="Bấm để tạm dừng / tiếp tục đồng hồ">
              <span class="tabular" id="lp-timer-exact">${formatMMSS(s.remainingSec)}</span>
              <span class="sr-only" id="lp-timer-display">${formatMinsRemaining(s.remainingSec)}</span>
              ${s.paused ? '<span class="ins-paused-tag">PAUSED</span>' : ''}
            </button>
          ` : `<span class="prac-timer-hidden-lbl">Tự do</span>`}
          <button type="button" class="prac-timer-eye" onclick="ListeningPracticeApp.toggleTimerVisibility()" title="${s.showTimer !== false ? 'Ẩn đồng hồ' : 'Hiện đồng hồ'}" aria-label="${s.showTimer !== false ? 'Ẩn đồng hồ' : 'Hiện đồng hồ'}">
            ${s.showTimer !== false
              ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>'
              : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>'}
          </button>
        </div>
      `
      : `
        <button type="button" class="ins-hdr-timer${timerUrgency}" id="lp-hdr-timer" title="Thời gian thi thật">
          <span id="lp-timer-display">${formatMinsRemaining(s.remainingSec)}</span>
          <span class="ins-timer-exact tabular" id="lp-timer-exact">· ${formatMMSS(s.remainingSec)}</span>
        </button>
      `;

    const practiceProgPillHtml = isPractice ? `
      <div class="prac-prog-pill tabular" title="Tiến độ trả lời bài hiện tại">
        <span><strong id="lp-prac-prog-num">${totalAnswered}</strong>/${allQs.length} câu</span>
        <span class="prac-prog-track" aria-hidden="true"><span class="prac-prog-fill" id="lp-prac-prog-fill" style="width:${progressPct}%;"></span></span>
      </div>
    ` : '';

    const practiceStampSvg = isPractice ? `
      <svg class="prac-folio-stamp" viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <circle cx="40" cy="40" r="35" stroke="currentColor" stroke-width="1.6" stroke-dasharray="4 4"/>
        <path d="M27 32L23.5 18L32.5 26C36.8 24.5 43.2 24.5 47.5 26L56.5 18L53 32C58.5 36.2 61.5 43 61.5 50.5C61.5 60.5 52.5 66 40 66C27.5 66 18.5 60.5 18.5 50.5C18.5 43 21.5 36.2 27 32Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M40 19.5C43.5 15.2 48.5 14.8 51.5 17.5C48 20.5 43.5 21.2 40 19.5Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.6"/>
        <circle cx="32" cy="39" r="2.2" fill="currentColor"/><circle cx="48" cy="39" r="2.2" fill="currentColor"/>
        <path d="M29.5 52L33 48.8L36.5 52M37.5 51L40 48.2L42.5 51M43.5 52L47 48.8L50.5 52" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ` : '';

    const selPopoverHtml = isPractice ? `
      <div class="ins-sel-popover is-practice hidden" id="lp-hl-toolbar" role="toolbar" aria-label="Highlight màu pastel" onmousedown="event.stopPropagation()">
        <div class="prac-pop-swatches">
          ${LP_PASTEL_PENS.map((pen) => `
            <button type="button"
              class="prac-pop-dot ${(s.activePenColor || 'yellow') === pen.id ? 'is-active' : ''}"
              style="--swatch:${pen.swatch};"
              title="${esc(pen.name)} — ${esc(pen.role)}"
              aria-label="Highlight ${esc(pen.name)}"
              onclick="ListeningPracticeApp.applyExamHighlight('${pen.id}')"></button>
          `).join('')}
        </div>
        <div class="prac-pop-divider" aria-hidden="true"></div>
        <button type="button" class="ins-sel-act prac-pop-act" onclick="ListeningPracticeApp.addNoteFromSelection()" title="Tạo ghi chú">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Ghi chú</span>
        </button>
        <button type="button" class="ins-sel-clear prac-pop-clear" onclick="ListeningPracticeApp.clearExamHighlight()" title="Xóa màu đoạn chọn">Xóa</button>
      </div>
    ` : `
      <div class="ins-sel-popover hidden" id="lp-hl-toolbar" onmousedown="event.stopPropagation()">
        <button type="button" class="ins-sel-act" onclick="ListeningPracticeApp.addNoteFromSelection()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span>Note</span>
        </button>
        <button type="button" class="ins-sel-act" onclick="ListeningPracticeApp.applyExamHighlight('yellow')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
          <span>Highlight</span>
        </button>
        <button type="button" class="ins-sel-clear" onclick="ListeningPracticeApp.clearExamHighlight()">Clear</button>
      </div>
    `;

    root.innerHTML = `
      <div class="ins-shell lp-ins-shell ${modeCls} ${contrastCls} ${sizeCls}" id="lp-ins-workspace" data-mode="${esc(s.mode)}"
        onclick="${isPractice && s.optionsOpen ? 'ListeningPracticeApp.toggleOptionsOverlay(false)' : ''}">
        <div class="ins-main-col">
          <!-- Workspace Header (Totoro Washi Studio for Practice · Official Inspera for Exam) -->
          <header class="ins-header">
            <div class="ins-hdr-left">
              ${brandBlockHtml}
              <div class="ins-hdr-meta">
                <div class="ins-hdr-title">${esc(s.title)}</div>
                ${!isPractice ? timerBlockHtml : ''}
              </div>
            </div>

            <div class="ins-hdr-right">
              ${isPractice ? timerBlockHtml : '<span class="lp-ins-mode-tag is-exam">Thi thật</span>'}
              <span class="rp-ac-shield" title="Chống gian lận đang bật trong phòng làm bài"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg><span>Anti-Cheat</span></span>
              ${practiceProgPillHtml}
              ${(B()?.isTeacherUser?.() || B()?.isTeacherMode?.() || B()?.isTeacherPreviewing?.()) ? `
                <button type="button" class="ins-hdr-pill" id="lp-btn-teacher-solutions"
                  onclick="ListeningPracticeApp.openTeacherReviewFromExam()"
                  title="Quyền Giáo viên: Xem ngay toàn bộ đáp án &amp; Transcript không cần làm hết">
                  Xem đáp án
                </button>
              ` : ''}
              <button type="button" class="ins-hdr-ico ${isPractice ? 'prac-hdr-ico' : ''} ${s.notesOpen ? 'active' : ''}" onclick="ListeningPracticeApp.toggleNotesDrawer()" title="Notes" aria-label="Notes">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                ${notesCount ? `<span class="ins-notes-badge">${notesCount}</span>` : ''}
              </button>
              ${isPractice ? practiceAppearancePopHtml : `
                <button type="button" class="ins-hdr-ico ${s.optionsOpen ? 'active' : ''}" onclick="ListeningPracticeApp.toggleOptionsOverlay()" title="Options" aria-label="Options">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <button type="button" class="ins-hdr-exit" onclick="ListeningPracticeApp.exitExam()">Thoát</button>
              `}
            </div>
          </header>

          <!-- Official Listening Audio Strip (Washi styled in Practice · Official locked in Exam) -->
          ${renderAudioBarHtml(part, false)}

          ${!isPractice ? `
            <!-- Full-width Official Part Sub-Banner (flush above paper in Exam mode) -->
            <div class="ins-part-banner">
              <div class="lp-part-banner-row">
                <div>
                  <strong>Part ${part.partNum || 1}</strong>
                  <span>Listen and answer questions ${qMin}–${qMax}.</span>
                </div>
              </div>
            </div>
          ` : ''}

          <!-- Question Paper Body (Unified single-sheet layout — NO split card gap between Part banner & questions!) -->
          <div class="lp-ins-body ${isPractice ? 'lp-prac-desk' : ''}">
            ${isPractice ? `
              <div class="prac-sheet-shell lp-prac-folio">
                <div class="lp-prac-folio-head">
                  <div class="lp-part-banner-row">
                    <div>
                      <strong>Part ${part.partNum || 1}</strong>
                      <span>Listen and answer questions ${qMin}–${qMax}.</span>
                    </div>
                    <button type="button" class="prac-eyebrow-clear is-empty" id="lp-prac-hl-clear" disabled
                      onclick="ListeningPracticeApp.clearAllPaperHighlights()">
                      Xóa <span id="lp-prac-hl-cnt">0</span> màu
                    </button>
                  </div>
                </div>
                <main class="lp-ins-scroll">
                  <div class="lp-ins-paper" id="lp-ex-paper">${part.html || ''}</div>
                </main>
              </div>
            ` : `
              <main class="lp-ins-scroll">
                <div class="lp-ins-paper" id="lp-ex-paper">${part.html || ''}</div>
              </main>
            `}

            <!-- Official Floating 40x40px Prev / Next Square Arrows -->
            <div class="ins-float-arrows">
              <button type="button" class="ins-arrow-btn ${curGlobalIdx <= 0 ? 'is-disabled' : ''}"
                onclick="ListeningPracticeApp.stepQuestion(-1)" title="Previous question" ${curGlobalIdx <= 0 ? 'disabled' : ''}>←</button>
              <button type="button" class="ins-arrow-btn is-next ${curGlobalIdx >= allQs.length - 1 ? 'is-disabled' : ''}"
                onclick="ListeningPracticeApp.stepQuestion(1)" title="Next question" ${curGlobalIdx >= allQs.length - 1 ? 'disabled' : ''}>→</button>
            </div>
          </div>

          <!-- 48px Official Inspera / Totoro Practice Bottom Navigator Bar -->
          <footer class="ins-footer" id="lp-ins-footer">
            <div class="ins-footer-parts">${bottomPartsHtml}</div>
            ${isPractice ? `
              <button type="button" class="ins-submit-check-btn prac-submit-pill lp-ex-submit-btn" onclick="ListeningPracticeApp.submitExam()" title="Nộp bài kiểm tra kết quả" aria-label="Nộp bài">
                <span>Nộp bài →</span>
              </button>
            ` : `
              <button type="button" class="ins-submit-check-btn lp-ex-submit-btn" onclick="ListeningPracticeApp.submitExam()" title="Submit answers" aria-label="Submit answers">✓</button>
            `}
          </footer>
        </div>

        ${notesDrawerHtml}
        ${optionsOverlayHtml}
        ${selPopoverHtml}
      </div>
    `;

    bindPaperInputs();
    bindAudioPlayer(false);
    startExamTimer();
  }

  function gradeSession(s) {
    const map = DATA().PARTS || {};
    const parts = s.partIds.map((pid) => map[pid]).filter(Boolean);
    const userAns = s.answers || {};
    const rows = [];
    let totalCorrect = 0;
    let totalQuestions = 0;

    parts.forEach((pt) => {
      const pAns = pt.answers || [];
      let i = 0;
      while (i < pAns.length) {
        const cur = pAns[i];
        const off = String(cur.answer || '').trim();
        const isMultiLetters = /\//.test(off) && off.split('/').every((x) => /^[A-J]$/i.test(x.trim()));

        if (isMultiLetters && i + 1 < pAns.length && String(pAns[i + 1].answer || '').trim() === off) {
          const grp = [cur];
          while (i + 1 < pAns.length && String(pAns[i + 1].answer || '').trim() === off) {
            i++;
            grp.push(pAns[i]);
          }
          const validSet = new Set(off.split('/').map((x) => x.trim().toUpperCase()));
          const usedCorrect = new Set();
          grp.forEach((gItem) => {
            const uRaw = String(userAns[gItem.num] ?? '').trim();
            const uUp = uRaw.toUpperCase();
            let ok = false;
            if (uUp && validSet.has(uUp) && !usedCorrect.has(uUp)) {
              ok = true;
              usedCorrect.add(uUp);
            }
            if (ok) totalCorrect++;
            totalQuestions++;
            rows.push({ partNum: pt.partNum, partId: pt.id, num: gItem.num, user: uRaw, official: off, ok });
          });
        } else {
          const uRaw = String(userAns[cur.num] ?? '').trim();
          const ok = isSingleAnswerMatch(uRaw, off);
          if (ok) totalCorrect++;
          totalQuestions++;
          rows.push({ partNum: pt.partNum, partId: pt.id, num: cur.num, user: uRaw, official: off, ok });
        }
        i++;
      }
    });

    const elapsedSec = Math.max(1, Math.round((Date.now() - (s.startedAt || Date.now())) / 1000));
    const band = estimateListeningBand(totalCorrect, totalQuestions);
    return {
      itemId: s.itemId,
      isFull: s.isFull,
      mode: s.mode,
      title: s.title,
      partIds: s.partIds.slice(),
      activePartIdx: 0,
      rightTab: 'paper',
      activeQNum: rows[0]?.num || 1,
      transcriptQuery: '',
      score: totalCorrect,
      total: totalQuestions,
      band,
      elapsedSec,
      rows
    };
  }

  function extractSearchableAnswerTerms(officialStr) {
    const raw = String(officialStr || '').trim();
    if (!raw) return [];
    const variants = buildAcceptedVariants(raw);
    const out = [];
    const seen = new Set();
    variants.forEach((v) => {
      const clean = String(v || '').trim();
      if (!clean) return;
      // Skip bare single-letter MCQ keys (A, B, C, D...) to avoid noisy false matches in transcript
      if (/^[a-z]$/i.test(clean)) return;
      if (clean.length < 2 && !/^\d+$/.test(clean)) return;
      const low = clean.toLowerCase();
      if (!seen.has(low)) {
        seen.add(low);
        out.push(clean);
      }
    });
    return out.sort((a, b) => b.length - a.length);
  }

  function computeWordSpeechWeight(word) {
    const clean = String(word || '').replace(/[^a-zA-Z0-9]/g, '');
    let w = Math.max(2.1, clean.length * 0.85 + 1.4);
    if (/[.!?]["')\]]*$/.test(word)) w += 3.6;
    else if (/[,;:—–-]["')\]]*$/.test(word)) w += 1.7;
    return w;
  }

  let syncPackPromise = null;
  function getRealSyncCuesForPart(partId) {
    if (!partId) return null;
    const raw = window.__LISTENING_SYNC__?.[partId];
    return Array.isArray(raw) && raw.length ? raw : null;
  }

  function ensureListeningSyncPackLoaded(partId) {
    if (!partId || getRealSyncCuesForPart(partId)) return Promise.resolve(true);
    if (!/^lcam_(1[5-9]|20)_/i.test(String(partId))) return Promise.resolve(false);
    if (syncPackPromise) return syncPackPromise;
    syncPackPromise = new Promise((resolve) => {
      const sc = document.createElement('script');
      sc.src = 'data/listening_sync_cam15_20.js?v=20261128f';
      sc.async = true;
      sc.onload = () => resolve(Boolean(getRealSyncCuesForPart(partId)));
      sc.onerror = () => resolve(false);
      document.head.appendChild(sc);
    });
    return syncPackPromise;
  }

  function buildReviewTimelineFromSyncCues(syncCues) {
    if (!Array.isArray(syncCues) || !syncCues.length) return null;
    const turns = syncCues.map((c, idx) => {
      if (Array.isArray(c)) {
        const start = (Number(c[0]) || 0) / 10;
        const end = (Number(c[1]) || 0) / 10;
        const wArr = Array.isArray(c[2]) ? c[2] : [];
        const words = wArr.map((ws10, wi) => {
          const ws = (Number(ws10) || 0) / 10;
          const nextWs = wi + 1 < wArr.length ? (Number(wArr[wi + 1]) || 0) / 10 : end;
          return { start: ws, end: Math.max(ws + 0.06, nextWs) };
        });
        return { idx, start, end, words };
      }
      return {
        idx,
        start: Number(c.start) || 0,
        end: Number(c.end) || 0,
        words: Array.isArray(c.words) ? c.words : []
      };
    });
    const lastEnd = turns.length ? turns[turns.length - 1].end : 0;
    return { duration: lastEnd, turns, verified: true };
  }

  function updateTurnTimeLabels() {
    if (!reviewTimeline || !reviewTimeline.verified || !reviewTimeline.turns) return;
    reviewTimeline.turns.forEach((t) => {
      const el = document.querySelector(`.lp-yrev-turn[data-turn-idx="${t.idx}"] .lp-yrev-tmark`);
      if (el) el.textContent = formatMMSS(t.start);
    });
  }

  function rebuildReviewTimelineForDuration() {
    // Only use real verified audio sync cues; NEVER fabricate estimated linear timestamps
    // (real Cambridge MP3s contain 40-75s narrator intros, mid-part reading silences, and 30s end checks).
    const rev = state.lastReview;
    if (!rev || !rev._syncCues) {
      reviewTimeline = null;
      return;
    }
    reviewTimeline = buildReviewTimelineFromSyncCues(rev._syncCues);
    updateTurnTimeLabels();
  }

  function clearReviewKaraokeHighlight() {
    if (reviewActiveTurnIdx >= 0) {
      const prev = document.getElementById(`lp-yrev-turn-${reviewActiveTurnIdx}`);
      if (prev) {
        prev.classList.remove('is-speaking');
        prev.querySelectorAll('.lp-kw.is-spoken, .lp-kw.is-now').forEach((sp) => {
          sp.classList.remove('is-spoken', 'is-now');
        });
      }
      reviewActiveTurnIdx = -1;
    }
  }

  function syncReviewKaraokeAtTime(currentSec, allowAutoScroll = true) {
    if (!reviewTimeline || !reviewTimeline.verified || !reviewTimeline.turns.length) return;
    const t = Math.max(0, Number(currentSec) || 0);
    const turns = reviewTimeline.turns;

    // Find active turn ONLY within its real spoken window (stays clean during narrator intro / mid-part silence / outro!)
    let activeIdx = -1;
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      const nextStart = i + 1 < turns.length ? turns[i + 1].start : turn.end + 0.6;
      const gapToNext = nextStart - turn.end;
      const endBound = gapToNext > 3.5 ? turn.end + 0.45 : nextStart - 0.05;
      if (t >= turn.start - 0.15 && t <= endBound) {
        activeIdx = i;
        break;
      }
    }

    if (activeIdx !== reviewActiveTurnIdx) {
      if (reviewActiveTurnIdx >= 0) {
        const prevEl = document.getElementById(`lp-yrev-turn-${reviewActiveTurnIdx}`);
        if (prevEl) {
          prevEl.classList.remove('is-speaking');
          prevEl.querySelectorAll('.lp-kw.is-spoken, .lp-kw.is-now').forEach((sp) => {
            sp.classList.remove('is-spoken', 'is-now');
          });
        }
      }
      reviewActiveTurnIdx = activeIdx;
      if (activeIdx >= 0) {
        const curEl = document.getElementById(`lp-yrev-turn-${activeIdx}`);
        if (curEl) {
          curEl.classList.add('is-speaking');
          if (allowAutoScroll) {
            curEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
      }
    }

    if (activeIdx < 0) return;
    const turnObj = turns[activeIdx];
    const turnEl = document.getElementById(`lp-yrev-turn-${activeIdx}`);
    if (!turnEl) return;

    const kwNodes = turnEl.querySelectorAll('.lp-kw');
    const words = turnObj.words;
    for (let i = 0; i < kwNodes.length && i < words.length; i++) {
      const w = words[i];
      const node = kwNodes[i];
      const isNow = t >= w.start && t < w.end;
      const isSpoken = t >= w.end;
      node.classList.toggle('is-now', isNow);
      node.classList.toggle('is-spoken', isSpoken);
    }
  }

  function startReviewKaraokeLoop(audio) {
    stopReviewKaraoke();
    if (!audio || !reviewTimeline || !reviewTimeline.verified) return;
    const tick = () => {
      if (state.view !== 'review' || !audio || audio.paused || audio.ended || !reviewTimeline?.verified) {
        reviewKaraokeRaf = null;
        return;
      }
      syncReviewKaraokeAtTime(audio.currentTime || 0, true);
      reviewKaraokeRaf = requestAnimationFrame(tick);
    };
    reviewKaraokeRaf = requestAnimationFrame(tick);
  }

  function seekReviewTurn(turnIdx, autoPlay = true) {
    const rev = state.lastReview;
    if (!rev || !reviewTimeline || !reviewTimeline.verified) return;
    const idx = Number(turnIdx);
    const audio = document.getElementById('lp-ex-audio');
    const turn = reviewTimeline?.turns?.[idx];
    if (!turn) return;

    const targetTime = Math.max(0, turn.start + 0.04);
    if (audio && audio.readyState >= 1 && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.min(Math.max(0, audio.duration - 0.1), targetTime);
      syncReviewKaraokeAtTime(audio.currentTime, true);
      if (autoPlay && audio.paused) {
        const p = audio.play();
        if (p && p.catch) p.catch(() => {});
      }
    }
  }

  function splitLongMonologueLines(rawLines) {
    const out = [];
    rawLines.forEach((ln) => {
      const trimmed = String(ln || '').trim();
      if (!trimmed || /^[-—–=_*•.\s]{3,}$/.test(trimmed)) return;
      const hasSpk = /^([A-Z][a-zA-Z0-9 .'-]{1,22}:)\s*/.test(trimmed);
      if (hasSpk || trimmed.length <= 520) {
        out.push(trimmed);
        return;
      }
      // Split long unbroken monologue paragraphs cleanly every ~3-4 sentences (~420 chars)
      const sents = trimmed.match(/[^.!?]+[.!?]+["')\]]*(?:\s+|$)|[^.!?]+$/g) || [trimmed];
      let buf = '';
      let sentCount = 0;
      sents.forEach((s) => {
        const part = s.trim();
        if (!part) return;
        if (buf && (buf.length + part.length > 440 || sentCount >= 4)) {
          out.push(buf.trim());
          buf = part;
          sentCount = 1;
        } else {
          buf = buf ? `${buf} ${part}` : part;
          sentCount++;
        }
      });
      if (buf.trim()) out.push(buf.trim());
    });
    return out;
  }

  function buildTranscriptEvidenceHtml(transcript, partRows, query, hasRealSync = false) {
    if (!transcript) {
      return {
        html: '<div class="lp-yrev-empty-tr"><strong>Chưa có Transcript cho bài nghe này</strong><p>Bạn vẫn có thể nghe lại từng đoạn bằng thanh Audio phía trên và đối chiếu trực tiếp đáp án ở khung bên phải.</p></div>',
        matchedQSet: new Set(),
        turnMeta: []
      };
    }

    const rawLines = String(transcript).split('\n').filter((x) => x.trim());
    const lines = splitLongMonologueLines(rawLines);
    const matchedQSet = new Set();
    const lineSpans = lines.map(() => []);

    const sortedRows = (partRows || []).slice().sort((a, b) => Number(a.num) - Number(b.num));
    let searchFromLine = 0;

    sortedRows.forEach((row) => {
      const terms = extractSearchableAnswerTerms(row.official);
      if (!terms.length) return;

      const findInRange = (startIdx, endIdx) => {
        for (let li = startIdx; li < endIdx; li++) {
          const ln = lines[li];
          const spkM = ln.match(/^([A-Z][a-zA-Z0-9 .'-]{1,22}:)\s*/);
          const bodyStart = spkM ? spkM[0].length : 0;
          const bodyTxt = ln.slice(bodyStart);

          for (const term of terms) {
            const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
            const re = new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'i');
            const m = re.exec(bodyTxt);
            if (m) {
              const absStart = bodyStart + m.index;
              const absEnd = absStart + m[0].length;
              const overlaps = lineSpans[li].some((sp) => !(absEnd <= sp.start || absStart >= sp.end));
              if (!overlaps) {
                lineSpans[li].push({
                  start: absStart,
                  end: absEnd,
                  num: row.num,
                  ok: !!row.ok,
                  official: row.official
                });
                matchedQSet.add(Number(row.num));
                return li;
              }
            }
          }
        }
        return -1;
      };

      let hitLine = findInRange(searchFromLine, lines.length);
      if (hitLine < 0 && searchFromLine > 0) {
        hitLine = findInRange(0, searchFromLine);
      }
      if (hitLine >= 0) {
        searchFromLine = hitLine;
      }
    });

    const q = String(query || '').trim();
    const qRe = q.length >= 2 ? new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi') : null;
    const applyQueryMark = (rawStr) => {
      const safe = esc(rawStr);
      return qRe ? safe.replace(qRe, '<mark class="lp-tr-mark">$1</mark>') : safe;
    };

    const turnMeta = [];

    const html = lines.map((ln, li) => {
      const spkM = ln.match(/^([A-Z][a-zA-Z0-9 .'-]{1,22}:)\s*/);
      const spkLabel = spkM ? spkM[1].replace(/:$/, '').trim() : '';
      const bodyStart = spkM ? spkM[0].length : 0;

      const wordWeights = [];
      let wiCounter = 0;

      const wrapWords = (rawSlice) => {
        // Split keeping whitespace intact so layout & copy-paste stay natural
        return rawSlice.split(/(\s+)/).map((tok) => {
          if (!tok || /^\s+$/.test(tok)) return tok;
          const wi = wiCounter++;
          wordWeights.push(computeWordSpeechWeight(tok));
          return `<span class="lp-kw" data-wi="${wi}">${applyQueryMark(tok)}</span>`;
        }).join('');
      };

      const spans = lineSpans[li].slice().sort((a, b) => a.start - b.start);
      let cursor = bodyStart;
      let bodyHtml = '';
      spans.forEach((sp) => {
        if (sp.start > cursor) {
          bodyHtml += wrapWords(ln.slice(cursor, sp.start));
        }
        const sliceHtml = wrapWords(ln.slice(sp.start, sp.end));
        bodyHtml += `<mark class="lp-tr-ev ${sp.ok ? 'is-ok' : 'is-bad'}" id="lp-rev-ev-${sp.num}" data-ev-q="${sp.num}" onclick="event.stopPropagation(); ListeningPracticeApp.jumpReviewQuestion(${sp.num})" title="Dẫn chứng Câu ${sp.num} · Đáp án: ${esc(sp.official)}"><span class="lp-tr-ev-tag">Q${sp.num}</span>${sliceHtml}</mark>`;
        cursor = sp.end;
      });
      if (cursor < ln.length) {
        bodyHtml += wrapWords(ln.slice(cursor));
      }

      const totalWeight = wordWeights.reduce((a, b) => a + b, 0);
      turnMeta.push({ idx: li, wordWeights, totalWeight });

      const hasEv = spans.length > 0;
      const evNumsAttr = hasEv ? ` data-line-qs="${spans.map((s) => s.num).join(',')}"` : '';
      const spkTone = spkLabel
        ? (/^(MAN|MALE|TOM|JOHN|DAVID|MARK|ALEX|BEN|TUTOR|LECTURER|INTERVIEWER)/i.test(spkLabel) ? 'is-spk-b' : 'is-spk-a')
        : 'is-spk-a';

      const spkDisplay = spkLabel || (lines.length > 1 ? `ĐOẠN ${li + 1}` : 'AUDIO SCRIPT');
      return `
        <div class="lp-yrev-turn ${spkLabel ? '' : 'is-narration'} ${hasEv ? 'has-ev' : ''} ${hasRealSync ? '' : 'is-static'}"
          id="lp-yrev-turn-${li}" data-turn-idx="${li}"${evNumsAttr}
          ${hasRealSync ? `onclick="ListeningPracticeApp.seekReviewTurn(${li})" title="Nhấn để nghe từ lượt thoại này"` : ''}>
          <div class="lp-yrev-turn-head">
            <div class="lp-yrev-turn-id">
              <span class="lp-yrev-spk ${spkTone}">${esc(spkDisplay)}</span>
              ${hasRealSync ? '<span class="lp-yrev-eq" aria-hidden="true"><i></i><i></i><i></i></span>' : ''}
            </div>
            ${hasRealSync ? '<span class="lp-yrev-tmark tabular"></span>' : ''}
          </div>
          <p class="lp-yrev-txt">${bodyHtml}</p>
        </div>
      `;
    }).join('');

    return { html, matchedQSet, turnMeta };
  }

  function decorateReviewPaper(paper, partRows, matchedQSet) {
    if (!paper) return;
    enhanceListeningPaperLayout(paper);

    const rowMap = {};
    (partRows || []).forEach((r) => { rowMap[Number(r.num)] = r; });

    const makeLocBtn = (qNum) => {
      if (!matchedQSet || !matchedQSet.has(Number(qNum))) return null;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lp-rev-loc-btn';
      btn.title = `Xem dẫn chứng Câu ${qNum} trong Transcript`;
      btn.setAttribute('aria-label', `Xem dẫn chứng Câu ${qNum}`);
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        jumpReviewQuestion(qNum, true);
      });
      return btn;
    };

    // 1. Decorate text inputs (.lp-ex-gap)
    paper.querySelectorAll('input.lp-ex-gap[data-q]').forEach((inp) => {
      const qNum = Number(inp.getAttribute('data-q'));
      const row = rowMap[qNum];
      inp.readOnly = true;
      inp.disabled = true;
      if (!row) return;

      inp.value = row.user || '';
      if (!row.user) inp.placeholder = '—';
      inp.classList.add(row.ok ? 'is-rev-ok' : 'is-rev-bad');

      const wrap = document.createElement('span');
      wrap.className = `lp-rev-inline-wrap ${row.ok ? 'is-ok' : 'is-bad'}`;
      wrap.id = `lp-rev-q-${qNum}`;
      wrap.setAttribute('data-rev-q', String(qNum));
      wrap.addEventListener('click', () => jumpReviewQuestion(qNum, true));

      inp.parentNode.insertBefore(wrap, inp);
      wrap.appendChild(inp);

      const chip = document.createElement('span');
      chip.className = `lp-rev-ans-chip ${row.ok ? 'is-ok' : 'is-ans'}`;
      chip.textContent = row.ok ? '✓' : `✓ ${row.official}`;
      wrap.appendChild(chip);

      const loc = makeLocBtn(qNum);
      if (loc) wrap.appendChild(loc);
    });

    // 2. Decorate selects (.lp-ex-select)
    paper.querySelectorAll('select.lp-ex-select[data-q]').forEach((sel) => {
      const qNum = Number(sel.getAttribute('data-q'));
      const row = rowMap[qNum];
      sel.disabled = true;
      if (!row) return;
      sel.value = row.user || '';
      sel.classList.add(row.ok ? 'is-rev-ok' : 'is-rev-bad');

      const wrap = document.createElement('span');
      wrap.className = `lp-rev-inline-wrap ${row.ok ? 'is-ok' : 'is-bad'}`;
      wrap.id = `lp-rev-q-${qNum}`;
      wrap.setAttribute('data-rev-q', String(qNum));
      wrap.addEventListener('click', () => jumpReviewQuestion(qNum, true));

      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel);

      const chip = document.createElement('span');
      chip.className = `lp-rev-ans-chip ${row.ok ? 'is-ok' : 'is-ans'}`;
      chip.textContent = row.ok ? '✓' : `✓ ${row.official}`;
      wrap.appendChild(chip);

      const loc = makeLocBtn(qNum);
      if (loc) wrap.appendChild(loc);
    });

    // 3. Decorate Radio MCQ options (.lp-ex-radio)
    const anchoredQs = new Set();
    paper.querySelectorAll('input.lp-ex-radio[data-q]').forEach((rad) => {
      const qNum = Number(rad.getAttribute('data-q'));
      const val = String(rad.value || '').trim().toUpperCase();
      const row = rowMap[qNum];
      rad.disabled = true;
      if (!row) return;

      const userUp = String(row.user || '').trim().toUpperCase();
      const validSet = new Set(String(row.official || '').split('/').map((x) => x.trim().toUpperCase()).filter(Boolean));
      const isUserPick = Boolean(userUp && val === userUp);
      const isCorrectOpt = validSet.has(val);
      rad.checked = isUserPick;

      const lbl = rad.closest('label') || rad.parentElement;
      if (lbl) {
        if (!anchoredQs.has(qNum)) {
          anchoredQs.add(qNum);
          if (!document.getElementById(`lp-rev-q-${qNum}`)) {
            const container = lbl.closest('.lp-ex-q-inline, .lp-cam-group, li, p') || lbl;
            if (!container.id) container.id = `lp-rev-q-${qNum}`;
          }
        }
        lbl.classList.remove('is-selected');
        if (isUserPick && row.ok) {
          lbl.classList.add('is-rev-ok');
          lbl.insertAdjacentHTML('beforeend', '<span class="lp-rev-opt-tag is-ok">✓ Đúng</span>');
        } else if (isUserPick && !row.ok) {
          lbl.classList.add('is-rev-bad');
          lbl.insertAdjacentHTML('beforeend', '<span class="lp-rev-opt-tag is-bad">✕ Bạn chọn</span>');
        } else if (isCorrectOpt) {
          lbl.classList.add('is-rev-correct');
          lbl.insertAdjacentHTML('beforeend', '<span class="lp-rev-opt-tag is-ans">✓ Đáp án đúng</span>');
        }
        lbl.addEventListener('click', () => jumpReviewQuestion(qNum, true));
      }
    });

    // 4. Decorate Checkbox Multi-Select options (.lp-ex-check — supports both data-multi and data-qnums!)
    paper.querySelectorAll('input.lp-ex-check[data-multi], input.lp-ex-check[data-qnums]').forEach((chk) => {
      const rawCsv = chk.getAttribute('data-multi') || chk.getAttribute('data-qnums') || '';
      const qnums = String(rawCsv).split(',').map((n) => Number(n.trim())).filter(Boolean);
      const val = String(chk.value || '').trim().toUpperCase();
      chk.disabled = true;
      if (!qnums.length) return;
      const firstQ = qnums[0];
      const rowsGrp = qnums.map((n) => rowMap[n]).filter(Boolean);
      if (!rowsGrp.length) return;

      const userSet = new Set(rowsGrp.map((r) => String(r.user || '').trim().toUpperCase()).filter(Boolean));
      const validSet = new Set(String(rowsGrp[0].official || '').split('/').map((x) => x.trim().toUpperCase()).filter(Boolean));
      const isUserPick = userSet.has(val);
      const isCorrectOpt = validSet.has(val);
      chk.checked = isUserPick;

      const lbl = chk.closest('label') || chk.parentElement;
      if (lbl) {
        qnums.forEach((qn) => {
          if (!anchoredQs.has(qn)) {
            anchoredQs.add(qn);
            if (!document.getElementById(`lp-rev-q-${qn}`)) {
              const container = lbl.closest('.lp-ex-q-inline, .lp-cam-group') || lbl;
              if (!container.id) container.id = `lp-rev-q-${qn}`;
            }
          }
        });
        lbl.classList.remove('is-selected');
        if (isUserPick && isCorrectOpt) {
          lbl.classList.add('is-rev-ok');
          lbl.insertAdjacentHTML('beforeend', '<span class="lp-rev-opt-tag is-ok">✓ Đúng</span>');
        } else if (isUserPick && !isCorrectOpt) {
          lbl.classList.add('is-rev-bad');
          lbl.insertAdjacentHTML('beforeend', '<span class="lp-rev-opt-tag is-bad">✕ Bạn chọn</span>');
        } else if (isCorrectOpt) {
          lbl.classList.add('is-rev-correct');
          lbl.insertAdjacentHTML('beforeend', '<span class="lp-rev-opt-tag is-ans">✓ Đáp án đúng</span>');
        }
        lbl.addEventListener('click', () => jumpReviewQuestion(firstQ, true));
      }
    });

    // 5. Decorate CD-IELTS Drag-and-Drop Matching zones (.lp-dd-zone[data-q]) in Review Mode
    paper.querySelectorAll('.lp-dd-split').forEach((split) => {
      const optMap = {};
      split.querySelectorAll('.lp-dd-opt[data-dd-letter]').forEach((opt) => {
        opt.setAttribute('draggable', 'false');
        opt.classList.add('is-rev-static');
        const lt = String(opt.getAttribute('data-dd-letter') || '').trim().toUpperCase();
        optMap[lt] = opt.getAttribute('data-dd-text') || '';
      });
      split.querySelectorAll('.lp-dd-zone[data-q]').forEach((zone) => {
        const qNum = Number(zone.getAttribute('data-q'));
        const row = rowMap[qNum];
        if (!row) return;
        zone.id = `lp-rev-q-${qNum}`;
        zone.classList.add(row.ok ? 'is-rev-ok' : 'is-rev-bad');
        const uVal = String(row.user || '').trim().toUpperCase();
        const offVal = String(row.official || '').trim().toUpperCase();
        const uTxt = uVal ? (optMap[uVal] || '') : '';
        const offTxt = optMap[offVal] || '';

        if (row.ok) {
          zone.innerHTML = `<span class="lp-dd-val-key">${esc(uVal)}</span><span class="lp-dd-val-txt">${esc(uTxt)}</span><span class="lp-rev-ans-chip is-ok">✓</span>`;
        } else {
          zone.innerHTML = uVal
            ? `<span class="lp-dd-val-key is-bad">${esc(uVal)}</span><span class="lp-dd-val-txt is-bad">${esc(uTxt)}</span>`
            : `<span class="lp-dd-qnum">${qNum}</span><span class="lp-dd-ph">Bỏ trống</span>`;
          const ansChip = document.createElement('span');
          ansChip.className = 'lp-rev-ans-chip is-ans';
          ansChip.textContent = offTxt ? `✓ ${offVal}. ${offTxt}` : `✓ ${row.official}`;
          zone.parentElement?.appendChild(ansChip);
        }
        zone.addEventListener('click', () => jumpReviewQuestion(qNum, true));
      });
    });

    // Enable diagram lightbox click in review mode too
    paper.querySelectorAll('img').forEach((img) => {
      img.classList.add('lp-ex-diagram');
      img.title = 'Nhấn để phóng to sơ đồ / bản đồ';
      img.addEventListener('click', () => openDiagramLightbox(img.src, img.alt));
    });
  }

  function renderReviewSummaryTableHtml(partRows, matchedQSet, activeQNum) {
    return `
      <div class="lp-yrev-sum-wrap">
        <table class="lp-yrev-sum-table">
          <thead>
            <tr>
              <th style="width:62px;">Câu</th>
              <th>Bạn điền</th>
              <th>Đáp án chuẩn</th>
              <th style="width:92px;">Kết quả</th>
              <th style="width:128px;">Dẫn chứng</th>
            </tr>
          </thead>
          <tbody>
            ${partRows.map((r) => {
              const hasEv = matchedQSet && matchedQSet.has(Number(r.num));
              const isAct = Number(activeQNum) === Number(r.num);
              return `
                <tr id="lp-rev-row-${r.num}" class="${r.ok ? 'is-ok' : 'is-bad'} ${isAct ? 'is-active' : ''}" onclick="ListeningPracticeApp.jumpReviewQuestion(${r.num}, true)">
                  <td class="tabular"><span class="lp-yrev-qbadge ${r.ok ? 'is-ok' : 'is-bad'}">${r.num}</span></td>
                  <td>${r.user ? `<span class="lp-yrev-userval ${r.ok ? 'is-ok' : 'is-bad'}">${esc(r.user)}</span>` : '<span class="lp-rev-blank">Bỏ trống</span>'}</td>
                  <td class="lp-rev-off">${esc(r.official)}</td>
                  <td><span class="lp-yrev-stpill ${r.ok ? 'is-ok' : 'is-bad'}">${r.ok ? '✓ Đúng' : '✕ Sai'}</span></td>
                  <td>
                    ${hasEv
                      ? `<button type="button" class="lp-yrev-evbtn" onclick="event.stopPropagation(); ListeningPracticeApp.jumpReviewQuestion(${r.num}, true)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg><span>Xem câu</span></button>`
                      : '<span class="lp-rev-blank">—</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderReviewView() {
    const root = getRoot();
    const rev = state.lastReview;
    if (!root || !rev) {
      document.body.classList.remove('lp-exam-fullscreen');
      openSource(state.source);
      return;
    }

    document.body.classList.add('lp-exam-fullscreen');
    const map = DATA().PARTS || {};
    const parts = rev.partIds.map((pid) => map[pid]).filter(Boolean);
    const activePart = parts[rev.activePartIdx || 0] || parts[0];
    const pct = rev.total ? Math.round((rev.score / rev.total) * 100) : 0;
    const partRows = parts.length > 1
      ? rev.rows.filter((r) => r.partId === activePart?.id)
      : rev.rows;
    const partOkCount = partRows.filter((r) => r.ok).length;
    const partBadCount = partRows.length - partOkCount;
    const rightTab = rev.rightTab === 'summary' ? 'summary' : 'paper';

    const rawSyncCues = activePart?.syncCues || getRealSyncCuesForPart(activePart?.id);
    const hasRealSync = Array.isArray(rawSyncCues) && rawSyncCues.length > 0;
    const trBuilt = buildTranscriptEvidenceHtml(activePart?.transcript || '', partRows, rev.transcriptQuery || '', hasRealSync);
    // Verify turn count matches before enabling real sync
    const syncValid = hasRealSync && rawSyncCues.length === trBuilt.turnMeta.length;
    rev._matchedQSet = trBuilt.matchedQSet;
    rev._turnMeta = trBuilt.turnMeta;
    rev._syncCues = syncValid ? rawSyncCues : null;
    reviewActiveTurnIdx = -1;
    reviewTimeline = syncValid ? buildReviewTimelineFromSyncCues(rawSyncCues) : null;

    if (!syncValid && activePart?.id && /^lcam_(1[5-9]|20)_/i.test(activePart.id) && !window.__LISTENING_SYNC__?.[activePart.id]) {
      const targetPid = activePart.id;
      ensureListeningSyncPackLoaded(targetPid).then((loaded) => {
        if (loaded && state.view === 'review' && state.lastReview === rev) {
          const curP = (state.lastReview.partIds || []).map((id) => (DATA().PARTS || {})[id])[state.lastReview.activePartIdx || 0];
          if (curP?.id === targetPid) renderReviewView();
        }
      });
    }

    const bandTone = rev.band >= 7.0 ? 'is-high' : (rev.band >= 5.5 ? 'is-mid' : 'is-low');

    const bottomPartsHtml = parts.map((pt, pIdx) => {
      const isCur = pIdx === (rev.activePartIdx || 0);
      const pRows = rev.rows.filter((r) => r.partId === pt.id);
      const pOk = pRows.filter((r) => r.ok).length;
      if (!isCur) {
        return `
          <div class="ins-fpart-tab" onclick="ListeningPracticeApp.switchReviewPart(${pIdx})">
            <span class="ins-fpart-lbl">Part ${pt.partNum || pIdx + 1}</span>
            <span class="ins-fpart-stat tabular">${pOk}/${pRows.length}</span>
          </div>
        `;
      }
      return `
        <div class="ins-fpart-group is-active">
          <button type="button" class="ins-fpart-btn" onclick="ListeningPracticeApp.switchReviewPart(${pIdx})">
            <strong>Part ${pt.partNum || pIdx + 1}</strong>
          </button>
          <div class="lp-yrev-qstrip">
            ${pRows.map((r) => `
              <button type="button"
                class="lp-yrev-qpill ${r.ok ? 'is-ok' : 'is-bad'} ${Number(rev.activeQNum) === Number(r.num) ? 'is-active' : ''}"
                data-rev-pill="${r.num}"
                onclick="ListeningPracticeApp.jumpReviewQuestion(${r.num}, true)"
                title="Câu ${r.num}: ${r.ok ? 'Đúng' : `Sai · Đáp án: ${esc(r.official)}`}">
                ${r.num}
              </button>
            `).join('')}
          </div>
        </div>
      `;
    }).join('');

    const clockIcoSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
    const docIcoSvg = '<svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>';
    const listIcoSvg = '<svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="9" y1="10" x2="9" y2="20"/></svg>';
    const retryIcoSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>';
    const searchIcoSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>';

    root.innerHTML = `
      <div class="ins-shell lp-ins-shell ins-mode-practice lp-yrev-shell is-washi-rev ins-contrast-totoro ins-size-regular">
        <div class="ins-main-col">
          <!-- Warm Totoro Washi Review Header -->
          <header class="ins-header lp-yrev-header">
            <div class="ins-hdr-left">
              <button type="button" class="prac-back-btn" onclick="ListeningPracticeApp.backToSourceFromReview()" title="Quay về kho đề">
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
              <div class="ins-hdr-meta">
                <div class="ins-hdr-title">${esc(rev.title)}</div>
                <div class="lp-yrev-sub">${syncValid
                  ? 'Xem lại bài làm · Nhấn từng lượt thoại để nghe &amp; theo dõi chữ chạy khớp 100% Audio'
                  : 'Xem lại bài làm · Đối chiếu Audio Script &amp; Đáp án · Dùng thanh Audio −5s / +5s để tua nghe lại'}</div>
              </div>
            </div>

            <div class="lp-yrev-hdr-right">
              <div class="lp-yrev-kpis">
                <span class="lp-yrev-kpi is-band ${bandTone}">
                  <small>Band</small><strong class="tabular">${rev.band.toFixed(1)}</strong>
                </span>
                <span class="lp-yrev-kpi is-score">
                  <strong class="tabular">${rev.score}/${rev.total}</strong><small>đúng (${pct}%)</small>
                </span>
                <span class="lp-yrev-kpi is-time tabular">${clockIcoSvg}<span>${formatMMSS(rev.elapsedSec)}</span></span>
              </div>
              <button type="button" class="lp-yrev-retry-btn" onclick="ListeningPracticeApp.startItem('${esc(rev.itemId)}', ${rev.isFull ? 'true' : 'false'}, '${esc(rev.mode)}')">
                ${retryIcoSvg}<span>Làm lại</span>
              </button>
            </div>
          </header>

          <!-- Full-width Washi Forest Audio Player Bar -->
          ${activePart ? renderAudioBarHtml(activePart, true) : ''}

          <!-- Full-Viewport 2-Column Split Workbench: LEFT = Karaoke Script | RIGHT = Graded Question Paper -->
          <div class="lp-yrev-split">
            <section class="lp-yrev-pane is-transcript">
              <div class="lp-yrev-pane-head">
                <div class="lp-yrev-pane-title">
                  <h3>Audio Script · Part ${activePart?.partNum || 1}</h3>
                  ${syncValid ? '<span class="lp-yrev-ev-chip" title="Đã căn khớp chính xác từng từ trực tiếp từ file MP3 thật">✓ Khớp Audio</span>' : ''}
                  ${trBuilt.matchedQSet.size > 0
                    ? `<span class="lp-yrev-ev-chip tabular">${trBuilt.matchedQSet.size}/${partRows.length} dẫn chứng</span>`
                    : ''}
                </div>
                <div class="lp-yrev-search-wrap">
                  ${searchIcoSvg}
                  <input type="search" class="lp-tr-search" value="${esc(rev.transcriptQuery || '')}" placeholder="Tìm trong transcript..." oninput="ListeningPracticeApp.onTranscriptSearch(this.value)" autocomplete="off">
                </div>
              </div>
              <div class="lp-yrev-pane-body lp-yrev-tr-body" id="lp-rev-transcript">
                ${trBuilt.html}
              </div>
            </section>

            <section class="lp-yrev-pane is-paper">
              <div class="lp-yrev-pane-head">
                <div class="lp-yrev-seg" role="tablist">
                  <button type="button" role="tab" class="lp-yrev-seg-btn ${rightTab === 'paper' ? 'active' : ''}" onclick="ListeningPracticeApp.switchReviewRightTab('paper')">
                    ${docIcoSvg}<span>Đề thi &amp; Đáp án</span>
                  </button>
                  <button type="button" role="tab" class="lp-yrev-seg-btn ${rightTab === 'summary' ? 'active' : ''}" onclick="ListeningPracticeApp.switchReviewRightTab('summary')">
                    ${listIcoSvg}<span>Bảng tổng hợp</span>
                  </button>
                </div>
                <div class="lp-yrev-stat-pills tabular">
                  <span class="lp-yrev-pill is-ok">✓ ${partOkCount} đúng</span>
                  <span class="lp-yrev-pill is-bad">✕ ${partBadCount} sai</span>
                </div>
              </div>
              <div class="lp-yrev-pane-body lp-yrev-paper-body" id="lp-rev-right-body">
                ${rightTab === 'paper'
                  ? `<div class="lp-ins-paper lp-yrev-paper" id="lp-rev-paper">${activePart?.html || ''}</div>`
                  : renderReviewSummaryTableHtml(partRows, trBuilt.matchedQSet, rev.activeQNum)}
              </div>
            </section>
          </div>

          <!-- Sticky Bottom Question Navigator Bar -->
          <footer class="ins-footer lp-yrev-footer">
            <div class="ins-footer-parts">${bottomPartsHtml}</div>
            <div class="lp-yrev-foot-legend">
              <span class="lp-yrev-leg"><i class="is-ok"></i>Đúng</span>
              <span class="lp-yrev-leg"><i class="is-bad"></i>Sai / Trống</span>
              <span class="lp-yrev-leg-hint">Nhấn số câu để nhảy tới dẫn chứng</span>
            </div>
          </footer>
        </div>
      </div>
    `;

    if (rightTab === 'paper') {
      const revPaper = document.getElementById('lp-rev-paper');
      decorateReviewPaper(revPaper, partRows, trBuilt.matchedQSet);
    }
    bindAudioPlayer(true);
    updateTurnTimeLabels();
  }

  function switchReviewRightTab(tab) {
    const rev = state.lastReview;
    if (!rev) return;
    rev.rightTab = tab === 'summary' ? 'summary' : 'paper';
    const rightBody = document.getElementById('lp-rev-right-body');
    const map = DATA().PARTS || {};
    const parts = rev.partIds.map((pid) => map[pid]).filter(Boolean);
    const activePart = parts[rev.activePartIdx || 0] || parts[0];
    const partRows = parts.length > 1 ? rev.rows.filter((r) => r.partId === activePart?.id) : rev.rows;

    document.querySelectorAll('.lp-yrev-seg-btn').forEach((btn, idx) => {
      btn.classList.toggle('active', (idx === 0 && rev.rightTab === 'paper') || (idx === 1 && rev.rightTab === 'summary'));
    });

    if (rightBody) {
      if (rev.rightTab === 'paper') {
        rightBody.innerHTML = `<div class="lp-ins-paper lp-yrev-paper" id="lp-rev-paper">${activePart?.html || ''}</div>`;
        decorateReviewPaper(document.getElementById('lp-rev-paper'), partRows, rev._matchedQSet);
      } else {
        rightBody.innerHTML = renderReviewSummaryTableHtml(partRows, rev._matchedQSet, rev.activeQNum);
      }
    }
  }

  function jumpReviewQuestion(qNum, scrollTranscript = true) {
    const rev = state.lastReview;
    if (!rev) return;
    const num = Number(qNum);
    rev.activeQNum = num;

    document.querySelectorAll('[data-rev-pill]').forEach((btn) => {
      btn.classList.toggle('is-active', Number(btn.getAttribute('data-rev-pill')) === num);
    });

    // Scroll & pulse target in right pane (paper or summary row)
    const targetRight = document.getElementById(rev.rightTab === 'summary' ? `lp-rev-row-${num}` : `lp-rev-q-${num}`);
    if (targetRight) {
      targetRight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetRight.classList.remove('lp-yrev-pulse');
      void targetRight.offsetWidth;
      targetRight.classList.add('lp-yrev-pulse');
    }

    // Scroll & pulse matching evidence in left transcript pane
    if (scrollTranscript) {
      const evEl = document.getElementById(`lp-rev-ev-${num}`);
      if (evEl) {
        evEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        evEl.classList.remove('lp-yrev-pulse');
        void evEl.offsetWidth;
        evEl.classList.add('lp-yrev-pulse');
      }
    }
  }

  function startItem(itemId, isFull, mode) {
    const d = DATA();
    const useMode = mode === 'exam' ? 'exam' : 'practice';
    let partIds = [];
    let title = '';
    let durationMin = 7;

    if (isFull) {
      const ft = (d.FULL_TESTS || []).find((x) => x.id === itemId);
      if (!ft || !Array.isArray(ft.partIds) || !ft.partIds.length) {
        toast('Đề FULL TEST này chưa có dữ liệu.');
        return;
      }
      const firstPart = d.PARTS?.[ft.partIds[0]];
      if (firstPart?.taskId && window.ListeningTasksModule?.openExam) {
        window.ListeningTasksModule.openExam(firstPart.taskId, 3, { fromPractice: true, mode: useMode });
        return;
      }
      partIds = ft.partIds.filter((pid) => !!d.PARTS?.[pid]);
      title = ft.title || 'IELTS Listening FULL TEST';
      durationMin = Number(ft.durationMin) || 30;
    } else {
      const part = d.PARTS?.[itemId];
      if (!part) {
        toast('Bài nghe này chưa có dữ liệu.');
        return;
      }
      if (part.taskId && window.ListeningTasksModule?.openExam) {
        window.ListeningTasksModule.openExam(part.taskId, 3, { fromPractice: true, mode: useMode });
        return;
      }
      partIds = [part.id];
      title = part.title || `Part ${part.partNum || 1}`;
      durationMin = Number(part.durationMin) || (part.partNum >= 3 ? 8 : 7);
    }

    const firstPartObj = d.PARTS?.[partIds[0]];
    const firstQ = firstPartObj?.answers?.[0]?.num || 1;

    stopExamTimer();
    stopActiveAudio();
    state.session = {
      itemId,
      isFull: !!isFull,
      mode: useMode,
      title,
      partIds,
      activePartIdx: 0,
      activeQNum: firstQ,
      contrast: useMode === 'practice' ? 'totoro' : 'cd',
      textSize: 'regular',
      activePenColor: 'yellow',
      showTimer: true,
      optionsOpen: false,
      notesOpen: false,
      notes: [],
      pendingQuote: '',
      paused: false,
      answers: {},
      durationSec: durationMin * 60,
      remainingSec: durationMin * 60,
      startedAt: Date.now()
    };
    state.view = 'exam';
    render();
  }

  function switchExamPart(idx, autoPlay) {
    if (!state.session) return;
    const maxIdx = Math.max(0, state.session.partIds.length - 1);
    const nextIdx = Math.max(0, Math.min(maxIdx, Number(idx) || 0));
    if (nextIdx === state.session.activePartIdx && !autoPlay) return;
    stopActiveAudio();
    state.session.activePartIdx = nextIdx;
    const pt = getActivePart();
    if (pt?.answers?.[0]?.num) state.session.activeQNum = pt.answers[0].num;
    renderExamView();
    if (autoPlay) {
      const a = document.getElementById('lp-ex-audio');
      if (a) a.play().catch(() => {});
    }
  }

  function focusQuestion(qNum) {
    if (state.session) {
      state.session.activeQNum = Number(qNum);
      refreshBottomNavStates();
    }
    const paper = document.getElementById('lp-ex-paper');
    if (!paper) return;
    let target = paper.querySelector(`[data-q="${qNum}"]`);
    if (!target) {
      target = Array.from(paper.querySelectorAll('input.lp-ex-check')).find((el) =>
        (el.getAttribute('data-multi') || '').split(',').map((x) => x.trim()).includes(String(qNum))
      );
    }
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      try { target.focus({ preventScroll: true }); } catch (_) {}
    }
  }

  function stepQuestion(delta) {
    if (!state.session) return;
    const allQs = getAllSessionQNums();
    if (!allQs.length) return;
    const curIdx = Math.max(0, allQs.findIndex((x) => x.num === Number(state.session.activeQNum || allQs[0].num)));
    const nextIdx = Math.max(0, Math.min(allQs.length - 1, curIdx + Number(delta || 1)));
    const target = allQs[nextIdx];
    if (!target) return;
    state.session.activeQNum = target.num;
    if (target.pIdx !== state.session.activePartIdx) {
      stopActiveAudio();
      state.session.activePartIdx = target.pIdx;
      renderExamView();
      setTimeout(() => focusQuestion(target.num), 40);
    } else {
      focusQuestion(target.num);
    }
  }

  function togglePauseTimer() {
    if (!state.session || state.session.mode !== 'practice') return;
    state.session.paused = !state.session.paused;
    renderExamView();
  }

  function toggleTimerVisibility() {
    if (!state.session || state.session.mode !== 'practice') return;
    state.session.showTimer = state.session.showTimer === false ? true : false;
    renderExamView();
  }

  function toggleOptionsOverlay(force) {
    if (!state.session) return;
    state.session.optionsOpen = typeof force === 'boolean' ? force : !state.session.optionsOpen;
    renderExamView();
  }

  function toggleNotesDrawer(force) {
    if (!state.session) return;
    state.session.notesOpen = typeof force === 'boolean' ? force : !state.session.notesOpen;
    renderExamView();
  }

  function addManualNote(ev) {
    if (ev) ev.preventDefault();
    if (!state.session) return;
    const ta = document.getElementById('lp-note-input');
    const txt = String(ta?.value || '').trim();
    if (!txt) return;
    state.session.notes = state.session.notes || [];
    state.session.notes.unshift({
      id: 'ln_' + Date.now().toString(36),
      quote: state.session.pendingQuote || '',
      text: txt
    });
    state.session.pendingQuote = '';
    renderExamView();
  }

  function deleteNote(id) {
    if (!state.session) return;
    state.session.notes = (state.session.notes || []).filter((n) => n.id !== id);
    renderExamView();
  }

  function setContrast(preset) {
    if (!state.session) return;
    state.session.contrast = ['cd', 'totoro', 'sepia', 'dark', 'yellow'].includes(preset) ? preset : 'cd';
    renderExamView();
  }

  function setTextSize(sz) {
    if (!state.session) return;
    state.session.textSize = ['regular', 'large', 'xlarge'].includes(sz) ? sz : 'regular';
    renderExamView();
  }

  function openTeacherReview(itemId, isFull) {
    if (!(B()?.isTeacherUser?.() || B()?.isTeacherMode?.() || B()?.isTeacherPreviewing?.())) return;
    const d = DATA();
    let partIds = [];
    let title = '';
    let durationMin = 7;
    if (isFull) {
      const ft = (d.FULL_TESTS || []).find((x) => x.id === itemId);
      if (!ft || !Array.isArray(ft.partIds) || !ft.partIds.length) {
        toast('Đề FULL TEST này chưa có dữ liệu.');
        return;
      }
      partIds = ft.partIds.filter((pid) => !!d.PARTS?.[pid]);
      title = ft.title || 'IELTS Listening FULL TEST';
      durationMin = Number(ft.durationMin) || 30;
    } else {
      const part = d.PARTS?.[itemId];
      if (!part) {
        toast('Bài nghe này chưa có dữ liệu.');
        return;
      }
      partIds = [part.id];
      title = part.title || `Part ${part.partNum || 1}`;
      durationMin = Number(part.durationMin) || (part.partNum >= 3 ? 8 : 7);
    }
    stopExamTimer();
    stopActiveAudio();
    const dummySession = {
      itemId,
      isFull: !!isFull,
      mode: 'practice',
      title,
      partIds,
      activePartIdx: 0,
      activeQNum: d.PARTS?.[partIds[0]]?.answers?.[0]?.num || 1,
      answers: {},
      startedAt: Date.now(),
      durationSec: durationMin * 60,
      remainingSec: durationMin * 60
    };
    const result = gradeSession(dummySession);
    state.lastReview = result;
    state.session = null;
    state.view = 'review';
    document.body.classList.add('lp-exam-fullscreen');
    render();
  }

  function openTeacherReviewFromExam() {
    if (!state.session) return;
    if (!(B()?.isTeacherUser?.() || B()?.isTeacherMode?.() || B()?.isTeacherPreviewing?.())) return;
    stopExamTimer();
    stopActiveAudio();
    const result = gradeSession(state.session);
    state.lastReview = result;
    state.session = null;
    state.view = 'review';
    render();
  }

  function submitExam(force) {
    if (!state.session) return;
    const parts = getSessionParts();
    const totalQ = parts.reduce((acc, p) => acc + (p.answers || []).length, 0);
    const answeredQ = parts.reduce((acc, p) => acc + getPartAnsweredCount(p), 0);
    if (!force && answeredQ < totalQ) {
      const ok = window.confirm(`Bạn đã điền ${answeredQ}/${totalQ} câu. Xác nhận nộp bài và xem đáp án ngay?`);
      if (!ok) return;
    }
    stopExamTimer();
    stopActiveAudio();
    const result = gradeSession(state.session);
    ListeningPracticeStore.recordAttempt(result);
    state.lastReview = result;
    state.session = null;
    state.view = 'review';
    render();
  }

  function exitExam() {
    if (state.session) {
      const parts = getSessionParts();
      const answeredQ = parts.reduce((acc, p) => acc + getPartAnsweredCount(p), 0);
      if (answeredQ > 0) {
        const ok = window.confirm('Thoát khỏi bài thi hiện tại? Các câu bạn đang điền sẽ không được lưu.');
        if (!ok) return;
      }
    }
    stopExamTimer();
    stopActiveAudio();
    document.body.classList.remove('lp-exam-fullscreen');
    state.session = null;
    state.view = 'source';
    render();
  }

  function switchReviewPart(idx) {
    if (!state.lastReview) return;
    stopActiveAudio();
    state.lastReview.activePartIdx = Math.max(0, Math.min(state.lastReview.partIds.length - 1, Number(idx) || 0));
    renderReviewView();
  }

  function onTranscriptSearch(val) {
    if (!state.lastReview) return;
    state.lastReview.transcriptQuery = String(val || '');
    const box = document.getElementById('lp-rev-transcript');
    const map = DATA().PARTS || {};
    const parts = state.lastReview.partIds.map((pid) => map[pid]).filter(Boolean);
    const activePart = parts[state.lastReview.activePartIdx || 0] || parts[0];
    const partRows = parts.length > 1
      ? state.lastReview.rows.filter((r) => r.partId === activePart?.id)
      : state.lastReview.rows;
    if (box) {
      const rawSyncCues = activePart?.syncCues || getRealSyncCuesForPart(activePart?.id);
      const hasRealSync = Array.isArray(rawSyncCues) && rawSyncCues.length > 0;
      const built = buildTranscriptEvidenceHtml(activePart?.transcript || '', partRows, state.lastReview.transcriptQuery, hasRealSync);
      const syncValid = hasRealSync && rawSyncCues.length === built.turnMeta.length;
      state.lastReview._matchedQSet = built.matchedQSet;
      state.lastReview._turnMeta = built.turnMeta;
      state.lastReview._syncCues = syncValid ? rawSyncCues : null;
      reviewActiveTurnIdx = -1;
      const audio = document.getElementById('lp-ex-audio');
      reviewTimeline = syncValid ? buildReviewTimelineFromSyncCues(rawSyncCues) : null;
      box.innerHTML = built.html;
      updateTurnTimeLabels();
      if (syncValid && audio && audio.currentTime > 0) {
        syncReviewKaraokeAtTime(audio.currentTime, false);
      }
    }
  }

  function backToSourceFromReview() {
    stopActiveAudio();
    document.body.classList.remove('lp-exam-fullscreen');
    state.view = 'source';
    render();
  }

  function render() {
    if (state.view === 'exam' && state.session) {
      renderExamView();
    } else if (state.view === 'review' && state.lastReview) {
      renderReviewView();
    } else if (state.view === 'source') {
      document.body.classList.remove('lp-exam-fullscreen');
      stopExamTimer();
      stopActiveAudio();
      renderHub();
    } else {
      document.body.classList.remove('lp-exam-fullscreen');
      stopExamTimer();
      stopActiveAudio();
      renderPortal();
    }
  }

  document.addEventListener('click', () => {
    if (state.actualFilterOpen) {
      state.actualFilterOpen = false;
      if (state.view === 'source' && state.source === 'actual') render();
    }
  });

  window.ListeningPracticeApp = {
    render,
    openPortal,
    openSource,
    setCamGroup,
    selectBook,
    selectTestNum,
    setActualTab,
    onActualSearch,
    toggleActualFilter,
    toggleActualQType,
    launchListeningSpeedQuiz,
    openSignalDeck,
    startItem,
    ensureSourceBankLoaded,
    openAssignedItem: async (itemId, isFull, mode = 'practice') => {
      const cleanId = String(itemId || '').trim();
      if (!cleanId) return;
      const src = /^lvol/i.test(cleanId) ? 'volume' : (/^l?act/i.test(cleanId) ? 'actual' : 'cambridge');
      window.TotoroUI?.setListeningPracticeSub?.('exams');
      window.TotoroUI?.enterSkillMode?.('Listening', 'practice');
      await ensureSourceBankLoaded(src);
      startItem(cleanId, !!isFull, mode === 'exam' ? 'exam' : 'practice');
    },
    switchExamPart,
    focusQuestion,
    stepQuestion,
    togglePauseTimer,
    toggleTimerVisibility,
    toggleOptionsOverlay,
    toggleNotesDrawer,
    addManualNote,
    deleteNote,
    setContrast,
    setTextSize,
    applyExamHighlight,
    clearExamHighlight,
    clearAllPaperHighlights,
    addNoteFromSelection,
    openTeacherReview,
    openTeacherReviewFromExam,
    submitExam,
    exitExam,
    switchReviewPart,
    switchReviewRightTab,
    jumpReviewQuestion,
    seekReviewTurn,
    syncReviewKaraokeAtTime,
    onTranscriptSearch,
    backToSourceFromReview,
    renderTotoroBookSvg,
    getState: () => ({ ...state })
  };
})();
