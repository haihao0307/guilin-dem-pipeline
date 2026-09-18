# Current Best View — N15 native WGSL runtime boundary

Status: **Candidate partial**

The N14 signed-cell-bit-pattern to unsigned-mixer ABI now matches all twelve locked vectors in three execution contexts: CPU, WebGL2/GLSL ES on SwiftShader, and WGSL through direct `wgpu 29.0.0` on Mesa llvmpipe/Vulkan. The final native run used a committed `Cargo.lock` and `cargo --locked`; its adapter self-reported `CPU` and `llvmpipe`, so the evidence is software-runtime semantic verification only.

Browser WebGPU remains **Unknown**. Four Chrome attempts could enumerate or reach the software Vulkan environment but did not produce a usable WebGPU result. Device enumeration is therefore a prerequisite receipt, not an execution receipt. Native wgpu must not be substituted for browser, hardware-GPU, mobile-performance or production evidence.

Exact direct dependency syntax and a lock file are both required: Cargo's ordinary `"29.0.0"` requirement admitted `29.0.4`, while `=29.0.0` fixed the direct crate and the lock captured the full resolved graph. Locked vectors verify semantics only; hash quality, real Mother coordinate paths, adoption and user acceptance remain separate.

Canonical Truth, Frozen R1 and production branches are unchanged.
