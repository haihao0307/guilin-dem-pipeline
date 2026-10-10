# Native plants R01 — independent train candidate

Frozen world source: R20 fdbc36e17a34c21c14cc9566a533bb080e3dacc2. The R19 accepted preview and R20 candidate are unchanged. This new entry has separate save, quality and camera storage keys.

Four original KAOPU Pandanus plants are connected to the actual world: -34m (first station footprint), 24m, 365m, 666m of the bounded 700 scene-metre first leg. They are not banana or banyan substitutes. Every folded/toothed 28×5 leaf, branch, stilt root, scar and fruit formula and material is preserved from mobile-r05-seasons/runtime-pandanus-r05.js. No photographic textures, baked meshes, billboard leaves or ball-tree proxies are introduced. The source is a research-quality plant generator, not a scanned specimen or final AAA certification.

The source's engineering units are metres. Every model scale is 1. Trunk bases are at ground y=.081; original below-ground roots remain below ground. Plant crown tops are approximately4.74/4.39/7.05/4.70m relative to trunk base. Four plants total162,250 expanded triangles and857,228 bytes of geometry/instance buffers; at most two plants are distance-active within the tested first leg. Actual drawn cost includes camera culling, instancing and shadow passes and is measured separately.

Wind is the source's .008/.013 radian rosette motion at1.1/1.35 radians/second, driven solely by Session elapsed seconds. Pausing the host freezes it. No own animation timer, source page, renderer or authoring UI is embedded. Static tube/scar batching changes submission, not geometry or materials.

`plants/segment.mjs` owns four placements. `plants/pandanus.mjs` owns the extracted source. `plants/*.test.mjs` checks exact source equivalence, geometry, ground/rail/platform/building/camera clearance, host time and disposal. The source comparison requires PANDANUS_REFERENCE_SOURCE pointing to the original source file. `plants/browser-comparison.cjs` captures actual WebGL at identical explicit poses and fixed time against frozen R20; those are labelled fixtures. `tests/r20-native-browser.cjs` separately drives the production clock and real controls from first station through the second.

The comparison budget is declared before running: synchronized software-frame median <=1.45× R20, median CPU update added <=1ms, no errors. Software SwiftShader timings are not hardware or phone FPS. Publication requires actual images and those tests to be reviewed, not only construction success.

## Inherited R20 implementation notes

# R20 street-character candidate

Independent descendant of accepted R19 commit `7b8d8908c6539e52d5336470111be6219ffc1ea7`. R19 remains the accepted performance baseline. This directory is an unmerged candidate until its actual render and cost evidence is reviewed.

## Implemented scope

- First 700 **scene metres**, 37 parcels /74 buildings. The timetable's4.4km is a historical-reference display, not the generated geographic length.
- Existing metre-scale2-8-0-inspired locomotive/tender, two coaches, adults, rail gauge, Session physics/time, doors/audio/smoke and observer corridor preserved.
- KST1 `kaopu.street.architecture` Instrument **1.2.0**, exact Score/Instrument version match. This is the existing documented architecture extension, not a renamed mesh format or an invented universal parser.
- Five structural families: brick shophouse, timber verandah, recessed plaster bays, masonry pilasters, enclosed balcony/ribbon windows. Editable roof/window/balcony parameters alter actual openings, framing and silhouette; they are not random paint switches.
-148 separately registered fictional tenant names and148 distinct brand prefixes, assigned once per bay. A business repeats its own title on its own fascia/sideboard; separate businesses never share its identity. Four native licensed font proxies and four sign constructions. This is not historical brand reproduction.
- Material masks reuse existing procedural noise fields: localized return-wall damp patches, sill/ledge runoff, moisture at low edges and per-bay repair ownership. No extra fractal-octave stack. Dark staining is a visual candidate, not a microbiological diagnosis.
- First two station nameboards use native glyph curves, geometrical frames and two properly facing surfaces. Kowloon white framed/black-footed posts follow visible family relationships in the supplied image; Yau Ma Ti suspended installation is an original interpretation. No original Yau Ma Ti sign photo has been confirmed.

## Editable files and runtime boundary

`street/route.score.json`: bounded span, seed, rail/camera envelopes, streaming budgets, facade/roof/sign sequences, palettes and maintenance/density ranges.
`street/route-plan.mjs`: deterministic parcel function resolving construction parameters.
`street/street-identities.mjs`:148 unique tenant registry and finite font/style assignments.
`street/architecture.mjs`: function-built parts, shared primitives and LOD rules.
`street/materials.mjs`: procedural surface masks.
`station-nameboard.mjs`: compact original two-station board rules.

Native glyph geometry is shared per font/character and planar/extruded construction; sign size and relief depth are mesh transforms. A24MB idle CPU-cache target protects referenced/prefetched glyphs and evicts only idle least-recently-used entries. Transient allocation and active-owner bytes are reported separately.

No street mesh or image-texture file is loaded. BufferGeometry, glyph tessellation, instance matrices and procedural/Canvas station surfaces are produced at runtime. They have real CPU/GPU costs; small score bytes alone do not prove performance. Shared Three r170 and existing audio remain execution dependencies. No historical Rxx runtime imports. New `r20` save/quality namespaces are isolated.

## Evidence and limitations

`node --test game/r20/tests/*.test.mjs` covers identity, metres, shared clock, curves, rail/door/camera bounds, streaming coverage, culling and disposal. Test-only frozen older sources are comparison fixtures, not production dependencies.

Official read-only CI runs actual Chromium ANGLE SwiftShader WebGL, identical R19/R20 comparison fixtures, native first-station-to-second driving and phone viewport/touch flows. Explicit distance/camera fixture screenshots are labelled and never represented as native driving. Software-renderer timing is not phone-device FPS. Reference photos are private research only and are not in this source directory. Runtime shaders/letter readability and visual quality need actual image review; passing numerical tests is not film-quality certification.

## Later direction interface (not implemented in this candidate)

The user's four director choices mean four distinct story versions, each with its own complete shot/acting/editing treatment, not four mixed responsibilities or color filters. No director runtime is introduced here. Existing `piercedOpenings` records retain a building/floor/bay ID, metre-space center, width/height and room depth; camera corridors and visible rail-side setbacks remain available. A future director layer must resolve these parcel-local points with `chunk.center - Session.distance`, and use the same Session clock for cranes/dollies, resident-window interactions and reaction shots. Four camera/actor/focus/film treatments require their own later visual and clearance validation.

## Budgeted render-cell candidate

Production world uses a 6ms **soft** packing target per update. Changed cells build detached with cooperative vertex/index/instance slices; old geometry and source ownership remain until an atomic ready-cell swap. Required incoming far architecture uses the same batch shaders and an explicitly timed synchronous coverage exception. Allocations, garbage collection and coverage exceptions are not claimed to obey a hard6ms limit. Partial jobs are versioned/cancelled on changed requests and released on teardown. Session units, simulation time, physics, actor routes and station events do not wait for the rendering queue.

`renderBatch.renderedParcelIds` is actual submitted coverage. `pendingCells`, `staging*`, `allocated*`, `peakAllocated*`, `maxSliceMs`, and `maxCoverageMs` distinguish queued CPU arrays from displayed batches; actual WebGL buffer residency is independently observed in CI. The paused fixture gate includes every queued440m tail frame, so work cannot disappear outside the measured350–440m interval. A short actual WebGL gate precedes full native driving. This optimization remains a candidate until those gates complete; no R19 deployment change is implied.
