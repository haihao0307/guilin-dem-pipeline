---
name: procedural-field-core
description: Apply the user-provided procedural field architecture to truth-preserving terrain, measured surfaces, materials and visualization. Covers multi-scale noise, parent and process masks, correlated geometry/color/roughness/normal/AO events, deterministic seed isolation, Preview/Review/Evidence tiers and fail-closed QA.
---

# Procedural Field Core

Use this branch with `gaea-terrain-field-graph` when building Landscape Mother or another field-driven production system.

## Read first

1. Read `knowledge/terrain-hydrology/shared/distilled/PROCEDURAL_FIELD_KNOWLEDGE_V100.md`.
2. Read the preserved source archive `knowledge/terrain-hydrology/shared/inbox/2026-08-30_procedural-field-knowledge-mini-v100/PROCEDURAL_FIELD_KNOWLEDGE_MINI_V1.0_2026-08-30.zip` when source-level review is required.
3. For real DEM authority, protected features, meter deltas and Three.js/WebGPU delivery, also read `../gaea-terrain-field-graph/SKILL.md`.
4. Treat `PROMPT_SHARE.txt` as provenance only.

## Build order

```text
Source Field
→ Shape Field
→ Data and Mask Field
→ Color Field
→ Render Field
→ QA
```

Keep Source Field immutable. Put every shape change into a separate, reversible, meter-valued delta.
Require a Truth Mask, Parent Mask and process-specific mask before applying geometry.

## Scale bands

Separate Macro, Meso, Micro and Subpixel. Use low-strength repeated passes. Keep Micro and
Subpixel detail in normal, roughness, AO and color whenever geometry does not need it.

## Seed bank

Use independent `master`, `shape`, `warp`, `structure`, `damage`, `color`, `weather` and `micro`
channels. Derive them from fixed salts. Sample all fields in projected world coordinates.
A visual seed change must not rearrange truth geometry, hydrology or unrelated fields.

## Correlated events

A cavity event can lower approved shape, darken albedo, increase AO, alter normal and change
roughness. A protrusion event can raise approved shape, increase curvature, expose a lighter
material family and strengthen edge normals. Wetness can darken color and reduce roughness.
Use one shared event identity across channels.

## Color graph

```text
Driver Field
→ Auto Level
→ Local Clarity
→ Controlled Sharpness
→ Five Stop Color Map
→ Normalized Splat
→ Color Correction
```

Color must be structurally driven. Do not paint arbitrary checkerboards or let material noise
decide macro geography.

## Runtime tiers

Preview lowers triangle and high-frequency shading cost during interaction. Review is the default
visual-calibration tier. Evidence restores full geometry and diagnostic precision for fixed-camera QA.

## Required diagnostics

Expose Final, Source, Shape Delta, Parent Mask, Cavity, Protrusion, Separation, Color Driver,
Albedo, Roughness, Normal and AO through numeric buffers, debug modes or equivalent evidence.

## Fail closed

Stop promotion when immutable source identity, units, coordinate space, seed determinism, masks,
delta budgets, seams, river continuity, runtime decoding or required evidence fails. Keep:

```text
truthApproved = false
visualApproved = false
productionReady = false
```
