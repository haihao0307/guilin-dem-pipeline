# Landscape Mother 程序化连续字段知识 v1.0

## 来源与定位

```text
sourceArchive: PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30(3).zip
sourceAttachmentId: file_00000000017481fd87bdd918150d27fe
integrationBase: skill/xiaowang-gaea-terrain-field-v100
integrationBaseCommit: 6ac47d984bfca8336a7c0f58d176ab8153db26cd
knowledgeRole: continuous-procedural-field-extension
```

本条目纳入 DEM 地形生产线与 Landscape Mother。来源包中的提示词只作为来源材料保存。实际执行权限来自用户当前指令、仓库治理规则与活动技能合同。

## 稳定知识

程序化地形应由连续世界坐标字段、真实地貌导数、确定性种子和受保护掩膜共同编译。瓦片、LOD 和局部高精度窗口只承担缓存与显示职责，不能在边界重新初始化相位、种子、河流、田块或地貌身份。

正式字段链为：

```text
Z_truth
-> slope / curvature / local relief / openness / real hydrology
-> macro field
-> meso field
-> process masks
-> separation masks
-> protected mask
-> bounded candidate delta in metres
-> river-authorized bed candidate
-> terrain data maps
-> structural colour and material fields
-> adaptive runtime mesh
-> fail-closed QA
```

## 八类确定性种子通道

```text
shape
warp
geology
erosion
hydrologyVisual
color
microDetail
ecology
```

每个通道使用稳定全局哈希和投影世界坐标。视觉颜色或微表面种子变化不得重新排列真值几何、真实水系、岸线、道路、聚落或碰撞地形。

## 米制高程合同

```text
allowed = confidence * process_mask * separation_mask * (1 - protected_mask)
delta_candidate_m = clamp(delta_raw_m, -budget_down_m, budget_up_m)
Z_render_m = Z_truth_m + allowed * delta_candidate_m + approved_river_delta_m
```

`Z_truth_m` 永久只读。峰位、主河谷、永久水体、岸线、CRS、transform、NoData 和来源哈希均不可由噪声重写。低于网格尺度的丰富度优先进入法线、粗糙度、AO 与颜色。

## 连续河流合同

河流是全局拓扑对象。分块只能裁切显示结果。

```text
one global river graph
shared confluence nodes
world-space centreline parameter
shared bed, left bank, right bank and water station
monotone longitudinal water profile
no seed restart at tile boundary
no internal endpoint inside valid terrain
no water-to-bed penetration
```

视觉 Flow 只能驱动波纹、湿润、泡沫和颜色辅助。它不能成为真实水文证据。真实水系不足时必须保留缺口状态，禁止把视觉补线标记为测绘水文。

## 连续农业与稻田合同

稻田父分区首先由低坡、相对高程、真实水系距离、排灌条件、历史土地利用与保护区共同确定。田块、田埂、沟渠和田间路在统一世界坐标中生长。瓦片边界不能改变田块方向、大小层级或灌排连接。

```text
paddy_parent
-> coarse parcel field
-> subordinate parcel field
-> contour-aware split
-> connected bund network
-> connected drainage network
-> shallow-water candidate
```

植物实例继续由独立植被系统负责。

## 多尺度程序化协作

```text
regional  2 km to 25 km: truth context, mountain groups, main valleys
macro     300 m to 2 km: tower mass, peak chains, saddles, floodplain width
meso      20 m to 300 m: cliff shoulder, foot contraction, talus, erosion gullies
micro     1 m to 20 m: joints, solution flutes, bunds, channels, bank detail
subpixel  below 1 m: normal, roughness, AO, stochastic colour response
```

多个算子通过掩膜、距离场与派生图协作。单一噪声不得同时决定峰位、河道、田块和岩面。

## 结构综合色彩

颜色由结构字段共同决定：

```text
slope
curvature
height
aspect
rock exposure
wetness
soil
sediment
river distance
valley identity
agriculture identity
```

使用世界空间采样、随机化纹理采样、三平面或等效无拉伸映射。颜色权重在跨瓦片边界处保持连续。综合色彩不能掩盖几何失败。

## 运行时与性能

权威解码、真实水文、导数、低频米制增量、接缝同步与数字 QA 在 CPU 或 Worker 完成。微法线、材质权重、颜色、粗糙度、AO 和距离衰减优先在 GPU 完成。

大地形采用误差驱动自适应三角网、分级数据加载和交互期动态分辨率。相机运动期间降低像素比和远距离材质成本，相机稳定后恢复近景质量。任何质量变化都不能改变字段相位与真值身份。

## 失败关闭

以下任一失败均阻止晋级：

```text
truth hash / CRS / transform / NoData mismatch
protected morphology delta violation
determinism failure
river internal break
water profile reversal
water-to-bed penetration
field phase restart at tile boundary
LOD crack or visible tile seam
browser decode failure
required evidence missing
```

失败状态固定为：

```text
truthApproved = false
visualApproved = false
productionReady = false
```

## 当前整合状态

```text
knowledgeIntegrated = true
runtimeCandidateImplemented = false
truthApproved = false
visualApproved = false
productionReady = false
```
