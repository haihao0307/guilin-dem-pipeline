# KAOPU Lace R04 接口增量

2026-10-22。仍为 independent_tool_adapter，productionReady: false；未接入穿着碰撞、布料动力学或人物总台。

R03 完整单位、纸样、宿主映射与历史体系核对保留在 [INTEGRATION_R03.md](INTEGRATION_R03.md)。以下为 R04 增量。

## 生成器与单位

生成器 procedural-lace-r04；配方 schema kaopu.lace.recipe/1；绑定 schema kaopu.lace.surface-binding/1。填针曲线改变，因此 R03 配方只能在保留的 R03 工作台中恢复，不按 R04 静默迁移。

材料坐标为厘米，线径控件为毫米直径；宿主显式给出 worldUnitsPerCm。reliefScale 沿宿主法线缩放结构层高，不代表碰撞。所有 fill 附着端点、半径、flatten、seed、角色与裁边标记保留；新增曲线采样计入原 250,000 段预算。

## 短纤维灯光

```js
import { createFuzzMaterial, syncFuzzLights } from './lace-fiber.js';
const material = createFuzzMaterial(appearance, bendUniform, fiberUniform, resolutionUniform);
syncFuzzLights(material, { key, fill, rim, hemi });
```

灯光或 target 改变后再次同步。工作台每次实际渲染在 updateShadowFrustum() 后同步 key target。支持父级变换与非原点 target；传入实际 Three 灯光对象。方向在世界空间记录，shader 用 viewMatrix 转换。

纤维几何、覆盖积分、透明混合、数量不变；着色为轻量圆柱响应和有限半球光，不提供完整纤维多重散射或毛羽接收阴影。

## 观察状态

外层格式 kaopu-lace-workbench、version: 1。纯结构 recipe 与 appearance、observation 分开。observation 现在包括：

```json
{
  "lightMode": "studio",
  "backgroundMode": "dark",
  "layers": {"net": false, "fill": true, "outline": true, "trim": false},
  "samplingMode": "single"
}
```

完整保存另含固定 38° 相机。parseObservation() 先校验并复制状态，然后更新界面、模型和采样。缺失 layers 明确补全全部可见；缺失 samplingMode 使用 filtered。存在但无效的字段不使用默认值、不部分恢复。此兼容只针对已支持的 recipe，不表示 R03 配方可用 R04 生成。

## 构建与性能

lace-observation.js 在单文件模块序列中必须位于 app.js 之前；构建器已设置。当前输出为根入口与 r04/index.html，R01/R02/R03 归档不覆写。

固定 38° 与 4/32 采样合同不变。R04 几何更重，部分大布样会明确超过预算。数值或编译通过不代表正式总台接入、网页验收或生产就绪。
