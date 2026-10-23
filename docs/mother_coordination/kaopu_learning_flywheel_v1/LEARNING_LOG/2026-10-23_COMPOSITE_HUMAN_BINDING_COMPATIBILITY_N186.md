# N186 — “所有部件都最新”仍不能证明身体绑定兼容、动作无自穿透

- 日期：2026-10-23
- Mother：Human / NPC life observation
- 类型：制度验证 / composite binding / runtime self-interpenetration
- Bounded question：脸、身体、骨架、绑定与动作都分别指向最新版本，能否据此证明组装后的真人在实际动作中绑定正确且不会身体自穿透？
- 结论：不能。当前事件仍先处于 `HOLD_COMPONENT_IDENTITY_UNRESOLVED`；即便 N182 通过，也必须另证 relation compatibility 与 scoped runtime self-collision。

## 1. 新增真实失败与去重

用户进一步纠正：此前只换了脸，身体不是最新；最新平台的人物还包括身体、动作和身体绑定信息，当前身体在运动中会自穿透。

不为“最新身体”重复建立 freshness case：N182 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` 已覆盖 body / skin / rig / motion 的逐项 expected-vs-actual identity，本轮直接把它作为前置门禁。

本轮新增的是关系失败：每个 component ref 都可以分别正确，但 joint order、parent graph、bind/rest space、inverse binds、skin weights、motion targets 或坐标系仍可能彼此不兼容；即便结构关系兼容，动作轨迹也可能产生身体自穿透。

## 2. 当前 R04 已证与未证

冻结 runtime `b386dd9780ddc5b01676fe46117d56d973725ac7` 已有真实价值：

- `AssetContract.cjs` 锁定原始 packet / appearance bytes；
- `NativeBinding.mjs` 保留原生 104-bone rig 与所有 CSR influences，验证 weight sum、display lineage 与 neutral reconstruction error；
- `NativeRig.mjs` 验证 names / parents / rest matrices 的基本完整性并保持 bone length；
- `ActorAdapter.mjs` 与 `verify-browser.cjs` 对手和前臂相对桌面、瓶子、窗把等选定外物做 sampled signed-distance 门禁。

但当前 penetration scope 明确只覆盖 hand / forearm 与外部有限 box/cylinder，且注明不是连续 triangle collision。搜索冻结 source 未发现 inverse-bind compatibility receipt 或 whole-body self-interpenetration gate。因此这些证据不能回答用户本次的“最新身体绑定 + 动作自穿透”纠正。

## 3. 外部老师候选：Khronos glTF 2.0 specification + glTF-Validator

状态：`TEACHER_CANDIDATE`；Mother 查询状态：`NOT_QUERIED/UNKNOWN`。

它到底在哪一个明确问题上比 KAOPU Current Best View 多知道了什么？

> 它把 skinned-mesh 兼容性明确表达成可验证的关系：skin.joints 的顺序必须对应 inverseBindMatrices 的元素顺序，joint hierarchy 有 common root，mesh 用 JOINTS_n / WEIGHTS_n 指向该 joint mapping，animation channels 再指向实际 node。KAOPU 当前 evidence 擅长锁定 bytes、原生权重与局部实际几何，但没有把“最新 body-binding-motion”输出成这样一个跨对象关系 receipt。

八项筛选：

1. provenance：Khronos Registry 的 ratified glTF 2.0 specification 与 KhronosGroup 官方仓库；
2. 活性：validator issue 列表在 2026-05-25 仍有新增问题，glTF 主仓库 2026-09 仍有 PR 活动；精确最新 release 日期本轮未可靠确认，记 unknown；
3. 可运行性：validator 提供 CLI、web、NPM/JS API、JSON report，仓库含 `test/`，changelog 记录 300+ unit tests；
4. license：validator Apache-2.0；glTF 2.0 specification source CC-BY-4.0；
5. 相关性：直接相关于 joint mapping / inverse bind / weights / animation target 的结构一致性；
6. novelty：相对当前 KAOPU 多出的是“跨组件关系 schema + machine-readable validator issue”，不是又一个 component hash；
7. 依赖与成本：可只借字段语义和负例，不必引入 glTF 格式或 Dart/JS validator；若直接运行工具则有格式转换与集成成本；
8. 风险：它不证明 KAOPU 原生 R07 数据的业务 canonical 身份，也不检测身体自穿透、动作自然度或用户接受；validator 对部分 SHOULD/MUST 解释存在公开 issue，不能把零 validator error 当生产验收。

因此只保留为专项老师候选，不进入 Teacher Registry/referenceSet，不声称已被 Mother 认可。

## 4. 可反驳假设与最小回放

假设：只要 N182 的 component vector 全部 exact match，就足以允许“最新人物和动作”进入候选。

11/11 分类回放反驳该假设。负例分别覆盖：越界 joint index、inverse-bind joint order 错位、旧 bind pose、motion target set 错位、没有 actual action trace、没有 whole-body self-collision observation、超阈值自穿透、Producer 自批，以及未运行负对照。只有 exact component prerequisite、完整关系 manifest、固定动作 runtime evidence、独立 verifier 和四个 negative controls 全部成立时，才得到 scoped pass。

四个必需负对照：`SHUFFLED_JOINT_ORDER`、`STALE_BIND_POSE`、`MISSING_MOTION_TARGET`、`DISABLED_SELF_COLLISION_GATE`。

## 5. Candidate 增量与适用边界

建议仅在下一次 Human 单 Mother 任务中试行：

- Task Anchor：明确 body mesh、skin binding、skeleton、bind pose、motion、coordinate frame、固定动作集、自穿透阈值；
- Delivery Receipt：输出 joint / inverse-bind order、parent graph、bind pose、motion target、action trace 与 whole-body sampled interpenetration 的 immutable digest / measurement；
- Verifier：必须独立于 Producer，并证明四个负对照会被拒绝；
- 状态：结构关系通过但未运行真实动作仍 HOLD；动作运行但没有 whole-body observation 仍 HOLD；发生 material penetration 则 REJECT。

边界：这不是连续 triangle-triangle collision 的通用证明，不替代视觉验收，也不要求 KAOPU 改用 glTF。采样部位、动作集、阈值、设备、runtime 与 verifier 版本必须写入 receipt。

## 6. 生命周期

- Candidate regression：`COMPOSITE-HUMAN-BINDING-COMPATIBILITY-001`
- 历史回放：11/11
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/329#issuecomment-6356837805
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：false / unknown
- 生产 Mother 分支修改：无
- KPI：当前用户纠错事件 1；首次候选通过率、同错复发率、rejected lineage 继承、stale delivery、accepted delta 内部迭代均 unknown。

## 7. 一手来源

- https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
- https://github.com/KhronosGroup/glTF-Validator
- https://github.com/KhronosGroup/glTF-Validator/blob/main/ISSUES.md
- https://github.com/KhronosGroup/glTF-Validator/blob/main/CHANGELOG.md
- https://github.com/KhronosGroup/glTF/blob/main/COPYING.adoc
