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
    'Bạn là Giám khảo IELTS Reading & Chuyên gia dịch thuật học thuật tiếng Việt.',
    'Hãy chấm RẤT NGHIÊM TÚC, CÔNG BẰNG VÀ CHÍNH XÁC bài dịch và tóm tắt của học sinh dựa trên ĐÚNG ĐOẠN VĂN GỐC.',
    '',
    'QUY TẮC BẮT BUỘC ĐỂ TRÁNH CHẤM SAI:',
    '1. NẾU BÀI LÀM LÀ KÝ TỰ VÔ NGHĨA (GIBBERISH), GÕ PHÍM NGẪU NHIÊN, SPAM, HOẶC CHƯA PHẢI TIẾNG VIỆT HỢP LỆ:',
    '   - Cho điểm từ 1.0 đến 2.0 / 10.',
    '   - passed: false.',
    '   - overallComment: Nêu rõ bài làm chứa ký tự vô nghĩa/chưa dịch nghiêm túc, yêu cầu đọc bài và dịch lại.',
    '   - TUYỆT ĐỐI KHÔNG khen ngợi hay cho điểm đỗ bài làm vô nghĩa!',
    '',
    '2. NẾU BÀI LÀM SAO CHÉP LẠI TIẾNG ANH:',
    '   - Cho điểm 1.5 - 2.0 / 10, passed: false.',
    '   - overallComment: Nêu rõ học sinh đang sao chép lại tiếng Anh thay vì dịch sang tiếng Việt.',
    '',
    '3. NẾU BẢN DỊCH QUÁ NGẮN (< 40 từ) HOẶC BỎ SÓT ĐA SỐ CÂU:',
    '   - Cho điểm từ 2.5 đến 4.5 / 10, passed: false.',
    '   - overallComment: Nêu rõ bản dịch chưa bao quát đủ dung lượng đoạn văn.',
    '',
    '4. ĐỐI CHIẾU NỘI DUNG VỚI ĐOẠN GỐC TIẾNG ANH:',
    '   - Đặc biệt kiểm tra: học sinh có biết tận dụng từ nối định hướng (' + (signalClues || 'However, While, Therefore...') + ') và các từ khóa đã học (' + (anchorWords || '') + ') để suy đoán đúng các từ mới ngoài bài chứ không dịch bừa hay bỏ sót câu không.',
    '   - Kiểm tra tóm tắt 1-3 câu có súc tích và nắm đúng ý chính không.',
    '',
    'Trả về DUY NHẤT JSON hợp lệ theo schema sau (không kèm markdown fence):',
    '{',
    '  "score": <số thực 0.0..10.0>,',
    '  "passed": <boolean, true nếu score >= 6.0>,',
    '  "criteria": {',
    '    "accuracy": <số 0..10, độ chính xác ngữ nghĩa từng câu, không bịa ý>,',
    '    "signalWords": <số 0..10, xử lý đúng logic từ nối & tương phản>,',
    '    "contextInference": <số 0..10, đoán nghĩa từ chưa biết hợp ngữ cảnh>,',
    '    "summary": <số 0..10, tóm tắt đủ ý chính, súc tích 1-3 câu>',
    '  },',
    '  "overallComment": "<nhận xét tổng quan sâu sắc 3-5 câu chỉ rõ điểm mạnh & điểm yếu>",',
    '  "lineFeedback": [',
    '    { "issue": "<cụm/câu tiếng Anh học sinh dịch chưa chuẩn hoặc đoán sai>", "student": "<phần học sinh dịch>", "advice": "<giải thích kỹ cách dùng ngữ cảnh/từ nối để hiểu đúng>", "suggested": "<gợi ý dịch chuẩn>" }',
    '  ],',
    '  "modelTranslation": "<bản dịch tiếng Việt chuẩn mực, tự nhiên của cả đoạn>"',
    '}'
  ].join('\n');

  var userMsg = [
    '=== ĐOẠN VĂN TIẾNG ANH (' + taskLabel + ') ===',
    passage,
    '',
    '=== BẢN DỊCH CỦA HỌC SINH ===',
    translation,
    '',
    '=== TÓM TẮT Ý CHÍNH CỦA HỌC SINH ===',
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
      grade.passed ? 'Đạt' : 'Cần dịch lại',
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
    return jsonOut_({ ok: true, gasVersion: 2, students: students, serverTime: new Date().toISOString() });
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
    teacherUnlockedAt: Number(sd.teacherUnlockedAt || 0),
    taskLocks: (sd.taskLocks && typeof sd.taskLocks === 'object') ? sd.taskLocks : {},
    taskProgress: (sd.taskProgress && typeof sd.taskProgress === 'object') ? sd.taskProgress : {},
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
      var maxLockOrigin = 0;
      Object.keys(oldLocks).forEach(function(tid) {
        var origin = Number(oldLocks[tid] || 0) - LOCK_WINDOW_MS;
        if (origin > maxLockOrigin) maxLockOrigin = origin;
      });
      var effectiveUnlock = Math.max(
        Number(payload.unlockedAtTs || 0),
        Date.now(),
        Number(existingSync.teacherUnlockedAt || 0),
        maxLockOrigin > 0 ? (maxLockOrigin + 1) : 0
      );
      existingSync.taskLocks = {};
      existingSync.teacherUnlockedAt = effectiveUnlock;
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

    // Default sync_user path
    var incomingSync = (payload.syncData && typeof payload.syncData === 'object') ? payload.syncData : null;
    if (targetRow > 0 && incomingSync) {
      var curSync = parseSyncJsonSafe_(values[targetRow - 1][8]);
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

      // Guard 2: preserve newer teacherUnlockedAt & strip superseded taskLocks unless epoch increased
      if (incomingEpoch === existingEpoch) {
        var existingUnlockAt = Number(curSync.teacherUnlockedAt || 0);
        var incomingUnlockAt = Number(incomingSync.teacherUnlockedAt || 0);
        var mergedUnlockAt = Math.max(existingUnlockAt, incomingUnlockAt);
        incomingSync.teacherUnlockedAt = mergedUnlockAt;

        var rawLocks = (incomingSync.taskLocks && typeof incomingSync.taskLocks === 'object') ? incomingSync.taskLocks : {};
        var cleanLocks = {};
        Object.keys(rawLocks).forEach(function(tid) {
          var untilMs = Number(rawLocks[tid] || 0);
          if (untilMs > 0 && (mergedUnlockAt <= 0 || (untilMs - LOCK_WINDOW_MS) > mergedUnlockAt)) {
            cleanLocks[tid] = untilMs;
          }
        });
        incomingSync.taskLocks = cleanLocks;
      }
    }

    var syncJson = incomingSync ? compactSyncData_(incomingSync, MAX_SYNC_CELL_CHARS) : '';
    var rowData = [
      id,
      String(payload.name || id),
      Number(payload.todayMins || 0),
      Number(payload.weekMins || 0),
      Number(payload.monthMins || 0),
      Number(payload.mastered || 0),
      Number(payload.streak || 0),
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
      id: id,
      updatedAt: nowStr,
      teacherUnlockedAt: incomingSync ? Number(incomingSync.teacherUnlockedAt || 0) : 0,
      taskLocks: (incomingSync && incomingSync.taskLocks) ? incomingSync.taskLocks : {}
    });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
