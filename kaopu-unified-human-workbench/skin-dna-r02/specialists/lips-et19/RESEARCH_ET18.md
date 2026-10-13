# ET18 — 唇部表面学习、实现映射与边界

日期：2026-10-11。继承用户冻结构建 `7f90e53c1d114f65b08710d67d792d489719ee67`。
范围：现有人物的嘴唇材质及其检查界面，不替换人物、眼球、骨架、身体或 LipSurface 结构。

## 判断和反例

“更多纹理、更红、更亮”不等于更真实。规则条纹会产生刻线感；把沟纹画黑，会把光照写进颜色；把唇部整块涂成均匀湿亮，会产生唇膏/塑料感。增加随机噪声也不能代替区域、尺度和受力方向。

唇部不能直接复用面颊毛孔网络。生理研究支持两处表面性质有差异，但不是可以从一项样本研究推导出所有人的固定颜色或粗糙度。参数默认值是美术起点，不是医学常数。

## 一手来源与实际吸收的内容

### 1. 表面差异：Kobayashi & Tagami，2004

Functional properties of the surface of the vermilion border of the lips are distinct from those of the facial skin. British Journal of Dermatology 150(3):563–567.
DOI: 10.1046/j.1365-2133.2003.05741.x。
来源：https://pubmed.ncbi.nlm.nih.gov/15030342/

已读公开摘要。其冬季健康日本女性样本中，唇部的水分散失与表面含水状态不同于面颊。不能把样本条件外推成所有人的统一常数。本项目据此将唇部与面部细节分开；湿润/干燥仅控制外观，不模拟含水率、屏障或蒸发。

### 2. 个体和上下唇差别：Lévêque & Goubanova，2004

Influence of age on the lips and perioral skin. Dermatology 208(4):307–313. DOI: 10.1159/000077838。
来源：https://pubmed.ncbi.nlm.nih.gov/15178912/

已读公开摘要。研究分别比较上下唇，并研究唇表面纹路模式，而不是把全部唇纹归结为单一年龄模板。本项目采用独立上下唇纹路和可重复个体种子，不将“年龄增加”强制等同于相同竖纹加深。未根据该研究制作临床年龄预测。

### 3. 结构化微纹：Disney Research，2023

Weiss, Moulin, Chandran, Zoss, Gotardo, Bradley. Graph-Based Synthesis for Skin Micro Wrinkles. Eurographics Symposium on Geometry Processing.
来源：https://studios.disneyresearch.com/2023/07/03/graph-based-synthesis-for-skin-micro-wrinkles/

已读官方项目页和摘要。原方法以皮肤毛孔为图节点，候选连边经过迭代优化后转为微纹位移图。

吸收的是“先组织不均匀的结构，再转成高度场，最后着色”的原则。本项目 LipMicrostructure.mjs 是另写的带种子曲线生成器：主沟、短细沟、分叉、弯曲和末端渐隐，随后栅格化成两频带高度图。没有使用其毛孔图、行人轨迹式优化器、论文代码、数据或插图；不能称完整复现或将脸部毛孔照搬到唇红。

### 4. 多尺度和形变边界：USC ICT，2015

Nagano et al. Skin Microstructure Deformation with Displacement Map Convolution. SIGGRAPH 2015.
来源：https://vgl.ict.usc.edu/Research/SkinStretch/

已读官方技术介绍。其方法用测得的拉伸/压缩规律调整微结构位移图，并改变法线分布。对本项目的直接启示是把大形、唇沟、短细纹分开，采用稳定的参考空间，并认识到静态纹理跟随形变不等于动态微结构。

本轮已实现固定参考坐标、两频带、mipmap 和像素足迹衰减。尚未实现论文的应变测量、各向异性卷积、表面法线分布拟合；大幅嘟嘴、抿嘴和张口仍需独立动态验收。

### 5. 分层外观：Pixar RenderMan 官方教程，2018

Photorealistic Head，Leif Pedersen；Christophe Hery 审阅注释。
来源：https://prod.renderman.pixar.com/photorealistic-head

已读官方教程的位移、颜色、次表面散射和反射部分。该流程组合形状细节与多反射层，并提醒薄部位（包括唇部）的散射边界。

本项目将唇色、细沟高度、粗糙度和内侧湿膜分别处理，原有肤色/唇色主控保留。采用已有 Three.js 物理材质与 clearcoat 的浏览器近似，不是 RenderMan 移植；继承已有面部屏幕空间扩散，未实现新的体积散射或精确 BSSRDF。

### 6. 颜色不能包含所有光照：Disney Research，2020

Single-Shot High-Quality Facial Geometry and Skin Appearance Capture.
来源：https://studios.disneyresearch.com/2020/08/14/single-shot-high-quality-facial-geometry-and-skin-appearance-capture/

已读官方项目摘要，其采集体系区分表面几何和多项外观参数。本项目借鉴通道分离，而不是声称已具有该偏振采集或反演系统。颜色中的沟纹残差保持很弱，主要凹凸交给表面法线；界面可独立观察颜色、法线、粗糙度与唇红遮罩。

## 实现框架

原人物参考坐标与四条唇缘曲线 → 有限唇红区域 → 独立上下唇曲线网络 → R/G 两频带高度图 → 颜色、凹凸、粗糙度、内湿带 → 现有角色材质和保存系统。

LipMicrostructure.mjs：用毫米坐标生成非周期曲线图。深度、宽度和分叉分布是本项目美术参数，并非上述论文测量值。纹理为 1024×512 RGBA，R 为主沟、G 为短细沟，128/255 为零高度；上下唇分别有留白边带。

LipMaterial.mjs：唇红范围、颜色分区、干湿混合和正常材质集成。颜色变化使用较大尺度的连续色区与较小尺度的斑驳，而不是逐像素红色随机点。唇区抑制原脸部凹凸和额外脸部颜色残差，防止两套细节叠加。法线带按投影足迹渐隐，避免远处强行保留不可解析纹理。

LipState.mjs：保留原参数，新增 colorVariation、upperShade、dryness、microRelief、textureDensity、patternSeed；明确接受旧 kaopu/lip-structure@1 并补默认值迁移为 @2；无效恢复不能污染原人物。

LipUI/LipViewer：同一画布和人物，增加自然/偏干/偏湿三个材质预设、微距及四种诊断层。诊断层不写入人物档案。原“关闭嘴唇扩展”的对照实际是唇部扩展之前的基础皮肤，明确标注非 ET17；用户指定 ET17 用独立固定链接保留，避免伪称同版本 A/B。

## 嘴角红线的代码根因

ET17 的边界函数在左右端点以外返回端点高度，唇红遮罩却没有横向范围限制。上下曲线在嘴角收成相同高度，两个平滑阶跃相乘仍可能得到非零窄带，于是细线延伸到面颊。

ET18 同时乘以左右界限衰减 lpExtent 和局部厚度门控 lpThickness。超过任一嘴角或上下唇红边界退化为零厚度时，材质遮罩严格为零。不是把红色调淡，也不增加遮盖面片。GPU 检查在最大边缘柔和度下采样实际渲染的两侧范围；具体结果以本轮 Actions 报告为准。

## 成本、权限与未实现项

生成高度纹理的基础数据为 2 MiB，含完整 mip 层的纹理数据估计约 2.67 MiB，另有生成过程的临时 CPU 数组。多角色规模化需要缓存/共享/降级；“代码很小”不等于 GPU/内存开销为零。未新增显示网格细分，沿用 ET17 已有派生表面。

当前没有本人的标定扫描、偏振反照率、唇部厚度/吸收系数或表情应变数据。普通网页环境不能直接把离线多散射、真实微米扫描、肌肉和湿组织接触求解同时免费搬进来。需要在参考采集与许可、渲染预算、动态接触测试之间做取舍。本轮不宣称实现口腔软组织碰撞或达到影视最终特写标准。

未购买、重新分发或改名第三方商业扫描；不将论文免费阅读等同于资产可任意复制。新代码不包含论文图片/全文或新第三方照片。既有 Harvey 眼球资源与原署名/许可不变。

自动化检查证明实现、边界和交互有效，不证明观感已符合用户目标。最终验收必须使用固定公网网页，并分别检查常规近景、微距、侧光/斜面、原人物预设与动作。
