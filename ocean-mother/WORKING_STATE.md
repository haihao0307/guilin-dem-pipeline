# Ocean Mother 最小工作状态

更新时间：2026-09-03。仓库 `haihao0307/guilin-dem-pipeline`，分支 `work/ocean-mother-handoff-20260901`。

## 当前续接入口：R015 日光玻璃研究候选

当前候选运行目录：`ocean-mother/coast-glass-r015/`。版本 `0.2.5-coast-r015`，构建身份 `coast-r015-daylight-glass`。在线地址：`https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/coast-glass-r015/`。

精确运行源码提交：`f43ae0d00913050d361335af68c7764b17e3068a`。公开提交：`24701ee4950e881af315e66bedf4ed0aa5a9d679`。最终发布工作流：`33708715561`，结论 success。该工作流针对最终字节完成 11 项数值与几何、37 项候选浏览器、13 项公开浏览器检查；10 个公开文件均 HTTP 200 且逐字节匹配。

正式回执：`ocean-mother/qa/r015/RELEASE_STATUS.json`。源身份清单：`ocean-mother/qa/r015/SOURCE_MANIFEST.json`。本轮内部证据 artifact `9876325315`，SHA256 `93acbd80d15964e1843eb5623cd7782981be0b2ff718c9cd8c7192fa280efcc5`。运行截图只作内部审查，未放入运行目录。

已经落地：岩石封闭拓扑与外向绕序、实际面法线、共享数值岩石边界、水体覆盖与接触泡沫近似、稳定波形频率、日光沙滩可见性、修正的颜色深度合成、顶部独立文字与液态玻璃浮层、贴地木料和火源、暂停静止时停止绘制。

本轮研究文档：`ocean-mother/knowledge/R015_REFERENCE_DISTILLATION_ZH.md` 与 `ocean-mother/knowledge/R015_GLASS_REFERENCE_STUDY.md`。必须区分用户参考的公开描述与项目独立实现。ThreeUI Pro 渲染源码未取得，论坛页面为尚未提供完成解法的提问帖。玻璃实现为当前帧屏幕空间近似。

本轮浏览器使用 Chrome 软件 WebGL2 和 390×844 触控竖屏模拟。真实 iPhone Safari、硬件帧率和功耗未验证。已实际审查海岸、玻璃面板、浅水、岩石、俯视、烟火和移动截图。整体对比仍偏柔，岩石近景、泡沫尺度与粒子烟火仍需继续打磨。原深海入口保持不变，其公开截图仍含原模块载入遮罩；仅确认 canvas 出现和切回 Coast，不能把此项扩大为深海完整就绪验证。

物理边界：当前为解析波面、几何高度边界和泡沫输运近似。完整绕流、反射波、守恒的流固动量交换、三维自由表面、翻卷、卷气和薄水片破碎均未完成。深海与近岸仍是两个运行场景，不宣称已共享完整天气或物理实例。

R015 为可检查研究候选，`visualApproved=false`、`productionApproved=false`、`fullReplication=false`。不要回到用户已拒绝的 R010 黑场方向或把 R012 作为新的视觉成果。以下保留历史资料，不能覆盖本节当前状态。

## 历史基线与干净重启包

历史稳定在线回退工作台：`https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/coast-v012/`

历史稳定 Coast 运行版：`0.1.2-coast`。源码提交：`f0e8e93c9351a76fb70ac0b573ae0b9365c688b8`。公开发布来源提交：`e488b7a02e980ccc535a1385e24430eba0781ced`。公开验证工作流：`33576399854`，47 项通过。

V0.1.2 已修复参数交互后暂停且无法继续的问题。顶部“继续运行”从当前物理状态恢复，保留参数和历史，无需生成新种子。物理步长维持 `1/120 s`，显示延迟单独记账。

已存档干净全量包：`ocean-mother/handoffs/Ocean_Mother_Full_Restart_Handoff_2026-09-02_V0.1.2.zip`，固定提交 `9f8453b07f7dc18ef49aa828907a3d087bcf7297`，SHA256 `221cebcb9b14349f875102ac70a3259698b4c8e7d5f2333c518a6202f2c1f96d`，143130 字节，61 个文件。新研发窗口同时读取 `ocean-mother/RESTART_START_HERE.md` 与本文件顶部的当前候选状态。

## 用户锁定规则

Ocean Mother 永久关闭图像生成、图像增强和图片式细节补偿。全部成果经由代码、数值场、几何、物理、光学、缓存与在线交互工作台生产。运行时和发布包保持零颜色贴图、零法线图片、零噪声图片、零预烘焙环境图片和零截图背景。机器规则位于 `contracts/OCEAN_RUNTIME_VISUAL_POLICY.json`。

首要视觉方向锁定为写实；与既有深海区域统一太阳、天空、雾化、线性色彩、曝光、色调映射和镜头响应是持续目标，具体实现状态以上方能力边界为准。卡通风格延后。近岸透明与半透明由水层厚度、吸收、散射、折射、Fresnel、泡沫和湿润状态派生。

## 历史 Coast 0.2.0 R010

R010 源码位于 `ocean-mother/coast-v020`，修正发布入口位于 `ocean-mother/coast-v020-r010`。历史实现记录包含 Beer Lambert 水层光程、Fresnel 反射、深度限幅折射、预乘透明合成、状态泡沫、湿润历史、活动与冻结瓦片、不透明场缓存和稀疏水雾。旧在线候选入口为 `https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/coast-v020-r010/`，用户已拒绝其空场与夜感表现。

R010 把局部三维压力自由表面列为待研发能力。解析波面或显示几何不得申报成完整三维流体。后续研究保留局部稀疏三维自由表面、二维与三维质量动量交换、撞岩压力、卷气、气泡及水雾分层。

保护范围：原深海、Weather Mother `1.0.0-clean / 0.6.2-loop`、其他 Mother、权威真值和共同核心不改。`visualApproved=false`，`productionApproved=false`，`fullReplication=false`。

## 历史 R010.1 着色器修复

用户公开页面复核发现水体片元着色器把 `active` 用作局部变量。浏览器按 GLSL ES 3.00 保留字处理并拒绝编译。R010.1 将该变量改为 `tileActivity`，同步提升运行版本并给模块增加版本查询，避免浏览器继续读取旧脚本。

公开修复提交：`bee6b0cbcf86c4ff4c3e30a4b0fb46554ff7d4da`。公开 Chrome WebGL2 检查工作流：`33616131790`，结论 success。历史检查确认公开 HTML 与模块已更新、WebGL2 初始化成功、运行时已推进、错误面板保持隐藏，且原保留字编译错误消失。

该修复只改着色器标识符、版本身份和浏览器缓存键，不改海床、浪形、泡沫状态、光学参数、冻结天气、深海或其他 Mother。`visualApproved=false`，`productionApproved=false`。
