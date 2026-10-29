# N212｜单视图发型：learned prior 不能冒充被遮挡参考真值

## 0. 唯一 bounded question

DiffLocks 一类模型从单张正面图生成完整 3D strands 时，在 `REPLICATION_LOCKED / CREATIVE_AUTHORIZATION=false` 下，是否可以把背面、深度和被遮挡发丝直接标成 `REFERENCE_MATCH / CURRENT_TRUTH`？

结论：**不能。** 正面匹配只支持正面可观测 claim；learned prior 补出的不可观测区域最多是 `INFERRED_PRIOR_CANDIDATE`，没有额外视角、scan、批准约束或用户创作授权时必须 `HOLD_OCCLUDED_GEOMETRY_UNVERIFIED`。

本轮新增不是另一位老师，而是一条可执行的 Hair regression：`HAIR-SINGLE-VIEW-OCCLUDED-PRIOR-NOT-REFERENCE-TRUTH-001`。

## 1. 现有真实失败风险

N211 已确认 DiffLocks 的公开合同是 `single frontal RGB -> image-conditioned diffusion -> explicit 3D strands`。这在初始化几何上可能有价值，但其背面与遮挡区域不是从正面像素中直接测得；它们来自 40K synthetic hairstyle 训练出的 prior。

若 Delivery Receipt 只写“与正面参考相似”就把完整 3D hair 晋级为参考复刻，会重现用户最痛的机制：**模型为了完整自行补画，然后把补画结果当作用户指定真值继续继承。**

这不是假设 DiffLocks 一定生成错，而是区分：

- `plausible completion`：可能合理；
- `reference truth`：必须有来源约束；
- `user accepted design`：必须有真实用户授权/验收。

三者不能混写。

## 2. 外部来源与当前制度比较

- DiffLocks 官方 CVPR 2025 论文明确输入是 **single frontal image**，模型用 image-conditioned diffusion 生成 3D strands；论文声称结果准确，但单张正面图仍是唯一观测入口。
- CVF 官方 ICCV 2023 Viewset Diffusion 论文明确指出：3D 投影到单张图像会丢失 depth，因此 single-view reconstruction inherently ambiguous；其目标是生成 occluded regions 的 plausible explanations，而不是把唯一一种补全当观测真值。
- KAOPU 当前 `REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE` 已经禁止“未经批准的自动推断隐藏面”，并要求未知区域标记 `UNKNOWN / OCCLUDED / CANDIDATE_NEEDS_EVIDENCE`。

因此外部原则相对 R2 是 `NO_NOVELTY`；真正新增是把它转成 Hair image-to-3D 的具体 Task Anchor 字段、receipt、负控和 verifier gate。

## 3. 最小可反驳回放

建立 3 组各 8 条、每条 41 点的 synthetic strands，共 328 点：

- 三组的 `x/y` 完全相同；
- `t<=0.55` 的 184 个点标记 `OBSERVED_FRONT`，三组 3D 完全一致；
- 后 144 个点标记 `OCCLUDED`，两个 prior 只改变 `z` 深度。

结果：

- reference、prior A、prior B 的 front projection SHA-256 完全相同：`1512e30b…c1e`；
- naive front-only gate 对两个 prior 都给 `PASS`；
- prior A 在 occluded 区相对 reference 的 RMS 3D 差为 `50.546 mm`；
- prior B 为 `37.910 mm`；
- side projection 的三个 hash 各不相同，能立刻暴露差异；
- provenance gate 对“front-only + CURRENT_TRUTH”给 `REJECT_OCCLUDED_PRIOR_PROMOTED_AS_REFERENCE_TRUTH`；
- 若诚实标成 `INFERRED_PRIOR_CANDIDATE`，给 `HOLD_OCCLUDED_GEOMETRY_UNVERIFIED`；
- 11/11 classifier checks 通过。

这是 observability 的 synthetic counterexample，不是 DiffLocks 质量评测，也不证明所有模型补全都错。它只证明：**相同正面投影不能唯一确定背面/深度，因此正面通过不能承担完整 3D truth claim。**

## 4. 可反驳假设

若把 reference coverage 与 per-region evidence class 写入 Task Anchor / Delivery Receipt，并在 truth promotion 前检查 withheld side/back views，则 front-only learned completion 不会再被静默晋级为复刻真值，同时不会禁止其作为显式标注的初始化候选。

反证条件：如果存在 front-only 输入却能由批准的物理/几何约束唯一确定全部隐藏 strands，则对应区域可标 `PHYSICS_DERIVED / APPROVED_CONSTRAINT`；本 gate 不应错误 HOLD。若用户明确授权背面创作，则局部 `CREATIVE_AUTHORIZATION=true`，不适用“冒充 reference truth”的 hard fail。

## 5. 制度翻译

### Task Anchor

至少加入：

- `referenceViewSet`
- `referenceCoverageMaskDigest`
- `observedRegions / occludedRegions`
- `occludedGeometryPolicy`
- `creativeAuthorization`
- `teacherModelCommit / checkpointDigest / seed`
- `withheldValidationViews`

### Delivery Receipt

至少加入：

- `regionEvidenceClasses`
- `frontReferenceMatch`
- `withheldViewMatch`
- `occludedGeometryClaimState`
- `priorGeneratedRegionDigest`
- `referenceBoundRegionDigest`
- `scalpBindingReceipt`
- `creativeSubstituteDecision`

### Verifier gate

- front-only match 只能放行 front-observable claims；
- `INFERRED_PRIOR_CANDIDATE / OCCLUDED_UNKNOWN` 未经新证据不得晋级 `REFERENCE_MATCH / CURRENT_TRUTH / ACCEPTED_BASELINE`；
- 有 side/back/scan 时必须在 exact candidate 上运行 withheld-view check；
- silent fallback 到 prior 一律 `REJECTED_CREATIVE_SUBSTITUTE`；
- learned prior 可留作隔离 candidate，不能成为错误父节点。

## 6. 与既有规则去重

- 复用全局 `REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE` 的 UNKNOWN/OCCLUDED 原则；不建议修改 R2。
- N211 解决“DiffLocks 是否值得成为 image-to-strand teacher”；N212 只解决“它生成的不可观测区域能否被称为参考真值”。
- main 与 #91 未发现同一 single-view hair provenance regression，因此新建一个 Candidate case，而不是再写一条泛化政策。

## 7. 状态

- main baseline：`3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- source/semantic synthetic `GATE-RUN=true`
- `POSTED=true`（Hair Mother 定向路由：#91 comment `6501353389`）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=false`
- Hair production `GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`
- external teacher：`NO_NOVELTY`

未修改 main、R2、全局门禁或生产 Hair Mother；Candidate 保留回滚点。

