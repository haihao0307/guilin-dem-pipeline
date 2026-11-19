import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { deriveMeasuredCase } from '../r07/cases.mjs';
import { profileFor } from '../r07/profiles.mjs';
import * as Kcc from '../whole-building-r01/tower.mjs';
import * as Cases from '../whole-building-r02/case-systems.mjs';
import { caseSystemConfig, resolveCaseParameters } from '../whole-building-r02/case-config.mjs';
import { controllerFor, CASE_SYSTEM_INTERFACES } from '../whole-building-r02/mother-system.mjs';

const ids = ['lowrise', 'kcc', 'warehouse'];
const readJSON = path => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const official = readJSON('../r07/sources/official-footprints.json');
const measured = Object.fromEntries(ids.map(id => [id, deriveMeasuredCase(readJSON(
  '../../hk-three-buildings-r01/geometry/' + profileFor(id).modelId + '.score.json',
))]));
const before = structuredClone({ official, measured });
const nativeDerive = (id, parameters) => id === 'kcc'
  ? Kcc.deriveWholeBuilding(measured[id], official, parameters)
  : Cases.deriveCaseSystem(id, measured[id], official, parameters);
const models = Object.fromEntries(ids.map(id => [id, controllerFor(id).derive(measured[id], official)]));
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);

test('one immutable controller contract exposes all six configuration interfaces for each case', () => {
  const methods = [
    'derive', 'route', 'query', 'ray', 'validate', 'createLiftState', 'targetLift',
    'advanceLift', 'liftVisuals', 'liftDoorLinks', 'loadingRoute',
    'selectedInstances', 'packDescriptors', 'resolveParameters',
  ];
  for (const id of ids) {
    const controller = controllerFor(id);
    assert.equal(controller, controllerFor(id));
    assert.ok(Object.isFrozen(controller));
    assert.equal(controller.caseId, id);
    assert.equal(controller.modelSchema, models[id].schema);
    assert.deepEqual(controller.interfaceNames, CASE_SYSTEM_INTERFACES);
    for (const method of methods) assert.equal(typeof controller[method], 'function', id + '.' + method);
    for (const key of CASE_SYSTEM_INTERFACES) assert.deepEqual(controller.configuration[key], caseSystemConfig(id)[key]);
    assert.deepEqual(controller.profile, profileFor(id));
    assert.deepEqual(controller.resolveParameters(), resolveCaseParameters(id));
  }
  assert.deepEqual(ids.map(id => controllerFor(id).capabilities.liftInterfaceCount), [0, 3, 1]);
  for (const invalid of ['tower', '__proto__', 'constructor', '', null, 1, {}]) {
    assert.throws(() => controllerFor(invalid), /Unknown building system case/);
  }
});

test('configuration and profile metadata are isolated and never injected into native models', () => {
  for (const id of ids) {
    const controller = controllerFor(id), configuration = controller.configuration, profile = controller.profile;
    configuration.sourceComponents[0].official.storeys = 999;
    configuration.coreServiceSets[0].lifts.designInterfaceCount = 999;
    profile.known.push('not source evidence');
    assert.deepEqual(controller.configuration, caseSystemConfig(id));
    assert.deepEqual(controller.profile, profileFor(id));
    assert.equal(Object.hasOwn(models[id], 'configuration'), false);
  }
  assert.equal(Object.hasOwn(models.kcc, 'profile'), false);
  assert.deepEqual(controllerFor('kcc').capabilities.routeModes, ['stairs', 'lift']);
  assert.deepEqual(controllerFor('warehouse').capabilities.routeModes, ['stairs', 'lift', 'freight']);
});

for (const id of ids) test(id + ' default adapter model deep-equals the unmodified native derivation', () => {
  assert.deepEqual(models[id], nativeDerive(id));
  assert.deepEqual({ official, measured }, before);
});

for (const parameters of [
  { towerFloorCount: 2 },
  { floorCount: 3, floorHeight: 3.5 },
  { podiumFloorHeights: [3.5, 3.6, 3.6, 3.7] },
  { towerFloorCount: 3, towerFloorHeights: [3.2, 3.3, 3.4], stairWidth: 1.05, stairRun: 2.25 },
  // The legacy generator gives floorCount precedence; the config normalizer
  // intentionally rejects this conflict. Derive must not change that behavior.
  { towerFloorCount: 4, floorCount: 2 },
]) test('KCC exact native config and geometry survive edit ' + JSON.stringify(parameters), () => {
  const input = structuredClone(parameters);
  const adapted = controllerFor('kcc').derive(measured.kcc, official, input);
  const direct = nativeDerive('kcc', parameters);
  assert.deepEqual(adapted, direct);
  assert.deepEqual(adapted.config, direct.config);
  assert.deepEqual(input, parameters);
});

test('strict parameter resolution stays explicit rather than changing KCC legacy derive', () => {
  const controller = controllerFor('kcc');
  assert.throws(() => controller.resolveParameters({ towerFloorCount: 4, floorCount: 2 }), /Conflicting/);
  for (const parameters of [{ towerFloorCount: 25 }, { podiumFloorHeight: 3.4 }, { scale: 2 }]) {
    assert.throws(() => controller.derive(measured.kcc, official, parameters));
  }
});

test('lowrise and warehouse edited models are passed through without KCC templates', () => {
  for (const [id, parameters] of [
    ['lowrise', { floorHeight: 3.5, stairWidth: 1.2, stairTreadDepth: .32 }],
    ['warehouse', { towerFloorCount: 3, towerFloorHeight: 3.5 }],
    ['warehouse', { podiumFloorHeights: [5.6, 7.9] }],
  ]) {
    assert.deepEqual(controllerFor(id).derive(measured[id], official, parameters), nativeDerive(id, parameters));
  }
  assert.deepEqual(models.lowrise.levels.map(level => level.id), ['L01', 'L02']);
  assert.equal(models.lowrise.interfaces.lifts.length, 0);
  for (const id of ['lowrise', 'warehouse']) assert.equal(models[id].graph.nodes.some(node => node.type === 'unit'), false);
});

test('warehouse raw records and design warnings remain unchanged, not a verified 16-storey total', () => {
  const controller = controllerFor('warehouse'), model = models.warehouse;
  assert.deepEqual(controller.configuration.levelSchedule.rawOfficialRecords, {
    towerStoreys: 12, towerBasements: null, podiumStoreys: 2, podiumBasements: 2,
  });
  assert.equal(controller.configuration.levelSchedule.verifiedWholeBuildingTotal, null);
  assert.equal(model.summary.officialTotalStoreysVerified, false);
  assert.equal(model.summary.basementGenerated, false);
  assert.equal(model.summary.unitCount, 0);
  assert.equal(model.summary.actualFreightLiftCount, null);
  assert.equal(model.summary.designFloorCount, 14);
  assert.match(model.semantics.storeyCount, /上部12、裙房2、地下2/);
  assert.match(model.semantics.core, /DESIGN/);
  assert.equal(model.structuralCertification, false);
  assert.equal(model.graph.actualInteriorComplete, false);
});

test('route unifies method names without altering route modes, points or segments', () => {
  for (const id of ids) {
    const controller = controllerFor(id), model = models[id], target = model.levels.at(-1).id;
    const native = id === 'kcc' ? Kcc.routeWholeBuilding : Cases.routeCaseSystem;
    for (const mode of controller.capabilities.routeModes) {
      const route = controller.route(model, target, { mode });
      assert.deepEqual(route, native(model, target, { mode }));
      assert.equal(route.actualRouteVerified, false);
      assert.equal(route.targetFloorId, target);
    }
    assert.throws(() => controller.route(model, 'not-a-floor'), /Unknown design floor/);
  }
  assert.deepEqual(controllerFor('warehouse').loadingRoute(models.warehouse), Cases.loadingRouteCaseSystem(models.warehouse));
  assert.equal(controllerFor('warehouse').loadingRoute(models.warehouse).pedestrianRouteSeparate, true);
  for (const id of ['lowrise', 'kcc']) assert.throws(() => controllerFor(id).loadingRoute(models[id]), /No loading route/);
});

test('no-lift lowrise has null state, empty visuals/links, and rejects motion or lift routes', () => {
  const controller = controllerFor('lowrise'), model = models.lowrise;
  assert.equal(controller.createLiftState(model), null);
  assert.deepEqual(controller.liftVisuals(model, null), { archetypes: [], instances: [], doorLinks: [], carPosition: null });
  assert.deepEqual(controller.liftDoorLinks(model, null), []);
  assert.throws(() => controller.targetLift(model, null, 'L02'), /No matching DESIGN lift/);
  assert.throws(() => controller.advanceLift(model, null, 1), /No matching DESIGN lift/);
  for (const mode of ['lift', 'freight']) assert.throws(() => controller.route(model, 'L02', { mode }), /No invented lift/);
});

test('native lift motion and door connectivity agree for KCC and warehouse', () => {
  for (const id of ['kcc', 'warehouse']) {
    const controller = controllerFor(id), native = id === 'kcc' ? Kcc : Cases, model = models[id];
    for (const lift of model.interfaces.lifts) {
      const target = model.levels.at(-1).id;
      let state = controller.createLiftState(model, lift.id);
      assert.deepEqual(state, native.createLiftState(model, lift.id));
      assert.deepEqual(controller.liftVisuals(model, state), native.liftVisuals(model, state));
      assert.deepEqual(controller.liftDoorLinks(model, state), native.liftDoorLinks(model, state));
      const moving = controller.targetLift(model, state, target);
      assert.deepEqual(moving, native.targetLift(model, state, target));
      assert.equal(moving.doorOpen, false);
      assert.deepEqual(controller.liftDoorLinks(model, moving), []);
      state = controller.advanceLift(model, moving, 1, { speed: 1.5 });
      assert.deepEqual(state, native.advanceLift(model, moving, 1, { speed: 1.5 }));
      state = controller.advanceLift(model, state, 100);
      assert.equal(state.currentFloorId, target);
      near(state.currentElevation, model.levels.at(-1).elevation);
      assert.equal(controller.liftDoorLinks(model, state).length, 2);
    }
  }
});

test('query, exact ray, selected instances and descriptors preserve native results', () => {
  for (const id of ids) {
    const controller = controllerFor(id), model = models[id], level = model.levels.at(-1);
    const nativeQuery = id === 'kcc' ? Kcc.queryWholeBuilding : Cases.queryCaseSystem;
    const nativeRay = id === 'kcc' ? Kcc.intersectWholeBuildingRay : Cases.intersectCaseSystemRay;
    const nativeSelection = id === 'kcc' ? Kcc.selectedInstances : Cases.selectedCaseInstances;
    const nativePack = id === 'kcc' ? Kcc.packWholeBuildingDescriptors : Cases.packCaseSystemDescriptors;
    const plan = id === 'lowrise' ? [-3, 6] : id === 'warehouse' ? [-13, -5] : [0, 0];
    const point = [plan[0], level.elevation + .8, plan[1]], options = { floorIds: [level.id], maxDistance: 1 };
    assert.deepEqual(controller.query(model, point, options), nativeQuery(model, point, options));
    const hit = controller.ray(model, point, [0, -1, 0], options);
    assert.deepEqual(hit, nativeRay(model, point, [0, -1, 0], options));
    assert.equal(hit.hit, true);
    near(hit.point[1], level.elevation);
    assert.deepEqual(controller.selectedInstances(model, { floorIds: [level.id] }), nativeSelection(model, { floorIds: [level.id] }));
    assert.deepEqual(controller.packDescriptors(model), nativePack(model));
  }
});

test('localY/elevation and fflM/elevationMpd are already compatible, with no model patch', () => {
  for (const id of ids) for (const level of models[id].levels) {
    assert.equal(level.localY, level.elevation);
    assert.equal(level.fflM, level.elevationMpd);
    near(level.elevationMpd, level.elevation + measured[id].sourceGeoreference.originEastingNorthingHeight[2]);
  }
});

test('validation delegates native geometry checks and rejects mismatched models on every operation', () => {
  for (const id of ids) {
    const controller = controllerFor(id), model = models[id];
    assert.deepEqual(controller.validate(model), id === 'kcc' ? Kcc.validateWholeBuilding(model) : Cases.validateCaseSystem(model));
    const other = models[ids.find(otherId => otherId !== id)];
    for (const name of [
      'route', 'query', 'ray', 'validate', 'selectedInstances', 'packDescriptors',
      'createLiftState', 'targetLift', 'advanceLift', 'liftVisuals', 'liftDoorLinks', 'loadingRoute',
    ]) assert.throws(() => controller[name](other), /Matching .* building-system model required/, id + '.' + name);
    assert.throws(() => controller.derive(measured[other.caseId], official), /Original KCC|Matching original/);
  }
  assert.deepEqual({ official, measured }, before);
});
