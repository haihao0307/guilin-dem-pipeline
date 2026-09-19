# Ocean Life Mother — actual reference intake and bass replay, 2026-09-19

Continue from the latest original branch, not the old R03 checkpoint. This round read head `14cb92c10fbf0e7e08fe6df1e3ab63d2dc340d93`, including CURRENT_STUDY.md, current field-kernel.js and source fitter. All new files in this batch directory are additive. R00/R01/R02, the existing R03 kernels, Game Mother and other Mother branches were not changed. No automation was created or modified.

## Resolved source availability

All seven newly provided GLB files were actually opened and their bytes parsed in this run. They are seven different byte payloads belonging to six source assets, not seven species. The returned black-bass bytes exactly match the original FISH-REF-001 hash. Both tuna files are now present, readable and inspected. The previous already-provided-but-unlocated tuna intake is resolved; do not keep asking the user to resend it.

The earlier blockage concerned executable access to original bytes and R03 coefficients that had not been persisted outside the earlier runtime. It did not mean the user had failed to provide models, or that the source fish lacked textures or animation. In this run the original bytes are available and the bass coefficients were rebuilt. Future runs must verify mounted availability honestly, but must not repeat the old missing-source status without checking this intake.

See REFERENCE_REGISTER.json for exact filenames, hashes, authors, embedded licenses, animation spans and source identities. FISH-REF-001 remains bass; FISH-REF-002 is tuna with two texture exports; FISH-REF-003 is koi; FISH-REF-004 is great hammerhead; FISH-REF-005 is Bream Fish (Dorade Royale); FISH-REF-006 is Guppy female as labelled by its author. These are source identities, not independently accepted Palau species records.

The two tuna exports have equal nodes, meshes, materials, skins and animation definitions and all 603 decoded accessor arrays are exactly equal. Their six image payloads differ: all 1024 square in the 6,137,560-byte export, all 4096 square in the 58,908,280-byte export. Keep both under one reference identity. The higher-resolution export is the appearance reference and the smaller one an offline comparison, not a separate fish species and not a runtime LOD asset. Resolution alone does not establish anatomy or biological fidelity.

## Concrete intake correction

This batch is not compatible with blindly applying the bass-specific importer to every fish.

Koi has zero skin joints but an actual 150-target MorphBake animation. Four timed poses were reconstructed from the source weights and target deltas. Thus absence of bones is not absence of motion; do not throw away its animation or attach the bass rig without a new fitted correspondence.

Bream and guppy use KHR_materials_pbrSpecularGlossiness. The new material observer keeps diffuse, specular F0, glossiness and coverage explicitly separate from metallic-roughness inputs. It does not interpret glossiness as metalness or make up a metallic channel. Neither asset binds a normal texture; this is recorded as an absent source channel, not a broken download. The observer preserves BLEND, MASK and OPAQUE coverage semantics, and the hammerhead eye clearcoat separately. The guppy also has an author-labelled Heart layer; it is not silently deleted as a duplicate surface.

The observer sampled 40,960 source-surface observations across the batch. All 29 images decoded, including palette PNGs. Fourteen executable checks passed. Sampling is level-zero repeat/bilinear reference observation, not a complete glTF renderer. The code rejects unsupported texture transforms/UV sets rather than silently producing a different material.

Normative method sources: glTF 2.0, https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html ; Khronos specular-glossiness extension, https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Archived/KHR_materials_pbrSpecularGlossiness/README.md . These explain material encoding only, not fish ecology. Embedded CC BY-NC metadata is preserved for bass and hammerhead, CC BY metadata for the other four source assets. None of these observations declares commercial clearance.

## Real black-bass path restored

Using the exact pre-existing hash-matched fitter and packing tool, this run rebuilt the nine-patch bass scalar-field payload from the newly supplied original. The current direct-field/domain/geometry-normal kernel then evaluated this real payload, rather than a synthetic test sheet. Generated counts at 15/100/420-pixel plans were 212/4688/80,834 with finite values, zero source-triangle buffers and no intermediate raster. These are disposable samples, not a new stored mesh or an accepted performance target.

Nine thousand independent source-surface samples were checked. Main-patch geometric RMS was 0.0939420% of reference length, but maximum error was 1.0424165%; 60 of its 5,000 held-out samples lay outside the retained discretized domain. Other patch omissions were worse: patch-0-4 retained only 354 of 500 samples. Do not cite only the small average error or treat point coverage as exact omitted surface area. Shape boundaries and high-frequency appearance still need correction.

The regenerated compact JSON is 1,447,908 bytes, gzip 1,017,382 bytes. This is the same source-derived lossy chart-field study, not a finalized small anatomical species recipe. Existing field identity/units/license/necessary-residual boundaries remain. Source UV correspondence is intermediate; no new universal KAOPU format is declared.

Actual regenerated coefficients and the current pinned field kernel were run in real Chromium/SwiftShader at 1280x900 and 390x844. Near/far and rotation controls worked, output pixels were nonempty, page/WebGL errors were zero, and horizontal overflow was absent. This was a minimal internal source-replay renderer, NOT full study-runtime.js, integrated anatomy/motion, complete physical PBR or an iPhone performance test. Screenshots were internally inspected: the provided bass is recognizable, but grain, surfel coverage and edge artifacts remain. Source-static inspection images are not represented as native output.

See QA_RECEIPT.json. One direct browser rerun exceeded a 45-second tool window; the saved portable harness was then executed to completion under xvfb-run with exit code zero. Only completed results count as passing.

## Reproduction and persistence

New intake tools are under tools/. Set OCEAN_REFERENCE_DIR to the directory containing the seven exact filenames and OCEAN_INTAKE_OUTPUT to a new output directory; create its qa directory first. Run audit_glb_batch.py, compare_tuna.py, material_observer.py, then intake_qa.py. Python requirements: NumPy and Pillow.

For a bass replay, use an isolated copy of the existing r03-study tree, retaining its current src and tools. Set KAOPU_SOURCE to the newly supplied bass path and KAOPU_R03_ROOT to that isolated tree. Run existing tools/fit_chart_fields.py, tools/compact_fields.py and tools/heldout_qa.py. Requirements additionally include SciPy and Numba. Set OCEAN_R03_REPLAY_DIR to that tree, then run this batch's tools/replay_bass_kernel.cjs and tools/browser_bass_replay.py. The browser harness needs Playwright and /usr/bin/chromium, with xvfb-run when required by the environment. The source reader remains intentionally locked to the bass hash; do not feed other fish through it by renaming files or removing identity checks.

Actual local outputs this run: /mnt/data/ocean_intake_20260919/ and /mnt/data/ocean_replay_20260919/. Original files are conversation attachments. The regenerated coefficient payload and HTML are not durably uploaded, and their presence is not guaranteed in another runtime. Remote intake code, identity register, replay harnesses and evidence receipts are persisted; this improves replayability but does not replace durable payload storage.

## Next bounded production work

No new user models are needed for the next bass and tuna steps. Finish bass's source-domain and near-view material fidelity first, preserving measured source correspondence; then complete and validate its component/motion bindings and the actual public-workbench path. Use the tuna high-resolution export next to test whether the shared extraction/material/motion process genuinely transfers without rewriting a fish from scratch. Koi tests morph-animation intake and colored/transparent fins; guppy tests multilayer coverage and multiple actions; bream tests broad-body shape and specular-glossiness; hammerhead tests a genuinely different head/body/fin structure. These are engineering roles, not invented ecological classifications.

Sources do not yet establish complete hunting/escape libraries, natural speed calibration, local Palau occurrence, growth histories or seasonal ecology. Those observations can be added later as targeted evidence; lack of them is not an excuse to postpone faithful static shape/material conversion now.

No new R03 public entry was deployed or passed final HTTP/resource/browser navigation gates. Keep shareAllowed=false and do not provide a guessed link, old R02 relabelled as new, or a download instead of a direct online workbench. Preserve old working dependencies.

visualAcceptance=false; motionAcceptance=false; speciesAcceptance=false; gameIntegrationAcceptance=false; productionReady=false; commercialClearance=false.
