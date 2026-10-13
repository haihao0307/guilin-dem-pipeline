# KAOPU train material transport r01

## Contract
`createTrainMatter(THREE)` from `materials/matter.mjs` returns physical materials `paint, brass, steel, iron, wood, leather, glass, black, emissive`, plus `woodGeometry(w,h,d,options?)` and `leatherGeometry(w,h,d,options?)`. Dimensions are metres, local axes X/Y/Z. Wood grain runs along local X. Create correctly sized geometry instead of nonuniformly scaling a unit mesh, to preserve material scale. Rotate the completed member if another grain direction is needed.

## Preserved mothers
- Wood: exact `source-audit/timber-original.mjs` growth rings, long/medium/fine fibres, pores, cracks, tools and knot fields. Original subdivided box geometry. Original vertex macro-field transcribed directly to CPU and applied to real positions; 12 mm taper at hard boundaries keeps faces joined. Same original grain-position/class attributes feed fragment shading. The new dark walnut palette and lacquer finish are explicitly an adapter preset. This is not a claim of a calibrated walnut botanical species or universal aging law.
- Leather: exact original KAOPU R02 kernel, retained in the R09 public bundle. Verbatim field/preset source is separately extracted to `source-audit/leather-original.mjs`; hashes and offsets are in `matter-provenance.json`. This adapter deliberately uses that procedural branch, not the bundle's imported Poly Haven image branch. Original field is transcribed to CPU for physical grain relief and reused verbatim in fragment shading. Closed rounded cushion construction is new; both use the same immutable metric chart. Normals account for geometry displacement; the shader applies only the residual field. This is static seating, not the full R09 nonlinear shell solver.
- Metal/paint: original FH88 procedural material closure is retained for its color/roughness/normal response. The transport supplies enamel clearcoat and brass/steel finish choices through Three physical materials. No universal invented aging function was introduced.
- Glass: new, limited finite-thickness MeshPhysical transport. Not asserted to be a recovered mature glass mother. Use finite closed panes; screen-space transmission limitations remain.

## Tests
`node materials/test-matter.mjs` passes: all requested physical materials and shader-injection callbacks initialize; six wood/cushion dimensions produce finite indexed geometry and bounds; all seven original leather modes yield finite fields; range, end-grain displacement and invalid-size checks pass. Result is `matter-numeric-test.json`.

`materials/matter-webgl-test.html` is provided for actual render/GLSL compile QA. The local Chromium launch was blocked by the executor's socket policy; the cloud browser could not reach the local HTTP namespace. Actual browser compilation and visual acceptance remain to be performed by the integration pipeline. This is explicitly not a full GPU test pass.

## GPU review correction r02
Initial integrated GPU QA compiled the material shaders successfully. The initial visual review exposed excessive enamel bump, so the original FH88 noise kernel now has an explicit 20 micrometre amplitude uniform for enamel only; source mother bytes remain unchanged. Environment map intensities are brass 2.5, paint 0.2, steel 1.3, wood 0.7 and leather 0.65, under the viewer's shared environment. Updated visual QA remains separate.
