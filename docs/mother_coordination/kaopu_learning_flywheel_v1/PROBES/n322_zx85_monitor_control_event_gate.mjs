import assert from 'node:assert/strict';

const explicitEvents = {
  RETURN_PREVIOUS_PRESS: {effect: 'PREVIOUS_SCREEN', pages: [125]},
  RETURN_BASIC_PRESS: {effect: 'BASIC_SCREEN', pages: [125]},
  SELECTOR_PRESS_ON_BASIC: {effect: 'OPEN_MAIN_MENU', pages: [125, 98]},
  SELECTOR_PRESS_IN_MENU: {effect: 'CONFIRM_SELECTION', pages: [125]},
  SELECTOR_ROTATE_IN_MENU: {effect: 'MOVE_CURSOR', pages: [125]},
  BRIGHTNESS_ROTATE_CLOCKWISE: {effect: 'BRIGHTER', pages: [99]},
  BRIGHTNESS_ROTATE_COUNTERCLOCKWISE: {effect: 'DARKER', pages: [99]},
  WORK_LIGHT_POSITION_2: {effect: 'NIGHT_MODE_WITH_MARK_8', pages: [128, 99]},
  NUMERIC_KEY_0_WHILE_LIGHT_ON: {effect: 'DAYTIME_SCREEN_OVERRIDE', pages: [99]},
};

const sourceUnknowns = new Set([
  'WORK_LIGHT_POSITION_1_MONITOR_MODE',
  'WORK_LIGHT_OFF_MONITOR_MODE',
]);

const requiredBrightnessPath = [
  'SELECTOR_PRESS_ON_BASIC',
  'SELECTOR_ROTATE_TO_SETTING_MENU',
  'SELECTOR_PRESS_CONFIRM_SETTING_MENU',
  'SELECTOR_ROTATE_TO_BRIGHTNESS',
  'SELECTOR_PRESS_CONFIRM_BRIGHTNESS',
  'SELECTOR_ROTATE_ADJUST_BRIGHTNESS',
];

function validate(candidate) {
  const holds = [];
  for (const [event, expected] of Object.entries(explicitEvents)) {
    const observed = candidate.events[event];
    if (!observed?.sourcePdfPages?.length) {
      holds.push('HOLD_MONITOR_CONTROL_EVENT_SOURCE_MISSING');
      continue;
    }
    if (observed.effect !== expected.effect) {
      holds.push('HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH');
    }
  }

  if (candidate.brightnessPath.join('|') !== requiredBrightnessPath.join('|')) {
    holds.push('HOLD_MONITOR_BRIGHTNESS_PATH_MISMATCH');
  }
  if (candidate.dayBrightnessStateId === candidate.nightBrightnessStateId) {
    holds.push('HOLD_MONITOR_DAY_NIGHT_BRIGHTNESS_COLLAPSED');
  }
  for (const key of sourceUnknowns) {
    if (candidate.unknownTransitions[key] !== 'UNKNOWN') {
      holds.push('HOLD_MONITOR_LIGHT_POSITION_MODE_UNSUPPORTED');
    }
  }
  if (!candidate.replayReceipt?.sourceHead || !candidate.replayReceipt?.eventTrace) {
    holds.push('HOLD_MONITOR_CONTROL_EVENT_REPLAY_MISSING');
  }
  return [...new Set(holds)];
}

const valid = {
  events: Object.fromEntries(Object.entries(explicitEvents).map(([event, value]) => [event, {
    effect: value.effect,
    sourcePdfPages: value.pages,
  }])),
  brightnessPath: [...requiredBrightnessPath],
  dayBrightnessStateId: 'DAY_BRIGHTNESS',
  nightBrightnessStateId: 'NIGHT_BRIGHTNESS',
  unknownTransitions: {
    WORK_LIGHT_POSITION_1_MONITOR_MODE: 'UNKNOWN',
    WORK_LIGHT_OFF_MONITOR_MODE: 'UNKNOWN',
  },
  replayReceipt: {sourceHead: 'FIXTURE_HEAD', eventTrace: 'FIXTURE_TRACE'},
};

const fixtures = [
  {name: 'source-backed control matrix passes', mutate: (x) => x, expected: []},
  {name: 'selector rotate cannot confirm', mutate: (x) => { x.events.SELECTOR_ROTATE_IN_MENU.effect = 'CONFIRM_SELECTION'; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH']},
  {name: 'selector press cannot only move cursor', mutate: (x) => { x.events.SELECTOR_PRESS_IN_MENU.effect = 'MOVE_CURSOR'; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH']},
  {name: 'return basic cannot act as previous', mutate: (x) => { x.events.RETURN_BASIC_PRESS.effect = 'PREVIOUS_SCREEN'; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH']},
  {name: 'brightness navigation cannot skip confirmation', mutate: (x) => { x.brightnessPath.splice(2, 1); return x; }, expected: ['HOLD_MONITOR_BRIGHTNESS_PATH_MISMATCH']},
  {name: 'clockwise brightness cannot darken', mutate: (x) => { x.events.BRIGHTNESS_ROTATE_CLOCKWISE.effect = 'DARKER'; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH']},
  {name: 'work-light position 2 must enter night mode with mark', mutate: (x) => { x.events.WORK_LIGHT_POSITION_2.effect = 'LIGHTS_ONLY'; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH']},
  {name: 'numeric 0 daytime override cannot be ignored', mutate: (x) => { x.events.NUMERIC_KEY_0_WHILE_LIGHT_ON.effect = 'NO_EFFECT'; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_EFFECT_MISMATCH']},
  {name: 'day and night brightness cannot share one state', mutate: (x) => { x.nightBrightnessStateId = x.dayBrightnessStateId; return x; }, expected: ['HOLD_MONITOR_DAY_NIGHT_BRIGHTNESS_COLLAPSED']},
  {name: 'position 1 night-mode claim remains unknown', mutate: (x) => { x.unknownTransitions.WORK_LIGHT_POSITION_1_MONITOR_MODE = 'NIGHT_MODE'; return x; }, expected: ['HOLD_MONITOR_LIGHT_POSITION_MODE_UNSUPPORTED']},
  {name: 'production event trace is mandatory', mutate: (x) => { delete x.replayReceipt.eventTrace; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_REPLAY_MISSING']},
  {name: 'every event requires exact source pages', mutate: (x) => { x.events.RETURN_PREVIOUS_PRESS.sourcePdfPages = []; return x; }, expected: ['HOLD_MONITOR_CONTROL_EVENT_SOURCE_MISSING']},
];

const results = [];
for (const fixture of fixtures) {
  const candidate = fixture.mutate(structuredClone(valid));
  const actual = validate(candidate);
  assert.deepEqual(actual, fixture.expected, fixture.name);
  results.push({fixture: fixture.name, pass: true, holds: actual});
}

console.log(JSON.stringify({
  caseId: 'MONITOR-SOURCE-STATE-001-N318',
  refinementId: 'N322_CONTROL_EVENT_MATRIX',
  passed: results.length,
  total: results.length,
  fixtureOnly: true,
  productionReplay: 'NOT_RUN',
  results,
  decision: 'CANDIDATE_N318_REFINED_WITH_CONTROL_EVENT_MATRIX_HOLD_PRODUCTION_REPLAY_UNVERIFIED',
}, null, 2));
