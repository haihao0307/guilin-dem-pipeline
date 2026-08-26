# WENZHOU V1.0 BATHYMETRY TIDES HYDROLOGY

## 一、任务目标

在已经完成 Git LFS 归档和全新下载校验的温州 22000 平方公里 12.5 米权威 COG 基础上，建立连续、可追溯、可回滚的沿海生产线。

本轮依次完成：

1. GEBCO_2026 海底地形和 TID 质量网格。
2. FES2022b 潮汐谐波和边界潮位。
3. 坎门验潮站观测校准入口。
4. 海岸、岛屿、河口、潮沟和河流中心线骨架。
5. 代表性大潮和小潮的湿润干出层。
6. 一个同世界、同坐标系、同时间轴的本地浏览器检查页。

## 二、固定工作范围

```text
仓库
haihao0307/guilin-dem-pipeline

工作分支
project/wenzhou-v100-bathymetry-tides-hydrology

父归档分支
archive/wenzhou-qingjiang-22000km2-dem-truth-v001

父归档提交
f1bf9edf6e573082996277d4fc09b3b272deb5a7

权威陆地 COG
projects/wenzhou/archive/truth/WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif

权威 LFS OID
sha256:8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e
```

权威陆地 COG 必须保持：

```text
54638031 bytes
EPSG:32651
11866 × 11866
12.5 m × 12.5 m
Int16
SHA256 8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e
```

精确项目范围和沿海缓冲范围读取：

```text
projects/wenzhou/coastal/config/coastal_domain_v100.json
```

## 三、启动门槛

1. 从当前远端 HEAD 建立干净工作树，只允许正常快进提交。
2. 执行 `git lfs pull`，从 GitHub LFS 取得权威 COG、marine mask、source count 和 source NoData mask。
3. 对四个 LFS 实体重新计算字节数和 SHA256。
4. 任何实体缺失、LFS 下载失败或权威 COG 哈希变化时立即停止。
5. 禁止从旧 129、2046、2048 高度纹理恢复地形。
6. 禁止使用 30 米陆地 DEM、插值陆地缺口或合成陆地地形。

## 四、阶段 A，GEBCO_2026 海底地形

### A1 数据获取

仅从 GEBCO 官方分发入口取得：

```text
GEBCO_2026 Grid
GEBCO_2026 TID Grid
```

官方入口：

```text
https://download.gebco.net/
https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid
https://data.ceda.ac.uk/bodc/gebco/global/gebco_2026/
```

下载范围：

```text
WGS84
west 120.15
south 27.40
east 122.25
north 29.15
```

必须保存：

1. 官方原始下载文件。
2. 原始 URL 或 OPeNDAP 查询。
3. 下载时间。
4. 文件字节数和 SHA256。
5. GEBCO 版本和引用。
6. GEBCO 条款记录。
7. TID 网格。

若官方下载应用无法自动化，可使用应用生成的官方子集 URL或 CEDA OPeNDAP。允许人工下载后由脚本入库。不得从第三方镜像替代权威源。

### A2 原始层和模型层

保存两类成果：

1. 原始 WGS84 15 角秒子集，保持原值和原分辨率。
2. EPSG:32651 的 100 米模型对齐层。

100 米层的元数据必须写明：

```text
GEBCO_2026 15 arc-second source
reprojected model alignment grid
native12_5mBathymetryClaim=false
```

海底地形和 TID 必须分别保存。TID 重投影只允许 nearest。

### A3 陆海拼接规则

1. 权威陆地 COG 完全只读。
2. 海底层只在 marine mask 和经审核的海岸外侧生效。
3. 原始 GEBCO 正高程不能覆盖权威陆地。
4. 河口和潮滩的基准不确定区单独输出 `vertical_datum_uncertainty` 掩膜。
5. 任何沿海平滑、潮沟加深或河床补形进入独立重建层。

### A4 阶段 A 验收

必须生成：

```text
projects/wenzhou/coastal/data/raw/gebco_2026/
projects/wenzhou/coastal/data/derived/WENZHOU_GEBCO_2026_BATHY_NATIVE.tif
projects/wenzhou/coastal/data/derived/WENZHOU_GEBCO_2026_TID_NATIVE.tif
projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_BATHY_100M_EPSG32651_COG.tif
projects/wenzhou/coastal/data/derived/WENZHOU_COASTAL_TID_100M_EPSG32651_COG.tif
projects/wenzhou/coastal/reports/GEBCO_2026_ACQUISITION.json
projects/wenzhou/coastal/reports/GEBCO_2026_QA.json
```

QA 至少包含：

1. 原始和派生文件 SHA256。
2. CRS、网格、分辨率、bounds、NoData、数据类型、压缩、块和 overviews。
3. 深度最小值、最大值和分位数。
4. TID 各代码像元数和面积。
5. 直接测量、间接预测和算法插值的面积比例。
6. 权威陆地被修改的像元数必须为 0。
7. 海域未分类像元和异常正高程清单。
8. 海岸接缝候选区坐标。

## 五、阶段 B，FES2022b 潮汐谐波

### B1 主模型

主模型固定为：

```text
FES2022b ocean tide
PyFES
DOI 10.24400/527896/A01-2024.004
```

AVISO 凭据只保存在执行环境，禁止提交账号、密码、令牌或私有下载 URL。

至少处理以下分潮：

```text
M2 S2 N2 K2 K1 O1 P1 Q1 M4 MS4 MN4
```

若 FES2022b 文件已经包含更多分潮，保留完整可用集合并记录清单。

### B2 独立比较

TPXO10 atlas v2 只作为独立比较：

```text
1/30 degree coastal atlas
release 2024-08-14
```

使用 TPXO 时必须标记：

```text
modelRole=independent_check
```

不得无记录地替换 FES2022b。FES 获取受阻时可完成 GEBCO 阶段和 TPXO 比较准备，但潮汐主模型状态保持 blocked。

### B3 输出

生成：

1. 沿海模型边界节点的振幅和相位。
2. 坎门、温州湾外口、乐清湾外口、瓯江口和项目东侧开放边界的潮位时间序列。
3. 一个连续 35 天、15 分钟间隔的大潮小潮周期。
4. 代表性大潮和小潮时间窗口。
5. 每个点的高低潮时刻、潮差、相位和主要分潮贡献。
6. 可选的潮流输运或流速分量，前提是模型文件真实提供。

输出路径：

```text
projects/wenzhou/coastal/data/tides/fes2022b/
projects/wenzhou/coastal/reports/FES2022B_ACQUISITION.json
projects/wenzhou/coastal/reports/TIDAL_HARMONICS_QA.json
```

## 六、阶段 C，坎门验潮站校准

验证锚点：

```text
Station Kanmen
GLOSS 94
UHSLC 632
PSMSL 934
WGS84 121.28333, 28.08333
```

优先使用 IOC Sea Level Station Monitoring Facility 的站点元数据和质量控制数据。若 API v2 需要密钥，提交仅包含凭据需求的 blocker，不提交密钥。

必须记录：

1. 站点坐标和代码。
2. 传感器、采样间隔和可用时间范围。
3. 潮位基准和坎门、黄海平均海面基准关系。
4. 缺测和质量控制规则。
5. FES 预测与观测之间的相位差、振幅差和经过基准归一化后的 RMSE。

无法取得观测数据时，保留模型输出并将 `gaugeValidationPassed=false`。

## 七、阶段 D，海岸、河口和河流骨架

1. 从真实 marine mask 生成初始陆海边界。
2. 使用有许可和来源记录的海岸线、岛屿、河流、河口与潮沟矢量进行校准。
3. OpenStreetMap 可用作公开矢量来源，必须保存查询、抓取时间、对象 ID、许可和原始响应 SHA256。
4. 每条河流保持固定中心线。宽度、岸线和水面三角形从中心线横向生成。
5. 河宽调整不能改变中心线坐标、长度、拓扑和 source ID。
6. 所有河口必须与海域连通，所有内陆河段必须在项目范围内。
7. 不允许用一条长三角带连接不相邻河段。

输出：

```text
projects/wenzhou/coastal/data/hydrology/coastline.geojson
projects/wenzhou/coastal/data/hydrology/estuaries.geojson
projects/wenzhou/coastal/data/hydrology/river_centerlines.geojson
projects/wenzhou/coastal/reports/HYDROLOGY_TOPOLOGY_QA.json
```

## 八、阶段 E，湿润干出和潮汐关系

本阶段建立潮位与地形关系的第一版，不能标记为完整二维水动力模拟。

1. 将权威陆地、GEBCO 海底、海岸线和 FES 潮位统一到记录明确的平均海面参考。
2. 生成代表性大潮高潮、大潮低潮、小潮高潮和小潮低潮四个湿润干出快照。
3. 生成 35 天时间序列的海域面积、潮滩面积和河口暴露面积。
4. 所有基准不确定区保留 uncertainty mask。
5. 潮沟、河床和泥滩的重建增量单独保存，不写入权威高程。
6. 任何未求解浅水方程的结果必须标记为 `harmonic_water_level_wet_dry_preview`。

输出：

```text
projects/wenzhou/coastal/data/wetdry/
projects/wenzhou/coastal/reports/WET_DRY_QA.json
```

## 九、阶段 F，本地浏览器检查页

建立：

```text
web/wenzhou-coastal-v100/
```

页面要求：

1. 同一连续世界显示权威陆地和海底参考。
2. 可切换 GEBCO 深度、TID 来源类型、海岸线、河流中心线、潮位和湿润干出。
3. 时间滑块驱动真实谐波结果。
4. 页面明确显示当前模型、分潮、时间、潮位基准和不确定性。
5. 四个旧温州地点只作为镜头锚点，不能加载四套独立地形。
6. 地形垂直比例保持 1:1。
7. 禁止加载旧 129、2046、2048 高度纹理。
8. 浏览器控制台错误为 0。
9. 桌面和 390 × 844 移动视口完成截图和交互 QA。
10. 本轮只提供本地或 Draft 候选，禁止修改 gh-pages。

## 十、失败处理

发生以下情况时 fail closed：

1. 权威 COG 或支持掩膜无法从 LFS 取得。
2. GEBCO_2026 或 TID 版本无法确认。
3. 下载文件 SHA256、格式或范围异常。
4. FES2022b 凭据或模型文件不可用。
5. 坎门观测 API 不可用。
6. 水系来源无法追溯。
7. 海岸或河流拓扑存在断裂、跨区长三角或越界。

失败报告必须写出：

1. 精确 URL 或本地路径。
2. HTTP 状态或文件系统错误。
3. 已检查的凭据变量名称，但不能写凭据值。
4. 已完成的真实输出和仍缺失的输出。
5. 不创建占位栅格、虚假潮位、合成截图或成功标记。

## 十一、提交和 PR 规则

1. 只在 `project/wenzhou-v100-bathymetry-tides-hydrology` 工作。
2. 保持对应 PR 为 Draft。
3. 禁止合并、强推、改写历史或修改 main、gh-pages、PR #42、PR #45、PR #46。
4. 大型原始数据和派生 COG 使用 Git LFS 或独立可验证对象存储。
5. 每个阶段单独提交，提交信息明确写明阶段和真实状态。
6. 只有阶段文件、重新下载校验、文件 QA 和浏览器 QA 全部通过后，才能报告对应阶段完成。
