# 小妈 World Kernel 全量交接包 2026-09-07

用途：这是下一工作窗口的第一入口。它用于恢复小妈当前总控、World Kernel、Object DNA、Farmland、Weather、Ocean、DEM/Wenzhou 等知识状态，并继续协调各 Mother。它不是生产分支，也不能整支合入任何生产线。

## 固定仓库与分支

Repository: `haihao0307/guilin-dem-pipeline`

Coordination branch: `handoff/xiaoma-mentor-v1.1-20260905`

本次打包前基线：`3eb58693235505b9bb35dbb340c1cfd3007b8e01`

当前总账：issue `#63`

## 下一窗口先读顺序

1. `docs/mother_coordination/mentor-v1.1/README.md`
2. `docs/mother_coordination/world_knowledge_lab_v1/core/WORLD_KERNEL_CORE_CHARTER_R1.md`
3. `docs/mother_coordination/world_knowledge_lab_v1/core/OBJECT_DNA_CORE_CHARTER_R1.md`
4. `docs/mother_coordination/world_knowledge_lab_v1/START_HERE.md`
5. `CURRENT_STATE.json`
6. 根据实际任务再进入 Farmland、Weather、Ocean 或 Wenzhou 单线文件。

## 当前核心思想

World Kernel 当前顺序：

`Time -> Identity -> Truth/State -> Strategy -> Precision -> Query -> Function -> Evidence`

时间第一。世界保存最小充分状态；相机、交互、物理、叙事与安全共同决定当前计算带宽；成熟经验必须蒸馏为已验证函数，熟悉任务不重复进行高成本推理。

Object DNA 负责单个对象的最小可重建描述。来源网格、照片、3GS、CAD、卫星图、软件工程文件都先视为证据或工具，不自动成为对象本体。

## 已形成的四条直接工作线

### Farmland Object DNA

入口：`docs/mother_coordination/world_knowledge_lab_v1/object_dna/farmland-startup-r1/START_HERE.md`

现状：已经完成启动知识、种子 schema、来源台账、研究任务和正式 handoff。后续 Farmland DNA 自己深入查农学、农业史、水文、土壤、作物、人口、村落与地方文化，小妈负责框架、证据边界和再蒸馏。

### Weather / Cloud

入口：`docs/mother_coordination/world_knowledge_lab_v1/mother_packages/weather-cloud-r1/START_HERE.md`

总链：`Time -> Weather Identity -> Cloud Envelope -> Coarse State -> Multiscale Detail -> Transport -> Volume Optics -> Observation Query -> Evidence`

禁止把时间噪声冒充输运；多尺度细节必须 A=0 恢复；体积和表面 PBR 语义分开；先一团云做单变量实验。

### Ocean / Coast

入口：`docs/mother_coordination/world_knowledge_lab_v1/mother_packages/ocean-coast-r1/START_HERE.md`

总链：`Time -> WaterBody Identity -> Bathymetry Truth -> Tide -> Wave Surface -> World Query -> Surface Optics -> Water Volume Optics -> Local Coast Fluid -> Observation Query -> Evidence`

可见海面和水位/法线/浮力查询必须来自同一自由表面。海床属于地形真值，潮汐与波属于时间状态。Coast 浓烟当前走有限连续体积路线。

### 小温州 DEM

入口：`docs/mother_coordination/world_knowledge_lab_v1/mother_packages/WENZHOU_DEM_CLEAN_SYSTEM_R1.md`

新路线只保留温州真实 DEM、海底、水文、海岸与必要约束。旧 Weather、旧 Ocean 表面、旧云、旧方块海面和视觉残渣退出新活动运行时。旧系统保留冻结历史，不作为新依赖。

目标结构：

`Canonical Truth -> Constraint Anchors -> Reversible Multiscale Store -> Observation Reconstruction`

第一轮先在真实 12.5 m 小窗口验证可逆二维多尺度零误差和实际压缩/查询成本，不承诺固定压缩率。

## 最近的重要已验证/未验证边界

- World Kernel 和 Object DNA 当前均为协调候选框架，不等于生产实现。
- Weather/Ocean 两个学习包已经完成，但尚未因为“发出文件”就视为 Mother 已理解或已接入生产。
- Wenzhou 新 17-tile COG 的身份已冻结，但不同工作环境里曾记录 exact binary 未挂载。重新开工必须重新读取目标分支最新 HEAD 和二进制实际状态。
- 任何视觉接受、productionReady、GPU 性能、真实浏览器证明都必须按各生产线独立记录。
- 协调分支只用于知识、方法、交接和总控，禁止作为生产基线整支合并。

## 继续工作的原则

每次先读取目标生产线最新 HEAD、最后有效用户任务和冻结真值，再使用本包知识。不要从旧摘要直接改生产代码。

学习资料可以被蒸馏，但软件名、来源资产和临时工具不应无理由进入世界本体。

Posted message != recipient read != integrated。没有真实回执就不能宣称对方已经学习。

本包完成以后，下一窗口可以直接继续，不需要重建以上框架。