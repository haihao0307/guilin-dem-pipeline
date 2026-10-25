# KAOPU Learning Flywheel N193 — Lace R05 tested-artifact lineage

日期：2026-10-25  
类型：制度问题 / 单一历史回放  
生产分支修改：无

## Bounded question

`guilin-dem-pipeline/main@44d55c64` 的 R05 standalone 能否直接继承包内 `R05_STATUS_20261025.md` 所指 CI run `40155952966` 的“source/UI/geometry passed”结论？

## Current Best View 与适用 regression

- R2 要求 Task Anchor、Delivery Receipt、独立 Verifier 与可追溯证据。
- N26 `CI-GREEN-SKIPPED-CLAIM-001`：workflow 的整体状态不能替代 named claim 的 required steps。
- N30 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001`：测试 subject、receipt、后继 delta 与 artifact identity 必须精确绑定；runtime/source delta 需要重测。

本轮不创建新 regression；只给 N30/N26 增加一个真实的正负组合回放。

## 观察

### 1. 发布字节完整性是真实的

- main R05 `index.html` Git blob：`bbbe82c3e01c71234d55d0cfad4db81800a5f1e9`。
- UTF-8 大小 `3,088,732` 字节，SHA-256 `ee0a4105e356dbdecba5266875f420932400655b3f689e8d13eadf1b285b7b6e`，均与 manifest 一致。
- 单文件内 9 个 base64 模块逐个解码后，SHA-256 全部与 manifest 一致。
- immutable preview branch `preview/lace-r05-standalone-74c30ab...` 的 `dist/r05/index.html` 与 main 发布文件具有同一 Git blob；manifest 也具有同一 Git blob `28d284ce...`。

因此这不是空壳、损坏复制或仅文档发布。

### 2. 包内“Latest CI evidence”指向了错误 subject

`R05_STATUS_20261025.md` 指向 run `40155952966`，其 head 为 `99f0c3a1...`。与发布 bundle 对比：

- `lace-core / lace-adapter / lace-fiber / lace-sampling` 相同；
- `app.js / lace-display.js / lace-observation.js` 不同；差异包含 transmission、backlight preset 和 plied-profile 后续实现。

所以该旧 run 不能单独验证当前 bundle；当前 receipt 应为 `HOLD_RECEIPT_SUBJECT_MISMATCH`，不能因为 run 的前置步骤通过就自动继承。

### 3. 精确血缘可以被重建，但交付物没有自带这个闭包

- 发布模块与 source head `74c30ab633d2994140182ed0bea4ff8ce09b3bb0` 完全一致。
- source head `5eac92cd12746fda4085cc20b2376d8f1ce82cf6` 到 `74c30ab...` 的非诊断源码 delta 为零；后继仅改 workflow 与由 native visual run 生成的诊断 evidence。
- exact-source validation run `40161517642`：success。
- exact-source native EGL A/B run `40161517650`：success。
- exact snapshot run `40161697533`：结构、显示/采样、standalone rebuild、immutable preview snapshot 均 success；required artifact upload 因 quota failure。
- immutable preview 与 main 发布文件 Git blob 完全相同。

因此经过独立重建后：

- `PUBLISHED_BYTES_INTEGRITY = CLAIM_VERIFIED`
- `SOURCE_UI_GEOMETRY = CLAIM_VERIFIED_SCOPED`
- `NATIVE_EGL_AB = CLAIM_VERIFIED_SCOPED`
- `REQUIRED_ACTIONS_ARTIFACT_UPLOAD = FAILED_QUOTA`
- `PUBLIC_BROWSER_RUNTIME = HOLD_PUBLIC_BROWSER_NOT_TESTED`
- `TARGET_GPU_PERFORMANCE = HOLD_TARGET_GPU_NOT_TESTED`
- `VISUAL_ACCEPTANCE / USER_ACCEPTED / PRODUCTION_READY = false`

artifact quota failure不抹掉已经独立闭合的 source/build atoms；同样，immutable preview 成功也不能替代 public browser 或 target GPU gate。

## 最小可执行增量

不改 R2；只要求 Lace Mother 下一份 manifest/receipt 自带以下字段，使上述人工重建变成机器闭包：

`sourceRepository / sourceCommit / sourceValidationRun / nativeEvidenceRun / buildSnapshotRun / previewBranch / previewIndexGitBlob / publishedRepository / publishedCommit / publishedIndexGitBlob / artifactUploadState / publicBrowserState / targetGpuState`。

其中 `sourceValidationRun` 必须与 `sourceCommit` 精确绑定；若只测试祖先，则后继 changed paths 必须全部落在显式 metadata/diagnostic allowlist。旧的 `R05_STATUS` 可保留历史，但不能再标为当前 `Latest CI evidence`。

## 历史回放

5/5 fixtures 命中预期：旧 run subject mismatch、精确 source/artifact 正控、browser 未测、target GPU 未测、测试后 runtime delta。

## 外部老师

`NO_NOVELTY`。这是现有 N30/N26 的生产实例，不需要新增 teacher、registry 或全局门禁。

## Lifecycle

本记录与 probe：`GATE-RUN`。定向反馈发布后记 `POSTED`；在真实 Mother 回执前，`ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED = false`。
