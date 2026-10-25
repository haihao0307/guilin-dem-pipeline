# KAOPU 程序化蕾丝 R03：接入契约与可运行适配器

## 本轮交付的边界

`dist/lace-core.js` 负责生成自有数学曲线，`dist/lace-adapter.js` 负责版本化配方、毫米纸样到厘米材料坐标的换算，以及把曲线实际映射到宿主表面。适配器可以直接作为 ES module 导入并执行。R03 新增交错底网；`dist/lace-fiber.js` 提供独立短毛羽，`dist/lace-sampling.js` 提供同姿态线性 HDR 空间采样。固定 38° 透视观察协议保持不变。

当前阶段为 `independent_tool_adapter`。它没有修改人物、裁缝或布料总台的现有入口，没有接入穿着碰撞、服装缝合、布料动力学或生产织造。所有绑定结果明确保留 `productionReady: false`、`wearingCollisionValidated: false`、`clothDynamicsImplemented: false`。一个漂亮的布样不等于可穿着成衣。

本轮已有 CPU 检查和原生 EGL 的真实几何覆盖、材质及短毛羽诊断。云端浏览器创建 WebGL context 仍失败；前轮用户浏览器进入独立认证域的动作被自动审批阻断，本轮不得重试或绕过。浏览器首帧、完整交互、最终参考质感及用户交付均未验收完成；原生 EGL 诊断不替代这些门槛。

参考对象为作者 Nyanneco 的 [Lace Generator 商店](https://booth.pm/ja/items/9005414)及[公开手册](https://note.com/nyanneco/n/n90de128aa178)。本工具学习其花型轮廓、内部织线、背景连接网、边带的组织方式；没有取得或声称还原其内部 SBS/SBSAR 图，也没有导入作者的 SVG、预设或生成器。本站花型由自己的函数生成。

## 1. 固定源码依据

以下是 2026-10-21 本轮只读核验的版本。不能仅按分支名称或 README 日期判断“最新”。

| 系统 | 固定提交与关键文件 | 相关事实 |
|---|---|---|
| 旧五材质与材料交换线 | `Human-Fabric-Workbench@f12c64d6f35e379414154d115f787b8d2748ecc6`，`dev/fabric` | 根 `index.html` 为五材质外观台；R6.2 支持材料包交换 |
| 原生毛衣/丝绸 | `Human-Fabric-Workbench@63bba29c74f70a2637203d97fdc6a84b4f1c9635`，`previews/raywave-fabric-r15` | 集合 R03 的 manifest 锁定此来源；真实纱线/针目系统需保留 |
| 布料集合 R03 源线 | `Human-Fabric-Workbench@7fad8b62fa0358718d74742f689d3c448429aa48`，`perf/fabric-r03-startup-20261014` | 有 `fabric-workbench/r03`；本轮读取的 `feature/reality-fabric-s3-private-20261018` 也指向同一提交 |
| 独立裁缝线 | `Human-Clothing-Workbench@071acbd71cff4c1e430e8230242de03b8a5ec3fb`，`dev/clothing` | `AGENTS.md` 的当前短裤规则比根 README 的旧短袖交接更新 |
| 公开集合 manifest | `guilin-dem-pipeline@a663e7e07e7794029422f85a80e5d500ead42a60`，`kaopu-fabric-workbench/collection/r03-3be635ad51dc/BUILD_MANIFEST.json` | 仅作为核验来源；共享 `gh-pages` 之后可能继续变化 |

可直接复核：

- [原有材料绑定契约](https://github.com/haihao0307/Human-Fabric-Workbench/blob/f12c64d6f35e379414154d115f787b8d2748ecc6/experiments/material-package-v1/packages/coarse/binding_contract.json)
- [原有 GLSL 接口](https://github.com/haihao0307/Human-Fabric-Workbench/blob/f12c64d6f35e379414154d115f787b8d2748ecc6/experiments/material-package-v1/packages/coarse/shader_interface.json)
- [裁缝当前构造规则](https://github.com/haihao0307/Human-Clothing-Workbench/blob/071acbd71cff4c1e430e8230242de03b8a5ec3fb/AGENTS.md)
- [集合 R03 源版本 manifest](https://github.com/haihao0307/guilin-dem-pipeline/blob/a663e7e07e7794029422f85a80e5d500ead42a60/kaopu-fabric-workbench/collection/r03-3be635ad51dc/BUILD_MANIFEST.json)
- [已有逐针换色与纱径函数](https://github.com/haihao0307/Human-Fabric-Workbench/blob/63bba29c74f70a2637203d97fdc6a84b4f1c9635/previews/raywave-fabric-r15/src/knit-design.mjs)

## 2. 单位和坐标：只在边界换算一次

| 数据 | 本工具约定 |
|---|---|
| 纸样输入 | 毫米；`patternMmToMaterialCm()` 明确乘 `0.1` |
| 花型平面坐标 | 厘米；中心原点，x 在 `[-widthCm/2, widthCm/2]`，y 在 `[-heightCm/2, heightCm/2]` |
| 曲线点 z | 厘米；乘 `reliefScale` 后沿宿主返回的法线增加结构层高度 |
| 线径控制 `outlineMm/netMm/fillMm` | 毫米直径，不是半径 |
| 路径 `radius` | 厘米半宽，直径毫米转此值须除 `20` |
| `flatten` | 法线方向半径 / 布面内半径；无量纲 |
| `reliefScale` | 结构层高度倍率；默认 `1`，有限数字且在 `(0, 2]` 内 |
| 映射后 `radiusWorld` | 宿主世界单位；等于 `radius * worldUnitsPerCm` |
| 宿主尺度 | 调用时必须传 `worldUnitsPerCm`，米制为 `0.01`，厘米制为 `1`，毫米制为 `10` |

材料坐标跟随裁片，不使用世界位置计算花型，否则人物走动时花型会在布面上滑动。`materialOriginCm` 与 `grainlineRadians` 只处理材料域的平移和方向；不缩放成衣，也不猜测尺寸。

## 3. 配方格式、确定性和失败处理

配方 schema 为 `kaopu.lace.recipe/1`，生成器为 `procedural-lace-r03`。纯生成器配方包含全部结构参数及固定 seed，不包含摄像机、灯光或动画瞬态。`revision` 为正整数。外层工作台 JSON 的外观与观察状态见第 9 节。

```js
import {
  createRecipe, serializeRecipe, parseRecipe,
  validateRecipe, generateFromRecipe,
} from './lace-adapter.js';

const recipe = createRecipe({
  style: 'botanical', widthCm: 18, heightCm: 22,
  repeatCm: 4.8, outlineMm: 0.32, netMm: 0.075,
  fillMm: 0.14, meshMm: 1.15, seed: 17, variation: 0.2,
});

const saved = serializeRecipe(recipe);       // 固定字段顺序
const restored = parseRecipe(saved);         // 严格校验，不执行其中的代码
console.assert(validateRecipe(restored).valid);
const curves = generateFromRecipe(restored); // 同参数、seed、版本得到同一曲线
```

适配器复用核心的 `normalizeLaceParams()` 作为支持范围的单一依据，但**保存/导入不静默截断**。当用户导入的值会被核心规范化为另一个值时，导入明确失败。数字字符串、NaN、Infinity、负 seed、小数 seed、未知字段、错误单位及不支持的版本同样失败。不得把这些值偷偷改成零或默认值再宣称恢复成功。

R01 / R02 配方只在对应历史工作台读取；R03 明确拒绝把旧配方按新算法静默改图。`kaopu.lace.recipe/1` 的 schema 名相同不代表生成器版本兼容。超出 250,000 段的组合抛出 LaceBudgetError，不自动稀疏图案。

R03 的尺寸范围是小布样观察范围，不是任意大服装生成器。扩大面料应由宿主按稳定材料坐标分块或裁片处理，不能无界扩张一个浏览器对象。

## 4. 毫米纸样输入

```js
import { recipeFromPatternMm, patternMmToMaterialCm } from './lace-adapter.js';

const recipe = recipeFromPatternMm(
  { widthMm: 180, heightMm: 220 },
  { style: 'botanical', seed: 17 },
);
const panelPointsCm = patternMmToMaterialCm([
  [-90, -110], [90, -110], [90, 110], [-90, 110],
]);
// panelPointsCm: [-9,-11], [9,-11], [9,11], [-9,11]
```

`recipeFromPatternMm()` 转换明确的矩形样布尺寸。它没有把任意复杂衣片简化成矩形，也没有完成实际裁边、缝份、对位标记或缝制。非矩形裁片的曲线裁切、跨接缝花型配准必须由后续裁缝接入层完成并验证。

## 5. 真正可执行的宿主表面映射

生成器输出：

```text
layers.net / outline / fill / trim -> 路径数组
每路径: points[[xCm,yCm,zCm],...], radiusCm, flatten, closed?, seed?
```

实际字段名是 `radius`；上面的 `radiusCm` 是单位说明。

以下代码把每个路径点和线半径映射到米制宿主，无须 Three.js 或其他运行依赖：

```js
import {
  createRecipe, generateFromRecipe,
  createPlanarSurface, bindLaceToSurface,
} from './lace-adapter.js';

const curves = generateFromRecipe(createRecipe({ seed: 17 }));
const worldUnitsPerCm = 0.01; // 宿主世界单位为米
const surface = createPlanarSurface({
  originWorld: [0, 1.2, 0],
  uDirection: [1, 0, 0], vDirection: [0, 1, 0],
  worldUnitsPerCm,
});
const bound = bindLaceToSurface(curves, surface, {
  worldUnitsPerCm,
  panelId: 'specimen-front', side: 'front',
  materialOriginCm: [0, 0], grainlineRadians: 0,
  normalOffsetMm: 0, reliefScale: 1,
});
console.log(bound.layers.outline[0].points[0]);
console.log(bound.layers.outline[0].radiusWorld);
console.assert(bound.productionReady === false);
```

自定义宿主回调签名：

```js
surface(materialCoordCm, panelId, side)
// -> { position: [worldX,worldY,worldZ], normal: [nx,ny,nz] }
```

回调必须返回**所选面的朝外法线**。适配器归一化该法线，不重复翻面，并使用：

```text
worldPoint = hostPosition
           + hostSideNormal * (curveZcm * reliefScale + normalOffsetMm / 10)
                            * worldUnitsPerCm
```

`reliefScale` 只乘曲线的 z 高度；`normalOffsetMm` 在其后独立增加，不被这一倍率放大。材料 x/y、`radiusWorld` 和路径原始 `flatten` 都不会由绑定函数随之缩放。返回结果包含实际 `reliefScale`，宿主应连同单位、裁片和正反面保存，不能把它解释为物理拉伸或碰撞间隙。

R03 工作台使用 `reliefScale = appearance.flatten / 0.55`，并把同一 `appearance.flatten` 传给主线扫掠与毛羽构造；显示截面法线半径为 `radiusWorld * path.flatten * appearance.flatten / 0.55`。这样结构层高度与截面厚度采用同一倍率。其他宿主若采用不同的截面控制，应明确选择高度倍率，避免只压扁截面而保留过高的交点，或重复缩放 z。

例如：

```js
const bentSpecimen = ([uCm, vCm], panelId, side) => {
  const radiusCm = 24;
  const a = uCm / radiusCm;
  const sign = side === 'back' ? -1 : 1;
  return {
    position: [
      radiusCm * Math.sin(a) * 0.01,
      vCm * 0.01,
      radiusCm * (1 - Math.cos(a)) * 0.01,
    ],
    normal: [-Math.sin(a) * sign, 0, Math.cos(a) * sign],
  };
};
const curvedDisplay = bindLaceToSurface(curves, bentSpecimen, {
  worldUnitsPerCm: 0.01, panelId: 'bent-specimen', side: 'front',
});
```

这是有弧长尺度的**展示用弯曲布样**，没有把它当作物理布料、裙子或成衣。动态宿主可在更新后重新映射，或在 GPU 中沿用同一合同；本 R03 的 CPU 映射返回的是调用时刻的显示几何，不提供持续跟随调度。

宿主如已具备 `displayMesh` 与材料坐标，可在回调内定位材料三角形、使用重心权重插值最终位置与法线，再返回此结果。适配器没有自作主张重建宿主的网格索引、运动绑定或三角形查询器。

## 6. 与已有契约的关系

旧绑定协议要求：`materialCoordCm`、`warpDirection`、`weftDirection`、`panelId`、`side`、`seamDistanceCm`、`edgeMask`、`physicsMesh`、`displayMesh`、`displayToPhysics`、`bodyFrame`。

本适配器完成其中的材料坐标、布纹旋转、裁片身份、正反面及显示位置映射示范。`seamDistanceCm`、`edgeMask`、实际裁片裁切、跨缝接续、物理绑定与最终人物姿态由宿主提供；**尚未提供的字段不会伪造为已接入**。

职责维持不变：布料侧拥有材质身份和外观；裁缝侧拥有裁片、布纹线、缝份、接缝、成衣拓扑和显示/物理绑定；人物侧拥有最终 `simulationRig` 和身体碰撞代理。

集合 R03 的 `SHADER_RULE_CONTRACT.json` 目前固定 `status: draft`、`applied: false`。把公式写入该 JSON 不能让渲染器自动执行。正式接集合需增加新版本的 native adapter、注册新工具及其生命周期，并验证原有材料入口不受影响。

## 7. 仍需实做的接入门槛

- 依据真正的衣片边界裁切曲线；保留 seam、panel 与材料坐标身份。
- 实测细线在表面曲率变化、手肘/腋下/膝部等位置的穿插与法线连续性。
- 为被遮挡、超出视野及亚像素细线实现与实际渲染相符的连续需求调度；不能把远处突然删掉结构称为无级调度。
- 约束蕾丝与承载面、其他衣层及人体的关系；显示偏移不代替碰撞求解。
- 检查花型的连接性与悬空孤岛。当前视觉连接不等于可织造工艺。
- 检查成衣动作、长期运行、目标设备与多 NPC 性能；本轮布样截图或数值验证不能代替这些验收。

## 8. Human-Fabric-Workbench `main/AGENTS.md` 的完整关键要求摘要

本轮已读该文件全文；`dev/fabric` 当前树未包含同名文件。以下是主线程创建研究分支和 Draft PR 时需要考虑的仓库要求。实际工作仍以当前用户指令和会话中的授权为准。

1. **独立 HTML 交付**：给用户直接运行的工作台要求单体 `.html`，运行所需 JavaScript、Shader、样式、数据和资产均封装；不可把用户引导到 npm、服务器或另一个工具。要求实际验证首帧、关键交互、零缺失资源；单文件不可成为简化物理或材质的理由。在线链接可以同步提供。当前会话同时有固定公网网页验收要求。
2. **冻结任务锚点后执行**：协调层负责研究和冻结任务；执行层收到 Task Anchor 后做明确源码/数值工作、检查并写 receipt，不能以重新策划替代执行。能力真的阻塞时须报告 `EXECUTOR_CAPABILITY_BLOCKED`、taskId、baseSha、已完成产物、下一条命令及实际限制。
3. **不擅自改变质量或范围**：不可自行降画质、降验收门槛或更换研究对象；模型切换由协调层决定。一条工位聚焦一个明确缺陷。
4. **复杂资产并行覆盖**：复杂对象拆成互不冲突的工位；局部问题最多连续两个有限增量仍不过时记 `HOLD_LOCAL`，不允许一个局部堵住所有系统。主要系统未覆盖前不无限钻微细节。
5. **测实际输出**：物理尺寸须量最终可见/变形后的几何，配置数值不是验收证据；整体组合应定期生成可观察的整体验证结果，并最终提供独立 HTML。
6. **Reference-First / First-Look**：首轮可见对象要求参考与候选同屏；身份、主要轮廓与比例未过之前不进入微观细节。受版权或来源可用性影响时，应明确参考呈现方式和验证限制，不能声称看过未获取的内容。

源码落库应使用隔离研究分支、Draft PR、固定提交与可复现证据；保留旧版，不自动合并，不强推。新模块目前属于待整合工具，不能写成“总台已上线”。

## 9. R03 显示模块、交错底网与短毛羽

`dist/lace-display.js` 提供固定 38° 的透视相机、椭圆纱线扫掠、实际 3D 曲线切向/法线和材质。工作台将适配器设为 `worldUnitsPerCm: 1`，显示空间使用厘米；微表面振幅与频率也以厘米标定。适配器本身仍支持明确传入的厘米、米、毫米宿主单位。

主线可先在厘米局部空间构建，再按宿主尺度变换，并使材质的物理频率使用一致单位。`lace-fiber.js` 也以厘米标定：其 `fiberRadius` 是实际显示空间半径，投影覆盖必须使用变换后的半径与相机深度。当前工作台使用单位缩放；接入米制宿主或额外缩放模型时，须显式同步毛羽半径、几何、材质坐标与投影单位，不能仅缩放物体位置就认为毛羽覆盖仍正确。

R03 底网为显式交点与交替上下路径，确定性的小幅平滑变形共用稳定种子。线径、孔隙和四层语义保留，仍属于显示结构，不宣称已经提供可织造的交织、载纱或接触求解。

`buildYarnFuzzGeometry(paths, layer, flatten)` 只为 `outline` 与 `trim` 生成独立短毛羽；输入为绑定后的路径。`createFuzzMaterial(appearance, bendUniform, fiberUniform, resolutionUniform)` 创建透明 ribbon 材质，保留不透明线芯。`resolutionUniform.value` 必须是**当前渲染目标的物理像素宽高**，不能传 CSS 尺寸：离屏采样时取 sampler 的 `width/height`；直接画 canvas 时取 `renderer.getDrawingBufferSize()`。宽度按投影转换，横向光栅支持增加后用高斯覆盖积分降低不透明度；它不是额外的一圈实心宽线。材质使用正常透明混合、深度测试和 `depthWrite: false`，在不透明背景上参与线性 HDR 采样。

界面保存外层 `kaopu-lace-workbench`、`version: 1` 的 JSON，额外保存颜色、粗糙度、截面、纤维强度、弯曲及镜头／灯光／衬底。纯生成器 recipe 与观察状态继续分开。R03 下载文件以 `KAOPU_LACE_R03_` 开头，浏览器保存键为 `kaopu-lace-r03`。镜头保存 FOV、取景高度、方向和中心偏移；相同结构下恢复相同相机距离。保存文件不包含空间采样历史；载入后重新采样。详见 `DISPLAY_RULES.md`。

## 10. 同姿态线性 HDR 空间采样的宿主接入

`dist/lace-sampling.js` 导出 `createLaceSampler()`、`createSamplingPattern()`、`resolveSamplingSize()` 和 `SAMPLING_DEFAULTS`。它不重建花型、不减少纱线、不切换几何 LOD，也不累积不同运动姿态。固定样本是物理渲染像素内的偏移，序列不随帧号随机重排。

```js
import { createLaceSampler } from './lace-sampling.js';

// renderer、scene、camera 由宿主创建；camera 必须是 PerspectiveCamera。
const sampler = createLaceSampler(renderer, {
  movingSamples: 4, settledSamples: 32, samplesPerFrame: 4,
  requestedMSAA: 4, maxPixels: 4_500_000,
  maxPixelRatio: 2, minPixelRatio: 1,
});
const status = sampler.resize(cssWidth, cssHeight, Math.max(devicePixelRatio, 2));
resolutionUniform.value.set(status.width, status.height);
sampler.invalidate('host geometry or material changed');
const frame = sampler.render(scene, camera, { moving: false });
// 后续动画帧在 sampler.needsMoreFrames 为 true 时继续调用 render。
// 宿主销毁时调用 sampler.dispose()。
```

宿主需遵守以下时序：

1. 每个运动姿态调用 `render(scene, camera, { moving: true })`，该调用只积分当前姿态的 4 个固定空间样本。
2. 运动结束后先固定最终姿态，并**至少调用一次** `{ moving: false }`。`needsMoreFrames` 在上一状态仍为 moving 时是 false，不能因此提前跳过这一过渡帧。之后每帧增加 4 个样本，静止总数达到 32 后停止。
3. 镜头、灯光、材质、几何、可见性或其他影响画面的状态一旦改变，调用 `invalidate(reason)`；旧均值不得用于新状态。尺寸变化使用 `resize()`。宿主不得在仍改变姿态时把 `moving` 标成 false。
4. 所有样本先进入 RGBA16F 线性 HDR 目标，再在线性空间等权平均；最终输出只做一次曝光、tone mapping 和 sRGB 转换，回缩使用线性过滤。透明毛羽在各个样本内与不透明背景正常合成。
5. 同一姿态的阴影只在首个样本更新；采样结束或异常时恢复相机投影、渲染目标、清除与阴影状态。对象变形、灯光或阴影属性变化也必须 invalidate。

工作台的离屏目标为 CSS 宽高各 2 倍，canvas 保留设备像素比并限于 2。目标尺寸最多 4,500,000 像素；这是每个目标的像素上限，不是总显存上限。采样器还受纹理和 renderbuffer 上限约束，实际 MSAA 取 RGBA16F 颜色与深度格式共同支持的样本数。`getStatus()` 提供实际尺寸、比例、MSAA、限制原因与目标内存估计；估计不含画布、网格、阴影及驱动开销。若预算使比例低于配置下限 1×，状态会明确提示；不自动稀疏几何。缺少 `EXT_color_buffer_float` 时明确失败，不以非线性颜色平均替代。

`tests/lace-sampling.test.mjs` 的 12 项检查覆盖数值积分、尺寸预算、状态切换、失效与恢复、颜色处理顺序和阴影状态恢复。它使用 CPU 与渲染器状态 stub，不能验证真实 WebGL 光栅化、画面、性能或浏览器交付。原生 EGL 的覆盖与真实材质诊断提供另一层有限证据；最终仍须在实际浏览器完成同姿态整体、微距、侧面、背面及旋转对照。
