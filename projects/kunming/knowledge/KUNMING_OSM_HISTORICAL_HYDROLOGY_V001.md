# 昆明 OSM 与历史水系知识合同 V001

## 目标

把湖泊、河流、溪流、沟渠、水库、宽河面和水工设施整理成可重复生成、可追溯、带年代和置信度的知识层。此知识层服务于昆明 DEM、历史地貌重建、网页水面材质和后续 Gaea 流向/沉积处理。

当前网页中任何临时手画河线或湖泊多边形都不属于正式水系。正式几何必须来自有引用的数据源，或者由 DEM 推导后再经历史资料核对。

## 固定范围

- 权威裁切 CRS：`EPSG:32648`
- 权威裁切像元：`12.5 m × 12.5 m`
- 权威裁切栅格：`5892 × 8095`
- 权威裁切面积：`7452.459375 km²`
- WGS84 查询包络：南 `24.572710196159`，西 `102.452264770003`，北 `25.496535815227`，东 `103.197928742950`
- 历史核心时期：`1940–1945`

## 资料优先级

### H0：年代明确的原始历史资料

优先寻找 1940–1945 年及更早的地形图、航空照片、军用地图、河湖图、城市图和工程图。若同一区域同时存在多个年份，应保留每个年份的独立几何版本，不得将不同年代拼成一条伪造水系。

首批官方目录包括：

1. 美国国会图书馆 World War II Military Situation Maps，1944–1945。
2. 美国陆军地图局、英国 War Office/GSGS 的二战时期中国与云南地图系列。当前尚未确认一张覆盖本裁切区的在线昆明图幅，必须继续按图幅索引查找。
3. 美国国会图书馆 1943 年 The Far East and adjoining areas，只用于区域背景与旧名发现，比例尺不足以直接描绘河岸。
4. 1891 年 Map of missions in China、1847 年 Map of the Chinese empire、1842 年 Carte de l'empire chinois et du Japon，只用于更早的名称、主要湖河存在性和检索线索，不能直接作为精细几何。
5. OpenHistoricalMap 中带 `start_date`、`end_date` 和来源说明的对象。昆明覆盖尚需逐项核验。

### H1：现代 OSM 当前数据

OSM 当前数据用于建立现代湖泊和河网骨架，包括名称、连通关系、流向、现代水库、沟渠和当前河岸。它不能自动代表 1940–1945 年状态。

### H2：OSM 历史版本

OSM full-history、对象 History 页面和 ohsome API 可用于恢复 OSM 自 2007 年前后开始的编辑版本、已删除对象和几何变化。OSM 时间戳表示制图编辑时间，不能直接当作河流或湖泊的形成时间。

### H3：DEM 水文推导

DEM 负责流向、汇流累积、谷底、洼地、湖面平坦度和上下游拓扑校验。DEM 可以提出候选支沟和修正拓扑，但不得覆盖有年代、有来源的历史几何。

## OSM 水系对象范围

### 线状水路

保留：

- `waterway=river`
- `waterway=stream`
- `waterway=canal`
- `waterway=ditch`
- `waterway=drain`
- `waterway=tidal_channel`
- `waterway=flowline`

OSM 水路线方向应表示下游方向。宽河流仍需保留中心线，同时提取河面区域。

### 面状水体

保留：

- `natural=water + water=lake`
- `natural=water + water=reservoir`
- `natural=water + water=river`
- `natural=water + water=canal`
- `natural=water + water=pond`
- `natural=water + water=basin`
- `natural=water + water=oxbow`
- `natural=water + water=lagoon`
- 旧式 `landuse=reservoir`
- 旧式 `waterway=riverbank`

湖泊和宽河面必须保留多边形及内部岛屿关系。湖中缓慢流向若有 `waterway=flowline`，应单独保存。

### 水工和节点

保留：

- `natural=spring`
- `waterway=dam`
- `waterway=weir`
- `waterway=waterfall`
- `waterway=lock_gate`
- `waterway=rapids`
- 涵洞、隧道、桥下水路相关的 `tunnel=*`、`culvert=*`、`covered=*`、`layer=*`

### 水路关系

保留 `type=waterway` 关系及成员角色：

- `main_stream`
- `side_stream`
- `spring`
- `mouth`

关系用来形成一条河流的统一对象，单个河段仍保留本地名称、宽度和季节性属性。

## 必须保留的属性

每个对象尽量保存：

- `osm_type`、`osm_id`、`version`、`timestamp`、`changeset`
- `name`、`name:zh`、`old_name`、`alt_name`、`loc_name`
- `waterway`、`natural`、`water`、`landuse`
- `width`、`intermittent`、`seasonal`、`tidal`、`salt`
- `start_date`、`end_date`
- `source`、`source:date`、`source:geometry`
- `wikidata`、`wikipedia`
- `bridge`、`tunnel`、`culvert`、`covered`、`layer`

## 时间语义

每条正式水系采用独立时间区间：

- `valid_from`
- `valid_to`
- `source_date`
- `source_date_precision`
- `historical_epoch`

OpenHistoricalMap 时间滑块优先使用 `YYYY`、`YYYY-MM` 或 `YYYY-MM-DD`。不确定日期同时保留原始文字和 EDTF 表达，不得把“约 19 世纪”强制改成某个虚构年份。

## 正式知识对象

每条河流或湖泊最终蒸馏为小型知识对象：

```json
{
  "feature_id": "kunming-hydro-...",
  "class": "river|stream|canal|lake|reservoir|pond|wetland",
  "geometry": "GeoJSON geometry or topology reference",
  "flow_direction": "downstream",
  "main_or_side": "main_stream|side_stream|null",
  "width_model": "fixed|measured|order_based|historical",
  "source_ids": ["..."],
  "valid_from": "1940",
  "valid_to": "1945",
  "confidence": 0.0,
  "dem_topology_check": "pass|warning|conflict",
  "historical_status": "verified|candidate|modern_only"
}
```

## 置信度规则

- `0.90–1.00`：同年代高分辨率地图或航片明确可见，并通过 DEM 拓扑。
- `0.75–0.89`：同年代地图明确可见，局部岸线或支流存在不确定。
- `0.55–0.74`：较早或较晚资料与 DEM 一致，可作为候选。
- `0.30–0.54`：只有现代 OSM 或 DEM 推导，历史状态未知。
- `<0.30`：来源冲突、几何无法核验，默认隐藏。

## 网页和材质规则

- 河流中心线固定，河宽滑块只能横向扩展显示宽度。
- 湖岸多边形固定，波浪只改材质法线和高光，不改岸线。
- 流速来自河流等级、坡降和汇水面积，不能靠随机方向。
- 现代水系、历史水系、候选水系必须能单独开关。
- 未完成历史核对前，网页必须标记为“现代 OSM 参考”或“DEM 候选”，不能称为 1940–1945 真值。

## 验收门槛

1. 当前网页手画水系从正式分支移除。
2. OSM 湖泊、河道和水路关系通过固定查询完整提取。
3. 几何转换到 `EPSG:32648` 后保持拓扑、方向和对象 ID。
4. 对每个有名主河、主要湖泊和水库记录来源、年代和置信度。
5. 与 DEM 的谷底、坡降和流向冲突必须生成报告，不允许静默修改。
6. 历史资料按年份分层，禁止跨年代融合。
7. OSM 署名固定为 `© OpenStreetMap contributors, ODbL 1.0`。

## 官方参考

- OSM Waterways：https://wiki.openstreetmap.org/wiki/Waterway
- OSM natural=water：https://wiki.openstreetmap.org/wiki/Tag:natural%3Dwater
- OSM relation:waterway：https://wiki.openstreetmap.org/wiki/Relation:waterway
- OSM full-history：https://wiki.openstreetmap.org/wiki/Planet_History
- Overpass API：https://wiki.openstreetmap.org/wiki/Overpass_API
- ohsome full-history extraction：https://docs.ohsome.org/ohsome-api/v1/endpoints.html
- OpenHistoricalMap：https://www.openhistoricalmap.org/
- Library of Congress maps：https://www.loc.gov/maps/
