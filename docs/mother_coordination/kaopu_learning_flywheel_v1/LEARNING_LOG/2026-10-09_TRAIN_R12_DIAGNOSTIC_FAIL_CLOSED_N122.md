# N122 — Train R12 诊断完成不得冒充鼠标语义通过

Date: 2026-10-09 09:39 +08:00  
Status: **new counterexample / no-novelty / existing diagnostic fail-closed regression updated**  
Scope: Train R11 公网鼠标诊断；不修改 Train 生产分支、`main`、`gh-pages`、R2 或门槛

## Bounded question

这些绿色 R12 诊断 run 能否合法证明最新 R11 鼠标交互诊断通过，还是必须保持 scoped HOLD？

## 现有真实失败

基线读取：`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；根 `AGENTS.md`、R2、reference gate、freshness gate 均未变化。#91 最新真实反馈仍为 N75 的查询范围纠正（comment `5979603278`）；#63 最新真实反馈仍为 N49（comment `5910449798`）。

R12 诊断提交 `9ee080929f7311562811b422a218b9e3f7567fb7` 的 event-complete Actions 查询返回三个 run。两个 pull-request run 不能代表 push 诊断，其中 layout workflow 的关键步骤全部 skipped；本轮只把实际执行诊断的 push [run 37870709681](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37870709681) 作为证据：

- `mouse (chromium)` job `113627902996` success；artifact `11590631129` / `sha256:d52ec986c6980d076b354162e1634322afcf1921ec5e5a8695afceadb15a6229`。
- `mouse (webkit)` job `113627903151` success；artifact `11590910093` / `sha256:704ffda332e25c8260632d6e3871c85a19ddf98d630574711234992b60555796`。
- 两份 artifact 都完整记录 5 个按钮 × 6 个命中点，共 30 case，且页面错误数组为空。
- Chromium 的 30/30 语义结果符合期待。
- WebKit 只有 29/30：`stationAction` 的 `label` 点在按钮可用、剩余 `0.2`、`phase=running` 时收到 `pointerdown → mousedown → pointerup → mouseup`，`target.closest=stationAction`，但没有 `click`，最终仍为 `phase=running`，没有进入期待的 `doors-opening`。

workflow 运行的 `r12-mouse-diagnostic.cjs` 会在 mouse down 与 up 之间调用五次 `updateHUD()`，然后记录事件与状态；它仅断言诊断脚本自身的 `errors=[]`，没有断言每个 case 的期待语义或必须产生 `click`。因此绿色只证明 `DIAGNOSTIC_CAPTURE_COMPLETE=true`，不能推出 `MOUSE_SEMANTICS_PASS=true`。

公开 R11 的 `app.mjs` 会在 `updateHUD()` 中更新 `stationAction.textContent` 和 `disabled`，但没有替换按钮节点；监听器仍绑定在按钮的 `click`。本轮只能确认“按下/抬起之间刷新 HUD 五次”是可复现条件；浏览器内部为何抑制该次 `click` 仍为 `unknown`，不把条件误写成根因。

## 外部方法 / 证据

- GitHub 官方说明：[Setting exit codes for actions](https://docs.github.com/en/actions/how-tos/create-and-publish-actions/set-exit-codes)：进程以 `0` 退出会把 check run 标为 success；因此绿色结论受脚本实际退出条件约束。
- Playwright 官方说明：[Assertions](https://playwright.dev/docs/test-assertions)：测试期待必须编码为 assertion；可继续收集的 soft assertion 仍应使测试整体失败，并可从聚合错误中检查失败。

这些来源支持“采集进程成功”和“领域语义通过”必须分层；KAOPU 的具体状态名与 fail-closed 规则仍由现有 R2 / regression case 决定。

## 与 KAOPU 当前制度比较

既有 `DIAGNOSTIC-CONTINUATION-FAIL-CLOSED-001` 已明确：诊断失败可在安全时继续收集，但只要任一 required recorded check 为 false，cell 与 aggregate 均不得通过。R12 是该机制首次在 Train Mother 上出现的真实公网反例，不形成新制度语义：

- 诊断脚本完成、两个 job 绿色：`DIAGNOSTIC_CAPTURE_COMPLETE`。
- WebKit 必需语义记录有一项 false：`HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED`。
- 结论：`NO_NOVELTY_EXISTING_DIAGNOSTIC_FAIL_CLOSED_CASE_APPLIES`；更新既有 case 的跨 Mother 试验证据，不创建重复 regression case，也不据此全局激活。

## 可反驳假设

若把“诊断采集完整”与“被诊断语义通过”拆为两个正交状态，则：

1. 预期 30 case 均存在，且 30/30 语义通过时，才可得到 `MOUSE_SEMANTICS_VERIFIED_SCOPED`；
2. 任一 required recorded semantic check 为 false，即使 workflow/job success，也必须得到 `HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED`；
3. 任一预期 case 缺失，应得到 `HOLD_DIAGNOSTIC_RECORD_INCOMPLETE`；
4. 只有 process success、没有逐 case 语义 ledger，不能晋升交互状态；
5. 该判定只作用于本次公开 R11、两个指定浏览器和诊断覆盖的命中点，不推翻其他已通过的 R11 空间、玩法、乘务、音乐单元。

## 最小历史回放

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/train_r12_diagnostic_fail_closed_n122.mjs`

结果 `11/11`：真实历史保持 `HOLD_REQUIRED_RECORDED_DIAGNOSTIC_FAILED`；负控拒绝缺失 case 与“process green 直接晋升”；合成 30/30 正控才得到 scoped pass。结果保存于 `PROBES/train_r12_diagnostic_fail_closed_result_n122.json`。

## 适用边界 / 是否采用

- 决定：`HOLD_WEBKIT_STATION_ACTION_LABEL_CLICK_AFTER_HUD_REFRESH`。
- Causal state：`DIAGNOSTIC_CAPTURE_SUCCEEDED_ONE_REQUIRED_WEBKIT_SEMANTIC_CHECK_FALSE`。
- 仅证明：公开 R11 URL、Chromium/WebKit、2048×1026、5 个按钮 × 6 个命中点、mouse down/up 间五次 HUD refresh 的诊断范围。
- 不证明：其他浏览器、真实物理设备、触摸、用户接受；也不否定 R11 已通过的 deterministic、spatial、gameplay、crew 与 music 单元。
- 局部建议：Train verifier 将逐 case `semanticPass` 聚合为独立终态；diagnostic workflow 可继续采集，但不能把 exit 0 当作 UI acceptance。当前仅为 Candidate 回放，没有修改 Train workflow 或生产资产。
- 生命周期：`POSTED=false`、`ACKNOWLEDGED=false`、`IMPLEMENTED=true`（Train 已实现 R12 diagnostic）、`GATE-RUN=true`、`ADOPTED=false`、`USER-ACCEPTED=false`。
- KPI：首次候选通过率、用户纠错次数、同类错误复发率、rejected lineage、stale delivery、accepted delta 内部迭代、合法 candidate 时间均 `unknown`；不从一次诊断造 KPI。
- 第一梯队外部 AI：未调用。
