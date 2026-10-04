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
