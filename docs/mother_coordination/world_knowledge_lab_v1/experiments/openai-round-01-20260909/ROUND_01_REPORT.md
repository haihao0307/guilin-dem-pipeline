# WORLD SCORE / TLO OPENAI PILOT ROUND 01

日期：2026-09-09

状态：第一轮流程实验完成，等待用户与小妈复盘

实验分支：`experiment/world-score-tlo-openai-round-01-20260909`

冻结输入：

1. `WORLD_SCORE_TLO_SEMANTIC_CHARTER_R1_20260909.md`
2. 固定提交 `cd9160ce90cd1c6c6a49f4fbb2ae1f2c55470330`
3. `WORLD_SCORE_TLO_R1_OPENAI_REDTEAM_R1_20260909.md`
4. 固定提交 `12bf33ab3c0ecdb576cdb6b608c1e8e9f6748bb0`

本轮边界：

1. 不调用 Anthropic 或 Claude Code。
2. 不修改 R1 冻结文件。
3. 不修改任何生产 Mother。
4. 使用当前 OpenAI GPT-5.6 Sol 做六个上下文隔离的审查视角，再做三次交叉攻击和一次 Judgment。
5. 六个视角来自同一个 OpenAI 模型，因此本轮验证的是工作流程、语义拆解和验证器，不能视为六个真正独立模型的意见。
6. 真实历史资料尚未接入，本轮使用明确标注为 synthetic fixture 的翠湖历史建筑微型案例，防止测试内容被误认成真实昆明史料。

## 1. Problem Contract

本轮总问题：

一套最小共同语义，能否同时表达一栋历史建筑的多次独立观测、同源复制、位置有误但社会关系有价值的回忆、跨时间对象身份、现代同址新建物、AI 重建、未知面，以及一个可重算的 Current Best View。

成功条件：

1. 原始资产、来源事件、观测、陈述、世界对象和当前视图必须分层。
2. 同源复制不能增加独立观测数量。
3. 共享标定和系统误差不能被隐藏。
4. 回忆中的空间错误和社会关系信息可以分别保留。
5. Unknown、Not Observed、Observed Absent 和 Not Applicable 具有不同含义。
6. 现代同址建筑不能自动继承历史建筑身份。
7. AI 重建必须携带生成身份，不能作为1940年代原始证据。
8. 任何进入 Current Best View 的陈述都能追溯到观测、方法、假设和不确定性。
9. R1 冻结点保持原样。
10. 本轮所有机器检查必须通过。

停止条件：

1. 发现需要改写 R1 冻结文件时停止并改用候选补丁。
2. 发现语义需要依赖某种固定编码时停止并重新检查层次。
3. 发现测试资料可能被误认为真实历史时停止。
4. 发现无法区分证据资产和被描述对象时停止。

## 2. 六个 AGO 审查视角

### AGO 01：最小语义与标准继承

结论：

R1 的方向稳定，核心仍应保持很小。最小系统需要区分七类一级实体：

1. World Object
2. Source Event
3. Evidence Asset
4. Observation
5. Claim or Assertion
6. Process or Transformation
7. World View

最关键新增项是 Claim。照片本身只是一项资产，按下快门是一项 Source Event，从照片读取到屋顶轮廓是一项 Observation，“1944年这里存在一栋建筑”是一项 Claim。几层混写以后，后续算法无法重新解释旧证据。

建议继续继承 SI、现有空间参考、时间标准、W3C PROV 类来源语义和 OGC 类观测关系。TLO 只补跨时间身份、多尺度总谱和跨标准连接处的空缺。

### AGO 02：时间、对象身份与变化

结论：

单一 Time 字段不足。最少需要保留：

1. World or Valid Time
2. Observation Time
3. Source or Asset Creation Time
4. Represented Time
5. Ingest or Transaction Time
6. Processing Time

对象身份也不能只靠永久 ID 强行维持。旧屋拆除后原址新建、庙宇重建、河流分叉、房屋拆分都要求关系化表达：

`samePhysicalContinuant`

`successorOf`

`reconstructionOf`

`splitFrom`

`mergedFrom`

`occupiesSameSiteAs`

`partOfAtTime`

身份判断自身也应成为 Claim，并携带证据和不确定性。

### AGO 03：证据独立性与来源图

结论：

独立性需要通过依赖图和共享误差结构表达。一个简单分数无法承担长期防污染任务。

建议至少区分四个轴：

1. Observation independence，是否来自不同观测事件。
2. Source independence，是否共享同一底片、地图、口述或档案。
3. Calibration independence，是否共享相机标定、控制点、基准和测量程序。
4. Processing independence，是否由相同算法、模型和参数生成。

只有存在充分依据时才声明 `independentOf`。通常更可靠的做法是记录 `copiedFrom`、`derivedFrom`、`transformedFrom`、`sharesSourceWith`、`sharesCalibrationWith` 和 `sharesAssumptionWith`，再由查询规则计算有效独立根数量。

### AGO 04：历史、人类记忆与观察者世界

结论：

历史总谱需要同时容纳 Physical World 和 Perceived World。

一张1978年回忆1944年翠湖的手绘图，空间关系可能偏移二十多米，同时仍可能准确保留邻居姓名、房间用途和饭馆位置。可靠程度需要落实到字段和 Claim，不能给整份资料一个笼统分数。

主观记录可以支持两类陈述：

1. 关于物理世界的陈述，例如某栋建筑当时可能是饭馆。
2. 关于观察者状态的陈述，例如该观察者在1978年怎样记忆1944年的街区。

第二类陈述本身具有历史价值。系统应保留冲突，不强制把所有观察者压成单一叙述。

### AGO 05：尺度、频谱、压缩与时间演奏

结论：

Scale 是普遍语义，Spectrum 适用于连续场和可频谱化结构。

地形、屋顶轮廓、材质、声音、流体和表面变化可以采用低频主体、局部高频修正和 residual channel。邻居是谁、店铺名称和人的回忆属于离散关系，继续用关系图和事件表达。

建议把世界视图理解为按查询生成的演奏结果：

`View = Resolve(Evidence Graph, Claims, Query, Policy, AsOfTime, Resolution)`

同一证据可以依据查询时间、空间尺度、分辨率和验证政策生成不同视图。每个视图必须记录政策版本和 transaction time，才能重演。

### AGO 06：污染、伪历史与对抗性输入

结论：

最危险的污染路径包括：

1. 一份原始资料复制成一千份，随后被误计为一千次确认。
2. 多个来源共享同一错误地图基准或错误年代标签。
3. AI 重建流回训练集，再被当成原始1940年代资料。
4. 档案没有记录被误写成现实中不存在。
5. 同址新建的传统风格建筑被错误继承为历史建筑。
6. 一个很高的总置信分掩盖背立面、颜色和室内仍然未知。
7. 当前最佳视图被长期误认成不可修订真值。

因此必须分开 Asset Authenticity、Claim Support、World View 和 Historical Identity。合规签名可以验证资产来源链，仍需独立评估资产所支持的世界陈述。

## 3. 三次交叉攻击

### Critic 01：本体膨胀攻击

攻击：

如果每个领域都把自己的全部词汇放进核心，TLO 会迅速变成无法实现的巨型本体。

Judgment：

接受攻击。核心维持极小，领域语义进入 typed extension。第一阶段核心只保留 Identity、Space and Frame、Time、Scale、Quantity or State、Relation、Observation、Claim、Provenance、Uncertainty、Change 和 View。

### Critic 02：伪独立攻击

攻击：

不同摄影师、不同机构、不同文件都可能共享同一上游地图、控制点、相机、任务计划、档案误标或 AI 模型。因此“来自不同人”不能自动推导独立。

Judgment：

接受攻击。独立性不手填单一分数。系统保存依赖边、共享校准组、共享假设组和观测根。查询时依据具体 Claim 计算有效独立证据。

### Critic 03：可操作性攻击

攻击：

Current Best View 如果没有查询范围、分辨率、政策版本和 as of transaction time，相同资料在不同系统中仍可能生成互相矛盾的结果。

Judgment：

接受攻击。任何 View 至少携带 represented time、query scope、resolution、policy ID、policy version、processing time 和 as of transaction time。视图属于可重算产物，原始观测与 Claim 继续追加保存。

## 4. Judgment 结果

本轮建议进入 R2 候选池的十项语义修正：

1. Claim or Assertion 成为一级对象。
2. Source Event、Asset、Observation、Claim、Process、World Object 和 View 分层。
3. Time 拆成多种明确时间角色。
4. Evidence Independence 改为依赖图和共享误差组。
5. Unknown、Not Observed、Observed Absent、Not Applicable 分开。
6. Object Identity 支持 successor、reconstruction、split、merge、same site 和 time scoped part relation。
7. Current Best View 改为带政策和 transaction time 的可重算结果。
8. Scale 作为核心，Spectrum 作为连续场扩展。
9. 冻结点遵循 append only，后续版本通过候选补丁和语义版本演进。
10. Quantity 绑定 Quantity Kind、Unit、Reference Frame、Measurement Procedure 和 Uncertainty。

本轮暂缓进入核心的内容：

1. 单一全局 confidence 数字。
2. 自动给所有历史陈述排序的 Truth Score。
3. 覆盖政治、文化、文学和社会全部概念的巨型本体。
4. 把所有关系都转换成频率。
5. 最终文件后缀和二进制布局。
6. 全球唯一频谱基底的数学形式。
7. 完整版权、隐私和访问控制模型。
8. 自动合并冲突观点。

这些内容继续保留为扩展问题或后续实验题。

## 5. 微型案例

测试案例为明确声明的 synthetic fixture，不对应任何真实翠湖建筑。

案例包含：

1. 一次1944年航空拍摄及其原始底片。
2. 该底片的2026年扫描件。
3. 扫描件的一份网络复制件。
4. 一次独立的1944年地面拍摄。
5. 一份1978年形成、回忆1944至1945年的手绘图。
6. 一次1967年卫星观测。
7. 一份2025年现代建筑施工记录。
8. 一项2026年 AI 重建资产。
9. 一栋历史建筑候选对象。
10. 一栋位于同一场地的现代新建对象。

案例保存了九条 Claim，包括建筑存在、位置、回忆位置、东立面开口数量、邻居关系、饭馆用途、西立面未知、现代建筑建造事件以及现代建筑与历史建筑的物理身份区分。

## 6. 关键结果

第一，航空扫描件和网络复制件虽然形成两个数字文件，它们共享同一个观测根和同一标定组。再加一张独立地面照片以后，三个支持文件只形成两个有效独立观测根。

第二，回忆图的位置 Claim 与航空定位 Claim 保持冲突。它关于邻居和饭馆的关系 Claim 单独保留，空间偏差不会自动抹掉社会记忆。

第三，现代建筑与历史建筑共享场地，同时保持两个 World Object。两者可以具有 `occupiesSameSiteAs` 和 `reconstructionStyleReferences` 关系，不能自动取得 `samePhysicalContinuant`。

第四，AI 重建资产明确标记为 synthetic reconstruction，并被 Current Best View 排除在直接历史证据之外。它可以作为展示、假设或后续比较对象。

第五，没有任何观测覆盖历史建筑西立面，所以结果保留 `Unknown`。系统没有用零坐标、空网格或对称补全冒充事实。

第六，Current Best View 保存了生成政策、版本、处理时间和 transaction time。回忆位置冲突仍然留在视图里，没有被静默删除。

第七，R1 冻结文件没有修改。本轮全部内容位于独立实验分支。

## 7. Verifier 结果

本轮编写了一个小型 Python verifier，检查十六条语义不变量：

1. 冻结提交保持可寻址。
2. Fixture 明确声明为 synthetic。
3. World Object 和 Evidence Asset 身份分开。
4. Source Event、Asset、Observation、Claim 和 View 分层。
5. 多种时间角色明确。
6. 推断 Claim 保存 method、assumptions 和 uncertainty。
7. 支持与反对关系均能解析。
8. 同源复制不增加独立观测根。
9. 共享标定和系统误差保持显式。
10. Unknown 不由零值或缺省值代替。
11. 数量绑定单位和参考系。
12. 同址现代建筑保持独立身份。
13. AI 重建被排除于直接历史证据。
14. Current Best View 可重演并保留冲突。
15. 社会关系没有被强制频谱化。
16. 资产来源链能够回溯到独立根。

实际运行结果：

`RESULT 16/16 checks passed`

该结果只说明当前 synthetic fixture 满足这十六条语义约束。它不证明 R2 已经完成，也不证明真实历史资料进入以后不会暴露新问题。

## 8. 本轮发现的最重要结构

当前最稳定的候选数据流为：

`World or Source Event -> Evidence Asset -> Observation -> Claim -> Evidence Graph -> Current Best View`

Transformation Process 可以出现在 Asset 与 Asset、Observation 与 Claim、Claim 与 View 之间，并且必须保存输入、输出、方法、参数、版本、时间和执行者。

当前最稳定的更新方式为：

1. 原始 Evidence 只追加。
2. 新解析生成新 Observation 或新 Claim。
3. 旧 Claim 不静默覆盖。
4. 新证据通过支持、反对、派生和共享来源关系接入图。
5. View 依据指定政策重新生成。
6. 冻结点继续保持永久可寻址。

## 9. 本轮尚未解决的问题

1. 真实航空照片进入后，如何表达一条航线内相邻帧的部分独立性。
2. 多个独立观测共享同一地图基准时，有效证据强度怎样计算。
3. Object Identity 发生长期拆分和合并时，查询语义怎样保持简单。
4. 大规模 Evidence Graph 的存储、索引和增量求解方法。
5. 世界连续场的频谱层与离散 Object Graph 之间怎样形成最小接口。
6. 用户提出的全球世界谱坐标怎样与已有地理基准做完全可逆适配。
7. 文学和口述中的情绪、隐喻与物理 Claim 怎样保持可区分关系。
8. 当两个高质量证据长期冲突时，View 应怎样显示而不强行消解。

## 10. 下一轮入口

下一轮建议使用一组真实但规模很小的资料，优先选择一栋资料来源清楚的云南历史建筑，控制在：

1. 两至五张独立地面照片。
2. 一至两张航空或卫星观测。
3. 一张地图或测绘资料。
4. 一份回忆、文字或手绘资料。
5. 一项现代修缮或仿建资料。

先人工建立 Evidence Lineage，再让 AGO 生成 Claim，最后运行相同 Verifier。只有真实样例通过以后，才考虑把本轮十项候选补丁整理为 TLO R2 草案。

## 11. Round 01 结论

第一轮流程已经跑通：

1. 有冻结输入。
2. 有明确 Problem Contract。
3. 有部分隔离的多视角探索。
4. 有攻击型 Critic。
5. 有小妈 Judgment。
6. 有独立实验分支。
7. 有 synthetic fixture。
8. 有可运行 Verifier。
9. 有机器结果。
10. 有候选补丁和暂缓项。
11. 没有改动 R1。
12. 没有进入生产。

当前最重要的收获是，世界总谱的中性语义可以落到一个最小可检查结构中。R1 的哲学核心继续成立，R2 前需要补充的边界已经更清楚。
