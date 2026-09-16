# Current Best View — Landscape clipping Y04

Status: **Candidate partial / distribution failure**

The current per-vertex clamp is a useful topology safeguard, but it is the dominant field operator rather than an exceptional fallback. It clips `77.68%` of active vertices and an estimated `74.34%` of active surface area, retains `23.43%` of displacement magnitude and `3.75%` of squared energy, and changes the area-weighted signed mean from `-0.904 mm` to `+2.288 mm`.

The same clamp masks 162,801 periodic defects to zero at stored Float32 precision, making the post-clamp median periodic difference zero while p95 remains `14.91 mm` and the maximum remains `62.27 mm`. Therefore post-clamp median or visual calmness cannot certify a periodic field.

Topology and protected-anchor checks remain **Observation pass**. Distribution preservation is a **Candidate fail**. Periodic closure by clamping is **Rejected**. Physically acceptable mean, derivative, morphology and clipping thresholds, browser/device appearance and collision coupling remain **Unknown**. Production Mother branches, Canonical Truth and Frozen R1 remain **Frozen / unchanged**.

