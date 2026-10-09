# N126 — Tailor R03 已脱离 primitive proxy，但逐成员派生回执仍未闭合

Date: 2026-10-09 17:38 +08:00  
Status: **existing N124 regression updated with R03 boundary result / Tailor-only / not adopted**  
Scope: PR #181 三维电子橱柜；不修改 Tailor 生产分支、`main`、`gh-pages`、R2 或现行阈值

## Bounded question

PR #181 的 R03.4 是否已经消除 N125 的“R02 简化 primitive 代理服装”失败，并满足 N124 的 60 个 preset-specific 三维成衣缩略图逐成员回执门？

## 现有真实失败与新候选

`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b` 的根 `AGENTS.md`、R2、reference gate、freshness gate 未发生变化。#91 最新真实反馈仍是 N75 query-scope correction（comment `5979603278`），#63 最新真实反馈仍是 N49 Coast public-browser hold（comment `5910449798`）。

N125 在 PR #180 comment `6076748889` 路由后，Tailor 新建 Draft PR #181：

- base `a9148f6860b9fa9f892b97456f4601c34ea95e04`，head `5078d8aa9487b1b2c37d67701737ff963c7bd3cd`；
- 固定运行源码 `ae2332f583e1bd756ea0083088796c327854e05b`；
- candidate run `37908255289`、public run `37909309435`、Pages run `37909744414` 均成功；
- public artifact `11605879723` 的 GitHub digest 为 `sha256:b07e738f402536b5b35aa57d4cb0e0b5a6b43a4739e468da0787ecd80b229092`；
- `PUBLIC_REPORT.json` 为 21/21，通过 60 张原设计缩略图、60 个不同 geometry signature、492 个总显示几何、432 个来源搭配和主要交互；`RELEASE_STATE.json` 记录 90 个公网路径检查与 `publicVerified=true`。

## 实现比较

R03.4 相对 N125 有实质变化，不能继续标成 R02 primitive substitute：

- `prepare_assets.py` 逐份读取 60 个 `paperAsset`，校验 `recipeHash`，把纸样 `design` 展平成 row values，并保存 `sourcePaperSHA256`；
- `garment-surfaces.mjs` / `anatomical-cloth.mjs` 读取这些 row values，生成连续裁切衣壳、开口边厚度、腰头、袖口、领帽、裙片等显示表面；
- `PUBLIC_REPORT` 的 J06 runtime 明示 `closedPrimitiveGarments=false`，服装 metrics 为 22,739 vertices / 36,856 triangles / 2 connected shells；
- 原 Anny 展示模特为 13,718 顶点、27,420 三角形；未缩放或覆盖原人体；
- 因此 N125 的 `REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT` 不适用于 R03.4 的显示表面层。

但 N124 的逐成员身份门还没有闭合：

- `PUBLIC_REPORT.geometry` 每个原设计只有 `id / vertices / triangles / geometrySignature`；
- `catalogue.json` 另有 `sourcePaperSHA256 / recipeHash / geometryHash / values`；
- thumbnail SHA256 在 QA 运行时计算，但未作为逐成员字段保存；
- mannequin identity、camera/render config identity 和 public card readback 也只有聚合状态，没有与同一个 preset 成员形成不可变 join；
- renderer 消费的是纸样中的设计参数，不是原裁片顶点/缝边或已缝成衣几何。这个事实不否定展示表面，但禁止把它提升为物理制版/缝合证明。

因此正确状态是：

- `RECIPE_LINKED_CONTINUOUS_SURFACE_CABINET_PUBLIC_VERIFIED_SCOPED`：成立；
- `REJECTED_CREATIVE_SUBSTITUTE_SIMPLIFIED_PROXY_GARMENT`：对 R03.4 不成立；
- `THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED`：仍未成立；
- 当前决定：`HOLD_THREE_D_THUMBNAIL_IDENTITY_INCOMPLETE`。

## 外部方法 / 与现行制度比较

本轮没有发现新的全局制度。N124 已把 NIST/NASA 的 requirement-to-design/code/test traceability 转为逐成员 receipt；N125 又用 PR #180 证明 WebGL、60/60 和公网绿色仍不足以替代 actual object identity。R03.4 的新事实只是把真实候选从“primitive proxy reject”推进到“recipe-linked implementation, receipt join incomplete”。因此只更新原 Tailor-only regression，不修改 R2 或全局门禁。

## 可反驳假设与最小回放

若现有逐成员门正确，则：

1. R03.4 的 recipe-linked continuous surfaces 应解除 primitive-proxy rejection；
2. 60 个不同 geometry signature 与 60 张不同图片仍不能替代完整成员 receipt；
3. 当且仅当 60 个原 preset 各自联结 `presetId → design/paper → garment geometry → mannequin → render config → thumbnail digest → card readback` 时，才得到 scoped pass；
4. scoped pass 仍不认证布料物理、真机或用户接受。

执行：

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/tailor_r03_recipe_linked_surface_receipt_gate_n126.mjs`

结果 `12/12`。真实 PR #181 得到 `HOLD_THREE_D_THUMBNAIL_IDENTITY_INCOMPLETE`；完整 60 行合成 receipt 负控得到 `THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED`。

## 适用边界 / 是否采用

- 决定：更新既有 Tailor-only Candidate；`no-new-global-rule`，不改全局 OS。
- 保留：R03.4 的 recipe-linked continuous garment display、60 个不同几何签名、432 搭配、21 个公网浏览器检查、90 个公网路径检查。
- 下一最小动作：生成并验证 60 行 `THUMBNAIL_RECEIPTS.json` 或等价对象，把现有分散证据做逐成员不可变 join；无需重做已有几何。
- 明确边界：`physicalFitAccepted=false`、`dynamicWearCertified=false`、真机测试=false、`USER-ACCEPTED=false`。
- 路由：PR #181 comment `6078454193`；所以 `POSTED=true`。目前没有 Mother 回执，`ACKNOWLEDGED=false`；R03.4 生产实现与其公开门已运行，所以 `IMPLEMENTED=true`、`GATE-RUN=true`；`ADOPTED=false`、`USER-ACCEPTED=false`。
- KPI：相对 N125，rejected primitive lineage 继承次数为 0（R03 新建独立 surface implementation，R02 目录保持不变）；首次候选通过率、用户纠错次数、每个 accepted delta 的内部迭代数、从指令到合法 candidate 时间仍为 `unknown`。
- 第一梯队外部 AI：未调用。
