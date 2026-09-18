# Farmland Mother R045.25 — carrier-coupled footslope apron round

## Fixed result

R045.25 continues the **one-sided agricultural slope + foothill plain** stage. Terrace benches, parcels, irrigation edges, roads and actors remain locked.

The substantive change is a new set of **three broad, shallow, unequal footslope aprons** tied to the three inherited outlet carriers. R045.24 proved that three receiving bays existed, but their whole-scene lower-plain footprint remained visually weak. R045.25 therefore changes **lateral occupancy and downstream sweep**, rather than simply increasing vertical amplitude.

Hydrology planimetry is preserved exactly: 22 nodes, 55 edges, 12 terrain drainage carriers and 3 outlet carriers. The new field has zero sampled change in the inherited upper work, within 10 m of inherited drainage axes, around the foreground receiver river, and outside its support band.

## Logic correction before implementation

The rejected inference was: **if the receiving landforms are not legible enough in the fixed camera, increase their vertical amplitude.** That does not follow. Higher amplitude can make a weak planform more visible while making the terrain less plausible by producing artificial berms or trenches. R045.25 changes the footprint first: unequal downstream widening, opposite lateral sweeps, one-sided shoulders and nested recesses, all expressed in inherited outlet-carrier coordinates.

## Evidence read this round

- Xiaoma/TLO intake boundary was reread. The current macro terrain basis does not establish field-scale parcel boundaries, bund/channel sections, control elevations, hydraulic connectivity or centimetre-scale water state.
- MrRolord saved video-frame audit was reread. Only the transferable ordering is retained: drainage hierarchy / cumulative terrain field first, then land use. Blender-specific node structure and dimensions are not treated as agricultural truth.
- `image(173).png` was reread as a visual hierarchy reference only: broad unequal nested hillside occupation, curved contour hierarchy and non-uniform lower transitions. No terrace width, riser height, canal section, water depth or regional metric is inferred from that photograph.

## First runner attempt — retained failure

The first R045.25 runner attempt returned **33/34 numeric gates**, while the real Chrome browser gate itself succeeded.

The single failing gate was `whole_scene_planform_is_not_constant_width`. It used global `min(x) / max(x)` span of all occupied apron cells. Because the three spatially separated broad aprons reached opposite sides of the audit domain, that span saturated at roughly the whole 460 m frame for nearly every row. The metric was therefore insensitive to internal planform evolution: it reported a width range of only 4 m even though occupied-cell count changed from 74 to 66 and the weighted occupancy centroid moved by about 9.04 m.

This failure was not hidden. Its machine evidence was committed as `1ed4cc8...`.

## QA correction — not a threshold relaxation

The geometry was not changed to force a pass and the failed threshold was not merely lowered. The saturated global-span metric was replaced by an **occupied-cell-count evolution** gate while the independent weighted-centroid-drift gate was retained.

Final requirements are:

- broad actual apron occupancy across at least 8 sampled rows;
- occupied-cell count must evolve by more than 5 cells downslope;
- weighted occupancy centroid must shift by more than 6 m;
- all three carrier-tied components must exist numerically and remain spatially distinct;
- signed shoulder relief must survive instead of being cancelled by receiving hollows;
- inherited drainage / upper terrain / receiver river protections remain exact;
- no meaningful new forward wall relative to R045.24;
- terrace permission remains inherited and terrace geometry stays locked.

## Final numeric QA

Final runner result: **34/34 passed**.

Key measurements:

- maximum R25 added height delta: `0.2921128328 m`;
- mean absolute delta over 2310 samples: `0.0413509907 m`;
- core-band mean absolute delta: `0.0528733288 m`;
- maximum added-field longitudinal change per 4 m: `0.0819457253 m`;
- positive shoulder mass / negative receiving mass ratio: `0.0300242`;
- occupied-cell-count range downslope: `8`;
- weighted occupancy-centroid drift: `9.036344 m`;
- minimum pairwise carrier-component centroid separation: `91.535843 m`;
- R24 worst sampled 4 m forward rise: `0.3585740903 m`;
- R25 worst sampled 4 m forward rise: `0.3617162582 m`;
- upper-work change: `0`;
- drainage-axis-protection change: `0`;
- receiver-river change: `0`;
- outside-support change: `0`;
- terrace-permission maximum change: `0`;
- near-drainage terrace permission mean: `0`;
- far-from-drainage candidate permission mean: `0.6814326037`.

## Browser startup and fixed-view evidence

The final runner used `/usr/bin/google-chrome` against the local QA HTTP page. Screenshot process, DOM dump and `data-ready=true` checks all exited successfully. The fixed-view screenshot exists and is `568258` bytes.

The A/B view compares R045.24 and R045.25 with the same camera. Natural stream overlay is disabled except for the foreground receiver river. A separate plan-view strip shows only the added R25 apron field so the low-amplitude footprint can be audited without pretending it is measured field geometry.

## Visual review

The final fixed-view image was opened and inspected after the successful runner.

R045.25 is not a stale render: lower-plain shading and mesh position change over a broad area, and the plan-view apron strip shows three unequal outlet-tied masses. A direct terrain-panel pixel comparison also shows non-zero change across a meaningful subset of the rendered terrain.

However, **visual acceptance remains false**. In the whole-scene perspective, R24 -> R25 is still subtle. The lower plain remains too visually uniform, and the slope / foothill / receiving-plain hierarchy is not yet strong enough to justify starting bench+riser terraces. Increasing vertical amplitude alone is explicitly rejected as the next move.

The next terrain step should strengthen the *planform hierarchy and coupling* between the three aprons and the existing foothill contact without creating a common full-width depression. Only after the fixed camera reads a natural one-sided agricultural slope and foothill receiving system without overlays should the first terrace bench+riser pilot be unlocked.

## Evidence boundary / real-world constraint

R045.25 is a synthetic macro-morphology test. Current constraints prevent a rapid ordinary real-world reconstruction from being promoted to survey truth: the 12.5 m macro DEM is too coarse for actual field boundaries, terrace bench and riser sections, bund/channel cross-sections and control elevations; no selected-field survey supplies those missing observations; and photographs cannot supply hydraulic connectivity, discharge or water depth. Therefore the metre values above are generator / QA parameters, not measured Yunnan agricultural dimensions.

## State after this round

- `visualAcceptance=false`
- `terraceGeometryEnabled=false`
- `terracePilotPreviewEnabled=false`
- `parcelGenerationEnabled=false`
- `waterStateKnown=false`
- `productionReady=false`

No public HTTPS workbench is claimed in this round. The page has been verified only in the real Chrome runner against the local QA HTTP server.
