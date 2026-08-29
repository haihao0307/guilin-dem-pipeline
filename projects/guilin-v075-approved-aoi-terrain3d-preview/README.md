# 桂林 DEM 当前唯一生产版本

当前生产目录只保留浩哥确认通过的 v0.7.5 范围与三维页面。公开入口保持为：

`guilin-v075-approved-aoi-terrain3d`

## 已锁定范围

* 面积：33,113.874 km²
* WGS84：109.799604°E 至 111.302242°E，24.462357°N 至 26.462927°N
* EPSG:32649：W 380331.8，S 2705928.1，E 530128.2，N 2926987.2 m
* AOI SHA256：`36b750be56ae0dea906996258068eaf9aaa71e01667eb328b9ce6bd1b48cbe80`
* 状态：`ACCEPTED`

## 当前生产目标

1. 从锁定的 12.5 米原始联合 TIFF 直接裁入确认范围。
2. 生成精确 2048 × 2048 数值高程预览网格。
3. 保留 NoData，禁止补洞，禁止 30 米替代。
4. 接入锁定的 OSM 水系中心线。
5. 漓江与湘江按 25 米步长采样，其他河流按 75 米步长采样。
6. 水系遇 NoData 断开，中心线坐标保持固定，显示宽度向两侧对称展开。
7. 网页默认垂直比例 1.00×，提供 512、768、1024 三档实时网格。
8. 2048 高程纹理持续参与坡面法线与着色，实时几何密度可以独立切换。

## 锁定来源

原始 DEM：

* Release：`guilin-v070-raw-mosaic-v001`
* Asset ID：`530206518`
* 文件：`guilin_raw_union_12_5m.tif`
* 大小：124,348,471 bytes
* SHA256：`9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4`
* 网格：17,408 × 18,867
* CRS：EPSG:32649
* 分辨率：12.5 m

水系：

* 当前生产副本：`sources/osm_hydrology.geojson`
* Git blob：`c00174242b68106cec9febcf24e0b94464b3727c`
* 来源中心线数量：漓江系统 21，湘江系统 39，其他河流 1,366
* 原中心线坐标只读

## 构建

```bash
python build_2048_hydrology.py \
  --mosaic guilin_raw_union_12_5m.tif \
  --hydrology sources/osm_hydrology.geojson \
  --output-dir build/data

python tests/validate_2048.py build/data --output build/static-data-qa.json
node tests/static_contract_test.mjs web
```

正式构建、公开部署、WebGL2 浏览器验证和截图证据由 `.github/workflows/guilin-v075-bootstrap.yml` 完成。
