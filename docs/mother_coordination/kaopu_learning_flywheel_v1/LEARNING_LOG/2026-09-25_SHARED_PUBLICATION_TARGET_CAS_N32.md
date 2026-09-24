# N32 — 共享发布入口必须做目标级 CAS：本地通过不等于有权覆盖

- 状态：Candidate partial / Fish 真实历史回放通过 / 未实施
- 范围：Fish R008–R009；只研究共享发布入口的并发写入许可
- 不修改：生产 Mother、main R2 OS、Canonical Truth、既有发布物与用户冻结

## 一个 bounded question

当两个各自通过本地验证的候选都准备写入同一公网入口时，现有“版本检查 + 非 force push + workflow concurrency”是否足以防止较晚写入者覆盖已经发布的新结果？

## 现有真实失败 / Observation Roots

1. **Observation / R2 基线：**R2 已要求共享真值只能有一个 owner，并把 Producer 与 Verifier 分权；本轮不推翻该基线。
2. **Observation / Features R008：**提交 `60e2c6d054f2a74a33aa8bd530e365c021b24927` 的 run `35898899451` 完成全部步骤并发布 `FISH_FEATURES_R008`；HTML 为 `85,172,749` bytes，SHA-256 为 `623e31dba94c83abbc1f232666bcd2b395668e2c8789ae124353549ec1ce406f`。
3. **Observation / Oral R008：**提交 `6f2aec5e79f844311d3970bf6dfbd3fa64eb8abc` 的 run `35898927122` 已通过本地编译、浏览器、prior/oral/fault-recovery 门禁，但发布时在共享的 `fish-mother-yellowfin/index.html` 发生 merge conflict；workflow 失败，公网验证被跳过，未覆盖 Features R008。
4. **Observation / 源码机制：**两个 R008 workflow 写同一目标，却分别使用 `fish-features-r008` 与 `fish-oral-r008` concurrency group；它们不会互斥。两者发布失败后都会执行 `git pull --rebase origin gh-pages` 并重试。此次内容冲突恰好阻断覆盖，但若变更可干净 rebase，fast-forward 仍不能证明写入者基于当前逻辑目标构建。
5. **Observation / 合流 R009：**提交 `e52fd8cf1313f80d84197333a63931ce2f0d44da` 的 run `35900273432` 绑定 Features R008 为精确 predecessor，包含 Features 与 Oral 两条 lineage，重跑相应回归后发布成功。HTML 为 `86,123,736` bytes，SHA-256 为 `6e21c7de7641739d237d9712242de18f5efedda4090a757374b5ef6ea9ef5762`。

这些 Observation Roots 分别来自 workflow 源码、不可变提交、实际 run/job 步骤和 #91 回执；它们不能合并成“一个绿色 CI 就证明一切”。

## 外部方法 / 一手证据

- GitHub Actions 只对**相同 concurrency group** 的 job/workflow 做互斥；不同 group 不构成同一锁：[Control the concurrency of workflows and jobs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)。
- GitHub Git refs API 的 `force=false` 只允许 fast-forward，能够防止强制覆盖提交历史，但没有声明候选是针对当前目标内容构建：[Update a reference](https://docs.github.com/en/rest/git/refs?apiVersion=2022-11-28#update-a-reference)。
- HTTP `If-Match` 用强校验器为状态修改提供前置条件；不匹配时服务器不得执行该修改，典型用途是防 lost update：[RFC 9110 §13.1.1](https://www.rfc-editor.org/rfc/rfc9110.html#name-if-match)。

## 与 KAOPU 当前制度比较

### No-novelty

- R2 的 shared-truth single-owner、拒绝 force overwrite、Producer/Verifier 分权已经正确。
- 现有 Fish workflow 已检查版本字符串，R009 还绑定了精确 predecessor 并重新验证合流结果。

### 新缺口

- concurrency group 没有从共享 `targetKey` 推导；两个写同一入口的 workflow 可以使用不同组。
- header 版本白名单不是对象身份；它无法证明 bytes/digest/source build 是同一个目标对象。
- 早期检查与真正 push 之间存在 TOCTOU。
- 盲目 pull-rebase-retry 可能把“目标已推进”转化成新的提交，而没有重新取得覆盖许可。
- 本地技术候选状态和共享目标发布许可尚未被明确拆开。

## 可反驳假设

若共享发布回执增加目标级 compare-and-swap：

1. 用 `targetKey` 标识共享入口；
2. 保存 `casExpectedSubject = version + sourceBuildSha + artifact digest`；
3. 在真正变更目标的紧邻步骤再次读取 `observedSubjectAtMutation`；
4. 两者不完全一致就 HOLD，禁止 force 或自动 rebase 后无条件重试；
5. 目标已推进时，新候选必须显式包含全部 required predecessor subjects 并重跑相应测试；
6. 同一 target 使用 target-wide concurrency group，但锁不替代 CAS；

则能拒绝 Fish R008 的 stale Oral writer，同时允许具备完整 lineage 和回归覆盖的 R009 合流候选。

## 最小历史回放

`publication_cas_gate_n32.py` 对固定 fixture 执行 8 个用例，结果 `8/8`：

1. Features R008 作为首写者，目标仍为 R007：ALLOW。
2. Oral R008 仍期待 R007，但目标已为 Features R008：HOLD。
3. header 字符串仍在白名单，但对象身份已改变：HOLD。
4. 早期检查后目标推进：HOLD。
5. 自动 rebase 且不重新验证目标：HOLD。
6. R009 精确绑定 Features R008，包含两条 lineage 并重跑全部适用测试：ALLOW。
7. 合流候选遗漏 Oral subject：HOLD。
8. 即使使用同一 concurrency group，但 CAS 过期：HOLD。

## Current Best View / 是否采用

- **Candidate partial：**下一次 Fish 固定入口发布可做单 Mother 试验；尚不修改全局 R2。
- **Current Best View：**`VERIFIED_LOCAL_CANDIDATE` 与 `PUBLICATION_CAS_ALLOWED` 是两个独立状态。前者不能授权后者。
- 候选回执字段：`targetKey`、`candidateSubject`、`casExpectedSubject`、`observedSubjectAtCheck`、`observedSubjectAtMutation`、`writerConcurrencyGroup`、`serializationCoverage`、`conflictPolicy`、`requiredIntegratedSubjects`、`candidateIncludesSubjects`、`testsRerun`、`candidateTechnical`、`publicationDecision`。
- 候选回归：`SHARED-PUBLICATION-TARGET-CAS-001`。

## Rejected

- 本地 QA 通过即获得共享目标写权限。
- 较高版本号或较晚时间戳自动获胜。
- 不同 workflow 各有 concurrency group 就等同 single publisher。
- push 失败后无条件 pull-rebase-retry。
- fast-forward 即证明没有 stale overwrite。
- 因这一次 merge conflict 成功阻断，就认为制度已完整。

## 适用边界与 Unknown

- 只适用于可变共享 alias/path/pointer；不可变内容寻址对象不需要同样的覆盖许可。
- CAS 只防 lost update，不证明视觉正确、语义正确、用户接受或公网设备表现。
- 实际 workflow 尚未实施；独立 verifier、真实下一次 Mother gate-run、制度 KPI、用户验收均为 Unknown。
- 第一梯队专家 AI 未调用；本轮不是专家会。

