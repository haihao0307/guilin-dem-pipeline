# GAME 小游戏生产线 · 列车数学接续 R01

2026-10-09。状态：可执行的接口适配候选；不替换已认可游戏，不宣称本聊天就是用户称的“数学家”。这是同一小游戏生产线的增量模块，不是新总台。

## 接收来源与内容身份

公开交接：https://github.com/haihao0307/guilin-dem-pipeline/tree/handoff/train-game-math-r01-20261009/handoffs/train-game-math-r01-20261009

源提交：`7ef7fd8d584f1fea32bedf5973d9d1b0e5777086`。完整包为该 tag 的 `GAME_TEACHER_MATH_HANDOFF_R01.zip`，2,607,050 bytes，SHA256 `6506bbd7a4436e56bda79e441905547fac68def858af8589e82452adfe80e286`。

本模块 `source/` 保留交接 README、数学源代码、原验证和来源摘要的 Git blob，不改原算法。GitHub Actions 再从公开 Release 下载全包，核实际字节、CRC 与包内代码；网页端可读不等于本机已经下载。接收时本地网络不能下载整个包，不能把 Release 元数据 digest 冒充本地整包重算；最终以本模块 Actions receipt 为准。

交接方记录的“9类原场景实际打开、缓冲拆读”是交接方证据；本线本轮读取其全文和代码，不能声称自己又打开了9个原模型。源码候选不包含老师模型、贴图、脚本或广告。

## 用户已经确定的边界

架空香港，七八十年代密集破旧街区，两侧楼房夹铁路；保留车头、轮组和烟的可见空间。九类老师仍为 Mika3、台湾平交道、首尔站、两种 Econolite、街灯、铁路标志、客车底盘与香港建筑。学习对象规则，不能把老师几何缓存改名为自己的规则或成品。

原招牌与广告不进入成品。墙面图已烘有文字和现代空调，删除 billboard 不够，需重建墙面。不能将“删除现代空调贴图”说成“七八十年代没有空调”。本轮不改外观或另作历史断言。

客车只学承载底盘、转向架、轮轴、制动、车钩，不取车壳和屋顶。Mika3只补参考，28号仍由我方 Scotsman R01 改型；Flying Scotsman 八十年代外形迭代是独立对象；VR-RCLASS独立命名，不替代任何一个。

## 实际核到的现有接口及缺口

接收端冻结基线：`de9808faf63535f55363b90479001d157b40cfa2`。

已读 `voxel-train-study/game/{ARCHITECTURE.md,session.mjs,app.mjs,world.mjs,steam-model.mjs}`。

现有 `Session.view()` 为 version 1，30 Hz 权威 tick；distance 使用米、velocity 为米/秒，车头基准 `FRONT_X=5`。运行轴为 +X，上为 +Y，横向为 Z。演员分别有 `frame:world` 和 `frame:train`；当前平直场景将世界位置减去 distance-FRONT_X 后渲染。时刻表分钟不是仿真世界秒，不能拿时刻表或 performance.now 来驱动警灯/轮相位。

新交接为 Y上/Z前/X横。适配采用正确旋转 `(x,y,z)旧 -> (-z,y,x)新`，行列式 +1。直接 `(z,y,x)` 交换会镜像。新绝对世界位置额外区分 world/train/render 三种原点；不得给所有输入重复加列车位移。老师原模型尺度未标定，不自动纳入这个米制接口。

当前在线 `steam-model.mjs` 明确是 WD-inspired 2-8-0，不能冒认为 Scotsman R01、28号或VR-RCLASS。现有驱动半径 .61米只是这个旧程序模型的值，不是新老师尺度。此次不改车型、轨道、车站、客车外壳或视觉。

现有蒸汽车返回 `wheels` 中的 Group 是没有接入 root 的辅助对象；真实可绘制轮子在 `userData.batch + instance`。因此从辅助 Group 读取 matrixWorld 会丢掉真实层级，InstancedMesh 本体也不能当作每个轮轴的独立变换。本模块用实际批次实例矩阵与父级矩阵核轮毂锚点。

尚缺真正独立的轴箱导轨、板簧挂点、制动头接触面与车钩规则；仅有批次几何或轮毂锚点不等于这些已经重建。现有动力学与新平交道检测/车速约束还没有连接，不能用绿灯输出声称列车已经受保护。

## 本轮接入的代码

`adapter.mjs`：显式坐标/原点转换、tick世界时间、发散数值与矩阵检查、实际实例矩阵、双方局部锚点/轴、接触法向逆转置、不同接头自由度的诊断、直轨扫掠AABB、左右建筑/立面挂接、严格布尔输入的逐tick平交道通道。曲柄参数角与绕新X轴的旋转角分别输出，不混同符号。

`session-bridge.mjs`：`attachAssembly(existingSession)` 可逆绑定实际 Session 的 step，让同一 advance 内所有固定tick都被观察；不以渲染采样代替传感器历史。调用 dispose 恢复原 step。它读取真实 Session API，没有重写 Session。保存使用独立 schema、原 replayPacket 与压缩的传感器变更日志；恢复重放核对信号状态，拒绝伪造绿灯或缺失tick。无实际检测器时不默认放行；恢复后未重新绑定传感器只准查看。

`legacySteamWheelHandles(steam)` 仅桥接已经读到的旧WD模型公开实例接口，身份始终为 `legacy-wd-inspired-2-8-0`。用于检验数学对接，不成为28号或Scotsman新基线。

接口调用（从本模块附近的代码调用，不修改旧app）：

```js
import {attachAssembly, legacySteamWheelHandles} from './session-bridge.mjs';
const bridge = attachAssembly(existingSession); // 没有检测器：只读坐标/挂接，信号不放行
const frames = bridge.snapshot();
const checks = legacySteamWheelHandles(existingWorld.train.steam)
  .map(h => bridge.joint(h.rotating, h.support, h.rule));
// 要测试游戏平交道，另传 readSensors(tick, previousView)。必须显式提供五个布尔字段。
// 它仍不控制 Session 的速度或通行；默认游戏页面不加载这个候选。
bridge.dispose();
```

五个字段为 powered、roadClear、request、occupied、reset。回调在 tick 开始前取值，previousView 是该步之前的实际状态；不得将步末检测伪称连续碰撞检测。动态检测器、提前制动距离、取消请求后的释放策略和驾驶游戏互锁需另外设计验证。

## 不得误判的边界

接头结果仅 `anchorAndAxisValid`，完整姿态、接触面积、摩擦/弹簧力及约束求解均未验证；弹簧挂接明确返回未解决状态。原案例主连杆函数是中心线候选，当前旧车滑块存在高度偏置，不用候选函数替换原解。

扫掠盒仅直轨、无旋转的平移AABB。镜头保留盒与轨道盒分别检查，但不证明曲轨扫掠、追车视锥、烟体或整局动态遮挡已经通过。立面规则输出挂接点，不宣称已有真实窗框或墙面接触面。

信号是游戏规则，非真实铁路工程控制。未写入车速控制，所以 `authorityInterlockInstalled:false`。默认在线app没有加载此适配器；这是已与真实接口连接并接受测试的opt-in模块，不是可玩新场景或全系统上线。

## 验证与保护

本地完成纯数学14组测试，未用模拟Session冒充真实接口验收。`tests/integration.mjs` 必须导入仓库实际Session、Three与旧蒸汽模型：逐tick、粗细帧、暂停、演员坐标、回放恢复、可逆绑定、18个真实实例轮毂与错误锚点、原曲柄相位。是否通过以对应提交Actions为准，不把编写测试等同执行通过。

Actions：`Train math adapter R01 (read-only)`，只读权限；实际核公开完整包、运行原6组测试和本轮22组测试，保存 receipt 与 TAP。不部署、不合并、不强推。

保护整树：旧列车/驾驶游戏/其历史入口、风暴、失物招领局，以及原小游戏首页。这一轮仅在 `assembly/train-math-r01` 增加代码与本专用检查工作流。既有条目的SHA保存在核验脚本；不把目录存在说成已经玩过或已获用户视觉认可。

本轮没有新网页交付，未做浏览器画面验收与实体手机测试。香港街区、新车型改型、独立老师素材重建和实际游戏通行互锁尚未交付。
