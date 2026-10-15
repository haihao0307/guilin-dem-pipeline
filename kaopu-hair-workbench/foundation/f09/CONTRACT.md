# F09 · 源区、体量、数量与表现交接

## 生成权威

完整 P01 原生公共表面 → 已通过头皮域 → 11 个独立源区 → 各自的完整导向场和发梢 → 各自的三维体量 → 后续密集发丝/表现资产。助手绘制的照片分区图不参与生成。

每个源区拥有原生三角面及裁分顶点重心坐标、实际三维面积和 CDF。边界点继承所属源区，即使恰好位于分缝或另一个区域的判断平面，也不可在生成中途重新分类。volume.anchors/progress 保留每个顶点的原生出发绑定与生长进度；progress=0 的构建坐标精确等于该原生源点。

## GuideGroom@5

保存 target、design、native guides、coverage、personArchive、placement 和 extensions.bundlePlan / bundleVolumes / population / motionRules。老 GuideGroom@3/@4 不可静默升级成三维体量与数量包。

- guides：精确 binding、根三角面局部偏移、当前 native-common-viewer-Yup 路径、完整 bundleId 和内在头皮图表 sourceChartP。
- bundlePlan：3067 个固定工程根点的互斥归属、192 个导向和真实发梢。不是全部生物毛囊。
- population.budget：每个源区与六个层组的面积、目标密度、整数数量和稳定种子。
- population.rootPatches：完整 source cells 的原生面 f、裁分顶点重心坐标 b、内在 chartP、三维面积和累计分布。面积加权随机点可直接生成最终目标数量的根绑定。
- bundleVolumes：各个独立源区生成体量的版本、所属层组、源面积、边界与纵向分辨率等约定；globalShellUsed=false。
- motionRules：工程保型/活动初值。rest、equilibrium、runtime 及材料质量/刚度/阻尼保持未求解状态。

构建阶段 positions/targets 使用 head-aligned Y-up/Z-front。导出 paths 和 targets 转入 native-common-viewer-Yup；sourceChartP 仅作同源区的内在邻近权重，不能当作世界位置。当前原生人物三角面索引必须再校验 SHA256，局部偏移依当前原生根框重建，placement 只应用一次。

## 数量与采样

每源区目标约为 areaCM2 × densityPerCM2；整数余数统一分配，子域/层组/总数必须一致。默认 180 是可调目标密度，非照片或生物测量。先按 source cell 的面积 CDF 选三角形，再用平方根均匀三角采样，混合该单元顶点的原生重心坐标。固定 seed 保证可复现；数量增长保留序列前缀。

同组 K=3 导向覆盖是稀疏插值关系，不等于完整密发丝几何。源区边界、宽度、厚度、内收和发梢目标在表现替换时应保持。消费方按实际生成密度和宽度重新进行身体及发发接触检查。

## 显示与真实绑定分开

透明度为检查参数，不是物理透射率。源区盖面在显示时沿原生法向抬高 0.8 mm，以消除与高密度皮肤的遮挡；真实 source cells、guide roots 和导出 binding 不变。显示几何的这个抬高值不得写回毛根或物理参考状态。

轻微原生转头已检查。复杂表情、极端体型、剧烈动作、有限半径与动态接触仍未认证；finiteWidthCollisionCertified=false。表现资产由另一工作台提供，当前体量代理不包含最终发丝和材质。

交接文件默认无损压缩为 `GuideGroom_F09.json.gz`；`decodeGroom` 可读入压缩或普通 JSON。直接调用 `exportGroom` 仍返回普通对象，所有原生面和面积分布保持原精度。
