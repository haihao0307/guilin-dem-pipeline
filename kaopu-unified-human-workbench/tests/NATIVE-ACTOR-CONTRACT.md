# Native actor contract probe

Read-only probe of the existing public human platform and original R19 room. Production code and assets are unchanged. The test reuses the actual AnimatedHuman mesh and hand coordinator, under one existing scene and renderer, with an explicit host time supplied by the probe.

The current HandBodyCoordinator hands.palmMatrix is a wrist matrix. The shape model's lastBodyDriver.rig does not follow AnimatedHuman motion; current posed matrices must come from that actor's latest evaluated frame, after updating its mesh.

The probe measures a real palm skin triangle, its barycentric point, and wrist-relative rigid frame, then checks movement at host timestamps. The palm-side orientation is inferred from native skeletal landmarks and requires review of the actual close-up screenshots. It does not claim finger-pad grasp, force closure, or universal validity under every hand/body shape. Rigid-frame drift is reported against the actual skinned triangle; it is not hidden.

Original room triangle-vs-ticket-OBB queries demonstrate a real tea-geometry obstacle veto and an empty table-strip case. This does not complete dynamic hand/cloth, containment, or swept collision checks. No story performance, hand-to-table reach, pickup or release is claimed complete.

The test uses only GET requests and never saves a model archive or changes the public page. The isolated in-memory actor parent is restored before closing the browser. Evidence is the report and real screenshots. CI success must not be relabelled as full palm/grip or story acceptance.
