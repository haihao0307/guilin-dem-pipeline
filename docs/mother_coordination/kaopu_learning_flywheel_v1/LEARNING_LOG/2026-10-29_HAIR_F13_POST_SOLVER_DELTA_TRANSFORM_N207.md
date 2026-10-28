# N207｜F13 求解器保长不等于求解后显示路径保长

- 日期：2026-10-29
- Mother：Hair
- 类型：技术验证 / source-derived post-solver gate gap
- Bounded question：F13 的 XPBD guide 在 `d.q` 中满足长度约束后，`PhotoDynamics.write()` 的逐节点 `tanh` 限幅、mobility 权重，以及 shader 的根部 ramp 与 25→49 插值，是否仍保持同一条 representative guide 的中心线长度？
- 结论：`HOLD_F13_POST_SOLVER_DISPLAY_INEXTENSIBILITY_UNBOUND`
- 外部老师：`NO_NOVELTY`
- 生产分支、main、R2 修改：无

## 1. 当前真实源码与证据边界

审计 Hair subject `codex/hair-structure-lab-r01-20261016@2175d53de12a44dbedb989d3e8b34837f6315dcb`：

- `PhotoDynamics` 把 49 点 representative path 重采样为 25 个 solver nodes；
- `StrandDynamics` 在 `d.q` 上执行根、长度、弯曲与碰撞代理约束；
- `write()` 并不直接把 `d.q` 送给显示层，而是先计算 `d.q - expected`，再按每节点位移幅值做 `limit * tanh(length / limit)`，并乘 mobility weight；前两个节点强制 weight=0；
- body guide limit 为 35 mm，bang guide limit 为 8 mm；
- vertex shader 把 25 个 bounded deltas 线性插值到 49 个 display samples，并再乘 `smoothstep(0, 0.10, t)`；
- 当前动态 GPU receipt 的 86-strand 抽样只记录 root error 与 finite；motion/physics 开启时 `staticPathErrorMM=null`，没有 post-write / post-shader segment strain 或 arc drift。

所以本轮不是否定 XPBD solver，也不是声称 F13 真实发丝已经产生下述数值；它只确认 solver invariant 与最终显示 invariant 之间存在一个尚未量测的变换阶段。

## 2. 新失败机制与最小正控

用 15 cm、25 节点直 guide 构造严格 45° 刚体旋转：

- raw solver result：root error = 0，arc drift = `2.22e-16`，每段长度保持；
- 复写 F13 body 路径的 35 mm `tanh` 限幅、前两节点 weight=0、根部 ramp 与 25→49 插值后：
  - dense display arc drift = `-2.238717%`；
  - maximum segment stretch = `24.580598%`；
  - maximum segment compression = `-7.597791%`；
  - root error 仍为 0，所有值 finite。

这些是合成 positive control，不是生产阈值，也不是 F13 真实资产观测。它证明“solver guide 保长 + root 绿色 + finite 绿色”不能推出“求解后显示 guide 保长”。分类回放 8/8。

## 3. 去重与路由

- 复用 N157 `HAIR-GUIDE-ARC-LENGTH-INVARIANT-001`：该 case 已要求 rest/deformed centerline、per-segment strain、total arc drift 与 known-stretch positive control。本轮新增的是 **post-solver stage evidence**，不重复造 regression。
- N206 `HAIR-REPRESENTATIVE-DELTA-TRANSFER-001` 检查同一 clump delta 传给 rest tangent 不同的 followers；本轮先检查同一 representative guide 从 solver nodes 到最终 display samples 的 invariant custody。
- N151 根绑定与 N161 frame twist 均不能替代本案的中心线长度量测。

## 4. 可反驳假设与最小生产试验

若 F13 descendant 要把 XPBD length constraint 延伸为最终显示 guide 的 inextensibility claim，则 Delivery Receipt 至少绑定：

`subjectSourceSha / subjectBuildSha / guideId / motionFrameId / rawSolverCenterlineDigest / rawSolverSegmentLengthsDigest / postWriteDeltaDigest / finalDisplayCenterlineDigest / maxSegmentStretchRatio / maxSegmentCompressionRatio / totalArcLengthDriftRatio / deltaLimit / mobilityWeightsDigest / shaderRampVersion / interpolationVersion / thresholdBasis / positiveControlId / positiveControlDetected / verifierIdentity / runId`

必须在 **所有求解后变换完成之后** 量测最终 display centerline。只给 solver snapshot、root/finite、peak deformation 或 delta 上限不能晋级。阈值由 Hair Mother 根据 exact claim 与 accepted baseline 事先冻结；本轮 0.5% 仅为分类夹具。

## 5. 给 Hair Mother 的四项定向问题

1. 当前 F13/后续任务是否真实需要声明最终显示 guide 近似不可伸长？
2. 是否已有未被发现的 post-write / post-shader centerline receipt？
3. 哪些现有 GPU readback 或 CPU mirror 能在不改变生产资产的情况下量测最终 49 点路径？
4. 最小可反驳试验是否应为：冻结阈值，以当前 F13 exact subject 跑静止、motion、wind 与 return-to-still frames，并注入“raw solver 刚体旋转、求解后变换造成 stretch”的正控？

## 6. 适用边界与状态

- 仅适用 F13 representative guide 从 solver state 经 bounded-delta pipeline 到最终 display centerline 的长度监管。
- 不证明 dense followers、twist、有限半径碰撞、自碰撞、材质、视觉保真、性能或用户接受；dense follower 另由 N206 管理。
- `POSTED=true`（[#91 comment 6478996941](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6478996941)）；learning synthetic `GATE-RUN=true`；`ACKNOWLEDGED / IMPLEMENTED / HAIR-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。
- KPI 均为 `unknown`；8/8 合成分类器不是生产 KPI。
