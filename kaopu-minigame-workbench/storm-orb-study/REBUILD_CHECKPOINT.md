# Rejected edition and rebuild checkpoint A

The published e3793211 edition was explicitly rejected by the user on2026-10-07. Its source and prior renders remain in Git history as failure evidence. Functional CI never establishes visual approval.

Checkpoint A replaces the terrain and cabin with a continuous riverbed, riverbank clearance for grading, and four sampled foundations. The view is paused at2.5seconds for comparison to the original reference. Cloud, dynamic water, rain and final materials are not implemented at this checkpoint. The previous visual claim is withdrawn; this is not publishable.

Numerical preflight: all2873 water ribbon vertices are0.089824–0.090014world units above the bed; no ribbon vertex buried. All four foundation supports penetrate local terrain by0.035units. These checks require actual screenshots and human inspection next.

Next gate:720×720 reference view, diagnostic envelope, low foundation view and river plan. Compare original frame with new structure; correct composition and support contact before detailed materials, cloud and motion. Preserve train01 and the public hub. Only the existing QA branch is changed.

## A2 after first actual render

First checkpoint run37573242949 rendered correctly but remains visually rejected: low left hill, elevated cabin, inward-facing lower shell and open tip. A2 raises the left hill, lowers cabin and surrounding right bank, closes the lower shell and corrects face winding. All2873 water vertices remain above the bed by at least0.089708units. Await new human review.
