# N319 — ZX85 先导锁止杆安全因果门禁

- 日期：2026-11-19（Asia/Shanghai）
- 基线：N318 `4de6d7dcbbc50d4c62f6c6b3b195f94b37071c9b`
- main 基线：`ad7b81175df8bc9c54cf40effe1029f86696ba76`
- 生产 / main / R2 修改：无
- Teacher 状态：`NO_NOVELTY`

## 唯一 bounded question

能否用来源绑定的因果状态机，拒绝“驾驶室里画了锁止杆，但锁止杆不真正控制启动权限、行走、回转和工作装置”的假完成？

## 新真实失败与来源事实

用户明确：发动机可以启动，但驾驶员没有把锁止杆推到工作位置以前，挖机不得前后行走，也不得操纵大臂、小臂和挖斗；这是安全防护，不是装饰件。

冻结的 Hitachi 操作手册补足了 N318 未读的控制页：

- PDF 第 179、200 页：ZX85USB-5A 启动前锁止杆必须在 `LOCK_UP`；其他位置不得启动。
- PDF 第 200 页：发动后，先确认全部操纵杆和踏板中位，再慢慢把杆推到 `UNLOCK_DOWN` 才开始作业。
- PDF 第 200 页：若解锁后控制仍中位却有任何执行器动作，必须立即拉回 LOCK 并停机。
- PDF 第 199 页给出左右 ISO 操纵杆的八个动作；第 187–188 页给出行走、倒车、单边转向和原地回转关系。

## 最小可反驳试验

候选合同冻结四个状态：`ENGINE_OFF_LOCKED`、`ENGINE_RUNNING_LOCKED`、`ENGINE_RUNNING_UNLOCKED_NEUTRAL`、`FAULT_NEUTRAL_MOTION`，并要求锁止覆盖 `FRONT_ATTACHMENT / SWING / TRAVEL` 三个域。

探针：`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/n319_pilot_shutoff_interlock_gate.mjs`

结果：7/7 fixture 通过：

- 锁止状态合法启动且全域无动作：PASS
- 解锁状态仍能启动：`HOLD_PILOT_START_INTERLOCK_BYPASSED`
- LOCK 状态产生动作：`HOLD_PILOT_LOCKED_MOTION`
- 非中位解锁：`HOLD_PILOT_UNLOCK_WITH_NON_NEUTRAL_CONTROL`
- 中位却有动作且无立即锁止停机回执：`HOLD_NEUTRAL_ACTUATOR_MOTION + HOLD_PILOT_FAILSAFE_RECEIPT_MISSING`
- 未覆盖行走域：`HOLD_PILOT_INTERLOCK_DOMAIN_INCOMPLETE`
- 没有冻结来源页却声称验证：`HOLD_PILOT_INTERLOCK_SOURCE_MISSING`

## 边界与决定

本轮不把左右摇杆八向映射和行走转向全部塞进同一 case；它们已经成为下一轮明确问题。本试验只证明候选状态语义能拒绝安全联锁假完成，不证明生产 ZX85 运行时已实现。

决定：`CANDIDATE_INTERLOCK_CAUSAL_CONTRACT_DEFINED_HOLD_PRODUCTION_REPLAY_UNVERIFIED`

状态：POSTED 待 #91 路由；ACKNOWLEDGED=false；IMPLEMENTED=candidate regression only；GATE-RUN=true；ADOPTED=false；USER-ACCEPTED=false。
