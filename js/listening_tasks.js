/* =========================================================
   TOTORO IELTS MASTER — IELTS LISTENING 3-TEST TASK ENGINE
   ---------------------------------------------------------
   Locked-in Rules (listening_spec.md):
   - NO replay button during ANY test (Test 1, Test 2, Test 3).
   - Test 1: 100% of Task words (e.g., 30/30) One-Shot Audio Dictation.
   - Test 2: 12 Short Conversations MCQ (2 speakers, roundabout distractors + paraphrase).
   - Test 3: Real Cambridge Note Completion (10s prediction -> 1-shot audio ->
             2-Column Compare: LEFT = 3-Color Transcript + Replay, RIGHT = Marked Note Sheet).
   - NO blocking pass-gates: finishing each test scores & saves immediately ("làm được nhiêu ghi nhận bấy nhiêu").
   ========================================================= */
(function () {
  'use strict';

  const PROGRESS_KEY_BASE = 'totoro_listening_task_progress_v1_';
  // Nguồn phát 143 file .mp3 giọng Neural AI (có thể đổi sang Cloudflare R2 URL khi mở rộng hàng nghìn file)
  const DEFAULT_AUDIO_BASE_URL = 'audio';
  // Tốc độ phát chuẩn tự nhiên (1.0x)
  const EXAM_PLAYBACK_RATE = 1.0;

  let activeSuiteKey = 'part1';
  let examState = null;
  let audioSeqId = 0;
  let activeHtmlAudio = null;
  let activeHtmlAudioTimer = null;
  let preReadTimer = null;
  let t1CountdownTimer = null;
  let t1DeadlineAt = 0;

  const DIRECTOR_SVG = {
    clock: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>',
    speaker: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
    check: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 16 9.5"/></svg>',
    wave: '<span class="lt-dir-eq" aria-hidden="true"><span></span><span></span><span></span><span></span></span>',
  };

  function renderAudioPillHtml(id, prepSeconds) {
    return `
      <div class="lt-audio-pill is-prep" id="${id}" role="status" aria-live="polite">
        <span class="lt-ap-icon" id="${id}-icon">${DIRECTOR_SVG.clock}</span>
        <span class="lt-ap-label" id="${id}-label">Chuẩn bị</span>
        <span class="lt-ap-wave" id="${id}-wave" style="display:none;">${DIRECTOR_SVG.wave}</span>
        <span class="lt-ap-sec tabular" id="${id}-sec">${prepSeconds}s</span>
        <span class="lt-ap-track" aria-hidden="true"><span class="lt-ap-fill" id="${id}-fill" style="transform:scaleX(1)"></span></span>
      </div>
    `;
  }

  function setAudioPillState(id, cfg) {
    const pill = document.getElementById(id);
    if (!pill) return;
    pill.classList.remove('is-prep', 'is-playing', 'is-gap', 'is-done');
    if (cfg.state) pill.classList.add(cfg.state);

    const iconEl = document.getElementById(`${id}-icon`);
    const lblEl = document.getElementById(`${id}-label`);
    const waveEl = document.getElementById(`${id}-wave`);
    const secEl = document.getElementById(`${id}-sec`);
    const fillEl = document.getElementById(`${id}-fill`);

    if (iconEl && cfg.icon !== undefined) iconEl.innerHTML = cfg.icon;
    if (lblEl && cfg.label !== undefined) {
      lblEl.textContent = cfg.label;
      lblEl.style.display = cfg.label ? '' : 'none';
    }
    if (waveEl && cfg.showWave !== undefined) {
      waveEl.style.display = cfg.showWave ? 'inline-flex' : 'none';
    }
    if (secEl && cfg.sec !== undefined) {
      secEl.textContent = cfg.sec;
      secEl.style.display = cfg.sec ? '' : 'none';
    }
    if (fillEl && cfg.progress !== undefined) {
      const clamped = Math.max(0, Math.min(1, Number(cfg.progress)));
      fillEl.style.transform = `scaleX(${clamped})`;
    }
  }

  function runTwoPassAudioSequence(opts) {
    const {
      directorId,
      prepSeconds = 5,
      gapSeconds = 5,
      audioFile = '',
      turns = [],
      timestamps = [],
      gapMs = 260,
      isStillActive,
      onStartPlaying,
    } = opts;

    const startCountdown = (seconds, onTick, onFinish) => {
      let rem = seconds;
      onTick(rem, seconds);
      preReadTimer = setInterval(() => {
        rem -= 1;
        if (!isStillActive()) {
          clearInterval(preReadTimer);
          preReadTimer = null;
          return;
        }
        if (rem > 0) {
          onTick(rem, seconds);
        } else {
          clearInterval(preReadTimer);
          preReadTimer = null;
          onFinish();
        }
      }, 1000);
    };

    const playPass = (passNum) => {
      if (!isStillActive()) return;
      if (typeof onStartPlaying === 'function') onStartPlaying(passNum);

      setAudioPillState(directorId, {
        state: 'is-playing',
        icon: DIRECTOR_SVG.speaker,
        label: '',
        showWave: true,
        sec: `${passNum}/2`,
        progress: passNum === 1 ? 0.5 : 1,
      });

      const onPassDone = () => {
        if (!isStillActive()) return;
        if (passNum === 1) {
          startCountdown(
            gapSeconds,
            (rem, total) => {
              setAudioPillState(directorId, {
                state: 'is-gap',
                icon: DIRECTOR_SVG.clock,
                label: 'Lượt 2 sau',
                showWave: false,
                sec: `${rem}s`,
                progress: rem / Math.max(1, total),
              });
            },
            () => playPass(2)
          );
        } else {
          setAudioPillState(directorId, {
            state: 'is-done',
            icon: DIRECTOR_SVG.check,
            label: 'Đã phát',
            showWave: false,
            sec: '',
            progress: 1,
          });
        }
      };

      playStudioMp3(audioFile, {
        turns,
        timestamps,
        rate: EXAM_PLAYBACK_RATE,
        onDone: onPassDone,
      }).then((usedMp3) => {
        if (!usedMp3 && isStillActive()) {
          playTurnsOneShot(turns, {
            rate: EXAM_PLAYBACK_RATE,
            gapMs,
            onDone: onPassDone,
          });
        }
      });
    };

    startCountdown(
      prepSeconds,
      (rem, total) => {
        setAudioPillState(directorId, {
          state: 'is-prep',
          icon: DIRECTOR_SVG.clock,
          label: 'Chuẩn bị',
          showWave: false,
          sec: `${rem}s`,
          progress: rem / Math.max(1, total),
        });
      },
      () => playPass(1)
    );
  }

  function getAudioBaseUrl() {
    let saved = '';
    try { saved = localStorage.getItem('totoro_listening_audio_base') || ''; } catch (_) {}
    const raw = window.TOTORO_LISTENING_AUDIO_BASE || saved || DEFAULT_AUDIO_BASE_URL;
    const clean = String(raw || '').trim().replace(/\/+$/, '');
    if (!clean) return '';
    if (/^https?:\/\//i.test(clean) || clean.startsWith('/')) return clean;
    if (window.location.protocol !== 'file:' && typeof window.__APP_BASE_PATH__ === 'string') {
      return `${window.__APP_BASE_PATH__.replace(/\/+$/, '')}/${clean}`;
    }
    return clean;
  }

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getUid() {
    return window.__VOCAB_BRIDGE__?.getScopedUid?.() || 'guest';
  }

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(PROGRESS_KEY_BASE + getUid()) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveProgress(map) {
    try {
      localStorage.setItem(PROGRESS_KEY_BASE + getUid(), JSON.stringify(map || {}));
    } catch (_) {}
    window.__VOCAB_BRIDGE__?.syncPushCurrentUser?.(false);
  }

  function getTasksData() {
    return window.APP_LISTENING_TASKS || { suites: [], tasks: [] };
  }

  function getVocabMap() {
    const v = window.APP_LISTENING_VOCAB || {};
    const map = {};
    [...(v.target_all || []), ...(v.foundation || []), ...(v.cues_40 || [])].forEach((w) => {
      if (w && w.id) map[w.id] = w;
    });
    return map;
  }

  function resolveTaskWords(task) {
    if (!task) return [];
    const map = getVocabMap();
    return (task.wordIds || []).map((id) => map[id]).filter(Boolean);
  }

  function getMasteredCount(task) {
    const assess = window.__VOCAB_BRIDGE__?.getAssessments?.() || {};
    return (task.wordIds || []).filter((id) => assess[id] === 3).length;
  }

  /* ---------------------------------------------------------
     MULTI-SPEAKER ONE-SHOT AUDIO ENGINE (UK / AU / US · M/F)
     --------------------------------------------------------- */
  function stopAllAudio() {
    audioSeqId += 1;
    if (preReadTimer) { clearInterval(preReadTimer); preReadTimer = null; }
    if (t1CountdownTimer) { clearInterval(t1CountdownTimer); t1CountdownTimer = null; }
    if (activeHtmlAudioTimer) { clearTimeout(activeHtmlAudioTimer); activeHtmlAudioTimer = null; }
    if (activeHtmlAudio) {
      try { activeHtmlAudio.pause(); activeHtmlAudio.src = ''; } catch (_) {}
      activeHtmlAudio = null;
    }
    try { window.AppCore?.audio?.stop?.(); } catch (_) {}
    try { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); } catch (_) {}
  }

  function playStudioMp3(relFile, opts = {}) {
    const base = getAudioBaseUrl();
    if (!base || !relFile) return Promise.resolve(false);
    stopAllAudio();
    const mySeq = audioSeqId;
    const url = `${base}/${String(relFile).replace(/^\/+/, '')}`;

    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.playbackRate = opts.rate || EXAM_PLAYBACK_RATE;
        activeHtmlAudio = audio;
        let settled = false;
        let lastTurnIdx = -1;
        const turns = opts.turns || [];
        const timestamps = opts.timestamps || [];
        const startSec = typeof opts.startSec === 'number' ? Math.max(0, opts.startSec) : null;
        const endSec = typeof opts.endSec === 'number' ? opts.endSec : null;

        const finish = (ok) => {
          if (settled) return;
          settled = true;
          if (activeHtmlAudioTimer) { clearTimeout(activeHtmlAudioTimer); activeHtmlAudioTimer = null; }
          if (activeHtmlAudio === audio) {
            try { audio.pause(); } catch (_) {}
            activeHtmlAudio = null;
          }
          if (ok && mySeq === audioSeqId) opts.onDone?.();
          resolve(ok && mySeq === audioSeqId);
        };

        audio.addEventListener('timeupdate', () => {
          if (mySeq !== audioSeqId || settled) return;
          const cur = audio.currentTime;
          if (endSec != null && cur >= endSec) {
            finish(true);
            return;
          }
          if (timestamps.length && typeof opts.onTurn === 'function') {
            for (let i = 0; i < timestamps.length; i++) {
              if (cur >= timestamps[i][0] - 0.08 && cur <= timestamps[i][1] + 0.15) {
                if (i !== lastTurnIdx) {
                  lastTurnIdx = i;
                  opts.onTurn(i, turns[i] || {});
                }
                break;
              }
            }
          }
        });

        audio.addEventListener('ended', () => finish(true));
        audio.addEventListener('error', () => finish(false));

        const startPlay = () => {
          if (mySeq !== audioSeqId) return finish(false);
          if (startSec != null) {
            try { audio.currentTime = startSec; } catch (_) {}
          }
          if (timestamps.length && typeof opts.onTurn === 'function' && lastTurnIdx < 0) {
            lastTurnIdx = 0;
            opts.onTurn(0, turns[0] || {});
          }
          const p = audio.play();
          if (p && typeof p.catch === 'function') {
            p.catch(() => finish(false));
          }
          if (endSec != null && startSec != null) {
            const rate = audio.playbackRate || 1;
            const clipMs = Math.max(400, ((endSec - startSec) / rate) * 1000 + 250);
            activeHtmlAudioTimer = setTimeout(() => finish(true), clipMs);
          }
        };

        if (startSec != null) {
          audio.addEventListener('loadedmetadata', startPlay, { once: true });
          audio.load();
        } else {
          startPlay();
        }
      } catch (_) {
        resolve(false);
      }
    });
  }

  function pickSpeechVoice(accent, speakerName) {
    if (!('speechSynthesis' in window)) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;
    const langPref = String(accent || 'en-GB').toLowerCase();
    const isMale = /\b(man|male|tom|john|david|mark|alex|ben|ryan|lecturer|tutor|professor|guide)\b/i.test(String(speakerName || ''));
    const maleRe = /\b(daniel|ryan|george|david|mark|guy|james|william|alex|andrew|brian|oliver|arthur|male)\b/i;
    const femaleRe = /\b(sonia|libby|serena|martha|karen|natasha|samantha|jenny|aria|zira|hazel|susan|kate|female)\b/i;

    const langMatches = voices.filter((v) => String(v.lang || '').toLowerCase().startsWith(langPref.slice(0, 5)))
      || voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'));
    const pool = langMatches.length ? langMatches : voices.filter((v) => /^en/i.test(v.lang || ''));
    if (!pool.length) return null;

    const genderMatch = pool.find((v) => (isMale ? maleRe : femaleRe).test(v.name || ''));
    return genderMatch || pool[0];
  }

  function speakUtteranceAsync(text, accent, speakerName, rate, mySeq) {
    return new Promise((resolve) => {
      if (mySeq !== audioSeqId) return resolve(false);
      const clean = String(text || '').trim();
      if (!clean) return resolve(true);

      if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
        if (window.AppCore?.audio) {
          window.AppCore.audio.speak(clean, { accent: accent || 'en-GB', rate: rate || 0.96, respectCustom: false });
        }
        setTimeout(() => resolve(mySeq === audioSeqId), Math.max(900, clean.split(/\s+/).length * 420));
        return;
      }

      try {
        window.speechSynthesis.cancel();
        const utt = new SpeechSynthesisUtterance(clean);
        utt.lang = accent || 'en-GB';
        utt.rate = rate || 0.96;
        const v = pickSpeechVoice(accent, speakerName);
        if (v) utt.voice = v;
        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          clearTimeout(watchdog);
          resolve(mySeq === audioSeqId);
        };
        const estMs = Math.max(2500, clean.split(/\s+/).length * 520 + 2500);
        const watchdog = setTimeout(done, estMs);
        utt.onend = done;
        utt.onerror = done;
        window.speechSynthesis.speak(utt);
      } catch (_) {
        resolve(mySeq === audioSeqId);
      }
    });
  }

  async function playTurnsOneShot(turns, opts = {}) {
    stopAllAudio();
    const mySeq = audioSeqId;
    const rate = opts.rate || 0.96;
    for (let i = 0; i < turns.length; i++) {
      if (mySeq !== audioSeqId) return false;
      const t = turns[i];
      opts.onTurn?.(i, t);
      const ok = await speakUtteranceAsync(t.text, t.accent || 'en-GB', t.speaker || '', rate, mySeq);
      if (!ok || mySeq !== audioSeqId) return false;
      if (i < turns.length - 1) {
        await new Promise((r) => setTimeout(r, opts.gapMs || 320));
      }
    }
    if (mySeq === audioSeqId) opts.onDone?.();
    return mySeq === audioSeqId;
  }

  function speakSingleWordOneShot(word, accent, onDone) {
    stopAllAudio();
    const mySeq = audioSeqId;
    const chosenAccent = accent || (Math.random() < 0.65 ? 'en-GB' : 'en-US');
    if (window.AppCore?.audio && !navigator.webdriver) {
      window.AppCore.audio.speak(word, { accent: chosenAccent, rate: EXAM_PLAYBACK_RATE, engine: 'auto', respectCustom: false });
      setTimeout(() => { if (mySeq === audioSeqId) onDone?.(); }, 900);
      return;
    }
    speakUtteranceAsync(word, chosenAccent, 'Woman', EXAM_PLAYBACK_RATE, mySeq).then(() => {
      if (mySeq === audioSeqId) onDone?.();
    });
  }

  /* ---------------------------------------------------------
     SPELLING DIAGNOSTIC ENGINE (100% EXACT CAMBRIDGE CHECK)
     --------------------------------------------------------- */
  function normalizeSpelling(raw) {
    return String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function diagnoseSpellingError(typedRaw, expectedRaw, acceptedList) {
    const typed = normalizeSpelling(typedRaw);
    const expected = normalizeSpelling(expectedRaw);
    const allOk = [expected, ...(acceptedList || []).map(normalizeSpelling)].filter(Boolean);
    if (allOk.includes(typed)) {
      return { correct: true, note: '' };
    }
    if (!typed) {
      return { correct: false, note: 'Bỏ trống' };
    }
    // Check missing or extra plural -s/-es
    if (typed + 's' === expected || typed + 'es' === expected) {
      return { correct: false, note: 'Thiếu đuôi số nhiều (-s/-es)' };
    }
    if (expected + 's' === typed || expected + 'es' === typed) {
      return { correct: false, note: 'Thừa đuôi số nhiều (-s/-es)' };
    }
    // Check UK/US spelling tolerance (colour/color, centre/center, programme/program)
    const ukUsNorm = (s) => s.replace(/our$/g, 'or').replace(/ise$/g, 'ize').replace(/re$/g, 'er').replace(/ll$/g, 'l');
    if (ukUsNorm(typed) === ukUsNorm(expected)) {
      return { correct: true, note: 'Chấp nhận chính tả UK/US' };
    }
    // Check double letter slip (e.g. acommodation vs accommodation)
    if (typed.replace(/([a-z])\1+/g, '$1') === expected.replace(/([a-z])\1+/g, '$1')) {
      return { correct: false, note: 'Lỗi chữ đôi (double letter)' };
    }
    return { correct: false, note: 'Sai chính tả' };
  }

  /* ---------------------------------------------------------
     DEDICATED LISTENING TASK HUB (Exact Match to Reading Clean UI)
     --------------------------------------------------------- */
  const CLEAN_SUITE_LABELS = {
    part1: 'Giao tiếp',
    part2: 'Bản đồ & Địa điểm',
    part3: 'Thảo luận',
    part4: 'Bài giảng',
    core_found: 'Nền tảng & Cốt lõi',
  };

  const SHORT_LISTENING_TOPICS = {
    lp1_01: 'Coastal Cycling Tour',
    lp1_02: 'Seaside Hostel Job',
    lmap_01: 'Botanical Park Map',
    lmap_02: 'Market Town Map',
    lmap_03: 'Arts Centre Plan',
    lp2_01: 'Heritage Park Guide',
    lp2_02: 'Autumn Craft Festival',
    lp3_01: 'Sustainable Materials',
    lp3_02: 'Recycling Dissertation',
    lp4_01: 'River Estuaries',
    lp4_02: 'Historic Port Renewal',
  };

  const SHORT_THEME_REPLACERS = [
    ['Bản đồ, Địa điểm & Công trình', 'Địa điểm & Công trình'],
    ['Du lịch, Giao thông & Kỳ nghỉ', 'Du lịch & Giao thông'],
    ['Việc làm, Tuyển dụng & Công sở', 'Việc làm & Công sở'],
    ['Tài chính, Mua sắm & Dịch vụ', 'Tài chính & Dịch vụ'],
    ['Giáo dục, Đại học & Nghiên cứu', 'Giáo dục & Nghiên cứu'],
    ['Sức khỏe, Y tế & Lối sống', 'Sức khỏe & Y tế'],
    ['Ẩm thực, Nấu nướng & Nông nghiệp', 'Ẩm thực & Nông nghiệp'],
    ['Môi trường, Thiên nhiên & Động vật', 'Môi trường & Tự nhiên'],
    ['Khoa học, Công nghệ & Kỹ thuật số', 'Khoa học & Công nghệ'],
    ['Nghệ thuật, Văn hóa, Giải trí & Thể thao', 'Văn hóa & Giải trí'],
    ['Lịch sử, Xã hội & Chính sách', 'Lịch sử & Xã hội'],
    ['Thời gian, Lịch trình & Sinh hoạt', 'Thời gian & Lịch trình'],
    ['Động từ cốt lõi, Tư duy & Biểu đạt', 'Động từ & Biểu đạt'],
  ];

  function shortTopicTitle(t) {
    if (!t) return '';
    if (t.id && SHORT_LISTENING_TOPICS[t.id]) return SHORT_LISTENING_TOPICS[t.id];
    const raw = String(t.topicTitle || t.theme || '').replace(/^🗺️\s*MAP\s*·\s*/i, '').trim();
    const noParen = raw.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    const parts = noParen.split('·');
    let out = (parts.length > 1 ? parts[parts.length - 1] : noParen).trim();
    for (const [longStr, shortStr] of SHORT_THEME_REPLACERS) {
      if (out.includes(longStr)) {
        out = out.replace(longStr, shortStr);
        break;
      }
    }
    return out;
  }

  function renderHub(tabsEl, gridEl) {
    const data = getTasksData();
    const suites = data.suites || [];
    const tasks = data.tasks || [];
    const progress = loadProgress();

    if (!suites.some((s) => s.key === activeSuiteKey) && suites.length) {
      activeSuiteKey = suites[0].key;
    }

    const filtered = tasks.filter((t) => t.suite === activeSuiteKey);
    const doneInSuite = filtered.filter((t) => progress[t.id]?.completed).length;
    const suiteLabel = CLEAN_SUITE_LABELS[activeSuiteKey] || activeSuiteKey;

    const titleEl = document.querySelector('#screen-tasks-hub .tot-shell-title');
    const subEl = document.getElementById('inline-task-sub');
    if (titleEl) titleEl.textContent = 'Task bài tập · Listening';
    if (subEl) subEl.textContent = `${doneInSuite} / ${filtered.length} hoàn thành · ${suiteLabel}`;

    if (tabsEl) {
      tabsEl.innerHTML = suites.map((s) => {
        const cleanLbl = CLEAN_SUITE_LABELS[s.key] || String(s.label || '').replace(/\s*\(\d+\)\s*$/g, '');
        return `<button type="button" class="tot-seg-btn ${activeSuiteKey === s.key ? 'active' : ''}" onclick="ListeningTasksModule.switchSuite('${esc(s.key)}')">${esc(cleanLbl)}</button>`;
      }).join('');
    }

    if (!gridEl) return;
    gridEl.classList.remove('is-listening-grid');

    gridEl.innerHTML = filtered.map((t, idx) => {
      const rec = progress[t.id] || null;
      const done = Boolean(rec?.completed);
      const numStr = String(t.num || (idx + 1)).padStart(2, '0');
      const shortName = shortTopicTitle(t);
      const totalW = (t.wordIds || []).length;
      const rightTag = done
        ? `<span class="tot-task-score tabular">${rec.t3Total ? `${rec.t3Score}/${rec.t3Total}` : `${rec.t1Score || 0}/${rec.t1Total || totalW}`}</span>`
        : (t.isMapTask
          ? '<span class="lt-inline-pill is-map">Map</span>'
          : (t.hasFullTests ? '<span class="lt-inline-pill">3 Test</span>' : ''));

      return `
        <button type="button" class="tot-task-card ${done ? 'is-done' : ''}" onclick="ListeningTasksModule.openTaskBrief('${esc(t.id)}')">
          <span class="tot-task-num ${t.isMapTask ? 'is-map-num' : ''}">${esc(numStr)}</span>
          <div style="min-width:0;flex:1;">
            <div style="font-size:13px;font-weight:750;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.label)}</div>
            <div style="font-size:12px;color:var(--ink-2);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(shortName)} · ${totalW} từ</div>
          </div>
          ${rightTag}
        </button>
      `;
    }).join('');
  }

  /* ---------------------------------------------------------
     CLEAN TASK BRIEF & SUMMARY MODALS (Matches Reading's modal-task-brief)
     --------------------------------------------------------- */
  function ensureBriefModal() {
    let el = document.getElementById('modal-listening-brief');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal-overlay';
    el.id = 'modal-listening-brief';
    el.onclick = (e) => { if (e.target === el) closeTaskBrief(); };
    el.innerHTML = `
      <div class="modal-card" style="max-width:560px;" onclick="event.stopPropagation()">
        <div class="modal-header">
          <div style="display:flex;align-items:center;gap:9px;min-width:0;flex:1;">
            <span class="tip-pill lt-nowrap-pill" id="lt-brief-pill" style="margin:0;">LISTENING</span>
            <span id="lt-brief-title" style="font-weight:750;font-size:14.5px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
          </div>
          <button type="button" class="btn-icon-glass" style="width:30px;height:30px;" onclick="ListeningTasksModule.closeTaskBrief()">✕</button>
        </div>
        <div class="modal-body" id="lt-brief-body" style="padding:18px 22px 22px;"></div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function closeTaskBrief() {
    document.getElementById('modal-listening-brief')?.classList.remove('open');
  }

  function isTeacherMode() {
    try {
      return Boolean(window.__VOCAB_BRIDGE__?.isTeacherUser?.());
    } catch (_) {
      return false;
    }
  }

  function openTaskBrief(taskId) {
    const task = (getTasksData().tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const modal = ensureBriefModal();
    const totalW = (task.wordIds || []).length;
    const mastered = getMasteredCount(task);
    const allReady = totalW > 0 && mastered >= totalW;
    const rec = loadProgress()[task.id] || null;
    const hasFull3 = Boolean(task.hasFullTests);
    const teacher = isTeacherMode();
    const dlInfo = window.TeacherStudio?.getTaskDeadlineInfo?.(task.id) || { hasDeadline: false };
    const isExpired = !teacher && dlInfo.hasDeadline && dlInfo.expired;
    const isCompleted = Boolean(rec?.completed);

    const pillEl = document.getElementById('lt-brief-pill');
    const titleEl = document.getElementById('lt-brief-title');
    const bodyEl = document.getElementById('lt-brief-body');
    if (pillEl) pillEl.textContent = task.label;
    if (titleEl) titleEl.textContent = shortTopicTitle(task);
    if (bodyEl) {
      const testDesc = hasFull3
        ? (task.isMapTask
          ? '<strong>Test 1</strong> Dictation → <strong>Test 2</strong> Short Conversations → <strong>Test 3</strong> Map Labelling.'
          : '<strong>Test 1</strong> Dictation → <strong>Test 2</strong> Short Conversations → <strong>Test 3</strong> Note Completion.')
        : `<strong>Test 1</strong> Dictation · ${totalW} từ.`;

      const deadlineLine = dlInfo.hasDeadline
        ? `<div style="margin-top:6px;font-weight:700;color:${dlInfo.expired ? '#dc2626' : 'var(--accent)'};">${
            dlInfo.expired
              ? `Đã hết hạn lúc ${esc(dlInfo.formattedAt)}${isCompleted ? ' (Bạn đã hoàn thành Task này).' : ' — không thể vào làm mới.'}`
              : `⏱ Thời hạn: còn ${esc(dlInfo.remainingText)} (đóng lúc ${esc(dlInfo.formattedAt)})`
          }</div>`
        : '';

      const scoreRow = rec
        ? `<div class="lt-score-strip" style="margin-bottom:14px;">
             ${rec.t1Total ? `<span class="lt-score-chip">Test 1: ${rec.t1Score}/${rec.t1Total}</span>` : ''}
             ${rec.t2Total ? `<span class="lt-score-chip">Test 2: ${rec.t2Score}/${rec.t2Total}</span>` : ''}
             ${rec.t3Total ? `<span class="lt-score-chip">Test 3: ${rec.t3Score}/${rec.t3Total}</span>` : ''}
           </div>`
        : '';

      const actionsHtml = teacher
        ? `
          <button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.startTaskSpeedQuiz('${esc(task.id)}')">Speed Quiz</button>
          <button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.studyTaskWords('${esc(task.id)}')">Flashcard</button>
          ${hasFull3 ? `<button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.openExam('${esc(task.id)}', 2)">Test 2</button>` : ''}
          ${hasFull3 ? `<button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.openExam('${esc(task.id)}', 3)">Test 3</button>` : ''}
          <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.openExam('${esc(task.id)}', 1)">${hasFull3 ? 'Bắt đầu Test →' : 'Làm Test 1 →'}</button>
        `
        : (isExpired
          ? `<button type="button" class="btn btn-primary" disabled>Task đã kết thúc</button>`
          : (allReady
            ? `
              <button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.startTaskSpeedQuiz('${esc(task.id)}')">Speed Quiz</button>
              <button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.studyTaskWords('${esc(task.id)}')">Flashcard</button>
              <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.openExam('${esc(task.id)}', 1)">${hasFull3 ? 'Bắt đầu Test →' : 'Làm Test 1 →'}</button>
            `
            : `
              <button type="button" class="btn-subtle" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.startTaskSpeedQuiz('${esc(task.id)}')">Speed Quiz</button>
              <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.studyTaskWords('${esc(task.id)}')">Học từ vựng →</button>
            `));

      bodyEl.innerHTML = `
        <div class="task-notice-box" style="margin-bottom:14px;font-size:14px;line-height:1.6;">
          <div><strong>Bước 1 · Học từ vựng:</strong> Đã thuộc <strong>${mastered}/${totalW}</strong> từ. Thuộc đủ <strong>${totalW}/${totalW}</strong> trên Flashcard hoặc Speed Quiz để mở Test.</div>
          <div style="margin-top:6px;"><strong>Bước 2 · Làm Test:</strong> ${testDesc}</div>
          ${deadlineLine}
        </div>
        ${scoreRow}
        <div style="display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;">
          ${actionsHtml}
        </div>
      `;
    }
    modal.classList.add('open');
  }

  function openSummaryModal() {
    const tasks = getTasksData().tasks || [];
    const progress = loadProgress();
    const doneList = tasks.filter((t) => progress[t.id]?.completed);
    const modal = ensureBriefModal();
    const pillEl = document.getElementById('lt-brief-pill');
    const titleEl = document.getElementById('lt-brief-title');
    const bodyEl = document.getElementById('lt-brief-body');
    if (pillEl) pillEl.textContent = 'THỐNG KÊ LISTENING';
    if (titleEl) titleEl.textContent = `${doneList.length} / ${tasks.length} Task đã hoàn thành`;
    if (bodyEl) {
      bodyEl.innerHTML = doneList.length
        ? `<div class="lt-review-table-wrap"><table class="lt-review-table">
            <thead><tr><th>Task</th><th>Test 1</th><th>Test 2</th><th>Test 3</th></tr></thead>
            <tbody>
              ${doneList.map((t) => {
                const r = progress[t.id];
                return `<tr>
                  <td><strong>${esc(t.label)}</strong></td>
                  <td>${r.t1Total ? `${r.t1Score}/${r.t1Total}` : '—'}</td>
                  <td>${r.t2Total ? `${r.t2Score}/${r.t2Total}` : '—'}</td>
                  <td>${r.t3Total ? `${r.t3Score}/${r.t3Total}` : '—'}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>`
        : `<div class="task-notice-box" style="margin-bottom:14px;">Bạn chưa hoàn thành Task Listening nào. Hãy chọn một Task để bắt đầu luyện nghe!</div>
           <div style="display:flex;justify-content:flex-end;"><button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeTaskBrief()">Đóng</button></div>`;
    }
    modal.classList.add('open');
  }

  function formatListeningPos(posRaw) {
    const p = String(posRaw || '').trim().toLowerCase();
    if (p === 'n' || p === 'noun') return 'Danh từ';
    if (p === 'v' || p === 'verb') return 'Động từ';
    if (p === 'a' || p === 'adj' || p === 'adjective') return 'Tính từ';
    if (p === 'r' || p === 'adv' || p === 'adverb') return 'Trạng từ';
    if (p === 'cue') return 'Tín hiệu';
    return posRaw || 'Từ vựng';
  }

  function cleanModalTitle(t) {
    return `${t.label} · ${shortTopicTitle(t)}`;
  }

  function openPracticePicker(kind) {
    const tasks = getTasksData().tasks || [];
    const progress = loadProgress();
    const list = kind === 'map'
      ? tasks.filter((t) => t.isMapTask)
      : tasks.filter((t) => t.hasFullTests && !t.isMapTask);
    const modal = ensureBriefModal();
    const pillEl = document.getElementById('lt-brief-pill');
    const titleEl = document.getElementById('lt-brief-title');
    const bodyEl = document.getElementById('lt-brief-body');
    if (pillEl) pillEl.textContent = kind === 'map' ? 'MAP LABELLING' : 'NOTE COMPLETION';
    if (titleEl) titleEl.textContent = kind === 'map' ? 'Chọn bài Bản đồ Map Labelling' : 'Chọn bài Note Completion (Part 1–4)';
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="lt-picker-list">
          ${list.map((t) => {
            const r = progress[t.id];
            const scoreTxt = r?.t3Total ? `Điểm: ${r.t3Score}/${r.t3Total}` : 'Audio Neural';
            return `
              <button type="button" class="lt-prac-row" onclick="ListeningTasksModule.closeTaskBrief(); ListeningTasksModule.openExam('${esc(t.id)}', 3, { fromPractice: true })">
                <span><strong>${esc(t.label)}</strong> · ${esc(shortTopicTitle(t))}</span>
                <span class="lt-prac-go">${esc(scoreTxt)} →</span>
              </button>`;
          }).join('')}
        </div>
      `;
    }
    modal.classList.add('open');
  }

  /* ---------------------------------------------------------
     DEDICATED LISTENING PRACTICE SCREEN (#lp-app-root)
     Delegates to ListeningPracticeApp (3x3 Totoro-Shaped Bookshelf)
     --------------------------------------------------------- */
  function renderPracticeScreen() {
    if (window.ListeningPracticeApp && typeof window.ListeningPracticeApp.render === 'function') {
      window.ListeningPracticeApp.render();
      return;
    }
    const root = document.getElementById('lp-app-root');
    if (!root) return;
    root.innerHTML = `<div class="tot-section-shell"><p class="tot-shell-sub">Đang nạp kho đề Listening Practice…</p></div>`;
  }

  /* ---------------------------------------------------------
     MODAL SHELL FOR LISTENING 3-TEST EXAM
     --------------------------------------------------------- */
  function ensureExamModal() {
    let el = document.getElementById('modal-listening-exam');
    if (el) return el;
    el = document.createElement('div');
    el.className = 'modal-overlay task-exam-overlay';
    el.id = 'modal-listening-exam';
    el.setAttribute('aria-label', 'Bài Test IELTS Listening');
    el.innerHTML = `
      <div class="modal-card lt-exam-card" onclick="event.stopPropagation()">
        <div class="modal-header lt-exam-header">
          <div class="lt-exam-hdr-left">
            <span class="tip-pill lt-nowrap-pill" id="lt-exam-stage-pill" style="margin:0;">TEST 1 · NGHE &amp; VIẾT</span>
            <div class="modal-title lt-exam-title" id="lt-exam-title">Listening Task</div>
          </div>
          <div class="lt-exam-hdr-right">
            <div class="lt-stepper" id="lt-exam-stepper" aria-label="Tiến trình bài thi"></div>
            <button type="button" class="btn-icon-glass" style="width:32px; height:32px; flex-shrink:0;" onclick="ListeningTasksModule.closeExam()" aria-label="Đóng bài thi" title="Đóng">✕</button>
          </div>
        </div>
        <div class="modal-body lt-exam-body" id="lt-exam-body"></div>
      </div>
    `;
    document.body.appendChild(el);
    return el;
  }

  function closeExam() {
    stopAllAudio();
    document.getElementById('modal-listening-exam')?.classList.remove('open');
    examState = null;
    window.TotoroUI?.renderInlineTaskHub?.();
  }

  function openExam(taskId, startStage = 1, opts = {}) {
    const task = (getTasksData().tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const words = resolveTaskWords(task);
    if (!words.length) {
      window.__VOCAB_BRIDGE__?.showToast?.('Chưa nạp được danh sách từ của Task này.');
      return;
    }

    // Reading-parity mastery & deadline gate: students must respect deadline and master 100% task words first
    if (!isTeacherMode() && !opts?.fromPractice) {
      const dlInfo = window.TeacherStudio?.getTaskDeadlineInfo?.(task.id);
      if (dlInfo?.hasDeadline && dlInfo.expired) {
        window.__VOCAB_BRIDGE__?.showToast?.(`Task ${task.label} đã hết hạn lúc ${dlInfo.formattedAt}!`);
        openTaskBrief(task.id);
        return;
      }
      const totalW = (task.wordIds || []).length;
      const mastered = getMasteredCount(task);
      if (totalW > 0 && mastered < totalW) {
        window.__VOCAB_BRIDGE__?.showToast?.(`Hãy học và thuộc đủ ${totalW}/${totalW} từ của ${task.label} trước khi làm Test (hiện ${mastered}/${totalW}).`);
        openTaskBrief(task.id);
        return;
      }
    }

    stopAllAudio();
    const shuffled = words.slice().sort(() => Math.random() - 0.5);
    const validStage = [1, 2, 3].includes(Number(startStage)) ? Number(startStage) : 1;
    examState = {
      task,
      words: shuffled,
      stage: validStage, // 1 | 2 | 3
      // Test 1 state (100% of Task words!)
      t1Idx: 0,
      t1Results: [],
      t1Done: false,
      t1Playing: false,
      // Test 2 state (12 Short Conversations MCQ)
      t2Idx: 0,
      t2Answers: {},
      t2Done: false,
      t2Phase: 'preread', // 'preread' | 'playing' | 'answer'
      // Test 3 state (Note Completion OR Map Labelling + 2-Column Compare)
      t3Phase: 'preread', // 'preread' | 'playing' | 'submitted'
      t3Inputs: {},
      t3MapActiveQ: 1,
      t3Score: 0,
      t3Details: [],
    };

    const modal = ensureExamModal();
    modal.classList.add('open');
    renderExamStage();
  }

  function saveTaskStageScore(completedAll = false) {
    if (!examState) return;
    const map = loadProgress();
    const tid = examState.task.id;
    const prev = map[tid] || {};
    const t1Score = examState.t1Results.filter((r) => r.correct).length;
    const t1Total = examState.words.length;
    const t2Convs = examState.task.test2Conversations || [];
    const t2Score = t2Convs.reduce((acc, c, i) => acc + (examState.t2Answers[i] === c.answerIndex ? 1 : 0), 0);
    const t2Total = t2Convs.length;
    const t3Items = examState.task.test3MapLabelling?.questions || examState.task.test3NoteCompletion?.blanks || [];

    map[tid] = {
      ...prev,
      t1Score: examState.t1Done ? t1Score : prev.t1Score,
      t1Total: examState.t1Done ? t1Total : prev.t1Total,
      t2Score: examState.t2Done ? t2Score : prev.t2Score,
      t2Total: examState.t2Done ? t2Total : prev.t2Total,
      t3Score: examState.t3Phase === 'submitted' ? examState.t3Score : prev.t3Score,
      t3Total: examState.t3Phase === 'submitted' ? t3Items.length : prev.t3Total,
      completed: Boolean(prev.completed || completedAll),
      updatedAt: Date.now(),
    };
    saveProgress(map);
  }

  function renderExamStage() {
    if (!examState) return;
    const pill = document.getElementById('lt-exam-stage-pill');
    const title = document.getElementById('lt-exam-title');
    const stepper = document.getElementById('lt-exam-stepper');
    if (title) title.textContent = cleanModalTitle(examState.task);

    if (stepper) {
      const has3 = Boolean(examState.task.hasFullTests);
      if (has3) {
        const s3Lbl = examState.task.test3MapLabelling ? '3. Map' : '3. Note';
        const canSwitch = isTeacherMode();
        stepper.innerHTML = [
          { n: 1, lbl: '1. Viết' },
          { n: 2, lbl: '2. Hội thoại' },
          { n: 3, lbl: s3Lbl },
        ].map((st) => {
          const cls = `lt-step-dot ${examState.stage === st.n ? 'is-active' : (examState.stage > st.n ? 'is-done' : '')}${canSwitch ? ' is-clickable' : ''}`;
          if (canSwitch) {
            return `<button type="button" class="${cls}" onclick="ListeningTasksModule.goToStage(${st.n})" title="Giáo viên: chuyển nhanh sang Test ${st.n}">${st.lbl}</button>`;
          }
          return `<span class="${cls}">${st.lbl}</span>`;
        }).join('');
        stepper.style.display = 'inline-flex';
      } else {
        stepper.style.display = 'none';
      }
    }

    if (examState.stage === 1) {
      if (pill) pill.textContent = 'TEST 1 · DICTATION';
      renderTest1();
    } else if (examState.stage === 2) {
      if (pill) pill.textContent = 'TEST 2 · SHORT CONVERSATIONS';
      renderTest2();
    } else {
      if (pill) {
        pill.textContent = examState.task.test3MapLabelling
          ? 'TEST 3 · MAP LABELLING'
          : 'TEST 3 · NOTE COMPLETION';
      }
      renderTest3();
    }
  }

  function syncExamCardWidth(mode) {
    const card = document.querySelector('#modal-listening-exam .lt-exam-card');
    if (!card) return;
    card.classList.toggle('is-compact-stage', mode === 'compact');
    card.classList.toggle('is-review-stage', mode === 'review');
  }

  function trimShortMeaning(raw) {
    const clean = String(raw || '').trim();
    if (!clean) return '—';
    if (clean.length <= 54) return clean;
    const bySemi = clean.split(';')[0].trim();
    if (bySemi.length >= 8 && bySemi.length <= 56) return bySemi;
    return clean.slice(0, 52).replace(/\s+\S*$/, '') + '…';
  }

  function buildT1MeaningChoices(targetItem, taskWords) {
    const correctText = trimShortMeaning(targetItem.clean_meaning || targetItem.meaning || '');
    const seen = new Set([correctText.toLowerCase()]);
    const lv = window.APP_LISTENING_VOCAB || {};
    const pool = [...(taskWords || []), ...(lv.target_all || []).slice(0, 120)];
    const distractors = [];
    // Shuffle candidate indices deterministically-randomly
    const cands = pool
      .filter((w) => w && w.id !== targetItem.id && (w.clean_meaning || w.meaning))
      .sort(() => Math.random() - 0.5);
    for (const w of cands) {
      const m = trimShortMeaning(w.clean_meaning || w.meaning || '');
      const k = m.toLowerCase();
      if (!m || m === '—' || seen.has(k)) continue;
      seen.add(k);
      distractors.push({ text: m, isCorrect: false });
      if (distractors.length >= 3) break;
    }
    const choices = [{ text: correctText, isCorrect: true }, ...distractors];
    return choices.sort(() => Math.random() - 0.5);
  }

  function pickT1Meaning(optIdx) {
    if (!examState || examState.stage !== 1 || examState.t1Done) return;
    examState.t1PickedMeaning = Number(optIdx);
    document.querySelectorAll('#lt-t1-meaning-grid .lt-t1-mopt').forEach((btn, i) => {
      btn.classList.toggle('is-selected', i === Number(optIdx));
    });
  }

  /* ---------------------------------------------------------
     TEST 1: 100% TASK WORDS ONE-SHOT DICTATION + MEANING (NO REPLAY!)
     --------------------------------------------------------- */
  function renderTest1() {
    const body = document.getElementById('lt-exam-body');
    if (!body || !examState) return;
    stopAllAudio();

    if (examState.t1Done) {
      syncExamCardWidth('review');
      const score = examState.t1Results.filter((r) => r.correct).length;
      const total = examState.words.length;
      const pct = Math.round((score / Math.max(1, total)) * 100);
      const hasT2 = Boolean(examState.task.test2Conversations?.length);

      body.innerHTML = `
        <div class="lt-summary-card">
          <div class="lt-sum-top">
            <div>
              <div class="lt-sum-kicker">HOÀN THÀNH TEST 1 — ĐÃ CHẤM &amp; LƯU ĐIỂM</div>
              <div class="lt-sum-score tabular">${score} / ${total} từ đạt chuẩn (${pct}%)</div>
            </div>
            <div class="lt-sum-actions">
              ${hasT2
                ? `<button type="button" class="btn btn-primary" onclick="ListeningTasksModule.goToStage(2)">Sang Test 2 →</button>`
                : `<button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeExam()">Hoàn tất &amp; Quay lại</button>`}
            </div>
          </div>
          <div class="lt-review-table-wrap">
            <table class="lt-review-table">
              <thead><tr><th>#</th><th>Từ chuẩn</th><th>Nghĩa</th><th>Bạn viết</th><th>Kết quả</th><th>Nghe</th></tr></thead>
              <tbody>
                ${examState.t1Results.map((r, i) => `
                  <tr class="${r.correct ? 'is-ok' : 'is-err'}">
                    <td>${i + 1}</td>
                    <td><strong>${esc(r.expected)}</strong> <small style="color:var(--ink-2);">${esc(r.ipa || '')}</small></td>
                    <td>${esc(r.meaning || '')}</td>
                    <td>${esc(r.typed || '—')}</td>
                    <td>${r.correct ? '<span class="lt-tag-ok">✓ Đúng</span>' : `<span class="lt-tag-err">✗ ${esc(r.note)}</span>`}</td>
                    <td><button type="button" class="lt-mini-play" onclick="ListeningTasksModule.replayAfterSubmit('${esc(r.expected)}','en-GB')">🔊</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      return;
    }

    syncExamCardWidth('compact');
    const idx = examState.t1Idx;
    const total = examState.words.length;
    const item = examState.words[idx];
    const pct = Math.round((idx / Math.max(1, total)) * 100);
    const letters = ['A', 'B', 'C', 'D'];
    const choices = buildT1MeaningChoices(item, examState.words);
    examState.t1Choices = choices;
    examState.t1PickedMeaning = null;

    body.innerHTML = `
      <div class="lt-t1-stage">
        <div class="lt-progress-row">
          <span class="tabular"><strong>Câu ${idx + 1} / ${total}</strong></span>
          <div class="lt-row-right">
            <div class="lt-oneshot-strip is-playing" id="lt-t1-audio-strip">
              <span class="lt-wave-dots" aria-hidden="true"><span></span><span></span><span></span></span>
              <span id="lt-t1-audio-text">Đang phát…</span>
            </div>
            <span class="lt-timer-pill tabular" id="lt-t1-timer">15s</span>
          </div>
        </div>
        <div class="lt-prog-track"><div class="lt-prog-fill" style="width:${pct}%"></div></div>

        <div class="lt-t1-hero is-playing" id="lt-t1-hero">
          <div class="lt-t1-wave-visual" aria-hidden="true">
            <span style="--h:10px;--d:0.05s"></span>
            <span style="--h:18px;--d:0.18s"></span>
            <span style="--h:26px;--d:0.30s"></span>
            <span style="--h:14px;--d:0.12s"></span>
            <span style="--h:22px;--d:0.24s"></span>
            <div class="lt-t1-orb-ind">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>
            </div>
            <span style="--h:22px;--d:0.24s"></span>
            <span style="--h:14px;--d:0.12s"></span>
            <span style="--h:26px;--d:0.30s"></span>
            <span style="--h:18px;--d:0.18s"></span>
            <span style="--h:10px;--d:0.05s"></span>
          </div>
          <span class="rl-cue-pos">${esc(formatListeningPos(item.pos))}</span>
        </div>

        <form class="lt-t1-form" onsubmit="ListeningTasksModule.submitT1Word(event)">
          <div class="lt-t1-block">
            <label class="lt-t1-lbl" for="lt-t1-input">1. Gõ chính tả</label>
            <input type="text" class="recall-word-input lt-t1-input" id="lt-t1-input" placeholder="Nhập từ vừa nghe..." autocomplete="off" autocapitalize="none" spellcheck="false" />
          </div>

          <div class="lt-t1-block">
            <div class="lt-t1-lbl">2. Chọn nghĩa Tiếng Việt</div>
            <div class="lt-t1-meaning-grid" id="lt-t1-meaning-grid">
              ${choices.map((ch, ci) => `
                <button type="button" class="lt-t1-mopt" onclick="ListeningTasksModule.pickT1Meaning(${ci})">
                  <span class="lt-mcq-key">${letters[ci]}</span>
                  <span class="lt-t1-mopt-txt">${esc(ch.text)}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <div class="lt-t1-footer is-end">
            <button type="submit" class="btn btn-primary">Tiếp theo →</button>
          </div>
        </form>
      </div>
    `;

    const inp = document.getElementById('lt-t1-input');
    setTimeout(() => inp?.focus(), 40);

    // Play word ONCE (no replay button!), rotating across authentic IELTS accents (UK / AU / US / NZ / CA)
    const ieltsAccentCycle = ['en-GB', 'en-AU', 'en-US', 'en-GB', 'en-AU', 'en-NZ', 'en-GB', 'en-CA'];
    const accent = ieltsAccentCycle[idx % ieltsAccentCycle.length];
    speakSingleWordOneShot(item.lemma, accent, () => {
      if (!examState || examState.stage !== 1 || examState.t1Idx !== idx) return;
      const strip = document.getElementById('lt-t1-audio-strip');
      const hero = document.getElementById('lt-t1-hero');
      const txt = document.getElementById('lt-t1-audio-text');
      if (strip) {
        strip.classList.remove('is-playing');
        strip.classList.add('is-done');
      }
      if (hero) hero.classList.remove('is-playing');
      if (txt) txt.innerHTML = `${DIRECTOR_SVG.check}<span>Đã phát xong</span>`;
      t1DeadlineAt = Date.now() + 15000;
      t1CountdownTimer = setInterval(() => {
        const rem = Math.max(0, Math.ceil((t1DeadlineAt - Date.now()) / 1000));
        const el = document.getElementById('lt-t1-timer');
        if (el) {
          el.textContent = `${rem}s`;
          el.classList.toggle('is-urgent', rem <= 4);
        }
        if (rem <= 0) {
          submitT1Word(null, true);
        }
      }, 200);
    });
  }

  function submitT1Word(event, isTimeout = false) {
    if (event) event.preventDefault();
    if (!examState || examState.stage !== 1 || examState.t1Done) return;
    stopAllAudio();

    const item = examState.words[examState.t1Idx];
    const inp = document.getElementById('lt-t1-input');
    const typed = String(inp?.value || '').trim();
    const diag = diagnoseSpellingError(typed, item.lemma, item.clean_forms ? [] : []);
    const pickedIdx = examState.t1PickedMeaning;
    const choices = examState.t1Choices || [];
    const meaningOk = pickedIdx != null && Boolean(choices[pickedIdx]?.isCorrect);
    const fullOk = Boolean(diag.correct && meaningOk);

    let note = '';
    if (!fullOk) {
      if (isTimeout && !typed && pickedIdx == null) note = 'Hết 15 giây';
      else if (diag.correct && !meaningOk) note = pickedIdx == null ? 'Chưa chọn nghĩa' : 'Sai nghĩa';
      else if (!diag.correct && meaningOk) note = diag.note;
      else note = `${diag.note} + Sai nghĩa`;
    }

    examState.t1Results.push({
      expected: item.lemma,
      ipa: item.ipa || '',
      meaning: trimShortMeaning(item.clean_meaning || item.meaning || ''),
      typed,
      spellOk: diag.correct,
      meaningOk,
      correct: fullOk,
      note,
    });

    if (examState.t1Idx + 1 >= examState.words.length) {
      examState.t1Done = true;
      const hasT2 = Boolean(examState.task.test2Conversations?.length);
      saveTaskStageScore(!hasT2);
    } else {
      examState.t1Idx += 1;
    }
    renderTest1();
  }

  /* ---------------------------------------------------------
     TEST 2: 12 SHORT CONVERSATIONS MCQ (ROUNDABOUT + PARAPHRASE)
     --------------------------------------------------------- */
  function renderTest2() {
    const body = document.getElementById('lt-exam-body');
    if (!body || !examState) return;
    stopAllAudio();

    const convs = examState.task.test2Conversations || [];
    if (!convs.length) {
      goToStage(3);
      return;
    }

    if (examState.t2Done) {
      syncExamCardWidth('review');
      const score = convs.reduce((acc, c, i) => acc + (examState.t2Answers[i] === c.answerIndex ? 1 : 0), 0);
      const pct = Math.round((score / Math.max(1, convs.length)) * 100);
      const hasT3 = Boolean(examState.task.test3MapLabelling || examState.task.test3NoteCompletion);
      const t3BtnLabel = 'Sang Test 3 →';

      body.innerHTML = `
        <div class="lt-summary-card">
          <div class="lt-sum-top">
            <div>
              <div class="lt-sum-kicker">HOÀN THÀNH TEST 2 — ĐÃ CHẤM &amp; LƯU ĐIỂM</div>
              <div class="lt-sum-score tabular">${score} / ${convs.length} câu đúng (${pct}%)</div>
            </div>
            <div class="lt-sum-actions">
              ${hasT3
                ? `<button type="button" class="btn btn-primary" onclick="ListeningTasksModule.goToStage(3)">${t3BtnLabel}</button>`
                : `<button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeExam()">Hoàn tất &amp; Quay lại</button>`}
            </div>
          </div>
          <div class="lt-t2-review-list">
            ${convs.map((c, i) => {
              const picked = examState.t2Answers[i];
              const ok = picked === c.answerIndex;
              const letters = ['A', 'B', 'C'];
              return `
                <div class="lt-t2-rev-item ${ok ? 'is-ok' : 'is-err'}">
                  <div class="lt-t2-rev-head">
                    <strong>Câu ${i + 1} (${esc(c.level || 'Part 1')})</strong>
                    <span>${ok ? '✓ Đúng' : `✗ Chọn ${picked != null ? letters[picked] : '—'} · Đúng: ${letters[c.answerIndex]}`}</span>
                  </div>
                  <div class="lt-t2-rev-q">${esc(c.question)}</div>
                  <div class="lt-t2-rev-ans">Đáp án chuẩn: <strong>${letters[c.answerIndex]}. ${esc(c.options[c.answerIndex])}</strong></div>
                  <div class="lt-t2-rev-note">💡 ${esc(c.paraphraseNote || '')}</div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
      return;
    }

    syncExamCardWidth('compact');
    const idx = examState.t2Idx;
    const c = convs[idx];
    const letters = ['A', 'B', 'C'];
    const picked = examState.t2Answers[idx];

    body.innerHTML = `
      <div class="lt-t2-stage">
        <div class="lt-progress-row">
          <span class="tabular"><strong>Hội thoại ${idx + 1} / ${convs.length}</strong></span>
          ${renderAudioPillHtml('lt-t2-director', 5)}
        </div>
        <div class="lt-prog-track"><div class="lt-prog-fill" style="width:${Math.round((idx / convs.length) * 100)}%"></div></div>

        <div class="lt-t2-question">${esc(c.question)}</div>
        <div class="lt-t2-options" id="lt-t2-options">
          ${(c.options || []).map((opt, oi) => `
            <button type="button" class="lt-mcq-opt ${picked === oi ? 'is-selected' : ''}" onclick="ListeningTasksModule.pickT2Option(${oi})">
              <span class="lt-mcq-key">${letters[oi]}</span>
              <span class="lt-mcq-txt">${esc(opt)}</span>
            </button>
          `).join('')}
        </div>

        <div class="lt-t2-footer is-end">
          <button type="button" class="btn btn-primary" id="btn-lt-t2-next" onclick="ListeningTasksModule.nextT2Question()" ${picked == null ? 'disabled' : ''}>
            ${idx + 1 === convs.length ? 'Nộp Test 2 →' : 'Tiếp theo →'}
          </button>
        </div>
      </div>
    `;

    // 5s prep countdown -> Auto-play Pass 1 -> 5s rest -> Auto-play Pass 2 (ZERO manual controls!)
    runTwoPassAudioSequence({
      directorId: 'lt-t2-director',
      prepSeconds: 5,
      gapSeconds: 5,
      prepTitle: 'Chuẩn bị đọc câu hỏi',
      doneActionText: 'Chọn đáp án',
      audioFile: c.audioFile,
      turns: c.turns || [],
      timestamps: c.turnTimestamps || [],
      gapMs: 240,
      defaultSpeaker: 'Speaker',
      isStillActive: () => Boolean(examState && examState.stage === 2 && !examState.t2Done && examState.t2Idx === idx),
    });
  }

  function pickT2Option(optIdx) {
    if (!examState || examState.stage !== 2 || examState.t2Done) return;
    examState.t2Answers[examState.t2Idx] = optIdx;
    document.querySelectorAll('#lt-t2-options .lt-mcq-opt').forEach((btn, i) => {
      btn.classList.toggle('is-selected', i === optIdx);
    });
    const nextBtn = document.getElementById('btn-lt-t2-next');
    if (nextBtn) nextBtn.disabled = false;
  }

  function nextT2Question() {
    if (!examState || examState.stage !== 2 || examState.t2Done) return;
    stopAllAudio();
    const convs = examState.task.test2Conversations || [];
    if (examState.t2Idx + 1 >= convs.length) {
      examState.t2Done = true;
      const hasT3 = Boolean(examState.task.test3MapLabelling || examState.task.test3NoteCompletion);
      saveTaskStageScore(!hasT3);
    } else {
      examState.t2Idx += 1;
    }
    renderTest2();
  }

  /* ---------------------------------------------------------
     TEST 3: REAL NOTE COMPLETION + 2-COLUMN COMPARE
     (LEFT = 3-Color Transcript + Replay | RIGHT = Marked Note Sheet)
     --------------------------------------------------------- */
  function highlightTranscriptSegment(seg) {
    let html = esc(seg.text || '');
    const hls = Array.isArray(seg.highlights) ? seg.highlights : [];
    // Sort longer phrases first to avoid nested partial replacements
    const sorted = hls.slice().sort((a, b) => String(b.phrase || '').length - String(a.phrase || '').length);
    for (const h of sorted) {
      const ph = String(h.phrase || '').trim();
      if (!ph) continue;
      const safePh = esc(ph).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cls = h.type === 'signpost' ? 'lt-hl-signpost' : (h.type === 'trap' ? 'lt-hl-trap' : 'lt-hl-key');
      const badge = h.qNum ? `<sup class="lt-hl-qnum">${h.qNum}</sup>` : '';
      html = html.replace(new RegExp(`(${safePh})`, 'i'), `<mark class="${cls}">$1${badge}</mark>`);
    }
    return html;
  }

  function renderNoteSheetHtml(nc, isSubmitted) {
    const detailsByNum = {};
    (examState.t3Details || []).forEach((d) => { detailsByNum[d.num] = d; });

    return `
      <div class="lt-note-paper">
        <div class="lt-note-head">
          <div class="lt-note-title">${esc(nc.title || 'Notes')}</div>
          <div class="lt-note-limit">${esc(nc.wordLimit || 'ONE WORD AND/OR A NUMBER')}</div>
        </div>
        ${(nc.sections || []).map((sec) => `
          <div class="lt-note-sec">
            <div class="lt-note-sec-title">${esc(sec.heading || '')}</div>
            <ul class="lt-note-list">
              ${(sec.bullets || []).map((b) => {
                const rendered = esc(b).replace(/\[(\d+)\]/g, (_, numStr) => {
                  const n = parseInt(numStr, 10);
                  const val = examState.t3Inputs[n] || '';
                  if (!isSubmitted) {
                    return `<span class="lt-blank-wrap"><span class="lt-blank-num">${n}</span><input type="text" class="lt-blank-input" data-blank-num="${n}" value="${esc(val)}" placeholder="......" oninput="ListeningTasksModule.onT3Input(${n}, this.value)" autocomplete="off" spellcheck="false" /></span>`;
                  }
                  const det = detailsByNum[n] || { correct: false, expected: '', note: '' };
                  if (det.correct) {
                    return `<span class="lt-blank-res is-ok"><strong>(${n}) ✓ ${esc(val || det.expected)}</strong></span>`;
                  }
                  return `<span class="lt-blank-res is-err"><strong>(${n}) ✗ ${esc(val || 'trống')}</strong> → <span class="lt-blank-fix">${esc(det.expected)}</span> <small>(${esc(det.note)})</small></span>`;
                });
                return `<li>${rendered}</li>`;
              }).join('')}
            </ul>
          </div>
        `).join('')}
      </div>
    `;
  }

  /* ---------------------------------------------------------
     CAMBRIDGE IELTS INTERACTIVE SVG MAP LABELLING ENGINE
     --------------------------------------------------------- */
  function renderSvgMapHtml(ml, isSubmitted) {
    const spec = ml.mapSpec || {};
    const W = Number(spec.width || 680);
    const H = Number(spec.height || 440);
    const questions = ml.questions || [];

    // Map letter -> assigned question num (active) or official question detail (submitted)
    const assignedByLetter = {};
    questions.forEach((q) => {
      const picked = String(examState?.t3Inputs?.[q.num] || '').toUpperCase();
      if (picked) assignedByLetter[picked] = q.num;
    });
    const detailByLetter = {};
    if (isSubmitted) {
      (examState?.t3Details || []).forEach((d) => {
        detailByLetter[String(d.expected || '').toUpperCase()] = d;
      });
    }

    const zonesSvg = (spec.zones || []).map((z) => {
      const fill = esc(z.fill || '#f3f1e8');
      const stroke = esc(z.stroke || '#b7b19e');
      if (z.kind === 'ellipse') {
        const lbl = z.label ? `<text x="${z.cx}" y="${z.cy + 4}" text-anchor="middle" class="lt-map-zone-lbl">${esc(z.label)}</text>` : '';
        return `<ellipse cx="${z.cx}" cy="${z.cy}" rx="${z.rx}" ry="${z.ry}" fill="${fill}" stroke="${stroke}" stroke-width="1.6"/>${lbl}`;
      }
      const rx = z.rx != null ? z.rx : 8;
      const lbl = z.label
        ? `<text x="${Number(z.x) + Number(z.w) / 2}" y="${Number(z.y) + 18}" text-anchor="middle" class="lt-map-zone-lbl">${esc(z.label)}</text>`
        : '';
      return `<rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>${lbl}`;
    }).join('');

    const roadsSvg = (spec.roads || []).map((r) => {
      const stroke = esc(r.stroke || '#d5cbb5');
      const sw = Number(r.width || 16);
      if (r.kind === 'circle') {
        const lbl = r.label ? `<text x="${r.cx}" y="${Number(r.cy) + Number(r.r) + 15}" text-anchor="middle" class="lt-map-road-lbl">${esc(r.label)}</text>` : '';
        return `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r}" fill="${esc(r.fill || '#f8f5ec')}" stroke="${stroke}" stroke-width="${sw}"/>${lbl}`;
      }
      const lbl = r.label && r.lx != null && r.ly != null
        ? `<text x="${r.lx}" y="${r.ly}" text-anchor="middle" class="lt-map-road-lbl">${esc(r.label)}</text>`
        : '';
      return `<path d="${esc(r.d || '')}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="${esc(r.d || '')}" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="1.4" stroke-dasharray="6 6" stroke-linecap="round"/>${lbl}`;
    }).join('');

    const landmarksSvg = (spec.landmarks || []).map((lm) => {
      const isStart = Boolean(lm.isStart);
      const cls = isStart ? 'lt-map-lm is-start' : 'lt-map-lm';
      const cx = Number(lm.x) + Number(lm.w) / 2;
      const cy = Number(lm.y) + Number(lm.h) / 2 + 4;
      return `
        <g class="${cls}">
          <rect x="${lm.x}" y="${lm.y}" width="${lm.w}" height="${lm.h}" rx="6"/>
          <text x="${cx}" y="${cy}" text-anchor="middle">${isStart ? '● ' : ''}${esc(lm.label)}</text>
        </g>`;
    }).join('');

    const c = spec.compass || { x: W - 52, y: 52 };
    const compassSvg = `
      <g class="lt-map-compass" transform="translate(${c.x}, ${c.y})">
        <circle cx="0" cy="0" r="24"/>
        <path d="M0 -18 L5 -2 L0 -6 L-5 -2 Z" fill="#2f6b32"/>
        <path d="M0 18 L4 3 L0 6 L-4 3 Z" fill="#9ca3af"/>
        <line x1="-15" y1="0" x2="15" y2="0" stroke="#9ca3af" stroke-width="1.2"/>
        <text x="0" y="-27" text-anchor="middle" class="lt-comp-n">N</text>
        <text x="0" y="34" text-anchor="middle" class="lt-comp-s">S</text>
        <text x="-31" y="4" text-anchor="middle" class="lt-comp-s">W</text>
        <text x="31" y="4" text-anchor="middle" class="lt-comp-s">E</text>
      </g>`;

    const pinsSvg = (spec.pins || []).map((p) => {
      const ltr = String(p.letter || '').toUpperCase();
      let stateCls = '';
      let subTag = '';
      if (isSubmitted) {
        const det = detailByLetter[ltr];
        if (det) {
          stateCls = det.correct ? 'is-ok' : 'is-err';
          subTag = `<g transform="translate(${p.x}, ${Number(p.y) + 27})">
            <rect x="-22" y="-9" width="44" height="17" rx="8" class="lt-pin-tag-bg ${stateCls}"/>
            <text x="0" y="3" text-anchor="middle" class="lt-pin-tag-txt">${det.correct ? '✓' : '★'} #${det.num}</text>
          </g>`;
        }
      } else if (assignedByLetter[ltr]) {
        stateCls = 'is-picked';
        subTag = `<g transform="translate(${p.x}, ${Number(p.y) + 26})">
          <rect x="-15" y="-8" width="30" height="16" rx="8" class="lt-pin-tag-bg is-picked"/>
          <text x="0" y="3" text-anchor="middle" class="lt-pin-tag-txt">#${assignedByLetter[ltr]}</text>
        </g>`;
      }
      const clickAttr = !isSubmitted ? `onclick="ListeningTasksModule.assignMapPinClick('${ltr}')"` : '';
      return `
        <g class="lt-map-pin ${stateCls}" data-pin-letter="${ltr}" ${clickAttr}>
          <circle cx="${p.x}" cy="${p.y}" r="18"/>
          <text x="${p.x}" y="${Number(p.y) + 5}" text-anchor="middle">${ltr}</text>
          ${subTag}
        </g>`;
    }).join('');

    return `
      <div class="lt-map-frame">
        <div class="lt-map-head">
          <div class="lt-note-title">${esc(ml.title || 'Site Map')}</div>
          <div class="lt-note-limit">${esc(ml.instruction || 'Choose the correct letter, A–H')}</div>
        </div>
        <svg class="lt-map-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(ml.title || 'IELTS Listening Map')}">
          <rect x="0" y="0" width="${W}" height="${H}" rx="12" class="lt-map-bg"/>
          ${zonesSvg}
          ${roadsSvg}
          ${landmarksSvg}
          ${compassSvg}
          ${pinsSvg}
        </svg>
      </div>
    `;
  }

  function renderTest3Map() {
    const body = document.getElementById('lt-exam-body');
    const ml = examState?.task?.test3MapLabelling;
    if (!body || !ml) return;
    const questions = ml.questions || [];
    const letters = (ml.mapSpec?.pins || []).map((p) => String(p.letter || '').toUpperCase());

    if (examState.t3Phase === 'submitted') {
      const total = questions.length;
      const pct = Math.round((examState.t3Score / Math.max(1, total)) * 100);
      const t1Score = examState.t1Results.filter((r) => r.correct).length;
      const t1Tot = examState.words.length;
      const t2Convs = examState.task.test2Conversations || [];
      const t2Score = t2Convs.reduce((a, c, i) => a + (examState.t2Answers[i] === c.answerIndex ? 1 : 0), 0);
      const detailsByNum = {};
      (examState.t3Details || []).forEach((d) => { detailsByNum[d.num] = d; });

      // STRICT 2-COLUMN COMPARE RULE:
      // LEFT = Full Transcript (3-Color Signpost / Trap / Key + per-line Replay)
      // RIGHT = Marked Cambridge SVG Map + Question Results & Route Notes
      body.innerHTML = `
        <div class="lt-t3-compare-banner">
          <div>
            <div class="lt-sum-kicker">ĐÃ NỘP &amp; HOÀN THÀNH TASK MAP LABELLING</div>
            <div class="lt-sum-score tabular">
              Test 3 Map: ${examState.t3Score}/${total} (${pct}%)
              <span class="lt-sum-sub-chips">· T1: ${t1Score}/${t1Tot} · T2: ${t2Score}/${t2Convs.length}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeExam()">Hoàn tất &amp; Về danh sách Task</button>
        </div>

        <div class="lt-legend-row">
          <span class="lt-leg"><mark class="lt-hl-signpost">Mốc chỉ đường (Signpost)</mark></span>
          <span class="lt-leg"><mark class="lt-hl-trap">Vị trí bẫy (Distractor)</mark></span>
          <span class="lt-leg"><mark class="lt-hl-key">Chốt vị trí A–H (Key)</mark></span>
          <span class="lt-leg" style="color:var(--ink-2);">· Bấm 🔊 cạnh mỗi dòng để nghe lại sửa tai</span>
        </div>

        <div class="lt-compare-grid">
          <div class="lt-compare-left">
            <div class="lt-col-head">CỘT TRÁI · FULL TRANSCRIPT (3 MÀU DẪN CHỨNG)</div>
            <div class="lt-transcript-box">
              ${(ml.transcriptSegments || []).map((seg, si) => `
                <div class="lt-tr-line">
                  <button type="button" class="lt-mini-play" onclick="ListeningTasksModule.replayT3Segment(${si})" title="Nghe lại câu này">🔊</button>
                  <div class="lt-tr-text">
                    <strong class="lt-tr-spk">${esc(seg.speaker || 'Guide')}:</strong>
                    ${highlightTranscriptSegment(seg)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="lt-compare-right">
            <div class="lt-col-head">CỘT PHẢI · BẢN ĐỒ MAP LABELLING &amp; KẾT QUẢ</div>
            ${renderSvgMapHtml(ml, true)}
            <div class="lt-trap-notes-box">
              <div class="lt-trap-notes-title">Kết quả từng địa điểm &amp; đường đi chuẩn:</div>
              ${questions.map((q) => {
                const det = detailsByNum[q.num] || { correct: false, typed: '', expected: q.answer };
                return `
                  <div class="lt-trap-note-row">
                    <span class="lt-blank-res ${det.correct ? 'is-ok' : 'is-err'}" style="margin-right:6px;">
                      <strong>(${q.num}) ${det.correct ? `✓ ${esc(det.expected)}` : `✗ ${esc(det.typed || 'trống')} → ${esc(det.expected)}`}</strong>
                    </span>
                    <strong>${esc(q.place)}:</strong> ${esc(q.routeNote || '')}
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Active Test 3 Map Labelling: 10s Orientation -> Auto-play Pass 1 -> 5s Rest -> Auto-play Pass 2 (ZERO manual controls!)
    const activeQ = examState.t3MapActiveQ || 1;
    body.innerHTML = `
      <div class="lt-t3-stage">
        <div class="lt-progress-row">
          <span><strong>${esc(ml.title || 'Map Labelling')}</strong></span>
          ${renderAudioPillHtml('lt-t3-director', 10)}
        </div>

        <div class="lt-map-workspace">
          <div class="lt-map-canvas-col" id="lt-map-canvas-col">
            ${renderSvgMapHtml(ml, false)}
          </div>
          <div class="lt-map-q-col">
            <div class="lt-col-head">ĐỊA ĐIỂM (A–H)</div>
            <div class="lt-map-q-list" id="lt-map-q-list">
              ${questions.map((q) => {
                const picked = String(examState.t3Inputs[q.num] || '').toUpperCase();
                return `
                  <div class="lt-map-q-row ${activeQ === q.num ? 'is-active' : ''}" data-map-q="${q.num}" onclick="ListeningTasksModule.selectMapQuestion(${q.num})">
                    <span class="lt-blank-num">${q.num}</span>
                    <span class="lt-map-q-place">${esc(q.place)}</span>
                    <select class="lt-map-select" data-map-select="${q.num}" onclick="event.stopPropagation()" onchange="ListeningTasksModule.assignMapLetter(${q.num}, this.value)">
                      <option value="">—</option>
                      ${letters.map((l) => `<option value="${l}" ${picked === l ? 'selected' : ''}>${l}</option>`).join('')}
                    </select>
                  </div>`;
              }).join('')}
            </div>
          </div>
        </div>

        <div class="lt-t3-footer is-end">
          <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.submitTest3()">Nộp bài &amp; Chấm điểm →</button>
        </div>
      </div>
    `;

    runTwoPassAudioSequence({
      directorId: 'lt-t3-director',
      prepSeconds: 10,
      gapSeconds: 5,
      prepTitle: 'Chuẩn bị xem bản đồ',
      doneActionText: 'Kiểm tra & Nộp bài',
      audioFile: ml.audioFile,
      turns: ml.transcriptSegments || [],
      timestamps: ml.segmentTimestamps || [],
      gapMs: 300,
      defaultSpeaker: 'Guide',
      isStillActive: () => Boolean(examState && examState.stage === 3 && examState.t3Phase !== 'submitted'),
      onStartPlaying: () => { if (examState) examState.t3Phase = 'playing'; },
    });
  }

  function refreshActiveMapUiOnly() {
    if (!examState || !examState.task.test3MapLabelling || examState.t3Phase === 'submitted') return;
    const ml = examState.task.test3MapLabelling;
    const canvasCol = document.getElementById('lt-map-canvas-col');
    if (canvasCol) canvasCol.innerHTML = renderSvgMapHtml(ml, false);
    const activeQ = examState.t3MapActiveQ || 1;
    document.querySelectorAll('#lt-map-q-list .lt-map-q-row').forEach((row) => {
      const qn = Number(row.dataset.mapQ);
      row.classList.toggle('is-active', qn === activeQ);
      const sel = row.querySelector('select');
      if (sel) sel.value = String(examState.t3Inputs[qn] || '').toUpperCase();
    });
  }

  function selectMapQuestion(qNum) {
    if (!examState || examState.t3Phase === 'submitted') return;
    examState.t3MapActiveQ = Number(qNum);
    refreshActiveMapUiOnly();
  }

  function assignMapLetter(qNum, letter) {
    if (!examState || examState.t3Phase === 'submitted') return;
    const clean = String(letter || '').trim().toUpperCase();
    examState.t3Inputs[qNum] = clean;
    const totalQ = (examState.task.test3MapLabelling?.questions || []).length;
    if (clean && Number(qNum) < totalQ) {
      examState.t3MapActiveQ = Number(qNum) + 1;
    }
    refreshActiveMapUiOnly();
  }

  function assignMapPinClick(letter) {
    if (!examState || examState.t3Phase === 'submitted') return;
    const qNum = examState.t3MapActiveQ || 1;
    assignMapLetter(qNum, letter);
  }

  function renderTest3() {
    const body = document.getElementById('lt-exam-body');
    if (!body || !examState) return;
    stopAllAudio();
    syncExamCardWidth('full');

    if (examState.task.test3MapLabelling) {
      renderTest3Map();
      return;
    }

    const nc = examState.task.test3NoteCompletion;
    if (!nc) {
      closeExam();
      return;
    }

    if (examState.t3Phase === 'submitted') {
      const total = (nc.blanks || []).length;
      const pct = Math.round((examState.t3Score / Math.max(1, total)) * 100);
      const t1Score = examState.t1Results.filter((r) => r.correct).length;
      const t1Tot = examState.words.length;
      const t2Convs = examState.task.test2Conversations || [];
      const t2Score = t2Convs.reduce((a, c, i) => a + (examState.t2Answers[i] === c.answerIndex ? 1 : 0), 0);

      // STRICT 2-COLUMN COMPARE RULE:
      // LEFT COLUMN = Full Transcript (3-color Signpost / Trap / Key + per-line Replay button)
      // RIGHT COLUMN = Marked Note Completion Sheet + Trap Notes
      body.innerHTML = `
        <div class="lt-t3-compare-banner">
          <div>
            <div class="lt-sum-kicker">ĐÃ NỘP &amp; HOÀN THÀNH TASK LISTENING</div>
            <div class="lt-sum-score tabular">
              Test 3: ${examState.t3Score}/${total} (${pct}%)
              <span class="lt-sum-sub-chips">· T1: ${t1Score}/${t1Tot} · T2: ${t2Score}/${t2Convs.length}</span>
            </div>
          </div>
          <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.closeExam()">Hoàn tất &amp; Về danh sách Task</button>
        </div>

        <div class="lt-legend-row">
          <span class="lt-leg"><mark class="lt-hl-signpost">Dẫn ý (Signpost)</mark></span>
          <span class="lt-leg"><mark class="lt-hl-trap">Bẫy đổi ý (Distractor)</mark></span>
          <span class="lt-leg"><mark class="lt-hl-key">Chốt đáp án (Key)</mark></span>
          <span class="lt-leg" style="color:var(--ink-2);">· Bấm 🔊 cạnh mỗi dòng để nghe lại sửa tai</span>
        </div>

        <div class="lt-compare-grid">
          <div class="lt-compare-left">
            <div class="lt-col-head">CỘT TRÁI · FULL TRANSCRIPT (3 MÀU DẪN CHỨNG)</div>
            <div class="lt-transcript-box">
              ${(nc.transcriptSegments || []).map((seg, si) => `
                <div class="lt-tr-line">
                  <button type="button" class="lt-mini-play" onclick="ListeningTasksModule.replayT3Segment(${si})" title="Nghe lại câu này">🔊</button>
                  <div class="lt-tr-text">
                    <strong class="lt-tr-spk">${esc(seg.speaker || 'Speaker')}:</strong>
                    ${highlightTranscriptSegment(seg)}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="lt-compare-right">
            <div class="lt-col-head">CỘT PHẢI · BÀI LÀM NOTE COMPLETION</div>
            ${renderNoteSheetHtml(nc, true)}
            <div class="lt-trap-notes-box">
              <div class="lt-trap-notes-title">Ghi chú bẫy &amp; chính tả từng ô:</div>
              ${(nc.blanks || []).map((b) => `
                <div class="lt-trap-note-row"><strong>(${b.num}) ${esc(b.answer)}:</strong> ${esc(b.trapNote || '')}</div>
              `).join('')}
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Active Test 3 Note Completion: 10s Prediction -> Auto-play Pass 1 -> 5s Rest -> Auto-play Pass 2 (ZERO manual controls!)
    body.innerHTML = `
      <div class="lt-t3-stage">
        <div class="lt-progress-row">
          <span><strong>${esc(nc.scenarioIntro || 'Note Completion')}</strong></span>
          ${renderAudioPillHtml('lt-t3-director', 10)}
        </div>

        ${renderNoteSheetHtml(nc, false)}

        <div class="lt-t3-footer is-end">
          <button type="button" class="btn btn-primary" onclick="ListeningTasksModule.submitTest3()">Nộp bài &amp; Chấm điểm →</button>
        </div>
      </div>
    `;

    runTwoPassAudioSequence({
      directorId: 'lt-t3-director',
      prepSeconds: 10,
      gapSeconds: 5,
      prepTitle: 'Chuẩn bị đọc đề',
      doneActionText: 'Kiểm tra & Nộp bài',
      audioFile: nc.audioFile,
      turns: nc.transcriptSegments || [],
      timestamps: nc.segmentTimestamps || [],
      gapMs: 300,
      defaultSpeaker: 'Speaker',
      isStillActive: () => Boolean(examState && examState.stage === 3 && examState.t3Phase !== 'submitted'),
      onStartPlaying: () => { if (examState) examState.t3Phase = 'playing'; },
    });
  }

  function onT3Input(num, val) {
    if (!examState) return;
    examState.t3Inputs[num] = val;
  }

  function submitTest3() {
    if (!examState || examState.stage !== 3 || examState.t3Phase === 'submitted') return;
    stopAllAudio();
    const ml = examState.task.test3MapLabelling;
    if (ml) {
      const qs = ml.questions || [];
      let right = 0;
      const details = qs.map((q) => {
        const typed = String(examState.t3Inputs[q.num] || '').trim().toUpperCase();
        const expected = String(q.answer || '').trim().toUpperCase();
        const ok = Boolean(typed && typed === expected);
        if (ok) right += 1;
        return { num: q.num, expected, typed, correct: ok, note: ok ? 'Đúng' : (typed ? 'Sai vị trí' : 'Bỏ trống') };
      });
      examState.t3Score = right;
      examState.t3Details = details;
      examState.t3Phase = 'submitted';
      saveTaskStageScore(true);
      renderTest3();
      return;
    }
    const nc = examState.task.test3NoteCompletion;
    const blanks = nc?.blanks || [];
    let right = 0;
    const details = blanks.map((b) => {
      const typed = examState.t3Inputs[b.num] || '';
      const diag = diagnoseSpellingError(typed, b.answer, b.accepted || []);
      if (diag.correct) right += 1;
      return { num: b.num, expected: b.answer, typed, correct: diag.correct, note: diag.note };
    });
    examState.t3Score = right;
    examState.t3Details = details;
    examState.t3Phase = 'submitted';
    saveTaskStageScore(true);
    renderTest3();
  }

  function replayT3Segment(idx) {
    if (!examState || examState.t3Phase !== 'submitted') return;
    const src = examState.task.test3MapLabelling || examState.task.test3NoteCompletion;
    const seg = src?.transcriptSegments?.[idx];
    if (!seg) return;
    const ts = src?.segmentTimestamps?.[idx];
    if (src?.audioFile && Array.isArray(ts) && ts.length === 2 && getAudioBaseUrl()) {
      playStudioMp3(src.audioFile, { startSec: ts[0], endSec: ts[1], rate: EXAM_PLAYBACK_RATE }).then((ok) => {
        if (!ok) playTurnsOneShot([seg], { rate: EXAM_PLAYBACK_RATE });
      });
      return;
    }
    playTurnsOneShot([seg], { rate: EXAM_PLAYBACK_RATE });
  }

  function replayAfterSubmit(text, accent) {
    speakSingleWordOneShot(text, accent || 'en-GB');
  }

  function goToStage(stageNum) {
    if (!examState) return;
    stopAllAudio();
    const target = Number(stageNum);
    if (isTeacherMode()) {
      if (target === 1 && examState.t1Done) { examState.t1Done = false; examState.t1Idx = 0; }
      if (target === 2 && examState.t2Done) { examState.t2Done = false; examState.t2Idx = 0; }
      if (target === 3 && examState.t3Phase === 'submitted') { examState.t3Phase = 'preread'; }
    }
    examState.stage = target;
    renderExamStage();
  }

  let readyToastShownForId = null;

  function isListeningTaskScope(scopeKey) {
    const sk = String(scopeKey || window.__VOCAB_BRIDGE__?.getCurrentScopeKey?.() || '');
    return /^ltask_/i.test(sk);
  }

  function getTaskByScopeKey(scopeKey) {
    const sk = String(scopeKey || window.__VOCAB_BRIDGE__?.getCurrentScopeKey?.() || '');
    if (!/^ltask_/i.test(sk)) return null;
    const tid = sk.replace(/^ltask_/i, '');
    return (getTasksData().tasks || []).find((t) => t.id === tid) || null;
  }

  function getTaskScopeInfo(scopeKey) {
    const task = getTaskByScopeKey(scopeKey);
    if (!task) return null;
    const words = resolveTaskWords(task);
    if (!words.length) return null;
    return {
      key: `ltask_${task.id}`,
      name: task.label || task.id,
      list: words,
      isTask: true,
      isListeningTask: true,
      taskObj: task,
    };
  }

  function updateStudyBar() {
    const bar = document.getElementById('task-study-bar');
    const finWarnEl = document.getElementById('fc-finished-task-warn');
    if (!bar) return;
    const task = getTaskByScopeKey();
    if (!task) {
      bar.style.display = 'none';
      if (finWarnEl) finWarnEl.style.display = 'none';
      return;
    }

    const total = (task.wordIds || []).length || 30;
    const mastered = getMasteredCount(task);
    const allReady = total > 0 && mastered >= total;
    const prog = loadProgress()[task.id];
    const isCompleted = Boolean(prog?.completed);
    const examDesc = task.hasFullTests
      ? (task.isMapTask ? 'Test 1 + Test 2 + Test 3 (Map)' : 'Test 1 + Test 2 + Test 3 (Note)')
      : 'Test 1 (Nghe & Viết)';

    if (finWarnEl) {
      if (!isCompleted && !isTeacherMode()) {
        finWarnEl.style.display = 'block';
        if (allReady) {
          finWarnEl.innerHTML = `<strong>Đã thuộc đủ ${total}/${total} từ (${esc(task.label)})!</strong> Hãy bấm <strong>"Làm Test →"</strong> để vào <strong>${examDesc}</strong> và hoàn thành Task.`;
        } else {
          finWarnEl.innerHTML = `<strong>Chưa hoàn thành ${esc(task.label)}!</strong> Bạn mới thuộc <strong>${mastered}/${total} từ</strong> (còn ${total - mastered} từ) — cần học thuộc đủ ${total}/${total} từ trên Flashcard hoặc Speed Test rồi mới mở được <strong>${examDesc}</strong>.`;
        }
      } else {
        finWarnEl.style.display = 'none';
      }
    }

    bar.style.display = 'flex';
    const pill = document.getElementById('task-study-pill');
    if (pill) pill.textContent = String(task.label || 'TASK').toUpperCase();
    const statusEl = document.getElementById('task-study-status');
    if (statusEl) {
      statusEl.style.display = '';
      statusEl.textContent = allReady
        ? `✓ Đã thuộc ${mastered} / ${total} từ!`
        : `Đã thuộc ${mastered} / ${total} từ`;
    }
    const idleBadge = document.getElementById('task-study-idle-badge');
    if (idleBadge) idleBadge.style.display = 'none';
    const dlBadge = document.getElementById('task-study-deadline-badge');
    if (dlBadge) dlBadge.style.display = 'none';

    const testBtn = document.getElementById('btn-task-to-test1');
    if (testBtn) {
      testBtn.disabled = false;
      testBtn.classList.toggle('btn-primary', allReady);
      testBtn.classList.toggle('btn-subtle', !allReady);
      testBtn.classList.toggle('is-test-ready', allReady);
      testBtn.textContent = allReady ? 'Làm Test →' : `TEST (${mastered}/${total})`;
    }

    if (allReady && !isTeacherMode() && readyToastShownForId !== task.id) {
      readyToastShownForId = task.id;
      window.__VOCAB_BRIDGE__?.showToast?.(`✓ Đã thuộc đủ ${total}/${total} từ ${task.label}! Bấm "Làm Test →" để bắt đầu.`);
    }
    window.RecognitionTestModule?.updateScopeListTestButton?.();
  }

  function onClickStartTaskExam() {
    const task = getTaskByScopeKey();
    if (!task) return;
    const total = (task.wordIds || []).length || 30;
    const mastered = getMasteredCount(task);
    if (!isTeacherMode() && mastered < total) {
      window.__VOCAB_BRIDGE__?.showToast?.(`Hãy học và bấm '3 - Đã thuộc' cho đủ ${total}/${total} từ của ${task.label} trước khi làm Test (hiện ${mastered}/${total}).`);
      return;
    }
    openExam(task.id, 1);
  }

  function exitTaskStudy() {
    window.__VOCAB_BRIDGE__?.clearListeningTaskScope?.();
    const bar = document.getElementById('task-study-bar');
    if (bar) bar.style.display = 'none';
    const finWarnEl = document.getElementById('fc-finished-task-warn');
    if (finWarnEl) finWarnEl.style.display = 'none';
    window.TotoroUI?.switchView?.('task', { fromUser: true });
  }

  function studyTaskWords(taskId) {
    const task = (getTasksData().tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const dlInfo = !isTeacherMode() ? window.TeacherStudio?.getTaskDeadlineInfo?.(task.id) : null;
    if (dlInfo?.hasDeadline && dlInfo.expired) {
      window.__VOCAB_BRIDGE__?.showToast?.(`Task ${task.label} đã hết hạn lúc ${dlInfo.formattedAt}!`);
      openTaskBrief(task.id);
      return;
    }
    readyToastShownForId = null;
    if (window.TotoroUI?.getActiveSkill?.() !== 'Listening') {
      window.TotoroUI?.setActiveSkill?.('Listening', { silent: true });
    }
    window.__VOCAB_BRIDGE__?.openListeningTaskScope?.(task);
    window.TotoroUI?.switchView?.('flashcard', { fromUser: true });
    updateStudyBar();
  }

  function startTaskSpeedQuiz(taskId) {
    const task = (getTasksData().tasks || []).find((t) => t.id === taskId);
    if (!task) return;
    const dlInfo = !isTeacherMode() ? window.TeacherStudio?.getTaskDeadlineInfo?.(task.id) : null;
    if (dlInfo?.hasDeadline && dlInfo.expired) {
      window.__VOCAB_BRIDGE__?.showToast?.(`Task ${task.label} đã hết hạn lúc ${dlInfo.formattedAt}!`);
      openTaskBrief(task.id);
      return;
    }
    readyToastShownForId = null;
    if (window.TotoroUI?.getActiveSkill?.() !== 'Listening') {
      window.TotoroUI?.setActiveSkill?.('Listening', { silent: true });
    }
    window.__VOCAB_BRIDGE__?.openListeningTaskScope?.(task);
    window.TotoroUI?.switchView?.('flashcard', { fromUser: true });
    updateStudyBar();
    window.AppCore?.audio?.stop?.();
    if (window.RecognitionTestModule?.startListFinalExam) {
      window.RecognitionTestModule.startListFinalExam(`ltask_${task.id}`);
    }
  }

  window.ListeningTasksModule = {
    renderHub,
    renderPracticeScreen,
    shortTopicTitle,
    openPracticePicker,
    openTaskBrief,
    closeTaskBrief,
    openSummaryModal,
    switchSuite: (suiteKey) => {
      activeSuiteKey = suiteKey;
      window.TotoroUI?.renderInlineTaskHub?.();
    },
    isListeningTaskScope,
    getTaskByScopeKey,
    getTaskScopeInfo,
    updateStudyBar,
    onClickStartTaskExam,
    exitTaskStudy,
    studyTaskWords,
    startTaskSpeedQuiz,
    openExam,
    closeExam,
    goToStage,
    pickT1Meaning,
    submitT1Word,
    pickT2Option,
    nextT2Question,
    onT3Input,
    selectMapQuestion,
    assignMapLetter,
    assignMapPinClick,
    submitTest3,
    replayT3Segment,
    replayAfterSubmit,
    getProgressMap: loadProgress,
  };
})();
