# 头发模块整合性能只读审计

核验日期：2026-10-20。此文件是源码、已存证据及规模核算；没有把源码核算写成新跑出的多人 FPS。

## 版本判断

- **当前结构工作线**：`codex/hair-structure-lab-r01-20261016@2175d53de12a44dbedb989d3e8b34837f6315dcb`，目录 `kaopu-hair-workbench/foundation/structure-r01`。`review/STATUS.json` 明确 S1.B4.1/R13、`firstRoundAccepted:false`、`phaseTwo:"locked"`。`review/DELIVERY-R13.json` 表明本地局部完成、B4/S1 未通过、公开网络 120 秒未就绪。当前 165 条完整 Guide、每条 97 点；当前发型 2737 个启用根不是最终显示发丝数。**本轮不能擅自为这条最新结构解锁物理。**
- **可作为真实密发与物理压力对照的既有版本**：`codex/hair-f13-fiber-motion-20261016@64cd31324f1a7c4762c21531fe5559b14face2fe`，目录 `kaopu-hair-workbench/foundation/f13`。已接完整 P01、F12 默认参考发型与原生行走/跑步/跳跃，并接 43 导向 XPBD。仍是美术审核候选；不能称最新结构已接受，更不能称所有显示丝有独立物理。
- F13 原始不可变公开入口：[F13](https://htmlpreview.github.io/?https://raw.githubusercontent.com/haihao0307/guilin-dem-pipeline/d518667b34131b3b0720896bb3c53712a81cb291/kaopu-hair-workbench/foundation/f13/public.html)。小加载器 `f13/public.html` 3757 bytes，SHA256 `d27160db8057f6d6a22bc0565ef4c03da995cfc54bd5cb1f8b2ecb2f458daaaf`。
- `f13/preview.html` 为从 12 个原分片验证并解压的原始运行页：8590615 bytes，SHA256 `cfe4f39708d1212ba768f9af31a3253a27f9988ab2f7f52f9e0ca55fdc72f790`。主工作树和原公开页没有修改。
- 更旧的 `research/fiber-r05` 是局部材料/弯曲研究。它的 13 秒软件渲染帧不能代表 F13，也不能用其历史数据和当前测试相除。

## F13 默认真实规模

默认 `hairDensity:180`，不是极端档；用户可调区间为 80–260 根/cm²（工程参数，非生物标定）。P01 默认 114171 根 × 49 点，由 43 个原生源区子束分配。`f12/src/GuideKernel.mjs DEFAULT`、`f13/BUILD_MANIFEST.json` 与 `f13/evidence/public-verification.json` 三处一致。

| 项目 | 单人规模 | 依据 |
|---|---:|---|
| 显示发丝/中心点 | 114171 / 5594379 | F13 `PlannedFiberView` 读取 F12 完整路径 |
| 每次头发绘制的有效顶点实例 | 11188758 | 49 点×双边条带×发数；实际顶点着色器调用数可能受 GPU 重用影响 |
| 每次头发绘制的三角形 | 10960416 | 每根48段×2；并非显存内存放这么多独立静态顶点 |
| 路径纹理 | 89522176 bytes | 2048×2732 RGBA32F；已存浏览器报告确认 |
| 每实例属性 | 5936892 bytes | 发ID、束ID、三角ID、重心、trait、debugColor |
| 物理导向/节点 | 43 / 1075 | `vendor/fiber/Groom.mjs` |
| 固定节点/长度约束/弯曲三元组 | 86 / 1032 / 989 | 每导向前2点固定、24长度、23弯曲三元组 |
| 每步显示形变上传 | 17200 bytes | 43×25 RGBA32F，不是重传完整路径 |

2/4/8/16 人的精确线性规模核算见 `SOURCE_LOCK.json`。它不含遮挡优化、驱动成本、皮肤通道、阴影、衣服、世界，更不推算 FPS。

F12 检查表示仍保留：位置67132548、局部偏移67132548、颜色16783137、弧长22377516、线段索引43841664 bytes，合计 **217267413 bytes** 的这些数组。这是按 `f12/src/StrandView.mjs` 分配式核算的 CPU 数组，既非总内存也非全是同时驻留的 GPU 缓冲。F13 已把源线隐藏，但这不会自动释放这些检查用数组。整合运行台有机会保留全部显示丝而避免携带这套检查器表示。

## 已实现的逐帧路径与瓶颈

1. `NativeMotion` 保留完整原生权重、细分祖先与姿态；`NativePoseCache.update(version)` 把同一人物同一姿态结果供头发原生根读取。不得让衣服、鞋和头发各自推进一次同一个动作时钟。
2. `PhotoDynamics` 从每子束一条真实路径按弧长重采样25点，调用 `StrandDynamics`。构造时执行160步中性settle，需把启动/首次动作成本与稳定帧分开。
3. `GuideDynamics.step` 在 CPU JS 上运行积分、身体代理sweep、弯曲、长度、链接触、导向摩擦。默认两轮 bending/contact/length，链接触每节点最多12次和失败候选方向搜索；接触密集/剧烈运动成本会变。不能仅按“1075节点不多”判定便宜。
4. `BundleFriction` 使用8mm格子的空间哈希、4.5mm束接触半径、最多4邻居命中、每6步或无pair时重建。这是导向束摩擦，不是114171根发丝自碰撞，也没有跨NPC碰撞。
5. `PhotoDynamics.write` 将相对中性平衡的位移按原styling权重及主发35mm/刘海8mm平滑包络写入变形纹理。`PlannedFiberView` 顶点着色器读取原路径、原生三角根架和插值形变，显示丝仍全部绘制。
6. `HairPassCache` 缓存一次头发透过率，给三个皮肤通道复用；源码已有 `Set` 容纳多个头发对象。但构造函数直接包装 `viewer.renderer.render`，**一个 renderer 不能为每 NPC 盲装一套包装**。需要同一场景共用缓存与pass管理，或明确隔离通道。
7. `PlannedFiberView.mesh.frustumCulled=false`，现有单人工作台没有多人可见性调度。每实例的根架/路径/透射在这个旧候选仍很重，不能指望单个 instanced draw 自动降低顶点与过绘制成本。

`advance(seconds)` 累积满1/60后只推进一次，步长可达0.1秒；低渲染FPS时步频减少。对照必须固定相同1/60步数，报告物理时间、wall时间和丢弃/接受时间，不能把物理更新更少计为等精度优化。原代码已有静止sleep；持续运动或风会保持活跃。

## 最新结构的实际阻碍

`structure-r01/docs/MERGED-SYSTEM.md`（已只读获取）明确：当前无驱动该结构的完整物理/密集渲染后端，F14适配只支持旧F14对象；当前97点/可变Guide数不能只改旧固定96×25或F13 43×25常数。它仅合入无副作用时钟控制器、结构输入和门禁，未创建旧Groom。文档也记录来源总体压力门槛未通过，旧HairPassCache经验smoothstep不构成真实覆盖模型。

因此可以立刻做F13的既有密发压力对照，但“最新结构 + 最新衣物鞋 + 大量NPC全部物理”是尚未组装且部分后端未实现的目标，不能直接开开关测试得到。

## 同质量整合优先项

- **共享不可变资产**：同款发型共用路径纹理、拓扑和trait，保留各人物姿态/变形纹理；这是资产复用，仍是全部发丝。体型/头部形变、根架与材质会影响可共享范围，需版本键。
- **生产角色与工作台检查器分离**：运行时保留权威发型数据和渲染所需数据，按需创建F12检查线/颜色/局部偏移等检查表示；无需牺牲显示发量。
- **统一每角色姿态与接触输入**：每个tick一次最终pose，头发/衣服/鞋读取同一结果；在相同接触模型的合法条件下复用按pose版本失效的身体查询。发丝毫米接触和布料接触半径不能混用。
- **按需计算预算**：先精确共享/消除重复，再讨论基于屏幕投影、运动、接触和交互优先级的连续更新预算；保持角色时钟与物理积分一致，禁止低步数假装同精度。

## 原生接入接口

F12数据输入见 `f12/src/NativeApp.mjs capture()`：`positions` 为viewer前`model.vertexCount`顶点，`triangles=model.faces`，`chart=model.gnm`中的template/triangles/componentId/landmarks，另有gnmRecipes/bodyCount/topology/adapter。验证硬锁为25417顶点、50624三角、原生topology和adapter指纹。

生成顺序：`verifyNativeInput` → `buildNativeSurface` → `projectDomain` → `GuideBuilder.build(validate(DEFAULT))` → `splitRootPatches` → `buildBundleVolumes` → `populationBudget` → `buildDenseStrands` → `createStrandView` → `PlannedFiberView(api,viewer)` → `NativeMotion(model,viewer)` → `PhotoDynamics(fibers,motion,viewer,model)`。生成器来自原文件，不要用球头或任意假曲线替代。

最短真实浏览器探针可以在原F13加载器完成原SHA验证之后，为源字串中的唯一 `window.hairF13={report:ic,` 增加getter：`window.hairF13={_raw:()=>({viewer:f2,model:ys,fibers:u8,motion:I1,dynamics:M1}),report:ic,`。这些minified变量来自已核对固定运行页，只适用于此SHA；应断言只命中一次。再添加DOM输出探针供隔离浏览器读取。测试页应保留原runtimeSHA与probeSHA，明确为插桩版本。

文件位置：`f13/public.html`小加载器；`f13/preview.html`原始完整运行页；`f13/src`和`f13/vendor`核心运行；`f12/src`完整原生发型生成器；`SOURCE_LOCK.json`记录81份下载源码/证据的Git blob SHA与SHA256。外部模型首次加载仍须原固定资源；本地预览文件不是无需资产的离线成品。
