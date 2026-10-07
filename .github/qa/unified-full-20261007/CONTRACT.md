# Full common-person rebuild

The public R01 and accepted neck repair remain separate frozen baselines. This directory reconstructs the missing full integration from immutable published teacher data. The lost 210-file R02 archive is not treated as available, and its historical scalar-response claims are not new verification.

## One person and source ownership

The runtime owns one fixed indexed canonical mesh and one persistent position buffer. Teacher models are evaluators. Their meshes are never switched into the canvas to impersonate a shared character. Each adapter records source vertex/triangle correspondence, coordinate transforms, source reference pose, canonical binding, provenance and measured residuals.

Store all source parameters independently. Rig ownership selects Anny or MHR. MHR's entire204-channel interface includes scale and joint translation; it is disabled, but retained, when the Anny rig owns deformation. Facial expression ownership selects GNM, Anny or MHR, avoiding repeated expression application. Head shape and native head articulation require explicit ownership when two teachers control the same anatomical degree of freedom. The chosen rig applies exactly once, with its own validated binding on the same canonical vertices.

Inactive source values must have no effect on the current mesh. Switching sources activates the saved values. Switching back exactly restores the previous state. A slot is not marked complete merely because a slider exists or a vertex changes; source semantics, extremes, visible geometry and saved/exported reproduction must pass.

GNM's four actual native joints are neck, head, left_eye and right_eye. There is no separate native jaw bone. Its12 rotation scalars use axis-angle radians and its3 translation scalars use metres. Anny's104-bone source uses rotation vectors in degrees, local-ref, with metre translations; legacy Euler values require explicit conversion. MHR source geometry is centimetres and its204 parameters use mixed native units. The MLP modifies rest geometry before skinning. All coordinate and rest-frame conversions must be written and tested.

## First implementation checkpoint

1. Restore pinned engines/weights and rerun342 MHR native reference fixtures; generate the1596-slot coverage ledger from actual model metadata, including37 locked MHR slots and separate non-scalar interfaces.
2. Add all GNM native pose/translation state and archive channels, and the corrected complete Anny body driver, in an isolated common-mesh implementation. Preserve zero-state geometry and the proven neck connection. Mark Anny head locals/actions pending until their semantic correspondence exists.
3. Build one dense, component-aware neutral head registration, using a documented non-rigid/ARAP or differential-surface method. Keep upper/lower lips, eye surfaces, ears, nose and inner mouth distinct. Preserve canonical GNM inner anatomy rather than substituting incompatible source cavities. Test paired native/canonical renders at the actual newborn(-1/3), baby(0), child(1/3), young(2/3), old(1) anchors from one case record.
4. Transfer full MHR identity, rig and rest-space corrective fields with a driver-specific binding. Measure source-reference static rest differences separately from dynamic motion errors. Verify elbow flexion/twist, hands, eyes/mouth and neck combinations.
5. Expose only genuinely connected controls in a desktop-first workbench, then run actual dual-engine combination, source-switch, archive and export checks. Photos/Groom, skin and clothing remain explicit separate ledger rows until connected.

## Reproduction

Run python restore_sources.py, then node audit-teachers.mjs and node build_coverage.mjs. SOURCE-LOCK.json pins each fetched Git blob and source commit. The restore script reuses verified local teacher bytes when present and otherwise reads the same immutable public URLs. No source model is bundled in this checkpoint, no full TorchScript model is downloaded, and no private input photos are published. The core implementation, every adapter generator and each accepted compact mapping will be checkpointed before subsequent work.
