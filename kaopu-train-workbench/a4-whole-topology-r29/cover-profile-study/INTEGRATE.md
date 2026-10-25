# Cover-profile candidate handoff

Copy these into the R29 candidate root, leaving baseline files unchanged:
- build_middle_chest.js
- middle_cover_export.js
- cover_geometry.js
- middle-chest-fields.js (or run node build_middle_chest.js)

The local topology-parameters.js is an unchanged copy of current R29. Do not overwrite newer parameters without review.

Copy material-waves.js to material-wave-study/material-waves.js. This adds explicit part material-descriptor support and a light-paint appearance preset, preserving all seven retained preset indices and all 519 original assignments.

No changes to middle-chest-dynamic.js are required: the four moving heads retain the same frameSourceId and same-Time motion binding. No middleX or lever geometry changed. The old guide envelope is retained as two nominally face-contacting inferred fields (short central gland + remaining guide); it is not attributed to the right-hand guide in o1332.

Final generated pack has 49 physical field descriptors: 45 fixed, four moving. Both covers have six finite studs, six washers and six true six-plane hex nuts, with real cover holes and housing stud sockets. Pattern/count/dimensions are inferred. Rear central projecting housing is separate, annular and fixed (45 mm long, 43 mm outer radius, both inferred).

COVER_EXPORT.json includes CPU shape AST, GLSL, exact interfaces, material descriptors and evidence. The emitted GLSL uses existing mDisc/mBoxInf/mCylZ/mLocal/dot primitives plus the existing topologyWebOuter helper form; the current Python scalar exporter already handles those primitives and straight-line helper. No new GLSL primitive is needed.

Run node test_cover_export.js from this study for scoped checks. COVER_EXPORT_QA.json records 1,113,000 checks, CPU/GLSL max difference 4.44e-16, zero same-Time motion error, 519 unchanged baseline visible fields and no sampled positive-volume local overlap (only fixed chest wall/web are declared one casting). No removable-cover collision exemption is used. Whole-train and browser review remain with the integrating task.

Both covers retain full bore closure (radius .1143 about X=.38) and open rod passage. X=.262 profile edge gives 2 mm clearance from the original power wall's X=.26 bound and 3.7 mm bore bearing land. Leading local shape is source-grounded but uncalibrated; rear mating-edge flat is separately declared inferred, not represented as photographed. Web begins at Z=4.382, 2 mm after rear cover end.

Strength is unknown, not a blocker to this GAME shape/hierarchy/motion candidate. No pressure-vessel certification or historical numerical calibration is claimed. Source photographs were inspected locally and are not included in output.
