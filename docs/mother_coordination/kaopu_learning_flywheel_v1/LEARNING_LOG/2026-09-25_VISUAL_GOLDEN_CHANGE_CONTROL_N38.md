# N38 — 视觉 golden 不能由同一 Producer 更新后批准自己的候选

- 日期：2026-09-25
- 状态：Candidate partial
- 范围：Fish R007 历史回放；只研究固定视图 visual golden 的身份、更新与批准
- 验证：12/12 fixtures 通过
- 不修改：生产 Mother、main R2 OS、Canonical Truth、现有公网发布、用户冻结与会议分工

## 一个 bounded question

当 Producer 为当前候选生成或更新 visual golden 后，能否用这个 golden 宣称同一候选通过视觉回归？

## 现有真实失败

1. Fish R007 的精确对象 [`2ae157f09512db7505ff64a1f78dfce4a97f039b`](https://github.com/haihao0307/guilin-dem-pipeline/commit/2ae157f09512db7505ff64a1f78dfce4a97f039b)、run [`35890512697`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35890512697)、job `107281492832` 全部步骤成功。workflow 真实保存了三张浏览器 PNG，并上传证据。
2. 该 run 没有把 PNG 与事先批准、身份冻结的 golden 做比较。随后人工查看截图才发现关闭 ghost 后右侧仍半透明。因此保留 `TECHNICAL_RUN_COMPLETE` 与 `VISUAL_EVIDENCE_CAPTURED`，拒绝更强的 `VISUAL_REGRESSION_VERIFIED`。
3. 修正版 [`d1e9b56f6456673d214ed165a8801a0beca0d249`](https://github.com/haihao0307/guilin-dem-pipeline/commit/d1e9b56f6456673d214ed165a8801a0beca0d249)、run [`35891489740`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35891489740) 冻结原始材质 tuple，并通过往返状态断言。这支持 `STATE_ROUNDTRIP_VERIFIED`；它仍未产生一个独立批准的 visual golden，且 `manualVisualAcceptance=false`、`userAcceptance=false`。
4. 失败机制不是“截图不存在”，而是截图只被保存，没有预先冻结的 oracle、比较规则与独立批准。若允许 Producer 在看到当前输出后运行 snapshot update，并用新 snapshot 比较同一输出，差异会变成零，但缺陷没有因此消失。

## 外部方法 / 一手证据

- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots)要求实际截图与 reference screenshot 比较；首次运行会生成 reference，并明确要求把 snapshot 提交到版本控制、审查变化。官方同时提醒结果会受 OS、浏览器版本、设置、硬件与 headless 模式影响，故比较环境必须一致。
- [GitHub CODEOWNERS](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)提供由指定 owner 审查路径变更、并可由 branch protection 要求批准的成熟机制。
- [GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)可要求批准审查和状态检查，并在新提交改变 diff 时撤销旧批准。

本轮只迁移最小原则：golden 是受控验证资产；更新 oracle 与验证候选必须分权。没有要求所有 Mother 全局启用 CODEOWNERS，也没有把 GitHub 配置冒充 KAOPU 的全部制度。

## 与 KAOPU 当前制度比较

### No-novelty

- R2 已要求 Producer 与 Verifier 分权，并把 Machine、Reference Fidelity、用户验收分层。
- N34 已证明截图不能替代完整状态往返 oracle，也已经要求像素证据绑定固定环境、容差与状态 tuple。
- 因此“截图不是 oracle”“跨环境渲染会漂移”“状态断言与像素证据互补”均不算 N38 新发现。

### 真正新增的缺口

- N34 没有定义 visual golden 的创建/更新批准链，也没有阻止同一 Producer 用 snapshot update 把当前缺陷写进 oracle 后自批。
- 现有回执没有强制保存旧/新 baseline 身份、old-vs-new diff、更新理由和批准回执。
- “截图被保存”“比较被执行”“baseline 被更新”“baseline 被独立批准”尚未使用互斥状态分账。

## 一个可反驳假设

若下一次 Fish 固定视图视觉回归同时冻结：

1. 当前候选与图片 digest；
2. baseline subject/image digest；
3. browser/renderer/viewport 等环境；
4. metric、threshold、mask 与 style；
5. baseline 更新前后 digest、old-vs-new diff 与理由；
6. 与当前 Producer 不同的 verifier approval receipt；

则门禁会保留 R007 第一 run 的截图证据、拒绝其视觉通过主张，保留修正版的状态往返成功，并拒绝“Producer 更新 golden 后用零差异批准自己”的反证控制。

## 最小试验 / 历史回放

`visual_golden_gate_n38.mjs` 对固定 R007 历史与四个合成反证控制执行 12 项断言：

- 固定第一 run subject/run/job，并保留 `VISUAL_EVIDENCE_CAPTURED`；
- 真实半透明 Observation 得到 `REJECTED_BY_VISUAL_OBSERVATION`；
- 确认第一 run 没有执行 golden comparison；
- 固定修复 subject/run，保留 `STATE_ROUNDTRIP_VERIFIED`；
- 修复 run 因没有 approved golden 仍为 `HOLD_NO_APPROVED_VISUAL_BASELINE`；
- 独立批准、环境一致、diff 在冻结阈值内的控制通过 `VISUAL_REGRESSION_VERIFIED`；
- 同一 Producer 更新并批准 baseline 的控制得到 `HOLD_BASELINE_UPDATE_SELF_APPROVED`；
- 环境不兼容的控制得到 `HOLD_VISUAL_ENVIRONMENT_MISMATCH`；
- diff 超阈值的控制得到 `VISUAL_REGRESSION_DETECTED`。

结果：12/12 通过。

## 适用边界

- 只适用于稳定、固定视图且视觉比较适合作为 oracle 的任务；不强迫随机动画、动态时间场或所有 Mother 使用逐像素门禁。
- mask、style、metric 与 threshold 必须按任务冻结；N38 不提出全局像素阈值。
- 不证明跨 GPU/OS 的逐位图像一致，不替代参考复刻语义验收、物理设备测试、人工视觉批准或用户验收。
- 首个 baseline 的批准标准与实际独立 verifier 试验仍为 Unknown。

## 是否采用

- **Candidate partial：**仅路由 Fish #91，在下一次适合固定视图 visual regression 的任务中局部试验。
- 未激活全局 regression、未修改 R2。需要一次真实 Mother `IMPLEMENTED`、独立 verifier `GATE-RUN` 后才能考虑 `ADOPTED`。
- 候选状态：`VISUAL_EVIDENCE_CAPTURED`、`HOLD_NO_APPROVED_VISUAL_BASELINE`、`HOLD_BASELINE_UPDATE_SELF_APPROVED`、`HOLD_VISUAL_ENVIRONMENT_MISMATCH`、`VISUAL_REGRESSION_DETECTED`、`VISUAL_REGRESSION_VERIFIED`、`REJECTED_BY_VISUAL_OBSERVATION`。
- 第一梯队专家 AI 未调用。
