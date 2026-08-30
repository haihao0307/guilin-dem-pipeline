# 桂林 DEM-M03 一平方公里地表母体试验 v0.1.0

本目录把小李交付的 `dem-procedural-surface-ecology` 技能约束到桂林当前唯一的原生 12.5 米数值真值上，建立第一块可直接视觉判断的一平方公里闭环。

## 唯一目标

验证以下方法在真实桂林高程与真实线状水系上是否成立：

1. 从原生高程派生坡度、低地、湿度与裸岩字段。
2. 在受坡度、水系距离、低地和岩面硬约束的父级掩膜内生成稻田候选。
3. 以世界坐标和固定种子生成田块身份、田面拟合、田埂和田内灌排微增量。
4. 将全部程序结果保存在可关闭、可回滚的运行时字段中。
5. 用同一相机直接比较原始真值和合成样板。

## 权威输入

```text
source release: guilin-native-12p5m-single-truth-v001
source SHA256: 9490b1bd34f67336352cf448729f763ae4e241637d821961efd0290e29d6c9d4
CRS: EPSG:32649
native spacing: 12.5 m
source tile: native-r05-c01
hydrology: immutable OSM river / stream / canal render asset
```

构建器先在旧生态演示中心附近寻找最近的真实 river 或 stream，再把中心吸附到原生 12.5 米像元网格。最终窗口固定为 `81 × 81` 个原生样本，首尾样本间距为 `1000 × 1000 m`。

## 输出

GitHub Actions 生成独立 artifact：

```text
index.html
sample-manifest.json
qa-report.json
```

`index.html` 是单文件 WebGL2 页面，直接从嵌入的原生 `int16` 数值样本建立网格，不使用高度图片贴图，也不加载外部运行时依赖。

## 分层查看

```text
真实高程
坡度与裸岩
湿度与真实水系
稻田候选
田块微地形
合成样板
生态适生场
原始 / 合成对照
```

## 固定边界

```text
truthReadOnly=true
sourcePixelWindowInteger=true
resampled=false
syntheticGapFill=false
verticalScale=1.0
sourceHydrologyCoordinatesMutated=false
manualCenterlineAdded=false
syntheticGapLineAdded=false
historicalLandUseClaim=false
vegetationInstancesIncluded=false
visualAcceptance=false
productionReady=false
```

田内沟渠属于试验性农业微地形字段，不写入权威水系。稻田和生态层均为方法验证结果，不宣称现代或历史真实土地利用。

## 本地构建

```bash
python experiments/guilin-dem-m03-sample-v001/build_sample.py \
  --manifest input/NATIVE_ELEVATION_MANIFEST.json \
  --tile input/native-r05-c01-2048x2048-i16.bin \
  --hydrology-manifest input/osm-waterways-manifest.json \
  --hydrology-segments input/osm-waterway-segments.f32.bin \
  --output dist
```

本试验不修改 `main`、`gh-pages`、当前桂林公开页面或任何原始高程资产。