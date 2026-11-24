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
  const ANTI_CHEAT_LOCKOUT_MINS = 30;

  const PASTEL_PENS = [
    { id: 'yellow', name: 'Vàng nắng',     role: 'Ý chính',    swatch: '#FDE047' },
    { id: 'green',  name: 'Xanh bạc hà',   role: 'Dẫn chứng',  swatch: '#86EFAC' },
    { id: 'pink',   name: 'Hồng đào',      role: 'Từ bẫy',     swatch: '#F9A8D4' },
    { id: 'blue',   name: 'Xanh bầu trời', role: 'Số liệu',    swatch: '#7DD3FC' },
    { id: 'purple', name: 'Tím oải hương', role: 'Từ vựng',    swatch: '#D8B4FE' }
  ];

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
      this.save(st);
    },

    saveInProgress() {
      // Disabled: students complete the test or end & grade immediately (no resumable drafts).
      this.clearInProgress();
    },

    clearInProgress() {
      const st = this.load();
      if (st.inProgress != null) {
        st.inProgress = null;
        this.save(st);
      }
    },

    getInProgress() { return null; },
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

  function isTeacherBypass() {
    try {
      const bridge = B();
      if (bridge?.isTeacherMode?.() || bridge?.isTeacherPreviewing?.()) return true;
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
    if (state.view !== 'exam' || !s || s.mode !== 'exam' || s.isNews) return false;
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
      s.antiCheatNotice = `Cảnh cáo chống gian lận (1/2 — ${cleanReason}): Vi phạm thêm 1 lần nữa sẽ kết thúc, chấm điểm ngay và khóa 30 phút.`;
      renderExamWorkspace();
      showAntiCheatModal({
        level: 'warn',
        badge: 'CẢNH CÁO 1/2',
        title: 'Không chuyển tab khi đang làm bài',
        reason: cleanReason,
        ctaLabel: 'Tôi đã hiểu · Quay lại làm bài'
      });
    } else {
      // Strike 2: DO NOT reset/wipe answers! End & grade immediately with current answers, then lock for 30 minutes.
      const res = computeReviewResult();
      const isMastered = res.total > 0 && res.score === res.total;
      const itemTitle = s.title;

      stopTimer();
      stopReadingAntiCheat();
      ReadingPracticeStore.clearInProgress();

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
        terminatedByAntiCheat: true,
        completedAt: Date.now()
      });

      const lockInfo = ReadingPracticeStore.setLockout(ANTI_CHEAT_LOCKOUT_MINS, {
        reason: cleanReason,
        score: res.score,
        total: res.total,
        band: res.band,
        title: itemTitle
      });

      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();

      showAntiCheatModal({
        level: 'lock',
        badge: 'VI PHẠM 2/2 · KHÓA 30 PHÚT',
        title: 'Bài làm đã kết thúc · Khóa 30 phút',
        reason: cleanReason,
        score: res.score,
        total: res.total,
        band: res.band,
        until: lockInfo.until,
        remainingMs: ANTI_CHEAT_LOCKOUT_MINS * 60 * 1000,
        ctaLabel: 'Đã hiểu'
      });
    }
  }

  function bindGlobalReadingAntiCheatDom() {
    if (_acDomBound || typeof document === 'undefined') return;
    _acDomBound = true;

    document.addEventListener('copy', (e) => {
      if (!isReadingAntiCheatActive()) return;
      const ws = document.getElementById('rp-workspace');
      if (ws && ws.contains(e.target)) {
        e.preventDefault();
        toast('Chống gian lận: Không được sao chép nội dung khi đang làm bài!');
      }
    }, true);

    document.addEventListener('cut', (e) => {
      if (!isReadingAntiCheatActive()) return;
      const ws = document.getElementById('rp-workspace');
      if (ws && ws.contains(e.target)) {
        e.preventDefault();
        toast('Chống gian lận: Không được cắt nội dung khi đang làm bài!');
      }
    }, true);

    document.addEventListener('paste', (e) => {
      if (!isReadingAntiCheatActive()) return;
      if (e.target && e.target.closest && e.target.closest('.ins-gap-input')) {
        e.preventDefault();
        toast('Hãy tự gõ đáp án vào ô trống — không được dán chữ!');
      }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (!isReadingAntiCheatActive()) return;
      const k = (e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      const inGap = !!(e.target && e.target.closest && e.target.closest('.ins-gap-input, #rp-note-input'));
      if (e.key === 'F12' || (ctrl && e.shiftKey && ['i', 'j', 'c'].includes(k)) || (ctrl && ['u', 'p'].includes(k))) {
        e.preventDefault();
        toast('Chống gian lận: Phím tắt này bị khóa trong lúc làm bài.');
        return;
      }
      if (ctrl && ['c', 'x', 'v'].includes(k) && !inGap) {
        e.preventDefault();
        toast('Chống gian lận: Không được sao chép/dán nội dung bài đọc.');
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

  const BANK_VERSION = '20261125a';
  const _loadedBanks = {};
  const _bankPromises = {};

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

    const cardsHtml = sources.map((s) => {
      const summary = d.BANK_SUMMARY || {};
      let rightBadge = '';
      if (s.id === 'cambridge') rightBadge = `${summary.cambridge?.booksReady || 20}/20 cuốn`;
      else if (s.id === 'volume') rightBadge = `10 tập · Real Reading`;
      else if (s.id === 'actual') rightBadge = `Passage 1–3 · Full Test`;
      else rightBadge = `Song ngữ · Tra từ`;

      const actionsHtml = s.id === 'news'
        ? `
          <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('news')">Chọn chủ đề</button>
          <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('news')">Đọc báo ngay</button>
        `
        : s.id === 'actual'
          ? `
            <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('actual', 'p1')">Chọn bài đọc</button>
            <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('actual', 'full')">Làm Full Test</button>
          `
          : `
            <button type="button" class="tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('${esc(s.id)}', 'all')">Chọn bộ đề</button>
            <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;" onclick="event.stopPropagation(); ReadingPracticeApp.openSource('${esc(s.id)}', 'full')">Làm Full Test</button>
          `;

      const coverUrl = portalCoverById[s.id] || portalCoverById.cambridge;

      return `
        <div class="tot-exam-card rp-portal-card has-cover" data-rp-portal="${esc(s.id)}"
          onclick="ReadingPracticeApp.openSource('${esc(s.id)}')" role="button" tabindex="0">
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
              <div class="rp-portal-title" style="font-size:15.5px;font-weight:750;color:var(--ink);">${esc(s.bookTitle || s.label)}</div>
              <div style="font-size:12.5px;color:var(--ink-2);margin-top:5px;line-height:1.52;">${esc(s.desc)}</div>
            </div>
            <div class="rp-portal-foot">
              ${actionsHtml}
            </div>
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
              <p class="tot-shell-sub">Chọn Cambridge 1–20, Real Reading Test Volume 1–10, IELTS Reading Recent Actual Tests hoặc đọc báo học thuật News.</p>
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

      // 4 Test tabs inside the selected Book
      const testTabsHtml = [1, 2, 3, 4].map((tNum) => {
        const st = curTestStatus[tNum] || {};
        const hasP = st.hasData;
        const isAct = state.selectedTestNum === tNum;
        const stateText = st.done ? 'Đã làm' : (hasP ? 'Sẵn sàng' : 'Trống');
        return `
          <button type="button"
            class="rp-test-tab ${isAct ? 'active' : ''} ${hasP ? 'has-data' : 'is-empty'} ${st.done ? 'is-done' : ''}"
            data-rp-test="${tNum}"
            aria-pressed="${isAct ? 'true' : 'false'}"
            onclick="ReadingPracticeApp.selectTestNum(${tNum})">
            <span class="rp-test-dot" aria-hidden="true"></span>
            <span class="rp-test-name">Test ${tNum}</span>
            <small>${stateText}</small>
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
        const sections = [
          { key: 'p1', title: 'Passage 1', badge: '20 phút · Dễ → Trung bình', items: testPassages.filter((p) => p.passageNum === 1), isFull: false },
          { key: 'p2', title: 'Passage 2', badge: '20 phút · Trung bình → Khá', items: testPassages.filter((p) => p.passageNum === 2), isFull: false },
          { key: 'p3', title: 'Passage 3', badge: '20 phút · Nâng cao Band 7.5+', items: testPassages.filter((p) => p.passageNum === 3), isFull: false },
          { key: 'full', title: 'FULL TEST', badge: '60 phút · Trọn bộ 3 Passage', items: testFulls, isFull: true }
        ];

        contentHtml = sections.map((sec) => `
          <div class="rp-section-block" data-rp-section="${sec.key}">
            <div class="rp-section-head">
              <h3 class="rp-section-title">${esc(sec.title)}</h3>
              <span class="rp-section-badge">${esc(sec.badge)}</span>
            </div>
            ${sec.items.length
              ? `<div class="rp-cards-grid ${sec.items.length === 1 ? 'is-single' : ''}">${sec.items.map((it) => renderHubCard(it, sec.isFull)).join('')}</div>`
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

    const footHtml = isNews
      ? `
        <button type="button" class="btn-subtle rp-btn-sm" onclick="${reviewCall}">Đọc song ngữ</button>
        <button type="button" class="btn btn-primary rp-btn-sm" onclick="${startPracticeCall}">Đọc &amp; Làm bài →</button>
      `
      : `
        <div class="rp-card-mode-btns">
          ${isMastered ? `<button type="button" class="btn-subtle rp-btn-sm rp-btn-rev" onclick="${reviewCall}" title="Đã hoàn thành 100% — Xem lại đáp án &amp; lời giải">Xem giải</button>` : ''}
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
      attemptCount: Number(config.attemptCount) || 0,
      firstAttemptResult: config.firstAttemptResult || null,
      lockedCorrect: config.lockedCorrect ? { ...config.lockedCorrect } : {},
      wrongSet: config.wrongSet ? { ...config.wrongSet } : {},
      antiCheatStrikes: Number(config.antiCheatStrikes) || 0,
      antiCheatNotice: '',
      highlights: config.highlights ? JSON.parse(JSON.stringify(config.highlights)) : {},
      deckDefaultName: config.deckDefaultName || config.title,
      passageIds: config.passageIds,
      activePassageIdx: 0,
      mode: config.openInReview ? 'review' : 'exam',
      // Exam mode ALWAYS locks to official bright CD-IELTS ('cd'); Practice mode allows custom theme/contrast
      contrast: defaultContrast,          // 'cd' | 'totoro' | 'dark' | 'yellow'
      practiceContrast,
      textSize: config.textSize || 'regular',
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
    // No resumable drafts: students finish the attempt or end & grade immediately on exit.
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
    next.push({
      id: 'hl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      paraIdx,
      start,
      end,
      color: color || 'yellow'
    });
    next.sort((a, b) => (a.paraIdx - b.paraIdx) || (a.start - b.start));
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

  function getSelectionParaOffsets(range) {
    const pane = document.getElementById('rp-passage-content');
    if (!pane || !range) return [];
    const blocks = Array.from(pane.querySelectorAll('.ins-para-block'));
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

  function applyStoredHighlightsToPassage(passageId) {
    const pane = document.getElementById('rp-passage-content');
    if (!pane) return;
    // Unwrap existing marks first so function is idempotent
    pane.querySelectorAll('mark.rp-hl-mark').forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });

    const list = getPassageHighlights(passageId);
    if (!list.length) return;

    const byPara = new Map();
    for (const h of list) {
      if (!byPara.has(h.paraIdx)) byPara.set(h.paraIdx, []);
      byPara.get(h.paraIdx).push(h);
    }

    byPara.forEach((hlItems, paraIdx) => {
      const blk = pane.querySelector(`.ins-para-block[data-para-idx="${paraIdx}"]`);
      const textRoot = blk?.querySelector('.rp-para-text');
      if (!textRoot) return;

      const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let cursor = 0;
      let node;
      while ((node = walker.nextNode())) {
        const len = node.nodeValue ? node.nodeValue.length : 0;
        if (len > 0) {
          textNodes.push({ node, start: cursor, end: cursor + len });
          cursor += len;
        }
      }

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
            mark.className = `rp-hl-mark hl-${h.color || 'yellow'}${capCls}`;
            mark.dataset.hlId = h.id;
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
    const pane = document.getElementById('rp-passage-content');
    if (!pane) return;
    pane.querySelectorAll('mark.rp-hl-preview').forEach((m) => {
      const parent = m.parentNode;
      if (!parent) return;
      while (m.firstChild) parent.insertBefore(m.firstChild, m);
      parent.removeChild(m);
      parent.normalize();
    });
  }

  function renderSelectionPreview(slices) {
    clearSelectionPreview();
    const pane = document.getElementById('rp-passage-content');
    if (!pane || !Array.isArray(slices) || !slices.length) return;
    for (const sl of slices) {
      const blk = pane.querySelector(`.ins-para-block[data-para-idx="${sl.paraIdx}"]`);
      const textRoot = blk?.querySelector('.rp-para-text');
      if (!textRoot) continue;
      const walker = document.createTreeWalker(textRoot, NodeFilter.SHOW_TEXT, null);
      const textNodes = [];
      let cursor = 0;
      let node;
      while ((node = walker.nextNode())) {
        const len = node.nodeValue ? node.nodeValue.length : 0;
        if (len > 0) {
          textNodes.push({ node, start: cursor, end: cursor + len });
          cursor += len;
        }
      }
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

    // Review Summary Strip (ONLY visible AFTER 100% mastery unlocks Solution & Dictionary!)
    const firstTry = s.firstAttemptResult || s.reviewResult;
    const reviewStripHtml = isReview && s.reviewResult ? `
      <div class="ins-review-strip">
        <div class="rp-rev-metric is-band">
          <span>Band lần đầu</span>
          <strong class="tabular">${(firstTry?.band ?? s.reviewResult.band).toFixed(1)}</strong>
        </div>
        <div class="rp-rev-metric">
          <span>Lần đầu</span>
          <strong class="tabular">${firstTry?.score ?? s.reviewResult.score} / ${s.reviewResult.total}</strong>
        </div>
        <div class="rp-rev-metric">
          <span>Hoàn thành 100%</span>
          <strong class="tabular">${Math.max(1, s.attemptCount || 1)} lần nộp · ${formatDuration(s.reviewResult.elapsedSec)}</strong>
        </div>
        <div class="rp-rev-types">
          <span class="rp-type-chip is-unlocked">✓ Solution &amp; Từ điển đã mở khóa</span>
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

    // Retry Mastery Gate Banner (shown after submitting with wrong answers — NO answer key revealed!)
    const retryBannerHtml = isRetryPhase ? `
      <div class="rp-retry-banner" id="rp-retry-banner" role="status">
        <div class="rp-retry-copy">
          <span class="rp-retry-pill tabular">Lần nộp #${s.attemptCount}</span>
          <span>Đã đúng <strong>${lockedCount}/${allQ.length}</strong> câu · Còn <strong>${wrongCount} câu chưa đúng</strong> — hãy làm lại các câu báo đỏ cho tới khi đúng 100% để mở khóa Solution &amp; Từ điển.</span>
        </div>
        <button type="button" class="rp-retry-jump-btn" onclick="ReadingPracticeApp.jumpToNextWrong()">Câu sai tiếp theo →</button>
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

    // Subtle editorial eyebrow inside the left Washi sheet in Practice mode (0 extra toolbar height!)
    const practicePassageEyebrowHtml = isPractice ? `
      <div class="prac-sheet-eyebrow">
        <span class="prac-eyebrow-meta">${esc(partLabel)} · Questions ${qMin}–${qMax}</span>
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

    // Anchored Totoro "Giao diện" Popover for Practice; Official Inspera Options Overlay for Exam
    const practiceAppearancePopHtml = isPractice ? `
      <div class="prac-pop-wrap" onclick="event.stopPropagation()">
        <button type="button" class="prac-hdr-btn ${s.optionsOpen ? 'active' : ''}" id="ins-btn-options"
          onclick="ReadingPracticeApp.toggleOptionsOverlay()" title="Tùy chỉnh nền giấy &amp; cỡ chữ" aria-label="Giao diện">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.6.85.997 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Giao diện</span>
        </button>
        <div class="prac-popover ${s.optionsOpen ? 'open' : ''}" id="ins-options-overlay" role="dialog" aria-label="Tùy chỉnh hiển thị">
          <div id="prac-opt-contrast-card">
            <div class="prac-pop-lbl">Nền giấy đọc bài</div>
            <div class="prac-pop-seg" style="margin-bottom:12px;">
              <button type="button" class="prac-seg-btn ${s.contrast === 'totoro' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('totoro')">Washi ấm</button>
              <button type="button" class="prac-seg-btn ${s.contrast === 'cd' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('cd')">Trắng sáng</button>
              <button type="button" class="prac-seg-btn ${s.contrast === 'sepia' ? 'active' : ''}" onclick="ReadingPracticeApp.setContrast('sepia')">Giấy kem</button>
            </div>
          </div>
          <div class="prac-pop-lbl">Cỡ chữ bài đọc</div>
          <div class="prac-pop-seg">
            <button type="button" class="prac-seg-btn ${s.textSize === 'regular' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('regular')">Vừa</button>
            <button type="button" class="prac-seg-btn ${s.textSize === 'large' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('large')">Lớn</button>
            <button type="button" class="prac-seg-btn ${s.textSize === 'xlarge' ? 'active' : ''}" onclick="ReadingPracticeApp.setTextSize('xlarge')">Rất lớn</button>
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
      : `<div class="ins-hdr-review-lbl">Review Mode · Paraphrase &amp; Dictionary Unlocked</div>`;

    const practiceProgPillHtml = (isPractice && !isReview) ? `
      <div class="prac-prog-pill tabular" title="Tiến độ trả lời bài hiện tại">
        <span><strong>${totalAnswered}</strong>/${allQ.length} câu</span>
        <span class="prac-prog-track" aria-hidden="true"><span class="prac-prog-fill" style="width:${progressPct}%;"></span></span>
      </div>
    ` : '';

    // Anti-Cheat Shield Status Pill (active in BOTH Practice & Exam until 100% completion!)
    const antiCheatPillHtml = (!isReview && !s.isNews) ? `
      <span class="rp-ac-shield ${s.antiCheatStrikes > 0 ? 'is-warn' : ''}" id="rp-ac-shield"
        title="Chống gian lận đang bật: khóa sao chép, khóa từ điển và cảnh báo chuyển tab (tối đa 2 lần)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>${s.antiCheatStrikes > 0 ? `Cảnh báo ${s.antiCheatStrikes}/2` : 'Anti-Cheat'}</span>
      </span>
    ` : '';

    // Subtle Totoro stationery watermark SVG for Practice Reading Folio
    const practiceStampSvg = isPractice ? `
      <svg class="prac-folio-stamp" viewBox="0 0 80 80" fill="none" aria-hidden="true">
        <circle cx="40" cy="40" r="35" stroke="currentColor" stroke-width="1.6" stroke-dasharray="4 4"/>
        <path d="M27 32L23.5 18L32.5 26C36.8 24.5 43.2 24.5 47.5 26L56.5 18L53 32C58.5 36.2 61.5 43 61.5 50.5C61.5 60.5 52.5 66 40 66C27.5 66 18.5 60.5 18.5 50.5C18.5 43 21.5 36.2 27 32Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
        <path d="M40 19.5C43.5 15.2 48.5 14.8 51.5 17.5C48 20.5 43.5 21.2 40 19.5Z" fill="currentColor" fill-opacity="0.18" stroke="currentColor" stroke-width="1.6"/>
        <circle cx="32" cy="39" r="2.2" fill="currentColor"/><circle cx="48" cy="39" r="2.2" fill="currentColor"/>
        <path d="M29.5 52L33 48.8L36.5 52M37.5 51L40 48.2L42.5 51M43.5 52L47 48.8L50.5 52" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    ` : '';

    const practiceTitleRuleSvg = isPractice ? `
      <svg class="prac-title-rule" viewBox="0 0 180 10" fill="none" aria-hidden="true">
        <path d="M2 7.2C42 2.4 114 1.6 178 6.4" stroke="currentColor" stroke-width="2.1" stroke-linecap="round"/>
      </svg>
    ` : '';

    // Selection Popover: Practice shows 5 silky pastel dots + Ghi chú + Xóa (Tra từ STRICTLY unlocked only in Review/News!)
    const selPopoverHtml = isPractice ? `
      <div class="ins-sel-popover is-practice hidden" id="rp-hl-toolbar" role="toolbar" aria-label="Highlight màu pastel" onmousedown="event.stopPropagation()">
        <div class="prac-pop-swatches">
          ${PASTEL_PENS.map((pen) => `
            <button type="button"
              class="prac-pop-dot ${s.activePenColor === pen.id ? 'is-active' : ''}"
              style="--swatch:${pen.swatch};"
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
        ${enableDict ? '<button type="button" class="ins-sel-dict prac-pop-dict" onclick="ReadingPracticeApp.lookupSelectedPhrase()">Tra từ</button>' : ''}
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
        ${enableDict ? '<button type="button" class="ins-sel-dict" onclick="ReadingPracticeApp.lookupSelectedPhrase()">Tra từ</button>' : ''}
      </div>
    `;

    root.innerHTML = `
      <div class="rp-workspace ins-shell ${modeCls} ${contrastCls} ${sizeCls}" id="rp-workspace" data-study-mode="${esc(s.studyMode)}" data-passage-id="${esc(curPassage.id)}"
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
              ${s.isNews && !isReview ? `
                <button type="button" class="ins-hdr-pill ${s.showBilingual ? 'active' : ''}" id="rp-btn-bilingual" onclick="ReadingPracticeApp.toggleBilingual()">
                  ${s.showBilingual ? '✓ Song ngữ' : 'Song ngữ'}
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
            <div class="${isPractice ? 'prac-sheet-shell ink-brackets ' : 'ins-pane-wrap '}${state.mobilePane === 'passage' ? 'mob-active' : ''}"
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

            <div class="${isPractice ? 'prac-sheet-shell ink-brackets prac-sheet-right ' : 'ins-pane-wrap ins-pane-wrap-right '}${state.mobilePane === 'questions' ? 'mob-active' : ''}">
              <section class="ins-pane ins-pane-right ${state.mobilePane === 'questions' ? 'mob-active' : ''}" id="rp-questions-pane">
                <div class="ins-questions-inner">
                  ${groupsHtml}
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

          <!-- Fixed Bottom Navigator Bar -->
          <footer class="ins-footer">
            <div class="ins-footer-parts">${bottomPartsHtml}</div>
            ${!isReview ? (isPractice ? `
              <button type="button" class="ins-submit-check-btn prac-submit-pill" id="rp-btn-open-submit"
                onclick="ReadingPracticeApp.openPreSubmitModal()" title="${isRetryPhase ? 'Nộp lại các câu đã sửa' : 'Nộp bài kiểm tra kết quả'}" aria-label="Nộp bài">
                <span>${isRetryPhase ? `Nộp lại (${wrongCount} câu) →` : 'Nộp bài →'}</span>
              </button>
            ` : `
              <button type="button" class="ins-submit-check-btn" id="rp-btn-open-submit"
                onclick="ReadingPracticeApp.openPreSubmitModal()" title="${isRetryPhase ? `Nộp lại (${wrongCount} câu sai)` : 'Review &amp; Submit your answers'}" aria-label="Review and Submit">✓</button>
            `) : `
              <button type="button" class="ins-submit-check-btn is-done" onclick="ReadingPracticeApp.exitToHub()" title="Quay về kho đề">←</button>
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

  /* ---------- FLAT INSPERA / PRACTICE PRO QUESTION GROUP & ITEM RENDERER ---------- */
  function formatGroupInstructionHtml(inst) {
    if (!inst) return '';
    return esc(String(inst).trim())
      .replace(/\b(NO MORE THAN (?:ONE|TWO|THREE|FOUR) WORDS?(?: AND\/OR A NUMBER)?|ONE WORD AND\/OR A NUMBER|ONE WORD ONLY|TWO WORDS ONLY|THREE WORDS ONLY|ONE NUMBER ONLY|TRUE|FALSE|NOT GIVEN|YES|NO)\b/g, '<strong>$1</strong>')
      .replace(/\n+/g, '<br>');
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

  function renderNoteCompletionGroup(group, passage, isReview, frameKind) {
    const s = state.session;
    const isPractice = s?.studyMode === 'practice';
    const qs = group.questions || [];
    const frameTitle = group.noteTitle || passage?.title || '';

    const rowsHtml = qs.map((q) => {
      const qid = `${passage.id}__q${q.num}`;
      const userVal = String(s.answers[qid] ?? '');
      const flagged = !!s.flagged[qid];
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
      const inlineBlankHtml = `<span class="ins-note-blank-wrap"><span class="ins-note-qnum ${badgeStateCls}">${q.num}</span><input type="text" class="ins-gap-input ins-note-input ${gapCls}" value="${esc(userVal)}" ${isReadOnly ? 'readonly' : ''} aria-label="Question ${q.num}" onfocus="ReadingPracticeApp.focusQuestion('${esc(qid)}')" oninput="ReadingPracticeApp.setAnswer('${esc(qid)}', this.value, true)" autocomplete="off"></span>`;

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
          ${isReview ? renderReviewBlock(q, ok, correctDisplay) : ''}
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
        ${group.instruction ? `<p class="ins-group-inst">${formatGroupInstructionHtml(group.instruction)}</p>` : ''}
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
        return renderReviewBlock(q, ok, keyObj ? `${keyObj.key}. ${keyObj.text}` : q.answer);
      }).join('') : '';

      return `
        <div class="ins-q-group">
          <h3 class="ins-group-title">${esc(group.title)}</h3>
          ${group.instruction ? `<p class="ins-group-inst">${formatGroupInstructionHtml(group.instruction)}</p>` : ''}
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
        ${group.instruction ? `<p class="ins-group-inst">${formatGroupInstructionHtml(group.instruction)}</p>` : ''}
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

    const correctDisplay = Array.isArray(q.answer) ? q.answer.join(' / ') : q.answer;
    return `
      <div class="ins-q-item ${cardStateCls}" id="rp-qcard-${esc(qid)}" onclick="ReadingPracticeApp.focusQuestion('${esc(qid)}')">
        <div class="ins-q-stem-row">
          <span class="ins-q-num ${isCur && !isReview ? 'is-active' : ''}">${q.num}</span>
          <div class="ins-q-stem">${esc(q.prompt)}</div>
          <div class="prac-q-inline-acts">${retryStatusPill}${bookmarkBtn}</div>
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
        passageIds: [p.id], openInReview: !!opts.openInReview
      });
    },

    startFullTest(fullId, opts = {}) {
      const ft = (DATA().FULL_TESTS || []).find((x) => x.id === fullId);
      if (!ft) return;
      startSession({
        itemId: ft.id, title: ft.title, source: ft.source, isFull: true,
        studyMode: opts.studyMode || 'exam',
        suggestedMins: ft.suggestedMins || 60, deckDefaultName: ft.deckDefaultName || ft.title,
        passageIds: ft.passageIds.slice(), openInReview: !!opts.openInReview
      });
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
      ReadingPracticeStore.clearInProgress();
      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();
    },

    openExitConfirmModal() {
      if (!state.session) return;
      const modal = document.getElementById('rp-presubmit-modal');
      const body = document.getElementById('rp-presubmit-body');
      if (!modal || !body) return;
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
            Rời khỏi lúc này sẽ <strong>kết thúc lượt làm và chấm điểm ngay</strong> theo các câu bạn đã điền.
          </p>
        </div>
        <div class="rp-ps-foot rp-exit-foot">
          <button type="button" class="rp-btn-exit-confirm" id="rp-btn-confirm-exit-grade" onclick="ReadingPracticeApp.confirmFinishAndExit()">Kết thúc &amp; Chấm điểm</button>
          <button type="button" class="btn btn-primary rp-btn-stay" onclick="ReadingPracticeApp.closePreSubmitModal()">Ở lại làm tiếp</button>
        </div>
      `;
      modal.classList.add('open');
    },

    confirmFinishAndExit() {
      if (!state.session) return;
      const s = state.session;
      this.closePreSubmitModal();
      const res = computeReviewResult();
      const isMastered = res.total > 0 && res.score === res.total;

      stopTimer();
      stopReadingAntiCheat();
      ReadingPracticeStore.clearInProgress();

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

      state.pendingSelection = null;
      document.body.classList.remove('rp-exam-fullscreen');
      state.view = 'source';
      state.session = null;
      renderHub();
      toast(isMastered
        ? `Hoàn tất 100%: ${res.score}/${res.total} câu đúng — Đã mở khóa Solution!`
        : `Đã kết thúc & chấm điểm: ${res.score}/${res.total} câu đúng (cần đạt 100% để mở Solution).`);
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
      // Do not allow changing already-locked correct answers during Retry phase
      if (state.session.lockedCorrect && state.session.lockedCorrect[qid]) return;
      state.session.answers[qid] = value;
      state.session.activeQid = qid;
      const wasWrong = !!(state.session.wrongSet && state.session.wrongSet[qid]);
      if (wasWrong) state.session.wrongSet[qid] = 'edited';
      persistDraft();
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
      if (!ev || ev.target === modal) modal.classList.remove('open');
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

      // News articles do not gate on 100%; IELTS Practice & Exam BOTH enforce 100% Mastery Gate!
      const mustAchieve100 = !s.isNews && res.score < res.total;
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

        // Record first-attempt score in history (NOT yet mastered — cannot peek Solution!)
        if (s.attemptCount === 1) {
          ReadingPracticeStore.recordAttempt({
            itemId: s.itemId, title: s.title, source: s.source,
            isFull: s.isFull, score: res.score, total: res.total,
            band: res.band, elapsedSec: res.elapsedSec,
            mastered: false, completedAt: Date.now()
          });
        }

        if (firstWrong) {
          s.activePassageIdx = firstWrong._pIdx;
          s.activeQid = firstWrong._qid;
        }
        persistDraft();
        renderExamWorkspace();
        if (firstWrong) {
          setTimeout(() => {
            const el = document.getElementById(`rp-qcard-${firstWrong._qid}`) || document.querySelector(`[data-mh-qid="${firstWrong._qid}"]`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 50);
        }
        const rem = res.total - res.score;
        toast(`Lần nộp #${s.attemptCount}: Đúng ${res.score}/${res.total} · Còn ${rem} câu sai — làm lại đúng 100% để mở khóa Solution & Từ điển!`);
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
        isFull: s.isFull, score: first.score, total: res.total,
        band: first.band, elapsedSec: res.elapsedSec,
        mastered: true, attempts: s.attemptCount, completedAt: Date.now()
      });

      renderExamWorkspace();
      toast(`Xuất sắc! Đúng 100% (${s.attemptCount} lần nộp · Band lần đầu ${first.band.toFixed(1)}) — Solution & Từ điển đã mở khóa!`);
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

    /* ---------- SELECTION & PASTEL HIGHLIGHT POPOVER (Suppresses Edge Mini Menu!) ---------- */
    _positionSelectionPopover(rect) {
      const bar = document.getElementById('rp-hl-toolbar');
      if (!bar || !rect) return;
      const isPrac = state.session?.studyMode === 'practice';
      const estW = isPrac ? 290 : 220;
      const left = Math.max(12, Math.min(window.innerWidth - estW - 12, rect.left + rect.width / 2 - estW / 2));
      const preferTop = rect.top - 52;
      const top = preferTop >= 62 ? preferTop : Math.max(62, rect.bottom + 8);
      bar.style.left = `${left}px`;
      bar.style.top = `${top}px`;
      bar.classList.remove('hidden');
    },

    onPassageMouseDown(ev) {
      if (ev.target && ev.target.closest && ev.target.closest('#rp-hl-toolbar')) return;
      state.pendingSelection = null;
      clearSelectionPreview();
      this.hideHighlightToolbar();
    },

    handlePassageSelection() {
      const s = state.session;
      const sel = window.getSelection();
      const bar = document.getElementById('rp-hl-toolbar');
      if (!s || !bar) return;
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        if (!state.pendingSelection) bar.classList.add('hidden');
        return;
      }
      const range = sel.getRangeAt(0);
      const pane = document.getElementById('rp-passage-content');
      if (!pane || !pane.contains(range.commonAncestorContainer)) {
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
      const context = extractSentenceForNode(parentEl);

      if (!slices.length) {
        bar.classList.add('hidden');
        return;
      }

      // Cache selection & IMMEDIATELY collapse native browser selection so Microsoft Edge's Mini Menu NEVER pops up!
      state.pendingSelection = { passageId: curPassage.id, slices, text, rect, context };
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
        toast('Hãy bôi đen trực tiếp trên đoạn văn để highlight.');
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
      window.getSelection()?.removeAllRanges();
      this.hideHighlightToolbar();
    },

    clearSelectionHighlight() {
      const s = state.session;
      if (!s) return;
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
      window.getSelection()?.removeAllRanges();
      this.hideHighlightToolbar();
    },

    clearAllPassageHighlights() {
      const s = state.session;
      if (!s) return;
      const passages = getSessionPassages();
      const curPassage = passages[s.activePassageIdx] || passages[0];
      if (!curPassage) return;
      if (s.highlights) s.highlights[curPassage.id] = [];
      clearSelectionPreview();
      applyStoredHighlightsToPassage(curPassage.id);
      updatePracticeHighlightBadge(curPassage.id);
      persistDraft();
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
      this.hideHighlightToolbar();
      showDictPopover(text, ctx, rect);
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
