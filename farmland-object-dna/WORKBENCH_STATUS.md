# Farmland Object DNA 工作台状态

日期：2026-09-11

当前生产线：`restart/farmland-object-dna-v020-20260907`

当前版本：`0.2.0-clean-restart`

## V0.1 状态

`FARMLAND_DNA_WB_V0.1.0_20260907` 已被用户明确否决。

它只保留为失败对照，供自动检查确认以下错误没有回归：

1. 浮在地表的圆管水渠。
2. 圆管田埂。
3. 重复生成的共享边界。
4. 没有真实高程合同的假水深。
5. 没有上游和下游连接的进排水节点。
6. 固定格网平坝田。
7. 等距重复带状梯田。
8. 单一尺度滑杆替代真实模数关系。
9. 单一锥体缩放换色替代水稻生命周期。
10. 用材质、雾和灯光掩盖结构错误。

旧页面的技术发布与浏览器启动曾经通过，这不构成视觉接受。其当前状态为：

`userReview=rejected`

`shareAllowed=false`

`visualAcceptance=false`

`productionReady=false`

## V0.2 当前状态

当前没有公开视觉候选。生产线已经回到资料、整体系统、截面、水力和作物结构阶段。

`researchGate=in_progress`

`componentSourceCards=in_progress`

`yuanyangSystemResearch=in_progress`

`regionalEvidence=r023_20_documented_facts_8_dimensions_unknown`

`parcelPlanTopology=r023_coordinate_validated_synthetic_fixtures`

`channelSections=generic_r022_ideal_only_regional_not_ready`

`bundAndTerraceSections=generic_r022_plus_honghe_clay_constraint_regional_dimensions_not_ready`

`traditionalDividerGeometry=unknown`

`flatlandHydraulicGraph=r022_ideal_synthetic_pass`

`terraceHydraulicGraph=r022_ideal_synthetic_pass`

`waterMassBalance=r022_six_synthetic_scenarios_pass_real_field_not_run`

`riceStageMorphology=r024_14_stage_organ_contract_pass_24_regional_parameters_unknown_geometry_not_built`

`crossMotherIntake=r025_tlo_candidate_and_guilin_dem_fixed_sources_locked`

`guilinTerrainAuthority=r025_epsg32649_12p5m_identity_only_numeric_tiles_not_connected`

`hongheTerrainAuthority=unknown_guilin_dem_forbidden`

`tloCheckpoint=r025_candidate_not_core_schema_world_time_and_parcel_position_unknown`

`structuralTruthWorkbench=foundation_r025_contracts_only_no_visual_workbench`

`aaaVisualPrecheck=not_run`

`activePublicCandidate=none`

`visualAcceptance=false`

`productionReady=false`

## 下一工作台准入条件

新的内部结构真值台至少要包含：

1. 真实土渠平面、纵断面和横断面。
2. 共享田埂横断面和人体通行尺度。
3. 梯田田面、田埂、田坎、坡脚和排水剖面。
4. 进水口、出水口、溢流口和有依据的分水设施。
5. 田面、泥化层、耕作层、低渗层和下伏土体。
6. 真实水深与高程标尺。
7. 水从来源到下游受体的可追踪有向图。
8. 插秧到收割后各阶段的独立水稻结构。
9. 人、挑担工具和水牛尺度参照。
10. 剖面观察与结构通过后的 Microscope 入口。

内部真值台完成并通过结构检查以后，才能进入 3A 材质、色彩、光照、空气、风和微观细化。新的公开网页还需通过多视角预检、桌面与 390×844 手机浏览器验证和用户人工验收。
