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

  let idleTimer = null;
  let lastActivityAt = 0;
  let taskStartedAt = 0;
  let taskLeaveWarnings = 0;
  let lastTaskLeaveAt = 0;
  let taskTestPassed = false;
  let isPreviewTestMode = false;
  let lockCountdownTimer = null;
  let examReadyPromptShownForTaskId = null;

  const B = () => window.__VOCAB_BRIDGE__;

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

  function getTaskLockRemainingMs(taskId) {
    const locks = loadTaskLocks();
    const until = Number(locks[taskId] || 0);
    return Math.max(0, until - Date.now());
  }

  function formatMmSs(ms) {
    const totalSec = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
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
      let tp = cache[uid]?.syncData?.taskProgress || null;
      if (!tp) {
        try {
          tp = JSON.parse(localStorage.getItem(`${bridge.TASK_PROGRESS_KEY_BASE}${uid}`) || '{}') || {};
        } catch (_) { tp = {}; }
      }
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

  function updateTeacherLinkPreview() {
    const ids = [...teacherSelectedIds].sort();
    const cntEl = document.getElementById('teacher-dash-sel-count');
    if (cntEl) cntEl.textContent = `Đã chọn: ${ids.length} Task`;
    const base = window.location.href.split('?')[0].split('#')[0];
    const url = ids.length === 0
      ? ''
      : (ids.length === 1
        ? `${base}?task=${encodeURIComponent(ids[0])}`
        : `${base}?tasks=${ids.map(encodeURIComponent).join(',')}`);
    const inp = document.getElementById('teacher-dash-link-preview');
    if (inp) inp.value = url;
  }

  function copyTeacherTaskLink() {
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

  function readStudentTaskMap(bridge, cache, keyBase, uid) {
    const cacheKey = (keyBase === bridge.TASK_LOCKS_KEY_BASE) ? 'taskLocks' : 'taskProgress';
    const remote = cache?.[uid]?.syncData?.[cacheKey];
    if (remote && typeof remote === 'object') return remote;
    try {
      return JSON.parse(localStorage.getItem(`${keyBase}${uid}`) || '{}') || {};
    } catch (_) {
      return {};
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
      statusEl.textContent = syncTime
        ? `Cập nhật lúc ${syncTime} · Theo dõi tự động giờ học, từ đã thuộc & Task`
        : 'Theo dõi giờ học, chuỗi ngày, từ đã thuộc & kết quả Task của cả lớp';
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
        const lockPills = Object.entries(tl)
          .filter(([, until]) => Number(until || 0) > now)
          .map(([tid, until]) => `<span class="teacher-lock-pill">Khóa T${Number(tid.replace(/\D/g, '')) || tid} (${formatMmSs(Number(until) - now)})</span>`)
          .join('');
        const taskSummary = doneEntries.length > 0
          ? `<strong>${doneEntries.length}/30</strong> · ${esc(tags)}`
          : '<span style="color:var(--text-muted);">Chưa xong Task</span>';

        return `
          <tr>
            <td>#${item.rank}</td>
            <td><div class="teacher-student-cell"><span class="board-avatar tone-${idx % 4}" aria-hidden="true">${esc(getMonogram(item.name))}</span><strong>${esc(item.name)}</strong></div></td>
            <td>${item.todayMins}p</td>
            <td>${item.weekMins}p</td>
            <td>${item.monthMins}p</td>
            <td>${streak} ngày</td>
            <td><strong>${item.mastered} từ</strong></td>
            <td style="font-size:12.5px;">${taskSummary}${lockPills}</td>
          </tr>
        `;
      }).join('') || '<tr><td colspan="8" style="text-align:center;">Không tìm thấy học viên phù hợp.</td></tr>';
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
      const done = progress[t.id]?.status === 'completed';
      const lockRem = getTaskLockRemainingMs(t.id);
      const statusText = done
        ? `✓ Hoàn thành (${progress[t.id].translationScore ?? '--'}/10)`
        : (lockRem > 0 ? `Khóa ${formatMmSs(lockRem)}` : `${t.theme} · ~${t.estMinutes}p`);
      const clsState = done ? 'is-done' : (lockRem > 0 ? 'is-locked' : '');
      return `
        <button type="button" class="teacher-task-item ${clsState}" style="text-align:left;" onclick="TasksModule.closeStudentTasksModal(); TasksModule.openTaskBriefModal('${esc(t.id)}')">
          <div>
            <div class="teacher-task-title">${esc(t.label)}</div>
            <div class="teacher-task-sub ${done ? 'task-text-ok' : (lockRem > 0 ? 'task-text-err' : '')}">${esc(statusText)}</div>
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
    const doneNote = progress?.status === 'completed'
      ? `<div class="task-text-ok" style="margin-top:8px; font-weight:700;">✓ Bạn đã hoàn thành Task này (Điểm dịch AI: ${progress.translationScore}/10). Có thể làm lại để ôn tập.</div>`
      : '';

    if (info) {
      info.innerHTML = `
        <div><strong>Nội dung:</strong> Học 50 từ vựng gốc (kèm Word Family) ngay trên giao diện Flashcard chính.</div>
        <div style="margin-top:6px;"><strong>Quy trình &amp; Thời lượng (~${t.estMinutes} phút):</strong> Bấm <strong>Đã thuộc đủ 50/50 từ</strong> → Tự mở Cửa sổ Bài Test gồm <strong>Test 1 ghép từ → Test 2 ngữ cảnh → Test cuối dịch bài AI</strong>.</div>
        <div style="margin-top:6px;"><strong>Yêu cầu kỷ luật:</strong> Tập trung hoàn thành bài; nếu ngưng thao tác quá <strong>10 phút</strong> (hoặc rời tab quá 2 lần khi đang làm Test), Task sẽ bị <strong>khóa 30 phút</strong> mới được làm lại.</div>
        ${doneNote}
      `;
    }
    updateBriefLockUI();
    clearInterval(lockCountdownTimer);
    lockCountdownTimer = setInterval(updateBriefLockUI, 1000);
    document.getElementById('modal-task-brief')?.classList.add('open');
  }

  function updateBriefLockUI() {
    if (!pendingTaskId) return;
    const lockEl = document.getElementById('brief-task-lock');
    const startBtn = document.getElementById('btn-start-task');
    const remMs = getTaskLockRemainingMs(pendingTaskId);
    if (remMs > 0) {
      if (lockEl) {
        lockEl.style.display = 'block';
        lockEl.textContent = `Task đang tạm khóa do ngưng thao tác quá 10 phút. Vui lòng quay lại sau ${formatMmSs(remMs)}.`;
      }
      if (startBtn) startBtn.disabled = true;
    } else {
      if (lockEl) lockEl.style.display = 'none';
      if (startBtn) startBtn.disabled = false;
    }
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
    if (getTaskLockRemainingMs(pendingTaskId) > 0) {
      updateBriefLockUI();
      return;
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
    if (getTaskLockRemainingMs(task.id) > 0) {
      openTaskBriefModal(task.id);
      return;
    }
    const total = task.words.length || 50;
    const masteredCount = getTaskMasteredCount(task);
    if (masteredCount < total) {
      B()?.showToast?.(`Hãy học và bấm '3 - Đã thuộc' cho đủ ${total}/${total} từ của ${task.label} trước khi làm Test (hiện ${masteredCount}/${total}).`);
      return;
    }
    activeTask = task;
    confirmStartTaskExam();
  }

  function confirmStartTaskExam() {
    const scopeKey = B()?.getCurrentScopeKey?.() || '';
    const task = activeTask || getTaskById(scopeKey);
    if (!task) return;
    if (getTaskLockRemainingMs(task.id) > 0) {
      closeTaskExamReadyModal();
      openTaskBriefModal(task.id);
      return;
    }
    activeTask = task;
    closeTaskExamReadyModal();
    startTest1();
  }

  function onScopeChanged(scopeKey) {
    if (scopeKey && scopeKey.startsWith('task_')) {
      const t = getTaskById(scopeKey);
      if (t) {
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
    taskTestPassed = false;
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
    if (masteredCount >= total) {
      examReadyPromptShownForTaskId = task.id;
      openTaskExamReadyModal(task);
    } else {
      B()?.showToast?.(`Đã mở ${task.label} (${masteredCount}/${total} từ đã thuộc). Học xong 50 từ để làm Test kết thúc!`);
    }
  }

  function exitTaskWorkspace(confirmExit = false) {
    const wasInExam = activeStage >= 1;
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
      // Returned from Exam modal back onto Task study deck
      activeStage = 0;
      updateTaskStudyBar();
      B()?.showToast('Đã tạm thoát bài Test, quay lại ôn thẻ Task.');
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

  function bumpIdleActivity() {
    lastActivityAt = Date.now();
  }

  function lockAndExitActiveTask(toastMsg) {
    if (!activeTask) return;
    const failedTaskId = activeTask.id;
    const locks = loadTaskLocks();
    locks[failedTaskId] = Date.now() + LOCK_PENALTY_MS;
    saveTaskLocks(locks);
    B()?.saveAndSync?.();
    exitTaskWorkspace(false);
    B()?.showToast(toastMsg);
    openTaskBriefModal(failedTaskId);
  }

  function handleTaskTabLeave(customReason) {
    if (!activeTask || activeStage < 1 || taskTestPassed || isPreviewTestMode) return;
    if (document.getElementById('modal-cheat-warn')?.classList.contains('open')) return;
    const now = Date.now();
    if (now - lastTaskLeaveAt < 800) return;
    lastTaskLeaveAt = now;
    taskLeaveWarnings += 1;
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
        if (!activeTask || activeStage < 1 || taskTestPassed) return;
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
    if (document.hidden) handleTaskTabLeave();
  }

  function onTaskWindowBlur() {
    handleTaskTabLeave();
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
    lastActivityAt = Date.now();
    ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'input'].forEach((evt) => {
      window.addEventListener(evt, bumpIdleActivity, { passive: true });
    });
    document.addEventListener('visibilitychange', onTaskVisibilityChange);
    window.addEventListener('blur', onTaskWindowBlur);
    document.addEventListener('keydown', onTaskLearnKeydown);
    idleTimer = setInterval(() => {
      if (!activeTask) {
        stopIdleMonitor();
        return;
      }
      const idleMs = Date.now() - lastActivityAt;
      const badge = document.getElementById('task-idle-badge');
      if (badge) {
        badge.textContent = `Tập trung · ${formatMmSs(idleMs)} / 10:00`;
      }
      const studyIdle = document.getElementById('task-study-idle-badge');
      if (studyIdle) {
        studyIdle.textContent = `${formatMmSs(idleMs)} / 10:00`;
      }
      if (idleMs >= IDLE_LIMIT_MS) {
        lockAndExitActiveTask('Ngưng thao tác quá 10 phút — Task bị khóa 30 phút!');
      }
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
    document.removeEventListener('keydown', onTaskLearnKeydown);
  }

  function updateStepPills() {
    for (let i = 1; i <= 3; i++) {
      const el = document.getElementById(`task-pill-${i}`);
      if (!el) continue;
      el.classList.toggle('active', activeStage === i);
      el.classList.toggle('done', !isPreviewTestMode && activeStage > i);
      el.style.cursor = isPreviewTestMode ? 'pointer' : '';
      el.title = isPreviewTestMode ? `Bấm để nhảy nhanh sang Test ${i}` : '';
    }
  }

  function renderTaskStage() {
    if (!activeTask) return;
    bindTaskNoCopyOnce();
    const isTestNow = activeStage >= 1 && !taskTestPassed && !isPreviewTestMode;
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
        if (badge) badge.textContent = activeTask.label.toUpperCase();
        if (theme) {
          theme.textContent = isPreviewTestMode
            ? `${activeTask.theme} · CHẾ ĐỘ TEST THỬ (Không lưu/khóa điểm)`
            : `${activeTask.theme} · Bài Test kết thúc`;
        }
      } else {
        examModal.classList.remove('open', 'active');
      }
      examModal.classList.toggle('exam-no-copy', isTestNow);
    }
    updateStepPills();
    if (activeStage === 1) renderTest1Stage();
    else if (activeStage === 2) renderTest2Stage();
    else if (activeStage === 3) renderFinalTranslationStage();
  }

  function parseUrlPreviewStage(account) {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const adminStage = parseInt(sp.get('adminTest') || '0', 10);
      if (adminStage >= 1 && adminStage <= 3) return adminStage;
      if (account?.role === 'teacher') {
        const tStage = parseInt(sp.get('test') || '0', 10);
        if (tStage >= 1 && tStage <= 3) return tStage;
      }
      return 0;
    } catch (_) {
      return 0;
    }
  }

  function openAdminTestPreview(stage = 1, taskId = null) {
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
    taskTestPassed = false;
    taskLeaveWarnings = 0;
    lastTaskLeaveAt = 0;
    t1BoardIndex = 0;
    t1Mistakes = 0;
    t1WrongWordIds = new Set();
    t2Index = 0;
    t2Correct = 0;
    t2Answered = false;
    t2WrongRecords = [];
    document.getElementById('task-leave-warn-banner')?.remove();
    const s = Math.min(3, Math.max(1, Number(stage) || 1));
    activeStage = s;
    if (s === 1) setupT1Board();
    renderTaskStage();
  }

  function jumpPreviewStage(stage) {
    if (!isPreviewTestMode || !activeTask) return;
    openAdminTestPreview(stage, activeTask.id);
  }

  function speakWord(text, accent) {
    B()?.speakText?.(text, accent);
  }

  // =========================================================
  // STAGE 1: TEST 1 — 10 MINI MATCHING BOARDS x 5 PAIRS
  // =========================================================
  function startTest1() {
    if (!activeTask) return;
    const total = activeTask.words.length || 50;
    if (getTaskMasteredCount(activeTask) < total) return;
    activeStage = 1;
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

    container.innerHTML = `
      <div class="task-card-panel">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
          <div>
            <h2 style="margin:0; font-size:20px; font-weight:800;">Test 1 · Ghép cặp nhanh (Bảng ${t1BoardIndex + 1} / 10)</h2>
            <div style="font-size:13.5px; color:var(--text-muted); margin-top:3px;">Chọn 1 từ tiếng Anh bên trái rồi ghép với nghĩa tiếng Việt bên phải · Số lỗi nhầm: <strong id="t1-err-cnt">${t1Mistakes}</strong></div>
          </div>
          <span class="recall-stage-pill">${t1MatchedIds.size} / ${pairs.length} cặp</span>
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

  function proceedToTest2FromT1() {
    if (!activeTask) return;
    activeStage = 2;
    t2Index = 0;
    t2Correct = 0;
    t2Answered = false;
    t2WrongRecords = [];
    B()?.showToast(`Hoàn thành Test 1 (10/10 bảng, ${t1Mistakes} lỗi)! Chuyển sang Test 2.`);
    renderTaskStage();
  }

  function renderTest1MistakeReviewStage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
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
  // STAGE 2: TEST 2 — 12 CONTEXT QUESTIONS (WORD FAMILY & PARAPHRASE)
  // =========================================================
  function renderTest2Stage() {
    const container = document.getElementById('task-stage-container');
    if (!container || !activeTask) return;
    const esc = B()?.escapeHtml || ((x) => String(x));
    const qs = activeTask.test2Questions || [];

    if (t2Index >= qs.length) {
      const passed = t2Correct >= 8;
      const mistakesHtml = t2WrongRecords.length > 0
        ? `<div id="task-t2-review-list" class="task-mistake-review-grid">
            ${t2WrongRecords.map((m, idx) => `
              <div class="task-mistake-card">
                <div class="task-text-err" style="font-size:12px; font-weight:800;">Câu sai #${idx + 1}</div>
                <div style="font-size:13.5px; font-weight:750; color:var(--text-bright); margin-top:4px;">${esc(m.prompt)}</div>
                <div class="task-text-err" style="font-size:12.5px; margin-top:5px;">Bạn chọn: <strong>${esc(m.chosen)}</strong></div>
                <div class="task-text-ok" style="font-size:12.5px; margin-top:2px;">Đáp án đúng: <strong>${esc(m.answer)}</strong></div>
                ${m.explain ? `<div style="font-size:12px; color:var(--text-muted); margin-top:4px;">${esc(m.explain)}</div>` : ''}
              </div>
            `).join('')}
          </div>`
        : `<div id="task-t2-review-list" class="task-notice-box" style="max-width:460px; margin:0 auto 18px;">✓ Xuất sắc! Không sai câu nào ở Test 2.</div>`;

      container.innerHTML = `
        <div class="task-card-panel" style="text-align:center; padding:32px 24px;">
          <h2 style="margin:0 0 8px;">Kết quả Test 2: ${t2Correct} / ${qs.length} câu đúng</h2>
          <p style="color:var(--text-muted); margin:0 0 14px;">
            ${passed ? 'Đạt chuẩn! Xem nhanh các câu từng chọn nhầm (nếu có) rồi sang Test cuối dịch bài 2 cột.' : 'Cần đạt tối thiểu 8/12 câu để qua Test 2. Hãy ôn lại lỗi sai bên dưới và thử lại nhé!'}
          </p>
          ${mistakesHtml}
          ${passed
            ? `<button type="button" class="btn btn-primary" onclick="TasksModule.startFinalTranslation()">Vào Test cuối (Dịch bài 2 cột) →</button>`
            : `<button type="button" class="btn btn-primary" onclick="TasksModule.retryTest2()">Làm lại Test 2</button>`}
        </div>
      `;
      return;
    }

    const q = qs[t2Index];
    const typeLabel = q.type === 'paraphrase'
      ? 'PARAPHRASE TRONG ĐỀ'
      : (q.type === 'word_family' ? 'WORD FAMILY TRONG NGỮ CẢNH' : 'ĐỒNG NGHĨA HỌC THUẬT');

    container.innerHTML = `
      <div class="task-card-panel">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:10px;">
          <span class="tip-pill" style="margin:0;">${typeLabel}</span>
          <span style="font-size:13.5px; font-weight:700; color:var(--text-muted);">Câu ${t2Index + 1} / ${qs.length} · Đúng: ${t2Correct}</span>
        </div>
        <div style="font-size:16px; font-weight:700; color:var(--text-bright); margin-bottom:10px;">${esc(q.prompt)}</div>
        ${q.qText ? `<div style="padding:11px 14px; border-radius:10px; background:var(--bg-soft); border:1px solid var(--card-border); margin-bottom:8px; font-size:15px;">${esc(q.qText)}</div>` : ''}
        ${q.pText ? `<div class="fc-sentence-box" style="margin-bottom:10px;">${esc(q.pText)}</div>` : ''}
        <div class="task-q-opts" id="task-t2-opts">
          ${q.options.map((opt, idx) => `<button type="button" class="task-q-opt" data-opt-idx="${idx}" onclick="TasksModule.answerTest2(${idx})">${esc(opt)}</button>`).join('')}
        </div>
        <div id="task-t2-explain" style="display:none; margin-top:12px;" class="task-notice-box"></div>
        <div style="display:flex; justify-content:flex-end; margin-top:14px;">
          <button type="button" class="btn btn-primary" id="btn-t2-next" style="display:none;" onclick="TasksModule.nextTest2Question()">
            ${t2Index < qs.length - 1 ? 'Câu tiếp →' : 'Xem kết quả Test 2'}
          </button>
        </div>
      </div>
    `;
  }

  function answerTest2(optIdx) {
    if (t2Answered || !activeTask) return;
    t2Answered = true;
    const q = activeTask.test2Questions[t2Index];
    const chosen = q.options[optIdx];
    const isRight = chosen.trim().toLowerCase() === q.answer.trim().toLowerCase();
    if (isRight) {
      t2Correct++;
    } else {
      t2WrongRecords.push({
        prompt: q.prompt,
        chosen,
        answer: q.answer,
        explain: q.explain || '',
      });
    }

    document.querySelectorAll('#task-t2-opts .task-q-opt').forEach((btn, i) => {
      btn.disabled = true;
      const val = q.options[i];
      if (val.trim().toLowerCase() === q.answer.trim().toLowerCase()) btn.classList.add('is-right');
      else if (i === optIdx && !isRight) btn.classList.add('is-wrong');
    });

    const exp = document.getElementById('task-t2-explain');
    if (exp) {
      exp.style.display = 'block';
      exp.innerHTML = `<strong>${isRight ? 'Chính xác!' : `Chưa đúng (Đáp án: ${B()?.escapeHtml(q.answer)}).`}</strong> ${B()?.escapeHtml(q.explain || '')}`;
    }
    const nextBtn = document.getElementById('btn-t2-next');
    if (nextBtn) nextBtn.style.display = 'inline-flex';
  }

  function nextTest2Question() {
    t2Index++;
    t2Answered = false;
    renderTest2Stage();
  }

  function retryTest2() {
    t2Index = 0;
    t2Correct = 0;
    t2Answered = false;
    t2WrongRecords = [];
    taskStartedAt = Date.now();
    taskLeaveWarnings = 0;
    lastTaskLeaveAt = 0;
    taskTestPassed = false;
    document.getElementById('task-leave-warn-banner')?.remove();
    renderTest2Stage();
  }

  function startFinalTranslation() {
    activeStage = 3;
    renderTaskStage();
  }

  // =========================================================
  // STAGE 3: FINAL 2-COLUMN TRANSLATION + GEMINI AI GRADING
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
            <span>${esc(p.topic || activeTask.theme)}</span>
            <span>${p.wordCount} từ</span>
          </div>
          <div class="task-notice-box" style="font-size:13px; margin-bottom:12px;">
            <strong>Mẹo đọc hiểu:</strong> Vận dụng các từ nối định hướng (${esc((p.signalClues || []).join(', '))}) và từ khóa đã học trong gói để suy đoán nghĩa của các từ mới ngoài bài khi dịch.
          </div>
          <div id="task-passage-hl-legend" class="passage-hl-legend" style="display:none;"></div>
          <div class="english-passage" id="task-english-passage">${esc(p.text)}</div>
        </article>

        <section class="practice-paper writing-paper" aria-label="Bài làm dịch của bạn">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <h2 style="margin:0; font-size:20px; font-weight:800;">Bài làm của bạn</h2>
            <span style="font-size:12px; color:var(--text-muted);" id="task-draft-status">Tự lưu nháp</span>
          </div>
          <label class="writing-label" for="task-trans-input">
            <span><b>01</b> Dịch toàn bộ đoạn văn sang tiếng Việt</span>
            <span id="task-trans-wc" style="color:var(--text-muted);">0 từ</span>
          </label>
          <textarea id="task-trans-input" class="translation-input" lang="vi" placeholder="Viết bản dịch tiếng Việt mượt mà, sát nghĩa và giữ đúng quan hệ logic giữa các vế câu...">${esc(savedDraft.trans || '')}</textarea>

          <label class="writing-label" for="task-summary-input">
            <span><b>02</b> Tóm tắt ý chính (1–3 câu)</span>
            <span id="task-sum-wc" style="color:var(--text-muted);">0 từ</span>
          </label>
          <textarea id="task-summary-input" class="summary-input" lang="vi" placeholder="Tóm tắt trọng tâm đoạn văn bằng tiếng Việt trong 1–3 câu...">${esc(savedDraft.summary || '')}</textarea>

          <div style="display:flex; gap:10px; align-items:center; justify-content:flex-end;">
            <button type="button" class="btn btn-primary" id="btn-submit-ai-grade" onclick="TasksModule.submitTranslationForAi()">
              Hoàn thành &amp; AI chấm kỹ
            </button>
          </div>
          <div id="task-ai-grade-result" style="display:none;"></div>
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
    B()?.bindNoPasteGuards?.(transEl, 'Không được dán (paste) khi làm bài dịch — hãy tự dịch trực tiếp!');
    B()?.bindNoPasteGuards?.(sumEl, 'Không được dán (paste) khi tóm tắt — hãy tự viết trực tiếp!');
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

  async function requestAiGrading(payload) {
    const syncUrl = B()?.getSyncUrl?.() || '';
    if (syncUrl) {
      try {
        const res = await fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'grade_translation', ...payload }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.ok && data.grade) return { ok: true, grade: data.grade };
          if (data?.error && !String(data.error).includes('GEMINI_API_KEY')) {
            return { ok: false, error: data.error };
          }
        }
      } catch (_) {}
    }

    // Fallback: device-local teacher key if saved manually
    let localKey = '';
    try { localKey = localStorage.getItem(LOCAL_AI_KEY_STORAGE) || ''; } catch (_) {}
    if (!localKey) {
      return {
        ok: false,
        error: 'Chưa cấu hình GEMINI_API_KEY trong Google Apps Script (hoặc trên trình duyệt giáo viên).',
      };
    }

    const prompt = [
      'Bạn là Giám khảo IELTS Reading & Giáo viên dạy đọc hiểu sâu sắc (tiếng Việt).',
      'Hãy chấm RẤT KỸ bài dịch và phần tóm tắt của học sinh.',
      `Từ nối định hướng: ${(payload.signalClues || []).join(', ')} | Từ khóa đã học: ${(payload.anchorWords || []).join(', ')}`,
      'Trả về DUY NHẤT JSON hợp lệ: { "score": number(0..10), "passed": boolean(score>=6), "criteria": { "accuracy": number, "signalWords": number, "contextInference": number, "summary": number }, "overallComment": string, "lineFeedback": [{"issue": string, "student": string, "advice": string, "suggested": string}], "modelTranslation": string }',
      '=== ĐOẠN GỐC ===\n' + payload.passage,
      '=== BẢN DỊCH HỌC SINH ===\n' + payload.translation,
      '=== TÓM TẮT ===\n' + (payload.summary || '(trống)')
    ].join('\n\n');

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(localKey)}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.25, responseMimeType: 'application/json' },
      }),
    });
    if (!resp.ok) {
      return { ok: false, error: `Gemini API HTTP ${resp.status}` };
    }
    const body = await resp.json();
    const txt = body?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = txt.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const grade = JSON.parse(clean);
    grade.score = Number(grade.score || 0);
    grade.passed = grade.score >= 6.0;
    return { ok: true, grade };
  }

  async function submitTranslationForAi() {
    if (!activeTask) return;
    const trans = (document.getElementById('task-trans-input')?.value || '').trim();
    const summary = (document.getElementById('task-summary-input')?.value || '').trim();
    if (trans.split(/\s+/).filter(Boolean).length < 25) {
      B()?.showToast('Vui lòng dịch đầy đủ đoạn văn trước khi gửi AI chấm!');
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
        return;
      }

      const g = res.grade;
      highlightPassageAfterGrading();
      const esc = B()?.escapeHtml || ((x) => String(x));
      const c = g.criteria || {};
      const linesHtml = (g.lineFeedback || []).slice(0, 6).map((lf) => `
        <div style="padding:8px 10px; border-radius:9px; background:var(--card-bg); border:1px solid var(--card-border); margin-top:6px; font-size:13px;">
          <div><strong>Cụm/câu cần sửa:</strong> ${esc(lf.issue || '')}</div>
          ${lf.student ? `<div class="task-text-err" style="margin-top:2px;"><strong>Bạn dịch:</strong> ${esc(lf.student)}</div>` : ''}
          ${lf.advice ? `<div style="margin-top:2px;"><strong>Phân tích ngữ cảnh:</strong> ${esc(lf.advice)}</div>` : ''}
          ${lf.suggested ? `<div class="task-text-ok" style="margin-top:2px;"><strong>Gợi ý chuẩn:</strong> ${esc(lf.suggested)}</div>` : ''}
        </div>
      `).join('');

      let masteryNote = '';
      if (g.passed && isPreviewTestMode) {
        masteryNote = `
          <div style="margin-top:10px; padding:12px 14px; border-radius:10px; background:rgba(82,136,62,0.16); border:1px solid rgba(82,136,62,0.35); color:var(--text-bright);">
            <div style="font-weight:800;">✓ Đạt Test thử ${esc(activeTask.label)}! (Chế độ Test thử — không ghi nhận điểm hay mở khóa từ vào tài khoản học viên.)</div>
          </div>`;
      } else if (g.passed) {
        taskTestPassed = true;
        stopIdleMonitor();
        B()?.syncExamLock?.(false);
        document.getElementById('screen-task')?.classList.remove('exam-no-copy');
        document.getElementById('task-leave-warn-banner')?.remove();
        const durationSec = Math.max(1, Math.round((Date.now() - (taskStartedAt || Date.now())) / 1000));
        const t1AccuracyPct = Math.max(0, Math.round(((50 - Math.min(50, t1Mistakes)) / 50) * 100));
        const newlyMarked = B()?.markMasteredBatch?.(activeTask.linkedIds) || 0;
        const prog = loadTaskProgress();
        prog[activeTask.id] = {
          status: 'completed',
          test1Mistakes: t1Mistakes,
          test1AccuracyPct: t1AccuracyPct,
          test2Score: t2Correct,
          translationScore: g.score,
          durationSec,
          linkedCount: activeTask.linkedIds.length,
          newlyMarked,
          updatedAt: Date.now(),
        };
        saveTaskProgress(prog);
        B()?.saveAndSync?.();
        masteryNote = `
          <div style="margin-top:10px; padding:12px 14px; border-radius:10px; background:rgba(82,136,62,0.16); border:1px solid rgba(82,136,62,0.35); color:var(--text-bright);">
            <div style="font-weight:800;">✓ Hoàn thành ${esc(activeTask.label)}! Đã tự động cập nhật Đã thuộc (+${newlyMarked} mục mới, tổng ${activeTask.linkedIds.length} từ/biến thể liên kết) vào bộ từ vựng chính.</div>
            <div style="margin-top:8px;">
              <button type="button" class="btn btn-primary" onclick="TasksModule.openTaskSummaryModal('${esc(activeTask.id)}')">Xem Bảng Thống Kê Task</button>
            </div>
          </div>`;
      }

      if (out) {
        out.style.display = 'block';
        out.className = `ai-grade-box ${g.passed ? '' : 'fail'}`;
        out.innerHTML = `
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <strong style="font-size:18px;">Điểm AI: ${g.score.toFixed(1)} / 10</strong>
            <span class="tip-pill" style="margin:0;">${g.passed ? 'ĐẠT TASK' : 'CẦN DỊCH LẠI (>= 6.0)'}</span>
          </div>
          <div class="ai-criteria-grid">
            <div class="ai-crit-pill"><span>Độ chính xác</span><span>${c.accuracy ?? '--'}/10</span></div>
            <div class="ai-crit-pill"><span>Từ nối định hướng</span><span>${c.signalWords ?? '--'}/10</span></div>
            <div class="ai-crit-pill"><span>Đoán từ ngữ cảnh</span><span>${c.contextInference ?? '--'}/10</span></div>
            <div class="ai-crit-pill"><span>Tóm tắt ý chính</span><span>${c.summary ?? '--'}/10</span></div>
          </div>
          <div style="font-size:13.5px; line-height:1.5;"><strong>Nhận xét:</strong> ${esc(g.overallComment || '')}</div>
          ${linesHtml}
          ${g.modelTranslation ? `<details style="margin-top:10px; font-size:13px;"><summary style="cursor:pointer; font-weight:700;">Xem bản dịch chuẩn tham khảo</summary><div style="margin-top:6px; line-height:1.55;">${esc(g.modelTranslation)}</div></details>` : ''}
          ${masteryNote}
        `;
      }

      if (g.passed && !isPreviewTestMode) {
        setTimeout(() => openTaskSummaryModal(activeTask?.id), 180);
      }
    } catch (err) {
      if (out) {
        out.style.display = 'block';
        out.className = 'ai-grade-box fail';
        out.textContent = `Lỗi khi chấm bài: ${err.message || err}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Hoàn thành & AI chấm kỹ';
      }
    }
  }

  // =========================================================
  // LIFECYCLE HOOKS
  // =========================================================
  let urlCheckedForUid = null;

  function onUserEntered(account) {
    assignedUrlTaskIds = parseUrlAssignedTasks();
    const previewStage = parseUrlPreviewStage(account);
    const sTasksBtn = document.getElementById('btn-open-student-tasks');
    if (!account) return;
    if (account.role === 'teacher') {
      urlCheckedForUid = account.id;
      if (sTasksBtn) sTasksBtn.style.display = 'none';
      renderTeacherDashboard();
      if (previewStage > 0) {
        openAdminTestPreview(previewStage, assignedUrlTaskIds[0] || 'task_01');
      }
      return;
    }
    if (sTasksBtn) {
      sTasksBtn.style.display = assignedUrlTaskIds.length > 0 ? 'inline-flex' : 'none';
    }
    syncAssignedTaskScopes();
    if (urlCheckedForUid !== account.id && previewStage > 0) {
      urlCheckedForUid = account.id;
      openAdminTestPreview(previewStage, assignedUrlTaskIds[0] || 'task_01');
      return;
    }
    if (urlCheckedForUid !== account.id && assignedUrlTaskIds.length > 0) {
      urlCheckedForUid = account.id;
      if (assignedUrlTaskIds.length === 1) {
        openTaskBriefModal(assignedUrlTaskIds[0]);
      } else {
        openStudentTasksModal();
      }
    }
  }

  function onUserLogout() {
    urlCheckedForUid = null;
    isPreviewTestMode = false;
    const sTasksBtn = document.getElementById('btn-open-student-tasks');
    if (sTasksBtn) sTasksBtn.style.display = 'none';
    stopIdleMonitor();
    activeTask = null;
    activeStage = 0;
    taskTestPassed = false;
    B()?.syncExamLock?.(false);
    document.getElementById('screen-task')?.classList.remove('open', 'active', 'exam-no-copy');
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

  function openTaskSummaryModal(focusTaskId = null) {
    const bridge = B();
    const esc = bridge?.escapeHtml || ((x) => String(x));
    const titleEl = document.getElementById('task-summary-modal-title');
    const subEl = document.getElementById('task-summary-subtitle');
    const bodyEl = document.getElementById('task-summary-body');
    if (!bodyEl) return;

    if (bridge?.isTeacherUser?.()) {
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

    // Student Task Summary View
    const prog = loadTaskProgress();
    const allTasks = getTasksList();
    const doneList = allTasks
      .map((t) => ({ task: t, rec: prog[t.id] }))
      .filter((x) => x.rec && x.rec.status === 'completed');

    const totalDone = doneList.length;
    const avgScore = totalDone
      ? (doneList.reduce((s, x) => s + Number(x.rec.translationScore || 0), 0) / totalDone).toFixed(1)
      : '--';
    const totalSecs = doneList.reduce((s, x) => s + Number(x.rec.durationSec || 0), 0);
    const totalLinkedWords = new Set(
      doneList.flatMap((x) => x.task.linkedIds || [])
    ).size;

    const focusTask = focusTaskId ? getTaskById(focusTaskId) : null;
    const focusRec = focusTask ? prog[focusTask.id] : null;

    if (titleEl) {
      titleEl.textContent = (focusTask && focusRec?.status === 'completed')
        ? `Hoàn Thành ${focusTask.label} — Bảng Thống Kê`
        : 'Bảng Thống Kê Tiến Độ Task';
    }
    if (subEl) {
      subEl.textContent = `${totalDone} / ${allTasks.length} Task đã hoàn thành · Toàn bộ từ thuộc các Task đã xong được đánh dấu Đã thuộc ở bộ chính`;
    }

    const focusHtml = (focusTask && focusRec?.status === 'completed') ? `
      <div class="task-summary-highlight" style="display:flex; gap:14px; align-items:center; flex-wrap:wrap;">
        <img src="assets/images/panda_leaderboard.jpg" alt="" class="task-summary-panda">
        <div style="flex:1; min-width:240px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:8px;">
          <strong style="font-size:16px;">Kết quả ${esc(focusTask.label)} (${esc(focusTask.theme)})</strong>
          <span class="tip-pill" style="margin:0;">HOÀN THÀNH · ${formatDurationVi(focusRec.durationSec)}</span>
        </div>
        <div class="ai-criteria-grid">
          <div class="ai-crit-pill"><span>Học từ gốc + WF</span><span>50 / 50 (+${focusRec.newlyMarked ?? 0} mới)</span></div>
          <div class="ai-crit-pill"><span>Test 1 (10 bảng ghép)</span><span>${focusRec.test1AccuracyPct ?? 100}% (${focusRec.test1Mistakes ?? 0} lỗi)</span></div>
          <div class="ai-crit-pill"><span>Test 2 (Ngữ cảnh)</span><span>${focusRec.test2Score ?? 0} / 12 câu</span></div>
          <div class="ai-crit-pill"><span>Test cuối (Dịch AI)</span><span>${Number(focusRec.translationScore || 0).toFixed(1)} / 10</span></div>
        </div>
        </div>
      </div>
    ` : '';

    const rowsHtml = doneList.map(({ task, rec }) => `
      <tr>
        <td><strong>${esc(task.label)}</strong></td>
        <td>${esc(task.theme)}</td>
        <td>${rec.test1AccuracyPct ?? 100}% (${rec.test1Mistakes ?? 0} lỗi)</td>
        <td>${rec.test2Score ?? 0} / 12</td>
        <td><strong>${Number(rec.translationScore || 0).toFixed(1)} / 10</strong></td>
        <td>${formatDurationVi(rec.durationSec)}</td>
      </tr>
    `).join('');

    bodyEl.innerHTML = `
      ${focusHtml}
      <div class="task-kpi-grid">
        <div class="task-kpi-card"><div class="task-kpi-label">Task hoàn thành</div><div class="task-kpi-val">${totalDone} / ${allTasks.length}</div></div>
        <div class="task-kpi-card"><div class="task-kpi-label">Điểm Dịch AI TB</div><div class="task-kpi-val">${avgScore} / 10</div></div>
        <div class="task-kpi-card"><div class="task-kpi-label">Tổng thời gian Task</div><div class="task-kpi-val">${esc(formatDurationVi(totalSecs))}</div></div>
        <div class="task-kpi-card"><div class="task-kpi-label">Từ Đã thuộc qua Task</div><div class="task-kpi-val">${totalLinkedWords} từ</div></div>
      </div>
      <div class="class-report-table-wrap">
        <table class="class-report-table">
          <thead>
            <tr><th>Task</th><th>Chủ đề</th><th>Test 1</th><th>Test 2</th><th>Dịch AI</th><th>Thời gian</th></tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="6" style="text-align:center;">Bạn chưa hoàn thành Task nào.</td></tr>'}
          </tbody>
        </table>
      </div>
      <div style="display:flex; gap:10px; justify-content:flex-end; margin-top:14px;">
        <button type="button" class="btn-subtle" onclick="TasksModule.closeTaskSummaryModal()">Xem lại bài dịch</button>
        <button type="button" class="btn btn-primary" onclick="TasksModule.closeTaskSummaryModal(); TasksModule.exitTaskWorkspace(false);">Về màn hình từ vựng chính</button>
      </div>
    `;
    document.getElementById('modal-task-summary')?.classList.add('open');
  }

  function closeTaskSummaryModal(event) {
    if (event && event.target !== document.getElementById('modal-task-summary')) return;
    document.getElementById('modal-task-summary')?.classList.remove('open');
  }

  function onCloudMerged() {
    if (pendingTaskId && document.getElementById('modal-task-brief')?.classList.contains('open')) {
      updateBriefLockUI();
    }
  }

  window.TasksModule = {
    renderTeacherDashboard,
    refreshTeacherDashboard,
    exportClassReportCsv,
    toggleTeacherPendingFilter,
    toggleTeacherTask,
    selectTeacherTaskRange,
    clearTeacherTaskSelection,
    copyTeacherTaskLink,
    saveLocalGeminiKey,
    openStudentTasksModal,
    closeStudentTasksModal,
    openTaskBriefModal,
    closeTaskBriefModal,
    openTaskSummaryModal,
    closeTaskSummaryModal,
    openTaskExamReadyModal,
    closeTaskExamReadyModal,
    onClickStartTaskExam,
    confirmStartTaskExam,
    updateTaskStudyBar,
    onScopeChanged,
    onStudyAssessmentChanged,
    startPendingTask,
    exitTaskWorkspace,
    speakWord,
    startTest1,
    pickT1Left,
    pickT1Right,
    proceedToTest2FromT1,
    answerTest2,
    nextTest2Question,
    retryTest2,
    startFinalTranslation,
    openAdminTestPreview,
    jumpPreviewStage,
    submitTranslationForAi,
    onUserEntered,
    onUserLogout,
    onCloudMerged,
    getExamState: () => ({
      active: Boolean(activeTask && activeStage >= 1 && !taskTestPassed && !isPreviewTestMode),
      label: activeTask?.label || 'Test Task',
    }),
    handleExternalTabIntrusion,
  };

  // Run if app.js already restored auth session before tasks.js executed
  const existingUser = B()?.getCurrentUser?.();
  if (existingUser) {
    onUserEntered(existingUser);
  }
})();
