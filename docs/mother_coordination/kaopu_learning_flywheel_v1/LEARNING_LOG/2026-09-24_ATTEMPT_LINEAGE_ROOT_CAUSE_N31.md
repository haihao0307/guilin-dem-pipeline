# N31 — 最终绿灯不能抹除失败尝试：技术结论与学习闭环分账

Date: 2026-09-24  
Status: **Candidate partial / real Fish history replay passed / not implemented**  
Scope: Fish R012 两次浏览器失败、两段修复与最终成功的 attempt lineage

## Bounded question

同一 bounded task 在两次失败后最终通过时，怎样允许最终成功更新当前技术门禁，同时确保失败事实、根因复核、修复增量和复测覆盖没有被“绿灯”覆盖掉？

## 现有真实失败

Observation Root O1（当前 main 制度）：R2 OS 第 10 节已经规定同一 bounded task 连续两次失败必须进入 `ROOT_CAUSE_REVIEW`，而不是继续凭感觉微调。Freshness gate、Reference gate 与根 AGENTS 另外要求 exact head、真实回执、回归与 producer/verifier 分离。

Observation Root O2（Fish R012 的三个真实 run，来自 GitHub Actions run/job/step 记录）：

1. run `35972942265` / job `107546645465` / head `3249b38d...`：数值检查通过，但 `Real offline 3D...` 失败。日志同时保存 `TypeError: Cannot read properties of undefined (reading 'toFixed')`，随后 boot-error overlay 持续拦截 `#otherFinFocus`；
2. run `35973503878` / job `107548433781` / head `9d3fb3e...`：同一阶段再次失败，但签名变为 `ReferenceError: window is not defined`；
3. run `35974311593` / job `107551050350` / head `b5f2d11...`：数值、浏览器、发布、公网回归及最终 proof 步骤全部成功。

Observation Root O3（真实 repair delta）：

- `3249b38d... → 9d3fb3e...` 只改 `otherfins.mjs`，把共享 fish animation state 与面板本地 state 分开，直接对应第一次 runtime/UI state-reference 错误；
- `9d3fb3e... → b5f2d11...` 只改 `prepare_r012.py`，把 Node harness 中错误的 `window.FISH_OTHER_FINS...` 查找改为已捕获的 `result.otherFinStudy...`，对应第二次 harness global-scope 错误。

两个失败位于同一 gate，但并不是同一异常签名；“同一阶段失败”不能自动等同于“同一根因”。#91 的最终回执正确保留最终成功 run/head，但没有一个机器可判对象把三次尝试、两条签名、两段修复及最终复测覆盖封成闭环。

## 外部方法 / 独立证据

Observation Root O4（[Google SRE — Postmortem Culture](https://sre.google/sre-book/postmortem-culture/)）：正式 postmortem 应记录 incident、影响、缓解、root cause 与防复发 follow-up；评审还要检查证据是否充分、根因是否足够深入、行动项是否适当。其目标不是把最终恢复当作失败从未发生。

Observation Root O5（[GitHub REST — Workflow runs](https://docs.github.com/en/rest/actions/workflow-runs?apiVersion=2022-11-28) 与 [Re-run workflows and jobs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)）：GitHub 把 workflow run/attempt 作为可独立查询的执行记录，包含 head SHA、status/conclusion 等身份；重新运行不会把原失败步骤改写为成功。这里只迁移“尝试记录不可变、最终结论另行计算”的约束，不引入完整 SRE incident 系统。

## 与 KAOPU 当前制度比较

No-novelty：R2 已经有“两次失败触发 RCA”、禁止感觉微调、exact head、回执及回归要求；无需新增会议或再造一套 postmortem 制度。

新增缺口：当前规则没有一个 executable receipt schema 同时表达：

- `technicalGate`：最新精确 subject 是否已经通过；
- `learningClosure`：达到 RCA 阈值后，历史失败是否完整、根因/贡献因素是否覆盖、每项修复是否绑定真实 delta、最终复测是否覆盖旧签名。

若只有一个 `PASS`，最终成功可能合法更新技术状态，却同时让失败谱系、纠错成本和防复发证据从交付回执中消失。

## 可反驳假设

若回执保存不可变有序 `attemptLedger`，并在失败次数达到阈值后要求：

1. 每次尝试绑定 `runId + jobId + headSha + conclusion + failedGate + failureSignature`；
2. `rootCauseReview` 覆盖所有实际失败签名，而不是把同一 gate 的不同异常强并为一个根因；
3. 每项 corrective action 绑定后继真实 repair SHA/diff；
4. terminal success 列出复测签名及被 supersede 的失败 run；
5. 技术门禁与学习闭环分别结算；

则真实最终成功仍可得到 `VERIFIED_FINAL_ATTEMPT`，但删除/篡改失败、漏做 RCA、漏绑修复或漏复测都会被独立 HOLD。任一反例通过即否定假设。

## 最小试验 / 历史回放

Observation Root O6（N31 executable probe）：fixture 固定三个真实 run/job/head、两条日志签名及两段真实 changed-path delta。门禁结果 `8/8`：

- 真实现状式回执（完整 attempts + final success，但没有机器可判 review）：技术状态为 `VERIFIED_FINAL_ATTEMPT`，学习闭环为 `HOLD_ROOT_CAUSE_REVIEW_MISSING`；
- 完整合成闭环：`TERMINAL_SUCCESS_WITH_FAILURE_LINEAGE`；
- 只保留最终成功：`HOLD_ATTEMPT_LEDGER_INCOMPLETE`；
- 把旧 failure 改写为 success：`HOLD_ATTEMPT_RECORD_MUTATED`；
- 没有真实 terminal success：被权威 attempt 对照拒绝；
- review 漏掉第一条失败签名：`HOLD_ROOT_CAUSE_SIGNATURE_COVERAGE`；
- corrective action 指向不存在的 repair delta：`HOLD_CORRECTIVE_DELTA_UNBOUND`；
- 最终 run 只声明复测第二条签名：`HOLD_FINAL_RETEST_COVERAGE`。

反证控制证明该门禁不会因为缺少学习闭环而伪造技术失败，也不会因为最终成功而篡改早期失败。它尚未证明制度 KPI 改善、Mother 实施成本、独立 verifier 可用性或全局适用性。

## Current Best View / 是否采用

**Candidate partial：不追溯降级 Fish R012 已成立的最终技术成功；仅建议 Fish 下一次同类多尝试交付做单 Mother 试验。**

候选回执对象：

- `attemptLedger[]`
- `rootCauseThreshold`
- `rootCauseReview.triggeredAfterRun`
- `observedFailureSignatures[]`
- `correctiveActions[].{addresses,fixSha,changedPaths}`
- `terminalSuccess.{runId,headSha,retestsSignatures,supersedesRunIds}`
- `technicalGate`
- `learningClosure`

Candidate regression：`SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001`。

### Rejected

- 最终成功后删除或改写失败 run；
- 因两次失败发生在同一 workflow step 就宣称同一根因；
- 把“最终已通过”当作 Root Cause Review 的替代品；
- 因学习闭环缺失而伪称已经通过的精确技术 gate 仍失败；
- 未经单 Mother 试验就修改全局 R2 或阻断全部单次重试。

### 适用边界 / Frozen / Unknown

- 适用：同一 bounded task 多次真实尝试、达到 R2 RCA 阈值、随后取得 terminal success。
- 不适用：偶发基础设施故障尚未达到阈值；单次失败仍应记录，但本候选不强制完整 RCA。
- Frozen：生产 Mother、main R2 OS、Fish R012 runtime、现有发布状态、Canonical Truth 均未修改。
- Unknown：Fish 是否实施、独立 verifier 是否回签、首次通过率/同错复发率/内部迭代数是否改善、全局适用性、用户验收。
- 第一梯队专家 AI：未调用。
