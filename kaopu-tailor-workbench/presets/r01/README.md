# 裁缝款式预设库 P01

用户在2026-10-09明确要求：采用人物总台多预设的方式，复杂专业参数由助手掌握和维护；先提供足够多的服装/裁片设计预设，换人物体型和服装要求时再生成相应尺寸。不能要求用户逐项调整122个参数，也不能把随机值或同一几何换名充当不同设计。

## 本线交付范围

60套有设计意图的完整配方：上装18、裤装10、半裙14、连衣裙12、连体裤6。覆盖原23个制版入口，但60是设计组合数，不是60个全新基础拓扑，更不是所有可能服装的全集。

每套保存完整设计快照、原裁片顶点与解析曲线、初始摆放、明确的配对缝边、方向、省道和抽褶系数。缩略图来自真实纸样。浏览预设只读取参考纸样，不加载Python或运行缝制；重新制版按钮才在独立Worker里执行原制版程序。切换/取消销毁该Worker，旧结果不能覆盖新人物版本。

公开入口为本目录的 index.html；只有PUBLIC_REPORT.json或对应Actions实际成功后才算公网交付。BUILD_REPORT.json只证明原生纸样生成，不替代浏览器和公网验收。

## 与原员工分工

原执行线：PR177，`fix/tailor-r07-speed-stability-20261008`，负责裤脚异常、接缝闭合、原Anny基础动作和动态穿模。

本线：PR178，`feature/tailor-preset-library-20261009`，仅新增本目录与独立P01 QA工作流。起点77992c94278a1e9865e3856c3b7651fe2c3ddbca。不改R06/R07/R073、现有catalogue、人体、蒙皮、碰撞、缝制、动作、原入口和其他项目。不合并、不强推、不改写历史。发布采用最新gh-pages的普通快进提交，只增改本目录；发生并行写入时重新取最新父提交，不覆盖另一线。

已读取另一线 a704386453f7fc10f34a3023bdcbd023d1236c7c 的学习/诊断记录：针位间距0仍可能伴随整段裸边分离。预设库不把针位指标当作成衣接缝闭合证明，也不重复实现那条线的整段缝边诊断。

## 教师研究与准确边界

PatternGSL 项目：https://lagrangeli.github.io/PatternGSL/
论文：https://arxiv.org/html/2606.24564v5
已核实项目页Code入口：https://github.com/Lagrangeli/PatternGSL （本次读取master 8348a844e9d6353923332c58f7aaa8cf02811523，只见项目网站/测试等文件，没有训练、推理或完整解码器实现）。不将网站展示的照片推理、数据集或仿真成功率说成本工作台已有能力。

落实的表示原则：连续的裁片几何与离散的连接拓扑分开保存；缝线必须指向明确的裁片和边索引，不能按空间距离猜测；保留源顶点顺序；先检查引用和闭合，再交给模拟器。

本版真正调用的是现有MIT GarmentCode原制版函数，固定上游d449629979028123a5c4dc9e732a2ec19b7fce31，不是PatternGSL照片推理复刻。原解析曲线、材料坐标和源程序保持不变。本版没有采用论文中的删除无效裁片来掩盖失败；无效预设必须停在验证失败。

## 参数掌握证据

parameter-atlas.json 保留全部122字段的原类型、范围、选择项、中文名称和条件依赖。probe_parameters.py 在固定同一量体上仅修改一个设计字段，再完整运行原纸样程序。记录有效纸样是否发生变化、哪些裁片改变、裁片/缝边数量变化及可对应顶点的位移。未观察到效应、无效组合和未执行项都保留在PARAMETER_REPORT.json及qa/parameter-attempts.json。

这只是所测试上下文中的单字段效应，不是所有选项、所有参数值、所有体型或真实面料的全域证明。休眠参数不能宣称生效；源程序钳制或强制覆写也不能解释成用户调整成功。allParametersMastered永久保持false，除非后续有独立明确的更完整验收定义。

## 人物桥梁

`window.KAOPUTailorPresets.applyBodyProfile(profile)` 接收 `kaopu-tailor-body-measurements@1`：id、revision、sourceSHA256、units='cm'、bodyCm，以及非参考人物的bodyGeometrySHA256。bodyCm必须含parameter-schema.json.requiredBodyCm列出的完整原量体字段。不得凭身高、胸腰臀三个数猜出所有局部量体，也不能静默使用基准人台补缺。

`createRequest()` 输出 `kaopu-tailor-preset-request@1`：presetId/presetRevision、bodyIdentity、generatorRequest（完整设计与当前量体）。输出operation='generate-paper'、bodyMutationAllowed=false、geometryReuseAllowed=false。人物台尚未改造成主动推送此协议，不能声称真实跨台自动试衣已完成。本线不强改另一线的接口或运行时。

用户选择预设后由助手维护设计。当前只读参数表用于核查，不提供专业滑块。未来接入服装要求时，应通过有版本的设计决策修改配方并生成新revision，而不是盲目全面缩放网格。

## 未完成项

不包含成衣求解结果、布料自碰撞、连续碰撞、动作试穿、实测面料、现实缝份或工业生产认证。仍为physicalFitAccepted=false、dynamicWearCertified=false。母本的人物比例/姿势分层继续遵循；新量体需要新纸样，不能缩小人体迁就衣服。

## 复现

在该分支仓库根目录安装requirements-native.txt所需的非渲染依赖后：

```sh
python kaopu-tailor-workbench/presets/r01/build.py
node kaopu-tailor-workbench/presets/r01/metadata.mjs
python kaopu-tailor-workbench/presets/r01/probe_parameters.py
python -m http.server 8765
# 另一个终端：
python kaopu-tailor-workbench/presets/r01/qa_browser.py
```

build.py从已校验的现有pattern-runtime.zip在临时目录执行原制版函数，不修改上游源文件。SOURCE_LOCK.json记录所用依赖的SHA256。渲染/纸样/控件辅助模块是只读继承副本，第三方说明在vendor/THIRD-PARTY-NOTICES.md；没有新增收费服务、字体分发或用户私有图像。
