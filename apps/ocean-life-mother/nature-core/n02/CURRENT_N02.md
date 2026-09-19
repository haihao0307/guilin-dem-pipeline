# Ocean Life Mother N02 — visible prototype, 2026-09-19

This round answers the user's request to see and operate a version rather than receive another intake table. Baseline read: 44b236bc7cf0eecaecabd4f10087ce6e1224b9de and NATURE_FIRST_START_HERE.md. Existing R00/R01/R02/R03 and N01 code remain unchanged. No Game Mother or other Mother source branch was modified. N02 is a bounded visible prototype within the original Ocean Life branch, not a separate species-production truth or a new universal KAOPU format.

## Visible implementation

The new entry is `index.html`, with `src/life-core.js` and `src/viewer.js`. Main content totals 34,059 uncompressed UTF-8 bytes at the final local test; this is NOT memory/GPU cost, full legacy content size or proof of arbitrary fish compression.

There are eight independently authored shape/material recipes: gold-blue deep body, banded long snout, silver-blue fusiform, orange-white short body, teal reticulated, blue-yellow forked tail, spotted boxlike body and violet-gold narrow bands. They are experiments, not eight identified species or faithful transformations of the new uploads. Proportions and certain analytic primitives differ; no claim that every numbered shape category is a separately complete anatomy kernel.

The primary view has 24 fish, selectable 16/24/40 counts, six coral objects, sand and underwater attenuation. Single-fish inspection supports camera drag/zoom, recipe selection, an independently selectable colour palette and size variation. Mobile has a collapsible control panel and touch interaction. Coral mode cycles brain-like, layered/table and staghorn-like analytic forms. Fish eyes, a small mouth cavity and fin sheets are visible; the gill crease remains superficial and independent jaw/gill/eye dynamics are not implemented. Fin translucency is NOT completed in N02. Scale-like and fin-ray patterns are authored material functions, not source-atlas textures or observed physical optics.

Fish and coral surfaces are evaluated as implicit functions in the fragment shader. The renderer draws a four-vertex screen-coverage quad per object; those GPU triangles are raster proxies, NOT tessellated fish/coral geometry. Do not claim the GPU uses no triangles at all. No original model, image, rig, full keyframes or R03 source-fit payload is loaded in the main N02 view.

Behaviour is authored: local-neighbour steering (up to six nearest within the searched cells), separation/alignment/cohesion contributions, resident and schooling target paths, observer proximity -> fleeing -> alert -> return. It is not a recovered Boids implementation from the supplied pack and not a measured natural ecology. There is no predation, full food budget, growth calibration or new marine mammal/ray/shark runtime in this N02 slice. N01's narrow yellowfin frequency regression is deliberately not applied to unrelated recipes.

Fish movement checks a conservative whole-object bound against the same analytic sand field used visually, top clearance and conservative coral volumes. Fish-to-fish separation is a steering force, not guaranteed nonpenetration. The bounds tests do not certify continuous arbitrary collision detection. State advances independently of rendering; long frame gaps explicitly pause rather than silently compressing elapsed time.

`原生态 / Bird` opens preserved R02 in a separate iframe and can return to N02. This preserves access, not shared-world integration. Legacy code has different evidence/provenance and must not be included in claims that the entire historic project is source-independent. Legacy public navigation is part of the publication test, but cannot be checked by local script inlining alone.

## Bugs caught and corrected

Initial mobile controls were hidden during automation; the test now opens the actual panel before selecting a palette. Mobile close-ups were too tightly framed; camera distance now accounts for aspect ratio. Fin roots were detached in an early view and were connected to the analytic body profile. Facing/velocity convention was reconciled.

A more important coupling bug was found during final review: the forked-tail expression depended on the active palette. It now takes `forkDepth` only from the structural recipe identity; selecting colour cannot change fish geometry. A source regression checks that the fish geometry function contains no palette input. This test is a targeted code invariant, not an all-shader formal proof.

## Actual local tests

The final local code has eleven passing Node tests. 16, 24 and 40 fish each ran 180 simulated seconds; the conservative habitat invalid-placement count remained zero. The observer scenario recorded 14 fleeing and 11 returning events in the deterministic numerical test; not every fish returned. The largest sampled movement step was 0.0112 m in that test. These are authored-world results, not field observations.

Headed Chromium under Xvfb/SwiftShader executed final WebGL2 code at 1280x900 and 390x844. All eight fish selectors, three coral forms, colour, pause, count reset, camera mouse motion and mobile panel/tap were exercised. Page/WebGL errors and horizontal overflow were zero. After four simulated seconds near an observer and 120 seconds away, both layouts recorded return events and zero habitat invalid placements. Screenshots were actually inspected. The local tests inline the same scripts; they are NOT public HTTP tests.

The visible quality is still simplified/toylike compared with the supplied detailed references. Fine stripes alias, natural head/fin proportions are not established, coral branches and surfaces are coarse, sand is repetitive, and per-species motion remains uncalibrated. Final local software-renderer samples were approximately 2.2-4.4 FPS desktop and 7.9-12.5 FPS mobile-sized viewport. These are not physical-device or production-performance acceptances.

Final tested local SHA256s:
- index.html: 84486739bc39f088587ac7bdeabea17d4fe71e7d459bbbeb1dcbf1b9ebff5b55
- src/life-core.js: c7bedfe0ef462e0bade8eaf6711bbfd661775db098af5963d7e6249f01b4cbab
- src/viewer.js: 9093d0c1ce2de7e6b14a2d7dd51a185519168094d577c35dba2d77a35d0070ee

## New requested references

See `../../reference-intake/batch-20260919d/REFERENCE_REGISTER.json`. Seven newly uploaded files had actual headers/chunks read and 36 embedded images decoded. This round did NOT run their complete source animations or full accessor validation. The two rendered collages support observations about shape families, colour bands, spots and patterns, not measured speed, common topology or wild habitat. The disc-like cluster in the second image is useful for separating appearance variants from body-family hypotheses; not every similar-looking fish is the same species.

The user's Sketchfab URL is Fish Pack 30 - Coral Bay by Mikhail Nesterov, confirmed from its public embed/search metadata. Direct page access returned HTTP403 and the interactive animation was not observed or measured. No access control was bypassed, and no purchased or restricted model was downloaded. Do not state that N02 reproduces this author's model or motion.

## Publication and reproduction

Local runtime and full QA are at `/mnt/data/ocean_visible_n02/`; source/tool files are persisted here. Run `node tools/numerical.cjs` and `xvfb-run -a python tools/browser_qa.py` with Playwright/Chromium installed.

The first remote GitHub Actions run 35430996500 passed installation and ten earlier numerical tests, but raw.githack's actual public entry returned HTTP403 before browser startup. This was recorded as failure, not publication. Follow-up code-only pushes used the same failing CDN until the publishing workflow was changed.

A legitimate alternative is the repository's existing GitHub Pages host. `tools/publish_pages.py` requires passing exact local numeric/browser receipts, copies verified runtime blobs and unchanged R00/R01/R02 legacy trees into a NEW immutable `ocean-life/n02-<sourceSHA-prefix>/` directory on gh-pages, and refuses to overwrite an existing directory. The Pages update is non-forced and rebased on the latest publication head; unrelated sites and source branches are preserved. It does not change Pages configuration. The script requests an ordinary Pages build, waits for exact entry bytes and then the workflow runs `browser_qa.py --public-url ...` on the actual URL, including the legacy iframe.

At the time this handoff is written, Pages publication workflow run 35431387065 (source 041c3800fdbe06c87477b193f1a9e91376352afa) is still running. Do not infer success from this note; only its completed `qa/PUBLICATION_PROOF.json` and actual public browser results can authorize sharing. No guessed URL or downloadable HTML should be offered as a substitute.

## Next work

First complete the visible entry's real public verification. Then use the visible specimen controls for head/mouth, fin-root and tail proportions, material aliasing and meaningful motion improvement against natural observations. Do not expand the recipe count to disguise remaining fidelity problems. Keep received dolphins, whale shark and other sources in the reference queue rather than inventing their finished presence in this version.

visualAcceptance=false; speciesAcceptance=false; naturalMotionAcceptance=false; productionPerformanceAcceptance=false; sharedWorldBirdIntegration=false. Share status is governed by a completed public proof, not these flags or a local screenshot.
