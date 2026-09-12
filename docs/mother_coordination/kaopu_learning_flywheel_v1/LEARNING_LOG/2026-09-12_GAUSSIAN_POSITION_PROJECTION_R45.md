# KAOPU Learning Cycle — Gaussian position projection R45

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

How does default SPZ position quantization map into Three.js r186 screen-center error, and can the same small parameter error change visibility decisions?

## Observation roots

### O-R45-SPZ — fixed Niantic position codec lineage

At Niantic SPZ commit `affd0ecea7fbb4c265ee119475af7ee5b2997482`, default packing multiplies positions by `2^12`, rounds to signed integers, stores the low 24 bits and decodes with sign extension divided by `2^12`. This is the same software evidence lineage as R34/R44, not a new physical root.

### O-R45-THREE-R186 — fixed viewer projection implementation

At Three.js commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, `GaussianSplat.js` computes pixel focal length from viewport and projection matrix, evaluates the perspective Jacobian at view center, and rejects centers with `viewCenter.z >= -0.01` before drawing. This viewer root is distinct from the codec root, but neither is independent physical validation.

## Executed evidence

A C++ probe reproduced the fixed position pack/unpack arithmetic over 1,000,000 deterministic values and the r186 screen-center equation for an identity model-view fixture. `-O0` and `-O2` outputs were byte-identical with SHA-256 `d6c2ee994708a0fa2c9480de14b2cd3fe664b59e303aa90d641530d2c2b6d6ff`.

- grid step: `0.000244140625` storage units;
- ideal and observed maximum component error: `0.0001220703125`;
- camera: 390x844, vertical FOV 60 degrees, focal length `730.925441 px`;
- near-half-step x/y diagonal center error:
  - depth `0.0100098`: `12.604650 px`;
  - depth `0.1000977`: `1.260465 px`;
  - depth `1`: `0.126170 px`;
  - depth `10`: `0.012617 px`.

At the optical axis, one-axis half-step error is `0.0892243/depth` pixels for this camera. Requiring at most 0.25 pixel on one axis therefore needs depth above `0.356897` storage units under this narrow fixture.

## Counterexample

The source center `z=-0.00999` satisfies r186's hard cull predicate and is rejected. SPZ decoding gives `z=-0.010009765625`, which fails that predicate and passes this particular hard cutoff. Other clip tests may still reject it; the result proves only that the hard-z decision flips. It is enough to reject any claim that a small position half-step alone bounds visibility behavior.

## Transferable method

Record the reversible transform from canonical/world units to SPZ storage units. For each accepted camera/viewport, measure minimum view depth, off-axis ratios and signed distance to every visibility boundary. Convert the storage-space quantization cube through the actual model-view transform, derive a conservative center-pixel bound, and require both an asset pixel tolerance and a boundary margin. Then test projected covariance, compositing and the target device separately.

## Status ledger

- Observation: fixed Niantic position codec and fixed Three r186 projection/cull source.
- Candidate: depth-aware projection fixture and center-pixel/boundary-margin gate.
- Current Best View: position precision is meaningful only with delivery normalization plus camera and visibility context.
- Frozen: KAOPU R1 and user-approved freezes unchanged.
- Rejected: fixed parameter error implies fixed pixel error; `1/4096` is universally invisible; a parameter norm bound prevents cull/clip discontinuities; delivery rescaling may silently replace canonical metric scale.
- Unknown: real asset normalization/cameras, projected covariance footprint, composited pixels, GPU/browser/device and human acceptance.

## Routing

Prepared only. R44 Mother feedback remains empty and no acknowledged adoption was observed. First-tier expert AI was not called; no expert or Mother meeting was duplicated.
