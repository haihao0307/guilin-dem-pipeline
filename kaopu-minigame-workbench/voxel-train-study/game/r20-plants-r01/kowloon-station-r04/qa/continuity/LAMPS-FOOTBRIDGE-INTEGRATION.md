# Complete R02 lamp and footbridge functions

Local reconstruction modules:

- `native-station-lamps.mjs`: six actual children (arm, brace, stem, tapered shade, glass bulb, enamel sign), including original sections and faceting. Source lettering metadata remains an explicit outline-binding requirement.
- `native-footbridge.mjs`: all 895 frozen source children at source datums; 1,009 children at R04 datums. The shader uses 51 finite analytic groups, not expanded geometry.

The proper rotation is old `(x,y,z)` to station `(z,y,-x)`. Every beam is evaluated in its original Quaternion-from-+Y source frame before rotation. `q`, `extent`, and `frame` belong to the actual winning child. `frame` columns are the child's local axes in station coordinates; use its transpose for directional material inputs.

## Field entry points

- `stationLampWGSL({deck, lampHeight, signHeight, materialDistance})`
- `stationLampMemberAt(p, origin, member)` returns one of six children.
- `completeStationLamp(p, origin)` returns the physically nearest child.
- `footbridgeWGSL({...placement, materialDistance})`
- `completeFootbridge(p)` returns the physically nearest bridge child.

`materialDistance` is the name of an optional WGSL function with signature `(h: StationLampMemberHit, p: vec3<f32>) -> f32`, or the corresponding `FootbridgeMemberHit` type. It runs before the internal union. It must move distance by no more than `materialDistanceMaxShift` (default 0.03001 m), which the finite-repeat search bound includes. Return an unmodified material distance; `baseD` remains nominal geometry. The station can retain the winner's nominal geometry and deterministically re-evaluate the same material closure in its main queue. `box`, `memberBeamFrame`, and `memberCone` come from the existing field/cast-column helpers.

Each returned hit contains `d`, `baseD`, `member`, material `id`, `q`, `extent`, and `frame`. Lamp material IDs are iron 3, bulb 7, and enamel 9. Footbridge members are structural iron 3.

## R04 retained-host placement

Use `recommendFootbridgeHostPlacement(construction.host).options`:

- Bridge centre Z = −120.5 m; deck top = 6.65 m
- Stair centres X = [−28.7, −8.7, 8.8, 28.7] m
- Four flights, each 33 × 0.29 m treads, rise 0.1757575758 m
- Stair overall Z bound ≈ [−119.325915, −109.704085] m
- Near-side boarding-island passage 1.3403 m; other island narrow-side passages 1.23 m
- All columns retained. The original suggestion Z = −120 intersects the X10/Z−118.75 shaft and is a regression test.
- Preserve the source bench identity Z = −36.25 while moving its prior host placement Z = −111.25 to Z = −96.25. The helper returns the original from/source/to identity and `alreadyApplied` for idempotent review; it never mutates host data.

Tests cover every cast-column child using its proper rotated frame, enclosing cylinder/bolt bounds, conservative tapered-profile slabs, and exact box separating axes. Only the intended transfer-girder/column bearing junctions are excluded from collision reporting. All six host benches survive, and the complete bridge clears their conservative volumes after the one relocation. These are construction/circulation checks, not structural certification.

For a standalone R04 with all 6.8 m-wide islands, suitable stair centres are [−28.7, −8.7, 11.3, 28.7]. Default source-style offsets in the generic template are available for source continuity; do not apply their outer ±0.65 m offsets to newly centred R04 column/platform rows without placement adaptation.

## Lamp instance selection

The accepted lamp extends asymmetrically toward station −Z. Pick each nearby instance using its envelope centre at `postZ − 0.70`, while leaving its attachment origin at `postZ`. Do not reuse the column's unshifted nearest-origin cell. On the densified host post row, that can overestimate the nearest lamp's distance and allow a ray to overstep a thin shade. All envelope extents must still include at least the station material margin.

## Verification

Run:

`node --test kowloon-station-r04/qa/continuity/station-lamps.test.mjs kowloon-station-r04/qa/continuity/footbridge.test.mjs kowloon-station-r04/qa/continuity/footbridge-host-clearance.test.mjs kowloon-station-r04/qa/continuity/station-lamp-instance.test.mjs`

Seventeen source, orientation, physical-before-union, clearance, idempotency, and shifted-instance/envelope checks passed locally. Shader lexical validation passed. Browser, GPU execution, visual equivalence, and publication were intentionally not performed in this work unit.
