# Mother 有限协调纪要：Material R11 公网启动阻碍

ID：KAOPU-MOTHER-20261004-MATERIAL-R11-RUNTIME-R1
状态：主持核查完成；生产交付未完成；非专家会。

## 实际时间与参与
- 北京时间实际核查：2026-10-04 02:33:19–02:37:34，4分15秒；不是原定时长。
- 实际 Mother 新接入/回执：0；独立专家调用：0。
- 本轮读取 main、协调分支、gh-pages、#63/#91，并实际操作公开页面读取启动状态。未访问任意会话完整历史或 G:；没有工具可据上述会话ID直接接通相关 Mother，未伪造接收、理解或采用。
- VALIDATION_ONLY_NO_SOURCE_DELTA=true；本轮不制作生产资产。

## 唯一问题与决定
R11 有真实发布增量和软件 GPU UI 测试，却仍在本轮默认云浏览器创建 WebGL2 上下文时失败。决定：Material R11 保持 HOLD_GATE_FAIL / 交付未完成；针对重复启动阻碍做有界 ROOT_CAUSE_REVIEW，不再用 UI、色彩、噪声或形体调整冒充启动问题修复。

这是现有 PUBLIC_WEB_DELIVERY_GATE 的执行与新回放，不新增并行制度或重复 regression case。当前失败仅证明本浏览器未通过，不能推广为所有用户设备失败，也不能证明函数/形体算法错误。已通过的 SwiftShader 测试保留其真实作用域。

## 会前依据
读取 main 的根 AGENTS、R2 Production OS、REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE、TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE、PUBLIC_WEB_DELIVERY_GATE，以及 R2 receipt 模板、MOTHER-NO-METHOD-INVENTION-001、Terrain stale case。Terrain case 的显式适用对象不是 Material；仅沿用全局 freshness gate，不谎报 Terrain case 已在本线执行。
- main：a513d478268f3f177304ee3f6e384211113a177b。
- gh-pages：eab8c371e974ac9d8d725dfb815f3488539e5250。
- 协调分支写前：25e6e3cad9abc4127410c9f3467d55548009c9de。
- 上轮 Mother：2026-10-03/MOTHER_0230_MATERIAL_R04_REUSE_GATE.md。其中研究许可边界继续有效，不以本轮运行核查解除。
- 最近可读专家状态：2026-09-25/EXPERT_WINDOW_STATUS_1202_PDT_CORAL_R02.md，无实际专家答复；未补开。
- #63 最新 N49：[真实反馈](https://github.com/haihao0307/guilin-dem-pipeline/issues/63#issuecomment-5910449798)，Coast 当前 subject 的公网 WebGL 失败与手机未知保持；不是本轮 Mother 参与。
- #91 最新 N66：[反馈](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5971807309)，求解失败不等于全局不可行，属于 Tailor 候选，不扩为全局已采用规则。
- 本题 N61/N62/N65：
  - [R09](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5967900025)
  - [R10](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5968869883)
  - [R11](https://github.com/haihao0307/guilin-dem-pipeline/issues/91#issuecomment-5970747872)
  这些已有 POSTED/GATE-RUN，不当新 ACK。

## Material 端九项核对
| 项 | 本轮可核实状态 |
|---|---|
| taskId / targetObject / targetDefect | R11 两块石头及有用控制的发布/测试可读；独立生产 Task Anchor 的唯一 taskId 未取得。此次协调题仅处理启动阻碍，不代填生产 taskId。 |
| accepted baseline / baseSha | R09 文档以原01独立、原02/03合并为约束，排除被拒绝 R08/R08.1；accepted baseline 的用户批准 SHA receipt 未取得。R11 工程父发布为 R10@5cfd1262ebbbf2c8f2fb3903508e03f2ebcd312f，不能等同 accepted baseline。 |
| 用户最后约束 | 本任务明确：外部可点击网页、实际渲染/主要交互/版本核验，桌面、390×844与实机分列；失败须写交付未完成。不得为修交付擅改现有技术任务、部署旧失败版或新增收费服务。 |
| referenceSet / UNKNOWN | 读取 R09 NOTES、冻结 shader 和 PUBLICATION_PROOF；TDM/IQ研究来源与非商用许可边界保留。未读到全部最新 Material 对话或独立完整 referenceSet；硬件设备、所有外部浏览器、实机手机、准确根因 UNKNOWN。 |
| forbidden routes | 不继承被拒绝 R08 generic 球石；不改变原形体/冻结着色器；不以静态图、视频、假工作台、降分辨率、自动旧版 fallback 或新的架构替代；不改生产分支或浏览器安全设置。 |
| fresh head delta | R11 发布83516f16f6fa9620965ad5b746a66e2eea50e860新增 lab-r11 源码与入口 UI；当前8个运行文件8/8与发布 blob相同，Material目录自发布无差异。main此轮新增R11 CI/测试，运行源码在gh-pages可读，不把main测试head当运行源码head。 |
| regression执行 | 历史R09原01/IQ默认像素回归已记录；R10→R11三份 baseline shader本轮逐字节相同。未执行R11的完整 reference-pixel suite，未取得R2 regressionCasesRun统一回执，不能冒称全部通过。 |
| gates | 身份一致PASS；本轮默认云浏览器启动/关键交互FAIL；SwiftShader CI仅其环境证据；Reference Fidelity与Contract完整放行未取得；本轮390×844未执行，实机未执行。 |
| 状态 | HOLD_GATE_FAIL / HOLD_DEFAULT_BROWSER_RUNTIME_FAILED；不晋级CANDIDATE_READY或ACCEPTED_BASELINE。 |

## 本轮实际观察（与历史报告分开）
公开核查入口为既有Material固定入口附case=wet&v=r11。本轮不是向用户交付失败页面。
- 默认云 Chrome，不修改启动参数；视口1363×936，非390×844，非实机。
- 页面标题“KAOPU 石头材质工作台 · R11”；正文出现“WebGL2 未启动。”
- 31/31按钮 disabled；颜色、缩放、案例切换无法合法执行，未强制点击。
- 页面实际脚本指向 lab-r11/app.js。
- 当前生产脚本的 makeRenderer(canvas) 第32行调用 getContext('webgl2', ...) 返回空后抛错；浏览器控制台同栈，时间2026-10-03T18:34:41.077Z。该栈位于 shader compile 之前。
- 来源中的 Chrome扩展metadata错误与生产错误分开，不把扩展日志当石头算法根因。
- 当前根index SHA256：f45495d5c34f573d73cdca7895392b2aac505f19d19cae143590a617c53346a9。
- R10→R11 wet-baseline.frag / wet-material-baseline.frag / iq-baseline.frag 三者逐字节不变。
- 工作流 .github/workflows/material-r11-ui-check.yml 明确强制 ANGLE SwiftShader，并测试颜色、缩放、五组控制及390×844。该工作流记录 browserPassed/shareAllowed 的作用域不能抹掉。
- 重复同一云浏览器回放不是新的独立设备观察根；本次新增的是时间绑定的验证事实，不是新物理知识。

## 责任端与最小验证（建议，未执行）
责任端：Material Mother / Material execution line；独立验证端负责最终放行。Coast相似失败仅作为共同工具链假设线索，本轮不派发Coast重写或全员汇报。

先把一次新的有界诊断绑定 production taskId、准确运行commit/资源digest、输入版本及同一统一receipt。保留几何/材质源码。
1. 使用与正式工件隔离的 TEST_FIXTURE_ONLY 能力检查，在同一未改配置的浏览器测试 WebGL2 上下文能否建立；先测正式工件所需属性，再测默认属性，记录各自结果，不强制修改安全/启动参数。
2. 对照同一精确R11公开工件：如隔离fixture同样无上下文，分类为该环境能力阻碍，不能据此要求改噪声；如fixture能启动而R11不能，继续定位上下文属性、数量或工件路径。区分依据仍需实际结果，不能预选答案。
3. 在实际具备正常WebGL2能力的独立浏览器中验证同一公网subject：正确版本→非空实时画面→无致命页错误→颜色改变渲染→缩放有效→原版恢复与几何保护回归。记录浏览器/图形后端/参数/视口。390×844单列；物理手机未测写未测。
4. Software GPU、默认云浏览器、硬件浏览器分别记PASS/FAIL/UNKNOWN，不合成一个无作用域的browserPassed=true。公开交付只能按用户要求的完整证据放行；缺证据保持交付未完成。

反例：fixture失败且同一R11在另一正常硬件浏览器通过，会否定“R11在所有设备代码失效”；fixture通过而R11同环境失败，会否定“只是整个环境没有WebGL2”。两者目前均未取得。本轮不安装新服务、不改浏览器参数、不生成示例资产。

失败预算：R09/R10/R11跨版本的相似启动失败足以优先查共同原因；不能把三次验证回放直接等同同一taskId的三次生产失败循环。生产task anchor及尝试账未知，是否已耗尽同一bounded task的两次额度仍UNKNOWN。

## 下一飞轮问题与未完成边界
有限研究题：如何在现有统一receipt内绑定“工件身份＋环境能力＋交互claim作用域”，同时区分能力缺失、工件失败和未验证，避免软件GPU通过误升级为普遍公网通过，也避免云浏览器失败错误否定所有硬件设备。沿用现有门禁与N49/N61/N62/N65去重，不另造庞大格式。
未完成：上述诊断/硬件/手机/完整参考回归、统一Task Anchor/Receipt、独立放行、Mother实际接收/采用、用户验收均未发生或未取得；不得宣布生产问题已解决。
本轮生命周期：协调纪要保存后仅POSTED；本轮有限GATE-RUN为默认云浏览器核查。生产修复IMPLEMENTED、Mother ACKNOWLEDGED/ADOPTED、USER-ACCEPTED均无新证据。
未修改main、gh-pages、生产Mother、用户冻结成果、飞轮、日程或通知。没有用图片替代三维；没有生产源码改动；当前页面未满足真实运行和公网交付检查。
