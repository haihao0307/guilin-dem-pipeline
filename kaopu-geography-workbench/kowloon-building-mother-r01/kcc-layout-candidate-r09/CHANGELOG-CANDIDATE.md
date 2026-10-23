# KCC observed layout integration R09 candidate

Status: local candidate only. Not published, browser visual QA not run, actual interior registration not complete.

Restored the published R07 viewer's 111 files and verified each Git blob SHA against commit 3039d579912f346841897d90e29411bb767f3e5b. Original source shapes, heights, floor elevations, elevator runtime, and renderer are unchanged.

Added kcc-observed-layout.mjs and kcc-observed-panel.mjs. Modified only semantic-app.mjs and index.html for integration. The observed layout attaches to KCC localModel and survives prepareBuildingLifts and composeBuildingScene. It has source-labelled 5–17/F and 18–26/F families, 3 elevator interfaces, 2 stair-route entries, 6 dwelling entry doors per covered floor, explicit voids/fills/opensBetween links, and sixth-floor platforms only on 6/F. Unsupported 4/F and 27/F deliberately show a missing-plan state. This does not change the count or height of the existing building.

The panel is shown only for KCC. It has source links, real floor labels, keyboard/click element inspection, and separates source-image pixel coordinates from metres. Neither source plan image is bundled. These are manually observed simplified zone boundaries, not completed interior walls or surveyed dimensions. Stair entries do not prove the full 3D scissor interlock or fire rating. Elevator interfaces do not prove equipment IDs or all operational stops.

The small source-coordinate drawing is a diagram, not a 3D screenshot. It exposes known layout while registration remains unresolved. It does NOT replace the 3D viewer, does NOT make source pictures look like a completed 3D interior, and does NOT claim full building delivery.

Tests actually run: node test-observed-layout.mjs, 326 assertions; node test-observed-panel.mjs, 12 minimal-DOM contract checks; node --check for changed/new modules. No browser visual test, no mobile real-device test, no public release.

Blocking true world placement: R0 and R180 both remain plausible; no independent orientation anchor or verified actual floor elevation. Existing candidate yaw is not proof. Do not turn on worldGeometryEnabled by choosing the smaller fit residual alone.

Rollback: restore index.html and semantic-app.mjs from source-manifest.json commit; remove the two kcc-observed modules. Unmodified R07 remains live.

Additional real visual finding: inspected official KCC appearance atlas B359971994401063A0_001.jpg (4096×4096). Facades are largely obscured by construction scaffold wrapping. This is not an adequate independent window/vent/entry orientation anchor. Roof equipment visibility does not identify a lower-storey meter-room side. Both source family plans were actually viewed again during this implementation.

Core ownership: 3 building-owned plan slots are shared across observed floors. Cross-floor correspondence is explicitly inferred from repeated row order, not a claim of identified equipment or certified served stops. No arbitrary elevator positions are copied into measured world geometry.
