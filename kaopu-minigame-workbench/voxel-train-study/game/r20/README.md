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

No street mesh or image-texture file is loaded. BufferGeometry, glyph tessellation, instance matrices and procedural/Canvas station surfaces are produced at runtime. They have real CPU/GPU costs; small score bytes alone do not prove performance. Shared Three r170 and existing audio remain execution dependencies. No historical Rxx runtime imports. New `r20` save/quality namespaces are isolated.

## Evidence and limitations

`node --test game/r20/tests/*.test.mjs` covers identity, metres, shared clock, curves, rail/door/camera bounds, streaming coverage, culling and disposal. Test-only frozen older sources are comparison fixtures, not production dependencies.

Official read-only CI runs actual Chromium ANGLE SwiftShader WebGL, identical R19/R20 comparison fixtures, native first-station-to-second driving and phone viewport/touch flows. Explicit distance/camera fixture screenshots are labelled and never represented as native driving. Software-renderer timing is not phone-device FPS. Reference photos are private research only and are not in this source directory. Runtime shaders/letter readability and visual quality need actual image review; passing numerical tests is not film-quality certification.

## Later direction interface (not implemented in this candidate)

The user's four director choices mean four distinct story versions, each with its own complete shot/acting/editing treatment, not four mixed responsibilities or color filters. No director runtime is introduced here. Existing `piercedOpenings` records retain a building/floor/bay ID, metre-space center, width/height and room depth; camera corridors and visible rail-side setbacks remain available. A future director layer must resolve these parcel-local points with `chunk.center - Session.distance`, and use the same Session clock for cranes/dollies, resident-window interactions and reaction shots. Four camera/actor/focus/film treatments require their own later visual and clearance validation.
