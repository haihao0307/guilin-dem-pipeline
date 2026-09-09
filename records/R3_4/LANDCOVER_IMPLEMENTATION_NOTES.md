# 小温州 R3.4：土地覆盖外部证据声部

R3.4 从已经通过本地与固定公网浏览器 QA 的 R3.3 候选提交 `65594e3f1fb5bc2214747d7301a6e0326519d68c` 派生。R3.2/R3.3 的 DEM、人眼相机、路径安全移动、演示海面和 SoilGrids 土壤外观声部不重写。

## 为什么先做土地覆盖，而不是直接做树、房子和田块

ESA WorldCover 2021 v200 能提供约 10 米尺度的土地覆盖类别，如 tree-cover、cropland、built-up、permanent-water。它不能提供单棵树的位置与树冠、建筑轮廓与高度、田块边界与作物种类。因此把“tree-cover”直接展开成真实树木，或把“built-up”直接生成建筑，会把类别观察偷换成个体 Object Truth。

R3.4 只把 WorldCover 作为独立的外部观察声部显示，不生成个体对象。

## 永久证据来源

正式来源已经在 Release `wenzhou-r3.4-environment-evidence-20260910` 永久归档。WorldCover 归档包 `Wenzhou_R3_4_ESA_WorldCover_Evidence_20260910.zip` 的 SHA-256 为：

`f558037e82ce38fac604291c6dc0327c931488c5167c7015e0dbdeae5a9ba0ad`

该归档在发布前经过两轮完整性检查：Actions acquisition 内部 payload manifest 验证，以及永久 Release 前重新下载 artifact、复核 artifact SHA、解包后再次逐 payload 校 bytes + SHA-256。

## 浏览器派生索引

浏览器不能每次加载 337 MB WorldCover 归档，因此从永久证据中的 2021 v200、EPSG:32651、10 米 COG 派生 17 个视域块，总计 29,205,814 bytes：

- `query-01` 至 `query-12`：10 米 nearest，保留原离散类别；
- 三条河流近景：20 米 mode，只是显示聚合；
- 山地：40 米 mode，只是显示聚合；
- 全域：80 米 mode，只是显示聚合。

禁止使用双线性/线性插值处理类别码，因为类别 10 与 40 的数值平均并不代表一个现实类别。mode 聚合只用于大范围显示，不可以再声称是 10 米原类别。

## GPU 空间映射

覆盖层不直接复用地形 UV 解释 WorldCover。每个 fragment 用当前 patch 的地形显示原点恢复投影坐标：

- `E = E0 + localX * 1000`
- `N = N0 - localZ * 1000`

然后再根据该 WorldCover patch 的 EPSG:32651 geotransform/bounds 求类别纹理坐标。源栅格 row 0 是北侧；上传 DataTexture 前明确上下翻行，使 GPU row 0 对应南侧，再使用 `v=(N-south)/(north-south)`，避免南北倒置。

每一个 `.u8` 在浏览器加载时按 manifest SHA-256 再验证。

## 显示与真值边界

- 覆盖层默认关闭；打开后透明度约 0.48。
- 复用当前显示地形几何，不做程序化高度位移。
- 整层只抬升约 0.035 米避免 Z-fighting，明确 `heightClaim=none`。
- 保留 R3.2 的陆地区域 alpha mask；WorldCover 的 water 类别不能替代既有海陆拓扑。
- 使用 R3.4 自己的显示调色板，不声称是 ESA 官方颜色。
- JRC GSW 已永久归档，但本版不进入画面，因为它是 1984–2024 历史水体证据，不是即时河面、海面或潮位。

## QA

R3.4 必须同时通过：浏览器 bundle 的每文件 hash/shape/类别域检查；R3.3 冻结目录零 diff；`query-01` 10 米原类别与查询锚点 CPU 采样一致；河流 20 米、山地 40 米、全域 80 米 policy 正确；土地覆盖开关产生真实 WebGL 像素差异；R3.3 土壤与 R3.2 海面仍存在；1.600 米人眼关系移动前后不变；390×844 手机不溢出且控制不重叠。
