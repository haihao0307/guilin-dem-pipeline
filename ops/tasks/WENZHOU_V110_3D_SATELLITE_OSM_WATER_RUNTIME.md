# 温州 V1.1 真实三维地形、卫星色彩、OSM 水系与海洋运行时

## 任务目的

在现有温州真实数据成果上建立可以直接视觉审查的三维网页运行时。

本轮成品必须是可旋转、可缩放、可连续飞行、具有真实高程起伏的三维地图。静态图片、二维 canvas、预渲染截图、全屏海报和单张地形纹理均不能作为完成结果。

## 工作分支和 PR 规则

只在以下分支工作：

```text
project/wenzhou-v110-3d-satellite-osm-water
```

该分支从温州沿海数据分支当前远端提交建立：

```text
project/wenzhou-v100-bathymetry-tides-hydrology
df14b6dfe35a32350c0d762287d633029c8a4f1a
```

保持本 PR 为 open、Draft、未合并。

禁止：

```text
修改 main
修改 gh-pages
修改 PR #42
修改 PR #45
修改 PR #46
修改 PR #49 的历史
强制推送
改写历史
覆盖权威陆地 COG
使用 30 m 陆地替代
用随机地形、代理高程或静态图冒充三维地形
```

开始时重新确认远端 HEAD。若分支已经出现新提交，从最新远端 HEAD 正常快进继续。

## 必读的桂林三维运行时

完整阅读并转译以下桂林实现。它们提供共享画布、共享相机、数据状态、WebGL2 地形、地形材质、水文几何、镜头和浏览器 QA 的结构参考：

```text
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/index.html
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/style.css
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/runtime.js
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/core-loader.js
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/hydrology-runtime.js
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/gaea-bridge.js
fix/guilin-v050-restore-v130-workbench:web/guilin-v050/manifest.json
fix/guilin-v050-restore-v130-workbench:tests/guilin_v050_stage_a_browser.mjs
```

需要迁移的结构：

```text
一个 WebGL2 画布
一个共享相机
一个共享世界坐标系
一个活动数据状态
真值高程与视觉材质分层
水系独立运行时
浏览器冷启动和控制台验收
移动端面板和镜头验收
```

禁止迁移：

```text
桂林坐标
桂林高程代理
桂林 257 网格数据
漓江和湘江几何
桂林四核心资产
喀斯特专用参数
桂林生态实例
桂林垂直夸张默认值
```

## 已冻结的温州真实输入

### 权威陆地 DEM

```text
path
projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif

SHA-256 and Git LFS OID
8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e

bytes
54638031

CRS
EPSG:32651

grid
11866 × 11866

pixel spacing
12.5 m

bounds
239645.652694, 3054965.110786, 387970.652694, 3203290.110786
```

陆地高程只读。运行时永久保持垂直比例 1:1。

### 海底和海岸缓冲域

```text
projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif
projects/wenzhou/coastal/data/derived/WENZHOU_TRUTH_AOI_MARINE_BATHY_100M_EPSG32651_COG.tif
projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_TID_100M_EPSG32651_COG.tif
projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_VERTICAL_DATUM_UNCERTAINTY_100M_COG.tif
projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_LAND_SEA_CONFLICT_100M_COG.tif
```

海底模型网格：

```text
CRS: EPSG:32651
spacing: 100 m
size: 2090 × 1971
bounds: 218100, 3030900, 427100, 3228000
coverage: 100%
```

海底和陆地必须在同一世界坐标中对齐。陆海交界需要使用海岸线、陆海冲突层和湿干逻辑，禁止简单按高程小于等于零切海。

### OSM 海岸线和水系

```text
projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_COASTLINE_EPSG32651.geojson
projects/wenzhou/coastal/data/hydrology/osm/WENZHOU_RIVER_CENTERLINES_EPSG32651.geojson
projects/wenzhou/coastal/data/hydrology/osm/OSM_COASTLINE_SOURCE_WGS84.geojson
projects/wenzhou/coastal/data/hydrology/osm/OSM_WATERWAYS_SOURCE_WGS84.geojson
```

当前真实数据事实：

```text
projected coastline parts: 934
projected waterway parts: 5819
waterway total length: 9,093,110.239 m
coastline total length: 2,289,581.953 m
out-of-bounds vertices: 0
introduced self intersections: 0
estuary connectivity: pending
```

当前 OSM 水系可进入三维审核页，但必须显示真实 QA 状态。河口连通仍未闭合时，页面要标注待修复的断点和未通过状态。

### 潮位

坎门 UHSLC 实测窗口已经入库。FES2022b 正式预测仍受权威模型文件缺失阻塞。

首个三维页面使用以下水位规则：

```text
默认海面参考高程为 0 m
允许切换坎门实测相对潮位示意
FES2022b 缺失时不得生成合成正弦潮位
动态潮汐未闭合不得阻止静态真实海洋和河网三维显示
```

## 目标目录

创建自包含运行时：

```text
web/wenzhou-v110/index.html
web/wenzhou-v110/style.css
web/wenzhou-v110/runtime.js
web/wenzhou-v110/terrain-runtime.js
web/wenzhou-v110/water-runtime.js
web/wenzhou-v110/satellite-runtime.js
web/wenzhou-v110/camera-runtime.js
web/wenzhou-v110/manifest.json
web/wenzhou-v110/assets/
projects/wenzhou/web/v110/
projects/wenzhou/reports/WENZHOU_V110_*.json
projects/wenzhou/evidence/v110/
```

页面入口必须为：

```text
web/wenzhou-v110/index.html
```

## 一、真正的三维地形

1. 使用 WebGL2、Three.js WebGLRenderer 或等价 GPU 三维运行时。
2. 画面必须具有透视投影、光照、深度测试和真实高程起伏。
3. 用户可以鼠标旋转、滚轮缩放、平移和连续飞行。
4. 全域不允许一次创建 11866 × 11866 顶点网格。
5. 使用四叉树、分层瓦片或自适应网格。
6. 远景使用 COG overview 或直接从 COG 派生的低层级瓦片。
7. 近景逐级切换到真实 12.5 m 高程瓦片。
8. 任意局部瓦片必须保留同一 truth SHA、CRS、transform、像元原点和 terrainRuntimeId。
9. 瓦片边缘高程必须共边，禁止裂缝、裙边悬空和不同层级接缝。
10. 摄像机接近地面时，几何细节必须明显增加。
11. 页面中的高度来源、活动层级、当前地面采样间距和加载瓦片数需要实时显示。
12. 任何用于材质的纹理不得代替真实几何高程。

### 必须证明三维成立

浏览器 QA 需要记录：

```text
perspective projection active
WebGL depth test active
terrain vertex elevation range greater than 0
camera azimuth changed across drag test
camera pitch changed across drag test
visible parallax across two viewpoints
near and far terrain silhouettes differ correctly
```

## 二、卫星影像与卫星色彩

提供两条明确分开的路径。

### 在线真实卫星影像

优先使用可追溯、许可允许、非中国网站来源的 Sentinel-2 影像服务。

允许的第一候选：

```text
EOX Sentinel-2 cloudless 2024 WMTS or WMS
```

要求：

```text
记录服务 URL 和 layer ID
显示完整 attribution
保存许可说明和访问日期
不得把网络影像缓存入仓库，除非许可明确允许
请求失败时页面继续运行
```

也可以使用 Copernicus Data Space 的正式 Sentinel-2 服务，但需要提交可重现配置和授权说明。

### 离线卫星色彩

提供一个不依赖网络的卫星色彩材质。它可以由真实高程、坡向、坡度、海岸、OSM 水系、已有土地覆盖证据和经过批准的区域色彩规则生成。

要求：

```text
标记为 satellite-color material
不得标记为原始卫星照片
颜色保持低饱和、自然、连续
避免彩虹高程色带
避免高频斑点和重复噪声
水体颜色与陆地材质分离
远近视图保持相同地物身份
```

页面至少提供：

```text
真实卫星影像
离线卫星色彩
阴影地形
灰度分析
海底深度
```

真实卫星影像加载成功后，必须作为地形表面纹理参与三维透视和光照，不能以二维图片覆盖在画布上。

## 三、海洋、海湾、河口和岛屿

1. 使用 OSM 海岸线建立陆海边界。
2. 使用 GEBCO 2026 海底 COG 建立有深度的海底表面。
3. 海面单独作为三维水面层。
4. 海面覆盖温州湾、乐清湾、椒江口、近岸海域和岛屿周边水域。
5. 岛屿陆地必须从海面中正确扣除。
6. 海底不得盖到权威陆地上。
7. 海面与海底需要共享坐标变换。
8. 提供海面开关、海底开关、海岸线诊断和陆海冲突诊断。
9. 海面材质至少表现 Fresnel、天空反射、深浅变化、轻微法线扰动和距离雾化。
10. 首版海面波动只能改变视觉表面，不能改变真实水位基准。
11. 河口连通未通过时，断点以诊断标记显示，禁止隐去。

## 四、OSM 河流、溪流、运河和潮沟

1. 直接读取 EPSG:32651 的 OSM 派生中心线。
2. 保留每个 source OSM ID、名称、waterway 类型、原始坐标哈希和源长度。
3. 河宽只通过中心线左右法向偏移生成。
4. 河宽变化不得改变中心线坐标、长度、顶点数、端点和分叉点。
5. `river`、`stream`、`canal`、`tidal_channel` 使用不同默认宽度和视觉层级。
6. 主河需要按名称优先显示，包括瓯江、飞云江、鳌江、楠溪江及实际数据中存在的其他命名河流。
7. 未命名小沟渠在全域远景中可按屏幕像素阈值隐藏，近景必须按需出现。
8. 河面贴附真实地形，禁止悬空、穿山、跨越无关河段形成三角桥。
9. 河流入海处需要执行河口连通诊断。
10. 当前 topology QA 未通过时，页面状态必须显示 `estuary connectivity pending`。

## 五、一个连续世界和镜头

所有地点位于同一个 terrainRuntimeId、CRS 和世界变换中。

镜头按钮：

```text
全域
温州城
仙溪镇
海门城
雁荡山
瓯江口
乐清湾
坎门
```

要求：

1. 点击镜头后沿同一三维世界连续飞行。
2. 禁止切换页面或替换地形对象。
3. 提供全景、斜视、正射和近地模式。
4. 近地模式保持 `z_visual_m + 1.6 m` 最小离地高度。
5. WASD 和方向键沿地表移动。
6. 海上近地模式按海面加 1.6 m 处理。
7. 用户操作可以中断自动飞行。

## 六、界面

参考桂林统一工作台的共享画布结构，建立温州专用控制面板。

顶部状态：

```text
Draft 状态
权威陆地 SHA
当前材质
当前高程层级
当前像元间距
活动瓦片数
OSM 水系状态
海底状态
FES2022b 状态
FPS
```

工作区：

```text
全域
地形
卫星
水系
海洋
诊断
```

图层开关：

```text
陆地三维地形
真实卫星影像
离线卫星色彩
海面
海底
海岸线
岛屿边界
主要河流
溪流
运河
潮沟
中心线
河口断点
陆海冲突
高程网格线
```

页面启动不得停留在全屏黑色加载层。先显示可见的低层级三维地形和 UI，随后渐进加载卫星纹理、水系和高精瓦片。

附加层失败时，其余三维地形继续可操作，并在面板中显示具体错误。

## 七、性能和资产策略

1. 大型 COG 继续通过 Git LFS 保存。
2. 网页运行资产使用分层瓦片、压缩纹理和紧凑二进制格式。
3. 禁止把完整 54.6 MB COG base64 嵌入 HTML。
4. 禁止创建 69 MB 单文件 HTML。
5. 禁止以 4096 静态图片替代三维运行时。
6. 桌面首屏低层级三维地形和 UI 在 3 秒内可见。
7. 近景瓦片和水系渐进加载。
8. 390 × 844 移动端使用较低网格预算，但保持真实三维。
9. 提供内存、GPU 缓冲、瓦片数、三角形数和 FPS 报告。
10. 浏览器切换镜头后需要回收无关高精瓦片。

## 八、构建工具

提供确定性构建脚本。建议目录：

```text
projects/wenzhou/web/v110/scripts/build_terrain_tiles.py
projects/wenzhou/web/v110/scripts/build_bathymetry_tiles.py
projects/wenzhou/web/v110/scripts/build_water_runtime_assets.py
projects/wenzhou/web/v110/scripts/build_offline_satellite_color.py
projects/wenzhou/web/v110/scripts/verify_runtime_assets.py
```

构建脚本必须：

```text
从权威 COG 和已验证派生 COG 直接读取
记录输入 SHA-256
记录输出尺寸、bounds、transform 和 SHA-256
失败时停止
禁止使用旧版二维页面资源作为高程输入
```

## 九、真实浏览器验收

### 冷启动

关闭旧服务器和旧浏览器页后执行三次冷启动。

每次记录：

```text
实际 URL
构建 ID
UI 首次可见时间
低层级三维地形首次可见时间
首个卫星瓦片时间
首个 OSM 水系时间
控制台错误
网络失败
```

### 三维视觉

必须提交真实浏览器截图：

```text
全域斜视
全域正射
温州城斜视
雁荡山近景
瓯江口河海连接
乐清湾海面和岛屿
坎门海岸与海底
卫星影像模式
离线卫星色彩模式
OSM 中心线诊断
河口断点诊断
390 × 844 移动端
```

截图要来自运行时画布。预先生成的图片不能代替运行时截图。

### 交互

验证：

```text
鼠标旋转
缩放
平移
七个镜头连续飞行
WASD 近地移动
材质切换
水系开关
海面开关
海底开关
河宽倍率 0.5, 1.0, 2.0
```

### 数据不变量

验证：

```text
陆地 COG SHA 不变
陆地像元修改数 0
OSM 中心线坐标 SHA 不变
河宽变化期间中心线长度不变
河宽变化期间顶点数不变
海底 COG SHA 不变
所有运行瓦片共享 EPSG:32651
所有运行瓦片共享正确像元原点
```

### 质量门槛

```text
浏览器控制台错误 0
未处理 Promise rejection 0
所有必需资产 HTTP 200 或 206
页面不出现永久黑屏
页面不出现破图
页面不使用二维海报代替三维地图
陆海边界无大面积错盖
主要河流可见
海洋和岛屿可见
卫星材质可见
```

## 十、交付

提交：

```text
web/wenzhou-v110/
projects/wenzhou/web/v110/
projects/wenzhou/reports/WENZHOU_V110_*.json
projects/wenzhou/evidence/v110/
HANDOFF_WENZHOU_V110_3D_RUNTIME.md
WENZHOU_V110_3D_RUNTIME_LOCAL_PACKAGE.zip
```

最终 PR 评论必须包含：

```text
远端 commit SHA
分支和 PR 状态
直接审核 URL
本地包名称和 SHA-256
权威陆地 COG SHA-256
海底 COG SHA-256
OSM 水系和海岸线 SHA-256
实际三维运行时技术
瓦片层级和当前采样间距
卫星来源、许可和 attribution
七个镜头验收结果
海面和海底验收结果
OSM 水系验收结果
河口连通状态
桌面和移动截图
控制台结果
性能报告
仍未通过的门槛
```

保持 PR 为 Draft。视觉审批前禁止公开部署和合并。
