# KAOPU Asset Compiler R1
## 外部三维老师资产 → 可测量 Teacher Package → 靠谱数学语言

版本：1.0.0
日期：2026-09-23
状态：PERMANENT / CROSS-DOMAIN / USER-AUTHORITY

适用：Fish / Coral / Bird / Animal / Human / Clothing / Boat / Aircraft / Weapon / Object / Terrain 等需要“观察、学习、测量、复刻”的生产线。

## 0. 核心原则

Production Mother 不负责“猜这个东西大概长什么样”，也不负责重新规划。

统一流程：

SOURCE VAULT
→ SOURCE AUTOPSY
→ CANONICAL TEACHER PACKAGE
→ DOMAIN COMPILER
→ KAOPU HIGH-DIM REPRESENTATION
→ SOURCE-vs-KAOPU VERIFIER
→ 通过后才 DISTILL / GENERATOR / VARIANT
→ Game Assembly

禁止路线：

Source → 看一眼 → 凭经验低质量重做 → 反复修很多轮。

目标不是先做低质量再升级，而是第一次就以老师资产为严格约束，最大限度保留信息。

## 1. 用户下载格式优先级

### 第一优先：完整 glTF Source Package

优先下载并完整保留：

- `.gltf`
- 对应 `.bin`
- 所有原始 textures
- animation / morph / skin 相关依赖
- 原压缩包目录结构

理由：

- JSON 结构直接可读；
- node / mesh / primitive / accessor / skin / animation / material / texture 关系透明；
- BaseColor / Normal / Roughness / Metallic / AO / Emissive / Alpha 等贴图可以逐张直接审计；
- UV、sampler、KHR 扩展更容易做机器检查。

用户若同一资产可下载 glTF / GLB / FBX，默认先下 glTF 完整包。

### 第二优先：GLB

GLB 与 glTF 属于同一 glTF 2.0 数据模型，适合：

- 单文件封存；
- 防止贴图漏失；
- 传输和快速比较；
- 保存 canonical snapshot。

如果方便，最佳实践是同一 Teacher 同时保存：

- 完整 glTF package：用于解剖学习；
- GLB snapshot：用于封存和快速校验。

### 第三优先：FBX

FBX 只在以下情况作为补充：

- glTF/GLB 明显丢失 animation；
- morph target 丢失；
- skeleton/skin 丢失；
- 材质或原始高精信息只存在 FBX 中。

FBX 不作为默认学习格式，因为不同 exporter/importer 可能引入轴向、单位、PBR 映射、动画解释差异。

## 2. Source Vault

从 2026-09-23 起，用户上传的老师资产优先持久保存到 ChatGPT Library：

`/KAOPU_SOURCE_VAULT/<Domain>/`

当前固定目录：

- Fish
- Coral
- Bird
- PatrolCrew
- Aircraft
- Other

每个 Teacher 建一个独立子目录，例如：

`/KAOPU_SOURCE_VAULT/Fish/YELLOWFIN_TEACHER_001/`

Source Vault 是持久老师文件层。

GitHub 私有 `haihao0307/KAOPU-REFERENCE-CACHE` 继续保存：

- SHA256
- manifest
- provenance
- rightsStatus
- source locator
- usedBy
- distillation / QA 状态

但在真实二进制尚未进入 GitHub LFS 前，不再让 Production Mother依赖 GitHub Cache 找老师文件。

生产线读取顺序：

1. Library Source Vault
2. 已验证 GitHub private binary cache
3. 当前 conversation/project attached exact bytes
4. 都不存在 → `SOURCE_NOT_READY`

不得重新联网随便找一个相似模型代替。

## 3. Source Readiness Gate

一个老师资产只有满足以下条件才叫 `SOURCE_READY`：

- 原始字节可重新读取；
- SHA256 已计算；
- 字节数已记录；
- 格式已解析；
- 依赖文件完整；
- 至少一次重新读取后 SHA 一致；
- source identity 唯一；
- rights/provenance 已记录。

只有 manifest、文件名、旧截图、旧 SHA、LFS pointer 不叫 SOURCE_READY。

Source 不 ready：

- Production Mother 不得在那里耗几个小时找资料；
- 直接 `SOURCE_NOT_READY`；
- 该 lane 关闭/退出执行；
- Source Librarian 处理资料问题；
- 其他不依赖该 source 的 lane 继续。

## 4. Teacher Package — 必须完整抽取

每个 Teacher 自动生成：

### 4.1 Scene / Geometry

- scene graph
- node hierarchy
- mesh / primitive inventory
- vertex / triangle count
- attributes
- indices
- normals
- tangents
- UV0 / UV1
- morph targets
- bounding boxes
- physical scale
- principal axes
- feature edges
- fixed-view silhouettes

### 4.2 Rig / Skin

- skeleton parent graph
- rest transforms
- joint orientations
- bone lengths
- inverse bind matrices
- JOINTS / WEIGHTS
- influences per vertex
- skinning normalization
- morph + skin relationship

如果老师已有 rig：

**学习老师 rig，不重新猜。**

只有老师没有 rig 时，才进入自动/独立 re-rig 路线。

### 4.3 Animation

每个 clip 记录：

- clip name
- duration
- sampler
- interpolation
- every joint track
- translation / rotation / scale curves
- morph curves
- fixed-time pose samples
- world-space landmark trajectories

对于鱼/鸟/人物，必须能回答：

“某根骨在时间 t 的变换是多少？”

而不是“这个动作看起来像游泳/飞行”。

### 4.4 Material / PBR

完整记录：

- BaseColor
- Metallic
- Roughness
- Normal
- AO
- Emissive
- Alpha / Alpha Mode
- UV set
- texture resolution
- sampler
- double-sided
- transmission / volume / sheen / clearcoat 等已存在扩展

鸟羽毛、头发、草叶等若依赖 Alpha：

必须保存并学习真实 Alpha 结构，不能用厚实体片替代。

## 5. 高维靠谱表示

靠谱语言不等于“十几个低维参数”。

允许组合：

- PartGraph
- SkeletonGraph
- FeatureCurves
- Centerline
- SectionField
- BranchGraph
- SurfaceField
- SDF / implicit field
- residual field
- UV / material field
- animation curves
- behavior functions
- parameters

原则：

**先高维保真，后压缩。**

如果需要 200 个截面才能准确记录一条鱼，就先保存 200 个截面。
等验证通过，再研究能否压成 12 个控制截面 + spline。

## 6. Domain Compiler

### Fish

Teacher
→ canonical longitudinal axis
→ centerline
→ dorsal / ventral profile
→ cross-section field
→ head / jaw / operculum
→ peduncle
→ fin surfaces
→ skeleton graph
→ skin field
→ swim curves
→ material field
→ residual surface

### Coral

Teacher
→ attachment / holdfast
→ colony envelope
→ growth / branch graph
→ branch radius field
→ topology / shared wall / plate field
→ surface biology field
→ tissue / material
→ flow response

### Bird

Teacher
→ skeleton
→ body axis
→ wing chain
→ neck / leg / beak landmarks
→ feather zones
→ feather alpha cards / geometry
→ skin weights
→ wing-fold / flight animation curves
→ material fields

### Human

Teacher
→ anatomical landmarks
→ skeleton
→ body surface
→ skin field
→ face / hand / foot subdomains
→ clothing layers
→ motion curves

### Hard Surface / Boat / Aircraft / Weapon

Teacher
→ assembly graph
→ datum axes
→ part transforms
→ profiles
→ cross-sections
→ cylinders / planes / splines
→ feature curves
→ mechanical constraints
→ panel / seam / fastener relations
→ residual hard-surface field
→ materials / wear events

### Terrain

Teacher/evidence raster/vector
→ CRS / unit / datum
→ elevation field
→ slope / curvature
→ feature lines
→ hydrology / coastline / reef / channel graph
→ multiscale residual field
→ microscope surface detail

地形也禁止“没读完数据就自己补”。

## 7. Source-vs-KAOPU Verifier

所有复刻第一屏必须：

REFERENCE | KAOPU CANDIDATE

固定：

- same canonical scale
- same camera
- same projection
- same lighting where applicable
- side/front/top/quarter
- skeleton overlay when relevant
- wireframe when relevant

自动测：

- silhouette IoU
- landmark error
- point-to-surface distance
- section RMS
- curvature / normal error
- bone length error
- joint trajectory error
- material channel comparison
- animation pose / trajectory error

形体没有通过，不允许先去做微材质或特效。

## 8. Clean Restart Rule

如果旧生产线长期存在以下任一情况：

- source identity 混乱；
- 找不到老师文件；
- generic/toy substitute；
- 多轮在错误形体上打磨；
- 规划/执行角色混乱；
- 旧 Candidate 已成为错误继承基线；

则：

1. 冻结最后可用证据；
2. 旧线标 `LEGACY_CONTROL`；
3. 不物理删除原证据；
4. 新线从 `SOURCE_READY Teacher` 重新编译；
5. 新线不继承错误 Candidate 形体；
6. 通过后才 archive 旧 branch。

## 9. 当前重启决策

### Fish
重启。

Yellowfin 新线从 Source Copy Teacher：
`9b610f4ef0134e015c2fb6b14574e7e4f48ed943`

旧 Candidate B 保留为 LEGACY_CONTROL，不作为新线 parent。

### Coral
重启为 Teacher-driven factory。

- Pocillopora：从已证据化 teacher/baseline 重新建立 reference-vs-candidate
- Massive Porites：独立 teacher
- Sea Fan：没有 SOURCE_READY teacher 时不启动，不用 procedural placeholder 顶替

### Patrol Boat
不重做已经成功的船体。

冻结正确 vessel/mechanical baseline。
旧 B12 crew / hand loop 退出生产。
重启 `Patrol Crew R2`，四名船员走 Human Teacher + historical Japanese crew reference。

### Game
不从零重做世界。

重启 `Game Assembly Clean R2`。
只消费 VERIFIER_PASSED Domain outputs。
未通过的域显示 NO_CANDIDATE，不填 toy/generic substitute。

## 10. 用户操作最简化

用户以后只需要做一件事：

**给老师资料。**

最佳上传：

- 完整 glTF ZIP；
- 若有 GLB，也一起给；
- FBX 仅作为补充。

用户不需要逐个告诉 Mother 怎么做。

Coordinator 负责：

- 入 Source Vault
- SHA / manifest
- Teacher Package
- 拆任务
- 定 verifier
- 决定重启/关闭哪条线

Production Mother 只执行。

## 11. 关闭生产线规则

如果一个生产 lane：

- Source 已 SOURCE_READY；
- Task Anchor 明确；
- 工具可用；
- 仍连续两轮没有 production artifact，也没有精确 blocker；

则关闭该执行 lane，保留证据，重新路由。

如果 lane 持续以“找不到资料”为理由，而 Source Vault 已验证可读：

直接判定执行路由失败，不再给该 lane 消耗 token。
