# Native F13 hair adapter

This adapter borrows the exact, already generated F13 groom. It does not invoke
the authoring generator again and does not reduce density, points or physics
quality. The source is the older published F13 candidate at
`64cd31324f1a7c4762c21531fe5559b14face2fe`; it is not acceptance of the newer
S1.B4.1/R13 structure branch.

## Host contract

```js
import {createHairFactory} from './src/hair/index.mjs';

// Expose the original PhotoDynamics class from the verified donor runtime, or
// use an already initialized native instance's constructor. No extra Three import.
const hairFactory = createHairFactory({
  THREE,
  template: raw.fibers,
  PhotoDynamics: raw.PhotoDynamics || raw.dynamics?.constructor,
  renderViewer: raw.viewer,
});

// Body factory has already prepared its independent NativeMotion/pose cache.
// actor = {id, model, viewer, motion, worldRoot, ...}
const hair = hairFactory.create(actor);

// Use one shared fixed-step clock. Hair reads the body's final pose.
actor.advance(1 / 60, tickId);
hair.update(1 / 60, tickId);

// After all actors update, prepare their private pose textures and render once.
for (const actor of actors) actor.motion.prepareRender();
raw.viewer.renderer.shadowMap.needsUpdate = true;
raw.viewer.render();

hair.dispose();       // Does not dispose donor/shared textures or body state.
hairFactory.dispose();
```

`actor.viewer.scene` and `actor.viewer.renderer` must be the shared scene and
renderer. Its `mesh` is the actor's real complete body mesh. Its `geometry` is
the matching complete native display geometry, and `hairNativeMotion` is that
actor's prepared motion. `model` is the corresponding native rest model.

The adapter does not call body `select`, `prepare`, `advance`, `stop` or
`dispose`. `PhotoDynamics`' original internal advance hook is redirected to a
no-op; all root/scalp/skin queries read the already committed body pose. Hair
owns its own kinematic history. A repeated non-null `tickId` is rejected.

Bind the original shoes and apply their ground lift before `hairFactory.create`,
so the initial hair/collision placement includes that lift.

Initialize the factory before moving the donor into a crowd layout. By default
the original donor hair mesh is hidden/detached from its cache while the factory
is active. It is restored when the factory is disposed. The body factory owns
hiding or removing the original donor body and attachments.

## Resource ownership

- Shared by the same groom: original strip `InstancedBufferGeometry`, instance
  attributes, path texture, rest texture, original sampled paths and design.
- Private per actor: `ShaderMaterial` and uniform values, 43×25 RGBA32F
  deformation texture (17,200 bytes), full original guide solver state,
  collision frames/fields and hair kinematic history.
- The body factory owns each actor's NativeMotion, bone texture and pose target.
- One native `HairPassCache` is used for the renderer. The adapter attaches all
  hair meshes to that cache; it never wraps `renderer.render` once per actor.

All 114,171 fibers retain all 49 points, 70 μm authored diameter, and the original
shader. This is 10,960,416 submitted hair triangles per hair pass per actor.
The 89,522,176-byte immutable path texture is shared. Physics is the original
43-guide × 25-node model with bounded deltas mapped onto all display fibers;
it is not 114,171 independently solved rods. Cross-character hair/collision is
not implemented by F13 or this adapter.

## Placement

The original constructor estimates the neutral head/torso at the model origin.
Constructing it directly with a translated body would mix coordinate spaces.
The adapter gives it a private neutral mesh facade, then applies the actor's
initial rigid matrix to all owned world-space guide/reference/collision state.
Afterward the facade follows the actor's actual body `matrixWorld` each tick.

Native bone transport in the collision facade is
`Mcurrent * nativeSkinMatrix * inverse(Minitial)`. The original hair shader
already applies `nativeMeshWorld` to each scalp-bound path and expects a
world-space deformation vector, so it needs no placement shader patch. Hair
is attached directly to the shared scene and never receives a second root
translation through its vertices.

Placement supports rigid translation/rotation; it rejects scaling or shear.
Different native body shapes require their corresponding native groom/binding
template. Uniformly scaling the visible body is not a valid replacement for
authoring another shape. Teleports or action changes can call `hair.reset()`;
continuous root movement is consumed through the moving frame and collisions.

Reset also calls the native collider reset API, synchronizes the surface's
previous frame, and rebuilds native bundle-contact candidates on the next step.
This prevents a UI placement jump from becoming a one-frame collider velocity.
The original collider API refreshes its surface field during reset; the normal
per-frame solver path and physical parameters are unchanged.

For a paused UI placement change, follow `hair.reset()` with
`hair.update(0, currentTickId)`. This publishes the current head-center lighting
reference and tick without advancing either physics or body motion.

`solverSteps` and `updates` are lifetime counters. `solverSeconds` restarts on
reset. A retained actor can therefore report 120 lifetime steps after two
60-step runs while a newly added actor reports 60; both should report 1 second
for the current run and the same latest scene tick.

## Runtime controls and inspection

Instances expose `setPhysics(boolean)`, `setWind(boolean)`, `setColor(name)`,
`reset()`, `report()` and idempotent `dispose()` as well as `update()`.
`report()` is lightweight and does not call the expensive original penetration
snapshot. `report({diagnostics:true})` explicitly runs the native report.

Per-frame timing should cover the one shared loop, then CPU submission and GPU
queries separately. Sharing immutable buffers is not evidence of a particular
FPS. Rendering, skin/material composition and collision quality still require
actual browser checks with several actors. Adapter math/ownership tests are not
a substitute for those checks.

## Verification records

`verification.json` records the initial adapter's five math/ownership checks,
including the exact files tested at that time. `reset-history-verification.json`
records the subsequent targeted reset fix and its own current source hashes.
The original mock suite was not rerun or relabeled as native physics evidence.

To repeat the reset regression from this project directory:

```sh
python3 build/prepare-sources.py --verify-only
node --loader ./src/actors/test-loader.mjs ./src/hair/reset-history.verify.mjs
```

It executes the unchanged F13 `CollisionProxies` constructor and matrix/contact
APIs against the retained MP05 104-bone/control-mesh fixture. A head-joint
binding supplies its test frame, and GPU raster/readback is suppressed only in
the test. The regression covers all ten native collider records, demonstrates
the former false placement velocity, checks zero velocity after reset, and
checks the next actual 2 mm displacement. It does not claim P01 visual or full
guide-solver validation. Browser reports live in the project's `validation/`
directory and retain their own scope and tested version.
