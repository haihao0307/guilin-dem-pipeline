import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./capability_promise_preflight_n164.json', import.meta.url)));

export function classify(input) {
  if (!input.inputBound) return 'HOLD_EXACT_INPUT_UNBOUND';
  if (!input.exactInputReadProbePassed) return 'INPUT_BOUND__HOLD_INPUT_READ_UNVERIFIED';
  if (!input.callableInputAudioTranscriberFound || !input.transcriptionProbePassed || !input.outputBoundToExactInput) {
    return 'INPUT_READ_VERIFIED__HOLD_TRANSCRIPTION_ROUTE_UNVERIFIED';
  }
  if (!input.negativeControlPassed) return 'TRANSCRIPTION_ROUTE_EXECUTED__HOLD_NEGATIVE_CONTROL_UNVERIFIED';
  if (input.taskScope !== 'generic_transcription' && (!input.scopeQualityCriterionFrozen || !input.scopeQualityEvalPassed)) {
    return 'GENERIC_TRANSCRIPTION_EXECUTABLE__HOLD_TASK_SCOPE_QUALITY_UNVERIFIED';
  }
  return 'SCOPED_CAPABILITY_ROUTE_VERIFIED';
}

const current = fixture.currentRuntimeObservation;
const complete = {
  inputBound: true,
  exactInputReadProbePassed: true,
  callableInputAudioTranscriberFound: true,
  transcriptionProbePassed: true,
  outputBoundToExactInput: true,
  negativeControlPassed: true,
  taskScope: 'dialect_transcription',
  scopeQualityCriterionFrozen: true,
  scopeQualityEvalPassed: true
};

const cases = [
  ['no exact audio subject', {...complete, inputBound: false}, 'HOLD_EXACT_INPUT_UNBOUND'],
  ['current user correction: attachment exists but exact read is unverified', current, fixture.expectedState],
  ['file bytes readable but only output-audio capability is exposed', {...complete, callableInputAudioTranscriberFound: false, transcriptionProbePassed: false, outputBoundToExactInput: false}, 'INPUT_READ_VERIFIED__HOLD_TRANSCRIPTION_ROUTE_UNVERIFIED'],
  ['model family documentation mentions audio but current route was not executed', {...complete, transcriptionProbePassed: false, outputBoundToExactInput: false}, 'INPUT_READ_VERIFIED__HOLD_TRANSCRIPTION_ROUTE_UNVERIFIED'],
  ['transcriber returns text not bound to exact input digest', {...complete, outputBoundToExactInput: false}, 'INPUT_READ_VERIFIED__HOLD_TRANSCRIPTION_ROUTE_UNVERIFIED'],
  ['generic transcription works but Yunnan-dialect quality is unmeasured', {...complete, scopeQualityCriterionFrozen: false, scopeQualityEvalPassed: false}, 'GENERIC_TRANSCRIPTION_EXECUTABLE__HOLD_TASK_SCOPE_QUALITY_UNVERIFIED'],
  ['audio plus draft transcript cannot be corrected against audio without scoped quality validation', {...complete, taskScope: 'audio_text_correction', scopeQualityEvalPassed: false}, 'GENERIC_TRANSCRIPTION_EXECUTABLE__HOLD_TASK_SCOPE_QUALITY_UNVERIFIED'],
  ['silent or corrupt negative control is not rejected', {...complete, negativeControlPassed: false}, 'TRANSCRIPTION_ROUTE_EXECUTED__HOLD_NEGATIVE_CONTROL_UNVERIFIED'],
  ['exact input, executed route, negative control and scoped dialect eval', complete, 'SCOPED_CAPABILITY_ROUTE_VERIFIED']
];

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/capability-promise-preflight-result@1',
  fixture: 'capability_promise_preflight_n164.json',
  passed: results.length,
  total: results.length,
  currentState: classify(current),
  claimBoundary: {
    textEditingWithoutAudio: 'AVAILABLE_BUT_NOT_AUDIO_CORRECTION',
    exactAudioRead: 'UNVERIFIED',
    genericTranscription: 'UNVERIFIED',
    yunnanDialectQuality: 'UNKNOWN',
    finalTranscriptAccuracy: 'NOT_CLAIMED'
  },
  results
};

fs.writeFileSync(new URL('./capability_promise_preflight_result_n164.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
