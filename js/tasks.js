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

  let teacherSelectedIds = new Set();
  let teacherFilterPendingOnly = false;
  let assignedUrlTaskIds = [];
  let pendingTaskId = null;

  let activeTask = null;
  let activeStage = 0; // 0: learn 50, 1: test1 matching, 2: test2 context, 3: final translation
  let learnIndex = 0;
  let viewedWordIds = new Set();

  let t1BoardIndex = 0;
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
  let t2ParaShuffledRight = [];
  let t2ParaSelectedLeft = null;
  let t2ParaSelectedRight = null;
  let t2DraggingRightId = null;
  let t2ParaMatchedIds = new Set();
  let t2ParaFailedIds = new Set();
  let t2ParaMistakes = 0;
  let t2ParaDone = false;
  let t2ContextQs = [];

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

  function getTasksList() {
    return (window.APP_TASKS_DATA && Array.isArray(window.APP_TASKS_DATA.tasks))
      ? window.APP_TASKS_DATA.tasks
      : [];
  }

  function normalizeTaskId(raw) {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return null;
    const m = s.match(/^task_?(\d{1,2})$/) || s.match(/^(\d{1,2})$/);
    if (!m) return null;
    const n = parseInt(m[1], 10);
    if (n < 1 || n > 30) return null;
    return `task_${String(n).padStart(2, '0')}`;
  }

  function getTaskById(tid) {
    const norm = normalizeTaskId(tid);
    return getTasksList().find((t) => t.id === norm) || null;
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

  function recordUrlTaskDeadlines(taskIds) {
    if (!Array.isArray(taskIds) || !taskIds.length) return;
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const rawDl = Number(sp.get('deadline') || sp.get('due') || 0);
      if (!Number.isFinite(rawDl) || rawDl <= 1e11) return;
      const issuedAt = Math.max(0, Number(sp.get('issued') || 0));
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

  function getTaskDeadlineInfo(taskId) {
    if (!taskId) return { hasDeadline: false, deadlineAt: 0, remainingMs: 0, expired: false, formattedAt: '' };
    const map = loadTaskDeadlines();
    let deadlineAt = Number(map?.[taskId]?.deadlineAt || 0);
    if (deadlineAt <= 0 && assignedUrlTaskIds.includes(taskId)) {
      try {
        const sp = new URLSearchParams(window.location.search || '');
        const rawDl = Number(sp.get('deadline') || sp.get('due') || 0);
        if (Number.isFinite(rawDl) && rawDl > 1e11) deadlineAt = rawDl;
      } catch (_) {}
    }
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

  function renderTeacherTasksGrid() {
    const tasks = getTasksList();
    const esc = B()?.escapeHtml || ((x) => String(x));
    const sentMap = loadTeacherSentTasks();
    const visibleTasks = teacherFilterPendingOnly
      ? tasks.filter((t) => !getTaskClassStatus(t.id).allDone)
      : tasks;

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

      return `
        <label class="teacher-task-item ${st.allDone ? 'is-all-done' : ''}" style="align-items:flex-start;">
          <input type="checkbox" style="margin-top:3px;" value="${esc(t.id)}" ${checked} onchange="TasksModule.toggleTeacherTask('${esc(t.id)}', this.checked)">
          <div style="min-width:0; flex:1;">
            <div class="teacher-task-title">${esc(t.label)}${badgeHtml}</div>
            <div class="teacher-task-sub">${esc(t.theme)} · 50 từ</div>
            ${subStatusHtml}
            <div style="margin-top:7px; display:flex; gap:6px; align-items:center; flex-wrap:wrap;" onclick="event.stopPropagation()">
              <span style="font-size:11.5px; color:var(--text-muted); font-weight:700;">Xem Test:</span>
              <button type="button" class="btn-subtle" style="padding:2px 7px; font-size:11px;" onclick="TasksModule.openAdminTestPreview(1, '${esc(t.id)}')">Test 1</button>
              <button type="button" class="btn-subtle" style="padding:2px 7px; font-size:11px;" onclick="TasksModule.openAdminTestPreview(2, '${esc(t.id)}')">Test 2</button>
              <button type="button" class="btn-subtle" style="padding:2px 7px; font-size:11px;" onclick="TasksModule.openAdminTestPreview(3, '${esc(t.id)}')">Test 3</button>
            </div>
          </div>
        </label>
      `;
    }).join('') || '<div style="grid-column:1/-1; text-align:center; padding:18px; color:var(--text-muted);">Cả lớp đã hoàn thành 100% tất cả Task!</div>';

    const gridEl = document.getElementById('teacher-dash-task-grid');
    if (gridEl) gridEl.innerHTML = html;
  }

  function toggleTeacherTask(tid, isChecked) {
    if (isChecked) teacherSelectedIds.add(tid);
    else teacherSelectedIds.delete(tid);
    updateTeacherLinkPreview();
  }

  function selectTeacherTaskRange(startNum, endNum) {
    for (let n = startNum; n <= endNum; n++) {
      const id = normalizeTaskId(n);
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

  function exportClassReportCsv() {
    const bridge = B();
    if (!bridge?.isTeacherUser?.()) return;
    const ranked = bridge.getClassRankedEntries?.('week') || [];
    const cache = bridge.getCloudClassCache?.() || {};
    const header = [
      'Hạng', 'Họ và tên', 'Hôm nay (phút)', 'Tuần này (phút)', 'Tháng này (phút)',
      'Chuỗi ngày', 'Từ đã thuộc', 'Số Task xong (/30)', 'Điểm Dịch AI TB', 'Chi tiết các Task đã xong'
    ];
    const rows = ranked.map((item) => {
      const uid = bridge.getScopedUid(item.id);
      const streak = bridge.computeConsecutiveStreakForUser?.(item.id) || 0;
      const tp = readStudentTaskMap(bridge, cache, bridge.TASK_PROGRESS_KEY_BASE, uid);
      const doneEntries = Object.entries(tp).filter(([, v]) => v?.status === 'completed');
      const avgAi = doneEntries.length
        ? (doneEntries.reduce((sum, [, v]) => sum + Number(v.translationScore || 0), 0) / doneEntries.length).toFixed(1)
        : '';
      const details = doneEntries
        .map(([tid, v]) => `T${Number(tid.replace(/\D/g, '')) || tid} (${Number(v.translationScore || 0).toFixed(1)})`)
        .join('; ');
      return [
        item.rank, item.name, item.todayMins, item.weekMins, item.monthMins,
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

  function renderTeacherDashboard() {
    const bridge = B();
    if (!bridge?.isTeacherUser?.()) return;
    const esc = bridge.escapeHtml || ((x) => String(x));
    const statusEl = document.getElementById('teacher-sync-status');
    const syncTime = bridge.getLastCloudSyncTime?.();
    if (statusEl) {
      statusEl.textContent = syncTime ? `Cập nhật lúc ${syncTime}` : 'Theo dõi giờ học & Task của cả lớp';
    }

    const tbody = document.getElementById('teacher-dashboard-tbody');
    if (tbody) {
      const ranked = bridge.getClassRankedEntries?.('week') || [];
      const cache = bridge.getCloudClassCache?.() || {};
      const now = Date.now();
      const q = (document.getElementById('teacher-student-search')?.value || '').trim().toLowerCase();
      const sortMode = document.getElementById('teacher-student-sort')?.value || 'rank';

      const allEnriched = ranked.map((item) => {
        const uid = bridge.getScopedUid(item.id);
        const streak = bridge.computeConsecutiveStreakForUser?.(item.id) || 0;
        const tp = readStudentTaskMap(bridge, cache, bridge.TASK_PROGRESS_KEY_BASE, uid);
        const tl = readStudentTaskMap(bridge, cache, bridge.TASK_LOCKS_KEY_BASE, uid);
        const doneEntries = Object.entries(tp).filter(([, v]) => v?.status === 'completed');
        return { item, streak, doneEntries, tl };
      });

      const kpiStrip = document.getElementById('teacher-kpi-strip');
      if (kpiStrip) {
        const totalStudents = allEnriched.length;
        const totalMastered = allEnriched.reduce((s, r) => s + Number(r.item.mastered || 0), 0);
        const totalDoneTasks = allEnriched.reduce((s, r) => s + r.doneEntries.length, 0);
        const topRow = allEnriched[0];
        const topLabel = topRow ? `${esc(topRow.item.name.split(' ').slice(-2).join(' '))} (${topRow.item.weekMins}p)` : 'Chưa có';
        kpiStrip.innerHTML = `
          <div class="teacher-kpi-card is-mint">
            <div class="teacher-kpi-label">Học viên</div>
            <div class="teacher-kpi-val">${totalStudents}</div>
          </div>
          <div class="teacher-kpi-card is-gold">
            <div class="teacher-kpi-label">Tổng từ đã thuộc</div>
            <div class="teacher-kpi-val">${totalMastered} từ</div>
          </div>
          <div class="teacher-kpi-card is-coral">
            <div class="teacher-kpi-label">Lượt Task hoàn thành</div>
            <div class="teacher-kpi-val">${totalDoneTasks}</div>
          </div>
          <div class="teacher-kpi-card is-teal">
            <div class="teacher-kpi-label">Dẫn đầu tuần</div>
            <div class="teacher-kpi-val" style="font-size:14.5px;">${topLabel}</div>
          </div>
        `;
      }

      const enriched = allEnriched.filter((row) => !q || String(row.item.name || '').toLowerCase().includes(q) || String(row.item.id || '').toLowerCase().includes(q));

      if (sortMode === 'mastered') {
        enriched.sort((a, b) => (b.item.mastered - a.item.mastered) || (a.item.rank - b.item.rank));
      } else if (sortMode === 'tasks') {
        enriched.sort((a, b) => (b.doneEntries.length - a.doneEntries.length) || (b.item.mastered - a.item.mastered));
      } else if (sortMode === 'today') {
        enriched.sort((a, b) => (b.item.todayMins - a.item.todayMins) || (a.item.rank - b.item.rank));
      }

      const getMonogram = (name) => {
        const pts = String(name || 'HV').trim().split(/\s+/).filter(Boolean);
        return (pts.length >= 2 ? (pts[pts.length - 2][0] + pts[pts.length - 1][0]) : (pts[0] || 'HV').slice(0, 2)).toUpperCase();
      };

      tbody.innerHTML = enriched.map(({ item, streak, doneEntries, tl }, idx) => {
        const tags = doneEntries.map(([tid, v]) => `T${Number(tid.replace(/\D/g, '')) || tid} (${Number(v.translationScore || 0).toFixed(1)})`).join(', ');
        const activeLocks = Object.entries(tl).filter(([, until]) => Number(until || 0) > now);
        const taskSummary = doneEntries.length > 0
          ? `<strong>${doneEntries.length}/30</strong> · ${esc(tags)}`
          : '<span style="color:var(--text-muted);">Chưa xong Task</span>';
        const statusCell = activeLocks.length > 0
          ? `<div class="teacher-status-cell is-locked">
              ${activeLocks.map(([tid, until]) => `<span class="teacher-lock-pill">Khóa T${Number(tid.replace(/\D/g, '')) || tid} (${formatMmSs(Number(until) - now)})</span>`).join('')}
              <button type="button" class="btn-teacher-unlock" onclick="TasksModule.unlockStudentTasks('${esc(item.id)}')" title="Mở khóa cho học viên">Mở khóa</button>
            </div>`
          : '<span class="teacher-status-ok">Bình thường</span>';

        return `
          <tr>
            <td>#${item.rank}</td>
            <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(getMonogram(item.name))}</span><strong>${esc(item.name)}</strong></div></td>
            <td>${item.todayMins}p</td>
            <td>${item.weekMins}p</td>
            <td>${item.monthMins}p</td>
            <td>${streak} ngày</td>
            <td><strong>${item.mastered} từ</strong></td>
            <td style="font-size:12.5px;">${taskSummary}</td>
            <td style="font-size:12.5px;">${statusCell}</td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="9" style="text-align:center;">Không tìm thấy học viên phù hợp.</td></tr>';
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
  function openStudentTasksModal() {
    const grid = document.getElementById('student-task-grid');
    if (!grid) return;
    const progress = loadTaskProgress();
    const esc = B()?.escapeHtml || ((x) => String(x));
    const listToShow = assignedUrlTaskIds.length > 0
      ? assignedUrlTaskIds.map(getTaskById).filter(Boolean)
      : getTasksList();

    grid.innerHTML = listToShow.map((t) => {
      const exp = getTaskExpiryState(t.id);
      const done = exp.completed;
      const lockRem = getTaskLockRemainingMs(t.id);
      let statusText = `${t.theme} · ~${t.estMinutes}p`;
      let clsState = '';
      let subCls = '';

      if (exp.expired && !done) {
        statusText = `⏰ Task đã kết thúc (Hết hạn lúc ${exp.formattedAt})`;
        clsState = 'is-locked';
        subCls = 'task-text-err';
      } else if (exp.expired && done) {
        statusText = `✓ Hoàn thành (${progress[t.id].translationScore ?? '--'}/10) · Hết hạn (Chỉ xem kết quả)`;
        clsState = 'is-done';
        subCls = 'task-text-ok';
      } else if (done) {
        statusText = `✓ Hoàn thành (${progress[t.id].translationScore ?? '--'}/10)` + (exp.hasDeadline ? ` · Còn ${formatDeadlineRemaining(exp.remainingMs)}` : '');
        clsState = 'is-done';
        subCls = 'task-text-ok';
      } else if (lockRem > 0) {
        statusText = `Khóa ${formatMmSs(lockRem)}`;
        clsState = 'is-locked';
        subCls = 'task-text-err';
      } else if (exp.hasDeadline) {
        statusText = `${t.theme} · Còn ${formatDeadlineRemaining(exp.remainingMs)}`;
      }
      return `
        <button type="button" class="teacher-task-item ${clsState}" style="text-align:left;" onclick="TasksModule.closeStudentTasksModal(); TasksModule.openTaskBriefModal('${esc(t.id)}')">
          <div>
            <div class="teacher-task-title">${esc(t.label)}</div>
            <div class="teacher-task-sub ${subCls}">${esc(statusText)}</div>
          </div>
        </button>
      `;
    }).join('');
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
    const doneNote = progress?.status === 'completed'
      ? `<div class="task-text-ok" style="margin-top:8px; font-weight:700;">✓ Bạn đã hoàn thành Task này (Test 3 dịch bài: ${progress.translationScore}/10).${exp.expired ? ' Đã hết thời hạn — chỉ có thể xem lại kết quả.' : ' Còn hạn: có thể làm lại để ôn tập.'}</div>`
      : '';
    const deadlineLine = exp.hasDeadline
      ? `<div id="brief-deadline-line" style="margin-top:6px; font-weight:700; color:${exp.expired ? '#dc2626' : 'var(--accent)'};">${exp.expired ? `⏰ Đã hết hạn lúc ${esc(exp.formattedAt)}` : `⏱ Thời hạn: còn ${esc(formatDeadlineRemaining(exp.remainingMs))} (đóng lúc ${esc(exp.formattedAt)})`}</div>`
      : '';

    if (info) {
      info.innerHTML = `
        <div><strong>Nội dung:</strong> Học 50 từ vựng gốc (kèm Word Family) ngay trên giao diện Flashcard chính.</div>
        <div style="margin-top:6px;"><strong>Quy trình &amp; Thời lượng (~${t.estMinutes} phút):</strong> Bấm <strong>Đã thuộc đủ 50/50 từ</strong> → Tự mở Cửa sổ Bài Test gồm <strong>Test 1 ghép từ → Test 2 kéo thả &amp; ngữ cảnh → Test 3 dịch bài</strong>.</div>
        <div style="margin-top:6px;"><strong>Yêu cầu kỷ luật:</strong> Tập trung hoàn thành bài; nếu ngưng thao tác quá <strong>10 phút</strong> (hoặc rời tab quá 2 lần khi đang làm Test), Task sẽ bị <strong>khóa 30 phút</strong> mới được làm lại.</div>
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

  function updateBriefLockUI() {
    if (!pendingTaskId) return;
    const lockEl = document.getElementById('brief-task-lock');
    const startBtn = document.getElementById('btn-start-task');
    const viewBtn = document.getElementById('btn-view-expired-result');
    const dlLine = document.getElementById('brief-deadline-line');
    const exp = getTaskExpiryState(pendingTaskId);

    if (dlLine && exp.hasDeadline) {
      dlLine.style.color = exp.expired ? '#dc2626' : 'var(--accent)';
      dlLine.textContent = exp.expired
        ? `⏰ Đã hết hạn lúc ${exp.formattedAt}`
        : `⏱ Thời hạn: còn ${formatDeadlineRemaining(exp.remainingMs)} (đóng lúc ${exp.formattedAt})`;
    }

    if (!isTeacherOrBypassed() && exp.expired) {
      if (lockEl) {
        lockEl.style.display = 'flex';
        lockEl.style.alignItems = 'center';
        lockEl.style.justifyContent = 'space-between';
        lockEl.style.gap = '10px';
        lockEl.style.flexWrap = 'wrap';
        if (exp.completed) {
          lockEl.classList.add('is-info-ended');
          lockEl.innerHTML = `<span>⏰ Task đã hết thời hạn làm bài (${exp.formattedAt}). Bạn đã hoàn thành — không thể làm lại nữa, chỉ có thể xem lại kết quả.</span>`;
        } else {
          lockEl.classList.remove('is-info-ended');
          lockEl.innerHTML = `<span>⏰ Task đã kết thúc! Đã hết thời hạn làm bài (${exp.formattedAt}) — bạn chưa hoàn thành nên không thể vào làm hay xem kết quả.</span>`;
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
    if (startBtn) {
      startBtn.style.display = 'inline-flex';
      startBtn.textContent = 'Bắt đầu làm Task';
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
    } else {
      if (lockEl) lockEl.style.display = 'none';
      if (startBtn) startBtn.disabled = false;
    }
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
    if (!bar) return;
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    if (!scopeKey.startsWith('task_')) {
      bar.style.display = 'none';
      return;
    }
    const task = getTaskById(scopeKey) || activeTask;
    if (!task) {
      bar.style.display = 'none';
      return;
    }
    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    const allReady = masteredCount >= total;
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
      testBtn.textContent = allReady ? 'Làm Test →' : `Mở Test (${masteredCount}/${total})`;
    }
    const dlBadge = document.getElementById('task-study-deadline-badge');
    if (dlBadge) {
      const dl = !isTeacherOrBypassed() ? getTaskDeadlineInfo(task.id) : { hasDeadline: false };
      if (dl.hasDeadline) {
        dlBadge.style.display = 'inline-block';
        dlBadge.classList.toggle('is-urgent', dl.remainingMs <= 5 * 60 * 1000);
        dlBadge.textContent = dl.expired ? 'Hết giờ' : `Còn ${formatDeadlineRemaining(dl.remainingMs)}`;
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
    if (pill) pill.textContent = task.label.toUpperCase();
    if (heading) heading.textContent = `Bạn đã học và bấm Đã thuộc đủ ${task.words.length}/${task.words.length} từ (${task.label})!`;
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
    return true;
  }

  function onScopeChanged(scopeKey) {
    if (scopeKey && scopeKey.startsWith('task_')) {
      const t = getTaskById(scopeKey);
      if (t) {
        if (!isTeacherOrBypassed() && (getTaskExpiryState(t.id).expired || getTaskLockRemainingMs(t.id) > 0)) {
          stopIdleMonitor();
          activeTask = null;
          activeStage = 0;
          if (B()?.getCurrentScopeKey?.() === t.id) {
            B()?.loadMainScope?.('paraphrase');
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
    if (!scopeKey || !scopeKey.startsWith('task_')) return;
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
          if (taskLeaveWarnings >= 2) {
            clearActiveExamSession();
            lockAndExitActiveTask('Thoát/tải lại trang lần 2 khi đang làm Test — Task bị khóa 30 phút!');
            return;
          }
          saveActiveExamSession({
            ...savedExam,
            leaveWarnings: taskLeaveWarnings,
            inExam: false,
            updatedAt: Date.now(),
          });
          reloadPenaltyNotice = `Phát hiện tải lại trang khi đang làm Test (${task.label}) — ghi nhận cảnh báo 1/2 (thêm 1 lần sẽ khóa Task 30 phút).`;
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

    // Load 50 words of this Task directly inside the unified main #screen-study UI!
    syncAssignedTaskScopes(task);
    B()?.activateTaskScope?.(task.id);

    startIdleMonitor();
    updateTaskStudyBar();

    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    if (reloadPenaltyNotice) {
      B()?.showToast?.(reloadPenaltyNotice);
    }
    if (masteredCount >= total) {
      examReadyPromptShownForTaskId = task.id;
      openTaskExamReadyModal(task);
    } else if (!reloadPenaltyNotice) {
      B()?.showToast?.(`Đã mở ${task.label} (${masteredCount}/${total} từ đã thuộc). Học xong 50 từ để làm Test kết thúc!`);
    }
  }

  function dismissTaskExitWarn() {
    document.getElementById('modal-task-exit-warn')?.classList.remove('open');
  }

  function confirmTaskExamAbort() {
    dismissTaskExitWarn();
    lockAndExitActiveTask('Tự ý thoát bài Test giữa chừng — Task bị khóa 30 phút!');
  }

  function exitTaskWorkspace(confirmExit = false) {
    const wasInExam = activeStage >= 1;
    if (wasInExam && !taskTestPassed && confirmExit && !isTeacherOrBypassed()) {
      const warnModal = document.getElementById('modal-task-exit-warn');
      if (warnModal) {
        warnModal.classList.add('open');
        setTimeout(() => document.getElementById('btn-task-exit-stay')?.focus(), 40);
        return;
      }
      lockAndExitActiveTask('Tự ý thoát bài Test giữa chừng — Task bị khóa 30 phút!');
      return;
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
    activeTask = null;
    activeStage = 0;
    taskTestPassed = false;
    B()?.loadMainScope?.('paraphrase');
    if (confirmExit) B()?.showToast('Đã quay lại màn hình học từ vựng chính.');
    updateTaskStudyBar();
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
    if (taskLeaveWarnings === 1) {
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
        banner.textContent = 'Cảnh báo (lần 1/2): Đã phát hiện rời màn hình khi đang làm Test! Còn 1 lần thử cuối — rời thêm lần nữa sẽ bị khóa Task 30 phút.';
      }
      B()?.openCheatWarningModal?.(
        customReason || 'Phát hiện bạn vừa chuyển tab hoặc rời khỏi cửa sổ khi đang làm Test Task! Bài thi đã tạm ẩn để chống gian lận.',
        () => {
          lastActivityAt = Date.now();
          if (container) container.style.removeProperty('visibility');
          if (activeStage === 1) renderTest1Stage();
        }
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
        const remText = exp.expired ? 'Hết giờ' : `Còn ${formatDeadlineRemaining(exp.remainingMs)}`;
        const urgent = exp.expired || exp.remainingMs <= 5 * 60 * 1000;
        ['task-study-deadline-badge', 'task-exam-deadline-badge'].forEach((id) => {
          const el = document.getElementById(id);
          if (el) {
            el.style.display = 'inline-block';
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
            : '⏰ Đã hết thời hạn — Task đã kết thúc!');
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
      setupT1Board();
    }
    renderTaskStage();
  }

  function speakWord(text, accent) {
    B()?.speakText?.(text, accent);
  }

  // =========================================================
  // STAGE 1: TEST 1 — 10 MINI MATCHING BOARDS x 5 PAIRS
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
    setupT1Board();
    renderTaskStage();
  }

  function setupT1Board() {
    const pairs = activeTask?.test1Boards?.[t1BoardIndex] || [];
    t1SelectedLeft = null;
    t1MatchedIds = new Set();
    t1ShuffledRight = pairs.slice().sort(() => Math.random() - 0.5);
  }

  function renderTest1Stage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const pairs = activeTask.test1Boards[t1BoardIndex] || [];

    const leftHtml = pairs.map((p) => {
      const matched = t1MatchedIds.has(p.id);
      const active = t1SelectedLeft === p.id;
      return `<button type="button" class="task-match-btn ${matched ? 'is-matched' : ''} ${active ? 'is-active' : ''}" ${matched ? 'disabled' : ''} onclick="TasksModule.pickT1Left('${esc(p.id)}')">${esc(p.word)}</button>`;
    }).join('');

    const rightHtml = t1ShuffledRight.map((p) => {
      const matched = t1MatchedIds.has(p.id);
      return `<button type="button" class="task-match-btn ${matched ? 'is-matched' : ''}" id="t1-right-${esc(p.id)}" ${matched ? 'disabled' : ''} onclick="TasksModule.pickT1Right('${esc(p.id)}')">${esc(p.meaning)}</button>`;
    }).join('');

    const t1Pct = Math.round(((t1BoardIndex + (t1MatchedIds.size / Math.max(1, pairs.length))) / 10) * 100);

    container.innerHTML = `
      <div class="task-card-panel">
        <div class="task-stage-progress" aria-hidden="true">
          <div class="task-stage-progress-fill" style="width:${t1Pct}%;"></div>
        </div>
        <div class="task-exam-header-row">
          <div class="task-exam-title-group">
            <h2 class="task-exam-title">Ghép từ · Bảng ${t1BoardIndex + 1} / 10</h2>
          </div>
          <div class="task-stat-pills">
            <span class="task-err-pill ${t1Mistakes > 0 ? 'has-err' : ''}">Lỗi: <strong id="t1-err-cnt">${t1Mistakes}</strong></span>
            <span class="recall-stage-pill">${t1MatchedIds.size} / ${pairs.length} cặp</span>
          </div>
        </div>
        <div class="task-match-head">
          <span>Từ vựng gốc (English)</span>
          <span>Nghĩa tiếng Việt</span>
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
    const pairs = t2ParaBoards[t2ParaBoardIndex] || [];
    t2ParaSelectedLeft = null;
    t2ParaSelectedRight = null;
    t2DraggingRightId = null;
    t2ParaMatchedIds = new Set();
    t2ParaShuffledRight = pairs.slice().sort(() => Math.random() - 0.5);
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

  function getTaskTest2Total(task, rec = null) {
    if (rec && Number(rec.test2Total) > 0) return Number(rec.test2Total);
    if (task) {
      const pairCount = Array.isArray(task.test2ParaphrasePairs) && task.test2ParaphrasePairs.length > 0
        ? task.test2ParaphrasePairs.length
        : (Array.isArray(task.words) ? Math.min(50, task.words.length) : 50);
      const qs = Array.isArray(task.test2Questions) ? task.test2Questions : [];
      const nonParaCount = qs.filter((q) => q.type !== 'paraphrase').length;
      const mcqCount = nonParaCount > 0 ? Math.min(6, nonParaCount) : Math.min(6, qs.length);
      return pairCount + mcqCount;
    }
    return 56;
  }

  function initTest2State(task) {
    const qs = Array.isArray(task?.test2Questions) ? task.test2Questions : [];
    const pairs = [];
    const usedL = new Set();
    const usedR = new Set();

    // 1. Primary (Interface Contract §1): consume curated task.test2ParaphrasePairs (50 pairs -> 10 boards x 5)
    if (Array.isArray(task?.test2ParaphrasePairs) && task.test2ParaphrasePairs.length > 0) {
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
    } else {
      // 2. Fallback: build 50 non-overlapping pairs covering all task.words (no 20-pair cap)
      const words = Array.isArray(task?.words) ? task.words : [];
      const allTaskLemmas = new Set(
        words.map((w) => String(w?.lemma || '').trim().toLowerCase()).filter(Boolean)
      );

      words.forEach((w) => {
        if (pairs.length >= 50) return;
        const left = String(w?.lemma || '').trim();
        const lKey = left.toLowerCase();
        if (!left || usedL.has(lKey)) return;
        const syns = Array.isArray(w?.synonyms) ? w.synonyms : [];
        let picked = '';

        // Tier 1: clean alphabetic IELTS synonym, no stem overlap, not colliding with another task lemma
        for (const rawSyn of syns) {
          const syn = String(rawSyn || '').trim();
          const rKey = syn.toLowerCase();
          if (
            syn &&
            !/[0-9=<>@#$%^&*_+]/u.test(syn) &&
            /[a-zA-Z]{2,}/.test(syn) &&
            rKey !== lKey &&
            !allTaskLemmas.has(rKey) &&
            !usedL.has(rKey) &&
            !usedR.has(rKey) &&
            !hasStemOverlap(left, syn)
          ) {
            picked = syn;
            break;
          }
        }

        // Tier 2: allow clean alphanumeric tokens (e.g., 18th/17th) except comma-split "000 ..."
        if (!picked) {
          for (const rawSyn of syns) {
            const syn = String(rawSyn || '').trim();
            const rKey = syn.toLowerCase();
            if (
              syn &&
              !/^000\b/i.test(syn) &&
              /[a-zA-Z]{2,}/.test(syn) &&
              rKey !== lKey &&
              !usedL.has(rKey) &&
              !usedR.has(rKey) &&
              !hasStemOverlap(left, syn)
            ) {
              picked = syn;
              break;
            }
          }
        }

        // Tier 3: clean Vietnamese meaning gloss fallback (e.g., chemistry, canadian)
        if (!picked && w?.meaning) {
          const gloss = String(w.meaning).split(';')[0].trim() || String(w.meaning).trim();
          const gKey = gloss.toLowerCase();
          if (gloss && gKey !== lKey && !usedL.has(gKey) && !usedR.has(gKey)) {
            picked = gloss;
          }
        }

        if (picked) {
          usedL.add(lKey);
          usedR.add(picked.toLowerCase());
          pairs.push({
            id: `p_${pairs.length}`,
            left,
            right: picked,
            explain: `${left} đồng nghĩa / paraphrase với ${picked}`,
          });
        }
      });
    }

    t2ParaPairs = pairs;
    t2ParaBoards = [];
    for (let i = 0; i < pairs.length; i += 5) {
      t2ParaBoards.push(pairs.slice(i, i + 5));
    }
    t2ParaBoardIndex = 0;
    t2ParaSelectedLeft = null;
    t2ParaMatchedIds = new Set();
    t2ParaFailedIds = new Set();
    t2ParaMistakes = 0;
    t2ParaDone = t2ParaBoards.length === 0;
    setupT2ParaBoard();
    t2ContextQs = qs.filter((q) => q.type !== 'paraphrase').slice(0, 6);
    if (t2ContextQs.length === 0 && pairs.length === 0) t2ContextQs = qs.slice();
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
      const curBoard = activeTask.test1Boards[t1BoardIndex] || [];
      if (t1MatchedIds.size >= curBoard.length) {
        if (t1BoardIndex < activeTask.test1Boards.length - 1) {
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
          B()?.showToast?.('Xong Nối từ tương đương! Tiếp tục phần Ngữ cảnh.');
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

  function renderTest2Stage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    cleanupT2FloatingDrag();
    const esc = B()?.escapeHtml || ((x) => String(x));
    if (t2ParaBoards.length === 0 && t2ContextQs.length === 0) {
      initTest2State(activeTask);
    }

    if (!t2ParaDone && t2ParaBoards.length > 0) {
      const curBoard = t2ParaBoards[t2ParaBoardIndex] || [];
      const leftHtml = curBoard.map((p) => {
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
      const teacherMcqBtn = isTeacherOrBypassed()
        ? `<button type="button" class="btn-subtle" id="btn-teacher-t2-mcq-preview" style="padding:5px 11px; font-size:12.5px;" onclick="TasksModule.jumpToT2McqPreview()">Xem 6 câu A/B/C/D →</button>`
        : '';

      container.innerHTML = `
        <div class="task-card-panel">
          <div class="task-stage-progress" aria-hidden="true">
            <div class="task-stage-progress-fill" style="width:${paraPct}%;"></div>
          </div>
          <div class="task-exam-header-row">
            <div class="task-exam-title-group">
              <h2 class="task-exam-title">Nối cụm từ tương đương · Bảng ${t2ParaBoardIndex + 1} / ${t2ParaBoards.length}</h2>
            </div>
            <div class="task-stat-pills">
              <span class="task-err-pill ${t2ParaMistakes > 0 ? 'has-err' : ''}">Lỗi: <strong id="t2-err-cnt">${t2ParaMistakes}</strong></span>
              <span class="recall-stage-pill">${t2ParaMatchedIds.size} / ${curBoard.length} cặp</span>
              ${teacherMcqBtn}
            </div>
          </div>
          <div class="task-match-head">
            <span>Từ vựng trong Task (Hộp chứa)</span>
            <span>Paraphrase thường gặp (Kéo sang trái)</span>
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

    const qs = t2ContextQs;
    const totalT2 = t2ParaPairs.length + qs.length;

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
    t2Index = 0;
    t2Answered = false;
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

  function startFinalTranslation() {
    if (!activeTask) return;
    activeStage = 3;
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
  // STAGE 3: FINAL 2-COLUMN TRANSLATION + DEDICATED AI GRADING TAB
  // =========================================================
  function renderFinalTranslationStage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const p = activeTask.passage;

    const draftKey = `ielts_task_draft_${getScopedStorageUid()}_${activeTask.id}`;
    let savedDraft = { trans: '', summary: '' };
    try {
      savedDraft = JSON.parse(localStorage.getItem(draftKey) || '{}') || savedDraft;
    } catch (_) {}

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
            <div class="t3-trans-field">
              <label class="writing-label" for="task-trans-input">
                <span>01. Dịch toàn đoạn</span>
                <span id="task-trans-wc" style="color:var(--text-muted); font-size:14.5px;">0 từ</span>
              </label>
              <textarea id="task-trans-input" class="translation-input" lang="vi" placeholder="Nhập bản dịch tiếng Việt...">${esc(savedDraft.trans || '')}</textarea>
            </div>

            <div class="t3-sum-field">
              <label class="writing-label" for="task-summary-input">
                <span>02. Tóm tắt ý chính (1–3 câu)</span>
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
                <div style="font-size:15.5px; margin-bottom:18px;">Hoàn thành bản dịch và tóm tắt ở tab Bài làm rồi nhấn Nộp &amp; AI chấm.</div>
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

    if (transWords === 0 && sumWords === 0) {
      B()?.showToast('Vui lòng nhập nội dung bản dịch hoặc tóm tắt ý chính để AI chấm!');
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
      highlightPassageAfterGrading();
      const esc = B()?.escapeHtml || ((x) => String(x));
      const c = g.criteria || {};
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
        const totalT2 = (t2ParaPairs.length + t2ContextQs.length) || getTaskTest2Total(activeTask);
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
      sTasksBtn.style.display = assignedUrlTaskIds.length > 0 ? 'inline-flex' : 'none';
    }
    // Chống F5 / tải lại trang để reset giờ & xóa lỗi khi đang thi dở Test Task
    if (!isTeacherOrBypassed()) {
      const interruptedExam = loadActiveExamSession();
      if (interruptedExam && interruptedExam.taskId && interruptedExam.inExam && (Date.now() - Number(interruptedExam.updatedAt || 0)) < LOCK_PENALTY_MS) {
        const nextWarn = Number(interruptedExam.leaveWarnings || 0) + 1;
        if (nextWarn >= 2) {
          clearActiveExamSession();
          const locks = loadTaskLocks();
          locks[interruptedExam.taskId] = Date.now() + LOCK_PENALTY_MS;
          saveTaskLocks(locks);
          B()?.saveAndSync?.();
          setTimeout(() => B()?.showToast?.('Phát hiện tải lại trang lần 2 khi đang làm Test — Task đã bị khóa 30 phút!'), 250);
        } else {
          saveActiveExamSession({
            ...interruptedExam,
            leaveWarnings: nextWarn,
            inExam: false,
            updatedAt: Date.now(),
          });
          setTimeout(() => B()?.showToast?.('Phát hiện tải lại trang khi đang làm Test — ghi nhận cảnh báo 1/2 (thêm 1 lần sẽ khóa Task 30 phút)!'), 250);
        }
      }
    }
    const curScope = B()?.getCurrentScopeKey?.() || '';
    const curTask = curScope.startsWith('task_') ? getTaskById(curScope) : null;
    if (curTask && !isTeacherOrBypassed() && getTaskExpiryState(curTask.id).expired) {
      syncAssignedTaskScopes();
      B()?.loadMainScope?.('paraphrase');
      openTaskBriefModal(curTask.id);
      return;
    }
    if (curTask && !isTeacherOrBypassed() && getTaskLockRemainingMs(curTask.id) > 0) {
      syncAssignedTaskScopes();
      B()?.loadMainScope?.('paraphrase');
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
      const rowsHtml = students.map((st) => {
        const uid = bridge.getScopedUid(st.id);
        let tp = cache[uid]?.syncData?.taskProgress || null;
        if (!tp) {
          try {
            tp = JSON.parse(localStorage.getItem(`${bridge.TASK_PROGRESS_KEY_BASE}${uid}`) || '{}') || {};
          } catch (_) { tp = {}; }
        }
        const doneEntries = Object.entries(tp).filter(([, v]) => v?.status === 'completed');
        const avgAi = doneEntries.length
          ? (doneEntries.reduce((sum, [, v]) => sum + Number(v.translationScore || 0), 0) / doneEntries.length).toFixed(1)
          : '--';
        const tags = doneEntries.length
          ? doneEntries.map(([tid, v]) => `T${Number(tid.replace(/\D/g, '')) || tid} (${Number(v.translationScore || 0).toFixed(1)})`).join(', ')
          : 'Chưa hoàn thành Task nào';
        return `
          <tr>
            <td><strong>${esc(st.name)}</strong></td>
            <td><strong>${doneEntries.length} / 30</strong></td>
            <td>${avgAi}</td>
            <td style="font-size:12.5px;">${esc(tags)}</td>
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
    const allTasks = getTasksList();
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
            <img src="assets/images/panda_leaderboard.jpg" alt="" class="task-summary-panda">
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
          <div class="task-sum-stat-label">Test 2 · Paraphrase</div>
          <div class="task-sum-stat-val">${focusRec.test2Score ?? 0} / ${t2Total}</div>
          <div class="task-sum-stat-sub">50 kéo thả + 6 trắc nghiệm</div>
        </div>
        <div class="task-sum-stat is-gold">
          <div class="task-sum-stat-label">Test 3 · Dịch bài</div>
          <div class="task-sum-stat-val">${Number(focusRec.translationScore || 0).toFixed(1)} / 10</div>
          <div class="task-sum-stat-sub">Dịch đoạn &amp; tóm tắt ý chính</div>
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
      const totalT2 = (t2ParaPairs.length + t2ContextQs.length) || getTaskTest2Total(activeTask);
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
    const totalT2 = (t2ParaPairs.length + t2ContextQs.length) || getTaskTest2Total(activeTask);
    const newlyMarked = B()?.markMasteredBatch?.(activeTask.linkedIds) || 0;
    const prog = loadTaskProgress();
    prog[activeTask.id] = {
      status: 'completed',
      test1Mistakes: t1Mistakes,
      test1AccuracyPct: t1AccuracyPct,
      test2Score: t2Correct,
      test2Total: totalT2,
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
    saveLocalGeminiKey,
    openStudentTasksModal,
    closeStudentTasksModal,
    openTaskBriefModal,
    closeTaskBriefModal,
    checkTaskUnlockNow,
    viewExpiredTaskResult,
    getTaskDeadlineInfo,
    getTaskExpiryState,
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
    speakWord,
    startTest1,
    pickT1Left,
    pickT1Right,
    proceedToTest2FromT1,
    answerTest2,
    nextTest2Question,
    jumpToT2McqPreview,
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
    submitTranslationForAi,
    promptGeminiApiKey,
    onUserEntered,
    onUserLogout,
    onCloudMerged,
    getActiveTask: () => activeTask,
    isPreviewMode: () => isPreviewTestMode,
    getAllTasks: getTasksList,
    getTaskById,
    getExamState: () => ({
      active: Boolean(activeTask && activeStage >= 1 && !taskTestPassed && !isPreviewTestMode),
      label: activeTask?.label || 'Test Task',
      isPreview: isPreviewTestMode,
      isTeacher: Boolean(B()?.isTeacherUser?.() || B()?.getCurrentUser?.()?.role === 'teacher'),
    }),
    handleExternalTabIntrusion,
  };

  // Run if app.js already restored auth session before tasks.js executed
  const existingUser = B()?.getCurrentUser?.();
  if (existingUser) {
    onUserEntered(existingUser);
  }
})();
