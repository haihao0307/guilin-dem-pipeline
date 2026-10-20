# KAOPU Mother 日常协调纪要：失败、取消与重启的状态边界

- 日期：2026-10-21（北京时间）
- 实际开始：02:30:00 +08:00
- 核心判断完成：02:32:58 +08:00
- 主问题：布料失败回滚、交互取消与全局重启不能共用同一种 reset 语义
- 会议参与：小妈主持核查；未取得任何 Mother 本轮新回复；无临时专家
- 协调分支写前基线：`08b9f76e210a8deec85cf89d8f71dbddd52b15c9`
- 生产 main：`5543f756ca3af1428323696324303fa70b8de850`

## 1. 会前核查

本轮重新读取当前 main 的：

- 根 `AGENTS.md`
- `knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md`
- `knowledge/REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md`
- `knowledge/TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md`
- #91、#63 最新反馈
- Tailor layering R02、NPC living street R02、NPC life observation R02 的 Task Anchor、状态、源代码与回归证据

#91 最新仍为 N170，#63 最新仍为 N49；没有新中央反馈。本轮没有复用旧反馈冒充新问题。

## 2. 唯一跨模块问题及证据

### Observation A：布料失败回滚

Tailor layering R02 head `5186f8a5d71a5e75059539f83a31b2ba1e53042b` 的 `LayerWorld.step()` 在生产步失败时恢复：

- 衣物位置、速度与上一位置；
- 衣物自己的时间与步数；
- 世界时间、步数及上一接受诊断；
- 接触历史 checkpoint。

其 remove/add 回归明确断言恢复后 `completedSteps=0`、`simulationSeconds=0`；当前语义是 `GLOBAL_REDRESS_RESTART`，不是保留其余衣物状态的续接。

状态：代码与新 CI 存在；不是用户验收，也不证明 retained-state re-entry。

### Observation B：交互取消保留物理事实

NPC life observation R02 head `339a687dcc64160bd78730c671b8926b62af55df` 的窗户取消：

- 移除临时 grip；
- 清除预约与任务；
- 保留铰链约束；
- 不回写叶片姿态，不抹去角速度。

现有原生报告记录取消后仍有约 `-9.06°` 的惯性行程。这证明“取消任务”不等于“撤销已经发生的物理运动”。

状态：实现与已记录 gate 结果存在；不是本轮 Mother 新回复。

### Observation C：NPC 街区真实闭环仍缺一段

NPC living street R02：

- taskId：`NPC-LIVING-STREET-R02-20261020`
- head：`e22a17a26ed0ee5672c8415aae644011e244d504`
- targetObject：六个完整原生人物的自主街区
- baseSha：`975d8295605ecb3dd703c3d87d92d40223d9206a`
- accepted baseline：CURRENT_HUMAN R07 原生人物；R01 仅是工程外壳
- referenceSet：R07 人物、MP05 R10 服装、R14 鞋/头发、LongHairLayer、Motion R04/R05
- forbidden routes：继续受 Task Anchor 的替代对象、假动作、计时冒充世界结果等约束
- fresh head delta：六人、瓶子优先响应、天气与窗/阀环境互动及 22 项语义回归
- regression status：逻辑夹具 22/22；包含“取消阀门保留角度”“无手掌不再驱动”“雨中重新派人关阀”
- machine/reference/browser gates：仅 startup diagnostic；`releaseCandidate=false`

关键限制：`INDEPENDENT_R02_OPEN_VALVE_DISPATCH.json` 自己标明 `SOURCE_LOGIC_FIXTURE_ONLY`，使用 stub mechanism；没有真实手掌、关阀完成、原生场景、视觉或浏览器证明。因此不能从 22/22 推导真实链闭合。

## 3. 明确决定

不把 fail / cancel / restart 都实现为全局 reset：

| 事件 | 保留 | 清除/恢复 |
|---|---|---|
| `FAILED_STEP` | 最后 accepted state | 撤销本次尝试对物理、逻辑、时钟与接触历史的未接受改变 |
| `CANCELLED_INTERACTION` | 已发生的物理状态及惯性 | 清除临时 owner、claim、intent、grip 与旧 token |
| `GLOBAL_RESTART` | 仅保留合同允许的外部输入 | 只有任务明确是新会话/重新穿戴时才重置世界时钟与全局状态 |

这是有限核查方法，不冻结庞大新格式，也不要求各模块强制同名。

## 4. 责任端与最小验证

责任端：NPC Living Street R02 / Game execution line。

一个 bounded integration run：

1. 持续下雨，人物 A 真实接触阀门并打开至中间角度后取消；
2. A 的临时 grip、resource owner、claim 与 intent 清除，旧 token 被拒绝；
3. 阀角不瞬移；除了真实惯性，无手掌时不再被脚本驱动；
4. 人物 B 获得新唯一 token，接触同一阀门并关闭；
5. 不增加虚假 watering credit，`valvesClosed` 只计一次，最终无 stale owner/reservation；
6. 新 run 绑定准确 head SHA 与报告。若无视觉变化，可按 validation-only，但不得拿旧 run 或旧截图填充。

该方法已实际 POSTED 到 PR #319，comment id `6298263727`。没有 ACKNOWLEDGED、IMPLEMENTED、ADOPTED 或 USER-ACCEPTED 证据。

## 5. 当前状态与边界

- NPC Living Street R02：`VERIFYING / releaseCandidate=false`
- 已知状态：`IMPLEMENTED + GATE-RUN (fixture only)`
- 未完成：真实原生取消—释放—再认领—关阀闭环
- 未修改：生产分支、人物/服装资产、Canonical Truth、既有冻结、排程与学习飞轮
- 未进行：公网成品交付、用户浏览器/实机验收
- 本轮没有新的网页工作台交付；因此不以截图、沙盒地址或旧固定页冒充本轮交付

## 6. 学习飞轮下一题

怎样用最小“状态所有权矩阵”统一说明物理状态、逻辑所有权、任务 token、时钟/历史在 fail / cancel / restart 三类事件中的保留与清除范围，同时避免每个 Mother 各造一套名词或引入文档膨胀。
