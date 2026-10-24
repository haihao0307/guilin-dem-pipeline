# N187 — “动作能播放”不等于自然、全身协调

## Bounded question

怎样在用户看成片之前，可执行地拒绝“任务完成但动作僵硬、缺少全身协调或关节约束”的候选？

## 现有真实失败与基线缺口

用户最新纠正明确指出：动作僵硬、没有全身协调/关节限制，要求至少有好的效果再展示。现有候选规则分别覆盖环境任务生成（N181）、精确部件身份（N182）、绑定兼容与自穿透（N186）；三者全部通过时，足滑、悬浮/穿地、相位突变、关节越界、接触时序错误和躯干/上肢冻结仍可能存在。因此这是独立缺口，不是重复规则。

## 外部老师候选

- 来源：RoMoDataset/motion-toolbox（RoMo / CVPR 2026 公开仓库）。
- 可复现性：含 Python 代码、测试、CI、示例数据与 HTML 报告；核心 CPU 路线可跑，SMPL/MHR/GPU 为可选重依赖。
- 新增知识：把“僵硬/不自然”的一部分转成逐帧、可定位的足滑、穿地、悬浮、jerk 与活动度信号，而不仅是看最终视频凭感觉判断。
- 维护风险：研究代码、提交历史很短、无稳定 release，README 明示 API 可能变化，配套数据镜像仍有占位项。
- 权利风险：CC BY-NC 4.0；不应把代码或资产直接并入可能商业使用的生产管线。仅允许方法论 audition 或经权利审查后的 clean-room 实现。
- 适用边界：不测关节限制、支撑/质心、手物接触时序、任务/环境适配或完整全身协调；dynamic/activity 也不是自然度。
- 状态：`TEACHER_CANDIDATE`。回答“比 Current Best View 多知道什么”：在动作伪影可观测性这一窄域，给出了可运行的逐帧检测和报告结构；不代表它能生成自然动作，也未进入 Teacher Registry。

## 可反驳假设

如果把任务/身份/绑定设为前置门，并要求动作级的相位清单、同骨架/同身体类别的冻结参考包络、逐帧运动学/接触报告、负样本与独立 verifier，那么历史上的“任务完成但僵硬”样本会在用户审阅前被拒绝；同时合法参考动作不会被误杀。

反驳条件：负样本通过、合法参考被拒、不同动作共用阈值才成立、或指标通过但盲审仍持续判为僵硬。

## 最小历史回放

固定 9 个样本：1 个合法参考候选；7 个单缺陷负样本（足滑、穿地、低全身参与、jerk、关节越界、接触错相、Producer 自批）；1 个“自然但做错环境任务”的前置门负样本。候选 gate 对 9/9 期望状态一致。

这只是 schema/probe 回放，不是生产动作效果验证；没有真实身体、骨架、动画或用户盲审输入，故状态不得高于 `GATE-RUN` 的本地候选证据。

## Candidate gate

1. Task Anchor 冻结 `actionId + phaseManifest + skeleton/body/controller identity + jointLimitSetRef + contactScheduleRef + action-specific reference envelope + observer views`。
2. Delivery Receipt 提交逐帧 root/joint/contact/collision trace，以及 phase-local 足滑、穿地、悬浮、jerk、关节越界、接触时序与全身参与度。
3. 禁止采用 motion-toolbox 的通用默认阈值直接作 KAOPU 验收；阈值须由同动作、同骨架/身体类别的合法冻结参考校准。
4. Producer 不得自批；负样本必须被拒；独立 verifier 复核多视角和小幅 held-out 环境变化。
5. 指标通过只到 `CANDIDATE_PASS`，不是 `ADOPTED` 或 `USER-ACCEPTED`。

## 路由与状态

- 建议定向路由：#334 动作/全身 Mother 协调入口；不群发。
- 外部老师：`TEACHER_CANDIDATE`。
- Mother 回执：`NOT_QUERIED/UNKNOWN`（发布后才可写 `POSTED`；没有真实回执不得写 `ACKNOWLEDGED`）。
- OS 变更：无。生产 Mother 分支：无修改。

## KPI

首次候选通过率、用户纠错次数、同错复发率、stale/rejected lineage 等当前均 `unknown`；本轮不造 KPI。
