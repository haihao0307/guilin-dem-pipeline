# Farmland Object DNA Contract V0.0.1

## 目标

Farmland Object DNA 用一组可追踪、可组合、可重建的参数描述农田对象。对象定义覆盖身份、空间、结构、水系、土壤、作物、劳动力、季节、维护、退化、证据和渲染派生状态。

## DNA 层

1. Identity DNA

保存 world_id、object_id、type_id、variant_id、configuration_id、revision、valid_time、recorded_at、evidence 和 review_status。身份与位置分开，历史事实、推断、生成和未知分开。

2. Spatial DNA

保存 CRS、局部坐标系、垂直基准、边界、面积、坡度统计、朝向、海拔范围及与 DEM 的采样依据。农田几何必须贴合权威地形，不改写 DEM 真值。

3. Parcel DNA

描述田块边界、田埂、梯级、入口、机耕或人行通道、邻接田块、所属农户或聚落关系。传统人工农业默认允许细碎、不规则并受地形约束的田块。

4. Hydraulic DNA

描述水源、取水口、主渠、支渠、田间进水口、田面水层、溢流口、排水沟、下游受体和连接方向。水网是有向关系图，田块之间允许串联、并联和分级供水。

5. Soil DNA

描述土层厚度、质地、渗透、保水、田底致密层、泥化状态、有机质和盐分等可用参数。未有数据的字段保留 unknown 或 generated，不冒充实测。

6. Crop DNA

描述作物种类、品种、种植方式、株行配置、覆盖率、生育阶段、根区深度、生物量代理值和收获状态。第一重点为水稻，后续可扩展其他农作物。

7. Labor Settlement DNA

描述维护该对象所需的人工任务、季节性劳动峰值、服务人口、农户或聚落关系和可维护面积约束。传统农业规模必须与人口、距离、工具和生产力相容。

8. Calendar DNA

描述整地、育秧、插秧、灌溉、除草、施肥、收获、晒田、冬闲等状态转换。时间精度按证据保存，可使用月、旬、日或更粗粒度，不强制补足不存在的日期。

9. Maintenance DNA

描述田埂修补、清沟、补水、排水、堵漏、除草、泥浆维护和设施更换。维护会改变对象状态，并影响后续渗漏、蓄水和可用性。

10. Degradation DNA

描述弃耕、破埂、淤积、漏水、侵蚀、杂草侵入、渠系失效、盐碱化等长期变化。退化必须有时间尺度和因果链，不只用随机噪声模拟旧化。

11. Coupling DNA

记录从 Weather、Ocean、水文、DEM、Landscape、人口和建筑聚落系统读取的输入，以及向这些系统发布的输出。每个共享字段必须有明确责任方。

12. Representation DNA

保存程序化几何种子、实例化策略、材质参数、作物密度代理、近景几何等级和运行成本预算。表示层可以重建视觉对象，但不能改写历史与自然过程语义。

## 对象族

V0.0.1 预留六类：paddy、dry_field、vegetable_garden、orchard、nursery、fallow。

paddy 首先细化为：field_cell、bund、terrace_step、inlet、outlet、irrigation_channel、drainage_channel、water_surface、crop_stand、footpath。

## 关系

至少支持 adjacent_to、upstream_of、downstream_of、feeds、drains_to、contains、belongs_to_household、belongs_to_settlement、served_by_path、bounded_by、occupies_terrain、affected_by_weather。

关系必须有有效时间和来源。地理邻接不等于水力连通，水力连通不等于产权或行政关系。

## 核心约束

1. 田块面积、数量与服务人口和生产力存在可检查的关系。
2. 水稻田必须具备可解释的供水和排水路径。
3. 坡地水田必须通过梯级、田埂或其他结构形成可蓄水面。
4. 水流方向不能只根据画面美观决定。
5. 农田边界优先响应地形、水系、道路、聚落、产权和人工维护历史。
6. 所有生成细节保存种子和方法版本。
7. 历史模式下只把有依据的事实标记为 observed。
8. 人工视觉接受和生产批准保持独立状态。
