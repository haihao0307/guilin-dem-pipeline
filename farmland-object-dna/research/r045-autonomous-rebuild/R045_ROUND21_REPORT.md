# Farmland Mother R045.21 — autonomous rebuild report

## Fixed baseline

- Parent verified baseline: R045.20 (`3573534b83c7f8d845f77b0b1dea2fcff310684b` was the branch head at the start of this run).
- R045.21 implementation: `2a2914c40ecef0f0e9447681005ebc365f07f524`.
- R045.21 first failing evidence: `63c2eb9de722fa0c15665055d26b1cabe1328bcd` (machine evidence for run 1).
- R045.21 corrected implementation: `d1cf7334650a2e535702b2fd9fad84ad0e19c625`.
- R045.21 final passing machine evidence: `19418300a2b25c297d62054c50f34e59fe23e0f7`.

Old R045.20 and the first R045.21 failure remain in history; neither was overwritten.

## Sources reread this round

- Latest active GitHub branch and the R045.20 kernel / QA / browser evidence.
- Xiaoma/TLO farmland-water-state note. The retained boundary is: geometry/visual continuity is not by itself hydraulic connectivity, and neither establishes water state, discharge, soil state, field microtopography or gate-control truth.
- User terrace reference images (`image(164).png`, `image(173).png`) were visually reread. They are used only for macro hierarchy: a broad agricultural hillside, unequal contour-scale masses and a continuous roll into lower ground. No dimensions are extracted from photographs.
- MrRolord: the original source video was not found in the accessible Library during this round. Only the previously saved project takeaway is reused: drainage topology/carriers -> terrain/influence field -> land use. This report does not claim a fresh viewing of the original video.

## Logic correction before implementation

The tempting shortcut after R045.20 would be to flatten the candidate agricultural area or begin drawing terrace stripes. That is a category error: a terrace/land-use pattern is not the causal macro landform. Doing that now would hide the remaining oversized smooth lower slope and would make later terrace geometry compensate for a wrong substrate.

R045.21 therefore advances only the second priority item: one-sided agricultural slope + foothill coupling. Terrace benches, risers, parcels, irrigation, roads and actors remain locked.

## Real implementation

R045.21 adds a low-frequency, camera-independent lower-slope field on top of R045.20:

- a broad off-centre concave agricultural bay;
- a stronger opposite interfluve shoulder;
- a weaker counter shoulder;
- small downstream toe coupling into the inherited lower ground;
- centres drift slowly down-slope so the field is not another set of parallel ribbons;
- inherited drainage axes receive exactly zero new height within the protected core and a smooth distance fade outside it;
- the R045.20 wall-repair/headwater band receives zero R045.21 change;
- the foreground receiver river receives zero R045.21 change;
- terrace permission is recomputed from the new ground but terrace geometry remains disabled.

The inherited hydrology topology is unchanged: 22 nodes, 55 edges, 12 terrain carriers and 3 outlet-continuum carriers.

## First candidate failure — retained, not hidden

The first R045.21 candidate failed numeric QA at 22/24 although the browser fixed-view render itself succeeded.

Failed gates:

1. `change_is_broad_not_single_patch`: mean absolute lower-slope change was only `0.052437 m`, below the predeclared `0.08 m` minimum.
2. `one_sided_mass_is_measurably_asymmetric`: the delta centroid was displaced (`x = +32.512 m`), but left/right mean absolute responses were only `0.040797 / 0.064078 m`, a separation of about `0.023281 m`, below the predeclared `0.035 m` minimum.

This failure showed that the intended *macro* agricultural face was numerically too faint. The QA thresholds were not weakened. The complete causal field was scaled coherently by `1.65`, preserving its support, drainage protection, longitudinal phase and source/receiver exclusions.

## Final numeric QA

Final result: **24/24 pass**.

Key final metrics:

- max R045.21 terrain delta: `0.814988 m`;
- mean absolute delta across 4,292 lower-slope audit samples: `0.086521 m`;
- delta centroid: `x = +32.512 m`;
- left / right mean absolute response: `0.067315 / 0.105728 m`;
- max change of the added field per 4 m in z: `0.128902 m` (< `0.22 m` gate);
- R045.20 upper wall-repair / headwater samples: exact sampled delta `0`;
- inherited drainage-axis samples: exact sampled delta `0` within the protected core;
- foreground receiver samples: exact sampled delta `0`;
- R045.20 worst lower-slope 4 m uphill rise: `0.059551 m`;
- R045.21 worst lower-slope 4 m uphill rise: `0.142854 m`, still inside the predeclared non-wall gate;
- terrace permission near drainage: mean `0`;
- future terrace-candidate permission away from drainage: mean `0.693098`;
- the permission mask changed materially (`max |delta permission| = 0.873800`), proving it was recomputed from the new ground instead of left stale.

## Browser startup and fixed-camera evidence

Final workflow run: `35292653302`.

- Google Chrome binary: `/usr/bin/google-chrome`;
- screenshot process: clean exit `0`;
- DOM dump: clean exit `0`;
- `data-ready=true`: found;
- fresh fixed-camera PNG: present, `532,793 bytes`;
- browser gate: **pass**;
- numeric gate: **pass**;
- complete R045.21 QA job: **success**.

Natural stream centre-line overlay remains OFF in the perspective audit; only the foreground receiver river is retained as a spatial reference.

## Fixed-camera visual review

The final PNG was downloaded from the successful workflow artifact and opened directly after the machine pass.

There is a real but modest macro change relative to R045.20: the lower/middle agricultural face no longer has exactly the same broad balance on both sides, and the right-side/interfluve mass is stronger while the opposing bay is lower. The cross-slope A/B profile separates clearly enough to confirm the change is not a stale render.

Visual acceptance is nevertheless **rejected** for this round:

- at whole-scene scale the change is still subtle compared with the oversized smooth middle/lower slope;
- source hollow -> convergent shoulder -> transport valley -> agricultural face hierarchy is not yet strong enough to read instantly without analytic comparison;
- several long drainage/shoulder forms remain visually near-parallel;
- rear ridge rhythm is still too regular/programmatic;
- the foothill plain remains too large and information-poor;
- this is not yet a defensible substrate for visible bench+riser terrace geometry.

Therefore `visualAcceptance=false` remains correct even though numeric QA and browser QA both pass.

## Evidence boundary / current constraints

No target field currently has surveyed metre-scale microtopography, measured terrace/bund/channel sections, control elevations, soil/sediment properties, ownership boundaries or time-series discharge/water-depth observations. The 12.5 m macro terrain source cannot supply these by inference. All R045.21 dimensions and amplitudes are synthetic generator parameters, not Yunnan survey truth.

## Locks retained

- `visualAcceptance = false`
- `terraceGeometryEnabled = false`
- `terracePilotPreviewEnabled = false`
- `parcelGenerationEnabled = false`
- `waterStateKnown = false`
- `productionReady = false`

No public HTTPS workbench is published from this round. The page was verified inside the real Chrome runner over localhost only; no persistent public HTTPS endpoint was independently opened and verified.

## Next unresolved blocking issue

The single largest visual blocker is no longer the R045.20 z~-202 wall. It is the macro hierarchy of the one-sided agricultural face itself: too much of the middle/lower slope still reads as one broad smooth surface with several long near-parallel drainage/shoulder traces. The next round should change the *occupancy and direction* of the major face/divide/valley masses, not add texture and not begin terrace stripes early.
