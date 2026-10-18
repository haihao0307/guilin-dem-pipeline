# KAOPU 头发结构工作台 R01

## 当前阶段：一个当前长度静态发型，S1 尚未整体通过

先读 [固定执行路线](docs/EXECUTION-ROUTE.md)、[当前状态](review/STATUS.json) 和 [本轮逐项自查](docs/UPPER-REST-11.md)。每轮必须记录任务、输入、不可改变项、实际效果、失败与更改、完成性判断和下一项；不以研究编号或自动检查数量表示完成度。

当前唯一工作方案为 `current-rest`，页面默认打开它，旧研究折叠保留。S1.B3.1 在固定 R10 来源上单独修整顶部旋涡根向与上段过渡，19 条上段曲线和 365 根方向改变；24 条刘海、全部切口和 14,933 个来源保护点逐点不变。B3.2 再对 49 条上段路径增加最多 3.5 mm 原生法线圆度；完整后枕束形和整头自然度仍未通过。下面 B1/B2 作为已固定的先前步骤：S1.B1 修整主体束形与下缘；S1.B2 修正分缝两侧到刘海的衔接。141 条主体路径在 B2 中逐点不变，24 条刘海重新追踪、178 根方向同步。批准毛囊域、全部原生绑定及十二个旧状态保持。下一项为耳周中束及侧后发尾衔接；整体自然度、三套独立长度和冷启动均未验收，密集发丝/质感/物理仍锁定。

当前只交付灰色稀疏结构，不能把头部透出解释为真实发丝透明度已修复。以下为历史记录；旧链接和旧性能数字不代表当前版本。

## 当前加载优化 · startup-12

日常测试先用 [本机快速入口](http://127.0.0.1:8786/preview.html#layer=static&view=oblique&experiment=current-rest)。原有 12 份项目资源已按固定清单放在当前工作台自己的缓存，启动不需要走外网；人物、皮肤内核/分辨率、根与完整 Guide 不变。重启后可运行 `tools/start-fast12.ps1` 后台恢复入口。首次准备缓存的下载与浏览器打开计时分开记录。

本轮实际实施：完整皮肤计算与人物初始化并行、精确结果持久缓存、当前发型数据提前读取、四份页面数据并行、隐藏的 36 张人物预览图延迟到可见后读取。原生分发/CDN 试验未通过真实入口，已撤回。当前几何仍为 R11，只完成耳周三维定位，未把加载修改算作新造型。见 [加载实施与逐项检查](docs/STARTUP-12.md)。公开网络冷启动仍独立验收，不能套用本机秒数。

## 上一次固定公开版本 · R11

[打开顶部旋涡与上段圆度版本](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/7852b999d3c5652172a0a75037c7ce034fbf6dd9/kaopu-hair-workbench/foundation/structure-r01/public.html#layer=static&view=oblique&experiment=current-rest)。当前 payload 来源 `8dcfcc8`，固定入口 `7852b99`；运行散列与本地六视图一致。公开十二项状态、直达链接、批准生长域和人物几何核对通过，零页面错误和失败请求；启动只取当前方案的两份实验文件。

本机这次新浏览器上下文：结构约 **27.20 秒**、完整人物约 **44.84 秒**，皮肤生成约 15.72 秒；十二状态缓存切换合计约 284 ms、零新增请求。独立新页面直达约 21.69 秒，但同一上下文已有缓存，不能作为冷启动结果。和 R10 的 84/103 秒相差较大，不能据此归因于本轮顶部修改或宣称加载优化已完成。首次加载仍未验收。[公开原始记录](evidence/public-upper11-check.json)、[六视图自审](evidence/upper11-self-review.json)、[前后对照](evidence/upper11-review-overview-1.png)。

## 历史实施：参考方法进入生成过程 09

[打开已实测的三维发流版本](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/76a3bd7d31950c4b6182ce0fc5110ba6d0766bec/kaopu-hair-workbench/foundation/structure-r01/public.html#layer=static&view=oblique&experiment=volume-flow)。本机新浏览器测试十一项状态和独立新页面直达链接通过，零页面错误与失败请求。本次冷启动结构约 23.23 秒、人物完整约 37.23 秒；新状态首次切换约 1.94 秒，十一状态缓存切换合计 144 ms、零新增请求。直达页面同一浏览器上下文已有网络缓存，其 16.61 秒不算冷启动。加载仍未达标。[原始公开记录](evidence/public-volume09-check.json)。

根据学习文件第八节，新增“连续三维发流”：12 条造型曲线约束共享三维场，从原生根重建 141 条主体/鬓角路径，24 条前额/刘海保持。2,559 个启用非刘海根的方向、切向与抬升同步更新，绑定、位置、法线和 F02.1 生长范围不变。中、小束同时满足全曲线尺度与局部原生根图连通。原十一项状态单独锁定；当前十二个运输状态、十一个可见选项。

关闭曲线约束使路径最大变化约 30.17 mm，确认研究原则已进入生成。当前人体中心线穿透为零，新路径最大局部折角约 16.34°；完整自然体积、刘海、发梢与中束外形尚未完成视觉验收，密集发丝、材质和物理继续锁定。[学习文件逐项落实](docs/LEARNING-CHECKLIST-R09.md)、[消费者、失败记录与研究差别](docs/VOLUME-FLOW-09.md)、[当前同机位实际对照](evidence/volume09-review-overview.png)。下方 R08 及更早段落为历史记录。

## 历史实施：对照学习文件推进轮廓与发束 08

[打开本轮固定预览](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/63da890c63190e1cf24af364fb004ab08e06fc68/kaopu-hair-workbench/foundation/structure-r01/public.html#layer=static&view=oblique&experiment=silhouette-framing)。本机全新浏览器公开测试：结构 18.97 秒、人物皮肤完整就绪 32.83 秒；两项新研究首次切换约 1.23 / 0.91 秒，十状态缓存切换合计 137 ms，零新增请求。新页面直达指定研究也通过，但同一上下文已有网络缓存，不能把其 15.69 秒当作冷启动改善。[完整公开记录](evidence/public-route08-check.json)。首次加载仍未达标，本轮未完成加载优化。

按[用户文件逐项对照表](docs/LEARNING-CHECKLIST-R08.md)，新增“立体轮廓”和“立体轮廓·耳前渐层”两项当前长度的静态结构研究。31 个下段中束参照驱动 117 条主体路径，保留全部刘海/鬓角与每条主体前 45 mm；原九个状态的配置、几何、毛囊缓冲均由独立历史锁验证不变。当前十个可见选项，第一轮仍未通过完整视觉验收，密集发丝、材质和物理继续锁定。

侧后下段不再集中贴在同一后平面；耳前长束的终点以同侧保留鬓角为参照。上部与耳周仍有交叉，尚不能认为自然性已完成。本文下方 R07 及更早段落为历史。[实现、失败尝试和限制](docs/SILHOUETTE-WISPS-08.md)；[本轮当前画面对照](evidence/route08-review-overview.png)。

## 修订 07 公开实测

[打开当前轻层次剪裁](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/cacba9027dec8988558b7a36f4e02b6e7a4ce374/kaopu-hair-workbench/foundation/structure-r01/public.html#layer=static&view=back&experiment=cut-layered)。八个可见对照及独立新浏览器页面的剪裁直达链接均通过；本机本次冷启动结构约 20.38 秒、人物皮肤完整就绪约 34.21 秒。两版剪裁首次切换约 1.34/1.38 秒，八状态缓存切换合计约 104 ms、零新增请求。冷启动仍未达到用户要求，本轮不宣称加载优化完成。[公开测试记录](evidence/public-cut07-check.json)。原版、U 形和轻层次的同机位对照见 [当前实际画面](evidence/cut07-review-overview.png)。

## 历史实施：长度与剪裁 07

已保留原长度，新增“柔和 U 形剪裁”和“轻层次剪裁”两项对照。两版沿既有发流求终点，保护毛囊、头顶发流、刘海和鬓角；中、小束依据新的完整曲线重建。可勾选“对照剪掉的原发尾”观察差别。当前共八个可见对照，仍为静态稀疏结构，本轮处理下缘轮廓和长短层次，不代表真实发丝粗细或三套独立长度已完成。[实施、发现与证据](docs/LENGTH-CUT-07.md)。下面修订 03–06 保留为历史。

## 修订 06 公开实测

已验证的固定版本：[打开修订 06](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/6dd7912ccb2070ab1ed3332ce20c91a6ca3c7457/kaopu-hair-workbench/foundation/structure-r01/public.html#layer=zones&view=left)。本机新建无缓存浏览器实测：结构约 18.46 秒、皮肤完整就绪约 32.04 秒；五个新增状态首次切换约 0.52–0.99 秒，六状态缓存切换合计 133 ms、零新增请求。全部状态原生几何不变、诊断后发保留、零页面错误及失败请求。**冷启动仍未达到用户标准，本轮不宣称加载优化完成。** 记录见 [公开测试](evidence/public-flow06-check.json)；它只代表此次机器/网络，不是低端设备或物理阶段性能认证。

## 历史实施：区域与连续发流 06

已加入双侧五点太阳穴参照、真实发缝宽度/发际线起翘控制，并修复移动发缝时整束路径跳变。六个可选状态包含“加宽发缝”“降低发际线起翘”；保留同一 F02.1 生长域、2,737 活跃根和 165 条导向发。49 状态连续扫描、七状态结构检查及当前画面已验证。仍为静态稀疏导向发、局部上段编辑；下段出口和发尾固定。详细实现、失败尝试、证据与限制见 [连续发流 06](docs/CONTINUOUS-FLOW-06.md)。下方修订 03—05 为历史。

按用户提供的结构学习指南重建基础。本轮只有一个静态工作台、同一个原生 P01 和一个当前长度结构方案。F14 的三长度外观及物理实验暂停，没有把旧实验当作已验收结构。

**第一轮：结构验收中。第二轮：锁定。** 数值合法不等于发型视觉通过，也不等于已准确还原参考照片。

## 复查与学习路线 05

五组实际结构再次核对，已有几何保持不变；补上检查器对实际根位置、实算弧长、框架方向/手性、剪裁端点、掩码和非有限根记录的遗漏。23 项合同检查通过。当前仍有配置未生效、分缝大步换侧、修复快照不能替代通用生成器等问题。[详细审核与九个后续板块](docs/RESEARCH.md)、[实际数据与故障注入证据](evidence/previous-work-audit05.json)。性能与防回退贯穿全程；先完成静态结构，再进入密集发丝、光学、物理。图片参照始终参与；静态可编辑系统稳定后接入图片自动化，可与光学、物理并行。

## 后发生长范围恢复 04

取消修订 02 额外加上的原生高度裁切，恢复用户已通过的 **F02.1 生长域与耳后/后颈边界**。3,300 候选身份和 3,067 可生长根保持批准值；当前发型启用 2,737 根，恢复被裁掉的 520 根。原有 135 条完整导向发位置不动，恢复区补 30 条，总计 165 条。

完整头发常驻，分区和箭头作为叠加检查，区域筛选不会隐藏后发。新的批准锁与构建检查比较**实际使用的域**、绑定和启用掩码，并拒绝第二次高度裁切。`AGENTS.md` 固定后续工作规则。[根因、恢复依据与防回退](docs/SCALP-AUTHORITY-04.md)。

[太阳穴资料与当前左右侧对照](docs/TEMPLE-REGION-REVIEW-04.md)：耳前鬓角不等于整个颞区；额颞凹入、颞尖、颞下段尚缺独立地标。已拍摄当前分区与启用点，没有重画已确认的毛囊域。

提交与 PR 的 `Approved hair growth domain` 检查会核对实际域、根掩码、既有曲线和当前构建的视觉证据；失败时停止交付，不能自动刷新批准锁使其通过。

## 发流与中束实验 03

本轮加入基准、发缝左移、刘海减小侧扫、侧发偏向耳后四个可切换对照，以及隐藏的 1 mm 小步稳定性探针。它们共享毛囊、导向发身份和剪裁；新方向场在头皮图上求解，中束收束实际改变曲线并保留根与梢端。可勾选“查看中束聚合前的导向发”检查差异。

其他实验差量数据按需下载；缓存后切换复用原人物和皮肤。自由拖拽编辑、体积发流、密集发丝、材质和物理尚未完成。[研究、实验与局限](docs/EDITABLE-FLOW-03.md)。

## 静态结构修订 02（含已撤回的后颈裁切）

这轮建立绕耳下垂路线、连续剪裁和束群，但叠加的后颈高度裁切错误抬高了已确认下缘，现已撤回。历史数据为 2,217 个启用根、135 条 Guide，不能继续作为生长域批准值。[历史记录与修正说明](docs/STATIC-FLOW-02.md)。

## 已落实的体系

`ScalpDomain → CandidateRootField → ActiveRootMask → RootDirectionField → Parting/Whorl → RegionalLength/Cut → GuideGroom → ClumpGraph → RestShape`

唯一发型入口是 [HairStyleProfile](src/HairStyleProfile.mjs)。生长域、方向、物理弧长与空间剪裁分开；分缝保留毛囊并改变两侧发流；旋涡是有影响范围的方向约束；耳前和耳后拥有明确路线。修订 02 的束群按完整曲线的实际弧长采样距离构造，保留区域、分缝侧与耳前/耳后路线边界。Guide 保存原生三角面、重心坐标、97 点完整曲线、实际弧长、局部运输坐标和三级束群父链。

本次实际输入是 F02/F12 的 **3,300 个候选根**，启用数量由密度场与稳定种子决定。用户指南提到的 64,000 候选库未在当前这条原生输入链中找到，不补撒点凑数，也不把候选数称作最终发丝数。

九个查看层：十区头皮、候选毛囊、启用毛囊、根部方向、分缝/旋涡、区域长度、完整 Guide、发束层级、灰色静态结构。每层可从正面、左右、背面、顶部、斜侧观察，并可筛选区域。保存按钮导出包含绑定、配置、完整曲线和束图的结构包。

密集子发丝、根中梢质感、碎发、动作、风和物理没有进入本轮。灰色 Guide 是低密度结构线，显示宽度不代表真实发丝直径。现有角色皮肤只是固定宿主，本轮未修改皮肤算法。

## 发质与物理成果合并

两边已汇入当前工作台。来源代码与证据冻结在 `../../integrations/fiber-runtime-r08`；当前页面实际创建统一结构输入，复用第二轮门禁。完整物理与密集渲染仍需按这边的运输坐标及束链适配，未启用。具体复用范围、未完成项和性能限制见 [合并规则](docs/MERGED-SYSTEM.md)。

## 学习与验收记录

- [用户指南原文](docs/KAOPU_HAIR_STRUCTURE_LEARNING_GUIDE_R01.md)
- [十个问题的回答与旧系统审计](docs/UNDERSTANDING.md)
- [研究阅读、适用结论与未实现部分](docs/RESEARCH.md)
- [结构规则、数据所有权与验收状态](docs/STRUCTURE-CONTRACT.md)
- [合并后的实际数据与运行边界检查](evidence/runtime-integration-checks.json)
- [几何和方向检查](evidence/structural-checks.json)、[数据合同反例检查](evidence/contract-checks.json)

## 重建

需要 Node.js，以及 esbuild。`ESBUILD_PATH` 可指定 esbuild 可执行文件；当前构建器的默认路径只适用于此工作环境。

```powershell
node tools/build.cjs
node tools/serve.cjs
```

构建会重新生成当前静态结构，执行数据合同、统一输入与静态改进检查，避免使用过期结构资产。

本地唯一入口：`http://127.0.0.1:8785/preview.html`。离线输入和人物宿主均在本目录冻结；无需 F12 的隐藏构建目录。原生宿主仍按其已有固定地址加载项目资源。本地验证服务器用已有项目缓存映射相同资源，公开页面访问原固定地址。

`BUILD_MANIFEST.json` 固定源文件、输入、人物宿主和结构资产散列；页面在加载时检查压缩数据的长度与 SHA-256；`PUBLIC_BUILD.json` 固定网页压缩块，`PAYLOAD_PIN.json` 固定公开数据提交。

## 查看当前研究基线

[打开唯一结构工作台](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/codex/hair-structure-lab-r01-20261016/kaopu-hair-workbench/foundation/structure-r01/public.html)。首屏只读冻结静态结构，不加载另一套发型或物理演示。公开下载数据固定到 `PAYLOAD_PIN.json` 的提交。

修订 03 公开冷启动实测：结构约 24.4 秒可操作，共享皮肤约 38.3 秒完全准备好；无页面异常或请求失败。首开速度仍未达标，不能称为已提速。变体首次读取约 1.3–2.2 秒，全部缓存后四组连续切换约 65 毫秒、无新增请求。[本轮实测](evidence/public-flow03-check.json)；[上轮记录](evidence/public-load-check.json)。
