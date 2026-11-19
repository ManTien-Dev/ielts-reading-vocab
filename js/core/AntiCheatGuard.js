/* =========================================================
   CORE OOP: AntiCheatGuard — Reusable Exam Discipline Guard
   Provides copy/paste guards & 2-strike tab-leave tracking for ALL skills.
   ========================================================= */
(function () {
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
      const onBlur = () => { if (!document.hidden) handle('Rời cửa sổ khi đang làm bài'); };

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

  window.CoreAntiCheatGuard = AntiCheatGuard;
})();
