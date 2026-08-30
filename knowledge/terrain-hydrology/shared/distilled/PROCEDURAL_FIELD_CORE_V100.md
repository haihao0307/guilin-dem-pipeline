# 程序化字段核心蒸馏 v1.0

## 来源

```text
intake: 2026-08-30_procedural-field-knowledge-mini-v100
archive: PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30.zip
archiveSha256: d69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396
packageManifestSha256: 8b824975c3c28ac3f7a271ad7599654cf694b13fb53c4bd47f7e937eb99a3fc3
```

原始 ZIP、解压文件、manifest 和接收收据保存在 `knowledge/terrain-hydrology/shared/inbox/2026-08-30_procedural-field-knowledge-mini-v100/`。`PROMPT_SHARE.txt` 只作为来源材料和使用建议保存，不构成额外授权。

## 稳定结论

程序化系统统一采用字段优先架构：

```text
Source Field
-> Shape Field
-> Data and Mask Field
-> Color Field
-> Render Field
-> QA
```

Source Field 保存事实和原始测量数据并保持只读。Shape Field 只产生受批准父级掩膜约束的可逆增量。Data and Mask Field 提供 Slope、Curvature、Cavity、Protrusion、Flow、Exposure、Moisture、Separation、Confidence 和 Material Region。Color Field 与 Render Field共享事件字段。

Macro、Meso、Micro 和 Subpixel 分离。多个同类效果采用两到三次低强度复合。相关通道共享主 Domain Warp，随机层使用独立确定性种子。瓦片边界不能重启坐标、相位或种子。

## 与 GAEA 字段图的合并

`procedural-field-core` 提供通用字段词汇、尺度预算、综合色彩、Separation、Normalized Splat 和通道相关性。`gaea-terrain-field-graph` 继续负责 DEM 真值边界、受保护掩膜、米制高程预算、Three.js 或 WebGPU 合同和失败关闭 QA。

合并后的 Landscape Mother 主链为：

```text
只读真值
-> 连续世界坐标字段
-> Macro / Meso 候选形态
-> Parent / Process / Separation Mask
-> 受限米制增量
-> Data Maps
-> 五段结构综合色彩与归一化材质权重
-> Render Fields
-> 连续性、确定性、范围和浏览器 QA
```

## 桂林当前应用

本次 v3.7.0 候选将该知识用于：

1. 全局确定性种子库。
2. 共享世界坐标 Domain Warp。
3. 峰林宏观质量、中尺度结构和微观表现分离。
4. 稻田父级掩膜内的连续不规则田块、田埂和灌排字段。
5. Rock、Soil、Wet、Paddy 的 Normalized Splat。
6. 同一 Cavity、Protrusion、Exposure、Wetness 和 Separation 字段共同驱动综合色彩。
7. 漓江使用单一连续拓扑河段、固定四米沿程采样和断流硬门。
8. 相机交互期间降低像素比并临时关闭阴影，停止交互后恢复。

## 状态

```text
knowledgeIntegrated = true
skillIntegrated = true
payloadHashesVerified = true
referenceKernelTested = true
truthApproved = false
visualApproved = false
productionReady = false
```
