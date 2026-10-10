# KAOPU Learning Flywheel N133 — Tailor R04.3.2 静态通过不等于视觉验收

## 单一问题

R04.3.2 的 `qualityPassed=true`、`thumbReady=true` 与 PNG 可解码，能否发现用户“这一版问题更多了”的视觉纠正，还是仍会把明显需要调整的款式列入可用候选？

## 现有真实失败

用户在 R04.3.2 之后明确纠正：“这一版问题更多了，你自己检查一下再调整”。

R04.3.2 的精确评审文件同时承认：

- 60 条原纸样 / 原生材料 / solver 记录；
- 22 条静态通过，38 条静态失败；
- `finalVisualQualityAccepted=false`；
- `physicalFitAccepted=false`；
- `dynamicWearCertified=false`；
- `userAccepted=false`；
- 视觉抽查只列出 P06 三视图、S02、T08 与两张 outfit 页面；评审本身记录 T08 袖褶仍粗糙。

因此，静态门和解码成功是保留的工程事实，不是逐款视觉合格。

## 外部方法 / 证据

Playwright 官方视觉比较会先生成 reference screenshot，后续运行再与该 reference 比较；这说明视觉回归结论需要明确的比较基线，而不是由“图片存在/可解码”推导。

- https://playwright.dev/docs/test-snapshots

N128 已引用 NASA / NIST，将 verification 与 intended-use validation 分层。N133 没有发现新的全局制度缺口，判定 `NO_NOVELTY`。

## 与 KAOPU 当前制度比较

R2、N128 既有 Tailor 回归和视觉 golden/change-control 规则已经要求：

- 静态工程门不能替代 seam / fold / on-body 逐款视觉账本；
- 独立 Verifier 与 USER-ACCEPTED 分层；
- 视觉回归要绑定授权 comparator，不能凭印象宣称“比上一版更差”。

本轮新增的不是制度，而是 R04.3.2 exact-subject 的反例证据。

## 可反驳假设

若每个拟称“可用”的静态通过成员都必须绑定：

1. exact public image / digest；
2. 授权 reference 或上一条 accepted golden；
3. visible failure categories；
4. independent verifier；
5. comparative regression state；
6. user acceptance 独立保持；

则抽查的 7 款会继续 HOLD，而不会被 `qualityPassed=true`、`thumbReady=true` 或 PNG 解码成功误晋级。

## 最小回放

对固定公网前缀 `r0432-eeca9dee0c3a` 抽查 7/22 个静态通过成员：

- T01：刚性、平板轮廓；袖窿/侧边间隙需比较；
- T08：袖子/袖窿与领口褶皱粗糙；与 R04.3.2 自身评审一致；
- T14：肩部/侧边边界出现开口感；
- P01：裆部与裤腿块状，下摆/脚部相交需比较；
- P06：裆部与裤腿块状，下摆/脚部相交需比较；
- S03：垂坠刚性、腰部收边需比较；
- J02：表面与合身分层不清、垂坠刚性。

每项都满足 exact index 中 `qualityPassed=true`、`thumbReady=true`，且对应 fixed-public PNG 能显示。12/12 检查通过，终态：

`R0432_STATIC_PASS_VISUAL_ACCEPTANCE_GAP_CONFIRMED__HOLD_MEMBER_VISUAL_COMPARISON_USER_ACCEPTANCE`

重要边界：这不是 22 款穷举，也没有绑定 R04.3.1 或用户已接受的逐款 golden，因此“比上一版更差的具体成员/数量”保持 `UNKNOWN`，不得猜测。

## 适用边界

只更新 Tailor 既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`。不新增全局门禁，不修改生产 Mother 分支，不否定 R04.3.2 的 60 条原生结果、22/38 静态结论、432 outfit 身份、public bytes 或 CI browser 证据。

## 是否采用

`UPDATE_EXISTING_REGRESSION_CASE_NO_NOVELTY`。

下一张 Delivery Receipt 在把 22 个静态通过成员称为视觉可用前，应逐款补齐 `referenceOrPriorAcceptedComparator`、`visibleFailureCategories`、`independentVerifier` 与 `comparativeRegressionState`。没有 comparator 的成员只能写 `UNKNOWN/HOLD`，不能写“未退化”。

## 生命周期

- POSTED: true — PR #181 comment 6098126777
- ACKNOWLEDGED: false
- IMPLEMENTED: false — 当前用户视觉纠正尚未修复
- GATE-RUN: true
- ADOPTED: false
- USER-ACCEPTED: false

## 指标

- 首次候选通过率：unknown
- 用户纠错次数：本轮新增 1
- 同类错误复发率：本次在 7/22 静态通过样本中确认“静态通过仍需视觉 HOLD”；全量率 unknown
- rejected lineage 继承次数：0（未把 R03/R02 当父节点）
- stale delivery 次数：0
- 每个 accepted delta 的内部迭代数：unknown
- 指令到合法 candidate 时间：unknown

## Routing receipt

- PR #181 comment: https://github.com/haihao0307/guilin-dem-pipeline/pull/181#issuecomment-6098126777
- Evidence branch: https://github.com/haihao0307/guilin-dem-pipeline/tree/automation/n133-tailor-r0432-static-pass-visual-hold-20261010
- Production branch changed by this learning cycle: false
- Global R2/gate changed: false
