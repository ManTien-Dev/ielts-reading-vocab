/* ==========================================================================
   TOTORO IELTS MASTER — SPEAKING STUDIO ENGINE (STORY 01)
   4-Tab Native Studio: Tổng quan · Flashcard · Task (4 Bước) · Practice (14 Cue Cards)
   Integrates window.TotoroSpeechSTT (Whisper Large v3) + window.AppCore.audio (Youdao US/UK)
   ========================================================================== */
(function () {
  'use strict';

  const DATA = () => window.SPEAKING_STUDIO_DATA || { STORIES: [] };
  const B = () => window.__VOCAB_BRIDGE__ || null;
  const STT = () => window.TotoroSpeechSTT || null;

  const MASTERY_KEY_BASE = 'totoro_speaking_mastery_v1_';
  const TASK_DONE_KEY_BASE = 'totoro_speaking_task_done_v1_';
  const PRAC_HIST_KEY_BASE = 'totoro_speaking_prac_hist_v1_';
  const COOLDOWN_SEC = 18;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));

  function getUid() {
    return B()?.getScopedUid?.() || String(B()?.getCurrentUser?.()?.id || 'guest').toLowerCase();
  }
  function isTeacherBypass() {
    const u = B()?.getCurrentUser?.();
    return Boolean(u && (u.role === 'teacher' || u.id === 'giaovien' || window.__TEACHER_PREVIEW__));
  }
  function toast(msg) {
    if (B()?.showToast) B().showToast(msg);
  }
  function fmtMmSs(secs) {
    const s = Math.max(0, Math.floor(Number(secs) || 0));
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }
  function normText(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9'\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function countWords(s) {
    const t = String(s || '').trim();
    return t ? t.split(/\s+/).length : 0;
  }

  /* ================= PERSISTENCE ================= */
  function loadJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') || fallback; } catch (_) { return fallback; }
  }
  function saveJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }
  function getMasteryMap() { return loadJson(MASTERY_KEY_BASE + getUid(), {}); }
  function saveMasteryMap(m) { saveJson(MASTERY_KEY_BASE + getUid(), m); }
  function getTaskDoneMap() { return loadJson(TASK_DONE_KEY_BASE + getUid(), {}); }
  function saveTaskDoneMap(m) { saveJson(TASK_DONE_KEY_BASE + getUid(), m); }
  function getPracHistory() { return loadJson(PRAC_HIST_KEY_BASE + getUid(), []); }
  function savePracHistory(list) { saveJson(PRAC_HIST_KEY_BASE + getUid(), list); }

  function getStory() {
    return (DATA().STORIES || [])[0] || null;
  }

  /* ================= AUDIO (YOUDAO US / UK) ================= */
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

  /* ================= SPELLING & SPEECH EVALUATORS ================= */
  const COMMON_TYPOS = new Set([
    'teh', 'recieve', 'seperate', 'occured', 'untill', 'definately', 'goverment',
    'enviroment', 'grandfater', 'mathmatics', 'calculaton', 'frustated', 'apologiseed',
    'confidance', 'neigbour', 'neigbor', 'hospitel', 'housewok', 'droping', 'immediatly',
    'patiance', 'paitence', 'wich', 'becuase', 'freind', 'sholder', 'whispred', 'mistaks'
  ]);
  let cachedLex = null;
  function getLexicon() {
    if (cachedLex) return cachedLex;
    const set = new Set();
    const add = (str) => {
      const m = String(str || '').match(/[A-Za-z'-]{3,}/g);
      if (m) m.forEach((w) => set.add(w.toLowerCase()));
    };
    const st = getStory();
    if (st) {
      (st.stages || []).forEach((s) => { add(s.textEn); (s.keywords || []).forEach(add); });
      (st.spokenChunks || []).forEach((c) => { add(c.en); add(c.example); add(c.enRef); });
      (st.pivotCards || []).forEach((p) => { add(p.en); add(p.example); (p.items || []).forEach((it) => add(it.en)); });
      (st.fullSpeech?.en || []).forEach(add);
      (st.pictureBook || []).forEach((p) => { add(p.en); (p.collocations || []).forEach(add); });
      (st.cueCards || []).forEach((c) => { add(c.title); add(c.b13En); add(c.b5En); });
    }
    if (window.IPA_DICT) Object.keys(window.IPA_DICT).forEach((k) => set.add(k.toLowerCase()));
    if (Array.isArray(window.RAW_VOCAB_DATA)) window.RAW_VOCAB_DATA.forEach((it) => { add(it.word); add(it.example); });
    add('grandfather grandmother retired maths math teacher seventies silver hair warm smile parents worked morning till night afternoon dinner homework neighbour neighbor next door close friends grade mother fell ill hospital month missed school look after housework behind low marks insecure lost motivation dropping out found out called over listened calmly worries invited weekend broke hard problems simple steps explained clearly review notebook finished exercise quickly struggling basic calculation frustrated snapped hurry gently hand shoulder whispered take time stuck afraid making mistakes rushing panic confused heard felt guilty apologised apologized right away worked through guidance year caught regained confidence better kids brought notebooks help looking back hope follow example staying calm listening carefully');
    cachedLex = set;
    return set;
  }
  function editDist(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    const dp = Array.from({ length: a.length + 1 }, (_, i) => i);
    for (let j = 1; j <= b.length; j++) {
      let prev = dp[0]; dp[0] = j;
      for (let i = 1; i <= a.length; i++) {
        const tmp = dp[i];
        dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
        prev = tmp;
      }
    }
    return dp[a.length];
  }
  function detectTypos(text, targetPhrases) {
    const words = String(text || '').match(/[A-Za-z'-]{5,}/g) || [];
    const lex = getLexicon();
    const targetWords = new Set();
    (targetPhrases || []).forEach((p) => {
      (String(p || '').match(/[A-Za-z'-]{5,}/g) || []).forEach((w) => targetWords.add(w.toLowerCase()));
    });
    const out = [];
    const seen = new Set();
    for (const w of words) {
      const low = w.toLowerCase();
      if (COMMON_TYPOS.has(low)) { if (!seen.has(low)) { out.push(w); seen.add(low); } continue; }
      if (lex.has(low) || targetWords.has(low) || seen.has(low)) continue;
      for (const tw of targetWords) {
        if (low[0] === tw[0] && Math.abs(low.length - tw.length) <= 2) {
          const d = editDist(low, tw);
          if (d > 0 && d <= (tw.length >= 8 ? 2 : 1)) {
            out.push(w); seen.add(low); break;
          }
        }
      }
    }
    return out;
  }

  function evaluateKeywords(text, keywords) {
    const norm = normText(text);
    const hits = [];
    const misses = [];
    (keywords || []).forEach((kw) => {
      const k = normText(kw);
      if (!k) return;
      const tokens = k.split(' ');
      const ok = norm.includes(k) || (tokens.length > 1 && tokens.every((t) => norm.includes(t)));
      if (ok) hits.push(kw);
      else misses.push(kw);
    });
    const ratio = (keywords || []).length ? hits.length / keywords.length : 1;
    return { hits, misses, ratio, words: countWords(text) };
  }

  function evaluateFullSpeech(text, durationSec) {
    const story = getStory();
    const norm = normText(text);
    const words = countWords(text);
    const dur = Math.max(1, Math.round(Number(durationSec) || Math.max(15, words / 2.2)));
    const wpm = Math.round((words / dur) * 60);
    const usedChunks = (story?.spokenChunks || []).filter((c) => {
      const cn = normText(c.en);
      const toks = cn.split(' ').filter((w) => w.length >= 3);
      return norm.includes(cn) || (toks.length >= 2 && toks.filter((t) => norm.includes(t)).length >= Math.ceil(toks.length * 0.75));
    }).map((c) => c.en);
    const fillerMatches = (String(text || '').match(/\b(um+|uh+|er+|hmm+|like|you know|actually|basically)\b/gi) || []);
    const stageHits = (story?.stages || []).filter((st) => evaluateKeywords(text, st.keywords).hits.length >= 2).length;
    return {
      words,
      durationSec: dur,
      wpm,
      usedChunks,
      fillerCount: fillerMatches.length,
      stageHits
    };
  }

  /* ================= DECK BUILDER (STORY 01 FLOW ORDER) ================= */
  function buildStoryCards(story) {
    if (!story) return [];
    const cards = [];
    // Card 0: Story Flow Map (untested)
    cards.push({
      id: `${story.id}_overview`,
      kind: 'story_flow',
      untested: true,
      pos: 'STORY FLOW · B4',
      en: story.shortTitle || story.title,
      vi: story.subtitle,
      story
    });

    const chunks = story.spokenChunks || [];
    (story.stages || []).forEach((st) => {
      cards.push({
        id: `${story.id}_stage_${st.stage}`,
        kind: 'stage_flow',
        untested: true,
        stage: st.stage,
        pos: `CHẶNG B4.${st.stage} / 5`,
        en: st.titleVi,
        vi: st.textVi,
        textEn: st.textEn,
        sceneImg: st.sceneImg,
        keywords: st.keywords || []
      });
      chunks.filter((c) => c.stage === st.stage).forEach((c, idx) => {
        const posVi = { 'n phr': 'CỤM DANH TỪ', 'v phr': 'CỤM ĐỘNG TỪ', 'adj phr': 'CỤM TÍNH TỪ', phr: 'CỤM NÓI' }[c.pos] || 'CỤM NÓI';
        cards.push({
          id: `${story.id}_c_s${st.stage}_${idx + 1}`,
          kind: 'chunk',
          stage: st.stage,
          pos: posVi,
          en: c.en,
          vi: c.vi,
          example: c.example || '',
          viPrompt: c.viPrompt || '',
          enRef: c.enRef || ''
        });
      });
    });

    (story.pivotCards || []).forEach((p, idx) => {
      cards.push({
        id: p.id || `${story.id}_pv_${idx + 1}`,
        kind: 'pivot',
        pos: 'PIVOT · BẺ LÁI',
        label: p.label,
        en: p.en,
        vi: p.vi,
        items: p.items || [],
        example: p.example || '',
        viPrompt: p.viPrompt || '',
        enRef: p.enRef || ''
      });
    });
    return cards;
  }

  function getLearnableCards(story) {
    return buildStoryCards(story).filter((c) => !c.untested);
  }
  function getStoryMasteryStats(story) {
    const learnable = getLearnableCards(story);
    const mmap = getMasteryMap();
    const done = learnable.filter((c) => mmap[c.id]?.level === 3).length;
    const slow = learnable.filter((c) => mmap[c.id]?.level === 2).length;
    return {
      done,
      slow,
      unlearned: Math.max(0, learnable.length - done - slow),
      total: learnable.length,
      pct: Math.round((done / Math.max(1, learnable.length)) * 100)
    };
  }

  /* ================= STATE ================= */
  const state = {
    cardIdx: 0,
    flipped: false,
    unmasteredOnly: false,
    flowMaskOn: false,
    flowRevealed: {},
    perspKey: 'ong',
    stageEnRevealed: {},
    pracCat: 'all',
    pracQuery: '',
    cooldownMap: {},
    cooldownTicker: null
  };

  let recallState = null;
  let pbState = null;
  let examState = null;
  let roomState = null;
  let overlaysMounted = false;

  /* ================= OVERLAY MOUNTING ================= */
  function ensureOverlays() {
    if (overlaysMounted) return;
    overlaysMounted = true;
    const wrap = document.createElement('div');
    wrap.id = 'sp-overlays-root';
    wrap.innerHTML = `
      <div class="sp-modal-overlay" id="sp-recall-modal" onclick="SpeakingStudio.closeRecall()">
        <div class="sp-modal-card" id="sp-recall-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="sp-modal-overlay" id="sp-pb-modal" onclick="SpeakingStudio.closePictureBook()">
        <div class="sp-modal-card is-wide" id="sp-pb-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="sp-modal-overlay" id="sp-task-exam-modal">
        <div class="sp-modal-card is-wide" id="sp-task-exam-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="sp-modal-overlay" id="sp-summary-modal" onclick="SpeakingStudio.closeSummaryModal()">
        <div class="sp-modal-card" id="sp-summary-card" onclick="event.stopPropagation()"></div>
      </div>
      <div class="sp-exam-room" id="sp-practice-room"></div>
    `;
    document.body.appendChild(wrap);

    document.addEventListener('keydown', (e) => {
      if (pbState) {
        if (e.key === 'ArrowRight') { e.preventDefault(); stepPictureBook(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPictureBook(-1); }
        else if (e.key === 'Escape') closePictureBook();
        return;
      }
      if (document.documentElement.getAttribute('data-skill') !== 'speaking') return;
      if (recallState || examState || roomState) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      const root = document.getElementById('speaking-flashcard-root');
      if (!root || root.offsetParent === null) return;
      if (e.code === 'Space') { e.preventDefault(); flipCard(); }
      else if (e.key === 'ArrowRight') stepCard(1);
      else if (e.key === 'ArrowLeft') stepCard(-1);
      else if (e.key === 'r' || e.key === 'R') speakCurrent(state.flipped ? 'en-GB' : 'en-US');
      else if (state.flipped && e.key === '1') assessCard(1);
      else if (state.flipped && e.key === '2') assessCard(2);
      else if (state.flipped && e.key === '3') assessCard(3);
    });
  }

  /* ================= TAB 1: SPEAKING HOME ================= */
  function renderSpeakingHomePanel(el) {
    if (!el) return;
    const story = getStory();
    if (!story) return;
    const mStats = getStoryMasteryStats(story);
    const taskDone = getTaskDoneMap()[story.id] || null;
    const hist = getPracHistory();
    const practicedCueIds = new Set(hist.map((h) => h.cueId));
    const totalCue = (story.cueCards || []).length;
    const totalMins = Math.round(hist.reduce((acc, h) => acc + (Number(h.durationSec) || 0), 0) / 60);

    const catCounts = { person: 0, cross_topic: 0, cross_category: 0 };
    (story.cueCards || []).forEach((c) => {
      if (catCounts[c.category] !== undefined) catCounts[c.category]++;
    });

    const histHtml = hist.length
      ? hist.slice(0, 5).map((h) => `
          <div class="rh-hist-item">
            <div style="min-width:0;">
              <div class="rh-hist-title">${esc(h.cueTitle)}</div>
              <div class="rh-hist-meta">${h.mode === 'exam' ? 'Thi thật' : 'Luyện tập'} · ${fmtMmSs(h.durationSec)} · ${h.wpm || 0} WPM · ${h.chunksCount || 0} chunks · ${h.at ? new Date(h.at).toLocaleDateString('vi-VN') : ''}</div>
            </div>
            <div class="rh-hist-right">
              <span class="rh-band-pill tabular">${h.words || 0} từ</span>
              <button type="button" class="tot-foot-btn" onclick="SpeakingStudio.openPracticeRoom('${esc(h.cueId)}', '${esc(h.mode || 'practice')}')">Nói lại</button>
            </div>
          </div>
        `).join('')
      : `<div class="rh-empty">Chưa có lượt luyện nói nào. Hãy học <strong>Flashcard Story 01</strong> rồi vào <strong>Task · 4 Bước</strong> hoặc <strong>Practice</strong> nhé!</div>`;

    el.innerHTML = `
      <div class="rh-layout">
        <div class="rh-top-asym">
          <div class="tot-hero-card ink-brackets has-stamp rh-main-hero">
            <div class="rh-hero-copy">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Speaking · Story 01</h2>
                  <div class="tot-shell-sub">${esc(story.title)}</div>
                </div>
              </div>

              <div class="sp-arch-track">
                <div class="sp-arch-box">
                  <span class="sp-arch-tag">B1 – B2 – B3</span>
                  <div class="sp-arch-title">Đổi Góc Nhìn</div>
                  <div class="sp-arch-desc">Ông ngoại · Bản thân tôi · Bạn Nam (10–15% bài nói)</div>
                </div>
                <div class="sp-arch-arrow" aria-hidden="true">→</div>
                <div class="sp-arch-box is-core">
                  <span class="sp-arch-tag">B4 · LÕI BẤT BIẾN</span>
                  <div class="sp-arch-title">5 Chặng Kể Chuyện (75–80%)</div>
                  <div class="sp-arch-desc">Tuổi thơ → Biến cố mẹ Nam → Lớp học cuối tuần → Lời ông → Trái ngọt</div>
                </div>
                <div class="sp-arch-arrow" aria-hidden="true">→</div>
                <div class="sp-arch-box">
                  <span class="sp-arch-tag">B5 · KHÓA ĐỀ</span>
                  <div class="sp-arch-title">Cân ${totalCue}+ Đề Thật</div>
                  <div class="sp-arch-desc">Person · Cross-Topic · Cross-Category (10% bài nói)</div>
                </div>
              </div>

              <div class="sp-stat-pills">
                <div class="sp-stat-cell">
                  <div class="sp-stat-cell-val">${mStats.done}/${mStats.total}</div>
                  <div class="sp-stat-cell-lbl">Spoken Chunks thuộc</div>
                </div>
                <div class="sp-stat-cell">
                  <div class="sp-stat-cell-val">${taskDone?.completed ? '4/4' : `${taskDone?.maxStage || 0}/4`}</div>
                  <div class="sp-stat-cell-lbl">Bước Task Story 01</div>
                </div>
                <div class="sp-stat-cell">
                  <div class="sp-stat-cell-val">${practicedCueIds.size}/${totalCue}</div>
                  <div class="sp-stat-cell-lbl">Cue Card đã luyện</div>
                </div>
                <div class="sp-stat-cell">
                  <div class="sp-stat-cell-val">${totalMins}p</div>
                  <div class="sp-stat-cell-lbl">Thời lượng luyện nói</div>
                </div>
              </div>

              <div class="rh-hero-actions" style="margin-top:14px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.switchView('flashcard')">Học Flashcard Story 01 →</button>
                <button type="button" class="tot-demo-btn" onclick="SpeakingStudio.openPictureBook(0)">Sách Tranh 26 Phân Cảnh</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchView('task')">Task · 4 Bước</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchView('practice')">Luyện ${totalCue} Cue Cards</button>
              </div>
            </div>
          </div>

          <div class="tot-home-panel ink-brackets rh-band-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Độ Phủ Bẻ Lái · Story 01</div>
                <div class="tot-panel-sub">1 cốt truyện lõi áp dụng cho 3 nhóm đề</div>
              </div>
              <span class="rh-band-big tabular">${mStats.pct}%</span>
            </div>
            <div style="display:flex;flex-direction:column;gap:10px;margin:auto 0;">
              <div class="rh-deck-row">
                <div class="rh-deck-meta"><span>Person (Bẻ lái nhân vật)</span><strong class="tabular">${catCounts.person} đề</strong></div>
                <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:100%"></div></div>
              </div>
              <div class="rh-deck-row">
                <div class="rh-deck-meta"><span>Cross-Topic (Kỹ năng · Cộng đồng)</span><strong class="tabular">${catCounts.cross_topic} đề</strong></div>
                <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:100%"></div></div>
              </div>
              <div class="rh-deck-row">
                <div class="rh-deck-meta"><span>Cross-Category (Ngoài Person)</span><strong class="tabular">${catCounts.cross_category} đề</strong></div>
                <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:100%"></div></div>
              </div>
            </div>
            <div class="tot-panel-foot" style="margin-top:auto;">
              <span class="tot-foot-meta">Phòng luyện <strong>1p Planning + 2p Nói</strong></span>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('practice')">Chọn Cue Card →</button>
            </div>
          </div>
        </div>

        <div class="rh-bottom-asym">
          <div class="tot-home-panel ink-brackets">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Lịch Sử Luyện Nói Part 2</div>
                <div class="tot-panel-sub">Luyện tập 1p+2p · Phòng thi thật</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('practice')">Kho Cue Card →</button>
            </div>
            <div class="rh-hist-list">${histHtml}</div>
          </div>

          <div class="tot-home-panel ink-brackets">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Lộ Trình Khóa Chặt Story 01</div>
                <div class="tot-panel-sub">Đi theo thứ tự để nhớ tự nhiên không học vẹt</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="SpeakingStudio.openPictureBook(0)">Xem Sách Tranh →</button>
            </div>
            <div class="rh-hist-list">
              <div class="rh-hist-item">
                <div style="min-width:0;"><div class="rh-hist-title">1. Nắm 5 chặng lõi B4 + 30 Spoken Chunks</div><div class="rh-hist-meta">Flashcard đồng bộ + kiểm tra Mic AI</div></div>
                <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('flashcard')">Học →</button>
              </div>
              <div class="rh-hist-item">
                <div style="min-width:0;"><div class="rh-hist-title">2. Khóa chặt qua Task 4 Bước</div><div class="rh-hist-meta">Viết B4 → Nói B4 → Bẻ lái → Nói 2 phút</div></div>
                <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('task')">Vào Task →</button>
              </div>
              <div class="rh-hist-item">
                <div style="min-width:0;"><div class="rh-hist-title">3. Bẻ lái ${totalCue} Cue Card thi thật</div><div class="rh-hist-meta">1 phút ghi chú nháp + 2 phút thu âm đối chiếu</div></div>
                <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('practice')">Luyện →</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /* ================= TAB 2: FLASHCARD WORKSPACE (1:1 READING/WRITING PARITY) ================= */
  function getVisibleCards() {
    const story = getStory();
    const base = buildStoryCards(story);
    if (!state.unmasteredOnly) return base;
    const mmap = getMasteryMap();
    const unm = base.filter((c) => !c.untested && mmap[c.id]?.level !== 3);
    return unm.length ? unm : base;
  }

  function getCooldownSec(cardId) {
    const until = state.cooldownMap[cardId] || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  }

  function syncLiveTimer() {
    const srcDigits = document.getElementById('timer-digits');
    const dstDigits = document.getElementById('sp-timer-digits');
    if (srcDigits && dstDigits) dstDigits.textContent = srcDigits.textContent;
    const srcToday = document.getElementById('timer-today-total');
    const dstToday = document.getElementById('sp-timer-today-total');
    if (srcToday && dstToday) dstToday.textContent = srcToday.textContent;
    const srcArc = document.getElementById('chrono-arc');
    const dstArc = document.getElementById('sp-chrono-arc');
    if (srcArc && dstArc) dstArc.style.strokeDashoffset = srcArc.style.strokeDashoffset || '265';
  }

  function ensureCooldownTicker() {
    if (state.cooldownTicker) return;
    state.cooldownTicker = setInterval(() => {
      if (document.documentElement.getAttribute('data-skill') !== 'speaking') return;
      syncLiveTimer();
      const btn = document.getElementById('sp-btn-master');
      const lbl = document.getElementById('sp-btn-master-lbl');
      if (!btn || !lbl) return;
      const cards = getVisibleCards();
      const card = cards[state.cardIdx];
      if (!card) return;
      const sec = getCooldownSec(card.id);
      if (sec > 0) {
        btn.disabled = true;
        lbl.textContent = `Chờ ${sec}s`;
      } else if (btn.disabled) {
        btn.disabled = false;
        lbl.innerHTML = 'Đã thuộc <small class="anki-ivl-tag">Mic AI</small>';
      }
    }, 500);
  }

  function renderFlashcardWorkspace() {
    ensureOverlays();
    const root = document.getElementById('speaking-flashcard-root');
    const story = getStory();
    if (!root || !story) return;

    const cards = getVisibleCards();
    if (state.cardIdx >= cards.length) state.cardIdx = 0;
    const card = cards[state.cardIdx];
    const mmap = getMasteryMap();
    const mStats = getStoryMasteryStats(story);
    const stLevel = mmap[card.id]?.level || 0;
    const statusCls = stLevel === 3 ? 'mastered' : (stLevel === 2 ? 'slow' : '');
    const statusTxt = card.untested ? (card.kind === 'story_flow' ? 'Bản đồ Story 01' : `Chặng B4.${card.stage}`) : (stLevel === 3 ? 'Đã thuộc' : (stLevel === 2 ? 'Nhớ chậm' : 'Chưa học'));
    const isAnyFlow = card.kind === 'story_flow' || card.kind === 'stage_flow';
    const showAudio = card.kind === 'chunk' || card.kind === 'pivot';
    const cdSec = getCooldownSec(card.id);

    const pctCard = Math.round(((state.cardIdx + 1) / Math.max(1, cards.length)) * 100);
    const wordSizeCls = card.en.length <= 20 ? 'sp-word-sm' : (card.en.length <= 36 ? 'sp-word-md' : 'sp-word-lg');
    const metaTag = card.kind === 'chunk' ? `Chặng B4.${card.stage}` : (card.kind === 'pivot' ? (card.label || 'Bẻ lái B1/B5') : '');

    // Build Front extra content
    let frontExtraHtml = '';
    if (card.kind === 'story_flow') {
      frontExtraHtml = `
        <div class="fc-pronounce-row" onclick="event.stopPropagation()">
          <span class="fc-ipa-badge">5 chặng lõi B4 · 3 góc nhìn · 30 Spoken Chunks</span>
          <button type="button" class="btn-voice-speak" style="width:auto;padding:0 12px;" onclick="SpeakingStudio.openPictureBook(0, event)"><span>Sách Tranh 26 cảnh</span></button>
        </div>
      `;
    } else if (card.kind === 'stage_flow') {
      frontExtraHtml = `
        ${card.sceneImg ? `<div class="sp-stage-front-thumb"><img src="${esc(card.sceneImg)}" alt="${esc(card.en)}" loading="lazy"></div>` : ''}
        <div class="fc-pronounce-row" onclick="event.stopPropagation()">
          <span class="fc-ipa-badge">Mạch kể Chặng ${card.stage} / 5</span>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakStageEn(${card.stage}, 'en-GB', event)"><span>UK</span></button>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakStageEn(${card.stage}, 'en-US', event)"><span>US</span></button>
        </div>
      `;
    } else {
      frontExtraHtml = `
        <div class="fc-pronounce-row" onclick="event.stopPropagation()">
          ${metaTag ? `<span class="fc-ipa-badge">${esc(metaTag)}</span>` : ''}
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakCurrent('en-GB', event)" title="Nghe Anh - Anh (UK)"><span>UK</span></button>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakCurrent('en-US', event)" title="Nghe Anh - Mỹ (US)"><span>US</span></button>
        </div>
      `;
    }

    // Build Back body content
    let backBodyHtml = '';
    if (card.kind === 'story_flow') {
      const persps = story.perspectives || [];
      const curP = persps.find((p) => p.key === state.perspKey) || persps[0];
      backBodyHtml = `
        <div class="sp-persp-bar" onclick="event.stopPropagation()">
          <span style="font-size:11.5px;font-weight:800;color:var(--ink-3);text-transform:uppercase;">Góc nhìn B1–B2:</span>
          ${persps.map((p) => `
            <button type="button" class="sp-persp-tab ${p.key === curP?.key ? 'active' : ''}" onclick="SpeakingStudio.selectPerspective('${esc(p.key)}', event)">${esc(p.label)}</button>
          `).join('')}
          ${curP ? `<button type="button" class="btn-voice-speak" style="margin-left:auto;" onclick="SpeakingStudio.speakRaw('${esc(curP.enSample).replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>` : ''}
        </div>
        ${curP ? `
          <div class="sp-persp-box" onclick="event.stopPropagation()">
            <div><strong>${esc(curP.b1Title)}:</strong> ${esc(curP.b1Vi)}</div>
            <div class="sp-persp-en">“${esc(curP.enSample)}”</div>
          </div>
        ` : ''}
        <div class="sp-flow-stage-grid" onclick="event.stopPropagation()">
          ${(story.stages || []).map((st) => {
            const key = `st_${st.stage}`;
            const masked = state.flowMaskOn && !state.flowRevealed[key];
            return `
              <div class="sp-flow-stage-row ${masked ? 'is-masked' : ''}" ${masked ? `onclick="SpeakingStudio.revealFlowNode('${key}', event)"` : ''}>
                <span class="sp-stage-badge">B4.${st.stage}</span>
                <div>${masked ? 'Chạm để hiện chặng này (đang ẩn để tự nhẩm)...' : `<strong>${esc(st.titleVi)}:</strong> ${esc(st.textVi.slice(0, 118))}${st.textVi.length > 118 ? '…' : ''}`}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (card.kind === 'stage_flow') {
      const showEn = Boolean(state.stageEnRevealed[card.stage]);
      backBodyHtml = `
        <div class="sp-stage-back-hero" onclick="event.stopPropagation()">
          ${card.sceneImg ? `<div class="sp-stage-back-img"><img src="${esc(card.sceneImg)}" alt="${esc(card.en)}"></div>` : ''}
          <div class="sp-stage-vi-text">${esc(card.vi)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;" onclick="event.stopPropagation()">
          <button type="button" class="btn-reading-tip ${showEn ? 'is-active' : ''}" onclick="SpeakingStudio.toggleStageEn(${card.stage}, event)">
            ${showEn ? 'Ẩn bản Tiếng Anh mẫu' : 'Xem bản Tiếng Anh chuẩn chặng này'}
          </button>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakStageEn(${card.stage}, 'en-GB', event)"><span>UK</span></button>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakStageEn(${card.stage}, 'en-US', event)"><span>US</span></button>
          </div>
        </div>
        ${showEn ? `<div class="sp-stage-en-reveal" onclick="event.stopPropagation()">${esc(card.textEn)}</div>` : ''}
      `;
    } else if (card.kind === 'pivot') {
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        <div class="sp-pivot-chips" onclick="event.stopPropagation()">
          ${(card.items || []).map((it) => `
            <div class="sp-pivot-chip">
              <div class="sp-pivot-chip-en">${esc(it.en)}</div>
              <div class="sp-pivot-chip-vi">${esc(it.vi)}</div>
            </div>
          `).join('')}
        </div>
      `;
    } else {
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        <div class="fc-sentence-box">${highlightInExample(card.example, card.en)}</div>
      `;
    }

    // Donut geometry
    const donutCirc = 194.8;
    const okPct = mStats.pct;
    const slowPct = Math.round((mStats.slow / Math.max(1, mStats.total)) * 100);
    const unlPct = Math.max(0, 100 - okPct - slowPct);
    const okDashOff = (donutCirc * (1 - mStats.done / Math.max(1, mStats.total))).toFixed(1);
    const warmDashOff = (donutCirc * (1 - Math.min(1, (mStats.done + mStats.slow) / Math.max(1, mStats.total)))).toFixed(1);

    const miniListHtml = cards.map((c, idx) => {
      const lvl = mmap[c.id]?.level || 0;
      const dotCls = c.untested ? '' : (lvl === 3 ? 'ok' : (lvl === 2 ? 'warn' : ''));
      const badgeCls = c.kind === 'story_flow' || c.kind === 'stage_flow' ? 'is-flow' : (c.kind === 'pivot' ? 'is-para' : '');
      const badgeTxt = c.kind === 'story_flow' ? 'FLOW' : (c.kind === 'stage_flow' ? `B4.${c.stage}` : (c.kind === 'pivot' ? 'BẺ LÁI' : `S${c.stage}`));
      return `
        <button type="button" class="ws-mini-row ${idx === state.cardIdx ? 'active' : ''}" onclick="SpeakingStudio.jumpCard(${idx})">
          <span class="ws-kind-badge ${badgeCls}">${badgeTxt}</span>
          <span class="ws-mini-txt">${esc(c.en)}</span>
          <span class="ws-mini-dot ${dotCls}"></span>
        </button>
      `;
    }).join('');

    const curTimerDigits = document.getElementById('timer-digits')?.textContent || '00:00';
    const curTimerStatus = document.getElementById('timer-status-text')?.textContent || 'Đang học';
    const curTimerPlay = document.getElementById('timer-play-text')?.textContent || 'Tạm dừng';
    const curTimerToday = document.getElementById('timer-today-total')?.textContent || '0 phút';
    const isFocusActive = document.body.classList.contains('focus-mode');

    root.innerHTML = `
      <!-- 1. TOP BAR — 1:1 Reading & Writing Totoro Editorial Parity -->
      <div class="study-top-bar">
        <div class="study-bar-left">
          <div class="scope-select-wrap has-custom-scope">
            <button type="button" class="tot-scope-trigger" onclick="SpeakingStudio.openPictureBook(0)" title="Mở Sách Tranh 26 phân cảnh Story 01">
              <span class="tot-scope-trigger-label">STORY 01 · ${esc(story.shortTitle)}</span>
            </button>
          </div>
          <span class="sp-pill ok tabular">Thuộc ${mStats.done}/${mStats.total}</span>
        </div>

        <div class="study-top-actions">
          <button type="button" class="btn-deck-tool tot-tool-quiet" onclick="SpeakingStudio.openPictureBook(0)" title="Xem Sách Tranh 26 phân cảnh">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>
            <span>Sách Tranh</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet ${state.unmasteredOnly ? 'active' : ''}" onclick="SpeakingStudio.toggleUnmastered()" title="Chỉ xem các thẻ chưa thuộc">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            <span>Chưa thuộc</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet btn-focus-toggle ${isFocusActive ? 'active' : ''}" onclick="typeof toggleFocusMode === 'function' && toggleFocusMode()" title="Thu gọn 2 cột bên để tập trung học">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            <span>Tập trung</span>
          </button>
          <div class="study-progress-wrap" title="Vị trí thẻ hiện tại">
            <span class="study-progress tabular">${state.cardIdx + 1} / ${cards.length}</span>
          </div>
        </div>
      </div>

      <!-- 2. 3-COLUMN READING/WRITING STUDIO STAGE -->
      <div class="study-stage-row">
        <!-- LEFT DECK -->
        <aside class="study-deck study-deck-left" aria-label="Đồng hồ và Task Speaking">
          <div class="deck-widget widget-theme-mint ink-brackets" id="sp-widget-timer">
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
              <button type="button" class="timer-mode-btn active" onclick="typeof setTimerMode === 'function' && setTimerMode('countup')">Đếm xuôi</button>
              <button type="button" class="timer-mode-btn" onclick="typeof setTimerMode === 'function' && setTimerMode('countdown')">Pomodoro</button>
            </div>
            <div class="timer-display-box chrono-wrap totoro-chrono-pro">
              <svg class="chrono-svg totoro-chrono-svg" viewBox="0 0 160 160" aria-hidden="true">
                <defs>
                  <linearGradient id="spBezelMetal" x1="15%" y1="0%" x2="85%" y2="100%">
                    <stop offset="0%" stop-color="#536857"/><stop offset="48%" stop-color="#2D3D31"/><stop offset="100%" stop-color="#1E2A21"/>
                  </linearGradient>
                  <linearGradient id="spGoldTrim" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#E3C48A"/><stop offset="50%" stop-color="#B98D46"/><stop offset="100%" stop-color="#8C672A"/>
                  </linearGradient>
                  <linearGradient id="spGlassGlint" x1="20%" y1="0%" x2="70%" y2="85%">
                    <stop offset="0%" stop-color="#FFFFFF" stop-opacity="0.32"/><stop offset="45%" stop-color="#FFFFFF" stop-opacity="0.04"/><stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
                  </linearGradient>
                  <radialGradient id="spDialFaceLight" cx="50%" cy="38%" r="62%">
                    <stop offset="0%" stop-color="#FFFDF8"/><stop offset="76%" stop-color="#F6F1E5"/><stop offset="100%" stop-color="#EAE2D0"/>
                  </radialGradient>
                  <radialGradient id="spDialFaceDark" cx="50%" cy="35%" r="65%">
                    <stop offset="0%" stop-color="#243128"/><stop offset="75%" stop-color="#18221B"/><stop offset="100%" stop-color="#101812"/>
                  </radialGradient>
                  <linearGradient id="spChronoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stop-color="#C89B54"/><stop offset="48%" stop-color="#4E8A5B"/><stop offset="100%" stop-color="#275D38"/>
                  </linearGradient>
                </defs>
                <rect x="74" y="1.5" width="12" height="5" rx="2" fill="url(#spGoldTrim)" opacity="0.92"/>
                <circle cx="80" cy="82" r="73.5" fill="url(#spBezelMetal)"/>
                <circle cx="80" cy="82" r="72.4" fill="none" stroke="url(#spGoldTrim)" stroke-width="1.2" opacity="0.75"/>
                <circle cx="80" cy="82" r="69.6" fill="none" stroke="url(#spGoldTrim)" stroke-width="3.2" stroke-dasharray="1.5 34.94" opacity="0.92"/>
                <circle class="tot-pro-dial" cx="80" cy="82" r="65.2"/>
                <g transform="rotate(-90 80 82)">
                  <circle class="chrono-track" cx="80" cy="82" r="56"/>
                  <circle class="chrono-progress" id="sp-chrono-arc" cx="80" cy="82" r="56"/>
                </g>
                <path d="M26 66A56 56 0 0 1 134 66C116 56 44 56 26 66Z" fill="url(#spGlassGlint)"/>
              </svg>
              <div class="chrono-center">
                <div class="timer-digits chrono-digits tabular" id="sp-timer-digits">${esc(curTimerDigits)}</div>
                <div class="chrono-state">
                  <span class="live-dot"></span>
                  <span class="timer-status-text">${esc(curTimerStatus)}</span>
                </div>
              </div>
            </div>
            <div class="timer-actions">
              <button type="button" class="btn-timer-ctrl primary" onclick="typeof toggleTimer === 'function' && toggleTimer()"><span>${esc(curTimerPlay)}</span></button>
              <button type="button" class="btn-timer-ctrl" onclick="typeof resetTimer === 'function' && resetTimer()">Đặt lại</button>
            </div>
            <div class="timer-footer-stat">
              <span>Hôm nay đã học</span>
              <strong class="tabular" id="sp-timer-today-total">${esc(curTimerToday)}</strong>
            </div>
          </div>

          <div class="deck-widget widget-theme-gold ink-brackets has-stamp" id="sp-widget-task">
            <div class="widget-header">
              <span class="tot-icon-tile warm" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Task · 4 Bước</div>
                <div class="widget-subtitle">Viết B4 → Nói B4 → Bẻ lái → 2p</div>
              </div>
            </div>
            <div class="tot-speedquiz-meta">
              <div class="tot-sq-badge"><span>Chấm Mic AI</span></div>
              <div class="tot-sq-badge"><span>Nghe lại giọng</span></div>
            </div>
            <button type="button" class="btn-widget-speedquiz" onclick="SpeakingStudio.startTaskExam()">
              <span>Vào Task 4 Bước →</span>
            </button>
          </div>
        </aside>

        <!-- CENTER COLUMN: 1:1 READING/WRITING 3D FLASHCARD -->
        <div class="study-center-col">
          <div class="fc-scene" id="sp-fc-scene" onclick="SpeakingStudio.flipCard()">
            <div class="deck-ghost-2" aria-hidden="true"></div>
            <div class="deck-ghost-1" aria-hidden="true"></div>
            <div class="fc-motion-wrap">
              <div class="card-progress-bar">
                <div class="card-progress-fill" style="width:${pctCard}%;"></div>
              </div>
              <div class="fc-card ${state.flipped ? 'flipped' : ''}" id="sp-fc-card">
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
                    ${frontExtraHtml}
                  </div>

                  <!-- Exact 3 Ghibli Stickers -->
                  <svg class="totoro-fc-charm totoro-fc-soot" viewBox="0 0 44 44" fill="none" aria-hidden="true">
                    <circle cx="19" cy="24" r="9" fill="#2A2C32"/>
                    <path d="M19 12V15.5M19 32.5V36M7 24H10.5M27.5 24H31M10.5 15.5L13 18M25 30L27.5 32.5M27.5 15.5L25 18M13 30L10.5 32.5" stroke="#2A2C32" stroke-width="2" stroke-linecap="round"/>
                    <circle cx="15.8" cy="23.2" r="2.7" fill="#FFFFFF"/><circle cx="16.2" cy="23.2" r="1.25" fill="#111111"/>
                    <circle cx="22.2" cy="23.2" r="2.7" fill="#FFFFFF"/><circle cx="21.8" cy="23.2" r="1.25" fill="#111111"/>
                    <path d="M33.5 9.5L35 12.6L38.3 13.1L35.9 15.4L36.5 18.7L33.5 17.1L30.5 18.7L31.1 15.4L28.7 13.1L32 12.6L33.5 9.5Z" fill="#F5B041" stroke="#B4690E" stroke-width="0.9" stroke-linejoin="round"/>
                  </svg>
                  <svg class="totoro-fc-charm totoro-fc-corner-left" viewBox="0 0 72 60" fill="none" aria-hidden="true">
                    <path d="M7 51C10 39 18 32 30 28C27 39 19 47 7 51Z" fill="#63A870" stroke="#366E44" stroke-width="1.5" stroke-linejoin="round"/>
                    <path d="M31 28L27.5 16.5C27.2 15.2 28.7 14.5 29.6 15.5L36.5 23.5C39.2 22.8 42.3 22.8 45 23.5L51.9 15.5C52.8 14.5 54.3 15.2 54 16.5L50.5 28C55 31.5 57.5 37.2 57 44C56.4 51.5 49.8 55 40.8 55C31.8 55 25.2 51.5 24.6 44C24.1 37.2 26.6 31.5 31 28Z" fill="#FFFFFF" stroke="#5B5852" stroke-width="1.65" stroke-linejoin="round"/>
                    <circle cx="35.2" cy="34.5" r="2.1" fill="#1E2126"/><circle cx="46.4" cy="34.5" r="2.1" fill="#1E2126"/>
                  </svg>
                  <svg class="totoro-ink-stamp totoro-fc-sticker" viewBox="0 0 72 72" fill="none" aria-hidden="true">
                    <path d="M11 26C16 14 25 11 36 11C47 11 56 14 61 26C54.5 23.4 48.5 23.4 43.2 25.4C38.5 23.2 33.5 23.2 28.8 25.4C23.5 23.4 17.5 23.4 11 26Z" fill="#5CA06B" stroke="#2F663D" stroke-width="1.7" stroke-linejoin="round"/>
                    <path d="M24 33L20.5 22.5C20.2 21.3 21.7 20.6 22.6 21.5L29.8 28.2C33.6 27.1 38.4 27.1 42.2 28.2L49.4 21.5C50.3 20.6 51.8 21.3 51.5 22.5L48 33C54.2 37.5 57.5 45.2 56.8 54.5C56 62.2 48.5 66 36 66C23.5 66 16 62.2 15.2 54.5C14.5 45.2 17.8 37.5 24 33Z" fill="#6F6B64" stroke="#484540" stroke-width="1.7" stroke-linejoin="round"/>
                    <ellipse cx="36" cy="54.5" rx="15" ry="10.2" fill="#FBF6E8"/>
                    <circle cx="28" cy="36.8" r="3.4" fill="#FFFFFF"/><circle cx="28.4" cy="36.8" r="1.6" fill="#181A1F"/>
                    <circle cx="44" cy="36.8" r="3.4" fill="#FFFFFF"/><circle cx="43.6" cy="36.8" r="1.6" fill="#181A1F"/>
                  </svg>

                  <div class="fc-flip-prompt">
                    <span>Chạm thẻ để lật · Phím <strong>Space</strong> · <strong>R</strong> nghe lại</span>
                  </div>
                </div>

                <!-- BACK FACE -->
                <div class="fc-face fc-face-back">
                  <div class="fc-back-scrollable" style="display:flex;flex-direction:column;">
                    <div class="fc-back-header-bar">
                      <div class="fc-back-top-row">
                        <span class="fc-pos">${esc(card.pos)}</span>
                        <div class="fc-back-header-right">
                          ${card.kind === 'story_flow' ? `<button type="button" class="btn-reading-tip ${state.flowMaskOn ? 'is-active' : ''}" onclick="SpeakingStudio.toggleFlowMask(event)">${state.flowMaskOn ? 'Hiện toàn bộ' : 'Ẩn mắt xích để nhẩm'}</button>` : ''}
                          <span class="fc-status-tag ${statusCls}">${esc(statusTxt)}</span>
                        </div>
                      </div>
                      <div class="fc-back-meta-row">
                        <div class="fc-word">${esc(card.en)}</div>
                        ${showAudio ? `
                          <div class="fc-pronounce-row" onclick="event.stopPropagation()">
                            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakCurrent('en-GB', event)"><span>UK</span></button>
                            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakCurrent('en-US', event)"><span>US</span></button>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <div class="fc-back-body-stack ${isAnyFlow ? 'is-flow-stack' : ''}">${backBodyHtml}</div>
                  </div>

                  <div class="hanko-seal ${stLevel === 3 ? 'stamped' : ''}" aria-hidden="true">
                    <span class="hanko-seal-txt">Đã thuộc</span>
                  </div>

                  ${isAnyFlow ? `
                    <div class="ws-flow-guide-cta" onclick="event.stopPropagation()">
                      <button type="button" class="btn btn-primary ws-flow-guide-btn" onclick="SpeakingStudio.stepCard(1)">
                        <span>${card.kind === 'story_flow' ? 'Đã nắm tổng quan · Vào Chặng B4.1 →' : `Đã nắm Chặng B4.${card.stage} · Học 6 cụm nói →`}</span>
                      </button>
                    </div>
                  ` : `
                    <div class="assessment-row" onclick="event.stopPropagation()">
                      <button type="button" class="btn-assess btn-assess-unremembered" onclick="SpeakingStudio.assessCard(1)">
                        <span>Chưa nhớ <small class="anki-ivl-tag">Ôn ngay</small></span>
                        <span class="kbd-badge">1</span>
                      </button>
                      <button type="button" class="btn-assess btn-assess-slow" onclick="SpeakingStudio.assessCard(2)">
                        <span>Nhớ chậm <small class="anki-ivl-tag">1 ngày</small></span>
                        <span class="kbd-badge">2</span>
                      </button>
                      <button type="button" class="btn-assess btn-assess-mastered" id="sp-btn-master" ${cdSec > 0 ? 'disabled' : ''} onclick="SpeakingStudio.assessCard(3)">
                        <span id="sp-btn-master-lbl">${cdSec > 0 ? `Chờ ${cdSec}s` : 'Đã thuộc <small class="anki-ivl-tag">Mic AI</small>'}</span>
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
              <button type="button" class="btn" ${state.cardIdx === 0 ? 'disabled' : ''} onclick="SpeakingStudio.stepCard(-1)">← Trước</button>
              <button type="button" class="btn btn-primary btn-flip-action" onclick="SpeakingStudio.flipCard()">${state.flipped ? 'Mặt trước' : (isAnyFlow ? 'Xem mạch kể' : 'Xem nghĩa')}</button>
              <button type="button" class="btn" ${state.cardIdx >= cards.length - 1 ? 'disabled' : ''} onclick="SpeakingStudio.stepCard(1)">Tiếp →</button>
            </div>
          </div>

          <div class="keyboard-hint">Phím tắt: <strong>Space</strong> Lật thẻ · <strong>← / →</strong> Chuyển thẻ · <strong>1 / 2 / 3</strong> Chấm điểm (3 mở Mic AI) · <strong>R</strong> Nghe lại</div>
        </div>

        <!-- RIGHT DECK -->
        <aside class="study-deck study-deck-right" aria-label="Tiến độ và danh sách thẻ Speaking">
          <div class="deck-widget widget-theme-teal ink-brackets has-stamp" id="sp-widget-progress">
            <div class="widget-header">
              <span class="tot-icon-tile" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Tiến Độ Story 01</div>
                <div class="widget-subtitle">30 Spoken Chunks + 4 Pivot</div>
              </div>
            </div>

            <div class="tot-vocab-donut-row">
              <div class="tot-donut-wrap">
                <svg class="tot-donut-svg" viewBox="0 0 80 80" aria-hidden="true">
                  <circle cx="40" cy="40" r="31" fill="none" stroke="var(--bg-subtle)" stroke-width="9.5"/>
                  <circle cx="40" cy="40" r="31" fill="none" stroke="var(--streak)" stroke-width="9.5" stroke-dasharray="${donutCirc}" stroke-dashoffset="${warmDashOff}"/>
                  <circle cx="40" cy="40" r="31" fill="none" stroke="var(--accent)" stroke-width="9.5" stroke-linecap="round" stroke-dasharray="${donutCirc}" stroke-dashoffset="${okDashOff}"/>
                </svg>
                <div class="tot-donut-center">
                  <span class="tot-donut-pct tabular">${okPct}%</span>
                  <span class="tot-donut-lbl">Thuộc</span>
                </div>
              </div>

              <div class="vocab-stats-list">
                <div class="vocab-stat-row is-ok">
                  <div class="vocab-stat-label"><span>Đã thuộc</span></div>
                  <div class="vocab-stat-value tabular"><strong>${mStats.done}</strong></div>
                </div>
                <div class="vocab-stat-row is-warm">
                  <div class="vocab-stat-label"><span>Nhớ chậm</span></div>
                  <div class="vocab-stat-value tabular"><strong>${mStats.slow}</strong></div>
                </div>
                <button type="button" class="vocab-stat-row is-muted is-filter-row ${state.unmasteredOnly ? 'active' : ''}" onclick="SpeakingStudio.toggleUnmastered()">
                  <div class="vocab-stat-label"><span>Chưa thuộc</span></div>
                  <div class="vocab-stat-value tabular"><strong>${mStats.unlearned}</strong></div>
                </button>
              </div>
            </div>

            <div class="bamboo-progress-bar">
              <div class="bamboo-seg-mastered" style="width:${okPct}%;"></div>
              <div class="bamboo-seg-slow" style="width:${slowPct}%;"></div>
              <div class="bamboo-seg-unlearned" style="width:${unlPct}%;"></div>
            </div>
          </div>

          <div class="deck-widget widget-theme-coral ink-brackets has-stamp" id="sp-widget-playlist">
            <div class="widget-header">
              <span class="tot-icon-tile warm" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
              </span>
              <div class="widget-title-group">
                <div class="widget-title">Mạch Thẻ Story 01</div>
                <div class="widget-subtitle">Flow → B4.1–B4.5 → Pivot</div>
              </div>
            </div>
            <div class="sp-deck-scroll">${miniListHtml}</div>
          </div>
        </aside>
      </div>
    `;

    syncLiveTimer();
    ensureCooldownTicker();
  }

  function flipCard() {
    state.flipped = !state.flipped;
    const cards = getVisibleCards();
    const card = cards[state.cardIdx];
    renderFlashcardWorkspace();
    if (card && (card.kind === 'chunk' || card.kind === 'pivot')) {
      speakText(card.en, state.flipped ? 'en-GB' : 'en-US');
    }
  }
  function stepCard(delta) {
    const cards = getVisibleCards();
    const next = Math.max(0, Math.min(cards.length - 1, state.cardIdx + delta));
    if (next === state.cardIdx) return;
    state.cardIdx = next;
    state.flipped = false;
    renderFlashcardWorkspace();
    const c = cards[state.cardIdx];
    if (c && (c.kind === 'chunk' || c.kind === 'pivot')) speakText(c.en, 'en-US');
  }
  function jumpCard(idx) {
    state.cardIdx = idx;
    state.flipped = false;
    renderFlashcardWorkspace();
  }
  function speakCurrent(accent, e) {
    if (e) e.stopPropagation();
    const card = getVisibleCards()[state.cardIdx];
    if (card) speakText(card.en, accent || 'en-US');
  }
  function speakStageEn(stageNum, accent, e) {
    if (e) e.stopPropagation();
    const st = (getStory()?.stages || []).find((s) => s.stage === stageNum);
    if (st?.textEn) speakText(st.textEn, accent || 'en-GB');
  }
  function speakRaw(text, accent, e) {
    if (e) e.stopPropagation();
    speakText(text, accent || 'en-GB');
  }
  function toggleUnmastered() {
    state.unmasteredOnly = !state.unmasteredOnly;
    state.cardIdx = 0;
    state.flipped = false;
    renderFlashcardWorkspace();
  }
  function toggleFlowMask(e) {
    if (e) e.stopPropagation();
    state.flowMaskOn = !state.flowMaskOn;
    state.flowRevealed = {};
    renderFlashcardWorkspace();
  }
  function revealFlowNode(key, e) {
    if (e) e.stopPropagation();
    state.flowRevealed[key] = true;
    renderFlashcardWorkspace();
  }
  function selectPerspective(key, e) {
    if (e) e.stopPropagation();
    state.perspKey = key;
    renderFlashcardWorkspace();
  }
  function toggleStageEn(stageNum, e) {
    if (e) e.stopPropagation();
    state.stageEnRevealed[stageNum] = !state.stageEnRevealed[stageNum];
    renderFlashcardWorkspace();
  }

  function assessCard(level) {
    const cards = getVisibleCards();
    const card = cards[state.cardIdx];
    if (!card || card.untested) return;
    if (level === 3) {
      if (getCooldownSec(card.id) > 0 && !isTeacherBypass()) return;
      startRecallTest(card);
      return;
    }
    const mmap = getMasteryMap();
    mmap[card.id] = { level, updatedAt: Date.now() };
    saveMasteryMap(mmap);
    toast(level === 1 ? 'Đã đánh dấu Ôn ngay!' : 'Đã đánh dấu Nhớ chậm!');
    stepCard(1);
  }

  /* ================= 2-STEP RECALL MODAL (VOICE MIC + TYPING FALLBACK) ================= */
  function startRecallTest(card) {
    ensureOverlays();
    STT()?.abort?.();
    recallState = {
      card,
      step: 1, // 1: Speak/Type chunk (30s) | 2: Speak/Type full sentence from VI prompt (60s)
      inputMode: 'voice', // 'voice' | 'type'
      recording: false,
      processing: '',
      transcript: '',
      audioUrl: '',
      feedback: null,
      secsLeft: 30,
      timerId: null
    };
    document.getElementById('sp-recall-modal').classList.add('open');
    const scene = document.getElementById('sp-fc-scene');
    if (scene) scene.style.visibility = 'hidden';
    startRecallTimer();
    renderRecallModal();
  }

  function startRecallTimer() {
    clearInterval(recallState?.timerId);
    recallState.timerId = setInterval(() => {
      if (!recallState) return;
      recallState.secsLeft--;
      const el = document.getElementById('sp-recall-timer');
      if (el) el.textContent = `${Math.max(0, recallState.secsLeft)}s`;
      if (recallState.secsLeft <= 0) {
        clearInterval(recallState.timerId);
        STT()?.abort?.();
        state.cooldownMap[recallState.card.id] = Date.now() + COOLDOWN_SEC * 1000;
        toast('Hết thời gian kiểm tra! Hãy ôn lại thẻ và thử lại.');
        closeRecall();
      }
    }, 1000);
  }

  function toggleRecallMode() {
    if (!recallState) return;
    STT()?.abort?.();
    recallState.recording = false;
    recallState.processing = '';
    recallState.feedback = null;
    recallState.inputMode = recallState.inputMode === 'voice' ? 'type' : 'voice';
    renderRecallModal();
  }

  function updateWaveBars(prefix, bars) {
    const els = document.querySelectorAll(`[data-wave="${prefix}"]`);
    els.forEach((el, i) => {
      const h = Math.max(6, Math.round((bars?.[i] || 0.12) * 32));
      el.style.height = `${h}px`;
    });
  }

  function toggleRecallMic() {
    if (!recallState) return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      toast('Trình duyệt không hỗ trợ Micro — tự động chuyển sang chế độ Gõ phím.');
      recallState.inputMode = 'type';
      renderRecallModal();
      return;
    }
    if (recallState.recording) {
      stt.stop();
      recallState.recording = false;
      recallState.processing = 'Đang chấm giọng nói...';
      renderRecallModal();
      return;
    }
    recallState.feedback = null;
    recallState.transcript = '';
    recallState.processing = '';
    stt.startRecording({
      mode: recallState.step === 1 ? 'word' : 'sentence',
      autoStopOnSilence: recallState.step === 1,
      maxDurationMs: recallState.step === 1 ? 8000 : 25000,
      onStart: () => {
        if (!recallState) return;
        recallState.recording = true;
        renderRecallModal();
      },
      onLevel: ({ bars }) => updateWaveBars('recall', bars),
      onProcessing: () => {
        if (!recallState) return;
        recallState.recording = false;
        recallState.processing = 'Đang chấm giọng nói...';
        renderRecallModal();
      },
      onResult: (res) => {
        if (!recallState) return;
        recallState.recording = false;
        recallState.processing = '';
        recallState.audioUrl = res.audioUrl || '';
        recallState.transcript = res.text || '';
        if (res.silent || !res.text) {
          recallState.feedback = { ok: false, msg: 'Chưa nghe rõ giọng bạn — hãy nói to rõ hơn hoặc chuyển sang Gõ phím dự phòng.' };
          renderRecallModal();
          return;
        }
        gradeRecallAnswer(res.text);
      },
      onError: (errMsg) => {
        if (!recallState) return;
        recallState.recording = false;
        recallState.processing = '';
        recallState.feedback = { ok: false, msg: String(errMsg || 'Không thể dùng Micro. Bạn có thể chuyển sang Gõ phím.') };
        renderRecallModal();
      }
    });
  }

  function submitRecallTyped() {
    if (!recallState) return;
    if (recallState.step === 1) {
      const val = (document.getElementById('sp-recall-input')?.value || '').trim();
      if (!val) { toast('Hãy gõ chính xác cụm từ tiếng Anh vừa học!'); return; }
      recallState.transcript = val;
      gradeRecallAnswer(val);
    } else {
      const val = (document.getElementById('sp-recall-sent-ta')?.value || '').trim();
      if (!val) { toast('Hãy gõ trọn câu Tiếng Anh!'); return; }
      recallState.transcript = val;
      gradeRecallAnswer(val);
    }
  }

  function gradeRecallAnswer(rawText) {
    if (!recallState) return;
    const card = recallState.card;
    const targetNorm = normText(card.en);
    const userNorm = normText(rawText);

    if (recallState.step === 1) {
      const sttMatch = STT()?.matchSpokenTarget?.(rawText, card.en);
      const targetToks = targetNorm.split(' ').filter((w) => w.length >= 2);
      const hitCount = targetToks.filter((t) => userNorm.includes(t) || editDist(userNorm, t) <= 1).length;
      const passed = Boolean(sttMatch?.matched) || userNorm === targetNorm || (targetToks.length > 0 && hitCount >= Math.ceil(targetToks.length * 0.75));
      if (passed) {
        recallState.feedback = { ok: true, msg: `Chuẩn xác: “${rawText}”! Chuẩn bị sang Bước 2 (Nói trọn câu)...` };
        renderRecallModal();
        setTimeout(() => {
          if (!recallState) return;
          recallState.step = 2;
          recallState.secsLeft = 60;
          recallState.transcript = '';
          recallState.audioUrl = '';
          recallState.feedback = null;
          startRecallTimer();
          renderRecallModal();
        }, 700);
      } else {
        recallState.feedback = { ok: false, msg: `Bạn nói/gõ: “${rawText}” — chưa khớp cụm cần nhớ. Thử lại nhé!` };
        renderRecallModal();
      }
    } else {
      const targetToks = targetNorm.split(' ').filter((w) => w.length >= 3);
      const chunkHit = userNorm.includes(targetNorm) || (targetToks.length > 0 && targetToks.filter((t) => userNorm.includes(t)).length >= Math.ceil(targetToks.length * 0.7));
      const wc = countWords(rawText);
      const passed = chunkHit && wc >= 6;
      if (passed) {
        clearInterval(recallState.timerId);
        const mmap = getMasteryMap();
        mmap[card.id] = { level: 3, updatedAt: Date.now() };
        saveMasteryMap(mmap);
        recallState.feedback = { ok: true, passedAll: true, msg: 'Xuất sắc! Bạn đã vận dụng chuẩn cụm Spoken Chunk vào câu nói tự nhiên.' };
        renderRecallModal();
      } else {
        recallState.feedback = {
          ok: false,
          msg: !chunkHit
            ? 'Câu chưa sử dụng đúng cụm từ tiếng Anh vừa học cho ý trên. Hãy thử lại!'
            : 'Câu còn ngắn — hãy nói hoặc viết trọn vẹn câu Tiếng Việt trên.'
        };
        renderRecallModal();
      }
    }
  }

  function teacherPassRecall() {
    if (!recallState || !isTeacherBypass()) return;
    clearInterval(recallState.timerId);
    const mmap = getMasteryMap();
    mmap[recallState.card.id] = { level: 3, updatedAt: Date.now() };
    saveMasteryMap(mmap);
    closeRecall();
    renderFlashcardWorkspace();
    toast('GV: Đã đánh dấu Đã thuộc!');
  }

  function finishRecallAndNext() {
    closeRecall();
    renderFlashcardWorkspace();
    stepCard(1);
  }

  function closeRecall() {
    clearInterval(recallState?.timerId);
    STT()?.abort?.();
    recallState = null;
    document.getElementById('sp-recall-modal')?.classList.remove('open');
    const scene = document.getElementById('sp-fc-scene');
    if (scene) scene.style.visibility = '';
  }

  function renderRecallModal() {
    if (!recallState) return;
    const el = document.getElementById('sp-recall-card');
    const { card, step, inputMode, recording, processing, transcript, audioUrl, feedback } = recallState;

    const waveHtml = `<div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="recall"></span>`).join('')}</div>`;

    let interactionHtml = '';
    if (inputMode === 'voice') {
      interactionHtml = `
        <div class="sp-mic-stage ${recording ? 'is-rec' : ''}">
          ${waveHtml}
          <button type="button" class="sp-mic-btn ${recording ? 'is-recording' : ''}" ${processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleRecallMic()">
            <span>${recording ? 'Đang thu âm · Bấm để dừng' : (step === 1 ? 'Bấm Mic nói cụm từ' : 'Bấm Mic nói trọn câu')}</span>
          </button>
          <div style="font-size:12.5px;color:var(--ink-2);">
            ${processing ? esc(processing) : (recording ? 'Đang nghe...' : (step === 1 ? 'Nói chính xác cụm từ tiếng Anh vừa học' : 'Nói trọn câu tiếng Anh diễn đạt ý trên'))}
          </div>
          ${audioUrl ? `<audio class="sp-audio-replay" controls src="${esc(audioUrl)}"></audio>` : ''}
          ${transcript ? `<div class="sp-transcript-box"><strong>Bạn vừa nói:</strong> ${esc(transcript)}</div>` : ''}
        </div>
      `;
    } else if (step === 1) {
      interactionHtml = `
        <div class="ws-recall-box">
          <input type="text" class="sp-underline-input is-single" id="sp-recall-input" placeholder="_ _ _ _"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            onpaste="event.preventDefault();"
            onkeydown="if(event.key==='Enter'){event.preventDefault();SpeakingStudio.submitRecallTyped();}">
          <div style="font-size:13.5px;color:var(--ink-2);text-align:center;">Gõ chính xác cụm từ tiếng Anh vừa học.</div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn" onclick="SpeakingStudio.closeRecall()">Bỏ kiểm tra</button>
          <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitRecallTyped()">Tiếp sang Bước 2 →</button>
        </div>
      `;
    } else {
      interactionHtml = `
        <textarea class="ws-recall-sent-input" id="sp-recall-sent-ta" style="min-height:110px;"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          onpaste="event.preventDefault();"
          placeholder="Viết câu tiếng Anh của bạn tại đây...">${esc(transcript)}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn" onclick="SpeakingStudio.closeRecall()">Bỏ kiểm tra</button>
          <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitRecallTyped()">Xác nhận câu</button>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="sp-modal-head">
        <div class="sp-modal-title">KIỂM TRA ĐÃ THUỘC · BƯỚC ${step} / 2</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button type="button" class="btn" style="padding:5px 11px;font-size:12px;" onclick="SpeakingStudio.toggleRecallMode()">
            ${inputMode === 'voice' ? 'Gõ phím' : 'Dùng Mic'}
          </button>
          ${isTeacherBypass() ? `<button type="button" class="btn" style="padding:5px 10px;font-size:12px;" onclick="SpeakingStudio.teacherPassRecall()">Bỏ qua (GV)</button>` : ''}
          <span class="sp-pill urgent tabular" id="sp-recall-timer">${recallState.secsLeft}s</span>
        </div>
      </div>

      ${step === 2 ? `<div class="ws-recall-vi-prompt">${esc(card.viPrompt || card.vi)}</div>` : ''}

      ${!feedback?.passedAll ? interactionHtml : ''}

      ${feedback ? `
        <div class="ws-recall-model-box" style="border-left-color:${feedback.ok ? 'var(--ok)' : 'var(--danger)'};">
          <div style="font-weight:800;color:${feedback.ok ? 'var(--ok)' : 'var(--danger)'};">${esc(feedback.msg)}</div>
          ${feedback.passedAll ? `
            ${audioUrl ? `<audio class="sp-audio-replay" controls src="${esc(audioUrl)}"></audio>` : ''}
            <div style="font-size:14px;color:var(--ink);"><strong>Câu tham khảo:</strong> ${highlightInExample(card.enRef || card.example, card.en)}</div>
            <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:6px;">
              <button type="button" class="btn" onclick="SpeakingStudio.speakRaw('${esc(card.enRef || card.example).replace(/'/g, "\\'")}', 'en-GB')">Nghe mẫu (UK)</button>
              <button type="button" class="btn btn-primary" onclick="SpeakingStudio.finishRecallAndNext()">Tiếp tục →</button>
            </div>
          ` : ''}
        </div>
      ` : ''}
    `;

    if (inputMode === 'type' && step === 1) {
      setTimeout(() => document.getElementById('sp-recall-input')?.focus(), 30);
    }
  }

  /* ================= PICTURE BOOK 26-SCENE VIEWER MODAL ================= */
  function openPictureBook(pageIdx, e) {
    if (e) e.stopPropagation();
    ensureOverlays();
    const pages = getStory()?.pictureBook || [];
    if (!pages.length) return;
    pbState = { idx: Math.max(0, Math.min(pages.length - 1, Number(pageIdx) || 0)), showVi: true };
    document.getElementById('sp-pb-modal').classList.add('open');
    renderPictureBook();
  }
  function closePictureBook() {
    pbState = null;
    document.getElementById('sp-pb-modal')?.classList.remove('open');
  }
  function stepPictureBook(delta) {
    if (!pbState) return;
    const pages = getStory()?.pictureBook || [];
    pbState.idx = Math.max(0, Math.min(pages.length - 1, pbState.idx + delta));
    renderPictureBook();
  }
  function jumpPictureBook(idx) {
    if (!pbState) return;
    pbState.idx = idx;
    renderPictureBook();
  }
  function togglePbVi() {
    if (!pbState) return;
    pbState.showVi = !pbState.showVi;
    renderPictureBook();
  }

  function renderPictureBook() {
    if (!pbState) return;
    const pages = getStory()?.pictureBook || [];
    const cur = pages[pbState.idx];
    if (!cur) return;
    const chapters = [];
    pages.forEach((p, i) => {
      if (!chapters.some((c) => c.num === p.chapterNum)) {
        chapters.push({ num: p.chapterNum, title: p.chapterTitle, firstIdx: i });
      }
    });

    const el = document.getElementById('sp-pb-card');
    el.innerHTML = `
      <div class="sp-modal-head" style="padding-bottom:10px;border-bottom:1px solid var(--border);">
        <div>
          <div class="sp-modal-title">Sách Tranh Story 01 · Cảnh ${cur.page} / ${pages.length}</div>
          <div style="font-size:12.5px;color:var(--ink-2);">${esc(cur.chapterTitle)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button type="button" class="btn" style="padding:6px 11px;font-size:12px;" onclick="SpeakingStudio.togglePbVi()">${pbState.showVi ? 'Ẩn Tiếng Việt' : 'Hiện Tiếng Việt'}</button>
          <button type="button" class="btn" style="padding:6px 11px;" onclick="SpeakingStudio.closePictureBook()">Đóng ✕</button>
        </div>
      </div>

      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        ${chapters.map((ch) => `
          <button type="button" class="sp-persp-tab ${ch.num === cur.chapterNum ? 'active' : ''}" onclick="SpeakingStudio.jumpPictureBook(${ch.firstIdx})">Chương ${ch.num}</button>
        `).join('')}
      </div>

      <div class="sp-pb-grid">
        <div class="sp-pb-frame">
          <img src="${esc(cur.img)}" alt="Scene ${cur.page}: ${esc(cur.title)}">
        </div>
        <div class="sp-pb-copy">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <span class="sp-pill ok">${esc(cur.badge)}</span>
            <div style="display:flex;gap:6px;">
              <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cur.en).replace(/'/g, "\\'")}', 'en-GB')"><span>UK</span></button>
              <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cur.en).replace(/'/g, "\\'")}', 'en-US')"><span>US</span></button>
            </div>
          </div>
          <div style="font-size:17px;font-weight:800;color:var(--ink);">${esc(cur.title)}</div>
          <div class="sp-pb-en">${esc(cur.en)}</div>
          ${pbState.showVi ? `<div class="sp-pb-vi">${esc(cur.vi)}</div>` : ''}
          ${(cur.collocations || []).length ? `
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">
              ${cur.collocations.map((col) => `
                <button type="button" class="sp-kw-chip hit" style="cursor:pointer;" onclick="SpeakingStudio.speakRaw('${esc(col).replace(/'/g, "\\'")}', 'en-US')">${esc(col)}</button>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--border);">
        <button type="button" class="btn" ${pbState.idx === 0 ? 'disabled' : ''} onclick="SpeakingStudio.stepPictureBook(-1)">← Cảnh trước</button>
        <span style="font-size:12.5px;color:var(--ink-2);font-weight:700;" class="tabular">${cur.page} / ${pages.length}</span>
        <button type="button" class="btn btn-primary" ${pbState.idx >= pages.length - 1 ? 'disabled' : ''} onclick="SpeakingStudio.stepPictureBook(1)">Cảnh tiếp →</button>
      </div>
    `;
  }

  /* ================= TAB 3: TASK HUB & 4-STEP TASK EXAM ================= */
  function renderTaskHub(tabsEl, gridEl) {
    const story = getStory();
    if (!story || !gridEl) return;
    const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
    const subEl = document.getElementById('inline-task-sub');
    if (titleEl) titleEl.textContent = 'Task bài tập · Speaking';
    const mStats = getStoryMasteryStats(story);
    const doneInfo = getTaskDoneMap()[story.id] || null;
    if (subEl) subEl.textContent = `Story 01 · ${mStats.done}/${mStats.total} thẻ đã thuộc · Quy trình 4 bước (Viết B4 → Nói B4 → Bẻ lái → Nói 2 phút).`;
    if (tabsEl) {
      tabsEl.innerHTML = `<button type="button" class="tot-seg-btn active">Story 01 · Describe a Person</button>`;
    }

    const maxSt = doneInfo?.maxStage || 0;
    gridEl.innerHTML = `
      <article class="sp-task-hero-card">
        <div class="sp-task-hero-top">
          <div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
              <span class="sp-pill ok">STORY 01</span>
              <span class="sp-pill">${mStats.done}/${mStats.total} thẻ Flashcard</span>
              ${doneInfo?.completed ? `<span class="sp-pill ok">✓ Hoàn thành Task</span>` : ''}
            </div>
            <h3 style="margin:8px 0 4px;font-size:19px;font-weight:800;color:var(--ink);">${esc(story.title)}</h3>
            <p style="margin:0;font-size:13.5px;color:var(--ink-2);">${esc(story.subtitle)}</p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn" onclick="window.TotoroUI.switchView('flashcard')">Học Flashcard</button>
            <button type="button" class="btn" onclick="SpeakingStudio.openPictureBook(0)">Sách Tranh</button>
            <button type="button" class="btn" onclick="window.TotoroUI.switchView('practice')">Luyện Cue Card</button>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.startTaskExam()">
              ${doneInfo?.completed ? 'Làm lại Task 4 Bước →' : 'Vào Task · 4 Bước →'}
            </button>
          </div>
        </div>

        <div class="sp-task-steps-grid">
          <div class="sp-task-step-box ${maxSt >= 1 ? 'is-done' : ''}">
            <span class="sp-task-step-num">Test 1 · 05:00</span>
            <div class="sp-task-step-title">Viết Lại 5 Chặng Lõi B4</div>
            <div class="sp-task-step-desc">Gõ Tiếng Anh trực tiếp cho 5 chặng B4.1 → B4.5.</div>
          </div>
          <div class="sp-task-step-box ${maxSt >= 2 ? 'is-done' : ''}">
            <span class="sp-task-step-num">Test 2 · 05:00</span>
            <div class="sp-task-step-title">Kể Lại 5 Chặng B4 Qua Mic</div>
            <div class="sp-task-step-desc">Nói từng chặng bằng Tiếng Anh, chấm độ phủ từ khóa &amp; nghe lại giọng.</div>
          </div>
          <div class="sp-task-step-box ${maxSt >= 3 ? 'is-done' : ''}">
            <span class="sp-task-step-num">Test 3 · 04:00</span>
            <div class="sp-task-step-title">Luyện Bẻ Lái (B1–B3 + B5)</div>
            <div class="sp-task-step-desc">Xoay 3 đề khác góc nhìn (Person · Cross-Topic · Cross-Category) giữ nguyên lõi B4.</div>
          </div>
          <div class="sp-task-step-box ${doneInfo?.completed ? 'is-done' : ''}">
            <span class="sp-task-step-num">Test 4 · 02:00</span>
            <div class="sp-task-step-title">Kể Nguyên Bài 2 Phút</div>
            <div class="sp-task-step-desc">Nói liền mạch 2 phút theo 5 mốc ngắn → xem Thời lượng, WPM, Chunks &amp; đối chiếu bài mẫu.</div>
          </div>
        </div>
      </article>
    `;
  }

  function getStageLimitSec(stageNum) {
    if (stageNum === 1) return 5 * 60;
    if (stageNum === 2) return 5 * 60;
    if (stageNum === 3) return 4 * 60;
    return 2 * 60;
  }

  function startTaskExam(initialStage) {
    ensureOverlays();
    STT()?.abort?.();
    const story = getStory();
    if (!story) return;

    const st = Number(initialStage) || 1;
    examState = {
      story,
      stage: st,
      secsLeft: getStageLimitSec(st),
      timerId: null,
      // Test 1: Inline Tab-Controlled Flow (5 stages B4)
      t1Drafts: {},
      t1Locked: {},
      t1Audit: {},
      // Test 2: Speak 5 stages B4 via Mic (or typing fallback)
      t2ActiveStage: 1,
      t2Results: {}, // stageNum -> { text, audioUrl, hits, misses, pass }
      t2TypeMode: {},
      t2RecordingStage: null,
      t2ProcessingStage: null,
      // Test 3: Steering Drills (3 prompts)
      t3Idx: 0,
      t3Results: {}, // drillId -> { text, audioUrl, hits, pass }
      t3TypeMode: false,
      t3Recording: false,
      t3Processing: false,
      // Test 4: Full 2-Min Run
      t4Recording: false,
      t4Processing: false,
      t4TypeMode: false,
      t4RecStartedAt: 0,
      t4Transcript: '',
      t4AudioUrl: '',
      t4Metrics: null,
      t4Finalized: false
    };

    document.getElementById('sp-task-exam-modal').classList.add('open');
    startExamTimer();
    renderExamModal();
  }

  function startExamTimer() {
    clearInterval(examState?.timerId);
    examState.timerId = setInterval(() => {
      if (!examState || examState.t4Finalized) return;
      examState.secsLeft--;
      const el = document.getElementById('sp-exam-timer');
      if (el) {
        el.textContent = fmtMmSs(examState.secsLeft);
        el.classList.toggle('urgent', examState.secsLeft <= 45);
      }
      if (examState.secsLeft <= 0) {
        clearInterval(examState.timerId);
        if (examState.stage === 4 && examState.t4Recording) {
          toggleT4Mic();
        } else {
          toast(`Hết giờ Bước ${examState.stage} — bạn có thể bấm Nộp/Kiểm tra ngay!`);
        }
      }
    }, 1000);
  }

  function advanceExamStage(nextStage) {
    if (!examState) return;
    STT()?.abort?.();
    const map = getTaskDoneMap();
    const prev = map[examState.story.id] || { maxStage: 0, completed: false };
    prev.maxStage = Math.max(prev.maxStage || 0, nextStage - 1);
    map[examState.story.id] = prev;
    saveTaskDoneMap(map);

    examState.stage = nextStage;
    examState.secsLeft = getStageLimitSec(nextStage);
    startExamTimer();
    renderExamModal();
  }

  function closeTaskExamModal() {
    clearInterval(examState?.timerId);
    STT()?.abort?.();
    examState = null;
    document.getElementById('sp-task-exam-modal')?.classList.remove('open');
    if (document.getElementById('inline-tasks-grid')?.classList.contains('is-speaking-grid')) {
      renderTaskHub(document.getElementById('inline-task-suites'), document.getElementById('inline-tasks-grid'));
    }
  }

  function teacherJumpExam(stageNum) {
    if (!examState || !isTeacherBypass()) return;
    advanceExamStage(stageNum);
  }

  /* --- Test 1 Helpers: Inline Tab-Controlled Monkeytype Flow (5 stages B4) --- */
  const spCaretTimers = new WeakMap();
  function splitClauses(viText) {
    const parts = String(viText || '').split(/(?<=[.;?!])\s+/).filter(Boolean);
    return parts.length ? parts : [String(viText || '')];
  }
  function renderSpT1Mirror(text, isAtEnd, targetPhrases) {
    if (!text) return { html: '', typos: 0 };
    const parts = text.match(/(\s+|\S+)/g) || [];
    const typoSet = new Set(detectTypos(text, targetPhrases).map((w) => w.toLowerCase()));
    let typos = 0;
    const html = parts.map((part, idx) => {
      if (/^\s+$/.test(part)) return esc(part);
      const isLast = isAtEnd && idx === parts.length - 1 && !/[.,;:!?)]$/.test(part);
      const clean = part.toLowerCase().replace(/^[^a-z'-]+|[^a-z'-]+$/g, '');
      if (!isLast && clean.length >= 3 && (COMMON_TYPOS.has(clean) || typoSet.has(clean))) {
        typos++;
        return `<span class="sp-t1-tok-err">${esc(part)}</span>`;
      }
      return esc(part);
    }).join('');
    return { html, typos };
  }
  function positionSpCaret(wrapEl, caretEl, isFocused, isTyping) {
    if (!wrapEl || !caretEl) return;
    if (!isFocused) {
      clearTimeout(spCaretTimers.get(caretEl));
      spCaretTimers.delete(caretEl);
      caretEl.classList.remove('is-visible', 'is-idle');
      return;
    }
    const anchor = wrapEl.querySelector('.sp-t1-anchor');
    if (!anchor) return;
    const wRect = wrapEl.getBoundingClientRect();
    const aRect = anchor.getBoundingClientRect();
    const x = Math.round(aRect.left - wRect.left);
    const y = Math.round(aRect.top - wRect.top + (aRect.height - caretEl.offsetHeight) * 0.5);
    caretEl.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    caretEl.classList.add('is-visible');
    if (isTyping) {
      caretEl.classList.remove('is-idle');
      clearTimeout(spCaretTimers.get(caretEl));
      spCaretTimers.set(caretEl, setTimeout(() => caretEl.classList.add('is-idle'), 450));
    } else if (!spCaretTimers.has(caretEl)) {
      caretEl.classList.add('is-idle');
    }
  }

  function bindSpT1InlineFlow() {
    if (!examState || examState.stage !== 1) return;
    const stages = examState.story.stages || [];
    const allChunks = (examState.story.spokenChunks || []).map((c) => c.en);
    const entries = [];
    const typoByStage = {};

    const updateTelemetry = () => {
      let done = 0, words = 0, typos = 0;
      entries.forEach((en) => {
        const val = en.ta.value.trim();
        if (val) words += countWords(val);
        const locked = Boolean(examState.t1Locked[en.stage]);
        if (locked) done++;
        typos += typoByStage[en.stage] || 0;
        const conn = document.getElementById(`sp-t1-conn-${en.stage}`);
        if (conn) conn.classList.toggle('is-lit', locked);
      });
      const doneEl = document.getElementById('sp-t1-stat-done');
      const wcEl = document.getElementById('sp-t1-stat-words');
      const errEl = document.getElementById('sp-t1-stat-typos');
      const errWrap = document.getElementById('sp-t1-stat-err-wrap');
      const ringEl = document.getElementById('sp-t1-ring-fg');
      if (doneEl) doneEl.textContent = `${done}/${stages.length}`;
      if (wcEl) wcEl.textContent = String(words);
      if (errEl) errEl.textContent = String(typos);
      if (errWrap) errWrap.classList.toggle('is-err', typos > 0);
      if (ringEl) ringEl.style.strokeDashoffset = (44 * (1 - done / Math.max(1, stages.length))).toFixed(1);
    };

    const syncEntry = (en, isTyping) => {
      const val = en.ta.value;
      examState.t1Drafts[en.stage] = val;
      const focused = document.activeElement === en.ta;
      const locked = Boolean(examState.t1Locked[en.stage]);
      const caretPos = focused ? (en.ta.selectionStart ?? val.length) : val.length;
      const before = val.slice(0, caretPos);
      const after = val.slice(caretPos);
      const m1 = renderSpT1Mirror(before, caretPos === val.length, allChunks);
      const m2 = renderSpT1Mirror(after, false, allChunks);
      typoByStage[en.stage] = m1.typos + m2.typos;
      en.mirror.innerHTML = val
        ? `${m1.html}<span class="sp-t1-anchor"></span>${m2.html}`
        : `<span class="sp-t1-anchor"></span><span class="sp-t1-placeholder">Gõ Tiếng Anh cho Chặng B4.${en.stage}... (Tab / Enter khi xong)</span>`;
      en.ta.style.height = 'auto';
      en.ta.style.height = `${Math.max(46, en.mirror.scrollHeight)}px`;
      en.cell.classList.toggle('is-focused', focused);
      en.cell.classList.toggle('is-done', locked && !en.cell.classList.contains('is-bad'));
      en.cue.classList.toggle('is-hidden', locked && !focused);
      positionSpCaret(en.wrap, en.caret, focused, isTyping);
      updateTelemetry();
    };

    const confirmStage = (idx) => {
      const en = entries[idx];
      if (!en) return;
      if (countWords(en.ta.value) >= 5) {
        examState.t1Locked[en.stage] = true;
        en.cell.classList.remove('is-bad');
      }
      syncEntry(en, false);
      const next = entries[idx + 1];
      if (next) {
        next.ta.focus();
      } else {
        en.ta.blur();
      }
    };

    const stepBack = (idx) => {
      const en = entries[idx];
      if (!en) return;
      if (examState.t1Locked[en.stage]) {
        examState.t1Locked[en.stage] = false;
        syncEntry(en, false);
        return;
      }
      const prev = entries[idx - 1];
      if (prev) {
        examState.t1Locked[prev.stage] = false;
        syncEntry(prev, false);
        prev.ta.focus();
      }
    };

    stages.forEach((st, idx) => {
      const cell = document.getElementById(`sp-t1-cell-${st.stage}`);
      const ta = document.getElementById(`sp-t1-ta-${st.stage}`);
      const mirror = document.getElementById(`sp-t1-mirror-${st.stage}`);
      const caret = document.getElementById(`sp-t1-caret-${st.stage}`);
      const cue = document.getElementById(`sp-t1-cue-${st.stage}`);
      const wrap = cell?.querySelector('.sp-t1-input-wrap');
      if (!cell || !ta || !mirror || !caret || !cue || !wrap) return;
      const en = { stage: st.stage, idx, cell, ta, mirror, caret, cue, wrap };
      entries.push(en);

      cell.addEventListener('click', () => ta.focus());
      ta.addEventListener('input', () => syncEntry(en, true));
      ta.addEventListener('focus', () => syncEntry(en, false));
      ta.addEventListener('blur', () => syncEntry(en, false));
      ta.addEventListener('keyup', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) syncEntry(en, false);
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          confirmStage(idx);
        } else if (e.key === 'Tab' && e.shiftKey) {
          e.preventDefault();
          stepBack(idx);
        } else if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          confirmStage(idx);
        }
      });
      syncEntry(en, false);
    });

    document.getElementById('sp-t1-btn-next')?.addEventListener('click', () => {
      const activeIdx = entries.findIndex((e) => document.activeElement === e.ta);
      confirmStage(activeIdx >= 0 ? activeIdx : 0);
    });
    document.getElementById('sp-t1-btn-prev')?.addEventListener('click', () => {
      const activeIdx = entries.findIndex((e) => document.activeElement === e.ta);
      stepBack(activeIdx >= 0 ? activeIdx : Math.max(0, entries.length - 1));
    });

    setTimeout(() => entries[0]?.ta?.focus(), 40);
  }

  function checkTaskTest1() {
    if (!examState) return;
    const stages = examState.story.stages || [];
    const allChunks = (examState.story.spokenChunks || []).map((c) => c.en);
    let allOk = true;
    stages.forEach((st) => {
      const txt = String(examState.t1Drafts[st.stage] || '').trim();
      const ev = evaluateKeywords(txt, st.keywords);
      const typos = detectTypos(txt, allChunks);
      const pass = ev.words >= 8 && ev.hits.length >= 2 && typos.length === 0;
      examState.t1Audit[st.stage] = { pass, words: ev.words, hits: ev.hits.length, typos };
      if (pass) examState.t1Locked[st.stage] = true;
      else allOk = false;
    });
    if (allOk) {
      toast('Tuyệt vời! Đã thuộc mặt chữ cả 5 chặng lõi B4 → Sang Test 2 (Nói qua Mic)!');
      advanceExamStage(2);
    } else {
      toast('Một số chặng chưa đủ ý hoặc còn lỗi chính tả (viền đỏ) — hãy bổ sung nhé!');
      renderExamModal();
    }
  }

  /* --- Test 2 Helpers: Speak 5 stages B4 via Mic --- */
  function toggleT2TypeMode(stageNum) {
    if (!examState) return;
    examState.t2TypeMode[stageNum] = !examState.t2TypeMode[stageNum];
    renderExamModal();
  }
  function submitT2Typed(stageNum) {
    if (!examState) return;
    const val = (document.getElementById(`sp-t2-ta-${stageNum}`)?.value || '').trim();
    if (!val) { toast('Hãy nhập nội dung Chặng B4.' + stageNum); return; }
    gradeT2Stage(stageNum, val, '');
  }
  function toggleT2Mic(stageNum) {
    if (!examState) return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      toast('Thiết bị không có Micro — chuyển sang gõ dự phòng cho chặng này.');
      examState.t2TypeMode[stageNum] = true;
      renderExamModal();
      return;
    }
    if (examState.t2RecordingStage === stageNum) {
      stt.stop();
      examState.t2RecordingStage = null;
      examState.t2ProcessingStage = stageNum;
      renderExamModal();
      return;
    }
    stt.abort();
    examState.t2RecordingStage = stageNum;
    examState.t2ProcessingStage = null;
    renderExamModal();
    stt.startRecording({
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 45000,
      onLevel: ({ bars }) => updateWaveBars(`t2_${stageNum}`, bars),
      onProcessing: () => {
        if (!examState) return;
        examState.t2RecordingStage = null;
        examState.t2ProcessingStage = stageNum;
        renderExamModal();
      },
      onResult: (res) => {
        if (!examState) return;
        examState.t2RecordingStage = null;
        examState.t2ProcessingStage = null;
        if (res.silent || !res.text) {
          toast('Chưa nghe rõ giọng bạn — hãy nói gần Micro hơn nhé!');
          renderExamModal();
          return;
        }
        gradeT2Stage(stageNum, res.text, res.audioUrl || '');
      },
      onError: (msg) => {
        if (!examState) return;
        examState.t2RecordingStage = null;
        examState.t2ProcessingStage = null;
        toast(String(msg || 'Lỗi thu âm Micro.'));
        renderExamModal();
      }
    });
  }
  function gradeT2Stage(stageNum, text, audioUrl) {
    const st = (examState.story.stages || []).find((s) => s.stage === stageNum);
    if (!st) return;
    const ev = evaluateKeywords(text, st.keywords);
    const pass = ev.words >= 10 && (ev.hits.length >= 2 || ev.ratio >= 0.3);
    examState.t2Results[stageNum] = { text, audioUrl, hits: ev.hits, misses: ev.misses, words: ev.words, pass };
    if (pass && stageNum < 5) examState.t2ActiveStage = stageNum + 1;
    renderExamModal();
  }
  function checkTaskTest2() {
    if (!examState) return;
    const stages = examState.story.stages || [];
    const passedCnt = stages.filter((s) => examState.t2Results[s.stage]?.pass).length;
    if (passedCnt >= stages.length) {
      toast('Đạt 5/5 chặng nói B4 → Sang Test 3 (Luyện Bẻ Lái B1–B3 & B5)!');
      advanceExamStage(3);
    } else {
      toast(`Cần đạt đủ ${stages.length}/5 chặng nói B4 (hiện tại ${passedCnt}/5).`);
    }
  }

  /* --- Test 3 Helpers: Steering Drills (3 prompts) --- */
  function selectT3Drill(idx) {
    if (!examState) return;
    STT()?.abort?.();
    examState.t3Recording = false;
    examState.t3Processing = false;
    examState.t3Idx = idx;
    renderExamModal();
  }
  function toggleT3TypeMode() {
    if (!examState) return;
    examState.t3TypeMode = !examState.t3TypeMode;
    renderExamModal();
  }
  function submitT3Typed() {
    if (!examState) return;
    const drill = (examState.story.steerDrills || [])[examState.t3Idx];
    const val = (document.getElementById('sp-t3-ta')?.value || '').trim();
    if (!drill || !val) { toast('Hãy nhập câu Mở bài B1–B3 và Chốt bài B5!'); return; }
    gradeT3Drill(drill, val, '');
  }
  function toggleT3Mic() {
    if (!examState) return;
    const drill = (examState.story.steerDrills || [])[examState.t3Idx];
    const stt = STT();
    if (!stt?.isSupported?.()) {
      examState.t3TypeMode = true;
      renderExamModal();
      return;
    }
    if (examState.t3Recording) {
      stt.stop();
      examState.t3Recording = false;
      examState.t3Processing = true;
      renderExamModal();
      return;
    }
    stt.abort();
    examState.t3Recording = true;
    examState.t3Processing = false;
    renderExamModal();
    stt.startRecording({
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 45000,
      onLevel: ({ bars }) => updateWaveBars('t3', bars),
      onProcessing: () => { if (examState) { examState.t3Recording = false; examState.t3Processing = true; renderExamModal(); } },
      onResult: (res) => {
        if (!examState) return;
        examState.t3Recording = false;
        examState.t3Processing = false;
        if (res.silent || !res.text) { toast('Chưa nghe rõ giọng bạn — hãy nói lại nhé!'); renderExamModal(); return; }
        gradeT3Drill(drill, res.text, res.audioUrl || '');
      },
      onError: (msg) => { if (examState) { examState.t3Recording = false; examState.t3Processing = false; toast(String(msg)); renderExamModal(); } }
    });
  }
  function gradeT3Drill(drill, text, audioUrl) {
    const ev = evaluateKeywords(text, drill.keywords);
    const pass = ev.words >= 12 && ev.hits.length >= 2;
    examState.t3Results[drill.id] = { text, audioUrl, hits: ev.hits, misses: ev.misses, words: ev.words, pass };
    renderExamModal();
  }
  function checkTaskTest3() {
    if (!examState) return;
    const drills = examState.story.steerDrills || [];
    const passedCnt = drills.filter((d) => examState.t3Results[d.id]?.pass).length;
    if (passedCnt >= drills.length) {
      toast('Hoàn thành cả 3 góc bẻ lái → Sang Test 4 (Kể nguyên bài 2 phút)!');
      advanceExamStage(4);
    } else {
      toast(`Hãy hoàn thành đủ ${drills.length}/3 đề bẻ lái (hiện đạt ${passedCnt}/${drills.length}).`);
    }
  }

  /* --- Test 4 Helpers: Full 2-Minute Monologue Run --- */
  function toggleT4TypeMode() {
    if (!examState) return;
    examState.t4TypeMode = !examState.t4TypeMode;
    renderExamModal();
  }
  function toggleT4Mic() {
    if (!examState) return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      examState.t4TypeMode = true;
      renderExamModal();
      return;
    }
    if (examState.t4Recording) {
      stt.stop();
      examState.t4Recording = false;
      examState.t4Processing = true;
      renderExamModal();
      return;
    }
    stt.abort();
    examState.t4Recording = true;
    examState.t4Processing = false;
    examState.t4RecStartedAt = Date.now();
    renderExamModal();
    stt.startRecording({
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 125000,
      onLevel: ({ bars }) => updateWaveBars('t4', bars),
      onProcessing: () => { if (examState) { examState.t4Recording = false; examState.t4Processing = true; renderExamModal(); } },
      onResult: (res) => {
        if (!examState) return;
        examState.t4Recording = false;
        examState.t4Processing = false;
        const dur = res.durationSec || Math.max(10, Math.round((Date.now() - examState.t4RecStartedAt) / 1000));
        if (res.silent || !res.text) { toast('Chưa thu được giọng nói — hãy thử lại hoặc dùng gõ dự phòng!'); renderExamModal(); return; }
        finalizeTaskTest4(res.text, dur, res.audioUrl || '');
      },
      onError: (msg) => { if (examState) { examState.t4Recording = false; examState.t4Processing = false; toast(String(msg)); renderExamModal(); } }
    });
  }
  function submitT4Typed() {
    if (!examState) return;
    const val = (document.getElementById('sp-t4-ta')?.value || '').trim();
    if (countWords(val) < 40) { toast('Bài kể Full Run cần tối thiểu 40 từ bao quát 5 chặng B4!'); return; }
    const estDur = Math.min(120, Math.max(45, Math.round(countWords(val) / 2.2)));
    finalizeTaskTest4(val, estDur, '');
  }
  function finalizeTaskTest4(text, durationSec, audioUrl) {
    if (!examState) return;
    clearInterval(examState.timerId);
    examState.t4Transcript = text;
    examState.t4AudioUrl = audioUrl;
    examState.t4Metrics = evaluateFullSpeech(text, durationSec);
    examState.t4Finalized = true;

    const map = getTaskDoneMap();
    map[examState.story.id] = {
      completed: true,
      maxStage: 4,
      updatedAt: Date.now(),
      metrics: {
        words: examState.t4Metrics.words,
        wpm: examState.t4Metrics.wpm,
        durationSec: examState.t4Metrics.durationSec,
        chunks: examState.t4Metrics.usedChunks.length
      }
    };
    saveTaskDoneMap(map);
    renderExamModal();
    toast('Chúc mừng! Bạn đã hoàn thành trọn vẹn Task 4 Bước · Story 01!');
  }

  function launchCueCardFromTask() {
    const firstCue = (getStory()?.cueCards || [])[0];
    closeTaskExamModal();
    window.TotoroUI?.switchView?.('practice');
    if (firstCue) openPracticeRoom(firstCue.id, 'practice');
  }

  function renderExamModal() {
    if (!examState) return;
    const { story, stage } = examState;
    const stages = story.stages || [];
    const card = document.getElementById('sp-task-exam-card');
    const teacherJump = isTeacherBypass() ? `
      <div style="display:flex;gap:4px;">
        ${[1, 2, 3, 4].map((n) => `<button type="button" class="btn" style="padding:4px 8px;font-size:11.5px;" onclick="SpeakingStudio.teacherJumpExam(${n})">T${n}</button>`).join('')}
      </div>
    ` : '';

    let bodyHtml = '';

    if (stage === 1) {
      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 1 · Viết Lại 5 Chặng Lõi B4 Trực Tiếp Trong Sơ Đồ Flow</div>
            <div class="ws-t1-stage-sub">Gõ Tiếng Anh cho từng chặng <strong>B4.1 → B4.5</strong> — chữ Tiếng Việt giữ nguyên lúc gõ; xong chặng nào nhấn <strong>Tab</strong> hoặc <strong>Enter</strong> để khóa xanh và sáng mũi tên sang chặng kế tiếp.</div>
          </div>
          <div class="ws-t1-telemetry">
            <div class="ws-t1-stat is-accent">
              <svg class="ws-t1-ring" viewBox="0 0 18 18" aria-hidden="true">
                <circle class="ws-t1-ring-bg" cx="9" cy="9" r="7"/>
                <circle class="ws-t1-ring-fg" id="sp-t1-ring-fg" cx="9" cy="9" r="7"/>
              </svg>
              <strong id="sp-t1-stat-done">0/5</strong><span>chặng</span>
            </div>
            <div class="ws-t1-stat"><strong id="sp-t1-stat-words">0</strong><span>từ</span></div>
            <div class="ws-t1-stat" id="sp-t1-stat-err-wrap"><strong id="sp-t1-stat-typos">0</strong><span>lỗi</span></div>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.checkTaskTest1()">Kiểm tra &amp; Sang Test 2 →</button>
          </div>
        </div>

        <div class="sp-t1-grid">
          ${stages.map((st, idx) => {
            const aud = examState.t1Audit[st.stage];
            const isBad = aud && !aud.pass;
            const locked = Boolean(examState.t1Locked[st.stage]);
            const clauses = splitClauses(st.textVi);
            return `
              <div class="sp-t1-cell ${isBad ? 'is-bad' : (locked ? 'is-done' : '')}" id="sp-t1-cell-${st.stage}">
                <div class="sp-t1-cell-head">
                  <span class="sp-t1-step-lbl">B4.${st.stage} · ${esc(st.titleVi)}</span>
                  ${aud ? `<span style="font-size:11.5px;font-weight:700;color:${aud.pass ? 'var(--ok)' : 'var(--danger)'};">${aud.pass ? '✓ Đạt chặng' : (aud.typos.length ? `Sai chính tả: ${esc(aud.typos.join(', '))}` : 'Cần viết đủ ý hơn (≥8 từ & ≥2 từ khóa)')}</span>` : ''}
                </div>
                <div class="sp-t1-cue" id="sp-t1-cue-${st.stage}">
                  ${clauses.map((cl, cIdx) => `<span class="sp-t1-clause ${cIdx === 0 ? 'is-active' : ''}">${esc(cl)} </span>`).join('')}
                </div>
                <div class="sp-t1-input-wrap">
                  <div class="sp-t1-mirror" id="sp-t1-mirror-${st.stage}"></div>
                  <div class="sp-t1-caret" id="sp-t1-caret-${st.stage}"></div>
                  <textarea class="sp-t1-ta" id="sp-t1-ta-${st.stage}" spellcheck="false" autocomplete="off">${esc(examState.t1Drafts[st.stage] || '')}</textarea>
                </div>
              </div>
              ${idx < stages.length - 1 ? `
                <div class="sp-t1-connector ${locked ? 'is-lit' : ''}" id="sp-t1-conn-${st.stage}" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="m19 12-7 7-7-7"/></svg>
                </div>
              ` : ''}
            `;
          }).join('')}
        </div>

        <div class="ws-t1-footer">
          <span class="ws-t1-footer-note">Tự do paraphrase theo mạch kể của bạn — chữ Tiếng Việt chỉ ẩn khi tự bạn nhấn Tab / Enter xác nhận.</span>
          <div class="ws-t1-kb-group">
            <button type="button" class="ws-t1-kb-btn is-primary" id="sp-t1-btn-next">Xong chặng này <kbd>Tab</kbd></button>
            <button type="button" class="ws-t1-kb-btn" id="sp-t1-btn-prev">Hiện lại / Lùi ô <kbd>Shift</kbd>+<kbd>Tab</kbd></button>
          </div>
        </div>
      `;
    } else if (stage === 2) {
      const passedCnt = stages.filter((s) => examState.t2Results[s.stage]?.pass).length;
      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 2 · Kể Lại 5 Chặng Lõi B4 Qua Mic</div>
            <div class="ws-t1-stage-sub">Bấm Mic nói Tiếng Anh cho từng chặng <strong>B4.1 → B4.5</strong>. Chặng đạt độ phủ từ khóa cốt lõi sẽ khóa xanh ✓ và cho nghe lại giọng của bạn.</div>
          </div>
          <div class="ws-t1-telemetry">
            <span class="sp-pill ${passedCnt === 5 ? 'ok' : ''}">${passedCnt} / 5 chặng đạt</span>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.checkTaskTest2()">Sang Test 3 · Bẻ Lái →</button>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:11px;">
          ${stages.map((st) => {
            const res = examState.t2Results[st.stage];
            const isRec = examState.t2RecordingStage === st.stage;
            const isProc = examState.t2ProcessingStage === st.stage;
            const isType = Boolean(examState.t2TypeMode[st.stage]);
            return `
              <div class="sp-stage-speak-card ${res?.pass ? 'is-pass' : ''}">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
                  <div style="display:flex;align-items:center;gap:8px;">
                    <span class="sp-stage-badge">B4.${st.stage}</span>
                    <strong style="font-size:14px;">${esc(st.titleVi)}</strong>
                    ${res?.pass ? `<span class="sp-pill ok">✓ Đạt (${res.hits.length}/${st.keywords.length} từ khóa)</span>` : ''}
                  </div>
                  <div style="display:flex;align-items:center;gap:6px;">
                    <button type="button" class="btn" style="padding:5px 10px;font-size:12px;" onclick="SpeakingStudio.toggleT2TypeMode(${st.stage})">${isType ? 'Dùng Mic' : 'Gõ dự phòng'}</button>
                    ${!isType ? `
                      <button type="button" class="btn ${isRec ? '' : 'btn-primary'}" style="padding:6px 13px;font-size:12.5px;${isRec ? 'background:var(--danger);color:#fff;border-color:var(--danger);' : ''}" ${isProc ? 'disabled' : ''} onclick="SpeakingStudio.toggleT2Mic(${st.stage})">
                        ${isProc ? 'Đang nhận diện...' : (isRec ? 'Dừng & Chấm' : (res ? 'Nói lại chặng này' : 'Bấm Mic nói'))}
                      </button>
                    ` : ''}
                  </div>
                </div>
                <div style="font-size:13.2px;color:var(--ink-2);line-height:1.55;">${esc(st.textVi)}</div>
                ${isRec ? `<div class="sp-wave-bars" style="justify-content:flex-start;">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="t2_${st.stage}" style="background:var(--danger);opacity:0.9;"></span>`).join('')}</div>` : ''}
                ${isType ? `
                  <div style="display:flex;gap:8px;align-items:flex-end;">
                    <textarea class="sp-note-ta" id="sp-t2-ta-${st.stage}" style="min-height:60px;" placeholder="Gõ bản kể Tiếng Anh cho chặng B4.${st.stage}...">${esc(res?.text || '')}</textarea>
                    <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitT2Typed(${st.stage})">Chấm</button>
                  </div>
                ` : ''}
                ${res ? `
                  <div class="sp-transcript-box" style="font-size:13.5px;">
                    <div><strong>Bản kể của bạn (${res.words} từ):</strong> ${esc(res.text)}</div>
                    ${res.audioUrl ? `<audio class="sp-audio-replay" style="margin-top:8px;" controls src="${esc(res.audioUrl)}"></audio>` : ''}
                    <div class="sp-kw-row" style="margin-top:8px;">
                      ${st.keywords.map((kw) => `<span class="sp-kw-chip ${res.hits.includes(kw) ? 'hit' : ''}">${res.hits.includes(kw) ? '✓ ' : ''}${esc(kw)}</span>`).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (stage === 3) {
      const drills = story.steerDrills || [];
      const cur = drills[examState.t3Idx] || drills[0];
      const res = cur ? examState.t3Results[cur.id] : null;
      const passedCnt = drills.filter((d) => examState.t3Results[d.id]?.pass).length;
      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 3 · Luyện Bẻ Lái Đề (B1–B3 Mở Bài &amp; B5 Chốt Đề)</div>
            <div class="ws-t1-stage-sub">Giữ nguyên lõi B4 trong đầu — chỉ cần nói <strong>2 câu mở B1–B3 + 1 câu chốt B5</strong> khớp đúng từng đề dưới đây.</div>
          </div>
          <div class="ws-t1-telemetry">
            <span class="sp-pill ${passedCnt === drills.length ? 'ok' : ''}">${passedCnt} / ${drills.length} đề đạt</span>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.checkTaskTest3()">Sang Test 4 · Nói 2 Phút →</button>
          </div>
        </div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${drills.map((d, idx) => `
            <button type="button" class="sp-persp-tab ${idx === examState.t3Idx ? 'active' : ''}" onclick="SpeakingStudio.selectT3Drill(${idx})">
              ${examState.t3Results[d.id]?.pass ? '✓ ' : ''}Đề ${idx + 1}: ${esc(d.tag)}
            </button>
          `).join('')}
        </div>

        ${cur ? `
          <div class="sp-stage-speak-card ${res?.pass ? 'is-pass' : ''}">
            <span class="sp-pill ok" style="width:fit-content;">${esc(cur.tag)}</span>
            <div style="font-size:18px;font-weight:800;color:var(--ink);">${esc(cur.promptEn)}</div>
            <div style="font-size:13.5px;color:var(--ink-2);">${esc(cur.promptVi)}</div>

            <div style="display:flex;justify-content:flex-end;">
              <button type="button" class="btn" style="padding:5px 11px;font-size:12px;" onclick="SpeakingStudio.toggleT3TypeMode()">
                ${examState.t3TypeMode ? 'Chuyển sang Mic AI' : 'Gõ dự phòng'}
              </button>
            </div>

            ${examState.t3TypeMode ? `
              <textarea class="sp-note-ta" id="sp-t3-ta" style="min-height:92px;" placeholder="Gõ 2 câu mở bài (B1–B3) và 1 câu chốt đề (B5) bằng Tiếng Anh...">${esc(res?.text || '')}</textarea>
              <div style="display:flex;justify-content:flex-end;">
                <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitT3Typed()">Chấm câu bẻ lái</button>
              </div>
            ` : `
              <div class="sp-mic-stage ${examState.t3Recording ? 'is-rec' : ''}">
                <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="t3"></span>`).join('')}</div>
                <button type="button" class="sp-mic-btn ${examState.t3Recording ? 'is-recording' : ''}" ${examState.t3Processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleT3Mic()">
                  <span>${examState.t3Processing ? 'Đang chấm giọng...' : (examState.t3Recording ? 'Dừng & Chấm câu bẻ lái' : 'Bấm Mic nói Mở (B1–B3) + Chốt (B5)')}</span>
                </button>
              </div>
            `}

            ${res ? `
              <div class="sp-transcript-box">
                <div style="font-weight:800;color:${res.pass ? 'var(--ok)' : 'var(--danger)'};margin-bottom:4px;">${res.pass ? '✓ Bẻ lái khớp đề!' : 'Cần bám sát góc đề hơn (≥12 từ & ≥2 từ khóa trọng tâm)'}</div>
                <div>${esc(res.text)}</div>
                ${res.audioUrl ? `<audio class="sp-audio-replay" style="margin-top:8px;" controls src="${esc(res.audioUrl)}"></audio>` : ''}
              </div>
              <div class="ws-recall-model-box">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <strong style="font-size:12.5px;color:var(--accent);text-transform:uppercase;">Mẫu Bẻ Lái Chuẩn Band 8.5</strong>
                  <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cur.b13Ref + ' ' + cur.b5Ref).replace(/'/g, "\\'")}', 'en-GB')"><span>UK</span></button>
                </div>
                <div style="font-size:13.8px;"><strong>B1–B3 Mở bài:</strong> ${esc(cur.b13Ref)}</div>
                <div style="font-size:13.8px;"><strong>B5 Chốt đề:</strong> ${esc(cur.b5Ref)}</div>
              </div>
            ` : ''}
          </div>
        ` : ''}
      `;
    } else {
      const m = examState.t4Metrics;
      const fs = story.fullSpeech || { en: [], vi: [] };
      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 4 · Kể Nguyên Bài 2 Phút (Full Run · Story 01)</div>
            <div class="ws-t1-stage-sub">Chỉ nhìn 5 mốc phao ngắn bên dưới và kể trọn vẹn câu chuyện trong <strong>1:30 – 2:00</strong>.</div>
          </div>
          <div class="ws-t1-telemetry">
            ${!examState.t4Finalized
              ? `<button type="button" class="btn" style="padding:6px 11px;font-size:12px;" onclick="SpeakingStudio.toggleT4TypeMode()">${examState.t4TypeMode ? 'Dùng Mic AI' : 'Gõ dự phòng'}</button>`
              : `
                <button type="button" class="btn btn-primary" onclick="SpeakingStudio.launchCueCardFromTask()">Luyện ngay Cue Card thật →</button>
                <button type="button" class="btn" onclick="SpeakingStudio.closeTaskExamModal()">Hoàn tất Task ✓</button>
              `}
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(5, minmax(0, 1fr));gap:8px;">
          ${stages.map((st) => `
            <div style="padding:9px 10px;border-radius:10px;background:var(--surface-item);border:1px solid var(--border);text-align:left;">
              <span class="sp-stage-badge" style="margin-bottom:4px;">B4.${st.stage}</span>
              <div style="font-size:12px;font-weight:700;color:var(--ink);line-height:1.35;">${esc(st.titleVi)}</div>
            </div>
          `).join('')}
        </div>

        ${!examState.t4Finalized ? (
          examState.t4TypeMode ? `
            <textarea class="sp-note-ta" id="sp-t4-ta" style="min-height:170px;" placeholder="Gõ nguyên bài kể Story 01 của bạn bằng Tiếng Anh (mục tiêu 180–280 từ)...">${esc(examState.t4Transcript)}</textarea>
            <div style="display:flex;justify-content:flex-end;">
              <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitT4Typed()">Nộp bài &amp; Chấm chỉ số →</button>
            </div>
          ` : `
            <div class="sp-mic-stage ${examState.t4Recording ? 'is-rec' : ''}">
              <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="t4"></span>`).join('')}</div>
              <button type="button" class="sp-mic-btn ${examState.t4Recording ? 'is-recording' : ''}" ${examState.t4Processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleT4Mic()">
                <span>${examState.t4Processing ? 'Đang phân tích bài nói 2 phút...' : (examState.t4Recording ? 'Dừng & Nộp bài nói 2 phút' : 'Bắt đầu kể 2 phút (Mic AI)')}</span>
              </button>
              <div style="font-size:12.5px;color:var(--ink-2);">Kể liền mạch theo 5 mốc phao phía trên — kết thúc bấm dừng để xem WPM, Chunks &amp; nghe lại giọng.</div>
            </div>
          `
        ) : `
          <div class="sp-metrics-grid">
            <div class="sp-metric-box">
              <div class="sp-metric-val">${fmtMmSs(m.durationSec)}</div>
              <div class="sp-metric-lbl">Thời lượng (Chuẩn 1:30–2:00)</div>
            </div>
            <div class="sp-metric-box">
              <div class="sp-metric-val">${m.wpm}</div>
              <div class="sp-metric-lbl">Tốc độ nói (WPM)</div>
            </div>
            <div class="sp-metric-box">
              <div class="sp-metric-val">${m.usedChunks.length}</div>
              <div class="sp-metric-lbl">Spoken Chunks đã dùng</div>
            </div>
            <div class="sp-metric-box">
              <div class="sp-metric-val">${m.fillerCount}</div>
              <div class="sp-metric-lbl">Từ đệm (um/uh/like)</div>
            </div>
          </div>

          ${examState.t4AudioUrl ? `<audio class="sp-audio-replay" style="max-width:100%;" controls src="${esc(examState.t4AudioUrl)}"></audio>` : ''}
          <div class="sp-transcript-box">
            <strong>Bản kể của bạn (${m.words} từ · ${m.stageHits}/5 chặng):</strong><br>${esc(examState.t4Transcript)}
            ${m.usedChunks.length ? `<div class="sp-kw-row" style="margin-top:8px;">${m.usedChunks.map((c) => `<span class="sp-kw-chip hit">✓ ${esc(c)}</span>`).join('')}</div>` : ''}
          </div>

          <div class="ws-recall-model-box">
            <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
              <strong style="font-size:13px;color:var(--accent);text-transform:uppercase;">Bài Nói Mẫu Nguyên Bài · Story 01 (${esc(fs.wordTarget || '~300 từ')})</strong>
              <button type="button" class="btn" style="padding:5px 11px;font-size:12px;" onclick="SpeakingStudio.speakRaw('${esc(fs.en.join(' ')).replace(/'/g, "\\'")}', 'en-GB')">Nghe toàn bài (UK)</button>
            </div>
            ${fs.en.map((para, i) => `
              <div style="padding:8px 0;border-top:${i > 0 ? '1px solid var(--border)' : 'none'};">
                <div style="font-size:14px;line-height:1.65;color:var(--ink);">${esc(para)}</div>
                ${fs.vi[i] ? `<div style="font-size:12.8px;line-height:1.55;color:var(--ink-2);margin-top:3px;">${esc(fs.vi[i])}</div>` : ''}
              </div>
            `).join('')}
          </div>
        `}
      `;
    }

    card.innerHTML = `
      <div class="sp-modal-head" style="padding-bottom:10px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button type="button" class="btn" style="padding:6px 11px;" onclick="SpeakingStudio.closeTaskExamModal()">←</button>
          <div class="sp-modal-title">STORY 01 · Task 4 Bước</div>
        </div>
        <div class="ws-step-pills">
          <span class="ws-step-pill ${stage === 1 ? 'active' : 'done'}">1. Viết B4</span>
          <span class="ws-step-pill ${stage === 2 ? 'active' : (stage > 2 ? 'done' : '')}">2. Nói B4</span>
          <span class="ws-step-pill ${stage === 3 ? 'active' : (stage > 3 ? 'done' : '')}">3. Bẻ Lái</span>
          <span class="ws-step-pill ${stage === 4 ? 'active' : ''}">4. Nói 2 Phút</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          ${teacherJump}
          <span class="sp-pill tabular ${examState.secsLeft <= 45 ? 'urgent' : ''}" id="sp-exam-timer">${fmtMmSs(examState.secsLeft)}</span>
        </div>
      </div>
      ${bodyHtml}
    `;
    if (stage === 1) bindSpT1InlineFlow();
    card.scrollTop = 0;
  }

  /* ================= TAB 4: PRACTICE HUB & PART 2 EXAMINER ROOM ================= */
  function setPracticeCat(cat) {
    state.pracCat = cat;
    renderPracticeHub();
  }
  function setPracticeQuery(q) {
    state.pracQuery = q;
    renderPracticeHub();
  }

  function renderPracticeHub() {
    ensureOverlays();
    const root = document.getElementById('sp-app-root');
    const story = getStory();
    if (!root || !story) return;

    const allCues = story.cueCards || [];
    const hist = getPracHistory();
    const lastByCue = {};
    hist.forEach((h) => { if (!lastByCue[h.cueId]) lastByCue[h.cueId] = h; });

    const q = state.pracQuery.trim().toLowerCase();
    const filtered = allCues.filter((c) => {
      if (state.pracCat !== 'all' && c.category !== state.pracCat) return false;
      if (q && !c.title.toLowerCase().includes(q)) return false;
      return true;
    });

    const catLabel = { person: 'Person · Bẻ lái', cross_topic: 'Cross-Topic', cross_category: 'Cross-Category' };
    const catPillCls = { person: 'is-cause', cross_topic: 'is-adv', cross_category: 'is-twopart' };

    root.innerHTML = `
      <div class="sp-prac-shell">
        <div class="sp-prac-header">
          <div>
            <h2 class="tot-shell-title" style="margin:0;">Kho Đề IELTS Speaking Part 2 · Story 01</h2>
            <p class="tot-shell-sub" style="margin:4px 0 0;">Dùng duy nhất cốt truyện <strong>Ông Ngoại &amp; Bạn Nam (B4)</strong> để xử lý trọn bộ ${allCues.length} Cue Card thi thật.</p>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span class="sp-pill ok">${Object.keys(lastByCue).length} / ${allCues.length} đề đã luyện</span>
            <button type="button" class="btn" onclick="SpeakingStudio.openPictureBook(0)">Sách Tranh Story 01</button>
          </div>
        </div>

        <div class="sp-prac-filters">
          <div class="sp-filter-pills">
            <button type="button" class="sp-filter-pill ${state.pracCat === 'all' ? 'active' : ''}" onclick="SpeakingStudio.setPracticeCat('all')">Tất cả (${allCues.length})</button>
            <button type="button" class="sp-filter-pill ${state.pracCat === 'person' ? 'active' : ''}" onclick="SpeakingStudio.setPracticeCat('person')">Person (${allCues.filter((c) => c.category === 'person').length})</button>
            <button type="button" class="sp-filter-pill ${state.pracCat === 'cross_topic' ? 'active' : ''}" onclick="SpeakingStudio.setPracticeCat('cross_topic')">Cross-Topic (${allCues.filter((c) => c.category === 'cross_topic').length})</button>
            <button type="button" class="sp-filter-pill ${state.pracCat === 'cross_category' ? 'active' : ''}" onclick="SpeakingStudio.setPracticeCat('cross_category')">Cross-Category (${allCues.filter((c) => c.category === 'cross_category').length})</button>
          </div>
          <input type="search" class="sp-note-ta" style="min-height:36px;height:36px;width:260px;padding:6px 12px;resize:none;"
            placeholder="Tìm đề Cue Card..." value="${esc(state.pracQuery)}"
            oninput="SpeakingStudio.setPracticeQuery(this.value)">
        </div>

        <div class="sp-cue-grid">
          ${filtered.map((cue) => {
            const prev = lastByCue[cue.id];
            return `
              <article class="sp-cue-card ${prev ? 'is-done' : ''}">
                <div style="display:flex;flex-direction:column;gap:9px;">
                  <div class="ws-prac-head">
                    <span class="ws-type-pill ${catPillCls[cue.category] || ''}">${catLabel[cue.category] || cue.category}</span>
                    <span class="ws-prac-sub-tag">${esc(cue.source || 'Actual Test')}</span>
                  </div>
                  <h3 class="sp-cue-title">${esc(cue.title)}</h3>
                  <ul class="sp-cue-bullets">
                    ${(cue.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}
                  </ul>
                </div>

                <div class="ws-prac-foot">
                  <div class="ws-prac-meta-row">
                    <span>${prev ? `✓ Lần gần nhất: ${fmtMmSs(prev.durationSec)} · ${prev.wpm} WPM` : '1 phút chuẩn bị + 2 phút nói'}</span>
                  </div>
                  <div class="ws-prac-btns">
                    <button type="button" class="btn btn-primary" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.openPracticeRoom('${esc(cue.id)}', 'practice')">Luyện tập</button>
                    <button type="button" class="btn" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.openPracticeRoom('${esc(cue.id)}', 'exam')">Thi thật</button>
                  </div>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /* --- Speaking Part 2 Room (1-Min Prep -> 2-Min Speaking -> Review & Pivot Model) --- */
  function openPracticeRoom(cueId, mode) {
    ensureOverlays();
    STT()?.abort?.();
    const story = getStory();
    const cue = (story?.cueCards || []).find((c) => c.id === cueId);
    if (!cue) return;

    roomState = {
      cue,
      mode: mode === 'exam' ? 'exam' : 'practice',
      phase: 'prep', // 'prep' (60s) -> 'speak' (120s) -> 'review'
      secsLeft: 60,
      timerId: null,
      notes: { b13: '', b4: '', b5: '', blank: '' },
      recording: false,
      processing: false,
      typeMode: false,
      recStartedAt: 0,
      transcript: '',
      audioUrl: '',
      metrics: null,
      showFullB4: false
    };

    const el = document.getElementById('sp-practice-room');
    el.className = `sp-exam-room open ${roomState.mode === 'exam' ? 'is-real-exam' : ''}`;
    startRoomTimer();
    renderPracticeRoom();
  }

  function closePracticeRoom() {
    clearInterval(roomState?.timerId);
    STT()?.abort?.();
    roomState = null;
    const el = document.getElementById('sp-practice-room');
    if (el) el.className = 'sp-exam-room';
    renderPracticeHub();
  }

  function startRoomTimer() {
    clearInterval(roomState?.timerId);
    roomState.timerId = setInterval(() => {
      if (!roomState || roomState.phase === 'review') return;
      roomState.secsLeft--;
      const el = document.getElementById('sp-room-timer');
      if (el) {
        el.textContent = fmtMmSs(roomState.secsLeft);
        el.classList.toggle('urgent', roomState.secsLeft <= 15);
      }
      if (roomState.secsLeft <= 0) {
        if (roomState.phase === 'prep') {
          beginRoomSpeaking(roomState.mode === 'exam');
        } else if (roomState.phase === 'speak') {
          clearInterval(roomState.timerId);
          if (roomState.recording) toggleRoomMic();
          else toast('Hết 2 phút nói — hãy bấm Nộp bài để xem đối chiếu!');
        }
      }
    }, 1000);
  }

  function saveRoomNote(key, val) {
    if (roomState) roomState.notes[key] = val;
  }

  function beginRoomSpeaking(autoStartMic) {
    if (!roomState) return;
    roomState.phase = 'speak';
    roomState.secsLeft = 120;
    startRoomTimer();
    renderPracticeRoom();
    if (autoStartMic && STT()?.isSupported?.()) {
      toggleRoomMic();
    }
  }

  function toggleRoomTypeMode() {
    if (!roomState || roomState.mode === 'exam') return;
    roomState.typeMode = !roomState.typeMode;
    renderPracticeRoom();
  }

  function toggleRoomMic() {
    if (!roomState) return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      toast('Thiết bị chưa có Micro — bật ô nhập văn bản dự phòng.');
      roomState.typeMode = true;
      renderPracticeRoom();
      return;
    }
    if (roomState.recording) {
      stt.stop();
      roomState.recording = false;
      roomState.processing = true;
      renderPracticeRoom();
      return;
    }
    stt.abort();
    roomState.recording = true;
    roomState.processing = false;
    roomState.recStartedAt = Date.now();
    renderPracticeRoom();
    stt.startRecording({
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 125000,
      onLevel: ({ bars }) => updateWaveBars('room', bars),
      onProcessing: () => { if (roomState) { roomState.recording = false; roomState.processing = true; renderPracticeRoom(); } },
      onResult: (res) => {
        if (!roomState) return;
        roomState.recording = false;
        roomState.processing = false;
        const dur = res.durationSec || Math.max(10, Math.round((Date.now() - roomState.recStartedAt) / 1000));
        if (res.silent || !res.text) {
          toast('Chưa thu được giọng nói rõ — bạn có thể bấm Mic thử lại!');
          renderPracticeRoom();
          return;
        }
        finalizeRoomAttempt(res.text, dur, res.audioUrl || '');
      },
      onError: (msg) => {
        if (!roomState) return;
        roomState.recording = false;
        roomState.processing = false;
        toast(String(msg || 'Lỗi Micro.'));
        renderPracticeRoom();
      }
    });
  }

  function submitRoomTyped() {
    if (!roomState) return;
    const val = (document.getElementById('sp-room-ta')?.value || '').trim();
    if (countWords(val) < 20) { toast('Hãy nhập bài nói tối thiểu 20 từ!'); return; }
    const dur = Math.min(120, Math.max(30, Math.round(countWords(val) / 2.2)));
    finalizeRoomAttempt(val, dur, '');
  }

  function finalizeRoomAttempt(text, durationSec, audioUrl) {
    if (!roomState) return;
    clearInterval(roomState.timerId);
    roomState.transcript = text;
    roomState.audioUrl = audioUrl;
    roomState.metrics = evaluateFullSpeech(text, durationSec);
    roomState.phase = 'review';

    const hist = getPracHistory();
    hist.unshift({
      cueId: roomState.cue.id,
      cueTitle: roomState.cue.title,
      mode: roomState.mode,
      durationSec: roomState.metrics.durationSec,
      wpm: roomState.metrics.wpm,
      words: roomState.metrics.words,
      chunksCount: roomState.metrics.usedChunks.length,
      fillerCount: roomState.metrics.fillerCount,
      at: Date.now()
    });
    savePracHistory(hist.slice(0, 40));
    renderPracticeRoom();
  }

  function toggleRoomFullB4() {
    if (!roomState) return;
    roomState.showFullB4 = !roomState.showFullB4;
    renderPracticeRoom();
  }

  function renderPracticeRoom() {
    if (!roomState) return;
    const { cue, mode, phase, secsLeft, notes, recording, processing, typeMode, transcript, audioUrl, metrics } = roomState;
    const isExam = mode === 'exam';
    const root = document.getElementById('sp-practice-room');
    const story = getStory();

    const phaseLbl = phase === 'prep'
      ? 'Giai đoạn 1 · Chuẩn bị 1 phút'
      : (phase === 'speak' ? 'Giai đoạn 2 · Nói liên tục 2 phút' : 'Hoàn tất · Đối chiếu B1–B3 & B5');

    let rightHtml = '';
    if (phase === 'prep') {
      rightHtml = `
        <div class="sp-room-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div>
              <div style="font-size:16px;font-weight:800;">${isExam ? 'Giấy Nháp Thi Thật (1 Phút)' : 'Khung Planning (1 Phút)'}</div>
              <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px;">Ghi nhanh từ khóa dàn ý trước khi bắt đầu nói 2 phút.</div>
            </div>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.beginRoomSpeaking(false)">Bắt đầu nói ngay →</button>
          </div>

          ${isExam ? `
            <textarea class="sp-note-ta" placeholder="Ghi chú từ khóa của bạn tại đây..."
              oninput="SpeakingStudio.saveRoomNote('blank', this.value)">${esc(notes.blank)}</textarea>
          ` : `
            <div style="display:flex;flex-direction:column;gap:10px;">
              <div>
                <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:4px;">1. Mở bài (B1–B3)</div>
                <textarea class="sp-note-ta" placeholder="Ghi ngắn gọn ý mở bài..." oninput="SpeakingStudio.saveRoomNote('b13', this.value)">${esc(notes.b13)}</textarea>
              </div>
              <div>
                <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:4px;">2. Cốt truyện chính (B4)</div>
                <textarea class="sp-note-ta" placeholder="Ghi các từ khóa chính..." oninput="SpeakingStudio.saveRoomNote('b4', this.value)">${esc(notes.b4)}</textarea>
              </div>
              <div>
                <div style="font-size:12px;font-weight:800;color:var(--accent);margin-bottom:4px;">3. Kết bài (B5)</div>
                <textarea class="sp-note-ta" placeholder="Ghi ý chốt bài..." oninput="SpeakingStudio.saveRoomNote('b5', this.value)">${esc(notes.b5)}</textarea>
              </div>
            </div>
          `}
        </div>
      `;
    } else if (phase === 'speak') {
      const noteSummary = isExam
        ? notes.blank
        : [notes.b13 && `B1–B3: ${notes.b13}`, notes.b4 && `B4: ${notes.b4}`, notes.b5 && `B5: ${notes.b5}`].filter(Boolean).join('\n');
      rightHtml = `
        <div class="sp-room-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div style="font-size:16px;font-weight:800;">Phòng Thu Âm Part 2 (02:00)</div>
            ${!isExam ? `<button type="button" class="btn" style="padding:5px 11px;font-size:12px;" onclick="SpeakingStudio.toggleRoomTypeMode()">${typeMode ? 'Dùng Mic AI' : 'Gõ dự phòng'}</button>` : ''}
          </div>

          ${noteSummary ? `
            <div style="padding:11px 14px;border-radius:11px;background:var(--surface-item);border:1px dashed var(--border-strong);font-size:13px;line-height:1.55;white-space:pre-line;">
              <strong>Ghi chú 1 phút của bạn:</strong>\n${esc(noteSummary)}
            </div>
          ` : ''}

          ${typeMode ? `
            <textarea class="sp-note-ta" id="sp-room-ta" style="min-height:180px;" placeholder="Gõ bài nói Part 2 của bạn tại đây..."></textarea>
            <div style="display:flex;justify-content:flex-end;">
              <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitRoomTyped()">Nộp bài &amp; Mở đối chiếu →</button>
            </div>
          ` : `
            <div class="sp-mic-stage ${recording ? 'is-rec' : ''}">
              <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="room"></span>`).join('')}</div>
              <button type="button" class="sp-mic-btn ${recording ? 'is-recording' : ''}" ${processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleRoomMic()">
                <span>${processing ? 'Đang chấm giọng nói...' : (recording ? 'Dừng & Nộp bài nói' : 'Bấm Mic bắt đầu nói 2 phút')}</span>
              </button>
              <div style="font-size:12.5px;color:var(--ink-2);">Hãy nói tự nhiên, rõ ràng trong khoảng 1:30 – 2:00.</div>
            </div>
          `}
        </div>
      `;
    } else {
      const m = metrics;
      const fs = story?.fullSpeech || { en: [] };
      rightHtml = `
        <div class="sp-room-panel">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
            <div style="font-size:16.5px;font-weight:800;color:var(--ok);">✓ Đã Hoàn Thành Bài Nói Part 2</div>
            <div style="display:flex;gap:8px;">
              <button type="button" class="btn" onclick="SpeakingStudio.openPracticeRoom('${esc(cue.id)}', '${esc(mode)}')">Nói lại đề này</button>
              <button type="button" class="btn btn-primary" onclick="SpeakingStudio.closePracticeRoom()">Về kho Cue Card</button>
            </div>
          </div>

          <div class="sp-metrics-grid">
            <div class="sp-metric-box"><div class="sp-metric-val">${fmtMmSs(m.durationSec)}</div><div class="sp-metric-lbl">Thời lượng</div></div>
            <div class="sp-metric-box"><div class="sp-metric-val">${m.wpm}</div><div class="sp-metric-lbl">Tốc độ (WPM)</div></div>
            <div class="sp-metric-box"><div class="sp-metric-val">${m.usedChunks.length}</div><div class="sp-metric-lbl">Spoken Chunks</div></div>
            <div class="sp-metric-box"><div class="sp-metric-val">${m.fillerCount}</div><div class="sp-metric-lbl">Từ đệm thừa</div></div>
          </div>

          ${audioUrl ? `<audio class="sp-audio-replay" style="max-width:100%;" controls src="${esc(audioUrl)}"></audio>` : ''}
          <div class="sp-transcript-box">
            <strong>Bản nói của bạn (${m.words} từ):</strong><br>${esc(transcript)}
            ${m.usedChunks.length ? `<div class="sp-kw-row" style="margin-top:8px;">${m.usedChunks.map((c) => `<span class="sp-kw-chip hit">✓ ${esc(c)}</span>`).join('')}</div>` : ''}
          </div>

          <div class="ws-recall-model-box">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
              <strong style="font-size:12.5px;color:var(--accent);text-transform:uppercase;">Mẫu Bẻ Lái Chuẩn Cho Đề Này (B1–B3 &amp; B5)</strong>
              <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cue.b13En + ' ' + cue.b5En).replace(/'/g, "\\'")}', 'en-GB')"><span>UK</span></button>
            </div>
            <div style="font-size:14px;line-height:1.6;"><strong>B1–B3 Mở bài:</strong> ${esc(cue.b13En)}</div>
            <div style="font-size:14px;line-height:1.6;"><strong>B5 Chốt đề:</strong> ${esc(cue.b5En)}</div>
            <div>
              <button type="button" class="btn-reading-tip" onclick="SpeakingStudio.toggleRoomFullB4()">
                ${roomState.showFullB4 ? 'Ẩn lõi B4 nguyên văn' : 'Xem lại lõi B4 bất biến (~220 từ)'}
              </button>
            </div>
            ${roomState.showFullB4 ? `<div style="font-size:13.5px;line-height:1.65;color:var(--ink-2);padding-top:6px;border-top:1px solid var(--border);">${esc((fs.en || []).slice(1).join(' '))}</div>` : ''}
          </div>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="sp-room-bar">
        <div style="display:flex;align-items:center;gap:10px;">
          <button type="button" class="btn" style="padding:6px 12px;" onclick="SpeakingStudio.closePracticeRoom()">← Thoát</button>
          <span class="sp-pill ${isExam ? 'urgent' : 'ok'}">${isExam ? 'THI THẬT · EXAMINER ROOM' : 'LUYỆN TẬP · PART 2'}</span>
          <span style="font-size:13.5px;font-weight:750;">${phaseLbl}</span>
        </div>
        <span class="sp-pill tabular ${secsLeft <= 15 && phase !== 'review' ? 'urgent' : ''}" id="sp-room-timer" style="font-size:14px;padding:5px 14px;">${phase === 'review' ? 'Đã nộp' : fmtMmSs(secsLeft)}</span>
      </div>

      <div class="sp-room-body">
        <div class="sp-cue-paper">
          <div style="font-size:11.5px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent);">IELTS Speaking · Part 2 Cue Card</div>
          <div class="sp-cue-paper-title">${esc(cue.title)}</div>
          <div style="font-size:14px;font-weight:700;opacity:0.8;">You should say:</div>
          <ul class="sp-cue-paper-list">
            ${(cue.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}
          </ul>
          <div style="font-size:12.5px;color:var(--ink-3);padding-top:10px;border-top:1px dashed var(--border-strong);">
            You will have to talk about the topic for <strong>1 to 2 minutes</strong>. You have <strong>1 minute</strong> to think about what you are going to say.
          </div>
        </div>

        ${rightHtml}
      </div>
    `;
  }

  /* ================= SUMMARY MODAL (BẢNG THỐNG KÊ) ================= */
  function openSummaryModal() {
    ensureOverlays();
    const story = getStory();
    const mStats = getStoryMasteryStats(story);
    const done = getTaskDoneMap()[story?.id];
    const hist = getPracHistory();
    const el = document.getElementById('sp-summary-card');
    el.innerHTML = `
      <div class="sp-modal-head">
        <div class="sp-modal-title">Bảng Thống Kê · IELTS Speaking (Story 01)</div>
        <button type="button" class="btn" style="padding:5px 11px;" onclick="SpeakingStudio.closeSummaryModal()">Đóng ✕</button>
      </div>
      <div class="sp-metrics-grid">
        <div class="sp-metric-box"><div class="sp-metric-val">${mStats.done}/${mStats.total}</div><div class="sp-metric-lbl">Thẻ đã thuộc</div></div>
        <div class="sp-metric-box"><div class="sp-metric-val">${done?.completed ? '4/4' : `${done?.maxStage || 0}/4`}</div><div class="sp-metric-lbl">Task 4 Bước</div></div>
        <div class="sp-metric-box"><div class="sp-metric-val">${new Set(hist.map((h) => h.cueId)).size}/14</div><div class="sp-metric-lbl">Cue Card đã luyện</div></div>
        <div class="sp-metric-box"><div class="sp-metric-val">${hist.length}</div><div class="sp-metric-lbl">Tổng lượt nói</div></div>
      </div>
    `;
    document.getElementById('sp-summary-modal').classList.add('open');
  }
  function closeSummaryModal() {
    document.getElementById('sp-summary-modal')?.classList.remove('open');
  }

  /* ================= EXPORT ================= */
  window.SpeakingStudio = {
    renderSpeakingHomePanel,
    renderFlashcardWorkspace,
    renderTaskHub,
    renderPracticeHub,
    openSummaryModal,
    closeSummaryModal,
    // Flashcard controls
    flipCard,
    stepCard,
    jumpCard,
    speakCurrent,
    speakStageEn,
    speakRaw,
    toggleUnmastered,
    toggleFlowMask,
    revealFlowNode,
    selectPerspective,
    toggleStageEn,
    assessCard,
    // Recall modal
    toggleRecallMode,
    toggleRecallMic,
    submitRecallTyped,
    teacherPassRecall,
    finishRecallAndNext,
    closeRecall,
    // Picture book
    openPictureBook,
    closePictureBook,
    stepPictureBook,
    jumpPictureBook,
    togglePbVi,
    // Task 4-step
    startTaskExam,
    closeTaskExamModal,
    teacherJumpExam,
    checkTaskTest1,
    toggleT2TypeMode,
    toggleT2Mic,
    submitT2Typed,
    checkTaskTest2,
    selectT3Drill,
    toggleT3TypeMode,
    toggleT3Mic,
    submitT3Typed,
    checkTaskTest3,
    toggleT4TypeMode,
    toggleT4Mic,
    submitT4Typed,
    launchCueCardFromTask,
    // Practice hub & room
    setPracticeCat,
    setPracticeQuery,
    openPracticeRoom,
    closePracticeRoom,
    saveRoomNote,
    beginRoomSpeaking,
    toggleRoomTypeMode,
    toggleRoomMic,
    submitRoomTyped,
    toggleRoomFullB4
  };
})();
