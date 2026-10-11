# Settlement analytic compiler r02

This is the complete 24-building authored settlement, not a replacement two-building scene. It retains all 234 original floor elevations and the five negotiated borrowing links. The compiler emits no vertex data, triangles, brick instances, individual stair instances or renderer.

## Integration

- `compileSettlementRecipe(year=50)` in `compile.mjs`: `{ packed: Float32Array, layout, buildings, bridges, ... }`.
- `geometryWGSL({ group:0, binding:1 })` in `kernel.mjs`: shared WGSL declarations. Storage is `array<vec4f>` at the chosen binding.
- WGSL `querySettlement(p:vec3f,maxDistance:f32)->GeoHit` and CPU `querySettlement(recipe,[x,y,z],maxDistance)` share one scalar function specification.
- `GeoHit`: `d, materialId, buildingId, componentId, stateId, q, n`. `q` is local metric primitive/member coordinates; `n` is a stable world-space primitive face normal, not a full CSG or mother-field derivative.
- `geoFabric(stateId)->vec4f(ageYears/50, stableEventSeed01, repair01, floorBaseM)` and `geoBuildingHeight(buildingId)->f32` are available on both targets (CPU takes recipe first).
- `updateSnapshot(recipe,{hostSeconds,doorAngles,gateAngles})` updates the same parameters for render and CPU queries. No clock, timer or animation loop is created.

A record with `materialId=0, componentId=0` is a conservative bound only. March on it; never accept it as a visible surface. Building AABBs reject distant queries and only adjacent local floor intervals are evaluated. Procedural stair counts are tiny rules, never per-step geometry arrays. Compound shape fields and mother-displaced fields are not advertised as strict signed distance functions.

Material IDs: 1 plaster, 2 brick/cut substrate, 3 metal, 4 wood, 5 glass, 6 stone. Surface and material resolve the same state ID. The receiver owns mature mother functions, relief, transparency, section clipping, shading, hit buffers and image QA. Cut sections must reuse original body/state IDs and select substrate, not add façade rain to a new plane.

## Packed layout (vec4 offsets)

Header 0: magic / building count / floor count / bridge count.
Header 1: building / floor / bridge / construction-state offsets.
Header 2: door-angle offset / angle-record count / structural year / host seconds.
Header 3: authored ground framing limits (ground field itself is an infinite plane).

Building stride = 8 vec4:
1. world x/z centre, width, depth
2. ground rise, regular rise, floor count, top elevation
3. core-facing x sign, street-facing z sign, first floor record, packed building ID
4. attached bridge index, level, facade code (0 core side, 1 far side, 2 front), port tangent coordinate
5. drain local u/v, first angle record, foundation year
6. core width, near landing depth, flight width, outside wall thickness
7. slab thickness, tread depth, intermediate landing depth, final floor state index
8. reserved

Floor stride = 2 vec4: base, rise, zone count, construction year; state index, angle index, reserved, reserved.
Bridge stride = 4 vec4: horizontal lower/upper endpoints; low/high deck, width, thickness; building IDs and shared state; gate angle, horizontal length, riser count.
Construction state stride = 1 vec4 as `geoFabric`. Door-angle record is one vec4 per floor: street/bridge, core door, first partition, second partition.

IDs are snapshot-local table IDs. Do not parse a B-number into buildingId: source insertion order starts B01, B09, B03, B07, B02. `recipe.buildings` is the mapping. Component IDs remain shared in every view of one snapshot: buildingId×65536 + floor×256 + part; roof uses +60000; bridge IDs start at 15,000,000. Every integer remains exactly representable in Float32.

## Geometry corrections

The frozen r01 source described topology and coarse envelopes, not complete solids. This compiler:

- Gives outside/partition walls, floor/roof slabs, frames, glass and leaves actual thickness.
- Cuts true stair shafts through every upper slab and roof; evaluates two own flights plus an intermediate landing at the actual floor rise.
- Uses consistent near-facade landings across floors instead of mirrored graph points.
- Moves borrowing ports to clear near-facade corridors. Old mid-core bridge endpoints would hit stair flights.
- Resolves all five bridge floor mismatches with actual procedural treads and independently rotating gates.
- Opens the street leaf outward to avoid obstructing the route from entry to the own staircase.
- Adds roof safety rails, an access-clear tank domain, external drains, continuous ground and 1.435m-gauge analytic rail head/web/foot profiles with procedural sleepers.

Core side/orientation, existing program identity, floor chronology and room-zone counts are retained. These are authored corrections, not a measured historical reconstruction. Room/zone graph paths have not all been revalidated against the corrected geometry.

## Route evidence

`routes.mjs` validates one connected street → B01 entry → B01 own stairs → B01/B02 borrowing bridge and gate → B02 own stairs → B02 roof chain. The fixed noon snapshot has an outward street leaf at −π/2 and other used leaves/gate at +π/2.

- 306 supported tread/landing keyframes
- 3,532 swept body positions, at no more than 0.06m intervals
- 28,256 conservative distance-sphere tests, with foot/ankle/body/shoulder/head probes
- 1.8m body height; 0.22m torso radius; 0.16m head radius
- Highest step 0.171875m
- Only 18 routes labelled sampled-chain-clear; 757 explicitly untested
- Closed-door and closed-gate negative controls fail physically

A second pass expands non-contact body/head/ankle obstacles by 0.04m. Foot support is deliberately separate: mature-mother displaced tread contact still requires receiver/physics verification. This is sampled macro clearance plus an obstacle envelope, not a full rendered-field, movement-controller, accessibility or engineering certification.

## Reproduce

`node --test --test-reporter=tap walled-city-growth-r02/compiler/query.test.mjs`

`node walled-city-growth-r02/compiler/export.mjs`

The exact frozen build-only source copies are in `../input/r01/`; the runtime receives only the compact parameter buffer and generated shared geometry. Compiler outputs, tests, source byte counts, binary/JSON sizes, hashes and precise remaining gaps are in `output/COMPILER-RECEIPT.json`. No browser, GPU, public upload or third-party write is performed by this compiler task.

## Door-sweep bound correction

The first frozen horizontal +0.30m building bound did not enclose outward door tips. The counterexample at world (−20.265, 1.2, −4.8) was inside B01's open wood leaf but returned a +0.40m bound. This was corrected before the receiver's next real GPU run.

The shared query now uses +1.05m horizontal building padding. A 1.12m port has a 1.01m leaf and 0.025m half-thickness, so its worst normal excursion beyond a 0.09m inset facade plus the receiver's 0.036m shell is sqrt(1.01²+0.025²) − 0.09 + 0.036 = 0.95631m, below 1.05m. The near-facade reverse tangential swing is smaller. Building vertical bounds now span −0.25m to roof+1.15m, containing the slab and roof rail shell.

A bridge gate can rotate backward beyond its deck side: its full side envelope is halfWidth + sqrt(width²+0.025²) + 0.036. The new half-bound 1.5×width+0.05 contains that envelope, including 180° rotation. Bridge vertical bounds extend to highDeck+1.20m for the 1.14m gate plus shell. Four additional tests cover all24 outward street leaves, far-side borrowing leaves, a reversed bridge gate and the numeric bounds. New compiler regression: 44/44; archived r01 regression: 44/44.
