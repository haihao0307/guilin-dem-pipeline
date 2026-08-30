# 通用适配指南

## 1. 测量结果可视化

### 输入

1. 点云或网格
2. 距离误差
3. 法向差异
4. 曲率
5. 置信度
6. 区域标签

### 字段映射

```text
distanceError → warm and cool color
confidence → saturation and opacity
curvature → edge highlight
normalDifference → roughness or normal debug
regionLabel → material weight
```

### 规则

原始测量值保持只读。

程序化处理只影响显示字段。

## 2. 地形

### 输入

1. 高程
2. 坡度
3. 曲率
4. 水文
5. 地质
6. 土地覆盖

### 字段映射

```text
slope → exposed surface
curvature → ridge and cavity
flow → moisture and erosion
geology → structure and color family
landCover → material weight
```

主要地貌由事实数据决定。

程序化系统负责可控增量和视觉细节。

## 3. 建筑表面

### 输入

1. 基础几何
2. 材料区域
3. 暴露方向
4. 水流方向
5. 使用痕迹
6. 年代与维护状态

### 字段映射

```text
exposure → fading and roughness
runoff → wetness and deposit
contact → wear
edgeCurvature → chipping
materialRegion → palette and structure
```

## 4. 木材

### 输入

1. 轴向
2. 年轮方向
3. 节疤位置
4. 湿度
5. 切割面类型

### 字段映射

```text
axis → directional warp
growth rings → layered field
knots → cellular anchors
moisture → darkening and roughness
cut face → normal and color response
```

## 5. 金属与涂层

### 输入

1. 底材
2. 涂层厚度
3. 划伤
4. 氧化
5. 水痕
6. 热影响

### 字段映射

```text
coating loss → separation mask
scratch → directional damage
oxidation → color and roughness
heat → broad color field
wetness → darkening and gloss
```

## 6. 生物表面与纤维材料

### 输入

1. 纤维方向
2. 密度
3. 湿度
4. 组织层
5. 缺失区域

### 字段映射

```text
fiber direction → directional structure
density → opacity and roughness
layer → color family
missing region → cavity and AO
moisture → color and gloss
```

## 7. 适配步骤

1. 锁定 Source Field
2. 定义 Parent Mask
3. 设定 Macro、Meso、Micro 尺度
4. 建立独立种子
5. 建立 Data Field
6. 配置颜色映射
7. 绑定多通道输出
8. 输出诊断图
9. 完成确定性测试
10. 再进行视觉校准
