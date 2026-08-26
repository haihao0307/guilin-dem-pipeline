# DEM Procedural Landscape Production Skill v0.2

## 中文名称

程序化地貌生产线

## 负责人

```text
总控代号: 小王
仓库: haihao0307/guilin-dem-pipeline
技能分支: skill/dem-procedural-landscape-v010
Draft PR: 51
```

小王负责研究、总体设计、任务拆分、Codex 调度、结果审查、版本管理、回滚和验收入口整理。用户保留最终视觉批准权。GitHub 保存合同、数据谱系、任务、提交和验收证据。Codex 只执行已经冻结的任务合同，完成声明必须附真实数据、测试和浏览器证据。

详细治理规则见：

```text
skills/dem-procedural-landscape/PRODUCTION_DOCTRINE.md
```

## 目标

本技能把真实 DEM、真实或历史重建水系、地形导数、地貌单元、侵蚀、岩石、水体、生态、农业、历史重建、季节状态、GAEA 处理和网页运行时组织成一条可复用、可审计、可回滚的生产线。

城市项目可以共享方法、字段合同、测试和运行时。城市坐标、DEM、水系、道路、聚落、机场、历史土地利用、物种、作物、潮汐和海底数据必须保持项目隔离。

## 权威优先级

```text
01 经过校验的真实 DEM、海底高程和测量数据
02 批准的真实水系、海岸、道路、建筑、聚落和机场矢量
03 历史航拍、历史地图、档案和可追溯的历史重建
04 项目内经过审查的人工修复
05 仅在批准父级掩膜内工作的程序化细分
06 材质、法线、视差、波面、泡沫和粒子等视觉增量
```

低优先级层不得覆盖高优先级层。来源不足时保留 `unknown`、`unverified`、`planned` 或发布锁。

## 当前正式结构

### 参考实现

```text
branches/guilin-10km2-detail
桂林 10 km² 精细地表参考实现
```

该分支保留方法和视觉回归。其代理高程状态不传播为真实 12.5 m DEM。

### 正式生产分支

```text
branches/terrain-geomorphology
地形导数、地貌分类、侵蚀、岩石和可逆微地形

branches/water-system
河流、河口、潮间带、近岸和外海

branches/ecology-agriculture
森林、竹林、灌木、草地、农田、果园、田块和风场

branches/historical-reconstruction
1940 至 1945 年历史地貌、土地利用和 1 m 历史增强输出

branches/runtime-publication
GAEA 执行节点、资产编译、Three.js 网页、在线版本和回滚
```

## 共享生态地表父级规则

```text
source ref: skill/dem-ecology-surface-v050
source path: skills/dem-ecology-surface/SKILL.md
source commit: de4ae8c75696ddc9225945e88941651e9deea3e9
retained: true
```

父级技能继续提供生态、农业、风场、季节、稳定实例和地表表达的完整规则。本技能负责把这些规则放入更完整的地貌生产线，并增加地貌、水体、历史重建、GAEA 和网页发布分支。

## 12.5 m 与高精度核心区规则

新项目默认使用经过校验的 12.5 m 输出网格。每个产品必须记录实际来源分辨率、输出像元、CRS、transform、NoData、覆盖率、字节数和 SHA256。

ASF RTC 参考 DEM 继续使用项目批准标签：

```text
12.5米输出像元的ASF RTC参考DEM
native12_5mSurveyClaim=false
```

缺少真实 12.5 m 覆盖时不得以 30 m 数据、插值填洞、合成地形或低分辨率网页纹理冒充完成。

当前历史项目的详细核心区默认目标为 48 km²，项目配置可以冻结其他面积。桂林 10 km² 分支继续作为方法参考和回归夹具。核心区优先寻找许可可用、来源可追溯、原生精度更高的数据。

## 固定生产顺序

```text
01 AOI、年代、用途和验收范围冻结
02 真值 DEM、海底、海岸、水系、道路、聚落、机场和历史源接入
03 CRS、像元原点、transform、垂直基准、NoData 和校验和冻结
04 坡度、坡向、曲率、相对高程、汇流量、湿度和河距导数
05 永久水体、活动河道、潮间带和硬禁入
06 地貌单元、河岸、洪泛平原、阶地、坡脚、山脊、崖壁和裸岩
07 历史土地利用、历史水系、道路、聚落、机场和年代约束
08 森林与开阔地父级分区
09 草地、农田、果园、竹林和聚落边缘子分区
10 田块、行列、田埂、路径、灌排切口和冠层微高度
11 侵蚀、岩石、河岸和其他可逆微地形
12 稳定实例、材质、法线、视差和连续细节编译
13 风、季节、潮位、流动、天气和历史状态
14 GAEA 或其他程序节点构建，输出独立增量层
15 Three.js 或 WebGPU 运行时编译、在线候选和本地包
16 数据 QA、浏览器 QA、视觉审批、发布和回滚
```

任何阶段都不得绕过真值、坐标、来源和硬禁入门槛。

## 高程、水位和历史增强模型

```text
z_truth_m
只读的批准 DEM 或测量高程

z_base_resampled_m
为了统一输出网格而重采样的基础高程，保留来源标签

z_historical_delta_m
由历史证据约束的道路、机场、旧河道、田块、聚落和地貌修正

z_micro_delta_m
可逆侵蚀、田埂、阶地、河岸和表面细节增量

z_visual_m
由基础高程与批准增量生成的显示高程

water_level_truth_m
可追溯的水位、潮汐或边界条件

water_visual_delta_m
细浪、波面和局部交互的可逆偏移

water_surface_visual_m
水位真值与批准视觉偏移的显示结果
```

1 m 输出必须标记为：

```text
1米历史增强地形
或
1米历史重建地形
```

该输出不得标记为原生 1 m 测绘 DEM。基础 DEM、历史增量、程序化微地形和视觉增量必须分层保存并可独立回退。

## 父级掩膜和硬禁入

所有程序字段只能在批准的父级掩膜内细分。

```text
侵蚀沟服从真实坡势、批准汇水区和出口
森林细分只在森林父级掩膜内
农田细分只在可耕地父级掩膜内
果园细分只在批准果园或适宜坡脚父级掩膜内
水体泡沫只在岸线、浅水、急流、汇流、破浪或交互触发区
河口混合只在批准河口和潮汐影响区
海浪只在近岸和外海父级掩膜内
```

陆地植被和农业默认禁入：

```text
永久水体
活动河道
活动河岸核心
道路核心
建筑轮廓
机场保护区
强裸岩核心
近垂直崖壁
```

## GAEA 角色

GAEA 是受控的程序化处理节点。真实 DEM、道路、水系、海岸、聚落、机场和历史证据保持只读。

GAEA 节点必须：

```text
读取版本化输入 manifest
输出命名明确的独立增量层和掩膜
记录节点图版本、参数、随机种子和输入校验和
保持 1:1 高程比例
保留原始分辨率或记录任何重采样
禁止把侵蚀、岩石或材质结果写回真值 DEM
上传构建结果后清理临时缓存
```

## 云端与执行架构

```text
GitHub
保存技能、项目配置、任务、manifest、代码、版本、QA 和回滚记录

私有 Windows 执行节点
运行 GAEA、GDAL、Python、浏览器和大型资产构建
只保留临时缓存
构建完成后上传可验证成果并清理缓存

网页运行时
使用 Three.js 或 WebGPU
读取同一套 manifest、坐标、相机和数据状态
公开显示来源、分辨率、缺口、不确定性和版本
```

网页不得用 iframe 拼接成互不共享状态的伪统一工作台。全域、地貌、水文、生态和历史核心应共享画布、相机、数据谱系和回滚入口。

## 版本和回滚

每个候选必须包含：

```text
版本化 manifest
源数据谱系
输入与输出校验和
父级掩膜版本
稳定种子和实例版本
程序化增量上限
GAEA 节点图与参数版本
浏览器运行时版本
前一稳定版本
回滚入口
```

上一稳定版本在新版本完成用户视觉批准前保持可用。

## 统一验收门槛

```text
真值 DEM 校验和不变
坐标系、transform、像元原点和垂直基准可追溯
覆盖缺口和 NoData 公开显示
永久水体内陆生实例为 0
强裸岩核心内大树和密灌木为 0
农田与山脊、崖壁、强裸岩、道路、建筑、机场和永久水体重叠为 0
河道连续、顺坡并进入批准出口
程序化增量可全部回退到 0
跨瓦片字段和稳定相位连续
历史输出带证据等级和不确定性
浏览器控制台错误为 0
桌面和 390 × 844 移动视口通过
本地包、在线候选和回滚版本均可验证
```

## 状态

```text
skill version: 0.2.0
status: expanded-architecture-and-contract
parent skill retained: dem-ecology-surface v0.5
controller alias: 小王
reference branch: guilin-10km2-detail
active branches:
  terrain-geomorphology
  water-system
  ecology-agriculture
  historical-reconstruction
  runtime-publication
implementation approval: Draft only
```
