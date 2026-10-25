# R28 analytic surface-wave integration

Status: integrated into the **whole locomotive and tender renderer**, CPU math and uniform wiring tested. Browser/driver compilation, screenshots and visual acceptance are **not run locally** because that browser route was denied. `../browser_qa.py` is prepared for the separately authorized remote QA route. Overall mechanical acceptance remains **FAIL**.

This is shading-only micro-normal, albedo and roughness research. It is not displaced geometry, an isolated-part demo, a third mechanical state, a measured finish, a historical livery/material certificate or a substitute for mechanical equations. No object meshes, textures, photographs or downloaded appearance data are used.

## Whole render contract

1. One `Time → rail-local Location → whole Object` snapshot is obtained through `DYNAMIC.state`. Mechanical theta, installation, scalar evaluation, dynamic bounds and material transforms use that same snapshot. Appearance has no clock or phase velocity.
2. The existing 592 defined fields remain: baseline renders 519; inferred candidate renders 574. The two installation states and known failures are retained. Appearance is independent: `waves` is the default study; `diagnostic` reproduces the retained source-color lighting. No isolated-part option exists.
3. At each already-established scalar hit, use its unchanged geometric normal and three inverse-affine material rows. Only the final color branch changes. Scalar fields, ray steps, intersections, geometric normals, depth, silhouettes, supports/AABBs, collision math and mechanical solvers are unchanged. `geometryDisplacement` is always zero.
4. Every visible field has an explicit bounded wave assignment. Unknown/mixed materials use an **unclassified neutral finish signal with their source diagnostic color**, not an assertion that they are a known metal. Diagnostic appearance and clipping caps remain unperturbed.
5. Per-wave filtering uses an explicit tangent-plane ray-cone footprint. No screen derivatives are used after divergent raymarch/discard. High frequencies fade; a broad finish component is designed to remain resolvable at the default whole-train scale; nonzero CPU filter weights are checked, but pixel visibility still awaits browser QA. Grazing incidence suppresses detail. This is not certified antialiasing of curved boundaries, discontinuities, occlusion or silhouettes.
6. Final lighting explicitly uses roughness and metallic parameters in a self-written two-sided GGX/Schlick approximation with one directional light, simple ambient contribution, tone mapping and gamma. It is not a measured physical BRDF, environment lighting, shadow solution, transparent glass, refractive water or finished material model.

## Surface equations and bounds

For fixed material-local point q, each analytic wave is

    v_i = dot(l_i, q) + psi_i
    s_i = dot(k_i, q) + phi_i + b_i sin(v_i)
    h(q) = sum_i a_i sin(s_i)
    grad h(q) = sum_i a_i cos(s_i) [k_i + b_i cos(v_i) l_i]

Global bounds are `H = sum |a_i|` and `G = sum |a_i| (|k_i| + |b_i| |l_i|)`. They are analytic, not inferred from samples. The longest preset uses four terms. Steel, copper and wood retain the prior three micro terms and add one declared low-frequency finish term. Neutral has three nonzero terms. All variables are original study choices in metres/radians per metre, not measured surface data.

A per-wave weight is `1 - smoothstep(pi/4, pi/2, 2 R (|k| + |b| |l|))`. The same weight multiplies height and exact gradient and is held fixed while computing the shading derivative. The full original H bounds remain conservative. At zero detail scale, height and micro-normal perturbation vanish exactly.

For normalized view ray r, geometric normal n and hit distance t, `epsilon = (1.2/400) sqrt(2)` for this exact 720×400 camera. The footprint radius `R = 2 t epsilon / (|n.r| - epsilon)` bounds neighboring intersections with the **local tangent plane**; incidence at or below 0.15 uses zero resolved detail. This plane bound is tested against independent perturbed ray/plane intersections. It must be updated if camera projection or resolution changes. It is not a guarantee about neighboring intersections on arbitrarily curved geometry.

The world gradient is `J^T grad(h)` for the actual world-to-material linear map J. Project it onto the normal tangent plane, cap at maxSlope, and normalize `n - tangent`. Angular change is at most atan(maxSlope), with preset caps at most 0.025 (under 1.433 degrees). All albedo variation is at most 3.5%; roughness variation is at most 0.018. No virtual height enters intersection, depth or collision code.

## Advected local coordinates

The origin is the **fixed reference AABB midpoint**, never the moving world AABB.

- Ordinary rigid fields use the existing DYNAMIC inverse transform.
- Outside-valve fields use the exact existing inverse YZ frame.
- Original central fields use the exact Gresley inverse XZ frame.
- All 73 `stack_candidate` fields explicitly use their `frameSourceId` through the current `DYNAMIC.gresleyFrame` binding **once**. Their Y layer already exists in their reference fields; it is not reapplied. No guessed new part-name classification or second dynGresley transform is used. Frozen O mappings remain identity as prescribed by the mechanical solver.
- Parameterized wheels use their existing per-axle wheel theta and tyre-derived axle centre, including the differing bogie/trailing radii. Since spoke geometry uses atan2(y,z) minus theta, the inverse material YZ rotation uses positive delta theta. Round tyres/hubs therefore carry a rotating finish instead of leaving a pattern fixed in space.

CPU coverage is 5,920 defined-field snapshots: all 592 fields, both states and five times. Hidden stack fields in baseline are included to test mapping, not counted as visible. Maximum reference-local recovery error is about 3.89e-15 m. Stack frame invocation is separately checked exactly once per field. These double-precision tests do not certify GPU float behaviour.

## Material uncertainty remains explicit

Across all 592 definitions: 322 generic steel study assignments, one explicitly labelled copper, one explicitly labelled wood, and 268 neutral/unclassified. Only six fields have explicit material words in their IDs; 260 original structural fields and 58 added stack fields use declared generic-steel role assumptions. Bushings, bronze, rubber, packing, hoses and oil cups are not guessed as steel/brass. Grouped mixed-material fields stay unresolved.

Visible baseline: 264 steel / 1 copper / 1 wood / 253 neutral.
Visible candidate: 306 steel / 1 copper / 1 wood / 266 neutral.

Brass, water and glass presets remain unassigned. Their presence is not evidence that those surfaces exist or that transparency/fluid simulation has been implemented. See `MATERIAL_ASSIGNMENTS.json` for every assignment and its basis.

## Verification and limits

Run from the R28 directory:

    node material-wave-study/test-material-waves.js
    node test_material_renderer.js
    node test_controls.js

`MATERIAL_WAVE_QA.json` checks gradients, bounds, normal caps, advection and generated GLSL identity. `../MATERIAL_INTEGRATION_QA.json` checks per-wave filtering, roughness-dependent lighting, all-source shader assembly, every visible uniform upload, immutable queued state and protected source/ray hashes. The latter uses a strict WebGL **mock**, not a shader compiler or pixel renderer.

`../browser_qa.py` prepares 12 whole frames: both mechanical states, diagnostic/wave comparisons, a flat-signal reference, time change, opposite view, retained collision views and exact-return comparisons. It requires identical coverage masks when only appearance changes, nonzero resolved wave pixel differences, GL0, whole framing and visible FAIL/uncertainty text. Do not mark this stage passed until the authorized remote run supplies those results.

The current analytic candidate intersects its current frame/middle-cylinder fields. Real A4 frame openings and actual installation are still to be established; this is not a claim that a real A4 collides. Materials do not repair or conceal that mechanical failure. See `../WHOLE_TRAIN_ISSUES.md` and the retained provenance documents. No Git, Library, publication or local browser operation was performed by this integration task.
