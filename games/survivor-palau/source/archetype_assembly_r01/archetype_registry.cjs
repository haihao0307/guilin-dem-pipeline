'use strict';

const CANDIDATE_STATES = new Set(['CANDIDATE', 'VERIFIER_PASSED', 'ACTIVE']);

function requiredString(value, name) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function freezeRecord(value) {
  return Object.freeze(clone(value));
}

function createArchetypeRegistry() {
  const candidates = new Map();
  const placementsByRuntimeId = new Map();
  const placementsBySaveId = new Map();

  function registerCandidate(input) {
    const record = {
      archetypeId: requiredString(input && input.archetypeId, 'archetypeId'),
      domain: requiredString(input && input.domain, 'domain'),
      version: requiredString(input && input.version, 'version'),
      sourceHead: requiredString(input && input.sourceHead, 'sourceHead'),
      status: requiredString(input && input.status, 'status'),
    };
    if (!CANDIDATE_STATES.has(record.status) || record.status === 'ACTIVE') {
      throw new Error('new candidate status must be CANDIDATE or VERIFIER_PASSED');
    }
    if (candidates.has(record.archetypeId)) {
      throw new Error(`duplicate archetypeId: ${record.archetypeId}`);
    }
    candidates.set(record.archetypeId, record);
    return freezeRecord(record);
  }

  function resolve(archetypeId) {
    const id = requiredString(archetypeId, 'archetypeId');
    const record = candidates.get(id);
    if (!record) {
      return freezeRecord({ archetypeId: id, status: 'NO_CANDIDATE' });
    }
    return freezeRecord(record);
  }

  function activate(archetypeId) {
    const id = requiredString(archetypeId, 'archetypeId');
    const record = candidates.get(id);
    if (!record) {
      throw new Error(`NO_CANDIDATE: ${id}`);
    }
    if (record.status !== 'VERIFIER_PASSED') {
      throw new Error(`candidate is not verifier-passed: ${id}`);
    }
    record.status = 'ACTIVE';
    return freezeRecord(record);
  }

  function place(archetypeId, input) {
    const id = requiredString(archetypeId, 'archetypeId');
    const candidate = candidates.get(id);
    if (!candidate) {
      throw new Error(`NO_CANDIDATE: ${id}`);
    }
    if (candidate.status !== 'ACTIVE') {
      throw new Error(`candidate is not ACTIVE: ${id}`);
    }

    const placement = {
      archetypeId: id,
      runtimeIdentity: requiredString(input && input.runtimeIdentity, 'runtimeIdentity'),
      saveIdentity: requiredString(input && input.saveIdentity, 'saveIdentity'),
      whyInStory: requiredString(input && input.WHY_IN_STORY, 'WHY_IN_STORY'),
      whereInWorld: requiredString(input && input.WHERE_IN_WORLD, 'WHERE_IN_WORLD'),
    };

    if (placementsByRuntimeId.has(placement.runtimeIdentity)) {
      throw new Error(`duplicate runtimeIdentity: ${placement.runtimeIdentity}`);
    }
    if (placementsBySaveId.has(placement.saveIdentity)) {
      throw new Error(`duplicate saveIdentity: ${placement.saveIdentity}`);
    }

    placementsByRuntimeId.set(placement.runtimeIdentity, placement);
    placementsBySaveId.set(placement.saveIdentity, placement);
    return freezeRecord(placement);
  }

  function snapshot() {
    return freezeRecord({
      schema: 'smi.archetype-registry/1.0',
      candidates: [...candidates.values()]
        .map(clone)
        .sort((a, b) => a.archetypeId.localeCompare(b.archetypeId)),
      placements: [...placementsByRuntimeId.values()]
        .map(clone)
        .sort((a, b) => a.runtimeIdentity.localeCompare(b.runtimeIdentity)),
    });
  }

  function restore(snapshotInput) {
    if (!snapshotInput || snapshotInput.schema !== 'smi.archetype-registry/1.0') {
      throw new Error('unsupported snapshot schema');
    }
    if (candidates.size || placementsByRuntimeId.size || placementsBySaveId.size) {
      throw new Error('restore requires an empty registry');
    }

    for (const candidate of snapshotInput.candidates || []) {
      const restored = {
        archetypeId: requiredString(candidate.archetypeId, 'archetypeId'),
        domain: requiredString(candidate.domain, 'domain'),
        version: requiredString(candidate.version, 'version'),
        sourceHead: requiredString(candidate.sourceHead, 'sourceHead'),
        status: requiredString(candidate.status, 'status'),
      };
      if (!CANDIDATE_STATES.has(restored.status)) {
        throw new Error(`invalid restored candidate status: ${restored.status}`);
      }
      if (candidates.has(restored.archetypeId)) {
        throw new Error(`duplicate restored archetypeId: ${restored.archetypeId}`);
      }
      candidates.set(restored.archetypeId, restored);
    }

    for (const item of snapshotInput.placements || []) {
      const placement = {
        archetypeId: requiredString(item.archetypeId, 'archetypeId'),
        runtimeIdentity: requiredString(item.runtimeIdentity, 'runtimeIdentity'),
        saveIdentity: requiredString(item.saveIdentity, 'saveIdentity'),
        whyInStory: requiredString(item.whyInStory, 'whyInStory'),
        whereInWorld: requiredString(item.whereInWorld, 'whereInWorld'),
      };
      const candidate = candidates.get(placement.archetypeId);
      if (!candidate || candidate.status !== 'ACTIVE') {
        throw new Error(`restored placement references non-active candidate: ${placement.archetypeId}`);
      }
      if (placementsByRuntimeId.has(placement.runtimeIdentity)) {
        throw new Error(`duplicate restored runtimeIdentity: ${placement.runtimeIdentity}`);
      }
      if (placementsBySaveId.has(placement.saveIdentity)) {
        throw new Error(`duplicate restored saveIdentity: ${placement.saveIdentity}`);
      }
      placementsByRuntimeId.set(placement.runtimeIdentity, placement);
      placementsBySaveId.set(placement.saveIdentity, placement);
    }
    return snapshot();
  }

  return Object.freeze({ registerCandidate, resolve, activate, place, snapshot, restore });
}

module.exports = { createArchetypeRegistry };
