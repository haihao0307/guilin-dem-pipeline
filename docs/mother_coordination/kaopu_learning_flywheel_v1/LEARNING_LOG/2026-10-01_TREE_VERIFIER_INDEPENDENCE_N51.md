# N51 — Tree N50 verifier 独立性执行闭环

- 日期：2026-10-01
- 对象：现有 `TREE-DEVELOPMENTAL-CAUSAL-SEPARATION-001` Candidate 的 verifier 子门
- 状态：`Candidate revision / GATE-RUN`；没有新建重复 regression case
- bounded question：N50 是否真的能阻止 Producer 把自己填成 verifier 并自批？

## 1. 现有真实失败

本轮先复核：`main@38513d5410e374a0262bdcd80897dba9a9921c88`、`gh-pages@6ee57dd038f68a6dc2e60f640ffb3e03a63cdfd6`、协调头 `333dd5b8402b04280a1f0e388eba9ed0a8907f73`；#91 的最新回执仍是 N50，#63 仍是 N49，没有新生产 ACK。

N50 契约已经声明 `independentVerifierRequired=true`，但其可执行脚本只检查发育事件、光／水响应、根冠分离与根颈连续性，没有读取 `producerIdentity` 或 verifier receipt。对四个反例作修改前回放：

- 独立 verifier + 精确 subject：正确通过；
- Producer 自己验证：错误通过；
- verifier 验证旧／错误 subject：错误通过；
- 完全没有 verifier receipt：错误通过。

修改前结果为 `1/4 passed, 3 failed`。这是“制度写了独立验证，但执行门没有约束”的真实失败机制；若不修，Producer 仍能自己给自己放行。

## 2. 外部方法与证据

- NASA-STD-8739.8B 将 IV&V 独立性拆为 technical、managerial、financial 三部分；其中技术独立要求验证者不是开发者本身，管理独立要求验证责任不在开发／项目管理组织内：[NASA-STD-8739.8B](https://standards.nasa.gov/sites/default/files/standards/NASA/B/0/NASA-STD-87398RevB.pdf)。
- NIST 对 audit 的定义是独立检查记录与活动；separation of duty 需要把冲突职责分给不同角色，并可在访问／执行时动态强制：[NIST audit glossary](https://csrc.nist.gov/glossary/term/audit)；[NIST separation of duty](https://csrc.nist.gov/glossary/term/Separation_of_Duty)。
- GitHub protected branch 提供一个更接近可执行流程的类比：最新可评审 push 可要求由最后 pusher 之外的人批准：[GitHub protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)。

## 3. 与 KAOPU 当前制度比较

R2 OS 已明确 Producer 不能批准自己，机器 QA 后仍需独立 verifier。因此原则层是 `no-novelty`；真正新增是发现 N50 实现没有把这项原则转换为机器判定，并在同一个 regression case 内补齐。

不新建 `PRODUCER_SELF_APPROVAL` case，避免与 R2 和 N50 重复。只更新 N50 所属对象：

- `producerIdentity`
- `producerExecutionRoot`
- `verifierReceipt.verifierIdentity`
- `verifierReceipt.verifierExecutionRoot`
- `verifierReceipt.verificationSubjectSha`
- `verifierReceipt.verificationRunId`
- `verifierReceipt.result`
- `verifierReceipt.evidenceDigest`

新增状态：`HOLD_VERIFIER_EVIDENCE_MISSING`、`HOLD_VERIFIER_NOT_INDEPENDENT`、`HOLD_VERIFIED_SUBJECT_MISMATCH`、`HOLD_VERIFIER_GATE_NOT_PASSED`。

## 4. 可反驳假设

如果 Producer 与 verifier 身份、execution root 必须分别不同，并且 verifier receipt 必须绑定精确 subject SHA、运行 ID、结果和证据 digest，那么自批、缺失回执和旧 subject 回执会被阻断，同时合法独立验证仍能通过。

反证条件：任一自批／错误 subject／缺失 receipt 被放行，或合法独立 receipt 被误拒。

## 5. 最小历史／反例回放

修改前：`1/4 passed`；三个无效 verifier 情形均错误得到 `TREE_CAUSAL_SEPARATION_VERIFIED_ONLY`。

修改后：

| 样例 | 决定 |
|---|---|
| 独立 verifier + exact subject | `TREE_CAUSAL_SEPARATION_VERIFIED_ONLY` |
| Producer 自批 | `HOLD_VERIFIER_NOT_INDEPENDENT` |
| verifier 检查错误 subject | `HOLD_VERIFIED_SUBJECT_MISMATCH` |
| 缺少 verifier receipt | `HOLD_VERIFIER_EVIDENCE_MISSING` |

修改后 verifier 回放 `4/4 passed`；原 N50 十例保持 `10/10 passed`，合法候选诊断中 `verifierIndependent=true`。

## 6. 适用边界

- 本补丁只验证 KAOPU receipt 中的技术／执行根分离，不声称达到 NASA 的完整管理和财务独立。
- 身份与 execution root 必须来自可核实运行回执；纯手写标签仍可能伪造，不能自动升级成 `ACKNOWLEDGED` 或 `ADOPTED`。
- verifier 可以复用同一套只读 gate，但不能是同一 producer 身份或同一执行根，也不能验证旧 SHA 后把回执移植给新产物。
- 通过本门只表示 N50 causal-separation gate 有独立验证回执，不表示 Tree 物种、3A、浏览器交付或用户验收通过。
- 若单人小型环境无法提供组织独立，保持 `HOLD_VERIFIER_NOT_INDEPENDENT`，或由后续独立专家复核；不得把现实限制解释成自动放行。

## 7. 是否采用

决定：更新现有 Tree N50 Candidate，作为 Tree R04 单 Mother 试验的 verifier 子门；不改 R2 OS，不全局强制，不修改生产分支。

- `POSTED`: true（Tree 定向路由：[#91 comment 5920349204](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5920349204)）
- `ACKNOWLEDGED`: false
- `IMPLEMENTED`: true（Candidate checker revision only）
- `GATE-RUN`: true（prepatch 1/4；postpatch 4/4；原 N50 10/10）
- `ADOPTED`: false
- `USER-ACCEPTED`: false

## 8. 效果指标

首次候选通过率、用户纠错次数、同类错误复发率、rejected lineage 继承次数、stale delivery 次数、每个 accepted delta 的内部迭代数、从用户指令到合法 candidate 的时间：`unknown`。没有 Tree R04 新生产候选或用户验收，不造 KPI。
