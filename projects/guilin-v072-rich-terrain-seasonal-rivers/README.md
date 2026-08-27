# Guilin v0.7.2 rich terrain and visual seasonal river presets

This Draft project extends the verified Guilin coordinate contract without altering the source DEM or OSM centerlines. It is not ready for visual approval until the workflow, browser evidence, Pages deployment, and public-origin checks all succeed.

## Locked source truth

- The only elevation source is the 12-file canonical 12.5 m DEM package. All 12 Git LFS objects are checked against the committed byte sizes and SHA-256 values before use.
- The reconstructed mosaic is `17408 × 18867` pixels in EPSG:32649 at exactly 12.5 m. Its bounds are `[349862.5, 2703012.5, 567462.5, 2938850.0]` metres.
- The measured elevation range is -6 m to 2093 m. Horizontal and vertical world units are metres, and vertical scale is locked at 1.00×.
- The mosaic contains 284,579,268 valid pixels and 43,857,468 NoData pixels: 86.6466009454% valid coverage and 13.3533990546% NoData.
- `gap_fill=false`, smoothing is disabled, and no 30 m or other fallback DEM is allowed. NoData remains a transparent absence rather than an interpolated surface.
- X is east-positive and Z is south-positive.

## Frozen OSM centerline contract

- The reviewed GeoJSON source contains exactly 1,426 features and has byte SHA-256 `be3e8e67f625fa87c843e2d7ea423c48b98e750c6912cae8cf3863df6ae6d4df`.
- Its ordered coordinate-only digest is `fc69d8197106de229af2ecb9ca1d77cafe3e7ed291b5d119c0689682e68473d0`.
- The digest is computed from the feature/run/coordinate order exactly as supplied; properties and IDs are not included and the list is not sorted.
- A live Overpass response may be used only when it reproduces the reviewed byte contract, feature count, and ordered coordinate digest exactly. Changed upstream data fail closed instead of silently changing the scene.
- OSM centerline coordinates are immutable. River width is applied laterally, and the final left and right bank coordinates are independently sampled against terrain.

## Terrain LOD truth

- `terrain_height_u16.png` is an overview-only `1024 × 1110` backdrop. It is not described as 12.5 m near-field geometry.
- Runtime geometry uses eight deterministic tiled levels with strides `128, 64, 32, 16, 8, 4, 2, 1` and tile counts `1, 4, 9, 25, 90, 323, 1258, 5032` respectively: 6,742 gzip tiles total.
- The native stride-1 layer is the only layer that claims complete source-centre-domain coverage and supplies 12.5 m vertex spacing near the camera and fixed acceptance locations.
- Non-divisible coarse grids do not invent a nonuniform final sample and do not claim full-domain coverage. The overview-only backdrop covers the narrow east/south edge strips when a coarse LOD is visible; it is not evidence of native geometry.
- Adjacent tile ownership is deterministic. Shared boundary samples are identical, mixed-LOD alignment is checked, and cracks are eliminated through shared topology rather than visual skirts.
- The page reports current LOD, actual vertex spacing, source resolution, valid coverage, and NoData ratio at runtime.
- Native tile decoding is compared with source DEM samples. P95 and maximum errors must satisfy the generated elevation QA contract before publication.

## Material truth

- Surface colour is a **programmatic composite** derived from elevation, slope, curvature, local relief, and hillshade. It is not satellite imagery and not an orthophoto.
- `terrain_karst_detail.webp`, or its tiled equivalent, is bound as a distinct high-resolution karst detail field. The “peak-cluster detail” control changes that field directly rather than merely changing global colour contrast.
- The normal, roughness, material, and karst assets are checksummed release resources.

## River display truth

- Winter, spring, summer, and autumn are **visual seasonal presets**, not a real-flow or discharge simulation.
- Presets must serialize these exact width/depth/colour values without range-step coercion:

| Season | Width | Visual depth | Colour |
| --- | ---: | ---: | --- |
| Winter | 0.66 | 0.18 | `#4f83a8` |
| Spring | 0.92 | 0.34 | `#3d91b8` |
| Summer | 1.38 | 0.58 | `#277ca5` |
| Autumn | 0.82 | 0.28 | `#508da6` |

- Each season has a final gzip Float32 position buffer and gzip Uint32 index buffer. Browser rendering consumes only the serialized final display mesh that passed the versioned QA contract.
- Final bank vertices are resampled at their actual X/Z coordinates. They do not inherit the centreline Y value.
- The final decoded Float32 grounding report must show no penetration, P95 error at most 0.001 m, maximum error at most 0.01 m, and maximum clearance at most 2 m.
- Final topology QA independently covers joins, self-intersection, partition validity, cross-run overlap, welded shared boundaries, endpoint coverage, holes, NoData/extent transparency, and visual-depth conflicts.
- The source and final significant interior-ring counts must agree. Source/final area difference, symmetric difference, and filled-hole area must each be at most `1e-8`; only newly introduced global interior rings are required to be zero.
- Pre-clip endpoint gaps must be at most `1e-6` m, while decoded final endpoint coverage must be at most 0.03 m. These are independent measurements.
- Rounded joins use Q16 construction and must meet their measured radius, heading, ratio, and 0.25 m sagitta contracts.

## Camera and evidence contract

- The camera supports near-ground navigation with terrain collision and a safe minimum clearance; the old 3,500 m near-distance limit is not retained.
- Browser QA performs trusted left-drag rotation, wheel zoom, right-drag pan, landmark jumps, reset, return-to-overview, and mobile pinch zoom. Camera position, target, and distance are recorded before and after each action.
- Evidence covers the overview, Guilin close view, Yangshuo karst, peak cluster/cliff, river cross-slope grounding, four same-camera seasonal views, NoData boundary, LOD/wireframe diagnostics, `1720 × 1080` desktop, and `390 × 844` mobile.
- Karst-off/default/enhanced comparisons use fixed cameras for representative peak cluster, cliff, gully, and Yangshuo valley locations.
- Browser failures still upload logs, contracts, and every screenshot produced before failure. They never authorize Pages publication.

## Release gate and budgets

- Workflow job cap: 360 minutes.
- Local browser outer cap: 100 minutes; Node host deadline: 75 minutes.
- Public deployment freshness cap: 20 minutes.
- Public browser outer cap: 75 minutes; Node host deadline: 60 minutes, leaving evidence-flush margin.
- Exhaustive public resource cap: 20 minutes. Every published resource, including all 6,742 LOD tiles, is checked at the real public origin. A 404 on **any attempt**, even if a retry later returns 200, fails the release.
- The branch, remote HEAD, Draft PR state, source commit, non-force Pages ancestry, destination-only tree delta, and published bytes are checked before and after publication.
- Pages publication is permitted only after source, mosaic, terrain, LOD, river, asset, and local-browser QA all pass. `gh-pages` is changed only by the pinned branch workflow and only within `guilin-v072-terrain-rivers/`.
- Final status is fail-closed and rechecks that PR #54 is still open, Draft, unmerged, and still points to the source commit.

## Online target

https://haihao0307.github.io/guilin-dem-pipeline/guilin-v072-terrain-rivers/?v=072

## Approval checklist

These remain deliberately unchecked until the corresponding generated and public evidence exists.

- [ ] Full source, mosaic, terrain, LOD, river, and asset QA passed in GitHub Actions.
- [ ] All four visual seasonal presets passed exact browser contracts.
- [ ] Native 12.5 m close terrain was demonstrated at every fixed acceptance point.
- [ ] Karst detail was proven bound to the material with fixed-camera comparisons.
- [ ] Final serialized river banks passed real Float32 grounding and topology QA in every season.
- [ ] Camera and touch interactions were proven effective and recoverable.
- [ ] Console errors are zero and public resource 404 attempts are zero.
- [ ] Failure evidence artifact, successful evidence artifact name, and Actions run ID were recorded.
- [ ] GitHub Pages publication and public freshness checks passed for the exact source commit.
- [ ] Final visual approval was granted.

PR #54 must remain open, Draft, and unmerged until every item above is backed by the required public and downloadable evidence.
