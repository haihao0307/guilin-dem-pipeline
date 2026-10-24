# KCC observed layout integration R09 candidate

Status: independent candidate preview. Actual browser and full-page gates passed; actual interior registration is not complete. Earlier notes below preserve the sequence and limits of prior checkpoints.

Restored the published R07 viewer's 111 files and verified each Git blob SHA against commit 3039d579912f346841897d90e29411bb767f3e5b. Original source shapes, heights, floor elevations, elevator runtime, and renderer are unchanged.

Added kcc-observed-layout.mjs and kcc-observed-panel.mjs. Modified only semantic-app.mjs and index.html for integration. The observed layout attaches to KCC localModel and survives prepareBuildingLifts and composeBuildingScene. It has source-labelled 5–17/F and 18–26/F families, 3 elevator interfaces, 2 stair-route entries, 6 dwelling entry doors per covered floor, explicit voids/fills/opensBetween links, and sixth-floor platforms only on 6/F. Unsupported 4/F and 27/F deliberately show a missing-plan state. This does not change the count or height of the existing building.

The panel is shown only for KCC. It has source links, real floor labels, keyboard/click element inspection, and separates source-image pixel coordinates from metres. Neither source plan image is bundled. These are manually observed simplified zone boundaries, not completed interior walls or surveyed dimensions. Stair entries do not prove the full 3D scissor interlock or fire rating. Elevator interfaces do not prove equipment IDs or all operational stops.

The small source-coordinate drawing is a diagram, not a 3D screenshot. It exposes known layout while registration remains unresolved. It does NOT replace the 3D viewer, does NOT make source pictures look like a completed 3D interior, and does NOT claim full building delivery.

Tests actually run: node test-observed-layout.mjs, 326 assertions; node test-observed-panel.mjs, 12 minimal-DOM contract checks; node --check for changed/new modules. No browser visual test, no mobile real-device test, no public release.

Blocking true world placement: R0 and R180 both remain plausible; no independent orientation anchor or verified actual floor elevation. Existing candidate yaw is not proof. Do not turn on worldGeometryEnabled by choosing the smaller fit residual alone.

Rollback: restore index.html and semantic-app.mjs from source-manifest.json commit; remove the two kcc-observed modules. Unmodified R07 remains live.

Additional real visual finding: inspected official KCC appearance atlas B359971994401063A0_001.jpg (4096×4096). Facades are largely obscured by construction scaffold wrapping. This is not an adequate independent window/vent/entry orientation anchor. Roof equipment visibility does not identify a lower-storey meter-room side. Both source family plans were actually viewed again during this implementation.

Core ownership: 3 building-owned plan slots are shared across observed floors. Cross-floor correspondence is explicitly inferred from repeated row order, not a claim of identified equipment or certified served stops. No arbitrary elevator positions are copied into measured world geometry.

## R09 detached analytic 3D candidate increment, 2026-10-23

The same page now contains a lazy-start KCC analytic 3D structure panel, not just the diagram. It uses the existing WholeRenderer and finite polygon fields, without an object mesh. The actual three-building baseline still is not changed. User-editable scale, wall thickness/height, door width and stair rise are explicitly inspection assumptions. R0/R180 remain switchable, unregistered hypotheses. There is no arbitrary new three-storey building.

The candidate shows six dwelling floor zones and perimeter walls, entry holes with hinged leaves, a central lobby, three elevator interfaces with independent sliding leaves and cabin-floor plates, meter room and two schematic stair routes. The lower A-flat partition evidence is reused. Other flat interior partitions are not falsely claimed complete. Stair flights are inspection schematics and not a validated scissor-stair interlock. Sixth-floor platforms remain limited to actual 6/F. Upper-family geometry is independent. Standard lower, sixth and upper candidates contain respectively 121, 123 and 104 analytic primitives.

Added kcc-candidate-structure.mjs, kcc-candidate-viewer.mjs and test-candidate-structure.mjs. Same-page 3D hides/pauses outside KCC; no material rework. Fixed canvas hidden/display conflict before QA. Node candidate tests passed 586 assertions; previous 326 data and 12 minimal-DOM checks still pass. These are not browser proof.

Actual browser QA now submitted to the existing read-only Actions workflow on QA branch only: commit f540fccb75c214476be54cc9ff33f3f4834be235, run https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/40033038826 . Workflow unchanged, original test body retained behind an explicit candidate entry. No production deployment. Browser outcome pending.

Rollback remains independent: original R07 directory and public Pages are unchanged; do not deploy this candidate until the browser gate is reviewed. Remove candidate test entry prefix to resume the original QA gate.

Actual browser result: first run 40033038826 rendered all 7 snapshots and passed interaction assertions, but the workflow failed in test cleanup because browser.close occurred after Playwright exited. That failure is retained. Cleanup-only revision c3a1209783ab07de5bbdb1d5c8702f030c6640b9 passed run 40033338981. Full-page plus actual mouse-drag verification is tracked separately in run 40033471933. No physical device performance claim.

Full-page and actual mouse-drag gate passed: https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/40033471933 . Full-page screenshots reflect the existing independently scrolling columns; they are not stitched composites. Three-building-before-candidate and same-page-layout screenshots are separate real captures.
