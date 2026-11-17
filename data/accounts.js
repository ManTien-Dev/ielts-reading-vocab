/**
 * CẤU HÌNH ĐỒNG BỘ ONLINE (GOOGLE APPS SCRIPT WEB APP)
 * -------------------------------------------------------------------------
 * - Link Web App Google Apps Script đang kết nối trực tiếp vào bảng Google Sheet theo dõi giờ học.
 */
window.APP_SYNC_URL = 'https://script.google.com/macros/s/AKfycbyMH2gqHW3gZ_O90rDSAqqq_hmVkVR8bO-jsfatWERKoFvs21Zs0kJhzn5cRTN-CyBEKw/exec';

/**
 * DANH SÁCH TÀI KHOẢN HỌC VIÊN SET SẴN (ID & MẬT KHẨU)
 * -------------------------------------------------------------------------
 * - id: Mã đăng nhập (không phân biệt hoa/thường, viết liền không dấu).
 * - password: Mật khẩu đăng nhập.
 * - name: Tên hiển thị trên Bảng Thi Đua, Google Sheet & Thanh tiêu đề.
 * - role: 'student' (học viên - có xếp hạng giờ học) hoặc 'teacher' (giáo viên).
 */
window.APP_ACCOUNTS = [
  { id: 'thanhngoc', password: 'ngoc01', name: 'Nguyen Thanh Ngoc', role: 'student' },
  { id: 'giabao',    password: 'bao02',  name: 'Than Gia Bao',      role: 'student' },
  { id: 'keluong',   password: 'luong03',name: 'Ngo Ke Luong',      role: 'student' },
  { id: 'giahan',    password: 'han04',  name: 'Tran Nhat Gia Han', role: 'student' },
  { id: 'duyanh',    password: 'anh05',  name: 'Le Duy Anh',        role: 'student' },
  { id: 'ngocdieu',  password: 'dieu06', name: 'Le Ngoc Dieu',      role: 'student' },
  { id: 'hongnhung', password: 'nhung07',name: 'Nguyen Le Hong Nhung', role: 'student' },
  { id: 'baongoc',   password: 'ngoc08', name: 'Nguyen Van Bao Ngoc',  role: 'student' },
  { id: 'giaovien',  password: 'admin123', name: 'Giáo viên',       role: 'teacher' }
];
