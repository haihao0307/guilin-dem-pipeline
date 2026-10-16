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

`node qa/browser.cjs`：在有Playwright Chromium的环境中测试12个视图、相机旋转/缩放/WASD、层开关、剖切、移动端、JS和HTTP错误；实际截图另存。2026-10-16 既有远端 QA 38959533612 已实跑，32项功能合约通过，并取得6张真实网页截图。软件GPU性能门槛未过：固定2.5秒窗内没有完成帧；其后整栋/大厅/仓库单帧完成分别约4.62/13.25/7.37秒，不能称流畅。不是用户设备实测。

`node qa/export-shader-harness.mjs` 和 `qa/compile-mother-glsl.py`：导出并用已安装Mesa EGL离屏编译6类材质的实际Three宿主shader。此检查已通过；不能代替完整浏览器运行、数值等价和美术验收。

`qa/render-inspection.py`：从同源几何导出Blender CPU检查图。它们有真实几何，检查材质，不是浏览器母材质截图。

## 状态

这是完整空间候选，不是通过用户美术验收的最终作品。仓储内框4500㎡，扣实际柱脚16.245㎡后4483.755㎡。拱顶没有结构求解；消防、无障碍、机械热工和货架库容未认证。复杂输送动画不在本轮。

原木材质尚未认证的链路包括宏位移、视差和斜杆精确局部坐标；不把字段迁移和Shader编译通过称为整个原材质链完全等价。

旧architecture-study-r02未被替换。没有发布或改动其他工作台。

材质重建：`node qa/build-material-port.mjs && python3 qa/port-all-materials.py`。只读随包保留的母体模块，不依赖临时目录或老师原模型。

## 运行调度与当前缺口

完整几何、母本字段、默认阴影和像素分辨率均保留。绘制改为按需请求，交互和惯性期间继续请求；最多一个GPU帧在途，静止不重复绘制。ready/frames现在对应GPU fence完成，不能与旧版JS提交计数混用。启动显示完整母本首帧等待秒数。

首GPU完成约8.73秒；测试先再次切整体视图再截图，首张截图实际完成14.93秒。fence墙钟时间与帧间隔不是纯GPU执行计时，GPU timer未启用。网页中的石/板岩母本有明显远景噪点，仍待视觉校核；没有改用另一套简化材质遮盖问题。
