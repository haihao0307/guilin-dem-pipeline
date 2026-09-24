# N35 — 派生 JSON 的字节身份、语义对象与数值等价必须分账

- 状态：Candidate partial / Fish R008 真实历史回放 + 合成反证 `12/12` 通过 / 未实施
- 范围：Fish R008 `feature-evidence.json` 的跨环境身份声明
- 不修改：生产 Mother、main R2 OS、Canonical Truth、现有公网发布、用户冻结与会议分工

## 一个 bounded question

同一派生 JSON 在本地与 CI 的字节数不同，但原数组保全、数值与浏览器检查分别通过时，可以声称哪些等价；又必须把哪些状态保持为 HOLD 或 Unknown？

## 现有真实失败 / Observation Roots

1. **Observation / R2 基线：**R2 已要求 evidence 与 claim 分离，N29 也已要求一个 artifact 的 role/path/mediaType/producerStep/bytes/digest 成为原子 tuple。本轮不重复 N29，而研究同一 JSON 内容在不同序列化路径下的身份层级。
2. **Observation / 固定生产对象：**Fish R008 精确测试对象为 [`60e2c6d054f2a74a33aa8bd530e365c021b24927`](https://github.com/haihao0307/guilin-dem-pipeline/commit/60e2c6d054f2a74a33aa8bd530e365c021b24927)，run [`35898899451`](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35898899451) 全部步骤 success。固定源码用 Python `json.dumps(..., ensure_ascii=False, separators=(',', ':'))` 直接序列化包含大量浮点样本的 `feature-evidence.json`；没有显式 canonical profile。
3. **Observation / 真实差异：**R008 回执记录本地两次及 Library 回读为 `151109 bytes / sha256:74a0264c...a2072`，CI JSON 为 `151122 bytes / git-blob:5b98a86c...fb88`。仅字节数已足以否定逐字节相同；两边摘要算法也不同，不能把 SHA-256 与 Git blob SHA 直接比较。
4. **Observation / 独立有效证据：**同一回执还记录 603 个原数组逐字节保全、源老师/候选数值比较、209 个时间样本及浏览器检查通过。这些证据不因派生 JSON 字节不一致而自动失效，但也不能反向证明两份 JSON 是同一语义对象。
5. **Observation / 未知：**N35 没有取得这两份历史 payload 的完整字节对，R008 也明确没有完整量化差异或确认原因。因此本轮将 `semanticObjectIdentity` 与 root cause 保持 Unknown，不根据 13-byte 差异猜测浮点、换行、属性顺序或运行库版本。

这些 Observation Roots 保持独立：源数组身份、派生文件原始字节、解析后的 JSON 对象、数值容差内行为、浏览器结果和用户验收不是同一种证据。

## 外部方法 / 一手证据

- [RFC 8259](https://www.rfc-editor.org/rfc/rfc8259)定义 JSON 语法与互操作边界；对象成员顺序对解析语义不可见，而数值实现的精度和范围可能不同。普通合法 JSON 并不天然拥有唯一字节表示。
- [ECMAScript `JSON.stringify`](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify)给出 JavaScript 的序列化算法；它是具体运行时的输出规则，不等于任意语言默认 JSON writer 都会逐字节相同。
- [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)为需要稳定 hashing/signing 的 JSON 规定 I-JSON 约束、ECMAScript primitive serialization、递归属性排序、无额外空白及 UTF-8 输出。它也要求拒绝 NaN/Infinity，且不会替应用定义单位、数组含义或数值容差。

可迁移方法不是“所有 JSON 都改用 JCS”，而是先声明 claim mode，再选择相应 oracle：原始字节身份、精确语义对象或有 schema/单位/容差的数值等价。

## 与 KAOPU 当前制度比较

### No-novelty

- N29 的 artifact descriptor 已正确阻止 bytes 与 digest 跨对象拼接；N35 不改该规则。
- R008 已诚实保留差异，没有伪称逐字节相同，也没有用这一差异否定独立数值/浏览器证据。
- RFC 8785 是可选 canonicalization 方法，不是自动采纳整套外部架构。

### 新缺口

- 当前 receipt 可以同时写 local SHA-256 与 CI Git blob SHA，却没有 `digestAlgorithm` 与同算法双边摘要，容易让读者误以为二者可直接比对。
- `JSON_VALID`、`BYTE_IDENTICAL`、`SEMANTIC_OBJECT_IDENTICAL` 与 `NUMERICALLY_EQUIVALENT_UNDER_POLICY` 尚未成为互斥的 named claims。
- 没有完整 payload pair 时，字节 mismatch 可以判定，但 semantic match 与原因不能判定。
- canonical digest 只能证明所声明 canonical profile 下的解析对象相同；数组顺序、单位、坐标、时间、schema 和容差仍需领域契约。
- 若只用 tolerance 比较科学数值，不能再把结果写成 byte identity 或 exact semantic identity。

## 可反驳假设

对下一次 Fish 派生证据 JSON，如果回执强制先选择一个 `claimMode`：

1. `EXACT_BYTES`：两份 payload 的 media type、bytes、同算法 digest 全部一致；
2. `EXACT_SEMANTIC_OBJECT`：保存两份原始 payload，固定 canonicalization profile/version，并比较 canonical digest；
3. `NUMERICAL_EQUIVALENCE`：固定 schema、字段路径、单位、数组顺序、NaN/Infinity 策略及逐字段容差，结果不得改名为前两种身份；
4. 同时保存 `rawDigestAlgorithm/rawDigest` 与 `canonicalDigestAlgorithm/canonicalDigest`，缺哪一项就只 HOLD 对应 claim，不抹掉独立通过的其他证据；

则会将 R008 正确判为 `HOLD_BYTE_IDENTITY_MISMATCH / UNKNOWN_SEMANTIC_OBJECT_IDENTITY`，同时保留其独立数值与浏览器证据；合成的仅属性顺序/空白或等价数值词法差异可通过 canonical comparison，而数组重排和真实数值变化会被拒绝。

## 最小历史回放

`derived_json_identity_gate_n35.mjs` 使用固定历史元数据和四组反证，得到 `12/12`：

1. R008 `151109 != 151122`，byte identity 正确 HOLD。
2. 缺历史 payload pair，semantic object identity 正确保持 Unknown。
3. 原数组、数值和浏览器的独立通过证据得到保留。
4. 属性顺序/空白不同：raw bytes 不同、probe-only canonical digest 相同。
5. `1e-6` 与 `0.000001`：raw bytes 不同、解析并 canonicalize 后相同。
6. 数组顺序反转：canonical digest 不同。
7. 数值从 `0.000001` 改为 `0.0000011`：canonical digest 不同。
8. byte 与 semantic claim 不可互换。

探针只实现本组 fixture 所需的 JCS-compatible subset，不冒充完整 RFC 8785 conformance suite，也不还原 R008 未取得的 payload。

## Current Best View / 是否采用

- **Candidate partial：**下一次 Fish 生成跨环境派生 JSON 时，可局部试验 `DERIVED-JSON-IDENTITY-LAYERS-001`；不修改全局 R2。
- **Current Best View：**R008 的 byte identity 为 `HOLD_BYTE_IDENTITY_MISMATCH`；semantic object identity 为 `UNKNOWN_PAYLOAD_PAIR_NOT_AVAILABLE`；其独立 numerical/browser evidence 可继续保留为已执行证据；root cause 为 Unknown。
- 候选回执字段：`testedSubjectSha`、`artifactRole`、`producerRuntime`、`claimMode`、`rawPayloadRef`、`rawBytes`、`rawDigestAlgorithm`、`rawDigest`、`canonicalizationProfile`、`canonicalizationVersion`、`canonicalDigestAlgorithm`、`canonicalDigest`、`schemaId`、`orderedArrayPaths`、`quantityUnits`、`numericTolerancePolicy`、`identityDecision`、`independentEvidencePreserved`。

## Rejected

- JSON 能 parse 就宣称逐字节可复现。
- 因字段值“看起来差不多”就宣称 semantic identity。
- 直接比较 SHA-256 与 Git blob SHA。
- 用 canonical digest 代替 schema、单位、数组顺序或 tolerance 契约。
- 没有取得两份 payload 就猜测 13-byte 差异的根因。
- 因派生文件身份未闭合，就删除已经独立执行的 source-array、numerical 或 browser evidence。
- 全局强制所有 JSON 立刻迁移到 JCS。

## 适用边界与 Unknown

- 候选只适用于身份承载、缓存、签名、跨环境回读或回归比较的派生 JSON；普通非身份日志不自动需要 canonical digest。
- JCS 依赖 I-JSON/IEEE-754 边界；高精度科学量、超范围整数或领域特定缺失值可能需要字符串编码或另一版本化格式。
- R008 两份 payload 的真实字段级差异、Python/库版本、locale、平台、完整 JCS 兼容性和唯一根因均为 Unknown。
- 真实下一次 Mother 实施、独立 verifier、制度 KPI、跨 Mother 适用性与用户验收均为 Unknown。
- 第一梯队专家 AI 未调用；本轮不是专家会。

