import assert from 'node:assert/strict';

export function verifyRelationGraph(subject) {
  const byID = new Map(subject.entities.map((entity) => [entity.id, entity]));
  const placementByChild = new Map(subject.placements.map((edge) => [edge.child, edge]));
  const subordinateByChild = new Map(subject.subordinates.map((edge) => [edge.child, edge]));
  const transmissionByDriven = new Map(subject.transmissions.map((edge) => [edge.driven, edge]));

  for (const entity of subject.entities) {
    if (entity.requiresPlacement) {
      const edge = placementByChild.get(entity.id);
      if (!edge || !byID.has(edge.parent)) return 'HOLD_PARENT_RELATION_UNRESOLVED';
      const parent = byID.get(edge.parent);
      if (entity.expectedParentAssembly && parent.assembly !== entity.expectedParentAssembly) {
        return 'HOLD_PARENT_SCOPE_MISMATCH';
      }
    }
    if (entity.subordinateOf) {
      const edge = subordinateByChild.get(entity.id);
      if (!edge || edge.parent !== entity.subordinateOf) {
        return 'HOLD_SUBORDINATE_RELATION_MISMATCH';
      }
    }
    if (entity.requiresTransmission) {
      const edge = transmissionByDriven.get(entity.id);
      if (!edge) return 'HOLD_TRANSMISSION_RELATION_UNBOUND';
      const driver = byID.get(edge.driver);
      if (!driver || driver.role !== entity.expectedDriverRole) {
        return 'HOLD_TRANSMISSION_DRIVER_UNRESOLVED';
      }
    }
  }
  return 'ACCEPT_LOGICAL_RELATION_GRAPH_CANDIDATE';
}

const base = {
  entities: [
    {id: 'train/A6/A4', role: 'locomotive-wheel-owner', assembly: 'A4'},
    {id: 'train/A6/tender', role: 'tender', assembly: 'tender'},
    {id: 'train/A6/A4/axle/driver', role: 'axle', assembly: 'A4'},
    {id: 'train/A6/A4/drive-wheel-rear', role: 'drive-wheel', assembly: 'A4', requiresPlacement: true, expectedParentAssembly: 'A4', requiresTransmission: true, expectedDriverRole: 'axle'},
    {id: 'train/A6/A4/drive-wheel-rear/member/tire', role: 'wheel-member', assembly: 'A4', subordinateOf: 'train/A6/A4/drive-wheel-rear'},
  ],
  placements: [{child: 'train/A6/A4/drive-wheel-rear', parent: 'train/A6/A4'}],
  subordinates: [{child: 'train/A6/A4/drive-wheel-rear/member/tire', parent: 'train/A6/A4/drive-wheel-rear'}],
  transmissions: [{driven: 'train/A6/A4/drive-wheel-rear', driver: 'train/A6/A4/axle/driver', law: 'shared-angle'}],
  geometryTimeVerified: true,
  physicalAttachment: 'UNKNOWN',
};

const clone = () => structuredClone(base);
const fixtures = [
  ['valid logical graph; physical attachment remains UNKNOWN', clone(), 'ACCEPT_LOGICAL_RELATION_GRAPH_CANDIDATE'],
  ['dangling placement parent', (() => { const x = clone(); x.placements[0].parent = 'missing'; return x; })(), 'HOLD_PARENT_RELATION_UNRESOLVED'],
  ['wheel placed under wrong assembly', (() => { const x = clone(); x.placements[0].parent = 'train/A6/tender'; return x; })(), 'HOLD_PARENT_SCOPE_MISMATCH'],
  ['member bypasses wheel parent', (() => { const x = clone(); x.subordinates[0].parent = 'train/A6/A4'; return x; })(), 'HOLD_SUBORDINATE_RELATION_MISMATCH'],
  ['missing transmission edge despite geometry/time proof', (() => { const x = clone(); x.transmissions = []; return x; })(), 'HOLD_TRANSMISSION_RELATION_UNBOUND'],
  ['dangling transmission driver', (() => { const x = clone(); x.transmissions[0].driver = 'missing'; return x; })(), 'HOLD_TRANSMISSION_DRIVER_UNRESOLVED'],
  ['wrong driver role', (() => { const x = clone(); x.transmissions[0].driver = 'train/A6/A4'; return x; })(), 'HOLD_TRANSMISSION_DRIVER_UNRESOLVED'],
];

const results = fixtures.map(([name, subject, expected]) => {
  const actual = verifyRelationGraph(subject);
  assert.equal(actual, expected, name);
  return {name, expected, actual, passed: true};
});

console.log(JSON.stringify({schema: 'kaopu.candidate.relation-graph-probe-result/1', passed: results.length, total: results.length, results}, null, 2));
