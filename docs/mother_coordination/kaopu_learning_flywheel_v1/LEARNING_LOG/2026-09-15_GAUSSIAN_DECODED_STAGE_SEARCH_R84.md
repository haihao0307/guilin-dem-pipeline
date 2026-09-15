# Learning Log R84 — Decoded-aware three-stage candidate search

Status: **Candidate partial; target unrendered**. Date: 2026-09-15.

## Question

Can a newly identified raw-SPZ-byte matrix isolate complement, product and sum staging after the frozen Three.js r186 color decode?

## Locked method

- R80 center Alpha and R82 decoded-color tables were required to match their frozen hashes.
- The Half conversion was ported from the pinned Three.js r186 `DataUtils.js` blob `44e34e8d912528aa9f7219390e9ba82b6c9609c6`; the same nearest-even wrapper used in R78–R83 was retained.
- A fixed-seed LCG sampled at most 1,000,000 four-byte tuples `(alpha1, rawColor1, alpha2, rawColor2)`.
- A hit required exactly one declared ablation to differ from `staged`, with the other two ablations equal to `staged` after Half storage.
- The local candidate-discovery run preceded the GitHub freeze. The committed CI therefore replays frozen first hits as reproducibility evidence; it is not a prospective or independent discovery.
- The search was bounded and pseudorandom, not exhaustive. No Half target was rendered.

## Observation

- The fixed replay reproduced R83's collapse of all three unchanged R81 cases.
- All three decoded-aware scalar discriminators were found within 443,254 samples:
  - **Sum:** sample 3,460; `(alpha=140, raw=143→decoded=157)` then `(alpha=40, raw=67→decoded=14)`. `staged/no_comp/no_prod=0.134765625`, `no_sum=0.1346435546875`.
  - **Product:** sample 50,805; `(84, 127→127)` then `(119, 164→196)`. `staged/no_comp/no_sum=0.2037353515625`, `no_prod=0.20361328125`.
  - **Complement:** sample 443,253; `(207, 225→255)` then `(144, 186→238)`. `staged/no_prod/no_sum=0.476318359375`, `no_comp=0.4765625`.
- The new frozen identity is `KAOPU-GAUSSIAN-R84-DECODED-STAGE-MATRIX-A`; it does not reuse or repair R81.
- All eight semantic gates passed in workflow run `34977185867`; the artifact digest was `fb0915a043ed91060adba86fffbee756a848685f8184e9e2f5d81a737a06fb6d`.

## Observation Roots

1. **R80 runtime root:** inherited Float calibration on Chromium/ANGLE SwiftShader.
2. **R82 parser root:** inherited pinned parser table; official source and byte-identical execution remain one source lineage.
3. **R84 search root:** deterministic CPU candidate generation and exact replay.

The CI replay repeats root 3; it does not create an independent algorithm or target-renderer root.

## Current Best View delta

Correct decode does not make the arithmetic stages intrinsically indistinguishable. It invalidated the old R81 inputs, while a separately identified decoded-aware matrix can still place each ablation on the opposite side of a Half boundary in the CPU model.

This only restores a valid target design. It does not select the renderer's staging. R78 remains the narrow current-best Half-target observation until the new matrix passes separately preregistered prefix readbacks.

## Rejected

1. Reuse or retroactively repair the R81 identity.
2. Describe 443,254 fixed-seed samples as an exhaustive search of the input domain.
3. Treat CI replay of the frozen exploratory hits as independent discovery.
4. Promote CPU model discrimination to renderer-stage, cross-backend or physical-appearance evidence.

## Unknown and boundaries

- Prefix-1 and prefix-2 Half target results for the new matrix remain Unknown.
- The candidate's behavior away from the calibrated center pixel remains outside this target definition.
- Hidden blend instructions, hardware GPU, WebGPU, Safari/iPhone, real assets, performance and human acceptance remain Unknown.
- Mother feedback and adoption are unacknowledged. Production branches, Canonical Truth and Frozen R1 remain unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

Separately preregister `KAOPU-GAUSSIAN-R84-DECODED-STAGE-MATRIX-A` as a target fixture. Require exact raw-to-decoded color identity and exact prefix-1 Half agreement for each case before reading prefix 2. At prefix 2, compare the observed center channel against all four frozen predictions and retain cross-backend claims as Unknown.
