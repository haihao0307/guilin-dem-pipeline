# Learning Log R83 — Decoded-color viability audit of the unchanged R81 cases

Status: **Candidate negative control**. Date: 2026-09-15.

## Question

After applying the frozen Three.js r186 `COLOR_LUT`, do the unchanged R81 raw-SPZ-byte cases remain isolated Half-boundary discriminators for complement, product and sum staging?

## Locked method

- The six R81 records, channel assignments and case names were kept byte-for-byte unchanged.
- The R80 center-Alpha table hash was locked to `19fc9645e760d2fe3fc363985d9c52f07166979abbf5a3e3276ee16f41c7eab8`.
- The R82 decoded-color table hash was locked to `0463086b181acd9d7991acb07c693b8d1179aba5f65b58d155bbdca5108802f1`.
- All six required R80 Float Alpha planes had to reproduce both their center values and complete-plane hashes.
- The R82 table was applied before evaluating `staged`, `no_comp`, `no_prod` and `no_sum` over the complete 33×33 plane.
- The preregistered answer was `no-none`: all three declared center discriminators were expected to collapse. No Half target or prefix readback was permitted.

## Observation

- All six R80 Alpha planes reproduced exactly, including their complete-plane hashes.
- The unchanged complement case decoded `248→255` and `1→0`; all four models produced center value `0.03125`.
- The unchanged product case decoded `8→0` and `248→255`; all four models produced `0.2000732421875`.
- The unchanged sum case decoded `224→255` and `192→249`; all four models produced `0.19189453125`.
- For every declared and alternate ablation, the full-plane mismatch count against `staged` was zero. No case remained isolated or otherwise discriminative.
- All nine semantic gates passed in workflow run `34965392980`. The gate also confirmed that no Half target was rendered.

## Observation Roots

1. **R80 runtime root:** repeated Float Alpha calibration on the same Chromium/ANGLE SwiftShader lineage.
2. **R82 parser root:** pinned official source plus byte-identical parser execution; these remain one source lineage, not independent algorithms.
3. **R83 derivation root:** deterministic application of the frozen R82 table to unchanged R81 records, followed by four-model CPU replay.

These roots must remain separate. R83 adds a decoded-domain counterexample to the R81 test design; it does not add an independent renderer or device root.

## Current Best View delta

The unchanged R81 cases are invalid stage-selection targets once the actual r186 parser contract is honored. Correcting input semantics removes the predicted distinction before target rendering, so further Half rendering of those cases would be non-informative.

R81 remains a semantic failure rather than a reparable stage result. R78 remains the narrow current-best Half-target observation because its endpoint colors survive the decode mapping and its fixed SwiftShader target selected `f32-staged` by one Half ULP.

## Rejected

1. Repair R81 by silently treating encoded SPZ bytes as display RGB.
2. Render the unchanged R81 Half targets after their discriminators have collapsed.
3. Rename a newly searched raw-byte matrix as an unchanged R81 replay.
4. Treat the R83 derivation as evidence of hidden blend instructions or cross-backend behavior.

## Unknown and boundaries

- Whether a newly derived raw-SPZ-byte matrix can isolate all three stages after R82 decode remains Unknown.
- Half target behavior for such a new matrix remains Unknown.
- Hidden fixed-function blend instructions, hardware GPU, WebGPU, Safari/iPhone, real assets, performance and human acceptance remain Unknown.
- Mother feedback and adoption are unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

Search the finite decoded domain for a new raw-SPZ-byte matrix whose complement, product and sum ablations remain isolated after decode. Freeze the generated records under a new identifier and require decoded-color identity plus prefix-1 Half agreement before any prefix-2 stage selection. Do not reuse the R81 identity.
