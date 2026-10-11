# R3.12 原抹灰真实薄层适配，14 测冻结恢复版

状态：本地 CPU 14/14 通过，GPU/视觉验收仍由宿主统一完成。原试片没有住宅预设；本模块是新适配，不能称原算法完全不变或成熟现成成品。

## 本次恢复证据

- 执行器重置后，先前模块、源 HTML、checkpoint 均不在当前目录。未用摘要推断完整源码，也未把测试记录当成源字节。
- 从本线程第一次读取所得完整 plasterFS 文本重建 `source-plaster-original.frag`，去除 heredoc 额外末尾换行后，实际 SHA-256 为 `6e6acf08c21ed3ad3dd390325e17ffd404f85d4d86eff957b499bcdb1dee55ff`，与先前冻结原 shader SHA 完全相同。这份原 shader 的字节恢复已验证。
- `source-plaster.mjs` 用先前确定性提取脚本从已验 shader 重新生成，保留完整文本、11 个逐字函数及每函数哈希。
- `fields.mjs`、`geometry.mjs`、`shaders.mjs`、`plaster-native.mjs`、测试从本线程完整 apply_patch/修改记录重建；当前未取得旧运行文件清单中的逐文件 SHA，因此只声明已按记录重建并重新通过回归，不冒称这些文件已与丢失 checkpoint 逐字对比。
- README、恢复报告、manifest、测试输出和新哈希清单是本次重新生成。源 HTML SHA `1532ea02c31f014c23390fa028385338c3d2caa572f3a36511db81d6609e1581` 是重置前实测并保存的来源信息，本次没有重新读取完整 HTML。
- 使用宿主已恢复的 Three r170：`/workspace/shared/kaopu-vendor-r170/three.module.mjs`；当前 plan.mjs 由父任务恢复。本模块没有改其他项目文件，没有 GPU、CI 或外部写入。

## 接口

```js
import {createNativePlaster} from './plaster-native/plaster-native.mjs';
const made = createNativePlaster({
  THREE,
  parentWall: w,
  regions: wallRegions(w),
  palette: 'neutralGrey',
});
group(w.group).add(made.mesh);
resources.push(made);
```

返回 `{mesh,geometry,material,params,proof,updateCamera,setMaterialState,dispose}`。mesh.onBeforeRender 自动更新相机、世界法线、receiver 矩阵；dispose 可重复调用。mesh.userData.wallId 对应父墙，用于宿主剖切可见性。

所有坐标为米。parentWall 接受既有 `{id,start,end,bottom,height,alongX,fixed,side,openings}`；`matrix: THREE.Matrix4 | number[16]` 可代替 alongX/fixed，必须为右手保米制刚体矩阵。沿 Z 墙取 Y=-90°，局部 +u 映射世界 +Z，局部 +z 映射世界 -X，没有镜像。

regions 为 `{u0,u1,y0,y1}` 矩形，或 `{polygon:[[u,y],...],holes:[[[u,y],...],...]}` 凹多边形；y 是墙记录的绝对高程。区域内部不重叠，可共边。单次最多 128 区域，每轮廓 128 点，源三角化最多 512 三角形。

现有 openings 的 `{center,width,bottom,height}` 自动几何扣除，即使输入 region 跨过整个门窗也不会封洞；也接受 `{u0,u1,y0,y1}` 开口。默认外侧 front/back/left/right 对应局部 +z/-z/+z/-z；`faces:[-1,1]` 可建双面。

适配对象为现有 0.11m 单叶砖墙，砖外基面默认 ±0.055m；可显式给 params.baseHalfDepth 匹配其他真实墙厚，不借用原演示 0.48923m 厚墙。每墙所有区域一次传入，共享父墙 center/half 字段域；不要为相邻区域各次创建独立薄层侧壁。

## 真实薄层与字段

真实区域及 holes 先三角化，再与共享米制规则网格裁切。原轮廓点和矩形门窗边参与网格分割，接缝两边采用相同点。默认 80mm 格，单格对角线约 113mm。

构建点厚度为 clamp(16.5mm + 8.5mm × 原 plasterMacroField, 8mm, 25mm)。默认不把微粒放到几何上；显式 geometryMicro 上限 0.35mm，且需 <=25mm 格。正面、砖基面背面、暴露边缘均为真实三角形。内部区域接缝没有侧壁；门窗内部没有正/背面三角形。没有 patchEdge 整墙域、shader discard、raymarch、隐式 cap 或 fragment depth。

形体和片元共用父墙基面载体 `[u,y,face*baseHalfDepth]` 和同一参数。片元连续插值载体，法线来自真实几何，微表面使用原 perturb。原试片在隐式表面点取字段，此处改为稳定父墙基面载体，是明确适配变化。

## 原函数与公开变更

1. 运行 GLSL 逐字保留 `mmRotate/mmWarp/mmXi/mmCell/mmObserved/mmGeomMacroFast/mmGeomMicroFast/plasterMacroField/plasterMicroField/perturb`；完整原 shade 另存审核。没有另添廉价 noise 核。
2. CPU 用算术等价 JS 宏字段端口建几何，JS double 不宣称与 GLSL float 逐位相同。原观察字段仍有 17 级过滤。
3. shade 原色阶代数、roughness、半球光、rim、固定灯向量和 tonemap 保留。显式 palette 默认 original 黄褐；neutralGrey 是适配参数，非源预设。palette 值为线性 RGB。
4. 原 grain=sin(83x−61y+97z)，三维波长约 44.4mm、沿 X 约 75.7mm；其 9% 色条纹曾被拒。现保方向，默认物理波长 0.8mm、色振幅 1.8%、高度 8µm；允许 0.3–2mm、<=3%、<=20µm。
5. grain 由 abs(dFdx phase)+abs(dFdy phase) 得到保守每像素周期，在 0.35–0.90 cycles/pixel 衰减。微 bump 在 8–20mm/pixel 衰减。这是显式新增屏幕过滤，不能称原算法完全不变。
6. 原 perturb 用真实世界点/法线计算导数。原 L=(-.94,.30,-.16) 和 rim=(.62,.16,.77) 固定世界坐标；不会随每面墙一起旋转。相机亦为世界坐标；非刚体缩放/反射明确拒绝。

## 低频材质状态接口，V26 由宿主管理

`NATIVE_PLASTER_MATERIAL_STATE_SLOT` 位于 nativeShadePlaster 中 base/rough 求值之后、L 定义之前。湿润需要在这里改 base 与 rough，再照明。旧照明后 `NATIVE_PLASTER_WEATHER_SLOT` 已删除，不可用后光 col 染色冒称材质混合。

- vReceiverPosition = uReceiverMatrix × 真实 position，uReceiverMatrix 每帧来自 mesh.matrix。处于同父级 receiver 域，排除 root 世界平移/旋转，不使用 nativeFieldPoint 代替真实位移点。
- nativeMaterialState 为零初始化 vec2 顶点属性，片元中为 vNativeMaterialState。两分量语义由宿主约定。
- 宿主将 geometry position 经 mesh.matrix 变换，在自己的 V26 低频缓存取两个状态，再调用 made.setMaterialState(values)。长度须是顶点数×2，均可表达为有限 Float32。只更新属性，不重建几何。
- 本模块没有 V26 核、副本或湿痕计算。宿主在照明前 slot 接入自己的 base/rough 混合。
- vWorldPoint 仍供世界照明/微表面导数，vFieldPoint 供原抹灰字段，三种坐标职责明确。

## 上界与回归

单次构建限制：300,000 实际 cell visits，每墙每轴最多 4096 基础格，60,000 顶点、110,000 三角形；超限拒绝，不偷偷降质。最终 position/normal/field-point/material-state 共 44 bytes/顶点，Uint16 索引 6 bytes/三角形，输出约 3.30MB 上限，另有构建期 JS 暂存。

每墙一次 create 为一个 mesh/material/draw。无运行时重建或 GPU 烘焙。片元最多 17+5+3=25 次源 mmCell，加 warp/perturb/grain；固定开销不等于已测 FPS，必须宿主统一 GPU。

本次恢复回归：14/14 通过。12 墙外侧全覆盖仍为 45,972 顶点、72,748 三角形、2,459,256 bytes、12 draws，与冻结版计数一致。此数不含砖、木、金属、weather。

```sh
PLASTER_THREE_FILE=/workspace/shared/kaopu-vendor-r170/three.module.mjs node --test plaster-native/plaster-native.test.mjs
```

覆盖：原哈希/函数文本、字段确定性、厚度/尺寸、真实开口 raycast、凹多边形/holes、焊接闭合/正体积、共享区域无内部侧壁、四面矩阵/固定灯、刚体父变换及拒绝缩放镜像、双面、grain 频率/过滤、预算、12 墙总数、receiver 不随 root 移动、vec2 状态上传和照明前 slot。

未测：恢复后的 GPU compile、帧时、动态抗闪实际表现、V26 合成外观及审美。请保留候选标记。
