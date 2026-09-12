# KAOPU Learning Cycle — Gaussian ZSTD WASM memory R42

Date: 2026-09-12  
Queue item: LQ-GAUSSIAN-001  
Status: Candidate partial. Not Frozen. Not formal KAOPU R2.  
Production Mother mutation: none.

## Bounded question

After Three.js r186's bundled ZSTD decoder frees its per-stream allocations, does its WebAssembly linear memory shrink, and can a new decoder object reset the retained high-water capacity?

This cycle instruments only a read-only accessor into an in-memory copy of the fixed decoder module. The decode logic and embedded WASM bytes are unchanged. It measures `WebAssembly.Memory.buffer.byteLength`, not live allocations or total process memory.

## Observation root

### O-R42-THREE-ZSTD — fixed r186 bundled decoder

At Three.js commit `148ef33ecb6d2502ff796d4554abd1549c95d519`, the bundled decoder:

- initializes one module-level WebAssembly instance;
- allocates a compressed-input region and an output region for each `decode` call;
- copies the result into a JavaScript `Uint8Array`, then calls `free` on both WASM allocations;
- caches the initialization promise and instance at module scope, so new decoder objects share that module memory.

The synthetic compressor only supplies controlled ZSTD streams. It is not an additional runtime observation root.

## Executed evidence

Five checks passed in `PROBES/gaussian_zstd_wasm_memory_result_r42.json`; all decoded bytes were verified against their deterministic sources.

### Initial and growth behavior

- initialization: 16,777,216 bytes (16 MiB);
- 1 MiB varied input/output: remained 16 MiB;
- 24 MiB zero output from a 787-byte compressed stream: grew to 30,605,312 bytes (29.1875 MiB);
- the same 24 MiB output from a 25,166,410-byte varied stream: grew to 55,771,136 bytes (53.1875 MiB).

Thus output size alone does not determine the WASM high-water mark. Compressed input and output coexist inside WASM during a call, with allocator/growth overhead.

### Persistence counterexample

After the varied 24 MiB decode, both WASM allocations were freed by the fixed decoder. Nevertheless:

- `WebAssembly.Memory.buffer.byteLength` stayed at 55,771,136 bytes;
- constructing and initializing another `ZSTDDecoder` in the same module kept that capacity;
- decoding the 1 MiB stream afterward also left capacity at 55,771,136 bytes.

`free` makes allocator space reusable but does not return the grown linear-memory capacity in this executed path. Recreating a class object is not a reset because the module instance is shared.

For SPZ v4 this complements R41 rather than replacing it: JavaScript retains all decoded attribute-stream arrays until geometry creation, while WASM capacity is driven by the largest individual compressed/output decode demand encountered and persists for later loads in that module realm.

## Candidate method

Keep these values separate for every target load test:

1. initial WASM capacity;
2. capacity before/after each attribute stream and the maximum compressed/output pair;
3. JavaScript decoded/output arrays from R41;
4. browser/process peak and later renderer/GPU allocations;
5. capacity after asset disposal and after loading the next asset.

A dedicated short-lived Worker/realm may be able to release the entire decoder instance when terminated, but that is only a mitigation candidate. It requires an actual browser implementation, transfer/copy accounting, failure handling and macOS/iPhone/Safari measurement before routing as an adopted solution.

## Status ledger

- Observation: fixed decoder source, actual embedded WASM execution, verified decoded outputs and measured linear-memory capacity.
- Candidate: retained-high-water test and per-stream capacity ledger; dedicated-worker isolation remains an untested mitigation.
- Current Best View: `free` and a new decoder object do not reset the r186 module's grown WASM capacity; sequential assets can inherit the largest prior high-water mark.
- Frozen: KAOPU R1 and all user-approved Mother freezes unchanged.
- Rejected: decoder `free` shrinks WebAssembly memory; a new `ZSTDDecoder` object starts fresh memory; output size alone predicts WASM capacity; Node WASM capacity proves Safari process behavior.
- Unknown: live allocator occupancy, exact SPZ real-asset high-water, worker transfer/copy overhead, browser garbage collection, process peak, renderer/GPU overlap, Safari/iPhone behavior and human acceptance.

## Routing

Prepared only. R41 Mother feedback remains empty and no acknowledged adoption was observed. See `MOTHER_ROUTING_R42_GAUSSIAN_ZSTD_WASM_MEMORY.json`.

First-tier expert AI was not called. No routine cross-AI meeting was duplicated and no unavailable access is claimed.
