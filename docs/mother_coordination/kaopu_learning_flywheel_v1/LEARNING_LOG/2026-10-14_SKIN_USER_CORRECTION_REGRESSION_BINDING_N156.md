# N156 — Skin R01 用户视觉退回尚未绑定为可执行回归

- 日期：2026-10-14
- Mother：Human / Skin
- 类型：制度验证 / 用户纠错闭环 / regression traceability
- Bounded question：PR #288 已记录 R01 被用户视觉退回并完成 R02 功能验证，这个纠错是否已经进入可执行 regression，从而在再次展示给用户前阻断同类视觉缺陷？
- 结论：尚未。当前合法状态为 `FUNCTIONAL_EVIDENCE_PRESERVED__HOLD_USER_CORRECTION_REGRESSION_UNBOUND`。

## 1. 现有真实失败

Skin R02 的边界披露是正确的：`LESSONS_R02.md` 明确记录 R01 被用户视觉退回，R02 的 `DELIVERY.json` 保持 `userVisualAccepted=false`，并把 Windows/Linux 公网功能检查与写实验收分开。

但在 PR #288 当前 head `20649aea99244040e273233e16e191d37e10ccb8` 中，未找到把该用户纠错绑定为可执行 regression 的收据。现有检查证明：固定字节、浏览器启动、六个预设、控件响应、A/B 往返、几何未变和错误为零；它们不能重放“为什么 R01 不写实”，也不能证明 R02 已消除那个原因。

## 2. 外部方法 / 证据

NASA-STD-8739.8A 4.5.11 要求规划并执行 regression testing，并更新程序以纳入验证关键异常修正的测试。Google SRE 的 postmortem 实践指出，未完成的 action items 会提高复发概率。两者共同支持一个窄结论：把纠错写进复盘是记录，不是闭环；必须有可执行、可追踪的验证动作。

这些原则与 R2 的“User Correction → Regression Case”一致，因此全局制度层记 `NO_NOVELTY`。本轮新增是 Skin R01/R02 的 exact-subject 反例，以及可运行的 receipt 分类。

## 3. 与当前制度比较

R2 已要求重要用户纠错生成 regression case。PR #288 做到了：

- 保留被退回版本和新候选身份；
- 不把功能测试冒充视觉达标；
- 保持 `userVisualAccepted=false`；
- 不覆盖 R01 历史。

尚缺：

- `correctionId` 与用户纠错来源；
- 被拒绝 exact artifact 和 reason-bearing defect signature；
- 下一候选所跑的 regression oracle；
- 可证明检查器会拒绝已知坏样本的 positive control；
- exact run / decision / verifier receipt。

## 4. 可反驳假设

若一次用户视觉退回已进入可执行回归，则下一候选在展示前应能：

1. 绑定被拒绝的 R01 exact artifact；
2. 把“数字模型感”收窄为至少一个可观察、可比较的缺陷签名，而非发明统一写实分数；
3. 在相同相机、灯光、曝光和区域上拒绝已知坏控制；
4. 对 R02 exact candidate 运行同一 oracle；
5. 保持回归通过与 USER-ACCEPTED 分离。

提供上述 receipt 即可反驳当前 HOLD。

## 5. 最小历史回放

8/8：文档记录但未建 case、R02 功能全绿但纠错不可执行、case 未运行、缺少坏样本正控、缺陷复发、scoped pass 但用户未接受、用户接受、功能门另行失败均正确分类。

## 6. 局部可执行对象

仅建议 Skin 下一次相关任务在 Delivery Receipt 加入：

`correctionId / rejectedSubjectSha / rejectedArtifactDigest / defectSignature / protectedValidClaims / regressionCaseId / regressionOracle / positiveControlId / positiveControlDetected / regressionRunId / regressionDecision / verifierIdentity / userAcceptance`

不要尝试定义全局“写实度分数”。先由 Skin Mother 从用户退回中提取一个最小可观察签名，例如眼周过渡、耳根/面部材质连续性、孔尺度或高光集中；一次只验证一项。

## 7. 适用边界

本轮不否定 R02 的功能、浏览器、固定字节、几何保持、参数响应或边界披露证据，也不判断 R02 当前视觉已经失败。它只判定：R01 用户纠错尚未成为可执行 regression，因而不能说同类视觉缺陷已在用户之前被拦截。

不修改生产分支、R2 或现行阈值；不替 Skin Mother 实现资产。

## 8. 决策与生命周期

`CANDIDATE_ONLY_TARGETED_SKIN_TRIAL_REQUIRED`

- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/288#issuecomment-6167550625
- CLASSIFICATION-GATE-RUN：8/8
- ACKNOWLEDGED / IMPLEMENTED / SKIN-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED：false

## 9. KPI

- 用户纠错次数：1（R01 视觉退回）
- 首次候选视觉通过率、同错复发率、rejected lineage 继承次数、accepted delta 内部迭代数、用户指令到合法 candidate 时间：unknown
- stale delivery 次数：0（本轮未见旧产物冒充）
