# Shared head bindings and source completeness, R2

This repair uses the existing 25,417-vertex / 50,624-triangle person. The
canonical topology, original body driver, GNM model, teacher workbenches and
stable anchors are retained. It is not a replacement standalone head.

## Repair

The previous default selected GNM as the exclusive head-shape owner. Anny age and
gender only changed a uniform cranial scale, and MHR identity changed the body
while being excluded from the visible head. Pure Anny head local controls were
also filtered out. Whole-body numerical responses did not establish head shape.

The new shared mode keeps GNM identity/expression and transfers Anny/MHR source
shape fields through one registered continuous cubic RBF domain. Fixed GNM
control points use the existing teacher-triangle/barycentric correspondences.
Eye surfaces and eye joints share the same field as their surrounding skin;
oral skin, gums, teeth and tongue follow that same field instead of inheriting
an adult rigid dental placement. Native local detail remains separately routed.
No hand-authored age proportion or replacement face is used.

Old archives without a composition version restore in explicit legacy-owner
mode. Stored inactive values are not silently activated. The “共同叠加” choice
uses shared shape fields; rig and expression ownership remain explicit.

## Source controls

The source-locked Anny all export has 11 phenotypes and 256 local parameters.
Six formerly missing controls have native responses. nipple-point-incr is listed
but disabled because the unchanged official topology removes all its affected
vertices and its official bone-cache rows are also zero. No substitute motion
has been invented. Cupsize/firmness depend on native age/gender conditions;
the three native ancestry weights are normalized together.

Source: [NAVER Anny v0.6.1, pinned commit](https://github.com/naver/anny/tree/d6fc027ced5c17b6b0775dee944096ade7a9ef80).
Original public targets and cached tensors were recovered with exact row and
vertex correspondence. All 591 old-domain forward tests have zero vertex and
bone-pose differences. The original 52 facial-action binary is unchanged.
Official Torch all-model inference was not run in the local environment; this
is declared source-data recovery and legacy parity, not a claim that stage ran.
Source hashes, conditions and licenses are in SOURCE-RECOVERY.json. Existing
project license notices remain applicable, including the GNM tongue MIT notice.

## Verification and limits

The 23-case geometry gate covers six tested ages (five native anchors plus one interpolated intermediate shape) and both gender endpoints,
plus ten moderate GNM/MHR identity/expression/head-neck combinations. All 276
sampled eyelid-to-globe clearances are positive (minimum about 0.101 mm), with
zero tested upper/lower lid crossings and zero skin-to-dental/tongue crossings.
Forty adjacent-age checks found no visible jump. See GEOMETRY-QA.json.

These finite tests are not a guarantee for arbitrary extreme coefficient
combinations. Native full-strength Anny blink already overcloses its source;
that limitation is retained and disclosed rather than silently changing slider
values. Existing GNM lip-contact triangles are reported separately. Geometry
age does not supply skin wrinkles, infant tooth eruption or replacement teeth.

Browser screenshots and UI verification are separate gates. The first rejected
checkpoint and its mobile-width failure are preserved in
[run 37721289212](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37721289212).
The final tested runtime is in commit
`04e9339213db5ba92fbb43ea14738c79fb349f28`,
[run 37728830863](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/37728830863).
Its real Chromium/WebGL report records browserPassed=true and numericPassed=true,
zero JavaScript/resource errors, exact OBJ geometry and archive restoration,
1916 catalog rows, six newly effective native controls, and 390/390 mobile width.
The artifact contains front, 90-degree side and 45-degree oblique head captures
for all twelve age/gender combinations, plus source-expression and MHR head/neck
combinations. Visual review found the requested lifecycle head reshaping and
mobile layout repaired, without new visible profile gaps in these cases.

The workflow conclusion deliberately remains **failure** and visualAccepted=false
because full-amplitude native Anny blink remains a declared source defect.
This release establishes the tested head/body bindings and source-control
recovery; it does not assert an overall visual pass for all expression extremes.
Old-age shape changes are comparatively modest and do not include skin aging.

## Loading

Loading remains explicit: the initial page waits for the “载入共同模型” button.
The recovered Anny compressed stream is 46,002,168 bytes, replacing the previous
45,650,600-byte stream for this workbench, not loading both. The new registered
field is under 0.5 MB compressed. Existing GNM/MHR assets are reused. Files are
loaded in verified parts with progress, cancellation, retry and SHA-256 checks;
ordinary browser caching can reuse unchanged resources. A cold cache still
requires the complete native model data and decoding work.
