# KAOPU Learning Flywheel — function-surface invalid-sample flicker gate (N200)

- Date: 2026-10-27
- Baseline: main@3ccae4bde0c91973adbb81f99ec4d54bc9357ce0
- Trigger: the user reported many black points flickering in the first function-engine visual candidate.
- Production source: UNKNOWN_NOT_AVAILABLE_IN_CURRENT_MAIN
- Bounded question: **can a small validity/state contract distinguish invalid function samples from legitimate visibility before anyone tunes lighting or hides the symptom?**
- Decision: CANDIDATE_GATE_VALIDATES_BOUNDARY_ROOT_CAUSE_UNKNOWN
- Candidate regression: FUNCTION-SURFACE-INVALID-SAMPLE-FLICKER-001
- Production/R2 change: none
- Affected route: Rendering / Function Engine / Procedural Geometry through coordination issue #91; no ACK claimed

## Baseline and deduplication

The required R2 OS, reference-replication gate, freshness gate, root AGENTS.md, latest #91/#63 and applicable regression cases were reread first. Current main has not changed since N199.

N199 already separates shared function-class work from per-instance visibility. It does not cover a different failure mechanism: an evaluator returning a non-finite, zero-gradient, unconverged or temporally unstable sample that is silently shaded as black. Repository search found no existing regression for this layer.

The user's black-point observation is real. The root cause is not yet known because the current candidate source, shader, runtime receipt and frame captures are not present in current main. This log therefore creates a **diagnostic Candidate**, not a production diagnosis.

## Current Best View

Do not let a function evaluator return only “hit / miss.” Keep two explicit state levels.

Cell or bounded-region state:

    EMPTY
    FILLED
    AMBIGUOUS
    UNKNOWN

Point/sample state:

    MISS
    HIT_CONVERGED
    INVALID_NONFINITE
    INVALID_GRADIENT
    UNCONVERGED_RESIDUAL
    BUDGET_EXHAUSTED

A sample may enter shading only when all of the following are true:

1. position, depth, residual, gradient, normal and color are finite;
2. abs(f(p)) <= epsilonSurface(scale);
3. length(gradient) > epsilonGradient(scale);
4. depth is valid for the declared camera range;
5. the evaluation/root budget was not exhausted;
6. time/noise inputs match the Task Anchor.

An invalid sample must remain an explicit failure state, increment a counter and appear in a debug state buffer. It must not be silently converted into a black surface pixel.

## Minimal f32 replay

The probe uses a unit sphere centered at world x=10000 and emulates f32 arithmetic.

| Fixture | Observation | Required decision |
|---|---|---|
| fixed finite-difference epsilon 1e-5 | both offset samples quantize to the same f32 position; gradient becomes [0,0,0]; normalization becomes NaN | INVALID_GRADIENT |
| scale-aware epsilon 0.0078125 | gradient [2,0,0], normal [1,0,0] | HIT_CONVERGED |
| point x=10001.01 | residual 0.0196266174 > 0.001 | UNCONVERGED_RESIDUAL |
| invalid function domain | residual NaN | INVALID_NONFINITE |
| outside/inside/crossing/maybe-NaN cells | EMPTY / FILLED / AMBIGUOUS / AMBIGUOUS | preserve state |
| hidden frame perturbation with frozen nominal inputs | eight frames alternate between converged and unconverged | reject hidden temporal dependency |

All **9/9** expected assertions passed.

This does not prove that the observed black dots come from the fixed-epsilon example. It proves that the proposed receipt can expose this entire failure family instead of allowing it to masquerade as lighting, shadows or valid surface color.

## WGSL-specific boundary

The official WGSL specification states that derivative operations such as dpdx, dpdy, fwidth and texture operations relying on implicit derivatives require uniform control flow. Calls in non-uniform control flow yield indeterminate values, and derivative_uniformity defaults to an error.

Primary source:

- https://gpuweb.github.io/gpuweb/wgsl/#uniformity
- https://gpuweb.github.io/gpuweb/wgsl/#derivative-builtin-functions

Candidate rule:

- shader compilation diagnostics are part of the Delivery Receipt;
- a derivative call under divergent hit/miss branching is rejected or moved to a uniform phase;
- suppressing derivative_uniformity is not an acceptable fix.

The current shader is unavailable, so applicability to the observed candidate remains UNKNOWN.

## External teacher audition — libfive

- Screening status: TEACHER_CANDIDATE
- Lifecycle: RADAR_FOUND -> TEACHER_CANDIDATE
- Registry/referenceSet: not entered

**What it knows beyond KAOPU Current Best View:** libfive's interval evaluator does not collapse a functional region directly to a binary surface result. It carries a maybe_nan flag and explicit EMPTY / FILLED / AMBIGUOUS / UNKNOWN states; domain-sensitive operations propagate the possibility of NaN. This is the missing state semantics needed to prevent an unsafe function region from silently becoming a shaded black hit.

Primary sources:

- official repository: https://github.com/libfive/libfive
- interval implementation at observed head: https://github.com/libfive/libfive/blob/918387a9220dbac2f7ab32fb35e274c6794439cf/libfive/include/libfive/eval/interval.hpp
- interval evaluator tests: https://github.com/libfive/libfive/blob/918387a9220dbac2f7ab32fb35e274c6794439cf/libfive/test/eval_interval.cpp
- observed latest commit on 2026-10-16: https://github.com/libfive/libfive/commit/918387a9220dbac2f7ab32fb35e274c6794439cf

Teacher screening:

1. **Source/provenance:** official libfive repository by the project maintainers.
2. **Maintenance:** observed head updated 2026-10-16, with active build/portability fixes.
3. **Runnable evidence:** C++ source, interval evaluator, tests and cross-platform build instructions.
4. **License/assets:** core library/stdlib/Python are MPL-2.0; Guile bindings and Studio are GPL-2.0-or-later. These layers must not be treated as one license.
5. **Direct relevance:** functional representations, interval evaluation, NaN propagation and explicit ambiguity states directly match the bounded problem.
6. **Novelty:** current KAOPU function-engine contract lacks region ambiguity and numeric invalidity states.
7. **Dependency/cost:** full integration requires C++, Boost Interval, Eigen and other dependencies; not suitable for the first WebGPU trial.
8. **Risks/boundary:** libfive's primary production output is feature-preserving triangle meshes, conflicting with the user's pure-function runtime direction. Learn only the evaluator/state semantics. Do not adopt its meshing route or dependencies.

## Candidate translation

Task Anchor additions:

    functionClassId
    functionRevision
    parameterDigest
    coordinateScale
    epsilonSurfacePolicy
    epsilonGradientPolicy
    finiteDifferencePolicy
    iterationBudget
    timeAndNoiseFreeze
    derivativeUniformityPolicy

Delivery Receipt additions:

    surfaceResidualMax
    gradientNormMin
    nonFiniteSampleCount
    invalidGradientCount
    unconvergedSampleCount
    budgetExhaustedCount
    ambiguousCellCount
    frozenFrameStateHashes
    frozenFrameDepthHashes
    frozenFrameNormalHashes
    wgslCompilationDiagnostics
    debugStateBuffer
    hardwareBrowserAndRuntime
    verifierIdentity

Verifier gate:

- invalid/non-finite/unconverged samples cannot reach shading;
- a maybe-NaN or surface-crossing region remains AMBIGUOUS;
- a fixed global normal epsilon needs scale evidence; otherwise use a declared scale-aware policy;
- with camera, function parameters, time and noise frozen, eight frames must have identical state/depth/normal hashes;
- WGSL derivative-uniformity diagnostics cannot be disabled;
- producer cannot self-approve.

## One-Mother audition boundary

Instrument the actual first function-engine candidate, without changing its visible design:

1. add a compact per-pixel/sample state buffer;
2. count each invalid state separately;
3. freeze camera, time and noise for eight frames;
4. compare state/depth/normal hashes;
5. display invalid states in a debug-only false-color view;
6. test a scale sweep and a camera-distance sweep.

Only then can the black dots be classified as numerical invalidity, hidden temporal dependence, visibility/depth error or another mechanism. Until the source and real WebGPU receipt exist, the root cause and production fix remain UNKNOWN.

Current state after this replay is only POSTED / synthetic GATE-RUN once routed; ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED remain false.
