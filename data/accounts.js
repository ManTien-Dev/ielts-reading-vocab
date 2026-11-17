/**
 * CẤU HÌNH ĐỒNG BỘ ONLINE (GOOGLE APPS SCRIPT WEB APP)
 * -------------------------------------------------------------------------
 * - Để trống ('') nếu chỉ chạy nội bộ trên cùng một máy.
 * - Dán link Web App Google Apps Script vào đây (xem sync/HUONG_DAN_CAI_DONG_BO.txt)
 *   để 10 học viên học trên nhiều máy khác nhau vẫn tự động cập nhật giờ học & Bảng Thi Đua.
 */
window.APP_SYNC_URL = 'https://script.google.com/macros/s/AKfycbyMH2gqHW3gZ_O90rDSAqqq_hmVkVR8bO-jsfatWERKoFvs21Zs0kJhzn5cRTN-CyBEKw/exec';

/**
 * DANH SÁCH TÀI KHOẢN HỌC VIÊN SET SẴN (ID & MẬT KHẨU)
 * -------------------------------------------------------------------------
 * Hướng dẫn chỉnh sửa nhanh cho Giáo viên:
 * - Mở file này bằng Notepad hoặc VS Code để đổi ID, mật khẩu hoặc họ tên thật của học viên.
 * - id: Mã đăng nhập (không phân biệt hoa/thường, viết liền không dấu).
 * - password: Mật khẩu đăng nhập.
 * - name: Tên hiển thị trên Bảng Thi Đua & Thanh tiêu đề.
 * - role: 'student' (học viên - có xếp hạng giờ học) hoặc 'teacher' (giáo viên).
 */
window.APP_ACCOUNTS = [
  { id: 'hv01', password: '123456', name: 'Học viên 01', role: 'student' },
  { id: 'hv02', password: '123456', name: 'Học viên 02', role: 'student' },
  { id: 'hv03', password: '123456', name: 'Học viên 03', role: 'student' },
  { id: 'hv04', password: '123456', name: 'Học viên 04', role: 'student' },
  { id: 'hv05', password: '123456', name: 'Học viên 05', role: 'student' },
  { id: 'hv06', password: '123456', name: 'Học viên 06', role: 'student' },
  { id: 'hv07', password: '123456', name: 'Học viên 07', role: 'student' },
  { id: 'hv08', password: '123456', name: 'Học viên 08', role: 'student' },
  { id: 'hv09', password: '123456', name: 'Học viên 09', role: 'student' },
  { id: 'hv10', password: '123456', name: 'Học viên 10', role: 'student' },
  { id: 'giaovien', password: 'admin123', name: 'Giáo viên', role: 'teacher' }
];
