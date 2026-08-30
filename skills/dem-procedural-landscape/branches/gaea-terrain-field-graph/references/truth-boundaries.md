# DEM 真值与程序化增强边界

## 1. 真值资产必须冻结

每个地形项目至少冻结：

```text
source files
source URLs or receipts
license
AOI GeoJSON
CRS
pixel size
raster dimensions
nodata
geotransform
vertical datum
SHA256
mosaic order
resampling method
```

原始数据不得被程序化噪声、手工河流、插值填洞、未知来源栅格或旧项目资产替换。

## 2. 建议的数据分层

```text
Z_truth                  原始 DEM，只读
Z_truth_filtered         有记录的去噪或水文预处理
Z_delta_geology          地质增强候选
Z_delta_surface          表面增强候选
Z_render                 视觉高程
Z_collision              碰撞高程
N_micro                  着色器微法线
detail_confidence        0 到 1
protected_mask           机场、城市、水体、道路、岸线等
```

## 3. 增强公式

```text
allowed = confidence * (1 - protected_mask)
delta = clamp(delta_raw, -budget_down, budget_up)
Z_render = Z_truth + allowed * delta
```

幅度预算必须使用米或明确的无量纲单位，禁止在代码中混用。

## 4. 12.5 米 DEM 的实施起点

```text
大于 100 米波长的结构：谨慎进入 Z_delta
25 到 100 米波长的结构：只在高置信度自然地形区进入 Z_delta
小于 25 米波长的结构：优先进入 N_micro、颜色和粗糙度
```

最终预算要根据地形类型、视距和证据调整。

## 5. 水文与海岸

```text
riverTruthMask
lakeTruthMask
coastTruthMask
bathymetryTruthMask
```

程序化侵蚀不得切断真实河网，不得在永久水体内抬高陆地，不得移动岸线，不得把视觉水痕写成河流几何。

## 6. 瓦片连续性

全部噪声使用世界坐标：

```text
worldX = tileOriginX + localX
worldY = tileOriginY + localY
sample = noise(worldX * scale, worldY * scale, globalSeed)
```

瓦片边缘 QA：

```text
height edge difference <= numeric tolerance
normal edge difference <= visual tolerance
color edge difference has no visible seam
seed and parameter hashes identical
```

## 7. LOD 连续性

```text
Macro fields are identical across LODs
Meso fields are band-limited before downsampling
Micro fields fade with distance
Color and roughness use mip-safe masks
```

## 8. 碰撞与渲染分离

```text
Z_collision = truth + approved low-frequency delta
Z_render = Z_collision + visual meso delta
N_micro = shader-only detail
```

高频程序细节不能进入导航、物理和地面接触。

## 9. 停止条件

1. 真值栅格缺失或哈希不符
2. CRS、像元大小或仿射变换未知
3. 岸线和水系出现位移
4. 瓦片接缝可见
5. 程序化增强超过预算
6. 旧资产或 30 米回退混入 12.5 米生产线
7. 插值填洞没有独立批准
8. 视觉候选被标记为真值
