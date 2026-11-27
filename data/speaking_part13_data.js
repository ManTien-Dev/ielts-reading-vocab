/* ==========================================================================
   TOTORO IELTS MASTER — SPEAKING PART 1 & PART 3 CURATED BANK (2025–2026)
   - Part 1: 12 High-Frequency Topics (48 Examiner Qs) · A.R.E. Formula (20–35s)
   - Part 3: 10 Abstract Discussion Topics (40 Examiner Qs) · P.E.E.C. Formula (40–65s)
   ========================================================================== */
(function () {
  'use strict';

  const PART1_TOPICS = [
    {
      id: 'sp_p1_work_study',
      part: 1,
      category: 'core',
      catLabel: 'Bắt buộc · Core',
      title: 'Work & Study',
      titleVi: 'Học tập & Công việc',
      source: 'Core Mandatory · 2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Chủ đề mở đầu xuất hiện ở gần như 100% phòng thi thật — luyện trả lời gọn 2–4 câu tự nhiên bằng khung A.R.E.',
      questions: [
        {
          id: 'p1_ws_1',
          q: 'Do you work or are you a student?',
          qType: 'Trả lời trực tiếp',
          formulaVi: 'A: Nói rõ ngành học / công việc hiện tại → R: Nêu 1 điểm bạn thấy thú vị hoặc thực tế → E: Gắn 1 hoạt động cụ thể hằng ngày.',
          chunks: ['currently majoring in', 'hands-on projects', 'keeps me on my toes', 'in the long run'],
          modelEn: "At the moment, I'm a university student currently majoring in business administration. I really enjoy it because we get to work on hands-on projects rather than just memorising theory. For example, last week my team analysed a real marketing campaign for a local coffee chain, which definitely keeps me on my toes."
        },
        {
          id: 'p1_ws_2',
          q: 'What do you like most about your studies or job?',
          qType: 'Sở thích · Lý do',
          formulaVi: 'A: Chọn 1 yếu tố nổi bật nhất (môi trường / đồng đội / kiến thức) → R: Giải thích vì sao nó tạo động lực → E: Ví dụ ngắn.',
          chunks: ['what stands out to me', 'supportive environment', 'bounce ideas off', 'broaden my horizons'],
          modelEn: "What stands out to me most is the supportive environment. My classmates and lecturers are super approachable, so I can easily bounce ideas off them whenever I hit a wall. It really helps broaden my horizons and makes stressful exam weeks far more bearable."
        },
        {
          id: 'p1_ws_3',
          q: 'Do you prefer studying or working in the morning or in the evening?',
          qType: 'So sánh lựa chọn',
          formulaVi: 'A: Chọn rõ sáng hay tối (hoặc tùy loại việc) → R: Lý do năng lượng / sự yên tĩnh → E: So sánh nhẹ với buổi còn lại.',
          chunks: ['definitely an early bird', 'mental clarity', 'free from distractions', 'tackle tough tasks'],
          modelEn: "I'm definitely an early bird when it comes to heavy focus. My mental clarity is at its peak right after breakfast, and the house is completely free from distractions. By contrast, I tend to feel drained in the evening, so I usually tackle tough tasks first thing in the morning."
        },
        {
          id: 'p1_ws_4',
          q: 'What kind of job would you like to do in the future?',
          qType: 'Dự định tương lai',
          formulaVi: 'A: Nêu hướng nghề nghiệp mong muốn → R: Nêu lý do hợp tính cách / kỹ năng → E: 1 mục tiêu nhỏ gần nhất.',
          chunks: ['set my sights on', 'a good mix of', 'make a tangible impact', 'build up experience'],
          modelEn: "I've set my sights on working as a product manager in a tech company. It offers a good mix of analytical thinking and teamwork, which suits my personality well. Before that, though, I'm hoping to build up experience through an internship right after graduation so I can make a tangible impact."
        }
      ]
    },
    {
      id: 'sp_p1_hometown',
      part: 1,
      category: 'core',
      catLabel: 'Bắt buộc · Core',
      title: 'Hometown & Living Area',
      titleVi: 'Quê hương & Khu vực đang sống',
      source: 'Core Mandatory · 2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Chủ đề kinh điển Part 1: miêu tả nơi ở, nét đặc trưng và sự thay đổi theo thời gian.',
      questions: [
        {
          id: 'p1_ht_1',
          q: 'Where is your hometown, and what is it like?',
          qType: 'Miêu tả nhanh',
          formulaVi: 'A: Nêu vị trí + bầu không khí chung → R: Điểm đặc trưng dễ nhận biết → E: 1 hình ảnh đời thường.',
          chunks: ['born and raised in', 'a lively coastal city', 'laid-back vibe', 'famous for its street food'],
          modelEn: "I was born and raised in a medium-sized city in southern Vietnam. Even though it's developing pretty quickly, it still keeps a laid-back vibe compared to big hubs like Ho Chi Minh City. People usually know it for its friendly locals and its amazing street food stalls along the river."
        },
        {
          id: 'p1_ht_2',
          q: 'Has your hometown changed much over the past few years?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'A: Khẳng định thay đổi rõ (nhất là hạ tầng) → R: Kể cái mới mọc lên → E: Nêu cảm nhận 2 mặt ngắn gọn.',
          chunks: ['undergone huge changes', 'sprung up everywhere', 'modern amenities', 'a bit more congested'],
          modelEn: "Yes, it's undergone huge changes over the last five years or so. New cafés, shopping centres, and apartment blocks have sprung up everywhere, which gives residents far more modern amenities. The only downside is that rush-hour traffic has become a bit more congested than it used to be."
        },
        {
          id: 'p1_ht_3',
          q: 'What do you like most about the neighbourhood you live in now?',
          qType: 'Điểm thích nhất',
          formulaVi: 'A: Nêu 1 ưu điểm rõ (tiện lợi / yên tĩnh / hàng xóm) → R: Giải thích tiện ra sao → E: Ví dụ cụ thể.',
          chunks: ['within walking distance', 'close-knit community', 'peace and quiet', 'convenient for daily errands'],
          modelEn: "What I love most is how convenient it is for daily errands. Almost everything I need—from fresh markets to a little green park—is within walking distance. On top of that, the neighbours are warm and welcoming, so it genuinely feels like a close-knit community."
        },
        {
          id: 'p1_ht_4',
          q: 'Would you like to live in your hometown in the future?',
          qType: 'Dự định tương lai',
          formulaVi: 'A: Trả lời linh hoạt (ngắn hạn đi xa, dài hạn về hoặc ở lại) → R: Lý do công việc vs gia đình → E: Kết tự nhiên.',
          chunks: ['in the short term', 'settle down', 'cost of living', 'close to my family'],
          modelEn: "In the short term, I'd like to spend a few years in a major city to chase better career opportunities. However, once I'm ready to settle down, I'd definitely love to move back because the cost of living is reasonable and I want to stay close to my family."
        }
      ]
    },
    {
      id: 'sp_p1_daily_routine',
      part: 1,
      category: 'daily',
      catLabel: 'Đời sống',
      title: 'Daily Routine & Mornings',
      titleVi: 'Thói quen hằng ngày & Buổi sáng',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Luyện dùng thì hiện tại đơn tự nhiên, cụm từ chỉ nhịp sinh hoạt và đối chiếu ngày thường – cuối tuần.',
      questions: [
        {
          id: 'p1_dr_1',
          q: 'What is your typical morning routine like?',
          qType: 'Thói quen',
          formulaVi: 'A: Kể 2–3 việc chính theo trình tự → R: Việc nào giúp bạn tỉnh táo nhất → E: Nhấn 1 chi tiết nhỏ.',
          chunks: ['kick off my day', 'a quick cup of coffee', 'get into the right headspace', 'stick to a simple routine'],
          modelEn: "I try to stick to a simple routine on weekdays. I usually wake up around six-thirty, do ten minutes of light stretching, and kick off my day with a quick cup of coffee. Taking that quiet half hour before checking my phone really helps me get into the right headspace."
        },
        {
          id: 'p1_dr_2',
          q: 'Is there any part of your daily routine you would like to change?',
          qType: 'Mong muốn thay đổi',
          formulaVi: 'A: Nêu thẳng 1 thói quen chưa tốt (thức khuya / lướt điện thoại) → R: Tác hại thực tế → E: Cách muốn sửa.',
          chunks: ['guilty of staying up late', 'mindlessly scrolling', 'leaves me groggy', 'turn in earlier'],
          modelEn: "Honestly, I'm really guilty of staying up late mindlessly scrolling through short videos. It leaves me groggy the next morning and cuts into my study time. I've been trying to leave my phone outside the bedroom so I can turn in earlier."
        },
        {
          id: 'p1_dr_3',
          q: 'Do you think it is important to have a fixed daily routine?',
          qType: 'Quan điểm cá nhân',
          formulaVi: 'A: Đồng ý có chừng mực (nên có khung nhưng vẫn linh hoạt) → R: Giúp tiết kiệm ý chí / đỡ rối → E: Ngoại lệ cuối tuần.',
          chunks: ['keeps life structured', 'decision fatigue', 'leave room for spontaneity', 'stay on top of things'],
          modelEn: "Yes, up to a point. Having a predictable schedule keeps life structured and cuts down on decision fatigue, so it's much easier to stay on top of deadlines. That said, I still think we should leave room for spontaneity on weekends so life doesn't feel robotic."
        },
        {
          id: 'p1_dr_4',
          q: 'How is your weekend routine different from your weekday routine?',
          qType: 'So sánh',
          formulaVi: 'A: Nêu sự khác biệt rõ về nhịp độ → R: Cuối tuần ngủ bù / đi chơi → E: 1 hoạt động quen thuộc.',
          chunks: ['at a much slower pace', 'sleep in a bit', 'catch up with friends', 'recharge my batteries'],
          modelEn: "Weekends definitely move at a much slower pace for me. Instead of rushing out the door, I let myself sleep in a bit and enjoy a proper brunch with my family. In the afternoon, I usually catch up with friends at a cosy café to recharge my batteries."
        }
      ]
    },
    {
      id: 'sp_p1_tech_phones',
      part: 1,
      category: 'tech',
      catLabel: 'Công nghệ',
      title: 'Smartphones & Apps',
      titleVi: 'Điện thoại & Ứng dụng hằng ngày',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Chủ đề cực dễ gặp: tránh nói chung chung "it is very useful", thay bằng ứng dụng cụ thể & thói quen thật.',
      questions: [
        {
          id: 'p1_tp_1',
          q: 'What do you mainly use your smartphone for?',
          qType: 'Tần suất · Mục đích',
          formulaVi: 'A: Nêu 2 mục đích chính (học tập / liên lạc / tra cứu) → R: Tại sao tiện → E: Kể tên 1 loại app hay mở nhất.',
          chunks: ['rely on it heavily', 'keep in touch with', 'on the go', 'flashcard and note-taking apps'],
          modelEn: "Aside from messaging to keep in touch with family, I rely on it heavily for studying on the go. I use flashcard and note-taking apps whenever I'm waiting for a bus or taking a short break. Of course, I also use banking and map apps almost every single day."
        },
        {
          id: 'p1_tp_2',
          q: 'Do you think you spend too much time on your phone?',
          qType: 'Tự đánh giá',
          formulaVi: 'A: Thừa nhận thật lòng (khá nhiều vào lúc rảnh) → R: Dễ bị cuốn vào thông báo → E: Cách bạn đang kiểm soát.',
          chunks: ['more than I should', 'eat into my free time', 'set screen-time limits', 'switch off notifications'],
          modelEn: "If I'm being completely honest, probably more than I should. Even when I only pick it up to check one message, random notifications can easily eat into my free time. Lately, I've started switching off non-essential notifications and setting screen-time limits while I study."
        },
        {
          id: 'p1_tp_3',
          q: 'Which app could you not live without?',
          qType: 'Lựa chọn cụ thể',
          formulaVi: 'A: Chọn 1 app thiết thực (Maps / Zalo / Notes / Spotify) → R: Nếu thiếu sẽ bất tiện ra sao → E: Tình huống gần đây.',
          chunks: ['hands down', 'terrible sense of direction', 'saves me a ton of time', 'navigating unfamiliar streets'],
          modelEn: "Hands down, it would be Google Maps. I have a terrible sense of direction, so navigating unfamiliar streets without it would be a nightmare. It saves me a ton of time by warning me about traffic jams before I even leave home."
        },
        {
          id: 'p1_tp_4',
          q: 'Did you use mobile phones much when you were a child?',
          qType: 'Quá khứ',
          formulaVi: 'A: Không / rất ít so với trẻ bây giờ → R: Bố mẹ hạn chế hoặc chưa có smartphone → E: Hồi đó bạn chơi gì thay thế.',
          chunks: ['hardly at all', 'strict rules about screen time', 'play outdoors', 'a basic keypad phone'],
          modelEn: "Hardly at all, actually. My parents had pretty strict rules about screen time, and I didn't get my own phone until secondary school—and even then it was just a basic keypad phone for calling home. Most afternoons back then were spent playing outdoors with kids in the neighbourhood."
        }
      ]
    },
    {
      id: 'sp_p1_music_relax',
      part: 1,
      category: 'hobby',
      catLabel: 'Sở thích',
      title: 'Music & Relaxation',
      titleVi: 'Âm nhạc & Cách thư giãn',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Mở rộng vốn từ miêu tả cảm xúc, thể loại nhạc và hoàn cảnh nghe nhạc (khi học, khi đi đường, khi căng thẳng).',
      questions: [
        {
          id: 'p1_mr_1',
          q: 'What kind of music do you usually listen to?',
          qType: 'Sở thích',
          formulaVi: 'A: Nêu gu nhạc (hoặc tùy tâm trạng) → R: Mang lại cảm giác gì → E: Ví dụ lúc học vs lúc đi đường.',
          chunks: ['depends on my mood', 'mellow acoustic tracks', 'upbeat pop', 'helps me zone in'],
          modelEn: "It really depends on my mood, to be honest. When I'm studying or reading, I go for mellow acoustic tracks or lo-fi instrumentals because they help me zone in without distracting lyrics. When I'm commuting or working out, though, I switch to upbeat pop to keep my energy high."
        },
        {
          id: 'p1_mr_2',
          q: 'Has your taste in music changed since you were younger?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'A: Có thay đổi khá rõ → R: Hồi nhỏ thích gì vs bây giờ trân trọng ca từ / giai điệu nhẹ → E: 1 ví dụ ngắn.',
          chunks: ['evolved quite a bit', 'catchy melodies', 'appreciate meaningful lyrics', 'broadened my taste'],
          modelEn: "Yes, it's evolved quite a bit. As a teenager, I only cared about whatever loud, catchy melodies were trending on the charts. Nowadays, I appreciate meaningful lyrics and calmer arrangements much more, and streaming playlists have really broadened my taste."
        },
        {
          id: 'p1_mr_3',
          q: 'How do you usually relax after a long and tiring day?',
          qType: 'Thói quen thư giãn',
          formulaVi: 'A: Nêu 1–2 hoạt động nhẹ nhàng → R: Giúp xả áp lực đầu óc thế nào → E: Chi tiết cụ thể.',
          chunks: ['wind down', 'take my mind off', 'a warm shower', 'de-stress naturally'],
          modelEn: "My favourite way to wind down is taking a warm shower and going for a slow walk around the block while listening to a podcast. Stepping away from screens for thirty minutes really helps take my mind off study pressure and lets me de-stress naturally."
        },
        {
          id: 'p1_mr_4',
          q: 'Would you like to learn to play a musical instrument?',
          qType: 'Mong muốn',
          formulaVi: 'A: Có (chọn 1 nhạc cụ cụ thể: guitar / piano) → R: Lý do thấy cuốn hút → E: Khó khăn thực tế về thời gian.',
          chunks: ['always wanted to pick up', 'warm, versatile sound', 'carve out enough time', 'play around a campfire'],
          modelEn: "I've always wanted to pick up the acoustic guitar. It has such a warm, versatile sound, and it's portable enough to bring along on trips with friends. The only thing holding me back right now is carving out enough time to practise consistently."
        }
      ]
    },
    {
      id: 'sp_p1_reading_books',
      part: 1,
      category: 'hobby',
      catLabel: 'Sở thích',
      title: 'Reading & Books',
      titleVi: 'Đọc sách & Thói quen đọc',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Luyện phân biệt sách giấy vs sách điện tử, thể loại yêu thích và cách trả lời thật ngay cả khi không đọc nhiều.',
      questions: [
        {
          id: 'p1_rb_1',
          q: 'Do you enjoy reading books in your free time?',
          qType: 'Sở thích',
          formulaVi: 'A: Trả lời tự nhiên (thích nhưng không phải ngày nào cũng đọc kịp) → R: Lợi ích cho góc nhìn / sự bình tĩnh → E: Thời điểm hay đọc.',
          chunks: ['wouldn’t call myself a bookworm', 'a great escape', 'before going to sleep', 'spark new ideas'],
          modelEn: "I wouldn't call myself a huge bookworm, but I do enjoy reading when I have a quiet evening. For me, a good book is a great escape from nonstop phone notifications, and it often sparks new ideas. I mostly read for about twenty minutes before going to sleep."
        },
        {
          id: 'p1_rb_2',
          q: 'Do you prefer paper books or e-books?',
          qType: 'So sánh lựa chọn',
          formulaVi: 'A: Chọn 1 bên (thường sách giấy ở nhà, e-book khi đi xa) → R: Cảm giác lật trang / đỡ mỏi mắt vs gọn nhẹ → E: Ví dụ thực tế.',
          chunks: ['feel of turning real pages', 'easier on the eyes', 'jot notes in the margins', 'handy while travelling'],
          modelEn: "I lean towards paper books whenever I'm at home. There's something satisfying about the feel of turning real pages, plus they're much easier on the eyes and I love jotting notes in the margins. Still, I have to admit e-books are super handy while travelling."
        },
        {
          id: 'p1_rb_3',
          q: 'What types of books do you like reading most?',
          qType: 'Thể loại',
          formulaVi: 'A: Nêu 1–2 thể loại cụ thể (tâm lý, tiểu sử, truyện ngắn) → R: Lý do hợp gu → E: 1 cuốn gần đây ấn tượng.',
          chunks: ['drawn to non-fiction', 'practical takeaways', 'easy to relate to', 'broaden my perspective'],
          modelEn: "Lately, I've been drawn to non-fiction, especially psychology and biographies. I like books that give me practical takeaways I can actually apply to daily life, rather than purely abstract plots. Reading about how real people overcame setbacks really broadens my perspective."
        },
        {
          id: 'p1_rb_4',
          q: 'Did you read a lot when you were a child?',
          qType: 'Quá khứ',
          formulaVi: 'A: Có (truyện tranh / truyện thiếu nhi) → R: Ai khuyến khích bạn đọc → E: Kỷ niệm nhỏ.',
          chunks: ['obsessed with comic books', 'bedtime stories', 'sparked my curiosity', 'borrowed stacks of books'],
          modelEn: "I was obsessed with comic books and short adventure stories as a kid! My family used to take me to the local bookstore every Sunday if I finished my homework on time. Those simple stories definitely sparked my curiosity and built my reading habit early on."
        }
      ]
    },
    {
      id: 'sp_p1_food_cooking',
      part: 1,
      category: 'daily',
      catLabel: 'Đời sống',
      title: 'Food & Cooking',
      titleVi: 'Ẩm thực & Nấu ăn tại nhà',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Từ vựng ăn uống tự nhiên: tránh lặp từ "delicious" — dùng comforting, home-cooked, balanced, whip up a quick meal.',
      questions: [
        {
          id: 'p1_fc_1',
          q: 'Do you like cooking, or do you prefer eating out?',
          qType: 'So sánh lựa chọn',
          formulaVi: 'A: Thích sự cân bằng (nấu ngày thường, đi ăn cuối tuần) → R: Sạch sẽ, tiết kiệm vs đổi gió → E: Món hay nấu.',
          chunks: ['home-cooked meals', 'keep an eye on nutrition', 'whip up something simple', 'treat myself on weekends'],
          modelEn: "On weekdays, I definitely prefer home-cooked meals because they're healthier, cheaper, and let me keep an eye on nutrition. I'm no master chef, so I usually just whip up something simple like stir-fried veggies and eggs. Still, I love eating out to treat myself on weekends."
        },
        {
          id: 'p1_fc_2',
          q: 'What is a traditional dish from your country that you really enjoy?',
          qType: 'Miêu tả món ăn',
          formulaVi: 'A: Chọn 1 món quen (Phở / Bún chả / Cơm tấm) → R: Mô tả vị & cảm giác dễ hiểu → E: Hay ăn vào dịp nào.',
          chunks: ['classic comfort food', 'rich, aromatic broth', 'fresh herbs', 'hits the spot'],
          modelEn: "For me, pho is the ultimate classic comfort food. What makes it special is the rich, aromatic broth simmered for hours, balanced out with fresh herbs and a squeeze of lime. Nothing hits the spot quite like a hot bowl of pho on a rainy morning."
        },
        {
          id: 'p1_fc_3',
          q: 'Have your eating habits changed as you got older?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'A: Thay đổi khá nhiều theo hướng lành mạnh hơn → R: Trước thích đồ ngọt/chiên, nay chú ý năng lượng → E: 1 thay đổi cụ thể.',
          chunks: ['much more health-conscious', 'had a huge sweet tooth', 'cut back on sugary drinks', 'feel far more energetic'],
          modelEn: "Definitely—I've become much more health-conscious over the last few years. When I was younger, I had a huge sweet tooth and lived on snacks and milk tea. Now I've cut back on sugary drinks and eat way more greens, and I honestly feel far more energetic."
        },
        {
          id: 'p1_fc_4',
          q: 'Do you like trying food from other countries?',
          qType: 'Trải nghiệm',
          formulaVi: 'A: Rất thích khám phá → R: Hiểu thêm văn hóa qua gia vị → E: Kể 1 nền ẩm thực bạn mê (Nhật / Hàn / Ý).',
          chunks: ['adventurous eater', 'a window into another culture', 'subtle flavours', 'keen to try'],
          modelEn: "Yes, I consider myself a pretty adventurous eater. Trying international dishes feels like a quick window into another culture's ingredients and traditions. I'm especially fond of Japanese food for its subtle flavours, and I'm keen to try authentic Mexican tacos someday."
        }
      ]
    },
    {
      id: 'sp_p1_weather_seasons',
      part: 1,
      category: 'daily',
      catLabel: 'Đời sống',
      title: 'Weather & Seasons',
      titleVi: 'Thời tiết & Các mùa trong năm',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Biết cách miêu tả thời tiết Việt Nam tự nhiên (humid, sudden downpours, crisp breeze) và ảnh hưởng đến tâm trạng.',
      questions: [
        {
          id: 'p1_wsn_1',
          q: 'What kind of weather do you like best?',
          qType: 'Sở thích',
          formulaVi: 'A: Nêu kiểu thời tiết yêu thích (mát mẻ, nắng nhẹ) → R: Dễ chịu khi ra ngoài / làm việc → E: Hoạt động thích làm lúc đó.',
          chunks: ['mild and breezy', 'not too scorching', 'ideal for outdoor walks', 'lifts my spirits'],
          modelEn: "I'm a big fan of mild, breezy weather—sunny enough to feel cheerful, but not too scorching hot. Around twenty-two to twenty-five degrees is ideal for outdoor walks or grabbing coffee outside. That kind of crisp air instantly lifts my spirits."
        },
        {
          id: 'p1_wsn_2',
          q: 'Does the weather affect your mood or daily plans?',
          qType: 'Ảnh hưởng',
          formulaVi: 'A: Có, khá rõ rệt → R: Trời mưa lớn dễ ngại đi lại / uể oải, trời nắng dễ năng động → E: Ví dụ gần đây.',
          chunks: ['plays a big role', 'sudden downpours', 'puts a damper on', 'makes me feel sluggish'],
          modelEn: "Yes, it plays a big role in how motivated I feel. Sudden downpours can easily put a damper on weekend plans and make commuting stressful, while grey, gloomy skies tend to make me feel a bit sluggish. On bright mornings, though, I naturally get way more done."
        },
        {
          id: 'p1_wsn_3',
          q: 'What is the weather usually like in your hometown?',
          qType: 'Miêu tả',
          formulaVi: 'A: Nêu đặc trưng 2 mùa (mưa/khô) hoặc 4 mùa → R: Chi tiết nhiệt độ / độ ẩm → E: Tháng nào dễ chịu nhất.',
          chunks: ['tropical climate', 'two distinct seasons', 'hot and humid', 'brief afternoon showers'],
          modelEn: "My hometown has a warm tropical climate with two distinct seasons: dry and rainy. Summers can get pretty hot and humid during midday, whereas the rainy season brings brief afternoon showers that cool the streets down nicely. December and January are easily the most pleasant months."
        },
        {
          id: 'p1_wsn_4',
          q: 'Do you usually check the weather forecast before going out?',
          qType: 'Thói quen',
          formulaVi: 'A: Có, nhất là vào mùa mưa → R: Tránh kẹt mưa / mang áo mưa hoặc ô → E: Quên xem từng gặp chuyện gì.',
          chunks: ['out of habit', 'caught in the rain', 'pack an umbrella', 'plan my outfit'],
          modelEn: "Pretty much out of habit, especially during the rainy season. A quick glance at my phone widget tells me whether to pack an umbrella or leave a bit earlier for traffic. I've been caught in the rain one too many times to skip checking it now."
        }
      ]
    },
    {
      id: 'sp_p1_family_friends',
      part: 1,
      category: 'social',
      catLabel: 'Xã hội',
      title: 'Family & Close Friends',
      titleVi: 'Gia đình & Bạn thân',
      source: 'Story 01 Bridge · 2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Chủ đề cầu nối trực tiếp với Story 01 — luyện nói ấm áp, chân thực về người thân và bạn bè.',
      questions: [
        {
          id: 'p1_ff_1',
          q: 'Do you spend a lot of time with your family?',
          qType: 'Tần suất',
          formulaVi: 'A: Nêu mức độ hiện tại → R: Dù bận nhưng vẫn giữ bữa cơm chung → E: Hoạt động cả nhà hay làm.',
          chunks: ['make it a priority', 'hectic schedules', 'share dinner together', 'stay closely connected'],
          modelEn: "Even though everyone has pretty hectic schedules, we still make it a priority to share dinner together most evenings. It's the one time of day we put our phones away and talk about how things went. On Sundays, we sometimes visit my grandparents too, which keeps us closely connected."
        },
        {
          id: 'p1_ff_2',
          q: 'Do you prefer having a few close friends or a large circle of friends?',
          qType: 'So sánh lựa chọn',
          formulaVi: 'A: Chọn rõ (vài bạn thân) → R: Dễ tin tưởng, chia sẻ sâu → E: Khác với nhóm đông chỉ gặp xã giao.',
          chunks: ['quality over quantity', 'a tight-knit circle', 'open up to', 'have each other’s backs'],
          modelEn: "I definitely value quality over quantity when it comes to friendship. Having a tight-knit circle of three or four close friends means I have people I can truly open up to without worrying about being judged. We really have each other's backs whenever life gets rough."
        },
        {
          id: 'p1_ff_3',
          q: 'What do you and your friends usually do when you meet up?',
          qType: 'Hoạt động',
          formulaVi: 'A: Nêu hoạt động giản dị (cà phê, ăn vặt, học nhóm) → R: Vì sao thích kiểu đó → E: Lần gặp gần nhất.',
          chunks: ['grab a coffee', 'catch up on life', 'swap stories', 'nothing too fancy'],
          modelEn: "Nothing too fancy, honestly. We usually grab a coffee at a quiet spot, try out a new street food place, and just catch up on life for a couple of hours. Sometimes we even do study sessions together before big exams so we can motivate one another."
        },
        {
          id: 'p1_ff_4',
          q: 'Who are you closest to in your family?',
          qType: 'Người thân nhất',
          formulaVi: 'A: Chọn 1 người (mẹ / ông ngoại / anh chị) → R: Tính cách dễ gần, biết lắng nghe → E: Hay tâm sự điều gì.',
          chunks: ['especially close to', 'a great listener', 'sound advice', 'never jumps to conclusions'],
          modelEn: "I'd say I'm especially close to my grandfather and my mum. My grandfather is a great listener who never jumps to conclusions, so whenever I feel stressed about school or decisions, he always gives me calm, sound advice that puts things back in perspective."
        }
      ]
    },
    {
      id: 'sp_p1_transport',
      part: 1,
      category: 'daily',
      catLabel: 'Đời sống',
      title: 'Transport & Commuting',
      titleVi: 'Giao thông & Di chuyển hằng ngày',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Chủ đề thực tế tại Việt Nam: nói tự nhiên về xe máy, xe buýt, kẹt xe giờ cao điểm và giao thông công cộng.',
      questions: [
        {
          id: 'p1_tr_1',
          q: 'How do you usually travel to school or work?',
          qType: 'Thói quen',
          formulaVi: 'A: Nêu phương tiện chính (xe máy / xe buýt / đi bộ) → R: Linh hoạt, tiết kiệm thời gian → E: Mất khoảng bao lâu.',
          chunks: ['get around by motorbike', 'weave through narrow streets', 'takes roughly twenty minutes', 'cost-effective'],
          modelEn: "Like most people in Vietnam, I usually get around by motorbike. It's super flexible and cost-effective, especially when you need to weave through narrow streets or run quick errands. On a normal day, my commute takes roughly twenty minutes each way."
        },
        {
          id: 'p1_tr_2',
          q: 'What is public transport like in your city?',
          qType: 'Đánh giá',
          formulaVi: 'A: Đánh giá khách quan (đang cải thiện nhưng chưa phủ kín) → R: Điểm cộng (rẻ, mát) & điểm trừ (đợi lâu) → E: Gợi ý thực tế.',
          chunks: ['steadily improving', 'affordable and air-conditioned', 'still lags behind', 'during peak hours'],
          modelEn: "It's steadily improving, with newer buses that are affordable and air-conditioned. However, compared to major cities abroad, coverage still lags behind a bit, and buses often get stuck in traffic during peak hours. Once the metro lines expand further, I think way more commuters will switch over."
        },
        {
          id: 'p1_tr_3',
          q: 'Do you prefer travelling alone or with other people?',
          qType: 'So sánh lựa chọn',
          formulaVi: 'A: Tùy chặng đường (đi hằng ngày 1 mình, đi du lịch cùng bạn/nhà) → R: Chủ động lịch vs vui vẻ → E: Minh họa ngắn.',
          chunks: ['go at my own pace', 'short commutes', 'share the experience', 'makes the journey fly by'],
          modelEn: "For short commutes, I prefer going alone so I can listen to music and go at my own pace. For longer holiday trips, though, travelling with family or close friends is much more fun because sharing the experience and chatting along the way makes the journey fly by."
        },
        {
          id: 'p1_tr_4',
          q: 'Would you like to ride a bicycle more often in the future?',
          qType: 'Mong muốn',
          formulaVi: 'A: Có, nếu hạ tầng an toàn hơn → R: Tốt cho sức khỏe & môi trường → E: Điều kiện mong muốn (làn xe đạp riêng).',
          chunks: ['eco-friendly way', 'dedicated bike lanes', 'stay active', 'short weekend rides'],
          modelEn: "I'd love to, actually, since cycling is such an eco-friendly way to stay active. Right now, heavy motorbike traffic makes it a bit intimidating on main roads, so I only do short weekend rides in the park. If my city builds dedicated bike lanes, I'd definitely cycle much more."
        }
      ]
    },
    {
      id: 'sp_p1_sports_health',
      part: 1,
      category: 'hobby',
      catLabel: 'Sở thích',
      title: 'Sports & Keeping Fit',
      titleVi: 'Thể thao & Giữ gìn sức khỏe',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Tránh kể khô khan — nói về cảm giác sảng khoái, môn dễ chơi (cầu lông, chạy bộ, bơi) và lý do duy trì sức khỏe.',
      questions: [
        {
          id: 'p1_sh_1',
          q: 'What do you do to keep fit and healthy?',
          qType: 'Thói quen',
          formulaVi: 'A: Nêu 1–2 hoạt động thật bạn làm (chạy bộ, cầu lông, tập nhẹ) → R: Tác dụng giải tỏa & tăng sức bền → E: Tần suất.',
          chunks: ['stay in shape', 'jogging around the park', 'clear my head', 'three times a week'],
          modelEn: "I try to stay in shape by jogging around the local park about three times a week and playing badminton with friends on Sundays. It doesn't require expensive gym gear, and sweating for half an hour is honestly the fastest way to clear my head after studying."
        },
        {
          id: 'p1_sh_2',
          q: 'Do you prefer watching sports or playing them?',
          qType: 'So sánh lựa chọn',
          formulaVi: 'A: Chọn rõ bên nào thích hơn → R: Lý do (vận động trực tiếp vs không khí cổ vũ) → E: Môn cụ thể.',
          chunks: ['hands-on involvement', 'break a sweat', 'electric atmosphere', 'major football tournaments'],
          modelEn: "Overall, I prefer playing sports because I enjoy the hands-on involvement and actually breaking a sweat. That said, I still love watching major football tournaments with my family—the electric atmosphere when Vietnam scores a goal is hard to beat."
        },
        {
          id: 'p1_sh_3',
          q: 'What sports are most popular in your country?',
          qType: 'Thực tế xã hội',
          formulaVi: 'A: Nêu 2 môn phổ biến nhất (bóng đá, cầu lông / pickleball) → R: Dễ chơi, gắn kết cộng đồng → E: Hình ảnh quen thuộc.',
          chunks: ['undoubtedly the biggest', 'bring people together', 'all age groups', 'early mornings in local parks'],
          modelEn: "Football is undoubtedly the biggest sport in Vietnam—it brings people together like nothing else. Alongside that, badminton and jogging are hugely popular across all age groups; if you walk past a park early in the morning, you'll see everyone from teenagers to retirees playing."
        },
        {
          id: 'p1_sh_4',
          q: 'Did you enjoy PE lessons when you were at school?',
          qType: 'Quá khứ',
          formulaVi: 'A: Thích một phần / khá vui → R: Được thoát khỏi bàn học, chơi với bạn → E: Điểm duy nhất hơi ngại (trời nắng / chạy bền).',
          chunks: ['a welcome break from', 'blow off steam', 'dreaded long-distance running', 'team games'],
          modelEn: "Mostly yes! It was a welcome break from sitting in a classroom all morning, and team games like volleyball were a fun way to blow off steam with classmates. The only part I really dreaded was long-distance running under the midday sun."
        }
      ]
    },
    {
      id: 'sp_p1_weekends_free',
      part: 1,
      category: 'social',
      catLabel: 'Xã hội',
      title: 'Weekends & Free Time',
      titleVi: 'Cuối tuần & Thời gian rảnh',
      source: 'Forecast 2025–2026',
      targetSecMin: 20,
      targetSecMax: 35,
      summaryVi: 'Luyện dùng câu điều kiện nhẹ, cách nói kế hoạch tương lai gần và cân bằng giữa nghỉ ngơi – giao lưu.',
      questions: [
        {
          id: 'p1_wf_1',
          q: 'How do you usually spend your weekends?',
          qType: 'Thói quen',
          formulaVi: 'A: Chia nhẹ thứ 7 (gặp bạn / hoàn tất việc) & Chủ nhật (gia đình / nghỉ) → R: Giữ cân bằng → E: 1 thói quen thích nhất.',
          chunks: ['strike a balance between', 'run a few errands', 'quality time with family', 'reset for the week ahead'],
          modelEn: "I try to strike a balance between being productive and taking it easy. On Saturdays, I usually finish up any leftover assignments and run a few errands, then meet friends in the evening. Sundays are mostly reserved for quality time with family so I can reset for the week ahead."
        },
        {
          id: 'p1_wf_2',
          q: 'Do you think you have enough free time nowadays?',
          qType: 'Đánh giá',
          formulaVi: 'A: Khá eo hẹp trong mùa thi / tuần bận → R: Khối lượng bài vở / công việc → E: Cách tranh thủ khoảng nghỉ nhỏ.',
          chunks: ['pretty stretched for time', 'juggling coursework', 'carve out small pockets', 'manage my schedule better'],
          modelEn: "Not always, to be honest—I feel pretty stretched for time whenever I'm juggling coursework and IELTS prep. Still, I've realised it's less about having hours of empty space and more about managing my schedule better so I can carve out small pockets to rest."
        },
        {
          id: 'p1_wf_3',
          q: 'Do you like planning your weekends in advance?',
          qType: 'Sở thích · Tính cách',
          formulaVi: 'A: Lên khung nhẹ thôi chứ không cứng nhắc → R: Vừa không lãng phí ngày nghỉ vừa đỡ áp lực → E: Ví dụ.',
          chunks: ['a rough plan in mind', 'go with the flow', 'make the most of', 'packed itinerary'],
          modelEn: "I like having a rough plan in mind—maybe one or two things I definitely want to do—so I make the most of my time off instead of sleeping the whole day away. At the same time, I avoid a packed itinerary because it's nicer to go with the flow on weekends."
        },
        {
          id: 'p1_wf_4',
          q: 'What are you planning to do this coming weekend?',
          qType: 'Tương lai gần',
          formulaVi: 'A: Nêu kế hoạch gần cụ thể (dùng be going to / planning to) → R: Lý do → E: Điều bạn mong chờ nhất.',
          chunks: ['looking forward to', 'catch up on some rest', 'try out a new café', 'finish a mock test'],
          modelEn: "This coming weekend, I'm planning to finish one full IELTS mock test on Saturday morning so I stay on track. After that, I'm really looking forward to trying out a new café near my house with a close friend and catching up on some well-earned rest."
        }
      ]
    }
  ];

  const PART3_TOPICS = [
    {
      id: 'sp_p3_older_gen',
      part: 3,
      category: 'society',
      catLabel: 'Gia đình & Thế hệ · Story 01',
      title: 'Older Generations, Mentors & Patience',
      titleVi: 'Thế hệ lớn tuổi, Người dẫn dắt & Sự kiên nhẫn',
      linkedStory: 'sp_story_01',
      source: 'Linked to Story 01 · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Nối thẳng sau Cue Card Story 01 (Ông Ngoại & Sự Kiên Nhẫn) — luyện thảo luận sâu ở tầm xã hội bằng khung P.E.E.C.',
      questions: [
        {
          id: 'p3_og_1',
          q: 'What can younger people learn from older generations today?',
          qType: 'Phân tích giá trị',
          formulaVi: 'P: Khẳng định bài học lớn nhất là bản lĩnh & sự điềm tĩnh → E: Lý do (trải qua nhiều thăng trầm thực tế) → E: Ví dụ cách xử lý khủng hoảng / giao tiếp → C: Nhấn mạnh người trẻ vẫn cần lọc cái phù hợp thời đại.',
          chunks: ['emotional resilience', 'lived experience', 'take a step back', 'put setbacks into perspective'],
          modelEn: "From my perspective, the most valuable thing younger people can learn from older generations is emotional resilience and patience. Because seniors have navigated decades of economic and personal ups and downs, they tend to take a step back instead of panicking over minor setbacks. In Vietnam, for instance, grandparents often pass down practical wisdom about saving money and maintaining family harmony. That said, young people also need to adapt those lessons thoughtfully so they still fit today's fast-changing world."
        },
        {
          id: 'p3_og_2',
          q: 'Why do you think there is sometimes a generation gap between grandparents and grandchildren?',
          qType: 'Nguyên nhân – Hệ quả',
          formulaVi: 'P: Do khác biệt tốc độ công nghệ & chuẩn mực sống → E: Giải thích 2 thế hệ lớn lên trong 2 môi trường đối lập → E: Ví dụ chọn nghề / dùng mạng xã hội → C: Tuy nhiên vẫn thu hẹp được nếu chịu lắng nghe.',
          chunks: ['bridge the generation gap', 'shaped by vastly different eras', 'digital natives', 'mutual empathy'],
          modelEn: "I think the generation gap mainly stems from the fact that the two groups were shaped by vastly different eras. Older people often grew up valuing stability and face-to-face community, whereas today's youth are digital natives who embrace rapid change and flexible careers. As a result, they can easily clash over lifestyle choices or screen habits. Even so, the gap isn't permanent—when both sides practise mutual empathy and stay curious about each other's world, they usually find plenty of common ground."
        },
        {
          id: 'p3_og_3',
          q: 'Do you think people today are less patient than people in the past?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'P: Phần lớn là có (văn hóa tức thì) → E: Quen giao hàng nhanh, video ngắn 15s làm giảm ngưỡng chịu chờ → E: Ví dụ bỏ qua bài học dài / dễ sốt ruột khi học kỹ năng mới → C: Nhưng ở khía cạnh khác, người trẻ vẫn rất bền bỉ khi theo đuổi đam mê.',
          chunks: ['instant gratification', 'shortened attention spans', 'expect immediate results', 'on the flip side'],
          modelEn: "In many everyday situations, yes—modern life definitely encourages a culture of instant gratification. Because we can order food, stream films, and look up answers in seconds, our shortened attention spans make waiting feel far more frustrating than it used to. You can see this clearly when learners expect immediate results instead of building skills gradually. On the flip side, I wouldn't say patience has disappeared completely, since plenty of young people still dedicate years to mastering demanding careers or creative crafts."
        },
        {
          id: 'p3_og_4',
          q: 'How can society better support retired people so they stay active and valued?',
          qType: 'Giải pháp xã hội',
          formulaVi: 'P: Kết hợp 2 hướng: vai trò cộng đồng & tiếp cận công nghệ → E: Người về hưu thường buồn vì thấy mình "hết ích" hơn là thiếu tiền → E: Mở lớp cố vấn, CLB cộng đồng, dạy kỹ năng số → C: Gia đình cũng đóng vai trò then chốt.',
          chunks: ['a sense of purpose', 'community mentoring programmes', 'social isolation', 'stay mentally engaged'],
          modelEn: "I believe the key is giving retirees a real sense of purpose rather than only focusing on financial pensions. Many older adults suffer from social isolation simply because they suddenly feel unneeded after leaving work. Local councils could run community mentoring programmes where retired teachers or professionals guide students, alongside friendly workshops that help seniors use digital services. Of course, government efforts work best when families also actively include older relatives in everyday decisions."
        }
      ]
    },
    {
      id: 'sp_p3_education_skills',
      part: 3,
      category: 'education',
      catLabel: 'Giáo dục & Kỹ năng',
      title: 'Education, Practical Skills & Lifelong Learning',
      titleVi: 'Giáo dục, Kỹ năng thực tế & Học tập suốt đời',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Chủ đề trọng tâm Part 3: trường học nên dạy kỹ năng mềm hay lý thuyết, vai trò giáo viên thời AI.',
      questions: [
        {
          id: 'p3_ed_1',
          q: 'Should schools focus more on academic subjects or practical life skills?',
          qType: 'Đánh giá · Cân bằng',
          formulaVi: 'P: Không nên chọn 1 bỏ 1, nhưng cần tăng tỷ trọng kỹ năng sống → E: Kiến thức hàn lâm tạo nền tư duy, nhưng ra đời thiếu tài chính/giao tiếp rất chật vật → E: Ví dụ quản lý chi tiêu, thuyết trình → C: Tuy nhiên môn học thuật nền tảng vẫn thiết yếu cho bậc đại học.',
          chunks: ['strike a healthier balance', 'rote memorisation', 'real-world readiness', 'a strong academic foundation'],
          modelEn: "I'd argue that schools need to strike a healthier balance rather than treating the two as opposites. Traditionally, many education systems have leaned too heavily on rote memorisation for exams, leaving graduates unsure how to manage personal finances or communicate under pressure. Adding practical modules like budgeting and collaboration would greatly improve real-world readiness. Still, core academic subjects remain vital because they train critical thinking and prepare students for specialised university degrees."
        },
        {
          id: 'p3_ed_2',
          q: 'What qualities make a truly effective teacher?',
          qType: 'Phân tích phẩm chất',
          formulaVi: 'P: Chuyên môn là điều kiện cần, nhưng sự thấu cảm & khả năng đơn giản hóa mới là điều kiện đủ → E: Học sinh sợ sai sẽ ngại hỏi nếu thầy cô quá gắt → E: Chia bài khó thành bước nhỏ, khuyến khích đặt câu hỏi → C: Kỷ luật rõ ràng vẫn cần song hành.',
          chunks: ['break complex concepts down', 'empathy and adaptability', 'a safe space to make mistakes', 'spark genuine curiosity'],
          modelEn: "Beyond solid subject knowledge, I think empathy and adaptability separate great teachers from average ones. Anyone can read from a textbook, yet an effective teacher knows how to break complex concepts down and create a safe space to make mistakes. When learners aren't afraid of being criticised, they participate far more actively and spark genuine curiosity. Of course, a good teacher still needs clear standards and structure so students stay disciplined."
        },
        {
          id: 'p3_ed_3',
          q: 'Why is lifelong learning becoming more important than ever before?',
          qType: 'Nguyên nhân – Hệ quả',
          formulaVi: 'P: Vì vòng đời của kỹ năng nghề nghiệp ngày càng ngắn → E: Tự động hóa & AI thay đổi cách làm việc liên tục → E: Ví dụ nhân viên văn phòng phải học công cụ phân tích dữ liệu mới → C: Học suốt đời cũng giúp giữ trí óc minh mẫn ngoài công việc.',
          chunks: ['rapid pace of automation', 'skills become outdated quickly', 'stay competitive in the job market', 'continuous upskilling'],
          modelEn: "The main reason is the rapid pace of automation and technological shifts across almost every industry. A university degree used to be enough for a thirty-year career, whereas today technical skills become outdated quickly. Without continuous upskilling—whether through online courses or workplace training—workers risk struggling to stay competitive in the job market. Beyond career security, keeping a learning mindset also keeps people intellectually sharp and adaptable as they age."
        },
        {
          id: 'p3_ed_4',
          q: 'Do you think online courses will eventually replace traditional classrooms?',
          qType: 'Dự đoán tương lai',
          formulaVi: 'P: Không thay thế hoàn toàn, mà sẽ tiến tới mô hình kết hợp (blended) → E: Học online linh hoạt & rẻ nhưng dễ mất tập trung, thiếu tương tác người thật → E: Trẻ nhỏ càng cần môi trường lớp học để học kỹ năng xã hội → C: Còn với người đi làm thì online cực kỳ tối ưu.',
          chunks: ['a blended model', 'self-discipline', 'irreplaceable social interaction', 'supplement rather than replace'],
          modelEn: "I don't think online learning will completely replace physical classrooms; instead, we're heading towards a blended model. Digital platforms are fantastic for flexibility and reaching remote learners, yet they demand strong self-discipline and often lack the irreplaceable social interaction of a real school. Especially for younger children, learning to cooperate face to face is just as important as the syllabus itself. So in the long run, online courses are more likely to supplement rather than replace traditional education."
        }
      ]
    },
    {
      id: 'sp_p3_ai_technology',
      part: 3,
      category: 'tech',
      catLabel: 'Công nghệ & AI',
      title: 'AI, Smartphones & Human Connection',
      titleVi: 'Trí tuệ nhân tạo, Công nghệ & Kết nối con người',
      source: 'Hot Topic · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Chủ đề nóng nhất IELTS 2025–2026: tác động hai mặt của AI, mạng xã hội và quyền riêng tư.',
      questions: [
        {
          id: 'p3_ai_1',
          q: 'How has technology changed the way people communicate with each other?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'P: Nhanh hơn, xóa khoảng cách địa lý nhưng dễ nông hơn → E: Nhắn tin/gọi video tức thì giữ kết nối xa, nhưng ngồi cạnh nhau vẫn dán mắt vào màn hình → E: Ví dụ gia đình xa nhau gọi video mỗi tối → C: Cốt lõi nằm ở cách người dùng kiểm soát thời lượng.',
          chunks: ['a double-edged sword', 'erased geographical barriers', 'superficial interactions', 'mindful boundaries'],
          modelEn: "Technology has really been a double-edged sword for human communication. On the positive side, instant messaging and video calls have erased geographical barriers, making it effortless for families living in different countries to stay in touch daily. On the downside, constant texting can sometimes lead to more superficial interactions, where people sit at the same dinner table yet stare at separate screens. Ultimately, whether it helps or hurts depends on setting mindful boundaries."
        },
        {
          id: 'p3_ai_2',
          q: 'Do you think artificial intelligence will create more jobs or destroy more jobs?',
          qType: 'Đánh giá lợi – hại',
          formulaVi: 'P: Ngắn hạn sẽ cắt giảm nhiều việc lặp lại, dài hạn chuyển dịch sang vai trò mới → E: AI xử lý dữ liệu, dịch thuật cơ bản nhanh hơn người → E: Nhưng lại tăng nhu cầu kiểm duyệt, thiết kế trải nghiệm, chăm sóc con người → C: Cần chính sách đào tạo lại để người lao động không bị bỏ lại.',
          chunks: ['automate repetitive tasks', 'reshape the labour market', 'human judgement and creativity', 'retraining initiatives'],
          modelEn: "In the short term, I think AI will inevitably displace a fair number of routine roles, since software can automate repetitive tasks like basic data entry far faster than humans. Over time, however, history suggests new technology tends to reshape the labour market rather than wipe out employment altogether, creating fresh demand for roles that rely on human judgement and creativity. The real challenge for governments will be funding retraining initiatives so displaced workers aren't left behind."
        },
        {
          id: 'p3_ai_3',
          q: 'Should parents strictly limit children’s access to smartphones and tablets?',
          qType: 'Quan điểm · Giải pháp',
          formulaVi: 'P: Nên đặt ranh giới rõ theo độ tuổi thay vì cấm tuyệt đối → E: Quá nhiều màn hình ảnh hưởng giấc ngủ, thị lực & sự tập trung → E: Giới hạn giờ dùng & ưu tiên app học tập → C: Nếu cấm quá cực đoan, trẻ lớn lên có thể thiếu kỹ năng số an toàn.',
          chunks: ['age-appropriate boundaries', 'digital literacy', 'interfere with sleep and focus', 'guided supervision'],
          modelEn: "Yes, I believe parents should set clear, age-appropriate boundaries, particularly for young children. Excessive screen exposure can easily interfere with sleep, physical activity, and attention span during critical developmental years. Having screen-free meals and bedtimes is a practical place to start. At the same time, a total ban for teenagers might backfire, because guided supervision helps them build healthy digital literacy before they head off to university."
        },
        {
          id: 'p3_ai_4',
          q: 'Why do some people worry about privacy when using modern technology?',
          qType: 'Nguyên nhân',
          formulaVi: 'P: Vì dữ liệu cá nhân bị thu thập ngầm quá sâu → E: Mọi lượt tìm kiếm, vị trí, thanh toán đều lưu dấu để chạy quảng cáo hoặc có nguy cơ rò rỉ → E: Ví dụ lừa đảo trực tuyến ngày càng tinh vi → C: Nhiều người chấp nhận đánh đổi vì sự tiện lợi, nên luật bảo vệ dữ liệu rất cần thiết.',
          chunks: ['digital footprint', 'targeted advertising', 'data breaches and scams', 'trade-off for convenience'],
          modelEn: "People are right to be cautious because modern apps collect a remarkably detailed digital footprint—from our location and shopping habits to our voice recordings. While companies claim this only improves targeted advertising, consumers increasingly worry about data breaches and sophisticated online scams. Even though many of us accept this as a trade-off for convenience, stronger data-protection laws are clearly needed to hold tech platforms accountable."
        }
      ]
    },
    {
      id: 'sp_p3_work_career',
      part: 3,
      category: 'education',
      catLabel: 'Công việc & Sự nghiệp',
      title: 'Modern Work, Remote Jobs & Career Choices',
      titleVi: 'Công việc hiện đại, Làm việc từ xa & Chọn nghề',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Thảo luận về work-life balance, làm việc từ xa, lương cao vs đam mê và xu hướng nhảy việc của giới trẻ.',
      questions: [
        {
          id: 'p3_wk_1',
          q: 'What are the advantages and disadvantages of working from home?',
          qType: 'Đánh giá lợi – hại',
          formulaVi: 'P: Rất linh hoạt nhưng dễ mờ ranh giới công việc – cuộc sống → E: Tiết kiệm giờ kẹt xe, tăng quyền chủ động → E: Ngược lại dễ cảm thấy cô lập, khó học hỏi đồng nghiệp trực tiếp → C: Mô hình hybrid 2–3 ngày/tuần đang cân bằng tốt nhất.',
          chunks: ['cut out daily commuting', 'blur the line between', 'sense of isolation', 'a hybrid arrangement'],
          modelEn: "Working from home brings obvious perks, most notably cutting out daily commuting and giving employees much greater flexibility to handle family commitments. However, the major drawback is that it can blur the line between work and personal life, making it hard to switch off at the end of the day. New graduates may also feel a sense of isolation and miss out on casual mentoring. That's why a hybrid arrangement often offers the best of both worlds."
        },
        {
          id: 'p3_wk_2',
          q: 'Is a high salary more important than job satisfaction when choosing a career?',
          qType: 'So sánh giá trị',
          formulaVi: 'P: Tùy giai đoạn cuộc đời, nhưng cả hai đều có ngưỡng tối thiểu → E: Lương quá thấp gây áp lực sinh tồn; việc chán nản kéo dài dẫn đến kiệt sức (burnout) → E: Nhiều người chọn việc lương đủ sống nhưng có cơ hội phát triển → C: Về lâu dài, hứng thú nghề nghiệp thường giúp thu nhập tăng bền vững hơn.',
          chunks: ['depends on one’s life stage', 'financial stability', 'lead to burnout', 'long-term fulfilment'],
          modelEn: "I think the answer largely depends on one's life stage. Early on, or when someone has a family to support, financial stability has to come first because constant money worries overshadow everything else. Once basic needs are comfortably met, though, job satisfaction becomes crucial—staying in a high-paying job you hate will almost certainly lead to burnout. Ideally, people look for work that pays fairly while still offering long-term fulfilment and growth."
        },
        {
          id: 'p3_wk_3',
          q: 'Why do young workers today change jobs more frequently than their parents did?',
          qType: 'Nguyên nhân',
          formulaVi: 'P: Do thị trường mở hơn & quan niệm trung thành đã thay đổi → E: Ngày xưa ít kênh tuyển dụng và coi trọng việc ổn định cả đời; nay dễ tìm cơ hội tốt hơn qua mạng → E: Chuyển việc cũng là cách tăng lương & học kỹ năng nhanh → C: Tuy nhiên nhảy việc quá dày dễ khiến nhà tuyển dụng nghi ngại.',
          chunks: ['a job for life', 'career progression', 'greater transparency', 'prioritise personal growth'],
          modelEn: "A big factor is that the old idea of staying in a job for life has largely faded. Unlike their parents, young professionals today have greater transparency through online job boards and can easily compare salaries and workplace cultures. On top of that, changing companies every couple of years is often the fastest route to career progression and higher pay. Still, job-hopping too frequently can backfire if employers start questioning a candidate's commitment."
        },
        {
          id: 'p3_wk_4',
          q: 'How can companies help employees maintain a healthy work-life balance?',
          qType: 'Giải pháp',
          formulaVi: 'P: Bắt đầu từ văn hóa tôn trọng giờ nghỉ thay vì chỉ khẩu hiệu → E: Hạn chế nhắn tin công việc ngoài giờ, đánh giá theo kết quả thay vì ngồi đủ giờ → E: Ví dụ quy định "right to disconnect" sau 6 giờ chiều → C: Bản thân nhân viên cũng cần biết quản lý thời gian hiệu quả.',
          chunks: ['respect after-hours boundaries', 'measure output rather than hours', 'prevent chronic stress', 'flexible working policies'],
          modelEn: "First and foremost, companies should genuinely respect after-hours boundaries—for example, discouraging managers from sending non-urgent messages late at night or on weekends. Measuring output rather than simply counting hours spent at a desk also gives staff room to manage their personal lives without guilt. Pair that with flexible working policies and realistic workloads, and businesses will not only prevent chronic stress but also see stronger loyalty and productivity."
        }
      ]
    },
    {
      id: 'sp_p3_environment_cities',
      part: 3,
      category: 'lifestyle',
      catLabel: 'Môi trường & Đô thị',
      title: 'Environment, Urban Life & Sustainability',
      titleVi: 'Môi trường, Đô thị hóa & Phát triển bền vững',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Luyện lập luận sắc bén về trách nhiệm cá nhân vs chính phủ, không gian xanh trong thành phố và giao thông sạch.',
      questions: [
        {
          id: 'p3_env_1',
          q: 'Who should take greater responsibility for protecting the environment: individuals or governments?',
          qType: 'Đánh giá trách nhiệm',
          formulaVi: 'P: Chính phủ phải dẫn dắt bằng luật & hạ tầng, cá nhân đóng góp bằng thói quen → E: Chỉ 1 người tiết kiệm nhựa không đủ chặn khí thải công nghiệp → E: Nhà nước đánh thuế ô nhiễm, phát triển điện sạch; dân phân loại rác → C: Thiếu sự ủng hộ của người dân thì chính sách cũng khó bền.',
          chunks: ['bear the primary responsibility', 'systemic change', 'enforce strict regulations', 'collective daily habits'],
          modelEn: "While both sides matter, I'd say governments bear the primary responsibility because environmental issues require systemic change. Individual actions like carrying a reusable bottle are great for raising awareness, yet they can't match the impact of strict regulations on industrial emissions or investments in clean public transport. That said, policies only succeed in the long run when citizens back them up through collective daily habits and smarter consumer choices."
        },
        {
          id: 'p3_env_2',
          q: 'Why are green spaces like parks so important in modern cities?',
          qType: 'Phân tích vai trò',
          formulaVi: 'P: Là "lá phổi" thể chất lẫn tinh thần của đô thị bê tông → E: Giảm hiệu ứng đảo nhiệt, lọc bụi, đồng thời giúp cư dân xả stress → E: Công viên là nơi người già tập dưỡng sinh, trẻ em chạy nhảy miễn phí → C: Đất đô thị đắt đỏ nhưng cắt giảm cây xanh sẽ trả giá đắt về sức khỏe cộng đồng.',
          chunks: ['urban heat island effect', 'mental well-being', 'a sense of community', 'concrete jungle'],
          modelEn: "Urban parks are vital for both physical health and mental well-being. Environmentally, trees help cool down densely packed neighbourhoods by reducing the urban heat island effect and absorbing air pollution. Socially, parks provide free, welcoming spaces where children can play and older residents can exercise, creating a rare sense of community inside a concrete jungle. Even though city land is expensive, sacrificing green spaces always comes at a heavy cost to public health."
        },
        {
          id: 'p3_env_3',
          q: 'What are the biggest challenges facing rapidly growing cities today?',
          qType: 'Phân tích vấn đề',
          formulaVi: 'P: Hai thách thức lớn nhất là hạ tầng quá tải & chi phí nhà ở → E: Dân số đổ về nhanh hơn tốc độ xây đường, trường học, bệnh viện → E: Kẹt xe, ô nhiễm không khí và người trẻ khó mua nhà → C: Quy hoạch đô thị vệ tinh là hướng đi cần thiết.',
          chunks: ['overstretched infrastructure', 'soaring housing costs', 'air quality deterioration', 'satellite towns'],
          modelEn: "Rapidly expanding cities usually struggle with two connected pressures: overstretched infrastructure and soaring housing costs. When populations surge faster than roads, drainage, and public transit can be upgraded, severe traffic congestion and air quality deterioration quickly follow. At the same time, young families get priced out of central areas and face exhausting commutes. Developing well-connected satellite towns is one realistic way to relieve that pressure."
        },
        {
          id: 'p3_env_4',
          q: 'How can young people be encouraged to adopt greener habits?',
          qType: 'Giải pháp',
          formulaVi: 'P: Kết hợp tiện lợi + động lực tài chính thay vì chỉ kêu gọi suông → E: Người trẻ rất quan tâm môi trường nhưng thường ngại nếu quá đắt hoặc phiền → E: Giảm giá khi mang ly cá nhân, đặt thùng tái chế dễ thấy ở trường → C: Kênh mạng xã hội từ người có sức ảnh hưởng cũng tạo hiệu ứng lan tỏa nhanh.',
          chunks: ['make sustainable choices convenient', 'small financial incentives', 'eco-friendly habits', 'peer influence'],
          modelEn: "The most effective approach is to make sustainable choices convenient and rewarding rather than lecturing people. Many young people already care about climate issues, yet they hesitate if greener options are overpriced or inconvenient. Offering small financial incentives—like discounts for bringing reusable cups or cheaper student bus passes—works surprisingly well. On top of that, positive peer influence on social media can quickly turn eco-friendly habits into a mainstream lifestyle."
        }
      ]
    },
    {
      id: 'sp_p3_media_news',
      part: 3,
      category: 'tech',
      catLabel: 'Truyền thông & Tin tức',
      title: 'Social Media, News & Information Trust',
      titleVi: 'Mạng xã hội, Tin tức & Độ tin cậy thông tin',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Luyện thảo luận tin giả (misinformation), báo giấy vs mạng xã hội và tầm quan trọng của tư duy phản biện.',
      questions: [
        {
          id: 'p3_mn_1',
          q: 'How has the way people get their news changed over the last twenty years?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'P: Chuyển từ nguồn kiểm duyệt cố định (báo giấy, TV) sang dòng tin tức thời trên mạng → E: Tin đến trong vài giây nhưng thường ngắn và thiếu bối cảnh → E: Giới trẻ lướt tin qua clip 60 giây thay vì đọc báo sáng → C: Tốc độ tăng vượt bậc nhưng chất lượng kiểm chứng lại giảm.',
          chunks: ['real-time updates', 'bite-sized clips', 'traditional print media', 'at the expense of depth'],
          modelEn: "News consumption has shifted dramatically from scheduled broadcasts and traditional print media to real-time updates on smartphones. Nowadays, most young adults encounter breaking news through bite-sized clips on social platforms rather than sitting down with a morning newspaper. While this makes information far more immediate and accessible, it often comes at the expense of depth and careful fact-checking."
        },
        {
          id: 'p3_mn_2',
          q: 'Why does false information spread so quickly on social media?',
          qType: 'Nguyên nhân',
          formulaVi: 'P: Vì thuật toán ưu tiên cảm xúc mạnh (sốc, giận dữ) hơn là sự thật khô khan → E: Tiêu đề giật gân khiến người dùng chia sẻ ngay trước khi kiểm chứng → E: Tin đồn sức khỏe hoặc scandal lan trong vài phút → C: Bản năng muốn chia sẻ nhanh cũng góp phần khuếch đại vấn đề.',
          chunks: ['sensational headlines', 'algorithms reward engagement', 'trigger strong emotions', 'share without verifying'],
          modelEn: "A huge reason is that social media algorithms reward engagement rather than accuracy. Posts with sensational headlines that trigger strong emotions—like anger, fear, or shock—naturally attract far more clicks and comments than balanced reporting. On top of that, people often skim a dramatic headline and share it without verifying the source, allowing rumours to go viral within minutes."
        },
        {
          id: 'p3_mn_3',
          q: 'Do you think traditional newspapers will disappear completely in the future?',
          qType: 'Dự đoán tương lai',
          formulaVi: 'P: Báo in giấy sẽ thu hẹp mạnh thành phân khúc ngách, còn các tòa soạn sẽ sống nhờ bản số → E: Chi phí in ấn cao và giới trẻ chuộng đọc miễn phí trên điện thoại → E: Nhưng độc giả lớn tuổi & tạp chí chuyên sâu vẫn thích cầm bản in → C: Điều quan trọng nhất là báo chí chuyên nghiệp vẫn không thể thiếu.',
          chunks: ['a niche product', 'pivot to digital subscriptions', 'high printing costs', 'investigative journalism'],
          modelEn: "Printed newspapers will probably shrink into a niche product, though I don't think professional news organisations themselves will vanish. High printing costs and shifting habits among younger readers have forced most outlets to pivot to digital subscriptions and podcasts. Still, a loyal group of older readers and weekend subscribers continue to enjoy holding a physical paper, and society will always need credible investigative journalism regardless of the format."
        },
        {
          id: 'p3_mn_4',
          q: 'How can people tell whether an online news story is reliable?',
          qType: 'Giải pháp · Kỹ năng',
          formulaVi: 'P: Áp dụng thói quen đối chiếu nguồn & đọc quá tiêu đề → E: Kiểm tra tác giả, dẫn chứng gốc và xem các cơ quan uy tín khác có đưa tin không → E: Cẩn trọng với bài viết toàn lời cảm tính, không ghi ngày tháng → C: Dạy kỹ năng media literacy từ bậc phổ thông là giải pháp căn cơ nhất.',
          chunks: ['cross-check multiple sources', 'look beyond the headline', 'credible evidence', 'media literacy'],
          modelEn: "The simplest habit is to look beyond the headline and cross-check multiple reputable sources before believing or sharing a claim. Reliable journalism usually names clear authors, cites verifiable data, and presents more than one viewpoint, whereas clickbait relies heavily on emotional language and vague rumours. In the long run, teaching media literacy in schools is the smartest way to help citizens navigate online information safely."
        }
      ]
    },
    {
      id: 'sp_p3_health_lifestyle',
      part: 3,
      category: 'lifestyle',
      catLabel: 'Sức khỏe & Lối sống',
      title: 'Health, Stress & Modern Lifestyles',
      titleVi: 'Sức khỏe, Căng thẳng & Lối sống hiện đại',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Luyện nói tự tin về lối sống ít vận động, sức khỏe tinh thần và vai trò phòng bệnh hơn chữa bệnh.',
      questions: [
        {
          id: 'p3_hl_1',
          q: 'Why do many people struggle to maintain a healthy lifestyle nowadays?',
          qType: 'Nguyên nhân',
          formulaVi: 'P: Do lịch trình bận rộn kết hợp lối sống ngồi nhiều → E: Làm việc trước máy tính 8–10 tiếng khiến cuối ngày kiệt sức, dễ đặt đồ ăn nhanh → E: Giao đồ ăn tận cửa tiện hơn nấu nướng rất nhiều → C: Đôi khi cũng do thiếu nhận thức sớm cho đến khi sức khỏe báo động.',
          chunks: ['sedentary lifestyles', 'convenience foods', 'time-poor schedules', 'fall to the bottom of the priority list'],
          modelEn: "I think it mostly comes down to time-poor schedules and increasingly sedentary lifestyles. Many office workers and students sit in front of screens for eight to ten hours a day, so by the evening they're mentally drained and far more tempted to order convenience foods than cook or hit the gym. Unfortunately, exercise and proper sleep often fall to the bottom of the priority list until health problems actually appear."
        },
        {
          id: 'p3_hl_2',
          q: 'Is mental health given enough attention in modern society?',
          qType: 'Đánh giá xã hội',
          formulaVi: 'P: Đang cải thiện rõ ở giới trẻ nhưng vẫn còn định kiến ở thế hệ lớn → E: Trước đây áp lực tinh thần hay bị xem là "yếu đuối", nay đã cởi mở hơn → E: Nhiều trường đại học mở phòng tham vấn tâm lý miễn phí → C: Chi phí trị liệu chuyên sâu vẫn còn cao nên cần đầu tư thêm.',
          chunks: ['breaking the stigma', 'just as vital as physical health', 'open conversations', 'affordable counselling'],
          modelEn: "Society is definitely moving in the right direction, especially among younger generations who are breaking the stigma through open conversations online. More schools and workplaces now recognise that mental health is just as vital as physical health. However, significant gaps remain: many older people still hesitate to seek help, and professional, affordable counselling is not yet easy to access everywhere."
        },
        {
          id: 'p3_hl_3',
          q: 'Should governments spend more money on preventing illness or on treating it?',
          qType: 'So sánh chính sách',
          formulaVi: 'P: Tăng đầu tư cho phòng bệnh sẽ tiết kiệm khổng lồ về dài hạn → E: Khám định kỳ, tiêm chủng, giáo dục dinh dưỡng chặn bệnh mãn tính từ sớm → E: Ví dụ chi phí chữa tiểu đường/tim mạch tốn gấp nhiều lần phòng ngừa → C: Dĩ nhiên bệnh viện điều trị cấp cứu vẫn phải đảm bảo đủ nguồn lực.',
          chunks: ['prevention is better than cure', 'ease the burden on hospitals', 'chronic diseases', 'long-term healthcare costs'],
          modelEn: "While hospitals obviously need steady funding to treat emergencies, investing far more in prevention makes much greater sense in the long run. Public campaigns on nutrition, regular health screenings, and accessible sports facilities can drastically reduce chronic diseases like diabetes and heart conditions. Not only does that improve quality of life, it also eases the burden on overcrowded hospitals and cuts long-term healthcare costs."
        },
        {
          id: 'p3_hl_4',
          q: 'How has people’s attitude towards fitness changed compared to the past?',
          qType: 'So sánh xưa – nay',
          formulaVi: 'P: Từ vận động tự nhiên vì lao động sang tập luyện có ý thức để khỏe & đẹp → E: Ngày xưa lao động chân tay nhiều nên ít ai nghĩ tới phòng gym; nay tập luyện trở thành phong cách sống → E: Trào lưu chạy marathon cộng đồng, đồng hồ đo bước chân → C: Đôi lúc áp lực ngoại hình trên mạng xã hội cũng gây tác dụng ngược.',
          chunks: ['manual labour', 'proactive self-care', 'fitness trackers', 'unrealistic body standards'],
          modelEn: "Decades ago, most people stayed active naturally through manual labour or walking everywhere, so formal exercise wasn't really a separate hobby. Today, with desk jobs dominating, fitness has turned into proactive self-care—people track steps on smartwatches, join running clubs, and pay close attention to nutrition. The only concern is that social media can sometimes push unrealistic body standards rather than genuine well-being."
        }
      ]
    },
    {
      id: 'sp_p3_culture_travel',
      part: 3,
      category: 'lifestyle',
      catLabel: 'Văn hóa & Du lịch',
      title: 'Culture, Tourism & Globalization',
      titleVi: 'Văn hóa, Du lịch & Toàn cầu hóa',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Thảo luận du lịch đại chúng vs du lịch bền vững, giữ gìn bản sắc văn hóa và lợi ích của việc đi đây đi đó.',
      questions: [
        {
          id: 'p3_ct_1',
          q: 'What are the positive and negative effects of tourism on local communities?',
          qType: 'Đánh giá lợi – hại',
          formulaVi: 'P: Tạo động lực kinh tế rõ rệt nhưng dễ gây quá tải & thương mại hóa → E: Mang lại việc làm, thu nhập, cơ sở hạ tầng cho địa phương → E: Nhưng lượng khách quá đông làm tăng giá nhà, xả rác, phai nhạt nét truyền thống → C: Quản lý số lượng khách & du lịch cộng đồng sẽ giữ được cân bằng.',
          chunks: ['boost the local economy', 'overtourism', 'commercialise local traditions', 'sustainable tourism'],
          modelEn: "Tourism can powerfully boost the local economy by creating jobs in hospitality, supporting small artisans, and funding better transport links. On the flip side, unchecked overtourism often drives up housing prices for residents, strains natural sites with waste, and commercialises local traditions purely for photo opportunities. That's why destinations increasingly promote sustainable tourism that respects both the environment and local people."
        },
        {
          id: 'p3_ct_2',
          q: 'Why is it important to preserve historical buildings and traditional customs?',
          qType: 'Phân tích giá trị',
          formulaVi: 'P: Giữ ký ức chung & bản sắc giữa thế giới ngày càng giống nhau → E: Kiến trúc cổ, lễ hội giúp thế hệ sau hiểu cội nguồn thay vì chỉ đọc sách → E: Ví dụ phố cổ Hội An hay áo dài truyền thống tạo niềm tự hào → C: Tuy nhiên bảo tồn nên gắn với đời sống hiện đại chứ không đóng khung bảo tàng.',
          chunks: ['a sense of identity', 'living link to the past', 'cultural homogenisation', 'pass down to future generations'],
          modelEn: "Historical landmarks and customs give communities a shared sense of identity in an era of rapid cultural homogenisation, where modern cities increasingly look identical. Walking through an old quarter or joining a traditional festival provides a living link to the past that textbooks simply can't replicate. That said, preservation works best when heritage sites are thoughtfully integrated into modern life rather than left unused."
        },
        {
          id: 'p3_ct_3',
          q: 'Do people learn more from travelling abroad or from reading about other countries?',
          qType: 'So sánh',
          formulaVi: 'P: Du lịch mang lại trải nghiệm đa giác quan sâu sắc hơn, nhưng đọc sách cho nền tảng lịch sử rộng hơn → E: Đến tận nơi giao tiếp, nếm món ăn giúp phá bỏ định kiến nhanh nhất → E: Ngược lại du lịch ngắn ngày chỉ lướt qua nếu không đọc tìm hiểu trước → C: Kết hợp đọc trước rồi đi là hiệu quả nhất.',
          chunks: ['first-hand experience', 'challenge stereotypes', 'deeper historical context', 'go hand in hand'],
          modelEn: "Travelling abroad offers vivid first-hand experience—tasting local cuisine, navigating unfamiliar norms, and talking with locals can challenge stereotypes in a way books rarely can. However, a rushed three-day holiday only scratches the surface, whereas reading provides deeper historical context and lets you explore places you may never afford to visit. Ideally, the two go hand in hand: reading beforehand makes every trip far more meaningful."
        },
        {
          id: 'p3_ct_4',
          q: 'How might international travel change in the next twenty years?',
          qType: 'Dự đoán tương lai',
          formulaVi: 'P: Chuyển sang trải nghiệm cá nhân hóa, xanh hơn & kết hợp công nghệ → E: Ý thức khí hậu thúc đẩy tàu cao tốc, du lịch chậm (slow travel) → E: AI dịch thuật tức thì xóa rào cản ngôn ngữ cho khách tự túc → C: Chi phí bay có thể tăng nhẹ vì thuế carbon.',
          chunks: ['slow, eco-conscious travel', 'real-time translation tools', 'lower-carbon alternatives', 'personalised itineraries'],
          modelEn: "Over the next couple of decades, I expect international travel to become both smarter and greener. Real-time translation tools will make independent travel far less intimidating, allowing tourists to venture beyond typical hotspots. At the same time, growing climate awareness and carbon taxes could push travellers towards slower, eco-conscious trips—staying longer in one region and choosing high-speed trains over frequent short-haul flights."
        }
      ]
    },
    {
      id: 'sp_p3_youth_values',
      part: 3,
      category: 'society',
      catLabel: 'Giới trẻ & Giá trị sống',
      title: 'Young People, Role Models & Decisions',
      titleVi: 'Giới trẻ, Hình mẫu & Kỹ năng ra quyết định',
      source: 'Linked to Story 01 · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Chủ đề rất hay nối tiếp nhóm Person/Advice: hình mẫu nổi tiếng vs người gần gũi, áp lực chọn lựa của người trẻ.',
      questions: [
        {
          id: 'p3_yv_1',
          q: 'Who has a greater influence on young people today: parents or celebrities on social media?',
          qType: 'So sánh ảnh hưởng',
          formulaVi: 'P: Người nổi tiếng ảnh hưởng mạnh về xu hướng bề nổi, còn bố mẹ định hình giá trị cốt lõi → E: Giới trẻ dành hàng giờ xem KOL về thời trang, lối sống → E: Nhưng khi đứng trước bước ngoặt lớn (học hành, đạo đức), gia đình vẫn là điểm tựa sâu nhất → C: Ảnh hưởng mạng xã hội càng mạnh nếu bố mẹ thiếu kết nối với con.',
          chunks: ['surface-level trends', 'core moral values', 'curated online personas', 'in the long term'],
          modelEn: "I'd say it's split between short-term trends and long-term values. Online influencers clearly shape surface-level choices like fashion, slang, and consumer habits because teenagers see their curated personas every day. However, parents still play the decisive role in shaping core moral values, work ethic, and how young people treat others—provided families keep open communication rather than letting screens fill the gap."
        },
        {
          id: 'p3_yv_2',
          q: 'Why do many young adults find it difficult to make major life decisions?',
          qType: 'Nguyên nhân',
          formulaVi: 'P: Vì quá nhiều lựa chọn (paradox of choice) cộng thêm áp lực so sánh đồng trang lứa → E: Nhìn thấy thành công rực rỡ của người khác trên mạng dễ sợ chọn sai → E: Ví dụ chọn ngành đại học hay có nên đi làm xa nhà → C: Cố vấn từ người đi trước giúp thu hẹp bớt sự hoang mang.',
          chunks: ['paradox of choice', 'fear of making the wrong move', 'peer comparison', 'seek outside guidance'],
          modelEn: "Ironically, having far more options than previous generations can actually make big decisions harder—it's a classic paradox of choice. On top of that, social media fuels constant peer comparison, making young adults feel that choosing the wrong major or job will ruin their future. Seeking outside guidance from trusted mentors helps cut through that anxiety and reminds them that most career paths can be adjusted later."
        },
        {
          id: 'p3_yv_3',
          q: 'Do you think young people should learn from their own mistakes rather than always following advice?',
          qType: 'Đánh giá hai chiều',
          formulaVi: 'P: Cần kết hợp cả hai — nghe lời khuyên để tránh sai lầm chí mạng, tự trải nghiệm với sai lầm nhỏ → E: Tự vấp ngã nhớ sâu và rèn bản lĩnh hơn lời nhắc suông → E: Ví dụ tự quản lý tiền tiêu vặt vs lắng nghe tư vấn khi ký hợp đồng lớn → C: Sự kiên nhẫn của người lớn giúp biến sai lầm thành bài học.',
          chunks: ['learn the hard way', 'avoid costly pitfalls', 'build independent judgement', 'constructive feedback'],
          modelEn: "A healthy mix of both is ideal. Listening to experienced people helps young adults avoid costly pitfalls—like serious financial mistakes—without having to learn everything the hard way. At the same time, making smaller errors independently is essential for building genuine judgement and resilience. When parents or teachers respond with constructive feedback instead of harsh blame, mistakes become some of the best teachers."
        },
        {
          id: 'p3_yv_4',
          q: 'What makes someone a good role model for young people?',
          qType: 'Phân tích tiêu chí',
          formulaVi: 'P: Sự nhất quán giữa lời nói và việc làm (integrity), không phải sự hoàn hảo giả tạo → E: Người trẻ dễ nhận ra sự giả tạo và tôn trọng người dám nhận lỗi, sống tử tế → E: Một người thầy tận tâm hay người ông kiên nhẫn có sức ảnh hưởng bền hơn danh tiếng nhất thời → C: Khả năng vượt khó cũng truyền cảm hứng mạnh mẽ.',
          chunks: ['walk the talk', 'quiet integrity', 'own up to mistakes', 'lasting inspiration'],
          modelEn: "Above all, a strong role model needs quiet integrity—someone who genuinely walks the talk rather than putting on a flawless image for cameras. Young people quickly spot insincerity, whereas they deeply respect individuals who treat others kindly, work steadily through setbacks, and are humble enough to own up to mistakes. In that sense, an everyday parent, teacher, or grandparent can offer far more lasting inspiration than a famous celebrity."
        }
      ]
    },
    {
      id: 'sp_p3_money_consumer',
      part: 3,
      category: 'society',
      catLabel: 'Tài chính & Tiêu dùng',
      title: 'Money, Advertising & Consumer Habits',
      titleVi: 'Tiền bạc, Quảng cáo & Thói quen tiêu dùng',
      source: 'High-Frequency · 2026',
      targetSecMin: 40,
      targetSecMax: 65,
      summaryVi: 'Thảo luận mua sắm trực tuyến, tác động quảng cáo, chi tiêu không tiền mặt và giáo dục tài chính cho trẻ.',
      questions: [
        {
          id: 'p3_mc_1',
          q: 'How has online shopping changed people’s spending habits?',
          qType: 'Nguyên nhân – Hệ quả',
          formulaVi: 'P: Khiến việc mua sắm tiện vượt trội nhưng làm tăng vọt mua sắm bốc đồng → E: Thanh toán một chạm, mã giảm giá đếm ngược kích thích tâm lý sợ bỏ lỡ (FOMO) → E: Đặt hàng lúc nửa đêm rồi hôm sau mới nhận ra không cần thiết → C: Mặt tốt là dễ so sánh giá & đọc đánh giá trước khi mua.',
          chunks: ['impulse buying', 'one-click checkout', 'flash sales and vouchers', 'compare prices effortlessly'],
          modelEn: "Online shopping has made buying things almost frictionless, which has noticeably fuelled impulse buying. Features like one-click checkout, flash sales, and personalised recommendations make it very easy to purchase items late at night that we don't truly need. On the brighter side, e-commerce also empowers careful shoppers to compare prices effortlessly and read honest customer reviews before spending money on bigger items."
        },
        {
          id: 'p3_mc_2',
          q: 'Do you think advertising has too much influence on what people buy?',
          qType: 'Đánh giá',
          formulaVi: 'P: Rất mạnh, đặc biệt là quảng cáo ẩn (livestream, KOL review) → E: Ít ai nhận ra mình bị tác động vì quảng cáo đánh vào nỗi sợ lỗi thời hoặc mong muốn thuộc về nhóm → E: Sản phẩm bình thường cháy hàng chỉ sau 1 clip ngắn → C: Tuy vậy người tiêu dùng ngày càng tỉnh táo hơn nhờ review cộng đồng.',
          chunks: ['subtle persuasion', 'create artificial needs', 'influencer endorsements', 'more sceptical consumers'],
          modelEn: "Yes, often much more than we realise. Modern marketing relies heavily on subtle persuasion—like lifestyle branding and influencer endorsements—that taps into our desire to fit in and creates artificial needs. A perfectly ordinary product can sell out overnight after one viral clip. Encouragingly, though, consumers are becoming somewhat more sceptical and increasingly check independent reviews rather than taking ads at face value."
        },
        {
          id: 'p3_mc_3',
          q: 'Should children be taught how to manage money at school?',
          qType: 'Quan điểm · Giáo dục',
          formulaVi: 'P: Rất nên dạy sớm bằng bài học thực tiễn → E: Trẻ tiếp cận thanh toán điện tử sớm nhưng dễ mất cảm giác giá trị tiền thật → E: Dạy phân biệt "cần" và "muốn", tiết kiệm mục tiêu nhỏ → C: Gia đình cũng nên đồng hành cho trẻ thực hành tiền tiêu vặt.',
          chunks: ['financial literacy', 'needs versus wants', 'cashless payments', 'responsible spending habits'],
          modelEn: "Absolutely—basic financial literacy is one of the most useful life skills schools can teach. Because cashless payments make money feel almost invisible today, young people can easily overspend without realising how quickly small purchases add up. Simple lessons on distinguishing needs versus wants, budgeting, and saving for goals would set students up with responsible spending habits well before they earn their first salary."
        },
        {
          id: 'p3_mc_4',
          q: 'Why do some people prefer buying expensive branded products?',
          qType: 'Nguyên nhân',
          formulaVi: 'P: Hai động lực chính: bảo chứng chất lượng & tín hiệu địa vị xã hội → E: Với đồ công nghệ hay giày dép, hàng thương hiệu bền và bảo hành tốt hơn → E: Còn với túi xách/thời trang xa xỉ, nhiều người mua để thể hiện thành đạt → C: Xu hướng giới trẻ gần đây lại thích đồ tối giản, giá trị thực hơn là logo lớn.',
          chunks: ['a status symbol', 'perceived reliability', 'after-sales service', 'value for money'],
          modelEn: "There are usually two distinct motives behind buying big-name brands. For practical goods like electronics or running shoes, consumers are often paying for perceived reliability, durability, and trustworthy after-sales service. For luxury fashion, however, the appeal frequently acts as a status symbol that signals success or belonging. Interestingly, a growing number of younger buyers are pushing back against flashy logos and focusing more on genuine value for money."
        }
      ]
    }
  ];

  window.SPEAKING_PART13_DATA = {
    VERSION: '2026-11-28-p1p3-v1',
    PART1_TOPICS,
    PART3_TOPICS
  };
})();
