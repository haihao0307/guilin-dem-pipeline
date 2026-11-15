# NPC life observation R02 — contact-driven window

This isolated observation workbench continues the publicly verified R01 implementation `85718686d88585a449c3add050a089c45eee1207`. The canonical complete human remains HUMAN-INTEGRATED-R07 from main `5543f756ca3af1428323696324303fa70b8de850`; its source SHA-256 is `d1bd7940b885cb872143bc0e68ce85fd2f663c81be36a18e58fc6086781cf31a`. R01 and the separate NPC living-courtyard work are preserved.

## Bounded change

Three complete native people retain their independent geometry, all 104 bones, full CSR influences, refined display ancestry and procedural skin. The new skill uses the actual hand surface to grip an authored cylindrical window handle, then opens or closes a single unlatched vertical-hinge leaf through a finite-force Cannon point constraint. The structural hinge remains in the world when a person releases the handle. Window pose is read from rigid-body state; only explicit scene reset writes the initial body transform.

The handle is deliberately thick (radius 32 mm, height 140 mm) because this iteration reuses each morphology’s measured cylindrical grasp. It is a specified utility interaction object, not a claimed standard window product. The measured arm envelope covers a 35 degree inward opening for all three selected-person stations and the A-left/B-right shared-window station. The pane, frame, physical stops and removable blocker use one set of dimension descriptors for collision and rendering.

Opening succeeds only after the actual angle is within tolerance, the leaf has low angular speed for a measured stable interval, and the hand constraint is removed. A real removable blocker stops the leaf before the target; its contact equations are retained as failure evidence. Cancelling releases the resource immediately, preserves the leaf’s pose and velocity, and completes withdrawal before a local-quaternion return to the native resting posture. The same completed recovery is now used by the original bottle skill.

The exit path uses the actual table body as an environmental input. Window release lowers the open hand by 100 mm and withdraws along the measured palm normal; near the closed window it extends that withdrawal until the palm target is 150 mm behind the table's rear edge. Bottle release retains its 30 mm upward clearance and places the exit target at least 190 mm behind that edge. These are measured sufficient allowances for the subsequent swept finger and forearm surfaces, including the paired right-hand station. They are not claimed universal settings for arbitrary rooms. An early cancellation that has made no handle contact and is already behind the safe plane returns directly to native rest instead of forcing the hand below its reach envelope.

Window approach reverses this measured exit path. The native actor first blends its real current pose toward the reachable lowered prepose using local skin-rotation deltas for 1.15 seconds. It then follows the reverse withdrawal segment toward the actual handle over 0.65 seconds, before closing its fingers. This avoids forcing the destination wrist frame onto the resting palm, and avoids the forearm/window-rail collision found in a normal-only pregrasp attempt. The first segment is a joint-space transition with no invented Cartesian palm target. Actual approach start, intermediate and end poses are recorded under the same task token; cancellation retains only the motion that actually occurred.

Native recovery interpolates local skin-rotation deltas around the original joint pivots. It preserves the small residuals in the source rest matrices and therefore the exact original bone lengths; converting those matrices to conventional normalized absolute quaternions was rejected by the numerical gate. First-failure measurements and their corrections are retained in `qa/root-cause-review.json` and the associated raw reports.

The table collection targets also account for the nearby window handle and the tall person's low reach. A first placement target let the open index finger intersect that other cylinder; the original bottle audit did not include it. The corrected diagnostics include the actual non-operated cylinder in both directions: the window handle during bottle tasks, and the bottle during window tasks. Weighted hand and forearm surface samples cover withdrawal and native rest as well as grasped poses. The target-change control still changes the physical goal far enough to invalidate the previous stable result. This is a measured layout for this workbench, not general automatic obstacle avoidance.

Continuous native bottle checks also exposed a table-edge sweep during approach and a contact peak during the fastest transfer. The approach retains its original endpoints and 1.4 second duration with a 40 mm vertical clearance arc. The existing grip equations now use their original stiffness and relaxation with the actual 1/120 second solver step, instead of Cannon's default 1/60 second coefficients. The finite 24 N per-axis force and 0.8 Nm per-axis torque limits remain in effect. Neither correction writes the bottle's physical transform. Both collection targets and all supported bottle stations are checked with actual production physics through completed rest.

The bottle-contact camera observes from the open left side above the table. The previous camera was blocked by the new window frame; its real screenshots and failed independent visual review are retained. No scene object is hidden to clear a camera.

## State and integration

`LifeWorld` owns the one Cannon world. `WindowInteraction` owns only the window resource and its temporary interaction. Bottle grips, window grips and the permanent hinge are counted separately. An actor cannot execute or recover two skills at once. Window requests, contact, release, actual results and recovery carry task tokens, object revisions and event sequence numbers. The JSON export reads this same world, including per-case test evidence.

UI changes between table and window workstations are explicit setup resets; continuous opening then closing uses the same leaf’s current physical state. There is no simulated walking or teleportation during a task. Existing identity-based table cooperation remains available.

## Build and independent verification

Run `node prepare.cjs` and `node build.cjs` from this directory, or pass their full paths from the repository root. They verify the frozen R07 host and pinned Cannon 0.20.0 dependency. The build remains in the original Three r170 document and produces the current candidate HTML.

Numerical checks are distinct from complete native browser verification:

- `qa/r01-causal-regression.mjs` runs the production bottle world with explicitly non-rendered motion inputs; it checks real support, finite force, missed contact, cancellation, contention and review invalidation.
- `qa/window-causal.mjs` runs the production window physics with explicitly non-rendered motion inputs; it checks real angular response, obstruction, cancellation, handover and per-axis force.
- `qa/window-host-integration.mjs` checks the actual shared host’s cross-skill ownership and recovery lifecycle.
- `qa/native-frame-recovery.mjs` uses the accepted native rig/CSR data to exercise current production hand-frame and recovery functions; it does not certify head rendering or GPU operation.
- `qa/native-withdraw-clearance.mjs actual` samples complete window withdrawal and rest paths against the actual pane, rails, mounts, frame, stops, blocker and table shapes.
- `qa/native-live-recovery.mjs` combines the production world and native body fixture to inspect dynamic window cancellation, early no-contact recovery and bottle exit paths. The fixture requires the accepted R01 `native-rigs.json` and `initial.json` artifacts plus unchanged canonical packet cache; it is separate from the reproducible full-browser CI gate.
- `qa/native-cross-object-clearance.mjs` checks both bottle targets against the actual window handle, including continuous production approach, held motion and completed withdrawal/rest. Authored pose-path results and actual rigid-body results have separate reports.
- `qa/native-window-cross-object.mjs` checks actual production opening and closing against the other bottle and the window's own handle, including the previously unmeasured pre-contact interval.
- `verify-browser.cjs` independently verifies complete native startup, actual UI operations, full hand/forearm surface samples, retained R01 cases, the twelve in-page cases, current world export and a 390 px viewport. It captures the actual rendered frame through the existing queue.

The frozen contact tolerances distinguish the assisted handle cylinder (5 mm) from other physical solids (3 mm). A temporary numerical probe initially applied 3 mm to both; its original result is preserved with that discrepancy identified. The production path and independent browser thresholds were not changed to accommodate the probe.

The later cross-object correction strengthens object coverage under those same thresholds. It requires actual per-cylinder descriptors and nonzero hand/forearm samples, so a missing other object cannot silently pass as zero penetration. The earlier verifier and its first browser results are preserved as historical evidence, not reused as acceptance for the corrected candidate.

The R02 workflow uses one suite startup, retains the original full-native startup gates, then publishes only a new immutable version directory. It must subsequently read back the exact public HTML/build and repeat key interactions in a real browser. A generated local build is not public acceptance. Final publication proof is stored on a separate evidence branch pointing to the exact tested runtime head, so adding the receipt cannot change the tested runtime.

## Known limits

This iteration is a fixed-workstation observation scene. The hand uses bounded assisted contact, not simulated five-finger friction closure. The body uses native IK/skinning, not complete rigid-body dynamics. Geometry checks sample actual weighted hand and forearm vertices at defined phases and angle intervals; they are not continuous triangle collision certification. There is no latch, room navigation, arbitrary language planner, cross-device multiplayer or measured user-phone frame rate. Actual CI frame timings describe that tested browser and renderer only.

User attachments 01–04 guided the identity/behavior/pose/physics/skin boundaries and versioned-data contract. Attachments 05–06 were historical references; no old human or animal mesh/runtime replaced the current native people.

## Required delivery gate

- No generated image substitutes for real 3D.
- Actual production source is modified.
- The deliverable is an interactive real-time 3D workbench with usable cameras and controls.
- Exact current-source numerical and real-browser evidence is required.
- A fixed public HTTPS URL must pass HTTP, version, resource and real-browser checks before sharing.
- Screenshots alone fail delivery; human visual acceptance and production readiness remain separate from machine tests.

Read acceptance from the exact runtime's CI artifacts and publication receipt. The corrected native production summary is separate from the preserved first-candidate reports; numerical or contract checks alone do not establish browser or public acceptance.
