window.APP_TASK_EXAM_V2_DATA = {
  task_01: {
    version: 2,
    test2ReadingClips: [
      {
        id: 't01_c01',
        type: 'tfng',
        method: 'Tìm lõi S–V–O + Connection words (Nhượng bộ)',
        keyWords: ['rapid', 'detect', 'unreliable'],
        excerpt: 'Although rapid diagnostic kits allow clinicians to detect viral markers within minutes, subsequent laboratory audits reveal that these expedited assays remain highly unreliable during the earliest stages of infection. Because viral loads fluctuate sharply before symptoms appear, fast screening frequently generates false negatives that delay essential quarantine protocols.',
        prompt: 'Fast diagnostic kits consistently provide dependable results for identifying early-stage infections.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        paraphraseLink: 'Fast diagnostic kits ↔ rapid diagnostic kits · identifying ↔ detect · dependable results ↔ (trái ngược) highly unreliable',
        explain: 'Key Task: rapid (nhanh), detect (phát hiện), unreliable (không đáng tin cậy). Phương pháp: Gạt mệnh đề nhượng bộ "Although..." (công nhận kit nhanh giúp phát hiện sớm), lấy lõi S–V–O ở vế chính: các xét nghiệm này "remain highly unreliable" (rất thiếu tin cậy) ở giai đoạn đầu -> trái ngược hoàn toàn với "dependable results" -> FALSE.'
      },
      {
        id: 't01_c02',
        type: 'tfng',
        method: 'Paraphrase 4 kiểu + Đối chiếu 3 mảnh',
        keyWords: ['emission', 'dioxide', 'impact'],
        excerpt: 'Coastal mangrove forests absorb substantially more carbon dioxide per hectare than mature terrestrial woodlands. Consequently, clearing these tidal wetlands triggers massive greenhouse gas emissions from exposed peat soils, magnifying the long-term warming impact on regional climate systems for centuries after deforestation occurs.',
        prompt: 'Destroying mangrove wetlands worsens regional warming because disturbed soils release stored greenhouse gases.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'TRUE',
        paraphraseLink: 'Destroying mangrove wetlands ↔ clearing these tidal wetlands · release stored greenhouse gases ↔ triggers massive greenhouse gas emissions · worsens regional warming ↔ magnifying the long-term warming impact',
        explain: 'Key Task: dioxide (điôxit), emission (phát thải), impact (tác động). Phương pháp 3 mảnh: [Chủ thể: phá rừng ngập mặn] — [Hành động: đất giải phóng khí thải gây hiệu ứng nhà kính] — [Hệ quả: làm trầm trọng thêm tác động nóng lên]. Cả 3 mảnh đều khớp bằng paraphrase đồng nghĩa & danh từ hóa -> TRUE.'
      },
      {
        id: 't01_c03',
        type: 'tfng',
        method: 'Hedging & Giọng văn tác giả (Passage 3)',
        keyWords: ['hypothesis', 'analyze', 'researcher'],
        excerpt: 'When marine researchers analyzed core samples from the abyssal plain, they noticed an unexpected clustering of metallic nodules near hydrothermal vents. While one preliminary hypothesis attributes this distribution to ancient volcanic currents, the team emphasizes that existing geochemical data falls short of proving whether microbial activity also shaped the mineral deposits.',
        prompt: 'The research team intends to deploy deep-sea submarines next year to test whether microbes formed the metallic nodules.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'NOT GIVEN',
        paraphraseLink: 'The research team ↔ marine researchers · microbes formed the metallic nodules ↔ microbial activity also shaped the mineral deposits',
        explain: 'Key Task: researcher (nhà nghiên cứu), analyze (phân tích), hypothesis (giả thuyết). Phương pháp Hedging & Kiểm tra phạm vi: Bài đọc chỉ nêu nhóm đã phân tích mẫu (analyzed) và dữ liệu hiện tại chưa đủ chứng minh giả thuyết vi sinh vật (falls short of proving), hoàn toàn không nhắc tới kế hoạch dùng tàu ngầm vào năm tới -> NOT GIVEN.'
      },
      {
        id: 't01_c04',
        type: 'tfng',
        method: 'Truy vết Reference words + Đối chiếu 3 mảnh',
        keyWords: ['insect', 'nest', 'survive'],
        excerpt: 'Solitary mason bees rarely construct communal hives; instead, each female excavates a narrow wooden tunnel to build an individual nest stocked with pollen. Unfortunately, when manicured lawns replace wildflower meadows, these insects struggle to locate sufficient nectar, and fewer than a quarter of their larvae survive through winter dormancy.',
        prompt: 'Most young mason bees successfully endure the winter even when wildflower habitats are replaced by tidy lawns.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'FALSE',
        paraphraseLink: 'young mason bees ↔ larvae · tidy lawns ↔ manicured lawns · successfully endure ↔ (ngược nghĩa) fewer than a quarter survive',
        explain: 'Key Task: insect (côn trùng), nest (tổ), survive (sống sót). Phương pháp Reference words ("these insects" = loài ong thợ đơn độc tự đào tổ) + 3 mảnh: Câu hỏi khẳng định "Most... successfully endure" (đa số sống sót), trái ngược trực tiếp với dữ kiện "fewer than a quarter... survive" (chưa tới 1/4 sống sót) -> FALSE.'
      },
      {
        id: 't01_c05',
        type: 'tfng',
        method: 'Connection words (Nhân – quả) + Đổi cấu trúc câu',
        keyWords: ['pollution', 'chemical', 'habitat'],
        excerpt: 'Industrial runoff introduces persistent synthetic chemicals into freshwater river deltas long after nearby factories close. Because these toxic compounds bind tightly to riverbed silt, chronic chemical pollution steadily degrades spawning habitats, causing sharp declines in native amphibian populations across downstream basins.',
        prompt: 'A drop in downstream amphibian numbers stems from the contamination of breeding environments by long-lasting industrial toxins.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'TRUE',
        paraphraseLink: 'stems from (quả -> nhân) ↔ causing (nhân -> quả) · contamination of breeding environments ↔ pollution degrades spawning habitats · long-lasting industrial toxins ↔ persistent synthetic chemicals',
        explain: 'Key Task: chemical (hóa chất), pollution (ô nhiễm), habitat (môi trường sống). Phương pháp Nhân–quả & Đổi cấu trúc: Đoạn văn đi từ nguyên nhân (ô nhiễm hóa chất làm suy thoái môi trường sinh sản) sang kết quả (suy giảm lưỡng cư); câu hỏi đảo ngược bằng "stems from" (bắt nguồn từ) nhưng giữ đúng chiều logic -> TRUE.'
      },
      {
        id: 't01_c06',
        type: 'tfng',
        method: 'Quan điểm bên thứ 3 vs Tác giả (Passage 3)',
        keyWords: ['recycle', 'recycled', 'sustainable'],
        excerpt: 'Packaging executives frequently promote recycled aluminum cans as an effortless gateway to sustainable consumerism. Yet life-cycle economists argue that simply exhorting shoppers to recycle obscures a thornier dilemma: global beverage demand is growing so quickly that total virgin-ore extraction keeps rising despite higher recovery rates.',
        prompt: 'Life-cycle economists believe that government taxes on new aluminum cans would slow global beverage demand.',
        options: ['TRUE', 'FALSE', 'NOT GIVEN'],
        answer: 'NOT GIVEN',
        paraphraseLink: 'Life-cycle economists ↔ life-cycle economists · global beverage demand ↔ global beverage demand',
        explain: 'Key Task: recycled (đã tái chế), recycle (tái chế), sustainable (bền vững). Phương pháp Quan điểm: Các nhà kinh tế chỉ phản biện rằng kêu gọi tái chế chưa đủ bền vững khi nhu cầu tăng nhanh; bài không hề đề cập đến ý kiến đánh thuế của chính phủ -> NOT GIVEN.'
      },
      {
        id: 't01_c07',
        type: 'mcq',
        method: 'Đoán nghĩa ngữ cảnh (Sắc thái & Định nghĩa ngầm)',
        keyWords: ['regenerate', 'layer', 'fossil'],
        excerpt: 'Unlike fragile coral reefs that regenerate slowly after bleaching events, ancient stromatolites grew as microscopic bacteria trapped sediment in paper-thin mineral layers over millennia. Today, geologists examine these fossilized mounds—preserved stone structures dating back over three billion years—to reconstruct how oxygen first accumulated in Earth\'s early atmosphere.',
        prompt: 'Why do geologists study fossilized stromatolite mounds, according to the passage?',
        options: [
          'To measure how quickly damaged coral reefs rebuild their skeletons',
          'To trace the early buildup of atmospheric oxygen through ancient mineral strata',
          'To collect living bacteria capable of purifying modern ocean sediment',
          'To verify that modern corals cannot regenerate without bacterial coatings'
        ],
        answer: 'To trace the early buildup of atmospheric oxygen through ancient mineral strata',
        paraphraseLink: 'ancient mineral strata ↔ paper-thin mineral layers + fossilized mounds · trace the early buildup of oxygen ↔ reconstruct how oxygen first accumulated',
        explain: 'Key Task: regenerate (tái tạo), layer (lớp/tầng), fossil (hóa thạch). Phương pháp Định nghĩa ngầm sau dấu gạch ngang ("—preserved stone structures...") giải thích cho "fossilized mounds", kết hợp từ "mineral layers" (= mineral strata). Loại phương án về san hô vì "regenerate" chỉ dùng để so sánh mở câu.'
      },
      {
        id: 't01_c08',
        type: 'mcq',
        method: 'Tìm lõi S–V–O + Connection words (Đối lập)',
        keyWords: ['transport', 'productivity', 'beneficial'],
        excerpt: 'Remote work is often praised as uniformly beneficial for municipal air quality because fewer commuters require daily motorized transport. However, urban economists caution that suburban office dispersal has inadvertently encouraged longer weekend errands and fragmented delivery routes, offsetting fuel savings while leaving overall labor productivity largely unchanged across service industries.',
        prompt: 'What reservation do urban economists express about widespread remote work?',
        options: [
          'It has dramatically reduced labor productivity across every service sector.',
          'Extra local driving and split deliveries cancel out expected commuter fuel reductions.',
          'Public transport networks have become more beneficial for suburban shoppers.',
          'Municipal air quality deteriorated exclusively due to longer weekday commutes.'
        ],
        answer: 'Extra local driving and split deliveries cancel out expected commuter fuel reductions.',
        paraphraseLink: 'cancel out expected commuter fuel reductions ↔ offsetting fuel savings · split deliveries ↔ fragmented delivery routes',
        explain: 'Key Task: beneficial (có lợi), transport (vận chuyển/đi lại), productivity (năng suất). Phương pháp Lõi S–V–O + Đối lập (However): Sau "However", làm việc từ xa khiến giao hàng phân mảnh và đi lại cuối tuần làm triệt tiêu ("offsetting") phần nhiên liệu giao thông tiết kiệm được; còn năng suất ("productivity") hầu như không đổi (loại phương án nói giảm mạnh).'
      },
      {
        id: 't01_c09',
        type: 'mcq',
        method: 'Paraphrase (Khái quát ↔ Cụ thể)',
        keyWords: ['migration', 'unpredictable', 'predict'],
        excerpt: 'For generations, coastal elders could predict seasonal whale migration by watching shifts in kelp growth and surface wind direction. Now, abrupt ocean heatwaves have disrupted plankton blooms on an unprecedented scale, forcing whale pods onto erratic offshore detours that make traditional forecasting tools increasingly unpredictable.',
        prompt: 'What makes traditional methods of anticipating whale movements unreliable today?',
        options: [
          'Surface wind patterns have completely ceased across coastal waters.',
          'Elders refuse to share seasonal forecasting knowledge with younger fishers.',
          'Sudden marine warming alters food supplies and pushes whales along irregular paths.',
          'Kelp forests have expanded too rapidly for whales to navigate nearshore currents.'
        ],
        answer: 'Sudden marine warming alters food supplies and pushes whales along irregular paths.',
        paraphraseLink: 'anticipating whale movements ↔ predict seasonal whale migration · Sudden marine warming ↔ abrupt ocean heatwaves · food supplies ↔ plankton blooms · irregular paths ↔ erratic offshore detours',
        explain: 'Key Task: predict (dự đoán), migration (sự di cư), unpredictable (khó lường). Phương pháp Khái quát ↔ Cụ thể: "whale movements" khái quát cho "whale migration"; "food supplies" khái quát cho "plankton blooms"; "irregular paths" diễn giải cho "erratic offshore detours" khiến dự báo truyền thống trở nên khó lường.'
      },
      {
        id: 't01_c10',
        type: 'mcq',
        method: 'Truy vết Reference words + Giọng văn tác giả',
        keyWords: ['rely', 'technique', 'superior'],
        excerpt: 'Modern precision agriculture relies heavily on satellite-guided irrigation techniques that adjust water delivery to each square meter of soil. While commercial suppliers market these digital tools as vastly superior to earthen terrace canals, field anthropologists note that the latter prevent hillside erosion far better during monsoon downpours without requiring imported batteries or software.',
        prompt: 'What does the writer emphasize by citing field anthropologists\' view of "the latter"?',
        options: [
          'Satellite irrigation techniques always outperform traditional water systems.',
          'Traditional earthen canals offer stronger erosion protection during heavy rains without high-tech upkeep.',
          'Farmers should stop relying on earthen canals because imported software is inexpensive.',
          'Commercial suppliers prefer earthen terraces over satellite sensors in monsoon regions.'
        ],
        answer: 'Traditional earthen canals offer stronger erosion protection during heavy rains without high-tech upkeep.',
        paraphraseLink: 'the latter ↔ earthen terrace canals · heavy rains ↔ monsoon downpours · high-tech upkeep ↔ imported batteries or software',
        explain: 'Key Task: rely (dựa vào), technique (kỹ thuật), superior (vượt trội). Phương pháp Reference word: "the latter" trỏ về đối tượng đứng sau là "earthen terrace canals" (kênh ruộng bậc thang bằng đất), không phải thiết bị vệ tinh được quảng cáo là "superior". Kênh đất chống xói mòn tốt hơn khi mưa lớn mà không cần pin hay phần mềm.'
      },
      {
        id: 't01_c11',
        type: 'mcq',
        method: 'Connection words (Nhân – quả) + Paraphrase cụm',
        keyWords: ['conservation', 'creature', 'environmental'],
        excerpt: 'Early wildlife conservation treaties concentrated almost exclusively on charismatic mammals while overlooking inconspicuous soil creatures such as earthworms and springtails. Yet because these subterranean invertebrates aerate roots and cycle nutrients, failing to address environmental degradation beneath the surface ultimately undermines the forests above.',
        prompt: 'According to the passage, why is neglecting small soil organisms harmful to woodland protection?',
        options: [
          'Small invertebrates compete directly with charismatic mammals for tree roots.',
          'Underground organisms perform nutrient and soil functions vital to forest health.',
          'Early conservation laws banned scientists from studying earthworms in woodlands.',
          'Surface environmental damage improves nutrient cycling only when mammals disappear.'
        ],
        answer: 'Underground organisms perform nutrient and soil functions vital to forest health.',
        paraphraseLink: 'Underground organisms ↔ inconspicuous soil creatures / subterranean invertebrates · nutrient and soil functions ↔ aerate roots and cycle nutrients · woodland protection ↔ conservation & forests above',
        explain: 'Key Task: conservation (bảo tồn), creature (sinh vật), environmental (thuộc môi trường). Phương pháp Nhân–quả ("because... ultimately undermines"): Các sinh vật đất làm thoáng rễ và tuần hoàn dinh dưỡng; bỏ qua suy thoái môi trường đất cuối cùng làm suy yếu cả cánh rừng.'
      },
      {
        id: 't01_c12',
        type: 'mcq',
        method: 'Sentence summarizing (Ý chính đoạn) + Hedging',
        keyWords: ['vision', 'reaction', 'parallel'],
        excerpt: 'Autonomous drone designers have begun studying dragonfly compound vision to build collision-avoidance sensors capable of millisecond reactions. Drawing a functional parallel between insect optic lobes and lightweight silicon chips looks promising in wind-tunnel tests; nevertheless, engineers warn that laboratory prototypes still falter when confronted with unpredictable rain glare and cluttered urban foliage.',
        prompt: 'What is the main point of this paragraph?',
        options: [
          'Dragonfly-inspired drone sensors have already solved outdoor urban obstacle avoidance.',
          'Bio-inspired sensor designs show lab potential but still struggle in messy real-world conditions.',
          'Insect optic lobes react too slowly to offer any useful parallel for silicon engineering.',
          'Rain glare primarily damages dragonfly compound eyes rather than electronic sensors.'
        ],
        answer: 'Bio-inspired sensor designs show lab potential but still struggle in messy real-world conditions.',
        paraphraseLink: 'Bio-inspired sensor designs ↔ dragonfly compound vision & functional parallel · show lab potential ↔ promising in wind-tunnel tests · struggle in messy real-world conditions ↔ falter with rain glare and urban foliage',
        explain: 'Key Task: vision (thị giác), reaction (phản ứng), parallel (điểm tương đồng). Phương pháp Sentence summarizing + Chuyển hướng "nevertheless": Nửa đầu khen cảm biến mô phỏng thị giác chuồn chuồn phản ứng nhanh trong thử nghiệm gió, nhưng nửa sau bẻ hướng cảnh báo mẫu thử vẫn chệch choạc ngoài môi trường thật.'
      }
    ],
    test3PassageV2: {
      id: 'p_task_01_v2',
      title: 'THE EVOLUTION AND SELF-DOMESTICATION OF DOGS',
      topic: 'Dog Domestication',
      wordCount: 294,
      paragraphs: [
        {
          label: 'A',
          text: 'A. Although dogs were undeniably the first animals to be domesticated by humans, recent archaeological discoveries and genetic sequencing have sparked a fundamental shift in how scientists explain this biological partnership. For decades, the standard view assumed that prehistoric hunters captured wild wolf cubs and raised them deliberately as camp guards. However, evolutionary biologists now question that top-down perspective, arguing instead for a dynamic two-way process in which wolves actively adjusted to human settlements rather than merely submitting to capture.',
          mainIdeaVi: 'Phát hiện khảo cổ và di truyền bác bỏ giả thuyết con người chủ động bắt giữ thuần hóa sói, mở ra góc nhìn tương tác hai chiều.',
          keyWords: ['domesticate', 'archaeological', 'genetic', 'fundamental', 'biological', 'perspective', 'dynamic']
        },
        {
          label: 'B',
          text: 'B. Under this alternative self-domestication model, the ecological pressure of Ice Age winters created an abundant food niche around semi-permanent human camps. Discarded bones, fat, and scraps attracted bold wolves willing to tolerate human proximity. Consequently, individuals carrying mild stress responses could feed reliably and adapt to settled camps without expending energy fleeing. Over generations, natural selection favored animals that developed calmer temperaments, gradually producing physical traits—such as floppy ears and shorter snouts—typical of domestic breeds today.',
          mainIdeaVi: 'Áp lực sinh thái và nguồn thức ăn thừa quanh khu trại giúp những con sói dạn dĩ thích nghi dần qua chọn lọc tự nhiên và hình thành đặc điểm chó nhà.',
          keyWords: ['ecological', 'adapt', 'domestic']
        },
        {
          label: 'C',
          text: 'C. Once these calmer proto-dogs lingered near human shelters, a distinct cooperative alliance began to dominate daily survival strategies. Early humans brought sophisticated projectile weapons and broad daylight coordination, whereas wolves contributed acute night hearing, tireless endurance, and scent tracking. Working together, mixed hunting bands consistently outperformed either species acting alone, while timely warning barks around campfires shielded human families from nocturnal predators such as cave bears.',
          mainIdeaVi: 'Liên minh hợp tác giữa con người (vũ khí tinh vi) và tiền thân loài chó (thính giác, sức bền) tạo lợi thế sinh tồn vượt trội.',
          keyWords: ['distinct', 'dominate', 'sophisticated']
        },
        {
          label: 'D',
          text: 'D. Nevertheless, paleogeneticists caution that self-domestication alone does not account for every lineage across Eurasia. Comparative DNA analysis indicates that as agricultural villages expanded, intentional breeding reshaped canine anatomy and behavior for specialized tasks such as herding and sled-pulling. Therefore, rather than a single abrupt event, canine history reflects a layered biological continuum—starting with opportunistic ecological tolerance and culminating in deliberate human stewardship that continues to evolve alongside modern society.',
          mainIdeaVi: 'Bên cạnh quá trình tự thích nghi ban đầu, việc lai tạo có chủ đích ở các làng nông nghiệp sau này tiếp tục định hình sự tiến hóa của loài chó.',
          keyWords: ['biological', 'ecological', 'evolve']
        }
      ],
      text: 'A. Although dogs were undeniably the first animals to be domesticated by humans, recent archaeological discoveries and genetic sequencing have sparked a fundamental shift in how scientists explain this biological partnership. For decades, the standard view assumed that prehistoric hunters captured wild wolf cubs and raised them deliberately as camp guards. However, evolutionary biologists now question that top-down perspective, arguing instead for a dynamic two-way process in which wolves actively adjusted to human settlements rather than merely submitting to capture.\n\nB. Under this alternative self-domestication model, the ecological pressure of Ice Age winters created an abundant food niche around semi-permanent human camps. Discarded bones, fat, and scraps attracted bold wolves willing to tolerate human proximity. Consequently, individuals carrying mild stress responses could feed reliably and adapt to settled camps without expending energy fleeing. Over generations, natural selection favored animals that developed calmer temperaments, gradually producing physical traits—such as floppy ears and shorter snouts—typical of domestic breeds today.\n\nC. Once these calmer proto-dogs lingered near human shelters, a distinct cooperative alliance began to dominate daily survival strategies. Early humans brought sophisticated projectile weapons and broad daylight coordination, whereas wolves contributed acute night hearing, tireless endurance, and scent tracking. Working together, mixed hunting bands consistently outperformed either species acting alone, while timely warning barks around campfires shielded human families from nocturnal predators such as cave bears.\n\nD. Nevertheless, paleogeneticists caution that self-domestication alone does not account for every lineage across Eurasia. Comparative DNA analysis indicates that as agricultural villages expanded, intentional breeding reshaped canine anatomy and behavior for specialized tasks such as herding and sled-pulling. Therefore, rather than a single abrupt event, canine history reflects a layered biological continuum—starting with opportunistic ecological tolerance and culminating in deliberate human stewardship that continues to evolve alongside modern society.',
      anchorWords: [
        'adapt',
        'evolve',
        'genetic',
        'sophisticated',
        'domestic',
        'ecological',
        'fundamental',
        'biological',
        'archaeological',
        'dominate',
        'distinct',
        'perspective',
        'dynamic',
        'domesticate'
      ],
      signalClues: ['Although', 'However', 'Consequently', 'whereas', 'Nevertheless', 'Therefore'],
      modelTranslation: 'A. Mặc dù chó chắc chắn là loài động vật đầu tiên được con người thuần hóa, những phát hiện khảo cổ học và giải trình tự di truyền gần đây đã tạo nên một sự chuyển dịch nền tảng trong cách các nhà khoa học lý giải mối quan hệ hợp tác sinh học này. Trong nhiều thập kỷ, quan điểm phổ biến cho rằng thợ săn tiền sử đã bắt sói con hoang dã và chủ động nuôi chúng làm chó canh gác trại. Tuy nhiên, các nhà sinh học tiến hóa hiện nay đặt nghi vấn trước góc nhìn áp đặt một chiều đó, thay vào đó lập luận về một quá trình hai chiều năng động, trong đó loài sói chủ động điều chỉnh để sống gần khu định cư của con người chứ không đơn thuần bị bắt giữ.\n\nB. Theo mô hình tự thuần hóa thay thế này, áp lực sinh thái của mùa đông Kỷ Băng Hà đã tạo ra một nguồn thức ăn dồi dào quanh các khu trại bán cố định của con người. Xương, mỡ và thức ăn thừa bị bỏ đi đã thu hút những con sói dạn dĩ sẵn sàng chấp nhận sự hiện diện của con người. Do đó, những cá thể có phản ứng căng thẳng nhẹ có thể kiếm ăn ổn định và thích nghi với các khu trại định cư mà không tốn năng lượng bỏ chạy. Qua nhiều thế hệ, chọn lọc tự nhiên ưu ái những cá thể có tính khí điềm tĩnh hơn, dần hình thành các đặc điểm cơ thể—như tai cụp và mõm ngắn hơn—vốn tiêu biểu cho các giống chó nuôi ngày nay.\n\nC. Một khi những cá thể tiền thân điềm tĩnh này ở lại gần nơi trú ẩn của con người, một liên minh hợp tác rõ rệt bắt đầu chi phối các chiến lược sinh tồn hằng ngày. Con người thời kỳ đầu mang lại vũ khí phóng tinh vi và khả năng phối hợp ban ngày, trong khi loài sói đóng góp thính giác ban đêm nhạy bén, sức bền dẻo dai và khả năng lần dấu mùi hương. Khi phối hợp cùng nhau, các nhóm đi săn hỗn hợp luôn vượt trội hơn hẳn khi từng loài hành động riêng lẻ, đồng thời tiếng sủa cảnh báo kịp thời quanh đống lửa giúp bảo vệ các gia đình trước những loài săn mồi ban đêm như gấu hang.\n\nD. Tuy vậy, các nhà cổ di truyền học lưu ý rằng chỉ riêng quá trình tự thuần hóa không thể giải thích toàn bộ các dòng chó trên khắp lục địa Á-Âu. Phân tích DNA so sánh chỉ ra rằng khi các làng nông nghiệp mở rộng, việc lai tạo có chủ đích đã tái định hình giải phẫu và tập tính của loài chó cho các nhiệm vụ chuyên biệt như chăn gia súc và kéo xe trượt tuyết. Vì vậy, thay vì một sự kiện đơn lẻ đột ngột, lịch sử loài chó phản ánh một tiến trình sinh học nhiều tầng—bắt đầu từ sự thích nghi sinh thái mang tính cơ hội và hoàn thiện bằng sự chăm sóc, chọn giống có chủ đích của con người vốn vẫn tiếp tục tiến hóa song hành cùng xã hội hiện đại.',
      modelSummaryVi: 'Các bằng chứng khảo cổ và di truyền hiện đại bác bỏ giả thuyết con người chỉ bắt giữ ép buộc sói hoang, thay bằng mô hình hai chiều gồm giai đoạn sói tự thích nghi quanh khu trại Kỷ Băng Hà để hưởng thức ăn thừa và hợp tác săn bắt bảo vệ con người, kết hợp với quá trình lai tạo có chủ đích ở các cộng đồng nông nghiệp sau này.'
    },
    test3Headings: {
      paragraphs: ['A', 'B', 'C', 'D'],
      headings: [
        { id: 'i', text: 'Complementary strengths that turned coexistence into a shared survival advantage' },
        { id: 'ii', text: 'Questioning the assumption that human captors initiated canine taming' },
        { id: 'iii', text: 'Why cave bears avoided human shelters after farming emerged' },
        { id: 'iv', text: 'How floppy ears improved wolves\' hearing during night hunting' },
        { id: 'v', text: 'How camp leftovers and natural selection reshaped behavior and appearance' },
        { id: 'vi', text: 'Proof that ancient hunters eliminated timid wolves across Eurasia' },
        { id: 'vii', text: 'Combining early natural adaptation with later selective breeding by agricultural groups' }
      ],
      answers: {
        A: 'ii',
        B: 'v',
        C: 'i',
        D: 'vii'
      },
      explanations: {
        A: 'Đoạn A đặt nghi vấn ("question that top-down perspective") về giả thuyết cũ rằng người tiền sử chủ động bắt sói để thuần hóa -> khớp với heading ii.',
        B: 'Đoạn B giải thích thức ăn thừa ("discarded bones, fat, and scraps") và chọn lọc tự nhiên tạo tính khí điềm tĩnh & đặc điểm hình thể (tai cụp, mõm ngắn) -> khớp với heading v.',
        C: 'Đoạn C mô tả sự bù trừ giữa vũ khí tinh vi của người và thính giác/sức bền của sói tạo ưu thế sinh tồn chung ("outperformed either species acting alone") -> khớp với heading i.',
        D: 'Đoạn D kết hợp quá trình tự thích nghi sinh thái ban đầu với việc lai tạo có chủ đích khi làng nông nghiệp mở rộng ("agricultural villages expanded, intentional breeding") -> khớp với heading vii.'
      }
    },
    test3Summary: {
      textBlank: 'Recent (1) ______ and DNA studies challenge the traditional view that prehistoric hunters captured wolf pups to (2) ______ them directly. Instead, scientists propose an alternative (3) ______ in which bold wolves scavenged near campsites during harsh winters. Lower stress levels helped these animals (4) ______ to human proximity, gradually leading to calmer temperaments and physical features common in (5) ______ dogs. Later, early humans and proto-dogs formed a cooperative partnership that brought (6) ______ defensive and hunting advantages before agricultural communities began deliberate breeding.',
      blanks: [
        {
          id: 's1',
          slotNum: 1,
          answer: 'archaeological',
          keyWord: 'archaeological',
          pos: 'Tính từ',
          meaning: 'thuộc về khảo cổ học',
          explain: 'Trước cụm danh từ "and DNA studies" cần một tính từ song song với DNA -> archaeological (đoạn A).'
        },
        {
          id: 's2',
          slotNum: 2,
          answer: 'domesticate',
          keyWord: 'domesticate',
          pos: 'Động từ',
          meaning: 'thuần hóa',
          explain: 'Sau "to" là động từ nguyên mẫu chỉ hành động thuần hóa sói con -> domesticate (đoạn A).'
        },
        {
          id: 's3',
          slotNum: 3,
          answer: 'perspective',
          keyWord: 'perspective',
          pos: 'Danh từ',
          meaning: 'góc nhìn, quan điểm',
          explain: 'Sau "an alternative" cần danh từ số ít tương đương với "model / view" -> perspective (đoạn A–B).'
        },
        {
          id: 's4',
          slotNum: 4,
          answer: 'adapt',
          keyWord: 'adapt',
          pos: 'Động từ',
          meaning: 'thích nghi',
          explain: 'Cấu trúc "helped these animals [V] to human proximity" -> adapt to (đoạn B).'
        },
        {
          id: 's5',
          slotNum: 5,
          answer: 'domestic',
          keyWord: 'domestic',
          pos: 'Tính từ',
          meaning: 'đã thuần hóa / nuôi trong nhà',
          explain: 'Bổ nghĩa cho danh từ "dogs" ở cuối câu -> domestic dogs (đoạn B).'
        },
        {
          id: 's6',
          slotNum: 6,
          answer: 'distinct',
          keyWord: 'distinct',
          pos: 'Tính từ',
          meaning: 'rõ rệt, khác biệt',
          explain: 'Bổ nghĩa cho cụm danh từ "defensive and hunting advantages" -> distinct (đoạn C).'
        }
      ],
      wordBox: [
        { key: 'A', text: 'perspective', role: 'answer' },
        { key: 'B', text: 'archaeology', role: 'wf_trap', note: 'Bẫy từ loại (Word Family): "archaeology" là danh từ, chỗ trống (1) đứng trước "and DNA studies" cần tính từ archaeological.' },
        { key: 'C', text: 'adapt', role: 'answer' },
        { key: 'D', text: 'aggressive', role: 'dist', note: 'Từ nhiễu trái ngữ cảnh: bài đọc nói sói trở nên điềm tĩnh (calmer), không phải hung dữ hơn.' },
        { key: 'E', text: 'domestic', role: 'answer' },
        { key: 'F', text: 'domesticate', role: 'answer' },
        { key: 'G', text: 'isolation', role: 'dist', note: 'Từ nhiễu trái ngữ cảnh: bài nhấn mạnh liên minh hợp tác, không phải sự cô lập.' },
        { key: 'H', text: 'distinct', role: 'answer' },
        { key: 'I', text: 'domestically', role: 'wf_trap', note: 'Bẫy từ loại (Word Family): "domestically" là trạng từ, trước danh từ "dogs" ở (5) cần tính từ domestic.' },
        { key: 'J', text: 'archaeological', role: 'answer' }
      ]
    }
  }
};
