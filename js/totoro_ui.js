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

    if (activeView === 'home') renderHomeDashboard();
    if (activeView === 'task') renderInlineTaskHub();
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
    if (modeChip && /95[,.]5%/.test(modeChip.textContent || '')) {
      modeChip.textContent = modeChip.textContent.replace(/\s*95[,.]5%/g, '').trim() || 'Reading';
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

  function renderHomeDashboard() {
    const modeChip = document.getElementById('header-mode-chip-text');
    if (modeChip && /95[,.]5%/.test(modeChip.textContent || '')) {
      modeChip.textContent = modeChip.textContent.replace(/\s*95[,.]5%/g, '').trim() || 'Reading';
    }
    const snap = getRealStudentSnapshot();
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

    // Daily goal ring
    const goalMins = 30;
    const goalPct = Math.min(100, Math.round(((Math.min(snap.todayMins, goalMins) / goalMins) * 0.6 + (snap.completedTasks.length > 0 ? 0.4 : 0)) * 100));
    setTxt('home-goal-pct', `${goalPct}%`);
    const ring = document.getElementById('home-goal-arc');
    if (ring) ring.setAttribute('stroke-dashoffset', String(201 * (1 - goalPct / 100)));
    setTxt('home-goal-mastered', snap.mastered.toLocaleString('vi-VN'));
    setTxt('home-goal-tasks', `${snap.completedTasks.length}`);
    setTxt('home-goal-mins', `${snap.todayMins}/${goalMins}p`);

    // Reading skill card stats
    setTxt('home-reading-sub', `${snap.mastered.toLocaleString('vi-VN')} từ · ${snap.completedTasks.length}/110 Tasks`);
    setTxt('home-reading-pct', `${snap.masteryPct}%`);
    const rBarOk = document.getElementById('home-reading-bar-ok');
    if (rBarOk) rBarOk.style.width = `${snap.masteryPct}%`;

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
      let totalMins = 0, activeUnits = 0, targetLabel = 'Mục tiêu 30p';

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

    // Recent Tasks History (Exact demo_v3 .tot-hist-row + .tot-hist-badge)
    const histEl = document.getElementById('home-history-list');
    if (histEl) {
      const recent = snap.completedTasks.slice(0, 5);
      histEl.innerHTML = recent.length
        ? recent.map(([tid, info]) => {
            const taskObj = (window.APP_TASKS_DATA?.tasks || []).find((t) => t.id === tid);
            const label = taskObj ? `${taskObj.label} · ${taskObj.theme || ''}` : tid.toUpperCase();
            const score = info.recognitionScore != null ? `${info.recognitionScore}% · Đạt` : `${info.translationScore ?? '--'} / 10`;
            const dt = info.updatedAt ? new Date(info.updatedAt).toLocaleDateString('vi-VN') : 'Đã nộp';
            return `
              <div class="tot-hist-row">
                <div style="min-width:0;overflow:hidden;">
                  <div style="font-size:13px;font-weight:750;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(label)}</div>
                  <div style="font-size:11px;color:var(--ink-3);font-weight:500;">${esc(dt)}</div>
                </div>
                <span class="tot-hist-badge tabular">${esc(score)}</span>
              </div>
            `;
          }).join('')
        : '<div style="font-size:12.5px;color:var(--ink-3);padding:12px 0;">Bạn chưa hoàn thành Task nào. Chọn tab Task để bắt đầu nhé!</div>';
      setTxt('home-history-total', `${snap.completedTasks.length} bài`);
    }
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

    // Skill options
    document.querySelectorAll('[data-tot-skill]').forEach((b) => {
      b.addEventListener('click', () => {
        const s = b.dataset.totSkill;
        closePopovers();
        if (s === 'Reading') {
          window.__VOCAB_BRIDGE__?.showToast?.('Đang học: IELTS Reading (4.489 họ từ)');
        } else {
          window.__VOCAB_BRIDGE__?.showToast?.(`IELTS ${s} đang được hoàn thiện — sắp mở!`);
        }
      });
    });

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
      scopeSel.addEventListener('change', syncStudyFocusWidgets);
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

    syncCinemaRainLoop();
    requestAnimationFrame(positionLoginCardUnderUmbrella);
    syncHeaderAndAccount();
    switchView(resolveInitialView(), { fromUser: false });
    syncFlashcardHankoSeal();
    syncChronographRing();
    syncVocabDonutRing();
    syncStudyFocusWidgets();
  }

  window.TotoroUI = {
    switchView,
    getActiveView: () => activeView,
    onUserEntered,
    setStyleMode,
    setPalette,
    setMotion,
    renderHomeDashboard,
    renderInlineTaskHub,
    syncStudyFocusWidgets,
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
