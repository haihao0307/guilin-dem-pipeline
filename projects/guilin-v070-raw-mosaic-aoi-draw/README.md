# 桂林 v0.7 原始联合拼接选区页

这是新的零起点路线。

当前阶段只读取 `canonical/guilin-dem-12_5m-core/data/raw/asf/` 中的 12 张新 12.5 米 DEM，生成一张不裁边、不补洞的原始联合拼接，并发布在线选区页。

## 交付

- 原始联合 DEM：GitHub pre-release `guilin-v070-raw-mosaic-v001`
- 在线选区页：`https://haihao0307.github.io/guilin-dem-pipeline/guilin-v070-selection/`
- 选区输出：WGS84 GeoJSON、EPSG:32649 坐标、EPSG:32649 WKT

## 当前阶段不做

- 四核心板块
- 自动裁切
- 缺口填补
- 侵蚀和灰度增强
- 水系
- 植物和生态

用户确认 AOI 后，再从同一张联合 DEM 生成唯一连续裁切 DEM，并在其上建立侵蚀、地形塑造和水系。
