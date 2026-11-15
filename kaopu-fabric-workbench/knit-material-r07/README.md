# KNIT-MATERIAL-R07 — persistent GPU strand cache

R07 retains the accepted R04 material model and R06 direct yarn intersection. It adds a persistent GPU storage cache containing the nine exact sampled positions of each fibre curve (root + eight existing curve segments) and the per-strand lighting multiplier. The original R06 per-frame strand reconstruction remains available as hairsLegacy for same-session A/B tests.

The cache is generated once after geometry or hair-shape inputs change. Camera movement and viewport changes do not invalidate it; those frames only project the cached curve points and run the same pixel coverage, depth test, and optical-depth accumulation. Default 491,520 fibres and eight curve segments remain unchanged. No mesh or triangle draw path is introduced.

Memory trade-off: default cache is 78,643,200 bytes (about 75 MiB). This is GPU storage allocation, not driver VRAM usage. Hardware acceptance requires the target GPU and production resolution. CI software WebGPU is not a hardware benchmark.
