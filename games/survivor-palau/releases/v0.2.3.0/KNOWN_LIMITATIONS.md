# Wake-up-bay shoreline R01 — known limitations

This increment is deliberately bounded to the first Stone Money Island wake-up-bay cell.

- The cross-shore knot elevations, slopes, angular span and 24–40 m class of bay extent are **candidate expression**, not surveyed Palau bathymetry or beach-profile truth.
- Reliable relationship implemented here: one continuous field drives the rendered terrain sampling path and the player-contact/ground path in the game runtime; the mean-water contact is solved from the same profile rather than by moving sea level to hide terrain error.
- The existing frozen Ocean Mother sea/cloud/shader-and-worker text is not edited. The CPU near-shore water query sees the patched `bedHeight`; the frozen GPU Ocean shader still retains its inherited internal bathymetry function. Therefore exact wave shoaling/foam equivalence at the new beach profile is **not yet claimed**.
- `shoreAt.outwardNormal` and tangent use the local radial frame of the inherited island boundary. This is sufficient for the bounded wake-up-bay cell but is not yet a curvature-exact normal for every irregular coastline point.
- Wet-sand optical memory, swash foam transport, intertidal biology, canoe beaching and fish landing are downstream consumers and are not promoted by this increment.
- Desktop/mobile browser screenshots are QA evidence only. They do not constitute physical-device testing or user visual acceptance.
- No LOD system, imported replacement mesh, raster terrain image, external model or new persistent image asset is introduced.

Acceptance remains false for `visualAcceptance`, `physicalDeviceTest` and `productionReady` until the corresponding gates are actually passed.
