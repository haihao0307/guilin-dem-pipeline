# Farmland Mother R045.43 fixed report

## Actual change

R045.43 retains R045.42 active terrace geometry, step/phase/raw stair response, the 0.84 vertical multiplier, the inherited water graph and the hard drainage/foreground-receiver protections. It adds only one non-recursive same-row companion cell beside an already-active R045.41 branch/junction source (`familyRepairGain > .004`) when the candidate is same-family/stair-compatible and passes agricultural-slope, terrace-family, drainage and receiver safety.

This is a terrace-organization correction only. No parcel, shared bund, inlet/outlet, water depth, discharge, path, farmer/buffalo task, material, vegetation or atmosphere claim is added.

## Logic corrections and failed attempts retained

R045.42 was browser-open but was not a successful geometry round: its persisted numeric QA showed zero incremental geometry. R045.43 attempt A used two-sided same-row gap closure and also produced zero incremental geometry. Attempt B produced three real safe companions, but the inherited `rowRuns / activeCells` ratio still failed.

That ratio is not topology-identifying after R045.41 deliberately introduced adjacent-row branch shoulders. A legitimate branch may increase per-row runs, while the ratio can be reduced simply by appending cells to existing runs without reconnecting topology. R045.43 therefore records row-run count and ratio as diagnostics, forbids raw row-run count from worsening versus R045.42, and gates fragmentation with same-family/stair-compatible 2-D 8-neighbour connected components, orphan cells and tiny components. This is a metric correction, not a threshold relaxation or a riser-amplitude increase.

## Final machine QA

Authoritative numeric QA: 31/31 passed.

- active terrace samples: 540 -> 543
- core samples: 356 -> 356
- incremental gain cells: 3
- threshold crossings: 3
- unsupported crossings: 0
- crossings with frozen R041 branch source: 3
- maximum sampled R043-vs-R042 elevation change: 0.0706961152 m
- existing active R042 mask/delta change: exactly 0
- terrace groups: 92 / 228 / 223
- compatible 2-D topology: 18 components, 0 orphans, 1 tiny component; largest compatible component 122 -> 124; second 78 -> 79
- row runs: 82 -> 82 (diagnostic)
- hard drainage <=12 m: 0 active, 0 delta
- far upstream / outside support / foreground receiver: 0 change
- stair step / phase / raw response: exact inheritance
- maximum terrace increment: 0.8363728754 m / 6 m, below 1.25 m / 6 m gate
- water graph remains 22 nodes / 55 edges; 12 terrain carriers / 3 outlets

## Browser and fixed-camera evidence

Real `/usr/bin/google-chrome` completed screenshot and DOM checks with `data-ready=true`. Screenshot size: 263,063 bytes. Fixed view was manually reviewed after artifact download.

The A/B perspective is almost visually indistinguishable. No new macro cliff, seam, transverse wall, foreground receiver break or obvious drainage-core intrusion is visible. The three QA-lattice companion cells are too sparse for the coarse fixed-view plan sampler, so the plan legend reports zero sampled companions even though the authoritative 6 m numeric QA finds three. Therefore the browser image is valid evidence of renderability and lack of obvious macro regression, but it is not visual proof of the three sparse topology edits.

`visualAcceptance=false` remains locked.

## Evidence boundary

The 6 m QA lattice, one-cell companion rule, stair tolerances and 12 m hard drainage core are synthetic morphology/QA parameters. They are not surveyed Yunnan terrace dimensions or measured hydraulic connectivity. Current macro DEM and photographs do not provide field microtopography, parcel/management boundaries, bund/riser/channel sections, inlet/outlet sill elevations, real hydraulic connectivity or event water-management records.

Xiaoma/TLO boundary is retained: geometric continuity, adjacency and conservation do not establish parcel ownership, hydraulic connectivity, head, water depth, discharge, gate state, soil-water state or sediment state.

The saved MrRolord study is used only as ordering discipline: drainage hierarchy -> accumulated terrain influence -> terrain-conforming contour land use. The original video was not replayed in this round. Blender dimensions, Voronoi cells, shader displacement and adaptive subdivision are not treated as agricultural truth.

`image(173).png` is used only for non-metric morphology: long curved contour-following ribbons, unequal widths, nested organization and drainage interruptions. No terrace width, continuation length, riser height, channel size, water depth or hydraulic parameter is inferred from the photograph.

## Locks after R045.43

- terraceGeometryEnabled = true
- terracePilotPreviewEnabled = true
- visualAcceptance = false
- parcelGenerationEnabled = false
- waterStateKnown = false
- productionReady = false

No public HTTPS workbench is declared. The verified page was the Runner-local HTTP audit page only.
