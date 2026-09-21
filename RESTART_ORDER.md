# Restart order — Fish Mother / Yellowfin R006

Do not redesign the system.

Do not restart from largemouth bass, generic Original Fish, N02, low-dimensional Tuna, or the rejected R003 generated fish.

## Immediate sequence

1. Treat this handoff branch as the only restart baseline.
2. Check the user's temporary/cache/coach repository or newly supplied asset for the Tuna model.
3. If a GLB is available, verify SHA-256:
   - `f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0`
   - `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`
4. If it matches, run:
   `yellowfin-study-r006/tools/ingest_exact_source.py`
5. Run/inspect the generated evidence package and close the remaining source-copy gates.
6. Start `YELLOWFIN-SOURCE-COPY-R001`: copy the locked source first; no creative improvement during this pass.
7. Only after Source Copy passes, open a separate Yellowfin species-correction/improvement phase.

## Do not loop

If the exact binary is not immediately visible, do not spend another cycle producing more model-recovery plans, gates, or meta-documents. Work from the temporary/cache source the user provides in the restarted conversation.
