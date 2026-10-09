/**
 * Data-only, live-procedural inventory validator and deterministic comparison planner.
 * This module does not run an evaluator, infer motion, bake packets or certify art.
 * Production requires reviewed semantics AND measured, source/shape/role-bound QA.
 * Hashes establish integrity, not the truth of a review or the quality of a motion.
 */
export const LIVE_PROGRAM_SCHEMA = 'kaopu-live-motion-program/1';
export const LIVE_SCHEDULE_SCHEMA = 'kaopu-live-program-comparison-round/1';
export const LIVE_QA_SCHEMA = 'kaopu-live-program-numeric-qa/1';
const demand = (condition, message) => { if (!condition) throw new Error(message); };
const isHash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const isText = value => typeof value === 'string' && value.trim().length > 0;
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const offlineFields = ['bakes', 'bakeHash', 'bakeSha256', 'canonicalClipSha256', 'packetSha256', 'nativePacketSha256'];
const nonSemanticKeys = new Set([
  'id', 'programId', 'semanticMotionId', 'takeId', 'label', 'name', 'description',
  'seed', 'randomSeed', 'phase', 'phaseOffset', 'startPhase', 'randomPhase',
  'start', 'end', 'startSeconds', 'endSeconds', 'responseStart', 'responseEnd',
  'duration', 'durationSeconds', 'fps', 'speed', 'source', 'sourceRevision',
  'qualityStatus', 'semanticReviewStatus',
]);

/** Strict deterministic JSON: rejects non-finite numbers, undefined and functions. */
export function canonicalJSON(value) {
  const active = new Set();
  function visit(node) {
    if (node === null || typeof node === 'string' || typeof node === 'boolean') return JSON.stringify(node);
    if (typeof node === 'number') { demand(Number.isFinite(node), 'canonical JSON requires finite numbers'); return JSON.stringify(node); }
    demand(typeof node === 'object', 'canonical JSON requires JSON values only');
    demand(!active.has(node), 'canonical JSON cannot contain cycles');
    demand(Array.isArray(node) || Object.getPrototypeOf(node) === Object.prototype || Object.getPrototypeOf(node) === null, 'canonical JSON requires plain objects');
    active.add(node);
    let result;
    if (Array.isArray(node)) {
      demand(Object.keys(node).length === node.length, 'canonical JSON cannot contain sparse arrays or array properties');
      result = '[' + node.map(visit).join(',') + ']';
    } else result = '{' + Object.keys(node).sort().map(key => JSON.stringify(key) + ':' + visit(node[key])).join(',') + '}';
    active.delete(node);
    return result;
  }
  return visit(value);
}

/** Browser/Node WebCrypto; source text must be exact UTF-8 bytes, not reserialized JS. */
export async function sha256Bytes(value) {
  let bytes;
  if (typeof value === 'string') bytes = new TextEncoder().encode(value);
  else if (value instanceof Uint8Array) bytes = value.slice();
  else if (value instanceof ArrayBuffer) bytes = new Uint8Array(value.slice(0));
  else throw new Error('source bytes must be a string, Uint8Array or ArrayBuffer');
  demand(globalThis.crypto?.subtle, 'WebCrypto SHA-256 is required; use a secure browser context or current Node');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
export const fingerprintJSON = value => sha256Bytes(canonicalJSON(value));

/** Removes identifiers/timing/seed decorations, not authored action/response content.
 * This catches common renamed/phase-only copies; semantic distinctness still needs review.
 */
export function semanticDefinition(programDefinition) {
  canonicalJSON(programDefinition);
  const visit = value => Array.isArray(value) ? value.map(visit)
    : isObject(value) ? Object.fromEntries(Object.keys(value).filter(key => !nonSemanticKeys.has(key)).map(key => [key, visit(value[key])]))
    : value;
  return visit(programDefinition);
}
export const programDefinitionFingerprint = definition => fingerprintJSON(definition);
export const semanticDefinitionFingerprint = definition => fingerprintJSON(semanticDefinition(definition));

function validateSourceRef(ref) {
  demand(isObject(ref) && isText(ref.path) && isHash(ref.sha256), 'each source needs a path and SHA-256');
  return {path: ref.path, sha256: ref.sha256};
}
export function programSourceManifest(program) {
  demand(isText(program.programSourcePath) && isHash(program.programSourceSha256), 'program source path and SHA-256 required');
  demand(program.sourceDependencies === undefined || Array.isArray(program.sourceDependencies), 'sourceDependencies must be an array');
  const refs = [{path: program.programSourcePath, sha256: program.programSourceSha256}, ...(program.sourceDependencies || []).map(validateSourceRef)];
  demand(new Set(refs.map(ref => ref.path)).size === refs.length, 'source manifest paths must be unique');
  return refs.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
}
export const sourceBundleFingerprint = program => fingerprintJSON(programSourceManifest(program));

/** Exact binding is shared by the measurement harness and validator. No bake SHA. */
export async function liveQABinding(program, character, partner, role) {
  demand(role === 'A' || role === 'B', 'QA role must be A or B');
  return {
    programId: program.programId,
    semanticMotionId: program.semanticMotionId,
    programSourceSha256: program.programSourceSha256,
    sourceBundleFingerprint: await sourceBundleFingerprint(program),
    programDefinitionHash: program.programDefinitionHash,
    sourceRevision: program.sourceRevision,
    characterId: character.id,
    partnerId: partner.id,
    restFingerprint: character.restFingerprint,
    partnerRestFingerprint: partner.restFingerprint,
    role,
    fps: program.fps,
    durationSeconds: program.durationSeconds,
    executionConfigFingerprint: await fingerprintJSON(program.executionConfig || {}),
  };
}

/** Hash the ENTIRE measured record except its own digest; does not create evidence. */
export function numericQAFingerprint(record) {
  const body = {...record};
  delete body.numericQaFingerprint;
  return fingerprintJSON(body);
}
function rejectPhaseOffsets(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['phaseOffset', 'startPhase', 'randomPhase'].includes(key)) {
      demand(child === 0 || child === false, 'random or nonzero phase offsets are forbidden inside program definitions');
    }
    rejectPhaseOffsets(child);
  }
}
function rejectOfflineFields(value, location) {
  for (const field of offlineFields) demand(!own(value, field), `${location}: offline ${field} is forbidden in a live-program record`);
}
function reviewAllowed(program, mode, bundleFingerprint) {
  demand(isText(program.qualityStatus), 'explicit qualityStatus required');
  const evidence = program.semanticReviewEvidence;
  demand(isObject(evidence), 'structured semantic review evidence required');
  demand(evidence.programDefinitionHash === program.programDefinitionHash && evidence.programSourceSha256 === program.programSourceSha256
    && evidence.sourceBundleFingerprint === bundleFingerprint && evidence.sourceRevision === program.sourceRevision,
    'semantic review evidence does not match the program source/definition/bundle/revision');
  demand(isText(evidence.evidenceRef) && isText(evidence.distinctnessRationale), 'semantic evidence reference and distinctness rationale required');
  const reviewed = program.qualityStatus === 'reviewed' && evidence.status === 'reviewed' && isText(evidence.reviewedBy);
  if (mode === 'production') demand(reviewed, 'production requires reviewed quality and semantic review evidence');
  else {
    demand(['reviewed', 'candidate', 'numeric-reviewed', 'numeric-review-pending', 'visual-review-required'].includes(program.qualityStatus), 'unsupported candidate qualityStatus');
    demand(evidence.status === 'reviewed' || evidence.status === 'pending', 'candidate semantic evidence must be reviewed or pending');
    if (evidence.status === 'reviewed') demand(isText(evidence.reviewedBy), 'reviewed semantic evidence needs reviewedBy');
  }
  return reviewed;
}
function validateMetrics(record) {
  demand(record.schema === LIVE_QA_SCHEMA && record.kind === 'measured-live-program', 'measured live-program QA record required');
  demand(record.status === 'passed', 'numeric QA must have actually passed before scheduling');
  demand(isText(record.evidenceRef) && isHash(record.harnessSha256) && isText(record.runId), 'numeric QA needs evidence, run ID and harness SHA-256');
  demand(isText(record.measuredAt) && Number.isFinite(Date.parse(record.measuredAt)), 'numeric QA measurement timestamp required');
  demand(isObject(record.metrics) && Object.keys(record.metrics).length >= 2, 'numeric QA requires finite measurements, not status labels');
  demand(Object.values(record.metrics).every(value => typeof value === 'number' && Number.isFinite(value)), 'all numeric QA metrics must be finite numbers');
  demand(record.metrics.finiteFailureCount === 0, 'numeric QA contains non-finite motion samples');
  demand(Array.isArray(record.checks) && record.checks.length > 0, 'numeric QA requires explicit measured thresholds');
  const seen = new Set();
  for (const check of record.checks) {
    demand(isObject(check) && isText(check.metric) && own(record.metrics, check.metric), 'numeric QA check references an absent metric');
    demand(!seen.has(check.metric), 'duplicate numeric QA checks are not allowed'); seen.add(check.metric);
    demand(own(check, 'min') || own(check, 'max'), 'numeric QA check requires a min or max');
    for (const bound of ['min', 'max']) if (own(check, bound)) demand(Number.isFinite(check[bound]), 'numeric QA thresholds must be finite');
    if (own(check, 'min') && own(check, 'max')) demand(check.min <= check.max, 'numeric QA threshold interval is inverted');
    const value = record.metrics[check.metric];
    demand((!own(check, 'min') || value >= check.min) && (!own(check, 'max') || value <= check.max), `numeric QA threshold failed: ${check.metric}`);
  }
  demand(record.checks.some(check => check.metric === 'finiteFailureCount' && check.max === 0), 'finiteFailureCount <= 0 must be explicitly checked');
  demand(Number.isFinite(record.sampleFps) && record.sampleFps > 0 && typeof record.includesEndpoint === 'boolean', 'numeric QA sample FPS and endpoint convention required');
  const intervals = record.binding.durationSeconds * record.sampleFps;
  demand(Number.isSafeInteger(intervals), 'numeric QA duration must contain an integral sample interval count');
  if (own(record.metrics, 'sampleCount')) demand(record.metrics.sampleCount === record.sampleCount, 'metric sampleCount contradicts measurement coverage');
  demand(record.sampleCount === intervals + (record.includesEndpoint ? 1 : 0) && record.sampleCount >= 2,
    'numeric QA sample count must cover the entire shared program duration at its declared sample FPS');
}
function cloneAndFreeze(value) {
  const clone = JSON.parse(canonicalJSON(value));
  const freeze = object => { if (object && typeof object === 'object') { Object.values(object).forEach(freeze); Object.freeze(object); } return object; };
  return freeze(clone);
}

/**
 * Validates all selected programs for BOTH roles of ALL fixed pairs before round 0.
 * sourceFiles: { [sourcePath]: exact string/Uint8Array/ArrayBuffer }, supplied by host.
 * sourceFiles is read only: this validator never fetches, evaluates or imports code.
 * mode:'validation' permits explicit review-pending candidates; never publishable.
 * allowSyntheticFixtures is an independent, boolean opt-in even in validation mode.
 */
export async function validateLiveProgramInventory(library, characters, {
  arenaCount = 18, mode = 'production', allowSyntheticFixtures = false, sourceFiles,
} = {}) {
  demand(Number.isSafeInteger(arenaCount) && arenaCount >= 18, 'at least 18 arenas are required for this comparison protocol');
  demand(mode === 'production' || mode === 'validation', 'mode must be production or validation');
  demand(typeof allowSyntheticFixtures === 'boolean', 'fixture override must be boolean');
  demand(Array.isArray(characters) && characters.length === arenaCount * 2, 'exactly two characters per fixed arena required');
  demand(characters.every(character => isObject(character) && isText(character.id) && isHash(character.restFingerprint)), 'character ID and shape-specific rest fingerprint required');
  demand(new Set(characters.map(character => character.id)).size === characters.length, 'unique character IDs required');
  demand(Array.isArray(library) && library.length >= arenaCount, `at least ${arenaCount} live programs required; have ${library?.length ?? 0}`);
  demand(isObject(sourceFiles), 'actual sourceFiles bytes are required to verify source fingerprints');
  // Clone synchronously before the first await: callers cannot mutate QA while it is being checked.
  const snapshot = cloneAndFreeze({library, characters});
  const programs = snapshot.library;
  const cast = snapshot.characters;
  const ids = new Set(), semanticIds = new Set(), definitions = new Set(), semantics = new Set();
  const sourceDigests = new Map();
  const sourceBytes = new Map();
  for (const [path, bytes] of Object.entries(sourceFiles)) {
    if (typeof bytes === 'string') sourceBytes.set(path, bytes);
    else if (bytes instanceof Uint8Array) sourceBytes.set(path, bytes.slice());
    else if (bytes instanceof ArrayBuffer) sourceBytes.set(path, bytes.slice(0));
    else throw new Error('sourceFiles values must be exact source bytes');
  }
  let allReviewed = true, fixtureCount = 0, qaCount = 0;
  for (const program of programs) {
    demand(isObject(program) && program.schema === LIVE_PROGRAM_SCHEMA, 'explicit live-program schema required');
    rejectOfflineFields(program, 'program');
    demand(isText(program.programId) && !ids.has(program.programId), 'unique live programId required'); ids.add(program.programId);
    demand(isText(program.semanticMotionId) && !semanticIds.has(program.semanticMotionId), 'unique semanticMotionId required; phase/seed variants do not count'); semanticIds.add(program.semanticMotionId);
    demand(isHash(program.programDefinitionHash) && isObject(program.programDefinition), 'program definition and content hash required');
    rejectPhaseOffsets(program.programDefinition);
    demand(await programDefinitionFingerprint(program.programDefinition) === program.programDefinitionHash, 'program definition changed; recompute and re-review before scheduling');
    demand(!definitions.has(program.programDefinitionHash), 'renaming the same program definition is not action diversity'); definitions.add(program.programDefinitionHash);
    const semanticHash = await semanticDefinitionFingerprint(program.programDefinition);
    demand(canonicalJSON(semanticDefinition(program.programDefinition)) !== '{}', 'program must contain authored semantic content');
    demand(!semantics.has(semanticHash), 'phase/seed/timing/identifier-only variants are not distinct semantic programs'); semantics.add(semanticHash);
    demand(isText(program.sourceRevision), 'source revision required');
    demand(program.source?.kind === 'self-authored-live-procedural' && program.source.neuralInferenceExecuted === false,
      'live procedural source must explicitly state no neural inference was executed');
    demand(program.actorCount === 2, 'a live comparison program must have exactly two roles');
    demand(Number.isFinite(program.fps) && program.fps > 0 && Number.isFinite(program.durationSeconds) && program.durationSeconds > 0,
      'shared program FPS and duration required');
    demand(Number.isSafeInteger(program.fps * program.durationSeconds), 'program duration must align to shared frame boundaries');
    for (const field of ['fps', 'durationSeconds']) if (own(program.programDefinition, field)) demand(program.programDefinition[field] === program[field], 'program timing must match its authored definition');
    demand(program.redistributionApproved === true, 'program code/assets rights approval required');
    demand(program.testFixture === undefined || typeof program.testFixture === 'boolean', 'testFixture must be boolean');
    if (program.testFixture) { demand(allowSyntheticFixtures, 'synthetic test fixtures are not a production program inventory'); fixtureCount++; }
    demand(program.phaseOffset === undefined || program.phaseOffset === 0, 'random or nonzero phase offsets are forbidden');
    demand(program.speed === undefined || program.speed === 1, 'per-program speed offsets are forbidden in the comparison clock');
    allReviewed = reviewAllowed(program, mode, await sourceBundleFingerprint(program)) && allReviewed;
    for (const ref of programSourceManifest(program)) {
      demand(sourceBytes.has(ref.path), `actual source bytes missing: ${ref.path}`);
      if (!sourceDigests.has(ref.path)) sourceDigests.set(ref.path, await sha256Bytes(sourceBytes.get(ref.path)));
      demand(sourceDigests.get(ref.path) === ref.sha256, `program source changed; rerun review and numeric QA: ${ref.path}`);
    }
    demand(Array.isArray(program.numericQA), 'per-character/partner/role numeric QA records required');
    const records = new Map();
    for (const record of program.numericQA) {
      demand(isObject(record) && isObject(record.binding), 'numeric QA binding required');
      rejectOfflineFields(record, 'numeric QA');
      const key = canonicalJSON([record.binding.characterId, record.binding.partnerId, record.binding.role]);
      demand(!records.has(key), 'duplicate numeric QA binding'); records.set(key, record);
    }
    demand(records.size === cast.length * 2, 'numeric QA must cover each fixed-pair character in both A/B roles exactly');
    const bundle = await sourceBundleFingerprint(program);
    const executionConfig = await fingerprintJSON(program.executionConfig || {});
    for (let index = 0; index < cast.length; index++) {
      const character = cast[index], partner = cast[index ^ 1];
      for (const role of ['A', 'B']) {
        const key = canonicalJSON([character.id, partner.id, role]);
        const record = records.get(key);
        demand(record, `measured numeric QA missing: ${program.programId}/${character.id}/${partner.id}/${role}`);
        const expected = {programId: program.programId, semanticMotionId: program.semanticMotionId,
          programSourceSha256: program.programSourceSha256, sourceBundleFingerprint: bundle,
          programDefinitionHash: program.programDefinitionHash, sourceRevision: program.sourceRevision,
          characterId: character.id, partnerId: partner.id, restFingerprint: character.restFingerprint,
          partnerRestFingerprint: partner.restFingerprint, role, fps: program.fps, durationSeconds: program.durationSeconds,
          executionConfigFingerprint: executionConfig};
        demand(canonicalJSON(record.binding) === canonicalJSON(expected), 'program/source/revision/config/target/partner/role binding changed; repeat measured numeric QA');
        demand(record.testFixture === undefined || typeof record.testFixture === 'boolean', 'QA testFixture must be boolean');
        if (record.testFixture) { demand(allowSyntheticFixtures, 'synthetic numeric QA cannot stand in for measured production evidence'); fixtureCount++; }
        validateMetrics(record);
        demand(isHash(record.numericQaFingerprint) && await numericQAFingerprint(record) === record.numericQaFingerprint,
          'numeric QA fingerprint mismatch; measurements or evidence changed');
        qaCount++;
      }
    }
  }
  return cloneAndFreeze({schema: 'kaopu-live-program-inventory-validation/1', mode, arenaCount,
    validationOnly: mode === 'validation' || fixtureCount > 0, canPublish: mode === 'production' && fixtureCount === 0 && allReviewed,
    allReviewed, fixtureCount, distinctSemanticPrograms: programs.length, measuredQABindings: qaCount,
    sourceManifest: Array.from(sourceDigests, ([path, sha256]) => ({path, sha256})),
    library: programs, characters: cast});
}

/** Round n selects (arena+n)%18; rounds 18..35 exchange A/B without re-pairing. */
export async function createLiveComparisonRound(library, characters, round, options = {}) {
  demand(Number.isSafeInteger(round) && round >= 0, 'nonnegative safe-integer round required');
  const comparisonMode = options.comparisonMode || 'diverse-round';
  demand(comparisonMode === 'diverse-round' || comparisonMode === 'same-program', 'unknown comparisonMode');
  const checked = await validateLiveProgramInventory(library, characters, options);
  const {arenaCount} = checked, programs = checked.library.slice(0, arenaCount);
  const rolePass = Math.floor(round / arenaCount) % 2;
  let selected;
  if (comparisonMode === 'same-program') {
    demand(isText(options.selectedProgramId), 'same-program comparison needs selectedProgramId');
    selected = checked.library.find(program => program.programId === options.selectedProgramId);
    demand(selected, 'selectedProgramId is absent from the validated inventory');
  } else demand(options.selectedProgramId === undefined, 'selectedProgramId is only meaningful in same-program mode');
  const arenas = [];
  for (let arenaIndex = 0; arenaIndex < arenaCount; arenaIndex++) {
    const program = selected || programs[(arenaIndex + (round % arenaCount)) % arenaCount];
    const pair = checked.characters.slice(arenaIndex * 2, arenaIndex * 2 + 2);
    const clockId = comparisonMode === 'same-program' ? 'global-comparison-clock' : `pair-${arenaIndex}-clock`;
    const actors = pair.map((character, index) => {
      const partner = pair[1 - index], role = (index ^ rolePass) === 0 ? 'A' : 'B';
      const evidence = program.numericQA.find(record => record.binding.characterId === character.id && record.binding.partnerId === partner.id && record.binding.role === role);
      return {characterId: character.id, partnerId: partner.id, restFingerprint: character.restFingerprint,
        partnerRestFingerprint: partner.restFingerprint, role, clockId,
        numericQaFingerprint: evidence.numericQaFingerprint, numericQAEvidenceRef: evidence.evidenceRef};
    });
    arenas.push({arenaIndex, programId: program.programId, semanticMotionId: program.semanticMotionId,
      programDefinitionHash: program.programDefinitionHash, programSourceSha256: program.programSourceSha256,
      sourceBundleFingerprint: await sourceBundleFingerprint(program), sourceRevision: program.sourceRevision,
      source: program.source, executionConfig: program.executionConfig || {}, qualityStatus: program.qualityStatus,
      clock: {id: clockId, startSeconds: 0, fps: program.fps, durationSeconds: program.durationSeconds, speed: 1, phaseOffset: 0, loop: false}, actors});
  }
  return cloneAndFreeze({schema: LIVE_SCHEDULE_SCHEMA, inventoryKind: 'live-procedural-programs',
    round, rolePass, arenaCount, comparisonMode, selectedProgramId: selected?.programId || null,
    validationOnly: checked.validationOnly, canPublish: checked.canPublish,
    productionReady: checked.canPublish, neuralInferenceExecuted: false,
    distinctSemanticProgramsInInventory: checked.distinctSemanticPrograms,
    distinctSemanticProgramsThisRound: selected ? 1 : arenaCount,
    globalClock: selected ? arenas[0].clock : null,
    frameSynchronization: 'one shared clock per fixed pair; same-program mode uses one global clock; no phase or speed offsets',
    evidenceMeaning: 'measured live-evaluation QA; no offline clip or native packet bake is claimed', arenas});
}
