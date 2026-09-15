# Learning Log R82 — Freeze the complete Three.js r186 SPZ color decode contract

Status: **Candidate partial**. Date: 2026-09-15.

## Question

Does the pinned Three.js r186 parser produce the complete COLOR_LUT contract predicted by its official source for all 256 SPZ color bytes?

## Locked method

- Three.js was pinned to package 0.186.0 and tag commit 148ef33ecb6d2502ff796d4554abd1549c95d519.
- Before parsing, the installed SPZLoader.js and GaussianSplatUtils.js were required to match official Git blobs 456aa33e7c6e10bec74b34a5413606bb45bb0c16 and 9d4752a92b01ce2aa936253e03f3315c8d154a48.
- A one-record SPZ v3 payload was parsed for every source byte from 0 through 255, using the same byte in R, G and B and Alpha byte 255.
- The underlying color attribute bytes and normalized BufferAttribute getters were recorded.
- The formula, complete table hash, unique-output count, saturation boundaries and plateau counts were declared before execution at a8adb89292cd4fbef7a4621c5532986da3303e87.
- No Gaussian render, GPU, Half target or corrected R81 replay was allowed.

## Observation

- Both installed source files matched their official Git blobs exactly.
- All 256 parser outputs matched the official COLOR_LUT formula exactly in all three color channels. Alpha byte 255 was preserved.
- The underlying attribute was Uint8ClampedArray, item size 4, with normalized=true; all normalized getters exactly equaled decodedByte/255.
- The frozen one-byte-per-input table has SHA-256 0463086b181acd9d7991acb07c693b8d1179aba5f65b58d155bbdca5108802f1.
- Only 138 distinct decoded byte values remain. Source bytes 0–59 all decode to 0; source bytes 196–255 all decode to 255.
- Across adjacent source bytes there are 137 strict increases and 118 plateaus. Representative mappings include 60→1, 120→113, 123→119, 128→128, 192→249 and 195→254.
- All ten semantic gates passed in workflow run 34954330300.

## Observation Roots

1. **Official-source root:** the pinned Three.js files define SH_C0, COLOR_LUT, Uint8Clamped storage and a normalized color attribute.
2. **Executable-parser root:** Node.js executed the byte-identical npm package across all 256 values.

The second root is reproducibility evidence from the same source lineage, not an algorithmically independent implementation.

## Current Best View delta

R81's failure is now bounded precisely: raw SPZ color bytes are encoded coefficients, not direct normalized display colors. Alpha-only calibration cannot authorize bit-exact replay when non-endpoint colors are used.

The R82 table is a frozen parser-input contract for a later replay. It is not yet evidence of shader-stage color, blending arithmetic or final appearance. R78 remains the narrow current-best Half-target observation because its input colors were endpoints 0 and 255, preserved by the table.

For photo reconstruction routing, SPZ color bytes must not be treated as lossless Canonical Truth. This parser path collapses multiple source codes through clamping and rounding; retain uncompressed reconstruction checkpoints for error comparison.

## Rejected

1. Raw SPZ color byte divided by 255 is the general decoded attribute value.
2. This r186 path preserves 256 distinct color output levels.
3. Parser agreement proves final rendered color or physical relighting.
4. The R82 table retroactively validates R81's arithmetic-stage predictions.

## Unknown and boundaries

- COLOR_LUT-aware replay of the unchanged R81 targets remains Unknown.
- Shader transforms after the normalized attribute, blend stages and final appearance remain Unknown.
- Hardware GPU, WebGPU, Safari/iPhone, real assets, performance and human acceptance remain Unknown.
- Mother feedback and adoption are unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

In a separate preregistration, replay the unchanged R81 cases using the frozen R82 decoded bytes. Require exact decoded-color identity, R80 Alpha-plane identity, exact prefix-1 replay and a corrected semantic gate before reading prefix 2. Do not change the target cases after observation.
