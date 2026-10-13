# Whole growth R05

Independent continuation of the two complete 14- and 13-storey buildings. Original R03, R04, their source mothers and their evidence remain available. This candidate is not visually accepted until its own exact-source complete frame is inspected.

## What now drives the form

Three independently negotiated ownership building lines produce different front walls and real wall returns. The west and middle owners of A, and the east owner of B, add rental rooms subject to their own daylight and roof-use agreements. A separate original workshop-headroom decision raises B's later floors by 0.55 m. The four events record the life reason, funding, support and access consequence. Dimensions, owners, agreements and dates are explicitly fictional design interpretations, not surveyed historical facts.

The minimum building lines persist upward. Later deeper original setbacks supersede them rather than repeatedly reducing the already shallow top rooms. The resulting five retained-lower-roof terrace levels have actual floor surfaces, household doors and exposed-edge guards. The footprint, wall returns, openings, household additions, shelters, drains and material wetting use the same parcel coordinates.

The three borrowed links now have 0.51, 0.59 and 0.65 m height differences. Their three/four/four finite risers and treads have level 0.48 m end platforms, 0.18 m nominal bearings into the adjoining floor, continuous guards and retained entrance openings. These are geometric relationships, not structural-engineering certification.

## Life remains part of the building

All 27 floors retain their inherited furniture, shared wet areas and internal stair cores. Drying on A-F07, A-F09 and B-F09 moves to the accessible middle platform after the ownership returns change the outer route. A-F11 has separate west storage and east drying entrances. A-F12 uses an exterior two-panel sliding terrace door so the original study furniture and cross-room path remain usable. Existing B-F11 sliding doors remain.

Terrace drying uses posts supported by the actual lower roof, with hanging cloth beyond the edge guard. Other drying retains the existing supported balcony arrangement. The exact A-F04 1973 household transaction, its 2.45616 square metre area and neighbouring drying agreement are unchanged.

## Material and view

The nine original material files are shared byte-for-byte. The same resolved coat/water/repair state controls both physical surface loss and PBR. Background exposure is restrained; stronger loss remains tied to actual sill runoff, floor joints and drains. There are no painted facade decals or replacement gray wall material. Exterior ground remains the existing flat gray field.

The whole-building camera is normal perspective, raised enough to inspect intermediate roof platforms. Cutaway and detail cameras remain other views of the same world. The original render field and editable rules are retained; a screenshot is not described as an interactive 3D preview. Hardware/mobile performance remains unverified.

## Checks and execution

The deterministic rule buffer is 3456 bytes, not the complete runtime memory footprint. All seven geometry groups remain below the existing source-size bound. Every whole-floor field operation is assigned once, all actual pipeline entry-point dependency closures are checked, and original material hashes and gray-ground branches are checked.

The fixed nominal route test uses the unchanged 0.44 m body width, 1.75 m height and 12 mm radial material allowance. It checks every floor's core, rooms, wet area and doors, all drying working positions and every usable terrace parcel. Separate nominal checks cover stair headroom, roof exits, borrowed-link landings/guards/bearing and below-flight clearance. The test does not introduce player navigation or collision machinery and is not a full displaced-field or building-code certification.

Run the old and new tests, then the explicit complete-frame review:

    node --test tests/*.test.mjs tests/local-review.test.cjs tests/inspect-dark-shapes.test.cjs whole-frontage-r04/tests/*.test.mjs whole-growth-r05/tests/*.test.mjs
    node whole-growth-r05/src/compile.mjs
    node qa/local-review.cjs --candidate whole-growth-r05 --mode smoke --view overall --viewport 960x1200 --out whole-growth-r05/qa/smoke
    node qa/local-review.cjs --candidate whole-growth-r05 --mode full --view overall --viewport 960x1200 --out whole-growth-r05/qa/overall

Only the dedicated QA branch is in scope. This revision does not merge main or publish a public game preview.

## Post-review construction corrections

The first R05 commit remains a diagnostic baseline. Independent review found that the borrowed-link doors and open lease gates intersected the new steps, and one core partition retained an obsolete front line. The corrected source uses genuine inward hinges on the six upper borrowed doors, a 0.72 m three-panel surface-hinged gate that folds onto the existing A landing, and the deepest actual parcel front across the full core-wall thickness. Gate posts and both short side returns stand on that same landing. The original ground doors and the 1973 household front door are unchanged.

Regression checks compare complete leaves and both gate states against every tread/riser/landing, check whole adjacent gate frames, preserve the fixed body size, cross the full folded-gate region, and confirm that closed lease gates block that same route. These nominal construction tests still do not establish GPU or visual acceptance of the corrected revision.
