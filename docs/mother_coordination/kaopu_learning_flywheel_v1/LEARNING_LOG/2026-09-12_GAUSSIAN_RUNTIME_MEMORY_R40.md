# KAOPU Learning Cycle — Gaussian runtime memory R40

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

Before GPU upload, how much CPU-visible TypedArray storage does the fixed Three.js r186 `GaussianSplat` path actually retain per splat, and does disabling automatic sorting remove its sort buffers?

This cycle executes the real constructor and lazy WebGPU SH-allocation path without a GPU backend. It does not measure browser, loader, GPU or device peak memory.

## Observation root

### O-R40-THREE — fixed r186 implementation

At Three.js r186 commit `148ef33ecb6d2502ff796d4554abd1549c95d519`:

- source geometry retains position, covariance, color and packed SH arrays;
- `createStorageBuffers` creates padded center/covariance/color copies, while its SH storage attributes reuse the source packed SH arrays;
- `CountingSort` allocates order, bin, histogram and offset storage arrays plus three CPU fallback arrays;
- the histogram/offset arrays and their CPU mirrors use the fixed 4096-bin count;
- `GaussianSplat` constructs `CountingSort` unconditionally; `autoSort=false` changes dispatch behavior, not constructor allocation;
- a four-float SH contribution buffer is allocated lazily only when a non-WebGL SH pre-pass first runs.

This is one software observation root. The byte inventory and one-million-splat arithmetic are derived evidence, not independent runtime observations.

## Executed evidence

Six checks passed in `PROBES/gaussian_runtime_memory_result_r40.json`. The probe constructed actual r186 objects at counts 1, 17 and 1024 for SH degrees 0–3, inventoried named TypedArrays, and deduplicated by underlying `ArrayBuffer` identity.

The constructor-retained lower bound is:

`65,596 fixed bytes + count × per-splat bytes`

| SH degree | constructor bytes/splat | after first WebGPU SH update |
|---:|---:|---:|
| 0 | 104 | 104 |
| 1 | 116 | 132 |
| 2 | 132 | 148 |
| 3 | 156 | 172 |

The fixed 65,596 bytes are 65,536 bytes of four 4096-entry sort arrays plus 60 bytes of draw-quad geometry. The count-dependent constructor term contains source geometry, 52 bytes/splat of padded storage copies and 12 bytes/splat of sort/order working arrays. Packed SH contributes 0/12/28/52 bytes/splat for degrees 0/1/2/3 and is counted once because source and storage alias the same buffers.

The actual SH3, 1024-splat constructors with `autoSort=true` and `autoSort=false` both retained 225,340 CPU-visible bytes. Disabling dispatch therefore does not reclaim sort allocation in this version.

For scale only, the executed formula gives 156,065,596 bytes (148.836 MiB) for one million SH3 splats immediately after construction, and 172,065,596 bytes (164.095 MiB) after the first WebGPU SH contribution allocation. These are arithmetic projections from the verified layout, not iPhone or browser measurements.

## Candidate method

Keep memory evidence in four separate layers:

1. **Deterministic retained lower bound** — record splat count, SH degree, fixed Three revision and deduplicated CPU TypedArray bytes.
2. **Loader peak** — separately record compressed input size, decompressed streams, float checkpoint and ZSTD/transient peak.
3. **Renderer/device peak** — separately measure backend GPU allocations/padding/copies, render targets, browser/process peak and failure behavior on each target.
4. **Acceptance** — record frame time, visual result and human acceptance; do not infer these from bytes alone.

`ADAPTERS/gaussian_runtime_memory_gate_r40.mjs` deliberately refuses device acceptance when only the constructor lower bound is supplied. Do not set a universal splat-count ceiling from this cycle.

## Status ledger

- Observation: fixed r186 array layouts, allocation timing and actual constructor/lazy-allocation execution.
- Candidate: the exact lower-bound formula and four-layer memory acceptance method.
- Current Best View: a small app or compressed SPZ does not imply a small runtime; the fixed r186 constructor alone retains a count- and SH-dependent CPU lower bound, while total target-device cost remains unknown.
- Frozen: KAOPU R1 and all user-approved Mother freezes unchanged.
- Rejected: compressed file size equals runtime memory; `autoSort=false` removes sort buffers; SH source and storage must be double-counted; the one-million projection is an iPhone capacity claim.
- Unknown: SPZ/ZSTD loader peak, browser/object overhead, GPU allocation and padding, render-target cost, real-asset count/SH distribution, macOS/iPhone/Safari behavior, frame time, failure mode and human acceptance.

## Routing

Prepared only. R39 Mother feedback remains empty and no acknowledged adoption was observed. See `MOTHER_ROUTING_R40_GAUSSIAN_RUNTIME_MEMORY.json`.

No routine cross-AI meeting or first-tier expert consultation was performed in this learning round. The separately scheduled expert task remains the only routine cross-AI venue; no unavailable access is claimed.
