# N192 — Road R03 采集了性能数据，不等于性能验收通过

## Bounded question

Road R03 的公网 QA 在 `passed=true` 时记录了每帧完成时间。这个绿色结果是否足以支持“性能通过”？

答案：不能。它能证明冻结公网字节在 Chromium SwiftShader 上完成功能与交互回放，但不能证明软件渲染性能达标，更不能证明物理手机或硬件 GPU 性能达标。

## 真实生产证据

- main：`23a5efbe517d6e629c2104c3411d428c9a65b3c6`
- workflow run：`40153232777`，conclusion `success`
- artifact：`12583322837`，digest `sha256:34d7a9dde805569490cb7f9b3bc45bc7109899084e256bc431196e147f8c334c`
- `verify-public.py` 对公网九个文件逐字节比较后才运行交互 QA，source/public binding 成立；
- public report：`passed=true`、`errors=[]`、32 个桌面/移动视口检查；
- 环境明确为 `Chromium SwiftShader, not physical phone/hardware GPU`，`physicalDeviceTested=false`；
- 8 组 performance 样本的 median 为约 `1071.9–3686.4 ms`；
- `browser-qa.mjs` 只用 `glError / colors / overflow / errors` 决定失败；performance 只有记录，没有 budget、阈值或 claim scope。

因此本轮不否定公网功能回放；只拒绝把绿色 workflow 自动提升成性能验收。

## 与现有制度比较

R2 Gate 2 已把 performance 列为当前任务硬门。N26 `CI-GREEN-SKIPPED-CLAIM-001` 已规定：workflow conclusion 只是运输/执行元数据，必须按 named claim 检查 required steps 和 predicates。

所以本轮沿用 N26，不重复建立 regression。新增的是 Road R03 的真实生产实例和可执行 claim 分层：

- `RUNTIME_FUNCTIONAL = CLAIM_VERIFIED`
- `SOFTWARE_RENDERER_PERFORMANCE = HOLD_PERFORMANCE_BUDGET_MISSING`
- `PHYSICAL_DEVICE_PERFORMANCE = HOLD_PHYSICAL_DEVICE_NOT_TESTED`
- overall：`HOLD_PERFORMANCE_ACCEPTANCE_UNSCOPED`

## 外部方法筛选

Google SRE 将 SLI 定义为测量指标、SLO 定义为该指标的目标；Google web.dev 的 performance-budget 方法要求把预算接入 build，在超出目标时使 CI 失败。

相对 KAOPU Current Best View：核心原理已经被 R2 + N26 覆盖，状态为 `NO_NOVELTY`，不进入 Teacher Registry。值得保留的只是实现映射：`metric + method + environment + budget + claimType` 必须同时存在。

W3C Long Animation Frames 的 50 ms 是另一种用户侧指标，不能直接套到当前“draw + 同步全帧 readPixels、SwiftShader”样本；两者 method 不同，直接套阈值为 `REJECTED`。

## Candidate receipt 字段

仅建议 Road Mother 单点试用：

- `claimType`
- `measurementEnvironment`（software renderer / hardware GPU / physical mobile）
- `metricMethod`
- `sampleSet`
- `performanceBudget`
- `budgetSource`
- `budgetVerdict`

无预算时只允许保留 observation，不得输出 `PERFORMANCE_ACCEPTED`。软件渲染预算不能向上外推物理设备。

## 状态

- 本轮为历史回放与 claim-scope probe；
- 未修改 Road Mother、main、R2、公网页或工作流；
- 待定向发布后为 `POSTED`，尚无 ACK / IMPLEMENTED / production GATE-RUN / ADOPTED / USER-ACCEPTED；
- KPI：unknown。
