# R1 torso and left-axilla correspondence repair

The two named R0 failure cases were reproduced and repaired through the **actual neutral correspondence**, without changing the canonical mesh, target bind skeleton, native MHR engine, corrective transport formula, or smoothing an evaluated pose. `baseline-r0/` preserves the failed map, runtime source, reports, images and key geometry. The default runtime assets now use R1.

## Diagnosis

The R0 torso source-to-target initialization applied each joint's segment-length ratio isotropically. The c_spine3 ratio is 1.897, so its transverse chest/back radius was also inflated. This was an initialization error, separate from the intentional native MHR versus target Anny rest-shape/palm difference.

The failed canonical edge [4954,4975] is 6.455814 mm long at neutral and stretched to 14.735036 mm in native pose {44:.4,45:.3,46:1}. Both endpoints belonged to the **same** left-arm correspondence region, ruling out an argmax region-boundary explanation. Their registered source distances were 32.046 and 34.120 mm. The first mapped to source triangle [8114,6589,6588], the second to [6697,6698,6699]. Full native skin weights differed by L1=.385238, including an abrupt .088836 c_spine2 contribution. This is documented in `baseline-diagnosis.json` and `experiment-r1/repair-analysis.json`.

## Construction

`register-body.py` performs one offline route:

1. Initialize the source from the existing complete skeletal alignment, using longitudinal rather than isotropic length scaling for spine/neck/clavicle/limb frames. Palm/finger initialization remains unchanged.
2. Solve a continuous source-vertex displacement field on the original source mesh graph. The objective combines the Laplacian of displacement, anatomical source→target surface constraints, symmetric target→source barycentric surface constraints, and a small fixed regularizer.
3. Use a support band wider than the data-fitting band. This lets the nape/collar move continuously instead of artificially pinning a neighboring row of source vertices. The pinned model's fitting band is native height .77–1.51 m and |x|<.36 m; the smooth support extends to .70–1.65 m and |x|<.43 m. These are generator anatomy/support bounds, not runtime or acceptance thresholds. Source facial geometry in the support band is not emitted as common head geometry.
4. Use fixed stiffness stages 30,10,3,1,.3 with 4,4,6,6,8 iterations. The source mesh, target mesh and anatomical region evidence remain fixed. The symmetric constraints are necessary: a one-sided closest-surface fit could leave the target axilla concavity uncovered.
5. Rebuild the same three-source-vertex barycentric mapping and full influence weights. No native influences are pruned; no post-pose or target-output smoothing is used.

The registration takes about 16 seconds on this environment; compact-map extraction takes less than one second. Runtime remains the existing direct native MHR inference and one target skinning pass. There is no runtime registration/Poisson solver and no new dependency or teacher download.

## Measured results

| Measurement | Failed R0 | Repaired R1 |
|---|---:|---:|
| Torso median neutral surface distance | 32.162 mm | 0.581 mm |
| Torso p95 neutral surface distance | 79.437 mm | 2.467 mm |
| Torso maximum neutral surface distance | 113.744 mm | 11.975 mm |
| Torso sampled source normals facing opposite target | 4 | 0 |
| Axilla endpoint weight L1 difference | .385238 | .032609 |
| Axilla posed length, original shoulder+elbow case | 14.735 mm | 6.839 mm |
| Same edge stretch ratio | 2.282× | 1.059× |
| Same edge, pure shoulder stretch | 2.117× | 1.052× |

The repaired endpoints map to the **same real source triangle** [6589,6698,6588], with distances 4.162 and 5.604 mm. These are improvements in correspondence geometry and influence continuity, not relaxed metric thresholds.

The local registration can strongly rotate/compress unused source collar/support triangles as it accommodates different rest anatomy. Therefore the raw report retains its source-relative normal-change count. The relevant mapped torso triangles have no normal opposing the actual canonical target; their minimum source triangle area is 1.385 mm² and normal-agreement p01 is .783. This is a local mapping check, not a global self-intersection certificate. No claim of full source registration acceptance is made for the unsupported source head.

Eight fixed-identity fixtures cover neutral, pure shoulder, pure upper-arm twist, pure elbow, pure forearm twist, shoulder+elbow, combined shoulder/elbow/forearm twist and a mirrored combination. Every fixture preserves 9,253 canonical body vertices and the same topology; native identity/expression and Anny target identity are fixed at neutral. Repeated evaluation is exact. No canonical edge exceeds 2× rest length; the largest tested stretch is 1.481×. All 127-joint evaluated snapshot round trips remain below 6.1e-13 mm.

The independent actual-native same-pose MLP-on/off gold remains valid after changing the correspondence. Maximum discrepancy across the six original corrective fixtures is 0.000378 mm. The method still unskins the observed native posed difference before transferring the rest-space field and skinning it once.

## Visual evidence

- `experiment-r1/source-canonical-same-camera-front.png`
- `experiment-r1/source-canonical-same-camera-side.png`
- `experiment-r1/axilla-source-canonical-closeup.png`
- `experiment-r1/neutral-torso-registration.png`

Source and common mesh columns use identical camera settings and metric scale. The native source is only converted from centimetres/Y-up and recentered by its neutral root; its body rest shape and palm orientation deliberately remain different. The source body uses a fixed native face subset to omit its head for this body-only comparison. The common mesh is never replaced. R0/R1 evaluated meshes are rendered from the same target rest and native pose values.

## Reproduce and integration

```
node body-adapter/export-input.mjs
node body-adapter/export-bind.mjs
.venv/bin/python body-adapter/register-body.py
.venv/bin/python body-adapter/generate-mapping.py
```

`generate-mapping.py` defaults to R1 and fails if its registration asset is missing; it does not silently revert to the failed initializer. `--skeletal-only` explicitly reproduces that initializer. For the retained comparison workspace, supply `--output body-adapter/experiment-r1`, then run `test-registration-repair.mjs`, `analyze-repair.py` and `render-repair.py`. Standard focused tests and corrective-gold checks remain described in README.

The runtime API and attachment frames are unchanged. Recreate the adapter instance to load the new default map. The parent still owns the fixed GNM head, neck repair integration, archive/export packaging and QA publication. This repair is not unrestricted all-pose/all-body-shape acceptance; broad hands/feet, contact, gait, extreme shoulder and complete head semantics remain separate gates.
