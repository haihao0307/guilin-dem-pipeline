# KAOPU Biological + Environment Archetype Roadmap R1

日期：2026-09-21
状态：QUEUE / NOT AUTO-STARTED

本文件只定义下一批母型队列，不表示新 worker 已启动。实际开始仍需独立 Task Anchor、分支、代码/数据/几何、执行测试和 receipt。

## Fish 第一批母型队列

1. Small Reef Fish — Damselfish / Clownfish style
2. High-body Reef Fish — Butterflyfish / Angelfish style
3. Medium Streamlined Herbivore — Surgeonfish / Tang style
4. Active Spindle Swimmer — Wrasse / Parrotfish style
5. Reef-edge Predator — Grouper / Snapper style
6. Strong-body Manoeuvrer — Triggerfish style
7. Rounded/Boxy — Puffer / Boxfish style
8. Benthic Percher — Goby / Blenny style
9. Open-water Schooling — Fusilier / Anthias style
10. Fast Cruiser — Jack / Tuna style

规则：
- 这些是生产母型，不是分类学声明；
- 每个母型都必须有 Identity Card + confusion set；
- 同一 Fish Core 共享 body coordinate / fin semantics / swim / perception / water constraint；
- 不逐种从零建鱼；
- 具体物种是受证据约束的 Variant。

## Bird 第一批母型队列

1. Heron / Egret — 涉水长腿型
2. Gull / Tern — 海岸敏捷飞行型
3. Booby / Frigatebird — 海洋滑翔/俯冲型
4. Kingfisher — 栖枝突进型
5. Dove / Pigeon — 林缘栖息型
6. Raptor — 猛禽巡航型

共享 Core：
- skeleton semantics
- wing/feather hierarchy
- takeoff/landing
- flap/glide
- perch/wade
- gaze/head stabilization
- flock interface

## Environment 四系统

### Geoform
- karst wall/notch
- reef flat
- reef crest
- beach ramp
- channel/pass
- lagoon bottom

### Habitat Cover
- coral patch
- seagrass
- rubble
- mangrove edge
- banyan/tropical tree cluster
- coastal scrub
- wet/algal limestone

### Dynamic Process
- wave/swell
- breaker/foam
- tide
- wetness/drying
- water clarity/depth optics
- wind response
- partial-submerged camera waterline

### Game Assembly
- consume, do not recreate domain truth
- placement requires story/ecology/player role
- blocked archetype stays NO_CANDIDATE
- continue assembling unaffected domains

## 启动顺序

当前正式 Pilot：
Coral A/B/C + Coral Assembly + Game Assembly。

待 Coral Pilot 验证“多工位 + blocker containment + compare workbench”有效后：
- Fish 先开 3 条差异最大的母型线；
- Bird 开 2 条；
- Environment 按 Geoform / Cover / Dynamic 分开；
- Game Assembly 始终持续。

不要一次把全部队列变成并发 worker。先验证工厂节拍，再扩容。
