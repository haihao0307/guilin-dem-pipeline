# Farmland Object DNA 启动框架 R1

日期：2026年9月7日

状态：知识灌输与启动框架。后续 Farmland Object DNA 执行者必须继续自行研究、校准和验证。

## 一，Farmland 的对象本体

Farmland 不是一种表面类型，也不等于“田块 polygon”。

它是一个跨时间持续存在的复合对象：自然基底被人类整形、分配、供水、耕作、维护、收获、储藏，再通过肥力、劳动、生态和文化循环继续维持。

建议定义：

`Farmland = NaturalBase + BuiltFieldInfrastructure + CropSystem + HumanManagement + Agroecology + HistoricalState`

其中任何一项缺失，都可能使“看起来像农田”的画面缺乏因果解释。

## 二，多尺度身份

Farmland 至少需要三级身份：

### 1. AgroSystem

一个村落、灌区、山谷或历史农业单元的整体系统。

它持有：水源、道路、村落、劳力、役畜、公共水利、主要作物制度和社会规则。

### 2. FieldParcel

单块具有边界、目标田面、进排水、所有权/使用权和作物状态的田。

### 3. CropPopulation

某块田某季实际存在的作物群体。

它有品种、播栽时间、密度、发育期、健康和收获状态。

这样才能避免把“田”“稻”“本季稻”混成一个身份。

## 三，时间模型

Farmland 对 World Kernel 的时间接口至少区分：

`t_world` 世界时间。

`t_farm_history` 田地历史时间，例如造田年龄、弃耕年数、长期泥化历史。

`t_crop_cycle` 当前作物季时间。

`t_management` 管理事件时间，例如灌水、修埂、插秧、收获。

`t_cultural_calendar` 地方节令与仪式时间，仅在具体文化 Profile 有证据时启用。

`t_view` 观察时间。

`t_phase` 纯视觉相位，不能改变固定田块身份。

长期状态示例：

`hardpan_strength`

`bund_compaction`

`soil_organic_state`

`canal_siltation`

`field_age`

`ownership_history`

`water_right_state`

`knowledge_transmission_state`

短期状态示例：

`crop_stage`

`water_depth`

`soil_surface_moisture`

`weed_pressure`

`pest_pressure`

`labor_activity`

`harvest_residue`

## 四，空间与地形

### 原则

农田必须建立在真实地形之上，并明确哪些高程属于自然 Truth，哪些属于历史人工整形。

Landscape/DEM 提供自然或历史基底。

Farmland DNA 保存人类造田造成的局部地形改造：整平、梯级、田埂、田坎、沟渠、进出水口、田间路。

不得静默覆盖 DEM 真值。建议保留：

`baseTerrainTruth`

`agriculturalEarthworkOverlay`

`currentManagedSurface`

### 稻田特殊规则

活跃水田田面必须接近可控水平面。

坡地通过分级和田坎消化高差。

平坝仍受微地形、旧沟渠、道路、产权和水流方向切分。

田块形状是因果结果，不是随机矩形阵列。

## 五，水系统

Paddy profile 的基本拓扑必须能解释：

`catchment -> source -> intake -> supply -> field inlet -> paddy water -> outlet -> lower field/drain -> receiving water`

每块活跃水田至少回答：

`has_water_source_path`

`has_inlet`

`has_outlet`

`has_drainage_path`

`water_surface_elevation`

`control_capacity`

水损失拆开：

`deep_percolation`

`bund_seepage`

`hole_leak`

`outlet_loss`

`overflow`

Weather 提供降水、蒸散相关环境和太阳辐射等外部量；Farmland 决定这些量如何改变田块水状态。

Ocean 只有在真实水文连接成立时介入，例如潮汐、风暴潮、盐水入侵、海岸地下水或沿海排水。内陆田默认不调用 Ocean。

## 六，土壤与田龄

土壤不能只是一个颜色。

最低需要：

`soil_type_or_profile`

`surface_mud_state`

`permeability_proxy`

`organic_matter_state`

`compaction`

`puddling_history`

`hardpan_strength`

`crack_state`

`erosion_deposition`

`nutrient_state`

新田、熟田、弃田必须产生不同的水控和表面特征。

长期泥化与踩压可以改变渗漏特性；弃耕后干裂、根系和动物洞穴会改变原有封水关系。

## 七，田埂、田坎、沟渠和道路

这些都属于基础设施对象，不只是装饰线。

`BundDNA` 至少保存：

边界身份。

实际高程。

阻水能力。

宽度与通行能力。

植被状态。

维修历史。

裂损、鼠洞、冲刷和缺口。

进出水口属于结构缺口，必须和水控制绑定。

永久埂与季节性小埂应分开。

沟渠还要区分供水和排水角色。

道路、田埂、沟渠可以共享空间，但交叉时需要桥、涵洞、踏石或高程关系。

## 八，作物系统

Generic Farmland Core 不默认水稻。

每种作物使用 `CropProfile`。

Paddy Rice Profile 至少有：

`cultivar_or_landrace`

`nursery_or_direct_seed`

`planting_date`

`transplant_date`

`phenology`

`plant_height`

`density`

`row_pattern`

`lodging_state`

`disease_state`

`pest_state`

`harvest_date`

`seed_reserve_relation`

`residue_state`

稻株视觉不能直接由月份硬切颜色；月份先驱动作物发育和管理，再由状态生成外观。

## 九，生态系统

Farmland 周围的植物、动物和微生物不能全部视为杂物。

需要显式区分：

作物。

伴生植物。

杂草。

田埂稳定植物。

水源涵养植物。

饲料/食用/药用/生产资料植物。

害虫。

天敌。

传粉或其他功能动物。

役畜。

微生物和分解过程代理。

云南哈尼资料提示，传统农业系统的稳定可以横跨森林、村寨、梯田、水系和资源植物。这个结论只作为“农田边界可能大于田块”的结构启发，不把云南物种名录直接移植到桂林或其他地区。

## 十，劳动、役畜与工具

传统农业的可维护面积受到峰值劳动窗口约束。

建议：

`maintainable_area = min(water_capacity, labor_capacity, animal_power_capacity, transport_capacity, suitable_land_capacity)`

这是启动模型，不是完成公式。

劳动不能只存“人口总数”，还要有：

可劳动人口。

技能。

季节可用天数。

邻里互助。

性别/年龄分工仅在地方资料支持时启用。

役畜和工具属于生产能力节点。

1940年代北广西 Profile 可把水牛作为高优先级候选，但具体家庭牛数和工作效率需要地方证据校准。

## 十一，聚落、储藏和物质循环

Farmland 与村庄之间至少建立：

`field_to_home_route`

`field_to_thresing/drying_area_route`

`field_to_storage_route`

`manure_to_field_route`

`straw_residue_route`

`water_access_route`

附属空间可包括：住宅、牛圈、猪禽空间、晒场、谷仓、肥堆、工具空间、稻草堆、井、塘、桥和田间路。

物质循环至少考虑：

作物收获。

种子留存。

稻草/秸秆去向。

粪肥。

草木灰。

沟塘淤泥。

有机废弃物。

任何“肥力循环”都必须按地点与年代验证，不能把现代生态农业做法反投到历史场景。

## 十二，社会制度

Farmland DNA 必须允许记录：

`ownership`

`tenancy`

`inheritance_partition`

`shared_irrigation`

`water_right`

`labor_exchange`

`village_maintenance_rule`

`tax_or_tribute_relation`

这些关系会真实塑造田块碎片、道路、水渠、劳动组织和农忙节奏。

傣族资料显示，稻作水利可以跨家庭和村寨形成协作组织，并且长期农业知识使长者在社会中承担知识节点。这个材料用于证明“社会制度可成为农业结构变量”，不能作为所有地区的统一制度。

## 十三，地方知识、仪式与文化

文化信息进入 Farmland DNA 时必须使用正确的因果通道。

谷魂、谷神、开秧门、关秧门、尝新等内容不能直接写成改变物理水流或植物生长的超自然力。

它们可以影响：

农事日程。

共同劳动开始/结束节点。

田间禁忌或访问规则。

种子选择与保留。

谷仓、供奉和储粮行为。

节庆和村寨活动。

知识传承。

生态保护行为。

不同民族、村寨和年代的仪式不能互相拼接。必须由 `CulturalProfile` 绑定地点、族群、年代和来源。

## 十四，天气接口

Farmland 从 Weather/Cloud 读取只读环境：

`precipitation`

`temperature`

`solar_radiation`

`humidity`

`wind`

`cloud_optical_state`

`storm_event`

Farmland 产生响应：

水量变化。

灌排需求。

泥泞程度。

作物发育速度。

倒伏风险。

病虫风险代理。

劳动可执行窗口。

收割和晾晒窗口。

Weather 不能直接替 Farmland 改田埂、作物身份或产权。

## 十五，历史与扰动

Farmland 必须能经历：

新垦。

成熟维护。

洪水/旱灾。

战争或人口迁移。

基础设施损坏。

改种。

弃耕。

复耕。

现代化替换。

这些变化进入 `history`，不能用每次加载时的随机外观代替。

1940年代桂林 Profile 要把战争、机场活动和人口扰动列为待查历史变量，但当前启动包没有足够证据给出具体影响范围。

## 十六，证据制度

任何规则都附：

`source`

`place`

`date_range`

`evidence_level`

`supports`

`does_not_support`

`confidence`

`valid_range`

`local_calibration_required`

`production_adopted`

本轮沿用桂林启动包的 A/B/C/D 兼容逻辑：

A：同地点同年代直接证据。

B：同地区近年代。

C：跨地区但机理可靠。

D：类比或启发。

文化类资料再增加 `ethnic_and_cultural_scope`，避免跨族群错误推广。

## 十七，查询接口

候选函数：

`describeFarmland(systemId, t)`

`queryParcel(parcelId, t, precision)`

`queryCrop(parcelId, t, precision)`

`queryWaterDemand(parcelId, t, weather)`

`queryWaterPath(parcelId)`

`queryLaborDemand(systemId, timeWindow)`

`queryMaintainableArea(systemId, timeWindow)`

`queryEcologicalContext(parcelId, t)`

`queryCulturalEvent(systemId, t)`

`queryHistoricalEvidence(ruleId)`

`advanceFarmland(systemState, dt, weather, management, disturbance)`

查询默认无副作用；只有 `advance/apply/commit` 改变状态。

## 十八，和三个 Mother 的接口

### Landscape Mother

负责：自然地形、地貌语义、主形、地理位置。

Farmland 请求：坡度、曲率、汇流、适宜面、可整平区域。

Farmland 返回：农业人工整形 overlay、田块、田埂、沟渠、道路和季节状态。

Landscape 不能把田直接当材质刷上去。

### Weather Mother

负责：天气和云环境状态。

Farmland 消费环境并计算农业响应。

天气变化不直接改写田块身份。

### Ocean Mother

仅在实际海岸水文连接存在时加入潮汐、盐度、沿海洪涝或排水边界。

没有连接时返回 `ocean_influence=none`。

## 十九，第一轮验证场景

建议下游执行者不要马上生成一万亩田。

先做一个小型可解释系统：

一个村落。

一条可靠水源。

一个供水渠和一个排水路径。

12至30块田。

2至3种田龄。

一个单季稻作循环。

有限劳动力和1至若干役畜。

至少一个旱/暴雨扰动。

固定相机和日期切换。

检查：水、地形、劳动、季节、生态和文化关系是否都能解释。

通过后再扩大空间。

## 二十，禁止的捷径

禁止随机绿色矩形铺满适宜区。

禁止没有进排水关系的水田。

禁止所有田同尺寸、同方向、同颜色。

禁止用材质假装真实田埂高度或梯级。

禁止把现代机械、化肥、泵站、混凝土渠默认塞进历史 Profile。

禁止把云南族群仪式和物种直接当桂林地方事实。

禁止把气候变化直接写成颜色变化而不经过作物与水状态。

禁止把稻田的生态多样性压缩成“多加噪声”。

禁止把用户看起来满意自动等同历史正确或物理正确。

## 二十一，成功标准

Farmland DNA 的成功不看参数数量，而看它是否能回答：

为什么田在这里？

为什么是这个形状？

水从哪里来？

谁在维护？

为什么现在是这个季节状态？

这块田和村庄、森林、道路、动物、文化有什么关系？

改变天气、人口、时间和管理以后会发生什么？

这个结论来自哪条证据？

下次同类问题能否直接复用已经验证的函数，而不从头猜？
