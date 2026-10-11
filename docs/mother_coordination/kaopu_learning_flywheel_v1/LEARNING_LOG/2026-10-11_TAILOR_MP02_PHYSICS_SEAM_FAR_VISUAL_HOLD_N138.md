# N138 — Tailor MP02-S1 物理、缝线与远景视觉纠正回放

- 日期：2026-10-11
- Mother：Tailor
- 类型：技术目标/规格保真/验证边界
- Bounded question：七款 3,508 项闭合几何检查、shader 编译和公网字节一致，能否证明 MP02-S1 已满足用户最新的“真实布料＋连续缝线＋远近画面＋物理”合同？
- 结论：不能。
- 状态：`MP02_NUMERIC_SOLID_GEOMETRY_AND_PUBLIC_BYTES_VERIFIED_SCOPED__HOLD_LATEST_USER_PHYSICS_SEAM_FAR_VISUAL_CONTROLS_ACCEPTANCE`

## 1. 现有真实失败

MP02-S1 保留了 12 套搭配缩略图，并把针织、牛仔和皮革适配为闭合纱线/皮层几何。以下事实成立：

- 源码：`23c34ca5699e388d2b9ab2502fb91480e6628b5c`
- 证据头：`71900b71a449d4c0eae98589306dbf1e8f0a44f7`
- 七款、3,508 项数值断言通过；
- 自定义 GLSL 编译与接口检查通过；
- 29 个公网文件字节、长度与 SHA-256 一致；
- 原 MP01 未覆盖。

但当前收据与源码同时明确：

- `visualVerified=false`
- `deliveryComplete=false`
- `materialPhysicsCalibrated=false`
- `physicalReSolved=false`
- `jointClothCollisionCertified=false`
- 服装仍使用原静态衣形作为材料定位基面；
- 缝线只是沿每个 panel 边界生成的两条展示路径，明确没有 industrial lock topology、seam-force solver 或 punctured yarn mesh；
- 现有 continuous-carrier 测试不覆盖真实 `stitchVertexPairs` 的跨裁片约束；
- 远景只把管面降为 3 边 LOD，没有 actual-browser 远景视觉门；
- UI 只允许选择固定材质，没有把线径、针距/编织尺寸绑定为可调几何/物理控制。

用户在该候选之后给出明确纠正：

1. 缩略图必须保留；
2. 远观布纹不能像透明网；
3. 缝合线必须连续；
4. 必须有真实布料物理、重力、正反面和人体防穿模；
5. 线粗和编织尺寸可调；
6. 毛衣可做双层；
7. 皮衣必须有真实质感。

因此失败机制不是“文件不存在”或“几何未闭合”，而是**单面板/单纱线静态几何证明被误用为跨面板缝合、时序物理、碰撞和真实画面证明**。

## 2. 外部方法/证据

### XPBD

来源：[XPBD: Position-Based Simulation of Compliant Constrained Dynamics](https://matthias-research.github.io/pages/publications/XPBD.pdf)

可执行事实：compliance/constraint 的表达使材料刚度的行为可明确记录，并降低普通 PBD 中时间步和迭代次数对有效刚度的影响。

KAOPU 映射：`ClothPhysicsReceipt` 必须记录 solver/constraint model、compliance 或等价材料参数、dt、substeps、iterations；不能只记录闭合几何。

### C-IPC

来源：[Codimensional Incremental Potential Contact](https://research.adobe.com/publication/codimensional-incremental-potential-contact/)

可执行事实：薄结构的物理需要把 modeled thickness、strain limiting、frictional contact 与防互穿动力学联合处理。

KAOPU 映射：要求 exact-subject 的厚度、应变、摩擦、人体/自碰撞、最小间距和 penetration receipt。本轮不要求生产 Mother 直接移植完整 C-IPC。

## 3. 与 KAOPU 当前制度比较

R2、no-creative-substitute、freshness/no-stale-delivery 与 N137 已禁止证据层级越级。因此全局制度结论为：

`NO_NOVELTY_AT_OS_LEVEL__NEW_MP02_EXECUTABLE_RECEIPT_FIELDS`

新增不是一条全局口号，而是 MP02 的具体失败机制和可执行字段：

- seam pair 与装饰线分离；
- 时序物理与静态 manifold 分离；
- 远景 visual 与 LOD 几何选择分离；
- 参数 UI 与 exact geometry/physics state 绑定；
- 缩略图列为受保护非退化合同。

## 4. 可反驳假设

如果 MP02 必须绑定 exact-subject `ClothPhysicsReceipt`、真实 `stitchVertexPairs`、人体/自碰撞指标、可调几何/物理控制和固定近/远浏览器画面，那么当前候选会保留 3,508/3,508 数值通过与 12 套缩略图，但仍因缺少物理重求解、缝线受力、联合碰撞和远景视觉证据而 HOLD。

一个在同一 exact candidate 上提供并通过全部 receipt 的合法后继可以反驳本结论。

## 5. 最小历史回放

14 项观察，14/14 一致：

1. 3,508 项数值几何检查通过；
2. GLSL 编译/接口检查通过；
3. 29 个公网文件字节一致；
4. 12 套缩略图存在；
5. `visualVerified=false`；
6. `deliveryComplete=false`；
7. `materialPhysicsCalibrated=false`；
8. `physicalReSolved=false`；
9. `jointClothCollisionCertified=false`；
10. 服装仍是静态定位基面；
11. 缝线明确为无受力求解的展示路径；
12. 3/5/8 边 LOD 没有 actual-browser 远景视觉门；
13. 线径、针距/编织尺寸未作为绑定几何/物理的可调 UI；
14. 最新用户纠正明确指出透明网、断线和无物理，并要求保留缩略图。

## 6. MP02 局部 Candidate

### Task Anchor / ClothPhysicsReceipt

- `preserveThumbnailContract=12 cards + IDs + selection + deep links`
- exact garment/material/person/source identities
- gravity vector
- timestep/substeps/iterations
- solver or constraint model
- mass or areal density
- thickness
- warp/weft stretch、shear、bending
- friction、rebound
- actual `stitchVertexPairs`
- per-frame seam gap、discontinuity、thread strain、contact
- body collision/self collision
- minimum separation/penetration count
- front/back surface identities
- double-layer knit inter-layer gap/collision when enabled
- line diameter and knit/weave size controls bound to exact geometry/physics state
- fixed actual-browser near/far frames

### Verifier gate

Verifier 必须在同一 exact subject 上同时检查 receipt 与固定画面；Producer 不得自批。3,508 项几何与公网字节继续保留为必要但不充分条件。

### 回滚点

当前 MP02-S1 保持不可变的数值实体几何/公网字节 Observation；不删除、不覆盖、不继承其 visual/physics/user acceptance。

## 7. 适用边界

只适用于 Tailor PR #220 与 MP02-S1。它不否定现有几何、源码、shader、字节或缩略图事实，不实现布料求解器，也不声称无法直接观察到的画面已验收。

## 8. 是否采用

- 去重更新原 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`；
- 不修改全局 OS；
- 局部 Candidate 已路由至 [PR #220 回执](https://github.com/haihao0307/guilin-dem-pipeline/pull/220#issuecomment-6108683325)；
- `POSTED=true`
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- `GATE-RUN=true`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 9. 指标

- 首次候选通过率：false
- 本轮确认用户纠正：2 条消息
- 同类错误复发率：unknown
- rejected lineage 继承阻止数：1
- stale delivery promotion 阻止数：1
- 每个 accepted delta 内部迭代数：unknown
- 用户指令到合法 candidate 时间：unknown（尚无 physics-qualified successor）
