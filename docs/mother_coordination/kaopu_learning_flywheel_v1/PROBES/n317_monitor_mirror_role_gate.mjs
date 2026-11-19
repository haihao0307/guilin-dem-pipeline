import assert from 'node:assert/strict';

export function evaluateComponent(component) {
  if (component.sourceRole === 'CAB-MONITOR' && component.functionalRole === 'rearViewMirror') {
    return 'HOLD_COMPONENT_ROLE_SOURCE_CONTRADICTION';
  }
  if (component.interiorExteriorDomain === 'interior' && component.functionalRole === 'rearViewMirror') {
    return 'HOLD_COMPONENT_ROLE_DOMAIN_CONTRADICTION';
  }
  if (!component.parentObjectId || !component.supportEdge) {
    return 'HOLD_COMPONENT_PARENT_BINDING_MISSING';
  }
  if (component.functionalRole === 'rearViewMirror' && !component.operatorVisibilityReceipt) {
    return 'HOLD_MIRROR_VISIBILITY_RECEIPT_MISSING';
  }
  return 'COMPONENT_ROLE_AND_PARENT_VERIFIED';
}

const fixtures = [
  {
    name: 'source-backed interior monitor',
    input: {sourceRole:'CAB-MONITOR', functionalRole:'monitor', interiorExteriorDomain:'interior', geometricOperation:'mirror', parentObjectId:'CAB-DOOR-SUPPORT', supportEdge:'bolted-bracket'},
    expected: 'COMPONENT_ROLE_AND_PARENT_VERIFIED'
  },
  {
    name: 'monitor relabelled as rear-view mirror',
    input: {sourceRole:'CAB-MONITOR', functionalRole:'rearViewMirror', interiorExteriorDomain:'interior', parentObjectId:'CAB-DOOR-SUPPORT', supportEdge:'bolted-bracket'},
    expected: 'HOLD_COMPONENT_ROLE_SOURCE_CONTRADICTION'
  },
  {
    name: 'floating monitor',
    input: {sourceRole:'CAB-MONITOR', functionalRole:'monitor', interiorExteriorDomain:'interior'},
    expected: 'HOLD_COMPONENT_PARENT_BINDING_MISSING'
  },
  {
    name: 'exterior mirror without visibility replay',
    input: {sourceRole:'EXTERIOR-REARVIEW-MIRROR', functionalRole:'rearViewMirror', interiorExteriorDomain:'exterior', parentObjectId:'CAB-EXTERIOR-MOUNT', supportEdge:'arm'},
    expected: 'HOLD_MIRROR_VISIBILITY_RECEIPT_MISSING'
  },
  {
    name: 'rear-view camera feed does not change physical role',
    input: {sourceRole:'CAB-MONITOR', functionalRole:'monitor', displayMode:'rearViewCameraFeedOptional', interiorExteriorDomain:'interior', parentObjectId:'CAB-DOOR-SUPPORT', supportEdge:'bolted-bracket'},
    expected: 'COMPONENT_ROLE_AND_PARENT_VERIFIED'
  }
];

const results = fixtures.map(({name,input,expected}) => {
  const actual = evaluateComponent(input);
  assert.equal(actual, expected, name);
  return {name, expected, actual, pass: actual === expected};
});

process.stdout.write(JSON.stringify({
  schema: 'kaopu.monitor-mirror-role-gate-result/1.0',
  candidateId: 'PHYSICAL-SYMMETRY-REUSE-001-N290-DEPENDENCY-CLOSURE',
  boundedQuestion: 'Can source role, physical domain and parent binding prevent an interior monitor from being accepted as an exterior mirror or as a floating component?',
  fixtures: results,
  total: results.length,
  passed: results.filter(x => x.pass).length,
  decision: results.every(x => x.pass) ? 'CANDIDATE_GATE_RUN_PASS' : 'CANDIDATE_GATE_RUN_FAIL',
  adoption: 'NOT_ADOPTED'
}, null, 2) + '\n');
