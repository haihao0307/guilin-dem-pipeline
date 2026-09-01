# Ocean Mother 最小工作状态

日期：2026-09-01。日常只从本文接续，细节按需读取。
仓库：haihao0307/guilin-dem-pipeline；工作分支：work/ocean-mother-handoff-20260901。开工复核远端 HEAD，不自动合并其他分支。

交付规则：只向用户交付可打开、可交互的在线 HTML 工作台。禁止概念图、截图、图片式看板及离线 HTML 作为交付。不得用生成图片声称提交、部署、功能或性能通过。以前生成的状态看板不属于任何项目证据。

当前可查看入口：https://haihao0307.github.io/guilin-dem-pipeline/ocean-mother/v001/
候选版本：0.1.0；已发布候选快照：8098af8d034d9df9fbeee75d1fb2f36727e15678。
本轮找到并重新核验已有公开候选，没有重建、修改或重新发布运行代码。21 个公开文件均 HTTP 200 且与固定快照逐字节一致；真实公开 Chromium 自动检查 34 项通过、0 失败。审计提交 6cb77fbc53f63af3e55bd5cf70429e25832d8071，Actions run 33477922196。回执见 adoption/LIVE_WORKBENCH_RECEIPT.json。
可用：六种海况、真实几何波动、风向风力、涌浪尺度与周期、独立云漂移、日照、水色、暂停、视角拖动、滚轮观察高度和复位。首次进入及天气切换需要生成云密度与光照缓存。
缺项：中性/工作室/诊断三模式完整接入、共同严格 Schema 与运行门禁、浮力碰撞、真实岸线海底潮汐和破碎浪。软件渲染测试不代表用户设备帧率，手机视口只验证首帧与参数按钮。

本分支历史成果仍为 O1A 只读桥接与知识档案；公开候选采用独立海洋适配器，当前审计不等同于本分支 O1B 已通过。后续受控对齐源代码与公开候选，禁止自动整分支合并或替换冻结上游。
共同方法论 17 节及 JSON 接收记录见 adoption/SOURCE_RECEPTION_0.2.0.json；资料接收不等于运行时完成。
唯一天气原件：Weather 1.0.0-clean / 0.6.2-loop，固定发布 ref 2619725efe236d2df8f2a55031bdae9e60a51555。原字节保持不变，零图片贴图，不改权威真值或其他生产线。
批准：visualApproved=false；productionApproved=false。正常提交，不强推，不改历史，不手工改 gh-pages。
