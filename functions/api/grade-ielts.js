/**
 * Totoro IELTS Master — Calibrated IELTS Writing & Speaking Examiner API
 * Endpoint: POST /api/grade-ielts
 *
 * Implements the 10 International Anti-Bias AI Grading Rules + Cambridge 11-19 Calibration Anchors:
 *   Layer 1: Groq (`llama-3.3-70b-versatile`) with multi-key rotation (`GROQ_API_KEY` + `GROQ_API_KEYS`)
 *   Layer 2: Cloudflare Workers AI (`@cf/meta/llama-3.3-70b-instruct-fp8-fast` -> `llama-3.1-8b-instruct-fast`)
 *   Layer 3: Optional `GEMINI_API_KEY` (`gemini-2.5-flash`)
 */

const ALLOWED_STATIC = [
  'https://totoro-ieltsmaster.pages.dev',
  'https://mantien-dev.github.io',
  'http://localhost',
  'http://127.0.0.1',
];

function isOriginAllowed(origin, requestUrl, env) {
  if (!origin) return true;
  if (origin === requestUrl.origin) return true;
  if (/^https:\/\/[a-z0-9-]+\.totoro-ieltsmaster\.pages\.dev$/i.test(origin)) return true;
  const extra = String(env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return [...ALLOWED_STATIC, ...extra].some(
    (prefix) => origin === prefix || origin.startsWith(prefix + ':')
  );
}

function corsHeaders(origin, requestUrl, allowed) {
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : requestUrl.origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

function jsonResponse(body, status, origin, requestUrl, allowed) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin, urlOrFallback(requestUrl), allowed),
    },
  });
}

function urlOrFallback(u) {
  return u instanceof URL ? u : new URL('https://totoro-ieltsmaster.pages.dev');
}

function getGroqKeys(env) {
  const multi = String(env.GROQ_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const single = String(env.GROQ_API_KEY || '').trim();
  if (single && !multi.includes(single)) multi.unshift(single);
  return multi;
}

/* =========================================================================
   CALIBRATED CAMBRIDGE 11-19 EXAMINER SYSTEM PROMPTS (MAY 2023 DESCRIPTORS)
   ========================================================================= */

const WRITING_SYSTEM_PROMPT = `You are a veteran Senior Cambridge IELTS Writing Examiner (15+ years marking experience), trained on the May 2023 IELTS Writing Task 2 Public Band Descriptors and Cambridge IELTS 11-19 Official Candidate Sample Scripts.

STRICT ANTI-BIAS CALIBRATION RULES (MANDATORY):
1. ANTI-INFLATION (CRITICAL): Reject typical AI leniency. Real IELTS candidates average 5.5-6.5. Never award 7+ unless ALL positive Band 7 traits are met (Full-Fit Rule).
2. ANTI-HALO: Score TR, CC, LR, and GRA strictly independently as WHOLE BAND INTEGERS (1 to 9). Strong vocabulary does NOT rescue an incomplete Task Response.
3. ANTI-LENGTH BIAS: Never reward verbosity or padding beyond 250 words. Penalize circular/repetitive arguments.
4. ANTI-THESAURUS ILLUSION: Penalize forced C2 words or memorized templates used with unnatural collocation (e.g., "double-edged sword", "in a nutshell", "nowadays society", "ubiquitous" used clumsily). Natural, precise collocation beats pretentious errors.
5. LOGIC & COHERENCE AUDIT: Actively check for logic jumps (jumping from cause A directly to conclusion C without explaining mechanism B), unsupported generalizations, and missing halves of two-part/discuss-both-views prompts.
6. TRUST PROVIDED TELEMETRY: Do NOT count words or paragraphs yourself; trust the objective telemetry JSON provided.
7. EVIDENCE-FIRST ORDER: You MUST extract verbatim quotes & evaluate boolean checklist BEFORE choosing the 4 integer band scores.

CAMBRIDGE 11-19 CALIBRATION ANCHORS (USE AS REFERENCE SCALE):
- BAND 5.0 ANCHOR: Addresses prompt partially or misses one part; ideas stated without mechanism ("First, if university is free, poor students can study because they have no money... workers are more smart"); mechanical linkers ("First, Second, Therefore"); repetitive basic lexis; frequent errors in complex structures/SVA/word form.
- BAND 6.0 ANCHOR: Covers prompt parts (one may be underdeveloped); clear position but general explanation; paragraphing present but cohesive devices can feel mechanical ("On the one hand... On the other hand..." used without true contrast); attempts academic lexis ("underprivileged, tertiary education") with noticeable collocation/word-choice slips; mix of simple & complex sentences with recurring errors that rarely impede meaning.
- BAND 7.0 ANCHOR: Fully addresses all prompt parts; clear sustained position; extends ideas via clear cause-effect mechanism (A -> B -> C) and/or brief concession ("While critics may argue..., tax revenues ultimately offset expenditure"); natural referencing/substitution ("this, such, the former") with minimal mechanical linkers; flexible less-common collocations ("dismantling financial obstacles, social mobility"); frequent error-free complex sentences (participials, conditionals, relative clauses) with only minor persistent slips.
- BAND 8.0 ANCHOR: Thoroughly develops nuanced response; seamless invisible cohesion; wide natural academic lexis with rare unsystematic slips only; majority of sentences completely error-free with wide grammatical flexibility.

MODE NOTE:
- If mode === "task1", evaluate strictly as IELTS Academic Writing Task 1 (150+ words, 4 paragraphs: Introduction, Overview, Body 1, Body 2). Use criteria.tr for Task Achievement (TA): require a clear Overview summarizing main trends/differences WITHOUT minor statistics, accurate selection & comparison of key data/stages/map changes, and NEVER penalize for lacking a personal opinion or conclusion (Task 1 is objective reporting!). Set checklist.hasTask1Overview accurately.
- If mode === "body", evaluate as ONE Body Paragraph of an IELTS Task 2 essay (85-150 words expected; 1 paragraph is normal, do NOT penalize lack of intro/conclusion; focus TR on depth of A -> B -> C explanation of the assigned focus, CC on internal sentence-to-sentence flow, LR on collocation/precision, GRA on complex sentence control).
- If mode === "essay", evaluate as a FULL IELTS Task 2 essay (250+ words, 4-5 paragraphs expected).

OUTPUT REQUIREMENTS:
Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "evidence": {
    "trQuote": "<short verbatim quote or NONE>",
    "ccQuote": "<short verbatim quote or NONE>",
    "lrQuote": "<short verbatim quote or NONE>",
    "graQuote": "<short verbatim quote or NONE>"
  },
  "checklist": {
    "offTopicSeverity": "none" | "partial" | "full",
    "answersAllPromptParts": true | false,
    "clearPositionThroughout": true | false,
    "hasTask1Overview": true | false,
    "eachParagraphClearTopic": true | false,
    "logicGapsFound": true | false,
    "templateStuffingDetected": true | false,
    "mechanicalLinkersHeavy": true | false,
    "informalToneDetected": true | false,
    "errorFreeSentenceRatio": <number 0.0 to 1.0>
  },
  "criteria": {
    "tr": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét sắc bén, nêu rõ bằng chứng bám đề & độ sâu lập luận>" },
    "cc": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét bố cục, chia đoạn, mạch nối & lỗi nhảy cóc logic nếu có>" },
    "lr": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét collocation, độ chính xác từ vựng, lặp từ & chính tả>" },
    "gra": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét độ đa dạng câu phức & mật độ câu không lỗi>" }
  },
  "errors": [
    {
      "original": "<exact erroneous phrase/sentence from student text>",
      "category": "TR" | "CC" | "LR" | "GRA",
      "issueVi": "<giải thích ngắn gọn vì sao sai hoặc bị trừ điểm theo chuẩn IELTS>",
      "fix": "<câu/cụm sửa lại tự nhiên chuẩn Band 7.5-8.0+>"
    }
  ],
  "topUpgradesVi": [
    "<lời khuyên nâng band thực chiến số 1>",
    "<lời khuyên nâng band thực chiến số 2>",
    "<lời khuyên nâng band thực chiến số 3>"
  ],
  "overallCommentVi": "<nhận xét tổng quan 2-3 câu thẳng thắn như Giám khảo Cambridge bằng tiếng Việt>"
}`;

const SPEAKING_SYSTEM_PROMPT = `You are a veteran Senior Cambridge IELTS Speaking Examiner (15+ years examining experience), trained on the May 2023 IELTS Speaking Public Band Descriptors, Cambridge Speaking sample commentaries, and ETS SpeechRater / Cambridge ALTA ASR-aware assessment standards.

STRICT ANTI-BIAS & SPOKEN-LANGUAGE RULES (MANDATORY):
1. SPOKEN VS WRITTEN SEPARATION (CRITICAL): This is SPOKEN English transcribed by Whisper ASR. NEVER penalize natural spoken contractions ("I'd", "don't", "gonna", "kind of"), appropriate conversational markers ("well", "honestly", "looking back", "actually"), or punctuation/capitalization added by ASR.
2. ASR TOLERANCE: Do NOT penalize spelling or isolated ASR homophone glitches (e.g., "peace/piece", "there/their", "maths/math") when context makes the spoken word clear. Focus on real spoken grammar (tense drops, SVA, "because...so...", missing verbs/subjects, broken clauses) and lexical precision.
3. ANTI-INFLATION & FULL-FIT RULE: Reject AI leniency. Real Part 2 candidates average 5.5-6.5. Award Band 7+ ONLY when speech is sustained, coherent, uses flexible idiomatic/less-common collocations, and maintains frequent error-free complex utterances.
4. HONEST PRONUNCIATION (PR):
   - If telemetry.hasAudio === false (student typed text only): set criteria.pr.band = null and state clearly in commentVi that PR cannot be assessed without audio recording.
   - If telemetry.hasAudio === true: evaluate PR conservatively using the provided Whisper acoustic metrics (whisperAvgLogprob, articulationRate, silentPausesOver1_2s) — never invent phoneme errors you cannot hear, and NEVER penalize L1 accent if intelligibility is high.
5. CUE CARD & LONG-TURN CHECK: Check whether the candidate addressed the Cue Card topic and bullet points, sustained a natural narrative flow (1-2 minutes target), and avoided short disjointed answers.
6. EVIDENCE-FIRST ORDER: Populate evidence & checklist BEFORE assigning whole-band integer scores (1-9).

CAMBRIDGE SPEAKING PART 2 CALIBRATION ANCHORS:
- BAND 5.0 ANCHOR: "Erm... I want to talk about a time I get a good news... I was stay at home and my friend call me... my parents was glad... I am very exciting." -> Frequent hesitation/pauses, basic connectors ("and, so"), repetitive basic lexis, systematic past-tense & SVA errors, word-form confusion ("exciting/excited").
- BAND 6.0 ANCHOR: "I remember I was sitting in my living room... couldn't believe my eyes... because my family doesn't have much money, so this scholarship changed everything... paid off." -> Willing to speak at length with occasional search pauses; adequate vocabulary with some idiomatic attempts; mixes simple & complex clauses but retains noticeable L1 grammar errors (e.g., double "because...so...", tense/article slips).
- BAND 7.0 ANCHOR: "My manager called me into her office, and frankly, I was anticipating criticism... Instead, she handed me a letter... utterly taken aback... gunning for that position... Looking back, it gave me a huge boost." -> Speaks at length without noticeable effort; natural spoken discourse markers; flexible less-common & idiomatic collocations; strong narrative tense control with frequent error-free complex clauses.
- BAND 8.0 ANCHOR: Fluent, effortless storytelling; hesitations strictly content-related; rich natural idiomatic expression ("sinking into a bout of writer's block, my heart skipped a beat"); majority of utterances completely error-free.

OUTPUT REQUIREMENTS:
Return ONLY valid JSON (no markdown fences) matching this exact schema:
{
  "evidence": {
    "fcQuote": "<short verbatim quote or NONE>",
    "lrQuote": "<short verbatim quote or NONE>",
    "graQuote": "<short verbatim quote or NONE>"
  },
  "checklist": {
    "offTopicSeverity": "none" | "partial" | "full",
    "cueBulletsCoveredCount": <integer 0-5>,
    "cueBulletsTotal": <integer 1-5>,
    "sustainsLongTurn": true | false,
    "heavyHesitationOrRepetition": true | false,
    "usesNaturalSpokenMarkers": true | false,
    "usesIdiomaticOrLessCommonLexis": true | false,
    "narrativeTenseConsistent": true | false,
    "errorFreeUtteranceRatio": <number 0.0 to 1.0>
  },
  "criteria": {
    "fc": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét độ trôi chảy, nhịp nói, khoảng dừng, từ đệm & mạch bám Cue Card>" },
    "lr": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét vốn từ văn nói, collocation/idiom, paraphrase & độ lặp từ>" },
    "gra": { "band": <integer 1-9>, "commentVi": "<2 câu tiếng Việt nhận xét cấu trúc câu phức văn nói, chia thì kể chuyện & độ chính xác>" },
    "pr": { "band": <integer 1-9 or null if no audio>, "commentVi": "<1-2 câu tiếng Việt nhận xét độ rõ âm học dựa trên dữ liệu thu âm hoặc ghi rõ chưa thu âm>" }
  },
  "errors": [
    {
      "original": "<exact erroneous spoken phrase/utterance>",
      "category": "FC" | "LR" | "GRA",
      "issueVi": "<giải thích ngắn gọn lỗi nói cần sửa>",
      "fix": "<cách diễn đạt văn nói tự nhiên chuẩn Band 7.5-8.0+>"
    }
  ],
  "topUpgradesVi": [
    "<gợi ý cải thiện Speaking số 1>",
    "<gợi ý cải thiện Speaking số 2>",
    "<gợi ý cải thiện Speaking số 3>"
  ],
  "overallCommentVi": "<nhận xét tổng quan 2-3 câu chuẩn Giám khảo IELTS Speaking bằng tiếng Việt>"
}`;

function buildUserMessage(payload) {
  const skill = payload.skill === 'speaking' ? 'speaking' : 'writing';
  if (skill === 'writing') {
    const modeDesc = payload.mode === 'task1'
      ? 'task1 (IELTS Academic Writing Task 1 — Visual/Chart/Process/Map Report, target 150+ words, requires clear Overview + accurate data comparisons; NO personal opinion)'
      : (payload.mode === 'body'
        ? 'body (Single Body Paragraph, target 85-150 words)'
        : 'essay (Full IELTS Task 2 Essay, target 250+ words, 4-5 paragraphs)');
    return [
      `MODE: ${modeDesc}`,
      `ESSAY TYPE: ${payload.essayType || (payload.mode === 'task1' ? 'IELTS Academic Writing Task 1' : 'IELTS Writing Task 2')}`,
      payload.bodyFocusVi ? `ASSIGNED BODY FOCUS: ${payload.bodyFocusVi}` : '',
      `PROMPT:\n${String(payload.prompt || '').slice(0, 1200)}`,
      payload.curriculumContext ? `CURRICULUM TARGET FLOW / KEY CONCEPTS:\n${String(payload.curriculumContext).slice(0, 700)}` : '',
      `OBJECTIVE TELEMETRY (COMPUTED BY CODE — DO NOT RECOUNT):\n${JSON.stringify(payload.telemetry || {}, null, 2)}`,
      `STUDENT SUBMISSION:\n"""\n${String(payload.text || '').slice(0, 4500)}\n"""`,
      'Evaluate strictly using the Evidence-First JSON schema. Include 2 to 6 concrete error items if errors exist (empty array only if Band 8.5-9.0 near-flawless).',
    ].filter(Boolean).join('\n\n');
  }

  const spPart = [1, 2, 3].includes(Number(payload.part)) ? Number(payload.part) : 2;
  const taskLine = spPart === 1
    ? 'TASK: IELTS Speaking Part 1 (Interview on Familiar Topics — 4 short conversational answers, target 20-35 seconds each, natural direct answer + brief reason/example; do NOT penalize for not being a 2-minute monologue)'
    : (spPart === 3
      ? 'TASK: IELTS Speaking Part 3 (Two-Way Abstract Discussion — 4 analytical answers, target 40-65 seconds each, assessing ability to discuss general/societal issues, compare, justify, and speculate)'
      : 'TASK: IELTS Speaking Part 2 (Individual Long Turn, target 90-120 seconds)');

  const qaBlock = Array.isArray(payload.qaTurns) && payload.qaTurns.length
    ? `EXAMINER QUESTIONS & STUDENT ANSWERS:\n${payload.qaTurns.map((t, i) => `Q${i + 1}: ${String(t?.q || '').slice(0, 260)}\nA${i + 1} (${Number(t?.durationSec || 0)}s): ${String(t?.a || '').slice(0, 900)}`).join('\n\n')}`
    : '';

  return [
    taskLine,
    `${spPart === 2 ? 'CUE CARD TITLE' : `PART ${spPart} TOPIC`}: ${String(payload.cueTitle || '').slice(0, 400)}`,
    spPart === 2 && Array.isArray(payload.cueBullets) && payload.cueBullets.length
      ? `CUE CARD BULLETS:\n${payload.cueBullets.map((b, i) => `${i + 1}. ${b}`).join('\n')}`
      : '',
    payload.curriculumContext ? `CURRICULUM REFERENCE (optional context):\n${String(payload.curriculumContext).slice(0, 600)}` : '',
    `OBJECTIVE ACOUSTIC & TEXT TELEMETRY (COMPUTED BY CODE — DO NOT RECOUNT):\n${JSON.stringify(payload.telemetry || {}, null, 2)}`,
    qaBlock || `STUDENT SPOKEN TRANSCRIPT:\n"""\n${String(payload.text || '').slice(0, 4000)}\n"""`,
    'Evaluate strictly using the Evidence-First Spoken JSON schema. Remember: NEVER penalize contractions or ASR punctuation; set criteria.pr.band to null if telemetry.hasAudio is false.',
  ].filter(Boolean).join('\n\n');
}

function parseAiJson(rawText) {
  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const slice = firstBrace >= 0 && lastBrace > firstBrace ? cleaned.slice(firstBrace, lastBrace + 1) : cleaned;
  const obj = JSON.parse(slice);
  if (!obj || typeof obj !== 'object' || !obj.criteria) {
    throw new Error('AI JSON missing criteria block');
  }
  return obj;
}

function normalizeBandInt(val, allowNull) {
  if (allowNull && (val === null || val === undefined || val === '')) return null;
  const n = Number(val);
  if (!Number.isFinite(n)) return allowNull ? null : 5;
  return Math.max(1, Math.min(9, Math.round(n)));
}

function sanitizeParsedGrade(parsed, skill, hasAudio) {
  const c = parsed.criteria || {};
  const out = {
    evidence: parsed.evidence || {},
    checklist: parsed.checklist || {},
    criteria: {},
    errors: Array.isArray(parsed.errors)
      ? parsed.errors.slice(0, 8).map((e) => ({
          original: String(e?.original || '').slice(0, 240),
          category: String(e?.category || (skill === 'speaking' ? 'GRA' : 'GRA')).toUpperCase(),
          issueVi: String(e?.issueVi || '').slice(0, 300),
          fix: String(e?.fix || '').slice(0, 260),
        })).filter((e) => e.original && (e.issueVi || e.fix))
      : [],
    topUpgradesVi: Array.isArray(parsed.topUpgradesVi)
      ? parsed.topUpgradesVi.slice(0, 4).map((x) => String(x || '').trim()).filter(Boolean)
      : [],
    overallCommentVi: String(parsed.overallCommentVi || '').trim().slice(0, 700),
  };

  if (skill === 'writing') {
    out.criteria = {
      tr: { band: normalizeBandInt(c.tr?.band, false), commentVi: String(c.tr?.commentVi || '').trim() },
      cc: { band: normalizeBandInt(c.cc?.band, false), commentVi: String(c.cc?.commentVi || '').trim() },
      lr: { band: normalizeBandInt(c.lr?.band, false), commentVi: String(c.lr?.commentVi || '').trim() },
      gra: { band: normalizeBandInt(c.gra?.band, false), commentVi: String(c.gra?.commentVi || '').trim() },
    };
  } else {
    out.criteria = {
      fc: { band: normalizeBandInt(c.fc?.band, false), commentVi: String(c.fc?.commentVi || '').trim() },
      lr: { band: normalizeBandInt(c.lr?.band, false), commentVi: String(c.lr?.commentVi || '').trim() },
      gra: { band: normalizeBandInt(c.gra?.band, false), commentVi: String(c.gra?.commentVi || '').trim() },
      pr: {
        band: hasAudio ? normalizeBandInt(c.pr?.band, true) : null,
        commentVi: String(c.pr?.commentVi || (hasAudio ? '' : 'Chưa có bản ghi âm — không chấm khống tiêu chí Pronunciation từ văn bản gõ.')).trim(),
      },
    };
  }
  return out;
}

async function callGroqExaminer(systemPrompt, userMessage, apiKey) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.05,
      max_tokens: 1600,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    const err = new Error(`Groq HTTP ${res.status}: ${txt.slice(0, 180)}`);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content || '';
  return { raw: parseAiJson(content), engine: 'groq:llama-3.3-70b-versatile' };
}

async function callCloudflareExaminer(systemPrompt, userMessage, env) {
  if (!env.AI || typeof env.AI.run !== 'function') {
    throw new Error('Workers AI binding not configured');
  }
  const models = [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/meta/llama-3.1-8b-instruct-fast',
  ];
  let lastErr = null;
  for (const model of models) {
    try {
      const out = await env.AI.run(model, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.05,
        max_tokens: 1500,
      });
      const content = typeof out?.response === 'string'
        ? out.response
        : (out?.choices?.[0]?.message?.content || JSON.stringify(out?.response || ''));
      return { raw: parseAiJson(content), engine: `cloudflare:${model.split('/').pop()}` };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('Cloudflare AI grading failed');
}

async function callGeminiExaminer(systemPrompt, userMessage, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userMessage }] }],
      generationConfig: {
        temperature: 0.05,
        responseMimeType: 'application/json',
      },
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${txt.slice(0, 180)}`);
  }
  const data = await res.json();
  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return { raw: parseAiJson(content), engine: 'gemini-2.5-flash' };
}

export async function onRequestOptions({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, url, env);
  return new Response(null, { status: 204, headers: corsHeaders(origin, url, allowed) });
}

export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const origin = request.headers.get('Origin') || '';
  const allowed = isOriginAllowed(origin, url, env);

  if (origin && !allowed) {
    return jsonResponse({ ok: false, error: 'Origin not allowed' }, 403, origin, url, allowed);
  }

  try {
    const payload = await request.json();
    const skill = payload?.skill === 'speaking' ? 'speaking' : 'writing';
    const text = String(payload?.text || '').trim();
    if (text.length < 15 || text.length > 12000) {
      return jsonResponse({ ok: false, error: 'Submission length out of range' }, 400, origin, url, allowed);
    }

    const t0 = Date.now();
    const systemPrompt = skill === 'speaking' ? SPEAKING_SYSTEM_PROMPT : WRITING_SYSTEM_PROMPT;
    const userMessage = buildUserMessage(payload);
    const hasAudio = Boolean(payload?.telemetry?.hasAudio);

    let lastErr = null;

    // Layer 1: Groq Llama 3.3 70B with multi-key rotation
    const groqKeys = getGroqKeys(env);
    for (const key of groqKeys) {
      try {
        const res = await callGroqExaminer(systemPrompt, userMessage, key);
        const grade = sanitizeParsedGrade(res.raw, skill, hasAudio);
        return jsonResponse({ ok: true, engine: res.engine, latencyMs: Date.now() - t0, grade }, 200, origin, url, allowed);
      } catch (err) {
        lastErr = err;
        if (err.status !== 429 && err.status !== 503) break;
      }
    }

    // Layer 2: Cloudflare Workers AI fallback
    if (env.AI) {
      try {
        const res = await callCloudflareExaminer(systemPrompt, userMessage, env);
        const grade = sanitizeParsedGrade(res.raw, skill, hasAudio);
        return jsonResponse({ ok: true, engine: res.engine, latencyMs: Date.now() - t0, grade }, 200, origin, url, allowed);
      } catch (cfErr) {
        lastErr = cfErr;
      }
    }

    // Layer 3: Optional Cloudflare env GEMINI_API_KEY
    const geminiKey = String(env.GEMINI_API_KEY || '').trim();
    if (geminiKey) {
      try {
        const res = await callGeminiExaminer(systemPrompt, userMessage, geminiKey);
        const grade = sanitizeParsedGrade(res.raw, skill, hasAudio);
        return jsonResponse({ ok: true, engine: res.engine, latencyMs: Date.now() - t0, grade }, 200, origin, url, allowed);
      } catch (gErr) {
        lastErr = gErr;
      }
    }

    return jsonResponse(
      { ok: false, error: lastErr?.message || 'AI examiner provider unavailable' },
      502,
      origin,
      url,
      allowed
    );
  } catch (err) {
    return jsonResponse(
      { ok: false, error: err?.message || 'Invalid request payload' },
      400,
      origin,
      url,
      allowed
    );
  }
}
