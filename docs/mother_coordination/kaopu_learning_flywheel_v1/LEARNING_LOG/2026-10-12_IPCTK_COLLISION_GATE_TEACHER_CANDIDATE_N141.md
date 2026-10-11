# N141｜ipc-toolkit v1.6.0 作为 MP02 连续碰撞验证老师候选

- 日期：2026-10-12
- bounded question：相对 N138 已要求的 `bodyCollision/selfCollision + minSeparation/penetrationCount`，`ipc-sim/ipc-toolkit` 是否提供了一个能被反驳、且足以降低“漏检却过门”的新增检查？
- 对应生产：MP02 Tailor / PR #220
- 状态：`TEACHER_CANDIDATE`
- 生命周期：`RADAR_FOUND -> TEACHER_CANDIDATE`；`AUDITION=NOT_RUN_ON_MP02`
- Mother：`NOT_QUERIED/UNKNOWN`（写入本证据时尚无真实回执）
- 全局采用：否
- 生产分支修改：无

## 1. 现有真实失败

N138 已确认 MP02 只能证明公开 preset bytes、3D 縮略图和部分 lineage；尚未给出真实 cloth re-solve、seam/contact、远景连续表达、用户验收。现有 collision receipt 建议记录 body collision、self collision、最小间距和穿透数，但没有绑定：

- 实际参与碰撞的 mesh/顶点映射；
- broad phase、narrow phase、CCD 的实现与配置；
- 从上一状态到下一状态的整段运动是否无碰撞；
- 漏枚举候选对时，检测器是否会静默返回“安全”。

所以“最终帧 penetrationCount=0”仍可能是 detector false negative，而不是资产真的连续无碰撞。

## 2. 外部方法与一手证据

深读对象：[`ipc-sim/ipc-toolkit`](https://github.com/ipc-sim/ipc-toolkit)，固定 audition 版本为 [v1.6.0](https://github.com/ipc-sim/ipc-toolkit/releases/tag/v1.6.0)（2026-07-15，commit `478876f30bf8ea768772dd8983c26a1a801ad976`），MIT license。

它明确提供 barrier potential、adaptive barrier stiffness、距离计算、摩擦，以及 broad-/narrow-phase 的连续碰撞检测；但 README 同时明确它**不是完整仿真库**，不含物理解算器。因此它只可能教 MP02 “collision verification”，不能替代 cloth、seam 或材质求解。

稳定版上游验证包含 Build、Python、CUDA、Coverage、Clang-Tidy、clang-format、Docs 与 PyPI release 的成功工作流。当前 main（2026-10-11 head `61ff288af1c18828ac0df3554115cd67f921fbf0`）虽保持活跃且大部分 workflow 通过，但 Docs run 失败；所以 audition 固定 v1.6.0，不跟随 main 漂移。

关键一手测试：[`python/tests/test_ccd.py`](https://github.com/ipc-sim/ipc-toolkit/blob/v1.6.0/python/tests/test_ccd.py)。

上游测试建立了以下可复核断言：

1. 初始相离立方体 `has_intersections=false`；
2. 穿透终态 `has_intersections=true`；
3. 从相离到穿透的整步 `is_step_collision_free=false`；
4. `compute_collision_free_stepsize` 返回 `0 <= toi <= 1`；
5. 将轨迹裁到 `toi` 后重新检查为 collision-free；
6. 一个故意漏枚举候选的 `DumbBroadPhase` 会把同一危险步静默判成 `collision_free=true`、`toi=1`，且终态也报无交。

第 6 条是对 KAOPU 当前门禁的新增反例：只记录终态最小间距/穿透数而不绑定 detector lineage，不能证明“无碰撞”。

## 3. 与 Current Best View 比较

- 已覆盖：XPBD/接触/摩擦是物理验收主题；N138 已要求 body/self collision、min separation、penetration count。
- 新增：把“检测器本身可能漏检”变成正反控制可测的问题，并把连续步、TOI 与 detector identity 纳入证据。
- 不新增：它没有新的服装构版、缝合、布料本构、外观或 LOD 方法；不能成为整套服装老师。
- 对通用 `PositionBasedDynamics` 本轮判定 `NO_NOVELTY`：它对“如何证明 detector 不漏检”没有比当前问题更直接的增量。
- 旧 `NvidiaWarp-GarmentCode` 本轮不进入 audition：维护停留于 2024 且 GitHub license 元数据不明确，依赖/权利风险高。

## 4. 可反驳假设

> 若 MP02 的碰撞回执绑定 exact collision mesh、detector/version/config，并同时报告 full-step CCD 与最大安全步长（TOI），再加入一个应碰撞 positive control，则能在提交用户前发现“终态看似安全但 detector 漏枚举”的候选；若在真实 MP02 固定夹具上没有发现任何差异、只增加成本，则该候选应降为 `NO_NOVELTY` 或 `REJECTED`。

## 5. 最小历史回放

本轮只做 source/test replay，未伪装为 MP02 实跑：

- 对 v1.6.0 上游 `test_ccd.py` 的 5 个安全/危险/TOI 断言做代码级回放；
- 对 `DumbBroadPhase` 负面对照做代码级回放，确认“漏枚举 -> 假安全”机制确实存在；
- 对 N138 当前 receipt 字段做差分，确认它没有 detector/version/config、full-step CCD、TOI 或 positive control；
- 本地环境没有 `ipctk`，因此 `EXECUTED_ON_MP02=false`，不得标为 `PROBATION`、`ACTIVE_TEACHER` 或 `ADOPTED`。

## 6. 可执行 Candidate（仅供单 Mother audition）

建议 MP02 的 collision receipt 候选增加：

- `collisionMeshDigest`：实际参与碰撞检测的顶点/边/面映射摘要；
- `detector`：实现、固定版本/commit、broad phase、narrow phase、CCD 方法；
- `ccdConfig`：`dhat`、tolerance、iterations、过滤器与 barrier stiffness；
- `fullStepCollisionFree`：上一状态到下一状态整段；
- `maxCollisionFreeStep` / `toi`；
- `positiveControlDetected`：已知应碰撞夹具必须为 true；
- `safeControlPassed`：已知相离夹具必须为 true；
- `candidatePairCount` 与过滤后 pair count，便于定位漏枚举。

最小 audition：固定同一件 garment + body 的 10 帧可复现夹具，分别用现行 detector 和 ipc-toolkit v1.6.0 comparator 运行；至少包含一个安全接近、一个已知穿透、一个跨步穿越案例。只要结果不一致就阻断 MP02 collision gate 并人工定位；全部一致且没有新增检出，再评估依赖成本。

## 7. 适用边界与风险

- 只适用于线性三角面 collision verification；不是 cloth/seam/material solver。
- CPU/GPU、浏览器/device、生产和用户验收仍是独立层，source test 不得升级为资产通过。
- 核心依赖含 Eigen、libigl、oneTBB、Tight-Inclusion、Scalable-CCD。
- 可选 `filib` 默认为开启且为 LGPL-2.1；如不接受静态链接义务，audition 必须显式 `IPC_TOOLKIT_WITH_FILIB=OFF` 并重新验证。
- SIMD 默认可能使用 `-march=native`，跨机器可移植二进制应以 `IPC_TOOLKIT_WITH_SIMD=OFF` 重新构建。
- 集成时间、运行成本、真实 MP02 mesh 兼容性：`UNKNOWN`。

## 8. 决策与状态

- Teacher state：`TEACHER_CANDIDATE`
- Audition completion：`false`
- `POSTED=false`（将在 PR #220 定向路由后更新其外部状态）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- `GATE-RUN=true` 仅指 source/history replay；`MP02-GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`
- 首次候选通过率、用户纠错次数、同错复发率、rejected-lineage 继承、stale delivery、内部迭代数、合法 candidate 时间：`UNKNOWN`

保留回滚点：删除本 N141 候选或让 PR #220 Mother 回 `NO_NOVELTY/REJECTED` 即可；没有生产资产或现行门禁被修改。
