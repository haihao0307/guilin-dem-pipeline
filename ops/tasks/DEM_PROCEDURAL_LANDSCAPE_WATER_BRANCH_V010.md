# 程序化地貌生产线水体分支 v0.1 执行任务

## 工作目标

把“程序化地貌生产线”技能正式接入桂林 10 km² 精细地表参考和温州沿海工程。桂林负责提供已验证的小范围精细地表方法与视觉回归，水体作为独立子分支继续建设河流、河口、潮间带、近岸和外海。

## 权威技能来源

```text
repository: haihao0307/guilin-dem-pipeline
skill branch: skill/dem-procedural-landscape-v010
parent skill ref: skill/dem-ecology-surface-v050
parent commit: de4ae8c75696ddc9225945e88941651e9deea3e9
```

开始时读取：

```text
skills/dem-procedural-landscape/SKILL.md
skills/dem-procedural-landscape/BRANCH_REGISTRY.json
skills/dem-procedural-landscape/branches/guilin-10km2-detail/SKILL.md
skills/dem-procedural-landscape/branches/water-system/SKILL.md
projects/guilin/config/procedural_landscape_binding_v010.json
projects/wenzhou/config/procedural_landscape_water_binding_v010.json
```

## 分支政策

技能合同只在：

```text
skill/dem-procedural-landscape-v010
```

继续维护。

温州实现继续在现有：

```text
project/wenzhou-v100-bathymetry-tides-hydrology
Draft PR #49
```

工作。

保持 PR #49 为 open、Draft、未合并。禁止强推、改写历史、修改 `main`、`gh-pages`、PR #42、PR #45、PR #46，以及权威陆地 COG。

开始时重新确认远端 PR #49 head。若 head 已变化，从最新远端 head 建立干净工作树并正常快进。

## 冻结的陆地真值

```text
path:
projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif

SHA-256:
8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e

bytes:
54638031

CRS:
EPSG:32651

grid:
11866 × 11866

spacing:
12.5 m
```

任何水深、潮汐、河流、水面、波浪、泡沫和交互输出都必须作为独立层保存。陆地真值文件、像元值、transform、尺寸和校验和不得改变。

## 第一阶段，接入技能合同

1. 将 `skills/dem-procedural-landscape/` 的批准版本引入温州实现分支，保留来源 ref、commit 和校验和。
2. 将 `projects/wenzhou/config/procedural_landscape_water_binding_v010.json` 引入温州项目。
3. 不复制桂林代理高程、桂林坐标、桂林水系、桂林实例数量和桂林历史田块位置。
4. 只迁移桂林分支中的方法：父级掩膜、硬禁入、世界坐标连续字段、稳定 ID、河岸序列、顺坡侵蚀、近中远连续表达和 QA 合同。
5. 输出机器可读迁移报告，逐项记录“迁移、适配、排除、原因、来源”。

## 第二阶段，建立水体字段合同

在温州项目下建立版本化水体字段 manifest。至少包含：

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
flow_direction_xy
flow_speed_mps
tidal_phase
tidal_level_m
current_vector_xy
wind_vector_xy
wave_direction_xy
wave_energy
turbidity
sediment_load
foam_mask
wet_margin_mask
shore_contact_mask
water_visual_delta_m
water_surface_visual_m
```

每个字段必须记录：

```text
source
source version
CRS
transform
grid or vector geometry
units
NoData
valid range
checksum
quality status
vertical datum
parent mask
reversibility
runtime role
```

来源不足的字段标记为 `unverified`、`unknown` 或 `planned`。禁止填造数值以通过 schema。

## 第三阶段，河流、河口和海洋分层

### 河流

1. 主河道使用批准矢量和真实 DEM 排水关系。
2. 中心线坐标冻结，河宽只改变左右法向偏移。
3. 流向必须顺坡并进入批准出口。
4. 河道、活动河岸和永久水体内陆生植被为 0。

### 河口

1. 明确河流、河口混合、潮间带和近岸四类父级掩膜。
2. 涨潮和落潮允许局部方向变化，固定河道和海岸几何保持不变。
3. 浑浊锋和综合色只在批准河口混合区内工作。
4. 垂直基准尚未归一时保留不确定性图层和发布锁。

### 潮间带和近岸

1. 湿润和干出由水位、潮汐、浅水水深和岸坡关系控制。
2. 岛屿和岸线保持连续。
3. 海水不得越过未经解释的陆地边界。
4. 近岸水深和陆地 COG 分开保存。

### 外海

1. 远景主波和综合色服从批准的海洋父级掩膜。
2. 视觉波面写入 `water_visual_delta_m`。
3. 视觉波面不得修改潮位真值或海底高程。

## 第四阶段，波形、泡沫和颜色候选

本阶段先制作可回滚的视觉候选，不宣告水动力完成。

最低实现：

```text
河面细波纹
近岸主波和次波
岸边泡沫带
急流或汇流泡沫触发
河口浑浊综合色
普通状态
洪水或台风状态
冬季浑浊状态
夏季外海蓝水进入候选状态
历史低饱和状态
灰度分析状态
```

要求：

1. 所有波形和泡沫使用世界坐标或稳定流向坐标。
2. 泡沫只在浅水、岸线、急流、汇流、波陡度或交互触发区出现。
3. 每个视觉增量有机器可读上限，并能完全回退为 0。
4. 未完成数据标定的季节状态明确写成视觉候选。

## 第五阶段，浮力和尾流接口

只冻结接口并制作最小测试。不要提前宣告船只物理完成。

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

测试要求：

1. 浮力探针只在批准水体掩膜内返回水面。
2. 岸上对象不得获得水面浮力。
3. 尾流具有寿命、空间范围和性能预算。
4. 尾流不会改写中心线、海岸、水位、海底和陆地真值。

## 第六阶段，桂林 10 km² 回归适配

建立一个轻量适配器，让原桂林 10 km² 页面能够读取水体分支的统一接口，同时保留原 v0.3.1 回滚。

必须保持：

```text
10.0 km² AOI
原来源状态标签
永久水体内陆生实例为 0
68 条侵蚀沟的参考回归入口
原树木、灌木、稻株、竹类、农田和裸岩视觉基线
```

禁止把代理高程改写成真实 12.5 米 DEM。竹类实例 2152 与 2256 的两个记录需要在重建报告中解释。

## 浏览器界面

水体分支最小界面：

```text
水体分类诊断
河流、河口、潮间带、近岸、外海开关
水位和潮汐状态
流向诊断
波形强度
泡沫诊断
浑浊和泥沙诊断
季节和天气候选
真值与视觉增量对照
数据来源和不确定性
版本和回滚
```

垂直夸张和装饰性假河流不得进入水体审核页面。

## QA 门槛

### 真值

```text
陆地 COG SHA-256 不变
陆地像元修改数为 0
水深和潮汐层独立
CRS、transform、单位和垂直基准可追溯
```

### 几何和流动

```text
海岸和岛屿连续
河流顺坡
主河道进入批准出口
中心线宽度不变量通过
水体不穿陆地
水面不悬空
```

### 生态和地表

```text
永久水体内陆生实例为 0
活动河岸核心内不兼容实例为 0
湿岸和河岸植被序列可解释
```

### 视觉和浏览器

```text
泡沫只在批准触发区
流纹方向与流向一致
近中远过渡无突跳
桌面浏览器控制台错误为 0
390 × 844 移动视口通过
真实截图和帧级证据齐全
```

### 性能

分别报告：

```text
水体网格或瓦片数
波形材质成本
泡沫几何和粒子数量
浮力探针数量
尾流探针数量
GPU 时间
内存
网络读取量
FPS 采样窗口
```

## 交付

技能分支交付：

```text
skills/dem-procedural-landscape/
projects/guilin/config/procedural_landscape_binding_v010.json
projects/wenzhou/config/procedural_landscape_water_binding_v010.json
```

温州实现分支后续交付：

```text
技能迁移报告
水体字段 manifest
字段和数据 QA
河流、河口、潮间带、近岸和外海诊断
水体浏览器候选
桂林 10 km² 回归适配器
桌面和移动证据
性能报告
本地包
回滚说明
剩余阻塞
```

保持所有 PR 为 Draft，等待真实数据 QA 和用户视觉批准。
