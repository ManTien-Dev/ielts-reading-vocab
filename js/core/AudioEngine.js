/* =========================================================
   CORE OOP: AudioEngine — Unified Multi-Accent TTS & Audio Service
   Prioritizes warm female Neural / Browser TTS voices, locked consistently
   per accent so every word uses the exact same pleasant voice.
   ========================================================= */
(function () {
  const VOICE_PREF_KEY = 'ielts_preferred_voice_v1';
  const MALE_NAME_RE = /\b(david|mark|male|daniel|ryan|guy|george|alex|richard|sean|james|andrew|brian|christopher|eric|roger|steffan|liam|william)\b/i;

  class AudioEngine {
    constructor() {
      this._voices = [];
      this._lockedVoices = {};
      this._preferredVoiceName = this._loadPreferredVoiceName();
      this._fallbackAudio = null;
      this._activeUtterance = null;
      this._speakSeq = 0;
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
          try { if ('speechSynthesis' in window) window.speechSynthesis.resume?.(); } catch (_) {}
        };
        window.addEventListener('pointerdown', wake, { once: true, passive: true });
        window.addEventListener('keydown', wake, { once: true, passive: true });
      } catch (_) {}
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

    stop() {
      this._speakSeq++;
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

    playEmergencyFallback(text, accent = 'en-US', rate = 0.94) {
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
        audio.playbackRate = Math.max(0.75, Math.min(1.35, Number(rate) || 0.94));
        this._fallbackAudio = audio;
        audio.play?.().catch?.(() => {});
        return true;
      } catch (_) {
        return false;
      }
    }

    speak(text, { accent = 'en-US', rate = 0.92, respectCustom = true } = {}) {
      const clean = String(text || '').replace(/\s*\/\s*/g, ' or ').trim();
      if (!clean) return false;
      const seq = ++this._speakSeq;
      if (this._fallbackAudio) {
        try { this._fallbackAudio.pause(); this._fallbackAudio = null; } catch (_) {}
      }
      const canSynth = ('speechSynthesis' in window) && typeof SpeechSynthesisUtterance !== 'undefined';
      if (!canSynth) {
        return this.playEmergencyFallback(clean, accent, rate);
      }
      if (!this._voices.length) this.refreshVoices();
      const anyEnVoice = this._voices.some((v) => String(v.lang || '').toLowerCase().startsWith('en'));
      if (this._voices.length > 0 && !anyEnVoice) {
        return this.playEmergencyFallback(clean, accent, rate);
      }

      try {
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
            if (bestVoice) utt.voice = bestVoice;
            this._activeUtterance = utt;
            utt.onend = () => {
              if (this._activeUtterance === utt) this._activeUtterance = null;
            };
            utt.onerror = (ev) => {
              if (this._activeUtterance === utt) this._activeUtterance = null;
              const code = String(ev?.error || '');
              if (code === 'interrupted' || code === 'canceled') return;
              if (this._speakSeq === seq) {
                this.playEmergencyFallback(clean, accent, rate);
              }
            };
            window.speechSynthesis.speak(utt);
          } catch (_) {
            if (this._speakSeq === seq) this.playEmergencyFallback(clean, accent, rate);
          }
        };
        if (wasBusy) {
          // 40ms micro-gap avoids Chromium bug where cancel() silently swallows an immediately queued speak()
          setTimeout(runSpeak, 40);
        } else if (!this._voices.length) {
          // Brief 100ms wait on very first call so voices hydrate and word #1 uses the same warm female voice
          setTimeout(runSpeak, 100);
        } else {
          runSpeak();
        }
        return true;
      } catch (_) {
        return this.playEmergencyFallback(clean, accent, rate);
      }
    }

    supportsSpeechRecognition() {
      return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
  }

  window.CoreAudioEngine = AudioEngine;
})();
