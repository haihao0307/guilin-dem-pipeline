# Live GarmentCode pattern catalogue

Pinned source: Maria Korosteleva's MIT GarmentCode `d449629979028123a5c4dc9e732a2ec19b7fce31`. All upstream file bytes are verified by Git blob SHA in `upstream/MANIFEST.json`. No original body mesh, pre-solved cloth, Maya/Qualoth, or PPF assets are included.

## What is implemented

The exact official source programs run for every request. 23 explicit entry recipes cover Shirt, FittedShirt, Pants, all seven skirt families, strapless/asymmetric upper variants, long sleeves, Turtle/SimpleLapel/Hood2Panels, three cuff constructions, two waistbands, dresses and jumpsuits. The original 122 design parameters are exposed, with original sampling ranges and selection choices. The source's empty-garment, total-length and heavy-skirt support rules remain enforced.

An entry is a starting recipe, not stored geometry. Every body or design change runs the source generator, creates fresh analytic edges, and returns a distinct recipe hash. `examples/` are test outputs only; browser generation does not fetch them.

### Browser contract

Import `browser/pattern-generator.mjs`. `await listStyles()` and `await parameterSchema()` fetch only small metadata. `await generatePattern({bodyCm, design})` initializes the dedicated Pyodide worker on first use. `design` accepts an entry `{style:'Pants', 'pants.length':0.75}` or original nested design objects with `v` leaves. `bodyCm` must provide every required measurement in cm and angles in degrees; missing anthropometry is never filled from a generic body.

`createPatternGenerator({onProgress, assetBase, timeoutMs})` creates an independent lifecycle. `generatePattern(request,{signal})` supports cancellation. A failed or skipped 2D validation rejects with PatternValidationError and attached diagnosticPattern; only an explicit allowInvalidForDiagnostics flag returns failed paper for 2D diagnosis. Never feed that diagnostic output to a cloth solve; cancellation terminates the whole Python worker and rejects all its queued requests. A later call starts a clean worker. `dispose()` is terminal for that instance. The default facade has `disposePatternGenerator()`. Every response is matched by request ID, preventing stale response substitution; the consuming UI still owns latest-request display policy.

Serve with HTTP(S), never file://. Requires Web Workers, WebAssembly, fetch, SHA-256 Web Crypto, and gzip DecompressionStream. Runtime assets are same-origin and checksum verified. There is no CDN dependency at run time. CSP must allow the same-origin worker/script and WebAssembly compilation.

The explicit compressed download is about 24.69 MB including uncompressed loader scripts and source archive. Expanded pinned files are about 79.45 MB. The largest SciPy gzip is split into two byte-exact transport parts to stay below the upload API request limit; each part and the reconstructed original wheel are SHA-256 checked. Only the `.gz`/`.gz.partNNN` binary distribution plus loader JavaScript must be shipped; raw development copies of wheels/WASM/stdlib are not needed in deployment. The runtime is not requested on module import, metadata reads, gallery browsing, or any existing accepted garment path.

### Python contract

`from pattern_catalogue import generatePattern, listStyles, parameterSchema`. The CLI accepts one JSON request on stdin. Set up pinned dependencies from `requirements-native.txt`, run `build_runtime.py`, then `build_browser.py` if rebuilding. Source geometry is untouched. The sole runtime adaptation delays optional Cairo/Matplotlib imports until actual rendering; the original `VisPattern` class and every geometry function remain intact; pristine `upstream/` remains available for independent oracle comparisons.

## Analytic schema

`kaopu-analytic-sewing-pattern@1`, explicit millimetres:

- `panels`: `verticesMm`, ordered `edges`, edge-index boundary, original role label, grain convention, original assembly translation in mm and intrinsic XYZ rotation in degrees plus rotation matrix
- Each edge: original endpoint indices; line/quadratic/cubic/circle type; exact original curvature encoding; absolute Bezier controls or circle center/radius/angles; analytic length; adaptively sampled diagnostic points
- Relative Bezier curvature controls remain dimensionless. Circular `curvature.params[0]` is converted from cm to mm; large-arc and sweep flags remain unchanged. `sourceCurvatureCm` preserves the original encoding
- `seams`: original edge references, explicit parameter directions, right/wrong fabric-side flag, both material lengths, signed A-minus-B ease, ratio, source index and stage suggestion
- `darts`: same-panel seam IDs; they remain real material edges with a closure seam
- `interfaces`: original high-level edge references, flips, ruffle coefficient sections and projected lengths, including data omitted by original JSON serialization
- `officialOracleCm`: complete original assembled JSON, separately preserved in cm, including properties
- `validation`: finite/closure/nondegenerate-area and adaptive-polyline proper-crossing diagnostics; no claim of a continuous geometric domain certificate

Grain is explicitly local +Y chosen by this adapter, because the upstream source does not specify material grain. Seam allowance is explicitly zero because upstream curves are sewing lines. Downstream meshing must not reinterpret relative controls as millimetre coordinates or discard curves in favour of coarse samples. Upstream component projection interfaces are retained as provenance; only panel-resolved seam references are sewable.

## Validation boundaries

The catalogue test covers each default and a nontrivial parameter edit. Additional control/option audits retain inactive or rejected cases rather than hiding them. Original sampler ranges are not promised valid cloth domains. Some controls activate only under specific garment choices; e.g. strapless requires FittedShirt, ArmholeSquare/Angle apply only to sleeveless tops, smoothing affects ArmholeAngle, and Bezier controls require Bezier2NeckHalf.

This component does not triangulate fabric, solve sewing, perform body/self-contact, provide accepted garment thumbnails, alter old accepted examples, or certify wearable 3D fits. Those remain separate consuming-workbench gates. Node Pyodide timing is explicitly not browser timing. Browser performance/cleanup verification runs in the dedicated GitHub Actions test, not a claimed unrun local browser.

## License

`upstream/LICENSE` preserves the full MIT copyright and license. `runtime/` also contains the source and bundled svgpathtools/svgwrite licenses. Pyodide and dependency licenses are carried in their official distributed archives; `THIRD-PARTY-NOTICES.md` lists provenance. No trademark permission is implied by the optional upstream SIGGRAPH decorative shape.

## Same-backend oracle and cross-platform sensitivity

The independent `generateOfficialOracleCm` path instantiates the original classes afresh, without the mm adapter, and returns the original JSON. Browser QA compares this with each adapted result in the same WASM numerical backend. This proves adapter equivalence, not bitwise equivalence between native and WASM SciPy. For the current long-sleeve baseline the identical official L-BFGS-B formula terminates at different native/WASM points: up to 4.496 mm at matching cubic curve parameters (4.726 mm in initial world placement), despite only 0.642 mm vertex change. Rotation matrices, seam topology and direction are unchanged. See platform-optimizer-diagnosis.json. No original gradients, step sizes, termination criteria, or golden results were altered to hide this difference. Downstream 3D validation must use the live backend output.
