# N49 — Coast World R03 公网运行验证（no-novelty）

日期：2026-09-30  
状态：`VALIDATION_RESULT / EXISTING_GATE_FAILURE / NO_NEW_CANDIDATE`

## 单一 bounded question

Coast World R03 的最终公网 URL，是否在独立浏览器真实进入可交互运行态？

## 现有真实失败

- 当前 main 精确头：`38513d5410e374a0262bdcd80897dba9a9921c88`。
- 发布工作流：`.github/workflows/publish-kaopu-coast-world-r03.yml`。
- 历史发布输出：`gh-pages@d18138553098e40e1ddcd105376edea9d7c1a23c`。
- 最终公网入口：`https://haihao0307.github.io/guilin-dem-pipeline/kaopu-coast-world/r03-20260930/`。
- 2026-09-30T11:38Z 在独立 hosted Chrome 中首次打开与一次刷新后均停在：
  - `8%`
  - `正在准备 / Preparing`
  - 可见错误：`此设备未提供 WebGL2`
  - 控制台致命错误：`Error: WebGL2 unavailable`
  - `window.__KAOPU_READY__ = null`
- 页面标题、R03 版本标识、Field Atlas 控件和 canvas shell 可见，但 3D runtime 未 READY，且准备按钮保持 disabled；因此没有合法关键交互可执行。

## 外部方法 / 一手证据

1. GitHub Pages 官方 custom workflow 文档把 `deploy-pages` 的 `page_url` 暴露为部署输出；部署完成与应用在最终浏览器中启动成功是不同的验证对象：  
   https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
2. Khronos WebGL 2.0 规范规定，context 创建失败时触发 context creation error 并返回 `null`；因此“HTML shell 已显示”不能替代“WebGL 运行时已建立”：  
   https://registry.khronos.org/webgl/specs/latest/2.0/

## 与 KAOPU 当前制度比较

这是 `no-novelty`，不创建新 Candidate 或 regression case：

- `knowledge/PUBLIC_WEB_DELIVERY_GATE.md` 已要求最终公网 URL 的真实浏览器启动、无致命错误和至少一个关键交互；失败时 `shareAllowed=false`。
- N47 已验证同一失败机制：本地或受控 Chromium 通过，不等于最终公网入口在独立浏览器可运行。
- `VIEWPORT-NOT-PHYSICAL-DEVICE-001` 已禁止把 hosted browser 证据升级为用户物理设备结论。
- 因此本轮只保存 Coast R03 的新 subject 级验证结果，不制造同义制度。

## 可反驳假设

若将发布声明绑定到最终公网 URL，并在独立浏览器要求 `__KAOPU_READY__ === true`、WebGL2 context 成立、无致命错误且完成一次 Field Atlas 或镜头交互，则本次 R03 应被 HOLD；如果同一精确发布 subject 以后在该门禁下通过，HOLD 应解除。

## 最小真实验证

### 已验证

- 两次独立页面启动尝试得到同一结果。
- HTML shell、标题 `KaoPu Coast World R03` 和可见 `WORLD SCORE R03` 标识存在。
- canvas shell 存在，CSS 视口约 `1363 × 936`，但 intrinsic canvas 仍为默认 `300 × 150`。
- 四个 Field Atlas 按钮存在；runtime 未 READY，不能据此计为可交互 3D 通过。
- 两次均出现 subject 自身的 `WebGL2 unavailable` 致命错误。

### 未验证 / Unknown

- 用户物理设备与用户浏览器：`unknown`。
- 其他浏览器或有 GPU/软件渲染能力的环境：`unknown`。
- 根因是 hosted browser GPU 能力、页面强制 WebGL2、启动参数，还是其组合：`unknown`。
- 全量发布树一致性与 HTTP 响应头：本轮未复验，`unknown`。
- 用户验收：`unknown`。

## 适用边界

- 本结论仅拒绝“R03 已在本次独立 hosted browser 中进入可交互公网运行态”的强声明。
- 不倒推源码构建失败，不抹除工作流在带 `--use-angle=swiftshader-webgl` 等参数的本地 Chromium 通过记录。
- 不声称所有真实设备都会失败，也不把本轮 hosted browser 当成用户物理设备验收。
- 不修改生产 Mother、main、gh-pages、R2 OS 或当前用户验收状态。

## 是否采用

- 新制度：`NO-NOVELTY / REJECT_DUPLICATE_CANDIDATE`。
- 现有门禁真实判定：`HOLD_PUBLIC_BROWSER_RUNTIME_FAILED`。
- 对该公网入口：`browserPassed=false`、`shareAllowed=false`。
- 解除条件：同一精确发布 subject 在最终公网 URL 完成 `READY + WebGL2 + zero fatal error + one critical interaction` 回执；物理设备状态继续单独记录。
- 完整机读证据：`PROBES/coast_r03_public_runtime_validation_n49.json`。

## 路由与生命周期

- 仅路由 Ocean / Coast 受影响入口（#63），不群发。
- `POSTED=true`，`GATE-RUN=true`。
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`。
- 本轮没有生产修复，因此不声称 Mother 已学会或已实现。

## KPI

首次候选通过率、用户纠错次数、同类错误复发率、rejected lineage 继承次数、stale delivery 次数、每个 accepted delta 的内部迭代数、从用户指令到合法 candidate 的时间：均为 `unknown`。

## Frozen

生产源、main、gh-pages、R2 OS、Canonical Truth、现有 regression cases 与用户验收状态均未由本轮修改。
