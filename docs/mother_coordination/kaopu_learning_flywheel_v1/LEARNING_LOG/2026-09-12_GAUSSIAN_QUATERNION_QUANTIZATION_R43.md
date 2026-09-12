# KAOPU Learning Cycle — Gaussian quaternion quantization R43

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

How much orientation and covariance error can SPZ v3/v4's smallest-three quaternion encoding introduce before any renderer, sorting or pixel effects?

## Observation root

### O-R43-SPZ — fixed Niantic SPZ implementation

At Niantic SPZ commit `affd0ecea7fbb4c265ee119475af7ee5b2997482`, the encoder normalizes the quaternion, identifies the largest absolute component, makes it positive through q/-q equivalence, and stores the other three components as one sign bit plus a 9-bit magnitude over `[0, 1/sqrt(2)]`. The decoder reconstructs the omitted component from unit length.

The deterministic sample set and mathematical derivation are derived checks, not independent physical Observation Roots.

## Derived bounds

The stored-component half-step is `(1/sqrt(2))/(2*511) = 0.000691885292646703`. A unit quaternion's omitted largest component is at least 0.5. Bounding the three stored errors and reconstructed component gives a conservative real-arithmetic rotation bound of `0.00480351777395118 rad = 0.275221295263479 degrees`.

This assumes a finite, nonzero quaternion that can be normalized. It does not accept malformed inputs or claim a formal float proof for every platform.

For covariance `C=RDR^T`, `||C-C'||_2 <= 2||R-R'||_2||D||_2` and `||R-R'||_2=2sin(theta/2)` give a conservative rotation-only perturbation bound of `0.0096070263` times the largest covariance eigenvalue.

## Executed evidence

The source-faithful C++ probe evaluated 1,000,000 deterministic uniformly distributed rotations. `-O0` and `-O2` builds produced byte-identical JSON.

- maximum rotation error: `0.2477113651 degrees`;
- RMS rotation error: `0.0861049496 degrees`;
- maximum major-axis error: `0.2050537181 degrees`;
- decoded unit-norm maximum residual: `6.1783e-8`;
- maximum relative covariance Frobenius error:
  - eigenvalues `[1,1,1]`: `9.7708e-7`;
  - `[1,0.25,0.0625]`: `0.004185433`;
  - `[1,0.01,0.0001]`: `0.005046534`.

The isotropic residual comes from finite-precision normalization/matrix arithmetic; orientation does not physically change an exactly isotropic covariance. The anisotropic fixtures show why a small quaternion angle still requires full covariance and image checks.

## Transferable method

For each real checkpoint: reject non-finite/non-normalized source quaternions; preserve float covariance; record anisotropy and log-scales; compare decoded angle and full covariance; compare fixed-camera float-reference and delivery images; keep parameter, pixel, device and human thresholds separate.

## Status ledger

- Observation: fixed Niantic codec source and declared smallest-three contract.
- Candidate: derived bounds, executable regression and asset gate.
- Current Best View: rotation is bounded but lossy; sub-degree error does not prove visual equivalence for elongated splats.
- Frozen: KAOPU R1 and user-approved freezes unchanged.
- Rejected: SPZ rotation is lossless; loading proves covariance equality; the README's minimal-visual-difference description is universal acceptance; isotropic and anisotropic splats have equal sensitivity.
- Unknown: real learned orientation/anisotropy, combined scale-plus-rotation error, projected/pixel error, browser/GPU, iPhone/Safari and human acceptance.

## Routing

Prepared only. R42 Mother feedback remains empty and no acknowledged adoption was observed.

The completed SL003 expert record was inherited but concerns material-state routing, not this codec question, and is not reused as Gaussian evidence. First-tier expert AI was not called in this cycle; no routine expert meeting was duplicated.
