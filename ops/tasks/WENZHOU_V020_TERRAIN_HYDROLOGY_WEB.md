# Wenzhou DEM v0.2 terrain and hydrology web task

## Execution constraints

Work only on branch `project/wenzhou-v020-terrain-hydrology-web`.

The branch starts from PR #42 head `44dc9e4bca935756da2f6adef37e06e6a48e06d3`. Keep the new pull request open and Draft. Do not merge, do not push to `main` or `gh-pages`, do not force push, and do not replace PR #42.

Before implementation, read and transfer the relevant contracts from these repository refs:

1. `fix/guilin-v060-terrain-hydrology-only:ops/tasks/GUILIN_V060_TERRAIN_HYDROLOGY_ONLY.md`
2. `skill/dem-ecology-surface-v050:skills/dem-ecology-surface/SKILL.md`
3. `project/kunming-dem-v001:projects/kunming/skills/process-kunming-dem-first-pass/SKILL.md`
4. `project/wenzhou-qingjiang-22000km2-dem-v001:projects/wenzhou/web/data/manifest.json`
5. `project/wenzhou-qingjiang-22000km2-dem-v001:projects/wenzhou/reports/WENZHOU_QINGJIANG_QA_REPORT.json`, when present locally or in the production handoff

Create a Wenzhou project skill under `projects/wenzhou/skills/` and record the source ref, source path, source commit, transferred rule, adaptation, and exclusions for every migrated Guilin rule.

## Immutable terrain truth

The authoritative terrain remains the verified Wenzhou COG:

```text
WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif
SHA-256: 8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e
CRS: EPSG:32651
native grid: 11866 × 11866
pixel spacing: 12.5 m
bounds: 239645.652694, 3054965.110786, 387970.652694, 3203290.110786
area: 22000.305625 km²
source DEM count: 13
```

Keep these three concepts separate:

```text
z_truth_m
read-only elevation sampled from the authoritative COG

z_micro_delta_m
reversible procedural visual increment

z_visual_m
runtime display height derived from z_truth_m and approved z_micro_delta_m
```

The truth COG, transform, dimensions, NoData classification, source-count raster, marine mask, bounds, and checksum may not change.

Any 1 m detail in this task is `1 m procedural visual detail`. It may use displacement, normal, parallax, roughness, tessellation, or instanced geometry. It may not be described as measured 1 m DEM, native 1 m terrain, or survey-grade 1 m elevation.

## Remove two former features completely

1. Remove vertical exaggeration from the runtime, UI, saved state, query parameters, keyboard shortcuts, shader uniforms, screenshots, help text, and tests. The vertical scale is fixed at 1:1.
2. Remove contour rendering from the runtime, UI, shaders, assets, diagnostics, screenshots, help text, and tests.

Add repository and browser tests that fail when a vertical-exaggeration control, exaggeration shader uniform, contour control, contour shader branch, or contour asset is reintroduced into `web/wenzhou-v020/`.

## 2048 terrain precision

Create the new self-contained route:

```text
web/wenzhou-v020/index.html
```

with local JavaScript, CSS, manifests, and binary or texture assets under `web/wenzhou-v020/`.

Required data products:

1. One full-area 2048 × 2048 truth-height texture derived from the authoritative COG.
2. Four local 2048 × 2048 truth-height textures. Each local texture covers exactly 25.6 km × 25.6 km at 12.5 m spacing and is cut from the same COG with the same CRS and pixel origin.
3. A source-validity texture, marine texture, terrain-derivative textures, hydrology texture, and mask atlas at 2048 resolution where applicable.
4. A verified 2048 × 2048 screenshot path that renders a square frame at the requested resolution independent of the browser viewport.
5. A manifest with checksums, dimensions, transforms, source lineage, and the declared procedural visual detail scale.

Do not resample a low-resolution preview back to 2048. Build every 2048 product directly from the authoritative COG or from approved derivatives computed on that lineage.

## Four geographic camera anchors

Use one terrain runtime and four camera anchors. A camera button changes camera and active local asset state only. It may not substitute unrelated terrain or a proxy demo.

```text
温州城
WGS84: 120.66682, 27.99942
EPSG:32651: 270558.9123, 3099332.0532
profile: oujiang_alluvial_city

仙溪镇
WGS84: 121.06631, 28.41754
EPSG:32651: 310592.7935, 3144978.2366
profile: yandang_west_mountain_town

海门城
WGS84: 121.45000, 28.68333
EPSG:32651: 348562.2340, 3173885.4365
profile: jiaojiang_estuary_city

雁荡山
WGS84: 121.05030, 28.36970
EPSG:32651: 308938.4435, 3139702.0630
profile: yandang_volcanic_cliff
```

Each anchor needs a reproducible coordinate manifest, projected-coordinate check, AOI containment test, camera screenshot, and active-core checksum.

## Minimum 1.6 m ground camera

Provide an explicit near-ground mode with collision against `z_visual_m`.

```text
camera eye height = local z_visual_m + 1.6 m
minimum clearance = 1.6 m
```

Requirements:

1. Ground entry works from all four anchors.
2. WASD and arrow-key movement follow the surface.
3. The camera may not tunnel below terrain, float above the declared clearance, or leave the active local core without a controlled handoff.
4. A browser test samples at least 100 movement frames per anchor and verifies minimum clearance greater than or equal to 1.6 m within numerical tolerance.
5. Orbit zoom alone does not count as ground access.

## Reversible geomorphology masks

Generate independent high-resolution grayscale fields and expose each field in a diagnostics selector:

```text
danxia_visual_mask
cliff_mask
erosion_mask
sediment_mask
plateau_mask
terrace_mask
fracture_mask
yandang_volcanic_focus_mask
debris_large_mask
debris_medium_mask
debris_small_mask
riverbank_microterrain_mask
```

The `danxia_visual_mask` describes layered red-bed-style visual response only. Do not use it as a geological classification where source geology has not verified Danxia landform. The Yandang profile must identify Yandang as a volcanic-cliff focus and use `yandang_volcanic_focus_mask` to control the strongest cliff, fracture, collapse-debris, weathering, and erosion response.

Required terrain logic:

1. `cliff_mask` combines slope, local relief, profile, convexity, and persistent rock exposure.
2. `erosion_mask` follows downhill convergence, concavity, drainage relationship, and scale-separated noise.
3. `sediment_mask` follows low slope, depositional position, floodplain or footslope context, and distance to fixed drainage.
4. `plateau_mask` identifies broad shoulders and high flat surfaces without converting them into farmland.
5. `terrace_mask` keeps natural terraces separate from future artificial agricultural terraces.
6. `fracture_mask` uses oriented, scale-separated, globally stable fields constrained by exposed bedrock and cliffs.
7. `riverbank_microterrain_mask` is confined to a bank band derived from fixed centerlines and terrain relationship.
8. Every mask uses projected world coordinates so phase does not restart at tile or core boundaries.
9. Every visual delta is reversible, bounded, versioned, and separately adjustable.

The local near-ground shader or material system must show an effective 1 m procedural visual-detail scale while leaving `z_truth_m` untouched.

## Collapse debris and rubble

Add three separately controlled geomorphology classes:

```text
large collapse debris
medium rubble
fine gravel and fractured scree
```

Requirements:

1. Large blocks use deterministic, terrain-conforming instanced geometry with stable IDs.
2. Medium rubble uses denser deterministic instancing with a separate size and density range.
3. Fine gravel uses procedural displacement, normal, parallax, roughness, and a limited near-geometry budget.
4. Distribution follows cliff toes, collapse paths, erosional hollows, depositional fans, and Yandang profile masks.
5. Large blocks may not appear in active water, urban cores, roads, or unsupported flat plains.
6. The three classes need separate mask diagnostics, density controls, instance counts, and performance reports.
7. Avoid abrupt model popping. Transition gradually through screen footprint, parallax, and geometry budgets.

## Riverbank microterrain

Create a riverbank detail field from fixed drainage centerlines, local cross section, slope, curvature, floodplain position, and sediment context.

The bank field may control small ridges, scours, bars, roughness, wet margins, exposed sediment, fine gravel, and vegetation exclusions. It may not move the river centerline or silently rewrite the truth DEM.

## Fixed hydrology centerlines and river width

Build the public candidate from reproducible official or OpenStreetMap source geometry. Preserve source feature IDs, normalized names, acquisition metadata, scripts, checksums, and topology diagnostics.

Rules:

1. Centerline coordinates are immutable after validation.
2. Preserve branches, confluences, and named main-channel continuity.
3. Snap endpoint gaps only within a declared tolerance and record every repair.
4. Store a canonical centerline GeoJSON and SHA-256 checksum.
5. Derive left and right banks from lateral cross-section offsets.
6. The river-width slider changes only lateral width.
7. The slider may not scale, translate, rotate, stretch, shorten, smooth, resample, or replace the centerline.
8. Seasonal state may change water level and material response after the centerline gate passes. It may not change centerline coordinates.

Required invariant test:

```text
width multipliers: 0.50, 1.00, 2.00, 4.00
centerline coordinate SHA-256: identical for all four values
centerline total length: identical within 1e-6 relative tolerance
centerline bounds: identical
centerline vertex count: identical
only left and right lateral offset distances change
```

The initial offline review artifact may use a clearly labeled fixed DEM-derived review network. Public release remains blocked until the official or OpenStreetMap centerline asset passes continuity, checksum, and source-provenance QA.

## Migrated Guilin skill package

Create:

```text
projects/wenzhou/skills/process-wenzhou-terrain-hydrology-v020/SKILL.md
projects/wenzhou/config/guilin_skill_binding_v020.json
projects/wenzhou/HANDOFF_WENZHOU_GUILIN_SKILL_V020.md
```

Transfer these Guilin contracts into the Wenzhou project:

1. Immutable truth terrain and reversible visual fields.
2. `z_truth_m`, `z_micro_delta_m`, and `z_visual_m` separation.
3. High-resolution grayscale terrain enhancement fields.
4. Fixed centerline hydrology with lateral-only width adjustment.
5. One terrain runtime with named camera anchors.
6. World-coordinate continuity across tiles and cores.
7. Source lineage, checksums, browser QA, Windows package, release gate, and rollback.

Adapt the regional profile from Guilin karst to Wenzhou volcanic cliffs, coastal mountains, alluvial plains, estuaries, islands, and riverbank sediment. Do not transfer Guilin-specific Li River, Xiang River, karst-strength assumptions, crop catalog, ecology assets, camera locations, or proxy core demos.

## Browser interface

The new page must expose:

1. Four geographic camera buttons.
2. Full-area view.
3. Ground mode at 1.6 m.
4. Grayscale mask diagnostics.
5. Controls for cliff, erosion, sediment, plateau, terrace, fracture, large debris, medium rubble, fine gravel, and riverbank microterrain.
6. A river-width slider with visible invariant status.
7. A centerline diagnostics toggle.
8. Source truth, current texture resolution, active core, camera clearance, centerline checksum, and browser FPS.
9. A 2048 × 2048 screenshot button.
10. Explicit text stating `1 m procedural visual detail` and `12.5 m truth DEM`.

The page must contain no vertical-exaggeration control and no contour control.

## Required validation

1. Truth COG SHA-256 unchanged.
2. Full-area height texture is exactly 2048 × 2048.
3. All four local height textures are exactly 2048 × 2048.
4. Local textures align to the same CRS, pixel grid, and origin as the truth COG.
5. No vertical exaggeration runtime path exists.
6. No contour runtime path exists.
7. All grayscale masks are available and bounded to 0 through 1.
8. Procedural visual delta remains within declared bounds and is reversible.
9. Four anchors load one terrain system and correct local assets.
10. Ground mode stays at least 1.6 m above `z_visual_m`.
11. Centerline width invariants pass at four width multipliers.
12. Named river topology contains no disconnected main-channel output.
13. Large, medium, and fine debris distributions obey masks and exclusions.
14. All local assets return HTTP 200.
15. Browser console errors equal zero.
16. Desktop and 390 × 844 mobile interaction tests pass.
17. A complete Windows-compatible local package is produced.
18. A directly open inspection route is produced only after all gates pass.

## Delivery

Commit all work to `project/wenzhou-v020-terrain-hydrology-web` and push normally.

The final PR comment must include:

```text
commit SHA
changed-file list
exact inspection URL
exact local package path or artifact
truth COG checksum
full and four-core texture dimensions
four anchor coordinate checks
mask QA summary
ground-clearance test summary
centerline source and checksum
centerline continuity metrics
river-width invariant test results
large, medium, and fine debris counts
browser console result
desktop and mobile screenshots
remaining blockers
```

Keep the pull request Draft and leave publication disabled until controller visual approval.