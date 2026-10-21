# KAOPU Mother 每日协调会：Worker FIFO 与语义命令所有权

- 日期：2026-10-22（北京时间）
- 实际会议开始：02:30:08 +08:00
- 核心判断完成：02:31:02 +08:00
- 主问题：NPC R04 的“命令代次 + 物理写入权 + 脱离引用快照”是否值得作为 Tailor R03 在途 Worker 命令审计方法
- 实际参与：小妈主持核查；无 Mother 本轮新回复；无外部专家
- main：`5543f756ca3af1428323696324303fa70b8de850`
- 协调分支写前 head：`d4a31996b26508f0dded03731b3f7e4ca6f6c951`

## 1. 会前读取和去重

重新读取当前 main 的根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate，以及 #91、#63、相关 Task Anchor、代码、回归和当前 workflow。

- #91 最新仍为 N170；#63 最新仍为 N49，没有新中央反馈。
- 2026-10-21 已讨论 fail / cancel / restart 的状态边界；本轮不重复该结论。
- 本轮新证据是 NPC R04 exact-head 完整 run 已完成，以及 Tailor R03 现有在途 Worker 边界的源码核查。

## 2. 来源端：NPC Life Observation R04

| R2 检查项 | 当前事实 |
|---|---|
| taskId / target | `NPC-R04-AUTHORITY-20261021`；NPC life observation R07 native workbench |
| target defect | 单一物理写入者、版本化命令、脱离引用 snapshot；防止 stale review 与 UI/verification 干扰 |
| accepted baseline / baseSha | `1ba2b58eb3fdd6efe60b993240e988980547c93e` |
| 用户最后约束 | “从头审核一下这个架构，你自己找重点进行迭代” |
| referenceSet | Current R03 GitHub source；Humanoid Rig Lab Next master/sync rules |
| forbidden routes | placeholder、截图交付、旧页冒新、静默 fallback、降低物理/浏览器门槛 |
| fresh head | `c59077d66edd3b8bbe1956bbe6eabf9610eb37ed` |
| regression / machine / browser | run `39568484287` completed/success；完整本地、exact public bytes、最终 public real-browser steps 均成功；artifacts 绑定同一 head |
| 当前状态 | `CANDIDATE_READY`（机器/浏览器 scoped）；`visualAcceptance=false`、`productionReady=false` |

### 可转移方法

1. transport request id 只对应请求/回复，不能代替 `expectedEpoch + expectedTaskToken` 的语义新鲜度。
2. 已开始的物理帧保持唯一写入权；命令仅在完成帧边界应用并生成 applied/rejected/failed receipt。
3. 对外 snapshot 与内部 live task/physics 断开引用。

这不是对所有系统的通用认证，也不授权复制 NPC 业务代码。

## 3. 接收端：Tailor Layering R03

| R2 检查项 | 当前事实 |
|---|---|
| taskId / target | `TAILOR-LAYERING-R03-CONTACT-DEMAND-20261021`；T08 + T03 + P02 与原静态人物 |
| target defect | 减少重复接触精算，保持阈值和清楚的 restart 语义 |
| accepted baseline / baseSha | R02 scoped candidate；`5186f8a5d71a5e75059539f83a31b2ba1e53042b` |
| 用户最后约束 | 读取 R02→R03 交接，继续独立叠穿，优先性能且保留防穿模门槛 |
| referenceSet | 用户交接包、R02 exact head、R02 原 Worker observation |
| forbidden routes | merge/force push、隐藏衣物休眠、固定 LOD、视觉替代、假时间、把软件 GPU 当用户性能 |
| fresh head | `a49b6eb9bdf9f3bb097a4470465bc463d97dfb7b` |
| regression / gates | 六项完整 CI、三轮 redress、失败 add 事务、desktop + 390×844 Chromium viewport；已有 scoped 成果不变 |
| 当前状态 | `CANDIDATE_READY`（已测范围）；用户视觉接受与 production ready 均 false |

### 新核查结果

Observed：

- Worker 使用 promise chain FIFO；固定步循环等待已开始 step 返回，已有单写者基础。
- Bridge id 用来关联 reply。
- 控件总禁用只由 `!ready || busy` 决定；播放中的 settings/drag 和 stop 后操作可围绕已开始 Worker step 排队。
- 在本轮读取的生产与回归文件中，没有 world epoch、garment instance generation、expected task token 或语义 receipt。

Candidate：

这不证明已发生状态损坏；它只形成一个可反驳问题：同一 logical garment id 在 remove/re-add 后，旧实例命令是否可能被 FIFO 正常执行，却语义上作用于新实例。

## 4. 明确决定与最小验证

不要求 Tailor 照搬 NPC R04，也不把 R03 整体降为 HOLD。

责任端：Tailor Layering R03。

最小验证：

1. 固定 outer garment，不改物理算法，延迟一个真实 Worker step；
2. step 在途时执行 stop → remove outer → 同 id re-add；
3. 注入一条 remove 前创建、re-add 后才处理的旧 drag 或 thickness/settings 命令；
4. 已开始 step 允许完成；旧实例命令必须被拒绝，并留下 reason/receipt；
5. 新实例满足 `GLOBAL_REDRESS_RESTART` 的粒子、时钟、接触历史合同，旧 reply 不覆盖新实例画面；
6. 负控移除实例代次后必须被测试抓住。

若现有 FIFO 已能证明不变量，则不增加机制；若不能，才局部引入最小 world/garment generation，不扩成架构重写。

## 5. 实际交流与生命周期

- 来源边界已 POSTED 至 PR #329，comment `6323529127`。
- 接收审计已 POSTED 至 PR #324，comment `6323529522`。
- `ACKNOWLEDGED / IMPLEMENTED / GATE-RUN（针对本新审计）/ ADOPTED / USER-ACCEPTED` 均无真实证据。
- 未修改任何生产分支、main、冻结成果、排程或学习飞轮。
- 本轮没有交付新的网页/三维工作台；因此没有把旧固定链接、截图或浏览器 viewport 冒充本轮交付。

## 6. 未完成边界与飞轮问题

未完成：Tailor 在途旧实例命令的正/负控结果；是否真的需要 generation 仍为 UNKNOWN。

学习飞轮下一题：如何在不把每个模块改造成复杂事务系统的前提下，用一个最小状态所有权表区分 transport correlation、semantic freshness、physical commit 与 presentation completion。
