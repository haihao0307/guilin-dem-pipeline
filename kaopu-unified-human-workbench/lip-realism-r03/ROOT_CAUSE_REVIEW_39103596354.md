# R03 第二次失败 ROOT_CAUSE_REVIEW

## 决定与当前状态

**当前结果为 HOLD / NO_NEW_ARTIFACT。第二轮实际通过 12 / 15 个验收项，但整轮失败，不能生成或沿用可交付的 publication proof。** `completed:false`、`shareAllowed:false` 和原始 SIGTERM 记录保持原样。

根因是验收编排的总预算不足：生产者完整保存并关闭后，开始新读档环境时已经运行 **22 分 46.844 秒**，24 分钟总上限只剩约 73 秒；新读档环境尚需完整冷启动、真实文件导入、正常 native update 后的严格像素与状态比较、手机控件和最终清理。已有同类完整冷启动实测为 93–119 秒，尚不包含后面的读档比较。

本次复盘后采取一次有界修正：**完整重跑原有 15 个验收项，将 QA 总上限从 24m 改为 34m，将 job 上限从 32m 改为 42m。** 生产模块、构建器、验收脚本、场景数量、像素零容差、性能上限、单步超时和发布证明谓词全部不变。此决定已经由 root 采纳并仅在本地 workflow 修改两行；下一次公开运行的结果仍未知。

该处理遵循仓库 `AGENTS.md` 的两次失败后复盘要求，以及 `knowledge/MOTHER_PRODUCTION_OPERATING_SYSTEM_R2_ZH.md` 第 10 节的共同原因排查要求。它不取消两次失败，也不把部分通过改成整轮通过。

## 1. 绑定的原始证据

### 第二轮

| 项目 | 精确身份 |
|---|---|
| Run / job | [39103596354](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39103596354) / `117604694560` |
| Source / verification commit | `0d221486ee735afc644170d968a06db7cf9e67f4` |
| 固定未验收 build commit | `fcb444d5fd4a737ded545d36f72f8756b9f7f477` |
| 公开 HTML SHA256 | `7ea453e7ae7fb19a808cb160838d2fa17ec56e6724832233728aba1bd1b0d71a` |
| 生产模块 SHA256 | `c3bc194d725628746395c9a8f68ad7ab74ba0470568ef639410d6962a3a32919` |
| 构建器 SHA256 | `ca50a5929da3b4e0f2fb66d9b12b6bd0ecd5d5fd991491318c190d4777ef5435` |
| 验收脚本 SHA256 | `2f4f3e8fd21e0b00659447a888cfe366c2e10196068459823e01ffee0c384baa` |
| Task Anchor SHA256 | `b1aa306c8c5ce8377590fc1382c67f654df3ffab447a0f4d19a6789ec70b0206` |
| [Artifact 12128276470](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39103596354/artifacts/12128276470) | 24,054,059 字节，66 个文件 |
| Artifact ZIP SHA256 | `efca9508703f82a261a00e35a88c06be88e884a18e03fdd2f4a5cc6f7375d790`，下载后逐字节摘要与 GitHub digest 一致 |

原始摘要保存在 [qa/detail-r03/39103596354-1/](qa/detail-r03/39103596354-1/)；[ARTIFACT_MANIFEST.json](qa/detail-r03/39103596354-1/ARTIFACT_MANIFEST.json) 列出全部 66 个原始文件的字节数、SHA256 和 `preservedVerbatimHere`。Manifest 自身 SHA256 为 `6f38133338bc6576bd0d55e6191644bd2882502cb71d5ef482d6be6876710905`。只有标为 `true` 的文件已原样复制到该目录；较大的 PNG、各场景完整 JSON 和人物下载文件仍绑定原 Actions artifact，未声称全部已进入 Git。

本复盘直接使用的原始摘要：

| 文件 | SHA256 |
|---|---|
| [qa.json](qa/detail-r03/39103596354-1/qa.json) | `d5e310fad0462be0d79e73746f06f56d1511e057622bf8a46d80e3c2ac578e24` |
| [qa.partial.json](qa/detail-r03/39103596354-1/qa.partial.json) | `3ab39d597950017256982c03f24aa05728d06955b7ce92f20bd5683260feca7e` |
| [progress.jsonl](qa/detail-r03/39103596354-1/progress.jsonl) | `866e1e2283987c4ee4d807070a566f844ca1896fba235606cef8f05d693157f8` |
| [performance.json](qa/detail-r03/39103596354-1/performance.json) | `e27ff48e0b901426934b397c365936dd6fe3a33a34aaa2eebd1aaf508bb3a271` |
| [saved-producer.json](qa/detail-r03/39103596354-1/saved-producer.json) | `4598455a3c0a080f7c46ff42335448d3a4f7808b8182817957ea29a197ef8b95` |

### 第一轮

第一轮完整根因及修正记录见 [QA_FAILURE_REVIEW_39102640232.md](QA_FAILURE_REVIEW_39102640232.md)。Run 为 [39102640232](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39102640232)，source 为 `3e5d1dfb11cb8a40982e3ff964d06d2ff13d4d0f`，build 为 `be2b7b70f9a08e9f5e053c8ac9d22e8396672499`。其 artifact `12127561625` 的 ZIP SHA256 为 `3ae77996afe54801c7f757141f4b90fe5aa57c598ef6f6ab47f44abdd9c68932`。第一轮只有 5 个文件、没有 PNG；该失败也继续保留。

## 2. 两次失败的关系与共同原因

| 运行 | 直接失败 | 证据与修正状态 |
|---|---|---|
| 第一轮 | 第一张固定 R01.1 基线图的 `Blank framebuffer` | QA 在生产 render 返回后的另一次浏览器任务中读默认 framebuffer。宿主实际 `preserveDrawingBuffer:false`，已呈现的帧没有跨任务保留保证。该轮只有前三项通过；后续正常完成清理。 |
| 第二轮 | 24m 全进程硬上限发 SIGTERM，外层 exit 124 | 同一浏览器 callback 中的 native render → finish → readPixels 已正常工作；四组真实对照以及后续门均通过。累计时限在第三个 context 的 startup drain 中用尽，未触及该单步自己的 180 秒上限。 |

第一轮的直接缺陷已经通过第二轮的 **55 次真实完整帧读回**得到针对性验证：每次均记录同 callback 的 native render、前后 frame counter 前进、非 thenable 的同步返回、实际 `preserveDrawingBuffer:false`、`errorBefore:0` 和 `error:0`。已保存的 43 张 PNG 及其原始 RGBA 摘要通过独立复核。第二轮不存在再次读取已清空旧帧的已知证据。[原始帧记录](qa/detail-r03/39103596354-1/qa.json)

两次直接失败原因不同，但共享同一个 QA 编排问题：**对原生渲染的帧生命周期和软件 GPU 工作量作了未经完整实测的假设。** 第一轮试图复用已提交的帧以缩短运行，遗漏默认 framebuffer 的生命周期；修正为真实同步重渲染后，24m 总预算没有根据完整工作量重新估算。第二轮现在提供了四场景、通道对照和后续控制的实际运行成本，足以做一次可审计的总预算修正。

本复盘不据此修改生产 shader、网格或 renderer 选项，也不更换 worker 来回避相同输入。生产模块在两轮中均为 `c3bc…`。第一轮的 QA 修正只改变帧 helper；本次只改变完整任务的硬截止时间。

## 3. 第二轮实际时序

以下均为 UTC。累计时间以 `qa.startedAt = 2026-10-18T06:19:29.151Z` 计算；阶段耗时来自 `progress.jsonl` 的配对 start/end，包含该阶段实际必要操作。四场景的耗时不是单帧性能指标。

| 阶段 | 阶段耗时 | 完成时刻 | 已累计 |
|---|---:|---|---:|
| 固定 R01.1 冷启动并排空 GPU | 93.268 秒 | 06:21:02.686 | 1:33.535 |
| R03 producer 冷启动并排空 GPU | 98.596 秒 | 06:22:41.283 | 3:12.132 |
| 远古无 lipRealism 档案兼容 | 2.841 秒 | 06:22:44.140 | 3:14.989 |
| P01 闭口，同档案全组比较 | 254.167 秒 | 06:26:58.535 | 7:29.384 |
| P01 轻张口，同档案全组比较 | 224.221 秒 | 06:30:42.757 | 11:13.606 |
| P02 闭口，同档案全组比较 | 237.299 秒 | 06:34:42.746 | 15:13.595 |
| P02 轻张口，同档案全组比较 | 218.054 秒 | 06:38:20.804 | 18:51.653 |
| 不支持 schema / revision 的突变前拒绝 | 1.661 秒 | 06:38:22.468 | 18:53.317 |
| R07 原始模式及恢复 | 50.000 秒 | 06:39:12.470 | 19:43.319 |
| 同状态同步性能 ABBA | 104.176 秒 | 06:40:56.648 | 21:27.497 |
| 细纹为零及真实键盘滑杆 | 78.303 秒 | 06:42:15.014 | 22:45.863 |
| 四个真实完整人物保存入口 | 0.856 秒 | 06:42:15.872 | 22:46.721 |
| producer 已成功排空并关闭 page + context | — | 06:42:15.988 | 22:46.837 |
| 开始 fresh reader 冷启动 | — | 06:42:15.995 | 22:46.844 |
| fresh reader HTML、宿主 ready 后开始 GPU 排空 | 尚未完成 | 06:42:36.493 | 23:07.342 |
| 总时限 SIGTERM，写失败记录并退出 | — | 06:43:28.861 | 23:59.710 |

四场景合计 **933.741 秒，即 15 分 33.741 秒**。它们包含保存和导入同一个真实人物及校准、切换生产模式/诊断通道、实际渲染和全 RGBA 比较，因此不能用单个 beauty render 的耗时替代。

fresh reader 在仅约 20.498 秒内完成公开资源和宿主就绪检查。其 startup drain 开始后到 SIGTERM 仅 **52.368 秒**；同轮基线和 producer 的相同 drain 已分别实际消耗约 **72.9 秒和 79.5 秒**。第一轮的两个成功 startup drain 更为 91.8 秒和 95.1 秒。因而现有证据指向累计预算不足，不能把这 52 秒未完成的 drain 解释为 180 秒单步卡死或恢复功能失败。

`readbackMS` 也不能替代性能样本：它会连同先前实际控件、导入、视图和诊断操作产生的队列一起排空。专门的性能门则在固定状态下，使用同一个 native render → GPU finish → CPU read 的完整序列，才能比较两页的实际工作量。[性能原始数据](qa/detail-r03/39103596354-1/performance.json)

## 4. 已证实范围与尚未完成范围

12 个已经通过的门是：生产源码保护、默认值保持、远古宿主档案兼容、四个 P01/P02 与闭口/轻张口场景、schema 迁移的突变前拒绝、R07 模式往返、同步性能、细纹零值和真实滑杆、四个 v2 完整人物保存入口。四场景的旧模式与固定 R01.1 原始像素完全相同；albedo、roughness、原生校准及几何保持 exact，独立唇部 ROI 外变化数为 0。[qa.json](qa/detail-r03/39103596354-1/qa.json)

性能门的 16 个 measured samples 按 8 个基线 / 8 个候选组成，另有 4 个 warmup。两边 median 分别为 **4736.400 ms / 5469.550 ms**，比值 **1.1547905582298872**，低于固定阈值 **1.20**。此结果只是当前软件图形环境中同状态实际渲染的相对成本，不代表硬件 FPS，也不改变下一轮必须重新通过该门的要求。

四个真实保存入口下载了完全相同的 2,142,819 字节 JSON，SHA256 为 `d5bccb06852a0157af4387a16e259d324c7dc11b5fec976f6e24889b44ea2ae0`。保存对象为非默认 P02、轻张口、`surfaceRevision:3`、`foldStrength:0.67`，包括两套 native calibration 数组。该结果证实保存完整；它尚未证实新 context 导入恢复。[saved-producer.json](qa/detail-r03/39103596354-1/saved-producer.json)

以下三个必需门没有执行完成，不得继承或推断 PASS：

| 缺失门 | 下一轮仍必须实际执行 |
|---|---|
| `fresh reader exact disk restore` | producer 关闭后创建新 context；确认初始身份不同；只通过真实 `#lr-file` 载入磁盘保存的原始 JSON；即时校准 exact；一次正常 native update 后完整参数、canonical/rest/index/display geometry、校准、受控相机光照与 900×720 RGBA 零容差一致；完整再次导出 JSON exact。 |
| `mobile viewport controls` | 同一个 reader 切 390×844 实际 viewport，真实点击 previous / new，真实滑杆 ArrowLeft / ArrowRight，核对实际 settings 和 aria 状态、恢复完整持久参数并保存真实 viewport 截图。 |
| `zero runtime and resource errors` | 全部三个 context 完成检查后，确认 runtime、console、resource、request 错误均为 0，所有 context 已关闭，并完成 browser close。 |

第二轮中 baseline 和 producer 均有成功 drain、page close、context close 记录；fresh reader 仍是 `closed:false`，未开始读入保存 JSON，`q.cleanup` 尚不存在。SIGTERM 处理器写了准确的未完成状态，但该退出不能充当有界清理成功。必须等下一轮真实得到全清理成功记录，才允许置 `completed:true`。[qa.json](qa/detail-r03/39103596354-1/qa.json)

## 5. 对仓库要求的共同原因逐项排查

| 必查问题 | 本轮判断与依据 |
|---|---|
| 参考不足？ | 没有证据表明参考不足导致这两次 QA 失败。冻结原生基线和完整人物档案已足以完成四场景 exact 对照；个人真实沟纹测量仍是既有边界，不能因此主张最终写实。 |
| Task Anchor 有歧义？ | 对最终验收合同无歧义：必须有真实三维、四场景、档案冷恢复、移动 viewport、性能和完整清理。问题是此前给该明确工作量配置的总预算没有完整实测支撑。Anchor 内容与 SHA 保持不变。 |
| baseline 被污染？ | 公开 R01.1 HTML 和模块摘要匹配固定值；候选 revision 1 在四个人物/姿态场景均与同档案基线像素 exact；未见污染证据。 |
| 工具或渲染失败？ | 第一轮是 QA 帧生命周期错误，已修复并由第二轮 55 次帧读回证实。第二轮是外层总时限终止，未见 GL、shader 或资源异常；新 reader 的正常启动尚未得到足够总时间。 |
| 工作在错误表示空间？ | 没有使用生成图片、替代网格或静态模拟。记录来自实际原生三维运行时、真实控制与 GPU RGBA；新细纹只影响冻结合同允许的法线高度场。 |
| 需要改变实现方法？ | 不需要改变生产实现。第一轮已恢复可靠的同步真实帧方法；第二轮只需按现有实测工作量给完整验收有界总预算。 |
| 需要更强模型或人工测量？ | 当前超时的解决不依赖更强模型或生物测量。独立源码、原始图像及档案审计已分别完成；用户最终视觉验收和最终写实结论继续保留，不由 QA 自动批准。 |
| 多个执行者共用同一错误输入？ | Producer 未改验收来批准自己；独立 verifier 已复核 artifact digest、实际图像/像素和时序。共因是旧 QA 编排假设，已集中修正，不通过换 worker、换目标或导入活跃 PR306 绕过。 |

## 6. 量化总预算与唯一修正

已测前段到 fresh reader 开始为 **1366.844 秒**。尾部尚未在本 R03 运行中完成，所以以下是明确的预算假设，不能写成已测的本轮完成时间。

作为预算参考，已成功的 R01.1 run [39095533327](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/39095533327) 在 evidence commit `c9d6eadc3bf44af50e718a63a8f8581c591cacd7` 的 [原始 qa.json](https://github.com/haihao0307/guilin-dem-pipeline/blob/c9d6eadc3bf44af50e718a63a8f8581c591cacd7/kaopu-unified-human-workbench/lip-realism-r01-1/qa/fresh-context/39095533327-1/qa.json) 记录了两个新 reader：冷启动并排空分别为 **113.837 / 118.508 秒**，随后真实文件导入、正常更新和完整像素恢复比较分别为 **75.278 / 101.082 秒**，移动 viewport 为 **17.658 秒**。这些历史数据仅用于估计成本，不替代任何 R03 验收项。

| 预算组成 | 预留 | 根据 |
|---|---:|---|
| 已测完整 producer 前段 | 22:46.844 | 第二轮原始 progress |
| fresh reader 冷启动和 GPU 排空 | 2:00 | 同轮 93/99 秒、此前成功 reader 114/119 秒 |
| 文件导入、native update、完整状态和像素 exact | 2:00 | 既有同类成功 75/101 秒；本轮仍须真正执行 |
| R03 手机 viewport 和真实 mode / slider 操作 | 1:00 | 旧同类约 18 秒；本轮新增实际交互和视图操作，给更高预算 |
| 最终错误检查和正常 GPU/page/context/browser 清理 | 1:00 | 第二轮已关闭两个 context 的正常清理很短；原有每步有界清理仍保留，未保证异常清理全部能在一分钟内完成 |
| 上述合计 | **28:46.844** | 对完整成功路径的预算估计 |
| 已测前段的 15% runner 余量 | **3:25.027** | 对后续 runner 波动的显式规划余量，不宣称统计置信区间 |
| 加余量后的预算 | **32:11.871** | 1726.844 + 205.027 秒 |
| QA 硬上限 | **34:00** | 在上述估计之上再留约 1:48.129；到点仍失败 |
| Job 硬上限 | **42:00** | 保留原工作流中 job 比 QA 多出的 8 分钟，用于安装/构建/证据上传和收尾 |

这不是将执行时长提高到 34 分钟；成功则立即完成。34 分钟只是一次性总截止时间。单步 startup drain 仍为 180 秒，GPU/page/context/browser 清理仍各有原 60 秒边界；任何子步骤或精确断言先失败即按原流程失败。像素容差仍为 0，性能比值仍须 ≤1.20，样本、分辨率、人物/姿态数量不变。

Root 已应用的 workflow 变化只有：

```diff
-    timeout-minutes: 32
+    timeout-minutes: 42
-        run: timeout --signal=TERM --kill-after=20s 24m node "$LIP_DIR/verify-detail.cjs"
+        run: timeout --signal=TERM --kill-after=20s 34m node "$LIP_DIR/verify-detail.cjs"
```

Workflow 原 SHA256 为 `a710ce9914deb91cd9ce728ffe9926048583a3e397d5475cfeb783fe422053d9`；修改后为 `e200043b736fd250079e363e16942e872b10f8429ece28ff5c8e8bae9261643c`。将这两处文字逆向替换后，文件摘要精确回到原 SHA256。验收脚本仍为 `2f4f…`，生产模块仍为 `c3bc…`，构建器仍为 `ca50…`，Anchor 仍为 `b1aa…`。本复盘没有修改这些文件。

## 7. 替代方案：定向续验为何本次不采用

一个显式设计的跨 run 证据合成方案可以重用第二轮已经完成的技术证据，再针对剩余 reader 和手机操作做补充验收。但它不能直接满足当前 publication contract。当前工作流要求一个本次 source/build 绑定的 `qa.json` 同时包含全部 15 个真实通过项、3 个成功关闭的 context、成功 browser cleanup 以及 `completed:true`。

若采用合成方案，至少还需新设计并独立审计：原 artifact 身份和每个继承门的来源绑定、两次执行的 source / verification source 区分、保存文件及 producer 参考帧的全部原字节验证、固定相同公开 HTML、新环境真实文件输入、跨执行者图形环境的精确比较限制、旧失败 reader 未完成清理的明确记录、新 reader 的完整清理、新 proof schema 对逐门来源的承认。旧运行仍必须保持失败，不得伪造它的 cleanup。跨 runner 的像素 exact 即使成功，也不能被描述成原 run 内同机器的新 context 比较。

本次采用完整重跑，因为只需两行总预算变化即可维持已审计的单次 15 门合同、同一次实际 producer/reader 比较和全部清理要求，新增验收逻辑最少。不会减少截图、降低分辨率、跳过诊断通道、复用未证实的帧、减少性能样本或延用旧成功门冒充下一轮结果。

## 8. 发布条件与停止条件

1. 第三轮前由独立 verifier 审核本复盘、预算数字、仅两行 workflow 差异、生产及 QA 摘要和原 15 门合同。Root 才能对当前隔离分支按正常快进提交并启动一次完整公开构建和验证。
2. 下一轮必须重新绑定自己的 source / verification / build commit 和公开 HTML SHA，实际运行全部 15 门，并在全部 context 和 browser 有界清理完成之后才生成 `PUBLICATION_PROOF.json`。第二轮 artifact 仅保留为失败与复盘证据。
3. 任一像素、几何、校准、档案、安全迁移、UI、性能、资源、GPU 或清理门失败，或者触及 34m QA / 42m job 上限，都继续保持 HOLD，不发布 shareAllowed。严格断言和现有快进守护不得绕过。
4. 这次是复盘后的唯一预算修正。若第三轮仍失败，不自动发起第四轮，不再次增加预算，不凭感觉调生产细纹；先按新的具体 stage、原始日志和 artifact 再做根因判断，并由 root 决定新的有界行动。
5. 技术门全部通过也不自动等于用户视觉接受或 production ready。`visualAcceptance`、`userVisualAccepted`、`productionReady` 仍保持 false，限定为小幅细纹候选；颜色实验 PR306 与其它皮肤/控制支线继续受保护。

## 9. 真实三维工作台检查

- [x] 没有用生成图片替代真实三维实现；本证据为原生 WebGL 的真实渲染和控件操作。
- [x] R03 已有实际生产源码变更，冻结于 `c3bc…`；本次复盘及预算修正不改生产源码。
- [x] 候选是实际可交互三维工作台，桌面按钮、滑杆和下载入口已在真实公开页面操作；当前结果仍未批准交付。
- [x] 已记录的画面来自实际三维运行时，不是截图式工作台。
- [ ] 公网固定链接和真实浏览器的全部验收完成：HTML 回读和桌面对照已通过，fresh reader、手机 viewport 与全清理尚缺，不能勾选完整通过。
- [x] 只有截图而没有工作台应判失败；本轮即使已有实际图像，也因完整验收未完成而继续 HOLD。
