/**
 * TASK MANAGER MODULE — 30 Linked 50-Word Tasks, Teacher Link Generator,
 * 10-Min Idle Lockout (30-Min Cooldown), 3-Stage Assessment & Gemini AI Translation Grading
 */
(() => {
  'use strict';

  const IDLE_LIMIT_MS = 10 * 60 * 1000;
  const LOCK_PENALTY_MS = 30 * 60 * 1000;
  const LOCAL_AI_KEY_STORAGE = 'ielts_gemini_local_key_v1';
  const TEACHER_SENT_TASKS_KEY = 'ielts_teacher_sent_tasks_v1';
  const ACTIVE_TASK_EXAM_KEY_BASE = 'ielts_active_task_exam_';
  const TASK_DEADLINE_KEY_BASE = 'ielts_task_deadlines_';
  const ASSIGNED_TASKS_KEY_BASE = 'ielts_assigned_tasks_';
  const TEACHER_LIVE_DEADLINES_KEY = 'ielts_teacher_live_deadlines_v1';

  let teacherSelectedIds = new Set();
  let teacherFilterPendingOnly = false;
  let assignedUrlTaskIds = [];
  let pendingTaskId = null;

  let activeTask = null;
  let activeStage = 0; // 0: learn 50, 1: test1 matching, 2: test2 context, 3: final translation
  let learnIndex = 0;
  let viewedWordIds = new Set();

  let t1BoardIndex = 0;
  let _runtimeT1Boards = [];
  let t1LeftOrder = [];
  let t1ShuffledRight = [];
  let t1SelectedLeft = null;
  let t1MatchedIds = new Set();
  let t1Mistakes = 0;
  let t1WrongWordIds = new Set();

  let t2Index = 0;
  let t2Correct = 0;
  let t2Answered = false;
  let t2WrongRecords = [];
  let t2ParaPairs = [];
  let t2ParaBoards = [];
  let t2ParaBoardIndex = 0;
  let t2ParaLeftOrder = [];
  let t2ParaShuffledRight = [];
  let t2ParaSelectedLeft = null;
  let t2ParaSelectedRight = null;
  let t2DraggingRightId = null;
  let t2ParaMatchedIds = new Set();
  let t2ParaFailedIds = new Set();
  let t2ParaMistakes = 0;
  let t2ParaDone = false;
  let t2WbBoards = [];
  let t2WbBoardIndex = 0;
  let t2WbDone = false;
  let t2WbFills = {};
  let t2WbActiveSlotId = null;
  let t2WbSubmitted = false;
  let t2WbMistakes = 0;
  let t2ContextQs = [];

  let t3ReadingQuestions = [];
  let t3ReadingAnswers = {};

  function shuffleArray(arr) {
    const out = Array.isArray(arr) ? arr.slice() : [];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  let idleTimer = null;
  let lastActivityAt = 0;
  let taskStartedAt = 0;
  let taskLeaveWarnings = 0;
  let lastTaskLeaveAt = 0;
  let taskTestPassed = false;
  let isPreviewTestMode = false;
  let lockCountdownTimer = null;
  let examReadyPromptShownForTaskId = null;
  let lastPreviewSummaryRecord = null;
  let t1Completed = false;
  let t2Completed = false;
  let t3Completed = false;
  let lastT3Grade = null;

  const B = () => window.__VOCAB_BRIDGE__;

  function isTeacherOrBypassed() {
    return Boolean(
      isPreviewTestMode ||
      B()?.isExamAntiCheatBypassed?.() ||
      B()?.isTeacherUser?.() ||
      B()?.getCurrentUser?.()?.role === 'teacher'
    );
  }

  const TASK_SUITES_META = [
    { key: 'foundation', prefix: 'fnd', label: 'Nền Tảng', count: 30, desc: 'Test 1 · Summary Word Box · Đọc hiểu & Dịch', kind: 'reading_full' },
    { key: 'academic', prefix: 'acd', label: 'Học Thuật', count: 20, desc: 'Test 1 · Summary Word Box · Đọc hiểu & Dịch', kind: 'reading_full' },
    { key: 'paraphrase', prefix: 'task', label: 'Paraphrase', count: 30, desc: 'Test 1 · Synonyms & Word Box · Đọc hiểu & Dịch', kind: 'paraphrase_full' },
    { key: 'advanced', prefix: 'adv', label: 'Chuyên Sâu', count: 30, desc: 'Test 1 · Summary Word Box · Đọc hiểu & Dịch', kind: 'reading_full' },
  ];

  let _generatedSuiteCache = null;
  let activeStudentTaskTab = 'paraphrase';
  let activeTeacherTaskTab = 'paraphrase';

  function isAnyTaskId(raw) {
    return Boolean(raw && /^(task|fnd|acd|adv)_\d{2}$/i.test(String(raw).trim()));
  }

  const SHORT_EN_TASK_TOPICS = {
    // Foundation (30)
    fnd_01: 'Urban Cycling',
    fnd_02: 'Brain & New Words',
    fnd_03: 'Traditional Pottery',
    fnd_04: 'Island Ecosystems',
    fnd_05: 'Community Choirs',
    fnd_06: 'Urban Orchards',
    fnd_07: 'Coral Reef Conservation',
    fnd_08: 'Public Libraries',
    fnd_09: 'Seed Banks',
    fnd_10: 'Glaciers & Runoff',
    fnd_11: 'Timber Framing',
    fnd_12: 'Monarch Migration',
    fnd_13: 'Smart Greenhouses',
    fnd_14: 'Dolphin Acoustics',
    fnd_15: 'History of Silk',
    fnd_16: 'Urban Bird Nesting',
    fnd_17: 'Ancient Artifacts',
    fnd_18: 'High-Altitude Villages',
    fnd_19: 'Cave Formations',
    fnd_20: 'Story of Coffee',
    fnd_21: 'Soil & Composting',
    fnd_22: 'Honeybee Decline',
    fnd_23: 'Rainforest Canopies',
    fnd_24: 'Migratory Shorebirds',
    fnd_25: 'Exercise & Cognition',
    fnd_26: 'Vertical Gardens',
    fnd_27: 'Mangrove Wetlands',
    fnd_28: 'Passive Solar Homes',
    fnd_29: 'Rice Terraces',
    fnd_30: 'Shallow Lake Oxygen',
    // Academic (20)
    acd_01: 'Pneumatic Transit',
    acd_02: 'Infant Auditory Brain',
    acd_03: 'Invasive Cane Toads',
    acd_04: 'Synthetic Chemistry',
    acd_05: 'Marine Nutrient Cycling',
    acd_06: 'Coastal Foraging',
    acd_07: 'Nuclear Isotopes',
    acd_08: 'Tropical Agroforestry',
    acd_09: 'Maritime Cartography',
    acd_10: 'Coastal Dune Recovery',
    acd_11: 'Biophilic Workplaces',
    acd_12: 'Bird Bioacoustics',
    acd_13: 'Nitrogen & Farming',
    acd_14: 'Congenital Amusia',
    acd_15: 'Viking Navigation',
    acd_16: 'Industrial Mechanization',
    acd_17: 'Bat Echolocation',
    acd_18: 'Synesthesia Sensation',
    acd_19: 'Metal Fatigue',
    acd_20: 'Syntactic Evolution',
    // Paraphrase (30)
    task_01: 'Dog Domestication',
    task_02: 'Flavour Neuroscience',
    task_03: 'Vertical Farming',
    task_04: 'Modern Printmaking',
    task_05: 'Plant Pollinators',
    task_06: 'Visual Archives',
    task_07: 'Science of Yawning',
    task_08: 'Music & Language Brain',
    task_09: 'Wisdom of Crowds',
    task_10: 'Urban Food Deserts',
    task_11: 'Online Consulting',
    task_12: 'Carbon Sequestration',
    task_13: 'Maori Medicine',
    task_14: 'Adolescent Autonomy',
    task_15: 'Healthy Centenarians',
    task_16: 'Elephant Island Penguins',
    task_17: 'Childhood & Health',
    task_18: 'Footwear Biomechanics',
    task_19: 'Limits of E-Learning',
    task_20: 'History of La Bise',
    task_21: 'Heritage Seed Savers',
    task_22: 'Earworms & Memory',
    task_23: 'Print Publishing',
    task_24: 'Academic Evidence',
    task_25: 'Social Research Data',
    task_26: 'Isolated Ecosystems',
    task_27: 'Ancient Navigation',
    task_28: 'Research Governance',
    task_29: 'Scientific Validity',
    task_30: 'Estuary Pollution',
    // Advanced (30)
    adv_01: 'Scientific Paradigms',
    adv_02: 'Pain Neuroplasticity',
    adv_03: 'Extended Mind Thesis',
    adv_04: 'Hyperbolic Discounting',
    adv_05: 'Legal Positivism',
    adv_06: 'Polar Ice Cores',
    adv_07: 'Archival Provenance',
    adv_08: 'Algorithmic Due Process',
    adv_09: 'Genome Editing Ethics',
    adv_10: 'Financial Fragility',
    adv_11: 'Aesthetic Formalism',
    adv_12: 'Complex Emergence',
    adv_13: 'Language Shift',
    adv_14: 'Multilateral Diplomacy',
    adv_15: 'Inflationary Cosmology',
    adv_16: 'Climate Governance',
    adv_17: 'Bayesian Epistemology',
    adv_18: 'Nudge Architecture',
    adv_19: 'Constitutional Checks',
    adv_20: 'Default Mode Network',
    adv_21: 'Sedimentary Feedbacks',
    adv_22: 'Microhistory Studies',
    adv_23: 'Explainable AI',
    adv_24: 'Epigenetic Ethics',
    adv_25: 'Monetary Transmission',
    adv_26: 'Philosophical Hermeneutics',
    adv_27: 'Network Fragility',
    adv_28: 'Dialect Levelling',
    adv_29: 'Strategic Deterrence',
    adv_30: 'Planetary Boundaries',
  };

  function getShortTaskTopic(id, fallback = '') {
    if (id && SHORT_EN_TASK_TOPICS[id]) return SHORT_EN_TASK_TOPICS[id];
    return String(fallback || '').trim();
  }

  function buildReadingSuiteTasks(scopeKey, prefix, shortLabel, themeLabel, rawList, numTasks) {
    const out = [];
    const total = rawList.length;
    const examMap = window.APP_READING_TASKS_EXAM_DATA || {};
    for (let i = 0; i < numTasks; i++) {
      const start = i * 50;
      const end = (i === numTasks - 1) ? total : Math.min(total, start + 50);
      const slice = rawList.slice(start, end);
      if (!slice.length) continue;
      const num = i + 1;
      const id = `${prefix}_${String(num).padStart(2, '0')}`;
      const words = slice.map((it) => ({
        id: it.id,
        lemma: it.lemma,
        ipa: it.ipa || window.IPA_DICT?.[String(it.lemma || '').toLowerCase()] || '',
        pos: it.clean_pos || it.pos || 'Danh từ',
        meaning: it.clean_meaning || it.definition || '',
        synonyms: Array.isArray(it.clean_synonyms) ? it.clean_synonyms : [],
        antonyms: Array.isArray(it.clean_antonyms) ? it.clean_antonyms : [],
        wordFamily: [],
        example: (Array.isArray(it.exam_citations) && it.exam_citations[0]?.sentence) ? it.exam_citations[0].sentence : '',
        linkedIds: [it.id],
      }));
      const test1Boards = [];
      for (let b = 0; b < words.length; b += 5) {
        test1Boards.push(words.slice(b, b + 5).map((w) => ({ id: w.id, word: w.lemma, meaning: w.meaning })));
      }
      const extra = examMap[id] || {};
      const passageTopic = getShortTaskTopic(id, extra.passage?.topic || themeLabel);
      out.push({
        id,
        num,
        scopeKey,
        taskKind: 'reading_full',
        label: `${shortLabel} · Task ${num}`,
        theme: passageTopic,
        estMinutes: 30,
        words,
        linkedIds: words.map((w) => w.id),
        test1Boards,
        test2WordBoxBoards: Array.isArray(extra.test2WordBoxBoards) ? extra.test2WordBoxBoards : [],
        passage: extra.passage || {
          id: `${id}_passage`,
          topic: themeLabel,
          title: `${shortLabel.toUpperCase()} READING CASE ${num}`,
          wordCount: 150,
          text: words.slice(0, 10).map((w) => w.example).filter(Boolean).join(' '),
          anchorWords: words.slice(0, 10).map((w) => w.lemma),
          signalClues: ['However', 'Consequently', 'Furthermore'],
        },
        test3ReadingQuestions: Array.isArray(extra.test3ReadingQuestions) ? extra.test3ReadingQuestions : [],
      });
    }
    return out;
  }

  function ensureGeneratedSuites() {
    if (_generatedSuiteCache) return _generatedSuiteCache;
    const f2 = (window.APP_DATA && Array.isArray(window.APP_DATA.file2_families_3500))
      ? window.APP_DATA.file2_families_3500
      : [];
    const examMap = window.APP_READING_TASKS_EXAM_DATA || {};
    const paraRaw = (window.APP_TASKS_DATA && Array.isArray(window.APP_TASKS_DATA.tasks))
      ? window.APP_TASKS_DATA.tasks.map((t, idx) => {
          t.num = idx + 1;
          t.scopeKey = 'paraphrase';
          t.taskKind = 'paraphrase_full';
          t.theme = getShortTaskTopic(t.id, t.theme);
          if (examMap[t.id] && Array.isArray(examMap[t.id].test3ReadingQuestions)) {
            t.test3ReadingQuestions = examMap[t.id].test3ReadingQuestions;
          } else if (!Array.isArray(t.test3ReadingQuestions)) {
            t.test3ReadingQuestions = [];
          }
          return t;
        })
      : [];
    _generatedSuiteCache = {
      foundation: buildReadingSuiteTasks('foundation', 'fnd', 'Nền Tảng', 'Nền tảng Reading', f2.slice(0, 1500), 30),
      academic: buildReadingSuiteTasks('academic', 'acd', 'Học Thuật', 'Học thuật Reading', f2.slice(1500, 2500), 20),
      paraphrase: paraRaw,
      advanced: buildReadingSuiteTasks('advanced', 'adv', 'Chuyên Sâu', 'Chuyên sâu C1–C2', f2.slice(2500), 30),
    };
    return _generatedSuiteCache;
  }

  function getTasksByScope(scopeKey) {
    const suites = ensureGeneratedSuites();
    return suites[scopeKey] || suites.paraphrase || [];
  }

  function getAllCatalogTasks() {
    const suites = ensureGeneratedSuites();
    return [...suites.foundation, ...suites.academic, ...suites.paraphrase, ...suites.advanced];
  }

  function getTasksList() {
    return getTasksByScope('paraphrase');
  }

  function normalizeTaskId(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    const mp = s.match(/^(fnd|acd|adv|task)_?(\d{1,2})$/);
    if (mp) {
      const pref = mp[1];
      const n = parseInt(mp[2], 10);
      const maxN = pref === 'acd' ? 20 : 30;
      if (n < 1 || n > maxN) return null;
      return `${pref}_${String(n).padStart(2, '0')}`;
    }
    const m = s.match(/^(\d{1,2})$/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 30) return null;
    return `task_${String(n).padStart(2, '0')}`;
  }

  function getTaskById(tid) {
    const norm = normalizeTaskId(tid);
    if (!norm) return null;
    return getAllCatalogTasks().find((t) => t.id === norm) || null;
  }

  function getScopedStorageUid() {
    const bridge = B();
    const u = bridge?.getCurrentUser?.();
    if (!u || !bridge?.getScopedUid) return '';
    return bridge.getScopedUid(u.id);
  }

  function loadTaskProgress() {
    const bridge = B();
    const uid = getScopedStorageUid();
    if (!bridge || !uid) return {};
    try {
      return JSON.parse(localStorage.getItem(`${bridge.TASK_PROGRESS_KEY_BASE}${uid}`) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveTaskProgress(map) {
    const bridge = B();
    const uid = getScopedStorageUid();
    if (!bridge || !uid) return;
    try {
      localStorage.setItem(`${bridge.TASK_PROGRESS_KEY_BASE}${uid}`, JSON.stringify(map));
    } catch (_) {}
  }

  function loadTaskLocks() {
    const bridge = B();
    const uid = getScopedStorageUid();
    if (!bridge || !uid) return {};
    try {
      return JSON.parse(localStorage.getItem(`${bridge.TASK_LOCKS_KEY_BASE}${uid}`) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveTaskLocks(map) {
    const bridge = B();
    const uid = getScopedStorageUid();
    if (!bridge || !uid) return;
    try {
      localStorage.setItem(`${bridge.TASK_LOCKS_KEY_BASE}${uid}`, JSON.stringify(map));
    } catch (_) {}
  }

  function loadActiveExamSession() {
    const uid = getScopedStorageUid();
    if (!uid) return null;
    try {
      const raw = localStorage.getItem(`${ACTIVE_TASK_EXAM_KEY_BASE}${uid}`);
      return raw ? (JSON.parse(raw) || null) : null;
    } catch (_) {
      return null;
    }
  }

  function saveActiveExamSession(sess) {
    const uid = getScopedStorageUid();
    if (!uid || !sess || typeof sess !== 'object') return;
    try {
      localStorage.setItem(`${ACTIVE_TASK_EXAM_KEY_BASE}${uid}`, JSON.stringify(sess));
    } catch (_) {}
  }

  function clearActiveExamSession() {
    const uid = getScopedStorageUid();
    if (!uid) return;
    try {
      localStorage.removeItem(`${ACTIVE_TASK_EXAM_KEY_BASE}${uid}`);
    } catch (_) {}
  }

  function persistActiveExamSnapshot() {
    if (!activeTask || isTeacherOrBypassed()) return;
    saveActiveExamSession({
      taskId: activeTask.id,
      startedAt: taskStartedAt || Date.now(),
      stage: activeStage,
      leaveWarnings: taskLeaveWarnings,
      inExam: Boolean(activeStage >= 1 && !taskTestPassed),
      updatedAt: Date.now(),
    });
  }

  function getTaskLockRemainingMs(taskId) {
    const locks = loadTaskLocks();
    const until = Number(locks[taskId] || 0);
    if (until <= 0) return 0;
    const bridge = B();
    const uid = getScopedStorageUid();
    let unlockAt = 0;
    if (bridge && uid && bridge.TEACHER_UNLOCK_KEY_BASE) {
      try {
        unlockAt = Number(localStorage.getItem(`${bridge.TEACHER_UNLOCK_KEY_BASE}${uid}`) || 0);
      } catch (_) {}
    }
    if (unlockAt > 0 && (until - LOCK_PENALTY_MS) <= unlockAt) {
      return 0;
    }
    return Math.max(0, until - Date.now());
  }

  function formatMmSs(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatDeadlineRemaining(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const d = Math.floor(totalSec / 86400);
    const h = Math.floor((totalSec % 86400) / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (d > 0) return `${d} ngày ${String(h).padStart(2, '0')}g${String(m).padStart(2, '0')}p`;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function formatDeadlineTimestamp(ts) {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      return `${hh}:${mm} ${dd}/${mo}`;
    } catch (_) {
      return '';
    }
  }

  function loadTaskDeadlines() {
    const uid = getScopedStorageUid();
    if (!uid) return {};
    try {
      return JSON.parse(localStorage.getItem(`${TASK_DEADLINE_KEY_BASE}${uid}`) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveTaskDeadlines(map) {
    const uid = getScopedStorageUid();
    if (!uid || !map || typeof map !== 'object') return;
    try {
      localStorage.setItem(`${TASK_DEADLINE_KEY_BASE}${uid}`, JSON.stringify(map));
    } catch (_) {}
  }

  function loadAssignedTasksMap() {
    const uid = getScopedStorageUid();
    if (!uid) return {};
    try {
      return JSON.parse(localStorage.getItem(`${ASSIGNED_TASKS_KEY_BASE}${uid}`) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveAssignedTasksMap(map) {
    const uid = getScopedStorageUid();
    if (!uid || !map || typeof map !== 'object') return;
    try {
      localStorage.setItem(`${ASSIGNED_TASKS_KEY_BASE}${uid}`, JSON.stringify(map));
    } catch (_) {}
  }

  function loadTeacherLiveDeadlines() {
    try {
      return JSON.parse(localStorage.getItem(TEACHER_LIVE_DEADLINES_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveTeacherLiveDeadlines(map) {
    if (!map || typeof map !== 'object') return;
    try {
      localStorage.setItem(TEACHER_LIVE_DEADLINES_KEY, JSON.stringify(map));
    } catch (_) {}
  }

  function updateTasksLiveDeadline(taskIds, newDeadlineAt, toastMsg = '') {
    const ids = (Array.isArray(taskIds) ? taskIds : [taskIds]).map(normalizeTaskId).filter(Boolean);
    if (!ids.length) {
      B()?.showToast?.('Vui lòng tick ít nhất 1 Task để cập nhật thời hạn!');
      return false;
    }
    const nowTs = Date.now();
    const map = loadTeacherLiveDeadlines();
    const cleanDl = (Number.isFinite(Number(newDeadlineAt)) && Number(newDeadlineAt) > 0) ? Number(newDeadlineAt) : 0;
    ids.forEach((tid) => {
      map[tid] = { deadlineAt: cleanDl, issuedAt: nowTs };
    });
    saveTeacherLiveDeadlines(map);

    // Also update any locally cached student deadline maps on the same browser for instant local sync
    try {
      const students = B()?.getStudentAccounts?.() || [];
      students.forEach((st) => {
        const uid = B()?.getScopedUid?.(st.id);
        if (!uid) return;
        const dKey = `${TASK_DEADLINE_KEY_BASE}${uid}`;
        const aKey = `${ASSIGNED_TASKS_KEY_BASE}${uid}`;
        const dMap = JSON.parse(localStorage.getItem(dKey) || '{}') || {};
        const aMap = JSON.parse(localStorage.getItem(aKey) || '{}') || {};
        ids.forEach((tid) => {
          dMap[tid] = { deadlineAt: cleanDl, issuedAt: nowTs };
          if (cleanDl > nowTs || cleanDl === 0) {
            if (!aMap[tid]) aMap[tid] = { assignedAt: nowTs, deadlineAt: cleanDl };
            else aMap[tid].deadlineAt = cleanDl;
          }
        });
        localStorage.setItem(dKey, JSON.stringify(dMap));
        localStorage.setItem(aKey, JSON.stringify(aMap));
      });
    } catch (_) {}

    B()?.broadcastTeacherTaskDeadlines?.(map);
    renderTeacherTasksGrid();
    updateTeacherLinkPreview();
    if (toastMsg) B()?.showToast?.(toastMsg);
    return true;
  }

  function applyTeacherLiveDeadline(targetIds = null) {
    const ids = targetIds ? (Array.isArray(targetIds) ? targetIds : [targetIds]) : [...teacherSelectedIds];
    if (!ids.length) {
      B()?.showToast?.('Vui lòng tick ít nhất 1 Task trước khi cập nhật hạn!');
      return;
    }
    const presetVal = document.getElementById('teacher-task-deadline-preset')?.value || '0';
    const nowTs = Date.now();
    const dlMs = computeSelectedDeadlineMs(nowTs);
    if (presetVal === 'custom' && dlMs <= nowTs) {
      B()?.showToast?.('Vui lòng chọn thời điểm đóng ở tương lai!');
      return;
    }
    const labelStr = dlMs > 0 ? `đến ${formatDeadlineTimestamp(dlMs)}` : 'Không giới hạn thời gian';
    updateTasksLiveDeadline(ids, dlMs, `Đã cập nhật hạn mới (${labelStr}) cho ${ids.length} Task!`);
  }

  function extendTaskDeadlineByMinutes(taskId, addMinutes = 60) {
    const tid = normalizeTaskId(taskId);
    if (!tid) return;
    const live = loadTeacherLiveDeadlines()[tid];
    const nowTs = Date.now();
    const baseTs = (live && Number(live.deadlineAt || 0) > nowTs) ? Number(live.deadlineAt) : nowTs;
    const nextDl = baseTs + Math.max(1, Number(addMinutes || 60)) * 60 * 1000;
    updateTasksLiveDeadline([tid], nextDl, `Đã gia hạn ${tid.toUpperCase()} đến ${formatDeadlineTimestamp(nextDl)}!`);
  }

  function endSelectedTasksNow(targetIds = null) {
    const ids = targetIds ? (Array.isArray(targetIds) ? targetIds : [targetIds]) : [...teacherSelectedIds];
    if (!ids.length) {
      B()?.showToast?.('Vui lòng tick ít nhất 1 Task cần kết thúc ngay!');
      return;
    }
    const endedAt = Date.now() - 1000;
    updateTasksLiveDeadline(ids, endedAt, `Đã kết thúc ngay ${ids.length} Task — học viên không thể vào làm mới hoặc sửa bài!`);
  }

  function recordUrlTaskDeadlines(taskIds) {
    if (!Array.isArray(taskIds) || !taskIds.length) return;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const rawDl = Number(sp.get('deadline') || sp.get('due') || 0);
      const issuedAt = Math.max(0, Number(sp.get('issued') || 0));
      const assignedMap = loadAssignedTasksMap();
      let assignedChanged = false;
      taskIds.forEach((tid) => {
        assignedMap[tid] = {
          assignedAt: Date.now(),
          deadlineAt: (Number.isFinite(rawDl) && rawDl > 1e11) ? rawDl : (assignedMap[tid]?.deadlineAt || 0),
        };
        assignedChanged = true;
      });
      if (assignedChanged) saveAssignedTasksMap(assignedMap);

      if (!Number.isFinite(rawDl) || rawDl <= 1e11) return;
      const map = loadTaskDeadlines();
      let changed = false;
      taskIds.forEach((tid) => {
        const prev = map[tid];
        if (!prev || typeof prev !== 'object') {
          map[tid] = { deadlineAt: rawDl, issuedAt };
          changed = true;
        } else {
          const prevDl = Number(prev.deadlineAt || 0);
          const prevIssued = Number(prev.issuedAt || 0);
          if (issuedAt > prevIssued) {
            map[tid] = { deadlineAt: rawDl, issuedAt };
            changed = true;
          } else if (prevDl <= 0 || rawDl < prevDl) {
            map[tid] = { deadlineAt: rawDl, issuedAt: prevIssued };
            changed = true;
          }
        }
      });
      if (changed) saveTaskDeadlines(map);
    } catch (_) {}
  }

  function resolveNewestDeadlineEntry(taskId) {
    const localMap = loadTaskDeadlines();
    const liveMap = loadTeacherLiveDeadlines();
    const localRec = localMap?.[taskId];
    const liveRec = liveMap?.[taskId];

    // If URL carried a deadline/issued, consider it too
    let urlRec = null;
    if (assignedUrlTaskIds.includes(taskId)) {
      try {
        const sp = new URLSearchParams(window.location.search || '');
        const rawDl = Number(sp.get('deadline') || sp.get('due') || 0);
        const rawIssued = Number(sp.get('issued') || 0);
        if (Number.isFinite(rawDl) && rawDl > 1e11) {
          urlRec = { deadlineAt: rawDl, issuedAt: rawIssued };
        }
      } catch (_) {}
    }

    const candidates = [localRec, liveRec, urlRec].filter((r) => r && typeof r === 'object');
    if (!candidates.length) return null;

    // Pick candidate with highest issuedAt; tie-breaker: liveRec wins
    let best = null;
    candidates.forEach((cand) => {
      const ci = Number(cand.issuedAt || 0);
      const bi = best ? Number(best.issuedAt || 0) : -1;
      if (!best || ci >= bi) best = cand;
    });
    return best;
  }

  function getActiveAssignedTasks() {
    const orderedIds = [];
    const seen = new Set();
    const pushId = (tid) => {
      const id = normalizeTaskId(tid);
      if (id && !seen.has(id)) {
        seen.add(id);
        orderedIds.push(id);
      }
    };
    assignedUrlTaskIds.forEach(pushId);
    Object.keys(loadAssignedTasksMap()).forEach(pushId);
    Object.keys(loadTaskDeadlines()).forEach(pushId);
    Object.keys(loadTeacherLiveDeadlines()).forEach((tid) => {
      const rec = loadTeacherLiveDeadlines()[tid];
      if (rec && Number(rec.deadlineAt || 0) > Date.now()) pushId(tid);
    });
    return orderedIds
      .map(getTaskById)
      .filter((t) => t && !getTaskExpiryState(t.id).expired);
  }

  function getTaskDeadlineInfo(taskId) {
    if (!taskId) return { hasDeadline: false, deadlineAt: 0, remainingMs: 0, expired: false, formattedAt: '' };
    const best = resolveNewestDeadlineEntry(taskId);
    const deadlineAt = Number(best?.deadlineAt || 0);
    if (deadlineAt <= 0) {
      return { hasDeadline: false, deadlineAt: 0, remainingMs: 0, expired: false, formattedAt: '' };
    }
    const rem = Math.max(0, deadlineAt - Date.now());
    return {
      hasDeadline: true,
      deadlineAt,
      remainingMs: rem,
      expired: rem <= 0,
      formattedAt: formatDeadlineTimestamp(deadlineAt),
    };
  }

  function getTaskExpiryState(taskId) {
    const dl = getTaskDeadlineInfo(taskId);
    const prog = loadTaskProgress()[taskId];
    const completed = Boolean(prog && prog.status === 'completed');
    const expired = Boolean(dl.hasDeadline && dl.expired);
    return {
      ...dl,
      completed,
      canStart: !expired,
      canViewResultOnly: Boolean(expired && completed),
    };
  }

  function parseUrlAssignedTasks() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const single = normalizeTaskId(sp.get('task'));
      const multiRaw = sp.get('tasks') || '';
      const multi = multiRaw.split(',').map(normalizeTaskId).filter(Boolean);
      const all = [];
      if (single) all.push(single);
      multi.forEach((id) => {
        if (!all.includes(id)) all.push(id);
      });
      return all;
    } catch (_) {
      return [];
    }
  }

  // =========================================================
  // TEACHER TASK STATE HELPERS
  // =========================================================
  function loadTeacherSentTasks() {
    try {
      return JSON.parse(localStorage.getItem(TEACHER_SENT_TASKS_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function markTasksAsSent(ids) {
    if (!Array.isArray(ids) || !ids.length) return;
    const sent = loadTeacherSentTasks();
    const now = Date.now();
    ids.forEach((id) => { sent[id] = now; });
    try { localStorage.setItem(TEACHER_SENT_TASKS_KEY, JSON.stringify(sent)); } catch (_) {}
  }

  function shortStudentName(fullName) {
    const parts = String(fullName || '').trim().split(/\s+/).filter(Boolean);
    return parts.length >= 2 ? parts.slice(-2).join(' ') : (parts[0] || '');
  }

  function getTaskClassStatus(taskId) {
    const bridge = B();
    const students = bridge?.getStudentAccounts?.() || [];
    const cache = bridge?.getCloudClassCache?.() || {};
    let doneCount = 0;
    const missingNames = [];

    students.forEach((st) => {
      const uid = bridge.getScopedUid(st.id);
      const tp = readStudentTaskMap(bridge, cache, bridge.TASK_PROGRESS_KEY_BASE, uid);
      if (tp[taskId]?.status === 'completed') doneCount++;
      else missingNames.push(shortStudentName(st.name));
    });

    const total = students.length;
    return {
      totalStudents: total,
      doneCount,
      missingNames,
      allDone: total > 0 && doneCount >= total,
    };
  }

  function toggleTeacherPendingFilter() {
    teacherFilterPendingOnly = !teacherFilterPendingOnly;
    const btn = document.getElementById('btn-teacher-filter-pending');
    if (btn) {
      btn.textContent = teacherFilterPendingOnly ? 'Hiện tất cả 30 Task' : 'Chỉ hiện Task chưa xong hết';
    }
    renderTeacherTasksGrid();
  }

  function switchTeacherTaskTab(scopeKey) {
    if (!TASK_SUITES_META.some((m) => m.key === scopeKey)) return;
    activeTeacherTaskTab = scopeKey;
    renderTeacherTasksGrid();
  }

  function renderTeacherTasksGrid() {
    const tasks = getTasksByScope(activeTeacherTaskTab);
    const esc = B()?.escapeHtml || ((x) => String(x));
    const sentMap = loadTeacherSentTasks();
    const visibleTasks = teacherFilterPendingOnly
      ? tasks.filter((t) => !getTaskClassStatus(t.id).allDone)
      : tasks;

    const tabsEl = document.getElementById('teacher-task-suite-tabs');
    if (tabsEl) {
      tabsEl.innerHTML = TASK_SUITES_META.map((m) => {
        const list = getTasksByScope(m.key);
        const selInTab = list.filter((t) => teacherSelectedIds.has(t.id)).length;
        return `<button type="button" class="task-suite-tab ${activeTeacherTaskTab === m.key ? 'active' : ''}" onclick="TasksModule.switchTeacherTaskTab('${m.key}')">${esc(m.label)}${selInTab > 0 ? ` · <strong>${selInTab}</strong>` : ''}</button>`;
      }).join('');
    }

    const html = visibleTasks.map((t) => {
      const checked = teacherSelectedIds.has(t.id) ? 'checked' : '';
      const st = getTaskClassStatus(t.id);
      const isSent = Boolean(sentMap[t.id]);
      let badgeHtml = '';
      let subStatusHtml = '';

      if (st.allDone) {
        badgeHtml = `<span class="teacher-task-badge done">✓ Đã làm hết (${st.doneCount}/${st.totalStudents})</span>`;
        subStatusHtml = `<div class="teacher-task-missing teacher-task-done-note">Cả lớp đã hoàn thành</div>`;
      } else if (st.doneCount > 0) {
        badgeHtml = `<span class="teacher-task-badge partial">${st.doneCount}/${st.totalStudents} xong</span>`;
        subStatusHtml = `<div class="teacher-task-missing"><strong>Chưa làm (${st.missingNames.length}):</strong> ${esc(st.missingNames.join(', '))}</div>`;
      } else {
        badgeHtml = isSent ? `<span class="teacher-task-badge sent">Đã gửi link</span>` : '';
        subStatusHtml = `<div class="teacher-task-missing">Chưa ai xong (0/${st.totalStudents} HS)</div>`;
      }

      const liveDlMap = loadTeacherLiveDeadlines();
      const liveDl = liveDlMap[t.id];
      let liveDlBadge = '';
      if (liveDl && Number(liveDl.deadlineAt || 0) > 0) {
        const rem = Number(liveDl.deadlineAt) - Date.now();
        liveDlBadge = rem > 0
          ? `<span class="teacher-task-dl-badge">⏱ Còn ${esc(formatDeadlineRemaining(rem))}</span>`
          : `<span class="teacher-task-dl-badge is-ended">Đã kết thúc</span>`;
      }

      const previewBtns = `
          <button type="button" class="btn-subtle" style="padding:2px 7px; font-size:11px;" onclick="TasksModule.openAdminTestPreview(1, '${esc(t.id)}')">Test 1</button>
          <button type="button" class="btn-subtle" style="padding:2px 7px; font-size:11px;" onclick="TasksModule.openAdminTestPreview(2, '${esc(t.id)}')">Test 2</button>
          <button type="button" class="btn-subtle" style="padding:2px 7px; font-size:11px;" onclick="TasksModule.openAdminTestPreview(3, '${esc(t.id)}')">Test 3</button>
          <button type="button" class="btn-subtle" style="padding:2px 6px; font-size:10.5px;" onclick="TasksModule.extendTaskDeadlineByMinutes('${esc(t.id)}', 60)" title="Gia hạn thêm 1 giờ cho Task này">+1h</button>
          <button type="button" class="btn-subtle" style="padding:2px 6px; font-size:10.5px; color:#b91c1c;" onclick="TasksModule.endSelectedTasksNow(['${esc(t.id)}'])" title="Kết thúc ngay Task này">Đóng</button>`;

      return `
        <label class="teacher-task-item ${st.allDone ? 'is-all-done' : ''}" style="align-items:flex-start;">
          <input type="checkbox" style="margin-top:3px;" value="${esc(t.id)}" ${checked} onchange="TasksModule.toggleTeacherTask('${esc(t.id)}', this.checked)">
          <div style="min-width:0; flex:1;">
            <div class="teacher-task-title">${esc(t.label)}${badgeHtml}${liveDlBadge}</div>
            <div class="teacher-task-sub">${esc(t.theme)}</div>
            ${subStatusHtml}
            <div style="margin-top:7px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;" onclick="event.stopPropagation()">
              <span style="font-size:11.5px; color:var(--text-muted); font-weight:700;">Xem Test:</span>
              ${previewBtns}
            </div>
          </div>
        </label>
      `;
    }).join('') || '<div style="grid-column:1/-1; text-align:center; padding:18px; color:var(--text-muted);">Cả lớp đã hoàn thành 100% Task ở bộ này!</div>';

    const gridEl = document.getElementById('teacher-dash-task-grid');
    if (gridEl) gridEl.innerHTML = html;
  }

  function openRecognitionTaskPreview(tid) {
    const t = getTaskById(tid);
    if (t && window.RecognitionTestModule?.startTaskFinalExam) {
      window.RecognitionTestModule.startTaskFinalExam(t, null);
    }
  }

  function toggleTeacherTask(tid, isChecked) {
    if (isChecked) teacherSelectedIds.add(tid);
    else teacherSelectedIds.delete(tid);
    updateTeacherLinkPreview();
  }

  function selectTeacherTaskRange(startNum, endNum) {
    const meta = TASK_SUITES_META.find((m) => m.key === activeTeacherTaskTab) || TASK_SUITES_META[2];
    for (let n = startNum; n <= endNum; n++) {
      const id = normalizeTaskId(`${meta.prefix}_${String(n).padStart(2, '0')}`);
      if (id) teacherSelectedIds.add(id);
    }
    renderTeacherTasksGrid();
    updateTeacherLinkPreview();
  }

  function clearTeacherTaskSelection() {
    teacherSelectedIds.clear();
    renderTeacherTasksGrid();
    updateTeacherLinkPreview();
  }

  function computeSelectedDeadlineMs(nowTs = Date.now()) {
    const preset = document.getElementById('teacher-task-deadline-preset')?.value || '0';
    if (preset === '0') return 0;
    if (preset === 'custom') {
      const raw = document.getElementById('teacher-task-deadline-custom')?.value || '';
      if (!raw) return 0;
      const ts = new Date(raw).getTime();
      return (Number.isFinite(ts) && ts > nowTs) ? ts : 0;
    }
    const mins = Number(preset || 0);
    return (Number.isFinite(mins) && mins > 0) ? (nowTs + mins * 60 * 1000) : 0;
  }

  function onTeacherDeadlinePresetChange() {
    const presetEl = document.getElementById('teacher-task-deadline-preset');
    const customEl = document.getElementById('teacher-task-deadline-custom');
    if (presetEl && customEl) {
      const isCustom = presetEl.value === 'custom';
      customEl.style.display = isCustom ? 'inline-block' : 'none';
      if (isCustom && !customEl.value) {
        const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const pad = (n) => String(n).padStart(2, '0');
        customEl.value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
      }
    }
    updateTeacherLinkPreview();
  }

  function updateTeacherLinkPreview() {
    const ids = [...teacherSelectedIds].sort();
    const cntEl = document.getElementById('teacher-dash-sel-count');
    if (cntEl) cntEl.textContent = `Đã chọn: ${ids.length} Task`;
    const nowTs = Date.now();
    const deadlineMs = computeSelectedDeadlineMs(nowTs);
    const hintEl = document.getElementById('teacher-task-deadline-hint');
    if (hintEl) {
      if (deadlineMs > 0) {
        hintEl.textContent = `Đóng lúc ${formatDeadlineTimestamp(deadlineMs)} (hết giờ không làm lại được)`;
      } else if (document.getElementById('teacher-task-deadline-preset')?.value === 'custom') {
        hintEl.textContent = 'Hãy chọn thời điểm đóng ở tương lai';
      } else {
        hintEl.textContent = 'Học viên có thể làm bất kỳ lúc nào';
      }
    }
    const base = window.location.href.split('?')[0].split('#')[0];
    let url = ids.length === 0
      ? ''
      : (ids.length === 1
        ? `${base}?task=${encodeURIComponent(ids[0])}`
        : `${base}?tasks=${ids.map(encodeURIComponent).join(',')}`);
    if (url && deadlineMs > 0) {
      url += `&deadline=${deadlineMs}&issued=${nowTs}`;
    }
    const inp = document.getElementById('teacher-dash-link-preview');
    if (inp) inp.value = url;
  }

  function copyTeacherTaskLink() {
    updateTeacherLinkPreview();
    const inp = document.getElementById('teacher-dash-link-preview');
    const url = inp?.value?.trim() || '';
    if (!url) {
      B()?.showToast('Vui lòng tick ít nhất 1 Task trước khi copy link!');
      return;
    }
    const ids = [...teacherSelectedIds];
    markTasksAsSent(ids);
    const allAlreadyDone = ids.every((id) => getTaskClassStatus(id).allDone);
    const toastDone = () => {
      B()?.showToast(allAlreadyDone
        ? 'Đã copy link (Lưu ý: các Task này cả lớp đã làm xong hết!)'
        : 'Đã copy link & đánh dấu Đã gửi link!');
      renderTeacherTasksGrid();
    };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(toastDone).catch(() => {
        inp.select();
        document.execCommand('copy');
        toastDone();
      });
    } else {
      inp.select();
      document.execCommand('copy');
      toastDone();
    }
  }

  function saveLocalGeminiKey() {
    const inp = document.getElementById('teacher-dash-gemini-key') || document.getElementById('teacher-gemini-key-input');
    const val = (inp?.value || '').trim();
    try {
      if (val) localStorage.setItem(LOCAL_AI_KEY_STORAGE, val);
      else localStorage.removeItem(LOCAL_AI_KEY_STORAGE);
      ['teacher-dash-gemini-key', 'teacher-gemini-key-input'].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
      });
      B()?.showToast(val ? 'Đã lưu API Key dự phòng trên trình duyệt này!' : 'Đã xóa API Key dự phòng.');
    } catch (_) {}
  }

  function promptGeminiApiKey() {
    let cur = '';
    try { cur = localStorage.getItem(LOCAL_AI_KEY_STORAGE) || ''; } catch (_) {}
    const val = prompt('Nhập Google AI Studio Key (Gemini API Key) để kích hoạt mô hình Gemini 2.5 Flash chấm bài trực tiếp:', cur);
    if (val !== null) {
      const clean = val.trim();
      try {
        if (clean) {
          localStorage.setItem(LOCAL_AI_KEY_STORAGE, clean);
          B()?.showToast?.('Đã lưu Gemini API Key! Các bài dịch sẽ được gửi trực tiếp đến mô hình Gemini 2.5 Flash.');
        } else {
          localStorage.removeItem(LOCAL_AI_KEY_STORAGE);
          B()?.showToast?.('Đã xóa Gemini API Key. Hệ thống sử dụng bộ phân tích ngữ cảnh đối chiếu bài đọc.');
        }
      } catch (_) {}
      const dashKey = document.getElementById('teacher-dash-gemini-key');
      if (dashKey) dashKey.value = clean;
      renderTaskStage();
    }
  }

  function readStudentTaskMap(bridge, cache, keyBase, uid) {
    const isLocks = (keyBase === bridge.TASK_LOCKS_KEY_BASE);
    const cacheKey = isLocks ? 'taskLocks' : 'taskProgress';
    const remote = cache?.[uid]?.syncData?.[cacheKey];
    let local = {};
    try {
      local = JSON.parse(localStorage.getItem(`${keyBase}${uid}`) || '{}') || {};
    } catch (_) {}

    if (!isLocks) {
      const merged = { ...(remote && typeof remote === 'object' ? remote : {}) };
      Object.entries(local).forEach(([tid, rec]) => {
        const prev = merged[tid];
        if (rec && (!prev || (rec.updatedAt || 0) >= (prev.updatedAt || 0) || (rec.status === 'completed' && prev.status !== 'completed'))) {
          merged[tid] = rec;
        }
      });
      return merged;
    }

    const hasRemote = Boolean(bridge.getSyncUrl?.() && cache?.[uid]?.syncData && typeof cache[uid].syncData === 'object');
    const remoteUnlock = Number(cache?.[uid]?.syncData?.teacherUnlockedAt || 0);
    let localUnlock = 0;
    try {
      localUnlock = Number(localStorage.getItem(`${bridge.TEACHER_UNLOCK_KEY_BASE}${uid}`) || 0);
    } catch (_) {}
    const unlockAt = hasRemote ? remoteUnlock : Math.max(remoteUnlock, localUnlock);
    const merged = hasRemote
      ? { ...(remote && typeof remote === 'object' ? remote : {}) }
      : { ...(remote && typeof remote === 'object' ? remote : {}), ...local };
    Object.keys(merged).forEach((tid) => {
      const until = Number(merged[tid] || 0);
      if (until <= 0 || (unlockAt > 0 && (until - LOCK_PENALTY_MS) <= unlockAt)) {
        delete merged[tid];
      }
    });
    return merged;
  }

  function unlockStudentTasks(studentId) {
    const bridge = B();
    if (!bridge?.isTeacherUser?.() || !studentId) return;
    const nowTs = Date.now();
    const acct = (bridge.getStudentAccounts?.() || []).find((a) => bridge.getScopedUid(a.id) === bridge.getScopedUid(studentId));
    const displayName = acct?.name || studentId;
    const p = bridge.unlockStudentCloudLocks?.(studentId, nowTs);
    renderTeacherDashboard();
    if (p && typeof p.then === 'function') {
      p.then((ok) => {
        if (ok) {
          bridge.showToast?.(`Đã mở khóa Task cho học viên ${displayName}!`);
        }
      });
    } else {
      bridge.showToast?.(`Đã mở khóa Task cho học viên ${displayName}!`);
    }
  }

  function formatCsvCell(val) {
    const s = String(val ?? '').replace(/\r?\n/g, ' ');
    return /[",]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function isRecognitionTaskEntry(tid, rec) {
    return rec?.taskKind === 'recognition'
      || (rec?.recognitionScore != null && rec?.translationScore == null);
  }

  function formatTaskDoneTag(tid, rec) {
    const idStr = String(tid || '');
    const num = Number(idStr.replace(/\D/g, '')) || idStr;
    if (isRecognitionTaskEntry(idStr, rec)) {
      if (/^fnd_/i.test(idStr)) return `NT${num} (${Math.round(Number(rec?.recognitionScore || 0))}%)`;
      if (/^acd_/i.test(idStr)) return `HT${num} (${Math.round(Number(rec?.recognitionScore || 0))}%)`;
      if (/^adv_/i.test(idStr)) return `CS${num} (${Math.round(Number(rec?.recognitionScore || 0))}%)`;
      return `T${num} (${Math.round(Number(rec?.recognitionScore || 0))}%)`;
    }
    const sc = Number(rec?.translationScore || 0).toFixed(1);
    if (/^fnd_/i.test(idStr)) return `NT${num} (${sc})`;
    if (/^acd_/i.test(idStr)) return `HT${num} (${sc})`;
    if (/^adv_/i.test(idStr)) return `CS${num} (${sc})`;
    return `P${num} (${sc})`;
  }

  function computeAvgAiScore(doneEntries) {
    const paraEntries = (doneEntries || []).filter(([tid, v]) => !isRecognitionTaskEntry(tid, v) && v?.translationScore != null);
    if (!paraEntries.length) return '';
    return (paraEntries.reduce((sum, [, v]) => sum + Number(v.translationScore || 0), 0) / paraEntries.length).toFixed(1);
  }

  function renderCompactCompletedTasksCell(doneEntries, totalTasks, esc, isSummaryModal = false) {
    if (!doneEntries || !doneEntries.length) {
      return isSummaryModal
        ? 'Chưa hoàn thành Task nào'
        : '<span style="color:var(--text-muted);">Chưa xong Task</span>';
    }
    const sorted = doneEntries.slice().sort(([a], [b]) => {
      const rankOf = (id) => (/^fnd_/i.test(id) ? 1 : /^acd_/i.test(id) ? 2 : /^task_/i.test(id) ? 3 : 4) * 100 + getTaskNumberOrder(id);
      return rankOf(a) - rankOf(b);
    });
    const tags = sorted.map(([tid, v]) => formatTaskDoneTag(tid, v));
    if (sorted.length <= 4) {
      return isSummaryModal
        ? esc(tags.join(', '))
        : `<strong>${sorted.length}/${totalTasks}</strong> · ${esc(tags.join(', '))}`;
    }

    const counts = { fnd: 0, acd: 0, para: 0, adv: 0 };
    sorted.forEach(([tid]) => {
      if (/^fnd_/i.test(tid)) counts.fnd += 1;
      else if (/^acd_/i.test(tid)) counts.acd += 1;
      else if (/^adv_/i.test(tid)) counts.adv += 1;
      else counts.para += 1;
    });
    const suitePills = [
      counts.fnd > 0 ? `<span class="teacher-suite-mini-pill ${counts.fnd >= 30 ? 'is-full' : ''}">NT ${counts.fnd}/30</span>` : '',
      counts.acd > 0 ? `<span class="teacher-suite-mini-pill ${counts.acd >= 20 ? 'is-full' : ''}">HT ${counts.acd}/20</span>` : '',
      counts.para > 0 ? `<span class="teacher-suite-mini-pill ${counts.para >= 30 ? 'is-full' : ''}">P ${counts.para}/30</span>` : '',
      counts.adv > 0 ? `<span class="teacher-suite-mini-pill ${counts.adv >= 30 ? 'is-full' : ''}">CS ${counts.adv}/30</span>` : '',
    ].filter(Boolean).join('');

    const chipsHtml = tags.map((t) => `<span class="teacher-task-done-chip">${esc(t)}</span>`).join('');
    return `
      <div class="teacher-task-compact-cell">
        <div class="teacher-task-compact-top">
          ${!isSummaryModal ? `<strong>${sorted.length}/${totalTasks}</strong>` : ''}
          ${suitePills}
        </div>
        <details class="teacher-task-more-details">
          <summary>Xem chi tiết ${sorted.length} Task</summary>
          <div class="teacher-task-more-grid">${chipsHtml}</div>
        </details>
      </div>
    `;
  }

  function exportClassReportCsv() {
    const bridge = B();
    if (!bridge?.isTeacherUser?.()) return;
    const ranked = bridge.getClassRankedEntries?.('week') || [];
    const cache = bridge.getCloudClassCache?.() || {};
    const totalTasks = getAllCatalogTasks().length || 110;
    const header = [
      'Hạng', 'Họ và tên', 'Điểm xếp hạng', 'Hôm nay (phút)', 'Tuần này (phút)', 'Tháng này (phút)',
      'Chuỗi ngày', 'Từ đã thuộc', `Số Task xong (/${totalTasks})`, 'Điểm Dịch AI TB', 'Chi tiết các Task đã xong'
    ];
    const rows = ranked.map((item) => {
      const uid = bridge.getScopedUid(item.id);
      const streak = item.streak ?? (bridge.computeConsecutiveStreakForUser?.(item.id) || 0);
      const tp = readStudentTaskMap(bridge, cache, bridge.TASK_PROGRESS_KEY_BASE, uid);
      const doneEntries = Object.entries(tp).filter(([, v]) => v?.status === 'completed');
      const avgAi = computeAvgAiScore(doneEntries);
      const details = doneEntries.map(([tid, v]) => formatTaskDoneTag(tid, v)).join('; ');
      return [
        item.rankLabel || `#${item.rank}`, item.name, item.score ?? 0, item.todayMins, item.weekMins, item.monthMins,
        streak, item.mastered, doneEntries.length, avgAi, details
      ].map(formatCsvCell).join(',');
    });
    const csvContent = '\uFEFF' + [header.map(formatCsvCell).join(','), ...rows].join('\r\n');
    try { window.__LAST_EXPORTED_CLASS_CSV__ = csvContent; } catch (_) {}

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bao_Cao_Lop_IELTS_Vocab_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    bridge.showToast?.('Đã xuất file Excel (.csv) báo cáo lớp!');
  }

  let teacherTableView = 'today';

  function setTeacherTableView(mode) {
    const next = (mode === 'today' || mode === 'month' || mode === 'full') ? mode : 'full';
    teacherTableView = next;
    document.querySelectorAll('#teacher-view-tabs .teacher-view-tab').forEach((btn) => {
      const active = btn.getAttribute('data-view') === next;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    renderTeacherDashboard();
  }

  function renderTeacherDashboard() {
    const bridge = B();
    if (!bridge?.isTeacherUser?.()) return;
    const esc = bridge.escapeHtml || ((x) => String(x));
    const statusEl = document.getElementById('teacher-sync-status');
    const syncTime = bridge.getLastCloudSyncTime?.();
    if (statusEl) {
      statusEl.textContent = syncTime ? `Cập nhật lúc ${syncTime}` : 'Theo dõi giờ học & Task của cả lớp';
    }

    const viewMode = (teacherTableView === 'today' || teacherTableView === 'month') ? teacherTableView : 'full';
    document.querySelectorAll('#teacher-view-tabs .teacher-view-tab').forEach((btn) => {
      const active = btn.getAttribute('data-view') === viewMode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });

    const thead = document.getElementById('teacher-dashboard-thead');
    const tbody = document.getElementById('teacher-dashboard-tbody');
    if (tbody) {
      const ranked = bridge.getClassRankedEntries?.(viewMode === 'month' ? 'month' : 'week') || [];
      const cache = bridge.getCloudClassCache?.() || {};
      const totalTasks = getAllCatalogTasks().length || 110;
      const now = Date.now();
      const nowDate = new Date(now);
      const todayKey = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
      const curYear = nowDate.getFullYear();
      const curMonth = nowDate.getMonth();
      const searchEl = document.getElementById('teacher-student-search');
      if (searchEl) {
        const curTeacherId = String(bridge.getCurrentUser?.()?.id || '').trim().toLowerCase();
        const rawSearch = String(searchEl.value || '').trim().toLowerCase();
        let isAutofilled = false;
        try { isAutofilled = searchEl.matches(':-webkit-autofill'); } catch (_) {}
        if (isAutofilled || (!searchEl.matches(':focus') && curTeacherId && rawSearch === curTeacherId)) {
          searchEl.value = '';
        }
      }
      const q = (searchEl?.value || '').trim().toLowerCase();

      const isTaskInPeriod = (rec, mode) => {
        if (mode === 'full') return true;
        const ts = Number(rec?.updatedAt || rec?.completedAt || 0);
        if (!ts) return false;
        const d = new Date(ts);
        if (mode === 'today') {
          const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          return k === todayKey;
        }
        if (mode === 'month') {
          return d.getFullYear() === curYear && d.getMonth() === curMonth;
        }
        return true;
      };

      const allEnriched = ranked.map((item) => {
        const uid = bridge.getScopedUid(item.id);
        const streak = item.streak ?? (bridge.computeConsecutiveStreakForUser?.(item.id) || 0);
        const tp = readStudentTaskMap(bridge, cache, bridge.TASK_PROGRESS_KEY_BASE, uid);
        const tl = readStudentTaskMap(bridge, cache, bridge.TASK_LOCKS_KEY_BASE, uid);
        const doneEntries = Object.entries(tp).filter(([, v]) => v?.status === 'completed');
        const periodDoneEntries = viewMode === 'full'
          ? doneEntries
          : doneEntries.filter(([, v]) => isTaskInPeriod(v, viewMode));
        const periodMins = viewMode === 'today' ? Number(item.todayMins || 0) : (viewMode === 'month' ? Number(item.monthMins || 0) : Number(item.weekMins || 0));
        const periodWords = viewMode === 'today' ? Number(item.todayWords || 0) : (viewMode === 'month' ? Number(item.monthWords || 0) : Number(item.mastered || 0));
        const periodActivityScore = (periodDoneEntries.length * 100) + (periodWords * 10) + periodMins;
        return { item, streak, doneEntries, periodDoneEntries, periodMins, periodWords, periodActivityScore, tl };
      });

      if (viewMode !== 'full') {
        allEnriched.sort((a, b) => (
          (b.periodActivityScore - a.periodActivityScore)
          || (b.periodWords - a.periodWords)
          || (b.periodMins - a.periodMins)
          || (b.periodDoneEntries.length - a.periodDoneEntries.length)
          || (Number(a.item.order || 0) - Number(b.item.order || 0))
        ));
      }

      const chestnutUnit = `<span class="tot-chestnut-unit" aria-label="hạt dẻ"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.4C13 4.6 19.8 8.2 21 13.8C21.8 17.6 18.6 21 12 21C5.4 21 2.2 17.6 3 13.8C4.2 8.2 11 4.6 12 2.4Z" fill="#8B3A14" stroke="#531F07" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 17.5C7 15.8 17 15.8 19 17.5C17.6 19.9 15 20.8 12 20.8C9 20.8 6.4 19.9 5 17.5Z" fill="#E8CCA0"/><path d="M7.2 12.2C7.8 9.6 9.8 7.8 11.4 6.6" stroke="#DF8B56" stroke-width="1.6" stroke-linecap="round" opacity=".85"/></svg></span>`;
      const kpiStrip = document.getElementById('teacher-kpi-strip');
      if (kpiStrip) {
        const totalStudents = allEnriched.length;
        if (viewMode === 'full') {
          const totalMastered = allEnriched.reduce((s, r) => s + Number(r.item.mastered || 0), 0);
          const totalDoneTasks = allEnriched.reduce((s, r) => s + r.doneEntries.length, 0);
          const topRow = allEnriched[0];
          const topLabel = (topRow && Number(topRow.item.score || 0) > 0)
            ? `${esc(topRow.item.name.split(' ').slice(-2).join(' '))} <span class="teacher-kpi-score">(${Number(topRow.item.score).toLocaleString('vi-VN')}${chestnutUnit})</span>`
            : 'Chưa phát sinh';
          kpiStrip.innerHTML = `
            <div class="teacher-kpi-card is-mint">
              <div class="teacher-kpi-label">Học viên</div>
              <div class="teacher-kpi-val tabular">${totalStudents}</div>
            </div>
            <div class="teacher-kpi-card is-gold">
              <div class="teacher-kpi-label">Tổng từ đã thuộc</div>
              <div class="teacher-kpi-val tabular">${totalMastered.toLocaleString('vi-VN')} <span class="teacher-kpi-unit">từ</span></div>
            </div>
            <div class="teacher-kpi-card is-coral">
              <div class="teacher-kpi-label">Lượt Task hoàn thành</div>
              <div class="teacher-kpi-val tabular">${totalDoneTasks.toLocaleString('vi-VN')}</div>
            </div>
            <div class="teacher-kpi-card is-teal">
              <div class="teacher-kpi-label">Dẫn đầu tuần</div>
              <div class="teacher-kpi-val teacher-kpi-leader tabular">${topLabel}</div>
            </div>
          `;
        } else {
          const periodLabel = viewMode === 'today' ? 'hôm nay' : 'tháng này';
          const activeCount = allEnriched.filter((r) => r.periodActivityScore > 0).length;
          const totalPeriodMins = allEnriched.reduce((s, r) => s + r.periodMins, 0);
          const totalPeriodWords = allEnriched.reduce((s, r) => s + r.periodWords, 0);
          const totalPeriodTasks = allEnriched.reduce((s, r) => s + r.periodDoneEntries.length, 0);
          kpiStrip.innerHTML = `
            <div class="teacher-kpi-card is-mint">
              <div class="teacher-kpi-label">Học viên học ${periodLabel}</div>
              <div class="teacher-kpi-val tabular">${activeCount}/${totalStudents}</div>
            </div>
            <div class="teacher-kpi-card is-teal">
              <div class="teacher-kpi-label">Tổng phút học ${periodLabel}</div>
              <div class="teacher-kpi-val tabular">${totalPeriodMins.toLocaleString('vi-VN')} <span class="teacher-kpi-unit">phút</span></div>
            </div>
            <div class="teacher-kpi-card is-gold">
              <div class="teacher-kpi-label">Tổng từ ${periodLabel}</div>
              <div class="teacher-kpi-val tabular">${totalPeriodWords.toLocaleString('vi-VN')} <span class="teacher-kpi-unit">từ</span></div>
            </div>
            <div class="teacher-kpi-card is-coral">
              <div class="teacher-kpi-label">Task xong ${periodLabel}</div>
              <div class="teacher-kpi-val tabular">${totalPeriodTasks.toLocaleString('vi-VN')}</div>
            </div>
          `;
        }
      }

      if (thead) {
        if (viewMode === 'full') {
          thead.innerHTML = `
            <tr>
              <th>#</th>
              <th>Học viên</th>
              <th>Hôm nay</th>
              <th>Tuần này</th>
              <th>Tháng này</th>
              <th>Chuỗi ngày</th>
              <th>Từ đã thuộc</th>
              <th>Task hoàn thành</th>
              <th>Trạng thái</th>
            </tr>
          `;
        } else {
          thead.innerHTML = `
            <tr>
              <th>#</th>
              <th>Học viên</th>
              <th>Số phút học</th>
              <th>Số từ</th>
              <th>Task hoàn thành</th>
              <th>Trạng thái</th>
            </tr>
          `;
        }
      }

      const enriched = allEnriched.filter((row) => !q || String(row.item.name || '').toLowerCase().includes(q) || String(row.item.id || '').toLowerCase().includes(q));

      const getMonogram = (name) => {
        const pts = String(name || 'HV').trim().split(/\s+/).filter(Boolean);
        return (pts.length >= 2 ? (pts[pts.length - 2][0] + pts[pts.length - 1][0]) : (pts[0] || 'HV').slice(0, 2)).toUpperCase();
      };

      const renderStatusCell = (item, tl) => {
        const activeLocks = Object.entries(tl).filter(([, until]) => Number(until || 0) > now);
        return activeLocks.length > 0
          ? `<div class="teacher-status-cell is-locked">
              ${activeLocks.map(([tid, until]) => `<span class="teacher-lock-pill">Khóa T${Number(tid.replace(/\D/g, '')) || tid} (${formatMmSs(Number(until) - now)})</span>`).join('')}
              <button type="button" class="btn-teacher-unlock" onclick="TasksModule.unlockStudentTasks('${esc(item.id)}')" title="Mở khóa cho học viên">Mở khóa</button>
            </div>`
          : '<span class="teacher-status-ok">Bình thường</span>';
      };

      if (viewMode === 'full') {
        tbody.innerHTML = enriched.map(({ item, streak, doneEntries, tl }, idx) => {
          const taskSummary = renderCompactCompletedTasksCell(doneEntries, totalTasks, esc, false);
          const statusCell = renderStatusCell(item, tl);
          return `
            <tr>
              <td class="tabular">${item.rankLabel || `#${item.rank}`}</td>
              <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(getMonogram(item.name))}</span><div style="min-width:0;"><strong>${esc(item.name)}</strong><div class="teacher-student-score tabular">${Number(item.score || 0).toLocaleString('vi-VN')}${chestnutUnit}</div></div></div></td>
              <td class="tabular">${item.todayMins}p</td>
              <td class="tabular">${item.weekMins}p</td>
              <td class="tabular">${item.monthMins}p</td>
              <td class="tabular">${streak} ngày</td>
              <td class="tabular"><strong>${item.mastered} từ</strong></td>
              <td style="font-size:12.5px;">${taskSummary}</td>
              <td style="font-size:12.5px;">${statusCell}</td>
            </tr>
          `;
        }).join('') || '<tr><td colspan="9" style="text-align:center;">Không tìm thấy học viên phù hợp.</td></tr>';
      } else {
        let rankCounter = 0;
        tbody.innerHTML = enriched.map(({ item, periodDoneEntries, periodMins, periodWords, periodActivityScore, tl }, idx) => {
          const rankLabel = periodActivityScore > 0 ? `#${++rankCounter}` : '–';
          const taskSummary = renderCompactCompletedTasksCell(periodDoneEntries, totalTasks, esc, false);
          const statusCell = renderStatusCell(item, tl);
          return `
            <tr>
              <td class="tabular">${rankLabel}</td>
              <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(getMonogram(item.name))}</span><div style="min-width:0;"><strong>${esc(item.name)}</strong></div></div></td>
              <td class="tabular"><strong>${periodMins}p</strong></td>
              <td class="tabular"><strong>${periodWords} từ</strong></td>
              <td style="font-size:12.5px;">${taskSummary}</td>
              <td style="font-size:12.5px;">${statusCell}</td>
            </tr>
          `;
        }).join('') || '<tr><td colspan="6" style="text-align:center;">Không tìm thấy học viên phù hợp.</td></tr>';
      }
    }

    renderTeacherTasksGrid();
    updateTeacherLinkPreview();
    try {
      const savedKey = localStorage.getItem(LOCAL_AI_KEY_STORAGE) || '';
      const dashKey = document.getElementById('teacher-dash-gemini-key');
      if (dashKey && dashKey.value !== savedKey) dashKey.value = savedKey;
    } catch (_) {}
  }

  function refreshTeacherDashboard() {
    B()?.syncPullClassData?.();
    renderTeacherDashboard();
    B()?.showToast('Đã làm mới bảng theo dõi lớp!');
  }

  // =========================================================
  // STUDENT TASK HUB & PRE-TASK BRIEFING MODAL
  // =========================================================
  function switchStudentTaskTab(scopeKey) {
    if (!TASK_SUITES_META.some((m) => m.key === scopeKey)) return;
    activeStudentTaskTab = scopeKey;
    renderStudentTasksModalBody();
  }

  function renderStudentTasksModalBody() {
    const grid = document.getElementById('student-task-grid');
    const tabsEl = document.getElementById('student-task-suite-tabs');
    const progEl = document.getElementById('student-task-suite-progress');
    if (!grid) return;
    const progress = loadTaskProgress();
    const esc = B()?.escapeHtml || ((x) => String(x));
    if (tabsEl) tabsEl.style.display = 'none';

    const listToShow = getActiveAssignedTasks();

    if (progEl) {
      if (listToShow.length === 0) {
        progEl.style.display = 'none';
      } else {
        const doneCnt = listToShow.filter((t) => progress[t.id]?.status === 'completed').length;
        const totCnt = listToShow.length;
        const pct = Math.round((doneCnt / totCnt) * 100);
        progEl.style.display = 'flex';
        progEl.innerHTML = `
          <div class="task-suite-prog-top">
            <span>Tiến độ bài được giao còn hạn</span>
            <strong>${doneCnt} / ${totCnt} hoàn thành (${pct}%)</strong>
          </div>
          <div class="task-suite-prog-track"><div class="task-suite-prog-fill" style="width:${pct}%"></div></div>
        `;
      }
    }

    if (listToShow.length === 0) {
      grid.innerHTML = `
        <div style="grid-column:1 / -1; text-align:center; padding:30px 18px; border:1px dashed var(--border-strong); border-radius:14px; background:var(--surface-item);">
          <div style="font-size:15.5px; font-weight:800; color:var(--ink); margin-bottom:6px;">Hiện chưa có Task nào đang được giao còn trong thời hạn làm</div>
          <div style="font-size:13px; color:var(--ink-2); line-height:1.55; max-width:460px; margin:0 auto 14px;">
            Khi giáo viên gửi link giao bài (hoặc còn hạn làm bài), các Task sẽ hiển thị tại đây. Bạn có thể tự luyện bất kỳ Task nào trong mục Task.
          </div>
          <button type="button" class="btn btn-primary" onclick="TasksModule.closeStudentTasksModal(); window.TotoroUI?.switchView?.('task');">Mở kho 110 Task tự luyện →</button>
        </div>
      `;
      return;
    }

    grid.innerHTML = listToShow.map((t, idx) => {
      const exp = getTaskExpiryState(t.id);
      const done = exp.completed;
      const lockRem = getTaskLockRemainingMs(t.id);
      const isRecog = t.taskKind === 'recognition';
      const scoreBadge = isRecog
        ? `${progress[t.id]?.recognitionScore ?? '--'}%`
        : `${progress[t.id]?.translationScore ?? '--'}/10`;
      const numStr = String(t.num || (idx + 1)).padStart(2, '0');
      let statusText = `${t.theme} · ~${t.estMinutes}p`;
      let clsState = '';
      let subCls = '';
      let dotCls = 'is-idle';

      if (exp.expired && !done) {
        statusText = `Task đã kết thúc (Hết hạn lúc ${exp.formattedAt})`;
        clsState = 'is-locked';
        subCls = 'task-text-err';
        dotCls = 'is-locked';
      } else if (exp.expired && done) {
        statusText = `✓ Hoàn thành (${scoreBadge}) · Hết hạn (Chỉ xem kết quả)`;
        clsState = 'is-done';
        subCls = 'task-text-ok';
        dotCls = 'is-done';
      } else if (done) {
        statusText = `✓ Hoàn thành (${scoreBadge})` + (exp.hasDeadline ? ` · Còn ${formatDeadlineRemaining(exp.remainingMs)}` : '');
        clsState = 'is-done';
        subCls = 'task-text-ok';
        dotCls = 'is-done';
      } else if (lockRem > 0) {
        statusText = `Khóa ${formatMmSs(lockRem)}`;
        clsState = 'is-locked';
        subCls = 'task-text-err';
        dotCls = 'is-locked';
      } else if (exp.hasDeadline) {
        statusText = `${t.theme} · Còn ${formatDeadlineRemaining(exp.remainingMs)}`;
      }
      return `
        <button type="button" class="teacher-task-item task-card-modern ${clsState}" style="text-align:left;" onclick="TasksModule.closeStudentTasksModal(); TasksModule.openTaskBriefModal('${esc(t.id)}')">
          <span class="task-num-badge ${dotCls}">${esc(numStr)}</span>
          <div class="task-card-body">
            <div class="teacher-task-title">${esc(t.label)}</div>
            <div class="teacher-task-sub ${subCls}">${esc(statusText)}</div>
          </div>
          <span class="task-status-dot ${dotCls}" aria-hidden="true"></span>
        </button>
      `;
    }).join('');
  }

  function openStudentTasksModal() {
    const curScope = B()?.getCurrentScopeKey?.() || '';
    if (TASK_SUITES_META.some((m) => m.key === curScope)) {
      activeStudentTaskTab = curScope;
    } else if (isAnyTaskId(curScope)) {
      const curT = getTaskById(curScope);
      if (curT?.scopeKey) activeStudentTaskTab = curT.scopeKey;
    }
    renderStudentTasksModalBody();
    document.getElementById('modal-student-tasks')?.classList.add('open');
  }

  function closeStudentTasksModal(event) {
    if (event && event.target !== document.getElementById('modal-student-tasks')) return;
    document.getElementById('modal-student-tasks')?.classList.remove('open');
  }

  function openTaskBriefModal(tid) {
    const t = getTaskById(tid);
    if (!t) return;
    pendingTaskId = t.id;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const pill = document.getElementById('brief-task-pill');
    const theme = document.getElementById('brief-task-theme');
    const info = document.getElementById('brief-task-info');
    if (pill) pill.textContent = t.label.toUpperCase();
    if (theme) theme.textContent = t.theme;

    const progress = loadTaskProgress()[t.id];
    const exp = getTaskExpiryState(t.id);
    const isParaSuite = t.scopeKey === 'paraphrase' || /^task_/i.test(t.id || '');
    const doneScoreStr = `Test 3: ${progress?.translationScore ?? '--'}/10`;
    const doneNote = progress?.status === 'completed'
      ? `<div class="task-text-ok" style="margin-top:8px; font-weight:700;">✓ Bạn đã hoàn thành Task này (${doneScoreStr}).${exp.expired ? ' Đã hết thời hạn — chỉ có thể xem lại kết quả.' : ' Còn hạn: có thể làm lại để ôn tập.'}</div>`
      : '';
    const deadlineLine = exp.hasDeadline
      ? `<div id="brief-deadline-line" style="margin-top:6px; font-weight:700; color:${exp.expired ? '#dc2626' : 'var(--accent)'};">${exp.expired ? `Đã hết hạn lúc ${esc(exp.formattedAt)}` : `⏱ Thời hạn: còn ${esc(formatDeadlineRemaining(exp.remainingMs))} (đóng lúc ${esc(exp.formattedAt)})`}</div>`
      : '';

    const test2FlowDesc = isParaSuite
      ? 'Test 2 (Synonyms &amp; Điền từ)'
      : 'Test 2 (Điền từ)';
    if (info) {
      info.innerHTML = `
        <div><strong>Bước 1 — Học từ vựng:</strong> Học thuộc đủ <strong>${t.words.length}/${t.words.length} từ</strong> trên Flashcard trước (học xong mới mở được bài Test).</div>
        <div style="margin-top:6px;"><strong>Bước 2 — Làm Test (~${t.estMinutes} phút):</strong> Thuộc đủ ${t.words.length}/${t.words.length} từ → Làm <strong>Test 1 (Ghép từ) → ${test2FlowDesc} → Test 3 (Đọc hiểu &amp; Dịch bài)</strong>.</div>
        <div style="margin-top:6px;"><strong>Kỷ luật thi:</strong> Không rời tab hoặc ngưng thao tác quá 10 phút khi làm bài (vi phạm đủ <strong>3 lần</strong> sẽ bị <strong>khóa Task 30 phút</strong> và phải làm lại từ đầu).</div>
        ${deadlineLine}
        ${doneNote}
      `;
    }
    updateBriefLockUI();
    clearInterval(lockCountdownTimer);
    let briefPullTicks = 0;
    if (!isTeacherOrBypassed() && getTaskLockRemainingMs(t.id) > 0) {
      B()?.syncPullClassData?.();
    }
    lockCountdownTimer = setInterval(() => {
      updateBriefLockUI();
      briefPullTicks += 1;
      if (
        briefPullTicks % 5 === 0 &&
        pendingTaskId &&
        !isTeacherOrBypassed() &&
        getTaskLockRemainingMs(pendingTaskId) > 0 &&
        document.getElementById('modal-task-brief')?.classList.contains('open')
      ) {
        B()?.syncPullClassData?.();
      }
    }, 1000);
    document.getElementById('modal-task-brief')?.classList.add('open');
  }

  function checkTaskUnlockNow() {
    const bridge = B();
    bridge?.syncPullClassData?.()?.then?.(() => {
      updateBriefLockUI();
      updateTaskStudyBar();
      if (pendingTaskId && getTaskLockRemainingMs(pendingTaskId) <= 0) {
        bridge?.showToast?.('Task đã được mở khóa! Bạn có thể bắt đầu làm bài.');
      } else {
        bridge?.showToast?.('Chưa thấy lệnh mở khóa mới từ giáo viên — vui lòng thử lại sau vài giây.');
      }
    });
  }

  function getTaskNumberOrder(taskId) {
    return Number(String(taskId || '').replace(/\D/g, '')) || 0;
  }

  function getOldWordsToReviewForTask(taskId) {
    const curTask = getTaskById(taskId);
    const taskNum = getTaskNumberOrder(taskId);
    if (!curTask || taskNum < 2) return [];
    const bridge = B();
    const amap = bridge?.getAssessmentsMap?.() || {};
    const srs = bridge?.getSrsMap?.() || {};
    const prog = loadTaskProgress();
    const now = Date.now();
    const seen = new Set();
    const dueWords = [];

    getTasksByScope(curTask.scopeKey || 'paraphrase').forEach((prevTask) => {
      const prevNum = getTaskNumberOrder(prevTask.id);
      if (prevNum <= 0 || prevNum >= taskNum) return;
      const words = Array.isArray(prevTask.words) ? prevTask.words : [];
      const prevCompleted = prog[prevTask.id]?.status === 'completed';
      const prevStarted = prevCompleted || words.some((w) => w && (amap[w.id] > 0 || Boolean(srs[w.id])));
      if (!prevStarted) return;

      words.forEach((w) => {
        if (!w || !w.id || seen.has(w.id)) return;
        const lvl = Number(amap[w.id] || 0);
        const st = srs[w.id];
        const dueBySrs = Boolean(st && typeof st.dueAt === 'number' && st.dueAt <= now);
        const isOldStarted = prevCompleted || lvl > 0 || Boolean(st);
        if (isOldStarted && (lvl !== 3 || dueBySrs)) {
          seen.add(w.id);
          dueWords.push(w);
        }
      });
    });

    return dueWords;
  }

  function startPreTaskOldVocabReview() {
    const tid = pendingTaskId;
    if (!tid) return;
    const t = getTaskById(tid);
    const dueOld = getOldWordsToReviewForTask(tid);
    if (!dueOld.length) {
      updateBriefLockUI();
      return;
    }
    closeTaskBriefModal();
    if (window.RecognitionTestModule?.startOldReviewQuiz) {
      window.RecognitionTestModule.startOldReviewQuiz(dueOld, tid, t?.label || tid);
      return;
    }
    B()?.startOldVocabReview?.(dueOld, tid, t?.label || tid);
  }

  function updateBriefLockUI() {
    if (!pendingTaskId) return;
    const lockEl = document.getElementById('brief-task-lock');
    const startBtn = document.getElementById('btn-start-task');
    const viewBtn = document.getElementById('btn-view-expired-result');
    const reviewBtn = document.getElementById('btn-review-old-before-task');
    const dlLine = document.getElementById('brief-deadline-line');
    const exp = getTaskExpiryState(pendingTaskId);

    if (dlLine && exp.hasDeadline) {
      dlLine.style.color = exp.expired ? '#dc2626' : 'var(--accent)';
      dlLine.textContent = exp.expired
        ? `Đã hết hạn lúc ${exp.formattedAt}`
        : `⏱ Thời hạn: còn ${formatDeadlineRemaining(exp.remainingMs)} (đóng lúc ${exp.formattedAt})`;
    }

    if (!isTeacherOrBypassed() && exp.expired) {
      if (reviewBtn) reviewBtn.style.display = 'none';
      if (lockEl) {
        lockEl.style.display = 'flex';
        lockEl.style.alignItems = 'center';
        lockEl.style.justifyContent = 'space-between';
        lockEl.style.gap = '10px';
        lockEl.style.flexWrap = 'wrap';
        if (exp.completed) {
          lockEl.classList.add('is-info-ended');
          lockEl.innerHTML = `<span>Task đã hết thời hạn làm bài (${exp.formattedAt}). Bạn đã hoàn thành — không thể làm lại nữa, chỉ có thể xem lại kết quả.</span>`;
        } else {
          lockEl.classList.remove('is-info-ended');
          lockEl.innerHTML = `<span>Task đã kết thúc! Đã hết thời hạn làm bài (${exp.formattedAt}) — bạn chưa hoàn thành nên không thể vào làm hay xem kết quả.</span>`;
        }
      }
      if (startBtn) {
        if (exp.completed) {
          startBtn.style.display = 'none';
        } else {
          startBtn.style.display = 'inline-flex';
          startBtn.disabled = true;
          startBtn.textContent = 'Task đã kết thúc';
        }
      }
      if (viewBtn) viewBtn.style.display = exp.completed ? 'inline-flex' : 'none';
      return;
    }

    if (lockEl) lockEl.classList.remove('is-info-ended');
    if (viewBtn) viewBtn.style.display = 'none';
    if (reviewBtn) reviewBtn.style.display = 'none';
    if (startBtn) {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'Bắt đầu học từ vựng →';
    }

    const remMs = getTaskLockRemainingMs(pendingTaskId);
    if (remMs > 0) {
      if (lockEl) {
        lockEl.style.display = 'flex';
        lockEl.style.alignItems = 'center';
        lockEl.style.justifyContent = 'space-between';
        lockEl.style.gap = '10px';
        lockEl.style.flexWrap = 'wrap';
        lockEl.innerHTML = `<span>Task đang tạm khóa do vi phạm kỷ luật. Vui lòng quay lại sau ${formatMmSs(remMs)}.</span><button type="button" class="btn-subtle" style="padding:5px 10px; font-size:12px;" onclick="TasksModule.checkTaskUnlockNow()">Kiểm tra mở khóa</button>`;
      }
      if (startBtn) startBtn.disabled = true;
      return;
    }

    if (!isTeacherOrBypassed()) {
      const dueOld = getOldWordsToReviewForTask(pendingTaskId);
      if (dueOld.length > 0) {
        if (lockEl) {
          lockEl.style.display = 'flex';
          lockEl.style.alignItems = 'center';
          lockEl.style.justifyContent = 'space-between';
          lockEl.style.gap = '10px';
          lockEl.style.flexWrap = 'wrap';
          lockEl.innerHTML = `<span>Yêu cầu Speed Quiz từ cũ: Bạn còn <strong>${dueOld.length} từ cũ</strong> (thuộc các Task trước) chưa thuộc hết hoặc đến hạn ôn tập. Chỉ cần hoàn thành nhanh bài Speed Quiz ôn tập là được mở khóa!</span>`;
        }
        if (reviewBtn) {
          reviewBtn.style.display = 'inline-flex';
          reviewBtn.textContent = `Speed Quiz ${dueOld.length} từ cũ ngay →`;
        }
        if (startBtn) {
          startBtn.disabled = true;
          startBtn.textContent = `Cần Speed Quiz ${dueOld.length} từ cũ trước`;
        }
        return;
      }
    }

    if (lockEl) lockEl.style.display = 'none';
    if (startBtn) startBtn.disabled = false;
  }

  function viewExpiredTaskResult() {
    const tid = pendingTaskId;
    if (!tid) return;
    const exp = getTaskExpiryState(tid);
    if (!exp.completed && !isTeacherOrBypassed()) {
      B()?.showToast?.('Task đã kết thúc! Bạn chưa hoàn thành nên không thể xem kết quả.');
      return;
    }
    closeTaskBriefModal();
    openTaskSummaryModal(tid, false);
  }

  function closeTaskBriefModal(event) {
    if (event && event.target !== document.getElementById('modal-task-brief')) return;
    clearInterval(lockCountdownTimer);
    lockCountdownTimer = null;
    document.getElementById('modal-task-brief')?.classList.remove('open');
  }

  // =========================================================
  // ACTIVE TASK WORKSPACE + 10-MIN IDLE WATCHER (30-MIN LOCK)
  // =========================================================
  function startPendingTask() {
    if (!pendingTaskId) return;
    if (!isTeacherOrBypassed()) {
      const exp = getTaskExpiryState(pendingTaskId);
      if (exp.expired) {
        updateBriefLockUI();
        B()?.showToast?.(exp.completed
          ? 'Task đã hết hạn — không thể làm lại nữa, hãy bấm Xem kết quả bài làm.'
          : 'Task đã kết thúc! Hết thời hạn làm bài.');
        return;
      }
      if (getTaskLockRemainingMs(pendingTaskId) > 0) {
        updateBriefLockUI();
        return;
      }
      const dueOld = getOldWordsToReviewForTask(pendingTaskId);
      if (dueOld.length > 0) {
        updateBriefLockUI();
        B()?.showToast?.(`Cần hoàn thành Speed Quiz ${dueOld.length} từ vựng cũ trước khi vào ${getTaskById(pendingTaskId)?.label || 'Task'}!`);
        return;
      }
    }
    const t = getTaskById(pendingTaskId);
    if (!t) return;
    closeTaskBriefModal();
    enterTaskWorkspace(t);
  }

  function getTaskMasteredCount(task) {
    if (!task || !Array.isArray(task.words)) return 0;
    const amap = B()?.getAssessmentsMap?.() || {};
    return task.words.reduce((acc, w) => acc + (amap[w.id] === 3 ? 1 : 0), 0);
  }

  function syncAssignedTaskScopes(extraTask = null) {
    const ids = [...assignedUrlTaskIds];
    if (extraTask && !ids.includes(extraTask.id)) ids.push(extraTask.id);
    const list = ids.map(getTaskById).filter(Boolean);
    B()?.setDynamicTaskScopes?.(list);
  }

  function updateTaskStudyBar() {
    const bar = document.getElementById('task-study-bar');
    const finWarnEl = document.getElementById('fc-finished-task-warn');
    if (!bar) return;
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    if (!isAnyTaskId(scopeKey)) {
      bar.style.display = 'none';
      if (finWarnEl) finWarnEl.style.display = 'none';
      return;
    }
    const task = getTaskById(scopeKey) || activeTask;
    if (!task) {
      bar.style.display = 'none';
      if (finWarnEl) finWarnEl.style.display = 'none';
      return;
    }
    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    const allReady = masteredCount >= total;
    const prog = loadTaskProgress()[task.id];
    const isCompleted = Boolean(prog && prog.status === 'completed') || taskTestPassed;
    const examDesc = 'Test 1 + Test 2 + Test 3';
    if (finWarnEl) {
      const esc = B()?.escapeHtml || ((x) => String(x));
      if (!isCompleted && !isTeacherOrBypassed()) {
        finWarnEl.style.display = 'block';
        if (allReady) {
          finWarnEl.innerHTML = `<strong>Chưa hoàn thành ${esc(task.label)}!</strong> Bạn đã thuộc đủ ${total}/${total} từ — hãy bấm <strong>"Làm bài Test kết thúc Task →"</strong> bên dưới và vượt qua <strong>${examDesc}</strong> thì Task mới được tính hoàn thành.`;
        } else {
          finWarnEl.innerHTML = `<strong>Chưa hoàn thành ${esc(task.label)}!</strong> Xem hết lượt thẻ chưa tính xong Task. Bạn mới thuộc <strong>${masteredCount}/${total} từ</strong> (còn ${total - masteredCount} từ) — cần học thuộc đủ ${total}/${total} từ rồi làm bài <strong>Test kết thúc Task (${examDesc})</strong>.`;
        }
      } else {
        finWarnEl.style.display = 'none';
      }
    }
    bar.style.display = 'flex';
    const pill = document.getElementById('task-study-pill');
    if (pill) pill.textContent = task.label.toUpperCase();
    const statusEl = document.getElementById('task-study-status');
    if (statusEl) {
      statusEl.textContent = allReady
        ? `✓ Đã thuộc ${masteredCount} / ${total} từ!`
        : `Đã thuộc ${masteredCount} / ${total} từ`;
    }
    const testBtn = document.getElementById('btn-task-to-test1');
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.classList.toggle('btn-primary', allReady);
      testBtn.classList.toggle('btn-subtle', !allReady);
      testBtn.classList.toggle('is-test-ready', allReady);
      testBtn.textContent = allReady ? 'Làm Test →' : `TEST (${masteredCount}/${total})`;
    }
    const dlBadge = document.getElementById('task-study-deadline-badge');
    if (dlBadge) {
      const dl = !isTeacherOrBypassed() ? getTaskDeadlineInfo(task.id) : { hasDeadline: false };
      if (dl.hasDeadline) {
        dlBadge.style.display = 'inline-flex';
        dlBadge.classList.toggle('is-urgent', dl.remainingMs <= 5 * 60 * 1000);
        dlBadge.textContent = dl.expired ? '⏱ Hết giờ' : `⏱ Còn ${formatDeadlineRemaining(dl.remainingMs)}`;
      } else {
        dlBadge.style.display = 'none';
      }
    }
  }

  function openTaskExamReadyModal(task) {
    if (!task) return;
    const modal = document.getElementById('modal-task-exam-ready');
    if (!modal) return;
    const pill = document.getElementById('exam-ready-task-pill');
    const heading = document.getElementById('exam-ready-heading');
    const desc = document.getElementById('exam-ready-desc');
    const startBtn = document.getElementById('btn-confirm-open-task-exam');
    const isParaSuite = task.scopeKey === 'paraphrase' || /^task_/i.test(task.id || '');
    const t2SummaryDesc = isParaSuite ? 'Synonyms &amp; Điền từ' : 'Điền từ';
    if (pill) pill.textContent = task.label.toUpperCase();
    if (heading) heading.textContent = `Đã thuộc đủ ${task.words.length}/${task.words.length} từ (${task.label})`;
    if (desc) {
      desc.innerHTML = `Bước cuối: <strong>Test 1 (Ghép từ) → Test 2 (${t2SummaryDesc}) → Test 3 (Đọc hiểu &amp; Dịch bài)</strong>.`;
    }
    if (startBtn) {
      startBtn.textContent = 'Bắt đầu làm Test 1 →';
    }
    modal.classList.add('open');
  }

  function closeTaskExamReadyModal(event) {
    if (event && event.target !== document.getElementById('modal-task-exam-ready')) return;
    document.getElementById('modal-task-exam-ready')?.classList.remove('open');
  }

  function onClickStartTaskExam() {
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    const task = getTaskById(scopeKey) || activeTask;
    if (!task) return;
    if (!isTeacherOrBypassed() && getTaskLockRemainingMs(task.id) > 0) {
      openTaskBriefModal(task.id);
      return;
    }
    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    if (!isTeacherOrBypassed() && masteredCount < total) {
      B()?.showToast?.(`Hãy học và bấm '3 - Đã thuộc' cho đủ ${total}/${total} từ của ${task.label} trước khi làm Test (hiện ${masteredCount}/${total}).`);
      return;
    }
    activeTask = task;
    confirmStartTaskExam();
  }

  function resetActiveTaskStudy() {
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    const task = activeTask || getTaskById(scopeKey);
    if (!task || !Array.isArray(task.words)) return;
    const ids = task.words.map((w) => w.id).filter(Boolean);
    examReadyPromptShownForTaskId = null;
    const savedExam = loadActiveExamSession();
    if (savedExam && savedExam.taskId === task.id) clearActiveExamSession();
    B()?.resetWordAssessments?.(ids);
    closeTaskExamReadyModal();
    updateTaskStudyBar();
    B()?.showToast?.(`Đã làm mới ${ids.length} từ của ${task.label} về 0/${ids.length} — học từng từ rồi làm Test nhé!`);
  }

  function confirmStartTaskExam() {
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    const task = activeTask || getTaskById(scopeKey);
    if (!task) return;
    if (!isTeacherOrBypassed()) {
      const exp = getTaskExpiryState(task.id);
      if (exp.expired) {
        closeTaskExamReadyModal();
        exitTaskWorkspace(false);
        openTaskBriefModal(task.id);
        return;
      }
      if (getTaskLockRemainingMs(task.id) > 0) {
        closeTaskExamReadyModal();
        openTaskBriefModal(task.id);
        return;
      }
    }
    activeTask = task;
    closeTaskExamReadyModal();
    startTest1();
  }

  function canActivateTaskScope(taskId) {
    const t = getTaskById(taskId);
    if (!t) return false;
    if (isTeacherOrBypassed()) return true;
    const exp = getTaskExpiryState(t.id);
    if (exp.expired) {
      B()?.showToast?.(exp.completed
        ? `${t.label} đã hết hạn — chỉ có thể xem lại kết quả!`
        : `${t.label} đã kết thúc (hết thời hạn làm bài)!`);
      openTaskBriefModal(t.id);
      return false;
    }
    const remMs = getTaskLockRemainingMs(t.id);
    if (remMs > 0) {
      B()?.showToast?.(`${t.label} đang tạm khóa (${formatMmSs(remMs)}) — vui lòng đợi hết khóa hoặc nhờ giáo viên mở khóa!`);
      openTaskBriefModal(t.id);
      return false;
    }
    const dueOld = getOldWordsToReviewForTask(t.id);
    if (dueOld.length > 0) {
      B()?.showToast?.(`Cần ôn thuộc hết ${dueOld.length} từ cũ trước khi vào ${t.label}!`);
      openTaskBriefModal(t.id);
      return false;
    }
    return true;
  }

  function onScopeChanged(scopeKey) {
    if (isAnyTaskId(scopeKey)) {
      const t = getTaskById(scopeKey);
      if (t) {
        if (!isTeacherOrBypassed() && (getTaskExpiryState(t.id).expired || getTaskLockRemainingMs(t.id) > 0 || getOldWordsToReviewForTask(t.id).length > 0)) {
          stopIdleMonitor();
          activeTask = null;
          activeStage = 0;
          if (B()?.getCurrentScopeKey?.() === t.id) {
            B()?.loadMainScope?.(t.scopeKey || 'paraphrase');
          }
          openTaskBriefModal(t.id);
          updateTaskStudyBar();
          return;
        }
        if (!activeTask || activeTask.id !== t.id) {
          activeTask = t;
          activeStage = 0;
          taskStartedAt = Date.now();
          taskLeaveWarnings = 0;
          taskTestPassed = false;
          startIdleMonitor();
        }
      }
    } else if (activeTask && activeStage === 0) {
      stopIdleMonitor();
      activeTask = null;
    }
    updateTaskStudyBar();
  }

  function onStudyAssessmentChanged(scopeKey, _assessments, _item, level) {
    updateTaskStudyBar();
    if (!isAnyTaskId(scopeKey)) return;
    const task = getTaskById(scopeKey) || activeTask;
    if (!task) return;
    activeTask = task;
    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    if (level === 3 && activeStage === 0 && masteredCount >= total && examReadyPromptShownForTaskId !== task.id) {
      examReadyPromptShownForTaskId = task.id;
      openTaskExamReadyModal(task);
    }
  }

  function enterTaskWorkspace(task) {
    if (!isTeacherOrBypassed()) {
      const exp = getTaskExpiryState(task?.id);
      if (exp.expired) {
        B()?.showToast?.(exp.completed
          ? `${task.label} đã hết hạn — chỉ có thể xem lại kết quả!`
          : `${task.label} đã kết thúc (hết thời hạn làm bài)!`);
        openTaskBriefModal(task.id);
        return;
      }
      const dueOld = getOldWordsToReviewForTask(task?.id);
      if (dueOld.length > 0) {
        B()?.showToast?.(`Cần ôn thuộc hết ${dueOld.length} từ cũ trước khi vào ${task.label}!`);
        openTaskBriefModal(task.id);
        return;
      }
    }
    activeTask = task;
    activeStage = 0;
    learnIndex = 0;
    viewedWordIds = new Set();
    t1BoardIndex = 0;
    t1MatchedIds = new Set();
    t1SelectedLeft = null;
    t1Mistakes = 0;
    t1WrongWordIds = new Set();
    t2Index = 0;
    t2Correct = 0;
    t2Answered = false;
    t2WrongRecords = [];
    taskStartedAt = Date.now();
    taskLeaveWarnings = 0;
    lastTaskLeaveAt = 0;
    let reloadPenaltyNotice = '';
    if (!isTeacherOrBypassed()) {
      const savedExam = loadActiveExamSession();
      if (savedExam && savedExam.taskId === task.id && (Date.now() - Number(savedExam.updatedAt || 0)) < LOCK_PENALTY_MS) {
        taskStartedAt = Number(savedExam.startedAt) || taskStartedAt;
        taskLeaveWarnings = Number(savedExam.leaveWarnings || 0);
        if (savedExam.inExam) {
          taskLeaveWarnings += 1;
          if (taskLeaveWarnings >= 3) {
            clearActiveExamSession();
            lockAndExitActiveTask('Thoát/tải lại trang lần 3 khi đang làm Test — Task bị khóa 30 phút!');
            return;
          }
          saveActiveExamSession({
            ...savedExam,
            leaveWarnings: taskLeaveWarnings,
            inExam: false,
            updatedAt: Date.now(),
          });
          reloadPenaltyNotice = `Phát hiện tải lại trang khi đang làm Test (${task.label}) — cảnh báo ${taskLeaveWarnings}/3 (lần 3 sẽ khóa Task 30 phút và mất bài làm).`;
        }
      }
    }
    taskTestPassed = false;
    t1Completed = false;
    t2Completed = false;
    t3Completed = false;
    lastT3Grade = null;
    examReadyPromptShownForTaskId = null;
    document.getElementById('task-leave-warn-banner')?.remove();
    closeStudentTasksModal();

    // Load 50 words of this Task directly inside the unified main #screen-study UI (Flashcard vocabulary study first!)
    syncAssignedTaskScopes(task);
    B()?.activateTaskScope?.(task.id);
    window.TotoroUI?.switchView?.('flashcard', { fromUser: true });

    startIdleMonitor();
    updateTaskStudyBar();

    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    if (reloadPenaltyNotice) {
      B()?.showToast?.(reloadPenaltyNotice);
    } else if (masteredCount >= total) {
      B()?.showToast?.(`Đã mở ${task.label} (${masteredCount}/${total} từ đã thuộc). Ôn nhanh trên Flashcard rồi bấm "Làm Test →" khi sẵn sàng!`);
    } else {
      B()?.showToast?.(`Đã mở ${task.label} (${masteredCount}/${total} từ đã thuộc). Học thuộc đủ ${total} từ trên Flashcard rồi làm Test nhé!`);
    }
  }

  function hasIncompleteActiveTask() {
    if (isPreviewTestMode || isTeacherOrBypassed()) return false;
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    const task = activeTask || (isAnyTaskId(scopeKey) ? getTaskById(scopeKey) : null);
    if (!task) return false;
    if (activeStage < 1 && scopeKey !== task.id) return false;
    if (taskTestPassed) return false;
    const prog = loadTaskProgress()[task.id];
    if (prog && prog.status === 'completed') return false;
    if (getTaskExpiryState(task.id).expired) return false;
    return true;
  }

  function openTaskExitWarnModal(mode = 'exam') {
    const warnModal = document.getElementById('modal-task-exit-warn');
    if (!warnModal) return false;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const pillEl = document.getElementById('task-exit-warn-pill');
    const bannerEl = document.getElementById('task-exit-warn-banner');
    const detailEl = document.getElementById('task-exit-warn-detail');
    const confirmBtn = document.getElementById('btn-task-exit-confirm');
    const goTestBtn = document.getElementById('btn-task-exit-go-test');
    const stayBtn = document.getElementById('btn-task-exit-stay');

    if (mode === 'study') {
      const scopeKey = B()?.getCurrentScopeKey?.() || '';
      const task = activeTask || getTaskById(scopeKey);
      const total = task?.words?.length || 50;
      const masteredCount = task ? getTaskMasteredCount(task) : 0;
      const allReady = masteredCount >= total;
      const taskLabel = task?.label || 'Task';
      if (pillEl) {
        pillEl.textContent = 'CHƯA LÀM BÀI TEST KẾT THÚC TASK!';
        pillEl.style.background = '#d97706';
        pillEl.style.borderColor = '#d97706';
      }
      if (bannerEl) {
        bannerEl.innerHTML = allReady
          ? `Bạn đã thuộc đủ <strong>${total}/${total}</strong> từ nhưng <strong>CHƯA làm bài Test kết thúc ${esc(taskLabel)}</strong>! Bắt buộc phải hoàn thành đủ <strong>Test 1 + Test 2 + Test 3</strong> thì hệ thống mới ghi nhận xong Task.`
          : `Bạn mới thuộc <strong>${masteredCount}/${total}</strong> từ và <strong>CHƯA làm bài Test kết thúc ${esc(taskLabel)}</strong>! Học xong từ vựng bắt buộc phải thuộc đủ ${total}/${total} từ rồi làm bài Test (Test 1 + Test 2 + Test 3) mới được tính hoàn thành Task.`;
      }
      if (detailEl) {
        detailEl.innerHTML = allReady
          ? 'Hãy bấm <strong>"Làm bài Test kết thúc Task →"</strong> ngay để hoàn tất nhiệm vụ và lưu điểm bảng xếp hạng.'
          : `Còn <strong>${Math.max(0, total - masteredCount)} từ</strong> chưa bấm "Đã thuộc". Nếu thoát lúc này, ${esc(taskLabel)} vẫn ở trạng thái <strong>chưa hoàn thành</strong>.`;
      }
      if (confirmBtn) {
        confirmBtn.textContent = 'Vẫn thoát tạm (Chưa xong Task)';
      }
      if (goTestBtn) {
        goTestBtn.style.display = allReady ? 'inline-flex' : 'none';
      }
      if (stayBtn) {
        stayBtn.textContent = allReady ? 'Ở lại Task' : 'Quay lại hoàn thành Task';
        stayBtn.className = allReady ? 'btn-subtle' : 'btn btn-primary';
      }
      warnModal.classList.add('open');
      setTimeout(() => (allReady ? goTestBtn : stayBtn)?.focus(), 40);
      return true;
    }

    if (pillEl) {
      pillEl.textContent = 'CẢNH BÁO BỎ THI GIỮA CHỪNG';
      pillEl.style.background = '#dc2626';
      pillEl.style.borderColor = '#dc2626';
    }
    if (bannerEl) {
      bannerEl.innerHTML = 'Bạn đang làm bài Test kết thúc Task! Nếu thoát ra lúc này, bài làm dở sẽ bị hủy và <strong>Task này sẽ bị khóa 30 phút</strong>.';
    }
    if (detailEl) {
      detailEl.innerHTML = 'Bắt buộc phải hoàn thành đủ bài Test kết thúc Task (Test 1 + Test 2 + Test 3) mới được tính hoàn thành Task. Hệ thống không cho phép thoát tạm miễn phí giữa bài Test — chỉ Giáo viên mới có thể mở khóa sớm nếu bạn xác nhận thoát.';
    }
    if (confirmBtn) {
      confirmBtn.textContent = 'Bỏ thi & Khóa Task 30 phút';
    }
    if (goTestBtn) {
      goTestBtn.style.display = 'none';
    }
    if (stayBtn) {
      stayBtn.textContent = 'Tiếp tục làm bài';
      stayBtn.className = 'btn btn-primary';
    }
    warnModal.classList.add('open');
    setTimeout(() => stayBtn?.focus(), 40);
    return true;
  }

  function dismissTaskExitWarn() {
    document.getElementById('modal-task-exit-warn')?.classList.remove('open');
  }

  function startTaskExamFromExitWarn() {
    dismissTaskExitWarn();
    onClickStartTaskExam();
  }

  function confirmTaskExamAbort() {
    dismissTaskExitWarn();
    if (activeStage >= 1) {
      lockAndExitActiveTask('Tự ý thoát bài Test giữa chừng — Task bị khóa 30 phút!');
      return;
    }
    exitTaskWorkspace(true, true);
  }

  function exitTaskWorkspace(confirmExit = false, forceStudyExit = false) {
    const wasInExam = activeStage >= 1;
    if (wasInExam && !taskTestPassed && confirmExit && !isTeacherOrBypassed()) {
      if (openTaskExitWarnModal('exam')) return;
      lockAndExitActiveTask('Tự ý thoát bài Test giữa chừng — Task bị khóa 30 phút!');
      return;
    }

    if (!wasInExam && confirmExit && !forceStudyExit && hasIncompleteActiveTask()) {
      if (openTaskExitWarnModal('study')) return;
    }

    dismissTaskExitWarn();
    const examModal = document.getElementById('screen-task');
    if (examModal) {
      examModal.classList.remove('open', 'active', 'exam-no-copy');
    }
    B()?.syncExamLock?.(false);

    if (isPreviewTestMode) {
      isPreviewTestMode = false;
      activeTask = null;
      activeStage = 0;
      taskTestPassed = false;
      if (confirmExit) B()?.showToast('Đã đóng chế độ Test thử.');
      return;
    }

    if (wasInExam && !taskTestPassed && confirmExit) {
      // Teacher/preview fallback return to study deck
      activeStage = 0;
      updateTaskStudyBar();
      B()?.showToast('Đã đóng giao diện Test thử.');
      return;
    }

    stopIdleMonitor();
    const returnScope = activeTask?.scopeKey || 'paraphrase';
    activeTask = null;
    activeStage = 0;
    taskTestPassed = false;
    B()?.loadMainScope?.(returnScope);
    if (confirmExit) B()?.showToast('Đã quay lại màn hình học từ vựng chính.');
    updateTaskStudyBar();
    window.RecognitionTestModule?.updateScopeListTestButton?.();
  }

  function triggerExternalAntiCheatLock(taskId, reason) {
    const t = getTaskById(taskId) || activeTask;
    if (!t || isTeacherOrBypassed()) return;
    activeTask = t;
    lockAndExitActiveTask(`${reason} — ${t.label} bị khóa 30 phút!`);
  }

  function evaluateTaskIdleTimeout() {
    if (!activeTask || taskTestPassed || isPreviewTestMode) return false;
    const isTeacher = Boolean(B()?.isTeacherUser?.() || B()?.getCurrentUser?.()?.role === 'teacher');
    if (isTeacher) return false;
    if (lastActivityAt > 0 && (Date.now() - lastActivityAt >= IDLE_LIMIT_MS)) {
      lockAndExitActiveTask('Ngưng thao tác quá 10 phút — Task bị khóa 30 phút!');
      return true;
    }
    return false;
  }

  function bumpIdleActivity() {
    if (evaluateTaskIdleTimeout()) return;
    lastActivityAt = Date.now();
    B()?.syncStudyIdleClockUI?.(0, IDLE_LIMIT_MS, true);
  }

  function lockAndExitActiveTask(toastMsg) {
    if (!activeTask || isTeacherOrBypassed()) return;
    const failedTaskId = activeTask.id;
    dismissTaskExitWarn();
    clearActiveExamSession();
    const locks = loadTaskLocks();
    locks[failedTaskId] = Date.now() + LOCK_PENALTY_MS;
    saveTaskLocks(locks);
    B()?.saveAndSync?.();
    exitTaskWorkspace(false);
    B()?.showToast(toastMsg);
    openTaskBriefModal(failedTaskId);
  }

  function handleTaskTabLeave(customReason) {
    if (!activeTask || activeStage < 1 || taskTestPassed || isTeacherOrBypassed()) return;
    if (document.getElementById('modal-cheat-warn')?.classList.contains('open')) return;
    const now = Date.now();
    if (now - lastTaskLeaveAt < 800) return;
    lastTaskLeaveAt = now;
    taskLeaveWarnings += 1;
    persistActiveExamSnapshot();
    if (taskLeaveWarnings < 3) {
      const host = document.getElementById('screen-task');
      const container = document.getElementById('task-stage-container');
      if (activeStage === 1) t1SelectedLeft = null;
      if (container) container.style.setProperty('visibility', 'hidden');
      if (container && container.parentNode) {
        let banner = document.getElementById('task-leave-warn-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'task-leave-warn-banner';
          banner.className = 'task-lock-banner';
          container.parentNode.insertBefore(banner, container);
        }
        const leftTries = 3 - taskLeaveWarnings;
        banner.textContent = `Cảnh báo (lần ${taskLeaveWarnings}/3): Không chuyển tab hay bấm ra ngoài! Còn ${leftTries} lần — lần 3 sẽ khóa Task 30 phút và mất hết bài làm.`;
      }
      B()?.openCheatWarningModal?.(
        customReason || 'Không bấm ra ngoài hay chuyển tab khi đang làm Test!',
        () => {
          lastActivityAt = Date.now();
          if (container) container.style.removeProperty('visibility');
          if (activeStage === 1) renderTest1Stage();
        },
        taskLeaveWarnings,
        3
      );
      return;
    }
    B()?.closeCheatWarningModal?.();
    document.getElementById('task-stage-container')?.style.removeProperty('visibility');
    lockAndExitActiveTask('Rời màn hình / mở tab khác lần 2 khi đang làm Test — Task bị khóa 30 phút!');
  }

  function handleExternalTabIntrusion(reason) {
    handleTaskTabLeave(reason);
  }

  function bindTaskNoCopyOnce() {
    const host = document.getElementById('screen-task');
    if (!host || host.dataset.noCopyBound === '1') return;
    host.dataset.noCopyBound = '1';
    ['copy', 'cut', 'contextmenu'].forEach((evt) => {
      host.addEventListener(evt, (e) => {
        if (isTeacherOrBypassed() || !activeTask || activeStage < 1 || taskTestPassed) return;
        const t = e.target;
        const isEditable = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT');
        if (evt === 'contextmenu' || !isEditable) {
          e.preventDefault();
          B()?.showToast?.('Không được sao chép đề hoặc mở menu chuột phải khi đang làm Test!');
        }
      });
    });
  }

  function onTaskVisibilityChange() {
    if (document.hidden) {
      handleTaskTabLeave();
    } else {
      evaluateTaskIdleTimeout();
    }
  }

  function onTaskWindowBlur() {
    handleTaskTabLeave();
  }

  function onTaskWindowFocus() {
    evaluateTaskIdleTimeout();
  }

  function onTaskLearnKeydown(e) {
    if (!activeTask || activeStage !== 0) return;
    const tag = (e.target?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable) return;
    if (document.querySelector('.modal-overlay.open')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      bumpIdleActivity();
      if (learnIndex < activeTask.words.length - 1) stepLearnCard(1);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      bumpIdleActivity();
      if (learnIndex > 0) stepLearnCard(-1);
    }
  }

  function startIdleMonitor() {
    stopIdleMonitor();
    const isTeacher = Boolean(isPreviewTestMode || B()?.isTeacherUser?.() || B()?.getCurrentUser?.()?.role === 'teacher');
    if (!activeTask || isTeacher) return;
    lastActivityAt = Date.now();
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'input'].forEach((evt) => {
      window.addEventListener(evt, bumpIdleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', onTaskVisibilityChange);
    window.addEventListener('blur', onTaskWindowBlur);
    window.addEventListener('focus', onTaskWindowFocus);
    document.addEventListener('keydown', onTaskLearnKeydown);
    idleTimer = setInterval(() => {
      if (!activeTask) {
        stopIdleMonitor();
        return;
      }
      const exp = getTaskExpiryState(activeTask.id);
      if (exp.hasDeadline) {
        const remText = exp.expired ? '⏱ Hết giờ' : `⏱ Còn ${formatDeadlineRemaining(exp.remainingMs)}`;
        const urgent = exp.expired || exp.remainingMs <= 5 * 60 * 1000;
        ['task-study-deadline-badge', 'task-exam-deadline-badge'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.style.display = 'inline-flex';
            el.classList.toggle('is-urgent', urgent);
            el.textContent = remText;
          }
        });
        if (exp.expired) {
          const expiredId = activeTask.id;
          clearActiveExamSession();
          stopIdleMonitor();
          exitTaskWorkspace(false);
          B()?.showToast?.(exp.completed
            ? 'Đã hết thời hạn làm bài! Chỉ có thể xem lại kết quả.'
            : 'Đã hết thời hạn — Task đã kết thúc!');
          openTaskBriefModal(expiredId);
          return;
        }
      }
      const idleMs = Date.now() - lastActivityAt;
      const badge = document.getElementById('task-idle-badge');
      if (badge) {
        badge.textContent = `${formatMmSs(idleMs)} / 10:00`;
      }
      const studyIdle = document.getElementById('task-study-idle-badge');
      if (studyIdle) {
        studyIdle.textContent = `${formatMmSs(idleMs)} / 10:00`;
      }
      B()?.syncStudyIdleClockUI?.(idleMs, IDLE_LIMIT_MS, true);
      evaluateTaskIdleTimeout();
    }, 1000);
  }

  function stopIdleMonitor() {
    if (idleTimer) {
      clearInterval(idleTimer);
      idleTimer = null;
    }
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'input'].forEach((evt) => {
      window.removeEventListener(evt, bumpIdleActivity);
    });
    document.removeEventListener('visibilitychange', onTaskVisibilityChange);
    window.removeEventListener('blur', onTaskWindowBlur);
    window.removeEventListener('focus', onTaskWindowFocus);
    document.removeEventListener('keydown', onTaskLearnKeydown);
  }

  function updateStepPills() {
    const nav = document.getElementById('task-steps-nav');
    if (!nav) return;
    const isTeacher = isTeacherOrBypassed();
    if (isTeacher) {
      nav.innerHTML = `
        <button type="button" class="task-step-pill ${activeStage === 1 ? 'active' : ''}" onclick="TasksModule.openAdminTestPreview(1)" title="Xem Test 1">Test 1</button>
        <button type="button" class="task-step-pill ${activeStage === 2 ? 'active' : ''}" onclick="TasksModule.openAdminTestPreview(2)" title="Xem Test 2">Test 2</button>
        <button type="button" class="task-step-pill ${activeStage === 3 ? 'active' : ''}" onclick="TasksModule.openAdminTestPreview(3)" title="Xem Test 3">Test 3</button>
      `;
    } else {
      const stageText = activeStage === 1 ? 'Test 1' : activeStage === 2 ? 'Test 2' : 'Test 3';
      nav.innerHTML = `<span class="task-step-pill active" id="task-current-step-badge">${stageText}</span>`;
    }
  }

  function renderTaskStage() {
    if (!activeTask) return;
    bindTaskNoCopyOnce();
    const isBypassed = isTeacherOrBypassed();
    const isTestNow = activeStage >= 1 && !taskTestPassed && !isBypassed;
    if (isTestNow && B()?.syncExamLock?.(true, activeTask.label) === false) {
      activeStage = 0;
      document.getElementById('screen-task')?.classList.remove('open', 'active', 'exam-no-copy');
      return;
    }
    if (!isTestNow) {
      B()?.syncExamLock?.(false);
    }
    const examModal = document.getElementById('screen-task');
    if (examModal) {
      if (activeStage >= 1) {
        examModal.classList.add('open', 'active');
        const badge = document.getElementById('task-active-badge');
        const theme = document.getElementById('task-active-theme');
        const idleBadge = document.getElementById('task-idle-badge');
        if (badge) badge.textContent = activeTask.label.toUpperCase();
        if (theme) {
          theme.textContent = isBypassed
            ? `${activeTask.theme} · Chế độ Test`
            : activeTask.theme;
        }
        if (idleBadge) idleBadge.style.display = isBypassed ? 'none' : '';
        const examDlBadge = document.getElementById('task-exam-deadline-badge');
        if (examDlBadge) {
          const dl = !isBypassed ? getTaskDeadlineInfo(activeTask.id) : { hasDeadline: false };
          if (dl.hasDeadline) {
            examDlBadge.style.display = 'inline-block';
            examDlBadge.classList.toggle('is-urgent', dl.remainingMs <= 5 * 60 * 1000);
            examDlBadge.textContent = dl.expired ? 'Hết giờ' : `Còn ${formatDeadlineRemaining(dl.remainingMs)}`;
          } else {
            examDlBadge.style.display = 'none';
          }
        }
      } else {
        examModal.classList.remove('open', 'active');
      }
      examModal.classList.toggle('exam-no-copy', isTestNow);
    }
    updateStepPills();
    updateFinishButtonUI();
    if (isTestNow) persistActiveExamSnapshot();
    if (activeStage === 1) renderTest1Stage();
    else if (activeStage === 2) renderTest2Stage();
    else if (activeStage === 3) renderFinalTranslationStage();
  }

  function parseUrlPreviewStage(account) {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const rawAdmin = sp.get('adminTest');
      if (rawAdmin) return Math.max(1, Math.min(3, Number(rawAdmin) || 1));
      if (account?.role === 'teacher' && sp.get('test')) {
        return Math.max(1, Math.min(3, Number(sp.get('test')) || 1));
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  function openAdminTestPreview(_stage = 1, taskId = null) {
    const tid = normalizeTaskId(taskId)
      || Array.from(teacherSelectedIds)[0]
      || activeTask?.id
      || assignedUrlTaskIds[0]
      || 'task_01';
    const t = getTaskById(tid);
    if (!t) return;
    stopIdleMonitor();
    activeTask = t;
    isPreviewTestMode = true;
    lastPreviewSummaryRecord = null;
    taskTestPassed = false;
    t1Completed = false;
    t2Completed = false;
    t3Completed = false;
    lastT3Grade = null;
    taskStartedAt = Date.now();
    taskLeaveWarnings = 0;
    lastTaskLeaveAt = 0;
    t1BoardIndex = 0;
    t1Mistakes = 0;
    t1WrongWordIds = new Set();
    initTest2State(t);
    document.getElementById('task-leave-warn-banner')?.remove();

    const targetStage = Math.max(1, Math.min(3, Number(_stage) || 1));
    activeStage = targetStage;
    if (activeStage === 1) {
      buildRuntimeT1Boards(t);
      setupT1Board();
    } else if (activeStage === 3) {
      initTest3ReadingQuiz(t);
    }
    renderTaskStage();
  }

  function speakWord(text, accent) {
    B()?.speakText?.(text, accent);
  }

  function buildRuntimeT1Boards(task) {
    const words = Array.isArray(task?.words) ? task.words : [];
    const pool = shuffleArray(words.map((w) => ({ id: w.id, word: w.lemma, meaning: w.meaning })));
    _runtimeT1Boards = [];
    for (let i = 0; i < pool.length; i += 5) {
      _runtimeT1Boards.push(pool.slice(i, i + 5));
    }
    if (_runtimeT1Boards.length === 0 && Array.isArray(task?.test1Boards)) {
      _runtimeT1Boards = shuffleArray(task.test1Boards.map((b) => shuffleArray(b)));
    }
  }

  // =========================================================
  // STAGE 1: TEST 1 — 10 MINI MATCHING BOARDS x 5 PAIRS (RANDOMIZED)
  // =========================================================
  function startTest1() {
    if (!activeTask) return;
    if (!isTeacherOrBypassed() && getTaskExpiryState(activeTask.id).expired) {
      const expiredId = activeTask.id;
      clearActiveExamSession();
      exitTaskWorkspace(false);
      openTaskBriefModal(expiredId);
      return;
    }
    const total = activeTask.words.length || 50;
    if (!isTeacherOrBypassed() && getTaskMasteredCount(activeTask) < total) return;
    if (!isTeacherOrBypassed()) {
      const savedExam = loadActiveExamSession();
      if (savedExam && savedExam.taskId === activeTask.id && (Date.now() - Number(savedExam.updatedAt || 0)) < LOCK_PENALTY_MS) {
        taskStartedAt = Number(savedExam.startedAt) || taskStartedAt || Date.now();
        taskLeaveWarnings = Math.max(taskLeaveWarnings, Number(savedExam.leaveWarnings || 0));
      } else if (!taskStartedAt) {
        taskStartedAt = Date.now();
      }
    }
    activeStage = 1;
    taskTestPassed = false;
    t1Completed = false;
    t2Completed = false;
    t3Completed = false;
    lastT3Grade = null;
    t1BoardIndex = 0;
    t1Mistakes = 0;
    t1WrongWordIds = new Set();
    buildRuntimeT1Boards(activeTask);
    setupT1Board();
    renderTaskStage();
  }

  function setupT1Board() {
    const boards = _runtimeT1Boards.length ? _runtimeT1Boards : (activeTask?.test1Boards || []);
    const pairs = (boards[t1BoardIndex] || []).slice();
    t1SelectedLeft = null;
    t1MatchedIds = new Set();
    t1LeftOrder = shuffleArray(pairs);
    t1ShuffledRight = shuffleArray(pairs);
  }

  function renderTest1Stage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const boards = _runtimeT1Boards.length ? _runtimeT1Boards : (activeTask.test1Boards || []);
    const leftPairs = t1LeftOrder.length ? t1LeftOrder : (boards[t1BoardIndex] || []);

    const leftHtml = leftPairs.map((p) => {
      const matched = t1MatchedIds.has(p.id);
      const active = t1SelectedLeft === p.id;
      return `<button type="button" class="task-match-btn ${matched ? 'is-matched' : ''} ${active ? 'is-active' : ''}" ${matched ? 'disabled' : ''} onclick="TasksModule.pickT1Left('${esc(p.id)}')">${esc(p.word)}</button>`;
    }).join('');

    const rightHtml = t1ShuffledRight.map((p) => {
      const matched = t1MatchedIds.has(p.id);
      return `<button type="button" class="task-match-btn ${matched ? 'is-matched' : ''}" id="t1-right-${esc(p.id)}" ${matched ? 'disabled' : ''} onclick="TasksModule.pickT1Right('${esc(p.id)}')">${esc(p.meaning)}</button>`;
    }).join('');

    const totalBoards = Math.max(1, boards.length);
    const t1Pct = Math.round(((t1BoardIndex + (t1MatchedIds.size / Math.max(1, leftPairs.length))) / totalBoards) * 100);

    container.innerHTML = `
      <div class="task-card-panel">
        <div class="task-stage-progress" aria-hidden="true">
          <div class="task-stage-progress-fill" style="width:${t1Pct}%;"></div>
        </div>
        <div class="task-exam-header-row">
          <div class="task-exam-title-group">
            <h2 class="task-exam-title">Ghép từ · Bảng ${t1BoardIndex + 1} / ${totalBoards}</h2>
          </div>
          <div class="task-stat-pills">
            <span class="task-err-pill ${t1Mistakes > 0 ? 'has-err' : ''}">Lỗi: <strong id="t1-err-cnt">${t1Mistakes}</strong></span>
            <span class="recall-stage-pill">${t1MatchedIds.size} / ${leftPairs.length} cặp</span>
          </div>
        </div>
        <div class="task-match-head">
          <span>Tiếng Anh</span>
          <span>Tiếng Việt</span>
        </div>
        <div class="task-match-wrap">
          <div class="task-match-col">${leftHtml}</div>
          <div class="task-match-col">${rightHtml}</div>
        </div>
      </div>
    `;
  }

  function pickT1Left(id) {
    if (t1MatchedIds.has(id)) return;
    t1SelectedLeft = id;
    renderTest1Stage();
  }

  function setupT2ParaBoard() {
    const pairs = (t2ParaBoards[t2ParaBoardIndex] || []).slice();
    t2ParaSelectedLeft = null;
    t2ParaSelectedRight = null;
    t2DraggingRightId = null;
    t2ParaMatchedIds = new Set();
    t2ParaLeftOrder = shuffleArray(pairs);
    t2ParaShuffledRight = shuffleArray(pairs);
  }

  function hasStemOverlap(a, b) {
    const normTokens = (s) => String(s || '')
      .toLowerCase()
      .trim()
      .split(/[\s\-/]+/)
      .map((t) => t.replace(/[^a-z]/g, ''))
      .filter((t) => t.length >= 4);
    const t1 = normTokens(a);
    const t2 = normTokens(b);
    for (const w1 of t1) {
      for (const w2 of t2) {
        const prefix = Math.min(5, w1.length, w2.length);
        if (prefix >= 4 && w1.slice(0, prefix) === w2.slice(0, prefix)) return true;
        if (
          w1.slice(0, 4) === w2.slice(0, 4) &&
          ((w1.endsWith('re') && w2.endsWith('er')) || (w1.endsWith('er') && w2.endsWith('re')))
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function isParaphraseTask(task) {
    return Boolean(task && (task.scopeKey === 'paraphrase' || /^task_/i.test(task.id || '')));
  }

  function buildRandomizedWbBoards(rawBoards, maxBoards) {
    const src = Array.isArray(rawBoards) ? shuffleArray(rawBoards).slice(0, maxBoards) : [];
    const keys = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    return src.map((board) => {
      const items = shuffleArray((board?.items || []).slice()).map((it, idx) => ({
        ...it,
        slotNum: idx + 1,
      }));
      const wordBox = shuffleArray((board?.wordBox || []).slice()).map((opt, idx) => ({
        ...opt,
        key: keys[idx] || opt.key || String(idx + 1),
      }));
      return {
        ...board,
        items,
        wordBox,
      };
    });
  }

  function getTaskTest2Total(task, rec = null) {
    if (rec && Number(rec.test2Total) > 0) return Number(rec.test2Total);
    if (task) {
      const wbArr = Array.isArray(task.test2WordBoxBoards) ? task.test2WordBoxBoards : [];
      if (!isParaphraseTask(task)) {
        const pickedBoards = wbArr.slice(0, 3);
        const wbCount = pickedBoards.reduce((sum, b) => sum + (Array.isArray(b?.items) ? b.items.length : 0), 0);
        return wbCount || 12;
      }
      const pairCount = Array.isArray(task.test2ParaphrasePairs) ? task.test2ParaphrasePairs.length : 0;
      const wbCount = wbArr.slice(0, 2).reduce((sum, b) => sum + (Array.isArray(b?.items) ? b.items.length : 0), 0);
      return (pairCount + wbCount) || 50;
    }
    return 50;
  }

  function setupT2WbBoard() {
    const cur = t2WbBoards[t2WbBoardIndex] || null;
    t2WbFills = {};
    t2WbSubmitted = false;
    t2WbActiveSlotId = cur?.items?.[0]?.id || null;
  }

  function initTest2State(task) {
    const isPara = isParaphraseTask(task);
    const pairs = [];
    const usedL = new Set();
    const usedR = new Set();

    // Paraphrase suite keeps Synonym/Paraphrase matching + Summary Word Box (strictly NO "Phần A/B" labels).
    // Foundation / Academic / Advanced suites go straight into Summary / Sentence Completion Word Box.
    if (isPara && Array.isArray(task?.test2ParaphrasePairs) && task.test2ParaphrasePairs.length > 0) {
      task.test2ParaphrasePairs.forEach((p, idx) => {
        const left = String(p?.left || '').trim();
        const right = String(p?.right || '').trim();
        if (!left || !right) return;
        const lKey = left.toLowerCase();
        const rKey = right.toLowerCase();
        if (lKey === rKey || usedL.has(lKey) || usedR.has(rKey)) return;
        usedL.add(lKey);
        usedR.add(rKey);
        pairs.push({
          id: String(p.id || `p_${idx}`),
          left,
          right,
          explain: String(p.explain || `${left} ↔ ${right}`),
        });
      });
    }

    const shuffledPairs = shuffleArray(pairs);
    t2ParaPairs = shuffledPairs;
    t2ParaBoards = [];
    for (let i = 0; i < shuffledPairs.length; i += 5) {
      t2ParaBoards.push(shuffledPairs.slice(i, i + 5));
    }
    t2ParaBoardIndex = 0;
    t2ParaSelectedLeft = null;
    t2ParaMatchedIds = new Set();
    t2ParaFailedIds = new Set();
    t2ParaMistakes = 0;
    t2ParaDone = t2ParaBoards.length === 0;
    setupT2ParaBoard();

    const maxWbBoards = isPara ? 2 : 3;
    t2WbBoards = buildRandomizedWbBoards(task?.test2WordBoxBoards || [], maxWbBoards);
    t2WbBoardIndex = 0;
    t2WbMistakes = 0;
    t2WbDone = t2WbBoards.length === 0;
    setupT2WbBoard();

    t2ContextQs = [];
    t2Index = 0;
    t2Correct = 0;
    t2Answered = false;
    t2WrongRecords = [];
  }

  function proceedToTest2FromT1() {
    if (!activeTask) return;
    t1Completed = true;
    activeStage = 2;
    initTest2State(activeTask);
    B()?.showToast(`Xong Test 1 (${t1Mistakes} lỗi)! Chuyển sang Test 2.`);
    renderTaskStage();
  }

  function renderTest1MistakeReviewStage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    t1Completed = true;
    updateFinishButtonUI();
    const esc = B()?.escapeHtml || ((x) => String(x));
    const wrongWords = (activeTask.words || []).filter((w) => t1WrongWordIds.has(w.id));
    if (wrongWords.length === 0) {
      proceedToTest2FromT1();
      return;
    }

    const cardsHtml = wrongWords.map((w) => `
      <div class="task-mistake-card">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
          <strong style="font-size:17px; color:var(--text-bright);">${esc(w.lemma)}</strong>
          ${w.pos ? `<span class="fc-pos" style="font-size:11px;">${esc(w.pos)}</span>` : ''}
        </div>
        ${w.ipa ? `<div style="font-size:12.5px; color:var(--text-muted); margin-top:2px;">${esc(w.ipa)}</div>` : ''}
        <div class="task-text-err" style="font-size:14.5px; font-weight:750; margin-top:6px;">${esc(w.meaning)}</div>
        ${w.synonyms?.length ? `<div style="font-size:12.5px; color:var(--text-muted); margin-top:4px;">Đồng nghĩa: ${esc(w.synonyms.slice(0, 3).join(', '))}</div>` : ''}
      </div>
    `).join('');

    container.innerHTML = `
      <div class="task-card-panel" id="task-t1-review-panel" style="text-align:center; padding:24px;">
        <span class="tip-pill task-badge-err">ÔN LẠI LỖI SAI · TEST 1</span>
        <h2 style="margin:10px 0 6px; font-size:21px; font-weight:850;">Hoàn thành Test 1 · Điểm lại ${wrongWords.length} từ từng ghép nhầm</h2>
        <p style="color:var(--text-muted); font-size:14px; margin:0 0 12px;">
          Xem nhanh nghĩa chính xác của các từ bạn vừa ghép nhầm (tổng ${t1Mistakes} lần nhầm) trước khi bước vào Test 2.
        </p>
        <div class="task-mistake-review-grid">${cardsHtml}</div>
        <button type="button" class="btn btn-primary" id="btn-t1-review-continue" onclick="TasksModule.proceedToTest2FromT1()">
          Đã ôn kỹ · Chuyển sang Test 2 →
        </button>
      </div>
    `;
  }

  function pickT1Right(rightId) {
    if (!t1SelectedLeft || t1MatchedIds.has(rightId)) return;
    if (t1SelectedLeft === rightId) {
      t1MatchedIds.add(rightId);
      t1SelectedLeft = null;
      const boards = _runtimeT1Boards.length ? _runtimeT1Boards : (activeTask.test1Boards || []);
      const curBoard = boards[t1BoardIndex] || [];
      if (t1MatchedIds.size >= curBoard.length) {
        if (t1BoardIndex < boards.length - 1) {
          t1BoardIndex++;
          setupT1Board();
          renderTest1Stage();
        } else {
          if (t1WrongWordIds.size > 0) {
            renderTest1MistakeReviewStage();
          } else {
            proceedToTest2FromT1();
          }
        }
        return;
      }
      renderTest1Stage();
    } else {
      t1Mistakes++;
      t1WrongWordIds.add(t1SelectedLeft);
      t1WrongWordIds.add(rightId);
      const el = document.getElementById(`t1-right-${rightId}`);
      el?.classList.add('is-err');
      t1SelectedLeft = null;
      setTimeout(() => renderTest1Stage(), 260);
    }
  }

  // =========================================================
  // STAGE 2: TEST 2 — DRAG & DROP PARAPHRASE MATCHING + CONTEXT (6 QS)
  // =========================================================
  function attemptT2PairMatch(leftId, rightId, viaDrop = false) {
    if (!leftId || !rightId || t2ParaMatchedIds.has(leftId) || t2ParaMatchedIds.has(rightId)) return;
    t2ParaSelectedLeft = null;
    t2ParaSelectedRight = null;
    t2DraggingRightId = null;
    if (leftId === rightId) {
      t2ParaMatchedIds.add(rightId);
      if (!t2ParaFailedIds.has(rightId)) {
        t2Correct++;
      }
      const curBoard = t2ParaBoards[t2ParaBoardIndex] || [];
      if (t2ParaMatchedIds.size >= curBoard.length) {
        if (t2ParaBoardIndex < t2ParaBoards.length - 1) {
          t2ParaBoardIndex++;
          setupT2ParaBoard();
        } else {
          t2ParaDone = true;
          B()?.showToast?.(t2WbBoards.length > 0
            ? 'Xong Nối Paraphrase đề thật! Tiếp tục phần Summary Word Box.'
            : 'Xong Nối từ tương đương! Tiếp tục phần Ngữ cảnh.');
        }
      }
      renderTest2Stage();
      return;
    }

    t2ParaMistakes++;
    t2ParaFailedIds.add(leftId);
    const curBoard = t2ParaBoards[t2ParaBoardIndex] || [];
    const chosenPair = curBoard.find((p) => p.id === rightId);
    const targetPair = curBoard.find((p) => p.id === leftId);
    if (targetPair && !t2WrongRecords.some((r) => r.prompt === `Paraphrase: ${targetPair.left}`)) {
      t2WrongRecords.push({
        prompt: `Paraphrase: ${targetPair.left}`,
        chosen: chosenPair?.right || '',
        answer: targetPair.right,
        explain: targetPair.explain || '',
      });
    }
    const rightEl = document.getElementById(`t2-para-right-${rightId}`);
    const leftEl = document.getElementById(`t2-para-left-${leftId}`);
    rightEl?.classList.add('is-err');
    if (viaDrop) leftEl?.classList.add('is-err');
    setTimeout(() => renderTest2Stage(), 260);
  }

  function pickT2ParaLeft(id) {
    if (t2ParaMatchedIds.has(id)) return;
    if (t2ParaSelectedRight) {
      attemptT2PairMatch(id, t2ParaSelectedRight, false);
      return;
    }
    t2ParaSelectedLeft = (t2ParaSelectedLeft === id) ? null : id;
    renderTest2Stage();
  }

  function cleanupT2FloatingDrag() {
    document.querySelectorAll('.t2-floating-block').forEach((el) => el.remove());
    document.querySelectorAll('.t2-dropzone.is-drop-over').forEach((el) => el.classList.remove('is-drop-over'));
    document.querySelectorAll('.t2-drag-card.is-source-lifted').forEach((el) => el.classList.remove('is-source-lifted'));
  }

  function bindT2PointerDrag() {
    cleanupT2FloatingDrag();
    document.querySelectorAll('.t2-drag-card:not(:disabled)').forEach((card) => {
      if (card.dataset.ptrDragBound === '1') return;
      card.dataset.ptrDragBound = '1';

      card.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        const rightId = card.dataset.rightId || '';
        if (!rightId || t2ParaMatchedIds.has(rightId)) return;

        const rect = card.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const offX = startX - rect.left;
        const offY = startY - rect.top;
        let dragging = false;
        let ghost = null;
        let activeDropEl = null;

        const onMove = (mv) => {
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!dragging && Math.hypot(dx, dy) > 4) {
            dragging = true;
            t2DraggingRightId = rightId;
            t2ParaSelectedLeft = null;
            t2ParaSelectedRight = null;
            card.classList.add('is-source-lifted');
            ghost = document.createElement('div');
            ghost.className = 't2-floating-block';
            ghost.style.width = `${rect.width}px`;
            ghost.style.minHeight = `${rect.height}px`;
            ghost.style.left = `${mv.clientX - offX}px`;
            ghost.style.top = `${mv.clientY - offY}px`;
            ghost.innerHTML = card.innerHTML;
            document.body.appendChild(ghost);
          }
          if (dragging && ghost) {
            ghost.style.left = `${mv.clientX - offX}px`;
            ghost.style.top = `${mv.clientY - offY}px`;
            const hit = document.elementFromPoint(mv.clientX, mv.clientY)?.closest?.('.t2-dropzone:not(:disabled)') || null;
            if (activeDropEl && activeDropEl !== hit) {
              activeDropEl.classList.remove('is-drop-over');
            }
            activeDropEl = hit;
            if (activeDropEl) activeDropEl.classList.add('is-drop-over');
          }
        };

        const cleanupListeners = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
        };

        const onCancel = () => {
          cleanupListeners();
          t2DraggingRightId = null;
          cleanupT2FloatingDrag();
        };

        const onUp = (up) => {
          cleanupListeners();
          if (!dragging) return;
          up.preventDefault();
          const hit = document.elementFromPoint(up.clientX, up.clientY)?.closest?.('.t2-dropzone:not(:disabled)') || activeDropEl;
          const leftId = hit?.dataset?.leftId || '';
          card.dataset.suppressClickUntil = String(Date.now() + 180);
          t2DraggingRightId = null;
          cleanupT2FloatingDrag();
          if (leftId) {
            attemptT2PairMatch(leftId, rightId, true);
          }
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
      });
    });
  }

  function pickT2ParaRight(rightId) {
    const el = document.getElementById(`t2-para-right-${rightId}`);
    if (el && Number(el.dataset.suppressClickUntil || 0) > Date.now()) return;
    if (t2ParaMatchedIds.has(rightId)) return;
    if (t2ParaSelectedLeft) {
      attemptT2PairMatch(t2ParaSelectedLeft, rightId, false);
      return;
    }
    t2ParaSelectedRight = (t2ParaSelectedRight === rightId) ? null : rightId;
    renderTest2Stage();
  }

  function onT2DragStart(event, rightId) { event?.preventDefault?.(); }
  function onT2DragEnd() { cleanupT2FloatingDrag(); }
  function onT2DragOver(event) { event?.preventDefault?.(); }
  function onT2DragLeave() {}
  function onT2Drop(event) { event?.preventDefault?.(); }

  function selectT2WbSlot(itemId) {
    if (t2WbSubmitted) return;
    if (t2WbActiveSlotId === itemId && t2WbFills[itemId]) {
      delete t2WbFills[itemId];
    } else {
      t2WbActiveSlotId = itemId;
    }
    renderTest2Stage();
  }

  function clearT2WbSlot(itemId, event) {
    event?.stopPropagation?.();
    if (t2WbSubmitted) return;
    delete t2WbFills[itemId];
    t2WbActiveSlotId = itemId;
    renderTest2Stage();
  }

  function placeT2WbOptionInSlot(optKey, targetSlotId) {
    if (t2WbSubmitted || !optKey || !targetSlotId) return;
    const curBoard = t2WbBoards[t2WbBoardIndex];
    if (!curBoard || !Array.isArray(curBoard.items)) return;
    if (!curBoard.items.some((x) => x.id === targetSlotId)) return;

    for (const [sid, key] of Object.entries(t2WbFills)) {
      if (key === optKey) {
        delete t2WbFills[sid];
      }
    }
    t2WbFills[targetSlotId] = optKey;
    const nextEmpty = curBoard.items.find((x) => !t2WbFills[x.id]);
    t2WbActiveSlotId = nextEmpty ? nextEmpty.id : targetSlotId;
    renderTest2Stage();
  }

  function pickT2WbOption(optKey) {
    if (t2WbSubmitted) return;
    const chipEl = document.getElementById(`t2-wb-chip-${optKey}`);
    if (chipEl && Number(chipEl.dataset.suppressClickUntil || 0) > Date.now()) return;
    const curBoard = t2WbBoards[t2WbBoardIndex];
    if (!curBoard || !Array.isArray(curBoard.items) || curBoard.items.length === 0) return;

    // If this option is already placed in a slot, clicking it frees it from the old slot first
    let prevSlot = null;
    for (const [sid, key] of Object.entries(t2WbFills)) {
      if (key === optKey) {
        prevSlot = sid;
        break;
      }
    }
    if (prevSlot && prevSlot === t2WbActiveSlotId) {
      delete t2WbFills[prevSlot];
      renderTest2Stage();
      return;
    }
    if (prevSlot) delete t2WbFills[prevSlot];

    let targetSlot = (t2WbActiveSlotId && curBoard.items.some((x) => x.id === t2WbActiveSlotId))
      ? t2WbActiveSlotId
      : null;
    if (!targetSlot || t2WbFills[targetSlot]) {
      const firstEmpty = curBoard.items.find((x) => !t2WbFills[x.id]);
      if (firstEmpty) targetSlot = firstEmpty.id;
      else targetSlot = targetSlot || curBoard.items[0].id;
    }
    t2WbFills[targetSlot] = optKey;

    const nextEmpty = curBoard.items.find((x) => !t2WbFills[x.id]);
    if (nextEmpty) t2WbActiveSlotId = nextEmpty.id;
    renderTest2Stage();
  }

  function bindT2WbDrag() {
    cleanupT2FloatingDrag();
    if (t2WbSubmitted) return;
    let html5DraggedKey = '';

    document.querySelectorAll('#t2-wb-wordbox .t2-wb-chip:not(:disabled)').forEach((chip) => {
      if (chip.dataset.wbDragBound === '1') return;
      chip.dataset.wbDragBound = '1';
      const optKey = chip.dataset.wbKey || '';
      if (!optKey) return;

      chip.addEventListener('dragstart', (e) => {
        html5DraggedKey = optKey;
        try { e.dataTransfer?.setData('text/plain', optKey); } catch (_) {}
      });

      chip.addEventListener('pointerdown', (e) => {
        if (e.button && e.button !== 0) return;
        const rect = chip.getBoundingClientRect();
        const startX = e.clientX;
        const startY = e.clientY;
        const offX = startX - rect.left;
        const offY = startY - rect.top;
        let dragging = false;
        let ghost = null;
        let activeDropEl = null;

        const clearDropHighlights = () => {
          document.querySelectorAll('.t2-wb-slot.is-drop-over, .t2-wb-sent-row.is-drop-over').forEach((el) => {
            el.classList.remove('is-drop-over');
          });
        };

        const resolveDropTarget = (x, y) => {
          const el = document.elementFromPoint(x, y);
          if (!el) return null;
          return el.closest('.t2-wb-slot[data-slot-id]') || el.closest('.t2-wb-sent-row[data-slot-id]') || null;
        };

        const onMove = (mv) => {
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!dragging && Math.hypot(dx, dy) > 4) {
            dragging = true;
            chip.classList.add('is-source-lifted');
            ghost = document.createElement('div');
            ghost.className = 't2-floating-block';
            ghost.style.width = `${Math.max(120, rect.width)}px`;
            ghost.style.minHeight = `${rect.height}px`;
            ghost.style.left = `${mv.clientX - offX}px`;
            ghost.style.top = `${mv.clientY - offY}px`;
            ghost.innerHTML = chip.innerHTML;
            document.body.appendChild(ghost);
          }
          if (dragging && ghost) {
            ghost.style.left = `${mv.clientX - offX}px`;
            ghost.style.top = `${mv.clientY - offY}px`;
            const hit = resolveDropTarget(mv.clientX, mv.clientY);
            if (activeDropEl && activeDropEl !== hit) {
              activeDropEl.classList.remove('is-drop-over');
            }
            activeDropEl = hit;
            if (activeDropEl) activeDropEl.classList.add('is-drop-over');
          }
        };

        const cleanupListeners = () => {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
          window.removeEventListener('pointercancel', onCancel);
        };

        const onCancel = () => {
          cleanupListeners();
          clearDropHighlights();
          chip.classList.remove('is-source-lifted');
          cleanupT2FloatingDrag();
        };

        const onUp = (up) => {
          cleanupListeners();
          if (!dragging) return;
          up.preventDefault();
          const hit = resolveDropTarget(up.clientX, up.clientY) || activeDropEl;
          const slotId = hit?.dataset?.slotId || '';
          chip.dataset.suppressClickUntil = String(Date.now() + 200);
          clearDropHighlights();
          chip.classList.remove('is-source-lifted');
          cleanupT2FloatingDrag();
          if (slotId) {
            placeT2WbOptionInSlot(optKey, slotId);
          }
        };

        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onCancel);
      });
    });

    document.querySelectorAll('#t2-wb-list .t2-wb-slot[data-slot-id], #t2-wb-list .t2-wb-sent-row[data-slot-id]').forEach((target) => {
      if (target.dataset.wbDropBound === '1') return;
      target.dataset.wbDropBound = '1';
      target.addEventListener('dragover', (e) => {
        e.preventDefault();
        target.classList.add('is-drop-over');
      });
      target.addEventListener('dragleave', () => {
        target.classList.remove('is-drop-over');
      });
      target.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        target.classList.remove('is-drop-over');
        let k = html5DraggedKey;
        try { k = e.dataTransfer?.getData('text/plain') || k; } catch (_) {}
        const slotId = target.dataset.slotId || '';
        if (k && slotId) {
          placeT2WbOptionInSlot(k, slotId);
        }
      });
    });
  }

  function submitT2WbBoard() {
    if (t2WbSubmitted) return;
    const curBoard = t2WbBoards[t2WbBoardIndex];
    if (!curBoard || !Array.isArray(curBoard.items)) return;
    const missing = curBoard.items.filter((it) => !t2WbFills[it.id]);
    if (missing.length > 0) {
      t2WbActiveSlotId = missing[0].id;
      B()?.showToast?.(`Vui lòng điền đủ ${curBoard.items.length} ô trống trước khi kiểm tra (còn ${missing.length} ô)!`);
      renderTest2Stage();
      return;
    }

    t2WbSubmitted = true;
    const optByKey = {};
    (curBoard.wordBox || []).forEach((o) => { optByKey[o.key] = o; });

    curBoard.items.forEach((it) => {
      const chosenKey = t2WbFills[it.id];
      const chosenOpt = optByKey[chosenKey] || { text: '', role: '', note: '' };
      const isRight = String(chosenOpt.text || '').trim().toLowerCase() === String(it.answer || '').trim().toLowerCase();
      if (isRight) {
        t2Correct++;
      } else {
        t2WbMistakes++;
        const trapTag = chosenOpt.role === 'wf_trap'
          ? 'Bẫy họ từ / từ loại'
          : chosenOpt.role === 'task_distractor'
            ? 'Từ nhiễu trong Task'
            : 'Nhầm vị trí ô khác';
        t2WrongRecords.push({
          prompt: `Summary Word Box (${it.examTitle || 'IELTS Reading'}): ${it.sentenceBlank}`,
          chosen: `${chosenOpt.text} (${trapTag})`,
          answer: it.answer,
          explain: `${chosenOpt.note ? chosenOpt.note + ' ' : ''}${it.explain || ''}`.trim(),
        });
      }
    });
    renderTest2Stage();
  }

  function nextT2WbBoard() {
    if (t2WbBoardIndex < t2WbBoards.length - 1) {
      t2WbBoardIndex++;
      setupT2WbBoard();
      renderTest2Stage();
      return;
    }
    t2WbDone = true;
    B()?.showToast?.(t2ContextQs.length > 0 ? 'Xong Summary Word Box! Tiếp tục câu trắc nghiệm.' : 'Hoàn thành Test 2!');
    renderTest2Stage();
  }

  function renderTest2Stage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    cleanupT2FloatingDrag();
    const esc = B()?.escapeHtml || ((x) => String(x));
    if (t2ParaBoards.length === 0 && t2WbBoards.length === 0 && t2ContextQs.length === 0) {
      initTest2State(activeTask);
    }

    if (!t2ParaDone && t2ParaBoards.length > 0) {
      const curBoard = t2ParaBoards[t2ParaBoardIndex] || [];
      const leftOrder = t2ParaLeftOrder.length ? t2ParaLeftOrder : curBoard;
      const leftHtml = leftOrder.map((p) => {
        const matched = t2ParaMatchedIds.has(p.id);
        const active = t2ParaSelectedLeft === p.id;
        return `<button type="button" class="task-match-btn t2-dropzone ${matched ? 'is-matched' : ''} ${active ? 'is-active' : ''}" id="t2-para-left-${esc(p.id)}" data-left-id="${esc(p.id)}" ${matched ? 'disabled' : ''} onclick="TasksModule.pickT2ParaLeft('${esc(p.id)}')"><span class="t2-drop-word">${esc(p.left)}</span><span class="t2-drop-slot ${matched ? 'is-filled' : ''}">${matched ? `✓ ${esc(p.right)}` : 'Thả vào đây'}</span></button>`;
      }).join('');

      const rightHtml = t2ParaShuffledRight.map((p) => {
        const matched = t2ParaMatchedIds.has(p.id);
        const rightActive = t2ParaSelectedRight === p.id;
        return `<button type="button" class="task-match-btn t2-drag-card ${matched ? 'is-matched' : ''} ${rightActive ? 'is-active' : ''}" id="t2-para-right-${esc(p.id)}" data-right-id="${esc(p.id)}" ${matched ? 'disabled' : ''} onclick="TasksModule.pickT2ParaRight('${esc(p.id)}')"><span class="t2-drag-grip" aria-hidden="true">⋮⋮</span><span>${esc(p.right)}</span></button>`;
      }).join('');

      const paraPct = Math.round(((t2ParaBoardIndex + (t2ParaMatchedIds.size / Math.max(1, curBoard.length))) / Math.max(1, t2ParaBoards.length)) * 100);
      const teacherWbBtn = (isTeacherOrBypassed() && t2WbBoards.length > 0)
        ? `<button type="button" class="btn-subtle" id="btn-teacher-t2-wb-preview" style="padding:5px 11px; font-size:12.5px;" onclick="TasksModule.jumpToT2WbPreview()">Xem Word Box →</button>`
        : '';
      const teacherMcqBtn = (isTeacherOrBypassed() && t2ContextQs.length > 0)
        ? `<button type="button" class="btn-subtle" id="btn-teacher-t2-mcq-preview" style="padding:5px 11px; font-size:12.5px;" onclick="TasksModule.jumpToT2McqPreview()">Xem 6 câu A/B/C/D →</button>`
        : '';

      container.innerHTML = `
        <div class="task-card-panel">
          <div class="task-stage-progress" aria-hidden="true">
            <div class="task-stage-progress-fill" style="width:${paraPct}%;"></div>
          </div>
          <div class="task-exam-header-row">
            <div class="task-exam-title-group">
              <h2 class="task-exam-title">Nối Paraphrase · Bảng ${t2ParaBoardIndex + 1} / ${t2ParaBoards.length}</h2>
            </div>
            <div class="task-stat-pills">
              <span class="task-err-pill ${t2ParaMistakes > 0 ? 'has-err' : ''}">Lỗi: <strong id="t2-err-cnt">${t2ParaMistakes}</strong></span>
              <span class="recall-stage-pill">${t2ParaMatchedIds.size} / ${curBoard.length} cặp</span>
              ${teacherWbBtn}
              ${teacherMcqBtn}
            </div>
          </div>
          <div class="task-match-head">
            <span>Từ vựng</span>
            <span>Synonyms / Paraphrase</span>
          </div>
          <div class="task-match-wrap is-t2-dnd">
            <div class="task-match-col">${leftHtml}</div>
            <div class="task-match-col">${rightHtml}</div>
          </div>
        </div>
      `;
      bindT2PointerDrag();
      return;
    }

    if (!t2WbDone && t2WbBoards.length > 0) {
      const curBoard = t2WbBoards[t2WbBoardIndex] || { items: [], wordBox: [] };
      const items = curBoard.items || [];
      const wordBox = curBoard.wordBox || [];
      const optByKey = {};
      wordBox.forEach((o) => { optByKey[o.key] = o; });
      const usedKeys = new Set(Object.values(t2WbFills));
      const filledCount = items.filter((it) => Boolean(t2WbFills[it.id])).length;
      const wbPct = Math.round(((t2WbBoardIndex + (t2WbSubmitted ? 1 : (filledCount / Math.max(1, items.length)) * 0.85)) / Math.max(1, t2WbBoards.length)) * 100);

      const teacherNavBtns = isTeacherOrBypassed()
        ? `${t2ParaBoards.length > 0 ? `<button type="button" class="btn-subtle" style="padding:5px 10px; font-size:12px;" onclick="TasksModule.jumpToT2ParaPreview()">← Paraphrase</button>` : ''}${t2ContextQs.length > 0 ? `<button type="button" class="btn-subtle" style="padding:5px 10px; font-size:12px;" onclick="TasksModule.jumpToT2McqPreview()">6 câu A/B/C/D →</button>` : ''}`
        : '';

      const boxHtml = wordBox.map((opt) => {
        const isUsed = usedKeys.has(opt.key);
        let stateCls = isUsed ? 'is-used' : '';
        if (t2WbSubmitted) {
          if (opt.role === 'answer') stateCls = 'is-wb-ans';
          else if (opt.role === 'wf_trap') stateCls = 'is-wb-trap';
          else stateCls = 'is-wb-dist';
        }
        return `<button type="button" class="t2-wb-chip ${stateCls}" id="t2-wb-chip-${esc(opt.key)}" data-wb-key="${esc(opt.key)}" draggable="${!t2WbSubmitted}" ${t2WbSubmitted ? 'disabled' : ''} onclick="TasksModule.pickT2WbOption('${esc(opt.key)}')">
          <span class="t2-drag-grip" aria-hidden="true">⋮⋮</span>
          <span class="t2-wb-chip-key">${esc(opt.key)}</span>
          <span class="t2-wb-chip-word">${esc(opt.text)}</span>
        </button>`;
      }).join('');

      const sentsHtml = items.map((it) => {
        const chosenKey = t2WbFills[it.id] || '';
        const chosenOpt = chosenKey ? optByKey[chosenKey] : null;
        const isActive = !t2WbSubmitted && t2WbActiveSlotId === it.id;
        const isRight = t2WbSubmitted && chosenOpt && String(chosenOpt.text).trim().toLowerCase() === String(it.answer).trim().toLowerCase();
        const isWrong = t2WbSubmitted && !isRight;

        let slotCls = 't2-wb-slot';
        if (isActive) slotCls += ' is-active';
        if (chosenOpt && !t2WbSubmitted) slotCls += ' is-filled';
        if (isRight) slotCls += ' is-right';
        if (isWrong) slotCls += ' is-wrong';

        const slotInner = chosenOpt
          ? `<span><strong>${esc(chosenOpt.key)}.</strong> ${esc(chosenOpt.text)}</span>${!t2WbSubmitted ? `<span class="t2-wb-slot-x" onclick="TasksModule.clearT2WbSlot('${esc(it.id)}', event)" title="Xóa ô này">×</span>` : (isRight ? ' ✓' : ' ✗')}`
          : `<span>(${it.slotNum}) ______</span>`;

        const slotBtn = `<button type="button" class="${slotCls}" id="t2-wb-slot-${esc(it.id)}" data-slot-id="${esc(it.id)}" ${t2WbSubmitted ? 'disabled' : ''} onclick="TasksModule.selectT2WbSlot('${esc(it.id)}')">${slotInner}</button>`;
        const sentRendered = esc(it.sentenceBlank).replace('______', slotBtn);

        let fbHtml = '';
        if (t2WbSubmitted) {
          if (isRight) {
            fbHtml = `<div class="t2-wb-fb is-ok">✓ Đúng — <strong>${esc(it.answer)}</strong> (${esc(it.pos)}: ${esc(it.meaning)})</div>`;
          } else {
            const trapInfo = chosenOpt?.note ? ` · ${esc(chosenOpt.note)}` : '';
            fbHtml = `<div class="t2-wb-fb is-err">✗ Đáp án đúng: <strong>${esc(it.answer)}</strong> (${esc(it.pos)}: ${esc(it.meaning)})${trapInfo}</div>`;
          }
        }

        return `
          <div class="t2-wb-sent-row ${isActive ? 'is-active-row' : ''} ${isRight ? 'is-ok-row' : ''} ${isWrong ? 'is-err-row' : ''}" data-slot-id="${esc(it.id)}">
            <div class="t2-wb-sent-text"><span class="t2-wb-num">Câu ${it.slotNum}.</span> ${sentRendered}</div>
            ${fbHtml}
          </div>
        `;
      }).join('');

      container.innerHTML = `
        <div class="task-card-panel t2-wb-panel">
          <div class="task-stage-progress" aria-hidden="true">
            <div class="task-stage-progress-fill" style="width:${wbPct}%;"></div>
          </div>
          <div class="task-exam-header-row">
            <div class="task-exam-title-group">
              <h2 class="task-exam-title">Điền từ ngữ cảnh · Bảng ${t2WbBoardIndex + 1} / ${t2WbBoards.length}</h2>
            </div>
            <div class="task-stat-pills">
              <span class="task-err-pill ${t2WbMistakes > 0 ? 'has-err' : ''}">Lỗi: <strong id="t2-wb-err-cnt">${t2WbMistakes}</strong></span>
              <span class="recall-stage-pill">${filledCount} / ${items.length} ô</span>
              ${teacherNavBtns}
            </div>
          </div>
          <div class="t2-wb-box" id="t2-wb-wordbox">
            <div class="t2-wb-chip-grid">${boxHtml}</div>
          </div>
          <div class="t2-wb-list" id="t2-wb-list">${sentsHtml}</div>
          <div class="t2-wb-footer">
            ${!t2WbSubmitted
              ? `<button type="button" class="btn btn-primary" id="btn-t2-wb-submit" onclick="TasksModule.submitT2WbBoard()">Kiểm tra (${filledCount}/${items.length})</button>`
              : `<button type="button" class="btn btn-primary" id="btn-t2-wb-next" onclick="TasksModule.nextT2WbBoard()">${t2WbBoardIndex < t2WbBoards.length - 1 ? 'Bảng tiếp theo →' : (t2ContextQs.length > 0 ? 'Sang câu trắc nghiệm →' : 'Xem kết quả Test 2 →')}</button>`}
          </div>
        </div>
      `;
      bindT2WbDrag();
      return;
    }

    const qs = t2ContextQs;
    const totalWbItems = t2WbBoards.reduce((sum, b) => sum + (Array.isArray(b?.items) ? b.items.length : 0), 0);
    const totalT2 = t2ParaPairs.length + totalWbItems + qs.length;

    if (t2Index >= qs.length) {
      const passThreshold = Math.max(1, Math.ceil(totalT2 * 0.66));
      const passed = t2Correct >= passThreshold;
      t2Completed = passed;
      updateFinishButtonUI();
      const mistakesHtml = t2WrongRecords.length > 0
        ? `<div id="task-t2-review-list" class="task-mistake-review-grid">
            ${t2WrongRecords.map((m, idx) => `
              <div class="task-mistake-card">
                <div class="task-text-err" style="font-size:13.5px; font-weight:800;">Câu nhầm #${idx + 1}</div>
                <div style="font-size:15.5px; font-weight:750; color:var(--text-bright); margin-top:4px;">${esc(m.prompt)}</div>
                <div class="task-text-err" style="font-size:14.5px; margin-top:5px;">Đã chọn: <strong>${esc(m.chosen)}</strong></div>
                <div class="task-text-ok" style="font-size:14.5px; margin-top:2px;">Đáp án: <strong>${esc(m.answer)}</strong></div>
                ${m.explain ? `<div style="font-size:13.5px; color:var(--text-muted); margin-top:4px;">${esc(m.explain)}</div>` : ''}
              </div>
            `).join('')}
          </div>`
        : `<div id="task-t2-review-list" class="task-notice-box" style="max-width:440px; margin:0 auto 18px;">✓ Xuất sắc! Đúng 100% ở Test 2.</div>`;

      container.innerHTML = `
        <div class="task-card-panel" style="text-align:center; padding:34px 28px;">
          <h2 style="margin:0 0 10px; font-size:25px; font-weight:850;">Kết quả Test 2: ${t2Correct} / ${totalT2}</h2>
          <p style="color:var(--text-muted); font-size:16px; margin:0 0 18px;">
            ${passed ? 'Đạt yêu cầu! Tiếp tục làm bài dịch cuối.' : `Cần đạt tối thiểu ${passThreshold}/${totalT2} để qua Test 2.`}
          </p>
          ${mistakesHtml}
          ${passed
            ? `<button type="button" class="btn btn-primary" style="font-size:16px; padding:12px 26px;" onclick="TasksModule.startFinalTranslation()">Vào Test 3 →</button>`
            : `<button type="button" class="btn btn-primary" style="font-size:16px; padding:12px 26px;" onclick="TasksModule.retryTest2()">Làm lại Test 2</button>`}
        </div>
      `;
      return;
    }

    const q = qs[t2Index];
    const typeLabel = q.type === 'word_family' ? 'Word Family' : 'Ngữ cảnh';
    const mcqPct = Math.round(((t2Index + (t2Answered ? 1 : 0)) / Math.max(1, qs.length)) * 100);
    const formattedQText = q.qText
      ? esc(q.qText).replace(/______/g, '<span class="task-blank-pill">______</span>')
      : '';
    const letters = ['A', 'B', 'C', 'D'];
    const teacherBackParaBtn = (isTeacherOrBypassed() && t2ParaBoards.length > 0)
      ? `<button type="button" class="btn-subtle" id="btn-teacher-t2-para-preview" style="padding:5px 11px; font-size:12.5px;" onclick="TasksModule.jumpToT2ParaPreview()">← Về Nối cụm từ</button>`
      : '';

    container.innerHTML = `
      <div class="task-card-panel">
        <div class="task-stage-progress" aria-hidden="true">
          <div class="task-stage-progress-fill" style="width:${mcqPct}%;"></div>
        </div>
        <div class="task-exam-header-row">
          <h2 class="task-exam-title">${typeLabel} · Câu ${t2Index + 1} / ${qs.length}</h2>
          <div class="task-stat-pills">
            <span class="recall-stage-pill">Đúng ${t2Correct} / ${totalT2}</span>
            ${teacherBackParaBtn}
          </div>
        </div>
        <div style="font-size:21px; font-weight:750; color:var(--text-bright); line-height:1.5; margin-bottom:14px;">${esc(q.prompt)}</div>
        ${formattedQText ? `<div class="task-q-sentence">${formattedQText}</div>` : ''}
        <div class="task-q-opts" id="task-t2-opts">
          ${q.options.map((opt, idx) => `<button type="button" class="task-q-opt" data-opt-idx="${idx}" onclick="TasksModule.answerTest2(${idx})"><span class="task-q-opt-key">${letters[idx] || idx + 1}</span><span>${esc(opt)}</span></button>`).join('')}
        </div>
        <div id="task-t2-explain" style="display:none; margin-top:18px; font-size:18px;" class="task-notice-box"></div>
        <div style="display:flex; justify-content:flex-end; margin-top:auto; padding-top:18px;">
          <button type="button" class="btn btn-primary" id="btn-t2-next" style="display:none; font-size:17.5px; padding:13px 28px;" onclick="TasksModule.nextTest2Question()">
            ${t2Index < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả Test 2'}
          </button>
        </div>
      </div>
    `;
  }

  function answerTest2(optIdx) {
    if (t2Answered || !activeTask) return;
    t2Answered = true;
    const q = t2ContextQs[t2Index];
    const chosen = String(q?.options?.[optIdx] ?? '');
    const ans = String(q?.answer ?? '');
    const isRight = chosen.trim().toLowerCase() === ans.trim().toLowerCase();
    if (isRight) {
      t2Correct++;
    } else {
      t2WrongRecords.push({
        prompt: q.prompt,
        chosen,
        answer: ans,
        explain: q.explain || '',
      });
    }

    document.querySelectorAll('#task-t2-opts .task-q-opt').forEach((btn, i) => {
      btn.disabled = true;
      const val = String(q?.options?.[i] ?? '');
      if (val.trim().toLowerCase() === ans.trim().toLowerCase()) btn.classList.add('is-right');
      else if (i === optIdx && !isRight) btn.classList.add('is-wrong');
    });

    const exp = document.getElementById('task-t2-explain');
    if (exp) {
      exp.style.display = 'block';
      exp.innerHTML = `<strong>${isRight ? 'Chính xác!' : `Đáp án: ${B()?.escapeHtml(ans)}.`}</strong> ${B()?.escapeHtml(q.explain || '')}`;
    }
    const nextBtn = document.getElementById('btn-t2-next');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
  }

  function nextTest2Question() {
    t2Index++;
    t2Answered = false;
    renderTest2Stage();
  }

  function jumpToT2McqPreview() {
    if (!activeTask || !isTeacherOrBypassed()) return;
    t2ParaDone = true;
    t2WbDone = true;
    if (t2ContextQs.length === 0) {
      const qs = Array.isArray(activeTask.test2Questions) ? activeTask.test2Questions : [];
      const nonPara = qs.filter((q) => q.type !== 'paraphrase').slice(0, 6);
      t2ContextQs = shuffleArray(nonPara.length > 0 ? nonPara : qs.slice(0, 6));
    }
    t2Index = 0;
    t2Answered = false;
    renderTest2Stage();
  }

  function jumpToT2WbPreview() {
    if (!activeTask || !isTeacherOrBypassed() || t2WbBoards.length === 0) return;
    t2ParaDone = true;
    t2WbDone = false;
    t2WbBoardIndex = 0;
    setupT2WbBoard();
    renderTest2Stage();
  }

  function jumpToT2ParaPreview() {
    if (!activeTask || !isTeacherOrBypassed()) return;
    t2ParaDone = false;
    setupT2ParaBoard();
    renderTest2Stage();
  }

  function retryTest2() {
    if (!activeTask) return;
    initTest2State(activeTask);
    taskStartedAt = Date.now();
    taskLeaveWarnings = 0;
    lastTaskLeaveAt = 0;
    taskTestPassed = false;
    t2Completed = false;
    updateFinishButtonUI();
    document.getElementById('task-leave-warn-banner')?.remove();
    renderTest2Stage();
  }

  function initTest3ReadingQuiz(task) {
    const raw = Array.isArray(task?.test3ReadingQuestions) ? task.test3ReadingQuestions : [];
    const cloned = raw.map((q) => {
      const copy = { ...q };
      if (copy.type === 'mcq' && Array.isArray(copy.options)) {
        copy.options = shuffleArray(copy.options);
      } else if (Array.isArray(copy.options)) {
        copy.options = copy.options.slice();
      } else {
        copy.options = ['TRUE', 'FALSE', 'NOT GIVEN'];
      }
      return copy;
    });
    t3ReadingQuestions = shuffleArray(cloned);
    t3ReadingAnswers = {};
  }

  function pickT3ReadingAns(qId, optIdx) {
    const q = t3ReadingQuestions.find((x) => x.id === qId);
    if (!q || !Array.isArray(q.options)) return;
    const pickedVal = String(q.options[optIdx] ?? '');
    if (!pickedVal) return;
    t3ReadingAnswers[qId] = pickedVal;

    const card = document.getElementById(`t3-rq-card-${qId}`);
    if (card) {
      card.querySelectorAll('.t3-rq-opt-btn').forEach((btn, i) => {
        btn.classList.toggle('is-selected', i === Number(optIdx));
      });
    }
    const badge = document.getElementById('t3-reading-progress-badge');
    if (badge) {
      const cnt = t3ReadingQuestions.filter((x) => Boolean(t3ReadingAnswers[x.id])).length;
      badge.textContent = `${cnt} / ${t3ReadingQuestions.length}`;
      badge.classList.toggle('is-done', cnt >= t3ReadingQuestions.length && t3ReadingQuestions.length > 0);
    }
  }

  function startFinalTranslation() {
    if (!activeTask) return;
    activeStage = 3;
    initTest3ReadingQuiz(activeTask);
    renderTaskStage();
  }

  function switchT3Tab(tab) {
    const isGrade = tab === 'grade';
    const writePane = document.getElementById('t3-pane-write');
    const gradePane = document.getElementById('t3-pane-grade');
    const btnWrite = document.getElementById('t3-tab-btn-write');
    const btnGrade = document.getElementById('t3-tab-btn-grade');
    if (writePane) writePane.style.display = isGrade ? 'none' : 'flex';
    if (gradePane) gradePane.style.display = isGrade ? 'block' : 'none';
    if (btnWrite) btnWrite.classList.toggle('active', !isGrade);
    if (btnGrade) btnGrade.classList.toggle('active', isGrade);
  }

  // =========================================================
  // STAGE 3: FINAL 2-COLUMN READING (10 QS: 5 TFNG + 5 MCQ) + TRANSLATION
  // =========================================================
  function renderFinalTranslationStage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const p = activeTask.passage;
    if (t3ReadingQuestions.length === 0 && Array.isArray(activeTask.test3ReadingQuestions) && activeTask.test3ReadingQuestions.length > 0) {
      initTest3ReadingQuiz(activeTask);
    }

    const draftKey = `ielts_task_draft_${getScopedStorageUid()}_${activeTask.id}`;
    let savedDraft = { trans: '', summary: '' };
    try {
      savedDraft = JSON.parse(localStorage.getItem(draftKey) || '{}') || savedDraft;
    } catch (_) {}

    const letters = ['A', 'B', 'C', 'D'];
    const answeredCnt = t3ReadingQuestions.filter((q) => Boolean(t3ReadingAnswers[q.id])).length;
    const rqHtml = t3ReadingQuestions.length > 0
      ? `
        <div class="t3-reading-quiz-box" id="t3-reading-quiz-box">
          <div class="t3-rq-header">
            <span class="t3-rq-title">Đọc hiểu đoạn trích</span>
            <span class="t3-rq-badge ${answeredCnt >= t3ReadingQuestions.length ? 'is-done' : ''}" id="t3-reading-progress-badge">${answeredCnt} / ${t3ReadingQuestions.length}</span>
          </div>
          <div class="t3-rq-list" id="t3-reading-quiz-list">
            ${t3ReadingQuestions.map((q, qIdx) => {
              const isMcq = q.type === 'mcq';
              const curAns = t3ReadingAnswers[q.id] || '';
              return `
                <div class="t3-rq-card" id="t3-rq-card-${esc(q.id)}">
                  <div class="t3-rq-card-top">
                    <span class="t3-rq-num">Câu ${qIdx + 1}</span>
                  </div>
                  <div class="t3-rq-prompt">${esc(q.prompt)}</div>
                  <div class="t3-rq-opts ${isMcq ? 'is-mcq' : ''}">
                    ${(q.options || []).map((opt, oIdx) => {
                      const selCls = curAns === opt ? 'is-selected' : '';
                      const labelTxt = isMcq ? `${letters[oIdx] || oIdx + 1}. ${opt}` : opt;
                      return `<button type="button" class="t3-rq-opt-btn ${selCls}" data-q-id="${esc(q.id)}" data-opt-idx="${oIdx}" onclick="TasksModule.pickT3ReadingAns('${esc(q.id)}', ${oIdx})">${esc(labelTxt)}</button>`;
                    }).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `
      : '';

    container.innerHTML = `
      <div class="translation-workspace">
        <article class="practice-paper english-paper" lang="en">
          <div class="paper-eyebrow">
            <span class="paper-title-upper">${esc(String(p.title || p.topic || activeTask.theme).toUpperCase())}</span>
            <span class="paper-wc">${p.wordCount} từ</span>
          </div>
          <div id="task-passage-hl-legend" class="passage-hl-legend" style="display:none; margin-bottom:12px;"></div>
          <div class="english-passage" id="task-english-passage">${esc(p.text)}</div>
        </article>

        <section class="practice-paper writing-paper" aria-label="Bài làm và Chấm điểm">
          <div class="t3-tabs-bar" role="tablist">
            <button type="button" role="tab" id="t3-tab-btn-write" class="t3-tab-btn active" onclick="TasksModule.switchT3Tab('write')">
              Bài làm
            </button>
            <button type="button" role="tab" id="t3-tab-btn-grade" class="t3-tab-btn" onclick="TasksModule.switchT3Tab('grade')">
              Kết quả chấm AI
              <span id="t3-tab-score-badge" class="t3-tab-score-badge" style="display:none;"></span>
            </button>
          </div>

          <div id="t3-pane-write">
            ${rqHtml}
            <div class="t3-trans-field">
              <label class="writing-label" for="task-trans-input">
                <span>Dịch toàn đoạn</span>
                <span id="task-trans-wc" style="color:var(--text-muted); font-size:14.5px;">0 từ</span>
              </label>
              <textarea id="task-trans-input" class="translation-input" lang="vi" placeholder="Nhập bản dịch tiếng Việt...">${esc(savedDraft.trans || '')}</textarea>
            </div>

            <div class="t3-sum-field">
              <label class="writing-label" for="task-summary-input">
                <span>Tóm tắt ý chính</span>
                <span id="task-sum-wc" style="color:var(--text-muted); font-size:14.5px;">0 từ</span>
              </label>
              <textarea id="task-summary-input" class="summary-input" lang="vi" placeholder="Tóm tắt ý chính đoạn văn...">${esc(savedDraft.summary || '')}</textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; flex-shrink:0;">
              <button type="button" class="btn btn-primary" id="btn-submit-ai-grade" style="font-size:16.5px; padding:11px 26px;" onclick="TasksModule.submitTranslationForAi()">
                Nộp &amp; AI chấm
              </button>
            </div>
          </div>

          <div id="t3-pane-grade" style="display:none;">
            <div id="task-ai-grade-result" class="ai-grade-box" style="display:block; background:var(--bg-soft); border-color:var(--card-border);">
              <div style="text-align:center; padding:36px 16px; color:var(--text-muted);">
                <div style="font-size:18px; font-weight:750; color:var(--text-bright); margin-bottom:8px;">Chưa có bài nộp</div>
                <div style="font-size:15.5px; margin-bottom:18px;">Hoàn thành 10 câu đọc hiểu cùng bản dịch và tóm tắt ở tab Bài làm rồi nhấn Nộp &amp; AI chấm.</div>
                <button type="button" class="btn btn-primary" onclick="TasksModule.switchT3Tab('write')">← Quay lại viết bài</button>
              </div>
            </div>
          </div>
        </section>
      </div>
    `;

    const transEl = document.getElementById('task-trans-input');
    const sumEl = document.getElementById('task-summary-input');
    const updateCounts = () => {
      const tw = (transEl?.value || '').trim().split(/\s+/).filter(Boolean).length;
      const sw = (sumEl?.value || '').trim().split(/\s+/).filter(Boolean).length;
      const tc = document.getElementById('task-trans-wc');
      const sc = document.getElementById('task-sum-wc');
      if (tc) tc.textContent = `${tw} từ`;
      if (sc) sc.textContent = `${sw} từ`;
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          trans: transEl?.value || '',
          summary: sumEl?.value || '',
        }));
      } catch (_) {}
    };
    transEl?.addEventListener('input', updateCounts);
    sumEl?.addEventListener('input', updateCounts);
    if (!isTeacherOrBypassed()) {
      B()?.bindNoPasteGuards?.(transEl, 'Không được dán (paste) khi làm bài dịch — hãy tự dịch trực tiếp!');
      B()?.bindNoPasteGuards?.(sumEl, 'Không được dán (paste) khi tóm tắt — hãy tự viết trực tiếp!');
    }
    updateCounts();
  }

  function highlightPassageAfterGrading() {
    const passageEl = document.getElementById('task-english-passage');
    const legendEl = document.getElementById('task-passage-hl-legend');
    if (!passageEl || !activeTask?.passage?.text) return;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const rawText = String(activeTask.passage.text);
    const rawSignals = Array.isArray(activeTask.passage.signalClues) ? activeTask.passage.signalClues : [];
    const rawAnchors = Array.isArray(activeTask.passage.anchorWords) ? activeTask.passage.anchorWords : [];

    const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const signalParts = [];
    rawSignals.forEach((s) => {
      String(s || '').split(/\s*\/\s*/).forEach((part) => {
        const clean = part.trim();
        if (clean.length >= 2) signalParts.push(clean);
      });
    });
    const signalSet = new Set(signalParts.map((s) => s.toLowerCase()));
    const anchorParts = rawAnchors
      .map((a) => String(a || '').trim())
      .filter((a) => a.length >= 3 && !signalSet.has(a.toLowerCase()));

    const regexTokens = [];
    signalParts.sort((a, b) => b.length - a.length).forEach((t) => regexTokens.push(escRe(t)));
    anchorParts.sort((a, b) => b.length - a.length).forEach((t) => {
      regexTokens.push(t.length >= 4 && !/\s/.test(t) ? `${escRe(t)}[a-z]{0,5}` : escRe(t));
    });
    if (regexTokens.length === 0) return;

    const pattern = new RegExp(`\\b(${regexTokens.join('|')})\\b`, 'gi');
    let outHtml = '';
    let lastIdx = 0;
    let signalHits = 0;
    let anchorHits = 0;
    let match;
    while ((match = pattern.exec(rawText)) !== null) {
      if (match.index > lastIdx) outHtml += esc(rawText.slice(lastIdx, match.index));
      const hit = match[0];
      const isSignal = signalSet.has(hit.toLowerCase());
      if (isSignal) signalHits++;
      else anchorHits++;
      outHtml += `<mark class="${isSignal ? 'passage-hl-signal' : 'passage-hl-anchor'}">${esc(hit)}</mark>`;
      lastIdx = match.index + hit.length;
    }
    if (lastIdx < rawText.length) outHtml += esc(rawText.slice(lastIdx));
    passageEl.innerHTML = outHtml;

    if (legendEl) {
      legendEl.style.display = 'flex';
      legendEl.innerHTML = `
        <span>Đối chiếu cấu trúc bài đọc:</span>
        <span class="passage-hl-anchor">Từ khóa trọng tâm (${anchorHits})</span>
        <span class="passage-hl-signal">Từ nối định hướng (${signalHits})</span>
      `;
    }
  }

  const TASK_MODEL_TRANSLATIONS = {
    task_01: `A. Người ta đều thừa nhận rộng rãi rằng chó là loài động vật đầu tiên được loài người thuần hóa. Tuy nhiên, các phát hiện khảo cổ học gần đây và phân tích di truyền học chuyên sâu đã làm thay đổi căn bản cách chúng ta hiểu về phương thức và thời điểm liên minh sinh học kỳ diệu này lần đầu xuất hiện. Trong nhiều thập kỷ, giả thuyết chủ đạo cho rằng những người săn bắt hái lượm đã bắt các con sói con và chủ động nuôi dưỡng chúng để làm bạn đồng hành khi săn bắn và canh gác nơi cắm trại. Mặc dù câu chuyện này nghe có vẻ hợp trực giác, các nhà sinh học tiến hóa hiện nay đề xuất một mô hình tương tác năng động hơn nhiều dựa trên sự thích nghi hai chiều.\n\nB. Theo góc nhìn thay thế này, còn gọi là mô hình 'tự thuần hóa', tiến trình này không bắt đầu từ sự can thiệp chủ động của con người, mà bắt nguồn từ những con sói dũng cảm, biết chớp thời cơ lùng sục kiếm thức ăn quanh các khu định cư du mục của con người. Dưới điều kiện sinh thái khắc nghiệt vào cuối kỷ Pleistocen, các khu lều trại của loài người thải ra một lượng thức ăn thừa đáng kể, bao gồm tủy xương giàu dinh dưỡng, xác động vật và mỡ thừa. Những con sói có khoảng cách chạy trốn ngắn hơn một chút—tức ít sợ sự hiện diện của con người hơn—đã có được lợi thế dinh dưỡng vượt trội so với đồng loại nhút nhát hơn. Trải qua nhiều thế hệ liên tiếp, chọn lọc tự nhiên đã ưu tiên những cá thể giảm sản sinh adrenaline, điều này tình cờ kích hoạt những biến đổi giải phẫu như tai cụp, mõm ngắn hơn và các đốm lông loang lổ.\n\nC. Khi những cá thể tiền thân của loài chó này dần quen thuộc với việc ở gần con người, một mối quan hệ sinh thái cùng có lợi đã nhanh chóng hình thành. Con người sở hữu tầm nhìn hai mắt vượt trội và vũ khí phóng tinh vi, trong khi loài sói có khứu giác nhạy bén vô song và sức bền săn mồi đáng nể. Khi phối hợp cùng nhau trên dấu vết của các loài thú lớn như tuần lộc và voi ma mút lông xoăn, đội săn liên hợp này đạt hiệu suất săn bắn vượt xa tổng năng lực của từng bên riêng lẻ. Hơn nữa, sự cảnh giác vào ban đêm của loài chó thời kỳ đầu đã cung cấp khả năng phát hiện cảnh báo sớm thiết yếu trước các kẻ săn mồi đỉnh cao như hổ răng kiếm và gấu hang.`,
    task_02: `B. Khi chúng ta nhai, các hợp chất hóa học dễ bay hơi được giải phóng từ cấu trúc thức ăn bên trong khoang miệng. Những phân tử dạng khí này bay ngược qua vùng hầu họng vào khoang mũi, liên kết với hàng triệu tế bào thần kinh cảm thụ khứu giác chuyên biệt nằm trong biểu mô khứu giác. Các tín hiệu thần kinh tạo ra sau đó được truyền trực tiếp qua hành khứu giác tới hệ viền và vỏ não trán ổ mắt, nơi chúng được tích hợp cùng với các tín hiệu vị giác, xúc giác và nhiệt độ để tạo nên hiện tượng cảm giác phức hợp mà chúng ta gọi là hương vị.\n\nC. Trong ngành sản xuất thực phẩm chế biến đương đại, ngành công nghiệp hương liệu tổng hợp thương mại đóng một vai trò quyết định. Các phòng thí nghiệm hương liệu đa quốc gia sử dụng phương pháp sắc ký khí và khối phổ để phân tích hồ sơ phân tử dễ bay hơi của thực phẩm tự nhiên nguyên bản, cô lập hàng trăm hợp chất hữu cơ riêng biệt như este, aldehyde, ketone và pyrazine. Sau đó, các nhà hóa học thực phẩm tổng hợp các công thức mùi hương giống hệt về mặt hóa học để bổ sung với hàm lượng vi lượng nhằm bù đắp lại các hương vị bị thất thoát trong quá trình xử lý nhiệt công nghiệp, thanh trùng và lưu trữ dài ngày trên kệ.\n\nD. Tuy nhiên, ranh giới của khoa học cảm quan đã mở rộng vượt ra ngoài sự tổng hợp hóa học đơn thuần để tiến vào các mối liên kết đa giác quan xuyên phương thức. Các thí nghiệm mang tính bước ngoặt của các nhà nghiên cứu nhận thức chứng minh rằng không gian môi trường xung quanh—bao gồm tần số âm thanh nền, các dải màu bao bì, trọng lượng của dao kéo và hình học của bộ đồ ăn—về cơ bản làm thay đổi cách con người cảm nhận độ ngọt, độ tươi và chất lượng của thực phẩm. Do đó, các nhà thiết kế thực phẩm tiên tiến hiện nay tận dụng âm thanh và các tín hiệu thị giác màu sắc để tạo ra các sản phẩm ẩm thực lành mạnh hơn mà cần ít natri và đường tinh luyện hơn đáng kể nhưng vẫn không làm giảm sự thỏa mãn vị giác của người tiêu dùng.`
  };

  function generateTaskModelTranslation(task) {
    if (!task) return '';
    const p = task.passage;
    if (p && typeof p.modelTranslation === 'string' && p.modelTranslation.trim()) {
      return p.modelTranslation.trim();
    }
    if (TASK_MODEL_TRANSLATIONS[task.id]) return TASK_MODEL_TRANSLATIONS[task.id];
    if (!p || !p.text) return '';
    return `Bản dịch chuẩn tham khảo cho ${task.label} (${task.theme}):\n` +
      `Đoạn văn tập trung phân tích chuyên sâu về chủ đề ${task.theme}. Người đọc cần bám sát các từ khóa trọng tâm (${(p.anchorWords || []).join(', ')}) kết hợp với các từ nối logic (${(p.signalClues || []).join(', ')}) để diễn đạt chuẩn xác từng câu văn theo đúng ngữ cảnh học thuật IELTS.`;
  }

  const QWERTY_ROWS = [
    'qwertyuiop', 'poiuytrewq',
    'asdfghjkl', 'lkjhgfdsa',
    'zxcvbnm', 'mnbvcxz',
    'qazwsxedc', 'wsxedcrfv', 'edcrfvtgb',
  ];
  const VALID_ALPHANUM_RE = /^(?:\d+(?:st|nd|rd|th|h|m|km|cm|mm|kg|g|mg|ml|l|s|d|D)|(?:CO2|H2O|O2|N2|CH4|SO2|NO2|pH\d*|[A-Z]{1,3}\d{1,2}))$/;

  function stripVietnameseDiacritics(str) {
    return String(str || '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  function hasKeyboardMashRun(clean) {
    const low = stripVietnameseDiacritics(clean).toLowerCase();
    if (low.length < 5) return false;
    for (const row of QWERTY_ROWS) {
      for (let i = 0; i <= row.length - 5; i++) {
        if (low.includes(row.slice(i, i + 5))) return true;
      }
    }
    return false;
  }

  function isSingleGibberishToken(tok, passageTokensSet) {
    const clean = String(tok || '').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
    if (clean.length < 3) return false;
    if (VALID_ALPHANUM_RE.test(clean)) return false;
    if (/[a-zA-Zà-ỹÀ-Ỹ]\d|\d[a-zA-Zà-ỹÀ-Ỹ]/.test(clean)) return true;
    if (/^\d+$/.test(clean)) return false;
    if (/(.)\1\1/i.test(clean)) return true;
    if (clean.length >= 6 && /^(.{2,4})\1{2,}$/i.test(clean)) return true;
    if (hasKeyboardMashRun(clean)) return true;
    if (passageTokensSet && passageTokensSet.has(clean.toLowerCase())) return false;
    if (/[a-zà-ỹ][A-ZĐ][a-zà-ỹ][A-ZĐ]/.test(clean)) return true;

    const stripped = stripVietnameseDiacritics(clean);
    if (/^[a-zA-Z]+$/.test(stripped)) {
      const low = stripped.toLowerCase();
      const vowels = (low.match(/[aeiouy]/g) || []).length;
      if (low.length >= 5 && vowels === 0) return true;
      const baseForCluster = low.length >= 7 ? low.replace(/s$/, '') : low;
      if (/[bcdfghjklmnpqrstvwxz]{6,}/.test(baseForCluster)) return true;
      if (/[bcdfghjklmnpqrstvwxz]{5,}/.test(baseForCluster) && (vowels / low.length) < 0.22) return true;
      if (low.length >= 10 && (vowels / low.length) < 0.15) return true;
    }
    return false;
  }

  function isGibberishToken(tok, passageTokensSet) {
    const raw = String(tok || '').trim();
    if (!raw) return false;
    const parts = raw.split(/[-/]+/).filter(Boolean);
    if (parts.length > 1) return parts.some((p) => isSingleGibberishToken(p, passageTokensSet));
    return isSingleGibberishToken(raw, passageTokensSet);
  }

  function buildPassageTokensSet(passage) {
    return new Set(
      (String(passage || '').toLowerCase().match(/[a-z]{2,}/g) || [])
    );
  }

  function preValidateTranslationLocally(payload) {
    const trans = String(payload?.translation || '').trim();
    const sum = String(payload?.summary || '').trim();
    const passage = String(payload?.passage || '').trim();
    const task = activeTask || {};
    const wordsList = trans.split(/\s+/).filter(Boolean);
    const wordCount = wordsList.length;
    const passageWords = passage.split(/\s+/).filter(Boolean).length;
    const passageTokensSet = buildPassageTokensSet(passage);

    // RULE 1: Ký tự rác / gõ phím ngẫu nhiên / không có từ hợp lệ
    const meaningfulTokens = wordsList.filter((w) => /[\p{L}\p{N}]/u.test(w));
    const gibberishMatches = meaningfulTokens.filter((w) => isGibberishToken(w, passageTokensSet));
    const gibberishRatio = meaningfulTokens.length > 0 ? (gibberishMatches.length / meaningfulTokens.length) : 0;

    if (meaningfulTokens.length === 0 || gibberishMatches.length >= 2 || gibberishRatio >= 0.2 || (meaningfulTokens.length < 15 && gibberishMatches.length >= 1)) {
      const sample = gibberishMatches.slice(0, 3).join(', ') || trans.slice(0, 30);
      return {
        ok: true,
        grade: {
          score: 1.5,
          passed: false,
          criteria: { accuracy: 1.0, signalWords: 1.0, contextInference: 1.0, summary: 1.0 },
          overallComment: `Bài làm KHÔNG ĐẠT (1.5/10): Phát hiện chuỗi ký tự gõ phím ngẫu nhiên hoặc từ vô nghĩa ("${sample}"). Hệ thống AI chấm dựa trên ngữ cảnh đọc hiểu thực tế; vui lòng dịch nghiêm túc sang câu văn tiếng Việt có nghĩa.`,
          lineFeedback: [
            {
              issue: 'Từ ngữ không hợp lệ / Ký tự ngẫu nhiên',
              student: (gibberishMatches.slice(0, 4).join(' ') || trans.slice(0, 50)),
              advice: 'Hệ thống yêu cầu bản dịch tiếng Việt thực tế bám sát đoạn văn, không chấp nhận gõ phím thử nghiệm hoặc từ rác.',
              suggested: 'Hãy đọc từng câu tiếng Anh của bài đọc và dịch nghĩa chính xác sang tiếng Việt.',
            },
          ],
          modelTranslation: generateTaskModelTranslation(task),
        },
      };
    }

    // RULE 2: Sao chép lại tiếng Anh (kể cả khi chèn 1-2 từ tiếng Việt ở đầu)
    const vnDiacriticRe = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i;
    const vnDiacriticCount = wordsList.filter((w) => vnDiacriticRe.test(w)).length;
    const vnTokenRatio = wordsList.length > 0 ? (vnDiacriticCount / wordsList.length) : 0;
    const englishWordMatches = wordsList.filter((w) => {
      const clean = w.replace(/^[^a-zA-Z]+|[^a-zA-Z]+$/g, '').toLowerCase();
      return clean.length >= 3 && /^[a-z]+$/.test(clean) && passageTokensSet.has(clean);
    });
    const englishMatchRatio = wordsList.length > 0 ? (englishWordMatches.length / wordsList.length) : 0;
    if ((englishWordMatches.length >= 8 && englishMatchRatio > 0.4 && vnTokenRatio < 0.15) ||
        (wordsList.length >= 15 && vnDiacriticCount === 0 && englishMatchRatio > 0.3)) {
      return {
        ok: true,
        grade: {
          score: 2.0,
          passed: false,
          criteria: { accuracy: 2.0, signalWords: 1.5, contextInference: 1.5, summary: 1.0 },
          overallComment: 'Bài làm chưa đạt (2.0/10): Bạn đang sao chép lại tiếng Anh thay vì dịch sang tiếng Việt. Yêu cầu của bài thi là dịch nghĩa toàn bộ sang tiếng Việt để kiểm tra độ hiểu bài.',
          lineFeedback: [
            {
              issue: 'Chưa dịch sang tiếng Việt',
              student: trans.slice(0, 60) + (trans.length > 60 ? '...' : ''),
              advice: 'Vui lòng dịch các câu tiếng Anh sang tiếng Việt hoàn chỉnh.',
              suggested: 'Dịch lại toàn bộ các câu trong bài đọc sang tiếng Việt.',
            },
          ],
          modelTranslation: generateTaskModelTranslation(task),
        },
      };
    }

    // RULE 3: Lặp từ / Lặp cụm từ spam / Độ đa dạng từ vựng (TTR) quá thấp
    const normTokens = wordsList
      .map((w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''))
      .filter(Boolean);
    const nTok = normTokens.length;
    if (nTok >= 10) {
      const freq = new Map();
      let maxTokenCount = 0;
      let hasConsecTriple = false;
      for (let i = 0; i < nTok; i++) {
        const tk = normTokens[i];
        const nextC = (freq.get(tk) || 0) + 1;
        freq.set(tk, nextC);
        if (nextC > maxTokenCount) maxTokenCount = nextC;
        if (i >= 2 && normTokens[i] === normTokens[i - 1] && normTokens[i - 1] === normTokens[i - 2]) {
          hasConsecTriple = true;
        }
      }
      const uniqueCount = freq.size;
      const ttr = uniqueCount / nTok;
      const topFreqRatio = maxTokenCount / nTok;
      let top3GramCount = 0;
      if (nTok >= 18) {
        const gramFreq = new Map();
        for (let i = 0; i <= nTok - 3; i++) {
          const g = `${normTokens[i]} ${normTokens[i + 1]} ${normTokens[i + 2]}`;
          const c = (gramFreq.get(g) || 0) + 1;
          gramFreq.set(g, c);
          if (c > top3GramCount) top3GramCount = c;
        }
      }
      const top3GramCoverage = (top3GramCount * 3) / nTok;

      if (
        (nTok >= 15 && ttr < 0.28) ||
        uniqueCount <= 4 ||
        (nTok >= 12 && topFreqRatio > 0.22) ||
        hasConsecTriple ||
        (nTok >= 18 && top3GramCount >= 4 && top3GramCoverage >= 0.35)
      ) {
        return {
          ok: true,
          grade: {
            score: 1.8,
            passed: false,
            criteria: { accuracy: 1.5, signalWords: 1.5, contextInference: 1.5, summary: 1.5 },
            overallComment: 'Bài làm KHÔNG ĐẠT (1.8/10): Phát hiện lặp từ / lặp cụm từ hoặc độ đa dạng từ vựng quá thấp (nghi vấn spam nội dung). Vui lòng dịch thực tế từng câu của đoạn văn gốc sang tiếng Việt.',
            lineFeedback: [
              {
                issue: 'Lặp từ / Lặp cụm từ bất thường',
                student: trans.slice(0, 70) + (trans.length > 70 ? '...' : ''),
                advice: 'Mỗi câu trong đoạn văn IELTS chứa thông tin và từ vựng riêng biệt; không lặp lại cùng một cụm từ để đủ số từ.',
                suggested: 'Hãy dịch sát từng câu từ đầu đến cuối đoạn văn tiếng Anh.',
              },
            ],
            modelTranslation: generateTaskModelTranslation(task),
          },
        };
      }
    }

    // RULE 4: Bài dịch quá ngắn (< 30 từ so với đoạn đọc gốc 200-300 từ)
    if (wordCount < 30) {
      const shortScore = Math.min(4.5, Math.max(2.0, Math.round((wordCount / 30) * 4.5 * 10) / 10));
      return {
        ok: true,
        grade: {
          score: shortScore,
          passed: false,
          criteria: {
            accuracy: Math.min(4.5, shortScore),
            signalWords: 3.0,
            contextInference: 3.0,
            summary: sum.length >= 10 ? 6.0 : 2.0,
          },
          overallComment: `Bản dịch quá ngắn (${wordCount} từ so với đoạn đọc gốc ${passageWords} từ). Bạn mới chỉ dịch được một phần nhỏ của bài đọc, thiếu các luận điểm và từ khóa quan trọng. Cần hoàn thành trọn vẹn cả đoạn.`,
          lineFeedback: [
            {
              issue: 'Độ dài bài dịch chưa đạt yêu cầu bao quát',
              student: trans,
              advice: `Đoạn văn gốc có ${passageWords} từ; bản dịch tiếng Việt đầy đủ cần từ 100-250 từ.`,
              suggested: 'Hãy tiếp tục dịch hết các câu còn lại của bài đọc.',
            },
          ],
          modelTranslation: generateTaskModelTranslation(task),
        },
      };
    }

    return null;
  }

  function evaluateTranslationLocally(payload) {
    const preCheck = preValidateTranslationLocally(payload);
    if (preCheck) return preCheck;

    const trans = String(payload.translation || '').trim();
    const sum = String(payload.summary || '').trim();
    const passage = String(payload.passage || '').trim();
    const task = activeTask || {};
    let anchorWords = Array.isArray(payload.anchorWords) && payload.anchorWords.length ? payload.anchorWords : (task.passage?.anchorWords || []);
    const wordsList = trans.split(/\s+/).filter(Boolean);
    const wordCount = wordsList.length;
    const passageWords = passage.split(/\s+/).filter(Boolean).length;
    const passageTokensSet = buildPassageTokensSet(passage);

    // RULE 5: ĐỐI CHIẾU NGỮ CẢNH VÀ TỪ KHÓA BÀI ĐỌC (Context & Semantic Evaluation)
    const transLower = trans.toLowerCase();
    const sumLower = sum.toLowerCase();

    // 5.1 Bóc tách và đối chiếu từ khóa cốt lõi (Anchor Words)
    const taskWords = Array.isArray(task.words) ? task.words : [];
    const escReLocal = (s) => String(s || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (anchorWords.length === 0 && taskWords.length > 0 && passage) {
      anchorWords = taskWords
        .map((w) => String(w.lemma || '').trim())
        .filter((lem) => lem.length >= 4 && new RegExp(`\\b${escReLocal(lem)}\\b`, 'i').test(passage))
        .slice(0, 10);
    }

    const wordMeaningsMap = new Map();
    taskWords.forEach((w) => {
      const cleanLemma = String(w.lemma || '').toLowerCase().trim();
      const mList = [];
      if (w.meaning) {
        String(w.meaning).split(/[,;/–—:\(\)]+|\s+hoặc\s+/i).forEach((part) => {
          const c = part.trim().toLowerCase();
          if (c.length >= 2) mList.push(c);
          const stripped = c.replace(/^(?:thuộc về|thuộc|một cách|mang tính|có tính|sự|việc)\s+/i, '').trim();
          if (stripped.length >= 3 && stripped !== c) mList.push(stripped);
        });
      }
      if (Array.isArray(w.synonyms)) {
        w.synonyms.forEach((syn) => {
          const s = String(syn).trim().toLowerCase();
          if (s.length >= 3) mList.push(s);
        });
      }
      wordMeaningsMap.set(cleanLemma, mList);
    });

    let anchorHits = 0;
    const hitAnchorNames = [];
    const missedAnchorNames = [];

    anchorWords.forEach((aw) => {
      const awClean = String(aw || '').toLowerCase().trim();
      const meanings = wordMeaningsMap.get(awClean) || [];
      let found = false;
      for (const m of meanings) {
        if (transLower.includes(m)) {
          found = true;
          break;
        }
      }
      if (found) {
        anchorHits++;
        hitAnchorNames.push(awClean);
      } else {
        missedAnchorNames.push(awClean);
      }
    });

    // Độ bao quát dung lượng đoạn văn
    const lengthRatio = Math.min(1.0, wordCount / Math.max(80, passageWords * 0.55));
    const coverageScore = Math.min(10, Math.round(lengthRatio * 10 * 10) / 10);

    const hasAnchors = anchorWords.length > 0;
    const anchorRatio = hasAnchors
      ? (anchorHits / anchorWords.length)
      : Math.min(0.85, Math.max(0.55, (coverageScore / 10) * 0.85));

    // 5.2 Đối chiếu mạch liên kết từ nối định hướng (Signal Clues)
    const signalPatterns = [
      { signals: ['however', 'yet', 'nevertheless', 'nonetheless'], vn: ['tuy nhiên', 'dẫu vậy', 'tuy thế', 'nhưng'] },
      { signals: ['while', 'whereas', 'in contrast', 'on the other hand', 'conversely'], vn: ['trong khi', 'trong khi đó', 'ngược lại', 'mặt khác'] },
      { signals: ['therefore', 'consequently', 'as a result', 'thus', 'hence'], vn: ['do đó', 'vì vậy', 'kết quả là', 'cho nên', 'bởi vậy'] },
      { signals: ['furthermore', 'in addition', 'moreover', 'besides'], vn: ['hơn nữa', 'ngoài ra', 'thêm vào đó', 'bên cạnh đó'] },
      { signals: ['because', 'since', 'as', 'due to', 'owing to'], vn: ['bởi vì', 'vì', 'do', 'nhờ có'] },
    ];

    let signalPresentInPassageCount = 0;
    let signalReflectedInTransCount = 0;

    signalPatterns.forEach((group) => {
      const presentInPassage = group.signals.some((s) => passage.toLowerCase().includes(s));
      if (presentInPassage) {
        signalPresentInPassageCount++;
        const reflected = group.vn.some((v) => transLower.includes(v));
        if (reflected) signalReflectedInTransCount++;
      }
    });

    const signalRatio = signalPresentInPassageCount > 0 ? (signalReflectedInTransCount / signalPresentInPassageCount) : 0.8;

    // 5.3 Đánh giá tóm tắt ý chính (có kiểm tra gibberish)
    const sumWordsList = sum.split(/\s+/).filter(Boolean);
    const sumWords = sumWordsList.length;
    const sumGibberish = sumWordsList.filter((w) => isGibberishToken(w, passageTokensSet));
    let sumScore = 3.0;
    let sumHasSpam = false;
    if (sumWords > 0 && (sumGibberish.length >= 2 || (sumGibberish.length / sumWords) >= 0.3)) {
      sumScore = 1.0;
      sumHasSpam = true;
    } else if (sumWords >= 12 && sumWords <= 80) {
      sumScore = 8.0;
      const topicKeywords = String(task.theme || '').toLowerCase().split(/[\s&·,]+/);
      const hitsTopic = topicKeywords.some((k) => k.length >= 3 && sumLower.includes(k));
      if (hitsTopic) sumScore = 9.0;
    } else if (sumWords >= 6) {
      sumScore = 6.0;
    } else if (sumWords > 0) {
      sumScore = 4.0;
    }

    // 5.4 Tính điểm thành phần và tổng điểm
    const accuracy = Math.min(9.5, Math.max(3.0, Math.round((coverageScore * 0.45 + anchorRatio * 5.0) * 10) / 10));
    const signalWordsScore = Math.min(9.5, Math.max(3.0, Math.round((signalRatio * 7.5 + 2.0) * 10) / 10));
    const contextInferenceScore = Math.min(9.5, Math.max(3.0, Math.round((anchorRatio * 5.5 + (coverageScore >= 7 ? 3.5 : 2.0)) * 10) / 10));

    let finalScore = Math.min(9.5, Math.max(2.5, Math.round((accuracy * 0.4 + signalWordsScore * 0.2 + contextInferenceScore * 0.2 + sumScore * 0.2) * 10) / 10));
    if (wordCount < 50 && finalScore >= 6.0) {
      finalScore = 5.5;
    }
    const passed = finalScore >= 6.0 && wordCount >= 50;

    // 5.5 Tạo góp ý chi tiết từng câu bám sát bài đọc
    const lineFeedback = [];
    if (sumHasSpam) {
      lineFeedback.push({
        issue: 'Phần tóm tắt ý chính chứa ký tự không hợp lệ',
        student: sum.slice(0, 60),
        advice: 'Vui lòng viết 1–3 câu tiếng Việt súc tích tóm tắt ý chính đoạn văn thay vì gõ ký tự vô nghĩa.',
        suggested: 'Tóm tắt lại luận điểm chính của bài đọc bằng tiếng Việt rõ ràng.',
      });
    }
    if (missedAnchorNames.length > 0) {
      const m1 = missedAnchorNames[0];
      const mMeanings = wordMeaningsMap.get(m1) || [];
      lineFeedback.push({
        issue: `Từ khóa "${m1}" trong bài đọc`,
        student: `Chưa thể hiện rõ nghĩa tiếng Việt tương đương trong bản dịch`,
        advice: `Trong bài đọc, "${m1}" mang nghĩa: ${mMeanings.slice(0, 3).join(', ') || 'thuần ngữ cảnh học thuật'}. Cần đối chiếu kỹ để không làm mờ ý đoạn văn.`,
        suggested: `Dịch bám sát nghĩa "${mMeanings[0] || m1}" trong câu văn tương ứng.`,
      });
    }

    if (signalPresentInPassageCount > 0 && signalReflectedInTransCount < signalPresentInPassageCount) {
      lineFeedback.push({
        issue: 'Mạch liên kết từ nối (Signal Clues)',
        student: 'Một số liên từ chỉ tương phản/kết quả chưa được nhấn mạnh rõ',
        advice: 'Bài đọc sử dụng các từ nối logic để chuyển hướng luận điểm. Hãy chú ý dịch rõ "Tuy nhiên", "Trong khi đó" hoặc "Do đó" để người đọc nắm được mạch lập luận.',
        suggested: 'Giữ nguyên vai trò định hướng của các liên từ ở đầu mệnh đề.',
      });
    }

    if (lineFeedback.length === 0) {
      lineFeedback.push({
        issue: 'Từ nối định hướng & Thuật ngữ học thuật',
        student: trans.slice(0, 70) + (trans.length > 70 ? '...' : ''),
        advice: 'Bản dịch đã chuyển tải tốt các thuật ngữ học thuật và liên kết logic của đoạn văn.',
        suggested: 'Tiếp tục phát huy độ tự nhiên của câu văn khi làm các bài đọc dài hơn.',
      });
    }

    const anchorNote = hasAnchors ? ` Nắm bắt được ${(anchorRatio * 100).toFixed(0)}% từ khóa trọng tâm và mạch suy luận từ nối.` : '';
    const comment = passed
      ? `Bản dịch đạt yêu cầu đọc hiểu (${finalScore}/10).${anchorNote} Tóm tắt ý chính ${sumWords >= 12 && !sumHasSpam ? 'súc tích, rõ ràng' : 'ở mức cơ bản'}.`
      : `Bản dịch chưa đạt (${finalScore}/10 - cần >= 6.0). ${wordCount < 50 ? 'Độ dài bản dịch chưa đạt tối thiểu 50 từ để bao quát bài đọc. ' : ''}${hasAnchors && anchorRatio < 0.5 ? 'Chưa dịch sát nghĩa các từ khóa quan trọng của bài đọc. ' : ''}Vui lòng đối chiếu kỹ lại bản dịch tham khảo và hoàn thiện lại.`;

    return {
      ok: true,
      grade: {
        score: finalScore,
        passed,
        criteria: {
          accuracy,
          signalWords: signalWordsScore,
          contextInference: contextInferenceScore,
          summary: sumScore,
        },
        overallComment: comment,
        lineFeedback,
        modelTranslation: generateTaskModelTranslation(task),
      },
    };
  }

  async function callGeminiApiDirectly(key, payload) {
    const prompt = [
      'Bạn là Giám khảo IELTS Reading & Chuyên gia dịch thuật học thuật tiếng Việt.',
      'Hãy chấm RẤT NGHIÊM TÚC, CÔNG BẰNG VÀ CHÍNH XÁC bài dịch và tóm tắt của học sinh dựa trên ĐÚNG ĐOẠN VĂN GỐC.',
      '',
      'QUY TẮC BẮT BUỘC ĐỂ TRÁNH CHẤM SAI:',
      '1. NẾU BÀI LÀM LÀ KÝ TỰ VÔ NGHĨA (GIBBERISH), GÕ PHÍM NGẪU NHIÊN, SPAM, HOẶC CHƯA PHẢI TIẾNG VIỆT HỢP LỆ:',
      '   - Cho điểm từ 1.0 đến 2.0 / 10.',
      '   - passed: false.',
      '   - overallComment: Nêu rõ bài làm chứa ký tự vô nghĩa/chưa dịch nghiêm túc, yêu cầu đọc bài và dịch lại.',
      '   - TUYỆT ĐỐI KHÔNG khen ngợi hay cho điểm đỗ bài làm vô nghĩa!',
      '',
      '2. NẾU BÀI LÀM SAO CHÉP LẠI TIẾNG ANH:',
      '   - Cho điểm 1.5 - 2.0 / 10, passed: false.',
      '   - overallComment: Nêu rõ học sinh đang sao chép lại tiếng Anh thay vì dịch sang tiếng Việt.',
      '',
      '3. NẾU BẢN DỊCH QUÁ NGẮN (< 40 từ) HOẶC BỎ SÓT ĐA SỐ CÂU:',
      '   - Cho điểm từ 2.5 đến 4.5 / 10, passed: false.',
      '   - overallComment: Nêu rõ bản dịch chưa bao quát đủ dung lượng đoạn văn.',
      '',
      '4. ĐỐI CHIẾU NỘI DUNG VỚI ĐOẠN GỐC TIẾNG ANH:',
      '   - Kiểm tra học sinh có dịch đúng các từ khóa trọng tâm: ' + (payload.anchorWords || []).join(', '),
      '   - Kiểm tra học sinh có bắt đúng logic các từ nối định hướng: ' + (payload.signalClues || []).join(', '),
      '   - Kiểm tra độ chuẩn xác của câu văn tiếng Việt, không bịa đặt ý.',
      '   - Kiểm tra tóm tắt 1-3 câu có nắm bắt đúng ý chính của đoạn văn không.',
      '',
      'Trả về DUY NHẤT một chuỗi JSON hợp lệ theo schema sau (không dùng markdown fence ```json):',
      '{',
      '  "score": <số thực từ 0.0 đến 10.0, ví dụ 7.5>,',
      '  "passed": <boolean, true nếu score >= 6.0>,',
      '  "criteria": {',
      '    "accuracy": <số 0..10>,',
      '    "signalWords": <số 0..10>,',
      '    "contextInference": <số 0..10>,',
      '    "summary": <số 0..10>',
      '  },',
      '  "overallComment": "<nhận xét chi tiết 3-5 câu đánh giá khách quan điểm mạnh, điểm yếu dựa trên bài làm thực tế>",',
      '  "lineFeedback": [',
      '    { "issue": "<cụm từ/câu gốc trong bài>", "student": "<cách học sinh dịch>", "advice": "<phân tích ngữ cảnh>", "suggested": "<gợi ý dịch chuẩn>" }',
      '  ],',
      '  "modelTranslation": "<bản dịch tham khảo chuẩn mực toàn bộ đoạn văn>"',
      '}',
      '',
      '=== ĐOẠN VĂN TIẾNG ANH (' + (payload.taskLabel || 'Task') + ') ===',
      payload.passage,
      '',
      '=== BÀI DỊCH CỦA HỌC SINH ===',
      payload.translation,
      '',
      '=== TÓM TẮT Ý CHÍNH CỦA HỌC SINH ===',
      payload.summary || '(Học sinh không nhập tóm tắt)'
    ].join('\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          responseMimeType: 'application/json'
        },
      }),
    });
    if (!resp.ok) {
      throw new Error(`Gemini HTTP ${resp.status}`);
    }
    const body = await resp.json();
    const txt = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = txt.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const grade = JSON.parse(clean);
    grade.score = Number(grade.score || 0);
    grade.passed = grade.score >= 6.0;
    if (!grade.modelTranslation) {
      grade.modelTranslation = generateTaskModelTranslation(activeTask);
    }
    return grade;
  }

  async function requestAiGrading(payload) {
    const preCheck = preValidateTranslationLocally(payload);
    if (preCheck) {
      return { ...preCheck, engine: 'local-anti-spam' };
    }

    const user = B()?.getCurrentUser?.();
    const syncUrl = B()?.getSyncUrl?.() || '';

    // 1. Kiểm tra key Gemini cục bộ đã lưu trên trình duyệt giáo viên
    let localKey = '';
    try { localKey = localStorage.getItem(LOCAL_AI_KEY_STORAGE) || ''; } catch (_) {}
    if (!localKey && window.__GEMINI_API_KEY__) localKey = window.__GEMINI_API_KEY__;

    if (localKey) {
      try {
        const grade = await callGeminiApiDirectly(localKey, payload);
        if (grade && typeof grade.score === 'number') {
          return { ok: true, grade, engine: 'gemini-2.5-flash' };
        }
      } catch (err) {
        console.warn('Direct Gemini API call error:', err);
      }
    }

    // 2. Kiểm tra proxy Google Apps Script (nếu có cấu hình)
    if (syncUrl) {
      try {
        const res = await fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'grade_translation',
            id: payload.studentId || user?.id || 'thanhngoc',
            ...payload,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.ok && data.grade && typeof data.grade.score === 'number') {
            if (!data.grade.modelTranslation) {
              data.grade.modelTranslation = generateTaskModelTranslation(activeTask);
            }
            return { ok: true, grade: data.grade, engine: 'apps-script-gemini' };
          }
        }
      } catch (err) {
        console.warn('Apps Script Gemini proxy error, falling back to local semantic engine:', err);
      }
    }

    // 3. Fallback an toàn tuyệt đối: Bộ phân tích ngữ nghĩa đối chiếu bài đọc (Semantic Context Engine - nghiêm ngặt & chuẩn xác)
    return evaluateTranslationLocally(payload);
  }

  async function submitTranslationForAi() {
    if (!activeTask) return;
    const isTeacherSession = Boolean(isPreviewTestMode || B()?.isTeacherUser?.() || B()?.getCurrentUser?.()?.role === 'teacher');
    const trans = (document.getElementById('task-trans-input')?.value || '').trim();
    const summary = (document.getElementById('task-summary-input')?.value || '').trim();
    const transWords = trans.split(/\s+/).filter(Boolean).length;
    const sumWords = summary.split(/\s+/).filter(Boolean).length;

    const rqTotal = t3ReadingQuestions.length;
    const rqAnswered = t3ReadingQuestions.filter((q) => Boolean(t3ReadingAnswers[q.id])).length;
    const rqCorrect = t3ReadingQuestions.filter((q) => t3ReadingAnswers[q.id] === q.answer).length;

    if (transWords === 0 && sumWords === 0) {
      B()?.showToast('Vui lòng nhập nội dung bản dịch hoặc tóm tắt ý chính để AI chấm!');
      return;
    }
    if (rqTotal > 0 && (!isTeacherSession ? rqAnswered < rqTotal : (rqAnswered > 0 && rqAnswered < rqTotal))) {
      B()?.showToast(`Vui lòng hoàn thành đủ ${rqTotal} câu Đọc hiểu (hiện ${rqAnswered}/${rqTotal}) trước khi nộp bài!`);
      return;
    }

    const btn = document.getElementById('btn-submit-ai-grade');
    const out = document.getElementById('task-ai-grade-result');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'AI đang chấm chi tiết...';
    }

    try {
      const user = B()?.getCurrentUser?.();
      const res = await requestAiGrading({
        studentId: user?.id || '',
        studentName: user?.name || '',
        taskLabel: activeTask.label,
        passage: activeTask.passage.text,
        anchorWords: activeTask.passage.anchorWords,
        signalClues: activeTask.passage.signalClues,
        translation: trans,
        summary,
      });

      if (!res.ok || !res.grade) {
        if (out) {
          out.style.display = 'block';
          out.className = 'ai-grade-box fail';
          out.innerHTML = `<strong>Chưa chấm được:</strong> ${B()?.escapeHtml(res.error || 'Lỗi kết nối AI')}`;
        }
        switchT3Tab('grade');
        return;
      }

      const g = res.grade;
      const rqFailed = rqTotal > 0 && rqAnswered === rqTotal && rqCorrect < 6;
      if (rqFailed) g.passed = false;
      g.readingQuiz = rqAnswered > 0 ? { total: rqTotal, correct: rqCorrect } : null;
      highlightPassageAfterGrading();
      const esc = B()?.escapeHtml || ((x) => String(x));
      const c = g.criteria || {};
      const rqReviewHtml = (rqAnswered > 0 && rqTotal > 0)
        ? `<div class="t3-rq-review-list">
            <div style="font-size:15px; font-weight:800; color:var(--text-bright);">
              Đọc hiểu đoạn trích: ${rqCorrect} / ${rqTotal} câu đúng ${rqFailed ? '(Cần >= 6/10)' : '✓'}
            </div>
            ${t3ReadingQuestions.map((q, idx) => {
              const stu = t3ReadingAnswers[q.id] || '';
              const isOk = stu === q.answer;
              return `
                <div class="t3-rq-review-item ${isOk ? '' : 'is-wrong'}">
                  <div><strong>Câu ${idx + 1} (${esc(q.type === 'mcq' ? 'MCQ' : 'TFNG')}):</strong> ${isOk ? '✓ Đúng' : '✗ Sai'} — ${esc(q.prompt)}</div>
                  ${!isOk ? `<div class="task-text-err">Bạn chọn: <strong>${esc(stu)}</strong> · Đáp án: <strong>${esc(q.answer)}</strong></div>` : ''}
                  ${q.explain ? `<div style="color:var(--text-muted); margin-top:2px;">${esc(q.explain)}</div>` : ''}
                </div>
              `;
            }).join('')}
          </div>`
        : '';
      const linesHtml = (g.lineFeedback || []).slice(0, 6).map((lf) => `
        <div style="padding:12px 15px; border-radius:12px; background:var(--card-bg); border:1px solid var(--card-border); margin-top:10px; font-size:15.5px; line-height:1.55;">
          <div><strong>Cụm / câu cần sửa:</strong> ${esc(lf.issue || '')}</div>
          ${lf.student ? `<div class="task-text-err" style="margin-top:4px;"><strong>Bạn dịch:</strong> ${esc(lf.student)}</div>` : ''}
          ${lf.advice ? `<div style="margin-top:4px;"><strong>Phân tích:</strong> ${esc(lf.advice)}</div>` : ''}
          ${lf.suggested ? `<div class="task-text-ok" style="margin-top:4px;"><strong>Gợi ý chuẩn:</strong> ${esc(lf.suggested)}</div>` : ''}
        </div>
      `).join('');

      t3Completed = Boolean(g.passed);
      lastT3Grade = g.passed ? g : null;
      updateFinishButtonUI();

      let masteryNote = '';
      if (g.passed && isTeacherSession) {
        const durationSec = Math.max(1, Math.round((Date.now() - (taskStartedAt || Date.now())) / 1000));
        const totalT1 = activeTask.words?.length || 50;
        const t1AccuracyPct = Math.max(0, Math.round(((totalT1 - Math.min(totalT1, t1Mistakes)) / totalT1) * 100));
        const totalT2 = (t2ParaPairs.length + t2WbBoards.reduce((s, b) => s + (b.items?.length || 0), 0) + t2ContextQs.length) || getTaskTest2Total(activeTask);
        lastPreviewSummaryRecord = {
          taskId: activeTask.id,
          status: 'completed',
          test1Mistakes: t1Mistakes,
          test1AccuracyPct: t1AccuracyPct,
          test2Score: t2Correct,
          test2Total: totalT2,
          translationScore: g.score,
          durationSec,
          linkedCount: activeTask.linkedIds.length,
          newlyMarked: activeTask.linkedIds.length,
          updatedAt: Date.now(),
        };
        masteryNote = `
          <div style="margin-top:14px; padding:14px 16px; border-radius:12px; background:rgba(82,136,62,0.16); border:1px solid rgba(82,136,62,0.35); color:var(--text-bright); font-size:15.5px;">
            <div style="font-weight:800;">✓ Đạt Test thử ${esc(activeTask.label)}! (Chế độ xem thử không lưu điểm vào báo cáo lớp)</div>
            <div style="margin-top:10px;">
              <button type="button" class="btn btn-primary" onclick="TasksModule.openTaskSummaryModal('${esc(activeTask.id)}', true)">Xem Bảng Thống Kê Hoàn Thành (Preview)</button>
            </div>
          </div>`;
      } else if (g.passed) {
        const all3Done = t1Completed && t2Completed && t3Completed;
        if (all3Done) {
          masteryNote = `
            <div style="margin-top:14px; padding:14px 16px; border-radius:12px; background:rgba(82,136,62,0.16); border:1px solid rgba(82,136,62,0.35); color:var(--text-bright); font-size:15.5px;">
              <div style="font-weight:800;">✓ Đạt đủ 3/3 phần Test (${esc(activeTask.label)})! Bấm nút <strong>Finish · Nộp bài</strong> ở góc trên hoặc nút bên dưới để hoàn tất nộp bài và xem Bảng Thống Kê.</div>
              <div style="margin-top:10px;">
                <button type="button" class="btn btn-primary" id="btn-t3-finish-inline" onclick="TasksModule.finishTaskExam()">Finish · Nộp bài &amp; Xem Tổng Kết ✓</button>
              </div>
            </div>`;
        } else {
          const missing = [];
          if (!t1Completed) missing.push('Test 1');
          if (!t2Completed) missing.push('Test 2');
          masteryNote = `
            <div style="margin-top:14px; padding:14px 16px; border-radius:12px; background:rgba(245,158,11,0.14); border:1px solid rgba(245,158,11,0.35); color:var(--text-bright); font-size:15.5px;">
              <div style="font-weight:800;">✓ Test 3 đạt ${g.score.toFixed(1)}/10, nhưng bạn cần hoàn thành đủ: ${esc(missing.join(', '))} trước khi bấm Finish nộp bài.</div>
            </div>`;
        }
      }

      const tabBadge = document.getElementById('t3-tab-score-badge');
      if (tabBadge) {
        tabBadge.style.display = 'inline-flex';
        tabBadge.className = `t3-tab-score-badge ${g.passed ? '' : 'is-fail'}`;
        tabBadge.textContent = `${g.score.toFixed(1)}/10`;
      }

      if (out) {
        out.style.display = 'block';
        out.className = `ai-grade-box ${g.passed ? '' : 'fail'}`;
        out.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
            <strong style="font-size:24px; color:var(--text-bright);">Điểm AI: ${g.score.toFixed(1)} / 10</strong>
            <span class="tip-pill" style="margin:0; font-size:13.5px;">${g.passed ? 'ĐẠT TASK' : 'CẦN DỊCH LẠI (>= 6.0)'}</span>
          </div>
          <div class="ai-criteria-grid">
            <div class="ai-crit-pill"><span>Độ chính xác</span><span>${c.accuracy ?? '--'}/10</span></div>
            <div class="ai-crit-pill"><span>Từ nối định hướng</span><span>${c.signalWords ?? '--'}/10</span></div>
            <div class="ai-crit-pill"><span>Đoán từ ngữ cảnh</span><span>${c.contextInference ?? '--'}/10</span></div>
            <div class="ai-crit-pill"><span>Tóm tắt ý chính</span><span>${c.summary ?? '--'}/10</span></div>
          </div>
          <div style="font-size:16.5px; line-height:1.6;"><strong>Nhận xét:</strong> ${esc(g.overallComment || '')}</div>
          ${rqReviewHtml}
          ${linesHtml}
          ${g.modelTranslation ? `<details style="margin-top:14px; font-size:15.5px;"><summary style="cursor:pointer; font-weight:750;">Xem bản dịch chuẩn tham khảo</summary><div style="margin-top:8px; line-height:1.65;">${esc(g.modelTranslation)}</div></details>` : ''}
          ${masteryNote}
          <div style="display:flex; justify-content:flex-start; margin-top:16px;">
            <button type="button" class="btn-subtle" id="btn-t3-back-to-write" style="font-size:15px; padding:10px 18px;" onclick="TasksModule.switchT3Tab('write')">← Quay lại sửa bài</button>
          </div>
        `;
      }

      switchT3Tab('grade');

      if (g.passed && isTeacherSession) {
        setTimeout(() => openTaskSummaryModal(activeTask?.id, true), 180);
      }
    } catch (err) {
      if (out) {
        out.style.display = 'block';
        out.className = 'ai-grade-box fail';
        out.textContent = `Lỗi khi chấm bài: ${err.message || err}`;
      }
      switchT3Tab('grade');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Nộp & AI chấm';
      }
    }
  }

  // =========================================================
  // LIFECYCLE HOOKS
  // =========================================================
  let urlCheckedForUid = null;

  function onUserEntered(account) {
    assignedUrlTaskIds = parseUrlAssignedTasks();
    recordUrlTaskDeadlines(assignedUrlTaskIds);
    const previewStage = parseUrlPreviewStage(account);
    const sTasksBtn = document.getElementById('btn-open-student-tasks');
    if (!account) return;
    if (account.role === 'teacher') {
      urlCheckedForUid = account.id;
      if (sTasksBtn) sTasksBtn.style.display = 'none';
      syncAssignedTaskScopes();
      renderTeacherDashboard();
      if (previewStage > 0) {
        openAdminTestPreview(previewStage, assignedUrlTaskIds[0] || 'task_01');
      }
      return;
    }
    if (sTasksBtn) {
      sTasksBtn.style.display = 'inline-flex';
    }
    // Chống F5 / tải lại trang để reset giờ & xóa lỗi khi đang thi dở Test Task
    if (!isTeacherOrBypassed()) {
      const interruptedExam = loadActiveExamSession();
      if (interruptedExam && interruptedExam.taskId && interruptedExam.inExam && (Date.now() - Number(interruptedExam.updatedAt || 0)) < LOCK_PENALTY_MS) {
        const nextWarn = Number(interruptedExam.leaveWarnings || 0) + 1;
        if (nextWarn >= 3) {
          clearActiveExamSession();
          const locks = loadTaskLocks();
          locks[interruptedExam.taskId] = Date.now() + LOCK_PENALTY_MS;
          saveTaskLocks(locks);
          B()?.saveAndSync?.();
          setTimeout(() => B()?.showToast?.('Phát hiện tải lại trang lần 3 khi đang làm Test — Task đã bị khóa 30 phút!'), 250);
        } else {
          saveActiveExamSession({
            ...interruptedExam,
            leaveWarnings: nextWarn,
            inExam: false,
            updatedAt: Date.now(),
          });
          setTimeout(() => B()?.showToast?.(`Cảnh báo ${nextWarn}/3: Không tải lại trang khi đang làm Test (lần 3 sẽ khóa Task 30 phút và mất bài)!`), 250);
        }
      }
    }
    const curScope = B()?.getCurrentScopeKey?.() || '';
    const curTask = isAnyTaskId(curScope) ? getTaskById(curScope) : null;
    if (curTask && !isTeacherOrBypassed() && getTaskExpiryState(curTask.id).expired) {
      syncAssignedTaskScopes();
      B()?.loadMainScope?.(curTask.scopeKey || 'paraphrase');
      openTaskBriefModal(curTask.id);
      return;
    }
    if (curTask && !isTeacherOrBypassed() && getTaskLockRemainingMs(curTask.id) > 0) {
      syncAssignedTaskScopes();
      B()?.loadMainScope?.(curTask.scopeKey || 'paraphrase');
      openTaskBriefModal(curTask.id);
      return;
    }
    syncAssignedTaskScopes(curTask);
    if (curTask) {
      onScopeChanged(curTask.id);
    }
    if (urlCheckedForUid !== account.id && previewStage > 0) {
      urlCheckedForUid = account.id;
      openAdminTestPreview(previewStage, assignedUrlTaskIds[0] || 'task_01');
      return;
    }
    if (urlCheckedForUid !== account.id && assignedUrlTaskIds.length > 0) {
      urlCheckedForUid = account.id;
      if (!curTask || !assignedUrlTaskIds.includes(curTask.id)) {
        if (assignedUrlTaskIds.length === 1) {
          openTaskBriefModal(assignedUrlTaskIds[0]);
        } else {
          openStudentTasksModal();
        }
      }
    }
  }

  function onUserLogout() {
    urlCheckedForUid = null;
    isPreviewTestMode = false;
    dismissTaskExitWarn();
    const savedExam = loadActiveExamSession();
    if (savedExam && savedExam.inExam) {
      saveActiveExamSession({ ...savedExam, inExam: false, updatedAt: Date.now() });
    }
    const sTasksBtn = document.getElementById('btn-open-student-tasks');
    if (sTasksBtn) sTasksBtn.style.display = 'none';
    stopIdleMonitor();
    activeTask = null;
    activeStage = 0;
    taskTestPassed = false;
    t1Completed = false;
    t2Completed = false;
    t3Completed = false;
    lastT3Grade = null;
    lastPreviewSummaryRecord = null;
    B()?.syncExamLock?.(false);
    document.getElementById('screen-task')?.classList.remove('open', 'active', 'exam-no-copy');
    document.getElementById('task-stage-container')?.style.removeProperty('visibility');
    document.getElementById('task-leave-warn-banner')?.remove();
    updateTaskStudyBar();
    closeStudentTasksModal();
    closeTaskBriefModal();
    closeTaskExamReadyModal();
    closeTaskSummaryModal();
  }

  function formatDurationVi(sec) {
    const s = Math.max(0, Number(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    if (m <= 0) return `${r} giây`;
    return `${m} phút ${String(r).padStart(2, '0')} giây`;
  }

  function openTaskSummaryModal(focusTaskId = null, previewStudentSummary = false) {
    const bridge = B();
    const esc = bridge?.escapeHtml || ((x) => String(x));
    const titleEl = document.getElementById('task-summary-modal-title');
    const subEl = document.getElementById('task-summary-subtitle');
    const bodyEl = document.getElementById('task-summary-body');
    if (!bodyEl) return;

    if (bridge?.isTeacherUser?.() && !previewStudentSummary) {
      if (titleEl) titleEl.textContent = 'Bảng Thống Kê Task Cả Lớp';
      if (subEl) subEl.textContent = 'Theo dõi số Task hoàn thành, điểm Test và điểm Dịch AI của từng học viên';
      const students = bridge.getStudentAccounts?.() || [];
      const cache = bridge.getCloudClassCache?.() || {};
      const totalTasks = getAllCatalogTasks().length || 110;
      const rowsHtml = students.map((st) => {
        const uid = bridge.getScopedUid(st.id);
        let tp = cache[uid]?.syncData?.taskProgress || null;
        if (!tp) {
          try {
            tp = JSON.parse(localStorage.getItem(`${bridge.TASK_PROGRESS_KEY_BASE}${uid}`) || '{}') || {};
          } catch (_) { tp = {}; }
        }
        const doneEntries = Object.entries(tp).filter(([, v]) => v?.status === 'completed');
        const avgAi = computeAvgAiScore(doneEntries) || '--';
        const detailHtml = renderCompactCompletedTasksCell(doneEntries, totalTasks, esc, true);
        return `
          <tr>
            <td><strong>${esc(st.name)}</strong></td>
            <td><strong>${doneEntries.length} / ${totalTasks}</strong></td>
            <td>${avgAi}</td>
            <td style="font-size:12.5px;">${detailHtml}</td>
          </tr>
        `;
      }).join('');

      bodyEl.innerHTML = `
        <div class="class-report-table-wrap">
          <table class="class-report-table">
            <thead>
              <tr><th>Học viên</th><th>Số Task xong</th><th>Điểm AI TB</th><th>Chi tiết các Task đã xong</th></tr>
            </thead>
            <tbody>${rowsHtml || '<tr><td colspan="4" style="text-align:center;">Chưa có dữ liệu học viên.</td></tr>'}</tbody>
          </table>
        </div>
      `;
      document.getElementById('modal-task-summary')?.classList.add('open');
      return;
    }

    // Student Task Summary View (or Teacher Post-Test Preview)
    const prog = previewStudentSummary ? {} : loadTaskProgress();
    const allTasks = getAllCatalogTasks();
    const focusTask = focusTaskId ? getTaskById(focusTaskId) : null;
    const focusRec = (previewStudentSummary && lastPreviewSummaryRecord && (!focusTask || lastPreviewSummaryRecord.taskId === focusTask.id))
      ? lastPreviewSummaryRecord
      : (focusTask ? prog[focusTask.id] : null);
    if (focusTask && !previewStudentSummary && !isTeacherOrBypassed() && (!focusRec || focusRec.status !== 'completed')) {
      const exp = getTaskExpiryState(focusTask.id);
      if (exp.expired) {
        B()?.showToast?.('Task đã kết thúc! Bạn chưa hoàn thành nên không thể xem kết quả.');
        openTaskBriefModal(focusTask.id);
        return;
      }
    }
    const doneList = (previewStudentSummary && focusTask && focusRec?.status === 'completed')
      ? [{ task: focusTask, rec: focusRec }]
      : allTasks
          .map((t) => ({ task: t, rec: prog[t.id] }))
          .filter((x) => x.rec && x.rec.status === 'completed');

    const computeTaskOverallScore = (taskObj, recObj) => {
      if (taskObj?.taskKind === 'recognition' || isRecognitionTaskEntry(taskObj?.id, recObj)) {
        const pct = Math.max(0, Math.min(100, Number(recObj?.recognitionScore ?? 0)));
        return Math.round((pct / 10) * 10) / 10;
      }
      const t1Ratio = Math.max(0, Math.min(1, Number(recObj?.test1AccuracyPct ?? 100) / 100));
      const t2Tot = Math.max(1, getTaskTest2Total(taskObj, recObj));
      const t2Ratio = Math.max(0, Math.min(1, Number(recObj?.test2Score ?? 0) / t2Tot));
      const t3Ratio = Math.max(0, Math.min(1, Number(recObj?.translationScore || 0) / 10));
      return Math.round((((t1Ratio + t2Ratio + t3Ratio) / 3) * 10) * 10) / 10;
    };

    const totalDone = doneList.length;
    const avgOverallScore = totalDone
      ? (doneList.reduce((s, x) => s + computeTaskOverallScore(x.task, x.rec), 0) / totalDone).toFixed(1)
      : '--';
    const totalSecs = doneList.reduce((s, x) => s + Number(x.rec.durationSec || 0), 0);
    const totalLinkedWords = new Set(
      doneList.flatMap((x) => x.task.linkedIds || [])
    ).size;

    if (titleEl) {
      titleEl.textContent = (focusTask && focusRec?.status === 'completed')
        ? `Hoàn Thành ${focusTask.label} — Bảng Thống Kê${previewStudentSummary ? ' (Bản Preview Học Viên)' : ''}`
        : 'Bảng Thống Kê Tiến Độ Task';
    }
    if (subEl) {
      subEl.textContent = `${totalDone} / ${allTasks.length} Task đã hoàn thành · Toàn bộ từ thuộc các Task đã xong được đánh dấu Đã thuộc ở bộ chính`;
    }

    const t2Total = (focusTask && focusRec) ? getTaskTest2Total(focusTask, focusRec) : 56;
    const focusOverall = (focusTask && focusRec) ? computeTaskOverallScore(focusTask, focusRec) : 0;
    const focusHtml = (focusTask && focusRec?.status === 'completed') ? `
      <div class="task-summary-highlight">
        <div class="task-sum-hero-row">
          <div class="task-sum-panda-ring">
            <img src="assets/images/totoro_professor.png" alt="" class="task-summary-panda">
          </div>
          <div class="task-sum-hero-main">
            <div class="task-sum-badges">
              <span class="task-sum-done-pill">✓ HOÀN THÀNH ${esc(focusTask.label.toUpperCase())} · ${esc(formatDurationVi(focusRec.durationSec))}</span>
              ${previewStudentSummary ? '<span class="task-sum-preview-pill">Bản xem thử (không lưu điểm lớp)</span>' : ''}
            </div>
            <div class="task-sum-hero-title">${esc(focusTask.theme)}</div>
            <div class="task-sum-hero-note">
              Đã hoàn tất 50 từ gốc + Word Family và vượt qua đủ 3 bài Test kiểm tra thực chiến.
            </div>
          </div>
          <div class="task-sum-score-card">
            <div class="task-sum-score-label">Điểm tổng</div>
            <div class="task-sum-score-num">${focusOverall.toFixed(1)}</div>
            <div class="task-sum-score-sub">/ 10 · Trung bình 3 Test</div>
          </div>
        </div>
      </div>
      <div class="task-sum-stage-grid">
        <div class="task-sum-stat is-mint">
          <div class="task-sum-stat-label">Test 1 · Ghép nghĩa</div>
          <div class="task-sum-stat-val">${focusRec.test1AccuracyPct ?? 100}%</div>
          <div class="task-sum-stat-sub">${focusRec.test1Mistakes ?? 0} lỗi trên 10 bảng</div>
        </div>
        <div class="task-sum-stat is-teal">
          <div class="task-sum-stat-label">Test 2 · ${isParaphraseTask(focusTask) ? 'Paraphrase' : 'Word Box'}</div>
          <div class="task-sum-stat-val">${focusRec.test2Score ?? 0} / ${t2Total}</div>
          <div class="task-sum-stat-sub">${isParaphraseTask(focusTask) ? 'Nối Synonyms + Word Box' : 'Summary / Sentence Completion'}</div>
        </div>
        <div class="task-sum-stat is-gold">
          <div class="task-sum-stat-label">Test 3 · Đọc hiểu &amp; Dịch</div>
          <div class="task-sum-stat-val">${Number(focusRec.translationScore || 0).toFixed(1)} / 10</div>
          <div class="task-sum-stat-sub">${focusRec.test3ReadingScore != null ? `Đọc hiểu ${focusRec.test3ReadingScore}/${focusRec.test3ReadingTotal || 10} · ` : ''}Dịch đoạn &amp; tóm tắt</div>
        </div>
        <div class="task-sum-stat is-coral">
          <div class="task-sum-stat-label">Từ vựng · Tiến độ</div>
          <div class="task-sum-stat-val">50 / 50 từ</div>
          <div class="task-sum-stat-sub">+${focusRec.newlyMarked ?? 0} mới · ${totalDone}/${allTasks.length} Task</div>
        </div>
      </div>
    ` : `
      <div class="task-sum-stage-grid">
        <div class="task-sum-stat is-mint"><div class="task-sum-stat-label">Task hoàn thành</div><div class="task-sum-stat-val">${totalDone} / ${allTasks.length}</div><div class="task-sum-stat-sub">Tiến độ toàn khóa</div></div>
        <div class="task-sum-stat is-gold"><div class="task-sum-stat-label">Điểm tổng TB</div><div class="task-sum-stat-val">${avgOverallScore} / 10</div><div class="task-sum-stat-sub">Trung bình 3 Test mỗi Task</div></div>
        <div class="task-sum-stat is-teal"><div class="task-sum-stat-label">Tổng thời gian Task</div><div class="task-sum-stat-val">${esc(formatDurationVi(totalSecs))}</div><div class="task-sum-stat-sub">Thời gian làm bài</div></div>
        <div class="task-sum-stat is-coral"><div class="task-sum-stat-label">Từ Đã thuộc qua Task</div><div class="task-sum-stat-val">${totalLinkedWords} từ</div><div class="task-sum-stat-sub">Đã đồng bộ bộ chính</div></div>
      </div>
    `;

    const inActiveExamModal = Boolean(document.getElementById('screen-task')?.classList.contains('open'));
    bodyEl.innerHTML = `
      ${focusHtml}
      <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:20px; flex-wrap:wrap;">
        <button type="button" class="btn-subtle" style="font-size:15.5px; padding:11px 20px;" onclick="TasksModule.closeTaskSummaryModal()">${inActiveExamModal ? '← Xem lại bài làm' : 'Đóng'}</button>
        <button type="button" class="btn btn-primary" style="font-size:15.5px; padding:11px 22px;" onclick="TasksModule.closeTaskSummaryModal(); TasksModule.exitTaskWorkspace(false);">Về màn hình từ vựng chính →</button>
      </div>
    `;
    document.getElementById('modal-task-summary')?.classList.add('open');
  }

  function updateFinishButtonUI() {
    const btn = document.getElementById('btn-task-finish');
    if (!btn) return;
    if (isTeacherOrBypassed()) {
      btn.disabled = false;
      btn.textContent = 'Finish · Xem Preview';
      btn.title = 'Xem trước màn hình Tổng kết hoàn thành Task (không lưu điểm vào lớp)';
      return;
    }
    if (taskTestPassed) {
      btn.disabled = false;
      btn.textContent = 'Xem Tổng Kết ✓';
      btn.title = 'Xem lại Bảng Thống Kê hoàn thành Task';
      return;
    }
    const doneCount = (t1Completed ? 1 : 0) + (t2Completed ? 1 : 0) + (t3Completed ? 1 : 0);
    const canFinish = t1Completed && t2Completed && t3Completed && Boolean(lastT3Grade?.passed);
    btn.disabled = !canFinish;
    btn.textContent = canFinish ? 'Finish · Nộp bài ✓' : `Finish · Nộp bài (${doneCount}/3)`;
    const missing = [];
    if (!t1Completed) missing.push('Test 1');
    if (!t2Completed) missing.push('Test 2');
    if (!t3Completed) missing.push('Test 3 (Đạt >= 6.0)');
    btn.title = canFinish
      ? 'Bấm để nộp bài hoàn thành Task và lưu điểm'
      : `Cần hoàn thành đủ 3 bài Test trước khi bấm Finish (còn thiếu: ${missing.join(', ')})`;
  }

  function finishTaskExam() {
    if (!activeTask) return;
    if (isTeacherOrBypassed()) {
      const durationSec = Math.max(1, Math.round((Date.now() - (taskStartedAt || Date.now())) / 1000));
      const totalT1 = activeTask.words?.length || 50;
      const t1AccuracyPct = Math.max(0, Math.round(((totalT1 - Math.min(totalT1, t1Mistakes)) / totalT1) * 100));
      const totalT2 = (t2ParaPairs.length + t2WbBoards.reduce((s, b) => s + (b.items?.length || 0), 0) + t2ContextQs.length) || getTaskTest2Total(activeTask);
      const previewScore = Number(lastT3Grade?.score || lastPreviewSummaryRecord?.translationScore || 8.5);
      lastPreviewSummaryRecord = {
        taskId: activeTask.id,
        status: 'completed',
        test1Mistakes: t1Mistakes,
        test1AccuracyPct: t1AccuracyPct,
        test2Score: t2Correct > 0 ? t2Correct : totalT2,
        test2Total: totalT2,
        translationScore: previewScore,
        durationSec,
        linkedCount: activeTask.linkedIds.length,
        newlyMarked: activeTask.linkedIds.length,
        updatedAt: Date.now(),
      };
      openTaskSummaryModal(activeTask.id, true);
      return;
    }

    if (taskTestPassed) {
      openTaskSummaryModal(activeTask.id, false);
      return;
    }

    if (!t1Completed || !t2Completed || !t3Completed || !lastT3Grade?.passed) {
      const missing = [];
      if (!t1Completed) missing.push('Test 1');
      if (!t2Completed) missing.push('Test 2');
      if (!t3Completed) missing.push('Test 3 (Đạt >= 6.0)');
      B()?.showToast?.(`Chưa thể Finish! Cần hoàn thành đủ cả 3 bài Test (còn thiếu: ${missing.join(', ')}).`);
      updateFinishButtonUI();
      return;
    }

    taskTestPassed = true;
    clearActiveExamSession();
    stopIdleMonitor();
    B()?.syncExamLock?.(false);
    document.getElementById('screen-task')?.classList.remove('exam-no-copy');
    document.getElementById('task-leave-warn-banner')?.remove();
    const durationSec = Math.max(1, Math.round((Date.now() - (taskStartedAt || Date.now())) / 1000));
    const totalT1 = activeTask.words?.length || 50;
    const t1AccuracyPct = Math.max(0, Math.round(((totalT1 - Math.min(totalT1, t1Mistakes)) / totalT1) * 100));
    const totalT2 = (t2ParaPairs.length + t2WbBoards.reduce((s, b) => s + (b.items?.length || 0), 0) + t2ContextQs.length) || getTaskTest2Total(activeTask);
    const newlyMarked = B()?.markMasteredBatch?.(activeTask.linkedIds) || 0;
    const prog = loadTaskProgress();
    prog[activeTask.id] = {
      status: 'completed',
      test1Mistakes: t1Mistakes,
      test1AccuracyPct: t1AccuracyPct,
      test2Score: t2Correct,
      test2Total: totalT2,
      test3ReadingScore: lastT3Grade?.readingQuiz?.correct ?? null,
      test3ReadingTotal: lastT3Grade?.readingQuiz?.total ?? (t3ReadingQuestions.length || 10),
      translationScore: lastT3Grade.score,
      durationSec,
      linkedCount: activeTask.linkedIds.length,
      newlyMarked,
      updatedAt: Date.now(),
    };
    saveTaskProgress(prog);
    B()?.saveAndSync?.();
    updateFinishButtonUI();
    openTaskSummaryModal(activeTask.id, false);
  }

  function closeTaskSummaryModal(event) {
    if (event && event.target !== document.getElementById('modal-task-summary')) return;
    document.getElementById('modal-task-summary')?.classList.remove('open');
  }

  function onCloudMerged() {
    updateTaskStudyBar();
    if (pendingTaskId && document.getElementById('modal-task-brief')?.classList.contains('open')) {
      updateBriefLockUI();
    }
    if (document.getElementById('modal-student-tasks')?.classList.contains('open')) {
      openStudentTasksModal();
    }
  }

  window.TasksModule = {
    renderTeacherDashboard,
    setTeacherTableView,
    refreshTeacherDashboard,
    unlockStudentTasks,
    exportClassReportCsv,
    toggleTeacherPendingFilter,
    toggleTeacherTask,
    selectTeacherTaskRange,
    clearTeacherTaskSelection,
    onTeacherDeadlinePresetChange,
    updateTeacherLinkPreview,
    copyTeacherTaskLink,
    applyTeacherLiveDeadline,
    extendTaskDeadlineByMinutes,
    endSelectedTasksNow,
    updateTasksLiveDeadline,
    saveLocalGeminiKey,
    openStudentTasksModal,
    closeStudentTasksModal,
    openTaskBriefModal,
    getTasksByScope,
    closeTaskBriefModal,
    checkTaskUnlockNow,
    viewExpiredTaskResult,
    getTaskDeadlineInfo,
    getTaskExpiryState,
    getOldWordsToReviewForTask,
    startPreTaskOldVocabReview,
    openTaskSummaryModal,
    closeTaskSummaryModal,
    openTaskExamReadyModal,
    closeTaskExamReadyModal,
    onClickStartTaskExam,
    confirmStartTaskExam,
    resetActiveTaskStudy,
    updateTaskStudyBar,
    canActivateTaskScope,
    onScopeChanged,
    onStudyAssessmentChanged,
    startPendingTask,
    exitTaskWorkspace,
    dismissTaskExitWarn,
    confirmTaskExamAbort,
    startTaskExamFromExitWarn,
    hasIncompleteActiveTask,
    speakWord,
    startTest1,
    pickT1Left,
    pickT1Right,
    proceedToTest2FromT1,
    answerTest2,
    nextTest2Question,
    selectT2WbSlot,
    clearT2WbSlot,
    pickT2WbOption,
    submitT2WbBoard,
    nextT2WbBoard,
    jumpToT2McqPreview,
    jumpToT2WbPreview,
    jumpToT2ParaPreview,
    retryTest2,
    startFinalTranslation,
    finishTaskExam,
    openAdminTestPreview,
    pickT2ParaLeft,
    pickT2ParaRight,
    onT2DragStart,
    onT2DragEnd,
    onT2DragOver,
    onT2DragLeave,
    onT2Drop,
    switchT3Tab,
    pickT3ReadingAns,
    submitTranslationForAi,
    promptGeminiApiKey,
    onUserEntered,
    onUserLogout,
    onCloudMerged,
    getActiveTask: () => activeTask,
    isTaskWorkspaceActive: () => Boolean(activeTask || isAnyTaskId(B()?.getCurrentScopeKey?.() || '')),
    isPreviewMode: () => isPreviewTestMode,
    getAllTasks: getTasksList,
    getAllCatalogTasks,
    getTasksByScope,
    getTaskById,
    switchStudentTaskTab,
    switchTeacherTaskTab,
    openRecognitionTaskPreview,
    triggerExternalAntiCheatLock,
    getExamState: () => ({
      active: Boolean(activeTask && activeStage >= 1 && !taskTestPassed && !isPreviewTestMode) || Boolean(window.RecognitionTestModule?.isActive?.()),
      label: activeTask?.label || 'Test Task',
      isPreview: isPreviewTestMode,
      isTeacher: Boolean(B()?.isTeacherUser?.() || B()?.getCurrentUser?.()?.role === 'teacher'),
    }),
    handleExternalTabIntrusion,
  };

  if (!window.__taskBeforeUnloadBound) {
    window.__taskBeforeUnloadBound = true;
    window.addEventListener('beforeunload', (e) => {
      if (!hasIncompleteActiveTask()) return;
      const msg = activeStage >= 1
        ? 'Bạn đang làm bài Test kết thúc Task! Nếu đóng hoặc tải lại tab lúc này, bài thi sẽ bị hủy và Task có thể bị khóa 30 phút.'
        : 'Bạn chưa làm bài Test kết thúc Task! Bắt buộc phải hoàn thành Test 1 + Test 2 + Test 3 trước khi rời đi.';
      e.preventDefault();
      e.returnValue = msg;
      return msg;
    });
  }

  // Run if app.js already restored auth session before tasks.js executed
  const existingUser = B()?.getCurrentUser?.();
  if (existingUser) {
    onUserEntered(existingUser);
  }
})();
