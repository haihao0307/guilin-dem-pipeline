# 从源码研究到1:1单例，再到本台适配

本计划的初始状态是原系统未执行；现已新增 [SOMA native low CPU最小实跑](soma-cpu-r01/README.md)，其余四套原系统仍未执行。不把“能找到仓库”“写了适配器”“程序动作可播放”记为模型复现成功。

## 阶段门

### A. 原生资源和执行环境

对每个老师固定source commit、实际包锁、输入与checkpoint SHA-256、模型/数据许可、运行硬件、命令和种子。确认下载不是Git LFS pointer，确定可用磁盘和下载规模。官方来源的软件与模型也不因此自动拥有可公开再分发权。

初始环境探测（安装前历史记录）：Python3.12.14、Node24.19.0、NumPy可导入；PyTorch、SOMA、Kimodo不存在；没有发现nvidia-smi或/dev/nvidia设备。当前只足以执行自有契约与CPU矩阵测试。没有伪造CUDA测试或大型下载。SOMA数值单例和ProtoMotions MuJoCo单环境可能有CPU路线，但仍需相应包、授权资产和匹配checkpoint。

停止条件：未知权利、需要注册/新条款、超出已讨论的资源下载、或没有满足要求的执行环境。记录具体缺项再继续独立的接口/数值工作，不无限重复下载或将别的模型当替身。

### B. 老师原样单例

每个老师独立运行，不改骨架，不重写网络，不先接本台蒙皮。保存输入、原native输出、原native预览、命令/依赖/权重哈希和stderr。成功标准是对应原生任务确实完成并有可审计证据；失败保留trace，不以“代码无语法错”代替。

### C. 转换与标定

在B的产物上转换：单位、轴、时间、完整骨架、rest frame、根位移、接触、缺失关节。与老师原生输出逐帧对齐后，才论证映射到Anny104。形体差异通过比例/IK处理，但每个改变都有测量，不默默改地面/速度。输出可审查的neutral、单关节正负旋转、极端动作和长路径回归。

### D. 本台表现与质量

旧36预设和完整网格/skin层保留。外来动作独立案例出现；来源卡标记老师模型、是否重定向、未实现项。人审前后视图、足底、手/脸/颈转接；同时保留动力学未测项。低骨物理代理不能降级可见身体。

## 各老师单例任务

### GEM-X

输入：用户自有或有明确许可的短视频，镜头类型记录为static/dynamic，不临时上传私人视频给外部服务。

原生参考命令：

```sh
python scripts/demo/demo_soma.py --video <authorized-local-video> --ckpt <pinned-gem_soma.ckpt> --output_root <run-dir>
```

成功证据：77点overlay、incam/global原生预览、hpe_results.pt、使用或回退相机估计的日志。未公开训练数据是原训练1:1的硬限制；即使推理成功，也不称训练复现。后续安全导出可信本机张量为numeric NPZ/JSON，再进入本台，避免对未知`.pt`执行pickle反序列化。

### SOMA-X

先选择native SOMA公开后端；若用MHR/Anny/SMPL必须单独确定对应资产条件。构造SOMALayer并计算zero pose，再以一个关节进行±10°轴角测试。保存77个joints、78公共transforms的真实shape、public骨名、单位和绑定数据。比较`forward()`与`prepare_identity()+pose()`，确认相等后再做身形变化。不将内部procedural twist骨数预设为78。

成功证据：原生顶点/骨架、绑定相等性、输出单位测试、肩肘腕/膝踝的reference frame正负方向。上面测试只有在安装和资产完成后才运行。

### Kimodo

选一个公开SOMA77变体并固定版本/模型卡/所有权重；先原生跑走路+停住的短prompt，固定seed；再做路径或关键帧约束。公开脚本参考：

```sh
TEXT_ENCODER_DEVICE=cpu python -m kimodo.scripts.generate "A person walks forward and stops." --model Kimodo-SOMA-SEED-v1.1 --duration 4 --seed 42 --output <run-dir>/walk
```

这不是本次运行日志。模型名称须和安装时registry核对。原始NPZ、约束文件、实际model.fps、原生预览和生成耗时齐备，才标记推理完成。比较有/无postprocess，量化constraint误差与foot skate，不能仅凭静态图判断质量。

随后用本目录 `import_kimodo()` 保留全部77骨。和未转换输出比较位置/旋转在C基变换下的等价；再单独做SOMA→Anny104标定。第三阶段没有完成前，UI仍只能播放现有自有动作。

### ProtoMotions

优先选择模型卡明确允许的后端与checkpoint。CPU调试可考虑G1 deployment tracker+MuJoCo，不能拿IsaacLab-only checkpoint声称CPU等效。Git LFS真实数据、配套resolved_configs、机器人资产齐备后，参考官方：

```sh
python protomotions/inference_agent.py --checkpoint data/pretrained_models/motion_tracker/g1-bones-deploy/last.ckpt --motion-file data/motion_for_trackers/g1_bones_seed_mini.pt --simulator mujoco --num-envs 1
```

成功证据：实际模拟step、rollout日志、终止/跟踪误差、原生视频。接Kimodo时先原格式conversion后离线追踪；23骨代理输出只能作为物理分支，不覆盖完整源动作。真正训练另需GPU/时长/数据条件，不在网页主线程中伪装。

### StableMotion

需要合法SMPL/AMASS资源、对应normalizer和可信checkpoint。按README建立BrokenAMASS测试子集；保持20fps和233维输入协议。参考原生命令：

```sh
python -m sample.fix_globsmpl --model_path <trusted-ema-checkpoint> --use_ema --batch_size 1 --testdata_dir <licensed-test-data> --output_dir <run-dir>
```

成功证据：实际detected质量通道、修复mask、before/after、good-frame preservation误差；记录normalizer和checkpoint哈希。TMR评估是额外依赖，没跑就不报TMR分。不能用Anny104矩阵直接填充233维特征，也不能把本目录阈值QA输出包装成StableMotion预测。

## 共同验收条目

1. 坐标：C determinant为+1，90°/180°单轴旋转等价，不接受反射。
2. 时间：真实fps、采样端点时长、无跨clip平滑接触，插值策略明确。
3. 根：长路径累计位移保留，原点变换最多clip级一次且留证；无逐帧bbox归零。
4. 骨架：固定骨名/父表/rest指纹，明确virtual root、twist、hands和未映射关节。
5. 质量：足支撑、穿地、速度/加速度、骨长、任务约束、视觉与物理单列，阈值按任务记录。
6. 身份：完整顶点/面拓扑、CSR最多9影响、CommonSkinLayer继续保留。
7. 数据：source→converted→retargeted→cleaned不互相覆盖，数据库哈希可反查每一步。
8. 权利：源代码、模型、输入/训练数据、生成结果分别有许可记录，受限内容不进入Pages。

## R01已执行与未执行

已执行：28项Python契约/诊断/数字NPZ往返测试；36人物×31帧=1116帧104骨原生packet JSON往返，252个负向检查。

更新：官方SOMA0.3.3与CPU PyTorch已安装在隔离venv，native low单例23项已通过；mid尝试137退出。PREFLIGHT.json保留安装前快照。

未执行：其余四套原系统运行、所有神经推理/训练、SOMA→Anny104重定向标定、真实视频动作恢复、物理追踪、StableMotion修复、模型前后视觉等效比较。本目录有接口落实和数值证据，但不能宣称1:1效果复现。
