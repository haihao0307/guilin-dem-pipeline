# R16 · KST1 function-generated street inside the train game

This is an isolated continuation of the existing train game. Entry: `game/r16/index.html`. It retains R14's train, two coaches, controls, passengers, sound, steam and menus, and adds one original near-view street segment. It is not a separate street viewer. Actual WebGL software-rasterizer frames and native interactions have been tested in CI; see WEBGL_ACCEPTANCE.md for exact commits and scope. No public deployment, physical-GPU performance or film-quality acceptance is claimed.

## Exact file contract

- `street/first-street.score.json`: editable resolved architectural recipe (1,754 stored bytes in this revision).
- `street/instrument.manifest.json`: `kaopu.street.architecture`, version `1.0.0`, ABI `KST1`.
- `street/instrument.mjs`: `validate`, `parseScore`, `build`, `update`, `measure`, `snapshot`, `dispose`.
- `street/resolved-score.schema.json`: documented core JSON structure; runtime `validate` additionally enforces numeric support ranges and recursively rejects baked-asset fields.
- `street/architecture.mjs`, `materials.mjs`, `glyphs.mjs`: shared runtime functions, using the game's existing Three r170. No second engine is bundled.

KST1 is a newly implemented architecture extension following the already-audited KAOPU Score/Instrument pattern. It does not claim to be an older canonical street schema or a universal loader for unrelated KAOPU versions.

`build(score,{timeSeconds,...})` returns a root/cloth/state/resource handle. The host attaches `handle.root`; `update(handle,view.elapsed,worldInputs)` evaluates motion; `dispose` removes it and releases deduplicated geometry/materials and caches. A version/ABI/unit mismatch fails before generation. The score cannot carry a mesh buffer, model URL, image texture or image data URI.

## What is actually editable

- `construction.buildings[].floors`: upper floors above the commercial ground floor; 2–8 supported, also subject to expanded resource limits. `bays`, `width`, `depth`, `floorHeight`, `groundHeight` change actual openings and construction.
- `windowCageDensity`: normalized 0–1 placement density; fixed seed gives reproducible choices.
- `signDensity`: normalized 0–1 occupancy of authored sign opportunities; it is not an unlimited count multiplier.
- Building `age` and `repair`: localized damp/paint/repair masks, not uniformly making every building old.
- Tenant `signAge`: each sign's paint state. `open` changes open interior versus joined timber closure.
- `appearance.wetness`, `saltExposure`, material tints; `motion.wind.amplitude/frequency`; `object.seed`.
- This first glyph repertoire contains four original shop names / 16 Traditional characters, with actual licensed brush and serif curves. Unknown text fails explicitly. It does not guarantee arbitrary Chinese support; extending the repertoire uses the supplied regeneration tool and matching font licenses.

No arrays of delivered vertices, indices or bitmap maps are read. Repeated bars, frames and fittings share five primitive geometries through instancing. Glyphs retain Bézier drawing instructions derived from the licensed font design; Shape/ExtrudeGeometry is generated at runtime, preserving holes. They are not an invented Chinese font or a claim that no authored control data is used.

Materials use source-based procedural shaders with connected damp patches, sill/ledge runoff, repaired paint, brick bond, wood grain and aged metal. They create no image/Canvas/Data textures in the street Instrument. Existing R14 host-generated smoke/station CanvasTextures and licensed audio are preserved separately; no R15 image/mesh package enters the new load closure.

## Same world, time and coordinate boundary

`street-district.mjs` is the only street/world adapter:

- Native recipe: metre, X along the railway, Y up, Z lateral; frontage lies on negative Z. The positive-Z observer/boarding side stays open, never toggled as a train passes.
- Host placement: `x = station.target + 27 - view.distance`; ground datum `y = .0805`. There is no reflection, scale change or second terrain/travel simulation.
- Every animated cloth and material time uses `view.elapsed`. Wheels, people and steam keep their original authoritative Session inputs. The accelerated timetable remains display/travel scheduling only, never a multiplier applied to street/character/effect time.
- Procedural surface coordinates subtract the host offset, so rain marks do not slide over façades when the street translates.
- Generate inside 240 metres; release beyond 280 metres; rebuild deterministically on return. Boundaries lie beyond the supported camera/fog range. This is actual object/resource release, not only `visible=false`. It is one near-detail Instrument; automatic multi-LOD asset generation is not claimed.
- The adapter reserves two visible, unshadowed PointLight slots before loading. Generated emitter transforms and output are adopted unchanged; released slots remain attached at intensity zero, and final adapter disposal removes them. This aims to avoid host shader variants caused by light-count changes, but adds two inactive shader light paths; actual paired CI measurements determine whether it is retained.
- Shop frontage starts beyond the station head; the existing platform/room remains separate.

R16 uses separate `kaopu.train-driver.r16.*` save, view and quality keys. R14/R15 files, settings and recovery archive were not rewritten. R15 is frozen comparison only.

## Validation and measured costs

Run from this directory:

```
node --test tests/*.test.mjs street/*.test.mjs
node tools/measure-street.mjs
node tools/audit-load-closure.mjs
```

The preserved baseline tests are run from the study directory:

```
node --test game/tests/*.test.mjs game/*.test.mjs
```

Evidence lives in `evidence/`: exact test output, static resource closure/SHA, deterministic geometry snapshot and measured Node CPU timings. Those are not browser frame times.

The first completed local measurement generated about 162k expanded triangles, 5,921 instanced placements, 119 mesh batches, 67 unique geometries, 35 used / 36 allocated materials, and zero street textures. Shared runtime source plus first recipe is about 122KB, versus frozen R15's 11.32MB city mesh/image payload. The whole game also loads its existing shared engine and services; see exact fresh counts in `load-closure.json`, not just the recipe size.

Node-only generation was roughly 0.15 seconds first build and 0.07 seconds warm on this cloud executor. Cloth/material update measurements are recorded over 240 fixed-time inputs. A first build can still stall a browser's main thread; no claim of free generation, phone FPS or 3A quality follows from file size. The actual buffer storage estimate is about 6.8MB before driver/renderer/shadows; CPU heap deltas include uncontrolled GC and are not a leak measurement.

## Known scope and quality boundaries

- Real R16 Chromium/ANGLE SwiftShader frames, procedural shader compilation and native controls have been exercised. Hardware GPU/phone performance and film-quality visual acceptance remain open; diagnostics must not be reported as hardware timings.
- The full R06 city and skyline are not yet reimplemented; this is one detailed two-building slice. No new character likeness was loaded.
- Cloth is pinned analytic deformation, not collision-aware cloth simulation. Point lights are bounded artistic illumination, not measured photometry.
- Subdivision/instancing and shader costs still require real GPU profiling. Screen readability and film-level material quality remain separate acceptance gates.
- A separate R16-only Draft PR and read-only browser CI are now authorized. The earlier R15 rejected mesh/image payload remains excluded; no merge or deployment is part of this QA stage.

### Independent close-out

The independent reviewer identified and reproduced three integration defects: missing InstancedMesh dispose events, host field surfaces occluding the too-low street pavement, and overwritten glyph normalization scale. These were fixed and retested: 39/39 instance disposal events, pavement above the clipped maximum underlying host ground, and four fascia word groups exactly 0.52m high. See INDEPENDENT_KST1_REVIEW.md and its file hashes. This review remains CPU/source evidence, not WebGL visual approval.
