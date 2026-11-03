# KAOPU Mother 协调会｜A4 Player R05 运行命令绑定闭包

- 会议编号：`KAOPU-MOTHER-20261104-A4-PLAYER-COMMAND-CLOSURE-001`
- 实际核查开始：2026-11-04 02:31:49 +08:00
- 实际核查结束：2026-11-04 02:35:19 +08:00（3 分 30 秒）
- 协调分支读取基线：`1fac83104f00865319ce8eb32a62e85e918ec1dd`
- main：`34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 强制协议 blobs：AGENTS `251b6646…338f5`；R2 `d942d44b…b2bf`；Reference gate `8c0a49c7…8278`；Freshness gate `4754a90a…9021`
- 范围：一个最高价值问题——Player R05 是否在 GPU 命令产生前消费实际导入模块的精确身份
- 参与：小妈主持并 fresh replay 私有包；未取得本轮 Train/A4 Mother 回复。#91 N239 是学习飞轮的 `POSTED` 证据，不冒充 Mother ACKNOWLEDGED。

## 会前状态

#91 最新实质回流为 N239：A4 Player R05 运行命令绑定身份缺口；#63 仍停在 Coast N49，无新生产回流。main 未产生新的 Train/A4 提交。

另有 `A4_188_193_SOURCE_METADATA_ONLY.zip`（Library `libfile_ad64f7e406fc8191acd90ed57539e5f7`，SHA-256 `b5be7a4b741e387358101782e1bbea5a966a3e0f3a40812f6f394bff7897fd26`）。其自述明确为 source/metadata safety copy、不是完整可执行恢复，故本轮记 `NO_NEW_ARTIFACT`，不作为生产候选。

## 精确对象与 fresh replay

- Library：`libfile_876998c223c88191891e685bf5663a77`
- 文件：`A4_ORIGINAL_ROUND_HOUSINGS_ANGLED_WINDOWS_PLAYER_R05.zip`
- ZIP SHA-256：`a418e3137d3f737e8808b7b9920cbf2598401701ac9daf3cb75279441c7e15f6`
- targetObject：`unified-player-admission-r01/native-ortho-r05` 中 Player→`NativeTrainBackend.mjs`→`native/angled-cab-windows-pass.mjs` 的命令绑定链
- targetDefect：验证过的 pass plan 在转成 GPU uniforms 时，运行适配模块身份没有在导入/使用前 fail-closed；被替换的适配器可改变 `uSide`，而 count-only mock-GL gates 仍绿
- 本轮 fresh extraction：`new-admission.test.mjs` PASS；`player-protocol.test.mjs` PASS
- 精确模块：
  - `NativeTrainBackend.mjs` SHA-256 `768267df357e6641d76fcbae4ecea1d72505675b4a9b588fba1bbe90bbb2669f`
  - `native/angled-cab-windows-pass.mjs` SHA-256 `6cdacdfa4b89cbb318625fdab152ff6562dc4921188e1a176584794db5d6b5aa`

`FREEZE.json` 确实列出以上模块；但两项 packaged gate 都未读取该 freeze，并通过静态 import 在任何独立 preflight 之前装载 backend。N239 的隔离负控将 import 重定向到一个包装器：保留原 validator/setter，只反转送入 `uSide` 的值。结果两个 packaged gates 仍 PASS、filter 57 仍是 66 draws，而首八个 `uSide` 从八个 `1` 变成八个 `-1`。这证明门禁未覆盖最后命令绑定，不证明原始 R05 归档像素已经错误。

## R2 九项账

| R2 项 | 本轮观察 | 判定 |
|---|---|---|
| taskId / targetObject / targetDefect | 包内无 R2 taskId/targetObject/targetDefect；本纪要仅限定 Player R05 命令绑定链 | CONTRACT HOLD |
| accepted baseline / baseSha | 无用户 accepted baseline、Git baseSha 或生产 head；main 无 Train 新提交 | UNKNOWN / HOLD |
| 用户最后约束 | 复刻默认锁定；函数几何与运行证据分账；公网、桌面、390×844 分别验收 | 未由正式 Anchor 绑定 |
| referenceSet / UNKNOWN | 精确 ZIP、FREEZE、GEOMETRY_LOCK、两个模块 hash、命令 trace、N239 负控；机械用途、最终外观、浏览器与用户 GPU 均 UNKNOWN | BOUNDED |
| forbidden routes | 禁止 preflight 前静态导入未验模块、未消费的 hash-shaped metadata、只看 draw count/mock GL、用更多家族掩盖闭包缺口 | 当前违反第一、二项 |
| fresh head delta | 新私有 R05 包与 N239 probe 可核；main/生产 head 无 delta | PRIVATE FRESH / HEAD NONE |
| regression cases | 适用 `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`；N239 已加入同案，本轮 fresh replay 正控；不建重复 case | RECUR / GATE-RUN |
| machine / reference / browser | Node gates PASS；历史实际 EGL 证据保留；生产模块身份门 FAIL；browser/桌面/390×844 未运行 | HOLD |
| 状态 | 相同资源闭包 blocker 已跨 Vehicle/A6/A4 多次出现 | `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW` |

## 明确决定

保留 R05 的原始几何、187 programs、3293 analytic passes、正交相机、现有 shader/pass/material/canonical hashes、局部 Node 与实际 EGL 证据；不标 `REJECTED_CREATIVE_SUBSTITUTE`，也不推断 pristine archive 已产生错误像素。

Player R05 不得晋级 `CANDIDATE_READY`。Train/A4 display integrator 在同一路径闭合前，暂停把新增家族数量、截图、draw count 或另一套离线像素证据作为该 Player 的生产准入证明。

## 责任端与最小验证

责任端：Train/A4 Player display integrator；独立 verifier 只验证，不改形体或材质。

最小验证：

1. 用一个 package-local preflight 读取并验证 `FREEZE.json`，通过校验后再 dynamic-import Player backend 和全部 command-binding modules；
2. Task Anchor 明确列出 runtime entrypoint、transitive runtime resources、`NativeTrainBackend.mjs` 与每个 pass adapter 的精确 pins；
3. 对 filter 57 保存限定 semantic command trace，至少绑定 program、draw、`uRole`、`uSide`、bounds、material 与 shader identity；
4. 重放 N239 的 `uSide` wrapper 负控，必须在任何 draw 前拒绝；未列出的 wrapper、stale module hash、缺失 module 同样拒绝；
5. pristine fresh extraction 再跑 `new-admission.test.mjs`、`player-protocol.test.mjs` 和实际 EGL；命令 trace 与像素证据分账；
6. 补一份最小 R2 Task Anchor + Delivery Receipt；随后才执行固定 HTTPS、桌面与 390×844 浏览器验证。手机视口不冒充实机。

## 未完成边界

- 无正式 Task Anchor、Delivery Receipt、accepted baseline、Git baseSha、生产分支绑定或 Mother 新回执；
- browser/published 均为 false；无固定公网、桌面、390×844 或实机验收，交付未完成；
- perspective、numeric motion、generic world queries、physics 未实现；玻璃仍是显示候选，不是测得物理透射；
- A4 下裙板、内装、其他附件、客车及最终形体/材质接受仍开放；
- 未修改生产 Mother 分支、main、冻结成果、排程或学习飞轮。

## 生命周期

- `POSTED=true`：[#91 comment 6612332765](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6612332765)
- `ACKNOWLEDGED=false`（本轮 Train/A4）
- `IMPLEMENTED=true`：私有 R05 Player
- `GATE-RUN=true`：packaged Node 正控与 N239 隔离负控
- `production command-binding identity GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 学习飞轮下一题

怎样自动生成“可执行闭包图”：从最终入口追踪所有静态/动态 import、shader、WASM、worker 与 command adapters，并让同一份图同时驱动 preflight、semantic command trace 和 Delivery Receipt，从而不再依赖人工维护但未被消费的 freeze 列表？
