/**
 * Retain the newest exact cloth geometry until a real presentation needs it.
 *
 * This module never changes solver state, yarn samples, materials, visibility,
 * or shadow policy. The host decides whether an object is needed by either
 * the beauty pass or a shadow pass. Unknown visibility must remain required.
 *
 * stage() owns copies of position, normal and topology arrays, so a later
 * worker snapshot cannot mutate a queued or committed baseline. apply() must
 * read its row without modifying those arrays. Metadata may update without
 * invalidating geometry. There is no displacement tolerance or distance LOD.
 */

const GEOMETRY_KEYS = ['positions', 'normals', 'indices'];

function typedArray(value) {
  return ArrayBuffer.isView(value) && !(value instanceof DataView);
}

function exactArray(a, b) {
  if (a === b) return true;
  if (!a || !b || a.constructor !== b.constructor || a.byteLength !== b.byteLength) return false;
  const left = new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
  const right = new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
  for (let i = 0; i < left.length; i++) if (left[i] !== right[i]) return false;
  return true;
}

function exactGeometry(row, geometry) {
  return !!geometry && GEOMETRY_KEYS.every(key => exactArray(row[key], geometry[key]));
}

function validateRow(row) {
  if (!row || typeof row.id !== 'string' || !row.id) throw new TypeError('A render row needs an independent garment id.');
  for (const key of GEOMETRY_KEYS) {
    if (!typedArray(row[key])) throw new TypeError(row.id + '.' + key + ' must be a typed array.');
  }
  if (row.positions.length !== row.normals.length || row.positions.length % 3 || row.indices.length % 3) {
    throw new RangeError(row.id + ' has inconsistent position, normal or triangle lengths.');
  }
}

function cloneGeometry(row) {
  return Object.fromEntries(GEOMETRY_KEYS.map(key => [key, row[key].slice()]));
}

function geometryBytes(geometry) {
  return GEOMETRY_KEYS.reduce((sum, key) => sum + geometry[key].byteLength, 0);
}

export function createRenderDemand({now = () => performance.now()} = {}) {
  const entries = new Map();
  const stats = {
    stageCalls: 0, stagedRows: 0, changedRows: 0, unchangedRows: 0,
    coalescedRows: 0, geometryCopies: 0, geometryCopiedBytes: 0,
    commitCalls: 0, uploadedRows: 0, deferredRows: 0, unchangedCommitRows: 0,
    failedCommits: 0, invalidations: 0, removedRows: 0,
    stageMS: 0, commitMS: 0
  };

  const pending = entry => !!entry.latest && (entry.invalidated || entry.geometry !== entry.committed);
  const pendingIDs = () => [...entries].filter(([, entry]) => pending(entry)).map(([id]) => id);

  function stage(rows = []) {
    const began = now(), changedIDs = [], unchangedIDs = [];
    stats.stageCalls++;
    try {
      // Validate the complete batch before replacing any prior snapshot.
      const seen = new Set();
      for (const row of rows) {
        validateRow(row);
        if (seen.has(row.id)) throw new Error('Duplicate render row: ' + row.id);
        seen.add(row.id);
      }
      for (const row of rows) {
        let entry = entries.get(row.id);
        if (!entry) {
          entry = {latest: null, geometry: null, committed: null, invalidated: false};
          entries.set(row.id, entry);
        }
        stats.stagedRows++;
        const unchanged = exactGeometry(row, entry.geometry);
        if (unchanged) {
          stats.unchangedRows++;
          unchangedIDs.push(row.id);
        } else {
          if (pending(entry)) stats.coalescedRows++;
          // Returning to the geometry already on the GPU needs no upload.
          if (exactGeometry(row, entry.committed)) entry.geometry = entry.committed;
          else {
            entry.geometry = cloneGeometry(row);
            stats.geometryCopies++;
            stats.geometryCopiedBytes += geometryBytes(entry.geometry);
          }
          stats.changedRows++;
          changedIDs.push(row.id);
        }
        entry.latest = {...row, ...entry.geometry};
      }
      return {changedIDs, unchangedIDs, pendingIDs: pendingIDs()};
    } finally {
      stats.stageMS += now() - began;
    }
  }

  function hasPending(required = () => true) {
    for (const [id, entry] of entries) if (pending(entry) && required(id, entry.latest)) return true;
    return false;
  }

  function commit({required = () => true, apply} = {}) {
    if (typeof apply !== 'function') throw new TypeError('A synchronous geometry apply callback is required.');
    const began = now(), uploadedIDs = [], deferredIDs = [], unchangedIDs = [];
    stats.commitCalls++;
    try {
      for (const [id, entry] of entries) {
        if (!pending(entry)) {
          stats.unchangedCommitRows++;
          unchangedIDs.push(id);
          continue;
        }
        if (!required(id, entry.latest)) {
          stats.deferredRows++;
          deferredIDs.push(id);
          continue;
        }
        const geometry = entry.geometry, row = entry.latest;
        // Advance the baseline only after the retained native deformation
        // path has accepted this snapshot. A thrown error remains retryable.
        const result = apply(id, row);
        if (result && typeof result.then === 'function') throw new TypeError('Geometry apply must be synchronous.');
        entry.committed = geometry;
        entry.invalidated = false;
        stats.uploadedRows++;
        uploadedIDs.push(id);
      }
      return {uploadedIDs, deferredIDs, unchangedIDs, pendingIDs: pendingIDs()};
    } catch (error) {
      stats.failedCommits++;
      throw error;
    } finally {
      stats.commitMS += now() - began;
    }
  }

  function remove(id) {
    const removed = entries.delete(id);
    if (removed) stats.removedRows++;
    return removed;
  }

  function invalidate(id) {
    const targets = id === undefined ? [...entries.values()] : [entries.get(id)].filter(Boolean);
    for (const entry of targets) {
      entry.invalidated = true;
      stats.invalidations++;
    }
    return targets.length;
  }

  function audit() {
    const geometry = new Set();
    for (const entry of entries.values()) {
      if (entry.geometry) geometry.add(entry.geometry);
      if (entry.committed) geometry.add(entry.committed);
    }
    return {
      policy: 'Exact geometry changes; newest pending state; required beauty or shadow objects only',
      solverStateModified: false, visibilityInferred: false,
      displacementTolerance: 0, materialOrSamplingPolicyChanged: false,
      ...stats, garmentCount: entries.size, pendingIDs: pendingIDs(),
      retainedGeometryBytes: [...geometry].reduce((sum, value) => sum + geometryBytes(value), 0),
      note: 'Uploaded rows count calls to the host deformation path; GPU completion remains the original frame gate responsibility.'
    };
  }

  return {stage, hasPending, commit, remove, invalidate, audit};
}
