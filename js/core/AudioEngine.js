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

  class AudioEngine {
    constructor() {
      this._voices = [];
      this._lockedVoices = {};
      this._preferredVoiceName = this._loadPreferredVoiceName();
      this._studioAudio = null;
      this._audioUnlocked = false;
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

    unlockAudio() {
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
        : (normAccent.startsWith('en-au') ? 'en-au' : 'en-us');

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
          }, 2200);
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

      // Desktop: prefer locked browser neural voice FIRST for 100% consistent loudness across all 3,864 words
      // (avoids Youdao MP3 per-word loudness jumps & fallback volume spikes). Mobile/WebKit keeps studio-first.
      const hasPinnedBrowserVoice = Boolean(respectCustom && this._preferredVoiceName);
      const useConsistentBrowser = (engine === 'browser') || hasPinnedBrowserVoice || (engine === 'auto' && this._hasDesktopBrowserVoice(accent));

      if (!useConsistentBrowser) {
        if (this.playYoudaoAudio(clean, accent, rate, seq, true)) {
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
