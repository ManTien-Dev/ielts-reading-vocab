/* =========================================================
   CORE OOP: AudioEngine — Unified Cross-Platform Multi-Accent TTS & Audio Service
   Studio-first (consistent UK/US dictionary pronunciation across PC, iPad, iPhone, Android)
   with synchronous iOS/iPadOS Safari gesture unlock + browser TTS fallback + stall watchdog.
   ========================================================= */
(function () {
  const VOICE_PREF_KEY = 'ielts_preferred_voice_v1';
  const MALE_NAME_RE = /\b(david|mark|male|daniel|ryan|guy|george|alex|richard|sean|james|andrew|brian|christopher|eric|roger|steffan|liam|william)\b/i;
  // Tiny 44-byte silent WAV used once on first touch to unlock HTMLAudioElement on iOS/iPadOS Safari
  const SILENT_WAV_DATA_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  // Local studio MP3 overrides for dictionary entries whose Youdao clip is defective (e.g., double-spoken)
  const CURATED_WORD_AUDIO = {
    'en-us:researcher': 'assets/audio/words/researcher_us.mp3',
  };

  class AudioEngine {
    constructor() {
      this._voices = [];
      this._lockedVoices = {};
      this._preferredVoiceName = this._loadPreferredVoiceName();
      this._studioAudio = null;
      this._audioUnlocked = false;
      this._audioCtx = null;
      this._compressor = null;
      this._activeSource = null;
      this._youdaoCache = new Map();
      this._proxyFailed = false;
      this._activeUtterance = null;
      this._speakSeq = 0;
      this._watchdog = null;
      this._synthWatchdog = null;
      this.refreshVoices();
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.addEventListener?.('voiceschanged', () => {
            this.refreshVoices();
            this._lockedVoices = {};
            try { window.dispatchEvent(new CustomEvent('app:voices-updated')); } catch (_) {}
          });
        }
        const wake = () => {
          this.refreshVoices();
          this.unlockAudio();
          try { if ('speechSynthesis' in window) window.speechSynthesis.resume?.(); } catch (_) {}
        };
        window.addEventListener('touchstart', wake, { once: true, passive: true });
        window.addEventListener('pointerdown', wake, { once: true, passive: true });
        window.addEventListener('keydown', wake, { once: true, passive: true });
      } catch (_) {}
    }

    _isMobileOrWebKit() {
      try {
        const ua = String(navigator.userAgent || '');
        const isIPadDesktop = /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
        const isMobile = /iPad|iPhone|iPod|Android|Mobile/i.test(ua);
        const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|Edg|OPR/i.test(ua);
        return isIPadDesktop || isMobile || isSafari;
      } catch (_) {
        return false;
      }
    }

    _ensureStudioAudio() {
      if (!this._studioAudio) {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.playsInline = true;
        try {
          audio.setAttribute('playsinline', '');
          audio.setAttribute('webkit-playsinline', '');
        } catch (_) {}
        this._studioAudio = audio;
      }
      return this._studioAudio;
    }

    _ensureAudioCtx() {
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        if (!this._audioCtx) {
          this._audioCtx = new Ctx();
          const comp = this._audioCtx.createDynamicsCompressor();
          comp.threshold.value = -14;
          comp.knee.value = 12;
          comp.ratio.value = 4;
          comp.attack.value = 0.003;
          comp.release.value = 0.12;
          comp.connect(this._audioCtx.destination);
          this._compressor = comp;
        }
        if (this._audioCtx.state === 'suspended') {
          this._audioCtx.resume().catch(() => {});
        }
        return this._audioCtx;
      } catch (_) {
        return null;
      }
    }

    _computeNormalizedGain(buffer) {
      try {
        const TARGET_RMS = 0.20;
        const SILENCE_FLOOR = 0.015;
        let sumSq = 0;
        let activeSamples = 0;
        let peak = 0;
        const chCount = Math.min(2, buffer.numberOfChannels || 1);
        for (let c = 0; c < chCount; c++) {
          const data = buffer.getChannelData(c);
          for (let i = 0; i < data.length; i++) {
            const a = Math.abs(data[i]);
            if (a > peak) peak = a;
            if (a >= SILENCE_FLOOR) {
              sumSq += a * a;
              activeSamples++;
            }
          }
        }
        if (peak < 0.005) return 1.0;
        const rms = activeSamples > 64 ? Math.sqrt(sumSq / activeSamples) : (peak * 0.35);
        let gain = TARGET_RMS / Math.max(rms, 0.025);
        if (peak * gain > 0.92) gain = 0.92 / peak;
        return Math.max(0.45, Math.min(3.2, gain));
      } catch (_) {
        return 1.0;
      }
    }

    _stopWebAudioSource() {
      if (this._activeSource) {
        try {
          this._activeSource.onended = null;
          this._activeSource.stop();
          this._activeSource.disconnect();
        } catch (_) {}
        this._activeSource = null;
      }
    }

    _getYoudaoProxyUrl(clean, typeCode) {
      try {
        const base = typeof window.__APP_BASE_PATH__ === 'string' ? window.__APP_BASE_PATH__ : '';
        return `${base}/api/youdao-tts?audio=${encodeURIComponent(clean)}&type=${typeCode}`;
      } catch (_) {
        return `/api/youdao-tts?audio=${encodeURIComponent(clean)}&type=${typeCode}`;
      }
    }

    _playNormalizedYoudaoViaWebAudio(clean, accent, rate, seq, allowFallbackToBrowser) {
      if (this._proxyFailed || window.location.protocol === 'file:') return false;
      const ctx = this._ensureAudioCtx();
      if (!ctx || !this._compressor) return false;

      const isGb = String(accent).toLowerCase().startsWith('en-gb');
      const typeCode = isGb ? 1 : 2;
      const cacheKey = `${typeCode}:${clean.toLowerCase()}`;
      const numRate = Number(rate);
      const studioRate = (Number.isFinite(numRate) && Math.abs(numRate - 0.92) > 0.14)
        ? Math.max(0.68, Math.min(1.35, numRate))
        : 1.0;

      const startDecoded = (entry) => {
        if (this._speakSeq !== seq) return;
        const runPlay = () => {
          if (this._speakSeq !== seq) return;
          try {
            this._stopWebAudioSource();
            const src = ctx.createBufferSource();
            src.buffer = entry.buffer;
            src.playbackRate.value = studioRate;
            const gainNode = ctx.createGain();
            gainNode.gain.value = entry.gain;
            src.connect(gainNode);
            gainNode.connect(this._compressor);
            this._activeSource = src;
            src.onended = () => {
              if (this._activeSource === src) this._activeSource = null;
              if (this._speakSeq === seq) this._emitPlaybackState(false);
            };
            this._emitPlaybackState(true);
            src.start(0);
          } catch (_) {
            this._playDirectYoudaoElement(clean, accent, rate, seq, allowFallbackToBrowser);
          }
        };
        if (ctx.state === 'suspended') {
          ctx.resume().then(runPlay).catch(() => {
            this._playDirectYoudaoElement(clean, accent, rate, seq, allowFallbackToBrowser);
          });
        } else {
          runPlay();
        }
      };

      const cached = this._youdaoCache.get(cacheKey);
      if (cached) {
        startDecoded(cached);
        return true;
      }

      const proxyUrl = this._getYoudaoProxyUrl(clean, typeCode);
      fetch(proxyUrl)
        .then((res) => {
          if (!res.ok) {
            if (res.status === 404) this._proxyFailed = true;
            throw new Error(`HTTP ${res.status}`);
          }
          return res.arrayBuffer();
        })
        .then((arr) => {
          if (this._speakSeq !== seq) return null;
          return ctx.decodeAudioData(arr.slice(0));
        })
        .then((buffer) => {
          if (!buffer || this._speakSeq !== seq) return;
          const entry = { buffer, gain: this._computeNormalizedGain(buffer) };
          if (this._youdaoCache.size >= 250) {
            const firstKey = this._youdaoCache.keys().next().value;
            if (firstKey) this._youdaoCache.delete(firstKey);
          }
          this._youdaoCache.set(cacheKey, entry);
          startDecoded(entry);
        })
        .catch(() => {
          if (this._speakSeq !== seq) return;
          this._playDirectYoudaoElement(clean, accent, rate, seq, allowFallbackToBrowser);
        });
      return true;
    }

    unlockAudio() {
      this._ensureAudioCtx();
      if (this._audioUnlocked) return;
      this._audioUnlocked = true;
      try {
        if (navigator.webdriver) return;
        const audio = this._ensureStudioAudio();
        if (!audio.src) {
          audio.muted = true;
          audio.src = SILENT_WAV_DATA_URI;
          const p = audio.play?.();
          if (p && typeof p.then === 'function') {
            p.then(() => {
              try {
                audio.pause();
                audio.muted = false;
                audio.currentTime = 0;
              } catch (_) {}
            }).catch(() => {
              audio.muted = false;
              this._audioUnlocked = false;
            });
          } else {
            audio.muted = false;
          }
        }
      } catch (_) {
        this._audioUnlocked = false;
      }
    }

    _loadPreferredVoiceName() {
      try { return localStorage.getItem(VOICE_PREF_KEY) || ''; } catch (_) { return ''; }
    }

    getPreferredVoiceName() {
      return this._preferredVoiceName || '';
    }

    setPreferredVoiceName(name) {
      this._preferredVoiceName = String(name || '').trim();
      this._lockedVoices = {};
      try {
        if (this._preferredVoiceName) {
          localStorage.setItem(VOICE_PREF_KEY, this._preferredVoiceName);
        } else {
          localStorage.removeItem(VOICE_PREF_KEY);
        }
      } catch (_) {}
    }

    refreshVoices() {
      try {
        if ('speechSynthesis' in window && typeof window.speechSynthesis.getVoices === 'function') {
          this._voices = window.speechSynthesis.getVoices() || [];
        }
      } catch (_) {}
      return this._voices;
    }

    getEnglishVoices() {
      if (!this._voices.length) this.refreshVoices();
      return this._voices.filter((v) => String(v.lang || '').toLowerCase().startsWith('en'));
    }

    pickBestVoice(accent = 'en-US', respectCustom = true) {
      if (!this._voices.length) this.refreshVoices();
      const normAccent = String(accent || 'en-US').toLowerCase().replace('_', '-');
      const langPrefix = normAccent.startsWith('en-gb')
        ? 'en-gb'
        : (normAccent.startsWith('en-au')
          ? 'en-au'
          : (normAccent.startsWith('en-nz')
            ? 'en-nz'
            : (normAccent.startsWith('en-ca')
              ? 'en-ca'
              : (normAccent.startsWith('en-ie') ? 'en-ie' : 'en-us'))));

      if (respectCustom && this._preferredVoiceName) {
        const pinned = this._voices.find((v) => v.name === this._preferredVoiceName);
        if (pinned) return pinned;
      }

      if (this._lockedVoices[langPrefix] && this._voices.includes(this._lockedVoices[langPrefix])) {
        return this._lockedVoices[langPrefix];
      }

      const matching = this._voices.filter((v) =>
        String(v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix)
      );
      if (!matching.length) {
        const anyEn = this.getEnglishVoices();
        if (!anyEn.length) return null;
        return anyEn.find((v) => !MALE_NAME_RE.test(v.name || '')) || anyEn[0];
      }

      // Warm female neural & natural voices first; never prefer robotic male voices
      const preferredMap = {
        'en-gb': ['microsoft sonia', 'microsoft libby', 'microsoft maisie', 'google uk english female', 'martha', 'serena', 'kate', 'hazel'],
        'en-au': ['microsoft natasha', 'karen', 'catherine', 'hayley'],
        'en-nz': ['microsoft molly', 'hayley', 'mitchell'],
        'en-ca': ['microsoft clara', 'heather', 'linda'],
        'en-ie': ['microsoft emily', 'moira'],
        'en-us': ['microsoft ava', 'microsoft emma', 'microsoft aria', 'microsoft jenny', 'samantha', 'ava', 'allison', 'google us english', 'microsoft zira'],
      };
      const preferred = preferredMap[langPrefix] || preferredMap['en-us'];
      let chosen = null;
      for (const kw of preferred) {
        const hit = matching.find((v) => String(v.name || '').toLowerCase().includes(kw));
        if (hit) { chosen = hit; break; }
      }
      if (!chosen) {
        chosen = matching.find((v) => /natural|neural|enhanced|premium|female/i.test(v.name || '') && !MALE_NAME_RE.test(v.name || ''))
          || matching.find((v) => !MALE_NAME_RE.test(v.name || ''))
          || matching[0];
      }
      if (chosen) this._lockedVoices[langPrefix] = chosen;
      return chosen;
    }

    _clearWatchdogs() {
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
      if (this._synthWatchdog) {
        clearTimeout(this._synthWatchdog);
        this._synthWatchdog = null;
      }
    }

    hasNativeAccentVoice(accent = '') {
      try {
        if (!('speechSynthesis' in window)) return false;
        if (!this._voices.length) this.refreshVoices();
        const norm = String(accent || '').toLowerCase().replace('_', '-');
        const prefix = norm.slice(0, 5);
        return this._voices.some((v) => String(v.lang || '').toLowerCase().replace('_', '-').startsWith(prefix));
      } catch (_) {
        return false;
      }
    }

    _emitPlaybackState(playing) {
      try {
        window.dispatchEvent(new CustomEvent(playing ? 'app:audio-start' : 'app:audio-end'));
      } catch (_) {}
    }

    _hasDesktopBrowserVoice(accent = 'en-US') {
      try {
        if (this._isMobileOrWebKit()) return false;
        if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
        if (!this._voices.length) this.refreshVoices();
        if (!this._voices.length) return true; // desktop voices hydrate asynchronously on first load
        return Boolean(this.pickBestVoice(accent, true));
      } catch (_) {
        return false;
      }
    }

    stop() {
      this._speakSeq++;
      this._clearWatchdogs();
      this._stopWebAudioSource();
      if (this._studioAudio) {
        try {
          this._studioAudio.onplaying = null;
          this._studioAudio.onerror = null;
          this._studioAudio.onended = null;
          this._studioAudio.pause();
          this._studioAudio.currentTime = 0;
        } catch (_) {}
      }
      this._activeUtterance = null;
      try {
        if ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
      this._emitPlaybackState(false);
    }

    _playCuratedLocalAudio(relPath, clean, accent, rate, seq) {
      if (!relPath) return false;
      try {
        const audio = this._ensureStudioAudio();
        audio.muted = false;
        audio.volume = 1.0;
        audio.onplaying = null;
        audio.onerror = null;
        audio.onended = null;
        try { audio.pause(); } catch (_) {}

        let settled = false;
        const fallback = () => {
          if (settled || this._speakSeq !== seq) return;
          settled = true;
          this._clearWatchdogs();
          if (!this.playYoudaoAudio(clean, accent, rate, seq, true)) {
            this.speakViaBrowser(clean, accent, rate, seq, true, false);
          }
        };

        audio.onplaying = () => {
          settled = true;
          this._audioUnlocked = true;
          this._clearWatchdogs();
          if (this._speakSeq === seq) this._emitPlaybackState(true);
        };
        audio.onended = () => {
          if (this._speakSeq === seq) this._emitPlaybackState(false);
        };
        audio.onerror = () => fallback();

        const numRate = Number(rate);
        const studioRate = (Number.isFinite(numRate) && Math.abs(numRate - 0.92) > 0.14)
          ? Math.max(0.68, Math.min(1.35, numRate))
          : 1.0;

        audio.src = relPath;
        audio.playbackRate = studioRate;
        const playPromise = audio.play?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => {
            if (this._speakSeq !== seq) return;
            if (err && err.name === 'AbortError') return;
            fallback();
          });
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    canUseYoudaoAudio(clean) {
      try {
        // Strict R4 test/offline isolation: never emit external media requests in webdriver/localhost/offline
        if (navigator.webdriver || !navigator.onLine) return false;
        const host = String(window.location?.hostname || '').toLowerCase();
        if (host === '127.0.0.1' || host === 'localhost') return false;
        return Boolean(clean && clean.length <= 80);
      } catch (_) {
        return false;
      }
    }

    playYoudaoAudio(clean, accent = 'en-US', rate = 0.92, seq = 0, allowFallbackToBrowser = true) {
      if (!this.canUseYoudaoAudio(clean)) return false;
      if (this._playNormalizedYoudaoViaWebAudio(clean, accent, rate, seq, allowFallbackToBrowser)) {
        return true;
      }
      return this._playDirectYoudaoElement(clean, accent, rate, seq, allowFallbackToBrowser);
    }

    _playDirectYoudaoElement(clean, accent = 'en-US', rate = 0.92, seq = 0, allowFallbackToBrowser = true) {
      if (!this.canUseYoudaoAudio(clean)) return false;
      try {
        const audio = this._ensureStudioAudio();
        audio.muted = false;
        audio.volume = 1.0;
        audio.onplaying = null;
        audio.onerror = null;
        audio.onended = null;
        try { audio.pause(); } catch (_) {}

        const isGb = String(accent).toLowerCase().startsWith('en-gb');
        const typeCode = isGb ? 1 : 2;
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=${typeCode}`;

        let settled = false;
        const fallbackToBrowser = () => {
          if (settled || this._speakSeq !== seq) return;
          settled = true;
          if (this._watchdog) {
            clearTimeout(this._watchdog);
            this._watchdog = null;
          }
          if (allowFallbackToBrowser) {
            this.speakViaBrowser(clean, accent, rate, seq, true, false);
          }
        };

        audio.onplaying = () => {
          settled = true;
          this._audioUnlocked = true;
          if (this._watchdog) {
            clearTimeout(this._watchdog);
            this._watchdog = null;
          }
          if (this._speakSeq === seq) this._emitPlaybackState(true);
        };
        audio.onended = () => {
          if (this._speakSeq === seq) this._emitPlaybackState(false);
        };
        audio.onerror = () => fallbackToBrowser();

        const numRate = Number(rate);
        const studioRate = (Number.isFinite(numRate) && Math.abs(numRate - 0.92) > 0.14)
          ? Math.max(0.68, Math.min(1.35, numRate))
          : 1.0;

        audio.src = url;
        audio.playbackRate = studioRate;
        const playPromise = audio.play?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch((err) => {
            if (this._speakSeq !== seq) return;
            if (err && err.name === 'AbortError') return;
            fallbackToBrowser();
          });
        }

        if (allowFallbackToBrowser) {
          this._watchdog = setTimeout(() => {
            if (!settled && this._speakSeq === seq) {
              try { audio.pause(); } catch (_) {}
              fallbackToBrowser();
            }
          }, 4200);
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    speakViaBrowser(clean, accent = 'en-US', rate = 0.92, seq = 0, respectCustom = true, allowFallbackToYoudao = true) {
      const canSynth = ('speechSynthesis' in window) && typeof SpeechSynthesisUtterance !== 'undefined';
      if (!canSynth) {
        return allowFallbackToYoudao ? this.playYoudaoAudio(clean, accent, rate, seq, false) : false;
      }
      if (!this._voices.length) this.refreshVoices();
      const anyEnVoice = this._voices.some((v) => String(v.lang || '').toLowerCase().startsWith('en'));
      if (this._voices.length > 0 && !anyEnVoice) {
        return allowFallbackToYoudao ? this.playYoudaoAudio(clean, accent, rate, seq, false) : false;
      }

      try {
        const isTouchWebKit = this._isMobileOrWebKit();
        const wasBusy = Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
        if (wasBusy) {
          window.speechSynthesis.cancel();
        }
        const runSpeak = () => {
          if (this._speakSeq !== seq) return;
          try {
            if (!this._voices.length) this.refreshVoices();
            const bestVoice = this.pickBestVoice(accent, respectCustom);
            window.speechSynthesis.resume?.();
            const utt = new SpeechSynthesisUtterance(clean);
            utt.lang = bestVoice?.lang || accent;
            utt.rate = Math.max(0.65, Math.min(1.5, Number(rate) || 0.92));
            utt.volume = 1.0;
            utt.pitch = 1.0;
            if (bestVoice) utt.voice = bestVoice;
            this._activeUtterance = utt;

            let started = false;
            utt.onstart = () => {
              started = true;
              if (this._synthWatchdog) {
                clearTimeout(this._synthWatchdog);
                this._synthWatchdog = null;
              }
              if (this._speakSeq === seq) this._emitPlaybackState(true);
            };
            utt.onend = () => {
              started = true;
              if (this._synthWatchdog) {
                clearTimeout(this._synthWatchdog);
                this._synthWatchdog = null;
              }
              if (this._activeUtterance === utt) this._activeUtterance = null;
              if (this._speakSeq === seq) this._emitPlaybackState(false);
            };
            utt.onerror = (ev) => {
              started = true;
              if (this._synthWatchdog) {
                clearTimeout(this._synthWatchdog);
                this._synthWatchdog = null;
              }
              if (this._activeUtterance === utt) this._activeUtterance = null;
              if (this._speakSeq === seq) this._emitPlaybackState(false);
              const code = String(ev?.error || '');
              if (code === 'interrupted' || code === 'canceled') return;
              if (allowFallbackToYoudao && this._speakSeq === seq) {
                this.playYoudaoAudio(clean, accent, rate, seq, false);
              }
            };
            window.speechSynthesis.speak(utt);

            // Watchdog: iOS/iPadOS Safari & Android WebViews can silently stall without firing onstart/onerror
            if (allowFallbackToYoudao && this.canUseYoudaoAudio(clean)) {
              this._synthWatchdog = setTimeout(() => {
                if (!started && this._speakSeq === seq) {
                  try { window.speechSynthesis.cancel(); } catch (_) {}
                  this.playYoudaoAudio(clean, accent, rate, seq, false);
                }
              }, 900);
            }
          } catch (_) {
            if (allowFallbackToYoudao && this._speakSeq === seq) {
              this.playYoudaoAudio(clean, accent, rate, seq, false);
            }
          }
        };

        // On iOS / iPadOS / Safari / Mobile, MUST speak synchronously inside the user tap stack
        // (deferring into setTimeout loses Transient User Activation and causes silent drops!)
        if (isTouchWebKit) {
          runSpeak();
        } else if (wasBusy) {
          // 40ms micro-gap avoids desktop Chromium bug where cancel() silently swallows an immediately queued speak()
          setTimeout(runSpeak, 40);
        } else if (!this._voices.length) {
          // Brief 100ms wait on very first desktop call so neural voices hydrate
          setTimeout(runSpeak, 100);
        } else {
          runSpeak();
        }
        return true;
      } catch (_) {
        return allowFallbackToYoudao ? this.playYoudaoAudio(clean, accent, rate, seq, false) : false;
      }
    }

    speak(text, { accent = 'en-US', rate = 0.92, engine = 'auto', respectCustom = true } = {}) {
      const clean = String(text || '').replace(/\s*\/\s*/g, ' or ').trim();
      if (!clean) return false;
      const seq = ++this._speakSeq;
      this._clearWatchdogs();
      this._stopWebAudioSource();
      if (this._studioAudio) {
        try {
          this._studioAudio.onplaying = null;
          this._studioAudio.onerror = null;
          this._studioAudio.onended = null;
          this._studioAudio.pause();
        } catch (_) {}
      }
      try {
        if ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}

      // Always prefer Youdao voice (RMS-normalized via /api/youdao-tts) for UK & US.
      // For extra IELTS accents Youdao lacks (AU / NZ / CA / IE), use real native AU/NZ/CA/IE browser voice when installed,
      // otherwise fall back seamlessly to Youdao UK (for AU/NZ/IE) or Youdao US (for CA).
      const hasPinnedBrowserVoice = Boolean(respectCustom && this._preferredVoiceName);
      const normAcc = String(accent || 'en-US').toLowerCase().replace('_', '-');
      const isExtraIeltsAccent = /^(en-au|en-nz|en-ca|en-ie)/.test(normAcc);
      if (engine === 'auto' && !hasPinnedBrowserVoice && isExtraIeltsAccent && this.hasNativeAccentVoice(normAcc)) {
        return this.speakViaBrowser(clean, accent, rate, seq, false, true);
      }

      const youdaoAccent = normAcc.startsWith('en-ca')
        ? 'en-US'
        : (/^(en-gb|en-au|en-nz|en-ie)/.test(normAcc) ? 'en-GB' : 'en-US');
      const preferYoudao = (engine === 'youdao') || (engine === 'auto' && !hasPinnedBrowserVoice);

      if (preferYoudao) {
        const curatedKey = `${youdaoAccent.toLowerCase()}:${clean.toLowerCase()}`;
        const curatedPath = CURATED_WORD_AUDIO[curatedKey];
        if (curatedPath && !navigator.webdriver && this._playCuratedLocalAudio(curatedPath, clean, youdaoAccent, rate, seq)) {
          return true;
        }
        if (this.playYoudaoAudio(clean, youdaoAccent, rate, seq, true)) {
          return true;
        }
        return this.speakViaBrowser(clean, accent, rate, seq, respectCustom, false);
      }
      return this.speakViaBrowser(clean, accent, rate, seq, respectCustom, true);
    }

    supportsSpeechRecognition() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
  }

  window.CoreAudioEngine = AudioEngine;
})();
