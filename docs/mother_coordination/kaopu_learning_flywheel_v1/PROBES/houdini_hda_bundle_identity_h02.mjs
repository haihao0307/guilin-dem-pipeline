#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

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

function rawLibraryHash(library) {
  return sha256(library);
}

function selectDefinition(library, fullyQualifiedTypeName) {
  const matches = library.definitions.filter((item) => item.fullyQualifiedTypeName === fullyQualifiedTypeName);
  if (matches.length !== 1) throw new Error(`expected-one-definition:${matches.length}`);
  return matches[0];
}

function contentsOnlyHash(definition) {
  const contents = definition.sections.find((section) => section.name === 'Contents');
  if (!contents) throw new Error('Contents-section-required');
  return sha256(contents.bytes);
}

function definitionBundleHash(definition) {
  if (!definition.fullyQualifiedTypeName) throw new Error('fully-qualified-type-required');
  if (!Array.isArray(definition.sections) || definition.sections.length === 0) throw new Error('sections-required');
  const names = definition.sections.map((section) => section.name);
  if (new Set(names).size !== names.length) throw new Error('duplicate-section-name');
  for (const section of definition.sections) {
    if (!section.name || typeof section.bytes !== 'string') throw new Error('section-name-and-bytes-required');
  }
  const sections = [...definition.sections]
    .map(({ name, bytes }) => ({ name, sha256: sha256(bytes), size: Buffer.byteLength(bytes) }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return sha256({
    fullyQualifiedTypeName: definition.fullyQualifiedTypeName,
    sections,
    options: definition.options,
    interface: definition.interface
  });
}

const target = {
  fullyQualifiedTypeName: 'kaopu::field_operator::1.0',
  sections: [
    { name: 'Contents', bytes: 'node graph bytes v1' },
    { name: 'DialogScript', bytes: 'parameter interface v1' },
    { name: 'PythonModule', bytes: 'def cook_hook(): return 1' },
    { name: 'lookup.bin', bytes: 'embedded lookup payload v1' }
  ],
  options: { lockContents: true, saveSpareParms: false },
  interface: { minInputs: 1, maxInputs: 2 }
};

const libraryA = {
  transport: { author: 'artist-a', packed: true, timestamp: 100, compression: 'gzip-6' },
  definitions: [target, {
    fullyQualifiedTypeName: 'kaopu::unrelated::1.0',
    sections: [{ name: 'Contents', bytes: 'unrelated-a' }],
    options: {}, interface: {}
  }]
};

const libraryB = structuredClone(libraryA);
libraryB.transport = { author: 'build-bot', packed: true, timestamp: 200, compression: 'gzip-9' };
libraryB.definitions[1].sections[0].bytes = 'unrelated-b';

const checks = [];
function check(name, pass, detail = null) {
  checks.push({ name, pass: Boolean(pass), detail });
}

const selectedA = selectDefinition(libraryA, target.fullyQualifiedTypeName);
const selectedB = selectDefinition(libraryB, target.fullyQualifiedTypeName);
const rawA = rawLibraryHash(libraryA);
const rawB = rawLibraryHash(libraryB);
const bundleA = definitionBundleHash(selectedA);
const bundleB = definitionBundleHash(selectedB);
check('whole library hash changes with packaging or sibling definition', rawA !== rawB, { rawA, rawB });
check('target definition bundle stays stable across packaging and sibling change', bundleA === bundleB, { bundleA, bundleB });

const scriptChanged = structuredClone(selectedA);
scriptChanged.sections.find((x) => x.name === 'PythonModule').bytes = 'def cook_hook(): return 2';
check('Contents-only hash misses PythonModule change', contentsOnlyHash(scriptChanged) === contentsOnlyHash(selectedA), null);
check('definition bundle catches PythonModule change', definitionBundleHash(scriptChanged) !== bundleA, null);

const lookupChanged = structuredClone(selectedA);
lookupChanged.sections.find((x) => x.name === 'lookup.bin').bytes = 'embedded lookup payload v2';
check('Contents-only hash misses embedded section change', contentsOnlyHash(lookupChanged) === contentsOnlyHash(selectedA), null);
check('definition bundle catches embedded section change', definitionBundleHash(lookupChanged) !== bundleA, null);

const reordered = structuredClone(selectedA);
reordered.sections.reverse();
check('section enumeration order does not change bundle identity', definitionBundleHash(reordered) === bundleA, null);

const typeChanged = structuredClone(selectedA);
typeChanged.fullyQualifiedTypeName = 'kaopu::field_operator::2.0';
check('fully qualified type participates in bundle identity', definitionBundleHash(typeChanged) !== bundleA, null);

const optionChanged = structuredClone(selectedA);
optionChanged.options.lockContents = false;
check('definition options participate in bundle identity', definitionBundleHash(optionChanged) !== bundleA, null);

const interfaceChanged = structuredClone(selectedA);
interfaceChanged.interface.maxInputs = 4;
check('interface contract participates in bundle identity', definitionBundleHash(interfaceChanged) !== bundleA, null);

let duplicateRejected = false;
try {
  selectDefinition({ definitions: [selectedA, structuredClone(selectedA)] }, target.fullyQualifiedTypeName);
} catch (error) {
  duplicateRejected = error.message === 'expected-one-definition:2';
}
check('duplicate same-name definitions rejected before hashing', duplicateRejected, null);

let duplicateSectionRejected = false;
try {
  const duplicate = structuredClone(selectedA);
  duplicate.sections.push({ name: 'Contents', bytes: 'shadow' });
  definitionBundleHash(duplicate);
} catch (error) {
  duplicateSectionRejected = error.message === 'duplicate-section-name';
}
check('duplicate section names rejected', duplicateSectionRejected, null);

const passed = checks.filter((item) => item.pass).length;
const result = {
  schema: 'kaopu-houdini-hda-bundle-identity-result/h02',
  status: passed === checks.length ? 'pass' : 'fail',
  evidenceClass: 'source-contract CPU fixture',
  observationRoot: 'official SideFX documentation lineage plus synthetic container fixtures; not Houdini runtime',
  summary: {
    checks: checks.length,
    passed,
    failed: checks.length - passed,
    rawLibraryA: rawA,
    rawLibraryB: rawB,
    targetDefinitionBundle: bundleA,
    contentsOnly: contentsOnlyHash(selectedA)
  },
  currentBestView: 'Record both transport hash and selected-definition bundle hash. Do not substitute whole-library or Contents-only hashes for the selected definition bundle.',
  boundary: 'The bundle is conservative exact-definition identity, not semantic equivalence and not proof of deterministic cook output.',
  checks
};

const output = process.argv[2];
if (output) writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (result.status !== 'pass') process.exitCode = 1;
