# Current Best View R81 — Bit-exact replay must start from decoded SPZ attributes

Status: **Candidate failed target model and gate**.

## Observation

- R80 Alpha center and plane hashes reproduced exactly for all six R81 inputs.
- All three planned model divergences survived the pre-target Alpha check.
- Every Half target case mismatched every replay model from prefix 1 onward; each prefix had 13 mismatched channels per model.
- Duplicate target renders were exact.
- The workflow gate incorrectly reported pass while allThreeStagesRequired=false.

## Current Best View

R81 cannot select any arithmetic stage. Its replay omitted the pinned loader's SPZ color decoding: COLOR_LUT applies an SH-derived scale, clamping and byte rounding before a normalized attribute is created. Alpha calibration alone is therefore not a sufficient input contract.

R78 remains the narrow current-best observed Half-target result because its color bytes were only 0 and 255, which the locked LUT preserves after clamping.

## Rejected

- Raw color byte division as a general decoded SPZ color model.
- Workflow completion as scientific acceptance.
- Any complement/product/sum conclusion from R81.
- Post-target correction represented as unchanged preregistration.

## Unknown

Exact COLOR_LUT-aware full-frame replay of the preserved R81 cases; stage selection for non-endpoint colors; portability across renderer paths and devices; real assets; performance; visual acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
