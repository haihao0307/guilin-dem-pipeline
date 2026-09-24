# KAOPU Mother 每日协调会有限纪要｜巡逻艇 R2 门禁

- 日期：2026-09-25（北京时间）
- 实际会前核查：02:29:44
- 实际协调：02:31:26–02:33:36
- 实际 Mother 新回执：0
- 唯一问题：日军巡逻艇在用户明确否定“卡通/通用重画”后，当前任务锚点、生产来源和公开候选没有形成同一条可审计链
- main 核查头：`9691221d473278c05a1502e6265c4770a86e8b96`
- 协调分支写前头：`6e6f86774e8986fbd94517c08f65b748c3e23b5b`

## 明确决定

当前巡逻艇状态定为：

`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / REJECTED_CREATIVE_SUBSTITUTE`

停止围绕 R012 或任何已被用户判为卡通、通用化、错误对象的可见结果继续做材质、光照和细节微调。回到用户允许的参考输入与尺寸约束，先重新锁定一个“参考—船体大形”单元；没有通过 Reference Fidelity 前，不进入发动机、船员、武器、旧化或游戏行为。

这不是恢复旧 R04–R07、B01–B12、R001、R002、R4、R005，也不恢复已按用户指令删除的旧 Boat regression JSON。旧生产物仍是禁止输入。

## R2 核查

### 当前唯一任务

- taskId：现有 Issue #152 没有 R2 taskId；必须补齐，当前为 UNKNOWN。
- targetObject：Survival Palau 的日军小型木制巡逻艇。
- targetDefect：首看形态呈卡通/通用重画，参考忠实度不成立；同时候选发布链未绑定一个可核验的生产 head。
- accepted baseline：没有用户接受的生产几何；只有用户允许的参考输入、尺寸与对话权威可以作为知识/约束基线。
- baseSha：`9691221d473278c05a1502e6265c4770a86e8b96`。
- execution branch：`work/patrol-boat-reference-first-r1-20260924` 当前仍停在 `5476998fed18917ccf6f29e3fdf4fe9c781f077a`，相对 base 只新增执行令，没有生产候选。
- public candidate：gh-pages 有 R012/R012G，但 receipt 没有 baseSha/headSha、changed production files、reference identity/hash、Reference Fidelity 结果或固定视图截图；因此不能和上述执行 branch 构成同一条 fresh-head 交付链。
- referenceSet：Issue #152 后续纠正允许 `friday_the_13th_sit_boat_idle.zip`、既有巡逻艇截图、既有 game-boat reference；这些输入的字节、SHA-256、支持视角和 UNKNOWN 尚未在当前 receipt 中登记。
- forbidden routes：generic/stock/toy/cartoon/similar-looking substitute；旧被删生产物；以纹理和旧化遮盖错误大形；用公开页面或测试成功替代参考忠实度；从旧污染分支取几何。
- fresh head delta：执行分支无 artifact delta；公开 R012 的来源 head 未被 receipt 绑定。
- applicable regression：旧 `BOAT-NO-GENERIC-REDRAW-001` 曾存在，但于用户删除旧线时被明确删除，不能恢复为生产输入。其“禁止通用重画”的约束已由用户权威主档、Issue #152 和本轮新纠正继续生效；是否建立不含旧资产的新线 regression case，留给学习飞轮研究。
- gates：公开 receipt 声称 desktop 与 390×844 QA 通过；Contract、Freshness、Reference Fidelity 均未形成同一 head 的完整证据。Machine/browser pass 不能提升为用户视觉通过。
- 当前状态：`HOLD_GATE_FAIL`，不是 `CANDIDATE_READY`。

## 责任端

责任端：Game Mother / Boat execution line。

小妈只负责把当前冲突收束成一个新的 bounded Task Anchor；执行端只做该 Anchor 的船体大形候选。没有真实接收证据，因此本轮不记 ACKNOWLEDGED。

## 最小验证

下一有效验证只检查一件事：候选是否在 side / top / bow / stern / three-quarter 五个固定视角中，首看就是用户允许参考中的同一艘船体。

必须同时具备：

1. 输入文件名、bytes、SHA-256、支持视角和 UNKNOWN；
2. 唯一 taskId、baseSha、headSha、changed production files；
3. reference 与 candidate 同屏、同尺度、尽量匹配相机；
4. neutral material，不能靠旧化遮形；
5. 当前 head 的 standalone `file://`、固定 HTTPS、desktop 与 390×844；
6. Contract / Freshness / Reference Fidelity / Machine 四门分开记录；
7. `USER_VISUAL_ACCEPTANCE=false` 直至用户明确接受。

## 状态账

- POSTED：Issue #152 执行令与后续纠正已存在。
- ACKNOWLEDGED：无可核实的新 Mother 回执。
- IMPLEMENTED：R012/R012G 公网页面存在，但与唯一执行分支不构成同一可追溯生产链。
- GATE-RUN：公开 receipt 记录 browser/machine QA；Reference Fidelity 与 Freshness 不通过。
- ADOPTED：无。
- USER-ACCEPTED：否；用户已明确否定当前视觉结果。

## 未完成边界

本轮未创建或修改生产分支、未重建船体、未恢复旧资产、未替 Mother 声称采用。参考字节身份、真实生产 head、参考忠实度、用户视觉接受均未完成。

## 学习飞轮问题

当用户要求整条旧生产线删除、但“同类错误不得复发”仍应保留时，怎样建立一个只继承用户纠正语义、不继承任何旧资产/旧测量/旧推断的新 regression case，并强制 Delivery Receipt 在发布前绑定 source identity、production head 与 public bytes？

## 证据

- main 用户权威主档：`ops/user_authority/patrol_boat/PATROL_BOAT_USER_RECORD_ONLY_20260923.md`
- main 公开预览纠错：`ops/mother_execution/patrol_boat_restart_20260923/MOTHER_CORRECTION_PUBLIC_PREVIEW_RULE.md`
- Issue #152：Patrol Boat Restart R1
- execution order commit：`5476998fed18917ccf6f29e3fdf4fe9c781f077a`
- R012G receipt：`gh-pages:patrol-boat/r012/receipt.json`
- 旧 regression 创建：`411af6bc783c22a349312c6b8f829126a890a981`
- 旧 regression 删除：`661f1b3282a0bc5f4cd9af21fd909496a9d75c07`

未改生产、冻结成果、排程或学习飞轮。
