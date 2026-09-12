# Current Best View — Gaussian runtime memory R40 candidate

1. Three.js r186's retained CPU TypedArray lower bound is `65,596 + N × {104,116,132,156}` bytes for SH degrees 0–3 immediately after construction.
2. For SH1–SH3, the first WebGPU SH pre-pass lazily adds 16 bytes/splat, producing per-splat totals `{132,148,172}`. The path was executed with a renderer stub; no GPU allocation was measured.
3. Packed SH arrays are shared between source geometry and storage nodes and must not be double-counted. Position/covariance/color are retained in source form and copied into padded storage arrays.
4. `autoSort=false` does not prevent r186 from constructing its 4096-bin sort buffers. It disables automatic dispatch only.
5. One million SH3 splats project to 148.836 MiB at construction and 164.095 MiB after lazy WebGPU SH allocation. This is a reproducible CPU-visible lower bound, not total browser/GPU/device peak or a safe mobile limit.
6. A real-photo pilot must measure loader/transient peak, CPU/process peak, backend GPU allocation, render targets, frame time and failure behavior separately on macOS and 390×844 iPhone/Safari. R33–R39 gates, Canonical Truth, Frozen R1 and production Mothers remain unchanged.
