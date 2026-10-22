# KAOPU Mother 每日协调会有限纪要：人物—动作—阴影复合主体门禁

- 编号：`KAOPU-MOTHER-20261023-COMPOSITE-ACTOR-MOTION-SHADOW`
- 实际时间：2026-10-23 02:33:34–02:35:45（北京时间，UTC+8；2分11秒）
- 主持：小妈
- 实际 Mother 参与：0（本轮无新 ACK 或回复）
- 责任端：Game / NPC integration line，当前可寻址入口为 PR #329
- 生产修改：无
- 模式：`REPLICATION_LOCKED` / `CREATIVE_AUTHORIZATION=false`

## 只处理的最高价值问题

用户指出同一动作演示同时出现：人物不是总平台当前目标人物、动作不是当前目标动作体系、人物移动后阴影仍停在旧位置。这不是三个独立的审美问题，而是**复合运行主体没有被同一任务锚点和同一完成帧约束**。

## 核对到的事实

1. main 仍为 `5543f756ca3af1428323696324303fa70b8de850`。
2. #334 head `8b6878225db2b9c436c68114c9f855d1584f5a19` 确实是 dispatch 后的新独立研究增量，但它明确锁定 R07、六段 JST-2 公开片段，只证明回放/重定向；没有足底锁定、接触、碰撞、状态机或过渡，因此不能作为用户当前“最新人物 + 新动作生成/适应”的交付。
3. #329 head `b386dd9780ddc5b01676fe46117d56d973725ac7` 的 workflow run 39753300159 已 completed/success；该成功证明其既定 R04 scoped gates，不证明逐部件组合等于用户当前目标人物，也不证明可见阴影与人物同帧。
4. N182 已把旧人物部件组合归入既有 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001` 的 composite-subject evidence；N183 已提出 `HUMAN_SHADOW_TEMPORAL_COHERENCE_001` Candidate。两项在 #329 均仅 `POSTED`，没有 `ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED`。
5. #334 的 `SOURCE_LOCK.json` 能证明所用 R07 与贴图字节来源，但不能证明这些部件是用户当前目标；其 QA 的骨长/有限矩阵通过也不能否定全身协调僵硬、关节限制不当或人动影不动。

## 明确决定 / 有限方法

下一次声称“最新人物动作”的 Game/NPC 候选必须把**复合运行主体**作为一个不可拆开的验证对象：

- `expectedSubjectComponents`：body、skin、head、hair、eyebrows、eyes、mouth、rig、motion/controller 的用户已接受或证据化 immutable refs；
- `actualRuntimeSubjectComponents`：页面实际载入的同名部件 digest；
- `derivedSceneState`：caster identity、actor pose revision、shadow observation revision、completed frame token。

放行条件是前两项 exact match，且阴影观测与人物姿态绑定同一 completed frame。未解析的 expected component 只能为 `UNKNOWN/HOLD`；不得自行把“最近的专项分支”拼成最新人物。

因此：

- #334 保留为历史研究 baseline，不删除、不继续润色成当前产品；
- 当前 R04 成功 run 保留其原 scoped 意义；
- 面向用户当前目标的 successor candidate 状态为  
  `HOLD_GATE_FAIL / REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`，
  直至复合主体与同帧阴影门禁通过。

## 最小验证

在一个固定 camera / light / receiver 的小场景中：

1. 冻结一套已解析的 `expectedSubjectComponents`，页面导出实际组件 digest 并逐项 exact match；
2. 用同一 controller 执行一个含位移和全身转向的短动作，记录关节限位、脚滑/接触、躯干—骨盆—四肢参与；骨长通过不能替代这些检查；
3. 取两个已知位移后的 completed frames，记录 actor root / pose revision 与 shadow mask / centroid / caster identity；
4. 加入“冻结 shadow map 或静态代理”的负控制，门禁必须失败；
5. 证据必须绑定同一 source head，并完成固定公网 HTTPS 的桌面与 390×844 浏览器检查；390×844 只称视口，不称实机。

## 未完成边界

- 用户当前接受的逐部件人物集合尚未解析为 immutable refs；
- 用户看到的具体失败页面身份仍未得到执行端确认；
- 没有 Game/NPC Mother 新回执，没有新实现或新门禁运行；
- 未证明动作自然度、物理准确性、手机实机或用户接受。

## 学习飞轮下一问题

`derivedSceneState`（阴影、附件、接触代理等）应当在什么条件下进入复合主体合同，而不是只作为渲染副作用？需要找出既能阻止“主体已更新、派生状态仍旧”的最小通用字段，又不把每个 renderer 的内部对象结构冻结为跨模块架构。

## 生命周期

- R2 / Freshness / Reference Fidelity 核对：完成
- 本纪要：`POSTED`
- 对应 Mother：未 ACK
- 实现 / Gate-run / Adopted / User-accepted：均无
- main、生产分支、固定成果、排程、学习飞轮：未修改
