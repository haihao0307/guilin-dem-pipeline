# 程序化字段核心知识

## 1. 字段优先架构

### Source Field

保存输入事实和原始测量数据。

常见内容包括：

1. 高程、距离、法向、曲率和误差
2. 材料类别和区域标签
3. 采样置信度
4. 已确认边界
5. 受保护区域

Source Field 保持只读。

### Shape Field

负责可控的形体增量。

典型内容包括：

1. 宏观轮廓
2. 中尺度层理
3. 裂隙和沟槽
4. 局部抬升与凹陷
5. 微小表面起伏

推荐表达：

```text
finalShape = sourceShape + approvedMask × clampedDelta
```

### Data and Mask Field

负责从输入和形体中提取可复用数据：

1. Slope
2. Curvature
3. Cavity
4. Protrusion
5. Flow
6. Exposure
7. Moisture
8. Separation
9. Confidence
10. Material Region

每个字段都应提供独立诊断输出。

### Color Field

负责综合色彩：

1. 基底色
2. 深色区
3. 暖色区
4. 浅色矿物区
5. 湿润区
6. 氧化区
7. 沉积区
8. 生物附着区

颜色应由 Data Field 驱动。

### Render Field

负责最终显示：

1. Albedo
2. Roughness
3. Normal
4. Ambient Occlusion
5. Wetness
6. Detail Normal
7. Material Weights

## 2. 多尺度噪波

### Gradient 或 Value Noise

用于连续的大尺度变化。

适合宏观色块、宽缓起伏和基础材料分区。

### Fractal Brownian Motion

通过多倍频叠加连接宏观、中观和微观。

适合综合色块、自然起伏和连续材料变化。

### Ridged Field

强化脊线、断面和清晰边缘。

适合层理、裂隙、矿物边界和高对比结构。

### Turbulence

用于非对称、杂乱和风化感。

适合破碎、冲刷和局部粗糙变化。

### Cellular Field

用于块状分区、孔隙候选、颗粒核心和边界网络。

### Domain Warp

先扭曲采样坐标，再计算后续字段。

Domain Warp 可以打散笔直、重复和规则的程序纹。

多个通道应共享同一个主扭曲字段。

## 3. 三层尺度预算

### Macro

大于对象主要尺寸的八分之一，或大于三十二个采样单元。

负责整体形体、主要分区和大尺度色彩。

### Meso

四到三十二个采样单元。

负责层理、沟槽、裂隙、侵蚀和中尺度色斑。

### Micro

小于四个采样单元。

优先进入法线、粗糙度和颜色。

微观内容不应持续污染主形体。

## 4. 低强度多次复合

同类效果建议使用两到三次低强度处理。

示例：

```text
Broad Field
→ Warp
→ Detail Pass A
→ Detail Pass B
→ Local Structure
→ Micro Enhancement
```

这样可以获得丰富层次，同时保留安静区域。

## 5. 遮罩体系

建议使用四类遮罩：

1. Truth Mask，来自真实数据
2. Parent Mask，允许处理的区域
3. Process Mask，限制单个过程
4. Separation Mask，记录两个字段的交界

所有遮罩采用零到一范围。

遮罩边界默认保持柔和。

## 6. Combine 与 Separation

常用复合方法：

1. Blend
2. Add
3. Subtract
4. Multiply
5. Max
6. Min
7. Screen
8. Difference

Separation Mask 可以使用两个字段的差值生成：

```text
separation = sharp(abs(fieldA - fieldB))
```

它适合驱动颜色边界、粗糙度变化和局部法线响应。

## 7. 数据驱动综合色彩

推荐链路：

```text
Driver Field
→ Auto Level
→ Local Clarity
→ Controlled Sharpness
→ Five Stop Color Map
→ Normalized Splat
→ Color Correction
```

### Auto Level

把有效数据范围映射到零到一。

### Local Clarity

提高局部对比，同时保留整体范围。

### Controlled Sharpness

只强化重要边界。

避免全局放大高频噪声。

### Five Stop Color Map

五个颜色节点可表示：

1. 深色
2. 湿润或阴影
3. 基底
4. 暖色或暴露
5. 浅色矿物或沉积

### Normalized Splat

多个材料权重先归一化，再进行混合。

```text
weight[i] = raw[i] ^ sharpness
weight[i] = weight[i] / sum(weight)
```

## 8. 通道相关性

同一事件字段应同时影响多个输出。

示例：

### 凹陷事件

1. Shape 下降
2. Color 变暗
3. AO 增强
4. Normal 下凹
5. Roughness 改变

### 突出事件

1. Shape 抬升
2. Curvature 增强
3. 暴露色增加
4. Normal 形成边缘
5. Roughness 增强

### 湿润事件

1. Color 变暗
2. Roughness 降低
3. Wetness 增强
4. AO 局部变化

各通道共享事件后，表面会更完整。

## 9. 独立种子

推荐种子层：

```json
{
  "master": 1001,
  "shape": 1103,
  "warp": 1207,
  "structure": 1301,
  "damage": 1409,
  "color": 1501,
  "weather": 1601,
  "micro": 1709
}
```

修改一个子种子时，只改变对应层。

所有子种子由 master 和固定 salt 派生。

## 10. 确定性

必须满足：

1. 同输入、同版本、同种子，结果一致
2. 修改 color seed，Shape 输出不变
3. 修改 micro seed，Macro 结构不变
4. 跨瓦片或跨分块使用世界坐标采样
5. 低精度预览与高精度输出保持主要特征位置一致

## 11. 性能分层

建议设置三档：

### Preview

快速交互。

降低采样数和几何细分。

### Review

日常视觉校准。

保留中尺度结构。

### Evidence

最终截图和 QA。

使用完整精度。

只有 Shape、Damage、Structure 变化需要重建几何。

Color、Weather、Roughness 等变化优先更新参数。

## 12. 诊断与 QA

每个候选至少输出：

1. Final
2. Source
3. Shape Delta
4. Parent Mask
5. Cavity
6. Protrusion
7. Separation
8. Color Driver
9. Albedo
10. Roughness
11. Normal
12. AO

自动 QA 负责确定性、范围、接缝和数据合同。

视觉判断独立记录。
