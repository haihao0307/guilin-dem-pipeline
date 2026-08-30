# Three.js 与 WebGPU 实现骨架

## 1. 推荐模块

```text
TerrainTruthLoader
TerrainTileIndex
FieldGraphCompiler
SeedBank
HeightEnhancementWorker
DataMapWorker
MaterialFieldRuntime
TerrainRenderer
TerrainQA
EvidenceCapture
```

## 2. 字段图节点接口

```ts
type FieldNode = {
  id: string;
  family: 'primitive' | 'warp' | 'profile' | 'erosion' | 'data' | 'color' | 'render' | 'utility';
  inputs: string[];
  outputs: string[];
  seedChannel?: string;
  scaleBand: 'macro' | 'meso' | 'micro' | 'subpixel';
  truthImpact: 'read-only' | 'bounded-delta' | 'visual-only';
  mask?: string;
  parameters: Record<string, number | string | boolean>;
};
```

## 3. CPU 与 GPU 分工

CPU 或 Worker：

```text
DEM 解码
水文分析
坡度和曲率
真实 Flow accumulation
低频 Z_delta
瓦片边界同步
统计和 QA
```

GPU 或 TSL：

```text
微法线
岩石遮罩细化
综合色彩
粗糙度
AO 近似
距离衰减
季节和湿润状态
```

## 4. 推荐输出纹理

```text
heightTruth        R32F or approved quantized format
heightDelta        R16F
normalMicro        RG16F or BC5 equivalent
dataMap0           slope, curvature, cavity, protrusion
dataMap1           flow, soil, rock, wetness
materialWeights    RGBA8 or RGBA16F
albedo             sRGB
roughnessAO        RG8
confidence         R8
```

## 5. 统一采样坐标

```ts
const world = tileOrigin.add(localPosition);
const uvGlobal = world.xy.multiplyScalar(1 / worldScale);
```

所有程序场从 `world` 或 `uvGlobal` 采样。不要使用每块瓦片从零开始的 UV 生成低频噪声。

## 6. 种子银行

```ts
const seedBank = deriveSeeds(masterSeed, {
  shape: 101,
  warp: 211,
  geology: 307,
  erosion: 401,
  hydrologyVisual: 503,
  color: 601,
  microDetail: 701,
  ecology: 809
});
```

每个节点声明自己的 `seedChannel`，避免改变颜色时重排山体形态。

## 7. 图谱编译

```text
parse
→ validate schema
→ resolve inputs
→ detect cycles
→ sort topologically
→ allocate textures and buffers
→ execute CPU stages
→ upload immutable truth
→ execute GPU material stages
→ capture QA
```

## 8. TSL 或 GLSL 运行链

```text
worldPosition
→ domainWarp
→ rugged / strata / microErosion
→ data masks
→ normalized splat weights
→ CLUT colors
→ roughness and micro normal
→ distance fade
→ final PBR
```

## 9. 远近景策略

```text
Near：真实网格 + meso displacement + micro normal
Mid：真实网格 + reduced meso + material masks
Far：truth mesh + baked normal and color
```

微细节必须随距离衰减，防止远景闪烁和摩尔纹。

## 10. 证据接口

建议页面写入：

```text
data-terrain-ready
data-truth-hash
data-graph-version
data-seed-hash
data-tile-seam-pass
data-hydrology-truth-pass
data-production-ready
```

自动截图至少包含：

```text
final
height truth
height delta
slope
curvature
flow
rock map
wetness
material weights
normal
```
