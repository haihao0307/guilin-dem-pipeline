# Learning Log R81 — Frozen Alpha succeeds, but raw SPZ color semantics invalidate the matrix replay

Status: **Candidate failed target model and gate**. Date: 2026-09-15.

## Question

Does a separately preregistered three-case matrix derived from the frozen R80 Alpha table select Float32 complement, product and sum staging on the locked Three.js r186 software route?

## Locked method

- Three.js remained pinned to 0.186.0, tag commit 148ef33ecb6d2502ff796d4554abd1549c95d519.
- R80's complete center table hash 19fc9645e760d2fe3fc363985d9c52f07166979abbf5a3e3276ee16f41c7eab8 was required.
- The new R80 complement candidate and the two surviving R79 product/sum candidates were committed at 078e7ccd37b1c8374a11660662b36589f036cb7d.
- Before target rendering, all six independent Float Alpha planes had to match R80 by center value and full-plane hash, and all three cases had to isolate only their declared ablation.
- The target then used independent Half prefixes 1 and 2 plus a duplicate prefix-2 control.

## Observation

- All six Alpha center values and plane hashes matched R80 exactly.
- All three predicted ablations remained isolated before target rendering.
- Actual target readback matched none of the four replay models. For every case, prefix 1 and prefix 2 each differed in 13 channels from every model; exactBothPrefixes was empty.
- At the declared center channel, observed versus staged-predicted prefix-2 values were:
  - complement: 0.03125 versus 0.0307464599609375;
  - product: 0.2000732421875 versus 0.1951904296875;
  - sum: 0.19189453125 versus 0.148193359375.
- Every independent duplicate prefix-2 control was exact, so the mismatch was reproducible in this software root.

## Gate failure

Workflow run 34943454170 concluded success and its raw gate reported Candidate-pass, even though allThreeStagesRequired=false and every stagedExact=false. The executable gate omitted those semantic acceptance fields from its required checks.

Therefore workflow success is **Rejected as semantic acceptance**. The raw result and raw gate are preserved unchanged; the post-run classification records the discrepancy rather than rewriting history.

## Official-source diagnosis

The locked Three.js r186 SPZLoader.js does not pass a source color byte through as byte/255. It computes a COLOR_LUT using SH_C0/0.15, writes into Uint8ClampedArray, and then creates a normalized color attribute. The locked GaussianSplatUtils.js defines SH_C0=0.2820947917738781.

For the non-endpoint bytes used in R81, that contract maps 1→0, 8→0, 192→249, 224→255, and 248→255. R81's replay instead used raw byte division. This directly explains why the non-binary cases diverged already at prefix 1; a corrected full-frame replay remains a later Candidate, not a post-hoc R81 acceptance.

R78 used only color endpoint bytes 255 and 0, which remain 255 and 0 after the locked clamped LUT. R81 therefore does not overturn R78's narrow observed result.

## Current Best View delta

Alpha-only calibration is insufficient for bit-exact SPZ blend replay. The replay contract must bind the decoded renderer input attributes, including the exact SPZ color LUT and clamped/normalized byte semantics, before arithmetic-stage fixtures are selected.

R81 selects none of the complement, product or sum models. R78 remains the current best Half-target evidence for one endpoint-color counterexample on this Chromium/ANGLE Vulkan SwiftShader root.

## Rejected

1. Raw SPZ color byte divided by 255 is a general shader-source RGB value.
2. A green workflow conclusion proves the scientific acceptance condition.
3. R81 validates complement, product or sum staging.
4. Correct the replay after target observation and call the rerun the same preregistered experiment.

## Unknown and boundaries

- A separately preregistered COLOR_LUT-aware replay of R81 remains Unknown.
- Stage selection for non-endpoint SPZ color bytes remains Unknown.
- Hidden fixed-function instructions, hardware GPU, WebGPU, Safari/iPhone, real assets, performance and human acceptance remain Unknown.
- This is the same software Observation Root as R59-R80.
- Mother feedback and adoption are unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

Freeze the exact decoded color-byte table from the pinned loader and independently verify the used geometry color attributes. In a later preregistration, require both Alpha-plane and decoded-color contracts, require stagedExact and declared-ablation rejection in the semantic gate, and replay the preserved R81 target without changing its cases.
