# 五套体系如何真正用起来：状态与下一可执行点

更新：2026-10-09。本阶段完成的是源码调查、接入契约与验证。用户要的原模型效果复现、动作库扩充和18台动作对照仍有未完成工作，不能因文档入库而关闭。

| 老师 | 实际能力 | 现在真正用到哪一层 | 未完成/阻塞 | 最小下一步与成功证据 |
|---|---|---|---|---|
| GEM-X | 视频姿态与世界/相机运动恢复 | 观测→动作的数据边界和源版本已核实；未执行原模型 | 缺PyTorch/感知依赖、权重、合法输入视频；原训练数据未公开 | 在匹配环境用一段自有短静态镜头跑官方demo，记录77点overlay、world/incam参数、相机回退状态、视频/权重/输出哈希；不从2D点直接假造准确3D |
| SOMA-X | 解析身份/骨架/蒙皮统一表示与拟合接口 | 官方0.3.3 native CPU low4505顶点实际运行；零姿、六个前臂±10°、根平移和缓存等价23/23通过 | mid18056尝试137退出，未证实原因；未启用correctives；未完成Anny104映射 | [原生实跑证据](soma-cpu-r01/README.md)；下一步原生rest/单关节可视化及77→104明确标定，不能用低LOD替换现有显示模型 |
| Kimodo | 受文本/路径/关键帧约束的运动学生成 | 安全NPZ→标准动作转换已实现，官方77骨顺序/float32/bool接触测试已跑；未推理 | 缺model/text-encoder权重与推理环境；未有老师生成clip；未完成Anny104标定 | 核实具体权重体量和条款后，固定公开SOMA模型、seed、短prompt跑原生预览+NPZ。官方称文本编码CPU可减显存至<3GB，但本机未验证且RAM需求须实测 |
| ProtoMotions | 物理追踪/任务策略学习、MotionLib及模拟器接口 | 控制/观测/奖励/数据分层用于架构；未跑策略或模拟 | 缺匹配simulator、checkpoint、LFS数据/机器人资产与配置 | 最小可考虑G1 deployment tracker + MuJoCo CPU单环境，按model card加载匹配motion。记录真实rollout、跟踪误差、终止与录像；IsaacLab-only权重不能直接宣称跨后端等效 |
| StableMotion | 质量标签识别+条件扩散修复 | 原始/诊断/修复分支的数据库边界已落实；当前QA是自有阈值诊断 | 缺合法SMPL/AMASS相关资源、可信checkpoint/normalizer；跨Anny域未验证 | 在原生20fps/233维协议跑一个授权BrokenAMASS单例，保存detected labels、mask、前后与好帧保真；TMR没跑就不报TMR分 |

所有下一步都先保留老师原样输出与原生预览，再适配。涉及大权重、注册、新条款或付费算力时先列明条件，不自动订购算力或默许再分发。

## 动作库和18台对照，不能用相位数量充数

当前已有可见的自有R01程序动作包含3套双人语法（jab-slip / cross-duck / cross-counter）、18套相位/速度组合和36个形体。**不是18种独立学习动作，也不是已运行五个老师。** 当前老师生成/恢复/神经修复/物理追踪入库clip数量均为0。

新增可执行调度器 `arena_schedule.mjs::createComparisonRound()`：

1. semanticMotionId是动作语义；takeId是固定seed/约束/采样得到的具体take；相位和seed变化不自动变成新动作语义。
2. 18台同刻比较要求18个已审核semanticMotionId，并拒绝用同一clip哈希改名凑数。语义是否真正不同仍需人工/任务级审核，字符串校验不能证明动作质量。
3. 每台两角色共用相同take时间基准，不随机错相位破坏攻防因果。单人Kimodo输出不自动等于双人交互生成。
4. 36个角色固定分18对；每轮动作索引循环，先用18轮让每对对照全部18动作，再互换A/B角色完成第二轮组。36轮后每个角色对每种动作都比较过A/B两角色，避免不同体型在同招对照时错比攻击与防守。
5. 每个native bake同时绑定actor restFingerprint、opponent restFingerprint与A/B角色，避免给儿童、壮年或不同对手身高直接套同一空间解。不存在对应bake时明确阻塞，不能默默复用。
6. 根位移已包含在native矩阵，舞台只做稳定的场地放置；不逐帧重新地面归零。
7. 测试用18个解析catalogue描述符，只能在`allowSyntheticFixtures=true`运行，并在输出标记validationOnly；默认生产拒绝。它验证调度协议，**没有产生18个真实动作**。

复跑：`node motion-architecture/tests/arena-schedule.mjs`。真实下一步是收集或生成至少18种有来源且经过质量/语义审核的动作take，完成对应形体/对手的retarget与native bake，再让boxing R02读取这个调度结果。场地/拳套与衣服预设可以独立推进，不需要等五个重模型全部装完。

## 仍保持打开的后续工作

- 老师原生单例运行及证据：SOMA解析CPU low最小测试完成；其余四项未完成，SOMA mid与完整迁移也未完成。
- SOMA77→Anny104 rest-frame/比例/末端标定：未完成，不能截断到23骨代替。
- 实际动作库扩充到18种并实现UI同屏/轮换对照：未完成；当前只有协议与拒绝错误输入的测试。
- 跨形体碰撞、自然度、物理稳定性和完整视觉复核：独立验收，未由当前数值测试覆盖。

精确source版本及机器状态：[TEACHERS.json](TEACHERS.json)。原样运行步骤：[REPRODUCTION-PLAN.md](REPRODUCTION-PLAN.md)。
