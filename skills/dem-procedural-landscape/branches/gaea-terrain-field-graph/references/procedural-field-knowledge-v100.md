# Procedural Continuous Field Extension v1.0

Use this reference together with `field-architecture.md`, `truth-boundaries.md`, `node-recipes.md`, `threejs-webgpu-runtime.md`, and `qa-fail-closed.md`.

## Purpose

Extend the GAEA-inspired field graph into a continuous Landscape Mother runtime. The runtime must preserve geospatial truth while replacing tile-local procedural decisions with stable world-space fields.

## Required field domains

```text
truth
terrain derivatives
real hydrology
landform confidence
process masks
separation masks
protected masks
bounded metre deltas
data maps
structural colour
runtime LOD
QA evidence
```

## Continuity rules

1. Evaluate every procedural field in projected world coordinates.
2. Use stable global hashes. Never restart phase or seed at a tile edge.
3. Keep the `shape`, `warp`, `geology`, `erosion`, `hydrologyVisual`, `color`, `microDetail`, and `ecology` seed channels independent.
4. Treat river topology, centreline station, water profile, bed and banks as one global object.
5. Treat paddy parent areas, parcel hierarchy, bunds and drainage as one connected world-space system.
6. Let tiles and LOD control storage and display only.

## Geometry policy

```text
Z_render = Z_truth + allowed_morphology_delta + approved_river_delta
allowed_morphology_delta = confidence * process * separation * (1 - protected) * bounded_delta_m
```

Do not move authoritative peak locations, main valleys, rivers, lakes, shoreline, roads, settlements, airports, CRS, transform or NoData. Keep collision on truth plus explicitly approved low-frequency deltas. Put sub-grid detail into material response.

## Runtime policy

Use workers for decoding, derivatives, multi-scale filters, bounded deltas, real river preparation and adaptive mesh compilation. Use the GPU for material masks, colour, roughness, normal detail and distance fading. Prefer one continuous adaptive mesh or seam-synchronised clipmaps over many independently generated patches.

During camera interaction, reduce pixel ratio and distant material work. Restore the approved quality after interaction. Geometry identity and procedural phase must remain unchanged.

## Required QA

```text
truthMutationCount == 0
protectedMorphologyViolationCount == 0
tileSeedRestartCount == 0
riverInternalBreakCount == 0
waterProfileReversalCount == 0
waterBedPenetrationCount == 0
lodCrackCount == 0
browserDecodeErrors == 0
```

Automatic QA cannot set `visualApproved` or `productionReady` to true. Preserve `false` until explicit visual approval.
