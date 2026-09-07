# Ocean Mother / Coast 启动知识包 R1

日期：2026年9月7日

角色：这是小妈为 Ocean Mother 准备的启动知识包。它整理这两天关于造波、自由表面、世界查询、水体光学、潮汐、海底、连续局部流体、Coast 浓烟和观察带宽的知识。它不修改 Ocean 生产基线，也不替 Ocean Mother 完成后续专业研究。

## 先读顺序

1. `KNOWLEDGE_CORE.md`
2. `WAVE_SURFACE_AND_QUERY.md`
3. `WATER_OPTICS_AND_COAST_FLUID.md`
4. `TESTS_AND_GATES.md`
5. `HANDOFF_TO_OCEAN_MOTHER.md`

同时必须回读：

- `../../core/WORLD_KERNEL_CORE_CHARTER_R1.md`
- `../../core/OBJECT_DNA_CORE_CHARTER_R1.md`
- `../../adapters/OCEAN_COAST_ADAPTER_R1.md`
- `../../../learning-r1-20260905/skills/macroscopic-microscope-masterclass/SKILL.md`

## 本包的总关系

`Time -> WaterBody Identity -> Bathymetry Truth -> Tide State -> Wave Surface -> World Query -> Surface Optics -> Water Volume Optics -> Local Coast Fluid -> Observation Query -> Evidence`

海底、海面、潮汐、波、水下介质、岸体和 Coast 烟分别有职责。

## 第一原则

海面不作为永久静态平板保存。

海底来自真实地形或明确的水体底部真值。

海面由潮位、波场和必要局部状态产生。

可见海面和物理查询读取同一个自由表面定义。

远海和近岸不需要时时刻刻运行同一种昂贵算法。

## 本轮第一任务

先选择一块固定现有海面，建立同一波面的可见高度、水平位移、法线和世界水位查询。先证明 `render=query`，再进入更复杂的岸浪和局部流体。

## 状态

`package=ocean-coast-r1`

`knowledge_distilled=true`

`mother_self_research_required=true`

`productionIntegration=false`

`visualAcceptance=false`

`productionReady=false`
