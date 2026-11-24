/* =========================================================
   MODULE: IELTS Reading Practice PRO Engine & Local History Store
   - 4-source library: Cambridge | Volume | Actual Tests | News
   - Exact order inside Cambridge/Volume/Actual:
       Passage 1 -> Passage 2 -> Passage 3 -> FULL TEST
   - Split-screen resizable exam workspace + Ghibli / Thi máy toggle
   - Selection Highlight toolbar (Yellow / Green / Pink / Clear)
   - MCQ Strike-through eliminator (S̶ Loại trừ) & Question Flag (⚑)
   - Bluebook Pre-Submit Review Check modal
   - Post-Exam Review: Band, Time, Accuracy by Question Type,
     Paraphrase Mapping, Locate Evidence, Interleaved Bilingual toggle,
     and YouPass-style Click-to-Dictionary -> 1-click Save to My Vocab
     (with auto-captured Reading context sentence + saved-word underline)
   - 100% local per-student history & in-progress resume in localStorage
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY_BASE = 'ielts_reading_practice_v1_';

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function DATA() { return window.READING_PRACTICE_DATA || { SOURCES: [], PASSAGES: {}, FULL_TESTS: [] }; }

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

  /* ---------- Official Academic Reading Band Estimator ---------- */
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

  function qTypeLabel(type) {
    if (type === 'tfng') return 'T / F / NG';
    if (type === 'ynng') return 'Y / N / NG';
    if (type === 'mcq') return 'Multiple Choice';
    if (type === 'gap') return 'Gap Fill';
    if (type === 'match') return 'Matching';
    return 'Reading';
  }

  /* =========================================================
     1. LOCAL STORE: ReadingPracticeStore (for Practice + Reading Home)
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

    save(state) {
      try {
        localStorage.setItem(this._key(), JSON.stringify(state));
      } catch (_) {}
      try {
        window.dispatchEvent(new CustomEvent('reading-practice-updated'));
      } catch (_) {}
    },

    recordAttempt(entry) {
      const st = this.load();
      st.history.unshift(entry);
      if (st.history.length > 80) st.history = st.history.slice(0, 80);
      if (st.inProgress && st.inProgress.itemId === entry.itemId) {
        st.inProgress = null;
      }
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

    getInProgress() {
      return this.load().inProgress;
    },

    getHistory() {
      return this.load().history;
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
     2. DICTIONARY LOOKUP (Passage Glossary + APP_DATA + IPA_DICT)
     ========================================================= */
  let _appWordMap = null;
  function getAppWordMap() {
    if (_appWordMap) return _appWordMap;
    const map = new Map();
    const d = (typeof APP_DATA !== 'undefined' ? APP_DATA : window.APP_DATA) || {};
    const lists = [d.file1_paraphrase_1500 || [], d.file2_families_3500 || [], d.signal_words || []];
    lists.forEach((arr) => {
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
    if (w.endsWith('ing') && w.length > 5) {
      cands.push(w.slice(0, -3));
      cands.push(w.slice(0, -3) + 'e');
    }
    if (w.endsWith('ed') && w.length > 4) {
      cands.push(w.slice(0, -2));
      cands.push(w.slice(0, -1));
    }
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
        return {
          word: clean,
          lemma: cand,
          ipa: g.ipa || ipaDict[cand] || '',
          pos: g.pos || 'word',
          vi: g.vi || '',
          synonyms: Array.isArray(g.syn) ? g.syn : [],
          found: true
        };
      }
    }
    for (const cand of stemCandidates(lower)) {
      const cat = appMap.get(cand);
      if (cat) {
        return {
          word: clean,
          lemma: cat.lemma || clean,
          ipa: cat.ipa || ipaDict[cand] || '',
          pos: cat.pos || 'word',
          vi: cat.clean_meaning || cat.definition || '',
          synonyms: Array.isArray(cat.synonyms) ? cat.synonyms.slice(0, 4) : [],
          found: true
        };
      }
    }
    return {
      word: clean,
      lemma: clean,
      ipa: ipaDict[lower] || '',
      pos: 'word',
      vi: '',
      synonyms: [],
      found: false
    };
  }

  /* =========================================================
     3. READING PRACTICE APP CONTROLLER
     ========================================================= */
  const state = {
    view: 'portal',       // 'portal' (3x3 source grid) | 'source' (Passage 1-3 + FULL TEST) | 'exam'
    source: 'cambridge',  // 'cambridge' | 'volume' | 'actual' | 'news'
    partFilter: 'all',    // 'all' | 'p1' | 'p2' | 'p3' | 'full'
    newsTopic: 'all',
    searchQuery: '',

    // Active exam session
    session: null,
    timerId: null,
    dictTarget: null,     // { word, entry, context, deckName }
    splitRatio: 50,       // percentage for left pane
    mobilePane: 'passage' // 'passage' | 'questions'
  };

  function getRoot() {
    return document.getElementById('rp-app-root');
  }

  function isAnswerCorrect(q, userVal) {
    const raw = String(userVal ?? '').trim();
    if (!raw) return false;
    if (Array.isArray(q.answer)) {
      const low = raw.toLowerCase().replace(/\s+/g, ' ');
      return q.answer.some((a) => String(a).trim().toLowerCase() === low);
    }
    return raw.toUpperCase() === String(q.answer).trim().toUpperCase();
  }

  function getAllQuestionsInPassage(p) {
    const out = [];
    (p.groups || []).forEach((g) => {
      (g.questions || []).forEach((q) => out.push(q));
    });
    return out;
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

  /* ---------- PORTAL 3x3 GRID RENDERER (Cambridge | Volume | Actual Tests | News) ---------- */
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

  function renderPortal() {
    const root = getRoot();
    if (!root) return;
    const d = DATA();
    const sources = d.SOURCES || [];
    const allPassages = Object.values(d.PASSAGES || {});
    const allFull = d.FULL_TESTS || [];
    const hist = ReadingPracticeStore.getHistory();

    const stampById = {
      cambridge: `<svg class="ghibli-stamp" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.11;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M18 22L14 8L24 16C29 14.5 35 14.5 40 16L50 8L46 22C52 26 55 33 55 41C55 52 45.5 58 32 58C18.5 58 9 52 9 41C9 33 12 26 18 22Z" stroke="currentColor" stroke-width="2.3" stroke-linejoin="round"/><circle cx="23.5" cy="29" r="2.2" fill="currentColor"/><circle cx="40.5" cy="29" r="2.2" fill="currentColor"/><path d="M21 43L24.5 39.5L28 43M29 41.5L32 38.5L35 41.5M36 43L39.5 39.5L43 43" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      volume: `<svg class="ghibli-stamp warm" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.12;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M32 6V12" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M10 26C14 14 22 11 32 11C42 11 50 14 54 26C48 23.5 43 23.5 38 25.5C34 23.5 30 23.5 26 25.5C21 23.5 16 23.5 10 26Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="currentColor" fill-opacity=".08"/><path d="M32 24V48C32 52 36 53 38 49.5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/></svg>`,
      actual: `<svg class="ghibli-stamp" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.11;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="24" stroke="currentColor" stroke-width="2.1" stroke-dasharray="4 3"/><circle cx="32" cy="32" r="17" stroke="currentColor" stroke-width="1.8"/><path d="M32 20v12l8 5" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      news: `<svg class="ghibli-stamp info" style="right:14px;bottom:52px;width:62px;height:62px;opacity:0.12;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><path d="M12 48C17 31 28 20 48 13C43 30 32 41 12 48Z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" fill="currentColor" fill-opacity=".08"/><path d="M12 48L36 24M24 36L32 34" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
    };

    const cardsHtml = sources.map((s) => {
      const pCount = allPassages.filter((p) => p.source === s.id).length;
      const fCount = allFull.filter((f) => f.source === s.id).length;
      const srcHist = hist.filter((h) => h.source === s.id);
      const avgBand = srcHist.length
        ? (Math.round((srcHist.reduce((acc, x) => acc + (Number(x.band) || 0), 0) / srcHist.length) * 2) / 2).toFixed(1)
        : null;

      const rightBadge = avgBand
        ? `Band ${avgBand}`
        : (s.id === 'news' ? `${pCount} bài báo` : `${pCount} Passages · ${fCount} Full`);

      const actionsHtml = s.id === 'news'
        ? `
          <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('news')">Chọn chủ đề</button>
          <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('news')">Đọc báo ngay</button>
        `
        : `
          <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('${esc(s.id)}', 'all')">Chọn Passage</button>
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
              <p class="tot-shell-sub">Chọn kho đề Cambridge, Volume, Actual Tests hoặc đọc báo học thuật News.</p>
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

  /* ---------- SOURCE LIBRARY RENDERER (Inside Cambridge / Volume / Actual / News) ---------- */
  function renderHub() {
    const root = getRoot();
    if (!root) return;
    const d = DATA();
    const sources = d.SOURCES || [];
    const curSourceObj = sources.find((s) => s.id === state.source) || sources[0];

    const sourceTabsHtml = sources.map((s) => `
      <button type="button" class="rp-source-tab ${state.source === s.id ? 'active' : ''}"
        data-rp-source="${esc(s.id)}" onclick="ReadingPracticeApp.setSource('${esc(s.id)}')">
        <span>${esc(s.label)}</span>
      </button>
    `).join('');

    const isNews = state.source === 'news';
    const allPassages = Object.values(d.PASSAGES || {}).filter((p) => p.source === state.source);
    const fullTests = (d.FULL_TESTS || []).filter((t) => t.source === state.source);
    const q = state.searchQuery.trim().toLowerCase();

    const matchesSearch = (obj) => {
      if (!q) return true;
      const hay = `${obj.title || ''} ${obj.subtitle || ''} ${obj.topic || ''} ${obj.series || ''}`.toLowerCase();
      return hay.includes(q);
    };

    let subBarHtml = '';
    let contentHtml = '';

    if (!isNews) {
      // Exact user-specified order: Passage 1 -> Passage 2 -> Passage 3 -> FULL TEST
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

      const sections = [
        { key: 'p1', title: 'Passage 1', badge: '20 phút · Dễ → Trung bình', items: allPassages.filter((p) => p.passageNum === 1 && matchesSearch(p)), isFull: false },
        { key: 'p2', title: 'Passage 2', badge: '20 phút · Trung bình → Khá', items: allPassages.filter((p) => p.passageNum === 2 && matchesSearch(p)), isFull: false },
        { key: 'p3', title: 'Passage 3', badge: '20 phút · Nâng cao Band 7.5+', items: allPassages.filter((p) => p.passageNum === 3 && matchesSearch(p)), isFull: false },
        { key: 'full', title: 'FULL TEST', badge: '60 phút · Trọn bộ 3 Passage', items: fullTests.filter(matchesSearch), isFull: true }
      ].filter((sec) => state.partFilter === 'all' || state.partFilter === sec.key);

      contentHtml = sections.map((sec) => {
        if (!sec.items.length) {
          return `
            <div class="rp-section-block" data-rp-section="${sec.key}">
              <div class="rp-section-head">
                <h3 class="rp-section-title">${esc(sec.title)}</h3>
                <span class="rp-section-badge">${esc(sec.badge)}</span>
              </div>
              <div class="rp-empty-inline">Không tìm thấy đề phù hợp với từ khóa hiện tại.</div>
            </div>
          `;
        }
        return `
          <div class="rp-section-block" data-rp-section="${sec.key}">
            <div class="rp-section-head">
              <h3 class="rp-section-title">${esc(sec.title)}</h3>
              <span class="rp-section-badge">${esc(sec.badge)}</span>
            </div>
            <div class="rp-cards-grid">
              ${sec.items.map((it) => renderHubCard(it, sec.isFull)).join('')}
            </div>
          </div>
        `;
      }).join('');
    } else {
      const topics = ['all', ...Array.from(new Set(allPassages.map((p) => p.topic).filter(Boolean)))];
      subBarHtml = `
        <div class="rp-part-tabs" role="tablist" aria-label="Lọc chủ đề News">
          ${topics.map((tp) => `
            <button type="button" class="rp-part-pill ${state.newsTopic === tp ? 'active' : ''}"
              onclick="ReadingPracticeApp.setNewsTopic('${esc(tp)}')">${tp === 'all' ? 'Tất cả chủ đề' : esc(tp)}</button>
          `).join('')}
        </div>
      `;
      const filteredNews = allPassages.filter((p) => (state.newsTopic === 'all' || p.topic === state.newsTopic) && matchesSearch(p));
      contentHtml = `
        <div class="rp-section-block" data-rp-section="news">
          <div class="rp-section-head">
            <h3 class="rp-section-title">Academic News Reading</h3>
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
              <h2 class="tot-shell-title">${esc(curSourceObj?.label || 'Reading Practice')}</h2>
              <p class="tot-shell-sub">${esc(curSourceObj?.desc || '')}</p>
            </div>
          </div>
          <div class="rp-source-bar" role="tablist" aria-label="Nguồn đề đọc">
            ${sourceTabsHtml}
          </div>
        </div>

        ${buildResumeBannerHtml()}

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
        <div class="rp-card-meta">
          <span>${totalQ} câu hỏi</span>
          <span>·</span>
          <span>${item.suggestedMins || 20} phút</span>
          ${item.topic ? `<span>·</span><span>${esc(item.topic)}</span>` : ''}
        </div>
        <div class="rp-card-foot">
          ${isNews
            ? `<button type="button" class="btn-subtle rp-btn-sm" onclick="${reviewCall}">Đọc song ngữ</button>`
            : (best ? `<button type="button" class="btn-subtle rp-btn-sm" onclick="${reviewCall}">Xem lại</button>` : '<span></span>')}
          <button type="button" class="btn btn-primary rp-btn-sm" onclick="${startCall}">
            ${isNews ? 'Đọc & Làm bài →' : (isFull ? 'Làm Full Test →' : 'Làm bài →')}
          </button>
        </div>
      </article>
    `;
  }

  /* ---------- EXAM / REVIEW SESSION ENGINE ---------- */
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
      mode: config.openInReview ? 'review' : 'exam', // 'exam' | 'review'
      examTheme: 'totoro', // 'totoro' (Totoro CD-IELTS) | 'cd' (Thi máy Trắng) | 'night' (Nền tối)
      fontScale: 1,
      showBilingual: !!config.openInReview && isNews,
      totalSec,
      remainingSec: config.remainingSec ?? totalSec,
      elapsedSec: config.elapsedSec ?? 0,
      paused: false,
      answers: config.answers ? { ...config.answers } : {},
      flagged: config.flagged ? { ...config.flagged } : {},
      struck: config.struck ? { ...config.struck } : {},
      highlights: config.highlights ? { ...config.highlights } : {},
      notes: Array.isArray(config.notes) ? config.notes.slice() : [],
      notesOpen: false,
      activeQid: null,
      activeEvidenceId: null,
      reviewResult: null
    };
    state.view = 'exam';
    state.mobilePane = 'passage';
    state.dictTarget = null;

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
      if (state.session.remainingSec > 0) {
        state.session.remainingSec -= 1;
      }
      const el = document.getElementById('rp-timer-display');
      if (el) el.textContent = formatDuration(state.session.remainingSec);
      if (state.session.elapsedSec % 10 === 0) persistDraft();
    }, 1000);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function persistDraft() {
    if (!state.session || state.session.mode !== 'exam') return;
    const totalQuestions = getAllSessionQuestions().length;
    ReadingPracticeStore.saveInProgress({
      itemId: state.session.itemId,
      title: state.session.title,
      source: state.session.source,
      isFull: state.session.isFull,
      deckDefaultName: state.session.deckDefaultName,
      passageIds: state.session.passageIds,
      remainingSec: state.session.remainingSec,
      elapsedSec: state.session.elapsedSec,
      totalQuestions,
      answers: state.session.answers,
      flagged: state.session.flagged,
      struck: state.session.struck,
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
    const band = estimateBand(score, total);
    return {
      score,
      total,
      band,
      elapsedSec: state.session.elapsedSec,
      byType: Object.values(byType)
    };
  }

  /* ---------- PASSAGE TEXT RENDERING (clickable words + evidence + saved underline) ---------- */
  function renderPassageParagraphHtml(para, passage, enableDictClick) {
    const savedSet = (window.MyVocabStore && typeof window.MyVocabStore.getSavedWordSet === 'function')
      ? window.MyVocabStore.getSavedWordSet()
      : new Set();

    // Parse <ev id="eX">...</ev> cleanly while wrapping clickable words
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
        const evId = m[1];
        const inner = m[2];
        const activeCls = state.session?.activeEvidenceId === evId ? ' rp-evidence-active' : '';
        return `<span class="rp-ev-span${activeCls}" data-ev-id="${esc(evId)}">${tokenWrap(inner)}</span>`;
      }
      return tokenWrap(chunk);
    }).join('');

    const viBlock = (state.session?.showBilingual && para.vi)
      ? `<div class="rp-para-vi">${esc(para.vi)}</div>`
      : '';

    return `
      <div class="rp-para-block" data-para-label="${esc(para.label || '')}">
        <p class="rp-para-en">
          ${para.label ? `<span class="rp-para-lbl">${esc(para.label)}</span>` : ''}
          <span class="rp-para-text">${enHtml}</span>
        </p>
        ${viBlock}
      </div>
    `;
  }

  /* ---------- EXAM WORKSPACE RENDERER (CD-IELTS Authentic x Totoro Custom) ---------- */
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
    const minsAlloc = curPassage.suggestedMins || 20;

    const timerUrgency = s.remainingSec <= 300 ? ' is-critical' : (s.remainingSec <= 600 ? ' is-warn' : '');
    const themeCls = s.examTheme === 'cd' ? 'rp-theme-cd' : (s.examTheme === 'night' ? 'rp-theme-night' : 'rp-theme-totoro');

    const reviewStripHtml = isReview && s.reviewResult ? `
      <div class="rp-review-strip">
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
          ${s.reviewResult.byType.map((t) => `
            <span class="rp-type-chip">${esc(t.label)}: <strong>${t.correct}/${t.total}</strong></span>
          `).join('')}
        </div>
        <div class="rp-rev-actions">
          <button type="button" class="btn-subtle rp-btn-sm ${s.showBilingual ? 'is-on' : ''}" id="rp-btn-bilingual"
            onclick="ReadingPracticeApp.toggleBilingual()">
            ${s.showBilingual ? '✓ Đang hiện Song ngữ' : 'Dịch song ngữ'}
          </button>
          <button type="button" class="btn-subtle rp-btn-sm" onclick="ReadingPracticeApp.retryCurrent()">Làm lại</button>
        </div>
      </div>
    ` : '';

    const newsToolbarHtml = (!isReview && s.isNews) ? `
      <div class="rp-news-bar">
        <span>Đọc báo song ngữ: Bấm vào bất kỳ từ nào trong bài để tra nghĩa &amp; lưu vào <strong>Từ của tôi</strong></span>
        <button type="button" class="btn-subtle rp-btn-sm ${s.showBilingual ? 'is-on' : ''}" id="rp-btn-bilingual"
          onclick="ReadingPracticeApp.toggleBilingual()">
          ${s.showBilingual ? '✓ Đang hiện Song ngữ' : 'Bật dịch song ngữ'}
        </button>
      </div>
    ` : '';

    const groupsHtml = (curPassage.groups || []).map((g) => `
      <div class="rp-q-group">
        <div class="rp-q-group-banner">
          <div class="rp-q-group-title">${esc(g.title)}</div>
          ${g.instruction ? `<div class="rp-q-group-inst">${esc(g.instruction)}</div>` : ''}
        </div>
        <div class="rp-q-list">
          ${(g.questions || []).map((q) => renderQuestionCard(q, curPassage, isReview)).join('')}
        </div>
      </div>
    `).join('');

    // Official CD-IELTS Inspera bottom bar: Part tabs + Square/Circle numbered buttons
    const partSummariesHtml = passages.length > 1 ? `
      <div class="rp-cd-parts" role="tablist">
        ${passages.map((p, idx) => {
          const pQs = allQ.filter((q) => q._pIdx === idx);
          const pDone = pQs.filter((q) => String(s.answers[q._qid] || '').trim()).length;
          return `
            <button type="button" class="rp-exam-ptab ${idx === s.activePassageIdx ? 'active' : ''}"
              onclick="ReadingPracticeApp.switchExamPassage(${idx})">
              <span>Passage ${p.passageNum || (idx + 1)}</span>
              <small class="tabular">${pDone}/${pQs.length}</small>
            </button>
          `;
        }).join('')}
      </div>
    ` : '';

    const navPillsHtml = allQ.map((q) => {
      const val = String(s.answers[q._qid] || '').trim();
      const flagged = !!s.flagged[q._qid];
      const isCur = s.activeQid === q._qid;
      let cls = 'rp-nav-dot';
      if (isCur) cls += ' is-current';
      if (isReview) {
        cls += isAnswerCorrect(q, val) ? ' is-correct' : ' is-wrong';
      } else {
        if (val) cls += ' is-answered';
        if (flagged) cls += ' is-review-circle';
      }
      return `<button type="button" class="${cls}" onclick="ReadingPracticeApp.jumpToQuestion(${q._pIdx}, '${esc(q._qid)}')" title="Question ${q.num}${flagged ? ' (Review)' : ''}">${q.num}</button>`;
    }).join('');

    const notesCount = (s.notes || []).length;
    const notesDrawerHtml = `
      <aside class="rp-notes-drawer ${s.notesOpen ? 'open' : ''}" id="rp-notes-drawer" aria-label="Ghi chú bài thi">
        <div class="rp-notes-head">
          <strong>Ghi chú (Notes · ${notesCount})</strong>
          <button type="button" class="rp-icon-btn" onclick="ReadingPracticeApp.toggleNotesDrawer(false)">✕</button>
        </div>
        <form class="rp-notes-form" onsubmit="ReadingPracticeApp.addManualNote(event)">
          <textarea id="rp-note-input" rows="2" placeholder="Viết ghi chú nhanh cho bài đọc..."></textarea>
          <button type="submit" class="btn btn-primary rp-btn-sm">+ Lưu ghi chú</button>
        </form>
        <div class="rp-notes-list">
          ${notesCount ? s.notes.map((n) => `
            <div class="rp-note-item">
              ${n.quote ? `<div class="rp-note-quote">“${esc(n.quote)}”</div>` : ''}
              <div class="rp-note-text">${esc(n.text)}</div>
              <button type="button" class="rp-note-del" onclick="ReadingPracticeApp.deleteNote('${esc(n.id)}')">Xóa</button>
            </div>
          `).join('') : '<div class="rp-notes-empty">Chưa có ghi chú nào. Bạn có thể bôi đen đoạn văn bên trái rồi bấm <strong>+ Ghi chú</strong> giống phòng thi máy IELTS.</div>'}
        </div>
      </aside>
    `;

    const passageInstruction = s.isNews
      ? `${esc(curPassage.newsSource || 'Academic News')} · ${esc(curPassage.topic || '')}`
      : `READING PASSAGE ${curPassage.passageNum || (s.activePassageIdx + 1)} · You should spend about ${minsAlloc} minutes on Questions ${qMin}–${qMax}, which are based on the passage below.`;

    root.innerHTML = `
      <div class="rp-workspace ${themeCls}" id="rp-workspace" style="--rp-font-scale:${s.fontScale};">
        <header class="rp-exam-topbar rp-cd-topbar">
          <div class="rp-top-left">
            <button type="button" class="btn-subtle rp-btn-sm" onclick="ReadingPracticeApp.exitToHub()">← Kho đề</button>
            <div class="rp-exam-title-wrap">
              <div class="rp-exam-title">${esc(s.title)}</div>
              <span class="rp-cd-qrange tabular">Questions ${qMin}–${qMax}</span>
            </div>
          </div>

          <div class="rp-top-center">
            ${!isReview ? `
              <button type="button" class="rp-cd-clock${timerUrgency}" onclick="ReadingPracticeApp.togglePauseTimer()" title="Bấm để tạm dừng / tiếp tục đồng hồ">
                <svg class="rp-clock-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2" stroke-linecap="round"/></svg>
                <span id="rp-timer-display" class="tabular">${formatDuration(s.remainingSec)}</span>
                <span class="rp-clock-lbl">${s.paused ? 'tạm dừng' : 'còn lại'}</span>
              </button>
            ` : `<span class="rp-mode-pill">Chế độ xem giải · Paraphrase &amp; Tra từ</span>`}
          </div>

          <div class="rp-top-right">
            <button type="button" class="rp-tool-btn ${s.notesOpen ? 'active' : ''}" id="rp-btn-notes"
              onclick="ReadingPracticeApp.toggleNotesDrawer()" title="Mở sổ ghi chú giống phòng thi CD-IELTS">
              Ghi chú${notesCount ? ` (${notesCount})` : ''}
            </button>

            <div class="rp-theme-switch" role="group" aria-label="Màu nền phòng thi">
              <button type="button" class="rp-theme-btn ${s.examTheme === 'totoro' ? 'active' : ''}"
                onclick="ReadingPracticeApp.setExamTheme('totoro')">Totoro</button>
              <button type="button" class="rp-theme-btn ${s.examTheme === 'cd' ? 'active' : ''}"
                onclick="ReadingPracticeApp.setExamTheme('cd')">Thi máy</button>
              <button type="button" class="rp-theme-btn ${s.examTheme === 'night' ? 'active' : ''}"
                onclick="ReadingPracticeApp.setExamTheme('night')">Đêm</button>
            </div>

            <div class="rp-font-btns">
              <button type="button" class="rp-icon-btn" onclick="ReadingPracticeApp.adjustFont(-0.08)" title="Giảm cỡ chữ">A-</button>
              <button type="button" class="rp-icon-btn" onclick="ReadingPracticeApp.adjustFont(0.08)" title="Tăng cỡ chữ">A+</button>
            </div>

            ${!isReview ? `
              <button type="button" class="btn btn-primary rp-btn-sm" id="rp-btn-open-submit"
                onclick="ReadingPracticeApp.openPreSubmitModal()">Nộp bài</button>
            ` : ''}
          </div>
        </header>

        ${reviewStripHtml}
        ${newsToolbarHtml}

        <div class="rp-mobile-pane-bar">
          <button type="button" class="rp-mob-tab ${state.mobilePane === 'passage' ? 'active' : ''}"
            onclick="ReadingPracticeApp.setMobilePane('passage')">Bài đọc</button>
          <button type="button" class="rp-mob-tab ${state.mobilePane === 'questions' ? 'active' : ''}"
            onclick="ReadingPracticeApp.setMobilePane('questions')">Câu hỏi (${allQ.filter((x) => String(s.answers[x._qid] || '').trim()).length}/${allQ.length})</button>
        </div>

        <div class="rp-split-body" id="rp-split-body">
          <section class="rp-pane rp-pane-left ${state.mobilePane === 'passage' ? 'mob-active' : ''}"
            id="rp-passage-pane" style="flex: 0 0 ${state.splitRatio}%;"
            onmouseup="ReadingPracticeApp.handlePassageSelection(event)"
            onclick="ReadingPracticeApp.handlePassageWordClick(event)">
            <div class="rp-cd-part-banner">
              <span>${passageInstruction}</span>
              <span class="rp-dict-hint">${enableDict ? 'Bấm từ bất kỳ để tra &amp; lưu' : 'Bôi đen để Highlight / Ghi chú'}</span>
            </div>
            <div class="rp-passage-inner">
              <h2 class="rp-passage-title">${esc(curPassage.title)}</h2>
              ${curPassage.subtitle ? `<p class="rp-passage-sub">${esc(curPassage.subtitle)}</p>` : ''}
              <div class="rp-passage-content" id="rp-passage-content">
                ${(curPassage.paragraphs || []).map((para) => renderPassageParagraphHtml(para, curPassage, enableDict)).join('')}
              </div>
            </div>
          </section>

          <div class="rp-resizer" id="rp-resizer" title="Kéo trái/phải để chỉnh tỷ lệ bài đọc và câu hỏi"
            onmousedown="ReadingPracticeApp.startResize(event)">
            <span class="rp-resizer-handle" aria-hidden="true">⇄</span>
          </div>

          <section class="rp-pane rp-pane-right ${state.mobilePane === 'questions' ? 'mob-active' : ''}" id="rp-questions-pane">
            <div class="rp-questions-inner">
              ${groupsHtml}
            </div>
          </section>

          ${notesDrawerHtml}
        </div>

        <footer class="rp-exam-footer rp-cd-footer">
          <div class="rp-cd-footer-left">
            ${partSummariesHtml}
            <div class="rp-nav-dots">${navPillsHtml}</div>
          </div>
          <div class="rp-cd-footer-right">
            <div class="rp-footer-legend">
              ${!isReview
                ? '<span><i class="rp-dot-key ans"></i>Đã làm</span><span><i class="rp-dot-key rev"></i>Review</span>'
                : '<span><i class="rp-dot-key ok"></i>Đúng</span><span><i class="rp-dot-key bad"></i>Sai</span>'}
            </div>
            <div class="rp-cd-step-btns">
              <button type="button" class="rp-step-btn" onclick="ReadingPracticeApp.stepQuestion(-1)" title="Câu trước">←</button>
              <button type="button" class="rp-step-btn" onclick="ReadingPracticeApp.stepQuestion(1)" title="Câu kế tiếp">→</button>
            </div>
          </div>
        </footer>

        <!-- Floating Selection Highlight & Note Toolbar (CD-IELTS Inspera style) -->
        <div class="rp-hl-toolbar hidden" id="rp-hl-toolbar">
          <button type="button" class="rp-hl-btn yl" onclick="ReadingPracticeApp.applyHighlight('yellow')" title="Highlight vàng (CD-IELTS)"></button>
          <button type="button" class="rp-hl-btn gn" onclick="ReadingPracticeApp.applyHighlight('green')" title="Highlight xanh"></button>
          <button type="button" class="rp-hl-btn pk" onclick="ReadingPracticeApp.applyHighlight('pink')" title="Highlight hồng"></button>
          <button type="button" class="rp-hl-txt" onclick="ReadingPracticeApp.addNoteFromSelection()">+ Ghi chú</button>
          <button type="button" class="rp-hl-txt" onclick="ReadingPracticeApp.clearSelectionHighlight()">Xóa</button>
          ${enableDict ? '<button type="button" class="rp-hl-txt is-dict" onclick="ReadingPracticeApp.lookupSelectedPhrase()">Tra từ</button>' : ''}
        </div>

        <!-- YouPass Click-to-Dictionary Popover -->
        <div class="rp-dict-popover hidden" id="rp-dict-popover" onclick="event.stopPropagation()"></div>

        <!-- Pre-Submit Review Check Modal -->
        <div class="modal-overlay" id="rp-presubmit-modal" onclick="ReadingPracticeApp.closePreSubmitModal(event)">
          <div class="modal-card rp-presubmit-card" onclick="event.stopPropagation()">
            <div class="modal-header">
              <div class="modal-title">Kiểm tra trước khi nộp bài</div>
              <button type="button" class="btn-icon-glass" style="width:30px;height:30px;" onclick="ReadingPracticeApp.closePreSubmitModal()">✕</button>
            </div>
            <div class="modal-body" id="rp-presubmit-body"></div>
          </div>
        </div>
      </div>
    `;
  }

  function renderQuestionCard(q, passage, isReview) {
    const s = state.session;
    const qid = `${passage.id}__q${q.num}`;
    const userVal = String(s.answers[qid] ?? '');
    const flagged = !!s.flagged[qid];
    const isCur = s.activeQid === qid;
    const ok = isReview ? isAnswerCorrect(q, userVal) : false;

    let promptHtml = esc(q.prompt);
    let inputHtml = '';
    if (q.type === 'tfng' || q.type === 'ynng') {
      const opts = q.type === 'tfng' ? ['TRUE', 'FALSE', 'NOT GIVEN'] : ['YES', 'NO', 'NOT GIVEN'];
      inputHtml = `
        <div class="rp-pill-choices">
          ${opts.map((opt) => {
            const active = userVal.toUpperCase() === opt;
            let cls = `rp-choice-pill${active ? ' selected' : ''}`;
            if (isReview && opt === String(q.answer).toUpperCase()) cls += ' is-key';
            if (isReview && active && !ok) cls += ' is-wrong-pick';
            return `<button type="button" class="${cls}" ${isReview ? 'disabled' : ''}
              onclick="ReadingPracticeApp.setAnswer('${esc(qid)}', '${opt}')">${opt}</button>`;
          }).join('')}
        </div>
      `;
    } else if (q.type === 'gap') {
      const inlineBox = `<input type="text" class="rp-gap-input rp-gap-inline ${isReview ? (ok ? 'is-ok' : 'is-bad') : ''}" value="${esc(userVal)}" ${isReview ? 'readonly' : ''} placeholder="${q.num}" aria-label="Câu ${q.num}" onfocus="ReadingPracticeApp.focusQuestion('${esc(qid)}')" oninput="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value, true)" autocomplete="off">`;
      if (/_{3,}/.test(q.prompt)) {
        promptHtml = esc(q.prompt).replace(/_{3,}/, inlineBox);
      } else {
        inputHtml = `<div class="rp-gap-wrap">${inlineBox}</div>`;
      }
    } else if (q.type === 'mcq') {
      inputHtml = `
        <div class="rp-mcq-list">
          ${(q.options || []).map((opt) => {
            const active = userVal.toUpperCase() === opt.key;
            const strikeKey = `${qid}__${opt.key}`;
            const isStruck = !!s.struck[strikeKey];
            let cls = `rp-mcq-row${active ? ' selected' : ''}${isStruck ? ' is-struck' : ''}`;
            if (isReview && opt.key === String(q.answer).toUpperCase()) cls += ' is-key';
            if (isReview && active && !ok) cls += ' is-wrong-pick';
            return `
              <div class="${cls}">
                <button type="button" class="rp-mcq-pick" ${isReview ? 'disabled' : ''}
                  onclick="ReadingPracticeApp.setAnswer('${esc(qid)}', '${esc(opt.key)}')">
                  <span class="rp-mcq-key">${esc(opt.key)}</span>
                  <span class="rp-mcq-text">${esc(opt.text)}</span>
                </button>
                ${!isReview ? `
                  <button type="button" class="rp-strike-btn ${isStruck ? 'active' : ''}"
                    onclick="ReadingPracticeApp.toggleStrike('${esc(strikeKey)}', event)"
                    title="Loại trừ đáp án này (gạch ngang)">S̶</button>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    let reviewPanelHtml = '';
    if (isReview) {
      const correctDisplay = Array.isArray(q.answer) ? q.answer[0] : q.answer;
      const paraRows = (q.paraphrase || []).map((pr) => `
        <div class="rp-para-map-row">
          <span class="rp-pm-q">${esc(pr.q)}</span>
          <span class="rp-pm-arrow">↔</span>
          <span class="rp-pm-p">${esc(pr.p)}</span>
        </div>
      `).join('');

      reviewPanelHtml = `
        <div class="rp-rev-box ${ok ? 'is-ok' : 'is-bad'}">
          <div class="rp-rev-box-head">
            <span>${ok ? '✓ Chính xác' : `✕ Đáp án đúng: <strong>${esc(correctDisplay)}</strong>`}</span>
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

    return `
      <div class="rp-q-card ${isCur && !isReview ? 'is-current' : ''} ${isReview ? (ok ? 'rev-ok' : 'rev-bad') : ''}"
        id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
        <div class="rp-q-head">
          <span class="rp-q-num">${q.num}</span>
          <div class="rp-q-prompt">${promptHtml}</div>
          ${!isReview ? `
            <button type="button" class="rp-flag-btn ${flagged ? 'active' : ''}"
              onclick="event.stopPropagation(); ReadingPracticeApp.toggleFlag('${esc(qid)}')" title="Đánh dấu Review (chuyển số câu thành hình tròn giống CD-IELTS)">${flagged ? 'Review ✓' : 'Review'}</button>
          ` : ''}
        </div>
        ${inputHtml}
        ${reviewPanelHtml}
      </div>
    `;
  }

  /* ---------- CLICK-TO-DICTIONARY POPOVER -> SAVE TO MY VOCAB ---------- */
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

    state.dictTarget = {
      entry,
      context: contextSentence || '',
      deckName: defaultDeckName
    };

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
        <input type="text" class="rp-dict-input" id="rp-dict-meaning-input"
          value="${esc(entry.vi)}" placeholder="Nhập nghĩa ngắn gọn nếu từ chưa có sẵn...">
      </div>

      ${entry.synonyms.length ? `
        <div class="rp-dict-syns">
          <span>Đồng nghĩa:</span>
          ${entry.synonyms.map((sy) => `<span class="rp-syn-chip">${esc(sy)}</span>`).join('')}
        </div>
      ` : ''}

      ${contextSentence ? `
        <div class="rp-dict-ctx">
          <div class="rp-dict-lbl">Ngữ cảnh trích từ bài đọc (tự đính kèm Flashcard)</div>
          <div class="rp-dict-ctx-text">“${esc(contextSentence)}”</div>
        </div>
      ` : ''}

      <div class="rp-dict-foot">
        <select class="rp-dict-deck-sel" id="rp-dict-deck-select">
          ${deckOptions.map((dn) => `<option value="${esc(dn)}">${esc(dn)}</option>`).join('')}
        </select>
        <button type="button" class="btn btn-primary rp-btn-sm" id="rp-btn-save-myvocab"
          onclick="ReadingPracticeApp.saveDictWordToMyVocab()">
          ${alreadySaved ? '✓ Lưu thêm / Cập nhật' : '+ Lưu vào Từ của tôi'}
        </button>
      </div>
    `;

    pop.classList.remove('hidden');
    // Position cleanly inside viewport
    const pw = 340;
    const left = Math.max(14, Math.min(window.innerWidth - pw - 16, (anchorRect?.left || 100) - 20));
    const top = Math.max(70, Math.min(window.innerHeight - 310, (anchorRect?.bottom || 180) + 10));
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  /* ---------- PUBLIC API ---------- */
  const ReadingPracticeApp = {
    init() {
      renderPortal();
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDictPopover();
          this.hideHighlightToolbar();
          this.closePreSubmitModal();
        }
      });
    },

    render() {
      if (state.view === 'exam' && state.session) {
        renderExamWorkspace();
      } else if (state.view === 'source') {
        renderHub();
      } else {
        renderPortal();
      }
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
      renderHub();
    },

    setSource(src) {
      state.source = src;
      state.view = 'source';
      state.partFilter = 'all';
      state.newsTopic = 'all';
      renderHub();
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
      if (inp) {
        inp.focus();
        inp.setSelectionRange(inp.value.length, inp.value.length);
      }
    },

    startPassage(passageId, opts = {}) {
      const p = (DATA().PASSAGES || {})[passageId];
      if (!p) return;
      startSession({
        itemId: p.id,
        title: p.title,
        source: p.source,
        isFull: false,
        suggestedMins: p.suggestedMins || 20,
        deckDefaultName: p.deckDefaultName || p.title,
        passageIds: [p.id],
        openInReview: !!opts.openInReview
      });
    },

    startFullTest(fullId, opts = {}) {
      const ft = (DATA().FULL_TESTS || []).find((x) => x.id === fullId);
      if (!ft) return;
      startSession({
        itemId: ft.id,
        title: ft.title,
        source: ft.source,
        isFull: true,
        suggestedMins: ft.suggestedMins || 60,
        deckDefaultName: ft.deckDefaultName || ft.title,
        passageIds: ft.passageIds.slice(),
        openInReview: !!opts.openInReview
      });
    },

    resumeDraft() {
      const d = ReadingPracticeStore.getInProgress();
      if (!d || !Array.isArray(d.passageIds) || !d.passageIds.length) return;
      startSession({
        itemId: d.itemId,
        title: d.title,
        source: d.source,
        isFull: !!d.isFull,
        suggestedMins: Math.max(1, Math.ceil((d.remainingSec || 1200) / 60)),
        remainingSec: d.remainingSec,
        elapsedSec: d.elapsedSec,
        deckDefaultName: d.deckDefaultName,
        passageIds: d.passageIds,
        answers: d.answers || {},
        flagged: d.flagged || {},
        struck: d.struck || {}
      });
    },

    discardResume() {
      ReadingPracticeStore.clearInProgress();
      this.render();
      toast('Đã xóa bài làm dở.');
    },

    exitToHub() {
      if (state.session && state.session.mode === 'exam') {
        persistDraft();
      }
      stopTimer();
      state.view = 'source';
      state.session = null;
      renderHub();
    },

    switchExamPassage(idx) {
      if (!state.session) return;
      state.session.activePassageIdx = idx;
      state.session.activeEvidenceId = null;
      this.closeDictPopover();
      renderExamWorkspace();
    },

    setExamTheme(theme) {
      if (!state.session) return;
      state.session.examTheme = (theme === 'cd' || theme === 'night') ? theme : 'totoro';
      renderExamWorkspace();
    },

    focusQuestion(qid) {
      if (!state.session || state.session.activeQid === qid) return;
      state.session.activeQid = qid;
      document.querySelectorAll('.rp-q-card.is-current').forEach((c) => c.classList.remove('is-current'));
      const card = document.getElementById(`rp-qcard-${qid}`);
      if (card) card.classList.add('is-current');
      const allQ = getAllSessionQuestions();
      const idx = allQ.findIndex((x) => x._qid === qid);
      document.querySelectorAll('.rp-nav-dot').forEach((d, i) => d.classList.toggle('is-current', i === idx));
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
        state.session.notes.unshift({
          id: 'n_' + Date.now().toString(36),
          quote,
          text: 'Ghi chú cho đoạn này...'
        });
      }
      renderExamWorkspace();
      const ta = document.getElementById('rp-note-input');
      if (ta) ta.focus();
    },

    addManualNote(ev) {
      if (ev) ev.preventDefault();
      if (!state.session) return;
      const ta = document.getElementById('rp-note-input');
      const text = (ta?.value || '').trim();
      if (!text) return;
      state.session.notes.unshift({
        id: 'n_' + Date.now().toString(36),
        quote: '',
        text
      });
      renderExamWorkspace();
    },

    deleteNote(noteId) {
      if (!state.session) return;
      state.session.notes = (state.session.notes || []).filter((n) => n.id !== noteId);
      renderExamWorkspace();
    },

    adjustFont(delta) {
      if (!state.session) return;
      state.session.fontScale = Math.max(0.84, Math.min(1.28, Math.round((state.session.fontScale + delta) * 100) / 100));
      const ws = document.getElementById('rp-workspace');
      if (ws) ws.style.setProperty('--rp-font-scale', state.session.fontScale);
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

    setAnswer(qid, value, skipFullRerender = false) {
      if (!state.session || state.session.mode !== 'exam') return;
      state.session.answers[qid] = value;
      state.session.activeQid = qid;
      persistDraft();
      if (skipFullRerender) {
        // Lightweight update of footer nav dot without stealing input focus
        const allQ = getAllSessionQuestions();
        const qObj = allQ.find((x) => x._qid === qid);
        if (qObj) {
          const dots = document.querySelectorAll('.rp-nav-dot');
          const idx = allQ.indexOf(qObj);
          if (dots[idx]) {
            dots[idx].classList.toggle('is-answered', String(value || '').trim().length > 0);
          }
        }
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

    jumpToQuestion(pIdx, qid) {
      if (!state.session) return;
      state.session.activeQid = qid;
      state.mobilePane = 'questions';
      if (state.session.activePassageIdx !== pIdx) {
        state.session.activePassageIdx = pIdx;
        renderExamWorkspace();
      } else {
        this.focusQuestion(qid);
        renderExamWorkspace();
      }
      const el = document.getElementById(`rp-qcard-${qid}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    },

    openPreSubmitModal() {
      if (!state.session) return;
      const allQ = getAllSessionQuestions();
      const answered = allQ.filter((q) => String(state.session.answers[q._qid] || '').trim()).length;
      const unanswered = allQ.length - answered;
      const flaggedList = allQ.filter((q) => state.session.flagged[q._qid]);
      const modal = document.getElementById('rp-presubmit-modal');
      const body = document.getElementById('rp-presubmit-body');
      if (!modal || !body) return;

      body.innerHTML = `
        <div class="rp-ps-stats">
          <div class="rp-ps-box"><span>Đã làm</span><strong class="tabular">${answered} / ${allQ.length}</strong></div>
          <div class="rp-ps-box ${unanswered > 0 ? 'warn' : ''}"><span>Chưa làm</span><strong class="tabular">${unanswered}</strong></div>
          <div class="rp-ps-box"><span>Đặt cờ ⚑</span><strong class="tabular">${flaggedList.length}</strong></div>
        </div>
        <div class="rp-ps-grid">
          ${allQ.map((q) => {
            const has = !!String(state.session.answers[q._qid] || '').trim();
            const flg = !!state.session.flagged[q._qid];
            return `<button type="button" class="rp-ps-cell ${has ? 'is-ans' : 'is-empty'} ${flg ? 'is-flg' : ''}"
              onclick="ReadingPracticeApp.closePreSubmitModal(); ReadingPracticeApp.jumpToQuestion(${q._pIdx}, '${esc(q._qid)}')">
              ${q.num}${flg ? '⚑' : ''}
            </button>`;
          }).join('')}
        </div>
        <div class="rp-ps-foot">
          <button type="button" class="btn-subtle" onclick="ReadingPracticeApp.closePreSubmitModal()">Kiểm tra lại</button>
          <button type="button" class="btn btn-primary" id="rp-btn-confirm-submit" onclick="ReadingPracticeApp.confirmSubmit()">Chấm điểm ngay →</button>
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
        itemId: state.session.itemId,
        title: state.session.title,
        source: state.session.source,
        isFull: state.session.isFull,
        score: res.score,
        total: res.total,
        band: res.band,
        elapsedSec: res.elapsedSec,
        completedAt: Date.now()
      });

      renderExamWorkspace();
      toast(`Hoàn thành! Đúng ${res.score}/${res.total} · Band dự kiến ${res.band.toFixed(1)}`);
    },

    retryCurrent() {
      if (!state.session) return;
      const cur = state.session;
      if (cur.isFull) this.startFullTest(cur.itemId);
      else this.startPassage(cur.itemId);
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
        const el = document.querySelector(`.rp-ev-span[data-ev-id="${evId}"]`);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 40);
    },

    /* ---------- HIGHLIGHT TOOLBAR ---------- */
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
      const rect = range.getBoundingClientRect();
      bar.style.left = `${Math.max(12, Math.min(window.innerWidth - 220, rect.left + rect.width / 2 - 90))}px`;
      bar.style.top = `${Math.max(66, rect.top - 44)}px`;
      bar.classList.remove('hidden');
    },

    hideHighlightToolbar() {
      const bar = document.getElementById('rp-hl-toolbar');
      if (bar) bar.classList.add('hidden');
    },

    applyHighlight(color) {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      try {
        const range = sel.getRangeAt(0);
        const mark = document.createElement('mark');
        mark.className = `rp-hl-mark hl-${color}`;
        mark.appendChild(range.extractContents());
        range.insertNode(mark);
        sel.removeAllRanges();
      } catch (_) {
        toast('Hãy bôi đen trong cùng một đoạn văn để highlight.');
      }
      this.hideHighlightToolbar();
    },

    clearSelectionHighlight() {
      const sel = window.getSelection();
      const pane = document.getElementById('rp-passage-content');
      if (pane) {
        const marks = pane.querySelectorAll('mark.rp-hl-mark');
        marks.forEach((m) => {
          const parent = m.parentNode;
          while (m.firstChild) parent.insertBefore(m.firstChild, m);
          parent.removeChild(m);
        });
      }
      if (sel) sel.removeAllRanges();
      this.hideHighlightToolbar();
    },

    lookupSelectedPhrase() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const parentEl = range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
      const ctx = extractSentenceForNode(parentEl);
      this.hideHighlightToolbar();
      showDictPopover(text, ctx, rect);
    },

    /* ---------- CLICK-TO-DICTIONARY ---------- */
    handlePassageWordClick(ev) {
      const s = state.session;
      if (!s || !(s.mode === 'review' || s.isNews)) return;
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed && sel.toString().trim().length > 0) return;

      const wordEl = ev.target.closest('.rp-word');
      if (!wordEl) {
        this.closeDictPopover();
        return;
      }
      const word = wordEl.dataset.word || wordEl.textContent.trim();
      const ctx = extractSentenceForNode(wordEl);
      showDictPopover(word, ctx, wordEl.getBoundingClientRect());
    },

    closeDictPopover() {
      const pop = document.getElementById('rp-dict-popover');
      if (pop) pop.classList.add('hidden');
      state.dictTarget = null;
    },

    speakDictWord(accent) {
      if (!state.dictTarget?.entry?.word) return;
      if (B()?.speakText) {
        B().speakText(state.dictTarget.entry.word, accent || 'en-US');
      } else if (window.AudioEngine?.speak) {
        window.AudioEngine.speak(state.dictTarget.entry.word, { accent: accent || 'en-US' });
      }
    },

    saveDictWordToMyVocab() {
      if (!state.dictTarget || !window.MyVocabStore) {
        toast('Chức năng Từ của tôi chưa sẵn sàng.');
        return;
      }
      const meaningInput = document.getElementById('rp-dict-meaning-input');
      const deckSel = document.getElementById('rp-dict-deck-select');
      const deckName = deckSel?.value || state.dictTarget.deckName || 'Từ của tôi';
      const meaning = (meaningInput?.value || state.dictTarget.entry.vi || '').trim() || '(Tự ghi chú nghĩa sau)';
      const entry = state.dictTarget.entry;

      const res = window.MyVocabStore.addWordToNamedDeck(deckName, {
        lemma: entry.word,
        pos: entry.pos || 'word',
        ipa: entry.ipa || '',
        clean_meaning: meaning,
        reading_context: state.dictTarget.context || '',
        synonyms: entry.synonyms || [],
        source: state.session?.title || 'Reading Practice'
      });

      this.closeDictPopover();
      renderExamWorkspace();
      if (res?.ok) {
        toast(`Đã lưu "${entry.word}" vào "${deckName}" (Từ của tôi)!`);
      } else {
        toast(`"${entry.word}" đã có trong "${deckName}".`);
      }
    },

    /* ---------- SPLIT-SCREEN RESIZER ---------- */
    startResize(ev) {
      ev.preventDefault();
      const body = document.getElementById('rp-split-body');
      const left = document.getElementById('rp-passage-pane');
      if (!body || !left) return;
      const rect = body.getBoundingClientRect();

      const onMove = (e) => {
        const pct = Math.max(30, Math.min(70, ((e.clientX - rect.left) / rect.width) * 100));
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => ReadingPracticeApp.init());
  } else {
    ReadingPracticeApp.init();
  }
})();
