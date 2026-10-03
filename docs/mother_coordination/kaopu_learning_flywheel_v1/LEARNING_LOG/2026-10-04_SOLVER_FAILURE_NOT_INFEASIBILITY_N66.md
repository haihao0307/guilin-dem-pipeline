# N66 — Solver failure is not an infeasibility certificate

Status: Tailor01 Candidate after one real production correction. No production Mother, `main`, `gh-pages`, R2 baseline, schedule, Canonical Truth or user-frozen asset is changed.

## Bounded question

When may KAOPU promote a bounded nonconvex sewing/forming failure into “the source cut shape is incompatible,” rather than retain the result as an inconclusive solver path?

## Existing real failure / correction

Humanoid-Rig-Lab-Next PR #16 currently holds the shorts V9 wearing candidate after large strain and body intersection. The new source-only diagnosis correctly runs before body contact and does not add a dart first.

The user-authorized Tailor01 correction tightens the claim boundary:

- a bounded nonconvex solver with no accepted Armijo step proves only that this solve path failed;
- the same local hotspot on two mesh levels is not a mathematical energy lower bound;
- source metric feasibility with self-intersection is an immersion candidate, not a wearable embedding;
- dart/repartition needs a solver-independent necessary incompatibility witness or a controlled construction comparison.

## External method / evidence

1. Google OR-Tools CP-SAT explicitly distinguishes `INFEASIBLE` (“proven infeasible”) from `UNKNOWN`, where no solution was found but infeasibility was not proven before the solver stopped.
   - https://developers.google.com/optimization/cp/cp_solver
2. Ipopt documents `Infeasible_Problem_Detected` as convergence to a point of **local** infeasibility: the problem may be infeasible, or the algorithm may be stuck; a different start may help. Its successful result is likewise a locally optimal point.
   - https://coin-or.github.io/Ipopt/OUTPUT.html
3. Gurobi exposes an Irreducible Inconsistent Subsystem for an infeasible model, illustrating the stronger pattern: a scoped incompatibility claim should carry a checkable subset/certificate tied to the exact model, not only a failed search trace.
   - https://docs.gurobi.com/projects/optimizer/en/current/features/infeasibility.html

These sources concern different solver classes. KAOPU adopts their status-semantics distinction, not a claim that CP-SAT or IIS directly solves nonlinear cloth embedding.

## Comparison with current KAOPU rules

R2 already requires UNKNOWN instead of invention, limits repeated failed loops, and forbids Producer self-approval. It does not yet type the difference between:

`search path failed` and `the exact constrained model is proven incompatible`.

New failure mechanism:

`local solver termination -> unsupported global impossibility claim`

## Falsifiable hypothesis

A claim gate that accepts only a checked, exact-scope necessary witness or exact certificate for `CERTIFIED_INCOMPATIBLE_SCOPED`, while mapping local nonconvex failures to `SEWING_INCONCLUSIVE`, will prevent false dart/repartition diagnoses without blocking real constraint contradictions.

The hypothesis is falsified if:

- `NO_ACCEPTED_STEP` or `LOCAL_INFEASIBILITY` alone becomes certified incompatibility;
- a strict anchor-distance Lipschitz violation is not promoted;
- self-intersecting low-strain geometry is called wearable;
- a boundary length mismatch is certified even though gathering/sliding is permitted.

## Minimal replay

Artifacts:

- `REGRESSION_CASES/CANDIDATE_SOLVER_FAILURE_NOT_INFEASIBILITY_001.json`
- `PROBES/solver_claim_status_gate_n66.mjs`
- `PROBES/solver_claim_status_gate_result_n66.json`

The replay covers the current V9 no-accepted-step path, two remesh levels, immersion vs embedding, a strict source-geodesic/target-distance witness, a non-violating control, a gathered boundary counterexample, a prescribed bijective boundary violation, an exact scoped certificate, and a valid embedding candidate.

## Executable receipt semantics

Minimum fields for any incompatibility promotion:

```
modelIdentityBound
problemClass
solverTermination
requestedClaim
necessaryWitness.type
necessaryWitness.scope
necessaryWitness.checkerPassed
necessaryWitness.numericMargin / certificateVerified
```

Primary states:

- `SEWING_INCONCLUSIVE`
- `IMMERSION_NOT_EMBEDDING`
- `HOLD_INCOMPATIBILITY_CLAIM_UNSUPPORTED`
- `CERTIFIED_INCOMPATIBLE_SCOPED`
- `WEARABLE_EMBEDDING_CANDIDATE`

For an anchor pair on the same connected source patch with upper principal stretch bound `sigmaMax`, a strict necessary witness is:

`targetEuclideanDistance > sigmaMax * sourceGeodesicDistance + tolerance`.

A boundary arc-ratio witness is allowed only when the exact task prescribes continuous bijective correspondence and forbids gathering/sliding; otherwise a shorter target boundary may represent ease rather than incompatibility.

## Applicability boundary

This Candidate applies first to Tailor01 source-only forming. The same semantic distinction may later be tested in inverse geometry, fitting, IK and contact solvers, but it is not globally adopted by this one trial.

It does not prescribe a dart, repartition the shorts, modify source UV/rest, freeze vertices, or certify wearable cloth.

## Decision

Retain as a Tailor01 Candidate and route it to PR #16. Promote only after the affected Mother records one real receipt using the typed states and a checked witness. Lifecycle at creation: `IMPLEMENTED_CANDIDATE` and local `GATE-RUN`; not `ACKNOWLEDGED`, `ADOPTED`, or `USER-ACCEPTED`.
