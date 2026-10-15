# N161 — Hair F10 的“相邻轴不翻转”不足以闭合连续扭转声明

- 日期：2026-10-15
- Mother：Hair
- 类型：技术验证 / Teacher Candidate 雷达 / verifier gate
- Bounded question：F10 的体积截面门禁能否排除“每一步都小于 90°、但按弧长高频锯齿摆动”的假阳性？
- 结论：`VOLUME_AND_ORTHONORMAL_SECTION_FRAMES_VERIFIED__HOLD_ARC_LENGTH_NORMALIZED_TWIST_CONTINUITY_UNBOUND`。

## 1. 现有真实失败机制

PR #297 / `HAIR-VOLUME-F10` 把 43 个 clump 各离散成 65 个椭圆截面，并验证每个截面的 tangent / width / thickness 轴为单位正交轴、宽厚非零、源面积与数量守恒。当前 continuity 测试对连续截面只要求 `dot(widthAxis[i], widthAxis[i-1]) > 0`，再要求某处 authored twist 非零。

这能排除单步达到或超过 90° 的宽轴翻转，却不能证明按弧长平滑。合成序列 `0°, 44°, -44°, 44°, -44°` 的每次变化仍小于 90°，因此通过现有谓词；若截面间距为 0.1 mm，其局部角速率却达到 880°/mm。该序列只是 verifier 正控，不是声称 F10 资产已经出现此伪影。

因此本轮保留 F10 已成立的体积、宽厚、正交截面、守恒和 native rebind 证据，只冻结更强的“连续扭转”表述。用户发型/形状接受仍待用户，不被技术门禁代替。

## 2. 外部方法 / Teacher Candidate

Microsoft Research 托管的 Wang–Jüttler–Zheng–Liu 2008 原论文给出 double-reflection rotation-minimizing frame（RMF）：用两次反射传递 frame，报告全局四阶逼近误差；方法对直线/近直线段稳定、无需阈值分支，并具有路径反向对称性。论文实验通过增加离散段数比较误差与收敛，而不是只检查相邻轴同向：

- https://www.microsoft.com/en-us/research/publication/computation-rotation-minimizing-frames/
- https://www.microsoft.com/en-us/research/wp-content/uploads/2016/12/Computation-of-rotation-minimizing-frames.pdf

`GregStanton/proposal-rmf-engine` 把 double-reflection RMF、弧长查表 / Newton–Raphson 重参数化、测试与 demos 放在可运行仓库中；README 说明弧长比例修正用于避免控制点间距不均导致的扭转不均。仓库未归档，最新观察提交为 2025-12-19，包含 Vector 测试扩展；RMF 实现为 MIT，修改的 `shapes.js` 为 LGPL，README 规格为 CC BY 4.0。但仓库明确仍是 Stage 0、无成熟 release，本轮只记 `TEACHER_CANDIDATE`，不得成为生产依赖；2026 维护活性与资产集成成本为 `UNKNOWN`。

- https://github.com/GregStanton/proposal-rmf-engine
- https://github.com/GregStanton/proposal-rmf-engine/commit/06ce8bb118fd010a419b905474445f86ac61f651

它在一个明确问题上比 F10 当前 Current Best View 多知道的是：如何把 RMF transport 与 authored twist 分开，并用弧长参数化、离散细化收敛和路径反向对称性检验 frame 传递，而不是把“相邻轴夹角 <90°”当成 smoothness。

## 3. 与 KAOPU 当前制度比较

R2 与参考复刻门禁已经要求 bounded claim、独立 verifier、positive/negative control 和不越权扩张；本次缺口不是制度缺失，而是 F10 的具体证据原子没有把这些原则落成角速率、采样收敛与 reversal 字段。

既有 `HAIR-GUIDE-ARC-LENGTH-INVARIANT-001` 管 guide 伸缩与弧长不变量，不管 clump 截面 frame 的角连续性；因此新建去重后的 `HAIR-BUNDLE-FRAME-TWIST-CONTINUITY-001` Candidate，而不是改写旧案。

## 4. 可反驳假设

若“连续扭转”不是采样假象，则：

1. 合成的 `<90°/step` 高频 sawtooth 必须被新门禁拒绝；
2. signed / unwrapped twist increment 除以真实截面弧长后，不超过任务级、运行前冻结的预算；
3. 65 与 129 截面结果在运行前冻结的容差内收敛；
4. 正向和反向 transport 在容差内一致；
5. 任何 repeated / near-zero center spacing 都进入 `HOLD_ARC_LENGTH_DEGENERATE`，不得静默除零或跳过。

## 5. 最小试验

10/10 合成回放通过：当前 F10 receipt 缺率值与细化字段、frame 非正交、零长度段、预算未冻结、正控缺失、旧门禁可接受的 sawtooth、非均匀间距 rate spike、细化不收敛、反向不一致、平滑受界序列，均进入预期状态。

关键反例确认：`0°, 44°, -44°, 44°, -44°` 通过现有 dot-product 谓词，但 candidate gate 返回 `HOLD_TWIST_RATE_SPIKE`。阈值仅作为合成探针输入；没有为生产 F10 发明全局数值。

## 6. 适用边界与是否采用

采用为 Hair F10 的 Candidate receipt 增量，不改 R2、不改生产资产、不降低现有 36/27/27 门槛：增加 section centers、signed unwrapped twist、`deg/mm` 局部率、预冻结预算、65/129 收敛、forward/reverse error 与 sawtooth 正控。回滚点是删去 candidate receipt/check，F10 现有几何与证据不受影响。

只有 Hair Mother 在一个 immutable F10 descendant 上实现字段并由独立 verifier `GATE-RUN` 后，才可由协调者决定是否激活。此前不能把 `TEACHER_CANDIDATE` 写成 `AUDITION` 或 `ACTIVE_TEACHER`。

## 7. 生命周期与 KPI

- Teacher：`TEACHER_CANDIDATE`；Mother query：`NOT_QUERIED/UNKNOWN`
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/297#issuecomment-6187187364
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：false
- learning synthetic replay：10/10
- 当前首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、stale delivery 次数、accepted delta 内部迭代数、从指令到合法 candidate 时间：unknown
