# R19 clean native Hong Kong railway runtime (candidate)

Self-contained function runtime inside the existing train game. No imports into earlier Rxx runtime directories. Shared dependencies are the existing Three.js r170 renderer, one host audio/music library and the host icon, rather than copies of historical versions.

## Preserved

- Accepted metre dimensions, WD-inspired 2-8-0 with tender and two full-size coaches; 1.435 m rail gauge. Prototype and provisional authoring datums remain separately labelled in metre-scale.mjs.
- Identical Session physics, controls, replay, station interlocks, passengers, smoke/audio and camera presets. New r19 save/settings namespace.
- All 74 original seeded buildings over 700 scene metres; timetable 4.4 km remains display metadata. Same three architecture LODs, sign outlines, cages, shops, repairs and weather parameters. No transmitted architectural mesh or image texture.

## Different renderer

- Cross-parcel batches share twelve procedural material families. Colour, age, repair, moisture, salt exposure, façade grids and origins remain per-instance/per-vertex indexed data.
- Runtime-created triangle geometry is retained, not replaced by box impostors. Each vertex/instance carries one appearance-table index; bounded24-entry uniform tables preserve all weather parameters without duplicating20 floats on every vertex. Measure real GPU buffers and draw submission costs explicitly.
- Cloth uses the same shared elapsed-time displacement in vertex shaders, with analytic normals and matching shadow displacement. It is analytic wind, not physical cloth simulation. Vertex position equivalence is tested; visual normal equivalence requires real WebGL review.
- Source recipe handles retain ownership and validate triangle/clearance limits. Only batch renderer objects enter the scene. Accounting is recomputed at topology changes instead of twice every frame.

## Verification boundary

Initial local tests pass. Actual WebGL compilation, visual fidelity, resource release, and performance are pending the exact candidate CI; software-renderer numbers are not user hardware performance. This candidate is not deployed or described as film-quality.

`EXTRACTION_SOURCES.json` records source hashes before optimization. Historical source and pages remain unchanged. QA files may import old versions solely for explicit equivalence tests; production modules do not.
