# Ocean Life / Fish Mother — Full Reference Materials Index

Date: 2026-09-19  
Purpose: consolidated handoff inventory of user-provided or explicitly linked reference material known to this project.

This is an inventory, not a claim that every source is biologically identified, licensed for production, mounted in every runtime, or already distilled. Raw GLB/JPG/PNG files are not duplicated into this clean GitHub branch. Where a SHA was measured, it is retained below or in the archived intake records.

---

## 1. Primary fish references — first intake

| ID | File / source label | Important observed structure | Production use | Current state |
|---|---|---|---|---|
| FISH-REF-001 | `model_67a_-_largemouth_bass(1).glb` — Largemouth Bass | 2 meshes, 33 source joints, Swim Cycle, 4 large PBR images, transparent fins | First full form/material/motion study; freshwater identity retained | Read and audited; no accepted native fish yet |
| FISH-REF-002 | `tuna_fish.glb` and `tuna_fish (1)(1).glb` — Tuna Fish | Same decoded shape/rig/animation arrays; 1024² and 4096² image exports; separate cornea material | Required second fish after first structural fish is correct; tests shared core transfer | Both variants found and inspected; not yet natively distilled |
| FISH-REF-003 | `koi_fish(1).glb` — Koi Fish | 150 morph targets; morph-weight animation; no skin rig | Morph-based motion, colour regions, fin deformation | Four timed poses were reconstructed in research; no native output |
| FISH-REF-004 | `model_73a_-_great_hammerhead_shark.glb` — Great Hammerhead Shark | Specialised head/body structure, 42 joints, named jaw/gill channels, clearcoat eye | Tests non-generic shark anatomy | Intake checked; native conversion pending |
| FISH-REF-005 | `bream_fish__dorade_royale.glb` — Bream / Dorade Royale | Broad/deep body; specular-glossiness material workflow | Deep-body shape family and alternate material workflow | Intake checked; do not rename as snapper |
| FISH-REF-006 | `guppy(1).glb` — Guppy female | 191 source joints, 2 actions, multiple alpha modes/layers | Thin fins, layered transparency, multi-action input | Intake checked; source joint count is not native target |

Measured identity examples:

- FISH-REF-001 SHA-256: `c1b964b34e80e8534b7801c496576d6a594938d217b4f763b35d04a922b3ee64`
- Tuna 1024 export: `f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0`
- Tuna 4096 export: `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`

---

## 2. Fish, ray, turtle, crustacean and school references — second intake

| ID | File / label | Category | Primary study value | Status / boundary |
|---|---|---|---|---|
| FISH-REF-007 | `marine_life_fish_non-commercial.glb` | fish | long swim clip, spot/colour regions | source title does not provide reliable species identification |
| FISH-REF-008 | `cc0___giant_trevally_caranx_ignobilis.glb` | GT | high-detail static form and colour | no rig/animation; unlit material is not full PBR truth |
| REPTILE-REF-001 | `alligator_-_realistic_3d_model_demo_free.glb` | reptile | idle/trot action comparison | not a Palau native assumption; outside Fish core |
| REPTILE-REF-002 | `nile_crocodile_swimming.glb` | reptile | water-surface body motion observation | outside Fish core; restrictive source boundary recorded |
| TURTLE-REF-001 | `model_72b_-_juvenile_green_sea_turtle.glb` | turtle | juvenile shell, flipper, eye and swim relationship | juvenile only; does not define adult growth |
| CRUSTACEAN-REF-001 | `animated_crab_rigged_free.glb` | crab | multi-leg gait and shell material | “FREE” in title is not CC0; separate Crustacean route |
| RAY-REF-001 | `model_84a_-_manta_ray_feeding.glb` | manta | feeding state; skin + morph targets | pair with swimming source; do not discard morph path |
| RAY-REF-002 | `model_84b_-_manta_ray_swimming.glb` | manta | swimming state; shared base with feeding source | shared evidence plus action-specific differences |
| FISH-REF-009 | `model_91_-_leopard_catshark.glb` | shark | spotted pattern, body motion, skin + morph | not a generic bony-fish rig |
| FISH-REF-010 | `pseudotropheus_demasoni_fish.glb` | fish | blue stripes and thin fins | freshwater/source identity retained; not relabelled as reef species |
| FISH-REF-011 | `carp_fish.glb` | fish | scale/colour regions and basic swim | no natural physical speed inferred from clip |
| SCHOOL-REF-001 | `school_of_fish.glb` | school | 100 morph-target baked group motion | not autonomous schooling or threat/food behavior |

---

## 3. Additional fish and marine references — third intake

One exact duplicate pair was found: `chub_v2_01_baked (1).glb` and `chub_v2_01_baked.glb` are the same payload. Keep one source identity.

| ID | File / label | Category | Primary study value | Status / boundary |
|---|---|---|---|---|
| FISH-REF-012 | `rainbow_trout_-_redband.glb` — Redband Trout | fish | adult/Young meshes, materials and slow/idle/surge action labels | authored adult/Young presentation; not measured growth law |
| SCHOOL-REF-002 | `waltz_of_the_sharks.glb` | shark group | multi-object authored shark scene | not an autonomous predator or school controller |
| FISH-REF-013 | `model_65a_-_longnose_gar.glb` | fish | long-snouted body and swim | source identity retained; not a marine substitution |
| FISH-REF-014 | `鲨鱼018d30c9-2a16-749c-996f-30a900311e08.glb.glb` | shark | swimming, circling, bite source actions | provenance link with FISH-REF-025 requires caution |
| TURTLE-REF-002 | `turtle.glb` | turtle | additional turtle shape/action source | possible link to earlier juvenile turtle source; not cleared as replacement |
| FISH-REF-015 | `blue_powder_tang.glb` | fish | vivid tang body colour and short action | colour atlas contains non-body marks; use UV/body coverage, not entire atlas blindly |
| RAY-REF-003 | `manta_new.glb` | manta | independently sourced manta action | not assumed identical to RAY-REF-001/002 |
| FISH-REF-016 | `chub_v2_01_baked (1).glb` / `chub_v2_01_baked.glb` | fish | chub form/action source | exact duplicate filenames under one identity |
| FISH-REF-017 | `dace.glb` | fish | dace form/action | source identity retained |
| CRUSTACEAN-REF-002 | `temp_04_scaledup.glb` | crayfish/crawfish-labelled source | articulated crustacean reference | generic filename; not silently treated as another fish |
| FISH-REF-018 | `laketrout_v3_03_bakedanimation.glb` | fish | lake trout body/action | freshwater identity retained |
| FISH-REF-019 | `speckleddace_v4_03a.glb` | fish | speckled dace form/action | freshwater identity retained |
| FISH-REF-020 | `redsideshiner_v2.glb` | fish | slender shiner form/action | useful schooling-body comparison; not marine relabelling |
| FISH-REF-021 | `rainbow_trout.glb` | fish | rainbow trout form/action | separate source from Redband reference |
| FISH-REF-022 | `whitefish.glb` | fish | whitefish form/action | freshwater identity retained |
| CRUSTACEAN-REF-003 | `crayfish.glb` | crustacean | crayfish articulation | separate source; compare with `temp_04_scaledup` carefully |
| FISH-REF-023 | `lahontan_cutthroat_trout.glb` | fish | cutthroat trout body/action | freshwater identity retained |
| FISH-REF-024 | `fishe.glb` | fish | generic titled fish form/action | title is not reliable species identification |
| FISH-REF-025 | `swimming_shark.glb` | shark | swimming/circling/bite source actions | common-source evidence with FISH-REF-014; do not choose a label by convenience |

Known source-link findings retained as warnings, not ownership conclusions:

- FISH-REF-014 and FISH-REF-025 share decoded image and source-position evidence.
- TURTLE-REF-002 has partial source overlap with TURTLE-REF-001.

---

## 4. Latest uploaded fish, fish-school and marine-mammal references

| ID | File / label | Category | Basic source structure observed | Current use |
|---|---|---|---|---|
| SCHOOL-REF-003 | `school_of_fish2.glb` — School Of Fish | school | 4 meshes, 148 joints, `swimming`, 18 images | future group-motion questions; not native school AI |
| MARINE-MAMMAL-REF-001 | `model_61a_-_bottlenose_dolphin.glb` | dolphin | 2 meshes, 20 joints, Swim Cycle | separate marine-mammal category; not a fish variant |
| FISH-REF-026 | `model_99a_-_whale_shark.glb` | whale shark | 3 meshes, 39 joints, Swim Cycle | future large shark/body-motion study |
| FISH-REF-027 | `colorfull_fish.glb` | colourful fish source | 8 mesh objects, 2 skins, Take 01, 3 images | object count is not species count |
| MARINE-MAMMAL-REF-002 | `dolphin.glb` | dolphin | 549 source objects, 41 joints, Scene animation | source scene complexity; object count is not animal count |
| FISH-REF-028 | `guppie_animated.glb` | guppy | 1 mesh, 15 joints, `Take 001`, 3 images | fin/colour reference; freshwater identity retained |
| FISH-REF-029 | `discus_3.glb` | discus | 1 mesh, 11 joints, `Take 001`, 2 images | disc-shaped body and colour-family study |

---

## 5. Rendered fish-collection images and web reference

### FISH-COLLECTION-VIS-001

First rendered collage supplied by the user.

Observed categories:

- deep-bodied disc fish;
- long-snouted forms;
- box-like forms;
- spindle-like fish;
- shark/sunfish-like large forms;
- stripes, spots, reticulated fields and broad colour regions.

Use: compare shape families, body proportions, fin positions and material-region organisation.  
Do not infer: exact species list, natural scale, swim speed or common topology.

### FISH-COLLECTION-VIS-002

Second rendered collage supplied by the user.

Important observation: the left cluster shows similar disc-like silhouettes with many distinct colourways. This supports the design question “shared body family versus separate appearance recipe,” but does not prove the fish are the same species or use identical geometry.

### Fish Pack 30 – Coral Bay

URL supplied by the user:

`https://sketchfab.com/3d-models/fish-pack-30-coral-bay-96af1f4364644e1490834e556087ec0c`

Public metadata identified the title `Fish Pack 30 - Coral Bay` and author `Mikhail Nesterov`. Direct page access returned HTTP403 in the managed environment. The interactive animation was not played or measured; no access controls were bypassed and no asset was downloaded through this URL.

Use: a future visual/action observation source when legitimately accessible.  
Do not claim: animation studied, motion distilled or pack imported.

---

## 6. Real Palau / reef / island image references

Known uploaded image categories include:

- steep reef wall covered with coral and sea fans, surrounded by orange/black and silver fish schools;
- broad layered/plate coral reef in Palau deep-blue water;
- dense shallow branching coral field under clear water;
- aerial reef with dark blue holes/pools surrounded by turquoise reef;
- tropical island archipelago with turquoise lagoons, pale reef flats and dark outer water;
- Stone Money Island / Rock Island aerial, beach, lagoon, karst and reef photographs supplied across the project;
- two latest rendered fish collection collages.

These images support habitat, colour, density, scale hierarchy and camera-language observation. They are not direct numerical measurements unless a scale, camera model and observation context are available.

The layered Palau reef image contains a visible photography watermark. It is a visual reference only and must not be redistributed as a project texture or publication asset.

---

## 7. Coral reference files — delegated, not active Fish work

The user supplied Coral-related files including:

- `precious_red_coral_nhmw-zoo-ev-0000149.glb`
- `compact_coral_community_whitsundays_islands.glb`
- `fan_coral_cluster_low.glb`
- `rainbow_haven_reef_-_coral.glb`
- `chromaflare_reef_-_coral.glb`
- `pond_weed.glb`
- Sketchfab decorative reef link supplied in the Coral Mother conversation.

These are not active Fish Mother deliverables. Coral Mother owns coral form/material/growth work. Fish Mother only needs a reviewed shelter/host/collision interface later.

---

## 8. Bird supporting material

Bird remains preserved from R02 and is not part of the immediate Fish rebuild.

Relevant known material includes:

- R60/R61 Grey Heron workflow and workbench sources;
- `BIRD_R60_A0R2_BIRDKEEPER_V07_BODY_PORT_FULL_PROJECT_2026-09-17(1).zip` supplied in the Bird project;
- Grey Heron method Markdown describing separate heron generator, adapter, anatomical evidence and action gates;
- other Bird workbench files and species references in the Bird line.

The important handoff rule is not to route heron through sparrow form/action logic. Bird work remains a separate specialised system and must not be removed while Fish Mother is rebuilt.

---

## 9. Natural-knowledge sources named by the user

The user explicitly requires learning from real nature and high-quality institutional sources, especially:

- NOAA / NOAA Fisheries / NOAA Ocean Exploration;
- National Geographic, including Pristine Seas;
- PICRC and Palau-related institutional sources;
- real underwater, aerial and animal-motion footage supplied later;
- primary research when physical speed, frequency, growth or action parameters are needed.

Use these sources to replace temporary asset-specific assumptions. Keep source condition, species, life stage, body length, environment and uncertainty.

---

## 10. Duplicate, variant and data-type rules

1. Two files are not two species merely because filenames differ.
2. Texture-resolution exports are one identity unless form/action data differ.
3. Several meshes are not several species.
4. Several materials are not several colour morphs unless a real variant relationship is established.
5. No skeleton does not mean no animation; koi uses morph targets.
6. Many source joints do not mandate many native joints.
7. A baked school clip is not autonomous schooling.
8. Freshwater references remain freshwater references; use them to learn general form/motion only.
9. A colour collage does not provide real speed, scale or growth.
10. Raw assets remain reference inputs, not final Fish Mother runtime dependencies.

---

## 11. Availability boundary

The project has recorded filenames, labels, hashes and parsed metadata for many uploads. That does not guarantee every future tool runtime automatically mounts the raw attachment bytes. Before re-reading a GLB, verify that the exact file and SHA are available. Do not claim a missing file was never supplied; distinguish:

- user supplied it;
- it was previously parsed;
- its raw bytes are currently mounted;
- its derived output is durably stored;
- it has passed native Fish Mother acceptance.

Those are five separate states.
