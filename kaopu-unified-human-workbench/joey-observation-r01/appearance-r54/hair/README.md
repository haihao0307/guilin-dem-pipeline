# R14.2 coverage on the fixed R52 common mesh

This is a separate static scalp-coverage layer, with the original R14.2 45–160 mm recipe domain. Keep the existing R30 8,000 long strands as a separate mesh. No head replacement, cap mesh, teacher guide asset, learned weight, or dynamic-physics claim is included.

## Integration

Import `attachR14Coverage` from `R14CoverageLayer.js`, then:

```js
const coverage = await attachR14Coverage(api, {
  count: 36000,
  segments: 24,
  recipe: {style: 'side-flow', color: '#21170f'},
  onProgress: (stage, progress) => {},
  onInvalidated: reason => console.warn(reason)
});
const report = coverage.report();
coverage.setVisible(false);
coverage.setVisible(true);
```

`api.motion()` must return the existing native controller/model and viewer. The default is 36,000 potential roots, 24 segments, standard side-flow 110 mm. The count guard allows 1,000–36,000 roots, and the segment guard allows 12–32. Do not duplicate this budget across multiple people. Recipe validation refuses lengths above 160 mm. The side-flow preset suits the backward sweep of the preserved long hair more closely than the central curtain preset, but visual compatibility still needs actual browser QA.

Methods and properties:

- `mesh`: actual Three.js ribbon mesh; centerlines are real 3D curves.
- `report()`: current validity, all input/curve fingerprints, measured root error, finite checks, original and displayed counts, collision/guard diagnostics, framebuffer/material diagnostics, and exact expanded geometry bytes.
- `rootRecords`: original source triangle IDs, barycentrics, exact common source map, current display root points and normals for independent QA.
- `setVisible(bool)`: refuse a stale layer when turning it on.
- `assertCurrent()` / `update()`: verify that the static binding still matches. They do not deform or simulate strands.
- `dispose()`: remove and dispose only this layer.

After face, expression, pose, or other common-vertex changes, the old layer becomes invalid and is hidden before it can emit visible or shadow triangles. All displayed positions and topology are compared to the captured state. `report()` also checks for changes while hidden. `setVisible(true)` and `update()` throw for stale geometry. Dispose the old layer, finish changing the native model, and await `attachR14Coverage(...)` again. Compilation is cancelled if geometry changes during compilation. Rigid object transform/camera changes can be synchronized without recompiling.

## Binding and collision contract

1. The unmodified original GNM template drives R14.2's deterministic root-domain sampling.
2. Each sampled original triangle + barycentric record must resolve through exact `[id,id,0]` GNM recipes to the same-oriented triangle in both the native common topology and the actual displayed index. Missing or reversed supports reject the layer.
3. The three source-near anchors `[-.07,.32,.015]`, `[.07,.32,.015]`, `[0,.395,0]` define the established R30 source/display similarity frame. Its x/y scales are averaged.
4. The root positions and normals are evaluated on the current common mesh and inverted into that frame before compilation.
5. SkinField and both segment guards receive the entire actual displayed common mesh, also inverse transformed. No original teacher head substitutes for collision geometry.
6. Compiled curves and normals are transformed back to display coordinates. Every root must stay within 2 micrometres of its true common barycentric point plus the original 20-micrometre source-domain root lift (scaled by the frame).
7. The original R14 FiberMaterial shades the curves using the existing scene lights. Fibre radii use the same scale as the centerlines. Expanded 36,000 × 25 × 2 vertices use 93.6 MB for attributes, plus up to 20.736 MB of indices; report exact active-root index cost. Temporary compiler structures increase peak CPU memory.

Ear/head correction remains R14's bounded approximation. A successful compile is not a proof that every finite-radius shaft is collision free. Actual visual/collision QA is still required.

## Verification and provenance

Run `node test-r14-coverage.mjs`. Ten CPU contract groups cover frame roundtrip/normal transport, invalid input, exact mapping, same-oriented support, no mutation of source/actual geometry, real triangle-based collision input, root error, bounded recipe ranges, the no-loader/no-teacher-assets import boundary, and complete runtime-relative import resolution. `CPU-TEST-RESULT.json` records the result. The final wrapper also passed `node --check`.

`SOURCE-MANIFEST.json` records the fixed upstream commit and every original source's SHA-256 and Git blob SHA-1, plus all shipped file digests and excerpt boundaries. Upstream: `haihao0307/guilin-dem-pipeline`, `kaopu-hair-workbench/fusion/r14`, commit `c40a86c92b2fe37179e29a67628bf26303745d60`.

Source extractions:

- `SemanticSampler.js`: original deterministic `createRng` only; no GNMModel import/weights.
- `HairLayer.js`: original `FullerScalpBinding` and its small helper/import context only; no old material or mesh.
- `TeacherGroomBinding.js`: original dependency-free BVH and geometric helper section only; no teacher curve data or teacher groom adapter.
- `StrandCore.js`: original `sampleTriangle` only; no Perm filters, Digital Salon springs, or extra curve algorithms.
- `FiberMaterial.js`: original material with Three import changed to the required native vendor URL.
- Other shipped R14 modules retain the verified source bytes.

Actual GNM template compilation and rendered visual QA are intentionally left to the approved integration/browser task. This package has not published anything.

## First real integration correction

The first actual R52 render showed forward strands over the eyes. R14 forward crown and fringe direction is retained in its original source audit, but this adapter now imports AppearanceFlowR54 for front/top side-back mid-shaft styling. Original root emergence (first 3 mm) and low/rear roots remain unchanged; the transition reaches its authored direction over 3–18 mm. This is a local integration change, not an upstream R14.2 preset or proven mature long hairstyle. Keep the real collision guards and visual review.
