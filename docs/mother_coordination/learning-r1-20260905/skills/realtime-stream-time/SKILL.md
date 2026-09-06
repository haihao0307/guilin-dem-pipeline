---
name: realtime-stream-time
description: 从TouchDesigner官方文档与社区排错中提炼时间、事件、GPU数据流和观察开销的检查方法。
---

# 小妈自学05：TouchDesigner实时数据流与时间语义

日期：2026-09-06。用户提供TouchDesigner介绍、官方论坛和文档首页，其中介绍链接重复一次。状态：下列指定原文已读取，自写CPU算例已执行；TouchDesigner实操、GPU验证、产品接入均未完成。只新增小妈知识，不改生产源码、资产、真值、其他分支或人工接受状态。

## 来源登记及实际读取范围

S1 https://derivative.ca/UserGuide/TouchDesigner
读取产品介绍及Architecture Principles。官方将其定位为节点式实时交互2D/3D应用环境，每个节点可观察中间输出。本轮不研究人员头衔、发展史或市场排名。

S2 https://derivative.ca/UserGuide/Main_Page
用户提供的 https://docs.derivative.ca/Main_Page 本轮返回403，改读同厂商UserGuide入口正文。读取What’s New、POPs、教程、文档、示例、论坛导航。本次页面显示Official Build 2025.33230，日期2026-09-01；这只是当次页面标识，实际安装环境unknown。官方/实验构建、操作系统和GPU兼容性仍需在实际采用时核查，不从目录声称所有功能均已验证。

S3 https://derivative.ca/UserGuide/Operator_Family
读取七类操作器：TOP图像、CHOP数值通道、POP点/几何/GPU数据、DAT文本/表格/脚本、MAT材质、SOP传统几何、COMP组件与层级。类型转换和引用关系需显式声明；不能把同一数组的数值相似视为语义相同。

S4 https://derivative.ca/UserGuide/Cook
读取Cooking Mechanism、Order、Event-Driven、Forced Cooking。一般节点需要计算请求及计算原因，采用按需求拉取方式；预览窗口也能发起请求，某些输出和渲染节点有特殊规则。不把关闭预览等同于整个系统停止。

S5 https://derivative.ca/UserGuide/Time_Slicing
读取定义、区间示例和限制。CHOP时间片覆盖上一次与本次计算之间的一段样本；仅部分CHOP具有相应能力。文档也列出最大时间片偏好，所见页面写200毫秒，实际配置需要核实，不能推定任意时长卡顿都被完整处理。

S6 https://derivative.ca/UserGuide/Time_Slice_CHOP
读取Summary、Hold/Linear/Trim方法。输入如果只在显示时采样，Linear会在已知样本间插值。本轮推论：未被任何输入端记录的短脉冲，无法仅由两端零值重建；插值平滑与保全真实事件需要分别检查。

S7 https://derivative.ca/UserGuide/Learning_About_POPs
实际深入读取POPs简介、GPU-resident computing、CPU/GPU拓扑信息与内存、Instancing vs Copying及相关检索段落，未通读全部示例。POP在GPU侧处理几何及属性。某些CPU读取会引起同步等待，异步读取可引入一帧延迟；未知输出规模还可能需要预分配额外内存。因此GPU标签不能独自证明本项目更快或更省内存。

S8 https://derivative.ca/UserGuide/POP_to_CHOP
读取转换摘要、Download Type及命名/类型说明。文档提供Immediate和Next frame选项；转换后的数据时间与类型也应保留。本轮没有测试这些选项的实际速度或延迟。

S9 https://forum.derivative.ca/
读取General、POPs、Techniques、Bugs、Hardware等目录。本次仅深入S10的一条排错，未下载或运行社区.toe/.tox文件。该论坛登记为既有每3天社区巡查周期中的补充来源，采用原SELF_LEARNING_PROTOCOL的到期检查规则；没有新建后台定时任务。

S10 https://forum.derivative.ca/t/performance-issue-with-simple-pop-setup/951255
完整读取2026-02-09的讨论。用户报告预览开关影响性能，官方回复说明当时Math Combine POP的Scope B不断变化可导致着色器每帧重编译，建议通过Uniforms页传数值。本条是具体日期和语境的历史案例，不能据此断言2026-09-06当前构建仍有同一问题，也不照搬帖子帧率作为自己的测试成绩。

S11 https://derivative.ca/UserGuide/Math_Combine_POP
核对Summary、Scope属性/常数、Uniforms入口。学习重点是将结构性代码与高频变化的参数区分；哪些修改触发实际编译，应以目标运行时的计数和日志验证。

S12 https://derivative.ca/UserGuide/Feedback_TOP
读取Summary及Reset控制。图像反馈可形成残影等效果。图像残留、粒子状态、环境历史和真实物理分别定义，不能凭残影宣称存在真实湿度、碰撞或材料损伤模型。

## 与现有学习线的关系

ShaderGPT提供着色器候选生成与审核的学习材料；TouchDesigner提供多类数据在实时应用中组织、传递、采样和观察的具体参考。当前不建立替代生产线，不要求放弃Houdini、Blender、UE、Gaea或既有Three.js/WebGPU网页。节点名称可以帮助定位原文，团队技能以可测试的输入输出和限制命名。

## 核心候选方法

一、分别记录输入时钟、事件时间、模拟推进时间和画面时间。输入包含采样率、时间戳、单位、坐标、状态初值、版本和事件身份。画面掉帧时，先说明系统采用暂停、补算、解析推进还是近似策略。每个策略的时间误差与事件损失应显式记录。

二、区分需要历史的状态与可按需计算的显示。相机移动可以只请求显示更新；累积状态是否推进由明确的时间约定控制。不能因为对象暂时不可见就默认重置其历史，也不能因为需要完整状态就每帧重建所有静态几何。此规则是本团队设计建议，未在TouchDesigner或各Mother产品上实现。

三、GPU数据尽量沿适合的链路处理；输出回CPU时记录数据版本、完成时间和延迟。需要实时安全判定的数据不能拿上一帧结果冒充当前结果。优化要同时测总帧时间、计算次数、显存、同步等待和正确性，不能仅统计节点数。

四、高频参数变化与程序结构变化分离。颜色、风速等候选参数优先考虑相应输入参数通道，避免在没有必要时重建代码。代码生成或拓扑改变仍可能合法地要求重新编译；需区分合理编译与无意重复编译，不把任何重编译都判为错误。

五、观察窗口本身也属于性能测试条件。分别记录正式呈现模式与诊断模式，确认二者输入和状态一致。若观察改变结果而不止改变耗时，需要检查依赖、求值与时间推进，不能简单藏掉问题。

## 本轮实际完成的CPU试验

源码：[temporal_probe.py](temporal_probe.py)。Python 3.13.5，仅标准库。运行命令：python temporal_probe.py。脚本打印完整JSON，断言仅用于本轮合成样本，不是GPU或软件实测。

衰减实验：初值1、半衰期0.5秒，总时长2秒；模拟15、30、60、120帧/秒及一种不规则显示间隔。每次按实际dt计算解析指数衰减，五种情况下末值均在1e-12阈值内等于0.0625。故意每画一帧固定只推进1/60秒时，相应末值约为0.5、0.25、0.0625、0.00390625、0.25。此例说明时间约定错误可改变效果，不能推广成所有数值求解器在变步长下都等价。

事件实验：600Hz抽象时钟中第121到124刻度产生5毫秒脉冲。所选五种画面采样序列均未直接采到脉冲高值；假设输入层已捕获两条带身份和时间的边沿事件，区间游标可以在所有序列中按顺序交付两条事件且不重复。端点都为0时，线性插值在真实脉冲时刻仍为0。这说明应先记录事件，不能把平滑采样当成事实恢复。

边界检查：刚好落在区间终点的事件只交付一次；重复请求同一时刻不重复发出。负dt、NaN、重复事件身份和未声明重置的时间倒退四种输入被拒绝。尚未处理真实设备时钟漂移、丢包、延迟到达、乱序、事件持久化和队列溢出。

长间隔检查：抽象经过0.6秒、单次预算0.2秒。只处理0.2秒后遗忘剩余时间，状态约为0.757858；完整0.6秒应为0.435275。保留未处理时间并分三批推进，结果与完整推进一致。本例没有模拟实际运行成本；保留欠账也不能无限解决持续过载，需要有界预算、报警、降级或恢复策略。该行为属于自写程序，不声称TouchDesigner内部使用此算法。

上述1e-12仅为Python双精度算例的数值检查阈值。没有测浏览器、TouchDesigner、GLSL、GPU、手机、真实物理或其他Mother当前代码，不能据此填入产品通过状态。

## 分层吸收建议和理解题

Weather、Ocean：优先时间推进、反馈与GPU数据的语义。问题：显示从60降到15帧，哪些事件和历史应保持？带一帧延迟的采样能否用于当前状态判断？烟与泡沫表现不自动证明流动、浮力和碰撞正确。

Brick、Tiles、House：优先动态材质参数、实例属性及观察开销；不更换已认可几何、光照和材质。问题：只改湿度显示参数，哪些部分应保持？诊断视图额外消耗如何分开测？本轮未诊断这些线的实际性能根因。

Landscape：优先GPU属性分布与可观察数据流。主形、区域真值、固定几何及各线禁止项仍生效，不用屏幕反馈代替洞穴和真实构造，不改变DEM数据。

Human、Animal及Brain/Jarvis：学习带时间戳的输入、事件去重与状态查询边界；认知层只产出高层意图，低层执行仍由原系统负责。问题：瞬时点击或语音事件没有被采集时，为什么插值不能证明曾收到它？本轮没有接入麦克风或动作系统。

任何执行者采用前，先报告真实分支、目标运行时、具体卡点、阅读范围和反例，再做隔离实验。其他人的回复和视觉批准不能由本卡代签。不要求全体停工重学，也不把索引发布视为已向各会话送达。

## 本轮状态

source_review=completed_for_listed_scope；cpu_probe=passed_for_defined_examples；touchdesigner_execution=not_run；gpu_validation=not_run；production_integration=not_run；visualAcceptance=false；productionReady=false；automation_changed=false。这是小妈当前执行回合的学习成果，不属于无人值守后台工作。
