# Current Best View R73 — view-dependent footprint invalidates Gaussian summaries

Status: **Candidate partial**.

With Three.js r186 source bytes, draw order, covariance, output format and block size fixed, moving only camera `z` from `2.0` to `1.5/2.5` changed every measured effective-alpha-map digest and every recomputed block-summary digest.

Per-view recomputation remained conservative with zero underestimated channels and bit-exact Half replay. Reusing the `z=2.0` summaries at `z=1.5` underestimated `32` channels; the worst shortfall was `0.08109634`. A renderer/source key that ignores view state is therefore **Rejected** as reuse authority.

Exact ordered draw stream and view-dependent effective-alpha footprint are demonstrated cache-invalidation dimensions. A candidate key binds both plus renderer/blend/output/block schema, but the combined key is not yet proven sufficient across covariance or backend changes. The far view's accidental zero underestimation does not license stale reuse.

WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance and human acceptance remain **Unknown**. Mother adoption is unacknowledged; Canonical Truth and Frozen R1 are unchanged.

Next: isolate covariance-scale invalidation with camera and order fixed.

