# KAOPU Mother 协调会｜Mechanical 方轴：源形证据通过，但 R2 生产合同缺失

- 会议编号：`KAOPU-MOTHER-20261102-MECHANICAL-PRISM-CONTRACT-001`
- 实际核查开始：2026-11-02 02:26:37 +08:00
- 协调分支读取基线：`af35ddedcac6227e3c657a91e07fb2e2347f48e4`
- main：`34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 范围：一个最高价值问题——新 Mechanical 凸截面方轴私有包能否按 R2 进入生产候选
- 参与：小妈主持并独立核查；观察到 Mechanical 生产工件。未取得本轮 Mother 回复，未把历史工件或包内自述记作参会回执。

## 会前强制协议核对

已在 main 核对根 `AGENTS.md`、`knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md`、`knowledge/REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md`、`knowledge/TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md`。本轮按 R2 Contract / Freshness / Reference Fidelity / Machine gates 判断。

#91 最新回流到 N228：A6 的 axle relation 仍是 POSTED、未 ACKNOWLEDGED；#63 无新于既有 Coast N49 的生产回流。它们不改变本轮 Mechanical bounded subject。

## 唯一问题与精确对象

精确对象：

- Library identity：`libfile_7affa5762a648191bb7b2f22e080f986`
- 文件：`mechanical-convex-prism-shaft-r01.zip`
- ZIP SHA-256：`c17b62e0b06c58d57c7c670f572f9fba53f78dc6e61689e4d7bd2d4c6a149086`
- 伴随恢复记录：`libfile_c412ba82f8ec8191ab948600390d71ab`
- reference source：3DDomino “Locking”，CC-BY-4.0，source bin SHA-256 `2178cd69086daecaba55e3164ed6c5581a60cd328d27784cfc5bdadc3b97fde9`
- target object：原 source node54 / mesh9 / primitive0 的单个凸八边截面方轴
- target defect：无倒角盒子、rounded box、额外孔槽或错误旋转轴替代原 45° 平切角
- 当前状态：`HOLD_GATE_FAIL`

## R2 九项账

| R2 项 | 本轮观察 | 判定 |
|---|---|---|
| taskId / targetObject / targetDefect | 包内能重建对象和缺陷语义，但没有唯一 `taskId` 或 R2 Task Anchor | HOLD |
| accepted baseline / baseSha | 有 exact source hash、package hash 与内部 module hash；没有用户 accepted baseline，也没有 Git `baseSha` | UNKNOWN / HOLD |
| 用户最后约束 | 包内没有绑定本任务当前 `REPLICATION_LOCKED / CREATIVE_AUTHORIZATION=false` 及最终交付门 | HOLD |
| referenceSet / UNKNOWN | source URL、作者、许可、source hash、node/mesh/primitive、未知单位/材质/安装均清楚 | PASS |
| forbidden routes | 预注册反例明确拒绝 unbeveled box、rounded box、端倒角、孔槽；未用 R2 字段固化 | EVIDENCE PASS / CONTRACT HOLD |
| fresh head delta | 新 Library v0 包与 SHA 可核；不是旧包冒充。但没有生产分支 head / source diff 绑定 | PRIVATE ARTIFACT FRESH / HEAD UNKNOWN |
| regression cases | 包内 13 项本层测试、30 个 canonical probe、tamper negatives 与多个 false-same-type controls 已执行；未绑定仓库 regression case ID | LOCAL GATE-RUN / R2 LINK HOLD |
| machine / reference / browser gates | fresh restore、manifest、tamper、source geometry 与固定对照图证据存在；明确 `publication=NONE`、无 UI/GL/browser 验收 | PRIVATE MACHINE+REFERENCE PASS / BROWSER NOT RUN |
| 状态 | Contract gate 未形成，Producer 不能自批 | `HOLD_GATE_FAIL` |

## 明确决定

保留方轴 R01 作为**有来源、可恢复、非 creative substitute 的私有技术工件**；不回退到错误 box/rounded-box，也不丢弃其预注册验证和反例。

它现在不能晋级 `CANDIDATE_READY`、不能成为 accepted baseline，也不能向别的 Mother 宣称已采用。原因不是参考质量不足，而是 R2 Contract gate 没有把现有证据绑定到唯一任务、用户约束、accepted baseline/baseSha、生产 head 与交付状态。恢复验证只能证明包闭包和本层几何检查，不能替代生产授权或用户验收。

## 责任端与最小验证

责任端：Mechanical Mother / 当前集成执行端。

只补一份去重后的 R2 Task Anchor + Delivery Receipt，引用现有 hashes，不复制整套说明。最小验证必须：

1. 固定唯一 `taskId`、targetObject、targetDefect；
2. 写明 accepted baseline 为 `UNKNOWN`（若无用户接受），并区分 Git `baseSha` 与 Library ZIP SHA；
3. 绑定当前用户约束、referenceSet、UNKNOWN 与 forbidden routes；
4. 从 fresh restore 树实际重跑 integrity、13 tests、30 canonical probes 和三个关键负控：unbeveled box、rounded box、added bore/keyslot；
5. Receipt 记录准确 package/module/reference hashes、known limitations、运行结果和负责者；
6. 若以后交互或公网交付，再建立独立发布任务，并提供固定 HTTPS 入口、当前版本、桌面与 390×844 浏览器证据；本私有包不冒充该门已过。

## 未完成边界

- accepted baseline / Git baseSha / production head：UNKNOWN
- 用户接受：无
- 材质、物理单位、SKU、安装、传动、动态、runtime LOD：UNKNOWN / UNTESTED
- 公网、桌面、390×844、实机：未执行
- 未修改生产 Mother 分支、main、冻结成果、排程或学习飞轮

## 生命周期

- `POSTED`：待写入 #91 后更新
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`：仅私有 Library 工件
- `GATE-RUN=true`：fresh restore + local source/reference/machine gates
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 学习飞轮下一题

怎样从证据丰富的私有 capsule 自动提取一个最小、可机器检查的 R2 Task Anchor/Receipt，使同一 hash、UNKNOWN 和负控只引用一次，同时严格区分“源形验证通过”“可恢复”“生产 head 已集成”“浏览器已交付”和“用户已接受”？
