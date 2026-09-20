# Farmland Mother R045 · Round 03

Date: 2026-09-17
Status: internal autonomous rebuild; no public visual baseline.
Parent branch head: `cc04440c4a1feab939628d39537de99f393b985a`

## Logical correction before / during implementation

Round 02 correctly identified that the rear mountains still read as a row of independent procedural peaks. The first tempting correction would be **"make the peaks continuous and the mountain becomes natural"**. That inference is also false. A continuous crest is necessary for watershed organization, but by itself it can become an artificial ridge wall. Therefore this round separates two tests:

1. hydrologic/topologic correctness: crest continuity, saddles, divides, headwaters, downhill tributaries;
2. visual geomorphic credibility: the connected mass must not read as a uniform curtain or extrusion.

The first test now passes. The second still does not, so `visualAcceptance=false` remains mandatory.

## Evidence re-read

- MrRolord video audit: retain `river hierarchy -> accumulated/distance fields -> terrain -> terrain-conforming land use`; do not copy the example valley or Voronoi layout.
- R045 Round 02: do not cut parcels yet; next priority is a coherent ridge/saddle/headwater system and less evenly spaced catchments.
- Xiaoma/TLO bridge: stable identity and world reference frame remain distinct from display geometry; canonical DEM-scale evidence does not authorize field-scale geometry or regional truth claims.
- Water-state learning remains enforced: carrier geometry, permitted transfer, current gate state, flow state and stored volume are separate.
- General geomorphology check: a watershed drains to a common outlet and neighboring watersheds are separated by ridges/divides; headwaters commonly begin in high terrain. This is used only as method support, not as Yunnan dimensional truth.

## Implemented in R045.03

Created `r045_round03_kernel.mjs` as a new fixed version; Round 02 remains untouched.

### 1. Rear mountain representation replaced

Removed the seven independent radial peak blobs used in Round 02. The rear terrain now uses:

- one continuous, laterally meandering crest polyline;
- two explicit saddle zones that lower the same crest instead of opening gaps between separate mountains;
- four spur-ridge carriers extending downslope;
- a broad backing mass so the crest has terrain body behind it;
- fixed world-space functions only; camera/device state cannot rearrange the landform.

### 2. Headwater hierarchy made asymmetric

The previous near-binary symmetry was broken:

- catchment A: 2 first-order headwaters;
- catchment B: 2 first-order headwaters;
- catchment C: 3 first-order headwaters;
- headwater origins sit 10.33–17.54 m forward of the sampled crest position;
- main catchment spacing is deliberately nonuniform rather than evenly repeated.

The stream network is still a deterministic geomorphic carrier, not a claim of measured regional channels.

### 3. Divide lines tied to ridge/spur organization

AB and BC divides were moved onto the new spur-ridge system instead of remaining generic nearly-even vertical separators. Outer divides were also reshaped. The terrain uplift field now follows those connected ridge carriers.

### 4. Existing single-sided agricultural composition preserved

The front river remains a receiver at the low foreground edge. No second agricultural bank or opposing agricultural wall was introduced. Foothill fan proxies, plain carriers and water-transfer topology were retained as non-truth deterministic structure.

### 5. Water-state separation preserved

There are still 22 hydrology/control nodes and exactly 37 permitted transfer interfaces. Every permitted transfer keeps:

- `currentGateState = null`
- `currentFlowM3s = null`
- `storedVolumeM3 = null`

No visible carrier is treated as proof of current flow.

No terrace bench/riser, parcel, bund, crop, person, buffalo, shelter or decorative vegetation was added in this round.

## Numeric QA actually run

Command:

`node r045_round03_qa.mjs`

All 20 gates passed.

Key results:

- hydrology nodes: `22`;
- permitted transfer interfaces: `37`;
- all three sources retain a directed path to `RIVER`;
- transfer graph remains acyclic;
- connected rear-ridge minimum relief over the forward shoulder: `8.4466786987038 m`;
- fraction of sampled crest with >10 m forward relief: `0.8222222222222222`;
- two explicit saddle depths: `11.118222370858206 m` and `3.608178649313757 m` below neighboring crest shoulders;
- headwater forward offsets from the crest: `10.33–17.54 m`;
- no first-order headwater segment has a positive terrain rise >=1.2 m; worst observed segment rise is still downhill (`-0.4782127274017185 m`);
- catchment-axis spacing coefficient of variation: `0.24806201550387597`, no longer an equal-repeat pattern;
- first-order branch counts: `[2, 2, 3]`;
- sampled A/B/C valley-to-divide relief: `5.983 / 5.786 / 7.346 m`;
- relief standard deviation: `0.6937138205998948 m`;
- maximum local rise along the central 4 m-spaced forward profile: `0.23188757705106666 m`, below the `0.55 m` anti-opposing-wall gate;
- front river centerline: `z = 161.9136802902821 .. 179.32887035686338`;
- agricultural suitability beyond the front receiver remains exactly `0`;
- terrace-permission cells above 0.65: `45.20098441345365%` of sampled candidate slope;
- mean terrace permission within 6 m of streams: `0`;
- mean terrace permission farther than 18 m from streams: `0.7952043834068575`.

Machine-readable output: `r045_round03_qa_result.json`.

## Fixed-camera visual review

Two fixed diagnostics were rendered from the exact `height(x,z)` function: an oblique overview and a top elevation/network view.

### Real improvement

- the old seven-blob mountain row is gone;
- the rear topographic high is now one connected crest with actual lower saddle sections;
- headwaters visibly attach to high terrain and then converge downslope;
- A/B/C basin organization is less evenly repeated than Round 02;
- the river remains a foreground receiver rather than a central valley splitter.

### Still rejected

The oblique overview exposes a new problem: **the connected rear mass still reads too much like a steep continuous ridge wall / curtain**. This is exactly why the numeric crest-continuity gates are not sufficient as a visual acceptance test.

Other visible problems:

- downslope ridge/valley traces remain too legible and programmatic;
- the middle agricultural slope still lacks enough nested spur/shoulder hierarchy;
- the foothill-to-plain transition remains too smooth at landscape scale;
- the plain is intentionally still underdeveloped;
- no bench/riser geometry exists, so there is still no valid terrace candidate.

Therefore:

`visualAcceptance=false`

## Browser gate

Chromium was probed again against a trivial data-URL page with GPU disabled. It timed out after 18 seconds with no DOM output. DBus connection/name-owner errors persisted.

`browserQA=false`

No public HTTPS workbench is published from this round.

## Next round priority

Do not begin parcel subdivision.

Round 04 should specifically remove the remaining **ridge-wall** reading by replacing the single broad crest extrusion with a nested mountain hierarchy: main crest -> saddles -> unequal secondary crests -> branching spurs -> headwater hollows -> middle-slope shoulders. The acceptance target is not “more noise”; it is a credible variation in fore-slope depth and ridge/valley spacing while retaining the drainage-divide topology and the one-sided composition.

Only after that visual macro-terrain gate improves should contour bench/riser prototypes begin.

truthApproved=false
visualApproved=false
visualAcceptance=false
browserQA=false
productionReady=false
