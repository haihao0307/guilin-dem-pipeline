# 材质接入：现有九龙窗户，不是独立演示

## 实际接入

- 原 R07 的 66 个母体函数由 `../r07/material.mjs` 原样重导出，未重写。
- 木材调用当前获授权木材源中的 18 个原始 GLSL 依赖函数。包括纵向纤维、端面年轮、细纤维、孔隙、裂纹、工具纹理与节疤信号；它们实际参与颜色、粗糙度和微高度计算，不是给平色改了名字。
- 油漆是新接收层。它是不透明的，木头颜色不会穿透油漆；底材微起伏以 12% 幅度影响表面，另有有界的橘皮／刷纹微高度。它不是从原始木材源“恢复出来”的旧漆母体。
- 清漆／漆面顶层调用 GGX 微表面 BRDF。基底在入射与出射两次经过涂层时均扣除 Fresnel 能量，不能只是叠加一个装饰高光。
- 玻璃沿用 R07 的实际米制光程、两界面 Fresnel、Snell 与 Beer–Lambert 参数契约。场景反射、环境光与显示抗锯齿由本修订的 renderer 负责；本材质模块本身不声称提供多层玻璃、焦散或无限反弹。

## 来源与完整性

源仓库：`haihao0307/guilin-dem-pipeline`

当前收到的源文件：`kaopu-material-workbench/material-master-r03/mothers/timber-original.mjs`

已验证原始 73,018 字节 SHA-256，与上游清单完全一致：
`ce6a10b73516cb3fe64b389c167daab6625354e2ea9a67c08ca6ab94c8b5df9c`

传输临时文件曾额外增加一个末尾换行，成为 73,019 字节，哈希为
`3bbbdc684a30a97f077e528b1379c34ae20c6bd2e3c56ec50c0a48c1bf53bff1`。
已逐字节验证，删除且仅删除该单个传输添加的 LF 后，完整文件哈希立即与原清单一致。没有版本、函数体或授权来源的差异。校正记录保存在 `sources/timber-provenance.json` 的 transportIntegrity。

该文件的 18 个函数体哈希、原始行号和闭包哈希基于这个已核验的原始快照。渲染器直接包含这些未改写函数体。

原函数闭包 SHA-256：
`e57fab841168f12de5700b3d236069fadbd1e80476f563c2a9491ea1c9188040`

原始颜色／高度求值片段也单独保存及校验。接收器明确替换了相机距离衰减两行，改为物理像素足迹的米制微细节衰减。没有导入原顶点着色器、演示照明、几何构造、模型顶点、贴图资源或 Three.js。

版权：继承用户项目原有授权与来源。上游没有提供统一 MIT 许可，本文件不创造或转换许可证。上游关于 Three.js 的独立 MIT 声明仅作为原清单的一部分保留；本接入不引入 Three.js。

## 物理坐标和构件方向

`FieldHit.local` 为真实孔洞构件的局部米制坐标，不按窗户宽高归一化。材质从同一套孔洞系数记录读取边界，为上／下横档建立 X 向纹理，为侧梃建立 Y 向纹理。活动窗扇随其实际局部刚性坐标移动。无底槛的门框不会凭空生成底横档方向，实体门扇以 Y 为长向。

角部以有限的对角分区近似斜接。它不能证明历史榫接形式，也不模拟圆弯木件的连续弯曲纤维。未知结构不得称为已测量重建。

5.8 倍 `woodScale` 是小窗框适用的显式频率适配，并非“未修改的原始预设”。输入坐标与输出高度仍为米。源参数取自 `yunnan_warm_medium_v2`、seed 270889、member 4401；真实颜色沿用原始 sRGB→线性变换。默认木材粗糙度／清漆以及油漆颜色属于新的设计选择，不是九龙实物表面采样。

高度仅进入现有渲染器的切向有限差分法线。几何轮廓、开窗边界、射线求交与玻璃厚度均不因材质改变。禁止把微高度说成实际几何雕刻。

## 接入 API

`material.mjs` 保留原来的 `MOTHER_GLSL`、`MATERIAL_GLSL`、`HOSTED_MATERIAL_DEFAULTS`、`adaptHostedMaterialParameters` 导出。

调用 `bindHostedMaterialUniforms(gl, program, options)` 上传所有材质参数。现有孔洞描述符纹理绑定 texture unit 7；本模块用独立采样器名读取同一份系数，不复制几何。

模式：`frameMaterialMode` / `doorMaterialMode` 为 0 金属、1 木材、2 不透明漆木。窗扇环与固定窗框都使用 frame 模式；实体门扇使用 door 模式。

关键参数：
- `woodScale`：0.25–12，无量纲物理频率倍数。
- `woodReliefM`：0–0.00042 米。
- `woodRoughness`、`woodClearcoat`、`woodClearcoatRoughness`。
- `paintReliefM`：0–0.00006 米。
- `paintRoughness`、`paintClearcoat`、`paintClearcoatRoughness`。
- 原来的框／门颜色、金属率、玻璃色、透过率和折射率保持可用。

`FieldSurface` 追加 clearcoat 与 clearcoatRoughness。`directBRDF` 已实际使用两者；环境基底应调用 `materialAmbient` 以保持同样的顶层能量扣除。该环境函数是半球平均近似，不是完整积分环境光照。

## 验证边界

`tests/material-quality-material.test.mjs` 覆盖：66 函数不变、18 函数哈希、原求值片段哈希、单个传输换行校正及来源完整性、参数验证、uniform 上传、横档／侧梃／门底方向、米制尺度、木纹与漆层数值边界、非零微高度、法线通道、远距衰减、清漆能量分配和白色表面半球积分。

`material-reference.mjs` 是离线双精度代数转写，仅用于测试；不作为 GPU 着色替代。该参考把原 `fwidth` 视为无限小足迹下的零导数，不能冒称 Float32 GPU 逐像素一致。生产 GLSL 的原导数防走样函数原样保留。真实 shader 编译、GPU 颜色／法线输出、性能与视觉质量必须由实际 renderer 的测试另行报告。
