/* =========================================================
   CORE OOP: BaseSkillMode, BaseRecallStrategy, BaseExamEngine & SkillRegistry
   Plugin contracts enabling Reading, Listening, Writing, Speaking isolation.
   ========================================================= */
(function () {
  class BaseRecallStrategy {
    constructor(skillId) {
      this.skillId = skillId;
    }
    open(_item, _ctx) {
      throw new Error(`[${this.skillId}] BaseRecallStrategy.open() must be implemented`);
    }
    cleanup() {}
  }

  class BaseExamEngine {
    constructor(skillId) {
      this.skillId = skillId;
    }
    start(_config) {
      throw new Error(`[${this.skillId}] BaseExamEngine.start() must be implemented`);
    }
    stop() {}
    isActive() { return false; }
  }

  class BaseSkillMode {
    constructor(config = {}, core = null) {
      this.id = String(config.id || 'unknown');
      this.label = String(config.label || this.id);
      this.shortLabel = String(config.shortLabel || this.label);
      this.status = config.status || 'upcoming'; // 'live' | 'beta' | 'upcoming'
      this.pedagogyType = config.pedagogyType || 'receptive';
      this.description = config.description || '';
      this.core = core;
      this._mounted = false;
    }

    async loadData() {
      return this.core?.loader?.ensureSkillLoaded(this.id);
    }

    mount() {
      this._mounted = true;
    }

    unmount() {
      this._mounted = false;
    }

    isMounted() {
      return this._mounted;
    }

    getScopes() {
      return [];
    }

    getTaskSuites() {
      return [];
    }

    getStats() {
      return { totalWords: 0, masteredWords: 0, totalTasks: 0, completedTasks: 0 };
    }

    createRecallStrategy(_scopeKey) {
      return null;
    }

    createExamEngine(_taskOrScope) {
      return null;
    }

    exportCloudState() {
      return {};
    }

    importCloudState(_cloudSkillData) {
      return false;
    }
  }

  class SkillRegistry {
    constructor(eventBus = null) {
      this._modes = new Map();
      this._activeId = null;
      this._bus = eventBus;
    }

    register(modeInstance) {
      if (!modeInstance || !(modeInstance instanceof BaseSkillMode)) {
        throw new Error('SkillRegistry.register requires a BaseSkillMode instance');
      }
      this._modes.set(modeInstance.id, modeInstance);
      this._bus?.emit('skill:registered', { id: modeInstance.id, status: modeInstance.status });
      return modeInstance;
    }

    get(skillId) {
      return this._modes.get(skillId) || null;
    }

    list() {
      return Array.from(this._modes.values());
    }

    listLive() {
      return this.list().filter((m) => m.status === 'live');
    }

    getActive() {
      return this._activeId ? this.get(this._activeId) : null;
    }

    getActiveId() {
      return this._activeId || 'reading';
    }

    async switchTo(skillId) {
      const next = this.get(skillId);
      if (!next) return { ok: false, reason: 'not_found' };
      if (next.status !== 'live') {
        this._bus?.emit('skill:upcoming_clicked', { id: next.id, label: next.label });
        return { ok: false, reason: 'upcoming', mode: next };
      }
      const prev = this.getActive();
      if (prev && prev.id === next.id && prev.isMounted()) {
        return { ok: true, mode: next };
      }
      await next.loadData();
      if (prev && prev.isMounted()) prev.unmount();
      this._activeId = next.id;
      next.mount();
      this._bus?.emit('skill:changed', { from: prev?.id || null, to: next.id });
      return { ok: true, mode: next };
    }
  }

  window.CoreSkillOOP = {
    BaseRecallStrategy,
    BaseExamEngine,
    BaseSkillMode,
    SkillRegistry,
  };
})();
