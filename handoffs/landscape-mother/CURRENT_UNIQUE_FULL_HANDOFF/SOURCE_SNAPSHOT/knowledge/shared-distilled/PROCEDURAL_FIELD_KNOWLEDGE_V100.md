# 程序化字段核心知识蒸馏 v1.0

## 来源

```text
intake: 2026-08-30_procedural-field-knowledge-mini-v100
archive: PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30.zip
archive_sha256: d69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396
target: DEM 地形生产线 / Landscape Mother
```

原始压缩包、九个声明载荷、包清单和接收回执保存在
`knowledge/terrain-hydrology/shared/inbox/2026-08-30_procedural-field-knowledge-mini-v100/`。
`PROMPT_SHARE.txt` 只保留为来源材料，不产生额外执行授权。

## 稳定知识

程序化字段的通用闭环固定为：

```text
Source Field
→ Shape Field
→ Data and Mask Field
→ Color Field
→ Render Field
→ QA
```

六项长期原则：

1. 所有复杂结果拆成可检查的中间字段。
2. Macro、Meso、Micro 分开控制。
3. 同类效果采用两到三次低强度复合。
4. 颜色由 Data Field 与 Mask Field 驱动。
5. 几何、颜色、粗糙度、法线与 AO 共享同一事件字段。
6. 随机层使用独立种子并保持确定性。

## Landscape Mother 映射

```text
Source Field
  = z_truth_m、真实水系、CRS、transform、NoData、来源哈希、保护掩膜

Shape Field
  = 受 Parent Mask、Process Mask、Confidence 与米制预算约束的可逆 Δz

Data and Mask Field
  = Slope、Curvature、Cavity、Protrusion、Flow、Exposure、
    Moisture、Separation、Confidence、Material Region

Color Field
  = Auto Level、Local Clarity、Controlled Sharpness、
    Five Stop Color Map、Normalized Splat、Color Correction

Render Field
  = Albedo、Roughness、Normal、AO、Wetness、Detail Normal、Material Weights

QA
  = 确定性、范围、接缝、真值保护、浏览器解码、固定相机和视觉审批
```

## 多尺度字段

Macro 负责整体分区与低频变化。Meso 负责层理、裂隙、沟槽、侵蚀和综合色斑。
Micro 优先进入法线、粗糙度和颜色，避免持续污染主形体。

允许的基础字段包括 Gradient 或 Value Noise、FBM、Ridged Field、Turbulence、
Cellular Field 与 Domain Warp。多个通道共享主扭曲字段，避免形体、颜色和粗糙度彼此漂移。

## 遮罩和合成

四级遮罩长期保留：

```text
Truth Mask
Parent Mask
Process Mask
Separation Mask
```

常用 Combine 模式包括 Blend、Add、Subtract、Multiply、Max、Min、Screen 和 Difference。
所有几何结果都必须在允许区域内进行米制限幅。

## 独立种子

正式种子通道为：

```text
master
shape
warp
structure
damage
color
weather
micro
```

修改 `color` 不得改变 Shape。修改 `micro` 不得移动 Macro 结构。
跨瓦片与跨 LOD 必须使用投影世界坐标和稳定哈希。

## 性能层级

```text
Preview  快速交互，降低三角形与高频材质预算
Review   日常视觉校准，保留中尺度结构
Evidence 固定相机、完整精度、数值证据与最终 QA
```

只有 Shape、Structure、Damage 的变化需要重建几何。
Color、Weather、Roughness 等变化优先作为 GPU 参数或缓存字段更新。

## 与 GAEA 字段图的关系

`gaea-terrain-field-graph` 提供真实 DEM 项目的字段图治理、米制增量、Data Maps、
Three.js/WebGPU 合同与失败关闭规则。本知识分支提供更通用的字段、噪波、综合色彩、
事件通道相关性、种子和性能词典。两者共同组成 Landscape Mother 的字段大脑。

## 当前状态

```text
knowledgeIntegrated=true
skillIntegrated=true
packageHashesVerified=true
runtimeCandidate=landscape-mother-v002
truthApproved=false
visualApproved=false
productionReady=false
```
