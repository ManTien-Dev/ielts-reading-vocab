/* ==========================================================================
   CORE OOP SECURITY & RBAC ENGINE: AccessPolicy
   --------------------------------------------------------------------------
   Clean Object-Oriented Role-Based Access Control (RBAC) & Tenant Curriculum
   Isolation Engine:
   - Least-privilege default: only authorized owner classes can load or hold
     proprietary curriculum bundles in memory.
   - Dynamic curriculum gating: proprietary scripts (Vocab banks, 110 Reading
     Tasks, 139 Listening Tasks, 41 Writing Flow Ideas, Story 01 Mindmap) are
     NEVER fetched over HTTP for restricted partner classes.
   - Runtime memory purge: switching from an owner account to a partner class
     immediately wipes all proprietary globals & resets LazyDataLoader cache.
   - Deep-link & LazyDataLoader guard: blocks unauthorized ?task=... URLs and
     prevents restricted sessions from loading proprietary v2_*.js bundles.
   ========================================================================== */
(function () {
  'use strict';

  const AUTH_SESSION_KEY = 'ielts_reading_auth_session_v1';

  const PROPRIETARY_MANIFEST = Object.freeze([
    Object.freeze({ key: 'vocab_data',                 url: 'data/vocab_data.js?v=20261119t' }),
    Object.freeze({ key: 'listening_vocab_data',       url: 'data/listening_vocab_data.js?v=20261124a' }),
    Object.freeze({ key: 'listening_paraphrase_bank',  url: 'data/listening_paraphrase_bank.js?v=20261124y' }),
    Object.freeze({ key: 'tasks_data',                 url: 'data/tasks_data.js?v=20261119t' }),
    Object.freeze({ key: 'listening_tasks_data',       url: 'data/listening_tasks_data.js?v=20261124g' }),
    Object.freeze({ key: 'writing_data',               url: 'data/writing_data.js?v=20261127g' }),
    Object.freeze({ key: 'speaking_data',              url: 'data/speaking_data.js?v=20261126b' }),
  ]);

  const PROPRIETARY_URL_RE = /(?:^|\/)(?:vocab_data|listening_vocab_data|listening_paraphrase_bank|tasks_data|listening_tasks_data|writing_data|speaking_data|reading_tasks_exam_data|v2_foundation|v2_academic|v2_paraphrase|v2_advanced)\.js/i;

  /**
   * Immutable Value Object representing a Class / Tenant's curriculum capabilities.
   */
  class CurriculumPolicy {
    constructor({ classId, tier, label, capabilities }) {
      this.classId = String(classId || '');
      this.tier = tier === 'owner_full' ? 'owner_full' : 'partner_restricted';
      this.label = String(label || '');
      this._caps = Object.freeze({ ...(capabilities || {}) });
      Object.freeze(this);
    }

    can(capability) {
      return Boolean(this._caps[capability]);
    }

    isOwnerFull() {
      return this.tier === 'owner_full';
    }

    isRestricted() {
      return this.tier !== 'owner_full';
    }

    getCapabilitiesSnapshot() {
      return { ...this._caps };
    }
  }

  const OWNER_FULL_CAPS = Object.freeze({
    'vocab.proprietary': true,
    'vocab.demo': false,
    'vocab.my_list': true,
    'tasks.proprietary_reading': true,
    'tasks.proprietary_listening': true,
    'tasks.self_generated': true,
    'writing.flow_mindmap': true,
    'speaking.story_mindmap': true,
    'practice.public_exams': true,
  });

  const PARTNER_RESTRICTED_CAPS = Object.freeze({
    'vocab.proprietary': false,
    'vocab.demo': true,
    'vocab.my_list': true,
    'tasks.proprietary_reading': false,
    'tasks.proprietary_listening': false,
    'tasks.self_generated': true,
    'writing.flow_mindmap': false,
    'speaking.story_mindmap': false,
    'practice.public_exams': true,
  });

  /**
   * Central RBAC & Curriculum Isolation Controller (Singleton OOP Manager).
   */
  class AccessPolicyManager {
    constructor() {
      this._policyMap = new Map();
      this._defaultRestrictedPolicy = new CurriculumPolicy({
        classId: '*',
        tier: 'partner_restricted',
        label: 'Partner Class (Curriculum Protected)',
        capabilities: PARTNER_RESTRICTED_CAPS,
      });
      this._activeUser = null;
      this._activePolicy = this._defaultRestrictedPolicy;
      this._proprietaryLoaded = false;
      this._proprietaryInflight = null;
      this._loaderPatched = false;

      this.registerPolicy('lop_thay_man', new CurriculumPolicy({
        classId: 'lop_thay_man',
        tier: 'owner_full',
        label: 'Lớp Thầy Mẫn (Full Proprietary Curriculum)',
        capabilities: OWNER_FULL_CAPS,
      }));
      this.registerPolicy('lop_gv2', new CurriculumPolicy({
        classId: 'lop_gv2',
        tier: 'partner_restricted',
        label: 'Lớp Giáo viên 2 (Demo + MY LIST + Tự tạo Task + Practice)',
        capabilities: PARTNER_RESTRICTED_CAPS,
      }));
    }

    registerPolicy(classId, policy) {
      if (classId && policy instanceof CurriculumPolicy) {
        this._policyMap.set(String(classId).trim().toLowerCase(), policy);
      }
    }

    resolveForUser(user) {
      if (!user || typeof user !== 'object') return this._defaultRestrictedPolicy;
      const cid = String(user.classId || '').trim().toLowerCase();
      if (!cid) return this._defaultRestrictedPolicy;
      return this._policyMap.get(cid) || this._defaultRestrictedPolicy;
    }

    getActivePolicy() {
      return this._activePolicy;
    }

    getActiveUser() {
      return this._activeUser;
    }

    can(capability, user = null) {
      const pol = user ? this.resolveForUser(user) : this._activePolicy;
      return pol.can(capability);
    }

    isRestricted(user = null) {
      const pol = user ? this.resolveForUser(user) : this._activePolicy;
      return pol.isRestricted();
    }

    isProprietaryLoaded() {
      return this._proprietaryLoaded;
    }

    /**
     * Guard deep-link task IDs so restricted classes cannot open copyrighted Tasks via URL.
     */
    isTaskIdAuthorized(rawTaskId, user = null) {
      const id = String(rawTaskId || '').trim();
      if (!id) return false;
      if (!this.isRestricted(user)) return true;
      // Allow public Practice assignments (Cambridge / Volume / Actual / Writing Practice / Speaking P1, P2 Cam, P3 & Full Test)
      if (/^(rp|rp_full|lp|lp_full|wp|wp_full|sp_p1_|sp_p2_cam|sp_p3_|sp_full_|ptask_)/i.test(id)) return true;
      if (/^sp:/i.test(id)) {
        const inner = id.slice(3);
        return /^(sp_p1_|sp_p2_cam|sp_p3_|sp_full_)/i.test(inner);
      }
      return false;
    }

    /**
     * Install runtime security guard on AppLazyData so restricted classes cannot
     * fetch proprietary script files even via console calls.
     */
    installLazyLoaderGuard() {
      if (this._loaderPatched) return;
      const loader = window.AppLazyData;
      if (!loader || typeof loader.loadScript !== 'function') return;
      this._loaderPatched = true;
      const origLoadScript = loader.loadScript.bind(loader);
      const origEnsureReading = typeof loader.ensureReadingExamData === 'function'
        ? loader.ensureReadingExamData.bind(loader)
        : null;

      loader.loadScript = (url, cacheKey) => {
        if (this.isRestricted() && PROPRIETARY_URL_RE.test(String(url || ''))) {
          return Promise.reject(new Error('AccessPolicy: Proprietary curriculum blocked for this class.'));
        }
        return origLoadScript(url, cacheKey);
      };

      if (origEnsureReading) {
        loader.ensureReadingExamData = (taskId) => {
          if (this.isRestricted()) {
            return Promise.reject(new Error('AccessPolicy: Proprietary Reading Task data blocked for this class.'));
          }
          return origEnsureReading(taskId);
        };
      }
    }

    /**
     * Actively wipes all proprietary curriculum globals from window & resets caches.
     * Prevents cross-session leakage when switching accounts in the same browser tab.
     */
    purgeProprietaryMemory() {
      this._proprietaryLoaded = false;
      this._proprietaryInflight = null;

      window.APP_DATA = {
        corpus_stats: {},
        file1_paraphrase_1500: [],
        file2_families_3500: [],
        signal_words: [],
      };
      try { delete window.APP_LISTENING_VOCAB; } catch (_) { window.APP_LISTENING_VOCAB = undefined; }
      try { delete window.APP_LISTENING_PARAPHRASES; } catch (_) { window.APP_LISTENING_PARAPHRASES = undefined; }
      try { delete window.APP_TASKS_DATA; } catch (_) { window.APP_TASKS_DATA = undefined; }
      try { delete window.APP_LISTENING_TASKS; } catch (_) { window.APP_LISTENING_TASKS = undefined; }
      try { delete window.APP_READING_TASKS_EXAM_DATA; } catch (_) { window.APP_READING_TASKS_EXAM_DATA = undefined; }
      try { delete window.APP_TASK_EXAM_V2_DATA; } catch (_) { window.APP_TASK_EXAM_V2_DATA = undefined; }
      window.SPEAKING_STUDIO_DATA = { VERSION: 'restricted-no-story', STORIES: [] };

      if (window.WRITING_PUBLIC_DATA) {
        window.WRITING_STUDIO_DATA = {
          VERSION: window.WRITING_PUBLIC_DATA.VERSION,
          SUBTOPICS: [...window.WRITING_PUBLIC_DATA.SUBTOPICS],
          MODULES: [],
          PARAPHRASES: [],
          PRACTICE_PROMPTS: [...window.WRITING_PUBLIC_DATA.PRACTICE_PROMPTS],
        };
      } else {
        window.WRITING_STUDIO_DATA = { VERSION: 'restricted', SUBTOPICS: [], MODULES: [], PARAPHRASES: [], PRACTICE_PROMPTS: [] };
      }

      // Clear proprietary script cache keys in AppLazyData & MyVocabStore lookup cache
      try {
        const cache = window.AppLazyData?._cache;
        if (cache && typeof cache.forEach === 'function') {
          const toDel = [];
          cache.forEach((_, k) => {
            if (PROPRIETARY_URL_RE.test(String(k)) || PROPRIETARY_MANIFEST.some((m) => m.key === k)) {
              toDel.push(k);
            }
          });
          toDel.forEach((k) => cache.delete(k));
        }
      } catch (_) {}

      // Remove injected proprietary <script> DOM elements if any
      try {
        document.querySelectorAll('script[data-proprietary-curriculum="1"]').forEach((el) => el.remove());
      } catch (_) {}
    }

    _injectScript(url) {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = false;
        s.setAttribute('data-proprietary-curriculum', '1');
        s.onload = () => resolve(true);
        s.onerror = () => reject(new Error(`Failed to load authorized curriculum: ${url}`));
        document.head.appendChild(s);
      });
    }

    /**
     * Loads all 7 proprietary curriculum scripts ONLY for owner_full classes.
     */
    async ensureProprietaryCurriculumLoaded() {
      if (this.isRestricted()) return false;
      if (this._proprietaryLoaded && window.APP_DATA?.file1_paraphrase_1500?.length) return true;
      if (this._proprietaryInflight) return this._proprietaryInflight;

      this._proprietaryInflight = Promise.all(
        PROPRIETARY_MANIFEST.map((item) => this._injectScript(item.url))
      ).then(() => {
        // Re-verify active policy didn't switch to restricted mid-flight
        if (this.isRestricted()) {
          this.purgeProprietaryMemory();
          return false;
        }
        this._proprietaryLoaded = true;
        this._proprietaryInflight = null;
        try {
          window.dispatchEvent(new CustomEvent('app:curriculum-ready', { detail: { tier: this._activePolicy.tier } }));
        } catch (_) {}
        return true;
      }).catch((err) => {
        this._proprietaryInflight = null;
        console.warn('AccessPolicy: curriculum load warning:', err);
        return false;
      });
      return this._proprietaryInflight;
    }

    /**
     * Apply RBAC policy for the given user (called on boot restore, login, and logout).
     */
    async enforceForUser(user) {
      this.installLazyLoaderGuard();
      this._activeUser = user || null;
      this._activePolicy = this.resolveForUser(user);

      try {
        document.documentElement.setAttribute('data-access-tier', this._activePolicy.tier);
        document.documentElement.setAttribute('data-class-id', this._activePolicy.classId || '');
      } catch (_) {}

      if (this._activePolicy.isRestricted()) {
        this.purgeProprietaryMemory();
        try {
          window.dispatchEvent(new CustomEvent('app:policy-applied', { detail: { tier: 'partner_restricted', classId: this._activePolicy.classId } }));
        } catch (_) {}
        return this._activePolicy;
      }

      await this.ensureProprietaryCurriculumLoaded();
      try {
        window.dispatchEvent(new CustomEvent('app:policy-applied', { detail: { tier: 'owner_full', classId: this._activePolicy.classId } }));
      } catch (_) {}
      return this._activePolicy;
    }

    /**
     * Early synchronous boot preload: ONLY starts loading proprietary curriculum
     * if a valid saved session belonging to an owner_full class already exists.
     */
    preloadFromSavedSessionIfAuthorized() {
      try {
        const raw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
        if (!raw) {
          this.purgeProprietaryMemory();
          return;
        }
        const parsed = JSON.parse(raw);
        const uid = String(parsed?.id || '').trim().toLowerCase();
        const acc = (window.APP_ACCOUNTS || []).find((a) => String(a.id || '').trim().toLowerCase() === uid);
        if (acc && this.resolveForUser(acc).isOwnerFull()) {
          this._activeUser = acc;
          this._activePolicy = this.resolveForUser(acc);
          document.documentElement.setAttribute('data-access-tier', 'owner_full');
          this.ensureProprietaryCurriculumLoaded();
          return;
        }
      } catch (_) {}
      this.purgeProprietaryMemory();
    }
  }

  const instance = new AccessPolicyManager();
  window.CurriculumPolicy = CurriculumPolicy;
  window.AccessPolicy = Object.freeze({
    resolveForUser: (u) => instance.resolveForUser(u),
    getActivePolicy: () => instance.getActivePolicy(),
    getActiveUser: () => instance.getActiveUser(),
    can: (cap, u) => instance.can(cap, u),
    isRestricted: (u) => instance.isRestricted(u),
    isProprietaryLoaded: () => instance.isProprietaryLoaded(),
    isTaskIdAuthorized: (tid, u) => instance.isTaskIdAuthorized(tid, u),
    enforceForUser: (u) => instance.enforceForUser(u),
    purgeProprietaryMemory: () => instance.purgeProprietaryMemory(),
    ensureProprietaryCurriculumLoaded: () => instance.ensureProprietaryCurriculumLoaded(),
    installLazyLoaderGuard: () => instance.installLazyLoaderGuard(),
  });

  // Immediately enforce least-privilege before app.js initializes
  instance.preloadFromSavedSessionIfAuthorized();
})();
