# 桂林阳朔一平方公里地貌母体精细三维样板 v0.2.7

本版直接回应第一版三维成果过粗、喀斯特读数弱、植物层干扰和材质层次不足的问题。所有视觉证据由当前代码、当前数据和当前参数在 WebGL2 中实时生成。

## 真实底座

```text
source DEM: guilin_raw_union_12_5m.tif
source SHA256: 9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4
parent tile: native-r07-c02
truth grid: 81 × 81
truth spacing: 12.5 m
sample area: 1.000 km²
vertical scale: 1.0
```

## 三维精细化

源高程交点保持原值。三维显示网格细分为 641 × 641，网格间距 1.5625 米，用于承载可逆程序层。

```text
z_display = z_truth_interpolated
          + z_karst_additive_visual
          + z_field_bund_channel
```

喀斯特形体以真实局部高点为锚点，生成窄峰冠、陡壁、中坡切削、短峰脚、崖壁沟槽和坡脚碎屑过渡。该层属于视觉假设，可独立关闭，不声明为原生测绘高程。

田块层只在低坡、低地、湿润且避开真实水系和陡壁的位置生成连续田面、田埂和灌排沟渠。程序增量保持米制、可关闭和可回滚。

## Brick Mother 技术转译

本版吸收以下形成逻辑：

1. 宏观、中观、微观三层结构。
2. 独立 `shapeSeed`、`compositionSeed`、`poreSeed`、`weatherSeed` 和 `fieldSeed`。
3. fBm、ridged fBm、Worley、domain warp 和 separation mask。
4. AutoLevel、Clarity、MaskSharp、五段 CLUT 与归一化 Splat 权重。
5. 颜色、凹凸、粗糙度、凹腔和 AO 共用事件场。
6. 高频细节通过世界坐标程序场和屏幕导数微法线表现。
7. 全表面均匀噪点不得成为主要视觉结构。
8. 田块使用固定世界坐标基、低频域扭曲和连续灌排线，避免纹理游动和颗粒化迷宫。

## 三维交付硬规则

```text
renderMode = interactive-webgl2-3d
browserRenderedEvidence = true
conceptImageCount = 0
aiGeneratedAcceptanceImageCount = 0
```

页面必须能够旋转、平移、缩放、聚焦、切换层级和进行同相机原始与合成对照。截图只接受本轮运行时在真实浏览器中直接产生的证据。

## 删除内容

```text
plantLayerCount = 0
vegetationInstanceCount = 0
conceptImageCount = 0
aiGeneratedAcceptanceImageCount = 0
```

页面中没有树木、竹林、草地、植物点样和生态实例。

## 验收入口

发布目录：

```text
/guilin-mother-sample-v002/
```

人工视觉批准和生产批准持续保持 false。
