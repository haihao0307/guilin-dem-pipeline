# R3.12 original-wall → Three.js thin adapter

Status: local candidate, CPU/static tests passed; GPU comparison NOT yet performed here. No source production edits. Source is a candidate awaiting review, not a claimed user-accepted image.

## Entry

Import `createR312Wall` from `r312-wall.mjs`; supply the host's existing THREE (tested constructor with revision 170). It returns `{group, materials, meshes, proof, parameters, updateCamera, setCamera, dispose}`. Add `group` to the existing scene. No renderer, camera, webpage, animation loop, network texture or imported model is created. Each mesh's onBeforeRender updates local-space camera and clip matrices.

First comparison: `{THREE, seed:312, bindingMode:'legacy', door:null}`. Original source can use `?seed=312`. Default full source wall is 4 m wide, 3 m high at 43 courses, masonry thickness .48923 m. Dimensions and wave scale are not silently squeezed to fit a room. Placement and rotation are permitted; non-unit scale is rejected. Full double-sided field proxy coverage is kept.

Door: `{x:0,bottom:0,width:.9,height:2.05}` is an axis-aligned rectangular opening in wall-local metres, extruded through the full wall. This is a geometry adaptation, not a new surface shader. Geometric field values, materials and original lighting functions are retained byte-for-byte. New code intersects the analytic door interval, searches the valid pre/post-opening ray segments with the original ray tracer, and returns cut-boundary surfaces where they intersect source solids. Near the cut boundary the normal is differentiated from the composed field. No source outer surface texture is used as a fake recess.

## Source preservation

`source/original-r3.12.html` SHA256 `1532ea02c31f014c23390fa028385338c3d2caa572f3a36511db81d6609e1581`.

`extract-source.mjs` evaluates only original constant/template declarations under a small DOM stub, stopping before context creation. `original-shaders.mjs` contains six exact evaluated shader strings, original manifest and constants; `source/source-lock.json` holds their hashes. Adapter preserves the entire fragment prefix before original `main`, including all original functions. Only the dispatch/main and door composition helpers are added. Original source is never modified.

No GLSL octaves, colors, material formulas, lighting formulas or camera-distance detail cutoffs were replaced. RawShaderMaterial has `toneMapped:false` because original shading already performs tone+gamma transfer. Original source lights currently stay in wall-local space; host-light adaptation is explicitly not implemented.

## Explicit source controller bug boundary

The source declares arrays for five core layers but loops five draws while writing only the first array element. Its plaster uploader asks for `uLayerOuts[0]` and `uLayerReveals[0]`, but shader variables have singular names. The adapter does not silently call a repaired picture identical:

- `bindingMode:'legacy'` reproduces those actual original bindings with five core passes and zero plaster arrays. Use this for same-source A/B.
- `bindingMode:'declared'` supplies all five declared core/plaster arrays and renders core once. This is an explicit controller correction and can change the picture.

Default original optional plaster remains an embedded original field. For the room task, its existence must not be interpreted as authorization to decorate an already-built wall with replacement flat patches.

## Checks and limitations

`node --test r312-wall.test.mjs`: 10 passed. Includes source and six-shader hashes, exact prefix retention, no samplers, explicit legacy/declared separation, source counts (1494 bricks), rigid camera/clip depth matrix tests, orthographic path, opening ray intervals and invalid-parameter rejection. Tests import the host's existing local Three.js. `test-results.txt` is the captured result.

The test manually exercises onBeforeRender to verify the hook path; this is not evidence of a successful rendered frame. `proof.shaderCompiles` and `proof.hookCalls` must be observed in the real GPU host. `proof.gpuVerified` starts false and is never set true by this module.

Required next GPU views: original versus legacy/no-door identical camera/seed/light; declared repair separately; front, back, diagonal and grazing door reveal; translated+rotated wall; camera close to/inside opening; foreground mesh occlusion and depth at door edges. Source fixed-camera/tolerances remain inherited limitations.

No host shadow-depth field adapter, collision mesh, object picking or secondary reflection integration is supplied. Mesh raycast is deliberately disabled rather than reporting dummy proxy geometry as the real surface. No claim of physical wall or construction verification. Source reuse license still requires verification before redistribution.

## Raw original-controller comparison

`raw-baseline.mjs` exports `createR312RawBaseline({gl})`; use an existing WebGL2 context. `draw({viewProj,camera,viewDir,right,up,parameters})` accepts flat arrays and the same source defaults. `parameters.orthographic` controls the original uOrtho branch. QA owns viewport, clear color/depth and camera. Source ground plane is omitted in both comparisons; wall itself is unchanged.

`extract-controller.mjs` extracts exact original compile/link, uniform uploader, brick batch, count functions, initialization (except unused floor program) and wall draw statements. `source/controller-segments.json` and `controllerProof` hash those segments. It retains original wrong uniform names and scalar writes. No adaptation opening or corrected binding mode is allowed in this raw baseline.

Updated test count: 11 passed. The extra test verifies every extracted controller segment occurs byte-for-byte and executes the raw controller on a recording GL stub: 3 instanced draw calls / 1494 instances, 6 drawArrays (5 core + plaster), original scalar array writes and misspelled plaster array uploads. Stub execution is not a real GL compile or framebuffer proof.
