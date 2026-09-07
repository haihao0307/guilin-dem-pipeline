# 给 Farmland Object DNA 执行者的启动交接 R1

日期：2026年9月7日

你接手的是一个独立的 Object DNA 子项目。小妈负责 World Kernel、Object DNA 总架构、知识启动和跨 Mother 边界；你负责把 Farmland 这一个对象系统继续研究深、做成可执行知识和后续产品接口。

## 你现在已经得到什么

你已经得到：

- World Kernel 的时间、身份、真值/状态、策略、精度、查询、函数、证据框架。
- Object DNA 的最小充分可重建对象框架。
- Farmland 的第一轮复合对象结构。
- 1940年代桂林北郊传统稻田 V0.1 知识包的地形、水、田块、土壤、季节、人口、牛力、村落和证据方法。
- 云南稻作仪式、傣族稻作伦理、哈尼梯田资源植物与传统知识、何乃健稻田生态思想等启动材料。
- 一个 seed schema 和明确的自主研究任务。

这些足够开工，但远远不够宣布“懂农业”。

## 你的第一职责

把知识继续往下蒸馏：

`source -> observation -> hypothesis -> test -> rule -> function -> profile -> product evidence`

每次遇到具体地方和年代，都必须重新找地方证据。

## 你不要依赖小妈逐条喂知识

你应该自己去查：

农学。

农业史。

水文学与灌溉。

土壤学。

作物生理。

生态学。

民族植物学。

农业人类学。

土地制度与村落史。

历史航片、地图、照片和地方志。

优先权威原始来源和一手资料，避免把二次摘要直接升格为真值。

## 你必须自己建立的知识模块

至少逐步形成：

`LandSuitabilityKernel`

`FieldParcelKernel`

`WaterAndDrainageKernel`

`PaddySoilKernel`

`CropCycleKernel`

`AgroEcologyKernel`

`LaborCapacityKernel`

`SettlementFarmNetwork`

`LandAndWaterInstitutionKernel`

`CulturalCalendarKernel`

`HistoricalProfileSystem`

`FarmlandVisualEvidenceKernel`

名字可以调整，职责不能混掉。

## 与其他 Mother 的边界

### Landscape Mother

你不拥有原始 DEM 和自然地貌真值。

你拥有农业人工整地、田块、田埂、沟渠、田路和农事状态。

需要改变自然地形时，保存农业 earthwork overlay，不能偷偷重写地理真值。

### Weather Mother

你读取降雨、温度、太阳、湿度、风、云和暴雨事件。

你自己计算农田水量、作物、泥泞、倒伏、病虫代理、劳动窗口等农业响应。

### Ocean Mother

只有存在真实海岸水文连接时才读取潮汐、盐度、风暴潮或海岸地下水边界。

内陆农田默认不需要 Ocean。

### Vegetation / Plant 系统

你定义作物群体和农业生态角色。

具体植物几何和生长表现可调用植物系统，但 Farmland 保留“为什么这种植物在这里、承担什么农业角色”的语义。

### Human / Animal

你提供劳动任务、地点、时间窗口、工具和役畜需求。

Human/Animal 执行动作和身体运动，不由 Farmland 自己发明人体动作。

## 第一轮必须交回小妈的答卷

标记：`FARMLAND_OBJECT_DNA_R1_REPLY`

回答：

1. 你怎样定义 AgroSystem、FieldParcel、CropPopulation 三个身份？
2. 为什么水田不能从绿色材质开始生成？
3. 自然 DEM 与人工造田地形如何同时保存？
4. 活跃水田最小水拓扑是什么？
5. 哪些状态必须跨季节或跨年份保存？
6. 人口为什么能限制田面积？给出你的第一版函数和它的未知参数。
7. 仪式如何进入系统，同时不冒充物理力？
8. 哈尼资料能教你什么，又绝对不能直接拿去桂林做什么？
9. Weather、Landscape、Ocean 三条接口分别由谁拥有哪些变量？
10. 选一个你认为启动包仍然不够清楚的问题，自己查一组权威资料，并做一个最小试验。

## 理解通过标准

“已读”不算。

要达到：

能解释。

能预测变量变化。

能指出反例。

能做隔离小试验。

能连到一个真实 Farmland Profile。

最终仍要经过真实产品证据和用户视觉接受。

## 保护边界

不要修改 World Kernel 核心真值。

不要替 Landscape、Weather、Ocean 改各自生产线。

不要把云南资料直接当桂林真值。

不要把现代农业默认塞进历史农业。

不要因为做出漂亮一帧就宣布 DNA 已完成。

不要把大量随机噪声当作农业复杂性。

## 当前状态

`startup_received_by_repository=true`

`executor_acknowledgement=not_observed`

`executor_research=required`

`productionIntegration=false`

`visualAcceptance=false`

`productionReady=false`
