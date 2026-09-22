# R19 Palau DEM 分类与归零规则

日期：2026-09-22

## 已收到的两帧

- `AP_08074_FBD_F0130_RT1.zip`
- `AP_08074_FBD_F0140_RT1.zip`

两包原始字节、内部 DEM 文件、CRS、transform、bounds、NoData、dtype、尺寸与 SHA-256 已完成本地逐字节核验，并写入 `R19_PALAU_DEM_SOURCE_INTAKE.json`。

## 必须纠正的前提

这两个 `.dem.tif` 不是原生 12.5 m 地形测量真值。

包内 ISO 元数据明确写明：

- 产品是 ASF ALOS PALSAR 高分辨率 RTC（RT1）；
- DEM 用于 SAR 地形校正；
- DEM 来源是 `SRTMGL1`，名义分辨率 30 m；
- ASF 2015-06 v1.1 做过附加修正；
- 12.5 m 是 RTC 输出栅格的 posting，不等于源 DEM 获得了原生 12.5 m 地形信息。

官方 ASF 文档也明确说明，RTC 包内 DEM 是处理参考层，经过重采样和高程基准处理，不应直接当作独立 DEM 产品。

来源：

- https://docs.asf.alaska.edu/datasets/palsar/
- https://docs.asf.alaska.edu/datasets/using_ASF_data/
- https://gis.asf.alaska.edu/arcgis/rest/services/ASF_SampleData/RTC_Optional_DEM/ImageServer

## 当前数值为何不是海面零

F0130 存储值约 `52–273 m`，F0140 约 `54–307 m`；大面积海域集中在约 `62–68 m`，不是 0。

这说明当前数值不能直接解释为相对平均海面的高程。RTC 处理用 DEM 会经过适合 SAR 几何计算的垂直基准修正；在完成精确 geoid / ellipsoid 反算以前，禁止直接把这些值送入 `PalauWorld.sample()` 作为海拔。

## 两帧拼接事实

- CRS 相同：`EPSG:32653`。
- 存储 posting 相同：12.5 m。
- 像元原点不同：不能直接按数组上下拼接。
- 重叠区约 `68.3835 km × 11.687 km`。
- QA 中将 F0140 仅为比较目的双线性采样到 F0130 重叠格网：约 506 万有效样本，RMSE 约 `0.284 m`，约 98.86% 在 1 m 以内。

这证明两帧来自一致的基础高程源，但不授权把 QA 重采样结果当生产真值。

## 冻结规则

1. 两个 ZIP 和两个 `.dem.tif` 原始字节永久只读，不覆盖、不压缩、不改写。
2. 原始层名称固定为 `RTC_REFERENCE_DEM`，不得标为 `NATIVE_12_5M_DEM`。
3. 必须先恢复垂直基准，使平均海面候选零点和潮位系统处于同一基准。
4. 必须建立显式共同格网合同；任何重采样只能生成独立派生层，不能替代原始文件。
5. NoData 不填洞；岸线、礁盘、channel 不从平滑或猜测生成。
6. 两张用户权威图原字节及其坐标叠加 QA 尚未恢复前，仍禁止展示新三维地图。
7. 这两帧可作为 Palau 主岛链基础地形证据，但最终精度声明上限必须按源 DEM 30 m 处理，不能宣称 12.5 m 原生地形精度。

## 当前状态

- `sourceBytesLocallyVerified=true`
- `twoDemFramesPresent=true`
- `native12_5mTruth=false`
- `verticalDatumNormalized=false`
- `readyForVisualBuild=false`
- `visualAcceptance=false`
- `productionReady=false`
