# Farmland Object DNA Contract V0.1.1

## 目标

Farmland Object DNA 用一组可追踪、可组合、可重建的参数描述农田对象。对象定义覆盖身份、空间、结构、水系、土壤、作物、劳动力、季节、维护、退化、证据和渲染派生状态。

本合同必须与 `FARMLAND_PRODUCTION_RULES.md` 和 `V001_FAILURE_REGISTER.md` 一起读取。前者规定强制生产门槛，后者保存已否决路径。

## DNA 层

### 1. Identity DNA

保存 world_id、object_id、type_id、variant_id、configuration_id、revision、valid_time、recorded_at、evidence 和 review_status。身份与位置分开，历史事实、推断、生成、未知和冲突分开。

R025 增加一个不冻结核心 schema 的 TLO 通信 checkpoint 候选：`T` 保存记录、
世界、有效、事件与来源版本时间，`L` 保存参考系、位置、姿态、容器、不确定性
与来源，`O` 引用稳定对象身份、Object DNA、状态、关系和证据。当前候选只用于
跨 Mother 传递最小充分上下文；扩展名、物理容器与最终 relation ontology 未定。
详见 `research/r025-xiaoma-tlo-dem-intake/`。

### 2. Spatial DNA

保存 CRS、局部坐标系、垂直基准、边界、面积、坡度统计、朝向、海拔范围及与 DEM 的采样依据。农田几何必须贴合权威地形，不改写 DEM 真值。

Spatial DNA 还要保存坡面曲率、沟谷、脊线、集水区、自然排水方向和局部高差。田面平整属于农田构造结果，原始地形继续保留可追溯引用。

### 3. Parcel DNA

描述田块边界、共享田埂、梯级、入口、人行或畜力通道、邻接田块、所属农户或聚落关系。传统人工农业允许细碎、不规则并受地形、水路、道路、劳动与产权历史约束的田块。

相邻田块共享边界时，只生成一个 bund 实例。该实例同时引用两侧田块，并分别保存两侧水位、湿润和维护状态。

### 4. Hydraulic DNA

描述水源、取水口、引水渠、干渠、支渠、分水设施、田间进水口、田面水层、溢流口、控制出水口、排水沟、下游受体和连接方向。水网是有向关系图，田块之间允许串联、并联和分级供水。

每条边至少保存起点、终点、长度、渠底高程、纵坡、截面、糙率、材料、当前流量、当前水位、渗漏、淤积和维护状态。每个节点至少保存节点类型、控制状态、底高程、开口几何、上游水头、下游水头和分流规则。

每一块灌溉田必须具有从水源到下游受体的闭合可追踪路径，并通过高程合法性、水量守恒、断流、堵塞、暴雨和破埂测试。

### 5. Soil DNA

描述土层厚度、质地、渗透、保水、耕作层、泥化层、犁底层或低渗层、有机质、盐分、地下水和结构稳定等参数。未有数据的字段保留 unknown 或 generated。

田埂、田坎和渠道土体可以引用 Soil DNA，同时保存压实度、含水率、根系加固、侵蚀和修补状态。

### 6. Crop DNA

描述作物种类、品种、种植方式、秧龄、每穴苗数、株距、行距、插植深度、插植角度、缺株率、补苗率、覆盖率、生育阶段、根区深度、生物量代理值和收获状态。

水稻必须区分育秧、起秧、插秧、返青、分蘖、拔节、孕穗、抽穗、开花、灌浆、成熟、收割和残茬。每个阶段保存叶片数量和角度、株丛宽度、分蘖数量、茎秆高度、穗部状态、颜色、倒伏概率、风响应和可见水面比例。

简单锥体或同一代理体的缩放与换色不能作为正式水稻阶段模型。

### 7. Labor Settlement DNA

描述维护该对象所需的人工任务、季节性劳动峰值、服务人口、农户或聚落关系、步行距离、运输路径、畜力、工具和可维护面积约束。传统农业规模必须与人口、距离、工具和生产力相容。

元阳等山地系统还要描述护林、清渠、分水、修埂、用水协调和灾害修复的共同劳动关系。

### 8. Calendar DNA

描述整地、育秧、插秧、灌溉、除草、施肥、晒田、抽穗、成熟、收获、排水、冬闲和维修等状态转换。时间精度按证据保存，可使用月、旬、日或更粗粒度，不强制补足不存在的日期。

每个状态转换必须说明触发条件、区域气候、品种、生产方式和允许误差。

### 9. Maintenance DNA

描述田埂修补、清沟、补水、排水、堵漏、除草、泥浆维护、分水设施调整、护坡、石块复位和设施更换。维护会改变对象状态，并影响后续渗漏、蓄水、通行和可用性。

### 10. Degradation DNA

描述弃耕、破埂、淤积、漏水、侵蚀、杂草侵入、渠系失效、田坎坍塌、滑坡、盐碱化和森林破坏等长期变化。退化必须有时间尺度和因果链，不能只用随机噪声模拟旧化。

### 11. Coupling DNA

记录从 Weather、Ocean、水文、DEM、Landscape、人口、建筑聚落和动物系统读取的输入，以及向这些系统发布的输出。每个共享字段必须有明确责任方。

元阳配置中，森林涵养、水源、村落生活用水、灌溉、梯田、水生动物、牲畜和下游水体要通过显式接口连接。

### 12. Representation DNA

保存程序化几何种子、实例化策略、材质参数、作物密度代理、近景几何等级、Microscope 层和运行成本预算。表示层可以重建视觉对象，不能改写历史与自然过程语义。

正式公开候选不得显示圆管渠道、圆管田埂、圆锥水稻、无厚度边界、机械格网和孤立水力图标。临时代理体必须标记 debug_only，并在公开候选中关闭。

## 构件最小合同

### irrigation_channel 与 drainage_channel

必须保存 plan、longitudinal_section、cross_section、bed_elevation、bed_width、top_width、design_depth、current_depth、freeboard、side_slope、roughness、lining_or_soil、flow_direction、flow_rate、sediment、vegetation、seepage、erosion、maintenance 和 crossings。

### bund

必须保存 crest_width、crest_elevation、height、base_width、inner_slope、outer_slope、compaction、material、grass_cover、wet_line、walkability、served_fields、damage 和 repair_history。

### terrace_step

必须保存 platform_width、platform_slope、riser_height、riser_slope、crest、toe、retaining_material、seepage、drainage、stability、upstream_field 和 downstream_field。

### inlet、outlet 与 divider

必须保存 invert_elevation、opening_geometry、control_method、upstream_head、downstream_head、capacity、erosion_protection、operator_or_right_holder 和 current_state。

传统木刻、木柱或木棍分水装置在构造和比例没有查明以前，只能使用 evidence_status=research_target。

### field_cell 与 water_surface

必须保存 bed_elevation_field、mud_surface_elevation、water_surface_elevation、depth_field、storage_area、storage_volume、bund_crest_minimum、inflow、outflow、rainfall、evaporation、seepage、overflow 和 mass_balance_error。

### crop_stand

必须保存 cultivar、stage、seedling_age、hill_count、seedlings_per_hill、spacing、planting_depth、height_distribution、tiller_distribution、leaf_geometry、panicle_state、grain_state、color_state、lodging、wind_response 和 harvest_state。

R024 把 crop_stand 的最小生命周期扩展为 nursery、lifting_seedlings、
transplanted、establishment、tillering、stem_elongation、panicle_initiation、
booting、heading、flowering、grain_filling、maturity、harvest 和 stubble。
每一阶段必须有独立 geometry_family_id、拓扑事件、器官显隐和结构签名；阶段
参数必须引用地区测量配置。合同对象不得内嵌无来源的株高、分蘖数、叶片、穗、
籽粒、割茬、色彩或风响应数值。

## 对象族

V0.1.1 预留六类：paddy、dry_field、vegetable_garden、orchard、nursery、fallow。

paddy 首先细化为：watershed_forest、spring_or_stream_source、intake、main_channel、branch_channel、divider、field_cell、bund、terrace_step、inlet、outlet、spillway、drainage_channel、water_surface、crop_stand、footpath、settlement_link 和 downstream_receiver。

## 关系

至少支持 adjacent_to、upstream_of、downstream_of、feeds、drains_to、divides_to、contains、belongs_to_household、belongs_to_settlement、maintained_by、served_by_path、bounded_by、shares_boundary_with、occupies_terrain、protected_by_forest、affected_by_weather 和 discharges_to_receiver。

关系必须有有效时间和来源。地理邻接、水力连通、产权、用水权和维护责任分别保存。

## 核心约束

1. 田块面积、数量与服务人口、劳动、工具和生产力存在可检查关系。
2. 水稻田具备可解释且闭合的供水和排水路径。
3. 坡地水田通过梯级、田埂、田坎和排水结构形成稳定可蓄水面。
4. 水流方向由高程、渠槽、控制设施和水头决定。
5. 农田边界优先响应地形、水系、道路、聚落、产权和人工维护历史。
6. 渠道、田埂、田坎、田面、进水、出水和分水设施都要有真实截面。
7. 水深必须与世界坐标、田面和出水口高程一致。
8. 不同水稻阶段具有不同结构、密度、颜色和风响应。
9. 所有生成细节保存种子和方法版本。
10. 历史模式下只把有依据的事实标记为 observed。
11. Microscope 只能在宏观系统、中观拓扑和截面通过后进入。
12. 人工视觉接受和生产批准保持独立状态。

## 失败基线

`FARMLAND_DNA_WB_V0.1.0_20260907` 已被用户否决，详见 `V001_FAILURE_REGISTER.md`。它只用于负面对照，禁止作为下一候选的造型基础。
