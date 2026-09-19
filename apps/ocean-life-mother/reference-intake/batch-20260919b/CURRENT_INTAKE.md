# Ocean Life Mother — batch 20260919B, appearance variants and action references

This is an additive continuation of original branch work/ocean-life-mother-r00-20260918, read at 3ef8b4cb70800e65eea6b75c000a505d2dcd5af2 before work and again before writing. Earlier references, R00/R01/R02/R03, Game Mother and other Mother branches are unchanged. No automation or separate Xiaoma meeting was created or modified.

## What was actually read

All 12 new files were opened from current conversation attachments: Marine Life Fish; CC0 Giant Trevally; Alligator demo; Nile Crocodile Swimming; Juvenile Green Sea Turtle; Animated Crab; Manta Feeding; Manta Swimming; Leopard Catshark; Pseudotropheus Demasoni; Carp; School Of Fish. Total 247,812,836 bytes, 12 unique hashes. All 5,143 accessors were decoded and checked for finite values, and all 32 embedded images decoded. The 12 animation clips across the 11 animated files were each evaluated at four source times. GT has no animation.

Two static source-inspection views per upload were rendered and inspected internally using the original geometry only as observation apparatus. This is not native reconstructed output and not an exact PBR rendering of the author's original scene. Source labels, units and licenses are preserved; filenames and visual resemblance do not independently prove taxonomy, Palau occurrence, life history or natural speed.

## Concrete new findings

### GT is a useful static source, not a completed animated PBR asset

FISH-REF-008 contains 9 meshes, 3 material slots and 3 images, with no skin or animation. All 3 materials declare KHR_materials_unlit. This is important because the previous typed observer rejected unlit and because treating its fallback roughness as measured physical material would be wrong. The new routing adapter preserves unlit colour/alpha and leaves physical reflectance unknown. The colour-chart-like auxiliary object visible beside the fish is tagged as source support, not anatomy. Three material slots do not mean three colour variants or nine meshes nine fish.

### Manta is a source pair with shared information AND important differences

RAY-REF-001 and RAY-REF-002 remain separate source identities linked for action comparison. Base position, index, UV, skin-weight and morph-position arrays are exactly equal, and all three image payloads are byte-identical. Base normals, tangents, morph normals, node definitions and animation channels differ. There are 211 changed or unmatched node/property targets when the two animation target sets are compared by their union. Do not deduplicate the whole asset or infer that they depict the same biological individual.

Each file has a 24-second source clip, 95 unique joint nodes and 3 morph targets. Feeding includes 721 morph-weight keys; swimming has one constant weight key [0,0,1]. This demonstrates why the intake must preserve both morphing and skinning. These exports also have substantial local scale changes in morph data; do not interpret raw morph magnitude as real fin excursion, or combine actions without reconciling coordinate/scale and state semantics. Feeding and swimming are action references, not two colour forms.

### The fish school is an observed group animation, not an autonomous simulator

SCHOOL-REF-001 contains one mesh, 100 morph targets, no skin and one weights channel over about 12.458 seconds. A source-specific partition identified ten contiguous candidate individuals, each with 446 vertices and 674 triangles; no triangle crossed their block boundaries. Seventeen actual source times were evaluated. The relative index arrays differ between blocks, so do not infer shared vertex indexing merely from equal counts. Internal source views show the group and its size differences.

This provides source trajectories, relative arrangement, silhouettes and movement samples. It does not contain a recovered Boids controller, player response, hunger or predator detection. Similar-looking tracks cannot prove which behavioral rule generated them. Keep any fitted behavior a separately validated candidate.

### Other categories are retained without forcing them into a generic fish rig

The juvenile green turtle is a source for a juvenile shell/flipper/eye structure and a swim clip, not a complete growth history. Crab supplies a multi-leg articulated example and shell material. Leopard Catshark combines skin and morph deformation and contributes complex patterns. Demasoni contributes blue/black banding and thin-fin appearance; its helper-labelled cube is not counted as anatomy. Carp contributes scale/color/motion reference. Marine Life Fish is retained under its provided title instead of guessing a specific species. Alligator has Idle and Trot clips; the Nile source has Swim. Neither is automatically admitted as Palau wildlife.

## Colour and variant rules now implemented at intake

The register distinguishes source identity, body-family correspondence, appearance variant, action, described growth stage, individual variation and state-driven colour change. A material slot can belong to an eye, body or transparent coating; it is not automatically a selectable skin. This batch contains zero declared KHR_materials_variants sets. No material-animation pointer or colour-morph data establishing time-varying colour was observed. This does NOT establish that the real species lacks natural colour variants, or that an atlas cannot contain multiple patterns.

`src/reference-routing.js` is a tested additive adapter. It identifies unlit, metallic-roughness and specular-glossiness inputs; keeps material slots and actions separate; validates explicit variant mappings; falls back to the source base material when a valid selected variant has no mapping for a primitive; rejects an unknown variant, duplicate mapping or unsupported/conflicting workflow; preserves source documents; and permits selective source sharing only where all supplied comparisons for that channel agree. Actual raw geometry, textures, weights and animation tracks are not emitted as native assets. It is not a new universal KAOPU file standard, a finished material fitter or a replacement production renderer.

Existing PBR semantics are reused. User-provided colour variants can later bind to the same body recipe with traceable variant identity and evidence. Artist-authored colour experiments remain marked as authored; they must not be relabelled as measured biological change. Source animation duration is stored in seconds, but natural speed in metres per second remains unknown without scale/trajectory evidence.

## License and release boundaries

GT's embedded license is CC0-1.0. Demasoni, Carp and School Of Fish are labelled CC-BY-4.0. Marine Life Fish, Alligator, Turtle, both Mantas and Catshark are labelled CC-BY-NC-4.0. Crab says SKETCHFAB Standard; FREE in its title does not imply CC0. Nile Crocodile says CC-BY-NC-ND-4.0, so adapted output is withheld from public/game delivery unless a different valid permission is established. The CC BY-NC-ND 4.0 public license permits making adaptations for noncommercial purposes but not sharing those adaptations; technical format changes and other legal exceptions must not be confused with blanket permission to publish a reconstructed asset. No commercial clearance is declared in this round.

Primary standards consulted: https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html ; https://raw.githubusercontent.com/KhronosGroup/glTF/main/extensions/2.0/Khronos/KHR_materials_unlit/README.md ; https://raw.githubusercontent.com/KhronosGroup/glTF/main/extensions/2.0/Khronos/KHR_materials_variants/README.md ; https://creativecommons.org/licenses/by-nc-nd/4.0/legalcode . These support encoding/license distinctions, not inferred animal behavior.

## Actual tests, failure corrections and persistence

Thirteen routing tests passed, including the actual 12 source documents and synthetic malformed/variant cases. Ten separate reader checks passed, including a synthetic morph-before-skin transform and the source-specific school partition. Chromium ran the final routing adapter against all twelve documents at 1280x900 and 390x844, with zero page errors and no horizontal overflow; GT's missing action disabled action selection, and Alligator's second clip was selectable. This was an intake interface test and did not invoke WebGL. It is not a new black-bass visual test, actual-device performance result or public-page validation.

Two incorrect assumptions were caught rather than hidden: identical Manta animation target sets were assumed by the first comparator and caused a KeyError; comparing their union corrected that. Identical relative school indices were assumed by a probe and failed; that claim was withdrawn while preserving the verified ten-block source partition. The final routing comparison also requires all relevant primitive channels to agree, not merely one equal channel. See QA_RECEIPT.json.

The reference registry, routing adapter, routing regression script and this receipt/handoff are persisted in the repository. The attempt to write `tools/source_reader.py` was blocked by the tool safety check. It was not retried through alternate encoding, another path or another channel. The full source reader, audit/preview/probe/browser scripts, header inputs and detailed results remain local at `/mnt/data/ocean_batch02_20260919/`; future runtimes must not claim these are durably uploaded or guaranteed to exist. `tools/routing_qa.cjs` needs that observed header set and BATCH_AUDIT.json beside the source tree before it can be replayed. Original references remain user attachments, not production dependencies.

## Current next step

Do not interrupt black-bass/tuna fidelity work to make twelve guessed new animals. The new examples supply targeted input coverage: use the Manta pair for selective shared-body/separate-action evidence, the school for observed individual motion before controller inference, and GT for source-specific static geometry/appearance without fictitious animation. GT still lacks an animation source and physical relighting evidence; those can be supplied later, and do not block the existing bass/tuna work. New biological colour/growth histories require appropriate observations, not another renamed GLB.

This batch is in the reference and intake system, not fully reconstructed in the live game. No R03 public workbench was published, no mature Ocean water was migrated and no native species count was increased. Keep visualAcceptance=false, motionAcceptance=false, productionReady=false and shareAllowed=false. Do not send a guessed preview or an old page relabelled as a new release.
