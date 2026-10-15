# Mother 02:30 Coordination — 被否决后代隔离与基线恢复

- ID: `KAOPU-MOTHER-20261016-KX01`
- 实际开始：2026-10-16 02:34:12 +08:00
- 实际收束：2026-10-16 02:37:11 +08:00
- 主持：小妈协调端
- 真实 Mother 参与：0。两条定向留言已写入并回读；截至收束无 ACK。
- 生产修改：0；main / gh-pages / 生产分支 / 固定成果 / 排程 / 学习飞轮修改：0。

## 会前读取与去重

已读取 `main@1e09ffec5b6b74d89b25e48afc4c487451db4e34` 根 `AGENTS.md`、R2 Production OS、Reference Replication Gate、Freshness Gate、#91/#63 当前回流，以及 PR #282/#286/#291/#292 的状态、正文、评论和相关分支当前指针。

- #91 最新仍为 N148 Human Skin fold 因果问题包；#63 最新仍为 N49 Coast R03 公网运行失败。没有把旧问题重新包装成今日成果。
- 昨日 Skin Appearance Carrier 仍只有 POSTED，没有新 2×2 gate run 或 ACK，不重复催办。
- 用户统一交付规则继续有效。今天没有新的交互工作台或网页版本，因此不复用旧网页冒充交付。
- 新增事实：2026-10-15 两条独立生产线都发生“用户明确否决候选并恢复上一基线”，但 Git 的不可变提交和关闭 PR 仍可访问。现有四类常见 regression 不直接覆盖“被否决后代复活”，已有 `CORRECTION-CANONICAL-ENTRY-001` 管的是已修正候选未进入固定入口，语义不同，因此建立去重 Candidate。

## 今日唯一问题

> 分支已经回退后，怎样确保未来执行者不会从可读取的旧 SHA、关闭 PR、cherry-pick 或复制文件中重新带回被用户明确否决的视觉路线，同时又保留失败证据和合法的新增量？

## R2 核对

| 项目 | Knit P02 / rejected P03 | Brow-Lash R04 / rejected R05 |
|---|---|---|
| taskId / target | `KAOPU-XFER-20261016-REJECTED-LINEAGE`；毛衣后续谱系 | 同 taskId；眉睫后续谱系 |
| accepted baseline | P02 C2 `d3e2c5d39a884bcc15b89232ec8e6a4ecb1e7ee9` | R04 `25f6a0c9f2fb43f7a7ed6cf6fdc5cf70ab78b8de` |
| rejected subject | P03 C2 `a51a5e4f429b91eb4d9d2d2bfc361863a81f6d9d`；PR #291 closed / unmerged | R05 `ed68b1278fefadcb136e650da87f8c4459f5fada`；PR #292 closed / unmerged |
| branch readback | accepted branch 与原 P03 branch 都指向 P02 SHA | accepted branch 与原 R05 branch 都指向 R04 SHA |
| user constraint | P03 太差，删除活动内容，以 P02 为最新版；P02 仍非最终毛衣质感 | R05 否决，回退 R04；R04 的眉根范围和最终毛发仍保持原边界 |
| UNKNOWN | 后续候选是否会通过 copy/reimplementation 带回 P03 行为 | 后续候选是否会通过 copy/reimplementation 带回 R05 长毛/平行梳刷行为 |
| forbidden routes | 旧 SHA/关闭 PR 当生产基线；暗带 P03 壳层、包覆纤维、载纱改形 | 旧 SHA/关闭 PR 当生产基线；恢复 R05 毛长、平行梳刷流、预设或 workflow |
| current state | `ACCEPTED_BASELINE`（仅谱系基线）；最终视觉未接受 | `ACCEPTED_BASELINE`（仅谱系基线）；待验收边界保留 |

## 明确决定：Rejected Descendant Quarantine

建立 Candidate `REJECTED-DESCENDANT-QUARANTINE-001`：

1. 被用户否决的 SHA/PR 永久保留为 `EVIDENCE_ONLY`，可读不等于可继承。
2. 新 Task Anchor / Delivery Receipt 必须绑定 `acceptedBaseSha`、`rejectedCandidateShas`、`actualHeadSha`、`base..head paths`、被否决 path/tree/blob/行为特征与显式再授权范围。
3. Git ancestry 检查不够；还要检查 copy/cherry-pick 后的路径、tree/blob 摘要及行为级回归。
4. 若发现被否决内容且没有当前用户对该具体元素的再授权，状态固定为 `HOLD_REJECTED_DESCENDANT_PRESENT`。
5. 干净地从恢复基线派生，只表示可进入正常 VERIFY，不自动证明写实、参考保真或 USER-ACCEPTED。

Candidate record：
`docs/mother_coordination/kaopu_learning_flywheel_v1/REGRESSION_CASES/CANDIDATE_REJECTED_DESCENDANT_QUARANTINE_001.json`

## 责任端与定向交流

第一真实试用责任端：**Knit Mother 的下一次 P02 后续候选**。Brow-Lash Mother 保持同一方法的接收端和第二历史反例，不启动生产。

已写入并逐字回读：

- [Knit P02 接收说明](https://github.com/haihao0307/guilin-dem-pipeline/pull/282#issuecomment-6199496274)
- [Brow-Lash R04 接收说明](https://github.com/haihao0307/guilin-dem-pipeline/pull/286#issuecomment-6199499277)

截至收束：`POSTED=true`；`ACKNOWLEDGED / IMPLEMENTED / GATE-RUN / ADOPTED / USER-ACCEPTED=false`。

## 最小可证伪验证

从同一个 accepted baseline 派生两个 TEST_FIXTURE_ONLY 候选：

- A：一个全新、获准、与 rejected tree 无关的最小增量；
- B：与 A 相同，但额外带回一个被否决候选独有文件、tree/blob 摘要或已登记行为。

门禁必须让 A 进入正常 VERIFY，并让 B 进入 `HOLD_REJECTED_DESCENDANT_PRESENT`。若只检查分支名、PR closed 或 ancestry 而放过 B，方法失败。

## 未完成边界

没有新的 Knit/Brow 生产提交、没有真实 Task Anchor 集成、没有 gate run、独立 verifier、Mother ACK、采用或用户验收。当前只核对了分支指针恢复和用户明确的谱系选择；没有重新评价 P02/R04 的最终视觉质量，也没有物理手机验收。

## 交给学习飞轮的唯一问题

当执行者不是直接 cherry-pick，而是重写代码或重新生成相同的被否决视觉行为时，怎样用最小的语义/图像/结构 signature 检出“被否决路线复活”，同时避免把合法的新实现误杀？
