#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const HEX64 = /^[0-9a-f]{64}$/;

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

function validate(manifest) {
  const errors = [];
  if (!manifest.houdiniBuild) errors.push('houdiniBuild-required');
  if (!manifest.operator?.fullyQualifiedTypeName?.includes('::')) errors.push('fully-qualified-type-required');
  if (manifest.operator?.exactTypeResolution !== true) errors.push('exact-type-resolution-required');
  if (!HEX64.test(manifest.definition?.payloadSha256 || '')) errors.push('definition-payload-sha256-required');
  if (!manifest.definition?.libraryFilePath) errors.push('definition-library-source-required');
  if (manifest.definition?.isCurrent !== true) errors.push('current-definition-required');
  if (manifest.instance?.matchesCurrentDefinition !== true) errors.push('instance-must-match-current-definition');
  if (manifest.instance?.unlocked === true || manifest.instance?.dirty === true) errors.push('unlocked-or-dirty-instance-rejected');
  if (!HEX64.test(manifest.resolution?.libraryOrderSha256 || '')) errors.push('library-order-sha256-required');
  if (manifest.resolution?.multipleDefinitionsAvailable === true && !HEX64.test(manifest.resolution?.selectedDefinitionPayloadSha256 || '')) {
    errors.push('selected-definition-sha256-required-for-conflict');
  }
  if (manifest.resolution?.selectedDefinitionPayloadSha256 && manifest.resolution.selectedDefinitionPayloadSha256 !== manifest.definition?.payloadSha256) {
    errors.push('selected-definition-does-not-match-payload');
  }
  if (!HEX64.test(manifest.parametersSha256 || '')) errors.push('parameters-sha256-required');
  if (!manifest.context || !Number.isFinite(manifest.context.frame) || !Number.isFinite(manifest.context.timeSeconds)) errors.push('explicit-time-context-required');
  if (!manifest.context?.unitSystem) errors.push('unit-system-required');
  for (const input of manifest.externalInputs || []) {
    if (!input.uri || !HEX64.test(input.sha256 || '')) errors.push('external-input-uri-and-sha256-required');
  }
  return { valid: errors.length === 0, errors };
}

function artifactIdentity(manifest) {
  const gate = validate(manifest);
  if (!gate.valid) throw new Error(gate.errors.join(','));
  return sha256({
    houdiniBuild: manifest.houdiniBuild,
    operator: manifest.operator,
    definition: manifest.definition,
    instance: manifest.instance,
    resolution: manifest.resolution,
    parametersSha256: manifest.parametersSha256,
    context: manifest.context,
    externalInputs: manifest.externalInputs || []
  });
}

const base = {
  schema: 'kaopu-houdini-hda-identity/h01',
  houdiniBuild: '22.0-source-contract-only',
  operator: {
    fullyQualifiedTypeName: 'kaopu::field_operator::1.0',
    userVersionString: '1.0',
    exactTypeResolution: true
  },
  definition: {
    libraryFilePath: '$JOB/hda/kaopu--field_operator-1.0.hda',
    payloadSha256: 'a'.repeat(64),
    embedded: false,
    isCurrent: true,
    isPreferred: false
  },
  instance: { matchesCurrentDefinition: true, unlocked: false, dirty: false },
  resolution: {
    libraryOrderSha256: 'b'.repeat(64),
    opNamespaceHierarchy: '',
    preferHipDefinitions: false,
    multipleDefinitionsAvailable: true,
    selectedDefinitionPayloadSha256: 'a'.repeat(64)
  },
  parametersSha256: 'c'.repeat(64),
  context: { frame: 1, timeSeconds: 0, unitSystem: 'MKS', seed: 1701 },
  externalInputs: [{ uri: '$JOB/input/source.bgeo.sc', sha256: 'd'.repeat(64) }]
};

const checks = [];
function check(name, pass, detail) {
  checks.push({ name, pass: Boolean(pass), detail });
}

const baseGate = validate(base);
const baseIdentity = artifactIdentity(base);
check('complete manifest passes', baseGate.valid, baseGate);
check('artifact identity is sha256', HEX64.test(baseIdentity), baseIdentity);

const changedDefinition = structuredClone(base);
changedDefinition.definition.payloadSha256 = 'e'.repeat(64);
changedDefinition.resolution.selectedDefinitionPayloadSha256 = 'e'.repeat(64);
const changedIdentity = artifactIdentity(changedDefinition);
check('same type and version but changed definition changes identity', changedIdentity !== baseIdentity, { baseIdentity, changedIdentity });

const changedLibraryOrder = structuredClone(base);
changedLibraryOrder.resolution.libraryOrderSha256 = 'f'.repeat(64);
check('changed definition search order changes identity', artifactIdentity(changedLibraryOrder) !== baseIdentity, null);

const changedInput = structuredClone(base);
changedInput.externalInputs[0].sha256 = '1'.repeat(64);
check('changed external input changes identity', artifactIdentity(changedInput) !== baseIdentity, null);

const ambiguous = structuredClone(base);
ambiguous.operator.exactTypeResolution = false;
check('ambiguous type reference rejected', validate(ambiguous).errors.includes('exact-type-resolution-required'), validate(ambiguous));

const dirty = structuredClone(base);
dirty.instance.matchesCurrentDefinition = false;
dirty.instance.unlocked = true;
dirty.instance.dirty = true;
const dirtyErrors = validate(dirty).errors;
check('unlocked dirty instance rejected', dirtyErrors.includes('unlocked-or-dirty-instance-rejected') && dirtyErrors.includes('instance-must-match-current-definition'), dirtyErrors);

const noPayload = structuredClone(base);
delete noPayload.definition.payloadSha256;
check('library path without payload hash rejected', validate(noPayload).errors.includes('definition-payload-sha256-required'), validate(noPayload));

const unresolvedConflict = structuredClone(base);
delete unresolvedConflict.resolution.selectedDefinitionPayloadSha256;
check('multiple definitions require explicit selected payload', validate(unresolvedConflict).errors.includes('selected-definition-sha256-required-for-conflict'), validate(unresolvedConflict));

const selectionMismatch = structuredClone(base);
selectionMismatch.resolution.selectedDefinitionPayloadSha256 = '2'.repeat(64);
check('selected definition must match recorded payload', validate(selectionMismatch).errors.includes('selected-definition-does-not-match-payload'), validate(selectionMismatch));

const noInputHash = structuredClone(base);
delete noInputHash.externalInputs[0].sha256;
check('external input without content hash rejected', validate(noInputHash).errors.includes('external-input-uri-and-sha256-required'), validate(noInputHash));

const noTime = structuredClone(base);
delete noTime.context.timeSeconds;
check('implicit cook time rejected', validate(noTime).errors.includes('explicit-time-context-required'), validate(noTime));

const userVersionOnly = structuredClone(base);
userVersionOnly.operator.userVersionString = '2.0';
check('user version participates but cannot replace payload identity', artifactIdentity(userVersionOnly) !== baseIdentity && HEX64.test(userVersionOnly.definition.payloadSha256), null);

const passed = checks.filter((item) => item.pass).length;
const result = {
  schema: 'kaopu-houdini-hda-identity-result/h01',
  status: passed === checks.length ? 'pass' : 'fail',
  evidenceClass: 'source-contract CPU fixture',
  observationRoot: 'official SideFX documentation lineage plus local manifest logic; not Houdini runtime',
  summary: {
    checks: checks.length,
    passed,
    failed: checks.length - passed,
    baseArtifactIdentity: baseIdentity,
    changedDefinitionArtifactIdentity: changedIdentity
  },
  observations: [
    'A fully qualified type and user version do not identify exact HDA definition bytes.',
    'Definition resolution policy, selected payload, instance lock state, parameters, context and external inputs affect reproducible identity.',
    'The fixture validates a handoff manifest only; it does not execute Houdini or prove cooked geometry equivalence.'
  ],
  checks
};

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
