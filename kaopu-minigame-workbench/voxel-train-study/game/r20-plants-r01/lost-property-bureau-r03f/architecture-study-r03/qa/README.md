# R03 独立候选的既有 QA 接口

经外写许可后，可使用现有仓库 haihao0307/guilin-dem-pipeline 的既有测试分支 qa/bureau-r03f-public-hall-20261013。

既有 workflow：.github/workflows/bureau-r03f-public-hall.yml。根需从远端重新核对当前内容；本地记录见此前 startup-recovery-20261015/workflow.yml。没有新建或修改workflow。

固定QA入口：kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/lost-property-bureau-r03f/qa/startup-recovery-webgpu.cjs。

仅在QA分支中，将 targeted-entry.cjs 内容用于该既有入口。生产失物局根入口不改。适配器检查原57文件SDF基线，然后运行R03 core/geometry/browser测试。新候选范围为同级 architecture-study-r03/。

浏览器产物：现workflow既有目录 bureau-r03f-public-preview-results/。包含 receipt.json、9个视图截图和mobile.png。

回归涵盖启动、12视图、鼠标旋转、滚轮拉近、WASD、屋顶/拱顶/楼板开关、剖切、390px移动布局、JS错误、HTTP错误和WebGL上下文。whole/hall/warehouse各测2.5秒实际帧数，记录绘制调用、三角面数、programs、geometries和帧间隔；沿用旧版“2.5秒>5帧”软件渲染回归门槛。GPU timer未启用，gpuTimeMs明确为null，不能把CPU帧间隔改称GPU耗时。

当前本地环境：Chromium socket启动阻断；没有宣称浏览器测试通过。12个实际Three顶点/片元shader在独立Mesa EGL编译通过，记录在 evidence/shader-compile.log。这不替代浏览器运行和美术验收。
