# Stone Money Island shoreline R01 — known limitations

Date: 2026-09-19

This increment adds an executable deterministic shoreline geometry/query core for the first reef-protected wake-up-bay cell. It does not claim a measured reconstruction of Palau.

## Reliable relationships carried forward

- One shared cross-shore elevation function is used by `shoreAt`, `substrateAt`, and `landingAt`; there is no private collision beach or second waterline in this module.
- The profile is continuous, monotone from reef-flat water to upper beach, and keeps the shoreline datum at elevation 0.
- Wet-sand darkening depends on inundation history (`lastInundationTime`) instead of a permanently painted dark strip.
- Material classes remain generic/candidate: white sand, sand/rubble and reef-flat. No biological species is inferred from appearance.

## Candidate expression, not truth

- Control-point distances and elevations are candidate dimensions chosen to create a gentle reef-protected beach profile. They have not been solved from survey data or photogrammetry.
- Porosity, roughness, erodibility, drying time and optical-darkening coefficients are provisional gameplay/visual parameters.
- The default shoreline origin and orientation are local test coordinates only.

## Not completed in this increment

- The renderer in the current V0.2.2 HTML does not yet consume this module, so there is no new visual screenshot or public preview from R01.
- Ocean Mother `surfaceAt` / swash energy and this game shoreline have not yet been wired into one runtime object.
- Player collision, canoe beaching and fish landing in the shipped HTML still use the previous runtime until the next integration step.
- No physical-device or 390×844 browser acceptance was claimed.
- The frozen original Ocean Mother deep-sea/cloud baseline was not modified.

## Next integration gate

Wire this shoreline core into the game build so rendered beach geometry and player contact read the same `shoreAt`/`substrateAt` result, then run desktop and 390×844 browser captures and measure the water/terrain contact gap before changing visual styling.
