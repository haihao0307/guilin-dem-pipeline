# F11 · 源区、体量、数量与表现交接

## 生成权威

完整 P01 原生公共表面 → 已通过头皮域 → 11 个独立主源区 → 默认 43 个有面积的子束源区 → 各自的二维截面场、连续扭转和发梢 → 各自的三维体量 → 实际独立密集发丝 → 后续表现资产。助手绘制的照片分区图不参与生成。

每个源区拥有原生三角面及裁分顶点重心坐标、实际三维面积和 CDF。边界点继承所属源区，即使恰好位于分缝或另一个区域的判断平面，也不可在生成中途重新分类。volume.anchors/progress 保留每个顶点的原生出发绑定与生长进度；progress=0 的构建坐标精确等于该原生源点。

## GuideGroom@5

保存 target、design、native guides、coverage、personArchive、placement 和 extensions.bundlePlan / bundleVolumes / population / motionRules。老 GuideGroom@3/@4 或 F09 的 bundleVolumes@1 不可静默解释为 F11 的有截面体积包。旧方案参数可以显式迁移，所有体积重新生成。

- guides：精确 binding、根三角面局部偏移、当前 native-common-viewer-Yup 路径、完整 bundleId 和内在头皮图表 sourceChartP。
- bundlePlan：3067 个固定工程根点的互斥归属、192 个导向和真实发梢。不是全部生物毛囊。
- population.budget：每个源区与六个层组的面积、目标密度、整数数量和稳定种子。
- population.rootPatches：完整 source cells 的原生面 f、裁分顶点重心坐标 b、内在 chartP、三维面积和累计分布。面积加权随机点可直接生成最终目标数量的根绑定。
- bundleVolumes@2：各主源区、独立子束源面积与整数数量；每子束的 sourceMap、anchorRootId、原生 binding，以及 65 个截面的 center、tangent、widthAxis、thicknessAxis、halfWidth、halfThickness、twistRadians。截面宽厚是独立的二维尺寸；globalShellUsed=false。
- sourceMap：仍在内在头皮图表中，保存两个坐标轴、条件纵向边界、矩形到圆盘的映射和方向符号。不能按世界坐标解读，也不能把根区映射换成相片上的像素分区。
- 每个截面坐标架先沿路径作最小旋转运输，再叠加人工造型扭转；它的正交性和中段非零宽厚必须通过验证。截面初始尺寸、扭转和收尾是工程造型目标，不是材料测量。
- motionRules@2：工程保型/活动初值，包含弯曲、扭转和截面保型权重及允许扭转角包络。rest、equilibrium、runtime 及材料质量/刚度/阻尼保持未求解状态。

构建阶段 positions/targets/sections 使用 head-aligned Y-up/Z-front。导出路径、所有造型控制点、截面中心和三条截面轴统一转入 native-common-viewer-Yup；截面锚点必须与对应原生导向 binding 完全一致。sourceChartP 仅作同源区的内在邻近权重，不能当作世界位置。当前原生人物三角面索引必须再校验 SHA256，局部偏移依当前原生根框重建，placement 只应用一次。

## 数量与采样

每源区目标约为 areaCM2 × densityPerCM2；整数余数统一分配，子域/层组/总数必须一致。默认 180 是可调目标密度，非照片或生物测量。先按 source cell 的面积 CDF 选三角形，再用平方根均匀三角采样，混合该单元顶点的原生重心坐标。固定 seed 保证可复现；数量增长保留序列前缀。

同一体积子束内 K=3 导向覆盖是稀疏插值关系，不等于完整密发丝几何。源区边界、宽度、厚度、内收和发梢目标在表现替换时应保持。消费方按实际生成密度和宽度重新进行身体及发发接触检查。

## 显示与真实绑定分开

透明度为检查参数，不是物理透射率。源区盖面在显示时沿原生法向抬高 0.8 mm，以消除与高密度皮肤的遮挡；真实 source cells、guide roots 和导出 binding 不变。显示几何的这个抬高值不得写回毛根或物理参考状态。

轻微原生转头已检查。复杂表情、极端体型、剧烈动作、有限半径与动态接触仍未认证；finiteWidthCollisionCertified=false。表现资产由另一工作台提供，当前包含完整三维发丝路径，最终半径几何、发色和材质由表现工作台继续处理。

交接文件默认无损压缩为 `GuideGroom_F11.json.gz`；`decodeGroom` 可读入压缩或普通 JSON。直接调用 `exportGroom` 仍返回普通对象，所有原生面和面积分布保持原精度。

## 保持体积及扭转的交接约定

表现资产应占据同一子束的二维截面，保持厚度和顺序；不能把整个子束折成单张带子，也不能跨子束混合导向而抹掉截面扭转。相邻子束可以按整体轮廓合理重叠，当前没有发发接触认证。

GuideGroom 保存的是与显示体积相同的截面场，加上中心线的原生身体避让。逐节点的身体投影不等于整个体积的连续无穿透证明，导向经过局部身体修正后也不要求与理想椭圆每点重合。消费方需按最终密度和发卡/发丝厚度重新检查接触。

弯曲与扭转分别处理。路径切线决定前进方向；宽度/厚度轴围绕切线的变化决定截面转向。物理消费方应区分造型目标扭转与实际扭转应变，校准无应力参考。当前所有截面是静态造型参考，未运行动力学求解。


## F11 完整发丝交接

`kaopu/native-dense-hair@1` 是独立压缩二进制文件。解压后前 4 字节为小端 uint32 JSON 头长度，随后为 UTF-8 头，再按 parts 顺序存储连续数组块。positions 是 Float32，每根 49×3 个原生人物 Y-up 米制坐标；bindings 是 Float64，每根 [原生三角面索引, b0, b1, b2]；appearance 是 Float32，每根 [相位, 长度变化采样, 路径微变幅度米, 色调采样]。各块 offset 相对数据区，类型、字节数、根绑定和总数由 readDenseHair 检查。不能将这个格式误读成仅有导向的 Groom。

头保留 nativeSource、nativePositionSHA256（当前公共表面按 Float64 数组字节计算）、personArchive、recipe、各层/子束及 placement。恢复相同原生人物和位置后读取路径，placement 只应用一次。根绑定供随人物表面更新，路径点已是当前原生坐标；不得再次套用构建期对齐变换。

默认 114171 根均有完整路径。预览逐根显示，屏幕像素宽的线段不等于真实直径渲染；70 微米和渐细半径曲线是未标定表现初值。完整有限半径、自碰撞、动力学和最终材质仍未认证。单独导向包的 extensions.denseHair 明确指向该文件。
