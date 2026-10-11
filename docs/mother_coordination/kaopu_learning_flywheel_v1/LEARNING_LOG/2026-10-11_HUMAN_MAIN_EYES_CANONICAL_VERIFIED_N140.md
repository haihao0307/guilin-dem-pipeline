# N140 — Human 自然眼球固定主入口激活与 live readback 验证

- 日期：2026-10-11
- Mother：Human
- 类型：制度验证 / canonical-entry freshness / exact-subject production readback
- Bounded question：已验证的自然眼球候选能否直接证明固定主入口已经更新，还是必须另有激活回执与 canonical live readback？
- 结论：候选通过本身不能证明主入口更新；本轮新增事实是独立激活回执、当前 gh-pages 主入口 blob 与 exact candidate 内容身份一致，且 live 主入口 14 项与 fresh one-click 5 项均通过。因此只提升到 scoped canonical activation verified，不提升视觉、眼睑闭合、全动作、真机或用户验收。
- 状态：`MAIN_EYES_R01_CANONICAL_ROOT_ACTIVATION_AND_LIVE_READBACK_VERIFIED_SCOPED__HOLD_VISUAL_EYELID_ALL_MOTION_PHYSICAL_DEVICE_USER_ACCEPTANCE`

## 1. 现有真实失败 / 新事实

PR #221 的候选收据明确写 `mainRootActivated=false`；因此即使 fixed-preview 通过，也只能证明候选，不得声称用户固定主入口已更新。

本轮观测到新的 canonical activation 证据：

- PR：#221
- candidate source：`ca1670d502246cfea01160d46cbc388bbc0cda30`
- immutable build：`f662a52e30b568eeec09e8d3f5b2e692cccc5ab5`
- candidate SHA256：`4e4c608b48da74eaec9feb88470515aa4384343540bb8a31f154b098f8bcd6e9`
- canonical URL：https://haihao0307.github.io/guilin-dem-pipeline/kaopu-unified-human-workbench/
- current gh-pages head：`10ae8355bc4c79709cdd28906efd2dde5d72b78b`
- canonical entry path：`kaopu-unified-human-workbench/index.html`
- observed canonical entry blob：`29568c9997ad91907339f0546dec57717529968f`
- activation receipt expected entry blob：`29568c9997ad91907339f0546dec57717529968f`
- live verification run：`38131463913`
- live main checks：14/14
- fresh one-click checks：5/5
- live artifact：`11700055599`
- live artifact digest：`sha256:93eee8286fdc1c184289af32eb34f4efc5475e8292014bb7b298d97f8d53fcf3`

一键复核还证明：左眼控制只改变左眼（6025 pixels），右眼为 0；完整 root archive 可恢复眼球设置；沿用同一 native vertex/topology identity；没有第二头模、没有 iframe 替代。

首次候选运行 `38130075720` 的最终 fixed-public main 步骤失败：测试在 HTMLPreview bootstrap 替换初始 document 之前统计入口。后续运行 `38131797961` 等待真实 app readiness 后通过，并保留了失败 artifact。这是新的失败机制，不是调整阈值后掩盖失败。

## 2. 外部方法 / 证据

GitHub Pages 将发布源与对外页面分开；GitHub Actions artifact 提供 digest，可用于把证据包绑定到具体运行：

- GitHub Pages publishing source：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- actions/upload-artifact（digest output）：https://github.com/actions/upload-artifact

外部方法只支持“发布源、运行、artifact 与 digest 要显式绑定”；它不能替代 KAOPU 对 canonical URL 的实际浏览器 readback，也不能证明视觉或用户接受。

## 3. 与 KAOPU 当前制度比较

R2、`TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE` 与 `CORRECTION-CANONICAL-ENTRY-001` 已要求：

1. candidate identity 与 current delivery identity 分离；
2. fixed entry 必须 promotion 后 readback；
3. build marker / content identity / correction invariants 必须匹配；
4. side path、commit 数量或截图数量不能当 canonical promotion；
5. public/browser/device/production/user acceptance 保持分层。

因此本轮为 `NO_NOVELTY_AT_OS_LEVEL`。不新增重复 case，只给既有 canonical-entry case 增加 Human 正面对照和 readiness-race 反例。

## 4. 可反驳假设

如果 canonical activation 必须把 exact tested bytes 绑定到固定入口并完成实际 readback，那么：

- 候选收据 `mainRootActivated=false` 时必须 HOLD；
- 独立 activation receipt 为 true，但 observed entry blob 不匹配时仍必须 HOLD；
- observed entry blob 与 receipt 完全匹配，且 live invariants 全通过时，才可写 `CORRECTION_PROMOTED_NOT_USER_ACCEPTED`。

未来任何 canonical entry blob 不匹配、live readback 失败或 correction invariant 失败，都会反驳当前 scoped pass 并重开 HOLD。

## 5. 最小历史回放

14/14 一致：

1. candidate source 已绑定；
2. immutable build 已绑定；
3. readiness 修正后的 fixed-preview candidate gate 通过；
4. candidate receipt 仍写 `mainRootActivated=false`；
5. activation receipt 另行写 `mainRootActivated=true`；
6. current gh-pages head 已重新观测；
7. canonical entry blob 与 activation receipt 一致；
8. canonical SHA256 与 exact candidate 一致；
9. live main 14/14；
10. fresh one-click 5/5；
11. 左眼控制没有串改右眼；
12. full root archive restore 通过；
13. native topology/vertex identity 保持，且无第二头模/iframe；
14. visual、eyelid、all-motion、physical-device、user acceptance HOLD 未被功能门覆盖。

## 6. 局部可执行对象

沿用 `CORRECTION-CANONICAL-ENTRY-001`。Human 下一次人物总入口改动必须在 Delivery Receipt 中同时记录：

- `candidateSubjectSha`、`candidateArtifactDigest`
- `candidateReceiptMainRootActivated`
- `activationReceiptMainRootActivated`
- `fixedEntryUrl`
- `expectedEntryBlobSha` 与 `observedEntryBlobSha`
- `candidateContentSha256` 与 canonical content digest
- `publicReadbackAt`、`browserRunId`
- correction-critical invariant results
- previous entry identity / rollback point
- 分层 holds 与 `userAcceptance`

浏览器 gate 必须等待实际 app readiness 信号；固定 sleep 或初始 document 元素计数不能作为应用已就绪的证据。失败 run 与 artifact 必须保留。

## 7. 适用边界

仅适用于 Human PR #221 自然眼球 r01 的固定人物总入口激活。本轮证明的是 exact canonical file identity 与 live functional invariants；不证明全部动作模式、解剖级眼睑闭合、视觉自然度、实体手机、production-ready 或 USER-ACCEPTED。

不修改生产 Mother 分支，不代替 Mother 实现资产，不降低门槛。

## 8. 是否采用

`UPDATE_EXISTING_REGRESSION_CASE_WITH_SCOPED_POSITIVE_CONTROL`

- POSTED=true（待 PR #221 路由回执）
- ACKNOWLEDGED=false
- IMPLEMENTED=true（canonical activation 已存在）
- GATE-RUN=true（N140 14/14）
- ADOPTED=false（无制度采纳回执）
- USER-ACCEPTED=false

## 9. 指标

- 首次候选通过率：false（run `38130075720` fixed-public main 步骤因 readiness race 失败）
- 用户纠错次数：0（本周期无新用户纠正）
- 同类错误复发率：0/1（修正 readiness 后一个后继 candidate run 未复发；样本仅 1）
- rejected lineage 继承次数：0
- stale delivery 次数：0（候选阶段没有误报 canonical activation）
- 每个 scoped canonical accepted delta 的内部迭代数：3 个观测到的 workflow runs（首次失败、candidate success、live activation verification）
- 用户指令到合法 candidate 时间：unknown
