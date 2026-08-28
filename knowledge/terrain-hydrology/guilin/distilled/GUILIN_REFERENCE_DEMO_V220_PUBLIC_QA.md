# 桂林阳朔参考图蒸馏示范区 v2.2 公开 QA

```text
public URL:
https://haihao0307.github.io/guilin-dem-pipeline/terrain-hydrology-workbench-v200/

source head:
3ecc063b2149ecafd53c874af887182710ae130c

main deployment run:
33132705031
success

dedicated public browser QA run:
33132705028
attempt 2
success

main public artifact:
9670907166
sha256:7d1fcd3c3368e59b15d300e814e00992806045730be6f25ec2a0ec9dfc246158

dedicated demo artifact:
9670934892
sha256:0a720f3b96f3165cb6aa57571b0e334e635dfa5bc0bf3f1b240be3203fade37d
```

## 公开片区

```text
profile:
guilin-yangshuo-karst-reference-v001

pixel window:
x=50, y=130, width=80, height=80

metric bounds:
425087.5, 2797862.5, 426087.5, 2798862.5

CRS:
EPSG:32649

window:
1,000 m × 1,000 m

local truth relief:
approximately 254 m

truth spacing:
12.5 m
```

## 桌面

```text
viewport: 1440 × 1000
height samples: 640,000
mask samples: 640,000
visual mesh: 1025 × 1025
visual triangle spacing: approximately 0.98 m
camera distance: 520 m
A/B mean visual difference: 4.4401601155598955
continuous zoom: 520 m -> 240.7667955218386 m
console errors: 0
page errors: 0
failed requests: 0
HTTP errors: 0
```

## 移动

```text
viewport: 390 × 844
height samples: 640,000
mask samples: 640,000
visual mesh: 513 × 513
visual triangle spacing: approximately 1.95 m
camera distance: 520 m
A/B mean visual difference: 8.470280965169271
continuous zoom: 520 m -> 240.7667955218386 m
console errors: 0
page errors: 0
failed requests: 0
HTTP errors: 0
```

## 事实边界

```text
truthOverwrite=false
sourceResampling=false
microDeltaDefaultMeters=0
candidateVisualMaxMeters=1.2
vegetationRuntimeIncluded=false
visualAcceptance=false
productionReady=false
```

A 层为真实高程连续显示。B 层为参考照片蒸馏候选，只增加可关闭、可回退的崖壁、峰脚、岩石、湿润和地表响应。视觉网格细分密度不作为测绘精度声明。
