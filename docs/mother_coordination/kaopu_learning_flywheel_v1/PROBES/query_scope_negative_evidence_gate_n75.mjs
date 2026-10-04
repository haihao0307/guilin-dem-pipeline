import assert from 'node:assert/strict';

function decide(x) {
  if (x.claimSurface !== x.observationSurface) return 'HOLD_EVIDENCE_SURFACE_MISMATCH';
  if (!x.targetEventTypes.every(event => x.observationEventTypes.includes(event))) return 'HOLD_QUERY_SCOPE_MISMATCH';
  if (!x.workflowBound) return 'HOLD_WORKFLOW_UNBOUND';
  if (!x.headShaBound) return 'HOLD_HEAD_SHA_UNBOUND';
  if (!x.paginationComplete) return 'HOLD_QUERY_PAGINATION_INCOMPLETE';
  if (x.returnedRunIds.length === 0) return 'NO_MATCHING_RUN_OBSERVED_IN_DECLARED_SCOPE';
  return 'MATCHING_RUN_OBSERVED';
}

const fixtures = [
  ['n73-pr-only-query-for-push-workflow', {
    claimSurface: 'actions_workflow_runs', observationSurface: 'actions_workflow_runs',
    targetEventTypes: ['push'], observationEventTypes: ['pull_request'], workflowBound: true,
    headShaBound: true, paginationComplete: true, returnedRunIds: []
  }, 'HOLD_QUERY_SCOPE_MISMATCH'],
  ['n73-empty-commit-statuses-for-actions-claim', {
    claimSurface: 'actions_workflow_runs', observationSurface: 'commit_statuses',
    targetEventTypes: ['push'], observationEventTypes: ['push'], workflowBound: true,
    headShaBound: true, paginationComplete: true, returnedRunIds: []
  }, 'HOLD_EVIDENCE_SURFACE_MISMATCH'],
  ['material-r15-correct-query-finds-run-3', {
    claimSurface: 'actions_workflow_runs', observationSurface: 'actions_workflow_runs',
    targetEventTypes: ['push'], observationEventTypes: ['push'], workflowBound: true,
    headShaBound: true, paginationComplete: true, returnedRunIds: [37184764939]
  }, 'MATCHING_RUN_OBSERVED'],
  ['empty-correct-scope-incomplete-pagination', {
    claimSurface: 'actions_workflow_runs', observationSurface: 'actions_workflow_runs',
    targetEventTypes: ['push'], observationEventTypes: ['push'], workflowBound: true,
    headShaBound: true, paginationComplete: false, returnedRunIds: []
  }, 'HOLD_QUERY_PAGINATION_INCOMPLETE'],
  ['empty-complete-declared-scope', {
    claimSurface: 'actions_workflow_runs', observationSurface: 'actions_workflow_runs',
    targetEventTypes: ['push'], observationEventTypes: ['push'], workflowBound: true,
    headShaBound: true, paginationComplete: true, returnedRunIds: []
  }, 'NO_MATCHING_RUN_OBSERVED_IN_DECLARED_SCOPE'],
  ['run-found-without-exact-head-binding', {
    claimSurface: 'actions_workflow_runs', observationSurface: 'actions_workflow_runs',
    targetEventTypes: ['push'], observationEventTypes: ['push'], workflowBound: true,
    headShaBound: false, paginationComplete: true, returnedRunIds: [37184764939]
  }, 'HOLD_HEAD_SHA_UNBOUND']
];

const results = fixtures.map(([name, input, expected]) => ({ name, actual: decide(input), expected }));
for (const result of results) assert.equal(result.actual, result.expected, result.name);
console.log(JSON.stringify({
  schema: 'kaopu.probe-result/1',
  probe: 'QUERY-SCOPE-NEGATIVE-EVIDENCE-N75',
  passed: results.length,
  total: results.length,
  results
}, null, 2));
