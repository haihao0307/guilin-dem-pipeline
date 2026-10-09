# 五个动作架构老师 · R01 可验证接入层

核查日期：2026-10-09。归属：现有 `kaopu-unified-human-workbench`，不是另一套人物总台。

## 当前到哪里了

- 已核对五个官方源码仓库及固定版本，分清恢复、身体表示、生成、物理控制、清理。
- 已实现 Kimodo 数字数组 → 有来源的标准动作 JSON，保留真实 pelvis 路径、独立 smoothed root、全部源关节和接触序列。
- 已实现非神经运动学诊断：支撑足滑动、关节加速度、骨长漂移、接触点穿地、带任务条件的疑似冻结。结果是诊断，不是物理稳定证明。
- 已实现现有 Anny104 动作帧的离线烘焙与原格式回放，对既有36个人物共1116帧做 JSON 往返，posed/skin 矩阵最大差为0。没有换网格、削骨或修改蒙皮。
- **SOMA-X原生解析身体层CPU low最小单例已通过23项检查**，见 [实跑证据](soma-cpu-r01/README.md)。mid尝试以137退出。其余四套原系统未实跑；没有训练或神经推理，没有完成 SOMA77 → Anny104 标定。不能称为五套体系完整1:1复现。

新增 [真实SOMA → 完整104骨最小标定](soma-retarget-r01/README.md)：root与左前臂432例/396负例，六完整人物蒙皮消费及静态网格对照。仅两处局部控制，不能当作全身重定向或动作库新增招式。

本目录由自有接口代码、研究说明、测试和测试结果构成；不打包老师权重、受限人体模型或动作数据。源码阅读固定点在 [SOURCE-INDEX.json](SOURCE-INDEX.json)，完整判断见 [FIVE-TEACHERS.md](FIVE-TEACHERS.md)。

[TEACHERS.json](TEACHERS.json) 是机器可读的角色/输入输出/版本/运行条件注册表。`numericFileAdapterImplemented` 与 `nativeReproductionExecuted` 分开，避免把接口实现自动晋级为原模型复现成功。

用户后续要求每套体系实际投入使用、18台同刻不同招、各形体轮换同招；执行状态和未完任务见 [ADOPTION-STATUS.md](ADOPTION-STATUS.md)。`arena_schedule.mjs` 已落实动作ID/形体/对手/角色/时间协议和门禁，但不产生动作；不能用它的18个测试描述符冒充18个真实动作。

## 正确分层

1. 观测恢复：GEM-X，把视频恢复成 SOMA 动作。单目结果仍带遮挡、尺度和相机估计误差。
2. 身体表示：SOMA-X，统一身体/手的参数与骨架，并提供身份模型接口。
3. 运动生成：Kimodo，文本、关键帧、末端及路径约束 → 运动学动作。它本身不训练机器人反馈控制器。
4. 物理控制：ProtoMotions，把参考动作转为模拟环境中的策略学习/追踪任务。
5. 质量识别与清理：StableMotion，识别坏帧并条件生成清理结果。不能将本目录的阈值诊断冒充它。

共同数据入口 → 保留完整源动作 → 明确坐标转换 → 骨架标定/重定向 → 离线质量报告 → 带版本的动作数据库 → 既有104骨运行时。

物理代理允许单独使用较少关节，但必须是可追溯的代理分支；原始77关节动作和104骨可视身体都保留。不能把官方 soma23 代理当作完整人物骨架。

## 可复跑的测试

在人物主台目录运行：

```sh
python -m unittest discover -s motion-architecture/tests -v
node motion-architecture/tests/native-packet.mjs
```

Python 3.12；标准契约仅需标准库，NPZ CLI 往返测试使用已安装的 NumPy。原生回放测试使用 Node 20.11+ 和主台已有的 Anny 数据/36预设/拳击模块，不安装第三方仓库、不访问网络。

原生回放测试依赖同级 `full/boxing/Motion.mjs` 的拳击R01案例；只取本研究目录、或仍在未含该案例的旧主台提交时，需先取得相应的人物案例版本，不能单独运行这项集成测试。测试报告记录实际输入源码与资产哈希；Python契约测试不依赖拳击案例。

`CONTRACT-QA.json` 是真实 unittest 结果；`NATIVE-PACKET-QA.json` 是原生回放结果。它们没有运行老师测试套件、CUDA、物理模拟或GPU像素读回。测试通过也不代表动作视觉自然、身体不会自相交或模型已复现。

附加的 [KIMODO-SCHEMA-QA.json](KIMODO-SCHEMA-QA.json) 静态读取固定版官方 `SOMASkeleton77` 名称/父表，以真实77骨顺序、float32数组和bool接触执行NPZ适配测试。几何仍是自有解析fixture，不是模型推理。复跑时传入与SOURCE-INDEX哈希一致的官方 `kimodo/skeleton/definitions.py`：`python motion-architecture/tests/pinned-kimodo-schema.py <definitions.py>`。测试不import上游代码、不下载资产。

## 数字动作文件怎么接入

```sh
python motion-architecture/motion_contract.py input.npz metadata.json output.motion.json
```

`input.npz` 是有权使用的 Kimodo 导出，使用 `allow_pickle=False` 读取。它至少含 `root_positions`、`local_rot_mats`、`posed_joints`、`foot_contacts`；可保留 `smooth_root_pos`。不能直接传 GEM 的 pickle `.pt`、ProtoMotions `.motion/.pt` 或 StableMotion feature 张量。

`metadata.json` 必须包含：

- `fps`：从真实模型/运行配置记录，不从文件名猜测。
- `units: "metres"`；`coordinateSystem: "right-handed-Y-up-+Z-forward"`。
- `rotationConvention: "absolute-parent-local-matrix"`。
- `skeleton`：实际骨架 `id`、有序 `names`、`parents`、对应 `fingerprint`。用 `make_skeleton()` 构造，根必须为索引0且父表拓扑有序。
- `source`：来源类型、固定版本、实际输入哈希及执行证据。`neuralInferenceExecuted` 必须明确。若为true，则必须有 `modelId`、64位 `checkpointSha256` 和 `runEvidence`；这些字段仍需人工核对原始日志，不会凭字符串证明推理成功。

输出坐标 `metres/+Z/-Y/right`，矩阵为绝对父局部旋转。变换是 `C R Cᵀ`，位置是 `C p`，其中 `C(x,y,z)=(x,-z,y)`。这只改变同一骨架的坐标基，不把 SOMA 局部矩阵解释成 Anny 的 local-ref rotvec。

Python核心函数 `import_kimodo(data, metadata)` 接受JSON解码后的list数值结构；直接调用上游 `load_kimodo_npz()` 得到NumPy数组时，应先对各数值数组调用 `.tolist()`。本目录CLI已做这一步；核心函数不会隐式读取pickle对象或自动猜测数组batch维度。

`rootPosition` 是实际 pelvis 路径，`smoothRootPosition` 是独立路径控制特征。两者不互相替代。无逐帧 bbox 归零、地面吸附或根路径抹除。时长按采样端点 `(N-1)/fps` 记录。

## 现有人物运行时怎么接入

`native_packet.mjs` 的 `bakeNativePacket()` 接受现有 rig 的 `evaluate(t)`，深复制每一帧完整104骨 `posedMatrices/skinMatrices`、根、接触与状态。`createNativePacketPlayer()` 检查骨名、父表和**形体相关 restFingerprint**，并按最近采样帧原样回放。它不做矩阵元素插值，不重新计算皮肤，不为别的形体偷用同一 rest pose。

`rootTranslationAlreadyInMatrices=true`，渲染器不得重复加根位移。输出格式与现有矩阵消费口相同，但本版本没有更改UI的默认实时动作来源，也没有自动把外部文件注入既有舞台。

版本边界：本目录针对当前 `full/CommonPerson` / `full/boxing`，其Anny参数为native local-ref rotvec度。历史最小版 `kaopu-unified-person/1` 的旧 `src/AnnyModel.js` 仍有Euler接口；该旧schema不能按本目录的新参数解释，GNM轴角弧度也独立保留。

SOMA 外来动作在标定完成前停在独立标准动作文件；不能绕过“calibrated retarget required”检查。现有身体仍为25417顶点、50624三角面、104骨、原生最多9影响；本目录代码不触碰这些资源。

## 入库与审核

`archive_record()` 把 clip 内容哈希、source asset 哈希、骨架指纹和对应 audit 哈希绑定。代码许可、模型许可、输入权利、再分发批准分别记录。默认 `local-only`；即便权利齐备也仅标记 `eligible-for-review`，不会自动上传数据。

动作合格应同时包括：数值、任务约束、运动学、物理及视觉五类检查。本目录仅实现了前几类中的基础检查。StableMotion预测、碰撞、力矩/稳定性以及人审结果必须分开存储，不用一个“通过”掩盖未测项。

## 下一步及停止条件

详见 [REPRODUCTION-PLAN.md](REPRODUCTION-PLAN.md)。先在固定源码、权重、许可证和环境条件下做老师原样单例，保存命令/种子/输入输出哈希/日志/原生预览，再做适配。条件不齐时明确停在对应阶段；不在网页里假装训练，也不把程序动作重命名为模型输出。

## 实时自研程序与离线clip分开

[Live程序调度契约](LIVE-PROGRAM-SCHEDULE.md) 与 `live_program_schedule.mjs` 不伪造离线bake/clip哈希。它绑定实际程序源码、定义、语义审核及每个形体/对手/角色的实测QA，支持18台不同程序与同一程序全局同步。72项测试仅验证契约，未生成或视觉审核任何真实招式；候选模式始终validationOnly/canPublish:false。
