# Ocean Life / Fish Mother — Yellowfin full handoff R006

Date: 2026-09-21

This is the clean full handoff for restarting the Fish Mother / Yellowfin line in a new conversation.

## Start here

1. Read `CURRENT_BASELINE.json`.
2. Read `RESTART_ORDER.md`.
3. Open `apps/ocean-life-mother/fish-mother/yellowfin-study/index.html`.
4. Continue from R006. Do not restart the generic-fish / low-dimensional line.

## Current line

- Ocean Life Mother → Fish Mother
- species target: Yellowfin tuna / `Thunnus albacares`
- locked copy target: `FISH-REF-002` / GoldenZtuff Tuna Fish
- active study state: R006 source-copy laboratory toolchain ready
- next allowed build: `YELLOWFIN-SOURCE-COPY-R001`
- generation remains locked until the source-copy gate is satisfied.

## Important

Do **not** fall into the old loop of repeatedly searching for the model and building more planning infrastructure.

The exact GLB was previously verified locally and its hashes are preserved. The user has indicated that a temporary/cache repository already contains the relevant material. In the restarted conversation, use the user's available temporary/cache source first. If an exact model is presented, verify its SHA and immediately run the R006 ingest/extractor toolchain.

This handoff preserves R07 source audit, R08/R09R4 high-dimensional restart evidence, all Yellowfin study R001-R006 artifacts, tools/tests, the locked Source Copy scaffold, Reference Cache metadata, and the earlier Fish Mother clean handoff.
