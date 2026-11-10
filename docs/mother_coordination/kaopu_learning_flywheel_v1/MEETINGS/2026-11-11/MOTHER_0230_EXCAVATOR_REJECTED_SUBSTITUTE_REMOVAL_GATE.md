# KAOPU Mother 每日协调会 — N267 挖机被拒替代物清理门

- 日期：2026-11-11（北京时间）
- bounded task：只核“被用户否决的简化挖机是否已从线上/默认展示及父代继承链移除”，不讨论下一版建模。
- read set：`main@e43e84a9c84ca2bad3c8a2ae52627c5a1c5b9d02`；R2 / Reference Replication / Freshness gates；#91 N266；#63 无新相关 receipt。
- 模式：`REPLICATION_LOCKED`；`CREATIVE_AUTHORIZATION=false`。

## 任务锚点核对

| 字段 | 核对结果 |
|---|---|
| 唯一 taskId | `UNBOUND_POST_CORRECTION_REMOVAL_SLICE`；尚无生产 Task Anchor |
| targetObject | 被拒绝的简化挖机可见结果及其 active/public lineage |
| targetDefect | 结果可能仍可由默认入口、fallback、父代或参考选择器触达，且没有 source-bound quarantine receipt |
| accepted baseline / baseSha | `UNKNOWN`；`main` SHA 只用于本轮读集，不冒充挖机 accepted baseline |
| 用户最后约束 | 从线上与默认展示删除；保留可恢复失败证据；永不作为参考、父代或 baseline |
| referenceSet / UNKNOWN | Library 可见 `excavator (1).zip`、`excavator_bucket.zip`、`buckets_excavator.zip`；哪一个是用户所说完整挖机、其不可变 digest、accepted parent 与生产 route/head 均未绑定 |
| forbidden routes | 公网/默认展示、selector、fallback、parent registry、生产 test fixture、后续参考或继承链均不得触达该被拒结果；Candidate/approximate 标签不能豁免 |
| fresh head delta | 用户纠正后未找到 Task Anchor、Delivery Receipt、源码包或删除提交；生产成果记 `NO_NEW_ARTIFACT` |
| regression | 复用 `UNAUTHORIZED_CREATIVE_SUBSTITUTE`：Bird / Fish / Boat 三例；只更新证据，不新建近义 Excavator case |
| 当前状态 | `HOLD_GATE_FAIL`；原结果仍为 `REJECTED_CREATIVE_SUBSTITUTE` |

## 新证据与门禁

`IMG_8618.png` 是纠正后的新观察，SHA-256 为
`40cf697485b8e94db12167df960fb9b01cd64e1ea12c97f060119709195d87a1`，尺寸 947×2048。图中 “Detailed excavator” 页的主视口为空，但 selector 与 parts list 仍在。

这只能说明“该次手机截图里未显示挖机”。它没有绑定公网 URL、exact production head、源码 delta、桌面证据或 390×844 浏览器视口，因此不能推出线上/默认删除已经完成。

| Gate | 结果 |
|---|---|
| Contract | FAIL：无 post-correction Task Anchor / Delivery Receipt |
| Freshness | FAIL：无绑定用户纠正后的源码 delta / removal commit |
| Reference Fidelity | FAIL：完整参考身份与 accepted parent 未绑定 |
| Machine | FAIL：无 active import graph、build manifest、default registry 的负向检查 |
| Browser | FAIL：无清晰公网链接、exact-head 桌面 + 390×844 证据与主要交互验证 |

## 明确决定与有限方法

**决定：不晋级、不宣称删除完成。责任端为 Excavator Mother 的生产源码清理；Gate 由独立 verifier 执行。**

只允许一个 cleanup-only slice：

1. 绑定一个 taskId、生产 head、公网/默认 route、被拒 asset/module ID 与 accepted parent。
2. 从 active import、default selector、fallback、parent/reference registry 移除该对象；把失败证据写入 hash-addressed quarantine，并明确 `eligibleAsParent=false`。
3. clean checkout 运行负向检查：active import graph、build manifest、默认选择、runtime request/draw inventory 均不得出现被拒 ID。
4. 同一 exact head 提供清晰公网链接，在桌面与 390×844 浏览器视口核验实际渲染和主要交互，并提交 Delivery Receipt 与 known limitations。

**最小验证：**一份 source-bound quarantine receipt + exact-head 负向机器检查 + 同一公网 URL 的桌面/390×844 浏览器证据。任一 active route、selector、fallback、registry、request、draw inventory 或后续候选仍触达/继承被拒结果，即判失败。

## 未完成边界

- 不声称该版本已从生产或公网删除。
- 不声称已建立挖机 accepted baseline 或完整参考的 exact identity。
- 不判断下一版挖机画质，也不声称用户接受。
- 本轮未修改挖机生产分支、资产、公网页、baseline、main 或 R2。

## 学习飞轮继续研究

需要定义最小机器可读的 `RejectedLineageQuarantineReceipt`：它必须同时证明 exact public build 中不可触达、失败证据仍可恢复，并能阻止 quarantine 字节重新进入 parent/reference selection。

生命周期：协调记录 `POSTED=true / IMPLEMENTED=true / GATE-RUN=true`（[#91 comment 6775961868](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6775961868)）；生产 `ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED=false`。
