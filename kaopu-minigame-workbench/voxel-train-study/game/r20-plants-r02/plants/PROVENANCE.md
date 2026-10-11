# Current runtime: original native78 juvenile Ficus

The active R02 scene loads the experimental KAOPU plant profile and original native78 Ficus rules described in ../README.md, native-codec/README.md and rules/RESOURCE-LICENSES.md. Its original geometry/content and eight material resources are checked against the recovered source. It includes the original declared image-based proxy bark material.

The Pandanus extraction and compact dimension study below remain as an unused historical research anchor. The active Ficus runtime does not import pandanus.mjs. Statements below about no texture files concern that historical Pandanus generator only, not the current Ficus material resources. The compact and age-only Pandanus candidates were not visually accepted or published as this Ficus revision.

# Native Pandanus R05 extraction, train candidate

## Source and scope

- Source: `kaopu-tree-fractal-wave-lab/mobile-r05-seasons/runtime-pandanus-r05.js`, supplied from the existing KAOPU tree/fractal-wave workbench.
- Exact source SHA-256: `52eb572d6c692bf4c075d6eab0bcc84c5142e47c367f66408c256ca5d986b860`.
- Extraction date: 2026-10-10. The original workbench is unchanged. This is an independently hostable research-quality train candidate, not an approved final AAA asset or a measured botanical reconstruction.
- This is the native source's Pandanus model. It is not banana, banyan, a ball-tree substitute, a billboard, or an imported image/model.
- Existing vendored Three.js r170 is imported from `../../../vendor/three.module.js`; retain the host's `licenses/THREE-LICENSE.txt`. No external texture, model, package or network fetch was introduced.

## What is preserved

The seeded random streams, draw ordering and equations are retained for trunk drift/taper/bark noise, primary branch whorls, secondary shoots, root support arches and extensions, leaf rosette phyllotaxis and colors, scars and fruitlets. Original material color, roughness, metalness, vertex/instance-color handling, side settings and shadow flags are retained.

- Every leaf has 28 longitudinal segments, 5 cross-sectional columns, 145 vertices and 224 triangles. The `sin(pi*u)^0.62` width profile, alternating edge teeth, five-column folded rib and drooping centerline are unchanged. Leaf lengths, non-uniform instance scales, rotations and colors are the source's own equations.
- Rosettes keep separate transforms and the original two-axis breeze. Host seconds `t` replace original milliseconds `now`: `0.008*sin(1.1*t+phase)` and `0.013*sin(1.35*t+1.7*phase)`. The original base quaternion is restored before each update, so seeking or pausing does not accumulate drift.
- Roots keep 16-segment quadratic support paths, 11-segment extensions and source landing/extension depth. Root support and water bias have not been flattened or moved above ground.
- Scars retain the original torus `(1, .018, 5, 22)` and transforms. Fruit retains 58 instanced dodecahedral parts, its golden-angle distribution, non-uniform scales, colors and position.
- Tube ends remain open as in the source. Validation checks finite attributes, normals, legal indices and nonzero-area faces; it does not falsely certify every source tube as a closed watertight solid.

## Adaptations

`createPandanus({ seed, params })` returns `{ root, update(elapsedSeconds), dispose(), proof }`.

The source's own scene, camera, lights, ground, DOM controls, resize handlers, animation loop, clock and age autoplay are omitted. The train host supplies them where appropriate. Creation produces one immutable parameter snapshot; changing growth parameters requires disposing and creating a new asset. No host scale adjustment is introduced.

Static shoot tubes are concatenated into one geometry and static root tubes into another. Every vertex attribute and indexed triangle is copied in source order with index offsets; no simplification or recomputed normals are involved. Scars are submitted as one instanced mesh with the source torus and float32 model matrices. Leaves and fruit remain instanced exactly as before. Per-tree resources are owned independently. Disposal is idempotent and releases instance buffers plus each owned geometry/material once, including materials unused by a juvenile configuration.

At the source defaults and seed 50721, the result has 446 leaves, 14 rosettes, 9 root groups, 58 fruitlets, 118,750 submitted triangles, 5 geometries and 18 color-pass draw calls. The original has the same triangles and 73 color-pass draw calls. Counts exclude shadow passes, host culling and renderer overhead. Typed vertex/index/instance data total 379,652 bytes for this configuration; this is not total JS heap or a measured GPU allocation/FPS result.

## Units, parameters and bounds

All dimensions are source engineering metres. The source's `age` is a developmental score, not independently established years. The source's `height` is trunk height; overall bounds also include leaves and subsurface roots. No field measurements or taxonomic size claims are implied.

Defaults: seed 50721; age 72; light .18; water -.16; apical .66; resource .80; space .82; rootSupport 1; leafDensity .90.

The adapter rejects unknown, nonfinite and unsafe inputs rather than silently changing them. Its explicitly exported safety ranges are age 0–120; light/water -1–1; apical/resource/space 0–1; rootSupport/leafDensity 0–1.5. These are adapter bounds, not a claim about original UI ranges or biological validity. The seed is a safe integer normalized to uint32 and recorded in proof. The resolved parameter object is frozen and recorded in proof.

`proof.bounds` is the exact vertex-level rest-pose AABB in the asset's root-local coordinates at creation. `proof.breezeBounds` conservatively expands that box by `maximum leaf vertex radius * (.008 + .013)`. It includes every native breeze pose, but is not recomputed for later host translation/rotation/scale. The host must transform this box for placement and clearance checks. Repeated updates use only host time. `proof.engineeringHeight`, `triangles`, `drawCalls`, `geometries`, `materials`, `leafCount`, `rosetteCount`, `rootCount`, `fruitletCount`, `bufferBytes`, seed and resolved params are available for audit.

### Placement study for seed 50721

The following compact-source cases use resource .70, space .55, leafDensity .90 and all other defaults. Values are local engineering metres; ranges include conservative breeze.

| Age score | X width | Z range | Z width | Top Y | Draws | Triangles | Exact minimum root Y |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| 30 | 3.614 | -1.836 to 1.750 | 3.586 | 3.878 | 7 | 24,598 | -.120288 |
| 36 | 4.166 | -2.180 to 2.021 | 4.201 | 4.766 | 7 | 28,752 | -.114711 |
| 44 | 5.318 | -2.635 to 2.542 | 5.177 | 5.967 | 13 | 62,338 | -.107005 |
| 52 | 6.027 | -2.946 to 2.902 | 5.848 | 7.065 | 13 | 70,614 | -.101187 |

For comparison, the source defaults except age produce Z breeze widths 4.016, 4.634, 5.278 and 5.948 metres respectively. Lowering space is not a monotonic mesh shrink operation: it changes branch-selection thresholds and thereby later random-stream decisions. Actual bounds must be checked for every seed and parameter set.

The native roots intentionally penetrate the host ground. With the specified trunk origin at game ground +.081 m, the compact cases above end .039288, .033711, .026005 and .020187 m below game ground, respectively. Retain this behavior; do not float or flatten roots to make minimum Y equal zero. The uniform breeze box extends farther downward than the static roots and is conservative.

For a root centered at Z=-4.6 without rotation or scale, age 44's breeze box spans about -7.235 to -2.058 m, between a building front at -7.6 and the rail boundary at -1.6. Age 52 spans -7.546 to -1.698 m, leaving much less clearance. These are geometry checks only, not approval of final street placement or camera composition. Other seeds, orientations, door routes, setbacks and ground geometry need host validation.

## Reproducibility and validation

Run from a repository checkout with the existing Three vendor file:

```sh
PANDANUS_REFERENCE_SOURCE=kaopu-tree-fractal-wave-lab/mobile-r05-seasons/runtime-pandanus-r05.js \
  node --test kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/plants/pandanus.test.mjs
```

`PANDANUS_REFERENCE_SOURCE` can be an absolute or current-working-directory-relative path. The original source is evaluated only by tests, with a minimal status-text stub; it is not a runtime dependency or copied into the train asset. An explicit missing reference fails rather than silently skipping. Without that environment variable, the local research-copy relative path is tried. If neither is present, three direct-source tests are explicitly skipped and the self-contained pinned-hash tests still run. Do not describe a skipped source comparison as passed.

12 focused tests passed with zero skips against the exact source and vendored Three r170:

1. Three reproducible component-hash fixtures, repeated creation and identical proof.
2. Three direct original/adapted comparisons of every tube attribute/index, every leaf/fruit instance matrix/color, rosette position/base quaternion/phase, scar geometry/float32 matrices, material properties, triangle totals and bounds.
3. Explicit leaf-profile equations and full 145-vertex/224-triangle detail.
4. Finite, nondegenerate topology, normals, instance transforms and exact bounds over age scores 0, 3, 30, 36, 44, 52, 72 and 120.
5. Source-equivalent, seekable host-clock breeze and conservative bounds.
6. Single-disposal ownership and isolation between two assets.
7. Parameter/seed validation, frozen reproducible params and seed variation.
8. Static host-boundary check: no scene/camera/renderer, DOM, private timer, animation loop or asset fetch.

Pinned SHA-256 component signatures, in the test's canonical representation:

- Default: `117358d6ea57b00ba3595a68b04db06e448dec25c5b12e365f76d005262c01e3`
- Age 36, seed 50721, resource .7, space .55, density .9: `f0bd8da719800cbe7a71931503a18f9d4556b65e86294b764c9b066e66dcda72`
- Age 52, seed 873, resource .7, space .55, density .9: `b2c6fa608977267d8d5811efe39da958694e49c3a33b0f1f62c8deadebb1c75f`

These tests establish source-preserving extraction and CPU-side invariants. They do not establish browser frame time, shadow quality, film quality, device FPS or final scene integration. The host's browser/render/performance checks remain separate. No publication is performed by this extraction.
