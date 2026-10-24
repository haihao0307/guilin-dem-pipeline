import fs from 'node:fs';
import assert from 'node:assert/strict';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {attachKccUnitDoors, deriveKccUnitRoute} from './kcc-unit-doors.mjs';
import {updateAperture, queryApertures} from './kowloon-building-mother-r01/r07/apertures.mjs';
import {prepareBuildingLifts, attachBuildingLifts} from './lift-runtime.mjs';
import {createKccJourney} from './kcc-journey-runtime.mjs';

const read = p => JSON.parse(fs.readFileSync(new URL(p, import.meta.url), 'utf8'));
const source = deriveMeasuredCase(read('hk-three-buildings-r01/geometry/B359971994401063C0.score.json'));
const controller = controllerFor('kcc');
const base = controller.derive(source, read('kowloon-building-mother-r01/r07/sources/official-footprints.json'));
const model = attachKccUnitDoors(base);
assert.equal(model.kccUnitAccess.doorCount, 144);
assert.deepEqual(model.levels, base.levels);
const modelBefore = JSON.stringify(model), results = [];

// Exercise the actual retained lift runtime to completion, not just a guessed
// lobby coordinate. The intentionally nonzero scene translation must cancel.
const visual = controller.liftVisuals(base, controller.createLiftState(base));
const prepared = prepareBuildingLifts([{caseId: 'kcc', source, whole: base, model: {
  ...model, archetypes: [...model.archetypes, ...visual.archetypes], instances: [...model.instances, ...visual.instances],
}}]);
const bound = prepared.entries[0].model, translation = [31, 0, -17], ns = id => 'kcc::' + id;
const building = {caseId: 'kcc', buildingId: source.sourceModelId, rootId: ns(bound.graph.nodes[0].id), transform: {translation}, localModel: bound};
const scene = {buildings: [building], registry: [], model: {
  instances: bound.instances.map(i => ({...structuredClone(i), id: ns(i.id)})),
  graph: {nodes: bound.graph.nodes.map(n => ({...n, id: ns(n.id)})), edges: bound.graph.edges.map(e => ({...e, from: ns(e.from), to: ns(e.to)}))},
}};
const lift = attachBuildingLifts({prepared, scene});
const journey = createKccJourney({building, liftRuntime: lift});
assert(journey.goToFloor('T01').accepted);
for (let i = 0; i < 3000 && journey.snapshot().active; i++) journey.tick(.1);
assert.equal(journey.snapshot().phase, 'arrived');
assert.equal(lift.snapshot('kcc').passenger.mode, 'outside');
const exitPose = lift.ridePose('kcc'), floor = model.kccUnitAccess.levels.find(f => f.id === exitPose.floorId);
const exitFootSource = exitPose.eye.map((v, k) => v - translation[k] - (k === 1 ? exitPose.body.eyeHeightM : 0));
assert(Math.abs(exitFootSource[1] - floor.elevation) < 1e-12);
const exitFootFloor = [exitFootSource[0], 0, exitFootSource[2]];
assert.deepEqual(exitFootFloor, [0, 0, 0]);
let closedOtherDoorSamples = 0;
for (const key of 'ABCDEF') {
  const route = deriveKccUnitRoute(model, key, {startPoint: exitFootFloor, floorId: floor.id});
  assert(route.passed, `${key}: ${route.reason}`);
  assert.deepEqual(route.path[0], exitFootFloor, 'first point equals the real exiting foot; no lattice snap');
  assert.deepEqual(route.startPoint, exitFootFloor);
  assert.deepEqual(route.path.at(-1), route.endPoint, 'end target is preserved exactly too');
  assert.equal(route.pathSpace, 'floor-local');
  assert(route.endpointConnectorsChecked);
  assert.equal(route.doorStates[key], 1);
  const doors = model.hostedComponents.apertures.filter(a => a.designUnitDoor && a.floorId === floor.id);
  const planningDoors = doors.map(a => ({...a, ...updateAperture(a, {openT: a.roomKey === key ? 1 : 0})}));
  const targetClosed = doors.find(a => a.roomKey === key);
  let closedTargetHit = false;
  const offsets = [[0, 0], ...Array.from({length: 8}, (_, k) => [.23 * Math.cos(k * Math.PI / 4), .23 * Math.sin(k * Math.PI / 4)])];
  for (const p of route.path) for (const [dx, dz] of offsets) for (const height of [.1, .95, 1.85]) {
    const q = [p[0] + dx, floor.elevation + height, p[2] + dz];
    closedTargetHit ||= queryApertures(targetClosed, q).inside;
    for (const door of planningDoors) {
      assert(!queryApertures(door, q).inside, `Path to ${key} intersects ${door.roomKey} door at ${q}`);
      if (door.roomKey !== key) closedOtherDoorSamples++;
    }
  }
  assert(closedTargetHit, `Closing selected ${key} door must block this route`);
  for (const other of 'ABCDEF') if (other !== key) assert.equal(route.doorStates[other], 0);
  for (let i = 1; i < route.path.length; i++) assert(Math.hypot(...route.path[i].map((v, k) => v - route.path[i - 1][k])) <= .020000001);
  results.push({key, pathSamples: route.path.length, gridChecks: route.checks, exactExitGapM: 0, otherDoorsClosed: 5});
}

// A route starting in a different wing must not walk through that wing's
// CLOSED door. Even runtime doors left open by previous use cannot weaken the
// planning policy: only the requested destination is open in the copy.
const allOpen = attachKccUnitDoors(base, {openT: 1}), denied = [];
for (const [i, target] of [...'ABCDEF'].entries()) {
  const other = 'ABCDEF'[(i + 1) % 6], start = model.kccUnitAccess.templateRooms.find(r => r.key === other).inRoom;
  const route = deriveKccUnitRoute(allOpen, target, {startPoint: [...start], floorId: floor.id});
  assert.equal(route.passed, false, `Must not exit closed other-wing ${other} to reach ${target}`);
  assert.equal(route.doorStates[other], 0);
  denied.push({fromWing: other, target, reason: route.reason});
}
const exact = [.031, 0, .027], custom = deriveKccUnitRoute(model, 'A', {startPoint: exact});
assert(custom.passed); assert.deepEqual(custom.path[0], exact, 'non-lattice start retained verbatim');
assert.equal(deriveKccUnitRoute(model, 'A', {startPoint: [1000, 0, 1000]}).passed, false, 'cannot snap unsupported input onto supported floor');
assert.equal(deriveKccUnitRoute(model, 'A', {floorId: 'P04'}).passed, false, 'do not borrow tower rooms for podium');
assert.equal(deriveKccUnitRoute(model, 'A', {floorId: 'B1'}).passed, false, 'do not borrow tower rooms for basement');
assert.throws(() => deriveKccUnitRoute(model, 'A', {startPoint: [0, floor.elevation, 0]}), /floor-local/);
assert.throws(() => deriveKccUnitRoute(model, 'A', {startPoint: [NaN, 0, 0]}), /floor-local/);
assert.throws(() => deriveKccUnitRoute(model, 'A', {step: 0}), /sampling/);
assert.deepEqual(deriveKccUnitRoute(model, 'A').path[0], [0, 0, 0], 'backward-compatible default also fixes the old 5.2 cm snap');
assert.equal(JSON.stringify(model), modelBefore, 'route planning never opens model doors or edits geometry');
console.log(JSON.stringify({passed: true, designDoors: 144, levelsRetained: true, realLiftExitFloor: floor.id,
  realLiftExitFootSource: exitFootSource, realLiftExitFootFloor: exitFootFloor,
  roomRoutes: results, closedOtherDoorSamples, rejectedOtherWingStarts: denied,
  actualLayoutInstalled: false, verification: 'sampled design support and obstacle checks; not continuous collision or real-building certification'}));
