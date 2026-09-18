# Farmland Mother R045.24 — carrier-coupled nested receiving plain

Status: fixed round, numeric QA pass, browser startup pass, fixed-view evidence generated, visual acceptance still **false**.

## What changed

R045.23 had already broken the footslope/plain contact away from one simple horizontal boundary, but the lower receiving plain still behaved visually as one broad, weakly structured slab. The wrong next move would have been either (a) increasing the R23 toe amplitude or (b) adding arbitrary decorative lobes. Both would change appearance without explaining why each mass belongs where it does.

R045.24 therefore derives three unequal lower receiving bays from the three inherited outlet carriers. Each bay is expressed in carrier-local coordinates and has independent width expansion, signed lateral bend, depth, outer shoulders and one smaller nested hollow. The new terrain field is active only in the lower receiving band and fades in/out smoothly. It does **not** add waterways, terrace benches, parcels or active-water claims.

Inherited planimetric hydrology is unchanged: 22 nodes, 55 edges, 12 terrain drainage carriers and 3 outlet carriers. The inherited receiver river and sampled drainage-axis cores are unchanged.

## Evidence read before implementation

- Xiaoma/TLO DEM intake boundary was reread. The existing 12.5 m canonical DEM cannot supply actual field boundaries, bund/channel cross-sections, control elevations or centimetre-scale water state. Regional/field structural truth remains unavailable until the selected field and survey evidence exist.
- The saved MrRolord frame audit was reread. The reusable ordering retained here is river hierarchy -> cumulative distance / terrain -> land use. Blender-specific implementation details and dimensions were not copied as field truth.
- User reference `image(173).png` was reread only for unequal, winding, nested hillside occupation and non-uniform contour hierarchy. No terrace width, riser height, ditch section or water depth was inferred from the photograph.

## Failure caught inside this round

The first R045.24 implementation passed the initial 31 numeric gates, but that pass was insufficient: the final signed relief contained almost no surviving positive shoulder mass. Positive mass was only about 0.0318 versus about 128.93 negative mass, meaning the code claimed outer shoulders while the broad hollow numerically cancelled them.

That was a QA/design error, not a success. The kernel was changed so the outer shoulders sit outside the broad receiving hollow, and QA gained a new `receiving_shoulders_survive_signed_relief` gate. The final run therefore has 32 gates rather than silently accepting the original 31-gate result.

## Final numeric QA

Final result: **32/32 pass**.

- Maximum added receiving-plain delta: about **0.3985 m**.
- Mean absolute delta over 1,998 sampled lower-plain points: about **0.04979 m**.
- Core-band mean absolute delta: about **0.06780 m**.
- Maximum change in the added field over 4 m longitudinally: about **0.10284 m**.
- Positive shoulder mass / negative receiving-hollow mass: about **0.12765**, so shoulders now survive the signed relief while hollows remain dominant.
- Three carrier components have distinct centroids; minimum pairwise centroid separation is about **102.20 m**.
- Individual component peaks are about **0.207 / 0.243 / 0.233 m**.
- Worst 4 m uphill rise in the inherited R23 review band was about **0.30973 m**; final R24 is about **0.31403 m**, so the new planform did not create a new wall-scale rise.
- Sampled change within 10 m of inherited drainage axes: **0**.
- Sampled change in the inherited upper work: **0**.
- Sampled change around the foreground receiver river: **0**.
- Sampled change outside the R24 receiving support: **0**.
- Near-drainage future terrace permission mean remains **0**; far-drainage candidate mean remains about **0.68143**. Terrace geometry is still locked.

## Browser and fixed-view QA

Final GitHub Actions QA run completed successfully. Real `/usr/bin/google-chrome` startup, DOM dump, `data-ready=true` marker and fixed-view screenshot all passed. The full fixed-view PNG exists and is about **566,522 bytes**. A portable downsample was also generated only so the automation can inspect the rendered evidence without treating log text as visual review.

Visual review of the fixed-view A/B transport shows no catastrophic seam, new wall or broken receiver transition. The bottom delta planform reads as three unequal receiving hollows with surviving shoulder bands rather than one uniform flat fill. However, the perspective A/B difference is still too subtle at whole-scene scale: the lower plain continues to read mainly as a broad smooth surface, and the hierarchy between receiving bays, footslope masses and the larger agricultural face is not strong enough to justify terrace generation.

Therefore `visualAcceptance=false` remains correct. R045.24 is a substantive substrate improvement, not a visual-completion claim.

## Evidence boundary / real-world constraint

All R045.24 bay widths, swings and sub-metre elevation changes are synthetic generation parameters. They must not be described as surveyed Yunnan receiving-bay geometry, measured terrace dimensions, measured bund/channel sections, active irrigation connectivity, water depth, discharge, control elevation, soil/sediment properties, cadastral boundaries or regional terrace dimensions.

The practical blocker is still missing field-scale survey truth: actual selected-field microtopography, bund/channel sections, control elevations and observed water operation. A normal implementation team cannot convert a 12.5 m macro DEM plus photographs into those quantities quickly without introducing invented geometry.

## Locked state after R045.24

- `visualAcceptance=false`
- `terraceGeometryEnabled=false`
- `terracePilotPreviewEnabled=false`
- `parcelGenerationEnabled=false`
- `waterStateKnown=false`
- `productionReady=false`

No public HTTPS workbench is claimed. Only the Runner-local page has been verified as actually opening.

## Next blocker

Remain in the second priority stage: one-sided agricultural slope + footslope plain. The next useful change is not more amplitude and not terrace stripes; it is to make the three receiving bays visibly alter the larger lower-plain planform at whole-scene scale while preserving the now-passing carrier protection and continuity gates. Terrace bench/riser work should remain locked until that macro relation is visually readable without overlays.
