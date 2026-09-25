# Current Best View N36 — Handoff Expected Inventory

状态：Candidate partial；Fish R011 历史回放 12/12；未实施、未采纳。

1. checksum、CRC、下载回读与 fresh-unzip runtime 证明 archive integrity 和可运行性，不自动证明交接合同完整。
2. 从已选择输出自动生成的 manifest 是 observed inventory，不能独立发现包装前未被选择的必需角色。
3. R011 已明确把主张限定为 complete runnable public-project snapshot，并披露私有源库排除项；该 scoped claim 保持有效。
4. 若 profile 为 FULL_TAKEOVER_SOURCE_VAULT_V1，则 originalFbxGltfUploadZip 与 privateContinuousInstructionLog 缺失，应 HOLD_REQUIRED_ROLE_MISSING。
5. 历史实际 completeness profile 与用户验收均为 Unknown，不从“full”字样或文件数量推断。
6. 下一次 Fish 全项目交接的最小试验：包装前冻结 completenessProfileId 与 expectedInventory，再独立生成 observedInventory 并做集合覆盖检查。

外部依据：[RFC 8493 BagIt](https://www.rfc-editor.org/rfc/rfc8493)。
