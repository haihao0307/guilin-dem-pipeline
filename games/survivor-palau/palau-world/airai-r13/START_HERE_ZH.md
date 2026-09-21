# Stone Money Island / Airai — R13 继续生产入口

本分支从 `handoff/survivor-palau-stone-money-full-r011-20260921` 的固定提交 `c47f7cc62d864e95117bd5548ca9ffa3f1d770a8` 开始。

## R12 判断修正

R11 包并非“没有地形与水深资产”。它包含 NOAA ENC 岸线／陆地区、1,411 个 SOUNDG 测深点、390 条等深线、388 个 DEPARE 深度区，以及 Allen Coral Atlas 核心矢量。缺失的是报告中引用的 GeoTIFF 栅格二进制，以及两张用户权威图片的原始 JPEG 二进制。

## R13 已完成

- 从冻结矢量重新执行 R02 → R08 → R09 → R10 → R11 证据链。
- 生成 25 m、310 × 310 核心格网；有效候选格 56,874。
- 核心 SOUNDG 392 个；CATZOC B 274 个、D 118 个。
- R09 垂直基准固定为 S-57 code 24 `local datum`；没有换算 MSL。
- R10／R11 不改变深度，只追加语义、DEPARE 支持与不确定度。
- 栅格化 NOAA ENC `LNDARE` 后，陆地区 30,655 格；陆地交叉处不再输出候选水深。
- 新增 `PalauWorld.sample()`、`sampleGeo()`、`sampleCell()` 的证据运行时。
- 保持 Ocean Mother R018 源哈希、海洋着色器和默认参数不变。

## 仍被阻断

- 完整 Palau DEM／权威高程栅格缺失。
- 两张用户权威图片二进制缺失。
- 当前可见 Ocean Mother 小岛仍是校准岛，不是 Stone Money Island 或 Palau 地形真值。
- `local datum` 与海洋运行时零点没有换算模型。
- `visualAcceptance=false`，`productionReady=false`。

先读 `R13_CURRENT_STATE.json`。运行时数据由 `scripts/build_runtime_evidence_r13.py` 从 R11 的冻结矢量与重建格网生成；不得手工补画 NoData、完整 Palau 岛形或黄色故事区域。