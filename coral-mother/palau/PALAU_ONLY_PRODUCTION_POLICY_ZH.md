# Coral Mother｜帕劳限定生产政策 R1

生效日期：2026-09-21

## 唯一生产区域

Coral Mother 从本文件生效后只生产 **Republic of Palau（帕劳共和国）水域已有可靠出现记录的珊瑚**。

NOAA 的 `Hard / stony coral`、`Branching`、`Massive`、`Foliose`、`Encrusting` 等只用于形态分类，**不能证明物种在帕劳出现**。

## 进入生产的硬门槛

一个物种只有同时满足以下条件，才可进入活动生产队列：

1. 有物种级学名；只写 genus、family、`sp.` 或“印度太平洋常见”不通过。
2. 至少一条来源明确记录该物种位于 Palau、Palau Archipelago 或帕劳具体礁区。
3. 来源必须来自 NOAA、PICRC、AIMS、CRRF、同行评议论文或在帕劳执行的正式科学调查机构。
4. 证据状态必须为 `CONFIRMED_PALAU`。
5. 机器总账中的 `palauOnlyProductionEligible` 必须为 `true`。

以下情况一律不得进入活动生产：

- `UNRESOLVED`
- 只有其他国家或地区记录
- 只有通用 Indo-Pacific 分布描述
- 只有图片标题但没有可靠地点或物种鉴定
- 只有 NOAA 形态类别、没有帕劳物种证据
- 为了匹配现有模型而擅自更换物种名

## 区域证据与场景投放的区别

`CONFIRMED_PALAU` 允许物种进入帕劳资产生产库。

它不自动证明该物种适合放在 Airai、Stone Money Island、Rock Islands 某一具体深度或微生境。具体场景投放仍需独立的地点、深度、水流、光照与基底证据；因此：

- `palauOnlyProductionEligible=true`：允许制作资产。
- `localSitePlacementReady=false`：尚不可自动放入具体故事地点。

## 已确认的当前生产线

### Branching

- `Pocillopora damicornis`
- Palau 证据：AIMS Palau 三礁调查数据集明确列出该物种。
- 现有资产：R06-T08。
- 允许保留，但不得再用“通用印度太平洋分布”作为理由。

### Massive

- `Porites lutea`
- Palau 证据：NOAA NCEI `noaa-coral-19702`，Palau Archipelago、Ulong Channel。
- 当前资产：R07-P13，从 P12 几何基线继续。

## 下一批帕劳候选

只有总账中已标记 `CONFIRMED_PALAU` 的物种可以排队：

- Foliose / shingle candidate：`Porites rus`
- Branching / finger candidate：`Porites cylindrica`
- Foliose-encrusting candidate：`Merulina scabricula`
- Branching candidate：`Pocillopora acuta`
- Massive candidate：`Porites lobata`
- Separate blue-coral track：`Heliopora coerulea`
- Palau type-locality branching candidate：`Palauastrea ramosa`

形态映射仍需在每个新资产开工时单独冻结，不得仅凭候选名单自动宣称 NOAA growth form 已完成物种级验证。

## 禁止事项

- 禁止把非帕劳物种塞入帕劳组合。
- 禁止用其他地区的代表性照片冒充帕劳外观真值。
- 禁止因为已有模型好看而降低出现证据门槛。
- 禁止删除失败证据；失败版本保留为诊断，不得恢复为生产默认。
- 禁止把 `localSitePlacementReady=false` 写成已完成生态投放。
