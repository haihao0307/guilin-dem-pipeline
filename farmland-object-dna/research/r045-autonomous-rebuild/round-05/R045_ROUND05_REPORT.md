# Farmland Mother R045 · Round 05

Date: 2026-09-17
Status: internal autonomous rebuild; no public visual baseline.
Parent: `ef0515ff61afbd6ed4b063ce2b5ba2a76bfced36`

## Logical correction before implementation

Round 04 exposed three related failures: several headwater hollows were over-incised and read as slots, the middle-slope drainage/ridge pattern still repeated a near-vertical fall-line rhythm, and the foothill-to-plain transition remained too globally smooth.

The tempting shortcut is also wrong:

> globally smooth the mountain, add random meanders, and make three larger fan blobs.

That would erase measurable headwater convergence, decouple drainage geometry from catchment structure, and merely replace one procedural rhythm with another. Round 05 therefore uses selective, process-tied corrections only.

## Method and evidence constraints

- MrRolord remains a method reference only: water hierarchy / distance and terrain fields -> terrain -> terrain-conforming land use. The example's exact valley composition and Voronoi-like organization are not copied.
- Xiaoma / Microscope constraints remain binding: world geometry stays camera-independent; shape, edge and breakage precede appearance; hydrologic carrier geometry, transfer permission and current water state remain separate.
- Generic USGS alluvial-fan work is used only for the relationship that flow exiting a confined valley can spread onto a depositional ramp whose relief/slope generally diminishes downfan. It does not supply Yunnan dimensions or sediment truth.
- NRCS Terrace 600 remains generic engineering discipline only: terraces require reliable stable outlets and the national standard is not a direct local design/install recipe.

## Implemented in R045.05

### 1. Selective headwater recovery, not global smoothing

The strongest Round 04 headwater cuts were partially recovered with per-hollow amplitudes. A1/B2 remain essentially untouched; A2, B1, C1, C2 and C3 receive different recovery strengths. This reduces the slot-groove failure while retaining convergent relief.

### 2. Oblique catchment-tied middle-slope swales

Six new terrain swales are attached to the existing A/B/C catchments and join their trunk valleys at unequal angles. They are terrain carriers, not claims of current active flow. Their purpose is to break the repeated vertical comb rhythm with lateral branching that is still hydrologically organized.

### 3. Oblique interfluve shoulders

Five low-amplitude shoulder carriers occupy the interfluves between the new swales. They are deliberately weaker than the major divide hierarchy and taper out before the foothill, so they do not create a second wall or another set of parallel ridges.

### 4. Catchment-exit foothill spreading

Three unequal foothill apron proxies are tied to the A/B/C catchment exits. Each widens downstream and loses center-to-flank relief toward the plain. Six shallow diverging toe swales are attached to those exits. These objects encode relative convergence/spreading organization only; they are not labelled as measured alluvial-fan geometry or sediment simulation.

### 5. Terrace-permission mask now sees all terrain drainage

`nearestTerrainDrainageDistance()` includes the existing natural streams and the new middle-slope swales. Therefore future terrace permission cannot cross the new terrain drainage simply because it was not part of the older stream list.

### 6. Existing water-state contract preserved

The Round 04 graph remains unchanged:

- 22 hydrology/control nodes;
- 37 permitted transfer interfaces;
- all three sources still reach the front receiver;
- current gate state, current flow and stored volume remain unknown (`null`);
- visible terrain/water-carrier geometry still does not imply current flow.

No parcel, bund, crop, person, buffalo, shelter or terrace geometry was unlocked.

## Numeric QA actually run

Command:

`node r045_round05_qa.mjs`

Result: **25 / 25 gates passed**.

Key results:

- hydrology nodes: `22`;
- permitted transfer interfaces: `37`;
- current water-state fields populated: `0`;
- all three sources reach `RIVER`: `true`;
- transfer graph acyclic: `true`;
- connected rear-ridge minimum forward relief: `11.85187 m`;
- two saddle depths: `11.34167 m`, `7.64133 m`;
- first-order headwater worst segment rises are all negative;
- strongest headwater cross-flank contrast: R045.04 `4.94018 m` -> R045.05 `4.41132 m`;
- mean headwater contrast: `2.22195 m` -> `2.03599 m`, while all seven hollows retain > `0.2 m` convergence;
- six middle-swale angles from the fall line: `39.23° .. 57.86°`, and all sampled segments remain downhill;
- adjacent middle-slope cross-section correlation: R045.04 `0.98049` -> R045.05 `0.96740`;
- rear-profile correlation: `0.92591` -> `0.93371`, still inside the anti-recollapse gate;
- foothill width ratios: `3.91x`, `3.92x`, `4.00x` from head to distal zone;
- center-to-flank apron relief decreases from proximal to distal in all three catchments;
- central 4 m forward-profile maximum local rise: `0.49870 m`, below the `0.65 m` anti-opposing-wall gate;
- front river remains at `z = 161.91368 .. 179.32887`;
- agricultural suitability beyond the receiver remains exactly `0`;
- terrace permission > `0.65`: `33.96%` of sampled candidate slope;
- mean terrace permission within 6 m of all terrain drainage: `0`;
- 81 samples close to new swales but away from old streams also have mean permission `0`;
- far-drainage terrace-permission mean: `0.75078`.

Machine-readable output: `r045_round05_qa_result.json`.

## Fixed-camera visual review actually performed

Top contour, oblique overview and R045.05-minus-R045.04 delta diagnostics were rendered from the exact R045.05 `height(x,z)` field in fixed world coordinates.

### Real improvement

Compared with R045.04:

- the most severe rear slot cuts are visibly softer without flattening all source hollows;
- middle-slope organization is no longer only a set of near-parallel vertical traces;
- local catchment exits now widen into the foothill instead of terminating into one uniform smooth band;
- the confirmed one-sided composition remains intact: rear mountains -> one forward slope -> foothill/plain -> front receiver.

### Still rejected

The visual result is still below the required baseline:

1. the macro middle slope is still too smooth between the new branches;
2. A2 and C2 headwater relief remains stronger than the rest and can still read as cut grooves;
3. the three foothill toe/apron zones are too individually legible and risk reading as three designed lobes rather than one continuous catchment-dependent transition;
4. the plain remains intentionally underdeveloped;
5. no terrace bench/riser geometry exists yet.

Therefore:

`visualAcceptance=false`

Passing 25 numeric gates does not override the fixed-camera visual rejection.

## Browser gate

A fresh Chromium probe was run against a trivial local static HTML page with:

`--headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage`

It timed out after 18 seconds with zero DOM output. Stderr again reports unavailable DBus services including `/run/dbus/system_bus_socket`.

Therefore:

`browserQA=false`

No public HTTPS workbench is published from this round.

## Next round priority

Keep parcel and terrace generation locked.

Round 06 should:

1. replace the impression of three discrete foothill lobes with one continuous transition whose local form still varies by catchment exit;
2. increase A/B/C sub-catchment asymmetry in the middle slope rather than adding more generic noise;
3. selectively reduce the remaining A2/C2 over-incision without flattening their source hollows;
4. rerun hydrology, anti-wall, drainage, foothill and terrace-permission gates;
5. only after the macro terrain passes fixed-camera review should a small bench/riser prototype be considered.

truthApproved=false
visualApproved=false
visualAcceptance=false
browserQA=false
productionReady=false
