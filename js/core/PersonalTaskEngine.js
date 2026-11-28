/* ==========================================================================
   CORE OOP MODULE: PersonalTaskEngine
   --------------------------------------------------------------------------
   Allows students (and teachers) to automatically generate interactive
   3-Stage Mastery Tasks directly from their own MY LIST vocabulary decks
   (words saved from Reading Practice, Listening Practice, Manual add, or
   Quizlet/CSV import) + the 1 Demo Starter Deck.
   Architecture:
   - PersonalTaskStore: per-user completion/score persistence in localStorage
   - PersonalTaskBuilder: chunks personal decks into clean 10–15 word Tasks
   - PersonalTaskRunner: 3-stage interactive modal (Flashcard -> MCQ -> Recall Typing)
   ========================================================================== */
(function () {
  'use strict';

  const PROGRESS_KEY_BASE = 'totoro_personal_tasks_v1_';
  const CHUNK_SIZE = 12;

  function B() { return window.__VOCAB_BRIDGE__ || null; }
  function esc(str) {
    return String(str ?? '').replace(/[&<>"']/g, (s) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[s]));
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function speakWord(word) {
    const text = String(word || '').trim();
    if (!text) return;
    try {
      if (window.AudioEngine?.speak) {
        window.AudioEngine.speak(text, { lang: 'en-GB' });
        return;
      }
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-GB';
        u.rate = 0.94;
        window.speechSynthesis.speak(u);
      }
    } catch (_) {}
  }

  /**
   * OOP Store: persists Personal Task completion & best score per user.
   */
  class PersonalTaskStore {
    getUid() {
      return String(B()?.getScopedUid?.() || B()?.getCurrentUser?.()?.id || 'guest').trim().toLowerCase();
    }

    _key() {
      return `${PROGRESS_KEY_BASE}${this.getUid()}`;
    }

    loadAll() {
      try {
        const raw = JSON.parse(localStorage.getItem(this._key()) || '{}');
        return (raw && typeof raw === 'object') ? raw : {};
      } catch (_) {
        return {};
      }
    }

    getRecord(taskId) {
      return this.loadAll()[taskId] || null;
    }

    saveResult(taskId, { mcqScore, typingScore, passed, wordCount }) {
      const all = this.loadAll();
      const prev = all[taskId] || {};
      const bestMcq = Math.max(Number(prev.mcqScore || 0), Number(mcqScore || 0));
      const bestTyping = Math.max(Number(prev.typingScore || 0), Number(typingScore || 0));
      all[taskId] = {
        status: (passed || prev.status === 'completed') ? 'completed' : 'in_progress',
        mcqScore: bestMcq,
        typingScore: bestTyping,
        bestScore: Math.round((bestMcq + bestTyping) / 2),
        wordCount: Number(wordCount || 0),
        updatedAt: Date.now(),
      };
      try { localStorage.setItem(this._key(), JSON.stringify(all)); } catch (_) {}
      return all[taskId];
    }
  }

  /**
   * OOP Builder: converts MY LIST decks + Demo Starter deck into structured Tasks.
   */
  class PersonalTaskBuilder {
    buildTasks() {
      const tasks = [];
      const myStore = window.MyVocabStore;
      if (myStore && typeof myStore.getDecks === 'function') {
        const decks = myStore.getDecks() || [];
        decks.forEach((deck) => {
          const words = (myStore.getFlashcardItems(deck.id) || []).filter((w) => w && w.lemma);
          if (!words.length) return;
          if (words.length <= CHUNK_SIZE + 3) {
            tasks.push({
              id: `ptask_${deck.id}_1`,
              deckId: deck.id,
              scopeKey: myStore.getScopeKey(deck.id),
              title: deck.name,
              subtitle: `Bộ từ cá nhân · ${words.length} từ`,
              isDemo: false,
              words,
            });
          } else {
            const totalParts = Math.ceil(words.length / CHUNK_SIZE);
            for (let p = 0; p < totalParts; p++) {
              const slice = words.slice(p * CHUNK_SIZE, (p + 1) * CHUNK_SIZE);
              tasks.push({
                id: `ptask_${deck.id}_${p + 1}`,
                deckId: deck.id,
                scopeKey: myStore.getScopeKey(deck.id),
                title: `${deck.name} · Phần ${p + 1}/${totalParts}`,
                subtitle: `Tự động chia nhóm · ${slice.length} từ`,
                isDemo: false,
                words: slice,
              });
            }
          }
        });
      }

      // Always include 1 Demo Starter Task so brand-new students can experience Tasks immediately
      const demo = window.DEMO_VOCAB_DATA;
      if (demo?.WORDS?.length) {
        tasks.push({
          id: 'ptask_demo_starter_1',
          deckId: demo.SCOPE_KEY,
          scopeKey: demo.SCOPE_KEY,
          title: 'Demo Task · Từ Vựng IELTS Cốt Lõi',
          subtitle: `Bộ mẫu trải nghiệm · ${demo.WORDS.length} từ`,
          isDemo: true,
          words: [...demo.WORDS],
        });
      }

      return tasks;
    }

    getDistractorPool(excludeWordId) {
      const pool = [];
      const demo = window.DEMO_VOCAB_DATA?.WORDS || [];
      demo.forEach((w) => pool.push(w));
      const myStore = window.MyVocabStore;
      if (myStore && typeof myStore.getDecks === 'function') {
        (myStore.getDecks() || []).forEach((d) => {
          (myStore.getFlashcardItems(d.id) || []).forEach((w) => pool.push(w));
        });
      }
      return pool.filter((w) => w && w.id !== excludeWordId && w.clean_meaning && w.clean_meaning !== '(chưa nhập nghĩa)');
    }
  }

  /**
   * OOP Runner: interactive 3-stage Personal Task Modal (Preview -> MCQ -> Typing Recall).
   */
  class PersonalTaskRunner {
    constructor(store, builder) {
      this.store = store;
      this.builder = builder;
      this.state = null;
      this._activeFilter = 'all';
    }

    _ensureModal() {
      let ov = document.getElementById('ptask-modal-overlay');
      if (ov) return ov;
      ov = document.createElement('div');
      ov.id = 'ptask-modal-overlay';
      ov.className = 'modal-overlay';
      ov.style.cssText = 'z-index:11500;';
      ov.innerHTML = `
        <div class="modal-card" id="ptask-modal-card" style="max-width:760px;width:94vw;max-height:88vh;display:flex;flex-direction:column;overflow:hidden;" onclick="event.stopPropagation()">
          <div class="modal-head" style="padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <div style="min-width:0;">
              <div id="ptask-modal-title" style="font-size:16.5px;font-weight:800;color:var(--ink);"></div>
              <div id="ptask-modal-sub" style="font-size:12.5px;color:var(--ink-2);margin-top:2px;"></div>
            </div>
            <button type="button" class="btn" style="padding:6px 11px;font-size:12px;" onclick="PersonalTaskEngine.closeModal()">Đóng ✕</button>
          </div>
          <div id="ptask-modal-body" style="padding:18px 22px 22px;overflow-y:auto;flex:1;"></div>
        </div>
      `;
      ov.addEventListener('click', () => this.closeModal());
      document.body.appendChild(ov);
      return ov;
    }

    closeModal() {
      const ov = document.getElementById('ptask-modal-overlay');
      if (ov) ov.classList.remove('open');
      this.state = null;
    }

    openTask(taskId) {
      const tasks = this.builder.buildTasks();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.words.length < 3) {
        B()?.showToast?.('Danh sách cần tối thiểu 3 từ để tạo bài Task trắc nghiệm & gõ từ. Hãy thêm thêm từ vào MY LIST nhé!');
        window.MyVocabUI?.openModal?.(task.deckId);
        return;
      }
      this.state = {
        task,
        stage: 'brief', // 'brief' | 'mcq' | 'typing' | 'summary'
        mcqItems: [],
        mcqIdx: 0,
        mcqCorrect: 0,
        mcqAnswered: false,
        mcqSelectedIdx: -1,
        typingItems: [],
        typingIdx: 0,
        typingCorrect: 0,
        typingAnswered: false,
        typingLastOk: false,
        typingLastInput: '',
      };
      const ov = this._ensureModal();
      ov.classList.add('open');
      this._renderModal();
    }

    jumpToFlashcard(scopeKey) {
      this.closeModal();
      window.TotoroUI?.enterSkillMode?.('Reading', 'flashcard');
      setTimeout(() => {
        const sel = document.getElementById('study-scope-select');
        if (sel && Array.from(sel.options).some((o) => o.value === scopeKey)) {
          sel.value = scopeKey;
          sel.dispatchEvent(new Event('change'));
        }
      }, 150);
    }

    startMcqStage() {
      if (!this.state) return;
      const words = shuffle(this.state.task.words);
      const mcqItems = words.map((w) => {
        const correctMeaning = w.clean_meaning || w.definition || w.lemma;
        const pool = shuffle(this.builder.getDistractorPool(w.id))
          .map((d) => d.clean_meaning || d.definition)
          .filter((m) => m && m !== correctMeaning);
        const uniqueDistractors = [];
        for (const m of pool) {
          if (!uniqueDistractors.includes(m)) uniqueDistractors.push(m);
          if (uniqueDistractors.length === 3) break;
        }
        while (uniqueDistractors.length < 3) {
          uniqueDistractors.push(`Nghĩa khác #${uniqueDistractors.length + 1}`);
        }
        const options = shuffle([
          { text: correctMeaning, ok: true },
          ...uniqueDistractors.map((t) => ({ text: t, ok: false })),
        ]);
        return { word: w, options };
      });
      this.state.stage = 'mcq';
      this.state.mcqItems = mcqItems;
      this.state.mcqIdx = 0;
      this.state.mcqCorrect = 0;
      this.state.mcqAnswered = false;
      this.state.mcqSelectedIdx = -1;
      this._renderModal();
      speakWord(mcqItems[0]?.word?.lemma);
    }

    answerMcq(optIdx) {
      const st = this.state;
      if (!st || st.stage !== 'mcq' || st.mcqAnswered) return;
      const item = st.mcqItems[st.mcqIdx];
      if (!item) return;
      st.mcqAnswered = true;
      st.mcqSelectedIdx = optIdx;
      if (item.options[optIdx]?.ok) st.mcqCorrect += 1;
      this._renderModal();
    }

    nextMcq() {
      const st = this.state;
      if (!st || st.stage !== 'mcq') return;
      if (st.mcqIdx + 1 < st.mcqItems.length) {
        st.mcqIdx += 1;
        st.mcqAnswered = false;
        st.mcqSelectedIdx = -1;
        this._renderModal();
        speakWord(st.mcqItems[st.mcqIdx]?.word?.lemma);
      } else {
        this.startTypingStage();
      }
    }

    startTypingStage() {
      const st = this.state;
      if (!st) return;
      st.stage = 'typing';
      st.typingItems = shuffle(st.task.words);
      st.typingIdx = 0;
      st.typingCorrect = 0;
      st.typingAnswered = false;
      st.typingLastOk = false;
      st.typingLastInput = '';
      this._renderModal();
      speakWord(st.typingItems[0]?.lemma);
      setTimeout(() => document.getElementById('ptask-typing-input')?.focus(), 80);
    }

    submitTyping() {
      const st = this.state;
      if (!st || st.stage !== 'typing') return;
      if (st.typingAnswered) {
        this.nextTyping();
        return;
      }
      const inp = document.getElementById('ptask-typing-input');
      const val = String(inp?.value || '').trim();
      const target = st.typingItems[st.typingIdx];
      if (!target) return;
      const ok = val.toLowerCase() === String(target.lemma || '').trim().toLowerCase();
      st.typingAnswered = true;
      st.typingLastOk = ok;
      st.typingLastInput = val;
      if (ok) st.typingCorrect += 1;
      this._renderModal();
    }

    nextTyping() {
      const st = this.state;
      if (!st || st.stage !== 'typing') return;
      if (st.typingIdx + 1 < st.typingItems.length) {
        st.typingIdx += 1;
        st.typingAnswered = false;
        st.typingLastOk = false;
        st.typingLastInput = '';
        this._renderModal();
        speakWord(st.typingItems[st.typingIdx]?.lemma);
        setTimeout(() => document.getElementById('ptask-typing-input')?.focus(), 80);
      } else {
        const total = Math.max(1, st.task.words.length);
        const mcqPct = Math.round((st.mcqCorrect / Math.max(1, st.mcqItems.length)) * 100);
        const typPct = Math.round((st.typingCorrect / total) * 100);
        const passed = Math.round((mcqPct + typPct) / 2) >= 75;
        this.store.saveResult(st.task.id, {
          mcqScore: mcqPct,
          typingScore: typPct,
          passed,
          wordCount: st.task.words.length,
        });
        st.stage = 'summary';
        st.summaryMcqPct = mcqPct;
        st.summaryTypPct = typPct;
        st.summaryPassed = passed;
        this._renderModal();
        window.TotoroUI?.renderInlineTaskHub?.();
      }
    }

    _renderModal() {
      const st = this.state;
      if (!st) return;
      const titleEl = document.getElementById('ptask-modal-title');
      const subEl = document.getElementById('ptask-modal-sub');
      const bodyEl = document.getElementById('ptask-modal-body');
      if (!bodyEl) return;

      const { task, stage } = st;
      if (titleEl) titleEl.textContent = task.title;
      if (subEl) subEl.textContent = `${task.subtitle} · 3 Bước: Ôn Flashcard → Trắc nghiệm Nghĩa → Nghe & Gõ Từ`;

      if (stage === 'brief') {
        const rec = this.store.getRecord(task.id);
        bodyEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="padding:12px 14px;border-radius:12px;background:var(--surface-panel);border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
              <div style="font-size:13px;color:var(--ink-2);line-height:1.5;">
                Task này được <strong>tạo tự động từ danh sách từ vựng của bạn</strong> (${task.words.length} từ).
                ${rec?.status === 'completed' ? `<span class="ws-pill ok" style="margin-left:6px;">✓ Đã hoàn thành (${rec.bestScore}%)</span>` : ''}
              </div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;">
                <button type="button" class="btn" style="padding:7px 12px;font-size:12.5px;" onclick="PersonalTaskEngine.jumpToFlashcard('${esc(task.scopeKey)}')">Ôn Flashcard trước</button>
                <button type="button" class="btn btn-primary" style="padding:7px 14px;font-size:12.5px;" onclick="PersonalTaskEngine.startMcqStage()">Bắt đầu làm Task →</button>
              </div>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:8px;">
              ${task.words.map((w, i) => `
                <div style="padding:9px 11px;border-radius:10px;border:1px solid var(--border);background:var(--surface);display:flex;flex-direction:column;gap:2px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                    <strong style="font-size:13.5px;color:var(--ink);">${i + 1}. ${esc(w.lemma)}</strong>
                    <button type="button" class="btn" style="padding:2px 7px;font-size:11px;" onclick="PersonalTaskEngine.speak('${esc(w.lemma).replace(/'/g, "\\'")}')">🔊</button>
                  </div>
                  ${w.ipa ? `<div style="font-size:11.5px;color:var(--ink-3);">${esc(w.ipa)}</div>` : ''}
                  <div style="font-size:12px;color:var(--ink-2);">${esc(w.clean_meaning || w.definition || '')}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        return;
      }

      if (stage === 'mcq') {
        const item = st.mcqItems[st.mcqIdx];
        const pct = Math.round(((st.mcqIdx + (st.mcqAnswered ? 1 : 0)) / Math.max(1, st.mcqItems.length)) * 100);
        bodyEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--ink-2);">
              <strong>Bước 2/3 · Trắc nghiệm Nghĩa &amp; Ngữ cảnh</strong>
              <span class="tabular">Câu ${st.mcqIdx + 1} / ${st.mcqItems.length} · Đúng ${st.mcqCorrect}</span>
            </div>
            <div style="height:6px;border-radius:999px;background:var(--bg-subtle);overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--accent);transition:width .2s;"></div>
            </div>
            <div style="padding:18px;border-radius:14px;background:var(--surface-panel);border:1px solid var(--border);text-align:center;">
              <div style="font-size:24px;font-weight:800;color:var(--ink);">${esc(item.word.lemma)}</div>
              <div style="font-size:13px;color:var(--ink-3);margin-top:4px;">${esc(item.word.pos || '')} ${esc(item.word.ipa || '')}
                <button type="button" class="btn" style="margin-left:8px;padding:2px 9px;font-size:11.5px;" onclick="PersonalTaskEngine.speak('${esc(item.word.lemma).replace(/'/g, "\\'")}')">🔊 Nghe</button>
              </div>
              ${item.word.reading_context ? `<div style="margin-top:10px;font-size:13px;color:var(--ink-2);font-style:italic;">"${esc(item.word.reading_context)}"</div>` : ''}
            </div>
            <div style="display:grid;grid-template-columns:1fr;gap:9px;">
              ${item.options.map((opt, oi) => {
                let border = 'var(--border-strong)';
                let bg = 'var(--surface)';
                if (st.mcqAnswered) {
                  if (opt.ok) { border = 'var(--ok)'; bg = 'color-mix(in srgb, var(--ok) 12%, var(--surface))'; }
                  else if (oi === st.mcqSelectedIdx) { border = 'var(--danger)'; bg = 'color-mix(in srgb, var(--danger) 12%, var(--surface))'; }
                }
                return `
                  <button type="button" ${st.mcqAnswered ? 'disabled' : ''} onclick="PersonalTaskEngine.answerMcq(${oi})"
                    style="text-align:left;padding:12px 14px;border-radius:11px;border:1.5px solid ${border};background:${bg};color:var(--ink);font-size:13.5px;font-weight:600;cursor:${st.mcqAnswered ? 'default' : 'pointer'};">
                    ${String.fromCharCode(65 + oi)}. ${esc(opt.text)}
                  </button>
                `;
              }).join('')}
            </div>
            ${st.mcqAnswered ? `
              <div style="display:flex;justify-content:flex-end;">
                <button type="button" class="btn btn-primary" style="padding:9px 18px;" onclick="PersonalTaskEngine.nextMcq()">
                  ${st.mcqIdx + 1 < st.mcqItems.length ? 'Câu tiếp theo →' : 'Sang Bước 3: Nghe & Gõ Từ →'}
                </button>
              </div>
            ` : ''}
          </div>
        `;
        return;
      }

      if (stage === 'typing') {
        const w = st.typingItems[st.typingIdx];
        const maskedCtx = w.reading_context
          ? w.reading_context.replace(new RegExp(w.lemma.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), '______')
          : '';
        const pct = Math.round(((st.typingIdx + (st.typingAnswered ? 1 : 0)) / Math.max(1, st.typingItems.length)) * 100);
        bodyEl.innerHTML = `
          <div style="display:flex;flex-direction:column;gap:14px;">
            <div style="display:flex;align-items:center;justify-content:space-between;font-size:12.5px;color:var(--ink-2);">
              <strong>Bước 3/3 · Nghe &amp; Gõ Chính Tả (Active Recall)</strong>
              <span class="tabular">Từ ${st.typingIdx + 1} / ${st.typingItems.length} · Đúng ${st.typingCorrect}</span>
            </div>
            <div style="height:6px;border-radius:999px;background:var(--bg-subtle);overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:var(--accent);transition:width .2s;"></div>
            </div>
            <div style="padding:18px;border-radius:14px;background:var(--surface-panel);border:1px solid var(--border);display:flex;flex-direction:column;gap:8px;">
              <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;">
                <span class="ws-pill">${esc(w.pos || 'word')} · ${w.lemma.length} chữ cái</span>
                <button type="button" class="btn" style="padding:5px 11px;font-size:12px;" onclick="PersonalTaskEngine.speak('${esc(w.lemma).replace(/'/g, "\\'")}')">🔊 Nghe lại phát âm</button>
              </div>
              <div style="font-size:16px;font-weight:750;color:var(--ink);">${esc(w.clean_meaning || w.definition || '')}</div>
              ${maskedCtx ? `<div style="font-size:13px;color:var(--ink-2);font-style:italic;">Ngữ cảnh: "${esc(maskedCtx)}"</div>` : ''}
            </div>
            <div style="display:flex;gap:8px;">
              <input id="ptask-typing-input" type="text" autocomplete="off" spellcheck="false"
                value="${esc(st.typingLastInput)}" ${st.typingAnswered ? 'disabled' : ''}
                placeholder="Gõ từ tiếng Anh chính xác rồi nhấn Enter..."
                onkeydown="if(event.key==='Enter'){event.preventDefault();PersonalTaskEngine.submitTyping();}"
                style="flex:1;padding:11px 14px;border-radius:11px;border:1.5px solid var(--border-strong);background:var(--surface);color:var(--ink);font-size:15px;font-weight:700;" />
              <button type="button" class="btn btn-primary" style="padding:10px 18px;" onclick="PersonalTaskEngine.submitTyping()">
                ${st.typingAnswered ? (st.typingIdx + 1 < st.typingItems.length ? 'Tiếp →' : 'Xem kết quả →') : 'Kiểm tra'}
              </button>
            </div>
            ${st.typingAnswered ? `
              <div style="padding:11px 14px;border-radius:10px;font-size:13.5px;font-weight:650;border:1px solid ${st.typingLastOk ? 'var(--ok)' : 'var(--danger)'};background:${st.typingLastOk ? 'color-mix(in srgb, var(--ok) 12%, var(--surface))' : 'color-mix(in srgb, var(--danger) 12%, var(--surface))'};color:var(--ink);">
                ${st.typingLastOk ? `✓ Chính xác! "${esc(w.lemma)}"` : `✗ Chưa đúng — Đáp án đúng là: "${esc(w.lemma)}"`}
              </div>
            ` : ''}
          </div>
        `;
        return;
      }

      if (stage === 'summary') {
        const avg = Math.round((st.summaryMcqPct + st.summaryTypPct) / 2);
        bodyEl.innerHTML = `
          <div style="text-align:center;padding:12px 8px;display:flex;flex-direction:column;align-items:center;gap:12px;">
            <div style="font-size:34px;">${st.summaryPassed ? '🎉' : '💪'}</div>
            <h3 style="margin:0;font-size:19px;color:var(--ink);">${st.summaryPassed ? 'Hoàn thành Personal Task!' : 'Cố thêm chút nữa để đạt ≥ 75%!'}</h3>
            <div style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center;">
              <span class="ws-pill">Trắc nghiệm: <strong>${st.summaryMcqPct}%</strong></span>
              <span class="ws-pill">Nghe &amp; Gõ từ: <strong>${st.summaryTypPct}%</strong></span>
              <span class="ws-pill ${st.summaryPassed ? 'ok' : 'warm'}">Tổng: <strong>${avg}%</strong></span>
            </div>
            <div style="display:flex;gap:10px;margin-top:6px;">
              <button type="button" class="btn" onclick="PersonalTaskEngine.startMcqStage()">Làm lại Task</button>
              <button type="button" class="btn btn-primary" onclick="PersonalTaskEngine.closeModal()">Xong · Về kho Task</button>
            </div>
          </div>
        `;
      }
    }

    setFilter(key) {
      this._activeFilter = key || 'all';
      window.TotoroUI?.renderInlineTaskHub?.();
    }

    /**
     * Renders the Personal Self-Created Tasks Hub inside #inline-task-suites & #inline-tasks-grid.
     */
    renderHub(tabsEl, gridEl, skillLabel = 'Reading') {
      if (!gridEl) return;
      const tasks = this.builder.buildTasks();
      const myTasks = tasks.filter((t) => !t.isDemo);
      const demoTasks = tasks.filter((t) => t.isDemo);
      const progress = this.store.loadAll();

      const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
      if (titleEl) titleEl.textContent = `Task Tự Tạo · ${skillLabel}`;

      const filtered = this._activeFilter === 'my'
        ? myTasks
        : (this._activeFilter === 'demo' ? demoTasks : tasks);
      const doneCnt = filtered.filter((t) => progress[t.id]?.status === 'completed').length;

      const subEl = document.getElementById('inline-task-sub');
      if (subEl) {
        subEl.textContent = myTasks.length
          ? `${doneCnt} / ${filtered.length} Task đã hoàn thành · Tự động sinh từ danh sách MY LIST của bạn (${myTasks.reduce((a, b) => a + b.words.length, 0)} từ cá nhân).`
          : `Chưa có từ nào trong MY LIST — hãy bấm "+ Tạo / Import từ" hoặc bấm lưu từ ngay trong bài Reading / Listening Practice để tự tạo Task riêng!`;
      }

      if (tabsEl) {
        tabsEl.innerHTML = `
          <button type="button" class="tot-seg-btn ${this._activeFilter === 'all' ? 'active' : ''}" onclick="PersonalTaskEngine.setFilter('all')">Tất cả (${tasks.length})</button>
          <button type="button" class="tot-seg-btn ${this._activeFilter === 'my' ? 'active' : ''}" onclick="PersonalTaskEngine.setFilter('my')">Từ MY LIST (${myTasks.length})</button>
          <button type="button" class="tot-seg-btn ${this._activeFilter === 'demo' ? 'active' : ''}" onclick="PersonalTaskEngine.setFilter('demo')">Demo mẫu (${demoTasks.length})</button>
          <button type="button" class="btn btn-primary" style="margin-left:auto;padding:6px 13px;font-size:12.5px;" onclick="window.MyVocabUI?.openModal?.()">+ Tạo / Import danh sách từ</button>
        `;
      }

      gridEl.classList.remove('is-listening-grid', 'is-writing-grid', 'is-speaking-grid');
      if (!filtered.length) {
        gridEl.innerHTML = `
          <div style="grid-column:1 / -1;padding:28px 20px;border-radius:16px;border:1.5px dashed var(--border-strong);background:var(--surface-panel);text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
            <strong style="font-size:15px;color:var(--ink);">Chưa có danh sách từ cá nhân nào để tạo Task</strong>
            <div style="font-size:13px;color:var(--ink-2);max-width:520px;line-height:1.55;">
              Bạn có thể thêm từ trực tiếp khi làm đề <strong>Reading / Listening Practice</strong>, nhập tay hoặc dán hàng loạt từ Quizlet/CSV vào <strong>MY LIST</strong> — hệ thống sẽ tự động chia thành các bài Task 3 bước (Flashcard → Trắc nghiệm → Nghe &amp; Gõ từ).
            </div>
            <button type="button" class="btn btn-primary" style="padding:8px 16px;font-size:13px;" onclick="window.MyVocabUI?.openModal?.()">+ Thêm từ vào MY LIST ngay</button>
          </div>
        `;
        return;
      }

      gridEl.innerHTML = filtered.map((t, idx) => {
        const rec = progress[t.id];
        const done = rec?.status === 'completed';
        const numStr = String(idx + 1).padStart(2, '0');
        return `
          <button type="button" class="tot-task-card has-stamp ${done ? 'is-done' : ''}" onclick="PersonalTaskEngine.openTask('${esc(t.id)}')">
            <span class="tot-task-num">${esc(numStr)}</span>
            <div style="min-width:0;flex:1;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span style="font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.title)}</span>
                ${t.isDemo ? '<span class="ws-pill warm" style="font-size:10px;padding:1px 6px;">DEMO</span>' : '<span class="ws-pill" style="font-size:10px;padding:1px 6px;">MY LIST</span>'}
              </div>
              <div style="font-size:11.5px;color:var(--ink-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.subtitle)} · 3 bước tương tác</div>
            </div>
            ${done ? `<span class="tot-task-score tabular">${rec.bestScore}%</span>` : ''}
          </button>
        `;
      }).join('');
    }
  }

  const store = new PersonalTaskStore();
  const builder = new PersonalTaskBuilder();
  const runner = new PersonalTaskRunner(store, builder);

  window.PersonalTaskEngine = Object.freeze({
    renderHub: (tabsEl, gridEl, skillLabel) => runner.renderHub(tabsEl, gridEl, skillLabel),
    setFilter: (k) => runner.setFilter(k),
    openTask: (id) => runner.openTask(id),
    closeModal: () => runner.closeModal(),
    jumpToFlashcard: (sk) => runner.jumpToFlashcard(sk),
    startMcqStage: () => runner.startMcqStage(),
    answerMcq: (i) => runner.answerMcq(i),
    nextMcq: () => runner.nextMcq(),
    startTypingStage: () => runner.startTypingStage(),
    submitTyping: () => runner.submitTyping(),
    nextTyping: () => runner.nextTyping(),
    speak: (w) => speakWord(w),
    getTasks: () => builder.buildTasks(),
    getStats: () => {
      const tasks = builder.buildTasks();
      const prog = store.loadAll();
      const done = tasks.filter((t) => prog[t.id]?.status === 'completed').length;
      return { total: tasks.length, done };
    },
  });

  // Auto-refresh Personal Task Hub whenever student edits MY LIST
  window.addEventListener('app:myvocab-updated', () => {
    if (window.AccessPolicy?.isRestricted?.() && window.TotoroUI?.getActiveView?.() === 'task') {
      window.TotoroUI.renderInlineTaskHub?.();
    }
  });
})();
