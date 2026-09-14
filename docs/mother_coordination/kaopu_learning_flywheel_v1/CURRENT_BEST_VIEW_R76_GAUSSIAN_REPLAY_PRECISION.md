# Current Best View R76 — replay arithmetic precision is explicit

Status: **Candidate partial (classified)**.

On the fixed R75 nominal-45-degree Three.js r186/SwiftShader fixture, host-double replay was one Half ULP wrong in 6 of 4,356 terminal channels. Float calibration plus explicit Float32 rounding before Half conversion matched all terminal channels; Half single-splat calibration did not.

The transferable method is to bind replay arithmetic precision and source-readback class in the diagnostic contract. A host-language expression that happens to use doubles is not renderer arithmetic truth.

However, the predeclared scissored prefix path returned zeros and failed its independent terminal control. It is excluded. Therefore Float32 replay is only a terminal **Candidate explanation**, not a per-write proof or formal bound. Final equality cannot certify hidden intermediate state.

Exact draw order, view-conditioned footprint, covariance scale and orientation remain demonstrated cache invalidation dimensions from R72-R75. R76 does not weaken those findings; it narrows the replay arithmetic requirement.

Hardware GPU, WebGPU, Safari/iPhone, real reconstruction, performance and human acceptance remain **Unknown**. Mother adoption is unacknowledged; Canonical Truth and Frozen R1 are unchanged.

Next: execute sparse, independently rendered prefix checkpoints with a mandatory full-frame equality control, then separate Float32 arithmetic candidates.
