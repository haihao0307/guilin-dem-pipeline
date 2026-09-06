# 软件方法技能总目录 R1

增补日期：2026-09-06。保留初版四类软件来源记录，新增ShaderGPT着色器审核和TouchDesigner实时数据流学习入口。下面初版的阅读程度、版本标签与零回执状态只对应2026-09-05设立时点；本次没有重新核查四类软件当前版本或各Mother全部状态，最新回执应读取总控Issue 62及各线原始记录。

## 新增：TouchDesigner / Derivative

[实时数据流、时间与事件技能卡](skills/realtime-stream-time/SKILL.md)；[本轮实际执行的CPU反例脚本](skills/realtime-stream-time/temporal_probe.py)。读取官方产品说明、操作器家族、Cook、Time Slicing、Time Slice CHOP、POP学习文档、POP to CHOP、Math Combine及一条社区排错。docs.derivative.ca/Main_Page直读返回403，已经改读同厂商derivative.ca/UserGuide/Main_Page。

提炼重点：数据类型与时钟分开；显示掉帧不等于事件可以丢弃；插值不恢复未采集事实；GPU驻留、CPU回读及延迟分别记录；高频参数与代码结构分开；节点预览也可能影响计算。具体来源、读取范围、历史帖日期及实验限制见技能卡。

社区 https://forum.derivative.ca/ 的POPs、Techniques、Bugs、Hardware与General纳入既有三天到期巡查规则，具体接续时执行。本轮未设定定时任务、未发外部社区帖子、未安装或运行TouchDesigner。自写Python算例通过不代表TouchDesigner、GPU或生产软件通过。

建议Weather/Ocean先研究时间和反馈；Brick/Tiles/House研究材质参数和观察开销；Landscape研究GPU属性流；Human/Animal/Jarvis按原职责研究输入时间戳、事件与执行边界。所有路线保留原始任务与人工验收，不强制迁移运行时，不把新增入口算作各会话已读。

## 新增：ShaderGPT / 生成着色器审查

[生成着色器审核技能卡](skills/generated-shader-review/SKILL.md)。原研究保留来源、GLSL输入合同、smoothstep边界问题、CPU检查及WebGL不可用的执行限制。没有调用第三方AI生成服务，没有把原GLSL当作跨运行时已测试材料。

## 初版四类软件来源记录

版本：1.0。以下为初版发布时记录。性质：小妈整理的来源索引、初始技能卡与学习任务。当时执行者尚未提交该轮答卷，四套软件的实际操作与集成测试均为 not_run。

核心采用通用技能名，来源层保留 Houdini、Blender、Unreal Engine、Gaea 的可检索术语。每个 Mother 都了解四类来源的职责和限制，深入学习按现有任务分配。原地图中的 Substance、Three.js、其他已批准参考保留，不因本轮重点而删除。

## Houdini / SideFX

首轮卡：[属性、依赖和程序化几何](skills/procedural-geometry/SKILL.md)。优先：SOP 数据流、点/顶点/面/整体属性、稳定身份、局部生成与依赖、体积/场的表示边界。对应 House、Brick、Tiles、Landscape、Weather、Cloud、Ocean，以及已有几何生产线。

后续拆分主题：HDA 的参数与封装，PDG/TOP 依赖调度，缓存失效，VEX/HOM 自动化，曲线/装配，HeightField，FLIP/Pyro 等模拟。上述后续主题仅列入待整理队列；每项需要独立原文和实验，不能由首轮卡覆盖。

初版已查读英文官方章节：
- https://www.sidefx.com/docs/houdini/nodes/sop/index.html
- https://www.sidefx.com/docs/houdini/model/attributes.html
- https://www.sidefx.com/docs/houdini/model/volumes.html

初版记录页面标识为 Houdini 22.0；实际项目安装版本 unknown。文档页标签不保证每段历史说明已同步。操作前匹配实际版本、节点和许可。用户此前独立提供的原书未随本轮全量包归档，不能声明本轮已读原书。

## Blender

首轮卡：[几何求值上下文与实例](skills/geometry-context/SKILL.md)。优先：Geometry Nodes、Fields、Attributes、Instances，以及几何数据和操作的边界。对应 Brick、Tiles、House、Human、Animal 及几何检查需求。

后续拆分主题：法线/厚度/网格检查、曲线、修改器顺序、骨骼与约束、动画与接触、Python API、导出往返和单位。后续主题继续为待深读，不因软件名入库而视为已完成。

官方英文来源：
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/index.html
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/fields.html
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/attributes_reference.html
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/instances/instance_on_points.html

初版通过搜索索引读取了官方 Fields 的主要说明及 Instances 摘要；直接打开页面的读取接口多次返回 402。原文完整直读、软件实测均未完成，执行者须补足读取。初版索引记录 Blender 5.2 LTS；不得据此升级实际工作环境。涉及不同版本的字段与节点需分别验证。

## Unreal Engine

首轮卡：[实时世界的数据、表现和执行边界](skills/realtime-world/SKILL.md)。优先：PCG 空间数据和属性、筛选/分布、分层生成；Niagara 参数、状态更新与表现分离。对应 Landscape、Weather、Cloud、Ocean/Coast、Historical World。

Human/Animal 另读 Control Rig 的骨骼、控制器、求解与调试概念；只吸收符合当前原创骨架和姿势权威的内容。Brain/Jarvis 研究接口、状态和高层意图，不接管低层运动。

后续拆分主题：World Partition 与流式加载、材质通道、光照/阴影/反射、天空与雾、动画与约束、实际设备性能和公开交互验证。后续条目需要各自证据，未自动完成。

官方英文来源：
- https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview
- https://dev.epicgames.com/documentation/unreal-engine/using-pcg-generation-modes-in-unreal-engine?lang=en-US
- https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-niagara-effects-for-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/control-rig-in-unreal-engine

初版PCG 与 Niagara 概览正文已查读，Control Rig 与生成模式已作来源定位。初版页面记录 UE 5.8，实际项目版本仍由执行者回执。学习不等于迁移全部网页到 UE，不改变已有 Three.js/WebGPU 交付约定。

## Gaea / QuadSpinner

首轮卡：[尺度、侵蚀和地貌因果](skills/terrain-process/SKILL.md)。优先：主形、尺度、侵蚀、搬运/沉积、空间影响范围，以及结果与现实观测的区别。Landscape 主读，Weather 和 Ocean/Coast 阅读边界，DEM 阅读真值隔离部分。

后续拆分主题：基础形态组合、侵蚀链、掩膜提取、坡度/高度/流向语义、预览与构建分辨率、分块和输出。卡片迁移到函数实现时必须保留单位、输入依据和局限。

官方英文来源：
- https://docs.gaea.app/reference/nodes/simulate/erosion2
- https://docs.quadspinner.com/Reference/Erosion/Erosion.html

初版Erosion2 正文已查读，旧 Erosion 页明确标注 1.3 更新说明，只作为历史来源。两代节点不能混用参数和确定性结论。初版发现Erosion2 页面末尾的 Slope/Altitude 两行解释疑似互换，列为来源冲突，需对照实际软件核验后才能采用。未运行 Gaea，不采信未实测的性能倍数为本项目结果。

真值隔离：Gaea 和 Houdini 地貌方法可研究并用于符合批准范围的生成地貌；桂林/温州真实 DEM 继续遵守各自当前合同。禁止借本轮学习改变 canonical、高程数值、AOI、数据哈希，禁止填洞、手工河流或恢复已禁止的 Gaea 生产路线。

## 技能资产最低字段

每张技能卡都要保存来源及读取程度、适用软件版本、通用原理、输入输出、单位/坐标/属性域、操作或伪代码、依赖、已知限制、正例、反例、验证办法、运行环境和耗时/内存。实际测试结果与计划分开记录。

资料归档、执行端实际读取、理解通过、实现通过、跨对象验证、用户批准分别记录。四张首轮卡的初始状态为 source_grounded_draft，当前验证状态必须依据后续真实回执和复核，不能沿用初版零回执快照推定。

## 新增：局部交互与群体运动（Boids）

2026-09-06用户提供的鸟群、鱼群群体行为资料已收入[局部群体运动技能卡](skills/local-collective-motion/SKILL.md)，附[独立CPU探针](skills/local-collective-motion/probe.py)和[实际检查记录](skills/local-collective-motion/PROBE_RESULTS.json)。对应[函数应用图谱](FUNCTION_APPLICATION_MAP.md)的运动与交互职责，复用距离、方向、平均、平滑门控和限幅，补充动态邻域及显式状态推进；不扩大宏观世界观。

检索主题包括鸟群、鱼群、羊群、Boids、separation、alignment、cohesion、捕食者/猎物、牧羊犬、局部人群避让、空间网格和Worker。保留物种感知、地表/水体约束与身体执行差异；最近七邻居不作为跨物种常数。Brain/Jarvis仍只负责既有高层意图，群体转向不得覆盖骨骼与finalPose。

本轮18项有限CPU检查通过，含源码表达式反例；未运行上游完整应用、真实浏览器、GPU或物种标定，未接入任何生产线。未来获得对应生产任务时再读该线当前HEAD，选小群体和一个变量验证。本次没有新建全组任务、自动化或人工批准，不推定任何其他Mother已经阅读。
