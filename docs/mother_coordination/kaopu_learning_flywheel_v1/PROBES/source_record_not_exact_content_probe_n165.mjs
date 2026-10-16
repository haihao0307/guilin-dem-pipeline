import fs from 'node:fs';
import assert from 'node:assert/strict';

const fixture = JSON.parse(fs.readFileSync(new URL('./source_record_not_exact_content_n165.json', import.meta.url)));

export function classify(input) {
  if (!input.sourceRecordBound) return 'HOLD_SOURCE_RECORD_UNBOUND';
  if (!input.contentBytesAcquired || !input.contentIdentityBound) {
    return 'SOURCE_RECORD_FOUND__HOLD_CONTENT_BYTES_UNBOUND';
  }
  if (!input.targetSpanLocated) return 'CONTENT_BYTES_ACQUIRED__HOLD_TARGET_SPAN_UNLOCATED';
  if (!input.targetMatchesRequestedSubject) {
    return 'TARGET_SPAN_LOCATED__HOLD_REQUESTED_SUBJECT_UNBOUND';
  }
  if (!input.originalContentCrossChecked) {
    return 'TARGET_SPAN_LOCATED__HOLD_TRANSCRIPTION_OR_FRAME_VERIFICATION';
  }
  return 'EXACT_CONTENT_VERIFIED_SCOPED';
}

const complete = {
  sourceRecordBound: true,
  contentBytesAcquired: true,
  contentIdentityBound: true,
  targetSpanLocated: true,
  targetMatchesRequestedSubject: true,
  originalContentCrossChecked: true
};

const cases = [
  ['no source record identity', {...complete, sourceRecordBound: false}, 'HOLD_SOURCE_RECORD_UNBOUND'],
  ['current correction: gazette bibliographic record or contents only', fixture.documentObservation, fixture.expectedDocumentState],
  ['current correction: archive program or mission record without exact frame', fixture.aerialObservation, fixture.expectedAerialState],
  ['downloaded book or contact sheet but target page or frame is not located', {...complete, targetSpanLocated: false}, 'CONTENT_BYTES_ACQUIRED__HOLD_TARGET_SPAN_UNLOCATED'],
  ['located page or frame belongs to wrong subject edition date or coverage', {...complete, targetMatchesRequestedSubject: false}, 'TARGET_SPAN_LOCATED__HOLD_REQUESTED_SUBJECT_UNBOUND'],
  ['OCR snippet or inferred coverage is not checked against original object', {...complete, originalContentCrossChecked: false}, 'TARGET_SPAN_LOCATED__HOLD_TRANSCRIPTION_OR_FRAME_VERIFICATION'],
  ['exact page scan and target passage cross-checked', {...complete, objectKind: 'document_page'}, 'EXACT_CONTENT_VERIFIED_SCOPED'],
  ['exact aerial frame and requested-location coverage cross-checked', {...complete, objectKind: 'aerial_frame'}, 'EXACT_CONTENT_VERIFIED_SCOPED']
];

const results = cases.map(([name, input, expected]) => {
  const actual = classify(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: true};
});

const output = {
  schema: 'kaopu/source-record-content-result@1',
  fixture: 'source_record_not_exact_content_n165.json',
  passed: results.length,
  total: results.length,
  observedDocumentState: classify(fixture.documentObservation),
  observedAerialState: classify(fixture.aerialObservation),
  claimBoundary: {
    sourceRecordExistence: 'OBSERVED_SCOPED',
    exactGazetteBodyText: 'UNVERIFIED',
    exactAerialFrame: 'UNVERIFIED',
    requestedLocationCoverage: 'UNVERIFIED',
    finalResearchCompletion: 'NOT_CLAIMED'
  },
  results
};

fs.writeFileSync(new URL('./source_record_not_exact_content_result_n165.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
