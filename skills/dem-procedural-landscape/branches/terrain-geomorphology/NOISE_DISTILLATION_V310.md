# 小王程序化地貌噪声蒸馏 v3.1

## 本轮目标

本轮把 Three.js TSL 噪声方法接入阳朔漓江 12.5 米真值底座，建立可以在线观察和回退的局部高精度地貌样板。当前关注地形、河床、水面几何、台地和稻田田埂。植物实例固定为 0，水面动态材质留给后续独立系统。

## 研究边界

用户提供的研究入口：

```text
https://threejsroadmap.com/blog/10-noise-functions-for-threejs-tsl-shaders
```

该页面在自动研究环境中未能直接读取全文，因此本文件不复述或猜测文章的十项精确目录。本轮实施所用 API 以 Three.js 官方 TSL 文档和官方 WebGPU 程序化地形示例为准：

```text
https://threejs.org/docs/pages/TSL.html
https://threejs.org/examples/webgpu_tsl_procedural_terrain.html
https://threejs.org/docs/pages/WebGPURenderer.html
```

## 固定世界观

```text
z_truth_m
12.5 米原生高程，只读

z_base_resampled_m
局部输出网格对真值的连续采样，保留来源标签

z_macro_delta_m
喀斯特肩部、峰壁和短促峰脚的低频增量

z_micro_delta_m
岩壁沟槽、裂隙、田埂、台地和河床的可逆增量

z_visual_m
真值基础与当前批准增量的显示结果
```

1 米表示局部输出网格与细节预算。产品名称固定使用“1米增强地形运行时样板”。当前成果不具备原生 1 米测绘声明。

## 噪声算子与地貌职责

### Simplex

使用 `snoise` 生成世界坐标连续场。它负责细小自然变化和多尺度构造的基础相位。坐标来自 EPSG:32649 投影坐标，因此切换瓦片时不会从零重新开始。

### FBM

使用四个固定频率和固定振幅的 Simplex 叠加。它负责石灰岩表面从十米级到米级的连续层次。每一层均受喀斯特父级掩膜限制。

### Ridged

对 Simplex 取绝对值、反相并幂次整形，形成窄脊、峰肩和壁面骨架。该场只写入宏观增量，默认最大幅度 3.2 米。

### Domain Warp

使用两个独立 Simplex 场偏移投影坐标，再进入 FBM 和 Ridged 计算。它用于破除蜂窝、鱼鳞、完整等高环和规则重复。

### Turbulent Erosion

使用绝对值噪声和幂次响应形成受控沟槽。它不执行真实水文侵蚀求解，也不跨越父级掩膜。默认与微观裂隙合计上限 0.72 米。

### Warped Field Grid

使用世界坐标分块和低频扭曲形成田块边界。田埂高度默认 0.42 米以内，田块尺度约 43 米乘 57 米。该层只在低坡、低起伏、低相对高程和批准河距共同形成的农田父级掩膜内出现。

### Curl Noise

Curl Noise 留给后续水面流纹、泡沫漂移和水面法线系统。本轮河道只建立稳定水面几何，不在地形增量中混入动态水波。

## 喀斯特蒸馏逻辑

喀斯特细化需要同时满足坡度、局地起伏和河岸排除条件。片区搜索优先选择漓江中心线附近 190 米范围内坡度和局地起伏得分最高的位置，使 512 米样板中同时出现贴水关系与石灰岩峰壁。

```text
宏观层
Ridged + Domain Warp
典型波长约 60 至 160 米
最大增量 3.2 米

中观层
FBM + turbulent erosion
典型波长约 8 至 45 米
最大增量约 0.72 米

近观层
高频 Simplex + fracture response
典型波长约 1 至 12 米
进入几何位移与法线响应
```

所有增量乘以 `aKarst` 父级掩膜，并在活动河道和河岸缓冲区逐渐归零。

## 稻田、台地与田埂

稻田样板从候选 A 中搜索坡度低、局地起伏低、相对高程低且靠近漓江的区域。地形生成顺序为：

```text
连续真值基础
低地父级掩膜
0.24 米台地量化候选
扭曲田块边界
0.42 米以内田埂
活动河道排除
```

田块中不生成作物、草、树或其他植物。后续植物系统读取同一农田父级掩膜和田块方向，不修改当前地形。

## 河道与水面几何

现有网页使用 `TubeGeometry` 表现漓江，因此视觉上接近悬空粗线。v3.1 采用以下路线：

```text
批准的漓江中心线
每 4 米重新采样
按局部切线生成左右法向
河宽在 44 至 94 米范围内连续变化
读取横断面低高程
平滑水面纵剖面
将河床增量压入地形
生成左右岸之间的三角带水面
```

水面顶点拥有真实宽度和连续高程。河床位于水面下方约 2.25 至 3.6 米，岸缘逐渐闭合。当前水材质仅提供中性透明表面，水波、流纹、泡沫和交互留给独立水体造波系统。

## 浏览器实现

```text
Three.js 0.185.1
WebGPURenderer
WebGPU 优先
WebGL 2 自动回退
MeshStandardNodeMaterial
TSL positionNode
TSL colorNode
TSL bumpMap normal response
```

桌面网格为 513 × 513，覆盖 512 × 512 米，因此顶点间距为 1 米。移动端网格为 257 × 257，间距为 2 米，用于控制显存和移动设备稳定性。

## 回退与 QA

```text
truthMutationCount = 0
enhanceMix = 0 时恢复真值基础
macro = 0 时移除喀斯特宏观增量
micro = 0 时移除岩壁细节
bund = 0 时移除台地与田埂增量
riverCarve = 0 时移除河床切入增量
vegetationInstances = 0
tubeGeometryUsed = false
```

浏览器 QA 必须检查桌面与 390 × 844 移动视口、三种工作镜头切换、1 米桌面网格、三角带水面、控制台错误、请求失败和真值修改数。

## 当前验收状态

```text
contract: implemented
online publication: required
browser QA: required
visual acceptance: false
production ready: false
```
