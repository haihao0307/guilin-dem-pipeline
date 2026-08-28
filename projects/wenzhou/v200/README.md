# 温州 V200 17 源 DEM 真值与水文重建

本目录是温州新 17 张 DEM 裁切成果的独立生产线。它从 `review/wenzhou-uncropped-20260826` 建立，保留 PR #49 与 PR #53 的历史成果，只复用经过验证的方法、来源与许可，不直接拉伸或错位套用旧 AOI 资产。

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

当前分支先冻结身份、AOI、OSM 获取合同与执行状态。精确 COG 二进制尚未在本执行环境中出现，所以 Git LFS 上传、fresh clone 下载验证、GEBCO 对齐、海陆掩膜和三维运行时均保持关闭。

## 执行阶段

1. Stage 0：冻结 17 源 COG 身份、AOI、源包收据与阻断状态。
2. Stage 1：按照新 AOI 重新获取 OpenStreetMap 海岸线、河流、溪流、运河与潮沟，保留原始 Overpass 响应、查询、OSM way ID、许可与校验和。
3. Stage 2：精确 COG 进入 Git LFS，并以相同字节数与 SHA-256 完成 fresh clone 验证。
4. Stage 3：按照新 AOI 重新获取 GEBCO 2026，并生成新的 100 m EPSG:32651 海底 COG。禁止拉伸旧海底。
5. Stage 4：用真实 OSM 海岸线建立海陆拓扑，河道按新 DEM 贴地，地名使用带来源 ID 的独立点图层。
6. Stage 5：真实浏览器 QA 后才生成新的可视化页面。

## 硬规则

```text
oldQingjiangTruthUsed=false
syntheticGapFill=false
manualRiverGeometry=false
manualCoastlineGeometry=false
manualPlaceClamping=false
verticalScale=1.0
publicDeploymentAllowed=false
visualAcceptance=false
productionReady=false
```

旧真值、旧水文、旧海底与旧运行时继续保存在原分支中，不能在本分支中冒充新 17 源范围的完成成果。
