/* ==========================================================================
   TOTORO IELTS MASTER — IELTS WRITING TASK 1 (ACADEMIC) DATA BANK
   6 Classic Academic Visual Types (Cambridge Calibrated, 100% Offline SVG):
   1. Line Graph     2. Bar Chart      3. Pie Charts (2-period)
   4. Table          5. Process        6. Map Comparison (Before / After)
   ========================================================================== */
(function () {
  'use strict';

  const TASK1_PROMPTS = [
    {
      id: 'wt1_line_energy',
      taskPart: 1,
      chartType: 'line',
      type: 'Line Graph',
      topic: 'Energy & Environment',
      difficulty: 'Band 6.5–8.0',
      timeMins: 20,
      minWords: 150,
      title: 'Renewable Electricity Share in Four Countries (2000–2025)',
      prompt: 'The line graph below shows the percentage of electricity generated from renewable sources in four countries between 2000 and 2025.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Luyện mô tả xu hướng tăng mạnh (soar, overtake), so sánh điểm giao cắt giữa Đức và Đan Mạch và giữ mạch Overview không đưa số liệu chi tiết.',
      overviewChecklist: [
        'Cả 4 quốc gia đều tăng tỷ trọng điện tái tạo giai đoạn 2000–2025',
        'Đan Mạch dẫn đầu xuyên suốt và vượt mốc 80% vào năm 2025',
        'Đức tăng tốc mạnh nhất từ 2010 trở đi và vượt Tây Ban Nha vào 2020'
      ],
      keyVocab: [
        'generated from renewable sources',
        'experienced a dramatic surge',
        'overtook ... in 2020',
        'remained the frontrunner throughout',
        'a steady upward trajectory',
        'accounted for over four-fifths'
      ],
      modelOverview: 'Overall, the share of renewable electricity rose substantially across all four nations over the 25-year period. Denmark consistently maintained the highest proportion, while Germany recorded the sharpest growth rate, overtaking Spain by 2020.',
      chartData: {
        unit: '%',
        yMax: 100,
        yStep: 20,
        labels: ['2000', '2005', '2010', '2015', '2020', '2025'],
        series: [
          { name: 'Denmark', color: '#2F663D', values: [22, 31, 43, 58, 74, 84] },
          { name: 'Germany', color: '#2B6496', values: [7, 11, 18, 32, 49, 61] },
          { name: 'Spain', color: '#B86A28', values: [16, 19, 28, 36, 44, 53] },
          { name: 'Japan', color: '#7D4E8A', values: [9, 10, 12, 16, 22, 29] }
        ]
      }
    },
    {
      id: 'wt1_bar_commute',
      taskPart: 1,
      chartType: 'bar',
      type: 'Bar Chart',
      topic: 'Transport & Cities',
      difficulty: 'Band 6.0–7.5',
      timeMins: 20,
      minWords: 150,
      title: 'Primary Commuting Modes in Five Metropolitan Cities (2024)',
      prompt: 'The bar chart below compares the percentage of daily commuters using public transport, private cars, and cycling/walking in five major cities in 2024.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Dạng Static Bar Chart (không có trục thời gian) — tập trung so sánh nhóm (grouping), tỷ lệ cao nhất/thấp nhất và đối lập giữa Tokyo, Amsterdam và Houston.',
      overviewChecklist: [
        'Giao thông công cộng áp đảo ở Tokyo (62%) và London (48%)',
        'Ô tô cá nhân thống trị tuyệt đối ở Houston (78%)',
        'Amsterdam nổi bật với tỷ lệ đi xe đạp / đi bộ cao nhất (44%)'
      ],
      keyVocab: [
        'relied predominantly on',
        'by a wide margin',
        'in stark contrast to',
        'the least preferred mode of commuting',
        'nearly four-fifths of commuters',
        'active travel (cycling and walking)'
      ],
      modelOverview: 'Overall, commuting patterns varied markedly across the five cities. Public transit dominated in Tokyo and London, whereas private cars were overwhelmingly favoured in Houston, and Amsterdam stood out for its exceptionally high rate of cycling and walking.',
      chartData: {
        unit: '%',
        yMax: 80,
        yStep: 20,
        categories: ['Tokyo', 'London', 'Singapore', 'Amsterdam', 'Houston'],
        series: [
          { name: 'Public Transport', color: '#2F663D', values: [62, 48, 56, 29, 12] },
          { name: 'Private Car', color: '#B86A28', values: [18, 32, 27, 27, 78] },
          { name: 'Cycling / Walking', color: '#2B6496', values: [20, 20, 17, 44, 10] }
        ]
      }
    },
    {
      id: 'wt1_pie_budget',
      taskPart: 1,
      chartType: 'pie',
      type: 'Pie Charts',
      topic: 'Economy & Lifestyle',
      difficulty: 'Band 6.5–7.5',
      timeMins: 20,
      minWords: 150,
      title: 'Average Urban Household Spending in 1995 and 2025',
      prompt: 'The two pie charts below show the proportion of average monthly household expenditure across six categories in a European country in 1995 and 2025.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Biểu đồ tròn 2 mốc thời gian — nhấn mạnh sự dịch chuyển chi tiêu từ Thực phẩm sang Nhà ở và Y tế/Công nghệ.',
      overviewChecklist: [
        'Nhà ở (Housing) tăng mạnh và trở thành khoản chi lớn nhất năm 2025 (34%)',
        'Tỷ trọng chi cho Thực phẩm (Food) giảm rõ rệt từ 31% xuống 18%',
        'Công nghệ & Giáo dục tăng gấp đôi (6% → 13%)'
      ],
      keyVocab: [
        'made up the largest share of spending',
        'more than doubled over the 30-year span',
        'shrank considerably from ... to ...',
        'remained virtually unchanged',
        'represented just over a third',
        'allocated to housing and utilities'
      ],
      modelOverview: 'Overall, household budgets shifted away from food towards housing, healthcare, and technology between 1995 and 2025. While food was the single largest expense in 1995, housing overtook it by a considerable margin thirty years later.',
      chartData: {
        pies: [
          {
            title: '1995',
            slices: [
              { label: 'Housing', value: 24, color: '#2F663D' },
              { label: 'Food', value: 31, color: '#B86A28' },
              { label: 'Transport', value: 16, color: '#2B6496' },
              { label: 'Leisure', value: 14, color: '#7D4E8A' },
              { label: 'Healthcare', value: 9, color: '#B84B5A' },
              { label: 'Tech & Edu', value: 6, color: '#587872' }
            ]
          },
          {
            title: '2025',
            slices: [
              { label: 'Housing', value: 34, color: '#2F663D' },
              { label: 'Food', value: 18, color: '#B86A28' },
              { label: 'Transport', value: 13, color: '#2B6496' },
              { label: 'Leisure', value: 9, color: '#7D4E8A' },
              { label: 'Healthcare', value: 13, color: '#B84B5A' },
              { label: 'Tech & Edu', value: 13, color: '#587872' }
            ]
          }
        ]
      }
    },
    {
      id: 'wt1_table_grad',
      taskPart: 1,
      chartType: 'table',
      type: 'Table',
      topic: 'Education & Work',
      difficulty: 'Band 7.0–8.0',
      timeMins: 20,
      minWords: 150,
      title: 'University Graduate Employment & Starting Salaries by Field (2024)',
      prompt: 'The table below gives information about employment rates within six months of graduation, median starting salaries, and further study rates across five university disciplines in 2024.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Bảng số liệu nhiều cột — chọn lọc điểm cực trị (max/min), tránh liệt kê máy móc từng hàng một.',
      overviewChecklist: [
        'Y khoa (Medicine) dẫn đầu cả tỷ lệ có việc (96%) lẫn lương khởi điểm ($54,000)',
        'Kỹ thuật & Công nghệ (Engineering & IT) đứng thứ hai với lương $49,500',
        'Nhân văn (Humanities) có tỷ lệ học tiếp cao nhất (24%) nhưng tỷ lệ đi làm ngay thấp nhất (71%)'
      ],
      keyVocab: [
        'secured employment within six months',
        'commanded the highest median starting salary',
        'opted for postgraduate study',
        'lagged behind other disciplines',
        'comparable employment prospects',
        'a noticeable disparity between ... and ...'
      ],
      modelOverview: 'Overall, vocational fields such as Medicine and Engineering & IT achieved the highest employment rates and starting salaries, whereas Humanities graduates were far more likely to pursue further study and earned the lowest initial pay.',
      chartData: {
        headers: ['Discipline', 'Employed (6 mos)', 'Median Salary (USD)', 'Further Study', 'Unemployed'],
        rows: [
          ['Medicine & Health', '96%', '$54,000', '3%', '1%'],
          ['Engineering & IT', '91%', '$49,500', '5%', '4%'],
          ['Business & Finance', '84%', '$42,000', '8%', '8%'],
          ['Natural Sciences', '78%', '$39,200', '16%', '6%'],
          ['Arts & Humanities', '71%', '$31,500', '24%', '5%']
        ]
      }
    },
    {
      id: 'wt1_process_glass',
      taskPart: 1,
      chartType: 'process',
      type: 'Process Diagram',
      topic: 'Manufacturing & Sustainability',
      difficulty: 'Band 6.5–8.0',
      timeMins: 20,
      minWords: 150,
      title: 'The Closed-Loop Glass Bottle Recycling Process',
      prompt: 'The diagram below illustrates the stages involved in collecting, processing, and recycling used glass bottles into new containers.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Dạng Process (quy trình nhân tạo) — bắt buộc dùng thể Bị động (Present Simple Passive) và từ nối tuần tự (Initially, Subsequently, Once crushed...).',
      overviewChecklist: [
        'Quy trình khép kín gồm 6 công đoạn chính từ thu gom chai cũ đến phân phối chai mới',
        'Chia làm 2 giai đoạn lớn: thu gom & làm sạch (bước 1–3) và nung chảy & tạo hình (bước 4–6)'
      ],
      keyVocab: [
        'a six-stage closed-loop cycle',
        'sorted by colour (clear, green, brown)',
        'washed with high-pressure water',
        'crushed into fine pieces (cullet)',
        'melted in a furnace at 1,500°C',
        'moulded into new bottles and distributed'
      ],
      modelOverview: 'Overall, glass recycling is a continuous six-stage industrial process that begins with the collection of used bottles and ends with newly moulded containers being refilled and returned to supermarkets.',
      chartData: {
        cycleNote: 'Closed-loop cycle · Continuous reuse',
        steps: [
          { num: 1, title: 'Collection', detail: 'Used bottles gathered from recycling bins' },
          { num: 2, title: 'Cleaning', detail: 'High-pressure water wash removes labels & residue' },
          { num: 3, title: 'Sorting', detail: 'Separated by colour: clear, green, and brown' },
          { num: 4, title: 'Crushing', detail: 'Crushed into fine glass fragments (cullet)' },
          { num: 5, title: 'Melting', detail: 'Heated in furnace at 1,500°C into molten glass' },
          { num: 6, title: 'Moulding', detail: 'Shaped into new bottles, refilled & delivered' }
        ]
      }
    },
    {
      id: 'wt1_map_harbour',
      taskPart: 1,
      chartType: 'map',
      type: 'Map Comparison',
      topic: 'Urban Development',
      difficulty: 'Band 7.0–8.5',
      timeMins: 20,
      minWords: 150,
      title: 'Redevelopment of Westbridge Harbour (2005 vs Present)',
      prompt: 'The two maps below show the layout of Westbridge Harbour in 2005 and how it has been redeveloped today.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Dạng Map 2 thời điểm (Quá khứ vs Hiện tại) — dùng Present Perfect Passive (has been converted into, was demolished to make way for) và phương hướng Bắc–Nam–Đông–Tây.',
      overviewChecklist: [
        'Cảng công nghiệp cũ (nhà kho, bến tàu cá) đã chuyển đổi thành khu du lịch – thương mại ven biển',
        'Đường ven biển được chuyển thành phố đi bộ; mở rộng bến du thuyền và khách sạn phía Tây',
        'Ngọn hải đăng ở góc Đông Bắc và đường chính phía Nam vẫn được giữ nguyên'
      ],
      keyVocab: [
        'underwent a complete transformation',
        'demolished to make way for',
        'converted into a waterfront café district',
        'pedestrianised promenade',
        'remained untouched in the north-east',
        'expanded along the western shoreline'
      ],
      modelOverview: 'Overall, Westbridge Harbour has undergone a major transformation from a working industrial fishing port in 2005 into a modern leisure and tourism waterfront, while retaining its historic lighthouse and southern access road.',
      chartData: {
        beforeYear: '2005',
        afterYear: 'Present',
        beforeZones: [
          { x: 14, y: 18, w: 72, h: 36, label: 'Fishing Pier', fill: '#D5E1EB', stroke: '#5C7A94' },
          { x: 96, y: 18, w: 68, h: 36, label: 'Cargo Dock', fill: '#E2DDD1', stroke: '#8A8170' },
          { x: 174, y: 18, w: 50, h: 36, label: 'Lighthouse', fill: '#E8E3D0', stroke: '#6E6650' },
          { x: 14, y: 66, w: 88, h: 42, label: 'Old Warehouses', fill: '#DFD4C4', stroke: '#877660' },
          { x: 112, y: 66, w: 62, h: 42, label: 'Fish Market', fill: '#E5DCCB', stroke: '#8A7E6B' },
          { x: 182, y: 66, w: 42, h: 42, label: 'Car Park', fill: '#D8DBD6', stroke: '#6E756B' }
        ],
        afterZones: [
          { x: 14, y: 18, w: 94, h: 36, label: 'Yacht Marina', fill: '#CBE2F2', stroke: '#3B6D94' },
          { x: 118, y: 18, w: 48, h: 36, label: 'Ferry Pier', fill: '#D6E8DB', stroke: '#3F6D4E' },
          { x: 174, y: 18, w: 50, h: 36, label: 'Lighthouse', fill: '#E8E3D0', stroke: '#6E6650' },
          { x: 14, y: 66, w: 76, h: 42, label: 'Seaside Hotel', fill: '#F0DEC9', stroke: '#A16835' },
          { x: 98, y: 66, w: 76, h: 42, label: 'Café & Shops', fill: '#DCECE0', stroke: '#3E6B4B' },
          { x: 182, y: 66, w: 42, h: 42, label: 'Green Park', fill: '#CEE5D2', stroke: '#376E42' }
        ],
        roadBefore: 'Coastal Traffic Road',
        roadAfter: 'Pedestrian Promenade'
      }
    }
  ];

  // Pre-paired Full IELTS Writing Tests (60 min: Part 1 Task 1 + Part 2 Task 2)
  const FULL_TESTS = [
    {
      id: 'wfull_01',
      title: 'Full Writing Test 01 · Environment & Work',
      badge: '60 phút · Chuẩn CD-IELTS',
      desc: 'Part 1: Line Graph (Điện tái tạo 2000–2025) + Part 2: Overwork & Work-Life Balance.',
      task1Id: 'wt1_line_energy',
      task2Id: 'wex_st01_01'
    },
    {
      id: 'wfull_02',
      title: 'Full Writing Test 02 · Urban Life & Careers',
      badge: '60 phút · Chuẩn CD-IELTS',
      desc: 'Part 1: Bar Chart (Phương tiện đi làm 5 đô thị) + Part 2: Job Satisfaction & Career Choices.',
      task1Id: 'wt1_bar_commute',
      task2Id: 'wex_st02_01'
    },
    {
      id: 'wfull_03',
      title: 'Full Writing Test 03 · Economy & Tech Shift',
      badge: '60 phút · Chuẩn CD-IELTS',
      desc: 'Part 1: Pie Charts (Chi tiêu hộ gia đình 1995 vs 2025) + Part 2: Technology & Remote Work.',
      task1Id: 'wt1_pie_budget',
      task2Id: 'wex_st03_01'
    },
    {
      id: 'wfull_04',
      title: 'Full Writing Test 04 · Education & Sustainability',
      badge: '60 phút · Chuẩn CD-IELTS',
      desc: 'Part 1: Table (Việc làm & lương sinh viên tốt nghiệp) + Part 2: Workplace & Higher Education.',
      task1Id: 'wt1_table_grad',
      task2Id: 'wex_st02_06'
    },
    {
      id: 'wfull_05',
      title: 'Full Writing Test 05 · Process & Modern Society',
      badge: '60 phút · Chuẩn CD-IELTS',
      desc: 'Part 1: Process Diagram (Quy trình tái chế chai thủy tinh) + Part 2: Overwork & Society.',
      task1Id: 'wt1_process_glass',
      task2Id: 'wex_st01_04'
    },
    {
      id: 'wfull_06',
      title: 'Full Writing Test 06 · Map Redevelopment & Tech',
      badge: '60 phút · Chuẩn CD-IELTS',
      desc: 'Part 1: Map Comparison (Cảng Westbridge 2005 vs Hiện tại) + Part 2: Automation & Cities.',
      task1Id: 'wt1_map_harbour',
      task2Id: 'wex_st03_04'
    }
  ];

  window.WRITING_TASK1_DATA = {
    VERSION: '20261127a',
    TASK1_PROMPTS,
    FULL_TESTS
  };
})();
