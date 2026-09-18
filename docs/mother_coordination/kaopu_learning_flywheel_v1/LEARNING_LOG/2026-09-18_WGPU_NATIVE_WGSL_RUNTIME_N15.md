# KAOPU Learning Note — N15 native WGSL integer-hash runtime

Date: 2026-09-18  
Bounded question: Can the twelve N14 integer-cell vectors execute as WGSL through an available, version-locked runtime, and what evidence boundary remains if browser WebGPU still cannot initialize?

Status: **Candidate partial / WGSL through wgpu-native on Mesa llvmpipe verified; browser WebGPU, hardware GPU and mobile Unknown**

## Observation roots

### Observation root A — inherited WGSL language contract

N14 locked the official [WGSL Candidate Recommendation Draft dated 15 September 2026](https://www.w3.org/TR/WGSL/) and its `i32`/`u32`, two's-complement, modulo arithmetic, `bitcast` and shift semantics. N15 does not reinterpret that source and does not count it as new runtime evidence.

### Observation root B — official wgpu and Cargo contracts

The probe follows the official [wgpu v29.0.0 source](https://github.com/gfx-rs/wgpu/tree/v29.0.0) headless compute route: create an instance without a display handle, request a fallback adapter, compile WGSL, dispatch a compute pass and map the result buffer.

The official [Cargo dependency specification](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html) makes a plain `"29.0.0"` requirement compatible with later `29.0.x` releases. The first successful run therefore resolved direct `wgpu` to `29.0.4`, despite the human-readable source declaration saying `29.0.0`. N15 corrected the direct requirement to `=29.0.0`, committed `Cargo.lock`, and performed a final `--locked` replay. Transitive wgpu-family crates remain at the versions recorded in that lock; they must not be summarized as all being `29.0.0`.

### Observation root C — Mesa software Vulkan adapter

The runner enumerated `llvmpipe (LLVM 20.1.2, 256 bits)` through Vulkan, with Mesa `25.2.8`, device type `CPU`, Vulkan API `1.4.318` and conformance version `1.3.1.1`. Mesa documents [llvmpipe](https://docs.mesa3d.org/drivers/llvmpipe.html) as a software rasterizer. This is a software execution route, not hardware-GPU or performance evidence.

### Observation root D — browser WebGPU negative controls

Four bounded CI attempts were retained rather than hidden:

- [run 35288073891](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35288073891) exposed an incorrect hard-coded Lavapipe ICD filename;
- [run 35288197597](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35288197597) discovered the real `lvp_icd.json` and enumerated llvmpipe, but Chrome returned no usable WebGPU result;
- [run 35288285791](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35288285791) tested ANGLE `gl`, `swiftshader` and `vulkan` routes without obtaining the result buffer;
- [run 35288399763](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35288399763) added Xvfb and still obtained no browser WebGPU result.

Therefore Vulkan device enumeration is not proof that Chrome WebGPU is usable. Browser WebGPU remains **Unknown**, not failed semantically.

### Observation root E — executable native WGSL result

The final [locked CI replay 35289516174](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/35289516174) compiled and executed the exact WGSL module through direct `wgpu 29.0.0` on the Mesa llvmpipe Vulkan adapter. Four of four gates passed. All twelve `u32` hashes exactly matched the N14 CPU and GLSL ES fixture, including `INT_MIN`, `INT_MAX`, negative values and the float32 exact-integer boundary.

This adds a third execution context for the same fixture. It verifies cross-runtime semantic agreement for these vectors; it is not independent evidence that the mixer has good statistical quality.

## Candidate

Retain the N14 integer-cell ABI and add the following replay discipline:

1. state whether evidence is specification-only, browser WebGPU, native wgpu, software adapter or target hardware;
2. use exact direct dependency requirements plus a committed lock file for executable receipts;
3. record adapter backend, device type, driver and driver version with results;
4. run the same locked vectors, without translating expected outputs per backend;
5. do not promote a native wgpu pass to browser-WebGPU, hardware-GPU, mobile-performance or production-adoption status.

## Current Best View

The N14 `i32` bit-pattern to `u32` ABI is now executable and bit-stable across CPU, WebGL2/GLSL ES SwiftShader and native WGSL through wgpu/Mesa llvmpipe for the twelve locked vectors. The former claim “WGSL runtime Unknown” is narrowed to: native WGSL **verified on one software Vulkan route**, while browser WebGPU and target mobile/hardware remain **Unknown**.

Runtime identity is part of the receipt. Vulkan enumeration, a source module, a browser flag or a dependency string alone is not a runtime pass. The locked vectors remain a conformance fixture, not a statistical hash-quality or performance benchmark.

## Frozen

- Canonical Truth, Frozen R1 and all production Mother branches remain unchanged.
- No production hash, procedural material or coordinate representation was replaced.
- N09/N02 Mother routes were not repeated without acknowledgement.

## Rejected

- “A visible Vulkan adapter proves Chrome WebGPU will execute.”
- “Native wgpu and browser WebGPU are the same acceptance surface.”
- “Mesa llvmpipe predicts hardware-GPU, iPhone or mobile performance.”
- “`wgpu = \"29.0.0\"` by itself pins the direct crate to exactly 29.0.0.”
- “Twelve matching hashes prove collision resistance or acceptable distribution.”
- “A successful coordinator probe means a Mother adopted the contract.”

## Unknown

- Chrome/browser WebGPU execution on an actually available adapter.
- Target iPhone/mobile and hardware-GPU correctness and performance.
- The real cell source, axis order, numeric conversions and serialization boundary in Brick or Landscape.
- Hash distribution/collision suitability for a selected production workload.
- Mother acknowledgement, implementation, public/device validation and user acceptance.

## Routing recommendation

Prepare N15 only as an evidence update to the held N13/N14 addendum for Brick Material and Landscape. Do not repeat-comment HOUSE PR15 or Landscape PR79 before acknowledgement. If a Mother exposes a real split-cell implementation, run its exact source representation through the locked vectors before visual A/B; separately test the browser/device route it actually ships.

The next meaningful gap is target browser/mobile execution or, once a Mother acknowledges the route, an audit of its actual cell source and serialization boundary. First-tier expert AI was not called; routine cross-AI discussion remains owned by the separate expert task.
