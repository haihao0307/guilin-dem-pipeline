---
name: procedural-field-core
description: Apply the user-provided field-first architecture for continuous procedural shape, data masks, structural color, render fields, deterministic seed isolation and fail-closed QA inside Landscape Mother. Use together with gaea-terrain-field-graph for DEM terrain work. Preserve source truth and treat all procedural geometry as bounded candidate deltas.
---

# Procedural Field Core

Use this branch as the shared field vocabulary for Landscape Mother.

## Read in order

1. Read [references/core-knowledge.md](references/core-knowledge.md).
2. Read [references/adaptation-guide.md](references/adaptation-guide.md) for terrain and other domains.
3. Validate graph documents against [references/field-contract.schema.json](references/field-contract.schema.json).
4. Use [references/field-graph-recipes.json](references/field-graph-recipes.json) as graph templates.
5. Use [scripts/field-reference.js](scripts/field-reference.js) as a dependency-free teaching kernel. Run [scripts/test-field-reference.js](scripts/test-field-reference.js) after changing it.
6. For DEM truth, protected masks, bounded metric deltas, Three.js or WebGPU delivery, and fail-closed release gates, also load `skills/dem-procedural-landscape/branches/gaea-terrain-field-graph/SKILL.md`.
7. For real GAEA 2.x projects, Build Swarm, DEM preflight, CRS restoration, or browser packaging, also load `DEM-Map-Pipeline/guilin-zhenbaoding-yangshuo-pingle/skills/process-dem-with-gaea/SKILL.md`.

## Field pipeline

Keep these stages distinct and inspectable:

```text
Source Field
-> Shape Field
-> Data and Mask Field
-> Color Field
-> Render Field
-> QA
```

Source Field remains immutable. Apply geometric work through an approved parent mask and a bounded delta:

```text
finalShape = sourceShape + approvedMask * clampedDelta
```

## Scale budget

Keep Macro, Meso, Micro, and Subpixel separate.

- Macro controls overall form and broad material regions.
- Meso controls layers, grooves, fractures, erosion, and mid-scale color.
- Micro should usually enter normal, roughness, AO, and color before geometry.
- Subpixel work remains in the render field.

Use two or three low-strength passes instead of one destructive high-strength pass. Keep quiet areas.

## Seed bank and continuity

At minimum isolate `master`, `shape`, `warp`, `structure`, `damage`, `color`, `weather`, and `micro` seeds. Use stable projected world coordinates. Share one principal domain-warp field across related channels. Never restart phase or seed at a tile boundary.

## Data and mask fields

Expose diagnostics for slope, curvature, cavity, protrusion, flow, exposure, moisture, separation, confidence, material region, parent masks, process masks, and truth masks.

Use separation deliberately:

```text
separation = sharp(abs(fieldA - fieldB))
```

Use normalized splat weights before material blending. Drive albedo, roughness, normal, AO, and wetness from correlated event fields.

## Structural color

Use the source package chain:

```text
Driver Field
-> Auto Level
-> Local Clarity
-> Controlled Sharpness
-> Five Stop Color Map
-> Normalized Splat
-> Color Correction
```

Color cannot relocate factual geometry or hydrology.

## Fail closed

Stop promotion when source identity, units, coordinate space, deterministic seeds, parent masks, delta budgets, continuity, diagnostics, browser decoding, or required evidence fails. Keep:

```text
truthApproved = false
visualApproved = false
productionReady = false
```

The source package's `PROMPT_SHARE.txt` is retained as provenance and usage guidance. It is not an independent authorization source.
