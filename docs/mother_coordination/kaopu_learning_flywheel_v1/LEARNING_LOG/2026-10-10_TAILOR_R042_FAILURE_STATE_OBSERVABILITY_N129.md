# N129 · Tailor R04.2 显式失败状态回放

## 单一 bounded question

R04.2 的精确测试/公网对象，是否把 60 款中的每一款都归入有理由的可执行显示结果，而不是让错误或无画面卡片继续由用户判断？

## 现有真实失败

用户在 R04.1 后继续指出：有小项仍错误，部分卡片报错或完全不显示；这些问题必须修完，之后才进入布料物理、人物穿着、旧搭配组合保留和跨人物/松量/特殊要求参数化。

## 外部方法 / 证据

- Google SRE《Monitoring Distributed Systems》要求监控同时回答“什么坏了”和“为什么”，并让人类信号可执行：https://sre.google/sre-book/monitoring-distributed-systems/
- NASA Systems Engineering Handbook 要求 validation 分析异常、提出纠正动作，并在产品转移前妥善处理异常：https://science.nasa.gov/wp-content/uploads/2023/04/nasa_systems_engineering_handbook_0.pdf

## 与 KAOPU R2 比较

`NO_NOVELTY`。R2 已要求显式失败、禁止 silent fallback、精确 tested subject、新鲜度与用户非第一层 QA。本轮只验证 Tailor 对既有制度的落实，不新增全局门槛。

## 可反驳假设

若 R04.2 要求 60 款精确覆盖为“有结果”或“显式失败”，失败行均有 phase/reason，缩略图读取失败与求解/材料失败分离，并以精确公网 subject 回读，则空卡片/错误卡片的可观察性纠正可以 scoped pass；任何未修款仍须 HOLD。

## 最小回放

12/12 通过：

- 60 个原预设；
- 45 个求解结果，9 静态通过、36 有结果待修；
- 15 个显式失败，12 求解中止、3 材料/缝边拒绝；
- 结果与失败 union=60，overlap=0，15/15 失败均有 reason；
- 本地与公网 UI 均显示 60/9/36/15，明确“不是加载等待”；
- PNG 读取失败独立于求解失败，公网回放为 0 读取错误、0 浏览器异常；
- run 38022155568 绑定 native subject `bbe7256…`，artifact 11658324974；
- run 38023440805 绑定 runtime/public subject `e292aa7…`，artifact 11659891241。

当前 PR head `f6da407…` 是 R04.3 source-transfer payload WIP，精确 head 查询为 0 workflow run，不继承 R04.2 的 GATE-RUN。

## 适用边界

只通过“错误/无画面卡片状态可观察、可分类、可追因”。这不等于 15 款失败已修复，也不认证剩余 36 款视觉质量、布料物理、动态穿着、旧搭配组合、跨人物尺码/松量/特殊要求参数化或用户接受。

## 决定

`R042_FAILURE_STATE_OBSERVABILITY_VERIFIED_SCOPED__HOLD_REMAINING_VISUAL_FIXES_AND_PHYSICS`

更新既有 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，不重复造 case，不修改生产 Mother、main、R2 或门槛。

生命周期（路由前）：ACKNOWLEDGED / IMPLEMENTED / GATE-RUN=true；POSTED / ADOPTED / USER-ACCEPTED=false。

## 路由回执

- PR #181 comment: https://github.com/haihao0307/guilin-dem-pipeline/pull/181#issuecomment-6094343879
- 生命周期：POSTED / ACKNOWLEDGED / IMPLEMENTED / GATE-RUN=true；ADOPTED / USER-ACCEPTED=false。
