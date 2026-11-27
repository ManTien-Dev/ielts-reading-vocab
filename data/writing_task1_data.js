/* ==========================================================================
   TOTORO IELTS MASTER — IELTS WRITING TASK 1 (ACADEMIC) DATA BANK
   12 Curated Academic Visual Prompts across ALL 7 Official Cambridge Types
   (100% Offline Crisp SVG + Full Band 8.0+ 4-Paragraph Model Essays):
   1. Line Graph (×2)    2. Bar Chart (×2)      3. Pie Charts (×2)
   4. Table (×1)         5. Process (Man-made + Natural ×2)
   6. Map Comparison (Past→Now + Now→Future ×2) 7. Mixed Chart (Bar + Line ×1)
   + 10 Pre-paired 60-Minute Full IELTS Writing Tests (Part 1 + Part 2)
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
      review: 'Luyện mô tả xu hướng tăng mạnh (soar, overtake), so sánh điểm giao cắt giữa Đức và Tây Ban Nha và giữ mạch Overview không đưa số liệu chi tiết.',
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
      modelEssay: {
        intro: 'The line graph illustrates the proportion of electricity produced from renewable energy sources in Denmark, Germany, Spain, and Japan over a 25-year period from 2000 to 2025.',
        overview: 'Overall, all four countries experienced a marked upward trend in renewable electricity generation. Denmark remained the undisputed frontrunner throughout the timeframe, whereas Germany achieved the most rapid expansion, surpassing Spain after 2015.',
        body1: 'In 2000, Denmark already generated 22% of its power from renewables, well ahead of Spain at 16%. Both nations saw consistent gains, with Denmark climbing steeply to 58% by 2015 and eventually accounting for over four-fifths of its electricity (84%) in 2025. Spain followed a steadier upward trajectory, more than tripling its initial share to reach 53% at the end of the period.',
        body2: 'By contrast, Germany and Japan started from much lower bases of 7% and 9%, respectively. While Japan rose gradually to just 29% by 2025, Germany underwent a dramatic surge after 2010, jumping from 18% to 49% in 2020—overtaking Spain—and finishing as the second-highest producer at 61%.'
      },
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
        'Giao thông công cộng áp đảo ở Tokyo (62%), Singapore (56%) và London (48%)',
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
      modelOverview: 'Overall, commuting patterns varied markedly across the five cities. Public transit dominated in Tokyo, Singapore, and London, whereas private cars were overwhelmingly favoured in Houston, and Amsterdam stood out for its exceptionally high rate of cycling and walking.',
      modelEssay: {
        intro: 'The bar chart compares the share of daily commuters relying on public transport, private cars, and cycling or walking across five major metropolitan cities in 2024.',
        overview: 'Overall, commuting preferences differed sharply among the cities surveyed. Public transit was the primary choice in Tokyo, Singapore, and London, whereas Houston was overwhelmingly car-dependent, and Amsterdam stood out for its high proportion of active travel.',
        body1: 'Public transport attracted the largest share of commuters in Tokyo (62%), followed closely by Singapore at 56% and London at 48%. In these three cities, private cars played a secondary role, accounting for just 18% in Tokyo, 27% in Singapore, and 32% in London. Cycling and walking represented a consistent minority of roughly one-fifth in both Tokyo and London (20% each) and 17% in Singapore.',
        body2: 'In stark contrast, nearly four-fifths of Houston commuters (78%) drove private vehicles, leaving public transit (12%) and active travel (10%) far behind. Amsterdam displayed the most distinct profile, with 44% cycling or walking to work—more than double the figure in any other city—while public transport and cars made up 29% and 27%, respectively.'
      },
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
        'Công nghệ & Giáo dục tăng hơn gấp đôi (6% → 13%)'
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
      modelEssay: {
        intro: 'The two pie charts compare how urban households in a European country allocated their average monthly expenditure across six categories in 1995 and 2025.',
        overview: 'Overall, spending patterns shifted noticeably away from food and leisure towards housing, healthcare, and technology over the 30-year period. Housing overtook food to become by far the largest single expense by 2025.',
        body1: 'In 1995, food accounted for the greatest proportion of household budgets at 31%, while housing ranked second at nearly a quarter (24%). By 2025, however, these positions had reversed dramatically: the share devoted to housing climbed by ten percentage points to just over a third (34%), whereas food expenditure shrank considerably to 18%.',
        body2: 'Among the smaller categories, spending on technology and education more than doubled from 6% to 13%, and healthcare also expanded from 9% to 13%. Conversely, the proportions allocated to transport and leisure declined modestly, falling from 16% to 13% and from 14% to 9%, respectively.'
      },
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
      modelEssay: {
        intro: 'The table compares post-graduation outcomes—namely employment within six months, median starting salaries, further study rates, and unemployment—across five university disciplines in 2024.',
        overview: 'Overall, vocational and technical fields yielded substantially stronger job prospects and higher initial earnings than theoretical subjects. Medicine and Engineering & IT led in both employment and pay, while Arts & Humanities graduates recorded the lowest starting salaries and the highest rate of postgraduate study.',
        body1: 'Medicine & Health achieved the strongest labour-market outcomes, with 96% securing employment within six months and commanding the highest median salary of $54,000, alongside a negligible 1% unemployment rate. Engineering & IT followed closely behind, posting a 91% employment rate and an average starting pay of $49,500, while only 5% continued into further education.',
        body2: 'In the middle tier, Business & Finance recorded 84% employment and $42,000 in median pay, though it also registered the highest unemployment figure at 8%. By contrast, Natural Sciences (16%) and especially Arts & Humanities (24%) saw far larger shares opting for postgraduate study, which corresponded with lower immediate employment rates of 78% and 71% and starting salaries of $39,200 and $31,500, respectively.'
      },
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
      modelEssay: {
        intro: 'The diagram outlines the sequential stages through which discarded glass bottles are collected, processed, and transformed into new usable containers.',
        overview: 'Overall, glass recycling operates as a continuous six-stage closed-loop cycle. It can be broadly divided into two main phases: initial collection and preparation of waste glass, followed by industrial crushing, high-temperature melting, and remoulding.',
        body1: 'In the first phase, used glass bottles are gathered from public recycling bins and transported to a treatment facility. Next, the bottles are thoroughly cleaned using high-pressure water to strip away paper labels and any leftover residue. Once washed, the glass is carefully sorted according to colour—specifically into clear, green, and brown batches—to maintain consistency in the final products.',
        body2: 'During the manufacturing phase, the sorted bottles are fed into a crushing machine that breaks them down into fine fragments known as cullet. This cullet is subsequently heated inside an industrial furnace at roughly 1,500°C until it becomes molten glass. Finally, the liquid glass is poured into moulds to form brand-new bottles, which are then refilled, delivered to retailers, and eventually re-enter the recycling loop.'
      },
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
      modelEssay: {
        intro: 'The two maps illustrate how Westbridge Harbour has been redeveloped from its layout in 2005 to its present-day configuration.',
        overview: 'Overall, the harbour has undergone a comprehensive transformation from an industrial fishing and cargo port into a modern leisure and hospitality destination. Despite these sweeping changes, the historic lighthouse in the north-east remains untouched.',
        body1: 'Along the northern shoreline facing the North Sea, commercial port facilities have largely been replaced by recreational amenities. The former fishing pier in the north-west has been expanded into a larger yacht marina, while the neighbouring cargo dock has been converted into a passenger ferry pier. Only the lighthouse at the far north-eastern end has retained its original position and function.',
        body2: 'Inland, the industrial buildings that once lined the southern edge have been completely cleared. In the south-west, the old warehouses were demolished to make way for a seaside hotel, and the central fish market has been transformed into a café and shopping complex. Further east, the former car park has been replaced by a green public park, while the east–west coastal traffic road along the southern border has been turned into a car-free pedestrian promenade.'
      },
      chartData: {
        theme: 'coast',
        topBackdropLabel: 'NORTH SEA',
        beforeYear: '2005',
        afterYear: 'Present',
        beforeZones: [
          { x: 14, y: 26, w: 82, h: 34, label: 'Fishing Pier', fill: '#D5E1EB', stroke: '#5C7A94' },
          { x: 106, y: 26, w: 80, h: 34, label: 'Cargo Dock', fill: '#E2DDD1', stroke: '#8A8170' },
          { x: 196, y: 26, w: 70, h: 34, label: 'Lighthouse', fill: '#EFE7CC', stroke: '#7A6C42' },
          { x: 14, y: 74, w: 96, h: 42, label: 'Old Warehouses', fill: '#DFD4C4', stroke: '#877660' },
          { x: 120, y: 74, w: 74, h: 42, label: 'Fish Market', fill: '#E5DCCB', stroke: '#8A7E6B' },
          { x: 204, y: 74, w: 62, h: 42, label: 'Car Park', fill: '#D8DBD6', stroke: '#6E756B' }
        ],
        afterZones: [
          { x: 14, y: 26, w: 96, h: 34, label: 'Yacht Marina', fill: '#CBE2F2', stroke: '#3B6D94' },
          { x: 120, y: 26, w: 66, h: 34, label: 'Ferry Pier', fill: '#D6E8DB', stroke: '#3F6D4E' },
          { x: 196, y: 26, w: 70, h: 34, label: 'Lighthouse', fill: '#EFE7CC', stroke: '#7A6C42' },
          { x: 14, y: 74, w: 88, h: 42, label: 'Seaside Hotel', fill: '#F0DEC9', stroke: '#A16835' },
          { x: 112, y: 74, w: 82, h: 42, label: 'Café & Shops', fill: '#DCECE0', stroke: '#3E6B4B' },
          { x: 204, y: 74, w: 62, h: 42, label: 'Green Park', fill: '#CEE5D2', stroke: '#376E42' }
        ],
        roadBefore: 'Coastal Traffic Road (East – West)',
        roadAfter: 'Pedestrian Promenade (Car-Free)'
      }
    },
    /* ========== 6 NEW CURATED ACADEMIC TASK 1 PROMPTS (COVERING MIXED, NATURAL PROCESS & FUTURE MAP) ========== */
    {
      id: 'wt1_mixed_water',
      taskPart: 1,
      chartType: 'mixed',
      type: 'Mixed Chart',
      topic: 'Environment & Resources',
      difficulty: 'Band 7.0–8.5',
      timeMins: 20,
      minWords: 150,
      title: 'Global Water Usage by Sector & World Population (1980–2025)',
      prompt: 'The charts below show global freshwater consumption across three sectors (in km³) and total world population growth (in billions) between 1980 and 2025.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Dạng Mixed Chart (Biểu đồ kết hợp Cột + Đường) — luyện chia Body 1 cho biểu đồ trái, Body 2 cho biểu đồ phải và chỉ ra mối liên hệ song song trong Overview.',
      overviewChecklist: [
        'Cả lượng tiêu thụ nước ngọt lẫn dân số thế giới đều tăng liên tục từ 1980 đến 2025',
        'Nông nghiệp (Agriculture) luôn chiếm tỷ trọng tiêu thụ nước lớn nhất vượt xa Công nghiệp và Sinh hoạt',
        'Dân số thế giới gần như tăng gấp đôi (4.4 tỷ → 8.2 tỷ), kéo theo nhu cầu nước sinh hoạt tăng nhanh nhất theo tỷ lệ'
      ],
      keyVocab: [
        'in tandem with population growth',
        'accounted for the lion’s share of',
        'nearly doubled over the 45-year span',
        'industrial and domestic consumption',
        'outpaced other sectors by a wide margin',
        'a parallel upward trend'
      ],
      modelOverview: 'Overall, both global water consumption across all three sectors and the world population rose steadily between 1980 and 2025. Agriculture consistently remained by far the largest consumer of freshwater, while global population nearly doubled over the same timeframe.',
      modelEssay: {
        intro: 'The bar chart illustrates global freshwater use across the agricultural, industrial, and domestic sectors from 1980 to 2025, while the line graph tracks world population growth over the corresponding period.',
        overview: 'Overall, freshwater consumption expanded across every sector in tandem with rapid global population growth. Agriculture accounted for the lion’s share of water demand throughout the 45-year period, whereas domestic usage remained the smallest category despite growing sharply in proportional terms.',
        body1: 'In 1980, agricultural water consumption stood at 2,100 km³, more than triple the figure for industry (620 km³) and nearly nine times that of domestic use (240 km³). By 2025, agricultural demand had climbed steadily to 3,150 km³. Over the same span, industrial water consumption rose from 620 km³ to 980 km³, while domestic usage more than doubled to reach 540 km³.',
        body2: 'Turning to demographic trends, the world population followed a parallel upward trajectory. Standing at 4.4 billion in 1980, it increased consistently to 5.7 billion in 1995 and 6.9 billion in 2010, before reaching 8.2 billion by 2025—almost double its 1980 level—mirroring the sharp surge in household water needs.'
      },
      chartData: {
        leftTitle: 'Water Use by Sector (km³)',
        leftUnit: '',
        leftYMax: 3500,
        leftYStep: 700,
        categories: ['1980', '1995', '2010', '2025'],
        barSeries: [
          { name: 'Agriculture', color: '#2F663D', values: [2100, 2450, 2820, 3150] },
          { name: 'Industry', color: '#2B6496', values: [620, 740, 860, 980] },
          { name: 'Domestic', color: '#B86A28', values: [240, 330, 430, 540] }
        ],
        rightTitle: 'World Population (Billions)',
        rightUnit: 'B',
        rightYMax: 10,
        rightYStep: 2,
        labels: ['1980', '1995', '2010', '2025'],
        lineSeries: [
          { name: 'Population (B)', color: '#7D4E8A', values: [4.4, 5.7, 6.9, 8.2] }
        ]
      }
    },
    {
      id: 'wt1_line_media',
      taskPart: 1,
      chartType: 'line',
      type: 'Line Graph',
      topic: 'Media & Technology',
      difficulty: 'Band 6.5–8.0',
      timeMins: 20,
      minWords: 150,
      title: 'Primary Daily News Sources Among Adults (2000–2025)',
      prompt: 'The line graph below shows the percentage of adults who used television, print newspapers, online news websites, and social media as their primary daily news source between 2000 and 2025.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Biểu đồ đường 4 đường giao cắt rõ rệt (xu hướng nghịch chiều giữa báo giấy/TV truyền thống và báo mạng/mạng xã hội).',
      overviewChecklist: [
        'Truyền hình và báo giấy giảm mạnh liên tục suốt 25 năm',
        'Báo mạng (Online News) và Mạng xã hội (Social Media) tăng vọt và vượt qua kênh truyền thống sau năm 2015',
        'Đến năm 2025, Mạng xã hội vươn lên vị trí dẫn đầu trong khi Báo giấy tụt xuống dưới 10%'
      ],
      keyVocab: [
        'experienced a precipitous decline',
        'plummeted from ... to ...',
        'gained massive traction after 2010',
        'eclipsed traditional media',
        'a stark divergence between ... and ...',
        'gradually fell out of favour'
      ],
      modelOverview: 'Overall, there was a stark divergence between traditional and digital news formats from 2000 to 2025. While television and print newspapers declined steeply, online websites and social media surged to become the dominant daily news sources by the end of the period.',
      modelEssay: {
        intro: 'The line graph traces changes in the percentage of adults relying on television, print newspapers, online news sites, and social media as their main daily news source between 2000 and 2025.',
        overview: 'Overall, traditional outlets fell sharply out of favour over the 25-year span, whereas digital platforms experienced rapid growth. By 2025, social media had overtaken all other channels, while print newspapers had shrunk to a tiny fraction.',
        body1: 'In 2000, television was by far the most popular news source at 68%, followed by print newspapers at 44%. Both traditional media subsequently endured a steady decline: television dropped to 42% by 2015 and ended at just 24% in 2025. Print readership suffered an even steeper collapse, plummeting continuously to a mere 7% by the end of the period.',
        body2: 'Conversely, digital news platforms started from near-zero levels in 2000 (9% for online sites and 0% for social media) before surging dramatically. Online news websites climbed rapidly to overtake print around 2010 and peaked at 36% in 2025. Meanwhile, social media gained massive traction after 2010, skyrocketing from 8% to 41% in 2025 to claim the top position.'
      },
      chartData: {
        unit: '%',
        yMax: 80,
        yStep: 20,
        labels: ['2000', '2005', '2010', '2015', '2020', '2025'],
        series: [
          { name: 'Television', color: '#B86A28', values: [68, 61, 53, 42, 32, 24] },
          { name: 'Print Papers', color: '#7D4E8A', values: [44, 36, 26, 17, 11, 7] },
          { name: 'Online News', color: '#2B6496', values: [9, 16, 25, 31, 35, 36] },
          { name: 'Social Media', color: '#2F663D', values: [0, 2, 8, 20, 33, 41] }
        ]
      }
    },
    {
      id: 'wt1_bar_edu',
      taskPart: 1,
      chartType: 'bar',
      type: 'Bar Chart',
      topic: 'Government & Public Policy',
      difficulty: 'Band 6.5–8.0',
      timeMins: 20,
      minWords: 150,
      title: 'Public Budget Allocation in Four Countries (2024)',
      prompt: 'The bar chart below shows the percentage of national government budgets allocated to healthcare, education, and infrastructure in four countries in 2024.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Biểu đồ cột ghép so sánh ưu tiên ngân sách quốc gia — luyện nhóm các nước có ưu tiên tương đồng (Y tế ở Anh/Đức vs Giáo dục & Hạ tầng ở Hàn Quốc/Việt Nam).',
      overviewChecklist: [
        'Y tế chiếm tỷ trọng cao nhất ở Đức (22%) và Anh (20%)',
        'Hàn Quốc và Việt Nam phân bổ tỷ lệ lớn cho Hạ tầng và Giáo dục',
        'Hạ tầng ở Anh và Đức chỉ chiếm dưới 10%, thấp hơn hẳn 2 quốc gia châu Á'
      ],
      keyVocab: [
        'allocated the largest proportion to',
        'prioritised healthcare over infrastructure',
        'invested heavily in public infrastructure',
        'a fairly balanced distribution',
        'trailed significantly behind',
        'accounted for roughly a fifth of the budget'
      ],
      modelOverview: 'Overall, the two European nations prioritised healthcare above other sectors, whereas South Korea and Vietnam placed greater emphasis on education and infrastructure investment in 2024.',
      modelEssay: {
        intro: 'The bar chart compares the proportion of national government spending devoted to healthcare, education, and infrastructure across the UK, Germany, South Korea, and Vietnam in 2024.',
        overview: 'Overall, spending priorities differed markedly between the European and Asian countries shown. While the UK and Germany directed the largest share of funds towards healthcare, Vietnam led in both education and infrastructure allocation.',
        body1: 'Healthcare represented the single biggest budget item in Germany (22%) and the UK (20%), accounting for roughly a fifth of national expenditure in both countries. By comparison, South Korea dedicated 16% to healthcare, while Vietnam allocated the smallest share at 11%. Conversely, infrastructure spending was modest in the UK (7%) and Germany (9%), trailing well behind South Korea (15%) and Vietnam (19%).',
        body2: 'Regarding education, differences across the four nations were narrower yet still distinct. Vietnam devoted the highest proportion at 18%, closely followed by South Korea at 17%. Meanwhile, the UK and Germany allocated smaller and comparable shares of 13% and 12%, respectively, highlighting a stronger fiscal focus on healthcare for their ageing populations.'
      },
      chartData: {
        unit: '%',
        yMax: 25,
        yStep: 5,
        categories: ['UK', 'Germany', 'South Korea', 'Vietnam'],
        series: [
          { name: 'Healthcare', color: '#2F663D', values: [20, 22, 16, 11] },
          { name: 'Education', color: '#2B6496', values: [13, 12, 17, 18] },
          { name: 'Infrastructure', color: '#B86A28', values: [7, 9, 15, 19] }
        ]
      }
    },
    {
      id: 'wt1_pie_emissions',
      taskPart: 1,
      chartType: 'pie',
      type: 'Pie Charts',
      topic: 'Climate & Energy',
      difficulty: 'Band 6.5–8.0',
      timeMins: 20,
      minWords: 150,
      title: 'Greenhouse Gas Emissions by Sector in an Industrialised Nation (2000 vs 2025)',
      prompt: 'The two pie charts below illustrate the proportion of greenhouse gas emissions produced by five economic sectors in an industrialised country in 2000 and 2025.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Biểu đồ tròn 2 mốc thời gian về phát thải khí nhà kính — nhấn mạnh phát thải ngành Điện giảm mạnh nhờ năng lượng sạch, khiến Giao thông vượt lên dẫn đầu năm 2025.',
      overviewChecklist: [
        'Sản xuất điện (Electricity) từng đứng đầu năm 2000 (38%) nhưng giảm mạnh còn 21% năm 2025',
        'Giao thông (Transport) tăng tỷ trọng từ 22% lên 33% và trở thành nguồn phát thải lớn nhất năm 2025',
        'Nông nghiệp và Xây dựng tăng nhẹ tỷ trọng tương đối'
      ],
      keyVocab: [
        'surpassed electricity as the chief emitter',
        'contracted sharply by 17 percentage points',
        'remained the second-largest contributor',
        'experienced a modest uptick in share',
        'accounted for nearly a third of total emissions',
        'a notable shift in the emissions profile'
      ],
      modelOverview: 'Overall, the country’s emissions profile shifted substantially between 2000 and 2025. Electricity generation saw a dramatic reduction in its share, allowing transport to overtake it as the largest source of greenhouse gases.',
      modelEssay: {
        intro: 'The two pie charts compare the percentage share of greenhouse gas emissions generated by five sectors in a developed nation in 2000 and 2025.',
        overview: 'Overall, there was a notable shift in the main sources of emissions over the 25-year period. While electricity production fell dramatically from first to third place, transport climbed to become the single largest emitter by 2025.',
        body1: 'In 2000, electricity generation accounted for the largest share of emissions at 38%, well ahead of transport (22%) and industry (20%). By 2025, however, the share from electricity had contracted sharply by 17 percentage points to 21%. In contrast, transport surged to represent exactly a third of total emissions (33%), while industry grew slightly to 23%, becoming the second-largest contributor.',
        body2: 'The remaining two sectors made up smaller but growing proportions. Agriculture rose modestly from 11% in 2000 to 13% in 2025, and buildings edged up slightly from 9% to 10%, reflecting slower decarbonisation in farming and heating compared with the power grid.'
      },
      chartData: {
        pies: [
          {
            title: '2000',
            slices: [
              { label: 'Electricity', value: 38, color: '#B86A28' },
              { label: 'Transport', value: 22, color: '#2B6496' },
              { label: 'Industry', value: 20, color: '#7D4E8A' },
              { label: 'Agriculture', value: 11, color: '#2F663D' },
              { label: 'Buildings', value: 9, color: '#587872' }
            ]
          },
          {
            title: '2025',
            slices: [
              { label: 'Electricity', value: 21, color: '#B86A28' },
              { label: 'Transport', value: 33, color: '#2B6496' },
              { label: 'Industry', value: 23, color: '#7D4E8A' },
              { label: 'Agriculture', value: 13, color: '#2F663D' },
              { label: 'Buildings', value: 10, color: '#587872' }
            ]
          }
        ]
      }
    },
    {
      id: 'wt1_process_salmon',
      taskPart: 1,
      chartType: 'process',
      type: 'Process Diagram',
      topic: 'Nature & Biology (Natural Cycle)',
      difficulty: 'Band 7.0–8.5',
      timeMins: 20,
      minWords: 150,
      title: 'The Natural Life Cycle of the Salmon',
      prompt: 'The diagram below illustrates the natural life cycle of a species of large fish called the salmon.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Dạng Natural Process (chu kỳ tự nhiên) — ĐẶC BIỆT lưu ý dùng Thể Chủ Động (Active Voice: hatch, migrate, mature, spawn) thay vì Bị động như quy trình nhà máy!',
      overviewChecklist: [
        'Chu kỳ tự nhiên khép kín gồm 6 giai đoạn kéo dài khoảng 6–8 năm',
        'Cá hồi di cư qua 3 môi trường nước: Thượng nguồn sông (nước ngọt) → Cửa sông (nước lợ) → Đại dương (nước mặn) rồi quay lại sông đẻ trứng'
      ],
      keyVocab: [
        'a continuous natural life cycle',
        'hatch from eggs laid among reeds',
        'migrate downstream to the estuary',
        'adapt to saltwater conditions',
        'mature into full-grown adults',
        'swim upstream to spawn'
      ],
      modelOverview: 'Overall, the salmon’s life cycle is a continuous six-stage natural process spanning several years, during which the fish migrates from freshwater rivers to the open ocean to mature before returning upstream to reproduce.',
      modelEssay: {
        intro: 'The diagram illustrates the various developmental stages and migratory movements that make up the natural life cycle of the salmon.',
        overview: 'Overall, the salmon goes through six distinct biological stages across three aquatic habitats—freshwater upper rivers, brackish estuaries, and the open sea—before returning to its birthplace to spawn and begin the cycle anew.',
        body1: 'The cycle commences in the calm, slow-moving upper reaches of a river, where adult salmon lay eggs beneath small stones and reeds. After several months, tiny fry hatch and feed in the sheltered freshwater shallows. As they grow into juvenile smolts measuring roughly 12 to 15 centimetres, they migrate downstream towards the lower river and estuary.',
        body2: 'In the estuary, the young fish gradually adapt to brackish water before swimming out into the open ocean. There, they spend between three and five years feeding and maturing into large adult salmon. Once fully grown, the adults embark on an arduous journey back upstream to the exact river grounds where they hatched, lay a new generation of eggs, and complete the natural cycle.'
      },
      chartData: {
        cycleNote: 'Natural biological cycle · Active Voice (hatch, migrate, mature, spawn)',
        steps: [
          { num: 1, title: 'Spawning', detail: 'Eggs laid among stones & reeds in upper river' },
          { num: 2, title: 'Fry Stage', detail: 'Tiny fish hatch & grow in calm freshwater' },
          { num: 3, title: 'Smolt', detail: 'Juveniles (12–15 cm) swim down to estuary' },
          { num: 4, title: 'Ocean Phase', detail: 'Adapt to saltwater & migrate to open sea' },
          { num: 5, title: 'Adult Growth', detail: 'Feed for 3–5 years into full-grown salmon' },
          { num: 6, title: 'Upstream Return', detail: 'Swim back to river birthplace to spawn' }
        ]
      }
    },
    {
      id: 'wt1_map_campus',
      taskPart: 1,
      chartType: 'map',
      type: 'Map Comparison',
      topic: 'Education & Campus Planning (Future)',
      difficulty: 'Band 7.0–8.5',
      timeMins: 20,
      minWords: 150,
      title: 'Planned Redevelopment of Greenfield University Campus (Now vs 2035)',
      prompt: 'The two maps below show the current layout of Greenfield University Campus and the planned redevelopment scheduled for completion by 2035.',
      instruction: 'Summarise the information by selecting and reporting the main features, and make comparisons where relevant. Write at least 150 words.',
      review: 'Dạng Map Hiện tại → Tương lai (Now vs 2035) — luyện ngữ pháp tương lai bị động chuẩn Band 8 (will be replaced by, is slated to be expanded, is projected to become).',
      overviewChecklist: [
        'Khuôn viên mở rộng mạnh không gian học thuật công nghệ (AI Lab, Thư viện số mở rộng) và ký túc xá sinh viên',
        'Bãi đỗ xe phía Đông và đường xe chạy xuyên tâm được loại bỏ để nhường chỗ cho Quảng trường Xanh đi bộ',
        'Giảng đường chính (Main Hall) ở góc Tây Bắc được giữ nguyên vị trí'
      ],
      keyVocab: [
        'is slated to undergo major modernisation',
        'will be demolished to make room for',
        'is projected to be expanded eastward',
        'will be converted into a pedestrianised plaza',
        'is expected to remain unchanged',
        'brand-new student residences'
      ],
      modelOverview: 'Overall, Greenfield University Campus is slated to become far more modern, student-centred, and eco-friendly by 2035, replacing parking areas and internal traffic with an AI Innovation Hub, expanded library facilities, and pedestrian green spaces.',
      modelEssay: {
        intro: 'The two maps compare the existing layout of Greenfield University Campus with the proposed redevelopment plan scheduled for completion in 2035.',
        overview: 'Overall, the campus is set to undergo extensive modernisation, shifting from a vehicle-accessible layout to a pedestrianised, technology-focused environment. While the Main Hall in the north-west will remain intact, nearly all other zones will be expanded or replaced.',
        body1: 'In the northern section of the campus, the historic Main Hall will stay in its current location, whereas the adjacent Old Library is projected to be expanded significantly into a larger Digital Library. To the north-east, the outdated sports shed will be demolished to make way for a modern AI & Robotics Hub.',
        body2: 'Major alterations are also planned for the southern half. The small café block in the south-west will be replaced by a Student Union & Food Court, while the central grass lawn will be redeveloped into multi-storey student residences. In the south-east, the surface car park will be removed to create an eco-friendly Botanical Plaza, and the current Campus Traffic Road along the southern edge will be converted into a solar-lit cycle and walkway.'
      },
      chartData: {
        theme: 'campus',
        topBackdropLabel: 'NORTH GREENBELT WOODS',
        beforeYear: 'Now',
        afterYear: '2035 (Planned)',
        beforeZones: [
          { x: 14, y: 26, w: 78, h: 34, label: 'Main Hall', fill: '#EFE7CC', stroke: '#7A6C42' },
          { x: 102, y: 26, w: 80, h: 34, label: 'Old Library', fill: '#DFD4C4', stroke: '#877660' },
          { x: 192, y: 26, w: 74, h: 34, label: 'Sports Shed', fill: '#D8DBD6', stroke: '#6E756B' },
          { x: 14, y: 74, w: 76, h: 42, label: 'Small Café', fill: '#E5DCCB', stroke: '#8A7E6B' },
          { x: 100, y: 74, w: 88, h: 42, label: 'Open Lawn', fill: '#D9E8D2', stroke: '#547A4C' },
          { x: 198, y: 74, w: 68, h: 42, label: 'Car Park', fill: '#D8DBD6', stroke: '#6E756B' }
        ],
        afterZones: [
          { x: 14, y: 26, w: 78, h: 34, label: 'Main Hall', fill: '#EFE7CC', stroke: '#7A6C42' },
          { x: 100, y: 26, w: 88, h: 34, label: 'Digital Library', fill: '#CBE2F2', stroke: '#3B6D94' },
          { x: 196, y: 26, w: 70, h: 34, label: 'AI & Tech Hub', fill: '#E2D8F2', stroke: '#624894' },
          { x: 14, y: 74, w: 82, h: 42, label: 'Student Union', fill: '#F0DEC9', stroke: '#A16835' },
          { x: 104, y: 74, w: 82, h: 42, label: 'Student Dorms', fill: '#DCECE0', stroke: '#3E6B4B' },
          { x: 194, y: 74, w: 72, h: 42, label: 'Botanical Plaza', fill: '#CEE5D2', stroke: '#376E42' }
        ],
        roadBefore: 'Campus Traffic Road (Cars Allowed)',
        roadAfter: 'Solar Cycle & Pedestrian Walkway'
      }
    }
  ];

  // 10 Pre-paired Full IELTS Writing Tests (60 min: Part 1 Task 1 + Part 2 Task 2)
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
    },
    {
      id: 'wfull_07',
      title: 'Full Writing Test 07 · Mixed Chart & Work Pressure',
      badge: '60 phút · Nâng cao',
      desc: 'Part 1: Mixed Chart (Nước ngọt & Dân số 1980–2025) + Part 2: Family & Working Hours.',
      task1Id: 'wt1_mixed_water',
      task2Id: 'wex_st01_06'
    },
    {
      id: 'wfull_08',
      title: 'Full Writing Test 08 · Digital Media & AI Workforce',
      badge: '60 phút · Xu hướng 2026',
      desc: 'Part 1: Line Graph (Thói quen đọc tin 2000–2025) + Part 2: AI, Screens & Modern Work.',
      task1Id: 'wt1_line_media',
      task2Id: 'wex_st03_02'
    },
    {
      id: 'wfull_09',
      title: 'Full Writing Test 09 · Natural Cycle & Career Values',
      badge: '60 phút · Chuẩn Cambridge',
      desc: 'Part 1: Natural Process (Vòng đời cá hồi · Chủ động) + Part 2: Salary vs Meaningful Work.',
      task1Id: 'wt1_process_salmon',
      task2Id: 'wex_st02_03'
    },
    {
      id: 'wfull_10',
      title: 'Full Writing Test 10 · Future Campus & Climate',
      badge: '60 phút · Chuẩn Cambridge',
      desc: 'Part 1: Future Map (Đại học Greenfield 2035 · Tương lai) + Part 2: Public Policy & Work.',
      task1Id: 'wt1_map_campus',
      task2Id: 'wex_st02_09'
    }
  ];

  window.WRITING_TASK1_DATA = {
    VERSION: '20261128a',
    TASK1_PROMPTS,
    FULL_TESTS
  };
})();
