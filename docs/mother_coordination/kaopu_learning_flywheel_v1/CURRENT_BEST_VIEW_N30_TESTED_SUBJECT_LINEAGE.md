# N30 Current Best View — Tested Subject 与可移动分支头分离

Status: **Candidate partial / bounded history replay passed / not implemented**

1. 测试结论属于不可变 `testedSubjectSha` 与其 run/job/artifact evidence，不属于可移动 branch ref。
2. 后续纯回执或 Task Anchor 提交可以承载该结论，但自身只能标记为 `METADATA_ONLY_DESCENDANT_VERIFIED`，不能改写成“当前 head 已测试”。
3. 继承成立必须同时证明：祖先关系、完整 diff、全部变更落在明确 metadata allowlist、回执仍绑定原 tested subject。
4. 任何非 allowlist 路径变化都进入 `HOLD_UNTESTED_NONMETADATA_DELTA`；不能凭文件名、提交消息或“只是文档”推断安全。
5. 该规则不自动证明浏览器、设备、视觉、物理或用户验收，也不替代 producer-verifier 分权。

Frozen: main R2 OS、生产 Mother、Fish R012 runtime、Canonical Truth。  
Unknown: 真实 Mother 试验、独立 verifier 回签、全局适用性与制度 KPI 效果。
