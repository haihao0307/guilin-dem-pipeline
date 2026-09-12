# KAOPU Learning Cycle — Gaussian antialias handoff R38

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

Does the training/render antialias mode survive the fixed Brush PLY -> Niantic SPZ v4 -> Three.js r186 handoff, and does the viewer honor the SPZ `antialiased` bit?

This cycle checks metadata and source equations. It does not train or GPU-render a reconstruction.

## Observation roots kept distinct

### O-R38-BRUSH — fixed exporter and renderer semantics

At Brush commit `063945e797e0b3b7fd60b0feb7b9010385dd4bda`, exported PLY writes `comment SplatRenderMode: mip` or `default`. The fixed renderer implements these as distinct modes: both add a screen-space covariance blur, but only Mip returns determinant-based opacity compensation. This is an implementation root; Brush was not executable in this Work environment.

### O-R38-SPZ — official format and converter semantics

At Niantic SPZ commit `affd0ecea7fbb4c265ee119475af7ee5b2997482`, v4 header flag `0x1` means the splat was trained with antialiasing and should be rendered with mip-splat antialiasing. The standard PLY loader skips all comments and leaves `GaussianCloud.antialiased` at its default `false`; `ply_to_spz` does not restore it before saving.

The actual loader, v4 packer and unpacker were executed. A Brush-shaped PLY containing `SplatRenderMode: mip` became a v4 SPZ with flag byte `0`. Setting `GaussianCloud.antialiased=true` explicitly produced flag byte `1`, which survived decode.

### O-R38-GRAPHDECO — reference training/render toggle

At GraphDECO commit `54c035f7834b564019656c3e3fcc3646292f727d`, official guidance says antialiasing is disabled by default, should be enabled during training/render with `--antialiasing`, and should be enabled when viewing a scene trained that way. The pinned `dr_aa` rasterizer at `9c5c2028f6fbee2be239bc4c9421ff894fe4fbe0` adds `0.3` to the projected covariance and applies determinant-based opacity compensation only when the toggle is true.

### O-R38-THREE — fixed r186 loader/renderer semantics

Three.js r186 commit `148ef33ecb6d2502ff796d4554abd1549c95d519` reads the SPZ flag byte but does not pass bit `0x1` to the returned geometry or renderer. `GaussianSplat` unconditionally adds `KERNEL_2D_SIZE=0.3` and multiplies opacity by its determinant ratio.

The actual r186 loader was executed on two files differing only in flag `0x1`. It returned byte-identical position, covariance and color attributes, and exposed no antialias state in geometry `userData`.

These software roots participate in one dependent handoff. They are not independent physical evidence.

## Executed evidence

Seven checks passed in `PROBES/gaussian_antialias_handoff_result_r38.json`:

1. the Brush-shaped PLY declared `mip`;
2. actual Niantic PLY ingestion/default conversion lost that declaration and emitted flag `0`;
3. explicit Niantic antialias state emitted and decoded flag `1`;
4. the candidate gate rejected the silent mismatch;
5. actual Three r186 loading collapsed false/true flags to identical geometry;
6. for projected covariance `(a,b,c)=(1,0,1)`, Three's unconditional alpha scale was `0.7692307692` while GraphDECO non-AA semantics leave alpha scale at `1`, an absolute difference of `0.2307692308`;
7. ordinary positive-covariance AA formulas agreed in the tested equation, but a singular control differed: Three produced `0`, while the pinned GraphDECO numerical floor produced `0.005`.

The numerical controls are source-equation examples, not final pixel or visual-error measurements.

## Candidate method

Preserve three separate fields through the reconstruction manifest:

1. `trainingRenderMode` — the mode used by Brush/another trainer;
2. `deliveryAntialiasedFlag` — the actual SPZ bit, verified after packing;
3. `viewerAntialiasCapability` — whether the target viewer selects the required mode or hard-codes one.

For a Brush Mip checkpoint, the unmodified Niantic `ply_to_spz` path is not semantically safe because it ignores Brush's PLY comment. A wrapper or code path must set `GaussianCloud.antialiased=true`, then verify the file header. For a default/non-AA checkpoint, native Three r186 is not a mode-preserving reference because it hard-codes determinant compensation.

Even the explicit-Mip path is only Candidate-compatible: the singular numerical floor differs, GPU rasterization was not run, and no image or human threshold exists.

## Status ledger

- Observation: fixed Brush, SPZ, GraphDECO and Three source contracts; actual Niantic PLY/pack/unpack and Three loader behavior.
- Candidate: three-identity antialias manifest and `ADAPTERS/gaussian_antialias_handoff_gate_r38.mjs`.
- Current Best View: use explicit Mip metadata for a future Brush-to-r186 trial; never infer render mode from successful loading.
- Frozen: KAOPU R1 and all user-approved Mother freezes unchanged.
- Rejected: PLY comment automatically survives SPZ conversion; SPZ flag is honored by Three r186; successful load proves footprint/opacity equivalence; default and Mip-trained checkpoints are interchangeable.
- Unknown: real Brush export behavior at runtime, exact trained asset distributions, GPU image difference, sorting/compositing interaction, macOS/iPhone/Safari performance and human acceptance.

## Routing

Prepared only. No Mother feedback or acknowledged adoption was observed. See `MOTHER_ROUTING_R38_GAUSSIAN_ANTIALIAS_HANDOFF.json`.

No independent external-AI review was performed; no unavailable access is claimed.

