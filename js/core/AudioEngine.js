/* =========================================================
   CORE OOP: AudioEngine — Unified Multi-Accent TTS & Audio Service
   Supports Reading (UK/US), Listening (UK/US/AU + 0.8x-1.25x), Speaking playback.
   ========================================================= */
(function () {
  class AudioEngine {
    constructor() {
      this._voices = [];
      this._lockedVoices = {};
      this._studioAudio = null;
      this._activeUtterance = null;
      this._speakSeq = 0;
      this._watchdog = null;
      this.refreshVoices();
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.addEventListener?.('voiceschanged', () => {
            this.refreshVoices();
            this._lockedVoices = {};
          });
        }
        const wake = () => {
          this.refreshVoices();
          try { if ('speechSynthesis' in window) window.speechSynthesis.resume?.(); } catch (_) {}
        };
        window.addEventListener('pointerdown', wake, { once: true, passive: true });
        window.addEventListener('keydown', wake, { once: true, passive: true });
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

    pickBestVoice(accent = 'en-US') {
      if (!this._voices.length) this.refreshVoices();
      const normAccent = String(accent || 'en-US').toLowerCase().replace('_', '-');
      const langPrefix = normAccent.startsWith('en-gb')
        ? 'en-gb'
        : (normAccent.startsWith('en-au') ? 'en-au' : 'en-us');
      if (this._lockedVoices[langPrefix] && this._voices.includes(this._lockedVoices[langPrefix])) {
        return this._lockedVoices[langPrefix];
      }
      const matching = this._voices.filter((v) =>
        String(v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix)
      );
      if (!matching.length) return null;

      const preferredMap = {
        'en-gb': ['microsoft sonia', 'microsoft libby', 'google uk english female', 'daniel', 'martha', 'serena', 'google uk english male', 'ryan'],
        'en-au': ['microsoft natasha', 'karen', 'catherine', 'gordon', 'william', 'google'],
        'en-us': ['microsoft aria', 'microsoft jenny', 'google us english', 'samantha', 'ava', 'allison', 'alex', 'guy'],
      };
      const preferred = preferredMap[langPrefix] || preferredMap['en-us'];
      let chosen = null;
      for (const kw of preferred) {
        const hit = matching.find((v) => String(v.name || '').toLowerCase().includes(kw));
        if (hit) { chosen = hit; break; }
      }
      if (!chosen) {
        chosen = matching.find((v) => /natural|neural|google|enhanced|premium/i.test(v.name || '')) || matching[0];
      }
      if (chosen) this._lockedVoices[langPrefix] = chosen;
      return chosen;
    }

    stop() {
      this._speakSeq++;
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
      if (this._studioAudio) {
        try {
          this._studioAudio.onplaying = null;
          this._studioAudio.onerror = null;
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
    }

    canUseStudioAudio(clean) {
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

    playStudioDictionaryAudio(clean, accent = 'en-US', rate = 0.92, seq = 0) {
      if (!this.canUseStudioAudio(clean)) return false;
      try {
        if (!this._studioAudio) {
          this._studioAudio = new Audio();
          this._studioAudio.preload = 'auto';
        }
        const audio = this._studioAudio;
        audio.onplaying = null;
        audio.onerror = null;
        try { audio.pause(); } catch (_) {}

        const isGb = String(accent).toLowerCase().startsWith('en-gb');
        const typeCode = isGb ? 1 : 2;
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=${typeCode}`;

        let settled = false;
        const fallbackToSynth = () => {
          if (settled || this._speakSeq !== seq) return;
          settled = true;
          if (this._watchdog) {
            clearTimeout(this._watchdog);
            this._watchdog = null;
          }
          this.speakViaSynthesis(clean, accent, rate, seq);
        };

        audio.onplaying = () => {
          settled = true;
          if (this._watchdog) {
            clearTimeout(this._watchdog);
            this._watchdog = null;
          }
        };
        audio.onerror = () => fallbackToSynth();

        // Keep natural 1.0x studio narrator speed for normal reading; honor explicit slow/fast rates (e.g. 0.75x / 1.25x)
        const numRate = Number(rate);
        const studioRate = (Number.isFinite(numRate) && Math.abs(numRate - 0.92) > 0.14)
          ? Math.max(0.75, Math.min(1.35, numRate))
          : 1.0;

        audio.src = url;
        audio.playbackRate = studioRate;
        const playPromise = audio.play?.();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => fallbackToSynth());
        }

        this._watchdog = setTimeout(() => {
          if (!settled && this._speakSeq === seq) {
            try { audio.pause(); } catch (_) {}
            fallbackToSynth();
          }
        }, 2200);
        return true;
      } catch (_) {
        return false;
      }
    }

    speakViaSynthesis(clean, accent = 'en-US', rate = 0.92, seq = 0) {
      const canSynth = ('speechSynthesis' in window) && typeof SpeechSynthesisUtterance !== 'undefined';
      if (!canSynth) return false;
      try {
        const wasBusy = Boolean(window.speechSynthesis.speaking || window.speechSynthesis.pending);
        if (wasBusy) {
          window.speechSynthesis.cancel();
        }
        const runSpeak = () => {
          if (this._speakSeq !== seq) return;
          try {
            if (!this._voices.length) this.refreshVoices();
            const bestVoice = this.pickBestVoice(accent);
            window.speechSynthesis.resume?.();
            const utt = new SpeechSynthesisUtterance(clean);
            utt.lang = accent;
            utt.rate = Math.max(0.65, Math.min(1.5, Number(rate) || 0.92));
            if (bestVoice) utt.voice = bestVoice;
            this._activeUtterance = utt;
            utt.onend = () => {
              if (this._activeUtterance === utt) this._activeUtterance = null;
            };
            utt.onerror = () => {
              if (this._activeUtterance === utt) this._activeUtterance = null;
            };
            window.speechSynthesis.speak(utt);
          } catch (_) {}
        };
        if (wasBusy) {
          setTimeout(runSpeak, 40);
        } else {
          runSpeak();
        }
        return true;
      } catch (_) {
        return false;
      }
    }

    speak(text, { accent = 'en-US', rate = 0.92 } = {}) {
      const clean = String(text || '').replace(/\s*\/\s*/g, ' or ').trim();
      if (!clean) return false;
      const seq = ++this._speakSeq;
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
      if (this._studioAudio) {
        try {
          this._studioAudio.onplaying = null;
          this._studioAudio.onerror = null;
          this._studioAudio.pause();
        } catch (_) {}
      }
      try {
        if ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}

      // Primary: crisp studio dictionary narrator (UK/US human voice), with automatic Web Speech fallback if offline/blocked
      if (this.playStudioDictionaryAudio(clean, accent, rate, seq)) {
        return true;
      }
      return this.speakViaSynthesis(clean, accent, rate, seq);
    }

    supportsSpeechRecognition() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
  }

  window.CoreAudioEngine = AudioEngine;
})();
