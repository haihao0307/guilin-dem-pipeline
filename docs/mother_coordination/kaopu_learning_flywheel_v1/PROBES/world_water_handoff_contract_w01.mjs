#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const EPS = 1e-9;

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
}

function close(a, b) {
  return Math.abs(a - b) <= EPS;
}

function depthMmToVolumeM3(depthMm, areaM2) {
  if (!(depthMm >= 0) || !(areaM2 > 0)) throw new Error('invalid-depth-or-area');
  return depthMm / 1000 * areaM2;
}

const writeAuthority = {
  WeatherMother: new Set(['forcing']),
  LandscapeMother: new Set(['external-delivery', 'landscape-runoff']),
  FarmlandMother: new Set(['direct-rain-conversion', 'field-transfer', 'field-loss', 'field-discharge'])
};

function validateLedger(ledger) {
  const fluxIds = new Set();
  const conversionKeys = new Set();
  for (const flux of ledger) {
    if (!flux.id || fluxIds.has(flux.id)) throw new Error('duplicate-flux-id');
    fluxIds.add(flux.id);
    if (flux.unit !== 'm3') throw new Error('ledger-unit-must-be-m3');
    if (!(flux.quantity >= 0)) throw new Error('invalid-flux-quantity');
    if (!flux.intervalId || !Number.isFinite(flux.intervalSeconds) || flux.intervalSeconds <= 0) {
      throw new Error('explicit-interval-required');
    }
    if (!writeAuthority[flux.writer]?.has(flux.stage)) throw new Error('writer-stage-not-authorized');
    if (flux.stage !== 'forcing' && !flux.from && !flux.to) throw new Error('flux-endpoint-required');
    if (['direct-rain-conversion', 'landscape-runoff', 'external-delivery'].includes(flux.stage) && !flux.sourceMeasureKey) {
      throw new Error('source-measure-key-required');
    }
    if (flux.sourceMeasureKey) {
      if (conversionKeys.has(flux.sourceMeasureKey)) throw new Error('duplicate-source-measure-conversion');
      conversionKeys.add(flux.sourceMeasureKey);
    }
    if (flux.presentationOnly) throw new Error('presentation-state-not-mass-flux');
  }
  return true;
}

function balanceInterval({ initial, ledger, final }) {
  validateLedger(ledger);
  const nodes = Object.keys(initial).sort();
  const nodeResiduals = {};
  for (const node of nodes) {
    const inflow = ledger.filter((flux) => flux.to === node).reduce((sum, flux) => sum + flux.quantity, 0);
    const outflow = ledger.filter((flux) => flux.from === node).reduce((sum, flux) => sum + flux.quantity, 0);
    nodeResiduals[node] = initial[node] + inflow - outflow - final[node];
  }
  const externalIn = ledger.filter((flux) => !flux.from && flux.to).reduce((sum, flux) => sum + flux.quantity, 0);
  const externalOut = ledger.filter((flux) => flux.from && !flux.to).reduce((sum, flux) => sum + flux.quantity, 0);
  const globalResidual = Object.values(initial).reduce((a, b) => a + b, 0)
    + externalIn - externalOut
    - Object.values(final).reduce((a, b) => a + b, 0);
  return { nodeResiduals, globalResidual, externalIn, externalOut };
}

function expectReject(name, fn, expected, checks) {
  let actual = null;
  try { fn(); } catch (error) { actual = error.message; }
  checks.push({ name, pass: actual === expected, detail: { expected, actual } });
}

const intervals = {
  t1: { id: '2026-09-17T00:00Z/PT1H', seconds: 3600 },
  t2: { id: '2026-09-17T01:00Z/PT1H', seconds: 3600 }
};
const area = { F1: 1000, F2: 800 };
const rainDepthMm = 10;

const t1 = [
  { id: 't1-rain-f1', eventId: 'rain-001', sourceMeasureKey: 'rain-001|t1|support-F1', writer: 'FarmlandMother', stage: 'direct-rain-conversion', from: null, to: 'F1', quantity: depthMmToVolumeM3(rainDepthMm, area.F1), unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-rain-f2', eventId: 'rain-001', sourceMeasureKey: 'rain-001|t1|support-F2', writer: 'FarmlandMother', stage: 'direct-rain-conversion', from: null, to: 'F2', quantity: depthMmToVolumeM3(rainDepthMm, area.F2), unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-canal-f1', eventId: 'canal-release-001', sourceMeasureKey: 'canal-release-001|t1|canal-mouth', writer: 'LandscapeMother', stage: 'external-delivery', from: null, to: 'F1', quantity: 12, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-f1-f2', eventId: 'field-transfer-001', writer: 'FarmlandMother', stage: 'field-transfer', from: 'F1', to: 'F2', quantity: 4, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-f2-river', eventId: 'field-discharge-001', writer: 'FarmlandMother', stage: 'field-discharge', from: 'F2', to: null, quantity: 2, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-evap-f1', writer: 'FarmlandMother', stage: 'field-loss', from: 'F1', to: null, quantity: 0.5, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-evap-f2', writer: 'FarmlandMother', stage: 'field-loss', from: 'F2', to: null, quantity: 0.4, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-perc-f1', writer: 'FarmlandMother', stage: 'field-loss', from: 'F1', to: null, quantity: 1, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds },
  { id: 't1-perc-f2', writer: 'FarmlandMother', stage: 'field-loss', from: 'F2', to: null, quantity: 0.8, unit: 'm3', intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds }
];

const t2 = [
  { id: 't2-canal-f1', eventId: 'canal-release-002', sourceMeasureKey: 'canal-release-002|t2|canal-mouth', writer: 'LandscapeMother', stage: 'external-delivery', from: null, to: 'F1', quantity: 6, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds },
  { id: 't2-f1-f2', eventId: 'field-transfer-002', writer: 'FarmlandMother', stage: 'field-transfer', from: 'F1', to: 'F2', quantity: 5, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds },
  { id: 't2-f2-river', eventId: 'field-discharge-002', writer: 'FarmlandMother', stage: 'field-discharge', from: 'F2', to: null, quantity: 3, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds },
  { id: 't2-evap-f1', writer: 'FarmlandMother', stage: 'field-loss', from: 'F1', to: null, quantity: 0.4, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds },
  { id: 't2-evap-f2', writer: 'FarmlandMother', stage: 'field-loss', from: 'F2', to: null, quantity: 0.3, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds },
  { id: 't2-perc-f1', writer: 'FarmlandMother', stage: 'field-loss', from: 'F1', to: null, quantity: 0.7, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds },
  { id: 't2-perc-f2', writer: 'FarmlandMother', stage: 'field-loss', from: 'F2', to: null, quantity: 0.6, unit: 'm3', intervalId: intervals.t2.id, intervalSeconds: intervals.t2.seconds }
];

const initial1 = { F1: 5, F2: 3 };
const final1 = { F1: 21.5, F2: 11.8 };
const final2 = { F1: 21.4, F2: 12.9 };
const balance1 = balanceInterval({ initial: initial1, ledger: t1, final: final1 });
const balance2 = balanceInterval({ initial: final1, ledger: t2, final: final2 });
const checks = [];
const check = (name, pass, detail = null) => checks.push({ name, pass: Boolean(pass), detail });

check('10 mm over 1000 m2 converts to 10 m3', close(depthMmToVolumeM3(10, 1000), 10), { value: depthMmToVolumeM3(10, 1000) });
check('10 mm over 800 m2 converts to 8 m3', close(depthMmToVolumeM3(10, 800), 8), { value: depthMmToVolumeM3(10, 800) });
check('step 1 node balances close', Object.values(balance1.nodeResiduals).every((value) => close(value, 0)), balance1.nodeResiduals);
check('step 1 global balance closes', close(balance1.globalResidual, 0), balance1);
check('step 2 node balances close', Object.values(balance2.nodeResiduals).every((value) => close(value, 0)), balance2.nodeResiduals);
check('step 2 global balance closes', close(balance2.globalResidual, 0), balance2);
check('step 2 initial storage is step 1 final storage', stable(final1) === stable({ F1: 21.5, F2: 11.8 }), final1);

const withoutInternal = t1.filter((flux) => flux.id !== 't1-f1-f2');
const globalWithoutInternal = balanceInterval({ initial: initial1, ledger: withoutInternal, final: { F1: 25.5, F2: 7.8 } });
check('one directed internal transfer cancels in global balance', close(globalWithoutInternal.globalResidual, balance1.globalResidual), { withInternal: balance1.globalResidual, withoutInternal: globalWithoutInternal.globalResidual });

expectReject('same rain event and same spatial support cannot be converted twice', () => validateLedger([...t1, { ...t1[0], id: 'duplicate-rain-f1', writer: 'LandscapeMother', stage: 'landscape-runoff', to: 'F1' }]), 'duplicate-source-measure-conversion', checks);
check('same rain event on disjoint supports is valid', validateLedger([t1[0], t1[1]]), { keys: [t1[0].sourceMeasureKey, t1[1].sourceMeasureKey] });
expectReject('duplicate immutable flux ID is rejected', () => validateLedger([...t1, { ...t1[3] }]), 'duplicate-flux-id', checks);
expectReject('unauthorized Mother cannot write another stage', () => validateLedger([{ ...t1[3], id: 'bad-writer', writer: 'WeatherMother' }]), 'writer-stage-not-authorized', checks);
expectReject('depth unit cannot enter volume ledger without conversion', () => validateLedger([{ ...t1[0], id: 'bad-unit', unit: 'mm' }]), 'ledger-unit-must-be-m3', checks);
expectReject('implicit or zero time interval is rejected', () => validateLedger([{ ...t1[0], id: 'bad-time', intervalSeconds: 0 }]), 'explicit-interval-required', checks);
expectReject('presentation wetness cannot enter mass ledger', () => validateLedger([{ ...t1[0], id: 'bad-display', presentationOnly: true }]), 'presentation-state-not-mass-flux', checks);
expectReject('conversion stage without source measure identity is rejected', () => {
  const missingSource = { ...t1[0], id: 'missing-source' };
  delete missingSource.sourceMeasureKey;
  validateLedger([missingSource]);
}, 'source-measure-key-required', checks);

const duplicateBugLedger = [...t1, {
  id: 'bug-rain-f1-landscape', eventId: 'rain-001', sourceMeasureKey: 'rain-001|t1|support-F1',
  writer: 'LandscapeMother', stage: 'landscape-runoff', from: null, to: 'F1', quantity: 10, unit: 'm3',
  intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds
}, {
  id: 'bug-rain-f2-landscape', eventId: 'rain-001', sourceMeasureKey: 'rain-001|t1|support-F2',
  writer: 'LandscapeMother', stage: 'landscape-runoff', from: null, to: 'F2', quantity: 8, unit: 'm3',
  intervalId: intervals.t1.id, intervalSeconds: intervals.t1.seconds
}];
let duplicateBugRejected = false;
try { validateLedger(duplicateBugLedger); } catch (error) { duplicateBugRejected = error.message === 'duplicate-source-measure-conversion'; }
const duplicateBugResidual = 18;
check('collapsed direct-rain plus derived-runoff bug is rejected before its 18 m3 surplus enters state', duplicateBugRejected, { counterfactualResidualM3: duplicateBugResidual });

const passed = checks.filter((item) => item.pass).length;
const fixture = { intervals, area, rainDepthMm, initial1, final1, final2, t1, t2 };
const result = {
  schema: 'kaopu-world-water-handoff-contract-result/w01',
  status: passed === checks.length ? 'pass' : 'fail',
  evidenceClass: 'official-source-contract plus synthetic CPU continuity and counterexample fixture',
  observationRoots: [
    'FAO-56 soil-water-balance contract',
    'US-EPA-SWMM continuity-accounting contract',
    'Node.js synthetic two-field/two-interval fixture; not a hydrologic calibration or Mother runtime'
  ],
  fixtureSha256: sha256(fixture),
  summary: {
    checks: checks.length,
    passed,
    failed: checks.length - passed,
    step1: balance1,
    step2: balance2,
    duplicateRainBugCounterfactualResidualM3: duplicateBugResidual
  },
  currentBestView: 'At a cross-Mother water boundary, exchange immutable directed volume fluxes with one writer, explicit interval, units, source/destination and provenance. Give each source-measure conversion a unique event + interval + spatial-support key and record its process stage separately. Keep forcing depth, storage state, losses, discharge and presentation state separate.',
  boundary: 'The arithmetic fixture verifies accounting structure only. It does not validate KAOPU rainfall, runoff, infiltration, evapotranspiration, canal routing, field geometry or visual acceptance.',
  checks
};

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
