import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';

const sha256 = value => createHash('sha256').update(
  typeof value === 'string' ? value : JSON.stringify(value)
).digest('hex');

const sameSet = (left = [], right = []) => {
  const a = [...new Set(left)].sort();
  const b = [...new Set(right)].sort();
  return JSON.stringify(a) === JSON.stringify(b);
};

export function verifyFunctionExport(anchor, receipt, observation) {
  const holds = new Set();

  if (!anchor?.sourceHead || !anchor?.authorityRef || !anchor?.exportPolicyDigest) {
    holds.add('HOLD_EXPORT_ANCHOR_INCOMPLETE');
  }
  if (!receipt?.exportDigest || receipt.sourceHead !== anchor?.sourceHead) {
    holds.add('HOLD_EXPORT_SUBJECT_MISMATCH');
  }
  if (receipt.exportPolicyDigest !== anchor?.exportPolicyDigest) {
    holds.add('HOLD_EXPORT_POLICY_MISMATCH');
  }

  if (!sameSet(anchor?.expectedRuntimeObjectIds, receipt?.observedRuntimeObjectIds)) {
    holds.add('HOLD_EXPORT_OBJECT_INVENTORY_MISMATCH');
  }
  if (!sameSet(anchor?.expectedActionIds, receipt?.observedActionIds)) {
    holds.add('HOLD_EXPORT_ACTION_INVENTORY_MISMATCH');
  }
  if (receipt?.actionInventoryDigest !== sha256([...new Set(anchor?.expectedActionIds || [])].sort())) {
    holds.add('HOLD_EXPORT_ACTION_INVENTORY_DIGEST_MISMATCH');
  }
  if (receipt?.behaviorGraphDigest !== anchor?.expectedBehaviorGraphDigest) {
    holds.add('HOLD_EXPORT_BEHAVIOR_GRAPH_MISMATCH');
  }

  if (!Number.isFinite(anchor?.maxExportBytes)) {
    holds.add('HOLD_EXPORT_SIZE_BUDGET_UNFROZEN');
  } else if (!Number.isFinite(receipt?.packageSizeBytes) || receipt.packageSizeBytes > anchor.maxExportBytes) {
    holds.add('HOLD_EXPORT_SIZE_BUDGET_EXCEEDED');
  }

  const manifest = receipt?.manifest || [];
  const manifestIds = new Set(manifest.map(entry => entry.id));
  const forbiddenRoles = new Set([
    'TEACHER_REFERENCE_BYTES',
    'LEGACY_ASSET_BYTES',
    'BAKED_PRODUCTION_MESH',
    'PRERECORDED_MEDIA',
    'UNPINNED_REMOTE_RUNTIME'
  ]);
  if (manifest.some(entry => forbiddenRoles.has(entry.role))) {
    holds.add('HOLD_EXPORT_FORBIDDEN_PAYLOAD_ROLE');
  }
  if (manifest.some(entry => !entry.id || !entry.sha256 || !entry.role || !entry.rightsState)) {
    holds.add('HOLD_EXPORT_MANIFEST_INCOMPLETE');
  }
  if ((observation?.forbiddenPayloadSignaturesDetected || []).length > 0 ||
      (observation?.serializedGeometryPayloadBytes ?? 0) !== 0) {
    holds.add('HOLD_EXPORT_SERIALIZED_GEOMETRY_OR_HIDDEN_ASSET');
  }

  if (!observation?.coldRoom || observation.networkRequestCount !== 0) {
    holds.add('HOLD_EXPORT_NOT_OFFLINE_CLEAN_ROOM');
  }
  if ((observation?.openedInputIds || []).some(id => !manifestIds.has(id))) {
    holds.add('HOLD_EXPORT_UNDECLARED_RUNTIME_INPUT');
  }
  if ((observation?.remoteUrls || []).length > 0) {
    holds.add('HOLD_EXPORT_REMOTE_RUNTIME_DEPENDENCY');
  }

  const births = observation?.geometryBirthRecords || [];
  const bornObjects = births.map(record => record.objectId);
  if (!sameSet(anchor?.expectedRuntimeObjectIds, bornObjects)) {
    holds.add('HOLD_EXPORT_FUNCTION_RECONSTRUCTION_COVERAGE_INCOMPLETE');
  }
  if (births.some(record =>
    !record.generatorFunctionId ||
    !record.sourceModuleDigest ||
    !record.parameterDigest ||
    !record.outputGeometryDigest ||
    !record.generatedAfterStartup
  )) {
    holds.add('HOLD_EXPORT_GENERATOR_PROVENANCE_INCOMPLETE');
  }

  if (observation?.runA?.objectInventoryDigest !== observation?.runB?.objectInventoryDigest ||
      observation?.runA?.actionGraphDigest !== observation?.runB?.actionGraphDigest ||
      observation?.runA?.geometryOutputDigest !== observation?.runB?.geometryOutputDigest) {
    holds.add('HOLD_EXPORT_NONDETERMINISTIC_RECONSTRUCTION');
  }
  if (observation?.runA?.actionGraphDigest !== anchor?.expectedBehaviorGraphDigest) {
    holds.add('HOLD_EXPORT_CLEAN_ROOM_ACTION_GRAPH_MISMATCH');
  }

  return [...holds].sort();
}

const objects = ['boom', 'arm', 'bucket', 'hose-left', 'hose-right'];
const actions = ['BOOM_RAISE', 'BOOM_LOWER', 'ARM_IN', 'ARM_OUT', 'BUCKET_IN', 'BUCKET_OUT'];
const behaviorGraphDigest = sha256({ actions, edges: ['input>state', 'state>observable'] });
const policyDigest = sha256({
  allowedRoles: ['ENTRYPOINT', 'FUNCTION_SOURCE', 'CONFIG', 'RUNTIME_VENDOR', 'TEST', 'RECEIPT'],
  forbiddenRoles: ['TEACHER_REFERENCE_BYTES', 'LEGACY_ASSET_BYTES', 'BAKED_PRODUCTION_MESH']
});

const baseAnchor = {
  sourceHead: 'source-head-331',
  authorityRef: 'task-anchor:n331',
  exportPolicyDigest: policyDigest,
  expectedRuntimeObjectIds: objects,
  expectedActionIds: actions,
  expectedBehaviorGraphDigest: behaviorGraphDigest,
  maxExportBytes: 2_000_000
};

const manifest = [
  ['entry', 'ENTRYPOINT'],
  ['geometry', 'FUNCTION_SOURCE'],
  ['actions', 'FUNCTION_SOURCE'],
  ['config', 'CONFIG'],
  ['runtime', 'RUNTIME_VENDOR'],
  ['receipt', 'RECEIPT']
].map(([id, role]) => ({ id, path: `${id}.mjs`, role, sha256: sha256(id), rightsState: 'RECORDED' }));

const baseReceipt = {
  sourceHead: baseAnchor.sourceHead,
  exportDigest: sha256('export'),
  exportPolicyDigest: policyDigest,
  packageSizeBytes: 1_250_000,
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

const baseObservation = {
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

const clone = value => structuredClone(value);
const cases = [
  ['valid function-only export closure', baseAnchor, baseReceipt, baseObservation, []],
  ['missing authority anchor', { ...baseAnchor, authorityRef: '' }, baseReceipt, baseObservation, ['HOLD_EXPORT_ANCHOR_INCOMPLETE']],
  ['stale source subject', baseAnchor, { ...baseReceipt, sourceHead: 'old-head' }, baseObservation, ['HOLD_EXPORT_SUBJECT_MISMATCH']],
  ['producer shrinks object inventory', baseAnchor, { ...baseReceipt, observedRuntimeObjectIds: objects.slice(0, -1) }, baseObservation, ['HOLD_EXPORT_OBJECT_INVENTORY_MISMATCH']],
  ['producer omits required action', baseAnchor, { ...baseReceipt, observedActionIds: actions.slice(0, -1) }, baseObservation, ['HOLD_EXPORT_ACTION_INVENTORY_MISMATCH']],
  ['teacher bytes bundled', baseAnchor, { ...baseReceipt, manifest: [...manifest, { id: 'teacher', path: 'teacher.glb', role: 'TEACHER_REFERENCE_BYTES', sha256: sha256('teacher'), rightsState: 'REFERENCE_ONLY' }] }, baseObservation, ['HOLD_EXPORT_FORBIDDEN_PAYLOAD_ROLE']],
  ['legacy mesh bundled', baseAnchor, { ...baseReceipt, manifest: [...manifest, { id: 'legacy', path: 'old.glb', role: 'LEGACY_ASSET_BYTES', sha256: sha256('legacy'), rightsState: 'UNKNOWN' }] }, baseObservation, ['HOLD_EXPORT_FORBIDDEN_PAYLOAD_ROLE']],
  ['hidden serialized geometry detected', baseAnchor, baseReceipt, { ...baseObservation, serializedGeometryPayloadBytes: 8192, forbiddenPayloadSignaturesDetected: ['base64-glb'] }, ['HOLD_EXPORT_SERIALIZED_GEOMETRY_OR_HIDDEN_ASSET']],
  ['runtime opens unmanifested input', baseAnchor, baseReceipt, { ...baseObservation, openedInputIds: [...baseObservation.openedInputIds, 'secret-mesh'] }, ['HOLD_EXPORT_UNDECLARED_RUNTIME_INPUT']],
  ['remote runtime fetch', baseAnchor, baseReceipt, { ...baseObservation, networkRequestCount: 1, remoteUrls: ['https://example.invalid/mesh.glb'] }, ['HOLD_EXPORT_NOT_OFFLINE_CLEAN_ROOM', 'HOLD_EXPORT_REMOTE_RUNTIME_DEPENDENCY']],
  ['generator coverage omits hose', baseAnchor, baseReceipt, { ...baseObservation, geometryBirthRecords: geometryBirthRecords.slice(0, -1) }, ['HOLD_EXPORT_FUNCTION_RECONSTRUCTION_COVERAGE_INCOMPLETE']],
  ['generator provenance incomplete', baseAnchor, baseReceipt, { ...baseObservation, geometryBirthRecords: geometryBirthRecords.map((x, i) => i ? x : { ...x, sourceModuleDigest: '' }) }, ['HOLD_EXPORT_GENERATOR_PROVENANCE_INCOMPLETE']],
  ['nondeterministic second reconstruction', baseAnchor, baseReceipt, { ...baseObservation, runB: { ...run, geometryOutputDigest: sha256('drift') } }, ['HOLD_EXPORT_NONDETERMINISTIC_RECONSTRUCTION']],
  ['clean-room action graph diverges', baseAnchor, baseReceipt, { ...baseObservation, runA: { ...run, actionGraphDigest: sha256('other') }, runB: { ...run, actionGraphDigest: sha256('other') } }, ['HOLD_EXPORT_CLEAN_ROOM_ACTION_GRAPH_MISMATCH']],
  ['size budget not frozen', { ...baseAnchor, maxExportBytes: null }, baseReceipt, baseObservation, ['HOLD_EXPORT_SIZE_BUDGET_UNFROZEN']],
  ['package exceeds frozen size budget', baseAnchor, { ...baseReceipt, packageSizeBytes: 2_000_001 }, baseObservation, ['HOLD_EXPORT_SIZE_BUDGET_EXCEEDED']]
];

const results = cases.map(([name, anchor, receipt, observation, expected]) => {
  const actual = verifyFunctionExport(clone(anchor), clone(receipt), clone(observation));
  return { name, pass: JSON.stringify(actual) === JSON.stringify([...expected].sort()), expected: [...expected].sort(), actual };
});

const output = {
  schema: 'kaopu.n331.function-export-closure-result/1',
  boundedQuestion: 'Can one small reusable excavator export prove that required function-generated objects and actions reconstruct offline while teacher/reference and legacy asset bytes remain outside the package?',
  sourceBranchBase: 'automation/n330-zx85-manual-autoplay-parity-20261121@894c310963463f0dc3f1e4abfea63eb75f153aeb',
  fixtureOnly: true,
  productionReplay: 'NOT_RUN',
  productionSourceHead: 'UNKNOWN',
  productionExportSizeBudget: 'UNKNOWN',
  passed: results.filter(result => result.pass).length,
  total: results.length,
  allPass: results.every(result => result.pass),
  results
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const outputPath = fileURLToPath(new URL('./n331_zx85_function_export_closure_result.json', import.meta.url));
  writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(JSON.stringify({ passed: output.passed, total: output.total, allPass: output.allPass }));
  if (!output.allPass) process.exitCode = 1;
}
