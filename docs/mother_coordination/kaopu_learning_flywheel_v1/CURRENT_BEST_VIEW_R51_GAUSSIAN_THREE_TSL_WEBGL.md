# Current Best View R51 — direct Three.js r186 TSL WebGL cutoff replay

Status: **Candidate partial**.

R51 directly replayed the complete R50 cutoff-neighbor fixture through pinned Three.js r186 TSL on the forced WebGL fallback path. All 4,644 cases executed. The stepwise float32 predicate matched direct TSL coverage in every case; the double-precision predicate disagreed 32 times, all double-outside/backend-inside, with the same directional distribution observed in R50. All six exact axis `r2=4` controls were retained.

This materially strengthens R50: the cutoff-neighbor result is no longer only an independent llvmpipe-shader observation. It now has direct Three.js r186 TSL WebGL evidence in a locked Chromium/ANGLE/SwiftShader CI environment.

The observed retained double-precision excess remains approximately `2.69e-8` to `4.24e-7`. That range is still not a universal guard width, asset tolerance, or device-independent constant. It is a fixture observation that depends on effective precision, compiler/backend behavior and transform path.

The WebGPU request in the same CI environment initialized WebGL instead and is therefore recorded as unsupported rather than pass. Hardware GPU, Apple target devices, Safari, real-photo/learned assets, stable-pixel float-target color error and human visual acceptance remain Unknown.

R51 also establishes an execution-pattern lesson: evidence quality need not be traded for CI throughput. The full 4,644-case fixture was retained while reducing synchronization to 36 render submissions and 36 readbacks by batching one scale/direction row at a time through one shared TSL material.

Frozen R1, Canonical Truth and production Mother branches are unchanged.
