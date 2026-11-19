# N318 — ZX85 显示器来源绑定状态机候选

- 日期：2026-11-19（Asia/Shanghai）
- 基线：N317 `8281af1753a65f6afabbe484027038a732ab4c4b`
- 生产 / main / R2 修改：无
- Teacher 状态：`NO_NOVELTY`

## 唯一 bounded question

两份用户冻结的一手 Hitachi PDF 能否转换成“每个屏幕、入口事件、退出事件、可选条件、状态转移都可追到具体来源页”的最小合同，从而阻止只画静态图标、补造界面、忽略可选性或编造交互？

## 新来源事实

本轮首次纳入用户冻结的 9 页 ZX85USB-5A 宣传册与 376 页 75U-5A / 85USB-5A 操作手册。宣传册明确 7 英寸高分辨率彩色 monitor + multifunction controller；手册 PDF 第 63–129 页给出菜单树、基本屏 16 个字段、启动状态、密码、告警、自动停机、后视相机、显示项、信息/维护/监控和实体控制器动作。

关键不是“有这些图标”，而是来源同时规定了条件和转移：Alarm List 仅在当前告警存在时出现；后视相机是可选配置；自动停机有 30 秒/15 秒告警阶段和先导杆中止条件；ACC 与 ON 进入不同显示；实体旋钮 Push/Rotate 分别确认与移动光标。

## 可反驳假设与最小试验

假设：把 `screenId + sourcePdfPages + entryEvents + exitEvents + availabilityGuard` 和 `from + event + guard + to + replay receipt` 设为最小合同，可以拒绝静态假完成、无来源创作、可选项硬编码和无触发器状态。

探针：`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/n318_monitor_source_state_gate.mjs`

结果：6/6 fixture 通过。

- 合法来源绑定状态图：PASS
- 静态图标无行为：`HOLD_MONITOR_STATIC_ICON_ONLY`
- 无来源创作屏：`HOLD_MONITOR_SCREEN_SOURCE_MISSING`
- 可选相机被当作标配：`HOLD_MONITOR_OPTIONALITY_CONTRADICTION`
- 告警转移缺少当前告警 guard：`HOLD_MONITOR_STATE_TRANSITION_CONTRADICTION`
- 交互屏无控制器事件：`HOLD_MONITOR_TRIGGER_UNBOUND`

## 去重与边界

同轮液压管路纠错不新造 case：它已被 `CANDIDATE_GEOMETRY_TIME_NOT_RELATION_GRAPH_001` 的父级/从属/传动关系层覆盖，定向路由即可。本轮候选不证明生产 LCD 已实现，也不证明全部 376 页已吃透；只建立第 63–129 PDF 页的第一段可回放合同。

决定：`CANDIDATE_SOURCE_STATE_CONTRACT_DEFINED_HOLD_PRODUCTION_FUNCTIONAL_REPLAY_UNVERIFIED`

状态：POSTED 待 #91 回执；ACKNOWLEDGED=false；IMPLEMENTED=candidate regression only；GATE-RUN=true；ADOPTED=false；USER-ACCEPTED=false。
