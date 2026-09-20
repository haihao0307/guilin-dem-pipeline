# Farmland Mother R045.17 · autonomous rebuild report

## Scope actually completed

R045.17 stayed at the first priority gate: macro terrain + hierarchical drainage. It did **not** unlock terrace, parcel, per-field water, path, farmer/buffalo, material, vegetation or atmosphere work.

The logic error corrected before implementation was: **making channels wider/deeper, or adding generic noise, does not make a one-sided agricultural slope read as a causal catchment if the broad interfluve volumes keep the same parallel rhythm.** That approach would decorate the symptom while preserving the macro error.

R045.17 therefore adds a low-frequency, carrier-tied nested basin relief field around the inherited A/B/C trunk carriers. The broad shoulder centres change position along each carrier, and A/B/C use different amplitude/span/width/skew/drift/phase signatures. The field adds unequal source/convergence/transport volumes rather than another set of painted drainage lines. The complete inherited drainage skeleton remains protected near its axes and the R045.16 lower foothill/plain/receiver system is retained.

## Evidence and method reread

Before implementation this round reread:

- the current `restart/farmland-object-dna-v020-20260907` head and R045.16 kernel/QA state;
- Xiaoma/TLO checkpoint: 12.5 m data is macro-terrain authority, while field microtopography, bund sections, channel sections and water-control elevations remain unresolved and must not be invented as survey truth;
- MrRolord video audit: reusable order remains `river hierarchy -> cumulative/distance fields -> terrain valleys/benches -> land use -> terrain-conforming detail`; the visible Voronoi experiment is not parcel truth;
- the user's reference-image constraints already recorded in the rebuild: use photographs for broad hierarchy, continuous contour turning and non-clone nesting only; do not extract metric terrace/channel dimensions from them.

Real-world constraint remains explicit: there is still no selected canonical field site with surveyed metre-scale terrain, measured bund/channel sections, control elevations, soil/sediment properties or discharge time series. Therefore R045.17's basin dimensions are deterministic generator parameters, not Yunnan measurements.

## Files added / changed

- `r045_round17_kernel.mjs`: nested basin macro-relief on top of R045.16.
- `r045_round17_qa.mjs`: 26 numerical/contract gates.
- `r045_round17_audit.html`: fixed perspective A/B review, R045.16 vs R045.17, natural-stream overlay OFF.
- `.github/workflows/farmland-r045-round17-qa.yml`: actual Node QA + Chrome DOM/screenshot gate; final workflow also persists the fixed-camera screenshot.
- machine evidence: QA JSON, browser JSON, summary JSON and fixed-camera PNG.

## Failure retained, not hidden

The first R045.17 runner did **25/26**, while browser launch already passed. The only failing numerical gate was the explicit non-parallel-centre test: basin A's sampled drift range was only about `6.169 m` against `>7 m`, and basin B's centre-shift range only about `3.709 m` against `>8 m`. This meant the first implementation did not actually prove that all three broad basin volumes had escaped the old parallel-ribbon rhythm.

The gate was **not relaxed**. Geometry was changed instead: A's transverse drift was strengthened and B's source-to-transport span contraction was increased. The second/final geometry then passed the same gate, and a third verification run repeated both numerical and browser gates while persisting the visual artifact.

## Final numerical QA

Final runner: **26/26 passed**.

Key values:

- water graph identity: `22 nodes / 55 edges` unchanged;
- terrain carriers: `12 channels / 3 outlets` unchanged;
- nested basin delta: max `1.2833 m`, mean absolute `0.06892 m` over `3404` samples;
- sampled points within `<=11.5 m` of the inherited extended drainage skeleton: max nested delta `0 m` (`511` protected samples);
- sampled rear-ridge controls: `0 m` change;
- sampled R045.16 lower foothill/plain and front receiver controls: `0 m` change;
- maximum longitudinal change of the new nested field: `0.16250 m per 4 m`, below the unchanged `<0.22 m` gate;
- persistent cross-slope wall detector: fraction `0`, contiguous span `0`, with `1894` valid samples across `82` rows;
- worst candidate agricultural-slope forward reversal: `0.51470 m per 4 m`, below the unchanged `<0.55 m` gate;
- terrace permission mean near drainage: `0`;
- far-from-drainage future terrace-candidate permission mean: `0.68372` (geometry still locked).

A/B/C are no longer parameter clones. Sampled transverse drift ranges are approximately `7.93 / 13.94 / 17.86 m`; sampled centre-shift ranges are approximately `13.45 / 8.87 / 32.38 m`.

## Browser and fixed-camera gate

Final GitHub runner completed successfully:

- numeric gate: success;
- actual Google Chrome launch: success;
- DOM ready marker: success;
- fixed-camera screenshot: success;
- screenshot size: `528132 bytes`;
- evidence persistence: success.

Natural-stream centreline overlay is OFF in the A/B terrain views; only the front receiver river is retained as a spatial reference. This prevents the review from passing merely because blue lines tell the viewer where drainage should be.

## Fixed-camera visual review

The final screenshot was opened and inspected after the runner finished.

R045.17 is a real visual change rather than a zero-delta round: in the right-hand B view the middle/right agricultural slope gains broader unequal shoulder volumes, and several basin flanks no longer track the R045.16 cross-slope rhythm exactly. The lower cross-section also shows R16/R17 divergence without changing the receiver geometry.

However **visualAcceptance remains false**. At the full-scene scale the change is still too weak relative to the large smooth slope. The main defects are now:

1. the middle agricultural slope is still dominated by a broad smooth sheet;
2. several source-to-middle relief bands still read as elongated near-parallel grooves/shoulders rather than nested catchment bodies;
3. source hollows, divides and convergence shoulders are not different enough in orientation and footprint;
4. the rear skyline still has a repeated procedural rhythm;
5. the lower plain remains visually large and under-structured even though its geometric continuity is numerically protected.

The most blocking issue is therefore **not channel detail**. It is the weak orientation/footprint hierarchy of the A/B/C subcatchment bodies. Increasing amplitude alone would risk turning the current bands into stronger artificial ridges; the next macro-terrain work should change source-hollow footprints, divide directions and convergence orientation while keeping the proven drainage-axis and wall gates.

## Locks retained

- `visualAcceptance = false`
- `terraceGeometryEnabled = false`
- `terracePilotPreviewEnabled = false`
- `parcelGenerationEnabled = false`
- `waterStateKnown = false`
- `productionReady = false`

No public HTTPS workbench is claimed. The audit page was actually opened in the runner, but that is a runner-local HTTP page, not a verified persistent public HTTPS deployment.
