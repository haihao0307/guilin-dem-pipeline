# 毛发生长分区：用于独立 3D 工作台的证据边界

研究日期：2026-10-10。以下为原创摘要与程序转译建议，不是医疗建议；未下载、复制或再发布论文图像。数字采样预算与 mask 阈值应标注为演示参数，不代表人体统一标准。

## 可直接落地的结论

1. 头皮应先有连续的承载表面和覆盖 mask，再按局部密度采样发根。顶、额、颞、枕的密度不能只用一个全局常数；不同健康研究的排序也不完全一致。低密度不等于把整个耳上侧区挖空。
2. 耳廓是独立解剖结构，排除在“头皮长发发根”mask 外；耳上、耳后依然有头皮，不能用正面投影中耳朵的宽矩形一刀切掉它们。模型应按表面语义/局部距离排除耳廓，头皮边界绕耳根前上后走向连接枕部。这里的连续拓扑实现是工程推断，精确自然发际高度必须由具体人物参考决定。排除 scalp hair 不表示人体耳部完全无毛。
3. 发旋以位置、数量、旋向为独立参数；它定义发根附近的切线方向，不是所有长发发梢必须绕成圆环。单旋可作一个默认，不能声称人人如此。
4. 眉毛分眉头、眉身、眉尾：眉头较直立；眉身下缘向外上、上缘向外下，汇聚于眉轴；眉尾更向外、渐细。眉头不能同眉尾一样整片水平扫过去。方向与密度均须支持个体变化。
5. 胡须将上唇、唇下、下颏、两颊、下颌/颌下、鬓角分开控制 coverage 与局部密度，再平滑拼接；允许上唇/下颏有毛但两颊稀少，允许鬓角与颏须之间不连接。不能用一个全脸环形 mask 填满。

## 一手研究与专业解剖资料

### A. 健康头皮区域差异（自然观察）
- Evaluation of Hair Density and Hair Diameter in the Adult Thai Population Using Quantitative Trichoscopic Analysis (2020).
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7035527/
- 健康成人的额、顶、颞顶、枕区分别测量；该样本颞顶较稀、顶部较密。用途：支持分区 density field；不要照搬研究均值作为所有人物固定密度，也不要混淆 hairs/cm² 与 follicular units/cm²。全文此次 open 返回验证页，检索索引提供研究方法与结果，故不依赖其未读取细节。

### B. 健康女性头皮的独立重复证据（自然观察）
- Trichoscopy in Healthy Adult Egyptian Females: Normal Values of Hair Measurable Parameters (2022).
- https://pmc.ncbi.nlm.nih.gov/articles/PMC9672870/
- 90名健康成人女性：额、颞、枕的密度与毛囊单位分布存在分区差异；颞部最稀。文章讨论不同人群研究的密度排序不完全一致。用途：给各区可调倍率，不给“全球正常密度”或固定比例。

### C. 发旋（原始病例对照研究中的对照观察）
- Scalp hair whorl patterns in patients affected by Neurofibromatosis Type 1: A case-control study (2020).
- https://pmc.ncbi.nlm.nih.gov/articles/PMC7362971/
- 研究记录发旋数量、位置、旋向；501名儿童对照中存在单旋、双旋和少数其他形态。只能使用对照的形态多样性支持模型参数，不把儿童临床样本比例泛化到成人总体，更不从发型推断疾病。
- 程序：局部 tangent plane 中构建带可调旋向的发旋场，再与额部/侧部/枕部导向平滑混合；顶旋附近保留毛发，避免把奇点做成大秃洞。插值方法、旋转强度均为工程设定。

### D. 头皮与耳廓的解剖边界（专业解剖条目）
- Anatomy, Head and Neck, Scalp, StatPearls.
- https://www.ncbi.nlm.nih.gov/books/NBK551565/
- 将头皮作为覆盖颅骨的软组织区域，描述耳后头皮及其神经/淋巴联系。解剖头皮范围不是精确的终毛发际 mask。
- External Ear Anatomy, StatPearls.
- https://www.ncbi.nlm.nih.gov/books/NBK470359/
- 耳廓由皮肤覆盖的软骨结构与耳垂等构成；外耳道软骨段具有毛囊。这支持把耳廓与头皮分开建模，而不支持“耳朵没有毛”的绝对说法。
- 工程：ear mesh 不接收 scalp root；scalp mesh 上的 supra-/retroauricular 区可接收。耳根附近用局部曲线和软边界控制，不用 world-space 大洞。鬓角与颞区衔接须按各人物设计，不强制与胡须连通。

### E. 眉毛解剖与方向（临床重建论文，非总体统计）
- The Science and Art of Eyebrow Transplantation by Follicular Unit Extraction (2017).
- https://pmc.ncbi.nlm.nih.gov/articles/PMC5561712/
- 解剖段描述眉头较直立，眉身上下缘向中轴汇聚形成类似人字纹，眉尾较疏且毛径较细。文中的“理想眉型”及移植参数是临床审美/重建方案，不应转为天然眉型定律。此次全文 open 为验证页；所用解剖段完整见检索索引。
- 交叉核对：Hair Transplant for Eyebrow Restoration (2021), https://pmc.ncbi.nlm.nih.gov/articles/PMC8719974/ 。描述不止一种天然眉方向图式，支持把汇聚强度/眉头竖直度留作参数。
- 程序：眉轴局部坐标 s（内至外）、t（下至上），方向在眉头趋竖直，眉身结合向外分量与指向中心轴分量，眉尾以向外分量为主。密度在主体较高、边缘和尾部渐变，不能把三段画成三块硬边补丁。此数学实现为原创近似。

### F. 两颊与下颏密度不可绑定（自然实测，非植发建议）
- Floyd et al., Influence of facial hair length, coarseness, and areal density on seal leakage of a tight-fitting half-face respirator (2018).
- https://stacks.cdc.gov/view/cdc/211291/cdc_211291_DS1.pdf
- 19名有胡须受试者的面颊与下颏区域实测：多数受试者下颏密度较高，但并非全部；两处密度相关性弱。该小样本足以反驳“全脸同密度”或“两颊由下颏密度唯一推算”，不足以提供普遍精确值。本文主旨为呼吸防护，本工作台仅使用毛发区域测量事实，不输出任何防护或安全结论。
- 程序：cheekDensity、chinDensity 独立；overallDensity 只能作共同缩放。保留稀颊/浓颏及其他自定义组合。

### G. 自然胡须覆盖分型（专业组织发表的原始临床观察，有抽样偏倚）
- Morphological Classification of Beard Hair in Men, Hair Transplant Forum International 34(5), 2024, ISHRS.
- https://www.ishrs-htforum.org/content/34/5/157.full
- 官方刊物PDF备用：https://ishrs.org/wp-content/uploads/sites/3/2024/09/F5-2024-ISHRS.pdf
- 250名移植诊所男性来访者的术前形态观察，不是随机人群。记录中央与周边毛区发育不同、连接缺失及颌下空隙等，另有中央区域较稀的变体。用途：支持独立 coverage 与连接参数，不能把其类型比例当人群频率或把分型当人人必经生长时间表。
- 该页明确限制复制/分发/修改其内容及图片；仅链接、原创概括事实，勿下载或模仿其人物照片/图表来发布。

### H. 胡须方向辅助参考（临床重建论文，低于自然测量证据）
- Beard and Moustache Reconstruction (2021).
- https://pmc.ncbi.nlm.nih.gov/articles/PMC8719972/
- 其解剖/设计描述鬓角以向下为主、面颊斜向下外，中央与侧面分区。可用作演示方向场的起点；具体切口角度、移植密度和“理想”边线是手术设计，不是自然恒定数值。
- 程序：上唇以向下/两侧轻分流为可调默认；颏部以向下为主；颊与鬓角沿面部切线平滑衔接。上唇细节、颌下旋向、左右差异未获足够统一证据，须明确是可调艺术近似，不能标注“科学还原”。

## 可检验的实现标准（工程验收，不是医学标准）
- 发根位置在对应皮肤表面，长发不能从耳廓/眼球/嘴唇内侧长出。
- 左右耳上、耳后至枕部在完整头皮预设中连续；侧视和后视均检查，不能只用正面截图。
- 模型稀疏区保留较低采样概率而非未经解释的硬洞；发际/眉缘/胡须外缘平滑羽化。
- 局部方向场为表面切向量，加小的离面生长分量；长束弯曲、重力和造型另行处理。
- regionWeight、coverage、root density、strand thickness、length 分离；“看起来浓”不等同于发根多。
- 固定随机种子供前后对比；更换种子不能掩盖分区错误。
- 保持个体差异：左右不必镜像，眉尾不必同长，须区不必相连；默认值须标“演示预设”。


R02 audit corrections: density weights are continuously blended and accepted at the actual barycentric point (fixed 18,000 roots), rather than assigned by triangle centroid. Beard support paths are clipped to their root-origin region, including full-beard mode; a 2 micrometre inward path margin reduces Float32 boundary drift. This conservative rule can shorten hairs at region transitions. Pinna exclusion remains a reviewed coordinate approximation, not a topology-labelled ear or collision guarantee. Region tests verify consistency of that approximation; they do not establish anatomical clearance. Nested diagnostics describe the neutral template; per-layer root gaps measure the current displayed pose. The active Fiber material owns displayed appearance, and its radius diagnostics supersede legacy strand-material defaults.
