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
        eyebrow: '139 TOPICS',
        t1: 'Dictation &',
        t2: 'Spelling',
        sub: '3,864 Core Listening Words',
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
      let actionsHtml = '';

      if (c.kind === 'source') {
        if (c.id === 'cambridge') {
          const bks = getBooksForSource(c.id);
          const ready = bks.filter((b) => countReadyTestsInBook(b.id) > 0).length;
          badge = ready > 0 ? `${ready}/${bks.length} cuốn` : `${bks.length} cuốn`;
        } else if (c.id === 'volume') {
          const bks = getBooksForSource(c.id);
          const ready = bks.filter((b) => countReadyTestsInBook(b.id) > 0).length;
          badge = ready > 0 ? `${ready}/${bks.length} tập` : '10 tập · Real Listening';
        } else if (c.id === 'actual') {
          const actCount = Object.values(d.PARTS || {}).filter((p) => p.source === 'actual').length;
          badge = actCount > 0 ? `${actCount} bài nghe` : 'Part 1–4 · FULL TEST';
        }
        cardOnClick = `ListeningPracticeApp.openSource('${esc(c.id)}')`;
        actionsHtml = c.id === 'actual'
          ? `
            <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('actual', 'p1')">Chọn bài nghe</button>
            <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('actual', 'full')">Làm Full Test</button>
          `
          : `
            <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('${esc(c.id)}')">Chọn bộ đề</button>
            <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('${esc(c.id)}')">Làm Full Test</button>
          `;
      } else if (c.kind === 'map_drill') {
        badge = `★ ${mapTasks.length || 3} Maps`;
        cardOnClick = `ListeningTasksModule.openPracticePicker('map')`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openPracticePicker('map')">Chọn bài Map</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openExam('${esc(firstMapId)}', 3, { fromPractice: true })">Làm Map 01</button>
        `;
      } else if (c.kind === 'note_drill') {
        badge = `★ ${noteTasks.length || 8} Tests`;
        cardOnClick = `ListeningTasksModule.openPracticePicker('note')`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openPracticePicker('note')">Chọn bài nghe</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); ListeningTasksModule.openExam('${esc(firstNoteId)}', 3, { fromPractice: true })">Làm Part 1</button>
        `;
      } else {
        badge = `${tasks.length || 139} Tasks`;
        cardOnClick = `window.TotoroUI?.switchView?.('task', { fromUser: true })`;
        actionsHtml = `
          <button type="button" class="tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); window.TotoroUI?.enterSkillMode?.('Listening', 'flashcard')">Flashcard</button>
          <button type="button" class="btn btn-primary tot-demo-btn lp-p3-btn" onclick="event.stopPropagation(); window.TotoroUI?.switchView?.('task', { fromUser: true })">Mở Tasks</button>
        `;
      }

      return `
        <article class="tot-exam-card lp-p3-card" data-lp-portal="${esc(c.id)}" onclick="${cardOnClick}" role="button" tabindex="0">
          ${renderPortalArt(c, badge)}
          <div class="lp-p3-body">
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
              <p class="tot-shell-sub">Cambridge IELTS, Real Listening Tests, Recent Actual Tests cùng các bài bổ trợ Map Labelling, Note Completion và Tasks.</p>
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
    const partLabel = isFull ? 'FULL TEST' : `PART ${item.partNum || 1}`;
    const types = Array.isArray(item.qTypes) ? item.qTypes : (isFull ? ['Part 1–4', 'Full 30 phút'] : ['Note Completion']);
    const qCount = Number(item.questionsCount) || (isFull ? 40 : 10);
    const mins = Number(item.durationMin) || (isFull ? 30 : 7);
    const rightPill = prog
      ? `<span class="lp-thumb-pill is-score tabular">${prog.score}/${prog.total} câu</span>`
      : `<span class="lp-thumb-pill tabular">${esc(item.targetBand || (isFull ? '6.5 – 8.5' : (item.partNum >= 3 ? '7.0 – 8.5' : '6.0 – 7.0')))}</span>`;
    const thumbTheme = isFull ? 'is-full' : `is-p${item.partNum || 1}`;

    return `
      <article class="lp-row-card ${isFull ? 'is-full' : ''}">
        <div class="lp-row-thumb ${thumbTheme}">
          <div class="lp-thumb-top">
            <span class="lp-thumb-tag ${isFull ? 'is-full' : ''}">${esc(partLabel)}</span>
            ${rightPill}
          </div>
          <div class="lp-thumb-art" aria-hidden="true">
            <img src="${esc(getBookImgUrl(item.bookId || (isFull ? 'lcam_20' : 'lactual_p14')))}" alt="" loading="lazy" decoding="async" draggable="false">
          </div>
          <div class="lp-thumb-foot tabular">${qCount} câu hỏi · ${mins} phút</div>
        </div>
        <div class="lp-row-body">
          <h4 class="lp-row-title">${esc(item.title)}</h4>
          <p class="lp-row-sub">${esc(item.subtitle || '')}</p>
          <div class="lp-part-meta">
            ${types.map((t) => `<span class="lp-qtype-chip">${esc(t)}</span>`).join('')}
          </div>
        </div>
        <div class="lp-row-actions">
          <button type="button" class="btn-subtle lp-row-btn" onclick="ListeningPracticeApp.startItem('${esc(item.id)}', ${isFull ? 'true' : 'false'}, 'practice')">Luyện tập</button>
          <button type="button" class="btn btn-primary lp-row-btn" onclick="ListeningPracticeApp.startItem('${esc(item.id)}', ${isFull ? 'true' : 'false'}, 'exam')">${isFull ? 'Thi Full Test →' : 'Thi thật →'}</button>
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
          class="lp-test-pill ${isAct ? 'active' : ''} ${st.hasData ? 'has-data' : 'is-empty'} ${st.done ? 'is-done' : ''}"
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
      const partMeta = {
        1: '7 phút · Dễ → Trung bình',
        2: '7 phút · Bản đồ & Độc thoại',
        3: '8 phút · Thảo luận học thuật',
        4: '8 phút · Bài giảng Band 7.5+'
      };
      examListHtml = [1, 2, 3, 4].map((pNum) => {
        const items = testParts.filter((p) => Number(p.partNum) === pNum);
        if (!items.length) return '';
        return `
          <div class="lp-section-block">
            <div class="lp-section-head">
              <h3 class="lp-section-title">Part ${pNum}</h3>
              <span class="lp-section-pill">${partMeta[pNum]}</span>
            </div>
            <div class="lp-row-stack">${items.map((p) => renderPartCard(p, false)).join('')}</div>
          </div>
        `;
      }).join('') + (testFulls.length ? `
        <div class="lp-section-block">
          <div class="lp-section-head">
            <h3 class="lp-section-title">FULL TEST</h3>
            <span class="lp-section-pill">30 phút · Trọn bộ 4 Part</span>
          </div>
          <div class="lp-row-stack">${testFulls.map((ft) => renderPartCard(ft, true)).join('')}</div>
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
