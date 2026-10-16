# 失物招领局 · 独立建筑候选03

打开 index.html 对应的 HTTP 地址。所有运行依赖已随包放在 vendor/，不依赖CDN、Rhino或FreeCAD。

本地运行：在本目录运行 `python3 -m http.server 8793`，浏览器打开 `http://localhost:8793/`。

## 操作

拖动旋转，滚轮拉近，右键平移；WASD移动，Q/E升降，Shift加速。视图按钮可进入大厅、柜台、办公室、回廊、仓库与蒸汽廊。支持屋顶、拱顶、上层板开关和水平剖切；H隐藏面板。

## 源与共享规则

- model.mjs：自有可复算建筑组装、空间划分、连续柜台、支承和屋面关系
- construction.mjs：共享构件和洞口边界、逐构件米制材质坐标
- material-mothers.mjs、mothers/：105个原母材质字段保留与GLSL机械转译
- design/spatial-system.json：整栋对象关系与可测约束
- design/decisions.md：设计取舍、老师来源、复用规则与验证边界
- design/source-license-manifest.json：固定来源版本、原文件哈希和许可；teacher-comparison.json：只读老师数据与自有规则对照
- design/parameters.json：尺度清单。当前是源代码驱动，并非任意修改JSON即可重建的BIM软件

## 验证

`node qa/geometry.test.mjs`：有限几何、支承关系、洞口唯一、面积、九条通路射线等。

`node qa/browser.cjs`：在有Playwright Chromium的环境中测试12个视图、相机旋转/缩放/WASD、层开关、剖切、移动端、JS和HTTP错误；实际截图另存。当前执行环境不允许Chromium所需socket，因此这里尚未取得浏览器运行通过结果。

`node qa/export-shader-harness.mjs` 和 `qa/compile-mother-glsl.py`：导出并用已安装Mesa EGL离屏编译6类材质的实际Three宿主shader。此检查已通过；不能代替完整浏览器运行、数值等价和美术验收。

`qa/render-inspection.py`：从同源几何导出Blender CPU检查图。它们有真实几何，检查材质，不是浏览器母材质截图。

## 状态

这是完整空间候选，不是通过用户美术验收的最终作品。仓储内框4500㎡，扣实际柱脚16.245㎡后4483.755㎡。拱顶没有结构求解；消防、无障碍、机械热工和货架库容未认证。复杂输送动画不在本轮。

原木材质尚未认证的链路包括宏位移、视差和斜杆精确局部坐标；不把字段迁移和Shader编译通过称为整个原材质链完全等价。

旧architecture-study-r02未被替换。没有发布或改动其他工作台。

材质重建：`node qa/build-material-port.mjs && python3 qa/port-all-materials.py`。只读随包保留的母体模块，不依赖临时目录或老师原模型。
