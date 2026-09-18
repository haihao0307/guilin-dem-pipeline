# KAOPU Learning Note — N19 Farmland fixed-view screen-space contract

Date: 2026-09-18  
Bounded question: Why can a numerically real `0.102 m` terrain transition remain difficult to read in the locked Farmland fixed view?

Status: **Candidate partial / fixed-source CPU projection and style replay verified; R045.28 result, calibrated perception, target device and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother receipt

Farmland PR65 completed R045.27 at `4b53e5e84b8973884827ed81abad0c0f16148b14`. Its independent Mother receipt records `40/40` numeric gates, a maximum added transition of `0.1022335364 m`, and real overlap between the agricultural slope and receiving hierarchy. The same receipt explicitly keeps `visualAcceptance=false`: the fixed main perspective still reads primarily as one broad smooth surface, while the diagnostic plan panel shows the added bodies more clearly.

This is new Mother implementation and visual feedback, not adoption of N18 or a promotion of the terrain to surveyed or hydraulic truth. During this N19 cycle the live PR moved on to an initial R045.28 planform-contact implementation. N19 pins the completed R045.27 receipt so the question and result cannot move underneath the test; an in-progress R045.28 implementation is not treated as a completed result.

### Observation root B — exact fixed-camera executable replay

The committed probe imports the pinned R045.26 and R045.27 kernels and replays the audit page's exact camera, internal canvas and terrain grid:

- camera position `[322,154,360]`, target `[0,18,-52]`, focal length `770 px`;
- internal canvas `650 × 650`;
- terrain grid `52 × 62` cells, or approximately `8.846 × 8.387 m` between rendered vertices.

All `13/13` local gates passed. Among the `316` rendered vertices where `|R27 delta| > 0.003 m`:

- median geometric movement was `0.028017 px`;
- the 95th percentile was `0.106269 px`;
- the maximum was `0.143220 px`;
- `92.405%` moved less than `0.1 px`, and every active vertex moved less than `0.25 px`.

A denser `973`-sample support replay produced the same boundary: maximum movement `0.146297 px`. A live negative control multiplied only the R27 height delta by ten and produced a median `9.9992×` screen response, so the small result is not a dead projection test.

Geometry displacement is not the only visual path. The audit renderer computes one normal and one flat HSL color per terrain cell. Across `311` active cells, the normal-change median was `0.100883°` and the 95th percentile `0.263676°`; the continuous per-cell RGB proxy had median Euclidean change `0.0443/255` and maximum `0.2432/255`. These are exact replays of the audit's formulas before browser rasterization, not calibrated perceptual differences.

The bottom plan diagnostic uses `abs(delta) / roundMaximum` before coloring. It is deliberately amplitude-normalized: it is good evidence for support, sign and planform separation, but it cannot demonstrate that the same field is salient in the unnormalized perspective.

### Observation root C — mature terrain sampling contracts

[SideFX HeightField Resample](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_resample.html) makes grid spacing, resampling resolution and interpolation filter explicit; different filters may blur or sharpen the result. [Unreal Engine's Landscape Technical Guide](https://dev.epicgames.com/documentation/en-us/unreal-engine/landscape-technical-guide-in-unreal-engine) likewise separates height samples, component/section resolution and LOD structure. These are independent mature-system contract examples, not independent measurements of R045.27.

The transferable lesson is to preserve four separate receipts: world-space field amplitude/support, sampling or LOD, locked-camera screen-space response, and human visual acceptance.

## Candidate

For a fixed-view terrain A/B, save the following together:

1. world-space delta distribution and affected support;
2. exact camera, internal render size, grid/LOD and resampling filter;
3. projected vertex-motion distribution in pixels;
4. normal/shading response under the exact renderer;
5. unnormalized main view and any normalized diagnostic view as different evidence products;
6. human visual acceptance as a separate state.

Pixel bins are diagnostic, not universal visibility thresholds. The current result explains why the R045.27 main view can remain subtle; it does not prove that a tenfold height change is the correct design response. If the footprint or nesting is wrong, amplification only makes the wrong morphology louder.

## Current Best View

R045.27's numerical and visual receipts are not in conflict. The transition exists in world space and overlaps the intended support, while the locked renderer projects its largest sampled vertical change to only about `0.146 px` and produces very small continuous style changes. The normalized plan panel answers “where and with what sign?”; the perspective answers “does the locked presentation make it readable?” Neither replaces the other.

For the current R045.28 planform experiment, retain its footprint-first logic and add this screen-space receipt to the existing numeric and human gates. Do not tune to a universal pixel threshold and do not unlock terraces from this probe.

## Frozen

- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.
- R045.27's `visualAcceptance=false`, terrain/water evidence boundaries and locked terrace/parcel state remain unchanged.
- R045.28 remains Farmland Mother's implementation responsibility and is not evaluated as complete here.
- N02 noise/shader findings and N14–N18 integer/seed contracts remain unchanged.

## Rejected

- “A `0.1 m` maximum is automatically visible in every camera.”
- “A normalized plan heatmap proves unnormalized perspective salience.”
- “Numerical existence and visual rejection conflict.”
- “Subpixel geometric movement means the field is absent.”
- “The tenfold negative control recommends tenfold production amplitude.”
- “CPU projection or continuous RGB proxies replace browser/device and human review.”

## Unknown

- Completed R045.28 numeric, browser and human visual receipts.
- Browser-rasterized A/B difference attributable only to R045.27 after quantization, coverage and compositing.
- Other cameras, internal resolutions, terrain LODs, filters and target devices.
- Calibrated human detection or preference thresholds.
- Surveyed agricultural dimensions, hydraulic state and user acceptance.

## Routing recommendation

Route one incremental gate to the active Farmland PR65: for R045.28, save the exact camera/render grid, unnormalized perspective pixel-motion and normal/style receipts beside the already separate normalized plan diagnostic and human review. This is a delivered method request only; it is not acknowledgement, implementation or adoption until the Mother returns a fixed commit and result.

No Landscape or Brick comment is warranted from this Farmland-specific result. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
