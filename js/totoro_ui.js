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
  const THEME_PREF_KEY = 'ielts_totoro_theme_pref_v1';
  const FONT_SCALE_KEY = 'ielts_totoro_font_scale_v1';
  const DAILY_LOG_KEY_BASE = 'totoro_daily_log_v1_';
  const ACTIVE_VIEW_SESSION_KEY = 'ielts_totoro_active_view_v1';
  const VALID_VIEWS = ['home', 'flashcard', 'task', 'practice'];
  let activeListeningPracticeSub = 'exams'; // 'exams' | 'dictation'
  let systemThemeMediaBound = false;

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

  function detectSkillFromUrlTaskParam() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const raw = (sp.get('task') || sp.get('wtask') || (sp.get('tasks') || '').split(',')[0] || '').trim();
      if (!raw) return '';
      if (/^(?:lp|lp_full):/i.test(raw) || /^(lp\d|lmap|lcf|lcore|ltask)_/i.test(raw)) return 'Listening';
      if (/^wp:/i.test(raw) || /^w_/i.test(raw)) return 'Writing';
      if (/^sp:/i.test(raw) || /^sp_/i.test(raw)) return 'Speaking';
      if (/^(?:rp|rp_full):/i.test(raw) || /^(task|fnd|acd|adv)_\d+$/i.test(raw) || /^\d{1,2}$/.test(raw)) return 'Reading';
    } catch (_) {}
    return '';
  }

  function resolveInitialView() {
    try {
      const sp = new URLSearchParams(window.location.search || '');
      const tParam = `${sp.get('task') || ''},${sp.get('tasks') || ''}`;
      if (/\b(?:rp|rp_full|lp|lp_full|wp|sp):/i.test(tParam)) return 'practice';
      if (sp.get('task') || sp.get('tasks') || sp.get('wtask') || sp.get('adminTest')) {
        const urlSk = detectSkillFromUrlTaskParam();
        if (urlSk === 'Listening' || urlSk === 'Speaking') return 'task';
        return 'flashcard';
      }
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

  // --- 1. PERSISTED APPEARANCE ENGINE (Calm/Vibrant x Light/Dark/Auto x Font Scale x 5 Palettes x 4 Motions) ---
  function resolveSystemTheme() {
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch (_) {
      return 'light';
    }
  }

  function getStoredThemePref() {
    try {
      const pref = localStorage.getItem(THEME_PREF_KEY);
      if (pref === 'light' || pref === 'dark' || pref === 'auto') return pref;
    } catch (_) {}
    return html.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  function applyThemePreference(pref, silent = false) {
    const clean = (pref === 'dark' || pref === 'auto') ? pref : 'light';
    try { localStorage.setItem(THEME_PREF_KEY, clean); } catch (_) {}
    const resolved = clean === 'auto' ? resolveSystemTheme() : clean;
    html.setAttribute('data-theme', resolved);
    try { localStorage.setItem('ielts_theme_v1', resolved); } catch (_) {}
    if (!silent) {
      const lbl = clean === 'auto' ? `Theo máy (${resolved === 'dark' ? 'Tối' : 'Sáng'})` : (clean === 'dark' ? 'Tối' : 'Sáng');
      window.__VOCAB_BRIDGE__?.showToast?.(`Chế độ hiển thị: ${lbl}`);
    }
    syncAppearanceButtons();
  }

  function setFontScale(scale, silent = false) {
    const clean = ['sm', 'md', 'lg'].includes(scale) ? scale : 'md';
    if (clean === 'md') delete html.dataset.fontScale;
    else html.dataset.fontScale = clean;
    try { localStorage.setItem(FONT_SCALE_KEY, clean); } catch (_) {}
    syncAppearanceButtons();
    if (!silent) {
      const lbl = { sm: 'Nhỏ (92%)', md: 'Vừa (100%)', lg: 'Lớn (110%)' }[clean];
      window.__VOCAB_BRIDGE__?.showToast?.(`Cỡ chữ đọc bài: ${lbl}`);
    }
  }

  function applySavedAppearance() {
    let mode = 'calm', palette = 'auto', motion = 'pro', fontScale = 'md';
    try {
      mode = localStorage.getItem(MODE_KEY) || 'calm';
      palette = localStorage.getItem(PALETTE_KEY) || 'auto';
      motion = localStorage.getItem(MOTION_KEY) || 'pro';
      fontScale = localStorage.getItem(FONT_SCALE_KEY) || 'md';
    } catch (_) {}
    html.dataset.mode = (mode === 'vibrant') ? 'vibrant' : 'calm';
    if (palette && palette !== 'auto') html.dataset.palette = palette;
    else delete html.dataset.palette;
    html.dataset.motion = ['pro', 'classic', 'morph', 'original'].includes(motion) ? motion : 'pro';
    setFontScale(fontScale, true);

    const themePref = getStoredThemePref();
    if (themePref === 'auto') {
      html.setAttribute('data-theme', resolveSystemTheme());
    }
    if (!systemThemeMediaBound && window.matchMedia) {
      systemThemeMediaBound = true;
      try {
        const mq = window.matchMedia('(prefers-color-scheme: dark)');
        const onChange = () => {
          if (getStoredThemePref() === 'auto') {
            html.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
            syncAppearanceButtons();
          }
        };
        if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onChange);
        else if (typeof mq.addListener === 'function') mq.addListener(onChange);
      } catch (_) {}
    }
    syncAppearanceButtons();
  }

  function syncAppearanceButtons() {
    const mode = html.dataset.mode || 'calm';
    const themePref = getStoredThemePref();
    const pal = html.dataset.palette || 'auto';
    const motion = html.dataset.motion || 'pro';
    const fontScale = html.dataset.fontScale || 'md';
    document.querySelectorAll('[data-set-mode]').forEach((b) => b.classList.toggle('active', b.dataset.setMode === mode));
    document.querySelectorAll('[data-set-theme]').forEach((b) => b.classList.toggle('active', b.dataset.setTheme === themePref));
    document.querySelectorAll('[data-set-font]').forEach((b) => b.classList.toggle('active', b.dataset.setFont === fontScale));
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

  function closeOrphanModalsOnNav() {
    document.querySelectorAll('.modal-overlay.open').forEach((m) => {
      if (m.id === 'modal-multitab-block' || m.id === 'modal-cheat-warn') return;
      m.classList.remove('open');
    });
    document.getElementById('modal-student-all-hw')?.remove();
    document.getElementById('modal-practice-assign')?.remove();
  }

  // --- 3. 4-TAB NAVIGATION (HOME | FLASHCARD | TASK | PRACTICE) ---
  function switchView(viewName, opts = {}) {
    const B = window.__VOCAB_BRIDGE__;
    const teacherScreen = document.getElementById('screen-teacher');
    const teacherActive = teacherScreen && teacherScreen.style.display !== 'none' && getComputedStyle(teacherScreen).display !== 'none';
    if (teacherActive && B?.isTeacherUser?.()) return;
    if (opts.fromUser) closeOrphanModalsOnNav();

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
    if (activeView === 'flashcard') {
      if (html.getAttribute('data-skill') === 'writing') {
        window.WritingStudio?.renderFlashcardWorkspace?.();
      } else if (html.getAttribute('data-skill') === 'speaking') {
        window.SpeakingStudio?.renderFlashcardWorkspace?.();
      } else if (opts.fromUser && prevView !== 'flashcard' && B?.getCurrentUser?.() && B?.isAutoSpeakOn?.()) {
        B?.speakCurrentWord?.();
      }
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
      modeChip.textContent = curMode === 'Overview' ? 'HOME' : String(curMode).toUpperCase();
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
    const clsInfo = B?.getActiveClassInfo?.();
    const clsSuffix = clsInfo?.name ? ` · ${clsInfo.name}` : '';
    setTxt('pop-acc-id', `Mã ID: ${upperId} · ${u.role === 'teacher' ? 'Giáo viên' : 'Học viên'}${clsSuffix}`);
    setTxt('hdr-streak-days', `${snap.streak} ngày`);
    setTxt('pop-stat-streak', `${snap.streak} ngày`);
    setTxt('pop-stat-rank', snap.meWeek ? `#${snap.meWeek.rank}` : '—');
    setTxt('pop-stat-mastered', snap.mastered.toLocaleString('vi-VN'));
  }

  function getChestnutUnitHtml() {
    return `<span class="tot-chestnut-unit" aria-label="hạt dẻ điểm" title="Hạt dẻ điểm"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 2.4C13 4.6 19.8 8.2 21 13.8C21.8 17.6 18.6 21 12 21C5.4 21 2.2 17.6 3 13.8C4.2 8.2 11 4.6 12 2.4Z" fill="#8B3A14" stroke="#531F07" stroke-width="1.4" stroke-linejoin="round"/><path d="M5 17.5C7 15.8 17 15.8 19 17.5C17.6 19.9 15 20.8 12 20.8C9 20.8 6.4 19.9 5 17.5Z" fill="#E8CCA0"/><path d="M7.2 12.2C7.8 9.6 9.8 7.8 11.4 6.6" stroke="#DF8B56" stroke-width="1.6" stroke-linecap="round" opacity=".85"/><path d="M12 4.8V15.4M8.5 8.5C7.9 11 7.8 13.2 8.2 15.6M15.5 8.5C16.1 11 16.2 13.2 15.8 15.6" stroke="#5E2409" stroke-width="0.9" stroke-linecap="round" opacity=".45"/></svg></span>`;
  }

  const STUDY_PLAN_KEY_BASE = 'totoro_study_plan_v1_';

  function getTodayDateKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function getDailyLogKey(uidInput) {
    const uid = String(uidInput || window.__VOCAB_BRIDGE__?.getCurrentUser?.()?.id || 'guest').toLowerCase();
    return DAILY_LOG_KEY_BASE + uid;
  }

  function readDailyLog(uidInput) {
    const today = getTodayDateKey();
    try {
      const raw = localStorage.getItem(getDailyLogKey(uidInput));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today) {
          return {
            date: today,
            words: Number(parsed.words) || 0,
            mastered: Number(parsed.mastered) || 0,
            dictation: Number(parsed.dictation) || 0,
            exercises: Number(parsed.exercises) || 0,
          };
        }
      }
    } catch (_) {}
    return { date: today, words: 0, mastered: 0, dictation: 0, exercises: 0 };
  }

  function recordDailyActivity(patch = {}, uidInput) {
    const cur = readDailyLog(uidInput);
    const next = {
      date: cur.date,
      words: cur.words + (Number(patch.words) || 0),
      mastered: cur.mastered + (Number(patch.mastered) || 0),
      dictation: cur.dictation + (Number(patch.dictation) || 0),
      exercises: cur.exercises + (Number(patch.exercises) || 0),
    };
    try { localStorage.setItem(getDailyLogKey(uidInput), JSON.stringify(next)); } catch (_) {}
    if (activeView === 'home') renderHomeDashboard();
    return next;
  }

  function getStudyPlan(uidInput) {
    const uid = String(uidInput || window.__VOCAB_BRIDGE__?.getCurrentUser?.()?.id || 'guest').toLowerCase();
    const defaults = { targetBand: '7.5', examDate: '', dailyMins: 30, dailyWords: 20, focusSkill: 'all' };
    try {
      const raw = localStorage.getItem(STUDY_PLAN_KEY_BASE + uid);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          targetBand: ['6.0', '6.5', '7.0', '7.5', '8.0', '8.5'].includes(String(parsed.targetBand)) ? String(parsed.targetBand) : defaults.targetBand,
          examDate: typeof parsed.examDate === 'string' ? parsed.examDate : '',
          dailyMins: [15, 30, 45, 60, 90].includes(Number(parsed.dailyMins)) ? Number(parsed.dailyMins) : defaults.dailyMins,
          dailyWords: [10, 20, 30, 50].includes(Number(parsed.dailyWords)) ? Number(parsed.dailyWords) : defaults.dailyWords,
          focusSkill: ['all', 'rl', 'wd'].includes(String(parsed.focusSkill)) ? String(parsed.focusSkill) : defaults.focusSkill,
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
      const fEl = document.getElementById('plan-input-focus');
      if (bEl) bEl.value = plan.targetBand;
      if (dEl) dEl.value = plan.examDate;
      if (mEl) mEl.value = String(plan.dailyMins);
      if (wEl) wEl.value = String(plan.dailyWords);
      if (fEl) fEl.value = plan.focusSkill || 'all';
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
      focusSkill: document.getElementById('plan-input-focus')?.value || 'all',
    };
    try { localStorage.setItem(STUDY_PLAN_KEY_BASE + uid, JSON.stringify(plan)); } catch (_) {}
    togglePlanEditor(false);
    renderHomeDashboard();
    window.__VOCAB_BRIDGE__?.showToast?.(`Đã lưu mục tiêu Band ${plan.targetBand} · ${plan.dailyMins}p & ${plan.dailyWords} từ/ngày!`);
  }

  function countTodayCrossSkillExercises(snap, todayTs, dailyLog) {
    const uid = snap.uid || 'guest';
    const readRp = (window.ReadingPracticeStore?.getHistory?.() || []).filter((h) => (h.submittedAt || 0) >= todayTs).length;
    const readTask = snap.completedTasks.filter(([, info]) => (info?.updatedAt || 0) >= todayTs).length;

    const listenProg = window.ListeningTasksModule?.getProgressMap?.() || {};
    const listenTask = Object.values(listenProg).filter((p) => p && p.completed && (p.updatedAt || 0) >= todayTs).length;

    let listenPrac = 0;
    try {
      const lpRaw = localStorage.getItem(`ielts_listening_practice_v1_${uid}`);
      if (lpRaw) {
        const lp = JSON.parse(lpRaw);
        listenPrac = (lp?.history || []).filter((h) => (h.submittedAt || h.completedAt || 0) >= todayTs).length;
      }
    } catch (_) {}

    let writingCount = 0;
    try {
      const wpRaw = localStorage.getItem(`totoro_writing_prac_hist_v1_${uid}`);
      if (wpRaw) {
        const wp = JSON.parse(wpRaw);
        writingCount += (Array.isArray(wp) ? wp : []).filter((h) => (h.completedAt || 0) >= todayTs).length;
      }
      const wtRaw = localStorage.getItem(`totoro_writing_task_prog_v1_${uid}`);
      if (wtRaw) {
        const wt = JSON.parse(wtRaw);
        writingCount += Object.values(wt || {}).filter((v) => v && v.completed && (v.updatedAt || 0) >= todayTs).length;
      }
    } catch (_) {}

    const dictDone = (window.DictationStudio?.getTodayDoneCount?.() || 0) + (dailyLog?.dictation || 0);
    return readRp + readTask + listenTask + listenPrac + writingCount + Math.min(dictDone, 5) + (dailyLog?.exercises || 0);
  }

  function renderHomePlanAndMonitor(snap, plan) {
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const rpStats = window.ReadingPracticeStore?.getSummaryStats?.() || {
      attemptsCount: 0, completedUnique: 0, avgBand: 0, totalMins: 0, recent: []
    };

    // 1. Target Band & Exam Countdown Card (with Exam-Aware Pacing & Sprint Mode <=14d)
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
    let countdownSub = 'Đặt ngày thi để tự tính nhịp học';
    let diffDays = null;
    let isSprintMode = false;
    if (plan.examDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const targetDt = new Date(`${plan.examDate}T00:00:00`);
      if (!Number.isNaN(targetDt.getTime())) {
        diffDays = Math.ceil((targetDt.getTime() - today.getTime()) / 86400000);
        if (diffDays > 0) {
          daysText = `${diffDays} ngày`;
          countdownSub = `Dự thi ${targetDt.toLocaleDateString('vi-VN')} · còn ${diffDays} ngày`;
          isSprintMode = diffDays <= 14;
        } else if (diffDays === 0) {
          daysText = 'Hôm nay';
          countdownSub = 'Ngày thi IELTS đã đến — chúc bạn tự tin!';
          isSprintMode = true;
        } else {
          daysText = 'Đã qua';
          countdownSub = 'Ngày thi cũ đã qua — cập nhật lịch thi mới';
        }
      }
    }
    setTxt('home-days-left-val', daysText);
    setTxt('home-target-countdown', countdownSub);

    const paceEl = document.getElementById('home-target-pace');
    if (paceEl) {
      let paceHtml = `Nhịp mục tiêu: ${plan.dailyMins} phút · ${plan.dailyWords} từ / ngày`;
      if (diffDays !== null && diffDays > 0) {
        const weeksLeft = Math.max(1, Math.ceil(diffDays / 7));
        const gap = Math.max(0.5, +(targetNum - (estBand || 5.5)).toFixed(1));
        const weeklyTests = Math.min(14, Math.max(3, Math.ceil((gap * 4) / weeksLeft) + 2));
        paceHtml = `Đề xuất: ~${weeklyTests} bài/tuần (${plan.dailyMins}p · ${plan.dailyWords} từ/ngày)`;
        if (isSprintMode) {
          paceHtml += `<div><span class="tot-sprint-badge">⚡ Chế độ Nước rút · Ưu tiên đề bấm giờ &amp; ôn lỗi sai</span></div>`;
        }
      }
      paceEl.innerHTML = paceHtml;
    }

    // 2. Daily Study Plan Checklist (100% True Today Progress + Cross-Skill + Smart CTA)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayTs = todayStart.getTime();
    const dailyLog = readDailyLog(snap.uid);
    const todayExercises = countTodayCrossSkillExercises(snap, todayTs, dailyLog);
    const todayWords = Math.max(dailyLog.words || 0, sessionGoalState?.done || 0);

    // Smart CTA routing for Exercise Row based on Focus Skill & Sprint Mode
    let exTitle = isSprintMode
      ? 'Nước rút: Làm 1 đề bấm giờ (Reading / Listening / Writing)'
      : 'Hoàn thành 1 bài luyện tập (4 kỹ năng)';
    let exAction = "window.TotoroUI?.enterSkillMode('Reading', 'practice')";
    if (plan.focusSkill === 'wd') {
      exTitle = isSprintMode
        ? 'Nước rút: 1 bài Writing hoặc 1 bài Dictation'
        : 'Hoàn thành 1 bài Writing / Listening Dictation';
      exAction = "window.TotoroUI?.openDictationStudio()";
    } else if (plan.focusSkill === 'rl') {
      exTitle = isSprintMode
        ? 'Nước rút: Làm 1 đề Reading / Listening bấm giờ'
        : 'Hoàn thành 1 bài Reading / Listening Practice';
      exAction = "window.TotoroUI?.enterSkillMode('Reading', 'practice')";
    }

    const vocabTitle = snap.due > 0
      ? `Ôn thẻ SRS đến hạn (${snap.due} thẻ chờ)`
      : 'Ôn & học từ vựng mới hôm nay';
    const vocabAction = "window.TotoroUI?.enterSkillMode('Reading', 'flashcard')";

    const items = [
      {
        title: vocabTitle,
        meta: `${todayWords}/${plan.dailyWords} từ`,
        pct: Math.min(100, Math.round((todayWords / Math.max(1, plan.dailyWords)) * 100)),
        done: todayWords >= plan.dailyWords,
        action: vocabAction,
        tone: 'is-vocab',
        ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
      },
      {
        title: 'Tập trung thực học',
        meta: `${snap.todayMins}/${plan.dailyMins} phút`,
        pct: Math.min(100, Math.round((snap.todayMins / Math.max(1, plan.dailyMins)) * 100)),
        done: snap.todayMins >= plan.dailyMins,
        action: "window.TotoroUI?.enterSkillMode(window.TotoroUI?.getActiveSkill?.() || 'Reading', 'flashcard')",
        tone: 'is-focus',
        ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5"/><path d="M9 2h6"/></svg>',
      },
      {
        title: exTitle,
        meta: `${todayExercises}/1 bài`,
        pct: todayExercises >= 1 ? 100 : 0,
        done: todayExercises >= 1,
        action: exAction,
        tone: 'is-practice',
        ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="m9 15 2 2 4-4"/></svg>',
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
          <span class="tot-plan-ico ${it.tone}" aria-hidden="true">${it.ico}</span>
          <span class="tot-plan-row-body">
            <span class="tot-plan-row-top">
              <span class="tot-plan-row-title">${esc(it.title)}</span>
              <span class="tot-plan-row-right">
                <strong class="tot-plan-row-meta tabular">${esc(it.meta)}</strong>
                <span class="tot-plan-chk" aria-hidden="true">${it.done ? '✓' : '→'}</span>
              </span>
            </span>
            <span class="tot-plan-mini-bar"><span style="width:${it.pct}%"></span></span>
          </span>
        </button>
      `).join('');
    }

    // Sync Target Band Semicircular SVG Gauge
    const arcEl = document.getElementById('home-target-arc');
    if (arcEl) {
      const targetBarW = parseFloat(document.getElementById('home-target-bar')?.style?.width || '0') || 0;
      const visualPct = Math.max(12, Math.min(100, targetBarW || Math.round((Number(plan.targetBand || 7.5) / 9) * 100 * 0.25)));
      arcEl.setAttribute('stroke-dashoffset', (163.4 * (1 - visualPct / 100)).toFixed(1));
    }

    // Return true today goal percentage synced 1:1 with the 3 checklist items!
    const trueGoalPct = Math.round(items.reduce((acc, it) => acc + it.pct, 0) / Math.max(1, items.length));

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
    const wsStats = window.WritingStudio?.getOverallStats?.() || { masteredCards: 0, totalCards: 0, cardPct: 0, tasksDone: 0, tasksTotal: 44, taskPct: 0 };
    const writePct = Math.min(100, Math.round(((Number(wsStats.cardPct) || 0) * 0.5) + ((Number(wsStats.taskPct) || 0) * 0.5)));
    const spStats = window.SpeakingStudio?.getOverallStats?.() || { masteredCards: 0, totalCards: 0, cardPct: 0, tasksDone: 0, tasksTotal: 20, taskPct: 0 };
    const speakPct = Math.min(100, Math.round(((Number(spStats.cardPct) || 0) * 0.5) + ((Number(spStats.taskPct) || 0) * 0.5)));
    const overallPct = Math.min(100, Math.round((snap.masteryPct + readTaskPct + readPracPct + listenPct + writePct + speakPct) / 6));

    const isRestricted = Boolean(window.AccessPolicy?.isRestricted?.());
    const pTaskStats = window.PersonalTaskEngine?.getStats?.() || { total: 1, done: 0 };
    const myVocabCnt = window.MyVocabStore?.getTotalWordCount?.() || 0;
    const myTaskPct = Math.round((pTaskStats.done / Math.max(1, pTaskStats.total)) * 100);

    setTxt('home-monitor-overall-pct', `${overallPct}%`);
    setTxt(
      'home-monitor-summary',
      isRestricted
        ? `${myVocabCnt.toLocaleString('vi-VN')} từ MY LIST · ${pTaskStats.done}/${pTaskStats.total} Task tự tạo · ${rpStats.completedUnique} đề Reading · ${wsStats.practiceDone || 0} đề Writing`
        : `${snap.mastered.toLocaleString('vi-VN')} từ Reading · ${listenVocabDone.toLocaleString('vi-VN')} từ Listening · ${wsStats.tasksDone}/${wsStats.tasksTotal} Writing · ${spStats.tasksDone}/${spStats.tasksTotal} Speaking`
    );

    const barsEl = document.getElementById('home-monitor-bars');
    if (barsEl) {
      const meters = isRestricted ? [
        { label: 'MY LIST + Demo Vocab', val: `${myVocabCnt.toLocaleString('vi-VN')} từ cá nhân · 1 bộ Demo`, pct: Math.min(100, myVocabCnt * 2), cls: 'is-sage', tone: 'is-reading', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', action: "window.TotoroUI?.enterSkillMode('Reading', 'flashcard')" },
        { label: 'Task Tự Tạo (Từ MY LIST)', val: `${pTaskStats.done} / ${pTaskStats.total} Task`, pct: myTaskPct, cls: 'is-warm', tone: 'is-reading', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>', action: "window.TotoroUI?.enterSkillMode('Reading', 'task')" },
        { label: 'Luyện đề Reading', val: rpStats.avgBand ? `${rpStats.completedUnique} bài · Band ${rpStats.avgBand.toFixed(1)}` : `${rpStats.completedUnique} bài đã nộp`, pct: readPracPct, cls: 'is-emerald', tone: 'is-reading', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>', action: "window.TotoroUI?.enterSkillMode('Reading', 'practice')" },
        { label: 'Luyện đề Listening & Dictation', val: `133 Full Đề nghe · Dictation`, pct: listenPct, cls: 'is-indigo', tone: 'is-listening', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>', action: "window.TotoroUI?.enterSkillMode('Listening', 'practice')" },
        { label: 'Luyện đề Writing (T1·T2·Full)', val: `${wsStats.practiceDone || 0} / ${(window.WRITING_TASK1_DATA?.TASK1_PROMPTS?.length || 28) + (wsStats.practiceTotal || 57)} đề`, pct: writePct, cls: 'is-sage', tone: 'is-writing', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>', action: "window.TotoroUI?.enterSkillMode('Writing', 'practice')" },
        { label: 'Luyện đề Speaking (P1–P3 & Full)', val: `${(window.SPEAKING_PART13_DATA?.FULL_TESTS?.length || 24)} Full · 72 Part Cam 15–20`, pct: speakPct, cls: 'is-warm', tone: 'is-speaking', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>', action: "window.TotoroUI?.enterSkillMode('Speaking', 'practice')" },
      ] : [
        { label: 'Từ vựng Reading', val: `${snap.mastered.toLocaleString('vi-VN')} / ${snap.totalFamilies.toLocaleString('vi-VN')}`, pct: snap.masteryPct, cls: 'is-sage', tone: 'is-reading', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>', action: "window.TotoroUI?.enterSkillMode('Reading', 'flashcard')" },
        { label: 'Reading Tasks', val: `${snap.completedTasks.length} / 110 bài`, pct: readTaskPct, cls: 'is-warm', tone: 'is-reading', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.3 2.3 4.8-5"/></svg>', action: "window.TotoroUI?.enterSkillMode('Reading', 'task')" },
        { label: 'Luyện đề Reading', val: rpStats.avgBand ? `${rpStats.completedUnique} bài · Band ${rpStats.avgBand.toFixed(1)}` : `${rpStats.completedUnique} bài đã nộp`, pct: readPracPct, cls: 'is-emerald', tone: 'is-reading', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>', action: "window.TotoroUI?.enterSkillMode('Reading', 'practice')" },
        { label: 'Listening & Dictation', val: `${listenVocabDone.toLocaleString('vi-VN')} từ · ${listenTasksDone}/${listenTasksTotal} Task`, pct: listenPct, cls: 'is-indigo', tone: 'is-listening', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>', action: "window.TotoroUI?.enterSkillMode('Listening', 'home')" },
        { label: 'Writing & Flow Ideas', val: `${wsStats.masteredCards} thẻ · ${wsStats.tasksDone}/${wsStats.tasksTotal} Task`, pct: writePct, cls: 'is-sage', tone: 'is-writing', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>', action: "window.TotoroUI?.enterSkillMode('Writing', 'home')" },
        { label: 'Speaking & Mindmap', val: `${spStats.masteredCards} cụm · ${spStats.tasksDone}/${spStats.tasksTotal} Task`, pct: speakPct, cls: 'is-warm', tone: 'is-speaking', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>', action: "window.TotoroUI?.enterSkillMode('Speaking', 'home')" },
      ];
      barsEl.innerHTML = meters.map((m) => `
        <button type="button" class="tot-mon-meter tot-mon-meter-btn" onclick="${m.action}">
          <span class="tot-mon-ico ${m.tone}" aria-hidden="true">${m.ico}</span>
          <span class="tot-mon-body">
            <span class="tot-mon-meter-head">
              <span>${esc(m.label)}</span>
              <strong class="tabular">${esc(m.val)}</strong>
            </span>
            <span class="tot-mastery-bar"><span class="tot-mon-fill ${m.cls}" style="width:${Math.max(m.pct > 0 ? 3 : 0, m.pct)}%"></span></span>
          </span>
        </button>
      `).join('');

      const showcaseEl = document.getElementById('home-skills-showcase');
      if (showcaseEl) {
        const readCombinedPct = Math.round((snap.masteryPct + readTaskPct) / 2);
        const readRingPct = rpStats.avgBand ? Math.min(100, Math.round((rpStats.avgBand / 9) * 100)) : readCombinedPct;
        const cards = [
          {
            key: 'reading',
            name: 'Reading',
            sub: isRestricted ? 'MY LIST · Task tự tạo' : '4.489 từ · 110 Tasks',
            metricA: isRestricted ? `${pTaskStats.done}/${pTaskStats.total}` : `${snap.completedTasks.length}/110`,
            lblA: isRestricted ? 'Task tự tạo' : 'Tasks',
            metricB: rpStats.avgBand ? `Band ${rpStats.avgBand.toFixed(1)}` : `${rpStats.completedUnique} đề`,
            lblB: 'Practice',
            ringTxt: rpStats.avgBand ? rpStats.avgBand.toFixed(1) : `${isRestricted ? myTaskPct : readCombinedPct}%`,
            pct: isRestricted ? myTaskPct : readRingPct,
            stroke: '#2F6E44',
            ico: `<svg viewBox="0 0 36 36" fill="none">
              <path d="M12.2 14.2L10.6 7.4L15 11.1C16.8 10.5 19.2 10.5 21 11.1L25.4 7.4L23.8 14.2C25.5 15.6 26.2 17.6 26.2 19.4H9.8C9.8 17.6 10.5 15.6 12.2 14.2Z" fill="#63665F" stroke="#363B35" stroke-width="1.2" stroke-linejoin="round"/>
              <path d="M16.2 10.5C17.8 7.6 21.2 7.5 22.8 9.6C20.8 11.3 18 11.5 16.2 10.5Z" fill="#4E965F" stroke="#2A5E37" stroke-width="1" stroke-linejoin="round"/>
              <circle cx="14.8" cy="14.7" r="1.95" fill="#FFFFFF"/><circle cx="15" cy="14.7" r="0.95" fill="#181A1F"/>
              <circle cx="21.2" cy="14.7" r="1.95" fill="#FFFFFF"/><circle cx="21" cy="14.7" r="0.95" fill="#181A1F"/>
              <ellipse cx="18" cy="15.8" rx="1.2" ry="0.65" fill="#23221F"/>
              <path d="M5.5 19.6C5.5 18.4 6.6 17.7 7.8 17.9L18 19.7L28.2 17.9C29.4 17.7 30.5 18.4 30.5 19.6V28.4C30.5 29.3 29.6 30 28.7 29.8L18 28L7.3 29.8C6.4 30 5.5 29.3 5.5 28.4V19.6Z" fill="#FFFDF6" stroke="#2D663E" stroke-width="1.7" stroke-linejoin="round"/>
              <path d="M18 19.7V28" stroke="#2D663E" stroke-width="1.5"/>
              <path d="M9.2 22.4H14.6M9.2 25.2H13.8M21.4 22.4H26.8M21.4 25.2H25.8" stroke="#80A489" stroke-width="1.4" stroke-linecap="round"/>
              <path d="M23.5 18.7V23.8L25.2 22.5L26.9 23.8V18.2Z" fill="#D28B3A"/>
            </svg>`,
            action: "window.TotoroUI?.enterSkillMode('Reading', 'home')",
            pracAction: "window.TotoroUI?.enterSkillMode('Reading', 'practice')"
          },
          {
            key: 'listening',
            name: 'Listening',
            sub: isRestricted ? 'Dictation · 133 Đề nghe' : '139 Tasks · Dictation',
            metricA: isRestricted ? `${pTaskStats.done}/${pTaskStats.total}` : `${listenTasksDone}/${listenTasksTotal}`,
            lblA: isRestricted ? 'Task tự tạo' : 'Tasks',
            metricB: '133 Full',
            lblB: 'Đề nghe',
            ringTxt: `${listenPct}%`,
            pct: listenPct,
            stroke: '#216E7C',
            ico: `<svg viewBox="0 0 36 36" fill="none">
              <path d="M8.2 19.5V17.5C8.2 11.8 12.6 7.4 18 7.4C23.4 7.4 27.8 11.8 27.8 17.5V19.5" stroke="#206B78" stroke-width="2.6" stroke-linecap="round"/>
              <path d="M10.4 17.6C10.4 13.1 13.8 9.7 18 9.7C22.2 9.7 25.6 13.1 25.6 17.6" stroke="#7AC2CE" stroke-width="1.3" stroke-linecap="round"/>
              <path d="M14.2 15.2L13 10.6L16.2 13.2C17.3 12.8 18.7 12.8 19.8 13.2L23 10.6L21.8 15.2C23.6 16.8 24.4 19.2 24.2 22.2C24 26.2 21.4 28.4 18 28.4C14.6 28.4 12 26.2 11.8 22.2C11.6 19.2 12.4 16.8 14.2 15.2Z" fill="#636866" stroke="#31393A" stroke-width="1.15" stroke-linejoin="round"/>
              <ellipse cx="18" cy="23.8" rx="4.4" ry="3.3" fill="#FBF6E8"/>
              <path d="M15.4 17.6C15.9 17 16.7 17 17.2 17.6M18.8 17.6C19.3 17 20.1 17 20.6 17.6" stroke="#1E2526" stroke-width="1.35" stroke-linecap="round"/>
              <rect x="5.4" y="17.8" width="5.2" height="9.4" rx="2.6" fill="#2A7A88" stroke="#184C56" stroke-width="1.35"/>
              <rect x="25.4" y="17.8" width="5.2" height="9.4" rx="2.6" fill="#2A7A88" stroke="#184C56" stroke-width="1.35"/>
              <rect x="9.6" y="19.2" width="2" height="6.6" rx="1" fill="#E8B968"/>
              <rect x="24.4" y="19.2" width="2" height="6.6" rx="1" fill="#E8B968"/>
            </svg>`,
            action: "window.TotoroUI?.enterSkillMode('Listening', 'home')",
            pracAction: "window.TotoroUI?.enterSkillMode('Listening', 'practice')"
          },
          {
            key: 'writing',
            name: 'Writing',
            sub: isRestricted ? '28 Task 1 Cam · 57 Task 2' : '41 Flow · Task 1 & 2',
            metricA: isRestricted ? `${window.WRITING_TASK1_DATA?.FULL_TESTS?.length || 16} Full` : `${wsStats.tasksDone}/${wsStats.tasksTotal}`,
            lblA: isRestricted ? 'Đề 60p' : 'Flow',
            metricB: `${wsStats.practiceDone || 0}/${(window.WRITING_TASK1_DATA?.TASK1_PROMPTS?.length || 28) + (wsStats.practiceTotal || 57)}`,
            lblB: 'Đề viết',
            ringTxt: `${writePct}%`,
            pct: writePct,
            stroke: '#B27229',
            ico: `<svg viewBox="0 0 36 36" fill="none">
              <rect x="7" y="6.5" width="18" height="23" rx="3.4" fill="#FFFDF6" stroke="#8C5921" stroke-width="1.6"/>
              <path d="M11 12.2H20.8M11 16.2H18.5M11 20.2H16.2" stroke="#C5A37B" stroke-width="1.6" stroke-linecap="round"/>
              <path d="M11 24.4C13.5 23.2 15.2 25.2 17.6 24" stroke="#4D885B" stroke-width="1.6" stroke-linecap="round"/>
              <g transform="rotate(-42 24 20)">
                <rect x="21.2" y="9" width="5.6" height="14.5" rx="2.2" fill="#A66524" stroke="#5A340E" stroke-width="1.35"/>
                <rect x="21.2" y="19.6" width="5.6" height="2.4" fill="#E8BE67"/>
                <path d="M21.6 23.5L24 29.2L26.4 23.5Z" fill="#F2D07D" stroke="#5A340E" stroke-width="1.2" stroke-linejoin="round"/>
                <circle cx="24" cy="25.5" r="0.8" fill="#5A340E"/>
              </g>
            </svg>`,
            action: isRestricted ? "window.TotoroUI?.enterSkillMode('Writing', 'practice')" : "window.TotoroUI?.enterSkillMode('Writing', 'home')",
            pracAction: "window.TotoroUI?.enterSkillMode('Writing', 'practice')"
          },
          {
            key: 'speaking',
            name: 'Speaking',
            sub: isRestricted ? 'Part 1–3 & Full · Cam 15–20' : 'Part 1–3 & Full · Story 01',
            metricA: isRestricted ? `${(window.SPEAKING_PART13_DATA?.FULL_TESTS?.length || 24)} Full` : `${spStats.tasksDone}/${spStats.tasksTotal}`,
            lblA: isRestricted ? 'Cam 15–20' : 'Bước',
            metricB: isRestricted
              ? `${(window.SPEAKING_PART13_DATA?.PART1_TOPICS?.length || 24) + (window.SPEAKING_PART13_DATA?.PART2_CAMBRIDGE_TOPICS?.length || 24) + (window.SPEAKING_PART13_DATA?.PART3_TOPICS?.length || 24)} Part`
              : `${(window.SPEAKING_PART13_DATA?.PART1_TOPICS?.length || 24) + (window.SPEAKING_PART13_DATA?.PART2_CAMBRIDGE_TOPICS?.length || 24) + (window.SPEAKING_STORY01_DATA?.stories?.[0]?.cueCards?.length || window.SPEAKING_STUDIO_DATA?.STORIES?.[0]?.cueCards?.length || 14) + (window.SPEAKING_PART13_DATA?.PART3_TOPICS?.length || 24)} Đề`,
            lblB: 'Part 1–3',
            ringTxt: `${speakPct}%`,
            pct: speakPct,
            stroke: '#4A5B94',
            ico: `<svg viewBox="0 0 36 36" fill="none">
              <rect x="13" y="6.2" width="10" height="14.6" rx="5" fill="#E3B963" stroke="#39446E" stroke-width="1.6"/>
              <path d="M13.6 10.6H22.4M13.6 13.5H22.4M13.6 16.4H22.4" stroke="#9D7428" stroke-width="1.2" stroke-linecap="round"/>
              <path d="M10 16.4V17.4C10 21.8 13.6 25.2 18 25.2C22.4 25.2 26 21.8 26 17.4V16.4" stroke="#3E4E84" stroke-width="2" stroke-linecap="round"/>
              <path d="M18 25.2V29.5M13.6 29.5H22.4" stroke="#3E4E84" stroke-width="2" stroke-linecap="round"/>
              <path d="M6.8 12.2C5.6 13.6 5.6 16 6.8 17.4M29.2 12.2C30.4 13.6 30.4 16 29.2 17.4" stroke="#6B7EC0" stroke-width="1.7" stroke-linecap="round"/>
              <path d="M23.5 6.8C25.2 4.8 27.6 5.2 28.4 6.8C26.8 8 24.8 8 23.5 6.8Z" fill="#529B63" stroke="#2D6239" stroke-width="0.95" stroke-linejoin="round"/>
            </svg>`,
            action: isRestricted ? "window.TotoroUI?.enterSkillMode('Speaking', 'practice')" : "window.TotoroUI?.enterSkillMode('Speaking', 'home')",
            pracAction: "window.TotoroUI?.enterSkillMode('Speaking', 'practice')"
          }
        ];
        showcaseEl.innerHTML = cards.map((c) => {
          const dashOff = (131.95 * (1 - Math.max(0, Math.min(100, c.pct)) / 100)).toFixed(1);
          return `
            <article class="tot-sk-card is-pro is-${c.key}" onclick="${c.action}" role="button" tabindex="0" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${c.action}}">
              <div class="tot-sk-pro-top">
                <div class="tot-sk-pro-id">
                  <span class="tot-sk-pro-ico" aria-hidden="true">${c.ico}</span>
                  <div class="tot-sk-pro-titles">
                    <h3 class="tot-sk-title">${esc(c.name)}</h3>
                    <p class="tot-sk-stat">${esc(c.sub)}</p>
                  </div>
                </div>
                <div class="tot-sk-pro-ring" aria-label="Tiến độ ${esc(c.name)} ${esc(c.ringTxt)}">
                  <svg viewBox="0 0 50 50" aria-hidden="true">
                    <circle cx="25" cy="25" r="21" fill="none" stroke="var(--bg-subtle)" stroke-width="4.2"/>
                    <circle cx="25" cy="25" r="21" fill="none" stroke="${c.stroke}" stroke-opacity="${c.pct > 0 ? 1 : 0}" stroke-width="4.2" stroke-linecap="round" stroke-dasharray="131.95" stroke-dashoffset="${dashOff}" transform="rotate(-90 25 25)"/>
                  </svg>
                  <span class="tot-sk-pro-ring-val tabular">${esc(c.ringTxt)}</span>
                </div>
              </div>
              <div class="tot-sk-pro-foot">
                <div class="tot-sk-pro-kpis tabular">
                  <span><strong>${esc(c.metricA)}</strong> ${esc(c.lblA)}</span>
                  <span class="tot-sk-pro-dot" aria-hidden="true">·</span>
                  <span><strong>${esc(c.metricB)}</strong> ${esc(c.lblB)}</span>
                </div>
                <button type="button" class="tot-sk-pro-go" onclick="event.stopPropagation(); ${c.pracAction}" title="Vào thẳng phòng Luyện đề ${esc(c.name)}">
                  <span>Luyện đề</span>
                  <span class="tot-sk-pro-arr" aria-hidden="true">→</span>
                </button>
              </div>
            </article>
          `;
        }).join('');
      }
    }
    return trueGoalPct;
  }

  function renderHomeDashboard() {
    const modeChip = document.getElementById('header-mode-chip-text');
    if (modeChip && !document.body.classList.contains('is-teacher-mode')) {
      const curMode = typeof window.__TOTORO_GET_MODE__ === 'function' ? window.__TOTORO_GET_MODE__() : 'Overview';
      modeChip.textContent = curMode === 'Overview' ? 'HOME' : String(curMode).toUpperCase();
    }
    const snap = getRealStudentSnapshot();
    const plan = getStudyPlan(snap.uid);
    const esc = window.__VOCAB_BRIDGE__?.escapeHtml || ((x) => String(x));
    const uName = snap.user?.name || snap.user?.id || 'bạn';
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

    const greetMsg = snap.streak > 0
      ? `Chào ${uName}, giữ vững chuỗi ${snap.streak} ngày nhé`
      : `Chào ${uName}, sẵn sàng học hôm nay nhé`;
    setTxt('home-hero-greeting', greetMsg);
    const subEl = document.getElementById('home-hero-sub');
    if (subEl) {
      const rankTxt = snap.meWeek
        ? `Xếp <strong>#${snap.meWeek.rank} lớp</strong> tuần này (${(snap.meWeek.score || 0).toLocaleString('vi-VN')}${getChestnutUnitHtml()}).`
        : 'Hoàn thành từ vựng & Task để ghi điểm xếp hạng lớp.';
      subEl.innerHTML = `Còn <strong style="color:var(--streak)">${snap.due} từ đến hạn ôn</strong> · ${rankTxt}`;
    }

    // Render Plan, Target Band & Progress Monitor Strip first to get true today goal %
    const goalMins = plan.dailyMins || 30;
    const goalPct = renderHomePlanAndMonitor(snap, plan);
    setTxt('home-goal-pct', `${goalPct}%`);
    const ring = document.getElementById('home-goal-arc');
    if (ring) ring.setAttribute('stroke-dashoffset', String(201 * (1 - goalPct / 100)));
    setTxt('home-goal-mastered', snap.mastered.toLocaleString('vi-VN'));
    setTxt('home-goal-tasks', `${snap.completedTasks.length}`);
    setTxt('home-goal-mins', `${snap.todayMins}/${goalMins}p`);

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

    // Class Leaderboard (Visual Top-3 Podium Stage + Hairline Ranks #4-#5!)
    const lbEl = document.getElementById('home-lb-list');
    if (lbEl) {
      const entries = window.__VOCAB_BRIDGE__?.getClassRankedEntries?.(activeHomeLbPeriod) || [];
      const top5 = entries.slice(0, 5);
      const getInit = (r) => {
        const parts = String(r.name || r.id || 'HV').trim().split(/\s+/);
        return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || parts[0]?.[1] || '')).toUpperCase().slice(0, 2) || 'HV';
      };
      const shortName = (r) => {
        const parts = String(r.name || r.id || 'HV').trim().split(/\s+/);
        return parts.length >= 2 ? parts.slice(-2).join(' ') : parts[0];
      };
      if (top5.length >= 3) {
        const podOrder = [
          { r: top5[1], slot: 'is-p2', num: 2 },
          { r: top5[0], slot: 'is-p1', num: 1 },
          { r: top5[2], slot: 'is-p3', num: 3 }
        ];
        const podiumHtml = `
          <div class="tot-lb-podium-stage">
            ${podOrder.map(({ r, slot, num }) => {
              const isMe = String(r.id).toLowerCase() === snap.uid;
              return `
                <div class="tot-pod-col ${slot} ${isMe ? 'is-me' : ''}">
                  ${num === 1 ? '<svg class="tot-pod-crown" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 18h16l1.5-9.5-5 3.5L12 5l-4.5 7-5-3.5L4 18z"/></svg>' : ''}
                  <span class="tot-pod-av">${esc(getInit(r))}</span>
                  <span class="tot-pod-name" title="${esc(r.name)}">${esc(shortName(r))}</span>
                  <span class="tot-pod-pts tabular">${(r.score || 0).toLocaleString('vi-VN')}${getChestnutUnitHtml()}</span>
                  <span class="tot-pod-base">${num}</span>
                </div>
              `;
            }).join('')}
          </div>
        `;
        const restHtml = top5.slice(3).map((r, i) => {
          const isMe = String(r.id).toLowerCase() === snap.uid;
          const rankNum = r.rank || (i + 4);
          return `
            <div class="tot-lb-row ${isMe ? 'me' : ''}">
              <span style="display:inline-flex;align-items:center;gap:8px;min-width:0;">
                <span class="tot-medal-badge">${rankNum}</span>
                <span class="tot-lb-av">${esc(getInit(r))}</span>
                <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</span>
              </span>
              <span class="tabular tot-lb-pts" style="color:var(--accent);font-weight:800;font-size:13px;white-space:nowrap;display:inline-flex;align-items:center;">${(r.score || 0).toLocaleString('vi-VN')}${getChestnutUnitHtml()}</span>
            </div>
          `;
        }).join('');
        lbEl.innerHTML = podiumHtml + restHtml;
      } else {
        lbEl.innerHTML = top5.length
          ? top5.map((r, i) => {
              const isMe = String(r.id).toLowerCase() === snap.uid;
              const rankNum = r.rank || (i + 1);
              const mCls = rankNum === 1 ? 'm1' : (rankNum === 2 ? 'm2' : (rankNum === 3 ? 'm3' : ''));
              return `
                <div class="tot-lb-row ${isMe ? 'me' : ''}">
                  <span style="display:inline-flex;align-items:center;gap:8px;min-width:0;">
                    <span class="tot-medal-badge ${mCls}">${rankNum}</span>
                    <span class="tot-lb-av">${esc(getInit(r))}</span>
                    <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.name)}</span>
                  </span>
                  <span class="tabular tot-lb-pts" style="color:var(--accent);font-weight:800;font-size:13px;white-space:nowrap;display:inline-flex;align-items:center;">${(r.score || 0).toLocaleString('vi-VN')}${getChestnutUnitHtml()}</span>
                </div>
              `;
            }).join('')
          : '<div style="font-size:12.5px;color:var(--ink-3);padding:12px 0;">Chưa có dữ liệu bảng thi đua tuần này.</div>';
      }
      setTxt('home-lb-myrank', snap.meWeek ? `#${snap.meWeek.rank} / ${entries.length || 1}` : 'Chưa xếp hạng');
    }

    // Unified Recent History (Merges ALL 4 Skills: Reading · Listening · Dictation · Writing · Speaking!)
    const histEl = document.getElementById('home-history-list');
    if (histEl) {
      const uid = snap.uid || 'guest';
      const allEntries = [];

      // 1. Reading Practice & Reading Tasks
      (window.ReadingPracticeStore?.getHistory?.() || []).forEach((h) => {
        allEntries.push({
          skill: 'reading',
          skillLbl: 'Reading',
          ts: Number(h.submittedAt || 0),
          title: h.title || 'Reading Practice',
          sub: `${h.source === 'cambridge' ? 'Cambridge' : (h.source === 'volume' ? 'Volume' : (h.source === 'actual' ? 'Actual' : 'Reading'))} · ${h.submittedAt ? new Date(h.submittedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
          badge: `${h.score}/${h.total} câu`,
          action: h.isFull
            ? `window.TotoroUI.enterSkillMode('Reading', 'practice'); window.ReadingPracticeApp?.startFullTest('${esc(h.itemId)}', { openInReview: true });`
            : `window.TotoroUI.enterSkillMode('Reading', 'practice'); window.ReadingPracticeApp?.startPassage('${esc(h.itemId)}', { openInReview: true });`,
        });
      });
      snap.completedTasks.forEach(([tid, info]) => {
        const taskObj = (window.APP_TASKS_DATA?.tasks || []).find((t) => t.id === tid);
        allEntries.push({
          skill: 'reading',
          skillLbl: 'Reading',
          ts: Number(info.updatedAt || 0),
          title: taskObj ? `${taskObj.label} · ${taskObj.theme || ''}` : tid.toUpperCase(),
          sub: `Reading Task · ${info.updatedAt ? new Date(info.updatedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
          badge: info.recognitionScore != null ? `${info.recognitionScore}% · Đạt` : `${info.translationScore ?? '--'} / 10`,
          action: "window.TotoroUI?.enterSkillMode('Reading', 'task')",
        });
      });

      // 2. Listening Practice & Dictation Studio
      try {
        const lpRaw = JSON.parse(localStorage.getItem(`ielts_listening_practice_v1_${uid}`) || 'null');
        (lpRaw?.history || []).slice(0, 12).forEach((h) => {
          allEntries.push({
            skill: 'listening',
            skillLbl: 'Listening',
            ts: Number(h.ts || 0),
            title: h.itemId ? `Listening · ${String(h.itemId).toUpperCase()}` : 'Listening Practice',
            sub: `${h.mode === 'exam' ? 'Thi thật' : 'Luyện tập'} · ${h.ts ? new Date(h.ts).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
            badge: h.band ? `Band ${Number(h.band).toFixed(1)}` : `${h.score || 0}/${h.total || 10}`,
            action: "window.TotoroUI?.enterSkillMode('Listening', 'practice')",
          });
        });
      } catch (_) {}
      try {
        const dProg = JSON.parse(localStorage.getItem(`totoro_dictation_prog_v1_${uid}`) || '{}');
        const dLessons = window.DICTATION_STUDIO_DATA?.LESSONS || [];
        Object.entries(dProg).forEach(([lid, info]) => {
          if (!info || (!info.updatedAt && !info.completedAt)) return;
          const lObj = dLessons.find((x) => x.id === lid);
          const doneN = info.passedIdxs?.length || 0;
          const totN = lObj?.segments?.length || doneN || 1;
          allEntries.push({
            skill: 'listening',
            skillLbl: 'Dictation',
            ts: Number(info.updatedAt || info.completedAt || 0),
            title: lObj?.title || 'Dictation Video',
            sub: `Dictation Studio · ${new Date(info.updatedAt || info.completedAt).toLocaleDateString('vi-VN')}`,
            badge: info.quizBestPct ? `${doneN}/${totN} · Quiz ${info.quizBestPct}%` : `${doneN}/${totN} câu`,
            action: `window.TotoroUI?.openDictationStudio('${esc(lid)}')`,
          });
        });
      } catch (_) {}

      // 3. Writing Practice (Task 1 · Task 2 · Full Test)
      (window.WritingStudio?.getPracticeHistory?.() || []).slice(0, 15).forEach((h) => {
        allEntries.push({
          skill: 'writing',
          skillLbl: 'Writing',
          ts: Number(h.completedAt || 0),
          title: String(h.prompt || 'Writing Practice').slice(0, 68),
          sub: `${h.type || 'Task 2'} · ${h.wordCount || 0}w · ${h.completedAt ? new Date(h.completedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
          badge: h.band ? `Band ${Number(h.band).toFixed(1)}` : `${h.wordCount || 0}w`,
          action: "window.TotoroUI?.enterSkillMode('Writing', 'practice')",
        });
      });

      // 4. Speaking Practice (Part 2 Cue Cards)
      try {
        const spHist = JSON.parse(localStorage.getItem(`totoro_speaking_prac_hist_v1_${uid}`) || '[]');
        (Array.isArray(spHist) ? spHist : []).slice(0, 12).forEach((h) => {
          allEntries.push({
            skill: 'speaking',
            skillLbl: 'Speaking',
            ts: Number(h.at || 0),
            title: h.cueTitle || 'Speaking Part 2',
            sub: `${h.wpm ? h.wpm + ' WPM · ' : ''}${h.at ? new Date(h.at).toLocaleDateString('vi-VN') : 'Đã nộp'}`,
            badge: h.band ? `Band ${Number(h.band).toFixed(1)}` : `${h.words || 0}w`,
            action: "window.TotoroUI?.enterSkillMode('Speaking', 'practice')",
          });
        });
      } catch (_) {}

      const filterSk = activeHomeHistSkill || 'all';
      const filteredHist = allEntries
        .filter((r) => filterSk === 'all' || r.skill === filterSk)
        .sort((a, b) => b.ts - a.ts);

      document.querySelectorAll('#home-history-tabs [data-hist-sk]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-hist-sk') === filterSk);
      });

      histEl.innerHTML = filteredHist.length
        ? filteredHist.slice(0, 5).map((row) => `
            <button type="button" class="tot-hist-row tot-hist-row-btn" onclick="${row.action}">
              <div style="min-width:0;overflow:hidden;text-align:left;">
                <div style="font-size:12.8px;font-weight:750;line-height:1.25;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                  <span class="tot-hist-sk-tag is-${row.skill}">${esc(row.skillLbl)}</span> ${esc(row.title)}
                </div>
                <div style="font-size:11px;color:var(--ink-3);font-weight:500;margin-top:2px;">${esc(row.sub)}</div>
              </div>
              <span class="tot-hist-badge tabular">${esc(row.badge)}</span>
            </button>
          `).join('')
        : `<div class="tot-empty-illustrated">
             <img class="tot-empty-mascot" src="assets/images/totoro_sitting_branch.webp" alt="" loading="lazy" decoding="async" draggable="false">
             <div class="tot-empty-copy">
               <strong>Chưa có bài nộp ở mục này</strong>
               <span>Thử làm 1 đề ngắn 15–20 phút để lưu Band &amp; tiến độ đầu tiên nhé.</span>
             </div>
             <button type="button" class="tot-foot-btn" onclick="window.TotoroUI?.enterSkillMode('${filterSk === 'all' ? 'Reading' : filterSk.charAt(0).toUpperCase() + filterSk.slice(1)}', 'practice')">Mở Practice →</button>
           </div>`;
      setTxt('home-history-total', `${allEntries.length} bài (4 kỹ năng)`);
    }

    syncResumeHeroCta();

    if (activeHomeScope === 'reading') {
      renderReadingHomePanel(snap);
    } else if (activeHomeScope !== 'global') {
      renderSkillHomeStub(activeHomeScope);
    }
  }

  let activeHomeScope = 'global';
  let activeHomeHistSkill = 'all';
  const LAST_SESSION_KEY_BASE = 'totoro_last_session_v1_';

  function getLastSessionUid() {
    return String(window.__VOCAB_BRIDGE__?.getScopedUid?.() || window.__VOCAB_BRIDGE__?.getCurrentUser?.()?.id || 'guest').trim().toLowerCase();
  }

  function recordLastSession(info) {
    if (!info || !info.label) return;
    try {
      const rawLbl = String(info.label).trim();
      const shortLbl = rawLbl.length > 34 ? rawLbl.slice(0, 33).replace(/\s+\S*$/, '') + '…' : rawLbl;
      const payload = {
        skill: info.skill || 'Reading',
        view: info.view || 'flashcard',
        label: shortLbl,
        action: String(info.action || ''),
        ts: Date.now()
      };
      localStorage.setItem(LAST_SESSION_KEY_BASE + getLastSessionUid(), JSON.stringify(payload));
      syncResumeHeroCta();
    } catch (_) {}
  }

  function getLastSession() {
    try {
      const raw = localStorage.getItem(LAST_SESSION_KEY_BASE + getLastSessionUid());
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return null;
  }

  function syncResumeHeroCta() {
    const lbl = document.getElementById('home-hero-resume-label');
    if (!lbl) return;
    const last = getLastSession();
    lbl.textContent = last?.label ? `Tiếp tục: ${last.label}` : 'Tiếp tục học';
  }

  function resumeLastSession() {
    const last = getLastSession();
    if (last?.action) {
      try {
        // Safe structured routing without arbitrary eval
        if (last.action.includes('openDictationStudio')) {
          const m = last.action.match(/openDictationStudio\('([^']+)'\)/);
          openDictationStudio(m ? m[1] : undefined);
          return;
        }
        if (last.skill === 'Writing' && last.view === 'practice') {
          window.TotoroUI?.enterSkillMode('Writing', 'practice');
          const m = last.action.match(/setPracView\('([^']+)'\)/);
          if (m) window.WritingStudio?.setPracView?.(m[1]);
          return;
        }
        if (last.skill && last.view) {
          window.TotoroUI?.enterSkillMode(last.skill, last.view);
          return;
        }
      } catch (_) {}
    }
    window.TotoroUI?.enterSkillMode(window.TotoroUI?.getActiveSkill?.() || 'Reading', 'flashcard');
  }

  function setHomeHistoryFilter(sk) {
    activeHomeHistSkill = ['all', 'reading', 'listening', 'writing', 'speaking'].includes(sk) ? sk : 'all';
    renderHomeDashboard();
  }

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

    const rpHistHtml = rpStats.recent.length
      ? rpStats.recent.slice(0, 5).map((h) => {
          const dt = h.completedAt ? new Date(h.completedAt).toLocaleDateString('vi-VN') : '';
          const srcLabel = h.source === 'cambridge' ? 'Cambridge' : h.source === 'volume' ? 'Volume' : h.source === 'actual' ? 'Actual' : 'News';
          const isMastered = !!(h.mastered || (h.total > 0 && h.score === h.total));
          const openCall = h.isFull
            ? `window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.startFullTest('${esc(h.itemId)}', { ${isMastered ? 'openInReview: true' : "studyMode: 'practice'"} });`
            : `window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.startPassage('${esc(h.itemId)}', { ${isMastered ? 'openInReview: true' : "studyMode: 'practice'"} });`;
          return `
            <div class="rh-hist-row">
              <div style="min-width:0;">
                <div class="rh-hist-title">${esc(h.title)}</div>
                <div class="rh-hist-meta">${esc(srcLabel)} · ${h.score}/${h.total} câu đúng · ${dt}</div>
              </div>
              <div class="rh-hist-right">
                <span class="rh-band-pill tabular">${h.score}/${h.total}</span>
                <button type="button" class="tot-foot-btn" onclick="${openCall}">${isMastered ? 'Xem giải' : 'Làm lại'}</button>
              </div>
            </div>
          `;
        }).join('')
      : `<div class="tot-empty-illustrated">
           <img class="tot-empty-mascot" src="assets/images/totoro_sitting_branch.webp" alt="" loading="lazy" decoding="async" draggable="false">
           <div class="tot-empty-copy">
             <strong>Chưa có bài luyện đề nào</strong>
             <span>Chọn một kho đề Cambridge, Volume hoặc Actual phía trên để bắt đầu ngay.</span>
           </div>
         </div>`;

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
            <div class="rh-hist-row">
              <div style="min-width:0;">
                <div class="rh-hist-title">${esc(label)}</div>
                <div class="rh-hist-meta">${info.updatedAt ? new Date(info.updatedAt).toLocaleDateString('vi-VN') : 'Đã nộp'}</div>
              </div>
              <span class="tot-hist-badge tabular">${esc(score)}</span>
            </div>
          `;
        }).join('')
      : `<div class="rh-empty-clean">Chưa hoàn thành Task Reading nào.</div>`;

    const mvDecksHtml = mvDecks.length
      ? mvDecks.slice(0, 3).map((d) => `
          <div class="rh-hist-row">
            <div style="min-width:0;">
              <div class="rh-hist-title">${esc(d.name)}</div>
              <div class="rh-hist-meta">${d.words?.length || 0} từ đã lưu</div>
            </div>
            <button type="button" class="tot-foot-btn" onclick="window.__VOCAB_BRIDGE__?.openMyVocabDeck('${esc(d.id)}')">Học →</button>
          </div>
        `).join('')
      : `<div class="rh-empty-clean">Chưa có từ cá nhân. Vào Solutions sau khi làm bài để lưu từ vựng.</div>`;

    const quickBanks = [
      { id: 'cambridge', name: 'Cambridge 1–20', meta: '194 bài · 71 Full Tests', tag: 'Chuẩn đề', tone: 'is-sage', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>' },
      { id: 'volume', name: 'Real Volume 1–10', meta: '114 bài · 38 Full Tests', tag: 'Thực chiến', tone: 'is-teal', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z"/><path d="m3 12 9 4.5 9-4.5"/><path d="m3 16.5 9 4.5 9-4.5"/></svg>' },
      { id: 'actual', name: 'Recent Actual', meta: '270 bài · Lọc theo dạng', tag: 'Thi thật', tone: 'is-warm', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>' },
      { id: 'news', name: 'Academic News', meta: 'Song ngữ · Tra & lưu từ', tag: 'Đọc báo', tone: 'is-indigo', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8"/><path d="M15 18h-5"/><path d="M10 6h8v4h-8V6Z"/></svg>' }
    ];

    const quickBanksHtml = quickBanks.map((bk) => `
      <button type="button" class="rh-quick-tile is-visual ${bk.tone}" onclick="window.TotoroUI.switchView('practice'); window.ReadingPracticeApp?.openSource('${bk.id}', '${bk.id === 'actual' ? 'p1' : 'all'}')">
        <div class="rh-quick-head-row">
          <span class="rh-quick-ico ${bk.tone}" aria-hidden="true">${bk.ico}</span>
          <span class="rh-quick-tag">${esc(bk.tag)}</span>
        </div>
        <div class="rh-quick-name">${esc(bk.name)}</div>
        <div class="rh-quick-meta-row">
          <span class="rh-quick-meta">${esc(bk.meta)}</span>
          <span class="rh-quick-arr" aria-hidden="true">→</span>
        </div>
      </button>
    `).join('');

    const rRingPct = rpStats.avgBand ? Math.min(100, Math.round((rpStats.avgBand / 9) * 100)) : Math.min(100, Math.round((snap.completedTasks.length / 110) * 100));
    const rRingOff = (176 * (1 - rRingPct / 100)).toFixed(1);

    el.innerHTML = `
      <div class="rh-layout rh-clean">
        <div class="rh-top-asym">
          <div class="tot-hero-card rh-main-hero has-mascot is-reading">
            <div class="rh-hero-copy">
              <div class="rh-head-row">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="3 5.5 26 23.5" fill="none"><path d="M10.2 14L8.8 7.2L13.2 10.8C15 10.2 17 10.2 18.8 10.8L23.2 7.2L21.8 14C23.4 15.4 24 17.4 24 19H8C8 17.4 8.6 15.4 10.2 14Z" fill="#595651"/><path d="M14.2 10.2C15.8 7.5 19.2 7.4 20.6 9.5C18.5 11 15.8 11.2 14.2 10.2Z" fill="#4E9460"/><circle cx="13" cy="14.3" r="1.9" fill="#FFFFFF"/><circle cx="13.2" cy="14.3" r="0.95" fill="#181A1F"/><circle cx="19" cy="14.3" r="1.9" fill="#FFFFFF"/><circle cx="18.8" cy="14.3" r="0.95" fill="#181A1F"/><path d="M4.2 18.8C4.2 17.7 5.2 17 6.3 17.2L16 18.8L25.7 17.2C26.8 17 27.8 17.7 27.8 18.8V26.4C27.8 27.2 27 27.8 26.2 27.6L16 26L5.8 27.6C5 27.8 4.2 27.2 4.2 26.4V18.8Z" fill="#FBF8F0" stroke="#3F6E4A" stroke-width="1.6" stroke-linejoin="round"/><path d="M16 18.8V26" stroke="#3F6E4A" stroke-width="1.5"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Reading</h2>
                  <div class="tot-shell-sub tabular">${(snap.mastered || 0).toLocaleString('vi-VN')} / ${(snap.totalFamilies || 4489).toLocaleString('vi-VN')} từ · ${snap.completedTasks.length}/110 Tasks · ${mvTotalWords} từ cá nhân</div>
                </div>
              </div>
              <div class="rh-decks-grid-4">${deckBarsHtml}</div>
              <div class="rh-hero-actions" style="margin-top:14px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.switchView('practice')">Vào kho đề Practice →</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchView('flashcard')">Flashcard</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchView('task')">110 Tasks</button>
                <button type="button" class="tot-demo-btn" onclick="window.MyVocabUI?.openModal()">MY LIST</button>
              </div>
            </div>
            <div class="rh-hero-mascot-stage" aria-hidden="true">
              <img class="rh-hero-mascot-img" src="assets/images/totoro_reading_mascot.webp" alt="" decoding="async" draggable="false">
            </div>
          </div>

          <div class="tot-home-panel rh-band-panel">
            <div class="tot-panel-head" style="margin-bottom:10px;">
              <div>
                <div class="tot-panel-title">Kết quả Luyện đề</div>
                <div class="tot-panel-sub">Thống kê từ các lượt đã nộp</div>
              </div>
              <div class="rh-ring-wrap" aria-label="Tỷ lệ hoàn thành">
                <svg viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-subtle)" stroke-width="5.5"/>
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--accent)" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="${rRingOff}" transform="rotate(-90 32 32)"/>
                </svg>
                <span class="rh-ring-val tabular">${rpStats.avgBand ? rpStats.avgBand.toFixed(1) : `${rRingPct}%`}</span>
              </div>
            </div>
            <div class="rh-kpi-strip tabular">
              <div class="rh-kpi-cell">
                <span class="rh-kpi-num">${rpStats.completedUnique}</span>
                <span class="rh-kpi-lbl">Bài đã làm</span>
              </div>
              <div class="rh-kpi-cell">
                <span class="rh-kpi-num">${rpStats.attemptsCount}</span>
                <span class="rh-kpi-lbl">Lượt nộp</span>
              </div>
              <div class="rh-kpi-cell">
                <span class="rh-kpi-num">${rpStats.totalMins}p</span>
                <span class="rh-kpi-lbl">Thời gian</span>
              </div>
            </div>
            <div class="tot-panel-foot" style="margin-top:auto;padding-top:10px;">
              <span class="tot-foot-meta">Tiến độ Task <strong class="tabular">${snap.completedTasks.length}/110</strong></span>
              <span class="tot-foot-meta">MY LIST <strong class="tabular">${mvTotalWords} từ</strong></span>
            </div>
          </div>
        </div>

        <section class="rh-quick-section" aria-label="Mở nhanh kho đề Reading">
          <div class="rh-quick-head">
            <h3 class="rh-section-lbl">Mở nhanh kho đề Reading</h3>
            <button type="button" class="rh-text-link" onclick="window.TotoroUI.switchView('practice')">Xem tất cả 4 kho →</button>
          </div>
          <div class="rh-quick-grid">${quickBanksHtml}</div>
        </section>

        <div class="rh-bottom-asym">
          <div class="tot-home-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Lịch sử luyện đề gần đây</div>
                <div class="tot-panel-sub">Bấm vào bài đã xong để xem lại hoặc làm lại</div>
              </div>
            </div>
            <div class="rh-hist-list is-flat">${rpHistHtml}</div>
          </div>

          <div class="tot-home-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Từ cá nhân &amp; Task gần đây</div>
                <div class="tot-panel-sub">Ôn nhanh bộ từ rút từ bài đọc</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.MyVocabUI?.openModal()">Quản lý →</button>
            </div>
            <div class="rh-hist-list is-flat">${mvDecksHtml}</div>
            ${recentTasks.length ? `<div class="rh-subhead" style="margin-top:12px;">Task Reading vừa xong</div><div class="rh-hist-list is-flat">${taskHistHtml}</div>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function syncPracticeScreen() {
    const rpRoot = document.getElementById('rp-app-root');
    const lpRoot = document.getElementById('lp-app-root');
    const lpDictRoot = document.getElementById('lp-dictation-root');
    const lpSwitch = document.getElementById('lp-mode-switch');
    const wpRoot = document.getElementById('wp-app-root');
    const spRoot = document.getElementById('sp-app-root');
    const curSkill = html.getAttribute('data-skill');
    if (curSkill === 'speaking') {
      if (rpRoot) rpRoot.style.display = 'none';
      if (lpSwitch) lpSwitch.style.display = 'none';
      if (lpRoot) lpRoot.style.display = 'none';
      if (lpDictRoot) lpDictRoot.style.display = 'none';
      if (wpRoot) wpRoot.style.display = 'none';
      if (spRoot) spRoot.style.display = '';
      window.SpeakingStudio?.renderPracticeHub?.();
    } else if (curSkill === 'writing') {
      if (rpRoot) rpRoot.style.display = 'none';
      if (lpSwitch) lpSwitch.style.display = 'none';
      if (lpRoot) lpRoot.style.display = 'none';
      if (lpDictRoot) lpDictRoot.style.display = 'none';
      if (spRoot) spRoot.style.display = 'none';
      if (wpRoot) wpRoot.style.display = '';
      window.WritingStudio?.renderPracticeHub?.();
    } else if (curSkill === 'listening') {
      if (rpRoot) rpRoot.style.display = 'none';
      if (wpRoot) wpRoot.style.display = 'none';
      if (spRoot) spRoot.style.display = 'none';
      if (lpSwitch) lpSwitch.style.display = 'none';
      if (activeListeningPracticeSub === 'dictation') {
        if (lpRoot) lpRoot.style.display = 'none';
        if (lpDictRoot) lpDictRoot.style.display = '';
        window.DictationStudio?.render?.();
      } else {
        if (lpDictRoot) lpDictRoot.style.display = 'none';
        if (lpRoot) lpRoot.style.display = '';
        window.ListeningTasksModule?.renderPracticeScreen?.();
      }
    } else {
      if (lpSwitch) lpSwitch.style.display = 'none';
      if (lpRoot) lpRoot.style.display = 'none';
      if (lpDictRoot) lpDictRoot.style.display = 'none';
      if (wpRoot) wpRoot.style.display = 'none';
      if (spRoot) spRoot.style.display = 'none';
      if (rpRoot) rpRoot.style.display = '';
      window.ReadingPracticeApp?.render?.();
    }
  }

  function setListeningPracticeSub(sub) {
    activeListeningPracticeSub = sub === 'dictation' ? 'dictation' : 'exams';
    if (activeListeningPracticeSub !== 'dictation') {
      window.DictationStudio?.pausePlayback?.();
    }
    syncPracticeScreen();
  }

  function openDictationStudio(lessonId) {
    activeListeningPracticeSub = 'dictation';
    if (typeof window.__TOTORO_SET_SKILL__ === 'function') {
      window.__TOTORO_SET_SKILL__('Listening', { silent: true });
    }
    switchView('practice', { fromUser: true });
    if (lessonId) window.DictationStudio?.openLesson?.(lessonId);
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

    // Read real Listening Practice attempts for current user
    const uid = String(B?.getScopedUid?.() || B?.getCurrentUser?.()?.id || 'guest').trim().toLowerCase();
    let lpHist = [];
    try {
      const raw = localStorage.getItem(`ielts_listening_practice_v1_${uid}`);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.history)) lpHist = parsed.history;
    } catch (_) {}
    const lpUnique = new Set(lpHist.map((h) => h.itemId).filter(Boolean)).size;
    const lpBands = lpHist.map((h) => Number(h.band || 0)).filter((b) => b > 0);
    const lpAvgBand = lpBands.length ? (lpBands.reduce((a, b) => a + b, 0) / lpBands.length) : 0;
    const lpTotalMins = Math.round(lpHist.reduce((a, h) => a + Number(h.elapsedSec || 0), 0) / 60);

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

    const featuredExams = [
      ...allTasks.filter((t) => t.isMapTask).slice(0, 3),
      ...allTasks.filter((t) => t.hasFullTests && !t.isMapTask).slice(0, 2),
    ];
    const featuredHtml = featuredExams.map((t) => {
      const r = prog[t.id];
      const shortTitle = window.ListeningTasksModule?.shortTopicTitle?.(t)
        || String(t.topicTitle || t.theme || '').replace(/^🗺️\s*MAP\s*·\s*/i, '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
      const badge = r?.t3Total
        ? `<span class="tot-hist-badge tabular">${r.t3Score}/${r.t3Total}</span>`
        : `<span class="lt-inline-pill ${t.isMapTask ? 'is-map' : ''}">${t.isMapTask ? 'Map' : '3 Test'}</span>`;
      return `
        <div class="rh-hist-row lh-flat-row" onclick="window.ListeningTasksModule?.openExam?.('${esc(t.id)}', 3, { fromPractice: true })" role="button" tabindex="0">
          <div style="min-width:0;flex:1;">
            <div class="rh-hist-title">${esc(t.label)} · ${esc(shortTitle)}</div>
            <div class="rh-hist-meta">${t.isMapTask ? 'Map Labelling · Part 2' : 'Note Completion · 3 Test'}</div>
          </div>
          <div class="rh-hist-right">
            ${badge}
            <button type="button" class="tot-foot-btn" onclick="event.stopPropagation(); window.ListeningTasksModule?.openExam?.('${esc(t.id)}', 3)">Làm bài →</button>
          </div>
        </div>`;
    }).join('');

    const deckCatalog = [
      { key: 'l_foundation', name: 'Từ Vựng Nền Tảng', sub: 'Cơ bản bắt buộc nghe hiểu', list: lv.foundation || [] },
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
        <div class="rh-hist-row lh-flat-row" onclick="window.TotoroUI.enterSkillMode('Listening', 'flashcard'); window.__VOCAB_BRIDGE__?.loadMainScope?.('${d.key}');" role="button" tabindex="0">
          <div style="min-width:0;flex:1;">
            <div class="rh-hist-title">${esc(d.name)}</div>
            <div class="rh-hist-meta">${esc(d.sub)}</div>
          </div>
          <div class="rh-hist-right">
            <span class="lh-row-count tabular">${m}/${d.list.length}</span>
            <button type="button" class="tot-foot-btn" onclick="event.stopPropagation(); window.TotoroUI.enterSkillMode('Listening', 'flashcard'); window.__VOCAB_BRIDGE__?.loadMainScope?.('${d.key}');">Học →</button>
          </div>
        </div>`;
    }).join('');

    const quickBanks = [
      { id: 'cambridge', name: 'Cambridge 1–20', meta: '20 cuốn · 80 Tests chuẩn đề', tag: 'Chuẩn đề', tone: 'is-sage', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>', act: "window.TotoroUI.setListeningPracticeSub('exams'); window.TotoroUI.enterSkillMode('Listening', 'practice'); window.ListeningPracticeApp?.openSource('cambridge')" },
      { id: 'volume', name: 'Real Volume 1–10', meta: '10 tập · 40 Tests luyện bẫy', tag: 'Thực chiến', tone: 'is-teal', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 10v3"/><path d="M6 6v11"/><path d="M10 3v18"/><path d="M14 8v7"/><path d="M18 5v13"/><path d="M22 10v3"/></svg>', act: "window.TotoroUI.setListeningPracticeSub('exams'); window.TotoroUI.enterSkillMode('Listening', 'practice'); window.ListeningPracticeApp?.openSource('volume')" },
      { id: 'actual', name: 'Recent Actual', meta: '52 bài nghe · 13 Full Tests', tag: 'Thi thật', tone: 'is-warm', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>', act: "window.TotoroUI.setListeningPracticeSub('exams'); window.TotoroUI.enterSkillMode('Listening', 'practice'); window.ListeningPracticeApp?.openSource('actual', 'p1')" },
      { id: 'dictation', name: 'Dictation Studio', meta: 'Chép chính tả · YouTube & Audio', tag: 'Nghe sâu', tone: 'is-indigo', ico: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="3"/><polygon points="10 9 15 12 10 15 10 9" fill="currentColor" stroke="none"/></svg>', act: "window.TotoroUI.openDictationStudio()" }
    ];
    const quickBanksHtml = quickBanks.map((bk) => `
      <button type="button" class="rh-quick-tile is-visual ${bk.tone}" onclick="${bk.act}">
        <div class="rh-quick-head-row">
          <span class="rh-quick-ico ${bk.tone}" aria-hidden="true">${bk.ico}</span>
          <span class="rh-quick-tag">${esc(bk.tag)}</span>
        </div>
        <div class="rh-quick-name">${esc(bk.name)}</div>
        <div class="rh-quick-meta-row">
          <span class="rh-quick-meta">${esc(bk.meta)}</span>
          <span class="rh-quick-arr" aria-hidden="true">→</span>
        </div>
      </button>
    `).join('');

    const lRingPct = lpAvgBand ? Math.min(100, Math.round((lpAvgBand / 9) * 100)) : pctTotal;
    const lRingOff = (176 * (1 - lRingPct / 100)).toFixed(1);

    el.innerHTML = `
      <div class="rh-layout rh-clean">
        <div class="rh-top-asym">
          <div class="tot-hero-card rh-main-hero has-mascot is-listening">
            <div class="rh-hero-copy">
              <div class="rh-head-row">
                <span class="tot-icon-tile" aria-hidden="true" style="width:36px;height:36px;">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/></svg>
                </span>
                <div>
                  <h2 class="tot-shell-title" style="margin:0;">IELTS Listening</h2>
                  <div class="tot-shell-sub tabular">${masteredTotal.toLocaleString('vi-VN')} / ${totalVocab.toLocaleString('vi-VN')} từ · ${doneTasks} / ${totalTasks} Tasks · 133 Full Tests</div>
                </div>
              </div>
              <div class="rh-decks-grid-4">${barsHtml}</div>
              <div class="rh-hero-actions" style="margin-top:14px;">
                <button type="button" class="btn btn-primary tot-demo-btn" onclick="window.TotoroUI.setListeningPracticeSub('exams'); window.TotoroUI.enterSkillMode('Listening', 'practice')">Kho đề Practice →</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.openDictationStudio()">Dictation Studio</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'flashcard')">Flashcard</button>
                <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'task')">${totalTasks} Tasks</button>
              </div>
            </div>
            <div class="rh-hero-mascot-stage" aria-hidden="true">
              <img class="rh-hero-mascot-img" src="assets/images/totoro_listening_mascot.webp" alt="" decoding="async" draggable="false">
            </div>
          </div>

          <div class="tot-home-panel rh-band-panel">
            <div class="tot-panel-head" style="margin-bottom:10px;">
              <div>
                <div class="tot-panel-title">Tiến độ Luyện nghe</div>
                <div class="tot-panel-sub">Thống kê luyện đề &amp; từ vựng</div>
              </div>
              <div class="rh-ring-wrap is-teal" aria-label="Tiến độ Listening">
                <svg viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" fill="none" stroke="var(--bg-subtle)" stroke-width="5.5"/>
                  <circle cx="32" cy="32" r="28" fill="none" stroke="#28707D" stroke-width="5.5" stroke-linecap="round" stroke-dasharray="176" stroke-dashoffset="${lRingOff}" transform="rotate(-90 32 32)"/>
                </svg>
                <span class="rh-ring-val tabular">${lpAvgBand ? lpAvgBand.toFixed(1) : `${pctTotal}%`}</span>
              </div>
            </div>
            <div class="rh-kpi-strip tabular">
              <div class="rh-kpi-cell">
                <span class="rh-kpi-num">${lpUnique}</span>
                <span class="rh-kpi-lbl">Bài luyện đề</span>
              </div>
              <div class="rh-kpi-cell">
                <span class="rh-kpi-num">${doneTasks}</span>
                <span class="rh-kpi-lbl">Tasks xong</span>
              </div>
              <div class="rh-kpi-cell">
                <span class="rh-kpi-num">${lpTotalMins}p</span>
                <span class="rh-kpi-lbl">Thời gian</span>
              </div>
            </div>
            <div class="tot-panel-foot" style="margin-top:auto;padding-top:10px;">
              <span class="tot-foot-meta">Đã thuộc <strong class="tabular">${masteredTotal.toLocaleString('vi-VN')} từ</strong></span>
              <span class="tot-foot-meta">Lượt nộp <strong class="tabular">${lpHist.length}</strong></span>
            </div>
          </div>
        </div>

        <section class="rh-quick-section" aria-label="Mở nhanh kho đề Listening">
          <div class="rh-quick-head">
            <h3 class="rh-section-lbl">Mở nhanh kho đề Listening</h3>
            <button type="button" class="rh-text-link" onclick="window.TotoroUI.setListeningPracticeSub('exams'); window.TotoroUI.enterSkillMode('Listening', 'practice')">Xem tất cả kho đề →</button>
          </div>
          <div class="rh-quick-grid">${quickBanksHtml}</div>
        </section>

        <div class="rh-bottom-asym">
          <div class="tot-home-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Đề bổ trợ nổi bật</div>
                <div class="tot-panel-sub">Map Labelling Part 2 &amp; Note Completion 3 Test</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'task')">Tất cả Tasks →</button>
            </div>
            <div class="rh-hist-list is-flat">${featuredHtml}</div>
          </div>

          <div class="tot-home-panel">
            <div class="tot-panel-head">
              <div>
                <div class="tot-panel-title">Lộ trình Bộ từ Listening</div>
                <div class="tot-panel-sub">7 bộ từ chia theo ngữ cảnh thực tế từ dễ đến học thuật</div>
              </div>
              <button type="button" class="tot-foot-btn" onclick="window.TotoroUI.enterSkillMode('Listening', 'flashcard')">Flashcard →</button>
            </div>
            <div class="rh-hist-list is-flat lh-deck-scroll">${deckListHtml}</div>
          </div>
        </div>
      </div>
    `;
  }

  function renderSkillHomeStub(scope) {
    const el = document.getElementById('home-scope-skill-stub');
    if (!el) return;
    const isRestricted = Boolean(window.AccessPolicy?.isRestricted?.());
    if (isRestricted && (scope === 'writing' || scope === 'speaking')) {
      const cfg = scope === 'writing'
        ? {
            badge: 'IELTS Writing · Đề Thi Thật Cambridge 14–20',
            name: 'IELTS Writing Practice',
            desc: 'Trọn bộ 28 đề Academic Task 1 Cambridge 14–20 (biểu đồ gốc), 57 đề Task 2 thi thật & 16 Full Test 60 phút chuẩn CD-IELTS kèm AI chấm 4 tiêu chí.',
            cta: `<button type="button" class="btn btn-primary" style="padding:9px 18px;" onclick="window.TotoroUI.enterSkillMode('Writing', 'practice')">Vào Luyện Đề Writing →</button>`
          }
        : {
            badge: 'IELTS Speaking · Đề Thi Thật Cambridge 15–20',
            name: 'IELTS Speaking Practice (Part 1 & Part 3)',
            desc: 'Trọn bộ 48 bộ đề thi thật Cambridge IELTS 15–20 (96 câu Part 1 + 144 câu Part 3 nguyên văn) với Giám khảo UK, thu âm AI & chấm Band 4 tiêu chí.',
            cta: `<button type="button" class="btn btn-primary" style="padding:9px 18px;" onclick="window.TotoroUI.enterSkillMode('Speaking', 'practice')">Vào Luyện Đề Speaking →</button>`
          };
      el.innerHTML = `
        <div class="rh-stub-card ink-brackets">
          <span class="rp-tag">${cfg.badge}</span>
          <h2 class="rh-title" style="margin-top:10px;">${cfg.name}</h2>
          <p class="rh-sub" style="max-width:560px;margin:6px auto 18px;">${cfg.desc}</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.openGlobalHome()">← Về HOME</button>
            ${cfg.cta}
          </div>
        </div>
      `;
      return;
    }
    if (scope === 'listening') {
      renderListeningHomePanel(el);
      return;
    }
    if (scope === 'writing' && typeof window.WritingStudio?.renderWritingHomePanel === 'function') {
      window.WritingStudio.renderWritingHomePanel(el);
      return;
    }
    if (scope === 'speaking' && typeof window.SpeakingStudio?.renderSpeakingHomePanel === 'function') {
      window.SpeakingStudio.renderSpeakingHomePanel(el);
      return;
    }
    const meta = {
      writing: {
        name: 'Writing Home',
        badge: 'Đang phát triển · Sắp ra mắt',
        desc: 'Không gian trang chủ riêng cho IELTS Writing: bản đồ Flow Ideas Task 2, biểu đồ Task 1, kho bài mẫu chữa chi tiết và lịch sử chấm Band.',
        cta: `<button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchHomeScope('global')">← Quay về HOME</button>`
      },
      speaking: {
        name: 'Speaking Home',
        badge: 'Đang phát triển · Sắp ra mắt',
        desc: 'Không gian trang chủ riêng cho IELTS Speaking: Spoken Chunks Part 1–3, kho Cue Card theo quý và lịch sử luyện phát âm.',
        cta: `<button type="button" class="tot-demo-btn" onclick="window.TotoroUI.switchHomeScope('global')">← Quay về HOME</button>`
      }
    }[scope];
    if (!meta) return;

    el.innerHTML = `
      <div class="rh-stub-card ink-brackets">
        <span class="rp-tag">${meta.badge}</span>
        <h2 class="rh-title" style="margin-top:10px;">${meta.name}</h2>
        <p class="rh-sub" style="max-width:560px;margin:6px auto 18px;">${meta.desc}</p>
        <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button type="button" class="tot-demo-btn" onclick="window.TotoroUI.openGlobalHome()">← Về HOME</button>
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

    const curSk = html.getAttribute('data-skill') || 'reading';
    // Restricted partner classes: Reading & Listening Task tabs auto-generate interactive Tasks from student MY LIST!
    if (window.AccessPolicy?.isRestricted?.() && (curSk === 'reading' || curSk === 'listening')) {
      window.PersonalTaskEngine?.renderHub?.(tabsEl, gridEl, curSk === 'listening' ? 'Listening' : 'Reading');
      return;
    }

    if (curSk === 'speaking' && typeof window.SpeakingStudio?.renderTaskHub === 'function') {
      gridEl.classList.remove('is-listening-grid', 'is-writing-grid');
      gridEl.classList.add('is-speaking-grid');
      window.SpeakingStudio.renderTaskHub(tabsEl, gridEl);
      return;
    }
    if (html.getAttribute('data-skill') === 'writing' && typeof window.WritingStudio?.renderTaskHub === 'function') {
      gridEl.classList.remove('is-listening-grid', 'is-speaking-grid');
      gridEl.classList.add('is-writing-grid');
      window.WritingStudio.renderTaskHub(tabsEl, gridEl);
      return;
    }
    if (html.getAttribute('data-skill') === 'listening' && typeof window.ListeningTasksModule?.renderHub === 'function') {
      gridEl.classList.remove('is-writing-grid', 'is-speaking-grid');
      gridEl.classList.add('is-listening-grid');
      window.ListeningTasksModule.renderHub(tabsEl, gridEl);
      return;
    }

    gridEl.classList.remove('is-listening-grid', 'is-writing-grid', 'is-speaking-grid');
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
      applyThemePreference(b.dataset.setTheme, false);
    }));
    document.querySelectorAll('[data-set-font]').forEach((b) => b.addEventListener('click', () => setFontScale(b.dataset.setFont, false)));
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

    // Active Skill persistence (Reading | Listening | Writing)
    const SKILL_STORAGE_KEY = 'totoro_active_skill_v1';
    let activeSkill = 'Reading';
    let activeMode = 'Overview'; // 'Overview' (Home chung) | 'Reading' | 'Listening' | 'Writing'
    try {
      const urlSkill = detectSkillFromUrlTaskParam();
      const savedSkill = localStorage.getItem(SKILL_STORAGE_KEY);
      if (urlSkill) activeSkill = urlSkill;
      else if (savedSkill === 'Listening' || savedSkill === 'Reading' || savedSkill === 'Writing' || savedSkill === 'Speaking') activeSkill = savedSkill;
    } catch (_) {}

    function syncSkillDropdownUI(modeVal) {
      const isGlobal = modeVal === 'Overview';
      document.body.classList.toggle('is-global-home', isGlobal);

      const chipTxt = document.getElementById('header-mode-chip-text');
      if (chipTxt) chipTxt.textContent = isGlobal ? 'HOME' : String(modeVal).toUpperCase();

      const homeTabLbl = document.getElementById('nav-home-tab-label');
      if (homeTabLbl) homeTabLbl.textContent = 'Tổng quan';

      document.querySelectorAll('#nav-global-skills [data-global-tab]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.globalTab === modeVal);
      });

      document.querySelectorAll('[data-tot-skill]').forEach((btn) => {
        const s = btn.dataset.totSkill;
        const isCurrent = s === modeVal;
        btn.classList.toggle('active', isCurrent);
        btn.setAttribute('aria-current', isCurrent ? 'true' : 'false');
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
          window.__VOCAB_BRIDGE__?.showToast?.('Đang ở HOME — Tổng quan mục tiêu, kế hoạch & tiến độ học');
        }
        return;
      }

      const low = String(skill || '').toLowerCase();
      const next = low === 'speaking' ? 'Speaking' : (low === 'writing' ? 'Writing' : (low === 'listening' ? 'Listening' : 'Reading'));
      activeSkill = next;
      activeMode = next;
      html.setAttribute('data-skill', next.toLowerCase());
      try { localStorage.setItem(SKILL_STORAGE_KEY, next); } catch (_) {}

      syncSkillDropdownUI(next);
      switchHomeScope(next.toLowerCase());

      const coreId = next.toLowerCase();
      if ((coreId === 'reading' || coreId === 'listening') && window.AppCore?.skills && window.AppCore.skills.getActiveId?.() !== coreId) {
        window.AppCore.skills.switchTo(coreId).then(() => window.AppCore?.renderSkillModesMenu?.()).catch(() => {});
      }

      if (!opts.silent) {
        const isRes = Boolean(window.AccessPolicy?.isRestricted?.());
        if (next === 'Speaking') {
          window.__VOCAB_BRIDGE__?.showToast?.(isRes
            ? 'Đã chuyển sang IELTS Speaking — 48 bộ đề thi thật Cambridge 15–20 (Part 1 & Part 3)!'
            : 'Đã chuyển sang IELTS Speaking — Story 01, 30 Spoken Chunks, Task 4 Bước & 14 Cue Cards!');
        } else if (next === 'Writing') {
          window.__VOCAB_BRIDGE__?.showToast?.(isRes
            ? 'Đã chuyển sang IELTS Writing — 28 đề Task 1 Cambridge 14–20, 57 đề Task 2 & 16 Full Test!'
            : 'Đã chuyển sang IELTS Writing — 41 Module Flow Ideas, Grammar & 57 đề Task 2!');
        } else if (next === 'Listening') {
          window.__VOCAB_BRIDGE__?.showToast?.(isRes
            ? 'Đã chuyển sang IELTS Listening — Kho 133 Full Đề nghe, Dictation & Task tự tạo!'
            : 'Đã chuyển sang IELTS Listening — 3.864 từ & 131 Task thực chiến!');
        } else {
          window.__VOCAB_BRIDGE__?.showToast?.(isRes
            ? 'Đã chuyển sang IELTS Reading (MY LIST · Task tự tạo · Kho đề Practice)'
            : 'Đã chuyển sang IELTS Reading (Reading Home · Flashcard · Task · Practice)');
        }
      }
      if (window.AccessPolicy?.isRestricted?.() && (next === 'Writing' || next === 'Speaking') && (activeView === 'flashcard' || activeView === 'task')) {
        switchView('practice', { fromUser: false });
        return;
      }
      if (activeView === 'flashcard' && next === 'Writing') window.WritingStudio?.renderFlashcardWorkspace?.();
      if (activeView === 'flashcard' && next === 'Speaking') window.SpeakingStudio?.renderFlashcardWorkspace?.();
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
        } else if (s === 'Reading' || s === 'Listening' || s === 'Writing' || s === 'Speaking') {
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
      recordDailyActivity({ words: 1, mastered: lvl === 3 ? 1 : 0 });
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
      if (viewName && viewName !== 'home') {
        const vLbl = viewName === 'flashcard' ? 'Flashcard' : (viewName === 'task' ? 'Task' : 'Practice');
        recordLastSession({ skill, view: viewName, label: `${skill} · ${vLbl}` });
      }
    },
    recordLastSession,
    resumeLastSession,
    setHomeHistoryFilter,
    getActiveHomeScope: () => activeHomeScope,
    getActiveMode: () => (typeof window.__TOTORO_GET_MODE__ === 'function' ? window.__TOTORO_GET_MODE__() : 'Overview'),
    getActiveView: () => activeView,
    getActiveSkill: () => (typeof window.__TOTORO_GET_SKILL__ === 'function' ? window.__TOTORO_GET_SKILL__() : (html.getAttribute('data-skill') === 'writing' ? 'Writing' : (html.getAttribute('data-skill') === 'listening' ? 'Listening' : 'Reading'))),
    setActiveSkill: (skill, opts) => (typeof window.__TOTORO_SET_SKILL__ === 'function' ? window.__TOTORO_SET_SKILL__(skill, opts) : undefined),
    onUserEntered,
    setStyleMode,
    setPalette,
    setMotion,
    setFontScale,
    applyThemePreference,
    setListeningPracticeSub,
    openDictationStudio,
    recordDailyActivity,
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

  window.addEventListener('app:curriculum-ready', () => {
    try {
      renderInlineTaskHub();
      if (activeView === 'home') renderHomeDashboard();
    } catch (_) {}
  });
  window.addEventListener('app:policy-applied', () => {
    try {
      renderInlineTaskHub();
      if (activeView === 'home') renderHomeDashboard();
    } catch (_) {}
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wireUI);
  else wireUI();
})();
