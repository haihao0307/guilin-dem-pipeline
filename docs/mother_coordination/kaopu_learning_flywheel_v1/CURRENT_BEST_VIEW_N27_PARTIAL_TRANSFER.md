# Current Best View N27 — Partial transfer atomic promotion

Status: **Candidate partial; history replay verified; not adopted**

1. 分块提交是 `STAGING_QUARANTINE`，不是 artifact，也不是完成证据。
2. `SOURCE_TRANSFER_VERIFIED` 必须同时满足：完整有序清单、逐块严格解码、逐块 size/digest、最终重组 size/digest、stage marker 清除。
3. 只有重组后的 verified object 可成为发布输入或下一版父节点；chunk、manifest、目标 SHA 文本本身均 `parentEligible=false`。
4. `SOURCE_TRANSFER_VERIFIED` 只证明 exact-byte transfer，不提升为 browser/device/publication/user acceptance。
5. 当前 Stone Money 固定历史因两个 chunk 含字面量 truncation/ellipsization marker，状态为 `HOLD_SOURCE_INCOMPLETE_OR_CORRUPT`。
6. 不修改 R2 全局制度；先做一次 Stone Money 局部 Producer/Verifier 分权试验。

Frozen: production Mother branches, R2 OS, Canonical Truth, publication state.  
Unknown: implementation, independent verifier run, adoption, KPI impact, user acceptance.
