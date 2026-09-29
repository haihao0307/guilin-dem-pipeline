# KAOPU｜分形造波 / Fractal Wave 讨论与练习全量交接

- 时间范围：2026-09-28 晚 ～ 2026-09-29 上午
- 性质：本轮“分形造波”小节的理论 + 实践交接
- 当前重点老师：树状/扇状珊瑚
- 交接原则：继承，不覆盖；理论与实践同时推进；老师资料不进入最终运行包
- 重要：本档中的“分形造波”是工程表达体系，不声称自然界只由单一分形机制生成。

## 1. 本轮核心认识

目标不是不断建立“珊瑚生成器、树生成器、羽毛生成器、河流生成器”，而是训练少量、稳定、可跨对象复用的基础能力。  
乐队真正需要携带的是：**乐器 + 演奏能力 + Score + 当时当地的初始条件**。老师、论文、参考照片、外部模型属于学习资料，生产阶段可使用；运行阶段不背着老师出去演出。

Visual Listener / 视觉听音师的目标不是“认出这是什么”，而是从图像中听出它的构成：主轴、层级、发散/汇聚、平面/体积、分叉、粗细传递、Field、停止与末端组织，然后形成 Score；对象身份与物种再通过可靠资料核实，不能只凭外形猜。

## 2. 分形造波基础声部

当前暂定的基础声部，不代表最终封版：

- **Fractal / 分形脉**：层级与拓扑。
- **Forward**：沿当前状态继续前进。
- **Branch**：保存母状态、产生子状态、继承后继续。
- **Wave**：连续局部方向变化；不负责拓扑。
- **Field**：环境方向、空间约束、局部事实。
- **Flow**：有方向的传播/汇聚。
- **Space**：空间竞争、吸引、避让。
- **Thickness**：粗细与承载关系；优先研究由下游负载反算，而非每层机械乘常数。
- **Stop / Tip**：停止条件与末端结束方式。
- **Microscope**：进入真实微观几何，不只是明暗纹理。

新增能力必须经过跨对象复用考试；只对某一张图有效的技巧，先留在 Score / 对象层，不升级为基础乐器。

## 3. 当前分形脉家族

### Trunk Fractal / 主干型
一级轴强，二/三级结构挂载其上。珊瑚、树、羽毛可共享语法但不能共享生物参数。

### Fan Fractal / 扇面型
强主干进入近二维展开场，再细分。海扇是当前主要老师。

### Pinnate Fractal / 羽状型
中央 rachis 明确，两侧按节律长出侧枝；羽毛、某些珊瑚、叶片可共享结构语法。

### Crown Fractal / 冠状型
主轴在一定阶段释放大量分枝，适合树冠类组织。

### Radial Fractal / 放射型
多个方向竞争空间，不以单一扇面为主。

### Network Fractal / 网络型
信息场 → 节点 → 邻接关系 → 路径 → 树。Delaunay + Pathfinding 属于此类练习。

### Flow / Convergent Fractal / 汇聚型
河网是重要反例：视觉上像树，但因果方向不同；支流向主河道汇聚。不能因为轮廓相似就套用树的生长因果。

## 4. 批判性学习记录

### L-System
保留价值：递归语法、状态保存/恢复、少量规则产生深层级。  
限制：固定字符串/固定角度很容易产生机械自相似；不能单独承担真实环境响应。

### Space Colonization
保留价值：空间吸引点、多个生长端瓜分空间、减少无意义穿插。  
本轮 R02 失败曾暴露：如果只是“点在哪里就往哪里追”，那只是寻路，不是树状生长。正确方向是多个活跃端分配目标、真实分裂、历史节点只参与空间关系。

### Delaunay + Pathfinding
保留价值：先建立局部邻接关系，再通过代价函数抽取树权。  
限制：Delaunay 只是邻接结构，不等于生长；最终形态高度依赖代价函数。截图参考不足以证明原作者具体算法，因此本轮只做独立方法练习，不冒充复刻。

### Random
随机只能制造“不整齐”，不能等同“自然”。自然性应越来越来自局部目的、历史、空间竞争、Field、承载和停止条件。

## 5. 珊瑚观察所得

真实树状/扇状珊瑚提醒我们：

1. 不是“树枝”轮廓，而是粗承力主干 → 中枝 → 极密末端网络。
2. 很多海扇具有明显平面约束；另一些软珊瑚更立体/团簇，不能平均成万能参数。
3. 粗细不能只由层级决定；承担更多下游网络的枝应更粗。
4. 末端不能无限重复“更细的小棍”，必须进入明确的 Stop / Tip / 末端组织规则。
5. 当前珊瑚是老师，不把基础能力命名为 Coral-only。

## 6. 实践版本

### R01｜树状分形造波
路径：game-coral-mother-wave-r03/tree-wave/  
固定入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave/  
验证：Forward / Wave / Thickness / Branch / Stop / Tip；三维管状骨架。  
已知不足：分叉接缝未无缝融合，仍偏程序树枝，不是物种复刻。

### R02｜生长波：Field + Space Competition
路径：game-coral-mother-wave-r03/tree-wave-r02/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r02/  
重要失败与修正：初版扇面 0 段；放射形成线团。根因是目标云启动距离和“追点而非真实分裂”。后续改为可靠推进、活跃端真实分裂、历史节点只参与避让。

### R03｜信息场 → Delaunay → Pathfinding → 树权
路径：game-coral-mother-wave-r03/tree-wave-r03/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r03/  
练习：信息场、采样节点、邻接网格、寻路树、下游负载粗细、末端读取局部信息。

### R04｜六语法同台
路径：game-coral-mother-wave-r03/tree-wave-r04/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r04/  
六种 Score：扇面、树冠、垂枝、团簇、叶脉、放射。共同旋钮同时调音，用于检验基础能力是否真正普适。

### R05｜珊瑚主干—扇面
路径：game-coral-mother-wave-r03/tree-wave-r05/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r05/  
重点：主干优势、承载层级、扇面展开。

### R06｜羽状分形脉
路径：game-coral-mother-wave-r03/tree-wave-r06/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r06/  
重点：中央 rachis + 两侧周期侧枝，测试 Pinnate 语法。

### R07｜河网汇聚
路径：game-coral-mother-wave-r03/tree-wave-r07/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r07/  
重点：视觉类似树，但因果反向；当前只是汇聚语法练习，不是含坡度/集水面积/侵蚀的真实河流模拟。

### R08｜四类分形脉交叉考试
路径：game-coral-mother-wave-r03/tree-wave-r08/  
入口：https://haihao0307.github.io/guilin-dem-pipeline/game-coral-mother-wave-r03/tree-wave-r08/  
珊瑚、羽毛、树、河网同时调音，检查共同参数能否跨对象复用。

## 7. 当前观察方法

以后收到陌生参考图时：

1. **先看，不先认物种**：找主轴、层级、拓扑、粗细、平面/体积、发散/汇聚、末端。
2. **选择声部**：判断需要哪些 Fractal / Wave / Field / Flow / Space / Thickness / Stop / Microscope。
3. **形成初始 Score**：明确哪些是视觉推断、哪些未知。
4. **查真实身份和资料**：核实物种、尺度、组织、环境；用证据修正 Score。
5. **函数复刻**：老师只作学习/校准，不把外部 mesh 作为产物。
6. **跨对象考试**：新技巧若只能对一个对象有效，不升级为基础能力。
7. **运行轻量化**：最终只携带乐器、演奏法、Score、初始条件。

目标不是“背曲子”，而是**会演奏**。

## 8. 当前没有完成的事

- 还没有形成自然性充分的珊瑚复刻。
- 还没有真实物种级多视角拟合。
- 分叉无缝融合、碰撞/自避让、流固耦合仍未闭环。
- Thickness 的下游负载规律仍是研究线，不应冒充自然定律。
- 河网未接入真实地形坡度、汇流面积、侵蚀。
- 羽毛未接入真实羽轴/羽枝/羽小枝解剖与材料响应。
- R05–R08 主要是骨架交叉训练。
- “少量基础能力”仍需防止偷偷膨胀成几十个专用小工具。

## 9. 下一线建议

下一线不要从“做一个新珊瑚生成器”开始。先读取本档与 R01–R08 源码，然后继续训练：
- 主干优势 / apical dominance 类结构关系；
- 二级枝夺权与竞争；
- Stop / Dormancy / Rebranch；
- 下游承载 → Thickness；
- Field / Flow 对同一 Score 的连续影响；
- 珊瑚作为主要老师，同时用羽毛、树、河网交叉验收。

## 10. 本轮参考图

本全量包的 references/ 目录保存用户在本小节提供的参考截图/照片（IMG_8037～IMG_8062 中实际存在的文件）。它们是学习证据，不是最终运行依赖。版权/作者未逐张核实的图不得默认公开再分发。

## 11. 交接一句话

**世界不是由无限模板构成，而可以先尝试理解为少数稳定的结构/场/传播能力与大量 Score 的组合；Visual Listener 负责听懂结构，KAOPU 乐队负责现演。**


---

封包触发记录：2026-09-29。此行只用于触发 scoped full handoff 自动封包，不改变上述理论内容。
