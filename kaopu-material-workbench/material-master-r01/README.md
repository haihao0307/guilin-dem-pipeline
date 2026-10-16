# KAOPU 材质大师 · 表面实验室 01

独立学习案例，保留旧工作台与原母体入口。首版包含墙面/灰泥、石材、砖材的原母体与研究增量对照，不把未验收的金属/玻璃替代品混入完成成果。

## 使用

拖动旋转、滚轮缩放；正视/侧光/近看与视角复位。右侧孔隙、表层侵蚀、当前湿润、修补覆盖只作用于右侧试样。左侧固定母体作为基准。切换原因遮罩、粗糙度和微表面高度检查参数影响。遮罩 RGB 分别表示孔隙、侵蚀、修补；颜色黑不代表未渲染。

## 函数与真实尺度

原 `kpPlasterOriginalField`、`kpStoneSurface`、`kpBrickOriginalSurface` 来自已有 architecture-study-r03/mothers。原函数整体保存在 mothers/all-fields.mjs，本案例未改其方程。新增 labSample 使用已有 br_noise3/br_fbm 形成独立孔隙与侵蚀遮罩，同一遮罩共同驱动颜色、微高度和粗糙度；不是教师贴图导入。

试样约 1.10 × 1.50 m，米制坐标；孔隙采样尺度 6 mm，侵蚀采样尺度 120 mm。当前增量是可操作的因果关系试验，不是标定过的混凝土材料模型。微高度仅扰动着色法线，轮廓并无真实剥落。修补填充与湿润也是研究规则，未模拟固化或真实水膜传输。近看可判断细节，远景对细节采用 footprint 衰减，但不宣称全部频段严格带限。

没有完整 OpenPBR BSDF，没有玻璃折射/吸收渲染，也没有锈层验证。本案例不能证明主工作台旧石样与此接收器视觉等价。

## 来源与权利

- KAOPU 原母体迁移自失物招领局 architecture-study-r03；历史来源详见 sources/BUREAU_PROVENANCE.json。此文件为来源信息，并不授予所有资产新的许可。
- STONE_STUDY 的选定石砖外形参考：LuthBird1，Stone Brick，CC BY 4.0；完整署名见 sources/STONE_NOTICE.md。本案例不含扫描网格、原照片或教师贴图。不要误把该母体当作主工作台 IQ/TDM 的另一个名称。
- Three.js r170 与 OrbitControls：MIT，保留 vendor/THREE-LICENSE.txt。
- 新界面、样板几何、因果层和测试为本次编写；不因此宣称所有历史方程都是此次原创。
- 学习参考：OpenPBR Surface https://academysoftwarefoundation.github.io/OpenPBR/ 。未导入 Adobe/SideFX/商业教程资产。

## 验证

`qa/browser.cjs` 面向 Playwright Chromium，覆盖实际画面非空、研究参数改变右侧像素而不改变左基准、三种母体切换、湿润近景、遮罩、复位与 390px 手机尺寸布局，并输出截图和 JSON。

本地 JavaScript 语法检查与实际 onBeforeCompile 输出的 EGL/GLES 着色器编译已通过。当前容器 Chromium 因 socket EPERM 无法启动；浏览器实帧验收应以之后 QA receipt 为准，编译通过不代替视觉验收。
