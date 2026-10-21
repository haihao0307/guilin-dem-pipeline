# R03 整套重穿修正：阶段性独立审查

审查日期：2026-10-21。审查者：独立 `audit_handoff` verifier，未编写本次生产修正或回归脚本。本报告是对源码和实际运行证据的独立复核，未重复执行整套长程计算。

## 当前结论

**本地候选修正及所述范围内的回归审查通过，可以进入新源码的完整 CI；尚不允许作为完成验收的公开交付。** 本报告绑定候选 `layer-world.mjs` SHA256：

`a4da64a62d08602a2a3cbf000b4d2fac8db1bb2bd4b8d4eb9ef1dcf5cb97255a`

`INDEPENDENT_STAGE_REVIEW.md` 是此前接触计算优化和八步 A/B 的历史阶段报告，不代表本次重穿修正或最终验收。旧生产源 `74c20ec28e07cbd9e0082e03216d0231556efa0f` 的完整 CI 为五项成功、一项真实 reentry 失败，**该 source 的发布门禁未通过**。旧的成功项不能替代修正后新源码的完整 CI。首次失败证据必须保留。

| 门禁 | 本次独立结论 |
|---|---|
| 重穿候选代码、缓存失效、事务恢复 | 静态审查通过 |
| 原生 14 步、三轮短重穿、失败注入与重复 remove | 报告与原始证据复核通过 |
| 原失败的 120 个操作序列在候选 ON 路径重放 | 113 个真实 step 接受，限定检查点审计通过 |
| 原 R02 / 旧 R03 OFF / 旧 R03 ON 三路诊断 | 120 个操作、240 次实现间严格比较通过；未精确复现原浏览器状态或其失败 |
| 修正后新源码完整六任务 CI | 待完成 |
| 新固定 HTTPS、桌面/390×844 实际交互与截图 | 待完成 |
| 最终独立验收、PUBLICATION_PROOF、shareAllowed | 待完成；尚未放行 |

## 保留的真实失败及修正范围

旧源 CI run `39535426824`、job `119010860233`、artifact `12318441900` 在第二次加入 outer 后的首步（request 120）拒绝求解并回滚。20 次尾约束后衣间残余为 `13.24916642044889 mm`，超过原有 `0.5 mm` 限制；最大边长比 `1.4478735995442276`。这不是超时，也不允许把回滚当作成功推进。仓库摘要见 `local-redress/first-ci-failure.json`。

独立读取历史 R02 原通过 artifact `12251619456`，确认其六段实际步数是 `29 / 34 / 27 / 31 / 27 / 32`，而本次失败在前三段实际完成 `35 / 42 / 35` 后发生。原浏览器脚本以物理时间下限触发异步暂停，实际停止步数受运行调度影响；同一脚本不意味着相同的求解输入序列。两次捕获的初始 body、rows、物理 options 的完整 JSON 数值结构相同，但不能将这些 JSON 数值说明为原始 typed-array 字节证明。

旧实现从存活衣物的当前位置执行再次穿着，然后才重置 saved、initial、速度和时钟，因此存活衣物此前累计的姿态仍影响下一次初始化。修正将已披露的 `GLOBAL_REDRESS_RESTART` 落实到各衣原始 prepared seed：

- seed 在缝合、腰点固定和粒子映射后独立复制，不以显示顶点数组或会被覆写的 saved/initial 代替。
- 只在显式 add 引发的整套重穿边界恢复 seed；普通 step 与原纸样、材料、接触求解规则不变。
- 保留纸样 rest、缝合拓扑、质量/逆质量、腰点、当前厚度/clearance、world settings。
- 初始化失败恢复存活衣物的 p/v/old/initial/saved、edge/bend lambda、物理时钟、接触历史和既有报告。失效的加速缓存重新建立。
- 不存在 ID 的 remove 直接返回，使 app 在 failed add 后补发的清理 remove 不会再次清除已恢复的历史。

未发现阻塞性的静态保守性或事务恢复缺陷。分配/复用统计允许反映实际发生的分配，缓存也会失效；“恢复”限定于物理、约束、历史和时钟，不等于整个 world 对象的所有统计字节不变。

## 原生三轮及失败注入回归

脚本：`tests/native-redress-regression.mjs`；归档报告：`local-redress/short-regression-summary.json`。独立审查了全部脚本、19 个审计状态、事件记录、输入 hash、列出的 16 个源码 hash、三个测试 hash，以及 23 个被报告引用的证据文件长度和 SHA256，均匹配。

| 证据 | SHA256 |
|---|---|
| 短回归 summary | `8ca70cc3bd001bdf43313c9f689f5eb0be16b76b777988325f527fe521319395` |
| 执行的回归脚本 | `40449e72ab065c4331759f1917e02636247e14f435561e73295e72e925c2266c` |
| 原始 typed-array 输入 | `0021e7e18a5dbf898a3148daa6b80fac9c564e0f4f14a7d6e4b7cf474c66c945` |

输入来自旧源 `74c20ec` 的真实 CI 原生捕获。脚本拒绝普通数值重建；验证原始 Worker 截获未改写输入、原人物 Y-up 转换后的全部 typed bytes、人体拓扑、完整 required typed paths、三件原衣物和启用的衣间接触。候选源码标签明确为 `prepared-seed-candidate`，没有冒充已存在的 Git commit。

三轮各执行四个真实 step，分别在脱下前、脱下期间、穿回后推进；失败注入前后再执行两个真实 step，共 **14 步**。每一步都检查实际 step/time 增量、每件在场衣物的粒子数组发生字节变化，并独立检查全输入三角及人体厚度包络。物理时间的 `1e-12 s` 算术误差断言没有放宽几何或接触门槛。

三轮重穿后均与另建的 fresh 完整候选 world 严格相等，状态 digest 同为：

`d31bee1211dcb215b403f4ebe68afb8da85a2101344bb7dc019c92a2e4b3a125`

比较包含 p/v/old/saved/initial、edge/bend lambda、质量/逆质量、固定点身份、设置、显示 positions/normals/indices、报告和接触历史。独立 fresh 比较只排除分配计数及指定时间/工作量统计；原物理工作上限、收敛值与约束继续比较。另行比较 prepared seed 和原纸样 packet，避免它们被运行过程改写。canonical 表达保留 typed-array 类型/字节、负零、undefined 和非有限值，并同时使用 hash 与 deepStrictEqual。

19 个离散状态的最大伸长 `1.4496862113176934`，最大衣间残余 `0.3628252127047624 mm`；接缝间隙、人体内顶点、生产及独立人体半厚度缺口均为零；覆盖全部输入三角，报告相交与退化面均为零。

TEST_ONLY 故障发生在真实 initializing settle 已 `converged:true`、实际完成四次 pass 之后，仍使用初始化 `1.4` 最大伸长、`0.0004 m` 残余门槛。没有替换求解器、改写生产源码或跳过收敛。随后移除测试 wrapper，执行实际下一步。

失败前与失败后再次 `remove('outer')` 清理后的状态 gzip **压缩字节也完全相同**，两份均为 2,616,022 字节，SHA256：

`7892801111520fe3693ec00de11f9743af470615afc1209d7353c913b552581b`

比较包含原报告的计时值，仅排除实际 WASM 分配统计；这些统计在报告中单独保留。此用例的历史有两条 garment history、一条 frame-side，pending/sides/edge references 为空；不能扩大为覆盖所有非空历史组合。UI 清理是执行相同 World 操作的数值回归，尚不是公开页面中的真实点击验收。

## 120 个原操作的候选重放

先前冻结 R02 / 旧 R03 OFF / 旧 R03 ON 的三路数值重建诊断已实际走到 request 120，360 条 lane 操作记录无 error、240 条跨实现比较无差异。末步三路均为伸长 `1.4484556934603636`、衣间残余 `0.035858767010431454 mm`。原始诊断 summary SHA256 为 `ad00bd08ba4935d4d54d6e71a6d5db7fbe9fc8e22c727ade6d7a134c4e58d454`，输入模式明确为 `public-observation-numeric-reconstruction`。

**该三路诊断未重现原 Chromium 失败。每条 lane 的 21 个原浏览器几何检查点均未完整逐字节匹配。** 这只证明相同数值重建输入在当前 Node 环境的三实现一致，不能证明原浏览器失败与优化无关，也不能完成对那个特定状态的根因归责。该原始 summary 的 `complete:false` 是脚本末尾 `??=true` 不会覆盖初始 false 的元数据缺陷；本报告依据完整 request 1–120 记录说明实际执行范围，保留原字段不改写。

`local-redress/recorded-sequence-summary.json` SHA256：

`1390a2e8ba905cb88d05960c6940d794cba0a3a8e006add2228a2c21aaf95690`

独立核对全部 120 个 request ID/type 与记录序列相同，13 个候选 src hash 与执行源一致。此次只执行 **R03 ON**，使用上述 SHA256 `0021e7e…` 的原始 typed 输入。120 个操作中包括 **113 次真实 step**、两次 remove、两次 add、两次测量 snapshot 和一次 init；每条记录的 step/time 与该序列相符，无求解错误。它不是 120 个物理步，也不是新的 OFF/ON 对照实验。

在 requests **1、39、119、120** 做了独立全部三角/人体包络审计；不是对所有中间步都做了该独立审计。其余步骤仍经过生产求解器原有 hard gates。最后 request 120 成功达到 step 1、`1/120 s`，最大伸长 `1.4467900189850715`，衣间残余 `0.33871281921500285 mm`，独立相交/退化面为零，人体半厚度缺口为零。全过程记录的最大伸长为 `1.4498794120273761`。

原始 summary 的 `scope` 文本沿用了“numeric reconstructed init”措辞，该处与实际 `inputMode`、input hash 和执行代码不符。**保留原文件不改写，以 `local-redress/evidence-index.json` 的勘误为准：实际使用原始 typed-array 捕获；复现的是操作序列，不宣称与旧 Chromium 浮点历史逐字节一致。** 代码顶部遗留的三路说明也不构成三路结果；实际 `lanes` 只有 `r03-on`。

## 发布前仍需完成

本地结果支持修正进入新提交和完整验收，不能将旧源五项成功沿用为新源六任务全部成功。新 source 的 display、demand、continuous、reentry、native-baseline、native-perturb 必须全部通过并保留原始证据。之后仍需新固定 HTTPS 的版本/资源回读、真实桌面与 390×844 页面交互、原截图及独立 PUBLICATION_PROOF。

本报告不授予最终视觉验收、生产就绪或公开分享资格；不宣称实时、动态人体、完整自碰撞、完整 CCD、逐纱碰撞或材料标定。首次失败及此前阶段报告继续保留，最终 receipt 应绑定新的确切 source 与实际公开证据。
