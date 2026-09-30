# KAOPU TREE FRACTAL WAVE LAB｜树状分形造波思维体系与首版任务

日期：2026-09-30

## 1. 为什么从 Fractal Wave 单独抽出 Tree Lab

树状分形造波不再只是 Coral Mother 的一个试验。R01 已证明“主轴→分枝→末端”的三维函数骨架具有独立研究价值，因此单独建立 KAOPU TREE FRACTAL WAVE LAB，并保留原 R01 为母本/基准，不覆盖。

目标不是建立“某某树模型库”，而是训练 Visual Listener 看见真实树以后，能听出：主轴、枝级、承载、分叉、停止、树冠组织、叶片组织、表面年龄与材料状态；再由少量乐器 + Score 现演。

## 2. 三个层次必须分开但协同

### TREE / STRUCTURE
Trunk → Branch → Twig。负责拓扑、主干优势、粗细传递、分叉、停止、空间关系。

### BARK / MICROSCOPE
树皮不能只贴材质。沿每一段枝条建立局部坐标 (s, theta)，让截面真实改变：
- 低频：整体隆起、偏心、老化形变；
- 中频：纵向沟槽、脊、折皱；
- 高频：微裂纹/粗糙微形态（受运行预算限制）。
主干、老枝、嫩枝必须使用不同频谱。Shader 负责光学响应，Microscope 负责真实几何。

### LEAF / 3D STRUCTURAL FUNCTION
叶片不是一张 Plane。借鉴 Marine Feather 的结构思想：
Petiole / Midrib（类似 rachis）→ Primary veins（类似 barb）→ Secondary veins → 由脉络撑起三维叶肉曲面。
叶片具有拱度、扭转、厚度、叶缘波动。未来风力传播为：叶柄 → 主脉 → 侧脉 → 叶缘，而不是整片刚体旋转。

## 3. Substance 式材质思想：学习“关系”，不是复制软件节点

颜色不能独立随机贴上去。先从几何/事实生成可复用 Mask，再由 Mask 驱动多个材质通道。

当前树皮 Mask 候选：
- AGE / branch depth：主干更老，嫩枝更新；
- HEIGHT / s：沿枝条纵向位置；
- RIDGE：几何脊；
- CREVICE：沟槽/凹部；
- ORIENTATION：朝上/朝下/朝光；
- MOISTURE：未来由环境事实输入；
- VARIATION：低权重随机，只用于打破完全重复。

同一批 Mask 同时驱动：
Base Color、Roughness、Normal/Micro-normal、未来的 Moisture/lichen/moss 等。颜色因此与几何同源，而不是“先做树，再贴一张树皮图片”。

叶片同理：midrib distance、vein distance、edge distance、surface normal、age 等成为 Mask；颜色、粗糙度、透光和未来几何微形态共享这些事实。

## 4. 当前首版验收

首版必须在同一个在线工作台看到：
1. R01 三维树状分形骨架继承；
2. 有色树皮，不再是灰白塑料；
3. 树皮出现真实几何纵向脊/沟槽；
4. 主干、老枝、嫩枝颜色/粗糙感不同，但由同一 Mask 体系产生；
5. 末端挂载三维函数叶片；
6. 叶片至少具有主脉、侧脉、拱度/扭转和厚度感；
7. 可切换 Structure / Bark / Leaf / Mask 观察；
8. 不把首版称为真实树种复刻。

## 5. 风险与边界

- 不能把“Substance 思路”误解为复制 Substance 节点图；我们学习的是 mask stacking / procedural material relationship。
- 树皮高频真几何非常耗顶点，运行阶段必须控制频率/采样；近景事实存在与“全部加载”是两件事。
- Marine Feather 的原公开源码目前未在 gh-pages 找到，因此首版只能继承已经冻结的函数思想；找到原资产后再核对，不冒充已直接复用源码。
- 叶片结构与羽毛只共享“主轴—侧级—表面”的数学组织，不共享生物学参数。
- 当前首版是能力工作台，不代表已经掌握真实树皮生物学、叶脉分类或具体树种。

## 6. 一句话

**Structure 决定它为什么这样长；Microscope 决定表面为什么这样皱；Material Masks 决定这些事实怎样共同影响颜色和光；Score 决定这一棵具体树怎样演奏。**
