# KAOPU Mother 每日协调会｜最新帧失败时的新请求不得丢失

- 日期：2026-11-08（北京时间）
- 实际会议：2026-11-08 02:30—02:35 +0800
- 会议边界：只处理一个跨模块问题；未修改 KaoPu Engine、任何生产 Mother 分支、main、播放器、托管、排程或学习飞轮
- 强制协议：R2 `LOCK → EXECUTE → VERIFY → PROMOTE`

## 本轮唯一问题

KaoPu Engine 的“只保留一个正在执行的帧和一个最新等待请求”方法，是否已被新的独立复核证明到可以向其他 Mother 推广？

## 会前读取与权威状态

- 协调仓库 `main@34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 根 `AGENTS.md` blob `251b664646a489e9292748f1d41998ee62a338f5`
- R2 Production OS blob `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- Reference Replication Gate blob `8c0a49c71865ef76cbc614f8188239bc808a8278`
- Freshness Gate blob `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 最新仍为 N248 的 Acorn bounded teacher audition；没有 KaoPu Engine / AC Mother 的 `ACKNOWLEDGED / ADOPTED`
- #63 最新仍为 N49 Coast 公网运行失败记录；没有本问题的新 Mother 回执
- 新方法输入：`kaopu-player-guiding-principles-2026-11-07.md`
- 新独立复核包：`KaoPu_Engine_独立复核证据_af1ffb7.zip`
  - archive SHA-256 `4c3036c964bcd9516e867de33155bce83c67c1b4551b0a436cb68ebc9d50ae9e`
  - 精确绑定 `haihao0307/KaoPu-Engine@af1ffb7516de642c17ac61f33b9104482394073a`
  - 当前 KaoPu Engine `main` 仍为同一 commit，不是旧 head 冒充
  - `core/LatestFrameScheduler.mjs` blob `5f899bfc50c7bb454bca792fbd4783144b4aafb2`

## R2 九项核对

1. **唯一 taskId / targetObject / targetDefect**  
   没有绑定本复核的 R2 Task Anchor，`taskId=UNKNOWN`。本轮只锁定 `LatestFrameScheduler`；缺陷是“在 revision 1 绘制进行中到达 revision 2，revision 1 随后失败时，revision 2 也被静默清空”。

2. **accepted baseline / baseSha**  
   没有 Delivery Receipt 声明 accepted baseline。可验证 subject head 是 `af1ffb7516de642c17ac61f33b9104482394073a`；这是被审代码身份，不等于用户接受基线。

3. **用户最后约束**  
   玩家方法必须保持原函数、原对象身份、当前画面贡献与最新请求；不能用测试数量替代完整链正确性；验证证据必须绑定准确 commit；跨 Mother 交流只有在接收端实际回执和本地验证后才算采用。

4. **referenceSet 与 UNKNOWN**  
   方法参考是播放器指导原则、固定 source blob 与仓库中“一个运行中、一个最新等待请求”的明确合同。真实浏览器、WebGPU、设备丢失、完整播放器、2K 画面、FPS 和最终图像仍为 UNKNOWN。

5. **forbidden routes**  
   不得把“11/11 PASS”“可以手工重新 request”或一次干净重启冒充“失败期间已经等待的最新 request 被保存”；不得把 CPU 合成回调冒充真实 GPU；不得把当前验证直接推广为各 Mother 已采用。

6. **fresh head delta**  
   这是 validation-only，没有生产 source diff。独立包三个 source blob 均与 subject commit 一致；本轮在 Node `v24.22.1` 重新执行，原 11 项仍为 `11/11 PASS`。另新增一个 dispatch 后反例运行，精确绑定同一 scheduler blob。

7. **applicable regression cases**  
   既有诊断 fail-closed 案例关注“失败后继续收集安全证据”，不覆盖“更新 revision 在旧 revision 失败时被一起删除”。本轮建立去重候选：
   `CANDIDATE_LATEST_PENDING_REQUEST_SURVIVES_INFLIGHT_FAILURE_001.json`。仅为 `POSTED + GATE-RUN`，未实施、未采用。

8. **machine / reference / browser gates**
   - Contract：没有 Task Anchor / Receipt；失败作用域和 newer revision 处置没有显式合同，未通过。
   - Freshness：独立包、source blob、subject commit 与当前 Engine head 一致，通过身份核对。
   - Machine：原 11 项重跑通过；新增 interleaving 反例稳定复现失败。
   - Reference Fidelity：本任务是调度语义验证，不是视觉复刻；视觉门不适用。
   - Browser / GPU：未运行，不能由 CPU module gate 代替。

9. **状态**  
   `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / HOLD_LATEST_PENDING_REQUEST_DROPPED_ON_INFLIGHT_FAILURE`。  
   不标 `REJECTED_CREATIVE_SUBSTITUTE`；不标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`；不得晋级 `CANDIDATE_READY`。

## 新反例

确定性交错：

1. revision 1 开始 `draw()`，保持 in-flight；
2. revision 2 到达并成为 `pending`；
3. 强制 revision 1 抛错；
4. 当前 catch 执行 `this.pending=null`，并拒绝全部 waiters。

实际结果：

- requested revisions：`[1, 2]`
- draw calls：`[1]`
- 两个 waiter 都得到 `forced-first-draw-failure`
- 最终 `requested=2, completed=0, pending=0, frames=0`

因此原独立测试“错误释放 waiter、之后可以重新启动”只证明新的第三次请求可运行，不能证明失败发生时已经等待的 revision 2 被保存。

## 明确决定 / 有限方法

停止把当前 11 项独立测试当作最新帧方法的完整生产证明。KaoPu Engine / Player scheduler owner 在同一个 bounded task 内只选择以下一种明确语义：

1. **保留并继续最新 revision**：失败只结算 `revision <= failedRevision` 的 waiter；若 `pending.revision > failedRevision`，保留 pending 与对应 waiter，并在资源仍有效时立即重新调度。
2. **资源世代已失效时 fail-closed**：返回带 `revision / resourceEpoch / RETRY_REQUIRED` 的显式结果，由 dispatcher 证明重新发出同一最新意图；不得只用旧 draw 的异常吞掉 newer revision 身份。

二者都必须让调用端知道 revision 2 的归宿。是否自动重试取决于失败是否污染 GPU / 资源世代，不能用一个无差别 catch 同时决定。

## 最小验证

在修正 commit 上新增一个确定性测试：`r1 in-flight → r2 pending → r1 reject`，并断言：

- r2 被实际评估，或得到 revision-bound `RETRY_REQUIRED` 后被证明重新发出；
- r1 的错误不会无差别结算 r2；
- stale completion 不能覆盖更新 revision；
- 测试报告绑定 corrected commit、scheduler blob、Node 版本与完整输出。

通过该 module test 后，再由 AC 作为首个接收端做一次真实浏览器 / WebGPU 设备失败或等价可控故障试验；其他 Mother 暂不推广。

## 责任端、未完成边界与下一学习题

- 责任端：KaoPu Engine / Player scheduler owner；AC Mother 只负责后续首个真实接收试验，不能自我批准。
- 未完成边界：Task Anchor、Delivery Receipt、accepted baseline、修正实现、真实 GPU / browser、2K、最终图像、FPS、桌面与 390×844、用户验收均未完成。
- 学习飞轮下一题：怎样用 `requestRevision × resourceEpoch × failureScope` 区分“旧帧失败”“设备世代失效”和“最新意图仍有效”，同时防止自动重试形成无限循环或重复提交。

## 生命周期账

- `POSTED=true`（协调纪要与候选 regression case）
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`（现有 scheduler）；`correction IMPLEMENTED=false`
- `GATE-RUN=true`（11 项重放 + 1 个新增失败交错）
- `ADOPTED=false`
- `USER-ACCEPTED=false`

没有真实 Mother 回执，不声称 KaoPu Engine、AC 或其他 Mother 已学会、采用或完成。
