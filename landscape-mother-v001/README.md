# Landscape Mother Kernel V1

这是一个从干净 `main` 基线重建的地貌母体内核。公开样板只包含真实数值高程、真实数值水系、程序代码、合同与数值 QA。

## 核心权力边界

```text
真实 12.5 米 DEM   决定峰、谷、坡向、相对高度和宏观轮廓
Landscape Mother   负责真值保持型细分、地貌事件、田块关系和程序材质
Brick Mother 逻辑  负责宏观、中观、微观形成场和多通道关联
```

程序系统没有造山权。高密度三维网格在原始高程节点上保持零误差，局部形变只服务于岩壁、裂隙、层理、冲刷、坡积、田埂和沟渠。

## 小体量运行包

构建阶段从锁定的 8 MiB 父瓦片中裁出 `81 × 81` 原生窗口，并从全域水系中裁出样板内真实线段。公开运行包不携带完整父瓦片。

运行目录只保留：

```text
index.html
style.css
kernel.js
renderer.js
app.js
contract.json
data/sample-height.i16.bin
data/sample-water.f32.bin
data/sample-manifest.json
qa/browser-qa.json
qa/release-evidence.json
```

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

浏览器证据只保存数值签名、像素哈希、亮度分布、边缘能量、几何统计和真值误差。

## Formation Field

内核把同一批事件场同时送入形体、颜色、粗糙度、微法线和 AO：

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

独立种子分别控制形体、裂隙、层理、颜色、湿度、地块和沉积。更换一个种子不重写无关层。

## 当前状态

```text
visualAcceptance=false
productionReady=false
```
