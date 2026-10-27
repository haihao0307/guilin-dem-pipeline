# Verified checkpoint notice

The final code commit efea4b14b95e38d93667f9508ed28343568edeec passed whole browser/GPU QA run 40168956263. Read R31_WHOLE_RESEARCH_RESULT.zh-CN.md and R31_SCOPED_ACCEPTANCE_QA.json for current bounded acceptance. Earlier pending statements below are retained development history, not current status. This does not complete the steam circuit or historical/mechanical certification.

# R31 minimal whole-train steam connection candidate

This revision continues the same whole A4 research bench, preserving the R30 model and original failed baseline. It adds no isolated part viewer, second clock, object mesh, point cloud or CFD system.

## Bounded implementation

- Reuse the existing boiler, smokebox, superheater-header shell, valve chests, cylinders and their analytic domains.
- Distinguish pre-/post-superheat header spaces. The unbuilt superheater element loop is an explicit break; no internal shortcut may claim to superheat steam.
- Build the evidenced three supply branches as separate steel pipe, finite lens-ring interface and cast top-pipe candidate relationships. Placement dimensions remain inferred.
- Join the existing outside working-port stubs and the new middle-chest working ports to the correct cylinder end spaces. A tube ending against intact cylinder metal is not connected.
- Working chambers follow the existing piston pose and installation beta at the same Time. No new pressure, flow rate or historical valve-event solution is claimed.
- Upper boiler takeoff/regulator/main-pipe details and internal exhaust convergence remain explicit missing interfaces; the existing nozzle/cowl/chimney is an open jet relationship, not a closed pipe.

Every host change is candidate-only, explicit port subtraction. No frame or axle carving is allowed. New pipe/header partitions/flanges are independent fields for neighbor checks; sharing a fixed parent is not permission for arbitrary intersections.

## Evidence and status

Official topology and unresolved dimensions: steam-evidence/OFFICIAL_STEAM_CHAIN.zh-CN.md. Existing fields and the measured 20.893 mm outside working-stub gap: steam-evidence/EXISTING_INTERFACES.zh-CN.md.

Inherited R30 browser and saved-point results remain scoped to the R30 code. The old baseline negative-control regression proves its known failures can still be reproduced; it is not a failure measured in every new candidate. R31 must earn its own interface, finite-solid neighbor and whole-browser results. Until those are recorded, this revision is local implementation, not a verified complete steam network or exact 60009 model.

Official images are not included. Earlier analytic-source provenance and required research attribution remain unchanged. No final public release is claimed.

## Actual GPU numerical failure and bounded correction

Commit 229f6c4 rendered the 12 whole states, UI controls, legacy720 equivalence and both 1440 views, but failed 58 of 1,068 steam scalar comparisons (maximum 0.970127 mm). Diagnostic commit 75708031 independently measured inaccurate native sine/cosine on the software GPU. Neither run is a complete acceptance.

The current correction changes candidate-only GLSL evaluation, not geometry, dimensions, source CPU formulas or the 4 micrometre gate: bounded beta polynomials, equivalent algebraic circular fillets, and consistent candidate host/slider beta helpers. Original dynamic.js and baseline native branches remain. precision-study preserves original failure, complete samples and runnable equivalence/CPU locks. Actual post-correction GPU and whole-browser verification is pending. The early GPU gate also checks original same-Time crank/slider coordinates so a newly fixed port cannot hide a drifting host.

The a0bbaad5 actual GPU rerun cleared every steam scalar sample (max 4.87581e-7 m, zero unsafe sign differences) and beta host coordinates. The expanded same-Time gate still failed retained dynBig/native phase calculations at 30-37 micrometres. A subsequent candidate-only dynBig correction now applies the already modeled bounded phase polynomial for |phase|<=16, preserving native baseline and a native fallback outside that precision range. No geometry, phase offset, time speed or mechanical dimensions changed. All three cylinder sides are now included in the actual dynamic readback gate. Actual full post-correction acceptance remains pending.
