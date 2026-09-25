# N37 — 390×844 视口通过不等于真实移动设备通过

- 日期：2026-09-25
- 状态：Candidate partial
- 范围：Fish R006/R012 历史回放；不修改生产分支或全局 R2
- 验证：12/12 fixtures 通过

## 一个 bounded question

在 `ubuntu-latest` 上用 Chromium 以 `390×844` 视口完成交互检查后，能否据此把同一对象标记为真实 iPhone/Safari 已验证？

## 现有真实历史

1. Fish R012 的实际测试对象是 `b5f2d11cbf55e17518dda411bf034596818c46d5`，run `35974311593`、job `107551050350` 成功，artifact 为 `94,452,856 bytes`，SHA-256 为 `d4ea8e9092cade31693a6de4f654a7d7a47efe278de2a1a6b286f4585aaac7d3`。
2. 对应 workflow 运行在 `ubuntu-latest`，只安装 Playwright Chromium；同一 QA 分别检查桌面与 `390×844` 视口。其 Delivery Receipt 明确保留 `userDeviceRetested=false`、`manualVisualAcceptance=false`、`productionReady=false`。
3. 因此 R012 的 `RESPONSIVE_VIEWPORT_VERIFIED` 与 `HOSTED_CHROMIUM_RUNTIME_VERIFIED` 均为有效 scoped claim；本轮不将它倒推为失败。
4. Fish R006 的测试对象 `a987895498c51e46ef786f4cab0a69ef8679526e`、run `35843264304` 也完成了托管浏览器及公网检查，但真实用户随后报告白屏。托管运行证据仍有效；更强的用户设备可运行主张被真实 Observation 否定。
5. R006 原始客户端失败的唯一根因并未确认。本轮不猜测是内存、GPU、网络、载荷或 Safari 差异。

## 外部方法与证据

[Playwright Emulation](https://playwright.dev/docs/emulation)把设备仿真描述为对 `userAgent`、`screenSize`、`viewport`、`hasTouch` 等参数的模拟；这些参数没有把托管 VM 变成物理设备。

[Playwright Browsers](https://playwright.dev/docs/browsers)明确指出 Playwright WebKit 来源于 WebKit main，可能领先于 Safari，不能直接使用 branded Safari；平台相关行为也可能不同。因而即使以后增加 Playwright WebKit，它也不能无条件代替真实 iOS Safari 主张。

[GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)把 `ubuntu-latest` 公共 runner 定义为 GitHub 托管的 x64 虚拟机。可迁移的最小原则是把 claim environment 与 evidence environment 显式绑定，而不是把视口尺寸当设备身份。

## 与 KAOPU 现有制度比较

- R2 已把 `browser390x844`、真实设备、production 和 user acceptance 分层；R012 receipt 也已经诚实保留 `userDeviceRetested=false`。这部分记为 no-novelty。
- N33 已证明最终加载成功不覆盖“载荷完成前是否有可见启动 shell”，解决的是时间区间与故障恢复，不是执行环境身份。
- 本轮新增缺口：尚缺机器可判的 environment-profile compatibility，阻止一个较弱环境的有效证据被文字升级为更强环境主张。
- freshness/no-stale 与 no-creative-substitute 门禁不变；本候选只约束证据能支持的环境范围。

## 可反驳假设

如果每个环境相关主张冻结 `claimEnvironmentProfileId`，每份证据保存机器可读 `evidenceEnvironment`，并只允许 evidence environment 满足 claim profile 时继承，则门禁能够：

1. 保留 R012 的响应式视口与托管 Chromium 成功；
2. 将 R012 的真实 iPhone/Safari 主张保持为 `UNKNOWN_NO_PHYSICAL_DEVICE_RUN`；
3. 保留 R006 的托管运行成功，同时用用户白屏 Observation 拒绝更强的设备可运行主张；
4. 让包含完整物理设备、OS、浏览器与 run 身份的反证控制通过。

## 最小历史回放

机器探针 `device_claim_gate_n37.mjs` 对固定 R006/R012 fixture 与两个合成对照执行 12 项断言：

- 固定 R012 tested subject、run、runner 与唯一安装浏览器；
- 视口主张得到 `RESPONSIVE_VIEWPORT_VERIFIED`；
- 托管 Chromium 主张得到 `HOSTED_CHROMIUM_RUNTIME_VERIFIED`；
- 视口证据尝试升级为物理设备时得到 `UNKNOWN_NO_PHYSICAL_DEVICE_RUN`；
- R006 用户白屏把更强主张判为 `REJECTED_BY_USER_OBSERVATION`，但不抹除托管运行成功；
- 完整物理设备环境合成对照得到 `PHYSICAL_DEVICE_OPERATIONAL_VERIFIED`。

结果：12/12 通过。

## Current Best View

1. `390×844` 是 viewport/layout 证据，不是 iPhone 身份。
2. `ubuntu-latest + Chromium` 可证明该托管环境中的 runtime；不能证明物理 iOS/Safari。
3. R012 现有 scoped claims 保持有效，真实设备与用户验收继续为 Unknown。
4. R006 的用户 Observation 有权拒绝更强设备主张；它不反向删除已成立的 hosted evidence，也不提供唯一根因。
5. 下一次 Fish 大型单体 HTML 或任何设备级主张可局部试验 environment-profile compatibility；未经过真实 Mother 试验与独立 verifier 前不修改全局 R2。

## Candidate 可执行对象

Task Anchor / Delivery Receipt 最小字段：

- `claimEnvironmentProfileId`
- `testedSubjectSha`、artifact identity、run/job identity
- `evidenceExecutionKind`：hostedRunner / localMachine / physicalDevice
- `runnerLabel`、`hostPlatform`
- `browserEngine`、`browserBrand`、`browserVersion`
- `viewport`、`hasTouch`、`deviceScaleFactor`（适用时）
- `physicalDevice`、`deviceClass`、`osName`、`osVersion`、`deviceRunId`（设备级主张时）
- `userObservation`、`userDeviceRetested`、`userAcceptance`
- `environmentCompatibilityDecision`

候选状态：

- `RESPONSIVE_VIEWPORT_VERIFIED`
- `HOSTED_CHROMIUM_RUNTIME_VERIFIED`
- `UNKNOWN_NO_PHYSICAL_DEVICE_RUN`
- `HOLD_ENVIRONMENT_IDENTITY_INCOMPLETE`
- `REJECTED_BY_USER_OBSERVATION`
- `PHYSICAL_DEVICE_OPERATIONAL_VERIFIED`

## 拒绝的替代方案

- rejected：`390×844` 等于“已在手机测试”。
- rejected：user-agent、touch 或 device descriptor 仿真等于物理设备执行。
- rejected：Playwright WebKit 等于 branded Safari 或真实 iOS Safari。
- rejected：根据 R006 白屏猜测内存、GPU、网络或某一唯一根因。
- rejected：真实用户失败后删除已经成立的托管浏览器证据。
- rejected：强迫所有浏览器任务都增加物理设备；要求应由 claim scope 触发。

## 适用边界与 Unknown

- 适用：网页、WebGL、响应式布局、移动浏览器及设备可运行主张。
- 不适用：不涉及执行环境的纯字节身份、数值回归或源码静态检查。
- Unknown：真实 iPhone/Safari 结果、R006 原始客户端唯一根因、人工视觉验收、用户验收、制度 KPI。
- 第一梯队专家 AI：未调用。
