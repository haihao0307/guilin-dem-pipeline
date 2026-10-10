# Native actor contract probe

Read-only probe of the existing public human platform and original R19 room. Production code and assets are unchanged. The test reuses the actual AnimatedHuman mesh and hand coordinator, under one existing scene and renderer, with an explicit host time supplied by the probe.

The current HandBodyCoordinator hands.palmMatrix is a wrist matrix. The shape model's lastBodyDriver.rig does not follow AnimatedHuman motion; current posed matrices must come from that actor's latest evaluated frame, after updating its mesh.

The probe measures a real palm skin triangle, its barycentric point, and wrist-relative rigid frame, then checks movement at host timestamps. The palm-side orientation is inferred from native skeletal landmarks and requires review of the actual close-up screenshots. It does not claim finger-pad grasp, force closure, or universal validity under every hand/body shape. Rigid-frame drift is reported against the actual skinned triangle; it is not hidden.

Original room triangle-vs-ticket-OBB queries demonstrate a real tea-geometry obstacle veto and an empty table-strip case. This does not complete dynamic hand/cloth, containment, or swept collision checks. No story performance, hand-to-table reach, pickup or release is claimed complete.

The test uses only GET requests and never saves a model archive or changes the public page. The isolated in-memory actor parent is restored before closing the browser. Evidence is the report and real screenshots. CI success must not be relabelled as full palm/grip or story acceptance.

## Independent contract R02

`native-actor-contract/hand-anchor-r02.mjs` is a candidate version; it does not overwrite the delivered director R01. It accepts and copies explicitly validated Array, Float32Array and Float64Array matrices. Missing/NaN/Infinity/negative clocks reject before pose access. Both frame and calibration must match topology, adapter and the per-actor shape fingerprint. The measured fingerprint includes original positions, rest matrices and archived actor state, so 36 body shapes cannot share a generic offset.

The host binding reuses an existing actor and evaluator, requires its independent playback to be paused, updates its skin first, then records that exact host frame. Equal elapsed returns the existing frame without advancing or reevaluating; backward time requires a new take. It creates no person, second rig, renderer or requestAnimationFrame loop.

The surface provider samples the actual bound triangle through full-CSR `human.sampleVertex`. The origin is its barycentric point. +Y is the measured outward surface normal; +Z is a material tangent toward the fingers; +X is Y cross Z. Each hand is calibrated independently, including triangle winding sign, rather than mirroring a matrix with determinant -1. A collapsed triangle or tangent rejects. It uses the existing mesh.matrixWorld, which already includes the native Z-to-Y rotation and floor placement; there is no extra axis conversion. A separate rigid-wrist provider remains available for compatibility, but its drift is explicitly reported and never represented as exact skin attachment.

Actual skin-follow and frame continuity are checked across native open/fist/pinch/grasp/carry samples. A head-bone-only rotation checks independence; GNM facial-expression deformation is not tested by this contract. Camera lighting and the palm screenshots are for contact-marker review only, not a skin-quality acceptance.
