/* =========================================================
   CORE OOP: AudioEngine — Unified Multi-Accent TTS & Audio Service
   Supports Reading (UK/US), Listening (UK/US/AU + 0.8x-1.25x), Speaking playback.
   ========================================================= */
(function () {
  class AudioEngine {
    constructor() {
      this._voices = [];
      this._fallbackAudio = null;
      this._activeUtterance = null;
      this._speakSeq = 0;
      this._watchdog = null;
      this.refreshVoices();
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.addEventListener?.('voiceschanged', () => this.refreshVoices());
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
      const matching = this._voices.filter((v) =>
        String(v.lang || '').toLowerCase().replace('_', '-').startsWith(langPrefix)
      );
      if (!matching.length) return null;

      const preferredMap = {
        'en-gb': ['google uk english female', 'google uk english male', 'daniel', 'martha', 'libby', 'sonia', 'ryan', 'serena'],
        'en-au': ['karen', 'catherine', 'gordon', 'natasha', 'william', 'google'],
        'en-us': ['google us english', 'samantha', 'alex', 'aria', 'jenny', 'guy', 'ava', 'allison'],
      };
      const preferred = preferredMap[langPrefix] || preferredMap['en-us'];
      for (const kw of preferred) {
        const hit = matching.find((v) => String(v.name || '').toLowerCase().includes(kw));
        if (hit) return hit;
      }
      return matching.find((v) => /natural|neural|google|enhanced|premium/i.test(v.name || '')) || matching[0];
    }

    stop() {
      this._speakSeq++;
      if (this._watchdog) {
        clearTimeout(this._watchdog);
        this._watchdog = null;
      }
      if (this._fallbackAudio) {
        try { this._fallbackAudio.pause(); this._fallbackAudio = null; } catch (_) {}
      }
      this._activeUtterance = null;
      try {
        if ('speechSynthesis' in window && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
          window.speechSynthesis.cancel();
        }
      } catch (_) {}
    }

    playDictionaryFallback(text, accent = 'en-US', rate = 0.96) {
      try {
        // Strict R4 test/offline isolation: never emit external media requests in webdriver/localhost/offline
        if (navigator.webdriver || !navigator.onLine) return false;
        const host = String(window.location?.hostname || '').toLowerCase();
        if (host === '127.0.0.1' || host === 'localhost') return false;
        const clean = String(text || '').trim();
        if (!clean || clean.length > 60) return false;
        if (this._fallbackAudio) {
          try { this._fallbackAudio.pause(); } catch (_) {}
        }
        const isGb = String(accent).toLowerCase().startsWith('en-gb');
        const typeCode = isGb ? 1 : 2;
        const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(clean)}&type=${typeCode}`;
        const audio = new Audio(url);
        audio.playbackRate = Math.max(0.7, Math.min(1.4, Number(rate) || 0.96));
        this._fallbackAudio = audio;
        audio.onerror = () => {
          if (this._fallbackAudio !== audio) return;
          try {
            const tl = isGb ? 'en-GB' : 'en-US';
            const gUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${tl}&q=${encodeURIComponent(clean)}`;
            const alt = new Audio(gUrl);
            alt.playbackRate = audio.playbackRate;
            this._fallbackAudio = alt;
            alt.play?.().catch?.(() => {});
          } catch (_) {}
        };
        audio.play?.().catch?.(() => {});
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
      if (this._fallbackAudio) {
        try { this._fallbackAudio.pause(); this._fallbackAudio = null; } catch (_) {}
      }
      const canSynth = ('speechSynthesis' in window) && typeof SpeechSynthesisUtterance !== 'undefined';
      if (!canSynth) {
        return this.playDictionaryFallback(clean, accent, rate);
      }
      const bestVoice = this.pickBestVoice(accent);
      const anyEnVoice = this._voices.some((v) => String(v.lang || '').toLowerCase().startsWith('en'));
      if (this._voices.length > 0 && !anyEnVoice) {
        return this.playDictionaryFallback(clean, accent, rate);
      }
      try {
        if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
          window.speechSynthesis.cancel();
        }
        window.speechSynthesis.resume?.();
        const utt = new SpeechSynthesisUtterance(clean);
        utt.lang = accent;
        utt.rate = Math.max(0.65, Math.min(1.5, Number(rate) || 0.92));
        if (bestVoice) utt.voice = bestVoice;
        let started = false;
        this._activeUtterance = utt;
        utt.onstart = () => {
          started = true;
          if (this._watchdog) {
            clearTimeout(this._watchdog);
            this._watchdog = null;
          }
        };
        utt.onend = () => {
          if (this._activeUtterance === utt) this._activeUtterance = null;
        };
        utt.onerror = (ev) => {
          if (this._activeUtterance === utt) this._activeUtterance = null;
          if (this._watchdog) {
            clearTimeout(this._watchdog);
            this._watchdog = null;
          }
          const code = String(ev?.error || '');
          if (code === 'interrupted' || code === 'canceled') return;
          if (this._speakSeq === seq) {
            this.playDictionaryFallback(clean, accent, rate);
          }
        };
        window.speechSynthesis.speak(utt);
        // Watchdog for silent Chrome/Edge speechSynthesis stalls: fallback to dictionary audio if onstart never fires
        this._watchdog = setTimeout(() => {
          if (!started && this._speakSeq === seq) {
            this._watchdog = null;
            try { window.speechSynthesis.cancel(); } catch (_) {}
            this.playDictionaryFallback(clean, accent, rate);
          }
        }, 650);
        return true;
      } catch (_) {
        return this.playDictionaryFallback(clean, accent, rate);
      }
    }

    supportsSpeechRecognition() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
  }

  window.CoreAudioEngine = AudioEngine;
})();
