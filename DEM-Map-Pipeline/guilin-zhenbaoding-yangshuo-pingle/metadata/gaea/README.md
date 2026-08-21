# Gaea / 侵蚀 / 喀斯特 / 植被接入

本目录把 `process-dem-with-gaea` 技能接入桂林 DEM 生产线。`terrain-processing-profile.json` 是可审计的处理契约：保留原始 DEM 分支，Gaea 侵蚀、Thermal2、Outcrops、Slope/Curvature/FlowMap/Normals 与植被层均属于可视化衍生层，不改变测绘精度声明。

真正的 `.terrain` 文件必须在安装并授权的 Gaea 2.3 图形界面中创建，先用 **Build > Copy Command Line** 验证，再由 `skills/process-dem-with-gaea/scripts/gaea_swarm.py` 执行。当前机器没有可确认的 Gaea 授权构建，因此项目保存的是模板契约与可复现变量，不会伪造已完成的侵蚀高程成果。

近景网页继续使用 `metadata/ecology/v0.3.1` 的生态可视化包；它是确定性的植被/地貌展示层，等待真实 12.5 米或 1 米源 DEM 后再生成测量级精细区域。
