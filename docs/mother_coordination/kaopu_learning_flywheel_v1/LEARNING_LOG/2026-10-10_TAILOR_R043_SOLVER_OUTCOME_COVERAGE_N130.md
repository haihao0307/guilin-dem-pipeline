# N130 · Tailor R04.3 全 60 款求解结果覆盖回放

## 单一 bounded question

R04.3 是否已把“当前 PR 上只有源码/报告、不能继承旧 GATE-RUN”的 WIP，推进为精确运行绑定的 60 款真实求解结果覆盖，同时仍拒绝把静态失败、参数控件和搭配浏览器读回冒充成衣/物理/用户验收？

## 现有真实失败

R04.2 只有 45 个求解结果，另有 15 个显式失败；R04.3 初始报告虽写入 60 材料、58 结果、122 参数与 432 搭配，但当时没有完成精确 push-run / artifact 归因。若只看文件数、截图数或错误过滤的空查询，容易把 WIP 或旧结果当成新 GATE-RUN。

## 外部方法 / 证据

- GitHub Actions workflow-runs API 将运行绑定到 `event`、`path`、`head_sha` 和 conclusion：https://docs.github.com/en/rest/actions/workflow-runs
- GitHub Actions artifacts API 将产物绑定到具体 run，并提供 artifact digest：https://docs.github.com/en/rest/actions/artifacts
- GitHub 关于 artifact attestations 的说明强调产物来源与工作流身份可核验：https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/establishing-provenance-for-builds

## 与 KAOPU R2 比较

`NO_NOVELTY`。R2 的精确 tested subject、Task Freshness、no stale delivery、claim scope 和 N75 的负证据查询范围规则已经要求这类绑定。本轮只是用覆盖 push 事件的原生 Actions 查询纠正先前 PR-only 查询的盲区，并验证 Tailor 是否真正执行。

## 可反驳假设

若精确 head `405e711…` 的 push workflow：
1. 所有 claim-critical steps 成功；
2. 有 run-bound artifact ID/digest；
3. 保留提交 `9c4dbe4…` 中的报告回指该测试主体；
4. 60 原纸样均有 native material 和实际 solver record；
5. 原通过记录、来源纸样、rest UV、seam pairs 和质量阈值不变；

则可 scoped 通过“60 款求解结果覆盖”。任一静态失败、参数 fit 未认证、搭配 joint-physics 未认证或用户未接受，仍必须 HOLD。

## 最小回放

16/16 通过：

- exact push run [38033528214](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/38033528214) 绑定 workflow `.github/workflows/tailor-r043-material-correction.yml` 与 head `405e711d6e0347ca0a1df7f2593ded0c6f1af683`；
- job `114159166177` 成功，编译/合同、51 款重算、真实浏览器、保留精确结果及 artifact 步骤均 success；
- artifact `11664035935`，digest `sha256:3a7a2c9803541384a82d47f3e0b1508abd3f5976d966dbd4176b0fb7d7a4138c`；
- retained evidence head `9c4dbe48e3dca1ae46d80f286697d28f1a5b9bfd`；
- 60 原纸样、60 native material、0 material reject、60 actual solver records；
- static gate 11 pass / 49 fail；新增 pass 仅 T13、T14；
- 先前 9 个 pass 的 result SHA 全保留；
- 77 个受保护文件未变；source paper archive、rest UV、triangle indexing、seam pairs、body vertices 和质量阈值未变；
- 76 个浏览器检查通过，HTTP/浏览器错误 0；
- 432 个搭配 identity/readback 通过，但不认证 joint cloth collision；
- 122 个参数仅证明 source-geometry control，其中 35 个需显式激活；`allAlteredGarmentsFitCertified=false`；
- 参数报告的 `sourceCommit=d449629…` 不能解析为仓库 commit，因此不把该字段单独当 Git subject；参数证据只经精确 workflow artifact 限定为 source-control 证据；
- `all60GarmentsAccepted=false`、`fabricBendingCalibrated=false`、`continuousCollisionCertified=false`、`dynamicWearCertified=false`；
- 无 R04.3 公网发布/真机/用户接受回执。

## 适用边界

只适用于 R04.3 精确测试主体的“60 款真实求解结果均存在”和来源/门槛保护。它不等于 49 个静态失败已经修好，也不证明全部画面符合用户视觉要求、122 参数变体均合身、432 搭配具备联合布料物理、跨人物量体、动态穿着、公网交付或用户接受。

## 决定

`R043_ALL60_SOLVER_OUTCOMES_VERIFIED_SCOPED__HOLD_49_STATIC_FAILURES_VISUAL_PHYSICS_USER_ACCEPTANCE`

更新既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，不重复造 case，不修改 Tailor 生产分支、main、R2 或任何门槛。

生命周期（路由前）：ACKNOWLEDGED / IMPLEMENTED / GATE-RUN=true；POSTED / ADOPTED / USER-ACCEPTED=false。

## 路由回执

- PR #181 comment: https://github.com/haihao0307/guilin-dem-pipeline/pull/181#issuecomment-6095270634
- 生命周期：POSTED / ACKNOWLEDGED / IMPLEMENTED / GATE-RUN=true；ADOPTED / USER-ACCEPTED=false。
