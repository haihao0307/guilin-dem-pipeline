---
name: process-wenzhou-terrain-hydrology-v020
description: Transfer the verified Guilin terrain and hydrology production contracts into the Wenzhou 12.5 m DEM project, preserve immutable truth elevation, produce 2048 terrain assets, reversible 1 m procedural visual detail, fixed river centerlines, four geographic camera anchors, and a 1.6 m ground camera.
---

# Process Wenzhou terrain and hydrology v0.2

## Source skills and provenance

This project skill binds and adapts four repository skill families:

1. `GUILIN_V060_TERRAIN_HYDROLOGY_ONLY`
   Source ref: `fix/guilin-v060-terrain-hydrology-only`
   Source path: `ops/tasks/GUILIN_V060_TERRAIN_HYDROLOGY_ONLY.md`
   Transferred rules: immutable truth DEM, high-resolution grayscale enhancement masks, one terrain runtime, fixed centerline hydrology, lateral-only river-width control, camera anchors, browser diagnostics, release gates.

2. `dem-ecology-surface`
   Source ref: `skill/dem-ecology-surface-v050`
   Source path: `skills/dem-ecology-surface/SKILL.md`
   Transferred rules: production order, `z_truth_m`, `z_micro_delta_m`, `z_visual_m`, hard exclusions, hydrology continuity, riverbank sequence, world-coordinate continuity, stable procedural fields, QA and rollback.

3. `process-dem-with-gaea`
   Transferred rules: geospatial preflight, untouched truth branch, reversible terrain stages, restored transform after export, difference and slope QA, browser packaging. The Wenzhou runtime uses local grayscale fields and carries no external GAEA bridge dependency.

4. `generate-guilin-dem-fine-regions`
   Transferred rule: source-truth gating for detailed cores. Resampling and procedural detail retain their correct labels and may not be relabeled as measured high-resolution terrain.

The Kunming project migration pattern is retained as an implementation reference:

```text
project/kunming-dem-v001
projects/kunming/skills/process-kunming-dem-first-pass/SKILL.md
projects/kunming/HANDOFF_KUNMING_GUILIN_SKILL_V001.md
```

## Authoritative Wenzhou truth release

```text
source: WENZHOU_QINGJIANG_22000KM2_12_5M_COG.tif
SHA-256: 8a1bc6ee17dd731007804a0281f9e083e01f5745468f90cf2c11c108ec0b1c6e
CRS: EPSG:32651
pixel spacing: 12.5 m
native grid: 11866 × 11866
bounds: 239645.652694, 3054965.110786, 387970.652694, 3203290.110786
area: 22000.305625 km²
source DEM count: 13
```

The COG, source-count grid, marine mask, transform, bounds, NoData classification, and checksum are read-only.

## Height model

```text
z_truth_m
read-only value from the authoritative COG

z_micro_delta_m
bounded, reversible procedural visual increment

z_visual_m
runtime display height derived from truth and approved visual increment
```

The vertical scale is permanently 1:1. The skill contains no vertical-exaggeration control and no contour system.

## Resolution contract

The browser candidate uses:

```text
full-area height asset: 2048 × 2048
local core height asset: 2048 × 2048
local core footprint: 25.6 km × 25.6 km
local core truth spacing: 12.5 m
procedural visual detail scale: 1.0 m
minimum ground-camera clearance: 1.6 m
```

Every 2048 asset is built directly from the authoritative COG or an approved derivative on that lineage. Upscaling an old preview is prohibited.

## Four camera anchors

```text
温州城: 120.66682, 27.99942
仙溪镇: 121.06631, 28.41754
海门城: 121.45000, 28.68333
雁荡山: 121.05030, 28.36970
```

They are camera and active-core states on one terrain runtime.

## Wenzhou geomorphology adaptation

Required grayscale fields:

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

`danxia_visual_mask` is a layered visual-response field. It carries no unverified geological classification. Yandang uses a volcanic-cliff profile with strong cliff, fracture, weathering, collapse-debris, erosion-channel, and high-shoulder response.

Regional profiles:

```text
oujiang_alluvial_city
low relief, alluvial sediment, riverbank microterrain, urban exclusions

yandang_west_mountain_town
mountain valleys, cliffs, fractures, local terraces and colluvial fans

jiaojiang_estuary_city
estuary sediment, tidal and riverbank microterrain, coastal and urban exclusions

yandang_volcanic_cliff
strong volcanic cliffs, fractures, erosional gullies, collapse debris, rubble and scree
```

Guilin-specific Li River, Xiang River, karst presets, crop catalogs, ecology binaries, and camera locations remain excluded.

## Procedural visual-detail rules

1. Detail phase uses EPSG:32651 world coordinates and remains continuous across cores.
2. Near displacement is bounded and reversible.
3. Normal, parallax, roughness, and instanced geometry may carry sub-pixel detail.
4. The runtime label is `1 m procedural visual detail`.
5. Truth elevation stays unchanged.
6. Mask diagnostics expose values from 0 through 1.
7. Large collapse debris uses stable instanced geometry.
8. Medium rubble uses a separate deterministic instance stream.
9. Fine gravel uses surface response and a limited near-geometry budget.
10. Debris follows cliff toes, collapse paths, gullies, fans, and approved exclusions.

## Hydrology contract

The canonical centerline asset is source-traceable, named, topology-checked, and checksummed.

The river-width control changes left and right lateral offsets only. It may not change centerline coordinates, total length, bounds, vertex count, direction, topology, or name.

Required invariant widths:

```text
0.50 ×
1.00 ×
2.00 ×
4.00 ×
```

The canonical centerline SHA-256 and total length remain identical at all four values.

The riverbank microterrain field is derived from distance to the fixed centerline, terrain cross section, slope, curvature, sediment, floodplain position, and hard exclusions.

## Ground camera

Ground mode samples `z_visual_m` and applies:

```text
eye height = z_visual_m + 1.6 m
```

Movement follows the surface, maintains clearance, respects the active core boundary, and supports a controlled core handoff.

## Runtime and release gates

A candidate cannot become the default release until it passes:

```text
truth checksum immutability
2048 full asset validation
four 2048 core validations
vertical scale 1:1
no vertical-exaggeration code path
no contour code path
mask range and continuity QA
procedural-delta bounds and rollback
four camera-anchor tests
1.6 m ground-clearance tests
named centerline continuity
river-width invariants
debris distribution and exclusion QA
all local assets HTTP 200
browser console zero errors
desktop and mobile interaction tests
2048 square screenshot test
Windows package integrity
online endpoint verification
rollback test
controller visual approval
```

Keep the preceding stable Wenzhou release available until the v0.2 candidate is approved.