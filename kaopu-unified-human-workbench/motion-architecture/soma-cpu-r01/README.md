# SOMA-X native CPU 最小实跑 R01

2026-10-09 实际运行，不是合成接口数据。范围是官方解析身体表示、骨架与蒙皮；没有训练、corrective MLP、动作生成或 SOMA77 → Anny104 重定向。

## 已通过
- 官方 PyPI `py-soma-x==0.3.3`；已安装核心 `soma/body/soma.py` 与固定源码 `d6aa640f7787498009c4e3d57fcc14a243905d10` 逐字节一致。
- CPU PyTorch `2.14.1+cpu`，Python 3.12.14，4计算线程，`identity_model_type="soma"`, `mode="torch"`, `lod="low"`, `correctives_model_path=None`。
- native 4505顶点、77 joints、78公共transforms；128 identity系数全零，pose轴角弧度全零。
- 23项检查：有限值，forward与缓存prepare_identity→pose完全一致，重复确定性，左前臂XYZ各±10°，Hips不随前臂改变，根平移和virtual Root恒等。
- 六次实际旋转角均10.000165°；根平移顶点最大误差2.3842e-7米。测试内容与阈值在脚本，不是全模型功能验收。
- 首次成功运行初始化1.626秒、首forward6.809秒；复跑初始化1.550秒、首forward0.050秒；不可当作通用性能基准。

## 真实失败和边界
默认mid 18056顶点试跑以137/Killed退出；疑似资源内存限制，未取得内核OOM证据，不能宣布mid成功。low由官方参数选择，没有改上游实现。首次构造曾因Warp默认缓存位于只读home失败；使用官方 `WARP_CACHE_PATH` 指向测试目录修复。即使mode=torch，上游也初始化Warp；无CUDA驱动警告不妨碍此次CPU运行。

安装最初与CPU torch并行导致pip解析到了普通GPU torch依赖；在安装前中止该过程，随后通过 `cpu-constraints.txt` 固定CPU torch重装。最终冻结清单无nvidia CUDA包；warp-lang本身仍含它的官方运行资源。不得把下载过但未安装的中间依赖算成模型资源或GPU实跑。

## 最小原生资产
仅三文件54,934,204字节，官方HF revision `d281db2d01553f7230c56e764cec00fe27ef23f7`，各字节数与SHA256见ASSET-VERIFICATION.json。原始文件不随此研究目录再分发。

来源：[NVIDIA原生资产与Apache-2.0模型卡](https://huggingface.co/nvidia/SOMA-X)、[许可证](https://huggingface.co/nvidia/SOMA-X/blob/main/LICENSE)、[官方源码](https://github.com/NVlabs/SOMA-X/tree/d6aa640f7787498009c4e3d57fcc14a243905d10)。未使用SMPL/MANO/MHR转换数据，无需模型账号注册；不下载整个867MB仓库或70.5MB correctives权重。

## 重跑
1. 在隔离目录创建Python venv；从官方CPU PyTorch索引安装torch，再安装 `py-soma-x==0.3.3` 并使用CPU constraint。实际完整环境见requirements-frozen.txt，未来可用性需另核实。
2. 从上述固定HF revision只下载manifest中三文件到脚本旁 `assets/`，逐项核对size/SHA256。
3. `python run_minimal.py`；脚本禁用HF网络下载、指定本地Warp缓存，生成SOMA-CPU-QA.json。CPU/平台不同可能有微小数值差异。

## 下一步与接入边界
本台完整104骨/形体/皮肤未改变。下一可执行实验是原生单关节旋转与rest基准可视化、native局部旋转/根轨迹导出和明确的77→104映射标定，之后才谈形体动作回放。生成、视频恢复、质量修复和物理追踪仍分别等待Kimodo/GEM-X/StableMotion/ProtoMotions真实原系统测试。当前老师生成动作库存仍为0，不将零姿与测试摆臂计成18种招式。
