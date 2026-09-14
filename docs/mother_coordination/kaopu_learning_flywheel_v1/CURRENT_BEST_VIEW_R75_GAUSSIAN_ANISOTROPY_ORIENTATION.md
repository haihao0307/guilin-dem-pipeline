# Current Best View R75 — covariance orientation is an invalidation dimension

Status: **Candidate partial**.

With Three.js r186 camera, positions, RGB, Alpha sequence, exact draw order, anisotropic scale bytes `[128,96,96]`, Half target and block size fixed, changing only the packed quaternion altered decoded covariance, view-conditioned effective Alpha maps, strong keys and summary digests.

Stale 0° summaries underestimated 16 channels at nominal 45° and 36 at 90°, with worst shortfalls `0.11270412` and `0.11089316`. A cache key that omits covariance orientation is **Rejected** as reuse authority.

However, the first preregistered run also falsified automatic bit-exact transfer of the Float-calibrated replay: maximum Half replay mismatch was `0.00048828125`. Per-condition recomputation underestimated zero sampled channels only empirically relative to that surrogate; it is not a formal renderer-bit bound.

Exact order, view-conditioned footprint, covariance scale and covariance orientation are demonstrated invalidation dimensions. A candidate key binds the decoded tensor plus renderer/blend/output/block schema, but combined sufficiency remains unproven.

WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance and human acceptance remain **Unknown**. Mother adoption is unacknowledged; Canonical Truth and Frozen R1 are unchanged.

Next: isolate and close the eccentric-footprint replay mismatch before claiming a formal bound.
