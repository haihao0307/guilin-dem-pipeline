# R7 — 岩面显微细节

R6 拉近后仍偏软：显微场经过低频压缩后写入微小高度，再被旧微表面开关统一缩放；非线性的材质坐标和矿物字段在顶点求值后插值，也会造成近景柔化。R7 修正这条显示链，保留 R6 的宏观岩体与自然光方向。

## 这一版的实际改动

- 保留 Macroscopic microscope 的对数半径、方向比值、方位角和 17 级倍频结构。对空间弯折和近表面频段逐层求导，再做有界幅度压缩，避免先压平信号再用相邻像素求差分。增加固定三维空间相位，使更细频段落在同一岩面上；相位不读取镜头、时间或帧号。
- 显微壳层独立于旧微表面开关。蚀孔、稀疏晶粒边界、颗粒和小范围高光共同读取固定三维坐标，写入微法线、颜色与粗糙度；颜色不反过来修改岩体。
- 材质坐标弯折与矿物噪声改为逐片元求值，保留原来的种子与坐标身份。
- 17 层始终使用同一场。像素足迹用于解析信号积分和抗锯齿，不替换网格、不改变固定几何精度、不读取贴图，也不按设备或拖动状态切换质量。
- “显微”按钮和双击岩面通过当前上传网格的真实三角面求交来对焦。可以继续滚轮放大；近裁面随观察距离调整，原始顶点与索引不变。

`index.html#micro` 可直接进入近景；“全貌”返回原样板。这里的微小表面起伏是着色近似，单个 microscope 场的高度上限为 18 mm，组合还包含有限蚀孔与颗粒项；它们不是新建的碰撞几何，不改变轮廓、大洞口或落石支承。不能据此宣称已完成测量级地质重建或完整 3A 资产认证。

## 重建与验证

从仓库根目录运行 `python workbenches/landscape-surface-r7/build.py`。输入是 SHA256 为 `44bb0301869dc572dc3c9cab8924e16e115b453987576926706a48e538610e46` 的 R6 HTML；构建逐字比较 `worldSource` 和 `generateSource`，禁止对宏观生成器做隐性修改。

`python workbenches/landscape-surface-r7/check_derivatives.py` 对 75 个导数分量进行独立中心差分复核。`gpu_derivatives.cjs` 进一步复核生产 GLSL 空间弯折的 27 个 GPU 导数分量，并比较解析版本与原空间映射的坐标。这些只验证数学，不替代渲染验收。

`qa.cjs` 用 Playwright 经本地 HTTP 运行实际页面。通过 `NODE_PATH` 提供 Playwright；可用 `LM_CHROME` 指定 Chrome，必须用 `LM_QA_OUT` 指定源码树以外的内部截图目录。测试包含显微层独立性、整套网格指纹、放大、真实表面拾取、状态和图像精确恢复、八个视角、手机视口触摸、另一种子及 R6 同机位对照。实测记录在 `QA.json`。所有截图仅用于内部 QA。

测试环境为桌面 Chromium / SwiftShader；物理手机与硬件性能验收分开。`visualApproved=false`、`productionReady=false`，由用户保留最终美术批准权。

## 来源

固定基线：R6，Git 提交 `5190edd31ec7a052ecb615926a4811dd87b2e53b`。宏观岩体继续来自已冻结的水蚀石灰岩样板，七文件核心、区域真值及其他工作台保持原样。

方法归属：[Yohei Nishitsuji — Macroscopic microscope](https://yoheinishitsuji.com/)；[作者在 Codrops 的说明](https://tympanus.net/codrops/2025/02/18/rendering-the-simulation-theory-exploring-fractals-glsl-and-the-nature-of-reality/)。这里沿用仓库 R3/R5 已接入的方法结构；近表面频段、解析导数、孔隙与晶粒字段、材质耦合和三角面拾取属于本轮的工程适配，不能归称为作者原作或已标定的地质规律。
