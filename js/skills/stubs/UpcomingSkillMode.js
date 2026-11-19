/* =========================================================
   SKILL PLUGIN STUBS: Upcoming Modes (Listening, Writing, Speaking)
   Clean OOP placeholders registered in SkillRegistry without disturbing live Reading.
   ========================================================= */
(function () {
  const { BaseSkillMode } = window.CoreSkillOOP || {};
  if (!BaseSkillMode) return;

  class UpcomingSkillMode extends BaseSkillMode {
    constructor(config, core) {
      super({
        ...config,
        status: 'upcoming',
      }, core);
    }

    async loadData() {
      return null;
    }
  }

  window.UpcomingSkillMode = UpcomingSkillMode;
})();
