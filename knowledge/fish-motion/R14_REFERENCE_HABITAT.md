# R14 指定参考海底与光影迁移

任务 `FISH_R14_DENSE_REFERENCE_HABITAT_UI_20261001`，冻结入口 `local-r14/TASK_ANCHOR.json`。
本工位只负责海底场景、光学、同一 GPU context 接口；不拥有鱼体、鱼群算法、UI 或发布批准权。
`TASK_MODE=REPLICATION_LOCKED`，`CREATIVE_AUTHORIZATION=FALSE`。依据用户明确要求保留指定参考场景的全部组件、生成关系、段数及光影节点；没有以 generic 海底、截图背景或生成图片替代场景。

## 当前证据及来源

- 用户指定：[深海鱼群参考站](https://threejs-fish.vercel.app/)。2026-10-01T10:30:38Z 后重新以 full headless Chromium、NVIDIA WebGPU 实际观察；6144 条鱼，HTTP 200，页面无错误，记录 `local-r14/evidence/reference/REFERENCE_OBSERVATION.json`。GPU 未占用桌面鼠标。
- 实际 bundle：[index-jJp4j2KC.js](https://threejs-fish.vercel.app/assets/index-jJp4j2KC.js)，963870 字节，SHA256 `c79bcfb74e60ef79f77c2b1e038f674e36fcc3828a24ee2ccfd1126d081acc41`。
- 确定源仓库：[imokya/threejs-fish](https://github.com/imokya/threejs-fish)，其 homepage 与用户网址完全相同，`src/panel.js` 存储键与 served bundle 唯一匹配。
- 冻结源码版本 `971b500f467e8fddfb9ec54b9a143b2a8b09e7fc`：[environment.js](https://github.com/imokya/threejs-fish/blob/971b500f467e8fddfb9ec54b9a143b2a8b09e7fc/src/environment.js)、[ocean.js](https://github.com/imokya/threejs-fish/blob/971b500f467e8fddfb9ec54b9a143b2a8b09e7fc/src/ocean.js)、[post.js](https://github.com/imokya/threejs-fish/blob/971b500f467e8fddfb9ec54b9a143b2a8b09e7fc/src/post.js)、[main.js](https://github.com/imokya/threejs-fish/blob/971b500f467e8fddfb9ec54b9a143b2a8b09e7fc/src/main.js)。用于确认生成函数、源坐标、原灯光与后期关系；原参考文本与 QA 像素保留于忽略目录，不作为鱼体几何基线。

## 一比一范围及明确差异

一比一指原程序化环境的组件、几何拓扑、实例生成 seed、布局、材质/光学及后期数学关系保持；没有丢组件或降低数量、段数、海床分辨率。生产文件包含 MIT Three.js runtime、官方 MIT BloomNode 与本项目独立书写的数学节点；原站鱼、boids、面板、事件、电影化相机和初始化应用代码全部剥离。原应用源码只用于测量核对，留在忽略的研究证据目录。

只有一个明确统一尺度变换：`physical = reference * 0.1`。环境生成继续在原坐标里运行，通过相机 view/projection 转换与项目的物理鱼体共用同一个颜色/深度 FBO；不是另一个 Canvas 背景。

已测 32 个 geometry 对象的 positions、normals、index 与海草 instanceMatrix，参考 WebGPU 与迁移 WebGL2 的 Float32/Uint32 数组 SHA256 全部相同；8 个气泡源点相同。测试记录 `HABITAT_COMPARISON.json`。该证据证明环境生成一致，不等于画面逐像素一致。

明确允许/记录的差异：本项目保留 30 条完整来源大鱼及 KFE1 眼睛；原站采用 WebGPU，本项目采用同版本 Three.js/TSL 的 WebGL2 backend 以与原鱼 renderer 共用 context；固定观察相机服务于本项目密群与 UI，不能把相机取景差异宣称为原站全部镜头完全一致。鱼体外观、PBR 细节与原小鱼不同，未以原小鱼材质替换现有模型。

## 场景覆盖账

| 系统 | served 函数 | 原值/关系 | R14 |
| --- | --- | --- | --- |
| 海床 | `Yd/aI` → `Cpu.height/seabed` | 1000×1000；400×400 subdivisions；`In=-22`；5 octave value-noise 高度、正弦沙纹、半径55..190抬升14；重新计算 normals | 独立函数生成同样160801顶点、960000索引 |
| 岩石 | `oI` → `rocks` | seed7；26 个 Icosahedron detail4；每个4500 position scalars/1500非索引顶点；顶点同源 value-noise；r14..69、分量 scale 与 Euler | 全部26、顶点与布局保留 |
| 海草 | `lI` → `kelp` | seed42；14簇 r26..71；220 instances；plane 1×1 / 1×24 subdivisions；50顶点、144索引；source height7..29；顶部局部二次权重正弦摇摆 | 数量、instanceMatrix、24段和摆动关系全保留 |
| 海面 | `uI` → `surface` | 1400×1400；高度26；7组波法线＋两层 MaterialX noise；斯涅尔窗、全反射海床、太阳高光 | 独立完整数学节点、真实海面几何 |
| 海洋雪 | `cI` → `marineSnow` | 7000 sprites；camera周围60立方环绕；同源hash种子、洋流漂移、指针ray局部移位；深度/前向光衰减 | 全部7000、动画与指针光学接口保留 |
| 气泡 | `dI/hI` → `bubbleMaterial/bubbles` | seed99；8个海床源点；6×9批次/源点＝432 sprites；上升、漂移、周期、气泡边缘和高光函数 | 全部432、源点/材质/时序保留 |
| 水体背景 | `pI/dy` → `backdrop/waterRadiance` | 半径900内侧 sphere，48×24 segments，跟随camera；方向散射色 | 真实节点与几何保留 |
| 环境反射 | `fI` → `reflectionScene` | 程序天空球50、64×32；PMREM fromScene blur .04；environmentIntensity1.25 | 同样程序天空与PMREM参数 |
| 灯光/阴影 | `main` | 太阳色15400191、强度5×云层包络；太阳55°仰角；半球色10476778/732214、.35；2048² PCF shadow、范围±60、near1/far160、bias-.0004、normalBias.03、intensity.35 | 原参数保留；鱼与环境共用真实shadow/depth |
| 体积光 | `vI/DU` → `assemblePipeline` | 26步、最大source120；Henyey-Greenstein g=.5；动态光柱、shadow比较；.5 resolutionScale | 独立节点保持26步与全部关系 |
| 后期 | `vI/TI` → `assemblePipeline` + 官方 BloomNode | bloom5层，kernels6/10/14/18/22，strength.5、radius.85、threshold.95；折射扭曲、dream1调色、暗角、ACES输出 | 独立关系与官方MIT算法，层数保留 |

初次粗读时误把岩石/海草数量描述为80/1400及体积光96步；随后逐函数读实际 source 确认为26/220/26。本表和机器 receipt 使用已确认值，不能沿用粗读描述。

## 坐标与光学接口

生产实现 `local-r14/src/environment.js` 暴露 `globalThis.KaopuHabitat`。

```js
const habitat = await KaopuHabitat.create(gl);
habitat.render(matrices, timeSeconds, schoolCenter, (fishMatrices, pass) => {
  // pass.shadowPass、pass.viewport、pass.sunDirection、pass.sunIntensity
  // 只在当前 FBO 绘制完整鱼；不能 clear FBO/depth，不能强制屏幕 viewport。
}, pointerRay);
```

原海面 source26 → physical2.6；海床基准 source−22 → physical−2.2，高度仍使用 `Yd` 真值。整个生成环境只有同一 0.1 均匀尺度；不能为摄像机方便单独抬/压海床、植物或岩石。

相机 source near/far 对应原 `.1/2000`，项目 `.01/200`；原透视 FOV62°。当鱼 shader 用物理位置时，wrapper 由同一个 source 相机产生物理 view/projection/mvp，depth 归一化关系相同。保持 API 输入和回调转换的一致性；禁止重新猜 yaw/pitch 矩阵。

原光学为线性颜色空间：`hy=(.048,.017,.012)`、`FU=(.04,.014,.01)`，密度1；红光更快消失。水下光程必须使用 `physicalPosition/.1` 和 `physicalEye/.1`，不能把原消光系数直接乘物理米后造成10倍偏差。

`KaopuHabitat.OPTICS_GLSL` 包含由原TSL实际编译的 MaterialX Perlin/Jenkins-hash noise以及原 `Mr/dy/Ic/LU/Xd/py/GU` 的关系。鱼 albedo 使用同源半强度太阳衰减和背部焦散，输出 linear lighting 再执行方向雾；原后期统一完成 ACES/色调/sRGB。不能在自有 fragment 里先做 sRGB 输出再被原后期二次处理。KFE1 眼睛形体、虹膜函数、运动控制仍由原鱼工位持有，只添加同一水体光路。

主 scenePass 的颜色只有 location0，并有独立真实 depth texture；不是 normal MRT。原 shadow 使用 `sampler2DShadow` 深度比较，不需要 packDepthToRGBA。正常 fragment 深度写入即可；原 opaque shadow color 为黑色、alpha1。

## 互操作根因与回归

完整 Three renderer 的 `backend.finishRender(context)` 前插入自有鱼 draw，分别命中主相机和原方向灯 shadowCamera；因此海底真实深度遮挡鱼，鱼深度可遮挡后续后期光柱与雾，不是两个独立画布叠层。

第一次共用 renderer 暴露 `GL_INVALID_OPERATION (1282)`。逐 GL method 包裹确认首错为 Three `state.drawBuffers → _setFramebuffer`，不是鱼 mesh 绘制或 blitFramebuffer。根因为 full `resetState()` 清掉 per-framebuffer `currentDrawbuffers` WeakMap，而 `_setFramebuffer` 对已存在FBO会在bind之前调用drawBuffers；加上raw gl.viewport恢复造成真实2048阴影viewport与cache1440不一致。

已用 `resetInteropState` 精确修复：保留 per-FBO drawBuffer cache，完整清掉鱼改动的 program/texture/VAO/depth/blend缓存，然后通过 `state.bindFramebuffer(FRAMEBUFFER,draw)`、`state.bindFramebuffer(READ_FRAMEBUFFER,read)`、`state.viewport` 同步恢复真实 GL 状态与cache。未改原场景材质/密度/后期以掩盖错误。每次外部RAF绘制还显式更新 `nodeFrame`，避免摄像机/时间uniform沿用旧frame cache。

2026-10-01后台 probe：7帧环境、6轮main+shadow模拟callbacks，逐轮GL error均0；每轮shadow viewport2048²、main1440×1000，无console/page error。证据 `HABITAT_PROBE_REPORT.json`。完整30鱼集成和独立QA由assembly/verifier门禁执行，工位probe不代替独立批准。

## 来源与许可证事实

最终生产包只包含 Three.js 0.186.1 runtime 与官方 BloomNode 的 MIT 库代码，保留 Three.js版权/SPDX notice，并加入完整 MIT 许可文本。[Three.js官方LICENSE](https://github.com/mrdoob/three.js/blob/dev/LICENSE)、[r186 官方 BloomNode](https://github.com/mrdoob/three.js/blob/r186/examples/jsm/tsl/display/BloomNode.js)用于许可与算法溯源。原 bundle 中的 lil-gui 与原站面板已经删除，未作为生产依赖。

原参考应用仓库 `imokya/threejs-fish` 的GitHub API `license:null`、冻结root无LICENSE文件、package没有应用license字段。原应用程序的再分发许可为 `UNKNOWN`；不能将底层runtime MIT推断为整个应用自动MIT，也不能说已获得原作者单独许可。因此不在正式包中直接保留该应用表达式：海底、海水与后期关系已按测量结果独立书写为 `Cpu`、`waterRadiance/solarTransmission/projectToSurface`、`cloudField/focusedCaustic`、`submergedFog`、`seabed/rocks/kelp/surface/marineSnow/bubbles/backdrop/reflectionScene`、`assembleHabitat/assemblePipeline`。数学关系、种子与拓扑依然逐项核对；原源文件留在忽略的研究证据中。

## 最终模块冻结收据

生产模块 `local-r14/src/environment.js`：937741 字节，SHA256 `0b961ede35da2e20a8d8774235ada71d7eb1037a16793e0570c57e5ae27c8ae0`。完整移除原应用后的复验于 2026-10-01T11:10:27Z 完成：32 个几何对象的四类数组哈希全部相等，8 个气泡源点相等；原参考 WebGPU 与本地 WebGL2 在同镜头、source 时刻4、exposure .9 渲染。实际新截图 `reference-fixed-no-fish.png` 与 `candidate-fixed-no-fish.png` 已检查，保留后端差异，不声称逐像素一致。

同次生产源码探针：48 个 shader，7 帧环境、6 轮主/阴影回调，GL error 六次均0，阴影/主 viewport 分别2048²和1440×1000。机械收据 `local-r14/evidence/reference/HABITAT_RECONSTRUCTION_RECEIPT.json` 将最终 SHA 与这两份报告绑定。完整30鱼、公网、移动端和独立门禁仍由 assembly/verifier 负责。

## 真实三维/交付门禁

- [x] 没有用生成图片代替真实三维实现。
- [x] 已实际修改海底生产源码。
- [x] 画面来自完整实时三维环境运行时。
- [x] 由同一gl context执行环境、鱼、shadow、postprocess，核心无CDN/外部场景资产。
- [x] 整体工作台已部署；HTTP200逐字节回读与desktop/mobile真实浏览器由assembly实际验证，最终交付见 PUBLICATION_PROOF.json。
- [x] 只有截图而没有工作台时必须判定失败。

人工 `visualAcceptance/motionAcceptance/productionReady` 均保持false。本工位证据不能自行批准整个R14，也不构成鱼品种生物尺度或真实海洋流体求解认证。
