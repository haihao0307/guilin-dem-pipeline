# Original clothing in the shared NPC scene

`index.mjs` implements one original MP05 R10 **T03 top + P02 shorts**, with original continuous solid denim and the original `ReducedCloth` live solver. Its default recipe is the published D03 pair, both `denim-bleach`. Each actor has an independent numerical Worker and mutable body/cloth state. No iframe, replacement garment mesh, separate renderer, internal action timer, fixed-distance LOD or action-result replay was introduced.

## Integration

```js
import {createClothActor} from './src/cloth/index.mjs';

const clothing = await createClothActor({
  THREE, renderer,
  actorPacket: actor.actorPacket,
  model: actor.model,            // Immutable P01 rest model, not display vertices
  parent: actor.worldRoot,       // Scene placement is outside native bone matrices
  actorID: actor.id,
  onProgress: showProgress,
  requestRender: scheduleRender
});

// One physical tick: the host evaluates motion only once for this actor.
await clothing.update({
  dt: 1 / 60,
  skinMatrices: actor.finalSkinMatrices,
  frameSequence,
  timeSeconds
});

// After all actors have accepted this tick, before the shared scene draw:
clothing.renderUpdate(camera);
// ... host renderer draws its original body/hair/shoes/clothing passes ...

clothing.pause();
await clothing.reset();
const contact = await clothing.measureContact(); // Explicit diagnostic, not every frame
clothing.dispose();
```

`create`, `update(actor, input)` and `dispose(actor)` are also exported. Creation adds the complete `item.solid.group` objects to the supplied parent only after fitting and solid construction succeed. A failed new creation disposes its partial resources; it does not silently show the carrier mesh or a previous person's fit. Initialization errors carry `error.clothFailure` with the exact failed phase and completed fit step count.

The host must await a tick before requesting another one for that actor, and commit body/hair/cloth presentation together. A rejected tick restores the clothing worker's last accepted body and garment outputs. The host must also keep or restore its own last accepted body/hair pose; the clothing adapter cannot roll back another module's motion controller. A duplicate or decreasing frame sequence is rejected. `reset()` restarts the external sequence at the initial fitted rest state; reset the host's motion clock and pose at the same time.

`renderUpdate(camera)` retains the original continuous solid update and renderer. It transforms the perspective camera into the clothing group's local space, so the original projected sampling and frustum calculations account for the NPC's scene placement. It creates no replacement draw representation. Call this method at render time after updating the actor root transform; the method does not advance physics.

## Actor packet and coordinates

Supply the current original model's packet:

- `rig`: original Anny rig with all 104 `names`, `parents`, row-major `restMatrices` / `skinMatrices`, complete `weights` and `restPositionsPerInfluence`.
- `positions`: original 25,417 control vertices in native Z-up metres; `faces`: original 50,624 triangle sequence; `bodyCount`: 9,253.
- `boneOrder`: all 104 native bones in parent-first order.
- `headSkinIndices` and `headSkinWeights`: original canonical head influences.
- `bindingRange` / `bindingPacked`: the original NativeBinding **control-vertex** range/packed arrays when available. These are not dense display texture ranges. No influence truncation is performed.
- `sourceRevision`: the actual current body source commit, retained in the fitting proof.

The `model` argument supplies `modelIdentity(model)`; identity is computed once per immutable model and cached in a WeakMap. Alternatively pass `personIdentity` explicitly. A mutated body shape needs a new model/identity and a new fit; do not reuse an old identity object.

Each external matrix is row-major **`posedWorld * inverse(restWorld)`**, in exactly `rig.names` order. It contains actor-local skeletal motion, without the NPC world placement. The worker calls `world.actor.evaluate({}, skinMatrices)` and then `world.acceleration.step(dt, false)`. The adapter updates the external clock and revisions explicitly, so no call to `actor.at()` occurs inside clothing. The original native-to-cloth conversion is `[x, z, -y]`; world placement belongs to the shared parent group.

## Fitting is performed before live physics

The adapter validates the source packet and original static gate, checks the current body geometry/topology identity, applies the retained MP05 rig-weighted width/height grading rule and original seam/rise refinement, then performs the **same 48-step joint fitting sequence** as the original `live-cloth-worker.mjs`: 32 steps interpolating the old body to the current body followed by 16 steps at the current body. Each step is 1/60 second and retains original numerical safety gates. WebGPU is attempted first; the original WASM fitter is used when WebGPU creation is unavailable. `fitBackend: 'wasm'` selects that existing backend directly for reproducible initialization.

Only after all 48 steps complete is the original `ReducedCloth` installed. An initialization-only WASM heap is detached by copying its numerical arrays before dropping the fitter; this changes ownership without changing any coordinates or solver values. The initial fit, per-garment strain and sampled body/pair contact results remain in `clothing.initialization`. They are observable evidence, not automatic wearing acceptance.

The original WebGPU and WASM fitting paths have upstream differences. The WebGPU path interpolates graded edge rest lengths; the retained WASM fallback does not implement that interpolation. This adapter preserves that distinction and reports the selected backend. It does not silently substitute a new solver or relax the source's strain guard. Current P01 fitting and visual results must therefore be checked on the actual selected backend.

The dynamic model remains the original skeletal reference with regional secondary cloth motion, lower-body triangle contacts and specific top/bottom contacts. Full free cloth, arbitrary layering, CCD, full self-collision and hair–cloth/NPC–NPC force coupling are not implemented here. This scope is reported by `audit()`.

## Exact sources and packaging

The original 50-file dependency closure is in `upstream/`, **14,559,903 bytes**, pinned in [sources.lock.json](sources.lock.json) to MP05 publication `c5c0bedbc35f24cbb35426ab9c14b74ca7fc5f49`. All upstream bytes are unchanged. It includes the original solid generators and geometry Worker, shaders, trim/deformer/atlas modules, numerical modules, WASM and WGSL, the original person/SDF reference, T03/P02 packets and material metadata. Main-thread source code uses bare `three`; map that specifier to the **same module instance used by the F13 body and renderer**. The adapter checks constructor identity before allocating rendering resources.

The independent numerical Worker imports the original relative `upstream/vendor/three.module.js` through the original motion bridge for matrix mathematics only. It creates no renderer, texture, material or render geometry. Separate worker realms do not supply objects to the shared renderer. The original geometry Worker has no Three rendering dependency. Preserve `worker.mjs` and the literal `upstream/geometry-worker.mjs`, `.wasm` and `.wgsl` URL resources when bundling; they are not automatically inlined by an ordinary main-entry bundler.

The supplied build handles these resources explicitly:

```bash
node build/main-bundle.mjs
# Override only the build dependency path if required:
# CROWD_ESBUILD_PATH=/absolute/path/to/esbuild node build/main-bundle.mjs
```

`build/cloth-bundle.mjs` verifies all 50 original source hashes, builds two independent IIFE Workers, and returns `{mainPlugin, prelude, manifest}`. `build/main-bundle.mjs` installs that plugin and prelude before the main app. The prelude supplies `window.__CROWD_CLOTH_OPTIONS__.workerURL` and `window.__CROWD_CLOTH_GEOMETRY_WORKER_URL__` as Blob URLs. It leaves the host's optional fitting/backend settings intact. The plugin adapts literal Worker URLs only in the generated code; the original files remain unchanged.

The Worker embeds its source lock. Original WGSL and fallback WASM bytes are embedded as verified data URLs; the fitting path still supplies WASM through its existing verified byte loader. Original person, SDF and garment assets load from the source lock's fixed commit on `raw.githubusercontent.com`, with the original length and SHA256 checks. No Blob Worker depends on `import.meta.url`, a relative module import or a separate website directory. This first runtime therefore requires network access to those fixed asset URLs while creating each actor. `dist/cloth-assets-manifest.json` records source provenance, runtime URLs, generated Worker hashes and adaptations; the standalone Worker JS files in `dist/` are debugging copies of the exact code embedded into `dist/app.js`.

Restore or verify the exact dependency closure:

```bash
python3 src/cloth/prepare-upstream.py --verify-only
# Or restore missing files from their fixed public source URLs:
python3 src/cloth/prepare-upstream.py
```

Freshness check: MP05 PR 283 remained at `bd430222b3c62819bdf38d2c84d4bf3eec8ac5be`. The independent layering repair PR 315 was at `f54cb0d976e1d683e89c6576f80d94eb06273b6c` and remained unfinished. Its repair code is not used or modified by this adapter.

## Verification completed here

Run the numerical adapter verification with Node 24.19.0:

```bash
node src/cloth/verify.mjs
```

[verification.json](verification.json) records seven passing checks: all 48 original joint-fit steps, one external pose with no internal advance, exact equality of all supplied bone matrices, duplicate frame rejection, nonfinite input rejection before mutation, exact body/garment restoration after an injected original solver failure, and reset recovery.

That numerical run used the **original frozen-body fixture**, with grading and full WASM joint fitting; it did not render a browser scene or validate F13/P01 fitting. Its initial fit sampled +3.279 mm minimum body separation and +2.101 mm top/bottom separation, with maximum edge ratios 1.164/1.143. Current P01 creation and displayed material/occlusion must be validated in the host scene. These numbers are not P01 results or rendered performance measurements.
