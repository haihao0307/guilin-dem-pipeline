# Current Best View — Gaussian SPZ loader memory R41 candidate

1. Three.js r186 SPZ v4 parsing creates 20/29/44/65 decoded-stream bytes per splat for SH0–SH3, then 40/52/68/92 bytes per splat of output geometry.
2. The concurrent JavaScript-array lower bound is `compressed bytes + N × {60,81,112,157} + 9,472 shared LUT bytes` for SH0–SH3.
3. Two actual 1024-splat SH3 files differed by about 157.212× in compressed size (241 versus 37,888 bytes) but each created 66,560 decoded-stream bytes and 94,208 output-geometry bytes. Delivery size is not a runtime-memory proxy.
4. One million SH3 splats imply at least 149.736 MiB plus compressed input at this parse stage. This excludes ZSTD WebAssembly memory, fetch copies, garbage-collection overlap, renderer construction, GPU and browser/process overhead.
5. A real pilot must record compressed size, count/SH degree, loader JS arrays, WASM/fetch/process peak, constructor/GPU overlap, frame time and failure behavior separately on macOS and 390×844 iPhone/Safari.
6. R33–R40 gates, Canonical Truth, Frozen R1 and production Mothers remain unchanged. No device limit or production adoption is implied.
