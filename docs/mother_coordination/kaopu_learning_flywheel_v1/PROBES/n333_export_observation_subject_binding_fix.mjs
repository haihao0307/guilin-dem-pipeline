import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { verifyFunctionExport } from './n331_zx85_function_export_closure_gate.mjs';

const sha256 = value => createHash('sha256').update(
  typeof value === 'string' ? value : JSON.stringify(value)
).digest('hex');

const objects = ['boom'];
const actions = ['BOOM_RAISE'];
const behaviorGraphDigest = sha256({ actions });
const exportPolicyDigest = sha256({ allowed: ['FUNCTION_SOURCE', 'ENTRYPOINT', 'RECEIPT'] });
const manifest = [
  { id: 'entry', role: 'ENTRYPOINT', sha256: sha256('entry'), rightsState: 'RECORDED' },
  { id: 'geometry', role: 'FUNCTION_SOURCE', sha256: sha256('geometry'), rightsState: 'RECORDED' },
  { id: 'receipt', role: 'RECEIPT', sha256: sha256('receipt'), rightsState: 'RECORDED' }
];
const exportDigest = sha256('delivered-export');
const manifestDigest = sha256(manifest);

const anchor = {
  sourceHead: 'source-head-333',
  authorityRef: 'task-anchor:n333',
  exportPolicyDigest,
  expectedRuntimeObjectIds: objects,
  expectedActionIds: actions,
  expectedBehaviorGraphDigest: behaviorGraphDigest,
  maxExportBytes: 1_000_000
};

const receipt = {
  sourceHead: anchor.sourceHead,
  exportDigest,
  exportPolicyDigest,
  packageSizeBytes: 500_000,
  manifest,
  manifestDigest,
  observedRuntimeObjectIds: objects,
  observedActionIds: actions,
  actionInventoryDigest: sha256([...actions].sort()),
  behaviorGraphDigest
};

const birth = {
  objectId: 'boom',
  generatorFunctionId: 'generate:boom',
  sourceModuleDigest: sha256('module:boom'),
  parameterDigest: sha256('params:boom'),
  outputGeometryDigest: sha256('geometry:boom'),
  generatedAfterStartup: true
};
const run = {
  objectInventoryDigest: sha256(objects),
  actionGraphDigest: behaviorGraphDigest,
  geometryOutputDigest: sha256([birth.outputGeometryDigest])
};
const observation = {
  observedExportDigest: exportDigest,
  observedManifestDigest: manifestDigest,
  subjectBindingVerified: true,
  coldRoom: true,
  networkRequestCount: 0,
  remoteUrls: [],
  openedInputIds: manifest.map(entry => entry.id),
  forbiddenPayloadSignaturesDetected: [],
  serializedGeometryPayloadBytes: 0,
  geometryBirthRecords: [birth],
  runA: run,
  runB: { ...run }
};

const cases = [
  { name: 'exact export and manifest subject', observation, expected: [] },
  { name: 'different export digest', observation: { ...observation, observedExportDigest: sha256('other-export') }, expected: ['HOLD_EXPORT_OBSERVATION_SUBJECT_MISMATCH'] },
  { name: 'different manifest digest', observation: { ...observation, observedManifestDigest: sha256('other-manifest') }, expected: ['HOLD_EXPORT_OBSERVATION_SUBJECT_MISMATCH'] },
  { name: 'binding not independently verified', observation: { ...observation, subjectBindingVerified: false }, expected: ['HOLD_EXPORT_OBSERVATION_SUBJECT_MISMATCH'] }
];

const results = cases.map(test => {
  const actual = verifyFunctionExport(anchor, receipt, test.observation);
  const expected = [...test.expected].sort();
  return { name: test.name, expected, actual, pass: JSON.stringify(actual) === JSON.stringify(expected) };
});

const output = {
  schema: 'kaopu.n333.export-observation-subject-binding-fix/1',
  exactParentFailure: 'automation/n332-n331-export-observation-subject-audit-20261121@762a9dea4a51c8a0d8d815dba74690436e2c2411',
  passed: results.filter(result => result.pass).length,
  total: results.length,
  allPass: results.every(result => result.pass),
  productionReplay: 'NOT_RUN',
  results
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputPath = fileURLToPath(new URL('./n333_export_observation_subject_binding_fix_result.json', import.meta.url));
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ passed: output.passed, total: output.total, allPass: output.allPass }));
  if (!output.allPass) process.exitCode = 1;
}
