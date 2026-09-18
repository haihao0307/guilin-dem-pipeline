# KAOPU Learning Note — N19 Farmland fixed-view screen-space contract

Date: 2026-09-18  
Bounded question: Why can numerically real `0.102–0.128 m` terrain changes remain difficult to read in the locked Farmland fixed view?

Status: **Candidate partial / pinned R045.27 and R045.28 CPU projection and style replay verified; calibrated perception, target device and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother receipt

Farmland PR65 completed R045.27 at `4b53e5e84b8973884827ed81abad0c0f16148b14`. Its independent Mother receipt records `40/40` numeric gates, a maximum added transition of `0.1022335364 m`, and real overlap between the agricultural slope and receiving hierarchy. The same receipt explicitly keeps `visualAcceptance=false`: the fixed main perspective still reads primarily as one broad smooth surface, while the diagnostic plan panel shows the added bodies more clearly.

This is new Mother implementation and visual feedback, not adoption of N18 or a promotion of the terrain to surveyed or hydraulic truth. During this N19 cycle the live PR completed R045.28 at `e76ce5cac0d91506baf02652258638f3d8be6db3`: `42/42` numeric gates and Chrome startup passed, but the manual fixed-view receipt again kept `visualAcceptance=false`. R045.28 changed planform occupancy and nesting rather than simply multiplying height. Its maximum added elevation was `0.1281751992 m`, yet the perspective still looked nearly unchanged at first glance. N19 pins both completed rounds rather than testing a moving PR head.

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

The same fixed-source replay was then applied to R045.27 → R045.28 using that round's actual `56 × 66` grid. Among `422` active rendered vertices, median movement was `0.032231 px`, the 95th percentile `0.121462 px`, and the maximum `0.183362 px`; `88.626%` were below `0.1 px` and all were below `0.25 px`. The denser `1,121`-sample maximum was `0.178489 px`. The tenfold negative control again returned an approximately tenfold response.

Geometry displacement is not the only visual path. The audit renderer computes one normal and one flat HSL color per terrain cell. Across `311` active cells, the normal-change median was `0.100883°` and the 95th percentile `0.263676°`; the continuous per-cell RGB proxy had median Euclidean change `0.0443/255` and maximum `0.2432/255`. These are exact replays of the audit's formulas before browser rasterization, not calibrated perceptual differences.

R045.28 raised those exact-formula responses only modestly: the active-cell normal-change median was `0.115879°`, the 95th percentile `0.305103°`, and the continuous RGB proxy maximum `0.3171/255`. The Mother visual rejection is therefore compatible with both rounds' computed presentation response.

The first R045.28 extension correctly rejected an R27-specific expectation that more than `90%` of active vertices would remain under `0.1 px`: R045.28 measured `88.626%`. The reusable gate was corrected to preserve the actual distribution and require only the declared result that all active vertices remained under `0.25 px`. This is a scope correction, not a relaxed visual-acceptance gate; human acceptance stays false.

The first pushed R27 CI replay, [run 35321466571](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35321466571), also correctly exposed a byte-comparison flaw: a cross-host final summation ULP differed even though all semantic gates passed. Serialization was versioned to twelve significant digits, the declared evidence precision. The final two-round replay passed both `13/13` matrices in [run 35322310281](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35322310281). The failed receipt remains part of the evidence chain.

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

R045.27 and R045.28's numerical and visual receipts are not in conflict. Their changes exist in world space and overlap the intended support, while the locked renderer projects their largest sampled changes to only about `0.146 px` and `0.183 px` respectively and produces very small continuous style changes. The normalized plan panel answers “where and with what sign?”; the perspective answers “does the locked presentation make it readable?” Neither replaces the other.

The R045.28 footprint-first correction was the right causal discipline but was not sufficient for the fixed view. For the next Mother experiment, add this screen-space receipt to the existing numeric and human gates. Do not tune to a universal pixel threshold and do not unlock terraces from this probe.

## Frozen

- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.
- R045.27's `visualAcceptance=false`, terrain/water evidence boundaries and locked terrace/parcel state remain unchanged.
- R045.28's `visualAcceptance=false` and all terrace/parcel/water/production locks remain unchanged.
- N02 noise/shader findings and N14–N18 integer/seed contracts remain unchanged.

## Rejected

- “A `0.1 m` maximum is automatically visible in every camera.”
- “A normalized plan heatmap proves unnormalized perspective salience.”
- “Numerical existence and visual rejection conflict.”
- “Subpixel geometric movement means the field is absent.”
- “The tenfold negative control recommends tenfold production amplitude.”
- “CPU projection or continuous RGB proxies replace browser/device and human review.”

## Unknown

- Browser-rasterized A/B differences attributable only to R045.27 and R045.28 after quantization, coverage and compositing.
- Other cameras, internal resolutions, terrain LODs, filters and target devices.
- Calibrated human detection or preference thresholds.
- Surveyed agricultural dimensions, hydraulic state and user acceptance.

## Routing recommendation

One incremental gate was [delivered to Farmland PR65](https://github.com/haihao0307/guilin-dem-pipeline/pull/65#issuecomment-5727083482): for the next round after R045.28, save the exact camera/render grid, unnormalized perspective pixel-motion and normal/style receipts beside the already separate normalized plan diagnostic and human review. Delivery is not acknowledgement, implementation or adoption; all three remain Unknown.

No Landscape or Brick comment is warranted from this Farmland-specific result. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
