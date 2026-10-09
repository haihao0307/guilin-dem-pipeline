# 现有人物 植物 眼球与材质接入核查

核查日期：2026 年 10 月 8 日。目标是在一个精细小空间中直接复用现有生产线，修接入接口，保留已认可的角色与表面效果，不另造低质量替代人物或植物。

结论：人物的直接运行时接入路径已从真实源码核实；首轮浏览器 CI 已实际载入原权重、固定拓扑与原 CommonSkinLayer，随后截图超时，同场视觉质量尚未通过。植物当前版本已锁定，但源文件读取受工具路径限制。眼球与材质必须分别处理适配和来源，不应当作即插即用的同一种资产。

## 人物 已有明确运行时路径

核查提交：[be719199ac33fac351a798e8afea51a0ee6d214e](https://github.com/haihao0307/guilin-dem-pipeline/commit/be719199ac33fac351a798e8afea51a0ee6d214e)。发布目录在 gh-pages，不能从 main 上的缺失目录推断工作台不存在。记录顶点数 25,417、三角形数 50,624，固定拓扑哈希 e8526431b9b24bec71d8161ed409794a8398ffc68ad25800abb27e0fc09644de。[运行时元数据](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/ui/runtime-metadata.json)

### 首选路径 保留原运行时与皮肤

1. [load-common.mjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/ui/load-common.mjs) 的 loadCommon 接收取消信号、进度回调和资产基址，返回 model、metadata 和 localGate。它读取并校验现有原生权重、共同映射、头部适配与相关依赖。
2. [CommonPerson.mjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/src/CommonPerson.mjs) 的 compute(state) 更新同一个 Float32Array positions，faces 为固定 Uint32Array。沿用原参数和 preset，不重新采样网格，不改顶点顺序。
3. 现有 [Viewer.mjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/ui/Viewer.mjs) 已示范如何直接建立 Three BufferGeometry。源模型为米制、Z-up，显示坐标转换为 (x,z,-y)。宿主使用这一同样变换，不再拍脑袋缩放或镜像。
4. 把现有 [CommonSkinLayer.mjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/ui/skin/CommonSkinLayer.mjs) 接入宿主的 model、geometry、mesh、material、render() 等窄接口。它设置固定静止空间的皮肤区域属性、程序微表面和原材质，不改变人物几何。
5. 参数或姿态变更后同步显示位置、法线、包围体和 skin.update()。场景平移/转向可放在外层 Group，不污染人物参数。继续使用一个宿主 renderer，避免每个角色开一个 WebGL 上下文。

本地已写出 integration/CommonPersonSceneAdapter.mjs，要求传入原 CommonPerson 与 CommonSkinLayer。缺少原皮肤层会明确拒绝，不静默替换成泥模。原 7 项合成契约测试已通过；第二轮审图后又加入外层 Group 落地检查，本地共 8 项通过。合成契约不替代原人物浏览器与视觉验收。

### 导出路径的准确范围

[CommonExports.mjs](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/src/CommonExports.mjs) 提供 obj、glb、usda 和 snapshot。GLB 包含当前求值几何及姿态匹配的关节与归一化最强四权重；snapshot 保留更完整的权重与参数档案。

这不是完整原生参数求解器的替代：原 MHR 非线性修正、头部适配和后续参数变化仍依赖原运行时。更重要的是，GLB 调用没有携带 CommonSkinLayer 的程序皮肤字段和 shader。直接导出再拖入房间，不保证保住当前观感。首轮保真接入优先原运行时；若将来选择烘焙轻量资产，应单独校验皮肤、权重和动画误差。

### 人物验收门槛

- 采用用户认可的 preset/参数档案，不擅自把仍待评的强化版本当成认可版本。
- 同一 preset 的顶点顺序、拓扑、年龄头身联动与基线一致。
- 皮肤的静止坐标与区域字段不随相机、姿态或年龄漂移。
- 原工作台和宿主使用同一输入，先在可对齐灯光下比较，再进目标场景灯光。
- 记录真实加载体积、峰值内存、参数变更耗时、首次编译、绘制次数和帧时间。当前没有这些宿主实测，不能承诺多 NPC 或手机性能。
- 25,417 顶点的位置数组本身约 298 KiB，50,624 个三角形的 Uint32 索引约 593 KiB；这远不是整套模型的内存预算。原生权重、头部矩阵、语义字段、临时数组、GPU 缓冲和材质都需要另计。

当前皮肤模块的 [README](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/ui/skin/README.md) 明确将其称为基础表面模块，尚未启用校准 SSS 与透光。保留这份效果不等于已经接入独立 ET03 扫描皮肤，也不应未经对照就宣称与 P.T. 同等画质。

人物来源公告列有 GNM/XRBlocks 与 Anny 代码的 Apache-2.0、Anny MakeHuman 衍生数据 CC0，以及 MHR v1.0.1 的 Apache-2.0。接入时应原样携带现有声明、来源锁和版本，不扩大未验证能力。[NOTICE](https://github.com/haihao0307/guilin-dem-pipeline/blob/be719199ac33fac351a798e8afea51a0ee6d214e/kaopu-unified-human-workbench/full/NOTICE.md)

## 植物 已锁定当前版本 源码读取暂阻

通过官方 Sites 查询确认 [Vegetation Workbench](https://vegetation-workbench-rc16.sunhaihao.chatgpt.site) 的最新保存版本为 51，源提交 d5f6ed0f41bdd6a4e4d1163190d3cd2135e8b122。没有以旧 1.14 版本替代当前成果。

当前只能取得约101.2 MB的完整源归档，超过现行单次下载上限，尚未取得受支持的分模块导出或单文件读取接口。未以旧版本替代，也没有变更植物项目、访问权限或凭据。

因此，植物的实际导出接口、几何/实例布局、叶片材质、风动画与纹理许可尚未核实。下一步通过受支持的当前源码读取或用户已有导出包进行检查；不能为了填空重新造一株低质植物。

源包拿到后优先确认：能否导出 glTF/GLB 或 mesh/instance buffers；单位和朝向；叶片是否双面、alpha test 与透光实现；风动画依赖哪些 attributes/uniforms；纹理和几何来源；LOD、实例化、阴影和透明排序的实际成本。

## 眼球 可复用系统 需要重做适配而非换头

核查固定提交 [ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/tree/ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022/skin-quality-lab/emily-transfer)。[眼部说明](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022/skin-quality-lab/emily-transfer/eyes/README.md) 记录了参数曲面眼球、角膜、共同三维注视目标、眼睑与头部接触处理；眼位和眼睑拟合只针对现有扫描头。

可保留眼球系统与虹膜素材的来源，针对总台人物重做眼窝、瞳距、尺度、UV、骨骼与运动范围适配。不要复制扫描整头来掩盖接口不匹配，也不要把某套扫描头的硬编码坐标直接塞给 GNM/Anny/MHR 共同头。

眼图说明给出 MakeHuman 官方 grey_eye.png 的 CC0 来源，眼球网格仍为参数生成。皮肤所依赖的 Lee Perry-Smith 扫描头与纹理另有 CC BY 3.0 声明，且多张 4K 纹理和多通道渲染有明显成本。纹理细节、头部曲面和 shader 的贡献要分别保留。[迁移说明](https://github.com/haihao0307/Humanoid-Rig-Lab-Next/blob/ccaa73ff5a5cbcfdd3db88ee85dc9859bbcc0022/skin-quality-lab/emily-transfer/README.md)

最低验收是正面、侧面、近距离注视、眨眼、最大开合和头部转动下的穿插/缝隙，以及总台原眼球关闭/启用对照。当前未在总台人物上完成这些检查。

## 材质 先锁具体案例再接实现

当前 [材质工作台](https://haihao0307.github.io/guilin-dem-pipeline/kaopu-material-workbench/?v=r18-20261007) 的 gallery.js 读取显示：01–04 为受保护旧锚点，05–10 为独立材质练习；每个案例通过自己的 viewer 运行并共享灯光配置。它不是一个已经导出完整 PBR 贴图库的通用接口。

已见 KAOPU_STUDIO / KAOPU_STUDIES 的 getState、setRig、flushSave，以及父子页面的 ready/rig 事件。这些是工作台状态接口，不代表所有 shader 可以不改坐标、光照约定就贴到任意模型上。页面注明非商业研究，具体案例的原作者来源与许可证还需要逐项核查，不能把整个总台一概当成可任意发布的自有素材。

接入时保留原案例与参数锚点，在新宿主中只做窄接口转换，核对颜色空间、尺寸、法线、粗糙度与能量范围。原 shader 若同时包含距离场几何、材质与光照，需要明确提取哪一部分，而不是复制一个独立画面当作场景材质。

## 建议的首个整合验收

先完成一名已认可人物在一个宿主空间中的运行时接入。先保持其几何与皮肤完全不变，只做坐标、相机、灯光和渲染上下文连接。使用正面全身、面部近景与两个已有参数状态检查是否出现质量回退。

这一项通过后，再加入当前植物的一个已认可实例；随后接眼球和选定材质。每一步记录继承了哪个版本、改了哪些接口、哪些画面已经验证。不要同时改角色形体、皮肤、眼睛与场景光照，否则无法定位退化原因。

当前房间只承担机制与接入宿主角色。首轮 CI 已取得真实入口截图，渲染、进入后启音、凝视触发和人物实际载入均有部分通过记录；之后截图超时导致 job 失败，完整视觉、听觉与移动端检查尚未完成。已经获得在小游戏生产线限定目录发布自有代码与测试的许可，发布用于验收，不等于成果已通过画质检查。

补充进度：候选按需载入现有生产人物，已经实际通过原版本指纹、25,417 顶点、50,624 个三角形和原皮肤层检查，未创建替代人物。人物同场截图和最终组合观感仍待复验，不能将“数据载入通过”记成“高质量集成已验收”。[首轮运行](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37854318109)


## 第二轮接入实测与放置修复

[第二轮 CI](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37858306394) 固定提交 ab911ca428a29c710040e991d229cb53eb54a2b4。独立人物脚本的按需加载、原版本指纹与拓扑、CommonSkinLayer、实际画布变化、释放检查通过，已拍到真实人物同场及近景。未创建新人物，未用无皮肤 GLB 代替原运行时。

人工查看截图后发现人物半身埋地。原因是共同求值模型以身体中部为原点，而场景把其 y=0 当作脚底。最小修复仅按转换后几何包围盒最低点计算外层 Group 的整体落地平移，保留全部原顶点、索引、比例和皮肤属性；新增 worldMinY 与完整身高检查。此修复先通过本地契约，再在第三轮完成实际落地截图复验。

同轮机制浏览器先通过 11 项，再因按键位移检查失败而停止；总 job 正确报告 failure。不能把人物脚本成功、截图已取得或工作流上传成功，扩写成整个候选已验收。新键盘测试将确认真实按键登记并等实际位移，记录失焦/暂停信息以定位剩余问题。[真实产物](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37858306394/artifacts/11585152312)


## 第三轮可持续技术锚点

[第三轮运行](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37861286388) 固定 dd406a8f3ff4bb31f484e90c60a57395e4f60478，最终 job success。27 项数值与契约、18 项房间浏览器检查、5 项既有人物检查全部通过。已核对结果文件和最终汇总，未把中途容错步骤的显示状态当成整体通过。

人物保留原 25,417 顶点、50,624 个三角形、固定位置/索引缓冲和 CommonSkinLayer。外层落地平移为 0.9858653545 米，世界最低点为 0，最高点为 1.8379755020 米；这是现有默认求值姿态的整体放置，不是修改人体比例或重建模型。

真实图已复核，人物完整站在地板上，第二轮埋地消失。机制中的真实键盘与触摸移动、碰撞、失焦清键、暂停、静音及三阶段事件均通过。[截图与结果产物](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37861286388/artifacts/11585804333)

本轮接受的锚点仅为“既有人物 + 原皮肤运行时接入及原创机制验证”。第一轮截图超时和第二轮键盘/落地问题作为失败历史保留，不以新成功覆盖旧证据。隔离 QA 分支的成功也不能代替生产版本一致性确认。

## 尚未通过的技术与视觉清单

- **原 P.T. 一比一**：缺用户自有原版游戏数据和可重复的原作画面/声音/输入基准；没有运行陌生 P.T. 移植程序，没有取得或公开原游戏资产。原创房间不能代替该验收。
- **最终场景美术**：墙、地、木饰仍有平面/塑料感，材质层次、真实间接光和电影式构图未达到目标。下一步应接入已经认可的材质成果及其正确光照约定，不再为了填空重造低档材质。
- **高级皮肤**：当前接入的是原 CommonSkinLayer 基础表面。扫描级细节、校准 SSS、透光与更完整的皮肤响应未接入。不得把 ET03 扫描头的效果算作总台人物已拥有。
- **眼系统**：ET03 的眼窝坐标、UV、眼睑、骨骼和角膜包络仅对原扫描头成立。共同人物仍需真实对应关系与开合/侧视/注视测试；不能复制整头掩盖适配缺口。
- **植物**：当前版本 51 已锁定，但尚未获得可用的当前源码或导出资产以核查网格、材质、风、LOD、许可与接口。未引入旧版冒充新成果，也未另造低质植物。
- **人物运动与装配范围**：本轮验证现有默认静态姿态，不是全预设、全年龄、全表情与所有极端姿态的同场复验。包围盒落地是静态放置，不是动态步态、脚底 IK、衣物或毛发物理完成。
- **性能**：自动化使用 Chromium 软件图形环境。没有真实手机帧率、显存/内存峰值、长时间运行、热降频或多人物规模结论；截图成功不代表目标设备达到帧率预算。
- **音频**：已验证点击后启动、相位对应声源和静音状态，未进行人耳听感评审或多设备声道校准，不能称复刻原作混音。
- **公网版本与回归**：隔离 QA 成功之后仍须确认最终生产文件与已验版本一致，保留旧案例、原锚点及发布前后证据；不改变其他已经认可项目。

后续工作按现有资产接口逐项推进，每次固定源版本和一个可比较目标。不要同时改人物形体、皮肤、眼睛和场景光照，再用整体好看与否掩盖具体退化。
