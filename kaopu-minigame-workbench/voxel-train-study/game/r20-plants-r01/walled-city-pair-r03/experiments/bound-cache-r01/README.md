# Shared original storey-bound cache, isolated experiment

Status: local CPU mathematical replay and operation-count experiment only. No runtime, current QA branch, publication, GPU pipeline or original mother was changed. Fixed source: 5c20bcf2, following its actual bounded household before/after review. Runtime hashes are in COUNTS.json.

## One optimization, deliberately no spatial culling yet

At a fixed query point, the original storey bound depends only on that point and the floor record. It does not depend on material exclusion keys, the current group winner or candidate round. Cache all27 original f32 bound values once; all six floor groups still scan all27 in original order and retain their individual `bound > h.d + .024`, `bound > .22`, proxy and detail choices. No floor or original coarse proxy is omitted. Roof/borrowed-link group and shadow visibility are unchanged.

The cache stores values from the exact original expression. It is not a different coarser bounding shape. The .012m material displacement bound and displaced-candidate competition stay unchanged. Current h.d-dependent pruning must be repeated even when its distance is cached. Equal-distance order must remain the same. The entire query falls back to original calculation if cache validation fails, floor count differs or generation is invalid.

## Executed local checks

7/7 tests pass.694 fixed metre points include135 window-edge,135 neighbouring-floor,135 stair-opening,135 gap-side,27 roof-edge,27 borrowed-link positions, and100 ray/front-plane intersection points from three actual perspective cameras (overall, pair-cut, frontage-diagnostic). The latter are domain samples, not claimed to be recorded final GPU hits.

Tests compare binary32 result bits, original branch decisions around ±.012m displacement and .024m pruning margins, six-group candidate order with duplicate proxy keys and excluded candidates, a second-nearest object winning after displacement, point/world-generation changes, and pause/cancel invalidation contracts. The candidate detail leaves in the competition test are explicitly synthetic deterministic adversarial values. No original material is replaced or ported into this CPU test. It does not prove full WGSL GPU equivalence.

Measured operation counts on those694 samples:

- One six-group candidate round:112,428 uncached bound-distance evaluations →18,738 cached. Threshold checks remain112,428; detail callbacks remain5,132.
- Four deliberately repeated rounds at the same points:449,712 →18,738 distance evaluations. Threshold/detail counts remain unchanged.
-32 deliberately repeated rounds:3,597,696 →18,738. This is a stress fixture, not the observed frame's average candidate count.

The first reduction is83.33% of repeated bound arithmetic only. It does not mean83% faster rendering: life-detail fields, six original scans, dispatches, materials and shadows remain. The real prior frame's94.634% candidate-group cost does not isolate bound arithmetic from those other costs.

## Proposed GPU layout, not integrated

The current layout already uses8 storage bindings. Do not append two new bindings just for this cache. The experimental WGSL sketch instead extends the existing binding4 scratch arena:7168 original GeoHit records, followed by27×1024 f32 bounds and1024 vec4<u32> point/generation keys. Extra126,976B; arena grows458,752→585,728B. This is transient GPU data, not world parameters, mesh or a texture.

Geo0 prepares a context's cache using point xyz bit patterns and a nonzero host world generation. Its writes complete before geo1..5 read because the existing ordered compute passes are retained. Query/material may move to a new point only after all groups; new-point bits force refresh. New world upload/camera epoch resets generation or clears keys; wrap must force a full clear. Pausing leaves valid context state intact. A new job cannot reuse shared storage until the old submitted batch drains. These are proposed integration obligations, not newly GPU-tested lifecycle guarantees.

## Decision and next bounded test

Worth one small GPU numerical probe, not another full scene image. Compile original uncached expression and cached path with the same shader compiler; compare all27 f32 outputs and branch decisions for the694 points, plus different generations and same-point competing candidates. Count prepare/evaluation/cache-hit operations on the GPU. On any mismatch, disable the cache and use the current complete scan. Only after that probe should the existing small frontage ROI be A/B-tested with actual hit records, depth/material identities, error counts and stage timing. No performance promise before those results.

Conservative floor interval pruning is deferred: removing an apparently distant floor can also remove its coarse proxy and alter current candidate stepping. This experiment avoids that extra correctness variable.

Reproduce: `node --test experiments/bound-cache-r01/cache.test.mjs` then `node experiments/bound-cache-r01/measure.mjs`. Remove/ignore this experiment directory to roll it back; current runtime source and accepted diagnostic images are untouched.
