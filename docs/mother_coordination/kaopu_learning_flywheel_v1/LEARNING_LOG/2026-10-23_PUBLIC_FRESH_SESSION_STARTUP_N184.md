# N184 — 一次成功的公网浏览器验收不能证明稍后新会话仍可启动

- 日期：2026-10-23
- Mother：Human / NPC life observation
- 类型：制度验证 / public delivery / startup reliability
- Bounded question：固定公网 URL 曾在 CI 中完整通过，能否据此继续声称用户稍后从新浏览器会话打开时仍可直接进入工作台？
- 结论：不能。当前 R04 固定 URL 的新会话状态为 `REJECT_CURRENT_PUBLIC_STARTUP`。

## 1. 现有真实失败

固定页面：
`https://haihao0307.github.io/guilin-dem-pipeline/npc-life-observation/r04-20261021/b386dd9780ddc5b01676fe46117d56d973725ac7/`

生产 workflow `39753300159` 曾于 2026-10-22 completed/success，证明当时那一次 file/public/browser 路径成功。2026-10-23 的独立公网浏览器复查得到：

1. 首次打开：页面 HTTP/壳层可见，但人物数据停在 `9/55`，60,001 ms 后 `BOOT_STAGE_TIMEOUT`；全部主要交互禁用。
2. 点击页面自己的“重新加载”：文档阶段 913 ms、初始化 9 ms，随后“载入原生 R07 人物，等待完整皮肤与 GPU 首帧”再次在 60,000 ms 报 `BOOT_STAGE_TIMEOUT`；交互仍禁用。

这复现了用户“网页无法打开”的纠错。它只证明当前这一个浏览器环境连续两次启动失败；不能据此声称全球 outage、确定失败概率，或把根因归给网络、GPU、缓存、55 个资源中的某一项。

源码与证据边界：

- `BootLifecycle.mjs` 的 stage timeout 为 60,000 ms，total timeout 为 180,000 ms；
- `BootMonitor.mjs` 的重试只是 `location.reload()`；
- Task Anchor 要求 public HTTPS + browser interaction，但当前 workflow receipt 只覆盖发布时那次通过；
- `PUBLIC_WEB_DELIVERY_GATE.md` v1.2.0 要求交付前一次新 HTTP/真实浏览器检查，没有定义交付后的独立 fresh-session 重开样本或失效语义。

## 2. 外部方法与老师 audition

Teacher Candidate：Microsoft Playwright，状态 `TEACHER_CANDIDATE`，生命周期到 `AUDITION`；未进入 Registry / referenceSet。

- provenance：Microsoft 官方 `microsoft/playwright` 仓库与官方文档；
- maintenance：2026-09-04 仍发布 v1.63.0；仓库 main 的 `package.json` 当前为 `1.65.0-next`；
- runnable evidence：开源测试 runner、BrowserContext 与 fixtures；官方说明每个测试默认获得独立、clean-slate、近似 incognito 的 context；
- license：Apache-2.0；
- dependency/cost：Node >=20；R04 workflow 已使用 Node 22 与 Playwright 1.58.2，新增成本主要是多次重载 66 MB 页面与 GPU 启动时间；
- integration risk：不能把 Next 文档的新 API 直接复制到锁定的 1.58.2；只采用早已存在的 `browser.newContext()` 隔离语义；
- non-demo：有可运行代码与测试框架，不依赖闭源训练数据或商业服务；
- direct relevance：当前验收复用单次 CI 成功，缺少独立新会话重开证据。

它到底在哪一个明确问题上，比 KAOPU Current Best View 多知道了什么？

> 它提供了“每次试验从独立、非持久 BrowserContext 开始”的可执行隔离语义；当前 KAOPU 公网门禁只有“交付时真实浏览器通过”，没有把后续重开与同页 reload 区分为独立样本。

官方来源：

- https://playwright.dev/docs/browser-contexts
- https://playwright.dev/docs/test-retries
- https://github.com/microsoft/playwright
- https://github.com/microsoft/playwright/releases

Google SRE 的 black-box monitoring 只作为制度对照：从用户可见症状测当前服务，而不是只看内部指标；它不直接作为本轮软件老师。来源：https://sre.google/sre-book/monitoring-distributed-systems/

## 3. 与 KAOPU 当前制度比较

现有门禁正确阻止 404、错误正文、资源缺失和“未做真实浏览器检查就分享”。本轮不推翻它；新增缺口是：

- 发布时 success 是一个有时间戳的 Observation，不是 URL 的永久属性；
- 同一 context 的 reload 可能继承 HTTP cache、GPU 进程与内存，不能冒充独立用户会话；
- HTTP 200 与壳层出现不能替代最终人物首帧和一次实际交互；
- fresh-session 任一受支持环境启动失败时，当前交付不能继续声称“点击即可进入”，即使历史 run 是绿的。

## 4. 可反驳假设与最小回放

假设：只要 exact URL 在发布 workflow 中成功过一次，以后同一 URL 都可视为 `browserPassed/shareAllowed`。

8/8 分类回放反驳该假设：

- 只有历史单次成功：`HOLD_FRESH_SESSION_SAMPLE_INCOMPLETE`；
- 只在同一 context reload：`HOLD_CONTEXT_ISOLATION_MISSING`；
- HTTP 200 但 fresh context 启动超时：`REJECT_CURRENT_PUBLIC_STARTUP`；
- 首开失败、同 context 暖重试成功：仍 `REJECT_FIRST_OPEN_UNRELIABLE`；
- URL/source head 不匹配：`REJECT_PUBLIC_ENDPOINT_IDENTITY`；
- fresh contexts 全通过但没有 stage receipt：`HOLD_BOOT_STAGE_RECEIPT_MISSING`；
- 启动通过但未到可交互：`REJECT_PUBLIC_INTERACTION_NOT_REACHED`；
- 达到任务声明的独立 context 样本、零失败、stage receipt 完整且完成一次交互：`FRESH_SESSION_STARTUP_PROBE_PASSED`。

正例只说明该 probe 样本通过，不等于全球 availability、物理手机、productionReady 或 USER-ACCEPTED。

## 5. Candidate 增量

仅对 Human / NPC successor candidate 试用：

- Task Anchor 增加 `freshSessionStartupPlan`：支持浏览器/视口、独立 context 数、超时、成功条件；样本数由 Mother 在试验前声明，本轮不武断制定全局数字。
- 每个 attempt 保存 exact URL、source head、context id（不可复用）、cache/storage policy、stage timeline、first native frame、interaction receipt、失败 code。
- 同页 reload 单列为 retry observation，不计作独立 fresh-session 样本。
- 任一 fresh-session 失败后，旧 `PUBLICATION_PROOF` 仍作为历史 Observation 保留，但当前 `shareAllowed` 对该环境撤回，直到新 candidate 修复并重新 probe。
- 最小试验：至少一个新 context cold start + 一个同页 retry 负对照；当前事件已经提供失败正样本，但没有生产修复或正向重验。

## 6. 适用边界与状态

- 不修改 R2 OS、全局 Public Web Gate、main 或 R04 生产分支。
- 不把本轮浏览器环境冒充物理手机或所有用户网络。
- 不把增加 timeout、要求用户重试或预热 cache 自动视为修复。
- POSTED：待定向路由至 PR #329。
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：均为 false / unknown。
- KPI：classifier 8/8；当前复查 fresh context 1 次失败、同 context retry 1 次失败；可靠成功率与其余 KPI unknown。

