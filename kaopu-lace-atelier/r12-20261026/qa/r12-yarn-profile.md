# R12 bounded yarn envelope candidate 2

This is a deliberately changed display profile, not a craft-certified fibre
construction or a historical-default reconstruction. Visual acceptance belongs
to the main lane's fresh same-camera review.

The optional `bundleProfile` 0–1 control defaults to zero. Missing/zero retains
every R11 position, normal, tangent, UV, phase, radius and index byte, including
ordinary fuzz, flyaway-only instanced fuzz and enriched instanced fuzz. Tested
across all three motifs, all three material presets and all four layers.

The positive profile adds fixed seeded angular axes with broad unequal 2/3
modes. Smooth independent axial coefficients have correlation of at least eight
actual yarn radii and three longest existing sample segments. There is no extra
helical rotation, centreline change, endpoint move, root count change, density
change, vertex or triangle increase. Closed paths use a periodic axial lattice;
very coarsely sampled paths receive constant axial coefficients. This is a
coarse packed-bundle envelope rather than resolved individual constituent yarns.
The envelope multiplier stays within 0.88–1.12 of the previous radius profile.

Candidate 1 added one opposed triangle at an inherited tight cropped outline in
the botanical/fine extreme: baseline 3 versus candidate 4. Candidate 2 preserves
the old shape or attenuates the entire path near tight three-point curvature or
sub-radius clipping segments. Allowance is the smaller of
`clamp((minCurvatureRadius/r-1.25)/2,0,1)` and
`clamp((minSegmentLength/r-0.5)/1.5,0,1)`; this does not change baseline radius,
sampling, normals algorithm or centreline. Both geometry and the fuzz sampler
use precisely the same rule and envelope.

`node --test tests/r12-yarn-profile.test.mjs`: 6/6 pass. This includes the
72 layer comparisons from three motifs × three materials × default/extreme
display, all with shortStitchGuard=1. There are no new radial, reversed-edge,
opposed-winding, degenerate or non-finite defects. The inherited botanical/fine
extreme cropped outline defect remains; no normal flip hides it. Circumferential
and closed axial Float32 position/normal seams match. Both fuzz representations
attach to actual generated Float32 triangles, including diameter reduction to
55%; maximum allowed root residual is 2e-7 cm.

Full-sized cases are in `r12-yarn-profile.json`; all accepted recipes have zero
detected defects in all four layers. Botanical 18×22 cm at pitch .14 mm is
explicitly rejected by the existing 250000-segment budget; it is not simplified.
Rosette/ribbon .14 mm cases fit and pass, but do not establish that botanical
can use the same spacing.

The final new botanical recipe is fill diameter .17 mm, pitch .18 mm, cotton
flatten .32 / roughness .86 / specular .14. `r12-yarn-profile-final.json` records
all three materials against the same current structure, not historical defaults.
It has 239869 segments; each material's four layers has zero detected defects.
At cotton fill profile .85, actual radius ratios are .901857–1.097438, maximum
vertex displacement .008499 mm. Of 30576 fill paths, 25 retain the old envelope,
270 attenuate it and 30281 use full requested strength. Geometry costs remain
2333477 vertices, 3605168 triangles and 173936728 typed-array bytes.

API: buildYarnGeometry options.bundleProfile; createYarnSurfaceSampler sixth
argument; buildYarnFuzzGeometry options.bundleProfile. Add yarn-profile.js before
lace-display.js in the builder dependency order. Presets can use cotton .85 fill
/.65 outline, silk .12 fill/.16 outline and fine .35 fill/.3 outline. The main
lane owns preset, diameter, state and UI integration. The inherited open tube
ends remain unchanged.
