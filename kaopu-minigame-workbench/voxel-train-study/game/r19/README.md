# R19 clean native Hong Kong railway runtime (candidate)

Self-contained function runtime inside the existing train game. No imports into earlier Rxx runtime directories. Shared dependencies are the existing Three.js r170 renderer, one host audio/music library and the host icon, rather than copies of historical versions.

## Preserved

- Accepted metre dimensions, WD-inspired 2-8-0 with tender and two full-size coaches; 1.435 m rail gauge. Prototype and provisional authoring datums remain separately labelled in metre-scale.mjs.
- Identical Session physics, controls, replay, station interlocks, passengers, smoke/audio and camera presets. New r19 save/settings namespace.
- All 74 original seeded buildings over 700 scene metres; timetable 4.4 km remains display metadata. Same three architecture LODs, sign outlines, cages, shops, repairs and weather parameters. No transmitted architectural mesh or image texture.

## Different renderer

- Spatial 44 m cells share the same twelve procedural shader families. Each cell owns stable small appearance tables; shader programs are reused across cells. Colour, age, repair, moisture, salt exposure, façade grids and origins remain per-instance/per-vertex indexed data.
- Runtime-created triangle geometry is retained, not replaced by box impostors. Each vertex/instance carries one appearance-table index; bounded24-entry uniform tables preserve all weather parameters without duplicating20 floats on every vertex. Measure real GPU buffers and draw submission costs explicitly.
- Cloth uses the same shared elapsed-time displacement in vertex shaders, with analytic normals and matching shadow displacement. It is analytic wind, not physical cloth simulation. Vertex position equivalence is tested; visual normal equivalence requires real WebGL review.
- Source recipe handles retain ownership and validate triangle/clearance limits. Only batch renderer objects enter the scene. Accounting is recomputed at topology changes instead of twice every frame.
- Only cells whose source handles/LOD change rebuild. Unchanged cell geometry UUIDs, material tables and BufferAttribute versions stay intact; time/rebasing changes uniforms and one district transform. Edited generation parameters are rebuilt into a new validated source handle.
- Culling uses conservative bounds of used vertices/instances plus the full analytic cloth wind envelope. No building is deleted to reduce draw calls. Empty cells dispose their owned buffers and material tables.

## Verification boundary

The pre-incremental candidate `7237abd423be76ff90649fc500fb01d9aacb34b6` passed actual WebGL, audio/music, native first-to-second station driving,151 rendered coverage frames and exact input replay in run38049296521. Its streaming world-update p95 was477.5ms, so functional success was not accepted as smooth performance.

Six GPU isolation variants found dynamic material-table indexing was not dominant. Removing procedural weathering or all lighting was diagnostic only and is not shipped. Acceptance of the incremental/culling candidate requires the exact associated PR CI and its retained evidence; this source README is not a pass certificate. Final tests compare a frozen old batch renderer against the candidate on the same WebGL host, separating ordinary and topology-changing frame p95, plus original native driving and pixel/shadow gates. Software-renderer numbers are not user hardware performance. This candidate is not deployed or described as film-quality.

Final CPU sweep:852 camera rows /6816 corridor checks; maximum127 resident batches,19,062,184 geometry bytes,2,636,288 instance bytes,87 table materials /95 including depth. These are generated runtime costs, not score file size. Enforced route ceilings are144 batches /24 MB geometry /3 MB instance /112 table materials /128 including depth.

`EXTRACTION_SOURCES.json` records source hashes before optimization. Historical source and pages remain unchanged. QA files may import old versions solely for explicit equivalence tests; production modules do not.
