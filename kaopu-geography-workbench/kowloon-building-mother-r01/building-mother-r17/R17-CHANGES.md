# R17: retained internal system and recessed opening inspection

R16 remains unchanged. This is not a claim of a surveyed whole-building interior.

- The original grey-backed inspection now uses two camera-relative, unequal-height cool/warm directional lights. The semantic-color control is hidden; semantic identities remain.
- 176 evidence-based candidate openings on six KCC source faces retain the R0/R180 registration ambiguity and original floor elevations. Shared apertures now carry recessed joinery, reveal thickness and a sill. Their 0.26 m wall depth, 0.08 m frame setback and sill dimensions are design candidates, not measurements.
- Original KCC controller and original 28 above-ground design stops remain. The journey calls the existing controller, boards only at unlocked/open leveled doors, rides, then exits before advancing its arrived-floor state. B1 is not invented as a served stop. P01/P04/T24 are design ordinals, not a verified correspondence with real floor names.
- The retained tower-floor six-wing partitions already had physical door holes. Those holes now receive 144 shared function-derived door instances, with paint-color parameters. They do not turn the old design partitions into the observed A–F real apartment plan. Podium uses are not relabeled bedrooms.
- Room routes test supported floor and a sampled body envelope against the retained partition/door geometry; these are model checks, not fire/accessibility certification. Explicit camera bookmarks are labeled bookmarks, not continuous walking.
- KCC retains the original source shell during authored-interior inspection, rather than exposing an artificial grey void beyond the design partition. Its unreconstructed finite faces are still not a claim of surveyed wall thickness. This is not a demonstrated continuous route through the surveyed street entrance.

## Actual construction sequence

`growBuilding(seed, parameters)` still constructs the per-building model. `attachKccUnitDoors(model, {reservedInstanceIds})` equips its already-generated partition holes before scene composition. The global instance reservation is necessary because the renderer's shared aperture slots are scene-wide. `prepareBuildingLifts(entries)` reuses the original lift rules; `composeBuildingScene(...)` only applies the existing comparison translations. No original building height is scaled.

## Performance boundary

A conservative aperture-neighbor index replaces a per-hit all-aperture coverage scan only inside a verified query domain; otherwise it falls back to the original scan. Native resolution, Float32 attachments and all geometry remain. Node equivalence is not browser performance evidence. Actual browser native-pixel comparison and timed frames are required before describing responsiveness.
