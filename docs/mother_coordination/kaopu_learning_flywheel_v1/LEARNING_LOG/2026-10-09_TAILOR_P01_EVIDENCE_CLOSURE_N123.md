# N123 — Tailor P01 数量完成不得替代浏览器几何与公网交付闭环

Date: 2026-10-09 11:38 +08:00  
Status: **new production counterexample / no-novelty / existing tested-subject and failure-lineage regressions updated**  
Scope: Tailor P01 纸样库；不修改 Tailor 生产分支、`main`、`gh-pages`、R2 或门槛

## Bounded question

P01 当前 60 套纸样能否在保留失败谱系的同时，以精确 tested SHA 完成“本地浏览器 → 发布 → 公网浏览器”闭环？

## 现有真实失败

基线读取：`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；根 `AGENTS.md`、R2、reference gate、freshness gate 均未变化。#91 最新真实反馈仍为 N75 的查询范围纠正（comment `5979603278`）；#63 最新真实反馈仍为 N49（comment `5910449798`）。适用 case 为 `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001`、`SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001` 与 `FINAL-CLAIM-CLOSURE-001`。

P01 把“60 套”定义为 60 个 authored design recipe（18 tops、10 pants、14 skirts、12 dresses、6 jumpsuits），不是 60 个新拓扑；同时明确 `allParametersMastered=false`、`physicalFitAccepted=false`、`dynamicWearCertified=false`。因此数量、文档或截图本身不能证明物理合身、动态试穿或公网交付。

本轮核对三次 run：

1. [run 37877021198](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37877021198) 在 `4a96d7bef1b4b80f495ba2417845d55f6966b691` 成功，但 scope 只到 native build；artifact `11592852195` / `sha256:5f8ffe20e35dddfbf475791566d3b5c095ba27d0a5c8e880bf29a2fbc0702613` 不能替代本地浏览器或公网证据。
2. [run 37878896327](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37878896327) 在精确 head `3463c654def88fed4cad8315fd7d7b36b6d06d87` 失败。native 60/60、浏览器 60 张卡与 60 个 distinct source paper geometries 已过，但 Python `1.0` 与 JavaScript `1` 的序列化差异触发 `patternRecipeHash` 不等。artifact `11593617373` / `sha256:88e0f2f24c9403237c0cabf9d8e1701890dad523422afbace1432099227fdb54`；失败检查点已保留在后续分支历史。
3. 修复比较方式后的 [run 37880361490](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37880361490) 绑定精确 head `7e21a019512adfda29fd5d457fdf03c94563a0f9`，仍失败。native generation、metadata、numeric JSON transport、全字段 probe 与依赖安装均 success；浏览器在失败前完成 74 项检查，包括 60 张实际卡片、60 个 source geometry、分类/搜索、缝线高亮、缩放、122 字段可读与导出。随后 cached native paper 与当前输入在浏览器重生成的 paper 出现 `0.06899010856065502 mm` 顶点误差，超过 `0.001 mm` 门槛，得到 `LOCAL_BROWSER_REGENERATED_PAPER_GEOMETRY_MISMATCH`。artifact `11594128833` / `sha256:c3862b9b473b257b016fae7be1c66513ad1c656d0cdc153c4f444eb28e021460`。

第三次 run 的 source-lock、retain、publish、public-byte 与 public-browser 步骤全部 skipped；当前证据不能声称 P01 已发布或公网可用。numeric transport 独立步骤已经通过，所以 `0.06899010856065502 mm` 偏差的根因仍为 `unknown`，不能继续归因于上一轮的数字序列化问题。

另有一个局部触发盲点：workflow 的 `push.paths` 只列 workflow 自身与当前树中不存在的 `BUILD_TRIGGER.json`；普通 P01 runtime/source 变化不会自动触发该 workflow。本轮只记录事实，不扩张为新全局 gate。

## 外部方法 / 证据

- GitHub 官方 [Workflow syntax — paths](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onpushpull_requestpull_request_targetpathspaths-ignore) 说明 path filter 按 changed files 判定，只有匹配时 workflow 才运行；因此未覆盖 runtime/source 的过滤器会留下未测试变更的触发盲区。
- GitHub 官方 [Store and share data with workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data) 说明 artifact 用于持久化 workflow 产生的 build/test 结果；本轮用 run/head/artifact digest 固定两次失败，而不是用可变分支头替代。

外部证据只支持“触发范围与证据持久化”的工程方法；KAOPU 的 HOLD、精确 subject 与失败谱系语义仍来自现有 R2 和 regression cases。

## 与 KAOPU 当前制度比较

现有制度已覆盖：

- `TESTED-SUBJECT-NOT-MUTABLE-HEAD-001`：任何 runtime/source/workflow/public delta 都需新测试；可变 head 不能继承 tested。
- `SUCCESS-MUST-NOT-ERASE-FAILED-ATTEMPTS-001`：后续修复或成功不得抹去较早失败及其 artifact。
- `FINAL-CLAIM-CLOSURE-001`：本地关键门失败且发布/公网证据缺席时必须 fail closed。

因此结论为 `NO_NOVELTY_EXISTING_EVIDENCE_CLOSURE_CASES_APPLY`。本轮把 Tailor 的真实两次失败补入既有 cases，不创建重复 regression case，也不修改全局 OS。

## 可反驳假设

若“60 套 authored/native 成功”“当前输入的浏览器重生成几何等价”“精确 bytes 发布”“公网浏览器可用”被拆成顺序且不可替代的证据层，则：

1. native 60/60 与 UI 60 卡可以确认枚举范围，但不能晋升到 public delivery；
2. 浏览器重生成与 native cached paper 任一几何误差超过 `0.001 mm`，必须得到 `HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED`；
3. 发布或公网步骤 skipped，必须得到 `HOLD_CLAIM_CRITICAL_EVIDENCE_INCOMPLETE`；
4. 修复后的 descendant 若包含非 metadata delta 且未新测，必须得到 `HOLD_UNTESTED_NONMETADATA_DELTA`；
5. 只有精确 tested SHA 上本地几何、发布 bytes 与公网浏览器全部通过，合成正控才允许 `PUBLIC_PAPER_PRESET_LIBRARY_VERIFIED_SCOPED`。

## 最小历史回放

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/tailor_p01_evidence_closure_n123.mjs`

结果 `10/10`：真实终态保持 `HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED`；回放拒绝 native/UI 数量替代、缺失失败谱系、未执行发布/公网步骤和未重测 descendant；只有合成的全关键层通过控制组得到 scoped public pass。结果保存于 `PROBES/tailor_p01_evidence_closure_result_n123.json`。

## 适用边界 / 是否采用

- 决定：`HOLD_LOCAL_BROWSER_GEOMETRY_PARITY_FAILED`。
- Causal state：`NATIVE_PRESET_ENUMERATION_PASSED_BROWSER_REGEN_GEOMETRY_MISMATCH_PUBLICATION_SKIPPED`。
- 已证明：60 个 authored recipe 可由 native 流程生成并在本地 Chromium headless 1440×1000 枚举；最新 run 的 numeric transport 独立检查通过；两次失败 artifact 均可审计。
- 未证明：浏览器重生成几何等价、P01 发布、公网浏览器、真实物理设备、物理合身、动态试穿、用户接受。`0.06899010856065502 mm` 偏差根因 `unknown`。
- 不扩大：不否定 Tailor 其他独立单元，不把 P01 60 个 design combination 误写成 60 个新拓扑，也不把数量或文档当进展终态。
- 局部候选：Tailor verifier 保持现有 `0.001 mm` 几何门；修复后须由包含 runtime/source 的明确触发或手动 dispatch 在精确新 SHA 重跑完整本地→发布→公网链。当前只做历史回放，没有修改生产 workflow 或资产。
- 生命周期：`POSTED=false`、`ACKNOWLEDGED=false`、`IMPLEMENTED=true`（Tailor 已实现 P01 candidate）、`GATE-RUN=true`、`ADOPTED=false`、`USER-ACCEPTED=false`。
- KPI：首次候选通过率、用户纠错次数、同类错误复发率、rejected lineage、stale delivery、accepted delta 内部迭代、合法 candidate 时间均 `unknown`；仅记录两次可识别失败，不外推 KPI。
- 第一梯队外部 AI：未调用。
