# Ocean Mother R018 启动入口

R018 基线来自 V0.3.0 全量包锁定的 `0.3.0-island-r017`，源提交为 `74ff2fb67de0aa52d41c3ee1e6e9d93fd9fbb8ad`。

当前候选目录：`ocean-mother/island-r018/`。

当前工作分支：`work/ocean-mother-r018`。

首阶段代号：`relationship-convergence-foundation`。

首批实现范围：

1. 浅水颜色、折射和可见透明度随实际水厚连续变化。
2. 泡沫源强读取三层破浪各自的强度，减少与浪体脱节的均匀白层。
3. 湿沙和岩石水线读取潮位、回洗相位与历史湿润场。
4. 每个火源向海面提供方向性暖色反光。
5. 烟柱随寿命增长降低浮升、扩大湍动和扩散，保持统一风场输运。
6. 保留三页 102 项参数、动态玻璃、移动端布局和深海往返。

约束继续保持：运行时图片资产 0、外部模型 0、CDN 0、图像生成关闭。完整三维守恒流体和体积燃烧仍未申报完成。

候选门禁：`.github/workflows/ocean-island-r018-candidate.yml`。视觉、生产和完整复刻批准均保持 `false`。
