# Current Best View R84 — A new decoded-aware stage matrix is viable for target testing

Status: **Candidate partial; target unrendered**.

## Observation

- A fixed-seed, non-exhaustive CPU search reproduced the R83 negative control and found one isolated Half-boundary discriminator for each complement, product and sum ablation.
- Frozen first-hit samples were 3,460, 50,805 and 443,253; replay stopped after 443,254 samples.
- All eight semantic gates passed, but no Half target or prefix readback was executed.

## Current Best View

R81 remains invalid because its encoded colors collapse after correct decode. The new identity `KAOPU-GAUSSIAN-R84-DECODED-STAGE-MATRIX-A` restores a semantically valid test design without rewriting R81 history.

The matrix is only a `Candidate-unrendered-target`. CPU discrimination shows that a target test can be informative; it does not establish which arithmetic staging the renderer uses. R78 remains the narrow Half-target current best on fixed Three.js r186 Chromium/ANGLE SwiftShader.

## Rejected

- Calling the bounded LCG search exhaustive.
- Calling replay of post-exploration frozen hits independent discovery.
- Treating the new matrix as R81 repaired.
- Promoting CPU predictions to renderer or cross-device rules.

## Unknown

Prefix-1 and prefix-2 Half target results; hidden blend instructions; hardware GPU, WebGPU, Safari/iPhone and real-asset behavior; human acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
