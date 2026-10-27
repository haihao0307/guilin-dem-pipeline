# N201 — A4 R32 无效数值样本状态回放

- 日期：2026-10-27
- 类型：制度问题 / 真实生产源码回放
- bounded question：A4 R32 的真实 GPU 区间渲染器，是否会把非有限区间值、非有限叶采样或零/非有限梯度显式分类为 invalid，还是静默并入 MISS/普通着色路径？
- 结论：`SOURCE-PATH-CONFIRMED_STATE_COLLAPSE`
- 决策：`HOLD_INVALID_SAMPLE_STATE_COLLAPSE`
- 复用 regression：`FUNCTION-SURFACE-INVALID-SAMPLE-FLICKER-001`（N200）；不新建同类 case
- 生产状态：仅学习分支；未修改 main、Mother 生产分支、R2 OS 或全局门禁

## 1. Canonical baseline

本轮先复读 main `3ccae4bde0c91973adbb81f99ec4d54bc9357ce0` 的根 AGENTS、R2 OS、reference-replication gate、freshness gate，并复核 #91 N200 与 #63 N49 的最新真实反馈。#91 仍无 N200 之后的 Mother ACK；因此此前教师与方法状态均不得晋级。

实际生产观察对象：

- branch：`trial/a4-r32-normal-chrome-20261027`
- commit：`580acd1c8b851d0c843826e2b49c7079411473bd`
- `gpu-interval-runtime.js` blob：`9a3e04b76f2e6281d1feb8cb6b4f2bb9160cc101`
- `app.js` blob：`0139cc195c164574bd94a9a8cb0bce444076c686`
- R32 专属 `r32-tests/BROWSER_R32_RESULT.json`：不存在
- commit combined status / PR-triggered workflow run：均为空
- `BROWSER_QA.json`：`revision=R31, status=NOT_RUN`
- `R32_VERIFICATION_STATE.json`：`new_browser_executed=false`, `deployed=false`, `phone_accepted=false`；其 source hash 清单也早于新增 GPU runtime，不能认证当前提交
- 既有 `test-gpu-interval-runtime.cjs` 自述 scope：`Actual runtime source and explicit GL facade only, not browser/GPU pixels`

由此，本轮只允许形成 SOURCE + synthetic replay 层结论，不得宣称 browser/device/production/user acceptance。

## 2. 源码事实

真实 runtime 的 per-ray 状态词汇只有：

`active / hit / miss / exhausted`

不存在 `INVALID_NONFINITE`、`INVALID_GRADIENT` 或等价状态。

区间谓词为 `if (!(rr.x > 0.))`。当 `rr.x` 为 NaN 时，比较结果为 false，取反后进入“可能命中/继续细分”路径，而非 invalid。到叶节点时，`field(pm) <= 0.0005` 对 NaN 为 false；该样本不会命中，且没有独立 invalid 结果，最终可收敛为 MISS。

tail fragment 用固定 `h=.0003` 做中心差分后直接 `normalize(vec3(...))`，未见 `isnan/isinf`、有限性检查或最小梯度幅值门槛；零梯度与非有限梯度可直接进入 `surfaceColor`。

正向对照：节点预算耗尽有独立 `exhausted` 状态，JS invariant 会以“frame incomplete”拒绝整帧。因此问题不是所有失败都静默，而是“数值无效样本”这一个状态边界缺失。

## 3. 最小可反驳回放

探针：`PROBES/a4_r32_invalid_sample_state_probe_n201.js`

结果：`PROBES/a4_r32_invalid_sample_state_result_n201.json`

8/8 assertions PASS：

1. 状态词汇没有 invalid 类；
2. NaN interval lower 会继续细分；
3. NaN leaf field 不会命中并可终止为 MISS；
4. 有限正 lower 保持 MISS；
5. 有限有效叶保持 HIT；
6. 零梯度归一化产生非有限分量；
7. 非有限梯度归一化保持非有限；
8. budget exhaustion 是可区分的正向对照。

适用边界：这是从已检查真实源码提取的谓词语义回放，不是 WebGL 驱动、浏览器像素、设备或用户症状复现。它证明“失效路径存在”，不证明该路径已经在用户设备上触发。

## 4. 外部证据与 novelty

Khronos GLSL ES 3.00/3.20 规范是本轮 primary evidence：规范不允许依赖 NaN 的普遍生成/传播行为；若实现生成 NaN，`isnan` 应正确识别；`normalize(x)` 定义为 `x / length(x)`。因此 invalid 状态与显式 finite/magnitude guard 是必要边界，不能用“NaN 会自然传播成稳定结果”代替。

- https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf
- https://registry.khronos.org/OpenGL/specs/es/3.2/GLSL_ES_Specification_3.20.pdf

Teacher status：

- libfive：保持 `TEACHER_CANDIDATE`，未获 Mother ACK，不晋级；
- Khronos GLSL spec：`NO_NOVELTY`（确认 N200 已提出的边界，不构成新的 teacher method）；
- Mother contact：已向 #91 定向 `POSTED`（comment `6446508182`）；尚无 `ACKNOWLEDGED`。

相对 Current Best View 的真正新增不是新规则，而是：N200 的“可能实现失败机制”已经在 A4 R32 真实源码中找到可执行路径；但用户黑点/闪烁的因果归属仍是 UNKNOWN。

## 5. Candidate gate（仅 A4 单 Mother，未采用）

对 A4 下一次相关 candidate，建议做一个可回滚局部试验：

1. 为 interval range、leaf field、normal gradient 增加独立 invalid 计数/状态，禁止并入 MISS；
2. tail shading 前增加 finite + gradient magnitude guard；
3. 固定相机/参数重复渲染至少 120 帧，记录 invalid 分类、像素 hash 与预算 exhaustion；
4. 比较旧实现与候选实现：若黑点/闪烁无差异或 invalid 从未触发，则反驳本假设；若问题与 invalid 状态同现且候选消除，则进入 Candidate 决策；
5. 仍须独立 browser/device verifier，Producer 不得自批。

## 6. 状态语义

- SOURCE-INSPECTED：是
- synthetic GATE-RUN：是，8/8 PASS
- POSTED：是，#91 comment `6446508182`
- ACKNOWLEDGED：否
- IMPLEMENTED：否
- browser/device GATE-RUN：否
- ADOPTED：否
- USER-ACCEPTED：否
- KPI：UNKNOWN（无可靠统计，不造数）
