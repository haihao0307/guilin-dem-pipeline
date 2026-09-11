# Farmland Object DNA

Farmland Object DNA 是 `guilin-dem-pipeline` 中面向传统农业对象的独立领域系统。它与 Weather Mother、Ocean Mother、Landscape Mother、DEM、Settlement、Human、Animal 和 Building 等领域协作，负责农田对象自身的身份、结构、水力关系、生命周期、劳动关系、维护、退化与可重建参数。

## 当前生产线

当前版本：`0.2.0-clean-restart`

当前分支：`restart/farmland-object-dna-v020-20260907`

入口：`RESTART_START_HERE.md`

工作单：`PRODUCTION_RESTART_TASKS.md`

全量包：`distributions/Farmland_Object_DNA_Full_Clean_Restart_2026-09-07_V0.2.0.zip`

R025 桥梁包：`distributions/bridges/r025-xiaoma-tlo-dem/Farmland_Object_DNA_Xiaoma_TLO_DEM_Bridge_R025_2026-09-11.zip`

V0.1 公开工作台已被用户否决，只保留为失败对照。当前没有可分享的视觉候选，也没有人工视觉接受或生产批准。

当前研究续接到 R025：R021 建立可复算水量账本，R022 建立理想截面与六种
合成水力情形，R023 锁定红河哈尼地区证据边界并建立坐标级田块拓扑内核，
R024 建立十四阶段水稻器官与结构事件合同，R025 接收小妈 TLO 候选通信合同与
桂林 canonical DEM 身份边界。当前没有接通数值地形；桂林 12.5 m DEM 不覆盖
红河，也不能代替田间级测绘。地区构件测绘、水稻地方品种参数和阶段几何资产
仍未完成，不能提升为地区结构样板。R025 已打成可复算的跨 Mother 桥梁包，
交给小妈 / TLO、DEM / Landscape 与下一位 Farmland 执行者；该包只交换合同、
证据回执、验证器和当前源码，不携带数值 DEM、受保护门户内容或视觉资产。

## 严谨生产路线

每个对象必须依次完成：

1. 来源与证据。
2. 系统关系。
3. 平面、纵断面和横断面。
4. 真实尺寸与人体尺度。
5. 水力拓扑、高程合法性和水量守恒。
6. 作物种植和生命周期。
7. 内部结构真值台。
8. 3A 材质、色彩、光照、空气和运动。
9. Microscope 微观变化。
10. 多视角、剖面、桌面和手机预检。
11. 公开候选与用户人工验收。

前一阶段没有通过时，后一阶段不得开工。简单圆管、锥体、平面贴片、机械格网和孤立图标只能作为带 `debug_proxy` 标识的内部代理体。

## 第一对象族

水田是首个重点对象。基础构件包括：

`field_cell`

`shared_bund`

`terrace_step`

`terrace_riser`

`intake`

`trunk_channel`

`branch_channel`

`field_channel`

`divider`

`field_inlet`

`field_outlet`

`spillway`

`drainage_channel`

`downstream_receiver`

`water_surface`

`crop_stand`

`footpath`

`maintenance_group`

`water_right_holder`

水田对象必须回答：在哪里，为什么能形成这个形状，水从哪里来，怎样进入每块田，怎样蓄水，怎样离开，最终流向哪里，谁在什么时候维护，当前作物与土水状态是什么。

## 平坝水田与山地梯田

平坝水田和山地梯田共用对象、证据、水深和守恒合同。二者使用不同的地形适配和水路拓扑。

平坝水田重点研究微地形、主支渠、田间分水、共享田埂、汇水沟、道路、人体和劳动模数。

山地梯田重点研究等高关系、沟谷和脊线、平台宽度、田坎稳定、干支渠、逐级供排水、坡脚受体以及森林、水源、村落和共同维护。

## 元阳专项

元阳和红河哈尼梯田属于专门地区配置。必须把上部水源林、泉水和溪流、取水、干渠、支渠、村落、分水制度、梯田、坡脚排水和河谷受体作为一个完整文明系统研究。

木刻、木柱或木棍分水装置的名称、结构、插设方式、比例、水权和维护在证据充足以前保持 `research_target`。

## 水稻生命周期

水稻至少区分育秧、起秧、插秧、返青、分蘖、拔节、孕穗、抽穗、开花、灌浆、成熟、收割和残茬。插秧配置保存秧龄、每穴苗数、株距、行距、插植深度、角度、田面水深、缺株率、补苗率和作业方式。

每个阶段必须使用独立形态模型。R024 进一步要求育秧、起秧、插秧、返青、
分蘖、拔节、幼穗分化、孕穗、抽穗、开花、灌浆、成熟、收割和残茬分别具有
独立几何族、拓扑事件和器官状态。禁止通过同一个简单几何缩放和换色冒充完整
生命周期。当前合同只完成物种级结构规格，24 项地区参数和全部几何资产仍为空。

## Microscope

Microscope 只在宏观系统、中观拓扑、截面、尺寸和水力通过以后启用，用于田埂土块、石头、草根、湿润线、踩踏、淤积、冲刷、泥浆、叶片、分蘖节点、稻穗和籽粒等微观变化。

## 后续扩展

水田基础通过以后，沿用共同的地形、水、土壤、气候、道路、村落、人口、劳动、边界和维护层，依次扩展旱地、菜地、果园、苗圃和休耕地。

## 当前状态

`researchGate=in_progress`

`crossMotherIntake=r025_tlo_candidate_and_guilin_dem_identity_locked_numeric_terrain_not_connected`

`bridgePackage=r025_verified_deterministic_handoff_118_tests`

`structuralTruthWorkbench=foundation_r025_contracts_only_no_visual_workbench`

`activePublicCandidate=none`

`visualAcceptance=false`

`productionReady=false`
