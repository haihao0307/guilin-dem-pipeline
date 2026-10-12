# Native waterfront continuity and integration contract

This is local semantic construction and CPU verification. It is not a rendered-art acceptance or a statement that the planned U-pier is built. No browser, GPU, push, or deployment was run by this restoration task. Existing active field, material and score files are left for the coordinating integration task.

## Source proof

- Source: `terminal-architecture.mjs`, commit `f31df978916876205355664593b0299f027188ad`.
- `waterfront-source-r02.json` is filtered from the independently frozen, actual 8504-child recipe. It contains all 72 waterfront children, not 73: 29 quay, 30 road/sidewalk/markings, and 13 pier children.
- `waterfrontSourceParts()` regenerates those source semantics exactly, including source IDs, literal float values, full surface roles/feature/state metadata, tapered 12-sided bollards, and all 32-sided 4 m piles.
- The original source quayside uses the same geometry-authoring X/Z frame as its terminal. The new long coast and landward road are separate, explicitly authored relocations. No claim of one global source-to-station rotation is made.
- The source fixture is original procedural code data. No reference images, sampled meshes, original private photographs, or planned U-pier geometry are included.

## Authored adaptation

- `stationWaterfrontPlan()` reads the current `STATION_SCORE.site`, with a shared `verticalOffset=-0.25` for the non-pier construction.
- Paved quay: X 48–60, Z -175–26, top -0.18, thickness 0.40 m. The original 1 m ground/wall centre-Z offset is removed to align the shared whole-coast limits.
- Seawall: centre X 59.8, thickness 0.75, top -0.40, height 2.50 m.
- Bollards: 71 over the expanded coast; all 27 original IDs survive, and 44 extra placements are labeled extensions. X 59.3, centre Y 0.25, height 1, radius .11→.09, original 2.8 m pitch.
- Road: X -58–-43, Z -175–26, top -.22, thickness .12 m. Native road material frame is the proper rotation `old(+X,+Y,+Z) -> new(+Z,+Y,-X)`.
- Source station-side sidewalk: X -43–-38.2, same Z limits, top .15, depth .40 m. Its 4.8 m width and station-side relationship are preserved. It is distinct from the existing covered public passenger route at Z 13.
- Paint: 40 source-length 2.5×.12 m strokes at 5 m pitch. All 28 original IDs survive; 12 extensions are explicit. The source's 8 mm paint block had a 3 mm air gap. This known construction defect is corrected: the top rises .4 mm above the road and the ingredient keys .2 mm into it. Paint and road share the road owner. No separate floating rendered shell is used.
- Straight pier: X 60–84, Z 10–16, top .85, thickness .34 m. It overlaps the covered walk in plan at the same top datum, without modifying that walk or broadening its roof.
- All 12 original piles retain their IDs, radius .27 m, 32 sides, and length 4 m. Their X centres are 62, 66, 70, 74, 78, 82; Z centres are 10.7 and 15.3. The source's protruding pile tops are explicitly corrected: top .53, 20 mm inside the .51 m slab underside, centre -1.47, toe -3.47. Piles support the deck without appearing as walking-surface obstacles.
- Total adapted children: 128. No boats, hotel, additional roofing, cargo-pier design, or unbuilt U-pier arms are restored by this module.

## Material and winner contract

`SOURCE_MATERIAL_ROLES` exports each original material role and its binding.

- Paved quay, sidewalk and pier use the existing concrete ID 17 / seed 186.
- Seawall and piles use stone ID 2 / seed 186. The R02 role used KST1 concrete; this R04 stone binding is explicitly declared rather than presented as an unchanged original material.
- Bollards use iron ID 3 / seed 186.
- Road uses ID 18 / seed 186: original A4 `coal` surrogate, color `#68726a`, metalness .05, roughness .92. It is not a validated mature asphalt mother.
- Cream paint uses ID 7 / seed 187: original A4 paint, color `#e5dac0`, metalness 0, roughness .34. Reuse the locked `mt_kn` / `mt_kfb` original-finish closure. No new road noise kernel is needed.

Generate with `stationWaterfrontWGSL({site: STATION_SCORE.site, materialDistance: 'stationWaterfrontPhysicalDistance'})`. Supply the existing `box` and `memberCone` helpers. `StationWaterfrontHit` retains physical `d`, nominal `baseD`, `id`, local `q`, true half `extent`, semantic `member`, `seed`, proper `frame`, road-composite `owner`, and `waterContact`.

The callback MUST evaluate material distance for each actual child before the internal minimum. Convert it to the existing `HitField` using `baseD`, `id`, `q`, `seed`, `extent`, and `member`, then call `stationCandidatePhysicalDistance` with the actual station-local point. Submit the complete union's winning raw record to the shared queue so final shading evaluates the same construction/material owner. Do not apply displacement twice.

Call `completeStationWaterfront(p, skipFloor)`. `skipFloor` omits the four real floor solids and their attached road paint; seawall, bollards and piles remain. Never relabel an acceleration hit: a hit with ID 0 is only a conservative empty-space step, not an actual surface.

`stationWaterfrontWaterContact(member)` recovers sea exposure from the compact outer hit's `sourceSeed` / member index. A value of 1 marks seawall and piles; .35 marks quay pavement, bollards and pier deck. Combine this semantic exposure with the actual station-local point's Y and the shared current waterline/state resolver in BOTH material geometry and shading. These authored exposure weights are not measured salt-damage kinetics. Reading centered child Q.y as water height would be wrong.

## Required acceleration updates

Exported `stationWaterfrontCoverageBounds()` returns nine padded group boxes, suitable for conversion `{name,min,max}` → `{name,lo:min,hi:max}`. These cover the actual old straight-pier restoration, and do not cover the planned U-pier or hotel reservation.

`stationWaterfrontBounds()` with the default 30.01 mm material allowance is:

- min `[-58.03001, -3.50001, -175.03001]`
- max `[84.03001, .88001, 26.03001]`

`stationWaterfrontFloorBounds()` returns four slab bounds. The road box includes its finite cream ingredient. Add these to floor-skipping acceleration; do not skip the new slab solids using the old hall/platform-only set.

The pre-integration `kowloon-train88-r01/field-coverage.mjs` only reaches X 69.5 near the existing walk and Y -1.084 for its narrow quay. It would clip the new pier and underwater support. Replace the obsolete narrow-quay/two-curb entries with generated waterfront group coverage, enlarge the outer envelope as required, and rerun the coverage-source hash audit against the integrated shader. Preserve all unrelated coverage domains.

## Verification

Run `node --test kowloon-station-r04/qa/continuity/waterfront.test.mjs`.

The focused CPU suite checks the independent 72-child fixture, exact original-ID set, all extended placements, coherent offset and material frame, 15 mm nominal quay/sleeper clearance, finite paint connectivity/owner, correct source-role declarations, corrected 12-pile joint, per-child callback order, 3200 randomized material-winner samples, all floor/group enclosures, and absence of unrelated planned geometry. It checks WGSL identifiers and analytic-only generation but does not claim GPU compiler or rendered-image verification.
