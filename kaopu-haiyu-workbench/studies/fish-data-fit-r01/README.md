# 海羽：真实局部骨样本 → 参数函数 → 轻量骨架主形

2026-10-07。本地独立研究候选；没有修改 C01/C02/C03、母台入口或其他项目，本候选可进入专用QA分支；没有发布母台。单文件 `preview.html` 可独立打开。实际浏览器验证仍待可用的专用 QA 环境；几何测试和 DOM/Canvas 调用烟测不能替代它。

## 已实现与形态范围

- 标本是鲭鱼 Scomber japonicus、SIO 80-267，第2–12椎，共11椎。绝不是整鱼，也不是吞拿。
- 从每椎15个专家标志点提取19个形状标量、中心和右手局部框架；不使用扫描网格的顶点生成模型。
- 19通道：椎体长度、高度、单侧半宽、腹侧收腰比例；前/后神经弓融合点的x/z；棘尖x/z；前/后弓根x/y/z；横突或血弓根x/y/z。
- 每椎用160个椎体三角面及少量三维弓/棘曲线生成。11椎总1760面、977曲线点。OBJ是程序生成的结构体，含面与三维线段；它不是等价的完整骨组织表面。
- 神经弓根来自实测侧的点位代理，另一侧明确镜像。由于简化椎体表面不等于原扫描表面，用自写短桥将实测弓根接到生成椎体的具体顶点，保存并检查父mesh/id和vertex地址。
- 开放通道保留为弓的拓扑结构；没有测量骨壁厚度、椎体端面杯口深度、体积或神经管精确横截面积。椎体不挖未经证实的贯穿孔。
- LM9/10只能确定根部；没有补造肋骨、血棘远端或鳍条。

## 坐标与尺度核验

先读 `real_3d_sample/eidc_supporting_docs/supporting-documents/Fishdatainfo.txt` 原作者方法与逐点语义。原点文件头写 Raw Points [mm]，原STL头写 Unit:Millimeter。

`derive.py` 直接计算v8每个原始点到205,050个原STL三角面的最近距离，没有应用任何平移、旋转、缩放、ICP或拟合变换。最大距离0.0000040000 mm，RMSE 0.0000017377 mm，符合坐标导出的舍入量级。此结果证明这一个椎的点与网格数值配准，不证明所有标本、所有椎共享坐标。

11行端面中心排序连续：相邻中心节距2.201508–2.618888 mm；前一椎后端中点到后一椎前端中点间距0.056788–0.151683 mm；中心链长度24.626412 mm。它支持当前11行是局部连续段，但原作者未明确记载逐行共同坐标合同，故保留局部范围和未完全核验声明。原v1/v15网格没有强行拼进该段，也没有整鱼配准。

端面中心=(LM3+LM4)/2、(LM12+LM13)/2，长度是两者距离。它是本研究定义的代理，不冒充原作者标准长度或FishCuT CentrumLength。
局部X=前端→后端；Z由前后背腹向量正交化；Y=Z×X。局部左右符号不强行指定为解剖左或右。

继承原样本限制：v1扫描98个连通分量，原表面小片未清洗；原扫描网格、原包和原噪点均不进入候选几何。

## 少量函数与误差

提供两种参数模式：
1. 默认逐椎实测派生量，几何由同一函数生成。
2. v2/v5/v8/v12四个固定锚点作分段线性插值，仅作压缩误差对照。固定锚点不是原论文统计分区，也不是解剖分区。

四锚点在11个样本处的RMSE/最大绝对误差：
- 长度：0.041034 / 0.092941 mm
- 背腹高：0.013104 / 0.025748 mm
- 单侧半宽：0.009653 / 0.018835 mm
- 棘尖x：0.383370 / 0.973967 mm
- 棘尖z：0.278062 / 0.646349 mm

结论是维度谱可压缩，但四锚点不足以保留神经棘局部变化。网页给警告，默认保留11椎的真实变化，不把平滑曲线包装成通过验收的精确骨形。
以上是参数误差，不是模型到原骨表面的Hausdorff误差；也没有统计重复测量误差或生物个体差异。

## 与海羽结合

`frame-core.mjs` 与 `curve-math.mjs` 原字节复用现有鸟/鱼学习案例。SHA校验在 `qa/reused-core-hashes.json`。
- 原坐标模式：把原中心与局部框架作统一刚体观看变换。
- 海羽映射模式：采样现有axis函数，按局部样本累计节距分配弧长地址，使用现有transportedFrames（离散最小旋转输运近似）安放骨形。
- 横向尺度、棘长尺度、弯曲只有3个设计控制。它们不是活鱼运动、关节自由度或力学参数。

最小接口见 `data/sample.json`：schema / specimen / scope / unit / provenance / registration / records（编号、s、pitch、center、basis、params） / fit / assumptions。没有数据的头骨、肋、鳍及运动范围均为null，不猜。

## 验证

- `node tests/geometry.mjs`：216组状态，通过有限性、右手正交框架、真正父网格顶点连接、同一世界几何投影不变、确定性、参数边界、端面间距恢复、v8点面配准阈值。
- `node tests/dom-smoke.cjs`：完整bundle执行、视图切换、单椎、原点叠加、拟合警告、弯曲/宽度/棘长、复位通过。是模拟DOM/Canvas方法调用，不能称真实网页验收。
- `tests/browser.cjs`：已准备真正Chromium测试，当前环境因进程socket权限限制未能启动。云浏览器不支持file://，未绕过。`qa/browser.json`记录失败原因，`qa/geometry.json`的browserVerified仍为false。
- `qa/three-view-proof.png`、`qa/v8-landmark-proof.png`是同一三维输出数据的程序投影证据，已目视检查；不是浏览器截图。

复算：`python derive.py`（需同级real_3d_sample）、`python build.py`、上述两项Node测试、`node export_obj.mjs`。`render_proof.py`输出证明图。

## 后续数据进展与边界

另见 `../topology_followup.md`。新增113个有效马拉维慈鲷标本的前尾/尾/总数和骨性长高比，可为完整骨架拓扑接口提供约束；异种数据不移植进本鲭鱼样本。还实取本鲭鱼区域化模型表，但断点索引尚未独立解释，不作为解剖边界。
新慈鲷24×15点坐标虽标mm，数值尺度出现明显疑问，未并入当前几何。72点全身锚点数据仍未取得。没有任何同一标本的完整颅骨+脊椎+肋+鳍可动拓扑。

## 来源与许可

Criswell, K.E.; Head, J.J. (2024). Morphological and morphometric data on the axial skeletons of vertebrates from museum specimens. EIDC.
https://doi.org/10.5285/1c76e443-da02-4bc4-a041-0f79adc016be

点文件：
https://catalogue.ceh.ac.uk/datastore/eidchub/1c76e443-da02-4bc4-a041-0f79adc016be/Landmark_files/scomber_vert02_12.txt

Open Government Licence v3：https://eidc.ac.uk/licences/ogl/plain
Rights holder: University of Cambridge.
Contains data supplied by UK Centre for Ecology & Hydrology.

归档部分STL来自MorphoSource，SIO80-267精确上游CT编号仍未核。这里没有上传或再发布原CT、扫描网格或支持材料原包。自写代码与有限派生量的公开QA仍须在既定授权范围内处理；不得把归档许可扩展到未核的上游原素材。
