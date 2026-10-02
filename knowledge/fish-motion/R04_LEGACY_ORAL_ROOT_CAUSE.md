# R04 海狼口部：原表面三角梯度门禁与正式路由

最终路由：海狼下颌与鳃盖均为 HOLD_LOCAL。下述鳃盖 raw 源CPU证明通过，但实际GPU继承眼窝 recess 后失败：三角159544原 socket 三权重为1，中性 double-area3.45374e-9m²，活动面积比3.42022，超出原门禁。被拒绝鳃盖场仅保存于 `scripts/research-fixtures/legacy-gill-socket-rejected-r04.js`，正式构建不引用；不得仅根据 raw CPU 的 PASS 再次晋级。六种眼睛与两个原生金枪鱼下颌通道继续制作，不让一个局部失败卡住总系统。原 R14 HTML、497701点、964285三角、UV、原权重、原眼睛均未改。

## 原断层与两次候选

独立实际 GPU 发现原量化下颌权重在 .589739mm 源边[465634,466482]上从0跳到1；.038rad 开合将该边放大6.920倍，出现19个翻转三角。这是源量化域边界不连续，接缝顶点一致并不能排除同一个三角被拉长。

第一候选在原 jaw/gill 正权重支持域的真实表面邻接图上设零边界，用 Dijkstra 测地边距离与 quintic C2 collar，未新增支持域或几何。过窄 collar 仍导致最坏边1.575/面积1.983/det最小.496，失败。第二候选由原最大下颌杠杆×.038rad的空间导数估计，把过渡宽度改为 .05体长 jaw、.04体长 gill；保留输入 .038rad/.00135m。嘴吻端 x<-.485 的867个源点平均位移4.534mm、最大4.679mm，源吻端权重仍1，没有缩成不可见运动或拿脖子鼓动冒充开口。

第二候选全表面边max1.146/min.853、顶点平均 Jacobian det≥.791、无翻面，但真实三角面积max2.3167，仍然拒绝。没有删除瘦三角、放宽面积门禁或发起第三轮盲调。

## 确切根因

源三角27216=[148514,148318,147991]，三边 .377089/.600278/.977098mm，面积 .005458mm²，最小高11.172µm，长边/高87.456。relative area=.009952，不是此前1e-5阈值以内的退化面；它必须保留并正常通过。

此源三角原下颌权重为[1,1,1]，在原刚体旋转下面积比1。第二候选却采样为[.837514,.847513,.849081]，真正 face barycentric ∇w 为[66.305,-280.460,-403.364]/m，模长495.738/m。几乎共线的三条边对不同图最短路采样产生的细小不一致，变成极大的跨窄高方向梯度；三个点的平均顶点梯度不能代表这个面。

原三角按 `angle*w` 试转面积比2.3166767；换成 weighted rigid LBS 仍为2.3183936。因此换旋转表达式不能修复根因。Quintic 的 C2 只保证对其标量输入的端点光滑；作用在边图距离上不保证整个原三角的连续场是 C2，也不自动满足三角 eikonal/面梯度上界。

后续若重开这个工位，应建立保留源0边界和吻端有效位移的 triangle/FEM 连续场，约束每个实际源面 ∇w，并将 rank-one Jacobian 扰动界与整面面积门禁同时绑定；在取得约束可行性和全表面证明以前保持 HOLD。本轮没有把这条研究路线当作完成实现。

## 正式纯函数与证据

`src/legacy-oral-fields-r04.js` 导出自包含 `generateLegacyOralFields(positions,indices,originalWeights,metadata)`。可用 `function.toString()` 注入 Worker，无 helper/import/DOM/GPU 依赖。输出 jawWeight Float32(N)和jawGradient Float32(3N)严格全0；gillWeight Float32(N)、gillGradient Float32(3N)与第二候选合格 gill-only 场逐字节一致。`proof.jaw.status` 明确 HOLD，`proof.gill.passed=true`；总体 productionReady仍false。

鳃盖场限制在原92348个正权重地址，不借用嘴或上颌面；源图跨域三角固定0，在1e-7米位置别名上统一 float 权重及实际面梯度面积平均。quintic collar=.039257817272米。没有改原量化权重，正式渲染应读新的 float 属性。该场只能表现鳃盖表面呼吸起伏，不证明内部鳃腔或新增口腔。

实际来源由 `scripts/legacy-oral-source-r04.mjs` CPU解码不可变R14；`derive-legacy-oral-fields-r04.mjs` 生成正式场；`verify-legacy-oral-fields-r04.py` 保存 `evidence/R04_LEGACY_GILL_ONLY_CPU_PROOF.json`。全497701点/964285面覆盖25种请求组合；jaw即使收到0..038输入也严格不动。鳃盖0..00135m整个连续区间另作解析极值证明：位移线性，因此每条边和法向面积向量为A+sB，长度极值在端点或二次函数驻点；不靠五个离散样本冒称全区间证明。源面朝向、顶点Jacobian与真实面切向Jacobian分别检查。

鳃盖全幅源结果：边max1.06442/min.939943，面积max1.23045/min.878769，顶点det≥.930683，翻面0。实际 GPU 验证与最终页面冻结由母任务和独立验证通道负责，CPU证明不是视觉验收。

拒绝的非零jaw函数保存在 `scripts/research-fixtures/legacy-oral-graph-c2-rejected-r04.js`，完整失败数据在 `evidence/R04_LEGACY_JAW_REJECTED_C2_RESEARCH_CPU.json`；仅明确 `--research-fixture` 才运行，不进入生产权重或打包依赖。原源文件全部保持不变。

- [x] 未生成图片、未建立替代几何、未开启浏览器或占用GPU。
- [x] 正式新代码明确禁用未通过的jaw，仅保留已证据化的gill场。
- [ ] 实际GPU、单体HTML与公网实时三维工作台由母任务验收；截图不能代替工作台。
