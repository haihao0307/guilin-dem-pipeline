# N29 — Artifact Identity Tuple：禁止跨对象拼接身份字段

Date: 2026-09-24  
Status: **Candidate partial / real correction replay passed / not implemented**  
Scope: multi-artifact delivery and audit receipts; Stone Money R015.3 bounded replay

## Bounded question

当一次交付同时包含单体 HTML、全量源码包、上传 artifact 与证明 JSON 时，怎样防止审计把 A 对象的字节数与 B 对象的摘要拼成一个看似完整、实际不存在的身份？

## 现有真实失败

Observation Root O1（当前 main 制度）：R2 OS、Freshness gate、Reference gate 与根 AGENTS 已要求 source/build/head/receipt 绑定、禁止 stale delivery，并要求最小完整 evidence package；没有允许跨对象拼接字段。

Observation Root O2（真实协调审计）：#91 comment `5810551382` 把 R015.3 HTML 写成 `160,774,272 bytes`，同时引用其真实 SHA-256 `7acf5fce...e68`。后续 comment `5812115818` 直接读取固定 head `66fb787c...` 后更正：HTML 实际为 `956,838 bytes`，较大数字来自另一 source/package。技术发布结论未变，但对象身份曾被混合。

这不是哈希碰撞，也不是 R015.3 构建失败；它是**类型不明的证据池 + 标量级人工摘录**造成的跨对象 identity conflation。

Observation Root O3（N28 不可变证据）：run `35973024167` 的 `ASSEMBLY_PROOF.json` 已同时给出 HTML 的 `956838 bytes / 7acf5fce...e68`。因此 O2 的错误可由现有证据直接反驳，不需要新生产运行。

## 外部方法 / 独立证据

Observation Root O4（[OCI Content Descriptors](https://github.com/opencontainers/image-spec/blob/main/descriptor.md)）：descriptor 将 `mediaType + digest + size` 作为同一目标内容的主要属性；消费时应同时核对 size 和 digest。多个 descriptors 相互独立，不能把不同 descriptor 的字段互换。

Observation Root O5（[in-toto Statement v1](https://github.com/in-toto/attestation/blob/main/spec/v1/statement.md)）：每个 `subject` 元素代表一个软件 artifact，必须有 digest；`name` 可区分 subject 集合中的不同 artifact，并建议在集合内唯一。规范同时提醒 subject 最终按 digest 匹配，内容类型若重要，producer/consumer 必须自行加入策略。

本轮不把 KAOPU 改造成 OCI registry 或 in-toto attestation。只迁移一个可执行约束：**artifact identity 是不可拆分的 descriptor tuple，不是可从全局证据池分别拾取的几个标量。**

## 与当前 KAOPU 制度比较

No-novelty：R2 的 exact SHA、production diff、receipt 与 N28 的 final claim subject 方向正确。

新增缺口：N28 建议 `subject byte size and digest`，但没有明确要求 `artifactRole / canonicalPath / mediaType / producerStep / bytes / digest` 必须来自同一 manifest entry 并原子验证。多 artifact run 中，两个独立正确标量仍可能被拼成一个不存在的 subject。

## 可反驳假设

若每个 named claim 的 subject 必须原子匹配同一 evidence manifest entry：

`artifactRole + canonicalPath + mediaType + producerStep + bytes + digest`

则：

1. 历史混合身份（160,774,272 bytes + HTML digest）应被 HOLD；
2. 更正后的 HTML tuple 应通过；
3. 仅 role 或 producerStep 错误也应被 HOLD；
4. 旧的“bytes 在某条记录出现、digest 在另一条记录出现”弱门会错误接受历史混合身份。

任一不成立即否定假设。

## 最小试验 / 历史回放

Observation Root O6（N29 executable probe）：fixture 保存真实 run/head、错误评论、更正评论与两种对象身份。弱标量门只判断 bytes 和 digest 是否分别存在于证据池；tuple 门要求六字段在同一 descriptor entry 精确匹配。

结果 `6/6`：

- 历史混合身份：弱门 `LEGACY_SCALAR_FIELDS_SEEN`，tuple 门 `HOLD_SUBJECT_DESCRIPTOR_MISMATCH`；
- 更正 HTML：`SUBJECT_DESCRIPTOR_VERIFIED`；
- 正确 bytes/digest 但错误 role：HOLD；
- 正确 bytes/digest 但错误 producerStep：HOLD。

这证明门能够捕获已发生的错误，也能接受其真实更正。它不证明 digest 的密码学独立性、workflow 防篡改或语义视觉正确。

## Current Best View / 是否采用

**Candidate partial：建议只在 Stone Money 下一次多 artifact publication receipt 中局部试验；不修改全局 R2。**

将 N28 `FINAL_CLAIM_RECEIPT.subject` 改为或引用一条 immutable descriptor：

`artifactRole, canonicalPath, mediaType, producerStep, bytes, digest`

验证规则：

1. 六字段必须匹配同一 manifest entry；
2. `bytes` 与 `digest` 不得分别从不同记录满足；
3. claim 中若引用多个 artifact，每个 artifact 独立 descriptor，不共享裸 `size` 字段；
4. 人类摘要只能由已验证 descriptor 渲染，不能重新手抄数字；
5. descriptor 验证只证明对象身份，不自动证明 publication、browser、iPhone、视觉或用户验收。

### 状态语义

- `HOLD_SUBJECT_DESCRIPTOR_MISSING`
- `HOLD_SUBJECT_DESCRIPTOR_MISMATCH`
- `SUBJECT_DESCRIPTOR_VERIFIED`

### Rejected

- 只检查某个 bytes 值和某个 digest 值是否在全局 evidence pool 出现；
- 只写“source/package size”而没有 artifact role 与 canonical path；
- 用文件名或版本号替代 bytes/digest；
- 因技术运行成功而忽略错误 identity tuple。

### 适用边界 / Frozen / Unknown

- 适用：同一任务含多个 HTML/ZIP/artifact/proof 对象，且摘要要支持机器验证。
- 不强制：单一内存对象的临时局部测试，除非它将进入交付 claim。
- Frozen：生产 Mother、main R2 OS、R015.3 artifact、公网页面、Game baseline、Canonical Truth 均未修改。
- Unknown：Mother 是否实施、独立 verifier 是否回签、是否降低 identity correction 复发率、是否适合全局激活、真实 iPhone/视觉/用户验收。
- 第一梯队专家 AI：未调用。

