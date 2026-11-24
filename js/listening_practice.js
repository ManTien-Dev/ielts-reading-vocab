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
  const BANK_VERSION = '20261125c';

  const _loadedBanks = {};
  const _bankPromises = {};

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function DATA() {
    return window.LISTENING_PRACTICE_DATA || {
      PORTAL_CARDS: [], CAMBRIDGE_BOOKS: [], VOLUME_BOOKS: [], PARTS: {}, FULL_TESTS: []
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

  /* ---------------------------------------------------------
     STATE & PROGRESS STORE
     --------------------------------------------------------- */
  const state = {
    view: 'portal',           // 'portal' | 'source'
    source: 'cambridge',      // 'cambridge' | 'volume' | 'actual'
    camGroup: 'recent',       // 'recent' (Cam 10-20) | 'classic' (Cam 1-9)
    actualTab: 'p1',          // 'p1' | 'p2' | 'p3' | 'p4' | 'full'
    actualQType: '',          // '' | 'gap' | 'map' | 'mcq' | 'matching'
    actualFilterOpen: false,
    actualSearch: '',
    selectedBookId: 'lcam_20',
    selectedTestNum: 1,       // 1..4
    loadingBank: null
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
    getPartProgress(partObj) {
      if (!partObj) return null;
      if (partObj.taskId && window.ListeningTasksModule?.getProgressMap) {
        const prog = window.ListeningTasksModule.getProgressMap() || {};
        const r = prog[partObj.taskId];
        if (r && (r.t3Total || r.completed)) {
          return {
            done: true,
            score: Number(r.t3Score || 0),
            total: Number(r.t3Total || partObj.questionsCount || 10)
          };
        }
      }
      const hist = this.load().history.filter((h) => h.itemId === partObj.id);
      if (hist.length) {
        const best = hist.reduce((a, b) => ((b.score || 0) > (a.score || 0) ? b : a), hist[0]);
        return { done: true, score: best.score || 0, total: best.total || partObj.questionsCount || 10 };
      }
      return null;
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

    const bankUrls = window.__LISTENING_BANK_URLS__ || {};
    if (!bankUrls[src]) {
      _loadedBanks[src] = true;
      return Promise.resolve();
    }

    state.loadingBank = src;
    const scriptSrc = `${bankUrls[src]}?v=${BANK_VERSION}`;
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

  function renderTotoroBookSvg(book, opts = {}) {
    const pal = book?.palette || {
      fur: '#2F6049', furDark: '#204534', spine: '#193729', belly: '#FAF4E6', accent: '#E5B95C', cheek: '#E89B8B'
    };
    const clipId = `lp-tb-clip-${esc(book?.id || 'def')}-${opts.suffix || 'shelf'}`;
    const seriesLabel = opts.seriesLabel || getSeriesShortLabel(book);
    const numText = opts.numText != null ? String(opts.numText) : getBookNumText(book);
    const readyCount = opts.readyCount || 0;

    return `
      <svg class="lp-totoro-book-svg" viewBox="0 0 180 206" fill="none" aria-hidden="true">
        <defs>
          <clipPath id="${clipId}">
            <path d="M51 54 L43 18 C42.5 14 47.5 12.5 51 16 L66 43 C74 40 106 40 114 43 L129 16 C132.5 12.5 137.5 14 137 18 L129 54 C146 67 154 91 153 125 C152 162 132 184 90 184 C48 184 28 162 27 125 C26 91 34 67 51 54 Z"/>
          </clipPath>
        </defs>

        <ellipse cx="92" cy="193" rx="54" ry="8" fill="#1C2822" opacity="0.14"/>

        <path d="M82 178 H98 V200 L90 193.5 L82 200 Z" fill="${pal.accent}" stroke="${pal.spine}" stroke-width="1.2" stroke-linejoin="round"/>
        ${readyCount > 0 ? `<circle cx="90" cy="188.5" r="2.2" fill="${pal.spine}" opacity="0.7"/>` : ''}

        <path d="M132 56 C152 70 161 94 160 128 C159 164 138 186 96 186 L90 184 C132 184 152 162 153 125 C154 91 146 67 129 54 Z" fill="#F2EAD7" stroke="#B9AE95" stroke-width="1.2"/>
        <path d="M155 96 C157 110 157 132 154 148 M158 102 C159.5 114 159.5 132 156.5 146" stroke="#C8BCA2" stroke-width="1" stroke-linecap="round"/>

        <path d="M51 54 L43 18 C42.5 14 47.5 12.5 51 16 L66 43 C74 40 106 40 114 43 L129 16 C132.5 12.5 137.5 14 137 18 L129 54 C146 67 154 91 153 125 C152 162 132 184 90 184 C48 184 28 162 27 125 C26 91 34 67 51 54 Z"
              fill="${pal.fur}" stroke="${pal.spine}" stroke-width="2" stroke-linejoin="round"/>

        <g clip-path="url(#${clipId})">
          <rect x="20" y="10" width="23" height="180" fill="${pal.spine}" opacity="0.88"/>
          <line x1="43" y1="12" x2="43" y2="188" stroke="#FFFFFF" stroke-width="1.3" opacity="0.22"/>
          <line x1="45.5" y1="12" x2="45.5" y2="188" stroke="${pal.spine}" stroke-width="1.2" opacity="0.45"/>
          <rect x="24" y="74" width="19" height="2.6" rx="1.2" fill="${pal.accent}" opacity="0.72"/>
          <rect x="24" y="114" width="19" height="2.6" rx="1.2" fill="${pal.accent}" opacity="0.72"/>
          <rect x="24" y="152" width="19" height="2.6" rx="1.2" fill="${pal.accent}" opacity="0.72"/>
          <ellipse cx="106" cy="54" rx="46" ry="20" fill="#FFFFFF" opacity="0.07"/>
          <path d="M49 46 L46 23 L60 42 Z" fill="${pal.furDark}" opacity="0.5"/>
          <path d="M131 46 L134 23 L120 42 Z" fill="${pal.furDark}" opacity="0.5"/>
        </g>

        ${renderEyesSvg(book?.eyes || 'alert')}
        <path d="M85.5 79.5 Q90 77.2 94.5 79.5 Q90 83.2 85.5 79.5 Z" fill="#1E2421"/>
        <path d="M86 85.5 Q90 88.2 94 85.5" stroke="#1E2421" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
        <ellipse cx="56" cy="82" rx="5.2" ry="3.1" fill="${pal.cheek}" opacity="0.34"/>
        <ellipse cx="124" cy="82" rx="5.2" ry="3.1" fill="${pal.cheek}" opacity="0.34"/>
        <path d="M49 81L34 78.5M48 85L33 85M49 89L35 91.5" stroke="#FFFDF8" stroke-width="1.35" stroke-linecap="round" opacity="0.62"/>
        <path d="M131 81L146 78.5M132 85L147 85M131 89L145 91.5" stroke="#FFFDF8" stroke-width="1.35" stroke-linecap="round" opacity="0.62"/>

        <ellipse cx="92" cy="138" rx="44" ry="37" fill="${pal.belly}" stroke="${pal.spine}" stroke-width="1.1" stroke-opacity="0.22"/>
        <path d="M68 116 L73.5 110.5 L79 116 M86.5 113.5 L92 108 L97.5 113.5 M105 116 L110.5 110.5 L116 116"
              stroke="${pal.furDark}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.82"/>

        <text x="92" y="131" text-anchor="middle" font-size="8.6" font-weight="800" letter-spacing="1.4" fill="${pal.furDark}" opacity="0.78" font-family="system-ui, -apple-system, sans-serif">${esc(seriesLabel)}</text>
        <text x="92" y="161" text-anchor="middle" font-size="${numText.length > 2 ? '23' : '31'}" font-weight="900" letter-spacing="-0.8" fill="${pal.spine}" font-family="Georgia, 'Times New Roman', serif">${esc(numText)}</text>

        ${renderPersonaAccessory(book?.persona || 'headphones', pal)}
      </svg>
    `;
  }

  /* =========================================================
     PORTAL 3x3 ARTWORK BANNERS (9 DISTINCT STUDIO TOTORO SCENES)
     ========================================================= */
  function renderPortalArt(scene) {
    const cams = DATA().CAMBRIDGE_BOOKS || [];
    const vols = DATA().VOLUME_BOOKS || [];
    const mapCfg = {
      cambridge: {
        bg1: '#E9F3EC', bg2: '#D3E6D8', ring: '#2F6049',
        book: cams[0], seriesLabel: 'CAMBRIDGE', numText: '20',
        deco: `<path d="M18 82 Q70 58 128 78 T238 66" stroke="#2F6049" stroke-width="2" stroke-dasharray="4 4" opacity="0.26" fill="none"/><circle cx="212" cy="36" r="24" fill="#E5B95C" opacity="0.2"/>`
      },
      volume: {
        bg1: '#EAF2F8', bg2: '#D3E3F0', ring: '#275274',
        book: { ...(vols[1] || cams[1]), persona: 'umbrella' }, seriesLabel: 'REAL VOL', numText: '10',
        deco: `<path d="M188 18 L182 36 M212 24 L206 42 M234 16 L228 34" stroke="#4D85B2" stroke-width="2.2" stroke-linecap="round" opacity="0.38"/><circle cx="218" cy="84" r="26" fill="#275274" opacity="0.09"/>`
      },
      actual: {
        bg1: '#F7EFEA', bg2: '#ECDDD2', ring: '#8E4E34',
        book: { ...(cams[2] || {}), persona: 'mic' }, seriesLabel: 'ACTUAL', numText: 'P1–4',
        deco: `<g stroke="#8E4E34" stroke-width="3" stroke-linecap="round" opacity="0.26"><line x1="184" y1="42" x2="184" y2="72"/><line x1="196" y1="30" x2="196" y2="84"/><line x1="208" y1="22" x2="208" y2="92"/><line x1="220" y1="36" x2="220" y2="78"/><line x1="232" y1="46" x2="232" y2="68"/></g>`
      },
      map: {
        bg1: '#EAF4F3', bg2: '#D2E7E4', ring: '#236360',
        book: cams[7], seriesLabel: 'MAP LAB', numText: 'P2',
        deco: `<rect x="166" y="20" width="76" height="68" rx="8" fill="#FFF" fill-opacity="0.65" stroke="#236360" stroke-opacity="0.22" stroke-dasharray="3 3"/><path d="M174 72 Q196 38 214 56 T234 34" stroke="#236360" stroke-width="2.2" fill="none" opacity="0.55"/><circle cx="178" cy="68" r="4" fill="#E5B95C"/><circle cx="232" cy="36" r="4" fill="#B6424B"/>`
      },
      note: {
        bg1: '#F5F2E8', bg2: '#E9E2CE', ring: '#966828',
        book: cams[5], seriesLabel: 'NOTES', numText: 'P1–4',
        deco: `<rect x="170" y="22" width="70" height="64" rx="8" fill="#FFF" fill-opacity="0.72" stroke="#966828" stroke-opacity="0.2"/><path d="M180 38 H230 M180 52 H222 M180 66 H214" stroke="#966828" stroke-width="2.2" stroke-linecap="round" opacity="0.38"/>`
      },
      tasks: {
        bg1: '#EEF3EA', bg2: '#DAE6D3', ring: '#4B6B3A',
        book: cams[8], seriesLabel: 'TASKS', numText: '139',
        deco: `<g fill="#4B6B3A" opacity="0.22"><rect x="172" y="24" width="20" height="16" rx="4"/><rect x="197" y="24" width="20" height="16" rx="4"/><rect x="222" y="24" width="20" height="16" rx="4"/><rect x="172" y="46" width="20" height="16" rx="4"/><rect x="197" y="46" width="20" height="16" rx="4"/><rect x="222" y="46" width="20" height="16" rx="4"/><rect x="172" y="68" width="20" height="16" rx="4"/><rect x="197" y="68" width="20" height="16" rx="4"/><rect x="222" y="68" width="20" height="16" rx="4"/></g>`
      },
      speed: {
        bg1: '#F1EEF6', bg2: '#E1DAF0', ring: '#594474',
        book: cams[3], seriesLabel: 'SPEED', numText: '6s',
        deco: `<circle cx="208" cy="54" r="28" fill="#FFF" fill-opacity="0.58" stroke="#594474" stroke-width="2" stroke-opacity="0.28"/><path d="M208 38 V54 L220 60" stroke="#594474" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.58"/>`
      },
      traps: {
        bg1: '#F5ECEE', bg2: '#E9D6DB', ring: '#873E49',
        book: cams[4], seriesLabel: 'CUES', numText: '40',
        deco: `<path d="M174 70 L204 28 L234 70 Z" fill="#FFF" fill-opacity="0.55" stroke="#873E49" stroke-width="2" stroke-opacity="0.32" stroke-linejoin="round"/><path d="M204 42 V56" stroke="#873E49" stroke-width="2.4" stroke-linecap="round" opacity="0.65"/><circle cx="204" cy="63" r="2" fill="#873E49" opacity="0.7"/>`
      },
      voice: {
        bg1: '#EDF1F4', bg2: '#D9E1E8', ring: '#3E4854',
        book: cams[6], seriesLabel: 'VOICE', numText: 'MIC',
        deco: `<circle cx="206" cy="54" r="30" fill="none" stroke="#3E4854" stroke-width="1.6" stroke-dasharray="4 4" opacity="0.25"/><circle cx="206" cy="54" r="18" fill="none" stroke="#3E4854" stroke-width="2" opacity="0.3"/><circle cx="206" cy="54" r="7" fill="#E8B85F"/>`
      }
    };
    const cfg = mapCfg[scene] || mapCfg.cambridge;
    const svg = renderTotoroBookSvg(cfg.book, {
      suffix: `p3x3-${scene}`,
      seriesLabel: cfg.seriesLabel,
      numText: cfg.numText,
      readyCount: 1
    });
    return `
      <div class="lp-p3-art" style="--lp-bg1:${cfg.bg1};--lp-bg2:${cfg.bg2};--lp-ring:${cfg.ring};">
        <svg class="lp-p3-bg" viewBox="0 0 260 108" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${cfg.deco}</svg>
        <div class="lp-p3-totoro">${svg}</div>
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
      let actionsHtml = '';

      if (c.kind === 'source') {
        if (c.id === 'cambridge' || c.id === 'volume') {
          const bks = getBooksForSource(c.id);
          const ready = bks.filter((b) => countReadyTestsInBook(b.id) > 0).length;
          const unit = c.id === 'volume' ? 'Volumes' : 'Books';
          badge = ready > 0 ? `★ ${ready}/${bks.length} ${unit}` : `${bks.length} ${unit}`;
        } else if (c.id === 'actual') {
          const actCount = Object.values(d.PARTS || {}).filter((p) => p.source === 'actual').length;
          badge = actCount > 0 ? `★ ${actCount} Parts` : 'Parts 1–4 · FULL TEST';
        }
        cardOnClick = `ListeningPracticeApp.openSource('${esc(c.id)}')`;
        actionsHtml = c.id === 'actual'
          ? `
            <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('actual', 'p1')">Chọn bài nghe</button>
            <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('actual', 'full')">FULL TEST →</button>
          `
          : `
            <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('${esc(c.id)}')">Chọn bộ đề</button>
            <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('${esc(c.id)}')">Mở kệ →</button>
          `;
      } else if (c.kind === 'map_drill') {
        badge = `★ ${mapTasks.length || 3} Maps`;
        cardOnClick = `ListeningTasksModule.openPracticePicker('map')`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openPracticePicker('map')">Chọn bài Map</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openExam('${esc(firstMapId)}', 3, { fromPractice: true })">Làm Map 01 →</button>
        `;
      } else if (c.kind === 'note_drill') {
        badge = `★ ${noteTasks.length || 8} Tests`;
        cardOnClick = `ListeningTasksModule.openPracticePicker('note')`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openPracticePicker('note')">Chọn bài nghe</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openExam('${esc(firstNoteId)}', 3, { fromPractice: true })">Làm Part 1 →</button>
        `;
      } else if (c.kind === 'tasks_hub') {
        badge = `${tasks.length || 139} Tasks`;
        cardOnClick = `window.TotoroUI?.switchView?.('task', { fromUser: true })`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); window.TotoroUI?.enterSkillMode?.('Listening', 'flashcard')">Flashcard</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); window.TotoroUI?.switchView?.('task', { fromUser: true })">Mở Tasks →</button>
        `;
      } else if (c.kind === 'speed_quiz') {
        cardOnClick = `ListeningPracticeApp.launchListeningSpeedQuiz()`;
        actionsHtml = `
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.launchListeningSpeedQuiz()">Bắt đầu Speed Quiz →</button>
        `;
      } else if (c.kind === 'signal_deck') {
        cardOnClick = `ListeningPracticeApp.openSignalDeck(false)`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSignalDeck(false)">Flashcard</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSignalDeck(true)">Speed Quiz →</button>
        `;
      } else {
        cardOnClick = `window.TotoroVoiceLab?.open?.('word')`;
        actionsHtml = `
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); window.TotoroVoiceLab?.open?.('word')">Mở Voice Lab →</button>
        `;
      }

      return `
        <article class="tot-exam-card lp-p3-card" data-lp-portal="${esc(c.id)}" onclick="${cardOnClick}" role="button" tabindex="0">
          ${renderPortalArt(c.scene)}
          <div class="lp-p3-body">
            <div class="lp-p3-badges">
              <span class="lp-source-pill">${esc(c.label)}</span>
              <span class="lp-meta-pill tabular">${esc(badge)}</span>
            </div>
            <h3 class="lp-p3-title">${esc(c.bookTitle)}</h3>
            <p class="lp-p3-desc">${esc(c.desc)}</p>
            <div class="lp-p3-foot">${actionsHtml}</div>
          </div>
        </article>
      `;
    };

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets lp-portal-shell">
        <div class="tot-shell-head lp-shell-head">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="tot-icon-tile" aria-hidden="true" style="width:38px;height:38px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            </span>
            <div>
              <h2 class="tot-shell-title">LISTENING PRACTICE</h2>
              <p class="tot-shell-sub">Cambridge IELTS, Real Listening Tests, Recent Actual Tests cùng hệ thống bài bổ trợ Map Labelling, Note Completion và Speed Quiz.</p>
            </div>
          </div>
        </div>

        <div class="lp-portal-3x3" id="lp-portal-grid">
          ${cards.map(renderCard).join('')}
        </div>
      </div>
    `;
  }

  /* =========================================================
     VIEW 2 & 3: EXAM BANKS (WOODEN TOTORO BOOKSHELF / ACTUAL TABS)
     ========================================================= */
  function renderPartCard(item, isFull) {
    const prog = !isFull ? ListeningPracticeStore.getPartProgress(item) : null;
    const partLabel = isFull ? 'FULL TEST' : `Part ${item.partNum || 1}`;
    const types = Array.isArray(item.qTypes) ? item.qTypes : (isFull ? ['Parts 1–4'] : ['Note Completion']);
    const scoreBadge = prog ? `<span class="lp-score-pill is-done tabular">✓ ${prog.score}/${prog.total}</span>` : '';

    return `
      <article class="lp-part-card ${isFull ? 'is-full' : ''}">
        <div class="lp-part-top">
          <span class="lp-part-tag ${isFull ? 'is-full' : ''}">${esc(partLabel)}</span>
          ${scoreBadge}
        </div>
        <h4 class="lp-part-title">${esc(item.title)}</h4>
        <p class="lp-part-sub">${esc(item.subtitle || '')}</p>
        <div class="lp-part-foot">
          <div class="lp-part-meta">
            ${types.map((t) => `<span class="lp-qtype-chip">${esc(t)}</span>`).join('')}
            <span class="lp-qtype-chip tabular">${Number(item.questionsCount) || (isFull ? 40 : 10)} câu · ${Number(item.durationMin) || (isFull ? 30 : 7)} phút</span>
          </div>
          <div class="lp-part-btns">
            <button type="button" class="btn-subtle lp-part-go" onclick="ListeningPracticeApp.startItem('${esc(item.id)}', ${isFull ? 'true' : 'false'}, 'practice')">Luyện tập</button>
            <button type="button" class="btn btn-primary lp-part-go" onclick="ListeningPracticeApp.startItem('${esc(item.id)}', ${isFull ? 'true' : 'false'}, 'exam')">Thi thật →</button>
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
      <div class="tot-section-shell ink-brackets lp-hub-shell">
        <div class="lp-hub-head">
          <div class="lp-hub-head-left">
            <button type="button" class="btn-subtle lp-btn-back" id="lp-btn-back-portal" onclick="ListeningPracticeApp.openPortal()">← PRACTICE</button>
            <div>
              <h2 class="tot-shell-title">${esc(curSourceObj?.bookTitle || 'Recent Actual Tests')}</h2>
              <p class="tot-shell-sub">${esc(curSourceObj?.desc || '')}</p>
            </div>
          </div>
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
      const labelTxt = st.done ? 'Đã làm' : (st.hasData ? 'Sẵn sàng' : 'Trống');
      return `
        <button type="button"
          class="lp-test-tab ${isAct ? 'active' : ''} ${st.hasData ? 'has-data' : 'is-empty'} ${st.done ? 'is-done' : ''}"
          data-lp-test="${tNum}"
          onclick="ListeningPracticeApp.selectTestNum(${tNum})">
          <span class="lp-test-dot" aria-hidden="true"></span>
          <span class="lp-test-name">Test ${tNum}</span>
          <small>${labelTxt}</small>
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
      examListHtml = [1, 2, 3, 4].map((pNum) => {
        const items = testParts.filter((p) => Number(p.partNum) === pNum);
        if (!items.length) return '';
        return `
          <div class="lp-section-block">
            <div class="lp-section-head">
              <h3 class="lp-section-title">Part ${pNum}</h3>
            </div>
            <div class="lp-parts-grid is-single">${items.map((p) => renderPartCard(p, false)).join('')}</div>
          </div>
        `;
      }).join('') + (testFulls.length ? `
        <div class="lp-section-block">
          <div class="lp-section-head">
            <h3 class="lp-section-title">FULL TEST</h3>
            <span class="lp-section-badge">Parts 1–4</span>
          </div>
          <div class="lp-parts-grid is-single">${testFulls.map((ft) => renderPartCard(ft, true)).join('')}</div>
        </div>
      ` : '');
    }

    const shelfHeading = state.source === 'cambridge' ? 'Cambridge IELTS Library' : 'Real Listening Library';
    const unitNoun = state.source === 'volume' ? 'volumes' : 'books';

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets lp-hub-shell">
        <div class="lp-hub-head">
          <div class="lp-hub-head-left">
            <button type="button" class="btn-subtle lp-btn-back" id="lp-btn-back-portal" onclick="ListeningPracticeApp.openPortal()">← PRACTICE</button>
            <div>
              <h2 class="tot-shell-title">${esc(curSourceObj?.bookTitle || 'LISTENING PRACTICE')}</h2>
              <p class="tot-shell-sub">${esc(curSourceObj?.desc || '')}</p>
            </div>
          </div>
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

  function startItem(itemId, isFull, mode) {
    const d = DATA();
    if (isFull) {
      const ft = (d.FULL_TESTS || []).find((x) => x.id === itemId);
      const firstPart = ft?.partIds?.[0] ? d.PARTS?.[ft.partIds[0]] : null;
      if (firstPart?.taskId && window.ListeningTasksModule?.openExam) {
        window.ListeningTasksModule.openExam(firstPart.taskId, 3, { fromPractice: true, mode });
        return;
      }
      toast('Đề FULL TEST này đang chờ nạp audio.');
      return;
    }
    const part = d.PARTS?.[itemId];
    if (part?.taskId && window.ListeningTasksModule?.openExam) {
      window.ListeningTasksModule.openExam(part.taskId, 3, { fromPractice: true, mode });
      return;
    }
    toast('Bài nghe này đang chờ nạp audio.');
  }

  function render() {
    if (state.view === 'source') {
      renderHub();
    } else {
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
    renderTotoroBookSvg,
    getState: () => ({ ...state })
  };
})();
