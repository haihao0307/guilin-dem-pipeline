# DEM Procedural Landscape Production Skill v0.1

## 中文名称

程序化地貌生产线

## 目标

本技能把真实 DEM、地形导数、水系、侵蚀、岩石、生态、农业、历史重建、季节状态和网页运行时组织成一条可复用、可审计、可回滚的生产线。

当前正式纳入两个分支：

```text
branches/guilin-10km2-detail
桂林 10 km² 精细地表参考实现

branches/water-system
河流、河口、近岸和海洋水体系统
```

后续项目只能绑定这些技能合同，项目数据仍保存在各自目录。桂林、温州和昆明不得共用未经核验的坐标、物种、作物、水系、潮汐或历史土地利用数据。

## 上游来源

### 共享生态地表规则

```text
source ref: skill/dem-ecology-surface-v050
source path: skills/dem-ecology-surface/SKILL.md
source commit: de4ae8c75696ddc9225945e88941651e9deea3e9
```

继承内容：

```text
真值与程序化增量分离
固定生产顺序
永久水体和硬禁入优先
地貌、植被和农业父级掩膜
世界坐标连续性
稳定实例 ID
季节与风场
运行时编译、QA、发布和回滚
```

### 桂林 10 km² 精细地表参考实现

```text
source ref: integration/ecology-v040
source project: guilin-yangtang
source manifest:
DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/ecology/v0.3.1/ecology-release-manifest.json
```

该参考实现是精细地表方法样板。它的活动地形标记为“等待真实 12.5 米 DEM 替换的确定性生态验证代理”，不得作为原生测绘高程或最终地理真值。

## 固定生产顺序

```text
01 真值 DEM、海岸线、水系和历史源数据接入
02 CRS、像元原点、垂直基准和校验和冻结
03 坡度、坡向、曲率、相对高程、汇流量和湿度导数
04 永久水体、活动河道、潮间带和硬禁入
05 地貌单元、河岸、洪泛平原、阶地、坡脚、山脊、崖壁和裸岩
06 历史土地利用与年代约束
07 森林、开阔地、农业和聚落父级掩膜
08 田块、冠层、侵蚀沟、岩石和水体子分支
09 可逆微地形、材质、法线、视差和稳定实例
10 风、季节、潮位、流动和天气状态
11 运行时编译和连续细节调度
12 数据 QA、浏览器 QA、发布、回滚和视觉审批
```

任何后续阶段都不得绕过前面的真值、坐标和硬禁入门槛。

## 高程与水位模型

固定分离：

```text
z_truth_m
只读源 DEM 或经过批准的测量高程

z_micro_delta_m
可逆侵蚀、田埂、阶地、河岸微地形和表面细节增量

z_visual_m
由真值与批准增量生成的显示高程

water_level_truth_m
来自可追溯水位、潮汐或边界条件的数据值

water_visual_delta_m
只用于视觉波面、细浪和局部交互的可逆偏移

water_surface_visual_m
水位真值与批准视觉偏移的显示结果
```

程序化地貌和水面不得改写 `z_truth_m`。视觉波浪不得冒充潮位或水动力计算结果。

## 父级掩膜原则

所有程序字段只能在批准的父级掩膜内细分。

```text
河道分支只能在已批准汇水区和水系关系内工作
侵蚀沟必须顺坡进入永久水体或批准排水通道
森林细分只能在森林父级掩膜内工作
农田细分只能在可耕地父级掩膜内工作
水体泡沫只能在水岸、破浪、急流或交互触发区工作
河口混合只能在河口和潮汐影响区工作
海浪只能在海洋和批准近岸区工作
```

## 硬禁入

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

水体视觉和几何默认禁入：

```text
未经批准的陆地区域
没有水系或海岸关系的封闭装饰线
跨越山脊的假河道
逆坡流动
脱离地形的悬空水面
与真值海岸线无解释冲突的海水覆盖
```

## 分支结构

### 桂林 10 km² 精细地表分支

负责：

```text
小范围精细地貌验证
水体和河岸硬禁入
侵蚀沟和喀斯特裸岩
森林、竹林、稻田、菜地、旱地和果园
田块、田埂、行列和冠层细节
稳定实例与近中远连续表达
```

其详细合同位于：

```text
skills/dem-procedural-landscape/branches/guilin-10km2-detail/SKILL.md
```

### 水体系统分支

负责：

```text
河流
河口混合带
潮间带
近岸海水
外海
水位与潮汐
流向和流速
波形、泡沫、浑浊和颜色
浮力、尾流和岸线交互接口
```

其详细合同位于：

```text
skills/dem-procedural-landscape/branches/water-system/SKILL.md
```

## 项目绑定原则

### 桂林

桂林 10 km² 原型用于精细地表方法和视觉回归。真实运行时接入后必须替换代理高程，并保留原有方法、稳定 ID、硬禁入和视觉基线。

### 温州

温州水体工程绑定当前独立沿海数据生产线：

```text
branch: project/wenzhou-v100-bathymetry-tides-hydrology
Draft PR: 49
land truth:
projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif
```

温州可以继承水体分支的结构和接口。温州的 GEBCO、潮汐、河口、岛屿、近岸水深和水文数据仍由温州项目目录管理。

## 运行时连续细节

禁止维护互不相关的近、中、远三套世界。

同一稳定字段按屏幕占用、镜头高度、镜头速度、焦点、遮挡、GPU 预算和内存预算逐渐展开：

```text
远景
父级掩膜、综合色、粗糙度、主波和总体冠层

中景
视差体积、冠层层次、岸线泡沫、河面流纹和田块结构

近景
预算内的树干、枝叶、作物、碎石、水岸几何、泡沫几何和交互粒子
```

相位和稳定 ID 必须来自世界坐标或批准的项目坐标，不得在瓦片边界重新开始。

## 版本和回滚

每个分支和项目发布必须包含：

```text
版本化 manifest
源数据谱系
输入与输出校验和
父级掩膜版本
稳定种子和实例版本
程序化增量上限
浏览器运行时版本
前一稳定版本
回滚入口
```

## 统一验收门槛

```text
真值 DEM 校验和不变
坐标系、transform 和像元原点一致
永久水体内陆生植被实例为 0
硬裸岩核心内大树和密灌木为 0
农田与山脊、崖壁、强裸岩和永久水体重叠为 0
河道连续且顺坡
水体与地形、海岸和项目边界关系有来源
程序化增量可回退到 0
跨瓦片字段连续
浏览器控制台错误为 0
桌面和移动交互通过
本地包、在线候选和回滚版本均可验证
```

## 状态

```text
skill version: 0.1.0
status: architecture-and-contract
parent skill retained: dem-ecology-surface v0.5
active reference branch: guilin-10km2-detail
active new branch: water-system
implementation approval: Draft only
```
