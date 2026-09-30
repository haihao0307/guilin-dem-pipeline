import assert from 'node:assert/strict';
import {
  COMPOSER_VERSION,
  createEmptySourceScore,
  createReferenceLedgerEntry,
  assertTeacherExcludedFromFormalRuntime
} from '../src/composer.js';
import {
  ABI,
  STATUS,
  CONTRACT,
  buildScore,
  validateResolvedScore
} from '../src/instrument.js';

assert.equal(COMPOSER_VERSION, 'KCC1.0.0-dev');
assert.equal(ABI, 'KCR1');
assert.equal(STATUS, 'CONTRACT_SCAFFOLD_NO_GEOMETRY');
assert.equal(CONTRACT.identityPresets, 0);
assert.equal(CONTRACT.exampleScoresEmbedded, 0);
assert.equal(CONTRACT.emptyPlayerProducesObject, false);

const sha = 'a'.repeat(64);
const source = createEmptySourceScore({
  id: 'teacher.pending.crab.r01',
  label: 'PENDING USER TEACHER',
  baseId: 'kaopu.crab.base.kcr1',
  baseVersion: '0.1.0',
  baseSha256: sha
});
assert.equal(source.acceptance.productionReady, false);
assert.equal(source.surface.charts.length, 0);

const ledger = createReferenceLedgerEntry({
  packageName: 'teacher.pending',
  sha256: sha,
  positions: 1,
  triangles: 1,
  normals: 1
});
assert.equal(ledger.formalRuntimeAllowed, false);
assert.equal(ledger.role, 'REFERENCE_TEACHER_ONLY');

assert.throws(
  () => assertTeacherExcludedFromFormalRuntime({ source: { formalRuntimeAllowed: false }, rawXYZ: [0, 0, 0] }),
  /CRAB_FORMAL_RUNTIME_FORBIDDEN_FIELD/
);
assert.throws(() => validateResolvedScore(source), /CRAB_SCORE_SCHEMA_MISMATCH|CRAB_SCORE_MISSING/);
assert.throws(() => buildScore(source), /CRAB_SCORE_SCHEMA_MISMATCH|CRAB_SCORE_MISSING/);

console.log('KAOPU Crab Triad R01 contract checks passed.');
