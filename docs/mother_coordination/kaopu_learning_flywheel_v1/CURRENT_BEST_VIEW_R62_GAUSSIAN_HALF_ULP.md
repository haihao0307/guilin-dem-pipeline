# Current Best View R62 — Half precision is a sequential state problem

Status: **Candidate partial**.

R62 confirms the local mechanism but rejects its simplest aggregate. Across six actual Three.js r186 `SPZLoader -> GaussianSplat -> NormalBlending` sequences, a corrected nearest-even Half replay reproduced every observed center exactly, and every write whose source-over increment was at or below half the current upward Half ULP was an exact no-change write.

The total count is not sufficient. Two deterministic permutations each had 1,260 such writes, yet their actual Half centers differed by `0.0029296875`. Therefore tau, `sum(alpha^2)` and total stall count remain screening features only. Precision validation must retain the ordered state trajectory or a separately falsified path-sensitive summary.

The r186 `DataUtils.toHalfFloat()` implementation truncates discarded mantissa bits and must not be treated as the renderer's nearest-even blend-target oracle. `DataUtils.fromHalfFloat()` remains valid for decoding the observed Half bits in this locked test.

This is still one synthetic Chromium/SwiftShader evidence lineage, not an independent physical Observation Root. Default Half and paired Float are both diagnostic candidates, not production decisions. WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance/energy and human acceptance remain **Unknown**. Canonical Truth and Frozen R1 are unchanged.

Next: test a per-channel signed propagated rounding-residual trace on deterministic mixed-color sequences before considering any compact risk gate.

