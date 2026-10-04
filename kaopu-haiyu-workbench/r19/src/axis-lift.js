/* Haiyu R19: a candidate, axis-organized lift of author stages 04 and 05.
 *
 * The source is the supplied R18/author-source.txt, not anatomical 3D data.
 * Exact author screen coordinates remain available through sourceSample and
 * sourcePointByIndex. The solid deliberately remaps longitudinal material y.
 * The source's rapid cos(i/7) is resolved as a continuous phase u in [-1, 1].
 * Inserting y=i/598 and u=cos(i/7) recovers every original source point.
 *
 * Every ring occupies a different plane normal to a straight, monotonic axis.
 * Exact qEven and RMS qOdd drive positive elliptical section dimensions; the
 * exact k=0 c drives frame twist. This avoids the longitudinal backtracking of
 * a direct sweep through the original XY trace. Thickness=0 collapses section
 * area, but does NOT reproduce the original XY point projection. The remapping,
 * positive width floor and finite depth are declared candidate design choices.
 * No camera, view angle, lighting, random number or accumulated frame state
 * participates in this construction. This is not a biological reconstruction.
 */
(function (root) {
  'use strict';

  const PI = Math.PI;
  const TWO_PI = 2 * PI;
  const AUTHOR_PERIOD = 16 * PI;
  const AUTHOR_STEP = PI / 30;
  const SOURCE_COUNT = 20000;
  const SOURCE_MAX_Y = (SOURCE_COUNT - 1) / 598;
  const EPS = 1e-12;
  const defaults = Object.freeze({ thickness: 0.5, depth: 0.5, detail: 0.5, motion: 1 });

  function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  }
  function length(a) { return Math.hypot(a[0], a[1], a[2]); }
  function unit(a, fallback) {
    const n = length(a);
    return n > EPS && Number.isFinite(n) ? scale(a, 1 / n) : fallback.slice();
  }
  function clamp01(value, fallback) {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
  }
  function parameters(params) {
    params = params || {};
    return {
      thickness: clamp01(params.thickness, defaults.thickness),
      depth: clamp01(params.depth, defaults.depth),
      detail: clamp01(params.detail, defaults.detail),
      motion: clamp01(params.motion, defaults.motion)
    };
  }
  function checkKind(kind) {
    if (kind !== 'multifrequency' && kind !== 'biomotion') {
      throw new TypeError('HaiyuAxisLift kind must be multifrequency or biomotion');
    }
  }
  function authorTime(t) {
    if (typeof t !== 'number' || !Number.isFinite(t)) throw new TypeError('HaiyuAxisLift requires finite author time');
    // Preserve the author's 480-frame/16π loop; do not multiply t by motion.
    const wrapped = t % AUTHOR_PERIOD;
    return wrapped < 0 ? wrapped + AUTHOR_PERIOD : wrapped;
  }

  // The source equations are kept together, with no candidate geometry mixed in.
  function fields(kind, y, u, t) {
    const e = y / 5 - 11;
    const k = (5 + Math.sin(y)) * u;
    const d = Math.hypot(k, e) / 0.6 - 6;
    const harmonic = 3 * Math.sin(e) + e * Math.sin(2 * e) + Math.sin(4 * d);
    const qEven = 99 + d * Math.sin(t - d);
    const qOdd = y / 23 * k * harmonic;
    const q = qEven + qOdd;
    const basePhase = d / 4 - t / 8;
    // This is the sole formula difference between 04 and 05.
    const phaseCorrection = kind === 'biomotion' ? Math.cos(t + e) / 9 : 0;
    const c = basePhase + phaseCorrection;
    return { y, u, e, k, d, harmonic, qEven, qOdd, q, c, basePhase, phaseCorrection,
      point: [q * Math.sin(c) + 200, q * Math.cos(c) + 200, 0] };
  }

  function sourceSample(kind, y, u, t) {
    checkKind(kind);
    if (!Number.isFinite(y) || y < 0 || y > SOURCE_MAX_Y || !Number.isFinite(u) || Math.abs(u) > 1) {
      throw new RangeError('Source material coordinates require 0 <= y <= SOURCE_MAX_Y and -1 <= u <= 1');
    }
    return fields(kind, y, u, authorTime(t));
  }

  function sourcePointByIndex(kind, i, t) {
    if (!Number.isInteger(i) || i < 0 || i >= SOURCE_COUNT) throw new RangeError('Source index outside 0..19999');
    return sourceSample(kind, i / 598, Math.cos(i / 7), t).point;
  }

  function localFrame(kind, y, t) {
    const phase = fields(kind, y, 0, t).c;
    const tangent = [0, 1, 0];
    const normal = [Math.cos(phase), 0, -Math.sin(phase)];
    const binormal = cross(tangent, normal);
    return { tangent, normal, binormal };
  }

  function sectionPoint(kind, y, u, half, t, params, frame, section) {
    // Positive ellipse: all branches are radial in the same axis-normal plane.
    // RMS retains the full q harmonic as a scalar width driver without letting
    // the original screen trace reverse longitudinal material order.
    const normalOffset = section.halfWidth * u;
    const depthOffset = section.fieldDepth * half * Math.sqrt(Math.max(0, 1 - u * u));
    const point = add(section.center, add(scale(frame.normal, normalOffset), scale(frame.binormal, depthOffset)));
    return { point, sourceU: u };
  }

  function projectedArea(points, center, frame) {
    let twiceArea = 0;
    for (let i = 0; i < points.length; i++) {
      const a = sub(points[i], center), b = sub(points[(i + 1) % points.length], center);
      twiceArea += dot(a, frame.normal) * dot(b, frame.binormal) - dot(b, frame.normal) * dot(a, frame.binormal);
    }
    return Math.abs(twiceArea) / 2;
  }

  function triangulateSection(points, center, frame) {
    // Triangulate in the section's own normal/binormal plane.
    const plane = points.map(function (p) { const delta = sub(p, center); return [dot(delta, frame.normal), dot(delta, frame.binormal)]; });
    function turn(a, b, c) { return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]); }
    let area = 0;
    for (let i = 0; i < plane.length; i++) area += plane[i][0] * plane[(i + 1) % plane.length][1] - plane[(i + 1) % plane.length][0] * plane[i][1];
    const order = plane.map(function (_, i) { return i; });
    if (area < -1e-10) order.reverse();
    const tolerance = Math.abs(area) * 1e-14;
    const triangles = [];
    if (Math.abs(area) < 1e-10) {
      // Exact zero thickness intentionally collapses a section to a segment.
      for (let i = 1; i < order.length - 1; i++) triangles.push([order[0], order[i], order[i + 1]]);
      return triangles;
    }
    while (order.length > 3) {
      let cut = false;
      for (let i = 0; i < order.length; i++) {
        const ia = order[(i + order.length - 1) % order.length], ib = order[i], ic = order[(i + 1) % order.length];
        const a = plane[ia], b = plane[ib], c = plane[ic];
        if (turn(a, b, c) <= tolerance) continue;
        let contains = false;
        for (const other of order) {
          if (other === ia || other === ib || other === ic) continue;
          const p = plane[other];
          if (turn(a, b, p) >= -tolerance && turn(b, c, p) >= -tolerance && turn(c, a, p) >= -tolerance) { contains = true; break; }
        }
        if (!contains) {
          triangles.push([ia, ib, ic]); order.splice(i, 1); cut = true; break;
        }
      }
      if (!cut) {
        // An exactly collinear point can be dropped with a zero-area triangle.
        let smallest = Infinity, remove = 0;
        for (let i = 0; i < order.length; i++) {
          const value = Math.abs(turn(plane[order[(i + order.length - 1) % order.length]], plane[order[i]], plane[order[(i + 1) % order.length]]));
          if (value < smallest) { smallest = value; remove = i; }
        }
        triangles.push([order[(remove + order.length - 1) % order.length], order[remove], order[(remove + 1) % order.length]]);
        order.splice(remove, 1);
      }
    }
    triangles.push(order.slice());
    return triangles;
  }

  function closedSweep(positions, faces, faceKinds, rings, centers, frames, kindForFace) {
    const count = rings.length, around = rings[0].length;
    for (let row = 0; row < count - 1; row++) {
      for (let col = 0; col < around; col++) {
        const next = (col + 1) % around;
        const a = rings[row][col], b = rings[row][next];
        const c = rings[row + 1][next], d = rings[row + 1][col];
        // Match the upper/lower material-u diagonals. Opposite diagonals on a
        // twisted zero-thickness quad would create a spurious enclosed wedge.
        if (col < around / 2) faces.push([a, b, c], [a, c, d]);
        else faces.push([a, b, d], [b, c, d]);
        const kind = kindForFace(row, col);
        faceKinds.push(kind, kind);
      }
    }
    const capFaces = { start: [], end: [], method: 'N/B-projected ear clipping' };
    for (const row of [0, count - 1]) {
      const triangles = triangulateSection(rings[row].map(function (i) { return positions[i]; }), centers[row], frames[row]);
      for (const triangle of triangles) {
        const face = triangle.map(function (i) { return rings[row][i]; });
        if (row === 0) face.reverse();
        capFaces[row === 0 ? 'start' : 'end'].push(faces.length);
        faces.push(face);
        faceKinds.push(kindForFace(row === 0 ? 0 : count - 2, triangle[1]));
      }
    }
    return capFaces;
  }

  function signedVolume(positions, faces, faceKinds, selectedKind) {
    // Translate to a local origin to reduce cancellation for author XY≈200.
    const origin = positions[0];
    let volume = 0;
    for (let i = 0; i < faces.length; i++) {
      if (selectedKind && faceKinds[i] !== selectedKind) continue;
      const face = faces[i];
      volume += dot(sub(positions[face[0]], origin), cross(sub(positions[face[1]], origin), sub(positions[face[2]], origin))) / 6;
    }
    return volume;
  }

  function evaluate(kind, t, inputParams) {
    checkKind(kind);
    t = authorTime(t);
    const params = parameters(inputParams);
    const rows = 64 + 64 * params.detail | 0;
    // Multiples of four include the center/top/bottom exactly.
    const around = 24 + 4 * Math.round(5 * params.detail);
    const columnAround = 8 + 2 * Math.round(2 * params.detail);
    const positions = [], faces = [], faceKinds = [], lines = [], spine = [], sections = [];
    const fieldRings = [], columnRings = [];
    let minArea = Infinity, minFrameHandedness = Infinity;
    let minBilateralSeparation = Infinity, maxDepth = 0;

    for (let row = 0; row < rows; row++) {
      const s = row / (rows - 1), y = s * SOURCE_MAX_Y;
      const axis = fields(kind, y, 0, t);
      // A fixed 3.2×99 author-unit length is an explicitly chosen display
      // scale. The strictly increasing material coordinate is never deformed.
      const center = [200, 200 + (s - 0.5) * 3.2 * 99, 0];
      const frame = localFrame(kind, y, t);
      let harmonicEnergy = 0;
      for (let j = 1; j <= 8; j++) {
        const source = fields(kind, y, j / 8, t);
        harmonicEnergy += source.qOdd * source.qOdd;
      }
      const envelope = Math.sqrt(harmonicEnergy / 8);
      const longitudinalEnvelope = 0.75 + 0.25 * Math.sin(PI * s);
      // All parameters below are explicit design assumptions. motion only
      // articulates inferred depth and leaves the source time/phase untouched.
      const articulation = 1 + 0.12 * params.motion * Math.sin(t - axis.d);
      const outwardFloor = 0.04 * axis.qEven;
      const halfWidth = outwardFloor + envelope;
      const fieldDepth = params.thickness * (0.7 + 1.7 * params.depth) * (1 + 0.012 * envelope) * articulation;
      const columnWidth = params.thickness * (1.7 + 0.013 * envelope) * longitudinalEnvelope;
      const columnDepth = params.thickness * (2.4 + 5.5 * params.depth) * longitudinalEnvelope * articulation;
      const section = { y, material: s, center, frame, sourceAxis: axis, envelope, outwardFloor, halfWidth, fieldDepth, columnWidth, columnDepth,
        points: [], sourceU: [], plus: [], minus: [], ringIndices: [], columnIndices: [] };
      spine.push(center);

      const ring = [];
      for (let col = 0; col < around; col++) {
        const angle = TWO_PI * col / around;
        let u = Math.cos(angle);
        if (Math.abs(u) < EPS) u = 0;
        const half = Math.sin(angle) < 0 ? -1 : 1;
        const vertex = sectionPoint(kind, y, u, half, t, params, frame, section);
        ring.push(positions.length);
        section.points.push(vertex.point);
        section.sourceU.push(vertex.sourceU);
        positions.push(vertex.point);
        maxDepth = Math.max(maxDepth, Math.abs(vertex.point[2]));
      }
      fieldRings.push(ring);
      section.ringIndices = ring;

      const columnRing = [];
      for (let col = 0; col < columnAround; col++) {
        const angle = TWO_PI * col / columnAround;
        const p = add(center, add(scale(frame.normal, columnWidth * Math.cos(angle)), scale(frame.binormal, columnDepth * Math.sin(angle))));
        columnRing.push(positions.length);
        positions.push(p);
        maxDepth = Math.max(maxDepth, Math.abs(p[2]));
      }
      section.columnIndices = columnRing;
      columnRings.push(columnRing);

      for (let step = 0; step <= 10; step++) {
        const u = step / 10;
        section.plus.push(sectionPoint(kind, y, u, 1, t, params, frame, section).point);
        section.minus.push(sectionPoint(kind, y, -u, 1, t, params, frame, section).point);
      }
      // Both sides now extend from exactly the same monotonic material axis.
      const right = section.plus[10], left = section.minus[10];
      section.bilateralMidpoint = scale(add(right, left), 0.5);
      section.bilateralSeparation = dot(sub(right, left), frame.normal);
      section.area = projectedArea(section.points, center, frame);
      minArea = Math.min(minArea, section.area);
      minFrameHandedness = Math.min(minFrameHandedness, dot(cross(frame.tangent, frame.normal), frame.binormal));
      minBilateralSeparation = Math.min(minBilateralSeparation, section.bilateralSeparation);
      sections.push(section);

      if (row % 4 === 0 || row === rows - 1) {
        const tail = s > 0.82;
        lines.push({ points: section.plus, color: tail ? '#91ded3' : '#b6dcd9', width: 0.62, kind: 'rib-positive' });
        lines.push({ points: section.minus, color: tail ? '#91ded3' : '#b6dcd9', width: 0.62, kind: 'rib-negative' });
      }
    }

    const frames = sections.map(function (section) { return section.frame; });
    const fieldCaps = closedSweep(positions, faces, faceKinds, fieldRings, spine, frames, function (row, col) {
      if ((row + 0.5) / (rows - 1) > 0.82) return 'tail';
      return Math.abs(Math.cos(TWO_PI * (col + 0.5) / around)) < 0.24 ? 'body' : 'fin';
    });
    const columnCaps = closedSweep(positions, faces, faceKinds, columnRings, spine, frames, function () { return 'spine'; });

    // Longitudinal edge curves expose that the same material points move in 3D.
    lines.push({ points: sections.map(function (s) { return s.plus[10]; }), color: '#8cd7cc', width: 0.9, kind: 'edge-positive' });
    lines.push({ points: sections.map(function (s) { return s.minus[10]; }), color: '#8cd7cc', width: 0.9, kind: 'edge-negative' });
    lines.push({ points: spine.map(function (p) { return p.slice(); }), color: '#e8b86c', width: 0.8, kind: 'axis' });

    const bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const p of positions) {
      for (let d = 0; d < 3; d++) { bounds.min[d] = Math.min(bounds.min[d], p[d]); bounds.max[d] = Math.max(bounds.max[d], p[d]); }
    }
    const allSignedVolume = signedVolume(positions, faces, faceKinds);
    const columnSignedVolume = signedVolume(positions, faces, faceKinds, 'spine');
    return {
      positions, faces, faceKinds, lines, spine, sections,
      diagnostics: {
        kind, authorTime: t, authorPeriod: AUTHOR_PERIOD, authorStep: AUTHOR_STEP, periodFrames: 480,
        params, rows, around, columnAround, vertexCount: positions.length, faceCount: faces.length,
        bounds, maxDepth, minSectionArea: minArea, minBilateralSeparation, minFrameHandedness,
        signedVolume: allSignedVolume, absoluteSignedVolume: Math.abs(allSignedVolume),
        columnSignedVolume, fieldSignedVolume: allSignedVolume - columnSignedVolume,
        columnVolume: Math.abs(columnSignedVolume), fieldVolume: Math.abs(allSignedVolume - columnSignedVolume),
        fieldCaps, columnCaps,
        axisDirection: [0, 1, 0], axisLength: 3.2 * 99,
        sourcePlane: 'Original XY projection, including +200,+200 framing, is preserved only in sourceSample/sourcePointByIndex',
        candidate: 'Monotonic material-axis lift: qEven and RMS qOdd drive positive ellipse widths, exact k=0 c twists orthonormal frames, and candidate depth closes the sections; not anatomy or teacher-supplied 3D',
        motionMeaning: 'Scales only inferred depth articulation; preserves exact author time and 16π loop',
        depthMeaning: 'Shapes finite candidate cross-section depth; thickness=0 gives zero-area twisted ribbon sections, not the original XY projection',
        overlapNote: 'The column and bilateral field are separate closed overlapping shells, not a watertight Boolean union or a claim of anatomically valid topology',
        sourceFoldNote: 'Original XY longitudinal folds are intentionally removed by distinct axis-normal ring planes; exact source projection equivalence is deliberately relinquished'
      }
    };
  }

  const api = Object.freeze({ evaluate, sourceSample, sourcePointByIndex, defaults,
    AUTHOR_PERIOD, AUTHOR_STEP, SOURCE_COUNT, SOURCE_MAX_Y });
  root.HaiyuAxisLift = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
