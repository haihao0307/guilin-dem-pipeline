# 昆明翠湖 20000 平方公里 ASF DEM 项目

本目录执行以昆明翠湖为中心的 20000 平方公里正方形 DEM 下载与拼接。

## 固定范围

- 中心：`102.70228 E, 25.05042 N`
- 项目投影：`EPSG:32648`
- 正方形面积：`20000.0 km²`
- 边长：`141421.356237 m`
- 输出像元间距：`12.5 m`
- 权威 AOI：`aoi/kunming_cuihu_20000km2_square.geojson`

## 数据标识

正式标识为：

`12.5米输出像元的ASF RTC参考DEM`

`native12_5mSurveyClaim=false`。

项目复用仓库现有 NASA ASF DAAC、ALOS PALSAR、`RTC_HI_RES` 下载和拼接链。该阶段不启用 Copernicus GLO-30、Mapzen、AWS Terrain Tiles、SRTM 预览、合成地形或其他 30 米最终回退。

## Windows 一键执行

在完整仓库工作树中双击：

```text
projects\kunming\local_tools\RUN_KUNMING_ASF_12_5M_KEEP_OPEN.cmd
```

默认工作目录：

```text
C:\HaihaoDEM\Kunming_Cuihu_20000km2_12_5m
```

也可通过环境变量 `KUNMING_DEM_WORK_ROOT` 指定其他磁盘目录。

## 认证顺序

本地执行器依次检查：

1. 当前进程中的 `EARTHDATA_TOKEN`
2. `%APPDATA%\HaihaoDEM\earthdata-token.dpapi`
3. `C:\HaihaoDEM\ASF_v104_local\scripts\run_chrome_session_download.ps1`

凭据只保存在用户的 Windows 环境中。仓库、日志和结果文件不得保存密码、Token、Cookie 或浏览器配置。

已经存在可用 DPAPI Token 或 ASF 登录会话时，无需再次提交密码。

## 处理顺序

1. 复制项目 AOI 与配置到本地工作目录。
2. 安装或复用共享 Python 环境。
3. 调用 ASF SearchAPI 生成覆盖计划。
4. 通过保存的本地认证状态下载选定产品。
5. 保存源文件、元数据、下载记录和 SHA-256。
6. 提取 `*.dem.tif` 与 `*_dem.tif`。
7. 拼接到 `EPSG:32648` 的 12.5 米对齐网格。
8. 输出 COG、来源计数、填补分类、预览和 QA。

## 主要输出

```text
outputs\KUNMING_CUIHU_20000KM2_ASF_RTC_12_5M_COG.tif
outputs\KUNMING_CUIHU_source_count_COG.tif
outputs\KUNMING_CUIHU_fill_class_COG.tif
metadata\selected_products.json
metadata\source_manifest.json
reports\QA_REPORT.json
reports\DEM_PREVIEW.png
logs\LAST_KUNMING_ASF_12_5M.txt
```

下载失败时保留 `.part` 文件和计划，可以继续执行。认证或覆盖不足时流程会停止，不会切换到 30 米来源。
