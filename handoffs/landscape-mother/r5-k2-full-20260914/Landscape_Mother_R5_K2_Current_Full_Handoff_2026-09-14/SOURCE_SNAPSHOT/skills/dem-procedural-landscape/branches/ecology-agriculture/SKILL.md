# Ecology Agriculture Branch v0.2

## 中文名称

程序化地貌生产线生态与农业分支

## 上游

```text
parent skill: dem-ecology-surface v0.5
ref: skill/dem-ecology-surface-v050
commit: de4ae8c75696ddc9225945e88941651e9deea3e9
retained: true
```

本分支将父级生态地表规则接入完整地貌生产顺序。父级文件继续保存植物、农业、风场、季节、Parallax Strand Surface 和稳定实例的详细合同。

## 执行顺序

```text
真值和历史源接入
地形导数
水体、河岸和河距
地貌单元
硬禁入
历史土地利用
森林与开阔地父分区
草地、农田、果园、竹林和聚落边缘子分区
田块、行列、田埂、路径和灌排切口
冠层微高度和地表纤维
稳定实例
风、季节和天气状态
运行时编译
QA 和回滚
```

## 父级掩膜

程序字段只在批准父级掩膜内工作。

```text
forest_parent_mask
open_land_parent_mask
arable_parent_mask
orchard_parent_mask
grass_parent_mask
bamboo_parent_mask
riparian_habitat_mask
settlement_edge_mask
```

随机性只控制已经通过适宜性和历史约束的个体变化。

## 硬禁入

```text
permanent water
active channel
active bank core
road core
building footprint
airport protection area
strong rock core
near vertical cliff
```

野生木本植物不得进入作物内部和果园内部。稻田不得进入山脊、山峰、崖壁、裸岩核心、道路、建筑、机场和不可灌溉高阶地。

## 森林、竹林和河岸

远、中、近使用同一稳定来源。

```text
远景
森林父级掩膜、综合色、冠层高度和总体物种混合

中景
三层偏移冠层、冠形响应、树干提示、灌木边缘和视差体积

近景
预算内树干、枝叶、冠团、灌木和竹丛
```

默认河岸序列：

```text
永久水体
裸露或活动河岸
河岸灌木
河岸乔木
凤尾竹
毛竹或冲积阶地植被
```

道路、村庄、田间入口、堤岸、灌溉切口和受扰河岸可以中断该序列。

## 农业和田块

```text
可耕地父级掩膜
稳定田块 ID
田块局部方向
行列波形
田埂边缘距离
灌排切口
道路和田间入口切口
作物或果树稳定实例
```

稻田优先位于平坦谷底、洪泛平原、冲积阶地和可灌溉低坡阶地。菜地靠近聚落、道路和水源。旱地位于排水较好的阶地和坡脚。果园位于排水良好的坡脚和低阶地。

## 1940 至 1945 年约束

历史年代、季节、天气和水文事件分开记录：

```text
epoch
season
weather
hydrologic_event
```

历史土地利用需要证据等级。缺少历史证据的区域只能进入低置信候选或保持未决状态。

## 稳定实例

每个实例至少记录：

```text
stable ID
prototype ID
project coordinates
parent mask
landform
historical status
exclusion checks
scale
orientation
palette
wind phase
season state
LOD group
```

大规模运行时使用紧凑二进制实例流和原型表。大型逐实例 JSON 只用于诊断抽样。

## QA

```text
永久水体内陆生实例为 0
活动河岸核心内不兼容实例为 0
强裸岩核心内大树和密灌木为 0
农田硬禁入冲突为 0
田块和行列跨瓦片连续
稳定种子重建一致
近中远无明显突跳
风场相位连续
历史证据状态可追溯
浏览器控制台错误为 0
```

## 状态

```text
branch skill version: 0.2.0
status: promoted-contract
parent retained: true
```
