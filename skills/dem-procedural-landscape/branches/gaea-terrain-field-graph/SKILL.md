---
name: gaea-terrain-field-graph
description: Design and validate Gaea-inspired, truth-preserving procedural terrain field graphs for real DEM pipelines, including multi-scale structure, deterministic seeds, bounded height deltas, data maps, structural color and material fields, Three.js or WebGPU mapping, continuous world-space runtime fields, adaptive terrain meshes, and fail-closed QA. Use for continuous terrain systems such as Guilin, Wenzhou, or Kunming; do not use to replace authoritative DEM, hydrology, coastline, or survey accuracy.
---

# GAEA Terrain Field Graph

Build a continuous field graph around immutable geospatial truth. GAEA-style operators may derive structure, bounded candidate deltas, masks, color, normals, roughness, and AO; they never become the system of record for DEM, CRS, transform, hydrology, coastline, or source provenance.

## Route the task

1. For field layers, scale bands, masks, seeds, and structural color, read [references/field-architecture.md](references/field-architecture.md).
2. For DEM immutability, protected masks, collision separation, tile continuity, and stop conditions, read [references/truth-boundaries.md](references/truth-boundaries.md).
3. For operator roles and the Guilin, Wenzhou, Kunming, multipass-erosion, and color recipes, read [references/node-recipes.md](references/node-recipes.md) and the machine-readable [references/terrain-graph-recipes.json](references/terrain-graph-recipes.json).
4. For continuous world-space fields, global river and paddy continuity, adaptive runtime geometry, interaction-quality scheduling, and the procedural knowledge mini-pack integration, read [references/procedural-field-knowledge-v100.md](references/procedural-field-knowledge-v100.md).
5. For the field-node contract, validate against [references/terrain-field-contract.schema.json](references/terrain-field-contract.schema.json). Treat `candidate-only` as a valid `truthImpact` state until QA and approval promote an output.
6. For CPU/GPU allocation, texture contracts, world-space sampling, LOD, and evidence attributes, read [references/threejs-webgpu-runtime.md](references/threejs-webgpu-runtime.md).
7. Before delivery, read and execute [references/qa-fail-closed.md](references/qa-fail-closed.md).
8. Use [scripts/terrain-field-reference.js](scripts/terrain-field-reference.js) only as a dependency-free teaching and integration kernel. Run `scripts/test-terrain-field-reference.js` after changing it.
9. For actual Gaea 2.x project construction, Build Swarm automation, DEM preflight, CRS restoration, or browser asset packaging, also load `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/skills/process-dem-with-gaea/SKILL.md`.

## Build the graph

Freeze the source contract first: source hashes, DEM semantics, CRS, horizontal and vertical units, transform, bounds, grid, NoData, authoritative hydrology and coastline, protected features, target use, permitted modification class, and reproducibility requirements.

Keep these stages distinct and independently inspectable:

```text
Truth
-> Derivatives
-> Macro and meso candidate structure
-> Process and separation masks
-> Bounded height delta
-> Data maps
-> Structural material and color
-> Runtime assets
-> QA and evidence
```

Use an untouched `Z_truth` branch. Compute real slope, curvature, and flow from the authoritative DEM. Use low-strength, multi-scale fields and approved process masks for candidate morphology. Apply every geometric result through a confidence and protected-feature gate:

```text
allowed = confidence * (1 - protected_mask)
delta = clamp(delta_raw, -budget_down_m, budget_up_m)
Z_render = Z_truth + allowed * delta
```

Keep `Z_collision` limited to truth plus specifically approved low-frequency deltas. Put sub-grid detail into normals, roughness, AO, and color rather than navigation or physics geometry.

## Preserve determinism and continuity

Split at least `shape`, `warp`, `geology`, `erosion`, `hydrologyVisual`, `color`, `microDetail`, and `ecology` seed channels. A change to a visual channel must not rearrange truth geometry or hydrology. Sample continuous fields in projected world coordinates and stable global hashes; never restart phase or seed at a tile boundary.

Treat authoritative river topology as a global object. Water station, bed, banks and material flow must share the same along-stream parameter. A render tile may clip the global result, but it may not independently invent, terminate or reseed a river. Use the same principle for paddy parent regions, parcel hierarchy, bunds and drainage.

Map GAEA adjustment nodes into the internal contract deliberately: range and combine operations are `utility`; appearance-only AutoLevel and Clarity operations may be `color`. Do not add undocumented node families merely to mirror a UI category.

## Compile the runtime

Run authoritative decoding, real hydrology, derivatives, bounded low-frequency deltas, seam synchronization, adaptive geometry compilation, and numeric QA on CPU or workers. Run micro-normal, material masks, normalized splat, color, roughness, AO approximation, and distance fading on GPU when appropriate. Keep the authoritative GIS raster separate from browser assets.

Prefer one continuous error-bounded mesh or seam-synchronised clipmaps over independently generated patches. During camera interaction, a runtime may reduce pixel ratio and distant material cost, then restore approved quality after interaction. It must not change field phase, seeds, geometry identity or truth provenance.

Generate evidence for `Z_truth`, every candidate delta, slope, curvature, real flow, rock, wetness, material weights, normals, final color, seeds, parameters, hashes, seams, LOD transitions, river continuity, adaptive mesh error, interaction quality, and fixed cameras.

## Fail closed

Stop promotion when truth hashes, CRS, transform, NoData, hydrology continuity, coastline position, protected features, delta budgets, tile seams, LOD continuity, determinism, browser decoding, or required evidence fails. On any critical failure keep:

```text
truthApproved = false
visualApproved = false
productionReady = false
```

Never relabel visual flow as real hydrology, never silently fill gaps or fall back to lower-resolution truth, and never describe an enhanced result as survey-grade. Preserve failed evidence and keep the previous approved version available.

## Provenance

This skill distills the user-provided `XIAOWANG_GAEA_TERRAIN_KNOWLEDGE_MINIPACK_2026-08-30_v1.0` and the later `PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30(3).zip` continuous-field extension. The first archive, extracted payload, manifest, and intake receipt are preserved under `knowledge/terrain-hydrology/shared/inbox/2026-08-30_xiaowang-gaea-terrain-minipack-v100/`. The later conversation attachment is registered under `knowledge/terrain-hydrology/shared/inbox/2026-08-30_procedural-field-knowledge-mini-v100/`. Source-package direct-execution prompts are retained as provenance only; they are not authorization sources.
