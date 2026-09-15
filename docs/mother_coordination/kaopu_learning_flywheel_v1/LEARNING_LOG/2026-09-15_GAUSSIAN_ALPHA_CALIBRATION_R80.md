# Learning Log R80 — Freeze complete effective-Alpha calibration before target selection

Status: **Candidate partial**. Date: 2026-09-15.

## Question

Can a calibration-only Three.js r186 cycle freeze the complete center effective-Alpha table before any new Half target fixture is selected?

## Locked method

- Three.js remained pinned to `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, and official `GaussianSplat.js` blob `06d37fe6af583cf8cbdf8bd93565403bc3b94691`.
- The fixed 45-degree anisotropic footprint, camera, 33-by-33 viewport and one-record render were retained. Source Alpha byte was the only primary variable: every integer from 0 through 255 exactly once, in ascending order.
- Every primary render used `FloatType`. The committed workflow prohibited `HalfFloatType` and any two-record target.
- Only after the full table was recorded did the script search it for the lexicographically first isolated complement-rounding candidate. Endpoint bytes and candidate Alpha bytes were then independently rerendered as full frames.
- The calibration design and prohibitions were committed before execution at `8372ea47cdbc7d77030c591cdce73163f94d1605`.

## Observation

- All 256 source Alpha bytes produced a complete center table with SHA-256 `19fc9645e760d2fe3fc363985d9c52f07166979abbf5a3e3276ee16f41c7eab8`.
- Byte 0 produced center Alpha `0`; byte 1 was the minimum positive value, `0.0016267604660242796`; byte 255 produced the maximum, `0.41482388973236084`.
- The 256 observed center values were strictly increasing.
- Independent full-frame Float rerenders for bytes `0`, `255`, `21` and `52` matched their primary frames exactly in all channels.
- Workflow run `34934243478` passed every declared gate. Its artifact `10382272954` has SHA-256 `a4091fa57c1ca33a792301eb335d0eda81a333810db3b05cdd276851315a94cb`.

These observations belong to the same Chromium 143 / ANGLE Vulkan SwiftShader software root as R59-R79. Repetition within that root is reproducibility evidence, not an independent renderer root.

## Candidate derived after observation

Searching only the frozen table and the declared color-byte subset found an isolated complement candidate:

- record 1: Alpha byte `21`, red byte `248`;
- record 2: Alpha byte `52`, red byte `1`;
- observed center Alphas: `0.034161970019340515` and `0.08459154516458511`;
- fully staged predicted Half: `0.0307464599609375`;
- complement-not-rounded predicted Half: `0.03076171875`;
- product and sum ablations coincide with fully staged at the Half output.

This pair is **Candidate-unrendered-target**. No two-record Float or Half target was rendered in R80, so the pair is not renderer-stage evidence.

## Current Best View delta

R80 repairs R79's fixture-selection method by separating input calibration from target observation. The complete table is now a frozen observation for this exact footprint and software path; new target cases can be preregistered from it without inspecting their outputs.

R78 remains the current best observed Half-target evidence. R80 neither strengthens nor overturns its narrow `f32-staged` input/output-equivalence result.

## Rejected

1. Reuse R79's collapsed complement pair as a discriminator under the actual calibration.
2. Treat monotonic center Alpha as a universal analytic transfer function, spatial-footprint proof or cross-backend contract.
3. Treat the post-calibration pair as preregistered target evidence in R80.
4. Infer fixed-function blend instructions from Float calibration values.

## Unknown and boundaries

- The new pair's Half target, and the product and sum target cases, remain Unknown.
- The table applies only to the fixed 45-degree footprint, camera, center pixel, r186 code and observed software runtime.
- Hardware GPU, WebGPU, Safari/iPhone, other footprints, other pixels, real assets, performance and human acceptance remain Unknown.
- Mother feedback and adoption are unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

In a separate commit, preregister a complete three-case matrix derived only from the frozen R80 table: the new complement case plus the preserved R79 product and sum candidates. Require all three cases to remain isolated before rendering any Half target; preserve failure receipts rather than replacing a case after execution.
