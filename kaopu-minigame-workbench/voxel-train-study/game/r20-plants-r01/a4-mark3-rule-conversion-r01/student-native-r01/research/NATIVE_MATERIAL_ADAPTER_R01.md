# 原生学生网格：固定 PBR 大师适配 R01

## 范围和结论

本次仅新增 `src/native-materials.mjs`、独立材质测试及这份说明。旧 `master-materials-v3-1` 的 17 个锁定文件逐个 SHA-256 校验通过，没有修改；不发布。

新入口接受自有网格语义和调用方明确提供的固定米制设计 restMatrix，不接受原模型材质定义、源 node/mesh/primitive 索引、glTF parser associations 或源几何。没有老师顶点、全量残差、纹理图片或下载逻辑。未知材质语义报错，不回退成浅灰色。

本地已通过 JavaScript 工厂调用、真实 Three r170 shader-hook 展开、原 fragment 对照、版本和几何不变测试。它们不是 WebGL 驱动编译、整车视觉通过或整车物理尺寸认证。实际渲染编译和正交画面由主线程 CI 验证。

## 真实复用链

- 金属：调用固定 R06 `makeMetalMaterial`，再使用 v3.1 已有的 `PARAMETERIZED_METAL_FIELDS`。这就是既有的 8 处受守卫替换版本，噪声、解析梯度、场结构和 BRDF 接入复用原实现，不新写“金属噪声”。原始 vendor 字节不变，但运行的场不能称原 R06 field 逐字相同。
- 漆面：实际调用 R08 `createTrainMatter(T).paint`。其材质转移为每个实例或每组相同 rest 域实例；原 fragment callback 逐字不变。保留原 RGB 倍乘、粗糙度扰动及 0.000020 m 设计微高系数。clearcoat/roughness 是本次明确创作的实例配方，不冒充原模型配方或历史测量。
- 玻璃：实际调用 R03 `buildGlassCase`，提取真实 finite-glass 材质并释放工厂展示几何。其原 fragment callback 逐字不变，保留 transmission 0.91、IOR 1.52、14 mm 光学厚度及 3.5 m 衰减距离。

重要：R03 自身把这份玻璃写为 limited dielectric transport，明确不是已恢复的成熟玻璃母体。这里只能称复用固定 R03 有限透射配方。不能把工厂演示箱体的闭合/厚度证明继承到火车自有玻璃：适配器主动移除该项物理厚度认证，所有新 pane 的闭合及实际厚度验证仍为 false。

## 自有配方与角色

| 原生角色 | 配方 | 颜色（sRGB） | 金属度 | 粗糙度 | 实际母体 |
|---|---|---|---:|---:|---|
| paint | body-green | #103e35 | 0 | 0.255 | R08 漆面 |
| blackPaint | black-painted-steel | #14191b | 0 | 0.39 | R06 已参数化完整涂层 |
| brushedMetal | polished-rod-steel | #b9c2c6 | 1 | 0.21 | R06 已参数化金属 |
| glass | window-glass | #e0eee8 | 0 | 0.045 | R03 有限玻璃 |
| interior | interior-cream | #b5aa89 | 0 | 0.57 | R08 漆面 |
| rubber | matte-black-dielectric | #171b1c | 0 | 0.82 | R08 场的明确外观候选 |

另提供 dark-iron、roof-black、buffer-red、trim-brass；black-coated-steel、linkage-polished 也有明确别名。

rubber 角色没有已锁定专用橡胶母体。本轮仅给粗糙黑色介电候选，审计记录明确说明，不能声称橡胶材料物理通过。brushedMetal 在当前角色表中映射到抛光连杆钢；没有虚构各向异性拉丝方向。

所有 sRGB 十六进制颜色通过 Three 的 sRGB→linear 变换明确赋值。R06 inherited uniforms 虽保留 uTrainSourceColor 等已锁定名字，数据来自这里的自有配方，不是原模型材质映射。黑漆按 M=0 区分于 M=1 连杆，避免把黑漆钢当裸金属；金属和漆面保留真实 PBR 和微表面场，而非纯色 BasicMaterial。

所有磨损/历史/潮湿/修补/变体值为零，不加随机锈斑、油污或假经历。玻璃沉积也锁零，因此无继承展示窗边缘污渍。

## 调用

```js
import {
  createNativeMaterialLibrary,
  createNativeMaterial,
  resolveNativeMaterialRecipe,
  installNativeMaterials,
} from './native-materials.mjs';

const library = createNativeMaterialLibrary(THREE);
// mesh.geometry 的 position 本身就是以 m 设计的本地坐标。
// restMatrix 必须在确定静态 rest pose 后显式给入，不在动画中更新。
mesh.material = library.create(part.material, {
  units: 'm',
  restMatrix: mesh.matrixWorld.toArray(),
});

// 也有独立 convenience API，返回值直接是 THREE.Material。
const material = createNativeMaterial(THREE, 'paint', {
  units: 'm',
  restMatrix: new THREE.Matrix4(),
});
material.dispose(); // 同时释放该独立调用的工厂样板

// 或者按网格明确语义批量绑定：
mesh.userData.nativeMaterial = {
  recipe: 'brushedMetal',
  restMatrix: capturedStaticRestMatrix.toArray(),
};
const binding = installNativeMaterials(THREE, nativeTrainRoot, {units: 'm'});
binding.dispose(); // 恢复原先本地占位材质引用并释放新材质
```

library 缓存 R08/R03 工厂样板，每次 create 返回独立实例。viewer 如需减少实例，可用 `resolveNativeMaterialRecipe(role)` 加完整 16 数 restMatrix 为键缓存；不同 restMatrix 不能共用。用户的普通材质外部更改也应保持实例隔离。

批量入口默认要求 root 下每个 mesh 都有明确语义，忽略名称猜测。也支持 `options.bindings=[{mesh,recipe,restMatrix}]` 精确选择。实例化网格、skinned mesh 和数组材质不在这个版本的批量入口范围内，避免不明确实例 rest/材质槽语义。

## 坐标与诚实边界

- units 必须明确为 `m`，状态仅为 `designed-metres`。
- restMatrix 只接受有限、仿射、右手、保长刚体矩阵。不通过材质域缩放“修正”未知车身尺寸，不把单位盒比例混入材质尺度。
- 顶点域替换只改变材质坐标赋值和法线变换，原 geometry position、normal、uv、index、groups 均不改。
- 矩阵入参被复制；父层移动/旋转不会改变图案。动画也不重新捕获 restMatrix。
- 玻璃 14 mm 是光学配方数值，不等于网格厚度已验证。其他微表面量是设计值，不是历史实测材料数据。
- 所有实例 `userData.nativeMaster.visualAcceptance`、`actualWebGLCompileValidated`、`physicalCertification` 默认 false。shaderHookExecuted 只记录 JS hook 已跑，不能作视觉通过。
- 全车真实尺寸需逐项外部证据；材质坐标为米不证明全车尺寸正确。

## 验证方式

```sh
node --test student-native-r01/tests/native-materials.test.mjs
```

当前 9 项通过，详情记录在 `qa/native-materials-verification.json`。验证覆盖固定版本 hash、全部配方、原 R08/R03 fragment equality、R06 同一已参数化 field、固定 rest 域、零磨损、未知角色拒绝、单独/批量实例生命周期、失败不部分替换、几何/UV/索引不变及无旧原模型绑定依赖。

当前未在本子任务执行 WebGL/GPU 编译或视觉验收。整车灯光、环境反射、薄玻璃遮挡/透射、深绿车壳与黑底盘区分、抛光连杆可读性，必须看主线程最终渲染。金属反射尤其依赖合适环境和光源；工厂执行成功不代表整片画面已正确。
