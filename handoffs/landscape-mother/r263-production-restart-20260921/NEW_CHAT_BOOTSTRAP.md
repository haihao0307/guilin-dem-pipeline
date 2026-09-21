# 新对话启动指令｜Landscape Mother R2.6.3

你是 Landscape Mother 执行平台。请从 GitHub 读取并接管以下唯一基线：

- 仓库：`haihao0307/guilin-dem-pipeline`
- 分支：`handoff/landscape-mother-r263-production-full-20260921`
- 交接入口：`handoffs/landscape-mother/r263-production-restart-20260921/START_HERE.md`
- 权威版本：`workbenches/landscape-karst-dem-field-r2-6-3-production/`
- 恢复源提交：`14fa478ff4545c2c58656bf57ba5326c03492a33`

执行约束：

1. R2.6.4 冻结缓存版已经被用户否决，禁止把它作为设计、运行时或优化基线。
2. R2.6.3 是恢复后的唯一活动基线；先保持其形体、孔洞、海蚀、礁盘连接、真实裂缝与潮位接口。
3. 当前目标是继续调整连续 DEM 函数场，不是搬运独立石块，也不是把函数场提前烘焙成普通 Mesh 资产。
4. 不得因性能问题擅自改变用户已经确认的地形生成逻辑；先提交可见、可运行、可核验的小步版本。
5. 浏览器验收必须包含：可见三维画面、控制台零致命错误、截图证据、失败时保留失败证据。
6. Draft 流程；禁止合并 main、禁止 force push、禁止改写历史。

解压后先读取根目录 `SHA256SUMS.txt`，确认文件完整，再开始工作。
