# KAOPU Learning Cycle — Gaussian full-covariance quantization R44

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

When SPZ v4 quantizes both log-scale and rotation, how large can the resulting full 3D covariance change be before renderer, sorting and pixel effects?

## Observation root

### O-R44-SPZ — fixed Niantic SPZ implementation lineage

At Niantic SPZ commit `affd0ecea7fbb4c265ee119475af7ee5b2997482`, `load-spz.cc` encodes log-scale as `round((s+10)*16)` clamped to one byte and decodes it as `byte/16-10`. The same source uses the R43 smallest-three quaternion codec.

O-R44-SPZ is the same software evidence lineage as O-R43-SPZ, extended to scale packing. It is not an independent physical Observation Root. The deterministic samples, matrix calculation and inequalities are derived checks.

## Derivation

For source log-scale `s` and decoded `s'`, ideal arithmetic inside the non-saturating range gives `|s'-s|<=1/32`.

- semiaxis `exp(s)`: relative upper envelope `exp(1/32)-1 = 0.0317434075`;
- covariance eigenvalue `exp(2s)`: relative upper envelope `exp(1/16)-1 = 0.0644944589`.

The source-faithful float sweep observed log-scale error `0.0312504768`, slightly above the ideal half-step. R44 therefore records an explicit implementation log-scale envelope of `0.031251`, giving `0.0317444392` semiaxis and `0.0644965879` covariance-eigenvalue envelopes.

For `C=RDR^T` and decoded `C'=R'D'R'^T`, split the error into scale and rotation terms. Adding the R43 conservative rotation term `0.0096070263 ||D||_2` yields an implementation triangle bound of `0.0741036142 ||D||_2`.

This assumes finite normalized source quaternions and all log-scales in `[-10,5.9375]`. It excludes saturation, malformed input, projection and compositing.

## Executed evidence

The C++ probe reproduces the fixed source's float scale packing and smallest-three rotation packing. It evaluated 1,000,000 deterministic uniformly distributed rotations and log-scales across the declared range. `-O0` and `-O2` JSON were byte-identical with SHA-256 `aa48105e1da9495c98d9840ca7e62da5629b770d5af7d2a6d05d1230a33b4997`.

Observed maxima:

- log-scale absolute error: `0.0312504768`;
- semiaxis relative error: `0.0317438995`;
- covariance-eigenvalue relative error: `0.0644954741`;
- scale-only relative spectral covariance error: `0.0644954727`;
- rotation-only relative spectral covariance error: `0.0034803805`;
- combined relative spectral covariance error: `0.0645739738`.

The inherited saturation negative control again decoded `-11 -> -10` and `6 -> 5.9375`; this confirms R34's boundary and is not counted as a new independent finding. Four adapter smoke checks passed: valid case, asset-tolerance failure, scale-saturation rejection and non-unit-quaternion rejection.

## Transferable method

Preflight log-scales and quaternions before encoding. Preserve float covariance. After decoding, measure the spectral error of the complete covariance rather than accepting separate angle/scale summaries. Require an asset-specific parameter tolerance that is no looser than the codec regression envelope, then separately evaluate projected pixels, target devices and human acceptance.

## Status ledger

- Observation: fixed Niantic scale and quaternion codec source.
- Candidate: float-aware scale envelope, combined covariance bound, executable probe and gate.
- Current Best View: scale quantization can dominate rotation; full covariance is the correct handoff quantity.
- Frozen: KAOPU R1 and user-approved freezes unchanged.
- Rejected: a 1/16 log-scale step means 1/16 linear error; sub-degree rotation alone proves shape fidelity; in-range quantization is lossless; the 7.410361% codec envelope is a visual acceptance threshold.
- Unknown: real learned scale/orientation/anisotropy distributions, projected/pixel error, browser/GPU, iPhone/Safari and human acceptance.

## Routing

Prepared only. R43 Mother feedback remains empty and no acknowledged adoption was observed. First-tier expert AI was not called; no expert or Mother meeting was duplicated.
