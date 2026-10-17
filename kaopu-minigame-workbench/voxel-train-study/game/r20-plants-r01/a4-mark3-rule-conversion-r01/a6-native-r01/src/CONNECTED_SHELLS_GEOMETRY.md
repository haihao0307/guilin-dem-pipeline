# Native A6 coach and closed tender, independent R01 case

## Delivered API

- `buildA6CoachShell(params={})` in `a6-coach-shell.mjs`
- `buildA6TenderShell(params={})` in `a6-tender-shell.mjs`
- Both return independent pure typed-array `parts`, `parameters`, `bounds`, `interfaces`, `openings`, `evidence` and completion limits. No Three.js or teacher asset is needed.
- Each part has a name, semantic material, category, metadata, Float32 positions/normals/UVs, Uint32 triangle indices and the R01 single-material group contract.
- Both accept `crownHeight` (default 4.03). Coach includes bodyWidth, windowWidth, doorOpenAngleDeg and bogieHemHeight. Tender includes width, zStart, length and bottom. Invalid values fail explicitly.
- `sampleTenderHalfWidth(y,z,params={})` registers independent branding to the actual curved outer surface. `sampleA6TenderSideSurface(y,z,side=1,params={})` adds a surface normal. The requested emblem domain z16.85–18.55/y2.37–3.23 is unobstructed by the new service panels.

## Geometry and integration boundaries

Coordinate convention: x lateral, y up from rail, z rearward. Coach z=0 is its own midpoint. Tender uses the locomotive rest frame.

| Element | Native design extent/interface |
| --- | --- |
| Coach body | z −11.285…11.285 |
| Coach short outer fairing tips | z ±11.445, open underneath below y1.60 |
| Coach flexible gangway tips | z ±11.475 |
| Protected complete mechanical ends | z ±11.49; not moved or deleted |
| Coach floor | top1.24, underside1.175, unchanged |
| Coach original bogies | centres±8, wheelbase2.6, nominal tread diameter0.914, all238 parts remain external |
| Coach body crown | y4.03 |
| Coach bare width | 2.740; independent gaskets make the complete shell/trim envelope2.758 |
| Tender | z12.90…20.50, bare width2.743, bottom1.60, body crown4.03 |
| Tender bearings | existing top1.565; new bottom has35mm static vertical margin |
| Tender axle centres | 13.681075 /15.281275 /16.957675 /18.557875, unchanged |
| Shared flush gold line | y1.96,18mm high, independently editable |

The parts do not generate, rebuild, resize, hide or simplify running gear. The parent must continue attaching all238 original coach mechanical components and the full locomotive/tender mechanics. The input validators freeze the coach floor, body-length interface and bogie-centre controls. These are design metres, not a complete measured A6 engineering model.

The locomotive-to-tender reference12.17295 leaves0.72705m to the tender outer front. The proposed assembled coach centre32.34 leaves0.35m from the tender body end20.50 to the coach mechanical front20.85, and0.365m to the coach gangway tip20.865. The actual tender mechanical maximum20.186767 is a cross-stretcher, not a coupling endpoint; its numerical distance to the coach front is0.663233m. These offsets remain provisional static display placement. No shell surface rigidly joins two vehicles; exact coupler, articulation and turn clearances remain unverified.

## Reference-led changes

The six contact sheets01–34, R08 concept and the marked15:17:47 side view were actually inspected before implementing. The audit’s geometry requirements were read. The current native-design scope takes precedence over the older source-overlay/uncalibrated comparison context.

- REF03,10,11: one coherent skin and finite separated inside/outside surfaces; no reconstructed teacher vertex arrays.
- REF19,20 and R08: real smooth roof-to-shoulder tangency, dark-green body/roof, quiet dark window ribbon and a very thin flush gold inlay. The line continues on independent door leaves and moves with their hinges.
- REF01,02,14,15 and the marked side view: two long raised bogie openings rather than decorative small wheel holes. The side hem reaches1.24 at the bogies and eases around the retained low vestibule door sills. Original underfloor equipment and mechanics remain separate.
- R08: the tender is a genuinely closed oil/water concept body; no open coal bunker, rolled open rim or coal geometry is reused.
- REF19,20,34: short independent end transitions, real body gaps and an open mechanical corridor below the interface. No tube-like shoulder strips, oversized end ornaments or rigid full-train bridge.

The coach reuses the complete first-party native R01 aperture algorithms and all24 original aperture domains:16 saloon windows,4 vestibule windows and4 side doors. Every reveal/gasket/glass/door leaf remains a separate editable part. Its24 glazing solids comprise20 independent side panes plus4 door panes. Each pane now has an outer face, an inner face14mm inward along its section normal, and a sealed rim. This corrects R01’s zero-thickness glazing only in the new A6 case; R01 and R02 were not changed.

The tender is a new analytic closed cross-section sweep with quarter-ellipse compact end returns. Main skin, front/rear caps and front/rear faces are separately editable. The inner lining is independently closed and inset. The service panels are flush sealed concept covers; their labels do not establish reservoir engineering or capacity.

## Verification

Run: `node --test a4-mark3-rule-conversion-r01/a6-native-r01/src/a6-connected-shells.test.mjs`.

Result:20/20 passing, including two isolated static-coupling checks. Details and reproducible hashes are in `a6-connected-shells.qa.json`.

- Typed arrays, finite values, unit normals, index ranges, nondegenerate Float32 triangles and face/normal orientation.
-24 actual body openings, retained rounded corners and independent reveals/gaskets.
-24 separate glass solids, each with every welded edge incident to exactly two triangles; measured normal-offset thickness14mm within3µm Float32 tolerance.
- Actual roof/shoulder positions and tangent normals agree, including the tapered coach ends.
- Tender outer body and inner lining each form a closed oriented two-manifold.
- Both crowns4.03, independent compact interface bounds, fixed floor1.175 and tender bottom1.60.
- Actual triangle-plane slices over both complete bogies show a minimum76.5mm outer-hem clearance; this is a static projected-visibility screen, not suspension travel certification.
- All238 original coach mechanical parts retain the same complete geometry-array SHA through repeated shell edits.
- Crown, width, door and window edits regenerate geometry without source assets or network/file access at runtime.

The coach emits126 parts; the tender emits20. CPU tests do not establish appearance in the final renderer, material lighting/visibility, aerodynamic performance, structural safety, full three-dimensional interference, coupler movement or train-level engineering completeness. Integrated rendered review and user visual approval remain separate.

## Coupling inventory check

- Locomotive↔tender already has `locomotive-tender-draw-link-0/1/2` and `drawbar-interface-mounts`, with the main link spanning approximatelyz11.9866–13.0811. Those complete original native components must remain visible.
- There is no generated tender rear coupling head. `tender-cross-stretcher-4` reachesz20.186767 but is not a coupler.
- `tender-end-dragbox-1` is present atz19.827875–20.127875, y1.03–1.465. This is a structural attachment candidate, not proof of a coupling interface.
- `end-services--1-coupling-head` on the coach is present at localz−11.49…−11.35, coupling design height0.82. At the proposed32.34 offset it reaches globalz20.85…20.99.
- The explicitly approved `buildA6StaticCoupling({coachOffsetZ:32.34})` in `a6-static-coupling.mjs` now supplies a separately declared6-part static drop adapter/link. Its rear beam attachment face is20.077875, new low pin is[0,.82,20.16], and the existing coach-head construction centre is[0,.82,20.91]. It accounts explicitly for the0.48m height difference and does not use the cross-stretcher as a coupling endpoint. The6 added pieces must be counted separately from fixed338 locomotive/tender pieces,6 main wheels and238 coach pieces, and remain visible in shell-hidden views. This is only an authored static layout connection; compatibility, load transfer, strength, articulation and collision certification remain unverified. No original mechanism was changed.
