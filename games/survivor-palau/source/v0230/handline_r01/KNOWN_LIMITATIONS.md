# Stone Money Island handline R01 — known limitations

This is a bounded candidate integration on top of the existing `fishing_core.cjs` and the current V0.2.3 candidate game render path. It does not create a new fish asset or replace the V0.2.2 lineage.

## What this slice actually establishes

- `reel` and `give` modify the existing fishing core's line rest length.
- left/right hand angle changes the logical line anchor and therefore the core line-force direction.
- one supplied existing `fishId` is preserved through the controller, snapshot, restore and restart.
- pause freezes the handline controller state; snapshot/restore continuation is deterministic in the executed Node test.
- a weak line still breaks from core tension rather than a new arbitrary failure event.
- the browser candidate is designed to override the pose of one already-rendered game fish instead of drawing a replacement fish model.

## Not established

- The final `surfaceAt` adapter from Ocean Mother is not present in this directory. The candidate browser hook can only expose the current game's water elevation and therefore supplies a fixed normal and zero surface velocity to the core. This is not the final crossing contract.
- Underwater current, coral snag/abrasion, habitat intent, landing suitability, splash, human body response and audio are not implemented here; the browser candidate passes zero current and no snag rather than inventing those fields.
- `crossingJumpMax` in the inherited core is raw per-step fish travel. Treating it directly as a medium-switch discontinuity is a metric-category error: at lower frame rates normal continuous motion can exceed the numeric value without a teleport. R01 records adapter-added teleport separately as zero, but the formal `<= 0.15 m` shared crossing gate still needs a common definition and 30/60/120 fps integration test.
- A landed fish is not yet connected to the required processing transaction, survival resources or patrol/exposure risk.
- Candidate handline snapshots use a separate namespaced localStorage key in the browser script. The production game save schema is not modified and production save/reward duplication is not yet verified.
- The mobile controls are implemented in source but have not been exercised in a real 390×844 browser in this run.
- The candidate builder patches an isolated copy generated under this directory. It does not overwrite the current release or production entry. The full candidate build was not executed in this automation container because repository files are available through the GitHub connector but cannot be materialized into the container and direct github.com DNS resolution fails. A fixture test verified the exact two patch-point rules and injection markers only.
- No public HTTPS deployment, iPhone test, performance receipt or user visual acceptance exists for this slice.

## Real 3D / public delivery gate status

- [x] No generated image is used as a substitute for implementation.
- [x] Production-adjacent executable source was actually added under the isolated handline candidate directory.
- [ ] A real interactive 3D candidate has been built and browser-exercised from this branch.
- [ ] The handline interaction has been verified in the current game runtime on desktop.
- [ ] The handline interaction has been verified at 390×844.
- [ ] A fixed public HTTPS candidate has returned HTTP 200 with the correct version.
- [ ] `visualAcceptance` is true.
- [ ] `physicalDeviceTest` is true.
- [ ] `productionReady` is true.

Only the checked items are claimed by R01.
