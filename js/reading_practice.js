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
      this.save(st);
    },

    saveInProgress(draft) {
      const st = this.load();
      st.inProgress = draft;
      this.save(st);
    },

    clearInProgress() {
      const st = this.load();
      st.inProgress = null;
      this.save(st);
    },

    getInProgress() { return this.load().inProgress; },
    getHistory() { return this.load().history; },

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
  function getAppWordMap() {
    if (_appWordMap) return _appWordMap;
    const map = new Map();
    const d = (typeof APP_DATA !== 'undefined' ? APP_DATA : window.APP_DATA) || {};
    [d.file1_paraphrase_1500 || [], d.file2_families_3500 || [], d.signal_words || []].forEach((arr) => {
      arr.forEach((it) => {
        if (!it || !it.lemma) return;
        const k = String(it.lemma).trim().toLowerCase();
        if (k && !map.has(k)) map.set(k, it);
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

  function lookupWordEntry(rawWord, passage) {
    const clean = String(rawWord || '').trim().replace(/^[^a-zA-Z]+|[^a-zA-Z-]+$/g, '');
    const lower = clean.toLowerCase();
    const gloss = passage?.glossary || {};
    const appMap = getAppWordMap();
    const ipaDict = (typeof IPA_DICT !== 'undefined' ? IPA_DICT : window.IPA_DICT) || {};

    for (const cand of stemCandidates(lower)) {
      if (gloss[cand]) {
        const g = gloss[cand];
        return { word: clean, lemma: cand, ipa: g.ipa || ipaDict[cand] || '', pos: g.pos || 'word', vi: g.vi || '', synonyms: Array.isArray(g.syn) ? g.syn : [], found: true };
      }
    }
    for (const cand of stemCandidates(lower)) {
      const cat = appMap.get(cand);
      if (cat) {
        return { word: clean, lemma: cat.lemma || clean, ipa: cat.ipa || ipaDict[cand] || '', pos: cat.pos || 'word', vi: cat.clean_meaning || cat.definition || '', synonyms: Array.isArray(cat.synonyms) ? cat.synonyms.slice(0, 4) : [], found: true };
      }
    }
    return { word: clean, lemma: clean, ipa: ipaDict[lower] || '', pos: 'word', vi: '', synonyms: [], found: false };
  }

  /* =========================================================
     3. READING PRACTICE APP CONTROLLER
     ========================================================= */
  const state = {
    view: 'portal',         // 'portal' | 'source' | 'exam'
    source: 'cambridge',    // 'cambridge' | 'volume' | 'actual' | 'news'
    camGroup: 'recent',     // 'recent' (Cam 10-20) | 'all' (Cam 1-20)
    selectedBookId: 'cam_20',
    selectedTestNum: 1,     // 1..4
    partFilter: 'all',      // 'all' | 'p1' | 'p2' | 'p3' | 'full'
    newsTopic: 'all',
    searchQuery: '',

    session: null,
    timerId: null,
    dictTarget: null,
    splitRatio: 50,
    mobilePane: 'passage',
    selectedHeadingKey: null // for tap-to-assign Matching Headings on touch/click
  };

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

  function buildResumeBannerHtml() {
    const inProg = ReadingPracticeStore.getInProgress();
    if (!inProg) return '';
    return `
      <div class="rp-resume-banner">
        <div class="rp-resume-info">
          <span class="rp-resume-dot"></span>
          <div>
            <div class="rp-resume-title">Đang làm dở: <strong>${esc(inProg.title)}</strong></div>
            <div class="rp-resume-sub">Đã trả lời ${Object.keys(inProg.answers || {}).length}/${inProg.totalQuestions || 0} câu · Còn ${formatDuration(inProg.remainingSec)}</div>
          </div>
        </div>
        <div class="rp-resume-actions">
          <button type="button" class="btn-subtle rp-btn-sm" onclick="ReadingPracticeApp.discardResume()">Bỏ dở</button>
          <button type="button" class="btn btn-primary rp-btn-sm" onclick="ReadingPracticeApp.resumeDraft()">Làm tiếp →</button>
        </div>
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

    const cardsHtml = sources.map((s) => {
      const srcHist = hist.filter((h) => h.source === s.id);
      const avgBand = srcHist.length
        ? (Math.round((srcHist.reduce((acc, x) => acc + (Number(x.band) || 0), 0) / srcHist.length) * 2) / 2).toFixed(1)
        : null;

      let rightBadge = avgBand ? `Band ${avgBand}` : '';
      if (!rightBadge) {
        if (s.id === 'cambridge') rightBadge = '20 bộ · Cam 1–20';
        else if (s.id === 'volume') rightBadge = '6 tập · Vol 1–6';
        else if (s.id === 'actual') rightBadge = '2023 – 2026';
        else rightBadge = `${allPassages.filter((p) => p.source === 'news').length} bài báo`;
      }

      const actionsHtml = s.id === 'news'
        ? `
          <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('news')">Chọn chủ đề</button>
          <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('news')">Đọc báo ngay</button>
        `
        : `
          <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('${esc(s.id)}', 'all')">Chọn bộ đề</button>
          <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('${esc(s.id)}', 'full')">Làm Full Test</button>
        `;

      return `
        <div class="tot-exam-card ink-brackets has-stamp rp-portal-card" data-rp-portal="${esc(s.id)}"
          onclick="ReadingPracticeApp.openSource('${esc(s.id)}')" role="button" tabindex="0">
          ${stampById[s.id] || stampById.cambridge}
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <span class="tot-pos-badge">${esc(s.label)}</span>
              <span class="tot-hist-badge ${s.id === 'news' ? 'info' : 'tabular'}">${esc(rightBadge)}</span>
            </div>
            <div class="rp-portal-title" style="font-size:15px;font-weight:750;margin-top:8px;color:var(--ink);">${esc(s.bookTitle || s.label)}</div>
            <div style="font-size:12.5px;color:var(--ink-2);margin-top:4px;line-height:1.5;">${esc(s.desc)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;gap:8px;padding-top:10px;border-top:1px solid var(--border);position:relative;z-index:1;">
            ${actionsHtml}
          </div>
        </div>
      `;
    }).join('');

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets has-stamp">
        <svg class="ghibli-stamp" style="right:26px;bottom:22px;width:116px;height:116px;opacity:0.09;" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <circle cx="32" cy="32" r="29" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/>
          <path d="M32 7V12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <path d="M12 24C16 14 23 11 32 11C41 11 48 14 52 24C47 21.8 42 21.8 38 23.5C34 21.6 30 21.6 26 23.5C22 21.8 17 21.8 12 24Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round" fill="currentColor" fill-opacity=".1"/>
          <path d="M32 22V39C32 41.2 34.4 42 35.4 40" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>
          <path d="M22 29L19.5 21L26 25.5C29.5 24.5 34.5 24.5 38 25.5L44.5 21L42 29C47 33 49 40 48.5 47.5C47.8 53.5 41.5 56.5 32 56.5C22.5 56.5 16.2 53.5 15.5 47.5C15 40 17 33 22 29Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <circle cx="25.5" cy="32.5" r="1.9" fill="currentColor"/><circle cx="38.5" cy="32.5" r="1.9" fill="currentColor"/>
        </svg>
        <div class="tot-shell-head">
          <div style="display:flex;align-items:center;gap:10px;">
            <span class="tot-icon-tile info" aria-hidden="true" style="width:36px;height:36px;">
              <svg viewBox="2 2 24 24" fill="none">
                <path d="M8.5 11.2L7 5.6L11.2 9C12.5 8.5 14 8.5 15.3 9L19.5 5.6L18 11.2C20.2 12.8 21.2 15.2 21 18.2C20.7 21.5 17.8 23.2 13.2 23.2C8.6 23.2 5.7 21.5 5.4 18.2C5.2 15.2 6.2 12.8 8.5 11.2Z" fill="#6B92B8" stroke="#3F5C78" stroke-width="1.1"/>
                <ellipse cx="13.2" cy="18.8" rx="5.2" ry="3.4" fill="#FBF6E8"/>
                <circle cx="10.6" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="10.8" cy="13.5" r="0.75" fill="#181A1F"/>
                <circle cx="15.8" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="15.6" cy="13.5" r="0.75" fill="#181A1F"/>
              </svg>
            </span>
            <div>
              <h2 class="tot-shell-title">Luyện đọc · Practice</h2>
              <p class="tot-shell-sub">Chọn kho đề Cambridge 1–20, Volume 1–6, Actual Tests hoặc đọc báo học thuật News.</p>
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

    const sourceTabsHtml = sources.map((s) => `
      <button type="button" class="rp-source-tab ${state.source === s.id ? 'active' : ''}"
        data-rp-source="${esc(s.id)}" onclick="ReadingPracticeApp.setSource('${esc(s.id)}')">
        <span>${esc(s.label)}</span>
      </button>
    `).join('');

    const q = state.searchQuery.trim().toLowerCase();
    const matchesSearch = (obj) => {
      if (!q) return true;
      const hay = `${obj.title || ''} ${obj.subtitle || ''} ${obj.topic || ''} ${obj.series || ''}`.toLowerCase();
      return hay.includes(q);
    };

    let shelfHtml = '';
    let subBarHtml = '';
    let contentHtml = '';

    if (!isNews) {
      const books = getBooksForSource(state.source);
      if (!books.some((b) => b.id === state.selectedBookId) && books.length) {
        const firstReady = books.find((b) => countReadyTestsInBook(b.id) > 0) || books[0];
        state.selectedBookId = firstReady.id;
        state.selectedTestNum = 1;
      }

      const visibleBooks = (state.source === 'cambridge' && state.camGroup === 'recent')
        ? books.filter((b) => b.group === 'recent')
        : books;

      const camGroupToggle = state.source === 'cambridge' ? `
        <div class="rp-book-group-toggle">
          <button type="button" class="rp-mini-tab ${state.camGroup === 'recent' ? 'active' : ''}"
            onclick="ReadingPracticeApp.setCamGroup('recent')">Cam 10 – 20 (Trọng tâm)</button>
          <button type="button" class="rp-mini-tab ${state.camGroup === 'all' ? 'active' : ''}"
            onclick="ReadingPracticeApp.setCamGroup('all')">Tất cả Cam 1 – 20 (${books.length} cuốn)</button>
        </div>
      ` : '';

      const bookPillsHtml = visibleBooks.map((bk) => {
        const readyTests = countReadyTestsInBook(bk.id);
        const active = state.selectedBookId === bk.id;
        return `
          <button type="button" class="rp-book-pill ${active ? 'active' : ''} ${readyTests > 0 ? 'has-data' : 'is-empty'}"
            data-rp-book="${esc(bk.id)}" onclick="ReadingPracticeApp.selectBook('${esc(bk.id)}')">
            <span class="rp-book-name">${esc(bk.shortLabel)}</span>
            <span class="rp-book-dot">${readyTests > 0 ? `${readyTests}/${bk.testsCount}` : 'Sắp nạp'}</span>
          </button>
        `;
      }).join('');

      const curBook = books.find((b) => b.id === state.selectedBookId) || books[0];
      const bookPassages = Object.values(d.PASSAGES || {}).filter((p) => p.bookId === curBook?.id);
      const bookFullTests = (d.FULL_TESTS || []).filter((t) => t.bookId === curBook?.id);

      // 4 Test tabs inside the selected Book
      const testTabsHtml = [1, 2, 3, 4].map((tNum) => {
        const hasP = bookPassages.some((p) => (p.testNum || 1) === tNum);
        const isAct = state.selectedTestNum === tNum;
        return `
          <button type="button" class="rp-test-tab ${isAct ? 'active' : ''} ${hasP ? 'has-data' : 'is-empty'}"
            data-rp-test="${tNum}" onclick="ReadingPracticeApp.selectTestNum(${tNum})">
            <span>Test ${tNum}</span>
            <small>${hasP ? 'Sẵn sàng' : 'Trống'}</small>
          </button>
        `;
      }).join('');

      shelfHtml = `
        <div class="rp-shelf-box">
          <div class="rp-shelf-top">
            <div class="rp-shelf-label">${state.source === 'cambridge' ? 'Chọn cuốn Cambridge' : (state.source === 'volume' ? 'Chọn tập Volume' : 'Chọn năm Actual Tests')}</div>
            ${camGroupToggle}
          </div>
          <div class="rp-book-rail" id="rp-book-rail">${bookPillsHtml}</div>
          <div class="rp-book-detail-head">
            <div>
              <strong class="rp-cur-book-title">${esc(curBook?.title || '')}</strong>
              <span class="rp-cur-book-sub">4 Tests · Chọn từng Passage 1–3 hoặc làm trọn bộ FULL TEST chuẩn phòng thi máy</span>
            </div>
            <div class="rp-test-tabs" id="rp-test-tabs">${testTabsHtml}</div>
          </div>
        </div>
      `;

      // Exact order required by user: Passage 1 -> Passage 2 -> Passage 3 -> FULL TEST
      const parts = [
        { id: 'all', label: 'Tất cả' },
        { id: 'p1', label: 'Passage 1' },
        { id: 'p2', label: 'Passage 2' },
        { id: 'p3', label: 'Passage 3' },
        { id: 'full', label: 'FULL TEST' }
      ];
      subBarHtml = `
        <div class="rp-part-tabs" role="tablist" aria-label="Chọn phần bài đọc">
          ${parts.map((pt) => `
            <button type="button" class="rp-part-pill ${state.partFilter === pt.id ? 'active' : ''} ${pt.id === 'full' ? 'is-full' : ''}"
              data-rp-part="${pt.id}" onclick="ReadingPracticeApp.setPartFilter('${pt.id}')">${pt.label}</button>
          `).join('')}
        </div>
      `;

      const testPassages = bookPassages.filter((p) => (p.testNum || 1) === state.selectedTestNum);
      const testFulls = bookFullTests.filter((t) => (t.testNum || 1) === state.selectedTestNum);

      if (!testPassages.length && !testFulls.length && !q) {
        contentHtml = `
          <div class="rp-unloaded-box">
            <div class="rp-unloaded-title">${esc(curBook?.title || '')} · Test ${state.selectedTestNum} chưa nạp đề</div>
            <p class="rp-unloaded-desc">Khung danh mục đã sẵn sàng đủ 4 phần (<strong>Passage 1 → Passage 2 → Passage 3 → FULL TEST</strong>). Bạn chỉ cần thêm bài vào <code>data/reading_practice_data.js</code> với <code>bookId: '${esc(curBook?.id || '')}', testNum: ${state.selectedTestNum}</code> là đề sẽ tự hiện tại đây.</p>
            <button type="button" class="btn btn-primary rp-btn-sm" onclick="ReadingPracticeApp.jumpToFirstReady('${esc(state.source)}')">Mở bộ đề đang sẵn sàng →</button>
          </div>
        `;
      } else {
        const sections = [
          { key: 'p1', title: 'Passage 1', badge: '20 phút · Dễ → Trung bình', items: testPassages.filter((p) => p.passageNum === 1 && matchesSearch(p)), isFull: false },
          { key: 'p2', title: 'Passage 2', badge: '20 phút · Trung bình → Khá', items: testPassages.filter((p) => p.passageNum === 2 && matchesSearch(p)), isFull: false },
          { key: 'p3', title: 'Passage 3', badge: '20 phút · Nâng cao Band 7.5+', items: testPassages.filter((p) => p.passageNum === 3 && matchesSearch(p)), isFull: false },
          { key: 'full', title: 'FULL TEST', badge: '60 phút · Trọn bộ 3 Passage', items: testFulls.filter(matchesSearch), isFull: true }
        ].filter((sec) => state.partFilter === 'all' || state.partFilter === sec.key);

        contentHtml = sections.map((sec) => `
          <div class="rp-section-block" data-rp-section="${sec.key}">
            <div class="rp-section-head">
              <h3 class="rp-section-title">${esc(sec.title)}</h3>
              <span class="rp-section-badge">${esc(sec.badge)}</span>
            </div>
            ${sec.items.length
              ? `<div class="rp-cards-grid">${sec.items.map((it) => renderHubCard(it, sec.isFull)).join('')}</div>`
              : `<div class="rp-empty-inline">Không có đề khớp trong mục ${esc(sec.title)}.</div>`}
          </div>
        `).join('');
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

    root.innerHTML = `
      <div class="rp-hub-shell tot-section-shell ink-brackets">
        <div class="rp-hub-head">
          <div style="display:flex;align-items:flex-start;gap:12px;flex-wrap:wrap;">
            <button type="button" class="btn-subtle rp-btn-sm" id="rp-btn-back-portal" onclick="ReadingPracticeApp.openPortal()">← Practice</button>
            <div>
              <h2 class="tot-shell-title">${esc(curSourceObj?.bookTitle || curSourceObj?.label || 'Practice')}</h2>
              <p class="tot-shell-sub">${esc(curSourceObj?.desc || '')}</p>
            </div>
          </div>
          <div class="rp-source-bar" role="tablist" aria-label="Nguồn đề đọc">
            ${sourceTabsHtml}
          </div>
        </div>

        ${buildResumeBannerHtml()}
        ${shelfHtml}

        <div class="rp-filter-toolbar">
          ${subBarHtml}
          <input type="search" class="rp-search-input" id="rp-hub-search"
            value="${esc(state.searchQuery)}"
            placeholder="Tìm theo tên bài, chủ đề..."
            oninput="ReadingPracticeApp.onSearch(this.value)" autocomplete="off">
        </div>

        <div class="rp-sections-stack">
          ${contentHtml}
        </div>
      </div>
    `;
  }

  function renderHubCard(item, isFull, isNews = false) {
    const best = ReadingPracticeStore.getBestAttempt(item.id);
    const totalQ = isFull
      ? item.passageIds.reduce((sum, pid) => sum + getAllQuestionsInPassage(DATA().PASSAGES[pid] || {}).length, 0)
      : getAllQuestionsInPassage(item).length;

    const pillLabel = isNews
      ? (item.newsSource || item.topic || 'News')
      : (isFull ? 'FULL TEST · 3 Passages' : `Passage ${item.passageNum}`);

    const scoreBadge = best
      ? `<span class="rp-done-badge">✓ Band ${best.band.toFixed(1)} · ${best.score}/${best.total}</span>`
      : `<span class="rp-meta-pill">${esc(item.targetBand || 'IELTS')}</span>`;

    const qTypes = isFull ? ['Passage 1–3', 'Full 60 phút'] : getPassageTypes(item);

    const startCall = isFull
      ? `ReadingPracticeApp.startFullTest('${esc(item.id)}')`
      : `ReadingPracticeApp.startPassage('${esc(item.id)}')`;

    const reviewCall = isFull
      ? `ReadingPracticeApp.startFullTest('${esc(item.id)}', { openInReview: true })`
      : `ReadingPracticeApp.startPassage('${esc(item.id)}', { openInReview: true })`;

    return `
      <article class="rp-card ${isFull ? 'rp-card-full' : ''}" data-rp-item="${esc(item.id)}">
        <div class="rp-card-top">
          <span class="rp-tag ${isFull ? 'is-full' : isNews ? 'is-news' : ''}">${esc(pillLabel)}</span>
          ${scoreBadge}
        </div>
        <div class="rp-card-series">${esc(item.series || item.topic || '')}</div>
        <h4 class="rp-card-title">${esc(item.title)}</h4>
        <p class="rp-card-sub">${esc(item.subtitle || '')}</p>
        <div class="rp-card-tags">
          ${qTypes.map((qt) => `<span class="rp-qtype-tag">${esc(qt)}</span>`).join('')}
        </div>
        <div class="rp-card-meta">
          <span>${totalQ} câu hỏi</span>
          <span>·</span>
          <span>${item.suggestedMins || 20} phút</span>
        </div>
        <div class="rp-card-foot">
          ${isNews
            ? `<button type="button" class="btn-subtle rp-btn-sm" onclick="${reviewCall}">Đọc song ngữ</button>`
            : (best ? `<button type="button" class="btn-subtle rp-btn-sm" onclick="${reviewCall}">Xem giải</button>` : '<span></span>')}
          <button type="button" class="btn btn-primary rp-btn-sm" onclick="${startCall}">
            ${isNews ? 'Đọc & Làm bài →' : (isFull ? 'Làm Full Test →' : 'Làm bài →')}
          </button>
        </div>
      </article>
    `;
  }

  /* =========================================================
     6. INSPERA 1:1 FULL-SCREEN CD-IELTS EXAM ENGINE
     ========================================================= */
  function startSession(config) {
    stopTimer();
    const totalSec = (config.suggestedMins || 20) * 60;
    const isNews = config.source === 'news';
    state.session = {
      itemId: config.itemId,
      title: config.title,
      source: config.source,
      isFull: !!config.isFull,
      isNews,
      deckDefaultName: config.deckDefaultName || config.title,
      passageIds: config.passageIds,
      activePassageIdx: 0,
      mode: config.openInReview ? 'review' : 'exam',
      // Default to official CD-IELTS Black-on-White ('cd') for exam authenticity; News defaults to Totoro Washi
      contrast: isNews ? 'totoro' : 'cd', // 'cd' | 'totoro' | 'dark' | 'yellow'
      textSize: 'regular',                // 'regular' | 'large' | 'xlarge'
      optionsOpen: false,
      showBilingual: !!config.openInReview && isNews,
      totalSec,
      remainingSec: config.remainingSec ?? totalSec,
      elapsedSec: config.elapsedSec ?? 0,
      paused: false,
      answers: config.answers ? { ...config.answers } : {},
      flagged: config.flagged ? { ...config.flagged } : {},
      struck: config.struck ? { ...config.struck } : {},
      notes: Array.isArray(config.notes) ? config.notes.slice() : [],
      notesOpen: false,
      activeQid: null,
      activeEvidenceId: null,
      reviewResult: null
    };
    state.view = 'exam';
    state.mobilePane = 'passage';
    state.dictTarget = null;
    state.selectedHeadingKey = null;
    document.body.classList.add('rp-exam-fullscreen');

    if (state.session.mode === 'exam') {
      startTimer();
    } else if (config.openInReview) {
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
    if (!state.session || state.session.mode !== 'exam') return;
    ReadingPracticeStore.saveInProgress({
      itemId: state.session.itemId,
      title: state.session.title,
      source: state.session.source,
      isFull: state.session.isFull,
      deckDefaultName: state.session.deckDefaultName,
      passageIds: state.session.passageIds,
      remainingSec: state.session.remainingSec,
      elapsedSec: state.session.elapsedSec,
      totalQuestions: getAllSessionQuestions().length,
      answers: state.session.answers,
      flagged: state.session.flagged,
      struck: state.session.struck,
      notes: state.session.notes,
      updatedAt: Date.now()
    });
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

  function renderPassageParagraphHtml(para, passage, enableDictClick, isReview) {
    const s = state.session;
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
    const parts = raw.split(/(<ev id="[^"]+">[\s\S]*?<\/ev>)/g);
    const enHtml = parts.map((chunk) => {
      const m = chunk.match(/^<ev id="([^"]+)">([\s\S]*?)<\/ev>$/);
      if (m) {
        const activeCls = s?.activeEvidenceId === m[1] ? ' rp-evidence-active' : '';
        return `<span class="rp-ev-span${activeCls}" data-ev-id="${esc(m[1])}">${tokenWrap(m[2])}</span>`;
      }
      return tokenWrap(chunk);
    }).join('');

    // Inspera Dashed Blue Drop Zone above paragraph for Matching Headings (like step_41_shot_2!)
    let dropZoneHtml = '';
    const mh = getMatchingHeadingForPara(passage, para.label);
    if (mh) {
      const qid = `${passage.id}__q${mh.q.num}`;
      const pickedKey = String(s.answers[qid] || '');
      const pickedObj = (mh.group.headings || []).find((h) => h.key === pickedKey);
      const isOk = isReview && isAnswerCorrect(mh.q, pickedKey);
      const cls = `ins-dropzone${pickedObj ? ' is-filled' : ''}${state.selectedHeadingKey && !isReview ? ' is-awaiting' : ''}${isReview ? (isOk ? ' is-ok' : ' is-bad') : ''}`;
      dropZoneHtml = `
        <div class="${cls}" data-mh-qid="${esc(qid)}"
          ondragover="event.preventDefault(); this.classList.add('is-over');"
          ondragleave="this.classList.remove('is-over');"
          ondrop="ReadingPracticeApp.onDropHeading(event, '${esc(qid)}')"
          onclick="ReadingPracticeApp.onClickDropZone('${esc(qid)}')">
          ${pickedObj
            ? `<span class="ins-dz-num">${mh.q.num}</span><span class="ins-dz-text">${esc(pickedObj.text)}</span>${!isReview ? `<button type="button" class="ins-dz-clear" onclick="event.stopPropagation(); ReadingPracticeApp.clearHeading('${esc(qid)}')" title="Gỡ tiêu đề">✕</button>` : ''}`
            : `<span class="ins-dz-placeholder">${mh.q.num}</span>`}
        </div>
      `;
    }

    const viBlock = (s?.showBilingual && para.vi)
      ? `<div class="rp-para-vi">${esc(para.vi)}</div>`
      : '';

    return `
      <div class="ins-para-block" data-para-label="${esc(para.label || '')}">
        ${dropZoneHtml}
        <p class="ins-para-en">
          ${para.label ? `<strong class="ins-para-lbl">${esc(para.label)}</strong> ` : ''}
          <span class="rp-para-text">${enHtml}</span>
        </p>
        ${viBlock}
      </div>
    `;
  }

  /* ---------- RENDER FULL-SCREEN INSPERA WORKSPACE ---------- */
  function renderExamWorkspace() {
    const root = getRoot();
    if (!root || !state.session) return;
    const s = state.session;
    const passages = getSessionPassages();
    const curPassage = passages[s.activePassageIdx] || passages[0];
    if (!curPassage) return;

    const isReview = s.mode === 'review';
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

    const contrastCls = `ins-contrast-${s.contrast || 'cd'}`;
    const sizeCls = `ins-size-${s.textSize || 'regular'}`;
    const timerUrgency = s.remainingSec <= 300 ? ' is-critical' : (s.remainingSec <= 600 ? ' is-warn' : '');

    // Review Summary Strip (only visible AFTER submitting)
    const reviewStripHtml = isReview && s.reviewResult ? `
      <div class="ins-review-strip">
        <div class="rp-rev-metric is-band">
          <span>Band dự kiến</span>
          <strong class="tabular">${s.reviewResult.band.toFixed(1)}</strong>
        </div>
        <div class="rp-rev-metric">
          <span>Đúng</span>
          <strong class="tabular">${s.reviewResult.score} / ${s.reviewResult.total}</strong>
        </div>
        <div class="rp-rev-metric">
          <span>Thời gian</span>
          <strong class="tabular">${formatDuration(s.reviewResult.elapsedSec)}</strong>
        </div>
        <div class="rp-rev-types">
          ${s.reviewResult.byType.map((t) => `<span class="rp-type-chip">${esc(t.label)}: <strong>${t.correct}/${t.total}</strong></span>`).join('')}
        </div>
        <div class="rp-rev-actions">
          <button type="button" class="btn-subtle rp-btn-sm ${s.showBilingual ? 'is-on' : ''}" id="rp-btn-bilingual"
            onclick="ReadingPracticeApp.toggleBilingual()">
            ${s.showBilingual ? '✓ Đang hiện Song ngữ' : 'Dịch song ngữ'}
          </button>
          <button type="button" class="btn-subtle rp-btn-sm" onclick="ReadingPracticeApp.retryCurrent()">Làm lại</button>
          <button type="button" class="btn btn-primary rp-btn-sm" onclick="ReadingPracticeApp.exitToHub()">← Về kho đề</button>
        </div>
      </div>
    ` : '';

    // Inspera Part Sub-Banner (full-width light gray card right under header!)
    const partLabel = s.isNews ? (curPassage.newsSource || 'Academic News') : `Part ${curPassage.passageNum || (s.activePassageIdx + 1)}`;
    const partSubText = s.isNews
      ? `Bấm vào bất kỳ từ nào để tra nghĩa & lưu vào "Từ của tôi" · ${curQs.length} câu kiểm tra nhanh.`
      : `Read the text and answer questions ${qMin}–${qMax}.`;

    const groupsHtml = (curPassage.groups || []).map((g) => renderQuestionGroup(g, curPassage, isReview)).join('');

    // Inspera Bottom Navigator Bar: Active Part expands [1][2]...[13] with green top dash; inactive Parts collapse "Part 2  0 of 13"
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
        let cls = 'ins-qbox';
        if (isCur) cls += ' is-current';
        if (isReview) {
          cls += isAnswerCorrect(q, val) ? ' is-correct' : ' is-wrong';
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

    // Inspera Official Options Overlay (like step_32.png!)
    const optionsOverlayHtml = `
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
            <div class="ins-opt-sec-title">Contrast (Màu nền phòng thi)</div>
            <div class="ins-opt-choices">
              <button type="button" class="ins-opt-row ${s.contrast === 'cd' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('cd')">
                <span>Black on white <small>(Chuẩn thi máy CD-IELTS)</small></span><span>${s.contrast === 'cd' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.contrast === 'totoro' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('totoro')">
                <span>Totoro Washi <small>(Giấy ấm dịu mắt)</small></span><span>${s.contrast === 'totoro' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.contrast === 'dark' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('dark')">
                <span>White on black <small>(Nền tối chuẩn Inspera)</small></span><span>${s.contrast === 'dark' ? '✓' : ''}</span>
              </button>
              <button type="button" class="ins-opt-row ${s.contrast === 'yellow' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('yellow')">
                <span>Yellow on black <small>(Tương phản cao)</small></span><span>${s.contrast === 'yellow' ? '✓' : ''}</span>
              </button>
            </div>
          </div>

          <div class="ins-opt-card">
            <div class="ins-opt-sec-title">Text size (Cỡ chữ)</div>
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

          <button type="button" class="ins-opt-exit-btn" onclick="ReadingPracticeApp.exitToHub()">← Exit to Practice Library (Lưu bài làm dở)</button>
        </div>
      </div>
    `;

    root.innerHTML = `
      <div class="rp-workspace ins-shell ${contrastCls} ${sizeCls}" id="rp-workspace">
        <div class="ins-main-col">
          <!-- 56px Official Inspera Header -->
          <header class="ins-header">
            <div class="ins-hdr-left">
              <span class="ins-brand-mark">IELTS</span>
              <div class="ins-hdr-meta">
                <div class="ins-hdr-title">${esc(s.title)}</div>
                ${!isReview ? `
                  <button type="button" class="ins-hdr-timer${timerUrgency}" onclick="ReadingPracticeApp.togglePauseTimer()" title="Bấm để tạm dừng / tiếp tục đồng hồ">
                    <span id="rp-timer-display">${formatMinsRemaining(s.remainingSec)}</span>
                    <span class="ins-timer-exact tabular" id="rp-timer-exact">(${formatDuration(s.remainingSec)})</span>
                    ${s.paused ? '<span class="ins-paused-tag">PAUSED</span>' : ''}
                  </button>
                ` : `<div class="ins-hdr-review-lbl">Review Mode · Paraphrase &amp; Dictionary Unlocked</div>`}
              </div>
            </div>

            <div class="ins-hdr-right">
              ${s.isNews && !isReview ? `
                <button type="button" class="ins-hdr-pill ${s.showBilingual ? 'active' : ''}" id="rp-btn-bilingual" onclick="ReadingPracticeApp.toggleBilingual()">
                  ${s.showBilingual ? '✓ Song ngữ' : 'Song ngữ'}
                </button>
              ` : ''}
              <button type="button" class="ins-hdr-ico" title="Kết nối cục bộ (Offline safe)" aria-label="Status">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/></svg>
              </button>
              <button type="button" class="ins-hdr-ico ${s.optionsOpen ? 'active' : ''}" id="ins-btn-options"
                onclick="ReadingPracticeApp.toggleOptionsOverlay()" title="Options (Contrast · Text size · Submit)" aria-label="Options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <button type="button" class="ins-hdr-ico ${s.notesOpen ? 'active' : ''}" id="rp-btn-notes"
                onclick="ReadingPracticeApp.toggleNotesDrawer()" title="Show / Hide notes" aria-label="Notes">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg>
                ${notesCount ? `<span class="ins-notes-badge">${notesCount}</span>` : ''}
              </button>
              <button type="button" class="ins-hdr-exit" onclick="ReadingPracticeApp.exitToHub()" title="Quay về kho đề">Thoát</button>
            </div>
          </header>

          ${reviewStripHtml}

          <!-- Full-width Official Inspera Part Sub-Banner -->
          <div class="ins-part-banner">
            <strong>${esc(partLabel)}</strong>
            <span>${esc(partSubText)}</span>
          </div>

          <!-- Mobile Pane Toggle -->
          <div class="rp-mobile-pane-bar">
            <button type="button" class="rp-mob-tab ${state.mobilePane === 'passage' ? 'active' : ''}"
              onclick="ReadingPracticeApp.setMobilePane('passage')">Passage</button>
            <button type="button" class="rp-mob-tab ${state.mobilePane === 'questions' ? 'active' : ''}"
              onclick="ReadingPracticeApp.setMobilePane('questions')">Questions (${allQ.filter((x) => String(s.answers[x._qid] || '').trim()).length}/${allQ.length})</button>
          </div>

          <!-- 50/50 Split Workspace -->
          <div class="ins-split-body" id="rp-split-body">
            <section class="ins-pane ins-pane-left ${state.mobilePane === 'passage' ? 'mob-active' : ''}"
              id="rp-passage-pane" style="flex: 0 0 ${state.splitRatio}%;"
              onmouseup="ReadingPracticeApp.handlePassageSelection(event)"
              oncontextmenu="ReadingPracticeApp.handlePassageContextMenu(event)"
              onclick="ReadingPracticeApp.handlePassageWordClick(event)">
              <div class="ins-passage-inner">
                <h1 class="ins-passage-title">${esc(curPassage.title)}</h1>
                ${curPassage.subtitle ? `<p class="ins-passage-sub">${esc(curPassage.subtitle)}</p>` : ''}
                <div class="rp-passage-content" id="rp-passage-content">
                  ${(curPassage.paragraphs || []).map((para) => renderPassageParagraphHtml(para, curPassage, enableDict, isReview)).join('')}
                </div>
              </div>
            </section>

            <div class="ins-resizer" id="rp-resizer" title="Kéo để chia lại tỷ lệ bài đọc / câu hỏi"
              onmousedown="ReadingPracticeApp.startResize(event)">
              <span class="ins-resizer-box" aria-hidden="true">↔</span>
            </div>

            <section class="ins-pane ins-pane-right ${state.mobilePane === 'questions' ? 'mob-active' : ''}" id="rp-questions-pane">
              <div class="ins-questions-inner">
                ${groupsHtml}
              </div>
            </section>

            <!-- Official Floating 40x40px Prev / Next Square Arrows -->
            <div class="ins-float-arrows">
              <button type="button" class="ins-arrow-btn ${curGlobalIdx <= 0 ? 'is-disabled' : ''}"
                onclick="ReadingPracticeApp.stepQuestion(-1)" title="Previous question" ${curGlobalIdx <= 0 ? 'disabled' : ''}>←</button>
              <button type="button" class="ins-arrow-btn is-next ${curGlobalIdx >= allQ.length - 1 ? 'is-disabled' : ''}"
                onclick="ReadingPracticeApp.stepQuestion(1)" title="Next question" ${curGlobalIdx >= allQ.length - 1 ? 'disabled' : ''}>→</button>
            </div>
          </div>

          <!-- Fixed 48px Official Inspera Bottom Navigator Bar -->
          <footer class="ins-footer">
            <div class="ins-footer-parts">${bottomPartsHtml}</div>
            ${!isReview ? `
              <button type="button" class="ins-submit-check-btn" id="rp-btn-open-submit"
                onclick="ReadingPracticeApp.openPreSubmitModal()" title="Review &amp; Submit your answers" aria-label="Review and Submit">✓</button>
            ` : `
              <button type="button" class="ins-submit-check-btn is-done" onclick="ReadingPracticeApp.exitToHub()" title="Quay về kho đề">←</button>
            `}
          </footer>
        </div>

        ${notesDrawerHtml}
        ${optionsOverlayHtml}

        <!-- Official Inspera Compact Selection / Right-Click Popover (Note + Highlight) -->
        <div class="ins-sel-popover hidden" id="rp-hl-toolbar">
          <button type="button" class="ins-sel-act" onclick="ReadingPracticeApp.addNoteFromSelection()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span>Note</span>
          </button>
          <button type="button" class="ins-sel-act" onclick="ReadingPracticeApp.applyHighlight('yellow')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h9l3-3"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>
            <span>Highlight</span>
          </button>
          <button type="button" class="ins-sel-clear" onclick="ReadingPracticeApp.clearSelectionHighlight()" title="Xóa highlight">Clear</button>
          ${enableDict ? '<button type="button" class="ins-sel-dict" onclick="ReadingPracticeApp.lookupSelectedPhrase()">Tra từ</button>' : ''}
        </div>

        <!-- Click-to-Dictionary Popover (Review & News mode) -->
        <div class="rp-dict-popover hidden" id="rp-dict-popover" onclick="event.stopPropagation()"></div>

        <!-- Pre-Submit Review Check Modal -->
        <div class="modal-overlay" id="rp-presubmit-modal" onclick="ReadingPracticeApp.closePreSubmitModal(event)">
          <div class="modal-card rp-presubmit-card" onclick="event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title">Review your answers before submitting</div>
              <button type="button" class="btn-icon-glass" style="width:30px;height:30px;" onclick="ReadingPracticeApp.closePreSubmitModal()">✕</button>
            </div>
            <div class="modal-body" id="rp-presubmit-body"></div>
          </div>
        </div>
      </div>
    `;
  }

  /* ---------- FLAT INSPERA QUESTION GROUP & ITEM RENDERER ---------- */
  function renderQuestionGroup(group, passage, isReview) {
    const s = state.session;
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
        return renderReviewBlock(q, ok, keyObj ? `${keyObj.key}. ${keyObj.text}` : q.answer);
      }).join('') : '';

      return `
        <div class="ins-q-group">
          <h3 class="ins-group-title">${esc(group.title)}</h3>
          ${group.instruction ? `<p class="ins-group-inst">${esc(group.instruction)}</p>` : ''}
          <div class="ins-headings-sub">List of Headings</div>
          <div class="ins-headings-stack">${headingsHtml}</div>
          ${!isReview ? '<div class="ins-mh-hint">Kéo thả tiêu đề sang ô viền xanh bên trái, hoặc bấm chọn 1 tiêu đề rồi bấm vào ô số câu bên trái.</div>' : ''}
          ${reviewRowsHtml}
        </div>
      `;
    }

    return `
      <div class="ins-q-group">
        <h3 class="ins-group-title">${esc(group.title)}</h3>
        ${group.instruction ? `<p class="ins-group-inst">${esc(group.instruction)}</p>` : ''}
        <div class="ins-q-items">
          ${(group.questions || []).map((q) => renderFlatQuestionItem(q, passage, isReview)).join('')}
        </div>
      </div>
    `;
  }

  function renderReviewBlock(q, ok, correctDisplay) {
    const paraRows = (q.paraphrase || []).map((pr) => `
      <div class="rp-para-map-row">
        <span class="rp-pm-q">${esc(pr.q)}</span>
        <span class="rp-pm-arrow">↔</span>
        <span class="rp-pm-p">${esc(pr.p)}</span>
      </div>
    `).join('');

    return `
      <div class="rp-rev-box ins-rev-box ${ok ? 'is-ok' : 'is-bad'}">
        <div class="rp-rev-box-head">
          <span><strong>Q${q.num}:</strong> ${ok ? '✓ Chính xác' : `✕ Đáp án đúng: <strong>${esc(correctDisplay)}</strong>`}</span>
          ${q.evidenceId ? `
            <button type="button" class="rp-locate-btn"
              onclick="ReadingPracticeApp.locateEvidence('${esc(q.evidenceId)}')">Định vị dẫn chứng</button>
          ` : ''}
        </div>
        ${paraRows ? `
          <div class="rp-para-map">
            <div class="rp-pm-title">Paraphrase Mapping (Câu hỏi ↔ Bài đọc)</div>
            ${paraRows}
          </div>
        ` : ''}
        ${q.explanation ? `<div class="rp-rev-exp">${esc(q.explanation)}</div>` : ''}
      </div>
    `;
  }

  function renderFlatQuestionItem(q, passage, isReview) {
    const s = state.session;
    const qid = `${passage.id}__q${q.num}`;
    const userVal = String(s.answers[qid] ?? '');
    const flagged = !!s.flagged[qid];
    const isCur = s.activeQid === qid;
    const ok = isReview ? isAnswerCorrect(q, userVal) : false;

    const bookmarkBtn = !isReview ? `
      <button type="button" class="ins-bookmark-btn ${flagged ? 'active' : ''}"
        onclick="event.stopPropagation(); ReadingPracticeApp.toggleFlag('${esc(qid)}')" title="Đánh dấu xem lại (Bookmark)">
        <svg viewBox="0 0 24 24" fill="${flagged ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
      </button>
    ` : '';

    if (q.type === 'gap') {
      const inlineBox = `<input type="text" class="ins-gap-input ${isReview ? (ok ? 'is-ok' : 'is-bad') : ''}" value="${esc(userVal)}" ${isReview ? 'readonly' : ''} placeholder="${q.num}" aria-label="Question ${q.num}" onfocus="ReadingPracticeApp.focusQuestion('${esc(qid)}')" oninput="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value, true)" autocomplete="off">`;
      const stem = /_{3,}/.test(q.prompt) ? esc(q.prompt).replace(/_{3,}/, inlineBox) : `${esc(q.prompt)} ${inlineBox}`;
      const correctDisplay = Array.isArray(q.answer) ? q.answer[0] : q.answer;
      return `
        <div class="ins-q-item ins-q-gap ${isCur && !isReview ? 'is-current' : ''}" id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
          <div class="ins-gap-bullet">
            <span class="ins-bullet-dot">•</span>
            <div class="ins-gap-line">${stem}</div>
            ${bookmarkBtn}
          </div>
          ${isReview ? renderReviewBlock(q, ok, correctDisplay) : ''}
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
            if (isReview && active && !ok) cls += ' is-wrong-pick';
            return `
              <label class="${cls}">
                <input type="radio" name="${esc(qid)}" value="${opt}" ${active ? 'checked' : ''} ${isReview ? 'disabled' : ''}
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
            if (isReview && active && !ok) cls += ' is-wrong-pick';
            return `
              <div class="${cls}">
                <label class="ins-radio-lbl">
                  <input type="radio" name="${esc(qid)}" value="${esc(opt.key)}" ${active ? 'checked' : ''} ${isReview ? 'disabled' : ''}
                    onchange="ReadingPracticeApp.setAnswer('${esc(qid)}', '${esc(opt.key)}')">
                  <strong>${esc(opt.key)}</strong>
                  <span class="ins-mcq-txt">${esc(opt.text)}</span>
                </label>
                ${!isReview ? `
                  <button type="button" class="ins-strike-btn ${isStruck ? 'active' : ''}"
                    onclick="ReadingPracticeApp.toggleStrike('${esc(strikeKey)}', event)" title="Loại trừ phương án này">S̶</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    const correctDisplay = Array.isArray(q.answer) ? q.answer[0] : q.answer;
    return `
      <div class="ins-q-item ${isCur && !isReview ? 'is-current' : ''}" id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
        <div class="ins-q-stem-row">
          <span class="ins-q-num ${isCur && !isReview ? 'is-active' : ''}">${q.num}</span>
          <div class="ins-q-stem">${esc(q.prompt)}</div>
          ${bookmarkBtn}
        </div>
        ${optionsHtml}
        ${isReview ? renderReviewBlock(q, ok, correctDisplay) : ''}
      </div>
    `;
  }

  /* ---------- CLICK-TO-DICTIONARY POPOVER (Review & News -> My Vocab) ---------- */
  function extractSentenceForNode(node) {
    const pEl = node?.closest?.('.rp-para-text');
    if (!pEl) return '';
    const full = (pEl.textContent || '').replace(/\s+/g, ' ').trim();
    const word = (node.dataset?.word || node.textContent || '').trim();
    if (!full || !word) return full.slice(0, 220);
    const sentences = full.split(/(?<=[.!?])\s+/);
    const found = sentences.find((sent) => sent.toLowerCase().includes(word.toLowerCase()));
    return (found || full).trim().slice(0, 260);
  }

  function showDictPopover(rawWord, contextSentence, anchorRect) {
    const pop = document.getElementById('rp-dict-popover');
    if (!pop || !state.session) return;
    const passages = getSessionPassages();
    const curPassage = passages[state.session.activePassageIdx] || passages[0];
    const entry = lookupWordEntry(rawWord, curPassage);
    if (!entry.word) return;

    const decks = window.MyVocabStore ? window.MyVocabStore.getDecks() : [];
    const defaultDeckName = state.session.deckDefaultName || 'Từ của tôi';
    const deckOptions = [defaultDeckName, ...decks.map((d) => d.name).filter((n) => n !== defaultDeckName)];
    const savedSet = window.MyVocabStore ? window.MyVocabStore.getSavedWordSet() : new Set();
    const alreadySaved = savedSet.has(entry.word.toLowerCase()) || savedSet.has(entry.lemma.toLowerCase());

    state.dictTarget = { entry, context: contextSentence || '', deckName: defaultDeckName };

    pop.innerHTML = `
      <div class="rp-dict-head">
        <div>
          <div class="rp-dict-word">${esc(entry.word)}</div>
          <div class="rp-dict-meta">
            ${entry.ipa ? `<span class="rp-dict-ipa">${esc(entry.ipa)}</span>` : ''}
            <span class="rp-dict-pos">${esc(entry.pos || 'word')}</span>
          </div>
        </div>
        <div class="rp-dict-audio">
          <button type="button" class="rp-dict-spk" onclick="ReadingPracticeApp.speakDictWord('en-US')">US</button>
          <button type="button" class="rp-dict-spk" onclick="ReadingPracticeApp.speakDictWord('en-GB')">UK</button>
          <button type="button" class="rp-dict-close" onclick="ReadingPracticeApp.closeDictPopover()">✕</button>
        </div>
      </div>
      <div class="rp-dict-meaning-wrap">
        <label class="rp-dict-lbl">Nghĩa tiếng Việt</label>
        <input type="text" class="rp-dict-input" id="rp-dict-meaning-input" value="${esc(entry.vi)}" placeholder="Nhập nghĩa ngắn gọn...">
      </div>
      ${entry.synonyms.length ? `<div class="rp-dict-syns"><span>Đồng nghĩa:</span>${entry.synonyms.map((sy) => `<span class="rp-syn-chip">${esc(sy)}</span>`).join('')}</div>` : ''}
      ${contextSentence ? `<div class="rp-dict-ctx"><div class="rp-dict-lbl">Ngữ cảnh trích từ bài đọc</div><div class="rp-dict-ctx-text">“${esc(contextSentence)}”</div></div>` : ''}
      <div class="rp-dict-foot">
        <select class="rp-dict-deck-sel" id="rp-dict-deck-select">
          ${deckOptions.map((dn) => `<option value="${esc(dn)}">${esc(dn)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary rp-btn-sm" id="rp-btn-save-myvocab" onclick="ReadingPracticeApp.saveDictWordToMyVocab()">
          ${alreadySaved ? '✓ Lưu thêm' : '+ Lưu vào Từ của tôi'}
        </button>
      </div>
    `;

    pop.classList.remove('hidden');
    const pw = 340;
    const left = Math.max(14, Math.min(window.innerWidth - pw - 16, (anchorRect?.left || 100) - 20));
    const top = Math.max(70, Math.min(window.innerHeight - 310, (anchorRect?.bottom || 180) + 10));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
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
      state.source = src || 'cambridge';
      state.view = 'source';
      state.partFilter = part || 'all';
      state.newsTopic = 'all';
      state.searchQuery = '';
      const books = getBooksForSource(state.source);
      if (books.length) {
        const ready = books.find((b) => countReadyTestsInBook(b.id) > 0) || books[0];
        state.selectedBookId = ready.id;
        state.selectedTestNum = 1;
      }
      renderHub();
    },

    setSource(src) {
      this.openSource(src, 'all');
    },

    setCamGroup(grp) {
      state.camGroup = grp === 'all' ? 'all' : 'recent';
      renderHub();
    },

    selectBook(bookId) {
      state.selectedBookId = bookId;
      state.selectedTestNum = 1;
      renderHub();
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
      renderHub();
      const inp = document.getElementById('rp-hub-search');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    },

    startPassage(passageId, opts = {}) {
      const p = (DATA().PASSAGES || {})[passageId];
      if (!p) return;
      startSession({
        itemId: p.id, title: p.title, source: p.source, isFull: false,
        suggestedMins: p.suggestedMins || 20, deckDefaultName: p.deckDefaultName || p.title,
        passageIds: [p.id], openInReview: !!opts.openInReview
      });
    },

    startFullTest(fullId, opts = {}) {
      const ft = (DATA().FULL_TESTS || []).find((x) => x.id === fullId);
      if (!ft) return;
      startSession({
        itemId: ft.id, title: ft.title, source: ft.source, isFull: true,
        suggestedMins: ft.suggestedMins || 60, deckDefaultName: ft.deckDefaultName || ft.title,
        passageIds: ft.passageIds.slice(), openInReview: !!opts.openInReview
      });
    },

    resumeDraft() {
      const d = ReadingPracticeStore.getInProgress();
      if (!d || !Array.isArray(d.passageIds) || !d.passageIds.length) return;
      startSession({
        itemId: d.itemId, title: d.title, source: d.source, isFull: !!d.isFull,
        suggestedMins: Math.max(1, Math.ceil((d.remainingSec || 1200) / 60)),
        remainingSec: d.remainingSec, elapsedSec: d.elapsedSec,
        deckDefaultName: d.deckDefaultName, passageIds: d.passageIds,
        answers: d.answers || {}, flagged: d.flagged || {}, struck: d.struck || {}, notes: d.notes || []
      });
    },

    discardResume() {
      ReadingPracticeStore.clearInProgress();
      this.render();
      toast('Đã xóa bài làm dở.');
    },

    exitToHub() {
      if (state.session && state.session.mode === 'exam') persistDraft();
      stopTimer();
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();
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

    setContrast(mode) {
      if (!state.session) return;
      state.session.contrast = ['cd', 'totoro', 'dark', 'yellow'].includes(mode) ? mode : 'cd';
      renderExamWorkspace();
    },

    setTextSize(sz) {
      if (!state.session) return;
      state.session.textSize = ['regular', 'large', 'xlarge'].includes(sz) ? sz : 'regular';
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
      const card = document.getElementById(`rp-qcard-${qid}`);
      if (card) {
        card.classList.add('is-current');
        card.querySelector('.ins-q-num')?.classList.add('is-active');
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
      state.session.answers[qid] = value;
      state.session.activeQid = qid;
      persistDraft();
      if (skipFullRerender) {
        const pQs = getAllSessionQuestions().filter((q) => q._pIdx === state.session.activePassageIdx);
        const idx = pQs.findIndex((q) => q._qid === qid);
        const boxes = document.querySelectorAll('.ins-qbox');
        if (boxes[idx]) boxes[idx].classList.toggle('is-attempted', String(value || '').trim().length > 0);
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
      const sel = window.getSelection();
      const quote = (sel ? sel.toString() : '').trim().slice(0, 180);
      if (quote) this.applyHighlight('yellow');
      this.hideHighlightToolbar();
      state.session.notesOpen = true;
      if (quote) {
        state.session.notes.unshift({ id: 'n_' + Date.now().toString(36), quote, text: 'Note attached to passage highlight' });
      }
      persistDraft();
      renderExamWorkspace();
      document.getElementById('rp-note-input')?.focus();
    },

    addManualNote(ev) {
      if (ev) ev.preventDefault();
      if (!state.session) return;
      const ta = document.getElementById('rp-note-input');
      const text = (ta?.value || '').trim();
      if (!text) return;
      state.session.notes.unshift({ id: 'n_' + Date.now().toString(36), quote: '', text });
      persistDraft();
      renderExamWorkspace();
    },

    deleteNote(noteId) {
      if (!state.session) return;
      state.session.notes = (state.session.notes || []).filter((n) => n.id !== noteId);
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

      body.innerHTML = `
        <div class="rp-ps-stats">
          <div class="rp-ps-box"><span>Answered</span><strong class="tabular">${answered} / ${allQ.length}</strong></div>
          <div class="rp-ps-box ${unanswered > 0 ? 'warn' : ''}"><span>Unanswered</span><strong class="tabular">${unanswered}</strong></div>
          <div class="rp-ps-box"><span>Bookmarked</span><strong class="tabular">${flaggedCnt}</strong></div>
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
          <button type="button" class="btn-subtle" onclick="ReadingPracticeApp.closePreSubmitModal()">Back to test</button>
          <button type="button" class="btn btn-primary" id="rp-btn-confirm-submit" onclick="ReadingPracticeApp.confirmSubmit()">Submit &amp; View Results →</button>
        </div>
      `;
      modal.classList.add('open');
    },

    closePreSubmitModal(ev) {
      const modal = document.getElementById('rp-presubmit-modal');
      if (!modal) return;
      if (!ev || ev.target === modal) modal.classList.remove('open');
    },

    confirmSubmit() {
      if (!state.session) return;
      stopTimer();
      this.closePreSubmitModal();
      const res = computeReviewResult();
      state.session.mode = 'review';
      state.session.reviewResult = res;

      ReadingPracticeStore.recordAttempt({
        itemId: state.session.itemId, title: state.session.title, source: state.session.source,
        isFull: state.session.isFull, score: res.score, total: res.total,
        band: res.band, elapsedSec: res.elapsedSec, completedAt: Date.now()
      });

      renderExamWorkspace();
      toast(`Hoàn thành! Đúng ${res.score}/${res.total} · Band dự kiến ${res.band.toFixed(1)}`);
    },

    retryCurrent() {
      if (!state.session) return;
      if (state.session.isFull) this.startFullTest(state.session.itemId);
      else this.startPassage(state.session.itemId);
    },

    toggleBilingual() {
      if (!state.session) return;
      state.session.showBilingual = !state.session.showBilingual;
      renderExamWorkspace();
    },

    locateEvidence(evId) {
      if (!state.session) return;
      state.session.activeEvidenceId = evId;
      state.mobilePane = 'passage';
      renderExamWorkspace();
      setTimeout(() => {
        document.querySelector(`.rp-ev-span[data-ev-id="${evId}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 40);
    },

    /* ---------- SELECTION & RIGHT-CLICK HIGHLIGHT POPOVER ---------- */
    _positionSelectionPopover(rect) {
      const bar = document.getElementById('rp-hl-toolbar');
      if (!bar || !rect) return;
      bar.style.left = `${Math.max(12, Math.min(window.innerWidth - 230, rect.left + rect.width / 2 - 90))}px`;
      bar.style.top = `${Math.max(62, rect.bottom + 8)}px`;
      bar.classList.remove('hidden');
    },

    handlePassageSelection() {
      const sel = window.getSelection();
      const bar = document.getElementById('rp-hl-toolbar');
      if (!bar) return;
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        bar.classList.add('hidden');
        return;
      }
      const range = sel.getRangeAt(0);
      const pane = document.getElementById('rp-passage-content');
      if (!pane || !pane.contains(range.commonAncestorContainer)) {
        bar.classList.add('hidden');
        return;
      }
      this._positionSelectionPopover(range.getBoundingClientRect());
    },

    handlePassageContextMenu(ev) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim()) {
        ev.preventDefault();
        this._positionSelectionPopover(sel.getRangeAt(0).getBoundingClientRect());
      }
    },

    hideHighlightToolbar() {
      document.getElementById('rp-hl-toolbar')?.classList.add('hidden');
    },

    applyHighlight(color) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      try {
        const range = sel.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.className = `rp-hl-mark hl-${color || 'yellow'}`;
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
        sel.removeAllRanges();
      } catch (_) {
        toast('Hãy bôi đen trong cùng một đoạn văn để highlight.');
      }
      this.hideHighlightToolbar();
    },

    clearSelectionHighlight() {
      const pane = document.getElementById('rp-passage-content');
      if (pane) {
        pane.querySelectorAll('mark.rp-hl-mark').forEach((m) => {
          const parent = m.parentNode;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
        });
      }
      window.getSelection()?.removeAllRanges();
      this.hideHighlightToolbar();
    },

    lookupSelectedPhrase() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text) return;
      const range = sel.getRangeAt(0);
      const parentEl = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
      const ctx = extractSentenceForNode(parentEl);
      this.hideHighlightToolbar();
      showDictPopover(text, ctx, range.getBoundingClientRect());
    },

    handlePassageWordClick(ev) {
      const s = state.session;
      if (!s || !(s.mode === 'review' || s.isNews)) return;
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

    speakDictWord(accent) {
      if (!state.dictTarget?.entry?.word) return;
      if (B()?.speakText) B().speakText(state.dictTarget.entry.word, accent || 'en-US');
      else if (window.AudioEngine?.speak) window.AudioEngine.speak(state.dictTarget.entry.word, { accent: accent || 'en-US' });
    },

    saveDictWordToMyVocab() {
      if (!state.dictTarget || !window.MyVocabStore) return;
      const meaning = (document.getElementById('rp-dict-meaning-input')?.value || state.dictTarget.entry.vi || '').trim() || '(Tự ghi chú nghĩa sau)';
      const deckName = document.getElementById('rp-dict-deck-select')?.value || state.dictTarget.deckName || 'Từ của tôi';
      const entry = state.dictTarget.entry;
      const res = window.MyVocabStore.addWordToNamedDeck(deckName, {
        lemma: entry.word, pos: entry.pos || 'word', ipa: entry.ipa || '',
        clean_meaning: meaning, reading_context: state.dictTarget.context || '',
        synonyms: entry.synonyms || [], source: state.session?.title || 'Reading Practice'
      });
      this.closeDictPopover();
      renderExamWorkspace();
      toast(res?.ok ? `Đã lưu "${entry.word}" vào "${deckName}" (Từ của tôi)!` : `"${entry.word}" đã có trong "${deckName}".`);
    },

    startResize(ev) {
      ev.preventDefault();
      const body = document.getElementById('rp-split-body');
      const left = document.getElementById('rp-passage-pane');
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
