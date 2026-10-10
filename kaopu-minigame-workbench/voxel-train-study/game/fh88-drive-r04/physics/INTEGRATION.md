# 接入契约

## 文件

- driving-physics.mjs：无外部依赖的原生运行时
- parameters.json：显式SI数值与假设，无导入模型
- adapter-bridge.mjs：把独立外形适配器与物理状态串起来
- test-driving.mjs / TEST_RESULTS.json：可复现测试和结果
- MODEL.md：模型、单位、假设、依据和未完成边界

Node测试：node test-driving.mjs。浏览器原生ES模块也可直接import运行时；参数JSON由宿主自己的已授权资源加载流程读取。不需要构建工具，不安装软件，不要求发新网站。

## 最小调用

import {DrivingPhysics} from './driving-physics.mjs';
const physics = new DrivingPhysics(parameters);
physics.setControls({throttle:0.7, brake:0, cutoff:0.55});
const state = physics.advance(frameDeltaSeconds);
adapter.setPhysicsState(state);

或者：
import {createDrivingBridge} from './adapter-bridge.mjs';
const bridge = createDrivingBridge(parameters, adapter);
bridge.controls({throttle:0.7, brake:0});
bridge.frame(frameDeltaSeconds);

每帧只调用一次advance/frame。不得再用另一个wallTime驱动轮子、连杆或车身，也不得让宿主旧速度累加器二次推进车身。先停用旧的车体速度积分与轮角动画，再连接这份状态。相机跟随可独立平滑，但不能改回物理位置。

## 控制

setControls接受部分更新，非法输入整次拒绝不半更新：
- throttle [0,1]
- reverser -1,0,+1；切入一个新的非空挡方向须 |speed|≤0.2 m/s 且所提交油门=0，否则抛出可展示错误。空挡可随时选。
- cutoff [.10,.80]
- brake [0,1]；实际brakeFraction缓慢跟随手柄
- firingKgS [0,1.5]
- grade [-.1,+.1]；正值为向X前方上坡

默认热车、空油门、向前、全制动，避免首次加载自动跑车。松闸后约2秒释放时常仍有残余制动力，不能当输入失效。换向不等于紧急制动，行驶中请先收油门、制动、停车，再切方向。

## 输出单位及坐标

snapshot()是深拷贝，可供UI读取。不要直接改physics.state、controls或ledger；配置p已深冻结。所有方法在单一宿主主线程调用。

- timeS=tick×fixedDtS，唯一物理时钟
- wheelRadiusM / initialMechanicalThetaRad：明确的几何尺度与初相接口，adapter应在首次接状态时检查轮径一致并采用所给初相，不能等跑车后才校验或静默固定.25
- positionM：世界X位置；reset可设初始X
- rollingOriginPositionM：本次reset的世界X起点，滚动校验为 positionM−rollingOriginPositionM = R·wheelAngleRad；不能误校验绝对X=R·angle
- speedMps / accelerationMps2：沿世界X，有正负
- wheelAngleRad：自本次reset起的正向滚动角 ∫vdt/R；初始0，绝不来自预设转速
- wheelAngularSpeedRadS=speed/R；wheelAngularAccelerationRadS2=accel/R
- boilerPressurePa：tick末锅炉简化绝压
- steamChestPressurePa：该tick求力时有效入口压力；与末态锅炉压力不严格同一时刻。diagnostics.pressureEvaluationTimeS给出该次求值对应的tick起点时间，热源在此步内以operator splitting先更新。
- boilerReserveJ / fireEnergyJ / coalKg / waterKg / brakeFraction
- diagnostics：牵引N、黏着N、用汽kg/s、蒸汽热W、轮周W、制动N、坡力N、限幅标志
- ledger / residuals：分开的能量与质量账

机构核心坐标为X前Y左Z上，θ正向从+X向+Z。前进纯滚动所需ω_mech为负。mechanicalState()直接提供：
worldTimeS=timeS
commonThetaRad=initialMechanicalThetaRad−wheelAngleRad
omegaRadS=−wheelAngularSpeedRadS
alphaRadS2=−wheelAngularAccelerationRadS2

默认initialMechanicalThetaRad=.25 rad，与本次外形worker约定一致；右/内/左相位[0,2π/3,4π/3]应只由机械适配器各叠加一次。不要重复取反或二次加相位。轮径应双方明确传1.90 m；禁止把A3的2.032 m静默混进FH88运行时。

本运行时仅有循环平均牵引，没有逐缸瞬时活塞力输出。机械evaluate可使用显式零载荷/零未知质量来生成纯几何姿态，并在UI标注未接负载；不应把平均力任意均分当成求过真实逐缸作用力。

## 时间、暂停和重置

advance(dtSeconds)累积真实帧间秒数，以固定tick推进。单次最多1200 tick，余下时间保留为backlogS，不悄悄丢弃时间。宿主应在切后台时主动暂停；再次可见后重置自己的lastFrameTimestamp，并恢复。这样不会把整个后台时段当成用户仍在驾驶。

setPaused(true)冻结位置、燃烧、压力、制动、时钟和帧时间积累。既有不足一步的accumulator保留，resume不自行补跳。stepTicks(n)给离线测试或明确的逐步推进，不建议与live advance混用。reset()清空所有台账、时钟、帧积压、暂停、库存与操纵状态至参数默认；reset({positionM,speedMps,pressurePa,coalKg,waterKg,controls})可作明确测试初态。

30/60/144 FPS测试在同样初始输入下状态逐值相等；这不意味着在不同tick收到键盘事件也会天然相同。要实现回放，宿主应记录控制变更发生的tick，而不是依赖渲染帧编号。

## 验收范围

此包的Node测试不代替浏览器中的真实输入/渲染验收，不代替旧游戏回归，也不证明KAOPU原生函数文件已保存和重载。外形与驾驶整合应另留版本；旧版本保留。生产发布未在本包任务执行。

桥接reset会先创建候选物理状态，交由adapter验证接受后再替换旧状态；adapter拒绝不会先把旧物理复位。渲染adapter若在frame回调抛错，桥接立即暂停物理，避免继续后台漂移，宿主应显示错误并处理，不忽略异常。

R03冻结机构适配器只适用origin=0、D=1.9、初相=.25；本包完整状态接入应使用已支持origin/半径/初相显式契约的R04适配器。bridge配置在创建时冻结，改参数请创建新bridge；reset成功后physics实例会更换，外部不要永久缓存旧physics引用。
