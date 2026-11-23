/* =========================================================
   TOTORO IELTS MASTER — VOICE & STT TEST LAB (Word + Sentence)
   Allows testing single words ("user", custom words) AND long
   sentences / free speech side-by-side with audio playback,
   model A/B switch (v3 / turbo / cf), and Boosted WAV vs Raw WebM.
   ========================================================= */
(function () {
  const QUICK_WORDS = [
    'user',
    'schedule',
    'environment',
    'comfortable',
    'necessary',
    'ubiquitous',
    'deteriorate',
    'phenomenon',
  ];

  const QUICK_SENTENCES = [
    {
      label: 'Câu ngắn (IELTS Part 1)',
      text: 'I usually spend my free time reading books and listening to podcasts to improve my English.',
    },
    {
      label: 'Câu học thuật (Listening)',
      text: 'The new system allows every user to access environmental data quickly and reliably.',
    },
    {
      label: 'Đoạn dài (Speaking Part 2)',
      text: 'Although living in a big city can be quite stressful, it offers better career opportunities and convenient public transport for young people.',
    },
    {
      label: 'Nói tự do (Không cần mẫu)',
      text: '',
    },
  ];

  let activeTab = 'word'; // 'word' | 'sentence'
  let enginePref = 'auto'; // 'auto' (v3) | 'turbo' | 'cf'
  let audioMode = 'boost'; // 'boost' (16k WAV) | 'raw' (WebM like Night IELTS)
  let passThreshold = 0.55; // synced with TotoroSpeechSTT.getDefaultThreshold()
  let currentWord = 'user';
  let currentSentence = QUICK_SENTENCES[0].text;
  let lastAudioUrl = '';
  let historyLogs = [];
  let isBusy = false;

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function ensureModalDom() {
    let el = document.getElementById('modal-voice-lab');
    if (el) return el;

    el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'modal-voice-lab';
    el.setAttribute('aria-label', 'Phòng Test Giọng Nói AI');
    el.addEventListener('click', (e) => {
      if (e.target === el) closeModal();
    });

    el.innerHTML = `
      <div class="modal-card vlab-card" onclick="event.stopPropagation()">
        <div class="modal-header vlab-header">
          <div style="display:flex; align-items:center; gap:10px; min-width:0;">
            <span class="tip-pill" style="margin:0;">PHÒNG TEST GIỌNG NÓI AI</span>
            <div class="modal-title" style="font-size:16.5px;">Kiểm tra Từ đơn &amp; Câu dài</div>
          </div>
          <button type="button" class="btn-icon-glass" style="width:34px; height:34px;" onclick="TotoroVoiceLab.close()" aria-label="Đóng">✕</button>
        </div>
        <div class="modal-body vlab-body" id="vlab-body"></div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function revokeOldAudioUrl() {
    if (lastAudioUrl) {
      try { URL.revokeObjectURL(lastAudioUrl); } catch (_) {}
      lastAudioUrl = '';
    }
  }

  function render() {
    const body = document.getElementById('vlab-body');
    if (!body) return;

    const wordChipsHtml = QUICK_WORDS.map((w) => {
      const act = currentWord.toLowerCase() === w ? 'active' : '';
      return `<button type="button" class="vlab-chip ${act}" onclick="TotoroVoiceLab.pickWord('${esc(w)}')">${esc(w)}</button>`;
    }).join('');

    const sentChipsHtml = QUICK_SENTENCES.map((s, i) => {
      const act = currentSentence === s.text ? 'active' : '';
      return `<button type="button" class="vlab-chip ${act}" onclick="TotoroVoiceLab.pickSentence(${i})">${esc(s.label)}</button>`;
    }).join('');

    const historyHtml = historyLogs.length
      ? `
        <div class="vlab-history">
          <div class="vlab-sec-label">Lịch sử test gần nhất (${historyLogs.length})</div>
          <div class="vlab-history-list">
            ${historyLogs.map((h) => `
              <div class="vlab-hist-row">
                <span class="vlab-hist-tag ${h.badgeClass}">${esc(h.badge)}</span>
                <span class="vlab-hist-main"><strong>${esc(h.heard || '(trống)')}</strong>${h.target ? ` <small>← mẫu: ${esc(h.target)}</small>` : ''}</span>
                <span class="vlab-hist-meta">${esc(h.meta)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `
      : '';

    body.innerHTML = `
      <div class="vlab-tabs">
        <button type="button" class="vlab-tab ${activeTab === 'word' ? 'active' : ''}" onclick="TotoroVoiceLab.setTab('word')">1. Test từng từ riêng</button>
        <button type="button" class="vlab-tab ${activeTab === 'sentence' ? 'active' : ''}" onclick="TotoroVoiceLab.setTab('sentence')">2. Test đọc câu dài / tự do</button>
      </div>

      <div class="vlab-controls-bar">
        <div class="vlab-ctrl-group">
          <span class="vlab-ctrl-lbl">AI Model:</span>
          <button type="button" class="vlab-pill ${enginePref === 'auto' ? 'active' : ''}" onclick="TotoroVoiceLab.setEngine('auto')">Whisper Large v3 ⭐</button>
          <button type="button" class="vlab-pill ${enginePref === 'turbo' ? 'active' : ''}" onclick="TotoroVoiceLab.setEngine('turbo')">v3 Turbo</button>
          <button type="button" class="vlab-pill ${enginePref === 'cf' ? 'active' : ''}" onclick="TotoroVoiceLab.setEngine('cf')">Cloudflare AI</button>
        </div>
        <div class="vlab-ctrl-group">
          <span class="vlab-ctrl-lbl">Âm thanh:</span>
          <button type="button" class="vlab-pill ${audioMode === 'boost' ? 'active' : ''}" onclick="TotoroVoiceLab.setAudioMode('boost')">Kích giọng nhỏ WAV</button>
          <button type="button" class="vlab-pill ${audioMode === 'raw' ? 'active' : ''}" onclick="TotoroVoiceLab.setAudioMode('raw')">Thu gốc WebM (Night IELTS)</button>
        </div>
        <div class="vlab-ctrl-group">
          <span class="vlab-ctrl-lbl">Ngưỡng đậu:</span>
          <button type="button" class="vlab-pill ${Math.round(passThreshold * 100) === 50 ? 'active' : ''}" onclick="TotoroVoiceLab.setThreshold(0.50)">50% (Thoáng)</button>
          <button type="button" class="vlab-pill ${Math.round(passThreshold * 100) === 55 ? 'active' : ''}" onclick="TotoroVoiceLab.setThreshold(0.55)">55% (Chuẩn ⭐)</button>
          <button type="button" class="vlab-pill ${Math.round(passThreshold * 100) === 65 ? 'active' : ''}" onclick="TotoroVoiceLab.setThreshold(0.65)">65% (Vừa)</button>
          <button type="button" class="vlab-pill ${Math.round(passThreshold * 100) === 75 ? 'active' : ''}" onclick="TotoroVoiceLab.setThreshold(0.75)">75% (Khó)</button>
        </div>
      </div>

      ${activeTab === 'word' ? `
        <div class="vlab-section">
          <div class="vlab-sec-label">Chọn từ test nhanh hoặc nhập từ bất kỳ:</div>
          <div class="vlab-chips">${wordChipsHtml}</div>
          <div class="vlab-input-row">
            <input type="text" class="vlab-input" id="vlab-word-input" value="${esc(currentWord)}" placeholder="Nhập từ tiếng Anh muốn test (vd: user, schedule...)" oninput="TotoroVoiceLab.onWordInput(this.value)" />
            <button type="button" class="rl-audio-btn is-primary" onclick="TotoroVoiceLab.speakTarget('en-GB')">🔊 UK</button>
            <button type="button" class="rl-audio-btn" onclick="TotoroVoiceLab.speakTarget('en-US')">🔊 US</button>
          </div>
        </div>
      ` : `
        <div class="vlab-section">
          <div class="vlab-sec-label">Chọn câu mẫu hoặc xóa trống để nói tự do (nhấn Dừng khi nói xong):</div>
          <div class="vlab-chips">${sentChipsHtml}</div>
          <div class="vlab-sent-wrap">
            <textarea class="vlab-textarea" id="vlab-sent-input" rows="3" placeholder="Để trống nếu muốn nói tiếng Anh tự do, hoặc nhập câu mẫu cần đọc..." oninput="TotoroVoiceLab.onSentenceInput(this.value)">${esc(currentSentence)}</textarea>
            ${currentSentence ? `
              <div class="vlab-sent-audio-row">
                <button type="button" class="rl-audio-btn is-primary" onclick="TotoroVoiceLab.speakTarget('en-GB')">🔊 Nghe đọc mẫu (UK)</button>
                <button type="button" class="rl-audio-btn" onclick="TotoroVoiceLab.speakTarget('en-US')">🔊 US</button>
              </div>
            ` : ''}
          </div>
        </div>
      `}

      <div class="rl-mic-stage vlab-mic-stage">
        <div class="rl-waveform" id="vlab-waveform" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span><span></span>
        </div>
        <button type="button" class="rl-mic-btn" id="btn-vlab-mic" onclick="TotoroVoiceLab.toggleMic()">
          <span class="rl-mic-ico" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
          </span>
          <span id="vlab-mic-label">${activeTab === 'word' ? 'Bấm để nói 1 từ' : 'Bấm để bắt đầu đọc câu'}</span>
        </button>
        <div class="rl-mic-sub" id="vlab-mic-sub">
          ${activeTab === 'word'
            ? 'Nói tự nhiên sau khi bấm (tự dừng sau 1.4s im lặng hoặc bấm Dừng ngay).'
            : 'Đọc xong cả câu rồi bấm nút đỏ để Dừng & xem AI nhận diện từng chữ.'}
        </div>
      </div>

      <div class="vlab-result-box" id="vlab-result-box" style="display:none;"></div>
      ${historyHtml}
    `;
  }

  function updateWaveform(bars) {
    const wf = document.getElementById('vlab-waveform');
    if (!wf || !Array.isArray(bars)) return;
    wf.querySelectorAll('span').forEach((bar, i) => {
      const v = Math.max(0.16, Math.min(1, Number(bars[i] || 0.16)));
      bar.style.transform = `scaleY(${v.toFixed(2)})`;
    });
  }

  function setMicVisual(state, subText) {
    const btn = document.getElementById('btn-vlab-mic');
    const lbl = document.getElementById('vlab-mic-label');
    const sub = document.getElementById('vlab-mic-sub');
    const wf = document.getElementById('vlab-waveform');
    if (btn) {
      btn.classList.remove('is-recording', 'is-processing');
      btn.disabled = state === 'processing';
      if (state === 'recording') btn.classList.add('is-recording');
      if (state === 'processing') btn.classList.add('is-processing');
    }
    if (wf) {
      wf.classList.toggle('is-recording', state === 'recording');
      wf.classList.toggle('is-processing', state === 'processing');
      if (state !== 'recording') {
        wf.querySelectorAll('span').forEach((b) => { b.style.transform = 'scaleY(0.18)'; });
      }
    }
    if (lbl) {
      if (state === 'recording') lbl.textContent = 'Đang thu… Bấm để Dừng & Chấm';
      else if (state === 'processing') lbl.textContent = 'Đang gửi AI nhận diện…';
      else lbl.textContent = activeTab === 'word' ? 'Bấm để nói 1 từ' : 'Bấm để bắt đầu đọc câu';
    }
    if (sub && subText !== undefined) sub.textContent = subText;
  }

  function showResult(res) {
    const box = document.getElementById('vlab-result-box');
    if (!box) return;
    box.style.display = 'block';

    revokeOldAudioUrl();
    if (res.audioUrl) lastAudioUrl = res.audioUrl;

    const audioPlayerHtml = res.audioUrl
      ? `
        <div class="vlab-playback">
          <span class="vlab-playback-lbl">Nghe lại đúng file âm thanh vừa gửi AI:</span>
          <audio controls src="${res.audioUrl}" style="height:34px; width:100%; max-width:340px;"></audio>
        </div>
      `
      : '';

    if (res.silent) {
      box.className = 'vlab-result-box is-warn';
      box.innerHTML = `
        <div class="vlab-res-title">⚠️ Micro gần như không thu được âm thanh</div>
        <div class="vlab-res-text">Hãy kiểm tra chọn đúng Micro trong Windows / trình duyệt, hoặc thử chuyển sang chế độ <strong>Thu gốc WebM</strong> để so sánh.</div>
        ${audioPlayerHtml}
      `;
      return;
    }

    const engineLabel = String(res.engine || 'whisper').replace('groq:', 'Groq ').replace('cloudflare:', 'CF ');
    const gainText = res.rawMode ? 'Raw WebM' : (res.boosted ? `WAV · Boost ${res.gainApplied}×` : `WAV · ${res.gainApplied || 1}×`);
    const metaStr = `${engineLabel} · ${gainText} · ${res.durationSec || '?'}s · ${res.latencyMs || '?'}ms`;

    if (activeTab === 'word') {
      const target = currentWord.trim();
      const match = target ? window.TotoroSpeechSTT.matchSpokenTarget(res.text || '', target, { threshold: passThreshold }) : null;
      const statusClass = !match ? 'is-neutral' : (match.matched ? 'is-pass' : 'is-fail');
      const pct = match ? Math.round(match.score * 100) : 0;
      const phonPct = match ? Math.round((match.phonSim || 0) * 100) : 0;
      const charPct = match ? Math.round((match.charSim || 0) * 100) : 0;
      const thPct = Math.round(passThreshold * 100);

      box.className = `vlab-result-box ${statusClass}`;
      box.innerHTML = `
        <div class="vlab-res-top">
          <div class="vlab-res-title">
            ${!match
              ? '🎙️ Kết quả AI nghe được'
              : (match.matched ? `✅ ĐẠT (${pct}% ≥ ${thPct}%)` : `❌ CHƯA ĐẠT (${pct}% < ${thPct}%)`)}
          </div>
          <span class="vlab-res-meta">${esc(metaStr)}</span>
        </div>
        <div class="vlab-res-heard">"${esc(res.text || '(trống)')}"</div>
        ${match ? `<div class="vlab-res-note">So với <strong>"${esc(target)}"</strong> → Âm đọc (Phonetic): <strong>${phonPct}%</strong> · Mặt chữ: <strong>${charPct}%</strong>${!match.matched ? ` — ${esc(match.reason)}` : ''}</div>` : ''}
        ${audioPlayerHtml}
      `;

      historyLogs.unshift({
        badge: match ? (match.matched ? `✓ ${pct}%` : `✗ ${pct}%`) : 'Từ',
        badgeClass: match ? (match.matched ? 'is-pass' : 'is-fail') : 'is-neutral',
        heard: res.text || '(trống)',
        target,
        meta: `${engineLabel} · ${gainText}`,
      });
    } else {
      const ref = currentSentence.trim();
      let diffHtml = '';
      let badgeTxt = 'Tự do';
      let statusClass = 'is-pass';
      if (ref) {
        const cmp = window.TotoroSpeechSTT.compareSentence(res.text || '', ref);
        badgeTxt = `${cmp.accuracyPct}% (${cmp.hits}/${cmp.total} từ)`;
        statusClass = cmp.accuracyPct >= 80 ? 'is-pass' : (cmp.accuracyPct >= 50 ? 'is-warn' : 'is-fail');
        diffHtml = `
          <div class="vlab-diff-wrap">
            <div class="vlab-diff-lbl">So khớp từng từ với câu mẫu:</div>
            <div class="vlab-diff-words">
              ${cmp.items.map((w) => `<span class="vlab-dw ${w.hit ? 'is-hit' : 'is-miss'}">${esc(w.word)}</span>`).join(' ')}
            </div>
          </div>
        `;
      }

      const wordCount = (res.text || '').trim().split(/\s+/).filter(Boolean).length;
      const wpm = (res.durationSec && res.durationSec > 0.5 && wordCount > 0)
        ? Math.round((wordCount / res.durationSec) * 60)
        : 0;
      const wpmMeta = wpm ? ` · ~${wpm} từ/phút` : '';

      box.className = `vlab-result-box ${statusClass}`;
      box.innerHTML = `
        <div class="vlab-res-top">
          <div class="vlab-res-title">🎙️ AI chép lại (${esc(badgeTxt)})</div>
          <span class="vlab-res-meta">${esc(metaStr + wpmMeta)}</span>
        </div>
        <div class="vlab-res-heard is-sentence">"${esc(res.text || '(trống)')}"</div>
        ${diffHtml}
        ${audioPlayerHtml}
      `;

      historyLogs.unshift({
        badge: badgeTxt,
        badgeClass: statusClass,
        heard: (res.text || '(trống)').slice(0, 72) + ((res.text || '').length > 72 ? '…' : ''),
        target: '',
        meta: `${engineLabel} · ${gainText}`,
      });
    }

    historyLogs = historyLogs.slice(0, 5);
    const histEl = document.querySelector('#vlab-body .vlab-history');
    if (histEl) histEl.remove();
    const wrap = document.createElement('div');
    wrap.className = 'vlab-history';
    wrap.innerHTML = `
      <div class="vlab-sec-label">Lịch sử test gần nhất (${historyLogs.length})</div>
      <div class="vlab-history-list">
        ${historyLogs.map((h) => `
          <div class="vlab-hist-row">
            <span class="vlab-hist-tag ${h.badgeClass}">${esc(h.badge)}</span>
            <span class="vlab-hist-main"><strong>${esc(h.heard)}</strong>${h.target ? ` <small>← mẫu: ${esc(h.target)}</small>` : ''}</span>
            <span class="vlab-hist-meta">${esc(h.meta)}</span>
          </div>
        `).join('')}
      </div>
    `;
    document.getElementById('vlab-body')?.appendChild(wrap);
  }

  async function toggleMic() {
    const stt = window.TotoroSpeechSTT;
    if (!stt || !stt.isSupported()) {
      window.__VOCAB_BRIDGE__?.showToast?.('Trình duyệt không hỗ trợ thu âm Micro.');
      return;
    }
    if (stt.isRecording()) {
      stt.stop();
      return;
    }
    if (isBusy) return;
    isBusy = true;

    const isWord = activeTab === 'word';
    const started = await stt.startRecording({
      mode: isWord ? 'word' : 'speaking',
      engine: enginePref,
      skipDsp: audioMode === 'raw',
      maxDurationMs: isWord ? 6500 : 90000,
      autoStopOnSilence: isWord,
      onStart: () => {
        setMicVisual(
          'recording',
          isWord
            ? 'Đang thu… hãy nói rõ từ của bạn (tự dừng sau 1.4s im lặng hoặc bấm Dừng ngay).'
            : 'Đang thu câu dài… đọc thoải mái, xong bấm nút đỏ để Dừng & Chấm.'
        );
      },
      onLevel: ({ bars }) => updateWaveform(bars),
      onProcessing: ({ stage, boosted, gainApplied }) => {
        const msg = stage === 'upload' && boosted
          ? `Đã khuếch đại giọng nhỏ (${gainApplied}×) · đang gửi AI…`
          : 'Đang xử lý & gửi tới AI Whisper…';
        setMicVisual('processing', msg);
      },
      onResult: (res) => {
        isBusy = false;
        setMicVisual('idle', isWord ? 'Xong! Nghe lại bản thu bên dưới hoặc thử đổi Model / Âm thanh để so sánh.' : 'Xong! Xem kết quả từng từ bên dưới.');
        showResult(res);
      },
      onError: (msg) => {
        isBusy = false;
        setMicVisual('idle', 'Có lỗi thu âm — thử lại nhé.');
        const box = document.getElementById('vlab-result-box');
        if (box) {
          box.style.display = 'block';
          box.className = 'vlab-result-box is-fail';
          box.innerHTML = `<div class="vlab-res-title">❌ Lỗi</div><div class="vlab-res-text">${esc(msg)}</div>`;
        }
      },
    });
    if (!started) {
      isBusy = false;
      setMicVisual('idle');
    }
  }

  function speakTarget(accent) {
    const txt = activeTab === 'word' ? currentWord.trim() : currentSentence.trim();
    if (!txt) return;
    if (window.AppCore?.audio) {
      window.AppCore.audio.speak(txt, { accent: accent || 'en-GB', rate: 0.92, engine: 'auto', respectCustom: false });
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = accent || 'en-GB';
      u.rate = 0.92;
      window.speechSynthesis.speak(u);
    }
  }

  function openModal(initialTab) {
    if (initialTab === 'word' || initialTab === 'sentence') activeTab = initialTab;
    if (window.TotoroSpeechSTT?.getDefaultThreshold) {
      passThreshold = window.TotoroSpeechSTT.getDefaultThreshold();
    }
    const modal = ensureModalDom();
    render();
    modal.classList.add('open');
  }

  function closeModal() {
    window.TotoroSpeechSTT?.abort?.();
    isBusy = false;
    document.getElementById('modal-voice-lab')?.classList.remove('open');
  }

  window.TotoroVoiceLab = {
    open: openModal,
    close: closeModal,
    setTab: (tab) => {
      window.TotoroSpeechSTT?.abort?.();
      isBusy = false;
      activeTab = tab === 'sentence' ? 'sentence' : 'word';
      render();
    },
    setEngine: (eng) => {
      enginePref = eng;
      render();
    },
    setAudioMode: (m) => {
      audioMode = m === 'raw' ? 'raw' : 'boost';
      render();
    },
    setThreshold: (val) => {
      passThreshold = window.TotoroSpeechSTT?.setDefaultThreshold
        ? window.TotoroSpeechSTT.setDefaultThreshold(val)
        : Number(val) || 0.55;
      render();
    },
    pickWord: (w) => {
      currentWord = w;
      render();
    },
    onWordInput: (v) => {
      currentWord = v;
    },
    pickSentence: (idx) => {
      if (QUICK_SENTENCES[idx]) {
        currentSentence = QUICK_SENTENCES[idx].text;
        render();
      }
    },
    onSentenceInput: (v) => {
      currentSentence = v;
    },
    speakTarget,
    toggleMic,
  };
})();
