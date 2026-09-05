# Ocean Mother 全量重启入口

打包日期：2026-09-05。交接包版本：V0.3.11。当前接续对象：R018.11 故障修复候选版。

本包用于完整移交和重新开工，未表示项目完成或视觉批准。不要从旧 R017 入口误启，不要把公开 R018.10 当成已解决的稳定版本。

## 首先打开和阅读

根目录 `index.html` 是用户上一轮收到的 R018.11 单文件 HTML 原件，SHA-256 为 `2c689e15c1be7dfd4cd14c83ad3353e63868baee006cd04f3aee3a5f653842e3`，138544 字节。没有在打包过程中更改运行代码。

依次读 `AGENTS.md`、`WORKING_STATE.md`、`OCEAN_HANDOFF.md`、`HANDOFF.json`、`SOURCE_LOCK.json`、`NEXT_ROUND_START_HERE.md`。执行 `python tools/verify_package.py` 核对全部文件。源码在 `source/`，可用 `python tools/build_single_html.py` 重建单文件。

## 继续工作的边界

近岸只继续处理水面、泡沫、卷浪和必要的运行可靠性问题。岛体、沙滩、石头、火焰、烟雾、构图与旋转操作保持，不擅自调整。深海采用包内冻结 V001，不另造蓝色二维占位场景，不重设计深海。

除非用户当轮明确要求图片，交付使用可运行的交互式三维 HTML。禁止用生成图片、截图或概念画冒充实现。当前用户明确要求全量包，因此本次交付包括完整归档；日常工作恢复到三维网页生产。

## 真实状态

R018.10 曾在用户 Windows 浏览器出现 WebGL 上下文丢失。R018.11 带渲染预算、分块提交和恢复逻辑。继承的恢复测试报告对应同一 HTML 哈希，记录桌面和移动视口模拟恢复通过；其加载方式明确为内存 HTML，不构成 URL 访问或真实硬件验收。

软件渲染性能仍偏低，泡沫和卷浪观感未获批准，Windows 实机稳定性待验证。R018.11 尚无已验证的公开部署。本次归档不替换 gh-pages，不部署网站。`visualApproved=false`、`productionApproved=false`、`hardwareGPUVerified=false`。

## 历史资料

`history/v030/` 保留原 V0.3.0 包的全部 117 个文件，含 R017、V001、天气依赖、知识与旧工具。`history/V030_ORIGINAL.zip` 保存原 ZIP 字节。历史状态不得覆盖本页。`history/R018.10_Direct_Open.html` 仅用于差异与回归分析。
