/* ==========================================================================
   TOTORO IELTS MASTER — SPEAKING STUDIO ENGINE (STORY 01 · FULL B1 → B5 FLOW)
   4-Tab Native Studio: Tổng quan · Flashcard (B1→B5) · Task (4 Bước) · Practice (14 Cue Cards)
   Integrates window.TotoroSpeechSTT (Whisper Large v3) + window.AppCore.audio (Youdao US/UK)
   ========================================================================== */
(function () {
  'use strict';

  const DATA = () => window.SPEAKING_STUDIO_DATA || { STORIES: [] };
  const P13 = () => window.SPEAKING_PART13_DATA || { PART1_TOPICS: [], PART2_CAMBRIDGE_TOPICS: [], PART3_TOPICS: [], FULL_TESTS: [] };
  const B = () => window.__VOCAB_BRIDGE__ || null;
  const STT = () => window.TotoroSpeechSTT || null;

  function getPart1Topics() { return P13().PART1_TOPICS || []; }
  function getPart2CambridgeTopics() { return P13().PART2_CAMBRIDGE_TOPICS || []; }
  function getPart3Topics() { return P13().PART3_TOPICS || []; }
  function getFullSpeakingTests() { return P13().FULL_TESTS || []; }
  function getFullSpeakingTest(id) {
    if (!id) return null;
    return getFullSpeakingTests().find((t) => t.id === id) || null;
  }
  function getPart2CueById(id) {
    if (!id) return null;
    const cam = getPart2CambridgeTopics().find((c) => c.id === id);
    if (cam) return cam;
    const hasStory = Boolean(!window.AccessPolicy || window.AccessPolicy.can('speaking.story_mindmap'));
    if (hasStory) {
      return (getStory()?.cueCards || []).find((c) => c.id === id) || null;
    }
    return null;
  }
  function getPart13Topic(id) {
    if (!id) return null;
    return getPart1Topics().find((t) => t.id === id) || getPart3Topics().find((t) => t.id === id) || null;
  }
  function getTopicTargetLabel(tp) {
    if (!tp) return '';
    if (tp.targetTime) return tp.targetTime;
    const lo = tp.targetSecMin || (tp.part === 1 ? 20 : 40);
    const hi = tp.targetSecMax || (tp.part === 1 ? 35 : 65);
    return `${lo}–${hi}s/câu`;
  }

  const MASTERY_KEY_BASE = 'totoro_speaking_mastery_v1_';
  const TASK_DONE_KEY_BASE = 'totoro_speaking_task_done_v1_';
  const PRAC_HIST_KEY_BASE = 'totoro_speaking_prac_hist_v1_';
  const PRO_MODE_KEY = 'totoro_sp_pro3d_mode_v1';
  const EXAMINER_KEY = 'totoro_sp_examiner_v1';
  const COOLDOWN_SEC = 18;

  const PRO_EXAMINERS = {
    claire: {
      id: 'claire',
      name: 'Ms. Claire',
      role: 'British Examiner',
      speakImg: 'assets/images/examiner_claire_speak.webp',
      listenImg: 'assets/images/examiner_claire_listen.webp'
    },
    oliver: {
      id: 'oliver',
      name: 'Mr. Oliver',
      role: 'British Examiner',
      speakImg: 'assets/images/examiner_oliver_speak.webp',
      listenImg: 'assets/images/examiner_oliver_listen.webp'
    }
  };

  function getRoomViewMode() {
    try {
      const saved = localStorage.getItem(PRO_MODE_KEY);
      return saved === 'standard' ? 'standard' : 'pro3d';
    } catch (_) {
      return 'pro3d';
    }
  }
  function getProExaminerId() {
    try {
      const saved = localStorage.getItem(EXAMINER_KEY);
      return PRO_EXAMINERS[saved] ? saved : 'claire';
    } catch (_) {
      return 'claire';
    }
  }
  function getProExaminer() {
    return PRO_EXAMINERS[getProExaminerId()] || PRO_EXAMINERS.claire;
  }

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
  function savePracHistory(list) {
    const trimmed = (list || []).slice(0, 80).map((item, idx) => {
      if (idx < 30) return item;
      const copy = { ...item };
      delete copy.report;
      return copy;
    });
    saveJson(PRAC_HIST_KEY_BASE + getUid(), trimmed);
  }

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
  let cachedLexStoryId = null;
  function getLexicon() {
    const st = getStory();
    const sid = st?.id || '';
    if (cachedLex && cachedLexStoryId === sid) return cachedLex;
    const set = new Set();
    const add = (str) => {
      const m = String(str || '').match(/[A-Za-z'-]{3,}/g);
      if (m) m.forEach((w) => set.add(w.toLowerCase()));
    };
    if (st) {
      (st.storyMindmap || []).forEach((n) => { add(n.textEn); (n.keywords || []).forEach(add); });
      (st.storySections || []).forEach((s) => add(s.textEn));
      (st.spokenChunks || []).forEach((c) => { add(c.en); add(c.example); add(c.enRef); });
      (st.steerMindmaps || []).forEach((m) => (m.nodes || []).forEach((n) => { add(n.refEn); (n.keywords || []).forEach(add); }));
      (st.fullSpeech?.en || []).forEach(add);
      (st.pictureBook || []).forEach((p) => { add(p.en); (p.collocations || []).forEach(add); });
      (st.cueCards || []).forEach((c) => { add(c.title); add(c.b13En); add(c.b5En); });
    }
    if (window.IPA_DICT) Object.keys(window.IPA_DICT).forEach((k) => set.add(k.toLowerCase()));
    if (Array.isArray(window.RAW_VOCAB_DATA)) window.RAW_VOCAB_DATA.forEach((it) => { add(it.word); add(it.example); });
    add('grandfather grandmother retired maths math teacher seventies silver hair warm smile admire respect role model patience empathy nature gently voice parents worked morning till night afternoon dinner homework neighbour neighbor next door close friends grade mother fell ill hospital month missed school look after housework behind low marks insecure lost motivation dropping out found out called over listened calmly worries invited weekend broke hard problems simple steps explained clearly review notebook finished exercise quickly struggling basic calculation frustrated snapped hurry gently hand shoulder whispered take time stuck afraid making mistakes rushing panic confused heard felt guilty apologised apologized right away worked through guidance year caught regained confidence better kids brought notebooks help looking back hope follow example staying calm listening carefully skill experience teamwork collaborate secondary vividly owning judging');
    cachedLex = set;
    cachedLexStoryId = sid;
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

  function evaluateFullSpeech(text, durationSec, customChunks) {
    const story = getStory();
    const norm = normText(text);
    const words = countWords(text);
    const dur = Math.max(1, Math.round(Number(durationSec) || Math.max(15, words / 2.2)));
    const wpm = Math.round((words / dur) * 60);
    const chunkSource = Array.isArray(customChunks) && customChunks.length
      ? customChunks.map((en) => ({ en }))
      : (story?.spokenChunks || []);
    const usedChunks = chunkSource.filter((c) => {
      const cn = normText(c.en);
      const toks = cn.split(' ').filter((w) => w.length >= 3);
      return cn.length >= 3 && (norm.includes(cn) || (toks.length >= 2 && toks.filter((t) => norm.includes(t)).length >= Math.ceil(toks.length * 0.75)));
    }).map((c) => c.en);
    const fillerMatches = (String(text || '').match(/\b(um+|uh+|er+|hmm+|like|you know|actually|basically)\b/gi) || []);
    const stationHits = Array.isArray(customChunks) && customChunks.length
      ? 0
      : (story?.speakStations || []).filter((st) => evaluateKeywords(text, st.keywords).hits.length >= 2).length;
    return {
      words,
      durationSec: dur,
      wpm,
      usedChunks,
      fillerCount: fillerMatches.length,
      stageHits: stationHits
    };
  }

  /* ================= DECK BUILDER (SMOOTH FULL STORY B1 → B2 → B3 → B4 → B5) ================= */
  function buildStoryCards(story) {
    if (!story) return [];
    const cards = [];
    // Card 0: Compact Story 01 Overview Map (B1 -> B5)
    cards.push({
      id: `${story.id}_overview`,
      kind: 'story_flow',
      group: 'MAP',
      sectionCode: 'B1 → B5',
      untested: true,
      pos: 'BẢN ĐỒ STORY 01 · B1 → B5',
      en: story.shortTitle || story.title,
      vi: story.subtitle,
      story
    });

    const sections = story.storySections || [];
    const chunks = story.spokenChunks || [];
    const posMap = { 'n phr': 'CỤM DANH TỪ', 'v phr': 'CỤM ĐỘNG TỪ', 'adj phr': 'CỤM TÍNH TỪ', phr: 'CỤM NÓI' };

    sections.forEach((sec) => {
      const secChunks = chunks.filter((c) => c.section === sec.id);
      cards.push({
        id: `${story.id}_sec_${sec.id.replace(/[^a-zA-Z0-9]/g, '_')}`,
        kind: 'section_flow',
        group: sec.group,
        sectionId: sec.id,
        sectionCode: sec.code,
        untested: true,
        pos: `MẠCH TRUYỆN · ${sec.code}`,
        en: sec.titleVi,
        vi: sec.textVi,
        textEn: sec.textEn,
        sceneImg: sec.sceneImg,
        nextLabel: sec.nextLabel || `Học ${secChunks.length} cụm ${sec.code} →`
      });

      secChunks.forEach((c, idx) => {
        cards.push({
          id: `${story.id}_c_${sec.id.replace(/[^a-zA-Z0-9]/g, '_')}_${idx + 1}`,
          kind: 'chunk',
          group: sec.group,
          sectionId: sec.id,
          sectionCode: sec.code,
          pos: posMap[c.pos] || 'CỤM NÓI',
          en: c.en,
          vi: c.vi,
          example: c.example || '',
          viPrompt: c.viPrompt || '',
          enRef: c.enRef || ''
        });
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
    sectionEnRevealed: {},
    pracPart: 1,
    pracCat: 'all',
    pracQuery: '',
    cooldownMap: {},
    cooldownTicker: null
  };

  let recallState = null;
  let pbState = null;
  let mmState = null;
  let examState = null;
  let roomState = null;
  let fullTestSession = null;
  let overlaysMounted = false;

  function roundIeltsBand(val) {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * 2) / 2;
  }

  function startFullSpeakingTest(fullId, mode) {
    const ft = getFullSpeakingTest(fullId);
    if (!ft) return;
    const cleanMode = mode === 'exam' ? 'exam' : 'practice';
    fullTestSession = {
      test: ft,
      mode: cleanMode,
      stage: 1,
      results: { p1: null, p2: null, p3: null },
      combinedSaved: false,
      combinedOverall: null
    };
    state.pracPart = 'full';
    window.TotoroUI?.recordLastSession?.({
      skill: 'Speaking',
      view: 'practice',
      label: `Speaking Full Test · ${ft.shortSource}`,
      action: "window.SpeakingStudio?.openPracticePart('full')"
    });
    openInterviewRoom(ft.part1Id, cleanMode, { preserveFullTest: true });
  }

  function advanceFullSpeakingTest() {
    if (!fullTestSession) return;
    const { test, mode, stage } = fullTestSession;
    if (stage === 1) {
      fullTestSession.stage = 2;
      openPracticeRoom(test.part2Id, mode, { preserveFullTest: true });
    } else if (stage === 2) {
      fullTestSession.stage = 3;
      openInterviewRoom(test.part3Id, mode, { preserveFullTest: true });
    } else {
      closePracticeRoom();
    }
  }

  function recordFullTestStageResult(stageKey, payload) {
    if (!fullTestSession || !stageKey) return;
    fullTestSession.results[stageKey] = payload || null;
    if (stageKey === 'p3' && !fullTestSession.combinedSaved) {
      const parts = [fullTestSession.results.p1, fullTestSession.results.p2, fullTestSession.results.p3].filter(Boolean);
      const bands = parts.map((p) => Number(p.band)).filter((b) => Number.isFinite(b) && b > 0);
      const avgCrit = (k) => {
        const vals = parts.map((p) => Number(p.criteria?.[k])).filter((v) => Number.isFinite(v) && v > 0);
        return vals.length ? roundIeltsBand(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
      };
      const crit = { fc: avgCrit('fc'), lr: avgCrit('lr'), gra: avgCrit('gra'), pr: avgCrit('pr') };
      const overall = bands.length ? roundIeltsBand(bands.reduce((a, b) => a + b, 0) / bands.length) : null;
      const totalDurationSec = parts.reduce((acc, p) => acc + (Number(p.durationSec) || 0), 0);
      const totalWords = parts.reduce((acc, p) => acc + (Number(p.words) || 0), 0);
      const totalChunks = parts.reduce((acc, p) => acc + (Number(p.chunksCount) || 0), 0);
      const totalFillers = parts.reduce((acc, p) => acc + (Number(p.fillerCount) || 0), 0);
      const avgWpm = totalDurationSec > 0 ? Math.round((totalWords / totalDurationSec) * 60) : 0;

      fullTestSession.combinedOverall = {
        band: overall,
        criteria: crit,
        durationSec: totalDurationSec,
        words: totalWords,
        wpm: avgWpm,
        chunksCount: totalChunks,
        fillerCount: totalFillers
      };
      fullTestSession.combinedSaved = true;

      const hist = getPracHistory();
      hist.unshift({
        part: 'full',
        cueId: fullTestSession.test.id,
        cueTitle: fullTestSession.test.title,
        mode: fullTestSession.mode,
        band: overall,
        criteria: overall ? crit : null,
        durationSec: totalDurationSec,
        wpm: avgWpm,
        words: totalWords,
        chunksCount: totalChunks,
        fillerCount: totalFillers,
        partResults: {
          p1: fullTestSession.results.p1 ? { band: fullTestSession.results.p1.band, words: fullTestSession.results.p1.words, durationSec: fullTestSession.results.p1.durationSec, turns: fullTestSession.results.p1.turns || [], transcript: fullTestSession.results.p1.transcript || '' } : null,
          p2: fullTestSession.results.p2 ? { band: fullTestSession.results.p2.band, words: fullTestSession.results.p2.words, durationSec: fullTestSession.results.p2.durationSec, cueTitle: fullTestSession.results.p2.cueTitle || '', transcript: fullTestSession.results.p2.transcript || '' } : null,
          p3: fullTestSession.results.p3 ? { band: fullTestSession.results.p3.band, words: fullTestSession.results.p3.words, durationSec: fullTestSession.results.p3.durationSec, turns: fullTestSession.results.p3.turns || [], transcript: fullTestSession.results.p3.transcript || '' } : null
        },
        at: Date.now()
      });
      savePracHistory(hist.slice(0, 80));
    }
  }

  function renderFullTestRibbonHtml(currentStage) {
    if (!fullTestSession) return '';
    const { test, results } = fullTestSession;
    const steps = [
      { n: 1, key: 'p1', label: 'Part 1 · Phỏng vấn' },
      { n: 2, key: 'p2', label: 'Part 2 · Cue Card' },
      { n: 3, key: 'p3', label: 'Part 3 · Thảo luận' }
    ];
    return `
      <div class="sp-full-ribbon" aria-label="Tiến độ Full Speaking Test">
        <div class="sp-full-ribbon-title">
          <span class="sp-full-ribbon-badge">Full Test · 14p</span>
          <span>${esc(test.shortSource)}</span>
        </div>
        <div class="sp-full-ribbon-steps">
          ${steps.map((st, idx) => {
            const res = results[st.key];
            const cls = st.n === currentStage ? 'is-active' : (st.n < currentStage || res ? 'is-done' : '');
            const bStr = res?.band ? ` · ${Number(res.band).toFixed(1)}` : (st.n < currentStage || res ? ' ✓' : '');
            return `${idx > 0 ? '<span style="color:var(--ink-3);font-weight:700;">→</span>' : ''}<span class="sp-full-step ${cls}">${st.label}${bStr}</span>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderFullTestCombinedCardHtml() {
    if (!fullTestSession || fullTestSession.stage !== 3) return '';
    const { test, results, combinedOverall } = fullTestSession;
    const c = combinedOverall;
    if (!c) return '';
    const fmtPart = (r) => r ? (r.band ? `Band ${Number(r.band).toFixed(1)}` : `${r.words || 0} từ`) : 'Chưa chấm';
    return `
      <div class="sp-full-combined-card">
        <div class="sp-full-combined-head">
          <div>
            <div style="font-size:11px;font-weight:800;letter-spacing:0.05em;text-transform:uppercase;color:var(--accent);">Tổng kết Full Speaking Test · ${esc(test.shortSource)}</div>
            <div style="font-size:15px;font-weight:800;color:var(--ink);margin-top:2px;">Hoàn tất trọn bộ 3 phần thi IELTS Speaking</div>
          </div>
          ${c.band ? `<div class="sp-full-combined-band tabular"><span>Overall</span><strong>${Number(c.band).toFixed(1)}</strong></div>` : `<span class="ws-pill ok tabular">${fmtMmSs(c.durationSec)} · ${c.words} từ</span>`}
        </div>
        <div class="sp-full-combined-grid">
          <div class="sp-full-combined-part"><span style="color:var(--ink-3);font-weight:700;">Part 1 · Phỏng vấn</span><strong class="tabular">${fmtPart(results.p1)}</strong></div>
          <div class="sp-full-combined-part"><span style="color:var(--ink-3);font-weight:700;">Part 2 · Cue Card</span><strong class="tabular">${fmtPart(results.p2)}</strong></div>
          <div class="sp-full-combined-part"><span style="color:var(--ink-3);font-weight:700;">Part 3 · Thảo luận</span><strong class="tabular">${fmtPart(results.p3)}</strong></div>
        </div>
        ${c.criteria?.fc ? `
          <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:11.8px;color:var(--ink-2);">
            <span class="ws-pill tabular">FC ${Number(c.criteria.fc).toFixed(1)}</span>
            <span class="ws-pill tabular">LR ${Number(c.criteria.lr || c.band).toFixed(1)}</span>
            <span class="ws-pill tabular">GRA ${Number(c.criteria.gra || c.band).toFixed(1)}</span>
            <span class="ws-pill tabular">PR ${Number(c.criteria.pr || c.band).toFixed(1)}</span>
            <span class="ws-pill tabular" style="margin-left:auto;">${fmtMmSs(c.durationSec)} · ${c.words} từ · ${c.wpm} WPM</span>
          </div>
        ` : ''}
      </div>
    `;
  }

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
      <div class="sp-mm-fullscreen" id="sp-mindmap-modal"></div>
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
      if (mmState) {
        if (e.key === 'Escape') closeMindmapModal();
        else if (e.key === '+' || e.key === '=') zoomMindmap(1.15);
        else if (e.key === '-') zoomMindmap(0.85);
        return;
      }
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

  /* ================= TAB 1: SPEAKING HOME & ATTEMPT HISTORY REVIEW ================= */
  function closeHistoryReview() {
    const el = document.getElementById('sp-hist-review-modal');
    if (el) el.remove();
  }

  function openHistoryReview(idx) {
    const hist = getPracHistory();
    const h = hist[Number(idx) || 0];
    if (!h) return;
    closeHistoryReview();
    const dt = h.at ? new Date(h.at).toLocaleString('vi-VN') : '';
    const modeLbl = h.mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const partLbl = h.part === 'full' ? 'Full Test · 14p' : (h.part === 1 ? 'Part 1' : (h.part === 3 ? 'Part 3' : 'Part 2'));
    const critHtml = h.criteria ? `
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;">
        <span class="ws-pill tabular">FC ${Number(h.criteria.fc || 0).toFixed(1)}</span>
        <span class="ws-pill tabular">LR ${Number(h.criteria.lr || 0).toFixed(1)}</span>
        <span class="ws-pill tabular">GRA ${Number(h.criteria.gra || 0).toFixed(1)}</span>
        <span class="ws-pill tabular">PR ${Number(h.criteria.pr || 0).toFixed(1)}</span>
      </div>` : '';

    let bodyHtml = '';
    if (h.part === 'full' && h.partResults) {
      const pr = h.partResults;
      const renderTurns = (turns, fallback) => {
        if (Array.isArray(turns) && turns.length) {
          return turns.map((t, i) => `
            <div style="padding:8px 10px;border-radius:8px;background:var(--surface);border:1px solid var(--border);margin-top:6px;">
              <div style="font-size:12px;font-weight:750;color:var(--ink);">Q${i + 1}: ${esc(t.q || '')}</div>
              <div style="font-size:13.2px;line-height:1.6;color:var(--ink-2);margin-top:4px;white-space:pre-wrap;">${esc(t.text || '')}</div>
            </div>`).join('');
        }
        return fallback ? `<div style="font-size:13.2px;line-height:1.62;white-space:pre-wrap;margin-top:6px;">${esc(fallback)}</div>` : '<div style="font-size:12.5px;color:var(--ink-3);margin-top:4px;">Không có bản ghi câu trả lời.</div>';
      };
      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-item);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <strong>Part 1 · Phỏng vấn</strong>
              <span class="ws-pill ok tabular">${pr.p1?.band ? `Band ${Number(pr.p1.band).toFixed(1)}` : `${pr.p1?.words || 0}w`}</span>
            </div>
            ${renderTurns(pr.p1?.turns, pr.p1?.transcript)}
          </div>
          <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-item);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <strong>Part 2 · Cue Card${pr.p2?.cueTitle ? ` — ${esc(pr.p2.cueTitle)}` : ''}</strong>
              <span class="ws-pill ok tabular">${pr.p2?.band ? `Band ${Number(pr.p2.band).toFixed(1)}` : `${pr.p2?.words || 0}w`}</span>
            </div>
            <div style="font-size:13.4px;line-height:1.65;white-space:pre-wrap;margin-top:6px;">${pr.p2?.transcript ? esc(pr.p2.transcript) : '<em style="color:var(--ink-3);">Không có bản ghi bài nói Part 2.</em>'}</div>
          </div>
          <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-item);">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
              <strong>Part 3 · Thảo luận</strong>
              <span class="ws-pill ok tabular">${pr.p3?.band ? `Band ${Number(pr.p3.band).toFixed(1)}` : `${pr.p3?.words || 0}w`}</span>
            </div>
            ${renderTurns(pr.p3?.turns, pr.p3?.transcript)}
          </div>
        </div>`;
    } else if (Array.isArray(h.turns) && h.turns.length) {
      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:12px;">
          ${h.turns.map((t, i) => `
            <div style="padding:12px 14px;border-radius:12px;border:1px solid var(--border);background:var(--surface-item);">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:5px;">
                <strong style="font-size:13px;color:var(--ink);">Q${i + 1}: ${esc(t.q || '')}</strong>
                <span class="ws-pill tabular">${t.words || 0}w · ${t.durationSec || 0}s</span>
              </div>
              <div style="font-size:13.5px;line-height:1.65;color:var(--ink-2);white-space:pre-wrap;">${esc(t.text || '')}</div>
            </div>`).join('')}
          ${h.report && window.IeltsGrader?.renderExaminerReportHtml ? window.IeltsGrader.renderExaminerReportHtml(h.report, { title: `Nhận xét AI · Speaking Part ${h.part || ''}` }) : ''}
        </div>`;
    } else {
      bodyHtml = `
        <div style="display:flex;flex-direction:column;gap:14px;">
          <div style="padding:14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--surface-item);">
            <div style="font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:var(--accent);margin-bottom:6px;">Bản ghi bài nói của bạn (${h.words || 0} từ · ${fmtMmSs(h.durationSec || 0)} · ${h.wpm || 0} WPM)</div>
            <div style="white-space:pre-wrap;font-size:13.8px;line-height:1.72;color:var(--ink);">${h.transcript ? esc(h.transcript) : '<em style="color:var(--ink-3);">Lượt nộp cũ trước khi nâng cấp lưu bản ghi chi tiết — các bài nói mới từ nay sẽ lưu đầy đủ transcript &amp; nhận xét AI.</em>'}</div>
            ${Array.isArray(h.usedChunks) && h.usedChunks.length ? `<div class="sp-kw-row" style="margin-top:10px;">${h.usedChunks.map((c) => `<span class="sp-kw-chip hit">✓ ${esc(c)}</span>`).join('')}</div>` : ''}
          </div>
          ${h.report && window.IeltsGrader?.renderExaminerReportHtml ? window.IeltsGrader.renderExaminerReportHtml(h.report, { title: 'Nhận xét AI · IELTS Speaking' }) : ''}
        </div>`;
    }

    const retryCall = h.part === 'full'
      ? `SpeakingStudio.closeHistoryReview(); window.TotoroUI?.enterSkillMode?.('Speaking', 'practice'); SpeakingStudio.startFullSpeakingTest('${esc(h.cueId)}', '${esc(h.mode || 'practice')}');`
      : `SpeakingStudio.closeHistoryReview(); window.TotoroUI?.enterSkillMode?.('Speaking', 'practice'); SpeakingStudio.openPracticeRoom('${esc(h.cueId)}', '${esc(h.mode || 'practice')}');`;

    const overlay = document.createElement('div');
    overlay.id = 'sp-hist-review-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10050;background:rgba(18,24,20,0.52);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:18px;';
    overlay.onclick = (e) => { if (e.target === overlay) closeHistoryReview(); };
    overlay.innerHTML = `
      <div style="width:min(860px,96vw);max-height:88vh;background:var(--surface);border:1px solid var(--border);border-radius:18px;box-shadow:0 24px 64px rgba(0,0,0,0.22);display:flex;flex-direction:column;overflow:hidden;">
        <div style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;justify-content:space-between;gap:14px;">
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;">
              <span class="ws-pill warm">${partLbl}</span>
              <span class="ws-pill ok tabular">${h.band ? `Band ${Number(h.band).toFixed(1)}` : `${h.words || 0} từ`}</span>
              <span style="font-size:12px;color:var(--ink-3);">${modeLbl} · ${fmtMmSs(h.durationSec || 0)} · ${h.wpm || 0} WPM${dt ? ` · ${dt}` : ''}</span>
            </div>
            <div style="font-size:15.5px;font-weight:800;color:var(--ink);line-height:1.4;">${esc(h.cueTitle || 'Bài nói IELTS Speaking')}</div>
            ${critHtml}
          </div>
          <button type="button" class="btn" style="padding:6px 12px;flex-shrink:0;" onclick="SpeakingStudio.closeHistoryReview()">Đóng ✕</button>
        </div>
        <div style="padding:18px 20px;overflow-y:auto;flex:1;">${bodyHtml}</div>
        <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;background:var(--surface-item);">
          <button type="button" class="btn" onclick="SpeakingStudio.closeHistoryReview()">Quay lại</button>
          <button type="button" class="btn btn-primary" onclick="${retryCall}">Luyện lại đề này →</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
  }

  function renderSpeakingHomePanel(el) {
    if (!el) return;
    const story = getStory();
    const hasStoryAccess = Boolean(story && (!window.AccessPolicy || window.AccessPolicy.can('speaking.story_mindmap')));
    const mStats = hasStoryAccess ? getStoryMasteryStats(story) : { done: 0, total: 0, pct: 0 };
    const taskDone = hasStoryAccess ? (getTaskDoneMap()[story.id] || null) : null;
    const tasksDoneCnt = hasStoryAccess ? (taskDone?.completed ? 4 : (taskDone?.maxStage || 0)) : 0;
    const hist = getPracHistory();
    const practicedIds = new Set(hist.map((h) => h.cueId));
    const p1Topics = getPart1Topics();
    const p2Cam = getPart2CambridgeTopics();
    const allCues = hasStoryAccess ? [...p2Cam, ...(story.cueCards || [])] : p2Cam;
    const p3Topics = getPart3Topics();
    const fullTests = getFullSpeakingTests();
    const totalAllTopics = p1Topics.length + allCues.length + p3Topics.length + fullTests.length;
    const p1Done = p1Topics.filter((t) => practicedIds.has(t.id)).length;
    const p2Done = allCues.filter((c) => practicedIds.has(c.id)).length;
    const p3Done = p3Topics.filter((t) => practicedIds.has(t.id)).length;
    const fullDone = fullTests.filter((f) => practicedIds.has(f.id)).length;
    const totalDoneTopics = p1Done + p2Done + p3Done + fullDone;
    const pracPct = Math.round((totalDoneTopics / Math.max(1, totalAllTopics)) * 100);
    const scoredHist = hist.filter((h) => Number(h.band) > 0);
    const avgBand = scoredHist.length ? (scoredHist.reduce((a, b) => a + Number(b.band), 0) / scoredHist.length) : 0;

    const partBars = [
      { label: 'Part 1 · Phỏng vấn', done: p1Done, total: p1Topics.length, part: 1 },
      { label: 'Part 2 · Cue Card', done: p2Done, total: allCues.length, part: 2 },
      { label: 'Part 3 · Thảo luận', done: p3Done, total: p3Topics.length, part: 3 },
      { label: 'Full Test · 14p', done: fullDone, total: fullTests.length, part: "'full'" }
    ];
    const barsHtml = partBars.map((g) => {
      const pct = Math.round((g.done / Math.max(1, g.total)) * 100);
      return `
        <div class="rh-deck-row" style="cursor:pointer;" onclick="SpeakingStudio.openPracticePart(${g.part})" title="Mở kho đề ${esc(g.label)}">
          <div class="rh-deck-meta"><span>${esc(g.label)}</span><strong class="tabular">${g.done}/${g.total}</strong></div>
          <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');

    const fullHistHtml = hist.length
      ? hist.slice(0, 10).map((h, idx) => {
          const dt = h.at ? new Date(h.at).toLocaleDateString('vi-VN') : '';
          const pTag = h.part === 'full' ? 'Full Test' : (h.part === 1 ? 'Part 1' : (h.part === 3 ? 'Part 3' : 'Part 2'));
          return `
            <div class="rh-hist-row lh-flat-row" onclick="SpeakingStudio.openHistoryReview(${idx})" role="button" tabindex="0">
              <div style="flex:1;min-width:0;">
                <div class="rh-hist-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(h.cueTitle)}</div>
                <div class="rh-hist-meta">${pTag} · ${h.mode === 'exam' ? 'Thi thật' : 'Luyện tập'} · ${fmtMmSs(h.durationSec)} · ${h.wpm || 0} WPM${dt ? ` · ${dt}` : ''}</div>
              </div>
              <div class="rh-hist-right">
                <span class="tot-hist-badge tabular">${h.band ? `B${Number(h.band).toFixed(1)}` : `${h.words || 0}w`}</span>
                <button type="button" class="tot-foot-btn" onclick="event.stopPropagation(); SpeakingStudio.openHistoryReview(${idx})">Xem bài</button>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="tot-empty-illustrated is-compact">
           <img class="tot-empty-mascot" src="assets/images/totoro_sitting_branch.webp" alt="" loading="lazy" decoding="async" draggable="false">
           <div class="tot-empty-copy">
             <strong>Chưa có bài Speaking nào được nộp</strong>
             <span>Thử 1 bộ Part 1 (4 câu), 1 Cue Card Part 2 hoặc Full Test 14 phút Cambridge 15–20 nhé.</span>
           </div>
         </div>`;

    const storyPct = Math.round((tasksDoneCnt / 4) * 100);
    const quickTiles = [
      { name: `Part 1 · Phỏng vấn (${p1Topics.length})`, meta: '96 câu thi thật Cam 15–20 · Khung A.R.E.', tag: 'Part 1', tone: 'is-sage', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>', act: 'SpeakingStudio.openPracticePart(1)' },
      { name: `Part 2 · Cue Card (${allCues.length})`, meta: hasStoryAccess ? `24 Cam 15–20 + ${(story?.cueCards || []).length} Story 01 Bẻ lái` : '24 Cue Card Cam 15–20 · 1p chuẩn bị + 2p nói', tag: 'Part 2', tone: 'is-teal', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>', act: 'SpeakingStudio.openPracticePart(2)' },
      { name: `Part 3 · Thảo luận (${p3Topics.length})`, meta: '144 câu thảo luận Cam 15–20 · Khung P.E.E.C.', tag: 'Part 3', tone: 'is-indigo', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><path d="M9.6 10.2 6.6 7.4M14.4 10.2 17.4 7.4M9.6 13.8 6.6 16.6M14.4 13.8 17.4 16.6"/></svg>', act: 'SpeakingStudio.openPracticePart(3)' },
      { name: `Full Test · 14p (${fullTests.length})`, meta: 'Thi trọn bộ Part 1 → Part 2 → Part 3 · Cam 15–20', tag: 'Full 14p', tone: 'is-warm', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>', act: "SpeakingStudio.openPracticePart('full')" }
    ];
    const quickTilesHtml = quickTiles.map((q) => `
      <button type="button" class="rh-quick-tile is-visual ${q.tone}" onclick="${q.act}">
        <div class="rh-quick-head-row">
          <span class="rh-quick-ico ${q.tone}" aria-hidden="true">${q.ico}</span>
          <span class="rh-quick-tag">${esc(q.tag)}</span>
        </div>
        <div class="rh-quick-name">${esc(q.name)}</div>
        <div class="rh-quick-meta-row">
          <span class="rh-quick-meta">${esc(q.meta)}</span>
          <span class="rh-quick-arr" aria-hidden="true">→</span>
        </div>
      </button>
    `).join('');

    const ringValPct = hasStoryAccess ? (mStats.pct || 0) : pracPct;
    const spRingOff = (176 * (1 - ringValPct / 100)).toFixed(1);

    el.innerHTML = `
      <div class="rh-layout rh-clean">
        <div class="rh-top-asym">
          <div class="tot-hero-card rh-main-hero has-mascot is-speaking">
            <div class="rh-hero-copy">
              <div class="rh-head-row">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Speaking · Full 3 Parts</h2>
                  <div class="tot-shell-sub tabular">${hasStoryAccess
                    ? `${mStats.done} / ${mStats.total} thẻ · ${tasksDoneCnt} / 4 Bước Task · ${totalDoneTopics} / ${totalAllTopics} Đề &amp; Full Test`
                    : `Cambridge IELTS 15–20 · ${totalDoneTopics} / ${totalAllTopics} Đề P1–P3 &amp; Full Test 14p`}</div>
                </div>
              </div>
              <div class="rh-decks-grid-4">${barsHtml}</div>
              <div class="sp-home-flow-strip" aria-label="Cấu trúc thi IELTS Speaking">
                <span>Part 1 (4–5p)</span><span aria-hidden="true">→</span>
                <span>Part 2 (1p+2p)</span><span aria-hidden="true">→</span>
                <span>Part 3 (4–5p)</span><span aria-hidden="true">→</span>
                <span>Chấm 4 tiêu chí AI</span>
              </div>
              <div class="rh-hero-actions" style="margin-top:12px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="SpeakingStudio.openPracticePart('full')">Thi Full Test 14p →</button>
                <button type="button" class="tot-demo-btn" onclick="SpeakingStudio.openPracticePart(1)">Part 1</button>
                <button type="button" class="tot-demo-btn" onclick="SpeakingStudio.openPracticePart(2)">Part 2 Cue Card</button>
                <button type="button" class="tot-demo-btn" onclick="SpeakingStudio.openPracticePart(3)">Part 3</button>
              </div>
            </div>
            <div class="rh-hero-mascot-stage" aria-hidden="true">
              <img class="rh-hero-mascot-img" src="assets/images/totoro_speaking_mascot.webp" alt="" decoding="async" draggable="false">
            </div>
          </div>

          <div class="tot-home-panel rh-band-panel">
            <div class="tot-panel-head" style="margin-bottom:10px;">
              <div>
                <div class="tot-panel-title">Tiến độ Speaking</div>
                <div class="tot-panel-sub tabular">${hasStoryAccess ? `${tasksDoneCnt} / 4 bước Task · ${totalDoneTopics} / ${totalAllTopics} đề` : `${totalDoneTopics} / ${totalAllTopics} đề Cambridge 15–20`}</div>
              </div>
              <div class="rh-ring-wrap is-indigo" aria-label="Tiến độ Speaking">
                <svg viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-subtle)" stroke-width="5.5"/>
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#4D5C8C" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="${spRingOff}" transform="rotate(-90 32 32)"/>
                </svg>
                <span class="rh-ring-val tabular">${avgBand > 0 && !hasStoryAccess ? avgBand.toFixed(1) : `${ringValPct}%`}</span>
              </div>
            </div>
            <div class="rh-kpi-strip tabular">
              ${hasStoryAccess ? `
                <div class="rh-kpi-cell"><span class="rh-kpi-num">${mStats.done}/${mStats.total}</span><span class="rh-kpi-lbl">Thẻ thuộc</span></div>
                <div class="rh-kpi-cell"><span class="rh-kpi-num">${tasksDoneCnt}/4</span><span class="rh-kpi-lbl">Bước Task</span></div>
                <div class="rh-kpi-cell"><span class="rh-kpi-num">${hist.length}</span><span class="rh-kpi-lbl">Lượt nói</span></div>
              ` : `
                <div class="rh-kpi-cell"><span class="rh-kpi-num">${p1Done + p2Done + p3Done}</span><span class="rh-kpi-lbl">Đề P1–P3</span></div>
                <div class="rh-kpi-cell"><span class="rh-kpi-num">${fullDone}/${fullTests.length}</span><span class="rh-kpi-lbl">Full Test</span></div>
                <div class="rh-kpi-cell"><span class="rh-kpi-num">${hist.length}</span><span class="rh-kpi-lbl">Lượt nộp</span></div>
              `}
            </div>
            <div class="tot-panel-foot" style="margin-top:auto;padding-top:10px;">
              <span class="tot-foot-meta">P1 (${p1Topics.length}) · P2 (${allCues.length}) · P3 (${p3Topics.length}) · Full (${fullTests.length})</span>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Speaking', 'practice')">Kho đề →</button>
            </div>
          </div>
        </div>

        <section class="rh-quick-section" aria-label="Mở nhanh Speaking Studio">
          <div class="rh-quick-head">
            <h3 class="rh-section-lbl">Mở nhanh Speaking Studio</h3>
            ${hasStoryAccess
              ? `<button type="button" class="rh-text-link" onclick="window.TotoroUI.enterSkillMode('Speaking', 'task')">Vào Task 4 Bước →</button>`
              : `<button type="button" class="rh-text-link" onclick="window.TotoroUI.enterSkillMode('Speaking', 'practice')">Xem tất cả 96 đề →</button>`}
          </div>
          <div class="rh-quick-grid">${quickTilesHtml}</div>
        </section>

        <div class="tot-home-panel">
          <div class="tot-panel-head">
            <div>
              <div class="tot-panel-title">Lịch sử làm bài Speaking</div>
              <div class="tot-panel-sub">Bấm vào từng lượt nói đã nộp để đọc lại transcript, điểm 4 tiêu chí &amp; nhận xét AI</div>
            </div>
            <span class="ws-pill tabular">${hist.length} lượt đã lưu</span>
          </div>
          <div class="rh-hist-list is-flat">${fullHistHtml}</div>
        </div>

        ${hasStoryAccess ? `
          <section class="sp-home-story-card" onclick="window.TotoroUI.enterSkillMode('Speaking', 'flashcard')" role="button" tabindex="0">
            <div class="sp-home-story-thumb">
              <img src="assets/speaking/story1/scene_01.webp" alt="${esc(story.title)}" loading="lazy">
            </div>
            <div class="ws-home-st-main">
              <div class="sp-home-story-kicker">Lộ trình Story 01 · IELTS Speaking Part 2</div>
              <div class="ws-home-st-title">${esc(story.title)}</div>
              <div class="ws-home-st-desc">${esc(story.subtitle)}</div>
            </div>
            <div class="ws-home-st-right" onclick="event.stopPropagation()">
              <div class="ws-home-st-prog">
                <span class="ws-pill tabular">${tasksDoneCnt} / 4 bước</span>
                <div class="ws-home-st-bar"><span style="width:${storyPct}%"></span></div>
              </div>
              <div class="sp-home-story-acts">
                <button type="button" class="tot-foot-btn" onclick="SpeakingStudio.openPictureBook(0)">Sách tranh</button>
                <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Speaking', 'task')">Làm Task</button>
                <button type="button" class="btn btn-primary tot-demo-btn" style="height:34px;min-height:34px;padding:0 14px;font-size:12.5px;" onclick="window.TotoroUI.enterSkillMode('Speaking', 'flashcard')">Học ngay →</button>
              </div>
            </div>
          </section>
        ` : ''}
      </div>
    `;
  }

  /* ================= TAB 2: FLASHCARD WORKSPACE (SMOOTH FULL STORY B1 → B5) ================= */
  function getVisibleCards() {
    const story = getStory();
    let list = buildStoryCards(story);
    if (state.chunksOnly) {
      const onlyChunks = list.filter((c) => c.kind === 'chunk');
      if (onlyChunks.length) list = onlyChunks;
    }
    if (!state.unmasteredOnly) return list;
    const mmap = getMasteryMap();
    const unm = list.filter((c) => !c.untested && mmap[c.id]?.level !== 3);
    return unm.length ? unm : list;
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
        lbl.innerHTML = 'Đã thuộc <small class="anki-ivl-tag">Gõ + Nói</small>';
      }
    }, 500);
  }

  function jumpToPart(groupKey) {
    state.unmasteredOnly = false;
    if (groupKey === 'MAP') state.chunksOnly = false;
    const cards = getVisibleCards();
    const idx = cards.findIndex((c) => c.group === groupKey);
    if (idx >= 0) {
      state.cardIdx = idx;
      state.flipped = false;
      renderFlashcardWorkspace();
    }
  }

  function renderFlashcardWorkspace() {
    ensureOverlays();
    const root = document.getElementById('speaking-flashcard-root');
    if (!root) return;
    if (window.AccessPolicy && !window.AccessPolicy.can('speaking.story_mindmap')) {
      root.innerHTML = `
        <div class="tot-section-shell" style="text-align:center;padding:34px 22px;display:flex;flex-direction:column;align-items:center;gap:12px;">
          <h3 style="margin:0;font-size:17px;color:var(--ink);">IELTS Speaking Practice · Cambridge 15–20</h3>
          <p style="margin:0;font-size:13.5px;color:var(--ink-2);max-width:520px;line-height:1.55;">
            Lớp của bạn sử dụng giáo án độc lập. Hãy luyện trực tiếp với kho <strong>24 đề Part 1 (96 câu)</strong> &amp; <strong>24 đề Part 3 (144 câu)</strong> thi thật Cambridge 15–20 kèm Giám khảo UK &amp; chấm AI 4 tiêu chí!
          </p>
          <button type="button" class="btn btn-primary" style="padding:9px 18px;" onclick="window.TotoroUI?.enterSkillMode?.('Speaking', 'practice')">Mở Luyện Đề Speaking →</button>
        </div>
      `;
      return;
    }
    const story = getStory();
    if (!story) return;

    const cards = getVisibleCards();
    if (state.cardIdx >= cards.length) state.cardIdx = 0;
    const card = cards[state.cardIdx];
    const mmap = getMasteryMap();
    const mStats = getStoryMasteryStats(story);
    const stLevel = mmap[card.id]?.level || 0;
    const statusCls = stLevel === 3 ? 'mastered' : (stLevel === 2 ? 'slow' : '');
    const statusTxt = card.untested ? (card.kind === 'story_flow' ? 'Bản đồ B1 → B5' : `Mạch ${card.sectionCode}`) : (stLevel === 3 ? 'Đã thuộc' : (stLevel === 2 ? 'Nhớ chậm' : 'Chưa học'));
    const isAnyFlow = card.kind === 'story_flow' || card.kind === 'section_flow';
    const showAudio = card.kind === 'chunk';
    const cdSec = getCooldownSec(card.id);

    const pctCard = Math.round(((state.cardIdx + 1) / Math.max(1, cards.length)) * 100);
    const wordSizeCls = card.en.length <= 20 ? 'sp-word-sm' : (card.en.length <= 36 ? 'sp-word-md' : 'sp-word-lg');
    const metaTag = card.kind === 'chunk' ? `Phần ${card.sectionCode}` : '';

    // Smooth compact story part ribbon (B1–B2 -> B3 -> B4 -> B5) with per-part mastery progress
    const allBaseCards = buildStoryCards(story);
    const partTabs = [
      { key: 'MAP', label: 'Sơ đồ' },
      { key: 'B1-B2', label: 'Mở bài' },
      { key: 'B3', label: 'Dẫn chuyện' },
      { key: 'B4', label: 'Cốt truyện' },
      { key: 'B5', label: 'Kết bài' }
    ];
    const partRibbonHtml = `
      <div class="sp-part-ribbon" role="navigation" aria-label="Mạch Story 01">
        ${partTabs.map((pt, i) => {
          const partChunks = pt.key === 'MAP' ? [] : allBaseCards.filter((c) => c.kind === 'chunk' && c.group === pt.key);
          const partDone = partChunks.filter((c) => mmap[c.id]?.level === 3).length;
          const cntHtml = partChunks.length
            ? `<span class="sp-part-cnt ${partDone === partChunks.length ? 'is-done' : ''}">${partDone === partChunks.length ? '✓' : `${partDone}/${partChunks.length}`}</span>`
            : '';
          return `
            <button type="button" class="sp-part-pill ${card.group === pt.key ? 'active' : ''}" onclick="SpeakingStudio.jumpToPart('${pt.key}')"><span>${pt.label}</span>${cntHtml}</button>
            ${i < partTabs.length - 1 ? '<span class="sp-part-sep" aria-hidden="true">→</span>' : ''}
          `;
        }).join('')}
      </div>
    `;

    // Front extra content
    let frontExtraHtml = '';
    if (card.kind === 'story_flow') {
      frontExtraHtml = `
        <div class="sp-stage-front-thumb"><img src="assets/speaking/story1/scene_01.webp" alt="${esc(story.title)}" loading="lazy"></div>
        <div class="fc-pronounce-row" onclick="event.stopPropagation()">
          <span class="fc-ipa-badge">Trọn mạch Story 01 · 30 cụm nói</span>
          <button type="button" class="btn-voice-speak" style="width:auto;padding:0 12px;" onclick="SpeakingStudio.openMindmapModal('master', event)"><span>Mindmap</span></button>
          <button type="button" class="btn-voice-speak" style="width:auto;padding:0 12px;" onclick="SpeakingStudio.openPictureBook(0, event)"><span>${(story?.pictureBook || []).length || 10} tranh</span></button>
        </div>
      `;
    } else if (card.kind === 'section_flow') {
      frontExtraHtml = `
        ${card.sceneImg ? `<div class="sp-stage-front-thumb"><img src="${esc(card.sceneImg)}" alt="${esc(card.en)}" loading="lazy"></div>` : ''}
        <div class="fc-pronounce-row" onclick="event.stopPropagation()">
          <span class="fc-ipa-badge">Mạch kể ${esc(card.sectionCode)}</span>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakSectionEn('${esc(card.sectionId)}', 'en-GB', event)"><span>UK</span></button>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakSectionEn('${esc(card.sectionId)}', 'en-US', event)"><span>US</span></button>
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

    // Back body content
    let backBodyHtml = '';
    if (card.kind === 'story_flow') {
      const mm = story.storyMindmap || [];
      const b1 = mm.find((n) => n.id === 'B1');
      const b2 = mm.find((n) => n.id === 'B2');
      const b3 = mm.find((n) => n.id === 'B3');
      const b5 = mm.find((n) => n.id === 'B5');
      const b4List = (story.stages || []).map((s) => `${s.code} ${s.titleVi}`).join(' → ');
      const overviewRows = [
        { key: 'b1', code: 'B1', title: 'Chân dung', text: b1?.textVi || '' },
        { key: 'b2', code: 'B2', title: 'Hình mẫu', text: b2?.textVi || '' },
        { key: 'b3', code: 'B3', title: 'Phẩm chất', text: b3?.textVi || '' },
        { key: 'b4', code: 'B4', title: '5 chặng truyện', text: b4List },
        { key: 'b5', code: 'B5', title: 'Bài học chốt', text: b5?.textVi || '' }
      ];
      backBodyHtml = `
        <div class="sp-flow-stage-grid" onclick="event.stopPropagation()">
          ${overviewRows.map((row) => {
            const masked = state.flowMaskOn && !state.flowRevealed[row.key];
            return `
              <div class="sp-flow-stage-row ${masked ? 'is-masked' : ''}" ${masked ? `onclick="SpeakingStudio.revealFlowNode('${row.key}', event)"` : ''}>
                <span class="sp-stage-badge">${row.code}</span>
                <div>${masked ? 'Chạm để hiện phần này (đang ẩn để nhẩm)...' : `<strong>${esc(row.title)}:</strong> ${esc(row.text)}`}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    } else if (card.kind === 'section_flow') {
      const showEn = Boolean(state.sectionEnRevealed[card.sectionId]);
      backBodyHtml = `
        <div class="sp-stage-back-hero" onclick="event.stopPropagation()">
          ${card.sceneImg ? `<div class="sp-stage-back-img"><img src="${esc(card.sceneImg)}" alt="${esc(card.en)}"></div>` : ''}
          <div class="sp-stage-vi-text">${esc(card.vi)}</div>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;" onclick="event.stopPropagation()">
          <button type="button" class="btn-reading-tip ${showEn ? 'is-active' : ''}" onclick="SpeakingStudio.toggleSectionEn('${esc(card.sectionId)}', event)">
            ${showEn ? 'Ẩn câu Tiếng Anh mẫu' : 'Xem câu Tiếng Anh mẫu'}
          </button>
          <div style="display:flex;gap:6px;">
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakSectionEn('${esc(card.sectionId)}', 'en-GB', event)"><span>UK</span></button>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakSectionEn('${esc(card.sectionId)}', 'en-US', event)"><span>US</span></button>
          </div>
        </div>
        ${showEn ? `<div class="sp-stage-en-reveal" onclick="event.stopPropagation()">${esc(card.textEn)}</div>` : ''}
      `;
    } else {
      const exTxt = String(card.example || '').trim();
      backBodyHtml = `
        <div class="fc-back-meaning">${esc(card.vi)}</div>
        <div class="fc-sentence-box">
          <div>${highlightInExample(exTxt, card.en)}</div>
          ${exTxt ? `
            <div class="sp-ex-audio-bar" onclick="event.stopPropagation()">
              <span class="sp-ex-audio-lbl">Nghe cả câu:</span>
              <button type="button" class="btn-voice-speak sp-ex-audio-btn" onclick="SpeakingStudio.speakRaw('${esc(exTxt).replace(/'/g, "\\'")}', 'en-GB', event)" title="Nghe cả câu giọng Anh - Anh (UK)"><span>UK</span></button>
              <button type="button" class="btn-voice-speak sp-ex-audio-btn" onclick="SpeakingStudio.speakRaw('${esc(exTxt).replace(/'/g, "\\'")}', 'en-US', event)" title="Nghe cả câu giọng Anh - Mỹ (US)"><span>US</span></button>
            </div>
          ` : ''}
        </div>
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
      const badgeCls = c.kind === 'story_flow' || c.kind === 'section_flow' ? 'is-flow' : '';
      const badgeTxt = c.kind === 'story_flow' ? 'MAP' : c.sectionCode;
      return `
        <button type="button" class="ws-mini-row ${idx === state.cardIdx ? 'active' : ''}" onclick="SpeakingStudio.jumpCard(${idx})">
          <span class="ws-kind-badge ${badgeCls}">${esc(badgeTxt)}</span>
          <span class="ws-mini-txt">${esc(c.en)}</span>
          <span class="ws-mini-dot ${dotCls}"></span>
        </button>
      `;
    }).join('');

    const curTimerDigits = document.getElementById('timer-digits')?.textContent || '00:00';
    const curTimerStatus = document.getElementById('timer-status-text')?.textContent || 'Đang học';
    const curTimerPlay = document.getElementById('timer-play-text')?.textContent || 'Tạm dừng';
    const curTimerToday = document.getElementById('timer-today-total')?.textContent || '0 phút';
    const isFocusActive = document.body.classList.contains('study-focus-mode') || document.body.classList.contains('focus-mode');

    root.innerHTML = `
      <!-- 1. TOP BAR — 1:1 Reading & Writing Totoro Editorial Parity + Smooth B1→B5 Ribbon -->
      <div class="study-top-bar">
        <div class="study-bar-left">
          <div class="scope-select-wrap has-custom-scope sp-scope-compact">
            <button type="button" class="tot-scope-trigger" onclick="SpeakingStudio.openPictureBook(0)" title="Story 01 · ${esc(story.shortTitle)} — Bấm xem Sách Tranh">
              <span class="tot-scope-trigger-label">Story 01</span>
            </button>
          </div>
          ${partRibbonHtml}
        </div>

        <div class="study-top-actions">
          <button type="button" class="btn-deck-tool tot-tool-quiet" onclick="SpeakingStudio.openMindmapModal('master')" title="Mở Sơ Đồ Mindmap Bẻ Lái Story 01 (kéo thả & phóng to)">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="5" cy="12" r="2.5"/><circle cx="19" cy="6" r="2.5"/><circle cx="19" cy="18" r="2.5"/><path d="M7.5 12H12m0 0 4.5-6M12 12l4.5 6"/></svg>
            <span>Mindmap</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet" onclick="SpeakingStudio.openPictureBook(0)" title="Xem Sách Tranh 26 phân cảnh">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>
            <span>Sách Tranh</span>
          </button>
          <button type="button" class="btn-deck-tool tot-tool-quiet ${state.chunksOnly ? 'active' : ''}" onclick="SpeakingStudio.toggleChunksOnly()" title="Bỏ thẻ dẫn mạch, chỉ ôn nhanh 30 Spoken Chunks">
            <svg class="tot-ico-sm" style="width:14px;height:14px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M4 7h16M4 12h12M4 17h8" stroke-linecap="round"/></svg>
            <span>Chỉ Chunks</span>
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
                <div class="widget-title">Task · Story 01</div>
                <div class="widget-subtitle">Mindmap → Nói → Bẻ lái → Đề</div>
              </div>
            </div>
            <div class="tot-speedquiz-meta">
              <span class="tot-sq-badge">Mindmap B1–B5</span>
              <span class="tot-sq-badge">Đề thi 60s + 2p</span>
            </div>
            <button type="button" class="btn-widget-speedquiz" onclick="SpeakingStudio.startTaskExam(1)">
              <span>Vào Task Story 01 →</span>
            </button>
          </div>
        </aside>

        <!-- CENTER CARD STAGE -->
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
                    <span>${card.kind === 'story_flow' ? 'Chạm thẻ để lật · Phím <strong>Space</strong>' : 'Chạm thẻ để lật · Phím <strong>Space</strong> · <strong>R</strong> nghe lại'}</span>
                  </div>
                </div>

                <!-- BACK FACE -->
                <div class="fc-face fc-face-back">
                  <div class="fc-back-scrollable" style="display:flex;flex-direction:column;">
                    <div class="fc-back-header-bar">
                      <div class="fc-back-top-row">
                        <span class="fc-pos">${esc(card.pos)}</span>
                        <div class="fc-back-header-right">
                          ${card.kind === 'story_flow' ? `<button type="button" class="btn-reading-tip ${state.flowMaskOn ? 'is-active' : ''}" onclick="SpeakingStudio.toggleFlowMask(event)">${state.flowMaskOn ? 'Hiện toàn bộ' : 'Ẩn để nhẩm'}</button>` : ''}
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

                    <div class="fc-back-body-stack ${card.kind === 'story_flow' ? 'is-flow-stack' : (card.kind === 'section_flow' ? 'is-section-stack' : '')}">${backBodyHtml}</div>
                  </div>

                  <div class="hanko-seal ${stLevel === 3 ? 'stamped' : ''}" aria-hidden="true">
                    <span class="hanko-seal-txt">Đã thuộc</span>
                  </div>

                  ${isAnyFlow ? `
                    <div class="ws-flow-guide-cta" onclick="event.stopPropagation()">
                      <button type="button" class="btn btn-primary ws-flow-guide-btn" onclick="SpeakingStudio.stepCard(1)">
                        <span>${card.kind === 'story_flow' ? 'Bắt đầu học từ B1–B2 →' : esc(card.nextLabel || 'Tiếp theo →')}</span>
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
                        <span id="sp-btn-master-lbl">${cdSec > 0 ? `Chờ ${cdSec}s` : 'Đã thuộc <small class="anki-ivl-tag">Gõ + Nói</small>'}</span>
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

          <div class="keyboard-hint">Phím tắt: <strong>Space</strong> Lật thẻ · <strong>← / →</strong> Chuyển thẻ · <strong>1 / 2 / 3</strong> Chấm điểm (3: B1 Gõ → B2 Nói) · <strong>R</strong> Nghe lại</div>
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
                <div class="widget-subtitle">30 Spoken Chunks (B1 → B5)</div>
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
                <div class="widget-title">Mạch Story 01</div>
                <div class="widget-subtitle">B1–B2 → B3 → B4 → B5</div>
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
    if (card && card.kind === 'chunk') {
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
    if (c && c.kind === 'chunk') speakText(c.en, 'en-US');
  }
  function jumpCard(idx) {
    state.cardIdx = idx;
    state.flipped = false;
    renderFlashcardWorkspace();
  }
  function speakCurrent(accent, e) {
    if (e) e.stopPropagation();
    const card = getVisibleCards()[state.cardIdx];
    if (!card || card.kind === 'story_flow') return;
    if (card.kind === 'section_flow') {
      if (card.textEn) speakText(card.textEn, accent || 'en-GB');
      return;
    }
    speakText(card.en, accent || 'en-US');
  }
  function speakSectionEn(sectionId, accent, e) {
    if (e) e.stopPropagation();
    const sec = (getStory()?.storySections || []).find((s) => s.id === sectionId);
    if (sec?.textEn) speakText(sec.textEn, accent || 'en-GB');
  }
  function speakRaw(text, accent, e) {
    if (e) e.stopPropagation();
    speakText(text, accent || 'en-GB');
  }
  function toggleChunksOnly() {
    state.chunksOnly = !state.chunksOnly;
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
  function toggleSectionEn(sectionId, e) {
    if (e) e.stopPropagation();
    state.sectionEnRevealed[sectionId] = !state.sectionEnRevealed[sectionId];
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

  /* ================= 2-STEP RECALL MODAL (BƯỚC 1: GÕ LẠI · BƯỚC 2: NÓI LẠI) ================= */
  function startRecallTest(card) {
    ensureOverlays();
    STT()?.abort?.();
    recallState = {
      card,
      step: 1, // 1: Gõ lại chính xác (45s, default type) | 2: Nói lại câu (90s, default voice)
      inputMode: 'type',
      recording: false,
      processing: '',
      transcript: '',
      audioUrl: '',
      feedback: null,
      secsLeft: 45,
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
    if (!recallState || recallState.step !== 2) return;
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
      toast('Trình duyệt không hỗ trợ Micro — chuyển sang chế độ Gõ dự phòng.');
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
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 25000,
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
          recallState.feedback = { ok: false, msg: 'Chưa nghe rõ giọng bạn — hãy nói to rõ hơn hoặc dùng Gõ dự phòng.' };
          renderRecallModal();
          return;
        }
        gradeRecallAnswer(res.text);
      },
      onError: (errMsg) => {
        if (!recallState) return;
        recallState.recording = false;
        recallState.processing = '';
        recallState.feedback = { ok: false, msg: String(errMsg || 'Không thể dùng Micro. Bạn có thể bấm Gõ dự phòng.') };
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
      if (!val) { toast('Hãy nhập trọn câu Tiếng Anh!'); return; }
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
      const passed = userNorm === targetNorm;
      if (passed) {
        recallState.feedback = { ok: true, msg: `Chính xác! Chuyển sang Bước 2 · Nói lại câu...` };
        renderRecallModal();
        setTimeout(() => {
          if (!recallState) return;
          recallState.step = 2;
          recallState.inputMode = 'voice';
          recallState.secsLeft = 90;
          recallState.transcript = '';
          recallState.audioUrl = '';
          recallState.feedback = null;
          startRecallTimer();
          renderRecallModal();
        }, 650);
      } else {
        recallState.feedback = { ok: false, msg: 'Chưa khớp chính xác mặt chữ — hãy kiểm tra chính tả và gõ lại!' };
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
        recallState.feedback = { ok: true, passedAll: true, msg: 'Xuất sắc! Bạn đã vượt qua cả 2 bước (Gõ lại + Nói lại).' };
        renderRecallModal();
      } else {
        recallState.feedback = {
          ok: false,
          msg: !chunkHit
            ? 'Câu nói chưa chứa cụm từ tiếng Anh vừa học cho ý trên. Hãy thử nói lại!'
            : 'Câu còn ngắn — hãy nói trọn vẹn câu Tiếng Việt ở trên.'
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
    if (step === 1) {
      interactionHtml = `
        <div class="ws-recall-box">
          <input type="text" class="sp-underline-input is-single" id="sp-recall-input" placeholder="_ _ _ _"
            autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
            onpaste="event.preventDefault();"
            onkeydown="if(event.key==='Enter'){event.preventDefault();SpeakingStudio.submitRecallTyped();}">
          <div style="font-size:13.5px;color:var(--ink-2);text-align:center;">Gõ chính xác cụm từ tiếng Anh vừa học để sang Bước 2 (Nói lại).</div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn" onclick="SpeakingStudio.closeRecall()">Bỏ kiểm tra</button>
          <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitRecallTyped()">Tiếp sang Bước 2 →</button>
        </div>
      `;
    } else if (inputMode === 'voice') {
      interactionHtml = `
        <div class="sp-mic-stage ${recording ? 'is-rec' : ''}">
          ${waveHtml}
          <button type="button" class="sp-mic-btn ${recording ? 'is-recording' : ''}" ${processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleRecallMic()">
            <span>${recording ? 'Đang thu âm · Bấm để dừng' : 'Bấm Mic nói trọn câu'}</span>
          </button>
          <div style="font-size:12.5px;color:var(--ink-2);">
            ${processing ? esc(processing) : (recording ? 'Đang nghe giọng bạn...' : 'Nói trọn câu Tiếng Anh diễn đạt ý Tiếng Việt ở trên')}
          </div>
          ${audioUrl ? `<audio class="sp-audio-replay" controls src="${esc(audioUrl)}"></audio>` : ''}
          ${transcript ? `<div class="sp-transcript-box"><strong>Bạn vừa nói:</strong> ${esc(transcript)}</div>` : ''}
        </div>
      `;
    } else {
      interactionHtml = `
        <textarea class="ws-recall-sent-input" id="sp-recall-sent-ta" style="min-height:110px;"
          autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"
          onpaste="event.preventDefault();"
          placeholder="Nhập câu Tiếng Anh của bạn tại đây...">${esc(transcript)}</textarea>
        <div style="display:flex;justify-content:flex-end;gap:10px;">
          <button type="button" class="btn" onclick="SpeakingStudio.closeRecall()">Bỏ kiểm tra</button>
          <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitRecallTyped()">Xác nhận câu</button>
        </div>
      `;
    }

    el.innerHTML = `
      <div class="sp-modal-head">
        <div class="sp-modal-title">KIỂM TRA ĐÃ THUỘC · BƯỚC ${step} / 2 · ${step === 1 ? 'GÕ LẠI' : 'NÓI LẠI'}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          ${step === 2 ? `
            <button type="button" class="btn" style="padding:5px 11px;font-size:12px;" onclick="SpeakingStudio.toggleRecallMode()">
              ${inputMode === 'voice' ? 'Gõ dự phòng' : 'Dùng Mic'}
            </button>
          ` : ''}
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

    if (step === 1) {
      setTimeout(() => document.getElementById('sp-recall-input')?.focus(), 30);
    }
  }

  /* ================= PICTURE BOOK CINEMA VIEWER MODAL (10 CURATED SCENES) ================= */
  function handlePbKeyDown(e) {
    if (!pbState) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stepPictureBook(1); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPictureBook(-1); }
    else if (e.key === 'Escape') { e.preventDefault(); closePictureBook(); }
  }
  function openPictureBook(pageIdx, e) {
    if (e) e.stopPropagation();
    ensureOverlays();
    const pages = getStory()?.pictureBook || [];
    if (!pages.length) return;
    pbState = { idx: Math.max(0, Math.min(pages.length - 1, Number(pageIdx) || 0)), showEn: false };
    document.getElementById('sp-pb-modal').classList.add('open');
    window.removeEventListener('keydown', handlePbKeyDown);
    window.addEventListener('keydown', handlePbKeyDown);
    renderPictureBook();
  }
  function closePictureBook() {
    pbState = null;
    window.removeEventListener('keydown', handlePbKeyDown);
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
    pbState.showEn = !pbState.showEn;
    renderPictureBook();
  }

  function renderPictureBook() {
    if (!pbState) return;
    const pages = getStory()?.pictureBook || [];
    const cur = pages[pbState.idx];
    if (!cur) return;

    const el = document.getElementById('sp-pb-card');
    if (!el) return;
    el.classList.add('sp-pb-cinema-card');
    const pageBadge = `${String(cur.page).padStart(2, '0')} / ${String(pages.length).padStart(2, '0')}`;

    el.innerHTML = `
      <div class="sp-pb-top-bar">
        <div class="sp-pb-top-meta">
          <span class="sp-pill ok">${esc(cur.badge || `Phần ${cur.chapterNum}`)}</span>
          <span class="sp-pb-top-title">${esc(cur.title)}</span>
        </div>
        <div class="sp-pb-top-acts">
          <button type="button" class="sp-pb-pill-btn ${pbState.showEn ? 'active' : ''}" onclick="SpeakingStudio.togglePbVi()">${pbState.showEn ? 'Song ngữ EN + VI' : 'Xem Tiếng Anh'}</button>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cur.en).replace(/'/g, "\\'")}', 'en-GB')" title="Nghe giọng Anh-Anh"><span>UK</span></button>
          <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cur.en).replace(/'/g, "\\'")}', 'en-US')" title="Nghe giọng Anh-Mỹ"><span>US</span></button>
          <button type="button" class="sp-pb-pill-btn is-close" onclick="SpeakingStudio.closePictureBook()" title="Đóng [Esc]">✕</button>
        </div>
      </div>

      <div class="sp-pb-stage">
        <button type="button" class="sp-pb-float-nav is-prev" ${pbState.idx === 0 ? 'disabled' : ''} onclick="SpeakingStudio.stepPictureBook(-1)" aria-label="Cảnh trước" title="Cảnh trước [←]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>

        <div class="sp-pb-hero-wrap">
          <img class="sp-pb-hero-img" src="${esc(cur.img)}" alt="Cảnh ${cur.page}: ${esc(cur.title)}">
        </div>

        <button type="button" class="sp-pb-float-nav is-next" ${pbState.idx >= pages.length - 1 ? 'disabled' : ''} onclick="SpeakingStudio.stepPictureBook(1)" aria-label="Cảnh tiếp" title="Cảnh tiếp [→]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <div class="sp-pb-progress" role="tablist" aria-label="Tiến độ 10 cảnh truyện tranh">
        ${pages.map((p, i) => `
          <button type="button" class="sp-pb-seg ${i === pbState.idx ? 'is-active' : (i < pbState.idx ? 'is-past' : '')}" onclick="SpeakingStudio.jumpPictureBook(${i})" title="Cảnh ${p.page}: ${esc(p.title)}" aria-label="Cảnh ${p.page}"></button>
        `).join('')}
      </div>

      <div class="sp-pb-caption">
        <div class="sp-pb-caption-row">
          <span class="sp-pb-page-chip tabular">${pageBadge}</span>
          <div class="sp-pb-caption-text">
            <div class="sp-pb-vi-story">${esc(cur.vi)}</div>
            ${pbState.showEn ? `
              <div class="sp-pb-en-story">${esc(cur.en)}</div>
              ${(cur.collocations || []).length ? `
                <div class="sp-pb-cols">
                  ${cur.collocations.map((col) => `
                    <button type="button" class="sp-kw-chip hit" style="cursor:pointer;" onclick="SpeakingStudio.speakRaw('${esc(col).replace(/'/g, "\\'")}', 'en-US')">${esc(col)}</button>
                  `).join('')}
                </div>
              ` : ''}
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  /* ================= FULLSCREEN INTERACTIVE MINDMAP BẺ LÁI (100% SOURCE HTML PARITY) ================= */
  function openMindmapModal(modeOrGroupId, e) {
    if (e) e.stopPropagation();
    if (window.AccessPolicy && !window.AccessPolicy.can('speaking.story_mindmap')) return;
    ensureOverlays();
    const story = getStory();
    const groups = story?.mindmapGroups || [];
    if (!groups.length) return;

    const isGroup = modeOrGroupId && modeOrGroupId !== 'master' && groups.some((g) => g.id === modeOrGroupId);
    mmState = {
      mode: isGroup ? 'group' : 'master', // 'master' (Radial Hub Story 01) | 'group' (5-block Mindmap Bẻ Lái)
      groupId: isGroup ? modeOrGroupId : groups[0].id,
      lang: 'vi', // 'vi' | 'en'
      scale: 1,
      panX: 0,
      panY: 0,
      dragging: false,
      startX: 0,
      startY: 0
    };
    const root = document.getElementById('sp-mindmap-modal');
    root.classList.add('open');
    renderMindmapModal();
  }

  function closeMindmapModal() {
    mmState = null;
    document.getElementById('sp-mindmap-modal')?.classList.remove('open');
  }

  function setMindmapMode(mode, groupId) {
    if (!mmState) return;
    mmState.mode = mode === 'group' ? 'group' : 'master';
    if (groupId) mmState.groupId = groupId;
    renderMindmapModal();
  }

  function setMindmapLang(lang) {
    if (!mmState) return;
    mmState.lang = lang === 'en' ? 'en' : 'vi';
    renderMindmapModal();
  }

  function selectMindmapGroup(groupId) {
    if (!mmState) return;
    mmState.mode = 'group';
    mmState.groupId = groupId;
    renderMindmapModal();
  }

  function applyMindmapTransform(animate) {
    if (!mmState) return;
    const canvas = document.getElementById('sp-mm-canvas');
    const zoomEl = document.getElementById('sp-mm-zoom-val');
    if (canvas) {
      canvas.classList.toggle('is-smooth', Boolean(animate));
      canvas.style.transform = `translate3d(${Math.round(mmState.panX)}px, ${Math.round(mmState.panY)}px, 0) scale(${mmState.scale})`;
    }
    if (zoomEl) zoomEl.textContent = `${Math.round(mmState.scale * 100)}%`;
  }

  function zoomMindmap(factor) {
    if (!mmState) return;
    const vp = document.getElementById('sp-mm-viewport');
    const cx = vp ? vp.clientWidth / 2 : 700;
    const cy = vp ? vp.clientHeight / 2 : 420;
    const next = Math.min(2.0, Math.max(0.32, mmState.scale * factor));
    mmState.panX -= (cx - mmState.panX) * (next / mmState.scale - 1);
    mmState.panY -= (cy - mmState.panY) * (next / mmState.scale - 1);
    mmState.scale = next;
    applyMindmapTransform(true);
  }

  function fitMindmapToScreen() {
    if (!mmState) return;
    const vp = document.getElementById('sp-mm-viewport');
    const canvas = document.getElementById('sp-mm-canvas');
    if (!vp || !canvas) return;
    const vw = vp.clientWidth;
    const vh = vp.clientHeight;
    const cw = canvas.scrollWidth || canvas.offsetWidth || 1200;
    const ch = canvas.scrollHeight || canvas.offsetHeight || 700;
    const padX = 56;
    const padY = 84;
    const sc = Math.min(1.06, Math.max(0.32, Math.min((vw - padX) / cw, (vh - padY) / ch)));
    mmState.scale = sc;
    mmState.panX = Math.round((vw - cw * sc) / 2);
    mmState.panY = Math.round(Math.max(58, (vh - ch * sc) / 2 + 12));
    applyMindmapTransform(true);
  }

  function bindMindmapViewportEvents() {
    const vp = document.getElementById('sp-mm-viewport');
    if (!vp || vp._spBound) return;
    vp._spBound = true;

    vp.addEventListener('mousedown', (e) => {
      if (!mmState || e.target.closest('button, select, input, textarea, .sp-mm-card-click')) return;
      mmState.dragging = true;
      mmState.startX = e.clientX - mmState.panX;
      mmState.startY = e.clientY - mmState.panY;
      vp.classList.add('is-grabbing');
    });
    window.addEventListener('mousemove', (e) => {
      if (!mmState || !mmState.dragging) return;
      mmState.panX = e.clientX - mmState.startX;
      mmState.panY = e.clientY - mmState.startY;
      applyMindmapTransform();
    });
    window.addEventListener('mouseup', () => {
      if (!mmState || !mmState.dragging) return;
      mmState.dragging = false;
      document.getElementById('sp-mm-viewport')?.classList.remove('is-grabbing');
    });
    vp.addEventListener('wheel', (e) => {
      if (!mmState) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.09 : 0.91;
      const rect = vp.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const next = Math.min(2.0, Math.max(0.32, mmState.scale * factor));
      mmState.panX -= (mx - mmState.panX) * (next / mmState.scale - 1);
      mmState.panY -= (my - mmState.panY) * (next / mmState.scale - 1);
      mmState.scale = next;
      applyMindmapTransform();
    }, { passive: false });
  }

  function renderMindmapModal() {
    if (!mmState) return;
    const root = document.getElementById('sp-mindmap-modal');
    const story = getStory();
    const groups = story?.mindmapGroups || [];
    const stages = story?.stages || [];
    const b4 = story?.mindmapB4 || { en: [], vi: [] };
    const isEn = mmState.lang === 'en';
    const b4Paras = isEn ? b4.en : b4.vi;
    const b4FullEn = (b4.en || []).join(' ');

    const arrowCol = (tag) => `
      <div class="sp-mm-arrow-col">
        <span class="sp-mm-arrow-tag">${esc(tag)}</span>
        <svg viewBox="0 0 28 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h20"/><path d="m17 6 6 6-6 6"/></svg>
      </div>
    `;

    let canvasInner = '';
    if (mmState.mode === 'master') {
      const g0 = groups[0] || {};
      const b12Txt = isEn ? (g0.b12En || '') : (g0.b12Vi || '');
      const b3Txt = isEn ? (g0.b3En || '') : (g0.b3Vi || '');
      const b5Txt = isEn ? (g0.b5En || '') : (g0.b5Vi || '');
      canvasInner = `
        <div class="sp-mm-node-box is-b12">
          <div class="sp-mm-node-head">
            <span>${isEn ? 'OPENING & IDENTITY' : 'MỞ BÀI & NHẬN DIỆN NHÂN VẬT'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(g0.b12En || '').replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-node-text">${esc(b12Txt)}</div>
        </div>

        ${arrowCol('')}

        <div class="sp-mm-node-box is-b3">
          <div class="sp-mm-node-head">
            <span>${isEn ? 'STORY PIVOT' : 'DẪN CHUYỆN BẺ LÁI'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(g0.b3En || '').replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-node-text is-quote">“${esc(b3Txt)}”</div>
        </div>

        ${arrowCol(isEn ? 'CONTINUE' : 'KỂ TIẾP')}

        <div class="sp-mm-col-b4 is-compact">
          <div class="sp-mm-b4-head">
            <span>${isEn ? 'ACTION STORY' : 'CỐT TRUYỆN HÀNH ĐỘNG'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(b4FullEn).replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-b4-paras">
            ${b4Paras.map((p) => `<p>${esc(p)}</p>`).join('')}
          </div>
        </div>

        ${arrowCol(isEn ? 'WRAP UP' : 'CHỐT BÀI')}

        <div class="sp-mm-node-box is-b5">
          <div class="sp-mm-node-head">
            <span>${isEn ? 'CLOSURE & LESSON' : 'KẾT BÀI & BÀI HỌC ĐÚC KẾT'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(g0.b5En || '').replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-node-text is-quote">“${esc(b5Txt)}”</div>
        </div>
      `;
    } else {
      const grp = groups.find((g) => g.id === mmState.groupId) || groups[0];
      const topics = grp?.topics || [];
      canvasInner = `
        <div class="sp-mm-grp-topics">
          <div class="sp-mm-grp-topics-head">
            <span>${isEn ? 'APPLICABLE CUE CARDS' : 'CÁC ĐỀ THI ÁP DỤNG'}</span>
            <span class="sp-mm-badge-cnt">${topics.length} ${isEn ? 'topics' : 'đề thi'}</span>
          </div>
          <div class="sp-mm-topics-grid ${topics.length === 1 ? 'is-single' : ''}">
            ${topics.map((t, tIdx) => `
              <div class="sp-mm-topic-card">
                <div class="sp-mm-topic-code">${isEn ? 'CUE CARD' : 'ĐỀ'} ${tIdx + 1}</div>
                <div class="sp-mm-topic-title">${esc(isEn ? t.titleEn : t.titleVi)}</div>
                <ul class="sp-mm-topic-bullets">
                  ${(isEn ? t.bulletsEn : t.bulletsVi).map((b) => `<li>${esc(b)}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </div>
        </div>

        ${arrowCol('')}

        <div class="sp-mm-node-box is-b12">
          <div class="sp-mm-node-head">
            <span>${isEn ? 'OPENING & IDENTITY' : 'MỞ BÀI & NHẬN DIỆN NHÂN VẬT'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(grp.b12En).replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-node-text">${esc(isEn ? grp.b12En : grp.b12Vi)}</div>
        </div>

        ${arrowCol('')}

        <div class="sp-mm-node-box is-b3">
          <div class="sp-mm-node-head">
            <span>${isEn ? 'STORY PIVOT' : 'DẪN CHUYỆN BẺ LÁI'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(grp.b3En).replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-node-text is-quote">“${esc(isEn ? grp.b3En : grp.b3Vi)}”</div>
        </div>

        ${arrowCol(isEn ? 'CONTINUE' : 'KỂ TIẾP')}

        <div class="sp-mm-col-b4 is-compact">
          <div class="sp-mm-b4-head">
            <span>${isEn ? 'ACTION STORY' : 'CỐT TRUYỆN HÀNH ĐỘNG'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(b4FullEn).replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-b4-paras">
            ${b4Paras.map((p) => `<p>${esc(p)}</p>`).join('')}
          </div>
        </div>

        ${arrowCol(isEn ? 'WRAP UP' : 'CHỐT BÀI')}

        <div class="sp-mm-node-box is-b5">
          <div class="sp-mm-node-head">
            <span>${isEn ? 'TOPIC CLOSURE' : 'KẾT BÀI CHỐT ĐÚNG ĐỀ'}</span>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(grp.b5En).replace(/'/g, "\\'")}', 'en-GB', event)"><span>UK</span></button>
          </div>
          <div class="sp-mm-node-text is-quote">“${esc(isEn ? grp.b5En : grp.b5Vi)}”</div>
        </div>
      `;
    }

    root.innerHTML = `
      <div class="sp-mm-float-left">
        <div class="sp-mm-seg">
          <button type="button" class="sp-mm-seg-btn ${mmState.mode === 'master' ? 'active' : ''}" onclick="SpeakingStudio.setMindmapMode('master')">Sơ đồ Story 01</button>
          <button type="button" class="sp-mm-seg-btn ${mmState.mode === 'group' ? 'active' : ''}" onclick="SpeakingStudio.setMindmapMode('group')">Mindmap Bẻ Lái</button>
        </div>
        <div class="sp-mm-seg">
          <button type="button" class="sp-mm-seg-btn ${mmState.lang === 'vi' ? 'active' : ''}" onclick="SpeakingStudio.setMindmapLang('vi')">Tiếng Việt</button>
          <button type="button" class="sp-mm-seg-btn ${mmState.lang === 'en' ? 'active' : ''}" onclick="SpeakingStudio.setMindmapLang('en')">English</button>
        </div>
        ${mmState.mode === 'group' ? `
          <select class="sp-mm-select" aria-label="Chọn cụm đề bẻ lái" onchange="SpeakingStudio.selectMindmapGroup(this.value)">
            ${groups.map((g) => `<option value="${esc(g.id)}" ${g.id === mmState.groupId ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}
          </select>
        ` : ''}
      </div>

      <div class="sp-mm-float-right">
        <button type="button" class="sp-mm-ctrl" onclick="SpeakingStudio.zoomMindmap(0.85)" title="Thu nhỏ (-)">−</button>
        <span class="sp-mm-zoom-val tabular" id="sp-mm-zoom-val">100%</span>
        <button type="button" class="sp-mm-ctrl" onclick="SpeakingStudio.zoomMindmap(1.15)" title="Phóng to (+)">+</button>
        <button type="button" class="sp-mm-ctrl is-fit" onclick="SpeakingStudio.fitMindmapToScreen()" title="Căn vừa màn hình">Fit</button>
        <button type="button" class="sp-mm-ctrl is-close" onclick="SpeakingStudio.closeMindmapModal()" title="Đóng Mindmap (Esc)">✕</button>
      </div>

      <div class="sp-mm-viewport" id="sp-mm-viewport">
        <div class="sp-mm-canvas" id="sp-mm-canvas">${canvasInner}</div>
      </div>

      <div class="sp-mm-hint-bar">Kéo chuột để di chuyển · Lăn chuột để phóng to / thu nhỏ · Chuyển nhanh Tiếng Việt / English</div>
    `;

    bindMindmapViewportEvents();
    requestAnimationFrame(() => fitMindmapToScreen());
  }

  /* ================= TAB 3: TASK HUB (1 STORY = 1 CLEAN EDITORIAL TASK CARD) ================= */
  function renderTaskHub(tabsEl, gridEl) {
    if (window.AccessPolicy && !window.AccessPolicy.can('speaking.story_mindmap')) {
      const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
      const subEl = document.getElementById('inline-task-sub');
      if (titleEl) titleEl.textContent = 'IELTS Speaking · Luyện Đề Thi Thật';
      if (subEl) subEl.textContent = 'Lớp của bạn sử dụng giáo án độc lập — luyện ngay 24 đề Part 1 & 24 đề Part 3 thi thật Cambridge 15–20.';
      if (tabsEl) tabsEl.innerHTML = '';
      if (gridEl) {
        gridEl.innerHTML = `
          <div style="grid-column:1 / -1;padding:28px 20px;border-radius:16px;border:1.5px dashed var(--border-strong);background:var(--surface-panel);text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <strong style="font-size:15.5px;color:var(--ink);">Phòng Phỏng Vấn Speaking Part 1 &amp; Part 3</strong>
            <div style="font-size:13px;color:var(--ink-2);max-width:500px;line-height:1.55;">96 đề thi thật Cambridge IELTS 15–20 (Part 1, Part 2 Cue Card, Part 3 &amp; 24 Full Test 14p) với Giám khảo đọc UK, thu âm AI &amp; chấm 4 tiêu chí.</div>
            <button type="button" class="btn btn-primary" style="padding:9px 18px;" onclick="window.TotoroUI?.enterSkillMode?.('Speaking', 'practice')">Vào Luyện Speaking →</button>
          </div>
        `;
      }
      return;
    }
    const story = getStory();
    if (!story || !gridEl) return;
    const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
    const subEl = document.getElementById('inline-task-sub');
    if (titleEl) titleEl.textContent = 'Task bài tập · Speaking';
    const mStats = getStoryMasteryStats(story);
    const doneInfo = getTaskDoneMap()[story.id] || null;
    const maxSt = doneInfo?.completed ? 4 : (doneInfo?.maxStage || 0);
    const pct = Math.round((maxSt / 4) * 100);
    if (subEl) subEl.textContent = `${maxSt} / 4 bước Story 01 hoàn thành · ${mStats.done}/${mStats.total} thẻ Flashcard.`;
    if (tabsEl) {
      tabsEl.innerHTML = `<button type="button" class="tot-seg-btn active">Story Series · Part 2</button>`;
    }

    const firstCue = (story.cueCards || [])[0];
    const stepList = [
      { n: 1, title: 'Viết Sơ Đồ Story 01', sub: 'Tự viết tiếng Anh trọn mạch Mở bài → Dẫn chuyện → Cốt truyện → Kết bài' },
      { n: 2, title: 'Kể Story qua Mic', sub: 'Nói trọn mạch câu chuyện theo 5 trạm' },
      { n: 3, title: 'Viết Mindmap Bẻ Lái', sub: 'Tự viết Mở bài, Dẫn chuyện, Kết bài có hướng dẫn' },
      { n: 4, title: 'Nói Đề Thi Thật', sub: '1 Cue Card cụ thể · 60s chuẩn bị + 2p nói' }
    ];

    gridEl.innerHTML = `
      <article class="ws-task-card is-core sp-story-task-card ${doneInfo?.completed ? 'is-done' : ''}">
        <div class="sp-story-task-media" onclick="SpeakingStudio.startTaskExam(${Math.min(4, maxSt + 1)})">
          <img src="assets/speaking/story1/scene_01.webp" alt="${esc(story.title)}" loading="lazy">
        </div>

        <div class="sp-story-task-content">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <span class="ws-task-code">STORY 01 · 4 BƯỚC THỰC CHIẾN</span>
            <span class="ws-pill ${doneInfo?.completed ? 'ok' : ''} tabular">${doneInfo?.completed ? 'Hoàn thành 4/4 ✓' : `${maxSt} / 4 bước`}</span>
          </div>

          <div class="sp-story-task-title">${esc(story.title)}</div>
          <div class="ws-task-meta">${esc(story.subtitle)}</div>

          <div class="sp-story-steps-grid">
            ${stepList.map((st) => {
              const isDone = maxSt >= st.n;
              return `
                <button type="button" class="sp-story-step-item is-s${st.n} ${isDone ? 'is-done' : ''}" onclick="SpeakingStudio.startTaskExam(${st.n})">
                  <span class="sp-story-step-num">${isDone ? '✓' : st.n}</span>
                  <div class="sp-story-step-copy">
                    <div class="sp-story-step-name">${esc(st.title)}</div>
                    <div class="sp-story-step-sub">${esc(st.sub)}</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>

          <div class="sp-story-task-bottom">
            <div class="ws-task-prog" style="flex:1;min-width:150px;">
              <div class="ws-task-prog-track"><div class="ws-task-prog-fill" style="width:${pct}%;"></div></div>
              <span class="ws-task-prog-pct tabular">${pct}%</span>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button type="button" class="btn" style="padding:7px 12px;font-size:12.5px;" onclick="SpeakingStudio.openMindmapModal('master')">Mindmap</button>
              <button type="button" class="btn" style="padding:7px 12px;font-size:12.5px;" onclick="SpeakingStudio.openPictureBook(0)">Sách Tranh</button>
              <button type="button" class="btn btn-primary" style="padding:7px 16px;font-size:13px;" onclick="SpeakingStudio.startTaskExam(${Math.min(4, maxSt + 1)})">
                ${doneInfo?.completed ? 'Làm lại Task →' : (maxSt > 0 ? `Tiếp Bước ${maxSt + 1} →` : 'Vào Task Story 01 →')}
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  function getStageLimitSec(stageNum, t4Phase) {
    if (stageNum === 1) return 12 * 60;
    if (stageNum === 2) return 10 * 60;
    if (stageNum === 3) return 10 * 60;
    return t4Phase === 'speak' ? 2 * 60 : 60;
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
      secsLeft: getStageLimitSec(st, 'prep'),
      timerId: null,
      // Test 1: Radial Hub Mindmap Story 01 (7 simplified ghost-text nodes: B1-B3, B4.1..B4.5, B5)
      t1Drafts: {},
      t1Locked: {},
      t1ClauseIdx: {},
      t1Audit: {},
      // Test 2: Speak Full Story B1 -> B5 via 5 Mic stations
      t2ActiveStation: 1,
      t2Results: {},
      t2TypeMode: {},
      t2ShowHints: {},
      t2RecordingStation: null,
      t2ProcessingStation: null,
      // Test 3: Guided Steering Mindmap (5-block Miro canvas with Writing-style ghost text)
      t3Idx: 0,
      t3Drafts: {}, // `${mapId}_${nodeId}` -> text
      t3Locked: {},
      t3ClauseIdx: {},
      t3Audit: {},  // mapId -> { pass, nodeAudit: { b12, b3, b5 } }
      // Test 4: Concrete IELTS Part 2 Exam Cue Card (60s prep -> 2m speak -> result)
      t4CueIdx: 0,
      t4Phase: 'prep', // 'prep' (60s) -> 'speak' (120s) -> 'result'
      t4PrepNote: '',
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
        const lbl = el.querySelector('span') || el;
        lbl.textContent = fmtMmSs(examState.secsLeft);
        el.classList.toggle('urgent', examState.secsLeft <= 15);
      }
      const ringTimeEl = document.getElementById('sp-t4-ring-time');
      if (ringTimeEl) ringTimeEl.textContent = fmtMmSs(examState.secsLeft);
      const ringArcEl = document.getElementById('sp-t4-ring-arc');
      if (ringArcEl && examState.stage === 4) {
        const totalSec = examState.t4Phase === 'prep' ? 60 : 120;
        const dialCirc = 314.16;
        const dialOff = (dialCirc * (1 - Math.max(0, Math.min(1, examState.secsLeft / totalSec)))).toFixed(1);
        ringArcEl.setAttribute('stroke-dashoffset', dialOff);
      }
      if (examState.secsLeft <= 0) {
        clearInterval(examState.timerId);
        if (examState.stage === 4 && examState.t4Phase === 'prep') {
          beginT4Speaking();
        } else if (examState.stage === 4 && examState.t4Phase === 'speak' && examState.t4Recording) {
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
    if (nextStage === 4) {
      examState.t4Phase = 'prep';
      examState.t4Finalized = false;
    }
    examState.secsLeft = getStageLimitSec(nextStage, examState.t4Phase);
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

  function jumpExamStage(stageNum) {
    if (!examState) return;
    const target = Math.max(1, Math.min(4, Number(stageNum) || 1));
    if (target === examState.stage) return;
    const prevDone = getTaskDoneMap()[examState.story?.id]?.maxStage || 0;
    const maxUnlocked = Math.max(examState.stage, prevDone + 1);
    if (!isTeacherBypass() && target > maxUnlocked) {
      toast(`Hãy hoàn thành Bước ${maxUnlocked} trước để mở khóa Bước ${target}!`);
      return;
    }
    STT()?.abort?.();
    examState.stage = target;
    if (target === 4) {
      examState.t4Phase = 'prep';
      examState.t4Finalized = false;
    }
    examState.secsLeft = getStageLimitSec(target, examState.t4Phase);
    startExamTimer();
    renderExamModal();
  }

  /* --- Test 1 & Test 3 Helpers: Shared Ghost-Text Inline Typing (100% Writing Parity!) --- */
  const spCaretTimers = new WeakMap();
  function splitClauses(viText) {
    const parts = String(viText || '').split(/(?<=[.;?!])\s+/).filter(Boolean);
    return parts.length ? parts : [String(viText || '')];
  }
  function buildClauseList(viText, paragraphs) {
    if (Array.isArray(paragraphs) && paragraphs.length) {
      const list = [];
      paragraphs.forEach((p, pIdx) => {
        splitClauses(p).forEach((cl, cIdx) => {
          list.push({ text: cl, paraBreak: pIdx > 0 && cIdx === 0 });
        });
      });
      return list.length ? list : [{ text: String(viText || ''), paraBreak: false }];
    }
    return splitClauses(viText).map((cl) => ({ text: cl, paraBreak: false }));
  }
  function getT1LinearNodes(story) {
    const g0 = (story?.mindmapGroups || [])[0] || {};
    const stages = story?.stages || [];
    const b4Paras = stages.map((s) => s.textVi).filter(Boolean);
    const b4Kws = Array.from(new Set(stages.flatMap((s) => s.keywords || [])));
    return [
      {
        id: 'B1_B2',
        block: 'b12',
        code: 'MỞ BÀI & NHẬN DIỆN NHÂN VẬT',
        textVi: g0.b12Vi || 'Ông ngoại tôi là một giáo viên Toán đã nghỉ hưu ngoài 70 tuổi, có mái tóc bạc và nụ cười ấm áp, đã dành 30 năm truyền cảm hứng cho học trò.',
        keywords: ['grandfather', 'retired', 'maths', 'teacher', 'seventies', 'smile', 'thirty']
      },
      {
        id: 'B3',
        block: 'b3',
        code: 'DẪN CHUYỆN BẺ LÁI',
        textVi: g0.b3Vi || 'Ông là hình mẫu lý tưởng và là người tôi luôn muốn trở thành.',
        keywords: ['role model', 'admire', 'respect', 'calm', 'like', 'become', 'patience']
      },
      {
        id: 'B4',
        block: 'b4',
        code: 'CỐT TRUYỆN HÀNH ĐỘNG',
        textVi: b4Paras.join(' '),
        paragraphs: b4Paras,
        keywords: b4Kws
      },
      {
        id: 'B5',
        block: 'b5',
        code: 'KẾT BÀI CHỐT ĐÚNG ĐỀ',
        textVi: g0.b5Vi || 'Nhìn lại, tôi luôn mong noi theo tấm gương của ông bằng cách giữ bình tĩnh và lắng nghe cẩn thận mỗi khi giúp đỡ hay làm việc cùng người khác.',
        keywords: ['looking back', 'follow', 'example', 'calm', 'listening', 'help', 'work']
      }
    ];
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

  function safeDomId(id) {
    return String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // Reusable Writing-parity Ghost-Text Inline Binder for BOTH Test 1 & Test 3!
  function bindGhostFlowCells(opts) {
    const { items, draftsMap, lockedMap, clauseIdxMap, idPrefix, targetPhrases, onTelemetry, onAfterSync } = opts;
    const entries = [];
    const typoByKey = {};
    let focusedIdx = 0;

    const refreshAll = () => {
      let done = 0, words = 0, typos = 0;
      const litMap = {};
      entries.forEach((en) => {
        const val = en.ta.value.trim();
        if (val) words += countWords(val);
        const cIdx = Number(clauseIdxMap[en.key] || 0);
        const isDone = Boolean(lockedMap[en.key]) || (cIdx >= en.clauses.length && val.length > 0);
        if (isDone) { done++; litMap[en.key] = true; }
        typos += typoByKey[en.key] || 0;
      });
      if (onTelemetry) onTelemetry({ done, total: entries.length, words, typos, litMap });
    };

    const syncEntry = (en, isTyping) => {
      const val = en.ta.value;
      draftsMap[en.key] = val;
      const focused = document.activeElement === en.ta;
      if (focused) focusedIdx = en.idx;
      const locked = Boolean(lockedMap[en.key]);
      if (!val.trim() && !locked) clauseIdxMap[en.key] = 0;
      const activeIdx = locked ? en.clauses.length : Number(clauseIdxMap[en.key] || 0);

      const sel = focused ? (en.ta.selectionStart ?? val.length) : val.length;
      const before = val.slice(0, sel);
      const after = val.slice(sel);
      const m1 = renderSpT1Mirror(before, after.length === 0, targetPhrases);
      const m2 = renderSpT1Mirror(after, true, targetPhrases);
      typoByKey[en.key] = m1.typos + m2.typos;

      // Exact Writing "chữ ma" (Vietnamese ghost text inline inside the same box — supports multi-paragraph B4!)
      let viHtml = '';
      if (activeIdx < en.clauses.length) {
        const activeObj = en.clauses[activeIdx];
        const gap = val.length > 0
          ? (activeObj.paraBreak ? '<span class="sp-t1-pbreak"></span>' : (!/\s$/.test(val) ? '<span class="ws-t1-gap"></span>' : '<span class="ws-t1-pad"></span>'))
          : '';
        const activeTxt = `<span class="ws-t1-vi-active">${esc(activeObj.text)}</span>`;
        const restParts = en.clauses.slice(activeIdx + 1).map((c) => {
          const sep = c.paraBreak ? '<span class="sp-t1-pbreak"></span>' : ' ';
          return `${sep}<span class="ws-t1-vi-upcoming">${esc(c.text)}</span>`;
        }).join('');
        viHtml = `${gap}${activeTxt}${restParts}`;
      }

      en.mirror.innerHTML = `${m1.html}<span class="sp-t1-anchor"></span>${m2.html}${viHtml}`;
      en.ta.style.height = 'auto';
      en.ta.style.height = `${Math.max(46, en.mirror.scrollHeight)}px`;

      const isDone = locked || (activeIdx >= en.clauses.length && val.trim().length > 0);
      en.cell.classList.toggle('is-focused', focused);
      en.cell.classList.toggle('is-done', isDone && !en.cell.classList.contains('is-bad'));
      requestAnimationFrame(() => {
        positionSpCaret(en.wrap, en.caret, focused && !locked, isTyping);
        if (onAfterSync) onAfterSync();
      });
      refreshAll();
    };

    const stepForward = (idx) => {
      const en = entries[idx];
      if (!en) return;
      const locked = Boolean(lockedMap[en.key]);
      let cIdx = Number(clauseIdxMap[en.key] || 0);
      if (!locked && en.ta.value.trim().length > 0 && cIdx < en.clauses.length) {
        if (cIdx < en.clauses.length - 1 && !/\s$/.test(en.ta.value)) {
          en.ta.value += ' ';
          en.ta.selectionStart = en.ta.selectionEnd = en.ta.value.length;
        }
        clauseIdxMap[en.key] = cIdx + 1;
        if (clauseIdxMap[en.key] >= en.clauses.length && countWords(en.ta.value) >= 5) {
          en.cell.classList.remove('is-bad');
        }
        syncEntry(en, true);
        if (clauseIdxMap[en.key] >= en.clauses.length && entries[idx + 1]) {
          entries[idx + 1].ta.focus();
        }
      } else if (entries[idx + 1]) {
        entries[idx + 1].ta.focus();
      }
    };

    const stepBackward = (idx) => {
      const en = entries[idx];
      if (!en) return;
      if (lockedMap[en.key]) {
        lockedMap[en.key] = false;
        clauseIdxMap[en.key] = Math.max(0, en.clauses.length - 1);
        syncEntry(en, true);
        en.ta.focus();
        return;
      }
      const cIdx = Number(clauseIdxMap[en.key] || 0);
      if (cIdx > 0) {
        clauseIdxMap[en.key] = cIdx - 1;
        syncEntry(en, true);
        en.ta.focus();
      } else if (entries[idx - 1]) {
        entries[idx - 1].ta.focus();
      }
    };

    items.forEach((it, idx) => {
      const sid = safeDomId(it.domKey || it.key);
      const cell = document.getElementById(`${idPrefix}-cell-${sid}`);
      const ta = document.getElementById(`${idPrefix}-ta-${sid}`);
      const mirror = document.getElementById(`${idPrefix}-mirror-${sid}`);
      const caret = document.getElementById(`${idPrefix}-caret-${sid}`);
      const wrap = cell?.querySelector('.sp-t1-input-wrap');
      if (!cell || !ta || !mirror || !caret || !wrap) return;
      const en = { key: it.key, idx, clauses: buildClauseList(it.viText, it.paragraphs), cell, ta, mirror, caret, wrap };
      entries.push(en);

      cell.addEventListener('click', () => ta.focus());
      ta.addEventListener('input', () => syncEntry(en, true));
      ta.addEventListener('focus', () => syncEntry(en, false));
      ta.addEventListener('blur', () => syncEntry(en, false));
      ta.addEventListener('keyup', (e) => {
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) syncEntry(en, false);
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); stepForward(idx); }
        else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); stepBackward(idx); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); stepForward(idx); }
      });
      syncEntry(en, false);
    });

    document.getElementById(`${idPrefix}-btn-next`)?.addEventListener('click', () => stepForward(focusedIdx));
    document.getElementById(`${idPrefix}-btn-prev`)?.addEventListener('click', () => stepBackward(focusedIdx));
    setTimeout(() => entries[0]?.ta?.focus(), 40);
  }

  function bindSpT1InlineFlow() {
    if (!examState || examState.stage !== 1) return;
    const nodes = getT1LinearNodes(examState.story);
    const allChunks = (examState.story.spokenChunks || []).map((c) => c.en);

    bindGhostFlowCells({
      items: nodes.map((n) => ({ key: n.id, domKey: n.id, viText: n.textVi, paragraphs: n.paragraphs })),
      draftsMap: examState.t1Drafts,
      lockedMap: examState.t1Locked,
      clauseIdxMap: examState.t1ClauseIdx,
      idPrefix: 'sp-t1',
      targetPhrases: allChunks,
      onTelemetry: ({ done, total, words, typos, litMap }) => {
        const doneEl = document.getElementById('sp-t1-stat-done');
        const wcEl = document.getElementById('sp-t1-stat-words');
        const errEl = document.getElementById('sp-t1-stat-typos');
        const errWrap = document.getElementById('sp-t1-stat-err-wrap');
        const ringEl = document.getElementById('sp-t1-ring-fg');
        if (doneEl) doneEl.textContent = `${done}/${total}`;
        if (wcEl) wcEl.textContent = String(words);
        if (errEl) errEl.textContent = String(typos);
        if (errWrap) errWrap.classList.toggle('is-err', typos > 0);
        if (ringEl) ringEl.style.strokeDashoffset = (44 * (1 - done / Math.max(1, total))).toFixed(1);

        document.getElementById('sp-t1-arr-1')?.classList.toggle('is-lit', Boolean(litMap['B1_B2']));
        document.getElementById('sp-t1-arr-2')?.classList.toggle('is-lit', Boolean(litMap['B3']));
        document.getElementById('sp-t1-arr-3')?.classList.toggle('is-lit', Boolean(litMap['B4']));
      }
    });
  }

  function bindSpT3InlineFlow() {
    if (!examState || examState.stage !== 3) return;
    const maps = examState.story.steerMindmaps || [];
    const cur = maps[examState.t3Idx];
    if (!cur) return;
    const allChunks = (examState.story.spokenChunks || []).map((c) => c.en);
    const targetPhrases = [...allChunks, ...(cur.nodes || []).flatMap((n) => n.keywords || [])];

    bindGhostFlowCells({
      items: (cur.nodes || []).map((nd) => ({
        key: `${cur.id}_${nd.id}`,
        domKey: `${cur.id}-${nd.id}`,
        viText: nd.guideVi
      })),
      draftsMap: examState.t3Drafts,
      lockedMap: examState.t3Locked,
      clauseIdxMap: examState.t3ClauseIdx,
      idPrefix: 'sp-t3',
      targetPhrases
    });
  }

  function checkTaskTest1() {
    if (!examState) return;
    const nodes = getT1LinearNodes(examState.story);
    const allChunks = (examState.story.spokenChunks || []).map((c) => c.en);
    let allOk = true;
    nodes.forEach((nd) => {
      const txt = String(examState.t1Drafts[nd.id] || '').trim();
      const ev = evaluateKeywords(txt, nd.keywords);
      const typos = detectTypos(txt, allChunks);
      const minW = nd.id === 'B4' ? 35 : (nd.id === 'B3' ? 5 : 6);
      const minH = nd.id === 'B4' ? 6 : (nd.id === 'B3' ? 1 : 2);
      const pass = ev.words >= minW && ev.hits.length >= minH && typos.length === 0;
      examState.t1Audit[nd.id] = { pass, words: ev.words, hits: ev.hits.length, typos };
      if (pass) examState.t1Locked[nd.id] = true;
      else allOk = false;
    });
    if (allOk) {
      toast('Xuất sắc! Bạn đã hoàn thành trọn Sơ đồ Story 01 (B1–B2 → B3 → B4 → B5) → Sang Test 2!');
      advanceExamStage(2);
    } else {
      toast('Một số ô chưa đủ ý hoặc còn lỗi chính tả (viền đỏ) — hãy bổ sung nhé!');
      renderExamModal();
    }
  }

  /* --- Test 2 Helpers: Speak Full Story B1 -> B5 (5 Mic Stations) --- */
  function selectT2Station(stationNum) {
    if (!examState) return;
    STT()?.abort?.();
    examState.t2RecordingStation = null;
    examState.t2ProcessingStation = null;
    const maxLen = (examState.story.speakStations || []).length || 5;
    examState.t2ActiveStation = Math.max(1, Math.min(maxLen, Number(stationNum) || 1));
    renderExamModal();
  }
  function toggleT2TypeMode(stationNum) {
    if (!examState) return;
    examState.t2TypeMode[stationNum] = !examState.t2TypeMode[stationNum];
    renderExamModal();
  }
  function submitT2Typed(stationNum) {
    if (!examState) return;
    const val = (document.getElementById(`sp-t2-ta-${stationNum}`)?.value || '').trim();
    if (!val) { toast(`Hãy nhập bản kể Tiếng Anh cho Trạm ${stationNum}!`); return; }
    gradeT2Station(stationNum, val, '');
  }
  function toggleT2Mic(stationNum) {
    if (!examState) return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      toast('Thiết bị không có Micro — chuyển sang gõ dự phòng cho trạm này.');
      examState.t2TypeMode[stationNum] = true;
      renderExamModal();
      return;
    }
    if (examState.t2RecordingStation === stationNum) {
      stt.stop();
      examState.t2RecordingStation = null;
      examState.t2ProcessingStation = stationNum;
      renderExamModal();
      return;
    }
    stt.abort();
    examState.t2RecordingStation = stationNum;
    examState.t2ProcessingStation = null;
    renderExamModal();
    stt.startRecording({
      mode: 'sentence',
      autoStopOnSilence: false,
      maxDurationMs: 50000,
      onLevel: ({ bars }) => updateWaveBars(`t2_${stationNum}`, bars),
      onProcessing: () => {
        if (!examState) return;
        examState.t2RecordingStation = null;
        examState.t2ProcessingStation = stationNum;
        renderExamModal();
      },
      onResult: (res) => {
        if (!examState) return;
        examState.t2RecordingStation = null;
        examState.t2ProcessingStation = null;
        if (res.silent || !res.text) {
          toast('Chưa nghe rõ giọng bạn — hãy nói gần Micro hơn nhé!');
          renderExamModal();
          return;
        }
        gradeT2Station(stationNum, res.text, res.audioUrl || '');
      },
      onError: (msg) => {
        if (!examState) return;
        examState.t2RecordingStation = null;
        examState.t2ProcessingStation = null;
        toast(String(msg || 'Lỗi thu âm Micro.'));
        renderExamModal();
      }
    });
  }
  function toggleT2Hint(stationNum) {
    if (!examState) return;
    examState.t2ShowHints = examState.t2ShowHints || {};
    examState.t2ShowHints[stationNum] = !examState.t2ShowHints[stationNum];
    renderExamModal();
  }

  function gradeT2Station(stationNum, text, audioUrl) {
    const stations = examState.story.speakStations || [];
    const st = stations.find((s) => s.station === stationNum);
    if (!st) return;
    const ev = evaluateKeywords(text, st.keywords);
    const pass = ev.words >= 10 && (ev.hits.length >= 2 || ev.ratio >= 0.25);
    examState.t2Results[stationNum] = { text, audioUrl, hits: ev.hits, misses: ev.misses, words: ev.words, pass };
    if (pass) {
      toast(`Đạt Trạm ${stationNum}/${stations.length} (${ev.hits.length}/${st.keywords.length} từ khóa)!`);
    }
    renderExamModal();
  }
  function checkTaskTest2() {
    if (!examState) return;
    const stations = examState.story.speakStations || [];
    const passedCnt = stations.filter((s) => examState.t2Results[s.station]?.pass).length;
    if (passedCnt >= stations.length) {
      toast('Tuyệt vời! Đã kể trôi chảy Story 01 (B1 → B5) → Sang Test 3 (Viết Mindmap Bẻ Lái)!');
      advanceExamStage(3);
    } else {
      toast(`Cần đạt đủ ${stations.length}/5 trạm nói (hiện tại ${passedCnt}/${stations.length}).`);
    }
  }

  /* --- Test 3 Helpers: Guided Steering Mindmap Writing (B1–B2 -> B3 -> [B4 locked] -> B5) --- */
  function selectT3Map(idx) {
    if (!examState) return;
    examState.t3Idx = idx;
    renderExamModal();
  }
  function saveT3Draft(mapId, nodeId, val) {
    if (!examState) return;
    examState.t3Drafts[`${mapId}_${nodeId}`] = val;
  }
  function gradeCurrentSteerMap() {
    if (!examState) return;
    const maps = examState.story.steerMindmaps || [];
    const cur = maps[examState.t3Idx];
    if (!cur) return;
    const allChunks = (examState.story.spokenChunks || []).map((c) => c.en);
    const nodeAudit = {};
    let allNodesOk = true;
    (cur.nodes || []).forEach((nd) => {
      const domKey = safeDomId(`${cur.id}-${nd.id}`);
      const el = document.getElementById(`sp-t3-ta-${domKey}`);
      const txt = String(el ? el.value : (examState.t3Drafts[`${cur.id}_${nd.id}`] || '')).trim();
      examState.t3Drafts[`${cur.id}_${nd.id}`] = txt;
      const ev = evaluateKeywords(txt, nd.keywords);
      const typos = detectTypos(txt, [...allChunks, ...(nd.keywords || [])]);
      const pass = ev.words >= 6 && ev.hits.length >= 1 && typos.length === 0;
      nodeAudit[nd.id] = { pass, words: ev.words, hits: ev.hits, typos };
      if (pass) examState.t3Locked[`${cur.id}_${nd.id}`] = true;
      else allNodesOk = false;
    });
    examState.t3Audit[cur.id] = { pass: allNodesOk, nodeAudit };
    if (allNodesOk) {
      toast(`Đạt Mindmap Bẻ Lái "${cur.tag}"! Đã mở mẫu Band 8.5 để bạn đối chiếu.`);
    } else {
      toast('Một số nút Bẻ Lái chưa đủ ý hoặc còn lỗi chính tả — hãy kiểm tra lại nhé!');
    }
    renderExamModal();
    requestAnimationFrame(() => {
      document.getElementById('sp-t3-model-box')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }
  function checkTaskTest3() {
    if (!examState) return;
    const maps = examState.story.steerMindmaps || [];
    const passedCnt = maps.filter((m) => examState.t3Audit[m.id]?.pass).length;
    if (passedCnt >= maps.length) {
      toast('Hoàn thành cả 3 Mindmap Bẻ Lái → Sang Test 4 (Nói đề thi thật 60s chuẩn bị + 2 phút nói)!');
      advanceExamStage(4);
    } else {
      toast(`Cần đạt đủ ${maps.length}/3 Mindmap Bẻ Lái (hiện đạt ${passedCnt}/${maps.length}).`);
    }
  }

  /* --- Test 4 Helpers: Concrete IELTS Part 2 Exam Cue Card (60s Prep -> 2m Speak -> Result) --- */
  function cycleT4Cue() {
    if (!examState || examState.t4Phase !== 'prep') return;
    const cues = examState.story.cueCards || [];
    if (!cues.length) return;
    examState.t4CueIdx = (examState.t4CueIdx + 1) % cues.length;
    examState.t4PrepNote = '';
    examState.secsLeft = 60;
    startExamTimer();
    renderExamModal();
  }
  function saveT4PrepNote(val) {
    if (examState) examState.t4PrepNote = val;
  }
  function beginT4Speaking() {
    if (!examState) return;
    examState.t4Phase = 'speak';
    examState.secsLeft = 120;
    startExamTimer();
    renderExamModal();
  }
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
      mode: 'speaking',
      autoStopOnSilence: false,
      maxDurationMs: 125000,
      onLevel: ({ bars }) => updateWaveBars('t4', bars),
      onProcessing: () => { if (examState) { examState.t4Recording = false; examState.t4Processing = true; renderExamModal(); } },
      onResult: (res) => {
        if (!examState) return;
        examState.t4Recording = false;
        examState.t4Processing = false;
        const dur = res.durationSec || Math.max(10, Math.round((Date.now() - examState.t4RecStartedAt) / 1000));
        if (res.silent || !res.text) { toast('Chưa thu được giọng nói — hãy thử lại hoặc dùng Gõ dự phòng!'); renderExamModal(); return; }
        finalizeTaskTest4(res.text, dur, res.audioUrl || '', {
          hasAudio: true,
          audioUrl: res.audioUrl || '',
          durationSec: dur,
          words: res.words || [],
          segments: res.segments || [],
        });
      },
      onError: (msg) => { if (examState) { examState.t4Recording = false; examState.t4Processing = false; toast(String(msg)); renderExamModal(); } }
    });
  }
  function submitT4Typed() {
    if (!examState) return;
    const val = (document.getElementById('sp-t4-ta')?.value || '').trim();
    if (countWords(val) < 40) { toast('Bài nói 2 phút cần tối thiểu 40 từ bao quát trọn Story 01!'); return; }
    const estDur = Math.min(120, Math.max(45, Math.round(countWords(val) / 2.2)));
    finalizeTaskTest4(val, estDur, '', { hasAudio: false, durationSec: estDur, words: [], segments: [] });
  }
  async function finalizeTaskTest4(text, durationSec, audioUrl, acoustic) {
    if (!examState) return;
    clearInterval(examState.timerId);
    const activeExamRef = examState;
    examState.t4Transcript = text;
    examState.t4AudioUrl = audioUrl;
    examState.t4Metrics = evaluateFullSpeech(text, durationSec);
    examState.t4Phase = 'result';
    examState.t4Finalized = true;
    examState.t4Grading = Boolean(window.IeltsGrader?.gradeSpeaking);
    examState.t4Report = null;
    renderExamModal();

    const cue = (examState.story.cueCards || [])[examState.t4CueIdx];
    let report = null;
    if (window.IeltsGrader?.gradeSpeaking) {
      try {
        report = await window.IeltsGrader.gradeSpeaking({
          cueTitle: cue?.title || examState.story.title || '',
          cueBullets: cue?.bullets || [],
          curriculumContext: (examState.story?.fullSpeech?.en || []).join(' '),
          curriculumKeywords: (examState.story?.spokenChunks || []).map((c) => c.en).join(' '),
          text,
          acoustic: acoustic || { hasAudio: Boolean(audioUrl), audioUrl, durationSec },
        });
      } catch (err) {
        console.warn('[SpeakingStudio] Test 4 IELTS grader error:', err);
      }
    }

    if (examState === activeExamRef) {
      examState.t4Grading = false;
      examState.t4Report = report;
    }

    const band = report ? report.overall : null;
    const map = getTaskDoneMap();
    map[activeExamRef.story.id] = {
      completed: true,
      maxStage: 4,
      band,
      criteria: report ? {
        fc: report.criteria.fc.band,
        lr: report.criteria.lr.band,
        gra: report.criteria.gra.band,
        pr: report.criteria.pr.band,
      } : null,
      updatedAt: Date.now(),
      metrics: {
        words: activeExamRef.t4Metrics.words,
        wpm: activeExamRef.t4Metrics.wpm,
        durationSec: activeExamRef.t4Metrics.durationSec,
        chunks: activeExamRef.t4Metrics.usedChunks.length
      }
    };
    saveTaskDoneMap(map);

    if (cue) {
      const hist = getPracHistory();
      hist.unshift({
        cueId: cue.id,
        cueTitle: cue.title,
        mode: 'exam',
        band,
        criteria: map[activeExamRef.story.id].criteria,
        durationSec: activeExamRef.t4Metrics.durationSec,
        wpm: activeExamRef.t4Metrics.wpm,
        words: activeExamRef.t4Metrics.words,
        chunksCount: activeExamRef.t4Metrics.usedChunks.length,
        fillerCount: activeExamRef.t4Metrics.fillerCount,
        at: Date.now()
      });
      savePracHistory(hist.slice(0, 40));
    }

    if (examState === activeExamRef) renderExamModal();
    toast(band != null
      ? `Hoàn thành Task 4 Bước · Speaking Band ${band.toFixed(1)}!`
      : 'Chúc mừng! Bạn đã hoàn thành trọn vẹn Task 4 Bước · Story 01!');
  }

  function launchCueCardFromTask() {
    const firstCue = (getStory()?.cueCards || [])[1] || (getStory()?.cueCards || [])[0];
    closeTaskExamModal();
    window.TotoroUI?.switchView?.('practice');
    if (firstCue) openPracticeRoom(firstCue.id, 'practice');
  }

  function renderExamModal() {
    if (!examState) return;
    const { story, stage } = examState;
    const card = document.getElementById('sp-task-exam-card');

    let bodyHtml = '';

    if (stage === 1) {
      const nodes = getT1LinearNodes(story);
      const ndB12 = nodes.find((n) => n.id === 'B1_B2');
      const ndB3 = nodes.find((n) => n.id === 'B3');
      const ndB4 = nodes.find((n) => n.id === 'B4');
      const ndB5 = nodes.find((n) => n.id === 'B5');

      const renderLinearCell = (nd, extraCls) => {
        if (!nd) return '';
        const sid = safeDomId(nd.id);
        const aud = examState.t1Audit[nd.id];
        const isBad = aud && !aud.pass;
        const locked = Boolean(examState.t1Locked[nd.id]);
        return `
          <div class="sp-t1-cell ${extraCls} ${isBad ? 'is-bad' : (locked ? 'is-done' : '')}" id="sp-t1-cell-${sid}">
            <div class="sp-t1-cell-head">
              <span class="sp-t1-step-lbl">${esc(nd.code)}</span>
              ${aud ? `<span class="sp-t1-badge ${aud.pass ? 'ok' : 'bad'}">${aud.pass ? '✓ Đạt' : (aud.typos.length ? `Lỗi: ${esc(aud.typos[0])}` : 'Cần đủ ý')}</span>` : ''}
            </div>
            <div class="sp-t1-input-wrap">
              <div class="sp-t1-mirror" id="sp-t1-mirror-${sid}" aria-hidden="true"></div>
              <div class="sp-t1-caret" id="sp-t1-caret-${sid}" aria-hidden="true"></div>
              <textarea class="sp-t1-ta" id="sp-t1-ta-${sid}" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">${esc(examState.t1Drafts[nd.id] || '')}</textarea>
            </div>
          </div>
        `;
      };

      const renderLinArrow = (id, tag) => `
        <div class="sp-t1-lin-arrow" id="${id}" aria-hidden="true">
          ${tag ? `<span class="sp-mm-arrow-tag">${esc(tag)}</span>` : ''}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </div>
      `;

      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 1 · Viết Sơ Đồ Story 01</div>
            <div class="ws-t1-stage-sub">Gõ Tiếng Anh ngay trên chữ ma Tiếng Việt trong cùng 1 ô — dịch xong từng ý nhấn <strong>Tab</strong> hoặc <strong>Enter</strong> để ẩn và chuyển tiếp.</div>
          </div>
          <div class="ws-t1-telemetry">
            <div class="ws-t1-stat is-accent">
              <svg class="ws-t1-ring" viewBox="0 0 18 18" aria-hidden="true">
                <circle class="ws-t1-ring-bg" cx="9" cy="9" r="7"/>
                <circle class="ws-t1-ring-fg" id="sp-t1-ring-fg" cx="9" cy="9" r="7"/>
              </svg>
              <strong id="sp-t1-stat-done">0/${nodes.length}</strong><span>ô</span>
            </div>
            <div class="ws-t1-stat"><strong id="sp-t1-stat-words">0</strong><span>từ</span></div>
            <div class="ws-t1-stat" id="sp-t1-stat-err-wrap"><strong id="sp-t1-stat-typos">0</strong><span>lỗi</span></div>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.checkTaskTest1()">Kiểm tra &amp; Sang Test 2 →</button>
          </div>
        </div>

        <div class="sp-t1-miro-stage">
          <div class="sp-t1-linear-flow">
            ${renderLinearCell(ndB12, 'sp-t1-lin-card is-b12')}
            ${renderLinArrow('sp-t1-arr-1', '')}
            ${renderLinearCell(ndB3, 'sp-t1-lin-card is-b3')}
            ${renderLinArrow('sp-t1-arr-2', 'KỂ TIẾP')}
            ${renderLinearCell(ndB4, 'sp-t1-lin-card is-b4')}
            ${renderLinArrow('sp-t1-arr-3', 'CHỐT BÀI')}
            ${renderLinearCell(ndB5, 'sp-t1-lin-card is-b5')}
          </div>
        </div>

        <div class="ws-t1-footer">
          <span class="ws-t1-footer-note">Tự do paraphrase tự nhiên — chữ ma Tiếng Việt giữ nguyên lúc gõ và chỉ ẩn khi bạn bấm Tab.</span>
          <div class="ws-t1-kb-group">
            <button type="button" class="ws-t1-kb-btn is-primary" id="sp-t1-btn-next">Xong ý này <kbd>Tab</kbd></button>
            <button type="button" class="ws-t1-kb-btn" id="sp-t1-btn-prev">Hiện lại / Lùi ô <kbd>Shift</kbd>+<kbd>Tab</kbd></button>
          </div>
        </div>
      `;
    } else if (stage === 2) {
      const stations = story.speakStations || [];
      const passedCnt = stations.filter((s) => examState.t2Results[s.station]?.pass).length;
      const activeNum = Math.max(1, Math.min(stations.length, examState.t2ActiveStation || 1));
      const st = stations.find((s) => s.station === activeNum) || stations[0];
      const res = st ? examState.t2Results[st.station] : null;
      const isRec = examState.t2RecordingStation === st?.station;
      const isProc = examState.t2ProcessingStation === st?.station;
      const isType = Boolean(examState.t2TypeMode[st?.station]);

      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 2 · Kể Lại Trọn Story 01 Qua Mic</div>
            <div class="ws-t1-stage-sub">Đi mượt qua <strong>5 trạm kể chuyện</strong>, nhìn tranh &amp; mạch ý rồi kể lại bằng Tiếng Anh.</div>
          </div>
          <div class="ws-t1-telemetry">
            <span class="sp-pill ${passedCnt === stations.length ? 'ok' : ''} tabular">${passedCnt} / ${stations.length} trạm đạt</span>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.checkTaskTest2()">Sang Test 3 · Mindmap Bẻ Lái →</button>
          </div>
        </div>

        <div class="sp-stepper-5">
          ${stations.map((s) => {
            const p = examState.t2Results[s.station]?.pass;
            const cur = s.station === st.station;
            return `
              <button type="button" class="sp-stepper-btn ${cur ? 'is-active' : ''} ${p ? 'is-pass' : ''}" onclick="SpeakingStudio.selectT2Station(${s.station})">
                <span class="sp-stepper-num">${p ? '✓' : esc(s.code)}</span>
                <span class="sp-stepper-lbl">${esc(s.titleVi)}</span>
              </button>
            `;
          }).join('')}
        </div>

        <div class="sp-studio-2col">
          <div class="sp-studio-story-pane">
            ${st.sceneImg ? `
              <div class="sp-studio-scene">
                <img src="${esc(st.sceneImg)}" alt="${esc(st.titleVi)}">
              </div>
            ` : ''}
            <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
              <span class="ws-task-code">TRẠM ${st.station} / ${stations.length} · ${esc(st.code)}</span>
              <span class="ws-pill ${res?.pass ? 'ok' : ''}">${res?.pass ? 'Đạt ✓' : 'Chưa chấm'}</span>
            </div>
            <div class="sp-studio-stage-title">${esc(st.titleVi)}</div>
            <div class="sp-studio-stage-vi">${esc(st.textVi)}</div>
            ${st.keywords?.length ? `
              <div class="sp-t2-hint-wrap">
                <button type="button" class="btn-reading-tip ${examState.t2ShowHints?.[st.station] ? 'is-active' : ''}" onclick="SpeakingStudio.toggleT2Hint(${st.station})">
                  ${examState.t2ShowHints?.[st.station] ? 'Ẩn gợi ý từ khóa' : 'Gợi ý Spoken Chunks'}
                </button>
                ${examState.t2ShowHints?.[st.station] ? `
                  <div class="sp-kw-row" style="margin-top:8px;">
                    ${st.keywords.map((kw) => `<span class="sp-kw-chip">${esc(kw)}</span>`).join('')}
                  </div>
                ` : ''}
              </div>
            ` : ''}
            <div class="sp-studio-nav-row">
              <button type="button" class="btn" ${st.station <= 1 ? 'disabled' : ''} onclick="SpeakingStudio.selectT2Station(${st.station - 1})">← Trạm trước</button>
              <button type="button" class="btn" ${st.station >= stations.length ? 'disabled' : ''} onclick="SpeakingStudio.selectT2Station(${st.station + 1})">Trạm tiếp →</button>
            </div>
          </div>

          <div class="sp-studio-mic-pane ${res?.pass ? 'is-pass' : ''}">
            <div class="sp-studio-mic-head">
              <div>
                <div style="font-size:14.5px;font-weight:800;color:var(--ink);">Bàn Thu Âm · ${esc(st.code)}</div>
                <div style="font-size:12px;color:var(--ink-2);">${res?.pass ? `✓ Đạt chuẩn (${res.hits.length}/${st.keywords.length} từ khóa)` : 'Bấm Mic và kể lại tự nhiên bằng Tiếng Anh'}</div>
              </div>
              <button type="button" class="btn" style="padding:5px 10px;font-size:12px;" onclick="SpeakingStudio.toggleT2TypeMode(${st.station})">
                ${isType ? 'Dùng Mic' : 'Gõ dự phòng'}
              </button>
            </div>

            ${isType ? `
              <textarea class="sp-note-ta" id="sp-t2-ta-${st.station}" style="min-height:132px;" placeholder="Gõ bản kể Tiếng Anh cho trạm ${esc(st.code)}...">${esc(res?.text || '')}</textarea>
              <div style="display:flex;justify-content:flex-end;">
                <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitT2Typed(${st.station})">Chấm trạm ${esc(st.code)} →</button>
              </div>
            ` : `
              <div class="sp-mic-stage ${isRec ? 'is-rec' : ''}" style="flex:1;justify-content:center;">
                <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="t2_${st.station}"></span>`).join('')}</div>
                <button type="button" class="sp-mic-btn ${isRec ? 'is-recording' : ''}" ${isProc ? 'disabled' : ''} onclick="SpeakingStudio.toggleT2Mic(${st.station})">
                  <span>${isProc ? 'Đang chấm giọng...' : (isRec ? 'Dừng & Chấm trạm này' : (res ? 'Thu âm lại trạm này' : 'Bấm Mic kể trạm này'))}</span>
                </button>
                <div style="font-size:12.5px;color:var(--ink-2);">${isRec ? 'Đang thu âm — nói xong bấm dừng để AI chấm...' : 'Giữ nhịp nói tự nhiên, rõ ràng.'}</div>
              </div>
            `}

            ${res ? `
              <div class="sp-transcript-box" style="font-size:13.5px;">
                <div><strong>Bản kể của bạn (${res.words} từ):</strong> ${esc(res.text)}</div>
                ${res.audioUrl ? `<audio class="sp-audio-replay" style="margin-top:8px;" controls src="${esc(res.audioUrl)}"></audio>` : ''}
                <div class="sp-kw-row" style="margin-top:8px;">
                  ${st.keywords.map((kw) => `<span class="sp-kw-chip ${res.hits.includes(kw) ? 'hit' : ''}">${res.hits.includes(kw) ? '✓ ' : ''}${esc(kw)}</span>`).join('')}
                </div>
                ${res.pass ? `
                  <div style="display:flex;justify-content:flex-end;margin-top:10px;">
                    ${st.station < stations.length
                      ? `<button type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;" onclick="SpeakingStudio.selectT2Station(${st.station + 1})">Sang trạm ${st.station + 1} →</button>`
                      : `<button type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;" onclick="SpeakingStudio.checkTaskTest2()">Hoàn tất · Sang Test 3 →</button>`}
                  </div>
                ` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (stage === 3) {
      const maps = story.steerMindmaps || [];
      const cur = maps[examState.t3Idx] || maps[0];
      const audit = cur ? examState.t3Audit[cur.id] : null;
      const passedCnt = maps.filter((m) => examState.t3Audit[m.id]?.pass).length;
      const ndB12 = cur?.nodes?.find((n) => n.id === 'b12');
      const ndB3 = cur?.nodes?.find((n) => n.id === 'b3');
      const ndB5 = cur?.nodes?.find((n) => n.id === 'b5');

      const renderSteerNode = (nd) => {
        if (!nd) return '';
        const key = `${cur.id}_${nd.id}`;
        const domKey = safeDomId(`${cur.id}-${nd.id}`);
        const val = examState.t3Drafts[key] || '';
        const na = audit?.nodeAudit?.[nd.id];
        const cls = na ? (na.pass ? 'is-done' : 'is-bad') : (examState.t3Locked[key] ? 'is-done' : '');
        return `
          <div class="sp-t1-cell sp-steer-node ${cls}" id="sp-t3-cell-${domKey}">
            <div class="sp-t1-cell-head">
              <span class="sp-t1-step-lbl">${esc(nd.code)}</span>
              ${na ? `<span class="sp-t1-badge ${na.pass ? 'ok' : 'bad'}">${na.pass ? '✓ Đạt' : (na.typos.length ? `Lỗi: ${esc(na.typos[0])}` : 'Cần đủ ý')}</span>` : ''}
            </div>
            <div class="sp-t1-input-wrap">
              <div class="sp-t1-mirror" id="sp-t3-mirror-${domKey}" aria-hidden="true"></div>
              <div class="sp-t1-caret" id="sp-t3-caret-${domKey}" aria-hidden="true"></div>
              <textarea class="sp-t1-ta" id="sp-t3-ta-${domKey}" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off">${esc(val)}</textarea>
            </div>
          </div>
        `;
      };

      const steerArrow = (tag) => `
        <div class="sp-steer-arrow-col" aria-hidden="true">
          ${tag ? `<span class="sp-mm-arrow-tag">${esc(tag)}</span>` : ''}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>
        </div>
      `;
      const b4ShortList = (story.stages || []).map((s) => `<li><strong>${esc(s.code)}</strong> ${esc(s.titleVi)}</li>`).join('');

      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 3 · Tự Viết Mindmap Bẻ Lái Có Hướng Dẫn</div>
            <div class="ws-t1-stage-sub">Giữ nguyên <strong>Cốt truyện khóa sẵn</strong> — tự viết Tiếng Anh vào 3 ô <strong>Mở bài, Dẫn chuyện, Kết bài</strong> để khớp từng đề thi.</div>
          </div>
          <div class="ws-t1-telemetry">
            <span class="sp-pill ${passedCnt === maps.length ? 'ok' : ''} tabular">${passedCnt} / ${maps.length} đề đạt</span>
            <button type="button" class="btn btn-primary" onclick="SpeakingStudio.checkTaskTest3()">Sang Test 4 · Đề Thi Thật →</button>
          </div>
        </div>

        <div class="sp-stepper-3">
          ${maps.map((m, idx) => `
            <button type="button" class="sp-stepper-btn ${idx === examState.t3Idx ? 'is-active' : ''} ${examState.t3Audit[m.id]?.pass ? 'is-pass' : ''}" onclick="SpeakingStudio.selectT3Map(${idx})">
              <span class="sp-stepper-num">${examState.t3Audit[m.id]?.pass ? '✓' : `0${idx + 1}`}</span>
              <span class="sp-stepper-lbl">${esc(m.tag)}</span>
            </button>
          `).join('')}
        </div>

        ${cur ? `
          <div class="sp-steer-miro-board">
            <div class="sp-steer-flow-5">
              <!-- KHỐI 1: ĐỀ THI ÁP DỤNG -->
              <div class="sp-steer-node is-cue">
                <div class="sp-t1-cell-head">
                  <span class="sp-t1-step-lbl">ĐỀ THI ÁP DỤNG</span>
                  <span class="sp-t1-badge ok">${esc(cur.tag.split('·')[0].trim())}</span>
                </div>
                <div style="font-size:14px;font-weight:800;color:var(--ink);line-height:1.38;">${esc(cur.cueTitle)}</div>
                <ul class="sp-steer-cue-list">
                  ${(cur.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}
                </ul>
              </div>

              ${steerArrow('')}
              ${renderSteerNode(ndB12)}
              ${steerArrow('')}
              ${renderSteerNode(ndB3)}
              ${steerArrow('KỂ TIẾP')}

              <!-- KHỐI 4: CỐT TRUYỆN HÀNH ĐỘNG (KHÓA SẴN) -->
              <div class="sp-steer-node is-locked">
                <div class="sp-t1-cell-head">
                  <span class="sp-t1-step-lbl">CỐT TRUYỆN LÕI</span>
                  <span class="sp-t1-badge ok">Khóa sẵn</span>
                </div>
                <ul class="sp-steer-b4-list">${b4ShortList}</ul>
              </div>

              ${steerArrow('CHỐT BÀI')}
              ${renderSteerNode(ndB5)}
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;">
            <span style="font-size:12.5px;color:var(--ink-2);">Tự viết 3 ô Mở bài, Dẫn chuyện, Kết bài rồi bấm Kiểm tra để đối chiếu ngay với mẫu Band 8.5.</span>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${audit ? `<button type="button" class="btn" onclick="SpeakingStudio.openMindmapModal('master')">Mở Mindmap Tổng Thể</button>` : ''}
              ${examState.t3Idx < maps.length - 1 && audit?.pass ? `<button type="button" class="btn" onclick="SpeakingStudio.selectT3Map(${examState.t3Idx + 1})">Sang đề bẻ lái tiếp →</button>` : ''}
              <button type="button" class="btn btn-primary" onclick="SpeakingStudio.gradeCurrentSteerMap()">Kiểm tra Mindmap Bẻ Lái →</button>
            </div>
          </div>

          ${audit ? `
            <div class="ws-recall-model-box" id="sp-t3-model-box" style="border-left-color:${audit.pass ? 'var(--ok)' : 'var(--accent)'};">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                <strong style="font-size:12.5px;color:var(--accent);text-transform:uppercase;">Mẫu Mindmap Bẻ Lái Band 8.5 · ${esc(cur.tag)}</strong>
                <button type="button" class="btn-voice-speak" style="width:auto;padding:0 10px;" onclick="SpeakingStudio.speakRaw('${esc([ndB12?.refEn, ndB3?.refEn, ndB5?.refEn].filter(Boolean).join(' ')).replace(/'/g, "\\'")}', 'en-GB')"><span>Nghe cả 3</span></button>
              </div>
              <div class="sp-t3-ref-row"><div><strong>Mở bài:</strong> ${esc(ndB12?.refEn || '')}</div><button type="button" class="btn-voice-speak sp-ex-audio-btn" onclick="SpeakingStudio.speakRaw('${esc(ndB12?.refEn || '').replace(/'/g, "\\'")}', 'en-GB')" title="Nghe Mở bài (UK)"><span>UK</span></button></div>
              <div class="sp-t3-ref-row"><div><strong>Dẫn chuyện:</strong> ${esc(ndB3?.refEn || '')}</div><button type="button" class="btn-voice-speak sp-ex-audio-btn" onclick="SpeakingStudio.speakRaw('${esc(ndB3?.refEn || '').replace(/'/g, "\\'")}', 'en-GB')" title="Nghe Dẫn chuyện (UK)"><span>UK</span></button></div>
              <div class="sp-t3-ref-row"><div><strong>Kết bài:</strong> ${esc(ndB5?.refEn || '')}</div><button type="button" class="btn-voice-speak sp-ex-audio-btn" onclick="SpeakingStudio.speakRaw('${esc(ndB5?.refEn || '').replace(/'/g, "\\'")}', 'en-GB')" title="Nghe Kết bài (UK)"><span>UK</span></button></div>
            </div>
          ` : ''}
        ` : ''}
      `;
    } else {
      const cues = story.cueCards || [];
      const curCue = cues[examState.t4CueIdx] || cues[0];
      const phase = examState.t4Phase;
      const m = examState.t4Metrics;
      const fs = story.fullSpeech || { en: [], vi: [] };
      const totalSec = phase === 'prep' ? 60 : 120;
      const dialCirc = 314.16;
      const dialOff = (dialCirc * (1 - Math.max(0, Math.min(1, examState.secsLeft / totalSec)))).toFixed(1);

      bodyHtml = `
        <div class="ws-t1-stage-head">
          <div>
            <div class="ws-t1-stage-title">Test 4 · Thực Chiến 1 Đề Cụ Thể (60s Chuẩn Bị → 2 Phút Nói)</div>
            <div class="ws-t1-stage-sub">
              ${phase === 'prep'
                ? '<strong>Giai đoạn 1 / 2 · Chuẩn bị 60 giây:</strong> Đọc kỹ Cue Card bên trái và ghi nhanh từ khóa dàn ý.'
                : (phase === 'speak'
                  ? '<strong>Giai đoạn 2 / 2 · Nói liên tục 2 phút:</strong> Bấm Mic và trình bày trọn bài (B1 → B5) theo ghi chú của bạn.'
                  : '<strong>Hoàn thành bài nói Part 2!</strong> Xem chỉ số, nghe lại giọng nói và đối chiếu bài mẫu.')}
            </div>
          </div>
          <div class="ws-t1-telemetry">
            ${phase === 'prep' ? `<button type="button" class="btn" style="padding:6px 11px;font-size:12px;" onclick="SpeakingStudio.cycleT4Cue()">Đổi đề khác</button>` : ''}
            ${phase === 'speak' ? `<button type="button" class="btn" style="padding:6px 11px;font-size:12px;" onclick="SpeakingStudio.toggleT4TypeMode()">${examState.t4TypeMode ? 'Dùng Mic' : 'Gõ dự phòng'}</button>` : ''}
            ${phase === 'result' ? `
              <button type="button" class="btn btn-primary" onclick="SpeakingStudio.launchCueCardFromTask()">Luyện thêm 14 Cue Cards →</button>
              <button type="button" class="btn" onclick="SpeakingStudio.closeTaskExamModal()">Hoàn tất Task ✓</button>
            ` : ''}
          </div>
        </div>

        ${phase !== 'result' && curCue ? `
          <div class="sp-studio-2col">
            <div class="sp-cue-paper" style="padding:20px 22px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;">
                <span style="font-size:11px;font-weight:800;letter-spacing:0.06em;text-transform:uppercase;color:var(--accent);">IELTS Speaking · Part 2 Cue Card</span>
                <span class="sp-pill ${phase === 'prep' ? '' : 'ok'}">${phase === 'prep' ? '60s chuẩn bị' : '2 phút nói'}</span>
              </div>
              <div class="sp-cue-paper-title" style="font-size:19px;">${esc(curCue.title)}</div>
              <div style="font-size:13.5px;font-weight:700;opacity:0.82;">You should say:</div>
              <ul class="sp-cue-paper-list" style="font-size:14px;">
                ${(curCue.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}
              </ul>
              ${phase === 'speak' && examState.t4PrepNote.trim() ? `
                <div style="padding:11px 14px;border-radius:11px;background:var(--surface-item);border:1px dashed var(--border-strong);font-size:13px;line-height:1.55;white-space:pre-line;">
                  <strong>Ghi chú 60 giây của bạn:</strong>\n${esc(examState.t4PrepNote)}
                </div>
              ` : `
                <div style="font-size:12.5px;color:var(--ink-3);padding-top:10px;border-top:1px dashed var(--border-strong);">
                  You will have to talk about the topic for <strong>1 to 2 minutes</strong>. You have <strong>1 minute</strong> to think about what you are going to say.
                </div>
              `}
            </div>

            <div class="sp-studio-mic-pane">
              <div class="sp-t4-clock-inline">
                <div class="sp-t4-ring-wrap" style="width:108px;height:108px;">
                  <svg viewBox="0 0 120 120" class="sp-t4-ring-svg" aria-hidden="true">
                    <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-subtle)" stroke-width="8"/>
                    <circle id="sp-t4-ring-arc" class="sp-ring-arc" cx="60" cy="60" r="50" fill="none" stroke="${examState.t4Recording ? 'var(--danger)' : 'var(--accent)'}" stroke-width="8" stroke-linecap="round" stroke-dasharray="${dialCirc}" stroke-dashoffset="${dialOff}"/>
                  </svg>
                  <div class="sp-t4-ring-center">
                    <div class="sp-t4-ring-time tabular" id="sp-t4-ring-time" style="font-size:22px;">${fmtMmSs(examState.secsLeft)}</div>
                    <div class="sp-t4-ring-sub">${phase === 'prep' ? 'Chuẩn bị' : (examState.t4Recording ? 'Đang thu' : 'Nói 2 phút')}</div>
                  </div>
                </div>
                <div style="flex:1;min-width:160px;">
                  <div style="font-size:15px;font-weight:800;color:var(--ink);">${phase === 'prep' ? 'Giai đoạn 1 · Chuẩn bị 60 giây' : 'Giai đoạn 2 · Trình bày 2 phút'}</div>
                  <div style="font-size:12.5px;color:var(--ink-2);line-height:1.5;margin-top:3px;">
                    ${phase === 'prep'
                      ? 'Ghi nhanh các từ khóa chính trước khi vào phần nói 2 phút (hết 60s tự chuyển).'
                      : 'Nói liền mạch theo dàn ý bạn đã chuẩn bị, giữ nhịp tự nhiên 120–155 WPM.'}
                  </div>
                </div>
              </div>

              ${phase === 'prep' ? `
                <textarea class="sp-note-ta" id="sp-t4-prep-ta" style="min-height:150px;"
                  placeholder="Ghi chú từ khóa của bạn trong 60 giây chuẩn bị..."
                  oninput="SpeakingStudio.saveT4PrepNote(this.value)">${esc(examState.t4PrepNote)}</textarea>
                <div style="display:flex;justify-content:flex-end;">
                  <button type="button" class="btn btn-primary" onclick="SpeakingStudio.beginT4Speaking()">Bắt đầu nói 2 phút ngay →</button>
                </div>
              ` : (examState.t4TypeMode ? `
                <textarea class="sp-note-ta" id="sp-t4-ta" style="min-height:165px;" placeholder="Gõ bài nói Part 2 của bạn bằng Tiếng Anh...">${esc(examState.t4Transcript)}</textarea>
                <div style="display:flex;justify-content:flex-end;">
                  <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitT4Typed()">Nộp bài &amp; Xem chỉ số →</button>
                </div>
              ` : `
                <div class="sp-mic-stage ${examState.t4Recording ? 'is-rec' : ''}" style="flex:1;justify-content:center;">
                  <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="t4"></span>`).join('')}</div>
                  <button type="button" class="sp-mic-btn ${examState.t4Recording ? 'is-recording' : ''}" ${examState.t4Processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleT4Mic()">
                    <span>${examState.t4Processing ? 'Đang chấm bài nói...' : (examState.t4Recording ? 'Dừng & Nộp bài nói 2 phút' : 'Bấm Mic nói 2 phút')}</span>
                  </button>
                  <div style="font-size:12.5px;color:var(--ink-2);">Kết thúc bấm dừng để xem Thời lượng, WPM, Spoken Chunks &amp; nghe lại giọng.</div>
                </div>
              `)}
            </div>
          </div>
        ` : `
          ${examState.t4Grading
            ? (window.IeltsGrader?.renderLoadingHtml('Giám khảo IELTS Speaking AI đang chấm 4 tiêu chí FC / LR / GRA / PR & phân tích lỗi nói...') || '')
            : (examState.t4Report && window.IeltsGrader?.renderExaminerReportHtml
              ? window.IeltsGrader.renderExaminerReportHtml(examState.t4Report, { title: 'Kết quả chấm IELTS Speaking Part 2' })
              : '')}
          <div class="sp-metrics-grid">
            <div class="sp-metric-box"><div class="sp-metric-val">${fmtMmSs(m.durationSec)}</div><div class="sp-metric-lbl">Thời lượng (1:30–2:00)</div></div>
            <div class="sp-metric-box"><div class="sp-metric-val">${m.wpm}</div><div class="sp-metric-lbl">Tốc độ nói (WPM)</div></div>
            <div class="sp-metric-box"><div class="sp-metric-val">${m.usedChunks.length}</div><div class="sp-metric-lbl">Spoken Chunks đã dùng</div></div>
            <div class="sp-metric-box"><div class="sp-metric-val">${m.fillerCount}</div><div class="sp-metric-lbl">Từ đệm (um/uh/like)</div></div>
          </div>

          <div class="sp-studio-2col">
            <div class="sp-transcript-box" style="display:flex;flex-direction:column;gap:10px;">
              <div><strong>Bài nói của bạn (${m.words} từ · ${m.stageHits}/5 phần):</strong></div>
              <div style="font-size:13.8px;line-height:1.65;">${esc(examState.t4Transcript)}</div>
              ${examState.t4AudioUrl ? `<audio class="sp-audio-replay" style="max-width:100%;" controls src="${esc(examState.t4AudioUrl)}"></audio>` : ''}
              ${m.usedChunks.length ? `<div class="sp-kw-row">${m.usedChunks.map((c) => `<span class="sp-kw-chip hit">✓ ${esc(c)}</span>`).join('')}</div>` : ''}
            </div>

            <div class="ws-recall-model-box" style="max-height:330px;overflow-y:auto;">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
                <strong style="font-size:12.5px;color:var(--accent);text-transform:uppercase;">Bài Nói Mẫu Nguyên Bài · Story 01</strong>
                <button type="button" class="btn" style="padding:4px 10px;font-size:12px;" onclick="SpeakingStudio.speakRaw('${esc(fs.en.join(' ')).replace(/'/g, "\\'")}', 'en-GB')">Nghe toàn bài (UK)</button>
              </div>
              ${curCue ? `
                <div style="padding:8px 10px;border-radius:9px;background:var(--surface);border:1px solid var(--border);font-size:13px;">
                  <div><strong>Mở bài bẻ lái (B1–B3):</strong> ${esc(curCue.b13En)}</div>
                  <div style="margin-top:4px;"><strong>Chốt đề (B5):</strong> ${esc(curCue.b5En)}</div>
                </div>
              ` : ''}
              ${fs.en.map((para, i) => `
                <div style="padding:7px 0;border-top:${i > 0 ? '1px solid var(--border)' : 'none'};">
                  <div style="font-size:13.5px;line-height:1.6;color:var(--ink);">${esc(para)}</div>
                  ${fs.vi[i] ? `<div style="font-size:12.3px;line-height:1.5;color:var(--ink-2);margin-top:3px;">${esc(fs.vi[i])}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `}
      `;
    }

    const clockSvg = '<svg width="13.5" height="13.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';
    const examSteps = [
      { n: 1, label: 'Sơ đồ' },
      { n: 2, label: 'Kể Mic' },
      { n: 3, label: 'Bẻ lái' },
      { n: 4, label: 'Đề thi' }
    ];

    card.innerHTML = `
      <div class="sp-modal-head sp-task-hdr is-pro">
        <div class="sp-task-hdr-left">
          <button type="button" class="sp-task-exit-pill" onclick="SpeakingStudio.closeTaskExamModal()" aria-label="Thoát">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
            <span>Thoát</span>
          </button>
          <div class="sp-modal-title">Story 01 · Task 4 Bước</div>
        </div>
        <div class="sp-step-track" role="tablist" aria-label="Tiến trình 4 bước Speaking Task">
          ${(() => {
            const maxUnlocked = Math.max(stage, (getTaskDoneMap()[story?.id]?.maxStage || 0) + 1);
            const teacher = isTeacherBypass();
            return examSteps.map((s, idx) => {
              const locked = !teacher && s.n > maxUnlocked;
              return `
                ${idx > 0 ? '<span class="sp-step-conn" aria-hidden="true"></span>' : ''}
                <button type="button" role="tab" aria-selected="${stage === s.n ? 'true' : 'false'}"
                  aria-disabled="${locked ? 'true' : 'false'}"
                  class="sp-step-btn ${stage === s.n ? 'active' : (stage > s.n ? 'done' : '')} ${locked ? 'is-locked' : ''}"
                  onclick="SpeakingStudio.jumpExamStage(${s.n})">
                  <span class="sp-step-dot">${stage > s.n ? '✓' : s.n}</span>
                  <span>${s.label}</span>
                </button>
              `;
            }).join('');
          })()}
        </div>
        <div class="sp-task-hdr-right">
          <span class="rp-ac-shield" title="Chống gian lận đang bật trong bài kiểm tra">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span>Anti-Cheat</span>
          </span>
          <span class="sp-timer-pill tabular ${examState.secsLeft <= 15 && !examState.t4Finalized ? 'urgent' : ''}" id="sp-exam-timer">${clockSvg}<span>${examState.t4Finalized ? 'Hoàn tất' : fmtMmSs(examState.secsLeft)}</span></span>
        </div>
      </div>
      ${bodyHtml}
    `;
    if (stage === 1) bindSpT1InlineFlow();
    if (stage === 3) bindSpT3InlineFlow();
    card.scrollTop = 0;
  }

  /* ================= TAB 4: PRACTICE HUB (PART 1 · PART 2 · PART 3 · FULL TEST 14P) & EXAMINER ROOMS ================= */
  function normalizePracticePart(partNum) {
    if (String(partNum) === 'full') return 'full';
    const n = Number(partNum);
    return [1, 2, 3].includes(n) ? n : 1;
  }
  function setPracticePart(partNum) {
    state.pracPart = normalizePracticePart(partNum);
    state.pracCat = 'all';
    state.pracQuery = '';
    renderPracticeHub();
  }
  function openPracticePart(partNum) {
    state.pracPart = normalizePracticePart(partNum);
    state.pracCat = 'all';
    state.pracQuery = '';
    if (window.TotoroUI?.enterSkillMode) {
      window.TotoroUI.enterSkillMode('Speaking', 'practice');
    } else {
      renderPracticeHub();
    }
  }
  function setPracticeCat(cat) {
    state.pracCat = cat;
    renderPracticeHub();
  }
  function setPracticeQuery(q) {
    state.pracQuery = q;
    renderPracticeHub();
  }
  function resetPracticeFilters() {
    state.pracCat = 'all';
    state.pracQuery = '';
    renderPracticeHub();
  }

  function renderPracticeHub() {
    ensureOverlays();
    const root = document.getElementById('sp-app-root');
    if (!root) return;
    const story = getStory();
    const hasStoryAccess = Boolean(story && (!window.AccessPolicy || window.AccessPolicy.can('speaking.story_mindmap')));

    const p1List = getPart1Topics();
    const p2CamList = getPart2CambridgeTopics();
    const p2StoryList = hasStoryAccess ? (story.cueCards || []) : [];
    const p2List = [...p2CamList, ...p2StoryList];
    const p3List = getPart3Topics();
    const fullList = getFullSpeakingTests();
    const activePart = normalizePracticePart(state.pracPart);

    const hist = getPracHistory();
    const lastById = {};
    hist.forEach((h) => { if (!lastById[h.cueId]) lastById[h.cueId] = h; });

    const p1DoneCnt = p1List.filter((t) => lastById[t.id]).length;
    const p2DoneCnt = p2List.filter((c) => lastById[c.id]).length;
    const p3DoneCnt = p3List.filter((t) => lastById[t.id]).length;
    const fullDoneCnt = fullList.filter((f) => lastById[f.id]).length;

    const q = state.pracQuery.trim().toLowerCase();
    const activeSearchFocused = document.activeElement?.id === 'sp-prac-search-input';
    const selStart = activeSearchFocused ? document.activeElement.selectionStart : null;

    const partSegHtml = `
      <div class="sp-part-seg-bar" role="tablist" aria-label="Chọn phần thi IELTS Speaking">
        <button type="button" role="tab" aria-selected="${activePart === 1 ? 'true' : 'false'}" class="sp-part-seg-btn ${activePart === 1 ? 'active' : ''}" onclick="SpeakingStudio.setPracticePart(1)">
          <span class="sp-part-seg-top"><strong>Part 1 · Phỏng vấn</strong><span class="sp-part-seg-cnt tabular">${p1DoneCnt}/${p1List.length}</span></span>
          <span class="sp-part-seg-sub">4 câu hỏi Cambridge 15–20 · 20–35s/câu · A.R.E.</span>
        </button>
        <button type="button" role="tab" aria-selected="${activePart === 2 ? 'true' : 'false'}" class="sp-part-seg-btn ${activePart === 2 ? 'active' : ''}" onclick="SpeakingStudio.setPracticePart(2)">
          <span class="sp-part-seg-top"><strong>Part 2 · Cue Card</strong><span class="sp-part-seg-cnt tabular">${p2DoneCnt}/${p2List.length}</span></span>
          <span class="sp-part-seg-sub">${hasStoryAccess ? `${p2CamList.length} Cam 15–20 + ${p2StoryList.length} Story 01 Bẻ lái · 1p + 2p` : `${p2CamList.length} Cue Card thật Cam 15–20 · 1p chuẩn bị + 2p nói`}</span>
        </button>
        <button type="button" role="tab" aria-selected="${activePart === 3 ? 'true' : 'false'}" class="sp-part-seg-btn ${activePart === 3 ? 'active' : ''}" onclick="SpeakingStudio.setPracticePart(3)">
          <span class="sp-part-seg-top"><strong>Part 3 · Thảo luận</strong><span class="sp-part-seg-cnt tabular">${p3DoneCnt}/${p3List.length}</span></span>
          <span class="sp-part-seg-sub">6 câu đề thật Cam 15–20 · 40–65s/câu · P.E.E.C.</span>
        </button>
        <button type="button" role="tab" aria-selected="${activePart === 'full' ? 'true' : 'false'}" class="sp-part-seg-btn is-full-tab ${activePart === 'full' ? 'active' : ''}" onclick="SpeakingStudio.setPracticePart('full')">
          <span class="sp-part-seg-top"><strong>Full Test · 14p</strong><span class="sp-part-seg-cnt tabular">${fullDoneCnt}/${fullList.length}</span></span>
          <span class="sp-part-seg-sub">Thi trọn bộ Part 1 → Part 2 → Part 3 · Cam 15–20</span>
        </button>
      </div>
    `;

    let shellTitle = '';
    let shellSub = '';
    let doneCount = 0;
    let totalCount = 0;
    let filterTabs = [];
    let cardsHtml = '';
    let filteredLen = 0;

    if (activePart === 'full') {
      shellTitle = 'Đề thi Full Test IELTS Speaking (11–14 phút)';
      shellSub = `Trọn bộ <strong>${fullList.length} đề thi thật Cambridge IELTS 15–20</strong> nối liền 3 phần chuẩn giám khảo: <strong>Part 1 (4 câu) → Part 2 (1p chuẩn bị + 2p nói) → Part 3 (6 câu)</strong> kèm điểm Overall Band tổng hợp.`;
      doneCount = fullDoneCnt;
      totalCount = fullList.length;
      filterTabs = [
        { key: 'all', label: `Tất cả (${fullList.length})` },
        { key: '20', label: 'Cam 20' },
        { key: '19', label: 'Cam 19' },
        { key: '18', label: 'Cam 18' },
        { key: '17', label: 'Cam 17' },
        { key: '16', label: 'Cam 16' },
        { key: '15', label: 'Cam 15' }
      ];
      const filtered = fullList.filter((ft) => {
        if (state.pracCat !== 'all' && String(ft.book) !== String(state.pracCat)) return false;
        if (q) {
          const hay = `${ft.title} ${ft.source} ${ft.part1Title} ${ft.part2Title} ${ft.part3Title} ${ft.part2TitleVi || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      filteredLen = filtered.length;
      cardsHtml = filtered.map((ft) => {
        const prev = lastById[ft.id];
        return `
          <article class="ws-prac-card sp-cue-card sp-full-card ${prev ? 'is-done' : ''}">
            <div style="display:flex;flex-direction:column;gap:10px;flex:1;">
              <div class="ws-prac-head">
                <span class="ws-pill warm">${esc(ft.shortSource)}</span>
                <span class="ws-type-pill is-opinion">Full · 11–14p</span>
                ${prev
                  ? `<span class="ws-pill ok tabular" style="margin-left:auto;">${prev.band ? `Overall ${Number(prev.band).toFixed(1)} · ` : ''}${fmtMmSs(prev.durationSec)}</span>`
                  : `<span class="ws-prac-sub-tag" style="margin-left:auto;">${ft.totalQuestions || 11} lượt · P1→P3</span>`}
              </div>
              <div class="sp-full-parts-list">
                <div class="sp-full-part-row">
                  <span class="sp-full-part-tag">P1</span>
                  <span class="sp-full-part-txt">${esc(ft.part1Title)}</span>
                </div>
                <div class="sp-full-part-row">
                  <span class="sp-full-part-tag">P2</span>
                  <span class="sp-full-part-txt">${esc(ft.part2Title)}</span>
                </div>
                <div class="sp-full-part-row">
                  <span class="sp-full-part-tag">P3</span>
                  <span class="sp-full-part-txt">${esc(ft.part3Title)}</span>
                </div>
              </div>
            </div>
            <div class="ws-prac-foot">
              <div class="ws-prac-btns">
                <button type="button" class="btn" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.startFullSpeakingTest('${esc(ft.id)}', 'practice')">Luyện Full Test</button>
                <button type="button" class="btn btn-primary" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.startFullSpeakingTest('${esc(ft.id)}', 'exam')">Thi thật 14p →</button>
                ${isTeacherBypass() ? `<button type="button" class="rp-btn-assign" style="grid-column:1 / -1;padding:6px 10px;font-size:12px;" onclick="event.stopPropagation(); window.TeacherStudio?.openPracticeAssignModal?.({ skill: 'speaking', itemId: '${esc(ft.id)}', isFull: true, title: '${esc(ft.title).replace(/'/g, "\\'")}', subtitle: 'Full Speaking Test · Part 1 → Part 2 → Part 3 (11–14 phút)' })" title="Tạo link giao Full Speaking Test này cho học sinh">🔗 Giao link Full Test này</button>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('');
    } else if (activePart === 2) {
      shellTitle = 'Luyện đề IELTS Speaking Part 2';
      shellSub = hasStoryAccess
        ? `Ngân hàng <strong>${p2CamList.length} Cue Card đề thật Cambridge IELTS 15–20</strong> + <strong>${p2StoryList.length} đề Story 01 Bẻ lái</strong> · 1 phút chuẩn bị + 2 phút nói.`
        : `Ngân hàng <strong>${p2CamList.length} Cue Card đề thi thật Cambridge IELTS 15–20</strong> nguyên văn kèm dàn ý 4 ý, 6 cụm từ &amp; bài mẫu Band 8.0+ · 1 phút chuẩn bị + 2 phút nói.`;
      doneCount = p2DoneCnt;
      totalCount = p2List.length;
      filterTabs = [
        { key: 'all', label: 'Tất cả' },
        { key: 'object', label: 'Sự vật & Chủ đề' },
        { key: 'place', label: 'Địa điểm' },
        { key: 'event', label: 'Trải nghiệm' },
        { key: 'person', label: 'Con người' }
      ];
      if (hasStoryAccess) {
        filterTabs.push({ key: 'story01', label: '★ Story 01 Bẻ lái' });
      }
      const catLabel = {
        object: 'Sự vật & Chủ đề',
        place: 'Địa điểm',
        event: 'Trải nghiệm',
        person: 'Con người',
        cross_topic: 'Story 01 · Cross-Topic',
        cross_category: 'Story 01 · Cross-Category'
      };
      const catPillCls = {
        object: 'is-cause',
        place: 'is-adv',
        event: 'is-opinion',
        person: 'is-cause',
        cross_topic: 'is-adv',
        cross_category: 'is-opinion'
      };
      const filtered = p2List.filter((c) => {
        if (state.pracCat === 'story01') {
          if (c.isCambridge) return false;
        } else if (state.pracCat !== 'all') {
          if (!c.isCambridge && state.pracCat === 'person') {
            if (c.category !== 'person') return false;
          } else if (c.category !== state.pracCat) {
            return false;
          }
        }
        if (q) {
          const hay = `${c.title} ${c.titleVi || ''} ${c.source || ''} ${(c.bullets || []).join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      filteredLen = filtered.length;
      cardsHtml = filtered.map((cue) => {
        const prev = lastById[cue.id];
        const isCam = Boolean(cue.isCambridge);
        const badgeLbl = isCam
          ? (cue.catLabel || catLabel[cue.category] || 'Part 2')
          : (cue.category === 'person' ? 'Story 01 · Person' : (catLabel[cue.category] || 'Story 01'));
        return `
          <article class="ws-prac-card sp-cue-card ${prev ? 'is-done' : ''}">
            <div style="display:flex;flex-direction:column;gap:10px;flex:1;">
              <div class="ws-prac-head">
                ${isCam && cue.source ? `<span class="ws-pill warm">${esc(cue.source.replace('Cambridge IELTS ', 'Cam '))}</span>` : ''}
                <span class="ws-type-pill ${catPillCls[cue.category] || 'is-cause'}">${esc(badgeLbl)}</span>
                ${prev
                  ? `<span class="ws-pill ok tabular" style="margin-left:auto;">${prev.band ? `Band ${Number(prev.band).toFixed(1)} · ` : ''}${fmtMmSs(prev.durationSec)} · ${prev.wpm} WPM</span>`
                  : `<span class="ws-prac-sub-tag" style="margin-left:auto;">${isCam ? '1p + 2p nói' : esc(cue.source || 'Story 01')}</span>`}
              </div>
              <div class="sp-p13-card-title-grp">
                <p class="ws-prac-prompt" style="margin:0;">${esc(cue.title)}</p>
                ${cue.titleVi ? `<div class="sp-p13-card-sub">${esc(cue.titleVi)}</div>` : ''}
              </div>
              <ul class="sp-cue-bullets">
                ${(cue.bullets || []).map((b) => `<li>${esc(b)}</li>`).join('')}
              </ul>
            </div>
            <div class="ws-prac-foot">
              <div class="ws-prac-btns">
                <button type="button" class="btn" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.openPracticeRoom('${esc(cue.id)}', 'practice')">Luyện tập</button>
                <button type="button" class="btn btn-primary" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.openPracticeRoom('${esc(cue.id)}', 'exam')">Thi thật →</button>
                ${isTeacherBypass() ? `<button type="button" class="rp-btn-assign" style="grid-column:1 / -1;padding:6px 10px;font-size:12px;" onclick="event.stopPropagation(); window.TeacherStudio?.openPracticeAssignModal?.({ skill: 'speaking', itemId: '${esc(cue.id)}', isFull: false, title: '${esc(String(isCam ? `${cue.source.replace('Cambridge IELTS ', 'Cam ')} · ${cue.title}` : cue.title).slice(0, 90)).replace(/'/g, "\\'")}', subtitle: '${esc(badgeLbl).replace(/'/g, "\\'")}' })" title="Tạo link giao Cue Card này cho học sinh">🔗 Giao link đề này</button>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('');
    } else {
      const isP1 = activePart === 1;
      const list = isP1 ? p1List : p3List;
      shellTitle = isP1 ? 'Luyện đề IELTS Speaking Part 1' : 'Luyện đề IELTS Speaking Part 3';
      const totalQsInPart = list.reduce((acc, t) => acc + ((t.questions || []).length), 0);
      shellSub = isP1
        ? `Ngân hàng ${p1List.length} bộ đề thi thật Cambridge IELTS 15–20 (${totalQsInPart} câu hỏi nguyên văn) · Giám khảo đọc UK, trả lời tự nhiên <strong>20–35s/câu</strong> theo khung <strong>A.R.E.</strong>`
        : `Ngân hàng ${p3List.length} bộ đề thi thật Cambridge IELTS 15–20 (${totalQsInPart} câu hỏi thảo luận nguyên văn) · Phân tích sâu <strong>40–65s/câu</strong> theo khung <strong>P.E.E.C.</strong> chuẩn Band 7.5–8.5.`;
      doneCount = isP1 ? p1DoneCnt : p3DoneCnt;
      totalCount = list.length;
      filterTabs = isP1
        ? [
            { key: 'all', label: 'Tất cả' },
            { key: 'core', label: 'Bản thân · Học & Làm' },
            { key: 'daily', label: 'Đời sống' },
            { key: 'hobby', label: 'Sở thích & Du lịch' },
            { key: 'tech', label: 'Mua sắm & Bản đồ' },
            { key: 'social', label: 'Văn hóa & Xã hội' }
          ]
        : [
            { key: 'all', label: 'Tất cả' },
            { key: 'society', label: 'Xã hội & Văn hóa' },
            { key: 'education', label: 'Giáo dục & Nghề nghiệp' },
            { key: 'tech', label: 'Công nghệ & Truyền thông' },
            { key: 'lifestyle', label: 'Đô thị & Du lịch' }
          ];
      const pillClsMap = { core: 'is-cause', daily: 'is-adv', hobby: 'is-opinion', tech: 'is-adv', social: 'is-cause', society: 'is-cause', education: 'is-opinion', lifestyle: 'is-adv' };
      const filtered = list.filter((tp) => {
        if (state.pracCat !== 'all' && tp.category !== state.pracCat) return false;
        if (q) {
          const hay = `${tp.title} ${tp.titleVi || ''} ${tp.catLabel || ''} ${tp.source || ''} ${(tp.questions || []).map((x) => x.q).join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });
      filteredLen = filtered.length;
      cardsHtml = filtered.map((tp) => {
        const prev = lastById[tp.id];
        const qs = tp.questions || [];
        const previewQs = qs.slice(0, 4);
        const extraCnt = Math.max(0, qs.length - previewQs.length);
        const targetLbl = getTopicTargetLabel(tp);
        return `
          <article class="ws-prac-card sp-cue-card sp-p13-card ${prev ? 'is-done' : ''}">
            <div style="display:flex;flex-direction:column;gap:9px;flex:1;">
              <div class="ws-prac-head">
                ${tp.source ? `<span class="ws-pill warm">${esc(tp.source.replace('Cambridge IELTS ', 'Cam '))}</span>` : ''}
                <span class="ws-type-pill ${pillClsMap[tp.category] || 'is-cause'}">${esc(tp.catLabel || (isP1 ? 'Part 1' : 'Part 3'))}</span>
                ${prev
                  ? `<span class="ws-pill ok tabular" style="margin-left:auto;">${prev.band ? `Band ${Number(prev.band).toFixed(1)} · ` : ''}${fmtMmSs(prev.durationSec)}</span>`
                  : `<span class="ws-prac-sub-tag" style="margin-left:auto;">${(tp.linkedStory && hasStoryAccess) ? '★ Nối Story 01' : `${qs.length} câu · ${esc(targetLbl)}`}</span>`}
              </div>
              <div class="sp-p13-card-title-grp">
                <p class="ws-prac-prompt" style="margin:0;">${esc(tp.title)}</p>
                <div class="sp-p13-card-sub">${esc(tp.titleVi || '')}</div>
              </div>
              <ol class="sp-p13-q-preview">
                ${previewQs.map((item) => `<li>${esc(item.q)}</li>`).join('')}
              </ol>
              ${extraCnt > 0 ? `<div style="font-size:11.5px;color:var(--ink-3);font-weight:600;margin-top:-4px;">+ ${extraCnt} câu hỏi thảo luận sâu trong phòng thi…</div>` : ''}
            </div>
            <div class="ws-prac-foot">
              <div class="ws-prac-btns">
                <button type="button" class="btn" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.openInterviewRoom('${esc(tp.id)}', 'practice')">Luyện tập</button>
                <button type="button" class="btn btn-primary" style="padding:8px 10px;font-size:12.5px;" onclick="SpeakingStudio.openInterviewRoom('${esc(tp.id)}', 'exam')">Thi thật →</button>
                ${isTeacherBypass() ? `<button type="button" class="rp-btn-assign" style="grid-column:1 / -1;padding:6px 10px;font-size:12px;" onclick="event.stopPropagation(); window.TeacherStudio?.openPracticeAssignModal?.({ skill: 'speaking', itemId: '${esc(tp.id)}', isFull: false, title: '${esc(`Part ${tp.part} · ${tp.title}`).replace(/'/g, "\\'")}', subtitle: '${esc(tp.titleVi || `Speaking Part ${tp.part}`).replace(/'/g, "\\'")}' })" title="Tạo link giao chủ đề này cho học sinh">🔗 Giao link đề này</button>` : ''}
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    root.innerHTML = `
      <div class="tot-section-shell sp-prac-shell">
        <div class="tot-shell-head">
          <div>
            <h2 class="tot-shell-title">${shellTitle}</h2>
            <p class="tot-shell-sub">${shellSub}</p>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn" style="padding:6px 12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;" onclick="SpeakingStudio.openRandomTopic('practice')" title="Bốc ngẫu nhiên 1 đề chưa luyện">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0;"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
              <span>Bốc đề ngẫu nhiên</span>
            </button>
            ${(activePart === 2 && hasStoryAccess) ? `<button type="button" class="btn" style="padding:6px 12px;font-size:12px;" onclick="SpeakingStudio.openMindmapModal('master')">Mindmap</button>` : ''}
            <span class="ws-pill tabular">${doneCount} / ${totalCount} đề đã luyện</span>
          </div>
        </div>

        ${partSegHtml}

        <div class="sp-prac-toolbar-pro">
          <div class="ws-prac-subtabs" role="tablist" aria-label="Lọc theo nhóm đề">
            ${filterTabs.map((ft) => `<button type="button" class="ws-prac-subtab ${state.pracCat === ft.key ? 'active' : ''}" onclick="SpeakingStudio.setPracticeCat('${ft.key}')">${esc(ft.label)}</button>`).join('')}
          </div>

          <div class="sp-prac-toolbar-r">
            <span class="ws-prac-count tabular">${filteredLen} / ${totalCount} đề</span>
            <div class="ws-prac-search-wrap">
              <svg class="ws-prac-search-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="search" id="sp-prac-search-input" class="ws-prac-search" placeholder="Tìm chủ đề hoặc câu hỏi..." value="${esc(state.pracQuery)}" oninput="SpeakingStudio.setPracticeQuery(this.value)" />
            </div>
          </div>
        </div>

        <div class="ws-prac-grid">
          ${filteredLen ? cardsHtml : `
            <div class="ws-prac-empty">
              <div style="font-size:14.5px;font-weight:750;color:var(--ink);">Không tìm thấy chủ đề phù hợp</div>
              <div style="font-size:12.5px;">Hãy thử từ khóa khác hoặc đặt lại bộ lọc nhóm đề.</div>
              <button type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;" onclick="SpeakingStudio.resetPracticeFilters()">Xóa bộ lọc</button>
            </div>
          `}
        </div>
      </div>
    `;

    if (activeSearchFocused) {
      const inp = document.getElementById('sp-prac-search-input');
      if (inp) {
        inp.focus();
        if (typeof selStart === 'number') inp.setSelectionRange(selStart, selStart);
      }
    }
  }

  function openRandomTopic(mode) {
    const activePart = normalizePracticePart(state.pracPart);
    const hasStoryAccess = Boolean(!window.AccessPolicy || window.AccessPolicy.can('speaking.story_mindmap'));
    const items = activePart === 'full'
      ? getFullSpeakingTests()
      : (activePart === 1
        ? getPart1Topics()
        : (activePart === 3
          ? getPart3Topics()
          : [...getPart2CambridgeTopics(), ...(hasStoryAccess ? (getStory()?.cueCards || []) : [])]));
    if (!items.length) return;
    const doneIds = new Set(getPracHistory().map((h) => h.cueId));
    const pool = items.filter((c) => !doneIds.has(c.id));
    const list = pool.length ? pool : items;
    const picked = list[Math.floor(Math.random() * list.length)];
    if (!picked) return;
    if (activePart === 'full') startFullSpeakingTest(picked.id, mode || 'practice');
    else if (activePart === 2) openPracticeRoom(picked.id, mode || 'practice');
    else openInterviewRoom(picked.id, mode || 'practice');
  }

  function openRandomCueCard(mode) {
    openRandomTopic(mode);
  }

  /* ================= 3D PRO — 100% AUTHENTIC IELTS EXAM SIMULATOR (CINEMA + HANDS-FREE VAD + 11 SCENARIOS) ================= */
  let boundProKeyHandler = null;

  function rerenderActiveRoom() {
    if (!roomState) return;
    if (roomState.kind === 'interview') renderInterviewRoom();
    else renderPracticeRoom();
  }

  function cleanupProEngines() {
    window.SpeakingGeminiLive?.closeSession?.();
    window.SpeakingVADEngine?.closeSession?.();
    window.SpeakingExaminerCinema?.destroy?.();
    if (boundProKeyHandler) {
      window.removeEventListener('keydown', boundProKeyHandler);
      boundProKeyHandler = null;
    }
  }

  function getCandidateDisplay() {
    const u = B()?.getCurrentUser?.();
    const rawName = String(u?.name || u?.fullName || u?.id || 'Thí sinh').trim();
    const parts = rawName.split(/\s+/).filter(Boolean);
    const initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : rawName.slice(0, 2).toUpperCase();
    return { name: rawName, initials: initials || 'HV' };
  }

  function updateProStatusDom(text, barState) {
    if (roomState && text) roomState.proStatusText = text;
    const lbl = document.getElementById('sp-pro-status-lbl');
    if (lbl && text) lbl.textContent = text;
    const micLbl = document.getElementById('sp-pro-mic-lbl');
    if (micLbl && text) micLbl.textContent = text;
    const bar = document.getElementById('sp-pro-v2-bar');
    if (bar && barState) {
      bar.classList.toggle('is-live-mic', barState === 'listening' || barState === 'speaking');
      bar.classList.toggle('is-examiner-speaking', barState === 'examiner');
      bar.classList.toggle('is-processing', barState === 'processing');
    }
    const doneBtn = document.getElementById('sp-pro-done-turn-btn');
    if (doneBtn && barState) {
      doneBtn.style.display = (barState === 'listening' || barState === 'speaking') ? '' : 'none';
    }
  }

  function clearExaminerSpeaking() {
    if (!roomState) return;
    if (roomState.examinerSpeakTimer) {
      clearTimeout(roomState.examinerSpeakTimer);
      roomState.examinerSpeakTimer = null;
    }
    roomState.examinerSpeaking = false;
    window.SpeakingExaminerCinema?.stopSpeaking?.();
  }

  function triggerExaminerSpeaking(text) {
    if (!roomState || roomState.recording || roomState.processing) return;
    roomState.examinerSpeaking = true;
    const words = Math.max(4, countWords(text || ''));
    const ms = Math.min(9500, Math.max(2200, words * 360));
    const ref = roomState;
    roomState.examinerSpeakTimer = setTimeout(() => {
      if (roomState === ref) clearExaminerSpeaking();
    }, ms);
  }

  function setRoomViewMode(mode) {
    const clean = mode === 'standard' ? 'standard' : 'pro3d';
    try { localStorage.setItem(PRO_MODE_KEY, clean); } catch (_) {}
    cleanupProEngines();
    if (!roomState) return;
    roomState.proStarted = false;
    roomState.proVadState = 'paused';
    roomState.recording = false;
    roomState.processing = false;
    if (clean === 'standard' && roomState.kind === 'part2' && roomState.phase === 'prep' && !roomState.notes.sheet && roomState.mode !== 'exam') {
      roomState.notes.sheet = '1. Mở bài (B1–B3):\n- \n\n2. Cốt truyện chính (B4):\n- \n\n3. Kết bài chốt đề (B5):\n- ';
    }
    if (clean === 'pro3d' && roomState.kind === 'part2' && roomState.phase === 'prep') {
      roomState.notes.sheet = '';
    }
    rerenderActiveRoom();
  }

  function setProExaminer(exId) {
    if (!PRO_EXAMINERS[exId]) return;
    try { localStorage.setItem(EXAMINER_KEY, exId); } catch (_) {}
    window.SpeakingExaminerCinema?.disconnectSimli?.();
    if (!roomState) return;
    rerenderActiveRoom();
  }

  function toggleProBlindCaptions() {}
  function toggleProDrawer() {}

  function speakPart2Prompt() {
    if (!roomState || roomState.kind !== 'part2') return;
    const cue = roomState.cue;
    if (!cue?.title) return;
    speakText(`${cue.title}. You should say: ${(cue.bullets || []).join(', ')}.`, 'en-GB');
  }

  /* Client-side Official Cambridge Fallback (used if /api/examiner-turn is offline or file://) */
  function fallbackExaminerTurnDecision(payload) {
    const { part, currentQuestion, lastExaminerSpeech, currentTurnSoFar, nextQuestion, candidateText, durationSec, wordCount, repeatCount, probeCount, isPart2RoundingOff } = payload;
    const low = String(candidateText || '').toLowerCase().trim();
    const isRepeat = /\b(repeat|pardon|again|catch that|hear that|sorry\??$|excuse me|say that again|didn't hear|did not hear)\b/i.test(low) && wordCount <= 14;
    const isExplain = /\b(explain|rephrase|mean by|what do you mean|what does .* mean|what kind of|like what|don't understand|do not understand|clarify|what information|more specific)\b/i.test(low) && wordCount <= 18;
    const isAskExaminer = /\b(what about you|how about you|and you\??$|do you (like|think|walk|use|prefer|have)|what do you think)\b/i.test(low) && wordCount <= 16;
    const isDecline = /\b(nothing else|that'?s all|no more|i don'?t know|no idea|not really|that is all)\b/i.test(low) && wordCount <= 10;

    if (isRepeat && repeatCount < 2) {
      const toRepeat = probeCount >= 1 && lastExaminerSpeech ? lastExaminerSpeech : currentQuestion;
      return {
        action: 'repeat',
        examinerSpeech: `Sure, of course. ${toRepeat}`,
        shouldAdvance: false,
        countAsAnswer: false,
        followUpQuestion: '',
      };
    }
    if (isExplain && repeatCount < 2) {
      if (probeCount >= 1) {
        return {
          action: 'rephrase',
          examinerSpeech: 'Sure — for example, you could mention why you feel that way, how often it happens, or a quick everyday example.',
          shouldAdvance: false,
          countAsAnswer: false,
          followUpQuestion: '',
        };
      }
      if (part === 1) {
        return {
          action: 'repeat',
          examinerSpeech: `Of course, let me repeat the question. ${currentQuestion}`,
          shouldAdvance: false,
          countAsAnswer: false,
          followUpQuestion: '',
        };
      }
      return {
        action: 'rephrase',
        examinerSpeech: `Sure. In simpler terms, what is your general view on this: ${currentQuestion}`,
        shouldAdvance: false,
        countAsAnswer: false,
        followUpQuestion: '',
      };
    }
    if (isAskExaminer) {
      const priorWords = countWords(currentTurnSoFar || '');
      if (priorWords < 14 && repeatCount < 2) {
        return {
          action: 'rephrase',
          examinerSpeech: "Well, today I'm here to hear about your views! Could you tell me a bit more about your own experience?",
          shouldAdvance: false,
          countAsAnswer: false,
          followUpQuestion: '',
        };
      }
      if (nextQuestion) {
        return {
          action: 'next_question',
          examinerSpeech: `Well, today it's all about your views, thank you. ${nextQuestion}`,
          shouldAdvance: true,
          countAsAnswer: false,
          followUpQuestion: '',
        };
      }
      return {
        action: 'end_part',
        examinerSpeech: `Well, today it's all about your views. Thank you, that is the end of Part ${part}.`,
        shouldAdvance: true,
        countAsAnswer: false,
        followUpQuestion: '',
      };
    }
    if (isDecline && probeCount >= 1) {
      if (nextQuestion) {
        return {
          action: 'next_question',
          examinerSpeech: `No problem at all, thank you. ${nextQuestion}`,
          shouldAdvance: true,
          countAsAnswer: false,
          followUpQuestion: '',
        };
      }
      return {
        action: 'end_part',
        examinerSpeech: `No problem at all. Thank you, that is the end of Part ${part}.`,
        shouldAdvance: true,
        countAsAnswer: false,
        followUpQuestion: '',
      };
    }
    if (part === 2 && !isPart2RoundingOff) {
      if (durationSec < 75 && probeCount < 1) {
        return {
          action: 'prompt_more',
          examinerSpeech: 'Would you like to add anything else?',
          shouldAdvance: false,
          countAsAnswer: true,
          followUpQuestion: 'Would you like to add anything else?',
        };
      }
      return {
        action: 'rounding_off',
        examinerSpeech: 'Thank you. Do you still think about this person or experience often today?',
        shouldAdvance: false,
        countAsAnswer: true,
        followUpQuestion: 'Do you still think about this person or experience often today?',
      };
    }
    if (part === 2 && isPart2RoundingOff) {
      return {
        action: 'end_part',
        examinerSpeech: 'Thank you. That is the end of Part 2.',
        shouldAdvance: true,
        countAsAnswer: true,
        followUpQuestion: '',
      };
    }
    if (part === 1 && wordCount < 11 && probeCount < 1) {
      return {
        action: 'probe_short',
        examinerSpeech: 'Why do you say that?',
        shouldAdvance: false,
        countAsAnswer: true,
        followUpQuestion: 'Why do you say that?',
      };
    }
    if (part === 3 && wordCount >= 12 && probeCount < 1) {
      return {
        action: 'followup_deep',
        examinerSpeech: "That's an interesting point. Could you give me a specific example from everyday life to illustrate that?",
        shouldAdvance: false,
        countAsAnswer: true,
        followUpQuestion: 'Could you give me a specific example from everyday life to illustrate that?',
      };
    }
    const acks = ['Thank you.', 'Right, I see.', 'Interesting, thank you.', 'Mm-hmm, thank you.'];
    const ack = acks[Math.floor(Math.random() * acks.length)];
    if (nextQuestion) {
      return {
        action: 'next_question',
        examinerSpeech: `${ack} ${nextQuestion}`,
        shouldAdvance: true,
        countAsAnswer: true,
        followUpQuestion: '',
      };
    }
    return {
      action: 'end_part',
      examinerSpeech: `Thank you. That is the end of Part ${part}.`,
      shouldAdvance: true,
      countAsAnswer: true,
      followUpQuestion: '',
    };
  }

  async function callExaminerBrain(payload) {
    const apiUrl = STT()?.getApiUrl ? STT().getApiUrl('/api/examiner-turn') : '/api/examiner-turn';
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6500);
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.ok && data.examinerSpeech) return data;
    } catch (_) {}
    return fallbackExaminerTurnDecision(payload);
  }

  /* Preload upcoming lip-sync clip while candidate is answering (zero-latency next turn) */
  function preloadNextProClip(ref) {
    if (!ref || !window.SpeakingExaminerCinema?.preloadClip) return;
    const exId = getProExaminerId();
    if (ref.kind === 'interview') {
      const nextQ = ref.topic?.questions?.[ref.qIdx + 1];
      if (nextQ?.id) {
        window.SpeakingExaminerCinema.preloadClip(exId, nextQ.id);
      } else {
        window.SpeakingExaminerCinema.preloadClip(exId, `sys_end_p${ref.part}`);
      }
    } else if (ref.kind === 'part2') {
      if (ref.phase === 'prep') {
        window.SpeakingExaminerCinema.preloadClip(exId, 'sys_p2_start_speak');
      } else if (!ref.p2RoundingOff) {
        window.SpeakingExaminerCinema.preloadClip(exId, 'sys_p2_add_more');
      } else {
        window.SpeakingExaminerCinema.preloadClip(exId, 'sys_end_p2');
      }
    }
  }

  /* Update Part 1/3 question counter & "Chấm sớm" button IN PLACE without destroying Veo 3.1 videos! */
  function updateProQuestionChrome(ref) {
    if (!ref || ref.kind !== 'interview') return;
    const total = (ref.turns || []).length || (ref.topic?.questions || []).length || 1;
    const answered = (ref.turns || []).filter((t) => countWords(t.text) > 0).length;
    const badge = document.getElementById('sp-pro-q-badge');
    if (badge) badge.textContent = `Part ${ref.part} · Câu ${ref.qIdx + 1}/${total}`;
    const timer = document.getElementById('sp-room-timer');
    if (timer) timer.textContent = `Câu ${ref.qIdx + 1}/${total} · ${fmtMmSs(ref.totalElapsedSec || 0)}`;
    const earlyBtn = document.getElementById('sp-pro-finish-early-btn');
    if (earlyBtn) {
      earlyBtn.style.display = answered >= 1 ? '' : 'none';
      earlyBtn.textContent = `Chấm sớm (${answered}/${total})`;
    }
  }

  /* Speak as British Examiner -> automatically arm Hands-Free Continuous VAD right when done! */
  function proExaminerSpeakAndListen(speechText, listenCfg, speakRate, clipId) {
    const ref = roomState;
    if (!ref || !ref.proStarted) return;
    window.SpeakingVADEngine?.pauseForExaminer?.();
    ref.examinerSpeaking = true;
    ref.proVadState = 'paused';
    ref.lastExaminerSpeech = String(speechText || '').trim();
    updateProStatusDom('Giám khảo đang nói...', 'examiner');

    window.SpeakingExaminerCinema?.speak?.(speechText, {
      examinerId: getProExaminerId(),
      clipId: clipId || '',
      rate: speakRate || 0.96,
      onDone: () => {
        if (roomState !== ref || !ref.proStarted || ref.phase === 'review') return;
        ref.examinerSpeaking = false;
        preloadNextProClip(ref);
        if (listenCfg === null) return;
        ref.proVadState = 'listening';
        ref.recStartedAt = Date.now();
        ref.recElapsedSec = 0;
        window.SpeakingExaminerCinema?.setMode?.('listening');
        updateProStatusDom('Micro đang mở — Mời bạn trả lời', 'listening');
        window.SpeakingVADEngine?.armListening?.(listenCfg);
      },
    });
  }

  function getProTurnListenConfig() {
    if (!roomState) return { silenceMs: 2600, minSpeechMs: 700, maxTurnMs: 42000, noSpeechMs: 7500 };
    if (roomState.kind === 'part2') {
      if (roomState.p2RoundingOff) {
        return { silenceMs: 2400, minSpeechMs: 600, maxTurnMs: 25000, noSpeechMs: 7500 };
      }
      const remMs = Math.max(12000, (roomState.secsLeft || 120) * 1000);
      return { silenceMs: 4500, minSpeechMs: 2000, maxTurnMs: remMs, noSpeechMs: 9000 };
    }
    const isP1 = roomState.part === 1;
    return {
      silenceMs: isP1 ? 2500 : 3000,
      minSpeechMs: isP1 ? 650 : 900,
      maxTurnMs: isP1 ? 40000 : 75000,
      noSpeechMs: 7200,
    };
  }

  async function handleProNoSpeech() {
    const ref = roomState;
    if (!ref || !ref.proStarted || ref.phase === 'review') return;
    ref.noSpeechNudges = (ref.noSpeechNudges || 0) + 1;

    if (ref.kind === 'part2' && !ref.p2RoundingOff) {
      if (ref.noSpeechNudges <= 1) {
        proExaminerSpeakAndListen('Whenever you are ready, please begin talking about your topic.', getProTurnListenConfig(), 0.94, 'sys_p2_ready');
      } else {
        proExaminerSpeakAndListen('Would you like to add anything else?', getProTurnListenConfig(), 0.94, 'sys_p2_add_more');
      }
      return;
    }

    if (ref.noSpeechNudges <= 1) {
      proExaminerSpeakAndListen('Take your time. Would you like me to repeat the question?', getProTurnListenConfig(), 0.94, 'sys_no_speech');
      return;
    }

    // After 2 silent nudges, politely advance like a real timed exam
    if (ref.kind === 'interview') {
      const nextQObj = ref.topic?.questions?.[ref.qIdx + 1] || null;
      if (nextQObj?.q) {
        ref.qIdx++;
        ref.probeCount = 0;
        ref.repeatCount = 0;
        ref.noSpeechNudges = 0;
        ref.lastExaminerSpeech = '';
        updateProQuestionChrome(ref);
        proExaminerSpeakAndListen(`Alright, let's move on. ${nextQObj.q}`, getProTurnListenConfig(), 0.96, nextQObj.id || '');
      } else {
        concludeProExamSession(`Thank you. That is the end of Part ${ref.part}.`, `sys_end_p${ref.part}`);
      }
    } else {
      concludeProExamSession('Thank you. That is the end of Part 2.', 'sys_end_p2');
    }
  }

  function concludeProExamSession(closingLine, clipId) {
    const ref = roomState;
    if (!ref) return;
    window.SpeakingVADEngine?.pauseForExaminer?.();
    updateProStatusDom('Giám khảo đang kết thúc phần thi...', 'examiner');
    const resolvedClipId = clipId || (ref.kind === 'part2' ? 'sys_end_p2' : `sys_end_p${ref.part}`);
    window.SpeakingExaminerCinema?.speak?.(closingLine, {
      examinerId: getProExaminerId(),
      clipId: resolvedClipId,
      rate: 0.96,
      onDone: () => {
        if (roomState !== ref) return;
        cleanupProEngines();
        if (ref.kind === 'interview') {
          const hasAny = ref.turns.some((t) => countWords(t.text) > 0);
          if (hasAny) finishInterview();
          else {
            toast('Chưa ghi nhận câu trả lời nào trong phiên thi.');
            ref.proStarted = false;
            rerenderActiveRoom();
          }
        } else {
          const fullTxt = (ref.p2SpeechParts || []).map((p) => p.text).filter(Boolean).join(' ').trim();
          const totalDur = (ref.p2SpeechParts || []).reduce((a, b) => a + (b.durationSec || 0), 0);
          const lastAudio = (ref.p2SpeechParts || []).find((p) => p.audioUrl)?.audioUrl || '';
          const mergedWords = (ref.p2SpeechParts || []).flatMap((p) => p.words || []);
          const mergedSegs = (ref.p2SpeechParts || []).flatMap((p) => p.segments || []);
          if (countWords(fullTxt) >= 5) {
            finalizeRoomAttempt(fullTxt, Math.max(15, totalDur), lastAudio, {
              hasAudio: Boolean(lastAudio),
              audioUrl: lastAudio,
              durationSec: Math.max(15, totalDur),
              words: mergedWords,
              segments: mergedSegs,
            });
          } else {
            toast('Chưa thu được bài nói Part 2 — bạn có thể bắt đầu lại phiên thi.');
            ref.proStarted = false;
            ref.phase = 'prep';
            ref.secsLeft = 60;
            rerenderActiveRoom();
          }
        }
      },
    });
  }

  async function handleProVadTurnResult(res) {
    const ref = roomState;
    if (!ref || !ref.proStarted || ref.phase === 'review') return;

    if (res.silent || !res.text) {
      if (res.reason === 'stt_error') {
        proExaminerSpeakAndListen("Sorry, I didn't quite catch that. Could you say that again?", getProTurnListenConfig(), 0.94);
        return;
      }
      if (res.reason === 'time_limit') {
        if (ref.kind === 'part2' && !ref.p2RoundingOff) {
          // Move to rounding off even if last slice was quiet
          await triggerPart2RoundingOff();
          return;
        }
      }
      handleProNoSpeech();
      return;
    }

    ref.noSpeechNudges = 0;
    window.SpeakingExaminerCinema?.setMode?.('processing');
    updateProStatusDom('Giám khảo đang lắng nghe & phản hồi...', 'processing');

    if (ref.kind === 'part2') {
      const spokenText = res.text;
      if (!ref.p2RoundingOff) {
        ref.p2SpeechParts = ref.p2SpeechParts || [];
        ref.p2SpeechParts.push({
          text: spokenText,
          durationSec: res.durationSec || 10,
          audioUrl: res.audioUrl || '',
          words: res.words || [],
          segments: res.segments || [],
        });
        const totalDur = ref.p2SpeechParts.reduce((a, b) => a + (b.durationSec || 0), 0);
        const combined = ref.p2SpeechParts.map((p) => p.text).join(' ').trim();

        // Scenario 10: Stopped early (< 75s) -> Cambridge prompt "Would you like to add anything else?"
        if (res.reason !== 'time_limit' && totalDur < 75 && (ref.probeCount || 0) < 1 && ref.secsLeft > 15) {
          ref.probeCount = (ref.probeCount || 0) + 1;
          proExaminerSpeakAndListen('Would you like to add anything else?', getProTurnListenConfig(), 0.94, 'sys_p2_add_more');
          return;
        }

        // Scenario 11: Time up (2:00) or solid talk (>= 75s) -> Take back Cue Card & ask Rounding-off Question!
        await triggerPart2RoundingOff(combined, totalDur);
        return;
      }

      // Candidate just answered the Part 2 Rounding-off Question!
      ref.p2SpeechParts.push({
        text: spokenText,
        durationSec: res.durationSec || 5,
        audioUrl: res.audioUrl || '',
        words: res.words || [],
        segments: res.segments || [],
      });
      concludeProExamSession('Thank you. That is the end of Part 2.', 'sys_end_p2');
      return;
    }

    // PART 1 & PART 3 REAL EXAMINER BRAIN
    const curQObj = ref.topic?.questions?.[ref.qIdx];
    const nextQObj = ref.topic?.questions?.[ref.qIdx + 1] || null;
    const wc = countWords(res.text);

    // Scenario 6: Official Time Limit Interrupt (40s P1 / 75s P3)
    if (res.reason === 'time_limit') {
      appendProInterviewAnswer(ref, ref.qIdx, res);
      if (nextQObj) {
        ref.qIdx++;
        ref.probeCount = 0;
        ref.repeatCount = 0;
        ref.lastExaminerSpeech = '';
        updateProQuestionChrome(ref);
        proExaminerSpeakAndListen(`Thank you. Let's move on to the next question. ${nextQObj.q}`, getProTurnListenConfig(), 0.96, nextQObj.id || '');
      } else {
        concludeProExamSession(`Thank you. That is the end of Part ${ref.part}.`, `sys_end_p${ref.part}`);
      }
      return;
    }

    const decision = await callExaminerBrain({
      part: ref.part,
      topicTitle: ref.topic?.title || '',
      currentQuestion: curQObj?.q || '',
      lastExaminerSpeech: ref.lastExaminerSpeech || curQObj?.q || '',
      currentTurnSoFar: ref.turns?.[ref.qIdx]?.text || '',
      nextQuestion: nextQObj?.q || null,
      candidateText: res.text,
      durationSec: res.durationSec || 5,
      wordCount: wc,
      repeatCount: ref.repeatCount || 0,
      probeCount: ref.probeCount || 0,
      isPart2RoundingOff: false,
      history: ref.turns.slice(0, ref.qIdx).map((t) => ({ q: t.q, a: t.text })),
    });
    if (roomState !== ref || !ref.proStarted) return;

    if (decision.countAsAnswer !== false) {
      appendProInterviewAnswer(ref, ref.qIdx, res);
    }

    if (decision.action === 'repeat' || decision.action === 'rephrase') {
      ref.repeatCount = (ref.repeatCount || 0) + 1;
      const repeatClipId = (decision.action === 'repeat' && !ref.probeCount) ? (curQObj?.id || '') : '';
      proExaminerSpeakAndListen(decision.examinerSpeech, getProTurnListenConfig(), 0.88, repeatClipId);
      return;
    }

    if (!decision.shouldAdvance && (decision.action === 'probe_short' || decision.action === 'followup_deep' || decision.action === 'redirect_offtopic')) {
      ref.probeCount = (ref.probeCount || 0) + 1;
      const probeClipId = decision.action === 'probe_short' ? 'sys_probe_why' : '';
      proExaminerSpeakAndListen(decision.examinerSpeech, getProTurnListenConfig(), 0.96, probeClipId);
      return;
    }

    // Advance cleanly to next question or conclude exam (WITHOUT tearing down live Veo 3.1 video!)
    if (decision.action === 'end_part' || !nextQObj) {
      concludeProExamSession(decision.examinerSpeech || `Thank you. That is the end of Part ${ref.part}.`, `sys_end_p${ref.part}`);
      return;
    }

    ref.qIdx++;
    ref.probeCount = 0;
    ref.repeatCount = 0;
    ref.lastExaminerSpeech = '';
    updateProQuestionChrome(ref);
    proExaminerSpeakAndListen(decision.examinerSpeech, getProTurnListenConfig(), 0.96, nextQObj.id || '');
  }

  async function triggerPart2RoundingOff(combinedText, totalDur) {
    const ref = roomState;
    if (!ref || ref.kind !== 'part2') return;
    clearInterval(ref.timerId);
    ref.p2RoundingOff = true;
    rerenderActiveRoom(); // Takes back Cue Card from desk like real IELTS!
    const text = combinedText || (ref.p2SpeechParts || []).map((p) => p.text).join(' ').trim();
    const dec = await callExaminerBrain({
      part: 2,
      topicTitle: ref.cue?.title || '',
      currentQuestion: ref.cue?.title || '',
      nextQuestion: null,
      candidateText: text,
      durationSec: totalDur || 90,
      wordCount: countWords(text),
      repeatCount: 0,
      probeCount: 1,
      isPart2RoundingOff: true,
      history: [],
    });
    if (roomState !== ref || !ref.proStarted) return;
    proExaminerSpeakAndListen(dec.examinerSpeech || 'Thank you. Do you still think about that often today?', getProTurnListenConfig(), 0.95);
  }

  function appendProInterviewAnswer(ref, idx, res) {
    const qObj = ref.topic?.questions?.[idx];
    const prev = ref.turns[idx] || {};
    const combinedText = [prev.text || '', res.text || ''].filter(Boolean).join(' ').trim();
    const totalDur = (prev.durationSec || 0) + (res.durationSec || 0);
    const words = countWords(combinedText);
    const wpm = totalDur > 0 ? Math.round((words / totalDur) * 60) : 0;
    const low = combinedText.toLowerCase();
    const usedChunks = (qObj?.chunks || []).filter((ch) => {
      const k = String(ch || '').toLowerCase().trim();
      return k.length >= 3 && low.includes(k);
    });
    const prevWords = prev.acoustic?.words || [];
    const prevSegs = prev.acoustic?.segments || [];
    ref.turns[idx] = {
      qId: qObj?.id || `q${idx + 1}`,
      q: qObj?.q || '',
      text: combinedText,
      durationSec: totalDur,
      audioUrl: res.audioUrl || prev.audioUrl || '',
      acoustic: {
        hasAudio: true,
        audioUrl: res.audioUrl || prev.audioUrl || '',
        durationSec: totalDur,
        words: [...prevWords, ...(res.words || [])],
        segments: [...prevSegs, ...(res.segments || [])],
      },
      words,
      wpm,
      usedChunks,
    };
  }

  function appendLiveTranscriptChunk(ref, chunk) {
    const clean = String(chunk || '').trim();
    if (!clean || !ref) return;
    if (ref.kind === 'part2') {
      ref.p2LiveTranscript = [ref.p2LiveTranscript || '', clean].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
      return;
    }
    const idx = Math.max(0, Math.min((ref.topic?.questions?.length || 1) - 1, ref.qIdx || 0));
    const qObj = ref.topic?.questions?.[idx];
    const prev = ref.turns[idx] || {};
    const combinedText = [prev.text || '', clean].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    const nowSec = Math.max(prev.durationSec || 0, Math.max(2, Math.round((Date.now() - (ref.liveTurnStartedAt || Date.now())) / 1000)));
    const words = countWords(combinedText);
    const wpm = nowSec > 0 ? Math.round((words / nowSec) * 60) : 0;
    const low = combinedText.toLowerCase();
    const usedChunks = (qObj?.chunks || []).filter((ch) => {
      const k = String(ch || '').toLowerCase().trim();
      return k.length >= 3 && low.includes(k);
    });
    ref.turns[idx] = {
      qId: qObj?.id || `q${idx + 1}`,
      q: qObj?.q || '',
      text: combinedText,
      durationSec: nowSec,
      audioUrl: prev.audioUrl || '',
      acoustic: {
        hasAudio: Boolean(prev.audioUrl),
        audioUrl: prev.audioUrl || '',
        durationSec: nowSec,
        words: [],
        segments: [],
      },
      words,
      wpm,
      usedChunks,
    };
    updateProQuestionChrome(ref);
  }

  async function tryStartGeminiLiveSession(ref) {
    if (!window.SpeakingGeminiLive?.startSession) return { ok: false, fallback: true };
    const exId = getProExaminerId();
    ref.liveTurnStartedAt = Date.now();
    const liveRes = await window.SpeakingGeminiLive.startSession({
      examinerId: exId,
      part: ref.kind === 'part2' ? 2 : ref.part,
      topicTitle: ref.kind === 'part2' ? (ref.cue?.title || '') : (ref.topic?.title || ''),
      cueTitle: ref.cue?.title || '',
      cueBullets: ref.cue?.bullets || [],
      questions: ref.topic?.questions || [],
      onExaminerSpeakingChange: (speaking) => {
        if (roomState !== ref || !ref.proStarted || ref.phase === 'review') return;
        ref.examinerSpeaking = speaking;
        ref.proVadState = speaking ? 'paused' : 'listening';
        if (speaking) {
          window.SpeakingExaminerCinema?.setMode?.('speaking');
          updateProStatusDom('⚡ Gemini Live · Giám khảo đang nói...', 'examiner');
        } else {
          ref.liveTurnStartedAt = Date.now();
          window.SpeakingExaminerCinema?.setMode?.('listening');
          updateProStatusDom('⚡ Gemini Live · Micro đang mở — Trò chuyện tự nhiên', 'listening');
        }
      },
      onLevel: ({ bars, isSpeaking, elapsedMs }) => {
        if (roomState !== ref) return;
        updateWaveBars('room', bars);
        window.SpeakingExaminerCinema?.feedMicLevel?.(bars);
        if (isSpeaking && ref.kind === 'interview') {
          ref.recElapsedSec = Math.round(elapsedMs / 1000);
          const clock = document.getElementById('sp-int-rec-time');
          if (clock) clock.textContent = fmtMmSs(ref.recElapsedSec);
        }
      },
      onCandidateTranscript: (chunk) => {
        if (roomState !== ref) return;
        appendLiveTranscriptChunk(ref, chunk);
      },
      onAdvanceQuestion: (newIdx) => {
        if (roomState !== ref || ref.kind !== 'interview') return;
        const maxIdx = Math.max(0, (ref.topic?.questions?.length || 1) - 1);
        const clamped = Math.max(0, Math.min(maxIdx, Number(newIdx) || 0));
        if (clamped !== ref.qIdx) {
          ref.qIdx = clamped;
          ref.liveTurnStartedAt = Date.now();
          updateProQuestionChrome(ref);
        }
      },
      onExamFinish: (audioUrl) => {
        if (roomState !== ref) return;
        ref.geminiLiveActive = false;
        cleanupProEngines();
        if (ref.kind === 'interview') {
          if (audioUrl) {
            const lastAnswered = [...ref.turns].reverse().find((t) => countWords(t.text) > 0);
            if (lastAnswered) {
              lastAnswered.audioUrl = audioUrl;
              if (lastAnswered.acoustic) {
                lastAnswered.acoustic.hasAudio = true;
                lastAnswered.acoustic.audioUrl = audioUrl;
              }
            }
          }
          const hasAny = ref.turns.some((t) => countWords(t.text) > 0);
          if (hasAny) finishInterview();
          else {
            toast('Chưa ghi nhận câu trả lời nào trong phiên thi Live.');
            ref.proStarted = false;
            rerenderActiveRoom();
          }
        } else {
          const fullTxt = String(ref.p2LiveTranscript || '').trim();
          const totalDur = Math.max(15, 120 - Math.max(0, ref.secsLeft || 0));
          if (countWords(fullTxt) >= 5) {
            finalizeRoomAttempt(fullTxt, totalDur, audioUrl || '', {
              hasAudio: Boolean(audioUrl),
              audioUrl: audioUrl || '',
              durationSec: totalDur,
              words: [],
              segments: [],
            });
          } else {
            toast('Chưa thu được đủ lời nói Part 2 — bạn có thể bắt đầu lại phiên thi.');
            ref.proStarted = false;
            ref.phase = 'prep';
            ref.secsLeft = 60;
            rerenderActiveRoom();
          }
        }
      },
      onUnexpectedClose: () => {
        if (roomState !== ref || !ref.geminiLiveActive) return;
        ref.geminiLiveActive = false;
        toast('Kết nối Gemini Live tạm ngắt — bạn có thể bấm Chấm sớm hoặc vào lại phiên thi.');
      },
    });
    if (liveRes?.ok && roomState === ref) {
      ref.geminiLiveActive = true;
      return { ok: true };
    }
    return liveRes || { ok: false, fallback: true };
  }

  async function startProExamSession() {
    const ref = roomState;
    if (!ref) return;

    ref.geminiLiveActive = false;
    ref.p2LiveTranscript = '';
    ref.repeatCount = 0;
    ref.probeCount = 0;
    ref.noSpeechNudges = 0;
    ref.p2RoundingOff = false;
    ref.p2SpeechParts = [];

    let stageAlreadyLive = false;
    // Try Tier 1: Gemini Live Native Audio (~0.3s real-time speech-to-speech) for Part 1 & Part 3!
    if (ref.kind === 'interview') {
      ref.proStarted = true;
      stageAlreadyLive = true;
      rerenderActiveRoom();
      updateProStatusDom('Đang kết nối phòng thi trực tiếp...', 'processing');
      const liveAttempt = await tryStartGeminiLiveSession(ref);
      if (roomState !== ref) return;
      if (liveAttempt.ok) {
        if (boundProKeyHandler) window.removeEventListener('keydown', boundProKeyHandler);
        boundProKeyHandler = (e) => {
          if (e.code === 'Space' && roomState?.proStarted && getRoomViewMode() === 'pro3d') {
            const tag = String(document.activeElement?.tagName || '').toLowerCase();
            if (tag === 'textarea' || tag === 'input') return;
            e.preventDefault();
            finishProTurnManual();
          }
        };
        window.addEventListener('keydown', boundProKeyHandler);
        updateProStatusDom('⚡ Gemini Live · Giám khảo đang bắt đầu...', 'examiner');
        return;
      }
      if (!liveAttempt.fallback && liveAttempt.error) {
        ref.proStarted = false;
        rerenderActiveRoom();
        toast(liveAttempt.error);
        return;
      }
    }

    const ok = await window.SpeakingVADEngine?.openSession?.({
      onLevel: ({ bars, isSpeaking, elapsedMs }) => {
        updateWaveBars('room', bars);
        window.SpeakingExaminerCinema?.feedMicLevel?.(bars);
        if (isSpeaking && roomState === ref) {
          ref.recElapsedSec = Math.round(elapsedMs / 1000);
          const clock = document.getElementById('sp-int-rec-time');
          if (clock && ref.kind === 'interview') clock.textContent = fmtMmSs(ref.recElapsedSec);
        }
      },
      onStateChange: (st) => {
        if (roomState !== ref) return;
        ref.proVadState = st;
        if (st === 'speaking') {
          updateProStatusDom('Giám khảo đang lắng nghe bạn...', 'speaking');
        } else if (st === 'listening') {
          updateProStatusDom('Micro đang mở — Mời bạn trả lời', 'listening');
        } else if (st === 'processing') {
          updateProStatusDom('Đang xử lý câu trả lời...', 'processing');
        }
      },
      onTurnResult: (res) => handleProVadTurnResult(res),
      onNoSpeech: () => handleProNoSpeech(),
      onError: (msg) => {
        toast(String(msg || 'Lỗi Micro liên tục.'));
      },
    });
    if (!ok || roomState !== ref) {
      if (roomState === ref && stageAlreadyLive) {
        ref.proStarted = false;
        rerenderActiveRoom();
      }
      return;
    }

    ref.proStarted = true;
    ref.repeatCount = 0;
    ref.probeCount = 0;
    ref.noSpeechNudges = 0;
    ref.p2RoundingOff = false;
    ref.p2SpeechParts = [];

    if (boundProKeyHandler) window.removeEventListener('keydown', boundProKeyHandler);
    boundProKeyHandler = (e) => {
      if (e.code === 'Space' && roomState?.proStarted && getRoomViewMode() === 'pro3d') {
        const tag = String(document.activeElement?.tagName || '').toLowerCase();
        if (tag === 'textarea' || tag === 'input') return;
        e.preventDefault();
        finishProTurnManual();
      }
    };
    window.addEventListener('keydown', boundProKeyHandler);

    if (!stageAlreadyLive) rerenderActiveRoom();

    // Non-blocking optional Tier 2 Simli WebRTC activation (auto-skips cleanly if unconfigured)
    const exId = getProExaminerId();
    window.SpeakingExaminerCinema?.connectSimliIfConfigured?.(exId)?.catch?.(() => {});

    if (ref.kind === 'interview') {
      const q1Obj = ref.topic?.questions?.[0];
      const q2Obj = ref.topic?.questions?.[1];
      const q1 = q1Obj?.q || '';
      if (q1Obj?.id) window.SpeakingExaminerCinema?.preloadClip?.(exId, q1Obj.id);
      if (q2Obj?.id) window.SpeakingExaminerCinema?.preloadClip?.(exId, q2Obj.id);
      const intro = ref.part === 1
        ? `Good afternoon. In this first part, I'd like to ask you some questions about ${ref.topic?.title || 'this topic'}. ${q1}`
        : `Now, let's discuss some more general questions related to ${ref.topic?.title || 'this topic'}. ${q1}`;
      proExaminerSpeakAndListen(intro, getProTurnListenConfig(), 0.96, q1Obj?.id || '');
    } else {
      // Part 2 Official Cambridge 60s Prep Intro
      startRoomTimer();
      window.SpeakingExaminerCinema?.setMode?.('prep');
      window.SpeakingExaminerCinema?.preloadClip?.(exId, 'sys_p2_start_speak');
      proExaminerSpeakAndListen(
        "Now, I'm going to give you a topic, and I'd like you to talk about it for one to two minutes. Before you talk, you'll have one minute to think about what you're going to say, and you can make some notes if you wish.",
        null,
        0.96,
        'sys_p2_prep_intro'
      );
      setTimeout(() => {
        if (roomState === ref && ref.phase === 'prep') {
          window.SpeakingExaminerCinema?.setMode?.('prep');
          updateProStatusDom('Chuẩn bị 1 phút · Ghi chú trên giấy nháp trắng', 'paused');
        }
      }, 9000);
    }
  }

  function finishProTurnManual() {
    if (roomState?.geminiLiveActive && window.SpeakingGeminiLive?.isActive?.()) {
      window.SpeakingGeminiLive.sendClientText('[The candidate has finished their turn. Please respond naturally as the IELTS examiner now.]');
      return;
    }
    window.SpeakingVADEngine?.finishTurnNow?.();
  }

  function renderModeSwitchHtml() {
    const isPro = getRoomViewMode() === 'pro3d';
    return `
      <div class="sp-mode-switch" role="group" aria-label="Chế độ giao diện phòng thi" onclick="event.stopPropagation()">
        <button type="button" class="sp-mode-btn ${!isPro ? 'is-active' : ''}" onclick="SpeakingStudio.setRoomViewMode('standard')" title="Chế độ luyện tập 2 cột có gợi ý">Chuẩn</button>
        <button type="button" class="sp-mode-btn ${isPro ? 'is-active' : ''}" onclick="SpeakingStudio.setRoomViewMode('pro3d')" title="Phòng thi thật 100% — Không gợi ý · Micro liên tục">
          <span class="sp-mode-pro-dot" aria-hidden="true"></span><span>3D Pro</span>
        </button>
      </div>
    `;
  }

  function renderProLobbyHtml(partNum, topicTitle, examinerId) {
    return `
      <div class="sp-pro-lobby" id="sp-pro-lobby">
        <div class="sp-pro-lobby-card">
          <span class="sp-pro-lobby-badge">● Phòng Thi Thật 100% · Part ${partNum}</span>
          <div class="sp-pro-lobby-title">${esc(topicTitle)}</div>
          <p class="sp-pro-lobby-desc">Mô phỏng chuẩn phòng thi Video-Call British Council: <strong>không hiện câu hỏi, không gợi ý</strong>, Micro mở liên tục suốt phiên thi.</p>
          <div class="sp-pro-lobby-rules">
            <div class="sp-pro-lobby-rule"><strong>🎙 Nói liên tục rảnh tay</strong>Chỉ bật Micro 1 lần — nói xong ngưng ~2.5s Giám khảo tự phản hồi.</div>
            <div class="sp-pro-lobby-rule"><strong>🗣 Nghe không rõ? Hỏi thẳng!</strong>Nói <em>"Could you repeat that?"</em> (hoặc xin giải thích ở Part 3) ngay vào Mic.</div>
          </div>
          <div class="sp-pro-lobby-ex-row" role="group" aria-label="Chọn Giám khảo">
            <button type="button" class="sp-pro-lobby-ex-btn ${examinerId === 'claire' ? 'is-active' : ''}" onclick="SpeakingStudio.setProExaminer('claire')">Ms. Claire (UK · Nữ)</button>
            <button type="button" class="sp-pro-lobby-ex-btn ${examinerId === 'oliver' ? 'is-active' : ''}" onclick="SpeakingStudio.setProExaminer('oliver')">Mr. Oliver (UK · Nam)</button>
          </div>
          <button type="button" class="sp-pro-lobby-start" onclick="SpeakingStudio.startProExamSession()">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            <span>Bắt đầu phiên thi (Bật Micro liên tục)</span>
          </button>
          <button type="button" class="sp-pro-lobby-alt" onclick="SpeakingStudio.setRoomViewMode('standard')">Muốn luyện tập có gợi ý &amp; từ vựng? Chuyển sang chế độ Chuẩn</button>
        </div>
      </div>
    `;
  }

  function renderProStageShell({ stageClasses, examiner, statusLabel, topRightHtml, lobbyHtml, sidePanelHtml, controlBarHtml, barState }) {
    const cand = getCandidateDisplay();
    const camOn = Boolean(window.SpeakingExaminerCinema?.isWebcamActive?.());
    const barClass = barState === 'listening' || barState === 'speaking'
      ? 'is-live-mic'
      : (barState === 'examiner' ? 'is-examiner-speaking' : (barState === 'processing' ? 'is-processing' : ''));
    return `
      <div class="sp-pro-v2-shell">
        <div class="sp-pro-v2-main">
          <div class="sp-pro-stage ${stageClasses}" id="sp-pro-stage">
            <div class="sp-cinema-camera" id="sp-cinema-camera">
              <div class="sp-cinema-rig">
                <img class="sp-cinema-img is-speak-layer" src="${esc(examiner.speakImg)}" alt="${esc(examiner.name)}" draggable="false" />
                <img class="sp-cinema-img is-listen-layer" src="${esc(examiner.listenImg)}" alt="${esc(examiner.name)} đang lắng nghe" draggable="false" />
                <div class="sp-cinema-video-wrap" id="sp-cinema-video-wrap"></div>
              </div>
            </div>

            ${lobbyHtml || ''}

            <div class="sp-vc-top-bar">
              <div class="sp-vc-top-left">
                <div class="sp-pro-glass-pill">
                  <span class="sp-pro-live-dot" aria-hidden="true"></span>
                  <span id="sp-pro-status-lbl">${esc(statusLabel)}</span>
                </div>
              </div>
              <div class="sp-vc-top-right">
                ${topRightHtml || ''}
              </div>
            </div>

            <div class="sp-vc-bottom-row">
              <div class="sp-vc-nameplate">
                <span class="sp-vc-ex-wave" aria-hidden="true"><i></i><i></i><i></i></span>
                <span>${esc(examiner.name)}</span>
                <span class="sp-vc-nameplate-role">· British IELTS Examiner</span>
              </div>

              <div class="sp-vc-pip ${camOn ? 'is-cam-on' : ''}" id="sp-pro-pip" title="Khung thí sinh (Webcam xử lý 100% trên máy bạn)">
                <video class="sp-vc-pip-video" id="sp-pro-pip-video" autoplay muted playsinline></video>
                <div class="sp-vc-pip-avatar" aria-hidden="true">${esc(cand.initials)}</div>
                <div class="sp-vc-pip-foot">
                  <span class="sp-vc-pip-name">${esc(cand.name)}</span>
                  <button type="button" class="sp-vc-pip-cam-btn ${camOn ? 'is-active' : ''}" id="sp-pro-cam-btn" onclick="window.SpeakingExaminerCinema?.toggleCandidateCam()">${camOn ? 'Tắt Cam' : 'Bật Cam'}</button>
                </div>
              </div>
            </div>
          </div>

          ${sidePanelHtml || ''}
        </div>

        <div class="sp-pro-v2-bar ${barClass}" id="sp-pro-v2-bar">
          ${controlBarHtml || ''}
        </div>
      </div>
    `;
  }

  function commitProCinemaDom(root, html, examinerId, activeMode) {
    root.innerHTML = html;
    window.SpeakingExaminerCinema?.mount?.(examinerId, activeMode);
  }

  /* --- Speaking Part 2 Room (1-Min Prep -> 2-Min Speaking -> Review & Model) --- */
  function openPracticeRoom(cueId, mode, opts) {
    const fullTest = getFullSpeakingTest(cueId);
    if (fullTest) {
      startFullSpeakingTest(cueId, mode);
      return;
    }
    const p13 = getPart13Topic(cueId);
    if (p13) {
      openInterviewRoom(cueId, mode, opts);
      return;
    }
    if (!opts?.preserveFullTest) fullTestSession = null;
    ensureOverlays();
    STT()?.abort?.();
    clearInterval(roomState?.timerId);
    const cue = getPart2CueById(cueId);
    if (!cue) return;

    const DEFAULT_SP_PLAN = cue.isCambridge
      ? [
          '1. Giới thiệu chủ đề (Who / What / Where):',
          '- ',
          '',
          '2. Chi tiết & Trải nghiệm cụ thể:',
          '- ',
          '',
          '3. Cảm xúc & Lý do đáng nhớ (Explain why):',
          '- '
        ].join('\n')
      : [
          '1. Mở bài (B1–B3):',
          '- ',
          '',
          '2. Cốt truyện chính (B4):',
          '- ',
          '',
          '3. Kết bài chốt đề (B5):',
          '- '
        ].join('\n');

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const initContrast = mode === 'exam' ? 'cd' : (isDark ? 'dark' : 'totoro');

    if (!opts?.preserveFullTest) {
      state.pracPart = 2;
      window.TotoroUI?.recordLastSession?.({
        skill: 'Speaking',
        view: 'practice',
        label: `Speaking Part 2 · ${cue.title}`,
        action: "window.SpeakingStudio?.openPracticePart(2)"
      });
    }

    roomState = {
      kind: 'part2',
      cue,
      mode: mode === 'exam' ? 'exam' : 'practice',
      phase: 'prep',
      secsLeft: 60,
      timerId: null,
      notes: { sheet: (mode === 'exam' || getRoomViewMode() === 'pro3d') ? '' : DEFAULT_SP_PLAN },
      checkedBullets: {},
      recording: false,
      processing: false,
      typeMode: false,
      recStartedAt: 0,
      transcript: '',
      audioUrl: '',
      metrics: null,
      showFullB4: false,
      showPrepHint: false,
      proStarted: false,
      proVadState: 'paused',
      proStatusText: 'Chờ bắt đầu phiên thi Part 2',
      repeatCount: 0,
      probeCount: 0,
      noSpeechNudges: 0,
      p2RoundingOff: false,
      p2SpeechParts: [],
      proDrawerOpen: true,
      blindCaptions: false,
      examinerSpeaking: false,
      examinerSpeakTimer: null,
      strikes: 0,
      contrast: initContrast,
      textSize: 'regular'
    };

    const el = document.getElementById('sp-practice-room');
    el.className = `sp-exam-room open ins-shell ins-contrast-${initContrast} ins-size-regular ${roomState.mode === 'exam' ? 'is-exam ins-mode-exam' : 'is-practice'}`;
    if (getRoomViewMode() !== 'pro3d') startRoomTimer();
    renderPracticeRoom();
  }

  function toggleRoomOptions(forceState) {
    const pop = document.getElementById('sp-prac-opt-pop');
    if (!pop) return;
    if (typeof forceState === 'boolean') pop.classList.toggle('open', forceState);
    else pop.classList.toggle('open');
  }

  function setRoomContrast(contrast) {
    if (!roomState) return;
    roomState.contrast = contrast;
    const el = document.getElementById('sp-practice-room');
    if (el) {
      el.classList.remove('ins-contrast-totoro', 'ins-contrast-dark', 'ins-contrast-cd', 'ins-contrast-yellow');
      el.classList.add(`ins-contrast-${contrast}`);
    }
    document.querySelectorAll('#sp-prac-opt-pop [data-contrast]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-contrast') === contrast);
    });
  }

  function setRoomTextSize(size) {
    if (!roomState) return;
    roomState.textSize = size;
    const el = document.getElementById('sp-practice-room');
    if (el) {
      el.classList.remove('ins-size-regular', 'ins-size-large', 'ins-size-xlarge');
      el.classList.add(`ins-size-${size}`);
    }
    document.querySelectorAll('#sp-prac-opt-pop [data-size]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-size') === size);
    });
  }

  function closePracticeRoom() {
    clearInterval(roomState?.timerId);
    clearExaminerSpeaking();
    cleanupProEngines();
    STT()?.abort?.();
    roomState = null;
    fullTestSession = null;
    const el = document.getElementById('sp-practice-room');
    if (el) el.className = 'sp-exam-room';
    renderPracticeHub();
  }

  function playRoomChime(kind) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = kind === 'start' ? 660 : 520;
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (kind === 'start' ? 0.28 : 0.16));
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + (kind === 'start' ? 0.3 : 0.18));
      setTimeout(() => ctx.close().catch(() => {}), 450);
    } catch (_) {}
  }

  function toggleRoomBullet(idx) {
    if (!roomState) return;
    if (!roomState.checkedBullets) roomState.checkedBullets = {};
    roomState.checkedBullets[idx] = !roomState.checkedBullets[idx];
    renderPracticeRoom();
  }

  function buildAnnotatedTranscriptHtml(rawText, usedChunks, errors) {
    let html = esc(String(rawText || ''));
    if (!html) return '';
    // 1. Highlight Spoken Chunks used (Green)
    (usedChunks || []).slice(0, 12).forEach((ch) => {
      const clean = String(ch || '').trim();
      if (clean.length < 3) return;
      const re = new RegExp(`(${esc(clean).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      html = html.replace(re, '<mark class="sp-tr-chunk" title="Spoken Chunk ăn điểm Band 7+">$1</mark>');
    });
    // 2. Highlight hesitation fillers (Amber)
    html = html.replace(/\b(um+|uh+|er+|erm+|hmm+|you know|actually|basically|like)\b/gi, (m) => {
      return `<mark class="sp-tr-filler" title="Từ đệm — nên tiết chế để giữ độ trôi chảy (FC)">${m}</mark>`;
    });
    // 3. Highlight grammar/lexis errors detected by IeltsGrader (Red underline + fix tooltip)
    (errors || []).slice(0, 6).forEach((er) => {
      const orig = String(er?.original || '').trim();
      if (orig.length < 3) return;
      const tip = esc(`${er.issueVi || 'Cần chỉnh lại'}${er.fix ? ' → Gợi ý: ' + er.fix : ''}`);
      const re = new RegExp(`(${esc(orig).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'i');
      html = html.replace(re, `<mark class="sp-tr-err" title="${tip}">$1</mark>`);
    });
    return html;
  }

  function startRoomTimer() {
    clearInterval(roomState?.timerId);
    roomState.timerId = setInterval(() => {
      if (!roomState || roomState.phase === 'review') return;
      roomState.secsLeft--;
      const el = document.getElementById('sp-room-timer');
      if (el) {
        const suffix = roomState.phase === 'prep' ? ' chuẩn bị' : ' trình bày';
        el.textContent = `${fmtMmSs(roomState.secsLeft)}${suffix}`;
      }
      const ringEl = document.getElementById('sp-room-ring-time');
      if (ringEl) ringEl.textContent = fmtMmSs(roomState.secsLeft);
      const ringArc = document.getElementById('sp-room-ring-arc');
      if (ringArc) {
        const totalSec = roomState.phase === 'prep' ? 60 : 120;
        const dialCirc = roomState.phase === 'prep' ? 163.36 : 314.16;
        const dialOff = (dialCirc * (1 - Math.max(0, Math.min(1, roomState.secsLeft / totalSec)))).toFixed(1);
        ringArc.setAttribute('stroke-dashoffset', dialOff);
        if (roomState.phase === 'prep') {
          ringArc.setAttribute('stroke', roomState.secsLeft <= 10 ? 'var(--danger)' : (roomState.secsLeft <= 20 ? '#c47a1b' : 'var(--accent)'));
        }
      }
      if (roomState.phase === 'prep') {
        const pFill = document.getElementById('sp-prep-zone-fill');
        if (pFill) pFill.style.width = `${Math.min(100, Math.max(0, Math.round(((60 - roomState.secsLeft) / 60) * 100)))}%`;
      }
      if (roomState.phase === 'prep' && roomState.secsLeft === 10) playRoomChime('warn');
      if (roomState.phase === 'speak') {
        const elapsed = Math.max(0, 120 - roomState.secsLeft);
        const zFill = document.getElementById('sp-zone-fill');
        const zTxt = document.getElementById('sp-zone-status');
        if (zFill) zFill.style.width = `${Math.min(100, Math.round((elapsed / 120) * 100))}%`;
        if (zTxt) {
          zTxt.textContent = elapsed >= 90
            ? '✓ Vùng lý tưởng Band 7+ (1:30–2:00)'
            : (elapsed >= 60 ? 'Đạt mức tối thiểu (1:00+) · Nói thêm để đạt 1:30' : `Đang nói ${fmtMmSs(elapsed)} · Mục tiêu ≥ 1:30`);
          zTxt.classList.toggle('is-ideal', elapsed >= 90);
        }
      }
      if (roomState.secsLeft <= 0) {
        if (roomState.phase === 'prep') {
          playRoomChime('start');
          beginRoomSpeaking(roomState.mode === 'exam');
        } else if (roomState.phase === 'speak') {
          clearInterval(roomState.timerId);
          if (getRoomViewMode() === 'pro3d' && roomState.proStarted) {
            if (roomState.geminiLiveActive && window.SpeakingGeminiLive?.isActive?.()) {
              window.SpeakingGeminiLive.sendClientText('[Two minutes are up. Politely stop the candidate now, say Thank you, and ask ONE brief rounding-off question.]');
            } else {
              window.SpeakingVADEngine?.finishTurnNow?.();
            }
          } else if (roomState.recording) {
            toggleRoomMic();
          } else {
            toast('Hết 2 phút nói — hãy bấm Nộp bài để xem đối chiếu!');
          }
        }
      }
    }, 1000);
  }

  function saveRoomNote(key, val) {
    if (roomState) roomState.notes[key] = val;
  }

  function resetRoomPlan() {
    if (!roomState) return;
    const isCam = Boolean(roomState.cue?.isCambridge);
    roomState.notes.sheet = roomState.mode === 'exam'
      ? ''
      : (isCam
        ? '1. Giới thiệu chủ đề (Who / What / Where):\n- \n\n2. Chi tiết & Trải nghiệm cụ thể:\n- \n\n3. Cảm xúc & Lý do đáng nhớ (Explain why):\n- '
        : '1. Mở bài (B1–B3):\n- \n\n2. Cốt truyện chính (B4):\n- \n\n3. Kết bài chốt đề (B5):\n- ');
    const ta = document.getElementById('sp-room-plan-ta');
    if (ta) ta.value = roomState.notes.sheet;
  }

  async function beginRoomSpeaking(autoStartMic) {
    if (!roomState) return;
    const ref = roomState;
    ref.phase = 'speak';
    ref.secsLeft = 120;
    startRoomTimer();
    renderPracticeRoom();
    if (getRoomViewMode() === 'pro3d' && ref.proStarted) {
      // Try Gemini Live Native Audio for real-time Part 2 Long Turn + Rounding-off!
      window.SpeakingVADEngine?.closeSession?.();
      const liveAttempt = await tryStartGeminiLiveSession(ref);
      if (roomState !== ref) return;
      if (liveAttempt.ok) return;
      // Fallback seamlessly to 0 VND/month VAD + British Neural TTS
      await window.SpeakingVADEngine?.openSession?.({
        onLevel: ({ bars }) => { updateWaveBars('room', bars); window.SpeakingExaminerCinema?.feedMicLevel?.(bars); },
        onStateChange: (st) => {
          if (roomState !== ref) return;
          ref.proVadState = st;
          if (st === 'speaking') updateProStatusDom('Giám khảo đang lắng nghe bạn...', 'speaking');
          else if (st === 'listening') updateProStatusDom('Micro đang mở — Mời bạn trình bày Part 2', 'listening');
          else if (st === 'processing') updateProStatusDom('Đang xử lý câu trả lời...', 'processing');
        },
        onTurnResult: (res) => handleProVadTurnResult(res),
        onNoSpeech: () => handleProNoSpeech(),
        onError: (msg) => toast(String(msg || 'Lỗi Micro liên tục.')),
      });
      if (roomState !== ref) return;
      proExaminerSpeakAndListen(
        "Alright? Remember you have one to two minutes for this, so don't worry if I stop you. I'll tell you when the time is up. Can you start speaking now, please?",
        getProTurnListenConfig(),
        0.96,
        'sys_p2_start_speak'
      );
      return;
    }
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
    clearExaminerSpeaking();
    roomState.recording = true;
    roomState.processing = false;
    roomState.recStartedAt = Date.now();
    renderPracticeRoom();
    stt.startRecording({
      mode: 'speaking',
      autoStopOnSilence: false,
      maxDurationMs: 125000,
      onLevel: ({ bars }) => { updateWaveBars('room', bars); window.SpeakingExaminerCinema?.feedMicLevel?.(bars); },
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
        finalizeRoomAttempt(res.text, dur, res.audioUrl || '', {
          hasAudio: true,
          audioUrl: res.audioUrl || '',
          durationSec: dur,
          words: res.words || [],
          segments: res.segments || [],
        });
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
    finalizeRoomAttempt(val, dur, '', { hasAudio: false, durationSec: dur, words: [], segments: [] });
  }

  async function finalizeRoomAttempt(text, durationSec, audioUrl, acoustic) {
    if (!roomState) return;
    clearInterval(roomState.timerId);
    const activeRoomRef = roomState;
    const isCam = Boolean(activeRoomRef.cue?.isCambridge);
    roomState.transcript = text;
    roomState.audioUrl = audioUrl;
    roomState.metrics = evaluateFullSpeech(text, durationSec, isCam ? (activeRoomRef.cue.chunks || []) : null);
    roomState.phase = 'review';
    roomState.grading = Boolean(window.IeltsGrader?.gradeSpeaking);
    roomState.report = null;
    renderPracticeRoom();

    const story = getStory();
    let report = null;
    if (window.IeltsGrader?.gradeSpeaking) {
      try {
        report = await window.IeltsGrader.gradeSpeaking({
          part: 2,
          cueTitle: activeRoomRef.cue?.title || '',
          cueBullets: activeRoomRef.cue?.bullets || [],
          curriculumContext: isCam ? (activeRoomRef.cue?.modelEn || '') : (story?.fullSpeech?.en || []).join(' '),
          curriculumKeywords: isCam ? (activeRoomRef.cue?.chunks || []).join(' ') : (story?.spokenChunks || []).map((c) => c.en).join(' '),
          text,
          acoustic: acoustic || { hasAudio: Boolean(audioUrl), audioUrl, durationSec },
        });
      } catch (err) {
        console.warn('[SpeakingStudio] Practice Room IELTS grader error:', err);
      }
    }

    if (roomState === activeRoomRef) {
      roomState.grading = false;
      roomState.report = report;
    }

    const attemptPayload = {
      part: 2,
      cueId: activeRoomRef.cue.id,
      cueTitle: activeRoomRef.cue.title,
      mode: activeRoomRef.mode,
      band: report ? report.overall : null,
      criteria: report ? {
        fc: report.criteria.fc.band,
        lr: report.criteria.lr.band,
        gra: report.criteria.gra.band,
        pr: report.criteria.pr.band,
      } : null,
      durationSec: activeRoomRef.metrics.durationSec,
      wpm: activeRoomRef.metrics.wpm,
      words: activeRoomRef.metrics.words,
      chunksCount: activeRoomRef.metrics.usedChunks.length,
      usedChunks: activeRoomRef.metrics.usedChunks || [],
      fillerCount: activeRoomRef.metrics.fillerCount,
      transcript: text,
      report: report || null,
      at: Date.now()
    };

    const hist = getPracHistory();
    hist.unshift(attemptPayload);
    savePracHistory(hist.slice(0, 80));

    if (fullTestSession && fullTestSession.stage === 2 && fullTestSession.test.part2Id === activeRoomRef.cue.id) {
      recordFullTestStageResult('p2', attemptPayload);
    }

    if (roomState === activeRoomRef) renderPracticeRoom();
  }

  function toggleRoomFullB4() {
    if (!roomState) return;
    roomState.showFullB4 = !roomState.showFullB4;
    renderPracticeRoom();
  }

  function toggleRoomPrepHint() {
    if (!roomState || roomState.mode === 'exam') return;
    roomState.showPrepHint = !roomState.showPrepHint;
    renderPracticeRoom();
  }

  function renderPracticeRoom() {
    if (!roomState) return;
    const { cue, mode, phase, secsLeft, notes, recording, processing, typeMode, transcript, audioUrl, metrics } = roomState;
    const isExam = mode === 'exam';
    const root = document.getElementById('sp-practice-room');
    const story = getStory();
    const fs = story?.fullSpeech || { en: [] };

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

    const acChipHtml = phase !== 'review' ? `
      <span class="rp-ac-shield ${roomState.strikes > 0 ? 'is-warn' : ''}" id="sp-prac-ac-pill" title="Chống gian lận đang bật trong phòng nói (khóa rời tab, tối đa 2 lần)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span id="sp-prac-ac-text">${roomState.strikes > 0 ? `Cảnh báo ${roomState.strikes}/2` : 'Anti-Cheat'}</span>
      </span>
    ` : '';

    const timerLabel = phase === 'review'
      ? 'Đã hoàn thành Part 2'
      : `${fmtMmSs(secsLeft)} ${phase === 'prep' ? 'chuẩn bị' : 'trình bày'}`;

    const meterPct = phase === 'prep' ? 33 : (phase === 'speak' ? 68 : 100);
    const dialCirc = 314.16;
    const dialOff = (dialCirc * (1 - Math.max(0, Math.min(1, secsLeft / 120)))).toFixed(1);

    let rightPaperHtml = '';
    if (phase === 'prep') {
      const prepCirc = 163.36;
      const prepOff = (prepCirc * (1 - Math.max(0, Math.min(1, secsLeft / 60)))).toFixed(1);
      const prepColor = secsLeft <= 10 ? 'var(--danger)' : (secsLeft <= 20 ? '#c47a1b' : 'var(--accent)');
      rightPaperHtml = `
        <div class="ws-prac-paper-card sp-studio-paper">
          <div class="ws-prac-paper-head">
            <div class="ws-prac-paper-title-grp">
              <span class="ws-prac-paper-ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
              </span>
              <span class="ws-prac-paper-title">${isExam ? 'Giấy Nháp Thi Thật (60 giây)' : 'Planning · Giấy nháp nhanh (60 giây)'}</span>
            </div>
            <div class="ws-prac-paper-badges">
              ${!isExam ? `<button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.resetRoomPlan()">Đặt lại</button>` : ''}
              <div class="sp-prep-mini-ring" title="Đồng hồ đếm ngược 1 phút chuẩn bị (đổi màu ở 20s &amp; 10s)">
                <svg viewBox="0 0 60 60" width="38" height="38" aria-hidden="true">
                  <circle cx="30" cy="30" r="26" fill="none" stroke="var(--bg-subtle)" stroke-width="5"/>
                  <circle id="sp-room-ring-arc" cx="30" cy="30" r="26" fill="none" stroke="${prepColor}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${prepCirc}" stroke-dashoffset="${prepOff}" transform="rotate(-90 30 30)"/>
                </svg>
                <span class="tabular" id="sp-room-ring-time">${fmtMmSs(secsLeft)}</span>
              </div>
            </div>
          </div>
          <div class="ws-prac-paper-meter" aria-hidden="true">
            <span class="ws-prac-paper-meter-fill" style="width:${meterPct}%"></span>
          </div>
          <textarea class="ws-ins-editor ws-prac-editor sp-room-sheet-ta" id="sp-room-plan-ta" spellcheck="false"
            placeholder="Ghi nhanh các từ khóa dàn ý (Who · When · Story · Lesson) trước khi nói 2 phút..."
            oninput="SpeakingStudio.saveRoomNote('sheet', this.value)">${esc(notes.sheet || '')}</textarea>
          <div class="ws-prac-paper-foot">
            <div class="ws-prac-paper-foot-l">
              <span class="ws-prac-wc-note">Đánh dấu từng ý ở Cue Card bên trái khi bạn chuẩn bị xong · Hết 60s tự chuyển phần nói</span>
            </div>
          </div>
        </div>
      `;
    } else if (phase === 'speak') {
      const elapsedSec = Math.max(0, 120 - secsLeft);
      const zonePct = Math.min(100, Math.round((elapsedSec / 120) * 100));
      rightPaperHtml = `
        <div class="ws-prac-paper-card sp-studio-paper">
          <div class="ws-prac-paper-head">
            <div class="ws-prac-paper-title-grp">
              <span class="ws-prac-paper-ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </span>
              <span class="ws-prac-paper-title">Phòng Thu Âm Part 2</span>
              <span class="ws-prac-para-pill tabular">Mục tiêu 1:30 – 2:00</span>
            </div>
            <div class="ws-prac-paper-badges">
              ${!isExam ? `<button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.toggleRoomTypeMode()">${typeMode ? 'Dùng Mic AI' : 'Gõ dự phòng'}</button>` : ''}
            </div>
          </div>
          <div class="ws-prac-paper-meter" aria-hidden="true">
            <span class="ws-prac-paper-meter-fill" style="width:${meterPct}%"></span>
          </div>

          ${typeMode ? `
            <textarea class="ws-ins-editor ws-prac-editor sp-room-sheet-ta" id="sp-room-ta" spellcheck="false"
              placeholder="Gõ bài nói Part 2 của bạn tại đây..."></textarea>
            <div class="ws-prac-paper-foot">
              <div class="ws-prac-paper-foot-l"><span class="ws-prac-wc-note">Chế độ gõ dự phòng · Tối thiểu 20 từ để chấm đối chiếu</span></div>
            </div>
          ` : `
            <div class="sp-room-mic-body">
              <div class="sp-t4-ring-wrap" style="width:132px;height:132px;">
                <svg viewBox="0 0 120 120" class="sp-t4-ring-svg" aria-hidden="true">
                  <circle cx="60" cy="60" r="50" fill="none" stroke="var(--bg-subtle)" stroke-width="7"/>
                  <circle id="sp-room-ring-arc" class="sp-ring-arc" cx="60" cy="60" r="50" fill="none" stroke="${recording ? 'var(--danger)' : 'var(--accent)'}" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dialCirc}" stroke-dashoffset="${dialOff}"/>
                </svg>
                <div class="sp-t4-ring-center">
                  <div class="sp-t4-ring-time tabular" id="sp-room-ring-time">${fmtMmSs(secsLeft)}</div>
                  <div class="sp-t4-ring-sub">${recording ? 'Đang thu âm' : 'Mục tiêu 2 phút'}</div>
                </div>
              </div>
              <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="room"></span>`).join('')}</div>
              <div class="sp-zone-gauge">
                <div class="sp-zone-track">
                  <span class="sp-zone-ideal" title="Vùng thời lượng lý tưởng Band 7+ (1:30 – 2:00)"></span>
                  <span class="sp-zone-fill" id="sp-zone-fill" style="width:${zonePct}%"></span>
                </div>
                <div class="sp-zone-marks tabular"><span>0:00</span><span>1:00 (Tối thiểu)</span><span>1:30–2:00 (Lý tưởng)</span></div>
                <div class="sp-zone-status ${elapsedSec >= 90 ? 'is-ideal' : ''}" id="sp-zone-status">${elapsedSec >= 90 ? '✓ Vùng lý tưởng Band 7+ (1:30–2:00)' : `Đang nói ${fmtMmSs(elapsedSec)} · Mục tiêu ≥ 1:30`}</div>
              </div>
              <button type="button" class="sp-mic-btn ${recording ? 'is-recording' : ''}" ${processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleRoomMic()">
                <span>${processing ? 'Đang chấm giọng nói...' : (recording ? 'Dừng & Nộp bài nói' : 'Bấm Mic bắt đầu nói 2 phút')}</span>
              </button>
              <div style="font-size:12.5px;color:var(--ink-2);">Giữ nhịp nói tự nhiên 120–155 WPM · Chạm dấu ✓ trên từng ý Cue Card khi nói xong.</div>
            </div>
            <div class="ws-prac-paper-foot">
              <div class="ws-prac-paper-foot-l"><span class="ws-prac-wc-note">Tự động phân tích Transcript tô màu Spoken Chunks · Từ đệm · Lỗi ngữ pháp</span></div>
              ${!isExam ? `<button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.toggleRoomTypeMode()">Gõ dự phòng</button>` : ''}
            </div>
          `}
        </div>
      `;
    } else {
      const m = metrics;
      const annotatedHtml = buildAnnotatedTranscriptHtml(transcript, m.usedChunks, roomState.report?.errors || []);
      const prevAttempts = getPracHistory().filter((h) => h.cueId === cue.id).slice(0, 4);
      rightPaperHtml = `
        <div class="ws-prac-paper-card sp-studio-paper">
          <div class="ws-prac-paper-head">
            <div class="ws-prac-paper-title-grp">
              <span class="ws-prac-paper-ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span class="ws-prac-paper-title">Scorecard · Kết quả bài nói Part 2</span>
              <span class="ws-prac-para-pill tabular">${m.words} từ</span>
            </div>
            <div class="ws-prac-paper-badges">
              <button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.openPracticeRoom('${esc(cue.id)}', '${esc(mode)}', { preserveFullTest: ${Boolean(fullTestSession)} })">Nói lại</button>
              ${fullTestSession && fullTestSession.stage === 2
                ? `<button type="button" class="ws-prac-submit-pill" style="height:30px;padding:0 13px;font-size:12px;" onclick="SpeakingStudio.advanceFullSpeakingTest()">Tiếp sang Part 3 →</button>`
                : `<button type="button" class="ws-prac-submit-pill" style="height:30px;padding:0 13px;font-size:12px;" onclick="SpeakingStudio.closePracticeRoom()">Về kho đề</button>`}
            </div>
          </div>
          <div class="ws-prac-paper-meter" aria-hidden="true">
            <span class="ws-prac-paper-meter-fill" style="width:100%"></span>
          </div>
          <div class="sp-room-review-scroll">
            ${roomState.grading
              ? (window.IeltsGrader?.renderLoadingHtml('Giám khảo IELTS Speaking AI đang chấm 4 tiêu chí FC / LR / GRA / PR & phân tích bài nói...') || '')
              : (roomState.report && window.IeltsGrader?.renderExaminerReportHtml
                ? window.IeltsGrader.renderExaminerReportHtml(roomState.report, { title: 'Kết quả chấm IELTS Speaking Part 2' })
                : '')}
            <div class="sp-metrics-grid">
              <div class="sp-metric-box"><div class="sp-metric-val">${fmtMmSs(m.durationSec)}</div><div class="sp-metric-lbl">Thời lượng</div></div>
              <div class="sp-metric-box"><div class="sp-metric-val">${m.wpm}</div><div class="sp-metric-lbl">Tốc độ (WPM)</div></div>
              <div class="sp-metric-box"><div class="sp-metric-val">${m.usedChunks.length}</div><div class="sp-metric-lbl">Spoken Chunks</div></div>
              <div class="sp-metric-box"><div class="sp-metric-val">${m.fillerCount}</div><div class="sp-metric-lbl">Từ đệm</div></div>
            </div>
            ${audioUrl ? `<audio class="sp-audio-replay" style="max-width:100%;" controls src="${esc(audioUrl)}"></audio>` : ''}
            <div class="sp-transcript-box">
              <div class="sp-tr-legend-head">
                <strong>Bản nói đã phân tích màu (Transcript)</strong>
                <div class="sp-tr-legend-chips">
                  <span class="sp-tr-leg is-chunk">Spoken Chunk</span>
                  <span class="sp-tr-leg is-filler">Từ đệm</span>
                  <span class="sp-tr-leg is-err">Lỗi cần sửa</span>
                </div>
              </div>
              <div class="sp-tr-annotated">${annotatedHtml}</div>
              ${m.usedChunks.length ? `<div class="sp-kw-row" style="margin-top:10px;">${m.usedChunks.map((c) => `<span class="sp-kw-chip hit">✓ ${esc(c)}</span>`).join('')}</div>` : ''}
            </div>
            ${prevAttempts.length > 1 ? `
              <div class="sp-trend-strip">
                <strong>Tiến bộ các lần nói đề này:</strong>
                <div class="sp-trend-pills">
                  ${prevAttempts.slice().reverse().map((a, idx) => `<span class="sp-trend-pill tabular">Lần ${idx + 1}: ${a.band ? 'Band ' + Number(a.band).toFixed(1) : a.words + 'w'} · ${a.wpm || 0} WPM</span>`).join(' → ')}
                </div>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    const roomOptHtml = isExam
      ? `
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Contrast</div>
          <div class="ws-ins-opt-grid">
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'cd' ? 'active' : ''}" data-contrast="cd" onclick="SpeakingStudio.setRoomContrast('cd')">Black on White</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'totoro' ? 'active' : ''}" data-contrast="totoro" onclick="SpeakingStudio.setRoomContrast('totoro')">Totoro Washi</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'dark' ? 'active' : ''}" data-contrast="dark" onclick="SpeakingStudio.setRoomContrast('dark')">White on Black</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'yellow' ? 'active' : ''}" data-contrast="yellow" onclick="SpeakingStudio.setRoomContrast('yellow')">Yellow on Black</button>
          </div>
        </div>
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Text size</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'regular' ? 'active' : ''}" data-size="regular" onclick="SpeakingStudio.setRoomTextSize('regular')">Regular</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'large' ? 'active' : ''}" data-size="large" onclick="SpeakingStudio.setRoomTextSize('large')">Large</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'xlarge' ? 'active' : ''}" data-size="xlarge" onclick="SpeakingStudio.setRoomTextSize('xlarge')">Extra large</button>
          </div>
        </div>
      `
      : `
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Màu sắc</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'totoro' ? 'active' : ''}" data-contrast="totoro" onclick="SpeakingStudio.setRoomContrast('totoro')">Totoro Sáng</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'dark' ? 'active' : ''}" data-contrast="dark" onclick="SpeakingStudio.setRoomContrast('dark')">Chế độ Tối</button>
          </div>
        </div>
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Cỡ chữ hiển thị</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'regular' ? 'active' : ''}" data-size="regular" onclick="SpeakingStudio.setRoomTextSize('regular')">Vừa</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'large' ? 'active' : ''}" data-size="large" onclick="SpeakingStudio.setRoomTextSize('large')">Lớn</button>
          </div>
        </div>
      `;

    const noteText = String(notes.sheet || '').trim();
    const isProMode = getRoomViewMode() === 'pro3d' && phase !== 'review';

    if (phase === 'review') {
      cleanupProEngines();
    }

    if (isProMode) {
      const examiner = getProExaminer();
      const vadSt = roomState.proVadState || 'paused';
      const activeMode = !roomState.proStarted
        ? 'idle'
        : (roomState.examinerSpeaking
          ? 'speaking'
          : (vadSt === 'processing'
            ? 'processing'
            : (phase === 'prep' ? 'prep' : 'listening')));
      const stageClasses = [
        activeMode === 'speaking' ? 'is-speaking' : '',
        activeMode === 'listening' ? 'is-listening' : '',
        activeMode === 'prep' ? 'is-prep' : '',
        activeMode === 'processing' ? 'is-processing' : ''
      ].filter(Boolean).join(' ');
      const barState = !roomState.proStarted
        ? 'paused'
        : (roomState.examinerSpeaking ? 'examiner' : vadSt);
      const statusLabel = !roomState.proStarted
        ? 'Chờ bắt đầu phiên thi Part 2'
        : (roomState.proStatusText || (phase === 'prep' ? 'Chuẩn bị 1 phút · Giấy nháp trắng' : (roomState.p2RoundingOff ? 'Câu hỏi đóng chủ đề (Rounding-off)' : 'Đang trình bày Part 2')));

      const topRightHtml = `
        <div class="sp-pro-glass-pill">Part 2 · ${roomState.p2RoundingOff ? 'Rounding-off' : (phase === 'prep' ? 'Chuẩn bị 1 phút' : 'Trình bày 2 phút')}</div>
      `;

      const lobbyHtml = !roomState.proStarted
        ? renderProLobbyHtml(2, cue.title, examiner.id)
        : '';

      // Official IELTS Part 2: ONLY Cue Card + BLANK Note Sheet during Prep & Speak (NO B1-B5 template, NO Bẻ Lái hints!)
      // During Rounding-off: Examiner takes back the Cue Card!
      const sidePanelHtml = (roomState.proStarted && !roomState.p2RoundingOff) ? `
        <aside class="sp-pro-side-panel" aria-label="Cue Card và Giấy nháp thi thật Part 2">
          <div class="sp-pro-side-head">
            <span class="sp-pro-side-title">Part 2 · Candidate Task Card</span>
          </div>
          <div class="sp-pro-side-body">
            <div class="sp-ins-cue-card">
              <div class="sp-ins-cue-title">${esc(cue.title)}</div>
              <div class="sp-ins-cue-sub">You should say:</div>
              <ul class="sp-ins-cue-list">
                ${(cue.bullets || []).map((b) => `<li><span>${esc(b)}</span></li>`).join('')}
              </ul>
            </div>
            ${phase === 'prep' ? `
              <div class="sp-pro-drawer-sec-lbl"><span>Giấy nháp (1 phút chuẩn bị)</span></div>
              <textarea class="sp-pro-p2-notes" id="sp-room-plan-ta" spellcheck="false"
                placeholder="Ghi chú nhanh bằng từ khóa..."
                oninput="SpeakingStudio.saveRoomNote('sheet', this.value)">${esc(notes.sheet || '')}</textarea>
            ` : (noteText ? `
              <div class="sp-pro-drawer-sec-lbl"><span>Ghi chú của bạn</span></div>
              <div class="sp-ins-notes-body" style="white-space:pre-wrap;font-size:13px;line-height:1.5;background:#fff;border:1px solid rgba(31,37,32,0.12);border-radius:10px;padding:10px 12px;">${esc(noteText)}</div>
            ` : '')}
          </div>
        </aside>
      ` : '';

      const controlBarHtml = `
        <div class="sp-pro-dock-left">
          <div class="sp-pro-dock-clock tabular" id="sp-room-ring-time">${fmtMmSs(secsLeft)}</div>
          <span class="sp-pro-mic-status-pill">
            <span class="sp-pro-mic-dot" aria-hidden="true"></span>
            <span id="sp-pro-mic-lbl">${esc(statusLabel)}</span>
          </span>
        </div>

        <div class="sp-pro-dock-center">
          <div class="sp-pro-dock-wave">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="room"></span>`).join('')}</div>
        </div>

        <div class="sp-pro-dock-right">
          ${roomState.proStarted && phase === 'prep' ? `
            <button type="button" class="sp-pro-sec-btn is-primary" onclick="SpeakingStudio.beginRoomSpeaking(false)">Bắt đầu nói ngay →</button>
          ` : ''}
          ${roomState.proStarted && phase === 'speak' ? `
            <button type="button" class="sp-pro-sec-btn" id="sp-pro-done-turn-btn" style="${(barState === 'listening' || barState === 'speaking') ? '' : 'display:none;'}" onclick="SpeakingStudio.finishProTurnManual()" title="Phím tắt: Space">Xong lượt (Space)</button>
          ` : ''}
        </div>
      `;

      const html = `
        <div class="ins-main-col" onclick="SpeakingStudio.toggleRoomOptions(false)">
          <header class="ins-header ${isExam ? '' : 'ws-prac-custom-hdr'}">
            <div class="ins-hdr-left">
              ${headerBrandHtml}
              <div class="ins-hdr-meta">
                <div class="ins-hdr-title">${fullTestSession ? `Full Test · ${esc(fullTestSession.test.shortSource)} · 3D Pro · Part 2` : 'Speaking Studio · Phòng Thi Thật 3D Pro · Part 2'}</div>
                <div class="ins-hdr-timer" style="cursor:default;"><span id="sp-room-timer">${timerLabel}</span></div>
              </div>
            </div>
            <div class="ins-hdr-right">
              ${renderModeSwitchHtml()}
              ${acChipHtml}
              <div class="ws-ins-opt-wrap" onclick="event.stopPropagation()">
                <button type="button" class="ins-hdr-ico" id="sp-prac-opt-btn" onclick="SpeakingStudio.toggleRoomOptions()" title="Màu sắc &amp; Cỡ chữ" aria-label="Options">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <div class="ws-ins-opt-pop" id="sp-prac-opt-pop">${roomOptHtml}</div>
              </div>
              <button type="button" class="ins-hdr-exit" onclick="SpeakingStudio.closePracticeRoom()">Thoát</button>
            </div>
          </header>

          ${fullTestSession ? renderFullTestRibbonHtml(2) : ''}

          ${renderProStageShell({ stageClasses, examiner, statusLabel, topRightHtml, lobbyHtml, sidePanelHtml, controlBarHtml, barState })}
        </div>
      `;
      commitProCinemaDom(root, html, examiner.id, activeMode);
      return;
    }

    root.innerHTML = `
      <div class="ins-main-col" onclick="SpeakingStudio.toggleRoomOptions(false)">
        <header class="ins-header ${isExam ? '' : 'ws-prac-custom-hdr'}">
          <div class="ins-hdr-left">
            ${headerBrandHtml}
            <div class="ins-hdr-meta">
              <div class="ins-hdr-title">${fullTestSession ? `Full Test · ${esc(fullTestSession.test.shortSource)} · Part 2` : (isExam ? 'Test taker · Speaking Part 2' : (cue.isCambridge ? `Speaking Studio · Part 2 · ${esc((cue.source || '').replace('Cambridge IELTS ', 'Cam '))}` : 'Speaking Studio · Luyện tập Part 2'))}</div>
              <div class="ins-hdr-timer" style="cursor:default;"><span id="sp-room-timer">${timerLabel}</span></div>
            </div>
          </div>
          <div class="ins-hdr-right">
            ${phase !== 'review' ? renderModeSwitchHtml() : ''}
            ${acChipHtml}
            <div class="ws-ins-opt-wrap" onclick="event.stopPropagation()">
              <button type="button" class="ins-hdr-ico" id="sp-prac-opt-btn" onclick="SpeakingStudio.toggleRoomOptions()" title="Màu sắc &amp; Cỡ chữ" aria-label="Options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <div class="ws-ins-opt-pop" id="sp-prac-opt-pop">${roomOptHtml}</div>
            </div>
            <button type="button" class="ins-hdr-exit" onclick="SpeakingStudio.closePracticeRoom()">Thoát</button>
          </div>
        </header>

        ${fullTestSession ? renderFullTestRibbonHtml(2) : ''}

        ${isExam ? `
          <div class="ins-part-banner">
            <strong>Part 2</strong>
            <span>You have 1 minute to prepare and 1 to 2 minutes to speak about this topic.</span>
          </div>
        ` : ''}

        <div class="ins-split-body">
          <section class="ins-pane ins-pane-left sp-ins-left">
            <div class="ws-prac-prompt-meta">
              <span class="ws-prac-part-badge">Part 2</span>
              <span>${cue.isCambridge && cue.source ? `${esc(cue.source)} · ` : ''}1 phút chuẩn bị · 2 phút nói</span>
            </div>

            <div class="sp-ins-cue-card">
              <div class="sp-ins-cue-head-row">
                <div class="sp-ins-cue-title">${esc(cue.title)}</div>
                ${phase !== 'review' ? `<span class="sp-cue-cov-pill tabular">${Object.values(roomState.checkedBullets || {}).filter(Boolean).length}/${(cue.bullets || []).length} ý</span>` : ''}
              </div>
              <div class="sp-ins-cue-sub">You should say: ${phase !== 'review' ? '<small>(chạm từng ý để đánh dấu đã chuẩn bị/đã nói)</small>' : ''}</div>
              <ul class="sp-ins-cue-list is-interactive">
                ${(cue.bullets || []).map((b, bi) => {
                  const chk = Boolean(roomState.checkedBullets?.[bi]);
                  return `<li class="${chk ? 'is-checked' : ''}" onclick="SpeakingStudio.toggleRoomBullet(${bi})"><span class="sp-cue-chk" aria-hidden="true">${chk ? '✓' : ''}</span><span>${esc(b)}</span></li>`;
                }).join('')}
              </ul>
            </div>

            ${phase === 'prep' ? `
              <p class="ws-ins-inst">You will have to talk about the topic for 1 to 2 minutes. You have 1 minute to think about what you are going to say. You can make some notes to help you if you wish.</p>
              ${!isExam ? (cue.isCambridge ? `
                <div class="sp-prep-hint-card">
                  <button type="button" class="btn-reading-tip ${roomState.showPrepHint ? 'is-active' : ''}" onclick="SpeakingStudio.toggleRoomPrepHint()">
                    ${roomState.showPrepHint ? 'Ẩn dàn ý & cụm từ gợi ý' : 'Gợi ý dàn ý 4 ý & 6 cụm từ Band 8.0'}
                  </button>
                  ${roomState.showPrepHint ? `
                    <div class="sp-prep-hint-body">
                      <div><strong>Dàn ý triển khai nhanh theo 4 câu hỏi Cue Card:</strong></div>
                      <ul class="sp-cam-outline-list">
                        ${(cue.outlineVi || []).map((line) => `<li>${esc(line)}</li>`).join('')}
                      </ul>
                      ${(cue.chunks || []).length ? `
                        <div class="sp-int-chunks-wrap" style="margin-top:8px;">
                          <div class="sp-int-chunks-lbl">6 cụm từ ăn điểm Band 8.0 (chạm để nghe UK):</div>
                          <div class="sp-int-chunks-row">
                            ${(cue.chunks || []).map((ch) => `<button type="button" class="sp-int-chunk-chip is-sm" onclick="SpeakingStudio.speakRaw('${esc(ch).replace(/'/g, "\\'")}', 'en-GB')"><span>🔊</span><span>${esc(ch)}</span></button>`).join('')}
                          </div>
                        </div>
                      ` : ''}
                    </div>
                  ` : ''}
                </div>
              ` : `
                <div class="sp-prep-hint-card">
                  <button type="button" class="btn-reading-tip ${roomState.showPrepHint ? 'is-active' : ''}" onclick="SpeakingStudio.toggleRoomPrepHint()">
                    ${roomState.showPrepHint ? 'Ẩn gợi ý bẻ lái' : 'Gợi ý khung bẻ lái (B1–B3 & B5)'}
                  </button>
                  ${roomState.showPrepHint ? `
                    <div class="sp-prep-hint-body">
                      <div><strong>Mở bài bẻ lái (B1–B3):</strong> ${esc(cue.b13En || '')}</div>
                      <div><strong>Chốt đề (B5):</strong> ${esc(cue.b5En || '')}</div>
                    </div>
                  ` : ''}
                </div>
              `) : ''}
            ` : ''}

            ${phase === 'speak' && noteText ? `
              <div class="sp-ins-notes-card">
                <div class="sp-ins-notes-lbl">Ghi chú chuẩn bị của bạn</div>
                <div class="sp-ins-notes-body">${esc(noteText)}</div>
              </div>
            ` : ''}

            ${phase === 'review' ? (cue.isCambridge ? `
              <div class="sp-model-card">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                  <strong style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.04em;">Bài mẫu tham khảo Band 8.0+ · ${esc((cue.source || 'Cambridge IELTS').replace('Cambridge IELTS ', 'Cam '))}</strong>
                  <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cue.modelEn || '').replace(/'/g, "\\'")}', 'en-GB')"><span>🔊 Nghe UK</span></button>
                </div>
                <div style="font-size:13.6px;line-height:1.65;color:var(--ink);">${esc(cue.modelEn || '')}</div>
                ${(cue.chunks || []).length ? `
                  <div class="sp-int-chunks-row" style="margin-top:4px;">
                    ${(cue.chunks || []).map((ch) => `<button type="button" class="sp-int-chunk-chip is-sm" onclick="SpeakingStudio.speakRaw('${esc(ch).replace(/'/g, "\\'")}', 'en-GB')"><span>🔊</span><span>${esc(ch)}</span></button>`).join('')}
                  </div>
                ` : ''}
                <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px;">
                  ${fullTestSession && fullTestSession.stage === 2
                    ? `<button type="button" class="btn btn-primary" style="padding:6px 14px;font-size:12.5px;" onclick="SpeakingStudio.advanceFullSpeakingTest()">Tiếp tục sang Part 3 · Thảo luận →</button>`
                    : (cue.linkedPart3Id && getPart13Topic(cue.linkedPart3Id)
                      ? `<button type="button" class="btn btn-primary" style="padding:6px 14px;font-size:12.5px;" onclick="SpeakingStudio.openInterviewRoom('${esc(cue.linkedPart3Id)}', '${esc(mode)}')">Tiếp tục thảo luận Part 3 cùng đề →</button>`
                      : '')}
                </div>
              </div>
            ` : `
              <div class="sp-model-card">
                <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
                  <strong style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:0.04em;">Mẫu Bẻ Lái Chuẩn Cho Đề Này</strong>
                  <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(cue.b13En + ' ' + cue.b5En).replace(/'/g, "\\'")}', 'en-GB')"><span>UK</span></button>
                </div>
                <div style="font-size:13.6px;line-height:1.6;"><strong>Mở bài bẻ lái:</strong> ${esc(cue.b13En)}</div>
                <div style="font-size:13.6px;line-height:1.6;"><strong>Chốt đề:</strong> ${esc(cue.b5En)}</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap;padding-top:4px;">
                  <button type="button" class="btn-reading-tip" onclick="SpeakingStudio.toggleRoomFullB4()">
                    ${roomState.showFullB4 ? 'Ẩn cốt truyện nguyên văn' : 'Xem cốt truyện chính (~220 từ)'}
                  </button>
                  <button type="button" class="btn" style="padding:4px 10px;font-size:12px;" onclick="SpeakingStudio.openMindmapModal('master')">Mở Mindmap</button>
                  ${getPart3Topics().length ? `<button type="button" class="btn btn-primary" style="padding:4px 12px;font-size:12px;" onclick="SpeakingStudio.openInterviewRoom('${esc((getPart3Topics().find((t) => t.linkedStory) || getPart3Topics()[0]).id)}', '${esc(mode)}')">Tiếp tục thảo luận Part 3 →</button>` : ''}
                </div>
                ${roomState.showFullB4 ? `<div style="font-size:13.2px;line-height:1.62;color:var(--ink-2);padding-top:8px;border-top:1px solid var(--border);">${esc((fs.en || []).slice(1).join(' '))}</div>` : ''}
              </div>
            `) : ''}
          </section>

          <section class="ins-pane ins-pane-right sp-ins-right">
            ${rightPaperHtml}
          </section>
        </div>

        <footer class="ins-footer">
          <div class="ins-footer-parts">
            <div class="sp-foot-steps">
              <span class="sp-foot-step ${phase === 'prep' ? 'is-active' : 'is-done'}"><span class="sp-foot-full">1. Chuẩn bị (1p)</span><span class="sp-foot-short">1. Chuẩn bị</span></span>
              <span class="sp-foot-sep">→</span>
              <span class="sp-foot-step ${phase === 'speak' ? 'is-active' : (phase === 'review' ? 'is-done' : '')}"><span class="sp-foot-full">2. Trình bày (2p)</span><span class="sp-foot-short">2. Nói</span></span>
              <span class="sp-foot-sep">→</span>
              <span class="sp-foot-step ${phase === 'review' ? 'is-active' : ''}"><span class="sp-foot-full">3. Đối chiếu</span><span class="sp-foot-short">3. Chấm</span></span>
            </div>
          </div>
          <button type="button" class="sp-foot-action-btn" onclick="${phase === 'prep' ? 'SpeakingStudio.beginRoomSpeaking(false)' : (phase === 'review' ? (fullTestSession && fullTestSession.stage === 2 ? 'SpeakingStudio.advanceFullSpeakingTest()' : 'SpeakingStudio.closePracticeRoom()') : (typeMode ? 'SpeakingStudio.submitRoomTyped()' : 'SpeakingStudio.toggleRoomMic()'))}">${phase === 'prep' ? 'Bắt đầu nói →' : (phase === 'review' ? (fullTestSession && fullTestSession.stage === 2 ? 'Tiếp tục sang Part 3 →' : 'Về kho đề ✓') : (typeMode ? 'Nộp bài →' : (recording ? 'Dừng & Nộp' : 'Bắt đầu thu âm')))}</button>
        </footer>
      </div>
    `;
  }

  /* ================= PART 1 & PART 3 EXAMINER INTERVIEW ROOM ================= */
  function openInterviewRoom(topicId, mode, opts) {
    if (!opts?.preserveFullTest) fullTestSession = null;
    ensureOverlays();
    STT()?.abort?.();
    clearInterval(roomState?.timerId);
    const topic = getPart13Topic(topicId);
    if (!topic) return;

    const cleanMode = mode === 'exam' ? 'exam' : 'practice';
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const initContrast = cleanMode === 'exam' ? 'cd' : (isDark ? 'dark' : 'totoro');

    if (!opts?.preserveFullTest) {
      state.pracPart = topic.part;
      window.TotoroUI?.recordLastSession?.({
        skill: 'Speaking',
        view: 'practice',
        label: `Speaking Part ${topic.part} · ${topic.title}`,
        action: `window.SpeakingStudio?.openPracticePart(${topic.part})`
      });
    }

    roomState = {
      kind: 'interview',
      topic,
      part: topic.part,
      mode: cleanMode,
      phase: 'interview', // 'interview' | 'review'
      qIdx: 0,
      turns: (topic.questions || []).map((qObj) => ({
        qId: qObj.id,
        q: qObj.q,
        text: '',
        durationSec: 0,
        audioUrl: '',
        acoustic: null,
        words: 0,
        wpm: 0,
        usedChunks: []
      })),
      recording: false,
      processing: false,
      typeMode: false,
      recStartedAt: 0,
      recElapsedSec: 0,
      totalElapsedSec: 0,
      timerId: null,
      showGuide: cleanMode !== 'exam',
      showModel: false,
      proStarted: false,
      proVadState: 'paused',
      proStatusText: `Chờ bắt đầu phiên thi Part ${topic.part}`,
      repeatCount: 0,
      probeCount: 0,
      noSpeechNudges: 0,
      proDrawerOpen: false,
      blindCaptions: false,
      examinerSpeaking: false,
      examinerSpeakTimer: null,
      strikes: 0,
      contrast: initContrast,
      textSize: 'regular',
      grading: false,
      report: null,
      metrics: null,
      combinedText: ''
    };

    const el = document.getElementById('sp-practice-room');
    el.className = `sp-exam-room open ins-shell ins-contrast-${initContrast} ins-size-regular ${cleanMode === 'exam' ? 'is-exam ins-mode-exam' : 'is-practice'}`;
    startInterviewTimer();
    renderInterviewRoom();
    if (getRoomViewMode() !== 'pro3d') {
      setTimeout(() => speakInterviewQuestion(), 220);
    }
  }

  function startInterviewTimer() {
    clearInterval(roomState?.timerId);
    roomState.timerId = setInterval(() => {
      if (!roomState || roomState.kind !== 'interview' || roomState.phase === 'review') return;
      if (getRoomViewMode() === 'pro3d' && !roomState.proStarted) return;
      roomState.totalElapsedSec++;
      const hdrTimer = document.getElementById('sp-room-timer');
      if (hdrTimer) {
        hdrTimer.textContent = `Câu ${roomState.qIdx + 1}/${roomState.turns.length} · ${fmtMmSs(roomState.totalElapsedSec)}`;
      }
      if (roomState.recording) {
        roomState.recElapsedSec = Math.max(0, Math.round((Date.now() - roomState.recStartedAt) / 1000));
        const recTimeEl = document.getElementById('sp-int-rec-time');
        if (recTimeEl) recTimeEl.textContent = fmtMmSs(roomState.recElapsedSec);

        const isP1 = roomState.part === 1;
        const maxScale = isP1 ? 45 : 75;
        const minIdeal = isP1 ? 20 : 40;
        const maxIdeal = isP1 ? 35 : 65;
        const minAccept = isP1 ? 12 : 25;
        const pct = Math.min(100, Math.round((roomState.recElapsedSec / maxScale) * 100));

        const zFill = document.getElementById('sp-int-zone-fill');
        const zTxt = document.getElementById('sp-int-zone-status');
        if (zFill) zFill.style.width = `${pct}%`;
        if (zTxt) {
          const inZone = roomState.recElapsedSec >= minIdeal && roomState.recElapsedSec <= maxIdeal + 10;
          zTxt.textContent = inZone
            ? `✓ Vùng thời lượng lý tưởng Band 7+ (${minIdeal}–${maxIdeal}s)`
            : (roomState.recElapsedSec > maxIdeal + 10
              ? `Đã vượt ${maxIdeal}s — bạn có thể chốt câu trả lời gọn gàng!`
              : (roomState.recElapsedSec >= minAccept
                ? `Đang nói ${roomState.recElapsedSec}s · Thêm 1 ý nhỏ để chạm vùng ${minIdeal}–${maxIdeal}s`
                : `Đang thu ${roomState.recElapsedSec}s · Mục tiêu ${minIdeal}–${maxIdeal}s`));
          zTxt.classList.toggle('is-ideal', inZone);
        }
      }
    }, 500);
  }

  function speakInterviewQuestion(idxOverride) {
    if (!roomState || roomState.kind !== 'interview') return;
    const idx = typeof idxOverride === 'number' ? idxOverride : roomState.qIdx;
    const qObj = roomState.topic?.questions?.[idx];
    if (!qObj?.q) return;
    speakText(qObj.q, 'en-GB');
    triggerExaminerSpeaking(qObj.q);
  }

  function toggleInterviewGuide() {
    if (!roomState || roomState.kind !== 'interview' || roomState.mode === 'exam') return;
    roomState.showGuide = !roomState.showGuide;
    renderInterviewRoom();
  }

  function toggleInterviewModel() {
    if (!roomState || roomState.kind !== 'interview' || roomState.mode === 'exam') return;
    roomState.showModel = !roomState.showModel;
    renderInterviewRoom();
  }

  function toggleInterviewTypeMode() {
    if (!roomState || roomState.kind !== 'interview' || roomState.mode === 'exam') return;
    if (roomState.recording) {
      STT()?.abort?.();
      roomState.recording = false;
    }
    roomState.typeMode = !roomState.typeMode;
    renderInterviewRoom();
  }

  function toggleInterviewMic() {
    if (!roomState || roomState.kind !== 'interview') return;
    const stt = STT();
    if (!stt?.isSupported?.()) {
      toast('Thiết bị chưa có Micro — bật ô nhập dự phòng.');
      if (roomState.mode !== 'exam') roomState.typeMode = true;
      renderInterviewRoom();
      return;
    }
    if (roomState.recording) {
      stt.stop();
      roomState.recording = false;
      roomState.processing = true;
      renderInterviewRoom();
      return;
    }
    stt.abort();
    clearExaminerSpeaking();
    const targetQIdx = roomState.qIdx;
    roomState.recording = true;
    roomState.processing = false;
    roomState.recStartedAt = Date.now();
    roomState.recElapsedSec = 0;
    renderInterviewRoom();
    stt.startRecording({
      mode: 'speaking',
      autoStopOnSilence: false,
      maxDurationMs: roomState.part === 1 ? 55000 : 85000,
      onLevel: ({ bars }) => { updateWaveBars('room', bars); window.SpeakingExaminerCinema?.feedMicLevel?.(bars); },
      onProcessing: () => {
        if (roomState && roomState.kind === 'interview') {
          roomState.recording = false;
          roomState.processing = true;
          renderInterviewRoom();
        }
      },
      onResult: (res) => {
        if (!roomState || roomState.kind !== 'interview') return;
        roomState.recording = false;
        roomState.processing = false;
        const dur = res.durationSec || Math.max(4, Math.round((Date.now() - roomState.recStartedAt) / 1000));
        if (res.silent || !res.text) {
          toast('Chưa thu được giọng nói rõ — hãy bấm Mic trả lời lại câu này!');
          renderInterviewRoom();
          return;
        }
        saveInterviewTurn(targetQIdx, res.text, dur, res.audioUrl || '', {
          hasAudio: true,
          audioUrl: res.audioUrl || '',
          durationSec: dur,
          words: res.words || [],
          segments: res.segments || [],
        });
      },
      onError: (msg) => {
        if (!roomState || roomState.kind !== 'interview') return;
        roomState.recording = false;
        roomState.processing = false;
        toast(String(msg || 'Lỗi Micro.'));
        renderInterviewRoom();
      }
    });
  }

  function submitInterviewTyped() {
    if (!roomState || roomState.kind !== 'interview') return;
    const ta = document.getElementById('sp-int-ta');
    const val = (ta?.value || '').trim();
    const minWords = roomState.part === 1 ? 6 : 10;
    if (countWords(val) < minWords) {
      toast(`Hãy trả lời tối thiểu ${minWords} từ cho câu hỏi Part ${roomState.part} này!`);
      return;
    }
    const dur = Math.max(roomState.part === 1 ? 15 : 30, Math.round(countWords(val) / 2.2));
    saveInterviewTurn(roomState.qIdx, val, dur, '', { hasAudio: false, durationSec: dur, words: [], segments: [] });
  }

  function saveInterviewTurn(idx, text, durationSec, audioUrl, acoustic) {
    if (!roomState || roomState.kind !== 'interview') return;
    const qObj = roomState.topic.questions[idx];
    const cleanText = String(text || '').trim();
    const words = countWords(cleanText);
    const wpm = durationSec > 0 ? Math.round((words / durationSec) * 60) : 0;
    const low = cleanText.toLowerCase();
    const usedChunks = (qObj?.chunks || []).filter((ch) => {
      const k = String(ch || '').toLowerCase().trim();
      return k.length >= 3 && low.includes(k);
    });

    roomState.turns[idx] = {
      qId: qObj?.id || `q${idx + 1}`,
      q: qObj?.q || '',
      text: cleanText,
      durationSec,
      audioUrl: audioUrl || '',
      acoustic: acoustic || null,
      words,
      wpm,
      usedChunks
    };

    const isLast = idx >= roomState.turns.length - 1;
    if (roomState.mode === 'exam' && !isLast) {
      toast(`Đã ghi nhận Câu ${idx + 1}/${roomState.turns.length} — chuyển sang Câu ${idx + 2}...`);
      roomState.qIdx = idx + 1;
      roomState.showModel = false;
      renderInterviewRoom();
      setTimeout(() => speakInterviewQuestion(), 280);
    } else if (roomState.mode === 'exam' && isLast) {
      finishInterview();
    } else {
      toast(`Đã lưu Câu ${idx + 1}/${roomState.turns.length} (${words} từ · ${durationSec}s)`);
      renderInterviewRoom();
    }
  }

  function nextInterviewQ() {
    if (!roomState || roomState.kind !== 'interview') return;
    if (roomState.recording || roomState.processing) return;
    if (roomState.qIdx < roomState.turns.length - 1) {
      roomState.qIdx++;
      roomState.showModel = false;
      renderInterviewRoom();
      setTimeout(() => speakInterviewQuestion(), 200);
    } else {
      finishInterview();
    }
  }

  function jumpInterviewQ(idx) {
    if (!roomState || roomState.kind !== 'interview') return;
    if (roomState.recording || roomState.processing) return;
    if (roomState.mode === 'exam' && idx !== roomState.qIdx) return;
    if (idx < 0 || idx >= roomState.turns.length) return;
    roomState.qIdx = idx;
    roomState.showModel = false;
    renderInterviewRoom();
  }

  async function finishInterview() {
    if (!roomState || roomState.kind !== 'interview') return;
    const answered = roomState.turns.filter((t) => countWords(t.text) > 0);
    if (!answered.length) {
      toast('Bạn chưa trả lời câu hỏi nào — hãy bấm Mic hoặc nhập câu trả lời trước nhé!');
      return;
    }
    clearInterval(roomState.timerId);
    STT()?.abort?.();
    const activeRoomRef = roomState;
    const topic = activeRoomRef.topic;

    const combinedText = answered.map((t) => t.text).join(' ');
    const totalDur = answered.reduce((acc, t) => acc + (Number(t.durationSec) || 0), 0);
    const totalWords = countWords(combinedText);
    const wpm = totalDur > 0 ? Math.round((totalWords / totalDur) * 60) : 0;
    const allTopicChunks = (topic.questions || []).flatMap((q) => q.chunks || []);
    const lowAll = combinedText.toLowerCase();
    const usedChunks = [...new Set(allTopicChunks.filter((ch) => {
      const k = String(ch || '').toLowerCase().trim();
      return k.length >= 3 && lowAll.includes(k);
    }))];
    const fillerCount = (combinedText.match(/\b(um+|uh+|er+|erm+|hmm+|you know|actually|basically|like)\b/gi) || []).length;

    const hasAnyAudio = answered.some((t) => t.acoustic?.hasAudio);
    const mergedSegments = [];
    const mergedWords = [];
    let timeOffset = 0;
    answered.forEach((t) => {
      if (t.acoustic?.segments?.length) {
        t.acoustic.segments.forEach((s) => mergedSegments.push({ ...s, start: (s.start || 0) + timeOffset, end: (s.end || 0) + timeOffset }));
      }
      if (t.acoustic?.words?.length) {
        t.acoustic.words.forEach((w) => mergedWords.push({ ...w, start: (w.start || 0) + timeOffset, end: (w.end || 0) + timeOffset }));
      }
      timeOffset += (Number(t.durationSec) || 0) + 0.3;
    });

    activeRoomRef.combinedText = combinedText;
    activeRoomRef.metrics = {
      durationSec: totalDur,
      words: totalWords,
      wpm,
      usedChunks,
      fillerCount,
      answeredCount: answered.length,
      totalQuestions: activeRoomRef.turns.length
    };
    activeRoomRef.phase = 'review';
    activeRoomRef.grading = Boolean(window.IeltsGrader?.gradeSpeaking);
    activeRoomRef.report = null;
    renderInterviewRoom();

    let report = null;
    if (window.IeltsGrader?.gradeSpeaking) {
      try {
        report = await window.IeltsGrader.gradeSpeaking({
          part: topic.part,
          cueTitle: `${topic.title}${topic.titleVi ? ` (${topic.titleVi})` : ''}`,
          cueBullets: (topic.questions || []).map((q) => q.q),
          qaTurns: answered.map((t) => ({ q: t.q, a: t.text, durationSec: t.durationSec })),
          curriculumContext: (topic.questions || []).map((q) => q.modelEn).join(' '),
          curriculumKeywords: allTopicChunks.join(' '),
          text: combinedText,
          acoustic: {
            hasAudio: hasAnyAudio,
            durationSec: totalDur,
            words: mergedWords,
            segments: mergedSegments
          }
        });
      } catch (err) {
        console.warn('[SpeakingStudio] Interview IELTS grader error:', err);
      }
    }

    if (roomState === activeRoomRef) {
      roomState.grading = false;
      roomState.report = report;
    }

    const stagePayload = {
      part: topic.part,
      cueId: topic.id,
      cueTitle: `Part ${topic.part} · ${topic.title}`,
      mode: activeRoomRef.mode,
      band: report ? report.overall : null,
      criteria: report ? {
        fc: report.criteria.fc.band,
        lr: report.criteria.lr.band,
        gra: report.criteria.gra.band,
        pr: report.criteria.pr.band,
      } : null,
      durationSec: totalDur,
      wpm,
      words: totalWords,
      chunksCount: usedChunks.length,
      usedChunks,
      fillerCount,
      transcript: combinedText,
      turns: answered.map((t) => ({ q: t.q, text: t.text, words: t.words, durationSec: t.durationSec })),
      report: report || null,
      at: Date.now()
    };

    const hist = getPracHistory();
    hist.unshift(stagePayload);
    savePracHistory(hist.slice(0, 80));

    if (fullTestSession) {
      if (fullTestSession.stage === 1 && fullTestSession.test.part1Id === topic.id) {
        recordFullTestStageResult('p1', stagePayload);
      } else if (fullTestSession.stage === 3 && fullTestSession.test.part3Id === topic.id) {
        recordFullTestStageResult('p3', stagePayload);
      }
    }

    if (roomState === activeRoomRef) renderInterviewRoom();
  }

  function renderInterviewRoom() {
    if (!roomState || roomState.kind !== 'interview') return;
    const { topic, part, mode, phase, qIdx, turns, recording, processing, typeMode, showGuide, showModel, totalElapsedSec, recElapsedSec, metrics } = roomState;
    const isExam = mode === 'exam';
    const isP1 = part === 1;
    const root = document.getElementById('sp-practice-room');
    const qList = topic.questions || [];
    const curQ = qList[qIdx] || qList[0];
    const curTurn = turns[qIdx] || {};
    const answeredCount = turns.filter((t) => countWords(t.text) > 0).length;
    const allAnswered = answeredCount === turns.length;

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

    const acChipHtml = phase !== 'review' ? `
      <span class="rp-ac-shield ${roomState.strikes > 0 ? 'is-warn' : ''}" id="sp-prac-ac-pill" title="Chống gian lận đang bật trong phòng phỏng vấn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span id="sp-prac-ac-text">${roomState.strikes > 0 ? `Cảnh báo ${roomState.strikes}/2` : 'Anti-Cheat'}</span>
      </span>
    ` : '';

    const roomOptHtml = isExam
      ? `
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Contrast</div>
          <div class="ws-ins-opt-grid">
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'cd' ? 'active' : ''}" data-contrast="cd" onclick="SpeakingStudio.setRoomContrast('cd')">Black on White</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'totoro' ? 'active' : ''}" data-contrast="totoro" onclick="SpeakingStudio.setRoomContrast('totoro')">Totoro Washi</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'dark' ? 'active' : ''}" data-contrast="dark" onclick="SpeakingStudio.setRoomContrast('dark')">White on Black</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'yellow' ? 'active' : ''}" data-contrast="yellow" onclick="SpeakingStudio.setRoomContrast('yellow')">Yellow on Black</button>
          </div>
        </div>
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Text size</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'regular' ? 'active' : ''}" data-size="regular" onclick="SpeakingStudio.setRoomTextSize('regular')">Regular</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'large' ? 'active' : ''}" data-size="large" onclick="SpeakingStudio.setRoomTextSize('large')">Large</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'xlarge' ? 'active' : ''}" data-size="xlarge" onclick="SpeakingStudio.setRoomTextSize('xlarge')">Extra large</button>
          </div>
        </div>
      `
      : `
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Màu sắc</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'totoro' ? 'active' : ''}" data-contrast="totoro" onclick="SpeakingStudio.setRoomContrast('totoro')">Totoro Sáng</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.contrast === 'dark' ? 'active' : ''}" data-contrast="dark" onclick="SpeakingStudio.setRoomContrast('dark')">Chế độ Tối</button>
          </div>
        </div>
        <div class="ws-ins-opt-group">
          <div class="ws-ins-opt-lbl">Cỡ chữ hiển thị</div>
          <div class="ws-ins-opt-row">
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'regular' ? 'active' : ''}" data-size="regular" onclick="SpeakingStudio.setRoomTextSize('regular')">Vừa</button>
            <button type="button" class="ws-ins-opt-choice ${roomState.textSize === 'large' ? 'active' : ''}" data-size="large" onclick="SpeakingStudio.setRoomTextSize('large')">Lớn</button>
          </div>
        </div>
      `;

    const timerLabel = phase === 'review'
      ? `Đã hoàn thành Part ${part}`
      : `Câu ${qIdx + 1}/${turns.length} · ${fmtMmSs(totalElapsedSec)}`;

    let leftPaneHtml = '';
    let rightPaneHtml = '';

    const targetLbl = getTopicTargetLabel(topic);

    if (phase === 'interview') {
      const qPillsHtml = turns.map((t, i) => {
        const done = countWords(t.text) > 0;
        const active = i === qIdx;
        const disabled = isExam && !active;
        return `
          <button type="button" class="sp-int-q-pill ${active ? 'is-active' : ''} ${done ? 'is-done' : ''}"
            ${disabled ? 'disabled' : ''} onclick="SpeakingStudio.jumpInterviewQ(${i})">
            <span class="sp-int-q-num">${done ? '✓' : (i + 1)}</span>
            <span>Câu ${i + 1}</span>
          </button>
        `;
      }).join('');

      leftPaneHtml = `
        <div class="ws-prac-prompt-meta">
          <span class="ws-prac-part-badge">Part ${part}</span>
          <span>${esc(topic.title)} · ${esc(targetLbl)}</span>
        </div>

        <div class="sp-int-q-pills" role="tablist" aria-label="Tiến độ câu hỏi phỏng vấn">${qPillsHtml}</div>

        <div class="sp-int-examiner-card">
          <div class="sp-int-examiner-head">
            <div class="sp-int-examiner-who">
              <span class="sp-int-examiner-dot" aria-hidden="true"></span>
              <strong>Examiner · Câu ${qIdx + 1}/${turns.length}</strong>
              <span class="sp-int-qtype-tag">${esc(curQ.qType || (isP1 ? 'Interview' : 'Discussion'))}</span>
            </div>
            <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakInterviewQuestion()" title="Nghe Giám khảo đọc lại câu hỏi (Giọng Anh-Anh)">
              <span>🔊 Nghe UK</span>
            </button>
          </div>
          <div class="sp-int-q-text">${esc(curQ.q)}</div>
          <div class="sp-int-q-sub">${isP1 ? 'Trả lời trực tiếp, tự nhiên 2–3 câu (~20–35 giây).' : 'Phân tích theo góc nhìn xã hội/chung, giải thích & nêu ví dụ (~40–65 giây).'}</div>
        </div>

        ${!isExam ? `
          <div class="sp-int-coach-card">
            <div class="sp-int-coach-head">
              <strong>${isP1 ? 'Khung tư duy A.R.E. & Spoken Chunks' : 'Khung tư duy P.E.E.C. & Cụm học thuật'}</strong>
              <button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.toggleInterviewGuide()">${showGuide ? 'Thu gọn' : 'Hiện gợi ý'}</button>
            </div>
            ${showGuide ? `
              <div class="sp-int-formula-box">${esc(curQ.formulaVi || '')}</div>
              <div class="sp-int-chunks-wrap">
                <div class="sp-int-chunks-lbl">Cụm từ ăn điểm Band 7.5–8.5 (chạm để nghe phát âm UK):</div>
                <div class="sp-int-chunks-row">
                  ${(curQ.chunks || []).map((ch) => `
                    <button type="button" class="sp-int-chunk-chip" onclick="SpeakingStudio.speakRaw('${esc(ch).replace(/'/g, "\\'")}', 'en-GB')" title="Bấm để nghe phát âm UK">
                      <span>🔊</span><span>${esc(ch)}</span>
                    </button>
                  `).join('')}
                </div>
              </div>
              <div class="sp-int-model-toggle-row">
                <button type="button" class="btn-reading-tip ${showModel ? 'is-active' : ''}" onclick="SpeakingStudio.toggleInterviewModel()">
                  ${showModel ? 'Ẩn bài mẫu Band 8.0' : 'Xem bài mẫu tham khảo Band 8.0'}
                </button>
                ${showModel ? `<button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(curQ.modelEn || '').replace(/'/g, "\\'")}', 'en-GB')"><span>🔊 Nghe mẫu UK</span></button>` : ''}
              </div>
              ${showModel ? `<div class="sp-int-model-box">${esc(curQ.modelEn || '')}</div>` : ''}
            ` : ''}
          </div>
        ` : `
          <p class="ws-ins-inst">${isP1
            ? 'In Part 1, the examiner asks you general questions about yourself and familiar topics. Speak naturally and give full answers of 2 to 3 sentences.'
            : 'In Part 3, the examiner discusses more abstract issues connected to the topic. Develop your ideas with explanations, examples, and balanced viewpoints.'}</p>
        `}
      `;

      const maxScale = isP1 ? 45 : 75;
      const idealLeftPct = isP1 ? Math.round((20 / maxScale) * 100) : Math.round((40 / maxScale) * 100);
      const idealWidthPct = isP1 ? Math.round((15 / maxScale) * 100) : Math.round((25 / maxScale) * 100);
      const curFillPct = Math.min(100, Math.round((recElapsedSec / maxScale) * 100));
      const meterPct = Math.round(((answeredCount + (recording ? 0.5 : 0)) / Math.max(1, turns.length)) * 100);

      const savedTurnsHtml = turns
        .map((t, i) => ({ t, i }))
        .filter(({ t }) => countWords(t.text) > 0)
        .map(({ t, i }) => `
          <div class="sp-int-log-item ${i === qIdx ? 'is-current' : ''}">
            <div class="sp-int-log-head">
              <strong>Câu ${i + 1}</strong>
              <span class="tabular">${t.words} từ · ${t.durationSec}s${t.wpm ? ` · ${t.wpm} WPM` : ''}</span>
            </div>
            <div class="sp-int-log-txt">${esc(t.text)}</div>
            ${t.audioUrl ? `<audio class="sp-audio-replay sp-int-mini-audio" controls src="${esc(t.audioUrl)}"></audio>` : ''}
          </div>
        `).join('');

      rightPaneHtml = `
        <div class="ws-prac-paper-card sp-studio-paper">
          <div class="ws-prac-paper-head">
            <div class="ws-prac-paper-title-grp">
              <span class="ws-prac-paper-ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              </span>
              <span class="ws-prac-paper-title">Phòng Phỏng Vấn Part ${part}</span>
              <span class="ws-prac-para-pill tabular">Đã trả lời ${answeredCount}/${turns.length}</span>
            </div>
            <div class="ws-prac-paper-badges">
              ${!isExam ? `<button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.toggleInterviewTypeMode()">${typeMode ? 'Dùng Mic AI' : 'Gõ dự phòng'}</button>` : ''}
            </div>
          </div>
          <div class="ws-prac-paper-meter" aria-hidden="true">
            <span class="ws-prac-paper-meter-fill" style="width:${meterPct}%"></span>
          </div>

          <div class="sp-int-right-scroll">
            ${typeMode && !isExam ? `
              <div class="sp-int-type-wrap">
                <label class="sp-int-type-lbl" for="sp-int-ta">Câu trả lời của bạn cho Câu ${qIdx + 1}:</label>
                <textarea class="ws-ins-editor ws-prac-editor sp-int-ta" id="sp-int-ta" spellcheck="false"
                  placeholder="${isP1 ? 'Gõ câu trả lời Part 1 tự nhiên (2–3 câu theo A.R.E.)...' : 'Gõ câu trả lời Part 3 phân tích sâu (3–5 câu theo P.E.E.C.)...'}">${esc(curTurn.text || '')}</textarea>
                <div class="sp-int-type-acts">
                  <button type="button" class="btn btn-primary" onclick="SpeakingStudio.submitInterviewTyped()">Lưu câu trả lời Câu ${qIdx + 1} ✓</button>
                  ${countWords(curTurn.text) > 0 && qIdx < turns.length - 1 ? `<button type="button" class="btn" onclick="SpeakingStudio.nextInterviewQ()">Sang Câu ${qIdx + 2} →</button>` : ''}
                </div>
              </div>
            ` : `
              <div class="sp-room-mic-body sp-int-mic-stage">
                <div class="sp-int-rec-clock ${recording ? 'is-recording' : ''}">
                  <div class="sp-int-rec-time tabular" id="sp-int-rec-time">${fmtMmSs(recording ? recElapsedSec : (curTurn.durationSec || 0))}</div>
                  <div class="sp-int-rec-sub">${recording ? 'Đang ghi âm câu trả lời...' : (countWords(curTurn.text) > 0 ? 'Đã lưu câu trả lời — có thể thu lại hoặc sang câu tiếp' : `Mục tiêu ${esc(targetLbl)}`)}</div>
                </div>
                <div class="sp-wave-bars">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="room"></span>`).join('')}</div>
                <div class="sp-zone-gauge">
                  <div class="sp-zone-track">
                    <span class="sp-zone-ideal" style="left:${idealLeftPct}%;width:${idealWidthPct}%;right:auto;" title="Vùng thời lượng lý tưởng Band 7+"></span>
                    <span class="sp-zone-fill" id="sp-int-zone-fill" style="width:${recording ? curFillPct : 0}%"></span>
                  </div>
                  <div class="sp-zone-marks tabular"><span>0s</span><span>${isP1 ? '15s' : '30s'}</span><span>${isP1 ? '20–35s (Lý tưởng)' : '40–65s (Lý tưởng)'}</span></div>
                  <div class="sp-zone-status" id="sp-int-zone-status">${recording ? `Đang thu ${recElapsedSec}s · Mục tiêu ${esc(targetLbl)}` : `Bấm Mic để trả lời Câu ${qIdx + 1}/${turns.length}`}</div>
                </div>
                <div class="sp-int-mic-actions">
                  <button type="button" class="sp-mic-btn ${recording ? 'is-recording' : ''}" ${processing ? 'disabled' : ''} onclick="SpeakingStudio.toggleInterviewMic()">
                    <span>${processing ? 'Đang chuyển giọng nói AI...' : (recording ? `Dừng & Lưu Câu ${qIdx + 1}` : (countWords(curTurn.text) > 0 ? `Thu lại Câu ${qIdx + 1}` : `Bấm Mic trả lời Câu ${qIdx + 1}`))}</span>
                  </button>
                  ${!recording && !processing && countWords(curTurn.text) > 0 && qIdx < turns.length - 1 ? `
                    <button type="button" class="btn btn-primary" style="padding:11px 18px;font-size:13.5px;border-radius:999px;" onclick="SpeakingStudio.nextInterviewQ()">Câu tiếp theo (${qIdx + 2}/${turns.length}) →</button>
                  ` : ''}
                </div>
              </div>
            `}

            ${savedTurnsHtml ? `
              <div class="sp-int-log-section">
                <div class="sp-int-log-title">Nhật ký hội thoại đã trả lời (${answeredCount}/${turns.length})</div>
                <div class="sp-int-log-list">${savedTurnsHtml}</div>
              </div>
            ` : ''}
          </div>

          <div class="ws-prac-paper-foot">
            <div class="ws-prac-paper-foot-l">
              <span class="ws-prac-wc-note">${allAnswered ? '✓ Đã hoàn tất cả 4 câu hỏi — bấm Nộp & Chấm điểm để nhận Band Score!' : `Trả lời lần lượt ${turns.length} câu hỏi rồi bấm Chấm điểm tổng hợp.`}</span>
            </div>
            ${!isExam && !typeMode ? `<button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.toggleInterviewTypeMode()">Gõ dự phòng</button>` : ''}
          </div>
        </div>
      `;
    } else {
      // REVIEW & SCORECARD PHASE
      const m = metrics || { durationSec: 0, wpm: 0, words: 0, usedChunks: [], fillerCount: 0 };
      const annotatedHtml = buildAnnotatedTranscriptHtml(roomState.combinedText, m.usedChunks, roomState.report?.errors || []);
      const siblingList = isP1 ? getPart1Topics() : getPart3Topics();
      const curTopicIdx = siblingList.findIndex((x) => x.id === topic.id);
      const nextTopic = siblingList[(curTopicIdx + 1) % Math.max(1, siblingList.length)];

      leftPaneHtml = `
        <div class="ws-prac-prompt-meta">
          <span class="ws-prac-part-badge">Part ${part} · Đối chiếu</span>
          <span>${esc(topic.title)}</span>
        </div>

        <div class="sp-int-compare-list">
          ${qList.map((qObj, i) => {
            const t = turns[i] || {};
            const hasAns = countWords(t.text) > 0;
            return `
              <div class="sp-int-compare-card">
                <div class="sp-int-compare-q">
                  <span class="sp-int-q-badge">Q${i + 1}</span>
                  <strong>${esc(qObj.q)}</strong>
                </div>
                <div class="sp-int-compare-you">
                  <div class="sp-int-compare-lbl">Câu trả lời của bạn ${hasAns ? `<span class="tabular">(${t.words}w · ${t.durationSec}s)</span>` : ''}</div>
                  ${hasAns ? `<div class="sp-int-compare-txt">${esc(t.text)}</div>` : `<div class="sp-int-compare-empty">Chưa trả lời câu này</div>`}
                  ${t.audioUrl ? `<audio class="sp-audio-replay sp-int-mini-audio" controls src="${esc(t.audioUrl)}"></audio>` : ''}
                </div>
                <div class="sp-int-compare-model">
                  <div class="sp-int-compare-mhead">
                    <strong>Bài mẫu Band 8.0</strong>
                    <button type="button" class="btn-voice-speak" onclick="SpeakingStudio.speakRaw('${esc(qObj.modelEn || '').replace(/'/g, "\\'")}', 'en-GB')"><span>🔊 UK</span></button>
                  </div>
                  <div class="sp-int-compare-mtxt">${esc(qObj.modelEn || '')}</div>
                  <div class="sp-int-chunks-row" style="margin-top:6px;">
                    ${(qObj.chunks || []).map((ch) => `<button type="button" class="sp-int-chunk-chip is-sm" onclick="SpeakingStudio.speakRaw('${esc(ch).replace(/'/g, "\\'")}', 'en-GB')"><span>🔊</span><span>${esc(ch)}</span></button>`).join('')}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      rightPaneHtml = `
        <div class="ws-prac-paper-card sp-studio-paper">
          <div class="ws-prac-paper-head">
            <div class="ws-prac-paper-title-grp">
              <span class="ws-prac-paper-ico" aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              <span class="ws-prac-paper-title">Scorecard · Kết quả Speaking Part ${part}</span>
              <span class="ws-prac-para-pill tabular">${m.words} từ · ${m.answeredCount}/${m.totalQuestions} câu</span>
            </div>
            <div class="ws-prac-paper-badges">
              <button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.openInterviewRoom('${esc(topic.id)}', '${esc(mode)}', { preserveFullTest: ${Boolean(fullTestSession)} })">Nói lại</button>
              ${fullTestSession && fullTestSession.stage === 1
                ? `<button type="button" class="ws-prac-submit-pill" style="height:30px;padding:0 13px;font-size:12px;" onclick="SpeakingStudio.advanceFullSpeakingTest()">Tiếp sang Part 2 →</button>`
                : (fullTestSession && fullTestSession.stage === 3
                  ? `<button type="button" class="ws-prac-submit-pill" style="height:30px;padding:0 13px;font-size:12px;" onclick="SpeakingStudio.closePracticeRoom()">Hoàn tất Full Test ✓</button>`
                  : `${nextTopic && nextTopic.id !== topic.id ? `<button type="button" class="ws-ins-plan-btn" onclick="SpeakingStudio.openInterviewRoom('${esc(nextTopic.id)}', '${esc(mode)}')">Chủ đề tiếp →</button>` : ''}<button type="button" class="ws-prac-submit-pill" style="height:30px;padding:0 13px;font-size:12px;" onclick="SpeakingStudio.closePracticeRoom()">Về kho đề</button>`)}
            </div>
          </div>
          <div class="ws-prac-paper-meter" aria-hidden="true">
            <span class="ws-prac-paper-meter-fill" style="width:100%"></span>
          </div>
          <div class="sp-room-review-scroll">
            ${fullTestSession && fullTestSession.stage === 3 ? renderFullTestCombinedCardHtml() : ''}
            ${roomState.grading
              ? (window.IeltsGrader?.renderLoadingHtml(`Giám khảo IELTS Speaking AI đang chấm 4 tiêu chí Part ${part} (FC / LR / GRA / PR)...`) || '')
              : (roomState.report && window.IeltsGrader?.renderExaminerReportHtml
                ? window.IeltsGrader.renderExaminerReportHtml(roomState.report, { title: `Kết quả chấm IELTS Speaking Part ${part}` })
                : '')}
            <div class="sp-metrics-grid">
              <div class="sp-metric-box"><div class="sp-metric-val">${fmtMmSs(m.durationSec)}</div><div class="sp-metric-lbl">Tổng thời lượng</div></div>
              <div class="sp-metric-box"><div class="sp-metric-val">${m.wpm}</div><div class="sp-metric-lbl">Tốc độ (WPM)</div></div>
              <div class="sp-metric-box"><div class="sp-metric-val">${m.usedChunks.length}</div><div class="sp-metric-lbl">Spoken Chunks</div></div>
              <div class="sp-metric-box"><div class="sp-metric-val">${m.fillerCount}</div><div class="sp-metric-lbl">Từ đệm</div></div>
            </div>
            <div class="sp-transcript-box">
              <div class="sp-tr-legend-head">
                <strong>Toàn bộ bài nói Part ${part} đã phân tích màu</strong>
                <div class="sp-tr-legend-chips">
                  <span class="sp-tr-leg is-chunk">Spoken Chunk</span>
                  <span class="sp-tr-leg is-filler">Từ đệm</span>
                  <span class="sp-tr-leg is-err">Lỗi cần sửa</span>
                </div>
              </div>
              <div class="sp-tr-annotated">${annotatedHtml}</div>
              ${m.usedChunks.length ? `<div class="sp-kw-row" style="margin-top:10px;">${m.usedChunks.map((c) => `<span class="sp-kw-chip hit">✓ ${esc(c)}</span>`).join('')}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    const canFinish = answeredCount >= (isExam ? turns.length : 1);
    const footBtnAct = phase === 'review'
      ? (fullTestSession && fullTestSession.stage === 1 ? 'SpeakingStudio.advanceFullSpeakingTest()' : 'SpeakingStudio.closePracticeRoom()')
      : (allAnswered
        ? 'SpeakingStudio.finishInterview()'
        : (countWords(curTurn.text) > 0 && qIdx < turns.length - 1
          ? 'SpeakingStudio.nextInterviewQ()'
          : (typeMode && !isExam ? 'SpeakingStudio.submitInterviewTyped()' : 'SpeakingStudio.toggleInterviewMic()')));
    const footBtnLabel = phase === 'review'
      ? (fullTestSession && fullTestSession.stage === 1
        ? 'Tiếp tục sang Part 2 · Cue Card →'
        : (fullTestSession && fullTestSession.stage === 3 ? 'Hoàn tất Full Test ✓' : 'Về kho đề ✓'))
      : (allAnswered
        ? `Nộp & Chấm điểm Part ${part} →`
        : (countWords(curTurn.text) > 0 && qIdx < turns.length - 1
          ? `Câu tiếp (${qIdx + 2}/${turns.length}) →`
          : (typeMode && !isExam ? `Lưu Câu ${qIdx + 1} ✓` : (recording ? `Dừng & Lưu Q${qIdx + 1}` : `Bắt đầu trả lời Q${qIdx + 1}`))));

    const isProMode = getRoomViewMode() === 'pro3d' && phase === 'interview';
    if (phase === 'review') {
      cleanupProEngines();
    }
    if (isProMode) {
      const examiner = getProExaminer();
      const vadSt = roomState.proVadState || 'paused';
      const activeMode = !roomState.proStarted
        ? 'idle'
        : (roomState.examinerSpeaking
          ? 'speaking'
          : (vadSt === 'processing' ? 'processing' : 'listening'));
      const stageClasses = [
        activeMode === 'speaking' ? 'is-speaking' : '',
        activeMode === 'listening' ? 'is-listening' : '',
        activeMode === 'processing' ? 'is-processing' : ''
      ].filter(Boolean).join(' ');
      const barState = !roomState.proStarted
        ? 'paused'
        : (roomState.examinerSpeaking ? 'examiner' : vadSt);
      const statusLabel = !roomState.proStarted
        ? `Chờ bắt đầu phiên thi Part ${part}`
        : (roomState.proStatusText || `Part ${part} · Đang thi trực tiếp`);

      // Pure Real IELTS Exam UI: ZERO question text, ZERO hints, ZERO Q-jump buttons, ZERO typing!
      const topRightHtml = `
        <div class="sp-pro-glass-pill tabular" id="sp-pro-q-badge">Part ${part} · Câu ${qIdx + 1}/${turns.length}</div>
      `;

      const lobbyHtml = !roomState.proStarted
        ? renderProLobbyHtml(part, topic.title, examiner.id)
        : '';

      const controlBarHtml = `
        <div class="sp-pro-dock-left">
          <div class="sp-pro-dock-clock tabular" id="sp-int-rec-time">${fmtMmSs(recElapsedSec || 0)}</div>
          <span class="sp-pro-mic-status-pill">
            <span class="sp-pro-mic-dot" aria-hidden="true"></span>
            <span id="sp-pro-mic-lbl">${esc(statusLabel)}</span>
          </span>
        </div>

        <div class="sp-pro-dock-center">
          <div class="sp-pro-dock-wave">${Array.from({ length: 12 }).map(() => `<span class="sp-wave-bar" data-wave="room"></span>`).join('')}</div>
        </div>

        <div class="sp-pro-dock-right">
          ${roomState.proStarted ? `
            <button type="button" class="sp-pro-sec-btn" id="sp-pro-done-turn-btn" style="${(barState === 'listening' || barState === 'speaking') ? '' : 'display:none;'}" onclick="SpeakingStudio.finishProTurnManual()" title="Phím tắt: Space">Xong lượt (Space)</button>
            <button type="button" class="sp-pro-sec-btn is-primary" id="sp-pro-finish-early-btn" style="${answeredCount >= 1 ? '' : 'display:none;'}" onclick="SpeakingStudio.finishInterview()">Chấm sớm (${answeredCount}/${turns.length})</button>
          ` : ''}
        </div>
      `;

      const html = `
        <div class="ins-main-col" onclick="SpeakingStudio.toggleRoomOptions(false)">
          <header class="ins-header ${isExam ? '' : 'ws-prac-custom-hdr'}">
            <div class="ins-hdr-left">
              ${headerBrandHtml}
              <div class="ins-hdr-meta">
                <div class="ins-hdr-title">${fullTestSession ? `Full Test · ${esc(fullTestSession.test.shortSource)} · 3D Pro · Part ${part}` : `Speaking Studio · Phòng Thi Thật 3D Pro · Part ${part}`}</div>
                <div class="ins-hdr-timer" style="cursor:default;"><span id="sp-room-timer">${timerLabel}</span></div>
              </div>
            </div>
            <div class="ins-hdr-right">
              ${renderModeSwitchHtml()}
              ${acChipHtml}
              <div class="ws-ins-opt-wrap" onclick="event.stopPropagation()">
                <button type="button" class="ins-hdr-ico" id="sp-prac-opt-btn" onclick="SpeakingStudio.toggleRoomOptions()" title="Màu sắc &amp; Cỡ chữ" aria-label="Options">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
                </button>
                <div class="ws-ins-opt-pop" id="sp-prac-opt-pop">${roomOptHtml}</div>
              </div>
              <button type="button" class="ins-hdr-exit" onclick="SpeakingStudio.closePracticeRoom()">Thoát</button>
            </div>
          </header>

          ${fullTestSession ? renderFullTestRibbonHtml(part) : ''}

          ${renderProStageShell({ stageClasses, examiner, statusLabel, topRightHtml, lobbyHtml, sidePanelHtml: '', controlBarHtml, barState })}
        </div>
      `;
      commitProCinemaDom(root, html, examiner.id, activeMode);
      return;
    }

    root.innerHTML = `
      <div class="ins-main-col" onclick="SpeakingStudio.toggleRoomOptions(false)">
        <header class="ins-header ${isExam ? '' : 'ws-prac-custom-hdr'}">
          <div class="ins-hdr-left">
            ${headerBrandHtml}
            <div class="ins-hdr-meta">
              <div class="ins-hdr-title">${fullTestSession ? `Full Test · ${esc(fullTestSession.test.shortSource)} · Part ${part}` : (isExam ? `Test taker · Speaking Part ${part}` : `Speaking Studio · Luyện tập Part ${part}`)}</div>
              <div class="ins-hdr-timer" style="cursor:default;"><span id="sp-room-timer">${timerLabel}</span></div>
            </div>
          </div>
          <div class="ins-hdr-right">
            ${phase !== 'review' ? renderModeSwitchHtml() : ''}
            ${acChipHtml}
            <div class="ws-ins-opt-wrap" onclick="event.stopPropagation()">
              <button type="button" class="ins-hdr-ico" id="sp-prac-opt-btn" onclick="SpeakingStudio.toggleRoomOptions()" title="Màu sắc &amp; Cỡ chữ" aria-label="Options">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              </button>
              <div class="ws-ins-opt-pop" id="sp-prac-opt-pop">${roomOptHtml}</div>
            </div>
            <button type="button" class="ins-hdr-exit" onclick="SpeakingStudio.closePracticeRoom()">Thoát</button>
          </div>
        </header>

        ${fullTestSession ? renderFullTestRibbonHtml(part) : ''}

        ${isExam ? `
          <div class="ins-part-banner">
            <strong>Part ${part}</strong>
            <span>${isP1
              ? 'Introduction & Interview — Answer 4 questions naturally (20–35 seconds each).'
              : 'Two-Way Discussion — Discuss 6 abstract questions in depth (40–65 seconds each).'}</span>
          </div>
        ` : ''}

        <div class="ins-split-body">
          <section class="ins-pane ins-pane-left sp-ins-left">
            ${leftPaneHtml}
          </section>
          <section class="ins-pane ins-pane-right sp-ins-right">
            ${rightPaneHtml}
          </section>
        </div>

        <footer class="ins-footer">
          <div class="ins-footer-parts">
            <div class="sp-foot-steps">
              ${turns.map((t, i) => `
                ${i > 0 ? '<span class="sp-foot-sep">→</span>' : ''}
                <span class="sp-foot-step ${phase === 'interview' && i === qIdx ? 'is-active' : (countWords(t.text) > 0 || phase === 'review' ? 'is-done' : '')}">
                  <span class="sp-foot-full">Câu ${i + 1}</span><span class="sp-foot-short">Q${i + 1}</span>
                </span>
              `).join('')}
              <span class="sp-foot-sep">→</span>
              <span class="sp-foot-step ${phase === 'review' ? 'is-active' : ''}"><span class="sp-foot-full">Chấm điểm</span><span class="sp-foot-short">Điểm</span></span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${phase === 'interview' && !isExam && canFinish && !allAnswered ? `<button type="button" class="ws-ins-plan-btn" style="height:34px;padding:0 12px;" onclick="SpeakingStudio.finishInterview()">Chấm sớm (${answeredCount}/${turns.length})</button>` : ''}
            <button type="button" class="sp-foot-action-btn" onclick="${footBtnAct}">${footBtnLabel}</button>
          </div>
        </footer>
      </div>
    `;
  }

  /* ================= SUMMARY MODAL (BẢNG THỐNG KÊ) ================= */
  function openSummaryModal() {
    ensureOverlays();
    const story = getStory();
    const hasStoryAccess = Boolean(story && (!window.AccessPolicy || window.AccessPolicy.can('speaking.story_mindmap')));
    const mStats = hasStoryAccess ? getStoryMasteryStats(story) : { done: 0, total: 0 };
    const done = hasStoryAccess ? getTaskDoneMap()[story?.id] : null;
    const hist = getPracHistory();
    const el = document.getElementById('sp-summary-card');
    if (!el) return;
    const totalTopics = getPart1Topics().length + getPart2CambridgeTopics().length + (hasStoryAccess ? (story?.cueCards || []).length : 0) + getPart3Topics().length + getFullSpeakingTests().length;
    el.innerHTML = `
      <div class="sp-modal-head">
        <div class="sp-modal-title">Bảng Thống Kê · IELTS Speaking (Part 1–3 &amp; Full Test)</div>
        <button type="button" class="btn" style="padding:5px 11px;" onclick="SpeakingStudio.closeSummaryModal()">Đóng ✕</button>
      </div>
      <div class="sp-metrics-grid">
        ${hasStoryAccess ? `<div class="sp-metric-box"><div class="sp-metric-val">${mStats.done}/${mStats.total}</div><div class="sp-metric-lbl">Thẻ đã thuộc</div></div>` : ''}
        ${hasStoryAccess ? `<div class="sp-metric-box"><div class="sp-metric-val">${done?.completed ? '4/4' : `${done?.maxStage || 0}/4`}</div><div class="sp-metric-lbl">Task Story 01</div></div>` : ''}
        <div class="sp-metric-box"><div class="sp-metric-val">${new Set(hist.map((h) => h.cueId)).size}/${totalTopics}</div><div class="sp-metric-lbl">Đề &amp; Full Test</div></div>
        <div class="sp-metric-box"><div class="sp-metric-val">${hist.length}</div><div class="sp-metric-lbl">Tổng lượt nói</div></div>
      </div>
    `;
    document.getElementById('sp-summary-modal').classList.add('open');
  }
  function closeSummaryModal() {
    document.getElementById('sp-summary-modal')?.classList.remove('open');
  }

  function getOverallStats() {
    const story = getStory();
    const hasStoryAccess = Boolean(story && (!window.AccessPolicy || window.AccessPolicy.can('speaking.story_mindmap')));
    const mStats = hasStoryAccess ? getStoryMasteryStats(story) : { done: 0, total: 0 };
    const done = hasStoryAccess ? getTaskDoneMap()[story.id] : null;
    const hist = getPracHistory();
    const topicsTotal = getPart1Topics().length + getPart2CambridgeTopics().length + (hasStoryAccess ? (story?.cueCards || []).length : 0) + getPart3Topics().length + getFullSpeakingTests().length;
    const topicsDone = new Set(hist.map((h) => h.cueId)).size;
    const masteredCards = mStats.done || 0;
    const totalCards = mStats.total || 0;
    const tasksDone = (hasStoryAccess ? (done?.completed ? 4 : (done?.maxStage || 0)) : 0) + topicsDone;
    const tasksTotal = (hasStoryAccess ? 4 : 0) + topicsTotal;
    return {
      masteredCards,
      totalCards,
      cardPct: totalCards > 0 ? Math.min(100, Math.round((masteredCards / totalCards) * 100)) : 0,
      tasksDone,
      tasksTotal,
      taskPct: tasksTotal > 0 ? Math.min(100, Math.round((tasksDone / tasksTotal) * 100)) : 0
    };
  }

  /* ================= EXPORT ================= */
  window.SpeakingStudio = {
    getOverallStats,
    renderSpeakingHomePanel,
    openHistoryReview,
    closeHistoryReview,
    renderFlashcardWorkspace,
    renderTaskHub,
    renderPracticeHub,
    openSummaryModal,
    closeSummaryModal,
    // Flashcard controls
    flipCard,
    stepCard,
    jumpCard,
    jumpToPart,
    speakCurrent,
    speakSectionEn,
    speakRaw,
    toggleChunksOnly,
    toggleUnmastered,
    toggleFlowMask,
    revealFlowNode,
    toggleSectionEn,
    assessCard,
    // Recall modal (B1 Gõ -> B2 Nói)
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
    // Fullscreen Mindmap Bẻ Lái (Pan/Zoom/Fit/VI-EN)
    openMindmapModal,
    closeMindmapModal,
    setMindmapMode,
    setMindmapLang,
    selectMindmapGroup,
    zoomMindmap,
    fitMindmapToScreen,
    // Task 4-step
    startTaskExam,
    jumpExamStage,
    closeTaskExamModal,
    teacherJumpExam,
    checkTaskTest1,
    selectT2Station,
    toggleT2Hint,
    toggleT2TypeMode,
    toggleT2Mic,
    submitT2Typed,
    checkTaskTest2,
    selectT3Map,
    saveT3Draft,
    gradeCurrentSteerMap,
    checkTaskTest3,
    cycleT4Cue,
    saveT4PrepNote,
    beginT4Speaking,
    toggleT4TypeMode,
    toggleT4Mic,
    submitT4Typed,
    launchCueCardFromTask,
    // Practice hub & room (Part 1, Part 2, Part 3, Full Test 14p)
    setPracticePart,
    openPracticePart,
    startFullSpeakingTest,
    advanceFullSpeakingTest,
    setPracticeCat,
    setPracticeQuery,
    resetPracticeFilters,
    openRandomTopic,
    openRandomCueCard,
    openPracticeRoom,
    closePracticeRoom,
    saveRoomNote,
    resetRoomPlan,
    beginRoomSpeaking,
    toggleRoomTypeMode,
    toggleRoomMic,
    submitRoomTyped,
    toggleRoomFullB4,
    toggleRoomPrepHint,
    toggleRoomBullet,
    toggleRoomOptions,
    setRoomContrast,
    setRoomTextSize,
    // Part 1 & Part 3 Examiner Interview Room
    openInterviewRoom,
    speakInterviewQuestion,
    toggleInterviewGuide,
    toggleInterviewModel,
    toggleInterviewTypeMode,
    toggleInterviewMic,
    submitInterviewTyped,
    nextInterviewQ,
    jumpInterviewQ,
    finishInterview,
    // 3D Examiner Pro Mode controls
    setRoomViewMode,
    setProExaminer,
    toggleProBlindCaptions,
    toggleProDrawer,
    speakPart2Prompt,
    startProExamSession,
    finishProTurnManual
  };
})();
