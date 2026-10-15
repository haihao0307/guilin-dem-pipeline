# N162 — 运行字节等价不能代替新 active route 的浏览器执行

- 日期：2026-10-15
- Mother：Human / Shared Skin / Clothing
- 类型：制度验证 / tested-subject / stale-delivery
- Bounded question：更早的固定公网服装检查，能否证明后来创建并设为 active 的稳定皮肤副本路径已经真实运行？
- 结论：CONTENT_EQUIVALENCE_VERIFIED__HOLD_ACTIVE_ROUTE_BROWSER_UNBOUND。

## 1. 现有真实失败

main 1e09ffec5b6b74d89b25e48afc4c487451db4e34 把服装集合入口切到本地稳定副本：

../MP05-Continuous-Demand-R01/releases/r08-ccccfd5ca9c1-skin-r02/?look=D01

该副本于 2026-10-15T10:12:24.361Z 创建。交付回执却仍以 9de8f3c26ec2f8dd444548c4ea242f7ad198a0d6 为 headSha，公网服装浏览器检查在 10:05:26.729Z 已结束，比稳定副本创建早约 6 分 58 秒。qa/independent-overlay.json 同时明确写出 newBrowserRunPerformed=false，但 CURRENT_HUMAN.json 使用汇总字段 sharedSkinBrowserVerified=true。

因此时间上不可能是 active stable route 的浏览器证据。当前回执证明三份 runtime source 与此前已测 release 逐字节相同、原 release 未被改写、集合文件已指向新路径；这些是真实有效的 content-equivalence 和 route-configuration 证据。但它没有证明新目录、相对资源、集合跳转与运行初始化在 exact active route 上成立。

这不是断言稳定副本已损坏，也不否定旧固定公网 subject 自身的浏览器通过。

## 2. 外部方法 / 新颖性

GitHub 官方 Artifact Attestations 把 artifact 与 workflow、repository、environment、commit SHA 和触发事件绑定；官方也明确说 attestation 只提供来源/完整性关系，不保证 artifact 本身安全或语义正确。该方法已经在 N147 作为 TESTED-SUBJECT-NOT-MUTABLE-HEAD-001 的 TEACHER_CANDIDATE 评估，本轮没有新老师，记 NO_NOVELTY：

- https://docs.github.com/en/actions/concepts/security/artifact-attestations

对本事件的含义是：digest/provenance 可以合法继承内容身份，但不能替代新 URL/route 的 HTTP、依赖解析和浏览器启动。路径级行为仍需 exact-route run。

## 3. 与 KAOPU 当前制度比较

R2、Freshness Gate 和根 AGENTS 已明确要求测试与当前 head 绑定，公网 URL 指向旧 release 或当前 head 与展示结果不一致时必须 fail closed。缺口不是规则不存在，而是 sharedSkinBrowserVerified 把多个 consumer 汇成一个布尔值，同时把 content equivalence 与 route execution 混为一体。

本轮不创建重复 regression。只给既有 TESTED-SUBJECT-NOT-MUTABLE-HEAD-001 追加 N162 真实 evidence update，并要求后续 receipt 用 per-consumer / per-route 状态。

## 4. 可反驳假设

若旧浏览器结果可以覆盖新 active route，则至少必须同时成立：

1. tested route 与 active route 是同一精确路径；
2. tested commit 已包含该 route；
3. 浏览器运行结束时间不早于 route 创建时间；
4. runtime 与完整 asset set 摘要一致；
5. exact route 的 HTTP 正文、版本标记、依赖请求和浏览器初始化均通过；
6. verifier 明确记录 newBrowserRunPerformed=true。

当前证据满足内容等价，不满足 1、2、3、5、6，因此该假设被反驳。

## 5. 最小历史回放

11/11 分类回放通过，覆盖：当前真实事件、缺 route、runtime/asset digest 不同、同字节但 predecessor route、public commit 尚未含新 route、浏览器证据早于 route、无新浏览器、HTTP/版本身份缺失、exact route 浏览器失败，以及 exact active route 完整闭合。

当前合法状态为 CONTENT_EQUIVALENCE_VERIFIED__HOLD_ACTIVE_ROUTE_BROWSER_UNBOUND。只有重新执行 active stable route 才能提升为 ACTIVE_ROUTE_BROWSER_VERIFIED。

## 6. 适用边界与是否采用

采用为 Human/Clothing 下一次 shared-skin receipt 的 Candidate 增量：

- 分开记录 contentEquivalent 与 activeRouteBrowserVerified；
- 每个 consumer 写 active/tested route、commit、route 创建时间、browser run 时间；
- 汇总布尔值不得掩盖未运行 consumer；
- 旧 immutable public subject 继续保留，不删除、不改写；
- 不修改当前 stable overlay，不自动回滚用户已授权皮肤基线，不降低其他门禁。

是否提升为全局字段，等待该 active stable route 的一次真实浏览器 GATE-RUN 和协调者复核。

## 7. 生命周期与 KPI

- method：NO_NOVELTY；沿用 N147 Teacher Candidate，不新增老师
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/293#issuecomment-6191356375
- ACKNOWLEDGED / IMPLEMENTED / ACTIVE-ROUTE-GATE-RUN / ADOPTED：false
- USER-ACCEPTED：true（仅 SKIN-FULLBODY-R02 作为主线基线）；stable clothing route 视觉验收：false
- learning classifier：11/11
- stale/wrong-subject evidence event：1
- 其余首次候选通过率、用户纠错次数、同错复发率、rejected lineage 继承次数、accepted delta 内部迭代数、从指令到合法 candidate 时间：unknown
