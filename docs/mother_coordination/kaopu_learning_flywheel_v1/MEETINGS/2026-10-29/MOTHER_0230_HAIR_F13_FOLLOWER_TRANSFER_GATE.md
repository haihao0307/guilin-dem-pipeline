# KAOPU Mother 每日协调会：Hair F13 guide→follower 传递门禁

- **记录 ID**：KAOPU-MOTHER-20261029-HAIR-F13-FOLLOWER-TRANSFER-R1
- **实际开始**：2026-10-29 02:30:06 +08:00
- **实际结束**：2026-10-29 02:30:13 +08:00
- **范围**：只核对 F13 代表 guide 位移传给 114,171 条显示发丝后，现有证据能否支持 follower 保长
- **实际参与**：小妈主持核查；未取得 Hair Mother 本轮 ACKNOWLEDGED 或回复
- **生产修改**：无
- **协议**：R2 Production OS、Reference Replication Gate、Freshness Gate 均作为强制门禁

## 新增事实

main 仍为 `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`，自上一轮没有新生产提交。

#91 N206 新增了一个 source-derived、可反驳的边界：

- F13 用 43 条 representative guide 的 25 节点位移场，按 `clumpId` 传给 114,171 条、每条 49 点的显示发丝；
- 当前动态 GPU 检查抽取 86 条，仅证明 root error 与 finite；动作/物理开启时 `staticPathErrorMM=null`；
- `PlannedFiberView.mjs` 和 `PhotoDynamics.mjs` 在 `64cd31324f1a7c4762c21531fe5559b14face2fe` 与 N206 审计 subject 中对应 blob 一致；
- 当前没有每根 follower 的 segment stretch/compression 或 total arc-length census；
- 合成正控中，guide 严格旋转 20° 且自身 arc drift≈0，平行 follower 也≈0，但正交 follower 接收同一 delta 后 arc drift 为 34.33745%。这证明现有绿色 guide/root/finite 证据不能推出所有 follower 保长；不证明生产资产真实伸长 34%。

PR #317 已诚实声明 `fullPerStrandSimulation=false`，因此本轮不把“未证明保长”改写成“已经证明生产失败”，也不否定其已有多人、动作、根绑定与有限性能证据。

## 九项核对

| 项 | 当前记录 |
|---|---|
| taskId / targetObject / targetDefect | `HAIR-F13-FOLLOWER-DELTA-TRANSFER-AUDIT-20261029` / F13 dense follower 中心线 / guide delta 传递后的逐丝应变与弧长证据缺失 |
| accepted baseline / baseSha | 用户接受基线：UNKNOWN；生产 source：`64cd31324f1a7c4762c21531fe5559b14face2fe`；PR #317 head：`b126208cb2a0d2f249e59ae7af58809869fcef25` |
| 用户最后约束 | 保留完整密度与已有质量；共享求解不得冒充逐丝物理；Producer 不得自我批准 |
| referenceSet / UNKNOWN | 精确 F13 source、两份 runtime blob 与 PR #317 source lock 已绑定；允许的逐丝应变/弧长阈值依据 UNKNOWN |
| forbidden routes | guide 自身绿色、86 条 root-only 抽样、均值、finite、动画会动或 `fullPerStrandSimulation=false` 声明，均不得替代 follower 级保长证据 |
| fresh head delta | Hair 生产：`NO_NEW_ARTIFACT`；N206 仅新增 learning probe 与 Candidate regression |
| regression cases | `HAIR-REPRESENTATIVE-DELTA-TRANSFER-001` 已完成 synthetic 8/8；状态 Candidate、inactive、未采用 |
| machine/reference/browser gates | synthetic gate 已跑；Hair production census、独立 verifier、当前公网浏览器与用户设备均未跑 |
| 当前状态 | bounded claim：`VERIFYING / HOLD_F13_FOLLOWER_DELTA_TRANSFER_INEXTENSIBILITY_UNBOUND`；PR #317 原交付状态不因本项单独改变 |

## 决定

**不要求 Hair Mother 立刻重写求解器，也不把所有 follower 改成独立物理。先锁定声明边界。**

Hair 接收端必须二选一：

1. **不声明 follower 保长**：在 Delivery Receipt 明确写 `followerInextensibility=UNKNOWN/NOT_CLAIMED`，保留现有 F13 Candidate 与既有有效证据；
2. **声明测试范围内保长**：在不可变 subject 上运行完整 follower census，并由独立 verifier 判定。不能用平均值或 86 条 root-only 抽样替代全量声明。

这项决定只约束“dense follower 中心线保长”声明，不否定根固定、finite、代表 guide solver、光学、多人动作或其他已验证范围。

## 责任端与最小验证

- **责任端**：Hair Mother；PR #317 仅作为 F13 真实接收端。
- **最小验证**：
  1. 运行前冻结 exact source/build、motion frames、阈值及依据；
  2. 对 114,171 条显示发丝记录 `restPathDigest/deformedPathDigest`；
  3. 逐丝计算最大 segment stretch、最大 compression、total arc drift，并保存最大值对应的 `hairId/clumpId`；
  4. 注入“刚体旋转 guide + 正交 follower”正控，独立 verifier 必须拒绝；
  5. receipt 明确 `measuredFollowerCount/totalFollowerCount`，并将验证绑定准确 commit/runId。
- **成本**：当前未知；全量离线统计不等于逐丝独立求解。

## 状态账

- **POSTED**：N206 已发布到 #91；本轮定向接收要求发布到 PR #317。
- **ACKNOWLEDGED**：无 Hair Mother 新回复。
- **IMPLEMENTED**：learning probe 已实现；生产 receipt/census 未实现。
- **GATE-RUN**：synthetic 8/8；Hair production gate 未运行。
- **ADOPTED**：无。
- **USER-ACCEPTED**：无。

## 未完成边界

没有 follower 保长阈值依据、生产全量 census、独立 verifier、当前固定网页浏览器证据或用户验收。PR #317 的既有公网交付仍是“交付未完成”；本轮未生成新的用户可见资产。

## 学习飞轮接续题

怎样从 guide 与 follower 的 rest-tangent 差异、位移场梯度建立一个可证明的保守上界，用于先筛出高风险 clump，再由周期性全量 census 校准，而不把抽样结果冒充全量证明？

这项方法若成立，可在 Hair 内部复用到毛发束、睫毛和毛绒；跨 Mother 采用仍须各自验证，不广播为已采用通则。

## 固定证据

- [N206 定向记录](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6473493501)
- [N206 学习记录](https://github.com/haihao0307/guilin-dem-pipeline/blob/automation/n206-hair-f13-representative-delta-transfer-20261028/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-10-28_HAIR_F13_REPRESENTATIVE_DELTA_TRANSFER_N206.md)
- [Candidate regression](https://github.com/haihao0307/guilin-dem-pipeline/blob/automation/n206-hair-f13-representative-delta-transfer-20261028/docs/mother_coordination/kaopu_learning_flywheel_v1/REGRESSION_CASES/CANDIDATE_HAIR_REPRESENTATIVE_DELTA_TRANSFER_001.json)
- [PR #317](https://github.com/haihao0307/guilin-dem-pipeline/pull/317)
