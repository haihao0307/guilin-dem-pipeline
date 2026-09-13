# R63 bounded learning cycle — mixed color requires per-channel ordered precision evidence

## Question

Can a per-channel signed propagated rounding-residual trace explain mixed-color Half divergence that an identical alpha-only trace cannot?

## Why this question

R62 confirmed that the Half-ULP condition identifies individual alpha stalls, but rejected total stall count as a final-error predictor. The 2026-09-14 Mother coordination record retained the next bounded gap: keep the exact alpha order fixed, introduce deterministic mixed color, and test whether an ordered per-channel residual decomposition explains the resulting RGB divergence.

## Locked method

- `three@0.186.0`, tag commit `148ef33ecb6d2502ff796d4554abd1549c95d519`; actual `SPZLoader -> GaussianSplat -> NormalBlending` through Chromium/SwiftShader software WebGL.
- Every case uses the identical R61/R62 seeded alpha sequence: 1,779 byte-1, 114 byte-2 and 48 byte-8 splats. Its geometry, scale, rotation, view, kernel, output, verified identity draw order and color multiset are fixed.
- The color multiset contains exactly 647 red, 647 green and 647 blue splats. Only color assignment changes: blocked, RGB-cycled, or deterministic xorshift32 shuffle.
- For each RGBA channel, replay `u_i = source_i * alpha_i + H_(i-1) * (1-alpha_i)`, round `u_i` to nearest-even Half, and retain signed local residual `r_i = H_i-u_i`.
- Propagate the residual state with `E_i = E_(i-1)*(1-alpha_i)+r_i`. This tests the identity `H_n - Ideal_n = E_n`; it is a diagnostic replay, not an independent physical model.
- Successful workflow run `34778643346`; artifact `10324565291`, digest `0d25894cd67a8b720e84099514a676370e059619b7d36535aeb124a81964c276`.

## Observations

1. All three color cases passed fixed source, loader, `GaussianSplat`, NormalBlending, initialized identity order and finite-readback checks. Half replay matched all twelve center RGBA channels exactly.
2. The propagated signed-residual identity matched Half-minus-ideal within `4.27e-16` or better. Paired Float replay stayed within `2.38419e-7` of observed Float channels.
3. Alpha evidence was exactly identical across the three cases: same alpha sequence, same `1,228` Half alpha stalls, same Half alpha endpoint `0.97900390625`, and the same alpha propagated residual.
4. Despite that identical alpha trace and identical RGB color multiset, maximum internal RGB Half/Float error changed:
   - blocked: `0.0036246777`;
   - cycled: `0.0063344836`;
   - seeded: `0.0028208792`.
   The spread is `0.0035136044`.
5. Final screenshot Half/Float differences reached 5 codes for blocked and 6 codes for cycled/seeded. These are fixture observations, not visual thresholds.
6. The full per-channel trace has distinct hashes for all three assignments and explains the signed endpoint error. It has not been compressed into a validated scalar risk score.

## Status ledger

- **Observation:** actual fixed r186 mixed-color rendering produced the values above, while the ordered nearest-even Half replay was bit-exact at the center.
- **Observation:** the signed propagated local residual exactly decomposed Half-minus-ideal for every channel in the three locked cases.
- **Rejected:** an identical alpha sequence, alpha precision trace and unordered RGB color multiset are sufficient to predict RGB precision.
- **Candidate / Current Best View:** retain actual draw order and per-channel state/residual evidence when diagnosing finite-precision color accumulation. Alpha-only aggregates remain screening data.
- **Unknown:** whether a compact summary can replace the full trace; behavior across off-center Gaussian footprints, cutoff boundaries, SH colors, WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance, energy and human acceptance.
- **Frozen:** Canonical Truth, source observations, uncompressed reconstruction checkpoints, Object DNA responsibilities, user freezes and formal R1 remain unchanged.

## Transferable method

- Hold both opacity order and the unordered color population fixed, then permute only the color-to-write assignment to isolate channel-state dependence.
- Decompose recurrence error with signed residuals and later-transmittance propagation; unsigned totals discard cancellation and timing.
- Verify the replay against actual render-target bits before using it diagnostically.
- Treat an exact replay/decomposition as an explanation tool, not a cheap predictor or independent observation root.
- Keep internal linear errors, final presentation codes, device evidence and human acceptance separate.

## Routing and next gap

Three.js Delivery Mothers should retain ordered per-channel evidence for any Half/Float diagnosis and must not certify RGB precision from alpha-only tau, `sum(alpha^2)`, stall count or alpha trace. Photo Reconstruction Mother should preserve color/SH assignment together with the actual per-view sorted order; R63 does not establish physical relighting or asset acceptance.

Next bounded question: does the same decomposition remain exact across off-center pixels where the r186 Gaussian footprint changes effective alpha and approaches the hard cutoff? Lock source, camera, covariance and order; compare full-pixel Half/Float readback with per-pixel replay before proposing any compact gate.

Routing is prepared only; no Mother acknowledgment or adoption is claimed. Production Mother branches were not modified. First-tier expert AI was not called in this learning cycle.

