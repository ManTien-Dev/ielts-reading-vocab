/* =========================================================
   MODULE: IELTS Listening Practice PRO — 3x3 Totoro-Shaped Bookshelf
   - Distinct Listening-native experience inspired by Reading Practice's
     proven catalog structure (SOURCES -> Books -> Test 1..4 -> Part 1..4 + FULL TEST)
   - Strict 3x3 Totoro Book Grid: EVERY book is sculpted as a unique
     Totoro-shaped hardcover book with its own ears, spine, cream page-edges,
     bookmark ribbon, expression, palette, and custom character accessory!
   - Import-Ready Lazy Bank Loader:
       window.__LISTENING_BANKS__ = { cambridge, volume, actual }
       Automatically loads data/bank_listening_<source>.js when present.
   - Pre-wired to launch our 11 verified Flagship Audio Neural exams immediately.
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY_BASE = 'ielts_listening_practice_v1_';
  const BANK_VERSION = '20261125a';

  const _loadedBanks = {};
  const _bankPromises = {};

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function DATA() {
    return window.LISTENING_PRACTICE_DATA || {
      SOURCES: [], CAMBRIDGE_BOOKS: [], VOLUME_BOOKS: [], ACTUAL_SETS: [], PARTS: {}, FULL_TESTS: [], BANK_META: {}
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
     STATE & LOCAL PROGRESS STORE
     --------------------------------------------------------- */
  const state = {
    view: 'portal',           // 'portal' | 'source'
    source: 'cambridge',      // 'cambridge' | 'volume' | 'actual' | 'map_studio'
    camPage: 'recent',        // 'recent' (20..12 = 3x3) | 'mid' (11..3 = 3x3) | 'classic' (2..1)
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
            total: Number(r.t3Total || partObj.questionsCount || 8)
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

    // Non-blocking: only attempt lazy load if bank file is opted-in via window.__LISTENING_BANK_URLS__
    // or auto-detected, so zero 404 console noise before raw exam banks are dropped in!
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
    if (src === 'actual') return d.ACTUAL_SETS || [];
    return [];
  }

  function getPartsInBook(bookId) {
    const d = DATA();
    return Object.values(d.PARTS || {}).filter((p) => p.bookId === bookId);
  }

  function getFullTestsInBook(bookId) {
    const d = DATA();
    return (d.FULL_TESTS || []).filter((ft) => ft.bookId === bookId);
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
    if (book.source === 'actual') return 'ACTUAL SET';
    return 'CAMBRIDGE';
  }

  function getBookNumText(book) {
    const n = Number(book?.num) || 1;
    if (book?.source === 'cambridge') return String(n);
    return String(n).padStart(2, '0');
  }

  /* =========================================================
     BESPOKE SVG ARTIST: TOTORO-SHAPED HARDCOVER BOOKS
     Every book's physical silhouette IS Totoro (pointed ears,
     plump book-body, stitched spine, cream page-edges, ribbon,
     expressive eyes, belly chevrons + bold number) PLUS a
     unique character accessory per book!
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
    // default 'alert'
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
          <!-- Studio Over-Ear Headphones + Soundwaves -->
          <path d="M40 76C42 40 62 28 90 28C118 28 138 40 140 76" fill="none" stroke="#24302A" stroke-width="5.5" stroke-linecap="round"/>
          <path d="M44 74C46 43 64 31.5 90 31.5C116 31.5 134 43 136 74" fill="none" stroke="${acc}" stroke-width="2" stroke-linecap="round"/>
          <rect x="27" y="65" width="14" height="26" rx="7" fill="#24302A" stroke="${acc}" stroke-width="1.8"/>
          <rect x="139" y="65" width="14" height="26" rx="7" fill="#24302A" stroke="${acc}" stroke-width="1.8"/>
          <path d="M18 72C15 76 15 80 18 84M13 68C9 75 9 81 13 88" stroke="${acc}" stroke-width="2" stroke-linecap="round" fill="none"/>
          <path d="M162 72C165 76 165 80 162 84M167 68C171 75 171 81 167 88" stroke="${acc}" stroke-width="2" stroke-linecap="round" fill="none"/>
        `;
      case 'umbrella':
        return `
          <!-- Classic Ghibli Rain Umbrella + Raindrops -->
          <g transform="translate(0,-3)">
            <path d="M92 10V17" stroke="#182C3D" stroke-width="2.6" stroke-linecap="round"/>
            <path d="M36 39C46 18 67 13 92 13C117 13 138 18 148 39C135 34.5 123 35 113 38.5C101 34.5 84 34.5 72 38.5C61 35 49 34.5 36 39Z" fill="#1D4463" stroke="${acc}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M92 13C84 22 79 29 74 37M92 13C100 22 105 29 110 37" stroke="#A8D0EC" stroke-width="1.2" opacity="0.55" fill="none"/>
            <path d="M156 26C156 29 154 31 154 31C154 31 152 29 152 26C152 24.5 154 22 154 22C154 22 156 24.5 156 26Z" fill="#7FB8DF"/>
            <path d="M25 32C25 34.5 23.4 36 23.4 36C23.4 36 21.8 34.5 21.8 32C21.8 30.8 23.4 28.8 23.4 28.8C23.4 28.8 25 30.8 25 32Z" fill="#7FB8DF"/>
            <path d="M164 46C164 48 162.7 49.5 162.7 49.5C162.7 49.5 161.4 48 161.4 46C161.4 45 162.7 43.2 162.7 43.2C162.7 43.2 164 45 164 46Z" fill="#7FB8DF" opacity="0.8"/>
          </g>
        `;
      case 'acorn':
        return `
          <!-- Woven Acorn Beret + Hanging Acorn Charm -->
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
          <!-- Glowing Crescent Moon & Starlight -->
          <path d="M150 28C144 28 139.5 23.5 139.5 17.5C139.5 14.2 141 11.2 143.5 9.5C137.5 10.5 133.5 15.5 133.5 21.5C133.5 28 138.8 33 145.2 33C149.2 33 152.8 31 154.8 27.8C153.3 28 151.7 28 150 28Z" fill="${acc}" stroke="#FFF7DC" stroke-width="1"/>
          <path d="M27 25L29 30L34 32L29 34L27 39L25 34L20 32L25 30Z" fill="${acc}"/>
          <path d="M90 22L91.5 25.5L95 27L91.5 28.5L90 32L88.5 28.5L85 27L88.5 25.5Z" fill="${acc}"/>
          <circle cx="158" cy="48" r="2.2" fill="${acc}" opacity="0.85"/>
        `;
      case 'soot':
        return `
          <!-- Two Adorable Soot Sprites (Susuwatari) Peeking -->
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
            <circle cx="10" cy="13" r="1.4" fill="#111"/><circle cx="17" cy="13" r="1.4" fill="#111"/>
          </g>
        `;
      case 'ginkgo':
        return `
          <!-- Golden Ginkgo Fan Leaf Crown -->
          <path d="M90 44V32" stroke="#6E4E1B" stroke-width="2.4" stroke-linecap="round"/>
          <path d="M90 34C76 32 69 24 72 15C79 14 85 17 90 23C95 17 101 14 108 15C111 24 104 32 90 34Z" fill="${acc}" stroke="#6E4E1B" stroke-width="1.5" stroke-linejoin="round"/>
          <path d="M90 34L81 20M90 34L99 20" stroke="#6E4E1B" stroke-width="1.1" opacity="0.55"/>
          <path d="M154 64C147 63 144 58 146 53C150 53 153 55 155 58C158 55 161 53 164 54C165 59 161 63 154 64Z" fill="${acc}" opacity="0.82"/>
        `;
      case 'lantern':
        return `
          <!-- Warm Glowing Japanese Paper Lantern -->
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
          <!-- Explorer Compass Medallion & Mini Map Scroll -->
          <g transform="translate(141, 56)">
            <circle cx="15" cy="15" r="14" fill="#FAF2DF" stroke="${acc}" stroke-width="2.4"/>
            <circle cx="15" cy="15" r="10.5" fill="none" stroke="#6E4E34" stroke-width="1" stroke-dasharray="2 2"/>
            <path d="M15 5L18.2 15L15 25L11.8 15Z" fill="#B6424B"/>
            <path d="M15 15L18.2 15L15 25L11.8 15Z" fill="#3E4B59"/>
            <circle cx="15" cy="15" r="2.2" fill="${acc}"/>
          </g>
          <path d="M75 43C82 37 98 37 105 43" stroke="${acc}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        `;
      case 'fern':
        return `
          <!-- Curling Botanical Fern Frond Crown -->
          <path d="M90 45C89 33 93 20 102 15C108 12 113 17 110 22C108 25 104 24 104 20" stroke="#78A85A" stroke-width="2.6" stroke-linecap="round" fill="none"/>
          <path d="M90 38L80 32M91 32L82 25M94 25L86 19M91 35L101 31M94 28L103 26" stroke="#78A85A" stroke-width="2" stroke-linecap="round"/>
          <circle cx="105" cy="21" r="2.5" fill="${acc}"/>
        `;
      case 'cassette':
        return `
          <!-- Retro Audio Cassette Reel Badge -->
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
          <!-- Ocean Wave Swirl & Sea Shell -->
          <path d="M16 58C22 50 30 50 35 56M145 56C151 49 160 49 166 56" stroke="#85B8E0" stroke-width="2.2" stroke-linecap="round" fill="none"/>
          <path d="M148 66C153 61 160 61 165 66" stroke="${acc}" stroke-width="1.8" stroke-linecap="round" fill="none"/>
          <path d="M81 42C84 35 96 35 99 42" stroke="${acc}" stroke-width="2" stroke-linecap="round" fill="none"/>
        `;
      case 'lotus':
        return `
          <!-- Classic Giant Totoro Lotus Leaf Hat -->
          <path d="M90 45V30" stroke="#2D573E" stroke-width="2.8" stroke-linecap="round"/>
          <path d="M54 34C64 21 80 18 90 22C100 18 116 21 126 34C115 38 102 39 90 36C78 39 65 38 54 34Z" fill="#5D9A6B" stroke="#274E37" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M90 22V36M90 28L71 31M90 28L109 31" stroke="#A6D9AE" stroke-width="1.3" stroke-linecap="round"/>
        `;
      case 'telescope':
        return `
          <!-- Brass Stargazer Spyglass + Constellation -->
          <g transform="translate(137, 46) rotate(-28)">
            <rect x="0" y="6" width="24" height="7" rx="2" fill="${acc}" stroke="#4E3824" stroke-width="1.4"/>
            <rect x="20" y="4.5" width="11" height="10" rx="2" fill="#D49E48" stroke="#4E3824" stroke-width="1.4"/>
          </g>
          <path d="M22 30L30 22L40 27" stroke="${acc}" stroke-width="1.2" stroke-dasharray="2 2" fill="none"/>
          <circle cx="22" cy="30" r="2.2" fill="${acc}"/><circle cx="30" cy="22" r="2.6" fill="${acc}"/><circle cx="40" cy="27" r="2" fill="${acc}"/>
        `;
      case 'ocarina':
        return `
          <!-- Bamboo Ocarina Whistle & Floating Musical Notes -->
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
          <!-- Precision Technical Gear Emblem -->
          <g transform="translate(143, 52)">
            <circle cx="14" cy="14" r="8.5" fill="none" stroke="${acc}" stroke-width="3.2"/>
            <circle cx="14" cy="14" r="3.2" fill="${acc}"/>
            <path d="M14 2V6M14 22V26M2 14H6M22 14H26M5.5 5.5L8.3 8.3M19.7 19.7L22.5 22.5M22.5 5.5L19.7 8.3M8.3 19.7L5.5 22.5" stroke="${acc}" stroke-width="2.6" stroke-linecap="round"/>
          </g>
        `;
      case 'oak':
        return `
          <!-- Twin Fresh Oak Seedling Sprout -->
          <path d="M90 45V25" stroke="#4D6E38" stroke-width="2.6" stroke-linecap="round"/>
          <path d="M90 30C78 28 73 21 76 15C83 15 88 20 90 27Z" fill="#77A654" stroke="#395729" stroke-width="1.4" stroke-linejoin="round"/>
          <path d="M90 28C102 26 107 19 104 13C97 13 92 18 90 25Z" fill="#8EBC68" stroke="#395729" stroke-width="1.4" stroke-linejoin="round"/>
        `;
      case 'crane':
        return `
          <!-- Origami Paper Crane -->
          <g transform="translate(135, 36)">
            <path d="M2 18L16 14L31 6L21 20L27 29L14 22L5 26L11 18Z" fill="#FAF4E6" stroke="${acc}" stroke-width="1.6" stroke-linejoin="round"/>
            <path d="M16 14L21 20" stroke="#8A7D66" stroke-width="1.1"/>
          </g>
        `;
      case 'mic':
        return `
          <!-- Broadcast Studio Condenser Microphone -->
          <g transform="translate(144, 48)">
            <rect x="6" y="4" width="12" height="20" rx="6" fill="#2A3138" stroke="${acc}" stroke-width="1.7"/>
            <path d="M8 10H16M8 14H16M8 18H16" stroke="${acc}" stroke-width="1.2" opacity="0.8"/>
            <path d="M3 16C3 22 7 27 12 27C17 27 21 22 21 16" fill="none" stroke="${acc}" stroke-width="1.8" stroke-linecap="round"/>
            <path d="M12 27V34M7 34H17" stroke="${acc}" stroke-width="2" stroke-linecap="round"/>
          </g>
        `;
      case 'clover':
        return `
          <!-- Lucky Four-Leaf Clover Behind Ear -->
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
          <!-- Adorable Mini White Chibi-Totoro Peeking Beside the Book -->
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
    const clipId = `lp-tb-clip-${esc(book?.id || 'def')}-${opts.suffix || 'card'}`;
    const seriesLabel = getSeriesShortLabel(book);
    const numText = getBookNumText(book);
    const readyCount = opts.readyCount || 0;

    return `
      <svg class="lp-totoro-book-svg" viewBox="0 0 180 206" fill="none" aria-hidden="true">
        <defs>
          <clipPath id="${clipId}">
            <path d="M51 54 L43 18 C42.5 14 47.5 12.5 51 16 L66 43 C74 40 106 40 114 43 L129 16 C132.5 12.5 137.5 14 137 18 L129 54 C146 67 154 91 153 125 C152 162 132 184 90 184 C48 184 28 162 27 125 C26 91 34 67 51 54 Z"/>
          </clipPath>
        </defs>

        <!-- Ground contact shadow -->
        <ellipse cx="92" cy="193" rx="54" ry="8" fill="#1C2822" opacity="0.14"/>

        <!-- Golden silk bookmark ribbon peeking from bottom edge -->
        <path d="M82 178 H98 V200 L90 193.5 L82 200 Z" fill="${pal.accent}" stroke="${pal.spine}" stroke-width="1.2" stroke-linejoin="round"/>
        ${readyCount > 0 ? `<circle cx="90" cy="188.5" r="2.2" fill="${pal.spine}" opacity="0.7"/>` : ''}

        <!-- Book Page-Block Thickness (right flank & lower pages — unmistakable hardcover book!) -->
        <path d="M132 56 C152 70 161 94 160 128 C159 164 138 186 96 186 L90 184 C132 184 152 162 153 125 C154 91 146 67 129 54 Z" fill="#F2EAD7" stroke="#B9AE95" stroke-width="1.2"/>
        <path d="M155 96 C157 110 157 132 154 148 M158 102 C159.5 114 159.5 132 156.5 146" stroke="#C8BCA2" stroke-width="1" stroke-linecap="round"/>

        <!-- Main Totoro-Shaped Hardcover Book Body -->
        <path d="M51 54 L43 18 C42.5 14 47.5 12.5 51 16 L66 43 C74 40 106 40 114 43 L129 16 C132.5 12.5 137.5 14 137 18 L129 54 C146 67 154 91 153 125 C152 162 132 184 90 184 C48 184 28 162 27 125 C26 91 34 67 51 54 Z"
              fill="${pal.fur}" stroke="${pal.spine}" stroke-width="2" stroke-linejoin="round"/>

        <!-- Inner Spine Binding Band + Embossed Book Ribs (clipped cleanly to Totoro silhouette) -->
        <g clip-path="url(#${clipId})">
          <rect x="20" y="10" width="23" height="180" fill="${pal.spine}" opacity="0.88"/>
          <line x1="43" y1="12" x2="43" y2="188" stroke="#FFFFFF" stroke-width="1.3" opacity="0.22"/>
          <line x1="45.5" y1="12" x2="45.5" y2="188" stroke="${pal.spine}" stroke-width="1.2" opacity="0.45"/>
          <!-- Gold spine binding ribs -->
          <rect x="24" y="74" width="19" height="2.6" rx="1.2" fill="${pal.accent}" opacity="0.72"/>
          <rect x="24" y="114" width="19" height="2.6" rx="1.2" fill="${pal.accent}" opacity="0.72"/>
          <rect x="24" y="152" width="19" height="2.6" rx="1.2" fill="${pal.accent}" opacity="0.72"/>
          <!-- Soft warm upper cover sheen -->
          <ellipse cx="106" cy="54" rx="46" ry="20" fill="#FFFFFF" opacity="0.07"/>
          <!-- Subtle inner ear depth -->
          <path d="M49 46 L46 23 L60 42 Z" fill="${pal.furDark}" opacity="0.5"/>
          <path d="M131 46 L134 23 L120 42 Z" fill="${pal.furDark}" opacity="0.5"/>
        </g>

        <!-- Expressive Totoro Face -->
        ${renderEyesSvg(book?.eyes || 'alert')}
        <!-- Nose & gentle smile -->
        <path d="M85.5 79.5 Q90 77.2 94.5 79.5 Q90 83.2 85.5 79.5 Z" fill="#1E2421"/>
        <path d="M86 85.5 Q90 88.2 94 85.5" stroke="#1E2421" stroke-width="1.5" stroke-linecap="round" fill="none" opacity="0.7"/>
        <!-- Soft rosy cheeks -->
        <ellipse cx="56" cy="82" rx="5.2" ry="3.1" fill="${pal.cheek}" opacity="0.34"/>
        <ellipse cx="124" cy="82" rx="5.2" ry="3.1" fill="${pal.cheek}" opacity="0.34"/>
        <!-- Whiskers -->
        <path d="M49 81L34 78.5M48 85L33 85M49 89L35 91.5" stroke="#FFFDF8" stroke-width="1.35" stroke-linecap="round" opacity="0.62"/>
        <path d="M131 81L146 78.5M132 85L147 85M131 89L145 91.5" stroke="#FFFDF8" stroke-width="1.35" stroke-linecap="round" opacity="0.62"/>

        <!-- Cream Washi Belly Patch (Book Edition Plaque!) -->
        <ellipse cx="92" cy="138" rx="44" ry="37" fill="${pal.belly}" stroke="${pal.spine}" stroke-width="1.1" stroke-opacity="0.22"/>

        <!-- Classic 3 Totoro Belly Chevrons -->
        <path d="M68 116 L73.5 110.5 L79 116 M86.5 113.5 L92 108 L97.5 113.5 M105 116 L110.5 110.5 L116 116"
              stroke="${pal.furDark}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.82"/>

        <!-- Series Label & Bold Edition Number on Totoro's Belly -->
        <text x="92" y="131" text-anchor="middle" font-size="8.6" font-weight="800" letter-spacing="1.4" fill="${pal.furDark}" opacity="0.78" font-family="system-ui, -apple-system, sans-serif">${esc(seriesLabel)}</text>
        <text x="92" y="161" text-anchor="middle" font-size="31" font-weight="900" letter-spacing="-0.8" fill="${pal.spine}" font-family="Georgia, 'Times New Roman', serif">${esc(numText)}</text>

        <!-- Unique Per-Book Totoro Character Accessory -->
        ${renderPersonaAccessory(book?.persona || 'headphones', pal)}
      </svg>
    `;
  }

  /* =========================================================
     PORTAL WIDE STUDIO ILLUSTRATIONS (DISTINCT FROM READING!)
     ========================================================= */
  function renderPortalSceneSvg(scene) {
    const scenes = {
      headphones: {
        bg1: '#EAF3EC', bg2: '#D4E6D9', ring: '#2F6049',
        book: DATA().CAMBRIDGE_BOOKS?.[0],
        deco: `
          <circle cx="48" cy="40" r="24" fill="#2F6049" opacity="0.08"/>
          <circle cx="290" cy="112" r="32" fill="#E5B95C" opacity="0.18"/>
          <path d="M22 96 Q58 76 92 94 T162 90" stroke="#2F6049" stroke-width="2" stroke-dasharray="4 4" opacity="0.28" fill="none"/>
          <rect x="234" y="26" width="84" height="66" rx="10" fill="#FFFFFF" fill-opacity="0.72" stroke="#2F6049" stroke-opacity="0.18"/>
          <g fill="#2F6049" opacity="0.32">
            <rect x="244" y="36" width="18" height="12" rx="3"/><rect x="267" y="36" width="18" height="12" rx="3"/><rect x="290" y="36" width="18" height="12" rx="3"/>
            <rect x="244" y="53" width="18" height="12" rx="3"/><rect x="267" y="53" width="18" height="12" rx="3"/><rect x="290" y="53" width="18" height="12" rx="3"/>
            <rect x="244" y="70" width="18" height="12" rx="3"/><rect x="267" y="70" width="18" height="12" rx="3"/><rect x="290" y="70" width="18" height="12" rx="3"/>
          </g>
        `
      },
      umbrella: {
        bg1: '#EBF2F7', bg2: '#D5E4F0', ring: '#275274',
        book: { ...(DATA().VOLUME_BOOKS?.[1] || DATA().CAMBRIDGE_BOOKS?.[1]), persona: 'umbrella', num: 1 },
        deco: `
          <circle cx="294" cy="36" r="26" fill="#275274" opacity="0.09"/>
          <path d="M30 28 L24 44 M54 22 L48 38 M266 26 L260 42 M296 34 L290 50 M316 20 L310 36" stroke="#4D85B2" stroke-width="2" stroke-linecap="round" opacity="0.38"/>
          <path d="M224 94 C244 74 268 74 288 94 C300 106 312 106 328 92" stroke="#275274" stroke-width="2.2" opacity="0.24" fill="none"/>
        `
      },
      studio: {
        bg1: '#F7EFEA', bg2: '#ECDCD1', ring: '#8E4E34',
        book: { ...(DATA().ACTUAL_SETS?.[2] || DATA().ACTUAL_SETS?.[0]), persona: 'mic', num: 1 },
        deco: `
          <circle cx="52" cy="96" r="28" fill="#8E4E34" opacity="0.09"/>
          <g stroke="#8E4E34" stroke-width="3" stroke-linecap="round" opacity="0.28">
            <line x1="244" y1="68" x2="244" y2="90"/><line x1="254" y1="54" x2="254" y2="104"/>
            <line x1="264" y1="42" x2="264" y2="112"/><line x1="274" y1="58" x2="274" y2="98"/>
            <line x1="284" y1="48" x2="284" y2="108"/><line x1="294" y1="64" x2="294" y2="92"/>
          </g>
        `
      },
      compass: {
        bg1: '#EAF4F3', bg2: '#D2E7E4', ring: '#236360',
        book: DATA().CAMBRIDGE_BOOKS?.[7],
        deco: `
          <path d="M226 30 H314 V104 H226 Z" fill="#FFFFFF" fill-opacity="0.68" stroke="#236360" stroke-opacity="0.24" stroke-dasharray="4 3"/>
          <path d="M236 86 Q258 48 278 68 T306 44" stroke="#236360" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.5"/>
          <circle cx="242" cy="80" r="4.5" fill="#E5B95C" stroke="#236360" stroke-width="1.5"/>
          <circle cx="278" cy="68" r="4.5" fill="#236360"/>
          <circle cx="304" cy="46" r="4.5" fill="#B6424B"/>
        `
      }
    };
    const cfg = scenes[scene] || scenes.headphones;
    const miniTotoro = renderTotoroBookSvg(cfg.book, { suffix: `portal-${scene}`, readyCount: 1 });
    return `
      <div class="lp-portal-art" style="--lp-bg1:${cfg.bg1};--lp-bg2:${cfg.bg2};--lp-ring:${cfg.ring};">
        <svg class="lp-portal-bg-svg" viewBox="0 0 340 132" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          ${cfg.deco}
        </svg>
        <div class="lp-portal-totoro-wrap">${miniTotoro}</div>
      </div>
    `;
  }

  /* =========================================================
     VIEW 1: LISTENING PRACTICE PORTAL (4 DISTINCT STUDIO CARDS)
     ========================================================= */
  function renderPortal() {
    const root = getRoot();
    if (!root) return;
    const d = DATA();
    const sources = d.SOURCES || [];

    const cardsHtml = sources.map((s) => {
      let badgeText = s.shortBadge;
      if (s.id === 'cambridge' || s.id === 'volume' || s.id === 'actual') {
        const bks = getBooksForSource(s.id);
        const readyBks = bks.filter((b) => countReadyTestsInBook(b.id) > 0).length;
        badgeText = readyBks > 0 ? `${readyBks}/${bks.length} cuốn sẵn sàng` : `${bks.length} cuốn · Kệ 3×3`;
      } else if (s.id === 'map_studio') {
        const tasks = (window.APP_LISTENING_TASKS?.tasks || []).filter((t) => t.isMapTask || t.hasFullTests);
        badgeText = `${tasks.length || 11} bài Audio Neural`;
      }

      const secondaryBtn = s.id === 'map_studio'
        ? `<button type="button" class="tot-demo-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('map_studio')">Xem tất cả bài</button>`
        : `<button type="button" class="tot-demo-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('${esc(s.id)}')">Mở kệ 3×3</button>`;
      const primaryBtn = s.id === 'map_studio'
        ? `<button type="button" class="btn btn-primary tot-demo-btn" onclick="event.stopPropagation(); ListeningPracticeApp.launchTaskExam('lmap_01')">Làm Map 01 →</button>`
        : `<button type="button" class="btn btn-primary tot-demo-btn" onclick="event.stopPropagation(); ListeningPracticeApp.openSource('${esc(s.id)}', true)">Vào luyện ngay →</button>`;

      return `
        <article class="tot-exam-card lp-portal-card" data-lp-portal="${esc(s.id)}"
          onclick="ListeningPracticeApp.openSource('${esc(s.id)}')" role="button" tabindex="0">
          ${renderPortalSceneSvg(s.scene)}
          <div class="lp-portal-body">
            <div class="lp-portal-badges">
              <span class="lp-source-pill">${esc(s.label)}</span>
              <span class="lp-meta-pill tabular">${esc(badgeText)}</span>
            </div>
            <h3 class="lp-portal-title">${esc(s.bookTitle)}</h3>
            <p class="lp-portal-desc">${esc(s.desc)}</p>
            <div class="lp-portal-foot">
              ${secondaryBtn}
              ${primaryBtn}
            </div>
          </div>
        </article>
      `;
    }).join('');

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets lp-portal-shell">
        <div class="tot-shell-head lp-shell-head">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="tot-icon-tile" aria-hidden="true" style="width:38px;height:38px;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
            </span>
            <div>
              <h2 class="tot-shell-title">Luyện nghe · Listening Practice</h2>
              <p class="tot-shell-sub">Kệ sách Totoro 3×3 dành riêng cho IELTS Listening — chọn Cambridge 1–20, Real Volume 1–9, Recent Actual hoặc Map &amp; Note Studio.</p>
            </div>
          </div>
        </div>

        <div class="lp-portal-grid" id="lp-portal-grid">
          ${cardsHtml}
        </div>
      </div>
    `;
  }

  /* =========================================================
     VIEW 2: 3x3 TOTORO BOOKSHELF + BOOK DESK + PART 1..4 / FULL
     ========================================================= */
  function renderPartCard(item, isFull) {
    const prog = !isFull ? ListeningPracticeStore.getPartProgress(item) : null;
    const partLabel = isFull ? 'FULL TEST · 4 PARTS' : `PART ${item.partNum || 1}`;
    const types = Array.isArray(item.qTypes) ? item.qTypes : (isFull ? ['Part 1 → Part 4'] : ['Note Completion']);
    const scoreBadge = prog
      ? `<span class="lp-score-pill is-done tabular">✓ ${prog.score}/${prog.total}</span>`
      : `<span class="lp-score-pill">${item.isMap ? 'Bản đồ SVG' : 'Audio Neural'}</span>`;
    const onClick = isFull
      ? `ListeningPracticeApp.startFullTest('${esc(item.id)}')`
      : `ListeningPracticeApp.startPart('${esc(item.id)}')`;

    return `
      <article class="lp-part-card ${isFull ? 'is-full' : ''} ${item.isMap ? 'is-map' : ''}" onclick="${onClick}" role="button" tabindex="0">
        <div class="lp-part-top">
          <span class="lp-part-tag ${isFull ? 'is-full' : ''}">${esc(partLabel)}</span>
          ${scoreBadge}
        </div>
        <h4 class="lp-part-title">${esc(item.title)}</h4>
        <p class="lp-part-sub">${esc(item.subtitle || '')}</p>
        <div class="lp-part-meta">
          ${types.map((t) => `<span class="lp-qtype-chip">${esc(t)}</span>`).join('')}
          <span class="lp-qtype-chip tabular">${Number(item.questionsCount) || (isFull ? 40 : 10)} câu · ~${Number(item.durationMin) || (isFull ? 30 : 7)} phút</span>
        </div>
        <div class="lp-part-foot">
          <span class="lp-part-audio-note">Tự động phát 2 lượt (nghỉ 5s)</span>
          <button type="button" class="btn ${isFull ? 'btn-primary' : 'btn-subtle'} lp-part-go" onclick="event.stopPropagation(); ${onClick}">
            ${prog ? 'Làm lại →' : 'Làm bài →'}
          </button>
        </div>
      </article>
    `;
  }

  function renderMapStudioView(root, curSourceObj) {
    const tasks = window.APP_LISTENING_TASKS?.tasks || [];
    const mapTasks = tasks.filter((t) => t.isMapTask);
    const noteTasks = tasks.filter((t) => t.hasFullTests && !t.isMapTask);
    const shortFn = window.ListeningTasksModule?.shortTopicTitle;

    const toCardObj = (t, idx) => {
      const m = String(t.label || '').match(/Part\s*(\d)/i);
      const pNum = m ? Number(m[1]) : (t.isMapTask ? 2 : 1);
      return {
        id: `studio_${t.id}`,
        taskId: t.id,
        partNum: pNum,
        title: shortFn ? shortFn(t) : (t.topicTitle || t.theme || `Bài ${idx + 1}`),
        subtitle: t.isMapTask
          ? 'Bản đồ SVG tương tác — tự động phát 2 lượt, đối chiếu Transcript 3 màu và chấm vị trí trực tiếp.'
          : 'Note Completion chuẩn Cambridge — 10s chuẩn bị đọc đề, tự động phát 2 lượt và chấm chính tả tự động.',
        qTypes: [t.isMapTask ? 'Map Labelling (SVG)' : 'Note Completion', t.label || `Part ${pNum}`],
        questionsCount: t.isMapTask ? 6 : 8,
        durationMin: 6,
        isMap: !!t.isMapTask
      };
    };

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets lp-hub-shell">
        <div class="lp-hub-head">
          <div class="lp-hub-head-left">
            <button type="button" class="btn-subtle lp-btn-back" onclick="ListeningPracticeApp.openPortal()">← Practice</button>
            <div>
              <h2 class="tot-shell-title">${esc(curSourceObj?.bookTitle || 'Map & Note Studio')}</h2>
              <p class="tot-shell-sub">${esc(curSourceObj?.desc || '')}</p>
            </div>
          </div>
        </div>

        <section class="lp-section-block">
          <div class="lp-section-head">
            <h3 class="lp-section-title">Bản đồ SVG Tương tác · Part 2</h3>
            <span class="lp-section-badge tabular">${mapTasks.length} bài sẵn sàng</span>
          </div>
          <div class="lp-parts-grid is-three">
            ${mapTasks.map((t, i) => renderPartCard(toCardObj(t, i), false)).join('')}
          </div>
        </section>

        <section class="lp-section-block">
          <div class="lp-section-head">
            <h3 class="lp-section-title">Note Completion Chuẩn Cambridge · Part 1–4</h3>
            <span class="lp-section-badge tabular">${noteTasks.length} bài sẵn sàng</span>
          </div>
          <div class="lp-parts-grid is-three">
            ${noteTasks.map((t, i) => renderPartCard(toCardObj(t, i), false)).join('')}
          </div>
        </section>
      </div>
    `;
  }

  function renderHub() {
    const root = getRoot();
    if (!root) return;
    const d = DATA();
    const sources = d.SOURCES || [];
    const curSourceObj = sources.find((s) => s.id === state.source) || sources[0];

    if (state.source === 'map_studio') {
      renderMapStudioView(root, curSourceObj);
      return;
    }

    const books = getBooksForSource(state.source);
    let visibleBooks = books;
    if (state.source === 'cambridge') {
      if (state.camPage === 'mid') {
        visibleBooks = books.filter((b) => b.num <= 11 && b.num >= 3);
      } else if (state.camPage === 'classic') {
        visibleBooks = books.filter((b) => b.num <= 2);
      } else {
        visibleBooks = books.filter((b) => b.num >= 12); // Cam 20..12 = EXACT 9 books (3x3!)
      }
    }

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
      <div class="lp-range-tabs" role="tablist" aria-label="Chọn kệ Cambridge 3×3">
        <button type="button" role="tab" class="lp-range-tab ${state.camPage === 'recent' ? 'active' : ''}"
          aria-selected="${state.camPage === 'recent' ? 'true' : 'false'}"
          onclick="ListeningPracticeApp.setCamPage('recent')">★ Cam 20 – 12 <span class="lp-grid-tag">3×3</span></button>
        <button type="button" role="tab" class="lp-range-tab ${state.camPage === 'mid' ? 'active' : ''}"
          aria-selected="${state.camPage === 'mid' ? 'true' : 'false'}"
          onclick="ListeningPracticeApp.setCamPage('mid')">Cam 11 – 3 <span class="lp-grid-tag">3×3</span></button>
        <button type="button" role="tab" class="lp-range-tab ${state.camPage === 'classic' ? 'active' : ''}"
          aria-selected="${state.camPage === 'classic' ? 'true' : 'false'}"
          onclick="ListeningPracticeApp.setCamPage('classic')">Cam 2 – 1</button>
      </div>
    ` : `<span class="lp-shelf-grid-badge">Lưới kệ Totoro 3×3 · ${visibleBooks.length} cuốn</span>`;

    const totoroGridHtml = visibleBooks.map((bk) => {
      const readyTests = countReadyTestsInBook(bk.id);
      const tStatus = getBookTestStatusMap(bk.id);
      const active = state.selectedBookId === bk.id;
      const pipsHtml = [1, 2, 3, 4].map((t) => {
        const st = tStatus[t] || {};
        return `<span class="lp-pip ${st.done ? 'is-done' : (st.hasData ? 'is-ready' : '')}" title="Test ${t}"></span>`;
      }).join('');

      return `
        <button type="button"
          class="lp-totoro-card ${active ? 'is-active' : ''} ${readyTests > 0 ? 'has-data' : 'is-empty'}"
          style="--lp-fur:${bk.palette.fur};--lp-accent:${bk.palette.accent};"
          data-lp-book="${esc(bk.id)}"
          aria-pressed="${active ? 'true' : 'false'}"
          onclick="ListeningPracticeApp.selectBook('${esc(bk.id)}')">
          <div class="lp-card-top">
            <span class="lp-trait-chip">${esc(bk.tag)}</span>
            <span class="lp-band-chip tabular">${esc(bk.diff)}</span>
          </div>
          <div class="lp-totoro-stage">
            ${renderTotoroBookSvg(bk, { suffix: 'grid', readyCount: readyTests })}
          </div>
          <div class="lp-card-info">
            <div class="lp-card-title">${esc(bk.title)}</div>
            <div class="lp-card-foot">
              <span class="lp-pips" aria-label="Tiến độ 4 Test">${pipsHtml}</span>
              <span class="lp-ready-txt tabular ${readyTests > 0 ? 'is-ready' : ''}">
                ${readyTests > 0 ? `${readyTests}/${bk.testsCount} Tests` : 'Chờ nạp đề'}
              </span>
            </div>
          </div>
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
          aria-pressed="${isAct ? 'true' : 'false'}"
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
    const bankFile = d.BANK_META?.[state.source]?.file || `data/bank_listening_${state.source}.js`;

    let examListHtml = '';
    if (state.loadingBank === state.source) {
      examListHtml = `
        <div class="lp-empty-slot" role="status">
          <div class="lp-empty-title">Đang nạp ngân hàng đề Listening…</div>
          <p class="lp-empty-desc">Hệ thống đang tải danh sách audio và câu hỏi cho kệ sách này.</p>
        </div>
      `;
    } else if (!testParts.length && !testFulls.length) {
      examListHtml = `
        <div class="lp-empty-slot" role="status">
          <div class="lp-empty-mini-totoro">${renderTotoroBookSvg(curBook, { suffix: 'empty', readyCount: 0 })}</div>
          <div class="lp-empty-copy">
            <div class="lp-empty-title">${esc(curBook?.title || '')} · Test ${state.selectedTestNum} sẵn sàng nạp đề</div>
            <p class="lp-empty-desc">
              Khung 4 phần (<strong>Part 1 → Part 2 → Part 3 → Part 4 &amp; FULL TEST</strong>) đã dựng sẵn cho cuốn này.
              Import bộ đề vào <code>${esc(bankFile)}</code> với <code>bookId: '${esc(curBook?.id || '')}', testNum: ${state.selectedTestNum}</code> để mở khóa ngay.
            </p>
            <div class="lp-empty-actions">
              <button type="button" class="btn btn-primary lp-btn-sm" onclick="ListeningPracticeApp.jumpToFirstReady()">Mở bộ đề đang sẵn sàng →</button>
              <button type="button" class="btn-subtle lp-btn-sm" onclick="ListeningPracticeApp.openSource('map_studio')">Mở Map &amp; Note Studio</button>
            </div>
          </div>
        </div>
      `;
    } else {
      examListHtml = `
        ${testFulls.length ? `
          <div class="lp-section-block">
            <div class="lp-section-head">
              <h3 class="lp-section-title">FULL TEST · Trọn bộ 4 Part</h3>
              <span class="lp-section-badge">~30 phút · Chuẩn phòng thi Cambridge</span>
            </div>
            <div class="lp-parts-grid is-single">
              ${testFulls.map((ft) => renderPartCard(ft, true)).join('')}
            </div>
          </div>
        ` : ''}
        <div class="lp-section-block">
          <div class="lp-section-head">
            <h3 class="lp-section-title">Luyện từng phần · Part 1 – Part 4</h3>
            <span class="lp-section-badge tabular">${testParts.length} phần sẵn sàng</span>
          </div>
          <div class="lp-parts-grid">
            ${testParts.map((p) => renderPartCard(p, false)).join('')}
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets lp-hub-shell">
        <div class="lp-hub-head">
          <div class="lp-hub-head-left">
            <button type="button" class="btn-subtle lp-btn-back" id="lp-btn-back-portal" onclick="ListeningPracticeApp.openPortal()">← Practice</button>
            <div>
              <h2 class="tot-shell-title">${esc(curSourceObj?.bookTitle || 'Listening Practice')}</h2>
              <p class="tot-shell-sub">${esc(curSourceObj?.desc || '')}</p>
            </div>
          </div>
          <div class="lp-hub-head-right">
            <span class="lp-shelf-stat tabular">${readyBooksCount}/${books.length} cuốn sẵn sàng</span>
          </div>
        </div>

        <section class="lp-shelf-section" aria-label="Kệ sách Totoro 3×3">
          <div class="lp-shelf-toolbar">
            <div class="lp-shelf-heading">Chọn cuốn sách Totoro của bạn</div>
            ${groupTabsHtml}
          </div>

          <div class="lp-totoro-grid" id="lp-totoro-grid" role="group" aria-label="Danh sách cuốn Listening 3×3">
            ${totoroGridHtml}
          </div>
        </section>

        <section class="lp-book-desk" id="lp-book-desk" aria-label="Chi tiết cuốn sách đang chọn">
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
          <div class="lp-test-tabs" id="lp-test-tabs" role="group" aria-label="Chọn Test 1 đến Test 4">
            ${testTabsHtml}
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
    render();
  }

  function openSource(src, jumpReady) {
    state.source = src || 'cambridge';
    state.view = 'source';
    if (state.source === 'cambridge') {
      state.camPage = 'recent';
      state.selectedBookId = 'lcam_20';
    } else if (state.source === 'volume') {
      state.selectedBookId = 'lvol_1';
    } else if (state.source === 'actual') {
      state.selectedBookId = 'lact_1';
    }
    state.selectedTestNum = 1;
    render();
    ensureSourceBankLoaded(state.source).then(() => {
      if (state.view === 'source' && state.source === src) {
        if (jumpReady) {
          const bks = getBooksForSource(state.source);
          const readyBk = bks.find((b) => countReadyTestsInBook(b.id) > 0);
          if (readyBk) state.selectedBookId = readyBk.id;
        }
        render();
      }
    });
  }

  function setCamPage(page) {
    state.camPage = ['recent', 'mid', 'classic'].includes(page) ? page : 'recent';
    render();
  }

  function selectBook(bookId) {
    state.selectedBookId = bookId;
    const status = getBookTestStatusMap(bookId);
    const firstReadyTest = [1, 2, 3, 4].find((t) => status[t]?.hasData);
    state.selectedTestNum = firstReadyTest || 1;
    render();
    setTimeout(() => {
      const desk = document.getElementById('lp-book-desk');
      if (desk && typeof desk.scrollIntoView === 'function') {
        desk.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 40);
  }

  function selectTestNum(tNum) {
    state.selectedTestNum = Math.max(1, Math.min(4, Number(tNum) || 1));
    render();
  }

  function jumpToFirstReady() {
    const d = DATA();
    const readyPart = Object.values(d.PARTS || {})[0];
    if (!readyPart) {
      openSource('map_studio');
      return;
    }
    state.source = readyPart.source || 'cambridge';
    state.view = 'source';
    if (state.source === 'cambridge') {
      const bk = (d.CAMBRIDGE_BOOKS || []).find((b) => b.id === readyPart.bookId);
      state.camPage = bk && bk.num <= 2 ? 'classic' : (bk && bk.num <= 11 ? 'mid' : 'recent');
    }
    state.selectedBookId = readyPart.bookId || 'lcam_20';
    state.selectedTestNum = readyPart.testNum || 1;
    render();
    setTimeout(() => {
      document.getElementById('lp-book-desk')?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function launchTaskExam(taskId) {
    if (!taskId) return;
    if (window.ListeningTasksModule?.openExam) {
      window.ListeningTasksModule.openExam(taskId, 3, { fromPractice: true });
    } else {
      toast('Đang khởi tạo trình phát đề Listening…');
    }
  }

  function startPart(partId) {
    const d = DATA();
    let part = d.PARTS?.[partId];
    if (!part && String(partId).startsWith('studio_')) {
      const tid = String(partId).slice('studio_'.length);
      launchTaskExam(tid);
      return;
    }
    if (!part) {
      toast('Không tìm thấy dữ liệu bài nghe này.');
      return;
    }
    if (part.taskId) {
      launchTaskExam(part.taskId);
      return;
    }
    toast('Đề này đã sẵn sàng khung dữ liệu — sẽ mở trình phát ngay khi nạp audio.');
  }

  function startFullTest(fullId) {
    const d = DATA();
    const ft = (d.FULL_TESTS || []).find((x) => x.id === fullId);
    if (!ft || !Array.isArray(ft.partIds) || !ft.partIds.length) {
      toast('Không tìm thấy dữ liệu Full Test.');
      return;
    }
    const firstPart = d.PARTS?.[ft.partIds[0]];
    if (firstPart?.taskId) {
      toast(`Bắt đầu ${ft.title} — Part 1 trước, lần lượt đến Part 4!`);
      launchTaskExam(firstPart.taskId);
    } else {
      toast('Full Test đang chờ nạp audio.');
    }
  }

  function render() {
    if (state.view === 'source') {
      renderHub();
    } else {
      renderPortal();
    }
  }

  window.ListeningPracticeApp = {
    render,
    openPortal,
    openSource,
    setCamPage,
    selectBook,
    selectTestNum,
    jumpToFirstReady,
    launchTaskExam,
    startPart,
    startFullTest,
    renderTotoroBookSvg,
    getState: () => ({ ...state })
  };
})();
