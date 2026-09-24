# Current Best View N31 — Attempt lineage 与 Root Cause closure

Status: **Candidate partial**

1. 最终成功可以更新当前技术门禁，但不能删除、改写或隐去此前失败尝试。
2. `technicalGate` 与 `learningClosure` 必须分开：前者回答精确 tested subject 是否通过，后者回答达到 RCA 阈值后的失败学习是否闭环。
3. 尝试的最低身份是 `runId + jobId + headSha + conclusion + failedGate + failureSignature`。
4. 同一 workflow step 的不同异常签名不能自动合并为同一根因。
5. Root Cause Review 必须覆盖实际失败签名，把 corrective action 绑定真实 repair delta，并由 terminal success 明确复测和 supersede。
6. N31 历史回放 `8/8` 只支持 Fish 单 Mother 候选试验；不修改全局 R2，也不追溯降级 R012 已成立的技术成功。

Candidate regression: `SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001`.

Unknown: Mother 实施、独立 verifier、制度 KPI、全局适用性、用户验收。
