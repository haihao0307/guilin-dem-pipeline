# N27 — 部分传输不得晋级为发布输入或父节点

Date: 2026-09-24  
Status: **Candidate partial / exact history replay passed / not adopted**  
Scope: Stone Money R015.2 staged-source transfer only

## Bounded question

当大文件以分块 Base64 方式暂存时，怎样机械阻止“不完整或已污染的分块”被误当成可发布输入、下一版父节点或完成证据？

## 现有真实失败

Observation Root O2（Git 对象与提交历史）：`publish/stone-money-r0152-pages-20260924 @ bbe533341bd65b4d1277b80b3cf2007c04d197bc` 正确保留了 `UPLOAD_IN_PROGRESS`，也冻结了目标 `933638 bytes / SHA-256 b345c852...f5328`，但已提交的两个分块没有分块清单、期望总数、解码后长度或逐块 digest。

更关键的新反例：

- `chunk-00.b64` 在归一化偏移 `15669` 起包含字面量 `... (truncated)`；
- `chunk-01.b64` 在偏移 `10000` 起包含字面量 `[... ELLIPSIZATION ...]`；
- 两者均不是 RFC 4648 Base64。宽松解码器可能先输出部分字节再报错，因此“产生了输出文件”不能作为完整性证据。

Issue #91 的 `PARTIAL_SOURCE_STAGING` 说明是对该历史的正确状态解释，不是独立 Observation Root。

## 外部方法与独立证据

Observation Root O3（IETF）：[RFC 4648 §3.3](https://www.rfc-editor.org/rfc/rfc4648#section-3.3)要求默认拒绝 Base alphabet 之外的字符，除非引用规范明确另行允许；§3.5另将 canonical encoding 与“能解码”区分。

Observation Root O4（OCI Image Spec）：[Content Descriptor](https://github.com/opencontainers/image-spec/blob/main/descriptor.md)把内容的 byte-size 与 digest 作为必需字段；长度不符时不应信任内容，消费前应独立重算 digest。嵌入 Base64 数据还必须符合 RFC 4648，解码结果应与 descriptor 指向的内容完全一致。

OCI 不是 KAOPU 架构依赖，也不在此轮被整体引入。仅提取可迁移方法：**有序对象清单 + 逐对象大小/digest + 最终对象大小/digest + 消费前验证**。

## 与现有 KAOPU 制度比较

Observation Root O1（当前 main 的 R2 OS、Reference gate、Freshness gate、根 AGENTS）：现行制度已禁止 stale delivery、错误对象、silent fallback 与 rejected lineage 继承；当前 `UPLOAD_IN_PROGRESS` 也诚实阻止了“已经发布”的话术。

No-novelty 部分：继续要求 Task Anchor、来源 SHA、独立 verifier 和发布回读，不需重写 R2。

真实缺口：现行规则尚无针对“传输中间态”的可执行晋级条件。仅有目标 SHA 文本和若干 chunk 文件，不能证明实际重组对象存在，更不能证明它等于目标。

## 可反驳假设

若把传输态隔离为 `STAGING_QUARANTINE`，并要求下列全部证据后才签发 `SOURCE_TRANSFER_VERIFIED`，则现有污染/缺块历史应被拒绝，而一个完整反证控制应通过：

1. `UPLOAD_IN_PROGRESS` 等 stage marker 已清除；
2. 已知 `expectedChunkCount`，且有序分块数量完全相符；
3. 每块严格解码，且有解码后 `size + sha256` descriptor；
4. 按 index 重组后，最终 bytes 与 frozen target size/digest 全部相符；
5. 只有重组后的 verified object 可以成为发布输入或下一版父节点。

如果污染历史也通过，或完整控制失败，假设即被否定。

## 最小试验 / 历史回放

Observation Root O5（N27 可执行探针）：`partial_transfer_gate_n27.cjs` 直接以 `git show <commit>:<path>` 读取固定提交，避免工作区修补影响证据。

- 真实历史：`9/9` 晋级条件失败；两个分块均未通过 strict Base64；结果为 `HOLD_SOURCE_INCOMPLETE_OR_CORRUPT`。
- 反证控制：79-byte 已知 payload，3 个有序分块；逐块 size/digest、严格解码、最终 size/digest 全通过；结果为 `SOURCE_TRANSFER_VERIFIED`。

探针拒绝“文件存在”“提交数增加”“解码器产生部分输出”“只写了目标 SHA 文本”作为完整性证明。

## Current Best View / 是否采用

**Candidate partial：局部试验，不修改全局 R2。**

- `STAGING_QUARANTINE`：允许增量上传、断点续传和协作，但 `parentEligible=false`。
- `HOLD_SOURCE_INCOMPLETE_OR_CORRUPT`：任一数量、编码、逐块 descriptor、重组 size/digest 不符。
- `SOURCE_TRANSFER_VERIFIED`：仅表示 exact bytes 传输闭合；仍不等于 browser verified、publication complete 或 user accepted。

建议为 Stone Money 下一次重组添加一个 `transfer-manifest.json`：`transferId`、frozen source identity、`expectedChunkCount`、`chunks[{index,path,encodedBytes,decodedBytes,sha256}]`、`strictEncoding`、`assembledBytes`、`assembledSha256`、`stageMarkerCleared`、`verifiedObjectPath`、`parentEligible`。

### Rejected

- 把 chunk 文件名、数量或提交数量当作进度闭环；
- 宽松忽略非 alphabet 字符，或忽略解码退出状态；
- 未实际重组，仅凭 `EXACT_SOURCE_SHA256.txt` 宣布 source ready；
- 把所有小文件也强制改成分块传输。

### Frozen / Unknown

- Frozen：生产 Mother 分支、R2 OS、现有门禁、发布状态、Canonical Truth 均未修改。
- Unknown：真实 Mother 重传是否实施、独立 verifier 是否运行、公网/浏览器/设备验证、用户验收、首次候选通过率、纠错次数、stale/rejected lineage 复发率与迭代成本。
- 第一梯队专家 AI：未调用。

## 下一合法步骤

只在 Stone Money 的实际重组任务中做一次可回滚试验；由 Producer 生成 manifest 和重组对象，由独立 Verifier 重读 Git blobs、严格解码并重算最终 identity。完成前状态只能是 `POSTED` 或 `IMPLEMENTED`，不能写成 `GATE-RUN / ADOPTED / USER-ACCEPTED`。
