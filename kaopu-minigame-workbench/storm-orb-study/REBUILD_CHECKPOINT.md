# Rejected edition and rebuild checkpoint A

The published e3793211 edition was explicitly rejected by the user on2026-10-07. Its source and prior renders remain in Git history as failure evidence. Functional CI never establishes visual approval.

Checkpoint A replaces the terrain and cabin with a continuous riverbed, riverbank clearance for grading, and four sampled foundations. The view is paused at2.5seconds for comparison to the original reference. Cloud, dynamic water, rain and final materials are not implemented at this checkpoint. The previous visual claim is withdrawn; this is not publishable.

Numerical preflight: all2873 water ribbon vertices are0.089824–0.090014world units above the bed; no ribbon vertex buried. All four foundation supports penetrate local terrain by0.035units. These checks require actual screenshots and human inspection next.

Next gate:720×720 reference view, diagnostic envelope, low foundation view and river plan. Compare original frame with new structure; correct composition and support contact before detailed materials, cloud and motion. Preserve train01 and the public hub. Only the existing QA branch is changed.

## A2 after first actual render

First checkpoint run37573242949 rendered correctly but remains visually rejected: low left hill, elevated cabin, inward-facing lower shell and open tip. A2 raises the left hill, lowers cabin and surrounding right bank, closes the lower shell and corrects face winding. All2873 water vertices remain above the bed by at least0.089708units. Await new human review.

## A3 after root A2 review

A2 rejected as round single peak, steep trench banks and flat right terrain. A3 explicitly reshapes macro hill and cross-sections, adds a foreground shelf and right ridge, derives inside shallows from curvature, trims water width to leave those shallows visible, and adds a terrain-sampled continuous stone foundation and three entrance steps. Water minimum bed clearance0.042374; no submerged surface vertices. Final materials, clouds and motion remain unimplemented.

## A4 cross-section correction

A3 also rejected: superGaussian hill and height-times-valley transition made cliffs. A4 replaces those with designed upper/middle/foreground/right shoulders and explicitly graded asymmetric bank cross-sections. Bed reaches0.006below water at the actual ribbon edge; depth increases to0.09at center. Macro95th-percentile slope decreases from1.43to0.90; max from4.48to1.37. No cloud/material camouflage is used. Await same-frame and side-view human review.

## B1 after A4 structural gate

Root accepted river path, cabin ground contact and outer frame as a stage anchor, but rejected the single dark planar river-facing slope. B1 keeps those anchors and adds actual tilted rock bedding, embedded strike-aligned blocks, smooth geological joins and slope/wetness-based moss transitions. These are terrain details, not cloud occlusion. Water motion and cloud remain unimplemented.

## B2 after B1 visual rejection

B1 produced artificial full-circle terraces, low-poly jewel rocks and foil-like wide highlights. B2 removes periodic whole-hill rings, limits bedding to three interrupted bank strata, decouples grass from phase, replaces the stone border with five embedded continuous-normal outcrops, raises wet-rock roughness and adds mipmapped micro-bump. Structure remains A4; cloud/water animation remain pending.
