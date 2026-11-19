本目录为独立交付与精选证据。完整源码、冻结基线、夹具、构建和失败候选：[源目录](https://github.com/haihao0307/Human-Fabric-Workbench/tree/a8ee9ee352521830103719eb7eaceae4dcf54db9/experiments/lace-visual-r13-20261027)。

# R13 验证记录

完整工作台为上级 `index.html`。`compare.html` 内嵌新旧原始截图，`material-summary.png` 只进行相同观察区的等比例裁切缩放，未调色。`comparison-evidence.json` 关联截图哈希与实际 DOM 观察状态。最终帧均为当前构建、静止 32 样本；`final/` 保存原图与配对状态。

- `r13-stitch-grouping.json` / `.md`：第二候选的完整针群结构与实际几何检查。第一候选移动边界附着后覆盖不足，保留在 `r13-stitch-grouping-candidate1.js`，未启用。最终候选不移动端点；18 个花型×材质×强度案例及 9 组实际毛羽构建通过。
- `r13-continuity-diagnosis.json`：读取最终预设的方向与简化角度响应探针。当前展示为 0.17 mm 填线、0.18 mm 针距。R12 30,576 根中 XY 转向 <2° 为 4,565；R13 为 2,394；两者真实三维转向 <2° 均仅 16 根。因此不能把旧的 core 默认配方诊断当作当前展示证据，或宣称多数原针脚完全笔直。角度响应不是像素亮度、完整 BSDF 能量或实布验收。
- `r13-cut-ends.json` / `.md`：9 个完整材质/花型组合，原缓冲前缀、端面环、面积、朝向、有限值与边界检查。`r13-cut-end-views.json` 是从当前实际路径生成的 12 个端点近察夹具，不是另造示意几何。
- `cut-end-compare.html`：实际路径同机位、同材质的开口/闭合三维对照；正视和斜视截图见 `cut-end-images/`，6 张实际浏览器记录见 `cut-end-browser.json`，独立构建哈希见 `CUT_END_VIEW_MANIFEST.json`。
- `r13-browser-roundtrip.json` / `-result.json`：真实下载保存后重置、载入，验证针群 0.43、填绣纤维柔和度 0.47、填绣裁切端关闭及观察设置。
- `r13-browser-budget.json`：过密 0.08 mm 针距被原有 250,000 线段预算拒绝，原针距 0.18、已接受的结构/外观/版本均保留。`browser-errors.json` 中唯一错误为这一有意触发的预算拒绝，无意外 shader/加载错误。
- `r13-motion-smoke.json`：旋转 4 样本、停止 32 样本的功能恢复；不是连续运动画质验收。
- `r13-geometry-cost.json`：实际线芯/毛羽 typed buffer 与提交三角形，包含端面增量。针群走向改变路径长度，因此毛羽根数会略变；端面开关本身不改毛羽。
- `gpu-continuity-*.json` / `gpu-summary.json`：同一 R13 几何及纱线近察视角，仅填绣纤维柔和度 0.8/0 的真实 GPU 定时器查询。计时包含完整 4 样本绘制批次，不是 FPS。冷启动、后台调度和顺序影响明显，宽分位区间重叠，不作因果性能结论。
- `reference/SOURCES.json`、`real-reference-dialog.png`：主来源、许可、照片哈希和实际资料窗口。照片只作结构对照；未完成同尺度同光照实布材质验收。
- `test-results.txt`：最后一次完整测试，174 通过、0 失败。`process/` 为未完成阶段的原始过程输出和一个结构/材质混合组合截图，不属于最终对照。

复现：`node --test tests/*.test.mjs`；`python build-standalone.py`；`node tools/verify-r13-stitch-grouping.mjs`；`node tools/verify-r13-cut-ends.mjs`；`node tools/r13-continuity-diagnosis.mjs`；`node tools/measure-r13-cost.mjs`；`python tools/build-r13-cut-view.py`；`python tools/build-r13-review.py`。

`tests/baseline-r12/` 冻结 R12 源模块（vendor 引用重定向到当前同版本 vendor）；其余冻结基线保持继承。中立新参数必须保留旧 shader、路径、线芯及毛羽行为。生成器版本和可选参数字段不冒充旧 JSON 字节一致。

交付门槛：所有核心依赖已内嵌，HTTP 实际渲染与关键交互通过；浏览器安全策略阻止 `file://`，双击直开尚未实际验证。保持研究候选，不合并、不部署。
