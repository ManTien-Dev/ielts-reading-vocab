/* =========================================================
   CORE OOP BOOTSTRAP: window.AppCore
   Wires EventBus, LazyDataLoader, AudioEngine, AntiCheatGuard, SkillRegistry
   and mounts ReadingMode cleanly while keeping Reading 100% isolated for active students.
   ========================================================= */
(function () {
  const bus = new window.CoreEventBus();
  const loader = new window.CoreLazyDataLoader('20261119t');
  const audio = new window.CoreAudioEngine();
  const antiCheat = new window.CoreAntiCheatGuard({
    isBypassed: () => Boolean(window.__VOCAB_BRIDGE__?.isExamAntiCheatBypassed?.()),
    showToast: (msg) => window.__VOCAB_BRIDGE__?.showToast?.(msg),
  });
  const skills = new window.CoreSkillOOP.SkillRegistry(bus);

  const core = {
    version: '2.0-oop-phase1',
    bus,
    loader,
    audio,
    antiCheat,
    skills,
    renderSkillModesMenu() {
      const container = document.getElementById('menu-skill-modes-list');
      if (!container) return;
      const esc = window.__VOCAB_BRIDGE__?.escapeHtml || ((s) => String(s || ''));
      const activeId = skills.getActiveId();
      container.innerHTML = skills.list().map((m) => {
        const isLive = m.status === 'live';
        const isActive = m.id === activeId;
        const badge = isActive
          ? '<span class="skill-mode-pill is-live">Đang học</span>'
          : (isLive
            ? '<span class="skill-mode-pill is-ready">Sẵn sàng</span>'
            : '<span class="skill-mode-pill is-soon">Sắp mở</span>');
        return `
          <button type="button" class="skill-mode-row ${isActive ? 'is-active' : ''} ${!isLive ? 'is-upcoming' : ''}" onclick="AppCore.handleSkillMenuClick('${esc(m.id)}')">
            <div class="skill-mode-row-main">
              <strong>${esc(m.label)}</strong>
            </div>
            ${badge}
          </button>
        `;
      }).join('');
    },
    async handleSkillMenuClick(skillId) {
      const res = await skills.switchTo(skillId);
      if (!res.ok && res.reason === 'upcoming') {
        window.__VOCAB_BRIDGE__?.showToast?.(`${res.mode.label} đang được thiết kế riêng — hiện bạn có thể học IELTS Reading & Listening nhé!`);
      } else if (res.ok) {
        this.renderSkillModesMenu();
        const pretty = skillId === 'listening' ? 'Listening' : 'Reading';
        if (window.TotoroUI?.getActiveSkill?.() !== pretty) {
          window.TotoroUI?.setActiveSkill?.(pretty, { silent: true });
        }
      }
    },
  };

  // Register live ReadingMode + live ListeningMode + clean OOP stubs for Writing, Speaking
  const readingMode = new window.ReadingSkillMode(core);
  skills.register(readingMode);

  if (window.CoreSkillOOP?.BaseSkillMode) {
    const listeningMode = new window.CoreSkillOOP.BaseSkillMode({
      id: 'listening',
      label: 'IELTS Listening',
      shortLabel: 'Listening',
      status: 'live',
      pedagogyType: 'audio_shadowing_stt',
      description: 'Nghe mẫu → Nói lại từ bằng AI Mic (Test 1 Shadowing · khuếch đại giọng nhỏ).',
    }, core);
    skills.register(listeningMode);
  }

  if (window.UpcomingSkillMode) {
    skills.register(new window.UpcomingSkillMode({
      id: 'writing',
      label: 'IELTS Writing',
      shortLabel: 'Writing',
      pedagogyType: 'productive_collocations_flow',
      description: 'Cụm từ học thuật C1–C2 & mạch lập luận nhân quả (Task 1 & Task 2).',
    }, core));

    skills.register(new window.UpcomingSkillMode({
      id: 'speaking',
      label: 'IELTS Speaking',
      shortLabel: 'Speaking',
      pedagogyType: 'spoken_chunks_5axes',
      description: 'Spoken chunks tự nhiên, 5 Trục Tư Duy Part 1 & phản xạ nói 3 nhịp.',
    }, core));
  }

  // Mount Reading immediately as the active isolated skill
  skills.switchTo('reading');

  window.AppCore = core;
})();
