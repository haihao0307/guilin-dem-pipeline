# Motor Mother · 统一汽车母体 / 规则锚点
更新：2026-10-26。此文件是历史指令的接续锚点，不代表 R07 验收或 16 份参考资产已解包。

## 总原则
一个 MOTOR_MOTHER 母函数。Car、Jeep、Bus、Truck 与燃油/电动车为参数配置，不应成为相互不兼容的独立生成器。先做普通四门轿车，再以同一函数体系表达其余车类。
函数定义结构与连接；变量定义尺寸/车型/驱动类型；噪波仅处理材料颜色、质感及细微变化，不能替代机械结构。
对象统一保留 Time、Location、History、State。对象不可只存可见几何；应有语义、父子关系、运动轴和约束。

## 基础四门车组件谱（未完成项保留）
BODY/CHASSIS 底盘/车身承载；CABIN 座舱；
WHEEL / TIRE / RIM / HUB / AXLE 轮系；
DOOR / HINGE / WINDOW / WINDOW_REGULATOR 车门与窗；
STEERING_WHEEL / STEERING_LINK 转向；
SPRING / SUSPENSION 悬架；
ENGINE / MOTOR、TRANSMISSION、DRIVE_SHAFT 传动；
BRAKE 刹车；HEADLIGHT / TAILLIGHT / WINDSHIELD 灯与玻璃。
挡风玻璃、四轮、侧窗、可开门、发动机、制动、方向盘、传动、前后灯是普通轿车的首轮验收项目。上述清单是母体接口规划，不表示已经实现。

## 层级与行为
Vehicle
  ├─ Chassis → Suspension → Axle → Hub → Rim & Tire
  ├─ Cabin → DoorHinge → DoorPanel → Window/Regulator
  ├─ Powertrain → Engine/Motor → Transmission → Driveshaft → Driven Axle
  ├─ Steering → SteeringWheel → Rack/Linkage → SteeringKnuckle
  ├─ Brake → Disc/Drum → Caliper
  └─ Lighting → Headlight/Taillight
窗随门开合，再沿自身升降轨道移动；轮胎与轮圈跟随同一轮毂旋转；车轮滚动角由实际行驶距离和有效滚动半径决定；转向、制动和悬架响应需要物理/运动状态约束。

## 不得混淆
- 老师参考 GLTF/GLB 的直接装载、三角面几何显示 ≠ 已转成自有函数母体。
- R05 目前是 WebGL2 三角面视觉观察候选，不是隐式函数表面或完整车辆。
- R07 是可能失败的过程候选，不是工作推进依赖或新项目起点。
- 16 份参考模型的文件库登记与本次读取全量 ZIP 的原始内容不能混为一谈。
- 旧版及用户已经批准的实例保持不变；新修改只进入隔离实验分支。
- 未经真实浏览器/设备测试，不得称三维或性能验收通过。

## 下一步可验证里程碑
1. 四门轿车的结构层级、几何基准与部件分色均可按实例查询。
2. 车门铰链 + 玻璃随门联动、四轮轮毂与悬架约束有独立探针。
3. 发动机/传动/制动/转向的状态传递可以在数值层复现。
4. 完整参考汽车逐一解剖，映射到母体参数谱，缺失机械信息显式标未知。
5. 实际浏览器旋转/门窗/车轮/导出/性能验证，提供固定公网网页。
