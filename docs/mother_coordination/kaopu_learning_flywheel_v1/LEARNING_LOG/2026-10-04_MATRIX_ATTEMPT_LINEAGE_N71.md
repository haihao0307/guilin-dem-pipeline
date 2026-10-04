# N71 — 一次 run 的并行失败不能压成一个 signature

Date: 2026-10-04  
Status: **Candidate partial / Kuko history replay passed / not Mother-implemented**  
Scope: Kuko full-cluster workflow runs #25–#28；更新既有 regression `SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001`

## Bounded question

达到 R2 的两次失败阈值后，现有 `attemptLedger` 若每个 run 只允许一个 `jobId + failureSignature`，是否会在矩阵门禁中先丢失并行失败，导致最终绿灯无法证明旧失败已完整复测？

## 现有真实失败

Observation Root O1（R2/current main）：同一 bounded task 第二次失败后必须进入 `ROOT_CAUSE_REVIEW`；最终成功不得替代失败学习。N31 已建立“最终成功不能抹除失败尝试”的 Candidate，但其 fixture 每个 run 只有一个 `jobId` 和一个 `failureSignature`。

Observation Root O2（GitHub Actions 原始 run/job/log）：

- run `37170827682` / head `e0067296...`：8 个矩阵单元中 7 个失败；至少存在四类不同签名：drawer pointer interception、landscape controls not hit、state-import control sync、fiber playback state static；
- run `37171413749` / head `04ffd14a...`：仍为 7 个失败，但 core、touch 已变成新签名（first-entry control disabled、short-viewport canvas dominance），orbit 与 public/catalog 的旧类仍在；
- run `37172382735` / head `39a597e1...`：只剩 file/public catalog 两个失败，签名为 fiber playback time not advancing；
- run `37172690396` / head `59a3e722...`：8 个矩阵单元与 aggregate 全部成功。

`gh-pages` 的 Kuko 目录没有 `attemptLedger`、`rootCauseReview`、`learningClosure` 或前三个 run ID。故 run #28 只证明 terminal exact-head 技术门禁成功；没有机器可判对象证明 16 个失败 job observation、跨 run 签名变化、三段 repair delta 与最终复测闭环。

## 外部方法 / 独立证据

Observation Root O3（[GitHub Actions matrix 官方文档](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/run-job-variations)）：matrix 的每个变量组合会创建独立 job run；failure handling 也发生在 job 粒度。把整个 workflow run 压成单个 job/signature 会丢掉平台原生执行身份。

Observation Root O4（[Playwright retries 官方文档](https://playwright.dev/docs/next/test-retries)）：首次失败、重试后通过的测试被分类为 `flaky`，不等价于 first-run `passed`。这里迁移的是“terminal pass 与历史失败分账”，不把 Playwright 的 flaky 标签直接套成 KAOPU 用户验收。

## 与 KAOPU 当前制度比较

No-novelty：两次失败触发 RCA、不可抹除失败、技术门禁与学习闭环分账，均已由 R2/N31 规定。

真正新增：N31 的 run-level scalar schema 不能表达 matrix fan-out。`attemptLedger[].matrixJobs[]` 至少要保存 `jobId + matrixCell + conclusion + failureSignature`；RCA 与 terminal retest 必须覆盖 `matrixCell:failureSignature`，不能只覆盖去重后的 signature 名称。

## 可反驳假设

若把既有 Candidate 扩展为 job-level matrix ledger，并要求：

1. 每个 run 精确列出预期 matrix cells；
2. 每个失败 cell 保留独立 jobId 与 signature；
3. RCA 覆盖所有 `cell:signature` 键，并把 normalized signature 绑定真实 repair delta；
4. terminal success 复测所有曾失败键并列出 superseded run IDs；

则 #28 可保持 `VERIFIED_FINAL_ATTEMPT`，而漏掉任一并行 job、篡改旧结论、把 file/public 合并成一条、漏绑 repair 或漏复测都会独立 HOLD。

## 最小试验 / 历史回放

N71 probe 固定 #25–#28 的 4 个 run、32 个 matrix job observation、4 个 aggregate job 与 3 段真实 changed-path delta。结果 `9/9`：

- 真实历史、无 machine-readable RCA：`technicalGate=VERIFIED_FINAL_ATTEMPT`，`learningClosure=HOLD_ROOT_CAUSE_REVIEW_MISSING`；
- 完整合成 closure：`TERMINAL_SUCCESS_WITH_MATRIX_FAILURE_LINEAGE`；
- 反证控制分别拦截：只保留最终 run、漏一个并行 job、篡改旧 job、漏一个 cell/signature、repair SHA 不匹配、terminal retest 漏 cell、supersession 漏 run。

## 适用边界 / 是否采用

**Candidate partial；局部路由 Kuko 下一次同类多 run 矩阵交付试用。** 不追溯降级 #28 的技术成功，不修改全局 R2，不阻断 run #29，不修改生产 Mother/`gh-pages`。

- Applicable：一个 bounded task 由 matrix jobs 验证，达到 RCA 阈值并随后 terminal success。
- Not applicable：单 job workflow；低于阈值的单次失败；已明确证明为外部基础设施故障的记录仍保留，但本候选不强制完整 RCA。
- Rejected：只存 aggregate conclusion；每个 run 只存一个代表 job；按 signature 去重后丢掉 matrix cell；用最终全绿替代失败谱系。
- Frozen：main、R2 OS、生产分支、Kuko runtime/页面、现有技术成功、门槛。
- Unknown：Kuko 是否实施、独立 verifier、ADOPTED、USER-ACCEPTED、首次候选通过率、同错复发率、rejected lineage/stale delivery、内部迭代数、合法 candidate 时间。
- 第一梯队专家 AI：未调用。
