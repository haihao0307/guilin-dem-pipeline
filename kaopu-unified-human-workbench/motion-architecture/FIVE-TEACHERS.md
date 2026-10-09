# 五个老师的源码解剖和接入决策

2026-10-09 核查。以下是代码阅读与文档核查，不是已完成模型运行报告。每项版本固定到提交，而不是依赖不断变化的 `main`。

## 1. GEM-X：视频动作恢复

固定提交：[32992550](https://github.com/NVlabs/GEM-X/tree/32992550dba114c62243fb55e361311972dce8f9)。

### 源码关系

- `scripts/demo/demo_soma.py` 组织 `_run_human_detection()`、`run_preprocess()`、`load_data_dict()`、模型预测及渲染。
- 观测预处理包含 YOLOX/ByteTrack 检测追踪、SOMA 2D关键点、SAM3D图像特征及相机信息。静态相机回退必须记录，不能当作成功恢复动态相机轨迹。
- `gem/gem.py::GEM.predict()` 构造长度、bbox、K、角速度、相机轨迹、特征和条件mask，调用 `Pipeline.forward()`。返回 `body_params_global`、`body_params_incam` 与中间 `net_outputs`。
- `gem/pipeline/gem_pipeline.py::Pipeline.forward()` 连接 denoiser / EnDecoder / 相机与全局参数解码；可调用接触相关平移修正和IK。`get_body_params_w_Rt_v2()` 把局部速度与相机变化累积成全局位姿。
- 训练为 Lightning/Hydra 配置；入口 `scripts/train.py`，experiment `configs/exp/gem_soma_regression.yaml`。源码里残留或共享的多模态接口不代表当前公开 SOMA 权重能完成所有 GEM-SMPL 研究版功能。

源码：[demo](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/scripts/demo/demo_soma.py)、[GEM](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/gem/gem.py)、[Pipeline](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/gem/pipeline/gem_pipeline.py)。

### 数据与复现条件

`preprocess/vitpose.pt` 为 T×77×3 的2D点与置信度；`hpe_results.pt` 是序列预测对象，不是可直接当作标准动作的JSON。必须选明 world/incam 分支，保存相机假设与置信度，并通过版本匹配的 SOMA 解码。摄像机坐标动作不能直接冒充世界路径。

官方安装路线含 Python3.12/CUDA PyTorch、SOMA 与其他感知依赖，GEM权重及SAM3D相关资产；还有独立ONNX/macOS路线，不能从它推断完整训练可在当前浏览器运行。训练文档说明所用 Bones RigPlay-1 内部合成数据没有公开，所以从头1:1训练不可仅靠这个仓库复现。

代码Apache-2.0；README将关联模型指向NVIDIA Open Model Agreement。第三方感知模型和原始视频另查许可。当前只阅读源码，没有下载视频、模型或训练集。

落地：作为“视频证据→候选动作”入口，保留不确定性和原视频时间码。先保存老师原生输出，不把2D点强行套成无误的身体姿态。

来源：[Demo格式](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/docs/DEMO.md)、[安装](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/docs/INSTALL.md)、[训练条件](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/docs/TRAINING.md)、[代码与模型条款](https://github.com/NVlabs/GEM-X/blob/32992550dba114c62243fb55e361311972dce8f9/README.md)。

## 2. SOMA-X：统一身体与骨架表示

固定提交：[d6aa640f](https://github.com/NVlabs/SOMA-X/tree/d6aa640f7787498009c4e3d57fcc14a243905d10)。

### 源码关系

- `soma/body/soma.py::SOMALayer.forward()` = `prepare_identity()` 缓存身份几何/绑定数据，再调用 `pose()`。
- `pose()` 处理pose参考系、公共骨架、procedural twist、skinning及可选correctives。`public_rig_view()`、`public_bind_transforms_world()`、`to_public_rotations()` 是可检查边界。
- 身份后端在 `soma/identity_model.py` 与 `soma/body/identity_model.py`；LBS/Warp实现、绑定变换和skeleton transfer在 `soma/geometry/`。`soma/fitting/pose_inversion.py` 处理拟合，不应和按名字复制关节混为一谈。
- `soma/hand/soma.py` 是独立手层；手部与身体的pose维度不同。

### 三种“关节数”不能混淆

当前公开全身体姿输入有77个可控关节；公共transform数组含虚拟Root共78个；较新procedural模式使用内部扩展twist骨架但保持公共返回契约。`poses[0]` 是Hips，其旋转相当于全局身体朝向。不能对78个transform再额外插一次root，更不能把内部twist骨直接按77个pose索引解释。

poses支持轴角 T×77×3 或 `pose2rot=False` 的矩阵。默认相对T-pose joint orient，`absolute_pose=True` 才是已经定向的父局部旋转。Kimodo absolute local 矩阵未经处理不等于这个默认参数。手层25个pose也不能塞进全身77维。

原生rig长度单位厘米；`output_unit` 默认米。公共输出右手+Y向上/+Z前方。Anny本台+Z向上/-Y前方和local-ref旋转向量度数完全不同。单纯角度单位转换不完成rest-frame校准。

源码：[SOMALayer](https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/soma/body/soma.py)、[单位](https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/soma/units.py)、[LBS](https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/soma/geometry/lbs.py)。

### 资源与接入

默认公开runtime资产首次使用从nvidia/SOMA-X取得；可指定本地data_root。PyTorch/Warp等依赖仍需安装。官方提供CPU示例，故“没有GPU”不等于SOMA数值单例绝对不可做；当前缺少包与资产，没有实际执行。MHR、Anny、SMPL-family、MANO等后端各有资源和许可边界；SMPL/MANO用户自行获得，不能随本台公开发布。

本台先借鉴“身份只求一次、动作独立更新”和公共/内部骨架分层，不把自己的25417顶点换成SOMA拓扑。未来SOMA→Anny必须保存neutral对齐、rest-frame对应、未映射关节、四肢长度/末端误差和扭转策略。

代码Apache-2.0，第三方后端许可独立；公开资产最终再分发仍按具体model card逐一核查，不从代码许可推定。

来源：[概览与后端](https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/README.md)、[安装及单独授权模型](https://github.com/NVlabs/SOMA-X/blob/d6aa640f7787498009c4e3d57fcc14a243905d10/docs/installation.md)。

## 3. Kimodo：可控运动学生成

固定提交：[58e78189](https://github.com/nv-tlabs/kimodo/tree/58e781898b3d7e328a676a75d3e338c45dce3ad9)。

### 函数关系

`kimodo/scripts/generate.py::main()` → `load_model()` → `load_constraints_lst()`、种子设置 → model调用 → 每个sample `save_kimodo_npz()`。模型封装 `kimodo/model/kimodo_model.py` 组织文本编码、ClassifierFreeGuidedModel、DDIMSampler、分段/多prompt生成和可选postprocess。`twostage_denoiser.py`、`backbone.py`、`diffusion.py` 是网络/扩散层。

`KimodoMotionRep.__call__()` 编码特征；`inverse()` 反归一化、6D旋转→矩阵、global→local rotation，恢复actual root，阈值化contacts，并选择用FK或位置恢复joint positions。`exports/motion_io.py::complete_motion_dict()` 从local rotations+root做FK、速度、smoothed root和接触推断。

输出七项：`posed_joints[T,J,3]`、`global_rot_mats[T,J,3,3]`、`local_rot_mats[T,J,3,3]`、`foot_contacts[T,4]`、`smooth_root_pos[T,3]`、`root_positions[T,3]`、`global_root_heading[T,2]`。接触顺序是左跟、左趾、右跟、右趾。矩阵旋转与axis-angle参数是不同协议。

源码：[CLI](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/scripts/generate.py)、[模型](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/model/kimodo_model.py)、[表示](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/motion_rep/reps/kimodo_motionrep.py)、[IO](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/exports/motion_io.py)。

### 复现与权利

该仓库提供推理/创作UI/benchmark，不能因为有PyTorch网络就宣称完整训练数据和原训练系统已公开。RP模型用700小时数据；SEED版本用288小时公开BONES-SEED子集。SOMA/G1模型对应NVIDIA Open Model条款，SMPL-X变体对应NVIDIA R&D条款；代码Apache-2.0不覆盖所有变体。

官方称全GPU约17GB显存，文本编码CPU后显存低于3GB，但这些是官方环境说明，本机尚未验证。还需要文本编码器和权重/统计资产。GUI是本地Python后端+浏览器界面，不是ThreeJS在浏览器中训练或推理。

本台已接入其**文件契约**，保留全部源关节，不替换smoothed root为pelvis、不擅自猜fps。真正原样推理应先按官方SOMA版本输出一次原生预览和NPZ，再执行本适配器。机器人动作生成之后仍需ProtoMotions之类物理追踪策略。

来源：[模型/许可证/资源](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/README.md)、[坐标表示](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/docs/source/key_concepts/motion_representation.md)、[结构](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/docs/source/project_structure.md)。

## 4. ProtoMotions：物理学习与控制

固定提交：[7a8417a9](https://github.com/NVlabs/ProtoMotions/tree/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1)。

### 结构与协议

- `protomotions/components/motion_lib.py::MotionLib` 读单条 `.motion`、YAML索引或打包 `.pt`，管理动作长度、fps、采样、插值、contact等。`get_motion_state()` 与 `get_motion_state_exact_frame()` 区分插值和确切样本。
- `protomotions/envs/mdp_component.py::MdpComponent` 将纯张量函数、动态FieldPath输入和静态参数分开。`resolve_args()`→`compute()`；同一binding可以导出ONNX输入，避免部署重写一套观测公式。
- controller提供任务状态，obs转换目标到身体参考系，reward独立计算，experiment配置装配；例如steering而不是单一巨大environment类。
- `simulator/base_simulator/simulator_state.py` 的common quaternion是xyzw；转换到某simulator可能需wxyz和body/DoF索引重排。G1 CSV的wxyz不能直接当作common state。
- 模拟状态/动作库包含刚体位置、旋转、速度、角速度、DoF和接触，不等于只有关节动画曲线。

源码：[MotionLib](https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/protomotions/components/motion_lib.py)、[组件装配](https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/protomotions/envs/mdp_component.py)、[状态](https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/protomotions/simulator/base_simulator/simulator_state.py)。

### 不可照搬的降级

官方 `convert_soma23_npz_to_proto.py` 从Kimodo的77骨提取23个驱动关节，明确丢弃手、指、脸与toe-end细节。这适合该物理代理，不适合替代本台完整人物。应保留两路：完整运动学表现，以及可声明损失的物理代理。不能让代理输出覆盖源动作文件。

源码还提供按frame修高度函数；本台**不采用逐帧整身bbox/最低点归零**，因为那会修改根轨迹、速度和支撑关系。若将来某离线修正有必要，必须保存修正量并重算相关速度。

来源：[Kimodo转换说明](https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/docs/source/getting_started/kimodo_preparation.rst)。

### 运行资源

支持多模拟器但能力不等价；MuJoCo是CPU单环境的快速检查路线。官方推荐的多数checkpoint限定IsaacLab；G1 deployment tracker有迁移导向训练，但不保证任意后端表现。不能在不同simulator加载一次就宣布1:1。

Git LFS保存checkpoint、motion和部分资产；只有pip安装或LFS pointer不构成可运行环境。IsaacLab/Sim可能有EULA，必须按实际条款确认。代码Apache-2.0，`legal/`中第三方身体/机器人资产独立；源码可复用不意味着捆绑所有资产可公开。

落地：学习其控制/观测/奖励/数据库分层，后续先跑匹配checkpoint+模拟器的原生追踪。当前没有安装模拟器或进行RL训练。

来源：[安装与CPU路线](https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/docs/source/getting_started/installation.rst)、[checkpoint限制](https://github.com/NVlabs/ProtoMotions/blob/7a8417a9f55b1586b0d6e8f46578c5bc9d7ce1f1/docs/source/getting_started/pretrained_models.rst)。

## 5. StableMotion：坏帧识别与条件清理

用户项目页：[StableMotion](https://xbpeng.github.io/projects/StableMotion/index.html)。由其Code链接核实仓库为Murrol/StableMotion，固定提交：[45d8836c](https://github.com/Murrol/StableMotion/tree/45d8836ce5cd7ae70f0065fdac672debfdfd6066)。

### 真正函数关系

`sample/fix_globsmpl.py::main()` → `get_dataset_loader()`/normalizer → `create_model_and_diffusion()` → checkpoint/EMA → `detect_labels()` → `fix_motion()`。

检测模式保持运动通道、重建quality label；清理模式扩张检测区域、保留选定好帧、给质量条件，再运行sampler。可选ensemble和soft-inpaint schedule。是同一质量条件模型的识别/生成两种用途，不只是一个评分器，也不是低通滤波。

`model/stablemotion.py::StableMotionDiTModel` 使用时步/模式条件和DiT块。`utils/model_util.py` 明确 `in_channels=233/out_channels=233`。实际loader导入 `globsmplrifke_feats.py`，该文件是232维动作特征，外加1个quality标签。旁边的 `globsmplrifke_base_feats.py` 是206维基础变体，**不是当前loader直接输入**；不能看到base文件就按207维接模型。

源码：[检测与修复](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/sample/fix_globsmpl.py)、[DiT](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/model/stablemotion.py)、[模型构建](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/utils/model_util.py)、[loader](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/data_loaders/globsmpl_dataset.py)、[232维表示](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/data_loaders/amasstools/globsmplrifke_feats.py)。

### 运行条件和本台边界

公开示例围绕SMPL/AMASS、20fps预处理、quality labels和训练集归一化统计。需SMPL相关授权模型；TMR用于评价；BrokenAMASS预训练checkpoint由README链接到OneDrive。公开BrokenAMASS的随机种子可能不同于论文实验，不能忽略这一点宣称复现论文指标。论文SoccerMocap结果也不能直接算成我们的人物/拳击测试结果。

源码MIT；checkpoint、SMPL、AMASS、TMR与输入动作许可各自判断。README建议自有数据域准备quality labels重新训练，不能保证BrokenAMASS权重跨到Anny104/拳击任务仍然可靠。

落地：数据库同时保存原动作、quality标记、清理mask、清理后动作以及好帧保真误差。本目录目前只做可解释的kinematic诊断与来源绑定，明确 `neuralQualityModelExecuted=false`。后续需要先原生SMPL协议运行，再论证向本台骨架转接。

来源：[复现资源与限制](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/README.md)、[MIT](https://github.com/Murrol/StableMotion/blob/45d8836ce5cd7ae70f0065fdac672debfdfd6066/LICENSE)。

## 总体设计决定

1. 离线重模型生成/恢复/修复，浏览器消费已验证的标准动作和矩阵包。
2. 原始源骨架、物理代理、展示骨架分别版本化。不能静默丢指骨或把不同pose参数同名相加。
3. 原生复现、契约适配、视觉相似、任务完成、物理稳定分别记状态，不用“已融合”模糊它们。
4. 使用源代码时保留对应许可/署名；本R01没有vendor五个老师代码或资产，只发布自有胶水代码、测试与来源链接。
5. 每条动作记录来源、源码版本、checkpoint/输入哈希、fps、骨架/rest校准指纹、坐标、根轨迹、接触、QA、权利和可公开范围。明确失败和未测项才可长期复用。
