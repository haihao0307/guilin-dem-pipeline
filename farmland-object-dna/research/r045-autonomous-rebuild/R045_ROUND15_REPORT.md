# Farmland Mother R045.15 — verified round report

## Starting point

R045.15 starts from the fixed R045.14 state. R045.14 had already improved basin shoulder asymmetry but the fixed perspective still read the agricultural slope, foothill/plain and foreground receiver as adjacent design zones rather than one continuous landform. Terrace, parcel and water-state gates remained locked.

## Sources re-read before implementation

- Latest GitHub branch and R045.14 kernel / QA / report.
- Xiaoma/TLO intake checkpoint: keep identity/state/evidence boundaries explicit; macro DEM / semantic constraints are not field-scale measured truth.
- MrRolord frame audit and one-sided agricultural slope contract: drainage topology and carrier fields must precede land-use geometry; do not jump to decorative terrace polygons.
- User terrace reference images in the DEM pipeline library: used only for visual hierarchy — a continuous hillside rolling into broader lower ground with large curved terrace bands. No image-derived metric terrace dimensions were asserted.

## Logic correction

The rejected assumption was: once three outlet/fan-like objects exist, overlap or widening alone will make the slope-to-plain transition read naturally. That is false. Three discrete objects can remain three designed blobs and preserve a categorical seam. The correction is to couple the inherited trunk-outlet carriers continuously into the foothill/plain surface, while keeping the drainage graph and foreground receiver unchanged.

No free noise, new active water edge, measured fan geometry, soil/sediment claim or terrace geometry was introduced.

## Substantive implementation

New kernel: `round-15/r045_round15_kernel.mjs`.

R045.15 preserves the R045.14 nodes, edges, terrain channels, basin shoulders, upper slope and receiver, then adds three carrier-tied foothill/plain profiles derived from the existing `outletContinuum` objects.

Each inherited outlet now has:

- downstream-expanding influence width;
- downstream-decaying shallow centre relief;
- unequal left/right toe shoulders;
- a weak broad carrier-coupled term;
- smooth entry after the upper agricultural-slope repair and smooth fade before the foreground receiver.

These are synthetic morphology parameters only. The three profiles are intentionally not clones. The implementation remains deterministic and camera-independent.

## Numerical QA

Dedicated GitHub Actions run: `35267213712`, verified code SHA `dbba1424c9c50df113d3a4f8d4f8aa30f5da76a0`.

Final result: **26 / 26 gates passed**.

Key measured results:

- inherited water graph preserved: 22 nodes / 55 edges;
- inherited terrain carrier inventory preserved: 12 terrain channels / 3 outlet carriers;
- outlet influence widths expand downslope by about 2.33x / 2.33x / 2.37x;
- synthetic centre incision decays to about 26.1% / 28.1% / 24.8% of its upstream value;
- R045.15 foothill/plain delta max: `0.1667678223 m`;
- absolute mean delta across the sampled transition: `0.0310902942 m`;
- upper slope sampled change: `0 m`;
- foreground receiver control sampled change: `0 m`;
- mean centre-to-toe-shoulder contrast by outlet: about `0.06175 / 0.07341 / 0.05591 m`;
- left/right signatures are distinct, not cloned;
- maximum added longitudinal delta step over 4 m: `0.0236481094 m`;
- candidate agricultural slope worst forward reversal remains `0.4830539768 m / 4 m`, below the retained `0.55 m` gate;
- near-drainage terrace permission mean remains `0`;
- far-drainage candidate permission remains about `0.75915` while geometry stays locked.

### QA defect found and corrected in this same round

The first successful run exposed a reporting flaw in the wall-persistence metric: if every sampled row had zero failures, the old implementation left the summary at `eligible=0`, which could be misread as no sampling. This was a QA logic defect, not a terrain defect. The threshold was not relaxed. The metric was rewritten to prove actual coverage and a new coverage gate was added.

Final coverage is explicit:

- R045.14 comparison: 1,894 eligible samples across 82 rows;
- R045.15: 1,894 eligible samples across 82 rows;
- zero rows exceed the retained 0.55 m wall threshold in the reported worst state.

## Browser and fixed-view gate

The same final Actions run started real Chrome, loaded the audit page, passed DOM-ready verification and generated the fixed A/B perspective screenshot.

Browser result:

- Chrome: `/usr/bin/google-chrome`;
- screenshot status: 0;
- DOM status: 0;
- ready marker status: 0;
- screenshot size: 535,088 bytes;
- browser gate: PASS.

The natural-stream overlay is OFF in the perspective; only the foreground receiver is retained as a spatial reference.

## Fixed-view visual judgment

**Visual acceptance remains false.**

The R045.14 -> R045.15 cross-slope profile demonstrates a real carrier-tied change, and the slope-to-plain transition is mathematically more continuous. However, the fixed perspective shows that the change is still visually too subtle at whole-landscape scale. The user-visible hierarchy has not caught up with the numerical structure.

Remaining visual failures:

1. The central agricultural slope still reads as a broad, smooth procedural sheet.
2. Basin shoulders and source hollows are still too weak relative to the total relief to explain the drainage network by landform alone.
3. The rear ridge line still has a repeated procedural rhythm.
4. The foothill/plain/receiver relationship is less categorical numerically, but in perspective it is still not strong enough to read as a naturally coupled lower-landform system.
5. No valid bench/riser terrace geometry exists yet; adding terrace stripes now would hide, not solve, the macro terrain problem.

Therefore R045.15 does **not** unlock terraces, parcels, field water, roads, actors, material dressing or public workbench publication.

## Current locks

- `visualAcceptance = false`
- `terraceGeometryEnabled = false`
- `terracePilotPreviewEnabled = false`
- `parcelGenerationEnabled = false`
- `waterStateKnown = false`
- `productionReady = false`

## Evidence boundary

Still unavailable as measured truth: local surveyed outlet/fan geometry, field channel sections, discharge time series, sediment/soil mechanics, ownership, terrace bench/riser dimensions, bund sections, field-control elevations and centimetre-scale water depth.

R045.15 widths/depths/biases are procedural generation parameters. The user reference is a visual hierarchy reference, not a metric survey.

## Next blocking gap

The next round should remain in macro terrain/hierarchical drainage. The most important gap is no longer a numerical discontinuity; it is insufficient whole-landscape relief hierarchy. The next substantive move should strengthen the coupling among source hollows, basin shoulders, transport valleys and foothill outlets as one asymmetric massing system, using the existing drainage carriers rather than arbitrary noise. Only after the stream overlay can stay off and the fixed camera still reads a natural collecting slope should the first real bench+riser terrace pilot be rebuilt.
