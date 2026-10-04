/* Haiyu R20: source-driven articulated organism candidates for 04 and 05.
 *
 * The source is the supplied R18/author-source.txt, not anatomical 3D data.
 * Exact author screen coordinates remain available through sourceSample and
 * sourcePointByIndex. The solid deliberately remaps longitudinal material y.
 * The source's rapid cos(i/7) is resolved as a continuous phase u in [-1, 1].
 * Inserting y=i/598 and u=cos(i/7) recovers every original source point.
 *
 * A narrow body follows the curved k=0 source pose. Signed qOdd lobes become
 * individually rooted, capped blade organs rather than one RMS oval shell.
 * Organ partition, body envelope, depth and anatomical reading are candidates.
 * The source's rigid -t/8 rotation is removed from the local organism pose;
 * exact source projection remains available through the two source APIs.
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

  // R20 geometry follows below. The exact source functions above are unchanged.
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function pose(kind, s, t, p) {
    const y = s * SOURCE_MAX_Y, f = fields(kind, y, 0, t);
    const radial = 99 + f.d * (Math.sin(-f.d) + p.motion * (Math.sin(t - f.d) - Math.sin(-f.d)));
    const correction = kind === 'biomotion' ? (Math.cos(f.e) + p.motion * (Math.cos(t + f.e) - Math.cos(f.e))) / 9 : 0;
    const angle = f.d / 4 + correction;
    return [200 + radial * Math.sin(angle), 200 + radial * Math.cos(angle), 0];
  }
  function materialFrame(kind, s, t, p) {
    const h = 0.00005, a = pose(kind, s - h, t, p), c = pose(kind, s + h, t, p), center = pose(kind, s, t, p);
    const derivative = scale(sub(c, a), 1 / (2 * h)), tangent = unit(derivative, [0, 1, 0]);
    const normal = [tangent[1], -tangent[0], 0], binormal = cross(tangent, normal);
    const second = scale(add(sub(c, scale(center, 2)), a), 1 / (h * h));
    const curvature = length(cross(derivative, second)) / Math.max(EPS, length(derivative) ** 3);
    return { tangent, normal, binormal, speed: length(derivative), curvatureRadius: 1 / Math.max(curvature, 1e-8) };
  }
  function bodyDimensions(kind, s, t, p) {
    const y = s * SOURCE_MAX_Y, f = fields(kind, y, 0.25, t);
    const ends = Math.max(0.075, Math.sin(PI * clamp(s, 0, 1))) ** 0.3;
    const d0 = fields(kind, y, 0, t).d, d1 = fields(kind, y, 1, t).d;
    const evenArcSpan = 2 * 99 * Math.sin((d1 - d0) / 8);
    const thorax = Math.exp(-(((s - 0.23) / 0.24) ** 4));
    const head = 0.28 * evenArcSpan * thorax;
    const taper = 1 - 0.65 * Math.pow(clamp((s - 0.65) / 0.35, 0, 1), 1.4);
    const proposedWidth = (kind === 'biomotion' ? 1.35 : 1) * (3.1 + head + 0.10 * Math.abs(f.qOdd)) * ends * taper;
    const width = Math.min(proposedWidth, 0.50 * materialFrame(kind, s, t, p).curvatureRadius);
    const depth = width * (0.52 + 0.30 * p.depth) * p.thickness;
    return { width, depth };
  }
  function broadBand(s) { return s < 0.24 ? 0 : s < 0.50 ? 1 : s < 0.71 ? 2 : s < 0.90 ? 3 : 4; }
  function featherAddresses() {
    const n = 1800, values = [];
    for (let i = 0; i <= n; i++) values.push(fields('multifrequency', SOURCE_MAX_Y * i / n, 1, 0).qOdd);
    const peaks = [];
    for (let i = 1; i < n; i++) {
      const s = i / n;
      if (s < 0.12 || s > 0.87 || Math.abs(values[i]) < 7) continue;
      if (Math.abs(values[i]) >= Math.abs(values[i - 1]) && Math.abs(values[i]) > Math.abs(values[i + 1])) {
        if (!peaks.length || s - peaks[peaks.length - 1] > 0.039) peaks.push(s);
      }
    }
    return peaks;
  }
  const FEATHER_ROOTS = featherAddresses();
  // Large paddle roots are the strongest signed qOdd extrema in broad bands.
  const PADDLE_ROOTS = [1, 2, 3].map(function (band) {
    let best = 0, at = 0;
    for (let i = 0; i <= 1800; i++) {
      const s = i / 1800;
      if (broadBand(s) !== band) continue;
      const value = Math.abs(fields('biomotion', SOURCE_MAX_Y * s, 0.8, 0).qOdd);
      if (value > best) { best = value; at = s; }
    }
    return at;
  });

  function evaluate(kind, t, inputParams) {
    checkKind(kind); t = authorTime(t);
    const p = parameters(inputParams), positions = [], faces = [], faceKinds = [], faceComponents = [], lines = [], spine = [], sections = [], components = [];
    const bodyRows = 64 + Math.round(32 * p.detail), bodyAround = 12 + 4 * Math.round(p.detail);
    const organRows = 11 + Math.round(5 * p.detail), organAround = 8 + 2 * Math.round(p.detail);
    let maxAttachmentError = 0, curvatureLimitedOrgans = 0;
    function face(a, b, c, kindTag, id) { faces.push([a, b, c]); faceKinds.push(kindTag); faceComponents.push(id); }
    function tube(id, kindTag, rows, around, evaluateSection, metadata) {
      const startVertex = positions.length, startFace = faces.length, centers = [], rings = [], ringsXYZ = [], crests = [];
      for (let row = 0; row <= rows; row++) {
        const v = row / rows, section = evaluateSection(v), ring = [], pts = [];
        centers.push(section.center);
        crests.push(add(section.center, scale(section.binormal, section.depth * 1.015)));
        for (let j = 0; j < around; j++) {
          const theta = TWO_PI * j / around;
          const point = add(section.center, add(scale(section.normal, section.width * Math.cos(theta)), scale(section.binormal, section.depth * Math.sin(theta))));
          ring.push(positions.length); positions.push(point); pts.push(point);
        }
        rings.push(ring); ringsXYZ.push(pts);
      }
      for (let row = 0; row < rows; row++) for (let j = 0; j < around; j++) {
        const next = (j + 1) % around, a = rings[row][j], b = rings[row][next], c = rings[row + 1][next], d = rings[row + 1][j];
        if (j < around / 2) { face(a, b, c, kindTag, id); face(a, c, d, kindTag, id); }
        else { face(a, b, d, kindTag, id); face(b, c, d, kindTag, id); }
      }
      const first = positions.length; positions.push(centers[0].slice(), centers[rows].slice());
      for (let j = 0; j < around; j++) {
        const next = (j + 1) % around;
        face(first, rings[0][next], rings[0][j], kindTag, id);
        face(first + 1, rings[rows][j], rings[rows][next], kindTag, id);
      }
      const component = { id, kind: kindTag, startVertex, vertexCount: positions.length - startVertex, startFace, faceCount: faces.length - startFace,
        centers, rings, ...metadata };
      components.push(component);
      return { component, ringsXYZ, crests };
    }

    const body = tube('body', 'body', bodyRows, bodyAround, function (s) {
      const center = pose(kind, s, t, p), frame = materialFrame(kind, s, t, p), dim = bodyDimensions(kind, s, t, p);
      const section = { y: s * SOURCE_MAX_Y, material: s, center, frame, halfWidth: dim.width, fieldDepth: dim.depth, points: [], plus: [], minus: [], area: PI * dim.width * dim.depth };
      spine.push(center); sections.push(section);
      return { center, normal: frame.normal, binormal: frame.binormal, width: dim.width, depth: dim.depth };
    }, { attachment: 'continuous closed core', anatomicalInterpretation: 'narrow source-axis body with explicit head/tail taper' });
    for (let i = 0; i < sections.length; i++) {
      const section = sections[i]; section.points = body.ringsXYZ[i]; section.ringIndices = body.component.rings[i];
      section.plus = [section.center, section.points[0]]; section.minus = [section.center, section.points[bodyAround / 2]];
    }
    const shaft = tube('spine', 'spine', bodyRows, 8, function (s) {
      const center = pose(kind, s, t, p), f = materialFrame(kind, s, t, p), containing = bodyDimensions(kind, s, t, p);
      return { center, normal: f.normal, binormal: f.binormal,
        width: Math.min((0.65 + 0.30 * (1 - s)) * p.thickness, 0.72 * containing.width),
        depth: Math.min((0.65 + 0.45 * p.depth) * p.thickness, 0.72 * containing.depth) };
    }, { attachment: 'embedded central column' });
    for (let i = 0; i < sections.length; i++) sections[i].columnIndices = shaft.component.rings[i];

    // At y=0 qOdd vanishes, but the even-in-k phase traces the source's forward
    // curved head arc. A k=0-only shaft omits this entire visible head region.
    const headWidth = bodyDimensions(kind, 0, t, p).width;
    function headCenter(v) {
      const f = fields(kind, 0, clamp(v, 0, 1), t);
      const q = 99 + f.d * (Math.sin(-f.d) + p.motion * (Math.sin(t - f.d) - Math.sin(-f.d)));
      const phase = f.d / 4 + (kind === 'biomotion' ? (Math.cos(f.e) + p.motion * (Math.cos(t + f.e) - Math.cos(f.e))) / 9 : 0);
      return [200 + q * Math.sin(phase), 200 + q * Math.cos(phase), 0];
    }
    const head = tube('head', 'body', 16 + Math.round(6 * p.detail), bodyAround, function (v) {
      const h = 0.0001, center = headCenter(v), tangent = unit(sub(headCenter(Math.min(1, v + h)), headCenter(Math.max(0, v - h))), scale(sections[0].frame.tangent, -1));
      const normal = [tangent[1], -tangent[0], 0], binormal = cross(tangent, normal);
      const width = 0.20 + headWidth * Math.pow(1 - v, 0.72) + (kind === 'biomotion' ? 2.5 : 1.3) * Math.sin(PI * v);
      return { center, normal, binormal, width, depth: p.thickness * width * (0.58 + 0.18 * p.depth) };
    }, { rootS: 0, rootPoint: pose(kind, 0, t, p), attachment: 'source even-k head arc joins anterior body cap', allowedBodyContactFraction: 0.18 });
    for (const j of [0, bodyAround / 2]) lines.push({ points: head.ringsXYZ.map(r => r[j]), color: '#c4dcd2', width: 0.6, kind: 'head-contour' });

    const roots = kind === 'multifrequency' ? FEATHER_ROOTS : PADDLE_ROOTS;
    for (let rootIndex = 0; rootIndex < roots.length; rootIndex++) {
      const s = roots[rootIndex], y = s * SOURCE_MAX_Y, f = fields(kind, y, 0.8, t), frame = materialFrame(kind, s, t, p), dim = bodyDimensions(kind, s, t, p);
      const neighborGap = Math.min(s - (roots[rootIndex - 1] ?? 0.06), (roots[rootIndex + 1] ?? 0.94) - s);
      const gapLength = frame.speed * neighborGap, desiredLength = 10 + Math.abs(f.qOdd) * (kind === 'multifrequency' ? 1.5 : 1.4);
      // Algebraically c(y,1)-c(y,0); cancel common time terms before evaluation
      // so a frozen organism is bitwise invariant, not just visually invariant.
      const sourceSweep = (fields(kind, y, 1, t).d - fields(kind, y, 0, t).d) / 4;
      for (const side of [-1, 1]) {
        const id = 'fin-' + (side < 0 ? 'left-' : 'right-') + rootIndex, tag = side < 0 ? 'fin-left' : 'fin-right';
        const curvatureCap = (side < 0 ? 0.62 : 0.92) * frame.curvatureRadius - dim.width;
        const organLength = Math.max(4, Math.min(desiredLength, curvatureCap, 54));
        if (organLength < desiredLength - 0.01) curvatureLimitedOrgans++;
        // Inner-curvature gaps contract away from the axis. Budget organ width
        // and sweep in that contracted gap, not in the larger root spacing.
        const availableGap = gapLength * (side < 0 ? Math.max(0.25, 1 - (dim.width + 1.11 * organLength) / frame.curvatureRadius) : 1);
        const bladeWidth = Math.max(0.60, Math.min(availableGap * (kind === 'multifrequency' ? 0.17 : 0.24), organLength * (kind === 'multifrequency' ? 0.12 : 0.28)));
        const sweep = Math.min(availableGap * 0.50, organLength * sourceSweep * 0.70);
        const requestedHook = (kind === 'multifrequency' ? 1.45 : 1.15) + Math.min(0.55, sourceSweep * 0.6);
        const hook = side < 0 ? Math.min(1.44, requestedHook) : requestedHook;
        // Root burial is bounded by the organ's own reach. A fixed fraction of
        // a thick thorax can otherwise swallow a short inner-curvature paddle.
        const rootInset = Math.min(0.08 * dim.width, 0.04 * organLength);
        const anchor = add(pose(kind, s, t, p), scale(frame.normal, side * (dim.width - rootInset)));
        const phase = kind === 'biomotion' ? t + f.e : t - f.d;
        const restPhase = kind === 'biomotion' ? f.e : -f.d;
        const response = Math.sin(restPhase) + p.motion * (Math.sin(phase) - Math.sin(restPhase));
        const flap = Math.sign(f.qOdd || 1) * 0.12 + response * (kind === 'biomotion' ? 0.32 : 0.21);
        const rootOutward = add(scale(frame.normal, side * Math.cos(flap)), scale(frame.binormal, Math.sin(flap)));
        const organPlaneNormal = unit(cross(rootOutward, frame.tangent), frame.binormal);
        function centerAt(v) {
          const lag = p.motion * 0.075 * v * (Math.sin(phase - 0.65 * v) - Math.sin(restPhase - 0.65 * v));
          const angle = flap + lag;
          const lateral = add(scale(frame.normal, side * Math.cos(angle)), scale(frame.binormal, Math.sin(angle)));
          const camber = Math.sign(f.qOdd || 1) * (0.6 + p.depth) * Math.sin(PI * v) * v;
          const outward = organLength * Math.sin(hook * v) / Math.sin(hook);
          const backward = -sweep * (1 - Math.cos(hook * v)) / (1 - Math.cos(hook));
          return add(anchor, add(scale(lateral, outward), add(scale(frame.tangent, backward), scale(frame.binormal, camber))));
        }
        const organ = tube(id, tag, organRows, organAround, function (v) {
          const center = centerAt(v), h = 0.0001, before = centerAt(v - h), after = centerAt(v + h);
          const derivative = scale(sub(after, before), 1 / (2 * h));
          const second = scale(add(sub(after, scale(center, 2)), before), 1 / (h * h));
          const localRadius = length(derivative) ** 3 / Math.max(EPS, length(cross(derivative, second)));
          const tangent = unit(derivative, scale(frame.normal, side));
          const normal = unit(cross(organPlaneNormal, tangent), frame.tangent), binormal = cross(tangent, normal);
          const tip = 3.7 * Math.max(0, v) ** 0.65 * Math.max(0, 1 - v) ** 1.8;
          const width = Math.min(0.28 * localRadius, 0.035 + Math.min(1.6, bladeWidth * 0.48) * (1 - v) ** 1.3 + bladeWidth * tip);
          const depth = Math.min(0.28 * localRadius, p.thickness * (0.08 + (0.42 + 0.65 * p.depth) * tip) * (kind === 'multifrequency' ? 0.65 : 0.85));
          return { center, normal, binormal, width, depth };
        }, { rootS: s, rootPoint: anchor, side, sourceBand: broadBand(s), sourceSignedAmplitude: f.qOdd, organLength, desiredLength, bladeWidth,
          curvatureRadius: frame.curvatureRadius, rootInset, attachment: 'root burial is at most 8% of body radius and 4% of organ reach', allowedBodyContactFraction: 0.16 });
        maxAttachmentError = Math.max(maxAttachmentError, length(sub(organ.component.centers[0], anchor)));
        lines.push({ points: organ.crests, color: side < 0 ? '#b9dfda' : '#91c2c4', width: 0.75, kind: 'fin-vein' });
        for (const j of [0, Math.floor(organAround / 2)]) lines.push({ points: organ.ringsXYZ.map(r => r[j]), color: '#a7cfcc', width: 0.38, kind: 'fin-edge' });
        for (let r = 2; r < organRows - 2; r += 2) for (const j of [0, Math.floor(organAround / 2)]) {
          const at = Math.min(organRows, r + 2);
          const mid = Math.round(j === 0 ? organAround / 8 : organAround * 3 / 8);
          lines.push({ points: [organ.crests[r], organ.ringsXYZ[r + 1][mid], organ.ringsXYZ[at][j]], color: '#b3d5d1', width: 0.38, kind: 'fin-rib' });
        }
      }
    }

    // Terminal qOdd band supplies the tail's scale. Separate branches retain a
    // visible fork/fan instead of hiding a label in the last 18% of one shell.
    const tailS = 0.987, tailFrame = materialFrame(kind, tailS, t, p), tailAxis = pose(kind, tailS, t, p), tailField = fields(kind, 0.986 * SOURCE_MAX_Y, 0.8, t);
    const tailLength = clamp(Math.abs(tailField.qOdd) * (kind === 'biomotion' ? 0.66 : 0.51), 14, 31);
    const tailBranches = kind === 'multifrequency' ? [-1, -0.5, 0.5, 1] : [-1, 1];
    for (let branch = 0; branch < tailBranches.length; branch++) {
      const side = tailBranches[branch], id = 'tail-' + branch;
      const anchor = add(tailAxis, scale(tailFrame.normal, side * bodyDimensions(kind, tailS, t, p).width * 0.45));
      const wave = Math.sin(tailField.e) + p.motion * (Math.sin(t + tailField.e) - Math.sin(tailField.e));
      function tailCenter(v) {
        return add(anchor, add(scale(tailFrame.tangent, tailLength * v), add(scale(tailFrame.normal, side * tailLength * 0.40 * v ** 1.3), scale(tailFrame.binormal, (kind === 'biomotion' ? 4.2 : 2.2) * wave * v * v))));
      }
      const organ = tube(id, 'tail', organRows, organAround, function (v) {
        const h = 0.0001, tangent = unit(sub(tailCenter(v + h), tailCenter(Math.max(0, v - h))), tailFrame.tangent);
        const normal = unit(sub(tailFrame.normal, scale(tangent, dot(tailFrame.normal, tangent))), tailFrame.normal), binormal = cross(tangent, normal);
        const leafWidth = 0.10 + (kind === 'biomotion' ? 3.1 : 0.95) * Math.max(0, Math.sin(PI * v)) ** 0.8;
        const separationWidth = 0.065 + tailLength * (kind === 'biomotion' ? 0.12 : 0.038) * v ** 1.3;
        const width = Math.min(leafWidth, separationWidth);
        return { center: tailCenter(v), normal, binormal, width, depth: p.thickness * (0.18 + 0.6 * Math.sin(PI * v)) };
      }, { rootS: tailS, rootPoint: anchor, side, sourceSignedAmplitude: tailField.qOdd, attachment: 'tail fan roots deliberately embedded in terminal body', allowedBodyContactFraction: 0.25 });
      lines.push({ points: organ.component.centers, color: '#b9dfda', width: 0.65, kind: 'tail-ray' });
    }
    for (const j of [0, Math.floor(bodyAround / 4), Math.floor(bodyAround / 2), Math.floor(3 * bodyAround / 4)]) {
      lines.push({ points: body.ringsXYZ.map(r => r[j]), color: '#bbd9d2', width: 0.48, kind: 'body-streamline' });
    }
    lines.push({ points: spine, color: '#e5b86e', width: 0.85, kind: 'axis' });

    const origin = positions[0], bounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    for (const point of positions) for (let d = 0; d < 3; d++) { bounds.min[d] = Math.min(bounds.min[d], point[d]); bounds.max[d] = Math.max(bounds.max[d], point[d]); }
    for (const component of components) {
      let volume = 0;
      for (let i = component.startFace; i < component.startFace + component.faceCount; i++) {
        const f = faces[i]; volume += dot(sub(positions[f[0]], origin), cross(sub(positions[f[1]], origin), sub(positions[f[2]], origin))) / 6;
      }
      component.signedVolume = volume;
    }
    return { positions, faces, faceKinds, faceComponents, lines, spine, sections, components,
      diagnostics: { kind, authorTime: t, authorPeriod: AUTHOR_PERIOD, periodFrames: 480, params: p, vertexCount: positions.length, faceCount: faces.length,
        bounds, maxDepth: Math.max(Math.abs(bounds.min[2]), Math.abs(bounds.max[2])), bodySignedVolume: components[0].signedVolume,
        columnSignedVolume: components[1].signedVolume, fieldSignedVolume: components.filter(c => c.kind !== 'spine').reduce((sum, c) => sum + c.signedVolume, 0),
        minSectionArea: Math.min(...sections.map(s => s.area)), minCurvatureRadius: Math.min(...sections.map(s => s.frame.curvatureRadius)),
        minBodyCurvatureMargin: Math.min(...sections.map(s => s.frame.curvatureRadius - s.halfWidth)), maxAttachmentError, curvatureLimitedOrgans,
        bilateralPairs: roots.length, tailBranches: tailBranches.length, roots,
        candidate: 'Curved source-axis organism; a narrow body, signed-lobe rooted blades and terminal tail branches are new explicit anatomical interpretations, not recovered anatomy',
        sourceFidelity: 'Exact q/e/k/d/c and original projection preserved in source APIs; local pose removes rigid -t/8 spin, and morphology partitions qOdd into separate organs instead of an RMS shell',
        motionMeaning: 'Internal source waves and their inherited organ response blend from rest; motion=0 freezes all geometry; every setting repeats over 16π',
        depthMeaning: 'Candidate organ thickness/camber, not measured anatomy',
        overlapNote: 'Separate closed organs deliberately penetrate the body only at their buried roots; root contacts must be classified separately from unintended organ intersections' } };
  }
  const api = Object.freeze({ evaluate, sourceSample, sourcePointByIndex, defaults,
    AUTHOR_PERIOD, AUTHOR_STEP, SOURCE_COUNT, SOURCE_MAX_Y });
  root.HaiyuAxisLift = api;
  if (typeof module === 'object' && module.exports) module.exports = api;
})(typeof globalThis === 'undefined' ? this : globalThis);
