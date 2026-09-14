# Current Best View R72 — exact draw order invalidates Gaussian diagnostic summaries

Status: **Candidate partial**.

In the fixed Three.js r186 Chromium/SwiftShader fixture, six deterministic reorderings preserved the complete unordered multiset of `1,941` alpha+RGB splat records, the camera, covariance, effective-alpha calibration, Half target and block size `128`. Every changed order produced a different ordered key and recomputed summary digest.

Recomputed summaries remained conservative for all variants, with zero underestimated channels and bit-exact Half replay. Reusing the baseline summaries after stable alpha-descending sorting underestimated `13` channels; the worst stale shortfall was `0.0195359774`. Therefore an order-insensitive multiset hash is **Rejected** as reuse authority.

Exact ordered draw stream is a demonstrated cache-invalidation dimension. A candidate cache key also binds renderer/blend/output/block schema and effective-alpha/view state, but R72 does not prove those fields jointly sufficient. Other reorderings that happened to remain conservative do not license stale reuse.

Camera/covariance changes, WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance and human acceptance remain **Unknown**. Mother adoption is unacknowledged; Canonical Truth and Frozen R1 are unchanged.

Next: change one camera parameter and verify effective-alpha-map invalidation plus recomputed conservatism.

