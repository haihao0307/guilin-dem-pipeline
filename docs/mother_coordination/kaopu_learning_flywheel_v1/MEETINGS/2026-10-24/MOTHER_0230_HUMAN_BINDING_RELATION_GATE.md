# Mother 02:30 — 人物部件关系兼容门禁

- 记录 ID：KAOPU-MOTHER-20261024-HUMAN-BINDING-R1
- 实际开始：2026-10-24 02:30:08 +08:00
- 主问题：只换了新脸、而身体/绑定/骨架/动作没有作为一组受控升级时，怎样阻止“各部件都新、组合仍穿模”的候选进入用户视野？
- 范围：协调与门禁；不修改生产 Mother 分支，不派发新资产，不改变 R07 已接受的皮肤主线与 NPC R04 已完成的有限验证。
- 协议：R2 Production OS；复刻任务 `REPLICATION_LOCKED`，`CREATIVE_AUTHORIZATION=false`。

## 会前事实

1. main 当前 head：`5543f756ca3af1428323696324303fa70b8de850`。
2. 本轮使用的强制协议版本：
   - 根 `AGENTS.md`：`251b664646a489e9292748f1d41998ee62a338f5`
   - `MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md`：`d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
   - 复刻禁止创意替代门禁：`8c0a49c71865ef76cbc614f8188239bc808a8278`
   - 新鲜度与禁止旧交付门禁：`4754a90a94e4a9e7806357b6eb292e5c713e9021`
3. #91、#63 自上一轮协调会后没有新 Mother 回执；本轮不能记录 ACKNOWLEDGED、ADOPTED 或 USER-ACCEPTED。
4. NPC R04 当前 PR #329 head 为 `47d158851f67f472a56e1e8a7582a1605f66f232`；固定公开运行版本仍为 `b386dd9780ddc5b01676fe46117d56d973725ac7`。其回执明确不证明动作自然度、完整全身动力学或生产就绪。
5. `CURRENT_HUMAN` 将 `HUMAN-INTEGRATED-R07` 记录为已进入主线的皮肤/人物基线，但其 USER-ACCEPTED 范围不是一份完整的“身体网格—皮肤绑定—骨架—逆绑定—动作—坐标系”组合认证。
6. 学习飞轮 N186 是 Candidate：11/11 分类重放通过，但没有在真实生产人物上执行组合兼容与全身自穿模门禁。

## 唯一决定

把“新鲜度”与“关系兼容”设为连续而独立的两道门：

1. **组件身份门**：先解析唯一受检人物的 body mesh、skin binding、skeleton、bind pose/inverse binds、motion、coordinate frame 的精确固定引用。任一引用为 UNKNOWN，状态保持 `HOLD_GATE_FAIL / HOLD_COMPONENT_IDENTITY_UNRESOLVED`，不得用“latest”或文件名相似代替身份。
2. **关系兼容门**：身份完整后，仍须证明 joint order、skeleton parent、inverse-bind order、bind pose、motion target 与 coordinate frame 相容；否则 `REJECTED_BINDING_RELATION_MISMATCH`。
3. **运行行为门**：关系静态相容后，在固定动作套件中检查已声明区域的全身自穿模。未运行或缺独立验证，保持 `VERIFYING`；超出事先声明阈值，`HOLD_GATE_FAIL`。
4. 三门通过只产生 `CANDIDATE_READY`，不等于 ADOPTED 或 USER-ACCEPTED。自然度、美学与完整连续碰撞仍是更外层问题。

N186 扩展既有新鲜度门，不新建重复回归类别，也不推翻 NPC R04 已有的架构、公开运行与局部外物接触证据。

## 责任端

- 唯一接收端：Game / NPC integration line（PR #329）。
- Human 主线只提供 R07 已接受范围内的来源身份；Producer 不自我批准组合兼容。
- 本轮没有真实 Mother 新回执，因此状态仅为 `POSTED`，不是 `ACKNOWLEDGED` 或 `IMPLEMENTED`。

## 最小验证

在一个固定人物、一个固定 commit 上：

1. 回执写出六类实际组件引用及其来源 SHA，并记录 joint-order、inverse-bind-order、skeleton-parent、bind-pose、motion-target 与 action-trace digest。
2. 固定动作套件至少包含：交叉手臂、躯干弯曲、抬腿；预先声明采样身体区域、采样时刻、阈值与误差边界。
3. 独立验证者运行四个必须失败的负控：
   - `SHUFFLED_JOINT_ORDER`
   - `STALE_BIND_POSE`
   - `MISSING_MOTION_TARGET`
   - `DISABLED_SELF_COLLISION_GATE`
4. 真实候选记录最大穿入量及对应动作/部位；不能用骨长测试、权重和为 1、构建成功、截图存在或页面可打开替代。
5. 视觉变化仍须在同一当前 head 的固定 HTTPS 页面核验桌面与 390×844 视口；390×844 只记浏览器视口，不冒充手机实机。

## 未完成边界

- 权威的完整身体/绑定/骨架/动作组合引用尚未解析。
- 用户指出的动作自穿模尚未在精确受检人物和固定动作上复现、测量或消除。
- N186 尚非生产 `GATE-RUN`；本轮没有 Mother ACK、实现提交、采用或用户接受。
- 当前结果不证明自然动作，也不声称连续全三角形碰撞已经解决。

## 交付状态账

- 方法与门禁：`POSTED`
- Mother 回执：无
- 实现：无
- 生产 Gate Run：无
- Adopted：无
- User-Accepted：无

## 学习飞轮下一题

怎样为网页实时人物选择一个**有界、可重复、能抓住真实动作自穿模**的身体区域/动作/时间采样方案与阈值，同时明确遗漏概率，避免把离散抽样误称为通用连续碰撞证明？

## 接续触发点

仅当 PR #329 或权威 Human 来源新增以下任一证据时接续：完整组件固定引用、绑定关系 manifest、固定动作穿模测量、四项负控结果、独立验证回执。没有这些增量，不重复发同一指导。
