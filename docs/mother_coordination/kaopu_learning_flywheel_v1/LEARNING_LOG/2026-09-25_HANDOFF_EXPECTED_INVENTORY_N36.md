# N36 — 包内 manifest 完整不等于交接合同完整

- 日期：2026-09-25
- 状态：Candidate partial
- 范围：Fish R011 单 Mother 历史回放；不修改生产分支或全局 R2
- 验证：12/12 fixtures 通过

## 一个 bounded question

一个 ZIP 已通过下载身份、SHA-256、CRC、181 项 manifest 和 fresh-unzip 浏览器检查时，能否据此主张“用户要求的完整交接内容已经齐全”？

## 现有真实历史

1. R011 包装提交 8ae005b5d4e5994536dc75ad229612d2ae6d35c5 生成可运行公开项目快照。
2. package run 35962473032 与 download-verify run 35962806367 验证 ZIP 为 138,917,097 bytes，SHA-256 为 1d312283d1292338651b8383ea1c6dba52ab91d0eb4ab8258b2f1a0201d2d6aa，181 个文件均通过 CRC，fresh-unzip 浏览器检查通过。
3. build_snapshot.py 先选择 sparse checkout 与公开文件，再遍历输出目录生成 MANIFEST.json。该 manifest 因而是“已选择输出”的观测清单，不是独立的任务期望清单。
4. MANIFEST.json 与 START_HERE 明确记录 entirePrivateSourceVault=false、originalFbxZipIncluded=false、privateContinuousLogIncluded=false，并把主张限定为 complete runnable public-project snapshot。
5. 因此 R011 的公开可运行子集主张没有失败；它诚实披露了排除项。若主张升级为完整接管源库，则原始 FBX/glTF 上传 ZIP 与私有连续指令日志均缺失。
6. 真实任务究竟要求 PUBLIC_RUNNABLE_SUBSET_V1 还是 FULL_TAKEOVER_SOURCE_VAULT_V1，没有在包装前的机器可读 Task Anchor 中冻结；用户验收亦为 Unknown。

## 外部方法与证据

[RFC 8493 BagIt](https://www.rfc-editor.org/rfc/rfc8493)将 payload 当作不透明字节流，以 manifest 校验每个 payload 文件；其 complete/valid 结论相对于 Bag 的既定元素、manifest 和 checksum。RFC 也允许 fetch.txt 表达尚需从外部取得的 payload。

可迁移的最小原则不是引入整套 BagIt，而是将两张清单分开：

- expectedInventory：包装开始前由任务合同冻结，描述必须交付的语义角色、交付方式与身份要求。
- observedInventory：包装后从实际 ZIP、外部对象或明确排除项中观测，不能由同一遍历自动兼任期望清单。

推论：包内 manifest 能证明“所选内容完整且未损坏”，不能单独证明“任务要求的所有内容都被选择”。

## 与 KAOPU 现有制度比较

- 与 R2、N27、N29 重复的部分：对象身份、摘要、下载回读、暂存隔离、原子 artifact tuple 已有约束；这些记为 no-novelty。
- 本轮新增缺口：自生成 manifest、文件数、总字节数和运行通过都无法发现“从未进入选择集的必需语义角色”。
- 当前 freshness/no-stale 与 no-creative-substitute 门禁不应被削弱；本候选只增加交接覆盖率这一正交主张。

## 可反驳假设

如果 Task Anchor 在包装前冻结 completenessProfileId 与 expectedInventory，并把 observedInventory 的每个角色标成 INCLUDED_VERIFIED、VERIFIED_EXTERNAL、KNOWN_NOT_INCLUDED、MISSING 或 UNKNOWN，则门禁能够：

1. 保留 R011 公开可运行子集的合法成功；
2. 对完整接管源库主张准确 HOLD 两个缺失角色；
3. 不把 CRC、181 项 manifest 或 fresh-unzip runtime 错当作合同完整性；
4. 在任务 profile 未冻结时返回 Unknown，而不是猜测用户意图。

## 最小历史回放

机器探针 handoff_inventory_gate_n36.mjs 对固定 fixture 执行 12 项断言：

- archiveIntegrity = ARCHIVE_INTEGRITY_VERIFIED；
- PUBLIC_RUNNABLE_SUBSET_V1 = HANDOFF_CONTRACT_COMPLETE；
- FULL_TAKEOVER_SOURCE_VAULT_V1 = HOLD_REQUIRED_ROLE_MISSING；
- 缺失角色恰为 originalFbxGltfUploadZip 与 privateContinuousInstructionLog；
- actualTaskProfile = UNKNOWN_NOT_PINNED_IN_MACHINE_READABLE_TASK_ANCHOR；
- userAcceptance = UNKNOWN；
- manifest/file-count/runtime 不得覆盖缺失角色；
- 未经授权且无身份回执的外部指针不得冒充已交付。

结果：12/12 通过。

## Current Best View

1. R011 的 archive integrity、下载身份和 runnable public subset 继续有效。
2. 对“完整私有接管源库”这一更强 profile，当前证据应为 HOLD_REQUIRED_ROLE_MISSING。
3. 对历史真实用户意图，不补写结论：UNKNOWN_TASK_PROFILE_NOT_PINNED。
4. 下一次 Fish 全项目/接管交接可局部试验预冻结 expectedInventory；未验证前不修改全局 R2。

## Candidate 可执行对象

Task Anchor / Delivery Receipt 最小字段：

- completenessProfileId
- claimLabel
- expectedInventory[]：role、required、deliveryMode、identityRequirement
- observedInventory[]：role、state、artifact tuple 或 exclusion reason
- missingRequiredRoles[]
- archiveIntegrityDecision
- runtimeDecision
- contractCompletenessDecision
- userAcceptance

## 拒绝的替代方案

- rejected：CRC 通过即合同完整。
- rejected：由输出目录自动生成的 manifest 同时充当 expected inventory。
- rejected：用文件数、字节数、截图数或文档数代替语义角色覆盖率。
- rejected：路径或链接存在即等于外部对象字节已交付。
- rejected：为了新增合同门禁而抹除已成立的 archive/runtime 证据。
- rejected：强迫公开可运行子集携带未授权的私有源库。

## 适用边界与 Unknown

- 适用：handoff、backup、reproducibility bundle、full-project/takeover package。
- 不适用：仅声称单个已命名 artifact 的逐字节身份时，N29 tuple 足够。
- Unknown：历史 Task Anchor 的真实 completeness profile、私有内容授权范围、两项排除物的当前可取回性、用户验收、制度 KPI。
- 第一梯队专家 AI：未调用。
