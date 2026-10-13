// Read-only source/closure audit. This script writes only its own JSON certificate.
// Run from any directory: node path/to/candidate/qa/granite-dispatch-audit.mjs
// Defaults to the sibling kowloon-train88-r01 host. For a retained local host
// snapshot, set HERITAGE_BASELINE_HOST to its directory (absolute or cwd-relative).
// Frozen B/C snapshots are read as text only; they are never imported.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fileURLToPath, pathToFileURL} from 'node:url';

const candidateRoot = new URL('../', import.meta.url);
const baselineHost = process.env.HERITAGE_BASELINE_HOST
  ? pathToFileURL(path.resolve(process.env.HERITAGE_BASELINE_HOST) + path.sep)
  : new URL('../kowloon-train88-r01/', candidateRoot);
const paths = {
  receiver: {root: 'candidate', path: 'receiver.mjs'},
  field: {root: 'candidate', path: 'station-field.mjs'},
  matter: {root: 'candidate', path: 'station-matter.mjs'},
  score: {root: 'candidate', path: 'station-score.mjs'},
  graniteMother: {root: 'candidate', path: 'mothers/granite-fields.mjs'},
  hostDatums: {root: 'baselineHost', path: 'qa/host-datums.json'},
  stationBinding: {root: 'baselineHost', path: 'station-binding.mjs'},
  hostConstruction: {root: 'baselineHost', path: 'host-construction.mjs'},
  geometryGroups: {root: 'baselineHost', path: 'geometry-groups.mjs'},
  closureModule: {root: 'baselineHost', path: 'shader-closure.mjs'},
  bMatter: {root: 'candidate', path: 'qa/frozen-1f46/station-matter.mjs'},
  cMatter: {root: 'candidate', path: 'qa/frozen-bdcd/station-matter.mjs'},
  cField: {root: 'candidate', path: 'qa/frozen-bdcd/station-field.mjs'},
};
const frozenSHA256 = {
  bMatter: '0ceb936046b4543bc0720971afe2543477b9cfc37101bcf2ecd11bc5950360da',
  cMatter: '9b84f66daaab3b5064cbccfdd210b725bec125261f816ab38afe37bdd016bc7c',
  cField: 'e7f75b3a4487124f9d68693139a929ec6adf74cf0c107f3dfd3257c767bbc853',
};
const url = key => new URL(paths[key].path, paths[key].root === 'candidate' ? candidateRoot : baselineHost);
const read = key => fs.readFileSync(url(key), 'utf8');
const hash = text => createHash('sha256').update(text).digest('hex');
const moduleAt = key => {
  assert(!(key in frozenSHA256), 'Frozen source snapshots must never be imported');
  return import(url(key).href);
};
for (const [key, expected] of Object.entries(frozenSHA256)) assert.equal(hash(read(key)), expected, 'Frozen source hash: ' + key);
function getFunction(source, name) {
  const start = source.indexOf('fn ' + name + '(');
  assert(start >= 0, 'Missing function: ' + name);
  const open = source.indexOf('{', start);
  let end = open + 1, depth = 1;
  while (depth && end < source.length) {
    if (source[end] === '{') depth++;
    if (source[end] === '}') depth--;
    end++;
  }
  assert.equal(depth, 0, 'Unclosed function: ' + name);
  return source.slice(start, end);
}

const {createStationWGSL} = await moduleAt('receiver');
const {STATION_SCORE: score} = await moduleAt('score');
const {createStationBinding} = await moduleAt('stationBinding');
const {hostConstructionWGSL} = await moduleAt('hostConstruction');
const {stationGeometryGroupSource, GEOMETRY_GROUP_NAMES} = await moduleAt('geometryGroups');
const {extraction} = await moduleAt('closureModule');
const datums = JSON.parse(read('hostDatums'));
const {construction} = createStationBinding({score, ...datums});
const stationSource = createStationWGSL({construction, hostWGSL: hostConstructionWGSL(construction.host)});
const field = read('field'), matter = read('matter'), cField = read('cField');
const bMatter = read('bMatter'), cMatter = read('cMatter');

const equality = {
  nonGraniteGeometryEqualsBExceptName:
    getFunction(matter, 'evaluateStationNonGraniteGeometry').replace('evaluateStationNonGraniteGeometry', 'evaluateStationGeometry') === getFunction(bMatter, 'evaluateStationGeometry'),
  fullMatterEqualsC:
    getFunction(matter, 'evaluateStationMatter') === getFunction(cMatter, 'evaluateStationMatter'),
  recorderEqualsC:
    getFunction(field, 'recordCandidate') === getFunction(cField, 'recordCandidate'),
  graniteNearFarEqualsCExceptName:
    getFunction(field, 'stationGraniteCandidatePhysicalDistance').replace('stationGraniteCandidatePhysicalDistance', 'stationCandidatePhysicalDistance') === getFunction(cField, 'stationCandidatePhysicalDistance'),
  stationDomainEqualsCAfterOnlyDeclaredResetAndRecorderReversal:
    getFunction(field, 'stationDomain')
      .replace(';stationGraniteSlot=STATION_CANDIDATE_CAPACITY;stationGraniteDistance=10000.', '')
      .replace('recordGraniteCandidate(HitField(stone.d,2u,tq,171.,stone.d,vec3<f32>(4.8,23.,4.8),stone.member),p)', 'recordCandidate(HitField(stone.d,2u,tq,171.,stone.d,vec3<f32>(4.8,23.,4.8),stone.member))') === getFunction(cField, 'stationDomain'),
};
for (const [name, value] of Object.entries(equality)) assert.equal(value, true, name);
const graniteSite = 'recordGraniteCandidate(HitField(stone.d,2u,tq,171.,stone.d,vec3<f32>(4.8,23.,4.8),stone.member),p)';
assert.equal(stationSource.split(graniteSite).length - 1, 1, 'Exactly one typed granite construction site required');
assert.equal((stationSource.match(/\brecordGraniteCandidate\s*\(/g) || []).length, 2, 'Only definition and one call allowed');

const groups = GEOMETRY_GROUP_NAMES.map((name, index) => {
  const selected = stationGeometryGroupSource(stationSource, index);
  const part = extraction(selected), closure = part.closure(['stationDomain']);
  const full = part.header + closure;
  const functions = [...closure.matchAll(/\bfn\s+(\w+)\s*\(/g)].map(match => match[1]);
  const motherFunctions = functions.filter(name => name.startsWith('gr_') || name.startsWith('kpGranite'));
  const includes = Object.fromEntries(['gr_scell', 'kpGraniteHeight', 'recordGraniteCandidate', 'evaluateStationGeometry'].map(name => [name, functions.includes(name)]));
  for (const [name, present] of Object.entries(includes)) assert.equal(present, index === 2, `group ${index}: ${name}`);
  assert.equal(motherFunctions.length > 0, index === 2, `group ${index}: any granite mother function`);
  return {
    index, name,
    selectedStationSourceSHA256: hash(selected),
    closureSHA256: hash(closure),
    closureWithSharedHeaderSHA256: hash(full),
    closureBytes: Buffer.byteLength(closure),
    closureWithSharedHeaderBytes: Buffer.byteLength(full),
    functionCount: functions.length,
    includes,
    graniteMotherFunctions: motherFunctions,
  };
});

const certificate = {
  schema: 'kaopu.granite-dispatch-source-audit/1',
  status: 'pass',
  createdAt: new Date().toISOString(),
  scope: 'Exact candidate construction source and twelve original geometry partition closures; runtime entry/header and GPU compilation/execution are not tested here.',
  reproduction: {
    command: 'node qa/granite-dispatch-audit.mjs',
    workingDirectory: 'candidate source root; the script itself may be invoked from any working directory',
    baselineHostDefault: '../kowloon-train88-r01 relative to candidate source root',
    baselineHostOverride: 'HERITAGE_BASELINE_HOST, absolute or relative to the process working directory',
    localSnapshotExample: 'HERITAGE_BASELINE_HOST=./baseline25 node candidate/qa/granite-dispatch-audit.mjs',
    resolvedBaselineHostRelativeToCandidate: path.relative(fileURLToPath(candidateRoot), fileURLToPath(baselineHost)),
    scriptSHA256: hash(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')),
    sourcePaths: paths,
    requiredSnapshotNote: 'B/C snapshots are hash-locked and read as text only. Host dependencies come from the selected baselineHost. Input hashes identify the exact audit inputs; stationSourceSHA256 is not claimed to be the emitted full host runtime hash.',
  },
  inputSHA256: Object.fromEntries(Object.keys(paths).map(key => [key, hash(read(key))])),
  frozenSourceSHA256: frozenSHA256,
  stationSourceSHA256: hash(stationSource),
  stationSourceBytes: Buffer.byteLength(stationSource),
  equality,
  graniteCandidate: {
    literalSiteCount: 1,
    id: 2,
    seed: 171,
    site: 'stationDomain: tb < 2 tower branch, outside every loop',
    geometryGroupIndex: 2,
    rawHitFieldPreserved: true,
    slotIndex: 'retained count before unchanged recordCandidate; valid only if retained count increases',
    sentinel: 'STATION_CANDIDATE_CAPACITY, reset at every stationDomain entry',
  },
  groups,
  reasoningChecks: [
    'The unchanged recorder preserves raw count, capacity/overflow behavior, raw candidate values, upper bound and first-stage pruning.',
    'The resolver preserves original candidate order, second-stage pruning, native/near-far evaluation guard and strict less-than winner selection; only the recorded granite slot reads its precomputed physical value.',
    'Material/state/granite distance dependencies do not call stationDomain or mutate candidate workspace; earlier evaluation is pure, although a later-pruned granite slot may now be evaluated unnecessarily.',
    'Each query resets the slot; later record calls only append and never move retained candidates, so the slot index remains stable.',
    'The full evaluateStationGeometry wrapper retains granite semantics for shading, AO and independent direct probes; ordinary construction callbacks now require the documented non-granite precondition.',
  ],
  limitations: [
    'No shader compiler, GPU draw, visual comparison or runtime performance assertion is made by this source audit.',
    'The single-slot proof must be re-audited if another granite candidate site, candidate reordering or nested stationDomain query is added.',
    'GPU equality checks must cover signed near/far thresholds, pruned/retained slots, equal-distance ties, overflow and consecutive query resets.',
  ],
};
const destination = new URL('./granite-dispatch-audit.json', import.meta.url);
fs.writeFileSync(destination, JSON.stringify(certificate, null, 2) + '\n');
console.log(JSON.stringify({status: certificate.status, output: fileURLToPath(destination), groups: groups.length, graniteGroups: groups.filter(group => group.includes.gr_scell).map(group => group.index), stationSourceSHA256: certificate.stationSourceSHA256}));
