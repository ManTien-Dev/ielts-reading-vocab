/* ==========================================================================
   TOTORO IELTS MASTER — DICTATION STUDIO DATA (data/dictation_data.js)
   --------------------------------------------------------------------------
   Hỗ trợ trọn 4 chế độ (Dictation · Shadowing · Quiz · Subtitles):
   - sourceType: 'youtube' (dùng videoId) | 'audio' (dùng audioUrl) | 'tts' (đọc mẫu UK/US)
   - segments:   mảng từng câu { idx, start, end, text, vi, keywords[], properNouns?[] }
   - quiz:       mảng câu hỏi trắc nghiệm hiểu bài { q, options[], answer, segIdx, explain }
   ========================================================================== */
(function () {
  'use strict';

  const LESSONS = [
    {
      id: 'dict-yt-bbc-snack',
      title: "What's Your Favourite Snack? · 6 Minute English",
      titleVi: 'Món ăn vặt yêu thích của bạn là gì?',
      channel: 'BBC Learning English',
      topic: 'Everyday Dialogue',
      level: '6.5+',
      cefr: 'B1–B2',
      accent: 'UK',
      duration: '06:15',
      sourceType: 'youtube',
      videoId: 'vE5d8gP6n3w',
      desc: 'Hội thoại 6 Minute English chuẩn giọng Anh-Anh tự nhiên — luyện bắt nối âm, từ vựng ẩm thực và sắc thái giao tiếp.',
      segments: [
        {
          idx: 1,
          start: 8.0,
          end: 13.0,
          text: 'Hello, this is 6 Minute English from BBC Learning English.',
          vi: 'Xin chào, đây là chương trình 6 Minute English từ BBC Learning English.',
          keywords: ['Minute', 'English', 'Learning'],
          properNouns: ['6 Minute English', 'BBC Learning English']
        },
        {
          idx: 2,
          start: 13.0,
          end: 20.0,
          text: 'Today we are talking about snacks and why people reach for sweet or savoury treats between meals.',
          vi: 'Hôm nay chúng ta sẽ nói về đồ ăn vặt và lý do mọi người hay tìm món ngọt hay mặn giữa các bữa ăn.',
          keywords: ['snacks', 'reach', 'savoury', 'meals']
        },
        {
          idx: 3,
          start: 20.0,
          end: 28.0,
          text: 'Nutritionists estimated that nearly half of busy office workers snack at least twice every afternoon.',
          vi: 'Các chuyên gia dinh dưỡng ước tính rằng gần một nửa nhân viên văn phòng bận rộn ăn vặt ít nhất hai lần mỗi buổi chiều.',
          keywords: ['Nutritionists', 'estimated', 'workers', 'afternoon']
        },
        {
          idx: 4,
          start: 28.0,
          end: 36.0,
          text: 'Although crisps and biscuits offer quick energy, fresh fruit and roasted nuts keep you full for much longer.',
          vi: 'Dù khoai tây chiên và bánh quy cung cấp năng lượng nhanh, trái cây tươi và hạt rang giúp bạn no lâu hơn nhiều.',
          keywords: ['biscuits', 'energy', 'roasted', 'longer']
        },
        {
          idx: 5,
          start: 36.0,
          end: 44.0,
          text: 'Choosing healthier snacks depends less on willpower and more on keeping good options within easy reach.',
          vi: 'Việc chọn đồ ăn vặt lành mạnh ít phụ thuộc vào ý chí mà chủ yếu ở việc để sẵn lựa chọn tốt trong tầm tay.',
          keywords: ['healthier', 'willpower', 'options', 'reach']
        }
      ],
      quiz: [
        {
          q: 'According to nutritionists in the talk, how often do nearly half of busy office workers snack?',
          options: [
            'Once a week on Fridays',
            'At least twice every afternoon',
            'Only before breakfast',
            'Never during working hours'
          ],
          answer: 1,
          segIdx: 2,
          explain: 'Đoạn 3 nêu rõ: "nearly half of busy office workers snack at least twice every afternoon."'
        },
        {
          q: 'What advantage do fresh fruit and roasted nuts have over crisps and biscuits?',
          options: [
            'They are always cheaper to buy',
            'They keep you full for much longer',
            'They contain more refined sugar',
            'They require no storage at all'
          ],
          answer: 1,
          segIdx: 3,
          explain: 'Đoạn 4 đối chiếu: crisps & biscuits cho năng lượng nhanh, còn fresh fruit & roasted nuts giúp no lâu hơn nhiều.'
        },
        {
          q: 'What matters most when trying to choose healthier snacks?',
          options: [
            'Strict willpower alone',
            'Skipping lunch completely',
            'Keeping good options within easy reach',
            'Counting every single calorie'
          ],
          answer: 2,
          segIdx: 4,
          explain: 'Đoạn 5 kết luận: "depends less on willpower and more on keeping good options within easy reach."'
        }
      ]
    },
    {
      id: 'dict-yt-sleep-memory',
      title: 'Why Sleep Matters for Memory & Learning',
      titleVi: 'Vì sao giấc ngủ quyết định trí nhớ và hiệu quả học tập?',
      channel: 'TED-Ed',
      topic: 'Science & Health',
      level: '6.5+',
      cefr: 'B2',
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
      ],
      quiz: [
        {
          q: 'What happens when students stay awake all night before an exam?',
          options: [
            'Their neural connections become stronger',
            'Their ability to recall facts drops sharply',
            'They memorize twice as many dates',
            'Their deep sleep cycle doubles'
          ],
          answer: 1,
          segIdx: 1,
          explain: 'Đoạn 2 khẳng định khả năng nhớ lại thông tin (recall facts) giảm mạnh khi thức trắng đêm.'
        },
        {
          q: 'What does the brain do during deep sleep?',
          options: [
            'Deletes all long-term memories',
            'Stops processing sensory signals',
            'Transfers fragile information to long-term memory',
            'Increases caffeine sensitivity'
          ],
          answer: 2,
          segIdx: 2,
          explain: 'Đoạn 3: "transfers fragile information from short-term storage to long-term memory."'
        }
      ]
    },
    {
      id: 'dict-yt-urban-trees',
      title: 'How Urban Trees Cool Down Modern Cities',
      titleVi: 'Cây xanh đô thị làm mát thành phố hiện đại như thế nào?',
      channel: 'TED-Ed',
      topic: 'Environment & Cities',
      level: '7.5+',
      cefr: 'C1',
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
      ],
      quiz: [
        {
          q: 'Why do crowded city centres become unusually hot?',
          options: [
            'Native trees block natural wind flow',
            'Dense concrete buildings absorb solar radiation and trap heat',
            'Heavy rainwater warms up street surfaces',
            'Public parks reflect too much sunlight'
          ],
          answer: 1,
          segIdx: 0,
          explain: 'Đoạn 1 nêu rõ nguyên nhân đảo nhiệt đô thị là do bê tông hấp thụ bức xạ và giữ nhiệt.'
        },
        {
          q: 'How do urban planners currently view street canopies?',
          options: [
            'Purely decorative elements',
            'An expensive luxury for suburbs',
            'Essential public infrastructure',
            'A barrier to road expansion'
          ],
          answer: 2,
          segIdx: 3,
          explain: 'Đoạn 4: "treat street canopies as essential public infrastructure rather than decoration."'
        }
      ]
    },
    {
      id: 'dict-yt-procrastinate',
      title: 'Why Do We Procrastinate Even When It Hurts Us?',
      titleVi: 'Tại sao chúng ta vẫn trì hoãn dù biết sẽ tự làm hại mình?',
      channel: 'TED-Ed',
      topic: 'Psychology & Study',
      level: '6.5+',
      cefr: 'B2',
      accent: 'US',
      duration: '05:10',
      sourceType: 'youtube',
      videoId: 'FWTNMzK9vG4',
      desc: 'Tâm lý học về sự trì hoãn — luyện nghe cấu trúc nguyên nhân - hệ quả và từ vựng chủ đề Education & Work.',
      segments: [
        {
          idx: 1,
          start: 12.0,
          end: 19.0,
          text: 'Procrastination is rarely about laziness; instead, it is a way of coping with uncomfortable emotions.',
          vi: 'Sự trì hoãn hiếm khi bắt nguồn từ lười biếng; thay vào đó, nó là cách né tránh những cảm xúc khó chịu.',
          keywords: ['Procrastination', 'laziness', 'coping', 'emotions']
        },
        {
          idx: 2,
          start: 19.0,
          end: 26.5,
          text: 'When a task feels overwhelming or boring, the brain treats it as a threat and looks for immediate relief.',
          vi: 'Khi một nhiệm vụ tạo cảm giác quá tải hay nhàm chán, não bộ xem nó là mối đe dọa và tìm cách giải tỏa tức thì.',
          keywords: ['overwhelming', 'treats', 'threat', 'relief']
        },
        {
          idx: 3,
          start: 26.5,
          end: 34.5,
          text: 'Breaking a large assignment into tiny five-minute steps lowers anxiety and makes starting much easier.',
          vi: 'Chia nhỏ một bài tập lớn thành những bước năm phút giúp giảm lo âu và khiến việc bắt đầu dễ hơn nhiều.',
          keywords: ['assignment', 'steps', 'anxiety', 'easier']
        },
        {
          idx: 4,
          start: 34.5,
          end: 42.0,
          text: 'Practising self-compassion after a delay also helps learners recover faster rather than feeling trapped by guilt.',
          vi: 'Thực hành lòng trắc ẩn với bản thân sau khi trì hoãn cũng giúp người học phục hồi nhanh hơn thay vì mắc kẹt trong tội lỗi.',
          keywords: ['compassion', 'recover', 'trapped', 'guilt']
        }
      ],
      quiz: [
        {
          q: 'According to the talk, what is procrastination really about?',
          options: [
            'Poor calendar software',
            'Simple laziness and lack of talent',
            'Coping with uncomfortable emotions',
            'Sleeping too many hours'
          ],
          answer: 2,
          segIdx: 0,
          explain: 'Đoạn 1: "Procrastination is rarely about laziness; instead, it is a way of coping with uncomfortable emotions."'
        },
        {
          q: 'Which practical strategy makes starting a large assignment easier?',
          options: [
            'Waiting for sudden inspiration',
            'Breaking it into tiny five-minute steps',
            'Punishing yourself for every delay',
            'Switching to a completely different subject'
          ],
          answer: 1,
          segIdx: 2,
          explain: 'Đoạn 3 gợi ý chia bài tập lớn thành các bước nhỏ 5 phút để hạ mức lo âu.'
        }
      ]
    },
    {
      id: 'dict-ielts-p1-library',
      title: 'IELTS Part 1 · City Library Membership Registration',
      titleVi: 'IELTS Part 1 · Đăng ký thẻ Thư viện Thành phố',
      channel: 'Totoro IELTS Audio',
      topic: 'Everyday Dialogue',
      level: '5.5',
      cefr: 'B1',
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
          keywords: ['bring', 'recent', 'utility', 'address'],
          properNouns: ['ID']
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
      ],
      quiz: [
        {
          q: 'How many books can standard members borrow at once?',
          options: ['Up to six books', 'Up to twelve books', 'Up to twenty books', 'Only three books'],
          answer: 1,
          segIdx: 2,
          explain: 'Đoạn 3: "borrow up to twelve books for three weeks without paying any deposit."'
        },
        {
          q: 'What is the daily fine for an overdue book?',
          options: ['Fifteen pence', 'Fifty pence', 'Two pounds', 'No charge at all'],
          answer: 1,
          segIdx: 3,
          explain: 'Đoạn 4: "a small daily charge of fifty pence per book."'
        }
      ]
    },
    {
      id: 'dict-ielts-p4-plastic',
      title: 'IELTS Part 4 · Biodegradable Seaweed Plastics',
      titleVi: 'IELTS Part 4 · Nhựa sinh học từ rong biển trong đại dương',
      channel: 'Totoro IELTS Audio',
      topic: 'Academic Lecture',
      level: '7.5+',
      cefr: 'C1',
      accent: 'UK',
      duration: '01:10',
      sourceType: 'tts',
      desc: 'Bài giảng học thuật Part 4 mật độ động từ -ed, số nhiều -s và từ nối logic cao — lý tưởng cho chế độ Chép nguyên câu & Shadowing.',
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
      ],
      quiz: [
        {
          q: 'What problem did early seaweed-based prototypes face?',
          options: [
            'They sank to the ocean floor immediately',
            'They dissolved too quickly in humid conditions',
            'They released toxic smoke when recycled',
            'They could not hold dry products'
          ],
          answer: 1,
          segIdx: 2,
          explain: 'Đoạn 3: "early prototypes dissolved too quickly in humid conditions."'
        },
        {
          q: 'Why does the speaker expect wider adoption soon?',
          options: [
            'Governments banned all glass bottles',
            'Seaweed grows without sunlight',
            'Material prices are falling',
            'Industrial scaling is already free'
          ],
          answer: 2,
          segIdx: 3,
          explain: 'Đoạn 4: "yet falling material prices suggest wider adoption soon."'
        }
      ]
    }
  ];

  window.DICTATION_STUDIO_DATA = {
    LESSONS
  };
})();
