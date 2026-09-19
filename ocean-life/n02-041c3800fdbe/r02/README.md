# Ocean Life Mother R02 — tropical-island ecological workbench

2026-09-18. Continues the existing Ocean Life R01 baseline at commit `2df9c743434ea18502050710a4107697971f9100`. No R00/R01 files or Game Mother branch have been replaced. This is a functional ecological candidate, NOT a species-complete, calibrated or production-approved island.

## What is running

An 80 x 96 metre synthetic land-and-water test domain replaces the small shore test patch. This is the whole experimental domain, not 7,680 square metres of dry island or measured Stone Money Island geography. The island, lagoon, reef crest, navigable channel and outer slope have different space. The seabed renderer and constraint sampler share the same triangulated heightfield. Water remains the R01 module with authored depth attenuation, small caustic variation and inner/outer wave exposure; Ocean Mother R018's mature rendering has NOT been ported.

Three independently configured ecological roles run using the existing native generic fish carrier: resident reef fish, schooling forage fish and predators. Default 32 slots; controls allow up to 48. They are NOT named clownfish, sardines, tuna or GT assets. Actors differ in body size, travel speed, acceleration, turn limit, home, danger response and diet eligibility. The assembly uses 24 cached native poses with smooth GPU interpolation and per-actor speed-driven phase; the original isolated fish generator/editor and native/reference-study controls remain available.

Residents react to the player-proximity probe and return gradually after a calm period. Bait fish school and evade approaching predators. Predators select compatible prey by role, size and line of sight, pursue with movement constraints and require a mouth-sweep contact to consume an animal. Consumed fish disappear from the live population; they do not instantly respawn. This is NOT yet a closed food web: plankton, algae, benthic prey, recruitment and complete energy/resource budgets are still absent.

A defect discovered in testing caused predators to stall at the shallow crest without penetrating it. Forward routing now scans the entire prospective footprint and selects a traversable direction, rather than accepting only an endpoint. Full rendered-body checks also include the conservative colony collision volumes. These tests do not certify arbitrary terrain, dynamic obstacles, inter-fish collision or all unsupported settings.

Six coral colonies use branching, table and massive growth-form studies. Table/massive surfaces are independently generated; the inherited branching generator is retained. Generated colony dimensions are fitted to conservative collision volumes. They are not six identified species, and brain folds, coral cups and real physiological dynamics are not complete. A coral shelter is not automatically a compatible anemonefish host; host anemones remain a separate pending requirement.

The original H5B grey-heron carrier and ground idle/walking remain. Shore placement and altitude guards were adapted to the enlarged terrain. Air flight remains an unaccepted coarse study; no new bird species is claimed. The scene remains visually sparse, the island lacks finished vegetation, and flying-bird anatomy/naturalness are still outstanding.

## Direct interaction

Open `index.html` through the published HTTPS preview. The user is not required to download or unpack an HTML file. Quick views: `礁边看鱼`, `通道鱼群`, `看鸟`, `全岛`. In the expanded control panel, use `玩家接近`, `玩家离开`, `记入观察簿` and `导出观察簿`.

The notebook records nearby, in-frustum, terrain/coral-line-of-sight-visible simulated fish, their behavior, location, depth, demonstration time and tide. It does not identify a generic carrier as a real species. Notes are in memory with explicit JSON export; persistent Game Mother save integration is NOT yet implemented. The clock and tide controls are authored demonstration states: the +/-0.30 m, 180-second tide is deliberately compressed and is not a Palau tide prediction. No sardine migration months were invented.

## Reference and ecological register

`ECOLOGY_REGISTER.json` stores 21 role/candidate/group entries. This count is NOT 21 finished species. Manta, eagle ray, turtles, local seabirds, bats, additional snapper and tuna identities are pending asset and species work. Manta's filter-feeding role is kept distinct from eagle-ray benthic foraging and generic predator pursuit. Conditional reef/channel access is allowed as a future species-specific route; tuna is not categorically excluded from entering a reef system.

`FISH-REF-001` remains the actual uploaded largemouth bass file, source identity, embedded CC-BY-NC-4.0 and SHA256 preserved. No freshwater reference has been relabeled as a real marine taxon. The user's previously sent tuna reference is recorded as already sent according to the user, but its binary was not located in the accessible File Library, personal-context records and GitHub default-branch search. This is a retrieval gap, not a claim that the user never provided it. No fictitious reference number or completed distillation is assigned to an unseen asset.

`PLANT_INTAKE.md` is the requested plant-integration table. Local Dracaena multiflora field records correct the earlier overly broad doubt about dragon trees in Palau, but they do not identify the user's specific plant or establish every candidate's native status. The literal unresolved name “白杨垂” is preserved. “Palau squirrels” remains an unverified lead, not a claim of absence and not an accepted resident fauna item. No new placeholder trees are represented as finished Plant Mother assets.

Sources in the register distinguish field observations, regional background and authored gameplay. Modern field surveys do not establish exact 1944 species abundances or seasons. Reef shelter does not mean all Palau shores are always free of large storm waves.

## Game Mother interface boundary

`OceanLifeR02` exposes environmental sampling, inspection, observer stimulus, ecological events and observation records. The inherited R01 `.kaopu` fish recipe reader/writer still round-trips (default recipe 1079 bytes, shared runtime excluded). This is not a finalized universal KAOPU ecosystem file format.

`pollNarrative` produces a fictional companion-rescue opportunity only after day 90, storm aftermath and a safe shelter, and rejects an already owned companion or persisted `cat-drift-once` completion key. It has a per-runtime one-shot guard. It does NOT spawn a cat, implement a complete rescue scene or prove cats naturally migrate across the sea during typhoons.

Notebook/pencil, knife, lighter, first aid, fishing hooks and a broken communication device are recorded as the user's inventory design. No live inventory or Game Mother production branch was changed. Vegetation assets need species/source identity, generator version, a metre/Y-up frame, root anchors, collision/traversal bounds, wind deformation and level-of-detail budgets before assembly.

## Verification and limits

See `QA_RECEIPT.json`. A 60-second, 3600-step test starts with 48 fish and samples 5481 full-body poses at the tested native deformation and wave amplitude. It recorded 3 contact captures, 3 returns, zero bed/surface penetration samples, zero colony-vertex hits and zero invalid placements. It is not a full tide-cycle or universal continuous collision proof.

Chromium/Xvfb/SwiftShader checks cover 1440x1000, 1024x768 and 390x844 and all five editor modes. No JavaScript/WebGL errors or horizontal overflow were observed. Pause, animation time, proximity response, return, night shelter and notebook recording were exercised. Mobile-sized viewport testing is not an actual iPhone test. Software-renderer samples included about 4.7 FPS on the largest layout, so production performance is NOT accepted.

All five remote source blob hashes match the local tested files. The exact online loader was executed against those verified local resources and recreated the final HTML byte-for-byte. Final artifact SHA256: `f7add64e87472cea02c38fcbf9c2b89b55626f67ad3f5c13e6430d812defe965`. A final 390x844 smoke test of that exact artifact also passes. Public browser navigation is blocked by the managed environment (`ERR_BLOCKED_BY_ADMINISTRATOR`); none of the local loader or set_content tests is described as an end-to-end public-navigation acceptance.

`visualAcceptance=false`; `speciesAcceptance=false`; `behaviorFidelity=false`; `ecosystemBalance=false`; `siteCalibration=false`; `gameIntegrationAcceptance=false`; `productionReady=false`.
