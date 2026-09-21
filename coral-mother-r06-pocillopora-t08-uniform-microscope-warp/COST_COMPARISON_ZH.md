# Microscope 与 Brick Mother V2.6 成本边界

Coral T08 只在参数改变时由 CPU 重建几何并上传；稳定观察阶段是普通三角形绘制。
Brick Mother V2.6 是全屏隐式场 raymarch：每帧每像素最多 118 步，并在步进中重复执行 3D noise、FBM、Worley 与 domain warp。
因此稳定观察阶段 Coral T08 通常更省 GPU；Brick V2.6 的 Warp 更显著，是因为它在 SDF 取样前扭曲整个连续场。
Coral T08 的代价集中在滑条变化瞬间的 CPU 网格重建。没有同一设备、同一分辨率的配对采样，不宣称绝对倍数。
