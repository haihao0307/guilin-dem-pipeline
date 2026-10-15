# F12 · 原生路径与局部定型契约

## 数据权威

完整 P01 原生公共表面 → 已通过头皮域 → 11 个主源区 / 默认 43 个子束 → 每根自己的连续 RootFlow → 横向与扭转偏移 → 实际三维曲线及体积。默认 114171 根为实际源面积乘工程密度的目标，不是测得的生物毛囊数。根身份固定，近缝几何交叠不改变归属。

构建为 head-aligned-Yup-Zfront，交付路径、导向控制点和截面统一为 native-common-viewer-Yup，单位米。绑定是同一 P01 的实际三角面与重心坐标。不得用内部 Z-up 位置或再次应用构建变换；placement 只应用一次。

## GuideGroom@6

包含 target、HairDesign@4、192 根导向、3067 个工程根的覆盖、人物存档和 placement。extensions 包含根区计划、面积 CDF / 数量、BundleVolumes@3、StyleRules@3 和独立完整路径文件标识。旧 GuideGroom@5 不静默解释为本版；旧方案参数可以显式迁移并重建。

BundleVolumes@3 每束保存源面积、数量、锚点及 65 个截面。截面中心、宽厚轴和半径来自实际显示体积的测量，是保型/检查包络。RootFlow 与 source-chart 横向参数为生成方法，完整文件保存字面路径；不能用椭圆包络替代路径并声称结果相同。源区盖面显示抬高 0.8mm，不写回根点。

## HairDesign@4 / StyleRules@3

styling=kaopu/hair-styling-map@1：product=free/wax/gel，strength=0..1，zones={part,crown,fringe,tip}，overrides=[{clumpId,start,end,strength}]。区间为根到梢归一化弧长，边缘平滑，单束覆盖不跨束。

StyleRules@3 保存真实段长和逐点权重。根 pin=1，mobility=0。近根、分缝、冠部、刘海、发尾及局部覆盖分别参与计算。shape/bend/twist/section/clump hold、windInfluence、dampingWeight、mobility 和包络均是无量纲控制。productProfiles 给出当前档位系数，参考框架随当前头部，而非世界空间。

材料质量、弯曲/扭转模量、每秒阻尼系数、XPBD compliance、stress-free rest、gravity equilibrium 与 runtime 未标定/求解。不得把 dampingWeight 当有物理单位的阻尼，或把设计下垂和重力重复计算。有限半径与发发接触未认证。

## NativeDenseHair@2

解压后为 4 字节小端 uint32 JSON 头长度、UTF-8 JSON 头、按 parts / blocks offset 排列的数组。positions=Float32，每根 49×3 个当前原生坐标；bindings=Float64，每根 [triangle,b0,b1,b2]；appearance=Float32，每根 4 个稳定造型样本；sourceCharts=Float32，每根 3 个已通过头皮内在坐标，不能当世界位置。

头保留 nativeSource、当前公共表面 Float64 字节散列 nativePositionSHA256、personArchive、recipe、层组/子束、一次 placement 和 motionProfile。motionProfile 含 StylingMap、活动自由度、档位系数、冻结源码提交与算法版本。消费者用真实路径弧长、sourceCharts 和 clumpId 调用同版本 Styling.mjs 的 motionWeights，可恢复逐根逐点权重；不需要任意跨束插值。

readDenseHair 检查版本、字节区间、数量、有限值、原生绑定和定型配置。GuideGroom@6 的 motionRules.styling 必须与 design.styling 一致。原始位图、旧手绘分区、另一参考头、第三方发型资产均不参与交付。


共享皮肤接入记录：用户在“皮肤”任务中明确要求总平台、当前头发和服装宿主统一到 50f9dd769893584dedb62f0bc62db07ebcb1dcc0 的 SKIN-FULLBODY-R02。保留这项同步，不修改七个皮肤模块。F12 将相同字节快照与宿主适配器固定在 vendor/shared-skin，逐文件校验，避免未来构建依赖可变的工作区外文件。毛发前后对比采用相同皮肤呈现；旧 F11 字面路径仍用于根绑定和转角对比。

referenceLengthProfile@1 在完整路径头和导向包 extensions 中记录本次参考的长短层分配方法。短冠层、下颌过渡和肩上长层均来自自己的毛根；三种颜色是按实际终点的检查标签，不是生物毛囊类别或壳面切片。真实终点以 positions 为准，侧后层分配为推定。
