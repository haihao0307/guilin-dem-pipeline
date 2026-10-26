# Mother 02:30 — Motor 门铰链根因审查

- 记录 ID：`KAOPU-MOTHER-20261027-MOTOR-HINGE-RCA-R1`
- 实际开始：2026-10-27 02:34:46 +08:00
- 实际结束：2026-10-27 02:36:33 +08:00
- 实际参与：小妈（主持、源码与回放证据核对）
- 异步证据：Motor Mother 的 main 提交；学习飞轮 N194/N195
- 未取得：Motor Mother 本轮实时确认；其他 Mother 回签；外部专家
- 本轮唯一问题：动画候选是否真正满足“车门绕边缘铰链、侧窗随门运动”

## 强制协议读取

- 根 `AGENTS.md`：`251b664646a489e9292748f1d41998ee62a338f5`
- R2 Production OS：`d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- Reference gate：`8c0a49c71865ef76cbc614f8188239bc808a8278`
- Freshness gate：`4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #63：无与本问题相关的新生产回执
- #91：N194 与 N195 为本轮直接输入

## R2 九项核对

| 项 | 结果 |
|---|---|
| taskId / targetObject / targetDefect | 正式 Task Anchor 未找到。有限对象为四车型动画 R01；缺陷为门的旋转轴不在声明的边缘铰链 |
| accepted baseline / baseSha | 用户接受 baseline：`UNKNOWN`；技术 base：`01907c4676df0160f85282229f9bfa965a944e09` |
| 用户最后约束 | 程序化母体需要真实部件关系；代码、动画和页面存在不等于机构正确；最终交付需固定公网链接与实际浏览器验证 |
| referenceSet / UNKNOWN | 没有绑定真实车型参考集；本轮只检查内部机构合同。外观、比例、真实车型身份均 `UNKNOWN` |
| forbidden routes | 禁止用动画看起来能动、中心旋转、文字“铰链”、页面标题“发布”或 Producer 自证代替关节固定点证明 |
| fresh head delta | `47d416556dc6bcb4bac4078a9c81bd64faa8f70a`；侧窗已继承门旋转，但门仍绕中心 |
| regression | 复用 `MOTOR-ARTICULATED-CHILD-TRANSFORM-001`；不重复建 case |
| machine/reference/browser gates | N195 为 source + numeric GATE-RUN；commit-bound workflow/status 为 0；浏览器、GPU、真实参考与用户视觉验收未执行 |
| 当前状态 | `HOLD_GATE_FAIL / ROOT_CAUSE_REVIEW` |

## 核对事实

R05 的门和侧窗两项都失败。动画 R01 的侧窗改为共享门旋转前缀，`WINDOW_CHILD_ATTACHMENT=PASS`；门仍为：

```text
T(doorCenter) * RY(theta) * S(door)
```

65° 数值回放：

- 门中心位移：0
- 候选边缘铰链漂移：`0.752219452` 模型单位
- 侧窗世界中心位移：`0.198146305` 模型单位
- window→door 相对变换：保持

因此 `HINGE_FIXED_POINT=FAIL`，overall 为 `HOLD_PARTIAL_FIX`。这是同一 bounded task 的第二轮相近失败，按 R2 进入根因审查。

## 明确决定

停止围绕中心枢轴继续微调动画、灯光或外观。根因不是角度参数，而是表示中缺少显式的：

- `jointFrame`
- `hingeLocal`
- `parentAssembly`

责任端：Motor Mother。

有限方法：

```text
worldPart =
  parentWorld
  * T(worldHinge)
  * R(axis, theta)
  * T(-hingeLocal)
  * localPart
```

门和侧窗必须共享同一 joint/assembly 前缀；侧窗保留自己的局部变换。

最小验证：

1. 回放 `0 / 15 / 35 / 65°`；
2. declared hinge 的世界位置漂移 ≤ 明示 epsilon；
3. window→door 相对变换恒定；
4. 中心枢轴负控必须被拒绝；
5. 结果绑定准确 source head 与机器可读数值。

未完成边界：没有正式 Task Anchor/Delivery Receipt；没有真实车型参考、浏览器、GPU、桌面/390×844、公网版本或用户验收。当前 main 路径不能替代固定 HTTPS 交付。

## 跨 Mother 学习增量

可迁移方法：凡是“绕某轴运动并携带子件”的对象，都应把关节坐标系作为一等状态，不从网格中心或视觉位置推断。适用候选包括车辆门/舱盖、飞机舵面、建筑门窗与人物手持物。

本轮只在 #91 发布定向说明，尚无其他 Mother 的确认或采用。

## 学习飞轮下一题

怎样用一套最小 joint-frame 合同覆盖不同 Mother 的关节对象，同时允许各领域保留自己的轴限位、闭合条件、碰撞和材料关系，而不演变成庞大统一格式？

## 状态账

- `POSTED`：#91 comment `6424299727`
- `ACKNOWLEDGED`：无
- `IMPLEMENTED`：侧窗继承修复存在；边缘铰链未实现
- `GATE-RUN`：N195 source/numeric 回放
- `ADOPTED`：无
- `USER-ACCEPTED`：无
