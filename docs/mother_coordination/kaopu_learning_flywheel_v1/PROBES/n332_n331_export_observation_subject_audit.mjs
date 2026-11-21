import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
import { verifyFunctionExport } from './n331_zx85_function_export_closure_gate.mjs';

const sha256 = value => createHash('sha256').update(
  typeof value === 'string' ? value : JSON.stringify(value)
).digest('hex');

const objects = ['boom', 'arm', 'bucket'];
const actions = ['BOOM_RAISE', 'BOOM_LOWER'];
const behaviorGraphDigest = sha256({ actions, edges: ['input>state', 'state>observable'] });
const exportPolicyDigest = sha256({ allowed: ['FUNCTION_SOURCE', 'CONFIG', 'ENTRYPOINT', 'RECEIPT'] });
const deliveredExportDigest = sha256('delivered-export-with-unknown-payload');
const cleanObservedExportDigest = sha256('different-clean-export');

const anchor = {
  sourceHead: 'source-head-332',
  authorityRef: 'task-anchor:n332',
  exportPolicyDigest,
  expectedRuntimeObjectIds: objects,
  expectedActionIds: actions,
  expectedBehaviorGraphDigest: behaviorGraphDigest,
  maxExportBytes: 1_000_000
};

const manifest = [
  ['entry', 'ENTRYPOINT'],
  ['geometry', 'FUNCTION_SOURCE'],
  ['actions', 'FUNCTION_SOURCE'],
  ['config', 'CONFIG'],
  ['receipt', 'RECEIPT']
].map(([id, role]) => ({ id, role, sha256: sha256(id), rightsState: 'RECORDED' }));

const receipt = {
  sourceHead: anchor.sourceHead,
  exportDigest: deliveredExportDigest,
  exportPolicyDigest,
  packageSizeBytes: 700_000,
  manifest,
  observedRuntimeObjectIds: objects,
  observedActionIds: actions,
  actionInventoryDigest: sha256([...actions].sort()),
  behaviorGraphDigest
};

const geometryBirthRecords = objects.map(objectId => ({
  objectId,
  generatorFunctionId: `generate:${objectId}`,
  sourceModuleDigest: sha256(`module:${objectId}`),
  parameterDigest: sha256(`params:${objectId}`),
  outputGeometryDigest: sha256(`geometry:${objectId}`),
  generatedAfterStartup: true
}));

const run = {
  objectInventoryDigest: sha256([...objects].sort()),
  actionGraphDigest: behaviorGraphDigest,
  geometryOutputDigest: sha256(geometryBirthRecords.map(x => x.outputGeometryDigest))
};

const observation = {
  observationId: 'clean-room-observation-from-another-export',
  observedExportDigest: cleanObservedExportDigest,
  claimedReceiptExportDigest: deliveredExportDigest,
  subjectBindingVerified: false,
  coldRoom: true,
  networkRequestCount: 0,
  remoteUrls: [],
  openedInputIds: manifest.map(entry => entry.id),
  forbiddenPayloadSignaturesDetected: [],
  serializedGeometryPayloadBytes: 0,
  geometryBirthRecords,
  runA: run,
  runB: { ...run }
};

const actualHolds = verifyFunctionExport(anchor, receipt, observation);
const expectedHold = 'HOLD_EXPORT_OBSERVATION_SUBJECT_MISMATCH';
const falseAccept = !actualHolds.includes(expectedHold);

const result = {
  schema: 'kaopu.n332.n331-export-observation-subject-audit/1',
  boundedQuestion: 'Can N331 accept a clean-room observation made against a different export digest than the delivered export?',
  exactN331Subject: 'automation/n331-zx85-function-export-closure-20261121@38638a0c71c289f9113c26e1bcc9ad3ddb8a52ea',
  deliveredExportDigest,
  observedExportDigest: cleanObservedExportDigest,
  digestsDiffer: deliveredExportDigest !== cleanObservedExportDigest,
  expectedHold,
  actualHolds,
  falseAccept,
  decision: falseAccept ? 'HOLD_GATE_FAIL_N331_EXPORT_OBSERVATION_SUBJECT_UNBOUND' : 'COUNTEREXAMPLE_REJECTED',
  productionReplay: 'NOT_RUN',
  teacherStatus: 'NO_NOVELTY'
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputPath = fileURLToPath(new URL('./n332_n331_export_observation_subject_audit_result.json', import.meta.url));
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify({ falseAccept, expectedHold, actualHolds }));
  if (!falseAccept) process.exitCode = 1;
}
