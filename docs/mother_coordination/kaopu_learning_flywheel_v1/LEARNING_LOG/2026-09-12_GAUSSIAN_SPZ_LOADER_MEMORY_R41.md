# KAOPU Learning Cycle — Gaussian SPZ loader memory R41

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

Does compressed SPZ v4 file size predict the CPU memory needed by Three.js r186 while decoding the file into Gaussian geometry?

This cycle executes the fixed Niantic encoder, Three r186 public loader and its actual ZSTD decoder. It establishes concurrent JavaScript `ArrayBuffer` lower bounds, not browser/process/device peaks.

## Observation roots

### O-R41-SPZ — fixed Niantic SPZ v4 encoder

Niantic SPZ commit `affd0ecea7fbb4c265ee119475af7ee5b2997482` generated valid v4 fixtures with controlled count, SH degree and compressibility. This source only establishes the input files; it does not establish Three runtime behavior.

### O-R41-THREE — fixed r186 loader and decoder

At Three.js commit `148ef33ecb6d2502ff796d4554abd1549c95d519`:

- `SPZLoader.parseRawSPZV4` decodes each attribute stream into a separate `Uint8Array`;
- after all streams exist, it allocates float centers, float covariances, color bytes and packed SH output geometry;
- the decoder copies compressed input and output through WebAssembly memory before returning a JavaScript slice;
- loader-wide lookup tables retain 9,472 bytes, independent of asset count.

The two software roots remain distinct. Fixture comparison and byte arithmetic are derived evidence, not independent physical observations.

## Executed evidence

Six checks passed in `PROBES/gaussian_spz_loader_memory_result_r41.json`.

The actual public `SPZLoader.parse` accepted all six Niantic fixtures. A wrapped instance of the same r186 ZSTD decoder retained returned stream buffers long enough to inventory them without using noisy process-memory deltas.

Per splat, the decoded streams require:

| SH degree | decoded streams | output geometry | combined before input/LUT |
|---:|---:|---:|---:|
| 0 | 20 B | 40 B | 60 B |
| 1 | 29 B | 52 B | 81 B |
| 2 | 44 B | 68 B | 112 B |
| 3 | 65 B | 92 B | 157 B |

Therefore the reproducible concurrent JavaScript-array lower bound is:

`compressed input bytes + count × {60,81,112,157} + 9,472 shared LUT bytes`

### Compression counterexample

Two valid assets had the same count (1024) and SH3 degree:

- deliberately compressible file: 241 bytes;
- varied file: 37,888 bytes;
- compressed-size ratio: approximately 157.212×.

Both decoded to exactly 66,560 bytes of attribute streams and 94,208 bytes of output geometry. Compressed size can change dramatically while count- and SH-dependent decode/output allocation stays identical.

For scale only, one million SH3 splats require at least 157,009,472 bytes (149.736 MiB) plus the compressed input in these JavaScript arrays and shared lookup tables during parsing. This excludes ZSTD WebAssembly memory, fetch/network copies, object overhead, later `GaussianSplat` constructor buffers, GPU allocations and browser/OS process overhead.

## Candidate method

Keep five measurements separate:

1. compressed delivery bytes;
2. declared count/SH degree and deterministic decoded/output-array lower bound;
3. actual ZSTD WebAssembly and fetch/FileLoader peak;
4. subsequent renderer-constructor/GPU/process peak, including possible delayed garbage collection overlap;
5. target-device frame time, load failure and human acceptance.

`ADAPTERS/gaussian_spz_loader_memory_gate_r41.mjs` refuses device-load acceptance when only file size and JavaScript-array bytes are available. No universal file-size or splat-count limit is promoted.

## Status ledger

- Observation: fixed Niantic v4 files; fixed Three loader/decoder source; actual public parsing and real ZSTD stream decoding.
- Candidate: exact per-degree JavaScript-array lower-bound formula and five-layer load-memory gate.
- Current Best View: compressed SPZ size is a delivery metric, not a reliable proxy for decoded geometry or target-device peak memory.
- Frozen: KAOPU R1 and all user-approved Mother freezes unchanged.
- Rejected: a tiny SPZ implies tiny loading memory; compressed-size ratio predicts decoded-array ratio; successful Node parsing proves iPhone safety.
- Unknown: ZSTD WASM allocator high-water mark, fetch/FileLoader copies, garbage-collection overlap with `GaussianSplat` construction, GPU allocation, browser/process peak, real-photo count/SH distribution, macOS/iPhone/Safari result and human acceptance.

## Routing

Prepared only. R40 Mother feedback remains empty and no acknowledged adoption was observed. See `MOTHER_ROUTING_R41_GAUSSIAN_SPZ_LOADER_MEMORY.json`.

First-tier expert AI was not called. No routine cross-AI meeting was duplicated and no unavailable access is claimed.
