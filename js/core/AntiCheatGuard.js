/* =========================================================
   CORE OOP: AntiCheatGuard — Reusable Exam Discipline Guard
   Provides copy/paste guards & 2-strike tab-leave tracking for ALL skills.
   ========================================================= */
(function () {
  const SOFT_BLUR_GRACE_MS = 3000;
  const MAX_GRACE_RECOVERIES_PER_WINDOW = 2;
  const GRACE_WINDOW_MS = 3 * 60 * 1000;

  let lastEditableInteractionAt = 0;
  let lastViewportResizeAt = 0;
  let editableCurrentlyFocused = false;
  let lastVisualHeight = (typeof window !== 'undefined' && window.visualViewport) ? window.visualViewport.height : 0;
  let graceRecoveryTimestamps = [];
  let pendingBlurTimer = null;
  let pendingBlurIsTouchKb = false;

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

  function pruneGraceHistory(now) {
    graceRecoveryTimestamps = graceRecoveryTimestamps.filter((ts) => (now - ts) < GRACE_WINDOW_MS);
  }

  function cancelPendingBlur(countAsGraceRecovery) {
    if (!pendingBlurTimer) return;
    clearTimeout(pendingBlurTimer);
    pendingBlurTimer = null;
    const wasTouchKb = pendingBlurIsTouchKb;
    pendingBlurIsTouchKb = false;
    if (countAsGraceRecovery && !wasTouchKb) {
      const now = Date.now();
      pruneGraceHistory(now);
      graceRecoveryTimestamps.push(now);
    }
  }

  function resetSoftBlurBudget() {
    cancelPendingBlur(false);
    graceRecoveryTimestamps = [];
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
    // Returning focus within the 3s grace window cancels the pending blur cleanly
    window.addEventListener('focus', () => {
      if (pendingBlurTimer) {
        cancelPendingBlur(true);
      }
    });
    // Real tab switch / minimize cancels any pending soft-blur timer (visibilitychange handles immediately)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && pendingBlurTimer) {
        cancelPendingBlur(false);
      }
    });
  }

  function handleSafeWindowBlur(onRealBlur) {
    if (typeof onRealBlur !== 'function') return;
    if (document.hidden) return;

    const now = Date.now();
    const isTouch = isTouchMobileOrTablet();
    const hadEditableFocus = editableCurrentlyFocused || isEditableElement(document.activeElement);
    const recentKeyboardActivity = isTouch && (
      hadEditableFocus ||
      (now - lastEditableInteractionAt < 2500) ||
      (now - lastViewportResizeAt < 2500)
    );

    // 1. iPad / mobile virtual keyboard dismissal: ignore cleanly without burning grace budget
    if (recentKeyboardActivity) {
      cancelPendingBlur(false);
      pendingBlurIsTouchKb = true;
      pendingBlurTimer = setTimeout(() => {
        pendingBlurTimer = null;
        pendingBlurIsTouchKb = false;
        if (document.hidden) return;
        try {
          if (typeof document.hasFocus === 'function' && document.hasFocus()) return;
        } catch (_) {}
        const after = Date.now();
        if (
          hadEditableFocus ||
          (after - lastEditableInteractionAt < 2500) ||
          (after - lastViewportResizeAt < 2500)
        ) {
          return;
        }
        onRealBlur();
      }, 280);
      return;
    }

    // 2. Light window.blur while tab stays visible (!document.hidden):
    //    Allow up to 2 quick (<3s) recoveries per 3-minute window (e.g. dismissing OS notification
    //    or adjusting taskbar/Control Center volume). Beyond 2 recoveries or >= 3s away -> penalize.
    pruneGraceHistory(now);
    if (graceRecoveryTimestamps.length >= MAX_GRACE_RECOVERIES_PER_WINDOW) {
      cancelPendingBlur(false);
      onRealBlur();
      return;
    }

    cancelPendingBlur(false);
    pendingBlurIsTouchKb = false;
    pendingBlurTimer = setTimeout(() => {
      pendingBlurTimer = null;
      pendingBlurIsTouchKb = false;
      if (document.hidden) return; // visibilitychange already handled genuine tab/app switch
      const after = Date.now();
      if (isTouch && ((after - lastEditableInteractionAt < 2500) || (after - lastViewportResizeAt < 2500))) {
        return;
      }
      try {
        if (typeof document.hasFocus === 'function' && document.hasFocus()) {
          pruneGraceHistory(after);
          graceRecoveryTimestamps.push(after);
          return;
        }
      } catch (_) {}
      onRealBlur();
    }, SOFT_BLUR_GRACE_MS);
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
  AntiCheatGuard.resetSoftBlurBudget = resetSoftBlurBudget;
  AntiCheatGuard.getGraceRecoveriesUsed = () => {
    pruneGraceHistory(Date.now());
    return graceRecoveryTimestamps.length;
  };

  window.CoreAntiCheatGuard = AntiCheatGuard;
})();
