# Original Fish / Tuna branch R03.3

Date: 2026-09-20  
Branch: `work/original-fish-r07-tuna-standardization-20260920`

## Role in the KAOPU system

Original Fish is the shared trunk. Tuna is one species branch and does not define the body of every fish.

The trunk owns units, coordinate conventions, evidence gates, semantic-part interfaces, motion/material interfaces, QA and source-removal rules. This branch owns tuna-specific proportions, fins, keels, head structures and motion candidates.

## Exact source boundary

Reference identity: `FISH-REF-002`.

- geometry / rig / motion observation: `f75f073a2999ee20c4839434d28f90565e486b50270e663f48484cca2dbae9f0`;
- high-resolution appearance observation: `5603d4aabc9a1127856841335a86ae7aa462b6b25d1a6586e93bf644f4d47abe`;
- embedded declaration retained: CC-BY-4.0, GoldenZtuff;
- evidence tier: `N2_TRANSITIONAL_REFERENCE`;
- biological species identity remains `UNVERIFIED_TUNA_REFERENCE`.

The native runtime does not load the source meshes, textures, 98-joint rig or source animation tracks.

## R03.3 implemented increment

- 41-section source-constrained fusiform body;
- smoother head taper and peduncle continuity;
- separate first/second dorsal, anal, pectoral, pelvic and lunate caudal membranes;
- ten individual finlets with posterior phase delay;
- twenty-five function-generated fin-ray detail structures;
- paired maxillary, preopercular and supraorbital head-detail curves;
- paired caudal-peduncle keels;
- terminal mouth, mouth cavity and paired opercular boundaries;
- separate eye globe, iris, pupil and cornea;
- 24-control Original Fish semantic interface;
- anterior stiffness plus tailward amplitude growth;
- qualitative wet dielectric skin and thin-fin transmission;
- side, three-quarter, front and top views;
- desktop and 390×844 mobile controls.

The finlet phase relationship and comparatively stiff anterior body are retained as general kinematic constraints from scientific work, not as a completed natural calibration for this exact source fish.

## Actual QA

```text
node tests/tuna-r03.test.mjs
Original Fish Tuna R03: 383 base assertions passed; 36 base parts; 18832 triangles
node tests/tuna-r033-detail.test.mjs
Original Fish Tuna R03.3 detail overlay: 153 assertions passed; 67 total parts; 19820 triangles
```

Browser QA:

- desktop 1440×1000: PASS;
- mobile 390×844: PASS;
- WebGL error: 0 in all fixed views;
- page errors: 0;
- console errors: 0;
- horizontal overflow: 0.

Direct network navigation is administratively blocked in this execution environment. Browser QA used the exact local HTML/CSS/modules converted to data URLs under `page.set_content`; this is a local runtime pass, not a public-link acceptance.

The exact tested runtime is stored as seven auditable text chunks. `main.js` verifies their availability, reconstructs the runtime and binds it to the local `source-bundle.mjs` and `detail-overlay.mjs`; this packaging avoids any source-reference asset dependency.

## Current non-acceptance

This remains an engineering candidate.

- body surface is still too smooth;
- the new head curves remain line-like engineering details rather than continuous 3A soft tissue;
- fin silhouettes and fin-ray fields remain simplified;
- mouth, maxillary and operculum lack 3A soft-tissue continuity;
- scales, chromatophore structure, wet surface and fin transmission are not physically calibrated;
- source-authored timing is not natural-motion acceptance;
- visual, motion, user and production acceptance are false.

Direct entry:

```text
apps/ocean-life-mother/original-fish/r07/tuna-r03/index.html
```
