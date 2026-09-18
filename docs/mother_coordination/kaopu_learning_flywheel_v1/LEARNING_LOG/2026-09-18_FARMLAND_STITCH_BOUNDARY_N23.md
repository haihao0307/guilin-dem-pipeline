# KAOPU Learning Note — N23 Farmland stitch-boundary contract

Date: 2026-09-18  
Bounded question: Does R045.36 remain continuous when its drainage-clearance predicate crosses the hard stitch gate?

Status: **Candidate partial / pinned R045.36 CPU semantic counterexample verified; Mother implementation/adoption, hardware or public runtime and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother R045.36

Farmland PR65 advanced after N22 through R045.35 and R045.36, fixed here at commit `692e472abcdd52a677d029c5c42c7d0d56baf189`. This is useful new implementation evidence but not an explicit acknowledgement of N22 or the earlier routed gates.

R36 searches a finite contour-tangent fan for same-family shoulders and persists `39/39` passing QA. Its retained coarse grid finds 20 material stitch cells, 8 active-threshold crossings, zero sampled unsafe stitches and a maximum `0.765972 m` added-delta change over 6 m. The implementation correctly preserves its drainage, receiver, parcel, hydraulic and production locks.

The unresolved continuity contract sits below that grid. `stitchInfoAt` returns the inherited state whenever drainage clearance is `<=0.035`. Immediately inside, the safety factor begins at a non-zero floor and the candidate interpolation also retains a non-zero base term. Therefore `smoothstep` inside the later score does not imply that the complete gated output approaches the inherited state at the earlier return boundary.

### Observation root B — pinned executable epsilon counterexample

The N23 probe imports the exact R35/R36 kernels and reads R36's persisted QA result; it does not modify the Mother source. At `z=-108 m`, it brackets `x=42.75..43 m`, bisects the drainage-clearance value to `0.035` for 50 iterations, then evaluates both sides one micrometre away.

The same strong contour pair exists on both sides: contour axis, angle `-0.18`, distance `36 m`, group `0`, strength about `0.545`. Broad eligibility remains above `0.876` and the group envelope above `0.969`. The changing predicate is the drainage gate alone.

Across the `0.000002 m` interval:

- inherited R35 height changes `3.3661e-7 m`;
- R36's stitch target changes from `0` to about `0.537088`;
- mask changes `0.499299`;
- composed height changes `0.0801605 m`.

This is an actual epsilon-scale boundary seam missed by the 6 m anti-cliff gate. It is not caused by a pair change or by substrate geometry.

An analysis-only counterexample repair applies `smoothstep(0.035, 0.055, drainage_clearance)` to the **R36–R35 effect increment**, not to the complete terrain. It reduces the same epsilon jump to `3.3661e-7 m` and becomes exactly R36 at the checked interior point where clearance exceeds `0.055`. This proves the zero-at-boundary construction, but the `0.02` mask-space width is not a selected production parameter.

Local replay and [GitHub Actions run 35366242389](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35366242389) pass `9/9` gates. Local and CI replay are the same analysis design, not independent evidence.

### Observation root C — mature primary contracts

[SideFX HeightField Blur](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_blur.html) explicitly warns that ordinary processing along a mask can cause sharp boundary changes and provides mask-aware blur to avoid discontinuities. [HeightField Mask by Feature](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_maskbyfeature.html) exposes ramps and a smooth radius to feather feature masks rather than treating every threshold as a full-strength binary effect. [HeightField Layer](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_layer.html) keeps the blend amount and optional effect mask separate.

These are transferable compositing contracts, not evidence that N23's demonstration width is correct. They support treating source feature, mask/eligibility and effect blending as distinct versioned objects.

### Observation root D — routing and acknowledgement state

The latest PR65 conversation contained the N22 route but no Mother acknowledgement. R35/R36 commits therefore count as new source evidence, not as acknowledgement, implementation of N22, or adoption. N23 was [delivered once after successful coordinator replay](https://github.com/haihao0307/guilin-dem-pipeline/pull/65#issuecomment-5732699491); delivery, acknowledgement, implementation and adoption remain distinct.

## Candidate

For every procedural stitch predicate, declare one of two semantics:

1. **hard exclusion:** an intentionally discontinuous boundary justified by safety/topology, named in diagnostics and tested as such;
2. **soft eligibility:** a continuous field whose envelope multiplies the added effect and tends to zero at the boundary.

For soft eligibility, form `output = inherited + envelope * increment`, not `if eligible then full_effect else inherited`. Save epsilon-side value, gradient and curvature receipts at every threshold and discrete candidate switch, alongside the coarser mesh/fixed-view checks. Keep intentional terrace risers, drainage breaks and morphology eligibility in separate masks so smoothing one does not silently erase another.

## Current Best View

A smooth source or score is insufficient if a prior hard return changes whether a non-zero effect exists. Boundary compatibility is a property of the complete composition. The R36 coarse gate remains useful, but it cannot replace epsilon tests at each branch, threshold and selector boundary.

The analysis taper demonstrates one construction that closes this exact counterexample; it is not promoted as the Farmland production algorithm or width. Mother must first classify the predicate and return an implemented, versioned result under the existing locks.

## Frozen

- Canonical Truth, Frozen R1 and production Mother branches are unchanged.
- R045.36 remains `visualAcceptance=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false` and `productionReady=false`.
- Drainage carriers, water graph, parcel/shared-bund locks and prior visual/hydraulic constraints remain unchanged.
- R045.36 remains synthetic morphology, not surveyed Yunnan terrace geometry or hydraulic truth.

## Rejected

- “R36's `39/39` QA proves sub-grid stitch continuity.”
- “A smooth score guarantees continuity even when an earlier hard return bypasses it.”
- “The seam is caused by a different contour pair or changed substrate.”
- “Every hard boundary should be blurred, including drainage locks and intentional risers.”
- “The analysis-only `0.02` width is a production recommendation or acceptance.”

## Unknown

- Which R36 predicates Mother intends as hard safety exclusions versus soft morphology eligibility.
- Accepted transition width and value/gradient/curvature tolerances at the real mesh, LOD and fixed camera.
- Whether other angle/distance candidate switches introduce additional seams.
- Hardware GPU, persistent public runtime, actual Mother acknowledgement/implementation/adoption and user acceptance.
- Surveyed field microtopography and same-datum hydraulic controls.

## Routing recommendation

One incremental Farmland warning was [delivered to PR65](https://github.com/haihao0307/guilin-dem-pipeline/pull/65#issuecomment-5732699491): classify the predicates, make every soft boundary zero-compatible on the effect increment, and add epsilon value/gradient/curvature gates without weakening the current coarse, cut/fill, fixed-view, drainage, parcel, hydraulic or production locks. The message does not prescribe the demonstration width or ask Mother to smooth intentional hard breaks. Acknowledgement, implementation and adoption remain Unknown.

No Landscape or Brick route is warranted from this R36-specific counterexample. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
