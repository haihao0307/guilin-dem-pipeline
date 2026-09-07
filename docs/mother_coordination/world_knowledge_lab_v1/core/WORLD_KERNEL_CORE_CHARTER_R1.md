# World Kernel 核心宪章 R1

日期：2026年9月7日

状态：候选核心架构。用于统一指导 DEM、Landscape、Weather、Cloud、Ocean、Coast、House、Materials、Human、Animal 与 B24 等 Mother。当前不修改任何生产内核。

## 一，时间第一

World Kernel 的第一坐标不是模型、材质或空间，而是时间。

所有可变化对象都必须能够回答：

`what(id, t)`

所有状态更新都必须显式带时间：

`state_next = advance(state_now, dt, environment)`

至少区分：

世界时间 `t_world`

对象局部时间 `t_object`

模拟步长 `dt`

历史状态 `history`

观察时间 `t_view`

艺术相位时间 `t_phase`

静态身份不能因为播放时间而漂移。程序化相位变化不能冒充真实输运。需要历史的现象必须保存必要状态或检查点。

## 二，第二层是身份

每个对象首先有稳定身份：

`id`

`type`

`referenceFrame`

`sourceVersion`

`truthBinding`

身份回答“这个东西是谁”，状态回答“它现在怎样”。

DEM 山峰、海底、建筑构件、B24 权威几何、人物骨骼、狗、树、石头、云团和烟源都不能因为观察者移动而换身份。

相机只改变查询，不改变对象是谁。

## 三，第三层是状态与真值

Kernel 只长期保存维持世界连续性所需的最小充分状态。

包括：

`Truth`，不可随意生成替代的测量和权威数据。

`State`，随时间变化且必须记忆的量。

`Constraints`，不能被破坏的结构、边界和关系。

`History`，当前状态无法独立解释时需要保存的过去信息。

例：

DEM 保存原始高程真值和锚点。

Ocean 保存当前波面状态、潮位和必要水体状态。

Cloud 保存包络、密度代理、速度和必要历史。

House 保存轴线、厚度、支承与材料状态。

Human 保存骨骼身份、姿态和行为状态。

## 四，第四层是策略

策略回答“当前这个问题用什么方法解决”。

策略不等于对象身份，也不等于某个软件。

例如同一个地形查询，可以选择：

低频可逆波形重构。

完整12.5米真值。

子测量尺度的程序化细化。

同一团云可以选择：

只查询包络。

查询粗密度。

查询渲染密度。

推进输运。

计算体积光学。

策略必须由查询目标、允许误差、计算预算和证据等级共同决定。

## 五，第五层是精度维度

精度不是单一数字。至少分成以下维度：

`P_space` 空间精度。

`P_time` 时间精度。

`P_geometry` 几何精度。

`P_physics` 物理精度。

`P_optics` 光学精度。

`P_semantic` 语义精度。

`P_interaction` 交互精度。

`P_observation` 当前观察精度。

不同需求可以要求不同精度。

远处山体可能需要高语义精度和低微观精度。

即将碰撞的飞机即使不在视线中心，也需要高物理精度。

故事中的狗可能需要高语义、动作和观察精度，而背景竹林只需保持整体身份与风场关系。

运行精度取各类实际需求的上界：

`P_required = max(P_observation, P_interaction, P_physics, P_story, P_safety)`

这里的 max 表示各维度逐项满足最严格需求，而非把所有对象都提升到最高计算状态。

## 六，函数是稳定知识的最终形式

成熟知识不应长期停留在说明文、案例或聊天记录中。

流程固定为：

`observation -> hypothesis -> test -> rule -> function -> library`

稳定函数的基本签名：

`output = f(input, state, t, precision, context)`

同时返回：

`uncertainty`

`evidenceLevel`

`validRange`

函数必须声明：

输入和输出。

坐标系。

单位。

时间语义。

状态依赖。

精度范围。

恢复条件。

非法输入。

是否具有副作用。

默认优先无副作用查询。改变世界状态必须通过显式 `advance`、`apply` 或 `commit` 类函数。

## 七，知识越多，熟悉任务的计算量不能随之增长

长期目标：

`knowledge_size ↑`

`experience ↑`

`compression_ratio ↑`

同时熟悉任务的平均推理成本保持近似有界，理想情况下下降：

`reasoning_cost(familiar_task) ↓`

新经验如果只能不断增加新的 if、标签、节点和模型副本，而不能压缩成更通用关系，则说明蒸馏尚未完成。

一个新案例进入系统后：

第一次可以使用昂贵研究。

形成规律后写成函数。

通过小试验后进入函数库。

下次同类问题直接调用。

只有出现超出有效范围的新情况，才重新启动高成本推理。

因此“学习”最终必须降低未来重复任务的边际计算成本。

## 八，观察带宽代替 LOD 作为世界概念

Kernel 不采用“世界有几套等级模型”的本体论。

世界只有一个身份与连续定义。

观察请求决定当前需要展开到哪个频带、哪个尺度和哪个精度。

可定义：

`ObservationRequest = {camera, gaze, focus, attention, footprint, task, interaction}`

以及：

`PerceptualBandwidth(x,t)`

远处山体保留主轮廓和山脊。

背景竹林保留整体颜色、密度、运动和透光。

注视一片叶子时才展开叶缘、叶脉和微结构。

Microscope 的职责是提供“需要时可深入”的微观生成能力，而非让整个世界永久工作在最高频。

视觉必须保留休息区。所有像素同时最高频属于无效计算和无效审美。

## 九，世界持续存在，观察者只决定展开深度

观察者不能决定世界是否存在。

无人观察时，因果世界仍维持必要最低状态。

因此运行预算来自多种需求：

`Budget = max(B_visual, B_interaction, B_physics, B_story, B_safety)`

相机之外的物理事件、交互和叙事都可以申请更高计算带宽。

视觉查询可以很粗，物理局部可以很细；两者不必同步升级。

## 十，软件和格式都是当前工具，不是终点

Blender、Houdini、Substance、Unreal Engine、3GS、WebGPU 都是学习与执行工具。

需要蒸馏的是：

它们怎样表达坐标。

怎样保存状态。

怎样建立依赖。

怎样查询世界。

怎样组织材质与体积。

怎样分配计算预算。

怎样验证误差。

Kernel 不绑定任何一个软件作为世界本体。

WebGPU 可作为当前执行后端之一。未来若执行接口变化，World Kernel 的时间、身份、状态、函数、策略和精度关系仍应保持。

## 十一，各 Mother 的统一执行协议

所有 Mother 开工前先回答八个问题：

1. 这个对象的时间是什么？
2. 稳定身份是什么？
3. 必须保存的最小状态是什么？
4. 哪些是真值和硬约束？
5. 当前查询要解决什么问题？
6. 当前各精度维度需要到哪里？
7. 已有函数是否足够，还是遇到了真正的新情况？
8. A=0、零输入或恢复路径是什么？

只有第7题确认出现新问题时，才允许启动新的高成本研究。

## 十二，第一批 Mother 的收敛方向

DEM：时间主要进入版本和动态水界面；身份是地理真值；策略为可逆波形、按需频带和子测量尺度细化；精度由真值、视觉、物理查询分别决定。

Weather/Cloud：时间、历史和输运是核心；身份是云团与天气状态；策略分包络、粗状态、多尺度细节、输运和体积光学。

Ocean/Coast：时间进入潮汐、波和局部连续流；海底真值与海面状态分开；远海解析关系与局部流体按需求工作。

Landscape：主形身份优先；Microscope 只展开必要频率；材质、几何和光学分别验证。

Materials/Brick/Tiles/House：材料函数共享，真实厚度、接触、支承与施工关系保持独立硬约束。

Human/Animal：身份、骨骼、行为状态长期存在；皮肤、毛发与微结构按观察带宽展开；动作和交互精度由任务需求决定。

B24：权威几何长期不变；涂装、材质、动画、流场观察分别通过函数调用；风洞可视化不得冒充数值验证。

## 十三，当前总原则

世界的核心数据顺序：

`Time -> Identity -> Truth/State -> Strategy -> Precision -> Query -> Function -> Evidence`

长期优化目标：

在不破坏身份、因果、真值和当前观察需求的约束下，使存储、计算、传输和重复推理成本尽可能小。

一句话：

**世界保存最小充分状态，时间维持连续，身份维持同一，策略选择方法，精度决定展开深度，成熟经验压缩成函数，新情况才重新思考。**

## 十四，状态

`kernel_charter=candidate_core`

`mother_guidance_ready=true`

`productionIntegration=false`

`runtimeImplementation=false`

`visualAcceptance=false`

`productionReady=false`
