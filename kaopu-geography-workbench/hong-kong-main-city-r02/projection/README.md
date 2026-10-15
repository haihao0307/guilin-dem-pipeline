# 统一 150 km 投影候选：只读审计与精确补丁

状态：CPU 数学/原码校验通过；GPU、完整主图、发布均未执行。所有产物都在本 `projection/` 目录。未改冻结 `hong-kong-main-city-r01`、R03、外围源文件；未上传、发布或启动 CI。

## 最新接入结论：采用单帧动态 near 方案

按父任务后续明确策略，新增可直接运行的动态方案；下面原固定 `.15` 部分保留为基线/风险证据，不是下一版应单独采用的发布方案。

- `dynamic-patch-plan.mjs` / `patchDynamicVerified(key, originalBytes)`：直接作用于同一批原始 SHA 输入，七源精确计数、逆向恢复通过。不能先跑 static plan 再跑 dynamic plan。
- `shared-projection.mjs` / `installSharedProjection(window)`：在新入口 `document.write` 前安装。每帧 `cameraData` 只创建一次冻结的 c，所有层共享 `c.clipNear` / `c.clipFar`。
- 策略严格为：map 模式 `near=clamp(mapState.distance*.02,.15,3000)`；非 map 模式固定 `.15`；所有模式 `far=150000`。例如 map 2 km 的 near=40 m，不是 .15；follow/platform 的 near 始终 .15。
- 原 R03 `cameraData` 字面锚点保留；包装器接在它之后。现有 `base-host-patches.json` 仍按原顺序应用。动态 R03 必须先 patch，再执行既有 host 注入。
- 原始海洋、地形/路线、植被、站模型，以及机场、城市、外围七个 vertex shaders 改为 `uniform float clipNear,clipFar`。每帧 common、机场、city、outer 都上传同一个 c 的字段。
- Three 的 `getState().render.clipNear/clipFar/clipProjectionMatrix` 取自实际 p 相机/矩阵，独立于 G 字段，可供本帧 QA 交叉核验。Three 在每次 U(G...) 中先 `p.near=G.clipNear; p.far=G.clipFar`，随后原 `updateProjectionMatrix()`。两处 culling 使用同 c 字段。不存在只更新 Three 的一帧窗口。
- `bundle-loader.mjs` / `loadSharedProjectionIntegration({bundleURL,assetBaseURL})` 复用已发布 bundle，应用动态 plan 后 Blob import；旧 `load150kmIntegration` 默认仍是静态基线，下一版请选择前者。

动态核验命令：

    node research/hk-main-map-next-r02/projection/apply-dynamic.mjs
    node research/hk-main-map-next-r02/projection/verify-dynamic-cpu.mjs

`--published-layout` 规则与静态版相同。`apply-dynamic.mjs --write` 可输出至 `projection/generated-dynamic/`，不改任何来源。当前只执行过审计，未生成整份 R03 副本或发布。

验核文件为 `DYNAMIC-PATCH-AUDIT.json`、`DYNAMIC-CPU-RESULTS.json`。18 个现有 host/机场接入锚点全部精确回放；组装后 5 段 inline script 均语法通过；8 个模式/距离策略及原 camera 对象不被修改通过；机场/city/outer 三个补丁 module 语法通过；全景按钮真实 helper 的动态 QA 字段与 cancel smoke test 通过；ocean runtime 字符串替换仍只产生一组 clip uniform。真实 Three 对动态 raw 公式最大 NDC 差为 `5.7454e-13`。

全景1920×1080 near=1318.9203 m；1080×1080 near=1580.2438 m；390×844 near=2806.1404 m；360×800 near=2879.6812 m；375×812 near=2807.6977 m。所有全域角点在本轮非 FMA Float32 + D24 诊断模型中均不再落到 clearDepth=1。这仍不是 GPU 实测；`gpuStatus` 保持 NOT RUN。

`gpu-check.html` 现在比较动态 uniform 路径：固定 .15 基线、仅测试的10/100候选、实际动态策略的三个全景/火车近景/map 2 km。同一页结果 `dynamicPolicyPassed` 单独汇总动态策略；固定 .15 基线在竖屏失败不会被隐藏。实际 shader 的 uniform 算术会与字面常量折叠稍有差异，这正是后续 GPU 必须跑的原因。仍固定 `sceneApproval:false`。

`source-layout.mjs` 同时支持 research 和发布布局。发布后从 `/repo/kaopu-geography-workbench/hong-kong-main-city-r02/projection/` 向 case 父目录定位 sibling r01 与 R03；GPU 页也使用同一 resolver，不再用固定三级上跳。原 outer renderer/spatial 的小型锁定快照在 `projection/source-fixtures/`，因此重放无需上传 research 父目录，也不会误把已改动态 runtime 当原始输入。两个快照 SHA 与原 source SHA 完全相同。

低岛修复验核：原 `.001 / cap100` 在390×844的9个全域合成采样上，海平面与+1m、+3m均是9/9理想D24量化相同。按父任务确认采用 `.02 / cap3000` 后，+1m差2–3 codes、+3m差7–8；横屏+1m差5、+3m差14–16。`verify-surface-depth.mjs` / `SURFACE-DEPTH-RESULTS.json` 保存完整实际差及非FMA诊断，明确是合成深度样本，不冒充已观测岛高。GPU比较器现在在D24 framebuffer同像素（保留原clip Z/W）先画海、再以LESS画+1/+3m，并分别测试raw和真实Three矩阵路径；结果尚未执行。

`installRegionOverview` 现在返回 `cancel()`。新toolbar切city/island/kowloon前调用它，防止resize又回全域；拖动/滚轮仍自动取消。`qa.fullRegionProjection.near`、`camera.near/clipNear`、`report.near`全部报告实际动态值，取消时active置false。

供 staging 接入时要留意：所有新增 runtime 必须一起接入；旧60 km模块不能混装。复用旧候选资产的 assetBase，不把旧索引/模块相对地址悄悄改到新目录。入口代码安装 helper 后，必须再让全部源图层使用动态补丁版本。初始全景应在旧 city 初始化自动 focus 后调用，避免它覆写全景。

## 可直接交给下一轮集成的接口

- `patch-plan.mjs`：`patchVerified(key, bytes)`，先验证完整 SHA256，再验证每个替换的精确出现次数，逆向重放必须恢复原输入 SHA。返回 `{text,inputSha256,outputSha256,replacements}`。拒绝未知版本和重复打补丁。
- `apply.mjs`：默认只读审计并写 `PATCH-AUDIT.json`；`--write` 才把候选文件写到 `projection/generated/`，永远不写源文件。
- `camera.mjs`：`fitRegion(aspect)` / `mapCamera(state)` / `cameraReport(...)`，提供固定基线近远裁面、FOV、EPSG:2326 原点与全域取景结果；动态单帧 near 由 shared-projection helper 覆盖。
- `camera.mjs`：`installRegionOverview(host, game, options)` 添加“全港含离岛”按钮；默认不自动改变初始视图。必须在旧 city 初始化/自动 focus 完成后调用。全景激活时随 viewport resize 重算；用户拖动、滚轮则取消自动重排。`supported` 仅表示理想 frustum 能容纳，`gpuVisibilityVerified` 始终为 false；不能把它直接当作 GPU 可见性保证。
- `bundle-loader.mjs`：`load150kmIntegration({bundleURL,assetBaseURL})` 复用现有、哈希锁定的 1.134 MB bundle，只替换唯一真实主相机，然后 Blob module import。先显式传旧候选资产的绝对目录 URL。错误时停止，不退回 60 km。
- `verify-cpu.mjs`：一键复算 SHA、替换、真实 Three CPU 矩阵、8 个全域角点和 320 个 manifest 块的包围盒。
- `verify-gpu.mjs` / `gpu-check.html`：只为后续已授权浏览器/CI 准备，当前未打开、未创建 WebGL context。结果入口 `window.__projectionGPUReady` 和 `window.__projectionGPUResult`。

本地复算：

    node research/hk-main-map-next-r02/projection/apply.mjs
    node research/hk-main-map-next-r02/projection/verify-cpu.mjs

后续仓库/CI 的顶层 R03 若已经是发布字节，两个命令均可加 `--published-layout`；仍严格要求同一个 SHA，不放宽版本保护。当前本地顶层 R03 是另一份未采用字节，故默认读取 `publish-final/index.html`。

生成预补丁文件的可选命令：

    node research/hk-main-map-next-r02/projection/apply.mjs --write

`generated/` 是待集成片段，不是完整独立网站。机场与 city 的原有相对 imports/资料依赖必须保留同目录布局或由集成者明确改为冻结版绝对 URL。不要直接改旧目录。R03 可在获取并校验既有源 HTML 后，调用 `patchVerified('r03', bytes)` 再应用现有 host 注入；原始源 SHA 保持不变。

## 最小受影响源

1. 固定 R03 HTML：海洋、地形、植被、站模型 4 处 `near=.15,far=60000.` → 150000；路线复用地形 vertex shader，不另改路线几何。另 1 处滚轮 distance 上限 60000 → 150000。
2. `integration-aligned.js`：仅 1 处 `new Mt(55,1,.15,6e4)` → `new Mt(55,1,.15,15e4)`。两处 `adhesiveMassKg:6e4` 原样保留。
3. `airport.mjs`：1 处裁面；把 shader 与比例尺的 `.520567` 改为同一 `Math.tan(55*Math.PI/360)` 输入。原近似值的相对误差为 -9.7109e-8；不改机场几何/terrain setup。
4. `city-buildings/runtime.mjs`：1 处裁面。
5. `city-buildings/spatial.mjs`：1 处 CPU culling far。
6. 新外围 `outer-terrain/renderer.mjs`：1 处裁面和 1 处 QA `farPlaneM`。原 `fullRegionSingleViewGuaranteed:false` 有意保留。
7. 新外围 `outer-terrain/spatial.mjs`：1 处 CPU culling far。

新增按钮/loader 是下一版 wrapper 的接入项，不需要改变任何 DEM、海洋算法、航线/铁路或旧案例。精确输入/输出 SHA 与替换清单见 `PATCH-AUDIT.json`。该计划总计 7 个 vertex projection sites、1 个 Three 主相机、2 个 CPU culling sites、1 个滚轮上限。

R03 锁定值：`54487b03d7314edb19ed3ed37aab47bb662c8633e05cf96fdef7d28ac10a4117`，本地位置 `hong-kong-map-sea-r03/publish-final/index.html`，14691672 bytes。本地顶层 `index.html` 的 `6b04ae…` 不是本轮来源，测试明确拒绝。

## Three / raw WebGL 投影一致性

所有世界坐标均为 `X=E-834000, Y=H, Z=827000-N`，单位米。视向 `fw` 指向场景；Three camera 的本地前向为负 Z。给定相同的 cam / fw / up，Three 的 view coordinate 为 `[dot(v,right),dot(v,up),-dot(v,fw)]`。

令 `z=dot(p-cam,fw)>0`、`t=tan(55°/2)`，raw shader 的 clip 是：

    [ dot(v,right)/(t*aspect), dot(v,up)/t,
      (far+near)/(far-near)*z - 2*far*near/(far-near), z ]

Three WebGLCoordinateSystem 的标准透视矩阵乘 `[x,y,-z,1]` 得到同式。无 logarithmic depth 或 reverse depth；也没有只给某一层单独改变 near/far 的方案。Three draw 仍使用相同 canvas aspect、position、up、lookAt、updateProjectionMatrix。

CPU 直接从已验哈希 bundle 临时导出其真实 `Mt` camera / `He` Matrix4（仅内存测试 module），没有用另一个版本的 Three 代替。5056 个点：最大 clip 绝对差 `3.7293648347e-7`，最大 NDC 差 `3.7545488940e-10`，通过 `2e-8` 门限。这个结果是双精度 CPU 结果；不能推导 GPU 浮点逐位相同。

## 一镜全域的数学结果

覆盖 E796320..869640、N795730..856720，保守高度 [-100,1500] m；实际外围 manifest 为 -14.4161..953.4283 m。全景 target `[-1020,700,775]`；pitch=-1.5；横屏选 yaw=0，较窄竖屏选 -π/2，把 61 km 短边放到屏宽。每个方向要求 `padding=1.08`，等价 `abs(NDC)<=0.925926`，即每侧至少约 3.70% viewport 边距。

| viewport | distance m | 8 角点深度 m | far 余量 m | 数学 frustum |
| --- | ---: | --- | ---: | --- |
| 1920×1080 | 65946.016 | 62990.889..68901.143 | 81098.857 | 全部通过 |
| 1440×1080 | 65946.016 | 62990.889..68901.143 | 81098.857 | 全部通过 |
| 1080×1080 | 79012.188 | 76057.061..81967.315 | 68032.685 | 全部通过 |
| 390×844 | 140307.018 | 136915.796..143698.240 | 6301.760 | 全部通过，GPU 深度风险 |
| 360×800 | 143984.062 | 140592.840..147375.284 | 2624.716 | 全部通过，GPU 深度风险 |
| 375×812 | 140384.885 | 136993.663..143776.107 | 6223.893 | 全部通过，GPU 深度风险 |
| 320×896 | 不采用 | 无法同时满足当前 padding / FOV / far | — | 显式失败 |

上述 7 个支持 viewport（还含 844×390）各验证全部 320 个 manifest 块的 2560 个角点。不会把裁掉离岛的取景宣称为全域。任意无限窄屏无法在固定 55° 与 150 km 内保证装入整个矩形；失败返回有 reason，状态不被部分覆盖。

## 必须保留的深度阻断项

near=.15，far=150000，标准 forward depth 的 far/near=1,000,000。假设常见 D24，深度步长的一阶近似为 `z²*(far-near)/(far*near*(2^24-1))`：

- 10 m：0.0000397 m；100 m：0.00397 m；1 km：0.397 m
- 10 km：39.7 m；30 km：357.6 m；60 km：1430.5 m
- 100 km：3973.6 m；140 km：约 7788.3 m；150 km：约 8940.7 m

far 单独从 60 km 改到 150 km 对同一距离的理想 D24 精度只恶化约 0.00015%；真正危险的是新增全景将可见地物拉到 60–147 km。这时遮挡薄层、地形/海面/建筑和共面覆盖会有数百米至数千米的深度分辨率。GLSL Float32 的大数加减、Three model-view 组合顺序、相机/世界坐标量化也能造成数个 LSB 的差异。

特别是竖屏远角点可能舍入到 windowDepth=1，与 clearDepth=1 相等，然后被既有 `LESS` 拒绝，哪怕 CPU 理想 frustum 在 far 内。一个“非 FMA Float32 系数 + D24 就近取整”的诊断模型，在 390×844 / 360×800 / 375×812 分别标记 2 / 4 / 2 个角点可能消失。这不是实测 GPU 证据，但足以阻止仅凭 CPU 宣称这些全景可发布。

后续 GPU 核验必须实际检查 clearDepth=1 / LESS 下每个角点是否存活。比较器已包含这一检查，失败会令总体 `passed=false`。若失败，应先讨论统一、同时应用于所有层的 overview near-plane 策略或全局 depth 方案；不能悄悄只改 Three，也不应靠 `LEQUAL` 掩盖全域精度丢失。初始基线严格保留 .15；收到父任务后续明确策略后，另加了上文动态方案，未改动该基线或源文件。

近景站台/火车/灯玻璃仍须实图对照。CPU 模型不能替代同帧共享深度的材料验收，也不能证明生产 default framebuffer 就是 D24。

## 后续 GPU 使用与判定

在已授权的正常浏览器/CI 环境把仓库 root 静态提供后，打开 `research/hk-main-map-next-r02/projection/gpu-check.html`。不需要新依赖。页面做一组基线/候选/动态策略的自身独立 WebGL2 context 测试，不使用/污染生产 map context。

结果包括：

1. 真实 bundle Three projection matrix 对比完全同式 raw GLSL 的 transform feedback，按 near 过滤、最多 90 个 camera-space 点。
2. 三个全景与火车近景世界坐标的 Float32 roundoff 诊断，报告像素差和 D24 LSB 差。
3. 显式 D24 framebuffer、两种绘制顺序、前后遮挡的 36 组 raster tests。
4. 每个世界点分别经过 raw / Three matrix path 后，强制居中但保留原 z/w，检查 clearDepth=1 / LESS 是否仍能画出来。
5. `sceneApproval:false` 固定保留。即使比较器通过，也仍需在完整下一版主图核验各真实 shader、实际 framebuffer、加载覆盖和材料。

浏览器环境/Blob/CSP 失败返回 ERROR/UNAVAILABLE，不伪报 PASS。当前 `CPU-RESULTS.json` 明确记录 GPU NOT RUN。没有本机反复启动 Chromium。

## Blob 宿主与依赖审计

已验哈希 bundle 无静态 imports、无 `import.meta`。唯一动态 import 为 `import(new URL("candidates/runtime.mjs",window.HK_TRAIN_ASSET_BASE))`，因此不依赖 Blob URL 相对解析。保留旧候选 asset base，旧 runtime.mjs 自己的相对 imports 仍以该真实文件 URL 解析。普通 Three loader 中有 fetch 函数定义，但未新增顶层相对资源加载。

Blob loader 只改唯一主相机；不额外暴露 Three 类（测试页面自己的内存 module 才追加测试 export）。CSP 可能拒绝 Blob import，届时使用 `apply.mjs --write` 的预补丁 bundle 并在下一版静态引用；loader 不进行未知 URL 自动回退，也不会把 60 km 原版当成功。保留原 license notice 和 `integration.js.LEGAL.txt`。

## 明确不在本补丁证明内

- 本投影子任务本身不扩展 ocean `hkBox` / mask；父集成可另做已授权的最小域扩展，不能把海域覆盖算作本投影测试已通过。
- 外围仍有 96 MiB 驻留预算/调度。frustum 包含一个 chunk 不等于它已载入并绘制，必须查全域 coverage 和缺块。
- UI 面板可能盖住地图。当前 padding 是完整 canvas frustum padding，不是扣除面板后的可用区域保证。
- 外围与旧内区接边、地形/海岸与楼的真实遮挡、实际 GPU 性能、全景 material 观感都没有在本轮运行。
