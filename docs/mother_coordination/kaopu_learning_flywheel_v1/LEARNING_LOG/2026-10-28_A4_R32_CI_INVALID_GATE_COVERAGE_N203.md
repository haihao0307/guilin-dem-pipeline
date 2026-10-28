# KAOPU Learning Flywheel N203 — A4 R32 绿 CI 是否覆盖 invalid-sample 门禁

日期：2026-10-28  
类型：制度问题 / bounded historical replay  
状态：`OBSERVATION + CANDIDATE`  
生产修改：无

## 1. Bounded question

`trial/a4-r32-normal-chrome-20261027@580acd1c8b851d0c843826e2b49c7079411473bd` 的成功 workflow，是否已经验证 N200/N201/N202 所要求的 invalid-sample 状态、梯度有限性与可见帧前阻断？

## 2. 新来源事实

- 精确 subject 存在 workflow run `40484446930`，job `122122608252`，结论 `success`。
- check-run 名为 `verify-r32`；workflow 为 `.github/workflows/a4-r32-whole-function.yml`（blob `d83f9415ee336be7338c59101bce8a3034b6517d`）。
- artifact `12724761571` 绑定同一 head SHA，digest 为 `sha256:99aa6309741366a3d4bee7cdc9bbca41c4750ff4625c236565afd1655bf0b9bc`，未过期。
- workflow 的浏览器步骤在正常 sandbox Chrome 中运行，断言整帧完成、`frameValid`、无错误、`glError=0`、draw 数、非背景像素、颜色数、交互与 context-loss 恢复。

这纠正 N201 中“没有 CI/status 回执”的过宽表述：REST commit status 集合为空，但 check-run 与 workflow run 确实存在并成功。两者不能混称。

## 3. 覆盖缺口

成功测试没有断言：

- per-sample `invalidReason`；
- `INVALID_NONFINITE / INVALID_GRADIENT / UNCONVERGED_RESIDUAL` 计数；
- 零或非有限梯度不得进入 normalize；
- 可见帧提交前 `invalidCount=0`；
- 冻结输入下的多帧状态哈希稳定。

`boiler-probe-capture.cjs` 的 scalar probe 能看单点 `isnan/isinf`，但它是 `diagnostic_only=true / whole_frame_accepted=false`，没有进入 per-ray 状态或 visible-commit gate。`test-gpu-interval-runtime.cjs` 自述只验证显式 GL facade，`not browser/GPU pixels`。

## 4. 可反驳假设与最小回放

假设：`现有 CI 的宏观整帧谓词可在存在少量 hidden-invalid samples 时仍全部为真，因此 success 不能证明 N200/N202 门禁通过。`

合成负控保留 `done/frameValid/no-error/703 draws/>1000 non-background/>20 colors`，同时注入 37 个 invalid samples。现有 gate 接受；加入 `invalidCount=0 + reason histogram=0 + frozen-state-stable` 后拒绝。回放 8/8 PASS。

这证明的是谓词不足，不证明历史 artifact 实际含黑点，也不证明用户设备根因。

## 5. Candidate 制度增量

只在 A4 下一次相关 run 的 Delivery Receipt / verifier 中试用：

- `testedSubjectSHA`
- `checkTransport = commit_status | check_run | workflow_run`
- `coveredGateIds`
- `unsupportedGateIds`
- `invalidReasonHistogram`
- `invalidCountBeforeVisibleCommit`
- `frozenInputStateHashSeries`

只有 `invalidCountBeforeVisibleCommit=0` 且冻结输入状态稳定，才可把 N200 regression 记为 `GATE-RUN PASS`。普通 workflow success 继续保留为 `CLAIM_VERIFIED_SCOPED`，不得升级为黑点已修复。

## 6. Regression / teacher / routing

- 复用 `FUNCTION-SURFACE-INVALID-SAMPLE-FLICKER-001`，只更新证据，不新增 case。
- 外部老师：`NO_NOVELTY`；本轮无需新老师。
- 路由对象：A4 FunctionRendering / #91。
- 生命周期：`POSTED` 后仍需 Mother 真实回执；当前不得写 `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED`。

## 7. 边界

- 未打开 artifact zip 内的像素/JSON 字节；只核对 workflow、测试源码、run/job/check/artifact metadata。
- 未运行公网浏览器、目标 GPU、production publication 或用户验收。
- 未修改 main、R2、生产 Mother、A4 trial 分支或全局门禁。

## 8. Routing receipt

- #91 comment: `6460123039`
- URL: https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-6460123039
- `POSTED = YES`
- `ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED = NO`
