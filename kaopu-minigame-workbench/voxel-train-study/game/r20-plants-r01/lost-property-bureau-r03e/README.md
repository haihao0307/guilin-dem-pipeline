# Bureau R03e — complete windows and inhabitable interior receiver

Independent sibling of R03d de7e0fa918810cb4f44dbba215b168b1ea0283ea.
Old versions remain unchanged. No Pages publication is included.

## Reference and scope
The AMO old General Post Office photograph was inspected. Its deep loggias,
recessed vertically divided windows, stone dressings and connected roof volumes
inform this fictional design, not a historical survey.
https://www.amo.gov.hk/filemanager/amo/common/form/whatsnew_20140415.pdf
No source/reference image is distributed with the runtime.
The accepted four-storey taper, tapered chimney, aligned double street loggias,
right-street entry, 4500 m² net store and quarter-turned two rack banks remain.

## Resolved defects
- Old windows were opaque blue-gray slabs, with no joinery or interior trace.
  A shared sashWindow function now generates recessed frames, sash rails,
  fine glazing bars, radial fanlight, stone reveal/sill and 9 mm glazing.
  Glass rays continue into the same scene and count exhausted rays explicitly;
  Fresnel sky reflection and accumulated absorption are bounded approximations,
  not a full multi-bounce spectral glass simulation.
- The roof glazing previously sat over an unbroken slate roof. Real light wells
  now cut the roof, and structural glazing frames connect to roof support.
- Street-facing gables now have backward-extending two-pitch roofs merged into
  the main roof envelope, with overhanging front edges, rather than flat signs.
- Material mother height now contributes to close shading normals; retained
  plaster thickness enters the near-surface field using original macro/micro.
  Brick staggering and mortar union logic are corrected. V26 weather functions
  are actually reachable. Six original mother files remain byte-identical.
- Hall/warehouse views now sit inside completed rooms without the 1.1 m cut.
  Finish floors, wall linings, joined counters, seats, desks, pendants and roof
  trusses share the field scene. Fixture light positions are reused in shading.
  The old cutaway remains a separate layout inspection.

## Business and evidence
Inventory locations and custody rules are not redesigned. Independent R03e
save identity preserves older candidate saves. 24 scripted objects are actual
fictional records, distinct from 22,080 addresses; empty shelves stay empty.
No automatic disposal or claim. Verification, reservation, movement, arrival
and actual handover are distinct idempotent events.

Run node qa/source.test.mjs and node --test qa/inventory.test.mjs.
Official pinned Chromium/WebGPU on SwiftShader produces seven native views:
unchanged exterior, close window, complete hall, complete warehouse, oblique
roof junction, right-street entrance and inherited cutaway. Business regression then uses 360×240
frames in the same browser and commit to avoid repeating expensive beauty
renders. This is not phone/hardware FPS. No local browser is used.

The render architecture remains function-only, with three fullscreen vertices,
primary/sparse continuation and independent material pass. No mesh, image
texture, per-cabinet geometry objects or sampled shape volumes are introduced.
This remains a review candidate until actual images and exact-commit QA pass.
