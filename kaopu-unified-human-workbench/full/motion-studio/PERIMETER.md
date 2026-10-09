# Original workbench: 18 accepted R02 arenas and three perimeter actors

This mode shares the original human overview's scene, canvas, renderer and controls. It retains all 36 accepted R02 boxing actors and adds three independently generated complete canonical people: tall/slim child walking, rounded adult running/stopping, and sturdy senior jumping. Each has 25,417 vertices, 50,624 triangles, 104 native bones and all CSR skin weights. Camera focus never removes actors or substitutes reduced geometry.

R02 scene behavior is extracted from the previously published R02 modules. It does not run the separate pending R03 action-inventory workflow. The prior R02 page, single-person activity/hand/reaction/contact modes, presets, parameter ownership and old links remain available.

The new activity placements use the actual instantiated static R02 Box3 boundaries, including aprons, labels and steps. Conservative complete-motion body envelopes define three separated activity zones. The planner keeps at least two metres from the occupied arena geometry; the tested three recipes have at least 3.1 metres between their complete body sweeps. These are separated authored routes, not reactive obstacle avoidance or contact dynamics. Changed body recipes must be remeasured, not copied into old footprints.

A shared 120 Hz fixed clock drives all 39 people. Low rendering frequency preserves queued simulation time instead of dropping people or skipping state updates. Captured clips stop and hold; the whole demonstration pauses at the longest clip's end. Replay is explicit. The three converted CMU tracks and V4 retarget solver are unchanged from the reviewed single-person release; their source and usage boundaries are in ../activity-r01/SOURCE.md. No new third-party asset is introduced.

Full-scene, perimeter and individual-ring camera focus are provided. Browser evidence uses Chromium with SwiftShader software rendering. Offline fixed-step movies and software screenshot timing are not real-time hardware performance claims.
