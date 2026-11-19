# N317 — ZX85 驾驶室显示器 / 后视镜角色与支撑门禁

- 日期：2026-11-19（Asia/Shanghai）
- 分支：`automation/n317-zx85-monitor-mirror-role-gate-20261119`
- 基线：N296 候选回归 `PHYSICAL-SYMMETRY-REUSE-001-N290-DEPENDENCY-CLOSURE`
- 生产修改：无
- OS / main 修改：无
- Teacher 状态：`NO_NOVELTY`（本轮新增来自真实用户纠错和现有一手证据，不需要新增外部老师）

## 唯一 bounded question

能否用“来源角色 + 内外域 + 父级/支撑边”阻止两类错误：把驾驶室内多功能显示器当成车外实体后视镜，以及把位置看似合理但无支撑的显示器当成完成件？

## 真实失败与证据

用户纠正：黑色屏幕是驾驶员上方/左侧的驾驶室内显示器，不是后视镜；所有实体镜子都在车外。显示器移动后的大方向较好，但必须连接门体或支撑，不能悬浮。发动机舱缺失体积和侧面孔洞仍未完成，本轮不混入同一问题。

精确检查点：Library 版本 319，466,345,860 bytes，SHA-256 `d7defe7024c467c028ce2bd48150f6e1f9186a45fcc0a9188ec4c720ebed12e8`，最后修改 2026-11-16T16:44:02.174617+08:00。

一手包内证据：

- `OBSERVED_STRUCTURE_R255.json` 将对象标为 `CAB-MONITOR`，记录独立安装显示器及周边支撑，并明确安装固定件、边框尺寸和精确屏体几何仍为 UNKNOWN。
- 制造商材料分别讨论车外镜子与驾驶室内 monitor；可选 rear-view camera feed 是显示模式，不把显示器的实体角色变成 mirror。
- `CONSOLE_MIRROR_QA_R261.json` 中的 mirror 是左右控制件的几何/奇偶镜像操作，不能当作“后视镜”语义证据。
- v319 早于 11 月 19 日用户纠错；未发现纠错后的新检查点，因此生产修复状态保持未验证。

## 可反驳假设与最小试验

假设：组件合同若同时绑定 `sourceRole`、`functionalRole`、`interiorExteriorDomain`、`parentObjectId`、`supportEdge`，就能拒绝角色错置和悬浮摆放，同时不把 rear-view camera 显示模式误作实体镜子。

执行：

`node docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/n317_monitor_mirror_role_gate.mjs`

结果：5/5 fixture 通过，exit 0。

- 合法 `CAB-MONITOR` + interior + 支撑：PASS
- `CAB-MONITOR` 攵称 rear-view mirror：`HOLD_COMPONENT_ROLE_SOURCE_CONTRADICTION`
- 无父级/支撑显示器：`HOLD_COMPONENT_PARENT_BINDING_MISSING`
- 车外镜子无可视性回放：`HOLD_MIRROR_VISIBILITY_RECEIPT_MISSING`
- monitor 显示可选 rear-view camera feed：仍保持 monitor 角色并 PASS

## 边界与决定

试验只验证候选状态语义，不证明 v319 的显示器几何正确、真实支撑已实现、外部镜子已实现，也不代表 Mother 认可、制度采用或用户验收。

决定：`CANDIDATE_GATE_RUN_PASS_HOLD_PRODUCTION_MONITOR_ROLE_AND_PARENT_BINDING_UNVERIFIED`

状态：

- POSTED：true（#91 comment 6999066300）
- ACKNOWLEDGED：false
- IMPLEMENTED：candidate regression only
- GATE-RUN：true
- ADOPTED：false
- USER-ACCEPTED：false
