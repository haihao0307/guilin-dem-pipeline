# KCC 同楼层材质接收器候选

只含材质函数、原函数快照、来源、测试和 GPU probe fixture。不接管 renderer，不创建模型 Mesh、纹理资产或 Three 运行时，不修改既有楼层与旧锚点。

## 接入

- JS：`FLOOR_MATERIAL_GLSL` 为默认漆门版本。`buildFloorMaterialGLSL({doorFinish:'wood'})` 仅将 14 号设计门切换至既有木材母函数；13 号证据窗框不会变成木头。
- GLSL：`FloorMaterialSample sampleFloorMaterial(float role, vec3 localMetres, vec3 localNormal, float physicalFootprintM, float stableObjectId)`。
- 10 室内地砖，11 外墙横砖，12 内墙漆，13 深色涂层金属框，14 设计门面。
- 输入/输出完整字段和样本在 `material-fixture.json`。不得用 role 取代原 objectId；不得更改原来射线命中的距离、坐标或几何身份。
- 地砖用构件局部 X/Z，墙/门用局部 X/Y，金属用构件局部 XYZ。必须先把法线和差分方向转到同一局部坐标。不要把 world normal 与 aperture-local position 混用。
- 所有颜色均为线性 RGB。默认值是设计选择，不是现场色度/BRDF 测量。

## 必须真正消费的通道

1. `coverageDiffuse` 与 `coverageF0` 分别用于漫反射和 Fresnel。R06 金属不能重新通过“混过的颜色 × 金属率”构造 F0，否则丢失原相覆盖契约。默认完整漆层表面是介电材质，金属构件不代表外层漆的 metallic=1。
2. `height` 是米制材质高度。它只可在该版本进入微法线，不宣称砖缝退台、倒角或涂层是新增真实几何。`bevelGradient` 只包含解析砖缝/倒角的 UV 梯度，不是完整材质梯度；若总高度已求导，不要再重复叠加它。
3. `clearcoat` / `clearcoatRoughness` 要进入真实高光并扣除基底入射和出射 Fresnel 能量。输出未包含灯光、曝光、tone mapping、AO 或玻璃透射。近景玻璃沿用父接收器既有的有限厚度光程/两界面 Snell-Fresnel/Beer–Lambert，不用本模块的深色面冒充玻璃。

原陶瓷 `ctEvaluate` 给出基色、粗糙度、微高度、釉层覆盖。瓷砖分格、砂浆、材质倒角和足迹过滤为新的接收层；没有导入原 Three 的砖片/砂浆几何。R04 本来是“新写陶瓷研究接收器”，不是已恢复/标定的成熟母体。

R06 金属比 R07 常量框材质有更多实际通道：涂层高度、微结构、粗糙度与分别累计的 diffuse/F0。本例固定完整干态，避免凭空给照片窗框添加锈蚀史；深色涂层仅对完整漆相做显式调色，保留其原场的微高度和光学通道。未找到独立成熟的内墙漆母体。12 号消费原石膏/灰泥场，再加新的不透明涂层微表面；14 号默认漆面也是明确的新接收层。

## 证据与权利

父任务已实际看过 KCC 参考照片，报告外墙淡色横向小砖、深色金属侧开窗框。本目录不复制照片。只将这些外观作为观察背景；198×48 mm 外墙砖、298×298 mm 室内砖、3 mm 接缝、颜色、漆层、粗糙度以及内墙/门面均为设计假设。不能称逐砖一比一实测。

`sources/field-sources.mjs` 保留原始字段字符串，`sources/provenance.json` 记录 SHA-256 和上游 Git blob。编译层只作明确的命名空间、声明和参数接收适配，不悄悄改写原母函数字符串。木材源沿用 `../material-quality-r01/sources/timber-field-source.mjs` 与其 provenance。所有来源权利继承用户项目原记录；不因 Three 是 MIT 或 Adobe 参考是 Apache 就给自有/继承母本套统一许可证。没有老师资产、原参考图片、外部贴图、Adobe 实现或 Three 模型导入。

## 检查和未检查

- `node material-adapter.test.mjs`：源哈希、实际函数调用、输入范围、米制尺度、负坐标、稳定 cell、平移周期、接缝宽度、材质高度边界、木门隔离。
- `gpu-probe.mjs` 只导出精确 probe shader、输入、解码和 expected 校验，不启动浏览器或上下文。
- `node gpu-fixture.mjs` 输出两种模式的完整 GLSL 与输入 JSON，供父任务同一隔离 candidate QA 编译。默认只需 paint 门。
- GPU probe 需要 1×1 RGBA32F 四附件；依次读回 baseColor/roughness、height/coat/coatRoughness/metallic、coverageDiffuse/tileMask、F0/cavity。不经过 tone mapping。`verifyFloorMaterialReadback` 检查范围；两组金属/墙面点还须通过 `verifyFloorMaterialProbeVariation`，防止只接平色。
- 应记录实际 cold compile、首次 draw/readback 时间、GL 错误及输出。像素小样本通过也不代表整楼层渲染、近景速度、视觉或最终材质验收通过。
- 本任务 GPU 未执行：一次已有 Playwright 启动在缺少可执行文件阶段失败，没有创建浏览器/GL 上下文。随后父任务明确由统一 candidate QA 做 GPU 检查；没有重试、安装、提权或自建 CI。CPU 测试不代替 GPU 结论。

### Bounded floor-slice integration correction
The integrated floor slice deliberately exposes only the painted design-door receiver. The earlier optional timber adapter sketch is not shipped or imported by this default module. No dependency on an unpublished material-quality candidate is required. `buildFloorMaterialGLSL({doorFinish:'wood'})` rejects in this bounded version. The original timber work remains preserved in its own existing workbench; this slice does not claim it was used. The physical material output is consumed through coverageDiffuse/F0, roughness, clearcoat and metre-based microheight. Microheight remains shading-only, not an actual geometric tile bevel.
