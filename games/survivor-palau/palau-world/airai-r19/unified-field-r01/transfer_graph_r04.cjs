'use strict';

const crypto = require('node:crypto');

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function ok(value = null, meta = {}) {
  return { ok: true, value: clone(value), meta: clone(meta) };
}

function fail(code, message, meta = {}) {
  return { ok: false, code, message, meta: clone(meta) };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(stableStringify(value), 'utf8').digest('hex');
}

function hasOwn(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

function requireObject(object, name) {
  return object && typeof object === 'object' && !Array.isArray(object)
    ? null
    : fail('TYPE', `${name} must be an object`, { name });
}

function requireKeys(object, keys, name) {
  const typeProblem = requireObject(object, name);
  if (typeProblem) return typeProblem;
  const missing = keys.filter((key) => object[key] === undefined);
  return missing.length
    ? fail('MISSING_KEYS', `${name} missing required keys`, { name, missing })
    : null;
}

function validateVerifiedEdge(edge, scoped) {
  const required = requireKeys(edge, ['operation', 'evidence', 'validRange', 'tests', 'applied'], edge.id);
  if (required) return required;
  if (!edge.operation || typeof edge.operation !== 'object') {
    return fail('VERIFIED_OPERATION', `${edge.id} requires an operation object`);
  }
  if (!edge.operation.id || edge.operation.deterministic !== true) {
    return fail('VERIFIED_OPERATION', `${edge.id} operation must have id and deterministic=true`);
  }
  if (!Array.isArray(edge.evidence) || edge.evidence.length === 0) {
    return fail('VERIFIED_EVIDENCE', `${edge.id} requires non-empty evidence`);
  }
  if (!edge.validRange || typeof edge.validRange !== 'object') {
    return fail('VERIFIED_RANGE', `${edge.id} requires validRange`);
  }
  if (!edge.tests || edge.tests.passed !== true || !edge.tests.receipt) {
    return fail('VERIFIED_TEST', `${edge.id} requires tests.passed=true and a receipt`);
  }
  if (edge.applied !== true) {
    return fail('VERIFIED_APPLIED', `${edge.id} verified edge must have applied=true`);
  }
  if (scoped && (!edge.scope || typeof edge.scope !== 'object')) {
    return fail('VERIFIED_SCOPE', `${edge.id} VERIFIED_SCOPED edge requires scope`);
  }
  return null;
}

function validateCandidateEdge(edge) {
  const required = requireKeys(edge, ['reason', 'approvalGate', 'applied'], edge.id);
  if (required) return required;
  if (edge.applied !== false) {
    return fail('CANDIDATE_APPLIED', `${edge.id} candidate edge must have applied=false`);
  }
  if (edge.operation !== null && edge.operation !== undefined) {
    return fail('CANDIDATE_OPERATION', `${edge.id} candidate edge cannot expose an applied operation`);
  }
  if (!edge.reason || !edge.approvalGate) {
    return fail('CANDIDATE_GATE', `${edge.id} candidate edge requires reason and approvalGate`);
  }
  return null;
}

function validateBlockedEdge(edge) {
  const required = requireKeys(edge, ['reason', 'applied'], edge.id);
  if (required) return required;
  if (edge.applied !== false) {
    return fail('BLOCKED_APPLIED', `${edge.id} blocked/rejected edge must have applied=false`);
  }
  if (edge.operation !== null && edge.operation !== undefined) {
    return fail('BLOCKED_OPERATION', `${edge.id} blocked/rejected edge must have operation=null`);
  }
  if (!edge.reason) return fail('BLOCKED_REASON', `${edge.id} requires a reason`);
  return null;
}

function validateGraph(graph, schema) {
  const graphProblem = requireKeys(
    graph,
    ['schema', 'version', 'status', 'worldId', 'canonicalTraversalPolicy', 'nodes', 'edges'],
    'graph',
  );
  if (graphProblem) return graphProblem;
  const schemaProblem = requireKeys(
    schema,
    ['nodeDomains', 'edgeKinds', 'edgeStatuses', 'canonicalTraversalStatuses', 'directionValues', 'globalRules'],
    'schema',
  );
  if (schemaProblem) return schemaProblem;
  if (!Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return fail('NODES', 'graph.nodes must be non-empty');
  }
  if (!Array.isArray(graph.edges) || graph.edges.length === 0) {
    return fail('EDGES', 'graph.edges must be non-empty');
  }

  const nodes = new Map();
  for (const node of graph.nodes) {
    const required = requireKeys(node, ['id', 'domain', 'type', 'description'], `node:${node?.id || '?'}`);
    if (required) return required;
    if (nodes.has(node.id)) return fail('DUPLICATE_NODE', `duplicate node ${node.id}`);
    if (!schema.nodeDomains.includes(node.domain)) {
      return fail('NODE_DOMAIN', `node ${node.id} has unsupported domain ${node.domain}`);
    }
    nodes.set(node.id, node);
  }

  const edges = new Map();
  for (const edge of graph.edges) {
    const required = requireKeys(
      edge,
      ['id', 'kind', 'from', 'to', 'direction', 'status'],
      `edge:${edge?.id || '?'}`,
    );
    if (required) return required;
    if (edges.has(edge.id)) return fail('DUPLICATE_EDGE', `duplicate edge ${edge.id}`);
    if (!nodes.has(edge.from) || !nodes.has(edge.to)) {
      return fail('EDGE_NODE', `${edge.id} references a missing node`, {
        fromExists: nodes.has(edge.from),
        toExists: nodes.has(edge.to),
      });
    }
    if (edge.from === edge.to) return fail('SELF_EDGE', `${edge.id} cannot be a self edge`);
    if (!schema.edgeKinds.includes(edge.kind)) {
      return fail('EDGE_KIND', `${edge.id} has unsupported kind ${edge.kind}`);
    }
    if (!schema.edgeStatuses.includes(edge.status)) {
      return fail('EDGE_STATUS', `${edge.id} has unsupported status ${edge.status}`);
    }
    if (!schema.directionValues.includes(edge.direction)) {
      return fail('EDGE_DIRECTION', `${edge.id} has unsupported direction ${edge.direction}`);
    }
    if (schema.globalRules.defaultValueForbidden && hasOwn(edge, 'defaultValue')) {
      return fail('DEFAULT_VALUE', `${edge.id} cannot carry defaultValue`);
    }

    let statusProblem = null;
    if (edge.status === 'VERIFIED') statusProblem = validateVerifiedEdge(edge, false);
    if (edge.status === 'VERIFIED_SCOPED') statusProblem = validateVerifiedEdge(edge, true);
    if (edge.status === 'CANDIDATE') statusProblem = validateCandidateEdge(edge);
    if (edge.status === 'BLOCKED' || edge.status === 'REJECTED') {
      statusProblem = validateBlockedEdge(edge);
    }
    if (statusProblem) return statusProblem;
    edges.set(edge.id, edge);
  }

  return ok(
    {
      nodeCount: nodes.size,
      edgeCount: edges.size,
      fingerprint: sha256(graph),
    },
    {
      nodes: [...nodes.keys()],
      edges: [...edges.keys()],
    },
  );
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function evaluateScope(scope, context = {}) {
  if (!scope) return ok(true);
  const failures = [];

  if (scope.stationId !== undefined && context.stationId !== scope.stationId) {
    failures.push({ key: 'stationId', expected: scope.stationId, actual: context.stationId });
  }

  if (scope.allowedSourceSha256 !== undefined) {
    if (!scope.allowedSourceSha256.includes(context.sourceSha256)) {
      failures.push({
        key: 'sourceSha256',
        expectedOneOf: scope.allowedSourceSha256,
        actual: context.sourceSha256,
      });
    }
  }

  if (scope.boundsWgs84 !== undefined) {
    const point = context.pointWgs84;
    if (!Array.isArray(point) || point.length !== 2) {
      failures.push({ key: 'pointWgs84', expected: 'finite [lon,lat]', actual: point });
    } else {
      const [minLon, minLat, maxLon, maxLat] = scope.boundsWgs84;
      const inside = point[0] >= minLon && point[0] <= maxLon && point[1] >= minLat && point[1] <= maxLat;
      if (!inside) failures.push({ key: 'boundsWgs84', expected: scope.boundsWgs84, actual: point });
    }
  }

  if (scope.requiredContext !== undefined) {
    for (const [key, expected] of Object.entries(scope.requiredContext)) {
      if (!deepEqual(context[key], expected)) {
        failures.push({ key, expected, actual: context[key] });
      }
    }
  }

  return failures.length
    ? fail('SCOPE_MISMATCH', 'query context does not satisfy the verified scoped edge', { failures })
    : ok(true);
}

function adjacency(graph) {
  const map = new Map();
  for (const node of graph.nodes) map.set(node.id, []);
  for (const edge of graph.edges) map.get(edge.from).push(edge);
  return map;
}

function reconstructPath(parent, endNode) {
  const edges = [];
  const nodes = [endNode];
  let current = endNode;
  while (parent.has(current)) {
    const record = parent.get(current);
    edges.push(record.edge);
    current = record.previous;
    nodes.push(current);
  }
  edges.reverse();
  nodes.reverse();
  return { nodes, edges };
}

function findVerifiedPath(graph, schema, from, to, context = {}) {
  const validation = validateGraph(graph, schema);
  if (!validation.ok) return validation;
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  if (!nodeIds.has(from) || !nodeIds.has(to)) {
    return fail('QUERY_NODE', 'from/to node is missing', { from, to });
  }
  if (from === to) return ok({ status: 'VERIFIED_PATH', nodes: [from], edges: [] });

  const allowed = new Set(schema.canonicalTraversalStatuses);
  const graphAdjacency = adjacency(graph);
  const queue = [from];
  const visited = new Set([from]);
  const parent = new Map();
  const scopeFailures = [];

  while (queue.length) {
    const node = queue.shift();
    for (const edge of graphAdjacency.get(node)) {
      if (!allowed.has(edge.status)) continue;
      if (edge.status === 'VERIFIED_SCOPED') {
        const scope = evaluateScope(edge.scope, context);
        if (!scope.ok) {
          scopeFailures.push({ edgeId: edge.id, ...scope.meta });
          continue;
        }
      }
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      parent.set(edge.to, { previous: node, edge });
      if (edge.to === to) {
        const path = reconstructPath(parent, to);
        return ok({
          status: 'VERIFIED_PATH',
          nodes: path.nodes,
          edges: path.edges.map((item) => ({
            id: item.id,
            status: item.status,
            operationId: item.operation.id,
          })),
          graphFingerprint: validation.value.fingerprint,
        });
      }
      queue.push(edge.to);
    }
  }

  return fail('NO_VERIFIED_PATH', 'no verified canonical transfer path exists', {
    from,
    to,
    scopeFailures,
  });
}

function findAnyDeclaredPath(graph, from, to, context = {}) {
  const graphAdjacency = adjacency(graph);
  const queue = [from];
  const visited = new Set([from]);
  const parent = new Map();
  while (queue.length) {
    const node = queue.shift();
    for (const edge of graphAdjacency.get(node)) {
      if (visited.has(edge.to)) continue;
      visited.add(edge.to);
      parent.set(edge.to, { previous: node, edge });
      if (edge.to === to) {
        const path = reconstructPath(parent, to);
        const blockers = [];
        for (const pathEdge of path.edges) {
          if (pathEdge.status === 'VERIFIED_SCOPED') {
            const scope = evaluateScope(pathEdge.scope, context);
            if (!scope.ok) {
              blockers.push({
                edgeId: pathEdge.id,
                status: 'SCOPE_MISMATCH',
                reason: scope.message,
                details: scope.meta,
              });
            }
          } else if (!['VERIFIED', 'VERIFIED_SCOPED'].includes(pathEdge.status)) {
            blockers.push({
              edgeId: pathEdge.id,
              status: pathEdge.status,
              reason: pathEdge.reason || 'edge is not verified',
              approvalGate: pathEdge.approvalGate || null,
            });
          }
        }
        return ok({
          status: blockers.length ? 'UNRESOLVED_PATH' : 'VERIFIED_PATH',
          nodes: path.nodes,
          edges: path.edges.map((edge) => edge.id),
          blockers,
        });
      }
      queue.push(edge.to);
    }
  }
  return fail('NO_DECLARED_PATH', 'no declared path exists in the transfer graph', { from, to });
}

function resolveCanonicalTransfer(graph, schema, from, to, context = {}) {
  const verified = findVerifiedPath(graph, schema, from, to, context);
  if (verified.ok) return verified;
  if (verified.code !== 'NO_VERIFIED_PATH') return verified;
  const declared = findAnyDeclaredPath(graph, from, to, context);
  if (!declared.ok) return declared;
  return {
    ok: false,
    code: 'UNRESOLVED_TRANSFER',
    message: 'a declared route exists, but canonical traversal is blocked',
    meta: declared.value,
  };
}

module.exports = {
  validateGraph,
  evaluateScope,
  findVerifiedPath,
  findAnyDeclaredPath,
  resolveCanonicalTransfer,
};
