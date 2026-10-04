'use strict';
// node tests/phase-volume.test.cjs [original-source-root]
// Independent original-source execution plus mesh/topology/containment audit.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const modulePath = path.resolve(__dirname, '../src/phase-volume.js');
const sourceRoot = path.resolve(process.argv[2] || path.join(__dirname, '../../haiyu-r23-compact-study'));
const P = require(modulePath);
const hash = filename => crypto.createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
const initialModuleHash = hash(modulePath);
const report = {generatedAt: new Date().toISOString(), moduleVersion: P.version, moduleSha256: initialModuleHash, originalSources: {}, parity: [], geometry: []};
function signedVolume(mesh) {
  const p = mesh.positions, ix = mesh.indices; let result = 0;
  for (let k = 0; k < ix.length; k += 3) {
    const a = ix[k] * 3, b = ix[k + 1] * 3, c = ix[k + 2] * 3;
    result += (p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) + p[a + 1] * (p[b + 2] * p[c] - p[b] * p[c + 2]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])) / 6;
  }
  return result;
}
for (const source of [6, 7]) {
  const sourcePath = path.join(sourceRoot, `source0${source}/normalized.js`);
  const originalCode = fs.readFileSync(sourcePath, 'utf8');
  report.originalSources[source] = {path: sourcePath, sha256: hash(sourcePath)};
  for (const frame of [1, 77, 239, 480]) {
    const geometry = P.evaluate(source, frame); let count = 0, mismatches = 0;
    const context = {
      w: 400, sin: Math.sin, cos: Math.cos, mag: (x, y) => Math.sqrt(x * x + y * y), PI: Math.PI,
      createCanvas() {}, background: () => ({stroke() {}}),
      point(x, y) {
        if (x !== geometry.cloud.originalXY[2 * count] || y !== geometry.cloud.originalXY[2 * count + 1]) mismatches++;
        assert.equal(geometry.cloud.sourceIndices[count], 19999 - count);
        count++;
      }
    };
    vm.createContext(context); vm.runInContext(originalCode, context);
    // Construct time independently, using the original repeated-addition clock.
    let priorTime = 0; for (let n = 1; n < frame; n++) priorTime += Math.PI / (source === 6 ? 120 : 480);
    context.t = priorTime; vm.runInContext('draw()', context);
    assert.equal(count, 20000); assert.equal(mismatches, 0); assert.equal(context.t, geometry.time);
    const shellVolume = signedVolume(geometry.shell), spineVolume = signedVolume(geometry.spine);
    assert.ok(shellVolume > 0); assert.ok(spineVolume > 0);
    report.parity.push({source, frame, points: count, exactXYMismatches: mismatches, exactTime: true, shellSignedVolume: shellVolume, spineSignedVolume: spineVolume});
  }
  for (const frame of [1, 60, 120]) for (const depth of [0.25, 1, 1.5]) {
    const geometry = P.evaluate(source, frame, {depth, minimumThicknessRatio: 0.30});
    const result = P.validate(geometry, true);
    assert.ok(result.ok, JSON.stringify({source, frame, depth, result}));
    assert.ok(result.minimumMeasuredSpineClearance > 0);
    report.geometry.push({source, frame, depth, minimumThicknessRatio: 0.30, ...result,
      note: 'Clearance is measured within world-Y transverse slices, including every tube vertex and triangle centroid; it is not a full Euclidean face-distance claim.'});
  }
  assert.equal(hash(sourcePath), report.originalSources[source].sha256);
}
const browserContext = {}; vm.createContext(browserContext); vm.runInContext(fs.readFileSync(modulePath, 'utf8'), browserContext);
assert.equal(typeof browserContext.HaiyuPhaseVolume.evaluate, 'function');
assert.equal(browserContext.HaiyuPhaseVolume.version, P.version);
assert.throws(() => P.evaluate(4, 1), /Only original sources 06 and 07/);
assert.throws(() => P.evaluate(6, 1, {depth: 0}), /depth outside bounded range/);
assert.equal(hash(modulePath), initialModuleHash);
report.browserExport = true; report.zeroDepthRejected = true; report.moduleAndSourcesUnchanged = true;
report.ok = true;
const output = path.join(__dirname, 'phase-volume-validation.json');
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ok: true, exactOriginalXYPairs: report.parity.reduce((n, p) => n + p.points, 0), geometryCases: report.geometry.length, report: output, moduleSha256: initialModuleHash}));
