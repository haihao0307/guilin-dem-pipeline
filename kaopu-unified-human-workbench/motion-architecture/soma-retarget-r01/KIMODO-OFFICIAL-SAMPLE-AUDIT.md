# Kimodo 官方预生成例：固定来源与格式核查

核查日期：2026-10-09。仅下载并读取217 KB的示例NPZ和文本说明；没有下载模型权重，没有执行生成模型，没有修改生产。

## 结论

- **真实性、完整性和native数据格式：已核实，可用于只读适配研究。**
- **它是官方预生成输出，不是本机CPU推理结果。**
- **它是旧版30关节样例，不是当前77关节完整输出。**
- 许可有仓库级Apache-2.0依据，但没有找到该NPZ的逐例独立许可。README明确把checkpoints/data另列，故公开再分发的资产许可记录应保留这一限定；不能把“未见单独限制”写成“独立数据许可已明确核实”。

## 固定来源

仓库：`nv-tlabs/kimodo`

固定提交：`58e781898b3d7e328a676a75d3e338c45dce3ad9`

准确路径：

`kimodo/assets/demo/examples/kimodo-soma-rp/01_single_text_prompt/motion.npz`

[固定提交中的原文件](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/assets/demo/examples/kimodo-soma-rp/01_single_text_prompt/motion.npz)

- Git blob SHA-1：`a235886651c3013d551781c66593efcb83b65789`
- 文件SHA-256：`37b6f13ed9c9f55696a9f9c896e8770fbdbd622864b08cd075e4eaf3a6a21f95`
- 实际字节数：**217,398**
- 本地重新计算Git blob SHA-1和SHA-256，均已记录；Git blob与固定树一致。
- 是真实NPZ文件，非LFS指针。用`numpy.load(..., allow_pickle=False)`成功读取。

配套meta：

[固定meta.json](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/assets/demo/examples/kimodo-soma-rp/01_single_text_prompt/meta.json)

- Git blob SHA-1：`081a217a0f0c7fe95b905e939905b61a853c746b`
- 257 bytes
- text：A person runs forward and then leaps over an obstacle in front of them.
- duration：5.0
- num_samples：1
- seed：42
- diffusion_steps：100
- CFG：enabled，text_weight=2.0，constraint_weight=2.0
- 未嵌入具体checkpoint版本，不能标记为v1.1重新生成结果。

[官方examples文档](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/docs/source/interactive_demo/examples.md)明确说明加载的是预先生成的motion，并带有当时的prompt、constraint与生成设置。文档blob：`d3ad1e18087e8409a32b5bbbf4d356bd8f07994a`。

## 实际native格式

NPZ仅有以下三个数组：

| 字段 | 形状 | dtype |
|---|---|---|
| posed_joints | (150, 30, 3) | float32 |
| global_rot_mats | (150, 30, 3, 3) | float32 |
| foot_contacts | (150, 4) | bool |

- native骨架：**somaskel30**，关节0为Hips。
- 帧数150，配套meta时长5秒，得到**30 FPS**，与官方模型配置/文档一致。NPZ没有嵌入fps字段，必须把来源记录为meta+官方约定，不能称读取自NPZ字段。
- Kimodo约定：米、Y向上、+Z向前；文件本身无坐标系元数据。
- 没有`local_rot_mats`、`root_positions`、`smooth_root_pos`或`global_root_heading`。
- 所有数值有限；旋转正交性最大绝对误差约6.56e-7；det(R)范围[0.9999994,1.0000006]。这里只验证数据健全性，不证明动作物理正确性。
- native30的4个接触通道依官方代码顺序为左脚、左脚趾、右脚、右脚趾。

[官方骨架说明](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/docs/source/key_concepts/skeleton.md)明确说明旧assets和examples可能仍保存为somaskel30，并保留兼容支持。[输出格式说明](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/docs/source/user_guide/output_formats.md)也说明旧30关节NPZ仍可存在。不要用最新格式文档覆盖本文件实际schema。

30个关节名称、父子索引、所有统计与来源均写入配套`PROVENANCE-QA.json`，从固定提交`SOMASkeleton30.bone_order_names_with_parents`静态解析，没有执行下载的源码。

## 适配规则

1. 保留原始三数组，先把它标成“Kimodo官方预生成示例 / native somaskel30 / 30 FPS”。
2. 若工作台支持30关节，可原样呈现骨架和轨迹，无需扩成77。
3. 若需要77，先用官方30层级把global旋转转换为local：非根关节为parent_global转置乘child_global，根旋转直接取原值。根轨迹取`posed_joints[:, 0, :]`。
4. [官方SOMASkeleton30转换函数](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/kimodo/skeleton/definitions.py#L246-L286)以relaxed-hand rest pose补齐77关节，再重跑FK。新增手指/趾链不是该文件原生逐关节生成的细节，需记录为转换补齐。
5. 原始foot_contacts是4通道。官方30→77转换会复制toe接触，输出6通道；不要照文档通用“四通道”文字硬套。
6. 当前`load_kimodo_npz_as_torch`看到已有posed_joints和global_rot_mats会直接返回，**不会保证补出缺少的local/root字段**。不要假定简单调用当前加载器就得到完整七字段schema。
7. 只读转换/回放即使成功，也不能把模型状态提升为“本机Kimodo推理通过”。

## 许可证据与限定

- [固定根LICENSE](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/LICENSE)：Apache-2.0，NVIDIA 2026版权声明；blob `e048a61796b130714fac0dffe9a3c2a1faf9521d`。
- 固定完整仓库树未发现examples目录下的LICENSE、NOTICE或单独数据许可说明。
- [ATTRIBUTIONS.MD](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/ATTRIBUTIONS.MD)仅列LLM2Vec MIT与Unitree MuJoCo BSD-3-Clause，没有为此SOMA示例指定单独许可；blob `ca10ff22ca65d441acfbceea3638894c69f7f909`。
- [README许可段](https://github.com/nv-tlabs/kimodo/blob/58e781898b3d7e328a676a75d3e338c45dce3ad9/README.md#L236-L240)把代码的Apache-2.0和HF中的checkpoint/data许可分开。该NPZ是仓库附带预生成示例，没有另外指向某个HF数据许可页。
- 因而可明确记录：**repository license Apache-2.0；example-specific license not separately stated；coverage of this bundled generated asset is inferred from repository context, not explicit per-file grant**。
- 不能由模型训练用过Rigplay推导“该示例就是受限Rigplay原始mocap”；官方文档称其为生成输出。也不能反向认为NVIDIA权重许可“不主张输出所有权”就自动替代对官方作者输出文件的再分发许可判断。
- 若依据仓库Apache上下文决定再分发，应保留来源、版权和完整Apache许可，转换文件注明修改，并避免声称这是自行运行所得。严格要求逐资产显式许可的发布流程，应将该项保持待确认。

## 本地证据

目录：`evidence/kimodo-official-sample/`

- `motion.npz`：原文件，校验通过
- `meta.json`：原始配套metadata
- `PROVENANCE-QA.json`：来源、native schema、joint_names、parents、完整性校验
- `LICENSE.Apache-2.0.txt`：仓库原许可
- `examples-doc.md`、`skeleton-doc.md`、`output-formats-doc.md`：固定提交说明

原NPZ、meta和源文档保留在本地研究缓存，不随此目录再分发。公开内容仅本说明及 [schema与哈希核验](KIMODO-SAMPLE-PROVENANCE-QA.json)。

