# Lost Property Bureau R02 — street, opposite platform and power court

Independent candidate. R01 commit `74f7925327b4742cfbd6a23a5800c28b07eb1347` is frozen and remains unchanged. Hong Kong 1976; original 1911 entrance inscription and narrative anchors retained.

The public entrance faces the street. A compact railway segment has platforms on both sides; the bureau stands behind the opposite platform, with its side elevation toward the rails. Passengers leave the street end of that platform and approach the bureau along paving, without crossing the running line. Rail luggage exits the other platform end, turns into a restricted rear dock and continues into the existing inspection / lift / archive / retrieval system. Air and sea are origins of road-transferred baggage, not invented adjacent airports or harbours. Their dock approach includes a deterministic wait while the rail cart crosses the junction.

Two boilers have been removed from underneath the main-building offices and placed in a detached rear service court. Coal bay, ash bay, staff approach, maintenance entry, furnace frontage, chimney and flues are physically present. Steam supply, condensate receiver and feed pump are connected by visible pipes. A shared prime-mover clock drives the engine, common shaft, lift pulleys and feed-pump rotor through declared ratios. The moving pipe markers indicate direction, not a steam-fluid simulation. Pressure, power ratings, thermal sizing, structural safety and compliance are not certified or invented.

## Retained originals

Direct imports use original `createRailGeometry` / `wheelRailDatums` from the FH88 `wheel-rail-profile.mjs`, original wood-v3 `createTimberMember`, station geometry compiler, actual A4/KST1 shader factories, original A4 forged rod and crosshead, and static display batching. No imported mesh, photo texture or generated image represents the building. Rail-profile limitations are retained from its original module; this is not historical rail certification.

All coordinates are metres; building dimensions are authoring choices, not a surveyed Yau Ma Ti plot. Street side / track side / service court replace screen-left or geographic compass assumptions. The old Seoul reference is now identified as `seoul_station284` in the handoff manifest, but its dissection contents have not been recovered and no unverified source proportions are claimed.

## Verification

CPU simulation tests cover three real full routes, storage/retrieval, shared phase, pause/reset, repeatability, luggage and approach-cart spacing. Exact generated-triangle collision sampling covers the full 184-second paths at 0.5-second increments, including the new site. The outdoor approach uses the larger cart envelope. This is not continuous swept-volume certification.

Official pinned Playwright/Chromium SwiftShader on GitHub Actions captures actual whole-site exterior, cutaway, hall, machine, rear and power-court views. Desktop and mobile viewport are distinct from a physical phone. Scene rendering does not clamp simulation elapsed time to a per-frame graphics budget. The manual viewer pause remains an observation control, not a story-level all-machine emergency stop.

## Explicitly incomplete

No full train consist, crowd simulation, operational coal/ash logistics, traffic routing beyond this small site, fire-safety engineering, torque/load simulation, local fault/isolator state machine, native SQLite.KaoPu export or general-editor interchange. Visible clerks are function-built static figures. Service paths are authored access routes, not certified evacuation routes. Original institution narrative rules remain in `kaopu-minigame-workbench/lost-found-bureau/FOUNDATION.md`.
