# Survivor Palau R12 pilot handline runtime

This directory is a bounded gameplay-source increment on the R11 canonical world handoff. It does not import the V0.2.3.0 island, shoreline, ocean, sky, camera, release HTML, or world coordinates.

## What is implemented

- The exact V0.2.3.0 fishing-physics core is retained as the only fight physics core.
- The exact PR #99 handline controller is retained as the only reel/give/lift and hand-anchor bridge.
- `pilot_handline_runtime.cjs` adds the missing pre-hook causal chain:
  surface observation, finite tackle preparation, bait deployment, fish notice, approach, inspection, visible bite window, manual hook-set, then the existing fight core.
- The same existing `fishId` is preserved from the free candidate into the hooked controller.
- Bait, line, hooks and sinkers are finite. A broken line removes line, one hook and one sinker exactly once.
- A landed fish is marked `processingPending`; there is no automatic food or survival reward.
- Short-snorkel clearance, face submersion, coughing, lens flooding and lens wiping affect observation and fish disturbance.
- `palau_world_fishing_adapter.cjs` defines the narrow port from future `PalauWorld.sample()` data into the core. Missing current, surface velocity, normal, clarity, breaker or snag evidence remains an explicit degraded capability and keeps production acceptance false.

## What is not implemented

- No accepted R11 three-dimensional world exists yet, so this directory is not claimed as browser-integrated gameplay.
- No Ocean Mother surface normal/velocity, reef current, snag field, human body animation, audio, patrol consequence, fish processing, public HTTPS deployment, phone test or user visual acceptance is claimed.
- Inventory counts, line strength, fish mass and behavior tuning are runtime candidate inputs, not claims about McCullah's exact 1944 personal issue or a final fish species.
- Aviation goggles/lenses and the short snorkel are limited to surface or very shallow observation. They are not represented as a depth-equalized diving mask.

## Required production gates

- [x] No generated image replaces the three-dimensional implementation.
- [x] Production-adjacent source code is actually modified.
- [ ] The user sees a real interactive three-dimensional workbench rather than a static image, video or placeholder.
- [ ] The image comes from the live three-dimensional runtime.
- [ ] Camera, controls and required interaction are browser-tested.
- [ ] A fixed public HTTPS URL is read back and verified.
- [ ] Desktop and 390×844 browser checks pass with zero console errors.
- [ ] `visualAcceptance=true` is granted by the user.
- [ ] `productionReady=true` is supported by complete evidence.

Current state remains `interactive3D=false`, `browserPassed=false`, `visualAcceptance=false`, and `productionReady=false`.
