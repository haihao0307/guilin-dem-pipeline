# 共同人物总台 — MAIN-EYES-R01

2026-10-11：在原总台同一个人物上接入已验证 ET16 自然眼球。不是跳转到独立样品，不是 iframe，不是追加第二个头模。入口与来源以 `MAIN_RUNTIME.json` 为准。

主入口 `index.html` 保留原人物库、36个预设及原场景入口，新增顶部“自然眼球 / 五官”。可直接从此按钮载入原人物，或先选择人物再进入眼球控制。左右眼球、眼白、血丝、虹膜/瞳孔及过渡参数保存在同一人物档案中。“返回人物库”关闭眼球面板。

本次补齐主皮肤层原先缺失的可选 `faceSurface.attachSkin` 连接；继承 ET16 的实际眼球材质、眼周接触着色与原型不变的眼区显示细分。眼周接触着色不是新的眼睑解剖。没有纳入后续未验收的 ET17 实验。

## 源码与重建

实际入口源码：`full/ui/main-eye-app.generated.mjs`。构建器：`main-eye-integration/r01/build.cjs`。基础入口源 `full/ui/browser-app.mjs` 保留为合成输入；现主页面使用已验证的内联构建，不能仅编辑基础入口源就声称公网已更新。

精确重现本次构建：在独立工作副本中检出固定构建 `f662a52e30b568eeec09e8d3f5b2e692cccc5ab5`，使用其中未替换的原 `index.html` 模板，再执行构建器。或在临时副本中以 `main-eye-integration/r01/index-before-integration.html` 恢复模板后构建；不要将已经打包的主入口再次作为模板。固定环境 esbuild 0.25.12，原本地 Three.js 模块，原静态教师资源锚点；不得在运行中的共享工作副本覆盖模板。

本次原主入口 SHA256：ce1bd8780b329a9edb465c811fb9ca86b122ba0f37da34320337f33037ea6172。新主入口 SHA256：4e4c608b48da74eaec9feb88470515aa4384343540bb8a31f154b098f8bcd6e9。`BUILD.json` 保存源码、许可证及构建哈希。

## 证据与回退

`main-eye-integration/r01/DELIVERY.json` 与 `qa/public-eye`、`qa/public-main` 对应固定候选的实际浏览器检查；`ACTIVATION.json` 与 `qa/live` 单独记录原总台网址的实际验证，不用候选网页状态冒充主站状态。

原入口保留为同层 `index-before-main-eyes-20261011.html`，旧固定预览不覆盖。回退通过新提交恢复原入口，不强推、不改历史。本次仅做受限主入口发布，PR221 保持 Draft，不合并 PR。

保留 callharvey3d 的两套原始 Harvey PNG 和 CC-BY 署名。近似实时眼球光学不等于影视扫描、完整体积折射、全部眼睑闭合正确或临床仿真。原人物资源仍需首次网络载入；软件渲染测试不是消费级 GPU 性能证明，390×844 浏览器视口不是手机实机。没有对所有动作、任意体型、帽子动态戴入或头发压缩作完整认证。

---

## 原始公共网格实验说明（保留）

# KAOPU minimal common-mesh experiment R01

One fixed canonical mesh combines a bounded subset of Anny, GNM and MHR output. It is not a three-page switcher, and not a complete or lossless merger of all three models.

- Run browser UI from a static HTTP server alongside kaopu-anny-workbench
- Anny model dependency: ../kaopu-anny-workbench/assets/anny-model.json and its ordered .bin.part files (or the equivalent legacy .bin.gz)
- GNM: pinned official 34,937,952-byte web asset, SHA-256 checked on load
- MHR: this directory contains only a licensed synthetic torso displacement projection; full TorchScript is not a runtime dependency
- Data remains in browser. No user photograph or identifier is uploaded

Read LEARNING.md and API.md before reusing this adapter. Numeric reports are in research/. Browser screenshots and actual browser QA status are separate evidence, not implied by Node tests.

Reproduction scripts in tools/ expect the explicitly pinned official teacher assets in neighboring development directories. tools/serve.py is a local development route mapper, not production server code. No original teacher directory is modified by these tools.
