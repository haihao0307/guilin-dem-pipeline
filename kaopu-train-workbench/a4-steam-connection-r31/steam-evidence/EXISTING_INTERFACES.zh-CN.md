# R30 整车蒸汽链最少接口清单

只读对象：`../r30`，2026-10-25。没有修改核心、几何或 Git，没有联网或发布。这里只盘点已有解析几何及接口缺口，不构造流体系统，不作 CFD、压力认证或历史尺寸认证。

## 结论先行

1. 锅炉与烟箱不需要重做：已有压力边界、锅炉水/汽空间、火管燃气空间、过热集箱壳及活汽腔、排汽喷口及其腔、烟箱燃气域。
2. 左右阀胸已有供汽、前后排汽、前后工作口短管，各自真正挖开了外壳和衬套的相应局部区域。缺的是跨部件管路和汽缸工作通道，不能只用一条连接标签冒充物理连通。
3. 中阀胸已存在，但只做到壳、阀孔、盖、填料、阀头、公共铸件连接腹板。它没有供汽/排汽/工作口、配汽衬套窗口或通到中汽缸的汽道。
4. `smokebox/superheater_header` 是完整封闭盒形薄壳，已有内腔但没有任何进出口，也没有饱和汽/过热汽分腔。现有 `boiler/tube_metal` 是火管，不是过热器蒸汽管束。
5. 最小后续工作应先复用域、轴线、口部和同一 Time，显式标记未连通，再只补缺失的连通形体及必要的候选开孔。不要另造锅炉、三缸、阀胸或第二时钟。

运行时复核：687 个已定义场，baseline 可见 519，candidate 可见 662，符合 R30 当前计数。检查过的 25 份原文件 SHA-256 前后相同。

## 1. 已有域，不等于已有压力求解

以下函数都已经在 `scene.js` 的 `SCENE.sources.pressure` 中，但均未作为独立渲染 part 注册。`pressure` 是源码分组名，不是压力数值或认证状态。

| 已有解析域函数 | 可复用宿主 | 当前边界 |
|---|---|---|
| `pr_boiler_water_or_steam_space` | `boiler/outer_steel_shell`，铜内火箱及火管共同限界 | 水与汽共用一个几何空间，没有水位、相态划分、取汽口 |
| `pr_boiler_hot_space` | `boiler/inner_copper_shell` | 炉膛/燃气域，不是主蒸汽 |
| `pr_boiler_tube_hot` | `boiler/tube_metal` | 火管燃气腔，不是过热器蒸汽管 |
| `pr_boiler_smokebox_interface_hot` | `boiler/tube_metal` | 燃气到烟箱的界面 |
| `pr_smokebox_header_live_steam_lumen` | `smokebox/superheater_header` | 单个闭合盒形内腔，没有入口、出口或分腔 |
| `pr_smokebox_exhaust_steam_lumen` | `smokebox/exhaust_nozzles` | 只有两支喷口的内腔，没有缸排汽汇集管 |
| `pr_smokebox_combustion_gas_domain` | `smokebox/smokebox_wrapper` | 烟箱和烟囱燃气通道，排除集箱与喷口内腔 |
| `pr_cab_tender_tender_water_space` | `cab_tender/tender_outer_sheet` | 煤水车供水域，非本次主汽链 |

可先添加只读的 domain/port 语义注册表，并以这些现成函数提供解剖查询。不要把内部空域变成新的实体零件重复计数。

## 2. 锅炉、集箱和烟箱零件及轴线

坐标单位为米：X 横向，Y 向上，Z 向前；轨面 Y=0，中间动轴 Z=0。下述数字是当前 GAME 候选代码事实，不是新核定的 A4 实测尺寸。

- 锅炉实体 ID：`boiler/outer_steel_shell`、`boiler/inner_copper_shell`、`boiler/foundation_ring`、`boiler/firehole_interface_metal`、`boiler/tube_metal`。
- 锅炉轴参考 Y=2.8575，沿 +Z。前钢管板范围 Z=3.09505…3.13005；后铜管板 Z=-2.33755…-2.30755。还有现成的 `pr_boiler_front_steel_tubeplate`、`pr_boiler_rear_copper_tubeplate` 查询函数，不需重新推导管板。
- 火管：3 个大火管轴心 X=-0.4/0/+0.4，Y=3.08，外/内半径 0.107/0.095；7 个小火管，5 个位于 Y=2.51、X=-0.48/-0.24/0/+0.24/+0.48，2 个位于 Y=2.86、X=±0.61，外/内半径 0.062/0.05；沿 Z=-2.33755…3.13005。管腔为热燃气；不能把这 10 根直接改称过热器。
- 唯一已命名的集汽/过热相关实体：`smokebox/superheater_header`。中心 [0,3.3,3.35]，长轴 X；外半尺寸 [0.57,0.09,0.09]，内半尺寸 [0.55,0.07,0.07]，各面壁厚 0.02。没有现成端口，也没有针对它的 host cut。
- 烟箱实体 ID：`smokebox/smokebox_wrapper`、`smokebox/sealed_front_door`、`smokebox/chimney_wrappers`、`smokebox/exhaust_nozzles`、`smokebox/entrainment_cowls`。
- 两支排汽喷口沿 +Y，轴线 X=0，Z=4.55 和 5.15；实体 Y=2.10…2.55，内/外半径 0.06/0.075。其既有 lumen 为开口穿透留量 Y=2.09…2.56，可复用的实体进口面在 Y=2.10、喷口出口面在 Y=2.55。
- 同轴引射罩 Y=2.68…3.57，名义中性半径由 0.105 线性变到 0.185，壳的半厚 0.006；烟囱实体 Y=3.55…3.98，内/外半径 0.19/0.208。喷口到引射罩之间的空隙是现有结构，不应靠补一根实心管封死。

未找到已注册的集汽取汽装置、干汽管、调节阀、锅炉到集箱汽管、过热器元素或主汽分支。这里的“未找到”限定于当前本地解析源码，不断言实车结构不存在，也不凭空增加汽包。

## 3. 左右阀胸：现成的 10 个外接口

每侧以 `valve_chest/{left|right}_` 为前缀，轴线 X=±0.98、Y=1.48，沿 Z，轴向中心 Z=4.68。

现有完整 IDs 后缀：`chest_pressure_shell`、`ported_liner`、`rear_end_cover`、`front_end_cover`、`rear_gland_packing`、`front_gland_packing`、`rear_valve_head_core`、`front_valve_head_core`、`rear_effective_seal_band`、`front_effective_seal_band`、`shared_valve_spindle`、`supply_stub_wall`、`rear_exhaust_stub_wall`、`front_exhaust_stub_wall`、`rear_working_stub_wall`、`front_working_stub_wall`。

壳 Z=4.25…5.11，端盖最外面 Z=4.228/5.132；阀孔半径 0.1143，衬套外半径 0.1263，工作口环形汽道外半径 0.1513，壳外半径 0.1693。

| 短管后缀 | 每侧外口中心 [X,Y,Z] | 外口朝向 | 内/外半径 |
|---|---|---|---|
| `supply_stub_wall` | [±0.98,1.695,4.68] | +Y | 0.026 / 0.038 |
| `rear_exhaust_stub_wall` | [±0.98,1.695,4.295] | +Y | 0.020 / 0.032 |
| `front_exhaust_stub_wall` | [±0.98,1.695,5.065] | +Y | 0.020 / 0.032 |
| `rear_working_stub_wall` | [±0.98,1.265,4.46] | -Y | 0.018 / 0.030 |
| `front_working_stub_wall` | [±0.98,1.265,4.90] | -Y | 0.018 / 0.030 |

上述 supply/exhaust 分配是现有 `mPV` 的候选命名，不是本轮独立核实的 A4 inside-admission/配汽事件。历史分配和相位事件仍未核定。

源头为 `scene.js → sources.motion → mPV` 及两侧对应 wrapper。供汽/排汽通孔的 Y 范围是 1.48…1.695；工作短管是 1.265…1.3537。后/前工作口已有 8 扇角向衬套窗口，中心 Z=4.46/4.90，窗口总轴向长度 0.04，再经环形汽道接到向下短管。这些均可复用，不应重造。

但 4 个工作短管没有接上动力缸。对当前固定外缸，最接近处的精确包络间距为：

`sqrt((0.98-0.82-0.030)^2 + (1.265-1.016)^2) - 0.260 = 0.0208932181 m`。

即仍有约 20.893 mm 的实体间隙，而且外缸壁没有任何工作汽道开孔。即使之后补一段管，也必须验证它贯穿相应压力边界，不可以把终点贴在完整缸壁上就宣称接通。

阀胸壳及短管固定在整车坐标中；只有阀头、密封带和阀杆跟随已有 outside solver。不能给供汽管套用阀杆的平移。

## 4. 中阀胸及三动力缸

中阀胸复用 `topology-parameters.js`：X=0.38、Y=1.48，轴沿 +Z；孔半径 0.1143，外半径 0.14，壳 Z=4.38…5.01，端盖厚 0.022，杆半径 0.016，填料外半径 0.026，导向包络末端 Z=5.17。阀头名义中心 Z=4.51/4.87，各半长 0.04，头芯半径 0.100、密封带外半径 0.1143。

已有主要 IDs：

- `middle_topology/chest_wall`、`middle_topology/common_casting_web`。
- `middle_topology/rear_cover`、`front_cover`、`rear_packing`、`front_packing`、`rear_gland`、`front_gland`、`front_guide`。
- `middle_topology/head_core_0`、`head_core_1`、`seal_band_0`、`seal_band_1`。
- `middle_topology/stud/{rear|front}_{0..5}`、`washer/{rear|front}_{0..5}`、`nut/{rear|front}_{0..5}`。
- 既有中阀杆 `valve/middle_valve_spindle_inferred_horizontal`，其同 Time 链由 `side_offset_solver.js` 接管。

`middle_cover_export.js` 只从壳/腹板扣除阀孔、动力缸孔、螺柱孔，没有供汽、排汽和工作通道。`MIDDLE_CHEST.assertions.steamPortsAndPassagesComplete` 明确为 false。公共腹板不是既有汽道，不能把这一实体标签当成连通证明。

三缸实体 ID：`actuation/{left|middle|right}_cylinder_wall`、`_piston`、`_piston_rod`；压力边界还有 `cylinder_pressure/{side}_front_cover`、`_rear_cover_with_rod_hole`、`_rod_packing`、`_rear_head_bore_seal`、`_piston_ring_packs`。

参数复用 `reference/cylinder_actuation_assembly.py` 和 `dynamic.js`：缸孔半径 0.23495，外半径 0.260，轴向缸孔范围 4.35…5.15；活塞半径 0.23295、半厚 0.025，距小端沿缸轴 1.25。外缸 X=±0.82、Y=1.016、方向 [0,0,1]。中缸从 [0,1.016,0] 沿 [0,sin(beta),cos(beta)]；baseline beta=0.11，当前 candidate 默认 0.126，不要把中缸端口固定成水平坐标。

现有活塞/缸壁可支撑“前后工作腔”语义查询；但当前没有前后工作腔的独立 scalar 函数，也没有缸壁/端盖上的工作口。最小实现应从同一 pose 计算随活塞变动的前后空间，不复制另一套运动学。先作几何语义，不输出未知的压力、流量或配汽事件。

## 5. 既有给水接口，不要误当主汽管

已有 `connections/cold_water_pipe_and_flexible_hose_wall`、`delivery_pipe_wall`、`injector_and_valve_port_bodies`、`pending_steam_and_overflow_stub_walls`。

最后一个 ID 是注水器附近的待接汽/溢流短管，而不是前部主汽分配管。其根部 [±1.15,1.10,-5.87]，待接蒸汽口朝上到 Y=1.21，内/外半径 0.016/0.026；溢流朝下到 Y=0.86，内/外半径 0.022/0.032。给水 `delivery_pipe_wall` 从 [±1.15,1.10,-5.77] 经 Y=1.90、[±0.75,2.45,-5.70] 到 [±0.75,2.45,-5.48]。锅炉现有 `svc_host_cut_3` 属于给水穿壳，不是锅炉取汽口。

## 6. 最小连接表与实施边界

按现有体系记录下面链条，所有缺口必须保持显式状态：

1. 锅炉水/汽域 → 集汽/取汽/调节：域存在；取汽装置、口及调节连接未建。
2. 集汽 → 集箱：集箱壳和活汽腔存在；上游路由、集箱开孔未建。过热器元素和饱和/过热分腔未建，不能用同一个闭腔假扮完整过热循环。
3. 集箱 → 左/中/右阀胸供汽：两侧短管存在；主汽分支全缺，中侧供汽口也缺。
4. 两侧阀胸 → 各动力缸前后腔：工作窗口和短管存在；末端通道和缸口缺。中侧整个工作口/通道缺，但壳、孔、运动本体已有。
5. 三阀胸排汽 → 汇集 → 两喷口：两侧排汽口和两喷口存在；汇集与支路缺，中侧排汽口缺。
6. 喷口出口 → 烟箱混合空间 → 引射罩/烟囱：已有空间、罩和烟囱，可先补功能语义。这里是开放混合区，不应强行画成一条封闭主汽管。

建议一份小型只读接口表即可起步：domainId、hostPartId/function、frame、port 位置/方向/半径、connectedTo、状态 existing/open_end/missing/unverified。没有几何的边保留 missing。需要实际接通时，再追加候选解析管壁/内腔及最少宿主开孔；baseline 完整保留。每条新边必须检查内腔贯通、实体隔离、AABB/场函数和整车邻近件，不能仅验证端点重合。

## 7. 同一 Time → Location → Object

- 先调用 `DYNAMIC.state(Time, Location, ObjectState)`，从这一个 snapshot 取 theta 和 installation。
- 外阀位移用 `DYNAMIC.outsideValvePose(theta)[side].spindleDisplacement`，已有头/杆 frame 保持不变。
- 中阀用 `DYNAMIC.gresleySolver.pose(theta).qMiddle`，头部仍按现有 stack frame 变换。
- 活塞用 `DYNAMIC.pose(theta, side, beta)` 及既有缸轴；不要按视觉位置另算相位。
- 固定锅炉、集箱、左右阀胸短管及烟箱仍固定在同一 train-local frame。中缸端口必须使用 installation.beta；中阀胸固定轴不随中缸倾角一起旋转。
- 不新增机械时钟，不输出 object mesh、点云或重新三角化的模型。

## 文件与复核

- `INVENTORY.json`：123 个相关既有 part 的完整元数据/两态可见性；8 个现有域、12 组现成口记录；轴线、参数来源、缺口分类及最小复用约定。
- `READ_ONLY_CHECKS.json`：519/662/687 计数、原文件 hashes、闭合集箱与无缸口检查、20.893 mm 外缸工作口缺口公式。
- `EXISTING_FIELD_EXCERPTS.glsl`：从原 `scene.js` 原样提取的相关函数，只用于证据，未安装到场景。
- `build_inventory.js`：仅读取 r30、只向本清单目录写报告。运行 `node build_inventory.js` 可重建机器可读清单。

这是当前源码盘点和最小连接计划，不是新增几何、流体模拟、浏览器验收或整车机械验收。

## 与并行官方证据核查的接口对照

参照 `../steam-path-evidence/OFFICIAL_STEAM_CHAIN.zh-CN.md` 的只读核查：官方记录支持“集箱 → 钢管 → lens-ring 接口 → 缸顶铸铁管”及左、中、右三分支。现 R30 这些分段接口和实体均未建；不能用现有短管的朝向/最近点直接推定官方管形。官方证据仍未确定三缸排汽汇合剖面、两喷口分配、集箱内部隔离结构及 inside-admission 完整事件。本清单的 labels 只描述已存在代码，不提升这些未决项的证据等级。
