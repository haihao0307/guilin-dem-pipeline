# KAOPU Learning Cycle — Gaussian reconstruction handoff R33

Date: 2026-09-11
Queue item: LQ-GAUSSIAN-001
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.
Production Mother mutation: none.

## Bounded question

Can one explicit handoff contract prevent silent coordinate, pose, covariance and spherical-harmonic corruption in the proposed photo validation -> COLMAP/SfM -> Brush training -> cleanup/export -> SPZ -> Three.js r186 path?

This cycle does not evaluate reconstruction quality. It authenticates only the interfaces that must survive before a real-photo pilot is worth running.

## Logical corrections before adoption

- A viewer is not a trainer. Three.js r186 loads and renders splats; Brush is the candidate trainer.
- Small application binaries do not imply small photo, training-memory, splat-memory or GPU cost.
- SH appearance is a captured view-dependent color function, not a physical material or relighting model.
- SPZ compression is a delivery optimization, not lossless Canonical Truth.
- A Gaussian cloud is not complete Object DNA: it does not by itself supply semantic parts, topology, anchors, collision, articulation, material state, history or behavior.
- COLMAP/SfM reconstruction has an arbitrary similarity gauge until an explicit metric/orientation anchor is supplied.

## Observation roots kept distinct

### O-R33-COLMAP — official pose/file contract

Pinned repository: colmap/colmap at `2d2f00a9fae7db7e2ed8f027a67e8f8576dfd214`.

Official `images.txt` semantics: Hamilton quaternion `(QW,QX,QY,QZ)` and translation project world to camera. Camera center is `-R^T T`, not `T`. Local camera axes are right, down, front.

This is a software-format root, not physical observation.

### O-R33-BRUSH — fixed candidate trainer source

Pinned repository: ArthurBrussee/brush at `063945e797e0b3b7fd60b0feb7b9010385dd4bda`.

Observed in source:

- dataset loader recognizes COLMAP, Nerfstudio and RealityCapture inputs;
- COLMAP world-to-camera is inverted to camera-to-world before creating Brush cameras;
- disconnected COLMAP reconstructions are not merged; the largest registered model is chosen deterministically;
- exported PLY stores means, log scales, raw opacity, normalized quaternion in GraphDECO `w,x,y,z` order, SH DC and remaining channel-major coefficients;
- an up-axis comment is metadata, while metric scale still requires evidence outside a free-gauge SfM solve;
- current README says the web build supports Chrome/Edge and does not yet claim Safari support.

Brush is a candidate tool, not proof of target-device performance or reconstruction accuracy.

### O-R33-SPZ — official compression and coordinate contract

Pinned repository: nianticlabs/spz at `affd0ecea7fbb4c265ee119475af7ee5b2997482`.

Observed:

- SPZ v4 uses independent ZSTD streams;
- default storage coordinates are RUB (right, up, back), but the coordinate-system extension can specify other frames;
- coordinate conversion changes positions, quaternion components and SH coefficients together;
- positions use signed 24-bit fixed point, currently 12 fractional bits;
- log scales and colors use bytes; v3/v4 rotations use a smallest-three quaternion representation;
- default SH precision is 5 bits for degree 1 and 4 bits for degree 2+;
- SPZ supports SH degree 4.

These are encoding semantics. The repository’s qualitative “minimal visual difference” statement is not a KAOPU acceptance result.

### O-R33-THREE — official r186 viewer source

Pinned tag `r186`, commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, package version `0.186.0`.

Observed:

- r186 introduced native Gaussian splat loading/rendering and SPZ v4 support;
- all supported loaders normalize data to position, six covariance components, RGBA8 color and optional packed SH1–SH3 attributes;
- GraphDECO PLY is read as log scale plus `rot_0=w, rot_1=x, rot_2=y, rot_3=z`;
- `SPZLoader` warns that vendor extensions are unsupported and skipped;
- its maximum supported SH degree is 3, although the file-size parser accepts stored SH4 and skips the unsupported band.

This is a viewer implementation root, not training evidence.

### O-R33-BEN3D — implementation-author explanation

Ben Houston’s 2026-08-07 implementation article and 2026-09-07 usage tutorial are useful candidate explanations of the r186 workflow. Important loader, format and SH claims were checked against the fixed Three.js source above. These pages are not an independent Observation Root from the implementation they describe.

## Executed evidence

Added and executed `PROBES/gaussian_handoff_probe_r33.mjs`. Nine tests passed.

Actual Three.js r186 code was executed for two key checks:

1. a synthetic GraphDECO PLY with anisotropic scales and a 90-degree Z quaternion produced covariance diag approximately `(4,1,9)`, authenticating the required `wxyz` mapping;
2. a synthetically encoded SPZ v3 file declaring SH4 loaded, but the resulting geometry had SH1–SH3 only. Twenty-seven degree-4 directional coefficients per splat are absent from the r186 geometry.

Source-semantic negative controls additionally showed:

- treating a sample RDF position `(1,2,3)` as RUB instead of converting to `(1,-2,-3)` gives Euclidean error `sqrt(52)=7.21110255` in the sample units;
- RDF -> RUB must also map quaternion `(x,y,z,w)` to `(x,-y,-z,w)` and change SH orientation; flipping only position is invalid;
- at 12 fractional bits, the SPZ position step is `0.000244140625` units; the fixture’s largest coordinate error was `0.000114140625`;
- byte log-scale packing has a theoretical nearest-step relative scale bound of `exp(1/32)-1 = 0.0317434` before clamping;
- default SH packing changes non-grid coefficients and is therefore lossy.

The coordinate-extension incompatibility is authenticated from paired SPZ and Three.js source. No ZSTD SPZ v4 extension-bearing file was rendered.

## Current Best View

Use four separate identities:

1. **Capture/Pose evidence** — source-photo hashes, masks, camera intrinsics, COLMAP version, registration/reprojection evidence, `worldFromCamera` conversion, and any metric/up anchor.
2. **Uncompressed reconstruction checkpoint** — float PLY or equivalent, trainer/version/config/seed, SH degree, coordinate frame, units and hash.
3. **Cleanup history** — crop/delete/filter operations as an ordered reversible edit log.
4. **Delivery derivative** — SPZ version, quantization policy, declared storage frame and viewer capability target.

For Three.js r186, the safe candidate profile is SPZ v4 stored directly in default RUB, no coordinate-system extension, SH degree at most 3. Keep the uncompressed PLY checkpoint and compare before/after renders; never make SPZ the sole truth-bearing copy.

## Status ledger

- Observation: pinned COLMAP, Brush, SPZ and Three.js software contracts.
- Candidate: the four-identity handoff contract and the r186-safe SPZ profile.
- Current Best View: splats may become a compact observation/reference and presentation tool after a small real-photo pilot; they do not replace KAOPU Object DNA.
- Frozen: KAOPU R1 and all user-approved Mother freezes unchanged.
- Rejected: viewer=trainer; T=camera center; coordinate labels imply metric scale; axis conversion may ignore quaternion/SH; SPZ is lossless truth; SH is physical relighting; small executable means low runtime cost; a splat is complete Object DNA.
- Unknown: real-photo reconstruction quality, COLMAP/Brush runtime, cleanup repeatability, metric-scale accuracy, PLY->SPZ image error, macOS/iPhone/Safari memory/performance, and human visual acceptance.

## Routing

Prepared only. No Mother acknowledgment or adoption was observed. See `MOTHER_ROUTING_R33_GAUSSIAN_HANDOFF.json`.

No independent external-AI review was performed; no unavailable access is claimed.
