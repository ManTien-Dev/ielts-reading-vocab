/* =========================================================
   SKILL PLUGIN: ReadingMode (Live Production Reading Adapter)
   Wraps the live 95.81% IELTS Academic Reading engine under BaseSkillMode
   without breaking any existing student progress or 151 E2E tests.
   ========================================================= */
(function () {
  const { BaseSkillMode } = window.CoreSkillOOP || {};
  if (!BaseSkillMode) return;

  class ReadingMode extends BaseSkillMode {
    constructor(core) {
      super({
        id: 'reading',
        label: 'IELTS Reading',
        shortLabel: 'Reading',
        status: 'live',
        pedagogyType: 'receptive_paraphrase',
        description: '4.489 họ từ phủ 95,81% bài đọc IELTS Academic + 110 Tasks thuần theo 4 bộ + Paraphrase đề thi thật.',
      }, core);
    }

    async loadData() {
      // Reading data is eagerly bundled for instant launch; register in cache cleanly
      if (window.APP_DATA) {
        this.core?.loader?.setCached('skill:reading', {
          vocab: window.APP_DATA,
          tasks: window.APP_TASKS_DATA || null,
        });
      }
      return this.core?.loader?.getCached('skill:reading');
    }

    getScopes() {
      const d = window.APP_DATA || {};
      const f2 = d.file2_families_3500 || [];
      const f1 = d.file1_paraphrase_1500 || [];
      return [
        { key: 'foundation', name: 'Từ Vựng Nền Tảng', count: Math.min(1500, f2.length) },
        { key: 'academic', name: 'Từ Vựng Học Thuật', count: f2.slice(1500, 2500).length },
        { key: 'paraphrase', name: 'Từ Vựng Paraphrase', count: f1.length },
        { key: 'advanced', name: 'Từ Vựng Chuyên Sâu', count: f2.slice(2500).length },
        { key: 'signal_words', name: 'Từ Nối Chỉ Hướng Nghĩa', count: (d.signal_words || []).length },
      ];
    }

    getTaskSuites() {
      if (!window.TasksModule?.getTasksByScope) return [];
      return ['foundation', 'academic', 'paraphrase', 'advanced'].map((key) => ({
        scopeKey: key,
        tasks: window.TasksModule.getTasksByScope(key),
      }));
    }

    getStats() {
      const d = window.APP_DATA || {};
      const allLemmas = new Set([
        ...(d.file1_paraphrase_1500 || []).map((w) => String(w.lemma || '').toLowerCase()),
        ...(d.file2_families_3500 || []).map((w) => String(w.lemma || '').toLowerCase()),
      ]);
      const amap = window.__VOCAB_BRIDGE__?.getAssessmentsMap?.() || {};
      const masteredIds = Object.keys(amap).filter((k) => amap[k] === 3).length;
      const allTasks = window.TasksModule?.getAllCatalogTasks?.() || [];
      return {
        totalWords: allLemmas.size,
        masteredIds,
        coveragePct: Number(d.corpus_stats?.cov_3500 || 95.81),
        totalTasks: allTasks.length,
        listCerts: window.RecognitionTestModule?.getListCerts?.() || {},
      };
    }

    exportCloudState() {
      return window.RecognitionTestModule?.exportCloudRecognitionData?.() || {};
    }

    importCloudState(sd) {
      return Boolean(window.RecognitionTestModule?.importCloudRecognitionData?.(sd));
    }
  }

  window.ReadingSkillMode = ReadingMode;
})();
