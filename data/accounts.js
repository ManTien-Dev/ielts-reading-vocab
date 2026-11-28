/**
 * CẤU HÌNH ĐỒNG BỘ ONLINE (GOOGLE APPS SCRIPT WEB APP)
 * -------------------------------------------------------------------------
 * - Link Web App Google Apps Script đang kết nối trực tiếp vào bảng Google Sheet theo dõi giờ học.
 */
window.APP_SYNC_URL = 'https://script.google.com/macros/s/AKfycbyMH2gqHW3gZ_O90rDSAqqq_hmVkVR8bO-jsfatWERKoFvs21Zs0kJhzn5cRTN-CyBEKw/exec';

/**
 * CẤU HÌNH PHÒNG LÀM CHUNG LIVE (FIREBASE REALTIME DATABASE - MIỄN PHÍ < 0.3s)
 * Dán URL Realtime Database của bạn (vd: 'https://your-app-default-rtdb.asia-southeast1.firebasedatabase.app')
 * Hoặc dán trực tiếp trong nút "Làm chung (Live)" trên giao diện Giáo viên.
 */
window.APP_LIVE_DB_URL = 'https://totoro-ielts-live-default-rtdb.asia-southeast1.firebasedatabase.app';

/**
 * DANH SÁCH LỚP HỌC (PHÂN QUYỀN ĐỘC LẬP THEO GIÁO VIÊN)
 * -------------------------------------------------------------------------
 * - Mỗi giáo viên chỉ có quyền quản lý, giao bài & xem báo cáo đúng lớp mình.
 * - Bảng thi đua học viên trên Trang chủ để chung toàn trung tâm cho sôi nổi.
 */
window.APP_CLASSES = [
  { id: 'lop_thay_man', name: 'Lớp Thầy Mẫn',    teacherId: 'giaovien',  teacherName: 'Thầy Mẫn' },
  { id: 'lop_gv2',      name: 'Lớp Giáo viên 2', teacherId: 'giaovien2', teacherName: 'Giáo viên 2' }
];

/**
 * DANH SÁCH TÀI KHOẢN HỌC VIÊN SET SẴN (ID & MẬT KHẨU)
 * -------------------------------------------------------------------------
 * - id: Mã đăng nhập (không phân biệt hoa/thường, viết liền không dấu).
 * - password: Mật khẩu đăng nhập.
 * - name: Tên hiển thị trên Bảng Thi Đua, Google Sheet & Thanh tiêu đề.
 * - role: 'student' (học viên - có xếp hạng giờ học) hoặc 'teacher' (giáo viên).
 * - classId: Mã lớp thuộc window.APP_CLASSES.
 */
window.APP_ACCOUNTS = [
  // ===== LỚP THẦY MẪN (8 HỌC VIÊN + GIÁO VIÊN 1) =====
  { id: 'thanhngoc', password: 'ngoc01',   name: 'Nguyen Thanh Ngoc',    role: 'student', classId: 'lop_thay_man' },
  { id: 'giabao',    password: 'bao02',    name: 'Than Gia Bao',         role: 'student', classId: 'lop_thay_man' },
  { id: 'keluong',   password: 'luong03',  name: 'Ngo Ke Luong',         role: 'student', classId: 'lop_thay_man' },
  { id: 'giahan',    password: 'han04',    name: 'Tran Nhat Gia Han',    role: 'student', classId: 'lop_thay_man' },
  { id: 'duyanh',    password: 'anh05',    name: 'Le Duy Anh',           role: 'student', classId: 'lop_thay_man' },
  { id: 'ngocdieu',  password: 'dieu06',   name: 'Le Ngoc Dieu',         role: 'student', classId: 'lop_thay_man' },
  { id: 'hongnhung', password: 'nhung07',  name: 'Nguyen Le Hong Nhung', role: 'student', classId: 'lop_thay_man' },
  { id: 'baongoc',   password: 'ngoc08',   name: 'Nguyen Van Bao Ngoc',  role: 'student', classId: 'lop_thay_man' },
  { id: 'giaovien',  password: 'admin123', name: 'Giáo viên',            role: 'teacher', classId: 'lop_thay_man' },

  // ===== LỚP GIÁO VIÊN 2 (5 HỌC VIÊN + GIÁO VIÊN 2) =====
  { id: 'nhatanh',   password: 'anh09',    name: 'Nguyễn Nhật Ánh',      role: 'student', classId: 'lop_gv2' },
  { id: 'myngoc',    password: 'ngoc10',   name: 'Lê Trần Mỹ Ngọc',      role: 'student', classId: 'lop_gv2' },
  { id: 'anhnhu',    password: 'nhu11',    name: 'Cao Thị Ánh Như',      role: 'student', classId: 'lop_gv2' },
  { id: 'ductung',   password: 'tung12',   name: 'Trần Đức Tùng',        role: 'student', classId: 'lop_gv2' },
  { id: 'tranbinh',  password: 'binh13',   name: 'Trần Bình',            role: 'student', classId: 'lop_gv2' },
  { id: 'giaovien2', password: 'gv2026',   name: 'Giáo viên 2',          role: 'teacher', classId: 'lop_gv2' }
];
