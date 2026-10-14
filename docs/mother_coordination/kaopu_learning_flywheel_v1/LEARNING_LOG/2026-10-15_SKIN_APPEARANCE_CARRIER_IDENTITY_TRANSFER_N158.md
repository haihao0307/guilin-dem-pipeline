# N158 — Full-body 耳透光证据尚未成为 Skin Paint 的 carrier-identity regression

- 日期：2026-10-15
- Mother：Human / Full-body Skin → Human / Skin Paint
- 类型：技术验证 / Mother-to-Mother traceability / 用户纠错回归实例化
- Bounded question：Full-body R02 的耳部透光因果证据，是否已经在 Skin Paint R02 变成可执行的外观载体识别回归，而不只是一次已发布的方法转述？
- 结论：没有。合法状态为 `SOURCE_METHOD_VERIFIED__TARGET_TRANSFER_POSTED__HOLD_TARGET_TRANSFER_UNACKNOWLEDGED__CORRECTION_REGRESSION_UNBOUND`。

## 1. 现有真实失败

Full-body R02 没有把“耳朵变红”当作一个单一现象。它保留底色/局部血色、表面油脂/粗糙度与几何厚度/遮挡透光的不同载体。更重要的是，独立光路探针发现旧的 nominal backlight 位于头颅另一侧：正确遮挡后，耳部 transmission 开关造成的可见差异为零；把灯移到经头部坐标验证的 rear 位置后，精确像素差异恢复。这个反例证明“控件有变化”与“目标区域在正确光路上由该载体造成变化”不是同一个门。

PR #288 已收到定向 transfer comment，但当前 head `20649aea99244040e273233e16e191d37e10ccb8` 没有目标 Mother 的 ACK、实现或 2×2 carrier 消融回执。因此不能把 Full-body 的 source-side 成功升级为 Skin Paint 已学会、已采用或用户纠错已闭环。

## 2. 外部方法 / 证据

NVIDIA GPU Gems 3 Chapter 14 明确分开皮肤的表面 specular 与 subsurface scattering，并把薄耳 transmission 绑定到穿过表面的深度与光照侧。Donner & Jensen 的 spectral BSSRDF 用 oil、melanin、hemoglobin 等参数分别建模表面与皮下响应。Weyrich 等人的测量模型把 analytic BRDF、diffuse albedo 与 diffuse subsurface scattering分解为不同成分。

这些来源已被 Full-body R02 吸收，因此本轮对外部老师判定为 `NO_NOVELTY`；新增价值不是再列老师，而是用 production counterexample 检验知识是否真的跨 Mother 落地。

## 3. 与当前制度比较

R2 与 `USER-CORRECTION-REGRESSION-BINDING-001` 已要求 exact subject、reason-bearing defect signature、positive control、exact candidate run、独立 verifier 与 USER-ACCEPTED 分离。本轮不新增第二条同类 regression；只把 `SKIN-EAR-CARRIER-IDENTITY-N158` 登记为该现有 case 的具体子试验。

当前已具备：

- source method、source exact SHA、source light-path counterexample 与 exact runs；
- target PR、target exact head 与 POSTED receipt；
- Skin Paint 原有功能/浏览器证据继续有效。

当前缺少：

- target Mother 的 ACK；
- target 对 carrier 的实现映射；
- 固定相机/曝光/区域下的 `base-or-blood red × transmission × lighting` 消融；
- diffuse/base、surface specular、transmission 分量收据；
- fixed-red ear known-bad control 的拒绝证据；
- exact target run、verifier 与用户接受。

## 4. 可反驳假设

若 transfer 已成为 Skin Paint 的可执行 carrier-identity regression，则在同一耳轮/耳垂区域：

1. neutral front light 下，base/blood red 可改变 diffuse/base，但 transmission 开关不得伪造相同结果；
2. geometrically validated rear light 下，transmission 应随厚度/遮挡路径改变，而不是固定发红；
3. fixed-red ear patch 必须被 oracle 拒绝；
4. 同一 oracle 必须运行在 exact target candidate 上；
5. scoped pass 仍不得写成 global realism 或 USER-ACCEPTED。

提供上述 receipt 即可反驳当前 HOLD。

## 5. 最小历史回放

11/11：source 方法缺失、光路未证、未 POSTED、POSTED 未 ACK、ACK 未实现、实现未跑消融、缺少坏样本正控、carrier 未隔离、scoped pass 用户待验、用户接受、功能门另行失败，全部按预期分类。当前 exact evidence 分类为 `HOLD_TARGET_TRANSFER_UNACKNOWLEDGED`。

## 6. 适用边界与决策

仅适用于 Skin Paint 下一次处理耳部/眼周可见红色载体时的一次局部试验。它不否定 Full-body R02 的 scoped ear-transmission evidence，也不否定 Skin Paint R02 已有功能门；不声称医学组织参数、完整体积光输运、全局皮肤写实或用户接受。

决策：`CANDIDATE_SUBCASE_OF_EXISTING_REGRESSION__TARGETED_SKIN_TRIAL_REQUIRED`。不修改生产 Mother 分支、main、R2 或门槛。

## 7. 生命周期与 KPI

- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/288#issuecomment-6176946595
- ACKNOWLEDGED / IMPLEMENTED / TARGET-GATE-RUN / ADOPTED / USER-ACCEPTED：false
- 本轮 classifier gate：11/11
- first-pass candidate rate、same-class recurrence、rejected-lineage inheritance、accepted-delta iteration count、instruction-to-legal-candidate time：unknown
- stale delivery count：0（本轮未见旧产物冒充）
