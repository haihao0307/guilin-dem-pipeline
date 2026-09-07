# Farmland Object DNA Interface Contract V0.1.1

## 共享原则

Farmland Object DNA 在同一 world_id、time、revision 和空间参考下读取外部状态。共享输入必须记录来源、单位、有效时间和责任方。Farmland 不自行制造第二套天气、海面、水位、DEM、森林或人口权威状态。

本合同与 `FARMLAND_PRODUCTION_RULES.md`、`OBJECT_DNA_CONTRACT.md` 和 `QUALITY_GATES.json` 共同执行。

## 来自 DEM 与 Landscape

读取：terrain_elevation、terrain_slope、terrain_aspect、terrain_curvature、ridge_mask、valley_mask、flow_direction、flow_accumulation、surface_normal、terrain_mask、hydrologic_context、obstacle_or_rock_context。

用途：确定田块能否成立、梯级平台、田坎高度、田埂位置、渠道纵坡、进排水底高程、道路连接和地形适应。

保护：不得改写权威高程、AOI、真值哈希或用视觉修饰替代真实地形。农田切填产生的局部构造层必须保存相对原始地形的差值和方法版本。

## 来自森林、植被与流域系统

读取：watershed_boundary、forest_type、forest_cover、recharge_function、spring_recharge_context、erosion_control_context、protected_forest_boundary、vegetation_root_stability。

用途：解释水源涵养、泉水持续性、坡面稳定、泥沙来源、蒸散和元阳等山地水田系统的上游保护关系。

输出：farmland_water_demand、channel_maintenance_effect、erosion_or_sediment_feedback、forest_dependency_relation。

Farmland 不得为了增加田块面积删除受保护的集水森林。森林数据未知时，保持 unknown，并阻止元阳完整系统候选进入生产批准。

## 来自 Weather Mother

读取：precipitation_rate、air_temperature、relative_humidity、wind_vector、solar_radiation、cloud_state、evaporation_driver、storm_intensity 和 antecedent_wetness。

用途：作物生育、水面蒸发、土壤湿润、田间作业可行性、倒伏、侵蚀、溢流和材料湿润等状态推进。

Farmland 输出可供 Weather 或联合世界读取：canopy_cover、surface_wetness、surface_roughness、evapotranspiration_demand、standing_water_area 和 crop_height_distribution。

## 来自 Ocean Mother 与沿海水域

读取：coastal_water_level、tide_state、salinity_boundary、storm_surge_boundary，仅在对象位于相关沿海或潮汐影响区时启用。

用途：检查潮水倒灌、排水受阻、盐分风险和沿海农田水位边界。

Farmland 不计算全局潮汐和海洋状态。

## 来自水文或可用水源系统

读取：source_id、source_type、source_water_level、source_discharge、source_reliability、river_or_canal_connectivity、groundwater_context、water_quality_if_known、downstream_receiver、environmental_flow_constraint 和 allocation_window。

输出：irrigation_demand、withdrawal_request、accepted_withdrawal、field_storage_change、field_overflow、drainage_discharge、return_flow、seepage、sediment_return 和 water_quality_effect_if_modeled。

供水不足时允许 crop_water_stress、partial_irrigation、rotation_delay、dry_field 或 fallow 等状态出现，不能自动生成无限水量。

每个供水请求都要绑定具体水源、取水口、渠道路径、分水设施、田块集合、有效时段和下游受体。任何一项缺失时，hydraulic_closed_graph 门禁不能通过。

## 来自 Settlement、Population 与 Human

读取：household_count、population、available_labor、settlement_location、settlement_elevation_band、tool_profile、animal_power_profile、transport_mode、historical_productivity_profile、water_rights、maintenance_groups 和 customary_governance_if_known。

用途：限制可维护田地面积、离村距离、作业节奏、维护频率、田埂步行尺度、分水安排和农作体系复杂度。

输出：labor_task_schedule、seasonal_labor_demand、channel_cleaning_demand、bund_repair_demand、divider_operation_schedule、harvest_output_proxy、maintenance_backlog 和 access_pressure。

元阳配置必须保存村落、上部森林和下部梯田之间的高程与水路关系。村落位置不能只按画面构图决定。

## 来自 Building 与道路系统

读取：village_boundary、farmyard_location、storage_or_processing_facility、path_network、bridge_or_crossing、household_water_point、animal_shelter 和 threshing_or_drying_area。

用途：农田与居民点、生活用水、粮食处理、牲畜、运输和水路之间建立可查询关系。

渠道、道路和田埂相交时，必须产生明确的桥、涵、踏步、渡水或绕行构件，禁止几何穿透。

## 来自动物与综合农业系统

读取：buffalo_presence、cattle_presence、duck_presence、fish_presence、eel_presence、snail_presence、grazing_or_work_schedule 和 animal_access_constraints。

用途：表达整田、肥源、虫害控制、水体生态和田间活动。地区没有相应证据时，不自动添加动物。

输出：field_access_window、animal_work_task、nutrient_return_proxy、disturbance_state 和 habitat_state。

## Farmland 对世界发布的最小状态

1. parcel_geometry_ref
2. farmland_type
3. crop_stage
4. crop_structure_state
5. surface_water_elevation
6. surface_water_depth_field
7. storage_volume
8. soil_moisture_state
9. irrigation_demand
10. accepted_inflow
11. overflow_and_drainage
12. downstream_receiver
13. canopy_cover
14. maintenance_state
15. labor_demand
16. hydraulic_connectivity_state
17. mass_balance_error
18. evidence_and_revision

## 闭合水力交换合同

一次联合水力步进至少按以下顺序执行：

1. 读取同一快照中的水源水位、可用流量、降雨、蒸发、地形和田块状态。
2. 提交带水源、时段、路径和用途的取水请求。
3. 由水源责任方返回可接受供水量和边界水头。
4. Farmland 沿取水口、干渠、支渠、分水设施和进水口求解输水。
5. 更新每块田的蓄水、渗漏、蒸发、溢流和出流。
6. 沿排水沟将水送往明确的下游受体。
7. 记录全系统水量守恒误差、节点冲突、断流、堵塞和超高风险。
8. 只有检查通过的提案才能发布为下一快照。

## 耦合规则

1. 查询不推进状态。
2. 状态推进只读取同一已提交世界快照，或显式记录延迟和有效区间。
3. 外部输入缺失时返回 unknown、unsupported 或 degraded_mode，不用零值假装真实状态。
4. 地理邻接、水力连接、道路通达、产权、用水权、人口归属和维护责任分别建关系。
5. 联合计算发生字段冲突时保留冲突并交回责任方，不用最后写入覆盖。
6. 每个显示出来的水流、蓄水面和排水结果都能追溯到同一时刻的源、路径、控制状态和受体。
7. V0.1 的孤立进排水球体和装饰水线不符合本合同，只保留为失败对照。