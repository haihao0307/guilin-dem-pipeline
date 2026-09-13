# 程序化地貌生产线生产纲领 v0.2

## 目的

本文件保存程序化地貌生产线的长期知识、优先级、协作方式和发布边界。城市项目可以增加本地规则，不能降低这里的真值、来源、可逆性和验收要求。

## 组织与协作

```text
用户
最终视觉批准、历史目标和项目优先级

小华
上游总控、研究、架构、任务拆分、Codex 调度、审查、合并建议、版本和回滚管理

GitHub
技能、项目绑定、任务、源数据谱系、代码、提交、PR、QA 和发布记录的权威桥梁

Codex
下游实现助手，按任务合同修改工程、运行测试、提交证据

私有 Windows 节点
GAEA、GDAL、Python、浏览器和大文件构建执行环境
```

任何完成声明都需要与声明层级匹配的证据。合同完成、代码完成、数据完成、浏览器完成和视觉批准必须分别记录。

## 长期真值原则

真实 DEM、真实或历史重建水系、道路、聚落、机场和历史土地利用拥有最高优先级。程序化字段只在批准的父级掩膜内细分。

推荐来源优先级：

```text
测量或权威发布数据
经过校验的项目源数据
可追溯历史资料重建
经过审查的人工修复
受限程序化候选
视觉运行时增量
```

同一项目中出现来源冲突时，保留冲突报告、证据等级和人工决策记录。禁止静默融合。

## 数据标签

每个栅格、矢量、实例流和网页资产至少记录：

```text
project
AOI
epoch
source
source version
source status
license
CRS
transform
pixel origin
resolution
units
vertical datum
NoData
bounds
grid or geometry
coverage
checksum
quality status
parent mask
runtime role
reversibility
```

来源状态建议使用：

```text
authoritative
verified
historically-reconstructed
reviewed-manual-repair
proxy
unverified
unknown
planned
visual-only
```

## 12.5 m 规则

早期约 13 m 全域规则保留在历史记录中。新项目默认采用经过校验的 12.5 m 输出网格。

12.5 m 表示输出像元时，必须同时记录源产品的真实性质。ASF RTC 参考高程继续保留：

```text
native12_5mSurveyClaim=false
```

严禁使用以下方式关闭真实数据缺口：

```text
30 m 最终回退
插值填洞
合成山体
低分辨率网页高度纹理
预览图代替 COG
未上传的 Git LFS 指针代替实体
```

## 核心区与历史重建

当前 1940 至 1945 年历史项目的详细核心区默认目标为 48 km²。项目配置可以冻结其他面积。桂林 10 km² 原型属于参考实现。

核心区工作路线：

```text
真实 12.5 m 或批准基础 DEM
更高精度来源检索
历史航拍和地图配准
旧河道、道路、机场、聚落和土地利用重建
1 m 输出网格
历史增量与程序化微地形分层
浏览器和地面镜头验收
```

输出名称使用：

```text
1米历史增强地形
1米历史重建地形
```

每个增量记录证据来源、置信度、年代、空间范围、最大幅度、审核人和回滚方法。

## 固定地表生产顺序

```text
真值接入
地形导数
水系与河距
地貌单元
硬禁入
历史覆盖
森林与开阔地父分区
草地、农田、果园和竹林子分区
田块行列、田埂、路径和冠层微高度
侵蚀、岩石和河岸可逆增量
实例编译
风、季节、天气和水位状态
运行时编译
QA、发布和回滚
```

实例编译必须晚于水体、道路、建筑、机场、裸岩和农业冲突检查。

## 程序化地形方法转译

程序化地形方法用于生成可解释的字段和增量。它不具备覆盖真值的权限。

允许转译的通用方法：

```text
多尺度坡度、曲率和相对高程
世界坐标噪波和 cellular 字段
顺坡侵蚀
汇流与湿度响应
裸岩暴露
阶地和坡脚细分
森林冠层层次
田块、行列和田埂
河岸序列
跨尺度连续表达
```

每个程序节点需要声明输入父级掩膜、输出字段、范围、单位、随机种子、最大增量和回滚值。

## GAEA 生产纪律

GAEA 图属于可版本化的构建程序。它的输出按层保存。

```text
truth input
read-only

derived analysis
slope, curvature, flow, relief, masks

procedural delta
erosion, sediment, terrace, fracture, rock response

material response
color, roughness, normal, displacement candidate

runtime asset
packed textures, tiles, meshes, manifests
```

GAEA 工作节点不得修改权威 COG。垂直夸张关闭。任何下采样都需要显式记录目标、方法和用途。最终真值 QA 读取原始文件。

## 水体与生态协同

水体几何、河岸、湿润边缘、河口、潮间带和海岸先于陆地实例编译。

```text
永久水体内陆生实例为 0
活动河岸核心内不兼容实例为 0
河宽变化只改变中心线左右法向偏移
流纹服从批准流向
泡沫服从批准触发区
潮位真值与视觉波面分离
```

## 连续细节

同一稳定字段服务远景、中景和近景。

```text
远景
父级掩膜、综合色、总体冠层、主波和地貌形态

中景
视差体积、田块结构、河岸泡沫、岩石和冠层层次

近景
预算内几何、实例、碎石、树干、作物、水岸和交互粒子
```

瓦片边界不得重启相位、随机种子、田块方向、风场或水流纹理。

## 云端优先

项目配置、数据谱系、GAEA 图、构建任务、版本和网页成果在线保存并版本化。大型真值数据可以通过 Git LFS、Release 资产或项目批准的对象存储保存，仓库必须保留固定校验和与获取合同。

私有 Windows 节点只使用临时缓存。构建完成后上传成果、写入 receipt 和 QA，再清理缓存。

## 发布状态

推荐状态机：

```text
planned
contract
data-blocked
implementation
data-qa
browser-qa
visual-review
approved
published
rolled-back
```

PR 默认保持 Draft。数据缺失、浏览器未运行、截图缺失、控制台报错、在线地址未验证或用户未批准时，状态不得进入 `approved`。

## 项目隔离

桂林、温州、昆明和其他城市可以共享：

```text
技能
schema
validator
构建器
运行时组件
QA
任务模板
```

不得直接共享：

```text
坐标
真实 DEM 像元
河流和海岸几何
道路、建筑和机场
历史土地利用
物种和作物分布
潮汐和水深数值
未经验证的参数
```

## 下一阶段

本技能合同批准后，下一阶段建立机器可读 schema、validator、项目绑定、统一状态网页和分支级 QA。执行合同位于：

```text
ops/tasks/DEM_PROCEDURAL_LANDSCAPE_FOUNDATION_V020.md
```
