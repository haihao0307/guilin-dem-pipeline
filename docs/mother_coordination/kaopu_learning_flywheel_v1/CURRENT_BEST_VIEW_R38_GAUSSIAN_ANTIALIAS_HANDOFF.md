# Current Best View — Gaussian antialias handoff R38 candidate

1. Training mode, SPZ antialias flag and viewer behavior are separate identities. A file opening successfully authenticates none of their agreement.
2. Fixed Brush exports `SplatRenderMode` only as a PLY comment. The pinned Niantic PLY loader skips comments, so its default converter silently emits `antialiased=false` even for a Brush Mip PLY.
3. Three r186 ignores the SPZ antialias bit in returned geometry and unconditionally applies the `0.3` covariance kernel plus determinant opacity compensation. False- and true-flag files therefore become identical viewer inputs.
4. For future Brush Mip delivery, explicitly set and post-verify SPZ bit `0x1`; do not rely on the standard PLY comment path. Do not use native r186 as a mode-preserving reference for default/non-AA checkpoints.
5. Ordinary positive-covariance Mip compensation aligned in the bounded equation check, but singular numerical floors differed (`0` versus `0.005`). GPU images, compositing, device behavior and human acceptance remain Unknown.
6. R34-R37 range/envelope/DC/SH gates remain in force. Float PLY, photos, pose solution and cleanup log remain truth-bearing checkpoints; SPZ and viewer output remain lossy derivatives. Frozen R1 and production Mothers are unchanged.

