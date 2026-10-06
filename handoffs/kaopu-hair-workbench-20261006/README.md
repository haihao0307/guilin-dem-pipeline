# 毛发工作台全量交接 · 2026-10-06

**R1 外观未通过用户验收。** 本包是继续工作的完整现场，不是已完成的人物效果。

用户明确指出：女性形态不足，眼睛不对，皮肤学习结果远不及参考。运行检查通过不能证明外观合格；不得把本轮写成“完整学习完成”。

## 接手步骤

1. 解压整个包，保留目录。先运行 `python verify_handoff.py` 核验所有文件。
2. 安装/使用 Python 3.10+（本机验证为3.12），执行 `打开工作台.cmd`，或 `python open_workbench.py`。只启动本机HTTP服务，默认打开R1；首页为 `/kaopu-hair-workbench/`，旧男性R9为 `/kaopu-hair-workbench/qa/gnm-groom-editor/experiment.html`。
3. 阅读 `HANDOFF.md` 与 `NEXT-WORK.md`，再读 `learning-materials/`。源码在 `current/kaopu-hair-workbench/`，全部旧场景、资产、QA和许可保留。
4. R1自带本地GNM二进制、Three.js、源码、许可证和配方。它不需要TEN24原件；浏览器不要直接用file方式打开。
5. 想观察原学习案例，在 `learning-materials/TEN24-original-download/` 按官方来源重新下载到Git外的私人目录。附下载脚本、72文件校验清单和独立核验程序。

## 包含范围

- 当前完整工作台，包括兔子、海葵、羽毛、Houdini、原男性R8/R9、人学习场景和GNM造波皮肤R1；不是只截取R1。
- 当前本地工具、旧包来源元数据、检查记录、GNM自制案例截图、造波专题文档和原件获取说明。
- R1里附独立可运行ZIP，方便只测试R1。

TEN24约2GB原ZIP、72个原素材、扫描人物渲染及含扫描的R10/R11 blend不放入公开交接包。用户允许接手者另行从官方获取。旧接发脚本和结构/检查元数据作为历史保留，不是新GNM实现的素材来源。

本包不附Blender安装程序。只读确认本机Blender5.2.0 LTS能打开原件，未为这轮升级软件；新GNM浏览器案例运行不依赖Blender。

历史检查中的G盘路径、旧提交、旧发布和“待原件接入”表述属于当时现场，以HANDOFF.md的最新状态为准。旧测试ZIP报告哈希对应旧包；historical-evidence保留原报告，reports中新R1包报告对应只补充验收文字后重打的包。浏览器运行代码未变，完整包另有独立清单和解包验证。

## 交接任务门禁状态

- 没有用生成图片代替三维；本包包含原实时可交互工作台源码。
- 本轮是用户明确要求的全量打包上传；未修改生产渲染代码，未产生新的视觉候选。
- 旧画面、旧浏览器检查与截图为历史证据，不能当本轮新效果；R1视觉验收为USER_REJECTED。
- 本轮验证完整包清单、独立解压与本地HTTP资源；没有把压缩包链接宣称为新在线工作台或新的浏览器视觉验收。
- GitHub下载的完整性在发布后另存PUBLICATION_PROOF.json，不通过则不宣称上传完成。
- 若只有截图而没有工作台则失败；本包携带完整实时三维源码、模型数据、许可与运行入口。

## GitHub完整包

下载本次完整ZIP和SHA256校验：
https://github.com/haihao0307/guilin-dem-pipeline/releases/tag/kaopu-hair-full-handoff-20261006

压缩包在Release附件；本目录存交接文档、来源、原件获取脚本和全量manifest。不是部署新的视觉工作台。
