# Landscape Mother Kernel V1

这是从干净 `main` 基线重建的地貌母体内核。公开样板只携带真实数值高程、真实数值水系、程序代码、合同与数值 QA。

## 核心权力边界

```text
真实 12.5 米 DEM   决定峰、谷、坡向、相对高度和宏观轮廓
Landscape Mother   负责真值保持型细分、地貌事件、田块关系和程序材质
Brick Mother 逻辑  负责宏观、中观、微观形成场和多通道关联
```

程序系统没有造山权。高密度三维网格在全部原始高程节点上保持零误差，局部形变只服务于岩壁、裂隙、层理、冲刷、坡积、田埂和沟渠。

## 清晰的小型内核

内核按职责拆成四组薄模块：

```text
kernel-core / kernel-cache
kernel-fields / kernel-fields-evaluate
renderer-core / renderer-mesh / renderer-camera / renderer-draw
renderer-terrain-shaders / renderer-water-shaders / renderer-field-clarity
app-core / app-ui / app
```

`kernel.js`、`renderer.js` 和 `app.js` 只负责组装公开接口。每个模块都能独立检查，没有网页级巨型脚本，也没有复制同一套字段逻辑。

## 小体量数值包

构建阶段从锁定的 8 MiB 父瓦片中裁出 `81 × 81` 原生窗口，并从全域水系中裁出样板内真实线段。公开运行时不携带完整父瓦片。

```text
sample-height.i16.bin  13,122 bytes
sample-water.f32.bin      728 bytes
公开数值资产合计       13,850 bytes
```

## 强制清零

```text
materialTextureCount=0
terrainImageTextureCount=0
imageFileCount=0
screenshotArtifactCount=0
plantLayerCount=0
vegetationInstanceCount=0
proceduralMacroMountains=false
```

浏览器证据只保存数值签名、像素哈希、亮度分布、边缘能量、几何统计和真值误差。

## Formation Field

同一批事件场同时驱动形体、颜色、粗糙度、微法线和 AO：

```text
真实坡度 / 曲率 / TPI / 河距
  + Domain Warp
  + Ridged fBm
  + Cellular Plate
  + Strata
  + Fracture
  + Rill
  + Separation
  + CLUT5
  + Splat
```

独立种子分别控制形体、裂隙、层理、颜色、湿度、地块和沉积。更换一个种子不会改写无关层。

## 当前代码基线

当前分支已经合入 `main` 的水系网络 V6 代码基线。构建时仍然只读取已经发布并通过哈希校验的权威数值水系资产。权威资产更新后，同一内核会自动重新裁取样板水系，不需要复制或重写 Landscape Mother 逻辑。

## 当前状态

```text
visualAcceptance=false
productionReady=false
```
