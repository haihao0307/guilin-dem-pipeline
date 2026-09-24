# N30 — Tested Subject Lineage：纯回执后继不等于“当前 Head 已测试”

Date: 2026-09-24  
Status: **Candidate partial / real Fish history replay passed / not implemented**  
Scope: Fish R012 tested implementation、receipt 与 Task Anchor 的三段 lineage

## Bounded question

怎样允许已测试实现之后追加纯回执/Task Anchor，而不强迫重跑未变化的生产测试，同时阻止可移动分支头冒充被测试对象？

## 现有真实失败 / 风险

Observation Root O1（当前 main 制度）：R2 OS、Freshness gate、Reference gate 与根 AGENTS 已要求 exact head、生产 diff、回执和 evidence package 绑定，禁止 stale artifact；这些规则不允许把旧运行冒充新实现。

Observation Root O2（Fish R012 真实 lineage）：workflow run `35974311593` / job `107551050350` 明确测试实现 `b5f2d11cbf55e17518dda411bf034596818c46d5`。其后：

- `8c68829d91d3e9bc9ca56670cda964ab96ed5d0a` 的唯一增量是 `DELIVERY_RECEIPT_R012.md`；
- `862c4a78436a904c0e06c08d295ff5c46c3e25e5` 的唯一增量是 `TASK_ANCHOR_R012.json`；
- GitHub compare 证明 tested subject 是两者的精确 merge base，累计只新增上述两个 `receipts-r012/` 文件；
- Task Anchor 仍明确写 `verifiedRuntimeCommit=b5f2d11...`，并保留 run/job、公开 HTML bytes/digest 及所有验收边界。

这条真实链没有“旧模型冒充新生产增量”；但它暴露一个制度空隙：若把 branch head 当测试对象，会错误声称 `862c4a7` 被 run 测试；若任何后继提交都强制重跑完整生产测试，则纯回执也付出无关成本。

## 外部方法 / 独立证据

Observation Root O3（[Git References](https://git-scm.com/book/en/v2/Git-Internals-Git-References)）：Git 官方说明 branch 本质是指向工作线 head 的简单引用，并可由 `update-ref` 移动；因此 branch 名不是稳定的测试对象身份。

Observation Root O4（[gitrevisions](https://git-scm.com/docs/gitrevisions)）：完整对象名指向特定 commit object；ref name 解析为其当前引用的 commit。两者语义不同。

Observation Root O5（[in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md) 与 [SLSA VSA v1.1](https://slsa.dev/spec/v1.1/verification_summary)）：attestation subject 应是带 digest 的不可变 artifact；验证时必须确认 statement subject 与实际 artifact digest 匹配。这里只迁移“验证结果绑定不可变 subject”这一约束，不引入整套供应链框架或签名体系。

## 与当前 KAOPU 制度比较

No-novelty：现行 exact SHA、freshness、production diff 与 Delivery Receipt 已经要求“证明属于哪个版本”。Fish R012 的真实回执也正确保存了 `verifiedRuntimeCommit`。

新增缺口：制度尚未给“tested subject 与 receipt-only descendant”一个机器可判的中间状态和 allowlist 条件。仅比较 branch head 等值会把合法纯回执误判 stale；仅说“文档提交”又会让未测试实现或无关制度变更静默继承绿灯。

## 可反驳假设

若测试主张固定绑定 `testedSubjectSha`，并仅在以下条件全部满足时允许后继承载该主张：

1. tested subject 是 receipt/head 的祖先；
2. receipt 明确绑定原 tested subject、run/job 与 artifact identity；
3. 从 subject 到 head 的完整 changed-path set 全部落在任务级 metadata allowlist；
4. 对外表述区分 `TESTED_SUBJECT_VERIFIED` 与 `METADATA_ONLY_DESCENDANT_VERIFIED`；

则真实 Fish 三段链应通过，而合成的生产文件变化、分叉 head、错绑 head、缺失 run binding 与无关文档变化应全部 HOLD。任一不成立即否定假设。

## 最小试验 / 历史回放

Observation Root O6（N30 executable probe）：fixture 固定三个真实 SHA、parent map、两个真实 changed paths、run/job 与 HTML identity；再加入五个反证控制。

结果 `8/8`：

- `b5f2d11`：`TESTED_SUBJECT_VERIFIED`；
- `8c68829` 与 `862c4a7`：`METADATA_ONLY_DESCENDANT_VERIFIED`；
- tested subject 后修改 `web-r012/prepare_r012.py`：`HOLD_UNTESTED_NONMETADATA_DELTA`；
- 分叉 head：`HOLD_LINEAGE_DIVERGED`；
- 把 `862c4a7` 写成测试 subject：`HOLD_RECEIPT_SUBJECT_MISMATCH`；
- 缺 run binding：`HOLD_RECEIPT_BINDING_INCOMPLETE`；
- tested subject 后改无关 policy 文档：同样 HOLD，而不因扩展名 `.md` 自动放行。

反证控制证明“纯文档”不能作为通用豁免；只有明确 allowlist + 完整 diff 才能继承 receipt。该试验不验证 GitHub 权限、签名、防篡改或 Mother 实际采用。

## Current Best View / 是否采用

**Candidate partial：仅建议 Fish 下一次出现 `testedSubjectSha != observedBranchHead` 的交付回执时做单 Mother 试验；不修改全局 R2。**

建议回执增加或显式保留：

- `testedSubjectSha`
- `receiptSha`
- `observedBranchHead`
- `workflowRun / workflowJob / artifact identity`
- `subjectIsAncestor`
- `changedPathsFromTestedSubject`
- `metadataPathAllowlist`
- `verifierState`

状态语义：

- `TESTED_SUBJECT_VERIFIED`
- `METADATA_ONLY_DESCENDANT_VERIFIED`
- `HOLD_LINEAGE_DIVERGED`
- `HOLD_RECEIPT_SUBJECT_MISMATCH`
- `HOLD_RECEIPT_BINDING_INCOMPLETE`
- `HOLD_UNTESTED_NONMETADATA_DELTA`

### Rejected

- 将 branch 名或当前 head 直接写成 tested subject；
- 只凭提交消息判断“文档-only”；
- 对所有 `.md/.json` 全局放行；
- 因 receipt-only successor 合法而把其后的任意提交一并继承绿灯；
- 为纯 metadata successor 无条件重跑昂贵生产测试。

### 适用边界 / Frozen / Unknown

- 适用：生产测试与回执分两次提交、发布后补 Task Anchor、多阶段 evidence sealing。
- 不适用：subject 后存在 runtime/source/workflow/public artifact 变化；此时必须新测试或 HOLD。
- Frozen：生产 Mother、main R2 OS、Fish R012 runtime、现有网页、Canonical Truth 均未修改。
- Unknown：Fish 是否实施、独立 verifier 是否回签、是否降低 stale claim 或内部迭代成本、是否值得全局激活、用户验收。
- 第一梯队专家 AI：未调用。
