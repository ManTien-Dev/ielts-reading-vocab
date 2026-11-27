/**
 * Totoro IELTS Master — Calibrated IELTS Writing & Speaking Grading Engine
 *
 * Implements the 10 International Anti-Bias AI Grading Rules + Cambridge 11-19 Calibration:
 *   1. Code-Computed Objective Telemetry (Writing + Speaking Whisper Acoustic Metrics)
 *   2. Server AI Examiner (`POST /api/grade-ielts`: Groq Llama 3.3 70B -> CF AI -> Gemini)
 *      + Optional Direct Local Gemini Key Fallback (`ielts_gemini_local_key_v1`)
 *      + Strict Calibrated Offline Examiner Engine (100% functional without network)
 *   3. Deterministic Code-Enforced Ceiling Gates (`applyWritingExaminerCaps` / `applySpeakingExaminerCaps`)
 *      so AI leniency NEVER violates official May 2023 IELTS band ceilings
 *   4. Official IELTS Band Rounding (.25 -> .5, .75 -> next whole)
 *   5. Rich Totoro Soft-Editorial Examiner Report UI Renderer
 */
(function (global) {
  'use strict';

  const LOCAL_GEMINI_KEY = 'ielts_gemini_local_key_v1';
  const PROD_API_ORIGIN = 'https://totoro-ieltsmaster.pages.dev';

  const STOP_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'in', 'on', 'at', 'to', 'for', 'of', 'by', 'with',
    'from', 'as', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
    'that', 'this', 'these', 'those', 'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our',
    'you', 'your', 'i', 'me', 'my', 'he', 'him', 'his', 'she', 'her', 'who', 'which', 'what',
    'where', 'when', 'why', 'how', 'so', 'than', 'then', 'there', 'here', 'not', 'no', 'yes',
    'very', 'more', 'most', 'some', 'any', 'many', 'much', 'all', 'also', 'just', 'only', 'about',
    'into', 'over', 'after', 'before', 'between', 'under', 'through', 'during', 'without', 'within',
    'people', 'thing', 'things', 'way', 'ways', 'time', 'make', 'get', 'give', 'take', 'say', 'think',
    'know', 'want', 'need', 'use', 'become', 'seem', 'often', 'always', 'never', 'really', 'now',
    'today', 'nowadays', 'essay', 'discuss', 'both', 'views', 'opinion', 'agree', 'disagree',
    'extent', 'reasons', 'answer', 'examples', 'knowledge', 'experience', 'write', 'least', 'words',
    'describe', 'explain', 'should', 'talk', 'tell', 'something', 'someone', 'person', 'positive', 'negative',
    'every', 'everyone', 'everything', 'case', 'hours', 'spend', 'spending', 'development', 'developing',
    'important', 'different', 'problem', 'problems', 'world', 'country', 'countries', 'society', 'modern',
    'life', 'lives', 'good', 'better', 'best', 'high', 'higher', 'large', 'small', 'great', 'new', 'old',
    'young', 'long', 'longer', 'short', 'first', 'second', 'third', 'part', 'parts', 'side', 'sides',
    'point', 'points', 'fact', 'number', 'amount', 'level', 'levels', 'effect', 'effects', 'result',
    'results', 'advantage', 'advantages', 'disadvantage', 'disadvantages', 'benefit', 'benefits',
    'issue', 'issues', 'idea', 'ideas', 'trend', 'past', 'future', 'kind', 'type', 'sort', 'become',
  ]);

  const COMMON_TYPOS = {
    enviroment: 'environment',
    enviromental: 'environmental',
    goverment: 'government',
    govement: 'government',
    tecnology: 'technology',
    technolgy: 'technology',
    developement: 'development',
    beleive: 'believe',
    recieve: 'receive',
    achive: 'achieve',
    seperate: 'separate',
    occured: 'occurred',
    untill: 'until',
    tommorow: 'tomorrow',
    definately: 'definitely',
    neccessary: 'necessary',
    accomodate: 'accommodate',
    benifit: 'benefit',
    benifits: 'benefits',
    importent: 'important',
    diffrent: 'different',
    knowlege: 'knowledge',
    experiance: 'experience',
    responsiblity: 'responsibility',
    oportunity: 'opportunity',
    communcation: 'communication',
    studing: 'studying',
    writting: 'writing',
    begining: 'beginning',
    succesful: 'successful',
    unfortunatly: 'unfortunately',
    immediatly: 'immediately',
    conclution: 'conclusion',
    sociaty: 'society',
    childrens: 'children',
    peoples: 'people',
    informations: 'information',
    advices: 'advice',
    knowledges: 'knowledge',
    equipments: 'equipment',
    homeworks: 'homework',
  };

  const WRITING_CLICHES = [
    'every coin has two sides',
    'two sides of the same coin',
    'double-edged sword',
    'in a nutshell',
    'last but not least',
    'since the dawn of time',
    'from time immemorial',
    'with the rapid development of society',
    'with the development of science and technology',
    'it is an undeniable fact that',
    'it is universally acknowledged that',
    'in this day and age',
    'hotly debated topic',
  ];

  const INFORMAL_WRITING_REGEX = [
    { re: /\b(gonna|wanna|gotta|kinda|sorta|dunno|ain't)\b/gi, msg: 'Từ lóng/văn nói (không dùng trong Academic Writing)' },
    { re: /\b(kids|guys|stuff|things like that|tons of|a bunch of)\b/gi, msg: 'Từ vựng quá thông tục (nên đổi sang children, individuals, items, numerous)' },
    { re: /\b(can't|won't|don't|doesn't|didn't|isn't|aren't|wasn't|weren't|haven't|hasn't|shouldn't|wouldn't|couldn't|it's|that's|there's)\b/gi, msg: 'Dạng viết tắt (Academic Writing nên viết đầy đủ cannot, do not, it is...)' },
    { re: /!+/g, msg: 'Dấu chấm than (không dùng trong bài luận học thuật IELTS)' },
  ];

  // Vietnamese-learner high-frequency grammar error detectors
  const SHARED_GRAMMAR_PATTERNS = [
    {
      re: /\b(?:because|since|as)\b[^.!?;]{4,95},\s*\bso\b\b/gi,
      cat: 'GRA',
      issueVi: 'Lỗi kép "because/since ... , so ..." (ảnh hưởng tiếng Việt "vì... nên...") — tiếng Anh chỉ dùng 1 trong 2 từ nối.',
      tip: 'Bỏ "so" (giữ "because") hoặc bỏ "because" (giữ "so").',
    },
    {
      re: /\b(?:although|though|even though)\b[^.!?;]{4,95},\s*\bbut\b\b/gi,
      cat: 'GRA',
      issueVi: 'Lỗi kép "although/though ... , but ..." (ảnh hưởng tiếng Việt "mặc dù... nhưng...") — chỉ dùng 1 từ nối.',
      tip: 'Bỏ "but" sau dấu phẩy.',
    },
    {
      re: /\bdespite\s+of\b/gi,
      cat: 'GRA',
      issueVi: 'Sai cấu trúc "despite of" — dùng "despite + N/V-ing" hoặc "in spite of + N/V-ing".',
      tip: 'Đổi thành "despite" hoặc "in spite of".',
    },
    {
      re: /\bmore\s+(smart|good|bad|big|small|fast|slow|easy|hard|rich|poor|high|low|happy|cheap|strong|weak)\b/gi,
      cat: 'GRA',
      issueVi: 'Sai dạng so sánh hơn của tính từ ngắn (ví dụ "more smart" → "smarter", "more good" → "better").',
      tip: 'Dùng dạng so sánh chuẩn (-er / better / worse).',
    },
    {
      re: /\b(?:can|could|will|would|should|must|may|might)\s+(?:to\s+\w+|is|are|was|were|\w+ed|\w+ing)\b/gi,
      cat: 'GRA',
      issueVi: 'Sau động từ khuyết thiếu (can/should/will/must...) phải dùng động từ nguyên mẫu không "to" (bare infinitive).',
      tip: 'Chuyển động từ ngay sau modal về dạng nguyên mẫu.',
    },
    {
      re: /\bthere\s+(?:have|has)\s+(?:a|an|many|much|some|several|numerous|few)\b/gi,
      cat: 'GRA',
      issueVi: 'Lỗi dịch word-by-word "there have/has" (tiếng Việt "có...") — tiếng Anh phải dùng "there is/are".',
      tip: 'Đổi "there have/has" thành "there is/are".',
    },
    {
      re: /\b(?:is|are|was|were)\s+(?:agree|disagree|depend|consist|belong|happen|occur|exist|lack|stay|go|come|work|study|help)\b/gi,
      cat: 'GRA',
      issueVi: 'Dư trợ động từ "be" trước động từ thường chủ động (ví dụ "I am agree" → "I agree", "was stay" → "stayed").',
      tip: 'Bỏ "be" hoặc chia đúng dạng chủ động/tiếp diễn.',
    },
    {
      re: /\b(?:a|an)\s+(?:good\s+|bad\s+|useful\s+|important\s+)?(?:information|advice|news|equipment|homework|furniture|research|knowledge|evidence|progress)\b/gi,
      cat: 'LR',
      issueVi: 'Danh từ không đếm được (information/advice/news/research...) không dùng mạo từ "a/an" trực tiếp.',
      tip: 'Bỏ "a/an" hoặc dùng "a piece of ...".',
    },
    {
      re: /\b(?:my\s+parents|people|children|students|workers|employees|they|we)\s+(?:is|was|has)\b/gi,
      cat: 'GRA',
      issueVi: 'Sai hòa hợp chủ ngữ số nhiều – động từ số ít (ví dụ "parents was" → "parents were", "people is" → "people are").',
      tip: 'Đổi động từ sang dạng số nhiều (are / were / have).',
    },
    {
      re: /\b(?:he|she|it|this|everybody|everyone|nobody|government|society)\s+(?:are|were|have)\b/gi,
      cat: 'GRA',
      issueVi: 'Sai hòa hợp chủ ngữ số ít – động từ số nhiều.',
      tip: 'Đổi động từ sang dạng số ít (is / was / has).',
    },
    {
      re: /\b(?:i|he|she|we|they|people|students|children)\s+(?:am|is|are|was|were|feel|felt)\s+(?:very\s+|really\s+|so\s+)?(?:exciting|boring|interesting|tiring|confusing|surprising|disappointing)\b/gi,
      cat: 'LR',
      issueVi: 'Nhầm tính từ đuôi -ing (chỉ tính chất sự vật) với -ed (chỉ cảm xúc con người: excited, bored, interested, tired...).',
      tip: 'Đổi sang tính từ đuôi -ed khi mô tả cảm xúc con người.',
    },
    {
      re: /\bmake\s+(?:people|students|workers|children|us|them|him|her|me)\s+to\s+[a-z]+\b/gi,
      cat: 'GRA',
      issueVi: 'Cấu trúc "make + O + V (nguyên mẫu không to)", không dùng "make O to V".',
      tip: 'Bỏ "to" sau tân ngữ của "make".',
    },
    {
      re: /\bdiscuss\s+about\b|\bmention\s+about\b|\bemphasize\s+on\b|\bemphasise\s+on\b|\bapproach\s+to\s+(?:the|this|a)\s+\w+\s+problem/gi,
      cat: 'LR',
      issueVi: 'Dư giới từ sau ngoại động từ (discuss / mention / emphasize không đi kèm about/on).',
      tip: 'Bỏ giới từ thừa ngay sau động từ.',
    },
    {
      re: /\bvery\s+(?:unique|essential|vital|crucial|huge|enormous|perfect|impossible)\b/gi,
      cat: 'LR',
      issueVi: 'Sai kết hợp từ (collocation): không dùng "very" trước tính từ cực hạn (extreme adjectives).',
      tip: 'Bỏ "very" hoặc thay bằng "truly / utterly / genuinely".',
    },
  ];

  const COMPLEX_MARKERS = [
    /\b(although|though|even though|whereas|while|unless|provided that|whether|despite|in spite of)\b/i,
    /\b(which|who|whom|whose|whereby|in which|that\s+(?:is|are|was|were|can|could|will|would|may|might|has|have|had|leads?|causes?|creates?|allows?|enables?))\b/i,
    /\b(when|whenever|since|because|before|after|until|once|as soon as|so that)\s+[a-z]+\s+[a-z]+/i,
    /\b(if\s+[^,.]{4,60},\s*(?:they|we|it|people|governments?|companies|students|workers|this|that|there|he|she|i)\s+(?:will|would|could|may|might|can))\b/i,
    /,\s*(?:thereby\s+)?[a-z]{4,}ing\b/i, // participial clause ", leading to..." / ", thereby reducing..."
    /\b(not only\b.+\bbut also|the more\b.+\bthe more|had\s+\w+\s+\w+ed|were\s+\w+\s+to)\b/i,
  ];

  const ACADEMIC_LINKERS = [
    'however', 'nevertheless', 'nonetheless', 'consequently', 'therefore', 'thus', 'hence', 'thereby',
    'furthermore', 'moreover', 'additionally', 'in contrast', 'conversely', 'on the contrary',
    'for instance', 'for example', 'specifically', 'in particular', 'as a result', 'as a consequence',
    'subsequently', 'ultimately', 'meanwhile', 'similarly', 'likewise', 'admittedly', 'granted',
    'primarily', 'finally', 'in turn', 'whereas', 'although', 'while',
    'this approach', 'such developments', 'the former', 'the latter', 'this trend', 'these measures',
  ];

  const MECHANICAL_LINKERS = [
    'firstly', 'secondly', 'thirdly', 'lastly', 'in addition', 'moreover', 'furthermore',
    'on the one hand', 'on the other hand', 'in conclusion', 'to sum up', 'to conclude',
    'all in all', 'first of all',
  ];

  const SPOKEN_NATURAL_MARKERS = [
    'actually', 'honestly', 'frankly', 'looking back', 'to be honest', 'basically', 'well',
    'on top of that', 'what really stood out', 'at first', 'eventually', 'in the end',
    'as a matter of fact', 'believe it or not', 'the thing is', 'instead', 'meanwhile',
    'for instance', 'especially', 'overall', 'all in all', 'so anyway', 'you know', 'i mean',
  ];

  /* ================= HELPERS ================= */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Official IELTS Band Rounding:
   *   .25 -> .5 (round UP), .75 -> next whole (round UP)
   *   .125 -> .0 (down), .375 -> .5 (up), .625 -> .5 (down), .875 -> +1.0 (up)
   */
  function roundIeltsBand(rawAvg) {
    const n = Number(rawAvg);
    if (!Number.isFinite(n)) return 5.0;
    const clamped = Math.max(1.0, Math.min(9.0, n));
    // Add tiny epsilon so exact .25 and .75 always round UP to nearest 0.5
    return Math.min(9.0, Math.max(1.0, Math.round((clamped + 1e-9) * 2) / 2));
  }

  function clampIntBand(n, min = 1, max = 9) {
    const v = Math.round(Number(n));
    if (!Number.isFinite(v)) return 5;
    return Math.max(min, Math.min(max, v));
  }

  function tokenizeWords(text) {
    return (String(text || '').toLowerCase().match(/[a-z]+(?:'[a-z]+)?/g) || []);
  }

  function extractContentTokens(text) {
    return tokenizeWords(text).filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
  }

  function splitSentences(text) {
    return String(text || '')
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => tokenizeWords(s).length >= 3);
  }

  function detectSpamOrGibberish(text) {
    const words = tokenizeWords(text);
    if (words.length < 12) return { isSpam: true, reason: 'Bài làm quá ngắn (< 12 từ).' };
    // Repeated single word spam (e.g. "good good good good...")
    const freq = {};
    words.forEach((w) => { freq[w] = (freq[w] || 0) + 1; });
    const topWord = Object.entries(freq).sort((a, b) => b[1] - a[1])[0];
    if (topWord && topWord[1] / words.length > 0.34 && words.length >= 15) {
      return { isSpam: true, reason: `Phát hiện lặp từ bất thường ("${topWord[0]}" lặp ${topWord[1]} lần).` };
    }
    // Consecutive 3-word spam loop
    if (/\b(\w+(?:\s+\w+){0,3})(?:\s+\1){3,}\b/i.test(text)) {
      return { isSpam: true, reason: 'Phát hiện lặp đi lặp lại cùng một cụm từ (spam).' };
    }
    // Vowel-less keyboard mash check
    const gibberishWords = words.filter((w) => w.length >= 5 && !/[aeiouy]/i.test(w));
    if (gibberishWords.length >= Math.max(3, Math.ceil(words.length * 0.12))) {
      return { isSpam: true, reason: 'Phát hiện nhiều chuỗi ký tự vô nghĩa (gõ phím ngẫu nhiên).' };
    }
    // Very low lexical uniqueness on longer texts
    const uniqRatio = new Set(words).size / words.length;
    if (words.length >= 40 && uniqRatio < 0.22) {
      return { isSpam: true, reason: 'Mật độ lặp từ quá cao — thiếu nội dung diễn đạt thực tế.' };
    }
    return { isSpam: false, reason: '' };
  }

  function computeNgramOverlap(studentText, refText) {
    const sToks = tokenizeWords(studentText);
    const rToks = tokenizeWords(refText);
    if (sToks.length < 6 || rToks.length < 6) return 0;
    const ref4 = new Set();
    for (let i = 0; i <= rToks.length - 4; i++) {
      ref4.add(rToks.slice(i, i + 4).join(' '));
    }
    let copied = 0;
    const total = Math.max(1, sToks.length - 3);
    for (let i = 0; i <= sToks.length - 4; i++) {
      if (ref4.has(sToks.slice(i, i + 4).join(' '))) copied++;
    }
    return +(copied / total).toFixed(3);
  }

  function detectPromptParts(promptText, essayType) {
    const p = String(promptText || '').toLowerCase();
    const t = String(essayType || '').toLowerCase();
    const qMarks = (p.match(/\?/g) || []).length;
    if (t.includes('two-part') || t.includes('two part') || qMarks >= 2) {
      return { type: 'two-part', requiredParts: 2, label: 'Đề 2 câu hỏi (phải trả lời đủ cả 2 vế)' };
    }
    if (t.includes('discuss') || p.includes('discuss both')) {
      return { type: 'discuss-both', requiredParts: 3, label: 'Discuss both views + Opinion (2 quan điểm + ý kiến cá nhân)' };
    }
    if (t.includes('cause') || t.includes('problem') || (p.includes('causes') && p.includes('solutions')) || (p.includes('reasons') && p.includes('solutions'))) {
      return { type: 'problem-solution', requiredParts: 2, label: 'Nguyên nhân/Vấn đề + Giải pháp (phải đủ 2 vế)' };
    }
    if (t.includes('advantage') || p.includes('outweigh') || (p.includes('advantages') && p.includes('disadvantages'))) {
      return { type: 'advantage-disadvantage', requiredParts: 2, label: 'Ưu điểm & Nhược điểm (cần cân nhắc cả 2 mặt)' };
    }
    return { type: 'opinion', requiredParts: 1, label: 'Opinion / Agree-Disagree (cần lập trường nhất quán xuyên suốt)' };
  }

  function detectGrammarAndTypos(text, isSpoken) {
    const issues = [];
    const seen = new Set();

    // 1. High-confidence grammar & collocation patterns
    SHARED_GRAMMAR_PATTERNS.forEach((rule) => {
      const m = String(text || '').match(rule.re);
      if (m) {
        m.slice(0, 2).forEach((hit) => {
          const key = `${rule.cat}:${hit.toLowerCase().trim()}`;
          if (seen.has(key)) return;
          seen.add(key);
          issues.push({
            original: hit.trim(),
            category: rule.cat,
            issueVi: rule.issueVi,
            fix: rule.tip,
          });
        });
      }
    });

    // 2. Writing-only rules (spelling typos, informal tone, comma splices, lowercase sentence start)
    if (!isSpoken) {
      const words = tokenizeWords(text);
      const typoSeen = new Set();
      words.forEach((w) => {
        if (COMMON_TYPOS[w] && !typoSeen.has(w)) {
          typoSeen.add(w);
          issues.push({
            original: w,
            category: 'LR',
            issueVi: `Lỗi chính tả tiếng Anh ("${w}").`,
            fix: COMMON_TYPOS[w],
          });
        }
      });

      INFORMAL_WRITING_REGEX.forEach((rule) => {
        const m = String(text || '').match(rule.re);
        if (m) {
          const hit = m[0];
          const key = `INF:${hit.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            issues.push({
              original: hit,
              category: 'LR',
              issueVi: rule.msg,
              fix: 'Chuyển sang văn phong học thuật trang trọng hơn.',
            });
          }
        }
      });

      // Comma splice check: ", however," or ", therefore," without semicolon/period
      const spliceMatches = String(text || '').match(/[a-z]{3,},\s*(?:however|therefore|moreover|furthermore|consequently)\s*,/gi) || [];
      spliceMatches.slice(0, 2).forEach((hit) => {
        issues.push({
          original: hit.trim(),
          category: 'GRA',
          issueVi: 'Lỗi dấu câu (comma splice): trước "however / therefore / consequently..." nối 2 mệnh đề độc lập cần dấu chấm (.) hoặc chấm phẩy (;).',
          fix: hit.replace(',', ';'),
        });
      });
    }

    return issues;
  }

  /* =========================================================================
     1. OBJECTIVE TELEMETRY EXTRACTORS (CODE COUNTS EVERYTHING — NEVER LLM)
     ========================================================================= */

  function analyzeWritingTelemetry(text, promptText, opts = {}) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    const words = tokenizeWords(raw);
    const wordCount = words.length;
    const paragraphs = raw.split(/\n\s*\n+|\r?\n/).map((p) => p.trim()).filter((p) => tokenizeWords(p).length >= 5);
    const paragraphCount = Math.max(wordCount > 0 ? 1 : 0, paragraphs.length);
    const sentences = splitSentences(raw);
    const sentenceCount = Math.max(wordCount > 0 ? 1 : 0, sentences.length);
    const avgSentenceLen = +(wordCount / sentenceCount).toFixed(1);

    const uniqueWords = new Set(words).size;
    // Root-TTR (Guiraud's index) is much more length-stable than plain TTR
    const ttr = wordCount ? +(uniqueWords / wordCount).toFixed(3) : 0;
    const guiraud = wordCount ? +(uniqueWords / Math.sqrt(wordCount)).toFixed(2) : 0;

    // Advanced/academic word density (words >= 7 chars not in stopwords)
    const longContentWords = words.filter((w) => w.length >= 7 && !STOP_WORDS.has(w));
    const uniqueLongWords = new Set(longContentWords).size;
    const longWordRatio = wordCount ? +(uniqueLongWords / Math.max(1, Math.sqrt(wordCount) * 4)).toFixed(2) : 0;

    // Topic relevance against prompt + optional curriculum keywords
    const promptContent = new Set(extractContentTokens(`${promptText || ''} ${opts.curriculumKeywords || ''}`));
    const studentContent = new Set(extractContentTokens(raw));
    let topicHits = 0;
    promptContent.forEach((tok) => {
      const stem = tok.slice(0, Math.max(4, tok.length - 2));
      for (const st of studentContent) {
        if (st === tok || st.startsWith(stem) || tok.startsWith(st.slice(0, Math.max(4, st.length - 2)))) {
          topicHits++;
          break;
        }
      }
    });
    const topicOverlapRatio = promptContent.size ? +(topicHits / Math.min(12, promptContent.size)).toFixed(2) : 1;

    const promptCopyRatio = computeNgramOverlap(raw, promptText || '');
    const clicheHits = WRITING_CLICHES.filter((c) => low.includes(c));
    const academicLinkerHits = ACADEMIC_LINKERS.filter((l) => low.includes(l));
    const mechanicalLinkerHits = MECHANICAL_LINKERS.filter((l) => low.includes(l));

    let complexSentenceCount = 0;
    sentences.forEach((s) => {
      if (COMPLEX_MARKERS.some((re) => re.test(s))) complexSentenceCount++;
    });
    const complexSentenceRatio = sentenceCount ? +(complexSentenceCount / sentenceCount).toFixed(2) : 0;

    const grammarIssues = detectGrammarAndTypos(raw, false);
    const spellingTypos = grammarIssues.filter((i) => i.issueVi.includes('chính tả')).map((i) => i.original);
    const informalCount = grammarIssues.filter((i) => i.issueVi.includes('thông tục') || i.issueVi.includes('văn nói') || i.issueVi.includes('viết tắt') || i.issueVi.includes('chấm than')).length;

    // Estimate error-free sentence ratio
    const errSentences = Math.min(sentenceCount, grammarIssues.length);
    const estimatedErrorFreeRatio = sentenceCount ? +Math.max(0, (sentenceCount - errSentences) / sentenceCount).toFixed(2) : 0;

    const spam = detectSpamOrGibberish(raw);
    const promptSpec = detectPromptParts(promptText, opts.essayType);

    // Optional curriculum vocab & grammar checks for Task Test 3
    const vocabHits = Array.isArray(opts.targetVocab)
      ? opts.targetVocab.filter((ph) => low.includes(String(ph || '').toLowerCase())).length
      : null;
    const grammarHits = Array.isArray(opts.targetGrammar)
      ? opts.targetGrammar.filter((g) => low.includes(String(g || '').toLowerCase())).length
      : null;

    return {
      mode: opts.mode === 'body' ? 'body' : 'essay',
      wordCount,
      paragraphCount,
      sentenceCount,
      avgSentenceLen,
      uniqueWords,
      ttr,
      guiraud,
      uniqueLongWords,
      longWordRatio,
      topicHits,
      topicOverlapRatio,
      promptCopyRatio,
      clicheHits,
      academicLinkerCount: academicLinkerHits.length,
      mechanicalLinkerCount: mechanicalLinkerHits.length,
      complexSentenceCount,
      complexSentenceRatio,
      spellingTypos,
      informalCount,
      detectedIssueCount: grammarIssues.length,
      grammarIssues,
      estimatedErrorFreeRatio,
      isSpam: spam.isSpam,
      spamReason: spam.reason,
      promptSpec,
      vocabHits,
      grammarHits,
    };
  }

  function analyzeSpeakingTelemetry(text, acoustic = {}, cueCard = {}) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    const words = tokenizeWords(raw);
    const wordCount = words.length;
    const hasAudio = Boolean(acoustic && (acoustic.hasAudio || acoustic.audioUrl || (Array.isArray(acoustic.words) && acoustic.words.length > 0)));
    const durationSec = Math.max(
      1,
      Math.round(Number(acoustic?.durationSec) || Math.max(12, wordCount / 2.2))
    );
    const wpm = Math.round((wordCount / durationSec) * 60);

    // Whisper word-level acoustic pause & articulation analysis (ETS SpeechRater / Cambridge ALTA features)
    const wordStamps = Array.isArray(acoustic?.words) ? acoustic.words : [];
    const segments = Array.isArray(acoustic?.segments) ? acoustic.segments : [];
    let silentPausesOver1_2s = 0;
    let midClausePauses = 0;
    let longestPauseSec = 0;
    let totalPauseSec = 0;

    if (wordStamps.length >= 2) {
      for (let i = 1; i < wordStamps.length; i++) {
        const prev = wordStamps[i - 1];
        const curr = wordStamps[i];
        const gap = Number(curr.s) - Number(prev.e);
        if (gap > 0.35) totalPauseSec += gap;
        if (gap > longestPauseSec) longestPauseSec = gap;
        if (gap >= 1.2) {
          silentPausesOver1_2s++;
          const prevWord = String(prev.w || '').trim();
          // Pause not following terminal punctuation = likely mid-clause hesitation
          if (!/[.!?]$/.test(prevWord)) midClausePauses++;
        }
      }
    }

    const phonationSec = Math.max(1, durationSec - totalPauseSec);
    const articulationRateWpm = wordStamps.length >= 2 ? Math.round((wordCount / phonationSec) * 60) : wpm;
    const pausesPerMin = +((silentPausesOver1_2s / Math.max(15, durationSec)) * 60).toFixed(1);

    // Whisper segment acoustic confidence (`avgLogprob`: closer to 0 is clearer; -0.15..-0.35 very clear, <-0.75 unclear/mumbled)
    let whisperAvgLogprob = null;
    let whisperPronEstBand = null;
    if (segments.length > 0) {
      const validSegs = segments.filter((s) => Number.isFinite(Number(s.avgLogprob)) && Number(s.avgLogprob) < 0);
      if (validSegs.length > 0) {
        const meanLp = validSegs.reduce((acc, s) => acc + Number(s.avgLogprob), 0) / validSegs.length;
        whisperAvgLogprob = +meanLp.toFixed(3);
        // Conservative acoustic clarity mapping (never inflates to 9 purely from Whisper)
        if (meanLp >= -0.22) whisperPronEstBand = 8;
        else if (meanLp >= -0.34) whisperPronEstBand = 7;
        else if (meanLp >= -0.50) whisperPronEstBand = 6;
        else if (meanLp >= -0.72) whisperPronEstBand = 5;
        else whisperPronEstBand = 4;
      }
    } else if (hasAudio) {
      // Audio exists (e.g., CF AI fallback without avgLogprob): conservative baseline from rate & completeness
      whisperPronEstBand = wpm >= 105 && wpm <= 185 ? 6 : 5;
    }

    // Hesitation fillers (true filled pauses vs conversational markers)
    const filledPauses = (raw.match(/\b(um+|uh+|er+|erm+|hmm+|ah+)\b/gi) || []).length;
    const softFillers = (raw.match(/\b(like|you know|actually|basically)\b/gi) || []).length;
    const fillerCount = filledPauses + softFillers;
    const filledPausePct = wordCount ? +((filledPauses / wordCount) * 100).toFixed(1) : 0;
    const totalFillerPct = wordCount ? +((fillerCount / wordCount) * 100).toFixed(1) : 0;

    // Spoken repetition / stuttering detection ("I I", "the the", "and and")
    const stutterCount = (raw.match(/\b([a-z]{1,10})\s+\1\b/gi) || []).length;

    const spokenMarkerHits = SPOKEN_NATURAL_MARKERS.filter((m) => low.includes(m));
    const uniqueWords = new Set(words).size;
    const ttr = wordCount ? +(uniqueWords / wordCount).toFixed(3) : 0;
    const guiraud = wordCount ? +(uniqueWords / Math.sqrt(wordCount)).toFixed(2) : 0;

    const sentences = splitSentences(raw);
    const sentenceCount = Math.max(1, sentences.length);
    let complexClauseCount = 0;
    sentences.forEach((s) => {
      if (COMPLEX_MARKERS.some((re) => re.test(s))) complexClauseCount++;
    });

    // Spoken-appropriate grammar check ONLY (no spelling/punctuation/contraction penalty)
    const grammarIssues = detectGrammarAndTypos(raw, true);

    // Cue Card topic + bullet coverage
    const bullets = Array.isArray(cueCard?.bullets) ? cueCard.bullets : [];
    const studentContent = new Set(extractContentTokens(raw));
    const cueAllContent = new Set(extractContentTokens(`${cueCard?.title || ''} ${bullets.join(' ')} ${cueCard?.curriculumKeywords || ''}`));
    let topicHits = 0;
    cueAllContent.forEach((tok) => {
      const stem = tok.slice(0, Math.max(4, tok.length - 2));
      for (const st of studentContent) {
        if (st === tok || st.startsWith(stem)) {
          topicHits++;
          break;
        }
      }
    });
    const topicOverlapRatio = cueAllContent.size ? +(topicHits / Math.min(10, cueAllContent.size)).toFixed(2) : 1;

    // Heuristic bullet check (for offline fallback & pre-check)
    const missedBullets = [];
    let coveredBullets = 0;
    bullets.forEach((b) => {
      const bLow = String(b || '').toLowerCase();
      const bToks = extractContentTokens(bLow);
      let ok = bToks.some((t) => low.includes(t.slice(0, Math.max(4, t.length - 2))));
      if (!ok && /\bwho\b/.test(bLow)) ok = /\b(grandfather|grandmother|teacher|friend|person|parent|mother|father|mentor|man|woman|he|she|retired|neighbour|neighbor)\b/.test(low);
      if (!ok && /\bhow you know|how long|met|relationship\b/.test(bLow)) ok = /\b(grandfather|grandmother|family|parents|neighbour|neighbor|friend|school|classmate|met|know|knew|years|grew up|younger|childhood|next door|every afternoon)\b/.test(low);
      if (!ok && /\bwhat kind|personality|qualities|traits|look like|character\b/.test(bLow)) ok = /\b(calm|patient|kind|warm|gentle|silver|smile|wise|strict|funny|friendly|helpful|generous|humble|empathetic|honest|hardworking|character|nature|personality|retired|teacher)\b/.test(low);
      if (!ok && /\bwhat\b/.test(bLow)) ok = /\b(taught|told|helped|explained|invited|whispered|advised|learned|happened|mistake|skill|news|problem|steps|studied|worked|missed|hospital|maths|lesson|advice)\b/.test(low);
      if (!ok && /\bwhen|where\b/.test(bLow)) ok = /\b(ago|year|years|month|grade|school|back in|when i was|last|home|house|weekend|afternoon|childhood|secondary)\b/.test(low);
      if (!ok && /\bfeel|felt|explain|why|admire|respect|learn|useful|important\b/.test(bLow)) ok = /\b(because|since|feel|felt|admire|respect|taught|learned|lesson|grateful|proud|helped|useful|important|looking back|role model|example)\b/.test(low);
      if (ok) coveredBullets++;
      else missedBullets.push(b);
    });

    const spam = detectSpamOrGibberish(raw);

    return {
      wordCount,
      durationSec,
      hasAudio,
      wpm,
      articulationRateWpm,
      silentPausesOver1_2s,
      midClausePauses,
      pausesPerMin,
      longestPauseSec: +longestPauseSec.toFixed(2),
      whisperAvgLogprob,
      whisperPronEstBand,
      filledPauses,
      fillerCount,
      filledPausePct,
      totalFillerPct,
      stutterCount,
      spokenMarkerCount: spokenMarkerHits.length,
      uniqueWords,
      ttr,
      guiraud,
      sentenceCount,
      complexClauseCount,
      detectedIssueCount: grammarIssues.length,
      grammarIssues,
      topicHits,
      topicOverlapRatio,
      cueBulletsTotal: bullets.length,
      cueBulletsCoveredHeuristic: coveredBullets,
      missedBullets,
      isSpam: spam.isSpam,
      spamReason: spam.reason,
    };
  }

  /* =========================================================================
     2. DETERMINISTIC CODE-ENFORCED EXAMINER CEILING GATES (ANTI-INFLATION)
     ========================================================================= */

  function applyWritingExaminerCaps(grade, tel, opts = {}) {
    const isBody = (opts.mode || tel.mode) === 'body';
    const c = grade.criteria;
    const ck = grade.checklist || {};
    let tr = clampIntBand(c.tr?.band);
    let cc = clampIntBand(c.cc?.band);
    let lr = clampIntBand(c.lr?.band);
    let gra = clampIntBand(c.gra?.band);
    const caps = [];

    const capCrit = (name, val, limit, reason, alwaysLog) => {
      if (val > limit || (alwaysLog && val >= limit)) {
        if (!caps.includes(reason)) caps.push(reason);
        return Math.min(val, limit);
      }
      return val;
    };

    // 1. Spam / Gibberish / Copied prompt
    if (tel.isSpam) {
      tr = Math.min(tr, 2); cc = Math.min(cc, 2); lr = Math.min(lr, 2); gra = Math.min(gra, 2);
      caps.push(`Khóa trần ≤ 2.0: ${tel.spamReason}`);
    } else if (tel.promptCopyRatio >= 0.42 && tel.wordCount < 140) {
      tr = capCrit('TR', tr, 2, 'TR ≤ 2.0: Sao chép nguyên văn đề bài quá nhiều.', true);
      lr = Math.min(lr, 3);
      gra = Math.min(gra, 3);
    }

    // 2. Off-topic / Missing prompt parts (May 2023 TR ceiling rules)
    if (ck.offTopicSeverity === 'full' || (tel.topicOverlapRatio < 0.08 && tel.wordCount >= 35 && ck.offTopicSeverity !== 'none')) {
      tr = capCrit('TR', tr, 2, 'TR ≤ 2.0: Bài viết lạc đề hoàn toàn so với câu hỏi.', true);
      cc = Math.min(cc, 5);
    } else if (ck.offTopicSeverity === 'partial') {
      tr = capCrit('TR', tr, 5, 'TR ≤ 5.0: Bài viết bị lệch trọng tâm hoặc mới chạm một phần đề.', true);
    }

    if (!isBody && ck.answersAllPromptParts === false) {
      tr = capCrit('TR', tr, 5, `TR ≤ 5.0: Chưa trả lời đủ mọi vế đề (${tel.promptSpec?.label || 'thiếu ý bắt buộc'}).`, true);
    }
    if (!isBody && ck.clearPositionThroughout === false) {
      tr = capCrit('TR', tr, 6, 'TR ≤ 6.0: Quan điểm (position) chưa rõ ràng xuyên suốt bài.');
    }

    // 3. Length evidence ceilings (May 2023: insufficient evidence caps TR/LR/GRA)
    if (isBody) {
      if (tel.wordCount < 45) {
        tr = capCrit('TR', tr, 4, `TR ≤ 4.0: Đoạn Body quá ngắn (${tel.wordCount} từ, cần ≥ 85 từ).`, true);
        lr = Math.min(lr, 5); gra = Math.min(gra, 5);
      } else if (tel.wordCount < 75) {
        tr = capCrit('TR', tr, 5, `TR ≤ 5.0: Đoạn Body chưa đủ độ sâu (${tel.wordCount} từ, mục tiêu 90–140 từ).`, true);
        lr = Math.min(lr, 6); gra = Math.min(gra, 6);
      } else if (tel.wordCount < 85) {
        tr = capCrit('TR', tr, 6, `TR ≤ 6.0: Đoạn Body hơi ngắn (${tel.wordCount}/85+ từ).`, true);
      }
    } else {
      if (tel.wordCount < 80) {
        tr = capCrit('TR', tr, 3, `TR ≤ 3.0: Bài Essay quá ngắn (${tel.wordCount}/250 từ) — không đủ bằng chứng chấm.`, true);
        cc = Math.min(cc, 4); lr = Math.min(lr, 4); gra = Math.min(gra, 4);
      } else if (tel.wordCount < 150) {
        tr = capCrit('TR', tr, 4, `TR ≤ 4.0: Thiếu độ dài nghiêm trọng (${tel.wordCount}/250 từ).`, true);
        lr = Math.min(lr, 5); gra = Math.min(gra, 5);
      } else if (tel.wordCount < 215) {
        tr = capCrit('TR', tr, 5, `TR ≤ 5.0: Chưa đạt 250 từ (${tel.wordCount} từ) — giới hạn khả năng phát triển ý.`, true);
        lr = Math.min(lr, 6); gra = Math.min(gra, 6);
      } else if (tel.wordCount < 245) {
        tr = capCrit('TR', tr, 6, `TR ≤ 6.0: Hơi thiếu ngưỡng 250 từ (${tel.wordCount} từ).`, true);
      }
    }

    // 4. Paragraphing & Cohesion ceilings (Full Essay)
    if (!isBody && tel.wordCount >= 120 && tel.paragraphCount < 2) {
      cc = capCrit('CC', cc, 5, 'CC ≤ 5.0: Viết thành 1 khối duy nhất, chưa chia đoạn (Intro / Body / Conclusion).', true);
    } else if (!isBody && tel.wordCount >= 180 && tel.paragraphCount < 3) {
      cc = capCrit('CC', cc, 6, `CC ≤ 6.0: Mới có ${tel.paragraphCount} đoạn — bài IELTS Task 2 chuẩn cần 4–5 đoạn rõ ràng.`, true);
    }

    if (ck.logicGapsFound === true && tr > 6) {
      tr = capCrit('TR', tr, 6, 'TR ≤ 6.0: Phát hiện bước nhảy logic hoặc luận điểm chưa giải thích cơ chế A → B → C.');
    }

    // 5. Template / Thesaurus stuffing & Informal register ceilings
    if (ck.templateStuffingDetected === true || tel.clicheHits.length >= 2) {
      cc = capCrit('CC', cc, 6, 'CC ≤ 6.0: Dùng cụm khuôn mẫu/template sáo rỗng gượng ép.');
      lr = capCrit('LR', lr, 6, 'LR ≤ 6.0: Cụm từ học thuộc kém tự nhiên.');
    }
    if (ck.informalToneDetected === true || tel.informalCount >= 2) {
      lr = capCrit('LR', lr, 6, 'LR ≤ 6.0: Còn dùng từ văn nói/viết tắt không hợp văn phong học thuật.');
    }
    if (tel.spellingTypos.length >= 3) {
      lr = capCrit('LR', lr, 5, `LR ≤ 5.0: Nhiều lỗi chính tả (${tel.spellingTypos.slice(0, 3).join(', ')}).`);
    } else if (tel.spellingTypos.length >= 1) {
      lr = capCrit('LR', lr, 7, `LR ≤ 7.0: Còn lỗi chính tả (${tel.spellingTypos.join(', ')}).`);
    }

    // 6. Grammatical Range & Accuracy ratio ceilings
    const efRatio = Number.isFinite(Number(ck.errorFreeSentenceRatio))
      ? Math.min(Number(ck.errorFreeSentenceRatio), tel.estimatedErrorFreeRatio + 0.15)
      : tel.estimatedErrorFreeRatio;
    if (efRatio < 0.35 || tel.detectedIssueCount >= 6) {
      gra = capCrit('GRA', gra, 5, 'GRA ≤ 5.0: Mật độ lỗi ngữ pháp dày (dưới 35% câu không lỗi).');
    } else if (efRatio < 0.58 || tel.detectedIssueCount >= 3) {
      gra = capCrit('GRA', gra, 6, 'GRA ≤ 6.0: Tỷ lệ câu không lỗi chưa đạt ngưỡng Band 7.');
    } else if (efRatio < 0.78 || tel.detectedIssueCount >= 1) {
      gra = capCrit('GRA', gra, 7, 'GRA ≤ 7.0: Còn lỗi ngữ pháp tồn đọng nên chưa lên được Band 8.');
    }
    if (tel.complexSentenceCount === 0 && tel.sentenceCount >= 3) {
      gra = capCrit('GRA', gra, 5, 'GRA ≤ 5.0: Toàn bộ là câu đơn, thiếu cấu trúc câu phức.');
    }

    // Merge code-detected high-confidence errors that AI might have missed
    const mergedErrors = [...(grade.errors || [])];
    (tel.grammarIssues || []).forEach((gi) => {
      const dup = mergedErrors.some((e) => e.original.toLowerCase().includes(gi.original.toLowerCase().slice(0, 12)));
      if (!dup && mergedErrors.length < 8) mergedErrors.push(gi);
    });

    const overall = roundIeltsBand((tr + cc + lr + gra) / 4);

    return {
      skill: 'writing',
      mode: isBody ? 'body' : 'essay',
      overall,
      criteria: {
        tr: { label: 'Task Response', short: 'TR', band: tr, commentVi: c.tr?.commentVi || '' },
        cc: { label: 'Coherence & Cohesion', short: 'CC', band: cc, commentVi: c.cc?.commentVi || '' },
        lr: { label: 'Lexical Resource', short: 'LR', band: lr, commentVi: c.lr?.commentVi || '' },
        gra: { label: 'Grammar Range & Accuracy', short: 'GRA', band: gra, commentVi: c.gra?.commentVi || '' },
      },
      capsApplied: caps,
      errors: mergedErrors,
      topUpgradesVi: grade.topUpgradesVi || [],
      overallCommentVi: grade.overallCommentVi || '',
      telemetry: tel,
      checklist: ck,
      evidence: grade.evidence || {},
    };
  }

  function applySpeakingExaminerCaps(grade, tel) {
    const c = grade.criteria;
    const ck = grade.checklist || {};
    let fc = clampIntBand(c.fc?.band);
    let lr = clampIntBand(c.lr?.band);
    let gra = clampIntBand(c.gra?.band);
    let pr = tel.hasAudio
      ? (c.pr?.band != null ? clampIntBand(c.pr.band) : (tel.whisperPronEstBand || 6))
      : null;
    const caps = [];

    const capCrit = (val, limit, reason) => {
      if (val > limit) {
        caps.push(reason);
        return limit;
      }
      return val;
    };

    // 1. Spam / gibberish
    if (tel.isSpam) {
      fc = Math.min(fc, 2); lr = Math.min(lr, 2); gra = Math.min(gra, 2);
      if (pr != null) pr = Math.min(pr, 3);
      caps.push(`Khóa trần ≤ 2.0: ${tel.spamReason}`);
    }

    // 2. Part 2 Long Turn duration & word-count ceilings
    if (tel.wordCount < 55 || (tel.hasAudio && tel.durationSec < 32)) {
      fc = capCrit(fc, 4, `FC ≤ 4.0: Bài nói Part 2 quá ngắn (${tel.wordCount} từ / ${tel.durationSec}s, mục tiêu 90–120s).`);
      lr = Math.min(lr, 5); gra = Math.min(gra, 5);
    } else if (tel.wordCount < 90 || (tel.hasAudio && tel.durationSec < 52)) {
      fc = capCrit(fc, 5, `FC ≤ 5.0: Thời lượng nói chưa đủ dài (${tel.wordCount} từ / ${tel.durationSec}s — Part 2 cần tối thiểu ~1 phút+).`);
      lr = Math.min(lr, 6); gra = Math.min(gra, 6);
    } else if (tel.wordCount < 130 || (tel.hasAudio && tel.durationSec < 72)) {
      fc = capCrit(fc, 6, `FC ≤ 6.0: Bài nói hơi ngắn so với chuẩn Part 2 1.5–2 phút (${tel.wordCount} từ / ${tel.durationSec}s).`);
    }

    // 3. Off-topic / Missing Cue Card bullets
    if (ck.offTopicSeverity === 'full' || (tel.topicOverlapRatio < 0.08 && tel.wordCount >= 40 && ck.offTopicSeverity !== 'none')) {
      fc = capCrit(fc, 4, 'FC ≤ 4.0: Nội dung nói bị lạc đề so với Cue Card.');
    } else if (ck.offTopicSeverity === 'partial') {
      fc = capCrit(fc, 5, 'FC ≤ 5.0: Nội dung nói mới bám một phần yêu cầu Cue Card.');
    }
    const bulletsTotal = Number(ck.cueBulletsTotal || tel.cueBulletsTotal || 0);
    const bulletsCov = Number.isFinite(Number(ck.cueBulletsCoveredCount))
      ? Number(ck.cueBulletsCoveredCount)
      : tel.cueBulletsCoveredHeuristic;
    if (bulletsTotal >= 3 && bulletsTotal - bulletsCov >= 2) {
      fc = capCrit(fc, 5, `FC ≤ 5.0: Bỏ sót ${bulletsTotal - bulletsCov}/${bulletsTotal} gạch đầu dòng trên Cue Card.`);
    }

    // 4. Acoustic hesitation / pause / filler ceilings
    if (tel.hasAudio && tel.pausesPerMin > 6) {
      fc = capCrit(fc, 5, `FC ≤ 5.0: Dừng ngập ngừng lâu (>1.2s) quá dày (${tel.silentPausesOver1_2s} lần, ~${tel.pausesPerMin} lần/phút).`);
    } else if (tel.hasAudio && tel.pausesPerMin > 3.5) {
      fc = capCrit(fc, 6, `FC ≤ 6.0: Còn nhiều khoảng ngập ngừng dài (${tel.silentPausesOver1_2s} lần > 1.2s).`);
    }
    if (tel.filledPausePct > 8 || tel.totalFillerPct > 12 || ck.heavyHesitationOrRepetition === true) {
      fc = capCrit(fc, 5, `FC ≤ 5.0: Tần suất từ đệm/ngập ngừng quá dày (${tel.fillerCount} lần).`);
    }
    if (tel.hasAudio && (tel.wpm < 80 || tel.wpm > 210)) {
      fc = capCrit(fc, 6, `FC ≤ 6.0: Tốc độ nói chưa tự nhiên (${tel.wpm} WPM; chuẩn tự nhiên ~115–165 WPM).`);
    }

    // 5. Spoken grammar ceilings
    const efRatio = Number.isFinite(Number(ck.errorFreeUtteranceRatio))
      ? Number(ck.errorFreeUtteranceRatio)
      : Math.max(0.2, 1 - tel.detectedIssueCount / Math.max(3, tel.sentenceCount));
    if (efRatio < 0.35 || tel.detectedIssueCount >= 5) {
      gra = capCrit(gra, 5, 'GRA ≤ 5.0: Nhiều lỗi ngữ pháp văn nói (chia thì / S-V / cấu trúc câu).');
    } else if (efRatio < 0.58 || tel.detectedIssueCount >= 3 || ck.narrativeTenseConsistent === false) {
      gra = capCrit(gra, 6, 'GRA ≤ 6.0: Còn lỗi chia thì kể chuyện hoặc cấu trúc câu phức chưa chắc.');
    } else if (efRatio < 0.78 || tel.detectedIssueCount >= 1) {
      gra = capCrit(gra, 7, 'GRA ≤ 7.0: Còn sót lỗi ngữ pháp nhỏ khi nói.');
    }

    // 6. Honest Pronunciation bounding against Whisper acoustic clarity
    if (tel.hasAudio && pr != null && tel.whisperPronEstBand != null) {
      const maxAllowedPr = Math.min(8, tel.whisperPronEstBand + 1);
      const minAllowedPr = Math.max(4, tel.whisperPronEstBand - 1);
      if (pr > maxAllowedPr) {
        caps.push(`PR ≤ ${maxAllowedPr}.0: Độ rõ âm học Whisper (avgLogprob ${tel.whisperAvgLogprob ?? 'N/A'}) chưa đạt mức cao hơn.`);
        pr = maxAllowedPr;
      } else if (pr < minAllowedPr) {
        pr = minAllowedPr;
      }
    }

    const mergedErrors = [...(grade.errors || [])];
    (tel.grammarIssues || []).forEach((gi) => {
      const dup = mergedErrors.some((e) => e.original.toLowerCase().includes(gi.original.toLowerCase().slice(0, 12)));
      if (!dup && mergedErrors.length < 8) mergedErrors.push(gi);
    });

    const scoredVals = pr != null ? [fc, lr, gra, pr] : [fc, lr, gra];
    const overall = roundIeltsBand(scoredVals.reduce((a, b) => a + b, 0) / scoredVals.length);

    return {
      skill: 'speaking',
      overall,
      criteria: {
        fc: { label: 'Fluency & Coherence', short: 'FC', band: fc, commentVi: c.fc?.commentVi || '' },
        lr: { label: 'Lexical Resource', short: 'LR', band: lr, commentVi: c.lr?.commentVi || '' },
        gra: { label: 'Grammar Range & Accuracy', short: 'GRA', band: gra, commentVi: c.gra?.commentVi || '' },
        pr: {
          label: tel.hasAudio ? 'Pronunciation (STT Acoustic)' : 'Pronunciation (Chưa ghi âm)',
          short: 'PR',
          band: pr,
          commentVi: c.pr?.commentVi || (tel.hasAudio
            ? 'Ước lượng độ rõ phát âm dựa trên độ tin cậy âm học Whisper & nhịp nói (không trừ điểm giọng địa phương nếu rõ ràng).'
            : 'Bạn dùng chế độ Gõ chữ nên hệ thống không chấm khống Pronunciation — hãy dùng Mic ghi âm để chấm đủ 4 tiêu chí.'),
        },
      },
      capsApplied: caps,
      errors: mergedErrors,
      topUpgradesVi: grade.topUpgradesVi || [],
      overallCommentVi: grade.overallCommentVi || '',
      telemetry: tel,
      checklist: ck,
      evidence: grade.evidence || {},
    };
  }

  /* =========================================================================
     3. CALIBRATED OFFLINE FALLBACK ENGINE (STRICT CAMBRIDGE SCALE)
     ========================================================================= */

  function gradeWritingLocal(payload, tel) {
    const isBody = tel.mode === 'body';

    // Base Task Response
    let tr = 6;
    if (tel.isSpam) tr = 2;
    else if (tel.topicOverlapRatio < 0.08) tr = 2;
    else if (isBody) {
      if (tel.wordCount >= 105 && tel.topicOverlapRatio >= 0.25 && tel.complexSentenceCount >= 2) tr = 7;
      else if (tel.wordCount >= 85 && tel.topicOverlapRatio >= 0.2) tr = 6;
      else tr = 5;
      if (tel.vocabHits != null && tel.vocabHits >= 3 && tel.grammarHits >= 2 && tel.wordCount >= 100 && tel.detectedIssueCount === 0) tr = Math.min(8, tr + 1);
    } else {
      if (tel.wordCount >= 250 && tel.paragraphCount >= 4 && tel.topicOverlapRatio >= 0.4 && tel.sentenceCount >= 10) tr = 7;
      else if (tel.wordCount >= 220 && tel.paragraphCount >= 3 && tel.topicOverlapRatio >= 0.25) tr = 6;
      else if (tel.wordCount >= 160) tr = 5;
      else tr = 4;
    }

    // Base Coherence & Cohesion
    let cc = 6;
    if (tel.isSpam) cc = 2;
    else if (!isBody && tel.paragraphCount < 2) cc = 5;
    else if (tel.academicLinkerCount >= 3 && tel.mechanicalLinkerCount <= 2 && (isBody || tel.paragraphCount >= 4)) cc = 7;
    else if (tel.academicLinkerCount >= 1 && (isBody || tel.paragraphCount >= 3)) cc = 6;
    else cc = 5;

    // Base Lexical Resource
    let lr = 6;
    if (tel.isSpam) lr = 2;
    else if (tel.guiraud >= 9.0 && tel.uniqueLongWords >= (isBody ? 10 : 24) && tel.spellingTypos.length === 0 && tel.informalCount === 0 && tel.clicheHits.length === 0) lr = 8;
    else if (tel.guiraud >= 7.6 && tel.uniqueLongWords >= (isBody ? 7 : 16) && tel.spellingTypos.length <= 1 && tel.informalCount === 0) lr = 7;
    else if (tel.guiraud >= 6.2 && tel.uniqueLongWords >= (isBody ? 4 : 9)) lr = 6;
    else lr = 5;

    // Base Grammar Range & Accuracy
    let gra = 6;
    if (tel.isSpam) gra = 2;
    else if (tel.complexSentenceRatio >= 0.5 && tel.detectedIssueCount === 0 && tel.avgSentenceLen >= 16) gra = 8;
    else if (tel.complexSentenceRatio >= 0.35 && tel.detectedIssueCount <= 1 && tel.avgSentenceLen >= 13) gra = 7;
    else if (tel.complexSentenceCount >= 1 && tel.detectedIssueCount <= 3) gra = 6;
    else gra = 5;

    const upgrades = [];
    if (!isBody && tel.wordCount < 250) upgrades.push(`Mở rộng thêm ý giải thích nhân quả A → B → C để đạt tối thiểu 250 từ (hiện tại ${tel.wordCount} từ).`);
    if (!isBody && tel.paragraphCount < 4) upgrades.push('Chia bố cục rõ 4 đoạn (Introduction – Body 1 – Body 2 – Conclusion), mỗi đoạn Body chỉ tập trung 1 luận điểm trung tâm.');
    if (tel.detectedIssueCount > 0) upgrades.push(`Rà sửa ${tel.detectedIssueCount} lỗi ngữ pháp/chính tả đã đánh dấu phía dưới để tăng tỷ lệ câu không lỗi lên mức Band 7+.`);
    if (tel.complexSentenceRatio < 0.35) upgrades.push('Tăng cường câu phức (mệnh đề quan hệ which/who, cụm phân từ V-ing/V-ed, câu điều kiện hoặc nhượng bộ While/Although).');
    if (tel.clicheHits.length > 0) upgrades.push('Loại bỏ các cụm template sáo rỗng và thay bằng collocation gắn trực tiếp với chủ đề đề bài.');
    if (upgrades.length < 2) upgrades.push('Kiểm tra lại độ sắc nét của collocation và bổ sung 1 câu phản biện nhẹ (concession) để đẩy TR & LR lên Band 7.5–8.0.');

    const rawGrade = {
      checklist: {
        offTopicSeverity: tel.topicOverlapRatio < 0.12 ? 'full' : (tel.topicOverlapRatio < 0.22 ? 'partial' : 'none'),
        answersAllPromptParts: tel.topicOverlapRatio >= 0.25 && (isBody || tel.paragraphCount >= 3),
        clearPositionThroughout: tel.wordCount >= (isBody ? 70 : 180),
        eachParagraphClearTopic: isBody || tel.paragraphCount >= 4,
        logicGapsFound: tel.academicLinkerCount < 2 && tel.wordCount >= 100,
        templateStuffingDetected: tel.clicheHits.length >= 2,
        mechanicalLinkersHeavy: tel.mechanicalLinkerCount >= 4,
        informalToneDetected: tel.informalCount >= 1,
        errorFreeSentenceRatio: tel.estimatedErrorFreeRatio,
      },
      criteria: {
        tr: {
          band: tr,
          commentVi: `Bài viết đạt ${tel.wordCount} từ, độ bám từ khóa chủ đề ${Math.round(tel.topicOverlapRatio * 100)}%. ${tel.wordCount < (isBody ? 85 : 250) ? 'Độ dài chưa đủ để mở rộng lập luận sâu theo chuẩn Band 7.' : 'Có triển khai nội dung bám đề; hãy đào sâu thêm cơ chế nguyên nhân – hệ quả để bứt Band.'}`,
        },
        cc: {
          band: cc,
          commentVi: isBody
            ? `Đoạn văn có ${tel.sentenceCount} câu (trung bình ${tel.avgSentenceLen} từ/câu), sử dụng ${tel.academicLinkerCount} dấu hiệu liên kết học thuật.`
            : `Bài chia thành ${tel.paragraphCount} đoạn (${tel.sentenceCount} câu), dùng ${tel.academicLinkerCount} từ nối/quy chiếu học thuật${tel.mechanicalLinkerCount >= 3 ? ' (lưu ý tránh lạm dụng từ nối máy móc)' : ''}.`,
        },
        lr: {
          band: lr,
          commentVi: `Ghi nhận ${tel.uniqueWords} từ khác nhau (${tel.uniqueLongWords} từ học thuật dài ≥7 ký tự)${tel.spellingTypos.length ? `, phát hiện ${tel.spellingTypos.length} lỗi chính tả` : ', chưa phát hiện lỗi chính tả phổ biến'}.`,
        },
        gra: {
          band: gra,
          commentVi: `Có ${tel.complexSentenceCount}/${tel.sentenceCount} câu mang cấu trúc phức (${Math.round(tel.complexSentenceRatio * 100)}%), phát hiện ${tel.detectedIssueCount} điểm lỗi ngữ pháp/dấu câu cần sửa.`,
        },
      },
      errors: tel.grammarIssues.slice(0, 6),
      topUpgradesVi: upgrades.slice(0, 3),
      overallCommentVi: 'Đang chấm bằng Bộ kiểm định IELTS cục bộ (chuẩn Cambridge + khóa trần tự động). Nộp bài khi có kết nối AI server để nhận phân tích sâu ý tưởng từng câu.',
    };

    const capped = applyWritingExaminerCaps(rawGrade, tel, payload);
    capped.engine = 'local-ielts-calibrated';
    return capped;
  }

  function gradeSpeakingLocal(payload, tel) {
    let fc = 6;
    if (tel.isSpam) fc = 2;
    else if (tel.wordCount >= 165 && tel.durationSec >= 85 && tel.pausesPerMin <= 2.5 && tel.totalFillerPct <= 6 && tel.spokenMarkerCount >= 2) fc = 7;
    else if (tel.wordCount >= 120 && tel.durationSec >= 65 && tel.totalFillerPct <= 9) fc = 6;
    else if (tel.wordCount >= 70) fc = 5;
    else fc = 4;

    let lr = 6;
    if (tel.isSpam) lr = 2;
    else if (tel.guiraud >= 8.2 && tel.spokenMarkerCount >= 2 && tel.detectedIssueCount <= 1) lr = 7;
    else if (tel.guiraud >= 6.4) lr = 6;
    else lr = 5;

    let gra = 6;
    if (tel.isSpam) gra = 2;
    else if (tel.complexClauseCount >= 4 && tel.detectedIssueCount === 0) gra = 7;
    else if (tel.complexClauseCount >= 2 && tel.detectedIssueCount <= 2) gra = 6;
    else gra = 5;

    const pr = tel.hasAudio ? (tel.whisperPronEstBand || 6) : null;

    const upgrades = [];
    if (tel.wordCount < 140 || tel.durationSec < 85) upgrades.push(`Kéo dài bài nói Part 2 lên 1 phút 30 – 2 phút (~160–240 từ) bằng cách kể rõ diễn biến & cảm xúc (hiện tại ${tel.wordCount} từ / ${tel.durationSec}s).`);
    if (tel.missedBullets.length > 0) upgrades.push(`Chú ý trả lời đủ các ý trên Cue Card còn thiếu: "${tel.missedBullets[0]}".`);
    if (tel.silentPausesOver1_2s >= 3 || tel.fillerCount >= 5) upgrades.push('Giảm ngập ngừng/từ đệm bằng cách dùng cụm chuyển ý văn nói tự nhiên (Actually, Looking back, What stood out was...).');
    if (tel.detectedIssueCount > 0) upgrades.push('Chú ý chia thì quá khứ nhất quán khi kể chuyện và tránh lỗi kép "because ... so ...".');
    if (!tel.hasAudio) upgrades.push('Lần sau hãy dùng Micro ghi âm thật để hệ thống đo khoảng dừng, tốc độ nói (WPM) và chấm đủ tiêu chí Pronunciation.');

    const rawGrade = {
      checklist: {
        offTopicSeverity: tel.topicOverlapRatio < 0.1 ? 'full' : (tel.topicOverlapRatio < 0.2 ? 'partial' : 'none'),
        cueBulletsCoveredCount: tel.cueBulletsCoveredHeuristic,
        cueBulletsTotal: tel.cueBulletsTotal,
        sustainsLongTurn: tel.wordCount >= 130 && tel.durationSec >= 75,
        heavyHesitationOrRepetition: tel.filledPausePct > 8 || tel.stutterCount >= 4,
        usesNaturalSpokenMarkers: tel.spokenMarkerCount >= 2,
        usesIdiomaticOrLessCommonLexis: tel.guiraud >= 7.5,
        narrativeTenseConsistent: tel.detectedIssueCount <= 2,
        errorFreeUtteranceRatio: Math.max(0.2, 1 - tel.detectedIssueCount / Math.max(3, tel.sentenceCount)),
      },
      criteria: {
        fc: {
          band: fc,
          commentVi: `Thời lượng ${tel.durationSec}s (${tel.wordCount} từ, tốc độ ${tel.wpm} WPM), ${tel.fillerCount} từ đệm${tel.hasAudio && tel.silentPausesOver1_2s ? `, ${tel.silentPausesOver1_2s} khoảng dừng >1.2s` : ''}. Phủ ước tính ${tel.cueBulletsCoveredHeuristic}/${tel.cueBulletsTotal || 4} ý Cue Card.`,
        },
        lr: {
          band: lr,
          commentVi: `Độ đa dạng từ vựng đạt ${tel.uniqueWords} từ khác nhau, dùng ${tel.spokenMarkerCount} dấu hiệu dẫn chuyện văn nói tự nhiên.`,
        },
        gra: {
          band: gra,
          commentVi: `Ghi nhận ${tel.complexClauseCount} câu có mệnh đề phức; phát hiện ${tel.detectedIssueCount} lỗi ngữ pháp văn nói cần chú ý.`,
        },
        pr: {
          band: pr,
          commentVi: tel.hasAudio
            ? `Độ rõ nhận diện âm học Whisper ${tel.whisperAvgLogprob != null ? `(logprob ${tel.whisperAvgLogprob})` : 'ổn định'}, tốc độ phát âm ~${tel.articulationRateWpm} WPM.`
            : 'Chế độ Gõ chữ dự phòng — chưa có file ghi âm nên không chấm khống Pronunciation.',
        },
      },
      errors: tel.grammarIssues.slice(0, 6),
      topUpgradesVi: upgrades.slice(0, 3),
      overallCommentVi: 'Kết quả ước lượng từ Bộ chấm Speaking cục bộ chuẩn IELTS (kèm khóa trần thời lượng & độ phủ Cue Card).',
    };

    const capped = applySpeakingExaminerCaps(rawGrade, tel);
    capped.engine = 'local-ielts-calibrated';
    return capped;
  }

  /* =========================================================================
     4. NETWORK ORCHESTRATION (/api/grade-ielts -> Local Gemini -> Offline)
     ========================================================================= */

  function getGradeApiUrl() {
    if (global.SpeechSTT?.getApiUrl) return global.SpeechSTT.getApiUrl('/api/grade-ielts');
    try {
      const host = String(global.location?.hostname || '');
      if (host.includes('pages.dev')) return '/api/grade-ielts';
      if (host === 'localhost' || host === '127.0.0.1') return `${PROD_API_ORIGIN}/api/grade-ielts`;
    } catch (_) {}
    return `${PROD_API_ORIGIN}/api/grade-ielts`;
  }

  async function callServerGradeApi(body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 22000);
    try {
      const res = await fetch(getGradeApiUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok || !data.grade) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } finally {
      clearTimeout(timer);
    }
  }

  async function gradeWriting(payload = {}) {
    const tel = analyzeWritingTelemetry(payload.text || '', payload.prompt || '', {
      mode: payload.mode || 'essay',
      essayType: payload.essayType || '',
      curriculumKeywords: payload.curriculumKeywords || '',
      targetVocab: payload.targetVocab || null,
      targetGrammar: payload.targetGrammar || null,
    });

    // Instant anti-spam / under-20-words guard (no wasted API call)
    if (tel.isSpam || tel.wordCount < 20) {
      return gradeWritingLocal(payload, tel);
    }

    if (!payload.offlineOnly) {
      try {
        const apiRes = await callServerGradeApi({
          skill: 'writing',
          mode: tel.mode,
          essayType: payload.essayType || '',
          bodyFocusVi: payload.bodyFocusVi || '',
          prompt: payload.prompt || '',
          curriculumContext: payload.curriculumContext || '',
          text: payload.text || '',
          telemetry: {
            wordCount: tel.wordCount,
            paragraphCount: tel.paragraphCount,
            sentenceCount: tel.sentenceCount,
            avgSentenceLen: tel.avgSentenceLen,
            ttr: tel.ttr,
            guiraud: tel.guiraud,
            promptCopyRatio: tel.promptCopyRatio,
            topicOverlapRatio: tel.topicOverlapRatio,
            clicheHits: tel.clicheHits,
            spellingTypos: tel.spellingTypos,
            complexSentenceRatio: tel.complexSentenceRatio,
            detectedIssueCount: tel.detectedIssueCount,
            promptSpec: tel.promptSpec,
          },
        });
        const finalReport = applyWritingExaminerCaps(apiRes.grade, tel, payload);
        finalReport.engine = apiRes.engine || 'ai-examiner';
        finalReport.latencyMs = apiRes.latencyMs || 0;
        return finalReport;
      } catch (err) {
        console.warn('[IeltsGrader] Writing AI API fallback to calibrated local engine:', err?.message || err);
      }
    }

    return gradeWritingLocal(payload, tel);
  }

  async function gradeSpeaking(payload = {}) {
    const tel = analyzeSpeakingTelemetry(
      payload.text || '',
      payload.acoustic || {},
      {
        title: payload.cueTitle || '',
        bullets: payload.cueBullets || [],
        curriculumKeywords: payload.curriculumKeywords || '',
      }
    );

    if (tel.isSpam || tel.wordCount < 18) {
      return gradeSpeakingLocal(payload, tel);
    }

    if (!payload.offlineOnly) {
      try {
        const apiRes = await callServerGradeApi({
          skill: 'speaking',
          cueTitle: payload.cueTitle || '',
          cueBullets: payload.cueBullets || [],
          curriculumContext: payload.curriculumContext || '',
          text: payload.text || '',
          telemetry: {
            wordCount: tel.wordCount,
            durationSec: tel.durationSec,
            hasAudio: tel.hasAudio,
            wpm: tel.wpm,
            articulationRateWpm: tel.articulationRateWpm,
            silentPausesOver1_2s: tel.silentPausesOver1_2s,
            midClausePauses: tel.midClausePauses,
            pausesPerMin: tel.pausesPerMin,
            longestPauseSec: tel.longestPauseSec,
            whisperAvgLogprob: tel.whisperAvgLogprob,
            whisperPronEstBand: tel.whisperPronEstBand,
            filledPauses: tel.filledPauses,
            fillerCount: tel.fillerCount,
            totalFillerPct: tel.totalFillerPct,
            stutterCount: tel.stutterCount,
            spokenMarkerCount: tel.spokenMarkerCount,
            guiraud: tel.guiraud,
            complexClauseCount: tel.complexClauseCount,
            detectedIssueCount: tel.detectedIssueCount,
            topicOverlapRatio: tel.topicOverlapRatio,
          },
        });
        const finalReport = applySpeakingExaminerCaps(apiRes.grade, tel);
        finalReport.engine = apiRes.engine || 'ai-examiner';
        finalReport.latencyMs = apiRes.latencyMs || 0;
        return finalReport;
      } catch (err) {
        console.warn('[IeltsGrader] Speaking AI API fallback to calibrated local engine:', err?.message || err);
      }
    }

    return gradeSpeakingLocal(payload, tel);
  }

  /* =========================================================================
     5. TOTORO SOFT-EDITORIAL EXAMINER REPORT UI RENDERER
     ========================================================================= */

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('ielts-grader-css')) return;
    const style = document.createElement('style');
    style.id = 'ielts-grader-css';
    style.textContent = `
      .ig-report{background:var(--surface,#fffdf8);border:1.5px solid var(--border,#e5dfd2);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;text-align:left;color:var(--ink,#222);}
      .ig-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--border,#e5dfd2);}
      .ig-band-wrap{display:flex;align-items:center;gap:12px;}
      .ig-band-badge{min-width:74px;height:62px;padding:0 10px;border-radius:14px;background:var(--accent,#3d7a5a);color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;box-shadow:0 4px 12px rgba(61,122,90,.22);flex-shrink:0;}
      .ig-band-badge.is-mid{background:#b7791f;}
      .ig-band-badge.is-low{background:#c53030;}
      .ig-band-num{font-size:23px;font-weight:900;font-variant-numeric:tabular-nums;}
      .ig-band-lbl{font-size:9.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.9;margin-top:2px;}
      .ig-head-title{font-size:15px;font-weight:800;color:var(--ink,#222);}
      .ig-head-sub{font-size:12px;color:var(--ink-2,#5c6460);margin-top:2px;}
      .ig-engine-pill{font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;background:var(--surface-2,#f3efe6);border:1px solid var(--border,#e5dfd2);color:var(--ink-2,#5c6460);}
      .ig-engine-pill.is-ai{background:rgba(61,122,90,.12);border-color:rgba(61,122,90,.3);color:var(--accent,#2f6b4b);}
      .ig-crit-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;}
      @media(max-width:720px){.ig-crit-grid{grid-template-columns:repeat(2,minmax(0,1fr));}}
      .ig-crit-card{background:var(--surface-2,#f7f3eb);border:1px solid var(--border,#e5dfd2);border-radius:12px;padding:10px 11px;display:flex;flex-direction:column;gap:4px;}
      .ig-crit-top{display:flex;align-items:baseline;justify-content:space-between;gap:6px;}
      .ig-crit-short{font-size:11px;font-weight:800;letter-spacing:.05em;color:var(--ink-2,#5c6460);text-transform:uppercase;}
      .ig-crit-val{font-size:18px;font-weight:900;color:var(--accent,#2f6b4b);font-variant-numeric:tabular-nums;}
      .ig-crit-val.is-mid{color:#b7791f;}
      .ig-crit-val.is-low{color:#c53030;}
      .ig-crit-val.is-na{font-size:13px;color:var(--ink-2,#777);}
      .ig-crit-name{font-size:11.5px;font-weight:700;color:var(--ink,#222);}
      .ig-crit-desc{font-size:12px;line-height:1.45;color:var(--ink-2,#555);margin-top:2px;}
      .ig-caps-box{background:rgba(197,48,48,.07);border:1px solid rgba(197,48,48,.25);border-radius:11px;padding:9px 12px;font-size:12.3px;line-height:1.5;color:#9b2c2c;}
      .ig-caps-title{font-weight:800;margin-bottom:3px;font-size:12px;text-transform:uppercase;letter-spacing:.03em;}
      .ig-overall{font-size:13.2px;line-height:1.58;color:var(--ink,#222);background:var(--surface-2,#f7f3eb);border-left:3.5px solid var(--accent,#3d7a5a);padding:9px 12px;border-radius:0 10px 10px 0;}
      .ig-sec-lbl{font-size:11.5px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:var(--ink-2,#5c6460);margin-bottom:6px;}
      .ig-err-list{display:flex;flex-direction:column;gap:7px;}
      .ig-err-item{background:var(--surface-2,#faf7f0);border:1px solid var(--border,#e5dfd2);border-radius:10px;padding:8px 11px;font-size:12.6px;line-height:1.5;}
      .ig-err-tag{display:inline-block;font-size:10px;font-weight:800;padding:1px 6px;border-radius:6px;background:rgba(197,48,48,.12);color:#9b2c2c;margin-right:6px;vertical-align:middle;}
      .ig-err-orig{color:#9b2c2c;text-decoration:line-through;font-weight:600;}
      .ig-err-fix{color:#226644;font-weight:700;}
      .ig-err-why{font-size:12px;color:var(--ink-2,#555);margin-top:3px;}
      .ig-up-list{margin:0;padding-left:18px;font-size:12.8px;line-height:1.55;color:var(--ink,#222);display:flex;flex-direction:column;gap:4px;}
      .ig-loading{display:flex;align-items:center;gap:10px;padding:14px 16px;border-radius:14px;background:var(--surface-2,#f7f3eb);border:1px dashed var(--accent,#3d7a5a);font-size:13px;font-weight:700;color:var(--accent,#2f6b4b);}
      .ig-spin{width:16px;height:16px;border-radius:50%;border:2.4px solid rgba(61,122,90,.25);border-top-color:var(--accent,#3d7a5a);animation:igSpin .8s linear infinite;flex-shrink:0;}
      @keyframes igSpin{to{transform:rotate(360deg);}}
    `;
    document.head.appendChild(style);
  }

  function bandToneClass(b) {
    if (b == null) return 'is-na';
    if (b >= 7.0) return '';
    if (b >= 5.5) return 'is-mid';
    return 'is-low';
  }

  function renderLoadingHtml(label) {
    injectStyles();
    return `<div class="ig-loading"><span class="ig-spin" aria-hidden="true"></span><span>${esc(label || 'Giám khảo IELTS AI đang đối chiếu 4 tiêu chí & sửa lỗi từng câu...')}</span></div>`;
  }

  function renderExaminerReportHtml(report, opts = {}) {
    injectStyles();
    if (!report) return '';
    const isAi = report.engine && !String(report.engine).startsWith('local');
    const engineLabel = isAi
      ? `AI Examiner · Chuẩn IELTS 05/2023 (${String(report.engine).split(':')[0].toUpperCase()})`
      : 'Chuẩn IELTS Cục Bộ (Cambridge Caps)';
    const critOrder = report.skill === 'speaking' ? ['fc', 'lr', 'gra', 'pr'] : ['tr', 'cc', 'lr', 'gra'];
    const tel = report.telemetry || {};
    const subMeta = report.skill === 'speaking'
      ? `${tel.wordCount || 0} từ · ${tel.durationSec || 0}s · ${tel.wpm || 0} WPM${tel.hasAudio && tel.silentPausesOver1_2s ? ` · ${tel.silentPausesOver1_2s} lần dừng >1.2s` : ''}`
      : `${tel.wordCount || 0} từ · ${tel.paragraphCount || 1} đoạn · ${tel.sentenceCount || 1} câu`;

    return `
      <div class="ig-report">
        <div class="ig-head">
          <div class="ig-band-wrap">
            <div class="ig-band-badge ${bandToneClass(report.overall)}">
              <span class="ig-band-num">${Number(report.overall || 0).toFixed(1)}</span>
              <span class="ig-band-lbl">IELTS Band</span>
            </div>
            <div>
              <div class="ig-head-title">${esc(opts.title || (report.skill === 'speaking' ? 'Chấm điểm IELTS Speaking Part 2' : (report.mode === 'body' ? 'Chấm điểm Đoạn Body IELTS' : 'Chấm điểm IELTS Writing Task 2')))}</div>
              <div class="ig-head-sub">${esc(subMeta)} · Làm tròn chuẩn IELTS (.25 → .5 / .75 → +1)</div>
            </div>
          </div>
          <span class="ig-engine-pill ${isAi ? 'is-ai' : ''}">${esc(engineLabel)}</span>
        </div>

        <div class="ig-crit-grid">
          ${critOrder.map((k) => {
            const item = report.criteria?.[k];
            if (!item) return '';
            const valStr = item.band == null ? 'N/A' : Number(item.band).toFixed(1);
            return `
              <div class="ig-crit-card">
                <div class="ig-crit-top">
                  <span class="ig-crit-short">${esc(item.short)}</span>
                  <span class="ig-crit-val ${bandToneClass(item.band)}">${esc(valStr)}</span>
                </div>
                <div class="ig-crit-name">${esc(item.label)}</div>
                ${item.commentVi ? `<div class="ig-crit-desc">${esc(item.commentVi)}</div>` : ''}
              </div>
            `;
          }).join('')}
        </div>

        ${report.capsApplied?.length ? `
          <div class="ig-caps-box">
            <div class="ig-caps-title">⚠ Quy tắc khóa trần Giám khảo đã kích hoạt (${report.capsApplied.length})</div>
            ${report.capsApplied.map((cap) => `<div>• ${esc(cap)}</div>`).join('')}
          </div>
        ` : ''}

        ${report.overallCommentVi ? `<div class="ig-overall"><strong>Nhận xét Giám khảo:</strong> ${esc(report.overallCommentVi)}</div>` : ''}

        ${report.errors?.length ? `
          <div>
            <div class="ig-sec-lbl">Sửa lỗi cụ thể &amp; Nâng cấp Band 7.5–8.0+ (${report.errors.length})</div>
            <div class="ig-err-list">
              ${report.errors.map((e) => `
                <div class="ig-err-item">
                  <div>
                    <span class="ig-err-tag">${esc(e.category)}</span>
                    <span class="ig-err-orig">${esc(e.original)}</span>
                    ${e.fix ? ` → <span class="ig-err-fix">${esc(e.fix)}</span>` : ''}
                  </div>
                  ${e.issueVi ? `<div class="ig-err-why">${esc(e.issueVi)}</div>` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        ${report.topUpgradesVi?.length ? `
          <div>
            <div class="ig-sec-lbl">Hướng cải thiện nhanh nhất để tăng Band</div>
            <ul class="ig-up-list">${report.topUpgradesVi.map((u) => `<li>${esc(u)}</li>`).join('')}</ul>
          </div>
        ` : ''}
      </div>
    `;
  }

  const API = {
    roundIeltsBand,
    analyzeWritingTelemetry,
    analyzeSpeakingTelemetry,
    applyWritingExaminerCaps,
    applySpeakingExaminerCaps,
    gradeWritingLocal,
    gradeSpeakingLocal,
    gradeWriting,
    gradeSpeaking,
    renderLoadingHtml,
    renderExaminerReportHtml,
  };

  global.IeltsGrader = API;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = API;
  }
})(typeof window !== 'undefined' ? window : globalThis);
