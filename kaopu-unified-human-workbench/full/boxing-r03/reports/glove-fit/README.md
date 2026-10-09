# R03-only cuff-mouth fit repair

Use GlovesR03.mjs only for the R03 original18 authored-program candidate. The preserved R02 Gloves.mjs remains byte-identical (376ec6d97f3a86f4368c5f5df4ad50db3de8da8aacbb16a4aadc445e3b989616).

## Scope and change

The stricter R03 audit found near-mouth forearm bulges on four rounded-female age shapes, not exposed fingers or palms. Targeted legacy-motion probes reproduced the same issue under preserved R02, including a4.2557 mm middle-age witness. This is a local fit repair, not evidence that R03 choreography created the baseline defect.

Only the two outermost cuff rings and the matching inner mouth edge change. Outer mouth radii increase6 mm; the second ring increases4 mm in X/dorsal and4 mm palmar at reference stature1.75m. The deep lining and third ring remain unchanged. The hand/knuckle/attached thumb/palm, contact centre, rig, skin, and test thresholds do not change. The inner rim remains physically present; no skin masking is used.

## Original18 fit verification

- PASS: the four formerly failing shapes ×18 programs ×AB replay exactly the original pose-time lists: 12,868 actor poses, 42,873,854 full-CSR hand/forearm vertex checks, zero raw outside vertices. Original raw outside-state count: 15,874.
- PASS: other32 shapes ×18 programs ×AB representative regression: 14,931 actor poses, 49,669,288 vertex checks, zero raw outside vertices. Covers guard; first own jab/cross/hook rise,peak,recovery; first response of each kind; both native wrist extrema from the unchanged-motion full scan.
- Total: 27,799 actor poses, 55,598 glove states, 92,543,142 skin checks, 77,392,416 finger-heavy checks; zero outer escapes.
- Coverage includes the64.2971° original18 wrist maximum. These are finite samples, not continuous collision certification or every original18 frame.

## Geometry and runtime budget

Each glove remains481 vertices,770 triangles,one draw. Cuff update remains192 vertices.80 authoring vertices change and401 stay identical; index buffer and part triangle counts are identical. All changed vertices lie at y≤-0.111m in reference glove coordinates. The original authoring mouth ring radii only expand.2,880 posed root-matrix comparisons are exactly identical.

72-glove CPU-only microbenchmark: 0.912 ms mean and 1.434 ms p95 over240 measured frames. This is not browser FPS. Independent mutable buffers,no cross-actor writes,and unchanged fixed fist all pass.

## Independent limits

Deep inner-lining/skin intersection remains separately recorded. The strict combined internal-nonintersection gate is not passed; do not relabel these reports as a completely intersection-free glove.

The new adult contact-opening study was separately tested using exact actual120Hz replay inputs for actors16/17 across0–8s (1,922 actor poses). It fails: A has10 outside vertex states,max0.318248 mm at t2.825s; B has zero outside states but reaches117.9794° wrist flex. This study is excluded from the current original18 integration. No extra third-ring study repair was applied. Keep R03-CONTACT-STUDY-FIT.json as a failed diagnostic.

## Source and integration

Final runtime GlovesR03.mjs SHA-256: 796b1cebc402fb66953ebef86707b30d8bcb44ccaf04ac79e590274996fd6d16
Staged full-sweep source SHA-256: 05872724791b2abbb5f379e8365c507e324f4d0227989b348c9a51f767de5c64
MotionR03.mjs SHA-256: 790a6e7c8980c6b354e8739f61509d53c9191265ada49bdb47d0eed404a52e14

Final module: human-boxing-r03-20261009/workbench/full/boxing-r03/GlovesR03.mjs. Its only source difference is the relocated Three import; both relative paths resolve to the same Three module. Final-artifact QA independently loaded that module and checked143 actor poses (all failing-row worst cases plus the original18 wrist maximum),286 glove states and476,491 skin vertices with zero raw outside states. Its posed positions,normals,colors,indices and root matrices exactly match the staged module. The R02 module is unchanged. See R03-FINAL-ARTIFACT-QA.json.

Reports: R03-CUFF-FIX-SUMMARY.json; R03-FIT-SHAPE-{16,22,28,34}.json; R03-OTHER32-REGRESSION.json; R03-GEOMETRY-QA.json; R03-CUFF-RUNTIME-QA.json. The parent integrated the final module into the R03 app; this worker verified its import and artifact but did not publish or deploy.
