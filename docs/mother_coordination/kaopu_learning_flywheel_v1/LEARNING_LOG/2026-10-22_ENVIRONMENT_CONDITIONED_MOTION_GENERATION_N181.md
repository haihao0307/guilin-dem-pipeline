# N181 — 场景执行不等于场景条件动作生成

日期：2026-10-22  
状态：`CANDIDATE / NOT_ADOPTED`  
bounded question：已有动作片段经重定向、导航和接触修正后在场景中成功执行，能否证明系统已经按门、窗、楼梯和物体状态生成或训练出动作？

## 当前真实失败风险

用户最新纠正要求从“不断寻找现成动作”转为：在包含门、窗、楼梯、桌子、柜子和可搬运物体的简易生活场景中，让最新自有人物生成、适应并训练动作。若仍把“选中现成动作 + 场景内播放/修正”称为“动作生成”，会继续沿着已被用户否定的父路线扩展动作库。

## 当前生产事实

### PR #334 / JST-2 R01

- head：`8b6878225db2b9c436c68114c9f855d1584f5a19`
- README 明确定位为六个官方公开动作的回放与原生 104 骨人物重定向。
- `retarget-native.mjs` 明确写明：无源动作时不合成；只做旋转重定向；不声称碰撞/接触求解；不会自动修复脚滑。
- 因此该成果可作为 motion prior、重定向研究台和来源样本，不是环境条件动作生成器。

### PR #319 / NPC Living Street R02

- head：`befcd9aa6a9b81a1d0f808695df974bfd33221b1`
- `NativeMotionLibrary.mjs` 固定复用 CMU `16_15` 步行、`115_06` 拾取和 R04/R05 连续性；导航拥有世界路径。
- `BreadApproachPath.mjs`、`BreadTransportPath.mjs`、`SeatMotionPath.mjs` 是手写分段轨迹；接触层会测量真实柜台、鞋底、手掌和物体并做局部 IK/约束修正。
- 这证明“固定动作 + 场景条件执行适配”可做到真实接触，但尚不能证明控制器从变化环境中生成动作策略。

## 新增的三层分类

1. `BEHAVIOR_SELECTION`：决定做什么，例如选择开门、拿面包或坐下。
2. `SCENE_ADAPTED_EXECUTION`：固定动作/轨迹在当前人物与场景上重定向、导航、IK、接触修正。
3. `ENVIRONMENT_CONDITIONED_GENERATION`：同一控制器/优化器以环境状态和任务约束为输入，在未见过的几何或物体状态上生成/修正完整动作，并对碰撞、脚滑、接触、完成率负责。

前两层通过，不能自动升级为第三层。

## 可反驳假设

若系统真的具备 `ENVIRONMENT_CONDITIONED_GENERATION`，则冻结人物、控制器、场景族和任务合同后，仅改变门角、台阶高度、物体位置/质量或障碍布局，同一控制器应在 held-out 变化上产出新的动作轨迹；且不得静默回退到固定片段。独立 verifier 能从 receipt 中重算任务完成、穿透/碰撞、足底滑移和接触误差。

反例：只换动作片段、只选行为、只沿手写路径插值、只在一个固定场景做末端 IK，或生成失败后回退固定片段，均不能证明该假设。

## 最小试验（单 Motion Mother，不全局强制）

场景只保留一个房间、一个最新原生人物与五类任务：开门、开窗、上下楼、搬运、放置。冻结训练/调参场景，预先保留至少一个 held-out 变化组合。记录：

- `humanArtifactSha`、`controllerArtifactSha`、`sceneFamilySha`；
- 输入环境状态与任务目标；
- 生成/优化过程及是否调用 motion prior；
- 每次 rollout 的完整关节/根轨迹；
- 碰撞/穿透、足底滑移、接触误差、物体 custody、任务完成；
- fallback 触发与实际输出来源；
- 独立 verifier 的重算结果。

允许现成动作作为 prior 或 baseline，但 receipt 必须标出其贡献；不允许把动作片段本身记为本轮生成结果。

## Candidate 制度增量

Task Anchor 候选字段：

- `motionOutcomeType: PLAYBACK | RETARGET | SCENE_ADAPTATION | ENVIRONMENT_CONDITIONED_GENERATION`
- `environmentVariationContract`
- `heldOutVariationSet`
- `motionPriorPolicy`
- `fallbackPolicy: FAIL_CLOSED | DISCLOSED_BASELINE`

Delivery Receipt / verifier 候选字段：

- `actualMotionOutcomeType`
- `controllerArtifactSha`
- `inputStateDigest`
- `rolloutDigest`
- `motionPriorUsage`
- `fallbackTriggered`
- `taskCompletion / collision / penetration / footSlip / contactError / custody`
- `independentVerifierReceipt`

在最小历史回放与单 Mother 试验通过前，不修改 R2 OS，不宣称 `ADOPTED`。

## 边界与决定

- 本规则不否定 #334 的回放/重定向研究价值，也不否定 #319 的场景接触执行价值。
- 只阻止跨层升级表述；若任务只要求可靠播放或固定场景执行，前两层可以独立验收。
- 本轮分类器历史回放 7/7 命中预期；这只证明状态语义可执行，不证明生产动作生成已经实现。
- Teacher Candidate：`NO_NOVELTY`（本轮没有引入外部老师；新增来自用户纠正与当前生产代码对照）。
- 路由状态：已定向 POST 至 #334（comment `6332119497`）；未有 Mother 回执前保持 `POSTED`，不得写 `ACKNOWLEDGED/IMPLEMENTED/GATE-RUN/ADOPTED/USER-ACCEPTED`。

