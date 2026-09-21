# 小桂林执行边界

只使用 contracts/PRODUCTION_CONTRACT.json 指定的 canonical 数据库。每次开工先核对清单与当前状态。

禁止日常 TIFF 读取、旧 54 瓦片依赖、GAEA 生产路线、30 米替代、NoData 填洞、量化、高程纹理、截图式网页替代、手工河道、湖泊与水库面。

不要修改固定数值高程、AOI 或数据哈希。概览只是显示层选择，完整原生近景必须读取真值数据。

新版本公开验收通过以前不得删除旧在线依赖。只使用文件级删除清单。其他生产线、其他分支和 gh-pages 的其他目录受保护。

用户只通过在线三维网页验收。构建通过、Node 模拟测试通过和真实浏览器通过要分别记录。人工 visualAcceptance 与 productionReady 不能自动置 true。

本交接包不含原始 TIFF。用户自行保管源文件，缺少 TIFF 不构成接管阻断。仅使用已有 canonical 数值文件，不下载或重新导入 TIFF，不把冷备份打回交接包。

## Mother Production Operating System R2

全部 Mother / Codex / 子执行端开工前必须读取并执行 `knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md`。

生产默认流程固定为：
`LOCK → EXECUTE → VERIFY → PROMOTE`

每个明确任务先建立 Task Anchor；每个候选统一使用 R2 Delivery Receipt；每一次重要用户纠正转成 Regression Case。模板：
- `ops/mother_execution/templates/TASK_ANCHOR_R2.json`
- `ops/mother_execution/templates/DELIVERY_RECEIPT_R2.json`
- `ops/mother_execution/templates/REGRESSION_CASE_R2.json`

Producer 不能批准自己。用户不再作为第一层 QA：候选必须先过合同、新鲜度、参考保真和机器门禁。内部失败不得为了展示而发给用户；没有合法新产物时使用 `NO_NEW_ARTIFACT`。

同一个 bounded task 最多允许两次内部失败循环；第二次仍失败则进入 ROOT_CAUSE_REVIEW，不再凭感觉微调，也不无限更换 worker。

## 所有 Mother 共用视觉产出规则

DEM、Cloud Mother、Weather Mother、Ocean Mother、Coast、Landscape Mother 及本仓库后续全部 Mother，默认禁止调用图像生成或图像编辑工具。禁止生成概念图、效果图、预览图、参考图、海报、缩略图，也禁止用图片代替真实三维成果。

只有用户在当前对话中明确要求生成图片或修改图片时，才允许进入图片工具流程。用户提出“做一版看看”“展示创意”“做个样子”时，默认交付真实可交互三维 HTML、Three.js 或 WebGPU 页面、程序化几何、函数代码和在线工作台。

浏览器自动化可以在内部保存 QA 截图，仅作为运行与视觉检查证据。未经用户明确要求，不把 QA 截图作为创作成果发送。

所有 Mother 面向用户的常规交付只允许展示一个已经发布并验证通过的公开网址。该网址必须可以直接点击、自动进入最终工作台，并在同一入口内完成模块切换。不得在常规回复中发送沙箱文件、下载链接、全量包、修正版压缩包、哈希、清单、QA 截图或多组测试地址。上述内部资产可以继续生成和保存，只有用户明确索要时才展示。

## 参考复刻 / 学习任务禁止擅自创作硬门禁

所有 Mother、Codex 和子执行端在执行“按参考做、复刻、学习别人、照模型/照片/视频做、做得一样、不要想象补画”类型任务前，必须读取并执行 `knowledge/REFERENCE_REPLICATION_NO_CREATIVE_SUBSTITUTE_GATE.md`。

默认：
- `TASK_MODE = REPLICATION_LOCKED`
- `CREATIVE_AUTHORIZATION = FALSE`

除非用户在当前任务明确授权原创，否则禁止自行设计、简化、补画、做 generic/toy/placeholder 版本、为了展示过程先做一个“差不多”的东西，或在参考缺失处凭审美补全。未知区域必须保持 UNKNOWN / SOURCE_ENTRY_REQUIRED / MEASUREMENT_REQUIRED。

一旦出现未经授权的创作替代，立即将该结果标记为 `REJECTED_CREATIVE_SUBSTITUTE`，停止在它上面继续修，不得作为下一版形体基线；回到最后一个已接受/已证据化版本，从参考测量重新开始。错误版本只留作失败证据，不改写历史、不 force push。

测试 primitive 仅允许隔离在 TEST_FIXTURE_ONLY，不得进入正式工作台、视觉截图、生产继承链或用户验收。每一个可见修改必须能对应到参考、测量、用户批准约束或已批准物理关系。

## 任务新鲜度 / 禁止旧产物冒充新交付硬门禁

所有 Mother、Codex 和子执行端在执行用户已经明确交代的新任务后，必须读取并执行 `knowledge/TASK_FRESHNESS_AND_NO_STALE_DELIVERY_GATE.md`。

任何“这是最新结果 / 今天新做的 / 昨晚做的 / 本轮修改后的效果”都必须能证明发生在本任务 dispatch anchor 之后，并绑定当前 head。旧模型、旧网页、旧截图、旧 release、旧 QA 只能作为 BASELINE / BEFORE，不得冒充新交付。

如果本轮没有形成新产物，必须明确写 `NO_NEW_ARTIFACT`，不得为了“有东西给用户看”而重发旧成果。最新构建失败时不得静默回退旧版并伪装成当前效果；fallback 必须明确标记且不能作为验收结果。

用户已经明确“今晚做什么、明早看什么”时，次日必须先读取最新任务锚点和最后指令，不得重新选题、回退旧路线或拿旧版本顶替。做错目标或使用旧产物统一标记 `REJECTED_STALE_OR_WRONG_TARGET_DELIVERY`。

## 真实三维工作台硬门禁

所有 Mother 开工、计划、任务卡、交接和发布前，必须读取并执行 `knowledge/REAL_3D_WORKBENCH_ONLY_GATE.md`。

任何“做一版”“重新做”“继续做”“给我看”“按参考做”的请求，都必须落实为真实生产源码和可交互三维工作台。除非用户在当前对话中明确要求图片，否则严禁调用图像生成或图像编辑工具，严禁用概念图、效果图、静态截图、视频、Canvas 假画面或占位页替代三维成果。

如果还没有可运行三维版本，继续修改源码并诚实报告尚未形成可验收成果；不得生成图片填补进度。只有截图而没有工作台，本轮自动判定失败，不得交付。

每一份规划、清单、任务卡、README、START_HERE、会议纪要、交接包和验收报告都必须包含：

- [ ] 没有用生成图片代替真实三维实现；
- [ ] 已实际修改生产源码；
- [ ] 用户看到的是可交互三维工作台；
- [ ] 画面来自实时三维运行时；
- [ ] 公网固定链接和真实浏览器已验证；
- [ ] 如果只有截图而没有工作台，本轮判定失败。

## 所有 Mother 共用在线交付门禁

本仓库中的 DEM、Cloud Mother、Weather Mother、Ocean Mother、Coast、Landscape Mother 及后续在线工作台，开工和交付前必须读取并执行 `knowledge/PUBLIC_WEB_DELIVERY_GATE.md`。

任何公开链接发给用户以前，必须完成实际发布、最终公网地址 HTTP 200 回读、版本标识正文匹配、关键资源检查和真实浏览器启动检查。仓库中有文件、构建成功、本地截图成功，均不能代替公网回读。

遇到 404、403、空白页、托管平台错误页、资源丢失或页面启动失败，立即视为发布失败，修复并重新执行完整发布闭环。不得先让用户代为测试，也不得沿用未回读的猜测地址。

每次成功发布都要保存 `PUBLICATION_PROOF.json`。只有其中 `shareAllowed=true` 时才允许分享链接。新版公开验证通过以前保留旧版可用入口。


## 用户最终交付格式：单体 HTML 双击直开（2026-09-21 永久规则）

凡是交给用户直接打开、查看、测试、验收的网页、三维工作台或演示，**最终交付本体必须是一个独立的 `.html` 文件**。用户只需双击即可运行；不得要求解压、配置路径、运行 npm/Vite/Python/local server、另外放 assets 目录或再打开第二个工具。

所有运行必需的 JavaScript、Three.js/runtime、shader、CSS、图片、数据、模型、音频和 decoder 必须在构建时封装进该 HTML（inline / data URI / base64 / typed array / compressed payload + inline decoder / Blob URL 均可）。核心运行不得依赖 CDN、远程图片/GLB/JSON、GitHub raw、localhost 或首次 service-worker 预缓存。

发布前必须真实执行 `file://` / 本地双击测试：首帧成功、关键交互可用、console 0 error、无缺失资源、无 CORS 核心失败、无需服务器、核心功能所需网络请求为 0。内部开发仍可多文件；用户交付必须 build 成一个 standalone HTML。

单文件规则不允许降低三维、物理、材质、数据或视觉质量；禁止用截图/视频/简化展示壳代替真实工作台。在线固定网址可以作为附加镜像，但不能替代 standalone HTML，也不能成为其运行前提。

若本仓库旧规则写“只交公开网址/必须服务器”，与本条冲突时以用户 2026-09-21 最新单体 HTML 指令为准。跨 Mother 完整规范见 `haihao0307/guilin-dem-pipeline@5791e1edef55b75888e783d5d355cc2cdfe277ba:knowledge/SINGLE_FILE_DOUBLE_CLICK_HTML_DELIVERY_GATE.md`。
