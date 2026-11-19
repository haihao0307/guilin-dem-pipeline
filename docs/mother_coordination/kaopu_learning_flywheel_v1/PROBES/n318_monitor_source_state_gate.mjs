import assert from 'node:assert/strict';

const FROZEN_SOURCES = new Set([
  'HITACHI_ZX85USB5A_BROCHURE_V0',
  'HITACHI_75U5A_85USB5A_OPERATOR_MANUAL_V0',
]);

function validate(candidate) {
  const holds = [];
  const screens = new Map(candidate.screens.map((screen) => [screen.id, screen]));

  for (const screen of candidate.screens) {
    if (!screen.source || !FROZEN_SOURCES.has(screen.source.documentId) || !screen.source.pdfPages?.length) {
      holds.push('HOLD_MONITOR_SCREEN_SOURCE_MISSING');
    }
    if (screen.interactive && (!screen.entryEvents?.length || !screen.exitEvents?.length)) {
      holds.push('HOLD_MONITOR_TRIGGER_UNBOUND');
    }
    if (screen.interactive && screen.staticOnly) {
      holds.push('HOLD_MONITOR_STATIC_ICON_ONLY');
    }
    if (screen.optional && !screen.availabilityGuard) {
      holds.push('HOLD_MONITOR_OPTIONALITY_CONTRADICTION');
    }
  }

  for (const transition of candidate.transitions) {
    if (!screens.has(transition.from) || !screens.has(transition.to)) {
      holds.push('HOLD_MONITOR_STATE_TRANSITION_CONTRADICTION');
      continue;
    }
    if (!transition.event || !transition.source?.pdfPages?.length) {
      holds.push('HOLD_MONITOR_TRIGGER_UNBOUND');
    }
    if (transition.guardRequired && !transition.guard) {
      holds.push('HOLD_MONITOR_STATE_TRANSITION_CONTRADICTION');
    }
  }

  return [...new Set(holds)];
}

const source = (pages) => ({
  documentId: 'HITACHI_75U5A_85USB5A_OPERATOR_MANUAL_V0',
  pdfPages: pages,
});

const valid = {
  screens: [
    { id: 'STARTUP', source: source([66]), interactive: false, entryEvents: ['KEY_ACC_OR_ON'], exitEvents: ['TWO_SECONDS'] },
    { id: 'BASIC', source: source([65, 66]), interactive: true, entryEvents: ['KEY_ON', 'RETURN_BASIC'], exitEvents: ['PRESS_SELECTOR_KNOB'] },
    { id: 'MAIN_MENU', source: source([78]), interactive: true, entryEvents: ['PRESS_SELECTOR_KNOB'], exitEvents: ['RETURN_PREVIOUS', 'RETURN_BASIC', 'SELECT_MENU'] },
    { id: 'ALARM_LIST', source: source([73, 74]), interactive: true, optional: true, availabilityGuard: 'CURRENT_ALARM_COUNT > 0', entryEvents: ['SELECT_ALARM_LIST'], exitEvents: ['RETURN_PREVIOUS', 'RETURN_BASIC'] },
    { id: 'REAR_VIEW_CAMERA', source: source([96, 97]), interactive: true, optional: true, availabilityGuard: 'CAMERA_OPTION_INSTALLED', entryEvents: ['SELECT_REAR_VIEW_CAMERA_MONITOR'], exitEvents: ['TOGGLE_ON_OFF', 'RETURN_PREVIOUS', 'RETURN_BASIC'] },
  ],
  transitions: [
    { from: 'STARTUP', event: 'KEY_ON_AFTER_TWO_SECONDS', to: 'BASIC', source: source([66]) },
    { from: 'BASIC', event: 'PRESS_SELECTOR_KNOB', to: 'MAIN_MENU', source: source([78]) },
    { from: 'MAIN_MENU', event: 'SELECT_ALARM_LIST', to: 'ALARM_LIST', guardRequired: true, guard: 'CURRENT_ALARM_COUNT > 0', source: source([73, 74]) },
    { from: 'MAIN_MENU', event: 'SELECT_REAR_VIEW_CAMERA_MONITOR', to: 'REAR_VIEW_CAMERA', guardRequired: true, guard: 'CAMERA_OPTION_INSTALLED', source: source([96, 97]) },
  ],
};

const fixtures = [
  { name: 'source-backed state graph', candidate: valid, expected: [] },
  { name: 'static icon without behavior', mutate: (c) => { c.screens.find((s) => s.id === 'BASIC').staticOnly = true; }, expected: ['HOLD_MONITOR_STATIC_ICON_ONLY'] },
  { name: 'invented screen without source', mutate: (c) => { c.screens.push({ id: 'CREATIVE_DASHBOARD', interactive: false }); }, expected: ['HOLD_MONITOR_SCREEN_SOURCE_MISSING'] },
  { name: 'optional camera treated as standard', mutate: (c) => { delete c.screens.find((s) => s.id === 'REAR_VIEW_CAMERA').availabilityGuard; }, expected: ['HOLD_MONITOR_OPTIONALITY_CONTRADICTION'] },
  { name: 'alarm transition without current-alarm guard', mutate: (c) => { delete c.transitions.find((t) => t.to === 'ALARM_LIST').guard; }, expected: ['HOLD_MONITOR_STATE_TRANSITION_CONTRADICTION'] },
  { name: 'interactive screen without controller events', mutate: (c) => { c.screens.find((s) => s.id === 'MAIN_MENU').entryEvents = []; }, expected: ['HOLD_MONITOR_TRIGGER_UNBOUND'] },
];

const results = fixtures.map((fixture) => {
  const candidate = structuredClone(fixture.candidate ?? valid);
  fixture.mutate?.(candidate);
  const holds = validate(candidate);
  for (const expected of fixture.expected) assert(holds.includes(expected), `${fixture.name}: missing ${expected}`);
  if (fixture.expected.length === 0) assert.deepEqual(holds, [], `${fixture.name}: unexpected holds ${holds}`);
  return { fixture: fixture.name, pass: true, holds };
});

console.log(JSON.stringify({ caseId: 'MONITOR-SOURCE-STATE-001-N318', passed: results.length, total: results.length, results }, null, 2));
