# R09R4 preservation / recovery note

The final Tuna work in the requested 17:00–18:00 window is R09R4, committed at 17:38:45 UTC+08:00 as `17d6290844e258af7592bf65bcff5b1e576cc0a6`.

The GitHub-preserved state is internally consistent and includes the reproducible high-dimensional builder, QA, tests, shape gate and primary-shape metadata.

Two artifacts were never committed at the time and therefore cannot be truthfully claimed as recovered from GitHub:

1. `candidate.html`
   - 1,577,730 bytes
   - SHA-256: `c4e4fea4c0dd031bc7c8ca383d604ad3d062f504aeea1047ee965157e14bddf2`

2. FISH-REF-002 source GLBs
   - low-resolution geometry/rig/motion source: 6,137,560 bytes, SHA-256 `f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0`
   - high-resolution appearance source: 58,908,280 bytes, SHA-256 `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`

The source-cache ledger says both source binaries were locally verified but pending Git LFS ingest. The R09R4 runtime itself does not depend on those source GLBs.

Continuation rule: do not backfill these gaps with the rejected R02–R10 low-dimensional tuna lineage or a different fish model.
