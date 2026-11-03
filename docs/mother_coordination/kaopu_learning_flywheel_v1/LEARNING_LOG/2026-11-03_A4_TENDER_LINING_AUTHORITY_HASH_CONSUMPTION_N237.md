# KAOPU Learning Flywheel N237 — A4 tender lining authority identity consumption

## Bounded question

`A4_ORIGINAL_TENDER_RIVETS_LINING_INSTALLED_R01.zip` 的实际 lining binding gate，是否会在接受 material-only lining 前消费并核对所声明的 Mother module、parameters、freeze 与 current-wall authority 身份？

## Subject and pristine integrity

- Library: `libfile_60449235147c8191bfae85587f32ac35`
- ZIP SHA-256: `760ead29eb000d79631c5e9db9518f3c3c38acb5be6707dfa85c1b03a0867a70`
- `ENTRY_SHA_MANIFEST.json`: `1289/1289` match
- `WALL_AUTHORITY_BINDING.json` 声明的三项 wall 依赖均随包交付，交付字节的 SHA 与声明逐项一致。

## Exact failure mechanism

安装后的实际消费者是 `original-function-assembly-r01/lining-binding.mjs::validateLiningBinding`。它会核对 component/view、shader、`authority.GLSLSHA256`、uniform、scope、side 与 material-only 语义；但不会核对：

- `authority.moduleSHA256`
- `authority.parametersSHA256`
- `authority.freezeSHA256`
- `native/WALL_AUTHORITY_BINDING.json` 中三项 current-wall dependency SHA

因此“包内有证据”和“执行门实际消费证据”不是一回事。

## Minimal falsifiable replay

正控：原 binding 经同一 `validateLiningBinding` 通过。

负控：仅把三项声明哈希替换为格式正确但确定错误的 `00… / 11… / 22…`，同时重新计算外层 `liningBindingSHA256`，模拟一个自洽但内部 authority 身份错误的 binding receipt。外层 binding hash 检查通过后，实际 validator 仍返回成功，进程 exit `0`：

`ACCEPTED_WRONG_DECLARED_AUTHORITY_HASHES`

这说明 outer receipt hash 只能证明“这份 receipt 没再变”，不能证明 receipt 内声称的 transitive authority byte identities 是真的。

## Decision

`HOLD_A4_TENDER_LINING_DECLARED_AUTHORITY_IDENTITY_NOT_FAIL_CLOSED`

边界：不否定 pristine 包的 1289/1289 完整性，不否定 lining mask、shader、wall 依赖字节或 source interpretation；本轮只阻止“actual execution gate 已绑定 declared Mother/current-wall authority”这一层声明。未验证 browser/device/production/Mother/user acceptance。

包内 `ui-protocol.test.mjs` 的 pristine 运行当前另有 draw-count 断言 `actual 0 / expected 673`，因此本轮没有拿它冒充 full-runtime 正控；结论严格限于实际安装的 binding consumer。

## Regression routing

不新建同类 case；扩展 `CANDIDATE_EXECUTABLE_RESOURCE_CLOSURE_001`：所有支持 current-binding claim 的 authority hash，都必须由实际 pre-use verifier 从交付或 exact-materialized bytes 重新计算并比较。仅存在 hash-shaped metadata，或只核对外层 receipt hash，不足以建立 transitive authority identity。

Candidate fields:

- Task Anchor: `declaredAuthorityResources`, `authorityIdentityConsumer`
- Delivery Receipt: `authorityHashesCheckedBeforeUse`, `authorityHashMismatchCount`
- fail-closed state: `HOLD_DECLARED_AUTHORITY_IDENTITY_NOT_CONSUMED`

Lifecycle: `POSTED / Candidate IMPLEMENTED / GATE-RUN`; `ACKNOWLEDGED / production IMPLEMENTED / ADOPTED / USER-ACCEPTED = false`.\n\nPOST receipt: `haihao0307/guilin-dem-pipeline#91 comment 6598178220`.
