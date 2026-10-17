/**
 * Editable student-native approximation of an A4 rear tender shell.
 * Metre model space uses the documented 2.743 m overall-width anchor.
 * Tender-specific silhouette dimensions and placement remain provisional.
 * This is an open shell only: no coal, chassis, suspension, or mechanical claim.
 * Geometry is generated from the parameters below, without source-model data.
 */

export const defaultRearShellParameters = Object.freeze({
  zStart: 12.9,
  length: 7.6,
  width: 2.743,
  bottom: 1.55,
  top: 4.0,
  bevelHeight: 0.45,
  bevelInset: 0.20,
  wallThickness: 0.06,
});

const PARAMETER_NAMES = Object.keys(defaultRearShellParameters);
const SIDE_NAMES = ['left', 'rear', 'right', 'front'];
const EPSILON = 1e-12;

const subtract = (a, b) => a.map((value, axis) => value - b[axis]);
const dot = (a, b) => a.reduce((sum, value, axis) => sum + value * b[axis], 0);
const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const normalize = (vector) => {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0) || !Number.isFinite(magnitude)) {
    throw new RangeError('Rear shell dimensions produce a degenerate surface.');
  }
  return vector.map((value) => value / magnitude);
};

function resolveParameters(overrides) {
  if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new TypeError('Rear shell parameters must be an object.');
  }
  for (const name of Object.keys(overrides)) {
    if (!PARAMETER_NAMES.includes(name)) {
      throw new TypeError(`Unknown rear shell parameter: ${name}`);
    }
  }
  const p = { ...defaultRearShellParameters, ...overrides };
  for (const name of PARAMETER_NAMES) {
    if (!Number.isFinite(p[name])) {
      throw new TypeError(`Rear shell ${name} must be a finite number.`);
    }
  }
  if (p.length <= 0 || p.width <= 0 || p.wallThickness <= 0 || p.bevelHeight <= 0) {
    throw new RangeError('Length, width, wall thickness, and bevel height must be positive.');
  }
  if (p.bevelInset < 0) throw new RangeError('Bevel inset must not be negative.');
  if (p.top - p.bottom <= p.bevelHeight) {
    throw new RangeError('Top must exceed bottom plus bevel height.');
  }
  if (Math.min(p.width, p.length) <= 2 * (p.bevelInset + p.wallThickness)) {
    throw new RangeError('Bevel and wall thickness must leave a positive top opening.');
  }
  return p;
}

// Ordered so each outer wall has du cross dv pointing away from the shell.
function rectangleRing(halfWidth, front, rear, y) {
  return [
    [-halfWidth, y, front],
    [-halfWidth, y, rear],
    [halfWidth, y, rear],
    [halfWidth, y, front],
  ];
}

/**
 * Build a finite-thickness, open-top/open-bottom shell.
 *
 * x: lateral; y: up; z: rearward from the first leading axle.
 * wallThickness is a horizontal x/z inset, not a certified plate gauge.
 * The upper rectangle is inset on all four sides, creating a ruled bevel.
 * UVs are local orthonormal planar coordinates: one repeat per model metre.
 * Editing dimensions therefore updates UV extent while translation
 * leaves the material attached to the shell.
 *
 * Material 0: painted lower walls and underside wall-edge strips.
 * Material 1: black upper bevel, inner bevel, and visible upper rim.
 */
export function createRearShell(parameters = {}) {
  const p = resolveParameters(parameters);
  const halfWidth = p.width / 2;
  const rear = p.zStart + p.length;
  const shoulder = p.top - p.bevelHeight;
  const outerBottom = rectangleRing(halfWidth, p.zStart, rear, p.bottom);
  const outerShoulder = rectangleRing(halfWidth, p.zStart, rear, shoulder);
  const outerTop = rectangleRing(
    halfWidth - p.bevelInset, p.zStart + p.bevelInset, rear - p.bevelInset, p.top,
  );
  const innerBottom = rectangleRing(
    halfWidth - p.wallThickness, p.zStart + p.wallThickness,
    rear - p.wallThickness, p.bottom,
  );
  const innerShoulder = rectangleRing(
    halfWidth - p.wallThickness, p.zStart + p.wallThickness,
    rear - p.wallThickness, shoulder,
  );
  const innerTop = rectangleRing(
    halfWidth - p.bevelInset - p.wallThickness,
    p.zStart + p.bevelInset + p.wallThickness,
    rear - p.bevelInset - p.wallThickness, p.top,
  );

  const positions = [];
  const normals = [];
  const uvs = [];
  const indices = [];
  const surfaces = [];
  const groups = [];

  /** Sample a planar ruled quad uniformly in (u,v), with hard edge seams. */
  function addSurface(name, corners, uSegments, vSegments, materialIndex) {
    const [a, b, c, d] = corners;
    const du = subtract(b, a);
    const dv = subtract(d, a);
    // These are exact planar partial derivatives at u=v=0. Every quad here
    // is a planar rectangle or trapezoid; its normalized cross is constant.
    const normal = normalize(cross(du, dv));
    const tangent = normalize(du);
    const bitangent = normalize(cross(normal, tangent));
    const planeError = Math.abs(dot(subtract(c, a), normal));
    const surfaceScale = Math.max(1, Math.hypot(...du), Math.hypot(...dv));
    if (planeError > EPSILON * surfaceScale) {
      throw new RangeError(`Nonplanar rear shell surface: ${name}`);
    }

    const vertexStart = positions.length / 3;
    const indexStart = indices.length;
    for (let row = 0; row <= vSegments; row += 1) {
      const v = row / vSegments;
      for (let column = 0; column <= uSegments; column += 1) {
        const u = column / uSegments;
        const point = a.map((_, axis) => (
          (1 - v) * ((1 - u) * a[axis] + u * b[axis])
          + v * ((1 - u) * d[axis] + u * c[axis])
        ));
        const relative = subtract(point, a);
        positions.push(...point);
        normals.push(...normal);
        uvs.push(dot(relative, tangent), dot(relative, bitangent));
      }
    }
    const rowLength = uSegments + 1;
    for (let row = 0; row < vSegments; row += 1) {
      for (let column = 0; column < uSegments; column += 1) {
        const i = vertexStart + row * rowLength + column;
        indices.push(i, i + 1, i + rowLength + 1, i, i + rowLength + 1, i + rowLength);
      }
    }
    surfaces.push({
      name, materialIndex, start: indexStart, count: indices.length - indexStart,
      vertexStart, vertexCount: (uSegments + 1) * (vSegments + 1),
      uSegments, vSegments,
    });
  }

  function addBand(name, lower, upper, vSegments, materialIndex, reverse = false) {
    for (let side = 0; side < 4; side += 1) {
      const next = (side + 1) % 4;
      const corners = reverse
        ? [lower[next], lower[side], upper[side], upper[next]]
        : [lower[side], lower[next], upper[next], upper[side]];
      addSurface(`${name}-${SIDE_NAMES[side]}`, corners, side % 2 === 0 ? 12 : 4, vSegments, materialIndex);
    }
  }

  const paintedStart = indices.length;
  addBand('outer-lower', outerBottom, outerShoulder, 4, 0);
  addBand('inner-lower', innerBottom, innerShoulder, 4, 0, true);
  // These strips close only the thin wall edges, never the underbody opening.
  addBand('bottom-wall-edge', outerBottom, innerBottom, 1, 0, true);
  groups.push({ start: paintedStart, count: indices.length - paintedStart, materialIndex: 0 });

  const rimStart = indices.length;
  addBand('outer-bevel', outerShoulder, outerTop, 2, 1);
  addBand('inner-bevel', innerShoulder, innerTop, 2, 1, true);
  addBand('top-rim', outerTop, innerTop, 1, 1);
  groups.push({ start: rimStart, count: indices.length - rimStart, materialIndex: 1 });

  const positionBuffer = new Float32Array(positions);
  const normalBuffer = new Float32Array(normals);
  const uvBuffer = new Float32Array(uvs);
  const indexBuffer = new Uint32Array(indices);
  // Reject a requested scale/location that collapses triangles in the actual
  // Float32 output. No hidden clamps or geometry fallbacks alter the inputs.
  for (let i = 0; i < indexBuffer.length; i += 3) {
    const a = positionBuffer.subarray(indexBuffer[i] * 3, indexBuffer[i] * 3 + 3);
    const b = positionBuffer.subarray(indexBuffer[i + 1] * 3, indexBuffer[i + 1] * 3 + 3);
    const c = positionBuffer.subarray(indexBuffer[i + 2] * 3, indexBuffer[i + 2] * 3 + 3);
    const area = Math.hypot(...cross(subtract(b, a), subtract(c, a)));
    if (!(area > 0) || !Number.isFinite(area)) {
      throw new RangeError('Requested rear shell dimensions exceed usable Float32 precision.');
    }
  }
  if (![...normalBuffer, ...uvBuffer].every(Number.isFinite)) {
    throw new RangeError('Requested rear shell dimensions exceed usable Float32 precision.');
  }

  return {
    positions: positionBuffer,
    normals: normalBuffer,
    uvs: uvBuffer,
    indices: indexBuffer,
    groups,
    metadata: {
      id: 'student-native-a4-rear-shell-r01',
      parameters: { ...p },
      dimensionalStatus: p.width === 2.743 ? 'PARTIALLY_VERIFIED' : 'UNVERIFIED_NOMINAL',
      dimensionStatus: p.width === 2.743 ? 'partial' : 'unverified',
      units: 'm; silhouette dimensions provisional',
      dimensionEvidence: {
        width: {
          value: p.width,
          status: p.width === 2.743 ? 'verified-overall-width-anchor' : 'unverified-edit',
          measuredOverallWidthMetres: 2.743,
          applicability: 'overall locomotive width anchor; tender-specific fit remains provisional',
          source: 'https://collection.sciencemuseumgroup.org.uk/objects/co205732/london-north-eastern-railway-steam-locomotive-mallard-4-6-2-a4-pacific-class-no-4468-steam-locomotive',
        },
        otherDimensions: 'unverified nominal silhouette and placement parameters',
      },
      axisConvention: { x: 'lateral', y: 'up', z: 'rearward from first leading axle' },
      construction: 'parameterized rectangular walls and planar ruled upper bevels',
      wallThicknessMeaning: 'horizontal x/z inset, not a certified plate gauge',
      approximation: true,
      sourceGeometryUsed: false,
      sourceResidualsUsed: false,
      runtimeDependencies: [],
      containsCoal: false,
      mechanicalCompleteness: 'shell only; mechanical geometry and validation are outside this module',
      openings: {
        top: true,
        bottom: true,
        topWidth: p.width - 2 * (p.bevelInset + p.wallThickness),
        topLength: p.length - 2 * (p.bevelInset + p.wallThickness),
        bottomWidth: p.width - 2 * p.wallThickness,
        bottomLength: p.length - 2 * p.wallThickness,
      },
      materialSlots: ['paint', 'black-rim'],
      materials: ['paint', 'blackPaint'],
      uvConvention: 'local planar coordinates; one repeat per model metre; shape dimensions provisional',
      normalConvention: 'analytic planar du cross dv, hard seams at panel boundaries',
      surfaces,
      vertexCount: positionBuffer.length / 3,
      triangleCount: indexBuffer.length / 3,
    },
  };
}
