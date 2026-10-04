# GNM Head browser study

An independent browser study of the full official GNM Head web model. The
official `GNMModel.js` and `SemanticSampler.js` are unchanged. The desktop/mobile
shell, camera, test interface and optional scalp binding are new code.

## Run and hosting

Serve this directory over HTTP. `index.html` loads the two complete model
containers from the pinned official `xrblocks/assets-gnm` commit. Initial model
data is 37,669,776 bytes; modules and Three.js are local. The parent workbench
should load this experiment only when opened. Do not inline these weights into
the parent page or its existing cases.

The full weights are already present in the preparation workspace's `assets/`
directory. They are not required in the public deployment. A self-contained QA
file can be produced without npm or a build dependency:

    python3 tools/build-offline.py --output /tmp/gnm-offline.html

When weights are absent, `--download` fetches only the two pinned official
containers and verifies their exact byte count and SHA-256. The generated file
is about 52 MB and is temporary QA output, not the public first-load bundle.
No original weight dimensions are removed. The embedded sampler only changes
its module import specifier to the offline import-map alias; math is identical.

## Verification contract

`npm test` runs the official CPU evaluator against the full local containers.
It verifies the neutral template, a fixed semantic identity, surprise, pose,
all 20 semantic expressions, the final identity/expression dimensions, and
exact neutral restoration.

`tests/browser-qa.cjs` exports `async (browser, url, out, check)`. It expects an
already launched Playwright Chromium and produces screenshots plus
`results.json` on success or failure. With a `file:` input, it builds and opens a
temporary complete offline version first. With HTTP, it verifies exact served
HTML and the actual loaded binary hashes. It exercises neutral, identity,
expression, last coefficient, visible slider, parameter round trip, malformed
import, side camera and mobile layout. A passing numerical test is not a
visual acceptance: inspect the PNGs before delivery.

`window.gnmStudy` exposes `ready`, `getDiagnostics`, `getState`, `setState`,
`setCase('neutral'|'identity'|'expression')`, `setCamera`, `setParameter`,
`getPositions`, `evaluate`, `render`, `freeze`, and `dispose`.

## Scope and provenance

- 17,821 vertices, 35,324 triangles, 253 identity and 383 expression coefficients,
  four axis-angle joints, all 20 semantic expression classes
- Official int8 web bases with float32 component scales; not the full precision
  Python weight package
- This container has no UVs, skin textures or pose correctives
- Pure blue/grey or vertex-palette materials are geometry views, not real skin
- No Houdini runtime, HDA, photo/webcam fitting or XR workflow is represented
- Full upstream versions and file hashes are in `PROVENANCE.json`; complete
  licenses include the GNM tongue asset's MIT notice

## Optional scalp binding

`ScalpBinding.js` and `HairLayer.js` are available through the Hair tab after the original no-hair
rendering baseline. The grooming hairline selects actual component-0 skin
triangles in neutral coordinates, then samples by triangle area. Every guide
point records a triangle and barycentric weights after walking mesh adjacency.
The complete strand guide follows the deformed GNM surface. `regionId=255` is
not treated as an anatomical scalp region. No legacy ellipsoid head is used.

The strand ribbons adapt the existing regional-groom study's sweep/lift/frizz
and tangent-lighting approach. This is a new attachment experiment, not a
claim to reproduce a particular teacher's hairstyle or a scalp simulation.

## r4: visible hair, quick expressions and shared side lights

The initial view now creates and shows 12,000 scalp-bound strands before reporting ready. Smile, surprise, open mouth, expression reset and hair visibility are available over the canvas, including on narrow screens. The full source-expression controls remain available.

The default clay view uses warm and cool world-space directional lights. The strand shader receives the same directions, linear RGB colors and powers as the head. Its scalp-facing attenuation and tangent highlights are appearance approximations, not a complete hair scattering or shadow simulation. The original blue material and lighting remain selectable. No original GNM model coefficients, topology or evaluators were changed.

The 0.00023 strand radius and increased strand count improve screen coverage; they are display/grooming settings rather than measured human hair dimensions. This remains a head-and-hair binding experiment, not a finished photoreal portrait. The browser tests include native Chromium touch emulation, but do not establish physical iPhone or Safari compatibility.

## r3: source expression presets

The new Sources tab retains the official sampling controls unchanged. Changing
the source selector only changes the list. A preset click replaces the full383
expression vector, preserving identity, rotations, translation and hair. Clear
sets only the expression vector to zero. No new Undo feature is provided.

- Maya workflow:20 fixed samples using NumPy PCG64 class seeds and the same
  official64+20 semantic decoder. This is not a second model or a Maya runtime.
- Max workflow:9 original lower-face PCA fallback recipes. Nonzero components
  occupy200–349; all other expression coefficients are cleared. Labels are
  experimental, not accurate phonemes or FACS. X is source rest, not zero.

Both MIT licenses and exact commits are preserved. See
`EXPRESSION-SOURCES-PROVENANCE.json`. Source-selection metadata is exported
for tracing. Import restores its preset association only when recomputing that
exact source/preset/strength matches every saved coefficient; mismatching
metadata is ignored. The coefficient vectors remain the authoritative state.

`npm test` retains every original model check and adds source-adapter tests.
Use `GNM_ASSETS_DIR=/absolute/path/to/existing/assets npm test` when the pinned
weights live outside this folder.

The browser helper retains the original r2 checks and screenshot-call order,
then appends09–16 for Maya smile/tongue, Max A/B/E, source/parameter round trips,
source switching, custom identity/pose/hair retention and mobile controls.
It records the exact built offline file SHA and removes only its own temporary
offline file and newly-created asset cache in finally; shared external weights
are never removed. A runner may reuse local weights with GNM_ASSETS_DIR.

Local r3 syntax, complete offline import chain and numeric checks pass.
Chromium could not launch because socket creation is not permitted in this
execution sandbox, so there are no new local visual screenshots. CI must run
the browser helper and inspect those images before publishing/acceptance.

## R5 mobile layout and grooming

All normal controls are below the independent canvas. The camera has fitted
100% reset, native drag/pinch/pan, lens zoom in 100% steps up to 600%, and
independent play/pause for camera orbit. Projection zoom leaves the camera
outside the head. Browser QA uses Chromium touch emulation, not physical iPhone.

Default scalp coverage uses 16,200 active strands from a deterministic 18,000
root pool, a frontal/crown grooming mask with ear exclusions, and a .00028
model-unit radius. Density changes the submitted strand range; length follows
a prebound surface-guide prefix. Eyebrows are visible by default; optional
short beard covers upper-lip skin and chin with separate visibility, density,
length and color. All guide points bind original skin triangles/barycentrics.
The numerical suite checks root and guide domains and sampled shaft clearance
on selected neutral/expression/identity/pose cases. This is not a proof of
collision freedom for every possible 636-dimensional coefficient combination.
No physical millimetre calibration is claimed for native GNM coordinates.


## R6 grooming refinement
Three scalp styles share the original GNM root union and deforming triangle bindings. Position controls adjust a feathered neutral-template hairline and front/side/back root coverage. Density filters existing roots; thickness changes the strand radius. Each style caches its own surface-guided direction field. Scalp lift is reduced and varies by strand and region.

The grooming panel shows one independent region at a time: scalp, brows or beard. Beard moustache/chin coverage is independently filtered. Facial guide samples are redistributed across the permitted surface prefix so they no longer accumulate repeated endpoints at a mask edge. Shared two-side lighting, 100–600% camera controls, expressions and original model dimensions remain available. Model units are not calibrated millimetres. This is a real-time grooming study, not photoreal skin.

R6 numerical and browser evidence is recorded separately from R5. The browser helper retains existing model/camera/source tests; new grooming-editor assertions run in the existing touch group to keep each job within its original time budget. No workflow permission changes.
