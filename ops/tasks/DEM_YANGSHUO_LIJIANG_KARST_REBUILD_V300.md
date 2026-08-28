# 下一阶段执行合同：阳朔漓江典型峰丛与稻田水系 v3.0

## 1. 开始条件

1. 从远端最新 `skill/dem-procedural-landscape-v010` 建立干净工作树。
2. 保持 PR #51 open、Draft、未合并。
3. 禁止强推、改写历史、修改 main 和手工修改 gh-pages。
4. 当前失败示范继续封存，证据不可覆盖。
5. 用户确认最终片区以前，`macroDeltaMeters=0`、`microDeltaMeters=0`、`userAreaApproval=false`、`visualAcceptance=false`。

## 2. 2048 原生窗口合同

候选窗口统一使用原始 12.5 米 DEM 的整数像元窗口：

```text
grid = 2048 × 2048
sourcePixelSpacingMeters = 12.5
widthMeters = 25600
heightMeters = 25600
areaSquareKilometers = 655.36
resamplingAllowed = false
permanentDownsample = false
interpolatedFakeDetail = false
webTerrainMode = tiled-lod
```

禁止将 512、1024 或其他较小窗口插值为 2048。候选高程、坡度、曲率、阴影和水系关系图都必须以 2048 × 2048 输出。

## 3. 锁定真值源

本轮四个候选窗口统一从以下已校验源片裁切：

```text
sourceId = AP_14427_FBS_F3120_RT1
file = AP_14427_FBS_F3120_RT1.dem.tif
SHA256 = 3e9f84d5681cbaf59d5859529740b4e8095d3f8809fca387919327933be17c6d
bytes = 71942668
CRS = EPSG:32649
grid = 6392 × 5624
pixelSpacingMeters = 12.5 × 12.5
bounds = [412981.09375, 2703536.5, 492881.09375, 2773836.5]
```

源片只读。运行时必须重新计算 SHA256、字节数、CRS、网格、仿射变换和 NoData。任一项不符立即停止。

漓江分析使用版本化文件：

```text
DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/metadata/lijiang_osm.geojson
Git blob = 7bc4ea134a8934d09aa001b787a2bb7f9ce1238f
```

## 4. 四个候选窗口

### A 阳朔县城北侧漓江峰丛谷地

```text
pixelWindow = [1934, 1305, 2048, 2048]
alignedBounds = [437156.09375, 2731924.0, 462756.09375, 2757524.0]
alignedCenterProjected = [449956.09375, 2744724.0]
用途 = 工程校准
```

重点检查河宽、峰脚转折、峰间低地和田块尺度。

### B 阳朔县城东北漓江弯道与低地

```text
pixelWindow = [2088, 1657, 2048, 2048]
alignedBounds = [439081.09375, 2727524.0, 464681.09375, 2753124.0]
alignedCenterProjected = [451881.09375, 2740324.0]
用途 = 次级候选
```

重点检查宽谷弯道、洪泛平地、农业低地连续性和现代建设干扰。

### C 兴坪南侧九马画山漓江贴水峡谷段

```text
pixelWindow = [1906, 787, 2048, 2048]
alignedBounds = [436806.09375, 2738399.0, 462406.09375, 2763999.0]
alignedCenterProjected = [449606.09375, 2751199.0]
用途 = 贴水峰墙研究
```

重点检查陡峭石灰岩峰壁、短促峰脚和峡谷水面。

### D 相公山至兴坪第一湾

```text
pixelWindow = [1947, 428, 2048, 2048]
alignedBounds = [437318.59375, 2742886.5, 462918.59375, 2768486.5]
alignedCenterProjected = [450118.59375, 2755686.5]
用途 = 首选视觉候选
```

重点检查漓江大弯道、多层塔状峰林、贴河山体和远中近景深度。

## 5. 候选评估产物

每个候选目录必须包含：

```text
truth-slice.tif
height_f32.bin
valid_u8.bin
elevation.png
slope.png
curvature.png
hillshade.png
river-peak-lowland.png
candidate-manifest.json
```

所有 PNG 尺寸均为 2048 × 2048。`height_f32.bin` 应包含 4,194,304 个 little-endian float32 样本。`valid_u8.bin` 应包含 4,194,304 个 uint8 样本。

候选清单写入：

```text
outputs/yangshuo_lijiang_candidates_v300/candidate-index.json
```

每个候选的有效覆盖率低于 0.995 时，状态写为 `blocked-incomplete-coverage`，保留证据并停止进入地貌生成。

## 6. 执行命令

先运行无二进制依赖的合同验证：

```bash
python tools/terrain_hydrology/validate_yangshuo_candidates_v300.py \
  --root . \
  --report reports/YANGSHUO_LIJIANG_CANDIDATES_V300_VALIDATION.json
```

在可读取真值源的 Windows 节点运行：

```powershell
python tools/terrain_hydrology/compile_yangshuo_candidates_v300.py `
  --root . `
  --source "C:\HaihaoDEM\ASF_v104_local\data\raw\dem\AP_14427_FBS_F3120_RT1.dem.tif" `
  --output-dir "outputs\yangshuo_lijiang_candidates_v300"
```

## 7. 片区确认后的地貌层

用户确认片区后再建立：

```text
z_truth_m
z_base_resampled_m
z_macro_delta_m
z_micro_delta_m
z_visual_m
```

`z_macro_delta_m` 负责塔状峰侧壁陡化、峰冠圆钝与偏斜、峰脚短促转折、贴河崖壁、沿江低地边界和河岸坎。

`z_micro_delta_m` 负责岩壁台肩、竖向溶蚀沟、裂隙凹腔、坡脚崩积、河岸冲刷槽、田埂、田块微高差、灌排沟渠和滩地微起伏。

## 8. 漓江和稻田关系

1. 主河道与水面位置服从批准水系。
2. 河流沿低廊道连续前进并绕开峰体核心。
3. 外弯、峡谷段和贴崖段允许形成局部陡岸。
4. 内弯和宽谷段允许形成低滩、点坝、低岛和冲积平地。
5. 稻田只进入低坡、低曲率、适宜湿润且可灌排的沿江平地。
6. 田块需要多尺度和不规则边界，禁止统一棋盘格。
7. 田埂和沟渠进入可逆几何层，稻作植被继续排除。

## 9. 网页交付

1. 继续使用现有三地区工作台。
2. 桂林卡片增加 v3.0 候选入口。
3. 同一相机提供真实 DEM、旧失败基线、新候选三路对照。
4. 支持旋转、平移、连续缩放、全景、近景、贴地和单独查看。
5. 桌面 1440 × 1000 与移动 390 × 844 执行真实浏览器 QA。
6. 控制台错误、页面错误和失败请求均为 0。
7. 用户视觉批准前保持 `visualAcceptance=false`。
