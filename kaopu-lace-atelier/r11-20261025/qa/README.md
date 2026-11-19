本目录为精选证据，过程图与合成输入保留在[源码完整 QA](https://github.com/haihao0307/Human-Fabric-Workbench/tree/codex/lace-visual-controls-20261025/experiments/lace-visual-r11-20261025/qa)。

# R11 视觉与运行证据

- `final-*.png` / `baseline-yarn-*.png`：最终交付构建的原始后台浏览器截图；相应 `.frame.json` 保留构建散列、实际 uniform、镜头、布光、弯曲和 32 样本状态。`compare.html` 内嵌三组同机位截图。
- `local-*-oblique.png` / `short-stitch-compare.html`：九条原缺陷的微尺度独立几何对照，实际数据来自 `short-stitch-views.json`。开放端面仍可见，不是整布材质或闭合实体的验收。
- `r11-short-stitches.json/.md`：21 组实际扫掠检查；49 条调整必须区分 9 条原缺陷与 40 条预防调整。`fixtures/` 保留原始异常。
- `roundtrip-custom.json` 是浏览器实际下载的完整配方，再经实际载入核对；`intermediate-import-input.json` 是明确标记的中间强度输入，`roundtrip-proof.json` 是最终恢复结果。保护中间值用于参数恢复检查，不是无折叠认证。
- `surface-edit-proof.json`、`rejected-build-retains-surface.json` 证明纹理即时修改与预算失败后的保留。`browser-errors.json` 包含故意触发的预算错误，不是非预期渲染错误。
- `geometry-cost.json` 测量真实 buffer / 三角形；`gpu-profile-static.json` 记录被测构建、实际姿态和非阻塞 GPU 查询。计时范围明显重叠，不是 FPS、稳定提速或跨设备通过。
- `sampling-cycle.json` 只证明移动/静止采样功能切换；完整闪烁验收仍待完成。
- `first-*` 是视觉收益弱的第一表面候选，`second-yarn-raking.png` 是第二候选的过程记录。`surface-roi.json` 只记录原始显示 RGB 差异，不能作为质感通过或线性辐射度证据。

所有图像均为原始浏览器截图；没有补画、锐化或修图。最终独立 HTML 的核心不依赖这些外部 QA 文件。
