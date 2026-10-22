import fs from 'node:fs';
import assert from 'node:assert/strict';

export function classify(e) {
  if (e.generationClaim && e.fallbackTriggered && !e.fallbackDisclosed) return 'SILENT_FALLBACK__REJECT';
  if (!e.generationClaim) {
    if (e.sceneAdaptation) return 'SCENE_ADAPTED_EXECUTION_ONLY__HOLD';
    return 'REFERENCE_PLAYBACK_ONLY__HOLD';
  }
  if (e.behaviorSelector && e.fixedMotionSource && !e.sceneAdaptation) return 'BEHAVIOR_SELECTION_ONLY__HOLD';
  if (e.sceneAdaptation && (!e.heldOutVariations || e.heldOutVariations < 1)) return 'SCENE_ADAPTED_EXECUTION_ONLY__HOLD';
  const provenance = e.controllerArtifactSha && e.humanArtifactSha && e.sceneFamilySha;
  const generated = e.sameController && e.trajectoryGenerated && e.heldOutVariations > 0;
  const metrics = e.metrics && ['taskCompletion','collisionPass','footSlipPass','contactPass','custodyPass'].every(k => e.metrics[k] === true);
  if (!provenance || !generated || !e.independentVerifier || !metrics) return 'GENERATION_EVIDENCE_INCOMPLETE__HOLD';
  return 'GENERATION_CANDIDATE_VERIFIED_SCOPED';
}

const file = new URL('./n181_environment_conditioned_motion_generation_regression.json', import.meta.url);
const suite = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const item of suite.cases) assert.equal(classify(item.evidence), item.expected, item.id);
console.log(`PASS ${suite.cases.length}/${suite.cases.length} ${suite.regressionId}`);
