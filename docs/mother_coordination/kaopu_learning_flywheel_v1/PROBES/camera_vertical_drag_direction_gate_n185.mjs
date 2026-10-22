import fs from 'node:fs';

export function classify(c) {
  if (!c.browserTrace) return 'HOLD_BROWSER_TRACE_MISSING';
  if (!c.diagnosticStartPose) return 'HOLD_NON_DIAGNOSTIC_START_POSE';
  if (c.mouseVerticalResponse !== c.touchVerticalResponse) return 'REJECT_INPUT_MODALITY_MISMATCH';
  if (c.mouseVerticalResponse !== 'INVERTED') return 'REJECT_VERTICAL_DIRECTION_NOT_REVERSED';
  if (!c.horizontalInvariant) return 'REJECT_HORIZONTAL_COLLATERAL_CHANGE';
  if (!c.presetInvariant) return 'REJECT_CAMERA_PRESET_REGRESSION';
  if (!c.independentVerifier) return 'HOLD_INDEPENDENT_VERIFIER_MISSING';
  return 'CAMERA_VERTICAL_DIRECTION_PROBE_PASSED';
}

const fixturePath = new URL('./camera_vertical_drag_direction_fixture_n185.json', import.meta.url);
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const results = fixture.cases.map(c => ({ id: c.id, expected: c.expected, actual: classify(c), pass: c.expected === classify(c) }));
const output = { probe: 'N185_CAMERA_VERTICAL_DRAG_DIRECTION', passed: results.filter(r => r.pass).length, total: results.length, results };
console.log(JSON.stringify(output, null, 2));
if (output.passed !== output.total) process.exitCode = 1;

