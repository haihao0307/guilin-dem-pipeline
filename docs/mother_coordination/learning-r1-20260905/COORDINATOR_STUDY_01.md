# 小妈学习体系职责与自学记录 01

日期：2026-09-05。记录类型：coordinator_study_and_review。原交接包、生产代码和各线人工批准状态保持。

## 用户本轮确定的工作方式

用户已向其他 Mother 传达学习要求，并反馈其中部分已接收。小妈负责整体学习体系：自主选择公共问题、查核来源、提炼技能、向各 Mother 分层分配、核查理解与真实结果、组织有依据的同学互学、把发现和分歧带回与用户讨论。

每次实际接续时，优先读取新增回执和未解问题。没有更高优先级的新任务时，以一项跨线反复问题作为自学起点；允许提出与用户原判断不同的有依据意见。产出至少包含一个可核对的新发现、其适用边界和下一项区分实验。不能把积累链接数量当作学习收益，也不要求先建庞大平台。

选题依据：错误反复出现程度、正确参照可取得性、能否区分解释、跨线价值及验证成本。先从小问题产出，再决定是否拓展。正式工具或资产准入、真实 DEM 路线、权威资产与人工验收规则不由自学自动改变。

持续工作的实际边界：这些是后续接续时的默认工作规则。当前没有创建定时任务、后台轮询或其他会话启动器，不能声称会在无执行回合时自动学习或监控。用户说部分已收到，登记为 user_reported_partial_receipt；具体 Mother 的仓库答卷仍按原始回执逐项核查。

## 本轮已观察到的进展

本轮读取了 guilin-dem-pipeline #61、#62，HOUSE #16，AIRCRAFT #15，Humanoid-Rig-Lab-Next #1，Three.js #2 的现有评论。

HOUSE #16 出现两个有具体内容的执行者回执，其他上述区本次读取时尚未发现新增的独立答卷。此结论仅覆盖这些收件区，不能推断其他聊天没有接收、阅读或工作；用户提到的七位未据现有资料强行对应到名单。

Tiles 原始答卷：https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5550670993 。已读 c715ad31948d71b662c60eefa02126973d794fb6 下 tiles-mother/knowledge/xiaoma-learning-r1/SKILL.md 及其来源范围记录。它有工作基线、竞争解释、输入输出、反例、接触与显示分检、状态分离等具体内容。核心区分的书面解释符合本轮要求；未独立验证几何、接触容差或浏览器。

Tiles 状态：written_response_received；core_distinctions_sufficient；technical_followup_pending；production_adoption_not_granted。小妈已发坐标归属、实例隔离与接触失效的追问：https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5550735319 。这些是分项初审，不是整张技能卡已验证通过。

House / 小李原始回执：https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5550687909 。已读 701a2d28d75e40a948cc984a8a6d4e2f829255e1 下 architecture-workbench/yunnan-master-village/experiments/material-coordinates-v0151/knowledge/SKILL.md 与 qa/SUMMARY.json。报告记录16项轴向候选修改、41项未定、23/23项相关检查通过、946条构件图保持。报告明确 physical_mobile_tested=false、public_site_deployed=false，不能据移动视口通过声称真机或公开发布通过。

House 状态：implementation_and_QA_report_received；core_distinctions_sufficient；independent_reproduction_pending。小妈本次没有独立重跑其代码、浏览器、图像或几何测试。追问已发：https://github.com/haihao0307/HOUSE/issues/16#issuecomment-5550736548 ，要求变换反例及几何、矩阵、碰撞数据保持范围。实际生产采用和用户视觉批准均未新增。

两人已互相收到对方技能卡的固定入口，但尚无独立互审回执，peer_review 保持 not_run。没有向已回复者继续发送同一轮泛化催办。

## 自学问题：材料和环境究竟使用哪个坐标？

问题来自两条真实回执：Tiles 将几何、UV、接触和材质分开；House 对箱形木件采用局部轴候选，同时保留未知项。小妈选择补学坐标语义与属性优先级，检验能否提炼成共用检查方法。

本轮来源为官方英文资料，内容读取范围如下。

S1 SideFX，Copying and instancing point attributes：
https://www.sidefx.com/docs/houdini/copy/instanceattrs.html
实际读取 Attributes、Priorities 与运动模糊正文。页面标签 Houdini 22.0，只作来源定位。该复制语境中 transform、orient、N/up 等具有明确优先关系；同名的方向数据不能无条件叠加。这里的 N 在缺少 orient 时参与拷贝轴向定义，不能把这项语境规则泛化为所有着色法线含义。

S2 Blender 4.2 LTS，Texture Coordinate Node：
https://docs.blender.org/manual/en/4.2/render/shader_nodes/input/texture_coordinate.html
本轮读取官方搜索索引中的 Outputs 原文片段，直接打开页面返回402，全文直读未完成。该片段区分 Generated、Normal、UV、Object、Camera、Window 等坐标来源，Generated 使用未变形网格包围范围归一化。不能据这个片段宣称掌握实例、变形、绑定或导出全过程。

S3 Epic，Coordinates Material Expressions：
https://dev.epicgames.com/documentation/en-us/unreal-engine/coordinates-material-expressions-in-unreal-engine
实际读取英文正文中 ActorPositionWS、ObjectOrientation、ObjectPositionWS、TextureCoordinate 与 WorldPosition 等段落。页面区分位置、包围范围中心、方向和采样点位置；世界空间采样可使不同邻近网格的纹理连续。具体项目安装版本仍需本线回执。

## 提炼与待证假设

先声明效果希望附着在哪里，再决定使用的坐标、采样时刻和输入语义。构件自身的纹理、制造差异可以附着在局部静止坐标或明确 UV；瞬时环境输入可按世界位置与朝向采样；材料已经积累的湿度、损伤和维修历史还需要独立状态。最后一项属于小妈提出的系统设计假设，本次没有完成环境演化模型验证。

因此，共用的是区分这些语义和检查的方法。木材、陶瓦、地形、生物具有各自依据与参数，不能因为共用函数就让它们共享未经验证的参数。几何最长轴只能提供某些对象的候选方向，无法取代加工方向、材料组织和历史证据。

字段发生变化时，应先问这种变化是否符合任务目标。例如对象携带的纹理应随对象移动，世界固定场在不同位置的取样则可以变化。把一切移动后的变化都认定为bug，会错误否定合法的世界空间效果。

## 本轮实际完成的隔离数值试验

试验仅使用抽象长方体、64个固定种子的数值采样点和一个自定义标量函数，不加载任何生产资产，不生成视觉作品。

六个绕Z轴旋转角度0/15/45/90/135/180度，各结合两个平移向量，共12个刚体变换。将世界点正确变回局部坐标后，标量函数结果与原结果在1e-12阈值内全部一致，最大差异1.7763568394002505e-15。直接以世界坐标采样同一函数时，11个非恒等变换产生变化，这是这个世界附着函数的预期表现。

对同一尺寸为[2.0,0.1,0.4]米的抽象对象，世界AABB最长方向在0度为X，在90度为Y，局部语义轴并未因此改变。它提供了反例：世界包围盒最长方向不能直接替代局部材料身份。

可复现代码如下，依赖Python、NumPy。运行不写生产文件。

```python
import math
import numpy as np

rng = np.random.default_rng(20260905)
dims = np.array([2.0, 0.1, 0.4])
q = (rng.random((64, 3)) - 0.5) * dims

def f(p):
    return np.sin(12.3*p[:, 0] + 1.7*p[:, 1]) + 0.3*np.cos(5.2*p[:, 2])

reference = f(q)
errors, changes, axes = [], [], {}
for degree in (0, 15, 45, 90, 135, 180):
    a = math.radians(degree)
    R = np.array([[math.cos(a), -math.sin(a), 0],
                  [math.sin(a), math.cos(a), 0], [0, 0, 1]])
    axes[degree] = 'XYZ'[int(np.argmax(np.abs(R) @ dims))]
    for t in (np.zeros(3), np.array([0.37, -0.21, 0.13])):
        p = q @ R.T + t
        recovered = (p - t) @ R
        errors.append(float(np.max(np.abs(f(recovered) - reference))))
        changes.append(float(np.max(np.abs(f(p) - reference))))
if max(errors) >= 1e-12:
    raise AssertionError('Rigid-transform local field invariance failed')
print({'cases': len(errors), 'max_local_error': max(errors),
       'world_field_changed_cases': sum(v > 1e-12 for v in changes),
       'aabb_axes': axes})
```

本试验的1e-12为这个float64数值算例的比较阈值，不是施工、碰撞、渲染或跨硬件精度规范。没有测试变形、非均匀缩放、镜像、真实木材、风雨累积、跨引擎、网页帧率或各 Mother 的实际产品。不得用它升级任何生产批准。

## 下一项研究队列

将对象局部身份、世界环境采样、随时间积累的状态分开后，研究依赖失效：改材质何时只重算显示，改厚度何时必须重验接触，改变环境历史何时必须重算状态。下一次接续依据真实答卷和任务收益选其中一个，不把队列登记成已启动后台工作。
