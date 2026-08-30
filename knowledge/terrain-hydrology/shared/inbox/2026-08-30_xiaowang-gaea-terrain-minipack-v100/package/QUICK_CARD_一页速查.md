# 小王一页速查卡

## 最短图谱

```text
Truth DEM
→ Slope / Curvature / Real Flow
→ Low Strength Rugged A
→ Low Strength Rugged B
→ Local Stratify
→ Masked MicroErosion
→ Rock / Soil / Wet / Exposure Masks
→ AutoLevel + Clarity
→ CLUT5 + Normalized Splat
→ Normal + Roughness + AO
```

## 五条硬规则

1. 真值只读
2. 多次低强度处理
3. 每个节点都有 Process Mask
4. 几何、颜色、粗糙度、法线和 AO 共用事件场
5. 所有种子可复现，所有瓦片使用世界坐标

## 色彩口诀

```text
宽色块先行
结构遮罩决定位置
CLUT 决定色域
Splat 决定竞争
ColorFX 只做收尾
```

## 三个区域

```text
桂林：峰位和河谷冻结，增强岩溶表面
温州：岸线和水深冻结，增强山海湿润与盐析
昆明：盆地、湖泊、机场冻结，增强高原坡肩和红土
```

## 立即停止

```text
真值缺失
哈希不符
CRS 未知
河网断裂
岸线移动
瓦片接缝
增强超预算
视觉候选冒充真值
```
