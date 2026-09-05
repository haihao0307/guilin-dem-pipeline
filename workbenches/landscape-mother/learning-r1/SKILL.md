---
name: landscape-shape-scale-and-field-context
description: 小王的地形主形、尺度、字段上下文学习回执与有限实验设计；不构成几何实现或视觉批准。
---

# Landscape Mother 学习接收 R1

日期：2026-09-05。mother_id：landscape。执行会话自报：LANDSCAPE-XIAOWANG-R1-20260905-SOURCE-READBACK。本标识只识别本次答卷，不证明任何其他会话已执行。
轮次：XIAOMA-LEARNING-R1-20260905。

## 一、实际基线与状态

仓库：haihao0307/guilin-dem-pipeline。
工作分支：feature/landscape-mother-field-graph-v002。
开始阅读及写入前核对的生产 HEAD：3110fbaedb5ba65ca5d8ed6c88830653e63acefe。
全量交接：handoff/landscape-mother-full-20260904-v2.0.0，读取提交 75bbe164bc8a22e2834d196dbd5f782cc63e2320。
小妈教材：handoff/xiaoma-mentor-v1.1-20260905，核对 HEAD 4d779a7bc64883ab720941a03f6c078fe9ae2e15。R1 文件先按分支读取，再核对该 HEAD；共同交接按此 SHA 读取。

最新场景候选 V016-HERO-R1 已被用户否决。V014 R3 是历史技术基线，其视觉同样未通过。最后人工接受的场景版本：本轮证据未确认，不将 V014 或 V016 填作已接受。
本次仅新增本文，不修改运行时代码、七文件核心、源数据、旧交接、其他生产线或公开入口。

状态：资料阅读有下述定位；源码静态诊断已记录；技能卡和实验设计已提交；小妈理解复核 not_run；原生软件操作 not_run；单元测试本轮重跑 not_run；新几何实验 not_run；浏览器验证 not_run；跨对象复用 not_run；用户采用决定 pending。visualApproved、visualAcceptance、productionReady 均保持 false。

## 二、实际阅读定位与覆盖边界

生产提交 3110fba：根 AGENTS.md；landscape-mother 下 AGENTS.md、SKILL.md、platform.json、SOURCES.json、src/policy.js、tests/policy.test.cjs、tools/validate.py。

交接提交 75bbe164，目录 handoffs/landscape-mother/Xiaowang_Landscape_Mother_Full_Handoff_2026-09-04_v2.0.0/：START_HERE.md、FULL_HANDOFF.md、CURRENT_STATE.json、DECISIONS_AND_NONNEGOTIABLES.md、VISUAL_FAILURE_REGISTER.md、KNOWLEDGE 下三份合同、NEXT_TASK.md，以及 SOURCE_SNAPSHOT/V016_REJECTED_RUNTIME/app.js。长源码按区段补读了 makeTowerGeometry、addCave、makeGround、场景规格、相机、材质控制和循环。

小妈目录 docs/mother_coordination/mentor-v1.1/：README.md、MOTHER_STARTUP.md、REVIEW_DISPOSITION.md、RECIPIENTS.md，以及 full-handoff-v1.1.1/source/Mother_System_Xiaoma_Full_Handoff_V1.1.1_2026-09-05/sources/mentor_v1_1/00_小妈先读.md。

小妈目录 docs/mother_coordination/learning-r1-20260905/：START_HERE.md、SKILL_INDEX.md、ASSIGNMENTS.md，及 terrain-process、procedural-geometry、geometry-context、realtime-world 四张 skills/*/SKILL.md。已读本仓库 Issue #61 的通知与 R1 分层作业要求。

覆盖限制：没有逐一复读所有历史版本、完整压缩载荷、导师全部详细分册或四套软件完整手册；没有本轮重新验证原件 ZIP 的全部校验项。教材中的既有研究结论保留其原始证据范围。KNOWLEDGE 所述桂林论文缺失续页不补写。具体实测峰脚、洞腔和原始照片尚未在本轮取得可执行绑定。

## 三、R1-A：已有错误、解释与边界

### 具体错误及代码定位

目标沿用 NEXT_TASK.md：重建三至五峰的小型葡萄乡峰林彩色三维样板，先控制一座主要峰体的大形。

V016 app.js 的 makeTowerGeometry 对各峰套用相同分段 profile，以角度和 radiusX/radiusZ 生成截面，末端汇到单一 apex。ledge 项含沿高度重复的正弦。这个共同构造与用户记录的重复柱体、尖嘴和环纹相符。此判断来自静态代码与已记录的用户否决，本轮未重新渲染。

addCave 使用两个 CircleGeometry 和一个 TorusGeometry。makeTowerGeometry 只作径向凹陷，索引仍连续封闭，没有为洞口切开并连接内部腔体。加深圆片颜色无法建立洞腔。

碎石源码实际使用 DodecahedronGeometry(s,1)，不能把用户描述的球形观感误写成调用了 SphereGeometry。它仍缺少来自母岩断裂面的生成关系。

### 两处阅读如何改变执行

FULL_HANDOFF.md 的“禁止继续的路线”和“正确的重建顺序”要求保留 V016 为失败对照，另建峰体骨架与不规则峰脚；禁止在旧形体上继续加色、加洞和加面板。

小妈 terrain-process/SKILL.md 的“有限步骤”和“试验设计”要求冻结物理尺度、相机、灯光和种子，保留无新增侵蚀对照；宏观形态未建立时不引入大堆侵蚀细节。

小妈 procedural-geometry/SKILL.md 的属性与依赖方法用于区分几何、材料、显示；geometry-context/SKILL.md 用于明确字段在变形前后及何种属性域求值。

### 竞争解释与区分检查

H1：共同径向 profile、单尖顶和全局环纹限制了形态表达。
H2：照明、材质和镜头强化了塑料观感，部分问题属于展示偏差。

检查设计：固定同一版本、单位、几何、六个相机及视场角，分别查看中性灰模、纯轮廓、法线和当前彩色显示。H1 预测统一尖顶与环纹在轮廓、截面和背面仍存在；H2 预测主要差异在明暗和材料，几何读回不变。两种原因可以同时成立；单独换光照不能记为形体修复。此检查尚未运行。

### 四种证据状态

资料已读：固定提交、文件、小节和本线解释。方法已实现：实际新增的构造函数、数值字段、依赖和可重建输入。结果已验证：真实运行的固定条件对照、几何检查、浏览器记录和失败项。用户已接受：用户针对该具体版本明确批准。本文只完成第一类及设计记录。

### 三组保护边界

1. 七文件核心、区域 canonical、高程、AOI、CRS、transform、NoData 和来源哈希保持原样；禁止旧 Qingjiang、30 米替代、合成填洞和手工河流。
2. 零贴图、零 LOD、纯数值、固定几何继续有效；材质种子、相机和设备不改山体。软件支持某功能不产生本线使用许可。
3. 当前分支与旧版本保留；不合并协调分支、不改其他 Mother、不发布未通过主画面审查的入口、不代签用户批准。导师建议冲突时登记冲突并保留当前有效规则。

## 四、R1-B：主形、尺度与字段上下文技能卡

### 原始来源与读取程度

Gaea 2 / Erosion2，Parameters 与 Selective Processing：https://docs.gaea.app/reference/nodes/simulate/erosion2 。英文正文已读。保留 Duration、Downcutting、Erosion Scale、Seed、沉积类型和方向降水的原术语；这些参数到地质过程的映射仍需项目证据。旧 Erosion 1.3 不混用。

Houdini 文档页标签 22.0 / Geometry attributes、Volumes：
https://www.sidefx.com/docs/houdini/model/attributes.html
https://www.sidefx.com/docs/houdini/model/volumes.html
已读属性域、id、rest，以及标量、速度和距离场相关正文。稳定 id 与可变化的元素序号分开，空间场必须有单位与含义。

Blender / Fields：https://docs.blender.org/manual/en/latest/modeling/geometry_nodes/fields.html 。官方英文搜索结果中的 Input Nodes、Field Context 已读；直接打开返回 402。只采纳已读上下文说明，不声称完整手册直读或原生节点测试。实例知识本轮另有小妈技能卡依据，相关官方实例页未全文核验。

Unreal Engine / PCG Overview，Important Concepts and Terms、Attributes and Metadata、Metadata Domains：https://dev.epicgames.com/documentation/en-us/unreal-engine/procedural-content-generation-overview 。英文正文已读。学习带属性点和空间筛选，不将 HLOD、外部模型或纹理路线引入本线。

实际安装的软件版本全部 unknown；本轮未启动上述软件。软件文档页版本不构成环境升级证明。

### 通用输入、输出和假设

输入：隔离的非 canonical 样本，稳定 peak_id，来源/假设标签，不规则峰脚、独立侧向剖面和破碎冠部参数，模型单位米，固定生成版本与几何种子。环境数据另列材质种子与采样坐标。不能把假设尺寸记作已测量。

输出：可检查侧面、背面和底部的固定几何缓冲区；独立材料属性与来源标签；固定视角对照及错误记录。洞穴以后接入显式有厚度内壁或体积场转网格，不用单值高度面或黑色贴片冒充洞腔。

坐标与属性域：实验拟采用局部米制坐标、Y 向上，与现有网页一致；这是实验约定，不代表其他引擎的默认坐标。形体字段在几何构造阶段求值；材质绑定 rest/local position，天气输入使用明确转换后的世界坐标。peak_id 为对象域，顶点字段在几何完成后重新求值；拓扑变更不能直接套用旧点序号。

核心依赖：生成输入决定形体；形体、形成历史和环境共同决定材料；相机只决定投影与视角相关表现。只改当前湿度时允许颜色、粗糙度和高光响应变化，几何与长期水痕历史保持不变。

### 有限步骤及实现位置

计划实现位置：后续独立工作台样本，沿现有工作分支；不修改七文件核心。此处尚无新构造函数。

1. 保留 V016 原始失败样本。先核对一座主峰的形态参照与尺度依据；尚缺的测量保留 unknown。
2. 固定一组相机、种子、范围和中性光，记录无新增侵蚀的对照。
3. 新建不规则峰脚、独立剖面及破碎冠部骨架，仅替换一座峰的大形。禁用宏观未过关时的微噪声堆叠。
4. 在新骨架中一次改变一个结构参数，例如固定峰脚和高度，仅改崩口深度；观察预测的局部冠部差异及未受影响部位。
5. 主形通过后再分次添加有限裂隙、凹壁、崩塌面和有厚度洞腔。沉积、溶蚀、水路字段分别命名，不互当真实河道或随意颜色。
6. 材料单独比较；固定六视角检查后扩展到三至五座独立峰，保留一座未参与调参的峰作为复用检查。

### 改变前提的追问

问题：把整个样本水平尺寸放大两倍，保留高度与原数值参数，会怎样？
回答：宽高比改变，坡壁可能变缓；按米定义的沟宽若不变，其相对尺度会减半。按归一化坐标定义的纹理或噪声也可能随对象变大。必须分别声明希望保持物理米制尺寸还是归一化形态，重新核查参数单位与采样间距，不能沿用一套未注明单位的数字。该预测尚待有限实验验证。

另一追问：把 field 从变形前移到变形后求值为什么会变？位置和法线输入已经改变；需要固定形成身份的字段保留 rest 坐标或已捕获属性，需要反映当前几何的字段重新求值。两者用途分开。

### 反例、失效条件和验证

反例：丰富噪声加在共同尖顶柱体上；圆片黑洞没有内壁；米厘米混用；current position 错当 rest；材质种子触发重新生成；以 Gaea wear/flow 输出代替实测河网。

失效条件：正确参照缺失却声称复刻；单位或字段域不明；宏观仍像柱体；几何不能表达悬挑；新参数带来穿透、退化面或接缝；手机与桌面精度不同；预算不足却自动降档。

计划验证：前后六视角同相机；轮廓、剖面、底面和洞口内壁检查；固定输入重复生成；单独改材质时顶点与索引不变；相机与设备变化不改变几何；分辨率研究只在离线有限实验中保持同物理范围，不构成运行 LOD；检查受保护数据未改。核心 policy.test 的模拟观测不充作真实浏览器帧。

成本：原生软件、网格生成、内存、浏览器 FPS 均未实测。后续记录冷生成耗时、峰值内存、顶点/三角面数和桌面/390×844 浏览器运行成本；这些数字只解释工程成本，不替代视觉验收。

## 五、来源冲突与下一步

Gaea Erosion2 页末 Slope/Altitude 两条描述疑似互换，与小妈记录一致；保留冲突，不自行交换参数，不将这两条用于生产。官方性能宣传不记作本项目测量。

本线下一步为主峰几何有限实验，然后扩展三至五峰；交付仍为可交互彩色三维 HTML。资料归档不记作主画面改善，不扩张 UI、不重发旧 V016。理解复核、实际实现、浏览器与用户批准分开推进。
