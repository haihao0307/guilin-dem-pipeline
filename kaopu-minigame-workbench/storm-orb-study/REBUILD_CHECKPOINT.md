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

## B3 after B2 green-blanket failure

B2 removed artificial rings but still looked like a smooth green blanket. B3 adds two actual shallow weathering seams and derives exposed wet rock from their geometry, plus32000short turf blades using the same slope/wetness cover field. A4 macro river path and foundations remain unchanged. Cloud and water animation remain pending; no production release is authorized at this stage.

## C1 approved change of material method

B3 failed as an artificial X path with black grain. C1 returns to the A4 macro surface and replaces invented material detail with original CC0 Rock015 and Moss001 maps from ambientCG. Seven original1024²JPG files,9659372bytes, no resizing/recompression. Source hashes/license/scale are in assets/SOURCES.json. Color maps are sRGB; normal/roughness/height are non-color; OpenGL normals are used. Moss scale0.45m comes from provider45cm metadata; Rock015 scale2m and0.10m displacement range are explicit artistic assumptions because source dimensions are absent. All images must load before WebGL evidence;720 and1440closeups will determine whether1K is sufficient. No visual approval or publication claimed.

## C2 geometry sampling correction

C1 source PBR images are resolved at720and1440, but high-frequency1024height samples were undersampled by about91geometry vertices per2m tile, creating false sharp bumps/shadows. C2 prefilters only the CPU geometry height field to64²before vertex sampling; color, OpenGL normal and roughness textures remain original1024²files and full material detail. This is anti-aliasing of geometry, not a reduced-resolution visual mode. All source assets unchanged.

## C3 source separation and surface response

C2 changed fine sampling but did not remove all larger dark bumps. C3 separates ecological coverage from rock micro-displacement: coverage uses12cm macro slope, and moss cushions70percent of rock microrelief. Dry rock, wet rock and moss receive distinct roughness ranges; wet rock darkening is moderated. Matched normal-on/off diagnostic captures distinguish geometry/color artifacts from normal-map artifacts. Original texture bytes unchanged.

## D1 real flowing river

Root confirmed C3 removed false dark bumps; keep this rollback point. D1 adds official Three r170 Water2 planar reflection/refraction on the actual sloping curved river. CPU proof: world normal error0, plane residual2.1e-16, water-height max error3.6e-9. No nonuniform parent transform is applied to water. Stream UV uses actual arc length, downstream speed0.35world units/s, and a two-phase deterministic normal blend. Both capture targets1024²; fixed-camera flow, cycle continuity and extra-pass cost are verified in the next browser evidence. Cloud/rain and final lighting remain pending.

## D2 render scheduling and evidence

D1 produced valid reflection/refraction images but the first browser sequence timed out waiting for element screenshot stability after repeated resizes. D2 renders paused scenes only on actual changes, keeps full target pixel resolution, captures a known rendered frame and visible stage clip, and places flow/cost checks before the1440closeup. Both engines run even if one fails, with overall failure retained. CPU draw-submit time and RAF timing are recorded separately. No visual-quality reduction is used to obtain a green check.
