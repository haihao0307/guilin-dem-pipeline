# Ocean Mother 最小工作状态

日期：2026-09-02。仓库 `haihao0307/guilin-dem-pipeline`，分支 `work/ocean-mother-handoff-20260901`。

当前稳定在线回退工作台：`https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/coast-v012/`

当前稳定 Coast 运行版：`0.1.2-coast`。源码提交：`f0e8e93c9351a76fb70ac0b573ae0b9365c688b8`。公开发布来源提交：`e488b7a02e980ccc535a1385e24430eba0781ced`。公开验证工作流：`33576399854`，47 项通过。

V0.1.2 已修复参数交互后暂停且无法继续的问题。顶部“继续运行”从当前物理状态恢复，保留参数和历史，无需生成新种子。物理步长维持 `1/120 s`，显示延迟单独记账。

最新干净全量包：`ocean-mother/handoffs/Ocean_Mother_Full_Restart_Handoff_2026-09-02_V0.1.2.zip`，固定提交 `9f8453b07f7dc18ef49aa828907a3d087bcf7297`，SHA256 `221cebcb9b14349f875102ac70a3259698b4c8e7d5f2333c518a6202f2c1f96d`，143130 字节，61 个文件。新研发窗口先读 `ocean-mother/RESTART_START_HERE.md`。

## 用户锁定规则

Ocean Mother 永久关闭图像生成、图像增强和图片式细节补偿。全部成果经由代码、数值场、几何、物理、光学、缓存与在线交互工作台生产。运行时和发布包保持零颜色贴图、零法线图片、零噪声图片、零预烘焙环境图片和零截图背景。机器规则位于 `contracts/OCEAN_RUNTIME_VISUAL_POLICY.json`。

首要视觉方向锁定为写实，并与既有深海区域共享太阳、天空、雾化、线性色彩、曝光、色调映射和镜头响应。卡通风格延后。近岸透明与半透明由水层厚度、吸收、散射、折射、Fresnel、泡沫和湿润状态派生。

## Coast 0.2.0 R010

R010 源码位于 `ocean-mother/coast-v020`，修正发布入口位于 `ocean-mother/coast-v020-r010`。它接入 Beer Lambert 水层光程、Fresnel 反射、深度限幅折射、预乘透明合成、状态泡沫、湿润历史、活动与冻结瓦片、不透明场缓存和稀疏水雾。在线候选入口为 `https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/coast-v020-r010/`。

R010 继续把局部三维压力自由表面列为待研发能力。它不会把解析波面或显示几何申报成完整三维流体。下一阶段继续接入局部稀疏三维自由表面、二维与三维质量动量交换、撞岩压力、卷气、气泡及水雾分层。

保护范围：原深海、Weather Mother `1.0.0-clean / 0.6.2-loop`、其他 Mother、权威真值和共同核心不改。`visualApproved=false`，`productionApproved=false`，`fullReplication=false`。
## R010.1 着色器修复

用户公开页面复核发现水体片元着色器把 `active` 用作局部变量。浏览器按 GLSL ES 3.00 保留字处理并拒绝编译。R010.1 将该变量改为 `tileActivity`，同步提升运行版本并给模块增加版本查询，避免浏览器继续读取旧脚本。

公开修复提交：`bee6b0cbcf86c4ff4c3e30a4b0fb46554ff7d4da`。公开 Chrome WebGL2 检查工作流：`33616131790`，结论 success。检查确认公开 HTML 与模块已更新、WebGL2 初始化成功、运行时已推进、错误面板保持隐藏，且原保留字编译错误消失。

该修复只改着色器标识符、版本身份和浏览器缓存键，不改海床、浪形、泡沫状态、光学参数、冻结天气、深海或其他 Mother。`visualApproved=false`，`productionApproved=false`。

