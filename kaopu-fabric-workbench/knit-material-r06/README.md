# KNIT-MATERIAL-R06 — adaptive same-quality candidate

R06 is isolated from R04 and R05. It preserves the original material source, yarn/fibre functions, 2 AA samples, 8 fibre curve segments, 128 ray-march limit and 8 shadow samples.

The R05 browser evidence showed that the conservative spatial candidate index plus the depth prepass was not consistently beneficial on SwiftShader: dense/low-resolution cases regressed, and the 640x480 software comparison varied substantially between runs. R06 therefore only activates the index/depth prepass when the adapter is not a software fallback, width is at least 640, and hair density is at least 800. Software adapters stay on the exact R04 search path. The candidate can still be explicitly toggled on a real GPU for same-device A/B testing.

An empty accelerated cell falls back to the original coarse candidate bin, avoiding a false miss. No quality reduction or lower fibre count is used.

Acceptance is split:
- Pixel/depth equality versus R04
- Completed-frame timing and 60 FPS budget
- Public runtime and standalone file checks
- Hardware identity reported separately

No 60 FPS claim is made by this candidate. The GitHub Actions test uses SwiftShader and cannot certify a physical GPU.