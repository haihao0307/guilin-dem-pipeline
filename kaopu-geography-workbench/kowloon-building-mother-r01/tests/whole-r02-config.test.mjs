import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import {
  CASE_SYSTEM_CONFIG_SCHEMA, CASE_SYSTEM_INTERFACES, CASE_SYSTEM_CONFIGS,
  caseSystemConfig, resolveCaseParameters,
} from '../whole-building-r02/case-config.mjs';
import { deriveMeasuredCase } from '../r07/cases.mjs';
import { deriveWholeBuilding } from '../whole-building-r01/tower.mjs';

const configUrl = new URL('../whole-building-r02/case-config.mjs', import.meta.url);
const readJSON = async path => JSON.parse(await readFile(new URL(path, configUrl), 'utf8'));
const footprints = await readJSON('../r07/sources/official-footprints.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const ids = ['lowrise', 'kcc', 'warehouse'];

test('all three cases expose the same six interfaces with stable namespaced IDs', () => {
  assert.deepEqual(Object.keys(CASE_SYSTEM_CONFIGS), ids);
  assert.deepEqual(CASE_SYSTEM_INTERFACES, [
    'sourceComponents', 'levelSchedule', 'coreServiceSets',
    'circulationPolicy', 'floorArchetypes', 'entranceBindings',
  ]);
  const seen = new Set();
  for (const id of ids) {
    const config = caseSystemConfig(id);
    assert.equal(config.schema, CASE_SYSTEM_CONFIG_SCHEMA);
    assert.equal(config.caseId, id);
    for (const name of CASE_SYSTEM_INTERFACES) {
      assert.ok(Object.hasOwn(config, name), `${id}: ${name}`);
      const values = Array.isArray(config[name]) ? config[name] : [config[name]];
      assert.ok(values.length);
      for (const value of values) {
        assert.ok(value.id.startsWith(id + ':'));
        assert.ok(!seen.has(value.id), `duplicate interface ID ${value.id}`);
        seen.add(value.id);
      }
    }
    assert.deepEqual(config, caseSystemConfig(id));
    assert.equal(config.assumptions.actualInteriorComplete, false);
    assert.equal(config.assumptions.structuralCertification, false);
    assert.equal(config.assumptions.fireSafetyCertification, false);
    assert.equal(config.assumptions.physicsEnabled, false);
  }
});

test('official component fields match existing ledger bytes and remain scoped', () => {
  for (const id of ids) {
    const config = caseSystemConfig(id);
    for (const part of config.sourceComponents) {
      const source = footprints.parts.find(p => p.componentId === part.sourceComponentId);
      assert.equal(source.caseId, id);
      assert.equal(part.official.objectId, source.attributes.OBJECTID);
      assert.equal(part.official.baseMpd, source.attributes.BaseHeight);
      assert.equal(part.official.topMpd, source.attributes.TopHeight);
      assert.equal(part.official.storeys, source.attributes.Storeys);
      assert.equal(part.official.basementStoreys, source.attributes.StoreysInBasement);
      assert.equal(part.official.footprintAreaM2, source.attributes.Shape__Area);
      assert.equal(part.official.blockType, source.attributes.BuildingBlockType);
      assert.equal(part.official.featureDateStamp, source.attributes.DateStamp);
      assert.equal(part.generatedBasements, false);
      assert.equal(part.footprintReference.sourceUrl, source.sourceUrl);
    }
    for (const schedule of config.levelSchedule.components) {
      const source = config.sourceComponents.find(p => p.id === schedule.sourceComponentRef);
      assert.ok(source);
      assert.equal(schedule.defaultCount, source.official.storeys);
      assert.equal(schedule.floorElevationsEvidence, 'design');
      assert.equal(schedule.floorHeightsEvidence, 'design');
      assert.equal(schedule.actualFloorLabels, null);
    }
  }
});

test('source recipes retain original hashes, bounds and coordinate frames', async () => {
  for (const id of ids) {
    const config = caseSystemConfig(id);
    const bytes = await readFile(new URL(config.source.scorePath, configUrl));
    assert.equal(sha256(bytes), config.source.scoreSha256);
    const measured = deriveMeasuredCase(JSON.parse(bytes));
    assert.deepEqual(config.dimensions.measuredSourceBounds, measured.sourceBounds);
    assert.deepEqual(config.dimensions.sourceOriginENH, measured.sourceGeoreference.originEastingNorthingHeight);
    assert.equal(config.source.preserveOriginalShape, true);
    assert.equal(config.source.preserveSourceHash, true);
    assert.equal(config.source.transformApplied, false);
    assert.equal(config.source.externalReferenceImagesBundled, false);
  }
});

test('existing R07 ledgers and public R01 implementation remain byte pinned', async () => {
  const pins = {
    '../r07/profiles.mjs': 'f2d6ce9605fef18b078b49658d150cc5e3cb7d98c192415fd9f1711e865d81a2',
    '../r07/sources/33-lasalle-evidence.json': 'f977a47f7bcdb9786438033b6005e1210871a11cbae0cb7f7786d0b3d829bc19',
    '../r07/sources/kcc-evidence.json': 'a7d2252d8b35d93fc0f7b2d5dce5f086997fe88510b14666354af5d033f00ed3',
    '../r07/sources/official-footprints.json': '97eebb40d8cb7e480e0614857076d03599ccaafadafb99041cb951fa51294f9e',
    '../r07/sources/warehouse-evidence.json': 'c090d7beaab67edf760a8a0eea7066f8ed18db89a655669ff28423b79dd09043',
    '../whole-building-r01/app.mjs': '77e9ebca2941da5bcc54ae5ab740f48e6f4002386978b677e0dfb8bc5d21664b',
    '../whole-building-r01/gpu-lifecycle.mjs': 'ee307d31afadae41308ce82acbcf88ac7df771371d3dd638a7c510532b160f07',
    '../whole-building-r01/rails.mjs': 'fcdca5eba5720cbca6cc360066ff231c6d6985ae5af66f9a0d6f7023d02ddaba',
    '../whole-building-r01/renderer.mjs': '9bc5365ddba904e76ca9aedac197d03836128f0045698d2c61e4337e46647163',
    '../whole-building-r01/tower.mjs': 'a2c1c8dcecb8fbc40da01b818293a32ccd719f84ca293640780245d37a418974',
  };
  for (const [path, hash] of Object.entries(pins)) {
    assert.equal(sha256(await readFile(new URL(path, configUrl))), hash, path);
  }
});

test('observed, official, derived, design and unknown remain explicit in every case', () => {
  for (const id of ids) {
    const config = caseSystemConfig(id);
    assert.deepEqual(Object.keys(config.evidence), ['official', 'observed', 'derived', 'design', 'unknown']);
    for (const entries of Object.values(config.evidence)) {
      assert.ok(entries.length);
      assert.ok(entries.every(entry => entry.id.startsWith(id + ':evidence:') && typeof entry.statement === 'string' && Array.isArray(entry.references)));
    }
    assert.equal(config.assumptions.materialIdentification, 'unknown');
    assert.equal(config.assumptions.openingMechanisms, 'unknown');
    assert.ok(config.entranceBindings.every(entry => entry.actualPosition === null && entry.actualDimensions === null && !entry.actualRouteVerified));
  }
});

test('KCC retains separate24/4/1 records, independent owner28 and design P/T IDs', () => {
  const config = caseSystemConfig('kcc');
  assert.deepEqual(config.levelSchedule.rawOfficialRecords, { towerStoreys: 24, towerBasements: null, podiumStoreys: 4, podiumBasements: 1 });
  assert.equal(config.levelSchedule.verifiedWholeBuildingTotal, null);
  assert.equal(config.levelSchedule.ownerWholeBuildingStatement.count, 28);
  assert.equal(config.levelSchedule.ownerWholeBuildingStatement.independentlyStated, true);
  assert.deepEqual(config.levelSchedule.components.map(c => c.designIdPrefix), ['P', 'T']);
  const lifts = config.coreServiceSets[0].lifts;
  assert.equal(lifts.designInterfaceCount, 3);
  assert.equal(lifts.observedPlanCount, 3);
  assert.equal(lifts.actualCount, null);
  assert.equal(lifts.actualStopSchedule, null);
  assert.deepEqual(lifts.observedScope, ['5–17/F', '18–26/F']);
  assert.equal(config.entranceBindings.find(e => e.role === 'chamber_signed_entry').relationshipToResidentialLobby, 'unknown');
});

test('lowrise is exactly two design levels without silently inferred elevator or shared-gate identity', () => {
  const config = caseSystemConfig('lowrise');
  assert.equal(resolveCaseParameters('lowrise').floorCount, 2);
  assert.deepEqual(config.circulationPolicy.allowedModes, ['stairs']);
  assert.equal(config.coreServiceSets[0].lifts.designInterfaceCount, 0);
  assert.equal(config.coreServiceSets[0].lifts.actualPresence, 'unknown');
  assert.equal(config.sourceComponents[0].official.basementStoreys, null);
  assert.deepEqual(config.levelSchedule.components[0].recordedFloorLabels, ['G/F', '1/F']);
  assert.equal(config.levelSchedule.rooftopOccupiedStoreyInferred, false);
  const observed = config.entranceBindings.find(e => e.id.endsWith(':shared-site-gate'));
  const house = config.entranceBindings.find(e => e.id.endsWith(':house-design'));
  assert.equal(observed.generatedGeometry, false);
  assert.equal(house.representsObservedGate, false);
  assert.equal(config.circulationPolicy.sharedGateIsBuildingDoor, false);
  assert.throws(() => resolveCaseParameters('lowrise', { floorCount: 3 }), /bounded/);
  assert.throws(() => resolveCaseParameters('lowrise', { liftCount: 1 }), /Unknown/);
});

test('warehouse keeps raw12/2/2, flat roof, unknown core and distinct circulation roles', () => {
  const config = caseSystemConfig('warehouse');
  assert.deepEqual(config.levelSchedule.rawOfficialRecords, { towerStoreys: 12, towerBasements: null, podiumStoreys: 2, podiumBasements: 2 });
  assert.equal(config.levelSchedule.verifiedWholeBuildingTotal, null);
  assert.equal(config.levelSchedule.cockloftsGenerated, false);
  assert.equal(config.coreServiceSets[0].actualCoreLayout, null);
  assert.equal(config.coreServiceSets[0].lifts.actualCount, null);
  assert.equal(config.coreServiceSets[0].lifts.designInterfaceCount, 1);
  assert.deepEqual(config.circulationPolicy.routeRoles, ['personnel', 'vehicle', 'freight']);
  assert.equal(config.circulationPolicy.vehicleRouteIsPersonnelRoute, false);
  assert.equal(config.circulationPolicy.vehicleRouteUsesStairs, false);
  assert.equal(new Set(config.entranceBindings.filter(e => e.evidence === 'design').map(e => e.role)).size, 3);
  assert.equal(config.dimensions.mainRoofLocalY, 33.82499695);
  assert.equal(config.dimensions.parapetLocalY, 34.07299805);
  assert.equal(config.dimensions.higherStripLocalY, 37.70700073);
  assert.ok(config.floorArchetypes.every(a => a.actualUnitCount === null && !a.observedUnitLabels));
  assert.throws(() => resolveCaseParameters('warehouse', { freightInterfaceCount: 9 }), /bounded/);
  assert.throws(() => resolveCaseParameters('warehouse', { basementFloorCount: 2 }), /Unknown/);
});

test('configs and defaults are isolated, frozen and deterministic', () => {
  assert.ok(Object.isFrozen(CASE_SYSTEM_CONFIGS));
  assert.ok(Object.isFrozen(CASE_SYSTEM_CONFIGS.lowrise.coreServiceSets[0].lifts));
  assert.throws(() => { CASE_SYSTEM_CONFIGS.lowrise.coreServiceSets[0].lifts.designInterfaceCount = 4; }, TypeError);
  const config = caseSystemConfig('warehouse');
  config.sourceComponents[0].official.storeys = 900;
  config.levelSchedule.components[0].designIdPrefix = 'BROKEN';
  assert.equal(caseSystemConfig('warehouse').sourceComponents[0].official.storeys, 2);
  assert.equal(caseSystemConfig('warehouse').levelSchedule.components[0].designIdPrefix, 'P');
  for (const id of ids) assert.deepEqual(resolveCaseParameters(id), resolveCaseParameters(id));
  for (const id of [null, 'missing', '__proto__', 'constructor']) assert.throws(() => caseSystemConfig(id), /Unknown/);
});

test('resolver normalizes aliases but rejects unknown, conflicting and malformed input', () => {
  assert.equal(resolveCaseParameters('kcc', { floorCount: 20 }).towerFloorCount, 20);
  assert.equal(resolveCaseParameters('warehouse', { floorCount: 10, floorHeight: 3 }).towerFloorHeight, 3);
  assert.ok(!Object.hasOwn(resolveCaseParameters('kcc', { floorCount: 20 }), 'floorCount'));
  assert.throws(() => resolveCaseParameters('warehouse', { floorCount: 10, towerFloorCount: 11 }), /Conflicting/);
  for (const input of [null, [], new Date(), 'oops']) assert.throws(() => resolveCaseParameters('lowrise', input), /plain object/);
  for (const value of [NaN, Infinity, -Infinity, '2', null, undefined, 2.5]) assert.throws(() => resolveCaseParameters('lowrise', { floorCount: value }));
  assert.throws(() => resolveCaseParameters('lowrise', { shader: 'bad' }), /Unknown/);
  assert.throws(() => resolveCaseParameters('warehouse', { stairRun: 2.2 }), /Unknown/);
});

test('height arrays have exact counts, preserve ownership and replace defaults without scalar conflicts', () => {
  const array = Array(12).fill(2.8);
  const result = resolveCaseParameters('warehouse', { towerFloorHeights: array, podiumFloorHeights: [5.6, 7.9] });
  assert.ok(!Object.hasOwn(result, 'towerFloorHeight'));
  assert.ok(!Object.hasOwn(result, 'podiumFloorHeight'));
  assert.deepEqual(result.podiumFloorHeights, [5.6, 7.9]);
  result.towerFloorHeights[0] = 100;
  assert.equal(array[0], 2.8);
  assert.throws(() => resolveCaseParameters('warehouse', { towerFloorHeight: 2.8, towerFloorHeights: array }), /scalar or array/);
  assert.throws(() => resolveCaseParameters('warehouse', { towerFloorHeights: [2.8] }), /array bounds/);
  assert.throws(() => resolveCaseParameters('warehouse', { towerFloorHeights: Array(12).fill(NaN) }), /array bounds/);
  assert.throws(() => resolveCaseParameters('warehouse', { podiumFloorHeights: [6, 6] }), /fixed tower datum/);
});

test('coupled heights respect roof caps, wall clearance and fixed component datums', () => {
  assert.throws(() => resolveCaseParameters('lowrise', { floorHeight: 4 }), /source component bounds/);
  assert.throws(() => resolveCaseParameters('lowrise', { floorHeight: 2.7, slabThickness: .24, wallHeight: 2.6 }), /clearance/);
  assert.throws(() => resolveCaseParameters('warehouse', { towerFloorHeight: 3 }), /source component bounds/);
  assert.throws(() => resolveCaseParameters('warehouse', { podiumFloorHeight: 6 }), /fixed tower datum/);
  assert.throws(() => resolveCaseParameters('kcc', { podiumFloorHeight: 3.5 }), /fixed tower datum/);
  assert.throws(() => resolveCaseParameters('kcc', { towerFloorHeight: 3 }), /source bounds/);
  assert.throws(() => resolveCaseParameters('kcc', { towerFloorHeights: Array(24).fill(2.6) }), /clearance/);
  assert.equal(resolveCaseParameters('lowrise', { floorHeight: 3.76 }).floorHeight, 3.76);
});

test('KCC output is accepted unchanged by the immutable R01 geometry API', async () => {
  const config = caseSystemConfig('kcc');
  const measured = deriveMeasuredCase(await readJSON(config.source.scorePath));
  const parameters = resolveCaseParameters('kcc');
  const spec = deriveWholeBuilding(measured, footprints, parameters);
  assert.equal(spec.caseId, 'kcc');
  assert.equal(spec.levels.length, 28);
  assert.equal(spec.interfaces.lifts.length, 3);
  assert.equal(spec.fitReport.originalSourceUnchanged, true);
  assert.equal(spec.fitReport.structuralOrFireSafetyCertification, false);
  assert.deepEqual(Object.keys(parameters).sort(), Object.keys(config.defaultParameters).sort());
});
