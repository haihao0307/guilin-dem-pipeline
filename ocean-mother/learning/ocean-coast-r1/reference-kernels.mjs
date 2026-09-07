const TAU = Math.PI * 2;

function requireFinite(name, value) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name} must be finite`);
  }
  return value;
}

function requireNonNegative(name, value) {
  requireFinite(name, value);
  if (value < 0) {
    throw new RangeError(`${name} must be non-negative`);
  }
  return value;
}

function normalize2(x, z) {
  const length = Math.hypot(x, z);
  if (!(length > 0)) {
    throw new RangeError('wave direction must have non-zero length');
  }
  return [x / length, z / length];
}

function normalize3(x, y, z) {
  const length = Math.hypot(x, y, z);
  if (!(length > 0)) {
    throw new RangeError('normal must have non-zero length');
  }
  return [x / length, y / length, z / length];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/**
 * Create one deterministic directional wave component.
 *
 * amplitudeM and horizontalAmplitudeM are lengths in metres.
 * wavelengthM is a length in metres.
 * angularFrequencyRadPerS is radians per second.
 * directionRad is measured from +X toward +Z.
 */
export function createDirectionalWave({
  amplitudeM,
  wavelengthM,
  directionRad,
  phaseRad = 0,
  angularFrequencyRadPerS,
  horizontalAmplitudeM = 0,
}) {
  requireNonNegative('amplitudeM', amplitudeM);
  requireFinite('wavelengthM', wavelengthM);
  if (!(wavelengthM > 0)) {
    throw new RangeError('wavelengthM must be greater than zero');
  }
  requireFinite('directionRad', directionRad);
  requireFinite('phaseRad', phaseRad);
  requireNonNegative('angularFrequencyRadPerS', angularFrequencyRadPerS);
  requireFinite('horizontalAmplitudeM', horizontalAmplitudeM);

  const [directionX, directionZ] = normalize2(
    Math.cos(directionRad),
    Math.sin(directionRad),
  );

  return Object.freeze({
    amplitudeM,
    wavelengthM,
    waveNumberRadPerM: TAU / wavelengthM,
    directionRad,
    directionX,
    directionZ,
    phaseRad,
    angularFrequencyRadPerS,
    horizontalAmplitudeM,
  });
}

function evaluateTide(tideOffsetM) {
  return requireFinite('tideOffsetM', tideOffsetM ?? 0);
}

/**
 * Evaluate the complete parametric free surface X(q,t).
 *
 * The returned derivatives are generated from the same surface definition.
 * This is an isolated reference kernel. It does not reproduce the current
 * R018.11 shader or claim a full ocean spectrum.
 */
export function evaluateParametricSurface(qx, qz, timeS, recipe = {}) {
  requireFinite('qx', qx);
  requireFinite('qz', qz);
  requireFinite('timeS', timeS);

  const waves = Array.isArray(recipe.waves) ? recipe.waves : [];
  const tideM = evaluateTide(recipe.tideOffsetM ?? 0);

  let worldX = qx;
  let worldY = tideM;
  let worldZ = qz;

  let dX_dQx = 1;
  let dX_dQz = 0;
  let dY_dQx = 0;
  let dY_dQz = 0;
  let dZ_dQx = 0;
  let dZ_dQz = 1;

  let dX_dt = 0;
  let dY_dt = 0;
  let dZ_dt = 0;

  for (const wave of waves) {
    const k = requireFinite('wave.waveNumberRadPerM', wave.waveNumberRadPerM);
    const dx = requireFinite('wave.directionX', wave.directionX);
    const dz = requireFinite('wave.directionZ', wave.directionZ);
    const omega = requireNonNegative(
      'wave.angularFrequencyRadPerS',
      wave.angularFrequencyRadPerS,
    );
    const verticalAmplitude = requireNonNegative('wave.amplitudeM', wave.amplitudeM);
    const horizontalAmplitude = requireFinite(
      'wave.horizontalAmplitudeM',
      wave.horizontalAmplitudeM,
    );
    const theta = k * (dx * qx + dz * qz) - omega * timeS + wave.phaseRad;
    const sine = Math.sin(theta);
    const cosine = Math.cos(theta);

    worldX += horizontalAmplitude * dx * sine;
    worldY += verticalAmplitude * cosine;
    worldZ += horizontalAmplitude * dz * sine;

    const thetaQx = k * dx;
    const thetaQz = k * dz;

    dX_dQx += horizontalAmplitude * dx * cosine * thetaQx;
    dX_dQz += horizontalAmplitude * dx * cosine * thetaQz;
    dY_dQx += -verticalAmplitude * sine * thetaQx;
    dY_dQz += -verticalAmplitude * sine * thetaQz;
    dZ_dQx += horizontalAmplitude * dz * cosine * thetaQx;
    dZ_dQz += horizontalAmplitude * dz * cosine * thetaQz;

    dX_dt += -horizontalAmplitude * dx * omega * cosine;
    dY_dt += verticalAmplitude * omega * sine;
    dZ_dt += -horizontalAmplitude * dz * omega * cosine;
  }

  const tangentQx = [dX_dQx, dY_dQx, dZ_dQx];
  const tangentQz = [dX_dQz, dY_dQz, dZ_dQz];
  const rawNormal = cross(tangentQz, tangentQx);
  let normal = normalize3(rawNormal[0], rawNormal[1], rawNormal[2]);
  if (normal[1] < 0) {
    normal = normal.map((value) => -value);
  }

  return {
    q: [qx, qz],
    positionM: [worldX, worldY, worldZ],
    heightM: worldY,
    tideM,
    horizontalDisplacementM: [worldX - qx, worldZ - qz],
    normal,
    velocityMPerS: [dX_dt, dY_dt, dZ_dt],
    horizontalJacobian: [dX_dQx, dX_dQz, dZ_dQx, dZ_dQz],
    tangentQx,
    tangentQz,
  };
}

function hasHorizontalDisplacement(waves) {
  return waves.some((wave) => Math.abs(wave.horizontalAmplitudeM) > 0);
}

/**
 * Invert the horizontal map from parameter coordinates q to world XZ.
 * Newton iteration is guarded by a determinant threshold and a fixed budget.
 */
export function invertWorldXZ(worldX, worldZ, timeS, recipe = {}, options = {}) {
  requireFinite('worldX', worldX);
  requireFinite('worldZ', worldZ);
  requireFinite('timeS', timeS);

  const waves = Array.isArray(recipe.waves) ? recipe.waves : [];
  const toleranceM = options.toleranceM ?? 1e-9;
  const maxIterations = options.maxIterations ?? 18;
  const determinantEpsilon = options.determinantEpsilon ?? 1e-10;
  requireNonNegative('toleranceM', toleranceM);
  requireFinite('maxIterations', maxIterations);
  if (!Number.isInteger(maxIterations) || maxIterations < 0) {
    throw new RangeError('maxIterations must be a non-negative integer');
  }
  requireNonNegative('determinantEpsilon', determinantEpsilon);

  if (!hasHorizontalDisplacement(waves)) {
    return {
      q: [worldX, worldZ],
      converged: true,
      approximate: false,
      iterations: 0,
      residualM: 0,
      method: 'direct-zero-horizontal-displacement',
    };
  }

  let qx = worldX;
  let qz = worldZ;
  let residualM = Number.POSITIVE_INFINITY;
  let reason = 'iteration-budget';
  let iterationsUsed = 0;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    iterationsUsed = iteration + 1;
    const surface = evaluateParametricSurface(qx, qz, timeS, recipe);
    const errorX = surface.positionM[0] - worldX;
    const errorZ = surface.positionM[2] - worldZ;
    residualM = Math.hypot(errorX, errorZ);
    if (residualM <= toleranceM) {
      return {
        q: [qx, qz],
        converged: true,
        approximate: false,
        iterations: iteration,
        residualM,
        method: 'newton-horizontal-map',
      };
    }

    const [a, b, c, d] = surface.horizontalJacobian;
    const determinant = a * d - b * c;
    if (!Number.isFinite(determinant) || Math.abs(determinant) <= determinantEpsilon) {
      reason = 'singular-horizontal-jacobian';
      break;
    }

    const deltaQx = (d * errorX - b * errorZ) / determinant;
    const deltaQz = (-c * errorX + a * errorZ) / determinant;
    qx -= deltaQx;
    qz -= deltaQz;

    if (!Number.isFinite(qx) || !Number.isFinite(qz)) {
      reason = 'non-finite-newton-step';
      break;
    }
  }

  const finalSurface = evaluateParametricSurface(qx, qz, timeS, recipe);
  residualM = Math.hypot(
    finalSurface.positionM[0] - worldX,
    finalSurface.positionM[2] - worldZ,
  );

  return {
    q: [qx, qz],
    converged: residualM <= toleranceM,
    approximate: residualM > toleranceM,
    iterations: iterationsUsed,
    residualM,
    method: `newton-horizontal-map:${reason}`,
  };
}

/**
 * Query the same free surface in world coordinates.
 */
export function sampleSurfaceWorld(worldX, worldZ, timeS, recipe = {}, options = {}) {
  const inverse = invertWorldXZ(worldX, worldZ, timeS, recipe, options);
  const surface = evaluateParametricSurface(inverse.q[0], inverse.q[1], timeS, recipe);
  return {
    ...surface,
    requestedWorldXZ: [worldX, worldZ],
    queryResidualM: Math.hypot(
      surface.positionM[0] - worldX,
      surface.positionM[2] - worldZ,
    ),
    queryMethod: inverse.method,
    queryIterations: inverse.iterations,
    queryConverged: inverse.converged,
    approximate: inverse.approximate,
  };
}

export function waterDepthM(surfaceHeightM, bedHeightM) {
  requireFinite('surfaceHeightM', surfaceHeightM);
  requireFinite('bedHeightM', bedHeightM);
  return Math.max(0, surfaceHeightM - bedHeightM);
}

export function isWet(surfaceHeightM, bedHeightM, epsilonM = 0) {
  requireNonNegative('epsilonM', epsilonM);
  return waterDepthM(surfaceHeightM, bedHeightM) > epsilonM;
}

/**
 * Homogeneous-medium beam transmittance.
 * sigmaA and sigmaS use inverse metres. pathM uses metres.
 */
export function beamTransmittanceRGB(sigmaA, sigmaS, pathM) {
  if (!Array.isArray(sigmaA) || sigmaA.length !== 3) {
    throw new TypeError('sigmaA must be an RGB array');
  }
  if (!Array.isArray(sigmaS) || sigmaS.length !== 3) {
    throw new TypeError('sigmaS must be an RGB array');
  }
  requireNonNegative('pathM', pathM);

  return sigmaA.map((absorption, index) => {
    requireNonNegative(`sigmaA[${index}]`, absorption);
    requireNonNegative(`sigmaS[${index}]`, sigmaS[index]);
    return Math.exp(-(absorption + sigmaS[index]) * pathM);
  });
}
