# KAOPU Learning Cycle — Gaussian ellipse projection R46

Date: 2026-09-13  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

How do Three.js r186's projected-covariance kernel, eigen extraction and 1024-pixel cap expose or hide the SPZ full-covariance loss established in R44?

## Observation roots

### O-R46-SPZ — fixed Niantic codec lineage

The fixed Niantic source supplies the same scale and smallest-three rotation quantizers used in R44. This is inherited software evidence, not a new independent root.

### O-R46-THREE-R186 — fixed viewer projection lineage

At Three.js commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, `GaussianSplat.js` computes `J C J^T`, adds a `0.3` screen kernel, extracts eigenvalues using a radius expression floored at `1e-7`, and caps each scale at `1024`. This viewer source remains distinct from the codec source but is not physical validation.

## Executed evidence

The C++ probe replayed those equations for a 390x844, 60-degree vertical-FOV identity-view camera after source-faithful scale/quaternion quantization. One million deterministic off-axis cases were executed. `-O0` and `-O2` outputs were byte-identical with SHA-256 `8b2dbdf2d612aa3b2be1c46d69f43f1ea6634c39de3f4bca7958b5af95166a57`.

Stress-fixture maxima:

- projected 2D covariance relative spectral error: `0.178400714`;
- raw major shader-scale relative error: `0.084801311`;
- raw minor shader-scale relative error: `0.275374390`;
- principal-axis error: `40.621206°` among 945,395 samples where source and decoded anisotropy were at least 1.1 and neither was capped;
- 50,301 samples encountered a display cap.

These maxima depend on the selected depth, off-axis and log-scale distributions. They are not codec-wide or visual-acceptance bounds.

## Counterexamples and correction

A cap fixture changed raw major scale from `1499.6867` to `1453.6189 px`, a `46.0678 px` difference, yet both displayed scales were exactly `1024 px`. Therefore equal displayed size does not prove covariance fidelity.

A tiny source base scale of `0.00341946 px` became `0.54802182 px` after the r186 kernel; the decoded result was `0.54802120 px`. Their near equality is kernel dominance, not source equivalence.

The source sets `radius=sqrt(max(discriminant,1e-7))` and later tests `radius>1e-5`. Since the minimum radius is `0.000316228`, that fallback is unreachable for finite values. Exact circular-axis behavior must not be inferred from the initialized fallback axis without backend execution.

## Transferable method

For every accepted camera, preserve the float and decoded projected covariance. Compare raw eigen-scales before the 1024 cap and displayed scales after it; count capped and kernel-dominated splats. Use angle only above an explicit anisotropy threshold. Reject any handoff that passes solely because viewer floors or caps hide the difference. Then compare composited pixels and target devices separately.

## Status ledger

- Observation: fixed Niantic codec and Three r186 ellipse implementation.
- Candidate: deterministic projection stress fixture and ellipse gate.
- Current Best View: viewer kernel/cap can mask source covariance loss; raw and displayed quantities must coexist.
- Frozen: KAOPU R1 and user-approved freezes unchanged.
- Rejected: equal displayed axes imply covariance equality; subpixel source footprints survive viewer policy unchanged; principal-axis angle is always meaningful; the initialized angle fallback is reachable under the fixed finite-input equations.
- Unknown: real asset distributions, exact isotropic backend behavior, composited pixels, GPU/browser/device and human acceptance.

## Routing

Prepared only. R45 Mother feedback remains empty and no acknowledged adoption was observed. First-tier expert AI was not called; no expert or Mother meeting was duplicated.
