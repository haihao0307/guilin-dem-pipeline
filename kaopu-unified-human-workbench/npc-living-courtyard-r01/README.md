# 街角日常 · KAOPU Living Courtyard R01

Two complete native HUMAN-INTEGRATED-R07 people inhabit an original interactive courtyard. Decisions depend on current needs, personal preferences, opportunity and distance. A seeded choice is made among plausible candidates; this is not a fixed animation playlist.

## Source

- Canonical repository: `haihao0307/guilin-dem-pipeline`
- Canonical main read: `5543f756ca3af1428323696324303fa70b8de850`
- Native R07 HTML SHA256: `d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a`
- Native adult identities: `r02-adult-male-tall-slim` / P01 and `r02-adult-male-short-heavy` / P02.
- Native actor snapshot/binding source: `npc-life-observation-r01` at `85718686d88585a449c3add050a089c45eee1207`.
- Source HTML is retained verbatim. The adaptation exposes the same native Three r170 constructors and preserves the complete generated geometry, 104 bones, full CSR skin weights, skin materials and eye assets.
- Cannon-es 0.20.0 retains its license under `vendor/`.

## Running and building

`node src/life-tests.mjs` runs renderer-independent semantic tests. Their acknowledgements are test fixtures and do not prove visual contact.

`node build.cjs` verifies the locked source and dependency hashes, checks every resulting inline script, bundles the authored modules and emits `dist/index.html`. Native compressed packets are copied to `dist/assets/` and are fetched from the same origin, retaining their original checksums. The R07 face detail/chroma PNGs are embedded as exact original bytes in both builds, with their original texture settings and attribution retained. Their pinned source URLs, sizes, image dimensions and SHA-256 values are recorded in `native-face-assets.json`; the delivered runtime needs no remote texture download.

`node build.cjs --offline` additionally embeds the verified native packet cache into one HTML. Its actual `file://` startup, interaction and zero-network verification must be recorded separately; creating the file or serving it through HTTP does not certify offline operation.

## Simulation and execution

`LifeSimulation` controls choices, needs, navigation, reservations and atomic ownership/currency transactions. `NativeMotion` moves each existing skeleton without changing bone lengths. `ItemWorld` checks actual visible hand points and rigid-body state. Inventory and money change only after an execution receipt for the current task token. Stale or duplicate receipts are rejected.

The original courtyard includes seating, a self-service bakery and recycling cabinet. Both people can rest, collect bottles, exchange them, buy and eat bread, walk and seek shelter. Controls can add a bottle, close the shop, change the weather, interrupt an activity or alter needs. All state is local to this page; reload/reset starts a fresh simulation.

## Scope of this prototype

The clothing is a skeleton-driven surface layer, not a cloth simulation. Locomotion and posture use procedural IK. Object grasping is assisted with finite-force constraints; no claim is made for complete finger friction, full-body contact physics, cloth collision or production readiness. The root and independent review must distinguish source/logic checks from actual browser observations. User visual acceptance remains pending.
