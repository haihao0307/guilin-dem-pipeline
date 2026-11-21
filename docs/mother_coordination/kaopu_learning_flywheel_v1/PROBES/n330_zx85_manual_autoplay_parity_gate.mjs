import assert from 'node:assert/strict';
import fs from 'node:fs';

const candidatePath = new URL('../REGRESSION_CASES/CANDIDATE_ZX85_CONTROL_MAPPING_001_N321.json', import.meta.url);
const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'));
const contract = candidate.dualControlModeContract;

function unique(values) {
  return [...new Set(values)];
}

function exactSetDiff(expected, observed) {
  return {
    missing: expected.filter((x) => !observed.includes(x)),
    extra: observed.filter((x) => !expected.includes(x))
  };
}

function validate(authority, receipt) {
  const holds = [];
  if (!authority?.sourceHead || !authority?.artifactDigest || !authority?.actionMappingDigest || !authority?.behaviorGraphDigest) {
    return ['HOLD_CONTROL_MODE_SUBJECT_MISMATCH'];
  }

  const expectedModes = authority.requiredModeIds || [];
  const observedModes = (receipt.modes || []).map((x) => x.modeId);
  const modeDiff = exactSetDiff(expectedModes, observedModes);
  if (modeDiff.missing.length > 0) holds.push('HOLD_CONTROL_MODE_COVERAGE_INCOMPLETE');
  if (modeDiff.extra.length > 0) holds.push('HOLD_CONTROL_MODE_UNANCHORED');

  if (
    receipt.sourceHead !== authority.sourceHead ||
    receipt.artifactDigest !== authority.artifactDigest ||
    receipt.actionMappingDigest !== authority.actionMappingDigest ||
    receipt.behaviorGraphDigest !== authority.behaviorGraphDigest
  ) holds.push('HOLD_CONTROL_MODE_SUBJECT_MISMATCH');

  for (const mode of receipt.modes || []) {
    const expectedActions = authority.expectedActionIdsByMode?.[mode.modeId];
    if (!expectedActions) continue;
    const observedActions = (mode.actionReceipts || []).map((x) => x.actionId);
    const actionDiff = exactSetDiff(expectedActions, observedActions);
    if (actionDiff.missing.length > 0 || actionDiff.extra.length > 0) {
      holds.push('HOLD_MANUAL_AUTOPLAY_ACTION_COVERAGE_MISMATCH');
    }
    if (mode.sourceHead !== authority.sourceHead || mode.artifactDigest !== authority.artifactDigest) {
      holds.push('HOLD_CONTROL_MODE_SUBJECT_MISMATCH');
    }
    if (mode.actionMappingDigest !== authority.actionMappingDigest || mode.behaviorGraphDigest !== authority.behaviorGraphDigest) {
      holds.push('HOLD_MANUAL_AUTOPLAY_BEHAVIOR_GRAPH_DIVERGED');
    }
  }

  const manual = (receipt.modes || []).find((x) => x.modeId === 'MANUAL_POINTER');
  if (manual) {
    const permitted = ['PHYSICAL_POINTER', 'WEBDRIVER_VIRTUAL_POINTER'];
    if (!permitted.includes(manual.inputProvenance)) holds.push('HOLD_MANUAL_POINTER_PATH_UNVERIFIED');
    if (manual.inputProvenance === 'WEBDRIVER_VIRTUAL_POINTER' && manual.webdriverActionReceipt !== true) {
      holds.push('HOLD_MANUAL_POINTER_PATH_UNVERIFIED');
    }
    if (manual.inputProvenance === 'PHYSICAL_POINTER' && manual.physicalDeviceReceipt !== true) {
      holds.push('HOLD_MANUAL_INPUT_ORIGIN_OVERCLAIM');
    }
    for (const action of manual.actionReceipts || []) {
      if (action.eventIsTrusted !== true) holds.push('HOLD_MANUAL_POINTER_EVENT_UNTRUSTED');
      if (!(action.pointerType === 'mouse' && Number.isInteger(action.pointerId) && action.pointerId >= 0)) {
        holds.push('HOLD_MANUAL_POINTER_PATH_UNVERIFIED');
      }
      if (!action.hitTargetId || action.hitTargetId !== action.declaredControlTargetId) {
        holds.push('HOLD_MANUAL_POINTER_TARGET_MISMATCH');
      }
      if (!(action.inputEventId && action.observableEventId && Number.isInteger(action.inputFrame) && Number.isInteger(action.observableFrame) && action.observableFrame > action.inputFrame)) {
        holds.push('HOLD_MANUAL_POINTER_PATH_UNVERIFIED');
      }
    }
  }

  const autoplay = (receipt.modes || []).find((x) => x.modeId === 'AUTO_SEQUENCE');
  if (autoplay) {
    if (!(autoplay.inputProvenance === 'AUTO_SEQUENCE_SCHEDULER' && autoplay.autoTriggerEventId && autoplay.triggerEventIsTrusted === true && autoplay.schedulerId && autoplay.schedulerTraceDigest)) {
      holds.push('HOLD_AUTOPLAY_TRIGGER_OR_SCHEDULER_MISSING');
    }
    if (autoplay.mediaSubstitute === true) holds.push('HOLD_AUTOPLAY_MEDIA_SUBSTITUTE');
  }

  const graphs = unique((receipt.modes || []).map((x) => x.behaviorGraphDigest));
  const mappings = unique((receipt.modes || []).map((x) => x.actionMappingDigest));
  if (graphs.length > 1 || mappings.length > 1) holds.push('HOLD_MANUAL_AUTOPLAY_BEHAVIOR_GRAPH_DIVERGED');

  return unique(holds);
}

const authority = {
  sourceHead: 'zx85-fresh-head-n330',
  artifactDigest: 'sha256:zx85-standalone-n330',
  actionMappingDigest: 'sha256:n321-source-bound-action-map',
  behaviorGraphDigest: 'sha256:shared-machine-behavior-graph',
  requiredModeIds: contract.requiredModeIds,
  expectedActionIdsByMode: contract.expectedActionIdsByMode
};

function actionReceipt(actionId, i) {
  return {
    actionId,
    eventIsTrusted: true,
    pointerType: 'mouse',
    pointerId: 1,
    hitTargetId: `control-${actionId}`,
    declaredControlTargetId: `control-${actionId}`,
    inputEventId: `pointer-${actionId}`,
    observableEventId: `motion-${actionId}`,
    inputFrame: i * 10 + 1,
    observableFrame: i * 10 + 2
  };
}

function modeReceipt(modeId) {
  const base = {
    modeId,
    sourceHead: authority.sourceHead,
    artifactDigest: authority.artifactDigest,
    actionMappingDigest: authority.actionMappingDigest,
    behaviorGraphDigest: authority.behaviorGraphDigest,
    actionReceipts: authority.expectedActionIdsByMode[modeId].map(actionReceipt)
  };
  if (modeId === 'MANUAL_POINTER') {
    return {...base, inputProvenance: 'WEBDRIVER_VIRTUAL_POINTER', webdriverActionReceipt: true};
  }
  return {
    ...base,
    inputProvenance: 'AUTO_SEQUENCE_SCHEDULER',
    autoTriggerEventId: 'pointer-auto-start',
    triggerEventIsTrusted: true,
    schedulerId: 'zx85-demo-sequencer',
    schedulerTraceDigest: 'sha256:auto-sequence-trace',
    mediaSubstitute: false
  };
}

const valid = {
  sourceHead: authority.sourceHead,
  artifactDigest: authority.artifactDigest,
  actionMappingDigest: authority.actionMappingDigest,
  behaviorGraphDigest: authority.behaviorGraphDigest,
  modes: [modeReceipt('MANUAL_POINTER'), modeReceipt('AUTO_SEQUENCE')]
};

const fixtures = [
  {name: 'manual pointer and autoplay share one behavior graph', mutate: (x) => x, expected: []},
  {name: 'autoplay cannot substitute for missing manual mode', mutate: (x) => { x.modes = x.modes.filter((m) => m.modeId !== 'MANUAL_POINTER'); return x; }, expected: ['HOLD_CONTROL_MODE_COVERAGE_INCOMPLETE']},
  {name: 'unanchored control mode is rejected', mutate: (x) => { x.modes.push({...modeReceipt('AUTO_SEQUENCE'), modeId: 'VIDEO_DEMO'}); return x; }, expected: ['HOLD_CONTROL_MODE_UNANCHORED']},
  {name: 'script-dispatched pointer events do not prove manual control', mutate: (x) => { const m = x.modes[0]; m.inputProvenance = 'SCRIPT_DISPATCH_UNTRUSTED'; m.webdriverActionReceipt = false; m.actionReceipts[0].eventIsTrusted = false; return x; }, expected: ['HOLD_MANUAL_POINTER_PATH_UNVERIFIED', 'HOLD_MANUAL_POINTER_EVENT_UNTRUSTED']},
  {name: 'webdriver virtual pointer cannot be claimed as physical human input', mutate: (x) => { const m = x.modes[0]; m.inputProvenance = 'PHYSICAL_POINTER'; m.webdriverActionReceipt = true; m.physicalDeviceReceipt = false; return x; }, expected: ['HOLD_MANUAL_INPUT_ORIGIN_OVERCLAIM']},
  {name: 'pointer must hit the declared machine control', mutate: (x) => { x.modes[0].actionReceipts[2].hitTargetId = 'camera-orbit-layer'; return x; }, expected: ['HOLD_MANUAL_POINTER_TARGET_MISMATCH']},
  {name: 'manual input needs later observable lineage', mutate: (x) => { delete x.modes[0].actionReceipts[4].observableEventId; return x; }, expected: ['HOLD_MANUAL_POINTER_PATH_UNVERIFIED']},
  {name: 'autoplay label without scheduler trace is rejected', mutate: (x) => { delete x.modes[1].schedulerTraceDigest; return x; }, expected: ['HOLD_AUTOPLAY_TRIGGER_OR_SCHEDULER_MISSING']},
  {name: 'prerecorded autoplay substitute is rejected', mutate: (x) => { x.modes[1].mediaSubstitute = true; return x; }, expected: ['HOLD_AUTOPLAY_MEDIA_SUBSTITUTE']},
  {name: 'manual and autoplay cannot use different behavior graphs', mutate: (x) => { x.modes[1].behaviorGraphDigest = 'sha256:different-demo-only-graph'; return x; }, expected: ['HOLD_MANUAL_AUTOPLAY_BEHAVIOR_GRAPH_DIVERGED']},
  {name: 'mode receipts must bind the exact artifact subject', mutate: (x) => { x.modes[0].sourceHead = 'old-head'; return x; }, expected: ['HOLD_CONTROL_MODE_SUBJECT_MISMATCH']},
  {name: 'producer cannot omit one manual control action', mutate: (x) => { x.modes[0].actionReceipts.pop(); return x; }, expected: ['HOLD_MANUAL_AUTOPLAY_ACTION_COVERAGE_MISMATCH']}
];

const results = [];
for (const fixture of fixtures) {
  const actual = validate(authority, fixture.mutate(structuredClone(valid)));
  assert.deepEqual(actual, fixture.expected, fixture.name);
  results.push({name: fixture.name, status: 'PASS', holds: actual});
}

console.log(JSON.stringify({
  probe: 'N330_ZX85_MANUAL_AUTOPLAY_PARITY_GATE',
  fixtureOnly: true,
  priorN329Replay: '19/19 PASS (inherited result)',
  passed: results.length,
  total: fixtures.length,
  results,
  productionBrowserReplayVerified: false,
  physicalHumanInputProvenanceVerified: false,
  teacherStatus: candidate.novelty.teacherStatus,
  teacherLifecycle: candidate.teacherAudition.lifecycle,
  decision: candidate.decision
}, null, 2));
