# R07.1 joint geometric refinement candidate

Continues R07 / Draft PR177. Original R07, R06, original body, paper generation functions, panel UVs and old entry points remain untouched. This candidate is not published automatically.

The candidate adds an original double-precision limited-memory quasi-Newton refinement objective over original material principal stretches, the trilinear full-body signed-distance field, source-declared needle constraints and local inequalities identifying the material sides along source gathering seams. It then closes only source-declared needle pairs already within 0.2 mm. It does not delete triangles, change rest UVs, shrink the body, or load a solved garment at runtime. Local gathering inequalities remain active; they are not a complete cloth self-contact implementation.

The existing R07 dynamics and geometric stage are followed by 1600 joint objective steps. This is geometric fitting, not calibrated cloth dynamics, momentum conservation or a replacement for continuous collision detection. Physical fitting for arbitrary bodies and moving wear is still unaccepted. The displayed static engineering thresholds are 15% maximum tension/compression, 0.25 mm needle gap and no strict final intersections. Those thresholds are not measurements of the fabric's real-world tolerances.

The final check now includes positive-area coplanar overlaps and no blanket exclusion of all triangle pairs sharing a stitch group. It must run after late seam closure so welding cannot hide a bad overlap. This remains a finite-tolerance final-state check; it is not a collision certificate for the trajectory.

Before this commit, local diagnostics initialized from the previous solved default garment reduced maximum principal stretch from about44.6% to13.5%, with zero final strict intersections and 48 source stitch pairs closed (largest preclosure gap about0.116mm). This is only a local continuation diagnostic. It is not the live-source end-to-end result or a browser speed result. Live browser evidence is produced separately by this commit's Actions workflow for default/repeated, changed-length and changed-gathering inputs, with all failures retained.

Local Chromium navigation was blocked by the test environment. Testing was moved to GitHub Actions rather than claiming those local browser checks passed. No paid services or new hosting providers are introduced. No PR merge or forced push is used.
