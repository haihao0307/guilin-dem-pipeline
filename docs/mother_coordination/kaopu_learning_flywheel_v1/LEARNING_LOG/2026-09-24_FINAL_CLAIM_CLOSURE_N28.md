# N28 — 最终 Claim Closure：证据完成不等于声明已封口

Date: 2026-09-24  
Status: **Candidate partial / real Mother evidence replay passed / not implemented**  
Scope: Stone Money R015.3 publication evidence only

## Bounded question

当一个 workflow 的所有技术步骤都成功，但早期生成的 `PUBLICATION_PROOF.json` 尚未吸收最后的公网浏览器结果时，怎样避免两种相反错误：忽略真实成功，或跳过最终声明封口、直接把 job success 冒充完成？

## 现有真实失败

Observation Root O2（GitHub Actions 真实运行）：R015.3 固定运行 [35973024167](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35973024167) 绑定 `66fb787c91772cf4efa6b1ba2618bff8c93032e6`。重组、Chromium 安装、本地 WebGL、发布与 HTTPS 逐字节回读、公网页面 WebGL、证据归档全部为 `success`。

Observation Root O3（该运行的不可变 artifact）：

- `ASSEMBLY_PROOF.json`：`956838 bytes / 7acf5fce...e68`，`EXACT_SOURCE_RECONSTRUCTED`；
- 本地与公网 `BROWSER_QA.json`：desktop 与 `390×844` 均 `passed=true`、首帧成功、0 runtime/request error；
- `PUBLICATION_PROOF.json`：HTTP 200、public SHA 与 source SHA 相同、`deployed=true`，但仍保存 `shareAllowed=false / publicBrowserPassed=false`；
- artifact 自身 SHA-256：`60c097af...36068`。

这里没有技术失败。失败机制是**证据产生时序**：`PUBLICATION_PROOF.json` 在后续公网浏览器步骤前生成；最后一步成功后没有一份新的、绑定全部证据的 final claim receipt。

N26 已证明“绿色 workflow + 关键步骤 skipped”必须 HOLD。本轮新增的是另一侧：所有步骤成功时，不能靠人工跨文件猜测来修改旧 proof，也不能让旧 false 永久遮蔽真实技术证据。

## 外部方法 / 独立证据

Observation Root O4（[SLSA Provenance v1.1](https://slsa.dev/spec/v1.1/provenance)）：provenance 用 `subject` 标识产物，以 `buildDefinition`、`runDetails`、`invocationId`、时间和 byproducts 描述一次具体执行，使消费者按预期验证产物。其扩展遵守单调原则：删除或忽略字段不应把 `DENY` 变成 `ALLOW`。

本轮不把 KAOPU 改造成 SLSA，也不声称普通 Actions artifact 是签名 attestation。仅迁移两点：

1. 声明必须绑定 exact subject/run/builder evidence，而不是靠 job 颜色；
2. 缺少最终封口对象时保持 HOLD，不能通过忽略缺项变成 ALLOW。

## 与当前 KAOPU 比较

Observation Root O1（main R2 OS、Freshness gate、Reference gate、根 AGENTS）：现行制度已经要求 claim 分层、head 绑定、真实浏览器、Producer/Verifier 分权，并禁止 publication 自动晋级 Game baseline 或用户验收。

No-novelty：N26 的 named claim + required steps + proof predicates 方向正确，不需要推翻。

新增缺口：N26 没有明确要求**final claim receipt 必须在最后一个 critical step 之后生成，并绑定所有 evidence digests**。分散证据可各自正确，但缺少可机读的唯一最终 Judgment。

## 可反驳假设

若要求最终声明只能由一个 post-critical-step reducer 生成，并绑定：

`claim + runId + headSha + subject bytes/digest + evidence digests + required step results + excluded claims + claimState`

则应得到：

1. 旧 run `35936763006`：关键证据缺失，`HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE`；
2. 新 run `35973024167`：技术证据全部完成，但无 closure，`HOLD_FINAL_CLAIM_UNSEALED`；
3. 加入一份完全匹配、最后生成的 closure 控制：`CLAIM_VERIFIED`。

任一不符合即否定假设。

## 最小试验 / 历史回放

Observation Root O5（N28 executable probe）：

- 旧绿色但 skipped 历史：5 个关键 step/evidence 条件未闭合，正确 HOLD；
- R015.3 真实历史：5 个关键步骤与 4 个技术证据谓词全部通过，但因无 final closure，保持 `HOLD_FINAL_CLAIM_UNSEALED`；
- 反证控制：closure 与 claim、run、head、subject、四份 evidence digest、时序全部匹配，得到 `CLAIM_VERIFIED`。

这保留了真实技术成果：R015.3 已是 `EXACT_SOURCE_RECONSTRUCTED + PUBLIC_BYTES_VERIFIED + DESKTOP/390×844_CHROMIUM_PASSED`。HOLD 的只是更强的最终声明，不是把已完成证据抹掉。

## Current Best View / 是否采用

**Candidate partial：建议 Stone Money publication lane 下一次局部试验，不修改全局 R2。**

新增一个 workflow 最末尾的 `Finalize named claim`：只读前序不可变 evidence，生成一份 `FINAL_CLAIM_RECEIPT.json`。它不得修 evidence，也不得把 `false/missing` 改成 true；只负责确定 scope 和状态。

建议字段：

`claimType, claimScope, runId, headSha, subject, requiredSteps, evidence[{path,sha256}], proofPredicates, issuedAfterCriticalSteps, excludedClaims, claimState, verifierIdentity`

### 状态

- `HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE`
- `HOLD_FINAL_CLAIM_UNSEALED`
- `HOLD_FINAL_CLAIM_INVALID`
- `CLAIM_VERIFIED`

### Rejected

- 用 job `success` 自动写 `PUBLICATION_COMPLETE`；
- 人工选择性忽略 `PUBLICATION_PROOF` 中的 false；
- 让早期 proof 被后续 step 原地静默改写而无新 digest；
- 将技术 publication claim 扩大为 iPhone、视觉、Game baseline 或用户验收。

### Frozen / Unknown

- Frozen：生产 Mother、R2 OS、R015.3 artifact、公网页面、Game accepted baseline、Canonical Truth 均未修改。
- Unknown：Mother 是否实施 finalizer、独立 verifier 是否回签、是否采用、真实 iPhone、人工视觉和用户验收、制度 KPI。
- 第一梯队专家 AI：未调用。

## 路由与既有 N26 状态

本轮已在真实 Mother run 上执行 N26 gate，因此 N26 可以更新为 `GATE-RUN=true`；但 Mother 未按 N26 字段实施 closure，故 `ACKNOWLEDGED/IMPLEMENTED/ADOPTED/USER-ACCEPTED` 仍为 false。
