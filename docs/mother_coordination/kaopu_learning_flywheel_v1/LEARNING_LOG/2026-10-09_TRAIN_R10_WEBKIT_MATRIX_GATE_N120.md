# N120 — Train R10 的 Chromium 修复不能覆盖 WebKit 失败

Date: 2026-10-09 03:46 +08:00  
Status: **new subject evidence / no-novelty / existing N71 regression updated**  
Scope: Train R10 candidate QA only；不修改 Train 生产分支、`main`、`gh-pages`、R2 或门槛

## Bounded question

R10 的测试提交 `69d0b747` 是否已经关闭“连续切换相机时 HUD 真正可见”的跨浏览器验证，还是只修复了 Chromium 的一个截图等待问题？

## 现有真实失败

基线读取：`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；根 `AGENTS.md`、R2、reference gate、freshness gate 均未变化。#91 最新真实反馈仍为 N75 的查询范围纠正（comment `5979603278`）；#63 最新真实反馈仍为 N49（comment `5910449798`）。

Train R10 新生产证据：

- [run 37825833649](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37825833649) / `3db526bd`：deterministic 成功；Chromium scene 在 `locator.screenshot` 超时；WebKit scene 在 `#pause` 真实点击完成阶段超时；run 随后被新 push 取消。
- `69d0b747` 只把 `locator('.station-totem').screenshot()` 改为 `page.screenshot({clip})`；`3db526bd..69d0b747` 没有生产源码变化。
- [run 37826431136](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37826431136) / `69d0b747`：deterministic 与 Chromium scene 成功；WebKit scene 在第二轮 `[data-camera="platform"]` 点击完成阶段超时，整体 run 为 failure。
- WebKit artifact `11572126144` / `sha256:ea7f69a9...c0a75` 内含 9 个 `live-*-header.png`，缺第二轮 platform 的第 10 个；`failure.json` 的 `errors=[] / bad=[]`，并记录元素已经 visible、enabled、stable，随后卡在 `performing click action`。因此可以确认 9 次顺序中的 HUD 像素断言已通过，但不能把第 10 次、WebKit 输入闭环或整个跨引擎 claim 写成通过。
- `gh-pages@375dadb2` 仍是 R09；R10 未公开发布，不能用 R09 公网成功替 R10 背书。

## 外部方法 / 证据

Playwright 官方 [Auto-waiting / actionability](https://playwright.dev/docs/actionability) 明确：`locator.click()` 会先检查唯一、可见、稳定、可接收事件、启用，并在组合动作未在 timeout 内完成时抛出 `TimeoutError`。官方 [Page screenshot](https://playwright.dev/docs/api/class-page#page-screenshot) 同时说明 page screenshot 默认允许动画。故这里应把“截图等待修复”和“真实输入动作完成”分开记录；不能因元素已通过 actionability 检查就把点击后状态或像素 claim 自动写成 PASS。

## 与 KAOPU 当前制度比较

- R2 已规定机器门禁失败必须内部 HOLD，Producer 不能自批。
- N26 已规定 named claim 的关键步骤/cell 失败则 stronger claim HOLD。
- N71 已规定 matrix 每个 cell 的失败谱系必须保留，局部成功不能覆盖另一个 cell。

因此本轮是 `NO_NOVELTY_EXISTING_N71_MATRIX_FAILURE_LINEAGE_APPLIES`，不创建新 case；只给既有 `SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001` 增补 Train 实例。

## 可反驳假设

若 exact-subject ledger 保留两次 run 的 Chromium/WebKit cell、失败签名及 `3db..69d` QA-only delta，则：

1. 终态应为 `HOLD_REQUIRED_MATRIX_CELL_FAILED`；
2. 漏掉 WebKit 应被判为 `HOLD_MATRIX_JOB_LEDGER_INCOMPLETE`；
3. 只有同一精确 subject 下 Chromium 与 WebKit required cells 均 success，才允许 `CLAIM_VERIFIED_SCOPED`；
4. 不能从本证据推断 R10 视觉本身失败，也不能推断 WebKit 用户输入已通过。

## 最小历史回放

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/train_r10_webkit_matrix_gate_n120.mjs`

结果 `8/8`：真实历史保持 HOLD；漏 WebKit 的 ledger 被拒绝；全双引擎成功的合成控制才通过。结果保存于 `PROBES/train_r10_webkit_matrix_gate_result_n120.json`。

## 适用边界 / 是否采用

- 决定：`HOLD_REQUIRED_MATRIX_CELL_FAILED`。
- Causal state：`QA_FIX_CLOSED_CHROMIUM_SCREENSHOT_ONLY_WEBKIT_INPUT_COMPLETION_UNKNOWN`。
- 下一次合法解除：在新的 exact SHA 上保留真实 `locator.click`/等价物理输入语义，分别证明 WebKit 点击后 preset 状态与 HUD 像素，并让 Chromium/WebKit required cells 同 run 通过。DOM `element.click()` 只能做诊断负控，不能替代真实用户输入门禁。
- 当前公开可用基线仍是 R09；不撤下、不冒充 R10。
- 不路由新制度：受影响 Train Mother 已通过自己的失败 run 获得该事实；重复发长文没有新增执行价值。
- 生命周期：`GATE-RUN=true`；`POSTED/ACKNOWLEDGED/IMPLEMENTED/ADOPTED/USER-ACCEPTED=false`。
- KPI：首次候选通过率、用户纠错次数、同类复发率、rejected lineage、stale delivery、accepted delta 内部迭代、合法 candidate 时间均 `unknown`。
- 第一梯队外部 AI：未调用。
