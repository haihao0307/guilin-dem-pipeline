# Current Best View N35 — Derived JSON identity layers

状态：Candidate partial；Fish R008 历史回放与合成反证 `12/12`，未实施、未全局采用。

1. 普通合法 JSON 没有天然唯一字节表示；parse success、byte identity、semantic object identity 与 numerical equivalence 必须分账。
2. R008 本地 `151109 bytes` 与 CI `151122 bytes` 已足以拒绝 byte identity；SHA-256 与 Git blob SHA 算法不同，不能直接比较。
3. 未取得两份历史 payload，因此 semantic object identity 和差异根因保持 Unknown；不根据 13-byte 差异猜测。
4. 原数组保全、数值比较与浏览器检查是独立证据，可继续保留，但不能反向证明派生 JSON 等价。
5. 下一次 Fish 派生 JSON 只建议局部试验显式 `claimMode`：exact bytes、exact semantic object 或 schema-bound numerical equivalence；每种 claim 使用不同 oracle。
6. RFC 8785 可提供稳定 canonical representation，但不能代替 schema、单位、数组顺序、精度/容差和领域 Unknown 契约。

Unknown：R008 真实字段级差异、完整 payload pair、唯一根因、真实 Mother 实施、独立 verifier、制度 KPI、跨 Mother 适用性与用户验收。

