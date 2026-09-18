# Mother 协调核查：Farmland R045.39 的方向与拓扑接续

ID：MOTHER-20260919-0230-FARMLAND-N24  
状态：完成有限主持整理；未举行多人会谈，未召集专家。

## 实际时刻、参与与授权

北京时间 2026-09-19 **02:31:01–02:35:08（UTC+8），4分7秒**，归档另计。实际启动在允许窗口，完成即收束，未等回签或凑时长。

主持 /root；真实 Mother 新接收/回复证据为零，实际参会 Mother 为0；第一梯队专家未调用，因为本轮是 Mother 协调，不以临时专家替代。工具可读 GitHub 发布记录和 PR 评论，没有任意会话ID完整历史读取或跨任务投递接口；旧会话和本地新窗口ID均未冒称接通。未读取 G: 或本地小妈接口卡，未声称收到不可读照片。

“世界交响曲”指定核心讨论已在[9月17日纪要](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/MEETINGS/2026-09-17/MOTHER_0230_WORLD_SYMPHONY.md)完成有限主持整理。本轮只接续真实形态关系问题，不重复口号；一次性延长例外未启用。

## 读取顺序与固定版本

1. 协调分支 HEAD：`1f867d7424db6b7d6b4075c5055b7cf179432d47`；完整递归树未截断，没有本日期已完成 Mother 纪要。
2. [上一轮专家成果](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/MEETINGS/2026-09-18/EXPERT_FARMLAND_ASPECT_0300.md)：已完成，不重排 N20 或 SL003。
3. N21–N24 Current Best View，N24 完整学习记录、探针源码、队列及路由。
4. Farmland PR65 当前 HEAD：`3b05ad43fbd920e9ff0a964a6f8e72dc5f20419a`，读取当前 R045.39 核心代码、完整报告、数值与浏览器回执、CURRENT_FULL_HANDOFF.json；PR评论返回10条，最新为 N24 已投递指导，没有其后的显式确认。
5. Landscape PR79 当前 HEAD：`10399e2b7ebe7c7754a3de77ace6e65bfee36b3d`，只读 G4 build/runtime QA 记录；未跑浏览器或读全量网格。
6. 根 AGENTS、PRODUCTION_CONTRACT 与 PUBLIC_WEB_DELIVERY_GATE：固定真值、禁令、冻结与公网验收规则保持。没有发布新工作台。

本轮读取的是可核实的相关线，不宣称已检查全部九个 Mother 的最新状态。Weather、Ocean、温州、Skin、Object DNA、Tiles、Brick没有新参会/采用证据，也未因本题被广播。

## 消化上一轮专家成果，不把理论当生产完成

N20 专家成果将四类命题分开：保留样点、固定差分连续求值域、连续高度导数、实际网格/着色法线。固定步长差分可能漏掉某些解析变化；排除区域不等于通过；有条件上界未能证明通过也不等于证明失败。

这些结论影响 N24：N24 的“局部等高线切向”来自 R30 的差分梯度，是带版本、尺度和低梯度限制的诊断，**不能拿它未经验证地替代生产世界 X 邻域，再宣布拓扑正确**。上一轮条件性证书尚无实际常数/误差界回执，本轮不声称已落地。

## 真实新增状态：R045.39 已有实现，但问题尚未闭合

### Farmland 当前实现与回执

[当前 R39 报告](https://github.com/haihao0307/guilin-dem-pipeline/blob/3b05ad43fbd920e9ff0a964a6f8e72dc5f20419a/farmland-object-dna/research/r045-autonomous-rebuild/round-39/R045_ROUND39_REPORT.md)及[源码](https://github.com/haihao0307/guilin-dem-pipeline/blob/3b05ad43fbd920e9ff0a964a6f8e72dc5f20419a/farmland-object-dna/research/r045-autonomous-rebuild/round-39/r045_round39_kernel.mjs)显示：

- 延长已有 R38 同族阶地弱支撑，使用同一侧连续两个活跃邻居，非递归增加一个6m壳层；保留 step/phase/raw 和0.84幅度，不靠抬高台阶改善远景。
- 当前 stableSide 明确读取 `(x±6,z)` 和 `(x±12,z)`。世界 X 轴依赖是本轮直接源码观察，不只转述旧报告。
- 当前[数值回执](https://github.com/haihao0307/guilin-dem-pipeline/blob/3b05ad43fbd920e9ff0a964a6f8e72dc5f20419a/farmland-object-dna/research/r045-autonomous-rebuild/round-39/r045_round39_qa_result.json)报告32/32通过：原审计域活跃样本520→529，9个跨活动阈值，既有活跃样本 mask/delta不变；横向行数77→77，最长带中位数54→60m。以上仍是声明网格与指标上的回执，不是二维等高线分支/合并证明。
- 报告保留了初轮数值运行超时、次轮结果持久化推送遇到分支前进、最终工作流成功的经历；本轮只是读取，没有重演这些运行。
- [浏览器回执](https://github.com/haihao0307/guilin-dem-pipeline/blob/3b05ad43fbd920e9ff0a964a6f8e72dc5f20419a/farmland-object-dna/research/r045-autonomous-rebuild/round-39/r045_round39_browser_result.json)记录真实 Chrome 启动通过；报告称固定主视角 A/B 仍几乎难区分，采样最大 R38→R39高差约0.01409m。本轮没有重新打开页面、查看截图或完成固定公网/设备验收，因此不把历史回执算新验收。
- **当前源码** terraceGeometryEnabled=true、terracePilotPreviewEnabled=true；visualAcceptance=false、parcelGenerationEnabled=false、waterStateKnown=false、productionReady=false。不能把较早“梯田几何未启用”检查点覆盖当前已实现候选；也不能把预览启用当用户接受或水力解锁。
- 当前[CURRENT_FULL_HANDOFF.json](https://github.com/haihao0307/guilin-dem-pipeline/blob/3b05ad43fbd920e9ff0a964a6f8e72dc5f20419a/farmland-object-dna/CURRENT_FULL_HANDOFF.json)仍指向 R025 恢复包。该入口不是 R39 全量包证明；本轮不从这个旧包重开，也不声称所有分发入口都已检索。

### N21–N24 的证据应分别保留

- [N21](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW_N21_FARMLAND_TERRACE_CUT_FILL.md)：面积加权挖填与相位收敛，不能以一次净值近零冒充土体守恒。
- [N22](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW_N22_FARMLAND_TERRACE_FAMILY_JUNCTION.md)：平滑支撑不保证硬选族后高度连续；已量化高程混合会改变层级语义。
- [N23](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW_N23_FARMLAND_STITCH_BOUNDARY.md)：软形态许可边界的增量应闭合；不能同时抹平硬排水中断或有意台阶。
- [N24](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-09-19_FARMLAND_CONTOUR_DIRECTION_N24.md)：旧固定 R39 源码 `3f7eaf4f12a07d26c67c8e4659d8eceff5c691d5` 的10个诊断样本中6个与局部切向偏差>30°，最大52.1135°；两单元支撑旋转90°会改变 X 轴分类结果。探针和报告本轮已读，8/8 CPU/CI属于原报告，未在本轮重跑。

版本限制很重要：本轮比较固定旧源与当前 head 的 Git blobs，R30、R38 核心相同，R39 核心不同（当前加入缓存及说明等）。因此 N24 的具体数值继续归属于其固定旧源，不未经重放改贴当前 head。当前源码依然使用 X 轴邻域，可支持同一方向依赖问题仍值得接续，不能据此自动宣称全部旧数值逐位复现。

### Landscape 只更新证据层级，不拉入本题生产

[G4 build](https://github.com/haihao0307/guilin-dem-pipeline/blob/10399e2b7ebe7c7754a3de77ace6e65bfee36b3d/workbenches/landscape-surface-r5-k2-geometry-r4/build.json)与[runtime QA](https://github.com/haihao0307/guilin-dem-pipeline/blob/10399e2b7ebe7c7754a3de77ace6e65bfee36b3d/workbenches/landscape-surface-r5-k2-geometry-r4/runtime-qa.json)记录源场在 meshing 前参与岩体和土壤，另有 fieldCoupled=false 的次级网格细节。源场变体采样最大偏移约0.3343m、土壤约0.08563m；主/土壤签名随对应变体改变，visualApproved/productionReady仍false。

它们支持“已有源场/网格变化的实现回执”，不支持“周期接缝、宏形保留、地质成因、碰撞一致性、视觉表现均已验收”。本轮不沿用 G3 旧限幅百分比评价 G4，也不把 N24 的 Farmland 局部规则群发 Landscape/Brick。

## 有条件协调结论与不同解释

本轮只向共享记录增加以下 Farmland 接续说明，不重复已送达 PR65 的 N24 指导：

1. 保留横向行指标，但将其命名为轴向采样诊断；它能描述该行族的改善。
2. “沿地形等高线延续”“真实二维分支合并”“主视角可读性”是不同目标，应各有证据，不由行长度一项代替。
3. 局部切向是可研究的方向信息，不是保证正确连接的万能解；低梯度、弯曲路径、不同族层级及硬排水边界仍需要明确处理。
4. 只旋转坐标表达/抽样轴，与真正转动地形相对于排水/重力/外部约束不同；未来负对照必须说明所有输入如何一起变换，避免把物理不同案例误叫表示不变性。
5. 数值/浏览器通过、源码增长、投递评论都不等于用户已接受或 Mother已理解采用。

真实解释差异：R39报告明确不声称“碎裂指标降低即可证明分支/合并正确”，这一自限必须保留，不能指控它做了相反承诺。但源码关于“contour ribbons”的表述和 X-only 邻域之间仍有待定义的范围；N24诊断识别的是这个缺口，而不是宣布整版无价值或必须改成切向追踪。

责任消费者：Farmland Mother负责已有授权内的实现与回执；小妈负责限定知识结论。当前未取得实际回复，不代其承诺实现。

## 下一场专家有限待议包

编号：**KAOPU-Q-FARMLAND-CONTOUR-RELATION-20260919**  
状态：**queued / 仅为下一场专家会排队，不要求现在开会**。没有在本轮求解或召集专家，空题不计成果。

**目标**：在一段弯曲坡面、两个阶地族和一个必须保留的排水断口上，确定“正确延续”的最小可检查关系；区分轴向行延长、局部切向支持与保留族/层级/断口的二维邻接。只讨论有限接续判据，不设计全域新格式。

**背景与已有证据/版本**：N24固定旧 R39 `3f7eaf4...` 的旋转分类反例；本轮当前 R39 `3b05ad4...` 的 stableSide源码仍为X-only、当前报告承认分支/合并未解决；已完成 N20 专家关于差分/连续导数/网格及低梯度不确定性的边界；N22多族层级与N23硬/软边界结论。没有区域测量拓扑或Mother共同采用。

**竞争解释**：
- A：同族且阶梯兼容的固定 X 两邻居足以表达本任务局部延续，前提是明确该有限任务范围。
- B：改为局部差分切向采样即可获得任务所需延续。
- C：方向支持之外，仍需要声明族/层级对应、断口许可和二维连接关系；局部切向/网格图各只是实现手段。
不按算法名称偏好选胜者；允许在受限输入上等价、或仍无法保证。

**关键约束**：不改冻结地形或生产阈值；不抬高台阶制造可见性；硬排水断口不可被平滑/连接越过；不从照片补造米制尺寸/水状态；不把近水平/临界点填成确定方向；以非空有限范围比较，不冻结通用拓扑格式。

**区分依据/完成判据**：提出一个同一几何仅换坐标表示的有限对照、一个“切向局部支持存在但目标连接关系仍不成立”的反例或严格不足说明；列出可通过、可反驳和必须Unknown的最小信息。需要明确方向、连接、层级与真实物理事件/排水约束何者保持。保持N20差分算子与连续导数区别，不重复其旧反例作为新成果。

**下一验证触发点**：会前重读 Farmland最新源码/显式回复；若已有正确限域或版本化二维回执，优先审其具体新问题。若只有旧采样报告，以上理论题可保持排队，不反复催各Mother证明已知局限。提出判据不等于生产执行或视觉验收。

## 状态、未执行项与共享

- Observation：本轮只读当前源码、版本、已有CPU/Chrome回执和评论；无新物理观测、CPU全量重放或浏览器验收。
- Candidate：N21–N24方法与新待议包；不晋级为已实施或共同采纳。
- Current Best View：当前R39对其轴向样本有实质改进，但二维族/层级/断口关系和主视角表现尚待证据。
- Frozen：Canonical Truth、固定几何及用户冻结保持；无新冻结格式。
- Rejected：用源代码更新推断理解/采用，用一维统计代替二维拓扑验收，用理论图形不变性覆盖真实物理约束。
- Unknown：适用方向尺度、低梯度阈值、弯曲/临界点连接、独立设备表现、用户视觉接受、各Mother回执。
- N24[已有一次送达](https://github.com/haihao0307/guilin-dem-pipeline/blob/1f867d7424db6b7d6b4075c5055b7cf179432d47/docs/mother_coordination/kaopu_learning_flywheel_v1/MOTHER_ROUTING_N24_FARMLAND_CONTOUR_DIRECTION.json)且未确认；本轮不重复发信、不群发。
- 未修改任何生产分支、固定输入、网页、计划/提示/启用/本地03:15接续或两小时飞轮。仅追加本有限纪要，写前重读远端，固定提交回读后才称已共享。

原始方法资料于2026-09-19实际复核：[SideFX Terrace](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_terrace.html)区分台面和阶缘mask；[Flow Field](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_flowfield.html)提供方向场。它们不是R39正确拓扑、云南实测或阈值依据；没有导入其工具或恢复GAEA路线。
