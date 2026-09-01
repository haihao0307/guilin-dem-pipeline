# Ocean Mother 全量包接续边界

先读 START_HERE.md、HANDOFF.json、SOURCE_LOCK.json，再按任务读取 knowledge/skills/ocean-math-physics/SKILL.md、knowledge/contracts/OCEAN_KNOWLEDGE_CONTRACT.json 与统一方法论。运行 `python -B tools/verify.py` 核对当前包。

本包只汇集已发布网页与独立知识资料，没有自动合并两条运行路线。当前网页入口为 workbench/index.html；独立桥接知识位于 knowledge/bridge-v1/。原文件保持原字节，路径映射见 SOURCE_LOCK.json。

恢复仓库工作时先读 haihao0307/guilin-dem-pipeline 的远端最新状态，工作分支为 work/ocean-mother-handoff-20260901。不要直接用整个包覆盖仓库根目录，不自动合并其他分支，不强推、不改写历史。不手工修改 main、gh-pages、其他生产线、冻结天气与权威真值。

Weather Mother 1.0.0-clean / 0.6.2-loop 是锁定上游。禁止用旧 repositoryReadRef 定位 clean-v1，禁止重建或替换原云内核。海洋图片贴图、模型和外部演示代码持续禁止；内存中的数值体、深度与反射缓存只服务当前运行，不作为导入或持久化图片资产。

共同原则、原政策候选身份及引用不在局部任务中修改。方法论全文接收不证明配套严格 Schema 或运行门禁已接入。中性、工作室及诊断模式、时间历史和物理求解的完成状态以实际代码和测试决定。

本次用户明确授权干净全量 ZIP，归档交付与在线视觉验收分开。不得输出概念图、截图或图片状态看板作为成果。仅记录一个当前状态入口，历史长日志与重复实现留在远端。

运行、自动测试、公开浏览器、用户视觉与生产批准分别记账，任何 pending 或 skipped 不算通过。visualApproved=false、productionApproved=false，用户实际记录与精确构建满足要求后才能改变。
