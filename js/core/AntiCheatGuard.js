/* =========================================================
   CORE OOP: AntiCheatGuard — Reusable Exam Discipline Guard
   Provides copy/paste guards & 2-strike tab-leave tracking for ALL skills.
   ========================================================= */
(function () {
  let lastEditableInteractionAt = 0;
  let lastViewportResizeAt = 0;
  let editableCurrentlyFocused = false;
  let lastVisualHeight = (typeof window !== 'undefined' && window.visualViewport) ? window.visualViewport.height : 0;

  function isEditableElement(el) {
    if (!el || el.nodeType !== 1) return false;
    const tag = (el.tagName || '').toUpperCase();
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || Boolean(el.isContentEditable);
  }

  function isTouchMobileOrTablet() {
    try {
      const ua = navigator.userAgent || '';
      const isIpadDesktopUA = navigator.platform === 'MacIntel' && (navigator.maxTouchPoints || 0) > 1;
      const isMobileUA = /iPad|iPhone|iPod|Android|Mobile|Tablet/i.test(ua);
      const isCoarsePointer = Boolean(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      return isIpadDesktopUA || isMobileUA || (isCoarsePointer && (navigator.maxTouchPoints || 0) > 0);
    } catch (_) {
      return false;
    }
  }

  if (typeof document !== 'undefined' && !window.__softKeyboardGuardBound) {
    window.__softKeyboardGuardBound = true;
    document.addEventListener('focusin', (e) => {
      if (isEditableElement(e.target)) {
        editableCurrentlyFocused = true;
        lastEditableInteractionAt = Date.now();
      }
    }, true);
    document.addEventListener('focusout', (e) => {
      if (isEditableElement(e.target)) {
        editableCurrentlyFocused = false;
        lastEditableInteractionAt = Date.now();
      }
    }, true);
    ['input', 'keydown', 'compositionend'].forEach((evt) => {
      document.addEventListener(evt, (e) => {
        if (isEditableElement(e.target)) {
          lastEditableInteractionAt = Date.now();
        }
      }, true);
    });
    if (window.visualViewport) {
      lastVisualHeight = window.visualViewport.height;
      window.visualViewport.addEventListener('resize', () => {
        const nextH = window.visualViewport.height;
        if (Math.abs(nextH - lastVisualHeight) >= 40) {
          lastViewportResizeAt = Date.now();
        }
        lastVisualHeight = nextH;
      });
    }
  }

  function handleSafeWindowBlur(onRealBlur) {
    if (typeof onRealBlur !== 'function') return;
    if (document.hidden) return;

    // On non-touch Desktop (PC / Mac), keep immediate strict window-blur enforcement.
    if (!isTouchMobileOrTablet()) {
      onRealBlur();
      return;
    }

    // On iPad / iPhone / Android tablets, dismissing or pulling down the virtual
    // keyboard fires a spurious window.blur while the page remains visible (!document.hidden).
    const hadEditableFocus = editableCurrentlyFocused || isEditableElement(document.activeElement);
    const now = Date.now();
    const recentKeyboardActivity =
      hadEditableFocus ||
      (now - lastEditableInteractionAt < 2500) ||
      (now - lastViewportResizeAt < 2500);

    setTimeout(() => {
      if (document.hidden) return; // visibilitychange already handled genuine tab/app switch
      try {
        if (typeof document.hasFocus === 'function' && document.hasFocus()) return;
      } catch (_) {}
      const after = Date.now();
      if (
        recentKeyboardActivity ||
        (after - lastEditableInteractionAt < 2500) ||
        (after - lastViewportResizeAt < 2500)
      ) {
        return; // Soft keyboard opened/dismissed on iPad/mobile — NOT a real tab leave
      }
      onRealBlur();
    }, 280);
  }

  class AntiCheatGuard {
    constructor(options = {}) {
      this._isBypassedFn = typeof options.isBypassed === 'function' ? options.isBypassed : () => false;
      this._showToastFn = typeof options.showToast === 'function' ? options.showToast : () => {};
    }

    isBypassed() {
      try { return Boolean(this._isBypassedFn()); } catch (_) { return false; }
    }

    attachNoPaste(el, label = 'bài làm') {
      if (!el || el.dataset.coreNoPasteBound === '1') return;
      el.dataset.coreNoPasteBound = '1';
      const block = (e) => {
        if (this.isBypassed()) return;
        e.preventDefault();
        this._showToastFn(`Không được dán/kéo chữ vào ${label} — hãy tự gõ!`);
      };
      el.addEventListener('paste', block);
      el.addEventListener('drop', block);
      el.addEventListener('beforeinput', (e) => {
        if (this.isBypassed()) return;
        if (e.inputType === 'insertFromPaste' || e.inputType === 'insertFromDrop') block(e);
      });
    }

    createTabLeaveSession({ onStrike1, onStrike2, maxStrikes = 2, cooldownMs = 1200 } = {}) {
      let strikes = 0;
      let lastAt = 0;
      let active = false;

      const handle = (reason) => {
        if (!active || this.isBypassed()) return;
        const now = Date.now();
        if (now - lastAt < cooldownMs) return;
        lastAt = now;
        strikes += 1;
        if (strikes < maxStrikes) {
          onStrike1?.(strikes, reason);
        } else {
          onStrike2?.(strikes, reason);
        }
      };

      const onVis = () => { if (document.hidden) handle('Chuyển tab khi đang làm bài'); };
      const onBlur = () => {
        handleSafeWindowBlur(() => {
          if (!document.hidden) handle('Rời cửa sổ khi đang làm bài');
        });
      };

      return {
        start: () => {
          if (active) return;
          active = true;
          strikes = 0;
          document.addEventListener('visibilitychange', onVis);
          window.addEventListener('blur', onBlur);
        },
        stop: () => {
          if (!active) return;
          active = false;
          document.removeEventListener('visibilitychange', onVis);
          window.removeEventListener('blur', onBlur);
        },
        getStrikes: () => strikes,
      };
    }
  }

  AntiCheatGuard.isTouchMobileOrTablet = isTouchMobileOrTablet;
  AntiCheatGuard.handleSafeWindowBlur = handleSafeWindowBlur;

  window.CoreAntiCheatGuard = AntiCheatGuard;
})();
