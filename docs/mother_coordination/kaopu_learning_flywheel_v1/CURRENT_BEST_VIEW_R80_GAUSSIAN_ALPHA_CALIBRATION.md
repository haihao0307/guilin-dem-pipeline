# Current Best View R80 — Calibration and target evidence must be separate checkpoints

Status: **Candidate partial**.

## Observation

- The fixed Three.js r186 software path produced a complete, strictly increasing center effective-Alpha table for source bytes 0 through 255.
- The table hash is `19fc9645e760d2fe3fc363985d9c52f07166979abbf5a3e3276ee16f41c7eab8`; its range is `0` through `0.41482388973236084`.
- Independent Float full-frame repeats for endpoint and derived-candidate Alpha bytes were exact.
- R80 rendered no Half target and no two-record target.

## Candidate

The frozen table yields a new isolated complement fixture using `(alpha=21, color=248)` followed by `(alpha=52, color=1)`. Its fully staged and no-complement-rounding predictions differ by one Half ULP, while the product and sum ablations coincide with staged.

This is **Candidate-unrendered-target**, not an Observation about renderer arithmetic.

## Current Best View

Use independently frozen input calibration to select ULP-boundary fixtures, then preregister target cases in a later checkpoint. R78 remains the only observed Half target that selects `f32-staged` on the locked software path. R80 improves experimental validity but adds no new Half-target conclusion.

## Rejected

- Approximate Alpha ratios as sufficient authorization for a Half-boundary target matrix.
- R79's collapsed complement pair as a discriminating fixture.
- Promotion of R80's derived pair before independent target readback.
- Treating one software root's monotonic table as a portable renderer contract.

## Unknown

The new complement target result; product and sum target results; hidden fixed-function instructions; portability across footprints, pixels, formats and backends; hardware GPU; WebGPU; Safari/iPhone; real assets; performance; visual acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
