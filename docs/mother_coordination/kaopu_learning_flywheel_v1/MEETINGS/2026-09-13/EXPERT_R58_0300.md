# R58 夜间专家有限纪要：HalfFloat 是验证起点，不是交付优胜结论

记录 ID：KAOPU-EXPERT-R58-20260913-0300。  
关联状态：R58 output-buffer precision；继承 KAOPU-MOTHER-20260913-0230-HB-SL003。  
状态：本轮有界专家审读完成；结论仍为 Candidate / conditional，未形成生产选择、设备验收或用户接受。

## 实际时间、参与和范围

- 首个实际洛杉矶时钟：2026-09-13 03:01:59 PDT（UTC−07:00，2026-09-13T10:01:59Z）；位于02:00—04:00窗口。
- 问题选择、两份独立首答、各一次分歧批评、固定源码/规范核对及主持收束截止：03:06:09 PDT，共4分10秒。随后仅串行归档和回读；不凑30分钟。
- 主持：小妈（本接收任务）。
- 独立审读：/root/r58_precision_review_a、/root/r58_precision_review_b。两次 collaboration.spawn_agent 都显式指定 model=gpt-6-astra、reasoning_effort=high、fork_turns=none，工具实际返回两份首答；之后每位仅收到对方反例摘要并进行一次批评。没有第三位、低档替补或额外批评。
- 已知模型身份依据限于显式工具选择及实际结果；接口没有独立后端部署认证。相同模型、相同题干和共同来源不构成两份独立物理实证。
- 两位临时审读者不是 Mother。本轮没有 Mother 参会、生产派发、代码编写、资产制作、实验执行或 G: 文件读取。

## 会前读取、去重与主问题

实际读取协调分支最新HEAD e9536b7660b178bf811d77d74b60cca99d65634e（R58，2026-09-13T10:00:47Z）。递归树 truncated=false，未见本编号纪要。R58晚于02:30 Mother会当时读取的R46，因此是会后真实新增软件证据；不将旧SL003重新排队。

实际读取：
- [R58 Current Best View](https://github.com/haihao0307/guilin-dem-pipeline/blob/e9536b7660b178bf811d77d74b60cca99d65634e/docs/mother_coordination/kaopu_learning_flywheel_v1/CURRENT_BEST_VIEW_R58_GAUSSIAN_OUTPUT_BUFFER.md)
- [R58学习日志](https://github.com/haihao0307/guilin-dem-pipeline/blob/e9536b7660b178bf811d77d74b60cca99d65634e/docs/mother_coordination/kaopu_learning_flywheel_v1/LEARNING_LOG/2026-09-13_GAUSSIAN_OUTPUT_BUFFER_R58.md)
- [R58固定结果](https://github.com/haihao0307/guilin-dem-pipeline/blob/e9536b7660b178bf811d77d74b60cca99d65634e/docs/mother_coordination/kaopu_learning_flywheel_v1/PROBES/gaussian_three_output_buffer_result_r58.json)、runner、HTML probe、gate、source lock、queue overlay和Mother/tool路由
- [当夜Mother纪要](https://github.com/haihao0307/guilin-dem-pipeline/blob/69aa6d8a8a87ac6a42b6a3f2efd8eef72d0e69ff/docs/mother_coordination/kaopu_learning_flywheel_v1/MEETINGS/2026-09-13/MOTHER_0230_HB_PREP_SL003.md)

单一主问题：R58是否足以把r186默认HalfFloatType保留为“交付基线候选、FloatType只作诊断参考”，还是连候选偏好也应为Unknown？怎样写成不过度声称、可被反例推翻的最小合同？

## 两位审读一致后的结论

A与B并非真正二选一，须拆开“实验起点”和“交付适用性”：

- **可保留的操作安排：**不主动覆盖Three.js r186默认HalfFloat；先把它作为验证起点，Float作为同条件反事实对照。
- **仍为Unknown的判断：**HalfFloat是否适合真实GaussianSplat交付、是否比Float有更好质量—成本权衡、在WebGPU/硬件GPU/Safari/iPhone是否可用。
- **应修正的表述：**“尚无证据要求改默认”不等于“已有证据证明默认更适合交付”。“基线候选”只能表示验证顺序，不能表示质量、性能或交付优胜，也不能自动晋级生产。

R58的2048/4096字节只证明256像素RGBA内部目标读回的原始存储差异；它不证明整应用峰值显存、带宽、帧时或能耗减半。Float逐通道等于R55锁定源，也只说明这一探针对该源值的保留，不使Float成为物理、感知或真实资产真值。

## 新发现：R58只测到一次存储量化，没有测逐splat累积

R58 probe把R55已经在CPU侧完成的float32 premultiplied合成数组作为属性，使用 NoBlending 写入内部目标，再读回Half/Float。因此其maxAbs、RMSE及最终一码差只能约束这一夹具的一次写入/输出链，不能约束多splat透明混合的逐次量化误差。

主持实际核对固定Three.js r186源码：
- [Renderer.js](https://github.com/mrdoob/three.js/blob/148ef33ecb6d2502ff796d4554abd1549c95d519/src/renderers/common/Renderer.js) 默认 outputBufferType=HalfFloatType；需要输出变换时创建该类型的内部RenderTarget，并在 _renderScene 中把它设为实际场景渲染目标。
- [GaussianSplat.js](https://github.com/mrdoob/three.js/blob/148ef33ecb6d2502ff796d4554abd1549c95d519/examples/jsm/objects/GaussianSplat.js) 的材质 transparent=true、depthWrite=false，没有覆盖Material默认blending。
- [Material.js](https://github.com/mrdoob/three.js/blob/148ef33ecb6d2502ff796d4554abd1549c95d519/src/materials/Material.js) 默认NormalBlending，源/目标因子为SrcAlpha与OneMinusSrcAlpha。
- [WebGPUTextureUtils.js](https://github.com/mrdoob/three.js/blob/148ef33ecb6d2502ff796d4554abd1549c95d519/src/renderers/webgpu/utils/WebGPUTextureUtils.js) 把RGBA Half/Float映射为RGBA16Float/RGBA32Float。

这使“实际splat可能直接混合到Half附件”成为有源码支持的路径假说，比纯猜测更强；但仍不能仅凭源码断言每个后端的内部混合精度、每次写回舍入方式或扩展支持。Khronos的[WebGL EXT_color_buffer_half_float](https://registry.khronos.org/webgl/extensions/EXT_color_buffer_half_float/)证明RGBA16F可作渲染附件；[EXT_float_blend](https://registry.khronos.org/webgl/extensions/EXT_float_blend/)另显示浮点附件的混合能力有扩展/实现边界。规范支持能力分类，不是目标设备执行证据。

## 条件性最小反例

若每个透明贡献都按NormalBlending写回binary16，取一个可精确表示的目标颜色 c=0.96875，反复叠加白色、alpha=1/128：

    c_next = round16(c + (1-c)/128)

增量为2^-12；0.5至1区间binary16相邻间距为2^-11，结果恰在中点。c对应的有效整数1984为偶数，在round-to-nearest-even假设下舍回原值，形成固定点；未逐次舍入的理想值仍趋近1。

两位还核对了另一纸面例：c0=0.5、alpha=2^-12时，首步增量2^-13严格小于半个间距，逐步binary16会停在0.5，而理想递推4096次约0.81608。它不依赖中点规则，但很小的alpha是否能穿过实际splat路径必须另核。

两例都是数学压力例，不是r186缺陷实测。它们只反驳“单次写入误差界足以约束大量透明splat累积”。实际混合格式、舍入、排序、深度、alpha路径及后端能力不满足前提时，反例不适用。

## 最小决策合同

| 项目 | 当前合同 |
|---|---|
| 配置起点 | 固定r186；未完成目标域验证前不主动覆盖HalfFloat默认，但不据此批准交付 |
| 反事实 | 同一资产哈希、视图、排序、抗锯齿、颜色/色调、后端和设备，只改outputBufferType；核实实际分配格式与混合附件 |
| 数值证据 | 内部线性RGBA分别记录非有限数、范围、maxAbs、RMSE、误差分布及随重叠层数的变化 |
| 显示证据 | 最终图像另记码值/空间差异；内部误差与RGB8差异不得互相替代 |
| 阈值 | R58的0.0005与2码只作原夹具回归门；真实资产阈值须预先声明适用域，否则Unknown |
| 成本 | 记录目标占用、峰值显存、带宽/帧时/能耗；不从单次readback字节外推 |
| 已覆盖域 | Chromium/SwiftShader软件WebGL、固定预合成[0,1]夹具、一次写入、固定输出变换 |
| Unknown | 实际splat累积、WebGPU数值、硬件GPU、Safari/iPhone、真实SPZ/照片资产、感知与用户接受 |
| 推翻条件 | 在声明目标域，Half违反预先标准而配对Float通过，撤销该域Half起点；二者都失败不能自动转选Float |

必须拒绝：上游默认等于质量背书；1024/1024通道变化等于可见故障；最终最多一码等于不可见/已接受；Float等于夹具源便是物理真值；原夹具阈值是通用门；字节减半等于整机成本减半；WebGPU读回失败说明精度差；AI一致等于实证。

## 下一项最有区分力的验证

只推进一项：以确定性、低alpha、高重叠的最小SPZ走实际r186 SPZLoader/GaussianSplat路径，在一个明确后端上成对切换Half/Float。固定资产哈希、视图、排序、抗锯齿和输出设置；先确认实际混合附件/格式，再读取内部线性目标并保存最终画面，观察误差是否随重叠层数增长或停滞。

这比再次把预合成结果一次写入目标更能区分“末端存储量化”与“splat累积放大”。软件环境通过只增加一条软件证据；硬件设备、真实照片和用户视觉仍需分别验收。若无法取得有效内部读回，记录该层Unknown，不拿截图反推内部机制。

## 状态账本与边界

- Observation：r186默认、内部目标选择、GaussianSplat透明材质、Material默认混合；R58固定软件WebGL读回及一次写入差异。
- Candidate / Current Best View修正：HalfFloat是默认验证起点；真实交付选择Unknown。高重叠压力例和合同是待执行方法。
- Rejected：把默认、单次夹具、最终一码差或AI一致解释为交付通过。
- Unknown：实际累积量化、设备成本/兼容、真实资产/感知/人工验收。
- Frozen：Canonical Truth、用户冻结、Object DNA/生产目标、旧工具禁令及固定版本公网规则全部不变。
- Mother采用：无。本轮不广播、不要求回签、不修改R58现有路由或任何生产分支。
- 接续触发点：最小SPZ成对实验产生可复查的内部目标和层数梯度结果，或明确记录目标后端无法观测；在此之前不重复问相同专家。

归档方式：只向协调分支追加本唯一纪要；写前HEAD仍为e9536b7660b178bf811d77d74b60cca99d65634e。提交后固定版本回读；不修改CURRENT、队列、旧纪要、计划或飞轮。
