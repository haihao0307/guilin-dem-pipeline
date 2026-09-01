# Mother 统一世界演化与生产方法论 V1.0.0

日期：2026-09-01  
文件用途：跨对话、跨 Mother、跨实现工具的共同规范与交接依据。  
适用范围：Landscape Mother、Brick Mother、Tiles Mother、Weather Mother、Cloud Mother、Ocean Mother，以及后续采用同一方法的数字资产生产线。  
文件状态：第一版规范候选，等待用户审阅；配套 JSON 已完成本地结构校验。各仓库运行时接入、公开部署与视觉验收均未由本文件自动完成。

> 万物都在随时间演化。我们看到的形态，是形成条件、环境作用、相互关系与历史过程共同留下的当前状态。噪波提供受约束的变化，函数组织变化，演化留下痕迹。

本文把用户与助手讨论的方向整理为生产规范。本文中的治理规则、流程、接口、灯光建议和验收要求属于本项目的方法设计。外部技术事实在相应段落标明来源。参数示例均不得被解读为已经标定的自然定律。

## 1. 共同世界观与边界

一个对象需要作为完整系统理解。它有整体形态、内部结构、材料组成、表面状态、所处环境、形成过程和后续经历。材质负责其中一部分；整个 Mother 的任务范围应覆盖被授权领域内的完整对象及其关系。

我们可以把一座山、一块瓦、一辆车或一团云看成演化过程在某个时刻的状态。观察窗口长短会影响哪些变化容易被看见。生产中因此需要同时记录空间尺度与时间尺度，允许检查当前状态，也允许按明确模型查看前后状态。

这里保留一个科学边界：运动、漂移、侵蚀、扩散、断裂与波动各有自己的数学描述。把时间快放，不能单凭画面外观就证明这些过程属于同一种波。噪波函数可以用于感知建模；Ken Perlin 对这一点的论述讨论的是可观察信号的感知模拟，并没有证明物质由噪波函数组成。[S1]

本体系采用的工程立场是：以可解释的状态和过程描述对象，以受约束的随机变化表达不均匀性。已知机制、近似模型、艺术化示意和未知因素必须分别标记。未知成因可以暂时保留，禁止为每个细节编造确定的物理解释。

稳定的是共同原则。具体模型、参数和实现可以在证据支持下改进。更新共同原则必须经过明确审批和版本迁移，任何 Mother 都不得在局部任务中悄悄更换上层路线。

## 2. 一个对象的统一定义

本规范把对象的完整状态记为 `S(t)`。其内容可以包括几何与拓扑、材料分区、密度、含水状态、损伤、温度、速度、组成关系、事件记录和其他领域所需的变量。不同 Mother 使用不同的状态集合，禁止强行用一张高度图表示一切。

统一表达如下：

```text
S(t) = Evolve(
  initialState,
  formationHistory,
  environmentHistory,
  interactionHistory,
  materialAndStructuralLaws,
  deterministicVariation,
  boundaryConditions,
  constraints,
  modelVersions,
  t
)

image(t) = Render(
  S(t),
  camera,
  lightingPreset,
  colorPipeline,
  rendererVersion
)
```

`Evolve` 是接口名称。它可以由解析函数、逐步求解器、事件系统或经过校验的代理模型实现，不代表已经存在一个能够计算全部世界的单一公式。

对象来源和展示设置分开管理。灯光变化不得回写几何和材料源参数。修改湿度、损伤或结构时，应沿声明过的依赖关系更新受影响输出。转动展示灯只能改变观察结果。

每次生成均保留可复现身份：`motherId`、`entityId`、`profileVersion`、`generatorVersion`、`masterSeed`、初始条件、事件历史、时间、求解设置、来源锁与有效参数。

## 3. 先建立因果关系，再安排细节

每个主要可见变化都应有可检查的来源。可以来自材料组成、制造过程、结构边界、环境作用、接触磨耗或明确声明的艺术控制。人工设计、制造和维护也是有效的过程输入，不能被归入无方向的自然随机变化。

以受雨淋的对象为例，本体系建议先计算或近似表达降雨、遮挡、表面方向与排水路径，再得到湿润区域、干燥过程和相关残留。颜色、粗糙度和局部损伤从这些共享状态读取信息。具体反应强弱由材料模型决定，相关性需要标定，不能预设所有材料受水后都发生相同变化。

```text
环境输入与物体关系
  → 驱动场与边界条件
  → 过程状态
  → 形态、结构及材料变化
  → 表面光学响应
  → 展示与验证
```

“共享原因”也需要明确边界。同一受潮状态可以驱动多个输出，各输出仍可采用不同的响应函数。禁止把同一张噪波原样复制到颜色、法线、粗糙度、裂缝和几何位移中，然后将全部通道同图案视为因果一致。

每个过程算子至少声明：输入、输出、单位、适用尺度、更新规则、边界条件、近似程度、校准状态和失效条件。涉及物质交换时记录收支；存在源项、汇项或开放边界时同时记录它们。守恒检查只对适用的模型提出，豁免必须给出理由。

## 4. 形态、结构与材质协同生成

形态负责外轮廓、尺寸、曲率、体积与整体比例。结构负责连接、层次、孔洞、裂隙、纤维、分区、承载或其他内部组织关系。材料负责组成及其响应。表面负责当前可见的细微起伏、颜色与光学参数。四者存在依赖关系，并应按实际需要共享状态。

例如瓦片的弧度和厚度应由瓦型与成型规则控制；裂缝与缺口应有位置、方向、边界和深度；局部夹杂、烧成差异和风化状态影响相关的表面输出。几何孔洞必须有几何或明确的体积表示。颜色中的黑点只能证明存在深色像素。

遇到轮廓、遮挡、厚度、悬沿、深孔、空间缝隙等要求时，必须选择能够表达该特征的表示方式。高度场、实体网格、曲线、实例、体积场和有符号距离场各自有适用边界。深凹和悬沿不能仅凭法线效果宣告完成。

Mother 的母体应保存生成知识、参数域和可复现规则。孩子保存实例身份和自己的历史。修改一个孩子的局部损伤，不得无意改变其他孩子，也不得改写家族默认值。

## 5. 噪波的统一使用规范

噪波承担受约束的不均匀性和变化来源。使用前先说明它控制的物理量或视觉变量，以及允许影响的对象层级。不得只写“加噪波增强真实感”。

所有场至少标明：数值含义、单位、坐标空间、空间尺度、时间相关性、数值范围、来源与不确定性。静态场可以将时间相关性标记为静态。没有实际物理单位的控制量，应明确标为无量纲或展示单位。

宏观层控制缓慢分区与整体趋势，中观层控制可辨识的主要特征，微观层控制局部颗粒和细小粗糙。三层的尺寸应结合对象实际尺度定义，禁止只用含义不明的频率数字。高频细节需要采样和性能预算，防止出现统一撒点、屏幕闪烁、规则条纹与全表面颗粒化。

种子按稳定对象身份和过程命名空间派生。必须记录主种子、层名、派生算法与版本。不要让随机数调用顺序决定资产身份。新增一个效果层，不应使既有层的随机序列全部变化。

```text
processSeed = StableHash(
  masterSeed,
  entityId,
  processId,
  seedDerivationVersion
)
```

不同过程使用隔离的随机流；需要因果关联时共享相应状态。禁止每帧重新随机种子。空间场应在世界坐标或明确的对象坐标中稳定存在，跨瓦片边界的坐标、采样方式和接缝处理必须一致。

相同结果的条件包括相同输入、算法版本、种子、历史、步长及求解设置。CPU 数据可按适用条件做精确比较；跨 GPU 的浮点图像采用明确的误差容限，禁止无证据宣称所有设备逐位一致。

## 6. 时间是状态演化的输入

必须分开三个概念：`physicalTime` 表示过程时间，`solverStep` 表示数值求解步长，`displayTime` 表示界面播放时间。播放速度用于选择如何观察过程，不得静默改变物理参数和随机过程。

年龄不能孤立地决定旧化程度。相同年龄的对象可以具有不同的暴露、维护、使用和损伤历史。需要计算真实时间意义的结果时，应有速率或历史标定；没有标定的“十年”“百年”演示须标注为示意年龄。

可采用累积状态表达经历，例如：

```text
exposureDose(t) = integral from 0 to t of exposureRate(S(tau), E(tau)) d(tau)
```

此式只表达累计过程。具体暴露量、单位、材料响应和非线性关系需要对应的领域定义。多个事件的顺序可能影响结果，不能假设所有算子任意交换顺序后仍得到同一对象。

损伤等不可逆状态需要持久保存。湿润后干燥可以改变含水状态，不能顺带修复既有裂缝。确实存在维修、再生或其他恢复机制时，应作为独立过程声明。时间回退通过初始状态重放或版本化检查点恢复，禁止简单将不可逆求解器的步长取负。

“全动态”表示状态具有明确演化能力。实现允许快过程高频更新、慢过程低频更新、事件触发更新和缓存读取。无需每一渲染帧重算完整形成史。各快慢过程必须保持明确的同步关系。

## 7. Landscape Mother 的专门边界

真实地形先锁定权威 DEM 的来源、字节数、SHA256、坐标参考、水平单位、垂直单位、原生间距及缺失范围。已有项目冻结规则持续有效，本规范不授权覆盖、删除或替换旧资产。

实测源、推导结果、程序化近景细节与纯展示效果分别管理。受保护的源节点、峰谷位置、高程基准及真实河道关系继续遵守项目现行约束。细分网格可以改善显示与表示能力，不能据此宣称获得了新的实测精度。数据间距必须从元数据读取，禁止混用米与厘米。

小王负责的 Landscape Mother 应沿现行桂林 DEM 生产线继续，不得以统一规范为由跳转其他 PR、旧版或其他地形线。开始实际任务前重新读取该线最新交接包与远端状态。

涉及百万年地貌演化的探索，应在独立的研究状态层或独立场景中进行。现代实测地形继续保存为观测真值。研究结果必须标明模拟起点、过程参数和假设，禁止回填成观测数据。

山、坡面、沟渠、稻田与河面之间需要关系约束。稻田可由适宜区域、人工整形规则、田埂、灌排与土地使用历史共同定义。河网来源与连通规则先行，水面效果跟随被授权的水域。欠缺数据时显示阻断或缺口，不得用随意河线、合成填洞或漂亮水面隐藏问题。

## 8. 从 Substance 3D Designer 蒸馏方法

Adobe 官方将 Designer 定义为利用节点图、程序化图案和噪波制作材质的工具，也支持位图处理。[S2] 我们学习其可组合图结构、参数化控制与复用方式。是否允许使用外部位图、SBSAR 或烘焙缓存，继续由各生产线已有规则决定。

第一类知识是可复用算子。把一个复杂任务拆成输入、处理、输出明确的小模块，再组成子图。Adobe 对子图与发布的说明强调可复用资源及输入、输出、暴露参数的接口作用。[S3] 本体系可将同一思想用于形态、结构、环境与过程模块，具体物理规则仍需各领域自行定义。

第二类知识是参数设计。面向用户提供有意义的控制，例如孔洞尺度、成型差异、层理方向、暴露程度和含水状态。内部节点保留实现参数。Adobe 的暴露参数机制支持将节点参数组织为外部可操作界面，并提供默认值、范围与分组。[S4] 本体系还要求这些参数的单位、依赖与有效范围进入机器可读契约。

第三类知识是受方向控制的空间变形。Directional Warp 根据强度图沿指定方向扭曲输入。[S5] 我们将其蒸馏为“方向场与幅度场共同控制扰动”的算子思路。它适合辅助表达有方向的变化，但不能直接视为侵蚀、应力或流体求解器。

第四类知识是继承与隔离。Designer 图中可以继承分辨率、精度、平铺和随机种子等基础参数。[S3] Mother 需要显式声明继承关系，避免某一材质家族的当前界面控制覆盖其他家族默认值。

第五类知识是共享基础场与分层诊断。一个形成过程可输出几何影响、分区、掩码和光学响应。共享基础场有助于组织关系；它们之间是否真的满足目标因果模型，必须通过本项目的测试确认。

每项教程知识都经过同一条蒸馏路径：记录来源与适用条件，解释原理，制作最小复现，将原理改写为通用算子，制作本领域适配器，生成对照证据，记录限制，再申请纳入生产线。看过教程只能记录为已阅读。

## 9. Brick Mother 知识交换的当前证据

本轮通过 GitHub 连接器读取了 `haihao0307/HOUSE` 的 PR #15 元数据。读取时 PR 为 open、Draft、未合并，实际 `head_sha` 为 `b25508b8b57d45f9333286ab7b883644181039e7`，分支为 `feature/brick-mother-v2.0-composite-material-dna`。[R1]

PR 正文仍围绕较早的 `54f9ae9f43c078522ac6e082c4a857e57b06fae2` 描述证据。正文列出的家族默认值隔离、多层 seed、裂缝与孔洞关联、纤维与拉脱槽关联、几何命中与视觉验收分开等内容，可以作为待核验知识线索。不得把正文中的旧 head 测试直接赋予本轮读取到的新 head。

本轮没有完成该 PR 最新代码、工作流和浏览器画面的完整审计，也没有核验到一份可确认已接入的独立 Substance 蒸馏文档。因此，本文件不宣告 Brick Mother 已经完成本规范接入或已经通过视觉验收。

不同对话之间的知识交换以文件和回执为准。接收方记录读到的规范版本、文件哈希、仓库分支、实现位置、测试结果与待解决项。没有回执时，只能记为“已交付资料”，不能记为“已同步执行”。本轮没有向任何仓库推送文件。

## 10. 统一展示与灯光体系

展示是正式生产环节。用户应能看清整体形态、结构层次、表面细节与颜色变化，同时获得质量稳定的美观展示。灯光系统单独版本化，并与对象源数据解耦。

Epic 的 MetaHuman 文档提供内置与自定义灯光场景及渲染质量设置，并通过统一旋转控制组织灯光。[S6] Unreal Engine 还支持物理照明单位与曝光控制。[S7][S8] 本规范据此吸收可复用灯光场景、独立控制和可重复观察的思路；以下具体预设属于我们的设计，未复制官方默认灯光。

### 10.1 中性检查模式

用于判断形态、颜色、材质与结构问题。锁定白平衡、曝光、色彩变换、相机与背景。自动曝光关闭，避免对照过程中画面亮度自行补偿。关闭美化滤镜，采用清楚、不过度戏剧化的照明。

A/B 比较必须固定对象状态、种子、历史、时间、灯光与取景，除了本次明确测试的变量。曝光、材质与灯光不得同时自由变化后再归因于某一个改动。

### 10.2 工作室展示模式

以主光、辅光、轮廓光作为基本角色。主光交代主要体积，辅光控制暗部可读性，轮廓光帮助辨识边界。每盏灯可独立开关、调整方向、强度、颜色或色温，以及适用时的光源尺寸和阴影软硬。可以增加顶光、背景光或经过授权的环境照明，灯数依对象与任务确定。

建议的起始设计是：主光从前侧上方入射，辅光来自另一侧，轮廓光来自侧后方。角度和亮度关系只作为可调整的初始预设。暖主光、偏冷辅光或轮廓光可以作为审美对照，不能固定用于全部对象。

色温控件在支持时使用 Kelvin；同时记录渲染器的转换算法与版本。仅用色温控件不得宣告已实现跨光源的光谱级一致。灯强度需要写明单位；不同灯类型的强度值不能直接横向相除。跨引擎对齐应使用测量或校准对象，不以相同滑杆值宣称相同照明。

展示模式允许调整氛围，但禁止回写基础颜色以掩盖照明问题，禁止通过重阴影藏缺陷，禁止靠高光过曝、强锐化、强景深或后期效果代替几何改进。漂亮展示图不能单独作为验收依据。

### 10.3 诊断模式

按任务提供纯色几何、线框、法线、深度、分层掩码、因果场或局部剖面。使用斜向照明检查孔沿、层理、裂缝与纤维。诊断模式帮助回答“到底生成了什么”，不得只输出难以辨认且没有图例的暗色图。

### 10.4 环境模式与网页工作台

在需要时提供符合应用场景的室外、室内、海岸或其他环境预设。对象灯光检查与真实环境联动分开切换。太阳、天光、云和水反射等跨模块输入通过接口交换，不能被局部工作台私自重定义。

网页应具有固定视角、自由旋转、缩放、复位、特写、中性与展示切换、灯光旋转、色温与强度控制、种子切换、时间控制和有效参数导出。仅显示当前对象已实现的控制。界面不应遮挡关键画面，也不得将无作用的滑杆伪装成完成的功能。

公开入口必须实际检查页面、关键资源与浏览器错误，记录构建身份。交付说明同时记录真实渲染像素尺寸和后处理放大尺寸。禁止将放大图声称为同尺寸的原生渲染。

## 11. 所有 Mother 的统一生产步骤

先读取最新交接包、仓库状态和领域约束。确认任务所属生产线、当前分支与允许写入范围，保存基线。再读取本规范与 JSON 规则，核对版本与哈希。缺失关键输入或存在规则冲突时，先记录阻断，禁止静默回退。

随后定义对象身份、真实尺度、初始状态和证据来源；建立结构与形成逻辑；定义环境、过程与事件历史；按因果关系组织变化；派生形态、结构、材料与表面输出；在中性、展示和诊断模式下检查；完成自动测试和真实浏览器证据；最后由用户作视觉批准。

每轮只处理明确的问题集合。新知识先进入可回退的候选，不得在学习过程中自动改写冻结资产、生产默认值或其他 Mother。

共享的是规范、接口、算子方法与证据格式。领域模型继续独立。Landscape Mother 处理地形关系，Brick 与 Tiles Mother 处理对应构件，Weather Mother 提供天气输入，Cloud 与 Ocean Mother 处理各自状态。依赖关系可以双向耦合，但必须声明交换量、单位、更新频率、所有权与冲突规则。

在线作品是后续视觉交付的主要入口。本次交付的是用户明确要求的规范文件，不代表已经制作或发布新的在线作品。

## 12. JSON 硬性控制的层次

本版附带规则 JSON、严格 Schema 和可运行的 Python 校验脚本。Schema 对本版本的固定值使用 `const`，对对象关闭未知字段，并要求关键字段存在。[S9][S10] 这可用于阻止规则文件被悄悄删项、改值或插入未授权开关。

为了避免把 Schema 改宽后照样通过，脚本固定校验 Schema 的 SHA256。代码仓库还必须保护校验脚本与调用入口；具有修改全部文件权限的程序仍可能删除整个检查流程，因此不能把单个 JSON 或单个哈希描述为完整的权限安全边界。

真正接入需要三个层次共同存在：文档明确原则；JSON 与 Schema 固定机器规则；运行时、测试和发布入口读取规则并拒绝违规操作。本轮已交付前两类规范和配置校验工具，第三层仍需各 Mother 在其授权仓库内实现与验证。

运行时必须验证语义和实际产物。例如“源数据不可变”要比较实际源哈希；“灯光不改几何”要比较灯光切换前后的数据；“种子可复现”要重跑生成器；“未经用户不得批准”要核对实际批准记录。不能通过填写 `true` 就替代这些检查。

领域参数放在独立 Profile 中，经独立 Schema 校验，禁止把任意字段混进共同规则。运行时合成有效配置后再次校验，并将配置哈希写入产物。版本不匹配、未知参数、越界参数、缺少必需证据或试图覆盖核心规则时，阻断相应生成、导出或发布操作。

允许保留清楚标注的研究预览。视觉验收所需证据缺失时，预览页面可以展示，但不得宣告合格或进入生产批准状态。

### 12.1 本版本规则 JSON

以下内容与配套 `MOTHER_UNIFIED_POLICY_V1.0.0.json` 完全一致。复制整份 MD 的接收方可以将这一代码块保存为该文件。

```json
{
  "policyId": "MOTHER_UNIFIED_EVOLUTION_POLICY",
  "version": "1.0.0",
  "policyState": "candidate_for_user_review",
  "authority": {
    "coreChangeRequiresUserApproval": true,
    "localProfileMayOverrideCore": false,
    "unknownKeys": "reject",
    "ruleConflict": "block_and_report",
    "repositoryReadBeforeWrite": true,
    "repositoryWriteScope": "explicit_task_allowlist",
    "crossMotherWriteWithoutAuthorization": false,
    "knowledgeSync": "versioned_files_with_adoption_receipts"
  },
  "worldModel": {
    "scope": [
      "shape",
      "structure",
      "material",
      "surface",
      "environment",
      "history",
      "presentation"
    ],
    "objectIsTimeIndexedState": true,
    "causalModelRequired": true,
    "allChangeMustBeModeledAsWave": false,
    "noiseMayReplaceAllDynamics": false,
    "physicalClaimsRequireEvidence": true,
    "unresolvedCausesMustBeLabeled": true
  },
  "causality": {
    "initialStateRequired": true,
    "driverHistoryRequired": true,
    "boundaryConditionsRequired": true,
    "effectToCauseLinksRequired": true,
    "sharedCauseStateAcrossOutputs": true,
    "fieldMetadataRequired": [
      "quantity",
      "unit",
      "coordinateSpace",
      "spatialScale",
      "temporalCorrelation",
      "bounds",
      "source",
      "uncertainty"
    ],
    "processMetadataRequired": [
      "inputs",
      "outputs",
      "units",
      "validScale",
      "updateRule",
      "boundaryConditions",
      "calibrationStatus"
    ],
    "conservationChecks": "required_where_applicable_with_reasoned_exemptions"
  },
  "time": {
    "distinctClocks": [
      "physicalTime",
      "solverStep",
      "displayTime"
    ],
    "playbackSpeedMayChangePhysics": false,
    "ageRequiresHistoryEvaluation": true,
    "rewindRequiresReplayOrCheckpoint": true,
    "irreversibleDamageMayResetByDrying": false,
    "uncalibratedAgingLabel": "illustrative_not_calibrated",
    "solveFullHistoryEveryRenderFrame": false
  },
  "noise": {
    "masterSeedRequired": true,
    "stableEntityAndProcessNamespaces": true,
    "hashPrngAndGeneratorVersionsRequired": true,
    "independentRandomStreamsPerProcess": true,
    "reseedingEveryFrame": false,
    "noiseMayOverrideMeasuredTruth": false,
    "sharedCoordinatesAtTileBoundaries": true,
    "spatialAndTemporalFrequencyBudgetsRequired": true,
    "reproducibility": "same_inputs_versions_history_and_solver_settings",
    "crossGpuBitwiseIdentityAssumed": false
  },
  "truth": {
    "measuredSourceImmutable": true,
    "sourceIdentityAndUnitsRequired": true,
    "inventMissingMeasuredData": false,
    "syntheticDetailMustBeLabeled": true,
    "measuredAndGeneratedLayersSeparate": true,
    "subdivisionMayClaimNewMeasuredResolution": false,
    "domainFrozenConstraintsRemainBinding": true,
    "externalAssetsRequireExplicitDomainAuthorization": true,
    "sourceFilesMayBeDeletedByThisPolicy": false
  },
  "domains": {
    "sharedInterfacesNotSharedDomainPhysics": true,
    "familyDefaultsMustRemainIsolated": true,
    "explicitUnitConversionsRequired": true,
    "crossDomainSourceOverwrite": false,
    "proceduralSourceRemainsAuthoritative": true,
    "derivedCachesRequireVersionAndHash": true,
    "rendererAdapterMustDeclareCapabilities": true,
    "unsupportedCapability": "block_or_explicitly_labeled_preview"
  },
  "presentation": {
    "requiredModes": [
      "neutral_inspection",
      "studio_beauty",
      "diagnostic"
    ],
    "contextModeWhenApplicable": true,
    "studioLightRoles": [
      "key",
      "fill",
      "rim"
    ],
    "keyFillRimControlsIndependent": true,
    "lightTemperatureKelvinWhenSupported": true,
    "lightUnitAndColorConversionMustBeDeclared": true,
    "neutralInspection": {
      "autoExposure": false,
      "fixedWhiteBalance": true,
      "fixedToneMapping": true,
      "fixedComparisonCamera": true,
      "beautificationFilters": false
    },
    "beautyMayModifyGeometryOrMaterialSource": false,
    "beautyAloneMayPassAcceptance": false,
    "renderSettingsAndNativePixelSizeRequired": true,
    "imageUpscalingMayClaimNativeResolution": false,
    "onlineViewerRequiresRealAccessCheck": true,
    "runtimeAndDeploymentHeadMustBeReported": true
  },
  "knowledge": {
    "sourceProvenanceRequired": true,
    "mechanismAndLimitationsRequired": true,
    "minimalReproductionBeforeAdoption": true,
    "distilledOperatorRequiresVersionAndTests": true,
    "tutorialAppearanceEqualsValidation": false,
    "documentReadEqualsRuntimeIntegration": false,
    "chatPromiseEqualsCrossWindowSync": false,
    "substanceNodeMethodMayOverrideDomainTruth": false
  },
  "validation": {
    "loadPolicyBeforeGenerationParameterMutationExportAndRelease": true,
    "schemaValidationRequired": true,
    "runtimeSemanticTestsRequired": true,
    "missingRequiredEvidence": "block_acceptance",
    "skippedEqualsPassed": false,
    "previewAllowedWhenAcceptanceBlocked": true,
    "previewMustShowBlockedStatus": true,
    "requiredEvidence": [
      "source_identity",
      "effective_parameters",
      "seed_lineage",
      "causal_outputs",
      "time_history",
      "neutral_view",
      "beauty_view",
      "diagnostic_view",
      "browser_log",
      "build_identity"
    ],
    "automatedPassEqualsVisualApproval": false
  },
  "approvals": {
    "defaultVisualApproved": false,
    "defaultProductionApproved": false,
    "assistantMaySelfGrantHumanApproval": false,
    "approvalRequiresUserRecordAndExactBuild": true,
    "materialChangesInvalidateAffectedApproval": true
  },
  "adoption": {
    "requiredReceipt": [
      "motherId",
      "repository",
      "branch",
      "commit",
      "policyVersion",
      "policySha256",
      "schemaSha256",
      "validatorSha256",
      "runtimeEntryPoints",
      "tests",
      "evidence",
      "unresolvedItems"
    ],
    "claimIntegratedWithoutReceipt": false,
    "existingApprovedAssetsMayBeRegeneratedAutomatically": false,
    "coreVersionMismatch": "block_and_report"
  }
}
```

### 12.2 校验命令与通过含义

四个文件放在同一目录：本 MD、规则 JSON、Schema 与 `validate_mother_policy.py`。脚本要求 Python 3.10 或更高版本，并使用 `jsonschema` 的 Draft 2020-12 校验器。各仓库应把依赖锁定进自身环境；下列安装范围用于首次运行。

```sh
python -m pip install "jsonschema>=4.18,<5"
python validate_mother_policy.py --self-test --report POLICY_VALIDATION_REPORT.json
```

成功状态为 `POLICY_DOCUMENT_VALID`。该状态只说明配置文档符合本版本规则。它不说明生成器已读取规则，不说明物理过程正确，不说明网页已经发布，也不构成人工视觉批准。

本轮本地结果：28 项检查全部通过，其中包含标准规则通过、20 类保护值修改拒绝、未知字段拒绝、必需字段缺失拒绝、错误类型拒绝、重复 JSON 键拒绝与非有限值拒绝。完整结果保存在 `POLICY_VALIDATION_REPORT.json`。

JSON、Schema 与脚本的版本和哈希见同目录校验报告。校验报告生成后应随产物保存；正式接入时还需要目标仓库自己的执行日志和提交身份。

## 13. 运行时与视觉验收清单

配置检查之外，每条生产线至少安排以下验证组合，并按领域删减不适用项，同时说明理由。

因果检查：关闭一个原因后，检查变化是否沿声明的因果关系传递，并记录非线性或反馈造成的预期结果；环境不变时，切换展示灯光不改变对象源状态；家族参数修改不能串到其他家族。

时间检查：同一历史重放得到可比较结果；快慢播放的相同物理时刻一致；不同帧率不产生不同旧化结果；检查点恢复可复现；不可逆状态不会被无关参数复位。

空间与结构检查：源真值保持；边界衔接稳定；尺寸和单位正确；孔洞、裂缝、遮挡及结构连接有对应产物；高频细节在声明的视距与分辨率下没有明显闪烁。

展示检查：相同对象具有中性、工作室和诊断证据；必要时增加环境证据；显示源 head、构建身份、种子、时间与灯光预设；浏览器控制台和资源加载真实记录；移动端作为独立目标验证，不用桌面平均值代替。

视觉判断分别检查形态、结构、材质、关系和展示。自动 QA、参考相似性、视觉批准和生产批准单独记录。任何 `skipped`、`pending` 或缺失都不得被汇总为通过。人工批准需要用户记录，并绑定精确构建；影响相关结果的修改应使对应批准失效。

## 14. 给其他 Mother 与 Codex 的接入指令

请先完整阅读本文件与配套 JSON，不要立即大范围修改代码。重新读取你负责生产线的最新交接包、仓库规则、分支及远端 HEAD，列出本次授权范围。保持现有真值源、冻结资产和人工批准状态，禁止跨线改写。

把共同规则与领域参数分开保存。将版本和哈希加入本线构建清单，在生成入口、参数更新入口、导出入口和发布入口接入校验。对未实现的规则逐项列为未接入，禁止仅凭保存文件宣告完成。

先做一个最小对象闭环：对象身份与真实尺度、一个明确环境驱动、一个有历史状态的过程、至少两类由同一原因关联的输出，以及中性、工作室和诊断展示。该对象不要求覆盖所有自然过程，也不得为了赶闭环恢复已撤回路线。

生成当前 head 的配置、运行时和浏览器证据，提交一份接入回执。回执必须包含：Mother 名称、仓库、分支、提交、规则版本与哈希、Schema 与脚本哈希、实际调用入口、测试结果、证据路径和未完成项。保持 `visualApproved=false` 与 `productionApproved=false`，直到出现满足各自规则的用户批准记录。

只在用户授权范围内正常提交；不得强推、改写历史、擅自合并、修改受保护分支或改写其他生产线。本规范不提供隐含的仓库写入许可。

## 15. 本次实际交付状态

```json
{
  "methodologyDocumentCreated": true,
  "policyJsonCreated": true,
  "strictSchemaCreated": true,
  "configurationValidatorCreated": true,
  "localConfigurationTestsPassed": 28,
  "localConfigurationTestsTotal": 28,
  "repositoryRuntimeIntegrationVerified": false,
  "githubWritePerformed": false,
  "publicViewerCreated": false,
  "browserQaPerformed": false,
  "otherMotherAdoptionConfirmed": false,
  "methodologyHumanReviewComplete": false,
  "visualApproved": false,
  "productionApproved": false
}
```

本轮没有写入长期记忆，跨窗口请以这些实际文件为准。需要保存长期记忆时，请在新对话中提出。独立窗口能够读取本文件后，仍需用接入回执证明它具体执行了哪些内容。

## 16. 来源与适用说明

以下网页在本轮核对。引用只支持对应的技术事实；本项目的共同世界观、治理规则和接入设计由本次讨论整理形成。来源保留英文原始页面。

[S1] Ken Perlin, Philosophy of noise, 2011-08-18。支持噪波感知建模的边界说明。  
https://blog.kenperlin.com/?p=7006

[S2] Adobe, Substance 3D Designer user guide。支持节点图、程序化图案、噪波和位图处理的功能概述。  
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/home

[S3] Adobe, Substance graph key concepts。支持子图、输入输出、参数继承与外部控制接口的说明。  
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/substance-compositing-graph-key-concepts

[S4] Adobe, Exposing a parameter。支持参数暴露、分组、默认值和范围的说明。  
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/manage-parameters/exposing-a-parameter

[S5] Adobe, Directional warp。支持强度图与指定方向共同控制扭曲的说明。  
https://experienceleague.adobe.com/en/docs/substance-3d-designer/using/substance-graphs/nodes-reference-for-substance-graphs/atomic-nodes/directional-warp

[S6] Epic Games, Custom Lighting Scenarios and Render Settings。支持 MetaHuman 自定义灯光场景、渲染配置与灯光旋转组织的说明。该页面所述扩展功能注明 UE 5.8 或更高版本，本规范不要求其他渲染器具有同一 API。  
https://dev.epicgames.com/documentation/metahuman/metahuman-custom-lighting-scenarios-and-render-settings-in-unreal-engine?lang=en-US

[S7] Epic Games, Using Physical Lighting Units in Unreal Engine。支持照明单位与曝光度量的说明。  
https://dev.epicgames.com/documentation/unreal-engine/using-physical-lighting-units-in-unreal-engine?lang=en-US

[S8] Epic Games, Auto Exposure in Unreal Engine。支持曝光控制的功能说明；锁定中性检查曝光属于本规范的验收设计。  
https://dev.epicgames.com/documentation/unreal-engine/auto-exposure-in-unreal-engine?lang=en-US

[S9] JSON Schema, Validation, Draft 2020-12。支持 required、type 与 const 等配置校验关键字。  
https://json-schema.org/draft/2020-12/json-schema-validation

[S10] JSON Schema, Core, Draft 2020-12。支持 additionalProperties 等对象结构规则。  
https://json-schema.org/draft/2020-12/json-schema-core

[R1] 用户仓库 `haihao0307/HOUSE`，PR #15，本轮 GitHub 连接器元数据快照。实际 head 与正文引用的历史 head 分开记录，本文件不把 PR 自述视作最新实现的独立验收。  
https://github.com/haihao0307/HOUSE/pull/15

## 17. 最终共同原则

> 先定义对象和真实约束，再定义原因、关系与历史。让受约束的变化进入完整状态，让形态、结构和材质从同一过程产生，让展示清楚呈现结果，让证据决定能否通过。
>
> 母体保存可解释的生成知识，孩子保存自己的身份与经历。知识可以持续蒸馏，核心原则通过版本控制保持连续。
