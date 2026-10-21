# KAOPU elevator mother R01
Independent learning demonstration, not a certified or real-world elevator controller.

Original files in this directory implement a state machine, analytic box fields and UI. No Skyscraper source, translation, geometry, texture or binary is included. Rendering imports the already-authored KAOPU R07 material closure from `../r07/material.mjs`, preserving its source and provenance rather than replacing the material system. The 66-function closure SHA is `9529e503f97be77a9f24fa00489e702f792417be07f60add7ee917d20c451ed8`. Exact box-field ray intersections are used; there are no model triangle meshes, GLB assets or model vertex buffers. A screen-covering triangle is solely the shader dispatch primitive.

## Interface
Building: ordered floors `{id,label,elevation,served}` in metres relative to explicit ground datum. Lift: car position/velocity, distinct car door and floor-indexed landing doors, separately confirmed lock flags, FIFO request records. G/F are alternate ground labels. B1/B2 are illustrative design levels, not verified building facts. Brand and actual-building service-floor facts remain unknown.

Default illustration: four stops B2 −6.8 m, B1 −3.4 m, G 0 m, 1 +3.4 m. Rebuilding a floor table explicitly resets the car. A nonserved floor remains in the geometry but cannot be selected/called. At least two service levels are required. The UI changes service flags/elevations; validation is atomic and rejects invalid tables.

Trajectory is an independently authored quintic interpolation with duration chosen for maximum speed 1.5 m/s and acceleration 0.75 m/s². Door time 1.8 s, dwell 3 s, lock confirmation 0.25 s, tolerance 0.01 m. These are design values, not manufacturer or regulatory claims. No jerk limit, group dispatch, fire service, evacuation, emergency braking, certification or hardware controls are claimed. The FAULT branch is an invariant alarm/freeze, not a physically valid emergency stopping controller.

Car doors follow the car; each landing door remains at its floor. All doors close before independently timed locking and travel. A moving trajectory prevents door opening even at its initial zero-velocity sample. Normal opening requires zero velocity at a selected floor. During closing, simulated optical obstruction reopens both current doors and holds until clear. Other landings remain locked. Right car wall is omitted only for the teaching cutaway. No hoist mechanism or real installation is asserted.

## Learning evidence, not borrowed implementation
Teacher behavior was observed separately in original Skyscraper Simple, pinned v2.0.4. Native runtime logs in GitHub Actions run 39598312893 show hall call/dispatch/opening; car selection; sensor hold/reset; closing before starting; leveling before arrival/opening. Its LevelingOpen parameter was explicitly zero for this observation. Sensor events were API simulation, not physical obstruction detection. No lock-fault rejection was runtime-tested there. Our tests are our own checks, not a teacher certification or proof of real safety.

## Validation
`node --test tests/model.test.mjs` tests model and geometry. `python tests/browser.py` is intended for ordinary GitHub Actions runner and starts a runner-local HTTP server to inspect actual Chromium rendering and UI. It is not to be run as a workaround for a restricted local listener. `--base https://…/elevator-mother-r01/` tests a published URL without starting a server. Screenshots require manual visual inspection. 390px simulation is not iPhone hardware testing. Draft PR only; publication is separately coordinated with the existing Pages single writer.
