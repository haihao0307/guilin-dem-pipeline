# N182 — 新页面与新测试不能证明“最新人物”部件集合正确

- 日期：2026-10-22
- Mother：Human / NPC life observation
- 类型：制度验证 / tested-subject / stale-or-wrong-target
- Bounded question：页面、head 和浏览器 run 都是新的，并且声明使用“完整 R07”时，能否据此证明它使用了用户要求的当前总平台人物？
- 结论：不能。当前状态为 `HOLD_EXPECTED_COMPONENT_SET_UNRESOLVED`。

## 1. 现有真实失败

用户反馈当前动作网页无法正常打开，并明确指出页面拿错了人物版本：应使用总平台中已经升级的外观、头发、眉毛、眼睛和嘴部，而当前人物像旧资产。用户同时指出最新动作没有被使用；本轮只研究“人物部件集合是否正确”，不扩大到动作自然度、相机方向或阴影更新。

NPC R04 当前 head 是 `b386dd9780ddc5b01676fe46117d56d973725ac7`。它的 Task Anchor 把 “Complete original R07 people/rig/materials/weights” 作为 protected invariant，但没有列出身体、皮肤、头、毛发、眉毛、眼睛、嘴、骨架、动作的 dispatch-time expected identity。`AssetContract.cjs` 又分别固定了 R05 native packet base 与 face asset base；这可以证明字节来源，但不能证明组合后等于用户此刻所说的“最新总平台人物”。

因此这是一个合法的新页面、合法的新 head 和可能通过的浏览器 run 仍然交付 wrong target 的真实反例。它不否定 R04 已记录的命令所有权和物理验证。

## 2. 与既有制度比较

R2 Freshness Gate 已要求 reference version 必须是用户指定的当前版本；N30/N162 已区分 immutable tested subject、mutable head 和 exact active route。这里不是新老师，也不新建 regression：沿用 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001`，只追加“composite subject 必须逐部件解析”的证据。

N162 能发现“旧 route 的 run 被归给新 route”，但不能发现“exact 新 route 运行了错误的人物部件组合”。单一 `HUMAN-INTEGRATED-R07` 标签也不能替代逐部件 inventory。

## 3. 可反驳假设与最小回放

假设：若单一人物版本号足够证明当前人物，则只要页面绑定 R07，逐部件 expected/actual 是否存在或匹配都不影响判断。

7/7 分类回放反驳该假设：

- 当前 R04 无 dispatch-resolved component set：`HOLD_EXPECTED_COMPONENT_SET_UNRESOLVED`；
- aggregate-only R07：`HOLD_EXPECTED_COMPONENT_SET_INCOMPLETE`；
- runtime 缺眉毛 identity：`HOLD_ACTUAL_COMPONENT_INVENTORY_INCOMPLETE`；
- stale hair 或 stale mouth/motion：`HOLD_COMPOSITE_SUBJECT_COMPONENT_MISMATCH`；
- resolved current set 与 runtime 全部一致：`COMPOSITE_SUBJECT_VERIFIED`；
- 用户明确冻结旧 set 且完全一致：仍为 `COMPOSITE_SUBJECT_VERIFIED`。

## 4. Candidate 增量

下一次相关 Human Task Anchor 只需新增：

- `subjectSelectionPolicy = CURRENT_CANONICAL | FROZEN_ACCEPTED`；
- `subjectResolvedAtDispatch`；
- `expectedSubjectComponents`：body / skin / head / hair / eyebrows / eyes / mouth / rig / motion 的 immutable identity。

Delivery Receipt 从实际 runtime 导出同名 `actualRuntimeSubjectComponents` 并逐项比较。若“当前 canonical”还没有被 Human owner 明确解析，必须 HOLD，不得自行把最新专项分支拼成生产人物；用户明确冻结旧版本时也不得强迫升级。

## 5. 适用边界与生命周期

- 仅作为 Human 单 Mother Candidate；不修改 R2 OS，不修改生产 Mother 分支，不自动选定任何专项分支。
- component match 不能代替视觉质量、动作自然度、物理、设备、公网页面或用户验收。
- POSTED：待定向路由至 PR #329。
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：均为 false / unknown。
- KPI：分类回放 7/7；当前真实用户纠错事件 1；其余指标 unknown。
