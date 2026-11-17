/**
 * GOOGLE APPS SCRIPT — TỰ ĐỘNG ĐỒNG BỘ GIỜ HỌC & BẢNG THI ĐUA IELTS VOCAB
 * -------------------------------------------------------------------------
 * Cách cài đặt (chỉ làm 1 lần duy nhất):
 * 1. Tạo 1 file Google Sheet mới trên Google Drive của bạn.
 * 2. Vào menu: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa hết code mẫu, dán toàn bộ code trong file này vào -> nhấn Lưu (Ctrl+S).
 * 4. Nhấn Triển khai (Deploy) -> Tùy chọn triển khai mới (New deployment):
 *    - Loại (Type): Ứng dụng web (Web app)
 *    - Thực thi dưới dạng (Execute as): Tôi (Me)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 * 5. Copy đường link Web App URL (dạng https://script.google.com/macros/s/.../exec)
 *    và dán vào biến window.APP_SYNC_URL trong file data/accounts.js!
 */

var SHEET_NAME = 'BangGioHoc';

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

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
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
  lock.waitLock(10000);
  try {
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '{}';
    var payload = JSON.parse(raw);
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
      // Dự phòng nếu vượt giới hạn 50.000 ký tự/ô của Google Sheets
      var slim = {
        timerByDay: payload.syncData.timerByDay || {},
        wordsByDay: payload.syncData.wordsByDay || {},
        streakDays: payload.syncData.streakDays || []
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
    lock.releaseLock();
  }
}
