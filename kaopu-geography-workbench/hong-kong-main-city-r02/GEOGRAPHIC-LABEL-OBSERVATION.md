# Geographic-label correction after the first R02 actual overview

The first R02 overview (fc8cccf7) exposed a misleading label layout: the old host collision loop moved labels upward by up to eight label heights without changing their geographic anchor. The Kai Tak runway-end labels were consequently drawn about 200 pixels north of the airport's projected location. The runway geometry and source EPSG:2326 endpoints themselves were unchanged and correctly positioned.

## Required map rule

- Project the original geographic point with the same frame camera, FOV, aspect and clip interval used by the scene.
- Keep the DOM anchor at that projected point. Do not clamp or relocate it into another geographic neighbourhood.
- Hide lower-priority colliding labels; Kai Tak labels have priority for this overview. No fake airport coordinates are introduced.
- Any future offset layout must explicitly connect to the original projected point and must have a bounded, independently tested offset. The present fix uses zero displacement.
- QA must independently calculate both runway-end projections from their source EPSG coordinates and the actual current camera, then compare with the DOM bottom-centre anchor. Comparing two fields produced by the same module is insufficient.
- Hidden labels retain source/world/raw-pixel diagnostics and a reason; hidden is not positioned or geographically accepted.

`projection/GEOGRAPHIC-LABEL-QA.json` is the CPU-only projector/collision check. The follow-up actual-browser overview and DOM error report are required before publication. This patch changes only label layout and diagnostics. It does not alter airport, terrain, railway, building, ocean or camera data.
