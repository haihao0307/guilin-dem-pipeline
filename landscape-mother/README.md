# Landscape Mother 连续字段图 V2

这一版把两套正式知识合并进同一个可回滚内核：

```text
GAEA Terrain Field Graph
+ Procedural Field Core
+ 真实 12.5 米 DEM
+ 真实数值水系
```

## 真值权力边界

```text
真实 12.5 米 DEM
  决定峰、谷、坡向、相对高度和宏观轮廓

真实水系
  决定中心线、上下游顺序和空间身份

Landscape Mother V2
  负责真值保持型细分、受限米制增量、连续字段、综合色彩、
  实时程序材质、河面接缝显示和运行时 LOD
```

程序系统没有移动真实峰位、河谷和河流中心线的权限。

## 字段管线

```text
Source Field
→ Shape Field
→ Data and Mask Field
→ Color Field
→ Render Field
→ QA
```

V2 新增可检查的 Cavity、Protrusion、Separation、Color Driver、Parent Mask、
Process Mask、Roughness Driver 与 AO Driver。几何、颜色、粗糙度、法线和 AO
共享同一批形成事件。

## 性能层级

```text
Preview  相机交互，四倍索引步长与较轻材质预算
Review   日常审查，两倍索引步长与完整中尺度结构
Evidence 固定相机，全三角形与完整数值证据
```

拖动相机时会临时进入 Preview，停止交互后恢复用户选择的层级。

## 连续水面

真实水系中心线保持只读。每个真实线段仍使用原始端点，水面在真实端点处增加
程序连接扇面，用于封闭分段显示裂缝。连接扇面不增加或移动河流中心线。

## 小体量运行包

构建阶段从锁定的 8 MiB 父瓦片裁出 `81 × 81` 原生窗口，并从全域水系中裁出
样板内真实线段。公开运行包只携带紧凑数值资产、程序代码、合同与 JSON QA。

## 禁止项

```text
PNG / JPG / JPEG / WEBP / GIF / SVG
材质贴图
高度图片
法线图片
颜色图片
sampler2D
HTML img
CSS background-image
截图 artifact
植物和生态实例
程序宏观山体
```

## 知识来源

```text
skill/xiaowang-gaea-terrain-field-v100
commit 6ac47d984bfca8336a7c0f58d176ab8153db26cd

PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30.zip
SHA256 d69ecd2677507db9342a1d66092a8d6cf4255141346b14cc4629303bf1c4f396
```

## 当前状态

```text
truthApproved=false
visualAcceptance=false
productionReady=false
```
