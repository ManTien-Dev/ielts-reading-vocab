/* Chuyển động giao diện: dùng transform/opacity và tôn trọng cài đặt giảm chuyển động. */
(() => {
  'use strict';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const counterFrames = new WeakMap();
  const motion = {
    get enabled() { return !reduced.matches; },
    transition(change) {
      if (typeof change !== 'function') return null;
      if (this.enabled && typeof document.startViewTransition === 'function') {
        return document.startViewTransition(change);
      }
      change();
      return null;
    },
    enterCard(direction = 1) {
      const scene = document.getElementById('fc-scene');
      if (!scene || !this.enabled || scene.style.display === 'none') return;
      scene.getAnimations?.().forEach(animation => animation.cancel());
      if (typeof scene.animate !== 'function') return;
      scene.animate([
        { opacity: 0, transform: `translate3d(${direction * 38}px, 0, 0) scale(.975)` },
        { opacity: 1, transform: 'translate3d(0, 0, 0) scale(1)' }
      ], { duration: 420, easing: 'cubic-bezier(.18, 1.3, .32, 1)' });
    },
    countTo(element, target, duration = 420, suffix = '') {
      if (!element) return;
      if (counterFrames.has(element)) cancelAnimationFrame(counterFrames.get(element));
      if (!this.enabled || duration <= 0) { element.textContent = target + suffix; return; }
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
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button:not(:disabled)');
    if (!button || !motion.enabled) return;
    const rect = button.getBoundingClientRect();
    const ripple = document.createElement('span');
    ripple.className = 'motion-ripple';
    ripple.style.left = `${event.clientX - rect.left}px`;
    ripple.style.top = `${event.clientY - rect.top}px`;
    button.appendChild(ripple);
    const cleanupRipple = () => ripple.remove();
    ripple.addEventListener('animationend', cleanupRipple, { once: true });
    setTimeout(cleanupRipple, 650);
  });

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
      screen.addEventListener('animationend', () => screen.classList.remove('motion-screen-enter'), { once: true });
    }).observe(screen, { attributes: true, attributeFilter: ['class'] });
  });

  // Vuốt ngang trên thẻ để chuyển từ, vẫn giữ cuộn dọc ở mặt sau.
  const cardScene = document.getElementById('fc-scene');
  let touchStart = null;
  cardScene?.addEventListener('touchstart', event => {
    if (event.touches && event.touches.length > 1) { touchStart = null; return; }
    const touch = event.changedTouches[0];
    touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }, { passive: true });
  cardScene?.addEventListener('touchcancel', () => {
    touchStart = null;
  }, { passive: true });
  cardScene?.addEventListener('touchend', event => {
    if (!touchStart || !document.getElementById('screen-study')?.classList.contains('active')) {
      touchStart = null;
      return;
    }
    if (document.querySelector('.modal-overlay.open') || document.body.classList.contains('is-multitab-blocked')) {
      touchStart = null;
      return;
    }
    const touch = event.changedTouches[0];
    if (!touch) { touchStart = null; return; }
    const dx = touch.clientX - touchStart.x;
    const dy = touch.clientY - touchStart.y;
    touchStart = null;
    if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    event.preventDefault();
    if (dx < 0) window.nextCard?.();
    else window.prevCard?.();
  }, { passive: false });
})();
