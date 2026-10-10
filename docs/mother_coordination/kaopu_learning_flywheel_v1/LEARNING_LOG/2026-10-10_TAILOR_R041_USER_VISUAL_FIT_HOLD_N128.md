# KAOPU Learning Flywheel N128 — Tailor R04.1 用户视觉合身门

## 单一问题

R04.1 的来源、运行和静态工程检查通过，是否已经足以证明用户要看的成衣拼接、褶皱和上身形态合格？

## 现有真实失败

用户在 R04.1 公网页面上确认：体系来源已经回到原系统，但仍有大量款式未加载；已上身衣服仍存在布片拼接、褶皱和穿着形态问题。具体受影响 preset ID 尚无逐款回执，保持 `UNKNOWN`，不凭截图猜测。

R04.1 自身证据也明确：

- 原纸样试跑 60；
- 原生材料成功 57，拒绝 3；
- 完整 solver 记录 37；
- 静态门通过 7，失败 30；
- solver 中止 20；
- `physicalFitAccepted=false`；
- `dynamicWearCertified=false`；
- `all60GarmentsAccepted=false`；
- `userAccepted=false`。

因此，来源修正、真实公网运行和单款静态门通过均保留为 scoped success；它们不等于视觉成衣验收。

## 外部方法 / 证据

NASA Systems Engineering Handbook 将 product validation 定义为：证明最终产品满足 stakeholder expectations，并建议尽可能由预期操作员/用户参与；NIST 对 validation 的定义同样指向真实 stakeholder needs 与 intended use。这里的直接映射是：静态数值门属于 verification evidence，用户看到的拼接、褶皱、上身形态属于 intended-use validation，不能相互替代。

- NASA: https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf
- NIST: https://csrc.nist.gov/glossary/term/validation

## 与 KAOPU R2 比较

R2 已经区分机器门、独立 Verifier 和 USER-ACCEPTED，因此制度本体没有缺失，判定 `NO_NOVELTY`。缺口发生在 Tailor R04.1 的 member-level 证据：内部 `interactiveSourceReviewApproved=true` 只证明来源/运行截图检查，不具备逐款拼接完整性、褶皱合理性与上身形态的验收字段。

## 可反驳假设

若在同一 60 行成员账本中要求：

1. result loadable；
2. seam integrity；
3. fold plausibility；
4. on-body shape / fit visual；
5. independent verifier result；
6. user acceptance 保持独立；

则 R04.1 会被正确保持为 HOLD，而不会因为 7 款静态通过或内部截图批准而被提升为用户可接受成衣。

## 最小回放

10/10 检查按预期工作：

- 来源谱系：scoped pass；
- 60 款试跑：事实成立；
- 材料覆盖 57/60：HOLD；
- solver 覆盖 37/60：HOLD；
- 静态通过 7/60：HOLD；
- seam 逐款视觉账本：缺失，HOLD；
- fold 逐款视觉账本：缺失，HOLD；
- on-body shape 逐款视觉账本：缺失，HOLD；
- USER-ACCEPTED=false：HOLD；
- 终态未误晋级：`HOLD_R041_USER_VISUAL_FIT_AND_CATALOGUE_INCOMPLETE`。

## 适用边界

只更新 Tailor 既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`。不新增全局门禁，不降低静态阈值，不否定 R04.1 的原共同人物、原纸样、真实 solver、公网字节及实时重算证据；不修改生产 Mother 分支。

## 是否采用

`UPDATE_EXISTING_REGRESSION_CASE_NO_NEW_CASE`。

下一生产动作必须是逐款形成可加载结果并补齐 seam / fold / on-body visual ledger。已失败、中止或未加载成员保持显式失败，禁止以缓存图、内部静态通过或总数文档替代。

## 生命周期

- POSTED: true（PR #181 comment 6093407697）
- ACKNOWLEDGED: true（R04.1 已承认不完整）
- IMPLEMENTED: true（来源修正与现有门）
- GATE-RUN: true（N128 10/10）
- ADOPTED: false
- USER-ACCEPTED: false

## 指标

- 首次候选通过率：unknown
- 用户纠错次数：本轮新增 1
- 同类错误复发率：unknown
- rejected lineage 继承次数：0（R04.1 未复用 R03 runtime）
- stale delivery 次数：0
- 每个 accepted delta 的内部迭代数：unknown
- 指令到合法 candidate 时间：unknown

路由回执：https://github.com/haihao0307/guilin-dem-pipeline/pull/181#issuecomment-6093407697
