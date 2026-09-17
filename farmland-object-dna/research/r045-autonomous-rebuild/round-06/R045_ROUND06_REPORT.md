# Farmland Mother R045.06 · Foothill Continuum / Bounded Headwater Repair

Date: 2026-09-17
Status: numeric gate passed; visual acceptance rejected; browser gate failed; no public workbench.

## Logic corrections before implementation

1. **Widening three synthetic fans until they overlap does not make a natural foothill transition.** It merely hides the seams while preserving three radial attractors. The target is one continuous piedmont/toe field whose local curvature is conditioned by the three catchment exits.
2. **Filling A2/C2 until they look softer would erase drainage.** Recovery must be bounded: reduce only the excess slot relief while preserving a positive cross-hollow depression and downhill headwater path.
3. **A continuous height surface is not enough if the inherited slope/plain formula has a derivative seam.** R03 switches terrain regimes around `z≈20`; the R05 fan relief partly masked that discontinuity. R06 therefore repairs the narrow foothill band with a cubic Hermite bridge rather than adding more decoration.
4. **Numerical continuity is not visual acceptance.** Even after the QA below passes, the fixed-view audit still rejects the macro terrain if the foothill reads as a long designed bench or if the slope remains too smooth.

## Sources re-read this round

- `research/r043-mrrolord-terrain-generator-study/VIDEO_FRAME_AUDIT.md`: retain the hydrology-first chain (`river hierarchy -> cumulative fields -> terrain -> terrain-conforming land use`) and do not reuse Voronoi as a visible field style.
- Small-mother / Farmland water-state learning: allowed transfer, current gate state, current flow, stored water and rendered water surface remain separate states; geometry must not be promoted to measured hydrology.
- User terrace references `image(164).png` and `image(173).png`: the important visual family is broad contour-following benches with irregular winding boundaries and dark risers, not repeated radial sectors.
- USGS, *Our Dynamic Desert — Alluvial Fans*: adjacent fans can join into a continuous fan apron / piedmont (bajada). This supports replacing three isolated fan blobs with a continuous foothill field, but does **not** provide local Yunnan sediment truth or dimensions.
- USGS, *Controls on alluvial fan long-profiles*: fan/channel slopes commonly decrease downfan. Used only as a qualitative gradient constraint, not as a regional numeric calibration.

## Implemented changes

### A. Bounded A2 / C2 headwater recovery

- Added only `+0.62 m` carrier amplitude to `HOLLOW-A2` and `+0.72 m` to `HOLLOW-C2`, with each recovery tapered by the original hollow width and rear-zone envelope.
- No change to the water graph, source identities, receiver, or current-flow state.
- Other five headwaters are intentionally left almost unchanged.

### B. One continuous foothill / piedmont field

- Added three **broad catchment facets**, not three new cones. Their role is low-frequency basin asymmetry on the middle slope.
- Countered 46% of the inherited synthetic fan carrier field inside the foothill band.
- Blended the toe toward a lateral low-pass terrain field (`±24/48/72 m`) so the slope/plain contact reads as one land body.
- Preserved A/B/C identity through a **normalized outlet partition**. Because weights are normalized, outlet influence changes local curvature without summing three additive humps.

### C. Foothill derivative-seam repair

- Reconstructed the inherited foothill line locally from the earlier deterministic `footZ(x)` relation.
- Replaced a narrow band around the slope/plain regime switch with a cubic Hermite bridge using the actual height and forward derivative at the two anchors.
- This is a geometry continuity repair; it is not a sediment simulation and does not establish measured stratigraphy.

## Executed numerical QA

A local independent numeric mirror of the repository formulas was run. `14 / 14` R06 gates passed. The committed JS QA uses the same checks and thresholds.

Key results:

- A2 hollow contrast: `4.411315 -> 4.174178 m`.
- C2 hollow contrast: `4.073364 -> 3.797868 m`.
- The other five headwater contrast changes remain below `0.062 m` (limit `0.26 m`).
- Mean isolated toe/fan prominence: `0.872529 -> 0.194502 m`.
- Mean lateral toe curvature proxy: `0.172484 -> 0.095296`.
- Maximum forward rise inside the foothill transition: `0.103165 m / 4 m` (limit `0.18`).
- Maximum derivative jump at the Hermite blend boundaries: `0.007975 m/m` (limit `0.015`).
- Catchment outlet identity remains measurable: profile-span `0.107723 m` (limit `>0.10`).
- Rear ridge minimum relief remains `11.789978 m`.
- Central 4 m forward-profile maximum rise remains `0.487158 m` (limit `0.65`).
- Front river remains confined to `z=161.913680..179.328870`.
- Terrace-permission mask above `0.65`: `35.28%` of sampled candidate points.
- Mean terrace permission within `6 m` of drainage remains `0`.
- Mean terrace permission farther than `18 m` from drainage remains `0.780675`.

`terraceGeometryEnabled=false` and `parcelGenerationEnabled=false` remain locked. The terrace permission field is still only a geometric eligibility mask.

## Fixed-view visual audit

Two deterministic terrain-only fixed views were regenerated: a whole-site overview and a foothill/toe close audit. The comparison against R05 shows a real improvement: the three separate fan lobes are strongly suppressed and the A2/C2 slots are less dominant without eliminating their drainage identity.

**Visual acceptance still fails.** The new dominant defect is clearer now: the slope-to-plain transition still reads too much like a long designed bench in the terrain-only view, and the broad middle slope remains smoother than the supplied terrace references. The reference images have nested contour-following shelves and irregular management-scale changes; R06 is not allowed to fake those by painting terrace lines on an unresolved macro surface.

Therefore:

- `visualAcceptance=false`
- no terrace bench/riser geometry yet
- no parcels, bunds, people, buffalo or material decoration yet

## Browser gate

Chromium `144.0.7559.96` was re-tested against a minimal local static HTML using headless mode, `--no-sandbox`, `--disable-gpu`, and `--disable-dev-shm-usage`.

Result:

- exit status: timeout (`124`) after 18 s
- DOM bytes: `0`
- recurring environment failure: DBus / UPower connection errors followed by zygote termination messages

This fails before a Farmland page is meaningfully tested. `browserQA=false`; no public HTTPS workbench is issued in this round.

## Next blocking defect

Do **not** start parcel subdivision next. The next round should remove the remaining long foothill-bench reading without reintroducing the three-fan pattern, then test a **small terrace bench/riser pilot only inside one accepted permission patch**. The pilot must follow contours, terminate before drainage lines, preserve outlet paths, and be compared against the supplied terrace references before the generator is allowed to expand across the slope.
