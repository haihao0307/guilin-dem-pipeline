# R23 whole-train installation research comparison

This is an unfinished, source-acknowledged analytic research diagnostic. Whole mechanical acceptance remains **FAIL / incomplete** in both modes. It is not an exact 60009 reconstruction, historical calibration, manufacturing model or final publication. No source mesh, vertex buffer, voxel cache or new object mesh is used. The renderer still draws only the full-screen triangle into the shared whole-train depth buffer.

## Reversible comparison

- Default: unchanged R22 failed baseline, middle inclination 0.110 rad, rod length 3.500 m and original theta 0.4. The baseline collision remains reproducible and its original behavior includes frozen piston rings.
- Optional candidate: middle inclination slider 0.110–0.160 rad, with the rod length fixed at 3.500 m. This range includes failures and is not a feasible-region claim. The 0.126 rad button is only one hypothetical example on this fixed-length slice, not the joint solver's optimum or a historical truth.
- Display: whole-train views, X cutaway, Time -> theta = 0.4 + Time, manual stepping and intentionally non-real-time frame playback. No isolated-component view is introduced. Default eye is the previously used whole view [16, 5, -4].
- Every frame receives one immutable installation snapshot. Rapid controls coalesce to the latest requested settings rather than mixing one angle's shader with another angle's AABBs.

The visible diagnostic shows both current-phase and 1,441-sample full-cycle rod-body/leading-axle clearance. Negative clearance is a collision; 0–5 mm is below an explicitly inferred design threshold; at least 5 mm only passes that sampled local threshold. Guide overlap and piston end margin are local sampled checks, not a coupled whole-train acceptance certificate.

## Coordinate contract

The source scalar fields and all their metadata remain byte-for-byte identical to R22 (519 fields; SHA-256 8053c0c615d7ff045f267d217ae2576d3a8d1d4a4ec958e06540a0133473b8da). The preserved reference Python modules are unchanged.

All source geometry was expanded at theta 0.4 and middle inclination 0.11 rad. R23 always retains that immutable source pose. Target poses alone use the candidate inclination. In the YZ plane, increasing the inclination uses a negative forward rotation, because the cylinder direction is (sin beta, cos beta).

- Middle cylinder wall, fixed guides, front/rear covers, rod packing and rear-head seal rotate about the D2 axle axis at Y = 1.016 m, Z = 0.
- Middle small-end joint, bushing, crosshead/slipper, piston and piston rod translate to the selected slider point and rotate their local axes coherently.
- The middle main rod maps original big/small centers to the target centers by a rigid transform. L stays 3.5 m, so neither rod eyes nor the rod body are stretched.
- Only the candidate middle piston ring pack is additionally attached to the moving slider. Baseline middle rings and both outside ring packs retain R22 behavior. Do not describe all piston sealing as dynamically validated.
- All outside parts and axle stations are unchanged relative to the same phase in R22. The unchanged phased crank and support motions remain active.
- The inverse scalar wrapper and forward support-AABB transform use the same snapshot. Host cuts use the exact same coordinate argument as their host. The four existing host cuts are static cab/tender/boiler fields, so their generated scalar expressions remain unchanged.

Nineteen middle-only fields differ in candidate mode. Valve gear, middle spindle, valve chests and other non-coupled systems are deliberately not moved: their correct relationships have not been established. They are visibly disclosed as frozen rather than silently re-registered.

## Tests and evidence

Node/Python commands, run without launching a browser here:

- node --check dynamic.js; node --check app.js; node --check controls.js
- node test_installation_adapter.js: 1,361,856 transformed point checks across 8 settings and 41 phases. Tests rigid round-trip, independent GLSL-inverse expansion, AABB enclosure, unchanged source hash, original-source rod eyes, baseline equivalence and unchanged outside parts. Results: INSTALLATION_ADAPTER_QA.json.
- python test_installation_fields.py: actual JavaScript-transformed points checked against independent retained NumPy drive/actuation fields and pressure-cover/packing/ring formulas, 38,400 scalar comparisons. Results: INSTALLATION_FIELDS_QA.json.
- node test_controls.js: initial baseline, hypothetical example, failing low-angle state, repeated controls, collision-phase button and return to baseline, using a mock DOM only. Results: CONTROLS_QA.json. This is not browser or GPU validation.
- node test_dynamic_js.js; python test_dynamic.py: preserved baseline kinematic regression tests.
- python test_swept_collision.py: intentionally remains a failing baseline mechanical regression. Do not convert its failure into a green whole-acceptance result.

Local sampled results: baseline minimum margin approximately -28.7363 mm; hypothetical 0.126 rad example approximately +5.8438 mm at 3,601 samples. These values apply only to the explicitly modeled local rod/axle pair and inferred envelopes.

The separately prepared browser_qa.py and workflow.yml cover real browser/GPU whole renders and baseline return. They were not run during this local numerical test stage. R22_BROWSER_QA.json, R22_PHASE_PIXEL_QA.json, R22_VERIFICATION_STATE.json and R22_MANIFEST.json are retained historical evidence, not verification of R23. Current verification is recorded separately in VERIFICATION_STATE.json.

## Unresolved whole assembly and provenance

Saddles and mounting load paths, middle valve position, finite valve/spindle dynamics, complete steam/feed networks, brakes and cab controls remain incomplete or unvalidated. Diagnostic colors are not finished analytic material/surface waves. No stress, suspension, continuous all-pairs collision, exact historical phase or real-time rendering claim is justified. See WHOLE_ACCEPTANCE_CHECKLIST.md.

Read PROVENANCE_REVIEW.md and installation-study/README.md. Retain attribution to timblewee's “Train Class A4 Union of South Africa” / 60009, CC BY 4.0: https://sketchfab.com/3d-models/train-class-a4-union-of-south-africa-636ed4890b72429da4a10abec0551373 . The recovered 513 fields have an incomplete generation/per-parameter provenance chain and are not certified clean-room independent. The six inferred support functions and this adapter/tests are new research code. No original vertex, index, animation or texture buffers are redistributed. Documentary dimensions from The Engineer, 27 September 1935, Silver Link pp319–320, and functional relationships from official NRM/Sir Nigel Gresley sources do not establish exact 60009 dimensions. Linked source drawings and photographs are not republished as assets.


## Actual browser evidence

Tested commit 196b33f56724f4b6216df8334049094bb58e9d32, [run 40147151363](https://github.com/haihao0307/guilin-dem-pipeline/actions/runs/40147151363). Six complete-assembly images each render 519 analytic fields with GL error 0. Candidate cutaway differs; returning to the unchanged baseline produces identical PNG bytes. Actual candidate/restore buttons pass. GPU pixel readback is 17.91 s initially, then 4.89–5.06 s, not real time. Whole mechanical acceptance still fails on the retained middle-rod/front-axle collision. Images remain in artifact 12580933660 through 2026-11-24; BROWSER_QA.json persists the numerical evidence.
