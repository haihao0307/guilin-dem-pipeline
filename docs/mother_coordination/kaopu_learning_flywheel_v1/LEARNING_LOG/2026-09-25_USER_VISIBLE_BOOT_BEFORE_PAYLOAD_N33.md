# N33 — 最终 ready 不能证明首屏可见：大型单体 HTML 的启动与失败可见性

- 状态：Candidate partial / Fish 真实历史回放通过 / 未实施
- 范围：Fish R006 与 R006.1；只研究大型 standalone HTML 的早期可见状态
- 不修改：生产 Mother、main R2 OS、Canonical Truth、现有公网发布、用户冻结与会议分工

## 一个 bounded question

当大型单体 HTML 的最终本地/公网浏览器回归和发布检查全部成功时，这些证据是否足以证明用户在主 payload 尚未完成或发生截断/能力失败时，不会看到白屏？

## 现有真实失败 / Observation Roots

1. **Observation / R2 基线：**R2 已要求用户不是第一层 QA，并要求浏览器、桌面/移动视口与发布回读；本轮不推翻这些正确要求。
2. **Observation / R006 技术绿灯：**精确测试对象 `a987895498c51e46ef786f4cab0a69ef8679526e` 的 run [`35843264304`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35843264304) 为 success。job 明确完成离线浏览器、发布、完整公网字节验证和最终公网浏览器步骤。
3. **Observation / 用户白屏：**随后用户报告交付 HTML 是白屏。Fish 回执明确写明该真实用户观察优先于之前 CI，通过不能改写成用户机器正常：[issue #91 comment 5793670891](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5793670891)。这是独立于 workflow 绿灯的 Observation Root。
4. **Observation / 可确认的架构缺口：**后续审计确认旧构建把大型 Teacher payload 放在创建可见启动/恢复 UI 的模块之前；这说明 R006 的最终 ready 路径没有覆盖“响应仍停在 payload 前”的用户观察时段，但不证明它是原用户机器故障的唯一根因：[issue #91 comment 5794913138](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5794913138)。
5. **Observation / R006.1 增量：**精确对象 `9d17da85c18659d1dbbeb29d6b6289d77475b775` 的 run [`35850561063`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35850561063) 为 success。job 新增 `Delayed payload, truncated file, WebGL unavailable, context-loss and retry tests`，并在公网执行 cold-start/recovery 检查。构建把可见 shell 放在 `<16384` bytes 的 boot prefix，原 `58,908,280` bytes GLB 分成 `75` 个 `786,432` bytes 块。
6. **Observation / 边界：**R006.1 仍记录 `userDeviceRetested=false` 与 `originalClientCauseConfirmed=false`；桌面和 `390×844` Chromium 不是用户实体设备验收。

这些 roots 必须保持分离：最终运行成功、用户白屏、源码顺序、故障恢复 run 和用户设备验收不是同一证据。

## 外部方法 / 一手证据

- W3C Paint Timing 将页面加载描述为一段过程而不是单一时刻；First Paint/FCP 回答的是浏览器是否开始渲染以及是否出现内容。空白文档可以没有这些时刻：[Paint Timing Level 1](https://www.w3.org/TR/paint-timing/)。
- Playwright 的 `waitUntil: "commit"` 表示已收到响应且文档开始加载，早于 `load`；官方也不建议把 `networkidle` 当成 readiness，应该使用明确的 web assertions：[Page.goto `waitUntil`](https://playwright.dev/docs/api/class-page#page-goto-option-wait-until)。

可迁移的方法不是“加进度条”，而是在响应仍被故意停住时观察实际可见 paint，并把它与最终 ready、错误恢复、用户设备验收分别结算。

## 与 KAOPU 当前制度比较

### No-novelty

- R2 已正确要求用户不做第一层 QA、失败门禁内部消化、固定浏览器/移动视口检查和独立 verifier。
- freshness gate 已正确禁止把旧网页或旧证明冒充新结果。
- R006.1 已经实施了可见 shell、延迟/截断、WebGL 不可用、上下文丢失与重试测试；本轮不冒充新发明。

### 新缺口

- 通用 Gate 2 的“可正常打开”尚未明确区分最终运行 ready 与 payload 到达前的首个可见状态。
- 最终页面截图只能证明截屏时刻，不能证明此前没有白屏。
- 源码中 shell 排在 payload 前只证明字节顺序；若没有 held-response + actual painted visibility assertion，仍不能证明用户已经看到。
- 截断、能力不足、上下文丢失和重试若不各自有可见结果，silent fallback 仍可能逃过 happy-path 门禁。
- 用户白屏应只否定更强的 user-visible claim，不能反向删除已经成立的 artifact/final-ready 证据。

## 可反驳假设

对下一次大型 Fish standalone HTML，如果候选门禁同时要求：

1. 回执绑定不可变 tested subject 与 artifact identity；
2. boot shell 明确位于主 payload 前，并记录 byte upper bound/first payload offset；
3. 测试在 navigation `commit` 后把主响应停在 payload 之前；
4. 在 bounded deadline 内用实际 compositor/screenshot 或等价 paint evidence 证明非空可见 shell；
5. 截断响应产生可见错误；WebGL 不可用/上下文丢失产生可见恢复或回退；
6. 最终完整 payload 仍必须另行通过 final-ready；
7. 用户设备和原根因保持独立 Unknown；

则会拒绝 R006 的强“用户可见启动已验证”主张，同时接受 R006.1 的候选 runtime evidence，而不错误宣称用户设备已修复。

## 最小历史回放

`visible_boot_gate_n33.py` 对固定 fixture 执行 `8/8`：

1. R006 的对象绑定与最终 ready 仍保持 `CLAIM_VERIFIED`。
2. 用户白屏 Observation Root 将更强 user-visible claim 判为 `REJECTED_BY_USER_OBSERVATION`。
3. 只有最终 screenshot：HOLD。
4. shell 在源码前部但没有 painted observation：HOLD。
5. 只有 `load` 后检查、没有 pre-payload held response：HOLD。
6. R006.1 的 held-response、paint、截断、failure recovery 与 final-ready 组合：`CLAIM_VERIFIED`（Candidate replay）。
7. R006.1 未在用户设备复测：`UNKNOWN_USER_DEVICE_NOT_RETESTED`。
8. R006.1 未确认原客户端根因：`UNKNOWN_ORIGINAL_ROOT_CAUSE`。

## Current Best View / 是否采用

- **Candidate partial：**下一次大型 Fish standalone HTML 可局部试验 `USER-VISIBLE-BOOT-BEFORE-PAYLOAD-001`；尚不修改全局 R2。
- **Current Best View：**保存 `FINAL_RUNTIME_READY / USER_VISIBLE_BOOT_RESILIENT / VISIBLE_FAILURE_RECOVERY / USER_DEVICE_ACCEPTED` 四层状态，不以任一层替代另一层。
- 候选回执字段：`testedSubjectSha`、`artifactIdentity`、`bootPrefixUpperBoundBytes`、`firstPayloadByteOffset`、`navigationWaitState`、`responseHeldBeforePayload`、`paintedShellEvidence`、`visibilityDeadlineMs`、`truncatedResponseDecision`、`runtimeFailureRecoveryDecision`、`finalRuntimeReadyDecision`、`userDeviceRetested`、`originalClientCauseConfirmed`。

## Rejected

- CI/job 全绿即可宣称用户不会看到白屏。
- 最终 ready screenshot 代表整个启动阶段都可见。
- HTML 源码中存在 loading DOM 就等于已 paint。
- 延迟加载测试可以替代截断、能力失败和恢复路径。
- 用户白屏会使所有技术证据一并无效。
- R006.1 browser/viewport 通过即可宣称用户设备已经修好。
- 已找到一个架构缺口即可宣称它是唯一根因。

## 适用边界与 Unknown

- 候选仅针对 payload 足够大、可在 document shell 后独立到达的 standalone HTML；普通小页不自动强制同一门禁。
- 早期 shell 只证明用户获得可见状态，不证明主 3D 内容正确、性能达标或视觉被接受。
- 具体 deadline 必须由目标设备预算决定；N33 不把 R006.1 的测试时间直接设为全局阈值。
- 实际下一次 Mother 实施、独立 verifier、实体用户设备、制度 KPI、跨 Mother 适用性与用户验收均为 Unknown。
- 第一梯队专家 AI 未调用；本轮不是专家会。

