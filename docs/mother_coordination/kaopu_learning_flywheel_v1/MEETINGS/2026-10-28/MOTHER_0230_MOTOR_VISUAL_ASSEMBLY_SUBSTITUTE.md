# KAOPU Mother 每日协调会：Motor 视觉装配替代复发

- **记录 ID**：KAOPU-MOTHER-20261028-MOTOR-ASSEMBLY-SUBSTITUTE-R1
- **实际开始**：2026-10-28 02:31:25 +08:00
- **实际结束**：2026-10-28 02:32:59 +08:00
- **范围**：只处理 Motor R02 对“显式铰链与父子装配图”根因整改的响应
- **实际参与**：小妈主持核查；未取得 Motor Mother 本轮 ACKNOWLEDGED 或回复
- **生产修改**：无
- **协议**：R2 Production OS、Reference Replication Gate、Freshness Gate 均作为强制门禁

## 会前事实

当前 main 为 `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`，新增且仅新增：

`kaopu-motor-mother/experiments/motor-mother-assembly-film-r02/index.html`

该提交相对 Motor 动画 R01 基线 `47d416556dc6bcb4bac4078a9c81bd64faa8f70a` 是 fresh head delta，因此不属于 stale delivery。未找到绑定此提交的新 workflow/status、正式 Task Anchor 或 Delivery Receipt。

#91 N196（comment 6425719357）给出 Teacher Candidate：关节应记录 `body0/body1 + localPos0/localRot0 + localPos1/localRot1`，并验证

`world(body0) * jointFrame0 == world(body1) * jointFrame1`

#91 N198（comment 6433241662）对 R02 直接复算确认：

- 门仍为 `T(center) * RY(angle) * S`，65° 时固定铰边漂移 0.752219452，失败；
- 窗随门继承通过，但不能补偿铰边漂移；
- 文件中没有 `jointFrame`、`localPos0`、`localPos1`、`parentAssembly`、`parentId` 或 `hingeLocal`；
- 所谓装配时间轴是扁平 `assemblyObjects[] + stage`，绘制时仅叠加 stage offset，属于视觉时序，不是因果装配图；
- N196 的 Teacher Candidate 尚未实现。

## 九项核对

| 项 | 当前记录 |
|---|---|
| taskId / targetObject / targetDefect | `MOTOR-ARTICULATED-CHILD-TRANSFORM-001` / 车门与侧窗装配 / 门绕中心旋转、缺显式关节坐标和父子图 |
| accepted baseline / baseSha | 用户接受基线：UNKNOWN；技术比较基线：动画 R01 `47d416556dc6bcb4bac4078a9c81bd64faa8f70a` |
| 用户最后约束 | 根因审查后不得继续凭感觉微调；交互工作台最终须有可外部打开的固定网页并核验版本、内容和主要交互 |
| referenceSet / UNKNOWN | 真实车型参考未绑定：UNKNOWN；当前只核对机制语义 |
| forbidden routes | 视觉分阶段位移、标签“铰链/装配”、页面存在或动画会动，均不得替代显式装配图与数值闭合 |
| fresh head delta | 有：main `3ccae4b...`，R02 HTML blob `dc353428...` |
| regression cases | N198 已执行 `MOTOR-ARTICULATED-CHILD-TRANSFORM-001`；中心枢轴反例失败 |
| machine/reference/browser gates | commit-bound workflow 无；真实参考门禁无；桌面、390×844、固定 HTTPS 均无 |
| 当前状态 | `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / REJECTED_CREATIVE_SUBSTITUTE` |

## 决定

**R02 作为本 bounded task 的修复响应被拒绝。** 它可以保留为隔离的视觉装配时间轴实验，但不能继续作为车门铰链或装配机制候选，也不能在这一表示上继续做 R03 细节微调。

拒绝原因不是它没有新增代码，而是它用视觉分阶段位移替代了已明确要求的关节与父子装配语义，复发既有 regression case。回到最后有证据的动作基线：保留 R01 已证明的侧窗随门继承，重建门—窗的显式装配图。

## 责任端与最小验证

- **责任端**：Motor Mother / 当前 Motor 执行线。
- **最小实现**：
  1. 门体和车身各存一侧局部关节框；轴和限位独立；
  2. 门和侧窗进入同一父子装配图；
  3. 装配时间轴读取该图，不再读取独立 stage 列表；
  4. Delivery Receipt 绑定 base/head SHA、输入、已知限制和新 run。
- **最小验证**：
  - 角度 0° / 15° / 35° / 65°；
  - 两侧关节世界变换在声明 epsilon 内闭合；
  - 侧窗相对门的局部变换不变；
  - 中心枢轴作为负对照必须失败；
  - 新 run 绑定准确 commit；之后才做桌面与 390×844 视口、固定 HTTPS 页面核验。

## 状态账

- **POSTED**：R02 main 提交、N196 教师候选、N198 复算证据存在。
- **ACKNOWLEDGED**：无本轮 Motor Mother 回执。
- **IMPLEMENTED**：R02 视觉时间轴已实现；显式双局部关节框与装配图未实现。
- **GATE-RUN**：N198 源码/数值回归已运行；机器、参考、浏览器和公网门禁未运行。
- **ADOPTED**：无。
- **USER-ACCEPTED**：无。

## 未完成边界

没有用户接受的车门几何或机制基线；没有正式 Task Anchor、Delivery Receipt、真实车型 referenceSet、commit-bound CI、桌面/390×844 证据或固定公网交付。故本轮不宣称交付完成。

## 学习飞轮接续题

怎样用最小、可跨模块复用的合同区分“视觉装配时序”和“因果运动学装配”，并同时覆盖车门、飞机舵面、建筑门/电梯门、NPC 手持物，而不引入庞大新格式？

建议从三条可判定条件开始：双侧局部关节框闭合、父子局部变换不变量、时间轴必须由同一装配图派生。需要下一轮研究其对多轴关节、可拆卸连接和拓扑切换的失败条件。

## 固定证据

- main R02：<https://github.com/haihao0307/guilin-dem-pipeline/commit/3ccae4bde0c91973adbb81f99ec4d54bc9357ce0>
- N196 Teacher Candidate：<https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6425719357>
- N198 R02 复算：<https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6433241662>
- 适用 regression case：`MOTOR-ARTICULATED-CHILD-TRANSFORM-001`
