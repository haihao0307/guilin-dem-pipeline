import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const base = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const K = require('../src/production-knowledge-r09.js');
const registryPath = path.join(base, 'data/production-cards-r09.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
const cli = path.join(base, 'scripts/production-stage-r09.mjs');
const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'fish-production-r09-'));
const rows = [];

function check(label, fn) {
  try { const details = fn(); rows.push({ label, pass: true, ...(details || {}) }); }
  catch (error) { rows.push({ label, pass: false, error: error.message }); }
}
function run(args) {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: sandbox, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.stderr, '', 'CLI writes machine-readable errors on stdout, not a stack trace');
  return { exit: result.status, value: JSON.parse(result.stdout), stdout: result.stdout };
}
function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

try {
  check('Registry exposes six distinct real sources and seven production stages', () => {
    const result = run(['--list']);
    assert.equal(result.exit, 0);
    assert.equal(result.value.fish.length, 6);
    assert.equal(new Set(result.value.fish.map(item => item.id)).size, 6);
    assert.deepEqual(result.value.stages.map(item => item.id), ['identity', 'surface', 'spine', 'fins', 'cranial', 'behavior', 'verify']);
    assert.deepEqual(result.value.cranialSubStages, ['eyes', 'mouth', 'gills']);
  });

  check('Entering measured spine work returns knowledge without falsely approving the fish', () => {
    const result = run(['--fish', 'herring', '--stage', 'spine']);
    assert.equal(result.exit, 0);
    assert.equal(result.value.readyToBuild, true);
    assert.ok(result.value.rules.length && result.value.formulas.length && result.value.checks.length);
    assert.equal(result.value.acceptanceState.visualAcceptance, false);
    assert.equal(result.value.acceptanceState.productionReady, false);
    assert.equal(result.value.acceptanceState.scientificCalibration, false);
    assert.equal(result.value.knowledgeBinding.coreSha256, sha(path.join(base, 'src/production-knowledge-r09.js')));
    assert.equal(result.value.knowledgeBinding.knowledgeVersion, K.version);
    assert.match(result.value.knowledgeBinding.cardSha256, /^[a-f0-9]{64}$/);
  });

  check('Documented source intake alias selects identity rather than failing or skipping its gate', () => {
    const alias = run(['--fish', 'herring', '--stage', 'source']);
    const explicit = run(['--fish', 'herring', '--stage', 'identity']);
    assert.equal(alias.exit, explicit.exit);
    assert.equal(alias.value.stage, 'identity');
    assert.equal(alias.value.readyToBuild, explicit.value.readyToBuild);
    assert.deepEqual(alias.value.blocked, explicit.value.blocked);
    assert.equal(alias.value.knowledgeBinding.requestedStage, 'source');
  });

  check('Unknown gill motion remains a local HOLD despite measured eyes and spine', () => {
    const gills = run(['--fish', 'herring', '--stage', 'gills']);
    const spine = run(['--fish', 'herring', '--stage', 'spine']);
    assert.equal(gills.exit, 3);
    assert.equal(gills.value.component, 'gills');
    assert.equal(gills.value.readyToBuild, false);
    assert.ok(gills.value.blocked.length);
    assert.equal(spine.exit, 0, 'unknown cranial motion must not stop measured spine production');
    const eyes = run(['--fish', 'herring', '--stage', 'eyes']);
    assert.equal(eyes.exit, 0, 'independent confirmed eyes remain available');
  });

  check('A new fish starts without inherited evidence or numerical calibration', () => {
    const result = run(['--create', 'test-incoming-fish', '--label', '待测新鱼']);
    assert.equal(result.exit, 0);
    assert.equal(result.value.id, 'test-incoming-fish');
    assert.equal(result.value.label, '待测新鱼');
    const cardFile = path.join(sandbox, 'new-card.json');
    fs.writeFileSync(cardFile, result.stdout);
    for (const stage of ['surface', 'spine', 'fins', 'gills', 'mouth', 'eyes', 'behavior', 'verify']) {
      const resolved = run(['--card', cardFile, '--stage', stage]);
      assert.equal(resolved.exit, 3, `template cannot run ${stage} without measurement`);
      assert.equal(resolved.value.readyToBuild, false);
      assert.ok(resolved.value.blocked.length);
    }
    return { testedHolds: 8 };
  });

  check('Read-only entry creates no files; explicit output preserves existing user files', () => {
    const before = fs.readdirSync(sandbox).sort();
    run(['--create', 'another-new-fish']);
    run(['--fish', 'herring', '--stage', 'fins']);
    assert.deepEqual(fs.readdirSync(sandbox).sort(), before);
    const output = path.join(sandbox, 'explicit-card.json');
    const created = run(['--create', 'explicit-fish', '--out', output]);
    assert.equal(created.exit, 0);
    assert.equal(fs.readFileSync(output, 'utf8'), created.stdout);
    const beforeHash = sha(output);
    const rejected = run(['--create', 'other-fish', '--out', output]);
    assert.equal(rejected.exit, 2);
    assert.equal(rejected.value.code, 'INVALID_REQUEST');
    assert.equal(sha(output), beforeHash);
  });

  check('Invalid requests, unknown stages, malformed cards and ambiguous modes fail closed', () => {
    const malformed = path.join(sandbox, 'malformed.json');
    const invalid = path.join(sandbox, 'invalid.json');
    fs.writeFileSync(malformed, '{"incomplete":');
    fs.writeFileSync(invalid, '{}');
    const requests = [[], ['--fish', 'herring'], ['--fish', 'nonexistent', '--stage', 'spine'],
      ['--fish', 'herring', '--stage', 'nonexistent'], ['--fish', 'herring', '--card', invalid, '--stage', 'spine'],
      ['--card', malformed, '--stage', 'spine'], ['--card', invalid, '--stage', 'spine'],
      ['--create', '../not-an-id'], ['--create', 'fish', '--label'], ['--fish', 'herring', '--stage', 'spine', '--stage', 'fins']];
    for (const args of requests) {
      const result = run(args);
      assert.equal(result.exit, 2, JSON.stringify(args));
      assert.equal(result.value.readyToBuild, false);
    }
    return { testedFailures: requests.length };
  });

  check('All production source cards validate without changing their measurements or readiness', () => {
    const before = sha(registryPath);
    for (const card of registry.cards) {
      const original = JSON.stringify(card);
      const validation = K.validateCard(card);
      assert.equal(validation.valid, true, `${card.id}: ${JSON.stringify(validation.errors)}`);
      for (const stage of K.stages) {
        const context = K.resolve(card, stage.id);
        assert.equal(typeof context.readyToBuild, 'boolean');
        assert.ok(context.checks.length, `${card.id}/${stage.id} binds stage regressions`);
      }
      assert.equal(JSON.stringify(card), original, 'resolving knowledge must not mutate evidence or acceptance');
    }
    assert.equal(sha(registryPath), before);
    return { cards: registry.cards.length, stagesPerCard: K.stages.length };
  });

  check('Stale knowledge, unreferenced source measurements and unsupported species confirmation fail validation', () => {
    const original = registry.cards.find(card => card.id === 'herring');
    const cases = [
      card => { card.knowledgeVersion = 'obsolete-version'; },
      card => { card.measurements.axis.reference = null; },
      card => { card.source.entrySha256 = 'not-a-source-hash'; },
      card => { card.identity.speciesStatus = 'CONFIRMED'; card.identity.speciesName = 'Test fixture species'; card.identity.evidence = []; },
      card => { card.acceptance.productionReady = true; card.acceptance.visualAcceptance = false; card.acceptance.independentVerification = 'NOT_RUN'; }
    ];
    for (const corrupt of cases) {
      const card = structuredClone(original); corrupt(card);
      assert.equal(K.validateCard(card).valid, false);
      assert.equal(K.resolve(card, 'spine').readyToBuild, false);
    }
    const missingSource = structuredClone(original);
    missingSource.source.entrySha256 = null;
    assert.equal(K.resolve(missingSource, 'spine').readyToBuild, false);
    return { rejectedCards: cases.length, heldMissingSource: true };
  });

  check('Engineering guesses or absent backbone cannot stand in for measured source structure', () => {
    const original = registry.cards.find(card => card.id === 'herring');
    for (const [key, status] of [['surface', 'ENGINEERING_CANDIDATE'], ['axis', 'ENGINEERING_CANDIDATE'], ['axis', 'CONFIRMED_ABSENT']]) {
      const card = structuredClone(original);
      card.measurements[key].status = status;
      card.measurements[key].reference = 'TEST_FIXTURE_ONLY: unsupported structural claim';
      assert.equal(K.resolve(card, 'spine').readyToBuild, false, `${status} ${key} cannot authorize real spine reconstruction`);
    }
    const absentGill = structuredClone(original);
    absentGill.measurements.gills = { ...absentGill.measurements.eyes, status: 'CONFIRMED_ABSENT' };
    const result = K.resolve(absentGill, 'gills');
    assert.equal(result.readyToBuild, false, 'a confirmed absent organ is preserved, not authorized for animation');
    assert.match(result.components.gills.action, /缺失|禁止|保留/);
  });

  check('Knowledge formulas and regression records still point to real production files', () => {
    const repo = path.dirname(base);
    let formulas = 0, links = 0;
    for (const formula of K.formulas) {
      assert.ok(formula.units && formula.expression && formula.owner && formula.verification, `${formula.id} retains units and executable ownership`);
      const owners = formula.owner.match(/fish-five-r01\/[a-zA-Z0-9_./-]+\.js/g) || [];
      assert.ok(owners.length, `${formula.id} has an actual production source owner`);
      for (const file of owners) { assert.ok(fs.statSync(path.join(repo, file)).isFile(), file); links++; }
      const scripts = formula.verification.match(/fish-five-r01\/[a-zA-Z0-9_./-]+\.mjs/g) || [];
      assert.ok(scripts.length, `${formula.id} binds a runnable regression check`);
      for (const file of scripts) { assert.ok(fs.statSync(path.join(repo, file)).isFile(), file); links++; }
      formulas++;
    }
    for (const rule of K.rules) assert.ok(fs.statSync(path.join(repo, rule.source)).isFile(), rule.source);
    const B = require('../src/behavior.js');
    const school = require('../src/schooling-r08.js');
    assert.equal(typeof B.sampleSpine, 'function');
    assert.equal(typeof B.deform, 'function');
    assert.equal(typeof B.update, 'function');
    for (const api of ['step', 'clearance', 'snapshot']) assert.equal(typeof school[api], 'function');
    return { formulas, realFileLinks: links, checkedMathInterfaces: 6 };
  });

  check('Numeric behavior parameters reject missing or dimensionally wrong units', () => {
    const card = structuredClone(registry.cards.find(item => item.id === 'herring'));
    const parameter = { key: 'speed', value: 0.5, unit: 'source-length/s',
      evidenceClass: 'ENGINEERING_CANDIDATE', reference: 'TEST_FIXTURE_ONLY: dimensional validation' };
    card.behavior.parameterEvidence = [parameter];
    assert.equal(K.validateCard(card).valid, true, 'explicit source-length/s engineering candidate is not biological calibration');
    for (const unit of [null, 'rad/s', 'm/s']) {
      parameter.unit = unit;
      assert.equal(K.validateCard(card).valid, false, `unsupported speed unit ${unit} must not enter shared math`);
      assert.equal(K.resolve(card, 'behavior').readyToBuild, false);
    }
    parameter.unit = 'source-length/s'; parameter.value = Number.NaN;
    assert.equal(K.validateCard(card).valid, false, 'non-finite parameters cannot enter controls');
  });

  check('CLI actually detects stale source evidence and refuses outside-repository bindings', () => {
    const card = structuredClone(registry.cards.find(item => item.id === 'herring'));
    assert.ok(card.evidenceBindings.length, 'known production card carries source bindings');
    const testFile = path.join(sandbox, 'stale-card.json');
    const binding = card.evidenceBindings[0];
    binding.sha256 = '0'.repeat(64);
    // Keep each in-card reference internally coherent: only real file re-reading can detect staleness.
    if (card.source.metadata === binding.path) card.source.metadataSha256 = binding.sha256;
    for (const item of Object.values(card.measurements)) if (item.reference?.split('#')[0] === binding.path) item.referenceSha256 = binding.sha256;
    fs.writeFileSync(testFile, JSON.stringify(card));
    const stale = run(['--card', testFile, '--stage', 'spine']);
    assert.equal(stale.exit, 2);
    assert.equal(stale.value.readyToBuild, false);
    assert.equal(stale.value.code, 'STALE_SOURCE_EVIDENCE');
    const traversal = structuredClone(registry.cards.find(item => item.id === 'herring'));
    traversal.evidenceBindings.push({ path: '../outside-repository.json', sha256: '0'.repeat(64) });
    fs.writeFileSync(testFile, JSON.stringify(traversal));
    const escaped = run(['--card', testFile, '--stage', 'spine']);
    assert.equal(escaped.exit, 2);
    assert.equal(escaped.value.readyToBuild, false);
    fs.unlinkSync(testFile);
  });
} finally {
  // Only known files created in this process's unique temporary directory are removed.
  for (const name of ['new-card.json', 'explicit-card.json', 'malformed.json', 'invalid.json', 'stale-card.json']) {
    const file = path.join(sandbox, name);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
  fs.rmdirSync(sandbox);
}
const report = { schema: 'fish.production-workflow-r09.tests/1', createdAt: new Date().toISOString(),
  pass: rows.every(row => row.pass), tests: rows,
  sourceHashes: Object.fromEntries(['src/production-knowledge-r09.js', 'data/production-cards-r09.json',
    'scripts/production-stage-r09.mjs', 'scripts/verify-production-r09.mjs'].map(file => [file, sha(path.join(base, file))])),
  scope: 'Producer knowledge and CLI checks; no visual, biological or independent approval',
  visualAcceptance: false, productionReady: false };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.pass) process.exitCode = 1;
