# 三栋香港建筑 · 程序材质可编辑小试 R01

## 打开与编辑

在案例根目录运行 `python -m http.server 8017`，浏览器访问 `http://127.0.0.1:8017/viewer/`。依赖已放在 `vendor/`，无 CDN、网络照片、账户或构建步骤。需要支持 WebGL 2 的浏览器。

- 选三栋一起看或选一栋。三栋的展示位置被重新并排排列，尺寸仍是米制真实比例。
- 原件对照、重建白模、程序材质使用同一相机；模式切换不重新摆镜头。
- 整栋、中景、近看表面来自同一栋实际重建几何，不是另造的材质样板。
- 老化、水痕、微表面是实验参数；可导出 JSON 参数记录。
- 窗格默认关闭。开启后仅是创作的颜色/粗糙度效果，不是测得的窗、开洞、楼层或室内。
- 重建规则位于 `../geometry/*.score.json`；`edits.scaleEast/scaleNorth/scaleHeight` 是显式创作变形，默认 1。实测误差报告只适用于默认比例。

## 材质来源

`mothers/kaopu-original.glsl` 从已有 heritage B（1f46ba78170752a07086caa3e66c87f2fa4c7fcf）经 Naga 27.0.3 编译的 GLSL 中抽出，66 个函数体逐字不变。包含 R3.12 砖、R3.12 抹灰和 KST1 混凝土。`provenance/material-sources.json` 留每函数 SHA-256；`extract-mothers.py` 记录提取方法。`provenance/*.mjs` 为原 WGSL 母体保留副本。

新接收器只负责：实测几何的米制切线坐标，单一 staggered(row,column) 的砖身份，屏幕足迹过滤，物理材质接入、创作水痕和可关闭窗格。微表面高度仅改变着色法线，不改测量几何和轮廓。没有把照片中的车辆、阴影或光照烘进材料。

近距调用原母体。远距砖覆盖使用解析区间与像素足迹重叠，再逐渐收敛至近似面积平均；参考既有毛发细线覆盖的思路，未拷贝毛发的半透明着色器。种子和坐标固定，没有逐帧噪声。这个接收器不是精确的足迹积分，也不是对任意设备抗闪烁的全面认证。

地面是每栋周围 6 m 的创作展示场，使用同源 KST1 水泥与 STONE_STUDY 石材。不是地形测量或原地铺装。未下载 DEM。已有私有植物库没有公开再分发授权，因此本包不含该库、也没有低质量替代树。

## 验证边界

运行 `node --test viewer/tests/*.test.mjs` 检查母体 SHA、稳定砖身份、来源角色、无时间随机纹理、渲染分组坐标保持。几何误差与压缩比较见 `../geometry/geometry-validation.json`。

`window.__KAOPU_TRIAL__` 提供：`ready`、`contextReady`、`fatalError`、`errors`、`selectBuilding(0|1|2|'all')`、`setView('whole'|'mid'|'near')`、`setMode('source'|'reconstruction'|'material')`、`setMaterial('brick'|'plaster'|'concrete'|'preset')`、`setParams({age,wet,grain,windows,plain,seed})`、`render()`、`stats()`、`cameraSnapshot()`。

CPU render 提交时间不是完整 GPU 帧时间。真实浏览器编译、整栋/中景/近景截图、像素确定性和性能，应以本案例的实际 CI 报告为准；已有 heritage B 的 93 个 GPU 样本只验证旧接收器有限样本，不能替代本案例。

## 数据归属

建筑几何数据：香港特别行政区政府地政总署 · Common Spatial Data Infrastructure (CSDI) Portal。条款：<https://portal.csdi.gov.hk/csdi-webpage/doc/TNC>。程序材质、水痕、颜色、窗口与展示地面均为本次实验设定，非原建筑实测外观。

Three.js r170 采用 MIT，见 `vendor/THREE-LICENSE.txt`。
