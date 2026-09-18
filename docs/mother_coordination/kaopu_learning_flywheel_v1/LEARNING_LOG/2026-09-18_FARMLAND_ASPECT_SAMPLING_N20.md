# KAOPU Learning Note — N20 Farmland aspect sampling and near-flat conditioning

Date: 2026-09-18  
Bounded question: Does R045.30's sampled `<35°` aspect-rotation gate bound the implemented field, and what minimum receipt makes a direction comparison transferable?

Status: **Candidate partial / pinned R045.30 CPU sampling counterexample verified; purpose-specific slope floor, continuous-field bound, target device and user acceptance Unknown**

## Observation roots

### Observation root A — actual Farmland Mother implementation and failures

Farmland PR65 advanced after N19 to R045.29 and R045.30. R045.30 at `b542dccc1a44880dbb8a6ba8313bcfa0e6da3726` adds three outlet-tied aspect fields. Its retained history is useful: the first implementation passed `40/42` gates but produced a `0.417 m` change per `4 m` longitudinal step and a sampled `47.5°` direction rotation; smooth segment-frame blending removed the step failure, while a second attempt still failed the unchanged `<35°` gate at `37.75°`; reducing torsion amplitude produced the final `42/42` receipt.

The final Mother QA samples `x` every `10 m` and `z` every `6 m`, discards points where either gradient magnitude is below `0.01`, then reports a maximum R045.29→R045.30 angle of `32.3842740874°` at `(-60, 34)`. Chrome startup passed and the fixed-view review still records `visualAcceptance=false`. Terrace, parcel, water-state and production locks remain false.

This is actual implementation feedback. It is not evidence that the N19 screen-space guidance was acknowledged or adopted: R045.29/R045.30 do not serially preserve the requested unnormalized pixel-motion receipt, and no explicit Mother reply acknowledges N19. The N19 route therefore remains **delivered, not acknowledged**, and is not repeated this round.

### Observation root B — pinned executable sampling counterexample

The N20 probe imports the exact R045.29/R045.30 kernels and first reproduces the published Mother lattice exactly: `497` eligible samples, maximum `32.3842740874°` at `(-60, 34)`.

Changing only the audit lattice exposes two independent limitations:

- shifting the same `10 × 6 m` spacing by `(5, 3) m` changes the reported maximum to `26.9522807443°`;
- a `5 × 4 m` lattice finds `35.6414085863°` at `(-60, 36)`, crossing the unchanged `<35°` threshold that the original lattice passed.

The missed peak is nearly flat under the current contract: old and new gradient magnitudes are `0.0145551` and `0.0193491`, only slightly above the `0.01` eligibility floor. In the denser replay, the maximum for samples with minimum magnitude `0.02–0.05` is `28.3259°`; for `>=0.05` it is `18.3105°`. These bands diagnose conditioning; **`0.02` and `0.05` are not proposed production thresholds**.

An independent analytic counterexample applies the same orthogonal gradient perturbation `0.01` to base magnitudes `0.014` and `0.14`. The direction changes are `35.5377°` and `4.0856°` respectively. Direction becomes ill-conditioned as slope magnitude approaches zero even when the vector perturbation is unchanged.

All `8/8` gates pass locally. `abs(atan2(cross,dot))` agrees with the existing `acos(normalized dot)` magnitude to below `1e-9°` on retained non-degenerate samples; `atan2` adds a signed, wrap-safe receipt but does not cure near-flat conditioning.

This replay is derived from the fixed Mother source and is not an independent empirical terrain observation.

### Observation root C — mature-system and language contracts

[SideFX HeightField Mask by Feature](https://www.sidefx.com/docs/houdini/nodes/sop/heightfield_maskbyfeature.html) treats slope and horizontal facing direction as separate criteria, expresses direction with a goal angle plus an angle spread, and exposes smoothing radius in voxels. This supports saving sampling scale, slope eligibility and direction tolerance as explicit contract fields; it does not validate R045.30's numerical thresholds.

[GLSL ES 3.00.6](https://registry.khronos.org/OpenGL/specs/es/3.0/GLSL_ES_Specification_3.00.pdf) defines two-argument `atan(y,x)` over `[-π,π]` and makes the both-zero case undefined. [WGSL](https://www.w3.org/TR/WGSL/#atan2-builtin) likewise defines signed quadrant-aware `atan2` over `[-π,π]` and separately specifies finite precision. These are language contracts, not evidence that a terrain aspect is meaningful when the source gradient is nearly zero.

## Candidate

For a procedural surface direction A/B, serially preserve:

1. coordinate units, finite-difference stencil/half-step and exact sample lattice including origin phase;
2. old and new gradient vectors and magnitudes;
3. gradient-vector delta magnitude;
4. signed wrapped angle `atan2(cross,dot)` only after both vectors pass a declared, purpose-specific magnitude floor;
5. at least one offset or denser negative-control lattice around maxima and thresholds;
6. geometric, renderer and human acceptance as separate receipts.

A sampled maximum is a property of the declared lattice. It is not a continuous-field bound. Near-flat samples should become `Unknown` for direction-dependent decisions unless the consumer defines and validates a slope floor; they should not be silently counted as zero direction or stable aspect.

## Current Best View

R045.30's `32.384°` result is reproducible but does not certify that the implemented support stays below `35°`. The same fixed field reaches `35.641°` on a modestly denser lattice, and the miss occurs where direction is poorly conditioned because the gradients are small.

The corrective action is not to raise `35°` until the test passes. Keep the existing Mother failures, report both vector and angular change, declare the magnitude floor by downstream purpose, and treat lattice phase/density as part of the test version. Until those choices are accepted by the Mother and validated against the actual visual or geometry decision, the aspect gate remains **Candidate**, not production truth.

## Frozen

- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.
- R045.30's `visualAcceptance=false`, `terraceGeometryEnabled=false`, `parcelGenerationEnabled=false`, `waterStateKnown=false` and `productionReady=false` remain unchanged.
- The inherited drainage graph and the R045.29 substrate are not modified.
- N19 screen-space routing remains delivered but unacknowledged; it is not repeated.

## Rejected

- “One `10 × 6 m` lattice maximum bounds the continuous procedural field.”
- “Passing `<35°` once proves all implemented aspect rotations are below `35°`.”
- “Direction is stable whenever gradient magnitude is merely non-zero.”
- “The denser counterexample means the threshold should be raised above `35.641°`.”
- “`atan2` alone fixes near-flat conditioning.”
- “CPU replay or numeric direction gates replace browser/device and human visual acceptance.”

## Unknown

- The purpose-specific slope-magnitude floor for Farmland classification, terrace candidacy or visual acceptance.
- A certified maximum over the continuous support between samples.
- Whether R045.30's final aspect field improves the user-visible reference match.
- Hardware GPU, mobile/public runtime performance and user acceptance.
- Mother acknowledgement, implementation or adoption of N19/N20 guidance.

## Routing recommendation

Route one incremental warning to Farmland PR65 after the coordinator CI replay succeeds: keep the preserved failed iterations; add magnitude/vector-delta plus signed-angle receipts and an offset/denser lattice around any threshold maximum; do not weaken the threshold or select a new slope floor from N20 alone. Delivery will remain distinct from acknowledgement, implementation and adoption.

No Landscape or Brick route is warranted from this Farmland-specific counterexample. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
