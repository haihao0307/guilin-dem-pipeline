# Stone Money Island V0.2.1 — Beach Contact Known Limitations

This increment changes the actual game source and generated runtime. It is not only a plan.

## Implemented

- Larger, flatter authored white-sand island/beach defaults.
- Wider reef-protected shallow shelf and gentler default breaker/run-up values.
- One CPU and GLSL cross-shore profile with the same coefficients.
- `StoneMoneyShoreline.shoreAt(x,z,time)` derives bed, surface, depth, local slope and signed distance from the same `bedHeight` and `waterLevel` used by rendering.
- Player deep-water blocking consumes this shared shoreline query.
- Stone money and the player wake-up position move onto the enlarged upper beach.
- Frozen Ocean Mother V001 source strings remain protected by the existing build equality check.

## Reliable relationship versus candidate expression

Reliable project relationship:

- dry beach, wet/contact zone, shallow lagoon shelf and outer deepening must be continuous;
- rendering and player contact must not maintain separate private shorelines;
- the shoreline is derived from the current bed and water state, not a painted strip or a radius-only guess.

Candidate expression:

- island radius 36 m;
- nominal beach width 16.5 m;
- shallow shelf width 34 m;
- one-dimensional cross-shore coefficients and wave defaults;
- stone-money position and exact wake-up location.

These dimensions are not survey truth and must be adjusted against the user's incoming Palau references.

## Not solved by this increment

- Final Palau limestone-island morphology from Landscape Mother.
- Final tropical tree definitions from the plant pipeline.
- Full 3D cave/overhang collision and visibility.
- Wet-sand inundation memory beyond the inherited field.
- Swimming, diving, underwater camera crossing, breathing and underwater interaction.
- Coral morphology, verified fish species and full biological habitat truth.
- Physical iPhone performance, heat, power or frame-rate acceptance.
- User visual acceptance or AAA completion.

`visualAcceptance=false`, `physicalDeviceTest=false`, `productionReady=false`.
