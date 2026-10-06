# Anny R02：精确性审计与修正

结论：R01是一个官方默认全身模型的部分浏览器移植，不是官方完整交互demo的精准复刻。核心数值测试通过不能证明界面输入语义、全部功能、导出协议或显示一致。

固定上游：[Anny v0.6.1 / d6fc027](https://github.com/naver/anny/tree/d6fc027ced5c17b6b0775dee944096ade7a9ef80)。

## 确认并修正

1. **姿态XYZ含义错位**：官方demo用 `rotvec_to_rotmat(deg2rad(XYZ))`，R01用了 `Rx·Ry·Rz`。同输入头部20/30/40，顶点最大差30.89毫米；左上臂30/40/0，差43.95毫米。R02恢复旋转向量与每分量±180范围。此前测试以R01欧拉输入生成参考，没有覆盖这个界面协议差异。
2. **漏掉全部官方表情**：官方demo创建模型时 `facial_actions="all"`，共有52个actions。R01使用none。R02追加官方原始顶点、骨骼头及骨骼方向表情张量，含张嘴、眨眼、微笑等全部52项，不用其他模型替代。补充数据压缩约207KiB，原全身数据保持不变。
3. **参数导出不互通**：R01自定义JSON不能作为官方demo参数文件直接交换。R02增加原字段 `phenotype_kwargs/local_changes_kwargs/facial_actions/pose_parameterization/pose_parameters`，骨骼使用4×4矩阵；同时保留带版本校验的工作台档案。R01导入会转换欧拉角到旋转向量，保留原有几何结果。
4. **“官方默认”按钮含混**：R01的形态预设只重置六个轴，可能留下局部变化。R02分开“仅还原全部形态”（六轴、局部、表情，保留姿态）与“还原官方基线”（全部清零回默认），对齐官方Reset shape的范围。
5. **自拟预设被混在官方体验里**：R01成年/肌肉/迈步等是工作台自行设置的参数组合，不是官方demo预设。R02移除这些组合，只保留明确标值的官方年龄锚点。
6. **显示与诊断不足**：R02采用官方青色PBR材质因子，默认中性照明，冷暖灯为可选工具；增加骨骼三轴显示和透明骨架观察。镜头与照明仍是网页展示，不宣称像素级复制Gradio。
7. **导出选项**：增加米制、Y-up的静态身体GLB，并保留原生Z-up的OBJ。GLB包括身体材质与官方参数元数据，不包含查看辅助线，也不是已绑定动画的角色文件。

## 不应误判为移植缺陷

- 官方默认六个形态轴均为0.5，形态不是“标准成年男性”或“标准成年女性”。官方all-actions全零时与R01保存的默认顶点逐分量完全一致，误差0。
- age锚点为 newborn=-1/3、baby=0、child=1/3、young=2/3、old=1。这是美术形态坐标，不是实际岁数。官方demo范围0–1；R02默认相同，newborn扩展需明确打开。
- weight不是公斤，height不是厘米；形态坐标不应拿来判断真实人的年龄、性别或族群。
- 官方README中的旧截图仍显示fullbody/default及152骨骼，不能用它代替当前v0.6.1代码标准。当前默认是anny拓扑、anny rig，104骨骼。
- 当前v0.6.1交互demo里的measurements_class实际为None。库有Anthropometry，但不能说当前demo原本启用了旧截图那些测量读数。
- 官方demo有自相交**诊断显示**，不是布料/人体物理碰撞响应；也没有自动步行动画或人体关节约束。

## 尚待完成，不宣称完整复刻

- 独立head、hand.L、hand.R等原生部件拓扑与对应rig
- 官方可用topology / rig选择
- 自相交三角形诊断

当前“聚焦脸/手”只是同一全身网格的镜头功能，不能冒充独立部件模型。SMPL / SMPL-X受限数据不会未经授权公开分发。优化、照片拟合与梯度反演属于进一步的库工作流，不是当前demo直接提供的UI。

## 验证

- 64组官方Python全顶点对照：52个表情逐一满值，官方多轴rotvec、180度边界、年龄锚点及形态+局部+表情+姿态混合
- 最大顶点分量误差约0.661微米；详见 tests/parity-report.json
- 基础模板、所有基础blendshapes、骨骼、蒙皮、面索引与R01数据逐项精确相同
- R01档案迁移与官方JSON往返测试的顶点差为0
- 浏览器测试另行覆盖真实渲染、输入语义、表情、导出、取消/重试与恢复，不能用数值测试替代视觉验收

## 直接代码证据

- [官方demo姿态与导出](https://github.com/naver/anny/blob/d6fc027ced5c17b6b0775dee944096ade7a9ef80/src/anny/examples/interactive_demo.py#L41-L102)
- [官方初始化与表情设置](https://github.com/naver/anny/blob/d6fc027ced5c17b6b0775dee944096ade7a9ef80/src/anny/examples/interactive_demo.py#L239-L269)
- [官方输入范围、部件与rig选择](https://github.com/naver/anny/blob/d6fc027ced5c17b6b0775dee944096ade7a9ef80/src/anny/examples/interactive_demo.py#L282-L480)
- [官方Reset shape](https://github.com/naver/anny/blob/d6fc027ced5c17b6b0775dee944096ade7a9ef80/src/anny/examples/interactive_demo.py#L621-L664)
- [年龄锚点定义](https://github.com/naver/anny/blob/d6fc027ced5c17b6b0775dee944096ade7a9ef80/src/anny/models/phenotype.py#L187-L213)
