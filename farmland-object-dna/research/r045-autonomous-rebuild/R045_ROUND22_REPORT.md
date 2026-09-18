# Farmland Mother R045.22 — autonomous rebuild report

## Fixed baseline

- Verified parent baseline at run start: R045.21 branch head `be468b963a54a0664d9b10fdb954e1849b04df3c`.
- R045.22 kernel commit: `47ac67e098a75d57cc664107a701ce4af34e97e7`.
- R045.22 QA commit: `82933855d036e6af824e60186ae261ed967d01e5`.
- R045.22 fixed-camera audit commit: `146e2f2677b7c6ba016478de76c8b8de37ba1142`.
- R045.22 workflow commit: `e0ac9c98c0f0446cddd41327b9a2a58227f5acbb`.
- Passing machine-evidence commit: `ae18b1b82f9d69c70e636ec905760df066442bc8`.

R045.21 remains intact in history and as a direct import baseline; R045.22 is an additive fixed round, not an overwrite.

## Sources reread this round

- Latest active GitHub branch, R045.21 kernel, QA, workflow and fixed-view evidence.
- Xiaoma/TLO Farmland water-state learning note. Retained boundary: visual or geometric continuity is not sufficient evidence for hydraulic connectivity, current water state, discharge, soil-water state, sediment state or control-gate truth.
- User terrace reference `image(173).png` was reopened and visually checked. It is used only for macro hierarchy: unequal nested contour masses and a hillside that is not a set of equal parallel strips. No dimensions are extracted from the photograph.
- MrRolord original video was not found in the accessible project/library search this round. Only the already-saved project takeaway is reused: drainage topology/carriers -> terrain/influence field -> land use. This report does not claim a fresh viewing of the original video.

## Logic correction before implementation

R045.21 proved that one-sided lower-slope massing can be introduced without damaging the inherited drainage graph, but the fixed view still contained several long near-parallel valley/shoulder forms. Increasing those amplitudes would amplify the artifact rather than solve it.

R045.22 therefore changes the plan-form occupancy and direction of the lower agricultural face before any visible terrace geometry is allowed.

## Real implementation

R045.22 adds four broad, rotated 2-D morphology footprints on top of R045.21:

- an oblique concave agricultural bay;
- a cross-oriented stronger interfluve shoulder;
- a smaller counter shoulder with a different axis;
- a weak lower toe fan that helps the face occupy the foothill transition.

Each footprint has a different centre, long-axis direction and aspect ratio. They are broad area fields rather than contour stripes. The complete inherited drainage axes receive zero R045.22 height change inside the protected core with a wide smooth fade outside it. R045.21 upper/headwater work, the foreground receiver river, hydrology nodes/edges and carrier arrays are unchanged.

No terrace bench, riser, parcel edge, irrigation state, road or actor is created in this round.

## Numeric QA

Workflow run `35296090044` completed successfully. Final numeric result: **25/25 pass**.

Key metrics:

- maximum added R045.22 terrain delta: `0.575222 m`;
- mean absolute added delta over 4,218 lower-slope audit samples: `0.050757 m`;
- added-field maximum 4 m longitudinal step: `0.077172 m`;
- z-band absolute-delta x-centroids: `3.700 / 6.153 / 56.829 / 62.573 m`;
- centroid range across the four downstream bands: `58.873 m`;
- positive morphology centroid x: `+92.047 m`;
- negative morphology centroid x: `-89.118 m`;
- positive/negative centroid separation: `181.166 m`;
- R045.21 upper/headwater sampled change: exact `0`;
- inherited drainage-axis sampled change: exact `0` within the protected core;
- foreground receiver sampled change: exact `0`;
- R045.21 worst lower-slope 4 m uphill rise: `0.142854 m`;
- R045.22 worst lower-slope 4 m uphill rise: `0.209874 m`, still inside the predeclared non-wall gate;
- terrace permission near drainage mean: `0`;
- future terrace-candidate permission away from drainage mean: `0.681433`;
- permission mask changed materially (`max |delta permission| = 0.601946`), confirming recomputation from the new ground.

## Browser startup and fixed-camera evidence

The same workflow ran the real Chrome fixed-view gate successfully:

- browser binary: `/usr/bin/google-chrome`;
- screenshot process exit: `0`;
- DOM dump exit: `0`;
- `data-ready=true`: detected;
- fixed-camera screenshot: present, `535,872 bytes`;
- browser result: pass.

Natural-stream centre-line overlay remained OFF in the perspective comparison. Only the foreground receiver river remains visible as a spatial reference.

## Fixed-camera visual review

The successful workflow artifact was downloaded and the final PNG was opened directly after the machine pass.

R045.22 is not a stale render: the lower-slope mass distribution changes measurably and the z-band cross-slope profiles separate. The stronger right-side mass and the lower-band lateral shift are visible.

Visual acceptance is nevertheless **rejected**:

- the whole agricultural face remains too smooth at scene scale;
- the new plan-form reorientation is real but still subtle in the perspective camera;
- several inherited valley/shoulder traces remain readable as long near-parallel forms;
- source hollow -> convergent shoulder -> transport valley -> agricultural face hierarchy is still weaker than the user reference hierarchy;
- the foothill plain remains oversized and information-poor;
- the rear ridge rhythm remains too regular/programmatic;
- this is still not a defensible substrate for visible bench+riser terrace geometry.

Therefore numeric/browser QA passing does not change `visualAcceptance=false`.

## Evidence boundary / real-world constraints

No target field currently has surveyed metre-scale microtopography, measured terrace/bund/channel cross-sections, control elevations, soil/sediment properties, ownership boundaries or time-series discharge/water-depth observations. A 12.5 m macro terrain source cannot supply those missing facts by inference. All R045.22 amplitudes, footprint axes and directions are synthetic generator parameters, not Yunnan survey truth.

## Locks retained

- `visualAcceptance = false`
- `terraceGeometryEnabled = false`
- `terracePilotPreviewEnabled = false`
- `parcelGenerationEnabled = false`
- `waterStateKnown = false`
- `productionReady = false`

No public HTTPS workbench is published from this round. The page was verified in a real Chrome runner over localhost only; no persistent public HTTPS endpoint was independently opened and verified.

## Next unresolved blocker

The principal blocker remains macro hierarchy rather than terrace detail. The next round should further break the scene-scale smooth lower face into unequal source hollow / interfluve / transport-valley masses and make the foothill transition less empty, while retaining the exact drainage protection and wall-free continuity already proven here. Terrace geometry should remain locked until that substrate is visually defensible.
