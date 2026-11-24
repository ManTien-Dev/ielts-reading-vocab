/* =========================================================
   DATA CATALOG: IELTS LISTENING PRACTICE LIBRARY (IMPORT-READY)
   - Mirrors Reading Practice (SOURCES -> BOOKS -> Test 1..4 -> Part 1..4 + FULL TEST)
   - Designed for 3x3 Totoro-Shaped Book Grid (every book has its own
     distinct Totoro persona, accessory, palette, expression & Listening review)
   - Lazy-load hooks for imported exam banks:
       data/bank_listening_cambridge.js  -> window.__LISTENING_BANKS__.cambridge
       data/bank_listening_volume.js     -> window.__LISTENING_BANKS__.volume
       data/bank_listening_actual.js     -> window.__LISTENING_BANKS__.actual
   - Pre-wired with 11 ready Flagship Audio Neural exams (Note Completion & SVG Maps)
   ========================================================= */
(function () {
  'use strict';

  const SOURCES = [
    {
      id: 'cambridge',
      label: 'Cambridge IELTS',
      bookTitle: 'Cambridge IELTS',
      shortBadge: '★ 20 Books',
      desc: 'Chuẩn đề Cambridge sát cấu trúc phòng thi thật — nổi bật bẫy Paraphrase Part 3–4 và Map Labelling.',
      scene: 'headphones'
    },
    {
      id: 'volume',
      label: 'Real Listening',
      bookTitle: 'Real Listening Tests',
      shortBadge: '9 Volumes',
      desc: 'Tuyển chọn đề tốc độ cao với mật độ Distractor dày — rèn phản xạ bắt bẫy đổi ý Band 7.0–9.0.',
      scene: 'umbrella'
    },
    {
      id: 'actual',
      label: 'Recent Actual Tests',
      bookTitle: 'Recent Actual Tests',
      shortBadge: '9 Sets',
      desc: 'Tổng hợp đề thi thật gần đây bám sát xu hướng Part 1–4 và giọng đọc đa vùng miền.',
      scene: 'studio'
    },
    {
      id: 'map_studio',
      label: 'Map & Note Studio',
      bookTitle: 'Map & Note Studio',
      shortBadge: '★ 11 Ready',
      desc: 'Chuyên đề Map Labelling Part 2 và Note Completion Part 1–4 — chấm đáp án và đối chiếu Transcript trực tiếp.',
      scene: 'compass'
    }
  ];

  /* ---------------------------------------------------------
     20 UNIQUE TOTORO-SHAPED CAMBRIDGE LISTENING BOOKS (20 -> 1)
     Grouped in crisp 3x3 grids: Cam 20-12 (9), Cam 11-3 (9), Cam 2-1 (2)
     --------------------------------------------------------- */
  const CAMBRIDGE_BOOKS = [
    {
      id: 'lcam_20', source: 'cambridge', num: 20, testsCount: 4,
      title: 'Cambridge IELTS 20',
      persona: 'headphones', eyes: 'alert',
      palette: { fur: '#2F6049', furDark: '#204534', spine: '#193729', belly: '#FAF4E6', accent: '#E5B95C', cheek: '#E89B8B' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Chuẩn 2025 · Paraphrase',
      review: 'Cập nhật mới nhất — tốc độ nói tự nhiên, nhiều bẫy đồng nghĩa ở Part 3 thảo luận học thuật và Part 4 bài giảng sinh thái.'
    },
    {
      id: 'lcam_19', source: 'cambridge', num: 19, testsCount: 4,
      title: 'Cambridge IELTS 19',
      persona: 'umbrella', eyes: 'calm',
      palette: { fur: '#275274', furDark: '#1A3A54', spine: '#132B40', belly: '#F9F4E8', accent: '#E8C068', cheek: '#E69F95' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Map Part 2 · Đa giọng',
      review: 'Nổi bật dạng Map Labelling & giọng Anh–Úc đan xen. Rất sát độ khó thi máy thực tế với nhịp chuyển câu nhanh.'
    },
    {
      id: 'lcam_18', source: 'cambridge', num: 18, testsCount: 4,
      title: 'Cambridge IELTS 18',
      persona: 'acorn', eyes: 'happy',
      palette: { fur: '#974E35', furDark: '#723824', spine: '#58291A', belly: '#FBF5E8', accent: '#F0C772', cheek: '#F0A490' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Bẫy đổi ý Part 1',
      review: 'Cân bằng đời sống & học thuật — tần suất cao bẫy sửa thông tin phút chót ở Part 1 và Part 2.'
    },
    {
      id: 'lcam_17', source: 'cambridge', num: 17, testsCount: 4,
      title: 'Cambridge IELTS 17',
      persona: 'moon', eyes: 'gentle',
      palette: { fur: '#594474', furDark: '#403057', spine: '#302242', belly: '#FAF4EA', accent: '#EBC274', cheek: '#E79CA3' },
      stars: 3, diff: 'Band 6.5–7.5', tag: 'Luyện tốc độ nghe',
      review: 'Nhịp đọc đều và rõ âm cuối — cực hợp rèn độ chính xác chính tả số ít/số nhiều để bứt từ Band 6.5 lên 7.5.'
    },
    {
      id: 'lcam_16', source: 'cambridge', num: 16, testsCount: 4,
      title: 'Cambridge IELTS 16',
      persona: 'soot', eyes: 'curious',
      palette: { fur: '#236360', furDark: '#174745', spine: '#103533', belly: '#FAF5E9', accent: '#ECC670', cheek: '#E89D8F' },
      stars: 4, diff: 'Band 7.0–8.0', tag: 'Part 4 Học thuật C1',
      review: 'Giàu từ vựng học thuật Part 4 về khoa học & công nghệ — rèn kỹ năng bám Signposting vượt qua các câu dài.'
    },
    {
      id: 'lcam_15', source: 'cambridge', num: 15, testsCount: 4,
      title: 'Cambridge IELTS 15',
      persona: 'ginkgo', eyes: 'happy',
      palette: { fur: '#966828', furDark: '#704C1A', spine: '#543812', belly: '#FCF6E9', accent: '#F4DA8E', cheek: '#ECA28A' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Mạch nói sáng rõ',
      review: 'Độ khó vừa tầm, phân đoạn ý mạch lạc — lý tưởng cho giai đoạn làm quen chiến thuật gạch keyword và dự đoán từ loại.'
    },
    {
      id: 'lcam_14', source: 'cambridge', num: 14, testsCount: 4,
      title: 'Cambridge IELTS 14',
      persona: 'lantern', eyes: 'calm',
      palette: { fur: '#3E4854', furDark: '#2A323B', spine: '#1E242B', belly: '#F9F3E7', accent: '#E8B85F', cheek: '#E4988C' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Thảo luận 2 chiều P3',
      review: 'Nổi tiếng với Part 3 tranh luận giữa hai sinh viên — nhiều bẫy đồng tình giả rồi phản bác ở câu tiếp theo.'
    },
    {
      id: 'lcam_13', source: 'cambridge', num: 13, testsCount: 4,
      title: 'Cambridge IELTS 13',
      persona: 'compass', eyes: 'alert',
      palette: { fur: '#873E49', furDark: '#632B34', spine: '#4B1F26', belly: '#FAF4E8', accent: '#F0C77B', cheek: '#ED9E9E' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Bản đồ & Chọn đáp án',
      review: 'Xuất hiện dày dạng Map Labelling định hướng Đông–Tây và Multiple Choice dài — rèn khả năng lọc nhiễu cực tốt.'
    },
    {
      id: 'lcam_12', source: 'cambridge', num: 12, testsCount: 4,
      title: 'Cambridge IELTS 12',
      persona: 'fern', eyes: 'gentle',
      palette: { fur: '#4B6B3A', furDark: '#364E29', spine: '#273A1D', belly: '#FAF5E7', accent: '#ECCB79', cheek: '#E89D8B' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Tự nhiên & Bảo tồn',
      review: 'Chủ đề thiên nhiên, du lịch và khảo cổ dễ hình dung — phù hợp xây nền tảng nghe chép ổn định ở cả 4 Part.'
    },
    {
      id: 'lcam_11', source: 'cambridge', num: 11, testsCount: 4,
      title: 'Cambridge IELTS 11',
      persona: 'cassette', eyes: 'curious',
      palette: { fur: '#754C34', furDark: '#553623', spine: '#3F2719', belly: '#FBF5E8', accent: '#ECC67A', cheek: '#EA9F8C' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Giọng UK · AU · NZ',
      review: 'Cột mốc bước sang cấu trúc đề hiện đại — đa dạng giọng đọc vùng miền, rèn tai thích nghi nối âm tự nhiên.'
    },
    {
      id: 'lcam_10', source: 'cambridge', num: 10, testsCount: 4,
      title: 'Cambridge IELTS 10',
      persona: 'wave', eyes: 'calm',
      palette: { fur: '#2D4A78', furDark: '#1F3559', spine: '#162642', belly: '#FAF5E9', accent: '#EBC271', cheek: '#E79E97' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Full Test chuẩn mực',
      review: 'Cấu trúc cân đối giữa điền từ và trắc nghiệm — rất hợp bấm giờ thi thử trọn vẹn 40 câu trong 30 phút.'
    },
    {
      id: 'lcam_9', source: 'cambridge', num: 9, testsCount: 4,
      title: 'Cambridge IELTS 9',
      persona: 'lotus', eyes: 'happy',
      palette: { fur: '#3B6D5A', furDark: '#294E40', spine: '#1D392E', belly: '#FAF5E8', accent: '#E8C16E', cheek: '#E89D8C' },
      stars: 3, diff: 'Band 6.0–7.0', tag: 'Phát âm chuẩn cổ điển',
      review: 'Giọng đọc chuẩn mực, phát âm rõ ràng — phù hợp luyện ăn điểm tuyệt đối 10/10 ở Part 1 & Part 2.'
    },
    {
      id: 'lcam_8', source: 'cambridge', num: 8, testsCount: 4,
      title: 'Cambridge IELTS 8',
      persona: 'telescope', eyes: 'starry',
      palette: { fur: '#6F4C60', furDark: '#503545', spine: '#3B2633', belly: '#FAF4E9', accent: '#ECC77A', cheek: '#EB9FA3' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Khoa học & Lịch sử',
      review: 'Nhiều bài giảng Part 4 kinh điển về lịch sử và địa lý — giúp mở rộng vốn từ học thuật lặp lại thường xuyên.'
    },
    {
      id: 'lcam_7', source: 'cambridge', num: 7, testsCount: 4,
      title: 'Cambridge IELTS 7',
      persona: 'ocarina', eyes: 'happy',
      palette: { fur: '#8C5838', furDark: '#663F27', spine: '#4B2D1B', belly: '#FBF5E8', accent: '#F0CA7B', cheek: '#EDA08B' },
      stars: 3, diff: 'Band 6.0–7.0', tag: 'Bố cục thẳng mạch',
      review: 'Ít bẫy đánh lạc hướng phức tạp — rất tốt cho người mới chuyển từ luyện kỹ năng sang làm đề Cambridge thật.'
    },
    {
      id: 'lcam_6', source: 'cambridge', num: 6, testsCount: 4,
      title: 'Cambridge IELTS 6',
      persona: 'gear', eyes: 'alert',
      palette: { fur: '#2B5E6A', furDark: '#1D434C', spine: '#143037', belly: '#FAF5E8', accent: '#E7C072', cheek: '#E79D90' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Flow-chart & Diagram',
      review: 'Nổi bật dạng sơ đồ quy trình & mô tả kỹ thuật — luyện kỹ năng bám sát trình tự bước trong bài nói.'
    },
    {
      id: 'lcam_5', source: 'cambridge', num: 5, testsCount: 4,
      title: 'Cambridge IELTS 5',
      persona: 'oak', eyes: 'gentle',
      palette: { fur: '#5C533D', furDark: '#423B2B', spine: '#302B1F', belly: '#FAF5E8', accent: '#EBC87D', cheek: '#E89D8B' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Giáo dục & Thư viện',
      review: 'Chủ đề trường học, đăng ký thư viện và bài thuyết trình kinh điển — nguồn từ vựng Paraphrase gốc cực chắc.'
    },
    {
      id: 'lcam_4', source: 'cambridge', num: 4, testsCount: 4,
      title: 'Cambridge IELTS 4',
      persona: 'crane', eyes: 'calm',
      palette: { fur: '#465B7A', furDark: '#314159', spine: '#232F42', belly: '#FAF5E9', accent: '#E8C173', cheek: '#E69D95' },
      stars: 3, diff: 'Band 5.5–7.0', tag: 'Số liệu & Chính tả',
      review: 'Tốc độ đọc vừa phải — thích hợp luyện phản xạ bắt nhanh số điện thoại, mã bưu điện, ngày tháng và tên riêng.'
    },
    {
      id: 'lcam_3', source: 'cambridge', num: 3, testsCount: 4,
      title: 'Cambridge IELTS 3',
      persona: 'mic', eyes: 'curious',
      palette: { fur: '#7E4540', furDark: '#5B302C', spine: '#43221F', belly: '#FAF4E8', accent: '#F0C77C', cheek: '#EC9E96' },
      stars: 3, diff: 'Band 5.5–7.0', tag: 'Hội thoại đời sống',
      review: 'Các đoạn hội thoại ngắn gọn, rõ ý — giúp xây tự tin khi luyện nghe 1 lượt không cần tua lại.'
    },
    {
      id: 'lcam_2', source: 'cambridge', num: 2, testsCount: 4,
      title: 'Cambridge IELTS 2',
      persona: 'clover', eyes: 'happy',
      palette: { fur: '#3A654D', furDark: '#284836', spine: '#1C3426', belly: '#FAF5E8', accent: '#E9C372', cheek: '#E89E8E' },
      stars: 3, diff: 'Band 5.5–6.5', tag: 'Làm nóng nền tảng',
      review: 'Ngữ liệu gần gũi, cấu trúc câu trực diện — phù hợp khởi động tai nghe trước khi bước vào Cam 12–20.'
    },
    {
      id: 'lcam_1', source: 'cambridge', num: 1, testsCount: 4,
      title: 'Cambridge IELTS 1',
      persona: 'chibi', eyes: 'starry',
      palette: { fur: '#5C4B68', furDark: '#42354B', spine: '#302637', belly: '#FAF4EA', accent: '#E7BF74', cheek: '#EA9EA5' },
      stars: 2, diff: 'Band 5.5–6.5', tag: 'Khởi động 4 Part',
      review: 'Cuốn nhập môn kinh điển của bộ Cambridge — từ vựng cơ bản, lý tưởng làm quen trọn vẹn bố cục IELTS Listening.'
    }
  ];

  /* ---------------------------------------------------------
     9 UNIQUE REAL LISTENING VOLUMES (EXACT 3x3 GRID)
     --------------------------------------------------------- */
  const VOLUME_BOOKS = [
    {
      id: 'lvol_1', source: 'volume', num: 1, testsCount: 4,
      title: 'Real Listening Vol 01',
      persona: 'headphones', eyes: 'alert',
      palette: { fur: '#2B5E54', furDark: '#1C433B', spine: '#132F2A', belly: '#FAF5E8', accent: '#EBC26B', cheek: '#E89B8B' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Phòng thi tốc độ 1.05×',
      review: 'Tập 01 tuyển chọn các đề có tốc độ nói tự nhiên nhanh và nhiều bẫy phủ định ẩn ở Part 2–3.'
    },
    {
      id: 'lvol_2', source: 'volume', num: 2, testsCount: 4,
      title: 'Real Listening Vol 02',
      persona: 'compass', eyes: 'curious',
      palette: { fur: '#284F73', furDark: '#1B3853', spine: '#12273B', belly: '#FAF5E9', accent: '#EDC672', cheek: '#E89E96' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Chuyên đề Map & Plan',
      review: 'Tập trung mạnh vào sơ đồ khu phức hợp, bùng binh và tòa nhà nhiều tầng — rèn tư duy phương hướng.'
    },
    {
      id: 'lvol_3', source: 'volume', num: 3, testsCount: 4,
      title: 'Real Listening Vol 03',
      persona: 'lantern', eyes: 'calm',
      palette: { fur: '#8E4936', furDark: '#693425', spine: '#4D251A', belly: '#FBF5E8', accent: '#F2CA78', cheek: '#EDA08E' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Matching Opinion P3',
      review: 'Tối ưu dạng nối quan điểm sinh viên – giảng viên với nhiều từ nối đảo chiều tinh vi.'
    },
    {
      id: 'lvol_4', source: 'volume', num: 4, testsCount: 4,
      title: 'Real Listening Vol 04',
      persona: 'soot', eyes: 'starry',
      palette: { fur: '#53416E', furDark: '#3A2D4F', spine: '#291F39', belly: '#FAF4EA', accent: '#ECC474', cheek: '#EA9EA3' },
      stars: 4, diff: 'Band 7.5–8.5', tag: 'Part 4 Không ngắt nghỉ',
      review: 'Bài giảng Part 4 liên tục 10 câu không dừng giữa đoạn — rèn sức bền tập trung và dự đoán từ loại.'
    },
    {
      id: 'lvol_5', source: 'volume', num: 5, testsCount: 4,
      title: 'Real Listening Vol 05',
      persona: 'ginkgo', eyes: 'happy',
      palette: { fur: '#8F6426', furDark: '#6A4919', spine: '#4E3511', belly: '#FCF6E9', accent: '#F4DA8E', cheek: '#ECA28A' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Distractor Số & Giá',
      review: 'Chuyên trị các bẫy giá vé, lịch trình thay đổi và số lượng giới hạn ở Part 1–2.'
    },
    {
      id: 'lvol_6', source: 'volume', num: 6, testsCount: 4,
      title: 'Real Listening Vol 06',
      persona: 'mic', eyes: 'alert',
      palette: { fur: '#374854', furDark: '#25323B', spine: '#192229', belly: '#FAF4E8', accent: '#E8BC64', cheek: '#E5998D' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'MCQ Dài Band 8+',
      review: 'Câu hỏi trắc nghiệm A/B/C dài nhiều mệnh đề Paraphrase — luyện kỹ năng đọc lướt trước băng.'
    },
    {
      id: 'lvol_7', source: 'volume', num: 7, testsCount: 4,
      title: 'Real Listening Vol 07',
      persona: 'wave', eyes: 'calm',
      palette: { fur: '#226168', furDark: '#16454B', spine: '#0F3236', belly: '#FAF5E8', accent: '#ECC573', cheek: '#E89D90' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'Giọng Úc & Scotland',
      review: 'Tăng cường tỷ trọng giọng Úc, New Zealand và Anh vùng miền giúp không bị ngợp trong phòng thi thật.'
    },
    {
      id: 'lvol_8', source: 'volume', num: 8, testsCount: 4,
      title: 'Real Listening Vol 08',
      persona: 'telescope', eyes: 'curious',
      palette: { fur: '#7B3C49', furDark: '#592933', spine: '#411D25', belly: '#FAF4E8', accent: '#F0C87B', cheek: '#EC9E9E' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'Khoa học Môi trường',
      review: 'Chuyên sâu chủ đề sinh học biển, khí hậu và khảo cổ — từ vựng học thuật giàu tính hệ thống.'
    },
    {
      id: 'lvol_9', source: 'volume', num: 9, testsCount: 4,
      title: 'Real Listening Vol 09',
      persona: 'oak', eyes: 'alert',
      palette: { fur: '#466439', furDark: '#314827', spine: '#22331B', belly: '#FAF5E7', accent: '#EDCC7A', cheek: '#E89D8B' },
      stars: 5, diff: 'Band 8.0–9.0', tag: 'Đề tổng ôn Về đích',
      review: 'Tập chốt hạ tổng hợp toàn bộ dạng khó nhất trước ngày thi — lý tưởng bấm giờ Full Test 30 phút.'
    }
  ];

  /* ---------------------------------------------------------
     9 UNIQUE RECENT ACTUAL SETS (EXACT 3x3 GRID)
     --------------------------------------------------------- */
  const ACTUAL_SETS = [
    {
      id: 'lact_1', source: 'actual', num: 1, testsCount: 4,
      title: 'Actual Listening Set 01',
      persona: 'mic', eyes: 'alert',
      palette: { fur: '#2E5D47', furDark: '#1F4232', spine: '#163024', belly: '#FAF5E8', accent: '#E8BE65', cheek: '#E89B8B' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Quý mới nhất · 2026',
      review: 'Tuyển tập đề thi thật gần đây — nổi bật Part 1 đặt dịch vụ du lịch và Part 4 đô thị bền vững.'
    },
    {
      id: 'lact_2', source: 'actual', num: 2, testsCount: 4,
      title: 'Actual Listening Set 02',
      persona: 'umbrella', eyes: 'curious',
      palette: { fur: '#295070', furDark: '#1B3850', spine: '#13283A', belly: '#FAF5E9', accent: '#ECC36E', cheek: '#E79E96' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Map Khuôn viên & Bảo tàng',
      review: 'Đề thi máy nổi bật với các bản đồ cải tạo công viên, bảo tàng và trung tâm nghệ thuật.'
    },
    {
      id: 'lact_3', source: 'actual', num: 3, testsCount: 4,
      title: 'Actual Listening Set 03',
      persona: 'cassette', eyes: 'happy',
      palette: { fur: '#8E4E34', furDark: '#683724', spine: '#4C2819', belly: '#FBF5E8', accent: '#F0C976', cheek: '#EDA08D' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Form & Table Completion',
      review: 'Bám sát các bẫy chính tả từ ghép, ngày tháng và địa chỉ thực tế hay ra gần đây.'
    },
    {
      id: 'lact_4', source: 'actual', num: 4, testsCount: 4,
      title: 'Actual Listening Set 04',
      persona: 'moon', eyes: 'calm',
      palette: { fur: '#574572', furDark: '#3E3054', spine: '#2C223D', belly: '#FAF4EA', accent: '#EBC273', cheek: '#E99DA4' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Dự án Nghiên cứu P3',
      review: 'Hội thoại nhóm sinh viên phân tích dữ liệu & phương pháp khảo sát — mật độ Paraphrase cao.'
    },
    {
      id: 'lact_5', source: 'actual', num: 5, testsCount: 4,
      title: 'Actual Listening Set 05',
      persona: 'lotus', eyes: 'gentle',
      palette: { fur: '#24625D', furDark: '#174642', spine: '#103330', belly: '#FAF5E8', accent: '#ECC672', cheek: '#E89D8F' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Sinh thái & Bảo tồn P4',
      review: 'Bài giảng học thuật chủ đề động vật hoang dã, phục hồi cửa sông và nông nghiệp xanh.'
    },
    {
      id: 'lact_6', source: 'actual', num: 6, testsCount: 4,
      title: 'Actual Listening Set 06',
      persona: 'acorn', eyes: 'happy',
      palette: { fur: '#916628', furDark: '#6A491A', spine: '#4E3512', belly: '#FCF6E9', accent: '#F4DA8E', cheek: '#ECA28A' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Sự kiện & Lễ hội P2',
      review: 'Giới thiệu sự kiện cộng đồng, lịch trình tham quan và lưu ý an toàn có nhiều chi tiết bẫy.'
    },
    {
      id: 'lact_7', source: 'actual', num: 7, testsCount: 4,
      title: 'Actual Listening Set 07',
      persona: 'gear', eyes: 'alert',
      palette: { fur: '#3E4854', furDark: '#2B333C', spine: '#1F252C', belly: '#FAF4E8', accent: '#E8BC64', cheek: '#E5998D' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Công nghệ & Quy trình',
      review: 'Nhiều câu điền sơ đồ kỹ thuật và lịch sử phát minh — yêu cầu nghe rõ danh từ học thuật.'
    },
    {
      id: 'lact_8', source: 'actual', num: 8, testsCount: 4,
      title: 'Actual Listening Set 08',
      persona: 'crane', eyes: 'curious',
      palette: { fur: '#823D48', furDark: '#5E2B33', spine: '#461F25', belly: '#FAF4E8', accent: '#F0C77B', cheek: '#EC9E9E' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Tâm lý & Giáo dục P4',
      review: 'Chủ đề tâm lý hành vi và giáo dục hiện đại — luyện nghe ý ngầm và tránh bẫy từ trái nghĩa.'
    },
    {
      id: 'lact_9', source: 'actual', num: 9, testsCount: 4,
      title: 'Actual Listening Set 09',
      persona: 'ocarina', eyes: 'starry',
      palette: { fur: '#4A673B', furDark: '#344B29', spine: '#25361C', belly: '#FAF5E7', accent: '#ECCB7A', cheek: '#E89D8B' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Nghệ thuật & Kiến trúc',
      review: 'Tổng hợp đề thi thật chủ đề bảo tồn kiến trúc, âm nhạc và thủ công truyền thống.'
    }
  ];

  /* ---------------------------------------------------------
     PRE-WIRED READY EXAMS (FLAGSHIP AUDIO NEURAL SLOTS)
     - Immediately playable right out of the box!
     - Additional imported exams merge cleanly via window.__LISTENING_BANKS__
     --------------------------------------------------------- */
  const PARTS = {
    // Cambridge 20 · Test 1 (Complete 4-Part playable demo using Flagship Audio Neural!)
    lcam_20_t1_p1: {
      id: 'lcam_20_t1_p1', source: 'cambridge', bookId: 'lcam_20', testNum: 1, partNum: 1,
      taskId: 'lp1_01',
      title: 'Harbour Village Cycling Tour',
      subtitle: 'Hội thoại đăng ký tour đạp xe ven biển — bắt bẫy giá vé, ngày giờ & tên riêng.',
      qTypes: ['Note Completion'], questionsCount: 8, durationMin: 6, isMap: false
    },
    lcam_20_t1_p2: {
      id: 'lcam_20_t1_p2', source: 'cambridge', bookId: 'lcam_20', testNum: 1, partNum: 2,
      taskId: 'lmap_01',
      title: 'Botanical Park & Lakeside Map',
      subtitle: 'Bản đồ công viên thực vật & hồ di sản — định hướng lối vào, cầu gỗ và khu triển lãm.',
      qTypes: ['Map Labelling'], questionsCount: 6, durationMin: 6, isMap: true
    },
    lcam_20_t1_p3: {
      id: 'lcam_20_t1_p3', source: 'cambridge', bookId: 'lcam_20', testNum: 1, partNum: 3,
      taskId: 'lp3_01',
      title: 'Sustainable Materials Research',
      subtitle: 'Thảo luận học thuật về vật liệu bền vững — bẫy đổi quan điểm giữa hai sinh viên.',
      qTypes: ['Note Completion'], questionsCount: 8, durationMin: 7, isMap: false
    },
    lcam_20_t1_p4: {
      id: 'lcam_20_t1_p4', source: 'cambridge', bookId: 'lcam_20', testNum: 1, partNum: 4,
      taskId: 'lp4_01',
      title: 'Restoring River Estuaries',
      subtitle: 'Bài giảng học thuật về phục hồi cửa sông & giám sát hệ sinh thái biển.',
      qTypes: ['Lecture Notes'], questionsCount: 8, durationMin: 8, isMap: false
    },

    // Cambridge 20 · Test 2 (Complete 4-Part playable demo!)
    lcam_20_t2_p1: {
      id: 'lcam_20_t2_p1', source: 'cambridge', bookId: 'lcam_20', testNum: 2, partNum: 1,
      taskId: 'lp1_02',
      title: 'Bayview Hostel Summer Job',
      subtitle: 'Phỏng vấn việc làm mùa hè ven biển — nghe kỹ ca làm, lương giờ và yêu cầu hồ sơ.',
      qTypes: ['Note Completion'], questionsCount: 8, durationMin: 6, isMap: false
    },
    lcam_20_t2_p2: {
      id: 'lcam_20_t2_p2', source: 'cambridge', bookId: 'lcam_20', testNum: 2, partNum: 2,
      taskId: 'lmap_02',
      title: 'Market Town & Roundabout Map',
      subtitle: 'Bản đồ quy hoạch trung tâm thị trấn có bùng binh — xác định vị trí các công trình mới.',
      qTypes: ['Map Labelling'], questionsCount: 6, durationMin: 6, isMap: true
    },
    lcam_20_t2_p3: {
      id: 'lcam_20_t2_p3', source: 'cambridge', bookId: 'lcam_20', testNum: 2, partNum: 3,
      taskId: 'lp3_02',
      title: 'Recycling & Dissertation Design',
      subtitle: 'Trao đổi thiết kế luận văn nghiên cứu tái chế — bẫy Paraphrase học thuật.',
      qTypes: ['Note Completion'], questionsCount: 8, durationMin: 7, isMap: false
    },
    lcam_20_t2_p4: {
      id: 'lcam_20_t2_p4', source: 'cambridge', bookId: 'lcam_20', testNum: 2, partNum: 4,
      taskId: 'lp4_02',
      title: 'Historic Port Urban Zones',
      subtitle: 'Bài giảng cải tạo cảng lịch sử thành khu đô thị sinh thái ít phát thải.',
      qTypes: ['Lecture Notes'], questionsCount: 8, durationMin: 8, isMap: false
    },

    // Cambridge 19 · Test 1 (Part 2 Map & Monologue Showcase)
    lcam_19_t1_p2a: {
      id: 'lcam_19_t1_p2a', source: 'cambridge', bookId: 'lcam_19', testNum: 1, partNum: 2,
      taskId: 'lmap_03',
      title: 'University Arts Centre Floor Plan',
      subtitle: 'Mặt bằng trung tâm nghệ thuật đại học — chỉ đường sảnh chính, phòng thu & thư viện.',
      qTypes: ['Floor Plan'], questionsCount: 6, durationMin: 6, isMap: true
    },
    lcam_19_t1_p2b: {
      id: 'lcam_19_t1_p2b', source: 'cambridge', bookId: 'lcam_19', testNum: 1, partNum: 2,
      taskId: 'lp2_01',
      title: 'Harbourside Heritage Park Guide',
      subtitle: 'Hướng dẫn tham quan công viên di sản ven cảng — bắt chi tiết khung giờ & khu vực.',
      qTypes: ['Note Completion'], questionsCount: 8, durationMin: 6, isMap: false
    },
    lcam_19_t2_p2: {
      id: 'lcam_19_t2_p2', source: 'cambridge', bookId: 'lcam_19', testNum: 2, partNum: 2,
      taskId: 'lp2_02',
      title: 'Riverside Craft & Cinema Festival',
      subtitle: 'Thông báo lễ hội thủ công & điện ảnh mùa thu — lưu ý vé vào cửa và địa điểm phụ.',
      qTypes: ['Note Completion'], questionsCount: 8, durationMin: 6, isMap: false
    }
  };

  const FULL_TESTS = [
    {
      id: 'lcam_20_t1_full',
      source: 'cambridge',
      bookId: 'lcam_20',
      testNum: 1,
      title: 'Cambridge 20 · Test 1',
      subtitle: 'Trọn bộ Part 1 → Part 4 chuẩn phòng thi Cambridge — bao gồm Note Completion, Map Labelling và bài giảng học thuật.',
      partIds: ['lcam_20_t1_p1', 'lcam_20_t1_p2', 'lcam_20_t1_p3', 'lcam_20_t1_p4'],
      questionsCount: 30,
      durationMin: 27
    },
    {
      id: 'lcam_20_t2_full',
      source: 'cambridge',
      bookId: 'lcam_20',
      testNum: 2,
      title: 'Cambridge 20 · Test 2',
      subtitle: 'Trọn bộ Part 1 → Part 4 chuẩn phòng thi Cambridge — nổi bật bản đồ thị trấn có bùng binh và thảo luận luận văn.',
      partIds: ['lcam_20_t2_p1', 'lcam_20_t2_p2', 'lcam_20_t2_p3', 'lcam_20_t2_p4'],
      questionsCount: 30,
      durationMin: 27
    }
  ];

  window.LISTENING_PRACTICE_DATA = {
    SOURCES,
    CAMBRIDGE_BOOKS,
    VOLUME_BOOKS,
    ACTUAL_SETS,
    PARTS,
    FULL_TESTS,
    BANK_META: {
      cambridge: { file: 'data/bank_listening_cambridge.js', totalBooks: 20, totalTests: 80 },
      volume: { file: 'data/bank_listening_volume.js', totalBooks: 9, totalTests: 36 },
      actual: { file: 'data/bank_listening_actual.js', totalBooks: 9, totalTests: 36 }
    }
  };
})();
