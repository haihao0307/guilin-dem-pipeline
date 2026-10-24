import assert from 'node:assert/strict';
import {attachOpeningOwnership, validateOpeningOwnership} from './opening-ownership.mjs';

let checks = 0;
const ok = (condition, message) => { assert(condition, message); checks++; };
const expectReject = (graph, options, pattern) => {
  const before = JSON.stringify(graph);
  assert.throws(() => attachOpeningOwnership(graph, options), pattern); checks++;
  ok(JSON.stringify(graph) === before, 'Rejected attachment is atomic');
};
const fixture = () => ({nodes: [
  {id: 'B', type: 'building', ownerBuildingId: 'B'},
  {id: 'floor', type: 'floor', ownerBuildingId: 'B'},
  {id: 'wall', type: 'wall', evidence: 'authored'},
  {id: 'other-wall', type: 'wall', ownerBuildingId: 'B'},
  {id: 'room-a', type: 'room', ownerBuildingId: 'B'},
  {id: 'room-b', type: 'room', ownerBuildingId: 'B'},
  {id: 'door', type: 'door', objectId: 40},
  {id: 'leaf', type: 'elevator', objectId: 41},
], edges: [
  {from: 'floor', to: 'B', type: 'ownedBy'},
  {from: 'wall', to: 'floor', type: 'ownedBy'},
  {from: 'door', to: 'wall', type: 'ownedBy'},
  {from: 'leaf', to: 'floor', type: 'ownedBy'},
]});
const options = {buildingId: 'B', wallId: 'wall', openingId: 'opening', infillId: 'door', infillType: 'door', adjacentSpaceIds: ['room-a', 'room-b'], parts: [{id: 'leaf', type: 'leaf', objectId: 41}]};
const graph = fixture(), originalLeaf = graph.nodes.find(n => n.id === 'leaf');
const chain = attachOpeningOwnership(graph, options);
ok(validateOpeningOwnership(graph, [chain]).passed, 'Door chain on shared wall validates');
ok(graph.nodes.find(n => n.id === 'leaf') === originalLeaf && originalLeaf.type === 'elevator' && originalLeaf.partRole === 'leaf', 'Runtime reference/type retained and semantic role explicit');
ok(graph.nodes.find(n => n.id === 'door').objectId === 40, 'Existing infill object ID preserved');
ok(graph.nodes.find(n => n.id === 'wall').evidence === 'authored', 'Host evidence not upgraded');
ok(graph.edges.filter(e => e.from === 'wall' && e.type === 'ownedBy').length === 1 && graph.edges.some(e => e.from === 'wall' && e.to === 'floor' && e.type === 'ownedBy'), 'Shared wall keeps one original owner');
ok(graph.edges.filter(e => e.from === 'door' && e.type === 'ownedBy').length === 1 && graph.edges.some(e => e.from === 'door' && e.to === 'opening' && e.type === 'ownedBy'), 'Old infill owner replaced by opening');
ok(graph.edges.filter(e => e.from === 'wall' && e.type === 'boundsRoom').length === 2, 'Both adjacent rooms separate from ownership');
const first = JSON.stringify(graph);
attachOpeningOwnership(graph, options);
ok(JSON.stringify(graph) === first, 'Repeated attach is idempotent');

const window = attachOpeningOwnership(graph, {buildingId: 'B', wallId: 'wall', openingId: 'window-opening', infillId: 'window', infillType: 'window', adjacentSpaceIds: ['room-a', 'room-b'], parts: [{id: 'window-frame', type: 'frame'}, {id: 'window-leaf', type: 'leaf'}, {id: 'window-glass', type: 'glass', parentId: 'window-leaf', objectId: 88}]});
ok(validateOpeningOwnership(graph, [chain, window]).passed, 'Window glass nested below leaf and shared wall validates');
ok(graph.edges.filter(e => e.from === 'wall' && e.type === 'ownedBy').length === 1, 'Second opening does not duplicate wall owner');
const empty = fixture();
const noParts = attachOpeningOwnership(empty, {...options, parts: []});
ok(noParts.parts.length === 0 && !empty.nodes.some(n => n.partRole), 'No invented frame/leaf/glass when parts absent');

const wrongHost = fixture(); wrongHost.nodes.find(n => n.id === 'wall').type = 'room';
expectReject(wrongHost, options, /Wrong host/);
const missingHost = fixture(); missingHost.nodes = missingHost.nodes.filter(n => n.id !== 'wall');
expectReject(missingHost, options, /Missing host/);
const explicitHost = fixture(); explicitHost.nodes.find(n => n.id === 'wall').type = 'stair'; explicitHost.nodes.find(n => n.id === 'wall').hostRole = 'wall';
ok(validateOpeningOwnership(explicitHost, [attachOpeningOwnership(explicitHost, options)]).passed, 'Explicit wall role admits UI stair type');
const sourceHost = fixture(); sourceHost.nodes.find(n => n.id === 'wall').type = 'source-surface'; sourceHost.nodes.find(n => n.id === 'wall').kind = 'source_surface';
expectReject(sourceHost, options, /Wrong host/);
ok(validateOpeningOwnership(sourceHost, [attachOpeningOwnership(sourceHost, {...options, allowedHostKinds: ['source_surface']})]).passed, 'Source kind requires explicit allowlist');

for (const id of ['wall', 'door', 'leaf', 'room-b']) {
  const foreign = fixture(); foreign.nodes.find(n => n.id === id).ownerBuildingId = 'OTHER';
  expectReject(foreign, options, /Cross-building/);
}
const alteredHost = structuredClone(graph); alteredHost.edges.find(e => e.from === 'opening' && e.type === 'voids').to = 'other-wall';
ok(!validateOpeningOwnership(alteredHost, [chain, window]).passed, 'Wrong existing wall relation is detected');
const orphanGlass = structuredClone(graph); orphanGlass.edges = orphanGlass.edges.filter(e => !(e.from === 'window-glass' && e.type === 'ownedBy'));
ok(!validateOpeningOwnership(orphanGlass, [chain, window]).passed, 'Isolated glass ownership is detected');
const unlistedGlass = structuredClone(graph); unlistedGlass.nodes.push({id: 'stray-glass', type: 'glass', partRole: 'glass', ownerBuildingId: 'B', openingOwnershipId: window.openingId});
ok(validateOpeningOwnership(unlistedGlass, [chain, window]).errors.some(e => e.code === 'orphan_part'), 'Tagged but unlisted glass is detected');
const cross = structuredClone(graph); cross.nodes.find(n => n.id === 'window-glass').ownerBuildingId = 'OTHER';
ok(validateOpeningOwnership(cross, [chain, window]).errors.some(e => e.code === 'cross_building'), 'Validator detects cross-building part tags');
const missing = structuredClone(graph); missing.nodes = missing.nodes.filter(n => n.id !== 'window-frame');
ok(validateOpeningOwnership(missing, [chain, window]).errors.some(e => e.code === 'missing_node'), 'Missing emitted part detected');
expectReject(fixture(), {...options, parts: [{id: 'glass', type: 'glass', parentId: 'room-a'}]}, /orphan_part/);
expectReject(fixture(), {...options, parts: [{id: 'frame', type: 'frame', parentId: 'glass'}, {id: 'glass', type: 'glass', parentId: 'frame'}]}, /part_cycle/);
const rehost = structuredClone(graph);
expectReject(rehost, {...options, wallId: 'other-wall'}, /different wall host/);
const multipleOwners = fixture(); multipleOwners.edges.push({from: 'wall', to: 'room-a', type: 'ownedBy'});
expectReject(multipleOwners, options, /multiple_wall_owners/);
console.log(JSON.stringify({passed: true, checks, graphMutationsOutsideOpeningChain: false, noGeometryGenerated: true, complianceClaim: false}, null, 2));
