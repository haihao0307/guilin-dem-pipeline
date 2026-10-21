import assert from 'node:assert/strict';

export function classify(e) {
  if (!e.sourceBound || !e.viewportBound || !e.gestureTraceBound || !e.glErrorZero)
    return 'INVALID_EVIDENCE';
  if (!e.samplingWidthConstant)
    return 'RESOLUTION_SWITCH_PRESENT';
  const visibleMotion = e.actualPresentedFramesObserved && e.duringGesturePresentCount > 0;
  const clarityEquivalent = visibleMotion && e.perFrameCameraBound &&
    e.sameCameraSettledReference && e.clarityEqualityPassed;
  const responsive = e.latencyBoundDefined && e.latencyBoundPassed;
  const releaseSafe = e.releaseLatestIntentBound && e.noStalePresentationAfterRelease;
  if (clarityEquivalent && e.realDevice && responsive)
    return 'MOTION_CLARITY_AND_RESPONSIVENESS_VERIFIED_SCOPED';
  if (clarityEquivalent && !e.realDevice)
    return 'EMULATED_MOTION_CLARITY_VERIFIED_SCOPED__REAL_DEVICE_UNKNOWN';
  if (visibleMotion)
    return 'VISIBLE_MOTION_FRAMES_OBSERVED__CLARITY_EQUIVALENCE_UNPROVEN';
  if (releaseSafe)
    return 'STALE_RELEASE_PREEMPTION_VERIFIED__ZERO_MOTION_FRAMES_OBSERVED';
  return 'SAMPLING_POLICY_VERIFIED__VISIBLE_MOTION_CLARITY_UNPROVEN';
}

const current336 = {
  sourceBound: true,
  viewportBound: true,
  gestureTraceBound: true,
  glErrorZero: true,
  samplingWidthConstant: true,
  actualPresentedFramesObserved: false,
  duringGesturePresentCount: 0,
  perFrameCameraBound: false,
  sameCameraSettledReference: false,
  clarityEqualityPassed: false,
  latencyBoundDefined: false,
  latencyBoundPassed: false,
  releaseLatestIntentBound: false,
  noStalePresentationAfterRelease: false,
  realDevice: false
};

const emulatedComplete = {
  ...current336,
  actualPresentedFramesObserved: true,
  duringGesturePresentCount: 4,
  perFrameCameraBound: true,
  sameCameraSettledReference: true,
  clarityEqualityPassed: true
};

const public336 = {
  ...current336,
  actualPresentedFramesObserved: true,
  duringGesturePresentCount: 0,
  releaseLatestIntentBound: true,
  noStalePresentationAfterRelease: true
};

const cases = [
  [current336, 'SAMPLING_POLICY_VERIFIED__VISIBLE_MOTION_CLARITY_UNPROVEN'],
  [public336, 'STALE_RELEASE_PREEMPTION_VERIFIED__ZERO_MOTION_FRAMES_OBSERVED'],
  [{...current336, actualPresentedFramesObserved: true, duringGesturePresentCount: 3}, 'VISIBLE_MOTION_FRAMES_OBSERVED__CLARITY_EQUIVALENCE_UNPROVEN'],
  [emulatedComplete, 'EMULATED_MOTION_CLARITY_VERIFIED_SCOPED__REAL_DEVICE_UNKNOWN'],
  [{...emulatedComplete, realDevice: true, latencyBoundDefined: true, latencyBoundPassed: true}, 'MOTION_CLARITY_AND_RESPONSIVENESS_VERIFIED_SCOPED'],
  [{...current336, samplingWidthConstant: false}, 'RESOLUTION_SWITCH_PRESENT'],
  [{...current336, sourceBound: false}, 'INVALID_EVIDENCE'],
  [{...current336, viewportBound: false}, 'INVALID_EVIDENCE'],
  [{...current336, gestureTraceBound: false}, 'INVALID_EVIDENCE'],
  [{...current336, glErrorZero: false}, 'INVALID_EVIDENCE'],
  [{...emulatedComplete, clarityEqualityPassed: false}, 'VISIBLE_MOTION_FRAMES_OBSERVED__CLARITY_EQUIVALENCE_UNPROVEN']
];

for (const [fixture, expected] of cases) assert.equal(classify(fixture), expected);
console.log(JSON.stringify({passed: cases.length, total: cases.length}));
