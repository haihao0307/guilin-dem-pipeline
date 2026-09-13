# Water System Branch v0.1

## 中文名称

程序化地貌生产线水体分支

## 目标

本分支统一组织淡水河流、河口混合带、潮间带、近岸海水和外海的真值数据、程序化视觉层、交互接口、网页运行时和验收规则。

它继承桂林 10 km² 精细地表分支中已经验证的永久水体禁入、河岸序列、顺坡排水和世界坐标连续性，同时扩展到温州的海岸、水深、潮汐、岛屿、河口和近岸系统。

## 当前实施边界

本文件是技能合同和执行顺序。

已经有来源或工程基础的内容：

```text
桂林永久水体和活动河岸字段
桂林顺坡侵蚀进入水系的约束
桂林水体内陆生实例为 0 的验证
温州权威 12.5 m 陆地 COG
温州 GEBCO 2026 海底数据生产阶段
温州 FES2022b 潮汐阶段设计
温州沿海数据分层和不可逆修改禁令
```

仍需真实构建和浏览器验收的内容：

```text
完整连续河流速度场
河口盐淡水混合模型
潮间带湿润和干出运行时
风浪和岸边破浪
泡沫体积表达
船只浮力和尾流
跨尺度水面连续细节
季节浑浊度和颜色标定
```

任何未通过数据和浏览器门槛的项目不得标记为完成。

## 水体分类

### 淡水河流

```text
主驱动: 河道几何、坡降、汇流量、流量边界和局部断面
方向: 主要沿下游
视觉: 缓流、急流、回水、浅滩、湿岸和局部泡沫
季节: 水位、流量、泥沙、颜色和湿岸范围可变化
```

### 河口混合带

```text
主驱动: 河流入海、潮位、海岸几何、浅水水深和开边界
方向: 涨潮、落潮和径流共同作用
视觉: 浑浊锋、盐淡水综合色带、泥沙带、潮沟和滩涂
季节: 洪水、枯水、冬季浑浊和夏季外海水团状态可变化
```

### 潮间带与近岸海水

```text
主驱动: 潮位、浅水水深、岸坡、风场和近岸流
视觉: 湿润、干出、浪花、岸边泡沫、浅水综合色和泥沙再悬浮
约束: 岛屿、海岸线和河口开口必须连续
```

### 外海

```text
主驱动: 风场、长波、潮汐边界、洋流或批准的外海状态
视觉: 主波、次波、细波、反射、雾化和远景综合色
约束: 外海视觉波面不得改变潮位真值
```

## 真值与视觉分离

```text
water_geometry_truth
批准的河道、水面、海岸、岛屿、潮间带和海洋范围

bed_elevation_truth_m
批准的河床、近岸水深或海底高程

water_level_truth_m
水位、潮汐或边界条件

flow_truth_or_model_xy
来自观测、可追溯模型或批准估算的水平流动

water_visual_delta_m
程序化细浪、波面和交互扰动

water_surface_visual_m
water_level_truth_m 加批准的 water_visual_delta_m
```

视觉层只能改变显示结果。它不得改写海底、河床、陆地 DEM、水位真值、潮汐序列或中心线。

## 六层水体结构

### 第一层，几何与基准

最低字段：

```text
water_class
permanent_water_mask
active_channel_mask
coastline
island_mask
estuary_mask
intertidal_mask
nearshore_mask
offshore_mask
bed_elevation_truth_m
water_level_truth_m
shoreline_distance_m
channel_centerline_distance_m
```

几何优先级：

```text
官方或项目批准矢量
真实 DEM 和水深关系
历史重建矢量
人工校核修复
受限程序化支沟候选
```

程序化几何只能在批准汇水区、河口区或海洋父级掩膜内工作。

### 第二层，主运动

最低字段：

```text
flow_direction_xy
flow_speed_mps
flow_accumulation
tidal_phase
tidal_level_m
current_vector_xy
wind_vector_xy
wave_direction_xy
wave_energy
```

规则：

```text
河流主方向服从下游和断面关系
涨落潮允许河口和潮沟局部反向
中心线和海岸几何保持固定
流动参数变化不得拉伸或移动河流几何
来源不足时输出 unknown 或 unverified，不填造数值
```

### 第三层，波形

波形分为：

```text
长波
中尺度风浪
短波
交叉波
岸边反射或破碎波
河面细波纹
船体或物体局部扰动
```

所有波形都写入 `water_visual_delta_m`、法线、视差和材质响应。波面振幅必须有机器可读上限，并可回退为 0。

淡水缓流默认降低长波和破浪强度。急滩、跌坎、狭窄断面和强风条件可以提高局部波纹和泡沫触发。

### 第四层，泡沫与破碎

泡沫触发来源：

```text
波陡度
浅水和岸坡
岸线碰撞
急流和跌坎
汇流冲撞
回水旋涡
船尾和物体扰动
```

泡沫分层：

```text
远景泡沫综合色和覆盖率
中景泡沫带、卷边和视差体积
近景预算内泡沫几何、粒子和岸线接触细节
```

泡沫不得在静止深水中无条件铺满，也不得穿过陆地或在瓦片边界重启相位。

### 第五层，颜色与浑浊

最低字段：

```text
water_depth_factor
turbidity
sediment_load
river_freshwater_fraction
estuary_mixing_factor
nearshore_suspension
sky_reflection_factor
season_state
storm_state
historical_epoch
```

推荐状态接口：

```text
normal
flood_or_typhoon
winter_turbid
summer_blue_water_intrusion
historical_low_saturation
analysis_grayscale
```

这些状态是运行时和调色接口。正式数值和空间范围必须由项目数据标定。未经标定时只能显示为视觉候选状态。

### 第六层，交互

接口：

```text
buoyancy_probe
wake_probe
shore_contact
splash_trigger
object_drag
wetness_transfer
foam_injection
interaction_budget
```

浮力探针读取 `water_surface_visual_m`、局部法线和批准流速。尾流探针写入独立短寿命扰动场，不能修改固定河道、海岸、水位和水深。

当前技能只冻结接口。船只物理需要独立测试后才能进入生产状态。

## 河岸与潮间带接口

陆地分支与水体分支共享：

```text
active_bank_mask
bare_bank_mask
wet_margin_mask
riverbank_habitat_mask
intertidal_wet_mask
intertidal_dry_mask
shore_contact_mask
sediment_deposition_mask
bank_scour_mask
```

默认陆地过渡：

```text
水体
活动或裸露河岸
湿润边缘
河岸灌木
河岸乔木或竹类
外侧阶地、农田、道路或聚落
```

默认海岸过渡：

```text
海水
破浪或湿润岸线
潮间带
海滩、泥滩、岩岸或人工岸线
近岸陆地父级掩膜
```

道路、码头、堤防、村庄、农田入口、灌排口和岩壁可以中断自然序列。

## 水系中心线和宽度

固定中心线合同：

```text
中心线坐标不变
中心线 SHA-256 不变
总长度不变
线段数和顶点数不变
端点、分叉点和汇流拓扑不变
河宽只改变左右法向偏移
```

河宽变化不得缩放、平移、旋转、拉伸、截短、平滑、重采样或替换中心线。

## 季节、天气和历史年代

季节和天气可以改变：

```text
水位和潮位状态
流量边界
浑浊度
泥沙综合色
湿岸和潮间带状态
波浪和泡沫预算
雾和反射
```

季节和天气不得移动稳定河道、海岸、岛屿、道路或建筑。

历史年代与季节保持独立：

```text
epoch
season
weather
hydrologic_event
```

## 桂林绑定

桂林 10 km² 分支当前可使用：

```text
永久水体
活动河岸
水距
顺坡流向
汇流量
侵蚀进入水系
河岸生态序列
水体硬禁入
```

在真实 12.5 米 DEM 和正式水系矢量挂载前，水面和河岸仍属于方法验证层。

## 温州绑定

当前执行工程：

```text
repository: haihao0307/guilin-dem-pipeline
branch: project/wenzhou-v100-bathymetry-tides-hydrology
Draft PR: 49
```

固定陆地真值：

```text
path:
projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif
SHA-256:
8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e
bytes: 54638031
CRS: EPSG:32651
grid: 11866 × 11866
spacing: 12.5 m
```

温州项目的数据层保持独立：

```text
GEBCO 2026 水深和类型标识
FES2022b 潮汐
后续独立对照潮汐产品
海岸、岛屿、河口和河流中心线
湿润和干出
河流流量边界
浏览器运行时
```

GEBCO 和潮汐输出不得覆盖陆地 COG。水深垂直基准和陆地垂直基准没有完成归一化时，界面必须显示不确定性和发布锁。

## 运行时细节调度

```text
远景
水体分类、总体色带、主波、潮位和岸线

中景
河面流纹、浑浊锋、岸线泡沫、湿岸、视差波面和浅水综合色

近景
预算内波面几何、泡沫几何、粒子、水岸细节、浮力和尾流
```

相位使用世界坐标。流动纹理沿批准的流向场推进。河口和海岸切换必须连续。

## QA

### 数据 QA

```text
陆地 DEM 校验和不变
水深、河床和水位来源可追溯
CRS、transform、垂直基准和单位明确
海岸、岛屿和河口连续
河流顺坡并进入批准出口
中心线宽度不变量通过
NoData、海陆冲突和垂直基准差异有报告
```

### 视觉 QA

```text
水体不穿陆地
水面不悬空
岸线无明显裂缝
泡沫只在批准触发区
流纹方向与流向一致
潮间带湿润和干出关系可解释
近中远过渡无突跳
颜色状态保持河流、河口、近岸和外海层次
```

### 交互 QA

```text
浮力探针连续
尾流有寿命和预算
交互不会改写真值
船只不会在岸上获得水面浮力
浏览器控制台错误为 0
桌面和移动回归通过
```

## 发布门槛

水体候选只有同时具备以下证据才能进入视觉审批：

```text
来源和许可
输入与输出校验和
完整字段 manifest
数据 QA
水位或潮汐 QA
中心线不变量 QA
桌面和移动截图
控制台结果
性能报告
剩余不确定性
回滚版本
```

## 状态

```text
branch skill version: 0.1.0
status: contract-and-implementation-sequence
Guilin role: inland reference integration
Wenzhou role: active coastal implementation binding
hydrodynamic completion: not claimed
boat physics completion: not claimed
publication: Draft only until real QA and visual approval
```
