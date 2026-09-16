#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const EPS = 1e-9;
const close = (a, b) => Math.abs(a - b) <= EPS;
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(',')}]`
  : value && typeof value === 'object'
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`
    : JSON.stringify(value);
const sha256 = (value) => createHash('sha256').update(stable(value)).digest('hex');

function validateCell(cell) {
  if (!Number.isFinite(cell.start) || !Number.isFinite(cell.end) || cell.end <= cell.start) throw new Error('valid-half-open-bounds-required');
  if (!['sum', 'mean', 'point'].includes(cell.method)) throw new Error('cell-method-required');
  if (cell.method === 'sum' && cell.quantityClass !== 'extensive') throw new Error('sum-requires-extensive-quantity');
  if (cell.method === 'mean' && cell.quantityClass !== 'intensive') throw new Error('mean-requires-intensive-quantity');
  if (cell.unit === 'mm/h' && cell.quantityClass !== 'intensive') throw new Error('rate-must-be-intensive');
  if (cell.unit === 'mm' && cell.method === 'mean') throw new Error('depth-amount-cannot-be-time-mean-rate');
  return true;
}

function validatePartition(cells, targetStart, targetEnd) {
  const sorted = [...cells].sort((a, b) => a.start - b.start || a.end - b.end);
  for (const cell of sorted) validateCell(cell);
  if (sorted[0]?.start !== targetStart || sorted.at(-1)?.end !== targetEnd) throw new Error('partition-gap-or-domain-mismatch');
  for (let i = 1; i < sorted.length; i += 1) {
    if (sorted[i].start !== sorted[i - 1].end) throw new Error(sorted[i].start < sorted[i - 1].end ? 'overlapping-time-cells' : 'partition-gap-or-domain-mismatch');
  }
  return sorted;
}

function aggregateAmounts(cells, start, end) {
  const sorted = validatePartition(cells, start, end);
  if (sorted.some((cell) => cell.method !== 'sum' || cell.unit !== 'mm')) throw new Error('amount-sum-contract-required');
  return sorted.reduce((sum, cell) => sum + cell.value, 0);
}

function integrateRates(cells, start, end) {
  const sorted = validatePartition(cells, start, end);
  if (sorted.some((cell) => cell.method !== 'mean' || cell.unit !== 'mm/h')) throw new Error('rate-mean-contract-required');
  return sorted.reduce((sum, cell) => sum + cell.value * ((cell.end - cell.start) / 3600), 0);
}

function weightedMeanRate(cells, start, end) {
  return integrateRates(cells, start, end) / ((end - start) / 3600);
}

function disaggregateConstantRate(parent, boundaries, policy) {
  validateCell(parent);
  if (parent.method !== 'sum' || parent.unit !== 'mm') throw new Error('parent-amount-required');
  if (policy !== 'piecewise-constant-rate') throw new Error('explicit-disaggregation-policy-required');
  if (boundaries[0] !== parent.start || boundaries.at(-1) !== parent.end) throw new Error('child-domain-mismatch');
  const duration = parent.end - parent.start;
  return boundaries.slice(0, -1).map((start, index) => ({
    start,
    end: boundaries[index + 1],
    method: 'sum',
    quantityClass: 'extensive',
    unit: 'mm',
    value: parent.value * ((boundaries[index + 1] - start) / duration),
    derivedBy: policy,
    parentId: parent.id
  }));
}

const amountCells = [2, 4, 3, 3].map((value, index) => ({
  id: `rain-q${index + 1}`,
  start: index * 900,
  end: (index + 1) * 900,
  method: 'sum',
  quantityClass: 'extensive',
  unit: 'mm',
  value
}));
const equalRateCells = [2, 4, 3, 3].map((value, index) => ({
  id: `rate-q${index + 1}`,
  start: index * 900,
  end: (index + 1) * 900,
  method: 'mean',
  quantityClass: 'intensive',
  unit: 'mm/h',
  value
}));
const unequalRateCells = [
  { id: 'rate-a', start: 0, end: 900, method: 'mean', quantityClass: 'intensive', unit: 'mm/h', value: 2 },
  { id: 'rate-b', start: 900, end: 3600, method: 'mean', quantityClass: 'intensive', unit: 'mm/h', value: 4 }
];
const parent = { id: 'rain-hour', start: 0, end: 3600, method: 'sum', quantityClass: 'extensive', unit: 'mm', value: 12 };
const children = disaggregateConstantRate(parent, [0, 900, 1800, 2700, 3600], 'piecewise-constant-rate');

const checks = [];
const check = (name, pass, detail = null) => checks.push({ name, pass: Boolean(pass), detail });
function reject(name, fn, expected) {
  let actual = null;
  try { fn(); } catch (error) { actual = error.message; }
  check(name, actual === expected, { expected, actual });
}

check('four 15-minute precipitation amounts sum to 12 mm', close(aggregateAmounts(amountCells, 0, 3600), 12), { amountMm: aggregateAmounts(amountCells, 0, 3600) });
check('12 mm over 1000 m2 converts to 12 m3 after temporal aggregation', close(aggregateAmounts(amountCells, 0, 3600) / 1000 * 1000, 12), null);
check('four 15-minute rates integrate to 3 mm rather than summing to 12 mm', close(integrateRates(equalRateCells, 0, 3600), 3), { integratedMm: integrateRates(equalRateCells, 0, 3600), naiveSum: 12 });
check('equal-duration weighted mean rate is 3 mm/h', close(weightedMeanRate(equalRateCells, 0, 3600), 3), null);
check('unequal-duration rate cells integrate to 3.5 mm', close(integrateRates(unequalRateCells, 0, 3600), 3.5), null);
check('unequal-duration weighted mean is 3.5 mm/h, not unweighted 3', close(weightedMeanRate(unequalRateCells, 0, 3600), 3.5), { weighted: weightedMeanRate(unequalRateCells, 0, 3600), unweighted: 3 });
check('explicit constant-rate disaggregation preserves parent amount', close(aggregateAmounts(children, 0, 3600), parent.value), { childValues: children.map((cell) => cell.value) });
check('half-open adjacent cells form a non-overlapping partition', validatePartition(amountCells, 0, 3600).length === 4, null);

reject('overlapping cells are rejected', () => validatePartition([
  { ...amountCells[0], start: 0, end: 1800 },
  { ...amountCells[1], start: 900, end: 3600 }
], 0, 3600), 'overlapping-time-cells');
reject('gapped cells are rejected', () => validatePartition([
  { ...amountCells[0], start: 0, end: 900 },
  { ...amountCells[1], start: 1800, end: 3600 }
], 0, 3600), 'partition-gap-or-domain-mismatch');
reject('point timestamp cannot stand in for accumulated interval', () => validateCell({ method: 'sum', quantityClass: 'extensive', unit: 'mm', value: 12, start: 3600, end: 3600 }), 'valid-half-open-bounds-required');
reject('rate cannot be labeled extensive sum', () => validateCell({ start: 0, end: 900, method: 'sum', quantityClass: 'extensive', unit: 'mm/h', value: 2 }), 'rate-must-be-intensive');
reject('amount cells cannot be aggregated by rate contract', () => integrateRates(amountCells, 0, 3600), 'rate-mean-contract-required');
reject('rate cells cannot be aggregated by amount contract', () => aggregateAmounts(equalRateCells, 0, 3600), 'amount-sum-contract-required');
reject('disaggregation without declared policy is rejected', () => disaggregateConstantRate(parent, [0, 1800, 3600], null), 'explicit-disaggregation-policy-required');
reject('child time domain must match parent bounds', () => disaggregateConstantRate(parent, [0, 900, 1800], 'piecewise-constant-rate'), 'child-domain-mismatch');

const naiveQuarterHourRateAsAmount = equalRateCells.reduce((sum, cell) => sum + cell.value, 0);
check('naive summation of quarter-hour rates produces a fourfold amount error', close(naiveQuarterHourRateAsAmount / integrateRates(equalRateCells, 0, 3600), 4), { naiveMm: naiveQuarterHourRateAsAmount, correctMm: 3 });

const passed = checks.filter((item) => item.pass).length;
const fixture = { amountCells, equalRateCells, unequalRateCells, parent, children };
const result = {
  schema: 'kaopu-world-water-temporal-contract-result/w02',
  status: passed === checks.length ? 'pass' : 'fail',
  evidenceClass: 'official CF/EPA source contract plus synthetic CPU temporal counterexamples',
  observationRoots: [
    'CF Conventions 1.13 interval bounds and cell-method semantics',
    'US EPA SWMM 5.2 computation/routing/reporting time-step and continuity guidance',
    'Node.js synthetic temporal fixture; reproducible derivation, not hydrologic runtime evidence'
  ],
  fixtureSha256: sha256(fixture),
  summary: { checks: checks.length, passed, failed: checks.length - passed, hourlyAmountMm: 12, quarterHourRatesIntegratedMm: 3, naiveRateSumMm: 12, unequalDurationIntegratedMm: 3.5 },
  currentBestView: 'Every exchanged water quantity must bind half-open time bounds, quantity class, unit and aggregation method. Sum extensive amounts; duration-integrate intensive rates; use duration-weighted means; reject overlaps/gaps and require an explicit conservative policy before disaggregation.',
  boundary: 'This verifies temporal accounting semantics only. It does not select a hydrologic solver time step, infer within-interval rainfall shape, validate physical parameters or prove Mother adoption.',
  checks
};

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
