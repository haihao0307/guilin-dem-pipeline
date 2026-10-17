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
