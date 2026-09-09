# WORLD SCORE / TLO R1 — OPENAI-ONLY RED-TEAM REVIEW R1

日期：2026-09-09

状态：外部冻结稿之后的独立审查记录，不修改 `WORLD_SCORE_TLO_SEMANTIC_CHARTER_R1_20260909.md` 冻结点。

审查边界：本轮不调用 Anthropic / Claude Code。使用当前 OpenAI GPT-5.6 Sol 进行多视角红队分析，并参考 OpenAI 官方公开的多-agent Navier–Stokes 研究组织方法，以及既有国际标准的成熟语义。没有冒充已经获得 GPT-6 Astra 或其他独立 OpenAI 模型实例的直接意见。

## 0. 总评

R1 的方向是成立的，最重要的优势是先固定“共同语义”，把编码、文件后缀、数据库和传输方式降为可替换实现；同时明确中性度量、时间、空间、尺度、Observation、Evidence、Object DNA、Uncertainty 与 Provenance。

当前最大风险已经不在“大方向错误”，而在一些看似细小、以后会造成系统性污染的语义缝隙。建议在真正设计 TLO schema 之前补齐这些缝隙。

## 1. 第一优先漏洞：Observation 与 World State 中间缺少 Claim / Assertion

当前 R1 已有 Observation、Evidence 和 WorldStatement，但需要把“观测本身”和“由观测得出的陈述”彻底分开。

例：一张 1944 年照片本身是一项 Observation。`1944-05 某建筑东立面有 5 个窗洞` 是从照片解释得到的 Claim。`该建筑 1944 年有 10 个窗户` 可能又是更高层推断。

因此建议加入一级语义：

`Observation -> Claim/Assertion -> Evidence Graph -> World Hypothesis/View`

原始观测永远保留，Claim 可以被支持、反驳、替换或重新解释。

## 2. 时间必须拆成多种时间，不能只有一个 Time

至少要区分：

1. `World/Valid Time`：被描述的世界状态发生在什么时候。
2. `Observation Time`：观察实际发生在什么时候。
3. `Evidence Creation Time`：照片、文字、测绘记录何时形成。
4. `Represented Time`：一个后来重建或作品声称表示哪个时期。
5. `Ingest/Transaction Time`：资料什么时候进入我们的系统。
6. `Processing Time`：某次算法推断、校正、重建什么时候发生。

否则“1978 年老人回忆 1944 年昆明”和“2027 年 AI 重建 1944 年昆明”以后会产生严重歧义。

## 3. Evidence Independence 不能只是分数，必须是依赖图

“不同文件”不等于独立观察，“不同人”也不一定等于独立来源。

两名作者可能都抄自同一本地方志；十个网站可能来自同一张底片；多个 AI 可能都用了同一训练资料；两个测绘成果可能共享同一基础控制点和系统误差。

建议把证据关系保存为 lineage/dependency graph：

`derivedFrom / copiedFrom / transformedFrom / sharesSourceWith / sharesCalibrationWith / independentOf(when justified)`

独立性应从来源图推导，尽量避免人工随意填一个 0.8 或 0.9。

## 4. “被验证一千次”仍可能共同出错，要保存系统误差

独立观察越多通常约束越强，但不能把数量直接等价为真值。

如果一千次观测共享同一种错误地图基准、错误镜头标定、错误年代判断或同一个上游档案误标，它们仍可能高度一致地出错。

所以除了随机误差，还要有：

`Systematic Bias / Calibration / Shared Assumption / Model Error`

这会保护未来总谱免受“规模很大但同源偏差”的污染。

## 5. Uncertainty 不能只用单一 confidence

建议最小语义允许：

1. 区间，例如位置 ±8 m。
2. 概率分布或候选集合。
3. 分类不确定性，例如 A/B 两种身份。
4. 时间范围，例如 `1943-1945`。
5. 纯 Unknown。
6. 不可比较的观点差异。

同时需要区分观测误差、推断不确定性、模型误差和来源不确定性。第一阶段可以很简化，但字段语义要预留。

## 6. Unknown、Absent、Not Observed 必须严格分开

这是历史世界里非常容易产生伪事实的一处。

`照片里没看见一座房子` 不等于 `房子不存在`。

至少要区分：

`Unknown`：不知道。

`Not Observed`：本次观测没有覆盖或没有识别到。

`Observed Absent`：观测条件足以支持“当时不存在”。

`Not Applicable`：这个属性对该对象无意义。

任何机器都禁止用零值、空字符串、原点坐标或默认矩阵替代 Unknown。

## 7. Object Identity 需要处理“分裂、合并、重建、继承”

跨时间 Object ID 很重要，但现实对象并不总能保持简单的一条连续线。

例：旧庙被拆掉后原址重建，是同一个对象、继承对象、地点连续对象，还是新对象？一条河分叉、行政区合并、房屋分栋、飞机换发动机，都可能产生 identity ambiguity。

建议加入明确关系：

`samePhysicalContinuant`

`successorOf`

`reconstructionOf`

`splitFrom`

`mergedFrom`

`partOfAtTime`

`occupiesSameSiteAs`

不要把所有历史连续性硬塞进 `same Object ID`。

## 8. Scale 与 Frequency 要分层定义，不能强迫所有知识都傅里叶化

空间连续场、地形、材质、波、声音非常适合频带表达。

“某房间住的是谁”“某店铺叫什么”“某人认为城里没粮食”属于离散、关系或语义信息，不能为了统一而硬转为频率。

建议：

`Scale` 是通用语义，所有对象都可以有尺度/粒度。

`Spectrum/Frequency` 是适用于连续或可频谱化数据的专门扩展。

这样乐谱仍然是总的组织隐喻和多尺度机制，但不会造成错误数学化。

## 9. Provenance 需要做到可重演，而不只“知道来自哪里”

建议每一次处理保存：

原始资产 hash；
算法/软件/模型标识与版本；
参数；
输入集合；
输出 hash；
人工修改记录；
时间；
执行环境在必要时的可重建描述。

这与 W3C PROV 的 Entity / Activity / Agent 思路高度兼容。优先复用成熟语义，不自行重造。

## 10. 媒体真实性要兼容可验证来源机制

未来照片、视频、音频污染会迅速增加。总谱自己的 Evidence DNA 很重要，同时应预留和 C2PA Content Credentials 一类标准对接的位置。

关键点：

“有可验证签名/内容来源”只证明某条来源链和内容绑定没有被篡改，不自动证明照片所描述的世界事实为真。

所以必须继续把 `Authenticity of Asset` 与 `Truth of Claim` 分开。

## 11. Sensor / Observer Model 需要成为一级结构

历史照片反解世界时，仅知道“摄影师是谁”还不够。

需要可选记录：

Camera intrinsics；
extrinsics / pose；
lens distortion；
film/sensor size；
scan transform；
resolution / GSD；
calibration；
view cone / footprint；
measurement procedure。

人的观察也可以有 observer context，例如位置、可见范围、记录发生时的距离和是否为事后回忆。

OGC SensorThings 已有 Sensor、Observation、ObservedProperty、FeatureOfInterest 等成熟关系，可吸收其语义，不照搬其 IoT 实现。

## 12. Canonical World 不宜被当成“唯一事实记录”，应是可重建的当前最佳视图

建议永远保留：

`Evidence/Observation layer`：不可静默覆盖。

`Claim layer`：允许多个互相冲突陈述。

`World Hypothesis / Current Best View`：由指定规则和证据集计算出的当前世界解释。

这样以后算法变化时，可以从同一证据重新生成新的 World View，而不需要篡改历史。

## 13. 冻结点应成为 append-only 历史，不做静默修订

用户已明确“冻结点”是阶段性状态，因此建议制度化：

冻结版本保持永久可寻址；
后续通过 R2/R3 新版本修订；
任何修订必须说明新增、撤销和改变的语义；
旧版本继续可解码；
转换器有明确版本。

这与 Git fixed commit 很适合，但语义本身也要定义这种行为，不能只依赖 Git。

## 14. 共同语言应采用“极小内核 + 扩展”，防止本体膨胀

如果一开始试图为整个物理、化学、生物、历史、文学、社会建立一个巨型 ontology，系统很容易僵化。

建议核心只保留真正跨领域不可缺少的语义：

Identity
Space / Frame
Time
Scale / Granularity
Quantity / State
Relation
Observation
Claim
Provenance
Uncertainty
Change

天气、海洋、建筑、生物、社会史、文学等全部作为 typed extensions。

## 15. 物理单位必须同时绑定 Quantity Kind、Unit、Reference Frame

`3.42 m` 本身还不够。

需要知道这是宽度、弧长、海拔差还是摄影测量距离；从哪两个点测；使用哪个 frame / datum；误差是多少。

SI 继续作为量值单位基础。空间参考、垂直基准和时间参考均需显式或可继承地绑定。

## 16. 历史资料要区分“资产身份”和“被描述对象身份”

一张照片是一个 Digital/Physical Evidence Object；照片里的塔是另一个 World Object。

一张“照片的照片”又是新的 Evidence Object，并通过 lineage 指向原始照片。

这对档案馆扫描、翻拍、修复、压缩版、AI 增强版尤其重要。

## 17. 推断必须保存 Assumption Set

例如从普通摄影师身高估计相机高度，是合理先验，但不能变成直接事实。

建议任何 inference 允许挂：

`Assumptions`

`Method`

`InputClaims`

`OutputClaims`

`Validation`

这样以后发现假设错误，可以沿依赖图自动找出受影响的结论。

## 18. 需要开放世界语义

资料库中“没有记录”不代表现实世界“不存在”。

尤其历史恢复必须默认 open-world：知识缺口是合法状态。

只有在观测覆盖、检测能力、时间范围等条件足以支持缺失结论时，才生成 `Observed Absent` Claim。

## 19. 权利、访问限制与原件位置可以作为外围元数据

这不属于真值判断，但实践中不可缺少。档案可能受版权、访问许可、隐私、保存机构规则约束。

建议语义允许指向 Rights / Access / Custody metadata，而不要把它混进 Evidence Truth。

## 20. OpenAI 多-agent 方法对 AGO 的直接启示

OpenAI 2026-09 公开的 Navier–Stokes 工作说明，其内部系统把 agent 分组，允许组内交流，不要求所有 agent 全局共享上下文；最终成功路线涉及约一万个并发 agent。这个公开事实支持我们当前的“独立搜索、部分隔离、阶段性交换、judgment 后重新分配资源”的方向。

因此扩展 AGO 规模以前，优先验证：

1. 子问题是否真的可并行。
2. 独立搜索是否产生不同路线。
3. Judge 能否识别重复、同源错误和停滞。
4. Verifier 是否独立于 Builder。
5. Artifact 能否无损传回，不依赖多轮口头总结。

规模只在以上五项成立后再增加。

## 21. 与成熟标准的关系

当前应采取“借语义，不被实现绑死”的策略。

可重点学习：

- BIPM SI：统一量与单位的稳定公共语言。
- W3C PROV：Entity / Activity / Agent 与可追溯 provenance。
- OGC SensorThings / OGC observation models：Sensor、Observation、ObservedProperty、FeatureOfInterest 等观测关系。
- STAC：地球观测资产的时间、空间、asset link 与可搜索组织。
- CIDOC CRM + CRMsci + CRMinf：文化遗产、科学观测、历史命题、论证和知识修订。
- C2PA Content Credentials：数字媒体来源链、声明、签名和防篡改绑定。

TLO 的目标不应复制这些标准，而应把成熟部分通过 adapter 映射进共同世界语义，并只补它们之间没有统一解决的跨尺度、跨时间 World Score / Object DNA 层。

## 22. 建议 R2 前必须补的八个语义点

按优先级排序：

1. Claim / Assertion 一级对象。
2. 多时间语义。
3. Evidence dependency / independence graph。
4. Unknown / Not Observed / Observed Absent 区分。
5. Object identity 的 successor / split / merge / reconstruction 语义。
6. Uncertainty 类型与最小传播规则。
7. Append-only freeze / semantic versioning。
8. Scale 与 Spectrum 分离，避免把所有知识强制频谱化。

这八项补齐以后，R1 的哲学框架会明显更抗污染，也更适合真正落到试验数据。

## 23. 下一步建议

不要立即设计庞大的正式格式。

先用一个很小的历史样例验证语义，例如：

“同一栋历史建筑 + 2~5 张独立地面照片 + 1~2 张航空/卫星观测 + 一份可能画错位置但有人际关系记忆的回忆资料 + 一份现代重建资料”。

要求系统同时回答：

1. 这个对象是谁，跨时间是否连续。
2. 每条 Claim 来自哪些 Observation。
3. 哪些证据真正独立。
4. 哪些属性确定，哪些未知。
5. 哪些结论是直接观测，哪些推断。
6. 现代重建为什么不会污染历史层。
7. 新增一张照片后，哪些局部结论发生变化。
8. 能否完整回到冻结前状态。

通过这个样例再决定 TLO R2 的最小 schema。

## 参考的公开规范与资料

- OpenAI, “On the Navier–Stokes Millennium Prize Problem”, 2026-09.
- BIPM, The International System of Units (SI), current 9th edition update.
- W3C, PROV Data Model / PROV Primer.
- OGC, SensorThings API.
- STAC Specification.
- CIDOC CRM / CRMsci / CRMinf.
- C2PA Content Credentials Specification 2.4.
