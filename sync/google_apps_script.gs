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
    return jsonOut_({ ok: true, students: students, serverTime: new Date().toISOString() });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
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
    var syncJson = payload.syncData ? JSON.stringify(payload.syncData) : '';
    if (syncJson.length > 48000) {
      var slim = {
        timerByDay: payload.syncData.timerByDay || {},
        wordsByDay: payload.syncData.wordsByDay || {},
        streakDays: payload.syncData.streakDays || [],
        taskProgress: payload.syncData.taskProgress || {},
        taskLocks: payload.syncData.taskLocks || {}
      };
      syncJson = JSON.stringify(slim);
    }

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

    return jsonOut_({ ok: true, id: id, updatedAt: nowStr });
  } catch (err) {
    return jsonOut_({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}
