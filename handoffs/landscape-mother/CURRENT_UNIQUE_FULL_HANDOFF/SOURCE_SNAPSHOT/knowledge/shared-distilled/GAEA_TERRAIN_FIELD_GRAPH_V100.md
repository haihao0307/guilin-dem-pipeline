# GAEA 式地形字段图蒸馏 v1.0

## 来源

```text
intake: 2026-08-30_xiaowang-gaea-terrain-minipack-v100
archive: XIAOWANG_GAEA_TERRAIN_KNOWLEDGE_MINIPACK_2026-08-30_v1.0.zip
target: 小王 / 程序化地貌生产线
```

原包、解压文件、SHA256 manifest 和收据保存在 `knowledge/terrain-hydrology/shared/inbox/2026-08-30_xiaowang-gaea-terrain-minipack-v100/`。包内的直接执行提示词只作为来源材料保存，不构成执行授权。

## 稳定结论

GAEA 式方法的可迁移价值不是复制某个专有节点图，而是建立一套连续、分层、可追溯的字段编译体系：

```text
只读真值
-> 地形导数和真实水文
-> 多尺度候选形态
-> Process Mask 和 Separation Mask
-> 有米制预算的可逆高程增量
-> Rock、Soil、Wetness、Exposure 等 Data Maps
-> 结构驱动的颜色、法线、粗糙度和 AO
-> Three.js 或 WebGPU 运行时资产
-> 固定相机、数据通道、哈希和失败证据
```

Macro、Meso、Micro 和 Subpixel 必须分离。真实 DEM、河流、湖岸、海岸、机场、道路、聚落、CRS、transform、NoData 和来源哈希保持只读。视觉 Flow 只能用于风化、湿润或颜色辅助，不能替代真实水文。

## 对现有体系补齐的能力

现有 `dem-procedural-landscape` 已经管理真值、地貌、水系、生态、历史重建和发布。本次增加的 `gaea-terrain-field-graph` 分支补齐：

```text
连续字段图合同
内部节点家族映射
八类以上确定性种子隔离
世界坐标跨瓦片连续性
受置信度和保护掩膜约束的高程增量
结构场共同驱动几何、颜色、粗糙度、法线和 AO
桂林、温州、昆明的差异化图谱
CPU、Worker 和 GPU 的明确分工
数据通道、LOD、接缝和浏览器证据
任何关键门失败时 productionReady=false
```

## 地区边界

桂林冻结峰位、河谷和永久水体，增强只进入批准的岩溶表面区域。温州冻结岸线、水深和真实水系，海岸颜色可以变化，潮间带高程需要独立批准数据。昆明冻结盆地、湖泊、城市、机场、主要道路和主脊位置，只允许批准自然地形内的低频候选增强。

三地共享方法、schema、测试和运行时合同，不共享坐标、DEM 像元、水系、岸线、城市掩膜或未经验证的数值参数。

## 完整生产闭环

```text
GIS truth and source receipts
-> DEM preflight
-> projected working grid and context manifest
-> field graph contract
-> reviewed Gaea or independent field implementation
-> versioned bounded deltas and data maps
-> geospatial restoration and QA
-> Three.js or WebGPU packaging
-> desktop and mobile browser QA
-> user visual review
-> approved publication or rollback
```

真实 GAEA 2.x 工程、Build Swarm、CRS 恢复和网页打包继续由仓库中的 `process-dem-with-gaea` 技能负责。本条目只补齐字段图知识和跨阶段合同，不声明已经运行 GAEA、生成生产数据或获得视觉批准。

## 当前状态

```text
knowledgeIntegrated=true
skillIntegrated=true
sourceHashesVerified=true
referenceKernelTested=true
gaeaRuntimeExecuted=false
truthApproved=false
visualApproved=false
productionReady=false
```
