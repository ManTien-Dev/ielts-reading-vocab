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
  function saveTaskProgMap(m) {
    writeJson(TASK_PROG_KEY_BASE + getUid(), m);
    window.__VOCAB_BRIDGE__?.syncPushCurrentUser?.(false);
  }
  function getSpeedUnlockMap() { return readJson(SPEED_UNLOCK_KEY_BASE + getUid(), {}); }
  function saveSpeedUnlockMap(m) { writeJson(SPEED_UNLOCK_KEY_BASE + getUid(), m); }
  function getPracticeHist() { return readJson(PRAC_HIST_KEY_BASE + getUid(), []); }
  function savePracticeHist(arr) { writeJson(PRAC_HIST_KEY_BASE + getUid(), arr.slice(0, 60)); }

  function getLockout(keyBase) {
    if (isTeacherBypass()) {
      try { localStorage.removeItem(keyBase + getUid()); } catch (_) {}
      return null;
    }
    const uid = getUid();
    const info = readJson(keyBase + uid, null);
    if (!info || !info.until) return null;
    const until = Number(info.until || 0);
    const origin = until - LOCK_PENALTY_MS;
    // Respect Teacher Unlock All & Per-Task Unlock!
    try {
      const unlockAll = Number(localStorage.getItem(`ielts_teacher_unlocked_at_${uid}`) || 0);
      const perMap = readJson(`ielts_teacher_task_unlocks_v1_${uid}`, {});
      const lockKey = keyBase === PRAC_LOCK_KEY_BASE ? 'w_prac_lock' : (info.modId || 'w_task_lock');
      const perUnlock = Math.max(Number(perMap[lockKey] || 0), Number(perMap.w_task_lock || 0));
      if ((unlockAll > 0 && origin <= unlockAll) || (perUnlock > 0 && origin <= perUnlock)) {
        localStorage.removeItem(keyBase + uid);
        return null;
      }
    } catch (_) {}
    const rem = until - Date.now();
    if (rem > 0) return { ...info, remainingMs: rem };
    try { localStorage.removeItem(keyBase + uid); } catch (_) {}
    return null;
  }
  function setLockout(keyBase, reason, modId = '') {
    if (isTeacherBypass()) return null;
    const resolvedModId = modId || examState?.mod?.id || state?.activeTaskModId || state?.selectedModId || '';
    const payload = { until: Date.now() + LOCK_PENALTY_MS, reason: reason || 'Vi phạm quy chế', modId: resolvedModId };
    writeJson(keyBase + getUid(), payload);
    window.__VOCAB_BRIDGE__?.syncPushCurrentUser?.(false, { force: true });
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

  /* ================= SHORT CLEAN FLOW TITLES (NO LESSON 1.1 / NHÁNH 1 CLUTTER) ================= */
  const SHORT_FLOW_TITLES = {
    w_st01_m01: 'Causes',
    w_st01_m02: 'Effects',
    w_st01_m03: 'Solutions',
    w_st01_m04: 'Benefits',
    w_st01_m05: 'Nutrition',
    w_st01_m06: 'Physical Health',
    w_st01_m07: 'Family Communication',
    w_st01_m08: 'Family Conflict',
    w_st01_m09: "Children's Mental Health",
    w_st01_m10: 'Education & Parental Support',
    w_st01_m11: 'Crime & Juvenile Delinquency',
    w_st01_m12: 'Technology Use',
    w_st01_m13: 'Childcare',
    w_st01_m14: 'Marriage',
    w_st01_m15: 'Fertility',
    w_st02_m01: 'Salary & Financial Security',
    w_st02_m02: 'Meaningful Work & Motivation',
    w_st02_m03: 'Career Mobility & Skills',
    w_st02_m04: 'Company Loyalty & Trust',
    w_st02_m05: 'Supportive Workplace Culture',
    w_st02_m06: 'Lương cao & Cái giá Overwork',
    w_st02_m07: 'Chống làm việc quá sức',
    w_st02_m08: 'Khoảng cách lương lãnh đạo',
    w_st02_m09: 'Thu hẹp khoảng cách lương',
    w_st02_m10: 'Lệch ngành & Khoa học cơ bản',
    w_st02_m11: 'Khuyến khích khoa học cơ bản',
    w_st02_m12: 'Chảy máu chất xám',
    w_st02_m13: 'Ngăn chặn chảy máu chất xám',
    w_st02_m14: 'Đi làm sớm sau lớp 12',
    w_st02_m15: 'Phá trần sự nghiệp đi làm sớm',
    w_st03_m01: 'Convenience & Dual Productivity',
    w_st03_m02: 'Loss of Interaction & Isolation',
    w_st03_m03: 'Automation, AI & Workforce Shift',
    w_st03_m04: 'AI Limits & Human Creativity',
    w_st03_m05: 'Always-On Stress & Disconnect',
    w_st03_m06: 'Self-Employment Trade-Offs',
    w_st03_m07: 'Màn hình & Gia đình / Trẻ em',
    w_st03_m08: 'Học trực tuyến & Sách số',
    w_st03_m09: 'Rủi ro dữ liệu & Tội phạm mạng',
    w_st03_m10: 'Bảo mật dữ liệu & Chống lừa đảo',
    w_st03_m11: 'Giãn doanh nghiệp ra vùng ven'
  };

  function flowLabel(mod) {
    if (!mod) return '';
    return SHORT_FLOW_TITLES[mod.id] || mod.title || '';
  }

  /* ================= UNIFIED DECK BUILDER (OVERVIEW -> BRANCH FLOW + BRANCH VOCAB -> PARAPHRASE · NO GRAMMAR) ================= */
  function buildModuleCards(mod) {
    if (!mod) return [];
    const cards = [];
    const label = flowLabel(mod);
    const sf = mod.smartFlow || {};
    const isMultiBranch = sf.mode === 'branches' && Array.isArray(sf.rows) && sf.rows.length > 0;

    // 1. Overview Idea Flow card first (Orientation Map ONLY — NOT tested with Đã thuộc!)
    cards.push({
      id: `${mod.id}_flow`,
      modId: mod.id,
      kind: 'flow',
      untested: true,
      pos: 'IDEA FLOW',
      lesson: label,
      en: label,
      vi: (mod.viFlowSteps || []).join(' ➔ '),
      steps: mod.viFlowSteps || []
    });

    const posMapVi = { phr: 'CỤM TỪ', phrase: 'CỤM TỪ', n: 'DANH TỪ', noun: 'DANH TỪ', v: 'ĐỘNG TỪ', verb: 'ĐỘNG TỪ', adj: 'TÍNH TỪ', adv: 'TRẠNG TỪ' };
    const makeVocabCard = (v, i) => {
      const rawPos = String(v.pos || 'phr').trim().toLowerCase();
      return {
        id: `${mod.id}_v${i + 1}`,
        modId: mod.id,
        kind: 'vocab',
        pos: posMapVi[rawPos] || 'CỤM TỪ',
        lesson: label,
        en: v.en,
        vi: v.vi,
        example: v.example || '',
        viPrompt: v.viPrompt || '',
        enRef: v.enRef || '',
        trapOpts: v.trapOpts || []
      };
    };

    // 2. Multi-branch modules: Overview Vocab (-1) -> Branch Flow card -> Vocab of that exact branch!
    if (isMultiBranch) {
      const vocabs = mod.vocab || [];
      vocabs.forEach((v, i) => {
        if (v.branchIdx === -1) {
          cards.push(makeVocabCard(v, i));
        }
      });
      sf.rows.forEach((row, rIdx) => {
        cards.push({
          id: `${mod.id}_bf_${rIdx}`,
          modId: mod.id,
          kind: 'branch_flow',
          branchIdx: rIdx,
          branchTotal: sf.rows.length,
          branchRow: row,
          untested: true,
          pos: `NHÁNH ${rIdx + 1} / ${sf.rows.length}`,
          lesson: label,
          en: row.label,
          vi: ((row.detailNodes || row.nodes) || []).join(' → ')
        });
        vocabs.forEach((v, i) => {
          if ((v.branchIdx ?? 0) === rIdx) {
            cards.push(makeVocabCard(v, i));
          }
        });
      });
    } else {
      // Single-chain modules: Overview 4-station card -> all Vocab cards
      (mod.vocab || []).forEach((v, i) => {
        cards.push(makeVocabCard(v, i));
      });
    }

    // 3. Paraphrase cards at the end (if any)
    (mod.paraphrases || []).forEach((p, i) => {
      cards.push({
        id: `${mod.id}_p${i + 1}`,
        modId: mod.id,
        kind: 'paraphrase',
        pos: 'PARAPHRASE',
        lesson: label,
        en: p.en,
        vi: p.vi,
        items: p.items || [],
        accepted: p.accepted || [],
        example: p.example || '',
        viPrompt: p.viPrompt || '',
        enRef: p.enRef || '',
        trapOpts: p.trapOpts || []
      });
    });
    return cards;
  }

  function getModById(id) {
    return (DATA().MODULES || []).find((m) => m.id === id) || null;
  }

  function getLearnableCards(mod) {
    return buildModuleCards(mod).filter((c) => !c.untested);
  }

  function getModMasteryStats(mod) {
    const cards = getLearnableCards(mod);
    const mmap = getMasteryMap();
    const done = cards.filter((c) => mmap[c.id]?.level === 3).length;
    return { done, total: cards.length, pct: Math.round((done / Math.max(1, cards.length)) * 100) };
  }

  /* Fuzzy Spelling & Levenshtein Detector for Writing Accuracy (Zero False Positives on Real Words) */
  let cachedValidLexicon = null;
  function getValidEnglishLexicon() {
    if (cachedValidLexicon) return cachedValidLexicon;
    const lex = new Set();
    const addTokens = (str) => {
      const m = String(str || '').match(/[A-Za-z'-]{3,}/g);
      if (!m) return;
      for (let i = 0; i < m.length; i++) lex.add(m[i].toLowerCase());
    };
    const d = DATA();
    (d.MODULES || []).forEach((mod) => {
      addTokens(mod.title);
      (mod.sentences || []).forEach((s) => { addTokens(s.enKey); addTokens(s.grammar); });
      (mod.vocab || []).forEach((v) => { addTokens(v.en); addTokens(v.example); });
      (mod.paraphrases || []).forEach((p) => {
        addTokens(p.rootEn);
        (p.items || []).forEach((it) => addTokens(it.en));
      });
    });
    (d.PRACTICE_PROMPTS || []).forEach((p) => {
      addTokens(p.prompt);
      (p.paraphrases || []).forEach(addTokens);
    });
    if (window.IPA_DICT && typeof window.IPA_DICT === 'object') {
      Object.keys(window.IPA_DICT).forEach((k) => lex.add(k.toLowerCase()));
    }
    if (Array.isArray(window.RAW_VOCAB_DATA)) {
      window.RAW_VOCAB_DATA.forEach((it) => { addTokens(it.word); addTokens(it.example); });
    }
    const extraIeltsValid = (
      'fierce stagnant skyrocketing soaring mounting escalating pressing intense severe acute ' +
      'relentless cutthroat unspoken implicit constant perpetual prolong prolonging prolonged ' +
      'extend extending extended overtime workday burnout exhaustion fatigue decline declining ' +
      'declined refuse refusing refused dedication commitment loyalty prospects advancement ' +
      'reachable available assign assigning assigned delegate delegating delegated supplementary ' +
      'secondary essentials necessities expenses affordable unaffordable metropolitan urban ' +
      'corporate workplace employees employers workers salaries wages income living costs ' +
      'financial pressure strain burden stress anxiety depression productivity efficiency ' +
      'automation technological digital connectivity smartphones messaging platforms devices ' +
      'routine manual labor labour displaced displacement unemployment retraining reskilling ' +
      'legislation regulation enforcement subsidies incentives initiatives awareness campaigns'
    );
    addTokens(extraIeltsValid);
    cachedValidLexicon = lex;
    return lex;
  }

  function addInflections(word, set) {
    set.add(word);
    set.add(`${word}s`);
    set.add(`${word}es`);
    set.add(`${word}d`);
    set.add(`${word}ed`);
    set.add(`${word}ing`);
    set.add(`${word}ly`);
    if (word.endsWith('y') && word.length > 3) {
      set.add(`${word.slice(0, -1)}ies`);
      set.add(`${word.slice(0, -1)}ied`);
    }
    if (word.endsWith('e') && word.length > 3) {
      set.add(`${word.slice(0, -1)}ing`);
    }
  }

  function editDistance(a, b) {
    const m = a.length, n = b.length;
    if (Math.abs(m - n) > 2) return 9;
    const dp = Array.from({ length: m + 1 }, (_, i) => i);
    for (let j = 1; j <= n; j++) {
      let prev = dp[0];
      dp[0] = j;
      for (let i = 1; i <= m; i++) {
        const tmp = dp[i];
        dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
        prev = tmp;
      }
    }
    return dp[m];
  }

  function detectSpellingTypos(userText, targetPhrases) {
    const userWords = (String(userText || '').match(/[A-Za-z'-]{5,}/g) || []);
    const validLex = getValidEnglishLexicon();
    const targetWords = new Set();
    const validForms = new Set();
    (targetPhrases || []).forEach((ph) => {
      (String(ph || '').match(/[A-Za-z'-]{5,}/g) || []).forEach((w) => {
        const lowW = w.toLowerCase();
        targetWords.add(lowW);
        addInflections(lowW, validForms);
      });
    });
    const typos = [];
    const seen = new Set();
    for (const uw of userWords) {
      const low = uw.toLowerCase();
      if (targetWords.has(low) || validForms.has(low) || validLex.has(low) || seen.has(low)) continue;
      for (const tw of targetWords) {
        if (Math.abs(low.length - tw.length) <= 2 && low[0] === tw[0]) {
          const dist = editDistance(low, tw);
          const maxDist = tw.length >= 8 ? 2 : 1;
          if (dist > 0 && dist <= maxDist) {
            typos.push(uw);
            seen.add(low);
            break;
          }
        }
      }
    }
    return typos;
  }

  /* ================= STATE ================= */
  const state = {
    selectedModId: null,
    unmasteredOnly: false,
    cardIdx: 0,
    flipped: false,
    flowMaskOn: false,
    flowRevealed: {},
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

    // Global anti-cheat listener for Writing Recall, Task 3-Test & Practice/Exam Room
    let lastAcLeaveAt = 0;
    const triggerAcLeave = (reason) => {
      const now = Date.now();
      if (now - lastAcLeaveAt < 1500) return;
      lastAcLeaveAt = now;
      handleGlobalAntiCheatLeave(reason);
    };
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) triggerAcLeave('Chuyển tab trình duyệt');
    });
    window.addEventListener('blur', () => {
      if (pracState && !pracState.submitted) {
        setTimeout(() => {
          if (!document.hasFocus() && pracState && !pracState.submitted) {
            triggerAcLeave('Rời cửa sổ làm bài');
          }
        }, 180);
      }
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

  function toggleFlowMask(e) {
    if (e) e.stopPropagation();
    state.flowMaskOn = !state.flowMaskOn;
    state.flowRevealed = {};
    renderFlashcardWorkspace();
  }
  function revealFlowNode(nodeKey, e) {
    if (e) e.stopPropagation();
    state.flowRevealed[nodeKey] = true;
    renderFlashcardWorkspace();
  }

  function buildFlowGapSetup(mod, includeDistractors) {
    const sf = mod?.smartFlow;
    if (!sf) return { targets: [], slots: [], bank: [], activeSlot: 0 };
    const targets = [];
    if (sf.mode === 'branches') {
      (sf.blanks || []).forEach((b, idx) => {
        const txt = sf.rows?.[b.r]?.nodes?.[b.c] || '';
        if (txt) targets.push({ slotIdx: idx, key: `${b.r}_${b.c}`, ans: txt });
      });
    } else {
      (sf.blanks || []).forEach((stIdx, idx) => {
        const txt = sf.stages?.[stIdx]?.text || '';
        if (txt) targets.push({ slotIdx: idx, key: `s_${stIdx}`, ans: txt });
      });
    }
    const extra = includeDistractors ? (sf.distractors || []) : [];
    const bank = shuffle([
      ...targets.map((t, i) => ({ id: `fg_ok_${i}`, text: t.ans })),
      ...extra.map((d, i) => ({ id: `fg_tr_${i}`, text: d }))
    ]);
    return {
      targets,
      slots: new Array(targets.length).fill(null),
      bank,
      activeSlot: 0
    };
  }

  function splitFlowCueClauses(cueText) {
    const raw = String(cueText || '').trim();
    if (!raw) return [''];
    const sepRe = /(\s*\/\s*|\s*,\s*|\s+—\s+|\s+→\s+)/;
    const m = raw.match(sepRe);
    if (m && m.index !== undefined) {
      const left = raw.slice(0, m.index + m[0].length).trim();
      const right = raw.slice(m.index + m[0].length).trim();
      const lw = left.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean).length;
      const rw = right.replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean).length;
      if (lw >= 2 && rw >= 2) return [left, right];
    }
    return [raw];
  }

  function renderSmartFlowDiagram(mod, opts = {}) {
    const sf = mod?.smartFlow;
    if (!sf) {
      return `<div class="ws-flow-list">${(mod?.viFlowSteps || []).map((s, idx) => `<div class="ws-flow-step"><span class="ws-flow-num">${idx + 1}</span><span>${esc(s)}</span></div>`).join('')}</div>`;
    }
    const isEditable = Boolean(opts.editable);
    const isQuiz = Boolean(opts.quiz);
    const maskOn = Boolean(opts.maskOn);
    const revealed = opts.revealed || {};
    const targetMap = {};
    if (isQuiz && opts.targets) {
      opts.targets.forEach((t) => { targetMap[t.key] = t; });
    }

    const T1_STEP_ROLES = ['Nguyên nhân', 'Cơ chế', 'Hệ quả', 'Kết quả'];
    const T1_ARROW_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12h15"/><path d="m13 6 6 6-6 6"/></svg>';
    const T1_CHECK_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

    const renderEditableNode = (key, cueText, isOutcome, stepNum, roleLabel) => {
      const val = opts.drafts?.[key] || '';
      const locked = Boolean(opts.locked?.[key]);
      const aud = opts.audit?.[key] || null;
      const clauses = splitFlowCueClauses(cueText);
      const clauseIdx = locked ? clauses.length : Number(opts.clauseIdx?.[key] || 0);
      const isDone = locked || (clauseIdx >= clauses.length && val.trim().length > 0);
      const boxCls = locked ? 'is-ok is-done' : (aud && !aud.pass ? 'is-bad' : (isDone ? 'is-done' : ''));
      const pasteGuard = !isTeacherBypass()
        ? "event.preventDefault(); WritingStudio.toastMsg('Không được dán bài — hãy tự gõ tiếng Anh để nhớ chính tả!');"
        : '';
      return `
        <div class="ws-t1-cell ${isOutcome ? 'is-outcome' : ''} ${boxCls}" data-t1-key="${key}">
          <div class="ws-t1-cell-head">
            <span class="ws-t1-step-badge"><span class="ws-t1-step-num">${stepNum}</span><span class="ws-t1-step-role">${esc(roleLabel)}</span></span>
            <span class="ws-t1-check" aria-hidden="true">${T1_CHECK_SVG}</span>
          </div>
          <div class="ws-t1-wrap">
            <div class="ws-t1-mirror" aria-hidden="true"></div>
            <div class="ws-t1-caret" aria-hidden="true"></div>
            <textarea class="ws-t1-ta" id="ws-t1-node-${key}" data-t1-key="${key}" ${locked ? 'readonly' : ''}
              spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
              onpaste="${pasteGuard}">${esc(val)}</textarea>
          </div>
          ${!locked && aud && !aud.pass ? `<div class="ws-sf-node-err">${esc(aud.msg)}</div>` : ''}
        </div>
      `;
    };

    const renderSlotBtn = (t) => {
      const si = t.slotIdx;
      const filled = opts.slots?.[si];
      let cls = 'ws-sf-slot';
      if (si === opts.activeSlot && !opts.checked) cls += ' active-slot';
      if (filled) cls += ' filled';
      if (opts.checked && filled) cls += (filled.text === t.ans ? ' is-ok' : ' is-bad');
      const dropAttr = opts.dropHandler ? `ondragover="event.preventDefault()" ondrop="${opts.dropHandler}(event, ${si})"` : '';
      return `<button type="button" class="${cls}" ${dropAttr} onclick="${opts.clickHandler}(${si})">${filled ? esc(filled.text) : `Ô ${si + 1}`}</button>`;
    };

    if (sf.mode === 'branches') {
      if (isEditable) {
        return `
          <div class="ws-t1-board" onclick="event.stopPropagation()">
            ${(sf.rows || []).map((row, rIdx) => `
              <div class="ws-t1-row tone-${esc(row.tone || 'sage')}">
                <div class="ws-t1-tag tone-${esc(row.tone || 'sage')}">
                  <span class="ws-t1-tag-idx">0${rIdx + 1}</span>
                  <span class="ws-t1-tag-name">${esc(row.label)}</span>
                </div>
                ${(row.nodes || []).map((nd, cIdx) => {
                  const key = `${rIdx}_${cIdx}`;
                  const prevKey = cIdx > 0 ? `${rIdx}_${cIdx - 1}` : '';
                  const arrow = cIdx > 0 ? `<div class="ws-t1-arrow" data-t1-arrow-after="${prevKey}" aria-hidden="true">${T1_ARROW_SVG}</div>` : '';
                  const isOutcome = cIdx === row.nodes.length - 1;
                  const roleLbl = T1_STEP_ROLES[cIdx] || `Bước ${cIdx + 1}`;
                  return `${arrow}${renderEditableNode(key, nd, isOutcome, cIdx + 1, roleLbl)}`;
                }).join('')}
              </div>
            `).join('')}
          </div>
        `;
      }
      return `
        <div class="ws-sf-wrap" onclick="event.stopPropagation()">
          <div class="ws-sf-branches">
            ${(sf.rows || []).map((row, rIdx) => `
              <div class="ws-sf-branch-row">
                <span class="ws-sf-branch-lbl tone-${esc(row.tone || 'sage')}">${esc(row.label)}</span>
                <div class="ws-sf-nodes-track">
                  ${(row.nodes || []).map((nd, cIdx) => {
                    const key = `${rIdx}_${cIdx}`;
                    const arrow = cIdx > 0 ? '<span class="ws-sf-arrow" aria-hidden="true">→</span>' : '';
                    const isOutcome = cIdx === row.nodes.length - 1;
                    if (isQuiz && targetMap[key]) {
                      return `${arrow}${renderSlotBtn(targetMap[key])}`;
                    }
                    if (!isQuiz && maskOn && cIdx >= 1 && !revealed[key]) {
                      return `${arrow}<button type="button" class="ws-sf-masked-btn" onclick="WritingStudio.revealFlowNode('${key}', event)">Chạm mở mắt xích</button>`;
                    }
                    return `${arrow}<div class="ws-sf-node ${isOutcome ? 'is-outcome' : ''}">${esc(nd)}</div>`;
                  }).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Mode B: 2x2 Connected 4-Station Chain
    const stages = sf.stages || [];
    if (isEditable) {
      const renderEditableStation = (st, idx) => {
        const key = `s_${idx}`;
        const isOutcome = idx === stages.length - 1;
        return renderEditableNode(key, st.text, isOutcome, idx + 1, st.role || `Bước ${idx + 1}`);
      };
      if (stages.length === 4) {
        return `
          <div class="ws-t1-chain-grid" onclick="event.stopPropagation()">
            ${renderEditableStation(stages[0], 0)}
            <div class="ws-t1-arrow" data-t1-arrow-after="s_0" aria-hidden="true">${T1_ARROW_SVG}</div>
            ${renderEditableStation(stages[1], 1)}
            ${renderEditableStation(stages[2], 2)}
            <div class="ws-t1-arrow" data-t1-arrow-after="s_2" aria-hidden="true">${T1_ARROW_SVG}</div>
            ${renderEditableStation(stages[3], 3)}
          </div>
        `;
      }
      return `
        <div class="ws-t1-chain-grid" onclick="event.stopPropagation()">
          ${stages.map((st, idx) => renderEditableStation(st, idx)).join('')}
        </div>
      `;
    }

    const renderStation = (st, idx) => {
      const key = `s_${idx}`;
      const isOutcome = idx === stages.length - 1;
      const roleHeader = `
        <div class="ws-sf-role-row">
          <span class="ws-sf-num">${idx + 1}</span>
          <span class="ws-sf-role">${esc(st.role)}</span>
        </div>
      `;
      let innerHtml = '';
      if (isQuiz && targetMap[key]) {
        innerHtml = renderSlotBtn(targetMap[key]);
      } else if (!isQuiz && maskOn && idx >= 1 && !revealed[key]) {
        innerHtml = `<button type="button" class="ws-sf-masked-btn" onclick="WritingStudio.revealFlowNode('${key}', event)">Chạm mở mắt xích</button>`;
      } else {
        innerHtml = `<div class="ws-sf-text">${esc(st.text)}</div>`;
      }
      return `
        <div class="ws-sf-station ${isOutcome ? 'is-outcome' : ''}">
          ${roleHeader}
          ${innerHtml}
        </div>
      `;
    };

    if (stages.length === 4) {
      return `
        <div class="ws-sf-wrap" onclick="event.stopPropagation()">
          <div class="ws-sf-chain-grid">
            ${renderStation(stages[0], 0)}
            <span class="ws-sf-arrow" aria-hidden="true">→</span>
            ${renderStation(stages[1], 1)}
            ${renderStation(stages[2], 2)}
            <span class="ws-sf-arrow" aria-hidden="true">→</span>
            ${renderStation(stages[3], 3)}
          </div>
        </div>
      `;
    }
    return `
      <div class="ws-sf-wrap" onclick="event.stopPropagation()">
        <div class="ws-sf-chain-grid">
          ${stages.map((st, idx) => renderStation(st, idx)).join('')}
        </div>
      </div>
    `;
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
  function renderSingleBranchCard(card, opts = {}) {
    const row = card.branchRow || {};
    const nodes = (row.detailNodes && row.detailNodes.length) ? row.detailNodes : (row.nodes || []);
    const maskOn = Boolean(opts.maskOn);
    const revealed = opts.revealed || {};
    const rIdx = card.branchIdx || 0;
    const isFour = nodes.length === 4;
    return `
      <div class="ws-branch-focus-box" onclick="event.stopPropagation()">
        <div class="ws-sf-detail-track ${isFour ? 'is-4' : 'is-3'}">
          ${nodes.map((nd, cIdx) => {
            const key = `b_${rIdx}_${cIdx}`;
            const arrow = cIdx > 0 ? '<span class="ws-sf-arrow" aria-hidden="true">→</span>' : '';
            const isOutcome = cIdx === nodes.length - 1;
            if (maskOn && cIdx >= 1 && !revealed[key]) {
              return `${arrow}<button type="button" class="ws-sf-masked-btn" onclick="WritingStudio.revealFlowNode('${key}', event)">Mắt xích ${cIdx + 1}</button>`;
            }
            return `
              ${arrow}
              <div class="ws-sf-detail-node ${isOutcome ? 'is-outcome' : ''}">
                <span class="ws-sf-num">${cIdx + 1}</span>
                <span class="ws-sf-detail-txt">${esc(nd)}</span>
              </div>
            `;
          }).join('')}
        </div>
        ${row.detailVi ? `<div class="ws-branch-detail-vi">${esc(row.detailVi)}</div>` : ''}
      </div>
    `;
  }

  function shuffleDeck() {
    const mod = getActiveMod();
    if (!mod) return;
    const base = buildModuleCards(mod);
    const flow = base.filter((c) => c.kind === 'flow');
    const rest = shuffle(base.filter((c) => !c.untested));
    state.shuffledModId = mod.id;
    state.shuffledOrder = [...flow, ...rest].map((c) => c.id);
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
    toast('Đã trộn ngẫu nhiên thứ tự thẻ từ vựng trong bài!');
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
        <div class="ws-modal-title">${esc(flowLabel(mod))}</div>
        <button type="button" class="btn" style="padding:6px 12px;" onclick="WritingStudio.closeAcModal()">Đóng</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;max-height:58vh;overflow-y:auto;padding-right:4px;">
        ${cards.map((c, idx) => {
          const lv = mmap[c.id]?.level || 0;
          const isAnyFlow = c.kind === 'flow' || c.kind === 'branch_flow';
          const badge = c.kind === 'flow' ? 'FLOW' : (c.kind === 'branch_flow' ? `NHÁNH ${(c.branchIdx || 0) + 1}` : (c.kind === 'paraphrase' ? 'PARA' : 'VOCAB'));
          const status = c.untested
            ? '<span class="ws-pill">Bản đồ</span>'
            : (lv === 3 ? '<span class="ws-pill ok">Đã thuộc</span>' : (lv === 2 ? '<span class="ws-pill">Nhớ chậm</span>' : '<span style="font-size:11.5px;color:var(--ink-3);">Chưa thuộc</span>'));
          return `
            <button type="button" class="ws-mini-row" style="padding:9px 11px;font-size:12.5px;" onclick="WritingStudio.closeAcModal(); WritingStudio.jumpCard(${idx});">
              <span class="ws-kind-badge ${isAnyFlow ? 'is-flow' : (c.kind === 'paraphrase' ? 'is-para' : '')}">${badge}</span>
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

    const allModCards = getLearnableCards(mod);
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
    const taskDlInfo = isTaskMode ? (window.TeacherStudio?.getTaskDeadlineInfo?.(mod.id) || { hasDeadline: false }) : { hasDeadline: false };
    const canStartTest = isTeacherBypass() || mStats.done >= mStats.total;
    const idleElapsedSec = Math.floor((Date.now() - state.lastActivityAt) / 1000);
    // Keep Task Study controls merged cleanly into the single .study-top-bar (zero extra row pushing Flashcard controls off-screen!)
    const taskBannerHtml = '';

    // Custom Totoro Scope Dropdown (matches Reading 1-to-1, clean short flow titles)
    const modMenuHtml = (DATA().SUBTOPICS || []).map((st) => {
      const stMods = (DATA().MODULES || []).filter((m) => m.subtopic === st.key);
      return `
        <div class="tot-scope-group-lbl">${esc(st.title)}</div>
        ${stMods.map((m) => {
          const active = m.id === mod.id;
          return `
            <button type="button" class="tot-scope-item ${active ? 'is-active' : ''}" role="option" aria-selected="${active ? 'true' : 'false'}" onclick="WritingStudio.selectModule('${esc(m.id)}')">
              <span class="tot-scope-item-txt">${esc(flowLabel(m))}</span>
              ${active ? '<svg class="tot-scope-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>
          `;
        }).join('')}
      `;
    }).join('');

    // Adaptive word sizing inside Reading's .fc-word (matches Reading bold hero scale)
    const wc = String(card.en || '').split(/\s+/).length;
    let wordSizeCls = 'ws-word-sm';
    if (card.kind === 'grammar') wordSizeCls = 'ws-word-formula';
    else if (wc >= 5) wordSizeCls = 'ws-word-lg';
    else if (wc >= 3) wordSizeCls = 'ws-word-md';

    const statusCls = stLevel === 3 ? 'mastered' : (stLevel === 2 ? 'slow' : (stLevel === 1 ? 'unremembered' : ''));
    const statusTxt = stLevel === 3 ? 'Đã thuộc' : (stLevel === 2 ? 'Nhớ chậm' : (stLevel === 1 ? 'Chưa nhớ' : ''));
    const showAudio = card.kind === 'vocab' || card.kind === 'paraphrase';
    const isAnyFlow = card.kind === 'flow' || card.kind === 'branch_flow';
    const flowSubMeta = mod.smartFlow?.mode === 'branches'
      ? `${(mod.smartFlow.rows || []).length} nhánh nhân quả · Bản đồ tổng quan`
      : 'Chuỗi 4 trạm nhân quả · Bản đồ định hướng';
    const metaTag = card.kind === 'flow'
      ? flowSubMeta
      : (card.kind === 'branch_flow' ? `Mạch lập luận chi tiết · Nhánh ${(card.branchIdx || 0) + 1}` : '');

    // Back body — exact Reading clean hierarchy (NO Vietnamese example translation!)
    let backBodyHtml = '';
    if (card.kind === 'flow') {
      backBodyHtml = renderSmartFlowDiagram(mod, { maskOn: state.flowMaskOn, revealed: state.flowRevealed });
    } else if (card.kind === 'branch_flow') {
      backBodyHtml = renderSingleBranchCard(card, { maskOn: state.flowMaskOn, revealed: state.flowRevealed });
    } else if (card.kind === 'paraphrase') {
      const primaryTarget = card.items?.[0]?.en || '';
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        <div class="ws-para-section">
          <div class="ws-para-lbl">PARAPHRASE C1–C2</div>
          <div class="ws-para-chips">
            ${(card.items || []).map((it) => `
              <div class="ws-para-chip">
                <span class="ws-para-chip-en">${esc(it.en)}</span>
                <span class="ws-para-chip-vi">${esc(it.vi)}</span>
              </div>
            `).join('')}
          </div>
        </div>
        ${card.example ? `<div class="fc-sentence-box">${highlightInExample(card.example, primaryTarget)}</div>` : ''}
      `;
    } else {
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        ${card.example ? `<div class="fc-sentence-box">${highlightInExample(card.example, card.en)}</div>` : ''}
      `;
    }

    const kindBadge = (c) => c.kind === 'flow'
      ? '<span class="ws-kind-badge is-flow">Flow</span>'
      : c.kind === 'branch_flow'
        ? `<span class="ws-kind-badge is-flow">N${(c.branchIdx || 0) + 1}</span>`
        : c.kind === 'paraphrase'
          ? '<span class="ws-kind-badge is-para">Para</span>'
          : '<span class="ws-kind-badge">Vocab</span>';

    const miniListHtml = cards.map((c, idx) => {
      const lv = mmap[c.id]?.level || 0;
      return `
        <button type="button" class="ws-mini-row ${idx === state.cardIdx ? 'active' : ''}" onclick="WritingStudio.jumpCard(${idx})">
          ${kindBadge(c)}
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

      <!-- 1. TOP BAR — 100% Reading Totoro Editorial Parity (Single Row Even in Task Mode!) -->
      <div class="study-top-bar ${isTaskMode ? 'is-ws-task-bar' : ''}">
        <div class="study-bar-left">
          ${isTaskMode ? `
            <div class="ws-inline-task-badge">
              <span class="ws-pill">TASK</span>
              <strong class="ws-inline-task-name">${esc(flowLabel(mod))}</strong>
              <span class="ws-pill ${canStartTest ? 'ok' : ''}" title="Số thẻ từ vựng/paraphrase đã thuộc (không tính thẻ bản đồ Flow)">Thuộc ${mStats.done}/${mStats.total}</span>
              ${taskDlInfo.hasDeadline ? `<span class="ws-pill ${taskDlInfo.expired ? 'danger' : ''}" title="${taskDlInfo.expired ? `Đã đóng lúc ${esc(taskDlInfo.formattedAt)}` : `Đóng lúc ${esc(taskDlInfo.formattedAt)}`}">⏱ ${taskDlInfo.expired ? 'Hết hạn' : `Còn ${esc(taskDlInfo.remainingText)}`}</span>` : ''}
            </div>
          ` : `
            <div class="scope-select-wrap has-custom-scope" id="ws-scope-wrap">
              <button type="button" class="tot-scope-trigger" id="ws-scope-trigger" aria-haspopup="listbox" onclick="WritingStudio.toggleModDropdown(event)">
                <span class="tot-scope-trigger-label">${esc(flowLabel(mod))}</span>
                <svg class="tot-scope-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
              <div class="tot-scope-menu ws-mod-dropdown-menu" role="listbox" aria-label="Chọn bài học Writing">${modMenuHtml}</div>
            </div>
          `}

          <div class="tot-idle-clock-pill" id="ws-idle-clock-pill" role="status" aria-live="off" title="Thời gian không thao tác">
            <span class="tot-idle-left">
              <span class="tot-idle-dot" aria-hidden="true"></span>
              <svg class="tot-ico-sm tot-idle-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
              <span class="tot-idle-lbl">Không thao tác</span>
            </span>
            <span class="tot-idle-readout tabular">
              <strong id="${isTaskMode ? 'ws-idle-clock' : 'ws-idle-clock-val'}">${esc(isTaskMode ? fmtMmSs(idleElapsedSec) : curIdleVal)}</strong>
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
          ${isTaskMode ? `
            <button type="button" class="btn btn-primary ws-topbar-test-btn" ${canStartTest ? '' : 'disabled'} onclick="WritingStudio.startTaskExam('${esc(mod.id)}')" title="${canStartTest ? 'Bắt đầu bài Test 3 bước' : `Cần thuộc đủ ${mStats.total}/${mStats.total} thẻ`}">
              ${canStartTest ? 'Vào Test →' : `Còn ${Math.max(0, mStats.total - mStats.done)} thẻ`}
            </button>
            <button type="button" class="btn ws-topbar-exit-btn" onclick="WritingStudio.exitTaskStudyMode()">Thoát</button>
          ` : `
            <button type="button" class="btn-deck-tool tot-tool-quiet" onclick="WritingStudio.shuffleDeck()" title="Trộn ngẫu nhiên thứ tự thẻ">
              <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><polyline points="16 3 21 3 21 8"/><line x1="4" x2="21" y1="20" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" x2="21" y1="15" y2="21"/></svg>
              <span>Trộn</span>
            </button>
            <button type="button" class="btn-deck-tool tot-tool-quiet btn-focus-toggle ${isFocusActive ? 'active' : ''}" onclick="typeof toggleFocusMode === 'function' && toggleFocusMode()" title="Thu gọn 2 cột bên để tập trung học Flashcard">
              <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
              <span>Tập trung</span>
            </button>
          `}
          <div class="study-progress-wrap" title="Vị trí thẻ hiện tại (gồm thẻ bản đồ Flow + thẻ từ vựng)">
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
                <div class="widget-subtitle">Flow VI → Grammar → Body</div>
              </div>
            </div>
            <div class="tot-speedquiz-meta">
              <div class="tot-sq-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9.5 2h5" stroke-linecap="round"/></svg>
                <span>Soi chính tả</span>
              </div>
              <div class="tot-sq-badge">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                <span>Đề thi thật</span>
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
                      ${metaTag ? `<span class="fc-ipa-badge">${esc(metaTag)}</span>` : ''}
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
                          ${isAnyFlow ? `<button type="button" class="btn-reading-tip ${state.flowMaskOn ? 'is-active' : ''}" onclick="WritingStudio.toggleFlowMask(event)">${state.flowMaskOn ? 'Hiện toàn bộ' : 'Ẩn mắt xích để nhẩm'}</button>` : ''}
                          ${!card.untested ? `<span class="fc-status-tag ${statusCls}">${esc(statusTxt)}</span>` : `<span class="fc-status-tag">${card.kind === 'branch_flow' ? 'Mạch nhánh' : 'Bản đồ tổng quan'}</span>`}
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

                  ${isAnyFlow ? `
                    <div class="ws-flow-guide-cta" onclick="event.stopPropagation()">
                      <button type="button" class="btn btn-primary ws-flow-guide-btn" onclick="WritingStudio.stepCard(1)">
                        <span>${card.kind === 'branch_flow' ? 'Đã nắm nhánh này · Học từ vựng của nhánh →' : ((mod.vocab || []).some((v) => v.branchIdx === -1) ? 'Đã nắm tổng quan · Học cụm mở đoạn →' : (mod.smartFlow?.mode === 'branches' ? 'Đã nắm tổng quan · Vào Nhánh 1 →' : 'Đã nắm mạch Flow · Học từ vựng của bài →'))}</span>
                      </button>
                    </div>
                  ` : `
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
                  `}
                </div>
              </div>
            </div>
          </div>

          <div class="study-controls">
            <div class="nav-buttons-group">
              <button type="button" class="btn" ${state.cardIdx === 0 ? 'disabled' : ''} onclick="WritingStudio.stepCard(-1)">← Trước</button>
              <button type="button" class="btn btn-primary btn-flip-action" id="ws-btn-flip" onclick="WritingStudio.flipCard()">${state.flipped ? 'Mặt trước' : (isAnyFlow ? 'Xem mạch Flow' : 'Xem nghĩa')}</button>
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
                <div class="widget-subtitle">${esc(flowLabel(mod))}</div>
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
                <div class="widget-subtitle">Flow → Vocab → Paraphrase</div>
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
      if (el) el.textContent = fmtMmSs(elapsed / 1000);
      if (elapsed >= IDLE_LIMIT_MS) {
        setLockout(TASK_LOCK_KEY_BASE, 'Không thao tác quá 10 phút trong Task');
        exitTaskStudyMode();
        closeTaskExamModal(true);
        showAntiCheatModal('KHÓA 30 PHÚT · TREO MÁY', 'Hệ thống phát hiện không thao tác quá 10 phút trong Task. Phiên làm việc đã kết thúc và tạm khóa 30 phút.', true);
      }
    }, 1000);
  }

  function autoSpeakFrontCard(card) {
    if (!card || state.flipped) return;
    if (card.kind === 'vocab' || card.kind === 'paraphrase') {
      speakText(card.en, 'en-US');
    }
  }

  function selectModule(modId) {
    state.selectedModId = modId;
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
    const mod = getActiveMod();
    autoSpeakFrontCard(getVisibleCards(mod)[state.cardIdx]);
  }
  function toggleUnmastered() {
    state.unmasteredOnly = !state.unmasteredOnly;
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
    const mod = getActiveMod();
    autoSpeakFrontCard(getVisibleCards(mod)[state.cardIdx]);
  }
  function flipCard() {
    const mod = getActiveMod();
    const card = getVisibleCards(mod)[state.cardIdx];
    const isAnyFlow = card?.kind === 'flow' || card?.kind === 'branch_flow';
    state.flipped = !state.flipped;
    document.getElementById('ws-fc-card')?.classList.toggle('flipped', state.flipped);
    const btn = document.getElementById('ws-btn-flip');
    if (btn) btn.textContent = state.flipped ? 'Mặt trước' : (isAnyFlow ? 'Xem mạch Flow' : 'Xem nghĩa');
    if (card && (card.kind === 'vocab' || card.kind === 'paraphrase')) {
      if (state.flipped) {
        const txt = card.kind === 'paraphrase' ? (card.items?.[0]?.en || card.en) : card.en;
        speakText(txt, 'en-GB');
      } else {
        speakText(card.en, 'en-US');
      }
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
      autoSpeakFrontCard(cards[nxt]);
    }
  }
  function jumpCard(idx) {
    const mod = getActiveMod();
    const cards = getVisibleCards(mod);
    state.cardIdx = idx;
    state.flipped = false;
    renderFlashcardWorkspace();
    autoSpeakFrontCard(cards[idx]);
  }
  function speakCurrent(accent, e) {
    if (e) e.stopPropagation();
    const mod = getActiveMod();
    const card = getVisibleCards(mod)[state.cardIdx];
    if (!card) return;
    const txt = (card.kind === 'paraphrase' && state.flipped) ? (card.items?.[0]?.en || card.en) : card.en;
    speakText(txt, accent || (state.flipped ? 'en-GB' : 'en-US'));
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
    if (!card || card.untested) {
      if (card?.untested) stepCard(1);
      return;
    }
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

  /* ================= 2-STAGE ĐÃ THUỘC RECALL (TEST 1 IELTS TRAP -> TEST 2 VI->EN SENTENCE + GRAMMAR & SPELLING) ================= */
  const COMMON_IELTS_TYPOS = new Set([
    'neccessary', 'neccessity', 'goverment', 'enviroment', 'enviromental', 'bussiness', 'becuase', 'beacuse',
    'peopel', 'studnets', 'childern', 'chidlren', 'sociaty', 'econmic', 'healt', 'helth', 'wrok', 'overwrok', 'alwyas',
    'definately', 'seperate', 'occured', 'recieve', 'beleive', 'acheive', 'managment', 'developement', 'improvment',
    'knowlege', 'exprience', 'oportunity', 'benifit', 'tecnology', 'communcation', 'profesional', 'responsiblity',
    'stressfull', 'sucessful', 'finacial', 'presssure', 'compettition', 'collegue', 'balence', 'salery', 'expences',
    'famly', 'eductaion', 'mentel', 'physicl', 'nutriton', 'deliquency', 'marraige', 'fertillity', 'displacment',
    'isolaton', 'boundries', 'flexiblity', 'independant', 'conveniance', 'creativty', 'adaptaton', 'alot', 'teh',
    'thier', 'wich', 'wher', 'pepole', 'importent', 'diffrent', 'probelm', 'soluton', 'efffect', 'causess'
  ]);

  const ENGLISH_PREDICATE_MARKERS = new Set([
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'am',
    'have', 'has', 'had', 'do', 'does', 'did',
    'can', 'could', 'will', 'would', 'shall', 'should', 'may', 'might', 'must',
    'make', 'makes', 'made', 'take', 'takes', 'took', 'give', 'gives', 'gave',
    'create', 'creates', 'created', 'cause', 'causes', 'caused', 'lead', 'leads', 'led',
    'drive', 'drives', 'drove', 'force', 'forces', 'forced', 'help', 'helps', 'helped',
    'need', 'needs', 'needed', 'want', 'wants', 'wanted', 'feel', 'feels', 'felt',
    'face', 'faces', 'faced', 'suffer', 'suffers', 'suffered', 'work', 'works', 'worked',
    'spend', 'spends', 'spent', 'use', 'uses', 'used', 'allow', 'allows', 'allowed',
    'provide', 'provides', 'provided', 'improve', 'improves', 'improved', 'reduce', 'reduces', 'reduced',
    'increase', 'increases', 'increased', 'prevent', 'prevents', 'prevented', 'protect', 'protects', 'protected',
    'affect', 'affects', 'affected', 'harm', 'harms', 'harmed', 'become', 'becomes', 'became', 'remain', 'remains', 'remained',
    'find', 'finds', 'found', 'get', 'gets', 'got', 'keep', 'keeps', 'kept', 'bring', 'brings', 'brought',
    'show', 'shows', 'showed', 'play', 'plays', 'played', 'offer', 'offers', 'offered', 'require', 'requires', 'required',
    'encourage', 'encourages', 'encouraged', 'promote', 'promotes', 'promoted', 'support', 'supports', 'supported',
    'result', 'results', 'resulted', 'contribute', 'contributes', 'contributed', 'depend', 'depends', 'depended',
    'tend', 'tends', 'tended', 'struggle', 'struggles', 'struggled', 'fail', 'fails', 'failed', 'fear', 'fears', 'feared',
    'try', 'tries', 'tried', 'choose', 'chooses', 'chose', 'care', 'cares', 'cared', 'live', 'lives', 'lived'
  ]);

  function escapeRegExp(s) {
    return String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function detectIeltsGrammarErrors(rawText) {
    const text = String(rawText || '').trim();
    const errs = [];
    const addErr = (msg) => { if (!errs.includes(msg)) errs.push(msg); };

    if (/^[a-z]/.test(text)) {
      addErr('Chưa viết hoa chữ cái đầu câu.');
    }
    const dup = text.match(/\b(the|a|an|is|are|to|of|in|for|and|that|many|more)\s+\1\b/i);
    if (dup) addErr(`Lặp từ liền nhau: "${dup[0]}".`);

    const modalTo = text.match(/\b(can|could|will|would|should|may|might|must)\s+to\s+[a-z]+\b/i);
    if (modalTo) addErr(`Lỗi động từ khuyết thiếu "${modalTo[0]}" → sau ${modalTo[1]} dùng động từ nguyên mẫu không "to".`);

    const modalIng = text.match(/\b(can|could|will|would|should|may|might|must)\s+[a-z]{3,}ing\b/i);
    if (modalIng) addErr(`Lỗi ngữ pháp "${modalIng[0]}" → sau ${modalIng[1]} dùng V nguyên mẫu (hoặc "be + V-ing").`);

    const beBase = text.match(/\b(is|are|was|were)\s+(affect|cause|create|make|harm|reduce|increase|improve|suffer|face|force|drive|help|need|want|work|spend|live|lead|allow|prevent|protect|depend|lack|fail|remain|try|choose)\b/i);
    if (beBase) addErr(`Lỗi chia động từ "${beBase[0]}" → sau "${beBase[1]}" dùng V-ing hoặc bị động V3/ed.`);

    const auxBad = text.match(/\b(does|did)\s+(?:not\s+)?([a-z]{3,}(?:s|es|ed))\b/i);
    if (auxBad && !/^(is|as|us|its|this|always|often|never|sometimes|needs|less|stress|business)$/i.test(auxBad[2])) {
      addErr(`Lỗi trợ động từ "${auxBad[0]}" → sau "${auxBad[1]}" dùng động từ nguyên mẫu.`);
    }

    const aVowel = text.match(/\ba\s+(economic|economy|urban|implicit|emotional|intense|important|overtime|office|online|issue|impact|effect|effort|income|adult|employee|employer|environment|education|opportunity|essential|abundant|unfair)\b/i);
    if (aVowel) addErr(`Lỗi mạo từ "${aVowel[0]}" → trước nguyên âm dùng "an".`);

    const anCons = text.match(/\ban\s+(culture|workplace|company|worker|family|child|parent|job|career|salary|problem|solution|benefit|health|system|market|society|person|pressure|driver|cost|stress|burden|limit)\b/i);
    if (anCons) addErr(`Lỗi mạo từ "${anCons[0]}" → trước phụ âm dùng "a".`);

    if (/\b(although|though|even though)\b[^.!?]+\bbut\b/i.test(text)) {
      addErr('Không dùng đồng thời "Although/Though" và "but" trong cùng một câu.');
    }
    if (/\bbecause\b[^.!?]+\bso\b/i.test(text)) {
      addErr('Không dùng đồng thời "Because" và "so" trong cùng một câu.');
    }
    if (/\bdespite\s+of\b/i.test(text)) {
      addErr('Lỗi giới từ "despite of" → chỉ dùng "despite" hoặc "in spite of".');
    }
    if (/\bdiscuss\s+about\b/i.test(text)) {
      addErr('Lỗi giới từ "discuss about" → dùng trực tiếp "discuss + O".');
    }
    if (/\b(make|makes|made|let|lets)\s+(people|workers|employees|students|children|families|us|them)\s+to\s+[a-z]+\b/i.test(text)) {
      addErr('Cấu trúc "make/let + O + V nguyên mẫu" không dùng "to".');
    }
    if (/\bthere\s+is\s+(many|several|various|numerous|two|three|four|five)\b/i.test(text)) {
      addErr('Lỗi hòa hợp Chủ–Vị: dùng "There are" trước danh từ số nhiều.');
    }
    if (/\bthere\s+are\s+(a|an)\s+/i.test(text)) {
      addErr('Lỗi hòa hợp Chủ–Vị: dùng "There is" trước danh từ số ít "a/an".');
    }
    return errs;
  }

  function phraseMatchesSentence(sentenceLow, targetPhrase) {
    const cleanTarget = normStr(targetPhrase).replace(/^to\s+/, '');
    if (!cleanTarget) return true;
    if (sentenceLow.includes(cleanTarget)) return true;
    const parts = cleanTarget.split(' ');
    const head = parts[0];
    const rest = parts.slice(1).join(' ');
    const headVariants = new Set([head, `${head}s`, `${head}es`, `${head}d`, `${head}ed`, `${head}ing`]);
    if (head.endsWith('y') && head.length > 3) {
      headVariants.add(`${head.slice(0, -1)}ies`);
      headVariants.add(`${head.slice(0, -1)}ied`);
    }
    if (head.endsWith('e') && head.length > 3) {
      headVariants.add(`${head.slice(0, -1)}ing`);
    }
    for (const hv of headVariants) {
      const cand = rest ? `${hv} ${rest}` : hv;
      if (new RegExp(`\\b${escapeRegExp(cand)}\\b`, 'i').test(sentenceLow)) return true;
    }
    return false;
  }

  function validateRecallSentence(rawSentence, card, mod) {
    const text = String(rawSentence || '').trim();
    const low = normStr(text);
    const words = (text.match(/[A-Za-z'-]+/g) || []);
    const acceptedList = card.kind === 'paraphrase'
      ? (card.accepted && card.accepted.length ? card.accepted : [card.items?.[0]?.en || card.en])
      : [card.en];
    const primaryPhrase = acceptedList[0] || card.en;
    const phraseWords = normStr(primaryPhrase).replace(/^to\s+/, '').split(' ').filter(Boolean);
    const minWords = Math.max(6, phraseWords.length + 3);

    if (!text) return { ok: false, errors: ['Hãy viết lại câu tiếng Anh hoàn chỉnh.'] };

    const errors = [];
    // 1. Gibberish check
    const gibberish = words.find((w) => /[bcdfghjklmnpqrstvwxz]{5,}/i.test(w) || /(.)\1\1/i.test(w));
    if (gibberish) errors.push(`Từ không hợp lệ: "${gibberish}".`);

    // 2. Spelling check
    const modPhrases = [...acceptedList, ...(mod?.vocab || []).map((v) => v.en)];
    const typos = detectSpellingTypos(text, modPhrases);
    words.forEach((w) => {
      const lw = w.toLowerCase();
      if (COMMON_IELTS_TYPOS.has(lw) && !typos.some((t) => t.toLowerCase() === lw)) typos.push(w);
    });
    if (typos.length > 0) {
      errors.push(`Sai chính tả: ${typos.map((t) => `"${t}"`).join(', ')}.`);
    }

    // 3. Grammar check
    const gramErrs = detectIeltsGrammarErrors(text);
    gramErrs.forEach((g) => errors.push(`Lỗi ngữ pháp: ${g}`));

    // 4. Target phrase inclusion check (ZERO English leak!)
    const matched = acceptedList.some((ph) => phraseMatchesSentence(low, ph));
    if (!matched) {
      errors.push('Câu chưa sử dụng đúng cụm từ tiếng Anh vừa học cho ý trên (hoặc bị sai chính tả trong cụm).');
    }

    // 5. Length & anti-repeat & predicate check
    if (words.length < minWords) {
      errors.push(`Câu còn quá ngắn (${words.length} từ) — cần diễn đạt trọn vẹn câu Tiếng Việt trên.`);
    }
    const uniqueCount = new Set(words.map((w) => w.toLowerCase())).size;
    if (words.length >= 6 && uniqueCount < Math.ceil(words.length * 0.6)) {
      errors.push('Câu bị lặp từ quá nhiều — hãy viết tự nhiên.');
    }
    const hasVerb = words.some((w) => {
      const lw = w.toLowerCase();
      return ENGLISH_PREDICATE_MARKERS.has(lw) || /(ed|ing|ize|ise|ate|ify)$/.test(lw);
    });
    if (words.length >= 4 && !hasVerb) {
      errors.push('Lỗi ngữ pháp: Câu chưa có động từ chính hoàn chỉnh.');
    }

    return errors.length === 0 ? { ok: true, errors: [] } : { ok: false, errors };
  }

  function openRecallModal(card) {
    ensureOverlays();
    const mmap = getMasteryMap();
    const isStrictSrs = (mmap[card.id]?.reviews || 0) >= 1;
    const mod = getModById(card.modId) || getActiveMod();
    const correctAns = card.kind === 'paraphrase' ? (card.items?.[0]?.en || card.en) : card.en;

    recallState = {
      card,
      mod,
      stage: 1, // 1: Hint-Free Exact Typing (30s, 2 tries) -> 2: VI->EN Sentence (90s, 3 tries)
      isStrictSrs,
      attemptsLeft: isStrictSrs ? 1 : 2,
      secLeft: 30,
      timerId: null,
      targetPhrase: correctAns,
      sentenceDraft: '',
      lastErrors: [],
      passedModel: false,
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
        pill.textContent = recallState.stage === 2 ? fmtMmSs(recallState.secLeft) : `${Math.max(0, recallState.secLeft)}s`;
        pill.classList.toggle('urgent', recallState.secLeft <= (recallState.stage === 2 ? 15 : 8));
      }
      if (recallState.secLeft <= 0) {
        failRecall('Hết giờ!');
      }
    }, 1000);
  }

  function renderRecallModal() {
    if (!recallState) return;
    const { card, stage, attemptsLeft, secLeft, targetPhrase, passedModel, lastErrors } = recallState;
    const cardEl = document.getElementById('ws-recall-card');
    cardEl.classList.toggle('is-wide', false);

    if (stage === 2) {
      const curWc = String(recallState.sentenceDraft || '').trim()
        ? String(recallState.sentenceDraft).trim().split(/\s+/).length
        : 0;
      const viPromptText = card.viPrompt || `Hãy viết một câu tiếng Anh hoàn chỉnh diễn đạt ý: "${card.vi}".`;
      const enRefText = card.enRef || '';
      const exampleSentence = card.example || '';

      cardEl.innerHTML = `
        <div class="ws-modal-head">
          <div class="ws-modal-title">KIỂM TRA ĐÃ THUỘC · TEST 2 · VIẾT CÂU TIẾNG ANH</div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${!passedModel ? `<span class="ws-pill">Còn ${attemptsLeft} lượt</span>` : '<span class="ws-pill ok">Đã chốt Đã thuộc ✓</span>'}
            ${!passedModel ? `<span class="ws-pill ${secLeft <= 15 ? 'urgent' : ''}" id="ws-recall-timer">${fmtMmSs(secLeft)}</span>` : ''}
          </div>
        </div>
        <div class="ws-recall-vi-prompt">${esc(viPromptText)}</div>
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <div class="ws-col-lbl" style="margin:0;">Viết lại câu trên bằng Tiếng Anh đúng chính tả &amp; ngữ pháp</div>
          <span class="ws-pill tabular" id="ws-recall-sent-wc">${curWc} words</span>
        </div>
        <textarea class="ws-recall-sent-input" id="ws-recall-sent-input" ${passedModel ? 'readonly' : ''}
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          placeholder="Viết câu tiếng Anh của bạn tại đây..."
          oninput="WritingStudio.updateRecallSentenceDraft(this.value)"
          onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); WritingStudio.submitRecallSentence(); }"
          onpaste="event.preventDefault(); WritingStudio.toastMsg('Không được dán khi đang kiểm tra!');">${esc(recallState.sentenceDraft || '')}</textarea>
        ${!passedModel && lastErrors && lastErrors.length ? `
          <div class="ws-feedback err" id="ws-recall-fb">
            ${lastErrors.map((er) => `<div>✕ ${esc(er)}</div>`).join('')}
            <div style="margin-top:4px;opacity:0.9;">Còn ${attemptsLeft} lượt sửa.</div>
          </div>
        ` : `<div class="ws-feedback ${passedModel ? 'ok' : ''}" id="ws-recall-fb">${passedModel ? 'Đạt chuẩn chính tả & ngữ pháp! Đã chốt Đã thuộc.' : ''}</div>`}
        ${passedModel ? `
          <div class="ws-recall-model-box">
            ${enRefText ? `
              <div>
                <div class="ws-col-lbl" style="color:var(--accent);margin-bottom:3px;">Câu Tiếng Anh tham khảo</div>
                <div style="font-size:14.5px;line-height:1.62;color:var(--ink);text-align:justify;">${highlightInExample(enRefText, targetPhrase)}</div>
              </div>
            ` : ''}
            ${exampleSentence ? `
              <div style="${enRefText ? 'padding-top:8px;border-top:1px dashed var(--border);' : ''}">
                <div class="ws-col-lbl" style="color:var(--ink-2);margin-bottom:3px;">Câu học thuật Band 8.5+ đối chiếu</div>
                <div style="font-size:14.2px;line-height:1.62;color:var(--ink);text-align:justify;">${highlightInExample(exampleSentence, targetPhrase)}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          ${passedModel
            ? `<button type="button" class="btn btn-primary" id="ws-recall-finish-btn" onclick="WritingStudio.finishRecallPass()">Tiếp tục →</button>`
            : `
              <button type="button" class="btn" onclick="WritingStudio.abortRecall()">Bỏ kiểm tra</button>
              <button type="button" class="btn btn-primary" id="ws-recall-sent-submit" onclick="WritingStudio.submitRecallSentence()">Xác nhận câu</button>
            `}
        </div>
      `;
      if (!passedModel) setTimeout(() => document.getElementById('ws-recall-sent-input')?.focus(), 40);
    } else {
      const promptLine = card.kind === 'paraphrase'
        ? `Gõ chính xác 1 cụm Paraphrase C1-C2 vừa học · còn ${attemptsLeft} lần.`
        : `Gõ chính xác cụm từ tiếng Anh vừa học · còn ${attemptsLeft} lần.`;
      cardEl.innerHTML = `
        <div class="ws-modal-head">
          <div class="ws-modal-title">KIỂM TRA ĐÃ THUỘC · TEST 1</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="ws-pill">Bước 1 / 2</span>
            <span class="ws-pill ${secLeft <= 8 ? 'urgent' : ''}" id="ws-recall-timer">${secLeft}s</span>
          </div>
        </div>
        <form onsubmit="WritingStudio.submitRecallTyping(event)" autocomplete="off">
          <div class="ws-recall-box">
            <input type="text" class="ws-underline-input" id="ws-recall-input" placeholder="_ _ _ _"
              autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
              onpaste="event.preventDefault(); WritingStudio.toastMsg('Không được dán khi đang kiểm tra!');" />
            <div style="font-size:13.5px;color:var(--ink-2);text-align:center;" id="ws-recall-sub">${promptLine}</div>
          </div>
          <div class="ws-feedback" id="ws-recall-fb" style="margin-top:12px;"></div>
          <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
            <button type="button" class="btn" onclick="WritingStudio.abortRecall()">Bỏ kiểm tra</button>
            <button type="submit" class="btn btn-primary" id="ws-recall-submit">Tiếp sang Test 2 →</button>
          </div>
        </form>
      `;
      setTimeout(() => document.getElementById('ws-recall-input')?.focus(), 40);
    }
  }

  function submitRecallTyping(e) {
    if (e) e.preventDefault();
    if (!recallState || recallState.done) return;
    const inp = document.getElementById('ws-recall-input');
    const fb = document.getElementById('ws-recall-fb');
    const rawTyped = String(inp?.value || '').trim();
    const typed = normStr(rawTyped);
    if (!typed) { inp?.focus(); return; }

    const card = recallState.card;
    const accepted = card.kind === 'paraphrase'
      ? (card.accepted || []).map(normStr)
      : [normStr(card.en)];

    if (accepted.includes(typed)) {
      recallState.stage = 2;
      recallState.secLeft = 90;
      recallState.attemptsLeft = recallState.isStrictSrs ? 2 : 3;
      recallState.targetPhrase = card.kind === 'paraphrase' ? rawTyped : card.en;
      recallState.sentenceDraft = '';
      recallState.lastErrors = [];
      renderRecallModal();
      toast('Chính tả chuẩn xác! Bây giờ hãy viết lại câu Tiếng Việt sang Tiếng Anh.');
      return;
    }

    recallState.attemptsLeft--;
    if (recallState.attemptsLeft > 0) {
      const sub = document.getElementById('ws-recall-sub');
      if (sub) sub.textContent = `Chưa chính xác · còn ${recallState.attemptsLeft} lần.`;
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

  function updateRecallSentenceDraft(val) {
    if (!recallState) return;
    recallState.sentenceDraft = String(val || '');
    const wc = recallState.sentenceDraft.trim() ? recallState.sentenceDraft.trim().split(/\s+/).length : 0;
    const pill = document.getElementById('ws-recall-sent-wc');
    if (pill) pill.textContent = `${wc} words`;
  }

  function submitRecallSentence() {
    if (!recallState || recallState.done) return;
    const inp = document.getElementById('ws-recall-sent-input');
    const raw = inp ? inp.value : recallState.sentenceDraft;
    recallState.sentenceDraft = raw;
    const check = validateRecallSentence(raw, recallState.card, recallState.mod);
    if (check.ok) {
      recallState.lastErrors = [];
      passRecall();
      return;
    }
    recallState.attemptsLeft--;
    recallState.lastErrors = check.errors;
    if (recallState.attemptsLeft > 0) {
      renderRecallModal();
      setTimeout(() => document.getElementById('ws-recall-sent-input')?.focus(), 40);
    } else {
      failRecall(check.errors[0] || 'Chưa đạt yêu cầu!');
    }
  }

  function passRecall() {
    if (!recallState || recallState.done) return;
    recallState.done = true;
    recallState.passedModel = true;
    clearInterval(recallState.timerId);
    const card = recallState.card;
    commitCardMastery(card, 3);
    renderRecallModal();
    toast('Đã chốt Đã thuộc!');
  }

  function finishRecallPass() {
    closeRecallModalSilent();
    renderFlashcardWorkspace();
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
      const tierLabel = m.tier === 'cross' ? 'Cross-Topic' : (m.tier === 'solution' ? 'Solution' : 'Core Flow');
      const firstPromptId = (m.linkedPromptIds && m.linkedPromptIds[0]) || (getModulePrompts(m)[0]?.id) || '';
      return `
        <article class="ws-task-card ${tierCls} ${isDone ? 'is-done' : ''}">
          <div>
            <div class="ws-task-card-top">
              <div class="ws-task-title">${esc(flowLabel(m))}</div>
              ${isDone ? `<span class="ws-pill ok">Band ${Number(p.band || 7.5).toFixed(1)}</span>` : `<span class="ws-pill ${pillCls}">${mStat.done}/${mStat.total} thẻ</span>`}
            </div>
            <div class="ws-task-meta">${esc((m.viFlowSteps || []).slice(0, 2).join(' → '))}</div>
          </div>
          <div>
            <div class="ws-task-prog" title="Tiến độ thuộc thẻ Flashcard">
              <div class="ws-task-prog-track"><div class="ws-task-prog-fill" style="width:${mStat.pct}%;"></div></div>
              <span class="ws-task-prog-pct">${mStat.pct}%</span>
            </div>
            <div class="ws-task-foot" style="margin-top:10px;gap:6px;">
              ${isTeacherBypass()
                ? `<button type="button" class="btn ws-task-sec-btn" onclick="WritingStudio.copyTaskLink('${esc(m.id)}')">Copy link</button>`
                : (firstPromptId
                  ? `<button type="button" class="btn ws-task-sec-btn" onclick="WritingStudio.launchPracticeFromTask('${esc(firstPromptId)}', 'practice')" title="Thực hành viết bài hoàn chỉnh ngay trên đề thật của Flow này">Viết đề thật</button>`
                  : `<span class="ws-task-steps-hint">${isDone ? 'Đã hoàn thành ✓' : 'Flow · Gram · Write'}</span>`)}
              <button type="button" class="btn btn-primary ws-task-pri-btn" onclick="WritingStudio.openTask('${esc(m.id)}')">
                ${isDone ? 'Làm lại Task' : 'Vào Task →'}
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
    const base = `${window.location.origin}${window.location.pathname}`;
    const url = `${base}?task=${encodeURIComponent(modId)}`;
    const msg = `DAILY HOMEWORK\n-WRITING: ${url}`;
    navigator.clipboard?.writeText?.(msg).then(() => toast('Đã copy mẫu DAILY HOMEWORK (Writing) gửi Zalo!')).catch(() => toast(msg));
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
    if (!isTeacherBypass()) {
      const dlInfo = window.TeacherStudio?.getTaskDeadlineInfo?.(mod.id);
      if (dlInfo?.hasDeadline && dlInfo.expired) {
        showAntiCheatModal('TASK WRITING ĐÃ HẾT HẠN', `Task ${flowLabel(mod)} đã đóng hạn nộp lúc ${dlInfo.formattedAt}. Vui lòng liên hệ giáo viên nếu cần gia hạn!`, true);
        return;
      }
    }

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
    toast(`Đã vào Task: ${flowLabel(mod)} · Học thuộc 100% thẻ để mở khóa Test!`);
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

  /* ================= 3-STAGE SEQUENTIAL TASK EXAM =================
     Stage 1: Vietnamese Idea Flow -> Write in English (Spelling + Core Collocations)
     Stage 2: Grammar Skeleton -> Write Cohesive Paragraph
     Stage 3: Real IELTS Task 2 Prompt -> Write Full Body Paragraph + Model Key Compare
     ================================================================== */
  function getModulePrompts(mod) {
    const allP = DATA().PRACTICE_PROMPTS || [];
    const ids = mod?.linkedPromptIds || [];
    const list = ids.map((id) => allP.find((p) => p.id === id)).filter(Boolean);
    if (list.length) return list;
    return allP.filter((p) => p.subtopic === mod?.subtopic).slice(0, 2);
  }

  function getTaskStageLimitSec(mod, stageNum) {
    if (stageNum === 1) return mod?.smartFlow?.mode === 'branches' ? 4 * 60 : 3 * 60;
    if (stageNum === 2) return 8 * 60;
    return 12 * 60;
  }

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
    if (!isTeacherBypass() && B()?.syncExamLock?.(true, `Writing Task ${flowLabel(mod)}`) === false) return;

    const prompts = getModulePrompts(mod);
    examState = {
      mod,
      stage: 1, // 1: VI Flow -> EN (3m/4m) | 2: Grammar Skeleton -> Paragraph (8m) | 3: Real Exam Prompt -> Body (12m)
      strikes: 0,
      stageSecsLeft: getTaskStageLimitSec(mod, 1),
      // Stage 1 state (Inline Editable Smart Flow Nodes · 100% Tab-controlled)
      t1NodeDrafts: {},
      t1NodeAudit: {},
      t1NodeLocked: {},
      t1NodeClauseIdx: {},
      t1FocusedKey: null,
      // Stage 2 state (Grammar Skeleton -> Full Paragraph)
      t2Paragraph: '',
      t2Audit: null,
      // Stage 3 state (Real Exam Prompt -> Body Paragraph)
      prompts,
      promptIdx: 0,
      t3Body: '',
      t3Audit: null,
      t3RetriesLeft: 2,
      t3Finalized: false,
      timerId: null
    };

    document.getElementById('ws-task-exam-modal').classList.add('open');
    startStageTimer();
    renderExamModal();
  }

  function advanceTaskStage(nextStage) {
    if (!examState) return;
    examState.stage = nextStage;
    examState.stageSecsLeft = getTaskStageLimitSec(examState.mod, nextStage);
    startStageTimer();
    renderExamModal();
  }

  function startStageTimer() {
    if (!examState) return;
    clearInterval(examState.timerId);
    examState.timerId = setInterval(() => {
      if (!examState || examState.t3Finalized) return;
      if (!isTeacherBypass()) {
        examState.stageSecsLeft = Math.max(0, (examState.stageSecsLeft || 0) - 1);
      }
      const el = document.getElementById('ws-exam-timer');
      if (el) {
        el.textContent = fmtMmSs(examState.stageSecsLeft);
        el.classList.toggle('urgent', examState.stageSecsLeft <= 60);
      }
      if (!isTeacherBypass() && examState.stageSecsLeft <= 0) {
        clearInterval(examState.timerId);
        if (examState.stage === 3) {
          const raw = String(examState.t3Body || '').trim();
          if (raw && raw.split(/\s+/).length >= 10) {
            examState.t3RetriesLeft = 0;
            toast('Hết 12 phút — hệ thống tự động nộp và chấm đoạn Body hiện tại!');
            submitTaskTest3();
          } else {
            closeTaskExamModal(true);
            showAntiCheatModal('HẾT THỜI GIAN · TEST 3', 'Đã hết 12 phút viết đoạn Body nhưng chưa có nội dung. Hãy ôn kỹ bài và thử lại.', true);
          }
        } else {
          const stNum = examState.stage;
          closeTaskExamModal(true);
          showAntiCheatModal(`HẾT THỜI GIAN · TEST ${stNum}`, `Bạn đã hết thời gian hoàn thành Test ${stNum}. Hãy ôn lại Flow và từ vựng trước khi làm lại.`, true);
        }
      }
    }, 1000);
  }

  function renderExamModal() {
    if (!examState) return;
    const { mod, stage } = examState;
    const sents = mod.sentences || [];
    const card = document.getElementById('ws-task-exam-card');
    const canJump = isTeacherBypass();
    const clockSvg = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';

    let bodyHtml = '';

    if (stage === 1) {
      const t1Total = getFlowNodeSpecList(mod).length;
      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Dịch trực tiếp sơ đồ Flow VI → EN</div>
            <div class="ws-t1-stage-sub">Gõ tiếng Anh ngay trên từng mắt xích — nhấn <strong>Tab</strong> hoặc <strong>Enter</strong> khi xong ý để sang ô tiếp theo.</div>
          </div>
          <div class="ws-t1-telemetry">
            <div class="ws-t1-stat is-accent">
              <svg class="ws-t1-ring" viewBox="0 0 18 18" aria-hidden="true">
                <circle class="ws-t1-ring-bg" cx="9" cy="9" r="7" />
                <circle class="ws-t1-ring-fg" id="ws-t1-ring-fg" cx="9" cy="9" r="7" />
              </svg>
              <strong id="ws-t1-stat-done">0/${t1Total}</strong><span>ô</span>
            </div>
            <div class="ws-t1-stat"><strong id="ws-t1-stat-words">0</strong><span>từ</span></div>
            <div class="ws-t1-stat" id="ws-t1-stat-err-wrap"><strong id="ws-t1-stat-typos">0</strong><span>lỗi</span></div>
            <button type="button" class="btn btn-primary ws-t1-cta" onclick="WritingStudio.checkTaskTest1()">Kiểm tra &amp; Sang Test 2 →</button>
          </div>
        </div>
        ${renderSmartFlowDiagram(mod, {
          editable: true,
          drafts: examState.t1NodeDrafts,
          audit: examState.t1NodeAudit,
          locked: examState.t1NodeLocked,
          clauseIdx: examState.t1NodeClauseIdx
        })}
        <div class="ws-t1-footer">
          <span class="ws-t1-footer-note">Tự do paraphrase hoặc đổi cấu trúc — chữ tiếng Việt chỉ ẩn khi bạn bấm xác nhận xong ý.</span>
          <div class="ws-t1-kb-group">
            <button type="button" class="ws-t1-kb-btn is-primary" id="ws-t1-btn-next">Xong ý này <kbd>Tab</kbd></button>
            <button type="button" class="ws-t1-kb-btn" id="ws-t1-btn-prev">Lùi ô <kbd>Shift</kbd>+<kbd>Tab</kbd></button>
          </div>
        </div>
      `;
    } else if (stage === 2) {
      const wc = String(examState.t2Paragraph || '').trim() ? String(examState.t2Paragraph).trim().split(/\s+/).length : 0;
      const aud = examState.t2Audit;
      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Dựng nguyên đoạn theo Khung Grammar</div>
            <div class="ws-t1-stage-sub">Nối các ý bên trái theo đúng cấu trúc ngữ pháp thành một đoạn văn tiếng Anh liền mạch.</div>
          </div>
          <button type="button" class="btn btn-primary ws-t1-cta" onclick="WritingStudio.checkTaskTest2()">Kiểm tra &amp; Sang Test 3 →</button>
        </div>
        <div class="ws-write-2col ws-task-2col">
          <div class="ws-pane ws-task-ref-pane">
            <div class="ws-col-lbl">Ý tiếng Việt &amp; Khung sườn Grammar</div>
            <div class="ws-gram-skeleton-list">
              ${sents.map((s, idx) => {
                const gRow = aud?.rows?.[idx];
                const cls = gRow ? (gRow.ok ? 'is-ok' : 'is-bad') : '';
                return `
                  <div class="ws-gram-skel-item ${cls}">
                    <div class="ws-gram-skel-top">
                      <span class="ws-t1-step-badge"><span class="ws-t1-step-num">${idx + 1}</span><span class="ws-t1-step-role">Câu ${idx + 1}</span></span>
                      ${gRow ? `<strong class="ws-gram-status ${gRow.ok ? 'is-ok' : 'is-bad'}">${gRow.ok ? '✓ Đạt khung' : `Thiếu: ${esc(gRow.missing.join(' / '))}`}</strong>` : ''}
                    </div>
                    <div class="ws-gram-skel-vi">${esc(s.vi || s.viBrief || '')}</div>
                    <div class="ws-gram-skel-formula">${esc(s.grammar || 'S + V + O')}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div class="ws-pane ws-task-write-pane">
            <div class="ws-task-write-head">
              <div class="ws-col-lbl" style="margin:0;">Đoạn văn của bạn</div>
              <span class="ws-pill tabular" id="ws-t2-wc">${wc} từ</span>
            </div>
            <textarea class="ws-para-editor ws-task-editor" id="ws-t2-para"
              placeholder="Viết liền mạch nguyên đoạn văn tiếng Anh gồm ${sents.length} câu bám sát ý và khung Grammar bên trái..."
              oninput="WritingStudio.saveT2Paragraph(this.value)"
              onpaste="${!isTeacherBypass() ? "event.preventDefault(); WritingStudio.toastMsg('Không được dán bài — hãy tự gõ trực tiếp!');" : ''}">${esc(examState.t2Paragraph || '')}</textarea>
            ${(aud?.typos?.length || aud?.gramErrs?.length) ? `
              <div class="ws-chk-tags">
                ${(aud.typos || []).map((tp) => `<span class="ws-chk-tag miss">✕ Sai chính tả: "${esc(tp)}"</span>`).join('')}
                ${(aud.gramErrs || []).map((ge) => `<span class="ws-chk-tag miss">✕ ${esc(ge)}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else {
      const prompts = examState.prompts || [];
      const curPrompt = prompts[examState.promptIdx] || { type: 'IELTS Writing Task 2', prompt: mod.title, bodyGuide: [], paraphrases: [] };
      const wc = String(examState.t3Body || '').trim() ? String(examState.t3Body).trim().split(/\s+/).length : 0;
      const aud = examState.t3Audit;
      const modelParagraph = sents.map((s) => s.enKey).join(' ');
      const cleanParas = cleanPromptParaphrases(curPrompt);
      const focusVi = mod.bodyFocusVi || `mạch lập luận của ${flowLabel(mod)}`;

      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Viết đoạn Body thực chiến trên Đề thi thật</div>
            <div class="ws-t1-stage-sub">Vận dụng độc lập Flow, Grammar và từ vựng vừa luyện để viết 01 đoạn Body tối thiểu 85 từ.</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            ${!examState.t3Finalized
              ? `<button type="button" class="btn btn-primary ws-t1-cta" onclick="WritingStudio.submitTaskTest3()">${aud ? `Nộp lại · Còn ${examState.t3RetriesLeft} lượt` : 'Nộp đoạn Body & Chấm bài'}</button>`
              : `
                ${curPrompt.id ? `
                  <button type="button" class="btn btn-primary ws-t1-cta" onclick="WritingStudio.launchPracticeFromTask('${esc(curPrompt.id)}', 'practice')">Viết bài hoàn chỉnh →</button>
                  <button type="button" class="btn" onclick="WritingStudio.launchPracticeFromTask('${esc(curPrompt.id)}', 'exam')">Thi thật 40p</button>
                ` : ''}
                <button type="button" class="btn" onclick="WritingStudio.closeTaskExamModal(true)">Hoàn tất Task ✓</button>
              `}
          </div>
        </div>

        <div class="ws-write-2col ws-task-2col">
          <div class="ws-pane ws-task-ref-pane">
            <div class="ws-task-write-head">
              <div class="ws-col-lbl" style="margin:0;">Đề thi thật IELTS Task 2</div>
              ${prompts.length > 1 && !examState.t3Finalized ? `
                <div style="display:flex;gap:4px;">
                  ${prompts.map((_, pIdx) => `<button type="button" class="ws-pill ws-prompt-sw ${pIdx === examState.promptIdx ? 'is-active' : ''}" onclick="WritingStudio.selectT3Prompt(${pIdx})">Đề ${pIdx + 1}</button>`).join('')}
                </div>
              ` : ''}
            </div>
            <div class="ws-prompt-box ws-task-prompt-card">
              <span class="ws-type-pill">${esc(curPrompt.type || 'Task 2')}</span>
              <div class="ws-prompt-q">${esc(curPrompt.prompt)}</div>
              <div class="ws-task-focus-note">
                <strong>Trọng tâm đoạn Body:</strong> Viết 01 đoạn Body từ 90–140 từ giải quyết phần <strong>${esc(focusVi)}</strong> bằng mạch lập luận vừa học.
              </div>
            </div>
          </div>

          <div class="ws-pane ws-task-write-pane">
            <div class="ws-task-write-head">
              <div class="ws-col-lbl" style="margin:0;">Đoạn Body của bạn</div>
              <span class="ws-pill tabular ${wc >= 85 ? 'ok' : ''}" id="ws-t3-wc">${wc} / 85+ từ</span>
            </div>
            <textarea class="ws-para-editor ws-task-editor ${examState.t3Finalized ? 'is-submitted' : ''}" id="ws-t3-body" ${examState.t3Finalized ? 'readonly' : ''}
              placeholder="Mở đoạn paraphrase đề bài → Triển khai nhân quả theo Flow → Từ vựng và cấu trúc học thuật..."
              oninput="WritingStudio.saveT3Body(this.value)"
              onpaste="${!isTeacherBypass() ? "event.preventDefault(); WritingStudio.toastMsg('Không được dán bài — hãy tự viết như thi thật!');" : ''}">${esc(examState.t3Body || '')}</textarea>

            ${aud && !examState.t3Finalized ? `
              <div class="ws-chk-tags">
                ${aud.typos.map((tp) => `<span class="ws-chk-tag miss">✕ Sai chính tả: "${esc(tp)}"</span>`).join('')}
                ${!aud.lenOk ? '<span class="ws-chk-tag miss">✕ Đoạn Body cần tối thiểu 85 từ</span>' : ''}
                ${!aud.vocabOk ? '<span class="ws-chk-tag miss">✕ Hãy vận dụng ít nhất 3 cụm từ học thuật của bài</span>' : ''}
                ${!aud.gramOk ? '<span class="ws-chk-tag miss">✕ Hãy vận dụng ít nhất 2 cấu trúc Grammar của bài</span>' : ''}
              </div>
            ` : ''}

            ${examState.t3Finalized ? `
              <div class="ws-key-box">
                <div style="font-size:14.5px;font-weight:800;color:var(--ok);">Chấm điểm Đoạn Body: Band ${Number(examState.finalBand || 7.5).toFixed(1)}</div>
                <div class="ws-criteria-grid">
                  <div class="ws-crit-cell"><div class="ws-crit-lbl">Task Response</div><div class="ws-crit-val">${Number(aud?.tr || 7.5).toFixed(1)}</div></div>
                  <div class="ws-crit-cell"><div class="ws-crit-lbl">Coherence &amp; Flow</div><div class="ws-crit-val">${Number(aud?.cc || 7.5).toFixed(1)}</div></div>
                  <div class="ws-crit-cell"><div class="ws-crit-lbl">Lexical &amp; Spelling</div><div class="ws-crit-val">${Number(aud?.lr || 7.5).toFixed(1)}</div></div>
                  <div class="ws-crit-cell"><div class="ws-crit-lbl">Grammar Range</div><div class="ws-crit-val">${Number(aud?.gra || 7.5).toFixed(1)}</div></div>
                </div>
                <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);">
                  <div style="font-size:12px;font-weight:800;text-transform:uppercase;color:var(--accent);margin-bottom:5px;">Đoạn Body Mẫu Band 8.5+ · Giáo Trình Gốc</div>
                  <p style="font-size:13.8px;line-height:1.68;color:var(--ink);text-align:left;">${esc(modelParagraph)}</p>
                </div>
                ${curPrompt.bodyGuide?.length ? `
                  <div style="margin-top:8px;font-size:12.5px;line-height:1.55;color:var(--ink-2);">
                    <strong>Gợi ý ráp vào đề thi này:</strong><br>${curPrompt.bodyGuide.map((g) => `• ${esc(g)}`).join('<br>')}
                  </div>
                ` : ''}
                ${cleanParas.length ? `
                  <div style="margin-top:6px;font-size:12.5px;line-height:1.55;color:var(--ink-2);">
                    <strong>Paraphrase đề thi:</strong> ${cleanParas.slice(0, 4).map(esc).join(' · ')}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    const stepItems = [
      { n: 1, lbl: 'Flow VI → EN' },
      { n: 2, lbl: 'Khung Grammar' },
      { n: 3, lbl: 'Viết Body Đề Thật' }
    ];
    const stepperHtml = stepItems.map((st, idx) => {
      const cls = stage === st.n ? 'active' : (stage > st.n ? 'done' : '');
      const numDisp = stage > st.n ? '✓' : String(st.n);
      const clickAttr = canJump ? `onclick="WritingStudio.teacherJumpExam(${st.n})" title="Chuyển nhanh sang Test ${st.n}"` : '';
      const tag = canJump ? 'button' : 'span';
      const sep = idx > 0 ? `<span class="ws-stepper-line ${stage >= st.n ? 'is-lit' : ''}" aria-hidden="true"></span>` : '';
      return `${sep}<${tag} ${canJump ? 'type="button"' : ''} class="ws-step-pill is-v2 ${cls} ${canJump ? 'is-clickable' : ''}" ${clickAttr}><span class="ws-step-dot">${numDisp}</span><span>${st.lbl}</span></${tag}>`;
    }).join('');

    card.innerHTML = `
      <div class="ws-modal-head ws-task-topbar">
        <div class="ws-task-topbar-left">
          <button type="button" class="ws-task-back-btn" onclick="WritingStudio.requestExitTaskExam()" title="Thoát bài tập">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
            <span>Thoát</span>
          </button>
          <div class="ws-modal-title">${esc(flowLabel(mod))}</div>
        </div>
        <div class="ws-step-pills is-stepper">${stepperHtml}</div>
        <div class="ws-task-topbar-right">
          <span class="ws-pill ws-timer-chip tabular ${examState.stageSecsLeft <= 60 ? 'urgent' : ''}" id="ws-exam-timer">${clockSvg}<span>${fmtMmSs(examState.stageSecsLeft)}</span></span>
        </div>
      </div>
      ${bodyHtml}
    `;
    if (stage === 1) bindT1InlineFlow();
  }

  function teacherJumpExam(stageNum) {
    if (!examState || !isTeacherBypass()) return;
    advanceTaskStage(stageNum);
  }

  /* Stage 1 Handlers: Inline Tab-Controlled Monkeytype Flow + Live Spelling Check */
  const t1IdleTimers = new WeakMap();

  function saveT1NodeDraft(nodeKey, val) {
    if (examState) examState.t1NodeDrafts[nodeKey] = val;
  }

  function getFlowNodeSpecList(mod) {
    const sf = mod?.smartFlow;
    const list = [];
    if (!sf) return list;
    if (sf.mode === 'branches') {
      (sf.rows || []).forEach((row, rIdx) => {
        (row.nodes || []).forEach((nd, cIdx) => {
          list.push({
            key: `${rIdx}_${cIdx}`,
            cue: nd,
            keys: sf.nodeKeys?.[rIdx]?.[cIdx] || []
          });
        });
      });
    } else {
      (sf.stages || []).forEach((st, sIdx) => {
        list.push({
          key: `s_${sIdx}`,
          cue: st.text || '',
          keys: sf.nodeKeys?.[sIdx] || []
        });
      });
    }
    return list;
  }

  function renderT1MirrorTokens(text, isAtEnd, targetPhrases) {
    if (!text) return { html: '', typos: 0 };
    const parts = text.match(/(\s+|\S+)/g) || [];
    const typoList = detectSpellingTypos(text, targetPhrases);
    const typoSet = new Set(typoList.map((w) => w.toLowerCase()));
    let typos = 0;
    const html = parts.map((part, idx) => {
      if (/^\s+$/.test(part)) return esc(part);
      const isLastActiveWord = isAtEnd && idx === parts.length - 1 && !/[.,;:!?)]$/.test(part);
      const cleanWord = part.toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
      const isBad = !isLastActiveWord && cleanWord.length >= 3 && (COMMON_IELTS_TYPOS.has(cleanWord) || typoSet.has(cleanWord));
      if (isBad) {
        typos++;
        return `<span class="ws-t1-tok-err">${esc(part)}</span>`;
      }
      return `<span class="ws-t1-tok-ok">${esc(part)}</span>`;
    }).join('');
    return { html, typos };
  }

  function positionT1Caret(wrapEl, caretEl, isFocused, isTypingEvent) {
    if (!wrapEl || !caretEl) return;
    if (!isFocused) {
      clearTimeout(t1IdleTimers.get(caretEl));
      t1IdleTimers.delete(caretEl);
      caretEl.classList.remove('is-visible', 'is-idle');
      return;
    }
    const anchor = wrapEl.querySelector('.ws-t1-anchor');
    if (!anchor) return;
    const wrapRect = wrapEl.getBoundingClientRect();
    const anchorRect = anchor.getBoundingClientRect();
    const x = Math.round(anchorRect.left - wrapRect.left);
    const y = Math.round(anchorRect.top - wrapRect.top + (anchorRect.height - caretEl.offsetHeight) * 0.5);
    caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    caretEl.classList.add('is-visible');
    if (isTypingEvent) {
      caretEl.classList.remove('is-idle');
      clearTimeout(t1IdleTimers.get(caretEl));
      t1IdleTimers.set(caretEl, setTimeout(() => caretEl.classList.add('is-idle'), 450));
    } else if (!t1IdleTimers.has(caretEl)) {
      caretEl.classList.add('is-idle');
    }
  }

  function bindT1InlineFlow() {
    if (!examState || examState.stage !== 1) return;
    const mod = examState.mod;
    const specs = getFlowNodeSpecList(mod);
    const specMap = {};
    specs.forEach((s) => { specMap[s.key] = s; });
    const allPhrases = (mod.vocab || []).map((v) => v.en);
    const card = document.getElementById('ws-task-exam-card');
    if (!card) return;

    const entries = [];
    const typoByNode = {};

    const updateTelemetry = () => {
      let doneCnt = 0;
      let wordCnt = 0;
      let typoCnt = 0;
      entries.forEach((en) => {
        const val = en.ta.value.trim();
        if (val) wordCnt += val.split(/\s+/).length;
        const locked = Boolean(examState.t1NodeLocked[en.key]);
        const cIdx = Number(examState.t1NodeClauseIdx[en.key] || 0);
        if (locked || (cIdx >= en.clauses.length && val.length > 0)) doneCnt++;
        typoCnt += typoByNode[en.key] || 0;
      });
      const total = entries.length || 1;
      const doneEl = document.getElementById('ws-t1-stat-done');
      const wordEl = document.getElementById('ws-t1-stat-words');
      const typoEl = document.getElementById('ws-t1-stat-typos');
      const errWrap = document.getElementById('ws-t1-stat-err-wrap');
      const ringFg = document.getElementById('ws-t1-ring-fg');
      if (doneEl) doneEl.textContent = `${doneCnt}/${entries.length}`;
      if (wordEl) wordEl.textContent = String(wordCnt);
      if (typoEl) typoEl.textContent = String(typoCnt);
      if (errWrap) errWrap.classList.toggle('is-err', typoCnt > 0);
      if (ringFg) ringFg.style.strokeDashoffset = (44 * (1 - doneCnt / total)).toFixed(2);
    };

    const syncEntry = (en, isTypingEvent) => {
      if (!examState) return;
      const val = en.ta.value;
      examState.t1NodeDrafts[en.key] = val;
      const locked = Boolean(examState.t1NodeLocked[en.key]);
      if (!val.trim() && !locked) examState.t1NodeClauseIdx[en.key] = 0;
      const activeIdx = locked ? en.clauses.length : Number(examState.t1NodeClauseIdx[en.key] || 0);

      const sel = en.ta.selectionStart ?? val.length;
      const before = val.slice(0, sel);
      const after = val.slice(sel);
      const tBefore = renderT1MirrorTokens(before, after.length === 0, en.targetPhrases);
      const tAfter = renderT1MirrorTokens(after, true, en.targetPhrases);
      typoByNode[en.key] = tBefore.typos + tAfter.typos;

      let viHtml = '';
      if (activeIdx < en.clauses.length) {
        const gap = val.length > 0 ? (!/\s$/.test(val) ? '<span class="ws-t1-gap"></span>' : '<span class="ws-t1-pad"></span>') : '';
        const activeTxt = `<span class="ws-t1-vi-active">${esc(en.clauses[activeIdx])}</span>`;
        const restTxt = en.clauses.slice(activeIdx + 1).map((c) => esc(c)).join(' ');
        viHtml = `${gap}${activeTxt}${restTxt ? ` <span class="ws-t1-vi-upcoming">${restTxt}</span>` : ''}`;
      }

      en.mirror.innerHTML = `${tBefore.html}<span class="ws-t1-anchor"></span>${tAfter.html}${viHtml}`;
      en.ta.style.height = `${Math.max(54, en.mirror.scrollHeight)}px`;

      const isDone = locked || (activeIdx >= en.clauses.length && val.trim().length > 0);
      en.cell.classList.toggle('is-done', isDone);
      if (en.arrowAfter) en.arrowAfter.classList.toggle('is-lit', isDone);

      updateTelemetry();
      requestAnimationFrame(() => positionT1Caret(en.wrap, en.caret, en.focused && !locked, isTypingEvent));
    };

    const stepFocusedNode = (dir) => {
      const idx = entries.findIndex((e) => e.key === examState.t1FocusedKey);
      const targetIdx = idx >= 0 ? idx : 0;
      const en = entries[targetIdx];
      if (!en) return;
      const locked = Boolean(examState.t1NodeLocked[en.key]);
      let cIdx = Number(examState.t1NodeClauseIdx[en.key] || 0);
      if (dir < 0) {
        if (!locked && cIdx > 0) {
          examState.t1NodeClauseIdx[en.key] = cIdx - 1;
          syncEntry(en, true);
          en.ta.focus();
        } else if (targetIdx > 0) {
          entries[targetIdx - 1].ta.focus();
        }
      } else {
        if (!locked && en.ta.value.trim().length > 0 && cIdx < en.clauses.length) {
          if (cIdx < en.clauses.length - 1 && !/\s$/.test(en.ta.value)) {
            en.ta.value += ' ';
            en.ta.selectionStart = en.ta.selectionEnd = en.ta.value.length;
          }
          examState.t1NodeClauseIdx[en.key] = cIdx + 1;
          syncEntry(en, true);
          if (examState.t1NodeClauseIdx[en.key] >= en.clauses.length && targetIdx < entries.length - 1) {
            entries[targetIdx + 1].ta.focus();
          }
        } else if (targetIdx < entries.length - 1) {
          entries[targetIdx + 1].ta.focus();
        }
      }
    };

    card.querySelectorAll('.ws-t1-cell[data-t1-key]').forEach((cell) => {
      const key = cell.getAttribute('data-t1-key');
      const spec = specMap[key] || { cue: '', keys: [] };
      const wrap = cell.querySelector('.ws-t1-wrap');
      const mirror = cell.querySelector('.ws-t1-mirror');
      const caret = cell.querySelector('.ws-t1-caret');
      const ta = cell.querySelector('.ws-t1-ta');
      if (!wrap || !mirror || !caret || !ta) return;

      const entry = {
        key,
        cell,
        wrap,
        mirror,
        caret,
        ta,
        clauses: splitFlowCueClauses(spec.cue),
        targetPhrases: [...(spec.keys || []), ...allPhrases],
        arrowAfter: card.querySelector(`.ws-t1-arrow[data-t1-arrow-after="${key}"]`),
        focused: false
      };
      entries.push(entry);

      cell.addEventListener('mousedown', (e) => {
        if (e.target !== ta && !ta.readOnly) {
          e.preventDefault();
          ta.focus();
        }
      });
      ta.addEventListener('focus', () => {
        entry.focused = true;
        examState.t1FocusedKey = key;
        cell.classList.add('is-focused');
        syncEntry(entry, false);
      });
      ta.addEventListener('blur', () => {
        entry.focused = false;
        cell.classList.remove('is-focused');
        syncEntry(entry, false);
      });
      ta.addEventListener('input', () => {
        if (examState.t1NodeAudit && examState.t1NodeAudit[key] && !examState.t1NodeAudit[key].pass) {
          cell.classList.remove('is-bad');
          const errEl = cell.querySelector('.ws-sf-node-err');
          if (errEl) errEl.remove();
        }
        syncEntry(entry, true);
      });
      ta.addEventListener('keyup', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
          syncEntry(entry, true);
        }
      });
      ta.addEventListener('click', () => syncEntry(entry, true));
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' || e.key === 'Enter') {
          e.preventDefault();
          examState.t1FocusedKey = key;
          stepFocusedNode(e.key === 'Tab' && e.shiftKey ? -1 : 1);
        }
      });
    });

    const btnNext = document.getElementById('ws-t1-btn-next');
    const btnPrev = document.getElementById('ws-t1-btn-prev');
    if (btnNext) btnNext.addEventListener('mousedown', (e) => { e.preventDefault(); stepFocusedNode(1); });
    if (btnPrev) btnPrev.addEventListener('mousedown', (e) => { e.preventDefault(); stepFocusedNode(-1); });

    entries.forEach((en) => syncEntry(en, false));
  }

  function checkTaskTest1() {
    if (!examState) return;
    const mod = examState.mod;
    const nodes = getFlowNodeSpecList(mod);
    const allPhrases = (mod.vocab || []).map((v) => v.en);
    const allDraftVals = nodes.map((n) => String(examState.t1NodeDrafts[n.key] || '').trim());

    if (isTeacherBypass() && allDraftVals.every((v) => !v)) {
      advanceTaskStage(2);
      return;
    }

    const auditMap = {};
    let allPass = true;
    nodes.forEach((n) => {
      const raw = String(examState.t1NodeDrafts[n.key] || '').trim();
      const low = raw.toLowerCase();
      const words = (raw.match(/[A-Za-z'-]+/g) || []);
      if (!raw) {
        auditMap[n.key] = { pass: false, msg: '✕ Chưa gõ tiếng Anh' };
        allPass = false;
        return;
      }
      const typos = detectSpellingTypos(raw, [...n.keys, ...allPhrases]);
      words.forEach((w) => {
        const lw = w.toLowerCase();
        if (COMMON_IELTS_TYPOS.has(lw) && !typos.some((t) => t.toLowerCase() === lw)) typos.push(w);
      });
      if (typos.length > 0) {
        auditMap[n.key] = { pass: false, msg: `✕ Sai chính tả: ${typos.map((t) => `"${t}"`).join(', ')}` };
        allPass = false;
        return;
      }
      const keyHit = n.keys.length === 0 || n.keys.some((k) => low.includes(String(k).toLowerCase()))
        || allPhrases.some((ph) => low.includes(ph.toLowerCase()));
      if (words.length < 2 || !keyHit) {
        auditMap[n.key] = { pass: false, msg: '✕ Chưa thể hiện đúng từ khóa cốt lõi của mắt xích này' };
        allPass = false;
        return;
      }
      examState.t1NodeLocked[n.key] = true;
      examState.t1NodeClauseIdx[n.key] = 99;
      auditMap[n.key] = { pass: true, msg: '' };
    });

    examState.t1NodeAudit = auditMap;
    if (allPass) {
      toast('Diễn đạt toàn bộ sơ đồ Flow sang Tiếng Anh chuẩn xác! Mở khóa Test 2.');
      setTimeout(() => {
        if (!examState) return;
        advanceTaskStage(2);
      }, 450);
    } else {
      renderExamModal();
      toast('Một số ô trong sơ đồ còn thiếu hoặc sai chính tả (báo đỏ) — hãy sửa lại ngay trong ô đó!');
    }
  }

  /* Stage 2 Handlers: Grammar Skeleton -> Cohesive Paragraph */
  function saveT2Paragraph(val) {
    if (!examState) return;
    examState.t2Paragraph = val;
    const wc = String(val || '').trim() ? String(val).trim().split(/\s+/).length : 0;
    const el = document.getElementById('ws-t2-wc');
    if (el) el.textContent = `${wc} words`;
  }

  function checkTaskTest2() {
    if (!examState) return;
    const raw = String(examState.t2Paragraph || '').trim();
    if (isTeacherBypass() && !raw) {
      advanceTaskStage(3);
      return;
    }
    const low = raw.toLowerCase();
    const sents = examState.mod.sentences || [];
    const allPhrases = (examState.mod.vocab || []).map((v) => v.en);
    const typos = detectSpellingTypos(raw, allPhrases);
    const gramErrs = detectIeltsGrammarErrors(raw);

    const rows = sents.map((s) => {
      const gList = s.mustGrammar || [];
      const ok = gList.length === 0 || gList.some((g) => low.includes(g.toLowerCase()));
      const missing = ok ? [] : gList;
      return { ok, missing };
    });

    const passedRows = rows.filter((r) => r.ok).length;
    const minNeed = Math.max(1, sents.length - 1);
    const wc = raw ? raw.split(/\s+/).length : 0;
    examState.t2Audit = { rows, typos, gramErrs };

    if (wc >= sents.length * 8 && passedRows >= minNeed && typos.length === 0 && gramErrs.length === 0) {
      toast('Đoạn văn bám sát Khung Grammar & chuẩn chính tả! Mở khóa Test 3 Đề thi thật.');
      setTimeout(() => {
        if (!examState) return;
        advanceTaskStage(3);
      }, 550);
    } else {
      renderExamModal();
      if (typos.length > 0) toast(`Phát hiện từ gõ sai chính tả (${typos.join(', ')}) — hãy sửa lại!`);
      else if (gramErrs.length > 0) toast(`Còn lỗi ngữ pháp: ${gramErrs[0]}`);
      else toast('Hãy viết đủ độ dài đoạn văn và vận dụng các công thức trong Khung Grammar bên trái.');
    }
  }

  /* Stage 3 Handlers: Real Exam Prompt -> Full Body Paragraph */
  function selectT3Prompt(idx) {
    if (!examState || examState.t3Finalized) return;
    examState.promptIdx = idx;
    renderExamModal();
  }

  function saveT3Body(val) {
    if (!examState) return;
    examState.t3Body = val;
    const wc = String(val || '').trim() ? String(val).trim().split(/\s+/).length : 0;
    const el = document.getElementById('ws-t3-wc');
    if (el) {
      el.textContent = `${wc} / 85+ words`;
      el.classList.toggle('ok', wc >= 85);
    }
  }

  function submitTaskTest3() {
    if (!examState || examState.t3Finalized) return;
    const raw = String(examState.t3Body || '').trim();
    const low = raw.toLowerCase();
    const wc = raw ? raw.split(/\s+/).length : 0;
    const mod = examState.mod;
    const sents = mod.sentences || [];
    const allPhrases = (mod.vocab || []).map((v) => v.en);
    const allGram = sents.flatMap((s) => s.mustGrammar || []);

    const typos = detectSpellingTypos(raw, allPhrases);
    const vocabHits = allPhrases.filter((ph) => low.includes(ph.toLowerCase())).length;
    const gramHits = allGram.filter((g) => low.includes(g.toLowerCase())).length;
    const lenOk = wc >= 85;
    const vocabOk = vocabHits >= Math.min(3, Math.max(1, allPhrases.length));
    const gramOk = gramHits >= Math.min(2, Math.max(1, allGram.length));

    const tr = lenOk ? (wc >= 105 ? 8.0 : 7.5) : 6.0;
    const cc = gramOk ? 8.0 : 6.5;
    const lr = (vocabHits >= 4 && typos.length === 0) ? 8.0 : (vocabOk && typos.length === 0 ? 7.5 : 6.0);
    const gra = (gramHits >= 3) ? 8.0 : (gramOk ? 7.5 : 6.0);

    examState.t3Audit = { typos, lenOk, vocabOk, gramOk, tr, cc, lr, gra };

    const allPass = lenOk && vocabOk && gramOk && typos.length === 0;
    if (!allPass && examState.t3RetriesLeft > 0 && !isTeacherBypass()) {
      examState.t3RetriesLeft--;
      renderExamModal();
      if (typos.length > 0) toast(`Còn lỗi chính tả ("${typos[0]}") — hãy sửa lại (còn ${examState.t3RetriesLeft + 1} lượt)!`);
      else toast(`Đoạn Body chưa đủ chuẩn (cần ≥85 từ, vận dụng cụm từ & Grammar của bài) — hãy hoàn thiện thêm!`);
      return;
    }

    const avg = (tr + cc + lr + gra) / 4;
    const band = isTeacherBypass() && !raw ? 8.5 : (Math.round(avg * 2) / 2);
    examState.finalBand = band;
    examState.t3Finalized = true;
    clearInterval(examState.timerId);

    const prog = getTaskProgMap();
    prog[mod.id] = {
      status: 'completed',
      score: vocabHits + gramHits,
      total: sents.length,
      band,
      completedAt: Date.now()
    };
    saveTaskProgMap(prog);
    B()?.syncExamLock?.(false);
    renderExamModal();
    toast(`Hoàn thành Task ${flowLabel(mod)} · Band ${band.toFixed(1)}! Đã mở Đoạn Body Mẫu Band 8.5+ & Paraphrase đề thi.`);
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
            <p class="tot-shell-sub">Ngân hàng ${prompts.length} đề thi thật giai đoạn 2020–2026 liên kết trực tiếp với ${(DATA().MODULES || []).length} Module Flow Idea.</p>
          </div>
          <span class="ws-pill tabular">${doneSet.size} / ${prompts.length} đề đã luyện</span>
        </div>

        <div class="ws-prac-toolbar">
          <div class="ws-prac-toolbar-top">
            <div class="ws-prac-subtabs" role="tablist" aria-label="Lọc theo Subtopic">
              <button type="button" class="ws-prac-subtab ${state.pracSubtopic === 'all' ? 'active' : ''}" onclick="WritingStudio.setPracSubtopic('all')">Tất cả</button>
              ${subtopics.map((st) => {
                return `<button type="button" class="ws-prac-subtab ${state.pracSubtopic === st.key ? 'active' : ''}" onclick="WritingStudio.setPracSubtopic('${esc(st.key)}')">${esc(st.shortTitle)}</button>`;
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
                    ${isTeacherBypass() ? `<button type="button" class="rp-btn-assign" style="grid-column:1 / -1;padding:6px 10px;font-size:12px;" onclick="event.stopPropagation(); window.TeacherStudio?.openPracticeAssignModal?.({ skill: 'writing', itemId: '${esc(p.id)}', isFull: false, title: '${esc(String(p.prompt || '').slice(0, 80)).replace(/'/g, "\\'")}', subtitle: '${esc(p.type || 'Task 2').replace(/'/g, "\\'")}' })" title="Tạo link giao đề Writing này cho học sinh">🔗 Giao link đề này</button>` : ''}
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

  function launchPracticeFromTask(promptId, mode) {
    if (!promptId) return;
    if (examState) closeTaskExamModal(true);
    startPracticePrompt(promptId, mode || 'practice');
  }

  function startPracticePrompt(promptId, mode) {
    ensureOverlays();
    const lock = getLockout(PRAC_LOCK_KEY_BASE);
    if (lock) {
      showAntiCheatModal(
        mode === 'exam' ? 'TẠM KHÓA PHÒNG THI WRITING' : 'TẠM KHÓA PHÒNG LUYỆN WRITING',
        `Phòng viết đang bị tạm khóa do vi phạm chống gian lận. Mở lại sau ${fmtMmSs(lock.remainingMs / 1000)}.`,
        true
      );
      return;
    }
    const p = (DATA().PRACTICE_PROMPTS || []).find((x) => x.id === promptId);
    if (!p) return;

    pracState = {
      prompt: p,
      mode, // 'practice' | 'exam'
      secsLeft: 40 * 60,
      startedAt: Date.now(),
      strikes: 0,
      submitted: false,
      timerId: null,
      contrast: mode === 'exam' ? 'cd' : 'totoro', // Practice: 'totoro' | 'dark'; Exam: 'cd' | 'totoro' | 'dark' | 'yellow'
      textSize: 'regular', // Practice: 'regular' (Vừa 17px) | 'large' (Lớn 19px)
      showExactSec: false,
      optionsOpen: false,
      planningOpen: true,
      splitRatio: mode === 'exam' ? 46 : 37
    };

    const isExam = mode === 'exam';
    const initContrast = pracState.contrast;
    const acGuardAttrs = !isTeacherBypass()
      ? `onpaste="event.preventDefault(); WritingStudio.toastMsg('Chống gian lận: Không được dán văn bản vào phòng viết!');" ondrop="event.preventDefault(); WritingStudio.toastMsg('Chống gian lận: Không được kéo thả văn bản!');"`
      : '';
    const editorAcAttrs = !isTeacherBypass()
      ? `${acGuardAttrs} oncopy="event.preventDefault(); WritingStudio.toastMsg('Chống gian lận: Không sao chép trong lúc làm bài!');" oncut="event.preventDefault();" oncontextmenu="event.preventDefault();"`
      : '';

    const DEFAULT_PLAN_TEMPLATE = [
      '1. Intro (Paraphrase + Thesis):',
      '- ',
      '',
      '2. Body 1 (Ý chính → Cơ chế → Hệ quả):',
      '- ',
      '',
      '3. Body 2 (Ý chính → Cơ chế → Ví dụ):',
      '- ',
      '',
      '4. Conclusion (Tóm tắt & chốt lập trường):',
      '- '
    ].join('\n');

    const planningHtml = !isExam ? `
      <div class="ws-ins-plan-card ws-plan-single-card" id="ws-ins-plan-card">
        <div class="ws-ins-plan-head">
          <div class="ws-ins-plan-title-wrap">
            <span class="ws-ins-plan-title">Planning · Dàn ý</span>
          </div>
          <div class="ws-ins-plan-actions">
            <button type="button" class="ws-ins-plan-btn" onclick="WritingStudio.clearPracPlan()" title="Đặt lại khung dàn ý trống">Đặt lại</button>
            <button type="button" class="ws-ins-plan-btn" id="ws-ins-plan-toggle" onclick="WritingStudio.togglePracPlan()">Thu gọn</button>
          </div>
        </div>
        <div class="ws-ins-plan-body ws-plan-single-body" id="ws-ins-plan-body">
          <textarea class="ws-ins-plan-ta ws-plan-single-ta" id="ws-plan-notes" spellcheck="false" ${acGuardAttrs}>${esc(DEFAULT_PLAN_TEMPLATE)}</textarea>
        </div>
      </div>
    ` : '';

    const headerBrandHtml = isExam
      ? `<span class="ins-brand-mark">IELTS</span>`
      : `<span class="ws-prac-brand-badge" aria-hidden="true">
           <svg viewBox="2 2 24 24" width="22" height="22" fill="none">
             <path d="M8.5 11.2L7 5.6L11.2 9C12.5 8.5 14 8.5 15.3 9L19.5 5.6L18 11.2C20.2 12.8 21.2 15.2 21 18.2C20.7 21.5 17.8 23.2 13.2 23.2C8.6 23.2 5.7 21.5 5.4 18.2C5.2 15.2 6.2 12.8 8.5 11.2Z" fill="#6F6B64" stroke="#484540" stroke-width="1.1"/>
             <path d="M13.2 8.4C14.8 5.4 17.5 5 19.2 6.6C17.4 8.3 15 8.8 13.2 8.4Z" fill="#52A063" stroke="#2D6A3B" stroke-width="0.9"/>
             <ellipse cx="13.2" cy="18.8" rx="5.2" ry="3.4" fill="#FBF6E8"/>
             <circle cx="10.6" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="10.8" cy="13.5" r="0.75" fill="#181A1F"/>
             <circle cx="15.8" cy="13.5" r="1.5" fill="#FFFFFF"/><circle cx="15.6" cy="13.5" r="0.75" fill="#181A1F"/>
           </svg>
         </span>`;

    const headerAcChipHtml = `
      <span class="rp-ac-shield" id="ws-prac-ac-pill" title="Chống gian lận đang bật: chặn dán, sao chép &amp; rời tab (tối đa 2 lần)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span id="ws-prac-ac-text">Anti-Cheat</span>
      </span>
    `;

    const optionsPopoverHtml = isExam
      ? `
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Contrast</div>
          <div class="ws-ins-opt-grid">
            <button type="button" class="ws-ins-opt-choice ${initContrast === 'cd' ? 'active' : ''}" data-contrast="cd" onclick="WritingStudio.setPracContrast('cd')">Black on White</button>
            <button type="button" class="ws-ins-opt-choice ${initContrast === 'totoro' ? 'active' : ''}" data-contrast="totoro" onclick="WritingStudio.setPracContrast('totoro')">Totoro Washi</button>
            <button type="button" class="ws-ins-opt-choice" data-contrast="dark" onclick="WritingStudio.setPracContrast('dark')">White on Black</button>
            <button type="button" class="ws-ins-opt-choice" data-contrast="yellow" onclick="WritingStudio.setPracContrast('yellow')">Yellow on Black</button>
          </div>
        </div>
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Text size</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice active" data-size="regular" onclick="WritingStudio.setPracTextSize('regular')">Regular</button>
            <button type="button" class="ws-ins-opt-choice" data-size="large" onclick="WritingStudio.setPracTextSize('large')">Large</button>
            <button type="button" class="ws-ins-opt-choice" data-size="xlarge" onclick="WritingStudio.setPracTextSize('xlarge')">Extra large</button>
          </div>
        </div>
      `
      : `
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Màu sắc</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${initContrast === 'totoro' ? 'active' : ''}" data-contrast="totoro" onclick="WritingStudio.setPracContrast('totoro')">Totoro Sáng</button>
            <button type="button" class="ws-ins-opt-choice ${initContrast === 'dark' ? 'active' : ''}" data-contrast="dark" onclick="WritingStudio.setPracContrast('dark')">Chế độ Tối</button>
          </div>
        </div>
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Cỡ chữ viết</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice active" data-size="regular" onclick="WritingStudio.setPracTextSize('regular')">Vừa</button>
            <button type="button" class="ws-ins-opt-choice" data-size="large" onclick="WritingStudio.setPracTextSize('large')">Lớn</button>
          </div>
        </div>
      `;

    const rightEditorHtml = isExam
      ? `
        <div class="ws-ins-editor-wrap">
          <textarea class="ws-ins-editor" id="ws-prac-editor" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
            aria-label="IELTS Writing Task 2 response"
            oninput="WritingStudio.updatePracWC()"
            ${editorAcAttrs}></textarea>
          <div class="ws-ins-wc-row">
            <span class="ws-ins-wc-val" id="ws-prac-wc">Words: 0</span>
          </div>
        </div>
      `
      : `
        <div class="ws-prac-paper-card" id="ws-prac-paper-card">
          <div class="ws-prac-paper-head">
            <div class="ws-prac-paper-title-grp">
              <span class="ws-prac-paper-ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </span>
              <span class="ws-prac-paper-title">Bài viết Task 2</span>
              <span class="ws-prac-para-pill tabular" id="ws-prac-paras">0 đoạn</span>
            </div>
            <div class="ws-prac-paper-badges">
              <span class="ws-prac-wc-pill tabular" id="ws-prac-wc">0 / 250 từ</span>
            </div>
          </div>
          <div class="ws-prac-paper-meter" aria-hidden="true">
            <span class="ws-prac-paper-meter-fill" id="ws-prac-wc-bar" style="width:0%"></span>
          </div>
          <textarea class="ws-ins-editor ws-prac-editor" id="ws-prac-editor" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off"
            aria-label="IELTS Writing Task 2 response"
            placeholder="Bắt đầu viết bài Task 2 của bạn tại đây..."
            oninput="WritingStudio.updatePracWC()"
            ${editorAcAttrs}></textarea>
          <div class="ws-prac-paper-foot">
            <div class="ws-prac-paper-foot-l">
              <span class="ws-prac-wc-note" id="ws-prac-wc-note">Còn thiếu 250 từ để đạt mốc chuẩn IELTS</span>
            </div>
            <button type="button" class="ws-prac-submit-pill" id="ws-prac-paper-submit" onclick="WritingStudio.submitPracticeEssay(false)">Nộp bài →</button>
          </div>
        </div>
      `;

    const room = document.getElementById('ws-practice-room');
    room.className = `ws-exam-room open ins-shell ins-contrast-${initContrast} ins-size-regular ${isExam ? 'is-exam' : 'is-practice'}`;
    room.innerHTML = `
      <div class="ins-main-col" onclick="WritingStudio.togglePracOptions(false)">
        <header class="ins-header ${isExam ? '' : 'ws-prac-custom-hdr'}">
          <div class="ins-hdr-left">
            ${headerBrandHtml}
            <div class="ins-hdr-meta">
              <div class="ins-hdr-title">${isExam ? 'Test taker · Academic Writing Task 2' : 'Writing Studio · Luyện tập Task 2'}</div>
              <button type="button" class="ins-hdr-timer" id="ws-prac-timer" onclick="event.stopPropagation(); WritingStudio.togglePracTimerExact()" title="Nhấn để hiện / ẩn số giây">
                <span>40 minutes remaining</span>
              </button>
            </div>
          </div>
          <div class="ins-hdr-right">
            ${headerAcChipHtml}
            <div class="ws-ins-opt-wrap" onclick="event.stopPropagation()">
              <button type="button" class="ins-hdr-ico" id="ws-prac-opt-btn" onclick="WritingStudio.togglePracOptions()" title="Màu sắc &amp; Cỡ chữ" aria-label="Options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <div class="ws-ins-opt-pop" id="ws-prac-opt-pop">
                ${optionsPopoverHtml}
              </div>
            </div>
            <button type="button" class="ins-hdr-exit" onclick="WritingStudio.requestExitPractice()">Thoát</button>
          </div>
        </header>

        ${isExam ? `
        <div class="ins-part-banner">
          <strong>Part 2</strong>
          <span>You should spend about 40 minutes on this task. Write at least 250 words.</span>
        </div>` : ''}

        <div class="ins-split-body" id="ws-ins-split">
          <section class="ins-pane ins-pane-left ws-ins-left" id="ws-ins-left" style="flex: 0 0 ${pracState.splitRatio}%;">
            ${isExam
              ? `<p class="ws-ins-lead">Write about the following topic:</p>`
              : `<div class="ws-prac-prompt-meta"><span class="ws-prac-part-badge">Task 2</span><span>~40 phút · Tối thiểu 250 từ</span></div>`}
            <div class="ws-ins-prompt-text">${esc(p.prompt)}</div>
            <p class="ws-ins-inst">Give reasons for your answer and include any relevant examples from your own knowledge or experience. Write at least 250 words.</p>
            ${planningHtml}
          </section>

          <div class="ins-resizer" id="ws-ins-resizer" title="Kéo để chia lại khung đề và khung viết" onmousedown="WritingStudio.startPracResize(event)">
            <span class="ins-resizer-box" aria-hidden="true">↔</span>
          </div>

          <section class="ins-pane ins-pane-right ws-ins-right ${isExam ? '' : 'ws-prac-right-wide'}">
            ${rightEditorHtml}
            <div id="ws-prac-result" class="ws-ins-result-card"></div>
          </section>
        </div>

        <footer class="ins-footer">
          <div class="ins-footer-parts">
            <div class="ws-ins-part-tab is-active" id="ws-ins-part-tab">
              <span class="ws-ins-part-bar" id="ws-ins-part-bar"></span>
              <span class="ins-part-lbl">Part 2</span>
              <span class="ws-ins-footer-wc" id="ws-prac-footer-wc">0 words</span>
            </div>
          </div>
          <button type="button" class="ins-submit-check-btn" id="ws-prac-submit" onclick="WritingStudio.submitPracticeEssay(false)" title="Nộp bài / Submit" aria-label="Submit">✓</button>
        </footer>
      </div>
    `;

    document.body.classList.add('rp-exam-fullscreen');
    updatePracTimerDisplay();
    setTimeout(() => document.getElementById('ws-prac-editor')?.focus(), 50);

    pracState.timerId = setInterval(() => {
      if (!pracState || pracState.submitted) return;
      pracState.secsLeft--;
      updatePracTimerDisplay();
      if (pracState.secsLeft <= 0) submitPracticeEssay(true);
    }, 1000);
  }

  function updatePracTimerDisplay() {
    if (!pracState) return;
    const el = document.getElementById('ws-prac-timer');
    if (!el) return;
    const secs = Math.max(0, pracState.secsLeft);
    const mins = Math.ceil(secs / 60);
    const mainTxt = mins === 1 ? '1 minute remaining' : `${mins} minutes remaining`;
    el.innerHTML = pracState.showExactSec
      ? `<span>${mainTxt}</span> <span class="ins-timer-exact">(${fmtMmSs(secs)})</span>`
      : `<span>${mainTxt}</span>`;
    el.classList.toggle('is-warn', secs <= 600 && secs > 300);
    el.classList.toggle('is-critical', secs <= 300);
  }

  function togglePracTimerExact() {
    if (!pracState) return;
    pracState.showExactSec = !pracState.showExactSec;
    updatePracTimerDisplay();
  }

  function togglePracOptions(forceVal) {
    if (!pracState) return;
    pracState.optionsOpen = typeof forceVal === 'boolean' ? forceVal : !pracState.optionsOpen;
    document.getElementById('ws-prac-opt-pop')?.classList.toggle('open', pracState.optionsOpen);
    document.getElementById('ws-prac-opt-btn')?.classList.toggle('active', pracState.optionsOpen);
  }

  function setPracContrast(c) {
    if (!pracState) return;
    pracState.contrast = c;
    const room = document.getElementById('ws-practice-room');
    if (room) {
      room.classList.remove('ins-contrast-cd', 'ins-contrast-totoro', 'ins-contrast-dark', 'ins-contrast-yellow');
      room.classList.add(`ins-contrast-${c}`);
    }
    document.querySelectorAll('#ws-prac-opt-pop [data-contrast]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-contrast') === c);
    });
  }

  function setPracTextSize(sz) {
    if (!pracState) return;
    pracState.textSize = sz;
    const room = document.getElementById('ws-practice-room');
    if (room) {
      room.classList.remove('ins-size-regular', 'ins-size-large', 'ins-size-xlarge');
      room.classList.add(`ins-size-${sz}`);
    }
    document.querySelectorAll('#ws-prac-opt-pop [data-size]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-size') === sz);
    });
  }

  function togglePracPlan() {
    if (!pracState) return;
    pracState.planningOpen = !pracState.planningOpen;
    const body = document.getElementById('ws-ins-plan-body');
    const btn = document.getElementById('ws-ins-plan-toggle');
    if (body) body.classList.toggle('is-collapsed', !pracState.planningOpen);
    if (btn) btn.textContent = pracState.planningOpen ? 'Thu gọn' : 'Mở Planning';
  }

  function clearPracPlan() {
    const single = document.getElementById('ws-plan-notes');
    if (single) {
      single.value = [
        '1. Intro (Paraphrase + Thesis):',
        '- ',
        '',
        '2. Body 1 (Ý chính → Cơ chế → Hệ quả):',
        '- ',
        '',
        '3. Body 2 (Ý chính → Cơ chế → Ví dụ):',
        '- ',
        '',
        '4. Conclusion (Tóm tắt & chốt lập trường):',
        '- '
      ].join('\n');
    }
    ['ws-plan-intro', 'ws-plan-b1', 'ws-plan-b2', 'ws-plan-conc'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
  }

  function startPracResize(e) {
    if (e) e.preventDefault();
    const split = document.getElementById('ws-ins-split');
    const left = document.getElementById('ws-ins-left');
    if (!split || !left) return;
    const onMove = (ev) => {
      const rect = split.getBoundingClientRect();
      const pct = Math.max(28, Math.min(68, ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100));
      left.style.flex = `0 0 ${pct.toFixed(1)}%`;
      if (pracState) pracState.splitRatio = pct;
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }

  function updatePracWC() {
    const raw = document.getElementById('ws-prac-editor')?.value || '';
    const v = raw.trim();
    const wc = v ? v.split(/\s+/).length : 0;
    const paras = v ? v.split(/\n+/).map((x) => x.trim()).filter(Boolean).length : 0;
    const pct = Math.min(100, Math.round((wc / 250) * 100));
    const isExam = pracState?.mode === 'exam';

    const el = document.getElementById('ws-prac-wc');
    const paraEl = document.getElementById('ws-prac-paras');
    const meterEl = document.getElementById('ws-prac-wc-bar');
    const noteEl = document.getElementById('ws-prac-wc-note');
    const footEl = document.getElementById('ws-prac-footer-wc');
    const barEl = document.getElementById('ws-ins-part-bar');

    if (el) {
      el.textContent = isExam ? `Words: ${wc}` : `${wc} / 250 từ`;
      el.classList.toggle('is-ok', wc >= 250);
      el.classList.toggle('is-mid', wc >= 160 && wc < 250);
    }
    if (paraEl) paraEl.textContent = `${paras} đoạn`;
    if (meterEl) {
      meterEl.style.width = `${pct}%`;
      meterEl.classList.toggle('is-ok', wc >= 250);
      meterEl.classList.toggle('is-mid', wc >= 160 && wc < 250);
    }
    if (noteEl) {
      noteEl.textContent = wc >= 250
        ? `✓ Đạt chuẩn độ dài (+${wc - 250} từ)`
        : `Còn thiếu ${250 - wc} từ để đạt mốc chuẩn IELTS`;
      noteEl.classList.toggle('is-ok', wc >= 250);
    }
    if (footEl) footEl.textContent = `${wc} ${wc === 1 ? 'word' : 'words'}`;
    if (barEl) barEl.classList.toggle('is-ready', wc >= 250);
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

    const submitBtn = document.getElementById('ws-prac-submit');
    if (submitBtn) {
      submitBtn.textContent = '←';
      submitBtn.title = 'Quay về kho đề';
      submitBtn.onclick = () => closePracticeRoom();
    }
    const paperSubmitBtn = document.getElementById('ws-prac-paper-submit');
    if (paperSubmitBtn) {
      paperSubmitBtn.textContent = '← Về kho đề';
      paperSubmitBtn.onclick = () => closePracticeRoom();
    }

    const p = pracState.prompt;
    const paras = cleanPromptParaphrases(p);
    const box = document.getElementById('ws-prac-result');
    if (box) {
      box.style.display = 'block';
      box.innerHTML = `
        <div class="ws-ins-res-title">Đã nộp bài (${wc} words) · Tham khảo Flow &amp; Paraphrase chuẩn giáo trình</div>
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
    document.body.classList.remove('rp-exam-fullscreen');
    const room = document.getElementById('ws-practice-room');
    if (room) room.className = 'ws-exam-room';
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
    if (pracState && !pracState.submitted) {
      pracState.strikes++;
      const acPill = document.getElementById('ws-prac-ac-pill');
      const acText = document.getElementById('ws-prac-ac-text');
      if (acText) acText.textContent = `Cảnh báo ${Math.min(2, pracState.strikes)}/2`;
      if (acPill) acPill.classList.add('is-warn');
      const modeLbl = pracState.mode === 'exam' ? 'thi thật' : 'luyện viết';
      if (pracState.strikes >= 2) {
        // Locked rule: keep current answers, grade immediately, lock 30 minutes!
        submitPracticeEssay(true);
        setLockout(PRAC_LOCK_KEY_BASE, `Vi phạm 2/2 (${reason})`);
        closePracticeRoom();
        showAntiCheatModal('VI PHẠM 2/2 · KHÓA 30 PHÚT', `Hệ thống ghi nhận vi phạm 2/2 (${reason}). Bài viết của bạn được giữ nguyên để chấm điểm, phiên ${modeLbl} đã kết thúc và tạm khóa 30 phút.`, true);
      } else {
        showAntiCheatModal('CẢNH CÁO 1/2', `Không rời màn hình khi đang ${modeLbl} (${reason}). Vi phạm thêm 1 lần nữa bài làm sẽ kết thúc ngay và khóa 30 phút.`, false);
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
      const cs = getLearnableCards(m);
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

  /* Check ?wtask=... assignment link on boot (fallback only if TeacherStudio is unavailable) */
  function checkIncomingWritingTaskParam() {
    try {
      if (window.TeacherStudio?.handleIncomingUrlIfMultiSkill) return;
      if (!B()?.getCurrentUser?.()) return;
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
    getShortFlowTitle: (modId) => SHORT_FLOW_TITLES[modId] || '',
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
    toggleFlowMask,
    revealFlowNode,
    submitRecallTyping,
    updateRecallSentenceDraft,
    submitRecallSentence,
    finishRecallPass,
    abortRecall,
    switchTaskHubSubtopic,
    copyTaskLink,
    openTask,
    exitTaskStudyMode,
    startTaskExam,
    teacherJumpExam,
    saveT1NodeDraft,
    checkTaskTest1,
    saveT2Paragraph,
    checkTaskTest2,
    selectT3Prompt,
    saveT3Body,
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
    launchPracticeFromTask,
    startPracticePrompt,
    togglePracTimerExact,
    togglePracOptions,
    setPracContrast,
    setPracTextSize,
    togglePracPlan,
    clearPracPlan,
    startPracResize,
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
