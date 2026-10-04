# KAOPU｜分叉生长老师：树线 × 珊瑚线交叉学习记录

- 日期：2026-10-04
- 输入老师：用户上传短视频《分叉生长——自然界的神奇现象》
- 视频信息：约 24.4 秒，1920×1080；本轮按时间抽帧检查，不依赖音频转写。
- 交叉来源：`game-coral-mother-wave-r03/FRACTAL_WAVE_HANDOFF_20260929_ZH.md`
- 目的：把同一个老师拆成可共享的基础声部，再分别进入“树”和“珊瑚”的对象 Score；不让任一生产线从头重复学习。
- 重要边界：以下只记录视频画面中可见的方法线索与我们自己的工程归纳，不声称已获得原作者完整节点图、参数或精确实现。

## 1. 逐帧看见的老师流程

视频不是在展示一个单独的“分形公式”，而是一条混合生产链：

1. **形态老师 / 目标外观**  
   开头与结尾展示具有粗主轴、密集末端、软组织/珊瑚感表面的目标形态。它提供的是形态门槛，不直接证明算法。

2. **Data Preparation / 资料准备**  
   画面明确出现 Data preparation。说明生成前需要先准备目标范围、空间样本、约束或参考数据，而不是只靠随机递归。

3. **空间样本 / 环境供给场**  
   画面出现 Space Colonization 相关资料，并展示“食物数量与可获得性变化”导致不同密度与冠幅的结果。可提炼为：环境点不是装饰粒子，而是影响活跃端去向、竞争与密度的外部条件。

4. **L-System / Turtle 局部语法**  
   视频切到带 Turtle、角度、Forward、状态符号的文档页面。可提炼为：局部坐标、前进、转向、保存/恢复状态适合表达层级与路径语法。

5. **从稀疏种子到稠密结构的阶段性生长**  
   中后段由少量亮点/局部团块逐渐扩展成完整群体，表明“阶段历史”是结果的一部分；最终形态不是一次性散点拟合。

6. **骨架之后还有表面与末端组织**  
   最终成果明显不只是线框树，而有厚度、连接、末端膨大/组织和材质。骨架、承载粗细、末端器官与外表面应分层表达。

## 2. 对老师的批判性拆解

### 2.1 L-System 负责什么

保留：
- 递归层级；
- 局部坐标与 Turtle 前进；
- 母状态保存/恢复；
- 少量规则生成深层路径；
- 可读、可重放的 Grammar / Score。

不能让它单独负责：
- 真实环境竞争；
- 资源分配；
- 根与枝的生物差异；
- 真实粗细传递；
- 物种特定的芽序、叶序、珊瑚虫组织；
- 水流或风力响应。

固定字符串、固定角度、固定缩放比容易得到机械自相似，只能作为声部，不能冒充完整生命。

### 2.2 Space Colonization 负责什么

保留：
- 把可用空间转成吸引/供给样本；
- 多个活跃端瓜分目标；
- 控制冠幅、密度、空洞与方向偏置；
- 减少无意义穿插；
- 让环境改变同一 Score 的实际演奏结果。

必须防止的错误：
- “点在哪里，线就追到哪里”只是寻路，不是生长；
- 把点云直接连成枝，会失去母子拓扑与生长历史；
- 历史枝条不能继续抢目标，只能提供占据、遮挡、距离和承载事实；
- 必须有多个 Active Tips、目标分配、真实分裂、Kill/Influence Radius 和停止条件。

### 2.3 数据点、骨架、表面不是一回事

正式分层：

`Environment Samples / Supply Field`
→ `Active Tip Decisions`
→ `Branch Graph / Life History`
→ `Load & Resource Back-propagation`
→ `Radius / Thickness Field`
→ `Continuous Surface`
→ `Terminal Organ / Microscope`

任何一层都不能偷偷替代另一层。

## 3. 从珊瑚生产线直接继承的知识

从珊瑚线交接档读取并纳入树线的共同基础声部：

- Fractal：层级与拓扑；
- Forward：沿当前状态继续；
- Branch：保存母状态并产生子状态；
- Wave：连续局部方向变化，不承担拓扑；
- Field：环境方向与局部事实；
- Flow：有方向的传播/汇聚；
- Space：竞争、吸引、避让；
- Thickness：粗细与承载；
- Stop / Tip：停止与末端组织；
- Microscope：真实微观几何，而非只改颜色。

直接继承的分形脉家族：

- Trunk Fractal：强主轴；
- Fan Fractal：近二维扇面；
- Pinnate Fractal：中央轴 + 两侧节律侧枝；
- Crown Fractal：阶段性释放冠层；
- Radial Fractal：体积放射竞争；
- Network Fractal：信息场 → 邻接 → 路径；
- Convergent / Flow：汇聚因果，不能因轮廓像树就误用发散生长。

珊瑚线已经验证的重要失败结论：

1. 追点不等于分枝；
2. Delaunay 只提供邻接，不等于生长；
3. 随机只制造不整齐，不制造自然；
4. 粗细不能只按递归层级机械乘常数；
5. 末端必须进入明确的 Stop / Tip / 末端组织，而不是无限重复小棍；
6. 平面海扇与立体团簇软珊瑚必须是不同 Score，不能平均成万能参数。

## 4. 同一个老师，树线与珊瑚线学什么不同

### 4.1 共同学习层

两条线共用：

`Anchor`
→ `Active Tips`
→ `Candidate Directions`
→ `Target / Supply Allocation`
→ `Branch Decision`
→ `Occupancy Update`
→ `Load / Resource Back-propagation`
→ `Thickness`
→ `Stop / Tip`
→ `Surface / Organ Layer`

这部分属于乐器与演奏技巧。

### 4.2 树线必须继续补充的事实

- Seed 同时建立 Root 与 Shoot，但两者语法不镜像；
- apical dominance、休眠芽、再分枝和枝条脱落；
- 光、水、土壤、岩石、邻树共同影响空间决策；
- 叶只在允许的 terminal/recent-twig organ zone 出现；
- 年龄、形成层、伤口与历史决定次生加粗；
- 成熟叶、根、新梢、储备与果实形成 source–sink 网络；
- 主轴、一级枝、二级枝、细枝的角色必须长期保持可读；
- 根颈与结构根必须能独立观察和验收。

### 4.3 珊瑚线必须继续补充的事实

- 基底附着与 colony anchor；
- 海扇的近二维展开约束，或软珊瑚的三维团簇约束；
- 水流方向、流速与摆动/摄食面的关系；
- 粗承力主干 → 中枝 → 极密末端网络；
- 珊瑚虫、共肉、骨骼或软组织的末端组织；
- 生长、破损、再生、竞争覆盖与局部死亡；
- 不同珊瑚架构不能共享同一物性和末端规则。

## 5. 树线 R06 现在吸收的修正

R06 已有的老师锚点继续保留：

- 主轴先于冠层；
- 一级枝只从明确 tier/node 释放；
- 二级枝来自一级轴，不从世界空间凭空出现；
- 叶与生殖器官只在 terminal organ zone；
- 根语法独立；
- 轴向连续扫掠面 + 明确 taper；
- 禁止全树 global metaball 把层级熔成肿块。

本次新增到知识体系，但暂不冒充已完成运行实现：

- `Supply Samples` 与 `Branch Graph` 正式分层；
- Space Colonization 只作为目标分配与空间竞争声部；
- L-System/Turtle 只作为局部路径与状态语法；
- 每个活跃端必须保存 parent、age、resource、load、occupied-space history；
- 平面/体积约束由 Score 决定；
- 终端密度与主干层级分开控制；
- 后续资源流必须从“全树总预算”升级到 branch-local flow network。

## 6. 共享 Grammar 接口草案

每个生长端最少携带：

```text
TipState {
  position
  localFrame: T/N/B
  parentId
  depth / order
  age
  resource
  downstreamLoad
  active | dormant | stopped | damaged
  allowedVoices
  perceptionVolume
}
```

每一轮：

```text
Sense Field
→ collect candidate samples
→ allocate samples among active tips
→ score candidate directions
→ grow / split / dormant / stop
→ update occupancy and history
→ back-propagate load/resources
→ update thickness
→ update terminal organs/surface
```

## 7. 新增验收门

1. 相机不能改变生成结果；
2. 环境点只能是条件，不能直接成为几何；
3. 必须存在多个 Active Tips 和真实母子分裂；
4. 历史节点只提供占据、遮挡、承载和资源路径，不继续抢目标；
5. 平面扇形与三维冠层必须可以由 Score 明确切换；
6. 主轴、一级枝、二级枝、末端网络必须可分别显示；
7. Thickness 必须接受下游负载/资源历史，不只按层级缩放；
8. Stop/Tip 必须有明确末端组织；
9. 表面连续化不能破坏骨架层级；
10. 珊瑚特征与树特征不得偷渡进共同 Core；
11. 新技巧必须同时接受树/珊瑚至少两类对象的交叉考试；
12. 老师视频和外部资料只留在生产知识库，不成为运行依赖。

## 8. 下一步工作顺序

1. 在树线建立 `Branch-local Resource / Load Graph`；
2. 把 R06 的层级轴与 Space Colonization 的 target allocation 接口连接，但不改变 R06 视觉锚点；
3. 加入 Dormancy / Rebranch / Damage 状态；
4. 用同一接口分别跑：树冠体积 Score、海扇平面 Score；
5. 比较两条生产线的失败记录，只有共同有效的能力才升级为 Core；
6. 珊瑚线的新观察以增量 Markdown/JSON 回流，不复制整套工程，也不覆盖树线锚点。

## 9. 当前结论

这个视频真正有价值的地方，不是教我们“用某一种算法做珊瑚”，而是再次证明：

**自然分叉形态通常需要 Grammar、空间供给、活跃端竞争、生长历史、承载粗细、停止规则与末端组织共同演奏。**

树线与珊瑚线应共享乐器与失败经验，但必须各自保留对象事实与 Score。这样才是“同一个老师、不同声部、相互继承”，而不是两边重复从头做。
