# Mother 02:30 协调会有限纪要：Tree Wave R02 不能用“新版本”代替能力继承证明

- 日期：2026-09-29（北京时间）
- 实际协调：02:31:24–02:33:29（2 分 05 秒）
- 参与：小妈协调端 1；可核实 Mother 本轮新接收/回复 0
- 唯一主问题：新 Tree Wave R02 是否真实继承 R01 的已验证能力，并形成可进入生产体系的当前候选
- 决定：R02 为 `HOLD_GATE_FAIL / METHOD_STUDY_ONLY`；不标 `REJECTED_CREATIVE_SUBSTITUTE`，但不得冒充生产候选或已闭合学习成果
- 生产改动：无；未修改 gh-pages、Tree/Coral/Fish/Game 或其他 Mother 分支

## 1. 会前新鲜度与权威输入

已重读 `main@9691221d473278c05a1502e6265c4770a86e8b96` 的根 `AGENTS.md`、R2 Production OS、参考复刻门、Freshness 门。#91 最新仍为 N40 Candidate，#63 最新仍为 N26 Candidate，本轮没有新回执。

学习飞轮新增 N42 `CLAIM-REQUIRES-PREREQUISITE-GATES-001`，固定在 `60bd5c0369daf7457f8704f8a383438470867929`，但其生命周期仍是 `POSTED=false / ACKNOWLEDGED=false / IMPLEMENTED=false / GATE-RUN=false / ADOPTED=false / USER-ACCEPTED=false`；不能把历史回放 `10/10` 冒充 Tree 或 Coral 已采用。

`gh-pages` 在此后产生四个真实提交：

- R01 源码：`541f2ca1387416313454a507ef6f41f891bd79b3`
- R01 QA：`e098bbddf9833fb7a9185a917ac5faf4bb207746`
- R02 初版：`cb020b85ea3ee180f44186813f192ba5afa17565`
- R02 当前 head：`51f4c68a08583302d7558daa65ab25b6968c791d`

这是新产物，不是 stale delivery；问题在于新版本的能力继承和门禁没有被证明。

## 2. R2 九项核对（唯一涉及端：KAOPU Tree-wave 学习执行线）

1. **taskId / targetObject / targetDefect**
   - 未发现正式 Task Anchor 或 taskId。
   - 可从页面无损恢复的对象：非物种复刻的树状/分枝生长波方法练习。
   - R02 声明的 delta：在 `Forward / Branch / Wave / Stop` 上加入 `Field / Space`，并用下游负载反算粗细；当前没有机器合同证明它只增加这些能力而没有遗忘 R01。
2. **accepted baseline / baseSha**
   - `ACCEPTED_BASELINE_SHA=UNKNOWN`；没有用户接受的 Tree-wave 生产基线。
   - R01 `541f2ca...` 可作为**证据化方法学习锚点**：单体 HTML，24,793 bytes，SHA-256 `330f14d9ee6bf9bbbfec73f9107ea1b4c6deec20fd0854721cc94c8df13dfc54`。它不是物种或生产基线。
   - R02 的直接父节点为 R01 QA commit `e098bbd...`，但代码是另建文件和另一套生成/显示路径；“父提交存在”不自动证明能力继承。
3. **用户最后约束**
   - 继续批判性学习和多版练习；基础能力少而稳定，新能力应叠加在已验证锚点之上，不能越学越忘；当前练技巧，不冒充物种复刻或生产完成。
4. **referenceSet 与 UNKNOWN**
   - R01 明示 NSW DPIRD、Australian Museum 与 Runions 等三维分枝方法来源，并明确工程设定/非照片测量。
   - R02 页面只写 “L-system / Space Colonization” 方法名称，未固定具体原始来源、版本、许可或逐项可证明关系；其 referenceSet 对 R02 为 `INCOMPLETE`。
   - 真实树种/珊瑚物种、尺度、组织、载荷物理、生长时间、场变量语义与用户视觉接受均 Unknown。
5. **forbidden routes**
   - 把方法练习写成物种复刻、Tree/Coral/Fish 已采用、真实生长或物理正确；把版本号当继承证明；用线宽/2D 投影冒充真实表面几何；以 Pages success 替代当前候选的机器、参考和浏览器门。
6. **fresh head delta**
   - R02 当前为独立单 HTML，10,352 bytes，SHA-256 `ba5e74fe8747a3f0915061043571ad8ef394b1b7d67889ad84a5f44ca920fdc1`。
   - 页面新增 fan/radial/volume 三张 Score、Field、Space、分叉倾向和末端密度；代码确有新算法，不是只改文档或版本号。
   - 但 R01 使用 WebGL 三角面实体并有同一网格的 2D fallback；R02 只调用 `canvas.getContext('2d')`，以线宽绘制所谓“粗细结构”。因此 R02 没有证明继承 R01 的真实三维表面能力，反而可能是表示降级。
7. **applicable regression cases**
   - `MOTHER-NO-METHOD-INVENTION-001`：当前未判复发，因为页面明确标注非物种复刻，且本轮是获准的学习探索；但后续若直接路由为生产形体，即触发该回归。
   - Freshness：PASS（确有 dispatch 后新字节），但 Target/Inheritance 与 Real-3D 尚未通过。
   - N42：只能作为未采用的 Candidate 方法；本轮 Tree R02 没有 claim contract 或 prerequisite receipts。
8. **machine / reference / browser gates**
   - R01 当前 exact-public QA run `36428212762` 成功，覆盖桌面与 390×844 hosted Chromium；Pages run `36428211154` 成功。它只证明 R01 当时的公开运行，不证明 R02。
   - R02 当前 head 只有 Pages run `36430564497` 成功。
   - Tree QA workflow 的 path 仅覆盖 `game-coral-mother-wave-r03/tree-wave/**`，URL与 expected SHA 也固定为 R01；R02 路径 `tree-wave-r02/` 不会触发、也不会被检查。
   - R02 的 current-head browser、390×844、standalone `file://`、console、无网络依赖、真实三维、消融对照和参考门均未运行。
9. **当前状态**
   - R01：`VERIFYING / EVIDENCE_BACKED_METHOD_STUDY`，不是生产基线。
   - R02：`HOLD_GATE_FAIL / METHOD_STUDY_ONLY`；不能晋级或路由给生产 Mother。

## 3. 明确决定与有限方法

保留 R01 和 R02 两份源码，不覆盖、不删除；但把 R01 作为当前已验证学习锚点，R02 只作为尚未验证的增量实验。下一步不再先做 R03，而是给 R02 补一份短 Task Anchor 与统一 receipt，明确：

- inherited capabilities：`Forward / Branch / Wave / Stop / seed determinism / real surface geometry`；
- added capabilities：`Field / Space / downstream-load thickness / multi-score`；
- prohibited regression：不得从 WebGL 实体退化成只有 2D 线宽的视觉替身；
- 每项能力必须绑定一个消融或对照，不以画面“更丰富”代替因果检查。

若 R02 的目的只是二维算法示意，必须改名并固定为 `ALGORITHM_DIAGRAM_ONLY`，不得在工作台或生产继承链中称为三维形体。

## 4. 责任端、最小验证与未完成边界

- **责任端**：KAOPU Tree-wave 学习执行线；Tree/Coral/Fish/Game 仅为后续消费者，当前无采用权责。
- **最小验证**：在同一 seed、同一初始 Score 下做 R01/R02 对照；R02 以真实 WebGL mesh 输出，逐项关闭 Field、Space、Wave 和负载粗细，证明各自只改变声明的关系；固定 source/head/HTML SHA，运行 `file://`、公网桌面与 390×844；生成 inheritance receipt，列出保留、增加、退化、Unknown 四类。
- **否定反例**：若关闭 Field/Space 后仍不能恢复 R01 的核心结构关系，或 R02 继续只有 Canvas2D 线宽而无表面网格，即使 Pages 成功、分枝更多、画面更漂亮，也不能称为能力继承。
- **未完成边界**：正式 taskId、R02 原始来源固定、真实三维表面、current-head browser/file 门、物种对应、Mother 采用、性能与用户验收均未完成。

## 5. 生命周期账

- `POSTED=false`：没有向实际 Tree/Coral/Fish/Game Mother 定向路由的可核实记录；公开 Pages 存在不等于 POSTED。
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`：R01/R02 均有实际代码和新字节。
- `GATE-RUN=PARTIAL`：R01 有 gate；R02 当前只有 Pages deploy。
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 6. 学习飞轮下一题

怎样为“在稳定技能锚点上继续学习”建立最小机器可查的 inheritance certificate：既能证明新增 Field/Space 等能力，又能检测 renderer、几何、坐标、语义或门禁被无意替换/遗忘；同时避免把每次学习都冻结成庞大格式？

## 7. 固定来源

- R01 源码：<https://github.com/haihao0307/guilin-dem-pipeline/commit/541f2ca1387416313454a507ef6f41f891bd79b3>
- R01 QA：<https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36428212762>
- R02 当前 head：<https://github.com/haihao0307/guilin-dem-pipeline/commit/51f4c68a08583302d7558daa65ab25b6968c791d>
- R02 Pages run：<https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36430564497>
- N42：<https://github.com/haihao0307/guilin-dem-pipeline/blob/60bd5c0369daf7457f8704f8a383438470867929/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-09-28_CLAIM_TO_GATE_DEPENDENCY_N42.md>
- #91：<https://github.com/haihao0307/guilin-dem-pipeline/issues/91>
- #63：<https://github.com/haihao0307/guilin-dem-pipeline/issues/63>

本纪要只追加协调知识；未修改生产、冻结成果、日程、自动化或学习飞轮。
