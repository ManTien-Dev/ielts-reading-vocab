/**
 * GOOGLE APPS SCRIPT — TỰ ĐỘNG ĐỒNG BỘ GIỜ HỌC, TASK & CHẤM BÀI DỊCH AI
 * -------------------------------------------------------------------------
 * Cách cài đặt (chỉ làm 1 lần duy nhất):
 * 1. Tạo 1 file Google Sheet mới trên Google Drive của bạn.
 * 2. Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết code mẫu, dán toàn bộ code trong file này vào -> nhấn Lưu (Ctrl+S).
 * 4. (Để bật AI chấm bài dịch cuối Task):
 *    Vào Cài đặt dự án (Project Settings -> biểu tượng bánh răng) -> Thuộc tính tập lệnh (Script Properties)
 *    -> Thêm thuộc tính: Property = GEMINI_API_KEY , Value = <API Key Google AI Studio của bạn>.
 *    (KHÔNG dán API key trực tiếp vào code public trên GitHub!)
 * 5. Nhấn Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment):
 *    - Loại (Type): Ứng dụng web (Web app)
 *    - Thực thi dưới dạng (Execute as): Tôi (Me)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 * 6. Copy đường link Web App URL (dạng https://script.google.com/macros/s/.../exec)
 *    và dán vào biến window.APP_SYNC_URL trong file data/accounts.js!
 */

var SHEET_NAME = 'BangGioHoc';
var TRANS_SHEET_NAME = 'BangBaiDich';

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      'ID',
      'Họ tên học viên',
      'Hôm nay (phút)',
      'Tuần này (phút)',
      'Tháng này (phút)',
      'Đã thuộc (từ)',
      'Chuỗi ngày',
      'Cập nhật lúc',
      'Dữ liệu đồng bộ (JSON)'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  return sheet;
}

function getOrCreateTransSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TRANS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(TRANS_SHEET_NAME);
    sheet.appendRow([
      'Thời gian',
      'ID',
      'Họ tên',
      'Task',
      'Điểm (/10)',
      'Kết quả',
      'Bản dịch học viên',
      'Tóm tắt ý chính',
      'Nhận xét AI'
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange('1:1').setFontWeight('bold');
  }
  return sheet;
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function gradeTranslationWithGemini_(payload) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    return {
      ok: false,
      error: 'Chưa cấu hình GEMINI_API_KEY trong Script Properties của Apps Script.'
    };
  }

  var passage = String(payload.passage || '').trim();
  var translation = String(payload.translation || '').trim();
  var summary = String(payload.summary || '').trim();
  var anchorWords = (payload.anchorWords || []).join(', ');
  var signalClues = (payload.signalClues || []).join(', ');
  var taskLabel = String(payload.taskLabel || 'Task');

  var systemPrompt = [
    'Bạn là Giám khảo IELTS Reading. Học sinh KHÔNG CẦN dịch từng từ (word-by-word); học sinh chỉ cần đọc hiểu các đoạn (A–D) và diễn đạt ngắn gọn lại ý chính của từng đoạn bằng tiếng Việt theo cách hiểu tự nhiên của mình kèm 1–2 câu tóm tắt tổng quát.',
    'Hãy chấm NGHIÊM TÚC, CÔNG BẰNG VÀ CHÍNH XÁC mức độ hiểu bài của học sinh dựa trên ĐÚNG BÀI ĐỌC GỐC.',
    '',
    'QUY TẮC BẮT BUỘC:',
    '1. NẾU BÀI LÀM LÀ KÝ TỰ VÔ NGHĨA (GIBBERISH), GÕ PHÍM NGẪU NHIÊN, SPAM, HOẶC CHƯA PHẢI TIẾNG VIỆT HỢP LỆ:',
    '   - Cho điểm từ 1.0 đến 2.0 / 10, passed: false.',
    '   - overallComment: Nêu rõ bài làm chứa ký tự vô nghĩa/chưa làm nghiêm túc, yêu cầu đọc hiểu và ghi lại ý chính.',
    '   - TUYỆT ĐỐI KHÔNG khen ngợi hay cho điểm đỗ bài làm vô nghĩa!',
    '',
    '2. NẾU BÀI LÀM SAO CHÉP LẠI TIẾNG ANH:',
    '   - Cho điểm 1.5 - 2.0 / 10, passed: false.',
    '   - overallComment: Nêu rõ học sinh đang sao chép lại tiếng Anh thay vì diễn đạt ý hiểu bằng tiếng Việt.',
    '',
    '3. NẾU NỘI DUNG QUÁ NGẮN (< 20 từ) HOẶC CHỈ GHI 1 ĐOẠN MÀ BỎ SÓT ĐA SỐ CÁC ĐOẠN A–D:',
    '   - Cho điểm từ 2.5 đến 4.5 / 10, passed: false.',
    '   - overallComment: Nêu rõ học sinh chưa bao quát đủ ý chính của các đoạn A–D.',
    '',
    '4. ĐÁNH GIÁ THEO Ý HIỂU (KHÔNG BẮT DỊCH SÁT TỪNG TỪ):',
    '   - KHÔNG trừ điểm vì diễn đạt ngắn gọn hoặc paraphrase theo ý hiểu tiếng Việt.',
    '   - Chấm xem học sinh có nắm đúng ý lõi từng đoạn A–D, hiểu đúng ngữ nghĩa từ khóa trọng tâm (' + (anchorWords || '') + ') và bắt đúng mạch chuyển ý từ nối (' + (signalClues || 'However, While, Therefore...') + ') hay bịa sai ý.',
    '   - Kiểm tra tóm tắt tổng quát 1–2 câu có gộp được mạch luận điểm cả bài không.',
    '',
    'Trả về DUY NHẤT JSON hợp lệ theo schema sau (không kèm markdown fence):',
    '{',
    '  "score": <số thực 0.0..10.0>,',
    '  "passed": <boolean, true nếu score >= 6.0>,',
    '  "criteria": {',
    '    "accuracy": <số 0..10, nắm đúng ý chính từng đoạn A-D>,',
    '    "signalWords": <số 0..10, giữ đúng mạch logic từ nối>,',
    '    "contextInference": <số 0..10, hiểu đúng nghĩa từ khóa ngữ cảnh>,',
    '    "summary": <số 0..10, tóm tắt tổng quát súc tích>',
    '  },',
    '  "overallComment": "<nhận xét tổng quan sâu sắc 3-5 câu chỉ rõ điểm mạnh & chỗ hiểu nhầm/sót ý>",',
    '  "lineFeedback": [',
    '    { "issue": "<ý/câu trong đoạn cần chú ý>", "student": "<ý học sinh viết>", "advice": "<phân tích ngữ cảnh & từ nối để hiểu đúng>", "suggested": "<gợi ý diễn đạt ý chính chuẩn>" }',
    '  ],',
    '  "modelTranslation": "<bản diễn giải / dịch chuẩn tham khảo toàn bộ đoạn văn>"',
    '}'
  ].join('\n');

  var userMsg = [
    '=== ĐOẠN VĂN TIẾNG ANH (' + taskLabel + ') ===',
    passage,
    '',
    '=== Ý CHÍNH TỪNG ĐOẠN THEO Ý HIỂU CỦA HỌC SINH ===',
    translation,
    '',
    '=== TÓM TẮT TỔNG QUÁT CỦA HỌC SINH ===',
    summary || '(Học sinh bỏ trống phần tóm tắt)'
  ].join('\n');

  var url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + encodeURIComponent(apiKey);
  var resp = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: systemPrompt + '\n\n' + userMsg }] }],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: 'application/json'
      }
    })
  });

  var code = resp.getResponseCode();
  var bodyText = resp.getContentText();
  if (code < 200 || code >= 300) {
    return { ok: false, error: 'Gemini HTTP ' + code + ': ' + bodyText.slice(0, 300) };
  }

  var parsedResp = JSON.parse(bodyText);
  var rawModelText = '';
  try {
    rawModelText = parsedResp.candidates[0].content.parts[0].text;
  } catch (e) {
    return { ok: false, error: 'Gemini không trả nội dung hợp lệ.' };
  }

  var cleanJson = String(rawModelText || '').replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
  var grade = JSON.parse(cleanJson);
  grade.score = Number(grade.score || 0);
  grade.passed = grade.score >= 6.0;

  // Ghi nhận vào sheet BangBaiDich cho giáo viên theo dõi
  try {
    var tSheet = getOrCreateTransSheet_();
    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');
    tSheet.appendRow([
      nowStr,
      String(payload.studentId || ''),
      String(payload.studentName || ''),
      taskLabel,
      grade.score,
      grade.passed ? 'Đạt' : 'Cần làm lại',
      translation.slice(0, 4000),
      summary.slice(0, 1500),
      String(grade.overallComment || '').slice(0, 3000)
    ]);
  } catch (_) {}

  return { ok: true, grade: grade };
}

function doGet(e) {
  try {
    var sheet = getOrCreateSheet_();
    var values = sheet.getDataRange().getValues();
    var students = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var id = String(row[0] || '').trim().toLowerCase();
      if (!id) continue;
      var syncData = null;
      if (row[8]) {
        try {
          syncData = JSON.parse(String(row[8]));
        } catch (_) {}
      }
      students.push({
        id: id,
        name: String(row[1] || ''),
        todayMins: Number(row[2] || 0),
        weekMins: Number(row[3] || 0),
        monthMins: Number(row[4] || 0),
        mastered: Number(row[5] || 0),
        streak: Number(row[6] || 0),
        updatedAt: String(row[7] || ''),
        syncData: syncData
      });
    }
    return jsonOut_({ ok: true, gasVersion: 3, students: students, serverTime: new Date().toISOString() });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  }
}

var MAX_SYNC_CELL_CHARS = 41000;
var LOCK_WINDOW_MS = 30 * 60 * 1000;

function trimMapOldest_(mapObj, slim, maxChars) {
  if (!mapObj || typeof mapObj !== 'object') return;
  var keys = Object.keys(mapObj).sort();
  while (keys.length > 0 && JSON.stringify(slim).length > maxChars) {
    delete mapObj[keys.shift()];
  }
}

function compactSyncData_(sd, maxChars) {
  if (!sd || typeof sd !== 'object') return '';
  var limit = maxChars || MAX_SYNC_CELL_CHARS;
  var fullJson = JSON.stringify(sd);
  if (fullJson.length <= limit) return fullJson;

  // Preserve all SYNC_META_KEYS first — NEVER drop resetEpoch, teacherUnlockedAt, taskLocks, taskProgress
  var slim = {
    resetEpoch: Number(sd.resetEpoch || 0),
    skillNamespaceVersion: Number(sd.skillNamespaceVersion || 2),
    activeSkillId: String(sd.activeSkillId || 'reading'),
    teacherUnlockedAt: Number(sd.teacherUnlockedAt || 0),
    teacherTaskUnlocks: (sd.teacherTaskUnlocks && typeof sd.teacherTaskUnlocks === 'object') ? sd.teacherTaskUnlocks : {},
    teacherTaskDeadlines: (sd.teacherTaskDeadlines && typeof sd.teacherTaskDeadlines === 'object') ? sd.teacherTaskDeadlines : undefined,
    taskLocks: (sd.taskLocks && typeof sd.taskLocks === 'object') ? sd.taskLocks : {},
    taskProgress: (sd.taskProgress && typeof sd.taskProgress === 'object') ? sd.taskProgress : {},
    listeningTaskProgress: (sd.listeningTaskProgress && typeof sd.listeningTaskProgress === 'object') ? sd.listeningTaskProgress : {},
    writingTaskProgress: (sd.writingTaskProgress && typeof sd.writingTaskProgress === 'object') ? sd.writingTaskProgress : {},
    speakingTaskProgress: (sd.speakingTaskProgress && typeof sd.speakingTaskProgress === 'object') ? sd.speakingTaskProgress : {},
    listFinalCheckpoints: (sd.listFinalCheckpoints && typeof sd.listFinalCheckpoints === 'object') ? sd.listFinalCheckpoints : {},
    listMasteryCerts: (sd.listMasteryCerts && typeof sd.listMasteryCerts === 'object') ? sd.listMasteryCerts : {},
    timerByDay: (sd.timerByDay && typeof sd.timerByDay === 'object') ? sd.timerByDay : {},
    wordsByDay: (sd.wordsByDay && typeof sd.wordsByDay === 'object') ? sd.wordsByDay : {},
    streakDays: Array.isArray(sd.streakDays) ? sd.streakDays.slice() : [],
    currentScopeKey: String(sd.currentScopeKey || 'paraphrase'),
    scopePositions: (sd.scopePositions && typeof sd.scopePositions === 'object') ? sd.scopePositions : {},
    assessments: {},
    srsData: {}
  };
  if (!slim.teacherTaskDeadlines) delete slim.teacherTaskDeadlines;

  var assessSrc = (sd.assessments && typeof sd.assessments === 'object') ? sd.assessments : {};
  var srsSrc = (sd.srsData && typeof sd.srsData === 'object') ? sd.srsData : {};

  // Step 1: Try keeping all assessments + binary-searched top-priority srsData
  slim.assessments = assessSrc;
  if (JSON.stringify(slim).length <= limit) {
    var srsKeys = Object.keys(srsSrc).sort(function(a, b) {
      var la = assessSrc[a] || 0;
      var lb = assessSrc[b] || 0;
      var pa = (la === 2) ? 2 : (la === 1 ? 1 : 0);
      var pb = (lb === 2) ? 2 : (lb === 1 ? 1 : 0);
      if (pb !== pa) return pb - pa;
      var ta = (srsSrc[a] && srsSrc[a].lastAt) ? Number(srsSrc[a].lastAt) : 0;
      var tb = (srsSrc[b] && srsSrc[b].lastAt) ? Number(srsSrc[b].lastAt) : 0;
      return tb - ta;
    });
    var lo = 0, hi = srsKeys.length, best = 0;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      var sub = {};
      for (var i = 0; i < mid; i++) sub[srsKeys[i]] = srsSrc[srsKeys[i]];
      slim.srsData = sub;
      if (JSON.stringify(slim).length <= limit) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    var finalSrs = {};
    for (var j = 0; j < best; j++) finalSrs[srsKeys[j]] = srsSrc[srsKeys[j]];
    slim.srsData = finalSrs;
    return JSON.stringify(slim);
  }

  // Step 2: Drop srsData and ensure metadata alone fits before fitting assessments
  slim.srsData = {};
  slim.assessments = {};
  if (JSON.stringify(slim).length > limit) {
    slim.scopePositions = {};
  }
  if (JSON.stringify(slim).length > limit) {
    trimMapOldest_(slim.timerByDay, slim, limit);
    trimMapOldest_(slim.wordsByDay, slim, limit);
    while (slim.streakDays.length > 0 && JSON.stringify(slim).length > limit) {
      slim.streakDays.shift();
    }
  }

  // Step 3: Binary-search top-priority assessments entries (level 1/2 first, then most recent)
  var assessKeys = Object.keys(assessSrc).sort(function(a, b) {
    var la = assessSrc[a] || 0;
    var lb = assessSrc[b] || 0;
    var pa = (la === 1 || la === 2) ? 1 : 0;
    var pb = (lb === 1 || lb === 2) ? 1 : 0;
    if (pb !== pa) return pb - pa;
    var ta = (srsSrc[a] && srsSrc[a].lastAt) ? Number(srsSrc[a].lastAt) : 0;
    var tb = (srsSrc[b] && srsSrc[b].lastAt) ? Number(srsSrc[b].lastAt) : 0;
    return tb - ta;
  });
  var alo = 0, ahi = assessKeys.length, abest = 0;
  while (alo <= ahi) {
    var amid = (alo + ahi) >> 1;
    var asub = {};
    for (var k = 0; k < amid; k++) asub[assessKeys[k]] = assessSrc[assessKeys[k]];
    slim.assessments = asub;
    if (JSON.stringify(slim).length <= limit) {
      abest = amid;
      alo = amid + 1;
    } else {
      ahi = amid - 1;
    }
  }
  var finalAssess = {};
  for (var m = 0; m < abest; m++) finalAssess[assessKeys[m]] = assessSrc[assessKeys[m]];
  slim.assessments = finalAssess;
  return JSON.stringify(slim);
}

function parseSyncJsonSafe_(rawCell) {
  if (!rawCell) return {};
  try {
    var parsed = JSON.parse(String(rawCell));
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (_) {
    return {};
  }
}

function mergeNumericMaxMap_(curMap, incMap) {
  var out = {};
  if (curMap && typeof curMap === 'object') {
    Object.keys(curMap).forEach(function(k) {
      var v = Number(curMap[k] || 0);
      if (v > 0) out[k] = v;
    });
  }
  if (incMap && typeof incMap === 'object') {
    Object.keys(incMap).forEach(function(k) {
      var v = Number(incMap[k] || 0);
      if (v > Number(out[k] || 0)) out[k] = v;
    });
  }
  return out;
}

function mergeStringArrayUnion_(curArr, incArr) {
  var seen = {};
  var pushAll = function(arr) {
    if (!Array.isArray(arr)) return;
    for (var i = 0; i < arr.length; i++) {
      var s = String(arr[i] || '').trim();
      if (s) seen[s] = true;
    }
  };
  pushAll(curArr);
  pushAll(incArr);
  return Object.keys(seen).sort();
}

function mergeAssessmentsAndSrs_(curAssess, curSrs, incAssess, incSrs) {
  var cA = (curAssess && typeof curAssess === 'object') ? curAssess : {};
  var cS = (curSrs && typeof curSrs === 'object') ? curSrs : {};
  var iA = (incAssess && typeof incAssess === 'object') ? incAssess : {};
  var iS = (incSrs && typeof incSrs === 'object') ? incSrs : {};

  var mA = {};
  var mS = {};

  Object.keys(cA).forEach(function(wid) {
    var lv = Number(cA[wid] || 0);
    if (lv === 1 || lv === 2 || lv === 3) mA[wid] = lv;
  });
  Object.keys(cS).forEach(function(wid) {
    if (cS[wid] && typeof cS[wid] === 'object') mS[wid] = cS[wid];
  });

  // Merge SRS first by newest lastAt
  Object.keys(iS).forEach(function(wid) {
    var rec = iS[wid];
    if (!rec || typeof rec !== 'object') return;
    var prev = mS[wid];
    if (!prev || Number(rec.lastAt || 0) >= Number(prev.lastAt || 0)) {
      mS[wid] = rec;
    }
  });

  // Merge assessments: never drop existing words; when both present, newer lastAt wins, tie -> higher level
  Object.keys(iA).forEach(function(wid) {
    var incLv = Number(iA[wid] || 0);
    if (incLv !== 1 && incLv !== 2 && incLv !== 3) return;
    var curLv = Number(mA[wid] || 0);
    if (!curLv) {
      mA[wid] = incLv;
      return;
    }
    if (curLv === incLv) return;
    var curLast = Number((cS[wid] && cS[wid].lastAt) || 0);
    var incLast = Number((iS[wid] && iS[wid].lastAt) || 0);
    if (incLast > curLast) {
      mA[wid] = incLv;
    } else if (curLast > incLast) {
      mA[wid] = curLv;
    } else {
      mA[wid] = Math.max(curLv, incLv);
    }
  });

  return { assessments: mA, srsData: mS };
}

function mergeTaskProgressMap_(curMap, incMap) {
  var out = {};
  if (curMap && typeof curMap === 'object') {
    Object.keys(curMap).forEach(function(tid) {
      if (curMap[tid] && typeof curMap[tid] === 'object') out[tid] = curMap[tid];
    });
  }
  if (incMap && typeof incMap === 'object') {
    Object.keys(incMap).forEach(function(tid) {
      var rec = incMap[tid];
      if (!rec || typeof rec !== 'object') return;
      var prev = out[tid];
      if (!prev) {
        out[tid] = rec;
        return;
      }
      var prevDone = Boolean(prev.completed || prev.passed || prev.status === 'completed');
      var recDone = Boolean(rec.completed || rec.passed || rec.status === 'completed');
      if (recDone && !prevDone) {
        out[tid] = rec;
      } else if (prevDone && !recDone) {
        // Never downgrade a completed task back to incomplete
        return;
      } else {
        var prevTs = Number(prev.updatedAt || prev.completedAt || 0);
        var recTs = Number(rec.updatedAt || rec.completedAt || 0);
        if (recTs >= prevTs) out[tid] = rec;
      }
    });
  }
  return out;
}

function mergeCertsMap_(curMap, incMap) {
  var out = {};
  if (curMap && typeof curMap === 'object') {
    Object.keys(curMap).forEach(function(k) {
      if (curMap[k] && typeof curMap[k] === 'object') out[k] = curMap[k];
    });
  }
  if (incMap && typeof incMap === 'object') {
    Object.keys(incMap).forEach(function(k) {
      var rec = incMap[k];
      if (!rec || typeof rec !== 'object') return;
      var prev = out[k];
      if (!prev) {
        out[k] = rec;
        return;
      }
      var prevPass = Boolean(prev.passed);
      var recPass = Boolean(rec.passed);
      if (recPass && !prevPass) {
        out[k] = rec;
      } else if (prevPass && !recPass) {
        return;
      } else {
        var prevTs = Number(prev.completedAt || prev.updatedAt || 0);
        var recTs = Number(rec.completedAt || rec.updatedAt || 0);
        if (recTs >= prevTs) out[k] = rec;
      }
    });
  }
  return out;
}

function mergeDeadlinesMap_(curMap, incMap) {
  var out = {};
  if (curMap && typeof curMap === 'object') {
    Object.keys(curMap).forEach(function(k) {
      if (curMap[k] && typeof curMap[k] === 'object') out[k] = curMap[k];
    });
  }
  if (incMap && typeof incMap === 'object') {
    Object.keys(incMap).forEach(function(k) {
      var rec = incMap[k];
      if (!rec || typeof rec !== 'object') return;
      var prev = out[k];
      if (!prev || Number(rec.issuedAt || 0) >= Number(prev.issuedAt || 0)) {
        out[k] = rec;
      }
    });
  }
  return out;
}

function mergeScopePositions_(curMap, incMap) {
  var out = {};
  if (curMap && typeof curMap === 'object') {
    Object.keys(curMap).forEach(function(k) {
      if (curMap[k]) out[k] = curMap[k];
    });
  }
  if (incMap && typeof incMap === 'object') {
    Object.keys(incMap).forEach(function(k) {
      if (incMap[k]) out[k] = incMap[k];
    });
  }
  return out;
}

function countLevel3Assessments_(assessObj) {
  if (!assessObj || typeof assessObj !== 'object') return 0;
  var cnt = 0;
  Object.keys(assessObj).forEach(function(k) {
    if (String(k).indexOf('mv_w_') === 0) return;
    if (Number(assessObj[k] || 0) === 3) cnt++;
  });
  return cnt;
}

function formatDayKeyYmd_(y, m, d) {
  return y + '-' + (m < 10 ? '0' + m : String(m)) + '-' + (d < 10 ? '0' + d : String(d));
}

function computeServerMetricsFromSync_(sd, tz) {
  var zone = tz || 'Asia/Ho_Chi_Minh';
  var now = new Date();
  var todayStr = Utilities.formatDate(now, zone, 'yyyy-MM-dd');
  var parts = todayStr.split('-');
  var y = Number(parts[0]);
  var m = Number(parts[1]); // 1..12
  var d = Number(parts[2]);

  var tMap = (sd && sd.timerByDay && typeof sd.timerByDay === 'object') ? sd.timerByDay : {};
  var todaySecs = Number(tMap[todayStr] || 0);

  // Use UTC-noon calendar math so DST/timezone offsets never shift dates
  var todayNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  var todayIdx = (todayNoon.getUTCDay() + 6) % 7; // Mon=0 .. Sun=6
  var mondayMs = todayNoon.getTime() - todayIdx * 86400000;
  var weekSecs = 0;
  for (var i = 0; i < 7; i++) {
    var wd = new Date(mondayMs + i * 86400000);
    var wkKey = formatDayKeyYmd_(wd.getUTCFullYear(), wd.getUTCMonth() + 1, wd.getUTCDate());
    weekSecs += Number(tMap[wkKey] || 0);
  }

  var daysInMonth = new Date(Date.UTC(y, m, 0, 12, 0, 0)).getUTCDate();
  var monthSecs = 0;
  for (var day = 1; day <= daysInMonth; day++) {
    var moKey = formatDayKeyYmd_(y, m, day);
    monthSecs += Number(tMap[moKey] || 0);
  }

  // Consecutive streak up to today (or yesterday if today not studied yet)
  var completed = {};
  if (sd && Array.isArray(sd.streakDays)) {
    for (var s = 0; s < sd.streakDays.length; s++) {
      var ds = String(sd.streakDays[s] || '').trim();
      if (ds) completed[ds] = true;
    }
  }
  Object.keys(tMap).forEach(function(dk) {
    if (Number(tMap[dk] || 0) > 0) completed[dk] = true;
  });

  var streak = 0;
  var cursorMs = todayNoon.getTime();
  if (!completed[todayStr]) cursorMs -= 86400000;
  while (streak < 1000) {
    var cd = new Date(cursorMs);
    var cKey = formatDayKeyYmd_(cd.getUTCFullYear(), cd.getUTCMonth() + 1, cd.getUTCDate());
    if (!completed[cKey]) break;
    streak++;
    cursorMs -= 86400000;
  }

  return {
    todayMins: Math.floor(todaySecs / 60),
    weekMins: Math.floor(weekSecs / 60),
    monthMins: Math.floor(monthSecs / 60),
    streak: streak
  };
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);

    if (payload.action === 'grade_translation') {
      lock.releaseLock();
      return jsonOut_(gradeTranslationWithGemini_(payload));
    }

    var id = String(payload.id || '').trim().toLowerCase();
    if (!id) {
      return jsonOut_({ ok: false, error: 'Missing id' });
    }

    var sheet = getOrCreateSheet_();
    var values = sheet.getDataRange().getValues();
    var targetRow = -1;
    for (var i = 1; i < values.length; i++) {
      if (String(values[i][0] || '').trim().toLowerCase() === id) {
        targetRow = i + 1;
        break;
      }
    }

    var nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh', 'yyyy-MM-dd HH:mm:ss');

    if (payload.action === 'unlock_student') {
      var existingRow = targetRow > 0 ? values[targetRow - 1] : null;
      var existingSync = existingRow ? parseSyncJsonSafe_(existingRow[8]) : {};
      var oldLocks = (existingSync.taskLocks && typeof existingSync.taskLocks === 'object') ? existingSync.taskLocks : {};
      var targetTaskId = String(payload.taskId || '').trim();
      var perUnlocks = (existingSync.teacherTaskUnlocks && typeof existingSync.teacherTaskUnlocks === 'object') ? existingSync.teacherTaskUnlocks : {};
      var maxLockOrigin = 0;
      if (targetTaskId) {
        var uOne = Number(oldLocks[targetTaskId] || 0);
        if (uOne > 0) maxLockOrigin = uOne - LOCK_WINDOW_MS;
      } else {
        Object.keys(oldLocks).forEach(function(tid) {
          var origin = Number(oldLocks[tid] || 0) - LOCK_WINDOW_MS;
          if (origin > maxLockOrigin) maxLockOrigin = origin;
        });
      }
      var effectiveUnlock = Math.max(
        Number(payload.unlockedAtTs || 0),
        Date.now(),
        targetTaskId ? Number(perUnlocks[targetTaskId] || 0) : Number(existingSync.teacherUnlockedAt || 0),
        maxLockOrigin > 0 ? (maxLockOrigin + 1) : 0
      );
      if (targetTaskId) {
        delete oldLocks[targetTaskId];
        perUnlocks[targetTaskId] = effectiveUnlock;
        existingSync.taskLocks = oldLocks;
        existingSync.teacherTaskUnlocks = perUnlocks;
      } else {
        existingSync.taskLocks = {};
        existingSync.teacherUnlockedAt = effectiveUnlock;
      }
      var unlockSyncJson = compactSyncData_(existingSync, MAX_SYNC_CELL_CHARS);

      if (targetRow > 0) {
        var preservedRow = [
          id,
          String(existingRow[1] || payload.name || id),
          Number(existingRow[2] || 0),
          Number(existingRow[3] || 0),
          Number(existingRow[4] || 0),
          Number(existingRow[5] || 0),
          Number(existingRow[6] || 0),
          nowStr,
          unlockSyncJson
        ];
        sheet.getRange(targetRow, 1, 1, preservedRow.length).setValues([preservedRow]);
      } else {
        sheet.appendRow([
          id,
          String(payload.name || id),
          0, 0, 0, 0, 0,
          nowStr,
          unlockSyncJson
        ]);
      }
      return jsonOut_({
        ok: true,
        action: 'unlock_student',
        id: id,
        teacherUnlockedAt: effectiveUnlock,
        updatedAt: nowStr
      });
    }

    // Default sync_user path (monotonic union merge prevents blank/stale devices from wiping history!)
    var tz = Session.getScriptTimeZone() || 'Asia/Ho_Chi_Minh';
    var incomingSync = (payload.syncData && typeof payload.syncData === 'object') ? payload.syncData : null;
    var existingRowForSync = targetRow > 0 ? values[targetRow - 1] : null;
    var finalTodayMins = Number(payload.todayMins || 0);
    var finalWeekMins = Number(payload.weekMins || 0);
    var finalMonthMins = Number(payload.monthMins || 0);
    var finalMastered = Number(payload.mastered || 0);
    var finalStreak = Number(payload.streak || 0);

    if (targetRow > 0 && incomingSync) {
      var curSync = parseSyncJsonSafe_(existingRowForSync[8]);
      var existingEpoch = Number(curSync.resetEpoch || 0);
      var incomingEpoch = Number(incomingSync.resetEpoch || 0);

      // Guard 1: reject stale pre-reset tabs trying to downgrade resetEpoch
      if (existingEpoch > 0 && incomingEpoch < existingEpoch) {
        return jsonOut_({
          ok: false,
          error: 'stale_reset_epoch',
          existingResetEpoch: existingEpoch
        });
      }

      // Guard 2: monotonic union merge when in the same resetEpoch (NEVER lose historical progress!)
      if (incomingEpoch === existingEpoch) {
        var rawIncAssess = (incomingSync.assessments && typeof incomingSync.assessments === 'object') ? incomingSync.assessments : {};
        var rawIncL3 = countLevel3Assessments_(rawIncAssess);

        incomingSync.timerByDay = mergeNumericMaxMap_(curSync.timerByDay, incomingSync.timerByDay);
        incomingSync.wordsByDay = mergeNumericMaxMap_(curSync.wordsByDay, incomingSync.wordsByDay);
        incomingSync.streakDays = mergeStringArrayUnion_(curSync.streakDays, incomingSync.streakDays);

        var mergedVocab = mergeAssessmentsAndSrs_(curSync.assessments, curSync.srsData, incomingSync.assessments, incomingSync.srsData);
        incomingSync.assessments = mergedVocab.assessments;
        incomingSync.srsData = mergedVocab.srsData;

        incomingSync.taskProgress = mergeTaskProgressMap_(curSync.taskProgress, incomingSync.taskProgress);
        incomingSync.listeningTaskProgress = mergeTaskProgressMap_(curSync.listeningTaskProgress, incomingSync.listeningTaskProgress);
        incomingSync.writingTaskProgress = mergeTaskProgressMap_(curSync.writingTaskProgress, incomingSync.writingTaskProgress);
        incomingSync.speakingTaskProgress = mergeTaskProgressMap_(curSync.speakingTaskProgress, incomingSync.speakingTaskProgress);
        incomingSync.listFinalCheckpoints = mergeCertsMap_(curSync.listFinalCheckpoints, incomingSync.listFinalCheckpoints);
        incomingSync.listMasteryCerts = mergeCertsMap_(curSync.listMasteryCerts, incomingSync.listMasteryCerts);
        incomingSync.scopePositions = mergeScopePositions_(curSync.scopePositions, incomingSync.scopePositions);

        if (curSync.teacherTaskDeadlines || incomingSync.teacherTaskDeadlines) {
          incomingSync.teacherTaskDeadlines = mergeDeadlinesMap_(curSync.teacherTaskDeadlines, incomingSync.teacherTaskDeadlines);
        }

        // Preserve newer teacherUnlockedAt + teacherTaskUnlocks & strip superseded taskLocks
        var existingUnlockAt = Number(curSync.teacherUnlockedAt || 0);
        var incomingUnlockAt = Number(incomingSync.teacherUnlockedAt || 0);
        var mergedUnlockAt = Math.max(existingUnlockAt, incomingUnlockAt);
        incomingSync.teacherUnlockedAt = mergedUnlockAt;

        var existingPer = (curSync.teacherTaskUnlocks && typeof curSync.teacherTaskUnlocks === 'object') ? curSync.teacherTaskUnlocks : {};
        var incomingPer = (incomingSync.teacherTaskUnlocks && typeof incomingSync.teacherTaskUnlocks === 'object') ? incomingSync.teacherTaskUnlocks : {};
        var mergedPer = {};
        Object.keys(existingPer).forEach(function(k) { mergedPer[k] = Number(existingPer[k] || 0); });
        Object.keys(incomingPer).forEach(function(k) {
          var v = Number(incomingPer[k] || 0);
          if (v > Number(mergedPer[k] || 0)) mergedPer[k] = v;
        });
        incomingSync.teacherTaskUnlocks = mergedPer;

        // Union active taskLocks from both curSync and incomingSync, then strip any superseded by unlock
        var combinedLocks = mergeNumericMaxMap_(curSync.taskLocks, incomingSync.taskLocks);
        var cleanLocks = {};
        Object.keys(combinedLocks).forEach(function(tid) {
          var untilMs = Number(combinedLocks[tid] || 0);
          var origin = untilMs - LOCK_WINDOW_MS;
          var perAt = Number(mergedPer[tid] || 0);
          if (untilMs > 0 && (mergedUnlockAt <= 0 || origin > mergedUnlockAt) && (perAt <= 0 || origin > perAt)) {
            cleanLocks[tid] = untilMs;
          }
        });
        incomingSync.taskLocks = cleanLocks;

        // Recompute summary metrics from mergedSync so a blank client pushing 0 can NEVER zero out Sheet columns!
        var srvMetrics = computeServerMetricsFromSync_(incomingSync, tz);
        finalTodayMins = Math.max(srvMetrics.todayMins, finalTodayMins);
        finalWeekMins = Math.max(srvMetrics.weekMins, finalWeekMins);
        finalMonthMins = Math.max(srvMetrics.monthMins, finalMonthMins);
        finalStreak = Math.max(srvMetrics.streak, finalStreak);

        var existingMastered = Number(existingRowForSync[5] || 0);
        var mergedL3 = countLevel3Assessments_(incomingSync.assessments);
        if (rawIncL3 < mergedL3 || (finalMastered === 0 && existingMastered > 0 && mergedL3 > 0)) {
          finalMastered = Math.max(existingMastered, finalMastered);
        }
      }
    }

    var syncJson = incomingSync ? compactSyncData_(incomingSync, MAX_SYNC_CELL_CHARS) : '';
    var rowData = [
      id,
      String(payload.name || (existingRowForSync ? existingRowForSync[1] : '') || id),
      finalTodayMins,
      finalWeekMins,
      finalMonthMins,
      finalMastered,
      finalStreak,
      nowStr,
      syncJson
    ];

    if (targetRow > 0) {
      sheet.getRange(targetRow, 1, 1, rowData.length).setValues([rowData]);
    } else {
      sheet.appendRow(rowData);
    }

    return jsonOut_({
      ok: true,
      gasVersion: 3,
      id: id,
      updatedAt: nowStr,
      todayMins: finalTodayMins,
      weekMins: finalWeekMins,
      monthMins: finalMonthMins,
      mastered: finalMastered,
      streak: finalStreak,
      teacherUnlockedAt: incomingSync ? Number(incomingSync.teacherUnlockedAt || 0) : 0,
      teacherTaskUnlocks: (incomingSync && incomingSync.teacherTaskUnlocks) ? incomingSync.teacherTaskUnlocks : {},
      taskLocks: (incomingSync && incomingSync.taskLocks) ? incomingSync.taskLocks : {}
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
