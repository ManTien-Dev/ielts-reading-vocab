/* ==========================================================================
   TOTORO EDITORIAL UI CONTROLLER (js/totoro_ui.js)
   Wires 20 Orthogonal Themes, Cinema Login Canvas, 4-Tab Navigation (Desktop +
   Mobile Bottom Bar), Live Real-Data Home Dashboard, Inline 110-Task Hub,
   Account/Appearance Popovers, and Live Hanko Mastery Seals.
   ========================================================================== */
(function () {
  'use strict';

  const MODE_KEY = 'ielts_totoro_mode_v1';
  const PALETTE_KEY = 'ielts_totoro_palette_v1';
  const MOTION_KEY = 'ielts_totoro_motion_v1';
  const ACTIVE_VIEW_SESSION_KEY = 'ielts_totoro_active_view_v1';
  const VALID_VIEWS = ['home', 'flashcard', 'task', 'practice'];

  const html = document.documentElement;
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getAppBasePath() {
    if (typeof window.__APP_BASE_PATH__ === 'string') return window.__APP_BASE_PATH__;
    try {
      return (window.location.pathname || '/')
        .replace(/\/index\.html$/i, '')
        .replace(/\/(home|flashcard|task|practice|practise)\/?$/i, '')
        .replace(/\/+$/, '');
    } catch (_) {
      return '';
    }
  }

  function parseViewFromLocation() {
    try {
      if (window.location.protocol === 'file:') return '';
      const m = (window.location.pathname || '').match(/\/(home|flashcard|task|practice|practise)\/?$/i);
      if (!m) return '';
      const raw = m[1].toLowerCase();
      return raw === 'practise' ? 'practice' : raw;
    } catch (_) {
      return '';
    }
  }

  function syncUrlToView(viewName, push = false) {
    try {
      if (window.location.protocol === 'file:' || !window.history?.replaceState) return;
      const B = window.__VOCAB_BRIDGE__;
      if (!B?.getCurrentUser?.() || B?.isTeacherUser?.()) return;
      if (!VALID_VIEWS.includes(viewName)) return;
      const base = getAppBasePath();
      const targetPath = `${base}/${viewName}`;
      const qs = window.location.search || '';
      const hash = window.location.hash || '';
      const targetUrl = `${targetPath}${qs}${hash}`;
      const curUrl = `${window.location.pathname || ''}${qs}${hash}`;
      if (curUrl === targetUrl) return;
      if (push && window.history.pushState) {
        window.history.pushState({ view: viewName }, '', targetUrl);
      } else {
        window.history.replaceState({ view: viewName }, '', targetUrl);
      }
    } catch (_) {}
  }

  function resolveInitialView() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      if (sp.get('task') || sp.get('tasks') || sp.get('adminTest')) return 'flashcard';
      const urlView = parseViewFromLocation();
      if (VALID_VIEWS.includes(urlView)) return urlView;
      const saved = sessionStorage.getItem(ACTIVE_VIEW_SESSION_KEY) || '';
      if (VALID_VIEWS.includes(saved)) return saved;
    } catch (_) {}
    return 'home';
  }
  let activeView = resolveInitialView();
  let activeHomeChartPeriod = 'week';
  let activeHomeLbPeriod = 'week';
  let activeInlineTaskSuite = 'foundation';

  // --- 1. PERSISTED APPEARANCE ENGINE (Calm/Vibrant x Light/Dark x 5 Palettes x 3 Motions) ---
  function applySavedAppearance() {
    let mode = 'calm', palette = 'auto', motion = 'pro';
    try {
      mode = localStorage.getItem(MODE_KEY) || 'calm';
      palette = localStorage.getItem(PALETTE_KEY) || 'auto';
      motion = localStorage.getItem(MOTION_KEY) || 'pro';
    } catch (_) {}
    html.dataset.mode = (mode === 'vibrant') ? 'vibrant' : 'calm';
    if (palette && palette !== 'auto') html.dataset.palette = palette;
    else delete html.dataset.palette;
    html.dataset.motion = ['pro', 'classic', 'morph', 'original'].includes(motion) ? motion : 'pro';
    syncAppearanceButtons();
  }

  function syncAppearanceButtons() {
    const mode = html.dataset.mode || 'calm';
    const theme = html.getAttribute('data-theme') || 'light';
    const pal = html.dataset.palette || 'auto';
    const motion = html.dataset.motion || 'pro';
    document.querySelectorAll('[data-set-mode]').forEach((b) => b.classList.toggle('active', b.dataset.setMode === mode));
    document.querySelectorAll('[data-set-theme]').forEach((b) => b.classList.toggle('active', b.dataset.setTheme === theme));
    document.querySelectorAll('[data-set-palette]').forEach((b) => b.classList.toggle('active', b.dataset.setPalette === pal));
    document.querySelectorAll('[data-set-motion]').forEach((b) => b.classList.toggle('active', b.dataset.setMotion === motion));
  }

  function setStyleMode(m) {
    html.dataset.mode = m === 'vibrant' ? 'vibrant' : 'calm';
    try { localStorage.setItem(MODE_KEY, html.dataset.mode); } catch (_) {}
    syncAppearanceButtons();
    window.__VOCAB_BRIDGE__?.showToast?.(`Phong cách: ${html.dataset.mode === 'vibrant' ? 'Vibrant' : 'Calm'}`);
  }

  function setPalette(p) {
    if (!p || p === 'auto') {
      delete html.dataset.palette;
      try { localStorage.setItem(PALETTE_KEY, 'auto'); } catch (_) {}
    } else {
      html.dataset.palette = p;
      try { localStorage.setItem(PALETTE_KEY, p); } catch (_) {}
    }
    syncAppearanceButtons();
    window.__VOCAB_BRIDGE__?.showToast?.(`Bảng màu: ${String(p || 'auto').toUpperCase()}`);
  }

  function setMotion(m) {
    html.dataset.motion = ['pro', 'classic', 'morph', 'original'].includes(m) ? m : 'pro';
    try { localStorage.setItem(MOTION_KEY, html.dataset.motion); } catch (_) {}
    syncAppearanceButtons();
    const map = { pro: 'Lật 3D', classic: 'Cổ điển', morph: 'Tức thì', original: 'Trượt nảy' };
    window.__VOCAB_BRIDGE__?.showToast?.(`Hiệu ứng lật thẻ: ${map[html.dataset.motion]}`);
  }

  // --- 2. FULL-SCREEN 60FPS CINEMA CANVAS (SUMI-E RAIN + UMBRELLA SPLASH + FIREFLIES) ---
  let rainRaf = null, rainDrops = [], rainSplashes = [], fireflies = [], rainW = 0, rainH = 0;

  function isAuthVisible() {
    const gate = document.getElementById('auth-gate');
    if (!gate) return false;
    return getComputedStyle(gate).display !== 'none';
  }

  function initCinemaRain() {
    const canvas = document.getElementById('ink-rain-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    rainW = window.innerWidth;
    rainH = window.innerHeight;
    canvas.width = Math.round(rainW * dpr);
    canvas.height = Math.round(rainH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(110, Math.max(55, Math.floor(rainW / 14)));
    rainDrops = Array.from({ length: count }, () => ({
      x: Math.random() * (rainW + 120) - 60,
      y: Math.random() * rainH,
      len: 18 + Math.random() * 36,
      speed: 6.5 + Math.random() * 7.2,
      width: 0.95 + Math.random() * 1.5,
      tilt: -0.055 - Math.random() * 0.028,
      alpha: 0.36 + Math.random() * 0.45,
      mist: Math.random() > 0.3
    }));
    fireflies = Array.from({ length: 14 }, (_, i) => ({
      x: i < 7 ? (0.04 + Math.random() * 0.28) * rainW : (0.50 + Math.random() * 0.48) * rainW,
      y: (0.14 + Math.random() * 0.72) * rainH,
      r: 1.4 + Math.random() * 2.1,
      vx: (Math.random() - 0.5) * 0.16,
      vy: -0.07 - Math.random() * 0.13,
      phase: Math.random() * Math.PI * 2,
      speed: 0.014 + Math.random() * 0.017
    }));
    rainSplashes = [];
  }

  function getUmbrellaMetrics() {
    const img = document.getElementById('auth-art-img');
    const natW = (img && img.naturalWidth) || 1760;
    const natH = (img && img.naturalHeight) || 768;
    const scale = Math.max(rainW / natW, rainH / natH);
    const dispW = natW * scale;
    const dispH = natH * scale;
    const offX = (rainW - dispW) * 0.50;
    const offY = (rainH - dispH) * 0.50; // centered 2.29:1 Shin-hanga scene: 100% vertical height visible on all desktop viewports!
    return {
      offX, offY, dispW, dispH,
      cx: offX + dispW * 0.5845,
      rx: dispW * 0.1465,
      topY: offY + dispH * 0.122,
      edgeDrop: dispH * 0.145,
      tiltDrop: dispH * 0.012,
      rimBottomY: offY + dispH * 0.294,
      shelterCenterX: offX + dispW * 0.5845,
      lanternX: offX + dispW * 0.273,
      lanternY: offY + dispH * 0.365,
      groundY: Math.min(rainH - 16, offY + dispH * 0.895)
    };
  }

  function positionLoginCardUnderUmbrella() {
    const gate = document.getElementById('auth-gate');
    const card = document.getElementById('auth-washi-card');
    if (!gate || !card || !isAuthVisible()) return;
    if (!document.getElementById('auth-art-img')) {
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.bottom = '';
      card.style.width = '';
      card.style.maxWidth = '';
      card.style.margin = '';
      return;
    }
    rainW = window.innerWidth;
    rainH = window.innerHeight;
    const u = getUmbrellaMetrics();

    // Sync glowing paper lantern breathing halo directly over the painted lantern
    const pulse = gate.querySelector('.auth-lantern-pulse');
    if (pulse) {
      pulse.style.left = `${Math.round(u.lanternX)}px`;
      pulse.style.top = `${Math.round(u.lanternY)}px`;
    }

    if (window.innerWidth <= 960) {
      card.style.position = '';
      card.style.left = '';
      card.style.top = '';
      card.style.bottom = '';
      card.style.width = '';
      card.style.maxWidth = '';
      card.style.margin = '';
      return;
    }

    // Match user's compact, balanced mockup: card width = ~80% of the level umbrella canopy span (~10% symmetrical eaves left & right)
    const targetW = Math.round(Math.min(436, Math.max(356, u.dispW * 0.234)));
    card.style.width = `${targetW}px`;
    card.style.maxWidth = `${targetW}px`;
    const cardW = card.offsetWidth || targetW;
    const cardH = card.offsetHeight || 360;
    const totoroRightX = u.offX + u.dispW * 0.436;
    const minLeft = Math.max(totoroRightX + 12, 24);
    const maxLeft = Math.max(minLeft, rainW - cardW - 28);
    const leftPx = Math.round(Math.min(maxLeft, Math.max(minLeft, u.shelterCenterX - cardW / 2)));

    // Tuck snugly right beneath the compact umbrella underside (covering handle collar), ending cleanly above the mossy stepping stones
    const snugTop = Math.round(u.rimBottomY + 2);
    const maxTop = Math.max(16, rainH - cardH - Math.round(Math.max(48, rainH * 0.12)));
    const topPx = Math.round(Math.min(maxTop, snugTop));
    card.style.setProperty('position', 'fixed', 'important');
    card.style.left = `${leftPx}px`;
    card.style.top = `${Math.max(16, topPx)}px`;
    card.style.bottom = 'auto';
    card.style.margin = '0';
  }

  function drawCinemaRain() {
    if (!isAuthVisible()) { rainRaf = null; return; }
    const canvas = document.getElementById('ink-rain-canvas');
    const ctx = canvas ? canvas.getContext('2d') : null;
    if (!ctx || rainW < 10 || rainH < 10) { rainRaf = requestAnimationFrame(drawCinemaRain); return; }

    ctx.clearRect(0, 0, rainW, rainH);
    const u = getUmbrellaMetrics();
    const card = document.getElementById('auth-washi-card');
    const cardRect = card ? card.getBoundingClientRect() : null;

    // 1. Forest lantern fireflies
    for (const f of fireflies) {
      f.phase += f.speed;
      f.x += f.vx + Math.sin(f.phase * 0.7) * 0.11;
      f.y += f.vy;
      if (f.y < rainH * 0.08) f.y = rainH * 0.86;
      if (f.x < 10) f.x = rainW - 10;
      if (f.x > rainW - 10) f.x = 10;
      const glow = 0.22 + 0.56 * (0.5 + 0.5 * Math.sin(f.phase));
      const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.r * 5);
      g.addColorStop(0, `rgba(255, 224, 148, ${glow})`);
      g.addColorStop(0.4, `rgba(255, 198, 102, ${glow * 0.3})`);
      g.addColorStop(1, 'rgba(255, 198, 102, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Sumi-e calligraphy ink rain
    for (const d of rainDrops) {
      d.y += d.speed;
      d.x += d.speed * d.tilt;

      const norm = (d.x - u.cx) / u.rx;
      if (Math.abs(norm) <= 1) {
        const curveY = u.topY + norm * u.tiltDrop + (norm * norm) * u.edgeDrop;
        if (d.y >= curveY) {
          if (d.y <= curveY + 26 && Math.random() < 0.7) {
            rainSplashes.push({
              x: d.x, y: curveY,
              vx: (norm * 1.5) + (Math.random() - 0.5) * 1.5,
              vy: -1.2 - Math.random() * 1.8,
              r: 1.1 + Math.random() * 1.3, life: 1
            });
          }
          d.y = -Math.random() * 80;
          d.x = Math.random() * (rainW + 120) - 60;
          continue;
        }
      }

      if (cardRect && d.x > cardRect.left + 10 && d.x < cardRect.right - 10 && d.y >= cardRect.top - 2 && d.y <= cardRect.bottom) {
        if (d.y <= cardRect.top + 18 && Math.random() < 0.42) {
          rainSplashes.push({ x: d.x, y: cardRect.top, vx: (Math.random() - 0.5) * 1.6, vy: -1.1 - Math.random() * 1.3, r: 1.0 + Math.random(), life: 0.9 });
        }
        d.y = -Math.random() * 80;
        d.x = Math.random() * (rainW + 120) - 60;
        continue;
      }

      if (d.y > u.groundY) {
        if (Math.random() < 0.32) {
          rainSplashes.push({ x: d.x, y: u.groundY + Math.random() * 14, vx: 0, vy: 0, r: 1.8, life: 1, ripple: true });
        }
        d.y = -Math.random() * 80;
        d.x = Math.random() * (rainW + 120) - 60;
      }

      const x2 = d.x + d.len * d.tilt;
      const y2 = d.y - d.len;
      const mx = (d.x + x2) * 0.5 + d.width * 0.3;
      const my = (d.y + y2) * 0.5;
      ctx.beginPath();
      ctx.moveTo(x2, y2);
      ctx.quadraticCurveTo(mx, my, d.x + d.width * 0.8, d.y - 3.5);
      ctx.quadraticCurveTo(d.x, d.y + 3, d.x - d.width * 0.8, d.y - 3.5);
      ctx.quadraticCurveTo((d.x + x2) * 0.5 - d.width * 0.25, my, x2, y2);
      ctx.closePath();
      ctx.fillStyle = `rgba(2, 10, 18, ${d.alpha * 0.9})`;
      ctx.fill();

      if (d.mist) {
        const nearLantern = d.x < rainW * 0.34;
        ctx.beginPath();
        ctx.moveTo(x2 + 0.7, y2 + 3.5);
        ctx.lineTo(d.x + d.width * 0.7, d.y - 1.5);
        ctx.strokeStyle = nearLantern
          ? `rgba(255, 224, 168, ${d.alpha * 0.25})`
          : `rgba(205, 230, 245, ${d.alpha * 0.22})`;
        ctx.lineWidth = 0.75;
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    // 3. Splashes & ripples
    for (let i = rainSplashes.length - 1; i >= 0; i--) {
      const s = rainSplashes[i];
      s.life -= s.ripple ? 0.042 : 0.055;
      if (s.life <= 0) { rainSplashes.splice(i, 1); continue; }
      if (s.ripple) {
        s.r += 0.6;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.r * 2.1, s.r * 0.42, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(195, 226, 244, ${s.life * 0.28})`;
        ctx.lineWidth = 0.9;
        ctx.stroke();
      } else {
        s.x += s.vx; s.y += s.vy; s.vy += 0.14;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(4, 14, 22, ${s.life * 0.8})`;
        ctx.fill();
        ctx.strokeStyle = `rgba(218, 236, 248, ${s.life * 0.36})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    rainRaf = requestAnimationFrame(drawCinemaRain);
  }

  function syncCinemaRainLoop() {
    if (isAuthVisible()) positionLoginCardUnderUmbrella();
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (isAuthVisible() && !reduced) {
      initCinemaRain();
      if (!rainRaf) rainRaf = requestAnimationFrame(drawCinemaRain);
    } else if (rainRaf) {
      cancelAnimationFrame(rainRaf);
      rainRaf = null;
    }
  }

  // --- 3. 4-TAB NAVIGATION (HOME | FLASHCARD | TASK | PRACTICE) ---
  function switchView(viewName, opts = {}) {
    const B = window.__VOCAB_BRIDGE__;
    const teacherScreen = document.getElementById('screen-teacher');
    const teacherActive = teacherScreen && teacherScreen.style.display !== 'none' && getComputedStyle(teacherScreen).display !== 'none';
    if (teacherActive && B?.isTeacherUser?.()) return;

    const prevView = activeView;
    activeView = VALID_VIEWS.includes(viewName) ? viewName : 'home';
    try { sessionStorage.setItem(ACTIVE_VIEW_SESSION_KEY, activeView); } catch (_) {}
    if (!opts.skipUrlSync) {
      syncUrlToView(activeView, Boolean(opts.fromUser && prevView !== activeView));
    }
    const studyEl = document.getElementById('screen-study');
    const homeEl = document.getElementById('screen-home');
    const taskHubEl = document.getElementById('screen-tasks-hub');
    const practiceEl = document.getElementById('screen-practice');

    if (studyEl) {
      studyEl.classList.toggle('active', activeView === 'flashcard');
      studyEl.style.display = activeView === 'flashcard' ? '' : 'none';
    }
    if (homeEl) homeEl.classList.toggle('active', activeView === 'home');
    if (taskHubEl) taskHubEl.classList.toggle('active', activeView === 'task');
    if (practiceEl) practiceEl.classList.toggle('active', activeView === 'practice');

    document.querySelectorAll('[data-tot-view]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.totView === activeView);
    });

    if (activeView === 'home') {
      renderHomeDashboard();
    } else if (typeof window.__TOTORO_ENSURE_SKILL_MODE__ === 'function') {
      window.__TOTORO_ENSURE_SKILL_MODE__();
    }
    if (activeView === 'task') renderInlineTaskHub();
    if (activeView === 'practice') syncPracticeScreen();
    if (activeView === 'flashcard' && opts.fromUser && prevView !== 'flashcard' && B?.getCurrentUser?.() && B?.isAutoSpeakOn?.()) {
      B?.speakCurrentWord?.();
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function onUserEntered() {
    const target = resolveInitialView();
    switchView(target, { fromUser: false });
  }

  // --- 4. LIVE REAL-DATA HOME DASHBOARD ---
  function getRealStudentSnapshot() {
    const B = window.__VOCAB_BRIDGE__;
    const user = B?.getCurrentUser?.() || null;
    const uid = B?.getScopedUid?.() || (user?.id ? String(user.id).toLowerCase() : '');
    const assessments = B?.getAssessmentsMap?.() || {};
    const allItems = [
      ...(window.APP_DATA?.file1_paraphrase_1500 || []),
      ...(window.APP_DATA?.file2_families_3500 || []),
    ];
    const uniqueByLemma = new Map();
    let mastered = 0, slow = 0, due = 0;
    for (const it of allItems) {
      if (!it || !it.id) continue;
      const lvl = assessments[it.id] || 0;
      const k = String(it.lemma || it.id).toLowerCase();
      if (!uniqueByLemma.has(k) || lvl > uniqueByLemma.get(k)) uniqueByLemma.set(k, lvl);
      if (B?.isWordDueNow?.(it.id)) due++;
    }
    uniqueByLemma.forEach((lvl) => {
      if (lvl === 3) mastered++;
      else if (lvl === 2) slow++;
    });
    const totalFamilies = uniqueByLemma.size || 4489;
    const masteryPct = Math.min(100, Math.round((mastered / totalFamilies) * 100));

    let streak = 0;
    try { streak = B?.computeConsecutiveStreakForUser?.() || 0; } catch (_) {}
    const rankedWeek = B?.getClassRankedEntries?.('week') || [];
    const meWeek = rankedWeek.find((r) => String(r.id).toLowerCase() === uid) || null;

    let taskProg = {};
    try {
      const key = (B?.TASK_PROGRESS_KEY_BASE || 'ielts_task_progress_v1_') + uid;
      taskProg = JSON.parse(localStorage.getItem(key) || '{}') || {};
    } catch (_) {}
    const completedTasks = Object.entries(taskProg)
      .filter(([, v]) => v && v.status === 'completed')
      .sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));

    let todayMins = 0;
    const todayText = document.getElementById('timer-today-total')?.textContent || '0';
    const mMatch = todayText.match(/\d+/);
    if (mMatch) todayMins = parseInt(mMatch[0], 10) || 0;

    return {
      user, uid, mastered, slow, due, totalFamilies, masteryPct,
      streak, rankedWeek, meWeek, completedTasks, todayMins,
    };
  }

  function syncHeaderAndAccount() {
    const B = window.__VOCAB_BRIDGE__;
    const isTeacher = !!B?.isTeacherUser?.();
    const teacherScreen = document.getElementById('screen-teacher');
    const teacherVisible = teacherScreen && getComputedStyle(teacherScreen).display !== 'none';
    document.body.classList.toggle('is-teacher-mode', isTeacher && teacherVisible);

    const modeChip = document.getElementById('header-mode-chip-text');
    if (modeChip && !(isTeacher && teacherVisible)) {
      const curMode = typeof window.__TOTORO_GET_MODE__ === 'function' ? window.__TOTORO_GET_MODE__() : 'Overview';
      modeChip.textContent = curMode === 'Overview' ? 'Home chung' : curMode;
    }
    const snap = getRealStudentSnapshot();
    const u = snap.user;
    if (!u) return;
    const upperId = String(u.id || '').toUpperCase();
    const initials = upperId.slice(0, 2) || 'HV';
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    setTxt('hdr-acc-av', initials);
    setTxt('pop-acc-av', initials);
    setTxt('pop-acc-name', u.name || upperId);
    setTxt('pop-acc-id', `Mã ID: ${upperId} · ${u.role === 'teacher' ? 'Giáo viên' : 'Học viên'}`);
    setTxt('hdr-streak-days', `${snap.streak} ngày`);
    setTxt('pop-stat-streak', `${snap.streak} ngày`);
    setTxt('pop-stat-rank', snap.meWeek ? `#${snap.meWeek.rank}` : '—');
    setTxt('pop-stat-mastered', snap.mastered.toLocaleString('vi-VN'));
  }

  function getChestnutUnitHtml() {
    return `<span class="tot-chestnut-unit" aria-label="hạt dẻ điểm" title="Hạt dẻ điểm"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.4C13 4.6 19.8 8.2 21 13.8C21.8 17.6 18.6 21 12 21C5.4 21 2.2 17.6 3 13.8C4.2 8.2 11 4.6 12 2.4Z" fill="#8B3A14" stroke="#531F07" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 17.5C7 15.8 17 15.8 19 17.5C17.6 19.9 15 20.8 12 20.8C9 20.8 6.4 19.9 5 17.5Z" fill="#E8CCA0"/><path d="M7.2 12.2C7.8 9.6 9.8 7.8 11.4 6.6" stroke="#DF8B56" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><path d="M12 4.8V15.4M8.5 8.5C7.9 11 7.8 13.2 8.2 15.6M15.5 8.5C16.1 11 16.2 13.2 15.8 15.6" stroke="#5E2409" stroke-width="0.9" stroke-linecap="round" opacity=".45"/></svg></span>`;
  }

  const STUDY_PLAN_KEY_BASE = 'totoro_study_plan_v1_';

  function getStudyPlan(uidInput) {
    const uid = String(uidInput || window.__VOCAB_BRIDGE__?.getCurrentUser?.()?.id || 'guest').toLowerCase();
    const defaults = { targetBand: '7.5', examDate: '', dailyMins: 30, dailyWords: 20 };
    try {
      const raw = localStorage.getItem(STUDY_PLAN_KEY_BASE + uid);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          targetBand: ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'].includes(String(parsed.targetBand)) ? String(parsed.targetBand) : defaults.targetBand,
          examDate: typeof parsed.examDate === 'string' ? parsed.examDate : '',
          dailyMins: [15, 30, 45, 60].includes(Number(parsed.dailyMins)) ? Number(parsed.dailyMins) : defaults.dailyMins,
          dailyWords: [10, 20, 30, 50].includes(Number(parsed.dailyWords)) ? Number(parsed.dailyWords) : defaults.dailyWords,
        };
      }
    } catch (_) {}
    return defaults;
  }

  function togglePlanEditor(forceOpen) {
    const view = document.getElementById('home-target-view');
    const form = document.getElementById('home-plan-editor');
    const btn = document.getElementById('btn-toggle-plan-edit');
    if (!view || !form) return;
    const willOpen = typeof forceOpen === 'boolean' ? forceOpen : form.classList.contains('hidden');
    if (willOpen) {
      const plan = getStudyPlan();
      const bEl = document.getElementById('plan-input-band');
      const dEl = document.getElementById('plan-input-date');
      const mEl = document.getElementById('plan-input-mins');
      const wEl = document.getElementById('plan-input-words');
      if (bEl) bEl.value = plan.targetBand;
      if (dEl) dEl.value = plan.examDate;
      if (mEl) mEl.value = String(plan.dailyMins);
      if (wEl) wEl.value = String(plan.dailyWords);
    }
    form.classList.toggle('hidden', !willOpen);
    view.classList.toggle('hidden', willOpen);
    if (btn) btn.textContent = willOpen ? 'Đóng' : 'Chỉnh mục tiêu';
  }

  function saveStudyPlan(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    const uid = String(window.__VOCAB_BRIDGE__?.getCurrentUser?.()?.id || 'guest').toLowerCase();
    const plan = {
      targetBand: document.getElementById('plan-input-band')?.value || '7.5',
      examDate: document.getElementById('plan-input-date')?.value || '',
      dailyMins: Number(document.getElementById('plan-input-mins')?.value || 30),
      dailyWords: Number(document.getElementById('plan-input-words')?.value || 20),
    };
    try { localStorage.setItem(STUDY_PLAN_KEY_BASE + uid, JSON.stringify(plan)); } catch (_) {}
    togglePlanEditor(false);
    renderHomeDashboard();
    window.__VOCAB_BRIDGE__?.showToast?.(`Đã lưu mục tiêu Band ${plan.targetBand} · ${plan.dailyMins}p & ${plan.dailyWords} từ/ngày!`);
  }

  function renderHomePlanAndMonitor(snap, plan) {
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const rpStats = window.ReadingPracticeStore?.getSummaryStats?.() || {
      attemptsCount: 0, completedUnique: 0, avgBand: 0, totalMins: 0, recent: []
    };

    // 1. Target Band & Exam Countdown Card
    const targetNum = parseFloat(plan.targetBand) || 7.5;
    let estBand = 0;
    if (rpStats.avgBand > 0) {
      estBand = rpStats.avgBand;
    } else if (snap.mastered > 0 || snap.completedTasks.length > 0) {
      estBand = Math.min(targetNum, +(4.5 + (snap.masteryPct / 100) * 3.0 + Math.min(1.0, snap.completedTasks.length / 40)).toFixed(1));
    }
    const readinessPct = estBand > 0 ? Math.min(100, Math.round((estBand / targetNum) * 100)) : Math.min(100, snap.masteryPct);

    setTxt('home-target-band-val', targetNum.toFixed(1));
    setTxt('home-current-band-val', estBand > 0 ? estBand.toFixed(1) : '—');
    setTxt('home-target-readiness', `${readinessPct}%`);
    const tBar = document.getElementById('home-target-bar');
    if (tBar) tBar.style.width = `${readinessPct}%`;

    let daysText = 'Chưa đặt';
    let countdownSub = 'Đặt ngày thi để theo dõi nhịp độ';
    if (plan.examDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDt = new Date(`${plan.examDate}T00:00:00`);
      if (!Number.isNaN(targetDt.getTime())) {
        const diffDays = Math.ceil((targetDt.getTime() - today.getTime()) / 86400000);
        if (diffDays > 0) {
          daysText = `${diffDays} ngày`;
          countdownSub = `Dự thi ${targetDt.toLocaleDateString('vi-VN')} · còn ${diffDays} ngày`;
        } else if (diffDays === 0) {
          daysText = 'Hôm nay';
          countdownSub = 'Ngày thi IELTS đã đến — chúc bạn tự tin!';
        } else {
          daysText = 'Đã qua';
          countdownSub = 'Ngày thi cũ đã qua — cập nhật lịch thi mới';
        }
      }
    }
    setTxt('home-days-left-val', daysText);
    setTxt('home-target-countdown', countdownSub);
    setTxt('home-target-pace', `Nhịp mục tiêu: ${plan.dailyMins} phút · ${plan.dailyWords} từ / ngày · 1 bài luyện`);

    // 2. Daily Study Plan Checklist (live auto-checked!)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    const todayRpCount = (window.ReadingPracticeStore?.getHistory?.() || []).filter((h) => (h.submittedAt || 0) >= todayTs).length;
    const todayTaskCount = snap.completedTasks.filter(([, info]) => (info?.updatedAt || 0) >= todayTs).length;
    const todayExercises = todayRpCount + todayTaskCount;
    const todayWords = Math.max(sessionGoalState?.done || 0, Math.min(snap.mastered, snap.todayMins > 0 ? Math.min(plan.dailyWords, snap.mastered) : 0));

    const items = [
      {
        title: 'Ôn & học từ vựng mới',
        meta: `${todayWords}/${plan.dailyWords} từ`,
        pct: Math.min(100, Math.round((todayWords / Math.max(1, plan.dailyWords)) * 100)),
        done: todayWords >= plan.dailyWords,
        action: "window.TotoroUI?.enterSkillMode(window.TotoroUI?.getActiveSkill?.() || 'Reading', 'flashcard')",
      },
      {
        title: 'Tập trung thực học',
        meta: `${snap.todayMins}/${plan.dailyMins} phút`,
        pct: Math.min(100, Math.round((snap.todayMins / Math.max(1, plan.dailyMins)) * 100)),
        done: snap.todayMins >= plan.dailyMins,
        action: "window.TotoroUI?.enterSkillMode(window.TotoroUI?.getActiveSkill?.() || 'Reading', 'flashcard')",
      },
      {
        title: 'Hoàn thành 1 Task / bài Practice',
        meta: `${todayExercises}/1 bài`,
        pct: todayExercises >= 1 ? 100 : 0,
        done: todayExercises >= 1,
        action: "window.TotoroUI?.enterSkillMode('Reading', 'practice')",
      },
    ];
    const doneCnt = items.filter((it) => it.done).length;
    const badgeEl = document.getElementById('home-daily-plan-badge');
    if (badgeEl) {
      badgeEl.textContent = `${doneCnt}/${items.length} xong`;
      badgeEl.classList.toggle('soon', doneCnt === 0);
    }
    const listEl = document.getElementById('home-plan-checklist');
    if (listEl) {
      listEl.innerHTML = items.map((it) => `
        <button type="button" class="tot-plan-row ${it.done ? 'is-done' : ''}" onclick="${it.action}">
          <span class="tot-plan-chk" aria-hidden="true">${it.done ? '✓' : ''}</span>
          <span class="tot-plan-row-body">
            <span class="tot-plan-row-top">
              <span class="tot-plan-row-title">${esc(it.title)}</span>
              <strong class="tot-plan-row-meta tabular">${esc(it.meta)}</strong>
            </span>
            <span class="tot-plan-mini-bar"><span style="width:${it.pct}%"></span></span>
          </span>
        </button>
      `).join('');
    }

    // 3. Cross-Skill Progress Monitor Card
    const B = window.__VOCAB_BRIDGE__;
    const assess = B?.getAssessmentsMap?.() || {};
    const lv = window.APP_LISTENING_VOCAB || {};
    const allListenVocab = [...(lv.target_all || []), ...(lv.foundation || [])];
    const listenVocabTotal = allListenVocab.length || 3864;
    const listenVocabDone = allListenVocab.filter((w) => assess[w.id] === 3).length;
    const listenProg = window.ListeningTasksModule?.getProgressMap?.() || {};
    const listenTasksTotal = (window.APP_LISTENING_TASKS?.tasks || []).length || 139;
    const listenTasksDone = Object.values(listenProg).filter((p) => p && p.completed).length;

    const readTaskPct = Math.min(100, Math.round((snap.completedTasks.length / 110) * 100));
    const readPracPct = Math.min(100, Math.round((rpStats.completedUnique / 30) * 100));
    const listenPct = Math.min(100, Math.round(((listenVocabDone / Math.max(1, listenVocabTotal)) * 0.5 + (listenTasksDone / Math.max(1, listenTasksTotal)) * 0.5) * 100));
    const overallPct = Math.min(100, Math.round((snap.masteryPct + readTaskPct + readPracPct + listenPct) / 4));

    setTxt('home-monitor-overall-pct', `${overallPct}%`);
    setTxt('home-monitor-summary', `${snap.mastered.toLocaleString('vi-VN')} từ Reading · ${listenVocabDone.toLocaleString('vi-VN')} từ Listening`);

    const barsEl = document.getElementById('home-monitor-bars');
    if (barsEl) {
      const meters = [
        { label: 'Từ vựng Reading', val: `${snap.mastered.toLocaleString('vi-VN')} / ${snap.totalFamilies.toLocaleString('vi-VN')}`, pct: snap.masteryPct, cls: 'is-sage' },
        { label: 'Reading Tasks', val: `${snap.completedTasks.length} / 110 bài`, pct: readTaskPct, cls: 'is-warm' },
        { label: 'Luyện đề Reading', val: rpStats.avgBand ? `${rpStats.completedUnique} bài · Band ${rpStats.avgBand.toFixed(1)}` : `${rpStats.completedUnique} bài đã nộp`, pct: readPracPct, cls: 'is-emerald' },
        { label: 'Listening & Shadowing', val: `${listenVocabDone.toLocaleString('vi-VN')} từ · ${listenTasksDone}/${listenTasksTotal} Task`, pct: listenPct, cls: 'is-indigo' },
      ];
      barsEl.innerHTML = meters.map((m) => `
        <div class="tot-mon-meter">
          <div class="tot-mon-meter-head">
            <span>${esc(m.label)}</span>
            <strong class="tabular">${esc(m.val)}</strong>
          </div>
          <div class="tot-mastery-bar"><div class="tot-mon-fill ${m.cls}" style="width:${Math.max(m.pct > 0 ? 3 : 0, m.pct)}%"></div></div>
        </div>
      `).join('');
    }
  }

  function renderHomeDashboard() {
    const modeChip = document.getElementById('header-mode-chip-text');
    if (modeChip && !document.body.classList.contains('is-teacher-mode')) {
      const curMode = typeof window.__TOTORO_GET_MODE__ === 'function' ? window.__TOTORO_GET_MODE__() : 'Overview';
      modeChip.textContent = curMode === 'Overview' ? 'Home chung' : curMode;
    }
    const snap = getRealStudentSnapshot();
    const plan = getStudyPlan(snap.uid);
    const esc = window.__VOCAB_BRIDGE__?.escapeHtml || ((x) => String(x));
    const uName = snap.user?.name || snap.user?.id || 'bạn';
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    setTxt('home-hero-greeting', `Chào ${uName}, giữ vững chuỗi ${snap.streak} ngày nhé`);
    const subEl = document.getElementById('home-hero-sub');
    if (subEl) {
      const rankTxt = snap.meWeek
        ? `Xếp <strong>#${snap.meWeek.rank} lớp</strong> tuần này (${(snap.meWeek.score || 0).toLocaleString('vi-VN')}${getChestnutUnitHtml()}).`
        : 'Hoàn thành từ vựng & Task để ghi điểm xếp hạng lớp.';
      subEl.innerHTML = `Còn <strong style="color:var(--streak)">${snap.due} từ đến hạn ôn</strong> · ${rankTxt}`;
    }

    // Daily goal ring (synced with user's Study Plan target minutes!)
    const goalMins = plan.dailyMins || 30;
    const goalPct = Math.min(100, Math.round(((Math.min(snap.todayMins, goalMins) / goalMins) * 0.6 + (snap.completedTasks.length > 0 ? 0.4 : 0)) * 100));
    setTxt('home-goal-pct', `${goalPct}%`);
    const ring = document.getElementById('home-goal-arc');
    if (ring) ring.setAttribute('stroke-dashoffset', String(201 * (1 - goalPct / 100)));
    setTxt('home-goal-mastered', snap.mastered.toLocaleString('vi-VN'));
    setTxt('home-goal-tasks', `${snap.completedTasks.length}`);
    setTxt('home-goal-mins', `${snap.todayMins}/${goalMins}p`);

    // Render Plan, Target Band & Progress Monitor Strip
    renderHomePlanAndMonitor(snap, plan);

    // Study Rhythm Chart (Exact demo_v3: Tuần / Tháng / Năm + Dashed Target Line + Real localStorage data)
    const chartEl = document.getElementById('home-chart-bars');
    if (chartEl) {
      let dayMap = {};
      try {
        const raw = localStorage.getItem(`ielts_study_streak_v1_${snap.uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          dayMap = parsed?.days || parsed || {};
        }
      } catch (_) {}
      const labels = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const now = new Date();
      let cols = [];
      let totalMins = 0, activeUnits = 0, targetLabel = `Mục tiêu ${goalMins}p`;

      if (activeHomeChartPeriod === 'week') {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          const val = i === 0 ? Math.max(snap.todayMins, Number(dayMap[key]?.mins || dayMap[key] || 0)) : Number(dayMap[key]?.mins || dayMap[key] || 0);
          totalMins += val;
          if (val > 0) activeUnits++;
          cols.push({ lbl: labels[d.getDay()], mins: val, isToday: i === 0 });
        }
        setTxt('home-chart-sub', `${activeUnits} / 7 ngày · ${totalMins} phút tuần này`);
        setTxt('home-chart-avg', `${Math.round(totalMins / 7)} phút / ngày`);
      } else if (activeHomeChartPeriod === 'month') {
        targetLabel = 'Mục tiêu 150p';
        for (let w = 3; w >= 0; w--) {
          let sumW = 0;
          for (let dOff = 0; dOff < 7; dOff++) {
            const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (w * 7 + dOff));
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            sumW += (w === 0 && dOff === 0) ? Math.max(snap.todayMins, Number(dayMap[key]?.mins || dayMap[key] || 0)) : Number(dayMap[key]?.mins || dayMap[key] || 0);
          }
          totalMins += sumW;
          if (sumW > 0) activeUnits++;
          cols.push({ lbl: `Tuần ${4 - w}`, mins: sumW, isToday: w === 0 });
        }
        setTxt('home-chart-sub', `${activeUnits} / 4 tuần · ${totalMins} phút tháng này`);
        setTxt('home-chart-avg', `${Math.round(totalMins / 4)} phút / tuần`);
      } else {
        targetLabel = 'Mục tiêu 500p';
        for (let m = 5; m >= 0; m--) {
          const dtM = new Date(now.getFullYear(), now.getMonth() - m, 1);
          const prefix = `${dtM.getFullYear()}-${String(dtM.getMonth() + 1).padStart(2, '0')}-`;
          let sumM = 0;
          Object.entries(dayMap).forEach(([k, v]) => {
            if (k.startsWith(prefix)) sumM += Number(v?.mins || v || 0);
          });
          if (m === 0) sumM = Math.max(sumM, snap.todayMins);
          totalMins += sumM;
          if (sumM > 0) activeUnits++;
          cols.push({ lbl: `T${dtM.getMonth() + 1}`, mins: sumM, isToday: m === 0 });
        }
        setTxt('home-chart-sub', `${activeUnits} / 6 tháng · ${totalMins} phút gần đây`);
        setTxt('home-chart-avg', `${Math.round(totalMins / 6)} phút / tháng`);
      }

      const maxM = Math.max(activeHomeChartPeriod === 'week' ? 35 : (activeHomeChartPeriod === 'month' ? 180 : 600), ...cols.map((c) => c.mins));
      chartEl.innerHTML = `<div class="tot-target-line"><span>${targetLabel}</span></div>` + cols.map((c) => `
        <div class="tot-chart-col ${c.isToday ? 'today' : ''}">
          <span class="tot-chart-tip tabular">${c.mins}p</span>
          <div class="tot-chart-track"><div class="tot-chart-fill" style="height:${Math.round((c.mins / maxM) * 100)}%"></div></div>
          <span class="tot-chart-lbl">${c.lbl}</span>
        </div>
      `).join('');
    }

    // Class Leaderboard (Exact demo_v3: Medal Badges m1/m2/m3 + Circular Initials Avatar!)
    const lbEl = document.getElementById('home-lb-list');
    if (lbEl) {
      const entries = window.__VOCAB_BRIDGE__?.getClassRankedEntries?.(activeHomeLbPeriod) || [];
      const top5 = entries.slice(0, 5);
      lbEl.innerHTML = top5.length
        ? top5.map((r, i) => {
            const isMe = String(r.id).toLowerCase() === snap.uid;
            const rankNum = r.rank || (i + 1);
            const mCls = rankNum === 1 ? 'm1' : (rankNum === 2 ? 'm2' : (rankNum === 3 ? 'm3' : ''));
            const parts = String(r.name || r.id || 'HV').trim().split(/\s+/);
            const av = ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || parts[0]?.[1] || '')).toUpperCase().slice(0, 2) || 'HV';
            return `
              <div class="tot-lb-row ${isMe ? 'me' : ''}">
                <span style="display:inline-flex;align-items:center;gap:8px;min-width:0;">
                  <span class="tot-medal-badge ${mCls}">${rankNum}</span>
                  <span class="tot-lb-av">${esc(av)}</span>
                  <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</span>
                </span>
                <span class="tabular tot-lb-pts" style="color:var(--accent);font-weight:800;font-size:13px;white-space:nowrap;display:inline-flex;align-items:center;">${(r.score || 0).toLocaleString('vi-VN')}${getChestnutUnitHtml()}</span>
              </div>
            `;
          }).join('')
        : '<div style="font-size:12.5px;color:var(--ink-3);padding:12px 0;">Chưa có dữ liệu bảng thi đua tuần này.</div>';
      setTxt('home-lb-myrank', snap.meWeek ? `#${snap.meWeek.rank} / ${entries.length || 1}` : 'Chưa xếp hạng');
    }

    // Unified Recent History (Merges BOTH Tasks & Reading Practice attempts chronologically!)
    const histEl = document.getElementById('home-history-list');
    if (histEl) {
      const rpHist = (window.ReadingPracticeStore?.getHistory?.() || []).map((h) => ({
        ts: h.submittedAt || 0,
        title: h.title || 'Reading Practice',
        sub: `${h.source === 'cambridge' ? 'Cambridge' : (h.source === 'volume' ? 'Volume' : (h.source === 'actual' ? 'Actual' : 'Reading'))} · ${h.submittedAt ? new Date(h.submittedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
        badge: `Band ${Number(h.band || 0).toFixed(1)} · ${h.score}/${h.total}`,
        action: h.isFull
          ? `window.TotoroUI.enterSkillMode('Reading', 'practice'); window.ReadingPracticeApp?.startFullTest('${esc(h.itemId)}', { openInReview: true });`
          : `window.TotoroUI.enterSkillMode('Reading', 'practice'); window.ReadingPracticeApp?.startPassage('${esc(h.itemId)}', { openInReview: true });`,
      }));
      const taskHist = snap.completedTasks.map(([tid, info]) => {
        const taskObj = (window.APP_TASKS_DATA?.tasks || []).find((t) => t.id === tid);
        return {
          ts: info.updatedAt || 0,
          title: taskObj ? `${taskObj.label} · ${taskObj.theme || ''}` : tid.toUpperCase(),
          sub: `Task Từ vựng · ${info.updatedAt ? new Date(info.updatedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
          badge: info.recognitionScore != null ? `${info.recognitionScore}% · Đạt` : `${info.translationScore ?? '--'} / 10`,
          action: "window.TotoroUI?.enterSkillMode('Reading', 'task')",
        };
      });
      const merged = [...rpHist, ...taskHist].sort((a, b) => b.ts - a.ts).slice(0, 5);
      histEl.innerHTML = merged.length
        ? merged.map((row) => `
            <button type="button" class="tot-hist-row tot-hist-row-btn" onclick="${row.action}">
              <div style="min-width:0;overflow:hidden;text-align:left;">
                <div style="font-size:13px;font-weight:750;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(row.title)}</div>
                <div style="font-size:11px;color:var(--ink-3);font-weight:500;margin-top:1px;">${esc(row.sub)}</div>
              </div>
              <span class="tot-hist-badge tabular">${esc(row.badge)}</span>
            </button>
          `).join('')
        : '<div style="font-size:12.5px;color:var(--ink-3);padding:12px 0;">Chưa có bài làm nào. Chọn <strong>Reading</strong> hoặc <strong>Listening</strong> phía trên để bắt đầu nhé!</div>';
      setTxt('home-history-total', `${snap.completedTasks.length + rpHist.length} bài`);
    }

    if (activeHomeScope === 'reading') {
      renderReadingHomePanel(snap);
    } else if (activeHomeScope !== 'global') {
      renderSkillHomeStub(activeHomeScope);
    }
  }

  let activeHomeScope = 'global';

  function renderReadingHomePanel(snapInput) {
    const el = document.getElementById('home-scope-reading');
    if (!el) return;
    const B = window.__VOCAB_BRIDGE__;
    const esc = B?.escapeHtml || ((x) => String(x ?? '').replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s])));
    const snap = snapInput || getRealStudentSnapshot();
    const rpStats = window.ReadingPracticeStore?.getSummaryStats?.() || {
      attemptsCount: 0, completedUnique: 0, avgBand: 0, totalMins: 0, recent: [], inProgress: null
    };
    const mvDecks = window.MyVocabStore?.getDecks?.() || [];
    const mvTotalWords = mvDecks.reduce((sum, d) => sum + (d.words?.length || 0), 0);

    // 4 official Reading decks breakdown
    const assessments = B?.getAssessmentsMap?.() || {};
    const f1 = window.APP_DATA?.file1_paraphrase_1500 || [];
    const f2 = window.APP_DATA?.file2_families_3500 || [];
    const deckGroups = [
      { key: 'paraphrase', label: 'Paraphrase 1.500', list: f1 },
      { key: 'foundation', label: 'Nền tảng', list: f2.filter((w) => (w.tier || w.level) === 'foundation' || (w.rank || 0) <= 1000) },
      { key: 'academic', label: 'Học thuật', list: f2.filter((w) => (w.tier || w.level) === 'academic' || ((w.rank || 0) > 1000 && (w.rank || 0) <= 2200)) },
      { key: 'advanced', label: 'Chuyên sâu', list: f2.filter((w) => (w.tier || w.level) === 'advanced' || (w.rank || 0) > 2200) }
    ];
    const deckBarsHtml = deckGroups.map((dg) => {
      const total = dg.list.length || 1;
      const done = dg.list.filter((w) => assessments[w.id] === 3).length;
      const pct = Math.min(100, Math.round((done / total) * 100));
      return `
        <div class="rh-deck-row">
          <div class="rh-deck-meta"><span>${esc(dg.label)}</span><strong class="tabular">${done}/${dg.list.length}</strong></div>
          <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:${pct}%"></div></div>
        </div>
      `;
    }).join('');

    const inProg = rpStats.inProgress;
    const resumeHtml = inProg ? `
      <div class="rh-resume-card ink-brackets">
        <div>
          <div class="rh-resume-kicker">Đang làm dở · Reading Practice</div>
          <div class="rh-resume-title">${esc(inProg.title)}</div>
          <div class="rh-resume-sub">Đã trả lời ${Object.keys(inProg.answers || {}).length}/${inProg.totalQuestions || 0} câu · Còn ${Math.ceil((inProg.remainingSec || 0) / 60)} phút</div>
        </div>
        <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.resumeDraft();">Làm tiếp ngay →</button>
      </div>
    ` : '';

    const rpHistHtml = rpStats.recent.length
      ? rpStats.recent.map((h) => {
          const dt = h.completedAt ? new Date(h.completedAt).toLocaleDateString('vi-VN') : '';
          const srcLabel = h.source === 'cambridge' ? 'Cambridge' : h.source === 'volume' ? 'Volume' : h.source === 'actual' ? 'Actual' : 'News';
          const openCall = h.isFull
            ? `window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.startFullTest('${esc(h.itemId)}', { openInReview: true });`
            : `window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.startPassage('${esc(h.itemId)}', { openInReview: true });`;
          return `
            <div class="rh-hist-item">
              <div style="min-width:0;">
                <div class="rh-hist-title">${esc(h.title)}</div>
                <div class="rh-hist-meta">${esc(srcLabel)} · ${h.score}/${h.total} câu đúng · ${dt}</div>
              </div>
              <div class="rh-hist-right">
                <span class="rh-band-pill tabular">Band ${(Number(h.band) || 0).toFixed(1)}</span>
                <button type="button" class="tot-foot-btn" onclick="${openCall}">Xem giải</button>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="rh-empty">Chưa có lịch sử luyện đề Reading. Hãy vào tab <strong>Practice</strong> chọn Cambridge, Volume, Actual Tests hoặc News nhé!</div>`;

    const recentTasks = snap.completedTasks
      .slice()
      .sort((a, b) => (b[1]?.updatedAt || 0) - (a[1]?.updatedAt || 0))
      .slice(0, 4);

    const taskHistHtml = recentTasks.length
      ? recentTasks.map(([tid, info]) => {
          const taskObj = (window.APP_TASKS_DATA?.tasks || []).find((t) => t.id === tid);
          const label = taskObj ? `${taskObj.label} · ${taskObj.theme || ''}` : tid.toUpperCase();
          const score = info.recognitionScore != null ? `${info.recognitionScore}%` : `${info.translationScore ?? '--'}/10`;
          return `
            <div class="rh-hist-item">
              <div style="min-width:0;">
                <div class="rh-hist-title">${esc(label)}</div>
                <div class="rh-hist-meta">${info.updatedAt ? new Date(info.updatedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}</div>
              </div>
              <span class="tot-hist-badge tabular">${esc(score)}</span>
            </div>
          `;
        }).join('')
      : `<div class="rh-empty">Chưa có Task Reading nào hoàn thành.</div>`;

    const mvDecksHtml = mvDecks.slice(0, 4).map((d) => `
      <div class="rh-hist-item">
        <div style="min-width:0;">
          <div class="rh-hist-title">${esc(d.name)}</div>
          <div class="rh-hist-meta">${d.words?.length || 0} từ (lưu cục bộ trên máy)</div>
        </div>
        <button type="button" class="tot-foot-btn" onclick="window.__VOCAB_BRIDGE__?.openMyVocabDeck('${esc(d.id)}')">Học →</button>
      </div>
    `).join('');

    el.innerHTML = `
      <div class="rh-layout">
        <div class="rh-top-asym">
          <div class="tot-hero-card ink-brackets has-stamp rh-main-hero">
            <div class="rh-hero-copy">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="3 5.5 26 23.5" fill="none"><path d="M10.2 14L8.8 7.2L13.2 10.8C15 10.2 17 10.2 18.8 10.8L23.2 7.2L21.8 14C23.4 15.4 24 17.4 24 19H8C8 17.4 8.6 15.4 10.2 14Z" fill="#595651"/><path d="M14.2 10.2C15.8 7.5 19.2 7.4 20.6 9.5C18.5 11 15.8 11.2 14.2 10.2Z" fill="#4E9460"/><circle cx="13" cy="14.3" r="1.9" fill="#FFFFFF"/><circle cx="13.2" cy="14.3" r="0.95" fill="#181A1F"/><circle cx="19" cy="14.3" r="1.9" fill="#FFFFFF"/><circle cx="18.8" cy="14.3" r="0.95" fill="#181A1F"/><path d="M4.2 18.8C4.2 17.7 5.2 17 6.3 17.2L16 18.8L25.7 17.2C26.8 17 27.8 17.7 27.8 18.8V26.4C27.8 27.2 27 27.8 26.2 27.6L16 26L5.8 27.6C5 27.8 4.2 27.2 4.2 26.4V18.8Z" fill="#FBF8F0" stroke="#3F6E4A" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 18.8V26" stroke="#3F6E4A" stroke-width="1.5"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Reading</h2>
                  <div class="tot-shell-sub tabular">${(snap.mastered || 0).toLocaleString('vi-VN')} / ${(snap.totalFamilies || 4489).toLocaleString('vi-VN')} từ · ${snap.completedTasks.length} / 110 Tasks · ${mvTotalWords} từ cá nhân</div>
                </div>
              </div>
              <div class="rh-decks-grid-4">${deckBarsHtml}</div>
              <div class="rh-hero-actions" style="margin-top:12px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.switchView('practice')">Vào kho đề Practice →</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchView('flashcard')">Học Flashcard</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchView('task')">110 Tasks</button>
                <button type="button" class="tot-demo-btn" onclick="window.MyVocabUI?.openModal()">Từ của tôi (${mvTotalWords})</button>
              </div>
            </div>
          </div>

          <div class="tot-home-panel ink-brackets rh-band-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Kết quả Luyện đề Reading</div>
                <div class="tot-panel-sub tabular">${rpStats.attemptsCount} lượt nộp · ${rpStats.completedUnique} bài · ${rpStats.totalMins} phút</div>
              </div>
              <span class="rh-band-big tabular">${rpStats.avgBand ? `Band ${rpStats.avgBand.toFixed(1)}` : '—'}</span>
            </div>
            ${inProg ? `
              <div class="rh-inline-resume">
                <div style="min-width:0;">
                  <div class="rh-resume-title" style="font-size:13.5px;">Đang làm dở: ${esc(inProg.title)}</div>
                  <div class="rh-resume-sub">${Object.keys(inProg.answers || {}).length}/${inProg.totalQuestions || 0} câu · Còn ${Math.ceil((inProg.remainingSec || 0) / 60)} phút</div>
                </div>
                <button type="button" class="btn btn-primary tot-demo-btn" style="height:31px;font-size:12px;flex-shrink:0;" onclick="window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.resumeDraft();">Làm tiếp →</button>
              </div>
            ` : `
              <div class="rh-empty" style="margin:auto 0;">Chọn một Passage hoặc Full Test trong kho <strong>Cambridge · Volume · Actual · News</strong> để đo Band Reading thực tế.</div>
            `}
            <div class="tot-panel-foot" style="margin-top:auto;">
              <span class="tot-foot-meta">Tiến độ Task <strong class="tabular">${snap.completedTasks.length}/110</strong></span>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('practice')">Làm đề mới →</button>
            </div>
          </div>
        </div>

        <div class="rh-bottom-asym">
          <div class="tot-home-panel ink-brackets">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Lịch sử Luyện đề Reading</div>
                <div class="tot-panel-sub">Cambridge · Volume · Actual Tests · News</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.switchView('practice')">Kho đề →</button>
            </div>
            <div class="rh-hist-list">${rpHistHtml}</div>
          </div>

          <div class="tot-home-panel ink-brackets">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Từ của tôi &amp; Task gần đây</div>
                <div class="tot-panel-sub">Ôn nhanh bộ từ cá nhân rút từ bài đọc</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.MyVocabUI?.openModal()">Quản lý →</button>
            </div>
            <div class="rh-subhead">Sổ Từ của tôi (cục bộ)</div>
            <div class="rh-hist-list">${mvDecksHtml}</div>
            <div class="rh-subhead" style="margin-top:12px;">Task Reading vừa xong</div>
            <div class="rh-hist-list">${taskHistHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  function syncPracticeScreen() {
    const rpRoot = document.getElementById('rp-app-root');
    const lpRoot = document.getElementById('lp-app-root');
    const isListening = html.getAttribute('data-skill') === 'listening';
    if (isListening) {
      if (rpRoot) rpRoot.style.display = 'none';
      if (lpRoot) lpRoot.style.display = '';
      window.ListeningTasksModule?.renderPracticeScreen?.();
    } else {
      if (lpRoot) lpRoot.style.display = 'none';
      if (rpRoot) rpRoot.style.display = '';
      window.ReadingPracticeApp?.render?.();
    }
  }

  function renderListeningHomePanel(el) {
    const B = window.__VOCAB_BRIDGE__;
    const assess = B?.getAssessmentsMap?.() || {};
    const lv = window.APP_LISTENING_VOCAB || {};
    const lt = window.APP_LISTENING_TASKS || { tasks: [] };
    const prog = window.ListeningTasksModule?.getProgressMap?.() || {};
    const allTasks = lt.tasks || [];
    const totalTasks = allTasks.length || 139;
    const doneTasks = Object.values(prog).filter((p) => p && p.completed).length;

    const parts = [
      { label: 'Giao Tiếp & Dịch Vụ', list: lv.part1 || [] },
      { label: 'Bản Đồ & Địa Điểm', list: lv.part2 || [] },
      { label: 'Thảo Luận & Dự Án', list: lv.part3 || [] },
      { label: 'Bài Giảng Học Thuật', list: lv.part4 || [] },
    ];
    const allVocab = [...(lv.target_all || []), ...(lv.foundation || [])];
    const masteredTotal = allVocab.filter((w) => assess[w.id] === 3).length;
    const totalVocab = allVocab.length || 3864;
    const pctTotal = Math.round((masteredTotal / Math.max(1, totalVocab)) * 100);

    const barsHtml = parts.map((p) => {
      const m = p.list.filter((w) => assess[w.id] === 3).length;
      const pct = Math.round((m / Math.max(1, p.list.length)) * 100);
      return `
        <div class="rh-deck-row">
          <div class="rh-deck-meta"><span>${p.label}</span><strong class="tabular">${m}/${p.list.length}</strong></div>
          <div class="tot-mastery-bar"><div class="tot-seg-ok" style="width:${pct}%"></div></div>
        </div>`;
    }).join('');

    const recentDone = allTasks.filter((t) => prog[t.id]?.completed).slice(0, 4);
    const histHtml = recentDone.length
      ? recentDone.map((t) => {
          const r = prog[t.id];
          const sc = r.t3Total ? `${r.t3Score}/${r.t3Total}` : `${r.t1Score || 0}/${r.t1Total || 30}`;
          return `<div class="rh-hist-item"><div class="rh-hist-title">${esc(t.label)}</div><span class="tot-hist-badge tabular">${esc(sc)}</span></div>`;
        }).join('')
      : `<div class="rh-empty">Chưa có bài Listening nào hoàn thành. Chọn ngay một bài <strong>Bản đồ Map</strong> hoặc <strong>Thực chiến 3 Test</strong> bên dưới để bắt đầu.</div>`;

    const featuredExams = [
      ...allTasks.filter((t) => t.isMapTask).slice(0, 3),
      ...allTasks.filter((t) => t.hasFullTests && !t.isMapTask).slice(0, 3),
    ];
    const featuredHtml = featuredExams.map((t) => {
      const r = prog[t.id];
      const rawTitle = String(t.topicTitle || t.theme || '').replace(/^🗺️\s*MAP\s*·\s*/i, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
      const shortTitle = rawTitle.includes('·') ? rawTitle.split('·').pop().trim() : rawTitle;
      const badge = r?.t3Total
        ? `<span class="tot-hist-badge tabular">${r.t3Score}/${r.t3Total}</span>`
        : `<span class="lt-inline-pill ${t.isMapTask ? 'is-map' : ''}">${t.isMapTask ? 'Map' : '3 Test'}</span>`;
      return `
        <div class="rh-hist-item lh-click-row" onclick="window.ListeningTasksModule?.openExam?.('${esc(t.id)}', 3)">
          <div style="min-width:0;flex:1;">
            <div class="rh-hist-title">${esc(t.label)} · ${esc(shortTitle)}</div>
            <div class="rh-hist-meta">${t.isMapTask ? 'Bản đồ SVG tương tác · Nghe 1 lần 1.25×' : 'Note Completion chuẩn Cambridge · Audio Neural 1.25×'}</div>
          </div>
          <div class="rh-hist-right">
            ${badge}
            <button type="button" class="tot-foot-btn" onclick="event.stopPropagation(); window.ListeningTasksModule?.openExam?.('${esc(t.id)}', 3)">Làm bài →</button>
          </div>
        </div>`;
    }).join('');

    const deckCatalog = [
      { key: 'l_foundation', name: 'Từ Vựng Nền Tảng', sub: 'Từ cơ bản bắt buộc nghe hiểu', list: lv.foundation || [] },
      { key: 'l_all_parts', name: 'Từ Vựng Cốt Lõi', sub: 'Xuất hiện đều ở cả 4 phần thi', list: lv.all_parts || [] },
      { key: 'l_part1', name: 'Giao Tiếp & Dịch Vụ', sub: 'Đặt phòng, du lịch, đăng ký, điền form', list: lv.part1 || [] },
      { key: 'l_part2', name: 'Bản Đồ & Địa Điểm', sub: 'Chỉ đường, công viên, tòa nhà, sự kiện', list: lv.part2 || [] },
      { key: 'l_part3', name: 'Thảo Luận & Dự Án', sub: 'Làm bài nhóm, trao đổi giảng viên', list: lv.part3 || [] },
      { key: 'l_part4', name: 'Bài Giảng Học Thuật', sub: 'Khoa học, thiên nhiên, lịch sử, xã hội', list: lv.part4 || [] },
      { key: 'l_cues_40', name: 'Từ Tín Hiệu & Bẫy Đổi Ý', sub: '40 cụm từ bẫy phổ biến khi nghe', list: lv.cues_40 || [] },
    ];
    const deckListHtml = deckCatalog.map((d) => {
      const m = d.list.filter((w) => assess[w.id] === 3).length;
      return `
        <div class="rh-hist-item lh-click-row" onclick="window.TotoroUI.enterSkillMode('Listening', 'flashcard'); window.__VOCAB_BRIDGE__?.loadMainScope?.('${d.key}');">
          <div style="min-width:0;flex:1;">
            <div class="rh-hist-title">${esc(d.name)}</div>
            <div class="rh-hist-meta">${esc(d.sub)} · <strong class="tabular">${m}/${d.list.length}</strong></div>
          </div>
          <button type="button" class="tot-foot-btn" onclick="event.stopPropagation(); window.TotoroUI.enterSkillMode('Listening', 'flashcard'); window.__VOCAB_BRIDGE__?.loadMainScope?.('${d.key}');">Học →</button>
        </div>`;
    }).join('');

    el.innerHTML = `
      <div class="rh-layout">
        <div class="rh-top-asym">
          <div class="tot-hero-card ink-brackets has-stamp rh-main-hero">
            <div class="rh-hero-copy">
              <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Listening</h2>
                  <div class="tot-shell-sub tabular">${masteredTotal.toLocaleString('vi-VN')} / ${totalVocab.toLocaleString('vi-VN')} từ · ${doneTasks} / ${totalTasks} Tasks · Audio Neural 1.25×</div>
                </div>
              </div>
              <div class="rh-decks-grid-4">${barsHtml}</div>
              <div class="rh-hero-actions" style="margin-top:12px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'practice')">Vào kho đề Practice →</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'flashcard')">Học Flashcard</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'task')">139 Tasks</button>
              </div>
            </div>
          </div>

          <div class="tot-home-panel ink-brackets rh-band-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Tiến độ Luyện nghe</div>
                <div class="tot-panel-sub tabular">${doneTasks} / ${totalTasks} bài đã hoàn thành</div>
              </div>
              <span class="rh-band-big tabular">${pctTotal}%</span>
            </div>
            <div class="rh-hist-list">${histHtml}</div>
            <div class="tot-panel-foot" style="margin-top:auto;">
              <span class="tot-foot-meta">Bản đồ Map &amp; Note Completion</span>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'practice')">Làm đề mới →</button>
            </div>
          </div>
        </div>

        <div class="rh-bottom-asym">
          <div class="tot-home-panel ink-brackets">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Bài thi Bản đồ &amp; Thực chiến nổi bật</div>
                <div class="tot-panel-sub">Bản đồ SVG tương tác &amp; Note Completion 1.25×</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'practice')">Tất cả đề →</button>
            </div>
            <div class="rh-hist-list">${featuredHtml}</div>
          </div>

          <div class="tot-home-panel ink-brackets">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Lộ trình Bộ từ Listening</div>
                <div class="tot-panel-sub">7 bộ từ chia theo ngữ cảnh thực tế từ dễ đến học thuật</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'flashcard')">Flashcard →</button>
            </div>
            <div class="rh-hist-list lh-deck-scroll">${deckListHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSkillHomeStub(scope) {
    const el = document.getElementById('home-scope-skill-stub');
    if (!el) return;
    if (scope === 'listening') {
      renderListeningHomePanel(el);
      return;
    }
    const meta = {
      writing: {
        name: 'Writing Home',
        badge: 'Đang phát triển · Sắp ra mắt',
        desc: 'Không gian trang chủ riêng cho IELTS Writing: bản đồ Flow Ideas Task 2, biểu đồ Task 1, kho bài mẫu chữa chi tiết và lịch sử chấm Band.',
        cta: `<button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchHomeScope('global')">← Quay về Home chung</button>`
      },
      speaking: {
        name: 'Speaking Home',
        badge: 'Đang phát triển · Sắp ra mắt',
        desc: 'Không gian trang chủ riêng cho IELTS Speaking: Spoken Chunks Part 1–3, kho Cue Card theo quý và lịch sử luyện phát âm.',
        cta: `<button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchHomeScope('global')">← Quay về Home chung</button>`
      }
    }[scope];
    if (!meta) return;

    el.innerHTML = `
      <div class="rh-stub-card ink-brackets">
        <span class="rp-tag">${meta.badge}</span>
        <h2 class="rh-title" style="margin-top:10px;">${meta.name}</h2>
        <p class="rh-sub" style="max-width:560px;margin:6px auto 18px;">${meta.desc}</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.openGlobalHome()">← Về Home chung</button>
          ${scope === 'listening' ? meta.cta : ''}
        </div>
      </div>
    `;
  }

  function switchHomeScope(scope) {
    const valid = ['global', 'reading', 'listening', 'writing', 'speaking'];
    activeHomeScope = valid.includes(scope) ? scope : 'global';

    document.querySelectorAll('#home-tier-bar [data-home-scope]').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.homeScope === activeHomeScope);
    });
    const gEl = document.getElementById('home-scope-global');
    const rEl = document.getElementById('home-scope-reading');
    const sEl = document.getElementById('home-scope-skill-stub');
    if (gEl) gEl.classList.toggle('active', activeHomeScope === 'global');
    if (rEl) rEl.classList.toggle('active', activeHomeScope === 'reading');
    if (sEl) sEl.classList.toggle('active', !['global', 'reading'].includes(activeHomeScope));

    if (activeHomeScope === 'reading') renderReadingHomePanel();
    else if (activeHomeScope !== 'global') renderSkillHomeStub(activeHomeScope);
    else renderHomeDashboard();
  }

  // --- 5. REAL-DATA INLINE TASK HUB (110 TASKS + FIXED DONE/UNDONE CONTRAST) ---
  const SUITES = [
    { key: 'foundation', label: 'Nền tảng' },
    { key: 'academic', label: 'Học thuật' },
    { key: 'paraphrase', label: 'Paraphrase' },
    { key: 'advanced', label: 'Chuyên sâu' },
  ];

  function renderInlineTaskHub() {
    const tabsEl = document.getElementById('inline-task-suites');
    const gridEl = document.getElementById('inline-tasks-grid');
    if (!gridEl) return;

    if (html.getAttribute('data-skill') === 'listening' && typeof window.ListeningTasksModule?.renderHub === 'function') {
      gridEl.classList.add('is-listening-grid');
      window.ListeningTasksModule.renderHub(tabsEl, gridEl);
      return;
    }

    gridEl.classList.remove('is-listening-grid');
    const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
    if (titleEl) titleEl.textContent = 'Task bài tập · Reading';

    const B = window.__VOCAB_BRIDGE__;
    const esc = B?.escapeHtml || ((x) => String(x));
    const uid = B?.getScopedUid?.() || '';

    if (tabsEl) {
      tabsEl.innerHTML = SUITES.map((s) => `
        <button type="button" class="tot-seg-btn ${activeInlineTaskSuite === s.key ? 'active' : ''}" onclick="window.TotoroUI.switchTaskSuite('${s.key}')">${s.label}</button>
      `).join('');
    }

    let progress = {};
    try {
      progress = JSON.parse(localStorage.getItem((B?.TASK_PROGRESS_KEY_BASE || 'ielts_task_progress_v1_') + uid) || '{}') || {};
    } catch (_) {}

    const list = (typeof window.TasksModule?.getTasksByScope === 'function')
      ? window.TasksModule.getTasksByScope(activeInlineTaskSuite)
      : (window.APP_TASKS_DATA?.tasks || []).filter((t) => (t.scopeKey || 'paraphrase') === activeInlineTaskSuite);
    const doneCnt = list.filter((t) => progress[t.id]?.status === 'completed').length;
    const subEl = document.getElementById('inline-task-sub');
    if (subEl) subEl.textContent = `${doneCnt} / ${list.length} bài đã hoàn thành trong bộ ${SUITES.find((s) => s.key === activeInlineTaskSuite)?.label || ''}.`;

    gridEl.innerHTML = list.map((t, idx) => {
      const done = progress[t.id]?.status === 'completed';
      const isRecog = t.taskKind === 'recognition';
      const score = isRecog
        ? `${progress[t.id]?.recognitionScore ?? '--'}%`
        : `${progress[t.id]?.translationScore ?? '--'}`;
      const numStr = String(t.num || (idx + 1)).padStart(2, '0');
      const hanko = done
        ? `<svg class="ghibli-stamp ok" style="right:46px;bottom:6px;width:28px;height:28px;opacity:0.24;" viewBox="0 0 64 64" fill="none" aria-hidden="true"><circle cx="32" cy="32" r="27" stroke="currentColor" stroke-width="3" stroke-dasharray="5 3"/><path d="M21 25L18 15L26 21C29.5 20 34.5 20 38 21L46 15L43 25C47.5 28.5 50 34 50 40C50 48 42.5 53 32 53C21.5 53 14 48 14 40C14 34 16.5 28.5 21 25Z" stroke="currentColor" stroke-width="2.6" stroke-linejoin="round"/><circle cx="25.5" cy="32" r="2.2" fill="currentColor"/><circle cx="38.5" cy="32" r="2.2" fill="currentColor"/></svg>`
        : '';
      return `
        <button type="button" class="tot-task-card has-stamp ${done ? 'is-done' : ''}" onclick="TasksModule.openTaskBriefModal('${esc(t.id)}')">
          ${hanko}
          <span class="tot-task-num">${esc(numStr)}</span>
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.label)}</div>
            <div style="font-size:11px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.theme || '')} · ~${t.estMinutes || 30}p</div>
          </div>
          ${done ? `<span class="tot-task-score tabular">${esc(score)}</span>` : ''}
        </button>
      `;
    }).join('');
  }

  // --- 6. LIVE HANKO MASTERY SEAL + CHRONOGRAPH RING + VOCAB DONUT RING SYNC ---
  function syncFlashcardHankoSeal() {
    const statusEl = document.getElementById('fc-back-status');
    const sealEl = document.getElementById('fc-hanko-seal');
    const chibiEl = document.getElementById('fc-back-chibi-stamp');
    if (!statusEl || !sealEl) return;
    const isMastered = statusEl.classList.contains('mastered') || /đã thuộc/i.test(statusEl.textContent || '');
    sealEl.classList.toggle('stamped', isMastered);
    if (chibiEl) chibiEl.style.opacity = isMastered ? '0' : '';
  }

  function syncChronographRing() {
    const digitsEl = document.getElementById('timer-digits');
    const statusEl = document.getElementById('timer-status-text');
    const arcEl = document.getElementById('chrono-arc');
    const stateEl = document.getElementById('chrono-state');
    const dotEl = document.getElementById('chrono-live-dot');
    if (!digitsEl || !arcEl) return;
    const txt = (digitsEl.textContent || '00:00').trim();
    const parts = txt.split(':').map((n) => parseInt(n, 10) || 0);
    const secs = parts.length === 3 ? parts[0] * 3600 + parts[1] * 60 + parts[2] : (parts[0] || 0) * 60 + (parts[1] || 0);
    const isCountdown = document.getElementById('timer-mode-down')?.classList.contains('active');
    const activePresetTxt = document.querySelector('#timer-presets .preset-btn.active')?.textContent || '25p';
    const targetSecs = (parseInt(activePresetTxt, 10) || 25) * 60;
    const rawRatio = isCountdown
      ? secs / Math.max(60, targetSecs)
      : ((secs % targetSecs) / targetSecs || (secs > 0 ? 1 : 0));
    // Keep a tasteful visible bronze-to-moss starter arc (min 14%) so the dial always looks rich & alive like demo_v3!
    const ratio = isCountdown
      ? Math.max(0.06, Math.min(1, rawRatio))
      : Math.max(0.14, Math.min(1, 0.14 + rawRatio * 0.86));
    const circ = 351.86; // 2 * PI * 56
    const nextOff = (circ * (1 - ratio)).toFixed(1);
    if (arcEl.style.strokeDashoffset !== nextOff) arcEl.style.strokeDashoffset = nextOff;

    const rawSt = (statusEl?.textContent || '').trim();
    const lowSt = rawSt.toLowerCase();
    const paused = /dừng|tạm|chờ|ngưng|hết/.test(lowSt);
    // Keep concise demo_v3 label ("Đang học" / "Tạm dừng") cleanly without infinite mutation
    const cleanSt = paused ? 'Tạm dừng' : 'Đang học';
    if (statusEl && rawSt !== cleanSt && /tính giờ|tạm dừng|đang đếm/.test(lowSt)) {
      statusEl.textContent = cleanSt;
    }
    if (stateEl) stateEl.classList.toggle('paused', paused);
    if (dotEl) dotEl.classList.toggle('paused', paused);
  }

  function syncVocabDonutRing() {
    const m = parseInt((document.getElementById('stat-count-mastered')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
    const s = parseInt((document.getElementById('stat-count-slow')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
    const u = parseInt((document.getElementById('stat-count-unlearned')?.textContent || '0').replace(/\D/g, ''), 10) || 0;
    const total = Math.max(1, m + s + u);
    const okPct = Math.round((m / total) * 100);
    const okAndSlowPct = Math.min(100, ((m + s) / total) * 100);
    const circ = 194.8; // 2 * PI * 31
    const okEl = document.getElementById('vocab-donut-ok');
    const warmEl = document.getElementById('vocab-donut-warm');
    const pctEl = document.getElementById('vocab-donut-pct');
    const nextOk = (circ * (1 - m / total)).toFixed(1);
    const nextWarm = (circ * (1 - okAndSlowPct / 100)).toFixed(1);
    const nextTxt = `${okPct}%`;
    if (okEl && okEl.getAttribute('stroke-dashoffset') !== nextOk) okEl.setAttribute('stroke-dashoffset', nextOk);
    if (warmEl && warmEl.getAttribute('stroke-dashoffset') !== nextWarm) warmEl.setAttribute('stroke-dashoffset', nextWarm);
    if (pctEl && pctEl.textContent !== nextTxt) pctEl.textContent = nextTxt;
  }

  const SESSION_GOAL_STORAGE = 'tot_session_goal';
  const sessionGoalState = {
    target: (() => {
      const n = parseInt(localStorage.getItem(SESSION_GOAL_STORAGE) || '20', 10);
      return [15, 20, 30].includes(n) ? n : 20;
    })(),
    done: 0,
    mastered: 0,
    review: 0,
    startedAt: Date.now(),
  };

  function toggleFrontContextFromWidget() {
    const chk = document.getElementById('chk-show-front-context');
    const st = window.__VOCAB_BRIDGE__?.getStudyControlsState?.() || {};
    const next = !(chk ? chk.checked : !!st.showFrontContext);
    if (chk) chk.checked = next;
    if (typeof window.toggleFrontContext === 'function') {
      window.toggleFrontContext(next);
    }
    syncStudyFocusWidgets();
  }

  function setSessionGoalTarget(target) {
    const n = parseInt(target, 10);
    if (![15, 20, 30].includes(n)) return;
    sessionGoalState.target = n;
    try { localStorage.setItem(SESSION_GOAL_STORAGE, String(n)); } catch {}
    syncStudyFocusWidgets();
  }

  function syncStudyFocusWidgets() {
    const B = window.__VOCAB_BRIDGE__;
    const st = B?.getStudyControlsState?.() || {};

    // 1. Widget 2 (Bottom-Left): Phát Âm & Mặt Thẻ
    const spkBtn = document.getElementById('btn-widget-autospeak');
    const spkTxt = document.getElementById('widget-autospeak-state');
    const usBtn = document.getElementById('btn-widget-accent-us');
    const ukBtn = document.getElementById('btn-widget-accent-uk');
    const ctxBtn = document.getElementById('btn-widget-front-ctx');
    const ctxTxt = document.getElementById('widget-front-ctx-state');
    const ctxChk = document.getElementById('chk-show-front-context');

    const autoSpeakOn = st.autoSpeak != null ? !!st.autoSpeak : true;
    const isUk = st.preferredAccent === 'en-GB';
    const frontCtxOn = ctxChk ? !!ctxChk.checked : !!st.showFrontContext;

    if (spkBtn) spkBtn.classList.toggle('active', autoSpeakOn);
    if (spkTxt) spkTxt.textContent = autoSpeakOn ? 'Bật' : 'Tắt';
    if (usBtn) usBtn.classList.toggle('active', !isUk);
    if (ukBtn) ukBtn.classList.toggle('active', isUk);
    if (ctxBtn) ctxBtn.classList.toggle('active', frontCtxOn);
    if (ctxTxt) ctxTxt.textContent = frontCtxOn ? 'Hiện' : 'Ẩn';
    window.populateVoiceSelectUI?.();

    // 2. Widget 4 (Bottom-Right): Mục Tiêu Phiên Học
    document.querySelectorAll('#widget-four-decks [data-session-goal]').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.sessionGoal) === sessionGoalState.target);
    });
    const goal = Math.max(1, sessionGoalState.target);
    const done = sessionGoalState.done;
    const pct = Math.min(100, Math.round((done / goal) * 100));
    const elapsedMins = Math.max(1 / 6, (Date.now() - sessionGoalState.startedAt) / 60000);
    const rate = done > 0 ? (done / elapsedMins).toFixed(1) : '—';

    const progEl = document.getElementById('session-goal-progress-txt');
    const pctEl = document.getElementById('session-goal-pct');
    const barEl = document.getElementById('session-goal-bar');
    const mEl = document.getElementById('session-stat-mastered');
    const rEl = document.getElementById('session-stat-review');
    const rateEl = document.getElementById('session-stat-rate');
    const capEl = document.getElementById('session-goal-caption');

    if (progEl) progEl.textContent = `${done} / ${goal} từ đã chấm`;
    if (pctEl) pctEl.textContent = `${pct}%`;
    if (barEl) barEl.style.width = `${pct}%`;
    if (mEl) mEl.textContent = String(sessionGoalState.mastered);
    if (rEl) rEl.textContent = String(sessionGoalState.review);
    if (rateEl) rateEl.textContent = String(rate);
    if (capEl) {
      if (done >= goal) {
        capEl.textContent = `Đạt chỉ tiêu ${goal} từ phiên này — giữ vững phong độ nhé!`;
      } else if (done > 0) {
        capEl.textContent = `Còn ${goal - done} từ nữa để hoàn thành mục tiêu phiên.`;
      } else {
        capEl.textContent = 'Chấm 1 / 2 / 3 sau khi lật thẻ để tính nhịp học.';
      }
    }
  }

  // --- 7. POPOVERS & EVENT WIRING ---
  function closePopovers(except) {
    document.querySelectorAll('.tot-popover, .tot-kbd-help-wrap').forEach((p) => { if (p !== except) p.classList.remove('open'); });
  }

  function wireUI() {
    applySavedAppearance();

    // Popover triggers
    const bindPop = (btnId, popId, onOpen) => {
      const btn = document.getElementById(btnId);
      const pop = document.getElementById(popId);
      if (!btn || !pop) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        closePopovers(pop);
        const opening = !pop.classList.contains('open');
        pop.classList.toggle('open', opening);
        if (opening && onOpen) onOpen();
      });
    };
    bindPop('btn-skill-trigger', 'skill-popover');
    bindPop('btn-appearance-pop', 'appearance-popover', syncAppearanceButtons);
    bindPop('btn-account-pop', 'account-popover', syncHeaderAndAccount);
    bindPop('btn-card-settings-pop', 'card-settings-wrap', syncStudyFocusWidgets);

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.tot-popover') && !e.target.closest('#card-settings-wrap')) closePopovers();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closePopovers();
    });

    // Appearance controls
    document.querySelectorAll('[data-set-mode]').forEach((b) => b.addEventListener('click', () => setStyleMode(b.dataset.setMode)));
    document.querySelectorAll('[data-set-theme]').forEach((b) => b.addEventListener('click', () => {
      if (typeof window.setThemeMode === 'function') window.setThemeMode(b.dataset.setTheme);
      else html.setAttribute('data-theme', b.dataset.setTheme);
      syncAppearanceButtons();
    }));
    document.querySelectorAll('[data-set-palette]').forEach((b) => b.addEventListener('click', () => setPalette(b.dataset.setPalette)));
    document.querySelectorAll('[data-set-motion]').forEach((b) => b.addEventListener('click', () => setMotion(b.dataset.setMotion)));

    // 4-Tab Nav buttons (Desktop + Mobile Bottom Bar + Home Jump CTAs)
    document.querySelectorAll('[data-tot-view]').forEach((b) => {
      b.addEventListener('click', () => switchView(b.dataset.totView, { fromUser: true }));
    });
    window.addEventListener('popstate', () => {
      const urlView = parseViewFromLocation();
      if (VALID_VIEWS.includes(urlView)) {
        switchView(urlView, { fromUser: false, skipUrlSync: true });
      }
    });

    // Active Skill persistence (Reading | Listening)
    const SKILL_STORAGE_KEY = 'totoro_active_skill_v1';
    let activeSkill = 'Reading';
    let activeMode = 'Overview'; // 'Overview' (Home chung) | 'Reading' | 'Listening'
    try {
      const savedSkill = localStorage.getItem(SKILL_STORAGE_KEY);
      if (savedSkill === 'Listening' || savedSkill === 'Reading') activeSkill = savedSkill;
    } catch (_) {}

    function syncSkillDropdownUI(modeVal) {
      const isGlobal = modeVal === 'Overview';
      document.body.classList.toggle('is-global-home', isGlobal);

      const chipTxt = document.getElementById('header-mode-chip-text');
      if (chipTxt) chipTxt.textContent = isGlobal ? 'Home chung' : modeVal;

      const homeTabLbl = document.getElementById('nav-home-tab-label');
      if (homeTabLbl) homeTabLbl.textContent = 'Tổng quan';

      document.querySelectorAll('#nav-global-skills [data-global-tab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.globalTab === modeVal);
      });

      document.querySelectorAll('[data-tot-skill]').forEach((btn) => {
        const s = btn.dataset.totSkill;
        const isCurrent = s === modeVal;
        btn.classList.toggle('active', isCurrent);
        const tag = btn.querySelector('.tot-tag');
        if (tag && (s === 'Overview' || s === 'Reading' || s === 'Listening')) {
          tag.classList.remove('soon');
          tag.textContent = isCurrent ? 'Đang mở' : 'Sẵn sàng';
        }
      });
    }

    function setActiveSkill(skill, opts = {}) {
      const isOverview = skill === 'Overview' || String(skill || '').toLowerCase() === 'overview';
      if (isOverview) {
        activeMode = 'Overview';
        syncSkillDropdownUI('Overview');
        switchHomeScope('global');
        if (!opts.keepView) switchView('home', { fromUser: false });
        if (!opts.silent) {
          window.__VOCAB_BRIDGE__?.showToast?.('🏠 Đang ở Home chung — Tổng quan Plan, Xếp hạng & 4 kỹ năng');
        }
        return;
      }

      const next = (skill === 'Listening' || String(skill || '').toLowerCase() === 'listening') ? 'Listening' : 'Reading';
      activeSkill = next;
      activeMode = next;
      html.setAttribute('data-skill', next.toLowerCase());
      try { localStorage.setItem(SKILL_STORAGE_KEY, next); } catch (_) {}

      syncSkillDropdownUI(next);
      switchHomeScope(next.toLowerCase());

      const coreId = next.toLowerCase();
      if (window.AppCore?.skills && window.AppCore.skills.getActiveId?.() !== coreId) {
        window.AppCore.skills.switchTo(coreId).then(() => window.AppCore?.renderSkillModesMenu?.()).catch(() => {});
      }

      if (!opts.silent) {
        if (next === 'Listening') {
          window.__VOCAB_BRIDGE__?.showToast?.('🎧 Đã chuyển sang IELTS Listening — 3.864 từ & 131 Task thực chiến!');
        } else {
          window.__VOCAB_BRIDGE__?.showToast?.('📖 Đã chuyển sang IELTS Reading (Reading Home · Flashcard · Task · Practice)');
        }
      }
      if (activeView === 'task') renderInlineTaskHub();
      if (activeView === 'practice') syncPracticeScreen();
      document.dispatchEvent(new CustomEvent('totoro:skill-changed', { detail: { skill: next } }));
    }

    function ensureSkillModeForWorkspace() {
      if (activeMode === 'Overview') {
        setActiveSkill(activeSkill, { silent: true });
      }
    }

    // Skill / Mode options in Topbar dropdown
    document.querySelectorAll('[data-tot-skill]').forEach((b) => {
      b.addEventListener('click', () => {
        const s = b.dataset.totSkill;
        closePopovers();
        if (s === 'Overview') {
          setActiveSkill('Overview', { silent: false });
        } else if (s === 'Reading' || s === 'Listening') {
          setActiveSkill(s, { silent: false });
          if (activeView === 'home') renderHomeDashboard();
        } else {
          window.__VOCAB_BRIDGE__?.showToast?.(`IELTS ${s} đang được hoàn thiện — sắp mở!`);
        }
      });
    });

    // Boot: apply persisted skill engine silently, default Topbar Mode to Overview (Home chung) when on Home
    html.setAttribute('data-skill', activeSkill.toLowerCase());
    const initView = resolveInitialView();
    if (initView === 'home') {
      activeMode = 'Overview';
      syncSkillDropdownUI('Overview');
      switchHomeScope('global');
    } else {
      setActiveSkill(activeSkill, { silent: true });
    }
    window.__TOTORO_SET_SKILL__ = setActiveSkill;
    window.__TOTORO_GET_SKILL__ = () => activeSkill;
    window.__TOTORO_GET_MODE__ = () => activeMode;
    window.__TOTORO_ENSURE_SKILL_MODE__ = ensureSkillModeForWorkspace;

    // Home chart & leaderboard period switches + Practice filter tabs
    document.querySelectorAll('[data-home-chart]').forEach((b) => {
      b.addEventListener('click', () => {
        activeHomeChartPeriod = b.dataset.homeChart;
        document.querySelectorAll('[data-home-chart]').forEach((x) => x.classList.toggle('active', x === b));
        renderHomeDashboard();
      });
    });
    document.querySelectorAll('[data-home-lb]').forEach((b) => {
      b.addEventListener('click', () => {
        activeHomeLbPeriod = b.dataset.homeLb;
        document.querySelectorAll('[data-home-lb]').forEach((x) => x.classList.toggle('active', x === b));
        renderHomeDashboard();
      });
    });
    document.querySelectorAll('[data-practice-filter]').forEach((b) => {
      b.addEventListener('click', () => {
        const f = b.dataset.practiceFilter;
        document.querySelectorAll('[data-practice-filter]').forEach((x) => x.classList.toggle('active', x === b));
        document.querySelectorAll('#practice-cards-grid .tot-exam-card').forEach((card) => {
          card.style.display = (f === 'all' || card.dataset.practiceCat === f) ? '' : 'none';
        });
      });
    });

    // Observe auth-gate visibility, flashcard mastery status, and teacher mode changes cleanly
    const obsConfig = { attributes: true, attributeFilter: ['style', 'class'] };
    const authEl = document.getElementById('auth-gate');
    if (authEl) {
      new MutationObserver(() => {
        syncCinemaRainLoop();
        syncHeaderAndAccount();
      }).observe(authEl, obsConfig);
    }
    const statusEl = document.getElementById('fc-back-status');
    if (statusEl) {
      new MutationObserver(syncFlashcardHankoSeal).observe(statusEl, { attributes: true, childList: true, characterData: true, subtree: true });
    }
    const teacherEl = document.getElementById('screen-teacher');
    if (teacherEl) {
      new MutationObserver(syncHeaderAndAccount).observe(teacherEl, obsConfig);
    }
    const userIdEl = document.getElementById('header-user-id');
    if (userIdEl) {
      new MutationObserver(syncHeaderAndAccount).observe(userIdEl, { childList: true, characterData: true, subtree: true });
    }
    const streakEl = document.getElementById('streak-days-num');
    if (streakEl) {
      new MutationObserver(syncHeaderAndAccount).observe(streakEl, { childList: true, characterData: true, subtree: true });
    }
    const timerDigitsEl = document.getElementById('timer-digits');
    if (timerDigitsEl) {
      new MutationObserver(syncChronographRing).observe(timerDigitsEl, { childList: true, characterData: true, subtree: true });
    }
    const timerStatusEl = document.getElementById('timer-status-text');
    if (timerStatusEl) {
      new MutationObserver(syncChronographRing).observe(timerStatusEl, { childList: true, characterData: true, subtree: true });
    }
    ['stat-count-mastered', 'stat-count-slow', 'stat-count-unlearned', 'stat-count-due', 'top-due-count'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        new MutationObserver(() => {
          syncVocabDonutRing();
          syncStudyFocusWidgets();
        }).observe(el, { childList: true, characterData: true, subtree: true });
      }
    });
    const scopeSel = document.getElementById('study-scope-select');
    if (scopeSel) {
      scopeSel.addEventListener('change', () => {
        syncStudyFocusWidgets();
        syncScopeDropdown();
      });
      initCustomScopeDropdown(scopeSel);
    }
    const autoSpkChk = document.getElementById('chk-auto-speak');
    if (autoSpkChk) {
      autoSpkChk.addEventListener('change', syncStudyFocusWidgets);
    }
    const frontCtxChk = document.getElementById('chk-show-front-context');
    if (frontCtxChk) {
      frontCtxChk.addEventListener('change', syncStudyFocusWidgets);
    }
    const quickFind = document.getElementById('study-quick-find');
    if (quickFind) {
      quickFind.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          if (window.__VOCAB_BRIDGE__?.jumpToCardQuery?.(quickFind.value)) {
            quickFind.blur();
          }
        } else if (e.key === 'Escape') {
          quickFind.value = '';
          quickFind.blur();
        }
      });
    }
    ['btn-widget-autospeak', 'btn-widget-accent-us', 'btn-widget-accent-uk', 'btn-auto-accent-us', 'btn-auto-accent-uk'].forEach((id) => {
      const b = document.getElementById(id);
      if (b) b.addEventListener('click', () => setTimeout(syncStudyFocusWidgets, 25));
    });
    document.querySelectorAll('#widget-four-decks [data-session-goal]').forEach((btn) => {
      btn.addEventListener('click', () => setSessionGoalTarget(btn.dataset.sessionGoal));
    });
    document.addEventListener('vocab:assessed', (ev) => {
      const lvl = ev?.detail?.level;
      sessionGoalState.done += 1;
      if (lvl === 3) sessionGoalState.mastered += 1;
      else sessionGoalState.review += 1;
      syncStudyFocusWidgets();
    });
    // Auto-jump to Flashcard stage whenever a Task study session starts!
    const taskBarEl = document.getElementById('task-study-bar');
    if (taskBarEl) {
      new MutationObserver(() => {
        if (taskBarEl.style.display && taskBarEl.style.display !== 'none' && activeView !== 'flashcard') {
          switchView('flashcard');
        }
      }).observe(taskBarEl, obsConfig);
    }

    // Also sync theme changes triggered from legacy modal-menu
    new MutationObserver(syncAppearanceButtons).observe(html, { attributes: true, attributeFilter: ['data-theme'] });

    window.addEventListener('resize', () => {
      if (isAuthVisible()) {
        initCinemaRain();
        positionLoginCardUnderUmbrella();
      }
    });
    const artImg = document.getElementById('auth-art-img');
    if (artImg) artImg.addEventListener('load', positionLoginCardUnderUmbrella);

    window.addEventListener('reading-practice-updated', () => {
      if (activeView === 'home') renderHomeDashboard();
    });

    syncCinemaRainLoop();
    requestAnimationFrame(positionLoginCardUnderUmbrella);
    syncHeaderAndAccount();
    switchView(resolveInitialView(), { fromUser: false });
    syncFlashcardHankoSeal();
    syncChronographRing();
    syncVocabDonutRing();
    syncStudyFocusWidgets();
    syncScopeDropdown();
  }

  /* --------------------------------------------------------------------------
     CUSTOM TOTORO SCOPE DROPDOWN (Replaces raw native Windows <select> popup
     while staying 100% synced with #study-scope-select for Reading & Listening)
     -------------------------------------------------------------------------- */
  function closeScopeDropdown() {
    const wrap = document.querySelector('#screen-study .scope-select-wrap');
    const trig = document.getElementById('tot-scope-trigger');
    if (wrap) wrap.classList.remove('is-open');
    if (trig) trig.setAttribute('aria-expanded', 'false');
  }

  function syncScopeDropdown() {
    const sel = document.getElementById('study-scope-select');
    const trigLbl = document.getElementById('tot-scope-trigger-label');
    const menu = document.getElementById('tot-scope-menu');
    if (!sel || !trigLbl || !menu) return;

    const selectedOpt = sel.options[sel.selectedIndex] || Array.from(sel.options).find((o) => o.value === sel.value) || sel.options[0];
    trigLbl.textContent = selectedOpt ? selectedOpt.textContent.trim() : 'Chọn bộ từ';

    const curVal = sel.value;
    const parts = [];
    Array.from(sel.children).forEach((child) => {
      if (child.tagName === 'OPTGROUP') {
        const lbl = child.getAttribute('label') || '';
        if (lbl) parts.push(`<div class="tot-scope-group-lbl">${esc(lbl)}</div>`);
        Array.from(child.children).forEach((opt) => {
          const val = opt.value;
          const active = val === curVal;
          parts.push(`
            <button type="button" class="tot-scope-item ${active ? 'is-active' : ''}" role="option" aria-selected="${active ? 'true' : 'false'}" data-scope-val="${esc(val)}">
              <span class="tot-scope-item-txt">${esc(opt.textContent.trim())}</span>
              ${active ? '<svg class="tot-scope-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
            </button>`);
        });
      } else if (child.tagName === 'OPTION') {
        const val = child.value;
        const active = val === curVal;
        parts.push(`
          <button type="button" class="tot-scope-item ${active ? 'is-active' : ''}" role="option" aria-selected="${active ? 'true' : 'false'}" data-scope-val="${esc(val)}">
            <span class="tot-scope-item-txt">${esc(child.textContent.trim())}</span>
            ${active ? '<svg class="tot-scope-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
          </button>`);
      }
    });
    menu.innerHTML = parts.join('');
    menu.querySelectorAll('.tot-scope-item').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const nextVal = btn.getAttribute('data-scope-val');
        if (nextVal != null && sel.value !== nextVal) {
          sel.value = nextVal;
          sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
        closeScopeDropdown();
        syncScopeDropdown();
      });
    });
  }

  function initCustomScopeDropdown(sel) {
    const wrap = sel.closest('.scope-select-wrap');
    if (!wrap || wrap.dataset.customInit === '1') return;
    wrap.dataset.customInit = '1';
    wrap.classList.add('has-custom-scope');
    sel.classList.add('is-native-hidden');

    const trig = document.createElement('button');
    trig.type = 'button';
    trig.id = 'tot-scope-trigger';
    trig.className = 'tot-scope-trigger';
    trig.setAttribute('aria-haspopup', 'listbox');
    trig.setAttribute('aria-expanded', 'false');
    trig.innerHTML = `
      <span class="tot-scope-trigger-label" id="tot-scope-trigger-label">Chọn bộ từ</span>
      <svg class="tot-scope-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
    `;

    const menu = document.createElement('div');
    menu.id = 'tot-scope-menu';
    menu.className = 'tot-scope-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', 'Chọn bộ từ vựng');

    wrap.appendChild(trig);
    wrap.appendChild(menu);

    trig.addEventListener('click', (e) => {
      e.stopPropagation();
      syncScopeDropdown();
      const willOpen = !wrap.classList.contains('is-open');
      closePopovers();
      wrap.classList.toggle('is-open', willOpen);
      trig.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    });

    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) closeScopeDropdown();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeScopeDropdown();
    });

    new MutationObserver(syncScopeDropdown).observe(sel, { childList: true, subtree: true });
    syncScopeDropdown();
  }

  window.TotoroUI = {
    switchView,
    switchHomeScope,
    openGlobalHome: () => {
      if (typeof window.__TOTORO_SET_SKILL__ === 'function') {
        window.__TOTORO_SET_SKILL__('Overview', { silent: true });
      } else {
        switchHomeScope('global');
        switchView('home', { fromUser: false });
      }
    },
    enterSkillMode: (skill, viewName = 'home') => {
      if (typeof window.__TOTORO_SET_SKILL__ === 'function') {
        window.__TOTORO_SET_SKILL__(skill, { silent: true });
      }
      switchView(viewName, { fromUser: true });
    },
    getActiveHomeScope: () => activeHomeScope,
    getActiveMode: () => (typeof window.__TOTORO_GET_MODE__ === 'function' ? window.__TOTORO_GET_MODE__() : 'Overview'),
    getActiveView: () => activeView,
    getActiveSkill: () => (typeof window.__TOTORO_GET_SKILL__ === 'function' ? window.__TOTORO_GET_SKILL__() : (html.getAttribute('data-skill') === 'listening' ? 'Listening' : 'Reading')),
    setActiveSkill: (skill, opts) => (typeof window.__TOTORO_SET_SKILL__ === 'function' ? window.__TOTORO_SET_SKILL__(skill, opts) : undefined),
    onUserEntered,
    setStyleMode,
    setPalette,
    setMotion,
    renderHomeDashboard,
    togglePlanEditor,
    saveStudyPlan,
    renderInlineTaskHub,
    syncStudyFocusWidgets,
    syncScopeDropdown,
    closeScopeDropdown,
    toggleFrontContextFromWidget,
    setSessionGoalTarget,
    switchTaskSuite: (suiteKey) => { activeInlineTaskSuite = suiteKey; renderInlineTaskHub(); },
    notifySkillSoon: (label) => { window.__VOCAB_BRIDGE__?.showToast?.(`${label} đang được hoàn thiện — sắp mở!`); },
    syncHeaderAndAccount,
    closePopovers,
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUI);
  else wireUI();
})();
