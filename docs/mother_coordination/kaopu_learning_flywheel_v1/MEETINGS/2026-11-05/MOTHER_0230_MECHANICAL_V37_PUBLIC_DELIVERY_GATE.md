# KAOPU Mother 协调会｜Mechanical v37 离线包不满足公网交付门

- 会议编号：`KAOPU-MOTHER-20261105-MECHANICAL-V37-PUBLIC-DELIVERY-001`
- 实际核查开始：2026-11-05 02:32:53 +08:00
- 实际核查结束：2026-11-05 02:38:31 +08:00（5 分 38 秒；完成即结束）
- 协调分支前一固定纪要：`21642777daa85bf3b48cb561d06bad12d2d510c4`
- main：`34553e93d75a427c10dbf5b0077d42f8cdda0a63`
- 强制协议 blobs：AGENTS `251b6646…338f5`；R2 `d942d44b…b2bf`；Reference gate `8c0a49c7…8278`；Freshness gate `4754a90a…9021`
- 范围：一个最高价值问题——Mechanical v37 离线转发包能否作为交互/三维工作台最终交付
- 参与：小妈主持并 fresh replay；观察到 Mechanical v37 离线工件。未取得本轮 Mechanical Mother 回复；包内自述和 #91 学习帖不冒充 ACKNOWLEDGED。

## 会前状态

已按 main 的 R2 Production OS、Reference Replication gate 与 Freshness gate核对。#91 最新实质回流到 N245：Simscape Excavator 仅为 `TEACHER_CANDIDATE / POSTED`，尚未 audition、implement、gate-run、adopt 或取得 Mechanical 回执。#63 仍无新于 Coast N49 的生产回流。main 亦无新的 Mechanical 提交。

本轮新出现的是 Library v0 离线转发包，故不重复昨日 A4 命令闭包，也不把教学候选当生产增量。

## 精确对象与 fresh replay

- Library：`libfile_6321c7c1c3588191a3127681b6da5f50`
- 文件：`Mechanical-Mother-v37-offline.zip`
- 文件大小：3,421,315 bytes
- ZIP SHA-256：`d4f19a70a743e8c78b859cb5c69c26543ed3b59cc4c3a7bd20cf12199b086b81`
- 包内来源声明：site v37；source commit `b7281661a7f05ee8a4d9710e80f55c36a339cdfe`
- targetObject：Mechanical v37 交互工作台的最终对外浏览器交付
- targetDefect：只有本机 loopback 离线入口，却没有固定 HTTPS subject、版本回读、外部浏览器与当前移动视口证据
- 当前状态：`HOLD_GATE_FAIL / BLOCKED_VALID / DELIVERY_NOT_COMPLETE`

本轮实际复跑：

1. `CHECK-PACKAGE.py`：311/311 packaged files SHA-256 匹配；
2. 本机独立 HTTP 启动后，主台、AC、当前 LOCK-01、历史 Locking、responsive QA、version.json 六个入口均返回 200；
3. `node --test site/tests/own.test.mjs`：7/8，通过 7，失败 1；失败仍是当前测试中的 module hash 断言；
4. 包内 `SOURCE-VERSION.json` 明确 `browserTested=false`、`hardwareGPUTested=false`；
5. README 明确只有 `http://127.0.0.1:8765/`，手机/平板不属于已验证方式，且当前包没有公开网页。

这些结果证明离线文件完整且可由本机 HTTP 提供，不证明外部浏览器交付、视觉接受、硬件 GPU 或生产集成。

## R2 九项账

| R2 项 | 本轮观察 | 判定 |
|---|---|---|
| taskId / targetObject / targetDefect | 包内没有唯一 R2 taskId；本纪要仅限定 v37 工作台外部浏览器交付 | CONTRACT HOLD |
| accepted baseline / baseSha | 无用户 accepted baseline、Git baseSha 或生产 head；source commit 未绑定 source repository/ref | UNKNOWN / HOLD |
| 用户最后约束 | 最终交付必须提供外部浏览器可直接打开的清晰网页链接，并验证当前版本、主要交互、desktop 与 mobile；离线包仅可配套 | 当前未满足 |
| referenceSet / UNKNOWN | 包列出输入/历史来源并移除私有 AC 参考；最终 target referenceSet、用户接受形体、硬件 GPU、实机均 UNKNOWN | BOUNDED |
| forbidden routes | 禁止把 127.0.0.1、ZIP、旧历史 QA、截图或包内自述当最终网页交付；禁止为汇报部署旧失败版本 | 未执行错误部署；当前仍是 offline-only |
| fresh head delta | Library v0 与 ZIP hash 新鲜可核；包相对 source 声明 5 个 site files changed、3 removed、1 added；无生产 head/public subject 绑定 | PRIVATE FRESH / PRODUCTION HEAD NONE |
| regression cases | 适用现有 Task Freshness / Public Web Delivery 门；Bird、Fish、Boat、Terrain 四类本轮不适用；不建重复 case | EXISTING GATE APPLIES |
| machine / reference / browser | integrity PASS；local HTTP 6/6；current Node 7/8；reference/private transform ledger有限；browser=false、hardware GPU=false、390×844=false、公网 URL=none | HOLD |
| 状态 | 离线配套有效，但最终交付门失败 | `HOLD_GATE_FAIL / BLOCKED_VALID` |

## 明确决定

保留 v37 作为**新的离线配套和可恢复证据**。它不是 generic/toy/placeholder，本轮不标 `REJECTED_CREATIVE_SUBSTITUTE`；ZIP 身份新鲜，本轮也不标 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`。

但是它不得晋级 `CANDIDATE_READY`、不得成为 accepted baseline，也不得宣称交互/三维工作台已交付。当前只有 `127.0.0.1`，包内明确未做 browser/hardware GPU/mobile；fresh current test 仍为 7/8。**交付未完成。**

## 责任端与最小验证

责任端：Mechanical Mother / publisher；独立 verifier 只核查，不修改生产形体、材质或托管。

最小解除：

1. 写一份去重的 R2 Task Anchor + Delivery Receipt，固定唯一 taskId、targetObject/targetDefect、accepted baseline/baseSha、当前生产 head；
2. 绑定 source repository + source commit，并将 offline transform ledger、ZIP hash、发布 subject digest 分账；
3. 对当前 7/8 测试给出修复，或用唯一 machine-readable authority 将它标为已 superseded；随后从 fresh extraction 重跑当前门；
4. 使用既有固定托管入口发布 exact subject，不新增收费服务；回读最终 HTTPS URL、版本标识、部署内容 digest 与生产 head；
5. 对同一 subject 在外部浏览器完成 desktop 与 390×844 的实际内容渲染、零 fatal error、至少一个主要交互；390 视口不冒充物理手机；
6. 离线 ZIP 与源码包继续作为配套，不替代网页。

## 未完成边界

- 无正式 Task Anchor、Delivery Receipt、accepted baseline、Git baseSha、生产分支绑定或 Mechanical 新回执；
- 无固定公网 URL、external-browser render、desktop/390 当前版本证据、实机或用户验收；
- 7/8 当前测试不满足 machine gate；包内历史 50/51、旧浏览器叙述不能替代本轮 current gate；
- 未判断制造、结构强度、热流体、硬件 GPU 或完整 AC/lock 工程正确性；
- 未修改生产 Mother 分支、main、托管、冻结成果、排程或学习飞轮。

## 生命周期

- `POSTED=true`：[#91 comment 6638923180](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6638923180)
- `ACKNOWLEDGED=false`
- `IMPLEMENTED=true`：仅 offline package
- `GATE-RUN=true`：integrity、local HTTP、current Node test
- `production/public browser GATE-RUN=false`
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 学习飞轮下一题

怎样给同一版本建立“公网交付 subject + 离线配套包”的双形态身份：两者共享一个生产 head 和内容闭包，但分别记录 transform ledger、URL/digest、浏览器门与离线恢复门，从而既不把离线包冒充公网交付，也不让固定 URL 被后续覆盖后继续指向旧 receipt？
