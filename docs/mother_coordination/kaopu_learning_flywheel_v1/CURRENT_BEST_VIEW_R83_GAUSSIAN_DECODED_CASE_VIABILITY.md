# Current Best View R83 — The unchanged R81 stage matrix collapses after correct decode

Status: **Candidate partial; negative control observed**.

## Observation

- All six frozen R80 Float Alpha planes reproduced exactly.
- Applying the frozen R82 color table to the unchanged R81 records made all four replay models identical for all three cases over the complete plane.
- Center results were `0.03125`, `0.2000732421875` and `0.19189453125`; every declared full-plane mismatch count was zero.
- No Half target or prefix readback was executed.

## Current Best View

R81 cannot select complement, product or sum staging under the correct Three.js r186 SPZ decode contract. This is a test-design failure exposed before target execution, not a renderer failure and not evidence that the arithmetic models are generally equivalent.

R78 remains the narrow Half-target best view: its endpoint-color counterexample selected `f32-staged` on fixed Three.js r186 Chromium/ANGLE SwiftShader. It is not promoted beyond that evidence root.

Any successor stage matrix must be generated in the decoded domain, frozen under a new identity, and then checked against Half prefix readbacks. SPZ remains a delivery candidate, not lossless Canonical Truth.

## Rejected

- Reinterpreting R81 with direct raw-byte colors.
- Spending target-runtime evidence on a preregistered discriminator that has already collapsed.
- Calling a changed byte matrix an unchanged R81 replay.
- Inferring hidden blend instructions or cross-backend rules from CPU replay.

## Unknown

A viable new decoded-aware three-stage matrix; its Half target result; hardware GPU, WebGPU, Safari/iPhone and real-asset behavior; human acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
