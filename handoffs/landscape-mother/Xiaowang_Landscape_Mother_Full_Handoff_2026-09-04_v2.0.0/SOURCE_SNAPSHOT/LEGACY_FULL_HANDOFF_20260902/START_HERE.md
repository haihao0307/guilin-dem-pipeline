# START HERE

这是小王负责的 Landscape Mother 全量交接包。新对话开始后，先读本文件，再依次读取 `FULL_HANDOFF.md`、`CURRENT_STATE.json`、`DECISIONS_AND_NONNEGOTIABLES.md`、`CONVERSATION_RECORD.md` 和 `NEXT_TASK.md`。

## 项目身份

项目角色：Landscape Mother，中文角色为小王、总地编师、3A 级游戏地编负责人。

仓库：`haihao0307/guilin-dem-pipeline`

现行工作分支：`feature/landscape-mother-field-graph-v002`

本交接包锁定的源代码快照提交：`91c22b16a5466d41f398c4dc6cecbaaf0c239d49`

当前在线三维入口：

`https://haihao0307.github.io/guilin-dem-pipeline/landscape-mother-workbench/?v=B3.1`

当前状态：B3.1 已建立闭合三维体积、洞穴、侧面、背面、山顶积土、基脚碎岩、固定几何、零 LOD 与零运行贴图。它只是一份技术基础候选，视觉质量仍未达到 3A 标准。`visualApproved=false`，`productionReady=false`。

## 新对话必须立即继承的结论

1. 只交付可在线旋转、缩放、查看正面、侧面、背面和近景的真实三维成果。
2. 禁止用二维效果图、图像生成、截图或平面板替代三维资产。
3. 零 LOD，零贴图，纯数值字段，固定几何精度。
4. 用户不需要看拟合、提取、分区和误差过程。内部完成学习与筛选，用户只看完成本轮制作的彩色三维样板。
5. 当前 B3.1 的宏观形态、光照、综合色彩、材质、土壤过渡和机械式横向层带均未通过。
6. 下一轮工作先建立清晰的 3A 美术目标，再修改代码。不要继续在现有低质量循环里堆噪声或堆功能。
7. 用户最终视觉批准之前，任何自动测试通过都不能把视觉批准或生产就绪改成 true。

## 读取顺序

`FULL_HANDOFF.md` 保存完整状态与路线。

`CONVERSATION_RECORD.md` 保存当前可访问上下文中的完整语义记录和版本链。

`DECISIONS_AND_NONNEGOTIABLES.md` 保存不可违反的生产规则。

`CURRENT_STATE.json` 供程序读取。

`NEXT_TASK.md` 是新窗口直接继续执行的任务入口。

`SOURCE_SNAPSHOT/` 保存本交接时点的活动核心、工作台源码、工作流、GAEA 技能与蒸馏知识。

## 重要边界

原始 GLB `huge_nordic_coastal_cliff_venrdcgga_high.glb` 没有公开打包。已登记身份为 55,798,008 bytes，SHA256 为 `8e3ad9b7e35e4acca3cf414f044f1afebcbd9fcf07f101a72413725842de3678`。

用户提供的参考照片也不进入公开 GitHub 包。文件名、哈希、用途和视觉结论保存在 `ASSET_REFERENCE_REGISTRY.json`。本地私有全量包可以携带用户已经上传的参考媒体，公开仓库只保留身份和知识记录。

系统中部分早期消息带有 `Skipped` 标记，无法逐字恢复。本包保存所有当前可访问的原话、版本、约束和完整决策链，不冒充不可见片段的逐字转录。
