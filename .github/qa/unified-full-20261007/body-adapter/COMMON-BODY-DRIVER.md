# Independent common body driver

`CommonBodyDriver.mjs` coordinates the existing Anny teacher and validated R1 MHR body adapter. Both owners always emit the same 9,253 canonical body vertices, in the existing order. This module does not edit State/CommonPerson, evaluate GNM head geometry, or run neck contour/fairing/repair.

## API

```js
import {CommonBodyDriver} from './body-adapter/CommonBodyDriver.mjs';
const driver = new CommonBodyDriver({
  anny,                    // optional; defaults to mhrAdapter.anny
  mhrAdapter,
  canonical,               // optional; defaults to mhrAdapter.canonical
});
const result = driver.evaluate(state, {
  gnmRootRestMatrix: G,     // optional 4×4 matrix, row-major, common rest metres/Z-up
});
```

The state uses the existing `owners.rig`, `owners.headRig`, `owners.expression`, `anny.phenotypes`, `anny.localChanges`, `anny.pose`, `anny.translations`, and `mhr.identity/pose/expression/correctives` fields. Input is never mutated. Parent-level validation remains owned by State; this module does not call or modify its earlier restricted-owner validator.

The result contains:

- `vertices` / `positions`: one 27,759-float body array
- `sharedRestVertices`: current common Anny shape plus MHR identity and active MHR expression, with no articulation or MLP
- `baseAnnyRestVertices`, `sharedRestDisplacement`
- `rig`: all selected names, parents, complete CSR weights, joint-conditioned rest points, bind/posed/skin matrices, original body skin matrices and posed snapshot inverse binds
- `packet`: the correctly factored rest packet
- `attachment`, `attachmentSkinMatrices`, `attachmentBodySkinMatrices`
- `effectiveInputs`: copied active inputs for QA; saved user state stays intact

`driver.exportSnapshot(result)` returns the evaluated body and complete selected posed skeleton, with a posed snapshot bind so already-baked vertices are not deformed again. It has 104 joints for Anny or 127 for MHR. Continued animation must re-evaluate the active teacher/correctives, rather than treating the snapshot as a replacement for the nonlinear driver.

## Ownership

| Field | When active |
|---|---|
| Anny phenotypes and local shape changes | Both rig owners |
| MHR 45 identity values | Both rig owners as shared shape |
| Anny body pose/translations | `owners.rig === 'anny'` |
| MHR 204 rig/scale/translation values | `owners.rig === 'mhr'` |
| MHR pose-dependent MLP | MHR rig, respecting its corrective toggle |
| MHR 72 expression rest field | `owners.expression === 'mhr'` |
| GNM common-rest root G | `owners.headRig === 'gnm'` |

When GNM owns head articulation, MHR columns 24–29 and Anny neck01/02/03, head, eye.L/R pose **and translation** inputs are omitted from effective articulation. They remain in the saved input state. MHR proportion/scale fields outside 24–29 retain their normal rig ownership. When body owns head articulation, G is ignored and the selected native cranial pose values are active.

This body module does not claim GNM/Anny facial-action head geometry. Their semantic head/expression evaluation remains in the parent head adapter. Anny `facialActions` and GNM native vectors are therefore not silently translated into body controls here.

## One final skin operation

In Anny mode the MHR teacher is evaluated with zero pose and MLP disabled, keeping its shared 45 identity values and its expression only when selected. This produces a real canonical rest displacement. That displacement is added to the original Anny per-source/per-joint rest contribution, then all original Anny influences are applied once.

The distinction matters at non-adult shapes. Anny's zero-pose transforms are not a single uniform transform at newborn/baby/child/old anchors. For source vertex s and Anny joint j, the conditioned zero-pose contribution is:

p_sj = zeroNativeBoneTransform_j × rawShapedRestVertex_s

For each canonical recipe, equal joint columns may be aggregated only by retaining their weighted conditioned point. The shared MHR rest displacement is then added to each of those joint-conditioned points. The final skin matrix is posedBone_j × inverse(zeroBonePose_j). This reproduces the native source formula; applying averaged weights to an already-blended zero-pose vertex would introduce cross terms.

In MHR mode the module uses the validated R1 adapter and its joint-conditioned identity/expression/MLP rest packet. No native influences are pruned. The existing normal MHR evaluator remains unchanged.

Official Float32 rounding is retained exactly in the neutral and native-only reductions: zero articulation with identity G returns the common rest array directly; native Anny pose without extra rest fields/G returns its original sampled vertices; unmodified MHR articulation returns the validated adapter's vertices. The corresponding factored packets differ only by the measured accumulation rounding below.

## GNM root order and external head attachment

For selected cranial influences:

finalSkin_j = bodySkin_j × G_common_rest

The same final matrices drive the body packet once. The corresponding posed skeleton is finalSkin_j × bind_j. Unselected influences retain bodySkin.

The head must choose the correct attachment matrix:

- `result.attachmentBodySkinMatrices.neck02 / .head` excludes G. Use these as outer `poseDeltas` when the GNM head's native vertices already contain the GNM root pose.
- `result.attachmentSkinMatrices.neck02 / .head` includes G. These describe the branch used by the body packet and would apply G a second time if placed outside an already-root-posed GNM head.
- Individual `attachment.neck02 / .head` entries contain both `bodySkin` and `skin`, plus the exact source joint, bind/posed matrices and world scale.

Anny returns its actual neck02 and head. MHR has no native neck02; its neck02 attachment alias is explicitly `c_neck_twist1_proc`, the MHR neck midpoint frame, and head is `c_head`. The alias does not claim an identical Anny rest pivot. Full native matrices and names remain available if the parent needs another attachment policy.

## Verification

Run from the enclosing restored workspace:

```
node body-adapter/test-common-body-driver.mjs
```

`common-body-driver-report.json` records:

- Exact neutral canonical geometry and equal shared zero-articulation shape across both rigs, including MHR identity
- Exact inertness of inactive source articulation, MLP and MHR expression; exact source switch-back
- Saved cranial inputs preserved while suppressed by GNM ownership; G inert under body head ownership
- Native Anny pose byte equality at all five actual age anchors (-1/3, 0, 1/3, 2/3, 1)
- Anny conditioned packet versus native source error at most 0.000179 mm; wrong collapsed-zero-rest computation reaches 2.226 mm in the tested age cases
- MHR identity plus Anny articulation, and GNM G plus body root rotation, checked against independent original per-source influence sums
- Correct `bodySkin × G` order; wrong order gives an approximately 86.9 mm counterexample in the Anny fixture
- Separate head attachment matrices before/after G
- Complete 104/127-joint posed snapshot round trips within 0.001 mm

These verify the body-driver mechanics and ownership interface. They do not replace the parent's full 25,417-vertex head integration, fixed neck kernel, browser visual acceptance, or broader pose/shape quality gates documented for the R1 adapter.
