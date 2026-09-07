# Object DNA 核心宪章 R1

日期：2026年9月7日

父系统：`World Kernel`

状态：候选核心子系统。用于描述单个对象怎样在 World Kernel 中保持身份、真值、状态、可重建性、证据和按需精度。当前不修改任何 Mother 的生产内核。

## 一，Object DNA 在 World Kernel 中的位置

World Kernel 管理世界级关系：

`Time -> Identity -> Truth/State -> Strategy -> Precision -> Query -> Function -> Evidence`

Object DNA 负责回答一个对象自身的问题：

这个对象是谁。

它由哪些具有语义的部分和关系构成。

哪些信息必须长期保存。

哪些信息能够通过规则重建。

当前状态怎样随时间变化。

面对不同精度查询时应该展开到哪里。

哪些证据支持每个结构、材料和行为结论。

因此 Object DNA 不是一个网格格式、GLB、CAD 文件、纹理集合或 LOD 资产组。它是一个对象的最小充分、可执行、可验证描述。

## 二，时间仍然第一

Object DNA 不拥有独立于 World Kernel 的另一套世界时间。

每个对象必须声明自己的时间绑定：

`timeBinding`

至少说明：

对象读取哪个 `t_world`。

对象是否有 `t_object`。

状态推进需要的 `dt`。

是否需要历史。

哪些变化属于真实状态推进。

哪些变化只属于观察或艺术相位。

对象的静态身份和固定参考坐标不能随播放时间漂移。

## 三，Object DNA 最小结构

候选结构：

```text
ObjectDNA = {
  objectId,
  objectType,
  timeBinding,
  referenceFrame,
  sourceProvenance,
  truthBindings,
  semanticParts,
  anchors,
  constraints,
  canonicalMeasurements,
  stateSchema,
  structureRecipes,
  surfaceProgram,
  behaviorCapabilities,
  queryFunctions,
  reconstructionPolicy,
  precisionPolicy,
  exceptions,
  evidenceLedger,
  version
}
```

不同对象可以缺省不适用字段。任何字段都不能仅因为某个软件方便就被强制加入所有对象。

## 四，身份、语义部分和关系优先于网格

`objectId` 与 `objectType` 保持稳定身份。

`semanticParts` 保存具有意义的组成部分和角色。

`anchors` 保存稳定参考点、轴、面、曲线、接口或局部坐标。

`constraints` 保存不能被破坏的关系，例如接触、支承、厚度、连续性、边界、父子关系、活动范围或地理约束。

网格节点名、导入层级、三角数量和软件对象名只能作为来源证据。它们不能自动升级为物理零件、历史真值或对象 DNA。

## 五，来源资产是证据输入，不是对象本体

Aircraft AN/M2 R01 方法研究给出了一个重要的通用原则：参考模型、照片、图纸和文档可以进入 Reference Intake，用于测量、配准和语义推断；生产对象应由可读规则、约束、材料语义和已确认例外重建。当前该线明确规定参考网格不成为产品资产，工具栈属于可替换策略。

这个原则扩展到所有 Object DNA：

扫描、3GS、GLB、CAD、照片、卫星图和手工模型均可以作为证据源。

每个来源记录哈希、版本、坐标、读取范围和可信边界。

来源文件可以临时进入测量环境。

稳定 DNA 保存由证据支持的关系，不复制来源的全部顶点、UV 或像素来冒充规则。

如果一个对象只能通过永久保留完整参考资产才能存在，则其 DNA 尚未完成蒸馏。

## 六，测量层负责把证据变成可比较关系

Aircraft R01 的可迁移经验包括：

先确定对象轴和稳定锚点。

沿稳定坐标做重复截面或轮廓查询。

比较包络、轮廓、距离和轴向关系。

任何拟合都先作为候选，并附来源与置信度。

数值测量、固定视觉对照和用户接受分别记录。

具体工具可以是 Trimesh、VTK、OpenCV、CadQuery、Blender 或未来其他工具。工具不进入 DNA 本体。工具产生的经过复核的测量、约束和证据可以进入 DNA。

## 七，结构配方是可读的生成关系

`structureRecipes` 保存能够重新生成对象结构的规则和例外。

理想形式：

`geometry = buildStructure(dna, state, t, precision, context)`

对于机械对象，可以是外部轮廓、连接界面、轴线、孔槽、重复结构和经过证据确认的自由曲面关系。

对于竹子，可以是节间、分枝、叶序和年龄状态。

对于岩石，可以是主形、断裂、侵蚀和材料域。

对于云，可以是包络、状态场、输运和体积光学。

对于农田，可以是田块边界、水面、高程、作物类型、种植时间、密度、行列组织和管理状态。

规则必须说明适用范围和恢复路径。复杂对象允许保留显式例外，不能用通用公式强行抹平真实差异。

## 八，材料属于 Surface/Volume Program，不和几何身份混写

`surfaceProgram` 保存表面材料语义，包括底层材料、粗糙度、金属或介电属性、涂层、污染、磨损、湿润和微结构等。

OpenPBR、Substance 和 MaterialX 可以作为语义学习和交换参考。Object DNA 只保存对象需要的材料含义和状态。

体积对象保存自己的密度、吸收、散射、相位、发光等介质属性，不能强行翻译成表面 PBR 通道。

大缺口、厚度、支承和真实空腔仍属于结构或几何约束。法线和粗糙度不能替代它们。

## 九，状态与能力分开

`stateSchema` 记录当前必须记忆的状态。

`behaviorCapabilities` 记录对象允许发生哪些类型的状态变化。

稳定对象只保存必要状态，不能为了“未来可能用到”预先持续运行全部模拟。

状态变化必须显式：

`state_next = advanceObject(dna, state_now, dt, environment)`

只读查询不得暗改状态。

## 十，查询优先，按需重建

对象至少可以暴露以下通用函数族：

`describe(id, t)`

`query(id, x, t, precision)`

`measure(id, querySpec)`

`reconstruct(id, t, precision, observation)`

`surface(id, x, t, precision)`

`advance(id, state, dt, environment)`

不是每个对象都实现全部函数。

World Kernel 提供观察请求、物理请求、交互请求和预算。Object DNA 根据 `precisionPolicy` 决定当前展开哪些结构和频带。

同一个 DNA 可以重建远景轮廓、中景结构和近景 Microscope 细节。它们属于同一个对象，不是几套 LOD 资产。

## 十一，重建必须具有身份稳定性

对于同一个：

`ObjectDNA + state + time + precision + context`

如果输入一致，确定性对象的重建结果必须可重复。

相机移动只能改变需要计算的频带和观察输出，不能让固定纹理、孔洞、树枝或结构特征在对象表面游泳。

允许随机性的地方必须使用稳定种子和明确的随机域。

## 十二，精度是多维的

Object DNA 读取 World Kernel 的多维精度请求：

空间、时间、几何、物理、光学、语义、交互和观察精度。

例如背景竹林可以保持低叶片几何精度，同时保持正确的整体密度、物种语义和风响应。

近景一片叶子可以提高叶缘、叶脉和材料精度。

远处机械对象可以只保留可靠外轮廓和身份；需要测量时再提高截面和锚点精度。

任何系统都不允许把“最高精度”作为默认常驻状态。

## 十三，证据是 DNA 的一等成员

`evidenceLedger` 至少区分：

来源事实。

团队推导。

候选拟合。

有限小试验。

真实产品证据。

用户视觉接受。

生产就绪。

每个重要规则尽量记录：

来源。

适用对象。

置信度或不确定性。

有效范围。

已知反例。

验证方法。

候选平面、曲线、比例或材料解释不能因为算法拟合成功就自动升级为真值。

## 十四，Aircraft AN/M2 方法研究对 Object DNA 的具体贡献

2026年9月7日读取 `haihao0307/AIRCRAFT` 的 `feature/b24-weapons-mother-v1` 当前方法研究。其 HEAD 为 `ede1b4d6f5abc075250273f73579626418a397bb`，当前阶段明确为 `method-finding`，目标是建立可复用的机械数字资产编译方法。

本轮只吸收可泛化的数字资产方法：

参考资产与生产资产分离。

来源身份用哈希固定。

语义约束和可读配方长期保存。

测量与配准工具按任务选择。

CAD、Blender、GLB、Three.js 等属于可替换策略。

重复截面、轴、锚点、轮廓和距离适合成为对象重建的验证语言。

工具基准只在具体环境和具体输入下有效。

数值检查不等于历史正确，不等于视觉接受。

该线现有 R01 外观测量实验只作为 Object DNA 方法样本。它没有获得生产或视觉批准，本文件不改变 Aircraft 的正式任务、资产、用途或接受状态。

## 十五，第一批 Object DNA 模板

### TerrainObjectDNA

保存地理身份、真值绑定、点线掩膜锚点、波形或小波重建规则、地貌语义和子测量尺度细化策略。

### WaterBodyDNA

保存水体身份、海底绑定、潮汐和波状态接口、水面和水下光学、岸体约束与局部流场策略。

### CloudObjectDNA

保存云团身份、包络、粗状态、输运、细节和体积光学。

### VegetationObjectDNA

保存物种、个体或群落身份、空间边界、密度、年龄、结构生成、季节和环境响应。

### FarmlandObjectDNA

保存田块边界、所属农业系统、作物、种植历、田面高程、水管理、土壤状态、密度和人文管理约束。农田属于人文、地理和生态共同作用的对象，不能只按随机绿色覆盖生成。

### BuiltObjectDNA

保存轴线、构件语义、厚度、接触、支承、材料和使用状态。

### LivingObjectDNA

保存稳定身体身份、骨骼或结构、行为状态、感知和环境关系。皮肤、毛发和微观材料按观察带宽展开。

### MechanicalObjectDNA

保存对象身份、外部语义部分、稳定参考轴和锚点、已确认结构约束、表面程序、状态接口和证据。当前不把具体工具或参考网格固化为本体。

## 十六，统一验收

一个 Object DNA 只有在以下问题都有回答后，才进入真实产品适配：

时间绑定是否明确。

身份是否稳定。

真值和生成部分是否分开。

最小长期状态是否明确。

结构与材料是否分开。

来源资产是否可退出生产运行时。

相同输入能否重复重建。

不同精度是否来自同一对象定义。

零输入、A=0 或恢复路径是否存在。

证据和未知项是否公开。

性能是否在目标设备实际测量。

用户是否独立完成视觉接受。

## 十七，当前总原则

World Kernel 负责“世界何时、为何、以多高精度计算”。

Object DNA 负责“这个对象最少需要记住什么，才能在需要时重新成为它自己”。

一句话：

**对象不保存所有表象，对象保存足以维持身份、因果、结构、材料、状态、证据和可重建能力的最小关系。**

## 十八，状态

`parent=world_kernel`

`object_dna=candidate_core`

`aircraft_method_integrated=reviewed_general_principles`

`aircraft_production_modified=false`

`productionIntegration=false`

`runtimeImplementation=false`

`visualAcceptance=false`

`productionReady=false`
