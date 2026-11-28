/* ==========================================================================
   TOTORO IELTS MASTER — PUBLIC IELTS WRITING TASK 2 EXAM PROMPTS (57 REAL PROMPTS)
   Contains ONLY authentic public IELTS Writing Task 2 exam questions (ZERO
   proprietary Flow Idea modules, paraphrases, or mindmaps).
   ========================================================================== */
(function () {
  'use strict';
  const PUBLIC_SUBTOPICS = [
  {
    "key": "st01",
    "shortTitle": "Work & Society",
    "title": "Work & Life Balance"
  },
  {
    "key": "st02",
    "shortTitle": "Careers & Edu",
    "title": "Careers & Education"
  },
  {
    "key": "st03",
    "shortTitle": "Tech & Modernity",
    "title": "Technology & Modern Society"
  }
];
  const PUBLIC_PROMPTS = [
  {
    "id": "wex_st01_01",
    "type": "Causes & Effects",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Many working people do not have enough free time off work to spend with their families and friends. Why? What are the effects on family life and society as a whole?",
    "review": "Phân tích rõ 2 nguyên nhân cốt lõi (chi phí sinh hoạt leo thang buộc phải làm thêm và cạnh tranh công sở ngầm); sau đó bóc tách hậu quả ở 2 cấp độ: làm rạn nứt gắn kết gia đình và gia tăng gánh nặng bệnh lý lên hệ thống y tế công cộng."
  },
  {
    "id": "wex_st01_02",
    "type": "Causes & Effects",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Many people are working longer hours. What are the reasons and effects?",
    "review": "Lý giải sự trỗi dậy của công nghệ liên lạc số kết hợp áp lực kinh tế sinh kế là thủ phạm chính; hậu quả dẫn đến nghịch lý suy giảm hiệu suất lao động cá nhân và quá tải bệnh viện công."
  },
  {
    "id": "wex_st01_03",
    "type": "Two-part Question",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "In some countries people spend long hours at work. Why does this happen? Is it a positive or negative development?",
    "review": "Khẳng định đây là xu hướng hoàn toàn tiêu cực vì lợi ích kinh tế ngắn hạn không thể bù đắp cho sự suy kiệt sức khỏe, suy giảm năng suất dài hạn và sự lỏng lẻo của cấu trúc gia đình."
  },
  {
    "id": "wex_st01_04",
    "type": "Discussion",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Some people think that hard work and long hours are the key to career success, while others believe that maintaining a work-life balance is more important. Discuss both views and give your opinion.",
    "review": "Thừa nhận nỗ lực làm việc là cần thiết trong giai đoạn khởi nghiệp, nhưng cân bằng công việc - đời sống mới là nền tảng cốt lõi để duy trì phong độ làm việc bền vững và tránh kiệt sức giữa đường."
  },
  {
    "id": "wex_st01_05",
    "type": "Problem & Solution",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "More and more people are struggling to balance their work and personal life. What problems does this cause? What measures should be taken to solve them?",
    "review": "Nêu rõ các vấn đề về sức khỏe tinh thần và rạn nứt hôn nhân; đề xuất can thiệp chính sách từ phía chính phủ (áp trần giờ làm) kết hợp tái cấu trúc văn hóa quản trị của doanh nghiệp (đánh giá theo kết quả)."
  },
  {
    "id": "wex_st01_06",
    "type": "Opinion",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Some governments are considering introducing a four-day working week instead of the traditional five-day week. Do the advantages of this policy outweigh its disadvantages?",
    "review": "Mặc dù ban đầu có thể phát sinh thách thức về tổ chức ca kíp, nhưng lợi ích về phục hồi năng suất, tiết kiệm chi phí y tế và gia tăng gắn kết xã hội vượt trội hơn hẳn."
  },
  {
    "id": "wex_st01_07",
    "type": "Opinion",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Employers should be legally required to limit the number of hours their employees work each week. To what extent do you agree or disagree?",
    "review": "Sự can thiệp bằng chế tài luật pháp là giải pháp tối cần thiết vì cơ chế thị trường tự do thường đẩy người lao động vào thế yếu, buộc phải tăng ca không kiểm soát."
  },
  {
    "id": "wex_st01_08",
    "type": "Causes & Effects",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "In modern society, many parents spend less time with their children because of work commitments. What are the causes and consequences of this trend?",
    "review": "Nguyên nhân xuất phát từ áp lực sinh kế đô thị và công nghệ kết nối liên tục; hậu quả ảnh hưởng sâu sắc đến sự phát triển nhận thức, hành vi và sức khỏe tâm lý của thế hệ trẻ."
  },
  {
    "id": "wex_st01_09",
    "type": "Opinion",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "With the increase in mobile phones and laptops, employees are expected to be available outside normal working hours. Is this a positive or negative development?",
    "review": "Mặc dù mang lại sự linh hoạt xử lý việc khẩn cấp, nhưng việc kỳ vọng sẵn sàng 24/7 bào mòn sự bình yên tâm lý và phá hủy ranh giới đời sống riêng tư."
  },
  {
    "id": "wex_st01_10",
    "type": "Discussion & Opinion",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Some people think that having more free time is more important than having a high salary. Discuss both views and give your opinion.",
    "review": "Cần tiền ở mức độ bảo đảm nhu cầu cơ bản, nhưng khi đã qua ngưỡng an toàn tài chính, thời gian tự do có giá trị cao hơn nhiều vì nó đem lại sức khỏe và hạnh phúc đích thực."
  },
  {
    "id": "wex_st01_11",
    "type": "Problem & Solution",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Stress in the workplace is becoming a major problem in many countries. What are the causes of workplace stress and what can be done to reduce it?",
    "review": "Nguyên nhân cốt lõi là làm việc quá tải, thời hạn gấp rút (tight deadlines) và văn hóa trừng phạt; giải pháp đòi hỏi tái cấu trúc khối lượng công việc và xây dựng môi trường an toàn tâm lý."
  },
  {
    "id": "wex_st01_12",
    "type": "Two-part Question",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "Nowadays, many people find it difficult to maintain a healthy lifestyle because of work pressure. Why is this? How can this issue be resolved?",
    "review": "Phân tích cơ chế thiếu thời gian nấu nướng và tập thể dục do tăng ca; đề xuất giải pháp doanh nghiệp hỗ trợ bữa ăn dinh dưỡng và rút ngắn thời gian làm việc."
  },
  {
    "id": "wex_st01_13",
    "type": "Opinion",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "The responsibility for ensuring workers have a healthy work-life balance lies entirely with individual employees, not their employers. To what extent do you agree or disagree?",
    "review": "Cá nhân có trách nhiệm quản lý thời gian, nhưng doanh nghiệp giữ đòn bẩy quyền lực quyết định về khối lượng công việc, kỳ vọng chỉ tiêu và văn hóa công sở; nếu người quản lý không thay đổi, cá nhân không thể tự cân bằng."
  },
  {
    "id": "wex_st01_14",
    "type": "Two-part Question",
    "subtopic": "st01",
    "topicLabel": "Work & Life Balance",
    "prompt": "In many countries, governments and companies are experimenting with reduced working hours. What benefits does this offer to employees and employers? Are there any drawbacks?",
    "review": "Lợi ích đa chiều (nhân viên khỏe mạnh hạnh phúc hơn, doanh nghiệp thu hút nhân tài và giảm tỷ lệ nghỉ ốm); thách thức chỉ mang tính kỹ thuật điều phối ngắn hạn."
  },
  {
    "id": "wex_st02_01",
    "type": "Agree / Disagree",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "There are several factors that motivate people to stay in the workforce, and money is the most important factor. To what extent do you agree or disagree?",
    "review": "Thừa nhận thu nhập là điều kiện tiên quyết bảo đảm sinh kế ban đầu, nhưng không đồng ý rằng tiền là yếu tố \"quan trọng nhất\". Sau khi đã đạt mức an toàn tài chính, các yếu tố phi vật chất (động lực nội tại, ý nghĩa công việc và môi trường được tôn trọng) mới là động lực quyết định để nhân sự gắn bó lâu dài."
  },
  {
    "id": "wex_st02_02",
    "type": "Agree / Disagree",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Some people say that the only reason for working hard is to earn money. To what extent do you agree or disagree?",
    "review": "Bác bỏ từ tuyệt đối \"the only reason\": Thu nhập là động cơ quan trọng nhưng hoàn toàn không phải lý do duy nhất thúc đẩy con người làm việc chăm chỉ."
  },
  {
    "id": "wex_st02_03",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Some people believe that job satisfaction is more important than job security. Others think that people cannot always expect to enjoy their jobs. Discuss both views and give your opinion.",
    "review": "Thừa nhận an toàn việc làm là cần thiết để ứng phó với bất ổn kinh tế trước mắt, nhưng sự thỏa mãn nghề nghiệp mới là chìa khóa bảo vệ sức khỏe tâm thần và duy trì sự nghiệp bền vững suốt đời."
  },
  {
    "id": "wex_st02_04",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Some people think that a high salary is the most important feature of a job, while other people think that good relations with colleagues are more important. Discuss both views and give your opinion.",
    "review": "Lương cao giải quyết vấn đề vật chất, nhưng đồng nghiệp gắn kết mới bảo đảm chất lượng cuộc sống hằng ngày vì phần lớn thời gian thức của đời người là ở nơi làm việc."
  },
  {
    "id": "wex_st02_05",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Some people think that people who choose a career should stay in the same job for the rest of their lives. Others believe that people should change their jobs regularly. Discuss both views and give your opinion.",
    "review": "Gắn bó trọn đời không còn phù hợp với nền kinh tế hiện đại; thay đổi công việc sau mỗi vài năm giúp nhân sự liên tục thích ứng và phát triển tối đa tiềm năng."
  },
  {
    "id": "wex_st02_06",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Many people think that it is better to stay in the same job for their whole life, while others think it is better to change jobs frequently. Discuss both views and give your opinion.",
    "review": "Không nên tuyệt đối hóa một lựa chọn; người lao động nên áp dụng chiến lược linh hoạt: nhảy việc cọ xát ở giai đoạn đầu và gắn bó trung thành ở giai đoạn trưởng thành."
  },
  {
    "id": "wex_st02_07",
    "type": "Causes & Evaluation",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "In many countries, people are now changing their jobs and careers frequently throughout their working life. Why is this? Is it a positive or negative development?",
    "review": "Chủ yếu tích cực đối với sự phát triển năng lực cá nhân, dù đặt ra thách thức chi phí tuyển dụng cho doanh nghiệp."
  },
  {
    "id": "wex_st02_08",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Directors of large organizations earn much higher salaries than ordinary employees do. Some people believe it is necessary, but others think that it is unfair. Discuss both these views and give your own opinions.",
    "review": "Thừa nhận vai trò lãnh đạo xứng đáng hưởng thù lao cao, nhưng mức chênh lệch hàng trăm lần là phi lý và tàn phá nhuệ khí tổ chức."
  },
  {
    "id": "wex_st02_09",
    "type": "Causes & Evaluation",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Nowadays, an increasing number of people are deciding to leave high-paying corporate jobs to pursue careers in artistic, social, or non-profit sectors. Why is this? Is it a positive or negative trend?",
    "review": "Chủ yếu tích cực: Thể hiện sự tiến bộ trong nhận thức khi con người ưu tiên giá trị tinh thần và đóng góp cộng đồng hơn sự tích lũy của cải đơn thuần, dù đòi hỏi cá nhân phải chuẩn bị tài chính để thích ứng với mức thu nhập khiêm tốn hơn."
  },
  {
    "id": "wex_st02_10",
    "type": "Advantages or Disadvantages",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Many school leavers prefer to start their professional careers immediately rather than going to university. Do the advantages of this choice outweigh the disadvantages?",
    "review": "Nhược điểm dài hạn áp đảo: Thu nhập sớm không thể bù đắp được việc bị giới hạn cơ hội thăng tiến do thiếu bằng cấp chuyên môn."
  },
  {
    "id": "wex_st02_11",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Some people think that employees should prioritize career progression and rapid promotion above all else, while others value having stable, predictable daily routines. Discuss both views and give your opinion.",
    "review": "Theo đuổi thăng tiến bằng mọi giá dễ dẫn tới kiệt sức; sự ổn định giúp duy trì sức khỏe và hạnh phúc gia đình bền vững."
  },
  {
    "id": "wex_st02_12",
    "type": "Causes & Solutions",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "In many organizations, young employees tend to leave after only one or two years. What are the reasons for this high turnover rate, and how can employers retain talent?",
    "review": "Nguyên nhân xuất phát từ cả yếu tố thu nhập lẫn cơ hội phát triển; giải pháp phải kết hợp giữa đãi ngộ theo thị trường và xây dựng lộ trình thăng tiến rõ ràng."
  },
  {
    "id": "wex_st02_13",
    "type": "Discuss both views",
    "subtopic": "st02",
    "topicLabel": "Careers & Education",
    "prompt": "Some people say that individuals who make a lot of money are most successful. Others think that those who contribute to society like scientists and teachers are most successful. Discuss both views and give your opinion.",
    "review": "Tiền tài và địa vị chỉ là phương tiện bảo đảm an toàn sinh kế, giá trị nhân văn và sự an yên nội tâm mới là thước đo đích thực của một cuộc đời thành công."
  },
  {
    "id": "wex_st03_01",
    "type": "Advantages / Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Many people now work remotely rather than in traditional office environments. What are the advantages and disadvantages of this trend?",
    "review": "Body 1: Lesson 3.1 (tiết kiệm đi lại, linh hoạt) · Body 2: Lesson 3.2 + Lesson 3.5 (thiếu giao tiếp trực tiếp & làm quá giờ)."
  },
  {
    "id": "wex_st03_02",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Many employees can now do their work from home using modern technology. However, this change may only benefit workers, not employers. To what extent do you agree or disagree?",
    "review": "Body 1: Lesson 3.1 (lợi ích cho nhân viên) · Body 2: Lesson 3.1 + Lesson 3.2 (công ty tiết kiệm mặt bằng, tuyển rộng nhưng cần mô hình kết hợp để giữ gắn kết)."
  },
  {
    "id": "wex_st03_03",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Research shows that business meetings, discussions and training are happening online nowadays. Do the advantages outweigh the disadvantages?",
    "review": "Body 1: Lesson 3.2 (khó hướng dẫn người mới, dễ hiểu nhầm) · Body 2: Lesson 3.1 (tiết kiệm chi phí đi công tác, phòng họp & phối hợp từ xa)."
  },
  {
    "id": "wex_st03_04",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In many workplaces, online communication is becoming more common than face to face interaction. Do the advantages of this development outweigh the disadvantages?",
    "review": "Body 1: Lesson 3.1 (trao đổi nhanh, vượt khoảng cách) · Body 2: Lesson 3.2 (mất biểu cảm trực tiếp, giảm tinh thần đồng đội)."
  },
  {
    "id": "wex_st03_05",
    "type": "Positive / Negative",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In the modern era, an increasing number of people perform daily activities such as working, communicating, and shopping online. Is this a positive or negative development?",
    "review": "Body 1: Lesson 3.1 (tiện lợi, tiết kiệm thời gian đi lại) · Body 2: Lesson 3.2 + Nhánh 3 (cô lập giao tiếp thật & rủi ro rò rỉ dữ liệu)."
  },
  {
    "id": "wex_st03_06",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Internet access helps young people and workers achieve their education and work goals more easily than before. To what extent do you agree or disagree?",
    "review": "Body 1: Lesson 3.1 + Nhánh 2 (tiếp cận tri thức, việc làm từ xa nhanh rẻ) · Body 2: Lesson 3.2 + Nhánh 2 (dễ xao nhãng, thiếu kèm cặp trực tiếp)."
  },
  {
    "id": "wex_st03_07",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Developments in technology mean that more and more machines are being used in the workplace instead of human employees. Does this development have more advantages or more disadvantages?",
    "review": "Body 1 & Body 2: Lesson 3.3 (tăng năng suất, giảm việc nguy hiểm vs. mất việc nhóm lặp lại)."
  },
  {
    "id": "wex_st03_08",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Artificial intelligence will eventually replace most human workers. Do the advantages of this development outweigh the disadvantages?",
    "review": "Body 1: Lesson 3.3 (tự động hóa việc nặng & giấy tờ lặp lại) · Body 2: Lesson 3.3 + Lesson 3.4 (nguy cơ thất nghiệp cơ cấu nhưng AI không thay được thấu cảm, sáng tạo và giao tiếp)."
  },
  {
    "id": "wex_st03_09",
    "type": "Discuss both views",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Some believe that robots play a crucial role in shaping humanity's future, whereas others argue that they pose risks and could harm society. Consider both arguments and present your viewpoint.",
    "review": "Body 1: Lesson 3.3 (thay việc nguy hiểm, tăng sản lượng) · Body 2: Lesson 3.3 + Lesson 3.4 (mất việc phổ thông nếu thiếu đào tạo lại, con người vẫn giữ vai trò sáng tạo/kiểm soát)."
  },
  {
    "id": "wex_st03_10",
    "type": "Discuss both views",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Scientists believe that computers will become more intelligent than human beings. Some people find it is positive while others think it is a negative development. Discuss both views and give your own opinion.",
    "review": "Body 1: Lesson 3.3 (xử lý dữ liệu lớn, hỗ trợ y tế & sản xuất) · Body 2: Lesson 3.3 + Lesson 3.4 (rủi ro mất việc nhưng máy không có cảm xúc, đạo đức và trải nghiệm sống)."
  },
  {
    "id": "wex_st03_11",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "With the rapid development of generative AI tools, some people believe that human creativity in fields like writing and art will decline. To what extent do you agree or disagree?",
    "review": "Body 1: Lesson 3.4 (người học dễ ỷ lại bản tạo nhanh) · Body 2: Lesson 3.4 (AI chỉ ghép mẫu cũ, nghệ thuật thật vẫn dựa vào trải nghiệm sống và cảm xúc con người)."
  },
  {
    "id": "wex_st03_12",
    "type": "Two-part Question",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In today’s world of advanced science and technology, we still greatly value our artists such as musicians, painters, and writers. What can the arts tell us about life that science and technology cannot?",
    "review": "Lesson 3.4 (khoa học/công nghệ đo lường và tối ưu kỹ thuật; nghệ thuật phản ánh ký ức, cảm xúc sâu sắc và bản sắc văn hóa)."
  },
  {
    "id": "wex_st03_13",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "If you want to be successful at work, you should have high-level computer skills. Do you agree or disagree?",
    "review": "Body 1 & Body 2: Lesson 3.4 (kỹ năng máy tính giúp làm nhanh nhưng phần mềm nhanh lỗi thời; giao tiếp, đàm phán, lãnh đạo mới tạo thành công lâu dài)."
  },
  {
    "id": "wex_st03_14",
    "type": "Causes & Solutions",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "The world of work is rapidly changing and employees cannot depend on having the same job or the same working conditions for life. Why is this the case? Can you suggest some ways to prepare people to work in the future?",
    "review": "Body 1 (Nguyên nhân): Lesson 3.3 + Lesson 3.6 (AI tự động hóa và xu hướng làm tự do/hợp đồng) · Body 2 (Cách chuẩn bị): Lesson 3.4 (học suốt đời, kết hợp kỹ năng máy tính và kỹ năng mềm)."
  },
  {
    "id": "wex_st03_15",
    "type": "Positive / Negative",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Anybody can use a mobile phone to answer the work and personal calls at any time or 7 days a week. Does this development have more positive or negative effects on both individuals and society?",
    "review": "Body 1: Lesson 3.5 (xử lý việc gấp, xuyên múi giờ) · Body 2: Lesson 3.5 + Nhánh 1 (mất ranh giới nghỉ ngơi, rối loạn giấc ngủ, xa cách gia đình)."
  },
  {
    "id": "wex_st03_16",
    "type": "Discuss both views",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Some people think that new technology always improves the lives of workers. Other people believe that it results in disadvantages for workers. Discuss both opinions and give your own opinion.",
    "review": "Body 1: Lesson 3.1 + Lesson 3.3 (linh hoạt giờ giấc, giảm việc nặng nhọc) · Body 2: Lesson 3.3 + Lesson 3.5 (mất việc lặp lại, căng thẳng trực tuyến 24/7)."
  },
  {
    "id": "wex_st03_17",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Some people think that the development of technology has made our lives more complicated. To what extent do you agree or disagree?",
    "review": "Body 1: Lesson 3.1 (đơn giản hóa thanh toán, làm việc, liên lạc) · Body 2: Lesson 3.5 + Nhánh 3 (quá tải thông báo công việc, mất riêng tư và rò rỉ dữ liệu)."
  },
  {
    "id": "wex_st03_18",
    "type": "Two-part Question",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Nowadays, many people choose to be self-employed, rather than to work for a company or organisation. Why might this be the case? What could be the disadvantages of being self-employed?",
    "review": "Body 1 (Lý do): Lesson 3.1 + Lesson 3.6 (công nghệ hỗ trợ làm độc lập, chủ động giờ giấc) · Body 2 (Bất lợi): Lesson 3.6 + Lesson 3.2 (thu nhập bấp bênh, tự lo bảo hiểm/nghỉ ốm, cô lập thiếu đồng nghiệp)."
  },
  {
    "id": "wex_st03_19",
    "type": "Positive / Negative",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Some universities offer online courses as an alternative to classes delivered on campus. Do you think this is a positive or negative development?",
    "review": "Phân tích cân bằng: học trực tuyến giúp linh hoạt địa lý & tiết kiệm chi phí, nhưng thiếu tương tác trực tiếp, thực hành phòng lab và kỷ luật học tập."
  },
  {
    "id": "wex_st03_20",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In the modern world, schools are no longer necessary because there is so much information available through the internet that children can study just as well at home. To what extent do you agree or disagree?",
    "review": "Phản biện sắc bén: Internet chỉ cung cấp thông tin thô; trường học vẫn không thể thay thế nhờ lộ trình sư phạm có kiểm chứng, tương tác xã hội và rèn tư duy phản biện."
  },
  {
    "id": "wex_st03_21",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In many countries, schools are using computers and tablets instead of printed textbooks. Do the advantages of this trend outweigh the disadvantages?",
    "review": "Đối chiếu thiết bị số vs sách in trong trường học: ưu thế cập nhật kiến thức, đa phương tiện và giảm giấy, nhưng kéo theo mỏi mắt, xao nhãng và khoảng cách số."
  },
  {
    "id": "wex_st03_22",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Nations should spend more money on skills and vocational training for practical work, rather than on university education. To what extent do you agree or disagree?",
    "review": "Cân bằng đào tạo nghề vs đại học: đầu tư nghề giải quyết thiếu hụt nhân lực kỹ thuật và việc làm nhanh, nhưng giáo dục đại học vẫn cốt lõi cho R&D và đổi mới công nghệ."
  },
  {
    "id": "wex_st03_23",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Today more and more people are using mobile phones and computers. Thus, people are losing the ability to communicate face to face. To what extent do you agree or disagree?",
    "review": "Đánh giá tác động điện thoại/máy tính tới kỹ năng giao tiếp: làm giảm tương tác mặt đối mặt và ngôn ngữ cơ thể, nhưng lại mở rộng kết nối xuyên biên giới."
  },
  {
    "id": "wex_st03_24",
    "type": "Causes & Effects",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In many countries, family members do not spend as much time together as they used to. What are the causes of this? What are the effects on family life?",
    "review": "Chủ đề Causes & Effects quen thuộc: áp lực tăng ca kết hợp thiết bị màn hình riêng kéo các thành viên xa nhau, làm suy yếu sự thấu hiểu và gắn kết gia đình."
  },
  {
    "id": "wex_st03_25",
    "type": "Discuss both views",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Some people think that spending too much time on smartphones and tablets is harmful to children. Others think these devices have educational benefits. Discuss both views.",
    "review": "Thảo luận 2 chiều về trẻ em dùng smartphone/tablet: rèn kỹ năng số & học qua app tương tác vs nguy cơ thụ động, giảm vận động và lệch nhịp giấc ngủ."
  },
  {
    "id": "wex_st03_26",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "With the rapid advancement of communication technology: smartphones, tablets and other mobile devices, some people believe that the disadvantages outweigh the advantages. To what extent do you agree or disagree?",
    "review": "Đánh giá lợi/hại của công nghệ liên lạc di động trong đời sống & công việc: tăng tốc độ phối hợp & làm việc linh hoạt vs văn hóa \"always-on\" xóa nhòa ranh giới riêng tư."
  },
  {
    "id": "wex_st03_27",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "In this technological era, personal information is held on computers by many companies and organizations. Do you think the advantages outweigh the disadvantages?",
    "review": "So sánh tiện ích lưu trữ dữ liệu số vs rủi ro bảo mật: dịch vụ cá nhân hóa, xử lý hồ sơ nhanh vs nguy cơ rò rỉ dữ liệu, đánh cắp danh tính và lừa đảo mạng."
  },
  {
    "id": "wex_st03_28",
    "type": "Discuss both views",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Some people think technology development decreases crime while others believe it actually encourages crime. Discuss both views and give your own opinion.",
    "review": "Tranh luận 2 chiều về Công nghệ & Tội phạm: camera AI, truy vết số giúp phá án nhanh vs tội phạm mạng xuyên biên giới, lừa đảo tinh vi ngày càng khó kiểm soát."
  },
  {
    "id": "wex_st03_29",
    "type": "Advantages outweigh Disadvantages",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "As transport and accommodation problems are increasing in many cities, some governments are encouraging businesses to move to rural areas. Do you think the advantages outweigh the disadvantages?",
    "review": "Đánh giá chính sách giãn doanh nghiệp ra vùng ven: giảm ùn tắc, hạ giá thuê mặt bằng/nhà ở và phát triển kinh tế địa phương vs bất tiện hạ tầng & khó tuyển nhân sự cấp cao."
  },
  {
    "id": "wex_st03_30",
    "type": "Agree / Disagree",
    "subtopic": "st03",
    "topicLabel": "Technology & Modern Society",
    "prompt": "Traffic congestion is becoming a serious issue in many metropolitan areas. Some people suggest that moving businesses and factories to suburban or rural areas is the only effective solution. To what extent do you agree or disagree?",
    "review": "Bàn luận giải pháp làm việc/học tập từ xa để giảm kẹt xe: giảm đáng kể lưu lượng giờ cao điểm nhờ hạ tầng số, nhưng không áp dụng được cho mọi ngành nghề nên cần kết hợp giao thông công cộng."
  }
];

  window.WRITING_PUBLIC_DATA = Object.freeze({
    VERSION: '20261128-public-t2',
    SUBTOPICS: PUBLIC_SUBTOPICS,
    MODULES: [],
    PARAPHRASES: [],
    PRACTICE_PROMPTS: PUBLIC_PROMPTS
  });

  if (!window.WRITING_STUDIO_DATA) {
    window.WRITING_STUDIO_DATA = {
      VERSION: '20261128-public-t2',
      SUBTOPICS: PUBLIC_SUBTOPICS,
      MODULES: [],
      PARAPHRASES: [],
      PRACTICE_PROMPTS: PUBLIC_PROMPTS
    };
  }
})();
