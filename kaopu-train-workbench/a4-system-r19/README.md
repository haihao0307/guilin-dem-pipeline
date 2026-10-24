# A4 R19 analytic-field integrated inspection

This is a partial unified-coordinate engineering study, NOT a completed A4 locomotive or 60009 exact reconstruction. No source-model geometry/profiles are in this public QA branch. No coal geometry is generated. The classroom reference is the 1935 Silver Link general arrangement; 60007 overhaul evidence informs topology only.

## Implemented and tested
- Six axle centres and nominal wheel diameters from the 1935 drawing. Wheel shapes are intentionally only nominal-radius rings and axle markers, not finished tread/flange/spokes.
- Two-course hollow boiler field, cutaway, known published length/radii. Axis height 2.8575m is dimensioned. Longitudinal translation is inferred; original drawing's apparent span differs from text by about3.7%, so the text length is held fixed instead of stretching it.
- Three explicit crank/slider chains, simple rods/crossheads/guides, piston rods/pistons/cylinder shells and outside coupling rods. These are simplified analytic inspection shapes; the full R15 pin/bushing assembly has not yet been transferred here.
- Changed initial 2.2m rod / Z3.35 cylinder test fixture after checking the real general arrangement. Current rod length3.5m and cylinder centreZ4.75m remain inferred, not exact measured dimensions.
- 721-angle numerical closure and guide tests; limited axial piston/end-envelope clearance test. Full assembly interference is NOT accepted.
- Browser checks and real screenshots exist in Actions. Animation performance requires actual varying-frame readback measurement, not CPU submission timing.

## Representation
WebGL2 raymarches analytic occupancy/distance functions. The only triangles are the two fullscreen display-carrier triangles; there are no train triangle meshes or source buffers. Function sampling and display costs still exist; this is not a promise of free rendering.

## Missing before full A4 delivery
True firebox inner copper shell/outer pressure wrapper/foundation ring/water jacket and tubeplate placement, full frame and load paths, precise wheel profiles/gauge, exact rod shapes and crank phases/inclinations, complete valve gear/ports, steam/water/gas network shapes and physical simulation, cab and tender. The firebox evidence JSON records why an outer casing or capped cylinder cannot substitute these internals. Unknowns remain explicit; no invented closed box is claimed as them.

Prior R15/R16/R17/R18 research remains retained. This branch has no Pages deployment and does not modify building or other projects. Rollback is to retain the previous QA commit; do not replace a stable user preview with this incomplete inspection.
