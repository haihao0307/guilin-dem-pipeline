# N157｜Hair R05-M3 会弯与回弹，但未证明导丝弧长受控

- 日期：2026-10-14
- Mother：Hair
- 类型：技术验证 / 外部老师候选 / guide inextensibility
- Bounded question：Hair R05-M3 的位置抓取是否已证明导丝靠弯曲而非未测量的中心线伸长来满足鼠标目标？
- 结论：尚未。当前合法状态是 `REDUCED_BENDING_AND_RELEASE_VERIFIED__HOLD_GUIDE_ARC_LENGTH_INVARIANT_UNBOUND`。
- 老师状态：`TEACHER_CANDIDATE`
- 生产分支、main、R2 修改：无

## 1. 现有真实失败

PR #272 当前 R05-M3 exact subject：source `3fd9377972f5e8009faaf90195a4eea4841d4673`，immutable build `1e3af7b2887916ab6430652bead644b45cd5c7cb`，public evidence `d67f016ccc4e6ccfe3beceb2524feaa66363e01e`，handoff `61459da210933010e31d7c80cb353f57e0524783`，browser run `38573567754`。

已有证据应完整保留：85 条 guide、每条 81 个光学样本、10,000×80 segments、根固定、三个非缩放复制的弯曲模态、中段/端点位置抓取、风响应、release damping、静态图像近乎像素等价以及无 silent fallback。

但 `motion.mjs` 对 x/y/z 三轴模态系数独立积分，用位置目标驱动模态平衡，只限制目标位移与模态系数幅值；它没有重建导丝后约束相邻节点距离，也没有输出 per-segment strain 或总弧长漂移。`tests/core.mjs` 与 `tests/browser.mjs` 证明“根不动、tip 会动、模态有能量、释放会衰减”，没有证明“中心线长度近似不变”。HANDOFF/KNOWLEDGE_GAIN 已诚实声明无 full arc-length constraint，因此本轮不是抓到虚假声明，而是把未绑定的物理边界变成可执行 Candidate。

## 2. 外部老师筛选与新增知识

专项老师候选：Müller、Kim、Chentanez 2012 的 *Fast Simulation of Inextensible Hair and Fur*，以及 InteractiveComputerGraphics 的 MIT `PositionBasedDynamics@10a70bc146a97873dc3c8fef372f5217e010542e`。

它比当前 Current Best View 多知道的明确问题是：**导丝不可伸长不是“位移有上限”或“看起来弯了”，而是相邻粒子保持声明的 rest distance；因此验证必须检查每段长度，不能只看 root/tip 位移、模态能量或总弧长。** 论文给出单遍 Follow-The-Leader 零伸长方法，也明确其人工阻尼与精度代价；仓库源码把 distance constraint 写成当前距离相对 rest length 的投影修正。

八项筛选：

1. `source/provenance`：作者公开论文页 + 官方研究组织仓库，一手来源。
2. `maintenance`：仓库最新 head 日期 2026-09-01；最新 tagged release 2.2.0 日期 2022-12-13。源码仍有活动，但 release 节奏陈旧。
3. `runnable`：CMake C++、Python interface、Cosserat rod 等 demos、Linux/Windows build workflows；审计 head 未找到独立 Tests 目录。
4. `license`：代码 MIT；论文仅作方法证据，不复制图表或资产。
5. `relevance`：直接命中 Hair guide 中心线伸长，不替代外观、材质、碰撞或用户验收。
6. `novelty`：R05-M3 未输出 segment-rest-distance receipt，存在局部新增。
7. `dependency/cost`：直接集成需 C++/CMake/Eigen 并改 solver 架构；本轮不导入代码，只学 invariant 与测试法。
8. `risk/boundary`：FTL 有人工阻尼；PBD 以视觉稳定/可控为主，精度不等同完整杆件物理。不能据此声称 twist/contact 已解。

老师决策：`TEACHER_CANDIDATE`，仅进入 Hair 的 arc-length invariant audition；solver adoption 为 `NOT_PROPOSED`。

## 3. 与 KAOPU 当前制度比较

R2 已要求声明边界、独立验证与 regression 正控，制度层 `NO_NOVELTY`。R05-M3 的边界披露也是合格的。真正新增在 Hair 技术对象：把“无完整弧长约束”的 prose 限制转成 exact guide 的可运行收据。

现有 `CANDIDATE_HAIR_SCALP_EXPOSURE_SPATIAL_IDENTITY_001` 和 `CANDIDATE_HAIR_SCALP_ROOT_FIELD_IDENTITY_001` 分别查屏幕露头皮与 scalp-space 根场；均不查运动导丝 segment length，因此不重复。

## 4. 可反驳假设

若 R05-M3 的 grab/wind/release 主要表现为导丝弯曲而非不可控伸缩，则在 exact 81-node guide 上：

1. rest 与 deformed centerline 可绑定；
2. midshaft grab、endpoint grab、wind 峰值与 release 过程都有 measurement frames；
3. 每段 stretch/compression 与总弧长漂移都在 Hair Mother 事先声明且有依据的 scoped limit 内；
4. verifier 能拒绝一个人工拉长某段、但总弧长可能通过别段压缩抵消的 known-bad control。

若现有模态模型做不到，应保持“reduced bending interaction”声明，不升级到 inextensible guide；这不会否定当前视觉/交互证据。

## 5. 最小历史回放

新增去重 Candidate：`CANDIDATE_HAIR_GUIDE_ARC_LENGTH_INVARIANT_001`。

分类探针 9/9：R05 当前未绑定、root pin 失败、弯曲证据缺失、仅总长度、仅 grab 未覆盖 wind/release、阈值无依据、无已知拉伸正控、局部段超限、scoped 通过但非 full rod 均被正确区分。夹具中的数值只测分类器，不是生产阈值。

## 6. Hair 局部可执行对象

下一次相关 Hair 任务只需在 Delivery Receipt 添加：

`guideId / restCenterlineDigest / restSegmentLengthsDigest / motionMode / grabArcPosition / grabTarget / deformedCenterlineDigest / maxSegmentStretchRatio / maxSegmentCompressionRatio / totalArcLengthDriftRatio / measurementFrameIds / thresholdBasis / positiveControlInjectedStretch / positiveControlDetected / runId / verifierIdentity`

门必须同时看 per-segment 与 total；只看 total 会允许局部拉伸和压缩相消。阈值由 Hair Mother 根据 exact task claim / accepted baseline 定义，学习飞轮不发明统一百分比。

## 7. 适用边界与决策

- 适用：R05-M3 的 81-node guide，在 midshaft/endpoint grab、wind、release 的中心线伸长审计。
- 不适用：twist、collision/self-contact、身体/衣服接触、完整杆件物理、性能、渲染保真或 USER-ACCEPTED。
- 决策：`CANDIDATE_ONLY_TARGETED_HAIR_TRIAL_REQUIRED`。
- POSTED：true — https://github.com/haihao0307/guilin-dem-pipeline/pull/272#issuecomment-6172412912
- CLASSIFICATION-GATE-RUN：9/9。
- ACKNOWLEDGED / IMPLEMENTED / HAIR-PRODUCTION-GATE-RUN / ADOPTED / USER-ACCEPTED：false。
- KPI：stale delivery = 0；其余均 `unknown`。
