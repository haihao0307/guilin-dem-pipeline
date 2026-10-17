# A4 / Mark3 精确结构与形体转换 R01（进行中）

先读 [CONVERSION_GATE.md](CONVERSION_GATE.md)。本版本的目标是执行共享函数、实例参数和可证实的形体规律，并精确重建全部原内容。当前尚未全部参数化，不允许越过门禁继续外壳设计。

## 可执行层

- `src/exact-decoder.mjs`：执行字段函数、网格原型、组件函数与实例、动画曲线绑定；重建后验证每个字段与完整载荷SHA256、完整运行定义锁。
- `generated/a4/`、`generated/mark3/`：转换程序、明确残差及形体规则资产。模型运行不读取原 `object.json/fields.bin.gz` 作秘密回退。
- `src/wheel-profile.mjs`：固定数值约定的旋转轮廓采样，并保留可验证逐位修正。
- 球铆钉及圆环面规则：源模型几何规律，不能据此宣称真实铆接、连续弹簧或机械动力学。
- `viewer/index.html`：左侧读原件作为对照，右侧只执行新转换程序。原件/转换共享同一正交标尺；全部模型变换与原轮径保留。跨来源米制仍未标定。

## 精确与规则覆盖必须分别验收

1. 真形体函数：参数改变可实际改变生成几何；固定采样、排序和浮点约定；修正残差单列。
2. 共享组件模板：重复原型只存一份，保留各实例真实非等距位置和原动画。若原型仍为数组，不计形体规则学习。
3. 未解释原残差：不删除、不降精度；仍需逐组件学习，不能把解码器存在写成“全部转换完成”。

纹理保留原图，材质保留原全部定义；本任务不以重绘/压缩贴图偷换几何规则转换。

## 测试

在本目录运行：

```
python tools/convert.py
python tools/test_exact_conversion.py
node tools/verify-js.mjs
node --check viewer/view.mjs
node viewer/test-transport.mjs
```

`viewer/browser.cjs` 为已授权CI真实浏览器测试，检查完整场景加载、全部世界矩阵采样、同相机逐像素对照与正侧/正面/顶面截图。此文件存在不表示浏览器已通过，必须查看实际CI结果。

## 运行与许可

从共同父目录提供HTTP服务，打开 `a4-mark3-rule-conversion-r01/viewer/index.html`。视口显式复用邻接已发布R03中的Three/GLTF渲染后端、原件对照读入器、正交相机；右侧模型定义、几何和校验贴图来自本版本转换程序/资产。没有引入R03任何A6外壳。

来源：timblewee，CC BY 4.0。
- A4: https://sketchfab.com/3d-models/train-class-a4-union-of-south-africa-636ed4890b72429da4a10abec0551373
- Mark3: https://sketchfab.com/3d-models/mark-3-carriage-std-open-gwr-green-0c64f6c0affb41f7bd4583a96c9fd0f1
- 许可：https://creativecommons.org/licenses/by/4.0/

修改：结构函数化、精确共享组件与形体规律提取、显式残差编码和核查视口。此版本不包含或公开原生归档及其元数据；完整本地原件仍保留。

## 参数可变与原件锁的边界

形体函数的半径/位置等参数确实会改变生成结果，测试实际验证了这一点。默认重建入口同时锁定原件字段SHA，故未经显式建立新设计版本的参数变更应被拒绝；这不是参数编辑后的机械验收。位残差、原采样/裁剪与面序仍绑定本次源件，不能声称任意改尺寸、采样或驱动轴数都可自动生成正确机构。

## 自有 PBR 大师：明确的第二模式

视口默认保持源精确材质。按钮“自有大师候选”只在已核验的转换车上调用固定 R06 金属/R03 玻璃真实工厂；左侧原件不变。选用范围、保留范围及每项差异可在 `CONVERSION_QA.materialRecords` 检查。不是所有铜/金/塑料/图案都已建立自有母体。再按“原精确材质”恢复原材质对象与原数组身份。

`master-materials/runtime-lock.json` 锁定7个实际运行文件，共125,609 B；旧库核心场原样。适配仅包裹固定源休止坐标域，不修改模型几何/显示标尺。源单位未米制标定，`referenceScale=1` 只是显式参考域，不是物理纹理尺寸认证。源原色与光学可能不同，升级模式须单独图审。

四张纹理的规则实验数据在 `texture-rules/`，仅浏览器审计按需加载，默认源精确页面仍使用原编码图像。Pillow 解码相等、浏览器上传采样相等、主视口像素相等是三项不同证据。浏览器报告必须保留任何JPEG解码或透明RGB差异；不可用其中一项冒充全部平台无损。

## Checkpoint 05 browser verification candidate

The QA URL explicitly selects `?ruleTextures=1&masterVersion=2`. The rule-texture bridge emits DataTexture RGBA directly and blocks encoded source image requests for the converted panels; source-reference panels retain their original images. This is exact region rules plus explicit pixel residual, not a claim of completely procedural texture authorship. CPU bridge tests preserve sampler, UV transform, color-space and alpha semantics. Whole-frame browser equivalence remains a required test.

The independent `master-materials-v2` candidate locks 10 runtime files. It maps 74 unambiguous primitive uses (59 A4 / 15 Mark3), retaining original color/metalness/roughness and deriving diffuse/F0 consistently. The previous fixed zinc recipe is visually rejected and retained only as historical evidence. Candidate visual acceptance cannot be inferred from shader compilation. Source-exact remains the restoration reference. Material coordinates are uncalibrated source-rest units.

A4 historical coal is retained only for complete A4 source replay. A6 is diesel-heated steam with oil/water storage: coal conversion is not an A6 prerequisite. The independent non-coal dependency projection is verified separately; scope removal contributes zero learned-geometry coverage.
