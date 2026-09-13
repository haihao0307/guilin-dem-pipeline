# 小温州 · 当前轻量交接入口 · 2026-09-13

这是换窗口继续工作的唯一入口。历史全量 ZIP 是冷档案，不再作为默认接续载体。

## 当前权威状态

- R3.8 已验证候选提交：`3018da201a2ef6b5d122522e85bbbb5b91f8a34d`。
- R3.8 QA/状态记录提交：`a942cfb06e3b33f6b202c1d376c74e06f7a07e0c`。
- 固定公网预览：`https://raw.githack.com/haihao0307/guilin-dem-pipeline/3018da201a2ef6b5d122522e85bbbb5b91f8a34d/site/dist/r3-8/index.html`。
- 固定提交公网 Chromium QA 已通过；用户视觉验收、真实 iPhone 验证、productionReady 仍未成立。
- 当前续作分支：`feature/wenzhou-r3-8-overlay-transform-contract-20260913`。
- 本续作已修正 SoilProfile 覆盖层完整继承地形 position/quaternion/scale 的契约，并正在清理旧全量打包链。此续作分支尚未完成新的 fixed-commit 公网视觉 QA，因此不能把它当成新的视觉候选。

## 必须保留的事实

1. R3.2–R3.8 已有成果继承，不从零重做。
2. R3.8 已接入六深度 SoilProfile、WRB 官方分类/30 类概率/派生分类/差异审计、JRC 历史水体，并通过固定提交公网浏览器 QA。
3. SoilGrids 250 m 是模型预测外部观察，不是 12.5 m 土壤真值，不替代现场土样，不改变 DEM。
4. 每个 `property × depth` 的 `Q0.5` 与 `uncertainty` 是两个语义不同的数据声部，不是重复文件；不能为了缩包静默删除 uncertainty。
5. WRB 官方 `MostProbable` 与概率对齐后的 argmax 同时保留；约 6.1% 差异是算子顺序差异，不代表官方分类损坏。
6. JRC 1984–2024/2022–2024 相关长期指标只是历史观察，不能替代当前海陆拓扑、河网或某一天水位。
7. DEM、海岸/河流、演示海面、WorldCover、SoilProfile、WRB、JRC、OSM 属于同一世界总谱的不同证据声部。
8. 世界运行时和交接包都必须轻量：稳定主体常驻，专题/高频/大数据按位置、尺度、任务按需取回。

## 当前继续顺序

1. 完成轻量交接链并实际生成体积报告；不再继承 R3.1/R3.2 的 1.03 GB 全量底包。
2. 对轻量包内文本按 SHA-256 自动去重；同内容只保留一个活动副本，其余记录 alias。
3. 浏览器运行所需二进制暂留运行仓，不进入随身交接包；后续单独研究 `Q0.5 + uncertainty` 的双通道容器/分块/量化，不以丢数据换体积。
4. 覆盖层 transform contract 若要晋升候选，必须重新做本地 + fixed-commit 公网回归。
5. 没有明确收益时不新增大型证据声部，不让包再次滚雪球。

## 轻量交接规则

默认交接只携带：当前状态、世界总谱规则、来源/Release/哈希锁、当前 R3.8 关键代码、QA/构建文本与少量必要记录。完整 DEM、历史网页、永久证据 ZIP、浏览器二进制栅格、离线 Python 依赖和旧全量重启 ZIP 均留在永久 Release/固定 Git 提交中，通过 tag/asset/SHA-256 精确恢复。

网页最终交付仍使用固定提交 `raw.githack` HTTPS；历史已验证版本与永久证据 Release 不删除，只退出活动工作集。
