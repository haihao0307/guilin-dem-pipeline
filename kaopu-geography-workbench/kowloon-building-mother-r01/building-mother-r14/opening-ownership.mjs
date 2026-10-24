/** Semantic ownership only. No new geometry, metric evidence or walkability.
 * All ownership edges point from child to parent. Runtime IDs/types survive.
 */
const WALL_TYPES = ['wall', 'source-envelope', 'source-wall-surface'];
const PART_TYPES = ['frame', 'leaf', 'glass'];
const validId = value => typeof value === 'string' && value.length > 0;
const edgeKey = edge => JSON.stringify([edge.from, edge.to, edge.type]);
const hostAllowed = (node, chain) => node?.hostRole === 'wall' ||
  [...WALL_TYPES, ...(chain.allowedHostTypes ?? [])].includes(node?.type) ||
  (node?.kind !== undefined && (chain.allowedHostKinds ?? []).includes(node.kind));
const foreignTag = (node, buildingId) => ['ownerBuildingId', 'buildingId'].some(key => node?.[key] != null && node[key] !== buildingId);

/** Returns a chain descriptor for model.openingOwnership.chains.
 * Explicit hostRole:'wall' admits UI-classified wall nodes without changing type.
 * Optional allowedHostTypes/allowedHostKinds are explicit per-call allowlists.
 * parts lists only real, already-emitted components; omitted parts are not invented.
 */
export function attachOpeningOwnership(graph, {
  buildingId, wallId, openingId, infillId, infillType,
  adjacentSpaceIds = [], parts = [], allowedHostTypes = [], allowedHostKinds = [],
} = {}) {
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges)) throw Error('Opening ownership requires a graph');
  if (![buildingId, wallId, openingId, infillId].every(validId)) throw Error('Explicit building, wall, opening and infill IDs required');
  if (!['door', 'window'].includes(infillType)) throw Error('Infill type must be door or window');
  if (![adjacentSpaceIds, parts, allowedHostTypes, allowedHostKinds].every(Array.isArray)) throw Error('Ownership lists must be arrays');
  if (![...adjacentSpaceIds, ...allowedHostTypes, ...allowedHostKinds].every(validId)) throw Error('Ownership list values must be explicit IDs or types');
  if (parts.some(p => !p || !validId(p.id) || !PART_TYPES.includes(p.type) || (p.parentId !== undefined && !validId(p.parentId)))) throw Error('Explicit frame/leaf/glass component descriptors required');
  if (parts.some(p => p.objectId !== undefined && !Number.isFinite(p.objectId))) throw Error('Part objectId must be finite');
  const chain = {
    buildingId, wallId, openingId, infillId, infillType,
    adjacentSpaceIds: [...new Set(adjacentSpaceIds)],
    parts: parts.map(p => ({...p, parentId: p.parentId ?? infillId})),
    allowedHostTypes: [...allowedHostTypes], allowedHostKinds: [...allowedHostKinds],
  };
  const members = [wallId, openingId, infillId, ...parts.map(p => p.id)];
  if (new Set(members).size !== members.length) throw Error('Opening ownership identities must be distinct');
  if (chain.adjacentSpaceIds.some(id => members.includes(id))) throw Error('Adjacent spaces must not be ownership-chain members');
  const originals = new Map(graph.nodes.map(n => [n.id, n]));
  if (originals.size !== graph.nodes.length) throw Error('Duplicate graph node identities');
  const wall = originals.get(wallId);
  if (!wall) throw Error('Missing host wall ' + wallId);
  if (!hostAllowed(wall, chain)) throw Error('Wrong host type for wall ' + wallId + '; provide an explicit wall role or allowed type/kind');
  for (const id of [...members, ...chain.adjacentSpaceIds]) {
    const node = originals.get(id);
    if (foreignTag(node, buildingId)) throw Error('Cross-building ownership tag on ' + id);
    if (id !== wallId && node?.openingOwnershipId != null && node.openingOwnershipId !== openingId) throw Error('Component already belongs to another opening: ' + id);
  }
  for (const id of chain.adjacentSpaceIds) if (!originals.has(id)) throw Error('Missing adjacent space ' + id);
  const oldOpening = originals.get(openingId);
  if (oldOpening && graph.edges.some(e => e.from === openingId && ['voids', 'hostedBy'].includes(e.type) && e.to !== wallId)) throw Error('Opening already has a different wall host');
  const oldInfill = originals.get(infillId);
  if (oldInfill?.infillRole && oldInfill.infillRole !== infillType) throw Error('Infill role conflict');
  for (const part of chain.parts) {
    const node = originals.get(part.id);
    if (node?.partRole && node.partRole !== part.type) throw Error('Part role conflict: ' + part.id);
    if (node?.objectId !== undefined && part.objectId !== undefined && node.objectId !== part.objectId) throw Error('Part objectId conflict: ' + part.id);
  }
  // Validate on shallow copies; a rejected attachment leaves the caller untouched.
  const draft = {nodes: graph.nodes.map(n => ({...n})), edges: graph.edges.map(e => ({...e}))};
  const nodes = new Map(draft.nodes.map(n => [n.id, n]));
  const put = (id, type, properties) => {
    let node = nodes.get(id);
    if (!node) { node = {id, type}; nodes.set(id, node); draft.nodes.push(node); }
    Object.assign(node, properties, {ownerBuildingId: buildingId});
    return node;
  };
  const relation = (from, to, type) => {
    if (!draft.edges.some(e => e.from === from && e.to === to && e.type === type)) draft.edges.push({from, to, type});
  };
  const parentRelations = (id, parentId, relationTypes) => {
    const retained = new Set();
    draft.edges = draft.edges.filter(edge => {
      if (edge.from !== id || !relationTypes.includes(edge.type)) return true;
      if (edge.to !== parentId || retained.has(edge.type)) return false;
      retained.add(edge.type);
      return true;
    });
    for (const type of relationTypes) relation(id, parentId, type);
  };
  put(wallId, wall.type, {}); // Keep the shared wall's original owner and evidence.
  put(openingId, 'opening', {openingRole: 'opening', openingOwnershipId: openingId});
  parentRelations(openingId, wallId, ['ownedBy', 'hostedBy', 'voids']);
  put(infillId, infillType, {infillRole: infillType, openingOwnershipId: openingId});
  parentRelations(infillId, openingId, ['ownedBy', 'hostedBy', 'fills']);
  for (const part of chain.parts) {
    put(part.id, part.type, {partRole: part.type, openingOwnershipId: openingId,
      ...(part.objectId === undefined ? {} : {objectId: part.objectId})});
    parentRelations(part.id, part.parentId, ['ownedBy', 'hostedBy', 'partOf']);
  }
  for (const id of chain.adjacentSpaceIds) {
    relation(wallId, id, 'boundsRoom');
    relation(openingId, id, 'opensBetween');
  }
  const validation = validateOpeningOwnership(draft, [chain]);
  if (!validation.passed) throw Error(validation.errors.map(e => e.code + ': ' + e.message).join('; '));
  // Preserve existing node and array references used by emitters/runtime maps.
  for (const node of draft.nodes) {
    const existing = originals.get(node.id);
    if (existing) Object.assign(existing, node);
    else graph.nodes.push(node);
  }
  graph.edges.splice(0, graph.edges.length, ...draft.edges);
  return chain;
}

/** Return actionable errors rather than throwing for malformed ownership graphs. */
export function validateOpeningOwnership(graph, chains = []) {
  const errors = [];
  const fail = (code, message, chain = null, nodeId = null) => errors.push({code, message, openingId: chain?.openingId ?? null, nodeId});
  if (!graph || !Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !Array.isArray(chains)) return {passed: false, errors: [{code: 'invalid_input', message: 'Graph arrays and chain list required'}], chainCount: 0};
  const nodes = new Map();
  for (const node of graph.nodes) {
    if (nodes.has(node.id)) fail('duplicate_node', 'Duplicate graph identity', null, node.id);
    nodes.set(node.id, node);
  }
  const edges = new Set(graph.edges.map(edgeKey));
  const openingHosts = new Map(), infillParents = new Map();
  const checkParent = (id, parent, types, chain) => {
    for (const type of types) {
      const actual = graph.edges.filter(e => e.from === id && e.type === type);
      if (actual.length !== 1 || actual[0].to !== parent) fail('wrong_parent', `${id} must have exactly one ${type} to ${parent}`, chain, id);
    }
  };
  for (const chain of chains) {
    if (!chain || ![chain.buildingId, chain.wallId, chain.openingId, chain.infillId].every(validId) ||
        !Array.isArray(chain.parts) || !Array.isArray(chain.adjacentSpaceIds) ||
        chain.parts.some(p => !p || !validId(p.id)) || !chain.adjacentSpaceIds.every(validId) ||
        (chain.allowedHostTypes !== undefined && !Array.isArray(chain.allowedHostTypes)) ||
        (chain.allowedHostKinds !== undefined && !Array.isArray(chain.allowedHostKinds))) {
      fail('invalid_chain', 'Complete chain descriptor required', chain); continue;
    }
    const {buildingId, wallId, openingId, infillId, parts} = chain;
    const members = [wallId, openingId, infillId, ...parts.map(p => p.id)];
    if (new Set(members).size !== members.length) fail('duplicate_chain_identity', 'Chain members must be distinct', chain);
    if (openingHosts.has(openingId) && openingHosts.get(openingId) !== wallId) fail('wrong_host', 'Opening assigned to different walls', chain, openingId);
    if (infillParents.has(infillId) && infillParents.get(infillId) !== openingId) fail('wrong_host', 'Infill assigned to different openings', chain, infillId);
    openingHosts.set(openingId, wallId); infillParents.set(infillId, openingId);
    for (const id of members) {
      const node = nodes.get(id);
      if (!node) { fail('missing_node', 'Missing chain node ' + id, chain, id); continue; }
      if (foreignTag(node, buildingId)) fail('cross_building', 'Cross-building tag on ' + id, chain, id);
      if (node.ownerBuildingId !== buildingId) fail('missing_building_tag', 'Chain node lacks expected ownerBuildingId', chain, id);
      if (id !== wallId && node.openingOwnershipId !== openingId) fail('wrong_chain_tag', 'Node belongs to a different or missing opening chain', chain, id);
    }
    const wall = nodes.get(wallId);
    if (wall && !hostAllowed(wall, chain)) fail('wrong_host', 'Host is not an explicitly admitted wall', chain, wallId);
    const wallOwners = graph.edges.filter(e => e.from === wallId && e.type === 'ownedBy');
    if (wallOwners.length > 1) fail('multiple_wall_owners', 'Shared wall must not be assigned to both adjacent spaces', chain, wallId);
    if (wallOwners.some(e => !nodes.has(e.to))) fail('missing_wall_owner', 'Wall owner endpoint is missing', chain, wallId);
    if (wallOwners.some(e => foreignTag(nodes.get(e.to), buildingId))) fail('cross_building', 'Wall owner belongs to another building', chain, wallId);
    checkParent(openingId, wallId, ['ownedBy', 'hostedBy', 'voids'], chain);
    checkParent(infillId, openingId, ['ownedBy', 'hostedBy', 'fills'], chain);
    if (!['door', 'window'].includes(chain.infillType) || nodes.get(infillId)?.infillRole !== chain.infillType) fail('wrong_infill', 'Door/window role does not match chain', chain, infillId);
    const partMap = new Map(parts.map(p => [p.id, p]));
    for (const part of parts) {
      const parentId = part.parentId ?? infillId, node = nodes.get(part.id);
      if (!PART_TYPES.includes(part.type) || node?.partRole !== part.type) fail('wrong_part_role', 'Part must retain an explicit frame/leaf/glass role', chain, part.id);
      if (part.objectId !== undefined && node?.objectId !== part.objectId) fail('object_id_mismatch', 'Part object identity changed', chain, part.id);
      if (parentId !== infillId && !partMap.has(parentId)) fail('orphan_part', 'Part parent is outside the declared infill chain', chain, part.id);
      checkParent(part.id, parentId, ['ownedBy', 'hostedBy', 'partOf'], chain);
      const visited = new Set([part.id]);
      let cursor = parentId;
      while (cursor !== infillId) {
        if (visited.has(cursor)) { fail('part_cycle', 'Part ancestry cycles instead of reaching its door/window', chain, part.id); break; }
        visited.add(cursor);
        const parent = partMap.get(cursor);
        if (!parent) { fail('orphan_part', 'Part does not reach its door/window', chain, part.id); break; }
        cursor = parent.parentId ?? infillId;
      }
    }
    for (const node of graph.nodes) if (node.openingOwnershipId === openingId && node.partRole && !partMap.has(node.id)) fail('orphan_part', 'Tagged frame/leaf/glass omitted from chain', chain, node.id);
    for (const id of chain.adjacentSpaceIds) {
      if (!nodes.has(id)) fail('missing_adjacent_space', 'Missing adjacent space', chain, id);
      if (foreignTag(nodes.get(id), buildingId)) fail('cross_building', 'Adjacent space belongs to another building', chain, id);
      if (!edges.has(edgeKey({from: wallId, to: id, type: 'boundsRoom'})) || !edges.has(edgeKey({from: openingId, to: id, type: 'opensBetween'}))) fail('missing_adjacency', 'Spatial adjacency must be separate from ownership', chain, id);
    }
  }
  return {passed: errors.length === 0, errors, chainCount: chains.length};
}
