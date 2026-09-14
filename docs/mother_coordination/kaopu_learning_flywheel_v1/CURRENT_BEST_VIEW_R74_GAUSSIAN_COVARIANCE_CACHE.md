# Current Best View R74 — decoded covariance invalidates Gaussian summaries

Status: **Candidate partial**.

With Three.js r186 camera, positions, rotations, RGB, alpha sequence, exact draw order, Half target and block size fixed, changing only uniform isotropic SPZ scale bytes `112/116/120` changed decoded covariance, calibrated effective-alpha maps and block-summary digests.

Per-condition recomputation remained conservative with zero underestimated channels and bit-exact Half replay. Reusing the `116` baseline summaries at enlarged scale `120` underestimated `32` channels; the worst shortfall was `0.08463239`. A cache key that omits covariance is therefore **Rejected** as reuse authority.

Exact order, view-conditioned footprint and decoded covariance are demonstrated invalidation dimensions. A candidate key binds all three plus renderer/blend/output/block schema, but its sufficiency across anisotropy, backend or device changes is unproven. Reduced-scale accidental conservatism does not license stale reuse.

WebGPU, hardware GPU, Safari/iPhone, real reconstruction, performance and human acceptance remain **Unknown**. Mother adoption is unacknowledged; Canonical Truth and Frozen R1 are unchanged.

Next: isolate an anisotropic covariance orientation change.

