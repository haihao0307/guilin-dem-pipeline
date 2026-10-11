# V26 water state cache, R1 — reconstructed recovery

## Recovery status

The executor reset deleted this directory. On 2026-10-11 this module was **reconstructed from the original worker's complete tool transcript**, preserving the last 12-test implementation, public interfaces and shared 4×4 numerical-patch architecture. It is not claimed to be a byte-for-byte restoration of the lost files: the lost SHA inventory is unavailable for comparison, comments/documentation were reconstructed, and the restored source-lock metadata identifies the verified frozen Library package rather than claiming the old remote commit remains accessible.

Only `weather-cache/` was written. No neighborhood/brick/native/plaster/other-QA/CI file was changed. No local browser, GPU test, CI or external write was started. `recovery-manifest.json` records verified source bytes and reconstructed-file boundaries; `HANDOFF_SHA256.txt` covers this recovered deliverable.

## Result and acceptance boundary

- Original V26 low-frequency water is sampled once through a temporary WebGL2 RGBA32F numeric framebuffer, returned as Float32 values. No image assets, sampled visible textures, alternate meshes or replacement noise are produced.
- Runtime retains original unequal-length streaks, original hashes, original gates and final water sum. Additional runtime water performs **zero valueNoise3 / gradientNoise3 / domainWarp / weatherFine evaluations**. Host fine brick material functions are untouched.
- Two shared parent grids hold broad water and the height-independent lowerDamp factor. Each brick carries a 4×4 patch from each grid; fragment interpolation uses common global grid cells across staggered rows. This is not an independently interpolated four-corner whole-brick field.
- The recovered **12 CPU tests pass**, including current **4,644 brick bounds**, source-function hashes, shared-grid seam algebra, receiver coordinate invariance, wrapper lifecycle and attribute budgets. GPU compilation, actual GPU max/p99 error, GPU seams, integrated material appearance, startup time and frame cost **have not been run** here.

## Files and public API

- `cache.mjs`: domain/grid validation, numeric cache, per-instance patch packing, shared-geometry wrapper, uniform values.
- `gpu-sampler.mjs`: reusable numeric GPU sampler, temporary FBO cleanup, full readback and timing metrics.
- `glsl.mjs`: namespaced original field split, brick patch snippets and noninstanced common receiver function.
- `qa.mjs`: full original field comparison, exact-split identity, CPU-cache/GPU-patch max/p99, same-point GPU seams.
- `cache.test.mjs`, `cpu-test-results.tap`: the restored 12-test CPU suite and this recovery run's actual output.

```js
import {createWeatherNumericSampler} from './weather-cache/gpu-sampler.mjs';
import {
  createWeatherStateCache, packInstancePatches, makeWeatherGeometryShell,
  patchUniformValues, toParentMetres, assertWeatherAttributeBudget,
} from './weather-cache/cache.mjs';
import {
  patchVertexDeclarations, patchVertexAssignments, patchFragmentGLSL,
} from './weather-cache/glsl.mjs';

const domain = {
  id: 'shared-full-height-front-façade',
  parentOriginMetres: [-2.2, 5.35 / 2, 0],
  parentBasis: [[1,0,0], [0,1,0], [0,0,1]],
  fullDimensionsMetres: [3.9, 5.35, .4],
  fieldScaleMetres: 1,
  waterSeed: 23,
  weatherSeed: 17, // Original-full-function QA only, not runtime weathering.
  parentNormal: [0,0,1],
};
const sampler = createWeatherNumericSampler(renderer);
const cache = createWeatherStateCache({
  sampler, domain, targetSpacingMetres: [.14,.14,.14],
});
const payload = packInstancePatches(cache, instanceParentLocalBounds);
const wrapper = makeWeatherGeometryShell(THREE, entry.geometry, payload);
// batch.mesh.geometry = wrapper.geometry; never mutate entry.geometry.
// Merge patchVertexDeclarations()/patchVertexAssignments() into vertex shader.
// Merge patchFragmentGLSL() before the material's water-consuming function.
// Wrap patchUniformValues(cache) in THREE uniforms:
// vec3 -> Vector3; mat3 -> Matrix3().fromArray(...); scalar -> number.
// Call w26CachedWaterAtReceiver(receiverPosition) before lighting/tone mapping.
// After preparing all domains, sampler.dispose() releases startup resources.
```

`cache.sampleParent([x,y,z])` returns `[broad,lowerDampFactor]`, not a final water mask or color. `cache.sampleWorld` and `toWorldMetres` are compatibility names for the same stable **receiver/group-local frame**, not an instruction to sample rebased world positions. Clearer aliases are `sampleReceiverMetres(cache, receiverPosition)` and `toReceiverMetres(domain, parentPosition)`.

### Stable parent frame and units

All position/dimension/spacing/field-scale values are metres. `parentOriginMetres` is the full parent domain center in stable receiver space, normally neighborhood/group space **before modelMatrix**. `parentBasis` contains three parent axes expressed as columns in receiver space. Frames must be right-handed orthonormal metre-preserving yaw frames; parent Y stays receiver +Y. `parentNormal` is a unit coarse-surface normal in parent space, canonicalized to Float32 before selecting the horizontal axis to match GPU diagonal ties.

Native brick vertex integration supplies a separate interpolated receiver coordinate:

```glsl
receiverPosition = (instanceMatrix * vec4(position,1.0)).xyz;
```

Keep original world/local/normal/projection/material coordinates. ModelMatrix translation/rotation and world-origin rebasing must not drift water. `w26ReceiverToParent` is the inverse parent rotation; `patchUniformValues` returns its column-major transpose correctly.

Use **one shared ground datum and complete height** for adjoining facades. The current three-home envelope reaches 5.35 m. A/B floors at 2.67 m must not restart yNorm. Upper C's elevated bottom is not a ground damp source. Coplanar adjoining surfaces reuse the exact origin, dimensions, fieldScale and seed. Changing them requires a cache/patch rebuild, not an isolated uniform change.

`p = parentLocalMetres / fieldScaleMetres` explicitly maps metres to the source's dimensionless p. This is a declared receiver-scale adaptation replacing implicit min-dimension normalization. At field scale 1 m, column pitch is 1/5.4 m. Original lowerDamp transition is 0.06H–0.34H; full dimensions, not half-extents, feed yNorm.

The coarse parent normal selects source `abs(n.x)>abs(n.z)` horizontal branch for the entire receiver. Fine brick bevel normals do not switch weather domains. This deliberate receiving-domain adaptation does not alter original material normals. Arbitrary tilted/curved surfaces and per-fragment source-axis switching are not claimed.

### Numeric grids, bounds and shared mesh lifecycle

- broad grid: parent horizontal axis × parent Y; original waterCoord, domainWarp and fBm.
- lowerDampFactor grid: parent X × parent Z; original smoothstep/fBm before its Y-height gate.
- Two guard nodes extend beyond each domain edge. Spacing is dimension/ceil(dimension/targetSpacing), no coarser than requested.
- Two 4×4 state patches + four origin-index floats occupy 144 bytes per instance. Each patch spans three cells. Parent-local min/max bounds must fit; oversized receivers fail rather than silently smearing or duplicating brick geometry.
- Interpolation uses global floor/fract before subtracting integer patch origins. Common 0.00002-cell boundary snapping limits Float32 grid-line rounding; at 0.14 m this band is at most 2.8 µm. It is never brick-local.
- Source brick envelope is ±[.134,.043,.070] m. Transform all eight box corners through the rigid instance and parent frame for bounds; don't pass untransformed template-local bounds.
- `makeWeatherGeometryShell` creates one lightweight batch wrapper, reuses the **same BufferAttribute and index objects**, and adds only 9 batch-specific InstancedBufferAttributes. It does not clone template arrays or build per-brick dense meshes.
- Dispose/remove batch mesh, then `wrapper.dispose()` while source templates still exist; it detaches shared attributes/index before dispatching geometry disposal. Dispose host material separately; dispose source templates after all users/wrappers. Wrapper disposal is idempotent and does not modify the host's entry.users counter.

### Noninstanced receiver / mortar adapter

`waterReceiverFragmentGLSL()` exports only the six common parent uniforms, the same original hash/cheap-water closure, and `w26WaterAtReceiverWithLow(vec3 receiverMetres,vec2 cachedLow)`. `waterReceiverUniformValues(cache)` returns those six values. Brick `patchFragmentGLSL()` embeds the identical common implementation.

A noninstanced mortar mesh can attach `cache.sampleWorld(receiverPosition)` as a vec2 vertex attribute, interpolate it and call the common function in fragment. Its low state is then **triangle-linear**, while brick is global bilinear. This is an explicit approximation; 80 mm vertices being denser than 140 mm cache cells does not prove zero error. Measure mortar-vs-original and mortar-vs-brick max/p99 at identical parent coordinates, particularly triangle diagonals. Preserve the shared datum/transform; do not rewrite the stochastic functions.

A large mortar primitive cannot use one brick patch if it exceeds three cells; packing rejects that. Numeric vertex sampling does not have that patch bound, but carries the stated interpolation approximation. This module does not claim the host mortar material is already integrated.

## Source lock and split

The source is the owned Library frozen transfer package identified by the restored `weather-audit/original-water-weather.mjs` metadata. Its local recovered HTML SHA-256 is:

`48580a0f53e07b4bbafb5473a844ca54fa5264886a6065cb18ef7b4a555250e1`.

The original historical audit associated it with HOUSE commit `cfdda86c60076a0418fe1922075ddaa34cb8019c3`; parent recovery reports that reference now returns 404. **This recovery verifies local frozen source bytes, not remote commit availability.** All ten extracted function hashes match their prior locked hashes and their exact definitions occur in the recovered HTML. waterWeatherMasks hash is `4314d8d4a569db5c14607b85cd9807069abd7dc8ed121268ef484a059163d1a3`.

hash31/valueNoise3/fbmValueFast/domainWarp are verbatim except `w26_` identifier namespacing, avoiding R3.12 hash collisions. Source statements for jitter, width, start, length, verticalGate and streakGate are sliced from the exact function. Cached values replace only broad and the height-independent lowerDamp factor. Runtime restores the original height gate and `clamp(streak*.92+broad*verticalGate*.32+lowerDamp*.58,0,1)`.

Full original weatherNoise/weatherFine appear only in the separate QA program, never in runtime water. No reliance on zero weather strength and speculative compiler elimination. Parent-authorized internal HOUSE-code reuse is the permission basis, not a claim that the entire source package is openly licensed. No source GLB, reference image or restricted external asset is included.

## Numerical GPU QA for host CI

```js
import {runWaterCacheNumericalQA} from './weather-cache/qa.mjs';
const report = runWaterCacheNumericalQA({
  renderer, domain,
  gridOptions: {targetSpacingMetres:[.14,.14,.14]},
  randomCount: 2048,
  // Optional measured acceptance thresholds:
  // maxWaterError: .05, p99WaterError: .02,
});
```

This compares original **full** waterWeatherMasks GPU outputs at actual numerical probes with:

1. Exact GPU low-state readback + cheap composition, isolating the algebraic split. Max error >2e-6 fails.
2. CPU bilinear cached state + GPU cheap composition. Reports max/p99/mean, reference range and timings.
3. The actual exported per-instance patch GLSL, at identical points. Reports the same original-field errors.
4. Same parent points through distinct staggered patch origins, checking CPU low-state and actual GPU final water. GPU seam >2e-6 fails.

Coverage includes interior, full boundaries, 6%/34% height transitions and either side of grid lines, with no background pixels diluting error. Optional max/p99 thresholds cover both cache and actual patch shader. QA reports original weather only as reference; there is no cached weather claim. Equivalence is under the declared receiver frame/scale/coarse normal, not the old reference object's min-dimension/fine-normal binding.

**Only CPU checks were executed in this recovery.** Actual GPU numbers, compile/link results and integrated visuals require the parent's authorized CI. No previous GPU evidence is fabricated or carried over as a new pass.

## Costs and limitations

For the tested 4,644 instances: additional retained CPU state = **668,736 bytes**, additional GPU instance payload = **668,736 bytes**. These are exact typed-array sizes, not measured driver allocation. Original eight templates remain shared (approximately 406 vertices / 624 triangles per template in the baseline).

9 vec4 extra attribute locations + original position/normal/mat4 = **15 locations**. Additional flat varyings consume 9 vectors; include the receiver position among host active varyings and use `assertWeatherAttributeBudget` before integration. A device budget check is not shader link success.

Cache retained bytes are `(broad nodes + lower nodes)*4`. Temporary RGBA32F attachment/readback bytes are rounded pixel count*16; attachments are disposed each call. Sampler programs/input GPU buffers remain until sampler.dispose(). Startup evaluates original low state with 20 valueNoise3 calls per sample including domainWarp; both low channels are evaluated at each probe in this retained design. Metrics distinguish setup, submission, blocking GPU/readback, CPU validation and total build.

Additional per-fragment water: five original hash31 calls, original streak/gates, two bilinear numeric reads; no fBm and no visible texture lookup. These source-level counts are **not measured GPU milliseconds**. Sampling is startup-only.

Host material must use the same water state in original **prelighting linear base color and roughness**, preserve brick identity/height/normals/geometry/seeds, and make strength zero bypass changes exactly. Final gamma-color tint is not this integration. This module does not replace a material or prove host channel integration.

Not implemented: roof/eave/window shelter, drip-source positions, rain amount, moisture storage/drying, drainage, runoff conservation/velocity or fluid simulation. Original random streak starts are not real window locations. No weatherFine, new pore geometry or displacement is added.

CPU rerun:

```sh
node --test --test-reporter=tap walled-city-neighbourhood-r01/weather-cache/cache.test.mjs
```
