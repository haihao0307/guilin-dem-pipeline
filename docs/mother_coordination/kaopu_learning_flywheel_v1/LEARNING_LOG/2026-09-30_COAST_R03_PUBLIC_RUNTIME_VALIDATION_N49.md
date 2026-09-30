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


---

## 2026-09-30T13:40Z 同一 URL 的新 subject 复验

### 新事实

N49 初次验证后，main 仍停在 `38513d5410e374a0262bdcd80897dba9a9921c88`，但 `gh-pages` 已继续推进。固定 R03 URL 的内容发生了真实非 metadata 变化：

- 初次 subject：`gh-pages@d1813855…`，`index.html` blob `1c063f0da69d3c3d856365aa83611150ef510b09`，58,367 bytes。
- `562b8810864aa999508e67f87fe73906028a54c6` 以 “Publish KaoPu Coast World R03 public browser build” 覆盖相同路径。
- `5975dc832c78512d1028715822252b99a202809a` 再修改 shader precision。
- 复验时 `gh-pages` head 为 `6ee57dd038f68a6dc2e60f640ffb3e03a63cdfd6`，该 URL 当前 `index.html` blob 为 `6fcba3fa9a8be6412a102ab96ef00cb0b3d7223d`，12,718 bytes。
- 当前目录只有 `.nojekyll` 与 `index.html`，没有新的 `PUBLICATION_PROOF.json`。

因此 N49 初次 browser evidence 只属于旧 blob，不得继承给当前固定 URL。

### 对新 subject 的 cache-busted 最小验证

独立 hosted Chrome 以新查询参数重新导航后：

- 页面显示 `图形初始化失败`；
- `#fail.show = true`；
- `canvas#getContext('webgl') = null`；
- canvas intrinsic size 仍为 `300 × 150`；
- 页面源码已不包含 `__KAOPU_READY__`，运行时值仍为 `null`；
- 5 个视角按钮和 4 个 Field Atlas 模式按钮存在，但失败遮罩下没有合法 3D 关键交互可计为通过；
- 当前 subject 没有进入可交互运行态。

当前判定仍为 `HOLD_PUBLIC_BROWSER_RUNTIME_FAILED`、`browserPassed=false`、`shareAllowed=false`。这是新 artifact 的新验证结果，不是旧失败的重复刷新。

### 与现有制度比较

仍为 `no-novelty`，不创建新 regression case：

- N30 / `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` 已规定：runtime/public artifact 的非 metadata 变化必须重新测试，旧 tested subject 不能把 “tested” 传给移动 head。
- N32 / `SHARED-PUBLICATION-TARGET-CAS-001` 已规定：覆盖共享固定入口需要 target identity 前置条件和新 subject 回执；缺失时保持 HOLD。
- `PUBLIC_WEB_DELIVERY_GATE` 已要求每个实际发布 subject 在最终公网 URL 完成浏览器启动与关键交互。

应用现有状态语义：

- `HOLD_UNTESTED_NONMETADATA_DELTA`
- `HOLD_RECEIPT_BINDING_INCOMPLETE`
- `HOLD_MUTATION_PRECONDITION_MISSING`
- `HOLD_PUBLIC_BROWSER_RUNTIME_FAILED`

### 可反驳假设与解除条件

如果当前 blob `6fcba3f…` 获得精确 source/build lineage、发布回执，并在最终公网 URL 进入真实 WebGL 运行态、无致命错误且完成一个视角/Field Atlas 交互，则上述 HOLD 应针对该 subject 解除。任何后续固定 URL 覆盖都必须产生新的 subject identity 与浏览器回执，不能沿用本次结果。

### 边界与 Unknown

- 不把旧 blob 的 WebGL2 错误写成当前 blob 的同一根因；当前只确认 observed browser 无 WebGL context。
- 其他浏览器、用户物理设备、iOS Safari 修复有效性、视觉质量、参考保真和用户验收仍为 `unknown`。
- main 未变化；本轮没有修改 `gh-pages`、生产 Mother、R2 OS、Canonical Truth 或既有 regression cases。
- 生命周期仍为 `POSTED=true / GATE-RUN=true`；`ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`。
