# Current Best View R79 — Half-boundary fixture selection requires frozen input calibration

Status: **Candidate failed preregistration**.

## Observation

- Actual Float calibration preserved isolated one-Half-ULP predictions for the product and sum ablations.
- The preregistered complement ablation collapsed to the same Half prediction as all other models.
- The all-three precondition failed, so no Half target was rendered and no renderer-stage conclusion was produced.

## Current Best View

R78's single counterexample remains the current best observed evidence for staged-equivalent replay on the locked software path. R79 neither strengthens nor overturns it.

For ULP-boundary fixture design, freeze independently observed source calibration before searching and preregistering target cases. Approximate calibration is acceptable for exploration, not for authorizing a target experiment whose discriminating power depends on one rounding boundary.

## Rejected

- Post-hoc replacement of the failed complement case inside R79.
- Promotion of unrendered product/sum predictions to renderer observations.
- Partial execution after an all-cases gate fails.

## Unknown

A valid complement discriminator; renderer selection on the product and sum cases; generality across inputs and formats; hidden fixed-function instructions; hardware GPU; WebGPU; Safari/iPhone; real assets; performance; visual acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
