# N47 — Quick Shorts R4.2 公网运行验证（no-novelty）

日期：2026-09-30  
状态：`VALIDATION_RESULT / EXISTING_GATE_FAILURE / NO_NEW_CANDIDATE`

## 单一 bounded question

main 新增的 Quick Shorts R4.2 发布工作流，在发布前本地 Chromium 通过后，是否已经证明固定公网 URL 在独立浏览器中可用？

## 现有真实失败

- 当前 main 精确头：`0e97f818b4648a4625aae2a94449877f2d245ffa`。
- 工作流：`.github/workflows/publish-quick-shorts-r4.yml`。
- 源仓库精确观察头：`haihao0307/Humanoid-Rig-Lab-Next@961639b0200f4462ab4a0ef83069a73692b985c4`。
- 公网入口：`https://haihao0307.github.io/guilin-dem-pipeline/quick-shorts-r4/`。
- 2026-09-30T07:49Z 独立公网浏览器首次打开与一次刷新后均显示：

  `LOAD ERROR — 加载错误：Error creating WebGL context.`

- 页面 HTML、控制卡和尺寸文字可见，但 3D 画布未进入 `READY`；因此只能保留“公网静态页面可达”，不能声明“公网 3D 工作台可用”。

## 外部方法 / 一手证据

1. GitHub Pages 官方 custom workflow 文档把 `deploy-pages` 的 `page_url` 作为部署输出；部署动作证明发布流程完成，但不自动证明应用在所有目标浏览器成功启动：  
   https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
2. Khronos WebGL 规范明确：drawing buffer 创建失败时应触发 context creation error 并返回 `null`。所以“HTML 已加载”与“WebGL context 已建立”是两个独立事实：  
   https://registry.khronos.org/webgl/specs/latest/1.0/

## 与 KAOPU 当前制度比较

这是 `no-novelty`，不创建新 Candidate 或 regression case：

- `knowledge/PUBLIC_WEB_DELIVERY_GATE.md` 已要求发布后从最终公网 URL 回读，并以真实浏览器确认画布/主要界面、关键资源和致命错误；任一失败时 `shareAllowed=false`。
- N26 已规定 overall green/local step 不能替代 named public claim 的关键步骤。
- N28 已规定 final claim 必须在所有 claim-critical steps 之后封口。
- N30 已规定验证绑定精确 subject，而不是移动分支名。

现有规则足以判定，无需为了“创新”再建同义门禁。

## 可反驳假设

若在 push 完成及传播后，对最终公网 URL 执行与交付声明绑定的独立浏览器启动门，则本次应保留本地 Chromium 成功，同时把公网 3D 可用声明判为 HOLD；若公网画布能进入 `READY` 且无致命错误，则该 HOLD 应解除。

## 最小真实验证

### 已验证

- `gh-pages/quick-shorts-r4/index.html` 与当前源头同名文件的 Git blob 均为 `36ae787616bd91aa10d7eb10ab51790aca531aeb`。
- `gh-pages/quick-shorts-r4/main.js` 与源头 `961639b…` 的同名文件 Git blob 均为 `eb72bdc24576695ad6ed6de173a6171161a3aac9`。
- 公网 HTML 和控制面板可见。
- 独立公网浏览器两次均复现 WebGL context 创建失败。

### 未验证 / Unknown

- 全量发布树逐字节一致性：`unknown`（本轮只抽查 index 与 main.js）。
- 用户物理设备与用户浏览器：`unknown`。
- 失败是否源自当前浏览器 GPU/软件渲染能力、页面参数或两者交互：`unknown`。
- 公网页面在其他真实设备是否可运行：`unknown`。

## 适用边界

- 本结论只拒绝“该公网 3D 工作台已经在独立浏览器可用”的强声明。
- 不倒推源代码构建失败，不否定 workflow 的本地 Chromium 检查，也不声称所有设备都会失败。
- 不把当前独立浏览器当作用户物理设备验收。

## 是否采用

- 新制度：`NO-NOVELTY / REJECT_DUPLICATE_CANDIDATE`。
- 现有门禁真实判定：`HOLD_PUBLIC_BROWSER_RUNTIME_FAILED`。
- `shareAllowed=false`，直到同一发布 subject 在最终公网 URL 上完成真实浏览器 `READY` 回执。
- 建议受影响入口只在下一次修复中补齐现有门禁要求：发布后公网启动、关键资源、错误日志和 exact subject receipt；不修改全局 R2。

## 生命周期与 KPI

- 保存后：`GATE-RUN=true`。
- 路由后：`POSTED=true`。
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false`。
- 首次候选通过率、同错复发率、stale delivery、rejected lineage 继承、内部迭代数、从指令到合法 candidate 时间：均为 `unknown`。

## Frozen

生产源仓库、main、gh-pages、R2 OS、Canonical Truth 与现有用户验收状态均未由本轮修改。
