import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createKccJourney} from './kcc-journey-runtime.mjs';
import {prepareBuildingLifts, attachBuildingLifts} from './lift-runtime.mjs';
import {deriveMeasuredCase} from './kowloon-building-mother-r01/r07/cases.mjs';
import {profileFor} from './kowloon-building-mother-r01/r07/profiles.mjs';
import {controllerFor} from './kowloon-building-mother-r01/whole-building-ground-r01/controller.mjs';
import {deriveCaseIntegration} from './kowloon-building-mother-r01/whole-building-facade-r01/host-integration.mjs';

let checks = 0;
const ok = (condition, message) => {assert(condition, message); checks++;};
const equal = (actual, expected, message) => {assert.deepEqual(actual, expected, message); checks++;};
const read = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url), 'utf8'));

/** Intentionally small deterministic fake. It checks call/board/car/exit
 * ordering, independently exposes closed and moving states, and never grants
 * boarding from a timer in the journey under test. */
function fake() {
  const floors = Array.from({length: 28}, (_, i) => ({id: i < 4 ? 'P0' + (i + 1) : 'T' + String(i - 3).padStart(2, '0'), elevation: i * 3, served: true}));
  const building = {caseId: 'kcc', buildingId: 'test-kcc', localModel: {levels: [...floors, {id: 'B1', elevation: -3, groundExtension: true}]}};
  const s = {available: true, caseId: 'kcc', buildingId: 'test-kcc', liftId: 'test-lift', floors,
    current: floors[0].id, y: 0, v: 0, state: 'IDLE', carDoor: 0,
    landingDoors: Object.fromEntries(floors.map(f => [f.id, 0])), guards: {leveled: true, stationary: true, closed: true, locked: true},
    passenger: {mode: 'outside', floor: floors[0].id, progress: 0}, boardableFloors: [], obstruction: false};
  let pending = null, elapsed = 0, hold = false, denyBoard = false;
  const log = [];
  const open = () => {s.state = 'DWELL'; s.carDoor = 1; s.landingDoors[s.current] = 1; s.boardableFloors = [s.current]; s.guards = {leveled: true, stationary: true, closed: false, locked: false}; s.v = 0;};
  const close = () => {s.carDoor = 0; Object.keys(s.landingDoors).forEach(id => s.landingDoors[id] = 0); s.boardableFloors = []; s.guards = {leveled: false, stationary: false, closed: true, locked: true};};
  const api = {
    snapshot: () => structuredClone(s),
    commandFor(caseId, action) {
      assert.equal(caseId, 'kcc');
      if (action.kind === 'hall') {assert.equal(s.passenger.mode, 'outside'); pending = action.floor; s.state = 'OPENING'; elapsed = 0;}
      else if (action.kind === 'car') {assert.equal(s.passenger.mode, 'inside'); pending = action.floor; s.state = 'CLOSING'; elapsed = 0;}
      else assert.fail('Journey must not bypass guards or toggle obstruction');
      log.push(action.kind + ':' + action.floor); return {accepted: true};
    },
    beginBoard(caseId, floor) {
      assert(s.boardableFloors.includes(floor)); assert.equal(s.passenger.mode, 'outside');
      if (denyBoard) return {accepted: false, reason: 'fake_geometry_collision', certificate: {passed: false}};
      s.passenger = {mode: 'boarding', floor, progress: 0}; elapsed = 0; log.push('board:' + floor); return {accepted: true};
    },
    beginExit() {assert.equal(s.passenger.mode, 'inside'); assert(s.boardableFloors.includes(s.current));
      s.passenger = {mode: 'exiting', floor: s.current, progress: 0}; elapsed = 0; log.push('exit:' + s.current); return {accepted: true};},
    advance(dt) {
      if (hold || s.state === 'FAULT') return;
      elapsed += dt;
      if (['boarding', 'exiting'].includes(s.passenger.mode)) {
        s.passenger.progress = Math.min(1, elapsed / .2);
        if (elapsed >= .2) {s.passenger.mode = s.passenger.mode === 'boarding' ? 'inside' : 'outside'; log.push(s.passenger.mode + ':' + s.passenger.floor); elapsed = 0;}
      } else if (s.state === 'OPENING' && elapsed >= .2) {s.current = pending; s.y = floors.find(f => f.id === pending).elevation; open(); elapsed = 0;}
      else if (s.state === 'CLOSING' && elapsed >= .2) {close(); s.state = 'CRUISING'; s.v = 1; log.push('locked-motion'); elapsed = 0;}
      else if (s.state === 'CRUISING' && elapsed >= .2) {s.current = pending; s.y = floors.find(f => f.id === pending).elevation; s.passenger.floor = pending; open(); elapsed = 0;}
    },
    ridePose() {return {eye: [0, s.y + 1.65, 0], target: [0, s.y + 1.65, 1], floorId: s.passenger.floor, followCar: s.passenger.mode !== 'outside'};},
  };
  return {building, runtime: api, log, state: s, hold: value => hold = value, denyBoard: value => denyBoard = value};
}
function finish(journey, limit = 2000) {
  for (let i = 0; i < limit && journey.snapshot().active; i++) journey.tick(.1);
  const status = journey.snapshot();
  assert.equal(status.active, false, 'test watchdog failed; no production timeout changes arrival');
  return status;
}

{
  const f = fake(), poses = [], j = createKccJourney({building: f.building, liftRuntime: f.runtime, onPose: p => poses.push(p)});
  const before = JSON.stringify(f.building);
  equal(j.snapshot().floors.length, 28);
  equal(j.snapshot().floors[3].label, '设计第 4 层 · P04');
  equal(j.snapshot().floors.at(-1).id, 'T24');
  ok(!j.goToFloor('B1').accepted, 'basement service cannot be invented');
  ok(!j.goToFloor(29).accepted, 'ordinal beyond retained table rejected');
  ok(!j.selectRoom('living').accepted, 'no borrowed lowrise room');
  ok(j.startTour().accepted, 'default 1,2,3,4,28 itinerary accepted');
  ok(!j.goToFloor('P03').accepted, 'repeat action cannot overwrite active passenger context');
  const s = finish(j);
  equal(s.phase, 'arrived'); equal(s.currentFloorId, 'T24');
  equal(s.visitedFloorIds, ['P01', 'P02', 'P03', 'P04', 'T24']);
  for (const [from, to] of [['P01', 'P02'], ['P02', 'P03'], ['P03', 'P04'], ['P04', 'T24']]) {
    const call = f.log.indexOf('hall:' + from), board = f.log.indexOf('board:' + from), inside = f.log.indexOf('inside:' + from), car = f.log.indexOf('car:' + to), exit = f.log.indexOf('exit:' + to), outside = f.log.indexOf('outside:' + to);
    ok(call < board && board < inside && inside < car && car < exit && exit < outside, 'full event order without skipped boarding');
  }
  equal(f.log.filter(x => x === 'locked-motion').length, 4);
  ok(poses.every(p => p.designInspectionOnly && p.actualFloorRegistrationVerified === false), 'every camera pose retains boundary');
  equal(JSON.stringify(f.building), before, 'building geometry and floor metadata are unchanged');
  ok(j.goToFloor('P01').accepted); equal(finish(j).currentFloorId, 'P01', 'downward journey returns through original event path');
}
{
  const f = fake(), j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  f.hold(true); j.goToFloor(4); j.tick(60); j.tick(60);
  equal(j.snapshot().phase, 'waiting-for-lift', 'no fake timeout arrival');
  equal(j.snapshot().currentFloorId, 'P01'); equal(f.log.filter(x => x.startsWith('board')).length, 0);
  j.pause(); const frozen = JSON.stringify(f.state); j.tick(5); equal(JSON.stringify(f.state), frozen, 'paused clock does not advance lift');
  f.hold(false); j.resume(); equal(finish(j).currentFloorId, 'P04');
}
{
  const f = fake(), j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  f.denyBoard(true); j.goToFloor(4); finish(j);
  equal(j.snapshot().reason, 'boarding_rejected'); equal(j.snapshot().currentFloorId, 'P01');
  f.denyBoard(false); ok(j.resume().accepted); equal(finish(j).currentFloorId, 'P04');
}
{
  const f = fake(), j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  j.startTour([4, 28]);
  for (let i = 0; i < 100 && j.snapshot().phase !== 'riding'; i++) j.tick(.05);
  equal(j.snapshot().phase, 'riding');
  const pending = j.cancel(); ok(pending.safeExitPending, 'cancel inside must finish safe exit, not teleport');
  const s = finish(j); equal(s.phase, 'cancelled'); equal(s.currentFloorId, 'P04');
  ok(!f.log.includes('car:T24'), 'cancel discards future stops'); equal(s.passenger.mode, 'outside');
}
{
  const f = fake(), j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  j.goToFloor(4); f.state.state = 'FAULT'; j.tick(.1);
  equal(j.snapshot().reason, 'lift_fault'); ok(!j.resume().accepted, 'cannot override fault');
  equal(j.snapshot().visitedFloorIds, []);
}
{
  const f = fake(), dispatch = f.runtime.commandFor;
  let denyOnce = true;
  f.runtime.commandFor = (owner, action) => {
    if (action.kind === 'car' && denyOnce) {denyOnce = false; return {accepted: false, reason: 'deterministic_rejection'};}
    return dispatch(owner, action);
  };
  const j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  j.goToFloor(4); finish(j); equal(j.snapshot().reason, 'lift_command_rejected');
  equal(f.log.filter(x => x.startsWith('car')).length, 0);
  ok(j.resume().accepted, 'explicit resume retries a known rejected action');
  equal(finish(j).currentFloorId, 'P04'); equal(f.log.filter(x => x === 'car:P04').length, 1);
}
{
  const f = fake(), j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  j.goToFloor(4); j.tick(.05); j.cancel();
  equal(j.snapshot().phase, 'cancelled'); equal(j.snapshot().currentFloorId, 'P01');
  ok(!j.snapshot().active, 'outside cancellation neither boards nor pretends to reach destination');
  const f2 = fake(), j2 = createKccJourney({building: f2.building, liftRuntime: f2.runtime});
  j2.goToFloor(4); for (let i = 0; i < 100 && j2.snapshot().phase !== 'boarding'; i++) j2.tick(.05);
  j2.pause(); const result = j2.cancel(); ok(result.safeExitPending && !result.paused, 'cancel a paused boarding resumes safe completion');
  equal(finish(j2).phase, 'cancelled'); equal(j2.snapshot().currentFloorId, 'P04');
}
{
  const f = fake(), j = createKccJourney({building: f.building, liftRuntime: f.runtime});
  j.goToFloor(4); f.state.buildingId = 'other-building'; j.tick(.1);
  equal(j.snapshot().reason, 'building_or_lift_context_changed');
  equal(f.log.length, 1, 'no commands after changed owner');
  assert.throws(() => j.tick(-1)); assert.throws(() => j.tick(61)); checks += 2;
}

// Real unchanged R02 state machine + real KCC source-bound geometry + actual
// lift runtime and capsule certificates. A minimal namespaced scene avoids GPU
// or unrelated three-building rendering; it is not browser/visual QA.
{
  const source = deriveMeasuredCase(read('./hk-three-buildings-r01/geometry/' + profileFor('kcc').modelId + '.score.json'));
  const official = read('./kowloon-building-mother-r01/r07/sources/official-footprints.json');
  const controller = controllerFor('kcc'), whole = controller.derive(source, official);
  const integration = deriveCaseIntegration('kcc', whole, source, official, {doorOpenT: 1});
  const oldLift = controller.liftVisuals(whole, controller.createLiftState(whole));
  const model = {...integration.model, archetypes: [...integration.model.archetypes, ...oldLift.archetypes], instances: [...integration.model.instances, ...oldLift.instances]};
  const levelBefore = JSON.stringify(model.levels), sourceBefore = JSON.stringify(source);
  const prepared = prepareBuildingLifts([{caseId: 'kcc', source, whole, model}]);
  const bound = prepared.entries[0].model, translation = [0, 0, 0], ns = id => 'kcc::' + id;
  const building = {caseId: 'kcc', buildingId: source.sourceModelId, rootId: ns(bound.graph.nodes[0].id), transform: {translation}, localModel: bound};
  const scene = {buildings: [building], registry: [], model: {
    instances: bound.instances.map(i => ({...structuredClone(i), id: ns(i.id)})),
    graph: {nodes: bound.graph.nodes.map(n => ({...n, id: ns(n.id)})), edges: bound.graph.edges.map(e => ({...e, from: ns(e.from), to: ns(e.to)}))},
  }};
  const runtime = attachBuildingLifts({prepared, scene});
  let maxY = -Infinity, movingFrames = 0, closedLockedFrames = 0;
  const j = createKccJourney({building, liftRuntime: runtime, onPose: () => {
    const s = runtime.snapshot('kcc'); maxY = Math.max(maxY, s.y);
    if (Math.abs(s.v) > 1e-9) {movingFrames++; if (s.guards.closed && s.guards.locked && s.carDoor === 0) closedLockedFrames++;}
  }});
  ok(j.startTour([1, 2, 3, 4, 28]).accepted);
  const final = finish(j, 12000);
  equal(final.phase, 'arrived', JSON.stringify(final.events.at(-1)));
  equal(final.currentFloorId, 'T24'); equal(final.passenger.mode, 'outside');
  equal(final.visitedFloorIds, ['P01', 'P02', 'P03', 'P04', 'T24']);
  ok(movingFrames > 0 && movingFrames === closedLockedFrames, 'every sampled moving frame preserves locks');
  equal(maxY, runtime.snapshot('kcc').floors.at(-1).elevation);
  for (const id of ['P01', 'P02', 'P03', 'P04', 'T24']) ok(runtime.validatePassengerPath('kcc', id).passed, 'real retained body path passes at ' + id);
  const s = runtime.snapshot('kcc');
  ok(s.events.some(e => e.state === 'LOCK_CONFIRM'), 'real controller lock-confirm event observed');
  equal(s.floors.length, 28); ok(!s.floors.some(f => f.id === 'B1'));
  equal(JSON.stringify(model.levels), levelBefore); equal(JSON.stringify(source), sourceBefore);
  equal(model.levels.length, 29, 'B1 still exists in building, not in lift schedule');
  console.log({realLiftJourneyPassed: true, visited: final.visitedFloorIds, movingFrames, original28AboveGroundPlusB1Preserved: true});
}
console.log({passed: true, checks, tests: 'fake deterministic sequencing + retained real lift runtime / geometry', browserQA: 'not_run', actualFloorRegistration: false});
