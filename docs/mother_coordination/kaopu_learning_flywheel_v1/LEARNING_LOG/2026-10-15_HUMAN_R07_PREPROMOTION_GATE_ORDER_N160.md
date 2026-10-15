# N160 — HUMAN-INTEGRATED-R07 合入后复验成功，但不能倒写为合入前门禁闭合

- 日期：2026-10-15
- Mother：Human / 总平台发布
- 类型：制度验证 / claim closure / promotion ordering
- Bounded question：HUMAN-INTEGRATED-R07 被标记为 `mainline-canonical` 前，专用主线门禁是否已经完整闭合？
- 结论：`POST_PROMOTION_REVALIDATED__PREPROMOTION_SEQUENCE_EXCEPTION_RETAINED`。

## 1. 现有真实失败

用户明确授权把当前皮肤结果作为总平台主线基线；`d29534672989de3b9373bced5abf3ac333be3dee` 也保持了固定 R07 运行时摘要、旧 EAR-R06 和现有主线内容。授权与对象绑定均成立，不得误报为“未经用户同意合入”。

但 PR #293 声明“门禁完成后”才快进 `main`。专用 Actions run `38669673332` 的第一次尝试在候选浏览器检查成功后被取消：exact public HTTPS 步骤取消，final gate report 跳过。第二次尝试于 03:19:45 UTC 开始；`f723d28a45327d4b70fed68338eb6a31693792e5` 在 03:25:23 UTC 已把状态改成 `mainline-canonical`，而完整公网检查和 final report 到 03:42:16 UTC 才成功。因此技术复验最终通过，但“完整门禁先于 canonical claim”这一时序谓词为假。

## 2. 外部方法 / 新颖性

本轮不需要新老师。已有 `FINAL-CLAIM-CLOSURE-001` 已要求 claim-critical steps 全部完成、`issuedAfterCriticalSteps=true`；`CI-GREEN-SKIPPED-CLAIM-001` 又禁止把 cancelled / skipped 必需步骤算成通过；失败尝试也必须保留。当前事件是这些既有规则的真实新证据，方法状态为 `NO_NOVELTY`。

## 3. 与 KAOPU 当前制度比较

R2 已分离 Producer、Verifier 与用户接受；现有 candidate regression 也覆盖 finalizer 顺序。缺口不在规则不存在，而在 promotion receipt 没有把 `gateCompletedAt < promotionObservedByAt/canonicalClaimIssuedAt` 变成机器可判定字段。PR 描述中的自然语言“门禁完成后”没有阻止门禁仍在运行时写入 canonical 状态。

本轮不新增重复 regression case，只向 `FINAL-CLAIM-CLOSURE-001` 追加 N160 evidence update，并以 9/9 历史回放固定状态语义。

## 4. 可反驳假设

若一次发布真的满足“先验证、后提升”，则同一 receipt 必须证明：

1. 用户授权与 exact tested runtime 分别绑定；
2. 所有 attempt 都保留，取消/失败不会被成功重跑擦除；
3. 必需的 build、candidate browser、exact public browser、final report 均成功；
4. 首个完整成功 attempt 的 `completedAt` 早于 main ref mutation 或 canonical claim；
5. 后续提交若只改元数据，路径必须落在显式 allowlist，runtime digest 不变；
6. 合入后成功只能记 `POST_PROMOTION_REVALIDATED`，不能把过去的时序异常改写为“合入前已通过”。

## 5. 最小历史回放

9/9：缺用户授权、未测试 runtime descendant、丢失 attempt lineage、未合入且门禁不全、门禁完成可提升、门禁未全即提升、合入后复验成功、合入前成功、用户授权不能替代时序门禁，均按预期分类。

当前实际状态为 `POST_PROMOTION_REVALIDATED__PREPROMOTION_SEQUENCE_EXCEPTION_RETAINED`。复验成功关闭了当前固定 runtime 的技术未知，但不抹去第一次取消，也不满足过去时的 pre-promotion predicate。

## 6. 适用边界与是否采用

采用为 Human / 总平台下一次 mainline promotion 的 candidate receipt 增量：增加 `promotionObservedByAt`、`canonicalClaimIssuedAt`、每次 attempt 的 critical-step conclusions、首个完整成功的 `gateCompletedAt`、`orderingSatisfied` 与 metadata-only descendant allowlist。先在单 Mother 使用，不修改 R2 全局规则。

本事件不自动触发回滚：用户授权、旧版本保留、runtime byte identity 与最终公网门禁均已成立。正确处置是保留 sequence exception，并禁止将其叙述成“合入前门禁通过”。是否提升为全局强制，等待下一次 Human promotion 的实际 receipt 与协调者复核。

## 7. 生命周期与 KPI

- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/293#issuecomment-6183942058
- ACKNOWLEDGED / IMPLEMENTED / NEXT-PROMOTION-GATE-RUN / ADOPTED：false
- 当前固定 runtime post-promotion GATE-RUN：true（Actions `38669673332` attempt 2）
- USER-ACCEPTED：true（仅当前皮肤作为主线基线；不等于 production-ready）
- learning classifier gate：9/9
- pre-promotion ordering violation：1
- 首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、accepted delta 内部迭代数、从指令到合法 candidate 时间：unknown
- stale delivery：0；promotion-order exception：1
