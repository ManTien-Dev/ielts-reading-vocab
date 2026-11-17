/* Chuyển động giao diện: dùng transform/opacity và tôn trọng cài đặt giảm chuyển động. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const counterFrames = new WeakMap();
  const motion = {
    get enabled() { return !reduced.matches; },
    transition(change) {
      if (this.enabled && typeof document.startViewTransition === 'function') {
        return document.startViewTransition(change);
      }
      change();
      return null;
    },
    enterCard(direction = 1) {
      const scene = document.getElementById('fc-scene');
      if (!scene || !this.enabled || scene.style.display === 'none') return;
      scene.getAnimations().forEach(animation => animation.cancel());
      scene.animate([
        { opacity: 0, transform: `translate3d(${direction * 38}px, 0, 0) scale(.975)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.18, 1.3, .32, 1)' });
    },
    countTo(element, target, duration = 420, suffix = '') {
      if (!element) return;
      if (counterFrames.has(element)) cancelAnimationFrame(counterFrames.get(element));
      if (!this.enabled) { element.textContent = target + suffix; return; }
      const from = Number.parseInt(element.textContent, 10) || 0;
      const start = performance.now();
      const step = now => {
        if (!element.isConnected) return;
        const t = Math.min(1, (now - start) / duration);
        element.textContent = Math.round(from + (target - from) * (1 - Math.pow(1 - t, 3))) + suffix;
        if (t < 1) counterFrames.set(element, requestAnimationFrame(step));
      };
      counterFrames.set(element, requestAnimationFrame(step));
    }
  };
  window.IELTSMotion = motion;

  // Vệt sáng chỉ xuất hiện tại điểm nhấn và tự được dọn sau animation.
  document.addEventListener('pointerdown', event => {
    const button = event.target.closest('button:not(:disabled)');
    if (!button || !motion.enabled) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'motion-ripple';
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    ripple.addEventListener('animationend', () => ripple.remove(), { once: true });
  });

  // Thanh chọn chuyển vị trí khi tab, kích thước cửa sổ hoặc kỹ năng thay đổi.
  const navs = [...document.querySelectorAll('.segmented-nav')];
  const updateNav = nav => {
    if (getComputedStyle(nav).display === 'none') return;
    const selected = nav.querySelector('.segmented-item.active');
    if (!selected) return;
    const x = `${selected.offsetLeft}px`;
    const width = `${selected.offsetWidth}px`;
    if (nav.style.getPropertyValue('--motion-indicator-x') !== x) nav.style.setProperty('--motion-indicator-x', x);
    if (nav.style.getPropertyValue('--motion-indicator-w') !== width) nav.style.setProperty('--motion-indicator-w', width);
  };
  navs.forEach(nav => {
    nav.classList.add('motion-nav');
    new MutationObserver(() => requestAnimationFrame(() => updateNav(nav)))
      .observe(nav, { attributes: true, attributeFilter: ['style', 'class'], subtree: true });
    updateNav(nav);
  });
  window.addEventListener('resize', () => navs.forEach(updateNav), { passive: true });

  const screens = document.querySelectorAll('.screen');
  screens.forEach(screen => {
    let wasActive = screen.classList.contains('active');
    new MutationObserver(() => {
    const isActive = screen.classList.contains('active');
    if (!isActive || wasActive || !motion.enabled) { wasActive = isActive; return; }
    wasActive = true;
    screen.classList.remove('motion-screen-enter');
    void screen.offsetWidth;
    screen.classList.add('motion-screen-enter');
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  });

  // Chỉ cho các thẻ nội dung xuất hiện khi chúng đi vào vùng nhìn.
  if (motion.enabled && 'IntersectionObserver' in window) {
    const reveal = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('motion-revealed');
        reveal.unobserve(entry.target);
      });
    }, { threshold: .1 });
    document.querySelectorAll('.hub-card, .skill-hero-card').forEach(card => {
      card.classList.add('motion-reveal');
      reveal.observe(card);
    });
  }

  // Vuốt ngang trên thẻ để chuyển từ, vẫn giữ cuộn dọc ở mặt sau.
  const cardScene = document.getElementById('fc-scene');
  let touchStart = null;
  cardScene?.addEventListener('touchstart', event => {
    const touch = event.changedTouches[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  cardScene?.addEventListener('touchend', event => {
    if (!touchStart || !document.getElementById('screen-study')?.classList.contains('active')) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    event.preventDefault();
    if (dx < 0) window.nextCard?.();
    else window.prevCard?.();
  }, { passive: false });

  // Hướng dẫn ngắn cho lần mở đầu; cờ hoàn thành chỉ lưu khi người học đóng.
  const ONBOARDING_KEY = 'ielts_onboarding_seen_v1';
  try {
    if (!localStorage.getItem(ONBOARDING_KEY)) {
      const dialog = document.getElementById('onboarding-dialog');
      const steps = [
        ['Học bằng thẻ', 'Chạm thẻ để xem nghĩa. Dùng phím 1, 2, 3 để tự đánh giá sau khi lật thẻ.'],
        ['Luyện theo ngữ cảnh', 'Sang Đoán nghĩa để tìm manh mối trong câu, rồi trao đổi với trợ giảng AI.'],
        ['Lưu tiến độ', 'Bài làm và tiến độ được lưu trên thiết bị này. Bạn có thể đổi giao diện trong Tùy chọn.']
      ];
      if (dialog) {
        let index = 0;
        const title = dialog.querySelector('[data-onboarding-title]');
        const body = dialog.querySelector('[data-onboarding-body]');
        const counter = dialog.querySelector('[data-onboarding-counter]');
        const next = dialog.querySelector('[data-onboarding-next]');
        const render = () => {
          title.textContent = steps[index][0];
          body.textContent = steps[index][1];
          counter.textContent = `${index + 1} / ${steps.length}`;
          next.textContent = index === steps.length - 1 ? 'Bắt đầu học' : 'Tiếp tục';
        };
        render();
        next.addEventListener('click', () => {
          if (index < steps.length - 1) { index++; render(); }
          else dialog.close();
        });
        dialog.addEventListener('close', () => localStorage.setItem(ONBOARDING_KEY, '1'), { once: true });
        setTimeout(() => { if (!dialog.open) dialog.showModal(); }, 700);
      }
    }
  } catch (_) { /* Chế độ riêng tư có thể chặn lưu trữ. */ }
})();
