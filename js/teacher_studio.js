/* ==========================================================================
   TOTORO IELTS MASTER — 4-SKILL TEACHER STUDIO (COMMAND CENTER)
   Supports Reading · Listening · Writing · Speaking:
   - Unified 4-skill student roster with daily 4-skill matrix (R / L / W / S)
   - Granular Per-Task Unlock + Unlock All (handles 1 locked task OR all 4 locked!)
   - Dedicated Active / Expired 4-Skill Homework Monitor (2x2 daily card grid)
   - Ultra-clean 4-Skill Link Composer & Picker (NO "chưa làm / đang học" clutter on cards!)
   - Multi-skill student assignment link routing (?task=... / ?tasks=...)
   ========================================================================== */
(function () {
  'use strict';

  const SENT_KEY = 'ielts_teacher_sent_tasks_v1';
  const LIVE_DL_KEY = 'ielts_teacher_live_deadlines_v1';
  const DISMISSED_KEY = 'ielts_teacher_dismissed_hw_v1';
  const COMPOSER_TPL_KEY = 'ielts_teacher_composer_tpl_v1';
  const WEEKLY_BATCHES_KEY = 'ielts_teacher_weekly_batches_v1';
  const LOCK_PENALTY_MS = 30 * 60 * 1000;

  const WEEKLY_SECTIONS = [
    { key: 'listening', short: '1. Nghe',  heading: 'BÀI TẬP MÔN NGHE' },
    { key: 'speaking',  short: '2. Nói',   heading: 'BÀI TẬP MÔN NÓI' },
    { key: 'reading',   short: '3. Đọc',   heading: 'BÀI TẬP MÔN ĐỌC' },
    { key: 'writing',   short: '4. Viết',  heading: 'BÀI TẬP MÔN VIẾT' },
    { key: 'vocab',     short: '5. TV/NP', heading: 'BÀI TẬP TỪ VỰNG/NGỮ PHÁP' },
  ];

  const REPORT_4_SKILLS = [
    { key: 'listening', num: 1, label: 'Nghe' },
    { key: 'speaking',  num: 2, label: 'Nói' },
    { key: 'reading',   num: 3, label: 'Đọc' },
    { key: 'writing',   num: 4, label: 'Viết' },
  ];

  const LISTENING_PROG_BASE = 'totoro_listening_task_progress_v1_';
  const LISTENING_LOCK_BASE = 'totoro_listening_task_locks_v1_';
  const WRITING_PROG_BASE = 'totoro_writing_task_prog_v1_';
  const WRITING_LOCK_BASE = 'totoro_writing_task_lock_v1_';
  const WRITING_PRAC_LOCK_BASE = 'totoro_writing_prac_lock_v1_';
  const SPEAKING_PROG_BASE = 'totoro_speaking_task_done_v1_';
  const SPEAKING_PROG_LEGACY_BASE = 'totoro_speaking_task_prog_v1_';
  const SPEAKING_LOCK_BASE = 'totoro_speaking_task_locks_v1_';

  const SKILLS = [
    { key: 'reading',   short: 'R', label: 'Reading',   sub: '110 Tasks · 4 bộ từ' },
    { key: 'listening', short: 'L', label: 'Listening', sub: '139 Tasks · Part 1–4' },
    { key: 'writing',   short: 'W', label: 'Writing',   sub: 'Flow Ideas · 3 bước' },
    { key: 'speaking',  short: 'S', label: 'Speaking',  sub: 'Part 1–3 · Chuẩn bị' },
  ];

  const READING_SUITES = [
    { key: 'foundation', label: 'Nền tảng (30)' },
    { key: 'academic',   label: 'Học thuật (20)' },
    { key: 'paraphrase', label: 'Paraphrase (30)' },
    { key: 'advanced',   label: 'Chuyên sâu (30)' },
    { key: 'rp_cambridge', label: 'Đề Cambridge' },
    { key: 'rp_volume',    label: 'Đề Volume' },
    { key: 'rp_actual',    label: 'Đề Actual' },
  ];

  const WORKSPACE_TAB_KEY = 'ielts_teacher_workspace_tab_v1';

  const state = {
    activeTab: (() => {
      try {
        const saved = localStorage.getItem(WORKSPACE_TAB_KEY);
        return ['students', 'monitor', 'assign'].includes(saved) ? saved : 'students';
      } catch (_) { return 'students'; }
    })(),
    toolsMenuOpen: false,
    tableView: 'today',       // 'today' | 'month' | 'full'
    rosterFilter: 'all',      // 'all' | 'locked' | 'pending'
    monitorTab: 'active',     // 'active' | 'expired'
    monitorSkill: 'all',      // 'all' | 'reading' | 'listening' | 'writing' | 'speaking'
    pickerSkill: 'reading',   // 'reading' | 'listening' | 'writing' | 'speaking'
    pickerSuite: {
      reading: 'foundation',
      listening: 'part1',
      writing: 'all',
      speaking: 'all',
    },
    pickerPracticeMode: 'practice', // 'practice' | 'exam'
    pickerHideFull: true,           // Default to individual Passages & Sections (no Full Test clutter)
    pickerLoadingBank: false,
    pickerQuery: '',
    pickerHideAllDone: false,
    selectedIds: new Set(),
    presetDirty: false,
    detailTaskId: '',
    detailFilter: 'all',
    remindedKeys: new Set(),
    unlockingIds: new Set(),
    tickerId: null,
    quickAssignCtx: null,
    handledUrlKey: '',
    composerTemplate: (() => {
      try {
        const saved = localStorage.getItem(COMPOSER_TPL_KEY);
        return saved === 'daily' ? 'daily' : 'weekly';
      } catch (_) { return 'weekly'; }
    })(),
    weeklyTitle: '',
    weeklyTitleDirty: false,
    weeklyIssuedDate: '',
    weeklyAutoSource: 'cambridge',
    weeklyAutoOffset: 0,
    weeklyAutoLoading: false,
    dailyAutoOffset: 0,
    showEmptySections: false,
    sectionOverrides: {},
    reportBatchKey: '',
    reportCustomTitle: '',
    reportMode: 'student', // 'student' | 'class'
    reportStudentId: '',
    reportIncludeName: true,
    reportIncludeClassDetails: false,
  };

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function esc(str) {
    if (B()?.escapeHtml) return B().escapeHtml(str);
    return String(str ?? '').replace(/[&<>"']/g, (s) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[s]));
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function writeJson(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (_) {}
  }

  function shortName(fullName) {
    const pts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return pts.length >= 2 ? pts.slice(-2).join(' ') : (pts[0] || '');
  }

  function monogram(name) {
    const pts = String(name || 'HV').trim().split(/\s+/).filter(Boolean);
    return (pts.length >= 2 ? (pts[pts.length - 2][0] + pts[pts.length - 1][0]) : (pts[0] || 'HV').slice(0, 2)).toUpperCase();
  }

  function formatMmSs(ms) {
    const total = Math.max(0, Math.ceil(Number(ms || 0) / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatDeadlineRemaining(ms) {
    const sec = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}d ${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatDeadlineTs(ts) {
    if (!ts) return '';
    const d = new Date(Number(ts));
    if (Number.isNaN(d.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  }

  function formatDurationCompact(sec) {
    const s = Math.max(0, Math.round(Number(sec || 0)));
    if (!s) return '';
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}p${r > 0 ? `${r}s` : ''}` : `${r}s`;
  }

  function skillMeta(skillKey) {
    return SKILLS.find((s) => s.key === skillKey) || SKILLS[0];
  }

  /* =========================================================
     PRACTICE ASSIGNMENT ID PARSER (rp / rp_full / lp / lp_full / wp)
     Format: <prefix>:<itemId>:<practice|exam>
     ========================================================= */
  function parsePracticeTaskId(rawId) {
    const s = String(rawId || '').trim();
    const m = s.match(/^(rp_full|rp|lp_full|lp|wp_full|wp|sp):([^:\s]+)(?::(practice|exam))?$/i);
    if (!m) return null;
    const prefix = m[1].toLowerCase();
    const itemId = m[2];
    const mode = (m[3] || 'practice').toLowerCase() === 'exam' ? 'exam' : 'practice';
    const skill = prefix.startsWith('rp')
      ? 'reading'
      : (prefix.startsWith('lp') ? 'listening' : (prefix === 'sp' ? 'speaking' : 'writing'));
    const isFull = prefix.endsWith('_full');
    return {
      prefix,
      skill,
      isFull,
      itemId,
      mode,
      canonicalId: `${prefix}:${itemId}:${mode}`,
    };
  }

  function buildPracticeTaskId(skill, itemId, isFull, mode = 'practice') {
    const cleanMode = mode === 'exam' ? 'exam' : 'practice';
    if (skill === 'reading') return `${isFull ? 'rp_full' : 'rp'}:${itemId}:${cleanMode}`;
    if (skill === 'listening') return `${isFull ? 'lp_full' : 'lp'}:${itemId}:${cleanMode}`;
    if (skill === 'speaking') return `sp:${itemId}:${cleanMode}`;
    return `${isFull ? 'wp_full' : 'wp'}:${itemId}:${cleanMode}`;
  }

  function formatPracticeFallbackLabel(pm) {
    const modeTag = pm.mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const raw = pm.itemId;
    if (pm.skill === 'reading') {
      const mCam = raw.match(/^cam_(\d+)_t(\d+)(?:_p(\d+))?$/i);
      if (mCam) return { code: `Cam ${mCam[1]} · T${mCam[2]}${mCam[3] ? ` · P${mCam[3]}` : ' Full'}`, shortCode: `C${mCam[1]}T${mCam[2]}${mCam[3] ? `P${mCam[3]}` : ''}`, theme: `Reading Practice (${modeTag})` };
      const mVol = raw.match(/^vol_(\d+)_t(\d+)(?:_p(\d+))?$/i);
      if (mVol) return { code: `Vol ${mVol[1]} · T${mVol[2]}${mVol[3] ? ` · P${mVol[3]}` : ' Full'}`, shortCode: `V${mVol[1]}T${mVol[2]}${mVol[3] ? `P${mVol[3]}` : ''}`, theme: `Reading Volume (${modeTag})` };
      return { code: pm.isFull ? `Reading Full (${raw})` : `Reading (${raw})`, shortCode: raw.slice(0, 10), theme: `Reading Practice (${modeTag})` };
    }
    if (pm.skill === 'listening') {
      const mCam = raw.match(/^lcam_(\d+)_t(\d+)(?:_p(\d+))?$/i);
      if (mCam) return { code: `LCam ${mCam[1]} · T${mCam[2]}${mCam[3] ? ` · P${mCam[3]}` : ' Full'}`, shortCode: `LC${mCam[1]}T${mCam[2]}${mCam[3] ? `P${mCam[3]}` : ''}`, theme: `Listening Practice (${modeTag})` };
      const mVol = raw.match(/^lvol_(\d+)_t(\d+)(?:_p(\d+))?$/i);
      if (mVol) return { code: `LVol ${mVol[1]} · T${mVol[2]}${mVol[3] ? ` · P${mVol[3]}` : ' Full'}`, shortCode: `LV${mVol[1]}T${mVol[2]}${mVol[3] ? `P${mVol[3]}` : ''}`, theme: `Listening Volume (${modeTag})` };
      return { code: pm.isFull ? `Listening Full (${raw})` : `Listening (${raw})`, shortCode: raw.slice(0, 10), theme: `Listening Practice (${modeTag})` };
    }
    if (pm.skill === 'speaking') {
      return { code: `Speaking · ${raw.toUpperCase()}`, shortCode: raw.toUpperCase().slice(0, 8), theme: `Speaking Cue Card (${modeTag})` };
    }
    return { code: `Writing ${raw.toUpperCase()}`, shortCode: raw.toUpperCase().slice(0, 8), theme: `Writing Task 2 (${modeTag})` };
  }

  function buildPracticeTaskDescriptor(pm) {
    if (!pm) return null;
    const modeTag = pm.mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const fb = formatPracticeFallbackLabel(pm);
    let code = fb.code;
    let shortCode = fb.shortCode;
    let theme = fb.theme;

    if (pm.skill === 'reading') {
      const d = window.READING_PRACTICE_DATA || {};
      const item = pm.isFull
        ? (d.FULL_TESTS || []).find((x) => x.id === pm.itemId)
        : (d.PASSAGES || {})[pm.itemId];
      if (item) {
        const series = item.series ? `${item.series}${pm.isFull ? ' · FULL' : (item.passageNum ? ` · P${item.passageNum}` : '')}` : fb.code;
        code = series;
        theme = `${item.title || item.id} (${modeTag})`;
      }
    } else if (pm.skill === 'listening') {
      const d = window.LISTENING_PRACTICE_DATA || {};
      const item = pm.isFull
        ? (d.FULL_TESTS || []).find((x) => x.id === pm.itemId)
        : (d.PARTS || {})[pm.itemId];
      if (item) {
        code = pm.isFull ? (item.series || fb.code) : `${item.series || fb.code}${item.partNum ? ` · P${item.partNum}` : ''}`;
        theme = `${item.title || item.id} (${modeTag})`;
      }
    } else if (pm.skill === 'writing') {
      const t1 = (window.WRITING_TASK1_DATA?.TASK1_PROMPTS || []).find((x) => x.id === pm.itemId);
      const ft = (window.WRITING_TASK1_DATA?.FULL_TESTS || []).find((x) => x.id === pm.itemId);
      if (ft) {
        code = `Writing · Full 60p`;
        shortCode = ft.id.toUpperCase();
        theme = `${ft.title} (${modeTag})`;
      } else if (t1) {
        code = `Task 1 · ${t1.type || 'Chart'}`;
        shortCode = t1.id.replace(/^wt1_/i, 'WT1-').slice(0, 10).toUpperCase();
        theme = `${t1.title} (${modeTag})`;
      } else {
        const p = (window.WRITING_STUDIO_DATA?.PRACTICE_PROMPTS || []).find((x) => x.id === pm.itemId);
        if (p) {
          code = `Writing · ${p.type || 'Task 2'}`;
          shortCode = p.id.toUpperCase();
          const snippet = String(p.prompt || '').trim();
          theme = `${snippet.length > 76 ? snippet.slice(0, 76) + '…' : snippet} (${modeTag})`;
        }
      }
    } else if (pm.skill === 'speaking') {
      const p13 = window.SPEAKING_PART13_DATA || {};
      const ft = (p13.FULL_TESTS || []).find((x) => x.id === pm.itemId);
      const p2Cam = (p13.PART2_CAMBRIDGE_TOPICS || []).find((x) => x.id === pm.itemId);
      const p1 = (p13.PART1_TOPICS || []).find((x) => x.id === pm.itemId);
      const p3 = (p13.PART3_TOPICS || []).find((x) => x.id === pm.itemId);
      if (ft) {
        code = `Speaking · Full 14p`;
        shortCode = ft.id.replace(/^sp_full_/i, 'SF-').toUpperCase().slice(0, 10);
        theme = `${ft.title} (${modeTag})`;
      } else if (p2Cam) {
        code = `Speaking · Part 2`;
        shortCode = p2Cam.id.replace(/^sp_p2_/i, 'SP2-').toUpperCase().slice(0, 10);
        const snippet = String(p2Cam.title || '').trim();
        theme = `${snippet.length > 76 ? snippet.slice(0, 76) + '…' : snippet} (${modeTag})`;
      } else if (p1 || p3) {
        const tp = p1 || p3;
        code = `Speaking · Part ${tp.part}`;
        shortCode = `SP${tp.part}-${tp.id.replace(/^sp_p[13]_/i, '').slice(0, 5).toUpperCase()}`;
        const snippet = String(tp.title || '').trim();
        theme = `${snippet}${tp.titleVi ? ` (${tp.titleVi})` : ''} (${modeTag})`;
      } else {
        const allCues = (window.SPEAKING_STUDIO_DATA?.STORIES || []).flatMap((st) => st.cueCards || []);
        const cue = allCues.find((x) => x.id === pm.itemId);
        if (cue) {
          code = `Speaking · Part 2`;
          shortCode = cue.id.replace(/^sp_s\d+_/i, 'SC').toUpperCase();
          const snippet = String(cue.title || '').trim();
          theme = `${snippet.length > 76 ? snippet.slice(0, 76) + '…' : snippet} (${modeTag})`;
        }
      }
    }

    return {
      id: pm.canonicalId,
      skill: pm.skill,
      suite: pm.skill === 'writing' ? 'wp_practice' : (pm.skill === 'speaking' ? 'sp_practice' : `${pm.skill === 'reading' ? 'rp' : 'lp'}_practice`),
      num: 0,
      code,
      shortCode,
      theme,
      wordTotal: 1,
      isPractice: true,
      practiceMeta: pm,
      raw: null,
    };
  }

  function detectSkillByTaskId(rawId) {
    const id = String(rawId || '').trim();
    if (!id) return 'reading';
    const pm = parsePracticeTaskId(id);
    if (pm) return pm.skill;
    if (/^(task|fnd|acd|adv)_\d+$/i.test(id)) return 'reading';
    if (/^(lp\d|lmap|lcf|lcore|ltask)_/i.test(id)) return 'listening';
    if (/^w_/i.test(id)) return 'writing';
    if (/^sp_/i.test(id)) return 'speaking';
    // Fallback lookup in Listening / Writing datasets
    if ((window.APP_LISTENING_TASKS?.tasks || []).some((t) => t.id === id)) return 'listening';
    if ((window.WRITING_STUDIO_DATA?.MODULES || []).some((m) => m.id === id)) return 'writing';
    return 'reading';
  }

  function normalizeAnyTaskId(raw) {
    const s = String(raw || '').trim();
    if (!s) return '';
    const pm = parsePracticeTaskId(s);
    if (pm) return pm.canonicalId;
    // Reading numeric shorthand "1" -> "task_01"
    if (/^\d{1,2}$/.test(s)) return `task_${s.padStart(2, '0')}`;
    if (/^(task|fnd|acd|adv)_\d{1,2}$/i.test(s)) {
      const [pref, num] = s.toLowerCase().split('_');
      return `${pref}_${String(Number(num)).padStart(2, '0')}`;
    }
    return s;
  }

  /* =========================================================
     1. UNIFIED 4-SKILL TASK CATALOG
     ========================================================= */
  function getReadingCatalog() {
    if (window.AccessPolicy?.isRestricted?.()) return [];
    const raw = window.TasksModule?.getAllCatalogTasks?.() || [];
    return raw.map((t) => ({
      id: t.id,
      skill: 'reading',
      suite: t.scopeKey || 'paraphrase',
      num: t.num || Number(String(t.id).replace(/\D/g, '')) || 0,
      code: t.label || t.id,
      shortCode: /^fnd_/i.test(t.id) ? `NT${t.num}` : (/^acd_/i.test(t.id) ? `HT${t.num}` : (/^adv_/i.test(t.id) ? `CS${t.num}` : `P${t.num}`)),
      theme: t.theme || '',
      wordTotal: Array.isArray(t.words) ? t.words.length : 50,
      raw: t,
    }));
  }

  function getListeningCatalog() {
    if (window.AccessPolicy?.isRestricted?.()) return [];
    const raw = window.APP_LISTENING_TASKS?.tasks || [];
    return raw.map((t, idx) => {
      const shortTopic = window.ListeningTasksModule?.shortTopicTitle?.(t.theme) || t.theme || t.label;
      const num = t.num || (idx + 1);
      const shortCode = t.isMapTask ? `Map ${num}` : (t.suite === 'core_found' ? `Core ${num}` : `P${(t.suite || '1').replace(/\D/g, '') || '1'}·${String(num).padStart(2, '0')}`);
      return {
        id: t.id,
        skill: 'listening',
        suite: t.suite || 'part1',
        num,
        code: t.label || t.id,
        shortCode,
        theme: shortTopic,
        wordTotal: Array.isArray(t.wordIds) ? t.wordIds.length : 30,
        raw: t,
      };
    });
  }

  function getWritingCatalog() {
    if (window.AccessPolicy?.isRestricted?.()) return [];
    const mods = window.WRITING_STUDIO_DATA?.MODULES || [];
    const subMap = {};
    (window.WRITING_STUDIO_DATA?.SUBTOPICS || []).forEach((st) => { subMap[st.key] = st.shortTitle || st.title; });
    return mods.map((m, idx) => {
      const stIdx = String(m.subtopic || '').replace(/\D/g, '') || '1';
      const mIdx = String(m.id || '').match(/m(\d+)/i)?.[1] || String(idx + 1);
      const cleanTitle = (window.WritingStudio?.getShortFlowTitle?.(m.id)) || m.title || m.code || m.id;
      const stName = subMap[m.subtopic] || '';
      return {
        id: m.id,
        skill: 'writing',
        suite: m.subtopic || 'st01',
        num: idx + 1,
        code: `W${Number(stIdx)}.${Number(mIdx)}`,
        shortCode: `W${Number(stIdx)}.${Number(mIdx)}`,
        theme: stName ? `${cleanTitle} · ${stName}` : cleanTitle,
        wordTotal: (Array.isArray(m.vocab) ? m.vocab.length : 0) + (Array.isArray(m.viFlowSteps) ? m.viFlowSteps.length : 0) + (Array.isArray(m.grammar) ? m.grammar.length : 0) || 12,
        raw: m,
      };
    });
  }

  function getSpeakingCatalog() {
    if (window.AccessPolicy?.isRestricted?.()) return [];
    const raw = window.SPEAKING_TASKS_DATA?.tasks || [];
    if (raw.length) {
      return raw.map((t, idx) => ({
        id: t.id || `sp_${String(idx + 1).padStart(2, '0')}`,
        skill: 'speaking',
        suite: t.suite || 'part1',
        num: t.num || (idx + 1),
        code: t.label || `Speaking ${idx + 1}`,
        shortCode: `S${idx + 1}`,
        theme: t.theme || t.title || '',
        wordTotal: Number(t.totalItems || 10),
        raw: t,
      }));
    }
    const stories = window.SPEAKING_STUDIO_DATA?.STORIES || [];
    return stories.map((st, idx) => ({
      id: st.id || `sp_story_${String(idx + 1).padStart(2, '0')}`,
      skill: 'speaking',
      suite: 'part2',
      num: idx + 1,
      code: st.code || `STORY ${String(idx + 1).padStart(2, '0')}`,
      shortCode: `S${idx + 1}`,
      theme: st.shortTitle || st.title || '',
      wordTotal: Array.isArray(st.vocab) ? st.vocab.length : 30,
      raw: st,
    }));
  }

  function getReadingPracticeCatalog(sourceKey) {
    const d = window.READING_PRACTICE_DATA || {};
    const mode = state.pickerPracticeMode === 'exam' ? 'exam' : 'practice';
    const modeTag = mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const out = [];
    const fulls = (d.FULL_TESTS || []).filter((ft) => ft && ft.source === sourceKey);
    fulls.forEach((ft, idx) => {
      const id = buildPracticeTaskId('reading', ft.id, true, mode);
      const fb = formatPracticeFallbackLabel(parsePracticeTaskId(id));
      out.push({
        id,
        skill: 'reading',
        suite: `rp_${sourceKey}`,
        num: idx + 1,
        code: `${ft.series || fb.code} · FULL`,
        shortCode: fb.shortCode + 'F',
        theme: `${ft.title || ft.id} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: ft,
      });
    });
    const passages = Object.values(d.PASSAGES || {}).filter((p) => p && p.source === sourceKey);
    passages.forEach((p, idx) => {
      const id = buildPracticeTaskId('reading', p.id, false, mode);
      const fb = formatPracticeFallbackLabel(parsePracticeTaskId(id));
      out.push({
        id,
        skill: 'reading',
        suite: `rp_${sourceKey}`,
        num: idx + 1,
        code: `${p.series || fb.code}${p.passageNum ? ` · P${p.passageNum}` : ''}`,
        shortCode: fb.shortCode,
        theme: `${p.title || p.id} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: p,
      });
    });
    return out;
  }

  function getListeningPracticeCatalog(sourceKey) {
    const d = window.LISTENING_PRACTICE_DATA || {};
    const mode = state.pickerPracticeMode === 'exam' ? 'exam' : 'practice';
    const modeTag = mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const out = [];
    const fulls = (d.FULL_TESTS || []).filter((ft) => ft && ft.source === sourceKey);
    fulls.forEach((ft, idx) => {
      const id = buildPracticeTaskId('listening', ft.id, true, mode);
      const fb = formatPracticeFallbackLabel(parsePracticeTaskId(id));
      out.push({
        id,
        skill: 'listening',
        suite: `lp_${sourceKey}`,
        num: idx + 1,
        code: `${ft.series || fb.code} · FULL`,
        shortCode: fb.shortCode + 'F',
        theme: `${ft.title || ft.id} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: ft,
      });
    });
    const parts = Object.values(d.PARTS || {}).filter((p) => p && p.source === sourceKey);
    parts.forEach((p, idx) => {
      const id = buildPracticeTaskId('listening', p.id, false, mode);
      const fb = formatPracticeFallbackLabel(parsePracticeTaskId(id));
      out.push({
        id,
        skill: 'listening',
        suite: `lp_${sourceKey}`,
        num: idx + 1,
        code: `${p.series || fb.code}${p.partNum ? ` · P${p.partNum}` : ''}`,
        shortCode: fb.shortCode,
        theme: `${p.title || p.id} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: p,
      });
    });
    return out;
  }

  function getWritingPracticeCatalog() {
    const t1List = window.WRITING_TASK1_DATA?.TASK1_PROMPTS || [];
    const fullList = window.WRITING_TASK1_DATA?.FULL_TESTS || [];
    const t2List = window.WRITING_STUDIO_DATA?.PRACTICE_PROMPTS || [];
    const mode = state.pickerPracticeMode === 'exam' ? 'exam' : 'practice';
    const modeTag = mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const out = [];
    t1List.forEach((p, idx) => {
      const id = buildPracticeTaskId('writing', p.id, false, mode);
      out.push({
        id,
        skill: 'writing',
        suite: 'wp_practice',
        num: idx + 1,
        code: `Task 1 #${String(idx + 1).padStart(2, '0')} · ${p.type}`,
        shortCode: `WT1-${idx + 1}`,
        theme: `${p.title} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: p,
      });
    });
    fullList.forEach((ft, idx) => {
      const id = buildPracticeTaskId('writing', ft.id, true, mode);
      out.push({
        id,
        skill: 'writing',
        suite: 'wp_practice',
        num: t1List.length + idx + 1,
        code: `Full 60p #${String(idx + 1).padStart(2, '0')}`,
        shortCode: `WF${idx + 1}`,
        theme: `${ft.title} (${modeTag})`,
        wordTotal: 2,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: ft,
      });
    });
    t2List.forEach((p, idx) => {
      const id = buildPracticeTaskId('writing', p.id, false, mode);
      const snippet = String(p.prompt || '').trim();
      out.push({
        id,
        skill: 'writing',
        suite: 'wp_practice',
        num: t1List.length + fullList.length + idx + 1,
        code: `Task 2 #${idx + 1} · ${p.type || 'Task 2'}`,
        shortCode: `WT2-${idx + 1}`,
        theme: `${snippet.length > 88 ? snippet.slice(0, 88) + '…' : snippet} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: p,
      });
    });
    return out;
  }

  function getSpeakingPracticeCatalog() {
    const restricted = Boolean(window.AccessPolicy?.isRestricted?.());
    const p13 = window.SPEAKING_PART13_DATA || {};
    const fullList = p13.FULL_TESTS || [];
    const p1List = p13.PART1_TOPICS || [];
    const p2CamList = p13.PART2_CAMBRIDGE_TOPICS || [];
    const p2StoryList = restricted ? [] : (window.SPEAKING_STUDIO_DATA?.STORIES || []).flatMap((st) => st.cueCards || []);
    const p3List = p13.PART3_TOPICS || [];
    const mode = state.pickerPracticeMode === 'exam' ? 'exam' : 'practice';
    const modeTag = mode === 'exam' ? 'Thi thật' : 'Luyện tập';
    const out = [];
    fullList.forEach((ft, idx) => {
      const id = buildPracticeTaskId('speaking', ft.id, false, mode);
      out.push({
        id,
        skill: 'speaking',
        suite: 'sp_practice',
        num: idx + 1,
        code: `Full Test · ${ft.shortSource || `#${idx + 1}`}`,
        shortCode: `SF-${idx + 1}`,
        theme: `${ft.title} (${modeTag})`,
        wordTotal: 11,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: ft,
      });
    });
    p1List.forEach((tp, idx) => {
      const id = buildPracticeTaskId('speaking', tp.id, false, mode);
      out.push({
        id,
        skill: 'speaking',
        suite: 'sp_practice',
        num: fullList.length + idx + 1,
        code: `Part 1 · ${tp.source ? tp.source.replace('Cambridge IELTS ', 'Cam ') : `#${String(idx + 1).padStart(2, '0')}`}`,
        shortCode: `P1-${idx + 1}`,
        theme: `${tp.title}${tp.titleVi ? ` · ${tp.titleVi}` : ''} (${modeTag})`,
        wordTotal: (tp.questions || []).length || 4,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: tp,
      });
    });
    p2CamList.forEach((c, idx) => {
      const id = buildPracticeTaskId('speaking', c.id, false, mode);
      const snippet = String(c.title || '').trim();
      out.push({
        id,
        skill: 'speaking',
        suite: 'sp_practice',
        num: fullList.length + p1List.length + idx + 1,
        code: `Part 2 · ${c.source ? c.source.replace('Cambridge IELTS ', 'Cam ') : `#${String(idx + 1).padStart(2, '0')}`}`,
        shortCode: `P2-${idx + 1}`,
        theme: `${snippet.length > 86 ? snippet.slice(0, 86) + '…' : snippet} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: c,
      });
    });
    p2StoryList.forEach((c, idx) => {
      const id = buildPracticeTaskId('speaking', c.id, false, mode);
      const snippet = String(c.title || '').trim();
      out.push({
        id,
        skill: 'speaking',
        suite: 'sp_practice',
        num: fullList.length + p1List.length + p2CamList.length + idx + 1,
        code: `Part 2 Story · #${String(idx + 1).padStart(2, '0')}`,
        shortCode: `S2-${idx + 1}`,
        theme: `${snippet.length > 86 ? snippet.slice(0, 86) + '…' : snippet} (${modeTag})`,
        wordTotal: 1,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: c,
      });
    });
    p3List.forEach((tp, idx) => {
      const id = buildPracticeTaskId('speaking', tp.id, false, mode);
      out.push({
        id,
        skill: 'speaking',
        suite: 'sp_practice',
        num: fullList.length + p1List.length + p2CamList.length + p2StoryList.length + idx + 1,
        code: `Part 3 · ${tp.source ? tp.source.replace('Cambridge IELTS ', 'Cam ') : `#${String(idx + 1).padStart(2, '0')}`}`,
        shortCode: `P3-${idx + 1}`,
        theme: `${tp.title}${tp.titleVi ? ` · ${tp.titleVi}` : ''} (${modeTag})`,
        wordTotal: (tp.questions || []).length || 6,
        isPractice: true,
        practiceMeta: parsePracticeTaskId(id),
        raw: tp,
      });
    });
    return out;
  }

  function getCatalogBySkill(skillKey) {
    if (skillKey === 'reading') {
      const curSuite = state.pickerSuite.reading || 'foundation';
      if (curSuite.startsWith('rp_')) return getReadingPracticeCatalog(curSuite.slice(3));
      return getReadingCatalog();
    }
    if (skillKey === 'listening') {
      const curSuite = state.pickerSuite.listening || 'part1';
      if (curSuite.startsWith('lp_')) return getListeningPracticeCatalog(curSuite.slice(3));
      return getListeningCatalog();
    }
    if (skillKey === 'writing') {
      const curSuite = state.pickerSuite.writing || 'all';
      if (curSuite === 'wp_practice') return getWritingPracticeCatalog();
      return getWritingCatalog();
    }
    if (skillKey === 'speaking') {
      const curSuite = state.pickerSuite.speaking || 'all';
      if (curSuite === 'sp_practice') return getSpeakingPracticeCatalog();
      return getSpeakingCatalog();
    }
    return [];
  }

  function getAllCatalogTasks() {
    return [
      ...getReadingCatalog(),
      ...getListeningCatalog(),
      ...getWritingCatalog(),
      ...getSpeakingCatalog(),
    ];
  }

  function getTaskById(rawId) {
    const id = normalizeAnyTaskId(rawId);
    if (!id) return null;
    const pm = parsePracticeTaskId(id);
    if (pm) return buildPracticeTaskDescriptor(pm);
    const sk = detectSkillByTaskId(id);
    const list = sk === 'reading' ? getReadingCatalog()
      : (sk === 'listening' ? getListeningCatalog()
        : (sk === 'writing' ? getWritingCatalog() : getSpeakingCatalog()));
    const found = list.find((t) => t.id === id);
    if (found) return found;
    return getAllCatalogTasks().find((t) => t.id === id) || null;
  }

  function getSuitesForSkill(skillKey) {
    const restricted = Boolean(window.AccessPolicy?.isRestricted?.());
    const weeklyOnly = state.composerTemplate === 'weekly' || restricted;
    if (skillKey === 'reading') {
      return weeklyOnly
        ? READING_SUITES.filter((s) => s.key.startsWith('rp_'))
        : READING_SUITES;
    }
    if (skillKey === 'listening') {
      const pracSuites = [
        { key: 'lp_cambridge', label: 'Đề Cambridge' },
        { key: 'lp_volume',    label: 'Đề Volume' },
        { key: 'lp_actual',    label: 'Đề Actual' },
      ];
      if (weeklyOnly) return pracSuites;
      const suites = window.APP_LISTENING_TASKS?.suites || [];
      return [
        ...suites.map((s) => ({ key: s.key, label: s.label })),
        ...pracSuites,
      ];
    }
    if (skillKey === 'writing') {
      const wpCount = (window.WRITING_TASK1_DATA?.TASK1_PROMPTS || []).length
        + (window.WRITING_TASK1_DATA?.FULL_TESTS || []).length
        + (window.WRITING_STUDIO_DATA?.PRACTICE_PROMPTS || []).length;
      if (weeklyOnly) {
        return [{ key: 'wp_practice', label: `Đề Writing T1·T2·Full (${wpCount})` }];
      }
      const subs = window.WRITING_STUDIO_DATA?.SUBTOPICS || [];
      const mods = window.WRITING_STUDIO_DATA?.MODULES || [];
      return [
        { key: 'all', label: `Tất cả (${mods.length})` },
        { key: 'wp_practice', label: `Đề Writing T1·T2·Full (${wpCount})` },
        ...subs.map((st) => {
          const c = mods.filter((m) => m.subtopic === st.key).length;
          return { key: st.key, label: `${st.shortTitle || st.title} (${c})` };
        }),
      ];
    }
    if (skillKey === 'speaking') {
      const spTotal = getSpeakingPracticeCatalog().length;
      if (weeklyOnly) {
        return [{ key: 'sp_practice', label: `Đề Speaking P1·P2·P3·Full (${spTotal})` }];
      }
      return [
        { key: 'all', label: `Story Task (${getSpeakingCatalog().length})` },
        ...(spTotal ? [{ key: 'sp_practice', label: `Đề Speaking P1·P2·P3·Full (${spTotal})` }] : []),
      ];
    }
    return [];
  }

  function ensurePracticeBankLoadedForSuite(suiteKey) {
    const rpMatch = String(suiteKey || '').match(/^rp_(cambridge|volume|actual)$/);
    const lpMatch = String(suiteKey || '').match(/^lp_(cambridge|volume|actual)$/);
    if (rpMatch && window.ReadingPracticeApp?.ensureSourceBankLoaded) {
      const existing = getReadingPracticeCatalog(rpMatch[1]);
      if (!existing.length && !state.pickerLoadingBank) {
        state.pickerLoadingBank = true;
        window.ReadingPracticeApp.ensureSourceBankLoaded(rpMatch[1]).finally(() => {
          state.pickerLoadingBank = false;
          renderPickerSection(Date.now());
        });
        return true;
      }
    }
    if (lpMatch && window.ListeningPracticeApp?.ensureSourceBankLoaded) {
      const existing = getListeningPracticeCatalog(lpMatch[1]);
      if (!existing.length && !state.pickerLoadingBank) {
        state.pickerLoadingBank = true;
        window.ListeningPracticeApp.ensureSourceBankLoaded(lpMatch[1]).finally(() => {
          state.pickerLoadingBank = false;
          renderPickerSection(Date.now());
        });
        return true;
      }
    }
    return false;
  }

  /* =========================================================
     2. UNIFIED 4-SKILL PROGRESS & GRANULAR LOCK STATE READER
     ========================================================= */
  function scopedClassKey(baseKey) {
    const cid = String(B()?.getActiveClassId?.() || '').trim();
    if (!cid || cid === 'lop_thay_man') return baseKey;
    return `${baseKey}__${cid}`;
  }
  function loadLiveDeadlines() { return readJson(scopedClassKey(LIVE_DL_KEY), {}); }
  function loadSentMap() { return readJson(scopedClassKey(SENT_KEY), {}); }
  function loadDismissedMap() { return readJson(scopedClassKey(DISMISSED_KEY), {}); }

  function saveSentTasks(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const m = loadSentMap();
    const now = Date.now();
    ids.forEach((id) => { m[normalizeAnyTaskId(id)] = now; });
    writeJson(scopedClassKey(SENT_KEY), m);
  }

  function updateLiveDeadlines(ids, newDeadlineAt, toastMsg = '') {
    const cleanIds = (Array.isArray(ids) ? ids : [ids]).map(normalizeAnyTaskId).filter(Boolean);
    if (!cleanIds.length) return;
    const nowTs = Date.now();
    const dl = Number(newDeadlineAt || 0);
    const map = loadLiveDeadlines();
    cleanIds.forEach((tid) => {
      map[tid] = { deadlineAt: dl, issuedAt: nowTs };
    });
    writeJson(scopedClassKey(LIVE_DL_KEY), map);
    B()?.broadcastTeacherTaskDeadlines?.(map);
    if (toastMsg) B()?.showToast?.(toastMsg);
    renderDashboard();
  }

  function getStudentUnlockInfo(uid, cache) {
    const bridge = B();
    const sd = cache?.[uid]?.syncData || {};
    const remoteAll = Number(sd.teacherUnlockedAt || 0);
    let localAll = 0;
    try { localAll = Number(localStorage.getItem(`${bridge?.TEACHER_UNLOCK_KEY_BASE || 'ielts_teacher_unlocked_at_'}${uid}`) || 0); } catch (_) {}
    const hasRemote = Boolean(bridge?.getSyncUrl?.() && cache?.[uid]?.syncData);
    const unlockAllAt = hasRemote ? remoteAll : Math.max(remoteAll, localAll);

    const remotePer = (sd.teacherTaskUnlocks && typeof sd.teacherTaskUnlocks === 'object') ? sd.teacherTaskUnlocks : {};
    const localPer = readJson(`ielts_teacher_task_unlocks_v1_${uid}`, {});
    const perTask = { ...remotePer };
    Object.entries(localPer).forEach(([k, v]) => {
      const nv = Number(v || 0);
      if (nv > Number(perTask[k] || 0)) perTask[k] = nv;
    });
    return { unlockAllAt, perTask, hasRemote };
  }

  function isLockCleared(lockKey, untilMs, unlockInfo) {
    const u = Number(untilMs || 0);
    if (u <= 0) return true;
    const origin = u - LOCK_PENALTY_MS;
    if (unlockInfo.unlockAllAt > 0 && origin <= unlockInfo.unlockAllAt) return true;
    const perAt = Number(unlockInfo.perTask?.[lockKey] || 0);
    if (perAt > 0 && origin <= perAt) return true;
    return false;
  }

  function readStudentAllLocks(studentId, nowMs = Date.now()) {
    const bridge = B();
    if (!bridge) return [];
    const uid = bridge.getScopedUid(studentId);
    const cache = bridge.getCloudClassCache?.() || {};
    const sd = cache?.[uid]?.syncData || {};
    const unlockInfo = getStudentUnlockInfo(uid, cache);

    const merged = {};
    const addLock = (lockKey, untilMs, meta = {}) => {
      const u = Number(untilMs || 0);
      if (u <= nowMs) return;
      if (isLockCleared(lockKey, u, unlockInfo)) return;
      if (!merged[lockKey] || u > merged[lockKey].until) {
        merged[lockKey] = { lockKey, until: u, remainingMs: u - nowMs, ...meta };
      }
    };

    // 1. Unified cloud taskLocks (holds Reading + synced Listening/Writing/Speaking locks)
    const remoteLocks = (sd.taskLocks && typeof sd.taskLocks === 'object') ? sd.taskLocks : {};
    Object.entries(remoteLocks).forEach(([k, until]) => addLock(k, until));

    // 2. Local fallbacks when offline or testing on same browser
    if (!unlockInfo.hasRemote) {
      const localR = readJson(`${bridge.TASK_LOCKS_KEY_BASE}${uid}`, {});
      Object.entries(localR).forEach(([k, until]) => addLock(k, until));
      const localL = readJson(`${LISTENING_LOCK_BASE}${uid}`, {});
      Object.entries(localL).forEach(([k, until]) => addLock(k, until));
      const localS = readJson(`${SPEAKING_LOCK_BASE}${uid}`, {});
      Object.entries(localS).forEach(([k, until]) => addLock(k, until));
      const rpPracLock = readJson(`ielts_rp_anticheat_lock_v1_${uid}`, null);
      if (rpPracLock && Number(rpPracLock.until || 0) > nowMs) {
        addLock('rp_prac_lock', rpPracLock.until, { reason: rpPracLock.reason || '' });
      }
      const wTaskLock = readJson(`${WRITING_LOCK_BASE}${uid}`, null);
      if (wTaskLock && Number(wTaskLock.until || 0) > nowMs) {
        const wKey = wTaskLock.modId ? String(wTaskLock.modId) : 'w_task_lock';
        addLock(wKey, wTaskLock.until, { reason: wTaskLock.reason || '' });
      }
      const wPracLock = readJson(`${WRITING_PRAC_LOCK_BASE}${uid}`, null);
      if (wPracLock && Number(wPracLock.until || 0) > nowMs) {
        addLock('w_prac_lock', wPracLock.until, { reason: wPracLock.reason || '' });
      }
    }

    return Object.values(merged).map((entry) => {
      const tid = entry.lockKey;
      let skill = detectSkillByTaskId(tid);
      let label = tid;
      if (tid === 'rp_prac_lock') {
        skill = 'reading';
        label = 'Reading Practice';
      } else if (tid === 'w_task_lock') {
        skill = 'writing';
        label = 'Writing Task';
      } else if (tid === 'w_prac_lock') {
        skill = 'writing';
        label = 'Writing Practice';
      } else {
        const taskObj = getTaskById(tid);
        if (taskObj) {
          skill = taskObj.skill;
          label = taskObj.shortCode || taskObj.code;
        }
      }
      return {
        ...entry,
        skill,
        skillShort: skillMeta(skill).short,
        label,
      };
    }).sort((a, b) => a.until - b.until);
  }

  function readSkillProgressMap(studentId, skillKey) {
    const bridge = B();
    if (!bridge) return {};
    const uid = bridge.getScopedUid(studentId);
    const cache = bridge.getCloudClassCache?.() || {};
    const sd = cache?.[uid]?.syncData || {};

    let remote = {};
    let local = {};
    if (skillKey === 'reading') {
      remote = (sd.taskProgress && typeof sd.taskProgress === 'object') ? sd.taskProgress : {};
      local = readJson(`${bridge.TASK_PROGRESS_KEY_BASE}${uid}`, {});
    } else if (skillKey === 'listening') {
      remote = (sd.listeningTaskProgress && typeof sd.listeningTaskProgress === 'object') ? sd.listeningTaskProgress : {};
      local = readJson(`${LISTENING_PROG_BASE}${uid}`, {});
    } else if (skillKey === 'writing') {
      remote = (sd.writingTaskProgress && typeof sd.writingTaskProgress === 'object') ? sd.writingTaskProgress : {};
      local = readJson(`${WRITING_PROG_BASE}${uid}`, {});
    } else if (skillKey === 'speaking') {
      remote = (sd.speakingTaskProgress && typeof sd.speakingTaskProgress === 'object') ? sd.speakingTaskProgress : {};
      const curLocal = readJson(`${SPEAKING_PROG_BASE}${uid}`, {});
      const legacyLocal = readJson(`${SPEAKING_PROG_LEGACY_BASE}${uid}`, {});
      local = { ...legacyLocal, ...curLocal };
    }

    const merged = { ...remote };
    Object.entries(local).forEach(([tid, rec]) => {
      const prev = merged[tid];
      if (!rec) return;
      const recDone = rec.status === 'completed' || rec.completed === true || rec.passed === true;
      const prevDone = prev && (prev.status === 'completed' || prev.completed === true || prev.passed === true);
      const recTs = Number(rec.updatedAt || rec.completedAt || 0);
      const prevTs = Number(prev?.updatedAt || prev?.completedAt || 0);
      if (!prev || recTs >= prevTs || (recDone && !prevDone)) {
        merged[tid] = rec;
      }
    });
    return merged;
  }

  function isRecordCompleted(skillKey, rec) {
    if (!rec) return false;
    if (skillKey === 'reading') return rec.status === 'completed';
    if (skillKey === 'listening') return Boolean(rec.completed || rec.status === 'completed');
    if (skillKey === 'writing') return Boolean(rec.passed || rec.completed || rec.status === 'completed');
    return Boolean(rec.completed || rec.passed || rec.status === 'completed');
  }

  function getRecordScoreLabel(taskObj, rec) {
    if (!rec) return '';
    if (taskObj.skill === 'reading') {
      if (rec.translationScore != null) return `${Number(rec.translationScore).toFixed(1)}/10`;
      if (rec.recognitionScore != null) return `${Math.round(Number(rec.recognitionScore))}%`;
      return 'Đạt';
    }
    if (taskObj.skill === 'listening') {
      const scores = [rec.t1Pct, rec.t2Pct, rec.t3Pct].filter((x) => x != null).map(Number);
      if (scores.length) {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        return `${avg}%`;
      }
      if (rec.score != null) return `${rec.score}%`;
      return 'Đạt';
    }
    if (taskObj.skill === 'writing') {
      if (rec.band != null) return `Band ${Number(rec.band).toFixed(1)}`;
      if (rec.t3Band != null) return `Band ${Number(rec.t3Band).toFixed(1)}`;
      if (rec.score != null) return `${Number(rec.score).toFixed(1)}/10`;
      return 'Đạt';
    }
    return rec.score != null ? String(rec.score) : 'Đạt';
  }

  function readStudentPracticeAttempt(studentId, pm) {
    const bridge = B();
    const uid = bridge ? bridge.getScopedUid(studentId) : String(studentId || 'guest').toLowerCase();
    const cache = bridge?.getCloudClassCache?.() || {};
    const sd = cache?.[uid]?.syncData || {};

    if (pm.skill === 'reading') {
      const localObj = readJson(`ielts_reading_practice_v1_${uid}`, { history: [] });
      const remoteHist = Array.isArray(sd.readingPracticeHistory) ? sd.readingPracticeHistory : [];
      const all = [...(Array.isArray(localObj?.history) ? localObj.history : []), ...remoteHist];
      const hits = all.filter((h) => h && h.itemId === pm.itemId);
      if (!hits.length) return null;
      hits.sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)) || (Number(b.submittedAt || 0) - Number(a.submittedAt || 0)));
      const best = hits[0];
      return {
        completed: true,
        scoreLabel: best.total ? `${best.score}/${best.total}${best.band ? ` · B${Number(best.band).toFixed(1)}` : ''}` : 'Đã nộp',
        updatedAt: Number(best.submittedAt || best.completedAt || 0),
        raw: best,
      };
    }
    if (pm.skill === 'listening') {
      const localObj = readJson(`ielts_listening_practice_v1_${uid}`, { history: [] });
      const remoteHist = Array.isArray(sd.listeningPracticeHistory) ? sd.listeningPracticeHistory : [];
      const all = [...(Array.isArray(localObj?.history) ? localObj.history : []), ...remoteHist];
      const hits = all.filter((h) => h && h.itemId === pm.itemId);
      if (!hits.length) return null;
      hits.sort((a, b) => (Number(b.score || 0) - Number(a.score || 0)) || (Number(b.submittedAt || 0) - Number(a.submittedAt || 0)));
      const best = hits[0];
      return {
        completed: true,
        scoreLabel: best.total ? `${best.score}/${best.total}${best.band ? ` · B${Number(best.band).toFixed(1)}` : ''}` : 'Đã nộp',
        updatedAt: Number(best.submittedAt || best.completedAt || 0),
        raw: best,
      };
    }
    if (pm.skill === 'writing') {
      const localArr = readJson(`totoro_writing_prac_hist_v1_${uid}`, []);
      const remoteArr = Array.isArray(sd.writingPracticeHistory) ? sd.writingPracticeHistory : [];
      const all = [...(Array.isArray(localArr) ? localArr : []), ...remoteArr];
      const hits = all.filter((h) => h && h.promptId === pm.itemId);
      if (!hits.length) return null;
      hits.sort((a, b) => Number(b.completedAt || 0) - Number(a.completedAt || 0));
      const latest = hits[0];
      return {
        completed: true,
        scoreLabel: latest.wordCount ? `${latest.wordCount} từ${latest.band ? ` · B${Number(latest.band).toFixed(1)}` : ''}` : 'Đã nộp',
        updatedAt: Number(latest.completedAt || 0),
        raw: latest,
      };
    }
    if (pm.skill === 'speaking') {
      const localArr = readJson(`totoro_speaking_prac_hist_v1_${uid}`, []);
      const remoteArr = Array.isArray(sd.speakingPracticeHistory) ? sd.speakingPracticeHistory : [];
      const all = [...(Array.isArray(localArr) ? localArr : []), ...remoteArr];
      const hits = all.filter((h) => h && h.cueId === pm.itemId);
      if (!hits.length) return null;
      hits.sort((a, b) => Number(b.at || b.completedAt || 0) - Number(a.at || a.completedAt || 0));
      const latest = hits[0];
      return {
        completed: true,
        scoreLabel: latest.durationSec ? `${latest.durationSec}s${latest.wpm ? ` · ${latest.wpm} wpm` : ''}` : 'Đã nói',
        updatedAt: Number(latest.at || latest.completedAt || 0),
        raw: latest,
      };
    }
    return null;
  }

  function getStudentHomeworkRow(taskObj, student, nowMs = Date.now()) {
    const bridge = B();
    const uid = bridge.getScopedUid(student.id);
    if (taskObj?.isPractice && taskObj.practiceMeta) {
      const pm = taskObj.practiceMeta;
      const attempt = readStudentPracticeAttempt(student.id, pm);
      const locks = readStudentAllLocks(student.id, nowMs);
      const matchedLock = locks.find((lk) => lk.lockKey === taskObj.id || (pm.skill === 'writing' && lk.lockKey === 'w_prac_lock'));
      const completed = Boolean(attempt?.completed);
      const bucket = completed ? 'done' : (matchedLock ? 'locked' : 'missing');
      const progressLabel = completed ? 'Đã nộp' : (matchedLock ? `Khóa ${formatMmSs(matchedLock.remainingMs)}` : 'Chưa làm');
      return {
        student,
        uid,
        rec: attempt?.raw || null,
        bucket,
        completed,
        lock: matchedLock || null,
        doneUnits: completed ? 1 : 0,
        totalUnits: 1,
        progressLabel,
        scoreLabel: completed ? (attempt?.scoreLabel || 'Đã nộp') : '',
        updatedAt: Number(attempt?.updatedAt || 0),
      };
    }
    const progMap = readSkillProgressMap(student.id, taskObj.skill);
    const rec = progMap[taskObj.id] || null;
    const locks = readStudentAllLocks(student.id, nowMs);
    const matchedLock = locks.find((lk) => lk.lockKey === taskObj.id || (taskObj.skill === 'writing' && lk.lockKey === 'w_task_lock'));

    let doneUnits = 0;
    let totalUnits = taskObj.wordTotal || 10;
    let progressLabel = 'Chưa bắt đầu';

    const completed = isRecordCompleted(taskObj.skill, rec);

    if (taskObj.skill === 'reading') {
      const assessMap = bridge.getStudentAssessmentsMap?.(student.id) || {};
      const wList = Array.isArray(taskObj.raw?.words) ? taskObj.raw.words : [];
      totalUnits = wList.length || 50;
      doneUnits = completed
        ? totalUnits
        : (wList.length ? wList.filter((w) => assessMap[w.id] === 3).length : 0);
      if (completed) progressLabel = 'Đã nộp';
      else if (matchedLock) progressLabel = `Khóa ${formatMmSs(matchedLock.remainingMs)}`;
      else if (rec?.status === 'in_progress') progressLabel = `Đang làm Test ${Math.min(3, Number(rec.stage || 1) + 1)}`;
      else if (doneUnits >= totalUnits) progressLabel = 'Đủ từ · Chờ thi';
      else if (doneUnits > 0) progressLabel = `Học ${doneUnits}/${totalUnits} từ`;
    } else if (taskObj.skill === 'listening') {
      const stagesDone = [rec?.t1Done, rec?.t2Done, rec?.t3Done].filter(Boolean).length;
      totalUnits = 3;
      doneUnits = completed ? 3 : stagesDone;
      if (completed) progressLabel = 'Đã nộp';
      else if (matchedLock) progressLabel = `Khóa ${formatMmSs(matchedLock.remainingMs)}`;
      else if (stagesDone > 0) progressLabel = `Xong ${stagesDone}/3 vòng`;
    } else if (taskObj.skill === 'writing') {
      const stepsDone = [rec?.t1Passed, rec?.t2Passed, rec?.t3Passed].filter(Boolean).length;
      totalUnits = 3;
      doneUnits = completed ? 3 : stepsDone;
      if (completed) progressLabel = 'Đã nộp';
      else if (matchedLock) progressLabel = `Khóa ${formatMmSs(matchedLock.remainingMs)}`;
      else if (stepsDone > 0) progressLabel = `Xong Bước ${stepsDone}/3`;
      else if (rec?.updatedAt) progressLabel = 'Đang học Flow';
    } else {
      totalUnits = 1;
      doneUnits = completed ? 1 : 0;
      if (completed) progressLabel = 'Đã nộp';
      else if (matchedLock) progressLabel = `Khóa ${formatMmSs(matchedLock.remainingMs)}`;
    }

    let bucket = 'missing';
    if (completed) bucket = 'done';
    else if (matchedLock) bucket = 'locked';
    else if (doneUnits > 0 || rec?.status === 'in_progress' || rec?.updatedAt) bucket = 'progress';

    return {
      student,
      uid,
      rec,
      bucket,
      completed,
      lock: matchedLock || null,
      doneUnits,
      totalUnits,
      progressLabel,
      scoreLabel: completed ? getRecordScoreLabel(taskObj, rec) : '',
      updatedAt: Number(rec?.updatedAt || rec?.completedAt || 0),
    };
  }

  function isTaskAllDone(taskObj, nowMs = Date.now()) {
    const students = B()?.getStudentAccounts?.() || [];
    if (!students.length) return false;
    return students.every((st) => getStudentHomeworkRow(taskObj, st, nowMs).completed);
  }

  /* =========================================================
     3. ACTIVE & EXPIRED HOMEWORK BUCKETS (ALL 4 SKILLS)
     ========================================================= */
  function getMonitorBuckets(nowMs = Date.now()) {
    const liveMap = loadLiveDeadlines();
    const sentMap = loadSentMap();
    const dismissedMap = loadDismissedMap();
    const activeList = [];
    const expiredList = [];
    const seen = new Set();

    const inspect = (rawId) => {
      const tid = normalizeAnyTaskId(rawId);
      if (!tid || seen.has(tid)) return;
      const taskObj = getTaskById(tid);
      if (!taskObj) return;
      seen.add(tid);

      const dlRec = liveMap[tid] || null;
      const sentTs = Number(sentMap[tid] || 0);
      const issuedAt = Math.max(Number(dlRec?.issuedAt || 0), sentTs);
      const deadlineAt = Number(dlRec?.deadlineAt || 0);
      const dismissedAt = Number(dismissedMap[tid] || 0);
      const lastEventTs = Math.max(issuedAt, deadlineAt > 0 && deadlineAt <= nowMs ? deadlineAt : 0);
      if (dismissedAt > 0 && dismissedAt >= lastEventTs) return;

      if (deadlineAt > nowMs) {
        activeList.push({ task: taskObj, deadlineAt, issuedAt, mode: 'active' });
      } else if (deadlineAt > 0 && deadlineAt <= nowMs) {
        expiredList.push({ task: taskObj, deadlineAt, issuedAt, mode: 'expired' });
      } else if (issuedAt > 0) {
        if (!isTaskAllDone(taskObj, nowMs)) {
          activeList.push({ task: taskObj, deadlineAt: 0, issuedAt, mode: 'active' });
        }
      }
    };

    Object.keys(liveMap).forEach(inspect);
    Object.keys(sentMap).forEach(inspect);

    const skillRank = { reading: 1, listening: 2, writing: 3, speaking: 4 };
    activeList.sort((a, b) => (
      (a.deadlineAt > 0 && b.deadlineAt > 0 ? a.deadlineAt - b.deadlineAt : b.issuedAt - a.issuedAt)
      || (skillRank[a.task.skill] - skillRank[b.task.skill])
    ));
    expiredList.sort((a, b) => b.deadlineAt - a.deadlineAt);
    return { activeList, expiredList };
  }

  /* =========================================================
     4. UNLOCK ACTIONS (PER-TASK OR UNLOCK ALL)
     ========================================================= */
  function unlockStudentTask(studentId, lockKey = null) {
    const bridge = B();
    if (!bridge?.isTeacherUser?.() || !studentId) return;
    const nowTs = Date.now();
    const acct = (bridge.getStudentAccounts?.() || []).find((a) => bridge.getScopedUid(a.id) === bridge.getScopedUid(studentId));
    const displayName = acct?.name || studentId;

    state.unlockingIds.add(String(studentId));
    const p = bridge.unlockStudentCloudLocks?.(studentId, nowTs, lockKey || null);
    renderDashboard();
    if (document.getElementById('modal-teacher-task-detail')?.classList.contains('open') && state.detailTaskId) {
      renderDetailModalBody();
    }
    const friendlyKey = lockKey === 'rp_prac_lock'
      ? 'Reading Practice'
      : (lockKey === 'w_prac_lock' ? 'Writing Practice' : (lockKey === 'w_task_lock' ? 'Writing Task' : (getTaskById(lockKey)?.shortCode || lockKey)));
    const labelMsg = lockKey
      ? `✓ Đã mở khóa ${friendlyKey} cho ${shortName(displayName)} — bảo bạn tải lại trang (F5)!`
      : `✓ Đã gửi lệnh mở khóa toàn bộ 4 kỹ năng cho ${shortName(displayName)} — bảo bạn tải lại trang (F5)!`;
    if (p && typeof p.then === 'function') {
      p.then((ok) => {
        state.unlockingIds.delete(String(studentId));
        if (ok) bridge.showToast?.(labelMsg);
        renderDashboard();
        if (document.getElementById('modal-teacher-task-detail')?.classList.contains('open') && state.detailTaskId) {
          renderDetailModalBody();
        }
      });
    } else {
      state.unlockingIds.delete(String(studentId));
      bridge.showToast?.(labelMsg);
      renderDashboard();
    }
  }

  /* =========================================================
     5. RENDER: LOCK ALERT BANNER + ROSTER TABLE (4-SKILL MATRIX)
     ========================================================= */
  function renderLockAlertBanner(studentsWithLocks, nowMs) {
    const el = document.getElementById('ts-lock-alert-banner');
    if (!el) return;
    if (!studentsWithLocks.length) {
      el.style.display = 'none';
      el.innerHTML = '';
      return;
    }

    const totalLocks = studentsWithLocks.reduce((sum, x) => sum + x.locks.length, 0);
    const chipsHtml = studentsWithLocks.map(({ student, locks }) => {
      if (locks.length === 1) {
        const lk = locks[0];
        return `
          <div class="ts-lock-banner-chip">
            <strong>${esc(shortName(student.name))}</strong>
            <span class="ts-skill-pill is-${esc(lk.skill)}">${esc(lk.skillShort)} · ${esc(lk.label)}</span>
            <span class="ts-lock-time" data-ts-lock-until="${lk.until}">${formatMmSs(lk.until - nowMs)}</span>
            <button type="button" class="ts-btn-unlock-one" onclick="TeacherStudio.unlockStudentTask('${esc(student.id)}', '${esc(lk.lockKey)}')">Mở</button>
          </div>
        `;
      }
      const skTags = locks.map((lk) => `<span class="ts-skill-pill is-${esc(lk.skill)}" title="${esc(lk.label)} (${formatMmSs(lk.until - nowMs)})">${esc(lk.skillShort)}</span>`).join('');
      return `
        <div class="ts-lock-banner-chip">
          <strong>${esc(shortName(student.name))}</strong>
          <span>Khóa ${locks.length} bài:</span>
          ${skTags}
          <button type="button" class="ts-btn-unlock-all" onclick="TeacherStudio.unlockStudentTask('${esc(student.id)}')">Mở tất cả (${locks.length})</button>
        </div>
      `;
    }).join('');

    el.style.display = 'flex';
    el.innerHTML = `
      <div class="ts-lock-banner-top">
        <div class="ts-lock-banner-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>
          <span>Cảnh báo khóa bài · ${studentsWithLocks.length} học viên (${totalLocks} khóa đang hiệu lực)</span>
        </div>
        <button type="button" class="ts-qfilter-btn is-lock-filter ${state.rosterFilter === 'locked' ? 'active' : ''}" onclick="TeacherStudio.setRosterFilter('${state.rosterFilter === 'locked' ? 'all' : 'locked'}')">
          ${state.rosterFilter === 'locked' ? 'Đang lọc học viên bị khóa ×' : 'Lọc danh sách bị khóa'}
        </button>
      </div>
      <div class="ts-lock-banner-items">${chipsHtml}</div>
    `;
  }

  function renderStatusUnlockCell(student, locks, nowMs) {
    if (!locks.length) {
      return `<button type="button" class="ts-status-ok ts-status-ok-btn" onclick="TeacherStudio.forceUnlockStudent('${esc(student.id)}', '${esc(student.name)}')" title="Bấm nếu học viên báo đang bị khóa nhưng chưa đồng bộ — gửi lệnh mở khóa cưỡng bức ngay">Bình thường</button>`;
    }
    if (locks.length === 1) {
      const lk = locks[0];
      return `
        <div class="ts-locks-wrap">
          <div class="ts-lock-item">
            <span class="ts-lock-item-meta">
              <span class="ts-slot-sk is-${esc(lk.skill)}">${esc(lk.skillShort)}</span>
              <span class="ts-lock-item-code" title="${esc(lk.label)}">${esc(lk.label)}</span>
              <span class="ts-lock-time" data-ts-lock-until="${lk.until}">${formatMmSs(lk.until - nowMs)}</span>
            </span>
            <button type="button" class="ts-btn-unlock-one" onclick="TeacherStudio.unlockStudentTask('${esc(student.id)}', '${esc(lk.lockKey)}')" title="Chỉ mở khóa bài này">Mở</button>
          </div>
        </div>
      `;
    }
    return `
      <div class="ts-locks-wrap">
        <div class="ts-locks-head">
          <span class="ts-locks-count">Khóa ${locks.length} bài</span>
          <button type="button" class="ts-btn-unlock-all" onclick="TeacherStudio.unlockStudentTask('${esc(student.id)}')" title="Mở khóa toàn bộ ${locks.length} bài cho học viên này">Mở tất cả (${locks.length})</button>
        </div>
        <div class="ts-locks-list">
          ${locks.map((lk) => `
            <div class="ts-lock-item">
              <span class="ts-lock-item-meta">
                <span class="ts-slot-sk is-${esc(lk.skill)}">${esc(lk.skillShort)}</span>
                <span class="ts-lock-item-code" title="${esc(lk.label)}">${esc(lk.label)}</span>
                <span class="ts-lock-time" data-ts-lock-until="${lk.until}">${formatMmSs(lk.until - nowMs)}</span>
              </span>
              <button type="button" class="ts-btn-unlock-one" onclick="TeacherStudio.unlockStudentTask('${esc(student.id)}', '${esc(lk.lockKey)}')" title="Chỉ mở khóa riêng bài này">Mở</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  function renderStudentDailyMatrixCell(student, activeTasks, nowMs) {
    if (!activeTasks.length) {
      return '<span style="color:var(--ink-3); font-size:12px;">Chưa giao bài</span>';
    }
    const slotsHtml = activeTasks.slice(0, 6).map(({ task }) => {
      const row = getStudentHomeworkRow(task, student, nowMs);
      const sm = skillMeta(task.skill);
      let icon = '—';
      let stateCls = 'is-missing';
      if (row.bucket === 'done') {
        icon = '✓';
        stateCls = 'is-done';
      } else if (row.bucket === 'locked') {
        icon = '🔒';
        stateCls = 'is-locked';
      } else if (row.bucket === 'progress') {
        icon = '•';
        stateCls = 'is-progress';
      }
      const tip = `${sm.label} · ${task.code} (${task.theme}) — ${row.progressLabel}${row.scoreLabel ? ` · ${row.scoreLabel}` : ''}`;
      return `
        <button type="button" class="ts-slot ${stateCls}" title="${esc(tip)}" onclick="TeacherStudio.openTaskDetailModal('${esc(task.id)}')">
          <span class="ts-slot-sk is-${esc(task.skill)}">${esc(sm.short)}</span>
          <span>${icon}</span>
        </button>
      `;
    }).join('');
    const extra = activeTasks.length > 6 ? `<span class="ts-done-mini">+${activeTasks.length - 6}</span>` : '';
    return `<div class="ts-matrix-row">${slotsHtml}${extra}</div>`;
  }

  function renderStudentDone4SkillCell(doneBySkill) {
    const items = SKILLS
      .map((s) => ({ ...s, count: doneBySkill[s.key] || 0 }))
      .filter((s) => s.count > 0);
    if (!items.length) {
      return '<span style="color:var(--ink-3); font-size:12px;">0 bài</span>';
    }
    return `<div class="ts-done-pills">${items.map((it) => `<span class="ts-done-mini is-${it.key}" title="${it.label}: ${it.count} bài đã xong">${it.short} ${it.count}</span>`).join('')}</div>`;
  }

  function renderRosterSection(nowMs, activeList) {
    const bridge = B();
    if (!bridge?.isTeacherUser?.()) return;

    const statusEl = document.getElementById('teacher-sync-status');
    const syncTime = bridge.getLastCloudSyncTime?.();
    if (statusEl) {
      statusEl.textContent = syncTime ? `Đồng bộ lúc ${syncTime}` : 'Theo dõi học tập & bài tập 4 kỹ năng';
    }

    const viewMode = state.tableView;
    document.querySelectorAll('#teacher-view-tabs .teacher-view-tab').forEach((btn) => {
      const act = btn.getAttribute('data-view') === viewMode;
      btn.classList.toggle('active', act);
      btn.setAttribute('aria-selected', act ? 'true' : 'false');
    });

    const allowedIdSet = new Set((bridge.getStudentAccounts?.() || []).map((s) => String(s.id || '').trim().toLowerCase()));
    const ranked = (bridge.getClassRankedEntries?.(viewMode === 'month' ? 'month' : 'week') || [])
      .filter((item) => !allowedIdSet.size || allowedIdSet.has(String(item.id || '').trim().toLowerCase()));
    const nowDate = new Date(nowMs);
    const todayKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
    const curYear = nowDate.getFullYear();
    const curMonth = nowDate.getMonth();

    const inPeriod = (ts) => {
      if (viewMode === 'full') return true;
      if (!ts) return false;
      const d = new Date(Number(ts));
      if (viewMode === 'today') {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` === todayKey;
      }
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    };

    const enrichedAll = ranked.map((item) => {
      const streak = item.streak ?? (bridge.computeConsecutiveStreakForUser?.(item.id) || 0);
      const locks = readStudentAllLocks(item.id, nowMs);
      const doneBySkill = { reading: 0, listening: 0, writing: 0, speaking: 0 };
      SKILLS.forEach((sk) => {
        const pm = readSkillProgressMap(item.id, sk.key);
        Object.values(pm).forEach((rec) => {
          if (isRecordCompleted(sk.key, rec) && inPeriod(rec.updatedAt || rec.completedAt)) {
            doneBySkill[sk.key] += 1;
          }
        });
      });
      const totalDonePeriod = doneBySkill.reading + doneBySkill.listening + doneBySkill.writing + doneBySkill.speaking;
      const pendingItems = activeList
        .map(({ task, deadlineAt }) => {
          const row = getStudentHomeworkRow(task, item, nowMs);
          return row.completed ? null : { task, deadlineAt, row };
        })
        .filter(Boolean);
      const activePendingCount = pendingItems.length;
      const periodMins = viewMode === 'today' ? Number(item.todayMins || 0) : (viewMode === 'month' ? Number(item.monthMins || 0) : Number(item.weekMins || 0));
      const periodWords = viewMode === 'today' ? Number(item.todayWords || 0) : (viewMode === 'month' ? Number(item.monthWords || 0) : Number(item.mastered || 0));
      const periodActivity = (totalDonePeriod * 100) + (periodWords * 10) + periodMins;
      return { item, streak, locks, doneBySkill, totalDonePeriod, pendingItems, activePendingCount, periodMins, periodWords, periodActivity };
    });

    if (viewMode !== 'full') {
      enrichedAll.sort((a, b) => (
        (b.locks.length > 0 ? 1 : 0) - (a.locks.length > 0 ? 1 : 0)
        || (b.periodActivity - a.periodActivity)
        || (b.periodMins - a.periodMins)
        || (Number(a.item.order || 0) - Number(b.item.order || 0))
      ));
    }

    // Lock Alert Banner at very top
    const studentsWithLocks = enrichedAll
      .filter((r) => r.locks.length > 0)
      .map((r) => ({ student: r.item, locks: r.locks }));
    renderLockAlertBanner(studentsWithLocks, nowMs);

    // Quick filter chips counts
    const lockedStuCount = studentsWithLocks.length;
    const pendingStuCount = activeList.length
      ? enrichedAll.filter((r) => r.activePendingCount > 0).length
      : 0;
    const qfWrap = document.getElementById('ts-quick-filters');
    if (qfWrap) {
      qfWrap.innerHTML = `
        <button type="button" class="ts-qfilter-btn ${state.rosterFilter === 'all' ? 'active' : ''}" onclick="TeacherStudio.setRosterFilter('all')">Tất cả (${enrichedAll.length})</button>
        <button type="button" class="ts-qfilter-btn is-lock-filter ${lockedStuCount > 0 ? 'has-locks' : ''} ${state.rosterFilter === 'locked' ? 'active' : ''}" onclick="TeacherStudio.setRosterFilter('locked')">Đang bị khóa (${lockedStuCount})</button>
        ${activeList.length ? `<button type="button" class="ts-qfilter-btn ${state.rosterFilter === 'pending' ? 'active' : ''}" onclick="TeacherStudio.setRosterFilter('pending')">Chưa xong bài giao (${pendingStuCount})</button>` : ''}
      `;
    }

    // KPI Strip
    const kpiStrip = document.getElementById('teacher-kpi-strip');
    if (kpiStrip) {
      const totalStu = enrichedAll.length;
      const activeStu = enrichedAll.filter((r) => r.periodActivity > 0).length;
      const totalLocks = studentsWithLocks.reduce((s, x) => s + x.locks.length, 0);
      const totalPeriodMins = enrichedAll.reduce((s, r) => s + r.periodMins, 0);

      // Homework completion across active assigned tasks
      const totalSlots = activeList.length * totalStu;
      const doneSlots = totalSlots
        ? activeList.reduce((acc, { task }) => acc + enrichedAll.filter((r) => getStudentHomeworkRow(task, r.item, nowMs).completed).length, 0)
        : 0;
      const hwPct = totalSlots ? Math.round((doneSlots / totalSlots) * 100) : 0;
      const activeSkillPills = SKILLS.map((sk) => {
        const cnt = activeList.filter((x) => x.task.skill === sk.key).length;
        return cnt > 0 ? `<span class="ts-skill-pill is-${sk.key}">${sk.short} ${cnt}</span>` : '';
      }).filter(Boolean).join('');

      const periodLabel = viewMode === 'today' ? 'hôm nay' : (viewMode === 'month' ? 'tháng này' : 'tuần này');
      kpiStrip.innerHTML = `
        <div class="teacher-kpi-card is-mint">
          <div class="teacher-kpi-label">Học viên hoạt động ${periodLabel}</div>
          <div class="teacher-kpi-val tabular">${activeStu}/${totalStu}</div>
          <div class="ts-kpi-sub tabular">Tổng ${totalPeriodMins.toLocaleString('vi-VN')} phút học</div>
        </div>
        <div class="teacher-kpi-card is-interactive" onclick="TeacherStudio.setWorkspaceTab('monitor')" title="Bấm để xem chi tiết các bài đang giao">
          <div class="teacher-kpi-label">Bài đang giao (4 kỹ năng)</div>
          <div class="teacher-kpi-val tabular">${activeList.length} <span class="teacher-kpi-unit">bài</span></div>
          <div class="ts-kpi-sub">${activeSkillPills || 'Chưa giao bài nào'}</div>
        </div>
        <div class="teacher-kpi-card is-interactive" onclick="TeacherStudio.setWorkspaceTab('monitor')" title="Bấm để xem tiến độ theo từng bài">
          <div class="teacher-kpi-label">Tiến độ bài đang giao</div>
          <div class="teacher-kpi-val tabular">${totalSlots ? `${hwPct}%` : '—'}</div>
          <div class="ts-kpi-sub tabular">${totalSlots ? `${doneSlots}/${totalSlots} lượt nộp` : 'Mở tab Giao bài để tạo mới'}</div>
        </div>
        <div class="teacher-kpi-card is-interactive ${totalLocks > 0 ? 'is-danger' : ''}" onclick="TeacherStudio.setRosterFilter('${state.rosterFilter === 'locked' ? 'all' : 'locked'}')" title="Bấm để lọc nhanh học viên đang bị khóa">
          <div class="teacher-kpi-label">Trạng thái khóa bài</div>
          <div class="teacher-kpi-val tabular" style="${totalLocks > 0 ? 'color:var(--ts-danger)!important;' : ''}">${totalLocks > 0 ? `${lockedStuCount} HS` : '0 khóa'}</div>
          <div class="ts-kpi-sub">${totalLocks > 0 ? `${totalLocks} bài đang khóa · Bấm để lọc` : 'Cả lớp bình thường'}</div>
        </div>
      `;
    }

    // Search + Filter
    const searchEl = document.getElementById('teacher-student-search');
    if (searchEl) {
      const curTeacherId = String(bridge.getCurrentUser?.()?.id || '').trim().toLowerCase();
      const rawQ = String(searchEl.value || '').trim().toLowerCase();
      if (!searchEl.matches(':focus') && curTeacherId && rawQ === curTeacherId) searchEl.value = '';
    }
    const q = (searchEl?.value || '').trim().toLowerCase();

    const visible = enrichedAll.filter((r) => {
      if (q && !String(r.item.name || '').toLowerCase().includes(q) && !String(r.item.id || '').toLowerCase().includes(q)) return false;
      if (state.rosterFilter === 'locked' && !r.locks.length) return false;
      if (state.rosterFilter === 'pending' && r.activePendingCount <= 0) return false;
      return true;
    });

    // Toggle toolbar right slot: Hôm nay/Tháng này/Full only applies to 'all'; 'pending' gets 1-click Copy nhắc cả lớp
    const viewTabsEl = document.getElementById('teacher-view-tabs');
    let pendingBulkBtn = document.getElementById('ts-pending-bulk-btn');
    if (viewTabsEl && !pendingBulkBtn) {
      pendingBulkBtn = document.createElement('button');
      pendingBulkBtn.type = 'button';
      pendingBulkBtn.id = 'ts-pending-bulk-btn';
      pendingBulkBtn.className = 'btn btn-primary ts-pending-bulk-btn';
      pendingBulkBtn.onclick = () => copyAllPendingReminder();
      viewTabsEl.insertAdjacentElement('afterend', pendingBulkBtn);
    }
    const isPendingMode = state.rosterFilter === 'pending';
    const isLockedMode = state.rosterFilter === 'locked';
    if (viewTabsEl) viewTabsEl.style.display = (isPendingMode || isLockedMode) ? 'none' : '';
    if (pendingBulkBtn) {
      if (isPendingMode && visible.length > 0) {
        pendingBulkBtn.style.display = '';
        pendingBulkBtn.textContent = `Copy nhắc cả lớp (${visible.length})`;
      } else {
        pendingBulkBtn.style.display = 'none';
      }
    }

    const thead = document.getElementById('teacher-dashboard-thead');
    const tbody = document.getElementById('teacher-dashboard-tbody');
    if (!tbody) return;
    const tableEl = tbody.closest('table');
    if (tableEl) tableEl.classList.toggle('is-action-table', isPendingMode || isLockedMode);

    // MODE A: CHƯA XONG BÀI GIAO — Gọn 4 cột, đúng chức năng đốc thúc bài tập!
    if (isPendingMode) {
      const pendingSorted = visible.slice().sort((a, b) => (
        (b.activePendingCount - a.activePendingCount)
        || (b.locks.length - a.locks.length)
        || (a.periodActivity - b.periodActivity)
        || (Number(a.item.order || 0) - Number(b.item.order || 0))
      ));
      const totalAssigned = activeList.length;

      if (thead) {
        thead.innerHTML = `<tr>
          <th>Học viên</th>
          <th style="width:120px;">Tiến độ</th>
          <th>Bài chưa xong (${totalAssigned} bài đang giao)</th>
          <th style="width:136px; text-align:right;">Nhắc bài</th>
        </tr>`;
      }

      if (!pendingSorted.length) {
        const emptyMsg = totalAssigned > 0
          ? `Tuyệt vời! Tất cả học viên đã hoàn thành hết ${totalAssigned} bài đang giao.`
          : 'Hiện chưa có bài tập nào đang giao.';
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding:26px; color:${totalAssigned > 0 ? 'var(--ts-ok, #24683b)' : 'var(--ink-3)'}; font-weight:600;">${emptyMsg}</td></tr>`;
        return;
      }

      const compactChipLabel = (task) => String(task.code || task.shortCode || task.id)
        .replace(/^Cambridge IELTS\s+/i, 'Cam ')
        .replace(/\bTest\s+(\d+)/gi, 'T$1')
        .replace(/^Part\s+(\d+)\s*·\s*/i, 'P$1 · ')
        .replace(/^(Writing|Speaking|Listening|Reading)\s*·\s*/i, '');

      tbody.innerHTML = pendingSorted.map((r, idx) => {
        const doneCnt = Math.max(0, totalAssigned - r.activePendingCount);
        const pct = totalAssigned > 0 ? Math.round((doneCnt / totalAssigned) * 100) : 0;
        const isZeroDone = doneCnt === 0;
        const badgeCls = isZeroDone ? 'is-zero' : 'is-partial';
        const isCopied = state.remindedKeys.has(`allpending::${r.item.id}`);

        const chipsHtml = r.pendingItems.map(({ task, row }) => {
          const sm = skillMeta(task.skill);
          const isProg = row.bucket === 'progress';
          const isLock = row.bucket === 'locked';
          const stateCls = isLock ? 'is-locked' : (isProg ? 'is-progress' : 'is-missing');
          const statusSuffix = isLock ? ' 🔒' : (isProg ? ' •' : '');
          const shortLbl = compactChipLabel(task);
          const tip = `${sm.label} · ${task.code} (${task.theme}) — ${row.progressLabel}`;
          return `
            <button type="button" class="ts-pend-chip ${stateCls}" title="${esc(tip)}" onclick="TeacherStudio.openTaskDetailModal('${esc(task.id)}', 'pending')">
              <span class="ts-slot-sk is-${esc(task.skill)}">${esc(sm.short)}</span>
              <span class="ts-pend-chip-lbl">${esc(shortLbl)}${statusSuffix}</span>
            </button>
          `;
        }).join('');

        const unlockMini = r.locks.length
          ? `<button type="button" class="ts-btn-unlock-one" style="margin-right:6px;" onclick="TeacherStudio.unlockStudentTask('${esc(r.item.id)}')" title="Mở khóa ${r.locks.length} bài bị khóa">Mở khóa</button>`
          : '';

        return `
          <tr class="ts-pend-row">
            <td>
              <div class="teacher-student-cell">
                <span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(monogram(r.item.name))}</span>
                <strong>${esc(r.item.name)}</strong>
              </div>
            </td>
            <td>
              <div class="ts-pend-prog-cell">
                <span class="ts-pend-badge ${badgeCls} tabular">Thiếu ${r.activePendingCount}/${totalAssigned}</span>
                <div class="ts-pend-bar" aria-hidden="true"><span style="width:${pct}%"></span></div>
              </div>
            </td>
            <td><div class="ts-pend-chips">${chipsHtml}</div></td>
            <td style="text-align:right; white-space:nowrap;">
              ${unlockMini}<button type="button" class="btn-subtle thw-remind-btn ${isCopied ? 'is-copied' : ''}" onclick="TeacherStudio.copyStudentAllPendingReminder('${esc(r.item.id)}')">${isCopied ? '✓ Đã copy' : 'Nhắc Zalo'}</button>
            </td>
          </tr>
        `;
      }).join('');
      return;
    }

    // MODE B: ĐANG BỊ KHÓA — Gọn 3 cột tập trung xử lý mở khóa!
    if (isLockedMode) {
      if (thead) {
        thead.innerHTML = `<tr>
          <th>Học viên</th>
          <th>Bài đang bị khóa</th>
          <th style="width:180px; text-align:right;">Xử lý</th>
        </tr>`;
      }
      if (!visible.length) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:26px; color:var(--ts-ok, #24683b); font-weight:600;">Cả lớp bình thường — không có học viên nào đang bị khóa bài.</td></tr>`;
        return;
      }
      tbody.innerHTML = visible.map((r, idx) => `
        <tr style="background:color-mix(in srgb, var(--ts-danger-bg) 35%, transparent);">
          <td>
            <div class="teacher-student-cell">
              <span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(monogram(r.item.name))}</span>
              <strong>${esc(r.item.name)}</strong>
            </div>
          </td>
          <td>${renderStatusUnlockCell(r.item, r.locks, nowMs)}</td>
          <td style="text-align:right;">
            <button type="button" class="ts-btn-unlock-all" onclick="TeacherStudio.unlockStudentTask('${esc(r.item.id)}')">Mở tất cả (${r.locks.length})</button>
          </td>
        </tr>
      `).join('');
      return;
    }

    if (thead) {
      thead.innerHTML = viewMode === 'full'
        ? `<tr>
            <th>#</th>
            <th>Học viên</th>
            <th>Hôm nay</th>
            <th>Tuần</th>
            <th>Tháng</th>
            <th>Chuỗi</th>
            <th>Từ thuộc</th>
            <th>Bài đang giao (4KN)</th>
            <th>Đã xong (4KN)</th>
            <th>Trạng thái &amp; Mở khóa</th>
          </tr>`
        : `<tr>
            <th>#</th>
            <th>Học viên</th>
            <th>Phút học</th>
            <th>Từ mới</th>
            <th>Bài đang giao (4 kỹ năng)</th>
            <th>Đã xong ${viewMode === 'today' ? 'hôm nay' : 'tháng này'}</th>
            <th>Trạng thái &amp; Mở khóa</th>
          </tr>`;
    }

    const colSpan = viewMode === 'full' ? 10 : 7;
    if (!visible.length) {
      tbody.innerHTML = `<tr><td colspan="${colSpan}" style="text-align:center; padding:22px; color:var(--ink-3);">Không có học viên nào khớp bộ lọc hiện tại.</td></tr>`;
      return;
    }

    let activeRankSeq = 0;
    tbody.innerHTML = visible.map((r, idx) => {
      const rankTxt = r.locks.length > 0 && r.periodActivity <= 0
        ? '🔒'
        : (r.periodActivity > 0 || viewMode === 'full' ? `#${++activeRankSeq}` : '–');
      const matrixHtml = renderStudentDailyMatrixCell(r.item, activeList, nowMs);
      const doneHtml = renderStudentDone4SkillCell(r.doneBySkill);
      const statusHtml = renderStatusUnlockCell(r.item, r.locks, nowMs);
      const rowCls = r.locks.length ? ' style="background:color-mix(in srgb, var(--ts-danger-bg) 35%, transparent);"' : '';

      if (viewMode === 'full') {
        return `
          <tr${rowCls}>
            <td class="tabular"><strong>${rankTxt}</strong></td>
            <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(monogram(r.item.name))}</span><strong>${esc(r.item.name)}</strong></div></td>
            <td class="tabular">${Number(r.item.todayMins || 0)}p</td>
            <td class="tabular">${Number(r.item.weekMins || 0)}p</td>
            <td class="tabular">${Number(r.item.monthMins || 0)}p</td>
            <td class="tabular">${r.streak} ngày</td>
            <td class="tabular">${Number(r.item.mastered || 0).toLocaleString('vi-VN')}</td>
            <td>${matrixHtml}</td>
            <td>${doneHtml}</td>
            <td>${statusHtml}</td>
          </tr>
        `;
      }
      return `
        <tr${rowCls}>
          <td class="tabular"><strong>${rankTxt}</strong></td>
          <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(monogram(r.item.name))}</span><strong>${esc(r.item.name)}</strong></div></td>
          <td class="tabular"><strong>${r.periodMins}p</strong></td>
          <td class="tabular">${r.periodWords} từ</td>
          <td>${matrixHtml}</td>
          <td>${doneHtml}</td>
          <td>${statusHtml}</td>
        </tr>
      `;
    }).join('');
  }

  /* =========================================================
     6. RENDER: ACTIVE / EXPIRED 4-SKILL HOMEWORK MONITOR
     ========================================================= */
  function renderExtendDeadlineSelectHtml(taskId, isMini = false, isExpired = false) {
    const cls = isMini ? 'ts-pick-mini-btn ts-hw-ext-sel is-mini' : 'ts-hw-btn ts-hw-ext-sel';
    const lbl = isExpired ? 'Mở lại ▾' : 'Gia hạn ▾';
    return `
      <select class="${cls}" aria-label="Gia hạn thời gian nộp bài" title="Chọn thời gian gia hạn hoặc đổi hạn nộp mới" onchange="TeacherStudio.onExtendTaskSelect('${esc(taskId)}', this)">
        <option value="" selected hidden>${lbl}</option>
        <option value="30">+30 phút</option>
        <option value="60">+1 giờ</option>
        <option value="120">+2 giờ</option>
        <option value="360">+6 giờ</option>
        <option value="720">+12 giờ</option>
        <option value="1440">+24 giờ (1 ngày)</option>
        <option value="2880">+48 giờ (2 ngày)</option>
        <option value="4320">+72 giờ (3 ngày)</option>
        <option value="10080">+7 ngày (1 tuần)</option>
        <option value="tonight_24">Trước 12h tối nay</option>
        <option value="tomorrow_24">Trước 12h tối mai</option>
        <option value="0">Không giới hạn</option>
        <option value="custom">Ngày giờ cụ thể...</option>
      </select>
    `;
  }

  function renderMonitorSection(nowMs, buckets) {
    const box = document.getElementById('ts-monitor-body');
    const panel = document.getElementById('ts-panel-monitor');
    if (!box || !panel) return;

    const { activeList, expiredList } = buckets;
    panel.style.display = '';
    if (!activeList.length && !expiredList.length) {
      box.innerHTML = `
        <div class="ts-empty-state">
          <div class="ts-empty-title">Chưa có bài tập nào đang giao</div>
          <div class="ts-empty-sub">Chuyển sang tab Giao bài để tick nhanh bài Nghe · Nói · Đọc · Viết hoặc bấm Chọn nhanh gói tuần.</div>
          <button type="button" class="btn btn-primary" onclick="TeacherStudio.setWorkspaceTab('assign')">Giao bài ngay</button>
        </div>
      `;
      return;
    }

    if (state.monitorTab === 'active' && !activeList.length && expiredList.length) state.monitorTab = 'expired';
    else if (state.monitorTab === 'expired' && !expiredList.length && activeList.length) state.monitorTab = 'active';

    const showingExpired = state.monitorTab === 'expired';
    const baseList = showingExpired ? expiredList : activeList;
    const filteredList = state.monitorSkill === 'all'
      ? baseList
      : baseList.filter((x) => x.task.skill === state.monitorSkill);

    const students = B()?.getStudentAccounts?.() || [];
    const totalStu = students.length || 1;

    const skillFiltersHtml = [
      { key: 'all', label: `Tất cả (${baseList.length})` },
      ...SKILLS.map((s) => ({
        key: s.key,
        label: `${s.label} (${baseList.filter((x) => x.task.skill === s.key).length})`,
      })).filter((s) => baseList.some((x) => x.task.skill === s.key)),
    ].map((f) => `<button type="button" class="ts-qfilter-btn ${state.monitorSkill === f.key ? 'active' : ''}" onclick="TeacherStudio.setMonitorSkill('${f.key}')">${esc(f.label)}</button>`).join('');

    const cardsHtml = filteredList.map(({ task, deadlineAt }) => {
      const sm = skillMeta(task.skill);
      const rows = students.map((st) => getStudentHomeworkRow(task, st, nowMs));
      const doneRows = rows.filter((r) => r.bucket === 'done');
      const progRows = rows.filter((r) => r.bucket === 'progress');
      const lockRows = rows.filter((r) => r.bucket === 'locked');
      const missRows = rows.filter((r) => r.bucket === 'missing');
      const notDoneRows = rows.filter((r) => !r.completed);

      const donePct = Math.round((doneRows.length / totalStu) * 100);
      const progPct = Math.round((progRows.length / totalStu) * 100);
      const lockPct = Math.round((lockRows.length / totalStu) * 100);

      let dlHtml = '<span class="ts-hw-dl is-open">Không giới hạn</span>';
      if (deadlineAt > 0) {
        const rem = deadlineAt - nowMs;
        const closeStr = formatDeadlineTs(deadlineAt);
        dlHtml = rem > 0
          ? `<span class="ts-hw-dl is-live" data-ts-dl-task="${esc(task.id)}" title="Đóng lúc ${esc(closeStr)}">Còn ${esc(formatDeadlineRemaining(rem))}</span>`
          : `<span class="ts-hw-dl is-ended" data-ts-dl-task="${esc(task.id)}">Đã đóng · ${esc(closeStr)}</span>`;
      }

      const lockStripHtml = lockRows.length
        ? `<div class="ts-hw-lock-strip">
            <strong>Bị khóa (${lockRows.length}):</strong>
            ${lockRows.map((r) => `
              <span>${esc(shortName(r.student.name))} (<span class="ts-lock-time" data-ts-lock-until="${r.lock.until}">${formatMmSs(r.lock.remainingMs)}</span>)</span>
              <button type="button" class="ts-btn-unlock-one" onclick="TeacherStudio.unlockStudentTask('${esc(r.student.id)}', '${esc(r.lock.lockKey)}')">Mở</button>
            `).join('')}
          </div>`
        : '';

      const rollLines = [];
      if (doneRows.length) {
        rollLines.push(`<div class="is-done"><strong>✓ Đã nộp (${doneRows.length}):</strong> ${esc(doneRows.map((r) => `${shortName(r.student.name)}${r.scoreLabel ? ` · ${r.scoreLabel}` : ''}`).join(', '))}</div>`);
      }
      if (showingExpired) {
        if (notDoneRows.length) {
          rollLines.push(`<div class="is-overdue"><strong>✗ Chưa nộp sau hạn (${notDoneRows.length}):</strong> ${esc(notDoneRows.map((r) => shortName(r.student.name)).join(', '))}</div>`);
        } else {
          rollLines.push('<div class="is-done"><strong>✓ Cả lớp đã nộp đủ 100%</strong></div>');
        }
      } else {
        const pendingNoLock = [...progRows, ...missRows];
        if (pendingNoLock.length) {
          rollLines.push(`<div class="is-miss"><strong>Chưa xong (${pendingNoLock.length}):</strong> ${esc(pendingNoLock.map((r) => shortName(r.student.name)).join(', '))}</div>`);
        } else if (!lockRows.length) {
          rollLines.push('<div class="is-done"><strong>✓ Cả lớp đã hoàn thành 100%</strong></div>');
        }
      }

      const actionsHtml = showingExpired
        ? `
          <button type="button" class="ts-hw-btn is-primary" onclick="TeacherStudio.openTaskDetailModal('${esc(task.id)}', 'pending')">Nhắc từng bạn</button>
          <button type="button" class="ts-hw-btn" onclick="TeacherStudio.copyGroupReminder('${esc(task.id)}', true)">Copy DS nhóm</button>
          ${renderExtendDeadlineSelectHtml(task.id, false, true)}
          <button type="button" class="ts-hw-btn" onclick="TeacherStudio.dismissMonitorTask('${esc(task.id)}')">Ẩn</button>
        `
        : `
          <button type="button" class="ts-hw-btn is-primary" onclick="TeacherStudio.openTaskDetailModal('${esc(task.id)}', 'pending')">Chi tiết &amp; Nhắc</button>
          <button type="button" class="ts-hw-btn" onclick="TeacherStudio.copyGroupReminder('${esc(task.id)}', false)">Copy nhóm</button>
          ${renderExtendDeadlineSelectHtml(task.id, false, false)}
          <button type="button" class="ts-hw-btn is-danger" onclick="TeacherStudio.endTasksNow(['${esc(task.id)}'])">Đóng hạn</button>
        `;

      return `
        <article class="ts-hw-card is-${esc(task.skill)} ${showingExpired ? 'is-expired' : ''}">
          <div class="ts-hw-top">
            <div class="ts-hw-title-col">
              <div class="ts-hw-meta-line">
                <span class="ts-skill-pill is-${esc(task.skill)}">${esc(sm.label.toUpperCase())}</span>
                <span class="ts-hw-code">${esc(task.code)}</span>
                ${dlHtml}
              </div>
              <div class="ts-hw-theme">${esc(task.theme)}</div>
            </div>
          </div>
          <div class="ts-hw-progress">
            <div class="ts-hw-bar">
              <div class="ts-hw-seg-done" style="width:${donePct}%;"></div>
              ${!showingExpired ? `<div class="ts-hw-seg-prog" style="width:${progPct}%;"></div>` : ''}
              ${lockPct ? `<div class="ts-hw-seg-lock" style="width:${lockPct}%;"></div>` : ''}
            </div>
            <div class="ts-hw-counts">
              <span><strong>${doneRows.length}/${rows.length}</strong> đã nộp · ${donePct}%</span>
              <span>${showingExpired ? `${notDoneRows.length} chưa nộp` : `${progRows.length} đang làm · ${lockRows.length} khóa · ${missRows.length} chưa mở`}</span>
            </div>
          </div>
          ${lockStripHtml}
          <div class="ts-hw-rollcall">${rollLines.join('')}</div>
          <div class="ts-hw-actions">${actionsHtml}</div>
        </article>
      `;
    }).join('');

    box.innerHTML = `
      <div class="ts-monitor-head">
        <div class="ts-monitor-tabs" role="tablist">
          <button type="button" class="ts-monitor-tab ${!showingExpired ? 'active' : ''}" onclick="TeacherStudio.setMonitorTab('active')">
            <span class="tam-dot is-live"></span>Đang giao <strong class="tabular">${activeList.length}</strong>
          </button>
          <button type="button" class="ts-monitor-tab ${showingExpired ? 'active' : ''}" onclick="TeacherStudio.setMonitorTab('expired')">
            <span class="tam-dot is-ended"></span>Đã hết hạn <strong class="tabular">${expiredList.length}</strong>
          </button>
        </div>
        <div class="ts-monitor-right">
          <div class="ts-monitor-skill-filters">${skillFiltersHtml}</div>
          <button type="button" class="btn-subtle ts-monitor-add-btn" onclick="TeacherStudio.setWorkspaceTab('assign')">+ Giao thêm</button>
        </div>
      </div>
      ${cardsHtml ? `<div class="ts-monitor-grid">${cardsHtml}</div>` : `<div class="ts-monitor-empty">Không có bài tập nào trong mục lọc này.</div>`}
    `;
  }

  /* =========================================================
     7. RENDER: 4-SKILL LINK COMPOSER & ULTRA-CLEAN PICKER
        (STRICT: NO "chưa làm / đang học / chưa ai làm" on cards!)
     ========================================================= */
  function renderPickerSection(nowMs) {
    const restricted = Boolean(window.AccessPolicy?.isRestricted?.());
    const isWeeklyMode = state.composerTemplate === 'weekly';
    const practiceOnly = isWeeklyMode || restricted;
    // Ensure active suite is valid for current mode (Weekly or Restricted Class = Practice ONLY, no proprietary Tasks!)
    const activeSuitesInit = getSuitesForSkill(state.pickerSkill);
    const curActiveSuite = state.pickerSuite[state.pickerSkill];
    if (activeSuitesInit.length && !activeSuitesInit.some((s) => s.key === curActiveSuite)) {
      state.pickerSuite[state.pickerSkill] = activeSuitesInit[0].key;
    }
    ensurePracticeBankLoadedForSuite(state.pickerSuite[state.pickerSkill]);

    // 1. 4-Skill Tabs
    const tabsEl = document.getElementById('ts-skill-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = SKILLS.map((sk) => {
        const selCnt = [...state.selectedIds].filter((tid) => detectSkillByTaskId(tid) === sk.key).length;
        let countText = '';
        if (practiceOnly) {
          if (sk.key === 'writing') {
            countText = `${getWritingPracticeCatalog().length} đề T1·T2·Full`;
          } else if (sk.key === 'speaking') {
            const spCnt = getSpeakingPracticeCatalog().length;
            countText = spCnt ? `${spCnt} đề P1–P3 & Full` : 'Đề Practice';
          } else {
            countText = 'Đề Practice';
          }
        } else {
          const list = getCatalogBySkill(sk.key);
          countText = list.length ? `${list.length} bài` : 'Sắp mở';
          if (sk.key === 'speaking') {
            const totalSp = getSpeakingCatalog().length + getSpeakingPracticeCatalog().length;
            countText = totalSp ? `${totalSp} bài` : 'Sắp mở';
          }
        }
        return `
          <button type="button" class="ts-skill-tab is-${sk.key} ${state.pickerSkill === sk.key ? 'active' : ''}" onclick="TeacherStudio.setPickerSkill('${sk.key}')">
            <div class="ts-skill-tab-left">
              <div class="ts-skill-tab-name">
                <span class="ts-slot-sk is-${sk.key}">${sk.short}</span>
                <span>${sk.label}</span>
              </div>
              <div class="ts-skill-tab-sub">${countText}</div>
            </div>
            ${selCnt > 0 ? `<span class="ts-skill-tab-sel tabular">${selCnt}</span>` : ''}
          </button>
        `;
      }).join('');
    }

    // Keep Assign tab badge in sync whenever selection changes
    const asgBadge = document.getElementById('ts-badge-assign');
    if (asgBadge) {
      const sel = state.selectedIds.size;
      asgBadge.textContent = String(sel);
      asgBadge.style.display = sel > 0 ? '' : 'none';
    }

    // 2. Selected Basket Strip inside Composer
    const basketEl = document.getElementById('ts-selected-basket');
    if (basketEl) {
      const selArr = [...state.selectedIds];
      const isWeekly = state.composerTemplate === 'weekly';
      if (!selArr.length) {
        basketEl.innerHTML = isWeekly
          ? '<span class="ts-basket-empty">Tick các đề Practice Nghe / Nói / Đọc / Viết bên trái — bài tập tuần chỉ gồm đề Practice (không lẫn Task).</span>'
          : (restricted
            ? '<span class="ts-basket-empty">Tick 1–4 đề Practice (Reading / Listening / Writing / Speaking) bên trái để gom vào link giao bài trong ngày.</span>'
            : '<span class="ts-basket-empty">Tick 1–4 bài ở bất kỳ kỹ năng nào bên trái để gom vào cùng 1 mẫu giao bài trong ngày.</span>');
      } else {
        basketEl.innerHTML = selArr.map((tid) => {
          const t = getTaskById(tid);
          const sk = t?.skill || detectSkillByTaskId(tid);
          const sm = skillMeta(sk);
          const secKey = getTaskSection(tid);
          const secMeta = WEEKLY_SECTIONS.find((x) => x.key === secKey) || WEEKLY_SECTIONS[0];
          const secPill = isWeekly
            ? `<button type="button" class="ts-basket-sec-btn" onclick="TeacherStudio.cycleTaskSection('${esc(tid)}')" title="Bấm để chuyển mục (Nghe → Nói → Đọc → Viết → Từ vựng/Ngữ pháp)">${esc(secMeta.short)}</button>`
            : '';
          return `
            <span class="ts-basket-chip is-${sk}">
              ${secPill}
              <strong>${sm.short}</strong> · ${esc(t?.shortCode || t?.code || tid)}
              <button type="button" class="ts-basket-rm" onclick="TeacherStudio.toggleSelectTask('${esc(tid)}', false)" aria-label="Bỏ chọn">×</button>
            </span>
          `;
        }).join('');
      }
    }

    // 3. Sub-suite tabs (+ Practice Mode Bar when viewing Reading/Listening/Writing/Speaking Practice suites!)
    const suites = getSuitesForSkill(state.pickerSkill);
    const curSuite = state.pickerSuite[state.pickerSkill] || (suites[0]?.key || 'all');
    const isPracticeSuite = /^(?:rp_|lp_|wp_practice|sp_practice)/.test(curSuite);
    const suiteTabsEl = document.getElementById('teacher-task-suite-tabs');
    if (suiteTabsEl) {
      const hasFullToggle = /^(?:rp_|lp_)/.test(curSuite);
      const modeBarHtml = isPracticeSuite ? `
        <div class="ts-prac-mode-bar">
          <span class="ts-prac-mode-lbl">Chế độ học sinh làm bài:</span>
          <button type="button" class="ts-prac-mode-btn ${state.pickerPracticeMode === 'practice' ? 'active' : ''}" onclick="TeacherStudio.setPickerPracticeMode('practice')">Luyện tập</button>
          <button type="button" class="ts-prac-mode-btn ${state.pickerPracticeMode === 'exam' ? 'active' : ''}" onclick="TeacherStudio.setPickerPracticeMode('exam')">Thi thật</button>
          ${hasFullToggle ? `
            <button type="button" class="ts-prac-mode-btn ${state.pickerHideFull ? 'active' : ''}" onclick="TeacherStudio.togglePickerHideFull()" title="Ẩn các đề Full Test, chỉ hiện từng Passage / Section lẻ">
              ${state.pickerHideFull ? '✓ Chỉ Passage / Section' : 'Hiện cả Full Test'}
            </button>
          ` : ''}
        </div>
      ` : '';
      suiteTabsEl.innerHTML = suites.map((s) => `
        <button type="button" class="task-suite-tab ${curSuite === s.key ? 'active' : ''}" onclick="TeacherStudio.setPickerSuite('${esc(s.key)}')">${esc(s.label)}</button>
      `).join('') + modeBarHtml;
    }

    // 4. Grid cards — STRICTLY CLEAN (NO "chưa làm / đang học / 0/8 HS" lines!)
    const gridEl = document.getElementById('teacher-dash-task-grid');
    if (!gridEl) return;

    if (state.pickerLoadingBank) {
      gridEl.className = 'ts-picker-grid';
      gridEl.innerHTML = '<div class="ts-monitor-empty" style="grid-column:1/-1;">Đang nạp danh sách đề Practice...</div>';
      updateLinkPreview();
      return;
    }

    if (state.pickerSkill === 'speaking' && !practiceOnly && !isPracticeSuite && !getSpeakingCatalog().length) {
      gridEl.className = 'ts-picker-grid';
      gridEl.innerHTML = `
        <div class="ts-speaking-soon">
          <strong>Kho Task IELTS Speaking (Part 1–3) đã sẵn sàng khung kết nối</strong>
          Khi nạp dữ liệu <code>SPEAKING_TASKS_DATA</code>, danh sách bài Speaking sẽ tự động hiện tại đây để tick giao chung link 4 kỹ năng cùng Reading, Listening và Writing.
        </div>
      `;
      updateLinkPreview();
      return;
    }

    const q = state.pickerQuery.trim().toLowerCase();
    const liveMap = loadLiveDeadlines();
    const catalog = getCatalogBySkill(state.pickerSkill).filter((t) => {
      if (practiceOnly && !t.isPractice) return false;
      if (curSuite !== 'all' && t.suite !== curSuite) return false;
      if (state.pickerHideFull && t.practiceMeta?.isFull) return false;
      if (q && !t.code.toLowerCase().includes(q) && !t.theme.toLowerCase().includes(q) && !t.id.toLowerCase().includes(q)) return false;
      if (state.pickerHideAllDone && isTaskAllDone(t, nowMs)) return false;
      return true;
    });

    gridEl.className = 'ts-picker-grid';
    if (!catalog.length) {
      gridEl.innerHTML = '<div class="ts-monitor-empty" style="grid-column:1/-1;">Không tìm thấy bài nào khớp từ khóa.</div>';
      updateLinkPreview();
      return;
    }

    gridEl.innerHTML = catalog.map((t) => {
      const checked = state.selectedIds.has(t.id);
      const dlRec = liveMap[t.id];
      const dlAt = Number(dlRec?.deadlineAt || 0);
      const isLive = dlAt > nowMs;
      const isEnded = dlAt > 0 && dlAt <= nowMs;
      const allDone = isTaskAllDone(t, nowMs);

      let tagHtml = '';
      if (isLive) {
        tagHtml = `<span class="ts-pick-tag is-live" data-ts-dl-task="${esc(t.id)}">Còn ${esc(formatDeadlineRemaining(dlAt - nowMs))}</span>`;
      } else if (allDone) {
        tagHtml = '<span class="ts-pick-tag is-done">✓ Xong hết</span>';
      } else if (isEnded) {
        tagHtml = '<span class="ts-pick-tag is-ended">Hết hạn</span>';
      }

      let previewBtns = '';
      if (t.isPractice) {
        previewBtns = `<button type="button" class="ts-pick-mini-btn" onclick="TeacherStudio.previewSkillTask('${esc(t.skill)}', '${esc(t.id)}')">Mở đề</button>`;
      } else if (t.skill === 'reading') {
        previewBtns = `
          <button type="button" class="ts-pick-mini-btn" onclick="TasksModule.openAdminTestPreview(1, '${esc(t.id)}')">T1</button>
          <button type="button" class="ts-pick-mini-btn" onclick="TasksModule.openAdminTestPreview(2, '${esc(t.id)}')">T2</button>
          <button type="button" class="ts-pick-mini-btn" onclick="TasksModule.openAdminTestPreview(3, '${esc(t.id)}')">T3</button>
        `;
      } else if (t.skill === 'listening') {
        previewBtns = `<button type="button" class="ts-pick-mini-btn" onclick="TeacherStudio.previewSkillTask('listening', '${esc(t.id)}')">Xem bài</button>`;
      } else if (t.skill === 'writing') {
        previewBtns = `<button type="button" class="ts-pick-mini-btn" onclick="TeacherStudio.previewSkillTask('writing', '${esc(t.id)}')">Xem bài</button>`;
      } else if (t.skill === 'speaking') {
        previewBtns = `<button type="button" class="ts-pick-mini-btn" onclick="TeacherStudio.previewSkillTask('speaking', '${esc(t.id)}')">Xem bài</button>`;
      }

      const dlMiniBtns = isLive
        ? `${renderExtendDeadlineSelectHtml(t.id, true, false)}
           <button type="button" class="ts-pick-mini-btn is-danger" onclick="TeacherStudio.endTasksNow(['${esc(t.id)}'])">Đóng</button>`
        : '';

      return `
        <label class="ts-pick-card is-${esc(t.skill)} ${checked ? 'is-selected' : ''}">
          <input type="checkbox" class="ts-pick-chk" ${checked ? 'checked' : ''} onchange="TeacherStudio.toggleSelectTask('${esc(t.id)}', this.checked)">
          <div class="ts-pick-body">
            <div class="ts-pick-head">
              <span class="ts-pick-code">${esc(t.code)}</span>
              ${tagHtml}
            </div>
            <div class="ts-pick-theme">${esc(t.theme)}</div>
            <div class="ts-pick-foot" onclick="event.stopPropagation(); event.preventDefault();">
              ${previewBtns}
              ${dlMiniBtns}
            </div>
          </div>
        </label>
      `;
    }).join('');

    updateLinkPreview();
  }

  /* =========================================================
     8. COMPOSER: DAILY HOMEWORK ZALO TEMPLATE & DEADLINES
     ========================================================= */
  function computeSelectedDeadlineMs(nowTs = Date.now()) {
    const preset = document.getElementById('teacher-task-deadline-preset')?.value || '0';
    if (preset === '0') return 0;
    if (preset === 'tonight_24') {
      const d = new Date(nowTs);
      d.setHours(23, 59, 59, 0);
      return d.getTime() > nowTs ? d.getTime() : (nowTs + 60 * 60 * 1000);
    }
    if (preset === 'tomorrow_24') {
      const d = new Date(nowTs);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 0);
      return d.getTime();
    }
    if (preset === 'custom') {
      const raw = document.getElementById('teacher-task-deadline-custom')?.value || '';
      if (!raw) return 0;
      const ts = new Date(raw).getTime();
      return (Number.isFinite(ts) && ts > nowTs) ? ts : 0;
    }
    const mins = Number(preset || 0);
    return (Number.isFinite(mins) && mins > 0) ? (nowTs + mins * 60 * 1000) : 0;
  }

  function formatVietnameseDeadlinePhrase(deadlineMs, nowMs = Date.now()) {
    if (!deadlineMs || deadlineMs <= 0) return '';
    const d = new Date(Number(deadlineMs));
    const now = new Date(Number(nowMs));
    if (Number.isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const h = d.getHours();
    const m = d.getMinutes();

    const startOfDay = (dt) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
    const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);

    const isMidnightEnd = (h === 23 && m >= 55);
    const timePart = isMidnightEnd
      ? '12h tối'
      : (h >= 18
        ? `${h}${m ? `h${pad(m)}` : 'h'} tối`
        : (h >= 13
          ? `${h}${m ? `h${pad(m)}` : 'h'} chiều`
          : (h === 12
            ? `12${m ? `h${pad(m)}` : 'h'} trưa`
            : `${h}${m ? `h${pad(m)}` : 'h'} sáng`)));

    if (dayDiff === 0) return `trước ${timePart} nay`;
    if (dayDiff === 1) return `trước ${timePart} mai`;
    if (isMidnightEnd) return `trước 12h tối ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    return `trước ${pad(h)}:${pad(m)} ngày ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  function resolveComposerDeadline(ids, nowTs = Date.now()) {
    const liveMap = loadLiveDeadlines();
    const preset = document.getElementById('teacher-task-deadline-preset')?.value || '0';
    if (ids.length > 0 && (!state.presetDirty || preset === '0')) {
      const active = ids.map((id) => liveMap[id]).filter((r) => r && Number(r.deadlineAt || 0) > nowTs);
      if (active.length === ids.length && active.every((r) => Number(r.deadlineAt) === Number(active[0].deadlineAt))) {
        return { deadlineMs: Number(active[0].deadlineAt), issuedAt: Number(active[0].issuedAt || nowTs), fromExistingLive: true };
      }
    }
    return { deadlineMs: computeSelectedDeadlineMs(nowTs), issuedAt: nowTs, fromExistingLive: false };
  }

  function buildBaseUrl() {
    const basePath = typeof window.__APP_BASE_PATH__ === 'string'
      ? window.__APP_BASE_PATH__
      : (window.location.pathname || '/')
          .replace(/\/index\.html$/i, '')
          .replace(/\/(home|flashcard|task|practice|practise)\/?$/i, '')
          .replace(/\/+$/, '');
    return window.location.protocol === 'file:'
      ? window.location.href.split('?')[0].split('#')[0]
      : `${window.location.origin}${basePath}/`;
  }

  function buildDirectTaskUrl(taskId, liveDl = null) {
    const base = buildBaseUrl();
    let url = `${base}?task=${encodeURIComponent(taskId)}`;
    const dl = Number(liveDl?.deadlineAt || 0);
    const iss = Number(liveDl?.issuedAt || 0);
    if (dl > 0) url += `&deadline=${dl}${iss > 0 ? `&issued=${iss}` : ''}`;
    return url;
  }

  function formatDotDate(dt) {
    if (!dt || Number.isNaN(dt.getTime())) return '';
    const p = (n) => String(n).padStart(2, '0');
    return `${p(dt.getDate())}.${p(dt.getMonth() + 1)}.${dt.getFullYear()}`;
  }

  function toIsoDateInput(dt) {
    const p = (n) => String(n).padStart(2, '0');
    return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
  }

  function computeAutoWeeklyTitle(dateObj) {
    const d = (dateObj && !Number.isNaN(dateObj.getTime())) ? dateObj : new Date();
    const weekNum = Math.min(5, Math.max(1, Math.ceil(d.getDate() / 7)));
    return `THÁNG ${d.getMonth() + 1} TUẦN ${weekNum}`;
  }

  function ensureWeeklyMetaDefaults(nowTs = Date.now()) {
    const nowDt = new Date(nowTs);
    if (!state.weeklyIssuedDate) state.weeklyIssuedDate = toIsoDateInput(nowDt);
    const issuedDt = parseIsoDateLocal(state.weeklyIssuedDate) || nowDt;
    if (!state.weeklyTitleDirty || !state.weeklyTitle) {
      state.weeklyTitle = computeAutoWeeklyTitle(issuedDt);
    }
    const titleEl = document.getElementById('ts-weekly-title');
    if (titleEl && document.activeElement !== titleEl && titleEl.value !== state.weeklyTitle) {
      titleEl.value = state.weeklyTitle;
    }
    const dateEl = document.getElementById('ts-weekly-issued-date');
    if (dateEl && document.activeElement !== dateEl && dateEl.value !== state.weeklyIssuedDate) {
      dateEl.value = state.weeklyIssuedDate;
    }
    const isWeekly = state.composerTemplate === 'weekly';
    document.querySelectorAll('[data-ts-tpl]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-ts-tpl') === state.composerTemplate);
    });
    const metaRow = document.getElementById('ts-weekly-meta-row');
    if (metaRow) metaRow.style.display = isWeekly ? '' : 'none';
    const dailyRow = document.getElementById('ts-daily-meta-row');
    if (dailyRow) dailyRow.style.display = isWeekly ? 'none' : '';
    const emptyWrap = document.getElementById('ts-show-empty-wrap');
    if (emptyWrap) emptyWrap.style.display = isWeekly ? '' : 'none';
    const emptyChk = document.getElementById('ts-show-empty-sections');
    if (emptyChk) emptyChk.checked = Boolean(state.showEmptySections);
  }

  function parseIsoDateLocal(isoStr) {
    const m = String(isoStr || '').trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }

  function getDefaultSectionForTask(rawId) {
    const tid = normalizeAnyTaskId(rawId);
    const pm = parsePracticeTaskId(tid);
    if (pm) return pm.skill; // 'listening' | 'speaking' | 'reading' | 'writing'
    const sk = detectSkillByTaskId(tid);
    // Reading vocab suites (Nền tảng / Học thuật / Paraphrase / Chuyên sâu) -> Mục 5: Từ vựng / Ngữ pháp
    if (sk === 'reading') return 'vocab';
    if (sk === 'listening') return 'listening';
    if (sk === 'speaking') return 'speaking';
    if (sk === 'writing') return 'writing';
    return 'vocab';
  }

  function getTaskSection(rawId) {
    const tid = normalizeAnyTaskId(rawId);
    const ov = state.sectionOverrides[tid];
    if (ov && WEEKLY_SECTIONS.some((s) => s.key === ov)) return ov;
    return getDefaultSectionForTask(tid);
  }

  function formatWeeklyDeadlineLine(deadlineMs) {
    if (!deadlineMs || deadlineMs <= 0) return 'Không giới hạn';
    const d = new Date(Number(deadlineMs));
    if (Number.isNaN(d.getTime())) return 'Không giới hạn';
    const dot = formatDotDate(d);
    const h = d.getHours();
    const m = d.getMinutes();
    if (h === 23 && m >= 55) return dot;
    const p = (n) => String(n).padStart(2, '0');
    return `${p(h)}:${p(m)} ngày ${dot}`;
  }

  function buildWeeklyHomeworkMessage(ids, deadlineMs, issuedAt, nowTs = Date.now()) {
    const hasIds = Array.isArray(ids) && ids.length > 0;
    if (!hasIds && !state.showEmptySections) return '';
    ensureWeeklyMetaDefaults(nowTs);

    const base = buildBaseUrl();
    const dlQuery = deadlineMs > 0 ? `&deadline=${deadlineMs}&issued=${issuedAt}` : '';
    const issuedDt = parseIsoDateLocal(state.weeklyIssuedDate) || new Date(nowTs);
    const weekTitle = (state.weeklyTitle || computeAutoWeeklyTitle(issuedDt)).trim().toUpperCase();

    const bySection = { listening: [], speaking: [], reading: [], writing: [], vocab: [] };
    (ids || []).forEach((tid) => {
      const sec = getTaskSection(tid);
      if (bySection[sec]) bySection[sec].push(tid);
      else bySection.vocab.push(tid);
    });

    const lines = [
      `BÀI TẬP VỀ NHÀ ${weekTitle}`,
      `Ngày giáo viên giao bài: ${formatDotDate(issuedDt)}`,
      `Học viên nộp bài trước: ${formatWeeklyDeadlineLine(deadlineMs)}`,
    ];

    let num = 0;
    WEEKLY_SECTIONS.forEach((sec) => {
      const list = bySection[sec.key] || [];
      if (!list.length && !state.showEmptySections) return;
      num += 1;
      lines.push('');
      lines.push(`${num}. ${sec.heading}`);
      if (!list.length) {
        lines.push('- Link: ');
      } else if (list.length === 1) {
        lines.push(`- Link: ${base}?task=${encodeURIComponent(list[0])}${dlQuery}`);
      } else {
        lines.push(`- Link: ${base}?tasks=${list.map(encodeURIComponent).join(',')}${dlQuery}`);
      }
    });

    return lines.join('\n');
  }

  function getOrderedTasksBySkill(skillKey) {
    if (skillKey === 'reading') {
      const suiteOrder = { foundation: 0, academic: 1, paraphrase: 2, advanced: 3 };
      return getReadingCatalog().slice().sort((a, b) => {
        const sa = suiteOrder[a.suite] ?? 99;
        const sb = suiteOrder[b.suite] ?? 99;
        return (sa - sb) || (Number(a.num || 0) - Number(b.num || 0));
      });
    }
    if (skillKey === 'listening') {
      const suites = (window.APP_LISTENING_TASKS?.suites || []).map((s) => s.key);
      const suiteOrder = {};
      suites.forEach((k, idx) => { suiteOrder[k] = idx; });
      return getListeningCatalog().slice().sort((a, b) => {
        const sa = suiteOrder[a.suite] ?? 99;
        const sb = suiteOrder[b.suite] ?? 99;
        return (sa - sb) || (Number(a.num || 0) - Number(b.num || 0));
      });
    }
    if (skillKey === 'writing') {
      const subs = (window.WRITING_STUDIO_DATA?.SUBTOPICS || []).map((s) => s.key);
      const subOrder = {};
      subs.forEach((k, idx) => { subOrder[k] = idx; });
      return getWritingCatalog().slice().sort((a, b) => {
        const sa = subOrder[a.suite] ?? 99;
        const sb = subOrder[b.suite] ?? 99;
        return (sa - sb) || (Number(a.num || 0) - Number(b.num || 0));
      });
    }
    return getSpeakingCatalog();
  }

  function pickSequentialNextTask(orderedList, offset, sentMap, liveMap, nowMs) {
    if (!Array.isArray(orderedList) || !orderedList.length) return null;
    // Anchor on the MOST RECENTLY assigned task (by timestamp) so:
    // - Today Task 1 -> Tomorrow Task 2 -> ... -> Last task of list -> Automatically rolls over to Task 1 of next list!
    // - Advanced classes that start mid-list (e.g. Học thuật Task 5) naturally continue to Task 6!
    // - Old/stale test deadlines in another list never hijack the current progression.
    let anchorIdx = -1;
    let latestTs = 0;
    for (let i = 0; i < orderedList.length; i++) {
      const t = orderedList[i];
      const sentTs = Number(sentMap[t.id] || 0);
      const liveRec = liveMap[t.id];
      const liveTs = liveRec ? Number(liveRec.issuedAt || liveRec.updatedAt || liveRec.deadlineAt || 0) : 0;
      const ts = Math.max(sentTs, liveTs);
      if (ts > latestTs || (ts > 0 && ts === latestTs && i > anchorIdx)) {
        latestTs = ts;
        anchorIdx = i;
      }
    }
    // Fallback if nothing has a timestamp yet: check furthest 100%-done task
    if (anchorIdx < 0) {
      for (let i = 0; i < orderedList.length; i++) {
        if (isTaskAllDone(orderedList[i], nowMs)) anchorIdx = i;
      }
    }
    const total = orderedList.length;
    let baseIdx = (anchorIdx + 1) % total;
    // Never re-pick a task that is ALREADY live/sent/done when there is an unassigned task immediately ahead
    for (let hop = 0; hop < total; hop++) {
      const cand = orderedList[(baseIdx + hop) % total];
      const candLive = liveMap[cand.id] && Number(liveMap[cand.id].deadlineAt || 0) > nowMs;
      if (!candLive && !sentMap[cand.id] && !isTaskAllDone(cand, nowMs)) {
        baseIdx = (baseIdx + hop) % total;
        break;
      }
    }
    const step = Number(offset) || 0;
    const targetIdx = ((baseIdx + step) % total + total) % total;
    return orderedList[targetIdx] || null;
  }

  async function autoPickDailyBundle() {
    const nowMs = Date.now();
    const sentMap = loadSentMap();
    const liveMap = loadLiveDeadlines();
    const offset = state.dailyAutoOffset;
    state.dailyAutoOffset += 1;

    let pickedRead, pickedListen, pickedWrite, pickedSpeak;
    if (window.AccessPolicy?.isRestricted?.()) {
      const loaders = [];
      if (window.ReadingPracticeApp?.ensureSourceBankLoaded) loaders.push(window.ReadingPracticeApp.ensureSourceBankLoaded('cambridge').catch(() => {}));
      if (window.ListeningPracticeApp?.ensureSourceBankLoaded) loaders.push(window.ListeningPracticeApp.ensureSourceBankLoaded('cambridge').catch(() => {}));
      if (loaders.length) await Promise.all(loaders);
      const readList = getReadingPracticeCatalog('cambridge').filter((it) => !it.practiceMeta?.isFull);
      const listenList = getListeningPracticeCatalog('cambridge').filter((it) => !it.practiceMeta?.isFull);
      pickedRead = pickNextCandidate(readList, offset, sentMap, liveMap, nowMs);
      pickedListen = pickNextCandidate(listenList, offset, sentMap, liveMap, nowMs);
      pickedWrite = pickNextCandidate(getWritingPracticeCatalog(), offset, sentMap, liveMap, nowMs);
      pickedSpeak = pickNextCandidate(getSpeakingPracticeCatalog(), offset, sentMap, liveMap, nowMs);
    } else {
      pickedRead = pickSequentialNextTask(getOrderedTasksBySkill('reading'), offset, sentMap, liveMap, nowMs);
      pickedListen = pickSequentialNextTask(getOrderedTasksBySkill('listening'), offset, sentMap, liveMap, nowMs);
      pickedWrite = pickSequentialNextTask(getOrderedTasksBySkill('writing'), offset, sentMap, liveMap, nowMs);
      pickedSpeak = pickSequentialNextTask(getOrderedTasksBySkill('speaking'), offset, sentMap, liveMap, nowMs);
    }

    state.composerTemplate = 'daily';
    try { localStorage.setItem(COMPOSER_TPL_KEY, 'daily'); } catch (_) {}
    state.selectedIds.clear();
    state.sectionOverrides = {};

    const picked = [pickedRead, pickedListen, pickedWrite, pickedSpeak].filter(Boolean);
    picked.forEach((item) => state.selectedIds.add(item.id));

    // Jump picker suite of currently viewed skill to the picked task's suite so teacher sees it checked immediately!
    const curPicked = picked.find((it) => it.skill === state.pickerSkill);
    if (curPicked && curPicked.suite) {
      state.pickerSuite[state.pickerSkill] = curPicked.suite;
    }

    // Default deadline to tonight 12h if teacher hasn't customized or is coming from 7-day weekly preset
    const dlSel = document.getElementById('teacher-task-deadline-preset');
    if (dlSel && (!state.presetDirty || dlSel.value === '10080')) {
      dlSel.value = 'tonight_24';
      state.presetDirty = false;
    }

    renderPickerSection(nowMs);

    const btn = document.getElementById('ts-btn-auto-daily');
    if (btn) {
      const span = btn.querySelector('span');
      const txt = 'Đổi sang gói Task kế tiếp nữa';
      if (span) span.textContent = txt;
      else btn.textContent = txt;
    }
    const hintEl = document.getElementById('ts-daily-auto-hint');
    const summary = picked.map((it) => `${skillMeta(it.skill).short}: ${it.code || it.shortCode}`).join(' · ');
    if (hintEl && summary) {
      hintEl.textContent = `Đã chọn nối tiếp: ${summary}`;
    }
    B()?.showToast?.(`Đã chọn gói Task ngày kế tiếp (${picked.length} kỹ năng): ${summary}`);
  }

  function pickNextCandidate(items, offset, sentMap, liveMap, nowMs) {
    if (!Array.isArray(items) || !items.length) return null;
    // Prefer items not previously sent/live and not already 100% finished by the whole class
    const fresh = items.filter((it) => !sentMap[it.id] && !liveMap[it.id] && !isTaskAllDone(it, nowMs));
    const pending = fresh.length ? fresh : items.filter((it) => !isTaskAllDone(it, nowMs));
    const pool = pending.length ? pending : items;
    const idx = ((Number(offset) || 0) % pool.length + pool.length) % pool.length;
    return pool[idx] || null;
  }

  async function autoPickWeeklyBundle() {
    if (state.weeklyAutoLoading) return;
    state.weeklyAutoLoading = true;
    const btn = document.getElementById('ts-btn-auto-weekly');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang chọn gói...';
    }
    const src = ['cambridge', 'volume', 'actual'].includes(state.weeklyAutoSource) ? state.weeklyAutoSource : 'cambridge';
    try {
      const loaders = [];
      if (window.ReadingPracticeApp?.ensureSourceBankLoaded) {
        loaders.push(window.ReadingPracticeApp.ensureSourceBankLoaded(src).catch(() => {}));
      }
      if (window.ListeningPracticeApp?.ensureSourceBankLoaded) {
        loaders.push(window.ListeningPracticeApp.ensureSourceBankLoaded(src).catch(() => {}));
      }
      if (loaders.length) await Promise.all(loaders);

      const nowMs = Date.now();
      const sentMap = loadSentMap();
      const liveMap = loadLiveDeadlines();
      const offset = state.weeklyAutoOffset;
      state.weeklyAutoOffset += 1;

      // Weekly bundle = PRACTICE ONLY across 4 skills (ZERO Tasks, NEVER Full Tests!)
      // 1. Listening Practice Section/Part ONLY
      const listenParts = getListeningPracticeCatalog(src).filter((it) => !it.practiceMeta?.isFull);
      const pickedListen = pickNextCandidate(listenParts, offset, sentMap, liveMap, nowMs);

      // 2. Speaking Practice Cue Card ONLY
      const spCues = getSpeakingPracticeCatalog();
      const pickedSpeak = pickNextCandidate(spCues, offset, sentMap, liveMap, nowMs);

      // 3. Reading Practice Passage ONLY — newest Cambridge book first (Cam 20 -> 19 -> 18...)
      const readPassages = getReadingPracticeCatalog(src)
        .filter((it) => !it.practiceMeta?.isFull)
        .sort((a, b) => {
          const ma = String(a.practiceMeta?.itemId || '').match(/_(\d+)_t(\d+)_p(\d+)/i);
          const mb = String(b.practiceMeta?.itemId || '').match(/_(\d+)_t(\d+)_p(\d+)/i);
          if (ma && mb) {
            return (Number(mb[1]) - Number(ma[1])) || (Number(ma[2]) - Number(mb[2])) || (Number(ma[3]) - Number(mb[3]));
          }
          return 0;
        });
      const pickedRead = pickNextCandidate(readPassages, offset, sentMap, liveMap, nowMs);

      // 4. Writing Task 2 Practice Prompt ONLY
      const writePrompts = getWritingPracticeCatalog();
      const pickedWrite = pickNextCandidate(writePrompts, offset, sentMap, liveMap, nowMs);

      state.composerTemplate = 'weekly';
      try { localStorage.setItem(COMPOSER_TPL_KEY, 'weekly'); } catch (_) {}
      state.selectedIds.clear();
      state.sectionOverrides = {};

      const picked = [
        { item: pickedListen, sec: 'listening' },
        { item: pickedSpeak,  sec: 'speaking' },
        { item: pickedRead,   sec: 'reading' },
        { item: pickedWrite,  sec: 'writing' },
      ].filter((x) => x.item);

      picked.forEach(({ item, sec }) => {
        state.selectedIds.add(item.id);
        state.sectionOverrides[item.id] = sec;
      });

      // Default deadline to 7 days (1 week) when switching from daily default
      const dlSel = document.getElementById('teacher-task-deadline-preset');
      if (dlSel && (!state.presetDirty || dlSel.value === 'tonight_24' || dlSel.value === 'tomorrow_24')) {
        dlSel.value = '10080';
        state.presetDirty = true;
      }

      renderPickerSection(Date.now());
      const names = picked.map((x) => x.item.shortCode || x.item.code).join(' · ');
      B()?.showToast?.(`Đã chọn sẵn gói tuần (${picked.length} đề Practice): ${names}`);
    } finally {
      state.weeklyAutoLoading = false;
      if (btn) {
        btn.disabled = false;
        const lblSpan = btn.querySelector('span');
        const nextText = state.weeklyAutoOffset > 0 ? 'Đổi gói tuần khác' : 'Chọn nhanh gói tuần';
        if (lblSpan) lblSpan.textContent = nextText;
        else btn.textContent = nextText;
      }
    }
  }

  function buildDailyHomeworkMessage(ids, deadlineMs, issuedAt, nowTs = Date.now()) {
    if (!Array.isArray(ids) || !ids.length) return '';
    const base = buildBaseUrl();
    const dlQuery = deadlineMs > 0 ? `&deadline=${deadlineMs}&issued=${issuedAt}` : '';
    const skillOrder = ['listening', 'reading', 'writing', 'speaking'];
    const bySkill = { listening: [], reading: [], writing: [], speaking: [] };
    ids.forEach((tid) => {
      const sk = detectSkillByTaskId(tid);
      if (bySkill[sk]) bySkill[sk].push(tid);
      else bySkill.reading.push(tid);
    });

    const lines = ['DAILY HOMEWORK'];
    skillOrder.forEach((sk) => {
      const list = bySkill[sk];
      if (!list.length) return;
      const skillUrl = list.length === 1
        ? `${base}?task=${encodeURIComponent(list[0])}${dlQuery}`
        : `${base}?tasks=${list.map(encodeURIComponent).join(',')}${dlQuery}`;
      lines.push(`-${sk.toUpperCase()}: ${skillUrl}`);
    });

    if (deadlineMs > 0) {
      lines.push(`HẠN NỘP: ${formatVietnameseDeadlinePhrase(deadlineMs, nowTs)}`);
    }
    return lines.join('\n');
  }

  function updateLinkPreview() {
    ensureWeeklyMetaDefaults(Date.now());
    const ids = [...state.selectedIds];
    const cntEl = document.getElementById('teacher-dash-sel-count');
    if (cntEl) cntEl.textContent = `Đã chọn: ${ids.length} bài`;
    const nowTs = Date.now();
    const resolved = resolveComposerDeadline(ids, nowTs);
    const message = state.composerTemplate === 'weekly'
      ? buildWeeklyHomeworkMessage(ids, resolved.deadlineMs, resolved.issuedAt, nowTs)
      : buildDailyHomeworkMessage(ids, resolved.deadlineMs, resolved.issuedAt, nowTs);
    const inp = document.getElementById('teacher-dash-link-preview');
    if (inp) {
      inp.value = message;
      if (inp.tagName === 'TEXTAREA') {
        const lineCount = message ? message.split('\n').length : 3;
        const maxRows = state.composerTemplate === 'weekly' ? 14 : 6;
        inp.rows = Math.min(maxRows, Math.max(3, lineCount));
      }
    }
    return { url: message, message, ...resolved };
  }

  function copySafe(txt, onDone) {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(txt).then(() => onDone?.()).catch(() => {
        fallbackCopy(txt);
        onDone?.();
      });
    } else {
      fallbackCopy(txt);
      onDone?.();
    }
  }

  function fallbackCopy(txt) {
    try {
      const ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch (_) {}
  }

  function loadWeeklyBatches() {
    return readJson(scopedClassKey(WEEKLY_BATCHES_KEY), {});
  }

  function computeWeekKeyFromDate(dateObj) {
    const d = (dateObj && !Number.isNaN(dateObj.getTime())) ? dateObj : new Date();
    const weekNum = Math.min(5, Math.max(1, Math.ceil(d.getDate() / 7)));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-W${weekNum}`;
  }

  function recordWeeklyBatch(ids, titleOverride = '', issuedDateIso = '', deadlineMs = 0) {
    const cleanIds = (Array.isArray(ids) ? ids : []).map(normalizeAnyTaskId).filter(Boolean);
    if (!cleanIds.length) return;
    const nowTs = Date.now();
    const dt = parseIsoDateLocal(issuedDateIso) || new Date(nowTs);
    const weekKey = computeWeekKeyFromDate(dt);
    const title = (titleOverride || computeAutoWeeklyTitle(dt)).trim().toUpperCase();
    const batches = loadWeeklyBatches();
    const prev = batches[weekKey] || { weekKey, title, issuedDate: toIsoDateInput(dt), taskIds: [], updatedAt: 0 };
    const mergedIds = [...new Set([...(Array.isArray(prev.taskIds) ? prev.taskIds : []), ...cleanIds])];
    batches[weekKey] = {
      weekKey,
      title,
      issuedDate: issuedDateIso || prev.issuedDate || toIsoDateInput(dt),
      deadlineAt: deadlineMs > 0 ? Number(deadlineMs) : Number(prev.deadlineAt || 0),
      taskIds: mergedIds,
      updatedAt: nowTs,
    };
    writeJson(scopedClassKey(WEEKLY_BATCHES_KEY), batches);
  }

  function copySelectedLink() {
    const ids = [...state.selectedIds];
    const previewEl = document.getElementById('teacher-dash-link-preview');
    const manualTxt = (previewEl?.value || '').trim();
    if (!ids.length && !manualTxt) {
      B()?.showToast?.('Vui lòng tick ít nhất 1 bài trước khi tạo mẫu gửi Zalo.');
      return;
    }
    const nowTs = Date.now();
    const resolved = resolveComposerDeadline(ids, nowTs);
    const autoMsg = state.composerTemplate === 'weekly'
      ? buildWeeklyHomeworkMessage(ids, resolved.deadlineMs, resolved.issuedAt, nowTs)
      : buildDailyHomeworkMessage(ids, resolved.deadlineMs, resolved.issuedAt, nowTs);
    const finalMsg = manualTxt || autoMsg;
    if (!finalMsg) return;

    if (ids.length) {
      if (resolved.deadlineMs > 0 && !resolved.fromExistingLive) {
        const liveMap = loadLiveDeadlines();
        const toSave = ids.filter((tid) => state.presetDirty || !(liveMap[tid] && Number(liveMap[tid].deadlineAt || 0) > Date.now()));
        if (toSave.length) updateLiveDeadlines(toSave, resolved.deadlineMs);
      } else if (resolved.deadlineMs === 0) {
        const liveMap = loadLiveDeadlines();
        const needStamp = ids.filter((tid) => !liveMap[tid]);
        if (needStamp.length) updateLiveDeadlines(needStamp, 0);
      }
      saveSentTasks(ids);
      recordWeeklyBatch(ids, state.weeklyTitle, state.weeklyIssuedDate, resolved.deadlineMs);
      state.dailyAutoOffset = 0;
      const dailyBtnSpan = document.querySelector('#ts-btn-auto-daily span');
      if (dailyBtnSpan) dailyBtnSpan.textContent = 'Chọn nhanh gói ngày (Task kế tiếp)';
    }
    state.presetDirty = false;
    state.monitorTab = 'active';
    const tplLbl = state.composerTemplate === 'weekly' ? 'BÀI TẬP TUẦN' : 'DAILY HOMEWORK';
    const dlNote = resolved.deadlineMs > 0 ? ` (${formatVietnameseDeadlinePhrase(resolved.deadlineMs)})` : '';
    copySafe(finalMsg, () => {
      B()?.showToast?.(`Đã copy mẫu ${tplLbl} (${ids.length} bài${dlNote}) — dán thẳng vào Zalo!`);
      renderDashboard();
    });
  }

  function applyLiveDeadline() {
    const ids = [...state.selectedIds];
    if (!ids.length) {
      B()?.showToast?.('Vui lòng tick ít nhất 1 bài để cập nhật hạn nộp.');
      return;
    }
    const dlMs = computeSelectedDeadlineMs(Date.now());
    state.presetDirty = false;
    updateLiveDeadlines(ids, dlMs, dlMs > 0 ? `Đã cập nhật hạn nộp mới (${formatDeadlineTs(dlMs)})!` : 'Đã chuyển sang Không giới hạn thời gian.');
  }

  function formatAddDurationLabel(addMinutes) {
    if (addMinutes >= 10080 && addMinutes % 10080 === 0) return `${addMinutes / 10080} tuần`;
    if (addMinutes >= 1440 && addMinutes % 1440 === 0) return `${addMinutes / 1440} ngày`;
    if (addMinutes >= 60 && addMinutes % 60 === 0) return `${addMinutes / 60} giờ`;
    return `${addMinutes} phút`;
  }

  function extendTaskDeadline(taskId, addMinutes = 60) {
    const tid = normalizeAnyTaskId(taskId);
    if (!tid) return;
    const liveMap = loadLiveDeadlines();
    const curDl = Number(liveMap[tid]?.deadlineAt || 0);
    const base = Math.max(Date.now(), curDl);
    const nextDl = base + addMinutes * 60 * 1000;
    updateLiveDeadlines([tid], nextDl, `Đã gia hạn thêm ${formatAddDurationLabel(addMinutes)} (đóng ${formatDeadlineTs(nextDl)})!`);
  }

  function openCustomDeadlineModal(taskId) {
    const tid = normalizeAnyTaskId(taskId);
    if (!tid) return;
    const taskObj = getTaskById(tid);
    const liveMap = loadLiveDeadlines();
    const curDl = Number(liveMap[tid]?.deadlineAt || 0);
    const seedMs = curDl > Date.now() ? curDl : (Date.now() + 2 * 60 * 60 * 1000);
    const dt = new Date(seedMs);
    const pad = (n) => String(n).padStart(2, '0');
    const localVal = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

    let ov = document.getElementById('modal-teacher-custom-dl');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = 'modal-teacher-custom-dl';
      ov.className = 'modal-overlay';
      ov.style.zIndex = '2560';
      ov.onclick = (e) => { if (e.target === ov) ov.classList.remove('open'); };
      document.body.appendChild(ov);
    }
    ov.innerHTML = `
      <div class="modal-card" style="max-width:420px; width:min(94vw,420px);" onclick="event.stopPropagation()">
        <div class="modal-header" style="padding:14px 18px;">
          <div class="modal-title" style="font-size:15.5px;">Đặt hạn nộp cụ thể</div>
          <button type="button" class="btn-icon-glass" style="width:30px;height:30px;" onclick="document.getElementById('modal-teacher-custom-dl')?.classList.remove('open')" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 18px 18px; display:flex; flex-direction:column; gap:12px;">
          <div style="font-size:13px; color:var(--ink-2);">Bài: <strong>${esc(taskObj?.code || tid)}</strong>${taskObj?.theme ? ` · ${esc(taskObj.theme)}` : ''}</div>
          <input type="datetime-local" id="ts-custom-dl-input" class="task-link-input" value="${localVal}" style="width:100%; height:38px; font-size:14px; font-weight:700;">
          <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
            <button type="button" class="btn-subtle" onclick="document.getElementById('modal-teacher-custom-dl')?.classList.remove('open')">Hủy</button>
            <button type="button" class="btn btn-primary" onclick="TeacherStudio.confirmCustomTaskDeadline('${esc(tid)}')">Lưu hạn nộp</button>
          </div>
        </div>
      </div>
    `;
    ov.classList.add('open');
  }

  function confirmCustomTaskDeadline(taskId) {
    const tid = normalizeAnyTaskId(taskId);
    const raw = document.getElementById('ts-custom-dl-input')?.value || '';
    if (!tid || !raw) {
      B()?.showToast?.('Vui lòng chọn ngày giờ hạn nộp hợp lệ.');
      return;
    }
    const ts = new Date(raw).getTime();
    if (!Number.isFinite(ts) || ts <= Date.now()) {
      B()?.showToast?.('Thời điểm hạn nộp phải lớn hơn hiện tại.');
      return;
    }
    document.getElementById('modal-teacher-custom-dl')?.classList.remove('open');
    updateLiveDeadlines([tid], ts, `Đã cập nhật hạn nộp đến ${formatDeadlineTs(ts)}!`);
  }

  function onExtendTaskSelect(taskId, selectEl) {
    const val = String(selectEl?.value || '');
    if (selectEl) selectEl.value = '';
    if (!val) return;
    const tid = normalizeAnyTaskId(taskId);
    if (!tid) return;
    const nowTs = Date.now();
    if (val === 'custom') {
      openCustomDeadlineModal(tid);
      return;
    }
    if (val === '0') {
      updateLiveDeadlines([tid], 0, 'Đã chuyển bài sang Không giới hạn thời gian!');
      return;
    }
    if (val === 'tonight_24') {
      const d = new Date(nowTs);
      d.setHours(23, 59, 59, 0);
      const nextDl = d.getTime() > nowTs ? d.getTime() : (nowTs + 60 * 60 * 1000);
      updateLiveDeadlines([tid], nextDl, `Đã đặt hạn nộp trước 12h tối nay (${formatDeadlineTs(nextDl)})!`);
      return;
    }
    if (val === 'tomorrow_24') {
      const d = new Date(nowTs);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 0);
      const nextDl = d.getTime();
      updateLiveDeadlines([tid], nextDl, `Đã đặt hạn nộp trước 12h tối mai (${formatDeadlineTs(nextDl)})!`);
      return;
    }
    const mins = Number(val);
    if (Number.isFinite(mins) && mins > 0) {
      extendTaskDeadline(tid, mins);
    }
  }

  function endTasksNow(targetIds = null) {
    const ids = Array.isArray(targetIds) ? targetIds : [...state.selectedIds];
    if (!ids.length) {
      B()?.showToast?.('Vui lòng tick ít nhất 1 bài cần đóng hạn.');
      return;
    }
    updateLiveDeadlines(ids, Date.now() - 1000, `Đã đóng hạn ngay ${ids.length} bài!`);
  }

  function dismissMonitorTask(taskId) {
    const tid = normalizeAnyTaskId(taskId);
    if (!tid) return;
    const map = loadDismissedMap();
    map[tid] = Date.now();
    writeJson(scopedClassKey(DISMISSED_KEY), map);
    renderDashboard();
    B()?.showToast?.('Đã ẩn bài khỏi danh sách theo dõi.');
  }

  /* =========================================================
     9. 4-SKILL TASK DETAIL MODAL & ZALO REMINDERS
     ========================================================= */
  function buildStudentZaloText(taskObj, row, liveDl, nowMs) {
    const sm = skillMeta(taskObj.skill);
    const sn = shortName(row.student.name);
    const dlAt = Number(liveDl?.deadlineAt || 0);
    const expired = dlAt > 0 && dlAt <= nowMs;
    const closeStr = dlAt > 0 ? formatDeadlineTs(dlAt) : '';

    if (expired) {
      const detail = row.bucket === 'progress' ? ` (${row.progressLabel})` : '';
      return `Chào ${sn},\nBài ${sm.label} · ${taskObj.code} (${taskObj.theme}) đã đóng hạn lúc ${closeStr} nhưng em chưa nộp${detail}. Em nhắn lại thầy/cô để sắp xếp hoàn thành bù sớm nhé!`;
    }
    let body = `Nhắc nhẹ em nhớ vào làm bài ${sm.label} · ${taskObj.code} (${taskObj.theme}) trước hạn nhé!`;
    if (row.lock) {
      body = `Bài ${sm.label} · ${taskObj.code} (${taskObj.theme}) của em hiện đang bị tạm khóa. Em nhắn thầy/cô mở khóa để hoàn thành kịp hạn nhé!`;
    } else if (row.bucket === 'progress') {
      body = `Em đang làm dở bài ${sm.label} · ${taskObj.code} (${row.progressLabel}). Nhớ vào hoàn thành nốt để nộp đúng hạn nhé!`;
    }
    const lines = [`Chào ${sn},`, body];
    if (dlAt > nowMs) lines.push(`⏱ Hạn nộp: còn ${formatDeadlineRemaining(dlAt - nowMs)} (đóng ${closeStr})`);
    lines.push(`🔗 Vào làm bài: ${buildDirectTaskUrl(taskObj.id, liveDl)}`);
    return lines.join('\n');
  }

  function copyStudentAllPendingReminder(studentId) {
    const nowMs = Date.now();
    const { activeList } = getActiveAndExpiredTasks(nowMs);
    const students = B()?.getStudentAccounts?.() || [];
    const st = students.find((s) => String(s.id) === String(studentId));
    if (!st || !activeList.length) return;

    const missing = activeList
      .map(({ task, deadlineAt }) => {
        const row = getStudentHomeworkRow(task, st, nowMs);
        return row.completed ? null : { task, deadlineAt, row };
      })
      .filter(Boolean);

    if (!missing.length) {
      B()?.showToast?.(`${shortName(st.name)} đã hoàn thành đủ các bài đang giao!`);
      return;
    }

    const nearestDl = missing.reduce((min, x) => (x.deadlineAt > 0 && (!min || x.deadlineAt < min) ? x.deadlineAt : min), 0);
    const lines = [
      `Nhắc bài tập cho ${shortName(st.name)} — hiện còn ${missing.length}/${activeList.length} bài chưa xong:`,
      ...missing.map((x, i) => {
        const sm = skillMeta(x.task.skill);
        const stNote = x.row.bucket === 'progress' ? ` (đang làm dở: ${x.row.progressLabel})` : (x.row.bucket === 'locked' ? ' (đang bị khóa)' : '');
        const dlNote = x.deadlineAt > 0 ? ` — hạn ${formatDeadlineTs(x.deadlineAt)}` : '';
        return `${i + 1}. [${sm.label}] ${x.task.code}${stNote}${dlNote}`;
      }),
      nearestDl > 0 ? `Em tranh thủ hoàn thành trước ${formatDeadlineTs(nearestDl)} nhé!` : 'Em tranh thủ hoàn thành sớm nhé!',
      `Link làm bài: ${getAppPublicUrl()}`,
    ];
    state.remindedKeys.add(`allpending::${st.id}`);
    copySafe(lines.join('\n'), () => {
      B()?.showToast?.(`Đã copy tin nhắn nhắc ${missing.length} bài chưa xong cho ${shortName(st.name)}!`);
      renderDashboard();
    });
  }

  function copyAllPendingReminder() {
    const nowMs = Date.now();
    const { activeList } = getActiveAndExpiredTasks(nowMs);
    const students = B()?.getStudentAccounts?.() || [];
    if (!activeList.length || !students.length) return;

    const pendingRows = students
      .map((st) => {
        const miss = activeList
          .map(({ task }) => {
            const row = getStudentHomeworkRow(task, st, nowMs);
            return row.completed ? null : { task, row };
          })
          .filter(Boolean);
        return miss.length ? { st, miss } : null;
      })
      .filter(Boolean)
      .sort((a, b) => b.miss.length - a.miss.length);

    if (!pendingRows.length) {
      B()?.showToast?.('Cả lớp đã hoàn thành tất cả bài đang giao!');
      return;
    }

    const lines = [
      `NHẮC BÀI TẬP ĐANG GIAO (${activeList.length} bài · còn ${pendingRows.length}/${students.length} bạn chưa xong):`,
      ...pendingRows.map((p, i) => {
        const codes = p.miss.map((x) => `${skillMeta(x.task.skill).short}:${x.task.code}`).join(', ');
        return `${i + 1}. ${p.st.name} (thiếu ${p.miss.length}/${activeList.length}): ${codes}`;
      }),
      `Các em vào hoàn thành đúng hạn nhé: ${getAppPublicUrl()}`,
    ];
    copySafe(lines.join('\n'), () => {
      B()?.showToast?.(`Đã copy danh sách nhắc ${pendingRows.length} bạn gửi nhóm Zalo!`);
    });
  }

  function copyStudentReminder(taskId, studentId) {
    const taskObj = getTaskById(taskId || state.detailTaskId);
    const students = B()?.getStudentAccounts?.() || [];
    const st = students.find((s) => String(s.id) === String(studentId));
    if (!taskObj || !st) return;
    const nowMs = Date.now();
    const liveDl = loadLiveDeadlines()[taskObj.id] || null;
    const row = getStudentHomeworkRow(taskObj, st, nowMs);
    const txt = buildStudentZaloText(taskObj, row, liveDl, nowMs);
    state.remindedKeys.add(`${taskObj.id}::${st.id}`);
    copySafe(txt, () => {
      B()?.showToast?.(`Đã copy tin nhắn nhắc riêng cho ${shortName(st.name)}!`);
      if (document.getElementById('modal-teacher-task-detail')?.classList.contains('open')) renderDetailModalBody();
    });
  }

  function copyGroupReminder(taskId, isExpiredReport = false) {
    const taskObj = getTaskById(taskId || state.detailTaskId);
    if (!taskObj) return;
    const sm = skillMeta(taskObj.skill);
    const students = B()?.getStudentAccounts?.() || [];
    const nowMs = Date.now();
    const rows = students.map((st) => getStudentHomeworkRow(taskObj, st, nowMs));
    const doneRows = rows.filter((r) => r.completed);
    const notDone = rows.filter((r) => !r.completed);
    const liveDl = loadLiveDeadlines()[taskObj.id];
    const dlAt = Number(liveDl?.deadlineAt || 0);
    const expired = isExpiredReport || (dlAt > 0 && dlAt <= nowMs);

    const lines = [
      expired
        ? `📊 THỐNG KÊ HẾT HẠN [${sm.label.toUpperCase()}] — ${taskObj.code}: ${taskObj.theme}`
        : `📋 NHẮC NỘP BÀI [${sm.label.toUpperCase()}] — ${taskObj.code}: ${taskObj.theme}`,
      dlAt > 0
        ? (dlAt > nowMs ? `⏱ Hạn nộp: còn ${formatDeadlineRemaining(dlAt - nowMs)} (đóng ${formatDeadlineTs(dlAt)})` : `⏱ Đã đóng hạn lúc ${formatDeadlineTs(dlAt)}`)
        : '',
      `✓ Đã nộp: ${doneRows.length}/${rows.length} bạn`,
    ].filter(Boolean);

    if (notDone.length) {
      lines.push('');
      lines.push(`${expired ? '✗ Chưa nộp sau hạn' : '⏳ Chưa hoàn thành'} (${notDone.length}):`);
      notDone.forEach((r) => lines.push(`• ${r.student.name} — ${r.progressLabel}`));
    } else {
      lines.push('🎉 Cả lớp đã hoàn thành 100%!');
    }
    copySafe(lines.join('\n'), () => B()?.showToast?.('Đã copy danh sách gửi nhóm Zalo!'));
  }

  function renderDetailModalBody() {
    const titleEl = document.getElementById('teacher-task-detail-title');
    const subEl = document.getElementById('teacher-task-detail-sub');
    const bodyEl = document.getElementById('teacher-task-detail-body');
    const taskObj = getTaskById(state.detailTaskId);
    if (!bodyEl || !taskObj) return;

    const sm = skillMeta(taskObj.skill);
    const students = B()?.getStudentAccounts?.() || [];
    const nowMs = Date.now();
    const liveDl = loadLiveDeadlines()[taskObj.id] || null;
    const dlAt = Number(liveDl?.deadlineAt || 0);
    const isExpired = dlAt > 0 && dlAt <= nowMs;

    const rows = students.map((st) => getStudentHomeworkRow(taskObj, st, nowMs));
    const order = { locked: 0, done: 1, progress: 2, missing: 3 };
    rows.sort((a, b) => (order[a.bucket] - order[b.bucket]) || String(a.student.name).localeCompare(String(b.student.name), 'vi'));

    const doneCnt = rows.filter((r) => r.completed).length;
    const lockCnt = rows.filter((r) => r.bucket === 'locked').length;
    const progCnt = rows.filter((r) => r.bucket === 'progress').length;
    const missCnt = rows.filter((r) => r.bucket === 'missing').length;
    const pendingCnt = rows.length - doneCnt;

    if (titleEl) {
      titleEl.innerHTML = `<span class="ts-skill-pill is-${esc(taskObj.skill)}" style="vertical-align:middle; margin-right:6px;">${esc(sm.label.toUpperCase())}</span>${esc(taskObj.code)} — ${esc(taskObj.theme)}`;
    }
    if (subEl) {
      const dlStr = dlAt > 0
        ? (dlAt > nowMs ? `Còn ${formatDeadlineRemaining(dlAt - nowMs)} · đóng ${formatDeadlineTs(dlAt)}` : `Đã đóng lúc ${formatDeadlineTs(dlAt)}`)
        : 'Không giới hạn';
      subEl.textContent = `${doneCnt}/${rows.length} đã nộp · ${progCnt} đang học · ${lockCnt} bị khóa · ${missCnt} chưa làm · ${dlStr}`;
    }

    const visible = state.detailFilter === 'all'
      ? rows
      : (state.detailFilter === 'pending' ? rows.filter((r) => !r.completed) : rows.filter((r) => r.bucket === state.detailFilter));

    const chips = [
      { key: 'all', label: `Tất cả (${rows.length})` },
      { key: 'pending', label: `Chưa nộp (${pendingCnt})` },
      { key: 'done', label: `✓ Đã nộp (${doneCnt})` },
      ...(lockCnt ? [{ key: 'locked', label: `🔒 Bị khóa (${lockCnt})` }] : []),
      { key: 'progress', label: `Đang học (${progCnt})` },
      { key: 'missing', label: `Chưa mở (${missCnt})` },
    ];

    const rowsHtml = visible.map((r, idx) => {
      const pct = Math.min(100, Math.round((r.doneUnits / Math.max(1, r.totalUnits)) * 100));
      let statusHtml = `<span class="thw-status-pill is-missing">Chưa bắt đầu</span>`;
      if (r.completed) statusHtml = '<span class="thw-status-pill is-done">✓ Đã nộp</span>';
      else if (r.lock) {
        statusHtml = `<div class="ts-lock-item">
          <span class="ts-lock-item-meta">🔒 <span class="ts-lock-time" data-ts-lock-until="${r.lock.until}">${formatMmSs(r.lock.remainingMs)}</span></span>
          <button type="button" class="ts-btn-unlock-one" onclick="TeacherStudio.unlockStudentTask('${esc(r.student.id)}', '${esc(r.lock.lockKey)}')">Mở khóa</button>
        </div>`;
      } else if (r.bucket === 'progress') {
        statusHtml = `<span class="thw-status-pill is-progress">${esc(r.progressLabel)}</span>`;
      }

      const timeStr = r.updatedAt ? formatDeadlineTs(r.updatedAt) : '—';
      const durStr = r.rec?.durationSec ? ` · ${formatDurationCompact(r.rec.durationSec)}` : '';
      const remKey = `${taskObj.id}::${r.student.id}`;
      const isCopied = state.remindedKeys.has(remKey);

      return `
        <tr class="thw-row is-${r.bucket}">
          <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}">${esc(monogram(r.student.name))}</span><strong>${esc(r.student.name)}</strong></div></td>
          <td><div class="thw-vocab-cell"><div class="thw-vocab-bar"><div class="thw-vocab-fill ${pct >= 100 ? 'is-full' : ''}" style="width:${pct}%;"></div></div><span class="thw-vocab-num tabular">${r.doneUnits}/${r.totalUnits}</span></div></td>
          <td>${statusHtml}</td>
          <td class="tabular"><strong>${esc(r.scoreLabel || '—')}</strong></td>
          <td class="tabular">${esc(timeStr)}${esc(durStr)}</td>
          <td>${r.completed ? '<span class="thw-muted">—</span>' : `<button type="button" class="btn-subtle thw-remind-btn ${isCopied ? 'is-copied' : ''}" onclick="TeacherStudio.copyStudentReminder('${esc(taskObj.id)}', '${esc(r.student.id)}')">${isCopied ? '✓ Đã copy' : 'Nhắc Zalo'}</button>`}</td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" style="text-align:center; padding:18px; color:var(--ink-3);">Không có học viên nào trong mục lọc này.</td></tr>';

    bodyEl.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; margin-bottom:12px;">
        <div class="thw-filters-row">
          ${chips.map((c) => `<button type="button" class="thw-filter-chip ${state.detailFilter === c.key ? 'active' : ''}" onclick="TeacherStudio.setDetailFilter('${c.key}')">${c.label}</button>`).join('')}
        </div>
        <button type="button" class="btn-subtle thw-act-btn" onclick="TeacherStudio.copyGroupReminder('${esc(taskObj.id)}', ${isExpired})">${isExpired ? 'Copy DS nhóm' : 'Copy gửi nhóm'}</button>
      </div>
      <div class="teacher-hw-table-wrap">
        <table class="teacher-hw-table">
          <thead><tr><th>Học viên</th><th>Tiến độ</th><th>Trạng thái</th><th>Kết quả</th><th>Cập nhật</th><th>Nhắc Zalo</th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    `;
  }

  function openTaskDetailModal(taskId, filter = 'all') {
    const tid = normalizeAnyTaskId(taskId);
    if (!tid || !getTaskById(tid)) return;
    state.detailTaskId = tid;
    state.detailFilter = filter || 'all';
    renderDetailModalBody();
    document.getElementById('modal-teacher-task-detail')?.classList.add('open');
  }

  /* =========================================================
     9B. WEEKLY 4-SKILL COMPLETION REPORT MODAL (1% - 100%)
     ========================================================= */
  function getAvailableWeeklyBatches(nowMs = Date.now()) {
    const stored = loadWeeklyBatches();
    const list = Object.values(stored)
      .filter((b) => b && Array.isArray(b.taskIds) && b.taskIds.length > 0)
      .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));

    // Also synthesize a "Tất cả bài đang giao / hết hạn gần nhất" batch if not already represented or as fallback
    const buckets = getMonitorBuckets(nowMs);
    const monitorIds = [...buckets.activeList, ...buckets.expiredList].map((x) => x.task.id);
    const curWeekKey = computeWeekKeyFromDate(new Date(nowMs));
    const curTitle = computeAutoWeeklyTitle(new Date(nowMs));

    if (!list.length) {
      return [{
        weekKey: '__monitor__',
        title: curTitle,
        taskIds: monitorIds,
        isFallback: true,
        label: `${curTitle} (${monitorIds.length} bài đang theo dõi)`,
      }];
    }

    const out = list.map((b) => ({
      ...b,
      label: `${b.title || b.weekKey} (${b.taskIds.length} bài)`,
    }));
    if (monitorIds.length && !out.some((b) => b.weekKey === curWeekKey)) {
      out.unshift({
        weekKey: '__monitor__',
        title: curTitle,
        taskIds: monitorIds,
        isFallback: true,
        label: `Bài đang theo dõi · ${curTitle} (${monitorIds.length} bài)`,
      });
    }
    return out;
  }

  function computeWeeklyReportMetrics(taskIds, nowMs = Date.now()) {
    const students = B()?.getStudentAccounts?.() || [];
    const tasks = (taskIds || []).map(getTaskById).filter(Boolean);
    const bySkill = { listening: [], speaking: [], reading: [], writing: [] };
    tasks.forEach((t) => {
      if (bySkill[t.skill]) bySkill[t.skill].push(t);
    });

    const studentStats = students.map((st) => {
      const skills = {};
      let assignedSkills = 0;
      let pctSum = 0;
      REPORT_4_SKILLS.forEach((sk) => {
        const list = bySkill[sk.key];
        const total = list.length;
        const done = total ? list.filter((t) => getStudentHomeworkRow(t, st, nowMs).completed).length : 0;
        const pct = total ? Math.round((done / total) * 100) : null;
        skills[sk.key] = { done, total, pct };
        if (pct !== null) {
          assignedSkills += 1;
          pctSum += pct;
        }
      });
      const avgPct = assignedSkills ? Math.round(pctSum / assignedSkills) : null;
      return { student: st, skills, avgPct };
    });

    const classSkills = {};
    REPORT_4_SKILLS.forEach((sk) => {
      const list = bySkill[sk.key];
      const totalTasks = list.length;
      const totalSlots = totalTasks * students.length;
      const doneSlots = totalSlots
        ? studentStats.reduce((acc, s) => acc + s.skills[sk.key].done, 0)
        : 0;
      const pct = totalSlots ? Math.round((doneSlots / totalSlots) * 100) : null;
      classSkills[sk.key] = { totalTasks, doneSlots, totalSlots, pct };
    });

    return { tasks, bySkill, students, studentStats, classSkills };
  }

  function formatReportPctValue(pct) {
    return pct === null ? 'Chưa giao' : `${pct}%`;
  }

  function buildWeeklyReportText(titleRaw, metrics, opts = {}) {
    const title = String(titleRaw || computeAutoWeeklyTitle(new Date())).trim().toUpperCase();
    const mode = opts.mode || state.reportMode;
    const includeName = opts.includeName ?? state.reportIncludeName;
    const includeDetails = opts.includeDetails ?? state.reportIncludeClassDetails;

    if (mode === 'student') {
      const stRow = metrics.studentStats.find((s) => String(s.student.id) === String(opts.studentId || state.reportStudentId))
        || metrics.studentStats[0]
        || null;
      const lines = [`BÁO CÁO BÀI TẬP HOÀN THÀNH ${title}`];
      if (includeName && stRow) lines.push(`Học viên: ${stRow.student.name}`);
      lines.push('Tỉ lệ hoàn thành (thang đo 1% - 100% theo số bài)');
      REPORT_4_SKILLS.forEach((sk) => {
        const pct = stRow ? stRow.skills[sk.key].pct : null;
        lines.push(`${sk.num}- ${sk.label}: ${formatReportPctValue(pct)}`);
      });
      return lines.join('\n');
    }

    const lines = [
      `BÁO CÁO BÀI TẬP HOÀN THÀNH ${title}`,
      'Tỉ lệ hoàn thành (thang đo 1% - 100% theo số bài)',
    ];
    REPORT_4_SKILLS.forEach((sk) => {
      lines.push(`${sk.num}- ${sk.label}: ${formatReportPctValue(metrics.classSkills[sk.key].pct)}`);
    });
    if (includeDetails && metrics.studentStats.length) {
      lines.push('');
      lines.push('Chi tiết từng học viên:');
      metrics.studentStats.forEach((s) => {
        const parts = REPORT_4_SKILLS.map((sk) => `${sk.label} ${formatReportPctValue(s.skills[sk.key].pct)}`);
        lines.push(`• ${s.student.name}: ${parts.join(' · ')}`);
      });
    }
    return lines.join('\n');
  }

  function renderPctPillHtml(info) {
    if (!info || info.pct === null) {
      return '<span class="ts-wr-pct is-none">—</span>';
    }
    const cls = info.pct >= 100 ? 'is-full' : (info.pct > 0 ? 'is-mid' : 'is-zero');
    const sub = info.total > 1 ? ` <small style="opacity:.75;font-weight:650;">(${info.done}/${info.total})</small>` : '';
    return `<span class="ts-wr-pct tabular ${cls}">${info.pct}%${sub}</span>`;
  }

  function ensureWeeklyReportModal() {
    let ov = document.getElementById('modal-teacher-weekly-report');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = 'modal-teacher-weekly-report';
    ov.className = 'modal-overlay';
    ov.style.zIndex = '2550';
    ov.onclick = (e) => { if (e.target === ov) ov.classList.remove('open'); };
    ov.innerHTML = `
      <div class="modal-card ts-wr-modal-card" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div>
            <div class="modal-title" style="font-size:17px;">Báo Cáo Bài Tập Hoàn Thành Theo Tuần</div>
            <div id="ts-wr-subtitle" style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">Thang đo 1% - 100% theo số bài giao của 4 kỹ năng (Nghe · Nói · Đọc · Viết)</div>
          </div>
          <button type="button" class="btn-icon-glass" style="width:32px;height:32px;" onclick="document.getElementById('modal-teacher-weekly-report')?.classList.remove('open')" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body ts-wr-body" id="ts-wr-body"></div>
      </div>
    `;
    document.body.appendChild(ov);
    return ov;
  }

  function renderWeeklyReportModal() {
    const bodyEl = document.getElementById('ts-wr-body');
    if (!bodyEl) return;
    const nowMs = Date.now();
    const batches = getAvailableWeeklyBatches(nowMs);
    let activeBatch = batches.find((b) => b.weekKey === state.reportBatchKey) || batches[0];
    state.reportBatchKey = activeBatch.weekKey;
    if (!state.reportCustomTitle) {
      state.reportCustomTitle = activeBatch.title || computeAutoWeeklyTitle(new Date(nowMs));
    }

    const metrics = computeWeeklyReportMetrics(activeBatch.taskIds, nowMs);
    if (!state.reportStudentId || !metrics.studentStats.some((s) => String(s.student.id) === String(state.reportStudentId))) {
      state.reportStudentId = metrics.studentStats[0]?.student?.id || '';
    }

    const previewText = buildWeeklyReportText(state.reportCustomTitle, metrics);
    const previewRows = Math.min(14, Math.max(6, previewText.split('\n').length + 1));

    const kpiHtml = REPORT_4_SKILLS.map((sk) => {
      const c = metrics.classSkills[sk.key];
      const val = c.pct === null ? '—' : `${c.pct}%`;
      const sub = c.totalTasks ? `${c.totalTasks} bài · ${c.doneSlots}/${c.totalSlots} lượt nộp` : 'Chưa giao bài tuần này';
      return `
        <div class="ts-wr-kpi is-${sk.key}">
          <span class="ts-wr-kpi-lbl">${sk.num}- ${sk.label}</span>
          <span class="ts-wr-kpi-val tabular">${val}</span>
          <span class="ts-wr-kpi-sub tabular">${esc(sub)}</span>
        </div>
      `;
    }).join('');

    const rowsHtml = metrics.studentStats.map((s, idx) => {
      const isSel = state.reportMode === 'student' && String(s.student.id) === String(state.reportStudentId);
      return `
        <tr class="${isSel ? 'is-selected' : ''}" onclick="TeacherStudio.selectWeeklyReportStudent('${esc(s.student.id)}')">
          <td>
            <div class="teacher-student-cell">
              <span class="board-avatar tone-${idx % 4}">${esc(monogram(s.student.name))}</span>
              <strong>${esc(s.student.name)}</strong>
            </div>
          </td>
          <td>${renderPctPillHtml(s.skills.listening)}</td>
          <td>${renderPctPillHtml(s.skills.speaking)}</td>
          <td>${renderPctPillHtml(s.skills.reading)}</td>
          <td>${renderPctPillHtml(s.skills.writing)}</td>
          <td onclick="event.stopPropagation()">
            <button type="button" class="btn-subtle ts-wr-copy-btn" onclick="TeacherStudio.copyWeeklyReportForStudent('${esc(s.student.id)}')" title="Copy báo cáo Zalo cho ${esc(s.student.name)}">Copy</button>
          </td>
        </tr>
      `;
    }).join('') || '<tr><td colspan="6" style="text-align:center; padding:16px; color:var(--ink-3);">Chưa có dữ liệu học viên.</td></tr>';

    const optCheckHtml = state.reportMode === 'student'
      ? `<label class="ts-empty-sec-toggle"><input type="checkbox" ${state.reportIncludeName ? 'checked' : ''} onchange="TeacherStudio.setWeeklyReportOption('includeName', this.checked)"><span>Kèm tên học viên</span></label>`
      : `<label class="ts-empty-sec-toggle"><input type="checkbox" ${state.reportIncludeClassDetails ? 'checked' : ''} onchange="TeacherStudio.setWeeklyReportOption('includeDetails', this.checked)"><span>Kèm chi tiết từng bạn</span></label>`;

    bodyEl.innerHTML = `
      <div class="ts-wr-toolbar">
        <div class="ts-wr-toolbar-left">
          <select class="scope-select" id="ts-wr-batch-sel" onchange="TeacherStudio.setWeeklyReportBatch(this.value)" title="Chọn tuần giao bài">
            ${batches.map((b) => `<option value="${esc(b.weekKey)}" ${b.weekKey === activeBatch.weekKey ? 'selected' : ''}>${esc(b.label)}</option>`).join('')}
          </select>
          <input type="text" class="task-link-input ts-wr-title-inp" id="ts-wr-title-input" value="${esc(state.reportCustomTitle)}" placeholder="VD: THÁNG 11 TUẦN 2" oninput="TeacherStudio.setWeeklyReportTitle(this.value)">
        </div>
        <div class="ts-mode-seg" role="tablist" aria-label="Phạm vi báo cáo tuần">
          <button type="button" class="ts-mode-btn ${state.reportMode === 'student' ? 'active' : ''}" onclick="TeacherStudio.setWeeklyReportMode('student')">Từng học viên</button>
          <button type="button" class="ts-mode-btn ${state.reportMode === 'class' ? 'active' : ''}" onclick="TeacherStudio.setWeeklyReportMode('class')">Cả lớp</button>
        </div>
      </div>

      <div class="ts-wr-kpi-grid">${kpiHtml}</div>

      <div class="ts-wr-split">
        <div class="ts-wr-table-wrap">
          <table class="ts-wr-table">
            <thead>
              <tr>
                <th>Học viên (bấm chọn)</th>
                <th>Nghe</th>
                <th>Nói</th>
                <th>Đọc</th>
                <th>Viết</th>
                <th style="text-align:right;">Zalo</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>

        <div class="ts-wr-preview-wrap">
          <div class="ts-wr-preview-head">
            <span class="ts-wr-preview-lbl">Mẫu Zalo ${state.reportMode === 'student' ? '(học viên đang chọn)' : '(cả lớp)'}</span>
            <div class="ts-wr-preview-opts">
              ${optCheckHtml}
              <button type="button" class="btn btn-primary ts-wr-copy-btn" onclick="TeacherStudio.copyWeeklyReportPreview()">Copy báo cáo Zalo</button>
            </div>
          </div>
          <textarea class="task-link-input ts-zalo-preview" id="ts-wr-preview-box" rows="${previewRows}">${esc(previewText)}</textarea>
        </div>
      </div>
    `;
  }

  function openWeeklyReportModal() {
    if (!B()?.isTeacherUser?.()) return;
    state.reportCustomTitle = '';
    const ov = ensureWeeklyReportModal();
    renderWeeklyReportModal();
    ov.classList.add('open');
  }

  function copyWeeklyReportForStudent(studentId) {
    const nowMs = Date.now();
    const batches = getAvailableWeeklyBatches(nowMs);
    const activeBatch = batches.find((b) => b.weekKey === state.reportBatchKey) || batches[0];
    const metrics = computeWeeklyReportMetrics(activeBatch.taskIds, nowMs);
    const st = metrics.studentStats.find((s) => String(s.student.id) === String(studentId));
    if (!st) return;
    state.reportMode = 'student';
    state.reportStudentId = st.student.id;
    const txt = buildWeeklyReportText(state.reportCustomTitle || activeBatch.title, metrics, {
      mode: 'student',
      studentId: st.student.id,
      includeName: state.reportIncludeName,
    });
    copySafe(txt, () => {
      B()?.showToast?.(`Đã copy báo cáo tuần của ${shortName(st.student.name)} — dán thẳng vào Zalo!`);
      renderWeeklyReportModal();
    });
  }

  function copyWeeklyReportPreview() {
    const txt = (document.getElementById('ts-wr-preview-box')?.value || '').trim();
    if (!txt) return;
    copySafe(txt, () => {
      B()?.showToast?.('Đã copy báo cáo bài tập hoàn thành theo tuần — dán thẳng vào Zalo!');
    });
  }

  /* =========================================================
     10. LIVE 1-SECOND TICKER FOR LOCKS & DEADLINES
     ========================================================= */
  function ensureTicker() {
    clearInterval(state.tickerId);
    state.tickerId = null;
    const screen = document.getElementById('screen-teacher');
    if (!screen) return;
    const hasNodes = screen.querySelector('[data-ts-dl-task], [data-ts-lock-until]') || document.querySelector('#modal-teacher-task-detail.open [data-ts-lock-until]');
    if (!hasNodes) return;

    state.tickerId = setInterval(() => {
      const sc = document.getElementById('screen-teacher');
      if (!sc || !sc.classList.contains('active')) {
        clearInterval(state.tickerId);
        state.tickerId = null;
        return;
      }
      const now = Date.now();
      const liveMap = loadLiveDeadlines();
      sc.querySelectorAll('[data-ts-dl-task]').forEach((el) => {
        const tid = el.getAttribute('data-ts-dl-task');
        const dlAt = Number(liveMap[tid]?.deadlineAt || 0);
        if (!dlAt) return;
        const rem = dlAt - now;
        if (rem > 0) {
          el.classList.remove('is-ended');
          el.textContent = el.classList.contains('ts-hw-dl') ? `Còn ${formatDeadlineRemaining(rem)}` : `Còn ${formatDeadlineRemaining(rem)}`;
        } else {
          el.classList.add('is-ended');
          el.textContent = el.classList.contains('ts-hw-dl') ? `Đã đóng · ${formatDeadlineTs(dlAt)}` : 'Hết hạn';
        }
      });
      document.querySelectorAll('[data-ts-lock-until]').forEach((el) => {
        const until = Number(el.getAttribute('data-ts-lock-until') || 0);
        const rem = until - now;
        el.textContent = rem > 0 ? formatMmSs(rem) : '00:00';
      });
    }, 1000);
  }

  /* =========================================================
     11. MASTER RENDER + PREVIEW + MULTI-SKILL STUDENT URL HANDLER
     ========================================================= */
  function syncWorkspaceTabsUi(buckets, nowMs) {
    const activeTab = ['students', 'monitor', 'assign'].includes(state.activeTab) ? state.activeTab : 'students';
    document.querySelectorAll('#ts-ws-nav .ts-ws-tab').forEach((btn) => {
      const isAct = btn.getAttribute('data-ts-tab') === activeTab;
      btn.classList.toggle('active', isAct);
      btn.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
    document.querySelectorAll('#screen-teacher .ts-tab-pane').forEach((pane) => {
      const isAct = pane.getAttribute('data-ts-pane') === activeTab;
      pane.classList.toggle('is-active', isAct);
    });

    // Live badge updates
    const students = B()?.getStudentAccounts?.() || [];
    const lockedCount = students.filter((st) => readStudentAllLocks(st.id, nowMs).length > 0).length;
    const stuBadge = document.getElementById('ts-badge-students');
    if (stuBadge) {
      stuBadge.textContent = lockedCount > 0 ? `${lockedCount} khóa` : String(students.length);
      stuBadge.classList.toggle('is-danger', lockedCount > 0);
    }
    const monBadge = document.getElementById('ts-badge-monitor');
    if (monBadge && buckets) {
      monBadge.textContent = String((buckets.activeList || []).length);
    }
    const asgBadge = document.getElementById('ts-badge-assign');
    if (asgBadge) {
      const sel = state.selectedIds.size;
      asgBadge.textContent = String(sel);
      asgBadge.style.display = sel > 0 ? '' : 'none';
    }
  }

  function setWorkspaceTab(tab) {
    const next = ['students', 'monitor', 'assign'].includes(tab) ? tab : 'students';
    state.activeTab = next;
    try { localStorage.setItem(WORKSPACE_TAB_KEY, next); } catch (_) {}
    toggleToolsMenu(false);
    syncWorkspaceTabsUi(getMonitorBuckets(Date.now()), Date.now());
  }

  function toggleToolsMenu(force) {
    const next = typeof force === 'boolean' ? force : !state.toolsMenuOpen;
    state.toolsMenuOpen = next;
    const pop = document.getElementById('ts-tools-pop');
    const trig = document.getElementById('ts-tools-trigger');
    if (pop) pop.classList.toggle('open', next);
    if (trig) trig.setAttribute('aria-expanded', next ? 'true' : 'false');
  }

  document.addEventListener('click', (e) => {
    if (!state.toolsMenuOpen) return;
    const wrap = document.getElementById('ts-tools-wrap');
    if (wrap && !wrap.contains(e.target)) toggleToolsMenu(false);
  });

  function renderDashboard() {
    if (!B()?.isTeacherUser?.()) return;
    const clsInfo = B()?.getActiveClassInfo?.();
    const titleEl = document.querySelector('#screen-teacher .ts-cmd-title');
    if (titleEl) {
      titleEl.textContent = clsInfo?.name ? `Quản Lý · ${clsInfo.name}` : 'Quản Lý Lớp Học';
    }
    const nowMs = Date.now();
    const buckets = getMonitorBuckets(nowMs);
    renderRosterSection(nowMs, buckets.activeList);
    renderMonitorSection(nowMs, buckets);
    renderPickerSection(nowMs);
    syncWorkspaceTabsUi(buckets, nowMs);
    ensureTicker();
  }

  function previewSkillTask(skillKey, taskId) {
    if (typeof window.toggleTeacherStudyPreview === 'function') {
      window.toggleTeacherStudyPreview(true);
    }
    const pm = parsePracticeTaskId(taskId);
    if (pm) {
      openStudentSkillTask(taskId);
      return;
    }
    if (skillKey === 'listening') {
      window.TotoroUI?.enterSkillMode?.('Listening', 'task');
      setTimeout(() => window.ListeningTasksModule?.openTaskBrief?.(taskId), 120);
    } else if (skillKey === 'writing') {
      window.TotoroUI?.enterSkillMode?.('Writing', 'task');
      setTimeout(() => window.WritingStudio?.openTask?.(taskId), 120);
    } else if (skillKey === 'speaking') {
      window.TotoroUI?.enterSkillMode?.('Speaking', 'task');
    } else if (skillKey === 'reading') {
      window.TotoroUI?.enterSkillMode?.('Reading', 'task');
      setTimeout(() => window.TasksModule?.openTaskBriefModal?.(taskId), 120);
    }
  }

  function getTaskDeadlineInfo(rawTaskId) {
    const tid = normalizeAnyTaskId(rawTaskId);
    if (!tid) return { hasDeadline: false, deadlineAt: 0, remainingMs: 0, expired: false, formattedAt: '', remainingText: '' };
    const candidates = [];
    const live = loadLiveDeadlines()[tid];
    if (live && typeof live === 'object') candidates.push(live);
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const urlIds = [];
      const single = sp.get('task') || sp.get('wtask');
      const multi = sp.get('tasks');
      if (single) urlIds.push(normalizeAnyTaskId(single));
      if (multi) multi.split(',').map(normalizeAnyTaskId).filter(Boolean).forEach((x) => { if (!urlIds.includes(x)) urlIds.push(x); });
      if (urlIds.includes(tid)) {
        const rawDl = Number(sp.get('deadline') || sp.get('due') || 0);
        const rawIss = Number(sp.get('issued') || 0);
        if (Number.isFinite(rawDl) && rawDl > 1e11) {
          candidates.push({ deadlineAt: rawDl, issuedAt: rawIss });
        }
      }
    } catch (_) {}
    if (!candidates.length) {
      return { hasDeadline: false, deadlineAt: 0, remainingMs: 0, expired: false, formattedAt: '', remainingText: '' };
    }
    candidates.sort((a, b) => Number(b.issuedAt || 0) - Number(a.issuedAt || 0));
    const chosen = candidates[0];
    const deadlineAt = Number(chosen.deadlineAt || 0);
    if (!Number.isFinite(deadlineAt) || deadlineAt <= 0) {
      return { hasDeadline: false, deadlineAt: 0, remainingMs: 0, expired: false, formattedAt: '', remainingText: '' };
    }
    const remainingMs = Math.max(0, deadlineAt - Date.now());
    return {
      hasDeadline: true,
      deadlineAt,
      remainingMs,
      expired: remainingMs <= 0,
      formattedAt: formatDeadlineTs(deadlineAt),
      remainingText: formatDeadlineRemaining(remainingMs),
    };
  }

  function openStudentSkillTask(taskId) {
    const cleanId = normalizeAnyTaskId(taskId);
    const pm = parsePracticeTaskId(cleanId);
    document.getElementById('modal-student-combo-tasks')?.remove();
    closeAllAssignedHomeworkModal();
    if (pm) {
      if (pm.skill === 'reading') {
        window.ReadingPracticeApp?.openAssignedItem?.(pm.itemId, pm.isFull, pm.mode);
      } else if (pm.skill === 'listening') {
        window.ListeningPracticeApp?.openAssignedItem?.(pm.itemId, pm.isFull, pm.mode);
      } else if (pm.skill === 'writing') {
        window.TotoroUI?.enterSkillMode?.('Writing', 'practice');
        setTimeout(() => {
          if (pm.isFull) window.WritingStudio?.startFullWritingTest?.(pm.itemId, pm.mode);
          else window.WritingStudio?.startPracticePrompt?.(pm.itemId, pm.mode);
        }, 160);
      } else if (pm.skill === 'speaking') {
        window.TotoroUI?.enterSkillMode?.('Speaking', 'practice');
        setTimeout(() => window.SpeakingStudio?.openPracticeRoom?.(pm.itemId, pm.mode), 160);
      }
      return;
    }
    const taskObj = getTaskById(cleanId);
    if (!taskObj) return;
    if (taskObj.skill === 'reading') {
      window.TotoroUI?.enterSkillMode?.('Reading', 'task');
      setTimeout(() => window.TasksModule?.openTaskBriefModal?.(taskObj.id), 120);
    } else if (taskObj.skill === 'listening') {
      window.TotoroUI?.enterSkillMode?.('Listening', 'task');
      setTimeout(() => window.ListeningTasksModule?.openTaskBrief?.(taskObj.id), 120);
    } else if (taskObj.skill === 'writing') {
      window.TotoroUI?.enterSkillMode?.('Writing', 'task');
      setTimeout(() => window.WritingStudio?.openTask?.(taskObj.id), 120);
    } else if (taskObj.skill === 'speaking') {
      window.TotoroUI?.enterSkillMode?.('Speaking', 'task');
    }
  }

  /* =========================================================
     QUICK ASSIGN MODAL (Triggered right from Cambridge/Volume/Actual/Writing cards!)
     ========================================================= */
  function computeQuickAssignDeadlineMs(presetVal, customVal, nowTs = Date.now()) {
    if (!presetVal || presetVal === '0') return 0;
    if (presetVal === 'tonight_24') {
      const d = new Date(nowTs);
      d.setHours(23, 59, 59, 0);
      return d.getTime() > nowTs ? d.getTime() : (nowTs + 60 * 60 * 1000);
    }
    if (presetVal === 'tomorrow_24') {
      const d = new Date(nowTs);
      d.setDate(d.getDate() + 1);
      d.setHours(23, 59, 59, 0);
      return d.getTime();
    }
    if (presetVal === 'custom') {
      if (!customVal) return 0;
      const ts = new Date(customVal).getTime();
      return (Number.isFinite(ts) && ts > nowTs) ? ts : 0;
    }
    const mins = Number(presetVal || 0);
    return (Number.isFinite(mins) && mins > 0) ? (nowTs + mins * 60 * 1000) : 0;
  }

  function updateQuickAssignPreview() {
    const ctx = state.quickAssignCtx;
    if (!ctx) return;
    const mode = document.querySelector('#modal-practice-assign [data-qa-mode].active')?.getAttribute('data-qa-mode') || 'practice';
    const isLiveMode = mode === 'live' && ctx.skill === 'reading';
    const dlRow = document.getElementById('qa-dl-row');
    if (dlRow) dlRow.style.display = isLiveMode ? 'none' : '';
    const preset = isLiveMode ? '0' : (document.getElementById('qa-dl-preset')?.value || '0');
    const customEl = document.getElementById('qa-dl-custom');
    if (customEl) customEl.style.display = (!isLiveMode && preset === 'custom') ? 'block' : 'none';

    const nowTs = Date.now();
    const dlMs = isLiveMode ? 0 : computeQuickAssignDeadlineMs(preset, customEl?.value || '', nowTs);
    const taskId = isLiveMode ? '' : buildPracticeTaskId(ctx.skill, ctx.itemId, ctx.isFull, mode);

    let msg = '';
    if (isLiveMode) {
      if (!ctx.liveRoomId) {
        ctx.liveRoomId = window.LiveReadingRoom?.generateRoomId?.() || ('rp' + Date.now().toString(36).slice(-6));
      }
      msg = window.LiveReadingRoom?.buildShareUrl
        ? window.LiveReadingRoom.buildShareUrl(ctx.liveRoomId, ctx.itemId, ctx.isFull)
        : `${buildBaseUrl()}?live=${encodeURIComponent(ctx.liveRoomId)}&p=${encodeURIComponent(ctx.itemId)}${ctx.isFull ? '&full=1' : ''}`;
    } else if (dlMs <= 0) {
      // Clean direct link only — no deadline, no DAILY HOMEWORK wrapper!
      msg = `${buildBaseUrl()}?task=${encodeURIComponent(taskId)}`;
    } else {
      msg = buildDailyHomeworkMessage([taskId], dlMs, nowTs, nowTs);
    }

    const prevLbl = document.getElementById('qa-preview-lbl');
    if (prevLbl) {
      prevLbl.textContent = isLiveMode
        ? 'Link phòng làm chung Live (giống Google Docs)'
        : (dlMs <= 0 ? 'Link trực tiếp (không đặt hạn)' : 'Mẫu gửi Zalo có hạn nộp (tự tạo)');
    }
    const copyBtn = document.getElementById('qa-copy-btn');
    if (copyBtn) {
      copyBtn.textContent = isLiveMode
        ? '🔗 Copy link & Vào phòng Live'
        : (dlMs <= 0 ? '🔗 Copy link ngay' : '🔗 Copy link giao bài');
    }
    const basketBtn = document.getElementById('qa-basket-btn');
    if (basketBtn) basketBtn.style.display = isLiveMode ? 'none' : '';

    const prevEl = document.getElementById('qa-preview-box');
    if (prevEl) prevEl.value = msg;
    return { taskId, dlMs, issuedAt: nowTs, msg, mode, isLiveMode, liveRoomId: ctx.liveRoomId || '' };
  }

  function openPracticeAssignModal(opts = {}) {
    if (!opts.itemId) return;
    state.quickAssignCtx = {
      skill: opts.skill || 'reading',
      itemId: String(opts.itemId),
      isFull: Boolean(opts.isFull),
      title: String(opts.title || opts.itemId),
      subtitle: String(opts.subtitle || ''),
      liveRoomId: ''
    };
    document.getElementById('modal-practice-assign')?.remove();
    const sm = skillMeta(state.quickAssignCtx.skill);
    const isReading = state.quickAssignCtx.skill === 'reading';
    const ov = document.createElement('div');
    ov.id = 'modal-practice-assign';
    ov.className = 'modal-overlay open';
    ov.style.zIndex = '2600';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `
      <div class="modal-card ts-qa-card" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div>
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
              <span class="ts-skill-pill is-${esc(sm.key)}">${esc(sm.label.toUpperCase())} PRACTICE</span>
              ${state.quickAssignCtx.subtitle ? `<span style="font-size:12px;color:var(--ink-3);font-weight:700;">${esc(state.quickAssignCtx.subtitle)}</span>` : ''}
            </div>
            <div class="modal-title" style="font-size:16px;">Lấy link bài · ${esc(state.quickAssignCtx.title)}</div>
          </div>
          <button type="button" class="btn-icon-glass" style="width:32px;height:32px;" onclick="document.getElementById('modal-practice-assign')?.remove()" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body ts-qa-body">
          <div class="ts-qa-row">
            <label class="ts-qa-lbl">Chế độ mở bài</label>
            <div class="ts-qa-seg" ${isReading ? 'style="grid-template-columns:repeat(3,minmax(0,1fr));"' : ''}>
              <button type="button" class="ts-qa-seg-btn active" data-qa-mode="practice" onclick="TeacherStudio.setQuickAssignMode('practice')">Luyện tập</button>
              <button type="button" class="ts-qa-seg-btn" data-qa-mode="exam" onclick="TeacherStudio.setQuickAssignMode('exam')">Thi thật</button>
              ${isReading ? `<button type="button" class="ts-qa-seg-btn" data-qa-mode="live" onclick="TeacherStudio.setQuickAssignMode('live')">Làm chung Live</button>` : ''}
            </div>
          </div>
          <div class="ts-qa-row" id="qa-dl-row">
            <label class="ts-qa-lbl" for="qa-dl-preset">Hạn nộp bài (tùy chọn)</label>
            <select id="qa-dl-preset" class="ts-qa-select" onchange="TeacherStudio.updateQuickAssignPreview()">
              <option value="0" selected>Không đặt hạn (chỉ copy link trực tiếp)</option>
              <option value="120">2 giờ tới</option>
              <option value="tonight_24">Cuối ngày hôm nay (23:59)</option>
              <option value="tomorrow_24">Cuối ngày mai (23:59)</option>
              <option value="custom">Tự chọn ngày giờ...</option>
            </select>
            <input type="datetime-local" id="qa-dl-custom" class="ts-qa-select" style="display:none;margin-top:6px;" onchange="TeacherStudio.updateQuickAssignPreview()">
          </div>
          <div class="ts-qa-row">
            <label class="ts-qa-lbl" id="qa-preview-lbl" for="qa-preview-box">Link trực tiếp (không đặt hạn)</label>
            <textarea id="qa-preview-box" class="ts-qa-preview" rows="2" readonly onclick="this.select()"></textarea>
          </div>
          <div class="ts-qa-acts">
            <button type="button" class="tot-demo-btn" id="qa-basket-btn" onclick="TeacherStudio.addQuickAssignToBasket()">+ Thêm vào Giỏ combo</button>
            <button type="button" class="btn btn-primary tot-demo-btn" id="qa-copy-btn" onclick="TeacherStudio.copyQuickAssignLink()">🔗 Copy link ngay</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
    updateQuickAssignPreview();
  }

  function setQuickAssignMode(mode) {
    document.querySelectorAll('#modal-practice-assign [data-qa-mode]').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-qa-mode') === mode);
    });
    updateQuickAssignPreview();
  }

  function copyQuickAssignLink() {
    const info = updateQuickAssignPreview();
    if (!info || !info.msg) return;
    if (info.isLiveMode) {
      const ctx = state.quickAssignCtx;
      copySafe(info.msg, () => {
        document.getElementById('modal-practice-assign')?.remove();
        window.ReadingPracticeApp?.openLiveRoom?.(info.liveRoomId, ctx.itemId, !!ctx.isFull, '');
        B()?.showToast?.('Đã copy link phòng Live — gửi cho học sinh để cùng vào ngay!');
      });
      return;
    }
    if (info.dlMs > 0) {
      updateLiveDeadlines([info.taskId], info.dlMs);
      saveSentTasks([info.taskId]);
    }
    copySafe(info.msg, () => {
      B()?.showToast?.(info.dlMs > 0 ? 'Đã copy link giao bài Zalo & lưu vào danh sách Đang giao!' : 'Đã copy link bài làm trực tiếp!');
      document.getElementById('modal-practice-assign')?.remove();
    });
  }

  function addQuickAssignToBasket() {
    const info = updateQuickAssignPreview();
    if (!info) return;
    state.selectedIds.add(info.taskId);
    B()?.showToast?.(`Đã thêm vào Giỏ combo (${state.selectedIds.size} bài) — mở Bảng Giáo viên để copy gộp Zalo!`);
    document.getElementById('modal-practice-assign')?.remove();
  }

  function openStudentComboModal(taskIds, deadlineMs = 0) {
    const tasks = taskIds.map(getTaskById).filter(Boolean);
    if (!tasks.length) return;
    if (tasks.length === 1) {
      openStudentSkillTask(tasks[0].id);
      return;
    }
    document.getElementById('modal-student-combo-tasks')?.remove();
    const curUser = B()?.getCurrentUser?.();
    const nowMs = Date.now();
    const dlNote = deadlineMs > nowMs
      ? `Hạn nộp: còn ${formatDeadlineRemaining(deadlineMs - nowMs)} (đóng ${formatDeadlineTs(deadlineMs)})`
      : (deadlineMs > 0 ? `Đã hết hạn lúc ${formatDeadlineTs(deadlineMs)}` : 'Không giới hạn thời gian');

    const rowsHtml = tasks.map((t) => {
      const sm = skillMeta(t.skill);
      const row = curUser ? getStudentHomeworkRow(t, curUser, nowMs) : null;
      const done = Boolean(row?.completed);
      const locked = Boolean(row?.lock);
      const badge = done
        ? '<span class="thw-status-pill is-done">✓ Đã nộp</span>'
        : (locked ? `<span class="ts-skill-pill" style="background:var(--ts-danger-bg);color:var(--ts-danger);border-color:var(--ts-danger-bd);">🔒 Khóa ${formatMmSs(row.lock.remainingMs)}</span>` : '<span class="thw-status-pill is-missing">Chưa xong</span>');
      return `
        <div class="ts-combo-item is-${esc(t.skill)}">
          <div style="min-width:0; flex:1;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:3px;">
              <span class="ts-skill-pill is-${esc(t.skill)}">${esc(sm.label.toUpperCase())}</span>
              <strong style="font-size:13px;">${esc(t.code)}</strong>
              ${badge}
            </div>
            <div style="font-size:12.5px; color:var(--ink-2);">${esc(t.theme)}</div>
          </div>
          <button type="button" class="btn btn-primary" style="padding:7px 13px; font-size:12.5px; flex-shrink:0;" onclick="TeacherStudio.openStudentSkillTask('${esc(t.id)}')">
            ${done ? 'Xem lại' : 'Vào làm →'}
          </button>
        </div>
      `;
    }).join('');

    const ov = document.createElement('div');
    ov.id = 'modal-student-combo-tasks';
    ov.className = 'modal-overlay open';
    ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
    ov.innerHTML = `
      <div class="modal-card modal-card-wide" style="max-width:620px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div>
            <div class="modal-title">Bài tập hôm nay (${tasks.length} kỹ năng)</div>
            <div style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">${esc(dlNote)}</div>
          </div>
          <button type="button" class="btn-icon-glass" style="width:32px;height:32px;" onclick="document.getElementById('modal-student-combo-tasks')?.remove()">✕</button>
        </div>
        <div class="modal-body" style="padding:16px 20px 20px;">
          <div class="ts-combo-list">${rowsHtml}</div>
        </div>
      </div>
    `;
    document.body.appendChild(ov);
  }

  function handleIncomingUrlIfMultiSkill() {
    try {
      const curUser = B()?.getCurrentUser?.();
      if (!curUser) return false;
      // 0. Live Collaborative Reading Room (?live=<roomId>&p=<passageId>) — takes priority!
      const pendingLive = window.LiveReadingRoom?.peekPendingFromUrl?.();
      if (pendingLive && pendingLive.roomId && pendingLive.passageId) {
        const liveDedup = `live|${curUser.id}|${pendingLive.roomId}|${pendingLive.passageId}`;
        if (state.handledUrlKey === liveDedup) return true;
        state.handledUrlKey = liveDedup;
        window.LiveReadingRoom.clearPendingFromUrl();
        const isTeacher = Boolean(B()?.isTeacherUser?.());
        setTimeout(() => {
          if (isTeacher && typeof window.toggleTeacherStudyPreview === 'function') {
            window.toggleTeacherStudyPreview(true);
          }
          window.ReadingPracticeApp?.openLiveRoom?.(
            pendingLive.roomId,
            pendingLive.passageId,
            !!pendingLive.isFull,
            pendingLive.dbUrl || ''
          );
        }, 260);
        return true;
      }

      const sp = new URLSearchParams(window.location.search || '');
      if (sp.get('adminTest') || (B()?.isTeacherUser?.() && sp.get('test'))) return false;
      const single = sp.get('task') || sp.get('wtask');
      const multi = sp.get('tasks');
      const dl = Number(sp.get('deadline') || sp.get('due') || 0);
      const rawList = [];
      if (single) {
        const norm = normalizeAnyTaskId(single);
        if (norm) rawList.push(norm);
      }
      if (multi) {
        multi.split(',').map(normalizeAnyTaskId).filter(Boolean).forEach((x) => {
          if (!rawList.includes(x)) rawList.push(x);
        });
      }
      if (!rawList.length) return false;
      // Only handle IDs that are authorized by AccessPolicy AND resolve to a real item
      const validList = rawList.filter((id) => (window.AccessPolicy?.isTaskIdAuthorized?.(id) !== false) && Boolean(getTaskById(id)));
      if (!validList.length) return false;

      const dedupKey = `${curUser.id}|${window.location.search || ''}`;
      if (state.handledUrlKey === dedupKey) return true;
      state.handledUrlKey = dedupKey;

      // Record deadline locally if present
      if (Number.isFinite(dl) && dl > 1e11) {
        const live = loadLiveDeadlines();
        const iss = Number(sp.get('issued') || Date.now());
        validList.forEach((tid) => {
          if (!live[tid] || iss > Number(live[tid].issuedAt || 0)) live[tid] = { deadlineAt: dl, issuedAt: iss };
        });
        writeJson(scopedClassKey(LIVE_DL_KEY), live);
      }

      const isTeacher = Boolean(B()?.isTeacherUser?.());
      const openResolved = () => {
        if (isTeacher && typeof window.toggleTeacherStudyPreview === 'function') {
          window.toggleTeacherStudyPreview(true);
        }
        openStudentComboModal(validList, dl);
        if (isTeacher) {
          B()?.showToast?.('Đang xem trước bài giao (Giáo viên) — bấm "Quay lại Quản lý" để về bảng lớp.');
        }
      };

      // Defer slightly so TotoroUI finishes initial mount/view sync before switching skill & opening modal
      setTimeout(openResolved, 260);
      return true;
    } catch (_) {
      return false;
    }
  }

  function onUserLogout() {
    state.handledUrlKey = '';
    document.getElementById('modal-student-combo-tasks')?.remove();
  }

  /* =========================================================
     12. PUBLIC CONTROLS
     ========================================================= */
  window.TeacherStudio = {
    renderDashboard,
    setWorkspaceTab,
    toggleToolsMenu,
    setTableView: (v) => { state.tableView = ['today', 'month', 'full'].includes(v) ? v : 'today'; renderDashboard(); },
    setRosterFilter: (f) => { state.rosterFilter = ['all', 'locked', 'pending'].includes(f) ? f : 'all'; renderDashboard(); },
    setMonitorTab: (t) => { state.monitorTab = t === 'expired' ? 'expired' : 'active'; renderDashboard(); },
    setMonitorSkill: (sk) => { state.monitorSkill = sk || 'all'; renderDashboard(); },
    setPickerSkill: (sk) => { state.pickerSkill = sk; state.pickerQuery = ''; const el = document.getElementById('ts-picker-search'); if (el) el.value = ''; renderPickerSection(Date.now()); },
    setPickerSuite: (suiteKey) => {
      state.pickerSuite[state.pickerSkill] = suiteKey;
      const rpMatch = String(suiteKey || '').match(/^rp_(cambridge|volume|actual)$/);
      const lpMatch = String(suiteKey || '').match(/^lp_(cambridge|volume|actual)$/);
      if (rpMatch && window.ReadingPracticeApp?.ensureSourceBankLoaded) {
        state.pickerLoadingBank = true;
        renderPickerSection(Date.now());
        window.ReadingPracticeApp.ensureSourceBankLoaded(rpMatch[1]).finally(() => {
          state.pickerLoadingBank = false;
          renderPickerSection(Date.now());
        });
        return;
      }
      if (lpMatch && window.ListeningPracticeApp?.ensureSourceBankLoaded) {
        state.pickerLoadingBank = true;
        renderPickerSection(Date.now());
        window.ListeningPracticeApp.ensureSourceBankLoaded(lpMatch[1]).finally(() => {
          state.pickerLoadingBank = false;
          renderPickerSection(Date.now());
        });
        return;
      }
      renderPickerSection(Date.now());
    },
    setPickerPracticeMode: (mode) => {
      state.pickerPracticeMode = mode === 'exam' ? 'exam' : 'practice';
      renderPickerSection(Date.now());
    },
    togglePickerHideFull: () => {
      state.pickerHideFull = !state.pickerHideFull;
      renderPickerSection(Date.now());
    },
    setWeeklyAutoSource: (src) => {
      state.weeklyAutoSource = ['cambridge', 'volume', 'actual'].includes(src) ? src : 'cambridge';
      state.weeklyAutoOffset = 0;
    },
    autoPickWeeklyBundle,
    autoPickDailyBundle,
    openPracticeAssignModal,
    setQuickAssignMode,
    updateQuickAssignPreview,
    copyQuickAssignLink,
    addQuickAssignToBasket,
    onPickerSearch: (val) => { state.pickerQuery = String(val || ''); renderPickerSection(Date.now()); },
    toggleHideAllDone: () => {
      state.pickerHideAllDone = !state.pickerHideAllDone;
      const btn = document.getElementById('btn-teacher-filter-pending');
      if (btn) btn.textContent = state.pickerHideAllDone ? 'Hiện tất cả' : 'Ẩn bài đã xong hết';
      renderPickerSection(Date.now());
    },
    toggleSelectTask: (tid, checked) => {
      const id = normalizeAnyTaskId(tid);
      if (!id) return;
      if (checked) state.selectedIds.add(id);
      else state.selectedIds.delete(id);
      renderPickerSection(Date.now());
    },
    clearSelection: () => { state.selectedIds.clear(); state.sectionOverrides = {}; renderPickerSection(Date.now()); },
    setComposerTemplate: (tpl) => {
      state.composerTemplate = tpl === 'daily' ? 'daily' : 'weekly';
      try { localStorage.setItem(COMPOSER_TPL_KEY, state.composerTemplate); } catch (_) {}
      if (state.composerTemplate === 'weekly') {
        // Weekly mode is Practice-only: drop any non-Practice Task selections automatically
        for (const id of [...state.selectedIds]) {
          if (!parsePracticeTaskId(id)) {
            state.selectedIds.delete(id);
            delete state.sectionOverrides[id];
          }
        }
      }
      renderPickerSection(Date.now());
    },
    toggleShowEmptySections: (checked) => {
      state.showEmptySections = Boolean(checked);
      updateLinkPreview();
    },
    onWeeklyMetaChange: (field) => {
      if (field === 'title') {
        const v = document.getElementById('ts-weekly-title')?.value || '';
        state.weeklyTitle = v;
        state.weeklyTitleDirty = Boolean(v.trim());
      } else if (field === 'issued') {
        const v = document.getElementById('ts-weekly-issued-date')?.value || '';
        state.weeklyIssuedDate = v;
        if (!state.weeklyTitleDirty) {
          const dt = parseIsoDateLocal(v);
          if (dt) state.weeklyTitle = computeAutoWeeklyTitle(dt);
        }
      }
      updateLinkPreview();
    },
    cycleTaskSection: (tid) => {
      const id = normalizeAnyTaskId(tid);
      if (!id) return;
      const cur = getTaskSection(id);
      const idx = WEEKLY_SECTIONS.findIndex((s) => s.key === cur);
      const next = WEEKLY_SECTIONS[(idx + 1) % WEEKLY_SECTIONS.length];
      state.sectionOverrides[id] = next.key;
      renderPickerSection(Date.now());
    },
    onDeadlinePresetChange: () => {
      state.presetDirty = true;
      const p = document.getElementById('teacher-task-deadline-preset');
      const c = document.getElementById('teacher-task-deadline-custom');
      if (p && c) {
        const isCust = p.value === 'custom';
        c.style.display = isCust ? 'inline-block' : 'none';
        if (isCust && !c.value) {
          const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const pad = (n) => String(n).padStart(2, '0');
          c.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
        }
      }
      updateLinkPreview();
    },
    copySelectedLink,
    applyLiveDeadline,
    extendTaskDeadline,
    onExtendTaskSelect,
    confirmCustomTaskDeadline,
    endTasksNow,
    dismissMonitorTask,
    unlockStudentTask,
    forceUnlockStudent: (studentId, studentName) => {
      const nm = studentName || studentId;
      if (!confirm(`Gửi lệnh mở khóa toàn bộ bài (cưỡng bức) cho học viên ${nm} ngay bây giờ?`)) return;
      unlockStudentTask(studentId, '');
    },
    openTaskDetailModal,
    openWeeklyReportModal,
    setWeeklyReportBatch: (weekKey) => {
      state.reportBatchKey = weekKey || '';
      const b = getAvailableWeeklyBatches(Date.now()).find((x) => x.weekKey === state.reportBatchKey);
      state.reportCustomTitle = b?.title || '';
      renderWeeklyReportModal();
    },
    setWeeklyReportTitle: (val) => {
      state.reportCustomTitle = String(val || '');
      const nowMs = Date.now();
      const batches = getAvailableWeeklyBatches(nowMs);
      const activeBatch = batches.find((b) => b.weekKey === state.reportBatchKey) || batches[0];
      const metrics = computeWeeklyReportMetrics(activeBatch.taskIds, nowMs);
      const box = document.getElementById('ts-wr-preview-box');
      if (box) box.value = buildWeeklyReportText(state.reportCustomTitle, metrics);
    },
    setWeeklyReportMode: (mode) => {
      state.reportMode = mode === 'class' ? 'class' : 'student';
      renderWeeklyReportModal();
    },
    selectWeeklyReportStudent: (sid) => {
      state.reportMode = 'student';
      state.reportStudentId = String(sid || '');
      renderWeeklyReportModal();
    },
    setWeeklyReportOption: (key, val) => {
      if (key === 'includeName') state.reportIncludeName = Boolean(val);
      if (key === 'includeDetails') state.reportIncludeClassDetails = Boolean(val);
      renderWeeklyReportModal();
    },
    copyWeeklyReportForStudent,
    copyWeeklyReportPreview,
    setDetailFilter: (f) => { state.detailFilter = f || 'all'; renderDetailModalBody(); },
    copyStudentReminder,
    copyStudentAllPendingReminder,
    copyAllPendingReminder,
    copyGroupReminder,
    previewSkillTask,
    openStudentSkillTask,
    openStudentComboModal,
    handleIncomingUrlIfMultiSkill,
    onUserLogout,
    getTaskDeadlineInfo,
    getTaskById,
    readStudentAllLocks,
  };

  /* =========================================================
     13. UNIFIED 4-SKILL STUDENT ASSIGNED HOMEWORK CENTER
     Accessible from EVERY mode (Overview · Reading · Listening · Writing · Speaking)
     ========================================================= */
  let allHwModalTicker = null;
  let allHwFilterSkill = 'all';
  let allHwBucket = 'active';

  function getStudentAssignedHomeworkBuckets(nowMs = Date.now()) {
    const liveMap = loadLiveDeadlines();
    const sentMap = loadSentMap();
    const dismissedMap = loadDismissedMap();
    const curUser = B()?.getCurrentUser?.() || null;

    const urlIds = [];
    let urlDl = 0;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const single = sp.get('task') || sp.get('wtask');
      const multi = sp.get('tasks');
      urlDl = Number(sp.get('deadline') || sp.get('due') || 0);
      if (single) urlIds.push(normalizeAnyTaskId(single));
      if (multi) multi.split(',').map(normalizeAnyTaskId).filter(Boolean).forEach((x) => { if (!urlIds.includes(x)) urlIds.push(x); });
    } catch (_) {}

    const seen = new Set();
    const activeList = [];
    const expiredList = [];

    const inspect = (rawId, fromUrl = false) => {
      const tid = normalizeAnyTaskId(rawId);
      if (!tid || seen.has(tid)) return;
      const taskObj = getTaskById(tid);
      if (!taskObj) return;
      seen.add(tid);

      const dlRec = liveMap[tid] || null;
      const sentTs = Number(sentMap[tid] || 0);
      const issuedAt = Math.max(Number(dlRec?.issuedAt || 0), sentTs, fromUrl ? nowMs : 0);
      const deadlineAt = Number(dlRec?.deadlineAt || (fromUrl && urlDl > 1e11 ? urlDl : 0));
      const dismissedAt = Number(dismissedMap[tid] || 0);
      const lastEventTs = Math.max(issuedAt, deadlineAt > 0 && deadlineAt <= nowMs ? deadlineAt : 0);
      if (dismissedAt > 0 && dismissedAt >= lastEventTs) return;

      const row = curUser ? getStudentHomeworkRow(taskObj, curUser, nowMs) : null;
      const entry = {
        task: taskObj,
        deadlineAt,
        issuedAt,
        row,
        completed: Boolean(row?.completed),
        locked: Boolean(row?.lock),
      };

      if (deadlineAt > nowMs) {
        activeList.push(entry);
      } else if (deadlineAt > 0 && deadlineAt <= nowMs) {
        if (nowMs - deadlineAt <= 7 * 24 * 60 * 60 * 1000) {
          expiredList.push(entry);
        }
      } else if (issuedAt > 0) {
        activeList.push(entry);
      }
    };

    Object.keys(liveMap).forEach((k) => inspect(k, false));
    Object.keys(sentMap).forEach((k) => inspect(k, false));
    urlIds.forEach((k) => inspect(k, true));

    const skillRank = { reading: 1, listening: 2, writing: 3, speaking: 4 };
    activeList.sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      const aHasDl = a.deadlineAt > 0;
      const bHasDl = b.deadlineAt > 0;
      if (aHasDl && bHasDl && a.deadlineAt !== b.deadlineAt) return a.deadlineAt - b.deadlineAt;
      if (aHasDl !== bHasDl) return aHasDl ? -1 : 1;
      if (b.issuedAt !== a.issuedAt) return b.issuedAt - a.issuedAt;
      return (skillRank[a.task.skill] || 9) - (skillRank[b.task.skill] || 9);
    });
    expiredList.sort((a, b) => b.deadlineAt - a.deadlineAt);
    return { activeList, expiredList };
  }

  function updateStudentHomeworkBadge() {
    const badge = document.getElementById('hdr-hw-badge');
    const btn = document.getElementById('btn-open-student-tasks');
    if (!badge || !btn) return;
    const { activeList } = getStudentAssignedHomeworkBuckets(Date.now());
    const pendingCnt = activeList.filter((e) => !e.completed).length;
    if (pendingCnt > 0) {
      badge.textContent = pendingCnt > 99 ? '99+' : String(pendingCnt);
      badge.style.display = 'inline-block';
      btn.title = `Có ${pendingCnt} bài tập đang được giao chưa hoàn thành (4 kỹ năng)`;
    } else if (activeList.length > 0) {
      badge.style.display = 'none';
      btn.title = `Đã hoàn thành ${activeList.length}/${activeList.length} bài tập đang giao`;
    } else {
      badge.style.display = 'none';
      btn.title = 'Tất cả bài tập đang được giao (4 kỹ năng)';
    }
  }

  function closeAllAssignedHomeworkModal(event) {
    const ov = document.getElementById('modal-all-assigned-hw');
    if (event && event.target !== ov) return;
    if (allHwModalTicker) {
      clearInterval(allHwModalTicker);
      allHwModalTicker = null;
    }
    ov?.remove();
  }

  function tickAllAssignedHomeworkCountdowns() {
    const ov = document.getElementById('modal-all-assigned-hw');
    if (!ov) {
      if (allHwModalTicker) { clearInterval(allHwModalTicker); allHwModalTicker = null; }
      return;
    }
    const nowMs = Date.now();
    ov.querySelectorAll('[data-shw-dl]').forEach((el) => {
      const dl = Number(el.getAttribute('data-shw-dl') || 0);
      if (!dl) return;
      const rem = dl - nowMs;
      if (rem <= 0) {
        el.classList.add('is-urgent');
        el.textContent = 'Hết giờ';
      } else {
        el.classList.toggle('is-urgent', rem <= 15 * 60 * 1000);
        el.textContent = `Còn ${formatDeadlineRemaining(rem)}`;
      }
    });
  }

  function renderAllAssignedHomeworkModal() {
    const ov = document.getElementById('modal-all-assigned-hw');
    if (!ov) return;
    const nowMs = Date.now();
    const { activeList, expiredList } = getStudentAssignedHomeworkBuckets(nowMs);
    if (allHwBucket === 'expired' && !expiredList.length) allHwBucket = 'active';
    const baseList = allHwBucket === 'expired' ? expiredList : activeList;

    const counts = { all: baseList.length, reading: 0, listening: 0, writing: 0, speaking: 0 };
    baseList.forEach((e) => {
      if (counts[e.task.skill] != null) counts[e.task.skill] += 1;
    });
    if (allHwFilterSkill !== 'all' && counts[allHwFilterSkill] === 0) {
      allHwFilterSkill = 'all';
    }

    const visibleList = allHwFilterSkill === 'all'
      ? baseList
      : baseList.filter((e) => e.task.skill === allHwFilterSkill);

    const activeDone = activeList.filter((e) => e.completed).length;
    const activeTotal = activeList.length;
    const activePct = activeTotal ? Math.round((activeDone / activeTotal) * 100) : 0;

    const skillTabsHtml = [
      { key: 'all', label: 'Tất cả' },
      { key: 'reading', label: 'Reading' },
      { key: 'listening', label: 'Listening' },
      { key: 'writing', label: 'Writing' },
      { key: 'speaking', label: 'Speaking' },
    ].filter((st) => st.key === 'all' || counts[st.key] > 0).map((st) => `
      <button type="button" class="shw-skill-tab ${allHwFilterSkill === st.key ? 'active' : ''}"
        onclick="TeacherStudio.setAllHwFilter('${st.key}')">
        <span>${st.label}</span>
        <span class="shw-tab-cnt tabular">${counts[st.key]}</span>
      </button>
    `).join('');

    const clockSvg = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>';

    const cardsHtml = visibleList.length
      ? visibleList.map((e) => {
          const t = e.task;
          const sm = skillMeta(t.skill);
          const isPrac = Boolean(parsePracticeTaskId(t.id));
          const isExp = e.deadlineAt > 0 && e.deadlineAt <= nowMs;
          const remMs = e.deadlineAt > 0 ? Math.max(0, e.deadlineAt - nowMs) : 0;

          let statusPill = '<span class="thw-status-pill is-missing">Chưa làm</span>';
          let stateCls = '';
          if (e.completed) {
            statusPill = `<span class="thw-status-pill is-done">✓ ${esc(e.row?.scoreLabel || 'Đã nộp')}</span>`;
            stateCls = 'is-done';
          } else if (e.locked) {
            statusPill = `<span class="ts-skill-pill" style="background:var(--ts-danger-bg);color:var(--ts-danger);border-color:var(--ts-danger-bd);">Khóa ${formatMmSs(e.row.lock.remainingMs)}</span>`;
            stateCls = 'is-locked';
          } else if (e.row?.bucket === 'progress') {
            statusPill = `<span class="thw-status-pill is-progress">${esc(e.row.progressLabel || 'Đang làm')}</span>`;
          } else if (isExp) {
            statusPill = '<span class="thw-status-pill is-missing">Quá hạn</span>';
            stateCls = 'is-expired';
          }

          let dlPill = `<span class="shw-dl-pill is-unlimited">${clockSvg}<span>Không giới hạn</span></span>`;
          if (isExp) {
            dlPill = `<span class="shw-dl-pill is-urgent" title="Đóng lúc ${esc(formatDeadlineTs(e.deadlineAt))}">${clockSvg}<span>Hết hạn ${esc(formatDeadlineTs(e.deadlineAt))}</span></span>`;
          } else if (e.deadlineAt > nowMs) {
            const urg = remMs <= 15 * 60 * 1000;
            dlPill = `<span class="shw-dl-pill ${urg ? 'is-urgent' : ''} tabular" title="Đóng lúc ${esc(formatDeadlineTs(e.deadlineAt))}">${clockSvg}<span data-shw-dl="${e.deadlineAt}">Còn ${esc(formatDeadlineRemaining(remMs))}</span></span>`;
          }

          const btnLabel = e.completed ? 'Xem lại' : (isExp ? 'Mở xem' : 'Vào làm →');
          const btnCls = e.completed || isExp ? 'btn shw-open-btn' : 'btn btn-primary shw-open-btn';

          return `
            <article class="shw-item ${stateCls}">
              <div class="shw-item-top">
                <div class="shw-item-badges">
                  <span class="ts-skill-pill is-${esc(t.skill)}">${esc(sm.label.toUpperCase())}</span>
                  <span class="shw-kind-pill">${isPrac ? 'Practice' : 'Task'}</span>
                </div>
                ${statusPill}
              </div>
              <div class="shw-item-title">${esc(t.code)}</div>
              <div class="shw-item-sub">${esc(t.theme || sm.sub)}</div>
              <div class="shw-item-foot">
                ${dlPill}
                <button type="button" class="${btnCls}" onclick="TeacherStudio.openStudentSkillTask('${esc(t.id)}')">${btnLabel}</button>
              </div>
            </article>
          `;
        }).join('')
      : `
        <div class="shw-empty" style="grid-column:1 / -1;">
          <div class="shw-empty-title">Hiện chưa có bài tập nào đang được giao</div>
          <div class="shw-empty-sub">Khi giáo viên giao bài ở bất kỳ kỹ năng nào (Reading, Listening, Writing, Speaking — cả Task &amp; Practice), tất cả sẽ tự động hiển thị tại đây.</div>
          <div class="shw-empty-pills">
            <button type="button" class="tot-demo-btn" style="height:32px;padding:0 12px;font-size:12px;" onclick="TeacherStudio.closeAllAssignedHomeworkModal(); window.TotoroUI?.enterSkillMode?.('Reading', 'task')">Reading</button>
            <button type="button" class="tot-demo-btn" style="height:32px;padding:0 12px;font-size:12px;" onclick="TeacherStudio.closeAllAssignedHomeworkModal(); window.TotoroUI?.enterSkillMode?.('Listening', 'task')">Listening</button>
            <button type="button" class="tot-demo-btn" style="height:32px;padding:0 12px;font-size:12px;" onclick="TeacherStudio.closeAllAssignedHomeworkModal(); window.TotoroUI?.enterSkillMode?.('Writing', 'task')">Writing</button>
            <button type="button" class="tot-demo-btn" style="height:32px;padding:0 12px;font-size:12px;" onclick="TeacherStudio.closeAllAssignedHomeworkModal(); window.TotoroUI?.enterSkillMode?.('Speaking', 'task')">Speaking</button>
          </div>
        </div>
      `;

    ov.innerHTML = `
      <div class="modal-card shw-card" onclick="event.stopPropagation()">
        <div class="modal-header shw-head">
          <div>
            <div class="modal-title" style="font-size:17px;">Bài tập đang được giao · 4 kỹ năng</div>
            <div style="font-size:12.5px;color:var(--ink-2);margin-top:2px;">Tổng hợp tất cả bài Task &amp; Practice thầy giao ở Reading, Listening, Writing và Speaking</div>
          </div>
          <button type="button" class="btn-icon-glass" style="width:32px;height:32px;" onclick="TeacherStudio.closeAllAssignedHomeworkModal()" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body shw-body">
          ${activeTotal > 0 ? `
            <div class="shw-prog-bar">
              <div class="shw-prog-top">
                <span>Tiến độ bài tập đang giao (tất cả chế độ)</span>
                <strong class="tabular">${activeDone} / ${activeTotal} hoàn thành (${activePct}%)</strong>
              </div>
              <div class="shw-prog-track"><div class="shw-prog-fill" style="width:${activePct}%"></div></div>
            </div>
          ` : ''}

          ${(activeTotal > 0 || expiredList.length > 0) ? `
            <div class="shw-filter-bar">
              <div class="shw-skill-tabs" role="tablist">${skillTabsHtml}</div>
              ${expiredList.length > 0 ? `
                <div class="shw-bucket-seg" role="tablist">
                  <button type="button" class="shw-bucket-btn ${allHwBucket === 'active' ? 'active' : ''}" onclick="TeacherStudio.setAllHwBucket('active')">Đang giao (${activeTotal})</button>
                  <button type="button" class="shw-bucket-btn ${allHwBucket === 'expired' ? 'active' : ''}" onclick="TeacherStudio.setAllHwBucket('expired')">Hết hạn (${expiredList.length})</button>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <div class="shw-grid">${cardsHtml}</div>
        </div>
      </div>
    `;
    updateStudentHomeworkBadge();
  }

  function openAllAssignedHomeworkModal() {
    document.getElementById('modal-all-assigned-hw')?.remove();
    allHwFilterSkill = 'all';
    allHwBucket = 'active';
    const ov = document.createElement('div');
    ov.id = 'modal-all-assigned-hw';
    ov.className = 'modal-overlay open';
    ov.style.zIndex = '2550';
    ov.onclick = (e) => closeAllAssignedHomeworkModal(e);
    document.body.appendChild(ov);
    renderAllAssignedHomeworkModal();
    if (allHwModalTicker) clearInterval(allHwModalTicker);
    allHwModalTicker = setInterval(tickAllAssignedHomeworkCountdowns, 1000);
    if (typeof B()?.syncPullClassData === 'function' && !B()?.isTeacherUser?.()) {
      Promise.resolve(B().syncPullClassData()).then(() => {
        if (document.getElementById('modal-all-assigned-hw')) renderAllAssignedHomeworkModal();
        else updateStudentHomeworkBadge();
      }).catch(() => {});
    }
  }

  Object.assign(window.TeacherStudio, {
    openAllAssignedHomeworkModal,
    closeAllAssignedHomeworkModal,
    setAllHwFilter: (sk) => { allHwFilterSkill = sk || 'all'; renderAllAssignedHomeworkModal(); },
    setAllHwBucket: (b) => { allHwBucket = b === 'expired' ? 'expired' : 'active'; renderAllAssignedHomeworkModal(); },
    updateStudentHomeworkBadge,
    getStudentAssignedHomeworkBuckets,
  });

  window.addEventListener('reading-practice-updated', () => updateStudentHomeworkBadge());
  window.addEventListener('listening-practice-updated', () => updateStudentHomeworkBadge());
  window.addEventListener('storage', () => updateStudentHomeworkBadge());

  // CRITICAL BOOT HOOK: When app.js already restored a saved login session BEFORE teacher_studio.js loaded,
  // tasks.js ran early while window.TeacherStudio was undefined. Route any incoming ?task=/?tasks=/?wtask= now!
  if (B()?.getCurrentUser?.()) {
    setTimeout(() => {
      handleIncomingUrlIfMultiSkill();
      updateStudentHomeworkBadge();
    }, 80);
  }
})();
