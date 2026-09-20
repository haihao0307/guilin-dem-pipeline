# Ocean Life / Fish Mother — Tuna R09R4 clean handoff

This branch is the clean continuation package for the Tuna R09R4 work completed on 2026-09-20.

Canonical production source:
- repository: haihao0307/guilin-dem-pipeline
- source branch: work/original-fish-r08-tuna-hifi-restart-20260920
- source commit: 17d6290844e258af7592bf65bcff5b1e576cc0a6
- commit time: 2026-09-20T09:38:45Z (17:38:45 UTC+08:00)

Use `apps/ocean-life-mother/original-fish/r08/r09r4/` as the current Tuna baseline.

Do not revive the rejected low-dimensional Tuna R02–R10 body-parameter lineage. R09R4 is the high-dimensional restart lineage.

What is preserved here:
- R08 restart contract, benchmark summaries, QA and tests;
- Tuna R09R4 primary-shape data, QA, fixed-view gate, 3A quality gate, tests and reproducible builder;
- clean Fish Mother handoff documents from 2026-09-19;
- FISH-REF-002 reference-cache metadata and audit ledger.

Known preservation gap:
- the locally generated self-contained `candidate.html` was never committed to GitHub. The release manifest records 1,577,730 bytes and SHA-256 `c4e4fea4c0dd031bc7c8ca383d604ad3d062f504aeea1047ee965157e14bddf2`;
- the reference GLB binaries were locally verified but remained pending Git LFS ingest. Their hashes and sizes are preserved under `reference-cache/`.

Therefore this package is the complete GitHub-preserved R09R4 source/reproduction handoff, not a claim that the lost local-only HTML payload has been recovered.
