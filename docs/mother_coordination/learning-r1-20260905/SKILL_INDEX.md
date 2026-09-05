# 四类软件技能总目录 R1

版本：1.0。性质：小妈整理的来源索引、初始技能卡与学习任务。执行者尚未提交本轮答卷，四套软件的实际操作与集成测试均为 not_run。

核心采用通用技能名，来源层保留 Houdini、Blender、Unreal Engine、Gaea 的可检索术语。每个 Mother 都了解四类来源的职责和限制，深入学习按现有任务分配。原地图中的 Substance、Three.js、其他已批准参考保留，不因本轮重点而删除。

## Houdini / SideFX

首轮卡：[属性、依赖和程序化几何](skills/procedural-geometry/SKILL.md)。优先：SOP 数据流、点/顶点/面/整体属性、稳定身份、局部生成与依赖、体积/场的表示边界。对应 House、Brick、Tiles、Landscape、Weather、Cloud、Ocean，以及已有几何生产线。

后续拆分主题：HDA 的参数与封装，PDG/TOP 依赖调度，缓存失效，VEX/HOM 自动化，曲线/装配，HeightField，FLIP/Pyro 等模拟。上述后续主题仅列入待整理队列；每项需要独立原文和实验，不能由首轮卡覆盖。

已查读英文官方章节：
- https://www.sidefx.com/docs/houdini/nodes/sop/index.html
- https://www.sidefx.com/docs/houdini/model/attributes.html
- https://www.sidefx.com/docs/houdini/model/volumes.html

页面标识为 Houdini 22.0；实际项目安装版本 unknown。文档页标签不保证每段历史说明已同步。操作前匹配实际版本、节点和许可。用户此前独立提供的原书未随本轮全量包归档，不能声明本轮已读原书。

## Blender

首轮卡：[几何求值上下文与实例](skills/geometry-context/SKILL.md)。优先：Geometry Nodes、Fields、Attributes、Instances，以及几何数据和操作的边界。对应 Brick、Tiles、House、Human、Animal 及几何检查需求。

后续拆分主题：法线/厚度/网格检查、曲线、修改器顺序、骨骼与约束、动画与接触、Python API、导出往返和单位。后续主题继续为待深读，不因软件名入库而视为已完成。

官方英文来源：
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/index.html
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/fields.html
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/attributes_reference.html
- https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/instances/instance_on_points.html

本轮通过搜索索引读取了官方 Fields 的主要说明及 Instances 摘要；直接打开页面的读取接口多次返回 402。原文完整直读、软件实测均未完成，执行者须补足读取。索引显示 Blender 5.2 LTS；不得据此升级实际工作环境。涉及不同版本的字段与节点需分别验证。

## Unreal Engine

首轮卡：[实时世界的数据、表现和执行边界](skills/realtime-world/SKILL.md)。优先：PCG 空间数据和属性、筛选/分布、分层生成；Niagara 参数、状态更新与表现分离。对应 Landscape、Weather、Cloud、Ocean/Coast、Historical World。

Human/Animal 另读 Control Rig 的骨骼、控制器、求解与调试概念；只吸收符合当前原创骨架和姿势权威的内容。Brain/Jarvis 研究接口、状态和高层意图，不接管低层运动。

后续拆分主题：World Partition 与流式加载、材质通道、光照/阴影/反射、天空与雾、动画与约束、实际设备性能和公开交互验证。后续条目需要各自证据，未自动完成。

官方英文来源：
- https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview
- https://dev.epicgames.com/documentation/unreal-engine/using-pcg-generation-modes-in-unreal-engine?lang=en-US
- https://dev.epicgames.com/documentation/en-us/unreal-engine/overview-of-niagara-effects-for-unreal-engine
- https://dev.epicgames.com/documentation/unreal-engine/control-rig-in-unreal-engine

PCG 与 Niagara 概览正文已查读，Control Rig 与生成模式已作来源定位。页面标识为 UE 5.8，实际项目版本仍由执行者回执。学习不等于迁移全部网页到 UE，不改变已有 Three.js/WebGPU 交付约定。

## Gaea / QuadSpinner

首轮卡：[尺度、侵蚀和地貌因果](skills/terrain-process/SKILL.md)。优先：主形、尺度、侵蚀、搬运/沉积、空间影响范围，以及结果与现实观测的区别。Landscape 主读，Weather 和 Ocean/Coast 阅读边界，DEM 阅读真值隔离部分。

后续拆分主题：基础形态组合、侵蚀链、掩膜提取、坡度/高度/流向语义、预览与构建分辨率、分块和输出。卡片迁移到函数实现时必须保留单位、输入依据和局限。

官方英文来源：
- https://docs.gaea.app/reference/nodes/simulate/erosion2
- https://docs.quadspinner.com/Reference/Erosion/Erosion.html

Erosion2 正文已查读，旧 Erosion 页明确标注 1.3 更新说明，只作为历史来源。两代节点不能混用参数和确定性结论。Erosion2 页面末尾的 Slope/Altitude 两行解释疑似互换，列为来源冲突，需对照实际软件核验后才能采用。未在本轮运行 Gaea，不采信未实测的性能倍数为本项目结果。

真值隔离：Gaea 和 Houdini 地貌方法可研究并用于符合批准范围的生成地貌；桂林/温州真实 DEM 继续遵守各自当前合同。禁止借本轮学习改变 canonical、高程数值、AOI、数据哈希，禁止填洞、手工河流或恢复已禁止的 Gaea 生产路线。

## 技能资产最低字段

每张技能卡都要保存来源及读取程度、适用软件版本、通用原理、输入输出、单位/坐标/属性域、操作或伪代码、依赖、已知限制、正例、反例、验证办法、运行环境和耗时/内存。实际测试结果与计划分开记录。

资料归档、执行端实际读取、理解通过、实现通过、跨对象验证、用户批准分别记录。现有四张首轮卡属于 source_grounded_draft，尚无各 Mother 的验证回执。
