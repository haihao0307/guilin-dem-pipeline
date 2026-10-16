# N166 — Material R01 绿色运行发生在 main 更新之后

- 日期：2026-10-17
- Mother：Material / Coordinator
- 类型：制度验证 / promotion ordering / historical replay
- Bounded question：Material R01 已进入 `main` 后才开始并完成的绿色 workflow，能否证明“合入前门禁已通过”？
- 结论：不能；当前合法状态为 `POST_PROMOTION_REVALIDATED__PREPROMOTION_SEQUENCE_EXCEPTION_RETAINED`。

## 1. 现有真实失败

本轮刷新发现 `main` 新增 Material Master R01，两次 source 变更都直接进入 `main`，没有关联 PR：

1. `e0fd909c...` 于 2026-10-16 19:35:43Z 写入 `main`；run `38956081867` 于 19:35:51Z 开始、19:37:15Z 完成并成功。
2. `4f2ddb13...` 于 19:39:24Z 写入 `main`；run `38956526522` 于 19:39:31Z 开始、19:42:00Z 完成并成功。

两个运行都绑定了各自 exact head，成功事实保留；但时间顺序均为 `main ref update -> workflow start -> workflow success`。因此它们只能证明合入后的 scoped revalidation，不能倒写为合入前 gate closure。公开 branch 记录同时显示 `main.protected=false`、required-status-check enforcement 为 off；两个 commit 的 PR association 均为空。

这不表示 Material R01 已被证明损坏，也不撤销两次真实绿色运行。当前未验证项是：合入前门禁顺序、独立 verifier、最终公网 HTTPS runtime 与用户视觉接受。

## 2. 外部方法 / 与 KAOPU 当前制度比较

GitHub 官方的 protected branch / ruleset 可以要求 PR 审核，并要求 status checks 在合并前通过；还可以要求最近一次可审阅 push 由提交者之外的人批准。该方法正好把 `VERIFY -> PROMOTE` 的顺序变成机器约束。

- https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/managing-a-branch-protection-rule
- https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets

R2 已明确规定 `LOCK -> EXECUTE -> VERIFY -> PROMOTE`，只有全部门禁通过的候选才能成为 baseline；因此外部方法在原则层为 `NO_NOVELTY`。本轮新增只是 Material 的真实时间线反例，以及可执行分类回放。未建议本轮直接修改仓库 ruleset。

## 3. 可反驳假设

假设：下一次 Material 变更先在候选分支形成 exact subject，绑定同一 SHA 的 workflow 成功和独立 verifier 回执，再更新 `main` ref，就能同时：

- 拦截当前两个“合入后才绿”的时间线；
- 拦截 wrong-head、失败 run 和缺独立 verifier；
- 放行真正的 pre-promotion gate 与其后的 main 更新。

若分类器把当前时间线判成 pre-promotion verified，或无法放行完整正控，则该假设被反驳。

## 4. 最小历史回放

复用 `FINAL-CLAIM-CLOSURE-001`，不重复创建 regression。隔离回放 8/8，覆盖：

- subject 未绑定；
- 绿色 run 属于错误 head；
- exact-head run 失败；
- Material 初版真实 post-promotion 绿色时间线；
- Material 修订版真实 post-promotion 绿色时间线；
- pre-promotion gate 缺独立 verifier；
- exact-head gate + verifier 完成、尚未 promotion 的正控；
- gate + verifier 先完成、随后更新 main 的正控。

## 5. 适用边界与是否采用

仅作为下一次 Material 变更的 Candidate：

- 使用独立 branch / PR；
- gate 必须绑定将被晋级的 exact SHA；
- 独立 verifier 回执必须早于 `main` ref 更新；
- 后续 post-promotion revalidation 可以保留，但不能倒写历史；
- 不自动回滚当前 Material R01，不修改 `main`、ruleset、R2 或生产资产。

## 6. 生命周期与 KPI

- regression：`FINAL-CLAIM-CLOSURE-001`（existing Candidate; N166 evidence update）
- classification replay：8/8
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6223407254
- ACKNOWLEDGED / IMPLEMENTED / TARGET-GATE-RUN / ADOPTED / USER-ACCEPTED：false
- exact-head post-promotion green timelines observed：2
- 首次候选通过率、用户纠错次数、同错复发率、accepted delta 内部迭代数及从指令到合法 candidate 时间：unknown
