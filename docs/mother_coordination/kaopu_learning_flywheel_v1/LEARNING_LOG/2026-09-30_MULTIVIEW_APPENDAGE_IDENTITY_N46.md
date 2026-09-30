# N46 — 多视图附肢身份一致性候选门禁

## 单一 bounded question

四张分别生成的参考图，在没有跨视图持久化附肢身份表时，能否被接纳为同一只关节动物的 3D 老师？

## 现有真实失败

- 2026-09-30，用户明确拒绝一组椰子蟹四视图，指出“蟹腿数量不对”，继续生成会造成严重模型错误。
- `work/kaopu-crab-triad-r01-20260930` 的 Task Anchor 已要求附肢数量、左右、角色、节段和关节框架有来源证据，但当前 contract test 只验证结构字段，不验证同一附肢在四个视图中的身份连续性。
- 四张图片本轮两次读取均遇到临时下载错误。因此本轮不声称独立数出了哪一张多/少哪一条；精确差异保持 `UNKNOWN`。用户拒绝本身足以使该 source set 退出模型老师资格。

## 外部方法 / 一手证据

1. COLMAP / Structure-from-Motion 的官方论文与文档把跨图像 correspondence、几何验证和轨迹连接作为多视图重建的前提。没有可验证对应关系的独立生成解剖，不能仅凭“角度名称”当作同一个对象。  
   - https://openaccess.thecvf.com/content_cvpr_2016/html/Schonberger_Structure-From-Motion_Revisited_CVPR_2016_paper.html  
   - https://colmap.github.io/
2. 一手形态研究指出椰子蟹有五对步足/胸足，且第五对很小、位于甲壳下并承担呼吸器官清洁功能。这说明“图上没看见”不能自动等于“解剖上不存在”；门禁必须区分 `OCCLUDED` 与缺失。  
   - https://bioflux.com.ro/docs/2018.1616-1632.pdf

## 与 KAOPU R2 比较

- 已有：`REPLICATION_LOCKED`、来源证据、禁止补画、用户拒绝后不得沿用、Producer 不得自批。
- 缺口：没有可执行的跨视图附肢身份账本；同一条腿可在独立生成时消失、增生、换边或换角色，而单图仍“看起来像螃蟹”。
- 因而这是现有制度的局部可执行化，不改写 R2 全局语义。

## 可反驳假设

如果在进入模型生成前锁定 `appendageId + side + role + attachmentRegion + segmentCount`，并要求每个视图逐项标记 `VISIBLE | OCCLUDED | CROPPED | UNKNOWN`，则门禁能拦截缺失、增生、重复、左右互换、角色漂移、连接区漂移和节段漂移，同时不会把合法遮挡误判为解剖缺失。

反证条件：任一合成反例未被预期判定，或真实单 Mother 试验证明该账本无法区分遮挡与拓扑冲突。

## 最小历史回放

`multiview_appendage_identity_gate_n46.mjs` 执行 10 个合成契约用例：

- 一致拓扑且 P5 被遮挡：通过；
- 缺失、额外、重复、左右互换、角色漂移、连接区漂移、节段数漂移：拓扑冲突；
- 明确裁切、未知可见性：覆盖不完整，暂缓而非拓扑定罪。

该回放仅验证状态机与契约，不是椰子蟹生物学验证，也不替代真实图片逐视图标注。

## 适用边界

- 适用于关节动物及其他可枚举、具持久身份的多视图关节对象。
- 生成图只能是 derivative candidate；真实解剖拓扑必须拥有独立真实来源 Observation Root。
- `OCCLUDED` 允许通过拓扑一致性；`CROPPED/UNKNOWN` 只能进入 coverage hold。
- 用户已拒绝的四视图不因本候选测试通过而复活，仍为 `modelGenerationAllowed=false`。

## 是否采用

- 决定：`CANDIDATE / LOCAL_SINGLE_MOTHER_TRIAL`。
- 建议目标：只在 Crab Mother 下一次 source intake / Task Anchor 中试行，先不全局强制。
- 回滚点：`7d2c6c8c79f2731030947ba5e29d8e7f65dbd6b7`。
- 生命周期：保存后可记 `IMPLEMENTED`（候选脚本）与 `GATE-RUN`（合成回放）；路由协调 issue 后仅记 `POSTED`。没有 Mother 回执，不记 `ACKNOWLEDGED/ADOPTED/USER-ACCEPTED`。

## 效果指标

- 首次候选通过率：`unknown`
- 用户纠错次数：已观察到本次 1 条，但无可靠总分母
- 同类错误复发率：`unknown`
- rejected lineage 继承次数：`unknown`
- stale delivery 次数：`unknown`
- 每个 accepted delta 的内部迭代数：`unknown`
- 从用户指令到合法 candidate 的时间：`unknown`
