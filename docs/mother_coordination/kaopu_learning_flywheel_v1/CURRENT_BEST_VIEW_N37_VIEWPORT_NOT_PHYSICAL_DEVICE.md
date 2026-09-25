# Current Best View N37 — Viewport Is Not a Physical Device

状态：Candidate partial；Fish R006/R012 历史回放 12/12；未实施、未采纳。

1. `390×844` Chromium 检查是有效的响应式 viewport/layout 证据，不是 iPhone 身份或物理设备执行证据。
2. Fish R012 的 `ubuntu-latest + Chromium` 运行继续支持 `RESPONSIVE_VIEWPORT_VERIFIED` 与 `HOSTED_CHROMIUM_RUNTIME_VERIFIED`；receipt 已诚实保留 `userDeviceRetested=false`。
3. R012 的真实 iOS/Safari 主张应为 `UNKNOWN_NO_PHYSICAL_DEVICE_RUN`，不是失败，也不能由 viewport、UA、touch 或 device descriptor 自动升级。
4. Fish R006 用户白屏拒绝更强的设备可运行主张，但不抹除已成立的托管 runtime 证据；唯一根因保持 Unknown。
5. 下一次 Fish 设备级主张的最小试验：Task Anchor 冻结 `claimEnvironmentProfileId`，Delivery Receipt 保存 `evidenceEnvironment`，门禁只允许环境满足关系成立时继承证据。

外部依据：[Playwright Emulation](https://playwright.dev/docs/emulation) · [Playwright Browsers](https://playwright.dev/docs/browsers) · [GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
