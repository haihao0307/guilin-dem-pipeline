# Current Best View R82 — SPZ bytes are encoded coefficients, not direct display colors

Status: **Candidate partial**.

## Observation

- The installed Three.js 0.186.0 parser sources were byte-identical to the pinned official Git blobs.
- Every source byte 0–255 matched the declared COLOR_LUT formula at both underlying byte and normalized attribute levels.
- The table hash is 0463086b181acd9d7991acb07c693b8d1179aba5f65b58d155bbdca5108802f1.
- Only 138 distinct decoded values remain: 0–59 saturate to 0 and 196–255 saturate to 255.
- No renderer or Half target was executed.

## Current Best View

Any bit-exact Three.js r186 SPZ replay must bind decoded attributes rather than raw file bytes. The R82 table is now a frozen parser contract, but renderer source color and blend behavior remain separate gates.

R81 remains a failed replay and cannot select arithmetic stages. R78 remains the narrow endpoint-color current best because the decoder preserves 0 and 255.

SPZ remains a delivery candidate, not lossless Canonical Truth; preserve uncompressed reconstruction checkpoints for comparison.

## Rejected

- Direct byte/255 color replay.
- A 256-level decoded color claim for this path.
- Promotion from parser correctness to renderer or visual correctness.
- Retroactive repair of R81.

## Unknown

Corrected replay of unchanged R81 targets; shader-stage color transforms; blend staging; cross-backend and target-device behavior; real-asset error; visual acceptance; and Mother adoption.

Canonical Truth, production Mothers and Frozen R1 remain unchanged.
