# ET21 / 真实松弛褶皱与冷暖光

## 固定交付候选

公开交互网页：https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/8eb41852b4751b02003867b9aff2c4dd7a6e338c/kaopu-unified-human-workbench/skin-folds-r01/preview.html

源码提交：`5f0ec04dd97715a8fd15c95871521cf0a4bba53a`。固定构建：`8eb41852b4751b02003867b9aff2c4dd7a6e338c`。公网证据提交：`106719184daeb47349db259ef3c16c6464cba50d`。预览 SHA256：`58b394a4f8ab129fe4ea50bde4cfd3e3f8d9de50a4f8047022a9d59de3670f9c`，5,102,553 bytes。

GitHub Actions：https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38348004106 。10项纯算法测试、18项固定公网浏览器检查通过；没有JS、着色器控制台或网络请求错误。证据见 `DELIVERY.json`、`PUBLIC_QA.json` 和该次运行截图附件。Draft PR #236，未合并、未强推。用户尚未视觉验收，不宣称生产就绪。

冻结父版本：`ccf5a1ed9ddde8803e292f1e62d777b141ff52d8`，原入口 `cinematic-r01/preview.html`。本目录只追加新版本，不修改旧版人物、眼睛、嘴唇、动作或影视灯光源文件。

## 实现

`FoldMath.mjs` 定义毫米制、可重放的宽肩浅谷褶皱截面以及沿皮面的收拢与下垂。`FoldSurface.mjs` 只细分合适的面部显示边，使用过渡三角形保持连续；替换同一个 Mesh 的显示几何，不叠加第二张脸。`FairSkin.mjs` 在新增褶皱之前，对显示层实施带眼口保护与渐变边界的法向双步平滑，限制总修正不超过0.22毫米；这不是磨平新增褶皱，也不写回原人物。`SmoothSkinNormals.mjs` 只整理继承底面的着色法线，再加回由真实几何褶皱计算出的法线差值并归一化，避免把新增褶皱一同模糊。计算结果进入已有原生动作派生的待机缓存，播放只混合缓存，不逐帧重复生成褶皱。控制笼、绑定与身体源数组保持不变。

`build.cjs` 仅在新构建内停用旧 Identity 的 wrinkle 笔画和 Idle 的纹理皱纹强度。没有删除原源码；旧网页可继续对照。雀斑、痣、痘印使用已有身份色素层，`FoldSkin.mjs` 增加独立妆感控制，不以表面颜色代替真实褶皱。

默认两盏方向光参考固定父版本中的 `kaopu-hair-workbench/qa/gnm-study/src/app.js`：暖色 `#ffb473`，冷色 `#7caaff`，方向 `(1,.45,.75)` 和 `(-1,.35,.55)`。原冷暖模式保留3.2 / 3的强度；自然模式降低饱和度并调整补光。默认无额外阴影、无多遍散射；可开启单主光阴影或旧多遍散射对照。

## 验证与接手

`node test.mjs` 为10项纯算法测试；`node fair-test.mjs` 可独立验证平滑的受保护边界、位移上限与高频噪声下降；`node build.cjs` 为冻结源码派生构建；`node verify.cjs` 用 Chromium 读取实际网页及 WebGL 像素。设置 `PREVIEW_URL` 可检查固定公网地址，`QA_OUT` 指定证据目录。构建依赖本仓库保留的父模块及固定 esbuild、Playwright 环境，不能只复制本目录就当作独立离线工程。

浏览器测试包括灰模真实顶点变化、正隆起与浅谷、眼口保护、色素与妆感独立响应、冷暖灯切换、旧纹理皱纹停用、旧散射同场景开销对照、原生待机、完整人物档案恢复。SwiftShader 是软件图形环境；测试耗时不代表消费级显卡 FPS。390×844手机尺寸截图不是手机实机测试。

## 性能结论的口径

以同一个新显示网格、相同机位和尺寸对照：新默认为1次绘制、410424个三角形提交；旧三矩形灯加多遍散射为6次绘制、1231278个三角形提交。旧灯光关闭散射时也为1次绘制，因此关闭多遍散射是主要减负来源，不能把改进全归因于少一盏灯，更不能声称帧率提高六倍。

本版细分后显示顶点205459，其中新增55000个。形体修改仍需主线程几何更新及已有待机缓存重建，本次软件环境单次显示更新约639毫秒，完整待机校准还会额外耗时；这不是每帧开销。正常观察和待机使用缓存；调整肤色、妆感、灯光不触发形体重建。首次打开仍需下载原有固定在线资产。

`normalLaplacianBeforeMM/AfterMM` 只衡量此网格的法向局部起伏，不能代表真人皮肤保真度或完整形状误差。按需渲染、暂停与阴影缓存原版已经具备，本版保留它们，不宣称为新发明。

## 参考与边界

Disney Research, *Fast Dynamic Facial Wrinkles* (Eurographics 2024)：https://studios.disneyresearch.com/2024/04/26/fast-dynamic-facial-wrinkles/ 。借鉴其压缩与拉伸改变褶皱截面的观察，未复制论文实现、位移图或第三方人物。论文研究微皱纹，本版是可调的中尺度几何褶皱，不能声称复现论文精度。

Taubin / IBM Research, *Curve and surface smoothing without shrinkage* (1995)：https://research.ibm.com/publications/curve-and-surface-smoothing-without-shrinkage 。仅借鉴低通双步平滑思路；本版加入法向约束、保护蒙版与位移限幅，不是原论文算法逐行复现。

Three.js 官方：https://threejs.org/manual/pages/rendering-on-demand.html ，https://threejs.org/manual/pages/shadows.html 。原资产与模块的署名和许可保持原状，没有引入新的人物网格、扫描或商业贴图。

这不是有限元皮肤、脂肪/筋膜接触或弹性组织模拟。褶皱主要由手动参数驱动；待机沿已有动作带动它，而不是实时求解组织受力。单条截面的积分补偿也不代表整张脸体积守恒。

最终截图人工复查：松弛预设与灰模能看到几何起伏，底面着色已经过有界整理，但熟龄强参数下的鼻唇区域仍有偏硬褶线，整体皮肤透光、毛孔层次及既有人物的近景解剖仍未达到影视极近景标准。妆感提高平滑度也有蜡感风险。本版是可交互的下一轮验收候选，不把测试全绿或新增法线整理等同于完成影视级皮肤。
