# Guilin 10 km² Detail Branch v0.1

## 中文名称

桂林 10 平方公里精细地表参考分支

## 角色

本分支把桂林秧塘 10 km² 生态地表原型中已经验证的程序化方法，整理为“程序化地貌生产线”的精细地表参考实现。

它负责证明小范围内的地貌、水岸、侵蚀、裸岩、生态、农业、田块和稳定实例能够在同一套字段中共同工作。

## 权威来源

```text
source ref: integration/ecology-v040
project: guilin-yangtang
release version: 0.3.1
manifest:
DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.3.1/ecology-release-manifest.json
single-file review:
桂林10平方公里生态地表演示_单文件.html
```

网页参考入口：

```text
https://guilin-dem-terrain.sunhaihao.chatgpt.site
https://guilin-dem-terrain.sunhaihao.chatgpt.site/guilin/gaea-proof
```

这些入口是视觉和交互参考。发布状态必须重新验证，不能由链接存在推定在线验收通过。

## AOI 合同

```text
area: 10.0 km²
shape: square
side: 3162.2776601683795 m
CRS: EPSG:32649
center projected: 415018.03522667295, 2789215.965156763
anchor WGS84: 110.156375, 25.216758
```

## 地形真实性状态

当前 v0.3.1 manifest 明确记录：

```text
terrain grid: 257
source label: 桂林秧塘工程坐标约束地形代理，等待12.5米真实DEM替换
source status: deterministic-ecology-proof-awaiting-real-12.5m-dem
native survey claim: false
exact raster mounted: false
```

因此本分支只能转移方法、字段、约束、稳定实例和视觉基线。代理高程不得被传播成真实 12.5 米 DEM，也不得成为其他城市的地形源。

## 已验证的参考规模

v0.3.1 manifest 记录：

```text
trees, bamboo and orchard trees: 23685
shrubs: 7322
rice clusters: 5277
species archetypes: 20
land-use classes: 9
bamboo instances: 2152 in release summary
crop palette classes: 8
erosion streamlines: 68
visible rock fraction: 0.041324615478515625
strong rock fraction: 0.0279541015625
field bund fraction: 0.08198165893554688
permanent-channel terrestrial vegetation: 0
```

manifest 的 validation 区另记录竹类实例为 2256。两个计数来源需要在下一次重建时统一解释，当前不得静默选择其中一个作为唯一事实。

## 核心方法

### 水体硬禁入

在实例编译前完成永久河道禁入：

```text
trees in permanent channel: 0
shrubs in permanent channel: 0
rice in permanent channel: 0
```

所有陆生实例必须保留通过水体、河岸、裸岩、道路、建筑、机场和农田冲突检查的证据。

### 顺坡侵蚀沟

参考实现包含 68 条曲线侵蚀沟。后续正式实现必须满足：

```text
顺坡
进入永久水体或批准排水通道
不跨山脊
不逆坡
不形成封闭装饰线
侵蚀增量写入可逆 z_micro_delta_m
```

v0.3.1 中附加侵蚀切沟最大值记录为 8.629077911376953 m。迁移到真实 DEM 时需要根据真实坡度、尺度和历史状态重新标定，不能直接复制数值。

### 喀斯特裸岩

参考字段组合：

```text
坡度
相对高程
凸度和曲率
坡向
石灰岩层理方向
多尺度噪波
```

强裸岩核心排除大树和密灌木。视觉上禁止蜂窝重复、鱼鳞重复和完整等高环。

### 森林和冠层

参考方法使用三个偏移的世界坐标 cellular 或 Voronoi 冠层层，形成远中景冠层体积，再在近景展开对应的稳定树干、冠团、叶团、灌木和竹丛。

三层冠场相位不得在瓦片边界重启。

### 农业和田块

程序顺序：

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

稻田默认允许于平坦谷底、洪泛平原、冲积阶地和可灌溉低坡阶地。它必须避开山脊、山峰、崖壁、裸岩核心、道路、建筑、机场和永久水体。

### 竹林和河岸序列

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

### 稳定综合色和作物状态

至少保留：

```text
普通叶绿
蓝绿色
黄绿色
水田或插秧状态
幼苗稻
分蘖稻
抽穗稻
成熟稻
收割稻
稻茬
休耕
菜地
旱作
果园林下
```

田块、行列、缺行、缺株、原型和色谱均需要稳定 ID。

## 可转移内容

允许转移到其他城市：

```text
生产顺序
父级掩膜原则
水体和硬禁入
世界坐标连续字段
稳定实例 ID
三层冠层方法
田块、田埂和行列方法
顺坡侵蚀约束
裸岩核心排除
近中远连续表达
QA 和回滚合同
```

禁止直接转移：

```text
桂林坐标和 AOI
代理高程
桂林河流几何
桂林喀斯特强度参数
桂林物种和作物分布
1944 年田块位置
实例数量
侵蚀深度数值
颜色和季节数值
```

## 与水体分支的接口

本分支提供：

```text
permanent_water_mask
active_channel_mask
active_bank_mask
distance_to_water_m
flow_direction_xy
flow_accumulation
riverbank_habitat_mask
hard_exclusion_mask
z_truth_m
z_micro_delta_m
z_visual_m
```

水体分支返回：

```text
water_surface_visual_m
flow_velocity_xy
turbidity
foam_mask
wet_margin_mask
shore_contact_mask
water_interaction_budget
```

陆地实例编译始终在水体分支输出稳定后执行。

## 验收

```text
AOI 精确为 10 km²
来源状态标签完整
真值 DEM 与代理高程不会混淆
永久水体内陆生实例为 0
强裸岩核心内大树和密灌木为 0
农田硬禁入冲突为 0
侵蚀沟顺坡并进入水系
字段跨边界连续
稳定种子重建一致
浏览器控制台错误为 0
原 v0.3.1 页面保留为视觉回归入口
```

## 状态

```text
branch skill version: 0.1.0
source release: guilin ecology v0.3.1
role: reference implementation
real 12.5 m DEM replacement: required before geographic production approval
```
