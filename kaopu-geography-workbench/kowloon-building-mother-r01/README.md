# 九龙建筑母体 · 第一条实际链路 R01

独立学习试验，保留旧的 hk-three-buildings-r01、香港主城 R01/R02/R03，以及其他项目。不是完整建筑 BIM、历史建筑复原或生产级建筑母体。

## 真正用到的原件

复用相邻 `hk-three-buildings-r01` 的三个既有 CSDI 配方、原始重建器与 Three.js，不用通用盒子替换。

| ID | 已知身份 | EPSG:2326 E,N | 转换后的纬度,经度 |
| --- | --- | --- | --- |
| B367642137201063C0 | 33 La Salle Road | 836766.125, 821374 | 22.331410706, 114.181709564 |
| B359971994401063C0 | 翼状高塔，名称/年代/用途未核 | 836004.8125, 819943.3125 | 22.318490810, 114.174319887 |
| B369121858401063C0 | 宽体斜屋面，名称/年代/用途未核 | 836896.75, 818601.75 | 22.306375596, 114.182976418 |

坐标来自源清单与 glTF 变换，使用系统 PROJ 将 EPSG:2326 转为 EPSG:4326。三点属于九龙；展示仍按原先的独立观察方式并排安排，不是地理摆放。原始锚点与 mPD 基准保留。半岛酒店的原件 ID、新旧楼边界尚未确认，未把其中任何一栋冒充半岛酒店。

原基线：[geometry/buildings.json](../hk-three-buildings-r01/geometry/buildings.json)，原实验的已测代码 `3988c42ac4ed8ab78e3c3d604bc6dd2791aa8146`。本试验依赖的源配方保持不变。

## 已实现的关系，而不是改名字

1. 三个外壳下的 225 个实测边界面有稳定身份、父装配 ID、几何与角色证据标记。全部默认重建顶点与法线逐值保留。墙/屋面角色仅由朝向推断，不冒充施工构件。
2. `visible` 只影响展示；`enabled` 影响装配输出和导出。省略表面会明确标记外壳不完整，不补假墙或假地基。宿主停用会抑制子件，不偷偷把它们挂到世界坐标。
3. 高塔的一个水平屋面与 20 个共同墙顶有可测的相等高度。修改共同顶高同步更新它们，保留脚线、平面轮廓和原配方。复杂屋顶与斜屋面没有这条简单证据，明确拒绝套用。
4. 对重建表面推导整段端点重合的边界关系。此关系只证明数值接触，不证明承重、支撑或完整连接；T 接与部分重合未全面求解。
5. 高塔 p003 上有一扇默认关闭的“设计窗”试验：墙上实际开洞 → 固定实体框 → 简化铰链 → 可动实体扇框 → 随动玻璃。宽、高、窗台高、开角、玻璃色由参数驱动。不是贴一块彩色矩形，也不是该建筑真实门窗的推断。
6. 高塔设计楼层独立生成真实有厚度楼板，沿实测翼状凹轮廓而不是外包矩形。默认设计层间距 3.2 m、板厚 0.2 m 产生 21 块楼板；每块真切出 2 × 2 m 预留贯通井洞。层、板、每板自己的洞、跨层预留体有独立 ID，FFL/SSL 分开记录（本轮简化相等）。所有内构仍是可编辑假设，不是源数据发现的楼层。
7. 砖、抹灰和混凝土直接复用相邻案例的原始材质母体与接收器；不复制新的装饰纹理，不开启旧接收器的假窗图案。楼板使用同一混凝土函数；玻璃独立控制色、透射和粗糙度。
8. 整体位移通过父组传播一次，几何与真实地理锚点不被烘焙改写。

## 窗的边界

- 所有窗参数都是创作设计，不是测量、香港历史窗样或产品规格。启用需要主动选择，原外壳默认不切洞。
- 首条链路只做单扇外开；洞口宽限制在 0.4–0.7 m 的保守试验范围。更宽的窗应先建立真实分格/多扇关系，而不是把巨幅窗作为一片旋转。
- 简单转轴不是香港常见摩擦铰链/四连杆五金的机械仿真。开启扫掠包络只用于观察，不代表完整碰撞、逃生、风荷载或法规验收。
- 玻璃使用物理材质的透射与吸收色。外观参数是视觉预设，不是实际产品光学检测数据。
- 原源墙是零厚度外表面。窗框具有设计厚度，但没有据此虚构真实墙厚、内墙或室内。
- 未实现推拉轨道、窗花、把手/锁/螺钉、门、实际楼梯/电梯、房间布局、结构、完整碰撞与批量布窗。下一步应逐件建立关系，不靠贴图或装饰掩盖缺失。
- 类型逻辑见 `design-context.json`：具体建筑证据优先，其次用户设计选择，再次拟议类型默认。用途未知不会自动变为住宅或酒店。酒店有保安并非“所有酒店绝无窗花”的普遍规则，公共入口/客房门/服务门也不混用尺寸。

## 学习来源与原创实现

本目录的关系和运动代码独立编写，未复制、移植、捆绑 FreeCAD 或 IfcOpenShell 代码。参考它们的文档和概念不等于集成了它们的完整功能。

- [IfcOpenShell add_feature：宿主与开洞](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/feature/add_feature/index.html)
- [add_filling：开洞与填充件](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/feature/add_filling/index.html)
- [空间容纳与装配分解不同](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/spatial/assign_container/index.html)
- [显式子件变换传播](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/geometry/edit_object_placement/index.html)
- [IfcOpenShell 窗框、扇与玻璃表示](https://docs.ifcopenshell.org/autoapi/ifcopenshell/api/geometry/add_window_representation/index.html)：PanelOperation 当前并不实现开窗运动，不能误认作现成动画算法。
- [FreeCAD ArchWindow](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/BIM/ArchWindow.py)：独立宿主、减法体、hinge/track 和组件。该文件为 LGPL-2.1-or-later。
- [FreeCAD ArchStairs](https://github.com/FreeCAD/FreeCAD/blob/main/src/Mod/BIM/ArchStairs.py)：生成依赖与显示传播分离。本轮不声称已做楼梯。
- [HOUSE 的计划优先流程](https://github.com/haihao0307/HOUSE/blob/main/yunnan-courtyard-architecture-factory-v5.2.1-full-local/yunnan-courtyard-architecture-factory-v5.2.1-full-local/data/core/plan_first_pipeline_v5_2_1.json)：宿主、开洞、框、扇、枢轴和净空链路；目录记录不等于全部实现。
- [香港屋宇署 APP-116](https://www.bd.gov.hk/doc/en/resources/codes-and-references/practice-notes-and-circular-letters/pnap/signed/APP116se.pdf)、[房委会窗与窗花设计](https://www.housingauthority.gov.hk/mini-site/site-safety/pictorial-guide-to-planning-and-design-for-safety/en/2_detailed_design.html)。只用于理解具体构造约束，不作本试验的合规背书。

源几何权利归香港特别行政区政府地政总署 / CSDI 及相关机构，遵循 [CSDI 条款](https://portal.csdi.gov.hk/csdi-webpage/doc/TNC)。详细源归属见相邻案例的 [LICENSE_SCOPE.md](../hk-three-buildings-r01/LICENSE_SCOPE.md)。Three.js/OrbitControls 使用相邻案例保留的 MIT 许可。本轮未发布照片、受限素材、外来网格或老师源代码。

## 设计楼板的边界

- 21 是当前参数产生的设计板数，不是测量层数。楼板全局默认关闭；剖看按钮只隐藏外壳显示，未删除它的装配。
- 本轮只对通过严格平面/共同墙顶检测的塔楼采用同一竖向轮廓。复杂低层与斜屋顶案例保留原始形状，不强行生成假内构。
- 预留井洞的中心 (0,0)、尺寸 2 × 2 m 为明确创作选择，已经通过凹多边形内含检查；不是源模型已有电梯井。保留洞不等于已做电梯、楼梯或防火疏散。
- 楼板可逐块设置显示和装配状态（模块 API），界面先开放整体启用、层间距、板厚和剖视。顶端按屋顶限界截断，不穿出源屋面。
- 不生成基础。外壳是否有真实地面/承台支持仍未知，接口保留，不以楼板或展示网格冒充地基。

## 验证与运行

从包含相邻基线的仓库根目录起 HTTP 服务，打开本目录。运行 `node --test tests/*.test.mjs`。浏览器脚本 `tests/browser.py` 使用已安装 Chromium/Playwright，读取真实 WebGL 并保存截图；脚本存在不等于通过。最终状态和准确覆盖见 `evidence/validation.json`，未测项目不得宣称完成。

回滚：仅移除本独立目录及其新增发布提交，不改动旧案例、旧锚点或其他目录。无强推、无历史改写。
