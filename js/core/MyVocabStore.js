/* =========================================================
   CORE MODULE: MyVocabStore & MyVocabUI
   100% local personal vocabulary lists stored per student on their own device
   (localStorage) — never synced to Google Sheets, zero leaderboard inflation.
   Supports: manual add, Quizlet/CSV/text bulk import, .txt/.csv upload,
   .json backup/restore, auto IPA/POS enrichment, and 1-click Flashcard study.
   ========================================================= */
(function () {
  'use strict';

  const STORAGE_KEY_BASE = 'ielts_my_vocab_v1_';
  const DEFAULT_DECK_ID = 'mv_default';
  const DEFAULT_DECK_NAME = 'MY LIST';

  let activeModalDeckId = DEFAULT_DECK_ID;
  let modalSearchQuery = '';
  let _catalogLookupCache = null;

  function B() {
    return window.__VOCAB_BRIDGE__ || null;
  }

  function getScopedUid(explicitUid) {
    if (explicitUid) return String(explicitUid).trim().toLowerCase();
    const uid = B()?.getScopedUid?.() || B()?.getCurrentUser?.()?.id || 'guest';
    return String(uid || 'guest').trim().toLowerCase();
  }

  function storageKey(uid) {
    return `${STORAGE_KEY_BASE}${getScopedUid(uid)}`;
  }

  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (s) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[s]));
  }

  function buildCatalogLookup() {
    if (_catalogLookupCache) return _catalogLookupCache;
    const map = new Map();
    const d = (typeof APP_DATA !== 'undefined' ? APP_DATA : window.APP_DATA) || {};
    const lists = [d.file1_paraphrase_1500 || [], d.file2_families_3500 || [], d.signal_words || []];
    lists.forEach((arr) => {
      arr.forEach((it) => {
        if (!it || !it.lemma) return;
        const k = String(it.lemma).trim().toLowerCase();
        if (k && !map.has(k)) map.set(k, it);
      });
    });
    if (map.size > 0) _catalogLookupCache = map;
    return map;
  }

  function enrichWordFields(raw) {
    const lemma = String(raw?.lemma || raw?.word || '').trim();
    const lower = lemma.toLowerCase();
    const cat = buildCatalogLookup().get(lower) || null;
    const ipaDict = (typeof IPA_DICT !== 'undefined' ? IPA_DICT : window.IPA_DICT) || {};
    const ipa = String(raw?.ipa || '').trim() || cat?.ipa || ipaDict[lower] || '';
    const pos = String(raw?.pos || '').trim() || cat?.pos || 'word';
    const meaning = String(raw?.clean_meaning || raw?.meaning || raw?.vi || raw?.definition || '').trim()
      || cat?.clean_meaning
      || cat?.definition
      || '';
    const context = String(raw?.reading_context || raw?.context || raw?.ctx || '').trim();
    const synonyms = Array.isArray(raw?.synonyms)
      ? raw.synonyms.filter(Boolean).slice(0, 5)
      : (Array.isArray(cat?.synonyms) ? cat.synonyms.slice(0, 5) : []);
    const source = String(raw?.source || 'Tự thêm').trim();
    return { lemma, pos, ipa, meaning, context, synonyms, source };
  }

  function createDefaultState() {
    return {
      version: 1,
      activeDeckId: DEFAULT_DECK_ID,
      decks: [
        {
          id: DEFAULT_DECK_ID,
          name: DEFAULT_DECK_NAME,
          createdAt: Date.now(),
          words: [],
        },
      ],
    };
  }

  function normalizeState(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.decks) || raw.decks.length === 0) {
      return createDefaultState();
    }
    const decks = raw.decks
      .filter((d) => d && typeof d === 'object' && d.id)
      .map((d) => ({
        id: String(d.id),
        name: String(d.name || DEFAULT_DECK_NAME).trim() || DEFAULT_DECK_NAME,
        createdAt: Number(d.createdAt || Date.now()),
        words: Array.isArray(d.words) ? d.words.filter((w) => w && w.id && w.lemma) : [],
      }));
    if (!decks.length) return createDefaultState();
    const activeDeckId = decks.some((d) => d.id === raw.activeDeckId) ? raw.activeDeckId : decks[0].id;
    return { version: 1, activeDeckId, decks };
  }

  function loadState(uid) {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey(uid)) || 'null');
      return normalizeState(parsed);
    } catch (_) {
      return createDefaultState();
    }
  }

  function saveState(state, uid) {
    const clean = normalizeState(state);
    try {
      localStorage.setItem(storageKey(uid), JSON.stringify(clean));
    } catch (_) {
      B()?.showToast?.('Bộ nhớ trình duyệt đầy, không thể lưu thêm vào MY LIST!');
    }
    try {
      window.dispatchEvent(new CustomEvent('app:myvocab-updated', { detail: { uid: getScopedUid(uid) } }));
    } catch (_) {}
    return clean;
  }

  function genId(prefix) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
  }

  function toFlashcardItem(w, deck) {
    const cleanMeaning = w.clean_meaning || w.definition || '(chưa nhập nghĩa)';
    const ctxSentence = w.reading_context || '';
    return {
      id: w.id,
      lemma: w.lemma,
      pos: w.pos || 'word',
      ipa: w.ipa || '',
      clean_meaning: cleanMeaning,
      definition: cleanMeaning,
      synonyms: Array.isArray(w.synonyms) ? w.synonyms : [],
      example: ctxSentence,
      reading_context: ctxSentence,
      source: w.source || deck?.name || DEFAULT_DECK_NAME,
      isMyVocab: true,
      myVocabDeckId: deck?.id || DEFAULT_DECK_ID,
    };
  }

  const Store = {
    SCOPE_PREFIX: 'myvocab:',
    WORD_ID_PREFIX: 'mv_w_',

    isMyVocabScope(scopeKey) {
      return String(scopeKey || '').startsWith(this.SCOPE_PREFIX);
    },

    getDeckIdFromScope(scopeKey) {
      return this.isMyVocabScope(scopeKey) ? String(scopeKey).slice(this.SCOPE_PREFIX.length) : '';
    },

    getScopeKey(deckId) {
      return `${this.SCOPE_PREFIX}${deckId || DEFAULT_DECK_ID}`;
    },

    getDecks(uid) {
      return loadState(uid).decks;
    },

    getDeck(deckId, uid) {
      const st = loadState(uid);
      return st.decks.find((d) => d.id === deckId) || st.decks[0];
    },

    getTotalWordCount(uid) {
      return loadState(uid).decks.reduce((sum, d) => sum + (d.words?.length || 0), 0);
    },

    getSavedWordSet(uid) {
      const set = new Set();
      loadState(uid).decks.forEach((d) => {
        (d.words || []).forEach((w) => {
          if (w?.lemma) set.add(String(w.lemma).trim().toLowerCase());
        });
      });
      return set;
    },

    getFlashcardItems(deckId, uid) {
      const deck = this.getDeck(deckId, uid);
      if (!deck) return [];
      return (deck.words || []).map((w) => toFlashcardItem(w, deck));
    },

    createDeck(name, uid) {
      const cleanName = String(name || '').trim();
      if (!cleanName) return null;
      const st = loadState(uid);
      const existing = st.decks.find((d) => d.name.toLowerCase() === cleanName.toLowerCase());
      if (existing) return existing;
      const deck = {
        id: genId('mv_d'),
        name: cleanName.slice(0, 60),
        createdAt: Date.now(),
        words: [],
      };
      st.decks.push(deck);
      st.activeDeckId = deck.id;
      saveState(st, uid);
      return deck;
    },

    renameDeck(deckId, nextName, uid) {
      const cleanName = String(nextName || '').trim();
      if (!cleanName) return false;
      const st = loadState(uid);
      const deck = st.decks.find((d) => d.id === deckId);
      if (!deck) return false;
      deck.name = cleanName.slice(0, 60);
      saveState(st, uid);
      return true;
    },

    deleteDeck(deckId, uid) {
      const st = loadState(uid);
      if (st.decks.length <= 1) return false;
      const idx = st.decks.findIndex((d) => d.id === deckId);
      if (idx === -1) return false;
      st.decks.splice(idx, 1);
      if (st.activeDeckId === deckId) st.activeDeckId = st.decks[0].id;
      saveState(st, uid);
      return true;
    },

    ensureDeckByName(deckName, uid) {
      const cleanName = String(deckName || '').trim();
      if (!cleanName) return this.getDeck(DEFAULT_DECK_ID, uid);
      const st = loadState(uid);
      const hit = st.decks.find((d) => d.name.toLowerCase() === cleanName.toLowerCase());
      if (hit) return hit;
      return this.createDeck(cleanName, uid);
    },

    addWord(deckId, rawWord, uid) {
      const info = enrichWordFields(rawWord);
      if (!info.lemma) return { ok: false, reason: 'empty' };
      const st = loadState(uid);
      const deck = st.decks.find((d) => d.id === deckId) || st.decks[0];
      const dup = deck.words.find((w) => String(w.lemma).trim().toLowerCase() === info.lemma.toLowerCase());
      if (dup) {
        // Update context/meaning if previously empty
        let changed = false;
        if (info.meaning && !dup.clean_meaning) { dup.clean_meaning = info.meaning; dup.definition = info.meaning; changed = true; }
        if (info.context && !dup.reading_context) { dup.reading_context = info.context; changed = true; }
        if (info.ipa && !dup.ipa) { dup.ipa = info.ipa; changed = true; }
        if (changed) saveState(st, uid);
        return { ok: true, duplicate: true, word: dup, deck };
      }
      const record = {
        id: genId(this.WORD_ID_PREFIX.replace(/_$/, '')),
        lemma: info.lemma,
        pos: info.pos,
        ipa: info.ipa,
        clean_meaning: info.meaning || '(chưa nhập nghĩa)',
        definition: info.meaning || '(chưa nhập nghĩa)',
        reading_context: info.context,
        synonyms: info.synonyms,
        source: info.source,
        addedAt: Date.now(),
      };
      deck.words.unshift(record);
      st.activeDeckId = deck.id;
      saveState(st, uid);
      return { ok: true, duplicate: false, word: record, deck };
    },

    addWordToNamedDeck(deckName, rawWord, uid) {
      const deck = this.ensureDeckByName(deckName, uid);
      return this.addWord(deck.id, rawWord, uid);
    },

    removeWord(deckId, wordId, uid) {
      const st = loadState(uid);
      const deck = st.decks.find((d) => d.id === deckId);
      if (!deck) return false;
      const before = deck.words.length;
      deck.words = deck.words.filter((w) => w.id !== wordId);
      if (deck.words.length === before) return false;
      saveState(st, uid);
      return true;
    },

    parseBulkLines(rawText) {
      const lines = String(rawText || '').split(/\r?\n/);
      const items = [];
      lines.forEach((rawLine) => {
        const line = rawLine.trim();
        if (!line || /^#/.test(line)) return;
        // Skip common CSV header rows
        if (/^(word|lemma|term|từ\s*vựng)\s*[,;\t|]/i.test(line)) return;
        let lemma = '';
        let ipa = '';
        let meaning = '';
        let context = '';
        if (line.includes('\t')) {
          const parts = line.split('\t').map((s) => s.trim());
          lemma = parts[0] || '';
          if (parts.length >= 3 && /^\/.*\/$/.test(parts[1])) {
            ipa = parts[1];
            meaning = parts[2] || '';
            context = parts[3] || '';
          } else {
            meaning = parts[1] || '';
            context = parts[2] || '';
          }
        } else if (line.includes('|')) {
          const parts = line.split('|').map((s) => s.trim());
          lemma = parts[0] || '';
          if (parts.length >= 3 && /^\/.*\/$/.test(parts[1])) {
            ipa = parts[1];
            meaning = parts[2] || '';
            context = parts[3] || '';
          } else {
            meaning = parts[1] || '';
            context = parts[2] || '';
          }
        } else if (/\s+[-–—:]\s+/.test(line) || line.includes(':')) {
          const m = line.match(/^([^:–—-]+?)\s*[-–—:]\s*(.+)$/);
          if (m) {
            lemma = m[1].trim();
            meaning = m[2].trim();
          } else {
            lemma = line;
          }
        } else if (line.includes(',')) {
          const parts = line.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
          lemma = parts[0] || '';
          meaning = parts.slice(1).join(', ').trim();
        } else {
          lemma = line;
        }
        lemma = lemma.replace(/^["'\d.)\s•-]+/, '').replace(/["']+$/, '').trim();
        if (lemma) items.push({ lemma, ipa, meaning, context });
      });
      return items;
    },

    importBulkText(deckId, rawText, sourceLabel = 'Tự import', uid) {
      const parsed = this.parseBulkLines(rawText);
      if (!parsed.length) return { added: 0, skipped: 0, total: 0 };
      const st = loadState(uid);
      const deck = st.decks.find((d) => d.id === deckId) || st.decks[0];
      const existingSet = new Set(deck.words.map((w) => String(w.lemma).trim().toLowerCase()));
      let added = 0;
      let skipped = 0;
      const toPrepend = [];

      parsed.forEach((p) => {
        const info = enrichWordFields({ ...p, source: sourceLabel });
        const key = info.lemma.toLowerCase();
        if (!key || existingSet.has(key)) {
          skipped++;
          return;
        }
        existingSet.add(key);
        toPrepend.push({
          id: genId(this.WORD_ID_PREFIX.replace(/_$/, '')),
          lemma: info.lemma,
          pos: info.pos,
          ipa: info.ipa,
          clean_meaning: info.meaning || '(chưa nhập nghĩa)',
          definition: info.meaning || '(chưa nhập nghĩa)',
          reading_context: info.context,
          synonyms: info.synonyms,
          source: sourceLabel,
          addedAt: Date.now(),
        });
        added++;
      });

      if (toPrepend.length) {
        deck.words = [...toPrepend, ...deck.words];
        st.activeDeckId = deck.id;
        saveState(st, uid);
      }
      return { added, skipped, total: parsed.length };
    },

    exportBackupJson(uid) {
      const st = loadState(uid);
      return JSON.stringify({
        app: 'IELTS_Reading_Vocab_MyVocab',
        exportedAt: new Date().toISOString(),
        ...st,
      }, null, 2);
    },

    importBackupJson(jsonText, uid) {
      let parsed = null;
      try { parsed = JSON.parse(jsonText); } catch (_) { return { ok: false, reason: 'invalid_json' }; }
      if (!parsed || !Array.isArray(parsed.decks)) return { ok: false, reason: 'invalid_schema' };
      const st = loadState(uid);
      let addedDecks = 0;
      let addedWords = 0;
      parsed.decks.forEach((incDeck) => {
        if (!incDeck || !incDeck.name) return;
        let target = st.decks.find((d) => d.name.toLowerCase() === String(incDeck.name).trim().toLowerCase());
        if (!target) {
          target = {
            id: genId('mv_d'),
            name: String(incDeck.name).trim().slice(0, 60),
            createdAt: Number(incDeck.createdAt || Date.now()),
            words: [],
          };
          st.decks.push(target);
          addedDecks++;
        }
        const existing = new Set(target.words.map((w) => String(w.lemma).trim().toLowerCase()));
        (Array.isArray(incDeck.words) ? incDeck.words : []).forEach((w) => {
          const info = enrichWordFields(w);
          const k = info.lemma.toLowerCase();
          if (!k || existing.has(k)) return;
          existing.add(k);
          target.words.push({
            id: genId(this.WORD_ID_PREFIX.replace(/_$/, '')),
            lemma: info.lemma,
            pos: info.pos,
            ipa: info.ipa,
            clean_meaning: info.meaning || '(chưa nhập nghĩa)',
            definition: info.meaning || '(chưa nhập nghĩa)',
            reading_context: info.context,
            synonyms: info.synonyms,
            source: info.source || 'Sao lưu JSON',
            addedAt: Number(w.addedAt || Date.now()),
          });
          addedWords++;
        });
      });
      saveState(st, uid);
      return { ok: true, addedDecks, addedWords };
    },
  };

  /* =========================================================
     MODAL UI CONTROLLER (#modal-my-vocab)
     ========================================================= */
  const UI = {
    openModal(deckId = null, openImportTab = false) {
      const modal = document.getElementById('modal-my-vocab');
      if (!modal) return;
      const st = loadState();
      if (deckId && st.decks.some((d) => d.id === deckId)) {
        activeModalDeckId = deckId;
      } else if (!st.decks.some((d) => d.id === activeModalDeckId)) {
        activeModalDeckId = st.activeDeckId || st.decks[0].id;
      }
      modalSearchQuery = '';
      this.render();
      modal.classList.add('open');
      if (openImportTab) {
        this.togglePanel('import', true);
      }
    },

    closeModal(event) {
      const modal = document.getElementById('modal-my-vocab');
      if (!modal) return;
      if (event && event.target !== modal) return;
      modal.classList.remove('open');
    },

    selectDeck(deckId) {
      activeModalDeckId = deckId;
      modalSearchQuery = '';
      const searchEl = document.getElementById('mv-search-input');
      if (searchEl) searchEl.value = '';
      this.render();
    },

    togglePanel(which, forceOpen = null) {
      const addBox = document.getElementById('mv-panel-add');
      const impBox = document.getElementById('mv-panel-import');
      if (!addBox || !impBox) return;
      if (which === 'add') {
        const next = forceOpen !== null ? forceOpen : !addBox.classList.contains('open');
        addBox.classList.toggle('open', next);
        if (next) impBox.classList.remove('open');
        if (next) document.getElementById('mv-add-word')?.focus();
      } else if (which === 'import') {
        const next = forceOpen !== null ? forceOpen : !impBox.classList.contains('open');
        impBox.classList.toggle('open', next);
        if (next) addBox.classList.remove('open');
        if (next) document.getElementById('mv-import-textarea')?.focus();
      }
    },

    promptCreateDeck() {
      const name = window.prompt('Nhập tên danh sách từ mới (vd: Cam 19 · Test 1, Từ hay quên):');
      if (!name || !name.trim()) return;
      const deck = Store.createDeck(name.trim());
      if (deck) {
        activeModalDeckId = deck.id;
        this.render();
        B()?.refreshScopeSelect?.();
        B()?.showToast?.(`Đã tạo danh sách "${deck.name}" (lưu trên máy này)!`);
      }
    },

    promptRenameDeck(deckId, event) {
      event?.stopPropagation?.();
      const deck = Store.getDeck(deckId);
      if (!deck) return;
      const next = window.prompt('Đổi tên danh sách:', deck.name);
      if (!next || !next.trim() || next.trim() === deck.name) return;
      if (Store.renameDeck(deckId, next.trim())) {
        this.render();
        B()?.refreshScopeSelect?.();
        B()?.showToast?.(`Đã đổi tên thành "${next.trim()}"!`);
      }
    },

    confirmDeleteDeck(deckId, event) {
      event?.stopPropagation?.();
      const decks = Store.getDecks();
      if (decks.length <= 1) {
        B()?.showToast?.('Cần giữ lại ít nhất 1 danh sách MY LIST.');
        return;
      }
      const deck = Store.getDeck(deckId);
      if (!deck) return;
      if (!window.confirm(`Xóa danh sách "${deck.name}" (${deck.words.length} từ) trên thiết bị này?`)) return;
      if (Store.deleteDeck(deckId)) {
        activeModalDeckId = Store.getDecks()[0].id;
        this.render();
        B()?.refreshScopeSelect?.();
        B()?.showToast?.(`Đã xóa danh sách "${deck.name}".`);
      }
    },

    submitSingleWord(event) {
      event?.preventDefault?.();
      const wordEl = document.getElementById('mv-add-word');
      const meaningEl = document.getElementById('mv-add-meaning');
      const ctxEl = document.getElementById('mv-add-context');
      const word = (wordEl?.value || '').trim();
      const meaning = (meaningEl?.value || '').trim();
      const context = (ctxEl?.value || '').trim();
      if (!word) {
        B()?.showToast?.('Vui lòng nhập từ vựng tiếng Anh!');
        wordEl?.focus();
        return;
      }
      const res = Store.addWord(activeModalDeckId, { lemma: word, meaning, context, source: 'Tự thêm' });
      if (res.ok) {
        if (wordEl) wordEl.value = '';
        if (meaningEl) meaningEl.value = '';
        if (ctxEl) ctxEl.value = '';
        this.render();
        B()?.refreshScopeSelect?.();
        B()?.showToast?.(res.duplicate
          ? `Từ "${res.word.lemma}" đã có trong danh sách này.`
          : `Đã thêm "${res.word.lemma}" vào "${res.deck.name}"!`);
      }
    },

    submitBulkImport() {
      const ta = document.getElementById('mv-import-textarea');
      const raw = (ta?.value || '').trim();
      if (!raw) {
        B()?.showToast?.('Hãy dán ít nhất 1 dòng từ vựng trước khi Import!');
        ta?.focus();
        return;
      }
      const res = Store.importBulkText(activeModalDeckId, raw, 'Tự import');
      if (res.added > 0) {
        if (ta) ta.value = '';
        this.togglePanel('import', false);
        this.render();
        B()?.refreshScopeSelect?.();
        B()?.showToast?.(`Đã import ${res.added} từ mới${res.skipped ? ` (bỏ qua ${res.skipped} từ trùng)` : ''}!`);
      } else {
        B()?.showToast?.('Không có từ mới nào được thêm (tất cả đã trùng hoặc sai định dạng).');
      }
    },

    handleTextFileImport(inputEl) {
      const file = inputEl?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const text = String(reader.result || '');
        if (/\.json$/i.test(file.name)) {
          const res = Store.importBackupJson(text);
          if (res.ok) {
            this.render();
            B()?.refreshScopeSelect?.();
            B()?.showToast?.(`Đã khôi phục ${res.addedWords} từ (${res.addedDecks} danh sách mới)!`);
          } else {
            B()?.showToast?.('File JSON sao lưu không hợp lệ.');
          }
        } else {
          const res = Store.importBulkText(activeModalDeckId, text, `File: ${file.name}`);
          this.render();
          B()?.refreshScopeSelect?.();
          B()?.showToast?.(`Đã import ${res.added} từ từ "${file.name}"!`);
        }
        inputEl.value = '';
      };
      reader.readAsText(file, 'utf-8');
    },

    exportBackup() {
      const json = Store.exportBackupJson();
      try { window.__LAST_MY_VOCAB_EXPORT__ = json; } catch (_) {}
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Tu_Cua_Toi_IELTS_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      B()?.showToast?.('Đã tải xuống file sao lưu MY LIST (.json)!');
    },

    deleteWord(wordId) {
      if (Store.removeWord(activeModalDeckId, wordId)) {
        this.render();
        B()?.refreshScopeSelect?.();
      }
    },

    speakWord(lemma) {
      if (!lemma) return;
      B()?.speakText?.(lemma, 'en-US', { engine: 'auto', respectCustom: false });
    },

    onSearch(q) {
      modalSearchQuery = String(q || '').trim().toLowerCase();
      this.renderWordsTable();
    },

    studyCurrentDeck() {
      const deck = Store.getDeck(activeModalDeckId);
      if (!deck) return;
      if (!deck.words.length) {
        B()?.showToast?.('Danh sách đang trống — hãy thêm hoặc Import vài từ trước khi học nhé!');
        this.togglePanel('import', true);
        return;
      }
      this.closeModal();
      B()?.openMyVocabDeck?.(deck.id);
    },

    renderWordsTable() {
      const tbody = document.getElementById('mv-words-tbody');
      if (!tbody) return;
      const deck = Store.getDeck(activeModalDeckId);
      const words = (deck?.words || []).filter((w) => {
        if (!modalSearchQuery) return true;
        return `${w.lemma} ${w.clean_meaning} ${w.reading_context || ''}`.toLowerCase().includes(modalSearchQuery);
      });
      if (!words.length) {
        tbody.innerHTML = `
          <tr>
            <td colspan="4" class="mv-empty-cell">
              ${modalSearchQuery
                ? 'Không tìm thấy từ nào khớp từ khóa.'
                : 'Danh sách này chưa có từ nào. Bấm <strong>+ Thêm 1 từ</strong> hoặc <strong>+ Import danh sách</strong> để bắt đầu!'}
            </td>
          </tr>`;
        return;
      }
      tbody.innerHTML = words.map((w) => `
        <tr>
          <td>
            <div class="mv-word-cell">
              <button type="button" class="mv-speak-mini" onclick="MyVocabUI.speakWord('${esc(w.lemma).replace(/'/g, "\\'")}')" title="Nghe phát âm">🔊</button>
              <div>
                <strong>${esc(w.lemma)}</strong>
                <div class="mv-word-meta">${esc(w.ipa || '')}${w.ipa && w.pos ? ' · ' : ''}${esc(w.pos || '')}</div>
              </div>
            </div>
          </td>
          <td>
            <div class="mv-meaning-txt">${esc(w.clean_meaning)}</div>
            ${w.reading_context ? `<div class="mv-ctx-txt">"${esc(w.reading_context)}"</div>` : ''}
          </td>
          <td><span class="mv-src-badge">${esc(w.source || 'Tự thêm')}</span></td>
          <td style="text-align:right;">
            <button type="button" class="mv-del-btn" onclick="MyVocabUI.deleteWord('${esc(w.id)}')" title="Xóa từ này">✕</button>
          </td>
        </tr>
      `).join('');
    },

    render() {
      const decks = Store.getDecks();
      if (!decks.some((d) => d.id === activeModalDeckId)) {
        activeModalDeckId = decks[0].id;
      }
      const activeDeck = Store.getDeck(activeModalDeckId);
      const listEl = document.getElementById('mv-decks-list');
      if (listEl) {
        listEl.innerHTML = decks.map((d) => `
          <div class="mv-deck-row ${d.id === activeModalDeckId ? 'active' : ''}" onclick="MyVocabUI.selectDeck('${esc(d.id)}')">
            <div class="mv-deck-name-wrap">
              <strong class="mv-deck-name">${esc(d.name)}</strong>
              <span class="mv-deck-cnt tabular">${d.words.length} từ</span>
            </div>
            <div class="mv-deck-mini-acts">
              <button type="button" class="mv-icon-mini" onclick="MyVocabUI.promptRenameDeck('${esc(d.id)}', event)" title="Đổi tên">✎</button>
              ${decks.length > 1 ? `<button type="button" class="mv-icon-mini is-del" onclick="MyVocabUI.confirmDeleteDeck('${esc(d.id)}', event)" title="Xóa danh sách">✕</button>` : ''}
            </div>
          </div>
        `).join('');
      }
      const titleEl = document.getElementById('mv-active-deck-title');
      if (titleEl && activeDeck) {
        titleEl.textContent = `${activeDeck.name} (${activeDeck.words.length} từ)`;
      }
      const studyBtn = document.getElementById('btn-mv-study-now');
      if (studyBtn && activeDeck) {
        studyBtn.disabled = activeDeck.words.length === 0;
      }
      this.renderWordsTable();
    },
  };

  window.MyVocabStore = Store;
  window.MyVocabUI = UI;
})();
