# KAOPU Learning Flywheel N272 — rendered provenance 不得被 source-only notice 掩盖

## 本轮唯一 bounded question

当 Weather 候选仍保留第三方 teacher code 时，源码注释和未从界面链接的 README 是否足以支持把用户可见的“原作参考 / Teacher Replica / 老师原式”全部移除？

## 前置读取与选择

重新读取当前 `main@73452580929bc9cc37a8e57d79da69af994af808` 的根 `AGENTS.md`、R2 OS、reference-replication gate、freshness gate、#91/#63 最新回执与适用历史证据。三份门禁及根 AGENTS blob 未变；#91 对 N271 仍无 Mother ACK。

本轮不继续泛测 FPS。R50/R51 对“用户看到什么 provenance”做了明确源码变更，且与用户最痛的“参考被改写成自己的结果”直接相关，优先级高于已在 main 内容层完成回滚的误加 motion README。

## Exact history replay

### R49：rendered disclosure 存在

- commit: `240e8007ed764cd3cbbea8922b69fb5814022bed`
- `pink.html` / `interactive.html` 的可见 bar：`拖动观察 · 原作参考`
- source notices 同时保留。

### R50：source truth 保留，rendered disclosure 被移除

- commit: `e3d5c67a655260f80cf2b8c90f0be188fb65a3ee`
- 两页可见 bar 变为：`拖动观察`
- pink embedded shader 仍含 @teadrinker、CC BY-NC-SA 4.0、原作链接及大量 teacher shader；
- interactive embedded shader 仍含 @lumiey 与 MIT notice；
- README_R50 明确说明并非完整独立重写。

### R51：进一步隐藏 teacher identity 与入口

- commit: `0b574765e7a87158d01018711d53834a5ad97d65`
- `WEATHER MOTHER / TEACHER REPLICA` → `WEATHER MOTHER`
- `TINY CLOUDS / lsBfDz` → `连续噪声云海`
- `老师原式` control 设为 `hidden`
- `云中飞行参考` → `云中飞行`
- README_R51 说明这是有意隐藏，但内部来源和版权仍保留。

因此 exact source layer 与 rendered claim layer 的真实性不再一致。

## 外部方法 / 证据

Creative Commons 官方 BY-NC-SA 4.0 legal code 进入 `TEACHER_CANDIDATE / AUDITION`，仅限 attribution 这个 bounded domain：

- 分享原件或改编件时，应保留 supplied creator/copyright/license/disclaimer/source URI；
- 必须标明修改并保留此前修改说明；
- attribution 可按 medium / means / context 采用合理方式完成，因此不要求把长许可证永久铺在主 UI；
- 官方实践建议用 Title / Author / Source / License（TASL）和可访问链接。

来源：

- https://creativecommons.org/licenses/by-nc-sa/4.0/legalcode.en
- https://wiki.creativecommons.org/wiki/Best_practices_for_attribution
- https://opensource.org/license/mit

它相对 KAOPU Current Best View 的明确新增：KAOPU 已记录 source provenance，却没有独立验证 rendered delivery 是否仍向用户呈现或可访问地链接 creator/source/license/modification status。

限制：MIT 本身只要求 notice 随 copies/substantial portions 保留；本轮不声称 MIT 强制在主 UI 显示署名，也不作法律结论。

## Candidate / replay

新增去重后的 Candidate：`CANDIDATE_USER_VISIBLE_PROVENANCE_NOT_HIDDEN_001`。

合成 + exact-history replay：**6/6 PASS**。

允许：

- 自有独立实现且 exact source identity 闭合；
- rendered surface 明示 teacher/reference；
- 紧凑 UI 提供一个可见、可用、digest-bound 的 Sources/About 链接。

拦截：

- `HOLD_USER_VISIBLE_PROVENANCE_HIDDEN`
- `HOLD_RENDERED_CLAIM_SOURCE_TRUTH_MISMATCH`
- `HOLD_SOURCE_NOTICE_MISSING`
- `HOLD_SOURCE_IDENTITY_UNBOUND`
- `HOLD_MODIFICATION_STATUS_UNDECLARED`

## Decision

R50/R51：`HOLD_USER_VISIBLE_PROVENANCE_HIDDEN`。

- source notice：PASS（保留）
- rendered claim：HOLD
- 法律充分性：`UNKNOWN_CONTEXT_DEPENDENT`
- visual quality / performance：本轮不判断
- promotion：HOLD

最小单-Mother 试验：只给 R51 增加一个可见 Sources/About 控件，绑定 creator/source/license/modification receipt 与 digest；真实渲染验证链接可用。缺失、断链或 digest 不符即 fail closed。

## 边界 / lifecycle

本轮未改 Weather 生产文件、main、R2、全局门禁、公网页或排程；未跑 browser/device/production/user acceptance。

写入时 Candidate probe `IMPLEMENTED`，synthetic + history `GATE-RUN`；定向评论发布后才是 `POSTED`；`ACKNOWLEDGED / ADOPTED / USER-ACCEPTED=false`。
