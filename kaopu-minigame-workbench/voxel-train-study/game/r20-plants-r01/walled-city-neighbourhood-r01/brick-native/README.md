# Original-brick native geometry / cached-normal receiver

Status: local candidate, 10 CPU tests passed. GPU compilation, numerical images,
quality and performance remain pending the host's official QA. Not installed into a
game by this module. Previous wall/cap failure evidence is untouched.

## Runtime contract

Only original R3.12 brick geometry/material functions and the corrected feature-aligned
single-brick chart are reused. At construction the original exact field is sampled by
bounded radial bisection; the original `brickNormal` is evaluated at each generated
vertex and stored as an ordinary normal attribute. Runtime main interpolates that normal
and calls the unchanged `shadeBrick` (and its original `processMaterial`). It has no
per-fragment `brickNormal`, view raymarch, field-based portal clipping, cap, or core.
The full original function prefix remains in source for traceable provenance; unreachable
trace/field functions are not called by the native main.

All input assets are functions and parameters. Numeric float framebuffer attachments
exist only during construction and are deleted after complete readback. They are never
visible image textures. No external mesh or image is loaded. The supplied THREE and
renderer belong to the existing host. No renderer, webpage or animation loop is created
by the runtime module; only the separate QA entry creates an isolated test renderer.

## Exact template sharing and seed meaning

`seed` is the original fragment identity `vSeed`, NOT the old wall UI's `uSessionSeed`.
The old wall generated vSeed from instance id, batch, original center and session seed.
This receiver lets a new recipe explicitly choose vSeed values. That is not a claim
that a new layout reproduces every old wall instance.

Geometry depends on original seed, variant, variation and material family. Rock-family
geometry has an additional seed-dependent facet term. Therefore different source tuples
are NOT silently mapped onto one common mesh. The tuple is also kept for material
shading; geometry and material seed are not separated.

A bounded 32-template pool is supported. Repeat a complete source tuple to share exact
cached geometry, original sampled normals and the material identity across many rigid
instances. `variant:-1` computes the original GPU `floor(h11(vSeed)*4)`; explicit 0..3 is
also supported. Original mother: seed=0, variant=0, variation=0. Ordinary source
variation: .82. Repeating 32 source tuples is an explicit new recipe distribution,
not a recreation of an unlimited set of original unique bricks.

## API

Import `createBrickNativeCache` and `createBrickNativeBatch` from `brick-native.mjs`.

- `createBrickNativeCache({THREE, renderer, capacity:32})`
- `cache.prepare({seed:312, variant:-1, variation:.82, materialFamily:0, rockType:0, spacing:.06})`
- `cache.prepareMany(tuples)` prechecks capacity before sampling
- `createBrickNativeBatch({THREE, entry, placements})`
- Each placement is `{position:[x,y,z], yaw:radians}` or `{matrix:16 column-major values}`
- Add `batch.mesh` (an actual `THREE.InstancedMesh`) to the existing scene
- The batch updates camera uniforms in its onBeforeRender hook
- `batch.proof`, `entry.proof`, `cache.stats` expose counts, memory and sampling timing
- Dispose batches first, then `cache.dispose()`; live shared geometry is not evicted

All transforms must be rigid, positive-determinant and metre-preserving. Yaw90 degrees
is supported. Geometry is centered at the original brick's local origin. To place the
brick on the ground, set its center y approximately .0305769 m. Do not nonuniformly scale
it to invent closure bricks. A construction recipe must provide actual openings and
separate pieces, not stretch or clip one brick across a doorway.

Instances of one batch share the same exact source tuple. Select another entry/batch
for another seed. Batches use ordinary raster depth, real triangle raycasting and
conservative instance bounds. Host shadows and physics are not asserted by this QA;
castShadow and receiveShadow default false because the original custom light model is
retained. World-space source light directions now act consistently on rigid instances.

## Geometry, memory and remaining expense

Default fired-brick chart at .06 m interior spacing has 406 vertices and 624 triangles.
Source rounded-box half-size and source tangent/arc anchors govern its edge topology;
the conservative ray box is used only for the exterior root bracket. The original exact
field, including original deformation, determines the sampled positions.

- One template position + cached normal + Uint16 index arrays: 13,488 bytes
- 32 templates: 431,616 retained CPU bytes, estimated GPU geometry buffers likewise
- Per instance: 64 bytes CPU matrix and roughly 64 bytes GPU matrix
- Submitted triangles: 624 × submitted bricks, even though geometry memory is shared

For example 2,000 submitted bricks still mean 1,248,000 triangles. Instancing does not
make that geometry or per-pixel material work disappear. Use recipe-level visibility
and conservative wall/segment selection; do not claim a game budget from mesh sharing.
The original 17-scale microscope, noise, roughness and derivative perturbation remain
in the material shader. Removing four exact-field normal probes may help but does not
by itself guarantee interactive performance.

The sampler program is reused across template preparation. Each vertex has 19 original
field evaluations for position/bracket/residual and four more through original
`brickNormal`. Position and normal buffers are fully read back before bake completion
is timed. Sampling residual, normal-length error, numeric staging bytes and generation
latency are exposed. Vertex residual does not bound interpolated triangle or normal error.

## Quality boundary

Cached normals are exact original normal-function values at sampled vertices only.
Interpolation is an intentional approximation between those vertices. It loses normal
variation smaller than the feature chart even though original material micro-perturbation
remains per pixel. Geometry retains the prior radial-shell boundary: unsupported
undercuts/disconnected holes and sub-grid silhouettes are not promised. Source-preserved
functions do not make this receiver geometrically or visually exact.

No normal map, roughness texture or replacement noise is introduced to conceal loss.
QA reports both full-image and shared-solid pixel errors so a large background cannot
hide changed surface shading. The unmodified original fragment shader supplies the
raymarch comparison only inside the QA harness.

## Optional original-soil material on real mortar geometry

`createMortarReceiver({THREE, color:'#77736b', colorVariation:0, micro:0})` from
`mortar-receiver.mjs` returns `{material,updateCamera,proof,dispose}`. Attach the material
to the host recipe's ordinary closed prism geometry and call
`receiver.updateCamera(camera)` from that mesh's onBeforeRender hook.

The full original soil function prefix and unchanged `shadeSoil(p,n,rd,0)` are retained.
The input normal is the actual receiver geometry's transformed normal; the original
shade's microscopic perturbation remains. There is no `soilNormal`, exact SDF query,
raymarch, cap or hole discard in the active main. Layer0 color/roughness logic is explicit.

The host owns mortar strips/recessed backing, their dimensions and door/window segmentation.
Set mortar behind exposed brick faces as required by the new recipe, keep openings truly
empty and use independent framing. The receiver is explicitly NEW GEOMETRY, not an exact
surface reconstruction of the original continuous soil SDF. World-space source fields are
continuous across adjacent receiver pieces. No wall or doorway is generated here.

## Tests and official GPU handoff

`node --test .../brick-native/brick-native.test.mjs`

Tests use the existing host Three r170. Its normal repository-relative vendor path is
recognized; `BRICK_THREE_FILE=/absolute/path/to/three.module.js` overrides it. Tests pin
original hashes/function prefixes, active dispatch free of tracing/exact-normal calls,
MRT locations, exact tuple isolation, feature count/memory, rigid transforms, cache
capacity/live ownership and the soil material bridge. Cache lifecycle tests use a
recording GL stub, NOT evidence of a rendered field or valid GPU image.

`gpu-qa.cjs` is for the existing official host page. It disables app.mjs only in its
response, imports this standalone module and the existing vendor Three, and verifies
app.mjs bytes remain unchanged. Default expected staging path:
`kaopu-minigame-workbench/voxel-train-study/game/r20-plants-r01/walled-city-neighbourhood-r01/brick-native`.
Override `BRICK_MODULE` if the host uses a different staging path.

From repository root run that `gpu-qa.cjs`. It runs two isolated single-brick fixtures:
1. Original mother tuple, variation0
2. vSeed312, original GPU variant, variation .82

Both use the same camera/parameters for original and native, 360×270, antialias:false,
and one first + TWO warm complete RGBA readbacks. Timings distinguish submission,
gl.finish and complete readPixels. Each comparison saves original/native/×4 difference
PNGs, RGB MAE/RMSE, silhouette XOR and shared-solid MAE/change count. Progress is saved
throughout. The observation deadline is 300,000 ms; timeout is incomplete, not a pass.

Environment overrides: BRICK_ROOT, BRICK_GAME, BRICK_MODULE, BRICK_THREE, BRICK_OUT,
BRICK_WIDTH, BRICK_HEIGHT, BRICK_TIMEOUT_MS. No CI is started by this module author.
A shader/readback success is separate from visual and interactive acceptance, which
remain false until reviewed. The 32-template construction budget and whole-neighborhood
submission cost need host testing; two single-brick images cannot establish those.
