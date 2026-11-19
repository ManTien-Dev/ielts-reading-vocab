/* =========================================================
   CORE OOP: EventBus — Lightweight Pub/Sub for Multi-Skill Shell
   ========================================================= */
(function () {
  class EventBus {
    constructor() {
      this._listeners = new Map();
    }

    on(event, handler) {
      if (!event || typeof handler !== 'function') return () => {};
      if (!this._listeners.has(event)) this._listeners.set(event, new Set());
      const set = this._listeners.get(event);
      set.add(handler);
      return () => this.off(event, handler);
    }

    once(event, handler) {
      const off = this.on(event, (payload) => {
        off();
        handler(payload);
      });
      return off;
    }

    off(event, handler) {
      const set = this._listeners.get(event);
      if (set) set.delete(handler);
    }

    emit(event, payload) {
      const set = this._listeners.get(event);
      if (!set || !set.size) return;
      set.forEach((fn) => {
        try { fn(payload); } catch (err) { console.warn(`[EventBus:${event}]`, err); }
      });
    }
  }

  window.CoreEventBus = EventBus;
})();
