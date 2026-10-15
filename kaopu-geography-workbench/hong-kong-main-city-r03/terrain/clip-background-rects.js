/* Independent render-cache operation. Does not edit terrain sources or sample floors.
 * Browser: HKBackgroundRectClip.clipTerrainOutsideRects(v, indices, rectangles)
 * Node: require('./clip-background-rects.js')
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.HKBackgroundRectClip = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const STRIDE = 7;

  function normalizeRects(rectangles) {
    if (!Array.isArray(rectangles)) throw new TypeError('rectangles must be an array');
    return rectangles.map((r, i) => {
      const q = { minX: r.minX, minZ: r.minZ, maxX: r.maxX, maxZ: r.maxZ };
      if (!Object.values(q).every(Number.isFinite) || !(q.minX < q.maxX && q.minZ < q.maxZ)) {
        throw new RangeError('Rectangle ' + i + ' needs finite minX < maxX and minZ < maxZ');
      }
      return q;
    });
  }

  function rectanglesFromManifest(manifest) {
    const origin = manifest.coordinateReference && manifest.coordinateReference.mapOrigin;
    if (!origin || origin.length !== 2 || !origin.every(Number.isFinite)) {
      throw new TypeError('manifest.coordinateReference.mapOrigin must be [E0, N0]');
    }
    return normalizeRects(manifest.patches.map(p => {
      const b = p.bounds_epsg2326;
      if (!b || b.length !== 4) throw new TypeError('Missing bounds_epsg2326: ' + p.id);
      return { minX: b[0] - origin[0], minZ: origin[1] - b[3],
        maxX: b[2] - origin[0], maxZ: origin[1] - b[1] };
    }));
  }

  function cross(a, b, c) {
    return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
  }
  function area2(poly) {
    if (poly.length < 3) return 0;
    let sum = 0;
    // Local differences avoid cancellation at large projected coordinates.
    for (let i = 1; i + 1 < poly.length; ++i) sum += cross(poly[0], poly[i], poly[i + 1]);
    return sum;
  }
  function samePoint(a, b) { return a.x === b.x && a.z === b.z; }
  function tidy(poly) {
    const out = [];
    for (const p of poly) if (!out.length || !samePoint(out[out.length - 1], p)) out.push(p);
    if (out.length > 1 && samePoint(out[0], out[out.length - 1])) out.pop();
    return out;
  }
  function bboxOverlaps(poly, rect) {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    for (const p of poly) { minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z); }
    // Exact touch has no area, so never changes the original triangle.
    return maxX > rect.minX && minX < rect.maxX && maxZ > rect.minZ && minZ < rect.maxZ;
  }
  function intersection(a, b, axis, bound) {
    if (a[axis] === bound) return a;
    if (b[axis] === bound) return b;
    // Canonical low-to-high interpolation is identical for either edge direction.
    if (a[axis] > b[axis]) { const swap = a; a = b; b = swap; }
    const t = (bound - a[axis]) / (b[axis] - a[axis]);
    const p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, index: -1 };
    p[axis] = bound; // Exact boundary, no epsilon growth or inward feathering.
    return p;
  }
  function split(poly, axis, bound, direction) {
    const inside = [], outside = [];
    let previous = poly[poly.length - 1];
    let dp = direction * (previous[axis] - bound);
    for (const current of poly) {
      const dc = direction * (current[axis] - bound);
      if ((dp < 0 && dc > 0) || (dp > 0 && dc < 0)) {
        const p = intersection(previous, current, axis, bound);
        inside.push(p); outside.push(p);
      }
      // Boundary is in both closed polygon representations, but has zero area.
      // This is geometrically equivalent to half-open rectangle ownership.
      if (dc >= 0) inside.push(current);
      if (dc <= 0) outside.push(current);
      previous = current; dp = dc;
    }
    return { inside: tidy(inside), outside: tidy(outside) };
  }
  function subtractRect(poly, rect) {
    if (!bboxOverlaps(poly, rect)) return { changed: false, pieces: [poly] };
    let remaining = poly;
    const pieces = [];
    for (const [axis, bound, direction] of [
      ['x', rect.minX, 1], ['x', rect.maxX, -1],
      ['z', rect.minZ, 1], ['z', rect.maxZ, -1]
    ]) {
      if (!remaining.length) break;
      const halves = split(remaining, axis, bound, direction);
      if (halves.outside.length >= 3 && area2(halves.outside) !== 0) pieces.push(halves.outside);
      remaining = halves.inside;
    }
    // A bounding-box overlap alone does not establish triangle intersection.
    // Keep a nonintersected source polygon verbatim, including edge/point touches.
    if (remaining.length < 3 || area2(remaining) === 0) return { changed: false, pieces: [poly] };
    return { changed: true, pieces };
  }

  /**
   * Subtract the union of local XZ rectangles from indexed, stride-7 triangles.
   * positions: Array, Float32Array, or Float64Array [X,Y,Z,NX,NY,NZ,mask,...].
   * indices: flat triangle indices. rectangles: [{minX,minZ,maxX,maxZ},...].
   * options.traceSources: additionally return an output-triangle -> input-triangle map.
   * Returns {positions: Float64Array, indices: Uint32Array, stats, triangleSources?}.
   * The old vertex prefix and every untouched nondegenerate triangle's index order
   * remain exact; all output arrays are independent of the inputs. Attributes of
   * appended vertices are affine/barycentric values from the ORIGINAL triangle.
   * Normals are deliberately NOT renormalized; neither are mask values rounded.
   * GPU upload must explicitly convert positions to Float32Array (see contract).
   */
  function clipTerrainOutsideRects(positions, indices, rectangles, options) {
    options = options || {};
    if (!(Array.isArray(positions) || positions instanceof Float32Array || positions instanceof Float64Array)
      || positions.length % STRIDE !== 0) throw new TypeError('positions must have stride 7');
    if (!(Array.isArray(indices) || indices instanceof Uint16Array || indices instanceof Uint32Array)
      || indices.length % 3 !== 0) throw new TypeError('indices must contain complete triangles');
    const rects = normalizeRects(rectangles);
    const vertexCount = positions.length / STRIDE;
    const appended = [];
    let outputIndices = new Uint32Array(indices.length + 1024), outputLength = 0;
    const sources = options.traceSources ? [] : null;
    const stats = { sourceVertices: vertexCount, sourceTriangles: indices.length / 3,
      bboxCandidates: 0, untouchedTriangles: 0, clippedTriangles: 0, fullyRemovedTriangles: 0,
      droppedDegenerateTriangles: 0, droppedRoundoffTriangles: 0, appendedVertices: 0,
      outputTriangles: 0, sourceAreaXZ: 0, outputAreaXZ: 0, removedAreaXZ: 0 };
    // Compensated sums keep the tiny edited region measurable in a very large map.
    const sumError = { sourceAreaXZ: 0, outputAreaXZ: 0, removedAreaXZ: 0 };
    function addStat(name, value) {
      const y = value - sumError[name], t = stats[name] + y;
      sumError[name] = (t - stats[name]) - y; stats[name] = t;
    }
    function emit(a, b, c, source) {
      if (outputLength + 3 > outputIndices.length) {
        const grown = new Uint32Array(Math.max(outputLength + 3, outputIndices.length * 2));
        grown.set(outputIndices); outputIndices = grown;
      }
      outputIndices[outputLength++] = a; outputIndices[outputLength++] = b; outputIndices[outputLength++] = c;
      if (sources) sources.push(source);
    }
    for (let ti = 0; ti < indices.length; ti += 3) {
      const id0 = indices[ti], id1 = indices[ti + 1], id2 = indices[ti + 2];
      if (!Number.isInteger(id0) || id0 < 0 || id0 >= vertexCount
        || !Number.isInteger(id1) || id1 < 0 || id1 >= vertexCount
        || !Number.isInteger(id2) || id2 < 0 || id2 >= vertexCount) throw new RangeError('Invalid triangle index');
      const ax = positions[id0 * STRIDE], az = positions[id0 * STRIDE + 2];
      const bx = positions[id1 * STRIDE], bz = positions[id1 * STRIDE + 2];
      const cx = positions[id2 * STRIDE], cz = positions[id2 * STRIDE + 2];
      if (!Number.isFinite(ax) || !Number.isFinite(az) || !Number.isFinite(bx)
        || !Number.isFinite(bz) || !Number.isFinite(cx) || !Number.isFinite(cz)) throw new RangeError('Triangle XZ must be finite');
      const originalArea2 = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      if (originalArea2 === 0) { ++stats.droppedDegenerateTriangles; continue; }
      const originalArea = Math.abs(originalArea2) * 0.5;
      addStat('sourceAreaXZ', originalArea);
      const minX = Math.min(ax, bx, cx), maxX = Math.max(ax, bx, cx);
      const minZ = Math.min(az, bz, cz), maxZ = Math.max(az, bz, cz);
      let candidates = null;
      for (const r of rects) if (maxX > r.minX && minX < r.maxX && maxZ > r.minZ && minZ < r.maxZ) {
        if (!candidates) candidates = [];
        candidates.push(r);
      }
      if (!candidates) {
        emit(id0, id1, id2, ti / 3); ++stats.untouchedTriangles;
        addStat('outputAreaXZ', originalArea); continue;
      }
      // Allocate polygons only for the small bounding-box candidate set.
      const ids = [id0, id1, id2];
      const triangle = [{ x: ax, z: az, index: id0 }, { x: bx, z: bz, index: id1 }, { x: cx, z: cz, index: id2 }];
      ++stats.bboxCandidates;
      let pieces = [triangle], changed = false;
      for (const rect of candidates) {
        const next = [];
        for (const poly of pieces) {
          const cut = subtractRect(poly, rect);
          changed = changed || cut.changed;
          for (const piece of cut.pieces) next.push(piece);
        }
        pieces = next;
        if (!pieces.length) break;
      }
      if (!changed) {
        emit(ids[0], ids[1], ids[2], ti / 3); ++stats.untouchedTriangles;
        addStat('outputAreaXZ', originalArea); continue;
      }
      ++stats.clippedTriangles;
      const pointIndices = new Map();
      function indexFor(p) {
        if (p.index >= 0) return p.index;
        const key = p.x + ',' + p.z;
        if (pointIndices.has(key)) return pointIndices.get(key);
        const a = triangle[0], b = triangle[1], c = triangle[2];
        const w1 = ((p.x - a.x) * (c.z - a.z) - (p.z - a.z) * (c.x - a.x)) / originalArea2;
        const w2 = ((b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)) / originalArea2;
        const newIndex = vertexCount + appended.length / STRIDE;
        for (let k = 0; k < STRIDE; ++k) {
          const va = positions[ids[0] * STRIDE + k];
          const vb = positions[ids[1] * STRIDE + k];
          const vc = positions[ids[2] * STRIDE + k];
          const value = k === 0 ? p.x : k === 2 ? p.z : va + w1 * (vb - va) + w2 * (vc - va);
          if (!Number.isFinite(value)) throw new RangeError('Clipped triangle attributes must be finite');
          appended.push(value);
        }
        pointIndices.set(key, newIndex); return newIndex;
      }
      let keptArea = 0, emittedCount = 0;
      for (const poly of pieces) for (let j = 1; j + 1 < poly.length; ++j) {
        const signed = cross(poly[0], poly[j], poly[j + 1]);
        if (signed === 0) { ++stats.droppedDegenerateTriangles; continue; }
        if ((signed > 0) !== (originalArea2 > 0)) { ++stats.droppedRoundoffTriangles; continue; }
        emit(indexFor(poly[0]), indexFor(poly[j]), indexFor(poly[j + 1]), ti / 3);
        keptArea += Math.abs(signed) * 0.5; ++emittedCount;
      }
      if (!emittedCount) ++stats.fullyRemovedTriangles;
      addStat('outputAreaXZ', keptArea); addStat('removedAreaXZ', originalArea - keptArea);
    }
    const outputPositions = new Float64Array(positions.length + appended.length);
    outputPositions.set(positions); outputPositions.set(appended, positions.length);
    stats.appendedVertices = appended.length / STRIDE;
    stats.outputTriangles = outputLength / 3;
    const result = { positions: outputPositions, indices: outputIndices.slice(0, outputLength), stats };
    if (sources) result.triangleSources = Uint32Array.from(sources);
    return result;
  }

  return Object.freeze({ STRIDE, clipTerrainOutsideRects, rectanglesFromManifest });
});
