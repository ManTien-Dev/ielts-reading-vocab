/* =========================================================
   DATA CATALOG: IELTS LISTENING PRACTICE (3x3 PORTAL + CLEAN EXAM BANKS)
   - Row 1 (3 Exam Banks mirroring Reading Practice):
       1. Cambridge IELTS (1-20 · Cam 10-20 & Cam 1-9)
       2. Real Listening Tests (Volume 1-10)
       3. Recent Actual Tests (Part 1 / Part 2 / Part 3 / Part 4 / FULL TEST)
   - Row 2 (3 Core Supplementary Drills - kept intact):
       4. Map Labelling (Part 2)
       5. Note Completion (Parts 1-4)
       6. Dictation & Tasks (139 Tasks)
   - Row 3 (3 Listening Reflex Labs):
       7. Speed Quiz
       8. Signal Words & Traps
       9. Voice & Accent Lab
   - Clean Import Hooks (zero fake tasks mixed into Cambridge/Volume/Actual):
       window.__LISTENING_BANKS__ = { cambridge, volume, actual }
   ========================================================= */
(function () {
  'use strict';

  const PORTAL_CARDS = [
    // ROW 1: 3 REAL IELTS EXAM BANKS (mirroring Reading Practice)
    {
      id: 'cambridge',
      row: 'exams',
      label: 'Cambridge IELTS',
      bookTitle: 'Cambridge IELTS 1–20',
      badge: '★ 20 Books',
      desc: 'Đầy đủ khung 20 cuốn Cambridge chuẩn phòng thi thật — nổi bật bẫy Paraphrase Part 3–4 và Map Labelling.',
      scene: 'cambridge',
      kind: 'source'
    },
    {
      id: 'volume',
      row: 'exams',
      label: 'Volume',
      bookTitle: 'Real Listening Tests 1–10',
      badge: '10 Volumes',
      desc: '10 tập đề thực chiến mật độ Distractor dày — rèn phản xạ bắt bẫy đổi ý từ Band 7.0 đến 9.0.',
      scene: 'volume',
      kind: 'source'
    },
    {
      id: 'actual',
      row: 'exams',
      label: 'Recent Actual Tests',
      bookTitle: 'Recent Actual Tests',
      badge: 'Parts 1–4 · FULL TEST',
      desc: 'Kho đề thi thật gần đây lọc trực tiếp theo Part 1, Part 2, Part 3, Part 4 hoặc FULL TEST 30 phút.',
      scene: 'actual',
      kind: 'source'
    },

    // ROW 2: 3 CORE SUPPLEMENTARY DRILLS (kept intact from original Listening Practice)
    {
      id: 'map_labelling',
      row: 'drills',
      label: 'Map Labelling',
      bookTitle: 'Map Labelling · Part 2',
      badge: '★ 3 Maps',
      desc: 'Bản đồ công viên, thị trấn có bùng binh và mặt bằng tòa nhà — chấm trực tiếp trên bản đồ và đối chiếu Transcript.',
      scene: 'map',
      kind: 'map_drill'
    },
    {
      id: 'note_completion',
      row: 'drills',
      label: 'Note Completion',
      bookTitle: 'Note Completion · Parts 1–4',
      badge: '★ 8 Tests',
      desc: 'Luyện nghe điền từ chuẩn chính tả Cambridge qua 4 Part — tự động phát 2 lượt và mở khóa nghe lại từng câu.',
      scene: 'note',
      kind: 'note_drill'
    },
    {
      id: 'dictation_tasks',
      row: 'drills',
      label: 'Listening Tasks',
      bookTitle: 'Dictation & Spelling Tasks',
      badge: '139 Tasks',
      desc: 'Lộ trình 139 bài Task theo chủ đề phủ kín 3.864 từ cốt lõi — nghe chính tả, hội thoại A/B/C và thực chiến.',
      scene: 'tasks',
      kind: 'tasks_hub'
    },

    // ROW 3: 3 LISTENING REFLEX & SKILL LABS (completing crisp 3x3 grid)
    {
      id: 'speed_quiz',
      row: 'labs',
      label: 'Speed Quiz',
      bookTitle: 'Listening Speed Quiz',
      badge: '6s / từ',
      desc: 'Nghe phản xạ ẩn mặt chữ xoay vòng giọng UK, AU, US — trộn câu hỏi Paraphrase và bẫy từ trái nghĩa.',
      scene: 'speed',
      kind: 'speed_quiz'
    },
    {
      id: 'signal_traps',
      row: 'labs',
      label: 'Signal Words',
      bookTitle: 'Signal Words & Traps',
      badge: '40 Cues',
      desc: '40 cụm từ tín hiệu chuyển ý và bẫy đổi đáp án phút chót xuất hiện dày đặc trong Part 1 đến Part 4.',
      scene: 'traps',
      kind: 'signal_deck'
    },
    {
      id: 'voice_lab',
      row: 'labs',
      label: 'Voice Lab',
      bookTitle: 'Pronunciation & Mic Lab',
      badge: 'UK · AU · US',
      desc: 'Kiểm tra Micro, luyện phát âm chuẩn theo giọng bản xứ để tăng độ nhạy nhận diện nối âm khi nghe.',
      scene: 'voice',
      kind: 'voice_lab'
    }
  ];

  /* ---------------------------------------------------------
     20 UNIQUE TOTORO-SHAPED CAMBRIDGE LISTENING BOOKS (20 -> 1)
     Mirrors Reading grouping: Cam 10-20 (11 books) & Cam 1-9 (9 books)
     --------------------------------------------------------- */
  const CAMBRIDGE_BOOKS = [
    {
      id: 'lcam_20', source: 'cambridge', num: 20, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 20',
      persona: 'headphones', eyes: 'alert',
      palette: { fur: '#2F6049', furDark: '#204534', spine: '#193729', belly: '#FAF4E6', accent: '#E5B95C', cheek: '#E89B8B' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Chuẩn 2025 · Paraphrase',
      review: 'Cập nhật mới nhất — tốc độ nói tự nhiên, nhiều bẫy đồng nghĩa ở Part 3 thảo luận học thuật và Part 4 bài giảng sinh thái.'
    },
    {
      id: 'lcam_19', source: 'cambridge', num: 19, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 19',
      persona: 'umbrella', eyes: 'calm',
      palette: { fur: '#275274', furDark: '#1A3A54', spine: '#132B40', belly: '#F9F4E8', accent: '#E8C068', cheek: '#E69F95' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Map Part 2 · Đa giọng',
      review: 'Nổi bật dạng Map Labelling và giọng Anh–Úc đan xen. Rất sát độ khó thi máy thực tế với nhịp chuyển câu nhanh.'
    },
    {
      id: 'lcam_18', source: 'cambridge', num: 18, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 18',
      persona: 'acorn', eyes: 'happy',
      palette: { fur: '#974E35', furDark: '#723824', spine: '#58291A', belly: '#FBF5E8', accent: '#F0C772', cheek: '#F0A490' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Bẫy đổi ý Part 1',
      review: 'Cân bằng đời sống & học thuật — tần suất cao bẫy sửa thông tin phút chót ở Part 1 và Part 2.'
    },
    {
      id: 'lcam_17', source: 'cambridge', num: 17, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 17',
      persona: 'moon', eyes: 'gentle',
      palette: { fur: '#594474', furDark: '#403057', spine: '#302242', belly: '#FAF4EA', accent: '#EBC274', cheek: '#E79CA3' },
      stars: 3, diff: 'Band 6.5–7.5', tag: 'Luyện tốc độ nghe',
      review: 'Nhịp đọc đều và rõ âm cuối — cực hợp rèn chính tả số ít/số nhiều để bứt từ Band 6.5 lên 7.5.'
    },
    {
      id: 'lcam_16', source: 'cambridge', num: 16, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 16',
      persona: 'soot', eyes: 'curious',
      palette: { fur: '#236360', furDark: '#174745', spine: '#103533', belly: '#FAF5E9', accent: '#ECC670', cheek: '#E89D8F' },
      stars: 4, diff: 'Band 7.0–8.0', tag: 'Part 4 Học thuật C1',
      review: 'Giàu từ vựng học thuật Part 4 về khoa học & công nghệ — rèn kỹ năng bám Signposting qua các câu dài.'
    },
    {
      id: 'lcam_15', source: 'cambridge', num: 15, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 15',
      persona: 'ginkgo', eyes: 'happy',
      palette: { fur: '#966828', furDark: '#704C1A', spine: '#543812', belly: '#FCF6E9', accent: '#F4DA8E', cheek: '#ECA28A' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Mạch nói sáng rõ',
      review: 'Độ khó vừa tầm, phân đoạn ý mạch lạc — lý tưởng làm quen chiến thuật gạch keyword và dự đoán từ loại.'
    },
    {
      id: 'lcam_14', source: 'cambridge', num: 14, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 14',
      persona: 'lantern', eyes: 'calm',
      palette: { fur: '#3E4854', furDark: '#2A323B', spine: '#1E242B', belly: '#F9F3E7', accent: '#E8B85F', cheek: '#E4988C' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Thảo luận 2 chiều P3',
      review: 'Nổi tiếng với Part 3 tranh luận giữa hai sinh viên — nhiều bẫy đồng tình giả rồi phản bác ở câu tiếp theo.'
    },
    {
      id: 'lcam_13', source: 'cambridge', num: 13, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 13',
      persona: 'compass', eyes: 'alert',
      palette: { fur: '#873E49', furDark: '#632B34', spine: '#4B1F26', belly: '#FAF4E8', accent: '#F0C77B', cheek: '#ED9E9E' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Bản đồ & Chọn đáp án',
      review: 'Xuất hiện dày dạng Map Labelling định hướng Đông–Tây và Multiple Choice dài — rèn khả năng lọc nhiễu cực tốt.'
    },
    {
      id: 'lcam_12', source: 'cambridge', num: 12, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 12',
      persona: 'fern', eyes: 'gentle',
      palette: { fur: '#4B6B3A', furDark: '#364E29', spine: '#273A1D', belly: '#FAF5E7', accent: '#ECCB79', cheek: '#E89D8B' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Tự nhiên & Bảo tồn',
      review: 'Chủ đề thiên nhiên, du lịch và khảo cổ dễ hình dung — phù hợp xây nền tảng nghe chép ổn định ở cả 4 Part.'
    },
    {
      id: 'lcam_11', source: 'cambridge', num: 11, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 11',
      persona: 'cassette', eyes: 'curious',
      palette: { fur: '#754C34', furDark: '#553623', spine: '#3F2719', belly: '#FBF5E8', accent: '#ECC67A', cheek: '#EA9F8C' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Giọng UK · AU · NZ',
      review: 'Cột mốc bước sang cấu trúc đề hiện đại — đa dạng giọng đọc vùng miền, rèn tai thích nghi nối âm tự nhiên.'
    },
    {
      id: 'lcam_10', source: 'cambridge', num: 10, group: 'recent', testsCount: 4,
      title: 'Cambridge IELTS 10',
      persona: 'wave', eyes: 'calm',
      palette: { fur: '#2D4A78', furDark: '#1F3559', spine: '#162642', belly: '#FAF5E9', accent: '#EBC271', cheek: '#E79E97' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'FULL TEST chuẩn mực',
      review: 'Cấu trúc cân đối giữa điền từ và trắc nghiệm — rất hợp bấm giờ thi thử trọn vẹn 40 câu trong 30 phút.'
    },
    {
      id: 'lcam_9', source: 'cambridge', num: 9, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 9',
      persona: 'lotus', eyes: 'happy',
      palette: { fur: '#3B6D5A', furDark: '#294E40', spine: '#1D392E', belly: '#FAF5E8', accent: '#E8C16E', cheek: '#E89D8C' },
      stars: 3, diff: 'Band 6.0–7.0', tag: 'Phát âm chuẩn cổ điển',
      review: 'Giọng đọc chuẩn mực, phát âm rõ ràng — phù hợp luyện ăn điểm tuyệt đối 10/10 ở Part 1 & Part 2.'
    },
    {
      id: 'lcam_8', source: 'cambridge', num: 8, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 8',
      persona: 'telescope', eyes: 'starry',
      palette: { fur: '#6F4C60', furDark: '#503545', spine: '#3B2633', belly: '#FAF4E9', accent: '#ECC77A', cheek: '#EB9FA3' },
      stars: 4, diff: 'Band 6.5–8.0', tag: 'Khoa học & Lịch sử',
      review: 'Nhiều bài giảng Part 4 kinh điển về lịch sử và địa lý — giúp mở rộng vốn từ học thuật lặp lại thường xuyên.'
    },
    {
      id: 'lcam_7', source: 'cambridge', num: 7, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 7',
      persona: 'ocarina', eyes: 'happy',
      palette: { fur: '#8C5838', furDark: '#663F27', spine: '#4B2D1B', belly: '#FBF5E8', accent: '#F0CA7B', cheek: '#EDA08B' },
      stars: 3, diff: 'Band 6.0–7.0', tag: 'Bố cục thẳng mạch',
      review: 'Ít bẫy đánh lạc hướng phức tạp — rất tốt cho người mới chuyển từ luyện kỹ năng sang làm đề Cambridge thật.'
    },
    {
      id: 'lcam_6', source: 'cambridge', num: 6, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 6',
      persona: 'gear', eyes: 'alert',
      palette: { fur: '#2B5E6A', furDark: '#1D434C', spine: '#143037', belly: '#FAF5E8', accent: '#E7C072', cheek: '#E79D90' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Flow-chart & Diagram',
      review: 'Nổi bật dạng sơ đồ quy trình & mô tả kỹ thuật — luyện kỹ năng bám sát trình tự bước trong bài nói.'
    },
    {
      id: 'lcam_5', source: 'cambridge', num: 5, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 5',
      persona: 'oak', eyes: 'gentle',
      palette: { fur: '#5C533D', furDark: '#423B2B', spine: '#302B1F', belly: '#FAF5E8', accent: '#EBC87D', cheek: '#E89D8B' },
      stars: 3, diff: 'Band 6.0–7.5', tag: 'Giáo dục & Thư viện',
      review: 'Chủ đề trường học, đăng ký thư viện và bài thuyết trình kinh điển — nguồn từ vựng Paraphrase gốc cực chắc.'
    },
    {
      id: 'lcam_4', source: 'cambridge', num: 4, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 4',
      persona: 'crane', eyes: 'calm',
      palette: { fur: '#465B7A', furDark: '#314159', spine: '#232F42', belly: '#FAF5E9', accent: '#E8C173', cheek: '#E69D95' },
      stars: 3, diff: 'Band 5.5–7.0', tag: 'Số liệu & Chính tả',
      review: 'Tốc độ đọc vừa phải — thích hợp luyện phản xạ bắt nhanh số điện thoại, mã bưu điện, ngày tháng và tên riêng.'
    },
    {
      id: 'lcam_3', source: 'cambridge', num: 3, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 3',
      persona: 'mic', eyes: 'curious',
      palette: { fur: '#7E4540', furDark: '#5B302C', spine: '#43221F', belly: '#FAF4E8', accent: '#F0C77C', cheek: '#EC9E96' },
      stars: 3, diff: 'Band 5.5–7.0', tag: 'Hội thoại đời sống',
      review: 'Các đoạn hội thoại ngắn gọn, rõ ý — giúp xây tự tin khi luyện nghe 1 lượt không cần tua lại.'
    },
    {
      id: 'lcam_2', source: 'cambridge', num: 2, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 2',
      persona: 'clover', eyes: 'happy',
      palette: { fur: '#3A654D', furDark: '#284836', spine: '#1C3426', belly: '#FAF5E8', accent: '#E9C372', cheek: '#E89E8E' },
      stars: 3, diff: 'Band 5.5–6.5', tag: 'Làm nóng nền tảng',
      review: 'Ngữ liệu gần gũi, cấu trúc câu trực diện — phù hợp khởi động tai nghe trước khi bước vào Cam 10–20.'
    },
    {
      id: 'lcam_1', source: 'cambridge', num: 1, group: 'classic', testsCount: 4,
      title: 'Cambridge IELTS 1',
      persona: 'chibi', eyes: 'starry',
      palette: { fur: '#5C4B68', furDark: '#42354B', spine: '#302637', belly: '#FAF4EA', accent: '#E7BF74', cheek: '#EA9EA5' },
      stars: 2, diff: 'Band 5.5–6.5', tag: 'Khởi động 4 Part',
      review: 'Cuốn nhập môn kinh điển của bộ Cambridge — từ vựng cơ bản, lý tưởng làm quen trọn vẹn bố cục IELTS Listening.'
    }
  ];

  /* ---------------------------------------------------------
     10 UNIQUE REAL LISTENING VOLUMES (Volume 1-10 · mirrors Reading)
     --------------------------------------------------------- */
  const VOLUME_BOOKS = [
    {
      id: 'lvol_1', source: 'volume', num: 1, testsCount: 4,
      title: 'Real Listening Test · Volume 1',
      persona: 'headphones', eyes: 'alert',
      palette: { fur: '#2B5E54', furDark: '#1C433B', spine: '#132F2A', belly: '#FAF5E8', accent: '#EBC26B', cheek: '#E89B8B' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Tốc độ thực chiến',
      review: 'Volume 01 tuyển chọn đề tốc độ tự nhiên nhanh với nhiều bẫy phủ định ẩn ở Part 2–3.'
    },
    {
      id: 'lvol_2', source: 'volume', num: 2, testsCount: 4,
      title: 'Real Listening Test · Volume 2',
      persona: 'compass', eyes: 'curious',
      palette: { fur: '#284F73', furDark: '#1B3853', spine: '#12273B', belly: '#FAF5E9', accent: '#EDC672', cheek: '#E89E96' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Map & Floor Plan',
      review: 'Tập trung mạnh vào sơ đồ khu phức hợp, bùng binh và tòa nhà nhiều tầng — rèn tư duy phương hướng.'
    },
    {
      id: 'lvol_3', source: 'volume', num: 3, testsCount: 4,
      title: 'Real Listening Test · Volume 3',
      persona: 'lantern', eyes: 'calm',
      palette: { fur: '#8E4936', furDark: '#693425', spine: '#4D251A', belly: '#FBF5E8', accent: '#F2CA78', cheek: '#EDA08E' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Matching Opinion P3',
      review: 'Tối ưu dạng nối quan điểm sinh viên – giảng viên với nhiều từ nối đảo chiều tinh vi.'
    },
    {
      id: 'lvol_4', source: 'volume', num: 4, testsCount: 4,
      title: 'Real Listening Test · Volume 4',
      persona: 'soot', eyes: 'starry',
      palette: { fur: '#53416E', furDark: '#3A2D4F', spine: '#291F39', belly: '#FAF4EA', accent: '#ECC474', cheek: '#EA9EA3' },
      stars: 4, diff: 'Band 7.5–8.5', tag: 'Part 4 Liên tục',
      review: 'Bài giảng Part 4 liên tục 10 câu không ngắt giữa đoạn — rèn sức bền tập trung và dự đoán từ loại.'
    },
    {
      id: 'lvol_5', source: 'volume', num: 5, testsCount: 4,
      title: 'Real Listening Test · Volume 5',
      persona: 'ginkgo', eyes: 'happy',
      palette: { fur: '#8F6426', furDark: '#6A4919', spine: '#4E3511', belly: '#FCF6E9', accent: '#F4DA8E', cheek: '#ECA28A' },
      stars: 4, diff: 'Band 7.0–8.5', tag: 'Distractor Số & Giá',
      review: 'Chuyên trị bẫy giá vé, lịch trình thay đổi và số lượng giới hạn ở Part 1–2.'
    },
    {
      id: 'lvol_6', source: 'volume', num: 6, testsCount: 4,
      title: 'Real Listening Test · Volume 6',
      persona: 'mic', eyes: 'alert',
      palette: { fur: '#374854', furDark: '#25323B', spine: '#192229', belly: '#FAF4E8', accent: '#E8BC64', cheek: '#E5998D' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'MCQ Dài Band 8+',
      review: 'Câu hỏi trắc nghiệm A/B/C dài nhiều mệnh đề Paraphrase — luyện đọc lướt trước băng.'
    },
    {
      id: 'lvol_7', source: 'volume', num: 7, testsCount: 4,
      title: 'Real Listening Test · Volume 7',
      persona: 'wave', eyes: 'calm',
      palette: { fur: '#226168', furDark: '#16454B', spine: '#0F3236', belly: '#FAF5E8', accent: '#ECC573', cheek: '#E89D90' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'Giọng Úc & Scotland',
      review: 'Tăng tỷ trọng giọng Úc, New Zealand và Anh vùng miền giúp vững vàng trong phòng thi thật.'
    },
    {
      id: 'lvol_8', source: 'volume', num: 8, testsCount: 4,
      title: 'Real Listening Test · Volume 8',
      persona: 'telescope', eyes: 'curious',
      palette: { fur: '#7B3C49', furDark: '#592933', spine: '#411D25', belly: '#FAF4E8', accent: '#F0C87B', cheek: '#EC9E9E' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'Khoa học Môi trường',
      review: 'Chuyên sâu sinh học biển, khí hậu và khảo cổ — từ vựng học thuật giàu tính hệ thống.'
    },
    {
      id: 'lvol_9', source: 'volume', num: 9, testsCount: 4,
      title: 'Real Listening Test · Volume 9',
      persona: 'oak', eyes: 'alert',
      palette: { fur: '#466439', furDark: '#314827', spine: '#22331B', belly: '#FAF5E7', accent: '#EDCC7A', cheek: '#E89D8B' },
      stars: 5, diff: 'Band 7.5–9.0', tag: 'Nghiên cứu Học thuật',
      review: 'Mật độ cao dạng thảo luận thiết kế thí nghiệm Part 3 và bảng biểu tổng hợp Part 4.'
    },
    {
      id: 'lvol_10', source: 'volume', num: 10, testsCount: 4,
      title: 'Real Listening Test · Volume 10',
      persona: 'lotus', eyes: 'starry',
      palette: { fur: '#6B4833', furDark: '#4D3222', spine: '#372317', belly: '#FAF5E8', accent: '#F0C975', cheek: '#E89D8B' },
      stars: 5, diff: 'Band 8.0–9.0', tag: 'Tổng ôn Về đích',
      review: 'Tập chốt hạ tổng hợp toàn bộ dạng khó nhất trước ngày thi — lý tưởng bấm giờ FULL TEST 30 phút.'
    }
  ];

  /* ---------------------------------------------------------
     CLEAN EXAM BANKS (0 FAKE TASKS MIXED INTO CAMBRIDGE / VOLUME / ACTUAL!)
     Real imported Listening exams merge cleanly via window.__LISTENING_BANKS__:
       - data/bank_listening_cambridge.js
       - data/bank_listening_volume.js
       - data/bank_listening_actual.js
     --------------------------------------------------------- */
  const PARTS = {};
  const FULL_TESTS = [];

  window.LISTENING_PRACTICE_DATA = {
    PORTAL_CARDS,
    CAMBRIDGE_BOOKS,
    VOLUME_BOOKS,
    PARTS,
    FULL_TESTS
  };
})();
