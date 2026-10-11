# Native wall units R01 — isolated integration candidate

Three original, parameter-generated foundation pieces for the existing railway scene:

1. `plaster-window`: pierced wall, window frame/panes, projecting sill, drip edge, younger repair layer, ground-contact moisture and sill-aligned runoff material.
2. `tile-door`: real floor-level door opening, individual clipped ceramic tiles and joints, rigid hinged door, typed pipe path and inlet/outlet ports.
3. `cage-window`: pierced window plus projected iron cage, anchor plates and two unoccupied hanging sockets.

No external mesh, image texture, reference photograph, character, bed, complete room, building, website, renderer or animation loop is included. The cage is **not** advertised as a walkable balcony. Stairs and standing balcony floors are not supplied by these three pieces.

## Existing-host integration

The host supplies its own `THREE` and the existing `street/materials.mjs` factory. The tested material revision is `KST1-surfaces-2`; other revisions are rejected until checked. These functions are reused, not relabelled as an independently recovered Brick/Skin workbench. The three pieces have a new narrow wall schema and do not satisfy the existing whole-building `KST1` score schema.

Runtime closure:

- `wall-score.mjs`: strict score defaults, dimensional checks and deterministic seed.
- `wall-geometry.mjs`: the original shape rules, opening clipping and native geometry builder.
- `wall-materials.mjs`: adapter to the existing texture-free KST1 surfaces.
- `wall-unit.mjs`: build/update/measure/graph/door/dispose API.
- `wall-native.mjs`: pinned dependency validation, true SQLite decode, build and atomic replacement.
- `native-codec/`: independent `kaopu.functional-wall/0.1-experimental` SQLite envelope; see its README.
- `fixtures.mjs`: direct-score fixture for unit tests only. For actual native-object QA use `createNativeWallUnitFixtures` from `wall-native.mjs`.

`buildWallUnit(score, {THREE, materials})` returns a handle with `root`, `proof`, `update(worldSeconds, {wetness})`, `setDoorOpen(boolean)`, `worldGraph()`, `passageFits({width,height})`, `measure()`, `snapshot()` and `dispose()`.

For native QA, `createNativeWallUnitFixtures({THREE, createMaterialLibrary, readSampleBytes, dependencyBytes, origin, yaw})` verifies dependencies and reads exactly the three fixed names in `NATIVE_WALL_SAMPLE_NAMES`. `readSampleBytes` is a host-owned reader for the packaged samples. Dependency IDs and pins come from `pinnedDependencies()`; the host maps these IDs to its own fixed local module URLs, including `host-street-materials`. No filename, URL or executable payload supplied by a .KaoPu object is fetched or executed.

The fixture returns one group and three handles. Mount that group only in an opt-in QA mode inside the existing scene. It creates no input handlers, camera, renderer, RAF, timer or route edits. Call its update with the **same authoritative session time** as the train. Dispose and remove it on QA exit. It uses its own small material library so it does not exhaust the live street's existing 48-material pool.

Do not route this candidate through the current district batch-material packer: that packer discards the new wall-local coordinate adapter. Direct grouped meshes are the verified integration boundary for this first three-piece inspection.

## Dimensions and interface boundaries

One unit is one metre. Local X spans the wall, Y is up and +Z is outward. Regenerate dimensions rather than scaling the result; unit or ancestor scale other than 1 is rejected. Geometry and material projection use the same local metric score, and can move/yaw with the wall without sliding rain streaks or repair cells.

Defaults are demonstration component dimensions, not a decision about resident room size, population, bed count, historical reconstruction or building-code compliance. The host must pass the actual person/baggage envelope to `passageFits` and connect the inside/outside nodes to real floor surfaces. A portal alone does not create a room or a walkable floor.

Nodes `join-left/right/top/bottom` describe structural attachment planes. `checkWallJoin` verifies coincident endpoints and opposed normals; it does not silently translate pieces or invent a corner, stair or bridge connection. Full geometric overlap and route-clearance checks remain required. Future corner fittings can connect these explicit interfaces.

Door state and the `through-door` graph edge change together. The hinge assembly contributes to measured bounds, including its open sweep extent; host placement must leave that space free. These tests do not yet implement a continuous door-opening animation or swept collision against a moving person.

Pipe endpoints remain `connected:false` until the host connects them. `steam-reserved` labels an interface only, not a working steam system. Hanging sockets have no claimed load rating or interaction. `material.groundContact` must be false for an upper-storey wall not in contact with damp ground; do not give every storey rising damp by copying a ground-floor score unchanged.

## Verification

Run with the actual host game directory:

    WALL_HOST_GAME_ROOT=/path/to/game/r20-plants-r01 node --test wall-unit.test.mjs

The source snapshot tested here is the existing `r20-plants-r01`; 18 unit tests passed. Tests cover true openings, door collision/navigation state, repair/tile clipping, deterministic geometry, sill/material agreement, shader hook insertion, rigid placement, shared clock/pause, isolated uniforms, typed utility endpoints, connectors and resource disposal.

Measured three-fixture geometry: 8,828 triangles, 668,712 bytes, 17 draw calls, zero textures. These are native geometry allocation figures, **not** whole-game FPS or GPU performance results.

The native-codec suite independently reads the actual SQLite files with Python sqlite3, verifies integrity/checksums/pins, tests corruption rejection and decode-to-build recovery. Final receipt files record its latest results.

At this handoff, GPU shader compilation, existing-scene screenshots and visual acceptance are **not yet completed**. Successful CPU shader-string insertion must not be reported as successful GPU rendering. No main entry, live route, train directory or plant implementation was changed by this module work.
