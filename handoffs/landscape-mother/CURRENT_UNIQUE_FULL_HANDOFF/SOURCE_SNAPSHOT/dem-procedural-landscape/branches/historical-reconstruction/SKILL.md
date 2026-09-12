# Historical Reconstruction Branch v0.2

## 中文名称

程序化地貌生产线历史重建分支

## 目标

本分支面向 1940 至 1945 年历史场景，把真实基础 DEM 与历史航拍、历史地图、机场资料、河道、道路、田块、聚落和土地利用证据组合为可审计、可回滚的历史增强地形。

## 核心范围

当前历史项目的详细核心区默认目标为 48 km²。项目配置可以冻结其他面积。桂林 10 km² 原型继续作为方法参考。

## 输入

```text
approved base DEM
higher resolution DEM where licensed and verified
historical aerial photographs
historical maps
airport plans and photographs
historical rivers and drainage
historical roads and tracks
settlement footprints
paddy, dryland, orchard and vegetation evidence
coastline and tidal evidence where applicable
modern data used only as declared reference
```

现代真实数据可以辅助定位。历史目标、年代差异和不确定性必须显式记录。

## 输出网格和标签

基础 DEM 可以重采样到 1 m 输出网格。历史证据和程序化方法提供局部高程、地表和土地利用增量。

正式标签：

```text
1米历史增强地形
1米历史重建地形
native1mSurveyClaim=false
```

输出说明需要同时列出基础 DEM 的真实来源分辨率。

## 分层模型

```text
z_truth_m
批准基础 DEM

z_base_resampled_m
基础 DEM 在 1 m 输出网格上的重采样结果

z_historical_delta_m
历史道路、机场、旧河道、田块、堤岸、聚落整平和其他证据约束增量

z_micro_delta_m
侵蚀、田埂、地表细节和材质响应的可逆增量

z_visual_m
浏览器和引擎显示高程
```

每层独立保存。任意历史候选都可以回退而不改变基础 DEM。

## 证据等级

每个历史要素或增量记录：

```text
feature ID
epoch
source
source date
source type
georeferencing method
horizontal uncertainty
vertical uncertainty
confidence
review status
spatial mask
maximum delta
author
approval
rollback
```

建议置信度：

```text
A
多源一致且位置清楚

B
单一可靠来源或多源部分一致

C
间接证据支持的受限重建

D
程序化候选，仅供视觉比较

unknown
没有足够证据
```

D 和 `unknown` 不得进入批准历史真值层。

## 机场、道路和聚落

机场跑道、滑行道、停机坪、排水沟和防护区优先使用历史规划、照片和地形关系。道路和聚落需要与历史年代一致。现代道路、现代整平和现代填海不得静默进入历史输出。

## 历史水系和田块

旧河道、灌溉渠、田埂和田间路径按历史证据重建。水系必须与基础坡势和批准出口协调。田块只在批准的历史农业父级掩膜内细分。

## QA

```text
基础 DEM 校验和不变
1 m 输出标签完整
native1mSurveyClaim=false
历史增量与程序化增量分层
每个批准要素有来源和置信度
现代要素误入报告为 0
机场、道路、河道和聚落拓扑可解释
水系顺坡并进入批准出口
田块、田埂和灌排关系可解释
所有增量可回退
浏览器提供真值、历史增量和最终结果对照
```

## 发布

历史候选需要：

```text
全域俯视
地面镜头
机场和聚落特写
历史河道和田块诊断
证据与不确定性图
基础 DEM 与历史增强 A/B
桌面和移动浏览器证据
本地包
在线候选
回滚入口
用户视觉批准
```

## 状态

```text
branch skill version: 0.2.0
status: contract
target epoch: 1940-1945
```
