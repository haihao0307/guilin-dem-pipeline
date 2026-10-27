# N198 — Motor R02 装配时间轴不等于机构装配图

日期：2026-10-27  
状态：POSTED 前候选 / source + synthetic numeric GATE-RUN  
范围：Motor R02 的门铰链与父子装配；不评价视觉、车辆动力学或用户验收。

## Bounded question

main 新增的 staged-assembly R02 是否真正回应了 #91 ROOT_CAUSE_REVIEW：显式 joint frame 与 parent-child assembly；还是只增加了视觉装配时间轴？

## 当前真实 subject

- main/head：`3ccae4bde0c91973adbb81f99ec4d54bc9357ce0`
- commit：`motor: publish isolated four-vehicle staged-assembly prototype R02`
- file：`kaopu-motor-mother/experiments/motor-mother-assembly-film-r02/index.html`
- blob：`dc3534286d854d403d5da97b03ba2e2f51eba4be`
- commit-bound workflow runs：0
- combined commit statuses：0

本轮已复读：
- root AGENTS `251b664646a489e9292748f1d41998ee62a338f5`
- R2 OS `d942d44bad0bbd206ea3768d620ad60d5ddeb2bf`
- reference gate `8c0a49c71865ef76cbc614f8188239bc808a8278`
- freshness gate `4754a90a94e4a9e7806357b6eb292e5c713e9021`
- #91 latest before this run：N197 comment `6429968691`
- #63 latest：comment `5910449798`
- applicable regression：`MOTOR-ARTICULATED-CHILD-TRANSFORM-001`

## Source observation

R02 的门仍为：

`T(-.28,.40,z) * RY(doorAngle) * S(.70,.53,.05)`

这把旋转中心留在门几何中心。侧窗为：

`T(-.28,.40,z) * RY(doorAngle) * T(windowLocal) * S(...)`

因此侧窗仍能保持对门的相对变换，这是上一轮已经通过的部分。

“装配时间轴”采用一个平面 `assemblyObjects[]`；每个对象只有 stage，显示时统一做：

`T(stageOffset) * objectMatrix`

源码没有 `jointFrame / localPos0 / localPos1 / parentAssembly / parentId / hingeLocal`。所以 staged assembly 是视觉出现/爆炸时间轴，不是约束驱动的机构装配图。

## 数值回放

用门半宽 `0.70` 回放 `0/15/35/65°`：

| angle | 候选边缘铰链漂移 | window→door 相对误差 |
|---:|---:|---:|
| 0° | 0 | 0 |
| 15° | 0.182736669 | 0 |
| 35° | 0.420988119 | 0 |
| 65° | 0.752219452 | 0 |

判定：

- `HINGE_FIXED_POINT = FAIL`
- `WINDOW_CHILD_ATTACHMENT = PASS`
- `EXPLICIT_DUAL_JOINT_FRAMES = FAIL`
- `EXPLICIT_PARENT_ASSEMBLY_GRAPH = FAIL`
- `STAGED_ASSEMBLY = VISUAL_TIMELINE_ONLY`
- overall：`HOLD_GATE_FAIL_ROOT_CAUSE_PERSISTS`

五项诊断断言 5/5 命中预期。

## 去重与老师状态

不新增 regression；沿用 N194 的 `MOTOR-ARTICULATED-CHILD-TRANSFORM-001`。

N196 OpenUSD 双局部 frame 仍为 `TEACHER_CANDIDATE`，没有升级。R02 没有实现其字段语义，也没有 Mother ACK，因此不存在 `PROBATION / ACTIVE_TEACHER / ADOPTED` 证据。

## 最小生产试验

只允许一个 bounded delta：

1. 建一个显式 hinge assembly；
2. body-side 与 door-side 各自保存 local joint frame；
3. door 和 window 挂在同一 parent-child 图；
4. 装配时间轴读取该图，而不是平面 stage 列表；
5. 重跑 `0/15/35/65°`，两侧 joint frame 世界闭合且 window→door 相对变换恒定；
6. 中心枢轴负控必须被拒绝。

## 状态边界

本轮只是 source + numeric replay。未做 browser/GPU/visual/user acceptance；未修改 main、R2、公网页或生产 Mother。
