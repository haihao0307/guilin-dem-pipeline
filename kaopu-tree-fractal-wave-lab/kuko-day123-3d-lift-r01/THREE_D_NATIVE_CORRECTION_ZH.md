# KuKo Day 123：从“投影锁定 Lift”到“原生三维分形”的纠偏

## 先冻结结论

R01 的 Projection-Locked Lift 是有价值的学习台，但它还不是“原生三维分形”。

R01 做的是：
1. 从老师二维 Shader 的逆查询链重建正向父子节点图；
2. 保持老师导出的 X/Y 不变；
3. 额外给节点增加可撤销的 Z。

这证明了“二维语法可以被重建并进入三维观察”，但 Z 还没有参与“哪里应该长、哪里应该分枝、哪个芽应该活”的决定。因此 R01 必须保留为中间 Grammar Anchor，不能被误称为最终三维语法。

## 原生三维分形真正要改变的地方

### 1. 生长方向不是二维角度 + Z 偏移

每一个生长节点必须携带完整三维局部框架：

- 位置 P
- 主方向 T（tangent）
- 横向轴 N
- 横向轴 B

子枝方向不是简单的“左 / 右”，而是在父节点局部坐标系里由：

- elevation / inclination（离开父轴多少）
- azimuth（绕父轴转到哪个方位）
- torsion / roll（局部框架怎样扭转）

共同决定。

二维老师中的 +/-ANGLE 只对应这个球面方向空间的一个特殊平面切片。

### 2. 分枝位置必须由三维芽决定

不再先生成一根二维枝然后抬高 Z。

每个可生长节点是一个 Bud。Bud 是否释放，要同时看：

- 物种 Score 是否允许这个节位产生侧芽
- 当前年龄 / 发育阶段
- 顶端优势 / 内源信号
- 三维空间是否已经被自己或邻居占据
- 光场、重力、风、湿度等环境方向
- 父枝承载能力与资源预算

只有 Bud 被激活，才产生新的三维 Shoot。

### 3. “哪里该多一根枝”是三维空间竞争问题

空间不再是二维画布，而是 3D field。

对每个 Bud 建立 perception volume。它在三维空间内观察可用方向，并从候选方向集合中选择最合适的方向。

概念上：

V = normalize(
    w_species * V_species
  + w_light   * V_light
  + w_space   * V_freeSpace
  + w_gravity * V_gravity
  + w_wind    * V_windHistory
  + w_parent  * V_parentContinuity
)

然后再由 Score 约束允许的 inclination / azimuth / branch order。

### 4. 分枝数不是固定 BR 的机械复制

KuKo 老师的 BR=3 / 4 是一种非常清楚的语法老师，但真正三维植物不应该默认每一级都固定复制 BR 个子枝。

原生三维系统应把：
- potential buds
- active buds
- dormant buds
- aborted buds
- broken / shed branches

分开。

“有几个候选芽”和“最后长出几根枝”不是同一个量。

### 5. 三维空间必须有占据与排斥

每个枝段、芽、叶簇都向世界写入 occupancy。

新的 Bud 查询周围空间：
- 太近：抑制或改变方向
- 空间充足：释放
- 光好但承载不足：延迟或缩短
- 竞争失败：休眠 / 脱落

这样冠层密度和空洞由三维竞争形成，而不是靠二维图案再加深度。

### 6. 半径、资源与受力沿树图双向传播

三维拓扑形成后，不能只画线。

需要至少两条内部流：
- acropetal：基部 → 末梢，资源 / 生长信号
- basipetal：末梢 → 基部，叶量 / 负载 / 支撑需求

半径由下游负载、枝阶和历史决定，而不是只按 recursion depth 缩放。

### 7. 风必须从“相位”升级为“力”

KuKo 的 wind0 / wind1 很适合作为“节点不同相位”的老师。

但三维版中应改成：
- 外界风场给每个枝段力
- 父枝接收子枝惯性和阻力
- 位移 / 弯曲沿拓扑传播
- 不同节点自然出现不同相位

老师相位可以作为快速近似或风声部种子，但不能作为最终物理解释。

## R02 的结构

### A. 3D Grammar Core
- Node(position, frame, age, order, resource)
- Bud(parentNode, azimuthSlot, state)
- Shoot(parentBud, direction3D, lengthSchedule)
- OccupancyField
- EnvironmentField
- LoadFlow / ResourceFlow

### B. Teacher Voice
KuKo 只提供：
- 路径寻址思想
- 局部变换思想
- 分枝层级
- 子树剪枝
- 节点独立相位

不提供：
- 某个物种的三维 azimuth
- 某个物种的芽释放率
- 三维冠层目标
- 根系
- 半径和真实力学

### C. Species Score
物种谱决定：
- 哪些 Bud 允许存在
- 分枝阶数
- 角度分布
- phyllotaxis / azimuth 规律
- apical dominance
- internode length
- branch shedding
- root/shoot allocation
- organ lifecycle

因此“老师语法”和“树种事实”永远分开。

## R01 与 R02 的关系

R01 Projection-Locked Lift：保留，作为从二维老师解剖到正向节点图的回归台。

R02 Native 3D Grammar：不再锁 XY。每一个分枝决定直接发生在三维局部框架与三维环境场中。

验收时保留三个视角：
1. Teacher 2D：原始老师；
2. R01 Lift：证明我们没有误解二维拓扑；
3. R02 Native 3D：证明系统已经不依赖二维画布来决定枝条生长。

## 关键验收门

- 改变相机不改变生成事实。
- 把所有节点投影到任意平面只是“观察”，不再是生成依据。
- 改变三维光场方向，分枝会在三维空间重新竞争，而不是只左右偏。
- 加一个三维障碍物，芽会绕开 / 休眠 / 换方向。
- 关闭 Space / Light 等新声部后可以回到纯 Grammar baseline。
- 更换 Species Score 可以让同一个 3D Grammar Core 演奏另一类分枝策略，而不改核心代码。
