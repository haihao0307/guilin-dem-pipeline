# Farmland Mother R045 · Round 04

Date: 2026-09-17
Status: internal autonomous rebuild; no public visual baseline.
Parent branch head at start: `48e601e17f58fd049c7e9be4e11e4d7d9000eb7b`

## Logical correction before implementation

Round 03 showed that replacing independent peak blobs with one continuous ridge can still produce a false mountain curtain. The next tempting inference is also wrong:

> "Add more ridges, gullies and noise and the mountain will become natural."

More hierarchy is not sufficient. If carriers repeat in length, spacing, amplitude or direction, the result becomes a procedural comb instead of a landscape. Round 04 therefore adds only process-tied, unequal carriers and adds explicit tests for profile repetition. Free noise is not used as the corrective mechanism.

## Evidence re-read and constraint use

- MrRolord remains a method reference only: drainage hierarchy / distance fields -> terrain -> terrain-conforming land use. The example layout and Voronoi-like region organization are not copied.
- Xiaoma/Microscope constraints remain binding: world geometry stays camera independent; shape/edge/breakage precede appearance; hydrologic carrier geometry, transfer permission and current water state remain separate.
- Generic geomorphology evidence is used only for structural relationships, not Yunnan dimensions. Published work on hillslope/channel coupling and channel-head extraction supports treating headwater hollows, channels and hillslope form as coupled rather than drawing channels on an unrelated smooth slope (Perron & Hamon 2012, DOI 10.1029/2011JF002139; Clubb et al. 2014, DOI 10.1002/2013WR015167; USGS channel-head cross-section analysis, 2020).
- NRCS Terrace 600 is treated only as generic engineering discipline. The national standard explicitly says it is not a direct design/install document and requires local adaptation; stable outlets are a prerequisite for terrace systems. Therefore this project still does not authorize terrace geometry from generic standards alone.

## Implemented in R045.04

Created `r045_round04_kernel.mjs` as a delta layer over frozen R045.03 so the previous version remains reproducible.

### 1. Added unequal secondary crest hierarchy

Six secondary crest carriers now split the old broad rear face. Their lengths and amplitudes are intentionally unequal and terminate at different downslope depths. This avoids replacing one ridge wall with six copies of the same ridge.

### 2. Added unequal branching spurs

Six branch spurs extend from different parts of the rear / middle slope with deliberately different lengths. They are tied to the existing divide/catchment organization rather than generated as decorative ridges.

### 3. Added explicit headwater hollows

Seven first-order A/B/C headwater branches now have actual convergent hollow relief, rather than only stream polylines laid over the surface. Hollow depth/width varies by branch. The QA checks the hollow center against two cross-stream flanks so a labelled `HOLLOW-*` object cannot pass unless it creates measurable convergent relief.

### 4. Added broad rear catchment bays

Three broad headwater recesses sit behind the A/B/C main confluences. These cut back the uniform fore-face of the R045.03 mountain curtain without introducing a second agricultural slope or central valley.

### 5. Added unequal middle-slope shoulders

Six shoulder carriers create localized slope breaks at different x/z positions. They remain low-amplitude and terminate before the foothill so they do not become a new opposite-facing wall.

### 6. Added anti-curtain reduction field

A spatially varying reduction removes some unsupported broad ridge face where no secondary crest supports the terrain. This is tied to crest support distance; it is not a free random noise pass.

### 7. Existing hydrology/state contract preserved

The R045.03 water graph is inherited unchanged:

- 22 hydrology/control nodes;
- 37 permitted transfer interfaces;
- all three sources still reach `RIVER`;
- current gate state, current flow and stored volume remain unknown (`null`);
- visible geometry still does not imply current flow.

No parcel, bund, crop, person, buffalo, shelter or decorative vegetation was added.

## Numeric QA actually run

Command used in the working runtime:

`node r045_round04_qa.mjs`

All 21 gates passed after one rejected intermediate attempt. The failed intermediate was not hidden: it showed that several labelled hollows did not yet have measurable convergent relief and that the secondary carriers were still too uniform. The kernel was corrected and rerun.

Key final results:

- hydrology nodes: `22`;
- permitted transfer interfaces: `37`;
- all three sources reach front receiver: `true`;
- transfer graph acyclic: `true`;
- connected rear-ridge minimum forward relief: `11.9253 m`;
- crest coverage above 9 m relief: `1.0`;
- saddle depths: `11.7018 m`, `7.7560 m`;
- first-order stream worst segment rises: all below `1.2 m`; all final reported values are downhill;
- headwater hollow cross-flank contrasts: mean > `1 m`, with 5 of 7 > `0.35 m`;
- average adjacent rear-profile correlation fell from R045.03 `0.99486` to R045.04 `0.92591`;
- R045.04 rear-profile correlation range: `0.81750 .. 0.99547`, so the old uniform curtain profile is no longer repeated across the full width;
- secondary-crest length coefficient of variation: `0.23570`;
- branch-spur length coefficient of variation: `0.28573`;
- central 4 m forward-profile maximum local rise: `0.46487 m`, below the anti-opposing-wall gate;
- front river remains at `z = 161.9137 .. 179.3289`;
- agricultural suitability beyond the receiver remains exactly `0`;
- terrace-permission fraction above 0.65: `42.41%` of the sampled candidate slope;
- mean terrace permission within 6 m of streams: `0`;
- mean terrace permission farther than 18 m from streams: `0.7281`.

Machine-readable output: `r045_round04_qa_result.json`.

## Fixed-camera visual review actually performed

Two diagnostics were rendered from the exact R045.04 `height(x,z)` field: an oblique overview and a top elevation/contour view, using the same fixed world coordinates as the numeric QA.

### Real improvement

Compared with R045.03:

- the rear mass no longer reads as one uniformly extruded smooth curtain across the entire width;
- large catchment recesses and secondary crest depths are visible;
- headwater valleys now cut into the mountain body instead of appearing as lines painted on a smooth face;
- crest/spur lengths and termination depths are visibly less repetitive;
- the one-sided composition remains intact: rear mountains -> single forward slope -> plain -> front receiver.

### Still rejected

The visual result is not yet good enough for public review.

Remaining problems visible in the fixed views:

1. several rear headwater cuts are now too strong and read as slot-like grooves;
2. some middle-slope ridges/drainages still align too vertically and rhythmically, especially in top view;
3. the transition from middle slope to foothill/plain still lacks enough natural spreading / convergence structure;
4. the plain remains intentionally underdeveloped;
5. no terrace bench/riser geometry exists yet.

Therefore:

`visualAcceptance=false`

Passing the 21 numeric gates does not override this visual rejection.

## Browser gate

A fresh Chromium probe was run against a trivial local static HTML page with:

`--headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage`

It timed out after 18 seconds. The stderr again reports missing/unavailable DBus services. Because even the trivial probe cannot produce DOM output in this runtime:

`browserQA=false`

No public HTTPS workbench is published from this round.

## Next round priority

Do not begin parcel subdivision and do not decorate the scene.

Round 05 should fix the new over-incision / comb failure rather than simply intensifying R045.04:

1. soften the strongest headwater hollow cuts while retaining measurable convergence;
2. introduce lateral branching and variable joining angles in the middle-slope drainage/ridge system so the top view stops reading as parallel vertical traces;
3. improve foothill transition by deriving local convergence/spreading zones from the catchment exits instead of one smooth global band;
4. rerun the anti-curtain, stream, single-sided composition and terrace-permission gates;
5. only if the macro terrain passes fixed-camera review should the first contour bench/riser prototype be unlocked.

truthApproved=false
visualApproved=false
visualAcceptance=false
browserQA=false
productionReady=false
