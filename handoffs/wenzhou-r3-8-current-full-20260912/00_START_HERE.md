# 小温州 · R3.9 当前轻量交接入口 · 2026-09-13

这是换窗口继续工作的唯一入口。历史全量 ZIP 与永久证据 Release 是冷档案，不再作为默认随身接续载体。

## 当前权威状态

- R3.8 冻结验证基线：`3018da201a2ef6b5d122522e85bbbb5b91f8a34d`；状态/QA 提交：`a942cfb06e3b33f6b202c1d376c74e06f7a07e0c`。
- R3.9 当前已验证轻量运行态：`d591713f236107f7db5a24fb9d74e087550e688a`。
- R3.9 固定公网预览：`https://raw.githack.com/haihao0307/guilin-dem-pipeline/d591713f236107f7db5a24fb9d74e087550e688a/site/dist/r3-8/index.html`。
- R3.9 已通过静态语义门、本地 Chromium、390×844、固定提交 raw.githack；SoilProfile、WRB、JRC 的新压缩 transport 在旧活动二进制物理删除后仍通过回归。
- 用户视觉验收、真实 iPhone Safari/GPU/CPU 验证和 `productionReady` 仍未成立。
- 当前接续分支：`feature/wenzhou-r3-8-overlay-transform-contract-20260913`。`d591713f...` 之后的提交只做交接文档/工具脚手架清理与 lean 包收束，不改已验证运行 payload。

## R3.9 已完成的轻量化

1. SoilProfile 仍保留 96 个语义声部：48 个 `property × depth`，每个都有 `Q0.5` 与 `uncertainty`；它们不是重复。
2. 物理传输改为 48 个无损双通道 `.s2gz`：`i16le-pair-byte-shuffle-gzip-v1`。解码后逐层 SHA 与原始 96 层一致。
3. R3.8 活动树中已删除被替代的 80 个 5–200 cm 分裂 `.i16le`；R3.7 冻结 0–5 cm 历史版本没有改动。
4. WRB/JRC 保持一个逻辑声部一个 payload，不把 30 个 WRB 概率面粗暴合成一个大文件；传输改为逐层无损 gzip。
5. R3.8 活动树中已删除被替代的 41 个 WRB/JRC 原始 `.u8/.u16le`；永久证据 Release 没有改动。
6. 两批活动载荷合计从 `179,103,704` bytes 降至 `37,995,870` bytes，净减 `141,107,834` bytes，约 `78.79%`，信息损失为 false。
7. 覆盖层 transform contract 已统一：SoilProfile 继承 terrain `position / quaternion / scale` 后再加可审计 visual lift。

## 必须保留的事实

- SoilGrids 250 m 是模型预测外部观察，不是 12.5 m 土壤真值，不替代现场土样，不改变 DEM。
- WRB 官方 `MostProbable` 与概率对齐后的 argmax 同时保留；约 6.1% 差异属于算子顺序差异。
- JRC 长期水体只是历史观察，不能替代当前海陆拓扑、河网或某一天水位。
- DEM、海岸/河流、演示海面、WorldCover、SoilProfile、WRB、JRC、OSM 属于同一世界总谱的不同证据声部。
- R3.1–R3.7 历史运行目录以 `3018da...` 的逐目录 Git tree SHA 冻结核对；永久 Release 不删除、不覆盖。
- 当前压缩运行层依赖浏览器 `DecompressionStream('gzip')`；真实 iPhone 未验证前不能宣称 production ready。

## 接下来只做两件主事

1. 完成 R3.9 lean handoff 的最终构建与 QA：包只带当前代码、状态、语义索引、SHA/恢复指针和可重复 QA；不带 38 MB 当前运行二进制，更不带历史 GB 级底包。
2. 交接闭环后回到小温州画面与世界体验本身：以 R3.9 固定运行态做完整视觉/交互复核，重点继续看山地近景、河流近景、1.600 m 人眼关系、移动阻挡和 390×844；没有明确收益不再新增大型数据声部。

历史大包仍可按固定 commit、Release tag、asset 名、bytes、SHA-256 精确恢复；“不随身携带”不等于删除真值。
