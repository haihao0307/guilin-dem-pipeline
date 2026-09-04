# Landscape Mother：大场景整体可读性与旋转一致性 R010

日期：2026-09-03。
类型：研究补充与函数合同设计。当前文件不构成运行实现或视觉验收。
前序：research-20260903-relief-lighting-r009/RESEARCH_ADOPTION.md。

## 用户意图修正

本次重点是整片地形在旋转时呈现出的完整、细腻、可信的整体观感。研究范围涵盖大尺度结构、地表分区、明暗层次、构图、运动和空间一致性。单块石灰岩的微表面研究保留为其中一个子系统。

用户观察到参考场景看起来很细，同时认为它可能没有那么高的实际细节密度。此观察是需要研究的线索，不能自动转换为低面数、低分辨率或高性能的实测结论。当前未检查源模型面数、顶点数、贴图尺寸、帧率或真实手机表现。

本次扩大知识适用范围，当前制作仍只围绕小型喀斯特样板。其他地貌暂停；不添加远山、雾、云、背景装饰或新场景。保留固定几何、零 LOD、零纹理采样与真值保护规则。没有生成或导入图片、贴图、外部模型，也没有修改线上工作台。

## 本轮依据

S1：https://www.ownkng.dev/thoughts/three-js-yuelongxueshan
S2：https://www.tylermw.com/posts/data_visualization/a-step-by-step-guide-to-making-3d-maps-with-satellite-imagery-in-r.html
S3：https://www.rayshader.com/reference/plot_3d.html
S4：https://www.rayshader.com/reference/ray_shade.html
S5：https://www.rayshader.com/reference/ambient_shade.html
S6：https://www.rayshader.com/reference/sphere_shade.html
S7：https://threejs.org/docs/pages/OrbitControls.html
S8：https://threejs.org/docs/pages/PerspectiveCamera.html
S9：用户提供 The PBR Guide，2018 第三版，第76至78页的高度与法线职责说明。

SOURCE_CONFIRMED 表示公开文章或官方文档明示。INDEPENDENT_DESIGN 表示独立转译。HYPOTHESIS 表示尚未通过对照实验确认的观感解释。

## 公开实现支持的内容

SOURCE_CONFIRMED / S1：作者裁剪高程数据并配合卫星影像；展示模型从上游导出后在网页加载。网页示例以 fov=30 和倾斜视点观察整个地形，在 useFrame 中对模型组的 Y 轴每帧增加 0.005。自动旋转改变模型组变换，没有在这个回调中重建地形；OrbitControls 由另一个按钮启用。上游 plot_3d 使用 fov=0，不能把这个相机设定混同于网页相机。作者明确区分网页效果与上游更复杂的照明。

SOURCE_CONFIRMED / S2：原作者教程使用30米 SRTM 与卫星数据，经过坐标变换、共同裁剪、矩阵方向处理和颜色范围处理再组合。该教程的 Zion 示例明确使用二倍垂直夸张。它使用绕景相机序列生成旋转展示。这些事实不证明 S1 的最终模型具有相同采样、夸张、面数或运行性能。

SOURCE_CONFIRMED / S3：高度、表面着色、zscale、观察方位、俯仰、FOV 和 zoom 是不同输入。zscale 有单位比例含义，不能作为不受约束的造型滑块。

SOURCE_CONFIRMED / S4-S6：ray_shade 检查到光源的遮挡路径，默认还包含 Lambert 项；ambient_shade 使用多个方位与仰角估计遮蔽；sphere_shade 依赖表面法线进行方向性配色。官方库提供这些方法，不等于 S1 的实时网页执行了全部方法。

SOURCE_CONFIRMED / S7-S8：OrbitControls 管理绕目标观察、平移和双指缩放，并支持以 deltaTime 消除自动旋转对帧率的依赖。PerspectiveCamera 的 fov 为垂直视场，aspect 参与投影，改变属性后需更新投影矩阵。

SOURCE_CONFIRMED / S9：手册将实时位移的轮廓职责与法线的高频表面职责分开。此处只采纳职责分离，不引入贴图工作流，不将显著洞口或悬挑变成法线替身。

## 独立转译：从可见信息的组织理解完成度

HYPOTHESIS：参考案例的整体完成感来自多种空间线索共同成立。尚未进行变量消融实验，不能为各项贡献给出百分比，也不能断言存在一个独特的神奇算法。

### 1. 连续结构层级

INDEPENDENT_DESIGN：先保障主山脊、分支山脊、谷地、坡折和局部表面之间的连续关系。宏观、中观、微观使用不同尺度，但共享同一套地貌身份与上游驱动。绑定真实 DEM 时不移动原峰谷；独立研究样板的程序结构不得伪装成测量结果。

### 2. 地表信息与形体配准

INDEPENDENT_DESIGN：学习 S1-S2 中高程与地表信息对应同一位置的思想。我们的覆盖权重由数值岩性、坡度、暴露、土层、水分及生物适生等可信输入控制。没有过程求解时保留代理字段标签。相同地点的几何、颜色、粗糙度和湿润响应共享身份，各自保留独立的尺度和响应函数，避免同一噪波直接复制到所有通道。

### 3. 中尺度明暗可读性

INDEPENDENT_DESIGN：让山脊、凹谷和坡折具有可辨识的受光差异，保留开阔面的明度和凹部的深度。太阳可见度、入射角和环境可达度分开；明暗不烘入矿物固有色。不得用雾、过曝、黑洞或满屏高频噪点代替缺失结构。

### 4. 观察尺度与细节职责

INDEPENDENT_DESIGN：总览先检查地貌骨架、覆盖斑块和沟谷组织；接近后检查岩壁转折、孔洞和表面变化。这里的观察尺度用于质量分析，不能触发删面、降精度、替换代理、重建几何或改变物理特征尺度。观感细腻不能替代源数据精度和近景几何合格。

透视投影的独立小范围估算：p_px ≈ H_px * size_perpendicular / (2 * distance * tan(fov_y/2))。size_perpendicular 是相对视线的特征尺度，distance 是相机空间深度，近似仅用于分析。正交投影使用 p_px = H_px * size_perpendicular / frustum_height。此关系未出现在 S1 中，不是源作者公布的优化算法。

### 5. 旋转中的空间稳定

INDEPENDENT_DESIGN：同一片坡面在各角度保持同一位置、地貌身份和材料历史。改变观察位置只改变投影、遮挡和视角相关的反射。地质字段固定于规范地理或物体坐标，不由屏幕坐标随机重算。S1 的模型组旋转可作为展示思路；我们的正式场景优先固定地形和环境、绕目标移动相机，使实际世界中的光源与地貌关系保持明确。

独立时间合同：theta(t)=theta0+omega*(t-t0)。omega 单位为弧度/秒。不能直接采用每帧固定增加角度的方式作为跨设备速度标准。进入手势操作或后台时暂停自动巡览，不擅自自动恢复。

### 6. 整体构图与手机

INDEPENDENT_DESIGN：画面适配应基于场景边界、视场、纵横比和控件遮挡区，保持主山体完整入画。围绕稳定中心旋转，限制俯仰穿地和突然跳焦。相机适配只改变观察参数，不缩放真实高程或重塑山体。

手机总览与近景共用同一三维资产。未来可提供可暂停的缓慢巡览，保留单指旋转、双指缩放与复位；这些是待实现合同。本轮没有改 UI 或生成新页面。

## 函数接口草案

所有接口均为 INDEPENDENT_DESIGN；状态为 specified_not_implemented。

scene_structure(domain, authoritative_or_authored_shape, semantics) -> structureHierarchy, validity
surface_alignment(structureHierarchy, coordinateContract, processFields) -> stableSurfaceIdentity, materialWeights
relief_readability(geometry, normals, sun, sky) -> directVisibility, diffuseAccessibility, diagnosticFields
observation_scale(view, declaredPhysicalFeatures) -> projectedFeatureFootprints
framing_envelope(sceneBounds, viewport, safeArea, projection) -> viewTarget, cameraDistance, clippingLimits
inspection_orbit(timeSeconds, angularVelocity, gestureState, framing) -> cameraPose
rotation_consistency(surfaceIds, cameraSequence, renderEvidence) -> correspondenceAndStabilityReport

observation_scale 与 rotation_consistency 是分析与验收接口，不得驱动几何精度降档。数据、形成状态、材料状态、照明与观察保持分层。

## 与函数世界方法论连接

世界观合同沿用初始条件、形成历史、环境历史、相互作用、材料与结构规律、确定性变化、边界约束共同定义当前状态。长尺度变化组织整体，中尺度变化服从地貌关系，短尺度变化表达局部材料经历。它们是受成因约束的函数及波形表达，不能仅凭波形叠加宣布得到真实地质过程。

大场景展示增加观察函数：当前地貌状态与当前观察状态共同决定可见结果。观察移动期间，地貌状态和材料历史默认冻结。研究能力可跨区域复用，地质参数与真值绑定必须分区域说明。

## 验收设计与当前状态

未来对同一资产、同一精度进行轮廓、分区、明暗、组合结果的消融对比。固定完整环绕和数个近景检查：山脊连续性、地表对位、暗部可读性、空间锚定、旋转闪烁、跳变、轮廓缺陷和手机布局。颜色像素比例与面数不能单独证明高完成度。

本轮只有资料重读、逻辑提炼、研究文件归档。没有执行参考场景或测量其性能；没有生成影像、模型或新工作台；没有修改线上入口、真值数据、受保护核心或其他生产线。visualApproved=false；productionReady=false。
