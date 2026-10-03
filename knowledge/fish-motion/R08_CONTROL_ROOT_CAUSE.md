# R08 群游控制根因与实现边界

任务 `FISH_PARAMETERIZED_COLLECTIVE_MOTION_R08_20261003`，dispatch `2026-10-03T04:27:00Z`。本文是生产工位 CPU 证据；公开三维效果、真实浏览器性能、独立审批由总装工位执行，不能由本文置为通过。文中行为系数全部为工程候选，不是这六个来源物种的生物实测。

## 保留与变化

五来源完整源表面、索引、UV、原图片、R07 眼球实例批处理及精确逆转置法线、嘴部决定、当前来源缓存和隐藏场景释放均保留。单鱼仍运行原 `tickSingle`；五来源各 1,200 次含变 dt、模式和指针的单鱼更新，snapshot、源脊椎、包围范围与 R07 精确一致。原 `deform` 函数字符串也一致。群体使用同一原脊椎/鱼鳍公式和独立时钟，替换群体移动控制。

原群体存在无关的朝向/三维 velocity 低通、接触速度投影、随后位置投影，以及隐形移动目标。新群体不使用这些路径：统一读取旧状态，局部感知，接受有界控制，再沿接受的本体朝向移动，最后统一提交。正式源码没有删减源顶点、像素、鳍、眼睛或嘴巴来换性能。

## 两次失败后 ROOT_CAUSE_REVIEW

初版 emergency `factor` 同乘 speed 和角位移虽避免穿插，却能绕过加速度界限，不能作为连续性通过。第二轮一阶轴支撑计算在 SAT 轴与盒轴近垂直时用 `sign(axis·normal)`，1e−17 的符号翻转会使预测支撑导数反号。历史失败保留在 `fish-five-r01/evidence/R08_CONTROL_ROOT_CAUSE_TRACE.json`。

当前每个缓存 SAT 平面直接计算下一步姿态的真实支撑与真实下一步 heading，而不是 old heading 线性近似：

`rate = n·(h_j(new) u_j − h_i(new) u_i) − [(support_i(new)−support_i(old))+(support_j(new)−support_j(old))]/dt`。

八维控制 Jacobian 包括 `dt*u*∂heading/∂angle` 和旋转后各轴的 `abs(axis·n)` 次梯度；遇轴投影跨零时重算。研究工位独立 CPU 核对 exact endpoint 误差 ≤1.02e−15 BL，八维有限差分误差 ≤2.86e−8，见研究工位独立记录。有限次近邻控制空间投影仍不是全局非线性可行性证明。

日志 `actualEndpointRate` 是真实固定平面端点变化；`tangentUpperBound = actual + Σ G*(选定可达边界−当前控制)` 是局部切线估计，不能称作 box 全局最优。`reviewMetricsResult.infeasible` 的历史字段名仅计数本轮有限迭代后还有残差的缓存约束，**不证明整个控制问题数学不可行**。报告同时保存真实 gap、源半包围、控制上下界、允许闭合率、残差和姿态。

## 环境 A/B 根因

五来源展示是均匀背景/雾/灯光，camera 随群中心移动，没有可见或来源证明的固定池壁。旧 `[7,2.8,5]` 展示盒持续转回慢转向的大鱼，导致前后鱼速度压低、旋转支撑占去余量、群体长期被挤在一起。不能用增加初始 gap 或降低巡游速度代替解决这个环境机制。

最终源码做相同源、seed 723、30 条、完整 OBB、初始位置/间距、120 秒八模式的匹配试验，**只覆盖 solver bounds**。证据为 `fish-five-r01/evidence/R08_ENVIRONMENT_ROOT_CAUSE.json`：

| 来源 | 固定盒平均巡游速度 | 开放海域平均巡游速度 | 固定盒最终均速 | 开放海域最终均速 |
| --- | ---: | ---: | ---: | ---: |
| herring | .096 | .621 | .040 | .663 |
| tuna-yellow-label | .393 | .785 | .298 | .848 |
| tuna-blue-label | .314 | .859 | .157 | .899 |
| colorful | .218 | .431 | .198 | .443 |
| picasso | .087 | .322 | .015 | .338 |

开放海域全部 zero emergency guard，最小完整源盒间距 .105–.123 BL；固定盒 herring 96 guard，其余虽未穿插也明显压慢。固定盒 herring 首次 guard 于 t111.13s，i5/j14 的完整控制与剩余残差已记录。此 negative control 不能作为候选提交。

生产五来源群体采用 `bounds:null`，单鱼仍有原工作区域；海狼原有限参考 habitat 是总装工位自己的显式参数，未由五来源工位修改。开放海域是展示环境的有证据选择，不是整个系统的碰撞门槛放宽。完整原 OBB 与 `.025` 间距、验收 positive clearance `.0125` 没变。

## 紧密群体与局部控制

最近六条可以全部落在一个小团内，无法稳定感知邻近团。当前最多六个方位扇区各选一条最近鱼，这是低成本工程近似，不是 Gautrais Voronoi 原算法。危险近邻独立全扫，不受六名额限制。距离核连续截断、保留后方权重；邻居更换仅影响需求，实际角速/角加速度仍受界限控制。

纯 `sin(bearing)` 在正前/正后为零，无法收回因个体 speed variation 拉长的纵列。因此加局部速度协调与有符号前后 gap 反馈，仍通过同一加速度限制。不会读取全局中心或指定永久领袖，不注入整群相同 spine/fin 相位。加强 attraction `.75→1.4`、preferred spacing `.38→.22` 的对照反使 herring 半径超过 14 BL，已拒绝，没有写入生产配置。

最终三种 seed、每种 120s（含变 dt、ray disturbance、burst point 和恢复），15 条来源轨迹全部保持感知图连接，largest component 始终 30。最近邻均距上限约 1.65–2.05 BL，末态约 1.49–1.87 BL；保守全鳍全周期 OBB 为 herring `.62/.296/.683`，它比静态身体宽度大，不能为紧密观感缩小碰撞包络。群体半径仍约 4.5–7.4 BL，紧密度与相机完整群显示必须由实际三维 QA 再检查；图连接不能冒充视觉紧密度通过。

## 稳定 ABI 与量纲

全局/CommonJS `FishSchoolingR08`：

```
create(views, params, seed)
initialize(state, {gap, passes})  // 仅初次可见前建立安全队形，并保存安全 reset 初态
step(state, dt, {mode,pointer,pointerRay,disturbance,paused})
reset(state)
snapshot(state)
clearance(state)
```

`view.position/velocity` 与应用原数组共享，不在每步创建替代视图。`view.half` 必须涵盖完整源、所有尾/鳍运动范围，`view.length` 是世界单位体长。速度 `speed/burst/maxSpeed` 单位 world length/s，加速度 `maxAcceleration` 是 world length/s²；规范化 BL/s 为 `speed/length`。角、角速、角加速度分别 rad、rad/s、rad/s²。源码默认工程范围不能称作物种测量。`preferredGap`/感知半径/初始余量由体长缩放；`gap` 是世界单位的硬约束余量。native 各变体传实际半包围和 body length，不能当所有来源一个尺寸。

坐标 head −X，`Ry(yaw)*Rz(−pitch)*Rx(roll)`，前向 `[-cos(yaw)cos(pitch),sin(pitch),sin(yaw)cos(pitch)]`。`pointerRay={origin,direction}` 对每鱼独立求正向射线最近点；`disturbance={point,strength}` 为局部脉冲。隐藏/暂停/未加载时调用者不推进模拟，或显式传 `paused:true`。native 原 60Hz/presentation 插值由总装保留；五来源沿原 variable remainder ≤1/60 路径，不在显示帧重复整套固定子步。

加速度必须区别 scalar `Δspeed/dt` 和世界 vector `Δvelocity/dt`；后者包含向心项 `u*ω` 及 pitch，不能要求转弯时仍等于纯推进 cap。实际终态 scalar/angular 控制均测原严格限，无 emergency override；varied dt 也按 solver 提交角速差量测，未把角加速度门槛翻倍。渲染帧平均角位移的二阶差分受采样窗口影响，另记而不能代替控制量。

## CPU 证据与限制

`scripts/verify-schooling-r08.mjs` / `evidence/R08_SCHOOLING_REPORT.json` 26 项机器检查通过：原单鱼/source spine 精确一致；15 个 120s/30 鱼轨迹全无 guard、无位置投影，保留完整源盒正间距；固定/变 dt 的提交速度和角速变化在原上限；phase 独立、ray threat 激活后消退、确定性、暂停时钟冻结、安全重建。

同一 Node 进程、同源同 seed30、warmup60/measured180：R07→R08 mean update 约 `1.90→.67ms` herring、`1.92→.68ms` yellow、`1.52→.31ms` blue、`1.37→.33ms` colorful、`1.28→.34ms` picasso。最后步 SAT 约 530–560 次，social candidates435，active139–145，不再 12+18 次全体 SAT/投影。数值 scratch 33832 bytes 是求解器自有 typed buffers，**不是项目总内存**。CPU benchmark 没有计 WebGL，不声称浏览器 FPS 已达目标；最终同冻结 HTML 的真实浏览器测量由独立工位负责。

有限长轨迹不是任意状态安全证明。源默认 dense pack 在第一可见前初始化；若外部强行注入不可行重叠/速度，emergency guard 仍可触发并破加速度约束，此时必须报告失败，不能标记连续性通过。生产 candidate 只在证据覆盖范围内成立。

研究依据与物种未确认状态见 [R08_COLLECTIVE_MOTION_MODELS.md](R08_COLLECTIVE_MOTION_MODELS.md)，不把 tetra/Kuhlia 的实测数字搬到海狼/金枪鱼标签。

- [x] 没有用生成图片代替真实三维实现；
- [x] 已实际修改生产源码；
- [ ] 用户看到的是本任务已验收可交互三维工作台；
- [ ] 最终冻结画面来自实时三维运行时并由独立工位复核；
- [ ] 公网固定链接和真实浏览器已验证；
- [x] 如果只有截图而没有工作台，本轮判定失败。

`visualAcceptance=false`，`productionReady=false`。本文没有发布或批准权限。
