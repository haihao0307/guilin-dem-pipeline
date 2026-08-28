# 温州 V200 17 源 DEM 真值与水文重建

本目录是温州新 17 张 DEM 裁切成果的独立生产线。它从 `review/wenzhou-uncropped-20260826` 建立，保留 PR #49 与 PR #53 的历史成果，只复用经过验证的方法、来源与许可，禁止拉伸或错位套用旧 AOI 资产。

## 当前权威输入

```text
文件名: WENZHOU_17TILE_SCREENSHOT_CROP_12_5M_COG.tif
预期字节: 136760745
SHA-256: c1da93dca81abc2ee9edaa47496d80c6fa36155e11c9b61464f4f2b547659b43
CRS: EPSG:32651
网格: 17555 × 17918
像元: 12.5 m × 12.5 m
范围: [187912.5, 3019612.5, 407350.0, 3243587.5]
```

精确 COG 二进制和精确源 ZIP 当前没有挂载到执行环境。Git LFS 上传、fresh clone 下载验证、GEBCO 对齐、海陆掩膜与三维运行时继续保持关闭。

## 已完成并验证

### OSM 海岸线与水系

新 AOI 的 OSM 获取与投影骨架已经完成，并通过 fresh clone 文件哈希复核。

```text
源海岸线 way: 1058
源水系 way: 6785
投影海岸线 part: 1064
投影水系 part: 6797
手工几何: 0
fresh clone verified: true
河口拓扑: pending
```

收据：

```text
projects/wenzhou/v200/reports/OSM_HYDROLOGY_RECEIPT.json
```

### OSM 地名

以下六个地名已取得真实 OSM element ID、WGS84 坐标与 EPSG:32651 坐标：

```text
青田
玉壶镇
温州城
仙溪镇
翁垟镇
海门
```

`自然岛` 没有找到满足精确名称规则的 OSM 要素，继续保持 unresolved。没有使用手工坐标，也没有把范围外坐标夹到边缘。

```text
resolved: 6
unresolved: 1
manual coordinates: 0
edge clamping: 0
fresh clone verified: true
```

收据：

```text
projects/wenzhou/v200/reports/OSM_PLACES_RECEIPT.json
```

## 后续执行顺序

1. 挂载精确 COG 或精确源 ZIP。
2. 核验字节数与 SHA-256。
3. 通过 Git LFS 存储精确 COG，并完成 fresh clone 复核。
4. 按新 AOI 重新获取 GEBCO 2026，生成新的 100 m EPSG:32651 海底 COG。
5. 使用真实 OSM 海岸线建立海陆拓扑与岛屿孔洞。
6. 河道、海岸线和地名在同一个 EPSG:32651 世界坐标中按新 DEM 贴地。
7. 完成浏览器 QA 后再生成新的可视化页面。

## 硬规则

```text
oldQingjiangTruthUsed=false
syntheticGapFill=false
manualRiverGeometry=false
manualCoastlineGeometry=false
manualPlaceCoordinates=false
edgeClamping=false
verticalScale=1.0
publicDeploymentAllowed=false
visualAcceptance=false
productionReady=false
```

旧真值、旧水文、旧海底与旧运行时继续保存在原分支中，不能在本分支中冒充新 17 源范围的完成成果。
