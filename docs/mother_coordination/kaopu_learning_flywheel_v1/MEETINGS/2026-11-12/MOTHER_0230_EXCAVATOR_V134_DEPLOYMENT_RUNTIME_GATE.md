# KAOPU Mother 每日协调会 — N274 Excavator v134 deployment/runtime gate

- 日期：2026-11-12（北京时间）
- bounded task：只核新增 CAT 整机候选与 Site v134 是否已经构成“原工作台中的完整挖机可用观察版”。
- read set：`main@73452580929bc9cc37a8e57d79da69af994af808`；R2 / Reference Replication / Freshness gates；#91 N273 及 N269；#63 无新相关 receipt。
- 模式：`REPLICATION_LOCKED`；`CREATIVE_AUTHORIZATION=false`。

## 任务锚点核对

| 字段 | 核对结果 |
|---|---|
| 唯一 taskId | `UNBOUND_EXCAVATOR_CAT_WHOLE_MACHINE_RUNTIME_V134`；无生产 Task Anchor |
| targetObject | 原工程机械工作台中的完整 CAT 挖机运行时 |
| targetDefect | 新资产与静态预览存在，但 v134 部署失败、整机场景未启动、外部入口需登录 |
| accepted baseline / baseSha | `UNKNOWN`；v133/v134 Site commit 均不冒充 accepted excavator baseline |
| 用户最后约束 | 恢复正常推进；逐项保全细节；整机可见、可旋转、可选件、可调整、接回原工作台；最终交付须有外部浏览器直开链接 |
| referenceSet / UNKNOWN | `Excavator_CAT.usdz` 与五个压缩包成为候选输入；canonical whole-machine reference 与 accepted parent 仍 UNKNOWN |
| forbidden routes | 离线预览冒充运行时；局部铲斗冒充整机；保存版本冒充部署版本；v134 截图绑定 v133 URL；owner-only URL 冒充外部可达 |
| fresh head delta | v134 有新 commit，但 deployment failed；固定入口仍服务成功部署的 v133；生产 `NO_NEW_ARTIFACT` |
| applicable regression | N269 `WHOLE-MACHINE-NOT-PARTIAL-DELIVERY-001` 已执行；不新建近义 case |
| 当前状态 | `HOLD_GATE_FAIL / NO_NEW_ARTIFACT`；v134 delivery 标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY` |

## 新证据

### Site version lineage

| 版本 | commit | deployment | 结果 |
|---|---|---|---|
| v134 | `48f017f20a4ddc061345db404a86979c4bd6fb9b` | `appgdep_6af4ae82385481919850e86255f7c944` | FAIL：Cloudflare Sandbox Worker 在返回响应前失败 |
| v133 | `805a8f35f90ef97ce01d4ce0fa5ec0890d42810c` | `appgdep_6af48d2fa3a08191a1ca3235588c41b1` | SUCCEEDED：固定入口仍可指向该成功版本 |

固定入口：<https://kaopu-excavator-function-workbench.sunhaihao.chatgpt.site>

外部浏览器打开后得到 `Sign in required / Log in to access`。当前 access 为 custom/owner-only，不能满足用户“外部浏览器直接打开”的交付门。

### 资产与截图

- `Excavator_CAT.usdz`：SHA-256 `1b251caf6b331e574895072e93f09ebb8cec55c7adbd2e75174fa2aec85c52cc`；包含 `scene.usdc` 与 38 个纹理。
- 五个压缩包均可读出 glTF/来源/许可，其中 CC-BY-4.0 与 CC-BY-NC-4.0 混合；尚未选择 canonical referenceSet。
- `IMG_8625` 与 `IMG_8627` 显示完整 CAT 挖机，但同时显示“三维场景未完成启动/模型解码读取失败”或 7% 重载。
- `IMG_8629` 只证明“只看这只铲斗”的局部观察，不证明整机。
- 因此静态/离线预览、HTTP 页面或局部观察均不能证明 whole-machine runtime。

## Gate 结果

| Gate | 结果 |
|---|---|
| Contract | FAIL：无唯一生产 Task Anchor / Delivery Receipt |
| Freshness | FAIL at deployed head：v134 保存 commit 未成功部署，live head 未前进 |
| Reference Fidelity | FAIL：canonical whole-machine reference、accepted parent/baseSha 未绑定 |
| Machine | FAIL：截图记录 decode/startup failure；无 exact version runtime readiness receipt |
| Browser | FAIL：v134 无成功 production URL；固定入口需登录；无同版本桌面 + 390×844 交互证据 |

命中 N269：`HOLD_STATIC_NOT_INTERACTIVE`、`HOLD_ORIGINAL_WORKBENCH_NOT_PUBLISHED`、`HOLD_WHOLE_MACHINE_CAPABILITY_MISSING`。

## 明确决定与有限方法

**决定：只允许一个 deployment-and-runtime recovery slice。** 不继续围绕失败截图微调，不把 v133 重新发布或 v134 保存记录当作新生产。

责任端：
- Excavator Mother：绑定 canonical asset / accepted parent，并修复 live decode/render 与整机交互；
- Site publisher：让 exact version 成功部署并让固定 URL 实际服务该 commit；
- independent verifier：执行 Machine/Browser gate。

最小验证：
1. Task Anchor 绑定唯一 taskId、canonical asset digest、来源/许可、accepted parent、exact Site commit/version；
2. exact version deployment 为 `succeeded`，固定入口实际服务同一 commit；
3. 原工作台完整挖机 live decode/render，实测旋转、选件、调整；无离线预览或未启动 modal；
4. 同一 URL/版本提供桌面与 390×844 浏览器证据，未登录外部浏览器可直开；390×844 只标 viewport；
5. Delivery Receipt 写明 package/runtime/browser/device/user 分层状态与 known limitations。

## 未完成边界

不声称 v134 已部署、完整挖机可用、固定入口已外部可达、canonical referenceSet 已确定、accepted baseline 已建立，或用户已接受。新增资产只是候选输入。本轮未改 Mother 生产分支、站点、access、baseline、main 或 R2。

## 学习飞轮继续研究

如何把 Site 保存版本、部署状态、固定 URL 实际服务 commit、模型 decode/render readiness 与旋转/选件/调整三类交互，压缩成一个可机器复核的 `WholeMachineRuntimeDeliveryReceipt`，从结构上阻止“保存成功/截图存在/HTTP 可达”冒充整机可用？

生命周期：协调记录 `POSTED=true / IMPLEMENTED=true / GATE-RUN=true`（[#91 comment 6804123431](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6804123431)）；生产 `ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED=false`。
