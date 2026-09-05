---
name: landscape-representation-process-coordinate-deepening
description: Landscape Mother 的地形表示、侵蚀尺度、坐标和距离语义深读，带解析反例与可复现数值检查。
---

# 小王地形深读 01

2026-09-05。沿小妈 XIAOMA-LEARNING-R1-20260905 继续学习，未另立总控学习轮次。用户明确允许继续深入研究。本轮仅做资料核查、数学推导和隔离数值实验。

## 1. 来源与工作身份

仓库 haihao0307/guilin-dem-pipeline，实际工作分支 feature/landscape-mother-field-graph-v002。读取起点 5c01f0094a7dcb65ae1b472b62e098e2e52c39d0。

小妈新增材料读取到 da14fb018dd2f2eeebcf5586893dc8e08d9f1ec9：docs/mother_coordination/learning-r1-20260905/COORDINATOR_STUDY_01.md，经提交差异读取。另读 mentor-v1.1 完整包 sources/mentor_v1_1/details/05_CONTRACTS.md 全文，01_REVIEW.md 的第1节至第4.2节。后者余文本轮未全文复读。R1 四张初始技能卡与本线七文件规则沿用前轮实际读取范围。

V016 分析对象固定为 75bbe164bc8a22e2834d196dbd5f782cc63e2320 下 handoffs/landscape-mother/Xiaowang_Landscape_Mother_Full_Handoff_2026-09-04_v2.0.0/SOURCE_SNAPSHOT/V016_REJECTED_RUNTIME/app.js，重点为 makeTowerGeometry 的 ledge 表达式。保留旧失败样本，不修改其几何。

来源层保留软件原名、版本标签和章节；本线推导与测试分开标注。软件页面标签不能证明软件已安装。本环境 PATH 未找到 blender、hython、gaea、UnrealEditor，本轮没有启动这些软件。Blender 官方搜索正文可读，直接网页接口仍返回402；容器外部请求无法解析域名，未保存官方全文镜像。不能把搜索正文范围扩大成全部手册实操。

## 2. 外部原始来源

均为本轮实际打开的官方英文正文或明确标注的官方搜索正文，2026-09-05 查读。只摘取与问题相关的章节，没有将页面附带的全站节点索引计入已读知识。

S1 SideFX，Houdini文档标签22.0，Building terrain with height fields，Overview、Masks、Layer utilities：
https://www.sidefx.com/docs/houdini/model/heightfields.html

S2 SideFX，HeightField Erode 3.0，Since 21.0，概述、Solver/Erosion Feature Size、Spread Iterations、Erodability与输出层：
https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_erode.html

S3 SideFX，Volumes，体积类型和几何转换：
https://www.sidefx.com/docs/houdini/model/volumes.html

S4 SideFX，VDB from Polygons，Voxel Size、Distance VDB、World Space for Band、Unsigned Distance Field、Preserve Holes：
https://www.sidefx.com/docs/houdini/nodes/sop/vdbfrompolygons.html

S5 SideFX，VDB Combine，SDF操作、Activity操作、Resample：
https://www.sidefx.com/docs/houdini/nodes/sop/vdbcombine.html

S6 SideFX，VDB Renormalize SDF，概述及参数：
https://www.sidefx.com/docs/houdini/nodes/sop/vdbrenormalizesdf.html

S7 SideFX，Convert VDB，Adaptivity、属性转移与接缝组：
https://www.sidefx.com/docs/houdini/nodes/sop/convertvdb.html

S8 QuadSpinner，Gaea 2 / Erosion2 Reference，Properties：
https://docs.gaea.app/reference/nodes/simulate/erosion2

S9 QuadSpinner，Gaea 2 / Understanding Erosion / Erosion_2，Primary、Sedimentary、Shape、Orographic章节：
https://docs.gaea.app/using/using-gaea/understanding-erosion/erosion_2/

S10 Blender，Fields，官方搜索正文中的Input Nodes、Field Context与Capture说明，页面标签5.2 LTS：
https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/fields.html

S11 Blender 4.2 LTS，Capture Attribute，官方搜索正文中的几何输出、域与匿名属性说明：
https://docs.blender.org/manual/en/4.2/modeling/geometry_nodes/attribute/capture_attribute.html

S12 Epic，Coordinates Material Expressions，页面标签UE5.8，ActorPositionWS、ObjectPositionWS、ObjectOrientation、WorldPosition：
https://dev.epicgames.com/documentation/en-us/unreal-engine/coordinates-material-expressions-in-unreal-engine

S13 USGS原作者研究摘要，Swezey等，2017，Geologic controls on cave development in Burnsville Cove：
https://www.usgs.gov/publications/geologic-controls-cave-development-burnsville-cove-bath-and-highland-counties-virginia
仅使用摘要。该地个案支持节理、层面与褶皱可影响通道形态，不能把其尺寸、方位和岩层结论移植为葡萄乡事实。

S14 Acta Carsologica原始论文摘要，Dodge-Wan等，2017，Epiphreatic caves in Niah karst tower：
https://ojs.zrc-sazu.si/carsologica/article/view/4935
仅使用英文摘要。近地下水位洞穴与该研究区洪水、溶蚀观察不能给出葡萄乡的水位、年代和溶蚀速率。本轮未分析论文PDF。

## 3. 地貌表示：同一个高度不够承载洞腔

来源事实：S1的height field在每个水平格点保存高度值；S3、S4区分密度、带符号距离与无符号距离；S4明确体素尺寸会限制可保留的细小特征。

本线推导：单值 h(x,z) 无法同时给出同一水平位置的洞底、洞顶与山顶。提高水平分辨率不能消除这种表示限制。用解析球减圆柱检查，中心竖线得到四个边界交点；仅存顶面与底面会丢掉中间空腔。测试件为数学反例，不能作为喀斯特资产交付。

候选分工：平原地表可研究高度场；显著崖壁悬挑、岩桥与洞腔使用具有内外表面的实体网格，或离线体积构造后转固定网格。体积方法只是候选表示，不会自动带来正确峰形，也不授权导入外部模型、纹理或真实DEM改写。

S4的Preserve Holes依赖几何方向与内部判定，不能默认所有体素化都会保留封闭内洞。S5要求组合前检查栅格变换与窄带背景；Activity操作与几何布尔操作不同。S7的Adaptivity会改变多边形大小和数量，本线尚未采用；后续试验须明确固定采样与固定输出，不能相机或设备相关降档。

## 4. 零等值面正确，不保证数值就是米制距离

来源事实：S6专门提供距离重新规范化，并说明严重偏离时需重建。S5区分SDF操作与一般标量加减。

本线推导：F=0可界定一个表面，F的符号可描述内外，这两件事仍不足以证明abs(F)为最近表面距离。两个重叠单位球的min组合，在原点给出0.25，实际联合边界距离为0.6614378277661477。该反例只针对脚本中的直接min构造，未测试Houdini节点内部实现。

非均匀缩放后的 f(A^-1 p) 能保持正确零集，其梯度长度在三轴测试中分别约0.5、1、2。直接把字段值当洞壁厚度、接触间隙或光线步长存在风险。建议分别保存field_kind、单位、sign_convention及distance_validity；没有验证时写implicit_scalar，不能只靠字段名SDF取得距离许可。

## 5. 侵蚀尺度、主形与守恒

来源事实：S2的Erosion Feature Size以米为单位，最小值受三倍输入体素尺寸限制。S9区分下切、特征尺度、沉积类型与形状控制，并说明这些参数会相互影响。S2与S8描述水力或热侵蚀，相关文档未提供葡萄乡碳酸盐溶蚀模型或地质年标定。

本线推导：高程采样间距与目标沟宽必须同时声明。举例，目标2米特征在0.5、1、2米间距下，按S2公式分别为2、3、6米。这个计算只复述文档约束，未运行该求解器；不能推广为所有软件的通用三倍规则。

解析坡面 h(x)=x 在三个间距下都应得到导数1。忽略间距会误得0.5、1、2；水平放大两倍、保持高度时45度坡变为约26.565度。更密采样不能新增实测信息。

另一个反例是振幅仅0.02米、角频率100/米的正弦，最大导数达到2。限制高度扰动幅度仍不足以限制法线与坡度扰动。后续应分开记录位移幅度、梯度、采样带宽和影响区域。

掩膜也需要有明确作用位置。两单元搬运账本中，完整搬运1立方米保持总量；只给最终高度差加不对称掩膜，会凭空增减1立方米。它证明事后混合与求解中的过程约束不能直接等同。此例没有模拟流速、孔隙率、泥沙浓度或化学溶蚀，也没有证明厂商求解器不守恒。

地质方面仅提炼有限方法：洞穴不能任意散点贴黑，应核查裂隙、层理、水位和历史。S13与S14的个案提示不同控制可产生不同通道形态；具体葡萄乡参数仍需当地资料。

## 6. 追查Gaea的Slope / Altitude疑点

S8两条参数解释仍写成Slope对应高程范围、Altitude对应坡度范围。S9在Altitude and Slope小节合并说明两者控制Height与Slope范围，支持需要分开这两种量，但没有给出无歧义的逐控件绑定和单位。

因此，语义疑点得到进一步定位，控件级冲突尚未解决。本线只使用清楚命名的elevation_m与slope_angle_deg概念，暂不建立到这两个软件控件的映射；不默默对调原文、不伪称已修正软件问题。

## 7. 坐标：材料身份、环境采样与历史分开

来源事实：小妈COORDINATOR_STUDY_01区分局部身份、世界采样和累积状态；S10、S11说明field依赖几何上下文，Capture将当时值存入该几何流；S12区分对象位置、包围范围中心、方向与像素世界位置。

本轮复现小妈64点、12刚体变换算例，最大局部误差1.7763568394002505e-15。换预先固定的种子，加入缩放、非均匀缩放与镜像，共48个变换，最大误差3.0531133177191805e-15。世界附着函数随对象位置变化属于合法行为，分别有11和47个非恒等案例改变。

本线拟议接口：矿物微结构可绑定rest或局部参考坐标；跨峰层理需要共享的地质参考坐标和来源；瞬时风雨使用世界位置、世界法线和时间；已经积累的水痕、含水和损伤另存状态。这个分配是设计提议，未完成真实岩体验证。不能要求所有字段都随对象移动后数值不变。

非均匀缩放时法线应满足变换后仍与切向垂直。逆转置在实验中满足该关系，普通向量变换被反例捕获。镜像还需处理三角面绕序；把法线变正确不能独自保证面朝向正确。

字段上下文反例：按当前位置连续两次位移0.5倍位置，结果是初值2.25倍；每次读取已捕获初值，结果是2倍。两种结果各有用途，关键是事先声明求值时机。本轮未运行Blender原生节点。

## 8. V016新增静态诊断：角向接缝

旧ledge片段含sin(y*0.74+a*1.9+phase)与sin(y*1.57-a*3.2+phase)。角度从0到2pi后相位没有完成整数个周期。按旧参数seed=11，三个预定高度44、85、126米的端点差分别约0.00633225、0.00123222、0.00360254，均为无量纲乘数差。

这定位了一项函数连续性缺陷，可作为纵向接缝的竞争解释之一；还未通过V016浏览器隔离确认可见贡献。实验只检查这个片段，没有重建全部半径、噪声、材质或法线计算。

整数角频率是周期性有效对照，绝非新的峰体制作方案。旧旋转柱体语法依然被否决。新岩体应在自身三维参考域组织结构，不能把“补好接缝”解释为旧主形已经合格。

## 9. 实验、反例与结果范围

先写PLAN.md后执行study.py，RESULTS.json保存实际结果、环境、代码哈希与成本。26项数值检查全部满足预先给出的判据，包含故意错误实现被捕获的反例。

这些检查验证解析公式与本地实验实现，不是26项地貌验收。没有真实峰体生成、真实DEM读取、三维浏览器或手机测试，没有确认通用地貌真实性。新增采样种子只扩展数学算例覆盖，不能算跨生产对象复用。

运行方法：Python 3.10以上并安装NumPy后，在本目录运行 python study.py --output RESULTS.json。本轮环境为Python 3.13.5、NumPy 2.3.5。RESULTS记录的tracemalloc只覆盖Python可追踪分配，不是进程总内存或GPU成本。运行时间不是游戏帧率。

## 10. 上轮发布副作用与本轮隔离

本轮查到旧.github/workflows/landscape-mother-studio.yml的push范围包含workbenches/landscape-mother/**。上一轮5c01f009只新增学习文档，但确实触发Actions run 33956754504，Publish与公开验证步骤均success。gh-pages/landscape-mother-workbench/build.json回读version=B3.1、sourceCommit=5c01f009。

因此，上一轮“没有部署”的概括需要更正：没有主动修改运行源码，但旧自动流程重新发布了landscape-mother-workbench下的B3.1样本。publish.py的作用范围为该子目录，不是V016的landscape-mother路径。不能把这次自动发布算作新地形进步。

为避免再次触发，本轮新增文件改放handoffs/landscape-mother/learning-r1-deepening-01/，并对纯研究提交使用[skip ci]。没有修改工作流、保护核心、canonical、旧交接或公开页面。此标记只用于阻止研究提交触发push/pull_request流程，不代表CI通过，不绕过生产准入。GitHub官方说明见：
https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs

不自动回滚线上内容，避免覆盖可能存在的并行更新；保留可核查的副作用记录并通知小妈。后续生产恢复前需明确旧工作台与新峰林入口的发布范围。

## 11. 下一步仍待验证

候选方向：独立峰脚与断脊主形；有厚度且连通的洞腔；单位与全局参考域明确的结构场；几何、当前环境和长期状态分离。只在独立样本上逐项验证，主形不过关不叠加细节。

待做：真实参照绑定；原生软件控件级实验；复杂网格的体积转换与距离重建误差；物理侵蚀及水文校准；生产场景实现；六视角及390×844交互；跨对象复用；小妈理解复核；用户视觉接受。

visualApproved=false；visualAcceptance=false；productionReady=false。
