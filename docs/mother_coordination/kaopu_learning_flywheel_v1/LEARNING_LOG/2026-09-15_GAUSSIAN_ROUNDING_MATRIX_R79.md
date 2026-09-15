# Learning Log R79 — Actual calibration rejects one member of the staged-rounding matrix before target rendering

Status: **Candidate failed preregistration**. Date: 2026-09-15.

## Question

Can three preregistered Three.js r186 Half-boundary fixtures separately test Float32 rounding of the complement, products and sum?

## Locked method

- Three.js remained pinned to `0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, with official `GaussianSplat.js` blob `06d37fe6af583cf8cbdf8bd93565403bc3b94691`.
- A CPU search using the R78 center Alpha ratio selected three fixed two-record cases before execution. Red targeted removal of complement rounding, green targeted removal of product rounding, and blue targeted removal of sum rounding.
- The executable gate first rendered independent Float Alpha calibrations for all six source Alpha bytes. No Half target was allowed unless every case then differed from fully staged replay only for its declared ablation at its declared center channel.
- The matrix was committed before execution at `f342202517e8ddf4fedd0461f229bed7470d4f99`.

## Observation

- The product-ablation case remained isolated after actual calibration: `staged=0.1951904296875`, `no_prod=0.195068359375`, a one-Half-ULP difference at center green. The other ablations coincided with staged.
- The sum-ablation case also remained isolated: `staged=0.148193359375`, `no_sum=0.1480712890625`, a one-Half-ULP difference at center blue. The other ablations coincided with staged.
- The complement-ablation case collapsed completely: all four predictions became `0.0239105224609375`; its declared divergence count was zero.
- Because one of three preregistered cases failed, the gate aborted before rendering any Half target. Workflow run `34926199976` failed at the pre-target isolation step; no result artifact was uploaded.

## Candidate / Current Best View delta

R78 remains the current best observed renderer result. R79 adds no target evidence and does not independently establish any of the three stages.

The transferable correction is methodological: an approximate Alpha ratio is too fragile for selecting a fixture exactly on a Half boundary. Input calibration may be gathered independently of target output; therefore a calibration-only checkpoint should be locked first, and the counterexample matrix should be derived and preregistered from that checkpoint in a later commit before any Half target is observed.

The product and sum pairs remain **Candidate fixtures**, not validated renderer conclusions. The complement pair is **Rejected as a discriminating fixture** under the actual calibration.

## Rejected

1. Replace the collapsed complement pair after seeing the gate result and still call the same R79 matrix preregistered.
2. Render only the two surviving target cases despite the locked all-three acceptance rule.
3. Treat predicted product/sum separation as renderer evidence without target readback.
4. Infer staged fixed-function instructions from R78 plus two unrendered predictions.

## Unknown and boundaries

- Half target behavior for all three R79 cases is Unknown because none was rendered.
- A valid complement-rounding discriminator remains Unknown.
- Product and sum stage selection remains Unknown despite their successful prediction isolation.
- The calibration belongs to the same Chromium/ANGLE Vulkan SwiftShader observation root as R59-R78.
- Hardware GPU, WebGPU, Safari/iPhone, real assets, performance and human acceptance remain Unknown.
- Mother adoption is unacknowledged. Production branches, Canonical Truth and Frozen R1 are unchanged.
- First-tier expert AI was not called; this was bounded executable verification, not the separate expert meeting.

## Next gap

Run a calibration-only cycle that records the exact center Alpha values for a declared byte set without any Half target. From that frozen observation, derive a fresh complement discriminator and re-preregister the three-case target matrix. Preserve R79's failed fixture and workflow receipt rather than overwriting them.
