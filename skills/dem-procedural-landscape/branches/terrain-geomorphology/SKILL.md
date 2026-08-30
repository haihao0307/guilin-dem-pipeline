# Terrain Geomorphology Branch v0.2

## 中文名称

程序化地貌生产线地形与地貌分支

## 目标

本分支负责从批准的真实 DEM 和项目源数据生成地形导数、地貌分类、侵蚀、岩石、阶地、坡脚、河岸和其他可逆微地形。所有输出保持来源可追溯，并与真值高程分层。

## 输入合同

```text
z_truth_m
AOI
CRS
transform
pixel origin
vertical datum
NoData
coverage mask
permanent water
approved hydrology
coastline where applicable
roads
buildings
settlements
airports
historical constraints
geology or lithology where available
```

输入缺失时保留阻塞状态。禁止以装饰性程序结果替代缺失真值。

## 导数

至少生成：

```text
slope
aspect
profile curvature
plan curvature
mean curvature
relative elevation
local relief
topographic position
flow direction
flow accumulation
wetness
distance to water
distance to ridge
distance to road
distance to settlement
```

每个导数记录算法、窗口尺度、边界策略、单位、NoData、输入校验和和输出校验和。

## 地貌单元

至少区分：

```text
permanent water
active bank
bare or disturbed bank
floodplain
alluvial terrace
footslope
mid-slope
ridge or peak
karst or bedrock cliff
high plateau or shoulder
artificial agricultural terrace
airport or engineered flat
```

分类需要输出置信度和主要判据。天然肩地缺少历史农业证据时保留为岩石、草地、耐旱灌木或疏林候选。

## 侵蚀

侵蚀沟必须：

```text
位于批准汇水区
沿真实坡势下降
进入永久水体或批准排水通道
不跨山脊
不逆坡
不形成封闭装饰线
增量写入 z_micro_delta_m
```

侵蚀深度、宽度和支沟密度按项目尺度和真实地貌标定。桂林参考实现的数值只能作为回归线索。

## 岩石与崖壁

岩石暴露可以使用：

```text
坡度
相对高程
凸度和曲率
坡向
地质或岩性
层理方向
多尺度连续字段
历史扰动
```

强裸岩核心排除大树、密灌木和农业。视觉图案避免蜂窝重复、鱼鳞重复、完整等高环和规则条纹。

## 阶地、田埂和工程地形

```text
历史或真实阶地
历史道路切坡
机场整平
堤岸
田埂
灌排切口
坡脚沉积
```

这些输出分别写入历史增量或微地形增量。机场、道路和堤岸需要真实或历史证据支持。

## GAEA 转译合同

字段图结构、种子隔离、综合色彩、WebGPU 映射和字段级 QA 先遵循：

```text
skills/dem-procedural-landscape/branches/gaea-terrain-field-graph/SKILL.md
```

GAEA 可以执行：

```text
导数复核
顺坡侵蚀候选
沉积候选
岩石和裂隙响应
坡脚和阶地响应
材质、粗糙度、法线和位移候选
```

GAEA 不改写权威 COG。每个节点图记录：

```text
graph version
input manifest
input checksum
node parameters
seed
output layer
units
valid range
maximum delta
resolution
resampling method
rollback value
```

垂直比例保持 1:1。最终地形真值验收读取原始 COG。

## 输出

```text
terrain-derivatives manifest
landform classification
landform confidence
hard exclusion masks
erosion candidate mask
erosion delta
sediment candidate mask
rock exposure mask
strong rock core
terrace and bund deltas
material response layers
GAEA graph receipt
QA report
rollback manifest
```

## QA

```text
z_truth_m 像元修改数为 0
输入与输出 CRS 和 transform 一致
NoData 没有被静默填充
侵蚀顺坡并进入批准出口
强裸岩与大树、密灌木、农田重叠为 0
程序化增量可以全部回退到 0
跨瓦片导数和噪波连续
地面相机无悬空和穿地
浏览器控制台错误为 0
```

## 状态

```text
branch skill version: 0.2.0
status: contract
production data: project specific
```
