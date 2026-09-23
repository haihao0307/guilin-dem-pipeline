'use strict';

const crypto = require('node:crypto');

function clone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function ok(meta = {}) {
  return { ok: true, meta: clone(meta) };
}

function fail(code, message, path = null, meta = {}) {
  return { ok: false, code, message, path, meta: clone(meta) };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function requireKeys(object, keys, path) {
  if (!isPlainObject(object)) return fail('TYPE', `${path} must be an object`, path);
  const missing = keys.filter((key) => object[key] === undefined);
  return missing.length
    ? fail('MISSING_KEYS', `${path} missing required keys`, path, { missing })
    : ok();
}

function validateValidTime(validTime, schema, path) {
  const required = requireKeys(validTime, ['kind'], path);
  if (!required.ok) return required;
  if (!schema.validTimeKinds.includes(validTime.kind)) {
    return fail('ENUM', `${path}.kind is not allowed`, `${path}.kind`, {
      value: validTime.kind,
      allowed: schema.validTimeKinds,
    });
  }
  if (validTime.kind === 'instant' && validTime.at === undefined) {
    return fail('TIME', `${path}.at required for instant`, path);
  }
  if (validTime.kind === 'interval' && (validTime.start === undefined || validTime.end === undefined)) {
    return fail('TIME', `${path}.start and end required for interval`, path);
  }
  if (validTime.kind === 'unknown' && !validTime.reason) {
    return fail('TIME', `${path}.reason required for unknown validity`, path);
  }
  return ok();
}

function validateIdentity(identity, schema, worldId, path) {
  const required = requireKeys(
    identity,
    ['id', 'type', 'worldId', 'parentId', 'epistemicState', 'adoptionState'],
    path,
  );
  if (!required.ok) return required;
  if (identity.worldId !== worldId) {
    return fail('WORLD_ID', `${path}.worldId does not match ledger worldId`, `${path}.worldId`, {
      expected: worldId,
      actual: identity.worldId,
    });
  }
  if (!schema.epistemicStates.includes(identity.epistemicState)) {
    return fail('ENUM', `${path}.epistemicState is not allowed`, `${path}.epistemicState`);
  }
  if (!schema.adoptionStates.includes(identity.adoptionState)) {
    return fail('ENUM', `${path}.adoptionState is not allowed`, `${path}.adoptionState`);
  }
  if (identity.adoptionState === 'CANONICAL_TRUTH' || identity.adoptionState === 'GUESSED_DEFAULT') {
    return fail('ADOPTION', `${path}.adoptionState attempts an unapproved promotion`, `${path}.adoptionState`);
  }
  if (identity.type !== 'EvidenceAsset' && identity.rawAssetPath !== undefined) {
    return fail('ASSET_OBJECT_MIX', 'raw asset path cannot live on a non-EvidenceAsset identity', path);
  }
  return ok();
}

function validateSpaceFrame(spaceFrame, path) {
  const required = requireKeys(
    spaceFrame,
    ['status', 'frameId', 'geometryRole', 'unit', 'coverage'],
    path,
  );
  if (!required.ok) return required;
  if (!['Known', 'Unknown', 'Conflict'].includes(spaceFrame.status)) {
    return fail('ENUM', `${path}.status is not allowed`, `${path}.status`);
  }
  if (spaceFrame.status === 'Unknown' && !spaceFrame.reason) {
    return fail('SPACE', `${path}.reason required when space frame is Unknown`, path);
  }
  if (spaceFrame.status === 'Known' && !spaceFrame.frameId) {
    return fail('SPACE', `${path}.frameId required when Known`, path);
  }
  return ok();
}

function validateTime(time, schema, path) {
  const required = requireKeys(
    time,
    ['representedTime', 'observedTime', 'createdTime', 'validTime', 'timeRoles'],
    path,
  );
  if (!required.ok) return required;
  if (!Array.isArray(time.timeRoles) || time.timeRoles.length === 0) {
    return fail('TIME', `${path}.timeRoles must be a non-empty array`, `${path}.timeRoles`);
  }
  return validateValidTime(time.validTime, schema, `${path}.validTime`);
}

function validateScale(scale, path) {
  const required = requireKeys(
    scale,
    ['spatialSupport', 'nominalResolution', 'frequencyRole', 'scaleStatus'],
    path,
  );
  if (!required.ok) return required;
  if (!['Known', 'Unknown', 'Mixed'].includes(scale.scaleStatus)) {
    return fail('ENUM', `${path}.scaleStatus is not allowed`, `${path}.scaleStatus`);
  }
  return ok();
}

function validateQuantityState(quantityState, schema, path) {
  if (!Array.isArray(quantityState) || quantityState.length === 0) {
    return fail('QUANTITY', `${path} must be a non-empty array`, path);
  }
  const ids = new Set();
  for (let i = 0; i < quantityState.length; i += 1) {
    const item = quantityState[i];
    const itemPath = `${path}[${i}]`;
    const required = requireKeys(
      item,
      ['quantityId', 'quantityKind', 'status', 'unit', 'reference', 'valueType'],
      itemPath,
    );
    if (!required.ok) return required;
    if (ids.has(item.quantityId)) return fail('DUPLICATE', 'duplicate quantityId', itemPath);
    ids.add(item.quantityId);
    if (!schema.quantityStatuses.includes(item.status)) {
      return fail('ENUM', `${itemPath}.status is not allowed`, `${itemPath}.status`);
    }
    if (item.status === 'KNOWN') {
      if (item.value === undefined) {
        return fail('QUANTITY', `${itemPath}.value required for KNOWN`, itemPath);
      }
      if (item.valueType === 'numeric' && item.unit === null) {
        return fail('UNIT', `${itemPath}.unit required for known numeric quantity`, itemPath);
      }
      if (item.vertical === true && !item.reference?.verticalReference) {
        return fail('DATUM', `${itemPath} vertical quantity requires verticalReference`, itemPath);
      }
    } else if (item.value !== undefined) {
      return fail(
        'UNKNOWN_VALUE',
        `${itemPath} with status ${item.status} must not carry a value`,
        itemPath,
      );
    }
    if (['UNKNOWN', 'NODATA', 'NOT_OBSERVED', 'CONFLICT'].includes(item.status) && !item.reason) {
      return fail('QUANTITY', `${itemPath}.reason required for unresolved quantity`, itemPath);
    }
  }
  return ok({ quantityIds: [...ids] });
}

function validateRelations(relations, entryIds, path) {
  if (!Array.isArray(relations)) return fail('RELATION', `${path} must be an array`, path);
  for (let i = 0; i < relations.length; i += 1) {
    const relation = relations[i];
    const relationPath = `${path}[${i}]`;
    const required = requireKeys(relation, ['type', 'targetId', 'status'], relationPath);
    if (!required.ok) return required;
    if (!['Known', 'Unknown', 'Conflict', 'Candidate'].includes(relation.status)) {
      return fail('ENUM', `${relationPath}.status is not allowed`, `${relationPath}.status`);
    }
    const external = relation.targetId.startsWith('EXTERNAL:');
    if (!external && !entryIds.has(relation.targetId)) {
      return fail('RELATION_TARGET', `${relationPath}.targetId does not resolve`, relationPath, {
        targetId: relation.targetId,
      });
    }
    if (relation.status === 'Unknown' && !relation.reason) {
      return fail('RELATION', `${relationPath}.reason required for Unknown relation`, relationPath);
    }
  }
  return ok();
}

function validateObservations(observations, schema, path) {
  if (!Array.isArray(observations)) return fail('OBSERVATION', `${path} must be an array`, path);
  const ids = new Set();
  for (let i = 0; i < observations.length; i += 1) {
    const observation = observations[i];
    const observationPath = `${path}[${i}]`;
    const required = requireKeys(
      observation,
      ['observationId', 'kind', 'directness', 'sourceAssetIds', 'representedTime', 'limitations'],
      observationPath,
    );
    if (!required.ok) return required;
    if (ids.has(observation.observationId)) {
      return fail('DUPLICATE', 'duplicate observationId', observationPath);
    }
    ids.add(observation.observationId);
    if (!schema.observationDirectness.includes(observation.directness)) {
      return fail('ENUM', `${observationPath}.directness is not allowed`, `${observationPath}.directness`);
    }
    if (!Array.isArray(observation.sourceAssetIds)) {
      return fail('OBSERVATION', `${observationPath}.sourceAssetIds must be an array`, observationPath);
    }
    if (!Array.isArray(observation.limitations)) {
      return fail('OBSERVATION', `${observationPath}.limitations must be an array`, observationPath);
    }
    if (observation.assertedWorldValue !== undefined || observation.claimState !== undefined) {
      return fail('OBSERVATION_CLAIM_MIX', 'Observation cannot contain asserted claim value/state', observationPath);
    }
  }
  return ok({ observationIds: ids });
}

function validateClaims(claims, schema, observationIds, path) {
  if (!Array.isArray(claims)) return fail('CLAIM', `${path} must be an array`, path);
  const ids = new Set();
  for (let i = 0; i < claims.length; i += 1) {
    const claim = claims[i];
    const claimPath = `${path}[${i}]`;
    const required = requireKeys(
      claim,
      ['claimId', 'property', 'state', 'epistemicState', 'supportObservationIds', 'oppositionObservationIds'],
      claimPath,
    );
    if (!required.ok) return required;
    if (ids.has(claim.claimId)) return fail('DUPLICATE', 'duplicate claimId', claimPath);
    ids.add(claim.claimId);
    if (!schema.claimStates.includes(claim.state)) {
      return fail('ENUM', `${claimPath}.state is not allowed`, `${claimPath}.state`);
    }
    if (!schema.epistemicStates.includes(claim.epistemicState)) {
      return fail('ENUM', `${claimPath}.epistemicState is not allowed`, `${claimPath}.epistemicState`);
    }
    for (const listName of ['supportObservationIds', 'oppositionObservationIds']) {
      if (!Array.isArray(claim[listName])) {
        return fail('CLAIM', `${claimPath}.${listName} must be an array`, claimPath);
      }
      for (const observationId of claim[listName]) {
        if (!observationIds.has(observationId)) {
          return fail('CLAIM_OBSERVATION', `${claimPath} references missing observation`, claimPath, {
            observationId,
          });
        }
      }
    }
    if (claim.state === 'UNKNOWN' && claim.value !== undefined) {
      return fail('UNKNOWN_VALUE', `${claimPath} UNKNOWN claim must not carry a value`, claimPath);
    }
    if (claim.rawPayload !== undefined || claim.sourceSha256 !== undefined) {
      return fail('CLAIM_ASSET_MIX', 'Claim cannot contain raw evidence payload identity', claimPath);
    }
  }
  return ok({ claimIds: ids });
}

function validateProvenance(provenance, path) {
  const required = requireKeys(
    provenance,
    ['sourceAssets', 'transformations', 'lineage', 'independenceSummary', 'processingVersion'],
    path,
  );
  if (!required.ok) return required;
  if (!Array.isArray(provenance.sourceAssets) || !Array.isArray(provenance.transformations)) {
    return fail('PROVENANCE', `${path}.sourceAssets and transformations must be arrays`, path);
  }
  const assetIds = new Set();
  const roots = new Set();
  for (let i = 0; i < provenance.sourceAssets.length; i += 1) {
    const asset = provenance.sourceAssets[i];
    const assetPath = `${path}.sourceAssets[${i}]`;
    const assetRequired = requireKeys(
      asset,
      ['assetId', 'role', 'lineageType', 'independenceRoot', 'sha256'],
      assetPath,
    );
    if (!assetRequired.ok) return assetRequired;
    if (assetIds.has(asset.assetId)) return fail('DUPLICATE', 'duplicate source asset', assetPath);
    assetIds.add(asset.assetId);
    if (asset.independenceRoot) roots.add(asset.independenceRoot);
    if (asset.sha256 !== null && !/^[a-f0-9]{64}$/.test(asset.sha256)) {
      return fail('HASH', `${assetPath}.sha256 must be null or 64 lowercase hex`, assetPath);
    }
  }
  for (let i = 0; i < provenance.transformations.length; i += 1) {
    const transformation = provenance.transformations[i];
    const transformationPath = `${path}.transformations[${i}]`;
    const tRequired = requireKeys(
      transformation,
      ['transformationId', 'method', 'inputAssetIds', 'outputRole', 'reproducible'],
      transformationPath,
    );
    if (!tRequired.ok) return tRequired;
    for (const inputAssetId of transformation.inputAssetIds) {
      if (!assetIds.has(inputAssetId)) {
        return fail('TRANSFORM_INPUT', `${transformationPath} input asset is missing`, transformationPath, {
          inputAssetId,
        });
      }
    }
  }
  const summary = provenance.independenceSummary;
  const summaryRequired = requireKeys(
    summary,
    ['uniqueIndependenceRoots', 'declaredIndependentRootCount', 'copyCountDoesNotIncreaseEvidence'],
    `${path}.independenceSummary`,
  );
  if (!summaryRequired.ok) return summaryRequired;
  const declaredRoots = [...summary.uniqueIndependenceRoots].sort();
  const actualRoots = [...roots].sort();
  if (stableStringify(declaredRoots) !== stableStringify(actualRoots)) {
    return fail('INDEPENDENCE_ROOTS', 'declared independence roots do not match source assets', path, {
      declaredRoots,
      actualRoots,
    });
  }
  if (summary.declaredIndependentRootCount !== actualRoots.length) {
    return fail('INDEPENDENCE_COUNT', 'independent root count is incorrect', path, {
      declared: summary.declaredIndependentRootCount,
      actual: actualRoots.length,
    });
  }
  if (summary.copyCountDoesNotIncreaseEvidence !== true) {
    return fail('COPY_LINEAGE', 'copies must not increase independent evidence count', path);
  }
  return ok({ assetIds, independenceRoots: actualRoots });
}

function validateUncertainty(uncertainty, schema, path) {
  const required = requireKeys(uncertainty, ['byProperty', 'sharedBiasGroups'], path);
  if (!required.ok) return required;
  if (!Array.isArray(uncertainty.byProperty) || uncertainty.byProperty.length === 0) {
    return fail('UNCERTAINTY', `${path}.byProperty must be non-empty`, path);
  }
  for (let i = 0; i < uncertainty.byProperty.length; i += 1) {
    const item = uncertainty.byProperty[i];
    const itemPath = `${path}.byProperty[${i}]`;
    const itemRequired = requireKeys(item, ['property', 'state', 'reason'], itemPath);
    if (!itemRequired.ok) return itemRequired;
    if (!schema.absenceStates.includes(item.state)) {
      return fail('ENUM', `${itemPath}.state is not allowed`, `${itemPath}.state`);
    }
    if (item.numericBounds !== undefined) {
      if (!Array.isArray(item.numericBounds) || item.numericBounds.length !== 2) {
        return fail('UNCERTAINTY', `${itemPath}.numericBounds must be [min,max]`, itemPath);
      }
      if (!item.boundsEvidence) {
        return fail('UNCERTAINTY', `${itemPath}.boundsEvidence required for numeric bounds`, itemPath);
      }
    }
  }
  if (!Array.isArray(uncertainty.sharedBiasGroups)) {
    return fail('UNCERTAINTY', `${path}.sharedBiasGroups must be an array`, path);
  }
  if (uncertainty.objectConfidenceScore !== undefined) {
    return fail('UNCERTAINTY', 'single object-wide confidence score is not accepted', path);
  }
  return ok();
}

function validateChange(change, schema, path) {
  const required = requireKeys(change, ['mode', 'events', 'historyRequired'], path);
  if (!required.ok) return required;
  if (!schema.changeModes.includes(change.mode)) {
    return fail('ENUM', `${path}.mode is not allowed`, `${path}.mode`);
  }
  if (!Array.isArray(change.events)) return fail('CHANGE', `${path}.events must be an array`, path);
  return ok();
}

function validateView(view, entryId, path) {
  const required = requireKeys(
    view,
    ['viewId', 'sourceEntryId', 'recomputable', 'overwritesEvidence', 'canonicalTruth', 'query'],
    path,
  );
  if (!required.ok) return required;
  if (view.sourceEntryId !== entryId) {
    return fail('VIEW_SOURCE', `${path}.sourceEntryId must match identity.id`, path);
  }
  if (view.recomputable !== true) return fail('VIEW', `${path}.recomputable must be true`, path);
  if (view.overwritesEvidence !== false) {
    return fail('VIEW', `${path}.overwritesEvidence must be false`, path);
  }
  if (view.canonicalTruth !== false) {
    return fail('VIEW', `${path}.canonicalTruth must be false for this candidate ledger`, path);
  }
  return ok();
}

function validateCoreEntry(entry, schema, worldId, entryIds) {
  if (!isPlainObject(entry)) return fail('TYPE', 'entry must be an object');
  const required = requireKeys(entry, schema.requiredEntrySections, 'entry');
  if (!required.ok) return required;

  const validators = [
    validateIdentity(entry.identity, schema, worldId, 'entry.identity'),
    validateSpaceFrame(entry.spaceFrame, 'entry.spaceFrame'),
    validateTime(entry.time, schema, 'entry.time'),
    validateScale(entry.scale, 'entry.scale'),
    validateQuantityState(entry.quantityState, schema, 'entry.quantityState'),
  ];
  for (const result of validators) if (!result.ok) return result;

  const observationResult = validateObservations(entry.observations, schema, 'entry.observations');
  if (!observationResult.ok) return observationResult;
  const claimsResult = validateClaims(
    entry.claims,
    schema,
    observationResult.meta.observationIds,
    'entry.claims',
  );
  if (!claimsResult.ok) return claimsResult;
  const relationsResult = validateRelations(entry.relations, entryIds, 'entry.relations');
  if (!relationsResult.ok) return relationsResult;
  const provenanceResult = validateProvenance(entry.provenance, 'entry.provenance');
  if (!provenanceResult.ok) return provenanceResult;
  const uncertaintyResult = validateUncertainty(entry.uncertainty, schema, 'entry.uncertainty');
  if (!uncertaintyResult.ok) return uncertaintyResult;
  const changeResult = validateChange(entry.change, schema, 'entry.change');
  if (!changeResult.ok) return changeResult;
  const viewResult = validateView(entry.view, entry.identity.id, 'entry.view');
  if (!viewResult.ok) return viewResult;

  for (const observation of entry.observations) {
    for (const sourceAssetId of observation.sourceAssetIds) {
      if (!provenanceResult.meta.assetIds.has(sourceAssetId)) {
        return fail('OBSERVATION_ASSET', 'Observation references source asset missing from provenance', null, {
          observationId: observation.observationId,
          sourceAssetId,
        });
      }
    }
  }

  return ok({
    entryId: entry.identity.id,
    semanticFingerprint: sha256Text(stableStringify(entry)),
    observationCount: entry.observations.length,
    claimCount: entry.claims.length,
    independentRootCount: provenanceResult.meta.independenceRoots.length,
  });
}

function validateLedger(ledger, schema) {
  const ledgerRequired = requireKeys(
    ledger,
    ['schema', 'version', 'status', 'worldId', 'entries', 'currentBestViewPolicy'],
    'ledger',
  );
  if (!ledgerRequired.ok) return ledgerRequired;
  if (!Array.isArray(ledger.entries) || ledger.entries.length === 0) {
    return fail('LEDGER', 'ledger.entries must be a non-empty array', 'ledger.entries');
  }
  const entryIds = new Set();
  for (let i = 0; i < ledger.entries.length; i += 1) {
    const id = ledger.entries[i]?.identity?.id;
    if (!id) return fail('IDENTITY', `ledger.entries[${i}] identity.id missing`);
    if (entryIds.has(id)) return fail('DUPLICATE', `duplicate entry identity ${id}`);
    entryIds.add(id);
  }

  const results = [];
  for (let i = 0; i < ledger.entries.length; i += 1) {
    const result = validateCoreEntry(ledger.entries[i], schema, ledger.worldId, entryIds);
    if (!result.ok) {
      return fail(result.code, result.message, `ledger.entries[${i}]${result.path ? `.${result.path}` : ''}`, {
        entryId: ledger.entries[i].identity.id,
        ...result.meta,
      });
    }
    results.push(result.meta);
  }

  const policy = ledger.currentBestViewPolicy;
  if (
    policy.recomputable !== true ||
    policy.overwritesEvidence !== false ||
    policy.overwritesConflict !== false
  ) {
    return fail('VIEW_POLICY', 'currentBestViewPolicy violates non-destructive view rules');
  }

  return ok({
    entryCount: ledger.entries.length,
    entryIds: [...entryIds],
    semanticFingerprints: Object.fromEntries(results.map((result) => [result.entryId, result.semanticFingerprint])),
    totalObservations: results.reduce((sum, result) => sum + result.observationCount, 0),
    totalClaims: results.reduce((sum, result) => sum + result.claimCount, 0),
    totalIndependentRootsAcrossEntries: results.reduce(
      (sum, result) => sum + result.independentRootCount,
      0,
    ),
  });
}

module.exports = {
  stableStringify,
  validateCoreEntry,
  validateLedger,
};
