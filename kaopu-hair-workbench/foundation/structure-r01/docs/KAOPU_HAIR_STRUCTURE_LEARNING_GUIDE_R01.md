下面这份可以直接复制交给他。文件名建议：

`KAOPU_HAIR_STRUCTURE_LEARNING_GUIDE_R01.md`

# KAOPU 程序化头发结构学习指南 R01

## 一、学习目标

当前不要继续增加发丝数量、调材质、调风力或修改阻尼。现在最缺的不是渲染，而是对“头发是什么、从哪里长、如何分区、如何成束、如何形成完整发型”的理解。

必须先建立下面这条正确认知：

```text
头皮生长域
→ 毛囊与发根
→ 根部生长方向
→ 头顶语义分区
→ 分缝、旋涡和发际线
→ 区域长度与剪裁
→ 根到梢的完整Guide
→ 大束、中束、小束
→ 密集子发丝
→ 发根、中段、发梢质感
→ 稳定静止发型
→ 最后才加入物理
```

物理系统只能让一个已经正确的发型运动，不能替代发型设计，也不能依靠重力自动找到发型。

---

## 二、必须理解的头发组成

### 1. 头皮生长域

不是整个头部表面都能长头发。必须明确：

```text
前额发际区
刘海区
顶部区
头冠旋涡区
左侧发区
右侧发区
左鬓角和耳前区
右鬓角和耳前区
后枕区
后颈区
```

耳朵、额头、面部、颈部不能通过“生成后删除穿模发丝”解决，而应在头皮域和方向场阶段就正确处理。

现有64,000个点只能作为候选毛囊点。不同发型应独立决定哪些毛囊真正启用。

### 2. 毛囊与发根

每个发根至少需要保存：

```text
triangleId
barycentric
scalpUV
rootPosition
rootNormal
rootTangent
rootDirection
rootLift
strandDiameter
lengthSeed
curlSeed
```

发根必须稳定绑定到头皮三角形，人物头型变化或动作发生时不能漂浮。

### 3. 根部方向

发丝不能统一沿头皮法线垂直向外生长。

正确方向应由下面几部分共同决定：

```text
头皮法线
+ 头皮切平面发流
+ 旋涡影响
+ 分缝影响
+ 发际线影响
+ 耳周避让
+ 梳理方向
```

可以理解为：

```text
RootDirection =
    Normal × RootLift
  + TangentFlow × SurfaceFlow
```

### 4. 分缝、旋涡和发际线

分缝不是一条亮色头皮缝，也不是简单删除一条区域的发根。

分缝是一个方向边界：

```text
左侧发根向左离开
右侧发根向右离开
分缝附近密度逐渐降低
根部仍然连续存在
```

旋涡是头皮方向场中的旋转中心。它需要控制：

```text
位置
旋转方向
影响半径
旋转强度
中心密度
单旋涡或双旋涡
```

发际线不是硬边，应包含：

```text
密度渐变
细软短发
婴儿发
不规则边缘
左右轻微不对称
```

---

## 三、整个发型必须分成五个层级

### Level 1：整体轮廓

先确定：

```text
顶部高度
左右宽度
后脑体积
刘海轮廓
耳周轮廓
肩部以上或以下的长度
发梢外轮廓
```

关闭所有单根细发后，整体轮廓仍然必须成立。

### Level 2：主要Guide

Guide必须表示同一批头发从发根一直到发梢的完整关系。

禁止：

```text
只在头顶画短箭头
Guide生长到中途结束
把头顶切成几块短色块
每根Guide互不相关
```

每根Guide都必须是：

```text
Root → Mid → Tip
```

### Level 3：中型发束 Wisps

主要Guide还要组织成中型发束，用来决定：

```text
刘海分组
左右侧发
耳前发束
耳后发束
后枕发束
肩部附近的长发分组
```

### Level 4：密集子发丝

子发丝围绕Guide生成，继承Guide的局部坐标、弯曲和发束关系。

不能只在世界坐标中对两根Guide的位置做线性插值，否则Guide大幅弯曲时容易产生锯齿、折角和异常拉长。

### Level 5：碎发与特殊短发

碎发只应重点出现在：

```text
发际线
分缝
耳周
后颈
发束外缘
发梢
```

禁止在整个头发上均匀随机添加碎发。

---

## 四、头发本身的质感分布

头发质感不能只有统一黑色和统一高光。

### 发根

```text
密度较高
方向较稳定
刚度较高
发束聚合较强
颜色通常略深
油脂和镜面响应可以略高
```

### 中段

```text
承担主要发型形状
形成大束和中束
形成主要高光条带
卷曲和波浪结构最稳定
```

### 发梢

```text
直径逐渐变细
密度逐渐降低
长度差异增加
发束逐渐分开
更容易出现碎发和断发
颜色和粗糙度允许轻微变化
```

每根发丝至少要支持：

```text
rootRadius
tipRadius
lengthVariation
melaninVariation
roughnessVariation
curlRadius
curlPitch
clumpStrength
flyawayProbability
```

发丝直径必须从根部连续收细到发梢，不能从头到尾一样粗。

---

## 五、两轮学习与开发

## 第一轮：只建立静态发型结构

这一轮禁止加入跑步、风、复杂材质和碎发。

必须完成一个 `Hair Structure Lab`，至少提供以下查看模式：

```text
头皮语义分区
候选毛囊
启用毛囊
根部方向场
分缝和旋涡
区域长度场
完整Guide
发束分组
完整静态发型
```

必须提供：

```text
正面
左侧
右侧
背面
顶部
斜侧
```

第一轮只用灰色发丝，重点检查结构。

### 第一轮验收

必须同时满足：

```text
头皮分区清楚，不把整个头顶当成一块区域
分缝两侧发流正确，不是一条亮色缝
旋涡能连续影响周围发流
Guide全部从发根连续到发梢
刘海、顶部、侧发、后发和后颈相互独立
耳朵能够改变发流，而不是只删除穿模发丝
关闭子发丝后，Guide仍能表达完整发型
正面、侧面、背面的轮廓同时成立
```

耳边、当前长度、胸口长度不能通过同一个全局长度倍数生成。它们必须拥有不同的：

```text
ActiveRootMask
RegionalLengthField
CutField
GuideGroom
ClumpGraph
RestShape
```

## 第二轮：加入质感分布和基本物理

第一轮通过后，再增加：

```text
密集子发丝
发根到发梢的直径变化
大束、中束和小束
局部毛躁
碎发和婴儿发
根部、中段、发梢材质差异
稳定静止形态
头、脸、耳、颈、肩碰撞
基础惯性和风
```

### 第二轮验收

```text
关闭物理时，发型本身仍然正确
开启重力后，发型不能立即塌掉
跑步、跳跃和急停后，发丝长度不能明显变化
Guide弧长漂移应控制在1%以内
头发不能穿过脸、耳朵、颈部和肩膀
肩部碰撞后应滑动或堆积，不能水平炸开
大束先运动，小束随后响应，不能所有发丝独立乱飞
子发丝不能产生锯齿、直线射出或突然变长
```

---

## 六、必须建立的数据结构

```text
HairStyleProfile
├─ ScalpDomain
├─ AnatomicalZoneField
├─ CandidateRootField
├─ ActiveRootMask
├─ FollicleDensityField
├─ RootDirectionField
├─ RootLiftField
├─ PartingCurves
├─ WhorlField
├─ HairlineProfile
├─ RegionalLengthField
├─ CutField
├─ GuideGroom
├─ ClumpGraph
├─ ChildStrandProfile
├─ StrandMaterialField
├─ RestShape
└─ PhysicsProfile
```

三个长度预设可以共享人物和候选毛囊，但不能共享最终Guide、剪裁场和物理参数。

---

## 七、禁止使用的错误方法

```text
禁止每个头皮三角形固定生成相同数量发丝
禁止所有发丝沿头皮法线生长
禁止用同一套Guide乘长度系数生成三种发型
禁止让物理系统负责寻找发型
禁止把每一根发丝当成完全独立的绳子
禁止把分缝做成一条发光头皮线
禁止在整个头发上平均添加碎发
禁止统一直径、统一粗糙度和统一颜色
禁止在静态发型结构未通过前优化材质
禁止用发帽或体积壳遮盖错误发流
```

---

# 八、必学研究资料

按下面顺序学习，不要跳过前面直接看物理。

### 1. Sketching Hairstyles

重点学习：

```text
Streaming Curve
Dividing Curve
Ponytail Curve
连续Vector Field
沿方向场生长发丝
```

这篇研究明确把发型设计曲线作为方向场的边界约束，非常适合理解“分缝、发流和整体发型如何共同建立”。

- [论文 PDF](https://hongbofu.people.ust.hk/doc/sbim07_hairstyle_sketching.pdf)
- [作者论文列表备用入口](https://hongbofu.people.ust.hk/publications.html) [Hongbo's Homepage](https://hongbofu.people.ust.hk/doc/sbim07_hairstyle_sketching.pdf?utm_source=chatgpt.com)


### 2. DeepSketchHair

重点学习：

```text
发型轮廓
发流笔触
二维方向场
三维方向场
多视角修正
```

它把“整体轮廓”和“局部生长方向”分开输入，再生成三维发流。不要复制其神经网络，重点学习它的问题拆分方式。

- [arXiv 页面](https://arxiv.org/abs/1908.07198)
- [HTML 全文备用入口](https://ar5iv.labs.arxiv.org/html/1908.07198) [arXiv](https://arxiv.org/abs/1908.07198?utm_source=chatgpt.com)


### 3. Example-Based Hair Geometry Synthesis

重点学习：

```text
头皮二维发丝排列
头部周围三维方向场
分层发束聚类
Macro / Mid / Micro Wisps
```

它明确把发型看作“二维头皮排列 + 三维方向场 + 层级发束”，这是解决当前发帽和幕帘问题的核心研究。

- [官方项目页](https://research.lvdi.wang/publications/hairsynthesis/index.html)
- [补充资料 PDF](https://research.lvdi.wang/publications/hairsynthesis/2009_hairsynthesis_appendices.pdf) [Lvdi Wang](https://research.lvdi.wang/publications/hairsynthesis/index.html?utm_source=chatgpt.com)


### 4. Doubly Hierarchical Geometric Representations

重点学习：

```text
低频Guide结构
高频卷曲和噪声
从稀疏Guide生成密集发丝
Guide不能只按头皮UV均匀抽样
```

该研究从低频Guide逐渐生成高密度、高频细节发丝，并通过聚类中心选择更能代表真实发型的Guide。

- [NeurIPS 官方页面](https://proceedings.neurips.cc/paper_files/paper/2024/hash/a337c82579ca723415417fdd8ea3a485-Abstract-Conference.html)
- [论文 PDF](https://proceedings.neurips.cc/paper_files/paper/2024/file/a337c82579ca723415417fdd8ea3a485-Paper-Conference.pdf) [NeurIPS 会议记录](https://proceedings.neurips.cc/paper_files/paper/2024/hash/a337c82579ca723415417fdd8ea3a485-Abstract-Conference.html?utm_source=chatgpt.com)


### 5. IPHG

重点学习：

```text
无组织发丝
→ 少量Guide
→ 发束分布
→ 程序化操作
→ 可编辑Groom
```

它能够把图片重建或扫描得到的散乱发丝，转换为由少量Guide和程序化梳理操作控制的Groom。代码可以研究，但许可证为CC BY-NC 4.0，不能未经许可直接作为商业核心。

- [官方项目页](https://weschang.com/publications/iphg/)
- [GitHub 源码](https://github.com/facebookresearch/iphg)
- [官方演示幻灯片](https://weschang.com/publications/iphg/iphg-slides.pdf) [Weschang](https://weschang.com/publications/iphg/?utm_source=chatgpt.com)


### 6. Digital Salon

重点学习：

```text
选择头皮区域
生成发丝
程序化生长
程序化剪裁
交互梳理
物理模拟
```

代码仓库采用MIT许可证，可作为程序化生长、剪裁和物理数据结构的直接老师。网页中的Adobe内部资产和公开代码许可需要分开看。

- [官方展示页](https://digital-salon.github.io/)
- [GitHub 源码](https://github.com/digital-salon/Digital-Salon) [数字沙龙](https://digital-salon.github.io/?utm_source=chatgpt.com)


### 7. HairStep：参考图片理解专项

仅在需要根据图片复刻发型时学习。

重点学习：

```text
Hair Mask
Hair Strokes
Strand Map
Relative Depth
从图片提取发流与前后层次
```

- [GitHub 源码与数据说明](https://github.com/GAP-LAB-CUHK-SZ/HairStep)
- [论文页面](https://arxiv.org/abs/2303.02700)

它公开的数据包含人工标注的发丝笔触，可用于检查方向场是否符合真实参考图。

---

## 九、学习后必须回答的问题

不要只说“已经看过论文”。学习完成后必须能够明确回答：

```text
1. 发际线、分缝、旋涡和普通头皮区域有什么区别？
2. 发根位置和发根方向为什么不能混成一个参数？
3. 为什么不能沿头皮法线直接生长？
4. 为什么刘海、顶部、侧发、后枕和后颈必须分区？
5. 什么是从根到梢的完整Guide？
6. 大束、中束、小束分别负责什么？
7. 低频发型结构和高频卷曲、毛躁有什么区别？
8. 为什么三种长度不能使用同一套Guide乘长度倍数？
9. 物理关闭时，完整发型为什么仍然必须成立？
10. 发根、中段和发梢的质感为什么不能完全相同？
```

回答不清楚这些问题，不进入下一轮开发。

---

## 十、最终交付要求

只交付一个网页工作台，不要分散成多个演示。

工作台至少提供：

```text
头皮分区
发根分布
方向场
长度场
Guide
发束层级
完整发丝
物理开关
```

使用同一个人物和同一个参考发型，在正面、侧面、背面和顶部进行检查。

第一轮只验收结构。第二轮才验收质感和物理。

核心原则只有一句：

> **先把头发作为一个有生长区域、有方向场、有剪裁、有束群层级的完整对象建立起来，再让它运动；不要先生成大量线，再期待物理把这些线变成发型。**