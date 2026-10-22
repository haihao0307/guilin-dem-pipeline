# N183 — 人物移动与阴影必须在同一完成帧内建立因果绑定

- 日期：2026-10-22
- Mother：Human / NPC life observation
- 类型：制度验证 / rendering V&V / regression candidate
- Bounded question：`castShadow=true`、GPU frame fence 与整套浏览器验收均通过，能否证明人物移动后阴影也来自同一人物、同一姿态和同一完成帧？
- 结论：不能。当前状态为 `HOLD_SHADOW_OBSERVATION_MISSING`；用户报告的“人物移动、影子仍在原地”仍未被现有验收覆盖。

## 1. 现有真实失败与本轮证据

用户明确反馈：人物移动后，影子仍停留在旧位置。本轮不研究人物版本、动作自然度、相机方向或网页可达性。

R04 当前 head `b386dd9780ddc5b01676fe46117d56d973725ac7` 的 workflow run `39753300159` 已于 2026-10-22 成功完成；artifact `12416570595` 的 `01-panorama`、`identity-plan`、`A-continuous-pick-place-completed` 和 `suite-final` 均有 exact-frame receipt。然而：

- `ActorAdapter.mjs` 只把人物 mesh 的 `castShadow` / `receiveShadow` 置为 true；
- `Workbench.mjs` 未给地面、桌面或其他明确 receiver 建立可验证的 shadow receipt；
- `NativeBootRenderer.cjs` 的 frame fence 证明 GPU 帧完成，不证明阴影由正确人物、正确姿态生成；
- 上述四张真实截图中没有可辨识的人物投影，也没有 shadow mask / centroid / caster identity / pose revision；frame JSON 也无 shadow 字段。

因此这轮成功只证明“渲染与交互流程完成”，不能反驳用户的 stale-shadow 反馈；也不能据此断言根因是 shadow map 未刷新、静态 blob、旧宿主残留或其他合成层。

## 2. 与既有制度比较

R2 OS 与 Freshness Gate 防止旧任务/旧页面冒充新结果；N144 的 shadow-terminator 候选研究静态几何、法线与低模阴影边界。它们都没有要求把 `actorPoseRevision`、`casterIdentity`、`shadowObservationFrame` 与同一 completed frame 绑定。本轮因此不是重复 N144。

`castShadow=true` 是配置证据；frame fence 是执行完成证据；截图是结果证据。三者必须在同一受控试验中闭环，任一单独存在都不能证明人物—阴影时序一致。

## 3. 可反驳假设与最小回放

假设：只要人物开启 `castShadow` 且 GPU 帧完成，阴影必然与人物同步。

8/8 分类回放反驳该假设：

- 只有 cast/receive flags：`HOLD_SHADOW_OBSERVATION_MISSING`；
- 有截图但 receiver 上没有可观测阴影：`HOLD_SHADOW_OBSERVATION_MISSING`；
- actor 与 shadow 来自不同 completed frame：`HOLD_FRAME_BINDING_MISSING`；
- 两帧间 camera 或 light 变化：`HOLD_PROJECTION_CONTROL_MISSING`；
- actor 移动而 shadow centroid 不动：`REJECT_STALE_SHADOW`；
- shadow 移动但 caster identity 属于旧宿主/代理：`REJECT_CASTER_IDENTITY_MISMATCH`；
- 静态 blob 被当作动态投影：`REJECT_STATIC_SHADOW_SUBSTITUTE`；
- 固定 camera/light/receiver 下，actor 与其 shadow 在同一帧成对更新且投影位移误差在阈值内：`SHADOW_TEMPORAL_COHERENCE_VERIFIED`。

## 4. Candidate 增量

下一次相关 Human Task Anchor 可局部新增：

- `shadowCasterSubjectIdentity`；
- `shadowReceiverIdentity`；
- `shadowProjectionControls`：camera / light / receiver immutable identities；
- `shadowTemporalTolerance`：允许的 frame lag 与屏幕空间投影误差。

Delivery Receipt 从真实 runtime 导出两组同构样本：`actorPoseRevision`、`actorScreenAnchor`、`casterIdentity`、`shadowMaskOrCentroid`、`shadowObservationFrame`、`completedFrameId`。控制 camera/light/receiver 不变，施加已知 actor 位移；若阴影不可观测或身份/帧不一致必须 HOLD/REJECT，不得用 renderer 成功、配置 flag 或普通截图替代。

最小可反驳试验只需一个人物、一个定向光、一个 receiver、两个完成帧和一个负控制（冻结 shadow map 或替换为静态代理）。先要求负控制必失败，再允许正例通过。

## 5. 适用边界与状态

- 仅作为 Human 单 Mother Candidate；不修改 R2 OS，不修改生产 Mother 分支，不代替 Mother 实现修复。
- 只验证人物—阴影的时序/身份一致性，不验证阴影美术质量、软硬度、shadow terminator、动作自然度或最终用户接受。
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/329#issuecomment-6344941284
- ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED：均为 false / unknown。
- KPI：分类回放 8/8；当前真实用户纠错事件 1；其余指标 unknown。

