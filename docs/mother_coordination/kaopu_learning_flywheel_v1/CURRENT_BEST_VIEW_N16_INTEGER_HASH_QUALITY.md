# Current Best View — N16 spatial hash identity boundary

Status: **Candidate partial**

The N14/N15 pair mixer is reproducible across the verified CPU, GLSL ES and native WGSL paths, and N16 found reasonable bounded avalanche and adjacent-cell behavior. That does not make its 32-bit output unique.

On a centered `1024 × 1024` grid, the current mixer produced `144` colliding pairs; concrete distinct coordinates share the same result. The hash must therefore be treated only as a versioned procedural seed or fingerprint. Ordered signed coordinates—or another collision-free composite representation—remain the authoritative Cell identity for state, caches, revisions and serialization.

The newer same-cost upstream constants improved some sampled metrics but slightly worsened another adjacent-bit metric. They remain a comparison candidate, not a replacement. Changing constants would alter all downstream seeds and needs a versioned migration and target visual/device acceptance.

Low-bit histograms, collision-free selected windows and avalanche each test different properties. The negative control had a perfect low-byte histogram and zero collisions in some narrow windows while remaining catastrophically structured. No single metric is a sufficient acceptance gate.

Canonical Truth, Frozen R1 and production branches are unchanged.
