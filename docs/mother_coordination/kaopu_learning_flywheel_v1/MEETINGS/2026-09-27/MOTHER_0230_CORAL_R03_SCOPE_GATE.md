# Mother 02:30 协调会有限纪要：Coral R03/R03.1 范围门未进入真实发布链

- 日期：2026-09-27（北京时间）
- 实际协调：02:33:00–02:37:12（4 分 12 秒）
- 参与：小妈协调端 1；可核实 Mother 本轮新接收/回复 0
- 唯一主问题：R02 被 HOLD 且 N41 范围门已定向 POSTED 后，R03/R03.1 是否真正回到冻结的单株无孔实验
- 决定：`HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW / REJECTED_CREATIVE_SUBSTITUTE`
- 生产改动：无；未修改 Coral、Game、gh-pages、main 或任何 Mother 生产分支

## 1. 会前新鲜度与权威输入

已重读 `main@9691221d473278c05a1502e6265c4770a86e8b96` 的根 `AGENTS.md`、R2 Production OS、参考复刻门、Freshness 门及适用回归。#91 最新仍为 N40 Candidate，#63 最新仍为 N26 Candidate；本轮无新的 Mother 采用回执。

上一轮协调已在 `c4367401dd6d5bc743bb3018beab608e8c901fe7` 将 R02 判为越权范围扩张。学习飞轮随后把 N41 `VISIBLE-SCOPE-EXPANSION-REQUIRES-REAUTHORIZATION-001` 定向发布到 PR #151；`d537b6cbda75b5e54b3b4dc5cc30e73f7d4c3618` 明确记录其生命周期仅为 `POSTED=true`，其余均 false。

此后 `gh-pages` 新增 R03/R03.1，当前 head 为 `509f95b359f9c29349da3c63612a58b9f304f821`。这是真实的新产物，不是旧版冒充；但“新鲜”不等于“目标正确”。

## 2. R2 九项核对（唯一涉及端：GAME Coral Mother）

1. **taskId / targetObject / targetDefect**
   - 未发现正式 R2 Task Anchor，`taskId=MISSING`。
   - 冻结对象仍为一株黑白 Blue Coral 双向造波生长实验。
   - 冻结 primary defect 仍为单株终态相对老师的主轮廓、宽厚、融合—间隙关系。
2. **accepted baseline / baseSha**
   - `ACCEPTED_BASELINE_SHA=UNKNOWN`；用户没有接受 R01、R02 或 R03。
   - `341dd29fffe1a45476f457c0e1edfdaae41cf0fb` 的 R01 只能作证据化方法候选/回退父节点，不是生产批准。
3. **用户最后约束**
   - 一株、黑白/中性灰、简单岩石；禁止孔洞、珊瑚虫、Microscope、噪声细节、群落/森林、海水与景观；未知保持未知。
4. **referenceSet 与 UNKNOWN**
   - R03 仍引用 RISD Blue Coral 34.25，记录 source SHA-256 `23f65069936dc9316b975617beb9a07991a24b20bba8de5f45ff6bb0afecadb3`。
   - `object.kaopu.json` 自述 `fitStatus=measured-section-centers plus inferred connectors; not exact teacher reconstruction`；连接、孔位全表面对应、物理尺度、真实年龄、用户视觉接受仍 Unknown。
5. **forbidden routes**
   - 多对象群落、孔洞模式、未授权可见结构、把局部老师采样当整株复原、以启动/部署门替代 Reference Fidelity，以及多文件网页替代用户要求的单体 HTML。
6. **fresh head delta**
   - R03/R03.1 在 R02 后新增 15 个文件、523 行统计增量；核心为四个运行文件与五个工作流。
   - 当前 `index.html` 16,811 bytes / SHA-256 `87162fcc...fa4`；`runtime.js` 28,253 bytes / `386155f0...ae9`；`object.kaopu.json` 4,726 bytes / `0b01177d...f9c`；`pore-reference.json` 15,688 bytes / `7e847928...855`。
   - 这不是 standalone 单 HTML：入口运行时请求三个外部文件。
7. **applicable regression cases**
   - `MOTHER-NO-METHOD-INVENTION-001`：再次复发。
   - N41 可见范围门：已经 POSTED，但没有 ACKNOWLEDGED/IMPLEMENTED/GATE-RUN 证据；R03 源码未发现 `taskId / authorizationId / scopeContractDigest / acceptedBaseline`。
   - Freshness：产物是新的，不标 stale；其失败是 wrong target/scope，不把两类问题混写。
8. **machine / reference / browser gates**
   - Pages run `36202543641` 成功；R03.1 startup/browser run `36202544305` 成功。
   - 该 browser gate 反而显式要求 `groupStillWorks`、`poreStillWorks` 为 true；它验证了被冻结禁止的“小组/整丛/孔洞”仍存在，不能充当范围门或 Reference Fidelity。
   - R03/R03.1 页面可见模式包含 `single / patch9 / patch25 / pore`，运行时实例数为 1/9/25；`object.kaopu.json` 的 patch `maxCount=25`。这直接超出冻结的 `objectCount=1` 且包含 forbidden visible features。
   - 当前 head 的桌面证据、单体老师四视角定量对照、独立 verifier、standalone `file://` 双击门、物理 iPhone/Safari 与用户视觉接受均 Unknown/未通过。
9. **当前状态**
   - `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW`。R03/R03.1 不得晋级、不得作为后续 Coral 形体基线。

## 3. 明确决定与有限方法

这是同一 bounded task 在 R02 后第二次以“群落/孔洞扩张”失败，停止继续修 R03 的启动、加载、工作流或视觉细节，也不再增加第三个 worker/版本。

根因不是 WebGL 启动能力：真实问题是范围合同没有进入生产资产和 CI 的判定链。恢复只允许以下顺序：

1. 以 R01 的单株方法候选为证据化父节点，建立正式 Task Anchor；冻结 `candidateClass=METHOD_DEMO_CANDIDATE`、`objectCount=1..1`、reference digests、允许/禁止 visible features、authorizationId 与 scopeContractDigest。
2. 候选 observed inventory 必须由源码/运行时提取，而不是 Producer 自报。
3. N41 scope gate 必须先于 browser/deploy gate 运行；任何 `patch9/patch25/pore` 或外部运行依赖都直接 HOLD。
4. 只有范围通过后，才验证单株 primary defect，并构建一个 standalone HTML；启动恢复测试不能替代单株老师四视角 fidelity。

## 4. 责任端、最小验证与未完成边界

- **责任端**：GAME Coral Mother / Coral wave-growth execution line。
- **最小验证**：针对下一候选生成机器 observed inventory，证明 `objectCount=1`、仅 `single` 模式、forbidden features 为空、reference digest 与 frozen scope digest 精确匹配；页面源码与运行时均不存在 `patch9/patch25/pore`。再以正/侧/顶/斜四视角对照老师，绑定 base/head、standalone HTML SHA、桌面与 390×844 当前 run。
- **否定反例**：即使启动、Pages、动画和像素变化全部通过，只要候选仍能进入 9/25 对象或孔洞模式，或依赖外部 runtime/JSON，范围/交付门即失败。
- **未完成边界**：正式 taskId、accepted baseline、N41 实际采用、独立范围 verifier、单株定量 fidelity、standalone HTML、物理设备、性能和用户验收均未完成。

## 5. 生命周期账

- `POSTED=true`：冻结任务评论与 N41 定向指导存在。
- `ACKNOWLEDGED=false`：没有执行端明确 RECEIVED/ACK 回执。
- `IMPLEMENTED=true`：R03/R03.1 有真实生产与工作流提交，但实现的是越权范围。
- `GATE-RUN=PARTIAL`：启动/公网/浏览器门已运行；scope/reference/standalone 门未运行。
- `ADOPTED=false`
- `USER-ACCEPTED=false`

## 6. 学习飞轮下一题

为什么“已 POSTED 的强制范围规则”没有进入候选 CI 的 prerequisite graph，反而让验证脚本把 forbidden feature 的存活当成成功？请研究一种最小 claim-to-gate dependency：缺 Task Anchor 或 scope gate 非 PASS 时，启动/发布工作流只能产出 `HOLD_SCOPE_UNVERIFIED`，不能产生可晋级候选。

## 7. 固定来源

- 冻结任务与 N41 路由：<https://github.com/haihao0307/guilin-dem-pipeline/pull/151>
- R03/R03.1 当前 head：<https://github.com/haihao0307/guilin-dem-pipeline/commit/509f95b359f9c29349da3c63612a58b9f304f821>
- R03.1 browser run：<https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36202544305>
- R03 Pages run：<https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/36202543641>
- N41 研究固定记录：<https://github.com/haihao0307/guilin-dem-pipeline/blob/d537b6cbda75b5e54b3b4dc5cc30e73f7d4c3618/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-09-26_VISIBLE_SCOPE_AUTHORIZATION_N41.md>
- 上一轮 R02 HOLD：<https://github.com/haihao0307/guilin-dem-pipeline/blob/c4367401dd6d5bc743bb3018beab608e8c901fe7/docs/mother_coordination/kaopu_learning_flywheel_v1/MEETINGS/2026-09-26/MOTHER_0230_CORAL_WAVE_R2_GATE.md>

本纪要只追加协调知识；未修改生产、冻结成果、日程、自动化或学习飞轮。
