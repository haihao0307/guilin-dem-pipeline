# N206｜F13 代表 guide 保长不等于 114171 条显示丝保长

- 日期：2026-10-28
- Mother：Hair
- 类型：技术验证 / source-derived verifier gap
- Bounded question：F13 将 43 条代表路径的位移场传给 114171 条显示丝时，代表 guide 的根固定与长度约束能否证明每根 follower 的中心线长度也受控？
- 结论：`HOLD_F13_FOLLOWER_DELTA_TRANSFER_INEXTENSIBILITY_UNBOUND`
- 外部老师：`NO_NOVELTY`
- 生产分支、main、R2 修改：无

## 1. 当前真实源码与已成立证据

审计 Hair branch `2175d53de12a44dbedb989d3e8b34837f6315dcb`：

- F13 保留 F12 的 114171 条、每条 49 点完整路径，并为 43 个 clump 各选一条 representative；
- `PhotoDynamics` 把 representative 重采样为 25 节点，交给含根固定、长度约束、弯曲和碰撞代理的 solver；
- `write()` 输出每个 clump 的 25 点位移 `delta(t)`；
- `PlannedFiberView` 的 vertex shader 按 `clumpId` 把同一 `delta(t)` 加到该 clump 的所有显示丝；
- 动态 GPU 检查抽 86 条丝，只证明 root error 很小、值 finite；动作/物理开启时 `staticPathErrorMM=null`，没有 per-follower segment/arc measurement；
- F13 已诚实声明 `fullPerStrandSimulation=false`、`finiteWidthCollisionCertified=false`。

因此这不是抓到虚假完成声明，而是把 receipt 未覆盖的下游几何边界变成可执行 Candidate。F13 已有的静态路径、原生毛根、人物动作、代表 guide 响应、光学和公开构建证据全部保留。

## 2. 新失败机制

同一个 arc-position displacement 对不同 rest tangent 的曲线并不等价。即便 displacement 让 representative 做严格刚体旋转、root error 为 0、representative arc drift 为 0，叠加到另一条方向不同的 follower 后仍可能改变其每段长度。

49 点合成回放：

- representative：沿 X 的单位直线，严格旋转 20°；arc drift 约为 0；
- parallel follower：同方向平移路径；arc drift 约为 0；
- orthogonal follower：沿 Y 的单位直线，接收完全相同的 `delta(t)`；root error 仍为 0，但 arc drift 为 `34.33745%`。

这不是声称 F13 真实资产已经伸长 34%；它是正控，证明“代表 guide 绿色 + root 绿色 + finite 绿色”无法推出 follower 绿色。

## 3. 去重

- N157 `HAIR-GUIDE-ARC-LENGTH-INVARIANT-001` 检查 solver guide 本身；本案检查 guide delta 传给 rest tangent 不同的显示丝后的下游中心线。
- N151/N150 检查 active root、guide coverage 和 carrier identity；本反例保持 root 完全不动。
- N161 检查 bundle frame twist continuity；本案只检查显示 centerline 的 segment/arc distortion。

因此新增去重 Candidate：`HAIR-REPRESENTATIVE-DELTA-TRANSFER-001`。

## 4. 可反驳假设

若一个 representative delta 对整个 clump 合法，则：

1. exact subject/build、motion mode 与 measurement frames 可绑定；
2. representative 与所有显示 followers 都有 rest/deformed path digest；
3. 对声称覆盖 114171 条的交付，必须完整 census 每根丝的 segment stretch/compression 与 total arc drift，并保留最大值对应 hair/clump identity；
4. 阈值必须在运行前冻结且有任务级依据；
5. “刚体旋转 guide + 正交 follower”正控必须被拒绝。

任一缺失均不能把 root/finite/representative solver 证据升级为 dense-follower inextensibility。

## 5. 最小回放

分类器 8/8：subject 未绑定、root 未绑定、代表 arc receipt 缺失、followers 未量测、阈值后定、正控缺失、正控伸长、完整 scoped pass 均进入预期状态。

建议下一次 Hair F13 descendant 的 Delivery Receipt 增加：

`clumpId / representativeGuideId / displayedHairId / restPathDigest / deformedPathDigest / rootError / maxSegmentStretchRatio / maxSegmentCompressionRatio / totalArcLengthDriftRatio / measuredFollowerCount / totalFollowerCount / thresholdBasis / positiveControlDetected / verifierIdentity / runId`

## 6. 适用边界与状态

- 仅适用 representative-guide displacement 到 dense displayed followers 的中心线长度审计。
- 不要求 114171 根独立物理求解；允许共享 delta，只要求共享结果在声明范围内被完整验证。
- 不证明有限半径碰撞、自碰撞、材质、发型保真、性能或用户接受。
- `POSTED=true`（[#91 comment 6473493501](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6473493501)）；learning synthetic `GATE-RUN=true`；`ACKNOWLEDGED / IMPLEMENTED / HAIR-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED=false`。
- KPI 均为 `unknown`；合成分类器 8/8 不冒充生产 KPI。
