import fs from 'node:fs';

const inputPath = process.argv[2];
if (!inputPath) throw new Error('usage: node n144_shadow_terminator_probe.mjs <regression.json>');
const doc = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

function classify(x) {
  if (x.implementationProvenance === 'copied_from_blender_tree' && !x.sourceFileLicenseVerified) {
    return 'HOLD_LICENSE_FILE_SCOPE_UNBOUND';
  }
  if (x.usesFixedWorldOffsetOnly && x.hasKnownContactControl &&
      Number.isFinite(x.contactOccluderRecallBefore) &&
      Number.isFinite(x.contactOccluderRecallAfter) &&
      x.contactOccluderRecallAfter < x.contactOccluderRecallBefore) {
    return 'REJECT_CONTACT_SHADOW_ERASURE';
  }
  if (x.usesFixedWorldOffsetOnly) {
    return 'HOLD_SHADOW_TERMINATOR_METHOD_UNBOUND';
  }
  if (x.usesGeometryAwareOffset) {
    if (!(x.hasTrianglePositions && x.hasVertexNormals && x.hasGeometricNormals && x.hasBarycentrics)) {
      return 'HOLD_LOCAL_GEOMETRY_RECEIPT_INCOMPLETE';
    }
    if (!x.terminatorLimited) return 'REJECT_UNBOUNDED_GEOMETRY_OFFSET';
    if (!(x.hasTerminatorBandMetric && x.hasKnownTerminatorControl && x.hasKnownContactControl)) {
      return 'HOLD_CAUSAL_VISUAL_EVIDENCE_MISSING';
    }
    const improvement = x.terminatorBandScoreBefore - x.terminatorBandScoreAfter;
    const contactPreserved = x.contactOccluderRecallAfter >= x.contactOccluderRecallBefore;
    if (improvement > 0 && contactPreserved && x.knownTerminatorPositiveControlDetected &&
        x.knownContactPositiveControlPreserved && x.independentVerifier &&
        x.sourceFileLicenseVerified) {
      return 'SCOPED_GEOMETRY_AWARE_SHADOW_TERMINATOR_PASS';
    }
    return 'REJECT_GEOMETRY_AWARE_HYPOTHESIS_NOT_SUPPORTED';
  }
  return 'UNKNOWN';
}

const results = doc.fixtures.map(f => {
  const actual = classify(f.input);
  return {id: f.id, expected: f.expected, actual, pass: actual === f.expected};
});
const output = {
  regressionId: doc.id,
  fixtureCount: results.length,
  passed: results.filter(r => r.pass).length,
  failed: results.filter(r => !r.pass).length,
  results,
  scope: 'classification replay only; no ET20 production renderer was modified or run'
};
console.log(JSON.stringify(output, null, 2));
if (output.failed) process.exitCode = 1;
