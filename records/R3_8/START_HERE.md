# 小温州 R3.8 新接续入口 · 2026-09-12

当前候选已完成本地及固定公网 Chrome 验证。冻结候选为 3018da201a2ef6b5d122522e85bbbb5b91f8a34d；后续状态/测试说明提交不改变该地址。

固定预览：https://raw.githack.com/haihao0307/guilin-dem-pipeline/3018da201a2ef6b5d122522e85bbbb5b91f8a34d/site/dist/r3-8/index.html

事实状态以 CURRENT.json、PUBLIC_BROWSER_QA.json、INHERITED_PUBLIC_QA.json 为准。原 handoffs/wenzhou-r3-8-current-full-20260912 是保留的接收历史，其中 R3.8 未整合的描述不再是本分支最新状态。

已完成：WRB 官方分类、30 概率声部选择、派生分类与差异；六深度八属性的中位数/相对不确定性；JRC 六种历史指标；单一地点八类证据引用；按需加载与有界缓存、过期请求取消和失败重试。

仍未完成：用户视觉验收、真实 iPhone/Safari 验证、把证据索引进一步扩展为实际 Object DNA/生成调度。现有地点索引不能冒充完整造波引擎。250 m 的 JRC 浏览抽样不等于原生 30 m 全量显示；seasonality 和 extent 仍为 2022–2024 部分。

继续携带仓库根的 MOTHER_OBJECT_DEFINITION_RULE_2026-09-09.md 和 MOTHER_PUBLIC_PREVIEW_DELIVERY_RULE_2026-09-08.md。不得恢复撤销流程；固定历史版本和永久 Release 保留；不设长期自动任务。新页面交付继续使用固定提交 raw.githack HTTPS 并实际浏览验收。

本轮 API 发布源树与本地已测试 Git 树完全一致。普通 Git 443 连接失败时改用官方 GitHub Git Data API；没有改变公网入口格式。后续继续使用 feature/wenzhou-r3-8-world-score-20260912 分支。
