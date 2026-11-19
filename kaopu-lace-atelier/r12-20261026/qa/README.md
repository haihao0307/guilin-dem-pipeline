本目录为独立交付与精选证据。完整源码、冻结基线、构建和过程记录：[源目录](https://github.com/haihao0307/Human-Fabric-Workbench/tree/09a01c405e6fe8619991161d7a13e62c1faa4649/experiments/lace-visual-r12-20261026)。

# R12 证据索引

- `final/*.png`：最终 HTML 的原始后台截图；对应 `.frame.json` 记录构建 SHA、32 样本、材质、镜头、光照和实际渲染统计。
- `compare.html`：独立的 R11/R12 三材质滑动对照，截图未调色；两侧用相同当前结构，细网明确包含线径变化。
- `material-summary.png`：三个最终微距侧光截图相同区域的裁切缩放和标签，未修改颜色/对比度。
- `r12-yarn-profile.md`、`r12-yarn-profile.json`、`r12-yarn-profile-final.json`：包络候选、继承缺陷、全尺寸与预算拒绝记录。
- `r12-finish-diagnosis.json`：最终 R12 参数下，集中度 0/正值的方向分布数值对照，不等同图像亮度或完整 BSDF 能量证明。
- `r12-geometry-cost.json`：同一当前结构的 R11 材质/R12 几何成本，不是 GPU 帧率。
- `roundtrip-custom.json`、`roundtrip-proof.json`、`control-edit-proof.json`、`rejected-build-proof.json`：真实 UI 调参、保存恢复、预算拒绝保留状态。
- `test-results.txt`：最终 149 项检查记录。`browser-errors.json` 仅含一次故意触发的预算错误，没有非预期应用警告/错误。
- `process/`：首轮画面及早期检查，不作为最终构建证据。

HTTP 浏览器检查不能代替被 URL 安全策略阻止的实际 `file://` 运行验收。物理、真实样布、完整运动和跨设备验收仍待后续。
