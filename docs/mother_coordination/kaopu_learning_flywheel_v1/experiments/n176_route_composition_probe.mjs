import assert from 'node:assert/strict';

export function classify(e) {
  if (!e.topologyConnected) return 'TOPOLOGY_DISCONNECTED';
  if (!e.localStairsVerified || !e.transferEndpointsCoincident)
    return 'LOCAL_COMPONENT_EVIDENCE_INCOMPLETE';
  if (!e.routeClaimed)
    return 'TOPOLOGY_CONNECTED__NO_ROUTE_CLAIM';
  if (!e.orderedContinuousPath || !e.fullEnvelopeSwept || !e.transitionsSwept || !e.supportContinuous)
    return 'TOPOLOGY_CONNECTED__HOLD_GEOMETRIC_ROUTE_UNTESTED';
  if (e.mandatoryDoor && (!e.doorInRoute || !e.doorStateBound || !e.doorPassageVerified))
    return 'GEOMETRY_ROUTE__HOLD_MANDATORY_DOOR_UNBOUND';
  return 'GEOMETRY_ROUTE_VERIFIED_SCOPED';
}

const r05 = {
  topologyConnected: true,
  localStairsVerified: true,
  transferEndpointsCoincident: true,
  routeClaimed: false,
  orderedContinuousPath: false,
  fullEnvelopeSwept: false,
  transitionsSwept: false,
  supportContinuous: false,
  mandatoryDoor: false,
  doorInRoute: false,
  doorStateBound: false,
  doorPassageVerified: true,
};

const cases = [
  [r05, 'TOPOLOGY_CONNECTED__NO_ROUTE_CLAIM'],
  [{...r05, routeClaimed: true}, 'TOPOLOGY_CONNECTED__HOLD_GEOMETRIC_ROUTE_UNTESTED'],
  [{...r05, routeClaimed: true, orderedContinuousPath: true, fullEnvelopeSwept: true,
    transitionsSwept: true, supportContinuous: false}, 'TOPOLOGY_CONNECTED__HOLD_GEOMETRIC_ROUTE_UNTESTED'],
  [{...r05, routeClaimed: true, orderedContinuousPath: true, fullEnvelopeSwept: true,
    transitionsSwept: true, supportContinuous: true}, 'GEOMETRY_ROUTE_VERIFIED_SCOPED'],
  [{...r05, routeClaimed: true, orderedContinuousPath: true, fullEnvelopeSwept: true,
    transitionsSwept: true, supportContinuous: true, mandatoryDoor: true,
    doorInRoute: false}, 'GEOMETRY_ROUTE__HOLD_MANDATORY_DOOR_UNBOUND'],
  [{...r05, routeClaimed: true, orderedContinuousPath: true, fullEnvelopeSwept: true,
    transitionsSwept: true, supportContinuous: true, mandatoryDoor: true,
    doorInRoute: true, doorStateBound: true}, 'GEOMETRY_ROUTE_VERIFIED_SCOPED'],
  [{...r05, topologyConnected: false}, 'TOPOLOGY_DISCONNECTED'],
];

for (const [input, expected] of cases) assert.equal(classify(input), expected);
console.log(`N176 route-composition probe: ${cases.length}/${cases.length} controls passed`);
