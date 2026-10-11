# R20 bounded character and cost evidence

## Frozen anchors

- Accepted R19: `7b8d8908c6539e52d5336470111be6219ffc1ea7`.
- First R20 visual candidate: `0a6e0c4410b2a110957eaf47ddf872e1b3c0d177`, draft PR199.
- Official Chromium/Playwright1.57 ANGLE SwiftShader run38063408790, Ubuntu24.04. This is actual software WebGL, not physical phone GPU performance.

## First candidate result

86 source/geometry tests passed. Native driving from the first station to the second, replay equality, loading coverage and trusted touch at390×844 plus1024×600 passed. The two station signs visibly contain one Chinese title and one English title per face. Four font families,148 tenant identities and five facade families were present in actual images.

The visual performance gate **failed**: the changed-frame streaming p95 over350–440 scene metres was296.8ms versus R19's213.8ms (1.388×; declared limit1.25×). Median complete software frames across six fixed camera poses were0.898–0.972× R19, which does not excuse the streaming spike. Geometry and packed-buffer gates passed. The candidate was not published.

The images remain a detail/structure candidate built on inherited lighting/materials. Heavy repeated cage lines, relatively uniform window treatment, and patch-mask appearance remain quality limitations. They are not certified film-quality assets.

## CPU glyph-cache policy experiment

Three rotated-order Node trials per policy, forward0→700→0 and six local335↔385 cycles:

- Unbounded:89.185MB post-update shared CPU cache; full return glyph rebuilds0.
-24MB LRU:23.999MB post-update,29.722MB transient pre-trim; return rebuilds1,535.
- Immediate release:7.657MB post-update; local oscillation rebuilds1,581, whereas LRU and unbounded both rebuild0.

Return build-bearing update p95 was39.015ms unbounded,80.093ms LRU; local oscillation p95 was41.680/34.870/100.265ms for unbounded/LRU/immediate. This showed why last-reference immediate CPU deletion is unsuitable. Active owners, including prefetched chunks, are protected. GPU release remains tied to the final source owner. The cache's24MB number is a soft idle-cache target, not a hard transient memory ceiling.

All2,096 matched source/packed-data comparisons were byte-identical across those three policies, and all18 complete disposals ended with zero shared CPU bytes/references. These are CPU and data-ownership measurements, not raster or GPU tests.

The isolated change now shares canonical native glyph tessellation across requested sizes/depths, retaining per-sign transforms. All92 source/geometry tests pass. Across3,744 title recipes and66,552 contours, maximum old/new boundary displacement is0.637 micrometre; bounds differ by at most0.559 micrometre. Native curve functions are byte-identical. Some triangulations change, so geometry-byte equality is not claimed. No degenerate/inverted canonical triangle was found. UV coordinates change but neither packed street surfaces nor station lettering consumes those UVs.

Route resource accounting reduces logical glyph keys from1,320 to373; the24MB policy builds381, including8 return rebuilds. Referenced shared CPU peak falls7.657→3.500MB; transient pre-trim peak29.722→24.240MB. This is primarily a CPU cache/tessellation change; packed geometry remains approximately18MB. The module grows only563 raw bytes relative to the size-specific24MB cache variant.

Actual WebGL same-pose pixel and performance checks remain pending for this change. Building count, identities, fonts, weather functions and physics are unchanged. The new CI additionally loads the frozen first R20 source in a temporary comparison directory, follows the same camera/loading history and tests its image difference. That directory is created only during testing and is not a new runtime dependency.
