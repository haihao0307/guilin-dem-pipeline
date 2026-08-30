# 小王 GAEA 式程序化地形知识小包

版本：1.0  
日期：2026-08-30  
来源线：HOUSE / Brick Mother V2.7.5 的 GAEA 式场图蒸馏经验  
用途：给小王的程序化地貌生产线使用

## 这个包解决什么

这个小包把 Brick Mother 中已经验证过的场图思想抽离出来，转成适用于地形生产的核心知识。重点涵盖：

1. 多尺度噪声怎样形成自然地貌层级
2. Warp、Profile、Erosion、Data、Color、Render 如何分层
3. Rugged、Stratify、MicroErosion、RockMap、Flow、Curvature、Slope 等节点怎样组合
4. CLUT、Splat、ColorFX 怎样形成丰富、锐利、结构驱动的综合色彩
5. 多种随机种子怎样独立又协同
6. DEM 真值、程序化增强和渲染细节怎样严格隔离
7. Three.js、WebGPU、WebGL2 中怎样落地
8. 桂林、温州、昆明三类地形怎样采用不同图谱

## 最高约束

真实 DEM、OSM、GEBCO、岸线、水系、AOI、CRS、仿射变换和来源哈希属于真值资产，必须只读保存。

程序化节点只允许在明确的增强层工作：

```text
Z_truth       原始高程真值
Z_delta       有边界、有置信度、有尺度范围的增强量
Z_render      Z_truth + bounded(Z_delta)
N_micro       只进入法线或视觉位移的微细节
Z_collision   真值或经过批准的低频增强，不含高频着色细节
```

任何节点都不得擅自移动山峰、河道、海岸、湖岸、道路、机场、聚落或行政边界。

## 建议阅读顺序

1. `01_GAEA式程序化地形核心.md`
2. `03_DEM真值与程序化增强边界.md`
3. `02_节点职责与地形图谱配方.md`
4. `04_ThreeJS_WebGPU实现骨架.md`
5. `terrain_graph_recipes.json`
6. `terrain_field_reference.js`
7. `05_QA与失败关闭清单.md`
8. `PROMPT_给小王_直接执行.txt`

## 包内文件

| 文件 | 作用 |
|---|---|
| `01_GAEA式程序化地形核心.md` | 核心理论与方法 |
| `02_节点职责与地形图谱配方.md` | 节点职责和桂林、温州、昆明配方 |
| `03_DEM真值与程序化增强边界.md` | 真值保护合同 |
| `04_ThreeJS_WebGPU实现骨架.md` | 运行时架构与字段接口 |
| `05_QA与失败关闭清单.md` | 自动 QA、视觉 QA 和停止条件 |
| `QUICK_CARD_一页速查.md` | 一页式速查卡 |
| `terrain_graph_recipes.json` | 机器可读图谱 |
| `terrain_field_contract.schema.json` | 机器可读字段合同 Schema |
| `terrain_field_reference.js` | 无依赖的最小参考内核 |
| `SOURCES_OFFICIAL.md` | 官方资料入口 |
| `PROMPT_给小王_直接执行.txt` | 可直接交给小王的执行说明 |

## 明确排除

这个包不携带砖块模型、砖材参数、图片、贴图、HTML 演示、Gaea 工程文件和 Gaea 二进制程序。它只携带可以迁移到地形生产线的核心方法。

## 当前状态

```json
{
  "knowledgeHandoffReady": true,
  "terrainRuntimeImplemented": false,
  "demTruthImmutable": true,
  "proceduralDetailRequiresQA": true,
  "productionApproved": false
}
```
