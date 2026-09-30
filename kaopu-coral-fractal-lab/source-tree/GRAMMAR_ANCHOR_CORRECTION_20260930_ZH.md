# KAOPU TREE FRACTAL WAVE｜GRAMMAR ANCHOR 修正记录

日期：2026-09-30

## 用户纠偏

上一版 TREE FRACTAL WAVE LAB R01 方向偏离：过早把 Bark / Leaf 展开为显式 polygon / surface geometry，并以“真实几何”作为深化方向。该方向不作为后续基础。

用户要求回到最早无色 Tree Wave R01 的效果与函数关系，把它冻结为 Grammar Anchor，再从这个正确基础向前。

## Anchor

权威视觉/结构锚点：game-coral-mother-wave-r03/tree-wave/index.html

独立冻结副本：kaopu-tree-fractal-wave-lab/anchor-r01/index.html

锚点保留的核心不是灰白颜色，而是：Score 只存规则与参数；中心轴/分枝由函数求值；Forward / Branch / Wave / Thickness / Stop / Tip 是关系；改参数重新演奏，不保存对象结果；不把外部 mesh 当产物；观察重点是关系是否正确。

## 关于“不要走几何”

必须区分三个层次：

1. 世界描述 / Truth Representation：不得以 polygon mesh、面片资产、雕刻结果作为事实本体。
2. 函数关系 / Implicit or Procedural Representation：对象由 f(position, time, score, field...) 或中心线/截面/场函数定义；这是主路径。
3. 显示后端 / Renderer：当前 WebGL 浏览器最终可能仍需要临时三角化/rasterization 才能显示。它只是瞬时显示实现，不是知识、Score 或资产。未来继续研究 raymarch / SDF / implicit surface / WebGPU 等更直接的函数求值显示。

因此“无面”首先冻结为数据与知识层无面，而不是虚假宣称 GPU 屏幕内部完全没有三角形。

## 后续颜色原则

颜色不得通过“给做好的 mesh 贴材质”加入。颜色应是另一个函数声部：Color = C(position, branch_state, age, orientation, field, time, score)。它与形体函数共享事实输入，但不改变 Grammar Anchor。

branch age/depth 可驱动基础色趋势；orientation/light exposure 驱动环境响应；moisture 驱动湿润色与 roughness；ridge/crevice 若未来由函数场存在，颜色读取同一函数场；random 只能低权重破重复，不能替代原因。

Substance 值得学习的是 procedural masks / shared facts / channel relationships，而不是复制节点图或烘焙贴图。

## 叶片修正

暂不把叶片定义成“由脉络撑起 polygon surface”。下一步先研究函数表达：midrib curve M(s)、lateral vein field V(s,u)、width envelope W(s)、camber C(s,u)、twist T(s)、thickness H(s,u)、boundary B(s,u)、color field K(s,u,...)。最终叶片优先被理解为一个可求值的三维关系/场，而不是预制网格。

## Grammar Anchor 纪律

任何新能力必须满足：
1. 不能破坏 Anchor 已验证结构；
2. 新声部可关闭，关闭后必须精确回到 Anchor；
3. 新能力保存函数/参数，不保存展开后的结果；
4. 新方法失败时删除/旁路新声部，不重做 Anchor；
5. 每次升级明确写出“继承了什么、增加了什么、没有改变什么”。

一句话：先守住正确的 Grammar Anchor，再把 Color、Leaf、Microscope 作为可插拔函数声部叠加；不是把锚点重新建成一堆面。


# TREE LIFE GRAMMAR｜完整生命逻辑增补（2026-09-30）

## 核心状态
树不是成年形体的参数化变体，而是一个从 Seed 到死亡/更新的时间函数。统一状态建议为：

T = 年龄/生命时间；E = 环境事实；S = 物种/个体 Score；History = 已发生事件。

Tree(T,E,S,History) 同时演奏 Root、Shoot/Trunk、Crown、Cambium/Rings、Bark、Leaf、Damage/Weathering、Reproduction。

## 1. Seed / Ground Anchor
种子/萌发点是上下两个系统的共同锚点。透明地面只属于观察层，不属于树本体。地表以下 Root 向水分、养分、空间阻力场生长；地表以上 Shoot 向光、重力反方向、空间竞争场生长。二者同步，不是先做树再补根。

## 2. Root ↔ Shoot 同步耦合
Root 与 Crown 必须交换状态：根系获取能力约束地上生长；冠层光合/资源又支持根系继续扩张。不同 Score 可让根冠比、主根/侧根、板根/浅根等完全不同。部分根可以越过地表函数，因此允许露根，而不是人为摆一段根在地上。

## 3. Cambium / Rings / Thickness
年轮不是贴在截面上的图案。每个生长周期向 cambium 状态累积一次径向增量；主干和枝条半径由历史累积与承载共同决定。年龄 1、5、100、200 年应来自同一时间函数，不是不同模型。气候/资源可改变每年的增量，因此年轮宽度可记录历史。

## 4. Bark Life
Bark 是 cambium 外侧随年龄演化的函数层：嫩皮 → 成熟皮 → 老皮。Warp、纵裂、横裂、脱落、愈伤等读取年龄、局部膨胀、方向、湿度、损伤历史。不得把 bark 简化为固定贴图。

## 5. Branch Life / Damage
Branch 有 birth、growth、load、competition、dormancy、break、wound、weathering 状态。断枝不是删掉一段函数：断点进入 wound，随后可风化、愈伤包覆或成为腐朽入口。事件写入 History，后续形态读取历史。

## 6. Leaf Life
叶片同样是时间函数：bud → unfold → expand → mature → senesce → abscise/fall。Midrib/vein/width/camber/twist/color 都随 leaf age 与环境演奏。黄叶与落叶不是换贴图；颜色与脱落条件读取同一生命周期事实。

## 7. Tree Types
所有树共享上述生命合同，但 Score 不同：寿命、根冠比、分枝语法、叶型、落叶/常绿、树皮演化、损伤恢复、成熟时间等都由 Score 决定。因此“大叶树/针叶树/巨大根系树”不需要各建一套世界逻辑。

## 8. 时间尺度
演示可把 200 年压缩到几十秒，但必须明确这是 time compression。运行世界中 T 仍是事实时间；不能把演示速度误写进生物规律。

## 9. 下一工作台验收顺序
Seed/Ground → Root+Shoot 同步 → Crown → Thickness/Rings → Bark Age/Warp → Branch Damage → Leaf Lifecycle → Color/Material Function → Wind/Environment。

原则：每个声部都可关闭；关闭新增声部必须回到 Grammar Anchor。知识层仍只保存函数、Score、初始条件和事件历史，不保存展开后的 mesh 结果。
