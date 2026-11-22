# KAOPU Learning Flywheel N338 — Corrosion field orientation-kernel audition

## One bounded question

Before adding gravity, drainage or exposure-direction terms, can the same nominally isotropic corrosion field avoid grid-axis-dependent top-versus-side deformation?

This narrows N336. It does not revisit oxide-volume expansion, green-pit outward displacement, transfer to three assets or Producer/Verifier separation.

## Current Best View gap

N336 already requires a top/side slice receipt and an explicit physical reason for large differences, but it does not specify a falsifiable numerical control that separates intended directional physics from discretization bias introduced by clipping a finite-radius kernel against a Cartesian grid.

Without that control, a top face can stretch differently from a side face even when the field is intended to be isotropic, and the difference may be mislabelled as material behavior.

## Teacher audition

Status: TEACHER_CANDIDATE / AUDITION

Teacher: Helmholtz-Zentrum Hereon, Hereon-InstituteMS/nonlocal-kks

Pinned source:

- repository commit: 842ad95346b31c8aadeaf15e7489bc9bcc2f022b
- quadrature blob: 71d1af1130c7add8b701b1466566df69196d3686
- software release: 1.0.0, 2026-06-22
- DOI: 10.5281/zenodo.20800551
- license: MIT

### What it knows beyond KAOPU Current Best View

It provides an executable distinction between three finite-horizon discretizations:

- full cell-center inclusion (FA);
- partial boundary-cell area with cell-center location (PA-HHB);
- partial boundary-cell area with the clipped-cell centroid (PA-AC).

The transferable principle is not its implant-screw application. It is that a finite-radius isotropic field needs a boundary-aware integration rule and an explicit delta / h resolution parameter. Otherwise, axis alignment can enter the result before any intended exposure-direction term.

## Eight checks

1. **Source / provenance** — official Helmholtz-Zentrum Hereon organization repository; authors and institute are recorded in CITATION.cff; DOI-backed software release.
2. **Maintenance / release / issue activity** — public release and latest commit are both 2026-06-22; only two public commits and no issue history were found. This is a real maintenance risk, not evidence of sustained activity.
3. **Runnable code / tests / data** — C++17 study drivers, OpenMP/MPI/CUDA solvers, figure scripts and bundled small outputs exist. No CI or conventional unit-test suite was found; reproducibility is study-driver based.
4. **License / rights** — MIT source license; large raw fields are separately archived on Zenodo. KAOPU should port only the numerical rule, not external geometry or render assets.
5. **Direct relevance** — directly relevant to N336's unexplained top/side morphology drift; not sufficient for oxide-growth calibration.
6. **Novelty** — adds an executable orientation-bias metric and the delta/h plus clipped-boundary centroid parameter semantics absent from N336.
7. **Dependencies / hardware / cost** — the isolated 2D operator probe runs on CPU; full 3D studies require MPI and optional V100-class CUDA, so production adoption must not depend on the full solver.
8. **Demo-only / opacity / version risk** — not training-data dependent and not closed source; however the small commit history, missing CI and external large datasets mean it remains audition-only.

## Minimal falsifiable replay

Pinned parameters:

- delta = 1
- kappa = 2
- m = delta / h = 3
- wave-vector direction: every integer degree from 0 through 90
- 200×200 boundary-cell subsamples

Metric:

normalizedOrientationSpread = (max(operatorValue) - min(operatorValue)) / mean(operatorValue)

| scheme | normalized orientation spread |
|---|---:|
| FA | 0.0077463554 |
| PA-HHB | 0.0045758480 |
| PA-AC | 0.0001419620 |

At this pinned audition point, PA-AC reduced orientation spread by 54.5664× versus FA. The predeclared falsifier required PA-AC to be lower and at least 20× smaller; the synthetic probe passed.

## Candidate transfer

Add one N336-local verifier check, not a global OS rule:

1. evaluate the same corrosion field on at least two orthogonal surface orientations with directional physics disabled;
2. bind fieldDigest, delta, h, deltaOverH, boundary integration mode and slice digests;
3. report normalized orientation spread;
4. hold as HOLD_CORROSION_FIELD_ORIENTATION_BIAS if the production threshold fails;
5. only after this neutral control passes may gravity, drainage or exposure direction justify a top/side difference.

The production threshold remains UNKNOWN; the synthetic 20× teacher comparison is not a production acceptance threshold.

## Decision and limits

Decision: CANDIDATE_N336_ORIENTATION_BIAS_CONTROL_AWAITING_MOTHER_REPLAY

- Synthetic audition: GATE-RUN=true
- Production Material/Mechanical Mother replay: NOT_RUN
- POSTED: pending directed issue comment
- ACKNOWLEDGED / IMPLEMENTED / ADOPTED / USER-ACCEPTED=false
- no change to main, R2 OS, production Mother branches or Canonical Truth
