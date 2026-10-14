# Bounded complete native photo-fit comparison

This isolated QA request renders a single shared-identity candidate from frozen R64 with R65rev2 display, using the original fixed native engine. The candidate was computed locally through the verified full composed GNM/Anny gradient. Existing per-view perspective, expression, lighting and appearance settings are identical for baseline and candidate. Those camera estimates are not photographic ground truth.

Training observation views: E04 and U07. U05 is held out from this update, though historical versions have used it. Only reviewed sparse semantic observations and visible contour arcs exist; quadrature adds no independent photo evidence. No Disney dense observer or original 600-point network ran. No photographs, image pixels or private target coordinates are included here.

R64/R65, production defaults and the public preview remain unchanged. Candidate geometry must match the offline original JS calculation. Normal/area and post-step coverage checks do not replace anatomical eye/skin or oral collision tests. Numerical improvement is not likeness acceptance. The actual same-angle render will be reviewed and rejected if there is no visible net benefit. This QA branch is not a release.
