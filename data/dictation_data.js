/* ==========================================================================
   TOTORO IELTS MASTER — DICTATION STUDIO DATA (data/dictation_data.js)
   --------------------------------------------------------------------------
   Schema cực gọn để bạn tự thêm/sửa bài YouTube hoặc Audio cục bộ:
   - sourceType: 'youtube' (dùng videoId) | 'audio' (dùng audioUrl) | 'tts' (đọc mẫu UK/US)
   - segments:   mảng từng câu có { start, end, text, vi, keywords[] }
   ========================================================================== */
(function () {
  'use strict';

  const LESSONS = [
    {
      id: 'dict-yt-sleep-memory',
      title: 'Why Sleep Matters for Memory & Learning',
      topic: 'Science & Health',
      level: '6.5+',
      accent: 'US',
      duration: '01:15',
      sourceType: 'youtube',
      videoId: 'gedoSfZvBgE',
      desc: 'Video TED-Ed giải thích cơ chế não bộ củng cố trí nhớ khi ngủ — luyện bắt âm đuôi -s/-ed và thuật ngữ học thuật Part 4.',
      segments: [
        {
          idx: 1,
          start: 14.0,
          end: 20.5,
          text: 'Sleep plays a vital role in consolidating new memories and strengthening neural connections.',
          vi: 'Giấc ngủ đóng vai trò thiết yếu trong việc củng cố ký ức mới và tăng cường các kết nối thần kinh.',
          keywords: ['vital', 'consolidating', 'memories', 'connections']
        },
        {
          idx: 2,
          start: 20.5,
          end: 27.5,
          text: 'When students stay awake all night before an exam, their ability to recall facts drops sharply.',
          vi: 'Khi học sinh thức trắng đêm trước kỳ thi, khả năng nhớ lại kiến thức giảm mạnh.',
          keywords: ['awake', 'ability', 'recall', 'sharply']
        },
        {
          idx: 3,
          start: 27.5,
          end: 35.0,
          text: 'During deep sleep, the brain transfers fragile information from short-term storage to long-term memory.',
          vi: 'Trong giấc ngủ sâu, não bộ chuyển thông tin mong manh từ kho ngắn hạn sang trí nhớ dài hạn.',
          keywords: ['transfers', 'fragile', 'storage', 'memory']
        },
        {
          idx: 4,
          start: 35.0,
          end: 43.0,
          text: 'Therefore, maintaining a consistent sleep schedule is one of the most effective study habits.',
          vi: 'Vì vậy, duy trì lịch ngủ đều đặn là một trong những thói quen học tập hiệu quả nhất.',
          keywords: ['maintaining', 'consistent', 'schedule', 'effective']
        }
      ]
    },
    {
      id: 'dict-yt-urban-trees',
      title: 'How Urban Trees Cool Down Modern Cities',
      topic: 'Environment & Cities',
      level: '7.5+',
      accent: 'UK',
      duration: '01:20',
      sourceType: 'youtube',
      videoId: 'zarll9bx6FI',
      desc: 'Chủ đề đô thị hóa & cây xanh rất hay ra trong Listening Part 4 và Writing Task 2 — luyện bắt cụm danh từ và giới từ.',
      segments: [
        {
          idx: 1,
          start: 10.0,
          end: 17.5,
          text: 'Dense concrete buildings absorb solar radiation and trap heat inside crowded city centres.',
          vi: 'Các tòa nhà bê tông dày đặc hấp thụ bức xạ mặt trời và giữ nhiệt trong trung tâm thành phố đông đúc.',
          keywords: ['concrete', 'absorb', 'radiation', 'centres']
        },
        {
          idx: 2,
          start: 17.5,
          end: 25.0,
          text: 'Planting native trees along major roads can lower street temperatures by several degrees.',
          vi: 'Trồng cây bản địa dọc các tuyến đường lớn có thể giảm nhiệt độ đường phố xuống vài độ.',
          keywords: ['native', 'major', 'temperatures', 'degrees']
        },
        {
          idx: 3,
          start: 25.0,
          end: 33.0,
          text: 'Beyond providing shade, green corridors filter airborne pollutants and absorb heavy rainwater.',
          vi: 'Ngoài việc tạo bóng mát, các hành lang xanh còn lọc bụi bẩn trong không khí và thấm nước mưa lớn.',
          keywords: ['corridors', 'filter', 'pollutants', 'rainwater']
        },
        {
          idx: 4,
          start: 33.0,
          end: 41.5,
          text: 'Urban planners now treat street canopies as essential public infrastructure rather than decoration.',
          vi: 'Các nhà quy hoạch đô thị nay coi tán cây đường phố là hạ tầng công cộng thiết yếu chứ không chỉ để trang trí.',
          keywords: ['planners', 'canopies', 'infrastructure', 'decoration']
        }
      ]
    },
    {
      id: 'dict-ielts-p1-library',
      title: 'IELTS Part 1 · Đăng ký thẻ Thư viện Thành phố',
      topic: 'Everyday Dialogue',
      level: '5.5',
      accent: 'UK',
      duration: '00:55',
      sourceType: 'tts',
      desc: 'Hội thoại chuẩn Part 1 với số liệu, ngày tháng, mạo từ a/an/the và danh từ số nhiều — chạy trực tiếp 100% không phụ thuộc YouTube.',
      segments: [
        {
          idx: 1,
          start: 0,
          end: 6,
          text: 'Good morning, I would like to register for a new library membership card today.',
          vi: 'Chào buổi sáng, tôi muốn đăng ký một thẻ thành viên thư viện mới hôm nay.',
          keywords: ['register', 'library', 'membership', 'card']
        },
        {
          idx: 2,
          start: 6,
          end: 13,
          text: 'Certainly, you just need to bring a photo ID and a recent utility bill showing your address.',
          vi: 'Chắc chắn rồi, bạn chỉ cần mang giấy tờ có ảnh và hóa đơn tiện ích gần đây ghi rõ địa chỉ.',
          keywords: ['bring', 'recent', 'utility', 'address']
        },
        {
          idx: 3,
          start: 13,
          end: 20,
          text: 'Standard members can borrow up to twelve books for three weeks without paying any deposit.',
          vi: 'Thành viên tiêu chuẩn có thể mượn tối đa mười hai cuốn sách trong ba tuần mà không cần đặt cọc.',
          keywords: ['borrow', 'twelve', 'weeks', 'deposit']
        },
        {
          idx: 4,
          start: 20,
          end: 27,
          text: 'Please remember that overdue items incur a small daily charge of fifty pence per book.',
          vi: 'Xin lưu ý rằng sách quá hạn sẽ chịu một khoản phí nhỏ hàng ngày là năm mươi xu mỗi cuốn.',
          keywords: ['overdue', 'incur', 'charge', 'fifty']
        }
      ]
    },
    {
      id: 'dict-ielts-p4-plastic',
      title: 'IELTS Part 4 · Tái chế Nhựa Sinh học trong Đại dương',
      topic: 'Academic Lecture',
      level: '7.5+',
      accent: 'UK',
      duration: '01:10',
      sourceType: 'tts',
      desc: 'Bài giảng học thuật Part 4 mật độ động từ -ed, số nhiều -s và từ nối logic cao — lý tưởng cho chế độ Chép nguyên câu.',
      segments: [
        {
          idx: 1,
          start: 0,
          end: 7,
          text: 'Marine biologists have warned that conventional plastics persist in ocean ecosystems for centuries.',
          vi: 'Các nhà sinh học biển cảnh báo rằng nhựa thông thường tồn tại trong hệ sinh thái đại dương hàng thế kỷ.',
          keywords: ['biologists', 'conventional', 'persist', 'ecosystems']
        },
        {
          idx: 2,
          start: 7,
          end: 14,
          text: 'In response, several laboratories developed biodegradable polymers derived from seaweed extracts.',
          vi: 'Để ứng phó, nhiều phòng thí nghiệm đã phát triển polymer phân hủy sinh học chiết xuất từ rong biển.',
          keywords: ['laboratories', 'biodegradable', 'derived', 'extracts']
        },
        {
          idx: 3,
          start: 14,
          end: 21,
          text: 'Although early prototypes dissolved too quickly in humid conditions, recent versions proved remarkably durable.',
          vi: 'Dù các mẫu thử ban đầu tan quá nhanh trong điều kiện ẩm, các phiên bản gần đây tỏ ra bền bỉ đáng kinh ngạc.',
          keywords: ['prototypes', 'dissolved', 'humid', 'durable']
        },
        {
          idx: 4,
          start: 21,
          end: 29,
          text: 'Scaling up industrial production remains costly, yet falling material prices suggest wider adoption soon.',
          vi: 'Mở rộng sản xuất công nghiệp vẫn còn tốn kém, nhưng giá nguyên liệu giảm cho thấy sẽ sớm được áp dụng rộng rãi.',
          keywords: ['industrial', 'costly', 'material', 'adoption']
        }
      ]
    }
  ];

  window.DICTATION_STUDIO_DATA = {
    LESSONS
  };
})();
