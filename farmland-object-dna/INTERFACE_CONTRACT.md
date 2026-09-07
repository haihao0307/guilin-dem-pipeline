# Farmland Object DNA Interface Contract V0.0.1

## 共享原则

Farmland Object DNA 在同一 world_id、time、revision 和空间参考下读取外部状态。共享输入必须记录来源、单位、有效时间和责任方。Farmland 不自行制造第二套天气、海面、水位、DEM 或人口权威状态。

## 来自 DEM 与 Landscape

读取：terrain_elevation、terrain_slope、terrain_aspect、surface_normal、terrain_mask、hydrologic_context、obstacle_or_rock_context。

用途：确定田块能否成立、梯级高度、田埂位置、沟渠坡降、道路连接和地形适应。

保护：不得改写权威高程、AOI、真值哈希或用视觉修饰替代真实地形。

## 来自 Weather Mother

读取：precipitation_rate、air_temperature、relative_humidity、wind_vector、solar_radiation、cloud_state、evaporation_driver。

用途：作物生育、水面蒸发、土壤湿润、田间作业可行性、倒伏和材料湿润等状态推进。

Farmland 输出可供 Weather 或联合世界读取：canopy_cover、surface_wetness、surface_roughness、evapotranspiration_demand。

## 来自 Ocean Mother 与沿海水域

读取：coastal_water_level、tide_state、salinity_boundary、storm_surge_boundary，仅在对象位于相关沿海或潮汐影响区时启用。

用途：检查潮水倒灌、排水受阻、盐分风险和沿海农田水位边界。

Farmland 不计算全局潮汐和海洋状态。

## 来自水文或可用水源系统

读取：source_water_level、source_discharge、river_or_canal_connectivity、groundwater_context、water_quality_if_known。

输出：irrigation_demand、withdrawal_request、field_overflow、drainage_discharge、return_flow。

供水不足时允许 crop_water_stress、partial_irrigation 或 fallow 等状态出现，不能自动生成无限水量。

## 来自 Settlement、Population 与 Human

读取：household_count、population、available_labor、settlement_location、tool_profile、transport_mode、historical_productivity_profile。

用途：限制可维护田地面积、离村距离、作业节奏、维护频率和农作体系复杂度。

输出：labor_task_schedule、seasonal_labor_demand、harvest_output_proxy、maintenance_backlog。

## 来自 Building 与道路系统

读取：village_boundary、farmyard_location、storage_or_processing_facility、path_network、bridge_or_crossing。

用途：农田与居民点、粮食处理、运输和水路之间建立可查询关系。

## Farmland 对世界发布的最小状态

1. parcel_geometry_ref
2. farmland_type
3. crop_stage
4. surface_water_depth
5. soil_moisture_state
6. irrigation_demand
7. drainage_state
8. canopy_cover
9. maintenance_state
10. labor_demand
11. evidence_and_revision

## 耦合规则

1. 查询不推进状态。
2. 状态推进只读取同一已提交世界快照，或显式记录延迟和有效区间。
3. 外部输入缺失时返回 unknown、unsupported 或 degraded_mode，不用零值假装真实状态。
4. 地理邻接、水力连接、道路通达和人口归属分别建关系。
5. 联合计算发生字段冲突时保留冲突并交回责任方，不用最后写入覆盖。
