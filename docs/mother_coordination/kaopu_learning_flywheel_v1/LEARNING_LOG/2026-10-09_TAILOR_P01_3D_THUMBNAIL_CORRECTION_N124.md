# N124 — Tailor P01 纸样绿色不得覆盖后发三维成衣缩略图纠正

Date: 2026-10-09 13:45 +08:00  
Status: **new user-correction regression / Tailor-only Candidate / old paper contract remains scoped-valid**  
Scope: Tailor P01 预设浏览卡；不修改 Tailor 生产分支、`main`、`gh-pages`、R2 或现行阈值

## Bounded question

P01 在用户纠正前取得的 60 个纸样缩略图绿色公网回执，能否证明用户随后要求的“每个预设使用三维成衣缩略图，可穿在简易塑料橱窗人台上表达效果”已经完成？

## 现有真实失败

基线读取：`main@5bdd2d6aa4989ac6acedb99411c207c267b8937b`；根 `AGENTS.md`、R2、reference gate、freshness gate 均未变化。#91 最新真实反馈仍为 N75 的查询范围纠正（comment `5979603278`）；#63 最新真实反馈仍为 N49（comment `5910449798`）。

上一轮 N123 记录的两次 P01 浏览器失败之后，[run 37881219569](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37881219569) 在精确源 `637ef1f9bad233cfed06e7d191fe15263b378bbc` 成功：全部 workflow 步骤成功，artifact `11595152743` / `sha256:471a1cd516dede9e0b8d3b47de4af8378ec6a14d323552578d47b1df38372c8a`，并保留早先两次失败。这个终态可以解除“纸样预设本地→发布→公网”的技术 HOLD，但它的明确测试对象是 `Real paper thumbnails` 与 `all 60 real paper thumbnails load`。

时间与目标发生了后续变化：

- tested source 提交时间：2026-10-09 11:51:56 +08:00；artifact 完成于约 12:10:52 +08:00。
- 用户随后约 13:20 +08:00 明确纠正：纸片看不直观；每一个预设应做成三维成衣缩略图，可用专门的简易塑料橱窗模特表达，不要求穿在真实人物上。
- 当前 PR #178 head 为 `78eb5030f791735037d20b1dfe32a9044845ef34`；当前 `gh-pages@716631d614e9dc73eab7a1551f3e925da9adc485` 的 P01 仍是同一旧合同。`index.html` blob `6e82c4bec45fa4ae3a7694317aca9c0a7b8072e5` 明写“缩略图来自真实纸样，不是成衣照片”；`app.mjs` blob `6792673b3c8ec551b4b7cc585fe611ac5494fe0e` 仍将 `r.thumbnail` 放入 `<img>`，调用 `paperSVG`，且没有 WebGL、Three、Canvas、mannequin 或 model-viewer 信号。
- P01 当前树的 60 个缩略图全部位于 `thumbs/*.svg`；没有纠正后的三维缩略图派生产物、逐预设 3D 身份回执或覆盖测试。

所以旧公网不是伪造：它是旧“纸样预设库”合同的合法 scoped delivery；但从最新纠正开始，它只能作为 `BASELINE_ONLY_PRE_CORRECTION`，不能冒充三维缩略图的新成果。当前新合同状态为 `NO_NEW_3D_THUMBNAIL_ARTIFACT`。

## 外部方法 / 证据

- NASA Software Engineering Handbook 的 requirements guidance 说明，需求变化时 traceability 用于识别受影响的设计、文档、源码与测试，也能发现“需求没有对应测试”或“测试不再服务当前需求”的情况。
- NASA SWE-071 明确指出，软件需求变化需要同步更新测试和验证计划/过程，否则会产生未测试需求及错误验证。

外部方法支持“变更需求必须重新绑定实现与测试”；KAOPU 的 Task Anchor、最新用户指令优先、Regression Case 与 stale/wrong-target 状态仍由现有 R2、root AGENTS 和 freshness hard gate 决定。

## 与 KAOPU 当前制度比较

现有制度已经规定：

- 旧 README 与旧任务若和新 Task Anchor 冲突，只能作为历史；
- 即使产生新 commit，做错 targetObject 也不算完成；
- 每个重要用户纠正必须转成 Regression Case；
- “三维”不得用纸面或图片替代，但本例还需保留一个边界：用户允许静态缩略图，只要求其可追溯地来自真实三维成衣/人台表达，不要求每张卡本身都是交互式 WebGL。

因此不是新全局制度。由于现有 `TREE-NO-2D-CANVAS-AS-3D-001` 针对“把 Canvas2D 冒充交互 3D”，并不覆盖“用户允许静态三维渲染，但当前仍只有纸样 SVG”的精确合同，本轮建立一条 Tailor-only 去重回归 `TAILOR-PRESET-3D-THUMBNAIL-CORRECTION-001`，不扩张为全局门禁。

## 可反驳假设

若把旧纸样合同和后发三维缩略图合同分开，则：

1. 成功 run 若早于纠正且只断言纸样缩略图，必须得到 `HOLD_LATEST_USER_CORRECTION_UNTESTED`；
2. 当前卡片仍直接显示 `thumbs/*.svg` 纸样时，必须得到 `REJECTED_WRONG_TARGET_PAPER_THUMBNAIL`；
3. 只生成部分预设的三维缩略图，必须得到 `HOLD_COLLECTION_MEMBER_COVERAGE_INCOMPLETE`；
4. 每个合格成员必须绑定 preset ID、设计/纸样 identity、三维成衣 geometry identity、简易人台 identity、相机/渲染配置与最终 thumbnail digest；
5. 60/60 成员及网页卡片 readback 全部绑定后，只允许 `THREE_D_PRESET_THUMBNAILS_VERIFIED_SCOPED`，不自动晋升 `physicalFitAccepted`、`dynamicWearCertified` 或 `USER-ACCEPTED`。

## 最小历史回放

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/tailor_p01_3d_thumbnail_correction_n124.mjs`

结果 `10/10`：真实当前 subject 被判为 `REJECTED_WRONG_TARGET_PAPER_THUMBNAIL`；旧绿色仍保持 `PAPER_PRESET_LIBRARY_VERIFIED_SCOPED_PRE_CORRECTION`。负控拒绝旧测试继承、部分 3D 覆盖与缺少逐成员身份；只有合成的 60/60 可追溯 3D 缩略图控制组获得 scoped pass。结果保存于 `PROBES/tailor_p01_3d_thumbnail_correction_result_n124.json`。

## 适用边界 / 是否采用

- 决定：`REJECTED_WRONG_TARGET_PAPER_THUMBNAIL`（仅针对把当前 P01 当作后发三维缩略图纠正的完成证明）。
- Causal state：`PAPER_CONTRACT_PASSED_BEFORE_3D_THUMBNAIL_CORRECTION_CURRENT_PUBLIC_STILL_PAPER_ONLY`。
- 保留：run 37881219569 对旧纸样合同的真实 scoped success；不把它回写成失败，也不删除 N123 的两次失败谱系。
- 当前缺口：纠正后的 Task Anchor、60 个三维成衣/简易人台缩略图、逐成员来源回执、网页覆盖测试与用户验收。
- 非要求：不强迫每张缩略图使用交互式 WebGL；可接受由真实三维几何离线渲染出的静态图片。不得用二维纸片、随机概念图或同一成衣换名重复。
- 不证明：物理合身、无穿模、自碰撞、动态穿着、真实人物实时试衣或手机实机。上述状态继续独立。
- 生命周期：协调增量 `POSTED` 需以 PR #179 的实际路由评论为准；当前 regression/probe `IMPLEMENTED=true`、`GATE-RUN=true`；`ACKNOWLEDGED=false`、`ADOPTED=false`、`USER-ACCEPTED=false`。
- KPI：可直接确认 1 次用户纠正进入回归；其余首次通过率、同类复发率、stale delivery、accepted delta 内部迭代及合法 candidate 时间均 `unknown`。
- 第一梯队外部 AI：未调用。
