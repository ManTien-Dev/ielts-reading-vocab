/* ==========================================================================
   TOTORO IELTS MASTER — WRITING STUDIO ENGINE
   - Unified Single-Deck Flashcard (Flow -> Vocab -> Paraphrase -> Grammar)
   - Ultra-Strict Recall Check (Exact Typing 30s/40s + 35s Flow Order + Cooldowns)
   - Task Lock Gate (100% Mastery + 4s Old-Review Speed Quiz + 10m Idle Lockout)
   - 3-Test Sequential Exam (Test 1 Domino 60s -> Test 2 Grammar Builder 35s/q -> Test 3 Retry Gate + AI/Key)
   - Real Exam Practice Hub (57 Prompts, Practice & Light-Only Inspera Exam 40m + 2/2 Anti-Cheat)
   - Full Teacher Bypass (giaovien/admin never blocked or locked)
   ========================================================================== */
(function () {
  'use strict';

  const MASTERY_KEY_BASE = 'totoro_writing_mastery_v1_';
  const COOLDOWN_KEY_BASE = 'totoro_writing_cooldown_v1_';
  const TASK_PROG_KEY_BASE = 'totoro_writing_task_prog_v1_';
  const TASK_LOCK_KEY_BASE = 'totoro_writing_task_lock_v1_';
  const SPEED_UNLOCK_KEY_BASE = 'totoro_writing_sq_unlock_v1_';
  const PRAC_HIST_KEY_BASE = 'totoro_writing_prac_hist_v1_';
  const PRAC_LOCK_KEY_BASE = 'totoro_writing_prac_lock_v1_';

  const IDLE_LIMIT_MS = 10 * 60 * 1000;
  const LOCK_PENALTY_MS = 30 * 60 * 1000;
  const T1_TIME_LIMIT_SEC = 60;
  const T2_PER_SENT_SEC = 35;
  const SQ_PER_Q_MS = 4000;

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function DATA() {
    return window.WRITING_STUDIO_DATA || { SUBTOPICS: [], MODULES: [], PARAPHRASES: [], PRACTICE_PROMPTS: [] };
  }
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
    else B()?.showToast?.(msg);
  }
  function getUid() {
    const u = B()?.getScopedUid?.() || B()?.getCurrentUser?.()?.id || 'guest';
    return String(u || 'guest').trim().toLowerCase();
  }
  function isTeacherBypass() {
    try {
      const b = B();
      if (b?.isTeacherMode?.() || b?.isTeacherPreviewing?.()) return true;
      const u = b?.getCurrentUser?.();
      const role = String(u?.role || '').trim().toLowerCase();
      if (role === 'teacher' || role === 'admin') return true;
      const uid = getUid();
      if (uid === 'giaovien' || uid === 'teacher' || uid === 'admin') return true;
    } catch (_) {}
    return false;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function normStr(s) {
    return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }
  function fmtMmSs(totalSec) {
    const s = Math.max(0, Math.floor(totalSec));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  /* ================= STORAGE HELPERS ================= */
  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return fallback;
  }
  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  function getMasteryMap() { return readJson(MASTERY_KEY_BASE + getUid(), {}); }
  function saveMasteryMap(m) { writeJson(MASTERY_KEY_BASE + getUid(), m); }
  function getCooldownMap() { return readJson(COOLDOWN_KEY_BASE + getUid(), {}); }
  function saveCooldownMap(m) { writeJson(COOLDOWN_KEY_BASE + getUid(), m); }
  function getTaskProgMap() { return readJson(TASK_PROG_KEY_BASE + getUid(), {}); }
  function saveTaskProgMap(m) { writeJson(TASK_PROG_KEY_BASE + getUid(), m); }
  function getSpeedUnlockMap() { return readJson(SPEED_UNLOCK_KEY_BASE + getUid(), {}); }
  function saveSpeedUnlockMap(m) { writeJson(SPEED_UNLOCK_KEY_BASE + getUid(), m); }
  function getPracticeHist() { return readJson(PRAC_HIST_KEY_BASE + getUid(), []); }
  function savePracticeHist(arr) { writeJson(PRAC_HIST_KEY_BASE + getUid(), arr.slice(0, 60)); }

  function getLockout(keyBase) {
    if (isTeacherBypass()) {
      try { localStorage.removeItem(keyBase + getUid()); } catch (_) {}
      return null;
    }
    const info = readJson(keyBase + getUid(), null);
    if (!info || !info.until) return null;
    const rem = Number(info.until) - Date.now();
    if (rem > 0) return { ...info, remainingMs: rem };
    try { localStorage.removeItem(keyBase + getUid()); } catch (_) {}
    return null;
  }
  function setLockout(keyBase, reason) {
    if (isTeacherBypass()) return null;
    const payload = { until: Date.now() + LOCK_PENALTY_MS, reason: reason || 'Vi phạm quy chế' };
    writeJson(keyBase + getUid(), payload);
    return payload;
  }

  function getCardCooldownSec(cardId) {
    if (isTeacherBypass()) return 0;
    const map = getCooldownMap();
    const until = Number(map[cardId] || 0);
    const rem = Math.ceil((until - Date.now()) / 1000);
    return rem > 0 ? rem : 0;
  }
  function setCardCooldown(cardId, sec) {
    if (isTeacherBypass()) return;
    const map = getCooldownMap();
    map[cardId] = Date.now() + sec * 1000;
    saveCooldownMap(map);
  }

  /* ================= UNIFIED DECK BUILDER (1 DECK PER MODULE) ================= */
  function buildModuleCards(mod) {
    if (!mod) return [];
    const cards = [];
    // 1. Idea Flow card first
    cards.push({
      id: `${mod.id}_flow`,
      modId: mod.id,
      kind: 'flow',
      pos: 'IDEA FLOW',
      lesson: `${mod.code} · ${mod.title}`,
      en: mod.title,
      vi: mod.viFlowSteps.join(' ➔ '),
      steps: mod.viFlowSteps
    });
    // 2. Vocab cards
    (mod.vocab || []).forEach((v, i) => {
      cards.push({
        id: `${mod.id}_v${i + 1}`,
        modId: mod.id,
        kind: 'vocab',
        pos: String(v.pos || 'phr').toUpperCase(),
        lesson: `${mod.code} · ${mod.title}`,
        en: v.en,
        vi: v.vi,
        example: v.example || ''
      });
    });
    // 3. Paraphrase cards (if any)
    (mod.paraphrases || []).forEach((p, i) => {
      cards.push({
        id: `${mod.id}_p${i + 1}`,
        modId: mod.id,
        kind: 'paraphrase',
        pos: 'PARAPHRASE',
        lesson: `${mod.code} · ${mod.title}`,
        en: p.en,
        vi: p.vi,
        items: p.items || [],
        accepted: p.accepted || []
      });
    });
    // 4. Grammar cards
    (mod.grammar || []).forEach((g, i) => {
      cards.push({
        id: `${mod.id}_g${i + 1}`,
        modId: mod.id,
        kind: 'grammar',
        pos: 'GRAMMAR',
        lesson: `${mod.code} · ${mod.title}`,
        en: g.formula,
        vi: g.meaning,
        example: g.example || ''
      });
    });
    return cards;
  }

  function getModById(id) {
    return (DATA().MODULES || []).find((m) => m.id === id) || null;
  }

  function getModMasteryStats(mod) {
    const cards = buildModuleCards(mod);
    const mmap = getMasteryMap();
    const done = cards.filter((c) => mmap[c.id]?.level === 3).length;
    return { done, total: cards.length, pct: Math.round((done / Math.max(1, cards.length)) * 100) };
  }

  /* ================= STATE ================= */
  const state = {
    selectedModId: null,
    unmasteredOnly: false,
    cardIdx: 0,
    flipped: false,
    activeTaskModId: null, // When studying inside an assigned/opened Task
    taskHubSubtopic: 'st01',
    pracSubtopic: 'all',
    pracType: 'all',
    pracQuery: '',
    cooldownTicker: null,
    idleTicker: null,
    lastActivityAt: Date.now()
  };

  let recallState = null;
  let sqState = null;
  let examState = null;
  let pracState = null;
  let overlaysMounted = false;

  /* ================= AUDIO (YOUDAO US FRONT / UK BACK) ================= */
  function speakText(text, accent) {
    if (!text) return;
    if (window.AppCore?.audio?.speak) {
      window.AppCore.audio.speak(text, { accent: accent || 'en-US', engine: 'youdao', rate: 0.94 });
      return;
    }
    if (B()?.speakText) {
      B().speakText(text, accent || 'en-US', { engine: 'youdao' });
      return;
    }
    const type = accent === 'en-GB' ? 1 : 2;
    try {
      const a = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=${type}`);
      a.play().catch(() => {});
    } catch (_) {}
  }

  function highlightInExample(sentence, target) {
    if (!sentence) return '';
    const safe = esc(sentence);
    if (!target || target.length < 3) return safe;
    const escTarget = esc(target).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return safe.replace(new RegExp(`(${escTarget})`, 'i'), '<mark class="fc-target-mark">$1</mark>');
  }

  /* ================= MOUNT MODALS ONCE ================= */
  function ensureOverlays() {
    if (overlaysMounted) return;
    overlaysMounted = true;
    const wrap = document.createElement('div');
    wrap.id = 'ws-overlays-root';
    wrap.innerHTML = `
      <div class="ws-modal-overlay" id="ws-recall-modal">
        <div class="ws-modal-card" id="ws-recall-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="ws-modal-overlay" id="ws-sq-modal">
        <div class="ws-modal-card" id="ws-sq-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="ws-modal-overlay" id="ws-task-exam-modal">
        <div class="ws-modal-card is-wide" id="ws-task-exam-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="ws-modal-overlay" id="ws-ac-modal">
        <div class="ws-modal-card" id="ws-ac-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="ws-exam-room" id="ws-practice-room"></div>
    `;
    document.body.appendChild(wrap);

    // Track activity for 10-min task idle monitor
    ['pointerdown', 'keydown', 'input'].forEach((ev) => {
      window.addEventListener(ev, () => { state.lastActivityAt = Date.now(); }, { passive: true });
    });

    // Global anti-cheat listener for Writing Recall, Task 3-Test & Practice Exam
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) handleGlobalAntiCheatLeave('Chuyển tab trình duyệt');
    });

    // Keyboard shortcuts on Writing Flashcard
    document.addEventListener('keydown', (e) => {
      if (document.documentElement.getAttribute('data-skill') !== 'writing') return;
      if (recallState || sqState || examState || pracState) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const root = document.getElementById('writing-flashcard-root');
      if (!root || root.offsetParent === null) return;
      if (e.code === 'Space') { e.preventDefault(); flipCard(); }
      else if (e.key === 'ArrowRight') stepCard(1);
      else if (e.key === 'ArrowLeft') stepCard(-1);
      else if (e.key === 'r' || e.key === 'R') speakCurrent(state.flipped ? 'en-GB' : 'en-US');
      else if (e.key === 'Escape') closeModDropdown();
      else if (state.flipped && e.key === '1') assessCard(1);
      else if (state.flipped && e.key === '2') assessCard(2);
      else if (state.flipped && e.key === '3') assessCard(3);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#ws-scope-wrap')) closeModDropdown();
    });
  }

  /* ================= FLASHCARD WORKSPACE (UNIFIED SINGLE DECK) ================= */
  function getActiveMod() {
    const mods = DATA().MODULES || [];
    if (!mods.length) return null;
    if (state.activeTaskModId) {
      const tm = getModById(state.activeTaskModId);
      if (tm) return tm;
    }
    if (!state.selectedModId || !getModById(state.selectedModId)) {
      state.selectedModId = mods[0].id;
    }
    return getModById(state.selectedModId);
  }

  function getVisibleCards(mod) {
    const base = buildModuleCards(mod);
    let list = state.shuffledOrder && state.shuffledModId === mod.id
      ? state.shuffledOrder.map((id) => base.find((c) => c.id === id)).filter(Boolean)
      : base;
    if (list.length !== base.length) list = base;
    if (!state.unmasteredOnly) return list;
    const mmap = getMasteryMap();
    const unm = list.filter((c) => mmap[c.id]?.level !== 3);
    return unm.length ? unm : list;
  }

  function closeModDropdown() {
    const w = document.getElementById('ws-scope-wrap');
    if (w) w.classList.remove('is-open');
  }
  function toggleModDropdown(e) {
    if (e) e.stopPropagation();
    const w = document.getElementById('ws-scope-wrap');
    if (w) w.classList.toggle('is-open');
  }
  function shuffleDeck() {
    const mod = getActiveMod();
    if (!mod) return;
    const base = buildModuleCards(mod);
    const flow = base.filter((c) => c.kind === 'flow');
    const rest = shuffle(base.filter((c) => c.kind !== 'flow'));
    state.shuffledModId = mod.id;
    state.shuffledOrder = [...flow, ...rest].map((c) => c.id);
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
    toast('Đã trộn ngẫu nhiên thứ tự thẻ trong bài!');
  }

  function openCardListModal() {
    ensureOverlays();
    const mod = getActiveMod();
    if (!mod) return;
    const cards = buildModuleCards(mod);
    const mmap = getMasteryMap();
    const cardEl = document.getElementById('ws-ac-card');
    cardEl.innerHTML = `
      <div class="ws-modal-head">
        <div class="ws-modal-title">${esc(mod.code)} · ${esc(mod.title)}</div>
        <button type="button" class="btn" style="padding:6px 12px;" onclick="WritingStudio.closeAcModal()">Đóng</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:58vh;overflow-y:auto;padding-right:4px;">
        ${cards.map((c, idx) => {
          const lv = mmap[c.id]?.level || 0;
          const badge = c.kind === 'flow' ? 'FLOW' : (c.kind === 'grammar' ? 'GRAM' : (c.kind === 'paraphrase' ? 'PARA' : 'VOCAB'));
          const status = lv === 3 ? '<span class="ws-pill ok">Đã thuộc</span>' : (lv === 2 ? '<span class="ws-pill">Nhớ chậm</span>' : '<span style="font-size:11.5px;color:var(--ink-3);">Chưa thuộc</span>');
          return `
            <button type="button" class="ws-mini-row" style="padding:9px 11px;font-size:12.5px;" onclick="WritingStudio.closeAcModal(); WritingStudio.jumpCard(${idx});">
              <span class="ws-kind-badge ${c.kind === 'flow' ? 'is-flow' : (c.kind === 'grammar' ? 'is-gram' : (c.kind === 'paraphrase' ? 'is-para' : ''))}">${badge}</span>
              <span style="flex:1;min-width:0;text-align:left;">
                <strong style="display:block;color:var(--ink);">${esc(c.en)}</strong>
                <span style="font-size:11.5px;color:var(--ink-2);">${esc(c.vi)}</span>
              </span>
              ${status}
            </button>
          `;
        }).join('')}
      </div>
    `;
    document.getElementById('ws-ac-modal').classList.add('open');
  }

  function syncLiveWidgets() {
    if (document.documentElement.getAttribute('data-skill') !== 'writing') return;
    const copyTxt = (srcId, dstId) => {
      const s = document.getElementById(srcId);
      const d = document.getElementById(dstId);
      if (s && d && d.textContent !== s.textContent) d.textContent = s.textContent;
    };
    copyTxt('timer-digits', 'ws-timer-digits');
    copyTxt('timer-status-text', 'ws-timer-status-text');
    copyTxt('timer-play-text', 'ws-timer-play-text');
    copyTxt('timer-today-total', 'ws-timer-today-total');
    copyTxt('study-idle-clock-val', 'ws-idle-clock-val');

    const srcArc = document.getElementById('chrono-arc');
    const dstArc = document.getElementById('ws-chrono-arc');
    if (srcArc && dstArc) {
      const off = srcArc.style.strokeDashoffset || srcArc.getAttribute('stroke-dashoffset') || '351.86';
      dstArc.style.strokeDashoffset = off;
    }
    const srcIdleBar = document.getElementById('study-idle-clock-bar');
    const dstIdleBar = document.getElementById('ws-idle-clock-bar');
    if (srcIdleBar && dstIdleBar) dstIdleBar.style.width = srcIdleBar.style.width || '0%';

    const upSrc = document.getElementById('timer-mode-up');
    const dnSrc = document.getElementById('timer-mode-down');
    document.getElementById('ws-timer-mode-up')?.classList.toggle('active', Boolean(upSrc?.classList.contains('active')));
    document.getElementById('ws-timer-mode-down')?.classList.toggle('active', Boolean(dnSrc?.classList.contains('active')));
  }

  function renderFlashcardWorkspace() {
    ensureOverlays();
    const root = document.getElementById('writing-flashcard-root');
    if (!root) return;
    const mod = getActiveMod();
    if (!mod) {
      root.innerHTML = '<div style="padding:24px;text-align:center;color:var(--ink-2);">Chưa có dữ liệu Writing.</div>';
      return;
    }

    const allModCards = buildModuleCards(mod);
    const cards = getVisibleCards(mod);
    if (state.cardIdx >= cards.length) state.cardIdx = 0;
    if (state.cardIdx < 0) state.cardIdx = cards.length - 1;
    const card = cards[state.cardIdx];
    const mmap = getMasteryMap();
    const mStats = getModMasteryStats(mod);
    const slowCnt = allModCards.filter((c) => mmap[c.id]?.level === 2).length;
    const unlearnedCnt = Math.max(0, mStats.total - mStats.done - slowCnt);
    const dueCnt = allModCards.filter((c) => mmap[c.id]?.level === 3 && mmap[c.id]?.nextDue && Date.now() >= mmap[c.id].nextDue).length;
    const okPct = Math.round((mStats.done / Math.max(1, mStats.total)) * 100);
    const slowPct = Math.round((slowCnt / Math.max(1, mStats.total)) * 100);
    const unlPct = Math.max(0, 100 - okPct - slowPct);
    const donutCirc = 194.8;
    const okDashOff = (donutCirc * (1 - okPct / 100)).toFixed(2);
    const warmDashOff = (donutCirc * (1 - Math.min(100, okPct + slowPct) / 100)).toFixed(2);

    const cdSec = getCardCooldownSec(card.id);
    const stLevel = mmap[card.id]?.level || 0;
    const isTaskMode = Boolean(state.activeTaskModId);
    const canStartTest = isTeacherBypass() || mStats.done >= mStats.total;
    const idleElapsedSec = Math.floor((Date.now() - state.lastActivityAt) / 1000);

    const taskBannerHtml = isTaskMode ? `
      <div class="ws-task-banner">
        <div class="ws-task-banner-info">
          <span class="ws-pill">TASK</span>
          <span>${esc(mod.code)} · ${esc(mod.title)}</span>
          <span class="ws-pill ${canStartTest ? 'ok' : ''}">Đã thuộc ${mStats.done} / ${mStats.total}</span>
          ${!isTeacherBypass() ? `<span class="ws-pill" id="ws-idle-clock">${fmtMmSs(idleElapsedSec)} / 10:00</span>` : ''}
        </div>
        <div class="ws-task-banner-actions">
          <button type="button" class="btn btn-primary" style="padding:7px 16px;font-size:13px;" ${canStartTest ? '' : 'disabled'} onclick="WritingStudio.startTaskExam('${esc(mod.id)}')">
            ${canStartTest ? 'Vào Test →' : `Thuộc đủ ${mStats.total}/${mStats.total} để mở Test`}
          </button>
          <button type="button" class="btn" style="padding:7px 13px;font-size:13px;" onclick="WritingStudio.exitTaskStudyMode()">Thoát</button>
        </div>
      </div>
    ` : '';

    // Custom Totoro Scope Dropdown (matches Reading 1-to-1)
    const modMenuHtml = (DATA().SUBTOPICS || []).map((st) => {
      const stMods = (DATA().MODULES || []).filter((m) => m.subtopic === st.key);
      return `
        <div class="tot-scope-group-lbl">${esc(st.title)}</div>
        ${stMods.map((m) => {
          const active = m.id === mod.id;
          return `
            <button type="button" class="tot-scope-item ${active ? 'is-active' : ''}" role="option" aria-selected="${active ? 'true' : 'false'}" onclick="WritingStudio.selectModule('${esc(m.id)}')">
              <span class="tot-scope-item-txt">${esc(m.code)} · ${esc(m.title)}</span>
              ${active ? '<svg class="tot-scope-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
          `;
        }).join('')}
      `;
    }).join('');

    // Adaptive word sizing inside Reading's .fc-word
    const wc = String(card.en || '').split(/\s+/).length;
    let wordSizeCls = 'ws-word-sm';
    if (card.kind === 'grammar') wordSizeCls = 'ws-word-formula';
    else if (wc >= 6) wordSizeCls = 'ws-word-lg';
    else if (wc >= 3) wordSizeCls = 'ws-word-md';

    const statusCls = stLevel === 3 ? 'mastered' : (stLevel === 2 ? 'slow' : (stLevel === 1 ? 'unremembered' : ''));
    const statusTxt = stLevel === 3 ? 'Đã thuộc' : (stLevel === 2 ? 'Nhớ chậm' : (stLevel === 1 ? 'Chưa nhớ' : ''));
    const showAudio = card.kind === 'vocab' || card.kind === 'paraphrase';
    const metaTag = card.kind === 'flow' ? `${(card.steps || []).length} bước Domino` : (card.kind === 'grammar' ? 'Cấu trúc Band 8.5+' : (card.kind === 'paraphrase' ? 'Paraphrase đề thi' : 'C1–C2 Collocation'));

    // Back body — exact Reading clean hierarchy (Green bold Meaning + Warm dashed Example box, ZERO extra clutter!)
    let backBodyHtml = '';
    if (card.kind === 'flow') {
      backBodyHtml = `
        <div class="ws-flow-list">
          ${(card.steps || []).map((s, idx) => `<div class="ws-flow-step"><span class="ws-flow-num">${idx + 1}</span><span>${esc(s)}</span></div>`).join('')}
        </div>
      `;
    } else if (card.kind === 'paraphrase') {
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        <div class="fc-sentence-box">
          <div class="ws-para-list">
            ${(card.items || []).map((it) => `<div class="ws-para-item"><strong>${esc(it.en)}</strong> — ${esc(it.vi)}</div>`).join('')}
          </div>
        </div>
      `;
    } else {
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        ${card.example ? `<div class="fc-sentence-box">${highlightInExample(card.example, card.kind === 'vocab' ? card.en : '')}</div>` : ''}
      `;
    }

    const kindBadge = (k) => k === 'flow'
      ? '<span class="ws-kind-badge is-flow">Flow</span>'
      : k === 'grammar'
        ? '<span class="ws-kind-badge is-gram">Gram</span>'
        : k === 'paraphrase'
          ? '<span class="ws-kind-badge is-para">Para</span>'
          : '<span class="ws-kind-badge">Vocab</span>';

    const miniListHtml = cards.map((c, idx) => {
      const lv = mmap[c.id]?.level || 0;
      return `
        <button type="button" class="ws-mini-row ${idx === state.cardIdx ? 'active' : ''}" onclick="WritingStudio.jumpCard(${idx})">
          ${kindBadge(c.kind)}
          <span class="ws-mini-txt">${esc(c.en)}</span>
          <span class="ws-mini-dot ${lv === 3 ? 'ok' : (lv === 2 ? 'warn' : '')}"></span>
        </button>
      `;
    }).join('');

    const pctCard = Math.round(((state.cardIdx + 1) / Math.max(1, cards.length)) * 100);
    const curTimerDigits = document.getElementById('timer-digits')?.textContent || '00:00';
    const curTimerStatus = document.getElementById('timer-status-text')?.textContent || 'Đang học';
    const curTimerPlay = document.getElementById('timer-play-text')?.textContent || 'Tạm dừng';
    const curTimerToday = document.getElementById('timer-today-total')?.textContent || '0 phút';
    const curIdleVal = document.getElementById('study-idle-clock-val')?.textContent || '00:00';
    const isFocusActive = document.body.classList.contains('focus-mode');

    root.innerHTML = `
      ${taskBannerHtml}

      <!-- 1. TOP BAR — 100% Reading Totoro Editorial Parity -->
      <div class="study-top-bar">
        <div class="study-bar-left">
          <div class="scope-select-wrap has-custom-scope" id="ws-scope-wrap">
            <button type="button" class="tot-scope-trigger" id="ws-scope-trigger" aria-haspopup="listbox" onclick="WritingStudio.toggleModDropdown(event)" ${isTaskMode ? 'disabled' : ''}>
              <span class="tot-scope-trigger-label">${esc(mod.code)} · ${esc(mod.title)}</span>
              <svg class="tot-scope-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="tot-scope-menu ws-mod-dropdown-menu" role="listbox" aria-label="Chọn bài học Writing">${modMenuHtml}</div>
          </div>

          <div class="tot-idle-clock-pill" id="ws-idle-clock-pill" role="status" aria-live="off" title="Thời gian không thao tác">
            <span class="tot-idle-left">
              <span class="tot-idle-dot" aria-hidden="true"></span>
              <svg class="tot-ico-sm tot-idle-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
              <span class="tot-idle-lbl">Không thao tác</span>
            </span>
            <span class="tot-idle-readout tabular">
              <strong id="ws-idle-clock-val">${esc(curIdleVal)}</strong>
              <span class="tot-idle-limit">/ 10:00</span>
            </span>
            <span class="tot-idle-progress-track" aria-hidden="true"><span class="tot-idle-progress-fill" id="ws-idle-clock-bar"></span></span>
          </div>
        </div>

        <div class="study-top-actions">
          <button type="button" class="btn-deck-tool tot-tool-quiet" onclick="WritingStudio.openCardListModal()" title="Xem toàn bộ danh sách thẻ trong bài">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round"/></svg>
            <span>Từ vựng</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet ${state.unmasteredOnly ? 'active' : ''}" onclick="WritingStudio.toggleUnmastered()" title="Chỉ xem các thẻ chưa thuộc">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <span>Chưa thuộc</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet" onclick="WritingStudio.shuffleDeck()" title="Trộn ngẫu nhiên thứ tự thẻ">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><polyline points="16 3 21 3 21 8"/><line x1="4" x2="21" y1="20" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" x2="21" y1="15" y2="21"/></svg>
            <span>Trộn</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet btn-focus-toggle ${isFocusActive ? 'active' : ''}" onclick="typeof toggleFocusMode === 'function' && toggleFocusMode()" title="Thu gọn 2 cột bên để tập trung học Flashcard">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            <span>Tập trung</span>
          </button>
          <div class="study-progress-wrap">
            <span class="study-progress tabular">${state.cardIdx + 1} / ${cards.length}</span>
          </div>
        </div>
      </div>

      <!-- 2. 3-COLUMN READING STUDIO STAGE -->
      <div class="study-stage-row">
        <!-- LEFT DECK: Seiko x Ghibli Focus Chronograph + Task 3-Step CTA -->
        <aside class="study-deck study-deck-left" aria-label="Đồng hồ tập trung và Task bài học">
          <div class="deck-widget widget-theme-mint ink-brackets" id="ws-widget-timer">
            <svg class="totoro-peeker" viewBox="0 0 88 50" fill="none" aria-hidden="true">
              <path class="ear-l" d="M24 22L16 5C15.4 3.6 17.2 2.6 18.2 3.8L30 16Z" fill="#595753"/>
              <path class="ear-r" d="M64 22L72 5C72.6 3.6 70.8 2.6 69.8 3.8L58 16Z" fill="#595753"/>
              <path d="M12 46C12 27 24 14 44 14C64 14 76 27 76 46Z" fill="#595753"/>
              <path d="M36 14.5C39 8.5 47 8 52 12.5C47.5 15.5 41 16 36 14.5Z" fill="#4E7A51"/>
              <path d="M44 14V10.5" stroke="#4E7A51" stroke-width="1.6" stroke-linecap="round"/>
              <circle cx="31" cy="28" r="4.6" fill="#FFFFFF"/><circle cx="31.5" cy="28" r="2.2" fill="#181A1F"/><circle cx="30.6" cy="27" r="0.8" fill="#FFFFFF"/>
              <circle cx="57" cy="28" r="4.6" fill="#FFFFFF"/><circle cx="56.5" cy="28" r="2.2" fill="#181A1F"/><circle cx="55.6" cy="27" r="0.8" fill="#FFFFFF"/>
              <ellipse cx="44" cy="29.5" rx="3" ry="1.6" fill="#181A1F"/>
              <path d="M18 32L7 30M18 36L6 37M70 32L81 30M70 36L82 37" stroke="#595753" stroke-width="1.8" stroke-linecap="round"/>
              <ellipse cx="26" cy="45" rx="7" ry="4.2" fill="#595753"/><ellipse cx="62" cy="45" rx="7" ry="4.2" fill="#595753"/>
            </svg>
            <div class="widget-header">
              <span class="tot-icon-tile" aria-hidden="true">
                <svg viewBox="2.5 1 19 21.5" fill="none">
                  <circle cx="12" cy="13.8" r="7.8" fill="#FFFFFF" stroke="var(--accent)" stroke-width="2"/>
                  <circle cx="12" cy="13.8" r="5.6" fill="var(--accent-soft)"/>
                  <path d="M12 9.8V13.8L14.8 15.4" stroke="var(--accent)" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"/>
                  <circle cx="12" cy="13.8" r="1.2" fill="var(--streak)"/>
                  <path d="M12 6C13.8 2.8 16.8 2.2 18.8 3.9C16.8 5.8 14.2 6.5 12 6Z" fill="#4E9460" stroke="#2F663D" stroke-width="1.1" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Đồng hồ tập trung</div>
                <div class="widget-subtitle">Phiên mục tiêu 25 phút</div>
              </div>
              <button type="button" class="btn-sound-toggle tot-timer-sound-ico" onclick="typeof toggleTimerSound === 'function' && toggleTimerSound()" title="Bật/Tắt chuông">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              </button>
            </div>
            <div class="timer-mode-pills">
              <button type="button" class="timer-mode-btn active" id="ws-timer-mode-up" onclick="typeof setTimerMode === 'function' && setTimerMode('countup')">Đếm xuôi</button>
              <button type="button" class="timer-mode-btn" id="ws-timer-mode-down" onclick="typeof setTimerMode === 'function' && setTimerMode('countdown')">Pomodoro</button>
            </div>
            <div class="timer-display-box chrono-wrap totoro-chrono-pro">
              <svg class="chrono-svg totoro-chrono-svg" viewBox="0 0 160 160" aria-hidden="true">
                <defs>
                  <linearGradient id="wsBezelMetal" x1="15%" y1="0%" x2="85%" y2="100%">
                    <stop offset="0%" stop-color="#536857"/><stop offset="48%" stop-color="#2D3D31"/><stop offset="100%" stop-color="#1E2A21"/>
                  </linearGradient>
                  <linearGradient id="wsGoldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#E3C48A"/><stop offset="50%" stop-color="#B98D46"/><stop offset="100%" stop-color="#8C672A"/>
                  </linearGradient>
                  <linearGradient id="wsGlassGlint" x1="20%" y1="0%" x2="70%" y2="85%">
                    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32"/><stop offset="45%" stop-color="#FFFFFF" stop-opacity="0.04"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
                  </linearGradient>
                  <radialGradient id="wsDialFaceLight" cx="50%" cy="38%" r="62%">
                    <stop offset="0%" stop-color="#FFFDF8"/><stop offset="76%" stop-color="#F6F1E5"/><stop offset="100%" stop-color="#EAE2D0"/>
                  </radialGradient>
                  <radialGradient id="wsDialFaceDark" cx="50%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#243128"/><stop offset="75%" stop-color="#18221B"/><stop offset="100%" stop-color="#101812"/>
                  </radialGradient>
                  <linearGradient id="wsChronoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#C89B54"/><stop offset="48%" stop-color="#4E8A5B"/><stop offset="100%" stop-color="#275D38"/>
                  </linearGradient>
                </defs>
                <rect x="74" y="1.5" width="12" height="5" rx="2" fill="url(#wsGoldTrim)" opacity="0.92"/>
                <rect x="77" y="6" width="6" height="3.5" fill="#785826" opacity="0.7"/>
                <circle cx="80" cy="82" r="73.5" fill="url(#wsBezelMetal)"/>
                <circle cx="80" cy="82" r="72.4" fill="none" stroke="url(#wsGoldTrim)" stroke-width="1.2" opacity="0.75"/>
                <circle cx="80" cy="82" r="66.5" fill="none" stroke="url(#wsGoldTrim)" stroke-width="0.9" opacity="0.55"/>
                <circle cx="80" cy="82" r="69.6" fill="none" stroke="#DCE5DA" stroke-width="2.1" stroke-dasharray="0.95 6.338" opacity="0.48"/>
                <circle cx="80" cy="82" r="69.6" fill="none" stroke="url(#wsGoldTrim)" stroke-width="3.2" stroke-dasharray="1.5 34.94" opacity="0.92"/>
                <circle class="tot-pro-dial" cx="80" cy="82" r="65.2"/>
                <g class="tot-pro-guilloche">
                  <circle cx="80" cy="82" r="44.5" fill="none" stroke="currentColor" stroke-width="0.7" stroke-dasharray="1.2 4.4" opacity="0.34"/>
                  <path d="M67 115L71 111.5L75 115M76.5 113.5L80 110.2L83.5 113.5M85 115L89 111.5L93 115" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" opacity="0.34"/>
                </g>
                <g class="tot-pro-crest" transform="translate(80, 39.5)">
                  <path d="M-5.2 -2.2L-7.2 -8.2L-2.4 -4.5C-0.9 -5 0.9 -5 2.4 -4.5L7.2 -8.2L5.2 -2.2C7.4 -0.4 8.3 2.1 8 4.8C7.6 7.5 4.8 9 0 9C-4.8 9 -7.6 7.5 -8 4.8C-8.3 2.1 -7.4 -0.4 -5.2 -2.2Z" fill="url(#wsGoldTrim)"/>
                  <circle cx="-2.6" cy="0.6" r="1.15" class="tot-pro-crest-eye"/><circle cx="2.6" cy="0.6" r="1.15" class="tot-pro-crest-eye"/>
                  <path d="M-2.8 4.8L-1.4 3.5L0 4.8L1.4 3.5L2.8 4.8" fill="none" class="tot-pro-crest-mark" stroke-width="1" stroke-linecap="round"/>
                </g>
                <rect x="122.5" y="80.8" width="7.5" height="2.4" rx="1.2" fill="url(#wsGoldTrim)" opacity="0.88"/>
                <rect x="30" y="80.8" width="7.5" height="2.4" rx="1.2" fill="url(#wsGoldTrim)" opacity="0.88"/>
                <rect x="78.8" y="124.5" width="2.4" height="7.2" rx="1.2" fill="url(#wsGoldTrim)" opacity="0.88"/>
                <g transform="rotate(-90 80 82)">
                  <circle class="chrono-track" cx="80" cy="82" r="56"/>
                  <circle class="chrono-progress" id="ws-chrono-arc" cx="80" cy="82" r="56"/>
                </g>
                <path d="M26 66A56 56 0 0 1 134 66C116 56 44 56 26 66Z" fill="url(#wsGlassGlint)"/>
              </svg>
              <div class="chrono-center">
                <div class="timer-digits chrono-digits tabular" id="ws-timer-digits">${esc(curTimerDigits)}</div>
                <div class="chrono-state">
                  <span class="live-dot"></span>
                  <span class="timer-status-text" id="ws-timer-status-text">${esc(curTimerStatus)}</span>
                </div>
              </div>
            </div>
            <div class="timer-actions">
              <button type="button" class="btn-timer-ctrl primary" onclick="typeof toggleTimer === 'function' && toggleTimer()"><span id="ws-timer-play-text">${esc(curTimerPlay)}</span></button>
              <button type="button" class="btn-timer-ctrl" onclick="typeof resetTimer === 'function' && resetTimer()">Đặt lại</button>
            </div>
            <div class="timer-footer-stat">
              <span>Hôm nay đã học</span>
              <strong class="tabular" id="ws-timer-today-total">${esc(curTimerToday)}</strong>
            </div>
          </div>

          <div class="deck-widget widget-theme-gold ink-brackets has-stamp" id="ws-widget-task">
            <div class="widget-header">
              <span class="tot-icon-tile warm" aria-hidden="true">
                <svg viewBox="2.8 3.5 23.6 22" fill="none">
                  <circle cx="12.5" cy="15.2" r="7" fill="#2A2C32"/>
                  <path d="M12.5 6.2V8.8M12.5 21.6V24.2M3.8 15.2H6.4M18.6 15.2H21.2M6.4 9.1L8.2 10.9M16.8 19.5L18.6 21.3M18.6 9.1L16.8 10.9M8.2 19.5L6.4 21.3" stroke="#2A2C32" stroke-width="1.9" stroke-linecap="round"/>
                  <circle cx="10.2" cy="14.6" r="2.2" fill="#FFFFFF"/><circle cx="10.5" cy="14.6" r="1.05" fill="#111111"/>
                  <circle cx="14.8" cy="14.6" r="2.2" fill="#FFFFFF"/><circle cx="14.5" cy="14.6" r="1.05" fill="#111111"/>
                  <path d="M21.8 4.8L22.9 7.4L25.6 7.8L23.6 9.6L24.1 12.2L21.8 10.9L19.5 12.2L20 9.6L18 7.8L20.7 7.4L21.8 4.8Z" fill="#F59E0B" stroke="#B45309" stroke-width="0.8" stroke-linejoin="round"/>
                </svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Task · 3 Bước</div>
                <div class="widget-subtitle">Flow → Grammar → Tự viết</div>
              </div>
            </div>
            <div class="tot-speedquiz-meta">
              <div class="tot-sq-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9.5 2h5" stroke-linecap="round"/></svg>
                <span>Domino 60s</span>
              </div>
              <div class="tot-sq-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Soi chuẩn Key</span>
              </div>
            </div>
            ${isTaskMode
              ? `<button type="button" class="btn-widget-speedquiz" ${canStartTest ? '' : 'disabled'} onclick="WritingStudio.startTaskExam('${esc(mod.id)}')"><span>${canStartTest ? 'Vào Test bài này →' : `Thuộc ${mStats.done}/${mStats.total} thẻ`}</span></button>`
              : `<button type="button" class="btn-widget-speedquiz" onclick="WritingStudio.openTask('${esc(mod.id)}')"><span>Vào Task bài này →</span></button>`}
          </div>
        </aside>

        <!-- CENTER COLUMN: EXACT READING 3D FLASHCARD + STACKED GHOST CARDS + CONTROLS -->
        <div class="study-center-col">
          <div class="fc-scene" id="ws-fc-scene" onclick="WritingStudio.flipCard()">
            <div class="deck-ghost-2" aria-hidden="true"></div>
            <div class="deck-ghost-1" aria-hidden="true"></div>
            <div class="fc-motion-wrap">
              <div class="card-progress-bar">
                <div class="card-progress-fill" style="width:${pctCard}%;"></div>
              </div>
              <div class="fc-card ${state.flipped ? 'flipped' : ''}" id="ws-fc-card">
                <!-- FRONT FACE -->
                <div class="fc-face fc-face-front">
                  <div class="fc-meta-top">
                    <span class="fc-pos">${esc(card.pos)}</span>
                    <span class="fc-status-tag ${statusCls}">${esc(statusTxt)}</span>
                  </div>

                  <div class="fc-center-front">
                    <div class="fc-word ${wordSizeCls}">${esc(card.en)}</div>
                    <svg class="calm-hand-underline" viewBox="0 0 160 14" fill="none" aria-hidden="true">
                      <path d="M6 9.5C38 4.2 108 3.2 154 8.2" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>
                      <path d="M24 12.2C58 9.2 106 8.8 138 10.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" opacity="0.55"/>
                    </svg>
                    <div class="fc-pronounce-row" onclick="event.stopPropagation()">
                      <span class="fc-ipa-badge">${esc(metaTag)}</span>
                      ${showAudio ? `
                        <button type="button" class="btn-voice-speak" onclick="WritingStudio.speakCurrent('en-GB', event)" title="Nghe Anh - Anh (UK)"><span>UK</span></button>
                        <button type="button" class="btn-voice-speak" onclick="WritingStudio.speakCurrent('en-US', event)" title="Nghe Anh - Mỹ (US)"><span>US</span></button>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Exact 3 Full-Color Reading Ghibli Stickers -->
                  <svg class="totoro-fc-charm totoro-fc-soot" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                    <circle cx="19" cy="24" r="9" fill="#2A2C32"/>
                    <path d="M19 12V15.5M19 32.5V36M7 24H10.5M27.5 24H31M10.5 15.5L13 18M25 30L27.5 32.5M27.5 15.5L25 18M13 30L10.5 32.5" stroke="#2A2C32" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="15.8" cy="23.2" r="2.7" fill="#FFFFFF"/><circle cx="16.2" cy="23.2" r="1.25" fill="#111111"/>
                    <circle cx="22.2" cy="23.2" r="2.7" fill="#FFFFFF"/><circle cx="21.8" cy="23.2" r="1.25" fill="#111111"/>
                    <path d="M33.5 9.5L35 12.6L38.3 13.1L35.9 15.4L36.5 18.7L33.5 17.1L30.5 18.7L31.1 15.4L28.7 13.1L32 12.6L33.5 9.5Z" fill="#F5B041" stroke="#B4690E" stroke-width="0.9" stroke-linejoin="round"/>
                  </svg>
                  <svg class="totoro-fc-charm totoro-fc-corner-left" viewBox="0 0 72 60" fill="none" aria-hidden="true">
                    <path d="M7 51C10 39 18 32 30 28C27 39 19 47 7 51Z" fill="#63A870" stroke="#366E44" stroke-width="1.5" stroke-linejoin="round"/>
                    <path d="M7 51L22 36" stroke="#366E44" stroke-width="1.3" stroke-linecap="round"/>
                    <path d="M31 28L27.5 16.5C27.2 15.2 28.7 14.5 29.6 15.5L36.5 23.5C39.2 22.8 42.3 22.8 45 23.5L51.9 15.5C52.8 14.5 54.3 15.2 54 16.5L50.5 28C55 31.5 57.5 37.2 57 44C56.4 51.5 49.8 55 40.8 55C31.8 55 25.2 51.5 24.6 44C24.1 37.2 26.6 31.5 31 28Z" fill="#FFFFFF" stroke="#5B5852" stroke-width="1.65" stroke-linejoin="round"/>
                    <circle cx="35.2" cy="34.5" r="2.1" fill="#1E2126"/><circle cx="34.6" cy="33.9" r="0.65" fill="#FFFFFF"/>
                    <circle cx="46.4" cy="34.5" r="2.1" fill="#1E2126"/><circle cx="45.8" cy="33.9" r="0.65" fill="#FFFFFF"/>
                    <ellipse cx="31.5" cy="37.6" rx="2.3" ry="1.15" fill="#F29B9B" opacity="0.6"/>
                    <ellipse cx="50.1" cy="37.6" rx="2.3" ry="1.15" fill="#F29B9B" opacity="0.6"/>
                    <ellipse cx="40.8" cy="36.6" rx="1.6" ry="0.95" fill="#5B5852"/>
                    <g transform="translate(51, 35) rotate(14)">
                      <path d="M6 2.5V0.5" stroke="#5B3B1E" stroke-width="1.4" stroke-linecap="round"/>
                      <path d="M1.5 6.8C1.5 4.2 3.5 2.7 6 2.7C8.5 2.7 10.5 4.2 10.5 6.8C8 7.4 4 7.4 1.5 6.8Z" fill="#8D653E" stroke="#57391C" stroke-width="1.1"/>
                      <path d="M2.6 7C2.5 10.5 4 13.2 6 14.5C8 13.2 9.5 10.5 9.4 7Z" fill="#C97C3A" stroke="#633210" stroke-width="1.1"/>
                    </g>
                  </svg>
                  <svg class="totoro-ink-stamp totoro-fc-sticker" viewBox="0 0 72 72" fill="none" aria-hidden="true">
                    <path d="M36 9V14" stroke="#366E44" stroke-width="2" stroke-linecap="round"/>
                    <path d="M11 26C16 14 25 11 36 11C47 11 56 14 61 26C54.5 23.4 48.5 23.4 43.2 25.4C38.5 23.2 33.5 23.2 28.8 25.4C23.5 23.4 17.5 23.4 11 26Z" fill="#5CA06B" stroke="#2F663D" stroke-width="1.7" stroke-linejoin="round"/>
                    <path d="M36 24V44" stroke="#5B4430" stroke-width="1.9" stroke-linecap="round"/>
                    <path d="M24 33L20.5 22.5C20.2 21.3 21.7 20.6 22.6 21.5L29.8 28.2C33.6 27.1 38.4 27.1 42.2 28.2L49.4 21.5C50.3 20.6 51.8 21.3 51.5 22.5L48 33C54.2 37.5 57.5 45.2 56.8 54.5C56 62.2 48.5 66 36 66C23.5 66 16 62.2 15.2 54.5C14.5 45.2 17.8 37.5 24 33Z" fill="#6F6B64" stroke="#484540" stroke-width="1.7" stroke-linejoin="round"/>
                    <ellipse cx="36" cy="54.5" rx="15" ry="10.2" fill="#FBF6E8"/>
                    <path d="M26 51.5L28.8 48.8L31.6 51.5M33.2 50.2L36 47.5L38.8 50.2M40.4 51.5L43.2 48.8L46 51.5" stroke="#6F6B64" stroke-width="1.7" stroke-linecap="round"/>
                    <circle cx="28" cy="36.8" r="3.4" fill="#FFFFFF"/><circle cx="28.4" cy="36.8" r="1.6" fill="#181A1F"/><circle cx="27.7" cy="36" r="0.6" fill="#FFFFFF"/>
                    <circle cx="44" cy="36.8" r="3.4" fill="#FFFFFF"/><circle cx="43.6" cy="36.8" r="1.6" fill="#181A1F"/><circle cx="42.9" cy="36" r="0.6" fill="#FFFFFF"/>
                    <ellipse cx="36" cy="38.2" rx="2.5" ry="1.3" fill="#23221F"/>
                    <path d="M18 39.5L10.5 38M17.5 43L10 43.5M54 39.5L61.5 38M54.5 43L62 43.5" stroke="#484540" stroke-width="1.4" stroke-linecap="round"/>
                  </svg>

                  <div class="fc-flip-prompt">
                    <svg class="totoro-inline-emoji" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M7 9.5L5.2 3.5L10 7.5C11.3 7 12.7 7 14 7.5L18.8 3.5L17 9.5C19.5 11.4 20.6 14 20.4 17C20.2 20.3 17 22 12 22C7 22 3.8 20.3 3.6 17C3.4 14 4.5 11.4 7 9.5Z" fill="#6F6B64" stroke="#484540" stroke-width="1.2"/>
                      <ellipse cx="12" cy="17.5" rx="5.5" ry="3.6" fill="#FBF6E8"/>
                      <circle cx="9.2" cy="12" r="1.7" fill="#FFFFFF"/><circle cx="9.4" cy="12" r="0.85" fill="#181A1F"/>
                      <circle cx="14.8" cy="12" r="1.7" fill="#FFFFFF"/><circle cx="14.6" cy="12" r="0.85" fill="#181A1F"/>
                      <ellipse cx="12" cy="13.2" rx="1.2" ry="0.65" fill="#23221F"/>
                    </svg>
                    <span>Chạm thẻ để lật · Vuốt ⇄ đổi thẻ</span>
                  </div>
                </div>

                <!-- BACK FACE -->
                <div class="fc-face fc-face-back">
                  <div class="fc-back-scrollable" style="display:flex;flex-direction:column;">
                    <div class="fc-back-header-bar">
                      <div class="fc-back-top-row">
                        <span class="fc-pos">${esc(card.pos)}</span>
                        <div class="fc-back-header-right">
                          <span class="fc-status-tag ${statusCls}">${esc(statusTxt)}</span>
                        </div>
                      </div>
                      <div class="fc-back-meta-row">
                        <div class="fc-word">${esc(card.en)}</div>
                        ${showAudio ? `
                          <div class="fc-pronounce-row" onclick="event.stopPropagation()">
                            <button type="button" class="btn-voice-speak" onclick="WritingStudio.speakCurrent('en-GB', event)" title="Nghe Anh - Anh (UK)"><span>UK</span></button>
                            <button type="button" class="btn-voice-speak" onclick="WritingStudio.speakCurrent('en-US', event)" title="Nghe Anh - Mỹ (US)"><span>US</span></button>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <div class="fc-back-body-stack">${backBodyHtml}</div>
                  </div>

                  <svg class="ghibli-stamp totoro-fc-back-sticker" viewBox="0 0 64 64" fill="none" aria-hidden="true">
                    <path d="M21 24L17 10.5C16.7 9.4 18.2 8.7 19.1 9.6L27 17.5C30.2 16.5 33.8 16.5 37 17.5L44.9 9.6C45.8 8.7 47.3 9.4 47 10.5L43 24C48.5 28 51.5 34.8 51 43C50.4 51.8 43.2 56.5 32 56.5C20.8 56.5 13.6 51.8 13 43C12.5 34.8 15.5 28 21 24Z" fill="#6B92B8" stroke="#3F5C78" stroke-width="1.6" stroke-linejoin="round"/>
                    <ellipse cx="32" cy="44.5" rx="13" ry="9" fill="#FBF6E8"/>
                    <path d="M25 43L27.5 40.5L30 43M34 43L36.5 40.5L39 43" stroke="#5D82A6" stroke-width="1.6" stroke-linecap="round"/>
                    <circle cx="25" cy="29.2" r="3.1" fill="#FFFFFF"/><circle cx="25.4" cy="29.2" r="1.45" fill="#181A1F"/>
                    <circle cx="39" cy="29.2" r="3.1" fill="#FFFFFF"/><circle cx="38.6" cy="29.2" r="1.45" fill="#181A1F"/>
                    <ellipse cx="32" cy="31" rx="2" ry="1.1" fill="#2A323D"/>
                  </svg>
                  <div class="hanko-seal ${stLevel === 3 ? 'stamped' : ''}" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
                      <path d="M18 22L14 9L24 17C29 15.5 35 15.5 40 17L50 9L46 22C51 26 54 33 54 41C54 51 45 57 32 57C19 57 10 51 10 41C10 33 13 26 18 22Z" stroke="currentColor" stroke-width="3.6" stroke-linejoin="round"/>
                      <circle cx="24" cy="29" r="3" fill="currentColor"/><circle cx="40" cy="29" r="3" fill="currentColor"/>
                      <path d="M23 42L27 38.5L31 42M33 42L37 38.5L41 42" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                    </svg>
                    <span class="hanko-seal-txt">Đã thuộc</span>
                  </div>

                  <div class="assessment-row" onclick="event.stopPropagation()">
                    <button type="button" class="btn-assess btn-assess-unremembered" onclick="WritingStudio.assessCard(1)" aria-label="Đánh giá 1: Chưa nhớ">
                      <svg class="assess-totoro-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle cx="12" cy="12" r="6.8" fill="#2A2C32"/>
                        <path d="M12 3.2V5.5M12 18.5V20.8M3.2 12H5.5M18.5 12H20.8M5.8 5.8L7.4 7.4M16.6 16.6L18.2 18.2M18.2 5.8L16.6 7.4M7.4 16.6L5.8 18.2" stroke="#2A2C32" stroke-width="1.6" stroke-linecap="round"/>
                        <circle cx="9.6" cy="11.5" r="2.1" fill="#FFFFFF"/><circle cx="9.8" cy="11.5" r="0.95" fill="#111111"/>
                        <circle cx="14.4" cy="11.5" r="2.1" fill="#FFFFFF"/><circle cx="14.2" cy="11.5" r="0.95" fill="#111111"/>
                      </svg>
                      <span>Chưa nhớ <small class="anki-ivl-tag">Ôn ngay</small></span>
                      <span class="kbd-badge">1</span>
                    </button>
                    <button type="button" class="btn-assess btn-assess-slow" onclick="WritingStudio.assessCard(2)" aria-label="Đánh giá 2: Nhớ chậm">
                      <svg class="assess-totoro-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M7.5 10L6 4.8L10 8.2C11.3 7.7 12.7 7.7 14 8.2L18 4.8L16.5 10C18.8 11.7 19.8 14.3 19.6 17.2C19.3 20.2 16.5 21.8 12 21.8C7.5 21.8 4.7 20.2 4.4 17.2C4.2 14.3 5.2 11.7 7.5 10Z" fill="#FFFFFF" stroke="#5B5852" stroke-width="1.4" stroke-linejoin="round"/>
                        <circle cx="9.6" cy="13.2" r="1.25" fill="#1E2126"/><circle cx="14.4" cy="13.2" r="1.25" fill="#1E2126"/>
                        <ellipse cx="7.8" cy="15.2" rx="1.3" ry="0.7" fill="#F29B9B" opacity="0.7"/>
                        <ellipse cx="16.2" cy="15.2" rx="1.3" ry="0.7" fill="#F29B9B" opacity="0.7"/>
                      </svg>
                      <span>Nhớ chậm <small class="anki-ivl-tag">1 ngày</small></span>
                      <span class="kbd-badge">2</span>
                    </button>
                    <button type="button" class="btn-assess btn-assess-mastered" id="ws-btn-master" ${cdSec > 0 ? 'disabled' : ''} onclick="WritingStudio.assessCard(3)" aria-label="Đánh giá 3: Đã thuộc">
                      <svg class="assess-totoro-ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M7.2 10L5.6 4.2L10.1 8C11.3 7.6 12.7 7.6 13.9 8L18.4 4.2L16.8 10C19.2 11.7 20.2 14.2 20 17.2C19.7 20.3 16.8 22 12 22C7.2 22 4.3 20.3 4 17.2C3.8 14.2 4.8 11.7 7.2 10Z" fill="#6D6962" stroke="#484540" stroke-width="1.15" stroke-linejoin="round"/>
                        <path d="M12 7.5C13.4 4.5 16 4.1 17.6 5.6C15.9 7.2 13.7 7.8 12 7.5Z" fill="#52A063" stroke="#2D6A3B" stroke-width="0.9"/>
                        <ellipse cx="12" cy="17.8" rx="5.2" ry="3.2" fill="#FBF6E8"/>
                        <circle cx="9.3" cy="12.6" r="1.5" fill="#FFFFFF"/><circle cx="9.4" cy="12.6" r="0.75" fill="#181A1F"/>
                        <circle cx="14.7" cy="12.6" r="1.5" fill="#FFFFFF"/><circle cx="14.6" cy="12.6" r="0.75" fill="#181A1F"/>
                      </svg>
                      <span id="ws-btn-master-lbl">${cdSec > 0 ? `Chờ ${cdSec}s` : 'Đã thuộc <small class="anki-ivl-tag">4 ngày</small>'}</span>
                      <span class="kbd-badge">3</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="study-controls">
            <div class="nav-buttons-group">
              <button type="button" class="btn" ${state.cardIdx === 0 ? 'disabled' : ''} onclick="WritingStudio.stepCard(-1)">← Trước</button>
              <button type="button" class="btn btn-primary btn-flip-action" id="ws-btn-flip" onclick="WritingStudio.flipCard()">${state.flipped ? 'Mặt trước' : (card.kind === 'flow' ? 'Xem mạch Flow' : 'Xem nghĩa')}</button>
              <button type="button" class="btn" ${state.cardIdx >= cards.length - 1 ? 'disabled' : ''} onclick="WritingStudio.stepCard(1)">Tiếp →</button>
            </div>
          </div>

          <div class="keyboard-hint">Phím tắt: <strong>Space</strong> Lật thẻ · <strong>← / →</strong> Chuyển thẻ · <strong>1 / 2 / 3</strong> Chấm điểm · <strong>R</strong> Nghe lại</div>
        </div>

        <!-- RIGHT DECK: Donut Progress Widget + Unified Card Playlist -->
        <aside class="study-deck study-deck-right" aria-label="Tiến độ và danh sách thẻ">
          <div class="deck-widget widget-theme-teal ink-brackets has-stamp" id="ws-widget-progress">
            <svg class="totoro-widget-charm" style="top:10px;right:12px;width:34px;height:34px;" viewBox="0 0 44 44" fill="none" aria-hidden="true">
              <path d="M13 18L10.5 9.5C10.3 8.5 11.5 8 12.2 8.7L17.5 14.2C19.8 13.5 22.2 13.5 24.5 14.2L29.8 8.7C30.5 8 31.7 8.5 31.5 9.5L29 18C32.5 20.8 34.4 25.2 34 30.8C33.5 36.8 28.5 39.8 21 39.8C13.5 39.8 8.5 36.8 8 30.8C7.6 25.2 9.5 20.8 13 18Z" fill="#FFFFFF" stroke="#5B5852" stroke-width="1.5" stroke-linejoin="round"/>
              <path d="M21 13.5C23 9.2 27.2 8.6 29.6 11.2C27.2 13.4 23.8 14.2 21 13.5Z" fill="#52A063" stroke="#2D6A3B" stroke-width="1"/>
              <circle cx="16.8" cy="23.5" r="1.8" fill="#1E2126"/><circle cx="25.2" cy="23.5" r="1.8" fill="#1E2126"/>
              <ellipse cx="14" cy="26.2" rx="1.8" ry="0.9" fill="#F29B9B" opacity="0.65"/>
              <ellipse cx="28" cy="26.2" rx="1.8" ry="0.9" fill="#F29B9B" opacity="0.65"/>
            </svg>
            <div class="widget-header">
              <span class="tot-icon-tile" aria-hidden="true">
                <svg viewBox="3 5.5 26 23.5" fill="none">
                  <path d="M10.2 14L8.8 7.2L13.2 10.8C15 10.2 17 10.2 18.8 10.8L23.2 7.2L21.8 14C23.4 15.4 24 17.4 24 19H8C8 17.4 8.6 15.4 10.2 14Z" fill="#595651"/>
                  <path d="M14.2 10.2C15.8 7.5 19.2 7.4 20.6 9.5C18.5 11 15.8 11.2 14.2 10.2Z" fill="#4E9460"/>
                  <circle cx="13" cy="14.3" r="1.9" fill="#FFFFFF"/><circle cx="13.2" cy="14.3" r="0.95" fill="#181A1F"/>
                  <circle cx="19" cy="14.3" r="1.9" fill="#FFFFFF"/><circle cx="18.8" cy="14.3" r="0.95" fill="#181A1F"/>
                  <path d="M4.2 18.8C4.2 17.7 5.2 17 6.3 17.2L16 18.8L25.7 17.2C26.8 17 27.8 17.7 27.8 18.8V26.4C27.8 27.2 27 27.8 26.2 27.6L16 26L5.8 27.6C5 27.8 4.2 27.2 4.2 26.4V18.8Z" fill="#FBF8F0" stroke="#3F6E4A" stroke-width="1.6" stroke-linejoin="round"/>
                  <path d="M16 18.8V26" stroke="#3F6E4A" stroke-width="1.5"/>
                </svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Tiến Độ Thuộc Thẻ</div>
                <div class="widget-subtitle">${esc(mod.code)}</div>
              </div>
            </div>

            <div class="tot-vocab-donut-row">
              <div class="tot-donut-wrap">
                <svg class="tot-donut-svg" viewBox="0 0 80 80" aria-hidden="true">
                  <defs>
                    <linearGradient id="wsDonutOkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stop-color="#3F8E59"/><stop offset="100%" stop-color="#22683E"/>
                    </linearGradient>
                  </defs>
                  <circle cx="40" cy="40" r="37.5" fill="none" stroke="var(--border-strong)" stroke-width="1.2" stroke-dasharray="1.5 4.2" opacity=".75"/>
                  <circle cx="40" cy="40" r="31" fill="none" stroke="var(--bg-subtle)" stroke-width="9.5"/>
                  <circle cx="40" cy="40" r="31" fill="none" stroke="var(--streak)" stroke-width="9.5" stroke-dasharray="${donutCirc}" stroke-dashoffset="${warmDashOff}"/>
                  <circle cx="40" cy="40" r="31" fill="none" stroke="url(#wsDonutOkGrad)" stroke-width="9.5" stroke-linecap="round" stroke-dasharray="${donutCirc}" stroke-dashoffset="${okDashOff}"/>
                </svg>
                <div class="tot-donut-center">
                  <span class="tot-donut-pct tabular">${okPct}%</span>
                  <span class="tot-donut-lbl">Thuộc</span>
                </div>
              </div>

              <div class="vocab-stats-list">
                <div class="vocab-stat-row is-ok">
                  <div class="vocab-stat-label">
                    <span class="tot-stat-ico ok"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" fill="var(--ok-soft)" stroke="var(--ok)" stroke-width="1.6"/><path d="M6.5 10.3l2.3 2.3 4.8-4.9" stroke="var(--ok)" stroke-width="1.9" stroke-linecap="round"/></svg></span>
                    <span>Đã thuộc</span>
                  </div>
                  <div class="vocab-stat-value tabular"><strong>${mStats.done}</strong></div>
                </div>
                <div class="vocab-stat-row is-warm">
                  <div class="vocab-stat-label">
                    <span class="tot-stat-ico warm"><svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" fill="var(--streak-soft)" stroke="var(--streak)" stroke-width="1.6"/><path d="M10 6v4.3l2.7 1.6" stroke="var(--streak)" stroke-width="1.8" stroke-linecap="round"/></svg></span>
                    <span>Nhớ chậm</span>
                  </div>
                  <div class="vocab-stat-value tabular"><strong>${slowCnt}</strong></div>
                </div>
                <button type="button" class="vocab-stat-row is-muted is-filter-row ${state.unmasteredOnly ? 'active' : ''}" onclick="WritingStudio.toggleUnmastered()">
                  <div class="vocab-stat-label">
                    <span class="tot-stat-ico muted"><svg viewBox="0 0 20 20" fill="none"><rect x="3.5" y="3.5" width="13" height="13" rx="4" fill="var(--surface-muted)" stroke="var(--ink-3)" stroke-width="1.5"/><path d="M7.5 10h5" stroke="var(--ink-3)" stroke-width="1.7" stroke-linecap="round"/></svg></span>
                    <span>Chưa thuộc</span>
                  </div>
                  <div class="vocab-stat-value tabular"><strong>${unlearnedCnt}</strong></div>
                </button>
              </div>
            </div>

            <div class="vocab-stat-row due-review-row">
              <div class="vocab-stat-label">
                <span class="tot-stat-ico due"><svg viewBox="0 0 20 20" fill="none"><path d="M10 3.2a4.8 4.8 0 0 1 4.8 4.8v2.7l1.3 2a.7.7 0 0 1-.6 1.1H4.5a.7.7 0 0 1-.6-1.1l1.3-2V8A4.8 4.8 0 0 1 10 3.2z" fill="var(--streak-soft)" stroke="var(--streak)" stroke-width="1.5"/><path d="M8.2 15.2a2 2 0 0 0 3.6 0" stroke="var(--streak)" stroke-width="1.5" stroke-linecap="round"/></svg></span>
                <span>Thẻ cần ôn</span>
              </div>
              <div class="vocab-stat-value tabular"><strong>${dueCnt}</strong></div>
            </div>

            <div class="bamboo-progress-bar">
              <div class="bamboo-seg-mastered" style="width:${okPct}%;"></div>
              <div class="bamboo-seg-slow" style="width:${slowPct}%;"></div>
              <div class="bamboo-seg-unlearned" style="width:${unlPct}%;"></div>
            </div>
          </div>

          <div class="deck-widget widget-theme-coral ink-brackets has-stamp" id="ws-widget-playlist">
            <svg class="totoro-widget-charm" style="top:10px;right:12px;width:30px;height:30px;" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path d="M18 8V4.5" stroke="#5B3B1E" stroke-width="2" stroke-linecap="round"/>
              <path d="M18 8.5C21 4.2 26 3.5 29 6.5C26 9.2 21.8 10 18 8.5Z" fill="#52A063" stroke="#2D6A3B" stroke-width="1.2"/>
              <path d="M9.5 16.5C9.5 11.4 13.2 8.5 18 8.5C22.8 8.5 26.5 11.4 26.5 16.5C21.5 17.6 14.5 17.6 9.5 16.5Z" fill="#8D653E" stroke="#57391C" stroke-width="1.4"/>
              <path d="M11.6 16.8C11.4 23.4 14 28.4 18 31C22 28.4 24.6 23.4 24.4 16.8C20.2 17.7 15.8 17.7 11.6 16.8Z" fill="#C97C3A" stroke="#633210" stroke-width="1.4"/>
            </svg>
            <div class="widget-header">
              <span class="tot-icon-tile warm" aria-hidden="true">
                <svg viewBox="2 2 24 24" fill="none">
                  <path d="M8.5 11.2L7 5.6L11.2 9C12.5 8.5 14 8.5 15.3 9L19.5 5.6L18 11.2C20.2 12.8 21.2 15.2 21 18.2C20.7 21.5 17.8 23.2 13.2 23.2C8.6 23.2 5.7 21.5 5.4 18.2C5.2 15.2 6.2 12.8 8.5 11.2Z" fill="#6F6B64" stroke="#484540" stroke-width="1.1"/>
                  <ellipse cx="13.2" cy="18.8" rx="5.2" ry="3.4" fill="#FBF6E8"/>
                  <circle cx="10.6" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="10.8" cy="13.5" r="0.75" fill="#181A1F"/>
                  <circle cx="15.8" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="15.6" cy="13.5" r="0.75" fill="#181A1F"/>
                </svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Danh Sách Thẻ</div>
                <div class="widget-subtitle">Flow → Vocab → Para → Gram</div>
              </div>
            </div>
            <div class="ws-deck-scroll">${miniListHtml}</div>
          </div>
        </aside>
      </div>
    `;

    syncLiveWidgets();
    ensureCooldownTicker();
    if (isTaskMode) ensureTaskIdleTicker();
  }

  function ensureCooldownTicker() {
    if (state.cooldownTicker) return;
    state.cooldownTicker = setInterval(() => {
      if (document.documentElement.getAttribute('data-skill') !== 'writing') return;
      syncLiveWidgets();
      const btn = document.getElementById('ws-btn-master');
      const lbl = document.getElementById('ws-btn-master-lbl');
      if (!btn || !lbl) return;
      const mod = getActiveMod();
      const cards = getVisibleCards(mod);
      const card = cards[state.cardIdx];
      if (!card) return;
      const sec = getCardCooldownSec(card.id);
      if (sec > 0) {
        btn.disabled = true;
        lbl.textContent = `Chờ ${sec}s`;
      } else if (btn.disabled) {
        btn.disabled = false;
        lbl.innerHTML = 'Đã thuộc <small class="anki-ivl-tag">4 ngày</small>';
      }
    }, 500);
  }

  function ensureTaskIdleTicker() {
    if (state.idleTicker) return;
    state.idleTicker = setInterval(() => {
      if (!state.activeTaskModId || isTeacherBypass()) return;
      const elapsed = Date.now() - state.lastActivityAt;
      const el = document.getElementById('ws-idle-clock');
      if (el) el.textContent = `${fmtMmSs(elapsed / 1000)} / 10:00`;
      if (elapsed >= IDLE_LIMIT_MS) {
        setLockout(TASK_LOCK_KEY_BASE, 'Không thao tác quá 10 phút trong Task');
        exitTaskStudyMode();
        closeTaskExamModal(true);
        showAntiCheatModal('KHÓA 30 PHÚT · TREO MÁY', 'Hệ thống phát hiện không thao tác quá 10 phút trong Task. Phiên làm việc đã kết thúc và tạm khóa 30 phút.', true);
      }
    }, 1000);
  }

  function selectModule(modId) {
    state.selectedModId = modId;
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
  }
  function toggleUnmastered() {
    state.unmasteredOnly = !state.unmasteredOnly;
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
  }
  function flipCard() {
    const mod = getActiveMod();
    const card = getVisibleCards(mod)[state.cardIdx];
    state.flipped = !state.flipped;
    document.getElementById('ws-fc-card')?.classList.toggle('flipped', state.flipped);
    const btn = document.getElementById('ws-btn-flip');
    if (btn) btn.textContent = state.flipped ? 'Mặt trước' : (card?.kind === 'flow' ? 'Xem mạch Flow' : 'Xem nghĩa');
    if (state.flipped && card && (card.kind === 'vocab' || card.kind === 'paraphrase')) {
      const txt = card.kind === 'paraphrase' ? (card.items?.[0]?.en || card.en) : card.en;
      speakText(txt, 'en-GB');
    }
  }
  function stepCard(delta) {
    const mod = getActiveMod();
    const cards = getVisibleCards(mod);
    const nxt = state.cardIdx + delta;
    if (nxt >= 0 && nxt < cards.length) {
      state.cardIdx = nxt;
      state.flipped = false;
      renderFlashcardWorkspace();
    }
  }
  function jumpCard(idx) {
    state.cardIdx = idx;
    state.flipped = false;
    renderFlashcardWorkspace();
  }
  function speakCurrent(accent, e) {
    if (e) e.stopPropagation();
    const mod = getActiveMod();
    const card = getVisibleCards(mod)[state.cardIdx];
    if (!card) return;
    const txt = (card.kind === 'paraphrase' && state.flipped) ? (card.items?.[0]?.en || card.en) : card.en;
    speakText(txt, accent);
  }

  function commitCardMastery(card, level) {
    const mmap = getMasteryMap();
    const prev = mmap[card.id] || { reviews: 0 };
    mmap[card.id] = {
      level,
      reviews: level === 3 ? (prev.reviews || 0) + 1 : (prev.reviews || 0),
      updatedAt: Date.now()
    };
    saveMasteryMap(mmap);
    try { B()?.recordDailyWordActivity?.(); } catch (_) {}
    renderFlashcardWorkspace();
  }

  function assessCard(level) {
    const mod = getActiveMod();
    const card = getVisibleCards(mod)[state.cardIdx];
    if (!card) return;
    if (level !== 3) {
      commitCardMastery(card, level);
      toast(level === 2 ? 'Đã xếp vào Nhớ chậm.' : 'Đã xếp vào Chưa nhớ.');
      return;
    }
    const cd = getCardCooldownSec(card.id);
    if (cd > 0) {
      toast(`Đang khóa nút Đã thuộc — vui lòng ôn lại thẻ trong ${cd}s.`);
      return;
    }
    if (isTeacherBypass()) {
      commitCardMastery(card, 3);
      toast('Đã đánh dấu Đã thuộc (Chế độ Giáo viên).');
      return;
    }
    openRecallModal(card);
  }

  /* ================= ULTRA-STRICT RECALL MODAL (EXACT TYPING + 35s FLOW ORDER) ================= */
  function openRecallModal(card) {
    ensureOverlays();
    const mmap = getMasteryMap();
    const isStrictSrs = (mmap[card.id]?.reviews || 0) >= 1;
    const isFlow = card.kind === 'flow';
    const limitSec = isFlow ? 35 : (card.kind === 'grammar' ? 40 : 30);

    recallState = {
      card,
      isFlow,
      isStrictSrs,
      attemptsLeft: isFlow ? 1 : (isStrictSrs ? 1 : 2),
      secLeft: limitSec,
      timerId: null,
      flowBank: isFlow ? shuffle((card.steps || []).map((t, i) => ({ id: i, text: t }))) : [],
      flowPicked: [],
      done: false
    };

    const scene = document.getElementById('ws-fc-scene');
    if (scene) scene.style.visibility = 'hidden';

    renderRecallModal();
    document.getElementById('ws-recall-modal').classList.add('open');

    recallState.timerId = setInterval(() => {
      if (!recallState || recallState.done) return;
      recallState.secLeft--;
      const pill = document.getElementById('ws-recall-timer');
      if (pill) {
        pill.textContent = `${Math.max(0, recallState.secLeft)}s`;
        pill.classList.toggle('urgent', recallState.secLeft <= 8);
      }
      if (recallState.secLeft <= 0) {
        failRecall('Hết giờ!');
      }
    }, 1000);
  }

  function renderRecallModal() {
    if (!recallState) return;
    const { card, isFlow, isStrictSrs, attemptsLeft, secLeft } = recallState;
    const abortPen = isStrictSrs ? 90 : 60;
    const cardEl = document.getElementById('ws-recall-card');

    if (isFlow) {
      const nextStepNum = recallState.flowPicked.length + 1;
      cardEl.innerHTML = `
        <div class="ws-modal-head">
          <div class="ws-modal-title">KIỂM TRA NHỚ FLOW</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="ws-pill">Bước ${Math.min(nextStepNum, card.steps.length)} / ${card.steps.length}</span>
            <span class="ws-pill ${secLeft <= 8 ? 'urgent' : ''}" id="ws-recall-timer">${secLeft}s</span>
          </div>
        </div>
        <div class="ws-col-stack">
          <div class="ws-col-lbl">Bấm chọn lần lượt các mắt xích từ bước 1 đến bước ${card.steps.length}</div>
          ${recallState.flowBank.map((item) => `
            <button type="button" class="ws-drag-chip" style="text-align:left;width:100%;" onclick="WritingStudio.pickRecallFlowStep(${item.id})">${esc(item.text)}</button>
          `).join('')}
        </div>
        <div class="ws-feedback" id="ws-recall-fb"></div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn" onclick="WritingStudio.abortRecall()">Bỏ bài (-${abortPen}s)</button>
        </div>
      `;
    } else {
      const promptLine = card.kind === 'grammar'
        ? `Gõ chính xác công thức cấu trúc vừa học · Còn ${attemptsLeft} lần thử`
        : (card.kind === 'paraphrase'
          ? `Gõ chính xác 1 cụm Paraphrase C1-C2 vừa học · Còn ${attemptsLeft} lần thử`
          : `Gõ chính xác cụm từ tiếng Anh vừa học · Còn ${attemptsLeft} lần thử`);
      cardEl.innerHTML = `
        <div class="ws-modal-head">
          <div class="ws-modal-title">KIỂM TRA NHỚ TỪ</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="ws-pill">${isStrictSrs ? 'Ôn tập · 1 lượt' : 'Test 1'}</span>
            <span class="ws-pill ${secLeft <= 8 ? 'urgent' : ''}" id="ws-recall-timer">${secLeft}s</span>
          </div>
        </div>
        <form onsubmit="WritingStudio.submitRecallTyping(event)" autocomplete="off">
          <div class="ws-recall-box">
            <input type="text" class="ws-underline-input" id="ws-recall-input" placeholder="_ _ _ _"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              onpaste="event.preventDefault(); WritingStudio.toastMsg('Không được dán khi đang kiểm tra!');" />
            <div style="font-size:13px;color:var(--ink-2);text-align:center;" id="ws-recall-sub">${promptLine}</div>
          </div>
          <div class="ws-feedback" id="ws-recall-fb" style="margin-top:12px;"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
            <button type="button" class="btn" onclick="WritingStudio.abortRecall()">Bỏ bài (-${abortPen}s)</button>
            <button type="submit" class="btn btn-primary" id="ws-recall-submit">Xác nhận</button>
          </div>
        </form>
      `;
      setTimeout(() => document.getElementById('ws-recall-input')?.focus(), 40);
    }
  }

  function pickRecallFlowStep(stepId) {
    if (!recallState || recallState.done) return;
    const expectedIdx = recallState.flowPicked.length;
    if (stepId === expectedIdx) {
      recallState.flowPicked.push(stepId);
      recallState.flowBank = recallState.flowBank.filter((x) => x.id !== stepId);
      if (recallState.flowBank.length === 0) {
        passRecall();
      } else {
        renderRecallModal();
      }
    } else {
      failRecall('Sai thứ tự mắt xích Flow!');
    }
  }

  function submitRecallTyping(e) {
    if (e) e.preventDefault();
    if (!recallState || recallState.done) return;
    const inp = document.getElementById('ws-recall-input');
    const fb = document.getElementById('ws-recall-fb');
    const typed = normStr(inp?.value || '');
    if (!typed) { inp?.focus(); return; }

    const card = recallState.card;
    const accepted = card.kind === 'paraphrase'
      ? (card.accepted || []).map(normStr)
      : [normStr(card.en)];

    if (accepted.includes(typed)) {
      passRecall();
      return;
    }

    recallState.attemptsLeft--;
    if (recallState.attemptsLeft > 0) {
      const sub = document.getElementById('ws-recall-sub');
      if (sub) sub.textContent = `Chưa chính xác · Còn ${recallState.attemptsLeft} lần thử`;
      if (fb) {
        fb.className = 'ws-feedback err';
        fb.textContent = `Chưa chính xác! Bạn còn ${recallState.attemptsLeft} lần thử lại.`;
      }
      inp?.select();
      inp?.focus();
    } else {
      failRecall('Chưa chính xác!');
    }
  }

  function passRecall() {
    if (!recallState) return;
    recallState.done = true;
    clearInterval(recallState.timerId);
    const fb = document.getElementById('ws-recall-fb');
    if (fb) {
      fb.className = 'ws-feedback ok';
      fb.textContent = 'Chính xác tuyệt đối! Đã chốt Đã thuộc.';
    }
    const card = recallState.card;
    setTimeout(() => {
      closeRecallModalSilent();
      commitCardMastery(card, 3);
      toast('Đã chốt Đã thuộc!');
    }, 550);
  }

  function failRecall(reason) {
    if (!recallState || recallState.done) return;
    recallState.done = true;
    clearInterval(recallState.timerId);
    const card = recallState.card;
    const coolSec = recallState.isStrictSrs ? 60 : 35;
    setCardCooldown(card.id, coolSec);
    commitCardMastery(card, 1);

    const ans = card.kind === 'paraphrase' ? (card.items?.[0]?.en || card.en) : card.en;
    const fb = document.getElementById('ws-recall-fb');
    if (fb) {
      fb.className = 'ws-feedback err';
      fb.textContent = `${reason} Đáp án chuẩn: ${ans}. Hạ về Chưa nhớ và khóa nút Đã thuộc ${coolSec}s.`;
    }
    setTimeout(() => {
      closeRecallModalSilent();
      renderFlashcardWorkspace();
    }, 1500);
  }

  function abortRecall() {
    if (!recallState || recallState.done) return;
    recallState.done = true;
    clearInterval(recallState.timerId);
    const card = recallState.card;
    const penSec = recallState.isStrictSrs ? 90 : 60;
    setCardCooldown(card.id, penSec);
    commitCardMastery(card, 1);
    closeRecallModalSilent();
    toast(`Bỏ kiểm tra giữa chừng — hạ về Chưa nhớ và khóa nút Đã thuộc ${penSec}s!`);
  }

  function closeRecallModalSilent() {
    if (recallState?.timerId) clearInterval(recallState.timerId);
    recallState = null;
    document.getElementById('ws-recall-modal')?.classList.remove('open');
    const scene = document.getElementById('ws-fc-scene');
    if (scene) scene.style.visibility = '';
  }

  /* ================= TASK HUB & ENTRY GATE (SPEED QUIZ + 100% MASTERY) ================= */
  function renderTaskHub(tabsEl, gridEl) {
    ensureOverlays();
    const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
    if (titleEl) titleEl.textContent = 'Task bài tập · Writing';

    const subtopics = DATA().SUBTOPICS || [];
    if (tabsEl) {
      tabsEl.innerHTML = subtopics.map((st) => `
        <button type="button" class="tot-seg-btn ${state.taskHubSubtopic === st.key ? 'active' : ''}" onclick="WritingStudio.switchTaskHubSubtopic('${esc(st.key)}')">${esc(st.shortTitle)}</button>
      `).join('');
    }

    const mods = (DATA().MODULES || []).filter((m) => m.subtopic === state.taskHubSubtopic);
    const prog = getTaskProgMap();
    const doneCnt = mods.filter((m) => prog[m.id]?.status === 'completed').length;
    const subEl = document.getElementById('inline-task-sub');
    if (subEl) subEl.textContent = `${doneCnt} / ${mods.length} Idea đã hoàn thành · Khóa chặt Flow, Grammar và Viết thực chiến.`;

    const core = mods.filter((m) => m.tier === 'core');
    const cross = mods.filter((m) => m.tier === 'cross');
    const sol = mods.filter((m) => m.tier === 'solution');

    const cardHtml = (m) => {
      const mStat = getModMasteryStats(m);
      const p = prog[m.id];
      const isDone = p?.status === 'completed';
      const tierCls = m.tier === 'cross' ? 'is-cross' : (m.tier === 'solution' ? 'is-solution' : 'is-core');
      const pillCls = isDone ? 'ok' : (m.tier === 'cross' ? 'warm' : (m.tier === 'solution' ? 'info' : ''));
      return `
        <article class="ws-task-card ${tierCls} ${isDone ? 'is-done' : ''}">
          <div>
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="ws-task-code">${esc(m.code)}</span>
              ${isDone ? `<span class="ws-pill ok">Band ${Number(p.band || 7.5).toFixed(1)}</span>` : `<span class="ws-pill ${pillCls}">${mStat.done}/${mStat.total} thẻ</span>`}
            </div>
            <div class="ws-task-title">${esc(m.title)}</div>
            <div class="ws-task-meta">${esc((m.viFlowSteps || []).slice(0, 2).join(' → '))}</div>
          </div>
          <div>
            <div class="ws-task-prog" title="Tiến độ thuộc thẻ Flashcard">
              <div class="ws-task-prog-track"><div class="ws-task-prog-fill" style="width:${mStat.pct}%;"></div></div>
              <span class="ws-task-prog-pct">${mStat.pct}%</span>
            </div>
            <div class="ws-task-foot" style="margin-top:10px;">
              ${isTeacherBypass()
                ? `<button type="button" class="btn" style="padding:6px 10px;font-size:11.5px;" onclick="WritingStudio.copyTaskLink('${esc(m.id)}')">Copy link</button>`
                : `<span class="ws-task-steps-hint">${isDone ? 'Đã hoàn thành ✓' : 'Flow · Gram · Write'}</span>`}
              <button type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;" onclick="WritingStudio.openTask('${esc(m.id)}')">
                ${isDone ? 'Xem / Làm lại' : 'Vào Task →'}
              </button>
            </div>
          </div>
        </article>
      `;
    };

    const secHdr = (label, count, cls) => `
      <div class="ws-task-section-hdr">
        <span class="ws-task-sec-pill ${cls || ''}">${label} · ${count}</span>
        <span class="ws-task-sec-line"></span>
      </div>
    `;

    let html = '';
    if (core.length) html += secHdr('Core Lessons', core.length, 'is-core') + core.map(cardHtml).join('');
    if (cross.length) html += secHdr('Cross-Topic Spillover', cross.length, 'is-cross') + cross.map(cardHtml).join('');
    if (sol.length) html += secHdr('Transferable Solutions', sol.length, 'is-solution') + sol.map(cardHtml).join('');
    if (gridEl) gridEl.innerHTML = html;
  }

  function switchTaskHubSubtopic(stKey) {
    state.taskHubSubtopic = stKey;
    const tabsEl = document.getElementById('inline-task-suites');
    const gridEl = document.getElementById('inline-tasks-grid');
    renderTaskHub(tabsEl, gridEl);
  }

  function copyTaskLink(modId) {
    const url = `${window.location.origin}${window.location.pathname}?wtask=${encodeURIComponent(modId)}`;
    navigator.clipboard?.writeText?.(url).then(() => toast('Đã sao chép link giao Task Writing!')).catch(() => toast(url));
  }

  function openTask(modId) {
    ensureOverlays();
    const lock = getLockout(TASK_LOCK_KEY_BASE);
    if (lock) {
      showAntiCheatModal('TẠM KHÓA TASK WRITING', `Tính năng Task Writing đang bị khóa do vi phạm quy chế. Mở khóa sau ${fmtMmSs(lock.remainingMs / 1000)}.`, true);
      return;
    }
    const mod = getModById(modId);
    if (!mod) return;

    // From Task 2+, require 4s Old-Review Speed Quiz if student has mastered cards from OTHER modules
    const allMods = DATA().MODULES || [];
    const modIdx = allMods.findIndex((m) => m.id === modId);
    const sqUnlocked = getSpeedUnlockMap();
    if (!isTeacherBypass() && modIdx > 0 && !sqUnlocked[modId]) {
      const mmap = getMasteryMap();
      const oldPool = [];
      allMods.slice(0, modIdx).forEach((om) => {
        buildModuleCards(om).forEach((c) => {
          if (c.kind === 'vocab' && mmap[c.id]?.level === 3) oldPool.push(c);
        });
      });
      if (oldPool.length >= 4) {
        startOldReviewSpeedQuiz(modId, shuffle(oldPool).slice(0, 8));
        return;
      }
    }

    // Enter Task Flashcard Study Mode first (locked rule: learn 100% cards before Test!)
    state.activeTaskModId = mod.id;
    state.selectedModId = mod.id;
    state.cardIdx = 0;
    state.flipped = false;
    state.lastActivityAt = Date.now();
    window.TotoroUI?.enterSkillMode?.('Writing', 'flashcard');
    renderFlashcardWorkspace();
    toast(`Đã vào Task: ${mod.code} · Học thuộc 100% thẻ để mở khóa Test!`);
  }

  function exitTaskStudyMode() {
    state.activeTaskModId = null;
    renderFlashcardWorkspace();
  }

  /* ================= 4s OLD-REVIEW SPEED QUIZ (UNLOCK TASK 2+) ================= */
  function startOldReviewSpeedQuiz(targetModId, items) {
    const allVocab = (DATA().MODULES || []).flatMap((m) => m.vocab || []);
    sqState = {
      targetModId,
      items,
      allVocab,
      idx: 0,
      correct: 0,
      timerId: null,
      deadline: 0,
      locked: false
    };
    document.getElementById('ws-sq-modal').classList.add('open');
    renderSqQuestion();
  }

  function renderSqQuestion() {
    if (!sqState) return;
    const cardEl = document.getElementById('ws-sq-card');
    if (sqState.idx >= sqState.items.length) {
      clearInterval(sqState.timerId);
      const passed = sqState.correct >= Math.ceil(sqState.items.length * 0.85);
      if (passed) {
        const map = getSpeedUnlockMap();
        map[sqState.targetModId] = true;
        saveSpeedUnlockMap(map);
      }
      cardEl.innerHTML = `
        <div class="ws-modal-head"><div class="ws-modal-title">KẾT QUẢ SPEED QUIZ ÔN TỪ CŨ</div></div>
        <div style="text-align:center;padding:18px 8px;">
          <div style="font-size:30px;font-weight:700;color:${passed ? 'var(--ok)' : 'var(--danger)'};">${sqState.correct} / ${sqState.items.length}</div>
          <p style="margin-top:8px;font-size:14px;color:var(--ink-2);">${passed ? 'Đạt chuẩn ôn bài cũ! Đã mở khóa Task mới.' : 'Cần đạt tối thiểu 85% để mở khóa Task mới.'}</p>
        </div>
        <div style="display:flex;justify-content:center;gap:10px;">
          ${passed
            ? `<button type="button" class="btn btn-primary" onclick="WritingStudio.finishSqAndOpenTask()">Vào Task ngay →</button>`
            : `<button type="button" class="btn btn-primary" onclick="WritingStudio.retrySq()">Làm lại Speed Quiz</button>
               <button type="button" class="btn" onclick="WritingStudio.closeSq()">Đóng</button>`}
        </div>
      `;
      return;
    }

    const cur = sqState.items[sqState.idx];
    const distractors = shuffle(sqState.allVocab.filter((v) => v.vi && v.vi !== cur.vi)).slice(0, 3);
    const opts = shuffle([{ text: cur.vi, ok: true }, ...distractors.map((d) => ({ text: d.vi, ok: false }))]);
    sqState.curOpts = opts;
    sqState.locked = false;
    sqState.deadline = Date.now() + SQ_PER_Q_MS;

    speakText(cur.en, 'en-US');
    cardEl.innerHTML = `
      <div class="ws-modal-head">
        <div class="ws-modal-title">SPEED QUIZ · ÔN TỪ CŨ MỞ KHÓA TASK</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <span class="ws-pill">${sqState.idx + 1} / ${sqState.items.length}</span>
          <span class="ws-pill urgent" id="ws-sq-timer">4.0s</span>
        </div>
      </div>
      <div style="text-align:center;padding:18px 10px;background:var(--surface-panel);border-radius:14px;border:1px solid var(--border);">
        <div style="font-size:24px;font-weight:700;color:var(--accent);">${esc(cur.en)}</div>
      </div>
      <div class="ws-sq-grid">
        ${opts.map((o, i) => `<button type="button" class="ws-sq-opt" id="ws-sq-opt-${i}" onclick="WritingStudio.answerSq(${i})">${esc(o.text)}</button>`).join('')}
      </div>
    `;

    clearInterval(sqState.timerId);
    sqState.timerId = setInterval(() => {
      if (!sqState || sqState.locked) return;
      const rem = sqState.deadline - Date.now();
      const el = document.getElementById('ws-sq-timer');
      if (el) el.textContent = `${Math.max(0, rem / 1000).toFixed(1)}s`;
      if (rem <= 0) {
        sqState.locked = true;
        clearInterval(sqState.timerId);
        setTimeout(() => { sqState.idx++; renderSqQuestion(); }, 350);
      }
    }, 100);
  }

  function answerSq(idx) {
    if (!sqState || sqState.locked) return;
    sqState.locked = true;
    clearInterval(sqState.timerId);
    const picked = sqState.curOpts[idx];
    const btn = document.getElementById(`ws-sq-opt-${idx}`);
    if (picked?.ok) {
      sqState.correct++;
      btn?.classList.add('ok');
    } else {
      btn?.classList.add('bad');
    }
    setTimeout(() => { sqState.idx++; renderSqQuestion(); }, 350);
  }
  function finishSqAndOpenTask() {
    const tid = sqState?.targetModId;
    closeSq();
    if (tid) openTask(tid);
  }
  function retrySq() {
    if (!sqState) return;
    sqState.idx = 0;
    sqState.correct = 0;
    sqState.items = shuffle(sqState.items);
    renderSqQuestion();
  }
  function closeSq() {
    if (sqState?.timerId) clearInterval(sqState.timerId);
    sqState = null;
    document.getElementById('ws-sq-modal')?.classList.remove('open');
  }

  /* ================= 3-TEST SEQUENTIAL TASK EXAM (ANTI-CHEAT + RETRY GATE) ================= */
  function startTaskExam(modId) {
    ensureOverlays();
    const lock = getLockout(TASK_LOCK_KEY_BASE);
    if (lock) {
      showAntiCheatModal('TẠM KHÓA TASK WRITING', `Bạn đang bị khóa luyện tập. Mở lại sau ${fmtMmSs(lock.remainingMs / 1000)}.`, true);
      return;
    }
    const mod = getModById(modId || state.activeTaskModId || state.selectedModId);
    if (!mod) return;
    const stats = getModMasteryStats(mod);
    if (!isTeacherBypass() && stats.done < stats.total) {
      toast(`Cần thuộc đủ ${stats.total}/${stats.total} thẻ trước khi vào bài Test!`);
      return;
    }
    if (!isTeacherBypass() && B()?.syncExamLock?.(true, `Writing Task ${mod.code}`) === false) return;

    examState = {
      mod,
      stage: 1, // 1: Flow Domino 60s -> 2: Grammar Builder 35s/q -> 3: Writing + Retry Gate
      strikes: 0,
      t1Bank: shuffle((mod.viFlowSteps || []).map((t, i) => ({ id: `f_${i}`, order: i, text: t }))),
      t1Slots: new Array((mod.viFlowSteps || []).length).fill(null),
      t1Picked: null,
      t1SecLeft: T1_TIME_LIMIT_SEC,
      t2Idx: 0,
      t2Bank: [],
      t2Slots: [],
      t2ActiveBlank: 0,
      t2SecLeft: T2_PER_SENT_SEC,
      t3Drafts: (mod.sentences || []).map(() => ''),
      t3Audit: null,
      t3RetriesLeft: 2,
      t3LockedOk: {},
      t3Finalized: false,
      timerId: null
    };

    document.getElementById('ws-task-exam-modal').classList.add('open');
    startStageTimer();
    renderExamModal();
  }

  function startStageTimer() {
    if (!examState) return;
    clearInterval(examState.timerId);
    examState.timerId = setInterval(() => {
      if (!examState) return;
      if (examState.stage === 1) {
        examState.t1SecLeft--;
        const el = document.getElementById('ws-exam-timer');
        if (el) {
          el.textContent = `${Math.max(0, examState.t1SecLeft)}s`;
          el.classList.toggle('urgent', examState.t1SecLeft <= 10);
        }
        if (examState.t1SecLeft <= 0) {
          toast('Hết 60 giây Test 1! Đã xáo lại mạch Flow — hãy làm lại nhanh và chính xác.');
          resetT1();
        }
      } else if (examState.stage === 2) {
        examState.t2SecLeft--;
        const el = document.getElementById('ws-exam-timer');
        if (el) {
          el.textContent = `${Math.max(0, examState.t2SecLeft)}s`;
          el.classList.toggle('urgent', examState.t2SecLeft <= 8);
        }
        if (examState.t2SecLeft <= 0) {
          toast('Hết 35 giây câu này! Đã xáo lại kho mảnh ghép — hãy lắp lại.');
          setupT2Sentence();
          renderExamModal();
        }
      }
    }, 1000);
  }

  function resetT1() {
    if (!examState) return;
    const steps = examState.mod.viFlowSteps || [];
    examState.t1Bank = shuffle(steps.map((t, i) => ({ id: `f_${i}`, order: i, text: t })));
    examState.t1Slots = new Array(steps.length).fill(null);
    examState.t1Picked = null;
    examState.t1SecLeft = T1_TIME_LIMIT_SEC;
    renderExamModal();
  }

  function setupT2Sentence() {
    if (!examState) return;
    const s = examState.mod.sentences[examState.t2Idx];
    const parts = s?.builder?.parts || [];
    const blanks = parts.filter((p) => typeof p === 'object');
    examState.t2Slots = new Array(blanks.length).fill(null);
    examState.t2ActiveBlank = 0;
    examState.t2SecLeft = T2_PER_SENT_SEC;
    examState.t2Bank = shuffle([
      ...blanks.map((bl, i) => ({ id: `ok_${i}`, text: bl.ans })),
      ...(s?.builder?.distractors || []).map((d, i) => ({ id: `tr_${i}`, text: d }))
    ]);
  }

  function renderExamModal(checked = false) {
    if (!examState) return;
    const { mod, stage } = examState;
    const card = document.getElementById('ws-task-exam-card');
    const teacherJump = isTeacherBypass() ? `
      <div style="display:flex;gap:5px;">
        <button type="button" class="btn" style="padding:5px 9px;font-size:11.5px;" onclick="WritingStudio.teacherJumpExam(1)">T1</button>
        <button type="button" class="btn" style="padding:5px 9px;font-size:11.5px;" onclick="WritingStudio.teacherJumpExam(2)">T2</button>
        <button type="button" class="btn" style="padding:5px 9px;font-size:11.5px;" onclick="WritingStudio.teacherJumpExam(3)">T3</button>
      </div>
    ` : '';

    const timerText = stage === 1 ? `${examState.t1SecLeft}s` : (stage === 2 ? `${examState.t2SecLeft}s` : 'Không giới hạn');
    let bodyHtml = '';

    if (stage === 1) {
      bodyHtml = `
        <div class="ws-modal-head">
          <div style="font-size:16px;font-weight:700;">Test 1 · Sắp xếp chuỗi Idea Flow</div>
          <button type="button" class="btn btn-primary" onclick="WritingStudio.checkTaskTest1()">Kiểm tra &amp; Sang Test 2 →</button>
        </div>
        <div class="ws-dnd-2col">
          <div class="ws-col-stack">
            <div class="ws-col-lbl">Các mắt xích rời</div>
            ${examState.t1Bank.length === 0
              ? '<div style="padding:14px;border-radius:11px;background:var(--ok-soft);color:var(--ok);font-size:13px;font-weight:700;">Đã xếp hết các mắt xích vào mạch Domino.</div>'
              : examState.t1Bank.map((it) => `
                <div class="ws-drag-chip ${examState.t1Picked === it.id ? 'selected' : ''}" draggable="true"
                  ondragstart="event.dataTransfer.setData('text/plain','${it.id}'); WritingStudio.setT1Picked('${it.id}')"
                  onclick="WritingStudio.pickT1Chip('${it.id}')">${esc(it.text)}</div>
              `).join('')}
          </div>
          <div class="ws-col-stack">
            <div class="ws-col-lbl">Mạch Domino · 1 → ${examState.t1Slots.length}</div>
            ${examState.t1Slots.map((sl, idx) => {
              let cls = sl ? 'filled' : '';
              if (checked && sl) cls += (sl.order === idx ? ' is-ok' : ' is-bad');
              return `
                <div class="ws-drop-slot ${cls}" ondragover="event.preventDefault()" ondrop="WritingStudio.dropT1(event, ${idx})" onclick="WritingStudio.clickT1Slot(${idx})">
                  <span class="ws-slot-num">${idx + 1}</span>
                  ${sl ? `<span class="ws-slot-txt">${esc(sl.text)}</span>` : `<span class="ws-slot-ph">Kéo hoặc bấm mắt xích thả vào bước ${idx + 1}</span>`}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    } else if (stage === 2) {
      const s = mod.sentences[examState.t2Idx];
      let cursor = 0;
      const frameHtml = (s.builder?.parts || []).map((p) => {
        if (typeof p === 'string') return esc(p);
        const bi = cursor++;
        const filled = examState.t2Slots[bi];
        let cls = 'ws-blank';
        if (bi === examState.t2ActiveBlank && !checked) cls += ' active-slot';
        if (filled) cls += ' filled';
        if (checked && filled) cls += (filled.text === p.ans ? ' is-ok' : ' is-bad');
        return `<span class="${cls}" ondragover="event.preventDefault()" ondrop="WritingStudio.dropT2(event, ${bi})" onclick="WritingStudio.clickT2Blank(${bi})">${filled ? esc(filled.text) : `Ô ${bi + 1}`}</span>`;
      }).join('');

      bodyHtml = `
        <div class="ws-modal-head">
          <div style="font-size:16px;font-weight:700;">Test 2 · Lắp Grammar &amp; Vocab · Câu ${examState.t2Idx + 1} / ${mod.sentences.length}</div>
          <button type="button" class="btn btn-primary" onclick="WritingStudio.checkTaskTest2()">Kiểm tra câu này →</button>
        </div>
        <div class="ws-t2-box">
          <div class="ws-t2-vi">[0${examState.t2Idx + 1}] ${esc(s.vi)}</div>
          ${s.grammar ? `<div class="ws-t2-gram">${esc(s.grammar)}</div>` : ''}
          <div class="ws-t2-frame">${frameHtml}</div>
        </div>
        <div class="ws-col-lbl">Kho mảnh ghép</div>
        <div class="ws-bank">
          ${examState.t2Bank.map((ch) => `
            <button type="button" class="ws-chip" draggable="true"
              ondragstart="event.dataTransfer.setData('text/plain','${ch.id}')"
              onclick="WritingStudio.pickT2Chip('${ch.id}')">${esc(ch.text)}</button>
          `).join('')}
        </div>
      `;
    } else {
      const sents = mod.sentences || [];
      const aud = examState.t3Audit;
      bodyHtml = `
        <div class="ws-modal-head">
          <div style="font-size:16px;font-weight:700;">Test 3 · Tự viết &amp; Soi đúng cấu trúc</div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${!examState.t3Finalized
              ? `<button type="button" class="btn btn-primary" onclick="WritingStudio.submitTaskTest3()">${aud ? `Nộp lại câu đỏ (còn ${examState.t3RetriesLeft} lượt)` : 'Nộp bài & Soi Grammar'}</button>`
              : `<button type="button" class="btn btn-primary" onclick="WritingStudio.closeTaskExamModal(true)">Hoàn tất Task ✓</button>`}
          </div>
        </div>
        <div class="ws-t3-head-row">
          <div class="ws-col-lbl">Khung ý tiếng Việt</div>
          <div class="ws-col-lbl">Bài viết tiếng Anh từng câu</div>
        </div>
        <div class="ws-t3-pairs">
          ${sents.map((s, idx) => {
            const lockedOk = Boolean(examState.t3LockedOk[idx]);
            const rowAud = aud ? aud[idx] : null;
            const cls = lockedOk ? 'is-ok' : (rowAud && !rowAud.pass ? 'is-bad' : '');
            return `
              <div class="ws-t3-pair-row">
                <div class="ws-vi-row"><strong>[0${idx + 1}]</strong><span>${esc(s.vi)}</span></div>
                <div class="ws-sent-input-wrap">
                  <textarea class="ws-sent-textarea ${cls}" id="ws-t3-in-${idx}" ${lockedOk || examState.t3Finalized ? 'readonly' : ''}
                    placeholder="[0${idx + 1}] Tự viết câu tiếng Anh chuẩn Flow, Grammar và Vocab..."
                    oninput="WritingStudio.saveT3Draft(${idx}, this.value)"
                    onpaste="event.preventDefault(); WritingStudio.toastMsg('Không được dán bài — hãy tự viết trực tiếp!');">${esc(examState.t3Drafts[idx] || '')}</textarea>
                  ${rowAud ? `
                    <div class="ws-chk-tags">
                      ${rowAud.gHits.map((x) => `<span class="ws-chk-tag ${x.ok ? 'ok' : 'miss'}">${x.ok ? '✓' : '✕'} Grammar: ${esc(x.k)}</span>`).join('')}
                      ${rowAud.vHits.map((x) => `<span class="ws-chk-tag ${x.ok ? 'ok' : 'miss'}">${x.ok ? '✓' : '✕'} Vocab: ${esc(x.k)}</span>`).join('')}
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
        ${examState.t3Finalized ? `
          <div class="ws-key-box">
            <div style="font-size:14px;font-weight:700;color:var(--ok);">Kết quả Task: Band ${Number(examState.finalBand || 7.5).toFixed(1)} · Đối chiếu Đáp án chuẩn Band 8.5+</div>
            ${sents.map((s, idx) => `
              <div class="ws-key-row">
                <span class="ws-key-en">[0${idx + 1}] ${esc(s.enKey)}</span>
                <span>${esc(s.vi)}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      `;
    }

    card.innerHTML = `
      <div class="ws-modal-head" style="padding-bottom:10px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn" style="padding:6px 11px;" onclick="WritingStudio.requestExitTaskExam()">←</button>
          <div class="ws-modal-title">${esc(mod.code)} · ${esc(mod.title)}</div>
        </div>
        <div class="ws-step-pills">
          <span class="ws-step-pill ${stage === 1 ? 'active' : 'done'}">Test 1 · Idea Flow</span>
          <span class="ws-step-pill ${stage === 2 ? 'active' : (stage > 2 ? 'done' : '')}">Test 2 · Grammar</span>
          <span class="ws-step-pill ${stage === 3 ? 'active' : ''}">Test 3 · Writing</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${teacherJump}
          <span class="ws-pill" id="ws-exam-timer">${timerText}</span>
        </div>
      </div>
      ${bodyHtml}
    `;
  }

  function teacherJumpExam(stageNum) {
    if (!examState || !isTeacherBypass()) return;
    examState.stage = stageNum;
    if (stageNum === 2) { examState.t2Idx = 0; setupT2Sentence(); }
    renderExamModal();
  }

  /* Test 1 handlers */
  function setT1Picked(id) { if (examState) examState.t1Picked = id; }
  function pickT1Chip(id) {
    if (!examState) return;
    examState.t1Picked = examState.t1Picked === id ? null : id;
    renderExamModal();
  }
  function placeT1(id, slotIdx) {
    if (!examState) return;
    const idx = examState.t1Bank.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const [moved] = examState.t1Bank.splice(idx, 1);
    if (examState.t1Slots[slotIdx]) examState.t1Bank.push(examState.t1Slots[slotIdx]);
    examState.t1Slots[slotIdx] = moved;
    examState.t1Picked = null;
    renderExamModal();
  }
  function dropT1(e, slotIdx) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || examState?.t1Picked;
    if (id) placeT1(id, slotIdx);
  }
  function clickT1Slot(slotIdx) {
    if (!examState) return;
    if (examState.t1Picked) {
      placeT1(examState.t1Picked, slotIdx);
    } else if (examState.t1Slots[slotIdx]) {
      examState.t1Bank.push(examState.t1Slots[slotIdx]);
      examState.t1Slots[slotIdx] = null;
      renderExamModal();
    }
  }
  function checkTaskTest1() {
    if (!examState) return;
    if (examState.t1Slots.some((s) => !s)) {
      toast('Hãy xếp đủ toàn bộ các mắt xích trước khi kiểm tra.');
      return;
    }
    const ok = examState.t1Slots.every((s, idx) => s.order === idx);
    renderExamModal(true);
    if (ok) {
      toast('Mạch Idea Flow chính xác 100%! Chuyển sang Test 2.');
      setTimeout(() => {
        if (!examState) return;
        examState.stage = 2;
        examState.t2Idx = 0;
        setupT2Sentence();
        renderExamModal();
      }, 650);
    } else {
      toast('Sai thứ tự mắt xích Flow! Xáo lại từ đầu để làm lại.');
      setTimeout(() => resetT1(), 1000);
    }
  }

  /* Test 2 handlers */
  function placeT2(chipId, blankIdx) {
    if (!examState) return;
    const idx = examState.t2Bank.findIndex((c) => c.id === chipId);
    if (idx === -1) return;
    const [moved] = examState.t2Bank.splice(idx, 1);
    if (examState.t2Slots[blankIdx]) examState.t2Bank.push(examState.t2Slots[blankIdx]);
    examState.t2Slots[blankIdx] = moved;
    const nxt = examState.t2Slots.findIndex((s) => !s);
    examState.t2ActiveBlank = nxt !== -1 ? nxt : blankIdx;
    renderExamModal();
  }
  function pickT2Chip(chipId) {
    if (!examState) return;
    const target = examState.t2Slots[examState.t2ActiveBlank] ? examState.t2Slots.findIndex((s) => !s) : examState.t2ActiveBlank;
    placeT2(chipId, target !== -1 ? target : examState.t2ActiveBlank);
  }
  function dropT2(e, blankIdx) {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain');
    if (id) placeT2(id, blankIdx);
  }
  function clickT2Blank(blankIdx) {
    if (!examState) return;
    if (examState.t2Slots[blankIdx]) {
      examState.t2Bank.push(examState.t2Slots[blankIdx]);
      examState.t2Slots[blankIdx] = null;
    }
    examState.t2ActiveBlank = blankIdx;
    renderExamModal();
  }
  function checkTaskTest2() {
    if (!examState) return;
    const s = examState.mod.sentences[examState.t2Idx];
    const blanks = (s.builder?.parts || []).filter((p) => typeof p === 'object');
    if (examState.t2Slots.some((x) => !x)) {
      toast('Hãy điền đủ tất cả các ô trống trong khung câu.');
      return;
    }
    const ok = blanks.every((bl, i) => examState.t2Slots[i]?.text === bl.ans);
    renderExamModal(true);
    if (ok) {
      if (examState.t2Idx + 1 < examState.mod.sentences.length) {
        toast('Chuẩn cấu trúc! Sang câu tiếp theo.');
        setTimeout(() => {
          if (!examState) return;
          examState.t2Idx++;
          setupT2Sentence();
          renderExamModal();
        }, 550);
      } else {
        toast('Hoàn thành 100% Test 2! Mở khóa Test 3 Viết thực chiến.');
        setTimeout(() => {
          if (!examState) return;
          examState.stage = 3;
          renderExamModal();
        }, 650);
      }
    } else {
      toast('Có mảnh bị sai dạng từ / ngữ pháp (ô đỏ) — bấm ô đỏ để sửa lại!');
    }
  }

  /* Test 3 handlers (Layer 1 Mandatory Structure Audit + Retry Gate -> Layer 2 Band & Key Compare) */
  function saveT3Draft(idx, val) {
    if (examState) examState.t3Drafts[idx] = val;
  }

  function submitTaskTest3() {
    if (!examState || examState.t3Finalized) return;
    const sents = examState.mod.sentences || [];
    const emptyIdx = sents.findIndex((_, i) => String(examState.t3Drafts[i] || '').trim().split(/\s+/).filter(Boolean).length < 4);
    if (!isTeacherBypass() && emptyIdx !== -1) {
      toast(`Câu [0${emptyIdx + 1}] đang quá ngắn — hãy tự viết đủ ý trước khi nộp.`);
      document.getElementById(`ws-t3-in-${emptyIdx}`)?.focus();
      return;
    }

    const audit = sents.map((s, idx) => {
      const txt = String(examState.t3Drafts[idx] || '').toLowerCase();
      const gHits = (s.mustGrammar || []).map((k) => ({ k, ok: txt.includes(k.toLowerCase()) }));
      const vHits = (s.mustVocab || []).map((k) => ({ k, ok: txt.includes(k.toLowerCase()) }));
      const gOk = gHits.length === 0 || gHits.some((x) => x.ok);
      const vOk = vHits.length === 0 || vHits.some((x) => x.ok);
      const pass = isTeacherBypass() || (gOk && vOk && txt.split(/\s+/).filter(Boolean).length >= 7);
      if (pass) examState.t3LockedOk[idx] = true;
      return { pass, gHits, vHits };
    });

    examState.t3Audit = audit;
    const passedCount = audit.filter((a) => a.pass).length;

    if (passedCount < sents.length && examState.t3RetriesLeft > 0 && !isTeacherBypass()) {
      examState.t3RetriesLeft--;
      renderExamModal();
      toast(`Đạt ${passedCount}/${sents.length} câu! Hãy viết lại các câu màu đỏ theo đúng Grammar & Vocab (còn ${examState.t3RetriesLeft + 1} lượt).`);
      return;
    }

    // Finalize & score!
    const ratio = passedCount / Math.max(1, sents.length);
    const band = Math.round((5.5 + ratio * 3.0) * 2) / 2;
    examState.finalBand = band;
    examState.t3Finalized = true;
    clearInterval(examState.timerId);

    const prog = getTaskProgMap();
    prog[examState.mod.id] = {
      status: 'completed',
      score: passedCount,
      total: sents.length,
      band,
      completedAt: Date.now()
    };
    saveTaskProgMap(prog);
    B()?.syncExamLock?.(false);
    renderExamModal();
    toast(`Hoàn thành Task ${examState.mod.code} · Band ${band.toFixed(1)}! Đã mở Đáp án chuẩn Band 8.5+.`);
  }

  function requestExitTaskExam() {
    if (!examState) return;
    if (isTeacherBypass() || examState.t3Finalized) {
      closeTaskExamModal(true);
      return;
    }
    showAntiCheatModal(
      'CẢNH BÁO THOÁT GIỮA CHỪNG',
      'Bạn đang làm bài Test Task Writing. Nếu thoát lúc này, toàn bộ kết quả Test sẽ bị hủy và tài khoản bị khóa Task 30 phút.',
      false,
      () => {
        setLockout(TASK_LOCK_KEY_BASE, 'Thoát bài Test Task giữa chừng');
        closeTaskExamModal(true);
      }
    );
  }

  function closeTaskExamModal(silent) {
    if (examState?.timerId) clearInterval(examState.timerId);
    examState = null;
    document.getElementById('ws-task-exam-modal')?.classList.remove('open');
    B()?.syncExamLock?.(false);
    if (silent) {
      state.activeTaskModId = null;
      const tabsEl = document.getElementById('inline-task-suites');
      const gridEl = document.getElementById('inline-tasks-grid');
      if (document.documentElement.getAttribute('data-skill') === 'writing') {
        renderTaskHub(tabsEl, gridEl);
        renderFlashcardWorkspace();
      }
    }
  }

  /* ================= PRACTICE HUB (57 REAL PROMPTS · PRACTICE vs EXAM 40M) ================= */
  function classifyPromptType(typeStr) {
    const t = String(typeStr || '').toLowerCase();
    if (t.includes('two-part') || t.includes('two part')) return 'twopart';
    if (t.includes('discuss')) return 'discuss';
    if (t.includes('advantage')) return 'advantage';
    if (t.includes('cause') || t.includes('problem') || t.includes('solution')) return 'cause';
    if (t.includes('agree') || t.includes('opinion') || t.includes('positive') || t.includes('negative')) return 'opinion';
    return 'opinion';
  }

  function cleanPromptParaphrases(p) {
    const bodySet = new Set((p?.bodyGuide || []).map((x) => normStr(x)));
    return (p?.paraphrases || []).filter((item) => {
      const n = normStr(item);
      if (!n) return false;
      if (n.startsWith('hướng dẫn ráp body')) return false;
      if (bodySet.has(n)) return false;
      return true;
    });
  }

  function renderPracticeHub() {
    ensureOverlays();
    const root = document.getElementById('wp-app-root');
    if (!root) return;
    const prompts = DATA().PRACTICE_PROMPTS || [];
    const subtopics = DATA().SUBTOPICS || [];
    const subMap = {};
    subtopics.forEach((st) => { subMap[st.key] = st.shortTitle || st.title; });
    const q = normStr(state.pracQuery);

    const filtered = prompts.filter((p) => {
      if (state.pracSubtopic !== 'all' && p.subtopic !== state.pracSubtopic) return false;
      if (state.pracType !== 'all' && classifyPromptType(p.type) !== state.pracType) return false;
      if (q) {
        const hay = normStr(`${p.prompt || ''} ${p.review || ''} ${p.type || ''} ${subMap[p.subtopic] || ''}`);
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const hist = getPracticeHist();
    const doneSet = new Set(hist.map((h) => h.promptId));

    const typeFilters = [
      { key: 'all', label: 'Tất cả dạng đề' },
      { key: 'opinion', label: 'Opinion / Agree' },
      { key: 'discuss', label: 'Discussion' },
      { key: 'advantage', label: 'Advantages / Disadv.' },
      { key: 'cause', label: 'Causes & Solutions' },
      { key: 'twopart', label: 'Two-part Question' }
    ];

    const activeSearchFocused = document.activeElement?.id === 'ws-prac-search-input';
    const selStart = activeSearchFocused ? document.activeElement.selectionStart : null;

    root.innerHTML = `
      <div class="tot-section-shell ink-brackets">
        <div class="tot-shell-head">
          <div>
            <h2 class="tot-shell-title">Luyện Đề IELTS Writing Task 2</h2>
            <p class="tot-shell-sub">Ngân hàng ${prompts.length} đề thi thật (2020–2026) liên kết trực tiếp với 44 Module Flow Idea.</p>
          </div>
          <span class="ws-pill tabular">${doneSet.size} / ${prompts.length} đề đã luyện</span>
        </div>

        <div class="ws-prac-toolbar">
          <div class="ws-prac-toolbar-top">
            <div class="ws-prac-subtabs" role="tablist" aria-label="Lọc theo Subtopic">
              <button type="button" class="ws-prac-subtab ${state.pracSubtopic === 'all' ? 'active' : ''}" onclick="WritingStudio.setPracSubtopic('all')">Tất cả (${prompts.length})</button>
              ${subtopics.map((st) => {
                const cnt = prompts.filter((p) => p.subtopic === st.key).length;
                return `<button type="button" class="ws-prac-subtab ${state.pracSubtopic === st.key ? 'active' : ''}" onclick="WritingStudio.setPracSubtopic('${esc(st.key)}')">${esc(st.shortTitle)} (${cnt})</button>`;
              }).join('')}
            </div>

            <div class="ws-prac-search-wrap">
              <svg class="ws-prac-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="ws-prac-search-input" class="ws-prac-search" placeholder="Tìm đề Writing..." value="${esc(state.pracQuery)}" oninput="WritingStudio.setPracQuery(this.value)" />
            </div>
          </div>

          <div class="ws-prac-typebar">
            <div class="ws-prac-type-pills">
              ${typeFilters.map((tf) => `
                <button type="button" class="ws-type-filter-btn ${state.pracType === tf.key ? 'active' : ''}" onclick="WritingStudio.setPracType('${tf.key}')">${tf.label}</button>
              `).join('')}
            </div>
            <span class="ws-prac-count">Hiển thị ${filtered.length} / ${prompts.length} đề</span>
          </div>
        </div>

        <div class="ws-prac-grid">
          ${filtered.length ? filtered.map((p) => {
            const tCat = classifyPromptType(p.type);
            const tCls = tCat === 'opinion' ? 'is-opinion' : (tCat === 'discuss' ? 'is-discuss' : (tCat === 'advantage' ? 'is-adv' : (tCat === 'twopart' ? 'is-twopart' : 'is-cause')));
            const isDone = doneSet.has(p.id);
            return `
              <article class="ws-prac-card ${isDone ? 'is-done' : ''}">
                <div style="display:flex;flex-direction:column;gap:10px;">
                  <div class="ws-prac-head">
                    <span class="ws-type-pill ${tCls}">${esc(p.type)}</span>
                    ${isDone ? '<span class="ws-pill ok">Đã luyện ✓</span>' : `<span class="ws-prac-sub-tag">${esc(subMap[p.subtopic] || '')}</span>`}
                  </div>
                  <p class="ws-prac-prompt">${esc(p.prompt)}</p>
                  ${p.review ? `<p class="ws-prac-review">${esc(p.review)}</p>` : ''}
                </div>
                <div class="ws-prac-foot">
                  <div class="ws-prac-meta-row">
                    <span>Task 2 · 40 phút · 250+ từ</span>
                    ${isDone ? `<span style="color:var(--ok);">${esc(subMap[p.subtopic] || '')}</span>` : ''}
                  </div>
                  <div class="ws-prac-btns">
                    <button type="button" class="btn" style="padding:8px 10px;font-size:12.5px;" onclick="WritingStudio.startPracticePrompt('${esc(p.id)}', 'practice')">Luyện tập</button>
                    <button type="button" class="btn btn-primary" style="padding:8px 10px;font-size:12.5px;" onclick="WritingStudio.startPracticePrompt('${esc(p.id)}', 'exam')">Thi thật</button>
                  </div>
                </div>
              </article>
            `;
          }).join('') : `
            <div class="ws-prac-empty">
              <div style="font-size:14.5px;font-weight:750;color:var(--ink);">Không tìm thấy đề phù hợp</div>
              <div style="font-size:12.5px;">Hãy thử từ khóa khác hoặc đặt lại bộ lọc dạng đề.</div>
              <button type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;" onclick="WritingStudio.resetPracFilters()">Xóa bộ lọc</button>
            </div>
          `}
        </div>
      </div>
    `;

    if (activeSearchFocused) {
      const inp = document.getElementById('ws-prac-search-input');
      if (inp) {
        inp.focus();
        if (typeof selStart === 'number') inp.setSelectionRange(selStart, selStart);
      }
    }
  }

  function setPracSubtopic(v) { state.pracSubtopic = v; renderPracticeHub(); }
  function setPracType(v) { state.pracType = v; renderPracticeHub(); }
  function setPracQuery(v) { state.pracQuery = String(v || ''); renderPracticeHub(); }
  function resetPracFilters() { state.pracSubtopic = 'all'; state.pracType = 'all'; state.pracQuery = ''; renderPracticeHub(); }

  function startPracticePrompt(promptId, mode) {
    ensureOverlays();
    if (mode === 'exam') {
      const lock = getLockout(PRAC_LOCK_KEY_BASE);
      if (lock) {
        showAntiCheatModal('TẠM KHÓA PHÒNG THI WRITING', `Phòng thi thật đang bị tạm khóa. Mở lại sau ${fmtMmSs(lock.remainingMs / 1000)}.`, true);
        return;
      }
    }
    const p = (DATA().PRACTICE_PROMPTS || []).find((x) => x.id === promptId);
    if (!p) return;

    pracState = {
      prompt: p,
      mode, // Fixed upfront: 'practice' | 'exam'
      secsLeft: 40 * 60,
      startedAt: Date.now(),
      strikes: 0,
      submitted: false,
      timerId: null
    };

    const isExam = mode === 'exam';
    const paras = cleanPromptParaphrases(p);
    const bodyGuides = p.bodyGuide || [];
    const subObj = (DATA().SUBTOPICS || []).find((s) => s.key === p.subtopic);

    const practiceHintsHtml = !isExam && (bodyGuides.length || paras.length || p.review) ? `
      <details class="ws-exam-hint-details">
        <summary>Gợi ý dàn ý &amp; Paraphrase (Chỉ hiện ở chế độ Luyện tập)</summary>
        <div class="ws-exam-hint-body">
          ${p.review ? `<div><strong>Chiến lược lập luận:</strong> ${esc(p.review)}</div>` : ''}
          ${bodyGuides.length ? `
            <div>
              <strong>Hướng dẫn ráp Body:</strong>
              <ul class="ws-exam-hint-list">${bodyGuides.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
            </div>
          ` : ''}
          ${paras.length ? `
            <div>
              <strong>Paraphrase đề thi:</strong>
              <ul class="ws-exam-hint-list">${paras.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
            </div>
          ` : ''}
        </div>
      </details>
    ` : '';

    const room = document.getElementById('ws-practice-room');
    room.className = `ws-exam-room open ${isExam ? 'is-exam' : 'is-practice'}`;
    room.innerHTML = `
      <div class="ws-exam-bar">
        <div class="ws-exam-bar-left">
          <button type="button" class="btn" style="padding:6px 12px;font-size:12.5px;" onclick="WritingStudio.requestExitPractice()">← Thoát</button>
          <span class="ws-exam-mode-badge ${isExam ? 'is-exam' : 'is-practice'}">
            ${isExam ? 'THI THẬT · ANTI-CHEAT' : 'LUYỆN TẬP · WRITING STUDIO'}
          </span>
          ${subObj ? `<span style="font-size:12.5px;font-weight:650;opacity:0.78;">${esc(subObj.shortTitle)}</span>` : ''}
        </div>
        <div class="ws-exam-bar-right">
          <span id="ws-prac-wc" class="ws-exam-wc-pill">0 / 250 words</span>
          <span id="ws-prac-timer" class="ws-exam-timer-pill">40:00</span>
          <button type="button" class="btn btn-primary" id="ws-prac-submit" style="padding:7px 16px;font-size:13px;" onclick="WritingStudio.submitPracticeEssay(false)">Nộp bài</button>
        </div>
      </div>
      <div class="ws-exam-split">
        <div class="ws-exam-left">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <span class="ws-exam-part-lbl">IELTS WRITING TASK 2</span>
            <span class="ws-type-pill is-${classifyPromptType(p.type)}">${esc(p.type)}</span>
          </div>
          <div class="ws-exam-prompt-box">
            <p class="ws-exam-prompt-text">${esc(p.prompt)}</p>
            <ul class="ws-exam-instructions">
              <li>You should spend about <strong>40 minutes</strong> on this task.</li>
              <li>Give reasons for your answer and include any relevant examples from your own knowledge or experience.</li>
              <li>Write at least <strong>250 words</strong>.</li>
            </ul>
          </div>
          ${practiceHintsHtml}
        </div>
        <div class="ws-exam-right">
          <div class="ws-exam-editor-head">
            <span>BÀI VIẾT CỦA BẠN</span>
            <span id="ws-prac-wc-note">Mục tiêu tối thiểu: 250 từ</span>
          </div>
          <textarea class="ws-exam-textarea" id="ws-prac-editor" placeholder="Bắt đầu viết bài IELTS Writing Task 2 tại đây..."
            oninput="WritingStudio.updatePracWC()"
            onpaste="${!isTeacherBypass() ? "event.preventDefault(); WritingStudio.toastMsg('Không được dán bài trong phòng viết!');" : ''}"></textarea>
          <div id="ws-prac-result" class="ws-exam-result-card"></div>
        </div>
      </div>
    `;

    pracState.timerId = setInterval(() => {
      if (!pracState || pracState.submitted) return;
      pracState.secsLeft--;
      const el = document.getElementById('ws-prac-timer');
      if (el) {
        el.textContent = fmtMmSs(pracState.secsLeft);
        el.classList.toggle('urgent', pracState.secsLeft <= 300);
      }
      if (pracState.secsLeft <= 0) submitPracticeEssay(true);
    }, 1000);
  }

  function updatePracWC() {
    const v = (document.getElementById('ws-prac-editor')?.value || '').trim();
    const wc = v ? v.split(/\s+/).length : 0;
    const el = document.getElementById('ws-prac-wc');
    const note = document.getElementById('ws-prac-wc-note');
    if (el) {
      el.textContent = wc >= 250 ? `${wc} / 250 words ✓` : `${wc} / 250 words`;
      el.classList.toggle('is-ok', wc >= 250);
      el.classList.toggle('is-mid', wc >= 160 && wc < 250);
    }
    if (note) {
      note.textContent = wc >= 250
        ? `Đạt chuẩn độ dài (+${wc - 250} từ)`
        : `Còn thiếu ${250 - wc} từ để đạt mốc 250 từ`;
    }
  }

  function submitPracticeEssay(forced) {
    if (!pracState || pracState.submitted) return;
    const essay = (document.getElementById('ws-prac-editor')?.value || '').trim();
    const wc = essay ? essay.split(/\s+/).length : 0;
    if (!forced && !isTeacherBypass() && wc < 30) {
      toast('Hãy viết ít nhất 30 từ trước khi nộp bài.');
      return;
    }
    pracState.submitted = true;
    clearInterval(pracState.timerId);
    const editor = document.getElementById('ws-prac-editor');
    if (editor) editor.readOnly = true;

    const estBand = wc >= 250 ? 7.0 : (wc >= 160 ? 6.0 : 5.0);
    const hist = getPracticeHist();
    hist.unshift({
      promptId: pracState.prompt.id,
      type: pracState.prompt.type,
      prompt: pracState.prompt.prompt,
      mode: pracState.mode,
      wordCount: wc,
      band: estBand,
      completedAt: Date.now()
    });
    savePracticeHist(hist);

    const p = pracState.prompt;
    const paras = cleanPromptParaphrases(p);
    const box = document.getElementById('ws-prac-result');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = `
        <div style="font-weight:800;color:var(--ok,#2F6E49);margin-bottom:10px;">Đã nộp bài (${wc} từ) · Hướng dẫn Flow &amp; Paraphrase chuẩn giáo trình</div>
        ${p.bodyGuide?.length ? `<div style="margin-bottom:8px;"><strong>Hướng dẫn ráp Body:</strong><ul class="ws-exam-hint-list">${p.bodyGuide.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}
        ${paras.length ? `<div><strong>Paraphrase đề thi:</strong><ul class="ws-exam-hint-list">${paras.map((g) => `<li>${esc(g)}</li>`).join('')}</ul></div>` : ''}
      `;
    }
    renderPracticeHub();
  }

  function requestExitPractice() {
    if (!pracState) return;
    if (pracState.submitted || isTeacherBypass()) {
      closePracticeRoom();
      return;
    }
    // Locked rule: No resumable drafts — exiting ends & grades immediately!
    submitPracticeEssay(true);
    setTimeout(() => closePracticeRoom(), 400);
  }

  function closePracticeRoom() {
    if (pracState?.timerId) clearInterval(pracState.timerId);
    pracState = null;
    document.getElementById('ws-practice-room')?.classList.remove('open');
  }

  /* ================= ANTI-CHEAT HANDLER ================= */
  function handleGlobalAntiCheatLeave(reason) {
    if (isTeacherBypass()) return;

    if (recallState && !recallState.done) {
      failRecall(`Rời màn hình khi đang Kiểm tra nhớ từ (${reason})`);
      return;
    }
    if (examState && !examState.t3Finalized) {
      examState.strikes++;
      if (examState.strikes >= 3) {
        setLockout(TASK_LOCK_KEY_BASE, `Vi phạm 3/3 (${reason})`);
        closeTaskExamModal(true);
        showAntiCheatModal('VI PHẠM 3/3 · KHÓA 30 PHÚT', `Hệ thống ghi nhận vi phạm 3/3 (${reason}). Bài làm Task đã kết thúc và tạm khóa 30 phút. Vui lòng liên hệ giáo viên để mở khóa.`, true);
      } else {
        showAntiCheatModal(`CẢNH CÁO ${examState.strikes}/3`, `Không rời khỏi màn hình khi đang làm Test (${reason}). Vi phạm lần 3/3 sẽ kết thúc bài và khóa 30 phút.`, false);
      }
      return;
    }
    if (pracState && !pracState.submitted && pracState.mode === 'exam') {
      pracState.strikes++;
      if (pracState.strikes >= 2) {
        // Locked rule: keep current answers, grade immediately, lock 30 minutes!
        submitPracticeEssay(true);
        setLockout(PRAC_LOCK_KEY_BASE, `Vi phạm 2/2 (${reason})`);
        closePracticeRoom();
        showAntiCheatModal('VI PHẠM 2/2 · KHÓA 30 PHÚT', `Hệ thống ghi nhận vi phạm 2/2 (${reason}). Bài viết của bạn được giữ nguyên để chấm điểm, lượt thi đã kết thúc và tạm khóa 30 phút.`, true);
      } else {
        showAntiCheatModal('CẢNH CÁO 1/2', `Không chuyển tab khi đang thi thật (${reason}). Vi phạm thêm 1 lần nữa bài làm sẽ kết thúc ngay và khóa 30 phút.`, false);
      }
    }
  }

  function showAntiCheatModal(title, desc, isLock, onConfirmAction) {
    ensureOverlays();
    const card = document.getElementById('ws-ac-card');
    window._wsAcConfirmCb = onConfirmAction || null;
    card.innerHTML = `
      <div class="ws-modal-head">
        <div class="ws-modal-title" style="color:${isLock ? 'var(--danger)' : 'var(--streak)'};">${esc(title)}</div>
      </div>
      <p style="font-size:14px;line-height:1.6;color:var(--ink);text-align:left;">${esc(desc)}</p>
      <div style="display:flex;justify-content:flex-end;gap:10px;">
        ${onConfirmAction
          ? `<button type="button" class="btn" onclick="WritingStudio.closeAcModal()">Quay lại làm bài</button>
             <button type="button" class="btn btn-primary" style="background:var(--danger);border-color:var(--danger);" onclick="WritingStudio.confirmAcModal()">Xác nhận thoát</button>`
          : `<button type="button" class="btn btn-primary" onclick="WritingStudio.closeAcModal()">Đã hiểu</button>`}
      </div>
    `;
    document.getElementById('ws-ac-modal').classList.add('open');
  }
  function closeAcModal() {
    window._wsAcConfirmCb = null;
    document.getElementById('ws-ac-modal')?.classList.remove('open');
  }
  function confirmAcModal() {
    const cb = window._wsAcConfirmCb;
    closeAcModal();
    if (typeof cb === 'function') cb();
  }

  /* ================= WRITING HOME PANEL ================= */
  function getOverallStats() {
    const mods = DATA().MODULES || [];
    const mmap = getMasteryMap();
    const tprog = getTaskProgMap();
    const phist = getPracticeHist();
    let totalCards = 0;
    let masteredCards = 0;
    mods.forEach((m) => {
      const cs = buildModuleCards(m);
      totalCards += cs.length;
      masteredCards += cs.filter((c) => mmap[c.id]?.level === 3).length;
    });
    const tasksDone = mods.filter((m) => tprog[m.id]?.status === 'completed').length;
    return {
      masteredCards,
      totalCards,
      cardPct: Math.round((masteredCards / Math.max(1, totalCards)) * 100),
      tasksDone,
      tasksTotal: mods.length,
      taskPct: Math.round((tasksDone / Math.max(1, mods.length)) * 100),
      practiceDone: phist.length,
      practiceTotal: (DATA().PRACTICE_PROMPTS || []).length
    };
  }

  function renderWritingHomePanel(el) {
    if (!el) return;
    const st = getOverallStats();
    const subtopics = DATA().SUBTOPICS || [];
    const tprog = getTaskProgMap();
    const hist = getPracticeHist();

    const barsHtml = subtopics.map((s) => {
      const sMods = (DATA().MODULES || []).filter((m) => m.subtopic === s.key);
      const done = sMods.filter((m) => tprog[m.id]?.status === 'completed').length;
      const pct = Math.round((done / Math.max(1, sMods.length)) * 100);
      return `
        <div class="rh-deck-row">
          <div class="rh-deck-meta"><span>${esc(s.shortTitle)}</span><strong class="tabular">${done}/${sMods.length}</strong></div>
          <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');

    const stRowsHtml = subtopics.map((s, idx) => {
      const sMods = (DATA().MODULES || []).filter((m) => m.subtopic === s.key);
      const done = sMods.filter((m) => tprog[m.id]?.status === 'completed').length;
      const pct = Math.round((done / Math.max(1, sMods.length)) * 100);
      return `
        <div class="ws-home-st-row" onclick="WritingStudio.openSubtopicFromHome('${esc(s.key)}')">
          <span class="ws-home-st-idx">0${idx + 1}</span>
          <div class="ws-home-st-main">
            <div class="ws-home-st-title">${esc(s.title)}</div>
            <div class="ws-home-st-desc">${esc(s.desc)}</div>
          </div>
          <div class="ws-home-st-right">
            <div class="ws-home-st-prog">
              <span class="ws-pill tabular">${done} / ${sMods.length}</span>
              <div class="ws-home-st-bar"><span style="width:${pct}%"></span></div>
            </div>
            <button type="button" class="tot-foot-btn">Học ngay →</button>
          </div>
        </div>
      `;
    }).join('');

    const histHtml = hist.length
      ? hist.slice(0, 4).map((h) => `
          <div class="rh-hist-item">
            <div style="flex:1;min-width:0;">
              <div class="rh-hist-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h.prompt)}</div>
              <div class="rh-hist-meta">${esc(h.type)} · ${h.wordCount} words · ${h.mode === 'exam' ? 'Thi thật' : 'Luyện tập'}</div>
            </div>
            <span class="tot-hist-badge tabular">${h.wordCount}w</span>
          </div>
        `).join('')
      : '<div class="rh-empty">Chưa có bài Writing nào được nộp. Chọn một Subtopic bên dưới để bắt đầu học Flow &amp; làm Task.</div>';

    el.innerHTML = `
      <div class="rh-layout">
        <div class="rh-top-asym">
          <div class="tot-hero-card ink-brackets has-stamp rh-main-hero">
            <div class="rh-hero-copy">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Writing</h2>
                  <div class="tot-shell-sub tabular">${st.masteredCards} / ${st.totalCards} thẻ · ${st.tasksDone} / ${st.tasksTotal} Tasks · ${st.practiceDone} / ${st.practiceTotal} Đề</div>
                </div>
              </div>
              <div class="rh-decks-grid-4" style="grid-template-columns:repeat(3,minmax(0,1fr));">${barsHtml}</div>
              <div class="rh-hero-actions" style="margin-top:12px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Writing', 'flashcard')">Học Flashcard →</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Writing', 'task')">${st.tasksTotal} Tasks</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Writing', 'practice')">Kho đề Task 2</button>
              </div>
            </div>
          </div>

          <div class="tot-home-panel ink-brackets rh-band-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Tiến độ Writing</div>
                <div class="tot-panel-sub tabular">${st.tasksDone} / ${st.tasksTotal} Module Idea hoàn thành</div>
              </div>
              <span class="rh-band-big tabular">${st.cardPct}%</span>
            </div>
            <div class="ws-home-kpi-strip">
              <div class="ws-home-kpi"><span class="ws-home-kpi-val">${st.masteredCards}/${st.totalCards}</span><span class="ws-home-kpi-lbl">Thẻ thuộc</span></div>
              <div class="ws-home-kpi"><span class="ws-home-kpi-val">${st.tasksDone}/${st.tasksTotal}</span><span class="ws-home-kpi-lbl">Task xong</span></div>
              <div class="ws-home-kpi"><span class="ws-home-kpi-val">${st.practiceDone}/${st.practiceTotal}</span><span class="ws-home-kpi-lbl">Đề đã viết</span></div>
            </div>
            <div class="rh-hist-list">${histHtml}</div>
            <div class="tot-panel-foot" style="margin-top:auto;">
              <span class="tot-foot-meta">${st.practiceTotal} đề thi thật Task 2 (2020–2026)</span>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Writing', 'practice')">Kho đề →</button>
            </div>
          </div>
        </div>

        <div class="tot-home-panel ink-brackets">
          <div class="tot-panel-head">
            <div>
              <div class="tot-panel-title">Lộ trình Subtopic · Work &amp; Employment</div>
              <div class="tot-panel-sub">Flow Ideas · Grammar · Paraphrase · 3-Step Task</div>
            </div>
            <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Writing', 'task')">Tất cả Task →</button>
          </div>
          <div class="ws-home-st-list">${stRowsHtml}</div>
        </div>
      </div>
    `;
  }

  function openSubtopicFromHome(stKey) {
    const first = (DATA().MODULES || []).find((m) => m.subtopic === stKey);
    if (first) state.selectedModId = first.id;
    state.taskHubSubtopic = stKey;
    window.TotoroUI?.enterSkillMode?.('Writing', 'flashcard');
  }

  function openSummaryModal() {
    const st = getOverallStats();
    showAntiCheatModal(
      'THỐNG KÊ TIẾN ĐỘ WRITING',
      `Đã thuộc ${st.masteredCards} / ${st.totalCards} thẻ Writing (${st.cardPct}%). Hoàn thành ${st.tasksDone} / ${st.tasksTotal} Task Idea và đã nộp ${st.practiceDone} bài luyện đề Task 2.`,
      false
    );
  }

  /* Check ?wtask=... assignment link on boot */
  function checkIncomingWritingTaskParam() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const wtid = sp.get('wtask');
      if (wtid && getModById(wtid)) {
        setTimeout(() => openTask(wtid), 450);
      }
    } catch (_) {}
  }

  document.addEventListener('totoro:skill-changed', (e) => {
    const sk = String(e?.detail?.skill || '').toLowerCase();
    if (sk === 'writing') {
      renderFlashcardWorkspace();
      renderPracticeHub();
    }
  });

  window.WritingStudio = {
    renderFlashcardWorkspace,
    renderTaskHub,
    renderPracticeHub,
    renderWritingHomePanel,
    getOverallStats,
    selectModule,
    toggleModDropdown,
    closeModDropdown,
    shuffleDeck,
    openCardListModal,
    syncLiveWidgets,
    toggleUnmastered,
    flipCard,
    stepCard,
    jumpCard,
    speakCurrent,
    assessCard,
    pickRecallFlowStep,
    submitRecallTyping,
    abortRecall,
    switchTaskHubSubtopic,
    copyTaskLink,
    openTask,
    exitTaskStudyMode,
    startTaskExam,
    teacherJumpExam,
    setT1Picked,
    pickT1Chip,
    dropT1,
    clickT1Slot,
    checkTaskTest1,
    pickT2Chip,
    dropT2,
    clickT2Blank,
    checkTaskTest2,
    saveT3Draft,
    submitTaskTest3,
    requestExitTaskExam,
    closeTaskExamModal,
    answerSq,
    finishSqAndOpenTask,
    retrySq,
    closeSq,
    setPracSubtopic,
    setPracType,
    setPracQuery,
    resetPracFilters,
    startPracticePrompt,
    updatePracWC,
    submitPracticeEssay,
    requestExitPractice,
    closeAcModal,
    confirmAcModal,
    openSubtopicFromHome,
    openSummaryModal,
    toastMsg: toast,
    checkIncomingWritingTaskParam
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkIncomingWritingTaskParam);
  } else {
    checkIncomingWritingTaskParam();
  }
})();
