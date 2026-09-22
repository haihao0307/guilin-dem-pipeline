'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { STATUS, validateWorldScorePage } = require('./unified_field.cjs');

const registryPath = path.join(__dirname, 'R19_UNIFIED_FIELD_REGISTRY_R01.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

assert.equal(
  registry.kernelOrder,
  'Time->Identity->Truth/State->Strategy->Precision->Query->Function->Evidence',
);
assert.ok(Array.isArray(registry.pages) && registry.pages.length >= 10);

const ids = new Set();
for (const page of registry.pages) {
  const result = validateWorldScorePage(page);
  assert.equal(result.status, STATUS.KNOWN, `${page?.identity?.id}: ${JSON.stringify(result)}`);
  assert.ok(!ids.has(page.identity.id), `duplicate identity ${page.identity.id}`);
  ids.add(page.identity.id);
}

assert.equal(registry.rules.unknownIsNotZero, true);
assert.equal(registry.rules.noDataIsNotZero, true);
assert.equal(registry.rules.waveRepresentationMayReplaceSourceTruth, false);
assert.equal(registry.rules.malakalMayBeCopiedAsExactAiraiLocalTide, false);

console.log(`R19 unified field registry validation: PASS (${registry.pages.length} pages)`);
