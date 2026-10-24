# R10: one generation entry, retained real cases

Signature: growBuilding(seed, parameters) -> { model, recipe, candidate, validation }.

The seed identifies the real building, source geometry, retained actual/previously inferred level records and observations. It is never a previously generated result. There are only three working parameter groups: dimensions (wall/door/member sizes), frameGrid (explicit points and spans where a design grid exists), and inspection state (actual reviewed floor, open doors, optional unregistered orientation). No floorCount or arbitrary buildingHeight override is accepted.

Growth order: datum ±0 -> foundation/basement separately -> horizontal structure/space -> retained vertical floor sequence -> cores/corridors/rooms -> host wall/opening/infill -> source roof and exceptions.

This is not just a name around the viewer:
- The lowrise prepared floor Mother is now computed once before emission and supplied to its actual field generator. Frame-grid points drive columns and beam spans; dimensions drive wall thickness, host holes and aperture depths. The generator no longer independently rebuilds another Mother when the prepared one is supplied.
- Both lowrise and KCC use hostOpening for the physical wall-segment/opening projection rule. The same dimensions.wallThickness name changes the actual analytic solids in either case. The KCC emitter consumes the floor selected by the shared Mother, rather than independently selecting a plan.
- The original three-building loading path and every KCC interactive rebuild call growBuilding. The scene exposes the stage order and its relation checks.
- Regeneration starts from retained seed, creates fresh instances, and rejects feeding old generated output back as a new seed. No accumulation of geometry on parameter changes.

Still reused intentionally: the tested analytic finite-prism/ray renderer, original source envelopes, existing lowrise subdivision and its authored interior, retained elevator runtime. They are not reimplemented or claimed newly surveyed. Warehouse is a retained passthrough with explicit unknown internal layout, not a completed rewrite.

Evidence boundaries:
- Foundation and basement are separate unknown records, not 'absent'. Datum is a local coordinate reference unless independent site registration exists.
- Four columns/four beams is a frame-cell prototype only. Existing lowrise design has10 columns/7 beams per floor, not a universal standard. No40–50-storey maximum or0.6m universal window sill is imposed.
- Lowrise actual source count remains2; original level elevations retained but not upgraded to surveyed indoorFFLs. Existing rooms/structure remain authored design.
- KCC28 above-ground storeys,22 reviewed floor plans and66 inferred slot correspondences are different facts. The actual ground entrance and vertical residential route remain unknown. Floor-level lift→lobby→dwelling→stair-entry topology is checked, not certified clearance/egress. Unsupported4/F,27/F do not receive substitutes;6F platform and18F family transition remain exceptions.
- Roof/parapet/equipment use evidence or explicit unknown status; no generic tank or parapet is fabricated. Actual original roof surfaces are preserved.

Checks include immutable seed/level/source preservation; room routes through corridors/stairs; host→hole→infill; deterministic thickness rollback; frame-grid effect on members; and same-page browser thickness0.18→0.28→0.18 visual/geometry rollback. Node tests are not browser proof. R10 is QA-only until its actual browser result is reviewed; public R09 is preserved.
